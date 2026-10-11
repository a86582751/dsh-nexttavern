/** Frozen original dialogue request DATA. Native transport policy remains
 * with TaskHost: this module neither creates a provider nor invents user input. */
import {recordSha256} from './roleplay-data.js'
import type {AuthorChatBindingV1,AuthorChatRevisionV1,AuthorDialogTaskRefV1}
  from './roleplay-author-chat-state-types.js'
import type {AuthorChatBindingV2} from './roleplay-author-chat-state-v2-types.js'

/** Dialog Core resolves the retained programme's static writer once. Content
 * captures its current Source and State under the existing Source FIFO. */
export interface AdmittedAuthorDialogTarget {
  readonly programSha256:string
  readonly scriptIdentity:string
  readonly binding:AuthorChatBindingV1|AuthorChatBindingV2
}

export const AUTHOR_DIALOG_HOST_SLOTS_V1=['world_info_before','char_description',
  'char_personality','scenario','world_info_after'] as const
export type AuthorDialogHostSlotV1=typeof AUTHOR_DIALOG_HOST_SLOTS_V1[number]
export interface AuthorDialogSystemSlotV1 {
  readonly role:'system'
  readonly slot:AuthorDialogHostSlotV1|'dynamic-system'
  readonly text:string
  readonly sourceSha256:string
}
export interface AuthorDialogPromptV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-frozen-prompt-v1'
  readonly authority:'consumer-data-only'
  readonly binding:AuthorChatBindingV1|AuthorChatBindingV2
  readonly revision:AuthorChatRevisionV1
  readonly operationId:string
  /** Preserve the original six ordered system slots. Dynamic system already
   * contains its form input; no additional user phase is declared here. */
  readonly orderedSystem:readonly AuthorDialogSystemSlotV1[]
  readonly shouldSilence:true
  readonly maxChatHistory:0
  readonly promptSha256:string
}
export interface AuthorDialogResultV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-result-v1'
  readonly authority:'consumer-data-only'
  readonly binding:AuthorChatBindingV1|AuthorChatBindingV2
  readonly revision:AuthorChatRevisionV1
  readonly operationId:string
  readonly promptSha256:string
  readonly task:AuthorDialogTaskRefV1
  readonly text:string
}
export interface AuthorDialogNativeCompletionV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-completion-v1'
  readonly taskId:string
  readonly generation:string
  readonly childSessionId:string
  readonly promptPlanSha256:string
  readonly resultSha256:string
}
/** Match SystemPrompt.renderPrompt: empty sections are dropped, surviving
 * text is joined with two newlines, with no further interpolation. */
export function authorDialogSystemPrefixV1(prompt:AuthorDialogPromptV1):string {
  return prompt.orderedSystem.slice(0,5).map(slot=>slot.text).filter(text=>text.length>0).join('\n\n')
}
export function freezeAuthorDialogPromptV1(input:{binding:AuthorChatBindingV1|AuthorChatBindingV2;
  revision:AuthorChatRevisionV1;operationId:string;
  hostSlots:Readonly<Record<AuthorDialogHostSlotV1,{text:string;sourceSha256:string}>>;
  dynamicSystem:{text:string;sourceSha256:string}}):AuthorDialogPromptV1 {
  const orderedSystem=Object.freeze([
    ...AUTHOR_DIALOG_HOST_SLOTS_V1.map(slot=>Object.freeze({role:'system' as const,slot,...input.hostSlots[slot]})),
    Object.freeze({role:'system' as const,slot:'dynamic-system' as const,...input.dynamicSystem}),
  ])
  const body={schemaVersion:1 as const,encoding:'native-author-dialog-frozen-prompt-v1' as const,
    authority:'consumer-data-only' as const,binding:Object.freeze({...input.binding}),
    revision:Object.freeze({revision:input.revision.revision,
      head:input.revision.head?Object.freeze({...input.revision.head}):null}),
    operationId:input.operationId,orderedSystem,shouldSilence:true as const,maxChatHistory:0 as const}
  return Object.freeze({...body,promptSha256:recordSha256(body)})
}
