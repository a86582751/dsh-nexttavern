import {createAuthorNativeMvuHookGraph} from '../author-native-mvu-hook-graph.js'
import type {AuthorNativeMvuContextWritesV1} from '../author-native-mvu-hook-types.js'
import type {Mvu196HookStage,Mvu196UpdateInputV1,Mvu196UpdateProgressV1} from '../tavern-mvu-update-protocol-v1.js'
import type {Command,createMvu196Core,Mvu196ExecutionMode,Mvu196UpdateEvent,Mvu196UpdateFrame} from './update-core.js'
import {variable_events} from './variable-def.js'
import type {MvuData} from './variable-def.js'

export interface Mvu196UpdateControllerHooks {
  /** Public parseMessage has no internal error callback argument. */
  publicTrial?:true
  executionMode?:Mvu196ExecutionMode
  beforeApply?(frame:Mvu196UpdateFrame):void
  afterCommands?(frame:Mvu196UpdateFrame):void
  endedForZod?(frame:Mvu196UpdateFrame):AuthorNativeMvuContextWritesV1|void
}

export interface Mvu196UpdateControllerResult {
  readonly variables:MvuData
  readonly contextWrites:AuthorNativeMvuContextWritesV1
  readonly update:Mvu196UpdateProgressV1
}

type UpdateYield=Mvu196UpdateEvent|{readonly kind:'native-commands-ready'}
type UpdateSuspension=
  |{readonly kind:'native';readonly ordinal:number}
  |{readonly kind:'browser';readonly ordinal:number;readonly graph:ReturnType<typeof createAuthorNativeMvuHookGraph>}
interface UpdateState {
  readonly updateId:string
  readonly frame:Mvu196UpdateFrame
  readonly events:Generator<UpdateYield,AuthorNativeMvuContextWritesV1|void,void>
  readonly writtenKeys:Set<string>
  replaceContext:boolean
  interests:ReadonlySet<Mvu196HookStage>
  nextYieldOrdinal:number
  pending?:UpdateSuspension
}

const hookStages:Readonly<Record<string,Mvu196HookStage>>={
  [variable_events.VARIABLE_UPDATE_STARTED]:'update-started',
  [variable_events.COMMAND_PARSED]:'command-parsed',
  [variable_events.COMMAND_PARSED+'_for_zod']:'command-parsed-for-zod',
  [variable_events.COMMAND_PARSED+'_ended_for_zod']:'command-parsed-ended-for-zod',
  [variable_events.SINGLE_VARIABLE_UPDATED]:'single-variable-updated',
  [variable_events.VARIABLE_UPDATE_ENDED]:'update-ended',
  [variable_events.VARIABLE_UPDATE_ENDED+'_for_zod']:'update-ended-for-zod',
}

/** Owns one live computation. A response changes its suspended objects in place,
 * so generator locals and event-argument aliases keep their original identities. */
