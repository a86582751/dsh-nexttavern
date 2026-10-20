/** Story-only provider policy and response transport. Only a live material
 * owner may attach this to its actual request; stored records grant no hooks. */
import type {ContentBlock,LlmCallConfig,ToolSchema,StreamChunk,NativeStoryResponseOperationV1} from '@deepseek-ai/dsh-llm'
import type {NativeRequestMaterialRecordV1} from '@deepseek-ai/dsh-session'
import {applyNativeStoryResponseOperationsV1,planNativeStoryResponseMaterialV1,nativeStoryResponseSha256V1,
  nativeStoryVisibleTextV1} from '@deepseek-ai/dsh-session'

export interface NativeStoryRequestPolicyV1 {
  readonly schemaVersion:1
  readonly sampling?:{readonly temperature?:number;readonly maxTokens?:number;readonly stop?:readonly string[]}
  readonly response?:{readonly transport:string}
}
export interface NativeStoryTextTransformV1 {push(text:string):string;finish():string}
export interface NativeStoryMaterialHooksV1 {
  readonly schemaVersion:1
  /** Receives complete raw visible body once, after transport extraction. */
  normalizeText?(text:string):string
  /** Deterministic profile adapter may recover reasoning-only story output.
   * Native calls this only for an empty visible body without real tools. */
  recoverText?(blocks:readonly ContentBlock[]):string|undefined
  /** A new transformer per request attempt. Its output is transient UI only. */
  createTextTransform?():NativeStoryTextTransformV1
}
export interface NativeStoryRequestBindingV1 {
  readonly policy:NativeStoryRequestPolicyV1
  readonly hooks:NativeStoryMaterialHooksV1
}
export function nativeStorySamplingConfigV1(config:LlmCallConfig,policy:NativeStoryRequestPolicyV1):LlmCallConfig {
  const sampling=policy.sampling
  return {...config,...sampling?.temperature===undefined?{}:{temperature:sampling.temperature},
    ...sampling?.maxTokens===undefined?{}:{maxTokens:sampling.maxTokens},
    ...sampling?.stop===undefined?{}:{stop:[...sampling.stop]}}
}
export function nativeStorySamplingBaseV1(config:LlmCallConfig):NonNullable<NativeRequestMaterialRecordV1['delta']['requestLocalSampling']> {
  return {schemaVersion:1,base:{...config.temperature===undefined?{}:{temperature:config.temperature},
    ...config.maxTokens===undefined?{}:{maxTokens:config.maxTokens},...config.stop===undefined?{}:{stop:[...config.stop]}}}
}
export function restoreNativeStorySamplingV1(config:LlmCallConfig,
  sampling:NonNullable<NativeRequestMaterialRecordV1['delta']['requestLocalSampling']>):LlmCallConfig {
  const {temperature:_temperature,maxTokens:_maxTokens,stop:_stop,...route}=config
  const {stop,...base}=sampling.base
  return {...route,...base,...stop?{stop:[...stop]}:{}}
}
export function nativeStoryTransportToolsV1(tools:readonly ToolSchema[],policy:NativeStoryRequestPolicyV1):ToolSchema[] {
  const name=policy.response?.transport
  if(!name)return [...tools]
  if(tools.some(tool=>tool.name===name))throw Error('STORY_TRANSPORT_TOOL_COLLISION')
  return [...tools,{name,description:'Return the complete story body in content.',
    parameters:{type:'object',properties:{content:{type:'string'}},required:['content'],additionalProperties:false}}]
}
/** Actual tools remain untouched. Removing only this request's declared
 * transport call lets a pure body finish without an extra model/tool round. */
