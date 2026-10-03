import type {ConnectionFetchRoute} from '@deepseek-ai/dsh-client-connection'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {TavernLoreEditReceiptV1,TavernLoreEditRefusalV1} from './roleplay-tavern-lore-edits-types.js'
import type {TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'

/** Browser data deliberately excludes raw Source/archive, content references
 * and origin ref objects. Original identity and field provenance remain inert. */
export interface TavernLoreEditorFieldSourceV1 {
  readonly field:string
  readonly pointer:string
  readonly valueSha256:string
  readonly disposition:string
  readonly originKind?:string
  readonly originSha256?:string
}
export interface TavernLoreEditorEntryV1 {
  readonly entryId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly disposition:'eligible-semantic-data'|'disabled'|'retained-ineligible'
  readonly semantic:Omit<TavernLoreSemanticEntryV1,'content'>
  readonly contentText:string
  readonly fieldSources:readonly TavernLoreEditorFieldSourceV1[]
  readonly diagnosticCodes:readonly string[]
}
export interface TavernLoreEditorDataV1 {
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly dataSha256:string
  readonly revision:number
  readonly entries:readonly TavernLoreEditorEntryV1[]
}
export type TavernLoreEditorCodeV1=TavernLoreEditRefusalV1['diagnostics'][number]['code']
  |'LORE_EDITOR_SESSION_UNAVAILABLE'|'LORE_EDITOR_SCOPE_CHANGED'|'LORE_EDITOR_BODY_INVALID'
  |'LORE_EDITOR_BODY_LIMIT'|'LORE_EDITOR_WRITE_UNKNOWN'|'LORE_EDITOR_READ_UNAVAILABLE'
export interface TavernLoreEditorFailureDetailsV1 {
  readonly phase:'before-store'|'after-store'
  /** no-write describes only this API attempt, not an earlier unknown attempt. */
  readonly outcome:'no-write'|'refused'|'unknown'|'edited-unconfirmed'
  readonly refusal?:TavernLoreEditRefusalV1
  readonly receipt?:TavernLoreEditReceiptV1
}
export type TavernLoreEditorReplyV1={readonly schemaVersion:1;readonly ok:true;
  readonly editor:TavernLoreEditorDataV1;readonly receipt?:TavernLoreEditReceiptV1}
  |{readonly schemaVersion:1;readonly ok:false;readonly code:TavernLoreEditorCodeV1;
    readonly error:string;readonly details:TavernLoreEditorFailureDetailsV1}
/** Returned only by Root's trusted Workspace Session supplier. The original
 * closure checks the actual selected/owned Session and permission, not JSON. */
export interface TavernLoreEditorSessionScopeV1 {
  readonly sessionId:string
  readonly assertCurrent:()=>void
}
export interface TavernLoreEditorRouteDependenciesV1 {
  readonly ctx:{effect(work:()=>unknown,label:string):unknown;
    connection:{fetch:{register(route:ConnectionFetchRoute):unknown}}}
  readonly resolveSessionScope:(sessionId:string)=>TavernLoreEditorSessionScopeV1|null|undefined
    |PromiseLike<TavernLoreEditorSessionScopeV1|null|undefined>
  readonly store:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,'observe'|'edit'>
}