export function createMvu196UpdateController(
  core:ReturnType<typeof createMvu196Core>,
  hooks:Mvu196UpdateControllerHooks={},
) {
  let active:UpdateState|undefined

  function mergeWrites(state:UpdateState,writes:AuthorNativeMvuContextWritesV1|void) {
    if(writes?.kind==='replace')state.replaceContext=true
    else if(writes?.kind==='keys')for(const key of writes.keys)state.writtenKeys.add(key)
  }

  function* run(
    frame:Mvu196UpdateFrame,
    writtenKeys:Set<string>,
    maintenance=false,
  ):Generator<UpdateYield,AuthorNativeMvuContextWritesV1|void,void> {
    yield core.startedEvent(frame)
    const [parsed,forZod,endedForZod]=core.parseCommands(frame)
    if(maintenance)yield {kind:'native-commands-ready'}
    yield parsed!
    yield forZod!
    hooks.beforeApply?.(frame)
    yield endedForZod!
    yield* core.applyCommands(frame)
    hooks.afterCommands?.(frame)
    writtenKeys.add('display_data')
    writtenKeys.add('delta_data')
    yield core.endedEvent(frame)
    const ended=core.afterEnded(frame)
    if(frame.modified)writtenKeys.add('schema')
    const writes=hooks.endedForZod?.(frame)
    yield ended
    core.finish(frame)
    return writes
  }

  function result(state:UpdateState,update:Mvu196UpdateProgressV1):Mvu196UpdateControllerResult {
    return {variables:state.frame.variables,contextWrites:state.replaceContext
      ?{schemaVersion:1,kind:'replace'}
      :{schemaVersion:1,kind:'keys',keys:[...state.writtenKeys]},update}
  }

  function advance(update:Mvu196UpdateInputV1,variables?:MvuData):Mvu196UpdateControllerResult {
    if(update.encoding==='native-mvu-196-update-start-v1') {
      if(active)throw Error('SCHEMA_UPDATE_CONTINUATION_INVALID')
      if(variables===undefined)throw Error('SCHEMA_UPDATE_VARIABLES_REQUIRED')
      const frame=core.prepare(update.message,variables,hooks.publicTrial?undefined:[],hooks.executionMode),writtenKeys=new Set(['stat_data'])
      active={updateId:update.updateId,frame,events:run(frame,writtenKeys,update.maintenance),writtenKeys,
        replaceContext:false,interests:new Set(update.interests),nextYieldOrdinal:0}
    }else {
      if(!active||active.updateId!==update.updateId||!active.pending
        ||active.pending.ordinal!==update.yieldOrdinal)throw Error('SCHEMA_UPDATE_CONTINUATION_INVALID')
      if(update.encoding==='native-mvu-196-native-resume-v1') {
        if(active.pending.kind!=='native')throw Error('SCHEMA_UPDATE_CONTINUATION_INVALID')
        // The runner admitted these command records. Splicing preserves the
        // parsed COMMAND event's reference to this same mutable command array.
        active.frame.commands.splice(0,active.frame.commands.length,...update.commands as Command[])
      }else {
        if(active.pending.kind!=='browser')throw Error('SCHEMA_UPDATE_CONTINUATION_INVALID')
        active.pending.graph.apply(update.graph)
        mergeWrites(active,update.contextWrites)
      }
      active.pending=undefined
      active.interests=new Set(update.interests)
    }

    const state=active
    for(;;) {
      let next:IteratorResult<UpdateYield,AuthorNativeMvuContextWritesV1|void>
      try {
        next=state.events.next()
      }catch(error) {
        // A throwing hook closes this generator. Release only that failed
        // computation, while invalid continuation input retains a live one.
        active=undefined
        throw error
      }
      if(next.done) {
        mergeWrites(state,next.value)
        active=undefined
        return result(state,{schemaVersion:1,kind:'complete',updateId:state.updateId})
      }
      if('kind' in next.value) {
        const yieldOrdinal=state.nextYieldOrdinal++
        state.pending={kind:'native',ordinal:yieldOrdinal}
        return result(state,{schemaVersion:1,kind:'native-commands-ready',updateId:state.updateId,
          yieldOrdinal,commands:state.frame.commands})
      }
      const stage=hookStages[next.value.name]
      if(stage===undefined)throw Error('SCHEMA_UPDATE_EVENT_INVALID')
      if(!state.interests.has(stage))continue
      // The factory belongs only to this suspension. Its original nodes include
      // detached containers still held by applyCommands after a callback edit.
      const graph=createAuthorNativeMvuHookGraph(),yieldOrdinal=state.nextYieldOrdinal++
      // The optional fourth callback belongs to Native's private errors
      // collector. Public listeners share the three fixed updateVariables
      // arguments, with no function transported through a mutable DATA graph.
      const args=stage==='command-parsed-for-zod'?next.value.args.slice(0,3):[...next.value.args]
      const wire=graph.capture([state.frame.variables,state.frame.commands,args])
      state.pending={kind:'browser',ordinal:yieldOrdinal,graph}
      return result(state,{schemaVersion:1,kind:'yield',updateId:state.updateId,yieldOrdinal,stage,graph:wire})
    }
  }

  return {advance}
}
