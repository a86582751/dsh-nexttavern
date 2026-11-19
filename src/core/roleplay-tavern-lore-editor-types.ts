import type {ConnectionFetchRoute} from '@deepseek-ai/dsh-client-connection'
import type {createRoleplayAuthorWorldbookEditorV1} from './roleplay-author-worldbook-editor.js'
import type {TavernLoreSemanticEntryV1,TavernLoreCurrentNativeMemberReferenceV1} from './tavern-lore-plan-types.mjs'
import type {AuthorWorldbookRefV1,AuthorWorldbookReceiptV1} from './roleplay-author-worldbook-types.js'
import type {TavernLoreMemberIdentityV1} from './roleplay-tavern-lore-membership.js'
import type {TavernLoreCurrentNativeFieldsV1} from './tavern-lore-plan-types.mjs'

/** Catalog refs and member identities describe the editor's frozen read cut.
 * Introduced members retain their actual event anchor. */
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
  readonly currentNativeMember?:TavernLoreCurrentNativeMemberReferenceV1
}
export interface TavernLoreEditorRequestV1 {
  readonly schemaVersion:3
  readonly encoding:'author-worldbook-editor-request-v3'
  readonly sessionId:string
  readonly expectedSourceSha256:string
  readonly bookId:string
  readonly expectedContent:AuthorWorldbookRefV1
  readonly expectedMetadata:AuthorWorldbookRefV1
  readonly operationId:string
  readonly mutation:{readonly kind:'fields';readonly target:TavernLoreMemberIdentityV1;
    readonly fields:TavernLoreCurrentNativeFieldsV1}
}
export interface TavernLoreEditorReceiptV1 {
  readonly requestSha256:string
  readonly publication:AuthorWorldbookReceiptV1
}
export interface TavernLoreEditorDataV1 {
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly dataSha256:string
  readonly revision:number
  readonly bookId:string|null
  readonly contentRef:AuthorWorldbookRefV1|null
  readonly metadataRef:AuthorWorldbookRefV1|null
  readonly entries:readonly TavernLoreEditorEntryV1[]
}
export type TavernLoreEditorCodeV1=string
export interface TavernLoreEditorRefusalV1 {
  readonly schemaVersion:1
  readonly kind:'refused'
  readonly authority:'none'
  readonly receipt?:TavernLoreEditorReceiptV1
  readonly outcome?:'no-write'|'unknown'
  readonly diagnostics:readonly {readonly code:string;
    readonly recovery?:{operationId:string}}[]
}
export interface TavernLoreEditorFailureDetailsV1 {
  readonly phase:'before-store'|'after-store'
  /** no-write describes only this API attempt, not an earlier unknown attempt. */
  readonly outcome:'no-write'|'refused'|'unknown'|'edited-unconfirmed'
  readonly refusal?:TavernLoreEditorRefusalV1
  readonly receipt?:TavernLoreEditorReceiptV1
}
export type TavernLoreEditorReplyV1={readonly schemaVersion:1;readonly ok:true;
  readonly editor:TavernLoreEditorDataV1;readonly receipt?:TavernLoreEditorReceiptV1}
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
  readonly store:Pick<ReturnType<typeof createRoleplayAuthorWorldbookEditorV1>,'observe'|'edit'>
}
