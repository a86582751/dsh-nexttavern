/** One realm owns listener identity, ordering and retirement. The factory is
 * self-contained because Native pages receive it through bootstrap serialization. */
export interface AuthorNativeEventSubscription {stop():void}
export interface AuthorNativeEventHooks<T> {
  create(event:string,once:boolean):T
  positioned?(data:T,position:'normal'|'first'|'last'):T
  removed?(data:T):void
  beforeInvoke?(data:T):void
  report(error:unknown):void
}

export function createAuthorNativeEventOwner<T>(hooks:AuthorNativeEventHooks<T>) {
  interface Listener {event:string;callback:Function;once:boolean;data:T}
  interface Group {listeners:Map<Function,Listener>;order:Listener[]}
  const groups=new Map<string,Group>()
  let active=true
  function remove(event:string,callback:Function):void {
    const group=groups.get(event),row=group?.listeners.get(callback)
    if(!group||!row)return
    group.listeners.delete(callback)
    group.order.splice(group.order.indexOf(row),1)
    if(!group.order.length)groups.delete(event)
    hooks.removed?.(row.data)
  }
  function subscribe(event:string,callback:Function,once:boolean,position:'normal'|'first'|'last')
    :AuthorNativeEventSubscription {
    if(!active)throw Error('AUTHOR_NATIVE_BINDING_REVOKED')
    let group=groups.get(event)
    if(!group){group={listeners:new Map(),order:[]};groups.set(event,group)}
    let row=group.listeners.get(callback)
    const existing=!!row
    if(!row) {
      row={event,callback,once,data:hooks.create(event,once)}
      group.listeners.set(callback,row)
    }
    if(!existing||position!=='normal') {
      if(existing)group.order.splice(group.order.indexOf(row),1)
      if(position==='first')group.order.unshift(row);else group.order.push(row)
      if(hooks.positioned)row.data=hooks.positioned(row.data,position)
    }
    return {stop:()=>remove(event,callback)}
  }
  const current=(row:Listener)=>active&&groups.get(row.event)?.listeners.get(row.callback)===row
  async function emit(event:string,args:readonly unknown[],selected?:(data:T)=>boolean):Promise<T[]> {
    const invoked:T[]=[]
    // Additions and moves affect the next emission. A removal cancels a
    // listener still waiting in this emission, including a once re-entry.
    for(const row of [...(groups.get(event)?.order??[])]) {
      if(!current(row)||selected&&!selected(row.data))continue
      const data=row.data
      if(row.once)remove(event,row.callback)
      invoked.push(data)
      try {hooks.beforeInvoke?.(data);await row.callback(...args)}catch(error){hooks.report(error)}
    }
    return invoked
  }
  function emitAndWait(event:string,args:readonly unknown[]):void {
    // This historical public name has a void, synchronous-start contract.
    // Promises continue independently, with their rejections still reported.
    for(const row of [...(groups.get(event)?.order??[])]) {
      if(!current(row))continue
      const data=row.data
      if(row.once)remove(event,row.callback)
      try {hooks.beforeInvoke?.(data);void Promise.resolve(row.callback(...args)).catch(hooks.report)}
      catch(error){hooks.report(error)}
    }
  }
  function clearEvent(event:string):void {
    for(const row of [...(groups.get(event)?.order??[])])remove(event,row.callback)
  }
  function clearListener(callback:Function):void {
    for(const event of [...groups.keys()])remove(event,callback)
  }
  function clearAll():void {for(const event of [...groups.keys()])clearEvent(event)}
  return {
    on:(event:string,callback:Function)=>subscribe(event,callback,false,'normal'),
    once:(event:string,callback:Function)=>subscribe(event,callback,true,'normal'),
    makeFirst:(event:string,callback:Function)=>subscribe(event,callback,false,'first'),
    makeLast:(event:string,callback:Function)=>subscribe(event,callback,false,'last'),
    remove,emit,emitAndWait,clearEvent,clearListener,clearAll,
    registrations:()=>[...groups.values()].flatMap(group=>group.order.map(row=>row.data)),
    dispose(){clearAll();active=false},
  }
}
