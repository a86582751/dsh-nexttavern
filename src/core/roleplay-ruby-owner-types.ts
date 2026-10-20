/** Versioned scheduling/publication DATA. Native completion remains in the
 * existing TavernTasks job; these references never restore a live task lease. */
import type {RubyCursorV1,RubyPreparedOutputV1,RubySelectedMessageV1,RubyConfigurationV1,
  RubyTaskV1,RubyTriggerV1,RubyPreparedInputV1} from './roleplay-ruby-types.js'
import type {TavernLoreDerivedCompletionRefV1} from './tavern-lore-derived.mjs'

export interface RubyTaskInputCaptureV1 extends Omit<RubyPreparedInputV1,'encoding'|'window'|'normalRequests'> {
  readonly encoding:'native-ruby-task-input-capture-v1'
  readonly window:Pick<RubyPreparedInputV1['window'],'startOrdinal'|'endOrdinal'|'count'> & {
    readonly messages:readonly Pick<RubySelectedMessageV1,'messageId'|'messageVersion'|'role'>[]
    readonly scanTextSha256:string
  }
}
export interface RubyOrderedMessagePlanV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ruby-ordered-message-plan-v1'
  readonly sourceIdentitySha256:string
  readonly input:{readonly key:string;readonly sha256:string}
  readonly messages:RubyPreparedInputV1['messages']
  readonly mainInputMessageIndex?:number
}

export interface RubyPublishedOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ruby-published-output-v1'
  readonly sessionId:string
  readonly sourceIdentitySha256:string
  readonly inputRef:{readonly key:string;readonly sha256:string}
  readonly inputBasis:readonly Pick<RubySelectedMessageV1,'messageId'|'messageVersion'|'role'>[]
  readonly output:RubyPreparedOutputV1
  readonly completionRef:TavernLoreDerivedCompletionRefV1
}
export interface RubyOutputHeadV1 {
  readonly ref:{readonly ownerId:string;readonly key:string;readonly sha256:string}
}
export interface RubyRunV1 {
  readonly trigger:RubyTriggerV1
  readonly task:RubyTaskV1
  readonly status:'queued'|'skipped'|'failed'|'published'|'unsupported'
  readonly reason?:string
  readonly promptRef?:{readonly key:string;readonly sha256:string}
  readonly promptPlanSha256?:string
  readonly taskId?:string
}
export interface RubyOwnerStateV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ruby-owner-state-v1'
  readonly sessionId:string
  readonly sourceIdentitySha256:string
  readonly revision:number
  readonly configuration:Pick<RubyConfigurationV1,'status'|'issues'|'cycleLength'>
  readonly cursor:RubyCursorV1
  readonly messages:readonly Pick<RubySelectedMessageV1,'messageId'|'messageVersion'|'role'>[]
  readonly outputs:Readonly<Record<string,RubyOutputHeadV1>>
  readonly runs:Readonly<Record<string,RubyRunV1>>
  readonly inheritedFrom?:{readonly sessionId:string;readonly stateSha256:string;readonly nativeCut:number}
}
export interface RubyEnablementV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ruby-enablement-v1'
  readonly enabled:boolean
  readonly revision:number
}
