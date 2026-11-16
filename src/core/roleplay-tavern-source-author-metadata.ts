/** Current author-extension fields share the Source journal, not a task's
 * configuration table. The overlay holds only changed fields; original author
 * JSON remains in the captured immutable import. */
import type {MvuJsonValue} from './tavern-mvu-initvar.js'

export interface TavernAuthorMetadataMutationRequestV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-author-metadata-mutation-request-v1'
  readonly sessionId:string
  readonly expectedSourceSha256:string
  readonly expectedRevision:number
  readonly operationId:string
  readonly mutation:{
    readonly kind:'extension-fields'
    readonly extension:string
    readonly set:Readonly<Record<string,MvuJsonValue>>
    readonly remove?:readonly string[]
  }|{readonly kind:'character-regexes-replace';readonly rules:readonly Readonly<Record<string,MvuJsonValue>>[]}
}
export type TavernAuthorMetadataFieldV1={readonly field:string}&(
  {readonly kind:'set';readonly value:MvuJsonValue}|{readonly kind:'remove'})
export interface TavernAuthorMetadataOverlayV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-author-metadata-overlay-v1'
  readonly extensions:readonly {readonly extension:string;readonly fields:readonly TavernAuthorMetadataFieldV1[]}[]
  readonly regexScripts?:readonly Readonly<Record<string,MvuJsonValue>>[]
}
export function isAuthorMetadataRequestV1(value:unknown):value is TavernAuthorMetadataMutationRequestV1 {
  return !!value&&typeof value==='object'
    &&(value as {encoding?:unknown}).encoding==='tavern-author-metadata-mutation-request-v1'
}
/** Called while the existing journal/layer owner advances its accepted chain.
 * No additional event-history scan or second persistent metadata baseline. */
export function createAuthorMetadataOverlayV1(initial?:TavernAuthorMetadataOverlayV1) {
  const extensions=new Map<string,Map<string,TavernAuthorMetadataFieldV1>>()
  let regexScripts=initial?.regexScripts
  for(const row of initial?.extensions??[])extensions.set(row.extension,new Map(row.fields.map(field=>[field.field,field])))
  return {
    accept(request:unknown) {
      if(!isAuthorMetadataRequestV1(request))return
      const mutation=request.mutation
      if(mutation.kind==='character-regexes-replace'){regexScripts=mutation.rules;return}
      let fields=extensions.get(mutation.extension)
      if(!fields){fields=new Map();extensions.set(mutation.extension,fields)}
      // A payload may remove then set the same field; the explicit set wins.
      for(const field of mutation.remove??[])fields.set(field,Object.freeze({field,kind:'remove'}))
      for(const [field,value] of Object.entries(mutation.set))fields.set(field,Object.freeze({field,kind:'set',value}))
    },
    data():TavernAuthorMetadataOverlayV1 {
      return Object.freeze({schemaVersion:1,encoding:'tavern-author-metadata-overlay-v1',
        ...regexScripts!==undefined?{regexScripts}:{},
        extensions:Object.freeze([...extensions].sort(([a],[b])=>a<b?-1:a>b?1:0)
          .map(([extension,fields])=>Object.freeze({extension,fields:Object.freeze([...fields.values()]
            .sort((a,b)=>a.field<b.field?-1:a.field>b.field?1:0))})))})
    },
  }
}
const object=(value:unknown):value is Readonly<Record<string,unknown>>=>
  !!value&&typeof value==='object'&&!Array.isArray(value)
/** Only the touched extension and its field map are copied. Values have already
 * passed the journal's JSON admission; this does not execute author strings. */
export function materializeAuthorMetadataExtensionsV1(original:unknown,overlay:TavernAuthorMetadataOverlayV1)
  :Readonly<Record<string,unknown>>|undefined {
  if(!overlay.extensions.length&&overlay.regexScripts===undefined)return object(original)?original:undefined
  if(original!==undefined&&!object(original))throw Error('AUTHOR_METADATA_EXTENSIONS_NOT_OBJECT')
  const result={...object(original)?original:{}}
  for(const row of overlay.extensions) {
    const prior=Object.hasOwn(result,row.extension)?result[row.extension]:undefined
    if(prior!==undefined&&!object(prior))throw Error('AUTHOR_METADATA_EXTENSION_NOT_OBJECT')
    const next={...object(prior)?prior:{}}
    for(const item of row.fields) {
      if(item.kind==='remove')delete next[item.field]
      else Object.defineProperty(next,item.field,{value:item.value,enumerable:true,writable:true,configurable:true})
    }
    Object.defineProperty(result,row.extension,{value:Object.freeze(next),enumerable:true,writable:true,configurable:true})
  }
  if(overlay.regexScripts!==undefined)Object.defineProperty(result,'regex_scripts',{
    value:overlay.regexScripts,enumerable:true,writable:true,configurable:true})
  return Object.freeze(result)
}
