/** Exact typed local status display/control DATA for namespace classification.
 * Source/trigger declarations and completion flags confer no Native execution right. */
import {types} from 'node:util'
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import type {StatusSession,StatusTable} from './roleplay-status-types.js'

type Data=Readonly<Record<string,unknown>>
export interface StatusControlRowFactV1 {
  readonly table:'status'
  readonly key:string
  readonly kind:'status-turn'|'status-panel'
  readonly family:'status-control'
  readonly evidenceKind:'typed-local-control-data'
  readonly value:Data
  readonly sha256:string
}
export interface StatusControlFactsReadV1 {
  readonly rows:readonly StatusControlRowFactV1[]
  readonly evidence:Data
  assertCurrent():void
}
export interface StatusControlFactsDependenciesV1 {
  readonly table:Pick<StatusTable,'get'|'entries'>
  readonly sessionForRowFacts:((id:string)=>StatusSession|null|undefined)|undefined
  /** Owner disposal/dependency identity only; never a Source/live scope check. */
  readonly assertOwnerAvailable:()=>void
}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
// The status producer hashes an absent spec as this exact persisted marker.
// Only that unbound spec version admits it; Native/source hashes remain SHAs.
const specHash=(value:unknown):value is string=>value==='missing'||hash(value)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=min&&!Object.is(value,-0)
const text=(value:unknown,max=2_097_152):value is string=>typeof value==='string'&&Buffer.byteLength(value,'utf8')<=max
const display=(value:unknown)=>value===null||typeof value==='boolean'||text(value)||typeof value==='number'&&Number.isFinite(value)
  &&Math.abs(value)<=Number.MAX_SAFE_INTEGER&&!Object.is(value,-0)
