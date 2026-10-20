/** Frozen Ruby input DATA and its actual Native result. These records carry
 * provenance; the live Source owner supplies current/cancellation permission. */
import type {OwnedRubyTaskMessageV1} from '@deepseek-ai/dsh-subagent'
import type {NativeRequestMaterialTransformV1} from '@deepseek-ai/dsh-agent-loop'
import type {RubyTaskNativeCompletionV1} from './tavern-task-types.js'

export interface RubyAnalysisPromptV1 {
  readonly schemaVersion:1
  readonly encoding:'roleplay-ruby-analysis-prompt-v1'
  readonly sessionId:string
  readonly sourceIdentitySha256:string
  readonly taskKey:string
  readonly sourceOrdinal:number
  readonly promptPlanSha256:string
  readonly snapshot:NativeRequestMaterialTransformV1['snapshot']
  readonly plan:NativeRequestMaterialTransformV1['plan']
  readonly orderedMessages:readonly OwnedRubyTaskMessageV1[]
  readonly mainInputMessageIndex?:number
}
export interface RubyAnalysisResultV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ruby-analysis-result-v1'
  readonly authority:'consumer-data-only'
  readonly promptPlanSha256:string
  readonly text:string
  readonly completion:RubyTaskNativeCompletionV1
}
