import type {AuthorNativeSourceEventV1} from './author-native-helper-types.js'

/** Native producer identity is an acknowledgement cursor for this live receiver.
 * It carries no durable receipt or writer permission. */
export interface AuthorNativeLifecyclePacketV1 {
  readonly token:string
  readonly events:readonly AuthorNativeSourceEventV1[]
}
export interface AuthorNativeLifecycleSubscription {
  peek(ackToken?:string):AuthorNativeLifecyclePacketV1|undefined
  onReady(listener:()=>void):()=>void
  wait(ackToken:string|undefined,signal:AbortSignal):Promise<AuthorNativeLifecyclePacketV1>
  dispose():void
}
export function createAuthorNativeLifecyclePublisher(options:{
  beforeSubscribe?(sessionId:string):void;afterUnsubscribe?(sessionId:string):void
}={}) {
  const sessions=new Map<string,Set<{push(packet:AuthorNativeLifecyclePacketV1):void;dispose():void}>>()
  function subscribe(sessionId:string):AuthorNativeLifecycleSubscription {
    options.beforeSubscribe?.(sessionId)
    const queue:AuthorNativeLifecyclePacketV1[]=[],listeners=new Set<()=>void>()
    let active=true
    const peek=(ackToken?:string)=>{
      if(ackToken!==undefined&&queue[0]?.token===ackToken)queue.shift()
      return queue[0]
    }
    const notify=()=>{for(const listener of [...listeners])listener()}
    const endpoint={push(packet:AuthorNativeLifecyclePacketV1){if(active){queue.push(packet);notify()}},
      dispose(){if(!active)return;active=false;queue.length=0;notify();listeners.clear()
        const receivers=sessions.get(sessionId);receivers?.delete(endpoint)
        if(!receivers?.size){sessions.delete(sessionId);options.afterUnsubscribe?.(sessionId)}}}
    let receivers=sessions.get(sessionId)
    if(!receivers){receivers=new Set();sessions.set(sessionId,receivers)}
    receivers.add(endpoint)
    return {peek,onReady(listener){listeners.add(listener);return ()=>{listeners.delete(listener)}},
      wait(ackToken,signal){
        signal.throwIfAborted()
        const available=peek(ackToken)
        if(available)return Promise.resolve(available)
        return new Promise((resolve,reject)=>{
          const cleanup=()=>{listeners.delete(ready);signal.removeEventListener('abort',abort)}
          const abort=()=>{cleanup();reject(signal.reason??Error('AUTHOR_NATIVE_LIFECYCLE_ABORTED'))}
          const ready=()=>{
            if(!active){cleanup();reject(Error('AUTHOR_NATIVE_LIFECYCLE_CLOSED'));return}
            const packet=peek()
            if(packet){cleanup();resolve(packet)}
          }
          listeners.add(ready);signal.addEventListener('abort',abort,{once:true});ready()
        })
      },dispose:endpoint.dispose}
  }
  return {subscribe,publish(sessionId:string,packet:AuthorNativeLifecyclePacketV1){
    for(const receiver of sessions.get(sessionId)??[])receiver.push(packet)
  },dispose(){for(const receivers of [...sessions.values()])for(const receiver of [...receivers])receiver.dispose()}}
}
export type AuthorNativeLifecyclePublisher=ReturnType<typeof createAuthorNativeLifecyclePublisher>
