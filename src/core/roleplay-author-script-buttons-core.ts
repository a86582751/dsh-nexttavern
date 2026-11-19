/** Script buttons are author metadata in the existing Source journal. This
 * owner changes their list without changing executable script descriptors. */
import type {AuthorNativeProgramV1,AuthorNativeRealmV1,AuthorNativeScriptV1} from './author-native-program.mjs'
import type {AuthorNativeScriptButtonsSnapshotV1,AuthorNativeScriptButtonsRequestV1} from './author-native-helper-types.js'
import type {TavernAuthorMetadataDataV1,TavernAuthorMetadataMutationResultV1,TavernLoreEditsDepsV1,
  TavernLorePublicationObserverV1} from './roleplay-tavern-lore-edits-types.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'

function scriptPath(script:AuthorNativeScriptV1):string[] {
  const keys=script.pointer.split('/').slice(1).map(key=>key.replace(/~1/g,'/').replace(/~0/g,'~'))
  const extension=keys.indexOf('extensions')
  if(extension<0||keys[extension+1]!=='tavern_helper'||keys[extension+2]!=='scripts')
    throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE')
  return keys.slice(extension+3)
}
function descriptor(scripts:any,path:readonly string[]):any {
  let value=scripts
  for(const key of path)value=value?.[key]
  if(!value||typeof value!=='object')throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE')
  return value
}
export function captureAuthorNativeScriptButtons(program:AuthorNativeProgramV1,
  metadata:Pick<TavernAuthorMetadataDataV1,'source'|'revision'|'extensions'>):AuthorNativeScriptButtonsSnapshotV1 {
  const scripts=(metadata.extensions?.tavern_helper as {scripts?:unknown})?.scripts
  return {sourceSha256:metadata.source.sourceSha256,revision:metadata.revision,
    scripts:program.scripts.filter(script=>script.enabled).map(script=>{
      const value=descriptor(scripts,scriptPath(script))
      return {scriptId:script.scriptId??script.identity,enabled:value.button?.enabled!==false,
        buttons:(value.button?.buttons??[]).map((button:{name:string;visible:boolean})=>({name:button.name,visible:button.visible}))}
    })}
}
export function createRoleplayAuthorScriptButtonsCoreV1(deps:{
  source:Pick<TavernLoreEditsDepsV1['source'],'capture'>
  edits:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,'observeAuthorMetadataData'|'mutateAuthorMetadata'>
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
}) {
  return {
    async mutate(sid:string,program:AuthorNativeProgramV1,realm:AuthorNativeRealmV1,
      request:AuthorNativeScriptButtonsRequestV1,current:()=>boolean,signal:AbortSignal,
      observePublication?:TavernLorePublicationObserverV1):Promise<TavernAuthorMetadataMutationResultV1> {
      const prepared=await deps.withSourceLock(sid,async()=>{
        signal.throwIfAborted()
        if(!current())throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_CHANGED')
        const self=program.scripts.filter(script=>script.enabled&&script.realmId===realm.realmId)
        if(self.length!==1)throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
        const captured=deps.source.capture(sid)
        if(captured.kind!=='captured-data')throw Error('AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE')
        const observed=deps.edits.observeAuthorMetadataData(captured)
        if(observed.kind!=='captured-data')throw Error(observed.diagnostics[0]?.code??'AUTHOR_SCRIPT_BUTTON_SOURCE_UNAVAILABLE')
        const data=observed.data
        if(data.source.sourceSha256!==request.expectedSourceSha256||data.revision!==request.expectedRevision)
          throw Error('AUTHOR_SCRIPT_BUTTON_BASIS_CHANGED')
        const extension=data.extensions?.tavern_helper as {scripts?:unknown}
        const path=scriptPath(self[0]!),old=descriptor(extension?.scripts,path)
        if(self[0]!.scriptId&&old.id!==self[0]!.scriptId)throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
        if(!Array.isArray(request.buttons)||request.buttons.some(button=>typeof button.name!=='string'||typeof button.visible!=='boolean'))
          throw Error('AUTHOR_SCRIPT_BUTTONS_INVALID')
        const buttons=request.buttons.map(button=>({name:button.name,visible:button.visible}))
        const replace=(node:any,index:number):any=>{
          if(index===path.length)return {...node,button:{...node.button,buttons}}
          const key=path[index]!,copy=Array.isArray(node)?node.slice():{...node}
          copy[key]=replace(node[key],index+1)
          return copy
        }
        return {source:data.source.sourceSha256,revision:data.revision,scripts:replace(extension.scripts,0) as MvuJsonValue}
      },signal)
      // The Source writer owns its FIFO and exact revision CAS. Do not nest
      // that lock around this call or reconstruct a second publication owner.
      return deps.edits.mutateAuthorMetadata({schemaVersion:1,encoding:'tavern-author-metadata-mutation-request-v1',
        sessionId:sid,operationId:request.operationId,expectedSourceSha256:prepared.source,expectedRevision:prepared.revision,
        mutation:{kind:'extension-fields',extension:'tavern_helper',set:{scripts:prepared.scripts}}},current,observePublication)
    },
  }
}
