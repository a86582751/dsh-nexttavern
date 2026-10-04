/** Current legacy branch control DTOs associated with actual Native history.
 * The wrapper has a schema; the old stored rows are neither rewritten nor
 * promoted to authentic writer, completion, readiness or scheduling proof. */
import {types} from 'node:util'
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import {foldSurface,deriveEventMessage} from '@deepseek-ai/dsh-session'
import type {Session,SessionEvent,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {recordSha256,textOf} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'

type Row=Readonly<Record<string,unknown>>
interface TableV1 {get(key:string):unknown;entries():Iterable<[string,unknown]>}
export type ProgramAbsenceBranchControlKindV1='phase-b'|'task-steering'|'maintenance-timing'
export interface ProgramAbsenceBranchControlRowFactV1 {
  readonly schemaVersion:1
  readonly table:'branch'
  readonly key:string
  readonly value:Row
  readonly sha256:string
  readonly family:'branch-control'
  readonly kind:ProgramAbsenceBranchControlKindV1
  readonly evidenceKind:'native-associated-typed-local-data'
  readonly evidenceGrade:'strict-control-dto-with-native-turn-association'
  readonly nativeAssociatedFields:readonly string[]
  readonly unboundControlFields:readonly string[]
  readonly nativeAssociation:{readonly turn:number;readonly startSeq:number;readonly endSeq:number;
    readonly assistantSeq:number;readonly assistantEventSha256:string;readonly assistantMessageSha256:string;
    readonly assistantSurface:'current-node'|'retained-historical-node';readonly inheritedEventCount:number}
  readonly wholeRowWriterProvenance:'not-proven'
  readonly completionEvidence:'not-checked'
  readonly executionAuthority:'none'
}
export interface ProgramAbsenceBranchControlFactsDependenciesV1 {
  readonly tables:Record<'branch'|'status',TableV1>
  readonly session:(id:string)=>Session|undefined
  /** The actual owner throws while history is unavailable. No synthesized
   * empty history, renamed ancestor or detached Session is accepted. */
  readonly events:(session:Session)=>readonly SessionEvent[]
  readonly projections:()=>readonly SessionMessageProjection[]
}
export interface ProgramAbsenceBranchControlEvidenceV1 {
  readonly schemaVersion:1
  readonly encoding:'native-associated-branch-control-facts-v1'
  readonly authority:'consumer-data-only'
  readonly evidenceKind:'native-associated-typed-local-data'
  readonly sessionId:string
  readonly history:{readonly eventCount:number;readonly inheritedEventCount:number;readonly sha256:string}
  /** Consumed control candidates only. This is not a complete absence
   * namespace; the final Inventory owns unrelated branch/status bodies. */
  readonly namespace:{readonly table:'branch'|'status';readonly key:string;readonly sha256:string}[]
  readonly coveredKinds:readonly ProgramAbsenceBranchControlKindV1[]
  readonly unsupportedMutableRows:readonly {readonly table:'branch';readonly key:string;
    readonly sha256:string;readonly kind:'task-preparation'|'context-window';
    readonly reason:'requires-native-bound-field-contract'}[]
  readonly wholeRowWriterProvenance:'not-proven'
  readonly executionAuthority:'none'
}
interface NamespaceRowV1 {readonly table:'branch'|'status';readonly key:string;readonly value:unknown;readonly sha256:string}
interface ProjectionPinV1 {readonly definition:SessionMessageProjection;
  readonly type:string;readonly project:SessionMessageProjection['project']}
function fail(code:string):never {throw Error(code)}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const integer=(value:unknown,minimum=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=minimum&&!Object.is(value,-0)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function exact(value:unknown,required:readonly string[],optional:readonly string[]=[]):asserts value is Record<string,unknown> {
  if(!object(value)||required.some(key=>!Object.hasOwn(value,key))
    ||Object.keys(value).some(key=>!required.includes(key)&&!optional.includes(key)))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_SCHEMA_INVALID')
}
/** The shared bounded clone checks descriptors/proxies before reading values.
 * Complete own-data comparison then rejects its normalization aliases: omitted
 * undefined, -0, holes or any extra own key cannot equal the detached spelling. */
function sameData(actual:unknown,expected:unknown):boolean {
  if(Object.is(actual,expected))return true
  if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object'
    ||types.isProxy(actual)||types.isProxy(expected)||Array.isArray(actual)!==Array.isArray(expected))return false
  if(Array.isArray(actual)?Object.getPrototypeOf(actual)!==Array.prototype
    :![Object.prototype,null].includes(Object.getPrototypeOf(actual)))return false
  const left=Reflect.ownKeys(actual),right=Reflect.ownKeys(expected)
  if(left.length!==right.length||left.some(key=>typeof key!=='string'))return false
  const a=Object.getOwnPropertyDescriptors(actual),b=Object.getOwnPropertyDescriptors(expected)
  return right.every(key=>{
    if(typeof key!=='string'||!Object.hasOwn(a,key))return false
    const x=a[key],y=b[key]
    return !!x&&!!y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&x.enumerable===y.enumerable
      &&sameData(x.value,y.value)
  })
}
function strictData(raw:unknown,budget?:{bytes:number;nodes:number}):unknown {
  const detached=cloneRoleplayTavernLoreDataV1(raw,16_777_216,{nodes:131072,depth:66},budget)
  if(!sameData(raw,detached))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ROW_SPELLING_INVALID')
  return freeze(detached)
}
function namespaceEntry(entry:unknown):{key:string;raw:unknown} {
  if(!entry||typeof entry!=='object'||types.isProxy(entry)||!Array.isArray(entry)) {
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_INVALID')
  }
  const descriptors=Object.getOwnPropertyDescriptors(entry),length=Object.getOwnPropertyDescriptor(entry,'length'),
    keyValue=descriptors['0'],rawValue=descriptors['1']
  if(Reflect.ownKeys(entry).length!==3||!length||!Object.hasOwn(length,'value')||length.value!==2
    ||!keyValue||!rawValue||!Object.hasOwn(keyValue,'value')||!Object.hasOwn(rawValue,'value')
    ||!keyValue.enumerable||!rawValue.enumerable||typeof keyValue.value!=='string') {
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_INVALID')
  }
  return {key:keyValue.value as string,raw:rawValue.value}
}
function controlCandidate(table:'branch'|'status',key:string,sessionId:string):boolean {
  if(table!=='branch'||!key.startsWith(sessionId+'__'))return false
  const suffix=key.slice(sessionId.length+2)
  return suffix==='task-preparation'||suffix==='context-window'||suffix.startsWith('phaseb-')
    ||suffix.startsWith('task-steering-')||suffix.startsWith('maintenance-timing-')
}
function projectionPin(definition:SessionMessageProjection):ProjectionPinV1 {
  if(!object(definition)||types.isProxy(definition)
    ||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
  const descriptors=Object.getOwnPropertyDescriptors(definition),type=descriptors['type'],project=descriptors['project']
  if(Reflect.ownKeys(definition).length!==2||!type||!project||!type.enumerable||!project.enumerable
    ||!Object.hasOwn(type,'value')||!Object.hasOwn(project,'value')||typeof type.value!=='string'||!type.value
    ||typeof project.value!=='function'||types.isProxy(project.value))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
  return {definition,type:type.value,project:project.value}
}
function projectionList(raw:readonly SessionMessageProjection[]):readonly SessionMessageProjection[] {
  if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Array.isArray(raw)||Object.getPrototypeOf(raw)!==Array.prototype)
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
  const descriptors=Object.getOwnPropertyDescriptors(raw),length=Object.getOwnPropertyDescriptor(raw,'length'),
    result:SessionMessageProjection[]=[]
  if(!length||!Object.hasOwn(length,'value')||!integer(length.value)||length.value>16_384
    ||Reflect.ownKeys(raw).length!==length.value+1)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
  for(let index=0;index<length.value;index++) {
    const descriptor=descriptors[String(index)]
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)
      fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
    result.push(descriptor.value)
  }
  return result
}
function turnFromKey(suffix:string,prefix:string):number {
  const spelling=suffix.slice(prefix.length)
  if(!/^[1-9]\d{0,15}$/.test(spelling))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ADDRESS_INVALID')
  const turn=Number(spelling)
  if(!integer(turn,1)||String(turn)!==spelling)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ADDRESS_INVALID')
  return turn
}
function phaseB(value:unknown,sid:string,turn:number):Row {
  exact(value,['state','turnId','assistantSeq','sessionId','startedAt','attempt'],
    ['memoryMode','completedAt','error','failedAt'])
  if(value['sessionId']!==sid||value['turnId']!==turn||!integer(value['assistantSeq'])||!integer(value['startedAt'])
    ||!integer(value['attempt'],1)||!['running','completed','waiting-main','retry'].includes(String(value['state'])))
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID')
  if(value['memoryMode']!==undefined&&!['background-notes','foreground-ledger'].includes(String(value['memoryMode'])))
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID')
  for(const field of ['completedAt','failedAt'])if(value[field]!==undefined&&!integer(value[field]))
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID')
  if(value['error']!==undefined&&value['error']!==null&&(typeof value['error']!=='string'||value['error'].length>500))
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID')
  if(value['state']==='completed'&&(!integer(value['completedAt'])||value['error']!==null||!value['memoryMode'])
    ||value['state']==='waiting-main'&&value['error']!==null
    ||value['state']==='retry'&&(!integer(value['failedAt'])||typeof value['error']!=='string'))
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID')
  return value
}
function steering(value:unknown,sid:string,turn:number):Row {
  exact(value,['schemaVersion','sessionId','turn','fingerprint','attempt','source'])
  if(value['schemaVersion']!==1||value['sessionId']!==sid||value['turn']!==turn||!hash(value['fingerprint'])
    ||!integer(value['attempt'],1)||!Array.isArray(value['source'])||value['source'].length>4096
    ||!value['source'].every(id)||new Set(value['source']).size!==value['source'].length)
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_STEERING_INVALID')
  return value
}
const timingStages=Object.freeze(['enter','workflows-resumed','story-selected','status-admitted','decision-admitted',
  'status-ready-or-inline','decision-ready-or-inline','phase-bc-ready','maintenance-steered','finished'])
