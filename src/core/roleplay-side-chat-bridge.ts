export type SideChatBridge = {toolsFor(sessionId:string):readonly unknown[];prompt(agent:unknown):string;
  finishTools(sessionId:string):void;
  onToolsChanged(listener:(sessionId:string)=>void):()=>void;
  owns(sessionId:string):boolean;
  onBinding(listener:(change:{oldSideSessionId:string|null;newSideSessionId:string})=>void):()=>void}

type BridgeState={published:SideChatBridge|null;receiver:((bridge:SideChatBridge)=>()=>void)|null;
  dispose:(()=>void)|null}
// Host UI and Roleplay Core are delivered in different packages. Their module
// copies share one process realm, so the registration state must not live in a
// package-local module instance.
const registry=globalThis as unknown as Record<symbol,BridgeState|undefined>
const state=registry[Symbol.for('dsh.nexttavern.side-chat-bridge.v1')]??=
  {published:null,receiver:null,dispose:null}

const connectBridge=()=>{
  state.dispose?.()
  state.dispose=state.published&&state.receiver?state.receiver(state.published):null
}

/** The Host shell owns registration; Roleplay Core supplies the owner-backed definitions. */
export function receiveSideChatBridge(receiver:(bridge:SideChatBridge)=>()=>void) {
  state.receiver=receiver
  connectBridge()
  return ()=>{if(state.receiver===receiver){state.receiver=null;connectBridge()}}
}

export function publishSideChatBridge(bridge:SideChatBridge) {
  state.published=bridge
  connectBridge()
  return ()=>{if(state.published===bridge){state.published=null;connectBridge()}}
}
