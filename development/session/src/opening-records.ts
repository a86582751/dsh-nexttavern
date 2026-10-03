/** Required no-player opening records. This module owns detached JSON shape
 * and the frozen canonical encoding, never Agent/phase execution authority. */
import type {NativeOpeningIdentityV1,NativeOpeningInvocationV1,NativeOpeningRequestAttemptV1,
  NativeGeneratedOpeningReceiptV1,NativeOpeningClosingAckV1,NativeOpeningEventRefV1,
  NativeOpeningRequestPublicationV1,NativeOpeningOutputRefV1} from './types.js'

export const NATIVE_OPENING_RECORD_BOUNDS_V1=Object.freeze({bytes:16_777_216,nodes:131_072,
  depth:64,steps:256,requests:256,outputs:256,toolEvents:4096,instructionBytes:65_536})
export class NativeOpeningRecordFailureV1 extends Error {
  constructor(readonly code:string) {super(code);this.name='NativeOpeningRecordFailureV1'}
}
function fail(code='OPENING_RECORD_INVALID'):never {throw new NativeOpeningRecordFailureV1(code)}
const utf8Bytes=(value:string)=>new TextEncoder().encode(value).byteLength
type Data=null|boolean|number|string|Data[]|{[key:string]:Data}
/** After Session's actual JSON snapshot, detach exact descriptors and bound
 * shape/size before hashing in Native. Native's Node wrapper separately rejects
 * proxies; this browser-safe shape parser does not issue that stronger claim. */
export function nativeOpeningDataV1(value:unknown):Data {
  let nodes=0,bytes=0
  const active=new WeakSet<object>()
  const charge=(size:number)=>{bytes+=size;if(bytes>NATIVE_OPENING_RECORD_BOUNDS_V1.bytes)fail('OPENING_RECORD_BUDGET')}
  function visit(input:unknown,depth:number):Data {
    if(++nodes>NATIVE_OPENING_RECORD_BOUNDS_V1.nodes||depth>NATIVE_OPENING_RECORD_BOUNDS_V1.depth)fail('OPENING_RECORD_BUDGET')
    if(input===null||typeof input==='boolean'){charge(5);return input}
    if(typeof input==='number') {
      if(!Number.isFinite(input)||Object.is(input,-0))fail()
      charge(32);return input
    }
    if(typeof input==='string'){if(!input.isWellFormed())fail();charge(utf8Bytes(input)+2);return input}
    if(typeof input!=='object'||active.has(input))return fail()
    active.add(input)
    try {
      if(Array.isArray(input)) {
        const keys=Reflect.ownKeys(input)
        if(keys.length!==input.length+1)return fail()
        const result:Data[]=[]
        for(let index=0;index<input.length;index++) {
          const descriptor=Object.getOwnPropertyDescriptor(input,String(index))
          if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)return fail()
          result.push(visit(descriptor.value,depth+1))
        }
        charge(2);return Object.freeze(result) as unknown as Data[]
      }
      const prototype=Object.getPrototypeOf(input)
      if(prototype!==Object.prototype&&prototype!==null)return fail()
      const result:Record<string,Data>=Object.create(null)
      for(const key of Reflect.ownKeys(input)) {
        if(typeof key!=='string'||key==='__proto__'||key==='constructor'||key==='prototype')return fail()
        const descriptor=Object.getOwnPropertyDescriptor(input,key)
        if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)return fail()
        charge(utf8Bytes(key)+3)
        result[key]=visit(descriptor.value,depth+1)
      }
      charge(2);return Object.freeze(result)
    }finally {active.delete(input)}
  }
  return visit(value,0)
}
/** native-opening-canonical-json-v1: lexically sorted object keys, array order,
 * ECMAScript JSON scalar spelling. Equal to Native's existing input digest for
 * already admitted JSON; it does not change the player's existing hash path. */
export function nativeOpeningCanonicalV1(data:Data):string {
  if(Array.isArray(data))return `[${data.map(nativeOpeningCanonicalV1).join(',')}]`
  if(data!==null&&typeof data==='object')return `{${Object.keys(data).sort()
    .map(key=>`${JSON.stringify(key)}:${nativeOpeningCanonicalV1(data[key]!)}`).join(',')}}`
  return JSON.stringify(data)
}
const same=(left:unknown,right:unknown)=>nativeOpeningCanonicalV1(nativeOpeningDataV1(left))
  ===nativeOpeningCanonicalV1(nativeOpeningDataV1(right))
const isObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
function exact(value:unknown,fields:readonly string[]):asserts value is Record<string,unknown> {
  if(!isObject(value)||Object.keys(value).length!==fields.length||fields.some(key=>!Object.hasOwn(value,key)))fail()
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const count=(value:unknown,positive=false):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=(positive?1:0)&&!Object.is(value,-0)
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256
  &&value===value.trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(value)
function eventRef(value:unknown):asserts value is NativeOpeningEventRefV1 {
  exact(value,['seq','sha256']);if(!count(value['seq'])||!hash(value['sha256']))fail()
}
function dataRef(value:unknown):void {
  exact(value,['key','sha256']);if(!id(value['key'])||!hash(value['sha256']))fail()
}
function identity(value:unknown):asserts value is NativeOpeningIdentityV1 {
  exact(value,['kind','sessionId','operationId','messageId','instruction','instructionSha256','intentRef'])
  if(value['kind']!=='programmatic-opening'||!id(value['sessionId'])||!id(value['operationId'])||!id(value['messageId'])
    ||typeof value['instruction']!=='string'||!value['instruction'].trim()
    ||utf8Bytes(value['instruction'])>NATIVE_OPENING_RECORD_BOUNDS_V1.instructionBytes
    ||!hash(value['instructionSha256']))fail()
  dataRef(value['intentRef'])
}
function recordShape(value:unknown,encoding:string,fields:readonly string[],hashKey:string):Record<string,unknown> {
  const data=nativeOpeningDataV1(value)
  exact(data,['schemaVersion','encoding',...fields,hashKey])
  if(data['schemaVersion']!==1||data['encoding']!==encoding||!hash(data[hashKey]))fail()
  // This browser-safe boundary admits the full shape after Session's actual
  // JSON snapshot. Native additionally verifies canonical hash and history.
  return data
}
export function validateNativeOpeningInvocationV1(value:unknown):NativeOpeningInvocationV1 {
  const data=recordShape(value,'native-programmatic-opening-invocation-v1',['identity','expectedTurn','prefix'],'invocationSha256')
  identity(data['identity']);exact(data['prefix'],['eventCount','inheritedEventCount','sha256'])
  if(!count(data['expectedTurn'],true)||!count(data['prefix']['eventCount'])
    ||!count(data['prefix']['inheritedEventCount'])||data['prefix']['inheritedEventCount']>data['prefix']['eventCount']
    ||!hash(data['prefix']['sha256']))fail()
  return data as unknown as NativeOpeningInvocationV1
}
export function validateNativeOpeningRequestAttemptV1(value:unknown):NativeOpeningRequestAttemptV1 {
  const data=recordShape(value,'native-programmatic-opening-request-attempt-v1',
    ['invocationRef','turn','step','attempt','assemblySha256','selectedSha256'],'attemptSha256')
  eventRef(data['invocationRef'])
  if(!count(data['turn'],true)||!count(data['step'],true)||!count(data['attempt'],true)
    ||data['step']>NATIVE_OPENING_RECORD_BOUNDS_V1.steps||data['attempt']>NATIVE_OPENING_RECORD_BOUNDS_V1.requests
    ||!hash(data['assemblySha256'])||!hash(data['selectedSha256']))fail()
  return data as unknown as NativeOpeningRequestAttemptV1
}
function publication(value:unknown):asserts value is NativeOpeningRequestPublicationV1 {
  exact(value,['attemptRef','materialRef','headerRef','configSha256','requestMessagesSha256','snapshot','plan'])
  eventRef(value['attemptRef']);eventRef(value['materialRef']);eventRef(value['headerRef'])
  dataRef(value['snapshot']);dataRef(value['plan'])
  if(!hash(value['configSha256'])||!hash(value['requestMessagesSha256'])
    ||value['attemptRef'].seq>=value['materialRef'].seq||value['headerRef'].seq>=value['materialRef'].seq)fail()
}
function output(value:unknown):asserts value is NativeOpeningOutputRefV1 {
  exact(value,['eventRef','messageId','messageSha256','textEncoding','textSha256','step']);eventRef(value['eventRef'])
  if(!id(value['messageId'])||!hash(value['messageSha256'])||!count(value['step'],true)
    ||value['textEncoding']!=='native-model-text-blocks-concat-v1'||!hash(value['textSha256']))fail()
}
export function validateNativeGeneratedOpeningReceiptV1(value:unknown):NativeGeneratedOpeningReceiptV1 {
  const data=recordShape(value,'native-generated-opening-receipt-v1',['production','invocationRef','identity','turn',
    'turnStartRef','turnEndRef','turnSpanSha256','invocationSpanSha256','steps','outputs',
    'requestedOutput','terminalOutput','toolEvents','flushed'],'receiptSha256')
  identity(data['identity']);eventRef(data['invocationRef']);eventRef(data['turnStartRef']);eventRef(data['turnEndRef'])
  if(data['production']!=='generated-opening'||data['flushed']!==true||!count(data['turn'],true)
    ||!hash(data['turnSpanSha256'])||!hash(data['invocationSpanSha256'])
    ||data['invocationRef'].seq>=data['turnStartRef'].seq||data['turnStartRef'].seq>=data['turnEndRef'].seq
    ||!Array.isArray(data['steps'])||!data['steps'].length||data['steps'].length>NATIVE_OPENING_RECORD_BOUNDS_V1.steps
    ||!Array.isArray(data['outputs'])||!data['outputs'].length||data['outputs'].length>NATIVE_OPENING_RECORD_BOUNDS_V1.outputs
    ||!Array.isArray(data['toolEvents'])||data['toolEvents'].length>NATIVE_OPENING_RECORD_BOUNDS_V1.toolEvents)fail()
  let requests=0,previousStepEnd=data['turnStartRef'].seq
  for(const [index,step] of data['steps'].entries()) {
    exact(step,['step','startRef','endRef','requests']);eventRef(step['startRef']);eventRef(step['endRef'])
    if(step['step']!==index+1||step['startRef'].seq<=previousStepEnd||step['endRef'].seq<=step['startRef'].seq
      ||step['endRef'].seq>=data['turnEndRef'].seq||!Array.isArray(step['requests'])||!step['requests'].length)fail()
    let prior=step['startRef'].seq
    for(const request of step['requests']) {
      publication(request)
      if(request.attemptRef.seq<=prior||request.materialRef.seq>=step['endRef'].seq)fail()
      prior=request.materialRef.seq
      if(++requests>NATIVE_OPENING_RECORD_BOUNDS_V1.requests)fail('OPENING_RECORD_BUDGET')
    }
    previousStepEnd=step['endRef'].seq
  }
  let previousOutput=data['turnStartRef'].seq
  const ids=new Set<string>()
  for(const value of data['outputs']) {
    output(value)
    if(value.eventRef.seq<=previousOutput||value.eventRef.seq>=data['turnEndRef'].seq||ids.has(value.messageId)
      ||value.step>data['steps'].length)fail()
    ids.add(value.messageId);previousOutput=value.eventRef.seq
  }
  output(data['requestedOutput']);output(data['terminalOutput'])
  if(data['requestedOutput'].messageId!==data['identity'].messageId||data['requestedOutput'].step!==1
    ||!data['outputs'].some(item=>same(item,data['requestedOutput']))
    ||!same(data['terminalOutput'],data['outputs'].at(-1)))fail()
  let previousTool=data['turnStartRef'].seq
  for(const tool of data['toolEvents']) {
    exact(tool,['type','eventRef']);eventRef(tool['eventRef'])
    if(tool['type']!=='tool/call'&&tool['type']!=='tool/result'||tool['eventRef'].seq<=previousTool
      ||tool['eventRef'].seq>=data['turnEndRef'].seq)fail()
    previousTool=tool['eventRef'].seq
  }
  return data as unknown as NativeGeneratedOpeningReceiptV1
}
export function validateNativeOpeningClosingAckV1(value:unknown):NativeOpeningClosingAckV1 {
  const data=recordShape(value,'native-programmatic-opening-closing-ack-v1',
    ['invocationRef','generatedReceiptRef','receiptSha256','ownerReceiptSha256'],'ackSha256')
  eventRef(data['invocationRef']);eventRef(data['generatedReceiptRef'])
  if(!hash(data['receiptSha256'])||!hash(data['ownerReceiptSha256'])
    ||data['generatedReceiptRef'].seq<=data['invocationRef'].seq)fail()
  return data as unknown as NativeOpeningClosingAckV1
}
export const NATIVE_OPENING_EVENT_TYPES_V1:ReadonlySet<string>=new Set([
  'opening/invocation','opening/request-attempt','opening/generated-receipt','opening/closing-ack'])
export function validateNativeOpeningSessionEventV1(type:string,data:unknown):void {
  switch(type) {
    case 'opening/invocation':validateNativeOpeningInvocationV1(data);return
    case 'opening/request-attempt':validateNativeOpeningRequestAttemptV1(data);return
    case 'opening/generated-receipt':validateNativeGeneratedOpeningReceiptV1(data);return
    case 'opening/closing-ack':validateNativeOpeningClosingAckV1(data);return
    default:return fail()
  }
}
