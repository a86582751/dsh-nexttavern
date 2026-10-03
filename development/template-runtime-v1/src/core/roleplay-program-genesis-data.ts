/** Raw InitVar calculation and one sealed model-body update. No VM, schema,
 * Source loader, Native driver, mutable parent or publication lives here. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {validatePromptOpeningSourceProofV1} from './roleplay-prompt-opening-source.js'
import {compileSchemaMvuInitData} from './tavern-mvu-initvar.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import {prepareMvuUpdate} from './roleplay-mvu-update.js'
import {prepareMvuUpdateV2} from './roleplay-mvu-update-v2.js'
import {validateNativeGeneratedOpeningReceiptV1} from '@deepseek-ai/dsh-agent-loop'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {PromptOpeningSourceProofV1} from './roleplay-prompt-opening-source-types.js'
import type {ProgramGenesisIdentityV1,FrozenProgramMvuOpeningPlanV3,ProgramGenesisNativeEnvelopeV1,
  ProgramGenesisOpeningSettlementV1,ProgramGenesisAcceptedProposalV1,ProgramMvuGenesisEventV1,
  ProgramMvuGenesisHeadV1,VerifiedMvuProgramGenesis} from './roleplay-program-genesis-types.js'

export class ProgramGenesisDataFailureV1 extends Error {
  constructor(readonly code:string){super(code);this.name='ProgramGenesisDataFailureV1'}
}
function fail(code='PROGRAM_GENESIS_RECORD_INVALID'):never {throw new ProgramGenesisDataFailureV1(code)}
export const programGenesisSameV1=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
export function cloneProgramGenesisDataV1<T>(input:T):T {
  try {
    const detached=cloneRoleplayTavernLoreDataV1(input),pending:unknown[]=[detached]
    // The bounded descriptor copier already detached aliases and refused
    // cycles/proxies/accessors. Freeze before any actual-owner callback/await.
    while(pending.length) {
      const value=pending.pop()
      if(value!==null&&typeof value==='object') {
        for(const child of Object.values(value))pending.push(child)
        Object.freeze(value)
      }
    }
    return detached
  }catch {return fail('PROGRAM_GENESIS_DATA_INVALID_OR_BUDGET')}
}
function exact(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
  if(value===null||typeof value!=='object'||Array.isArray(value)
    ||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail()
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown,max=128):value is string=>typeof value==='string'
  &&value.length>0&&value.length<=max&&/^[a-zA-Z0-9_-]+$/.test(value)
const count=(value:unknown,positive=false):value is number=>typeof value==='number'
  &&Number.isSafeInteger(value)&&value>=(positive?1:0)
function ref(value:unknown):void {
  exact(value,['key','sha256']);if(!id(value['key'],512)||!hash(value['sha256']))fail()
}
function seal<T extends object,K extends string>(body:T,key:K):T&Record<K,string> {
  return {...body,[key]:recordSha256(body)} as T&Record<K,string>
}
function hashed(value:Record<string,unknown>,field:string):void {
  const {[field]:digest,...body}=value
  if(!hash(digest)||recordSha256(body)!==digest)fail()
}
function identity(value:unknown):asserts value is ProgramGenesisIdentityV1 {
  exact(value,['sessionId','operationId','requestedMessageId','production','instructionSha256','intentRef','inputRef'])
  if(!id(value['sessionId'],64)||!id(value['operationId'])||!id(value['requestedMessageId'])
    ||!['selected-card-copy','generated-opening'].includes(String(value['production'])))fail()
  if(value['production']==='generated-opening'?!hash(value['instructionSha256']):value['instructionSha256']!==null)fail()
  ref(value['intentRef']);ref(value['inputRef'])
}
/** This is a self-consistency check, never evidence that the alleged rows
 * are the actual numerical membership or that an actual fresh owner exists. */
