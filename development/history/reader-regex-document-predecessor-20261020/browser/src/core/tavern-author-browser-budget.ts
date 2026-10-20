/** Browser-safe budget implementation. No Core parser, Node dependency, Source
 * verification, Native permission, or synchronous-JS termination claim. */
export const BROWSER_BUDGET_V1=Object.freeze({
  outputBytes:16*1048576,snapshotBytes:64*1048576,transportBytes:64*1048576,
  authorNodes:10_000,jsonDepth:128,serializationVisits:2_000_000,
})
export class BrowserBudgetError extends Error {
  constructor(readonly code:string) {super(code);this.name='BrowserBudgetError'}
}
function deny(code:string):never {throw new BrowserBudgetError(code)}
const primitive=(value:unknown):value is string|number|boolean|null|undefined=>
  value===null||['string','number','boolean','undefined'].includes(typeof value)

/** Counts UTF-8 before an allocation. The early length floor avoids traversing
 * a borrowed 64 MiB snapshot string when the remaining output is already small. */
export function browserUtf8Bytes(value:string,limit:number):number {
  if(value.length>limit)deny('BROWSER_TEXT_BUDGET')
  let bytes=0
  for(let index=0;index<value.length;index++) {
    const code=value.charCodeAt(index)
    if(code<128)bytes++
    else if(code<2048)bytes+=2
    else if(code>=0xd800&&code<=0xdbff&&index+1<value.length
      &&value.charCodeAt(index+1)>=0xdc00&&value.charCodeAt(index+1)<=0xdfff) {bytes+=4;index++}
    else bytes+=3
    if(bytes>limit)deny('BROWSER_TEXT_BUDGET')
  }
  return bytes
}

interface Sink {put(value:string):void;bytes:number}
function outputSink(limit:number,collect:boolean):Sink&{result():string} {
  let bytes=0,chunk='',chunks:string[]=[]
  return {
    get bytes(){return bytes},
    put(value) {
      bytes+=browserUtf8Bytes(value,limit-bytes)
      if(!collect)return
      // Native concatenation is confined to this already measured small chunk.
      if(chunk.length+value.length>8192) {if(chunk)chunks.push(chunk);chunk=''}
      if(value.length>8192)chunks.push(value)
      else chunk+=value
    },
    result(){if(chunk)chunks.push(chunk);chunk='';const result=chunks.join('');chunks=[];return result},
  }
}
function quoted(value:string,sink:Sink):void {
  // Every JSON escape is emitted under the remaining bound; a full native JSON
  // string is never produced before checking its size.
  sink.put('"')
  let start=0
  for(let index=0;index<value.length;index++) {
    const code=value.charCodeAt(index)
    let escape:string|undefined
    if(code===34)escape='\\"'
    else if(code===92)escape='\\\\'
    else if(code===8)escape='\\b'
    else if(code===9)escape='\\t'
    else if(code===10)escape='\\n'
    else if(code===12)escape='\\f'
    else if(code===13)escape='\\r'
    else if(code<32)escape='\\u'+code.toString(16).padStart(4,'0')
    else if(code>=0xd800&&code<=0xdbff) {
      const next=value.charCodeAt(index+1)
      if(next>=0xdc00&&next<=0xdfff) {index++;continue}
      escape='\\u'+code.toString(16)
    }else if(code>=0xdc00&&code<=0xdfff)escape='\\u'+code.toString(16)
    if(escape) {
      if(index>start)sink.put(value.slice(start,index))
      sink.put(escape);start=index+1
    }else if(index-start>=4096) {sink.put(value.slice(start,index+1));start=index+1}
  }
  if(start<value.length)sink.put(value.slice(start))
  sink.put('"')
}
type Container={value:Record<string,unknown>|unknown[];keys:readonly string[]|null;index:number;first:boolean}
/** Supported JSON.stringify(value), including property order, undefined
 * omission and array nulls. Expanded DAG occurrences consume work/output every
 * time. No replacer, user toJSON callback, native unbounded stringify, or join. */
