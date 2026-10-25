/** Frozen program genesis is data. Actual Source, Native and intent owners
 * separately prove currency; no checksum creates a generation/publication lease. */
import type {NativeGeneratedOpeningReceiptV1} from '@deepseek-ai/dsh-agent-loop'
import type {MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {PromptOpeningSourceProofV1} from './roleplay-prompt-opening-source-types.js'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import type {MvuUpdatePreparation} from './roleplay-mvu-update.js'
import type {MvuUpdatePreparationV2} from './roleplay-mvu-update-v2.js'

export interface ProgramGenesisDataRefV1 {readonly key:string;readonly sha256:string}
export interface ProgramGenesisIdentityV1 {
  readonly sessionId:string
  readonly operationId:string
  readonly requestedMessageId:string
  readonly production:'selected-card-copy'|'generated-opening'
  readonly instructionSha256:string|null
  /** Independently frozen instruction/selection packet, never a self-reference
   * to an intent row which contains this plan. Root supplies its actual owner. */
  readonly intentRef:ProgramGenesisDataRefV1
  readonly inputRef:ProgramGenesisDataRefV1
}
export interface FrozenProgramMvuOpeningPlanV3 {
  readonly schemaVersion:3
  readonly encoding:'native-program-mvu-opening-plan-v3'
  readonly schemaExecution:'none'
  readonly identity:ProgramGenesisIdentityV1
  /** Actual numerical observation Source SHA; neither lore nor program hash. */
  readonly sourceSha256:string
  readonly source:PromptOpeningSourceProofV1
  readonly basis:ProgramOpeningBasisProofV1
  readonly selectedInput:{readonly rawSha256:string;readonly renderedSha256:string}
  readonly initialValues:MvuJsonObject
  readonly initialValuesSha256:string
  readonly planSha256:string
}
export type ProgramGenesisNativeEnvelopeV1=(
  {readonly production:'selected-card-copy';readonly receipt:MvuNativeOpeningReceipt;readonly canonical:null}
  |{readonly production:'generated-opening';readonly receipt:NativeGeneratedOpeningReceiptV1;
    readonly canonical:CompletedStoryBody})&{
  readonly schemaVersion:1
  readonly encoding:'native-program-genesis-native-envelope-v1'
  readonly planSha256:string
  readonly envelopeSha256:string
}
export type ProgramGenesisAcceptedProposalV1=Exclude<MvuUpdatePreparation|MvuUpdatePreparationV2,{kind:'rejected'}>
export type ProgramGenesisOpeningSettlementV1=(
  {readonly kind:'not-applicable';readonly production:'selected-card-copy'}
  |{readonly kind:'updated'|'no-update';readonly production:'generated-opening';readonly parserVersion:1|2;
    readonly canonical:CompletedStoryBody;readonly bodySha256:string;readonly completedReceiptSha256:string;
    readonly proposal:ProgramGenesisAcceptedProposalV1;readonly candidateSha256:string;
    readonly proposalSha256:string|null})&{
  readonly schemaVersion:1
  readonly encoding:'native-program-mvu-opening-settlement-v1'
  readonly planSha256:string
  readonly initialValuesSha256:string
  readonly finalValues:MvuJsonObject
  readonly finalValuesSha256:string
  readonly settlementSha256:string
}
export interface ProgramMvuGenesisEventV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-mvu-genesis-event-v1'
  readonly eventId:string
  readonly revision:1
  readonly plan:FrozenProgramMvuOpeningPlanV3
  readonly native:ProgramGenesisNativeEnvelopeV1
  readonly openingSettlement:ProgramGenesisOpeningSettlementV1
  readonly finalValues:MvuJsonObject
  readonly valuesSha256:string
  readonly eventSha256:string
}
export interface ProgramMvuGenesisHeadV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-mvu-genesis-head-v1'
  readonly sessionId:string
  readonly eventId:string
  readonly revision:1
  readonly eventSha256:string
  readonly planSha256:string
  readonly valuesSha256:string
}
export interface VerifiedMvuProgramGenesis {
  readonly sessionId:string
  readonly sourceSha256:string
  readonly programEvent:ProgramMvuGenesisEventV1
  readonly programHead:ProgramMvuGenesisHeadV1
}
export type ProgramGenesisPublicationV1={readonly kind:'ready';readonly genesis:VerifiedMvuProgramGenesis}
  |{readonly kind:'blocked'|'unknown';readonly code:string}
export interface ProgramGenesisPublisherDepsV1 {
  readonly table:{get(key:string):unknown;put(key:string,value:ProgramMvuGenesisEventV1|ProgramMvuGenesisHeadV1):Promise<unknown>}
  /** Existing Source FIFO. Both entry points acquire it exactly once. */
  readonly withSourceLock:<T>(sessionId:string,work:()=>Promise<T>)=>Promise<T>
  readonly isSourceCurrent:(plan:FrozenProgramMvuOpeningPlanV3)=>boolean
  readonly isOpeningCurrent:(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1)=>boolean
  /** Only exact proposed event/head may be excluded from fresh membership. */
  readonly isBasisCurrent:(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1,
    event:ProgramMvuGenesisEventV1,head:ProgramMvuGenesisHeadV1)=>boolean
  /** Read-only historical original basis/prefix plus closed opening span.
   * Later normal numerical rows do not become new fresh-basis exceptions;
   * this callback grants no publication or fresh initialization permission. */
  readonly isHistoricalBasisCurrent:(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1,
    event:ProgramMvuGenesisEventV1,head:ProgramMvuGenesisHeadV1)=>boolean
  /** Actual current immutable Native span, original version, terminal body,
   * operation and independent intent packet; a pure digest is insufficient. */
  readonly isNativeCurrent:(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1)=>boolean
  /** Cold actual lookup/flush happens OUTSIDE Source FIFO. Closing entry skips
   * this callback because its driver is running and has already flushed. */
  readonly lookupNative:(plan:FrozenProgramMvuOpeningPlanV3)=>Promise<
    {readonly status:'committed';readonly native:ProgramGenesisNativeEnvelopeV1}
    |{readonly status:'absent'|'unknown'}>
}