function basis(value:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
  owned:ProgramGenesisIdentityV1):void {
  exact(value,['schemaVersion','encoding','authority','sessionId','ownerSessionId','origin','operationId',
    'requestedMessageId','sourceBindingSha256','sourceRelation','branch','native','numerical','basisSha256'])
  hashed(value as unknown as Record<string,unknown>,'basisSha256')
  if(value.schemaVersion!==1||value.encoding!=='native-program-opening-fresh-basis-proof-v1'
    ||value.authority!=='consumer-data-only'||value.sessionId!==owned.sessionId
    ||value.ownerSessionId!==owned.sessionId||value.operationId!==owned.operationId
    ||value.requestedMessageId!==owned.requestedMessageId||value.sourceBindingSha256!==source.bindingSha256)fail()
  exact(value.branch,['metaKey','metaCurrentIdentitySha256','parentSessionId','inheritedEventCount','ready'])
  if(!id(value.branch.metaKey,512)||!hash(value.branch.metaCurrentIdentitySha256)
    ||value.branch.parentSessionId!==null||value.branch.inheritedEventCount!==0||value.branch.ready!==true)fail()
  exact(value.native,['observedThroughSeq','eventCount','historySha256'])
  if(!count(value.native.eventCount)||!Number.isSafeInteger(value.native.observedThroughSeq)
    ||value.native.observedThroughSeq!==value.native.eventCount-1||!hash(value.native.historySha256))fail()
  exact(value.numerical,['statusRows','branchRows','membershipSha256','ownedInitializationCount','opaqueStateCount'])
  if(!Array.isArray(value.numerical.statusRows)||!Array.isArray(value.numerical.branchRows)
    ||!hash(value.numerical.membershipSha256)||value.numerical.ownedInitializationCount!==0
    ||value.numerical.opaqueStateCount!==0)fail()
  const seen=new Set<string>()
  for(const [table,rows] of [['status',value.numerical.statusRows],['branch',value.numerical.branchRows]] as const) {
    for(const row of rows) {
      exact(row,['table','key','exists','sha256','value'])
      if(row.table!==table||!id(row.key,512)||!row.key.startsWith(owned.sessionId+'__')
        ||typeof row.exists!=='boolean'||seen.has(table+':'+row.key))fail()
      seen.add(table+':'+row.key)
      if(row.exists) {
        if(!row.value||typeof row.value!=='object'||Array.isArray(row.value)
          ||!hash(row.sha256)||recordSha256(row.value)!==row.sha256)fail()
      }else if(row.value!==null||row.sha256!=='missing')fail()
    }
  }
  if(value.sourceRelation.kind==='own-root') {
    exact(value.sourceRelation,['kind','inheritance'])
    if(value.origin!=='own-root'||value.sourceRelation.inheritance!==null
      ||source.sourceRelation.kind!=='own-root-source')fail()
  }else {
    exact(value.sourceRelation,['kind','inheritance','setup','setupSha256'])
    if(value.origin!=='fresh-scene'||value.sourceRelation.kind!=='reserved-fresh-child'
      ||source.sourceRelation.kind!=='committed-fresh-cut0-source'
      ||!programGenesisSameV1(value.sourceRelation.inheritance,source.sourceRelation.inheritance)
      ||!hash(value.sourceRelation.setupSha256)||recordSha256(value.sourceRelation.setup)!==value.sourceRelation.setupSha256)fail()
  }
}
export function validateFrozenProgramMvuOpeningPlanV3(input:unknown):FrozenProgramMvuOpeningPlanV3 {
  const data=cloneProgramGenesisDataV1(input)
  exact(data,['schemaVersion','encoding','schemaExecution','identity','sourceSha256','source','basis',
    'selectedInput','initialValues','initialValuesSha256','planSha256'])
  hashed(data,'planSha256');identity(data['identity'])
  if(data['schemaVersion']!==3||data['encoding']!=='native-program-mvu-opening-plan-v3'
    ||data['schemaExecution']!=='none'||!hash(data['sourceSha256']))fail()
  const source=validatePromptOpeningSourceProofV1(data['source']),owned=data['identity']
  if(source.source.sessionId!==owned.sessionId||source.initialization.kind!=='raw-init-data')fail('PROGRAM_GENESIS_INIT_DATA_REQUIRED')
  const initialized=source.initialization,calculated=compileSchemaMvuInitData(initialized.data)
  if(calculated.kind!=='parsed'||!programGenesisSameV1(calculated,initialized.calculation)
    ||!programGenesisSameV1(data['initialValues'],calculated.values)
    ||data['initialValuesSha256']!==calculated.valuesSha256)fail('PROGRAM_GENESIS_CALCULATION_CHANGED')
  exact(data['selectedInput'],['rawSha256','renderedSha256'])
  if(data['selectedInput']['rawSha256']!==source.selected.sourceSha256
    ||data['selectedInput']['renderedSha256']!==source.selected.renderedSha256)fail()
  basis(data['basis'] as unknown as ProgramOpeningBasisProofV1,source,owned)
  return data as unknown as FrozenProgramMvuOpeningPlanV3
}
export function prepareProgramMvuOpeningPlanV3(input:{identity:ProgramGenesisIdentityV1;sourceSha256:string;
  source:PromptOpeningSourceProofV1;basis:ProgramOpeningBasisProofV1}):FrozenProgramMvuOpeningPlanV3 {
  const frozen=cloneProgramGenesisDataV1(input),source=validatePromptOpeningSourceProofV1(frozen.source)
  if(source.initialization.kind!=='raw-init-data')fail('PROGRAM_GENESIS_INIT_DATA_REQUIRED')
  return validateFrozenProgramMvuOpeningPlanV3(seal({schemaVersion:3 as const,
    encoding:'native-program-mvu-opening-plan-v3' as const,schemaExecution:'none' as const,
    identity:frozen.identity,sourceSha256:frozen.sourceSha256,source,basis:frozen.basis,
    selectedInput:{rawSha256:source.selected.sourceSha256,renderedSha256:source.selected.renderedSha256},
    initialValues:source.initialization.calculation.values,
    initialValuesSha256:source.initialization.calculation.valuesSha256},'planSha256'))
}
export function validateProgramGenesisNativeEnvelopeV1(input:unknown,
  plan:FrozenProgramMvuOpeningPlanV3):ProgramGenesisNativeEnvelopeV1 {
  const data=cloneProgramGenesisDataV1(input)
  exact(data,['schemaVersion','encoding','production','receipt','canonical','planSha256','envelopeSha256'])
  hashed(data,'envelopeSha256')
  if(data['schemaVersion']!==1||data['encoding']!=='native-program-genesis-native-envelope-v1'
    ||data['planSha256']!==plan.planSha256||data['production']!==plan.identity.production)fail()
  if(data['production']==='selected-card-copy') {
    const receipt=data['receipt']
    exact(receipt,['sessionId','operationId','messageId','renderedSha256','turn','assistantSeq',
      'turnStartSeq','turnEndSeq','messageVersion','flushed'])
    exact(receipt['messageVersion'],['kind','eventSha256'])
    if(data['canonical']!==null||receipt['sessionId']!==plan.identity.sessionId
      ||receipt['operationId']!==plan.identity.operationId||receipt['messageId']!==plan.identity.requestedMessageId
      ||receipt['renderedSha256']!==plan.selectedInput.renderedSha256||receipt['flushed']!==true
      ||receipt['messageVersion']['kind']!=='original'||!hash(receipt['messageVersion']['eventSha256'])
      ||!count(receipt['turn'],true)||!count(receipt['turnStartSeq'])||!count(receipt['assistantSeq'])
      ||!count(receipt['turnEndSeq'])||receipt['turnStartSeq']>=receipt['assistantSeq']
      ||receipt['assistantSeq']>=receipt['turnEndSeq'])fail()
  }else {
    // Core's persisted JSON copier normalizes -0/undefined spelling; Native
    // has the stronger exact packet grammar. Validate the original receipt
    // after the outer copier has refused proxies/accessors, before normalization
    // can hide a Native grammar refusal. No asynchronous code runs between them.
    const original=(input as {receipt:unknown}).receipt,
      receipt=validateNativeGeneratedOpeningReceiptV1(original),canonical=data['canonical']
    exact(canonical,['seq','messageId','versionSha256','narrative'])
    if(!count(canonical['seq'])||typeof canonical['narrative']!=='string'||!hash(canonical['versionSha256'])
      ||receipt.identity.sessionId!==plan.identity.sessionId||receipt.identity.operationId!==plan.identity.operationId
      ||receipt.identity.messageId!==plan.identity.requestedMessageId
      ||receipt.identity.instructionSha256!==plan.identity.instructionSha256
      ||!programGenesisSameV1(receipt.identity.intentRef,plan.identity.intentRef)
      ||canonical['seq']!==receipt.terminalOutput.eventRef.seq
      ||canonical['messageId']!==receipt.terminalOutput.messageId
      ||canonical['versionSha256']!==receipt.terminalOutput.messageSha256
      ||sha256(canonical['narrative'])!==receipt.terminalOutput.textSha256)fail('PROGRAM_GENESIS_TERMINAL_BODY_CHANGED')
  }
  return data as unknown as ProgramGenesisNativeEnvelopeV1
}
export function sealProgramGenesisNativeEnvelopeV1(plan:FrozenProgramMvuOpeningPlanV3,
  native:Omit<Extract<ProgramGenesisNativeEnvelopeV1,{production:'selected-card-copy'}>,
    'schemaVersion'|'encoding'|'planSha256'|'envelopeSha256'>
    |Omit<Extract<ProgramGenesisNativeEnvelopeV1,{production:'generated-opening'}>,
      'schemaVersion'|'encoding'|'planSha256'|'envelopeSha256'>):ProgramGenesisNativeEnvelopeV1 {
  return validateProgramGenesisNativeEnvelopeV1(seal({schemaVersion:1 as const,
    encoding:'native-program-genesis-native-envelope-v1' as const,...native,planSha256:plan.planSha256},'envelopeSha256'),plan)
}
function selectedProposal(narrative:string,initialValues:MvuJsonObject):ProgramGenesisAcceptedProposalV1 {
  const historical=prepareMvuUpdate(narrative,initialValues)
  let proposal=historical as ReturnType<typeof prepareMvuUpdate>|ReturnType<typeof prepareMvuUpdateV2>
  if(historical.kind==='rejected') {
    const next=prepareMvuUpdateV2(narrative,initialValues)
    if(next.kind==='prepared'||['LEGACY_COMMAND_UNSUPPORTED','OPERATION_UNSUPPORTED'].includes(historical.code))proposal=next
  }
  if(proposal.kind==='rejected')fail(`MVU_UPDATE_${proposal.code}`)
  return proposal
}
/** Public pure seam for a raw-data contract fixture. This result contains no
 * Source/basis/Native proof and cannot be passed to the publisher as a receipt. */
