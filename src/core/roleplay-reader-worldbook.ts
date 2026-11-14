/** Reader lifecycle orchestration over one captured Source and visible Native
 * surface. The ordinary display pipeline stays between the two render phases. */
import {recordSha256} from './roleplay-data.js'
import {tavernEntryRendersInPhaseV1} from './roleplay-tavern-prompt-variables-data.js'
import {projectTavernSourceRenderLoreV1} from './tavern-source-render-catalog.mjs'
import {applyTavernPromptTransformsV1} from './tavern-prompt-transform.mjs'
import {createReaderWorldbookTargetCaptureV1} from './roleplay-reader-worldbook-context.js'
import {selectReaderWorldbookEntriesV1} from './roleplay-reader-worldbook-entries.js'
import {renderReaderWorldbookPhaseV1} from './tavern-reader-worldbook-render.mjs'
import {createRoleplayTavernInjectionRegistryV1} from './roleplay-tavern-injections.js'
import {materializeTavernEjsJournal} from './roleplay-tavern-ejs-programs.js'
import type {TavernInjectionDefinitionV1} from './roleplay-tavern-injections.js'
import type {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import type {TavernEjsResource} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsReplayEngine,TavernEjsReplayRecord} from './tavern-template-ejs-replay.mjs'
import type {TavernSourceRenderCatalogV1} from './tavern-source-render-catalog.mjs'
import type {ReaderRegexDocumentMessageV1,ReaderRegexDocumentReadFactsV1} from './reader-regex-document-types.mjs'
import type {TavernPromptTransformInputV1} from './tavern-prompt-transform-types.mjs'
import type {TavernEjsRuntime,TavernEjsRuntimeProgram} from './tavern-template-ejs-runtime-types.mjs'
import type {AuthorNativeDiagnosticV1} from './author-native-helper-types.js'
import type {ReaderWorldbookRenderResultV1,ReaderWorldbookRenderTargetV1,ReaderWorldbookRenderEntryV1}
  from './tavern-reader-worldbook-render-types.mjs'
import {bindReaderWorldbookDocumentsV1} from './reader-source-document-data.mjs'
import type {ReaderDisplayRow,ReaderDisplayFragment} from './roleplay-reader-display.js'
import type {ReaderRegexDocumentSourceV1} from './reader-regex-document-types.mjs'

export interface ReaderWorldbookProjectionV1 {
  readonly row:number
  readonly result:Extract<ReaderWorldbookRenderResultV1,{kind:'rendered'}>
}
export interface ReaderRegexInputsV1 {
  readonly history:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>
  readonly definitions:readonly TavernInjectionDefinitionV1[]
  readonly turn:number
  readonly step:number
  readonly basisSha256:string|null
  current():boolean
  definitionFor?(input:{phase:'before'|'after';target:ReaderWorldbookRenderTargetV1;
    entries:readonly ReaderWorldbookRenderEntryV1[];program:TavernEjsResource}):TavernInjectionDefinitionV1
}
export interface ReaderNarrativeHtmlV1 {
  readonly row:number
  readonly fragmentIndex:number|null
  readonly html:string
}
interface Dependencies {
  readonly catalog:TavernSourceRenderCatalogV1
  readonly rows:readonly ReaderRegexDocumentMessageV1[]
  readonly macros:TavernPromptTransformInputV1['macros']
  readonly rules:TavernPromptTransformInputV1['rules']
  readonly scriptOrder?:TavernPromptTransformInputV1['scriptOrder']
  readonly signal:AbortSignal
  assertCurrent():void
  facts():Promise<ReaderRegexDocumentReadFactsV1|undefined>
  clockEpochMs(row:ReaderRegexDocumentMessageV1):number|undefined
  runtime(engine?:TavernEjsReplayEngine):Promise<TavernEjsRuntime>
  readonly regexInputs?:ReaderRegexInputsV1
  readonly phaseId?:string
}

