/** The qualified 0.32 Asyncify entry/heap/lifetime protocol has one owner. */
export interface BrowserVmCleanupV2 {
  runtimeRegisteredBeforeFree?:boolean
  runtimeFreeReturned?:boolean
  runtimeRegistrationRemoved?:boolean
  contextDisposed?:boolean
  runtimeDisposed?:boolean
  hostRefGroupsAfterFree?:number
  contextRegistrationsAfterFree?:number
  runtimeRegistrationsAfterFree?:number
  clean?:boolean
}
export function createAsyncifyRuntimeV2(core:any,module:any,cleanup:BrowserVmCleanupV2) {
  const ffi=module.getFFI(),callbacks=module.callbacks
  // FreeRuntime may call freeHostRef during GC. Its registration must remain
  // live through that operation and be removed only after FFI returns.
  const rt=new core.Lifetime(ffi.QTS_NewRuntime(),undefined,(pointer:number)=>{
    cleanup.runtimeRegisteredBeforeFree=callbacks.runtimeCallbacks.has(pointer)
    ffi.QTS_FreeRuntime(pointer)
    cleanup.runtimeFreeReturned=true
    callbacks.deleteRuntime(pointer)
    cleanup.runtimeRegistrationRemoved=!callbacks.runtimeCallbacks.has(pointer)
  })
  return new core.QuickJSAsyncRuntime({module:module.module,ffi,rt,callbacks})
}
export class BrowserActorV2 {
  private tail:Promise<unknown>=Promise.resolve()
  readonly handles:any[]=[]
  private readonly asyncCall:any
  private readonly asyncJob:any
  constructor(readonly core:any,readonly module:any,readonly runtime:any,readonly vm:any) {
    // The generated numeric-only cwrap fast path bypasses Asyncify's ccall
    // wait. These options retain the supported internal async entry behavior.
    this.asyncCall=module.module.cwrap('QTS_Call','number',Array(5).fill('number'),{async:true})
    this.asyncJob=module.module.cwrap('QTS_ExecutePendingJob','number',Array(3).fill('number'),{async:true})
  }
  enter<T>(operation:()=>Promise<T>|T):Promise<T> {
    const current=this.tail.then(operation)
    this.tail=current.catch(()=>{})
    return current
  }
  private async evalHandle(code:string) {
    const text=this.vm.memory.newHeapCharPointer(code)
    let pointer:number
    try {
      pointer=await this.vm.ffi.QTS_Eval_MaybeAsync(this.vm.ctx.value,text.value.ptr,
        text.value.strlen,'owned-browser-author-v2.js',1,0)
    }finally {text.dispose()}
    return this.resultHandle(this.vm,pointer!)
  }
  private resultHandle(context:any,pointer:number) {
    const errorPointer=context.ffi.QTS_ResolveException(context.ctx.value,pointer)
    if(errorPointer) {
      context.ffi.QTS_FreeValuePointer(context.ctx.value,pointer)
      return {error:Object.assign(context.memory.heapValueHandle(errorPointer),{context})}
    }
    return {value:context.memory.heapValueHandle(pointer)}
  }
  private primitive(context:any,handle:any):number|string|undefined {
    const type=context.typeof(handle)
    if(type==='number')return context.getNumber(handle)
    if(type==='string')return context.getString(handle)
    if(type==='undefined')return undefined
    throw Error('BROWSER_CONTROLLER_PRIMITIVE_REQUIRED')
  }
  private async consume(response:any):Promise<number|string|undefined> {
    if(response.error) {
      const context=response.error.context
      context.setProp(context.global,'__owned_browser_error_v2__',response.error)
      response.error.dispose()
      const converted=await this.evalHandle('String(__owned_browser_error_v2__)')
      if(converted.error){converted.error.dispose();throw Error('BROWSER_GUEST_ERROR')}
      try {throw Error(String(this.primitive(this.vm,converted.value)))}
      finally {converted.value.dispose()}
    }
    try {return this.primitive(this.vm,response.value)}
    finally {response.value.dispose()}
  }
  /** Original code is evaluated as a global script; its completion value is
   * not a controller return and does not need to be a JSON primitive. */
  runSource(code:string):Promise<void> {
    return this.enter(async()=>{
      const result=await this.evalHandle(code)
      if(result.error)await this.consume(result)
      else result.value.dispose()
    })
  }
  capture(code:string) {
    return this.enter(async()=>{
      const result=await this.evalHandle(code)
      if(result.error)await this.consume(result)
      this.handles.push(result.value)
      return result.value
    })
  }
  call(callback:any,args:readonly any[]=[],receiver=this.vm.undefined) {
    return this.enter(async()=>{
      const argv=this.vm.memory.toPointerArray(args)
      let pointer:number
      // Both argv and borrowed arguments survive the complete suspension.
      try {pointer=await this.asyncCall(this.vm.ctx.value,callback.value,receiver.value,args.length,argv.value)}
      finally {argv.dispose()}
      return this.consume(this.resultHandle(this.vm,pointer!))
    })
  }
  drain():Promise<void> {
    return this.enter(async()=>{
      const runtime=this.runtime
      while(runtime.hasPendingJob()) {
        const output=runtime.memory.newMutablePointerArray(1)
        let pointer:number,contextPointer:number
        try {
          pointer=await this.asyncJob(runtime.rt.value,1,output.value.ptr)
          // Async suspension can grow memory; never retain an old HEAP view.
          contextPointer=new Int32Array(runtime.module.HEAPU8.buffer)[output.value.ptr>>2]!
        }finally {output.dispose()}
        if(contextPointer! ===0) {
          runtime.ffi.QTS_FreeValuePointerRuntime(runtime.rt.value,pointer!)
          continue
        }
        const context=runtime.contextMap.get(contextPointer!)
        if(!context)throw Error('BROWSER_JOB_CONTEXT_UNAVAILABLE')
        const result=context.memory.heapValueHandle(pointer!)
        if(context.typeof(result)!=='number')await this.consume({error:Object.assign(result,{context})})
        result.dispose()
      }
    })
  }
  dispose(cleanup:BrowserVmCleanupV2):Promise<void> {
    return this.enter(()=>{
      for(const handle of this.handles)handle.dispose()
      this.handles.length=0
      this.vm.dispose();cleanup.contextDisposed=!this.vm.alive
      this.runtime.dispose();cleanup.runtimeDisposed=!this.runtime.alive
      cleanup.hostRefGroupsAfterFree=this.runtime.hostRefs.groups.size
      cleanup.contextRegistrationsAfterFree=this.module.callbacks.contextCallbacks.size
      cleanup.runtimeRegistrationsAfterFree=this.module.callbacks.runtimeCallbacks.size
      cleanup.clean=cleanup.contextDisposed&&cleanup.runtimeDisposed&&cleanup.runtimeFreeReturned
        &&cleanup.runtimeRegisteredBeforeFree&&cleanup.runtimeRegistrationRemoved
        &&cleanup.hostRefGroupsAfterFree===0&&cleanup.contextRegistrationsAfterFree===0
        &&cleanup.runtimeRegistrationsAfterFree===0
    })
  }
}