function fail(code='STATUS_CONTROL_ROW_UNPROVEN'):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function exact(value:unknown,required:readonly string[],optional:readonly string[]=[]):asserts value is Record<string,unknown> {
  if(!object(value)||required.some(key=>!Object.hasOwn(value,key))
    ||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('STATUS_CONTROL_SCHEMA_INVALID')
}
function sameData(actual:unknown,expected:unknown):boolean {
  if(Object.is(actual,expected))return true
  if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object'
    ||types.isProxy(actual)||types.isProxy(expected)||Array.isArray(actual)!==Array.isArray(expected))return false
  if(Array.isArray(actual)?Object.getPrototypeOf(actual)!==Array.prototype
    :![Object.prototype,null].includes(Object.getPrototypeOf(actual)))return false
  const a=Object.getOwnPropertyDescriptors(actual),b=Object.getOwnPropertyDescriptors(expected),
    left=Reflect.ownKeys(actual),right=Reflect.ownKeys(expected)
  return left.length===right.length&&left.every(key=>typeof key==='string'&&right.includes(key))&&right.every(key=>{
    if(typeof key!=='string')return false
    const x=a[key],y=b[key]
    return !!x&&!!y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&x.enumerable===y.enumerable
      &&sameData(x.value,y.value)
  })
}
function strictData(raw:unknown,budget?:{bytes:number;nodes:number}):unknown {
  const value=cloneRoleplayTavernLoreDataV1(raw,16_777_216,{nodes:131072,depth:66},budget)
  if(!sameData(raw,value))fail('STATUS_CONTROL_ROW_SPELLING_INVALID')
  return freeze(value)
}
function source(raw:unknown,prior=false):Data {
  exact(raw,['branchId','turnId','assistantSeq','sourceSeqs','sourceHash'],prior?['historyHash','validation']:[])
  if(!id(raw['branchId'])||!integer(raw['turnId'],1)||!integer(raw['assistantSeq'])||!hash(raw['sourceHash'])
    ||!Array.isArray(raw['sourceSeqs'])||raw['sourceSeqs'].length!==2
    ||!raw['sourceSeqs'].every(value=>integer(value))||raw['sourceSeqs'][1]!==raw['assistantSeq']
    ||Number(raw['sourceSeqs'][0])>=Number(raw['assistantSeq']))fail('STATUS_CONTROL_SOURCE_INVALID')
  if(prior&&(!hash(raw['historyHash'])||!['history-hash','original-append-prefix'].includes(String(raw['validation'])))) {
    fail('STATUS_CONTROL_SOURCE_INVALID')
  }
  return raw
}
function route(raw:unknown):void {
  exact(raw,['provider','model'],['reasoningEffort'])
  if(!text(raw['provider'],512)||!raw['provider']||!text(raw['model'],512)||!raw['model']
    ||Object.hasOwn(raw,'reasoningEffort')&&!text(raw['reasoningEffort'],128))fail('STATUS_CONTROL_ROUTE_INVALID')
}
function selection(raw:unknown):void {
  exact(raw,['execution','main','actualRoute'],['policyRevision'])
  if(!['inline','spawn'].includes(String(raw['execution'])))fail('STATUS_CONTROL_ROUTE_INVALID')
  route(raw['main']);route(raw['actualRoute'])
  if(Object.hasOwn(raw,'policyRevision')) {
    exact(raw['policyRevision'],['global','session'])
    if(!integer(raw['policyRevision']['global'])||!integer(raw['policyRevision']['session']))fail('STATUS_CONTROL_ROUTE_INVALID')
  }
}
function panel(raw:unknown):Data {
  exact(raw,['title','html','fields','options','rawText'],['name','text','content','templateHtml'])
  if(!text(raw['title'])||!text(raw['html'])||!text(raw['rawText'])
    ||!Array.isArray(raw['fields'])||raw['fields'].length>4096
    ||!Array.isArray(raw['options'])||raw['options'].length>4)fail('STATUS_CONTROL_PANEL_INVALID')
  for(const key of ['name','text','content','templateHtml'])if(Object.hasOwn(raw,key)&&!display(raw[key])) {
    fail('STATUS_CONTROL_PANEL_INVALID')
  }
  for(const field of raw['fields']) {
    exact(field,['emoji','label','value'],['icon','name','title','key','reason','text','content','description','detail'])
    if(!text(field['emoji'])||!text(field['label'])||!text(field['value']))fail('STATUS_CONTROL_PANEL_INVALID')
    for(const [key,value] of Object.entries(field))if(!['emoji','label','value'].includes(key)&&!display(value)) {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
  }
  for(const option of raw['options']) {
    exact(option,['label','description','heart'],['text','value','reason','content','name','title','detail','desc'])
    if(!text(option['label'])||!text(option['description'])||typeof option['heart']!=='boolean') {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
    for(const [key,value] of Object.entries(option))if(!['label','description','heart'].includes(key)&&!display(value)) {
      fail('STATUS_CONTROL_PANEL_INVALID')
    }
  }
  return raw
}
function basis(raw:unknown):Data {
  exact(raw,['selectedHistoryHash','previousStatus','previousStatusSource'])
  if(!hash(raw['selectedHistoryHash'])||((raw['previousStatus']===null)!==(raw['previousStatusSource']===null))) {
    fail('STATUS_CONTROL_BASIS_INVALID')
  }
  if(raw['previousStatus']!==null){panel(raw['previousStatus']);source(raw['previousStatusSource'],true)}
  return raw
}
function provenance(raw:unknown):Data {
  exact(raw,['triggerId','sourceSeqs','sourceHash','specHash','fixedContextHash','storyContextHash','historyHash',
    'previousStatusSource','inputKind','templateKind','toolInputSeq'],['taskId','generation','actualRoute','execution'])
  for(const key of ['triggerId','sourceHash','specHash','fixedContextHash','storyContextHash','historyHash']) {
    if(!(key==='specHash'?specHash(raw[key]):hash(raw[key])))fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  if(!Array.isArray(raw['sourceSeqs'])||raw['sourceSeqs'].length!==2||!raw['sourceSeqs'].every(value=>integer(value))
    ||!['tool','worker'].includes(String(raw['inputKind']))||!['author','damaged','missing'].includes(String(raw['templateKind']))
    ||raw['toolInputSeq']!==null&&!integer(raw['toolInputSeq']))fail('STATUS_CONTROL_PROVENANCE_INVALID')
  if(raw['previousStatusSource']!==null)source(raw['previousStatusSource'],true)
  for(const key of ['taskId','generation'])if(Object.hasOwn(raw,key)&&(!text(raw[key],512)||!raw[key])) {
    fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  if(Object.hasOwn(raw,'actualRoute'))route(raw['actualRoute'])
  if(Object.hasOwn(raw,'execution')&&!['inline','spawn'].includes(String(raw['execution']))) {
    fail('STATUS_CONTROL_PROVENANCE_INVALID')
  }
  return raw
}
function result(raw:unknown,standalone:boolean):Data {
  exact(raw,['schemaVersion','sessionId','branchId','atSeq','turnId','time','panel','provenance'],
    standalone?['stale','invalidatedFromSeq','invalidatedAt']:[])
  if(raw['schemaVersion']!==1||!id(raw['sessionId'])||raw['branchId']!==raw['sessionId']
    ||!integer(raw['atSeq'])||!integer(raw['turnId'],1)||!integer(raw['time']))fail('STATUS_CONTROL_RESULT_INVALID')
  panel(raw['panel']);provenance(raw['provenance'])
  if(Object.hasOwn(raw,'stale')&&typeof raw['stale']!=='boolean')fail('STATUS_CONTROL_RESULT_INVALID')
  if(Object.hasOwn(raw,'invalidatedFromSeq')&&raw['invalidatedFromSeq']!==null&&!integer(raw['invalidatedFromSeq'])) {
    fail('STATUS_CONTROL_RESULT_INVALID')
  }
  if(Object.hasOwn(raw,'invalidatedAt')&&!integer(raw['invalidatedAt']))fail('STATUS_CONTROL_RESULT_INVALID')
  return raw
}
function obligation(raw:unknown,sid:string):Data {
  exact(raw,['schemaVersion','sessionId','branchId','trigger','source','state','attempt','updatedAt','error'],
    ['specHash','fixedContextHash','storyContextHash','inputBasis','selection','generationKey','startedAt','result',
      'publicationState','publicationError'])
  if(raw['schemaVersion']!==1||raw['sessionId']!==sid||raw['branchId']!==sid||!integer(raw['attempt'],1)
    ||!integer(raw['updatedAt'])||!['running','completed','waiting-main','retry','stale'].includes(String(raw['state']))
    ||raw['error']!==null&&!text(raw['error'],8192))fail('STATUS_CONTROL_OBLIGATION_INVALID')
  exact(raw['trigger'],['kind','id','via'])
  if(raw['trigger']['kind']!=='turn-end'||!hash(raw['trigger']['id'])||!text(raw['trigger']['via'],512)) {
    fail('STATUS_CONTROL_OBLIGATION_INVALID')
  }
  source(raw['source'])
  const completeBasis=['specHash','fixedContextHash','storyContextHash','inputBasis','selection','generationKey','startedAt']
  if(['running','completed','waiting-main'].includes(String(raw['state']))&&completeBasis.some(key=>!Object.hasOwn(raw,key))) {
    fail('STATUS_CONTROL_OBLIGATION_INVALID')
  }
  for(const key of ['specHash','fixedContextHash','storyContextHash']) {
    if(Object.hasOwn(raw,key)&&!(key==='specHash'?specHash(raw[key]):hash(raw[key])))fail()
  }
  if(Object.hasOwn(raw,'inputBasis'))basis(raw['inputBasis'])
  if(Object.hasOwn(raw,'selection'))selection(raw['selection'])
  if(Object.hasOwn(raw,'generationKey')&&raw['generationKey']!==null&&!text(raw['generationKey'],512))fail()
  if(Object.hasOwn(raw,'startedAt')&&!integer(raw['startedAt']))fail()
  if(Object.hasOwn(raw,'publicationState')
    &&!['pending','published','superseded','retry'].includes(String(raw['publicationState'])))fail()
  if(Object.hasOwn(raw,'publicationError')&&raw['publicationError']!==null&&!text(raw['publicationError'],8192))fail()
  if(raw['state']==='completed')result(raw['result'],false)
  else if(Object.hasOwn(raw,'result')&&raw['result']!==null)fail('STATUS_CONTROL_RESULT_INVALID')
  return raw
}
export function createRoleplayStatusControlFactsV1(deps:StatusControlFactsDependenciesV1) {
  const table=deps.table,get=table.get,entries=table.entries,lookup=deps.sessionForRowFacts,
    assertOwnerAvailable=deps.assertOwnerAvailable
  function readOwnedStatusControlFacts(session:StatusSession):StatusControlFactsReadV1 {
    if(!lookup)fail('STATUS_CONTROL_ACTUAL_READERS_REQUIRED')
    const sid=session.id
    const assertIdentity=()=>{
      assertOwnerAvailable()
      if(deps.table!==table||table.get!==get||table.entries!==entries||deps.sessionForRowFacts!==lookup
        ||deps.assertOwnerAvailable!==assertOwnerAvailable||lookup(sid)!==session||session.id!==sid||!id(sid)) {
        fail('STATUS_CONTROL_OWNER_CHANGED')
      }
    }
    assertIdentity()
    function namespace():Map<string,{value:unknown;sha256:string}> {
      const rows=new Map<string,{value:unknown;sha256:string}>(),budget={bytes:0,nodes:0}
      for(const [key,raw] of entries.call(table)) {
        if(typeof key!=='string'||!key.startsWith(sid+'__'))continue
        if(rows.size>=16_384||rows.has(key))fail('STATUS_CONTROL_NAMESPACE_LIMIT_OR_DUPLICATE')
        const value=strictData(raw,budget),actual=get.call(table,key)
        if(!sameData(actual,value)||recordSha256(actual)!==recordSha256(value))fail('STATUS_CONTROL_NAMESPACE_CHANGED')
        rows.set(key,{value,sha256:recordSha256(value)})
      }
      return rows
    }
    const rows=namespace(),facts:StatusControlRowFactV1[]=[]
    function bindResult(value:Data,rawSource:Data,triggerId:string):void {
      const proof=value['provenance'] as Data,origin=rawSource['branchId']
      if(value['atSeq']!==rawSource['assistantSeq']||value['turnId']!==rawSource['turnId']
        ||value['sessionId']!==sid&&value['sessionId']!==origin||proof['triggerId']!==triggerId
        ||proof['sourceHash']!==rawSource['sourceHash']||recordSha256(proof['sourceSeqs'])!==recordSha256(rawSource['sourceSeqs'])) {
        fail('STATUS_CONTROL_RESULT_SOURCE_UNPROVEN')
      }
    }
    for(const [key,row] of rows) {
      const suffix=key.slice(sid.length+2)
      if(suffix==='spec')continue
      if(!object(row.value))fail('STATUS_CONTROL_SCHEMA_INVALID')
      let value:Data,kind:StatusControlRowFactV1['kind']
      if(suffix==='panel') {
        value=result(row.value,true)
        const proof=value['provenance'] as Data,seqs=proof['sourceSeqs'] as readonly number[]
        if(value['sessionId']!==sid||value['branchId']!==sid||seqs[1]!==value['atSeq']||seqs[0]!>=seqs[1]!) {
          fail('STATUS_CONTROL_RESULT_SOURCE_UNPROVEN')
        }
        kind='status-panel'
      }else {
        const address=/^turn-([1-9][0-9]*)-(0|[1-9][0-9]*)$/.exec(suffix)
        if(!address)fail('STATUS_CONTROL_UNKNOWN_STATUS_KEY')
        value=obligation(row.value,sid)
        const rawSource=source(value['source'])
        if(Number(address[1])!==rawSource['turnId']||Number(address[2])!==rawSource['assistantSeq'])fail('STATUS_CONTROL_KEY_INVALID')
        const triggerId=sha256(`${rawSource['branchId']}:${rawSource['turnId']}:${rawSource['assistantSeq']}:${rawSource['sourceHash']}`)
        if((value['trigger'] as Data)['id']!==triggerId)fail('STATUS_CONTROL_TRIGGER_UNPROVEN')
        if(value['result']!==undefined&&value['result']!==null) {
          const output=value['result'] as Data,proof=output['provenance'] as Data
          bindResult(output,rawSource,triggerId)
          for(const field of ['specHash','fixedContextHash','storyContextHash'])if(proof[field]!==value[field])fail()
          if(proof['historyHash']!==(value['inputBasis'] as Data)['selectedHistoryHash'])fail('STATUS_CONTROL_BASIS_INVALID')
          if(recordSha256(proof['previousStatusSource'])
            !==recordSha256((value['inputBasis'] as Data)['previousStatusSource']))fail('STATUS_CONTROL_BASIS_INVALID')
        }
        kind='status-turn'
      }
      facts.push({table:'status',key,kind,family:'status-control',evidenceKind:'typed-local-control-data',value,sha256:row.sha256})
    }
    const assertCurrent=()=>{
      assertIdentity()
      const current=namespace()
      if(current.size!==rows.size||[...rows].some(([key,row])=>{
        const actual=current.get(key)
        return !actual||actual.sha256!==row.sha256||!sameData(actual.value,row.value)
      }))fail('STATUS_CONTROL_NAMESPACE_CHANGED')
      assertIdentity()
    }
    assertCurrent()
    return {rows:freeze(facts.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)),
      evidence:freeze({schemaVersion:1,encoding:'typed-local-status-control-row-facts-v1',authority:'consumer-data-only',
        sessionId:sid,rowRefs:facts.map(({key,sha256,kind,evidenceKind})=>({key,sha256,kind,evidenceKind}))}),assertCurrent}
  }
  return {readOwnedStatusControlFacts}
}