export async function prepareReaderWorldbookV1(deps:Dependencies) {
  const {catalog,signal}=deps
  const hasRenderEntries=catalog.entries.some(({formal,raw})=>formal.enabled&&(['before','after'] as const).some(phase=>
    tavernEntryRendersInPhaseV1(typeof raw.comment==='string'?raw.comment:'',formal.names,phase)))
  if(!hasRenderEntries&&!deps.regexInputs?.basisSha256)return
  const diagnostics=new Map<number,AuthorNativeDiagnosticV1[]>()
  const diagnose=(row:number,code:string,pointer?:string)=>{
    let list=diagnostics.get(row)
    if(!list){list=[];diagnostics.set(row,list)}
    list.push({code,...pointer?{pointer}:{}})
  }
  const facts=await deps.facts()
  deps.assertCurrent()
  if(!facts) {
    for(const [index] of deps.rows.entries())diagnose(index,'READER_WORLDBOOK_SCOPE_UNAVAILABLE')
    return {before:[],diagnostics,after:async(_rows:readonly {displayText:string}[])=>[],dynamic:undefined,
      dispose:async()=>{}}
  }
  // Reader's captured surface contains visible canonical messages. It has no
  // injected director-note message, so note-relative ordering uses that actual
  // no-note surface instead of borrowing a Main preparation's note position.
  const authorsNoteDepth=0
  const {lore}=await projectTavernSourceRenderLoreV1({catalog,authorsNoteDepth,macros:deps.macros,
    async transform(entries,macros) {
      const result=await applyTavernPromptTransformsV1({schemaVersion:1,encoding:'owned-tavern-prompt-transform-v1',
        authority:'consumer-data-only',sourceSnapshotSha256:catalog.source.sourceSha256,regexDisabled:false,
        entries,macros,rules:deps.rules,...deps.scriptOrder?{scriptOrder:deps.scriptOrder}:{}},
        {assertCurrent:deps.assertCurrent,signal})
      deps.assertCurrent()
      if(result.kind!=='transformed')throw Error(result.diagnostics[0]?.code??'READER_WORLDBOOK_CATALOG_UNAVAILABLE')
      return result.output
    }})
  const loreSha256=recordSha256(lore),targets=deps.rows.map((row,index)=>{
    const target=createReaderWorldbookTargetCaptureV1({source:catalog.source,snapshot:facts.data,row,
      clockEpochMs:deps.clockEpochMs(row)!,lore,loreSha256,macros:deps.macros,presetCatalog:facts.presetCatalog})
    if(target.kind==='unsupported')diagnose(index,target.code)
    return target
  })
  const dynamic=deps.regexInputs&&(deps.regexInputs.basisSha256!==null||catalog.entries.some(({formal,raw})=>
    formal.enabled&&/<%/.test(typeof raw.content==='string'?raw.content:'')
      &&(['before','after'] as const).some(phase=>tavernEntryRendersInPhaseV1(
        typeof raw.comment==='string'?raw.comment:'',formal.names,phase))))?deps.regexInputs:undefined
  const programs=new Map<string,TavernEjsRuntimeProgram>()
  let closed=false,readerProgramOrdinal=0
  const assertCurrent=()=>{
    signal.throwIfAborted();deps.assertCurrent()
    if(closed||!facts!.current()||dynamic&&!dynamic.current())throw Error('READER_REGEX_PHASE_CHANGED')
  }
  const dispose=async()=>{
    if(closed)return
    closed=true
    const owned=[...programs.values()];programs.clear()
    await Promise.allSettled(owned.map(program=>program.dispose()))
  }
  // This is the same registry's provisional copy. Its journals and runtime
  // handles belong only to this Reader owner; no transaction is published.
  const registry=dynamic?createRoleplayTavernInjectionRegistryV1({sessionId:catalog.source.sessionId,
    turn:dynamic.turn,step:dynamic.step,attemptId:deps.phaseId!,history:dynamic.history,
    definitions:dynamic.definitions,ejs:true,assertCurrent,signal,
    retireEjs(id){const program=programs.get(id);programs.delete(id);void program?.dispose().catch(()=>{})},
    async invokeEjs(input){
      assertCurrent()
      let program=programs.get(input.programInstanceId)
      if(!program) {
        const runtime=await deps.runtime(input.creation.engine)
        assertCurrent()
        program=await runtime.restore(materializeTavernEjsJournal(input.creation,input.journalCut),signal)
        programs.set(input.programInstanceId,program)
      }
      const invocations=[]
      // Historical accepted retirement is replayed under the original policy.
      // Its DATA stays local; it never calls a live Native/Main disposer.
      for(const disposal of input.nativeDisposals)invocations.push(await program.invoke(disposal.operationId,
        {kind:'dispose',batchOrdinal:disposal.batchOrdinal},undefined,signal))
      const target=targets.find(row=>row.kind==='captured'&&row.capture.snapshot===input.snapshot)
      if(!target||target.kind!=='captured')throw Error('READER_REGEX_TARGET_CHANGED')
      invocations.push(await program.invoke(input.operationId,{...input.action,
        ...input.action.kind==='regex'?{consumer:'reader-regex-phase-v1' as const}:{}},target.capture,signal))
      assertCurrent()
      return {invocations}
    }}):undefined
  let runtime:Promise<TavernEjsRuntime>|undefined
  async function render(phase:'before'|'after',rows?:readonly {displayText:string}[]):Promise<ReaderWorldbookProjectionV1[]> {
    const projections:ReaderWorldbookProjectionV1[]=[]
    for(const [index,target] of targets.entries()) {
      if(target.kind!=='captured')continue
      deps.assertCurrent()
      if(!facts!.current())throw Error('READER_WORLDBOOK_SCOPE_CHANGED')
      const displayText=phase==='after'?rows![index]!.displayText:undefined,
        selected=await selectReaderWorldbookEntriesV1({catalog,target:target.target,capture:target.capture,
          phase,displayText,authorsNoteDepth})
      for(const unsupported of selected.unsupported)diagnose(index,unsupported.code,unsupported.sourcePointer)
      if(!selected.entries.length)continue
      const result=await renderReaderWorldbookPhaseV1(await (runtime??=deps.runtime()),{
        capture:target.capture,target:target.target,entries:selected.entries,phase,displayText},signal,registry?{
          consumer:'reader-regex-phase-v1',async retain(program,input){
            if(!dynamic?.definitionFor)throw Error('READER_REGEX_DEFINITION_UNAVAILABLE')
            const definition=dynamic.definitionFor({phase,target:target.target,entries:selected.entries,program:input.resource}),
              id=deps.phaseId+':wi:'+readerProgramOrdinal++,record:TavernEjsReplayRecord={schemaVersion:1,
                encoding:'ejs-host-full-replay-v1',consumer:input.consumer,engine:(await runtime!).identity,
                capture:input.capture,resource:input.resource,creation:program.creation,phases:[]}
            programs.set(id,program)
            try{registry.acceptEjsCreation(id,record,definition,phase==='before'?'initial':'late-author')}
            catch(error){programs.delete(id);throw error}
          }}:undefined)
      deps.assertCurrent()
      if(!facts!.current())throw Error('READER_WORLDBOOK_SCOPE_CHANGED')
      if(result.kind==='refused'){
        if(registry){await dispose();throw Error(result.diagnostic.code)}
        diagnose(index,result.diagnostic.code,result.diagnostic.sourcePointer)
      }
      else if(result.kind==='rendered')projections.push({row:index,result:{...result,
        output:{...result.output,reads:[...selected.reads,...result.output.reads]}}})
    }
    return projections
  }
  async function apply(phase:'message-before'|'message-html',row:number,text:string,fragmentIndex:number|null) {
    if(!registry)return text
    const target=targets[row]
    if(!target||target.kind!=='captured')throw Error('READER_REGEX_TARGET_UNAVAILABLE')
    assertCurrent()
    const {role,depth,index,swipeId,isLast}=target.target,
      result=await registry.applyRegexBatch({phase,phaseId:deps.phaseId+':'+phase+':'+row+':'+fragmentIndex,
        snapshot:target.capture.snapshot,pieces:[{id:'narrative',text,role,depth,env:{
          message_id:index,swipe_id:swipeId,is_user:role==='user',is_system:role==='system',is_last:isLast}}]})
    assertCurrent()
    return result.pieces[0]!.text
  }
  try {
    return {before:await render('before'),diagnostics,dispose,
      after:(rows:readonly {displayText:string}[])=>render('after',rows),
      dynamic:registry?{
        basisSha256:dynamic!.basisSha256,
        before:async(rows:readonly string[])=>{
          const output:string[]=[]
          for(const [index,text] of rows.entries())output.push(await apply('message-before',index,text,null))
          return output
        },
        html:async(slots:readonly ReaderNarrativeHtmlV1[])=>{
          const output:ReaderNarrativeHtmlV1[]=[]
          for(const slot of slots)output.push({...slot,html:await apply('message-html',slot.row,slot.html,slot.fragmentIndex)})
          return output
        },
      }:undefined}
  }catch(error){await dispose();throw error}
}

