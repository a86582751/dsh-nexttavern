/** Source owns discovery currency; Library owns selected embedded image bytes. */
import {sourceImageTextLiteralsV1,sourceImageScriptLiteralsV1,sourceImageCssLiteralsV1}
  from './roleplay-source-images-parser.mjs'
import type {SourceImageLiteralV1,SourceImageCarrierV1,SourceImageDiagnosticV1,ParsedSourceImagesV1}
  from './roleplay-source-images-parser.mjs'
import {recordSha256} from './roleplay-data.js'
import type {NextTavernCardData} from './nexttavern-card.js'
import type {TavernResource,createTavernLibrary} from './tavern-library.js'
import type {ResourceSession} from './roleplay-resource-bridge-types.js'
export type {SourceImageCarrierV1,SourceImageDiagnosticV1} from './roleplay-source-images-parser.mjs'

export interface SourceImagesDataV1 {sourceHash:string;importId:string;data:NextTavernCardData}
export interface SourceImageCandidateV1 {
  candidateId:string
  name:string
  carrier:SourceImageCarrierV1
  position:string
  uri?:string
  type:string
  storage:'embedded'|'remote'|'unresolved'
  reason?:string
}
export interface SourceImageCatalogV1 {
  sourceHash:string|null
  candidates:SourceImageCandidateV1[]
  diagnostics:SourceImageDiagnosticV1[]
}
export interface SourceRemoteImageV1 {id:string;name:string;type:string;url:string}
export interface SourceImagesDependenciesV1 {
  read(session:ResourceSession):SourceImagesDataV1|null
  /** InputState's existing Source slot owns the full read/discovery result. */
  capture<T>(session:ResourceSession,build:()=>T):T
  libraryFor(session:ResourceSession):ReturnType<typeof createTavernLibrary>
}
interface LocatedImage {candidate:SourceImageCandidateV1;uri:string}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const pointer=(value:string)=>value.replace(/~/g,'~0').replace(/\//g,'~1')
const imageData=/^data:(image\/[a-z0-9.+-]+)((?:;[^,]*)?),(.*)$/is
const imageTypes:Readonly<Record<string,string>>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',
  webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',bmp:'image/bmp',ico:'image/vnd.microsoft.icon',
  tif:'image/tiff',tiff:'image/tiff',apng:'image/apng'}
