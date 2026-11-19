/** Joins an opening's semantic execution to the journal owner's actual prefix.
 * Records, Native markers and Source frames have already been parsed there. */
import {recordSha256} from './roleplay-data.js'
import {createAuthorNativeMvuHookGraph} from './author-native-mvu-hook-graph.js'
import {isSchemaBrowserFacts} from './roleplay-mvu-schema-journal.js'
import {openingInitializationCut} from './roleplay-mvu-schema-opening-types.js'
import {mvuSchemaStoryVariables,mvuSchemaStoryVariableParts} from './roleplay-mvu-schema-story-types.js'
import type {SchemaJournalReady,SchemaJournalEntryFacts}
  from './roleplay-mvu-schema-journal.js'
import type {MvuSchemaOpeningPreparation,FrozenMvuOpeningInitializationV3}
  from './roleplay-mvu-schema-opening-types.js'
import type {GeneratedOpeningInitialization} from './roleplay-mvu-schema-core.js'
import type {MvuBrowserHookFact} from './roleplay-mvu-browser-hook.js'
import type {MvuSchemaEvaluationInputV4,MvuSchemaGuestOutputV4} from './tavern-mvu-schema-types-v4.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {Mvu196UpdateProgressV1} from './tavern-mvu-update-protocol-v1.js'

type OpeningExecutionSource=Pick<MvuSchemaOpeningPreparation,
  'identity'|'sourceSnapshot'|'initSource'|'birth'|'preparationSha256'|'host'>
type OpeningExecutionResult=Pick<GeneratedOpeningInitialization,'values'|'context'|'frontier'|'browser'>
type AcceptedOutput=Extract<MvuSchemaGuestOutputV4,{kind:'accepted'}>
interface ServerPhase {input:MvuSchemaEvaluationInputV4;output:AcceptedOutput}
const same=(left:unknown,right:unknown)=>left===right||recordSha256(left)===recordSha256(right)
function fail():never {throw Error('SCHEMA_JOURNAL_UNPROVEN')}

