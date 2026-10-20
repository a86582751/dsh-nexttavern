/** One pure interpreter for live settlement and JSONL cold verification.
 * Original provider blocks and signatures remain in the embedded raw stream;
 * stored operations never call a live owner or acquire dispatch authority. */
import {createHash} from 'node:crypto'
import type {ContentBlock,NativeStoryResponseMaterialV1,NativeStoryResponseOperationV1} from '@deepseek-ai/dsh-llm'

const fail=():never=>{throw Error('STORY_RESPONSE_MATERIAL_INVALID')}
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>
    `${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)??fail()
}
export const nativeStoryResponseSha256V1=(value:unknown):string=>createHash('sha256').update(canonical(value),'utf8').digest('hex')
export const nativeStoryVisibleTextV1=(blocks:readonly ContentBlock[])=>blocks.flatMap(block=>block.type==='text'?[block.text]:[]).join('')
const transportName=(name:unknown):name is string=>typeof name==='string'&&(name==='game_content'||/^emit_complete_response_[a-f0-9]{24}$/.test(name))
function object(value:unknown,fields:readonly string[]):Record<string,unknown> {
  if(value===null||typeof value!=='object'||Array.isArray(value))return fail()
  const row=value as Record<string,unknown>
  if(Object.keys(row).length!==fields.length||Object.keys(row).some(key=>!fields.includes(key)))return fail()
  return row
}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
export function validateNativeStoryResponseMaterialV1(value:unknown):asserts value is NativeStoryResponseMaterialV1 {
  const row=object(value,['schemaVersion','encoding','rawContentSha256','canonicalContentSha256','canonicalOrigins','plan'])
  if(row['schemaVersion']!==1||row['encoding']!=='native-story-response-material-v1'
    ||!hash(row['rawContentSha256'])||!hash(row['canonicalContentSha256'])||!Array.isArray(row['plan'])||row['plan'].length>3
    ||!Array.isArray(row['canonicalOrigins'])||row['canonicalOrigins'].some(value=>value!==null&&!integer(value)))return fail()
  const kinds=new Set<string>()
  for(const item of row['plan']) {
    if(item===null||typeof item!=='object')return fail()
    const kind=(item as Record<string,unknown>)['kind']
    if(typeof kind!=='string'||kinds.has(kind))return fail()
    kinds.add(kind)
    if(kind==='extract-transport') {
      const op=object(item,['kind','name','selection'])
      if(!transportName(op['name'])||op['selection']!=='transport'&&op['selection']!=='longest')return fail()
    }else if(kind==='recover-reasoning') {
      const op=object(item,['kind','ranges'])
      if(!Array.isArray(op['ranges'])||!op['ranges'].length)return fail()
      for(const raw of op['ranges']) {
        const range=object(raw,['blockIndex','start','end','sha256'])
        if(!integer(range['blockIndex'])||!integer(range['start'])||!integer(range['end'])
          ||range['end']<range['start']||!hash(range['sha256']))return fail()
      }
    }else if(kind==='replace-text') {
      const op=object(item,['kind','expectedTextSha256','text'])
      if(!hash(op['expectedTextSha256'])||typeof op['text']!=='string'||!op['text'].isWellFormed())return fail()
    }else return fail()
  }
}
function replaceVisible(blocks:readonly ContentBlock[],origins:readonly (number|null)[],text:string) {
  const first=blocks.findIndex(block=>block.type==='text')
  if(first<0)return {blocks:[...blocks,{type:'text' as const,text}],origins:[...origins,null]}
  const unchanged=blocks.filter(block=>block.type==='text').length===1&&nativeStoryVisibleTextV1(blocks)===text
  const selectedOrigins:(number|null)[]=[]
  const selected=blocks.flatMap<ContentBlock>((block,index)=>{
    if(block.type!=='text'){selectedOrigins.push(origins[index]??null);return [block]}
    if(index!==first)return []
    selectedOrigins.push(unchanged?origins[index]??null:null)
    return [{type:'text',text}]
  })
  return {blocks:selected,origins:selectedOrigins}
}
export function applyNativeStoryResponseOperationsV1(raw:readonly ContentBlock[],plan:readonly NativeStoryResponseOperationV1[]):ContentBlock[] {
  return interpret(raw,plan).blocks
}
function interpret(raw:readonly ContentBlock[],plan:readonly NativeStoryResponseOperationV1[]) {
  let blocks=[...raw]
  let origins:(number|null)[]=raw.map((_block,index)=>index)
  for(const op of plan) {
    if(op.kind==='extract-transport') {
      const bodies:string[]=[]
      let first=-1
      const retained:ContentBlock[]=[]
      const retainedOrigins:(number|null)[]=[]
      for(const [index,block] of blocks.entries()) {
        if(block.type==='tool-call'&&block.name===op.name) {
          const value:unknown=JSON.parse(block.arguments)
          if(value===null||typeof value!=='object'||typeof (value as {content?:unknown}).content!=='string')return fail()
          bodies.push((value as {content:string}).content)
          if(first<0)first=retained.length
        }else {retained.push(block);retainedOrigins.push(origins[index]??null)}
      }
      if(!bodies.length)continue
      const score=(text:string)=>text.trim()?text.length:0
      const longest=bodies.reduce((a,b)=>score(b)>score(a)?b:a,'')
      const original=nativeStoryVisibleTextV1(retained)
      const selected=op.selection==='longest'&&score(original)>score(longest)?original:longest
      if(retained.some(block=>block.type==='text'))({blocks,origins}=replaceVisible(retained,retainedOrigins,selected))
      else {retained.splice(first,0,{type:'text',text:selected});retainedOrigins.splice(first,0,null)
        blocks=retained;origins=retainedOrigins}
    }else if(op.kind==='recover-reasoning') {
      if(nativeStoryVisibleTextV1(blocks).trim()||blocks.some(block=>block.type==='tool-call'))return fail()
      const text=op.ranges.map(range=>{
        const block=raw[range.blockIndex]
        if(block?.type!=='reasoning'||range.end>block.text.length)return fail()
        const selected=block.text.slice(range.start,range.end)
        if(nativeStoryResponseSha256V1(selected)!==range.sha256)return fail()
        return selected
      }).join('')
      ;({blocks,origins}=replaceVisible(blocks,origins,text))
    }else {
      if(nativeStoryResponseSha256V1(nativeStoryVisibleTextV1(blocks))!==op.expectedTextSha256)return fail()
      ;({blocks,origins}=replaceVisible(blocks,origins,op.text))
    }
  }
  return {blocks,origins}
}
export function planNativeStoryResponseMaterialV1(raw:readonly ContentBlock[],plan:readonly NativeStoryResponseOperationV1[]) {
  const {blocks:content,origins}=interpret(raw,plan)
  const material:NativeStoryResponseMaterialV1={schemaVersion:1,encoding:'native-story-response-material-v1',
    rawContentSha256:nativeStoryResponseSha256V1(raw),canonicalContentSha256:nativeStoryResponseSha256V1(content),canonicalOrigins:origins,plan}
  validateNativeStoryResponseMaterialV1(material)
  return {content,material}
}
export function reconstructNativeStoryResponseMaterialV1(raw:readonly ContentBlock[],material:NativeStoryResponseMaterialV1):ContentBlock[] {
  validateNativeStoryResponseMaterialV1(material)
  if(nativeStoryResponseSha256V1(raw)!==material.rawContentSha256)return fail()
  const {blocks:content,origins}=interpret(raw,material.plan)
  if(canonical(origins)!==canonical(material.canonicalOrigins))return fail()
  if(nativeStoryResponseSha256V1(content)!==material.canonicalContentSha256)return fail()
  return content
}