export function prepareProgramGenesisBodyProposalV1(narrative:string,initialValues:MvuJsonObject,
  sealedParserVersion?:1|2):{parserVersion:1|2;proposal:ProgramGenesisAcceptedProposalV1;finalValues:MvuJsonObject} {
  const base=cloneProgramGenesisDataV1(initialValues),proposal=sealedParserVersion===undefined?selectedProposal(narrative,base)
    :sealedParserVersion===1?prepareMvuUpdate(narrative,base):prepareMvuUpdateV2(narrative,base)
  if(proposal.kind==='rejected')fail(`MVU_UPDATE_${proposal.code}`)
  const parserVersion='schemaVersion' in proposal&&proposal.schemaVersion===2?2 as const:1 as const
  if(sealedParserVersion!==undefined&&parserVersion!==sealedParserVersion)fail()
  return {parserVersion,proposal,finalValues:cloneProgramGenesisDataV1(proposal.kind==='prepared'?proposal.values:base)}
}
/** Historical verification uses the stored parser version directly, never
 * today's fallback selection to reinterpret an already committed body. */
export function prepareProgramGenesisOpeningSettlementV1(plan:FrozenProgramMvuOpeningPlanV3,
  native:ProgramGenesisNativeEnvelopeV1,sealedParserVersion?:1|2):ProgramGenesisOpeningSettlementV1 {
  const checked=validateProgramGenesisNativeEnvelopeV1(native,plan)
  const common={schemaVersion:1 as const,encoding:'native-program-mvu-opening-settlement-v1' as const,
    planSha256:plan.planSha256,initialValuesSha256:plan.initialValuesSha256}
  if(checked.production==='selected-card-copy') {
    if(sealedParserVersion!==undefined)fail()
    return seal({...common,kind:'not-applicable' as const,production:'selected-card-copy' as const,
      finalValues:cloneProgramGenesisDataV1(plan.initialValues),finalValuesSha256:plan.initialValuesSha256},'settlementSha256')
  }
  const body=checked.canonical,{proposal,parserVersion,finalValues}=prepareProgramGenesisBodyProposalV1(
    body.narrative,plan.initialValues,sealedParserVersion)
  return seal({...common,kind:proposal.kind==='prepared'?'updated' as const:'no-update' as const,
    production:'generated-opening' as const,parserVersion,canonical:body,bodySha256:sha256(body.narrative),
    completedReceiptSha256:checked.receipt.receiptSha256,proposal,candidateSha256:recordSha256(proposal),
    proposalSha256:proposal.kind==='prepared'?proposal.proposalSha256:null,
    finalValues:cloneProgramGenesisDataV1(finalValues),finalValuesSha256:recordSha256(finalValues)},'settlementSha256')
}
export const programGenesisEventIdV1=(plan:FrozenProgramMvuOpeningPlanV3)=>sha256(
  `native-program-mvu-genesis-event-v1\0${plan.identity.sessionId}\0${plan.identity.operationId}\0${plan.planSha256}`)