function serialize(value:unknown,limit:number,collect:boolean,wire:boolean):{text:string|undefined;bytes:number} {
  const sink=outputSink(limit,collect),ancestors=new Set<object>(),stack:Container[]=[]
  let visits=0,current=value,hasCurrent=true,top=true
  const omitted=(item:unknown)=>item===undefined||typeof item==='function'||typeof item==='symbol'
  if(omitted(current)) {
    if(wire)deny('BROWSER_TRANSPORT_DATA_UNSUPPORTED')
    return {text:undefined,bytes:0}
  }
  while(hasCurrent||stack.length) {
    if(hasCurrent) {
      hasCurrent=false
      if(++visits>BROWSER_BUDGET_V1.serializationVisits)deny('BROWSER_SERIALIZATION_WORK_BUDGET')
      if(typeof current==='string')quoted(current,sink)
      else if(typeof current==='number') {
        // Author JSON output follows stringify's null conversion. Save wire
        // data must not silently rewrite a non-JSON number before Core sees it.
        if(wire&&!Number.isFinite(current))deny('BROWSER_TRANSPORT_DATA_UNSUPPORTED')
        sink.put(Number.isFinite(current)?String(current):'null')
      }
      else if(typeof current==='boolean')sink.put(current?'true':'false')
      else if(current===null||omitted(current)) {
        if(wire&&omitted(current))deny('BROWSER_TRANSPORT_DATA_UNSUPPORTED')
        sink.put('null')
      }else if(typeof current==='object') {
        if(ancestors.has(current))deny('BROWSER_JSON_CYCLE_UNSUPPORTED')
        if(stack.length>=BROWSER_BUDGET_V1.jsonDepth)deny('BROWSER_JSON_DEPTH_BUDGET')
        if(typeof (current as {toJSON?:unknown}).toJSON==='function')deny('BROWSER_JSON_CALLBACK_UNSUPPORTED')
        const array=Array.isArray(current)
        // Even a sparse array has this many JSON entries. Deny its expansion
        // before walking holes; assigning a large index cannot evade the bound.
        if(Array.isArray(current)&&current.length>limit-sink.bytes)deny('BROWSER_TEXT_BUDGET')
        sink.put(array?'[':'{');ancestors.add(current)
        stack.push({value:current as Record<string,unknown>|unknown[],keys:array?null:Object.keys(current),index:0,first:true})
      }else deny('BROWSER_TRANSPORT_DATA_UNSUPPORTED')
      top=false
    }
    if(!stack.length)break
    const held=stack[stack.length-1]!
    if(held.index>=(held.keys?.length??(held.value as unknown[]).length)) {
      sink.put(held.keys?'}':']');ancestors.delete(held.value);stack.pop();continue
    }
    const key=held.keys?held.keys[held.index++]!:String(held.index++)
    const next=(held.value as Record<string,unknown>)[key]
    if(held.keys&&omitted(next)) {
      if(wire)deny('BROWSER_TRANSPORT_DATA_UNSUPPORTED')
      continue
    }
    if(!held.first)sink.put(',')
    held.first=false
    if(held.keys) {quoted(key,sink);sink.put(':')}
    current=next;hasCurrent=true
  }
  return {text:collect?sink.result():top?undefined:'',bytes:sink.bytes}
}

/** Quantifies the actual expanded transport before postMessage makes its
 * structured clone. Core remains the owner of numerical business limits. */
export function quantifyBrowserTransport(value:unknown,limit=BROWSER_BUDGET_V1.transportBytes):number {
  return serialize(value,limit,false,true).bytes
}
export function freezeBrowserSnapshot<T>(value:T):T {
  const pending:unknown[]=[value],seen=new Set<object>()
  while(pending.length) {
    const item=pending.pop()
    if(!item||typeof item!=='object'||seen.has(item))continue
    seen.add(item);Object.freeze(item)
    for(const child of Object.values(item))pending.push(child)
  }
  return value
}

export class BrowserBudgetV1 {
  private outputBytes=0
  private domBytes=0
  private nodes=0
  private numericalValues=new WeakSet<object>()
  registerNumericalValues(value:object):void {this.numericalValues.add(value)}
  private spend(bytes:number):void {
    if(bytes>BROWSER_BUDGET_V1.outputBytes-this.outputBytes)deny('BROWSER_OUTPUT_BUDGET')
    this.outputBytes+=bytes
  }
  /** Lifetime output is cumulative across startup and callbacks. This avoids
   * resetting a shared budget while another real save Promise is outstanding. */
  add(left:unknown,right:unknown):string|number {
    if(!primitive(left)||!primitive(right))deny('BROWSER_PRIMITIVE_CONVERSION_UNSUPPORTED')
    if(typeof left==='string'||typeof right==='string') {
      const a=String(left),b=String(right),remaining=BROWSER_BUDGET_V1.outputBytes-this.outputBytes
      const leftBytes=browserUtf8Bytes(a,remaining)
      const bytes=leftBytes+browserUtf8Bytes(b,remaining-leftBytes)
      this.spend(bytes)
      return a+b
    }
    return Number(left)+Number(right)
  }
  string(value:unknown):string {
    if(!primitive(value))deny('BROWSER_PRIMITIVE_CONVERSION_UNSUPPORTED')
    const result=String(value)
    this.spend(browserUtf8Bytes(result,BROWSER_BUDGET_V1.outputBytes-this.outputBytes))
    return result
  }
  number(value:unknown):number {
    if(!primitive(value))deny('BROWSER_PRIMITIVE_CONVERSION_UNSUPPORTED')
    if(typeof value==='string')this.spend(browserUtf8Bytes(value,BROWSER_BUDGET_V1.outputBytes-this.outputBytes))
    return Number(value)
  }
  stringify(value:unknown):string|undefined {
    const result=serialize(value,BROWSER_BUDGET_V1.outputBytes-this.outputBytes,true,false)
    this.spend(result.bytes);return result.text
  }
  copyNumericalValues(value:unknown):Record<string,unknown> {
    if(!value||typeof value!=='object'||!this.numericalValues.has(value))deny('BROWSER_NUMERICAL_SPREAD_UNSUPPORTED')
    // Quantification bounds the subsequent shallow key/value allocation, while
    // reusing the already proven immutable nested numerical values.
    this.spend(quantifyBrowserTransport(value,BROWSER_BUDGET_V1.outputBytes-this.outputBytes))
    const result:Record<string,unknown>={}
    for(const key of Object.keys(value))Object.defineProperty(result,key,{value:(value as Record<string,unknown>)[key],
      enumerable:true,writable:true,configurable:true})
    return result
  }
  createNode():void {
    if(++this.nodes>BROWSER_BUDGET_V1.authorNodes)deny('BROWSER_DOM_NODE_BUDGET')
  }
  domText(value:string,previousBytes=0):number {
    const bytes=browserUtf8Bytes(value,BROWSER_BUDGET_V1.outputBytes)
    if(this.domBytes-previousBytes+bytes>BROWSER_BUDGET_V1.outputBytes)deny('BROWSER_DOM_TEXT_BUDGET')
    this.spend(bytes);this.domBytes=this.domBytes-previousBytes+bytes;return bytes
  }
}