export function normalizeNativeStoryResponseV1(blocks:readonly ContentBlock[],binding:NativeStoryRequestBindingV1):ContentBlock[] {
  return materializeNativeStoryResponseV1(blocks,binding).content
}
export function materializeNativeStoryResponseV1(blocks:readonly ContentBlock[],binding:NativeStoryRequestBindingV1) {
  const transport=binding.policy.response?.transport
  const plan:NativeStoryResponseOperationV1[]=[]
  if(transport)plan.push({kind:'extract-transport',name:transport,selection:transport==='game_content'?'transport':'longest'})
  let extracted=applyNativeStoryResponseOperationsV1(blocks,plan)
  if(!extracted.some(block=>block.type==='text'&&block.text.trim())
    &&!extracted.some(block=>block.type==='tool-call')&&binding.hooks.recoverText) {
    const recovered=binding.hooks.recoverText(blocks)
    if(recovered!==undefined) {
      const reasoning=blocks.flatMap((block,blockIndex)=>block.type==='reasoning'?[{blockIndex,text:block.text}]:[])
      const joined=reasoning.map(block=>block.text).join(''),start=joined.indexOf(recovered)
      if(start<0)throw Error('STORY_RECOVERY_SOURCE_RANGE_REQUIRED')
      let offset=0
      const ranges=reasoning.flatMap(block=>{
        const begin=Math.max(0,start-offset),end=Math.min(block.text.length,start+recovered.length-offset)
        offset+=block.text.length
        return begin<end?[{blockIndex:block.blockIndex,start:begin,end,
          sha256:nativeStoryResponseSha256V1(block.text.slice(begin,end))}]:[]
      })
      if(ranges.length) {
        plan.push({kind:'recover-reasoning',ranges})
        extracted=applyNativeStoryResponseOperationsV1(blocks,plan)
      }
    }
  }
  const first=extracted.findIndex(block=>block.type==='text')
  if(first>=0&&binding.hooks.normalizeText) {
    const text=nativeStoryVisibleTextV1(extracted),normalized=binding.hooks.normalizeText(text)
    if(normalized!==text)plan.push({kind:'replace-text',expectedTextSha256:nativeStoryResponseSha256V1(text),text:normalized})
  }
  return planNativeStoryResponseMaterialV1(blocks,plan)
}

/** Raw chunks still enter Native's accumulator unchanged. Only UI frames pass
 * here. Tool argument JSON is held until complete so transport syntax never
 * becomes visible story text; actual tools retain their completed block. */
export function createNativeStoryStreamProjectionV1(binding:NativeStoryRequestBindingV1):(chunk:StreamChunk)=>StreamChunk[] {
  if(binding.policy.response)return transportStreamProjection(binding)
  const textBlocks=new Map<number,{transform?:NativeStoryTextTransformV1;text:string}>()
  const state=(index:number)=>{
    let current=textBlocks.get(index)
    if(!current){current={text:'',...binding.hooks.createTextTransform?{transform:binding.hooks.createTextTransform()}:{}}
      textBlocks.set(index,current)}
    return current
  }
  return chunk=>{
    if(chunk.type==='text-delta') {
      const current=state(chunk.index),text=current.transform?.push(chunk.text)??chunk.text
      current.text+=text
      return text?[{...chunk,text}]:[]
    }
    if(chunk.type==='block-end'&&chunk.block.type==='text') {
      const hadDeltas=textBlocks.has(chunk.index),current=state(chunk.index)
      if(!hadDeltas)current.text+=current.transform?.push(chunk.block.text)??chunk.block.text
      const tail=current.transform?.finish()??''
      current.text+=tail
      return [...tail?[{type:'text-delta' as const,index:chunk.index,text:tail}]:[],
        {...chunk,block:{type:'text',text:current.text}}]
    }
    return [chunk]
  }
}

/** Competing ordinary/transport bodies cannot be selected until complete.
 * Delay only their visible frames; raw accumulation keeps original timing. */
function transportStreamProjection(binding:NativeStoryRequestBindingV1):(chunk:StreamChunk)=>StreamChunk[] {
  const response=binding.policy.response!
  const raw:ContentBlock[]=[]
  let bodyIndex:number|undefined
  return chunk=>{
    if(chunk.type==='block-start'&&(chunk.blockType==='text'||chunk.blockType==='tool-call'))return []
    if(chunk.type==='text-delta'||chunk.type==='tool-call-delta')return []
    if(chunk.type==='block-end') {
      const block=chunk.block
      if(block.type==='text'||block.type==='tool-call'&&block.name===response.transport) {
        bodyIndex??=chunk.index
        raw.push(block)
        return []
      }
      if(block.type==='tool-call')return [{type:'block-start',index:chunk.index,blockType:'tool-call'},chunk]
    }
    if(chunk.type==='finish'&&chunk.reason.kind!=='error'&&chunk.reason.kind!=='aborted'&&bodyIndex!==undefined) {
      const selected=applyNativeStoryResponseOperationsV1(raw,[{kind:'extract-transport',name:response.transport,
        selection:response.transport==='game_content'?'transport':'longest'}])
      const body=nativeStoryVisibleTextV1(selected),transform=binding.hooks.createTextTransform?.()
      const text=transform?transform.push(body)+transform.finish():body
      return [{type:'block-start',index:bodyIndex,blockType:'text'},{type:'text-delta',index:bodyIndex,text},
        {type:'block-end',index:bodyIndex,block:{type:'text',text}},chunk]
    }
    return [chunk]
  }
}