function verifyOpeningEntries(ready:SchemaJournalReady,source:OpeningExecutionSource,result:OpeningExecutionResult,
  phases:FrozenMvuOpeningInitializationV3['phases'],message?:string,initialValuesSha256?:string):boolean {
  if(ready.epoch.schemaVersion!==5||!phases.length||!same(ready.epoch.host,source.host))fail()
  const {identity}=source,epoch=ready.epoch,server=epoch.program.serverProgram!,entries=ready.entries??ready.steps,
    initialCut=openingInitializationCut(source),target={kind:'opening',ownerSessionId:identity.sessionId,
      operationId:identity.operationId,messageId:identity.messageId,
      selectedSwipeIdentity:source.initSource.selectedSwipeIdentity,swipeIndex:identity.index},
    anchor={kind:'opening',operationId:identity.operationId,messageId:identity.messageId,
      importId:identity.source.importId,selectedIndex:identity.index}
  let entryIndex=0,phaseIndex=0,hookIndex=0,tailSha256=''
  let lastEntry:SchemaJournalEntryFacts|undefined
  if(server.source.sourceSnapshotSha256!==source.sourceSnapshot.snapshotSha256)fail()

  function nextEntry():SchemaJournalEntryFacts|undefined {
    const entry=entries.at(entryIndex)
    return entry&&entry.dispatchMarker.seq<result.frontier.nativeCut?entry:undefined
  }
  function consumeServer():ServerPhase {
    const entry=nextEntry(),phase=phases[phaseIndex]
    if(!entry||isSchemaBrowserFacts(entry)||!phase)fail()
    const input=entry.step.frame.input,output=entry.step.output,actual=phase.execution,cut=entry.dispatch.sourceNativeCut
    if(input.schemaVersion!==4||output.kind!=='accepted'||phase.phase!==(phaseIndex===0?'initialization':'update-core')
      ||input.phase!==phase.phase||actual.schemaVersion!==5||actual.sessionId!==identity.sessionId
      ||actual.realmEpoch!==epoch.realmEpoch||actual.batchId!==entry.dispatch.batchId||entry.step.eventId!==actual.batchId
      ||actual.combinedProgramSha256!==epoch.program.combinedProgramSha256
      ||actual.serverProgramSha256!==server.programSha256||!same(actual.epoch,ready.epochRef)
      ||!same(actual.dispatch,entry.dispatchRef)||!same(actual.completion,entry.completionRef)
      ||!same(actual.dispatchMarker,entry.dispatchMarker)||!same(actual.completionMarker,entry.completionMarker)
      ||actual.sourceNativeCutSha256!==recordSha256(cut)||!same(actual.anchor,cut.anchor)||!same(cut.anchor,anchor)
      ||cut.sourceSnapshotSha256!==source.sourceSnapshot.snapshotSha256||cut.materialSha256!==server.source.materialSha256
      ||actual.outputSha256!==recordSha256(output)||actual.serverTailSha256!==entry.step.stepSha256
      ||actual.hostFrontierSha256!==ready.entryFrontierAt?.(entryIndex+1))fail()
    const firstInput=ready.steps[0]!.step.frame.input
    if(input.clockEpochMs!==firstInput.clockEpochMs||input.randomSeed!==firstInput.randomSeed)fail()
    if(phaseIndex===0&&(input.base!==null||cut.nativeCut!==initialCut.nativeCut
      ||cut.nativePrefixSha256!==initialCut.nativePrefixSha256
      ||initialValuesSha256!==undefined&&recordSha256(input.values)!==initialValuesSha256))fail()
    tailSha256=entry.step.stepSha256;lastEntry=entry;entryIndex++;phaseIndex++
    return {input,output}
  }
  function consumeBrowser():MvuBrowserHookFact {
    const actual=nextEntry(),hook=result.browser?.hooks[hookIndex]
    if(!actual||!isSchemaBrowserFacts(actual)||!hook)fail()
    const {completion,dispatch}=actual,journal=hook.journal
    if(hook.schemaVersion!==1||!same(journal.dispatchRef,actual.dispatchRef)||!same(journal.completionRef,actual.completionRef)
      ||!same(journal.dispatchMarker,actual.dispatchMarker)||!same(journal.completionMarker,actual.completionMarker)
      ||journal.dispatch.recordSha256!==dispatch.recordSha256||journal.completion.recordSha256!==completion.recordSha256
      ||!same(hook.request,dispatch.request)||!same(hook.result,completion.result)
      ||hook.request.sessionId!==identity.sessionId||hook.request.planSha256!==source.preparationSha256
      ||!same(hook.request.target,target)||hook.request.stage!==hook.result.stage
      ||dispatch.sourceNativeCut.sourceSnapshotSha256!==source.sourceSnapshot.snapshotSha256
      ||dispatch.sourceNativeCut.materialSha256!==server.source.materialSha256||!same(dispatch.sourceNativeCut.anchor,anchor)
      ||hook.frontier.nativeCut!==actual.completionMarker.seq+1||hook.frontier.tailSha256!==tailSha256
      ||hook.frontier.frontierSha256!==ready.entryFrontierAt?.(entryIndex+1))fail()
    lastEntry=actual;entryIndex++;hookIndex++
    return hook
  }

  const first=consumeServer()
  let values=first.output.values,context=first.output.context
  const initializedEntry=nextEntry()
  if(initializedEntry&&isSchemaBrowserFacts(initializedEntry)&&initializedEntry.dispatch.request.stage==='initialized') {
    const hook=consumeBrowser()
    if(hook.request.stage!=='initialized'||hook.result.stage!=='initialized'||hook.request.yieldOrdinal!==undefined)fail()
    const graph=createAuthorNativeMvuHookGraph(),input=graph.materialize(hook.request.payload.graph)
    if(input.length!==2||input[1]!==identity.index||!same(input[0],mvuSchemaStoryVariables(values,context)))fail()
    const output=graph.materialize(hook.result.output.graph)
    if(output.length!==2||output[1]!==identity.index)fail()
    const accepted=mvuSchemaStoryVariableParts(output[0] as MvuJsonObject)
    values=accepted.values;context=accepted.context
  }
  if(message!==undefined) {
    if(phases.length<2)fail()
    const base=values,updateId=phases[1]!.execution.batchId
    let progress:Mvu196UpdateProgressV1|undefined,resumeHook:MvuBrowserHookFact|undefined,yieldOrdinal=0
    while(phaseIndex<phases.length) {
      const isFirstUpdate=phaseIndex===1,current=consumeServer(),update=current.input.update
      if(!update||update.updateId!==updateId||!same(current.input.base,base)
        ||!same(current.input.values,values)||!same(current.input.context,context))fail()
      if(isFirstUpdate) {
        if(update.encoding!=='native-mvu-196-update-start-v1'||update.message!==message||update.maintenance)fail()
      }else {
        if(progress?.kind!=='yield'||update.encoding!=='native-mvu-196-update-resume-v1'
          ||update.yieldOrdinal!==progress.yieldOrdinal
          ||!same(update.graph,resumeHook&&'graph' in resumeHook.result.output?resumeHook.result.output.graph:progress.graph)
          ||!same(update.contextWrites,resumeHook?.result.contextWrites))fail()
      }
      values=current.output.values;context=current.output.context;progress=current.output.update;resumeHook=undefined
      if(!progress||progress.updateId!==updateId||progress.kind==='native-commands-ready')fail()
      if(progress.kind==='complete') {
        if(phaseIndex!==phases.length)fail()
        break
      }
      if(phaseIndex===phases.length||progress.yieldOrdinal!==yieldOrdinal++)fail()
      const entry=nextEntry()
      if(entry&&isSchemaBrowserFacts(entry)) {
        const hook=consumeBrowser()
        if(hook.request.stage!==progress.stage||hook.request.yieldOrdinal!==progress.yieldOrdinal
          ||!('graph' in hook.request.payload)||!same(hook.request.payload.graph,progress.graph)
          ||!('graph' in hook.result.output))fail()
        resumeHook=hook
      }
    }
    const beforeEntry=nextEntry()
    if(beforeEntry&&isSchemaBrowserFacts(beforeEntry)) {
      const before=consumeBrowser()
      if(before.request.stage!=='before-message-update'||before.result.stage!=='before-message-update'
        ||before.request.yieldOrdinal!==undefined||!same(before.request.payload.context,
          {variables:mvuSchemaStoryVariables(values,context),message_content:message}))fail()
      const accepted=mvuSchemaStoryVariableParts(before.result.output.context.variables)
      values=accepted.values;context=accepted.context
      message=before.result.output.context.message_content
    }
  }else if(phases.length!==1)fail()
  if(!lastEntry||lastEntry.completionMarker.seq+1!==result.frontier.nativeCut||nextEntry()
    ||phaseIndex!==phases.length||hookIndex!==(result.browser?.hooks.length??0)
    ||!same(values,result.values)||!same(context,result.context)||result.frontier.tailSha256!==tailSha256
    ||result.frontier.frontierSha256!==ready.entryFrontierAt?.(entryIndex)
    ||result.browser&&result.browser.finalizedMessage!==(message??''))fail()
  return true
}

export function verifyMvuSchemaOpeningExecution(ready:SchemaJournalReady,plan:FrozenMvuOpeningInitializationV3):boolean {
  try {
    if(ready.epoch.schemaVersion!==5||!same(ready.epoch.server.executor,plan.server)
      ||!same(plan.execution,plan.phases.at(-1)?.execution))fail()
    return verifyOpeningEntries(ready,plan,plan,plan.phases,plan.updateMessage,plan.initialValuesSha256)
  }catch {return false}
}

export function verifyMvuSchemaOpeningInitialization(ready:SchemaJournalReady,preparation:MvuSchemaOpeningPreparation,
  accepted:GeneratedOpeningInitialization):boolean {
  try {
    if(accepted.execution.batchId!==preparation.selector.batchId
      ||!same(accepted.execution.anchor,preparation.selector.anchor))fail()
    return verifyOpeningEntries(ready,preparation,accepted,[{phase:'initialization',execution:accepted.execution}])
  }catch {return false}
}
