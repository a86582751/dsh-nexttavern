/** Frozen original dialogue request DATA. Native transport policy remains
 * with TaskHost: this module neither creates a provider nor invents user input. */
import {recordSha256} from './roleplay-data.js'
import type {TaskSelection} from './tavern-task-types.js'
import {freezeAuthorWorldbookDataV1} from './roleplay-author-worldbook-journal.js'
import type {AuthorChatNamespaceV3,AuthorChatNamespaceRootV3}
  from './roleplay-author-chat-state-types.js'
import type {TavernLoreOrdinaryExecutionEvidenceV1} from './tavern-lore-ordinary-preparation.mjs'
import type {RequestMessage,RequestLocalSamplingV1,ToolSchema,AssistantMessage,FinishReason,AssistantResponseDetailsV1}
  from 'dsh-nexttavern-native-llm'
import type {NativeAuthorGenerationCheckpointV1,NativeAuthorGenerationCompletionV1,NativeAuthorGenerationStreamV1}
  from 'dsh-nexttavern-native-agent-loop'
export interface AuthorDialogMaterialV1 {
  readonly snapshot:{readonly key:string;readonly sha256:string}
  readonly plan:{readonly key:string;readonly sha256:string}
  readonly captureSha256:string
}
export interface AuthorDialogCallV1 extends RequestLocalSamplingV1 {readonly tools?:readonly ToolSchema[]}
export interface AuthorDialogPresentationV1 {readonly stream:boolean;readonly silence:boolean;readonly returnReasoning:boolean}
export interface AuthorDialogTaskRefV1 {
  readonly taskId:string
  readonly generation:string
  readonly resultSha256:string
}
export interface AuthorDialogChatAddress {
  readonly namespace:AuthorChatNamespaceV3
  readonly programSha256:string
  readonly realmId:string
  readonly groupId:string
}

/** Dialog Core supplies an actual live realm and Source namespace. No static
 * variable declaration or synthetic target key grants a model request. */
export interface AdmittedAuthorDialogTarget {
  readonly binding:AuthorDialogChatAddress
  readonly effects:'source'|'readonly'
  readonly libraryReads:readonly import('./author-native-helper-types.js').AuthorNativeResolvedLibraryReadV1[]
  invokeFilter?(descriptor:import('./author-native-helper-types.js').AuthorNativeGenerationFilterV1,
    consumer:'scan'|'chat'):Promise<{readonly accepted:boolean;
      readonly libraryReads:readonly import('./author-native-helper-types.js').AuthorNativeResolvedLibraryReadV1[]}>
}

export interface AuthorDialogPromptV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-frozen-prompt-v1'
  readonly authority:'consumer-data-only'
  readonly binding:AuthorDialogChatAddress
  readonly root:AuthorChatNamespaceRootV3
  readonly operationId:string
  readonly generationId:string
  readonly mode:'preset'|'raw'
  readonly orderedMessages:readonly RequestMessage[]
  readonly call:AuthorDialogCallV1
  readonly presentation:AuthorDialogPresentationV1
  readonly material:AuthorDialogMaterialV1
  readonly selection?:TaskSelection
  readonly ordinaryPreparationEvidence?:TavernLoreOrdinaryExecutionEvidenceV1
  readonly promptSha256:string
}
export interface AuthorDialogResultV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-result-v1'
  readonly authority:'consumer-data-only'
  readonly binding:AuthorDialogChatAddress
  readonly root:AuthorChatNamespaceRootV3
  readonly operationId:string
  readonly promptSha256:string
  readonly task:AuthorDialogTaskRefV1
  readonly text:string
  readonly message?:AssistantMessage
  readonly finishReason?:FinishReason
  readonly details?:AssistantResponseDetailsV1
  readonly native?:NativeAuthorGenerationCompletionV1
}
export interface AuthorDialogNativeCompletionV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-dialog-completion-v1'
  readonly taskId:string
  readonly generation:string
  readonly childSessionId:string
  readonly promptPlanSha256:string
  readonly resultSha256:string
  readonly native:NativeAuthorGenerationCompletionV1
}
export function freezeAuthorDialogPromptV1(input:{binding:AuthorDialogChatAddress;
  root:AuthorChatNamespaceRootV3;operationId:string;
  generationId?:string;mode?:'preset'|'raw';orderedMessages:readonly RequestMessage[];
  call?:AuthorDialogCallV1;presentation?:AuthorDialogPresentationV1;material:AuthorDialogMaterialV1;
  selection?:TaskSelection;
  ordinaryPreparationEvidence?:TavernLoreOrdinaryExecutionEvidenceV1}):AuthorDialogPromptV1 {
  const body={schemaVersion:1 as const,encoding:'native-author-dialog-frozen-prompt-v1' as const,
    authority:'consumer-data-only' as const,binding:Object.freeze({...input.binding}),
    root:input.root,
    operationId:input.operationId,generationId:input.generationId??input.operationId,mode:input.mode??'raw',
    orderedMessages:Object.freeze(structuredClone(input.orderedMessages)),call:Object.freeze(structuredClone(input.call??{})),
    presentation:Object.freeze({...input.presentation??{stream:false,silence:true,returnReasoning:false}}),
    material:input.material,
    ...input.selection?{selection:structuredClone(input.selection)}:{},
    ...input.ordinaryPreparationEvidence?{ordinaryPreparationEvidence:input.ordinaryPreparationEvidence}:{},
    }
  return freezeAuthorWorldbookDataV1({...body,promptSha256:recordSha256(body)})
}