function pathType(uri:string):string|undefined {
  const path=uri.split(/[?#]/,1)[0]!
  return imageTypes[path.split('.').at(-1)!.toLowerCase()]
}
function classify(uri:string,forceImage:boolean,hint?:string)
  :{type:string;storage:SourceImageCandidateV1['storage'];reason?:string}|undefined {
  const embedded=imageData.exec(uri)
  if(embedded)return {type:embedded[1]!.toLowerCase(),storage:'embedded'}
  const type=pathType(uri)??hint??'image/unknown'
  if(!forceImage&&!hint&&!pathType(uri)&&!/^data:image\//i.test(uri)&&!/^ccdefault:/i.test(uri))return
  if(/^https?:\/\//i.test(uri)) {
    try {
      const url=new URL(uri)
      if(url.hostname)return {type,storage:'remote'}
    }catch {}
    return {type,storage:'unresolved',reason:'图片 HTTP/S 地址不完整，未访问远端或补全地址。'}
  }
  if(/^ccdefault:/i.test(uri))return {type,storage:'unresolved',reason:'ccdefault 图片缺少实际资源映射，未猜测本机路径或角色身份。'}
  if(/^data:/i.test(uri))return {type,storage:'unresolved',reason:'该内嵌地址不是可直接保留的 image 数据 URI。'}
  return {type,storage:'unresolved',reason:'相对地址或其他 URI 缺少实际图片 base／资源映射，未猜测本机路径。'}
}
function discover(data:NextTavernCardData):{items:LocatedImage[];diagnostics:SourceImageDiagnosticV1[]} {
  const items:LocatedImage[]=[],diagnostics:SourceImageDiagnosticV1[]=[]
  const add=(literal:SourceImageLiteralV1,forceImage=literal.carrier==='html'
    ||literal.carrier==='markdown'||literal.imageSink===true,hint?:string)=>{
    const uri=literal.uri.trim(),media=classify(uri,forceImage,hint)
    if(!media)return
    items.push({uri,candidate:{candidateId:recordSha256([literal.carrier,literal.position]),
      name:literal.name||`角色卡图片 ${items.length+1}`,carrier:literal.carrier,position:literal.position,
      ...(media.storage==='embedded'?{}:{uri:literal.uri}),...media}})
  }
  const parsed=(result:ParsedSourceImagesV1)=>{
    for(const literal of result.literals)add(literal)
    diagnostics.push(...result.diagnostics)
  }
  const text=(source:string,position:string)=>parsed(sourceImageTextLiteralsV1(source,position))
  const script=(source:string,position:string)=>parsed(sourceImageScriptLiteralsV1(source,position))
  const assets=(value:unknown,position:string,name?:string,hint?:string,imageAsset=false):void=>{
    if(typeof value==='string'){add({uri:value,carrier:'asset',position,...(name?{name}:{})},imageAsset,hint);return}
    if(Array.isArray(value)){value.forEach((item,index)=>assets(item,position+'/'+index,name,hint,imageAsset));return}
    if(!object(value))return
    const declared=typeof value.type==='string'&&value.type.startsWith('image/')?value.type
      :typeof value.mime==='string'&&value.mime.startsWith('image/')?value.mime:undefined
    const extension=typeof value.ext==='string'?imageTypes[value.ext.toLowerCase()]:undefined
    const localName=typeof value.name==='string'?value.name:name
    const localHint=declared??extension??hint
    const localImage=imageAsset||!!localHint||['image','icon','background','portrait'].includes(String(value.type))
    for(const [key,item]of Object.entries(value)) {
      if(['name','type','ext','mime'].includes(key))continue
      const address=['uri','url','src','path','data','uris','urls','sources'].includes(key)
      assets(item,position+'/'+pointer(key),localName,address?localHint:undefined,address&&localImage)
    }
  }
  assets(data.assets,'/data/assets')
  for(const field of ['cards','worldbook']as const)data[field].forEach((row,index)=>text(row.content,`/data/${field}/${index}/content`))
  for(const [key,entry]of Object.entries(data.character_book?.entries??{})) {
    if(object(entry)&&typeof entry.content==='string')text(entry.content,'/data/character_book/entries/'+pointer(key)+'/content')
  }
  if(data.opening) {
    text(data.opening.text,'/data/opening/text')
    if(Array.isArray(data.opening.catalog))data.opening.catalog.forEach((value,index)=>{
      if(object(value)&&typeof value.rawText==='string')text(value.rawText,'/data/opening/catalog/'+index+'/rawText')
    })
  }
  for(const [key,value]of Object.entries(data.rules))if(typeof value==='string')text(value,'/data/rules/'+pointer(key))
  if(data.status)text(data.status.text,'/data/status/text')
  const beauty=data.rules.beauty
  if(typeof beauty?.css==='string')parsed(sourceImageCssLiteralsV1(beauty.css,'/data/rules/beauty/css'))
  if(typeof beauty?.js==='string')script(beauty.js,'/data/rules/beauty/js')
  const helper=object(data.extensions)&&data.extensions.tavern_helper
  const scripts=(values:unknown[],position:string):void=>values.forEach((value,index)=>{
    if(!object(value))return
    const at=position+'/'+index
    if(value.type==='folder'&&Array.isArray(value.scripts)){scripts(value.scripts,at+'/scripts');return}
    const content=value.content??value.code
    if(typeof content==='string')script(content,at+(typeof value.content==='string'?'/content':'/code'))
    if(object(value.data)&&typeof value.data.html==='string')text(value.data.html,at+'/data/html')
  })
  if(object(helper)&&Array.isArray(helper.scripts))scripts(helper.scripts,'/data/extensions/tavern_helper/scripts')
  return {items,diagnostics}
}

export function createSourceImagesV1(deps:SourceImagesDependenciesV1) {
  const catalog=(session:ResourceSession)=>deps.capture(session,()=>{
    const source=deps.read(session)
    return source?{sourceHash:source.sourceHash,importId:source.importId,...discover(source.data)}:null
  })
  return {
    list(session:ResourceSession):SourceImageCatalogV1 {
      const current=catalog(session)
      return {sourceHash:current?.sourceHash??null,candidates:current?.items.map(item=>item.candidate)??[],
        diagnostics:current?.diagnostics??[]}
    },
    async select(session:ResourceSession,sourceHash:string,candidateId:string):Promise<TavernResource|SourceRemoteImageV1> {
      const current=catalog(session)
      if(!current||current.sourceHash!==sourceHash)throw Error('角色卡来源已变化，请刷新图片列表后重新选择。')
      const item=current.items.find(value=>value.candidate.candidateId===candidateId)
      if(!item)throw Error('角色卡图片已不存在，请刷新图片列表。')
      const candidate=item.candidate
      if(candidate.storage==='unresolved')throw Error(candidate.reason!)
      if(candidate.storage==='remote')return {id:recordSha256([current.sourceHash,candidateId]),
        name:candidate.name,type:candidate.type,url:item.uri}
      const match=imageData.exec(item.uri)!
      const bytes=/;base64(?:;|$)/i.test(match[2]!)?Buffer.from(match[3]!,'base64')
        :Buffer.concat(match[3]!.split(/(%[a-f0-9]{2})/i).map(part=>/^%[a-f0-9]{2}$/i.test(part)
          ?Buffer.from([Number.parseInt(part.slice(1),16)]):Buffer.from(part,'utf8')))
      // Alt text and author labels are not filenames. Library receives a stable
      // name while the catalog keeps the complete original label and location.
      const extension=Object.entries(imageTypes).find(([,type])=>type===candidate.type)?.[0]
      return deps.libraryFor(session).archive({name:'角色卡图片-'+candidateId.slice(0,16)+(extension?'.'+extension:''),
        type:candidate.type,bytes,source:{kind:'source-media-v1',sessionId:session.id,importId:current.importId,
          sourceHash:current.sourceHash,candidateId}})
    },
  }
}
