/** Stable profile book addresses and immutable published DATA. Captures carry
 * no authority. Core supplies the current writer for each actual operation. */
import type {AuthorProfileIdentityV1} from './roleplay-author-profile.js'
import type {AuthorChatNamespaceV3} from './roleplay-author-chat-state-types.js'
import type {AuthorWorldbookMutationV1} from './roleplay-author-worldbook-data.js'
import type {TavernLoreMembershipDataV1} from './roleplay-tavern-lore-membership.js'
import type {WorldbookEntryInputV1,WorldbookEntryWireV1} from './tavern-named-worldbook-data.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export interface AuthorWorldbookImportLocatorV1 {
  readonly ownerSessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly transactionId:string
  readonly bookPointer:string
}
export type AuthorWorldbookImportSeedV1=
  |{readonly kind:'membership';readonly membership:TavernLoreMembershipDataV1;readonly bookData:Readonly<MvuJsonObject>}
  |{readonly kind:'fork';readonly parent:AuthorWorldbookDescriptorV1;readonly content:AuthorWorldbookRefV1}
export interface AuthorWorldbookAdoptionInputV1 {
  readonly name:string
  readonly locator:AuthorWorldbookImportLocatorV1
  readonly effectiveCutRef?:AuthorWorldbookRefV1
  readonly seed:AuthorWorldbookImportSeedV1
}

export interface AuthorWorldbookRefV1 {readonly key:string;readonly sha256:string}
export interface AuthorWorldbookTableV1 {
  get(key:string):unknown
  put(key:string,value:object):unknown|PromiseLike<unknown>
}
export interface AuthorWorldbookAddressV1 {readonly profileId:string;readonly bookId:string}
export type AuthorWorldbookOriginV1=
  |{readonly kind:'library'}
  |{readonly kind:'uploaded-library';readonly fileName:string;readonly rawSha256:string}
  |{readonly kind:'adopted-import';readonly locator:AuthorWorldbookImportLocatorV1;readonly originalName:string;
    readonly effectiveCutRef?:AuthorWorldbookRefV1;readonly originBookId?:string;readonly parentContentRef?:AuthorWorldbookRefV1}
  |{readonly kind:'imported-library';readonly sourceRecordSessionId:string;readonly importId:string;
    readonly transactionId:string;readonly pointer:string}
  |{readonly kind:'fork-copy';readonly originBookId:string;readonly parentContentRef:AuthorWorldbookRefV1;
    readonly sourceRecordSessionId:string;readonly importId:string;readonly transactionId:string;readonly pointer:string}
export interface AuthorWorldbookDescriptorV1 {
  readonly address:AuthorWorldbookAddressV1
  readonly name:string
  readonly origin:AuthorWorldbookOriginV1
  readonly initialContent:AuthorWorldbookRefV1
  readonly metadata:AuthorWorldbookRefV1
}
export interface AuthorWorldbookCatalogCaptureV1 {
  readonly schemaVersion:1
  readonly authority:'consumer-data-only'
  readonly profileId:string
  readonly head:AuthorWorldbookRefV1|null
  readonly revision:number
  readonly books:readonly AuthorWorldbookDescriptorV1[]
}
export interface AuthorWorldbookCaptureV1 {
  readonly schemaVersion:1
  readonly authority:'consumer-data-only'
  readonly address:AuthorWorldbookAddressV1
  readonly name:string
  readonly origin:AuthorWorldbookOriginV1
  readonly content:AuthorWorldbookRefV1
  readonly metadata:AuthorWorldbookRefV1
  readonly revision:number
  readonly membership:TavernLoreMembershipDataV1
  /** Original book-level fields outside entries. Public rename has its own metadata ref. */
  readonly bookData:Readonly<MvuJsonObject>
}
/** Full Helper entry DTOs belong to explicit SDK reads and CRUD replies. */
export interface AuthorWorldbookHelperCaptureV1 extends AuthorWorldbookCaptureV1 {
  readonly entries:readonly WorldbookEntryWireV1[]
}
export type AuthorWorldbookBindingOwnerV1=
  |{readonly kind:'profile';readonly profileId:string}
  |{readonly kind:'character';readonly characterId:string;readonly sourceBranchId?:string}
  |{readonly kind:'chat';readonly namespace:AuthorChatNamespaceV3}
export type AuthorWorldbookBindingSelectionV1=
  |{readonly kind:'profile';readonly enabled:readonly string[]}
  |{readonly kind:'character';readonly primary:string|null;readonly additional:readonly string[]}
  |{readonly kind:'chat';readonly bookId:string|null}
export interface AuthorWorldbookBindingCaptureV1 {
  readonly schemaVersion:1
  readonly authority:'consumer-data-only'
  readonly profileId:string
  readonly owner:AuthorWorldbookBindingOwnerV1
  readonly head:AuthorWorldbookRefV1|null
  readonly revision:number
  readonly selection:AuthorWorldbookBindingSelectionV1
}
export type AuthorWorldbookWriteAddressV1=
  |{readonly kind:'catalog';readonly profileId:string}
  |{readonly kind:'book';readonly address:AuthorWorldbookAddressV1}
  |{readonly kind:'bindings';readonly profileId:string;readonly owner:AuthorWorldbookBindingOwnerV1}
export interface AuthorWorldbookWriterV1 {
  owns(address:AuthorWorldbookWriteAddressV1):boolean
  isCurrent():boolean|PromiseLike<boolean>
  beforeWrite?(row:{readonly key:string;readonly value:object}):()=>void
}
export interface AuthorWorldbookDependenciesV1 {
  readonly table:AuthorWorldbookTableV1
  readonly profile:AuthorProfileIdentityV1
  /** Invalidates only rebuildable process projections before a possible write. */
  beforePersistentWrite?(owner:AuthorWorldbookWriteAddressV1):void
}
export interface AuthorWorldbookCatalogDependenciesV1 extends AuthorWorldbookDependenciesV1 {
  /** Private current Domain/profile lifecycle, independent of Source admission. */
  readonly completionWriter:AuthorWorldbookWriterV1
  /** Tracks the selected immutable descriptor through shared catalog changes. */
  readSelectedData?<T>(reader:()=>T):T
}
export interface AuthorWorldbookReceiptV1 {
  readonly schemaVersion:1
  readonly kind:'committed'|'replayed'
  readonly owner:AuthorWorldbookWriteAddressV1
  readonly operationId:string
  readonly event:AuthorWorldbookRefV1
  readonly revision:number
}
export interface AuthorWorldbookCreateInputV1 {
  readonly name:string
  readonly entries:readonly WorldbookEntryInputV1[]
  readonly origin?:AuthorWorldbookOriginV1
  readonly expectedHead:AuthorWorldbookRefV1|null
}
export interface AuthorWorldbookImportFileInputV1 {
  readonly name?:string
  readonly fileName:string
  readonly json:string
  readonly expectedHead:AuthorWorldbookRefV1|null
}
/** Process-only failure of the current read after a durable publication. */
export interface AuthorWorldbookReadErrorV1 {readonly code:string}
export type AuthorWorldbookReadResultV1=
  |{readonly book:AuthorWorldbookCaptureV1;readonly readError?:never}
  |{readonly book?:never;readonly readError:AuthorWorldbookReadErrorV1}
export type AuthorWorldbookMutationResultV1=AuthorWorldbookReadResultV1&{
  readonly receipt:AuthorWorldbookReceiptV1
  readonly createdUids:readonly number[]
  readonly createdEntries:readonly WorldbookEntryWireV1[]
  readonly deletedEntries:readonly WorldbookEntryWireV1[]
}
export type {AuthorWorldbookMutationV1}