export function programGenesisHeadForV1(event:ProgramMvuGenesisEventV1):ProgramMvuGenesisHeadV1 {
  return {schemaVersion:1,encoding:'native-program-mvu-genesis-head-v1',sessionId:event.plan.identity.sessionId,
    eventId:event.eventId,revision:1,eventSha256:event.eventSha256,planSha256:event.plan.planSha256,valuesSha256:event.valuesSha256}
}
export function createProgramMvuGenesisEventV1(suppliedPlan:FrozenProgramMvuOpeningPlanV3,
  suppliedNative:ProgramGenesisNativeEnvelopeV1):ProgramMvuGenesisEventV1 {
  const plan=validateFrozenProgramMvuOpeningPlanV3(suppliedPlan),native=validateProgramGenesisNativeEnvelopeV1(suppliedNative,plan),
    openingSettlement=prepareProgramGenesisOpeningSettlementV1(plan,native)
  return cloneProgramGenesisDataV1(seal({schemaVersion:1 as const,encoding:'native-program-mvu-genesis-event-v1' as const,
    eventId:programGenesisEventIdV1(plan),revision:1 as const,plan,native,openingSettlement,
    finalValues:openingSettlement.finalValues,valuesSha256:openingSettlement.finalValuesSha256},'eventSha256'))
}
export function validateProgramMvuGenesisFactsV1(eventInput:unknown,headInput:unknown):VerifiedMvuProgramGenesis {
  const event=cloneProgramGenesisDataV1(eventInput),head=cloneProgramGenesisDataV1(headInput)
  exact(event,['schemaVersion','encoding','eventId','revision','plan','native','openingSettlement',
    'finalValues','valuesSha256','eventSha256'])
  exact(head,['schemaVersion','encoding','sessionId','eventId','revision','eventSha256','planSha256','valuesSha256'])
  hashed(event,'eventSha256')
  if(event['schemaVersion']!==1||event['encoding']!=='native-program-mvu-genesis-event-v1'||event['revision']!==1)fail()
  const plan=validateFrozenProgramMvuOpeningPlanV3(event['plan']),native=validateProgramGenesisNativeEnvelopeV1(event['native'],plan),
    settlement=event['openingSettlement']
  if(!settlement||typeof settlement!=='object'||Array.isArray(settlement))fail()
  const version=(settlement as {parserVersion?:unknown}).parserVersion
  if(native.production==='generated-opening'&&version!==1&&version!==2)fail()
  const expected=prepareProgramGenesisOpeningSettlementV1(plan,native,native.production==='generated-opening'?version as 1|2:undefined)
  if(!programGenesisSameV1(expected,settlement)||event['eventId']!==programGenesisEventIdV1(plan)
    ||!programGenesisSameV1(event['finalValues'],expected.finalValues)||event['valuesSha256']!==expected.finalValuesSha256)fail()
  const typed=event as unknown as ProgramMvuGenesisEventV1
  if(!programGenesisSameV1(head,programGenesisHeadForV1(typed)))fail()
  return {sessionId:plan.identity.sessionId,sourceSha256:plan.sourceSha256,
    programEvent:typed,programHead:head as unknown as ProgramMvuGenesisHeadV1}
}
