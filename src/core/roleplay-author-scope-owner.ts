/** Selectors locate shared author DATA. Current Source identities and the
 * private caller lifetime independently admit every persistent mutation. */
import type {AuthorProfileIdentityV1} from './roleplay-author-profile.js'
import type {RoleplayAuthorPersistentScopesV1} from './roleplay-author-persistent-scopes.js'
import type {AuthorPersistentScopeAddressV1,AuthorPersistentScopeCaptureV1,AuthorPersistentScopeReplaceV1}
  from './roleplay-author-scope-types.js'
import type {AuthorChatNamespaceV3,OrdinaryAuthorChatBatchUpdateV3} from './roleplay-author-chat-state-types.js'

export type AuthorSharedScopeSelectorV1={readonly type:'global'|'character'|'preset'}
  |{readonly type:'extension';readonly extension_id:string}
export interface AuthorSharedScopeSnapshotsV1 {
  readonly global?:AuthorPersistentScopeCaptureV1
  readonly character?:AuthorPersistentScopeCaptureV1
  readonly preset?:AuthorPersistentScopeCaptureV1
  readonly extensions?:Readonly<Record<string,AuthorPersistentScopeCaptureV1>>
}
export interface AuthorSharedScopeIdentityV1 {
  readonly characterId?:string
  readonly presetId?:string
  readonly extensionIds:readonly string[]
  current():boolean
}
/** This Source namespace is the actual caller's provenance guard. Shared
 * values publish solely through expectedRoot.address and its Domain head. */
export interface AuthorSharedScopeOperationV1 extends AuthorPersistentScopeReplaceV1 {
  readonly kind:'shared-scope'
  readonly sourceNamespace:AuthorChatNamespaceV3
}
export type AuthorOrdinaryNamespaceOperationV1=OrdinaryAuthorChatBatchUpdateV3|AuthorSharedScopeOperationV1
export const isAuthorSharedScopeOperationV1=(operation:AuthorOrdinaryNamespaceOperationV1):operation is AuthorSharedScopeOperationV1=>
  'kind' in operation&&operation.kind==='shared-scope'
export const authorOrdinarySourceNamespaceV1=(operation:AuthorOrdinaryNamespaceOperationV1)=>
  isAuthorSharedScopeOperationV1(operation)?operation.sourceNamespace:operation.namespace
export const authorSharedScopeRootsV1=(snapshots:AuthorSharedScopeSnapshotsV1|undefined)=>[
  snapshots?.global?.root,snapshots?.character?.root,snapshots?.preset?.root,
  snapshots?.extensions&&Object.entries(snapshots.extensions).map(([id,capture])=>[id,capture.root])]
export function authorSharedScopeCaptureV1(snapshots:AuthorSharedScopeSnapshotsV1|undefined,
  selector:AuthorSharedScopeSelectorV1):AuthorPersistentScopeCaptureV1 {
  const extensions=snapshots?.extensions
  const capture=selector.type==='extension'
    ?extensions&&Object.hasOwn(extensions,selector.extension_id)?extensions[selector.extension_id]:undefined
    :snapshots?.[selector.type]
  if(!capture)throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE')
  return capture
}
export function authorSharedScopeSelectorV1(address:AuthorPersistentScopeAddressV1):AuthorSharedScopeSelectorV1 {
  return address.scope==='extension'?{type:'extension',extension_id:address.extensionId}:{type:address.scope}
}
function updateFor(operation:AuthorSharedScopeOperationV1):AuthorPersistentScopeReplaceV1 {
  return {expectedRoot:operation.expectedRoot,operationId:operation.operationId,values:operation.values,cause:operation.cause}
}
const addressIdentity=(address:AuthorPersistentScopeAddressV1)=>JSON.stringify([
  address.schemaVersion,address.profileId,address.scope,
  address.scope==='character'?address.characterId:address.scope==='preset'?address.presetId:
    address.scope==='extension'?address.extensionId:null])

export function createRoleplayAuthorScopeOwnerV1(deps:{readonly profile:AuthorProfileIdentityV1;
  readonly scopes:RoleplayAuthorPersistentScopesV1;resolveIdentity(sid:string):AuthorSharedScopeIdentityV1;
  withPresetMutation?<T>(work:()=>Promise<T>):Promise<T>}) {
  function addressFor(selector:AuthorSharedScopeSelectorV1,identity:AuthorSharedScopeIdentityV1):AuthorPersistentScopeAddressV1 {
    const common={schemaVersion:1 as const,profileId:deps.profile.profileId}
    if(selector.type==='global')return {...common,scope:'global'}
    if(selector.type==='character'&&identity.characterId)return {...common,scope:'character',characterId:identity.characterId}
    if(selector.type==='preset'&&identity.presetId)return {...common,scope:'preset',presetId:identity.presetId}
    if(selector.type==='extension'&&identity.extensionIds.includes(selector.extension_id))
      return {...common,scope:'extension',extensionId:selector.extension_id}
    throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE')
  }
  function capture(sid:string):AuthorSharedScopeSnapshotsV1 {
    const identity=deps.resolveIdentity(sid),read=(selector:AuthorSharedScopeSelectorV1)=>deps.scopes.capture(addressFor(selector,identity)),
      extensions:Record<string,AuthorPersistentScopeCaptureV1>=Object.create(null)
    for(const extension_id of identity.extensionIds)extensions[extension_id]=read({type:'extension',extension_id})
    return {global:read({type:'global'}),...identity.characterId?{character:read({type:'character'})}:{},
      ...identity.presetId?{preset:read({type:'preset'})}:{},extensions}
  }
  function resolve(sid:string,selector:AuthorSharedScopeSelectorV1,callerCurrent:()=>boolean) {
    const identity=deps.resolveIdentity(sid),address=addressFor(selector,identity),capture=deps.scopes.capture(address)
    return {address,root:capture.root,values:capture.values,capture,
      current:()=>callerCurrent()&&identity.current()}
  }
  async function replace(sid:string,operation:AuthorSharedScopeOperationV1,callerCurrent:()=>boolean) {
    const selector=authorSharedScopeSelectorV1(operation.expectedRoot.address)
    const publish=async()=>{
      const resolved=resolve(sid,selector,callerCurrent),expectedIdentity=addressIdentity(resolved.address)
      if(expectedIdentity!==addressIdentity(operation.expectedRoot.address))throw Error('AUTHOR_SCOPE_BINDING_CHANGED')
      const update={...updateFor(operation),expectedRoot:{address:resolved.address,head:operation.expectedRoot.head}}
      return deps.scopes.replace(update,{
        owns:address=>addressIdentity(address)===expectedIdentity,isCurrent:resolved.current})
    }
    // Preset content and its live variables share the community owner's FIFO.
    // A full content replacement retains its fixed scope continuation there.
    return selector.type==='preset'&&deps.withPresetMutation?deps.withPresetMutation(publish):publish()
  }
  return {capture,resolve,replace,lookup:(operation:AuthorSharedScopeOperationV1)=>deps.scopes.lookup(updateFor(operation))}
}
export type RoleplayAuthorScopeOwnerV1=ReturnType<typeof createRoleplayAuthorScopeOwnerV1>