/** Derived EJS HTML keeps its producer origin. Its pages join the same Reader
 * program as regex documents, without acquiring a regex mutation grant. */
export function projectReaderWorldbookDocumentsV1(input:{
  readonly source:ReaderRegexDocumentSourceV1
  readonly rows:readonly ReaderDisplayRow[]
  readonly projections:readonly ReaderWorldbookProjectionV1[]
}) {
  const bound=bindReaderWorldbookDocumentsV1(input.source,input.projections.map(projection=>({
    result:projection.result,isEdit:input.rows[projection.row]!.isEdit})))
  const locations=input.projections.flatMap(projection=>projection.result.fragments.map(()=>({
    row:projection.row,phase:projection.result.phase}))),
    fragments=bound.documents.map(document=>({kind:'author-document' as const,origin:document.origin,
      parts:[{kind:'literal' as const,text:document.html}]} as Extract<ReaderDisplayFragment,{kind:'author-document'}>))
  return {bound,fragments,append(rows:readonly ReaderDisplayRow[]) {
    const before=new Map<number,ReaderDisplayFragment[]>(),after=new Map<number,ReaderDisplayFragment[]>()
    for(const [index,fragment] of fragments.entries()) {
      const location=locations[index]!,side=location.phase==='before'?before:after,list=side.get(location.row)
      if(list)list.push(fragment)
      else side.set(location.row,[fragment])
    }
    return rows.map((row,index)=>{
      if(!before.has(index)&&!after.has(index))return row
      return {...row,fragments:[...before.get(index)??[],...row.fragments??[{kind:'text' as const,text:row.displayText}],
        ...after.get(index)??[]]}
    })
  }}
}
