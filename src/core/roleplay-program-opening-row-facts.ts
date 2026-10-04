/** Initial admission of actual opening rows before Native parsing or hashing. */
import {types} from 'node:util'
const MAX_BYTES=16_777_216,MAX_NODES=131_072,MAX_DEPTH=66
function unsafe():never {throw Error('PROGRAM_OPENING_ROW_DATA_UNSAFE')}
/** Keep the original spelling for the record parser. This admission never
 * returns detached rows or retains a current-use permission. */
export function assertProgramOpeningRowDataDescriptorsV1(raw:unknown):void {
  if(raw===undefined)unsafe()
  let bytes=0,nodes=0
  const ancestors=new Set<object>()
  const charge=(count:number)=>{bytes+=count;if(bytes>MAX_BYTES)unsafe()}
  const quoted=(text:string)=>{
    if(Buffer.byteLength(text,'utf8')>MAX_BYTES-bytes)unsafe()
    charge(Buffer.byteLength(JSON.stringify(text),'utf8'))
  }
  function visit(value:unknown,depth:number):void {
    if(++nodes>MAX_NODES||depth>MAX_DEPTH)unsafe()
    if(value===undefined||value===null){charge(4);return}
    if(typeof value==='string'){quoted(value);return}
    if(typeof value==='boolean'){charge(value?4:5);return}
    if(typeof value==='number') {
      if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)unsafe()
      charge(Buffer.byteLength(JSON.stringify(value),'utf8'));return
    }
    if(!value||typeof value!=='object'||types.isProxy(value)||ancestors.has(value))unsafe()
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value)
    if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)unsafe()
    const keys=Reflect.ownKeys(value)
    if(keys.length>MAX_NODES-nodes+1||keys.some(key=>typeof key!=='string'))unsafe()
    const descriptors=Object.getOwnPropertyDescriptors(value)
    ancestors.add(value);charge(2)
    if(array) {
      const lengthDescriptor=descriptors.length,length=lengthDescriptor?.value
      if(!lengthDescriptor||!Object.hasOwn(lengthDescriptor,'value')||typeof length!=='number'
        ||!Number.isSafeInteger(length)||length<0||length>MAX_NODES||keys.length!==length+1)unsafe()
      for(let index=0;index<length;index++) {
        const descriptor=descriptors[String(index)]
        if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)unsafe()
        if(index)charge(1)
        visit(descriptor.value,depth+1)
      }
    }else {
      let fields=0
      for(const key of keys as string[]) {
        const descriptor=descriptors[key]!
        if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable
          ||['__proto__','prototype','constructor'].includes(key))unsafe()
        // Original JSON admission omits undefined object members; Native
        // grammar still receives the unchanged raw row and decides its fields.
        if(descriptor.value===undefined)continue
        if(fields++)charge(1)
        quoted(key);charge(1);visit(descriptor.value,depth+1)
      }
    }
    ancestors.delete(value)
  }
  visit(raw,0)
}
