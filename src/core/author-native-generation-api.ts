/** Serialized into each admitted author realm. The Main session route owns
 * cross-realm reservations and cancellation. Native owns model dispatch. */
export function createAuthorNativeGenerationApi(input:{
  readonly realmId:string
  current():boolean
  request(operation:string,payload:unknown,operationId:string):Promise<any>
  emit(event:string,args:readonly unknown[]):Promise<unknown>
  readonly filters:Map<string,Function>
}) {
  interface LocalGeneration {readonly operationId:string;readonly generationId:string;readonly abort:AbortController;cancelled:boolean}
  const active=new Map<string,LocalGeneration>(),decodedFilters=new WeakMap<Function,any>(),
    encodedFilters=new Map<string,WeakMap<Function,any>>(),ownedFilters=new Map<string,Set<string>>()
  const cancelled=()=>Error('AUTHOR_GENERATION_CANCELLED')
  const assertCurrent=(job:LocalGeneration)=>{
    if(!input.current()||job.cancelled||active.get(job.generationId)!==job)throw cancelled()
  }
  function requestJob(job:LocalGeneration,operation:string,payload:unknown):Promise<any> {
    assertCurrent(job)
    return new Promise((resolve,reject)=>{
      const stopped=()=>reject(cancelled()),finish=()=>job.abort.signal.removeEventListener('abort',stopped)
      job.abort.signal.addEventListener('abort',stopped,{once:true})
      input.request(operation,payload,job.operationId).then(value=>{finish();resolve(value)},error=>{finish();reject(error)})
    })
  }
  function encode(config:any,generationId:string,operationId:string,requireCurrent=false):any {
    let cache=encodedFilters.get(operationId)
    if(requireCurrent&&!cache)throw cancelled()
    if(!cache){cache=new WeakMap();encodedFilters.set(operationId,cache)}
    return {...config,...Array.isArray(config.injects)?{injects:config.injects.map((row:any)=>{
      if(typeof row.filter!=='function')return row
      const previous=decodedFilters.get(row.filter)
      let descriptor=previous?.operationId===operationId?previous:cache!.get(row.filter)
      if(!descriptor){const callbackId=crypto.randomUUID();input.filters.set(callbackId,row.filter)
        let ids=ownedFilters.get(operationId)
        if(!ids){ids=new Set();ownedFilters.set(operationId,ids)}
        ids.add(callbackId)
        descriptor={kind:'author-generation-filter',realmId:input.realmId,callbackId,generationId,operationId}
        cache!.set(row.filter,descriptor)}
      return {...row,filter:descriptor}
    })}:{}}
  }
  function decode(config:any):any {
    return {...config,...Array.isArray(config.injects)?{injects:config.injects.map((row:any)=>{
      const descriptor=row.filter
      if(descriptor?.kind!=='author-generation-filter')return row
      const callback=descriptor.realmId===input.realmId?input.filters.get(descriptor.callbackId):undefined,
        proxy=callback??(()=>input.request('generation-filter',{descriptor},descriptor.operationId))
      decodedFilters.set(proxy,descriptor)
      return {...row,filter:proxy}
    })}:{}}
  }
  async function imageUpload(value:any,signal:AbortSignal):Promise<any> {
    if(value?.type==='image-upload')return value
    let blob:Blob,name:string|undefined
    if(value instanceof Blob){blob=value;name='name' in value?String(value.name):undefined}
    else if(typeof value==='string') {
      if(/^(?:https?:|data:|blob:)/i.test(value)) {
        const response=await fetch(value,{credentials:'omit',signal})
        if(!response.ok)throw Error('AUTHOR_GENERATION_IMAGE_FETCH_FAILED')
        blob=await response.blob()
      }else {
        let bytes:Uint8Array<ArrayBuffer>
        try{bytes=Uint8Array.from(atob(value),character=>character.charCodeAt(0))}
        catch{throw Error('AUTHOR_GENERATION_IMAGE_INVALID')}
        const mediaType=bytes[0]===137&&bytes[1]===80?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':
          bytes[0]===71&&bytes[1]===73?'image/gif':bytes[0]===82&&bytes[8]===87?'image/webp':''
        blob=new Blob([bytes],{type:mediaType})
      }
    }else throw Error('AUTHOR_GENERATION_IMAGE_INVALID')
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(blob.type))
      throw Error('AUTHOR_GENERATION_IMAGE_TYPE_UNSUPPORTED')
    const bytes=new Uint8Array(await blob.arrayBuffer()),chunks:string[]=[]
    for(let offset=0;offset<bytes.length;offset+=8192)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+8192)))
    return {type:'image-upload',mediaType:blob.type,data:btoa(chunks.join('')),...name?{name}:{}}
  }
  async function images(config:any,signal:AbortSignal):Promise<any> {
    const prompt=async(row:any)=>row?.image===undefined?row:{...row,image:await image(row.image)},
      image=async(value:any)=>Array.isArray(value)?Promise.all(value.map(item=>imageUpload(item,signal))):imageUpload(value,signal),
      result={...config},order=config.mode==='raw'&&Array.isArray(config.ordered_prompts)?config.ordered_prompts:undefined
    if(config.image!==undefined&&(!order||order.includes('user_input')))result.image=await image(config.image)
    else delete result.image
    if(Array.isArray(config.ordered_prompts))result.ordered_prompts=await Promise.all(config.ordered_prompts.map(prompt))
    if(Array.isArray(config.overrides?.chat_history?.prompts))result.overrides={...config.overrides,
      chat_history:{...config.overrides.chat_history,prompts:await Promise.all(config.overrides.chat_history.prompts.map(
        (row:any)=>{if(!order||order.includes('chat_history'))return prompt(row)
          const {image:_unused,...text}=row;return text}))}}
    return result
  }
  async function generate(mode:'preset'|'raw',config:any={}) {
    const generationId=config.generation_id??crypto.randomUUID()
    if(typeof generationId!=='string'||!generationId)throw Error('AUTHOR_GENERATION_ID_INVALID')
    if(active.has(generationId))throw Error('AUTHOR_GENERATION_ID_ACTIVE')
    const job:LocalGeneration={generationId,operationId:crypto.randomUUID(),abort:new AbortController(),cancelled:false}
    active.set(generationId,job)
    let reserved=false
    try {
      await input.request('generation-reserve',{generationId,silence:config.should_silence===true},job.operationId)
      reserved=true;assertCurrent(job)
      const args=await requestJob(job,'generation-requested',{args:[generationId,mode==='preset'?'generate':'generateRaw',
        encode({...config,generation_id:generationId},generationId,job.operationId)]})
      assertCurrent(job)
      const requested={...args[2],generation_id:generationId,mode},wire=await images(requested,job.abort.signal)
      assertCurrent(job)
      await requestJob(job,'start-author-generation',{options:wire})
      assertCurrent(job)
      await input.emit('js_generation_started',[generationId])
      let cursor=0,text='',reasoning=''
      for(;;) {
        assertCurrent(job)
        const update=await requestJob(job,'author-generation-next',{cursor})
        assertCurrent(job);cursor=update.cursor
        if(update.filter) {
          let result:any
          try{result=await requestJob(job,'invoke-author-generation-filter',update.filter)}
          catch(error){result={accepted:false,error:error instanceof Error?error.message:String(error)}}
          assertCurrent(job)
          await requestJob(job,'author-generation-filter-result',{invocationId:update.filter.invocationId,...result})
          continue
        }
        if(requested.should_stream)for(const delta of update.deltas) {
          if(delta.kind==='text') {
            text+=delta.delta
            await input.emit('js_stream_token_received_fully',[text,generationId])
            await input.emit('js_stream_token_received_incrementally',[delta.delta,generationId])
          }else {
            reasoning+=delta.delta
            await input.emit('js_reasoning_token_received_fully',[reasoning,generationId])
            await input.emit('js_reasoning_token_received_incrementally',[delta.delta,generationId])
          }
          assertCurrent(job)
        }
        if(!update.settled)continue
        if(update.error)throw Error(update.error)
        const result=update.result
        if(!result)throw Error('AUTHOR_GENERATION_RESULT_UNAVAILABLE')
        const details=result.details,message=details.content
        await input.emit('js_generation_before_end',[{message,...details.reasoning?{reasoning:details.reasoning}:{}},generationId])
        assertCurrent(job)
        await input.emit('js_generation_ended',[message,generationId,details.reasoning||undefined])
        return requested.should_return_reasoning||requested.tools?.length?details:message
      }
    }finally {
      if(active.get(generationId)===job)active.delete(generationId)
      if(reserved)await input.request('generation-release',{},job.operationId).catch(()=>{})
    }
  }
  function stopLocal(operationId:string):boolean {
    const job=[...active.values()].find(row=>row.operationId===operationId)
    if(!job)return false
    job.cancelled=true;active.delete(job.generationId);job.abort.abort()
    void input.emit('generation_stopped',[job.generationId]).catch(()=>{})
    return true
  }
  function stopGenerationById(generationId:string):boolean {
    const job=active.get(generationId)
    if(!job)return false
    stopLocal(job.operationId)
    void input.request('stop-author-generation',{},job.operationId).catch(()=>{})
    return true
  }
  const defaultOrder=['world_info_before','persona_description','char_description','char_personality','scenario',
    'world_info_after','dialogue_examples','chat_history','user_input']
  return {generate:(config?:any)=>generate('preset',config),generateRaw:(config?:any)=>generate('raw',config),encode,decode,
    placeholder_prompt_default_order:defaultOrder,builtin_prompt_default_order:defaultOrder,
    beginRequested(operationId:string){
      if(!encodedFilters.has(operationId))encodedFilters.set(operationId,new WeakMap())
    },
    async invokeFilter(callbackId:string,operationId:string) {
      if(!ownedFilters.get(operationId)?.has(callbackId))throw Error('AUTHOR_NATIVE_GENERATION_FILTER_REVOKED')
      const callback=input.filters.get(callbackId)
      if(!callback)throw Error('AUTHOR_NATIVE_GENERATION_FILTER_REVOKED')
      const accepted=await callback()
      if(typeof accepted!=='boolean')throw Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID_RESULT')
      return accepted
    },
    stopLocal,stopGenerationById,stopAllGeneration:()=>{
      for(const job of [...active.values()])stopGenerationById(job.generationId)
      void input.request('stop-all-author-generations',{},crypto.randomUUID()).catch(()=>{})
      return true
    },releaseFilters(operationId:string,ids:readonly string[]) {
      for(const id of ownedFilters.get(operationId)??ids)input.filters.delete(id)
      ownedFilters.delete(operationId)
      encodedFilters.delete(operationId)
    },dispose(){for(const job of [...active.values()])stopGenerationById(job.generationId)}}
}