function timing(value:unknown,sid:string,turn:number):Row {
  exact(value,['schemaVersion','sessionId','turn','updatedAt','samples'])
  if(value['schemaVersion']!==1||value['sessionId']!==sid||value['turn']!==turn||!integer(value['updatedAt'])
    ||!Array.isArray(value['samples'])||!value['samples'].length||value['samples'].length>64)
    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TIMING_INVALID')
  for(const sample of value['samples']) {
    exact(sample,['stage','wallAt','elapsedMs','deltaMs'])
    if(typeof sample['stage']!=='string'||!timingStages.includes(sample['stage'])||!integer(sample['wallAt'])
      ||!integer(sample['elapsedMs'])||!integer(sample['deltaMs']))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TIMING_INVALID')
  }
  return value
}
/** Root supplies original actual lookup/history/projection functions once.
 * Key enumeration finds all control candidates, including prefix aliases.
 * Only those dependencies receive strict DATA/current checks; the separate
 * final absence Inventory checks all other actual branch/status bodies. */
export function createRoleplayProgramAbsenceBranchControlsV1(deps:ProgramAbsenceBranchControlFactsDependenciesV1) {
  const tables=deps.tables,lookup=deps.session,readEvents=deps.events,readProjections=deps.projections,
    tableObjects={branch:tables.branch,status:tables.status},
    methods={branch:{get:tables.branch.get,entries:tables.branch.entries},status:{get:tables.status.get,entries:tables.status.entries}}
  function capture(session:Session) {
    const sid=session.id
    const assertIdentity=()=>{
      if(deps.tables!==tables||deps.session!==lookup||deps.events!==readEvents||deps.projections!==readProjections
        ||!id(sid)||session.id!==sid||lookup(sid)!==session)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_SESSION_CHANGED')
      for(const table of ['branch','status'] as const)if(tables[table]!==tableObjects[table]
        ||tableObjects[table].get!==methods[table].get||tableObjects[table].entries!==methods[table].entries)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_CHANGED')
    }
    assertIdentity()
    const events=readEvents(session),projections=projectionList(readProjections()),pins=projections.map(projectionPin),
      cursor=Number(session.seq),birth=Number(session.inheritedEventCount),header=session.header,
      headerSha256=nativeInputSha256(header)
    if(!Array.isArray(events)||types.isProxy(events)||!integer(cursor)||!integer(birth)||birth>cursor||events.length!==cursor
      ||events.some((event,index)=>!integer(event.seq)||Number(event.seq)!==index)
      ||(header.parentSession===undefined||header.parentSession===null?birth!==0:!id(header.parentSession)||header.parentSession===sid))
      fail('PROGRAM_ABSENCE_BRANCH_CONTROL_HISTORY_UNAVAILABLE')
    const historySha256=nativeInputSha256(events)
    if(new Set(pins.map(pin=>pin.type)).size!==pins.length)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED')
    const namespace=()=>{
      const rows=new Map<string,NamespaceRowV1>(),budget={bytes:0,nodes:0}
      for(const table of ['branch','status'] as const)for(const entry of methods[table].entries.call(tableObjects[table])) {
        const {key,raw}=namespaceEntry(entry)
        if(!controlCandidate(table,key,sid))continue
        const address=table+':'+key
        if(rows.has(address)||rows.size>=16_384)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_BUDGET_OR_DUPLICATE')
        const value=strictData(raw,budget),actual=methods[table].get.call(tableObjects[table],key)
        // Complete descriptor/data equality proves the same canonical SHA.
        // Hash only the accepted bounded, detached spelling saved below.
        if(!sameData(actual,value))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_CHANGED')
        rows.set(address,{table,key,value,sha256:recordSha256(value)})
      }
      return rows
    }
    const namespaceRows=namespace()
    function changedNamespace():never {
      // Preserve the original strict spelling/budget diagnostics on failure.
      // A callback may restore the row during this diagnostic scan; it cannot
      // rescue the original comparison which already observed a mismatch.
      namespace()
      return fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_CHANGED')
    }
    function assertNamespaceCurrent():void {
      const seen=new Set<string>()
      for(const table of ['branch','status'] as const)for(const entry of methods[table].entries.call(tableObjects[table])) {
        // Validate every supplied tuple before foreign/candidate filtering.
        // Unrelated body bytes belong to the final absence Inventory.
        const {key,raw}=namespaceEntry(entry)
        if(!controlCandidate(table,key,sid))continue
        const address=table+':'+key
        if(seen.has(address)||seen.size>=16_384)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_BUDGET_OR_DUPLICATE')
        seen.add(address)
        const expected=namespaceRows.get(address)
        if(!expected||!sameData(raw,expected.value))changedNamespace()
        const actual=methods[table].get.call(tableObjects[table],key)
        if(!sameData(actual,expected.value))changedNamespace()
      }
      if(seen.size!==namespaceRows.size)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_CHANGED')
    }
    const assertNativeFrame=()=>{
      assertIdentity()
      const actualEvents=readEvents(session),actualProjections=projectionList(readProjections())
      if(Number(session.seq)!==cursor||Number(session.inheritedEventCount)!==birth||session.header!==header
        ||nativeInputSha256(session.header)!==headerSha256||actualEvents.length!==events.length
        ||nativeInputSha256(actualEvents)!==historySha256||actualProjections.length!==pins.length
        ||actualProjections.some((definition,index)=>{
          const actual=projectionPin(definition),pin=pins[index]!
          return actual.definition!==pin.definition||actual.type!==pin.type||actual.project!==pin.project
        }))fail('PROGRAM_ABSENCE_BRANCH_CONTROL_HISTORY_CHANGED')
      assertIdentity()
    }
    const assertCurrent=()=>{
      assertNativeFrame()
      assertNamespaceCurrent()
      // Namespace reads may have synchronous callbacks. Observe actual Native
      // and owner identities again after the last table operation.
      assertNativeFrame()
    }
    assertCurrent()
    const surface=foldSurface(events,projections),visible=new Set<number>(surface.nodes),
      associations=new Map<string,ProgramAbsenceBranchControlRowFactV1['nativeAssociation']>()
    function association(turn:number,requestedSeq?:number):ProgramAbsenceBranchControlRowFactV1['nativeAssociation'] {
      const cacheKey=turn+':'+(requestedSeq??'last'),previous=associations.get(cacheKey)
      if(previous)return previous
      const starts=events.filter(event=>event.type==='turn/start'&&event.data.turn===turn),
        ends=events.filter(event=>event.type==='turn/end'&&event.data.turn===turn)
      if(starts.length!==1||ends.length!==1)fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TURN_UNPROVEN')
      const start=starts[0]!,end=ends[0]!
      if(Number(start.seq)<birth||Number(end.seq)<=Number(start.seq)
        ||events.slice(Number(start.seq)+1,Number(end.seq)).some(event=>event.type==='turn/start'||event.type==='turn/end'))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TURN_UNPROVEN')
      const assistants=events.slice(Number(start.seq)+1,Number(end.seq)).filter(event=>
        event.type==='assistant/message'&&event.data.turn===turn&&event.data.interrupted!==true&&event.surfaceOp!==undefined)
      const assistant=requestedSeq===undefined?assistants.findLast(event=>{
        const message=deriveEventMessage(event,surface.projectedMessages)
        return !!message&&message.role==='assistant'&&!!textOf(message.content).trim()
      }):assistants.find(event=>Number(event.seq)===requestedSeq)
      if(!assistant||assistant.type!=='assistant/message')fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ASSISTANT_UNPROVEN')
      const message=deriveEventMessage(assistant,surface.projectedMessages)
      if(!message||message.role!=='assistant'||!textOf(message.content).trim())fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ASSISTANT_UNPROVEN')
      const result=freeze({turn,startSeq:Number(start.seq),endSeq:Number(end.seq),assistantSeq:Number(assistant.seq),
        assistantEventSha256:nativeInputSha256(assistant),assistantMessageSha256:nativeInputSha256(message),
        assistantSurface:visible.has(Number(assistant.seq))?'current-node' as const:'retained-historical-node' as const,
        inheritedEventCount:birth})
      associations.set(cacheKey,result)
      return result
    }
    const facts:ProgramAbsenceBranchControlRowFactV1[]=[],unsupportedMutableRows:
      ProgramAbsenceBranchControlEvidenceV1['unsupportedMutableRows'][number][]=[]
    for(const entry of namespaceRows.values()) {
      if(entry.table!=='branch')continue
      const suffix=entry.key.slice(sid.length+2)
      if(suffix==='task-preparation'||suffix==='context-window') {
        unsupportedMutableRows.push({table:'branch',key:entry.key,sha256:entry.sha256,kind:suffix,
          reason:'requires-native-bound-field-contract'})
        continue
      }
      const prefix=suffix.startsWith('phaseb-')?'phaseb-':suffix.startsWith('task-steering-')?'task-steering-'
        :suffix.startsWith('maintenance-timing-')?'maintenance-timing-':undefined
      if(!prefix)continue
      const turn=turnFromKey(suffix,prefix),kind=prefix==='phaseb-'?'phase-b' as const
        :prefix==='task-steering-'?'task-steering' as const:'maintenance-timing' as const,
        value=kind==='phase-b'?phaseB(entry.value,sid,turn):kind==='task-steering'?steering(entry.value,sid,turn):timing(entry.value,sid,turn),
        native=association(turn,kind==='phase-b'?value['assistantSeq'] as number:undefined),
        nativeAssociatedFields=kind==='phase-b'?['turnId','assistantSeq','sessionId']:['sessionId','turn'],
        unboundControlFields=Object.keys(value).filter(field=>!nativeAssociatedFields.includes(field))
      facts.push(freeze({schemaVersion:1,table:'branch',key:entry.key,value,sha256:entry.sha256,
        family:'branch-control',kind,evidenceKind:'native-associated-typed-local-data',
        evidenceGrade:'strict-control-dto-with-native-turn-association',nativeAssociatedFields,unboundControlFields,
        nativeAssociation:native,wholeRowWriterProvenance:'not-proven',completionEvidence:'not-checked',executionAuthority:'none'}))
    }
    facts.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
    const currentNamespace=[...namespaceRows.values()].map(({table,key,sha256})=>({table,key,sha256}))
      .sort((a,b)=>a.table<b.table?-1:a.table>b.table?1:a.key<b.key?-1:a.key>b.key?1:0)
    const evidence:ProgramAbsenceBranchControlEvidenceV1=freeze({schemaVersion:1,
      encoding:'native-associated-branch-control-facts-v1',authority:'consumer-data-only',
      evidenceKind:'native-associated-typed-local-data',sessionId:sid,
      history:{eventCount:events.length,inheritedEventCount:birth,sha256:historySha256},namespace:currentNamespace,
      coveredKinds:['phase-b','task-steering','maintenance-timing'],unsupportedMutableRows,
      wholeRowWriterProvenance:'not-proven',executionAuthority:'none'})
    assertCurrent()
    return {rows:freeze(facts),evidence,assertCurrent}
  }
  return {capture}
}
