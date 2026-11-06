/** Discover inert audio references; selection owns embedded bytes and live URLs. */
import {htmlLiteralsV1,scriptLiteralsV1} from './roleplay-source-music-parser.mjs'
import {recordSha256} from './roleplay-data.js'
import type {NextTavernCardData} from './nexttavern-card.js'
import {nextTavernExecutionAuthorData,nextTavernExecutionAuthorPointer} from './nexttavern-card.js'
import type {TavernResource,createTavernLibrary} from './tavern-library.js'
import type {ResourceSession} from './roleplay-resource-bridge-types.js'

export interface SourceMusicDataV1 {
  sourceHash:string
  importId:string
  data:NextTavernCardData
}
export interface SourceMusicCandidateV1 {
  candidateId:string
  name:string
  type:string
  carrier:'asset'|'html'|'script'
  position:string
  storage:'embedded'|'remote'|'unresolved'
  reason?:string
}
export interface SourceRemoteAudioV1 {id:string;name:string;type:string;url:string}
interface LocatedMusic {
  candidate:SourceMusicCandidateV1
  uri:string
}
const audioData=/^data:(audio\/[a-z0-9.+-]+)((?:;[^,]*)?),(.*)$/is
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const pointer=(value:string)=>value.replace(/~/g,'~0').replace(/\//g,'~1')
const remoteAudioTypes:Readonly<Record<string,string>>={
  mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',
  flac:'audio/flac',opus:'audio/ogg',webm:'audio/webm',
}
function discover(data:NextTavernCardData):LocatedMusic[] {
  const cardsPointer=nextTavernExecutionAuthorPointer(data,'cards')
  const rulesPointer=nextTavernExecutionAuthorPointer(data,'rules')
  data=nextTavernExecutionAuthorData(data)
  const found:LocatedMusic[]=[]
  const add=(uri:string,carrier:SourceMusicCandidateV1['carrier'],position:string,name?:string,
    audioSink=false,hint?:string)=>{
    uri=uri.trim()
    const match=audioData.exec(uri)
    let remote=false,pathType:string|undefined
    if(!match)try {
      const url=new URL(uri)
      remote=/^https?:$/.test(url.protocol)&&!!url.hostname
      if(remote)pathType=remoteAudioTypes[url.pathname.split('.').at(-1)!.toLowerCase()]
    }catch {}
    const type=match?.[1]?.toLowerCase()??hint??pathType??(audioSink?'audio/unknown':undefined)
    if(!type)return
    const storage=match?'embedded':remote?'remote':'unresolved'
    found.push({uri,candidate:{candidateId:recordSha256([carrier,position]),
      name:name??`角色卡音频 ${found.length+1}`,type,carrier,position,storage,
      ...(storage==='unresolved'?{reason:'音频地址缺少可用的 HTTP/S、内嵌数据或资源映射；请在原卡中补全地址。'}:{})}})
  }
  const assets=(value:unknown,position:string,name?:string,hint?:string,audioAsset=false):void=>{
    if(typeof value==='string'){add(value,'asset',position,name,audioAsset,hint);return}
    if(Array.isArray(value)){value.forEach((item,index)=>assets(item,position+'/'+index,name,hint,audioAsset));return}
    if(object(value)) {
      const declared=typeof value.type==='string'&&value.type.startsWith('audio/')?value.type
        :typeof value.mime==='string'&&value.mime.startsWith('audio/')?value.mime:undefined
      const extension=typeof value.ext==='string'?remoteAudioTypes[value.ext.toLowerCase()]:undefined
      const localHint=declared??extension??hint
      const localAudio=audioAsset||!!localHint||['audio','music','bgm'].includes(String(value.type))
      for(const [key,item]of Object.entries(value)) {
        if(['name','type','mime','ext'].includes(key))continue
        const address=['uri','url','src','path','data','uris','urls','sources'].includes(key)
        assets(item,position+'/'+pointer(key),typeof value.name==='string'?value.name:name,
          address?localHint:undefined,address&&localAudio)
      }
    }
  }
  const script=(source:string,position:string)=>{
    for(const literal of scriptLiteralsV1(source,position))add(literal.value,literal.carrier,literal.position,
      literal.name,literal.audioSink,literal.typeHint)
  }
  const html=(source:string,position:string)=>{
    for(const literal of htmlLiteralsV1(source,position))add(literal.value,literal.carrier,literal.position,
      literal.name,literal.audioSink,literal.typeHint)
  }
  assets(data.assets,'/data/assets')
  for(const field of ['cards','worldbook']as const)data[field].forEach((row,index)=>html(row.content,`${field==='cards'?cardsPointer:'/data/worldbook'}/${index}/content`))
  for(const [key,entry]of Object.entries(data.character_book?.entries??{})) {
    if(object(entry)&&typeof entry.content==='string')html(entry.content,'/data/character_book/entries/'+pointer(key)+'/content')
  }
  if(data.opening) {
    html(data.opening.text,'/data/opening/text')
    if(Array.isArray(data.opening.catalog))data.opening.catalog.forEach((value,index)=>{
      if(object(value)&&typeof value.rawText==='string')html(value.rawText,'/data/opening/catalog/'+index+'/rawText')
    })
  }
  for(const [key,value]of Object.entries(data.rules))if(typeof value==='string')html(value,rulesPointer+'/'+pointer(key))
  if(data.status)html(data.status.text,'/data/status/text')
  const beauty=data.rules.beauty
  if(typeof beauty?.js==='string')script(beauty.js,`${rulesPointer}/beauty/js`)
  const extensions=data.extensions
  const helper=object(extensions)&&extensions.tavern_helper
  const scriptTree=(values:unknown[],position:string):void=>values.forEach((value,index)=>{
    if(!object(value))return
    const descriptor=position+'/'+index
    if(value.type==='folder'&&Array.isArray(value.scripts)) {
      scriptTree(value.scripts,descriptor+'/scripts')
      return
    }
    const content=value.content??value.code
    if(typeof content==='string')script(content,descriptor+'/content')
    // Script resource HTML is inert author DATA, separate from its executable
    // content. Original cards keep embedded media in this field.
    if(object(value.data)&&typeof value.data.html==='string')html(value.data.html,descriptor+'/data/html')
  })
  if(object(helper)&&Array.isArray(helper.scripts))scriptTree(helper.scripts,'/data/extensions/tavern_helper/scripts')
  return found
}

export function createSourceMusicV1(deps:{
  read(session:ResourceSession):SourceMusicDataV1|null
  /** InputState owns the complete Source read and discovery lifetime. */
  capture<T>(session:ResourceSession,build:()=>T):T
  libraryFor(session:ResourceSession):ReturnType<typeof createTavernLibrary>
}) {
  const catalog=(session:ResourceSession)=>deps.capture(session,()=>{
    const source=deps.read(session)
    return source?{sourceHash:source.sourceHash,importId:source.importId,items:discover(source.data)}:null
  })
  return {
    list(session:ResourceSession) {
      const current=catalog(session)
      return {sourceHash:current?.sourceHash??null,candidates:current?.items.map(item=>item.candidate)??[]}
    },
    async select(session:ResourceSession,sourceHash:string,candidateId:string):Promise<TavernResource|SourceRemoteAudioV1> {
      const current=catalog(session)
      if(!current||current.sourceHash!==sourceHash)throw Error('角色卡来源已变化，请刷新音乐列表后重新选择。')
      const item=current.items.find(value=>value.candidate.candidateId===candidateId)
      if(!item)throw Error('角色卡音频已不存在，请刷新音乐列表。')
      if(item.candidate.storage==='unresolved')throw Error(item.candidate.reason!)
      if(item.candidate.storage==='remote')return {id:recordSha256([current.sourceHash,candidateId]),
        name:item.candidate.name,type:item.candidate.type,url:item.uri}
      const match=audioData.exec(item.uri)!
      const bytes=/;base64(?:;|$)/i.test(match[2]!)?Buffer.from(match[3]!,'base64')
        :Buffer.concat(match[3]!.split(/(%[a-f0-9]{2})/i).map(part=>/^%[a-f0-9]{2}$/i.test(part)
          ?Buffer.from([Number.parseInt(part.slice(1),16)]):Buffer.from(part,'utf8')))
      return deps.libraryFor(session).archive({name:item.candidate.name,type:item.candidate.type,bytes,
        source:{kind:'source-media-v1',sessionId:session.id,importId:current.importId,
          sourceHash:current.sourceHash,candidateId}})
    },
  }
}
