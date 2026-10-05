/** Source-free mutable branch control data. Native material binds selected
 * input/window facts, never the entire later row or its scheduling state. */
import {types} from 'node:util'
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {Session,SessionEvent,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {recordSha256,textOf} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {validateRoleplayPhaseABranchRowDataV1} from './roleplay-phase-a-row-facts.js'
import {inputSnapshotReferenceCurrent} from './roleplay-preparation.js'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'
import type {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import {internalTaskSeqs} from './tavern-task-context.js'
import type {TaskContextSession} from './tavern-task-context.js'

type Data=Readonly<Record<string,unknown>>
type Publication=ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>['publications'][number]
interface Ref {readonly key:string;readonly sha256:string}
interface Table {get(key:string):unknown}
export interface ProgramAbsenceMutableControlMaterialReadV1 {
  readonly publications:readonly Publication[]
  /** Actual material-facts capture guard, including all consumed immutable
   * dependencies. A Source guard or no-op is not this interface's owner. */
  assertCurrent():void
  /** Original producer/reader identity only. Older suppliers retain their
   * complete guard as the fallback; this never proves current row bytes. */
  assertOwnerFactsCurrent?():void
}
export interface ProgramAbsenceMutableControlFactV1 {
  readonly table:'branch'
  readonly key:string
  readonly kind:'task-preparation'|'context-window'
  readonly family:'branch-control'
  readonly evidenceKind:'native-associated-typed-local-data'|'typed-local-window-data'
  readonly value:Data
  readonly sha256:string
  readonly boundFields:Data
  readonly unboundControlFields:readonly string[]
}
export interface ProgramAbsenceMutableControlsDependenciesV1 {
  readonly branch:Table
  readonly session:(id:string)=>Session|undefined
  readonly events:(session:Session)=>readonly SessionEvent[]
  readonly projections:()=>readonly SessionMessageProjection[]
  /** Bound by actual Core to source-free material-facts.capture. Queries
   * cannot supply a guessed publication array or acquire a hot owner. */
  readonly readMaterialHistory:(session:Session)=>ProgramAbsenceMutableControlMaterialReadV1
}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=min&&!Object.is(value,-0)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)
function fail(code='PROGRAM_ABSENCE_MUTABLE_CONTROL_UNPROVEN'):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function exact(raw:unknown,required:readonly string[],optional:readonly string[]=[]):asserts raw is Record<string,unknown> {
  if(!object(raw)||required.some(key=>!Object.hasOwn(raw,key))
    ||Object.keys(raw).some(key=>!required.includes(key)&&!optional.includes(key)))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_SCHEMA')
}
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
    if(typeof key!=='string')return false
    const x=a[key],y=b[key]
    return Object.hasOwn(a,key)&&!!x&&!!y&&Object.hasOwn(x,'value')&&Object.hasOwn(y,'value')&&x.enumerable===y.enumerable
      &&sameData(x.value,y.value)
  })
}
function strictData(raw:unknown):unknown {
  const data=cloneRoleplayTavernLoreDataV1(raw,16_777_216,{nodes:131072,depth:66})
  if(!sameData(raw,data))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_SPELLING')
  return freeze(data)
}
function ref(raw:unknown):Ref {
  exact(raw,['key','sha256'])
  if(typeof raw['key']!=='string'||!/^[a-zA-Z0-9_-]{1,512}$/.test(raw['key'])||!hash(raw['sha256']))fail()
  return raw as unknown as Ref
}
function absenceCurrency(raw:unknown,snapshot:boolean):Data {
  exact(raw,['schemaVersion','preparationId','credentialSha256','receiptGeneration','attemptGeneration','source'],
    snapshot?['snapshot']:[])
  if(raw['schemaVersion']!==2||!id(raw['preparationId'])||!hash(raw['credentialSha256'])
    ||!integer(raw['receiptGeneration'],1)||!integer(raw['attemptGeneration'],1))fail()
  exact(raw['source'],['kind','sourceSha256','absenceScopeRef'])
  const source=raw['source'],absent=source['absenceScopeRef']
  exact(absent,['kind','sha256'])
  if(source['kind']!=='story'||!hash(source['sourceSha256'])||!hash(absent['sha256'])
    ||!['plain-absence','prompt-template-only-domain','inherited-prompt-domain','prompt-program-domain',
      'prompt-program-inherited-domain'].includes(String(absent['kind'])))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NUMERICAL')
  if(Object.hasOwn(raw,'snapshot'))ref(raw['snapshot'])
  return raw
}
function projectionPin(definition:SessionMessageProjection) {
  if(!object(definition)||types.isProxy(definition)
    ||![Object.prototype,null].includes(Object.getPrototypeOf(definition)))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_PROJECTION')
  const descriptors=Object.getOwnPropertyDescriptors(definition)
  if(Reflect.ownKeys(definition).length!==2||!descriptors['type']?.enumerable||!descriptors['project']?.enumerable
    ||!Object.hasOwn(descriptors['type']!,'value')||!Object.hasOwn(descriptors['project']!,'value')
    ||typeof descriptors['type']!.value!=='string'||typeof descriptors['project']!.value!=='function')fail()
  return {definition,type:descriptors['type']!.value,project:descriptors['project']!.value}
}
export function createRoleplayProgramAbsenceMutableControlsV1(deps:ProgramAbsenceMutableControlsDependenciesV1) {
  const branch=deps.branch,get=branch.get,lookup=deps.session,readEvents=deps.events,
    projections=deps.projections,readMaterialHistory=deps.readMaterialHistory
  function capture(session:Session) {
    const sid=session.id
    const assertIdentity=()=>{
      if(deps.branch!==branch||branch.get!==get||deps.session!==lookup||deps.events!==readEvents
        ||deps.projections!==projections||deps.readMaterialHistory!==readMaterialHistory
        ||lookup(sid)!==session||session.id!==sid||!id(sid))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_OWNER_CHANGED')
    }
    assertIdentity()
    const events=readEvents(session),cursor=Number(session.seq),inherited=session.inheritedEventCount,
      headerSha256=nativeInputSha256(session.header),historySha256=nativeInputSha256(events),
      pins=[...projections()].map(projectionPin),surface=session.surface,derive=session.deriveEventMessage
    if(!integer(cursor)||events.length!==cursor||!integer(inherited)||inherited>cursor
      ||session.header.id!==sid||events.some((event,index)=>!integer(event.seq)||event.seq!==index))fail()
    function surfaceData():Data {
      const actual=session.surface
      if(actual!==surface||session.deriveEventMessage!==derive||typeof derive!=='function'
        ||!Array.isArray(actual.nodes)||!integer(actual.contentGeneration)
        ||actual.nodes.some(seq=>!integer(seq)||seq>=cursor))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_SURFACE_CHANGED')
      return {nodes:[...actual.nodes],contentGeneration:actual.contentGeneration}
    }
    const surfaceSha256=nativeInputSha256(surfaceData()),material=readMaterialHistory(session),
      materialAssert=material.assertCurrent,materialOwnerFacts=material.assertOwnerFactsCurrent,
      materialOwnerAssert=materialOwnerFacts===undefined?materialAssert:materialOwnerFacts,publications=material.publications,
      rows=new Map<string,{exists:boolean;value:unknown;sha256?:string}>()
    if(!Array.isArray(publications)||typeof materialAssert!=='function'||typeof materialOwnerAssert!=='function')fail()
    function assertMaterialBindingsCurrent():void {
      if(material.assertCurrent!==materialAssert||material.assertOwnerFactsCurrent!==materialOwnerFacts
        ||material.publications!==publications)fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NATIVE_CHANGED')
    }
    function assertMaterialOwnerFactsCurrent():void {
      assertIdentity()
      assertMaterialBindingsCurrent()
      materialOwnerAssert.call(material)
      assertMaterialBindingsCurrent()
      assertIdentity()
    }
    assertMaterialOwnerFactsCurrent()
    function read(key:string):unknown {
      const pinned=rows.get(key)
      if(pinned)return pinned.value
      const raw=get.call(branch,key),exists=raw!==undefined,value=exists?strictData(raw):undefined
      rows.set(key,{exists,value,...exists?{sha256:recordSha256(value)}:{}})
      return value
    }
    const view={get:read}
    function exactRow(reference:Ref):Data {
      const value=read(reference.key)
      if(!object(value)||recordSha256(value)!==reference.sha256)fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_BOUND_ROW_CHANGED')
      return value
    }
    function nativeRef(event:SessionEvent|Publication['event']) {return {seq:Number(event.seq),sha256:nativeInputSha256(event)}}
    const associations:{publication:Publication;phaseRef:Ref;phase:Data;currency?:Data;binding:Data}[]=[]
    for(const publication of publications) {
      const {event,snapshot,plan}=publication,actual=events[Number(event.seq)],turn=Number(snapshot.turn),
        snapshotRef=ref(event.data.snapshot),planRef=ref(event.data.plan)
      if(!actual||event.type!=='request/material'||event.seq<inherited||nativeInputSha256(actual)!==nativeInputSha256(event)
        ||snapshot.sessionId!==sid||plan.sessionId!==sid||snapshot.turn!==plan.turn||snapshot.step!==plan.step)fail()
      if(!sameData(snapshot,exactRow(snapshotRef))||!sameData(plan,exactRow(planRef)))fail()
      const start=events.filter(item=>item.type==='turn/start'&&Number(item.data.turn)===turn&&item.seq<event.seq).at(-1),
        end=events.find(item=>item.type==='turn/end'&&Number(item.data.turn)===turn&&item.seq>event.seq)
      // A publication can explain typed local data after a failed request;
      // its real closed turn is not a completed/admission capability.
      if(!start||start.seq<inherited||!end)continue
      let phaseRef:Ref,currency:Data|undefined,phaseKind:'task-input-snapshot'|'task-snapshot'
      if(snapshot.encoding==='core-input-material-record-v1') {
        currency=absenceCurrency(snapshot.currency,true)
        if(!Object.hasOwn(currency,'snapshot')||!sameData(currency,absenceCurrency(plan.currency,true)))fail()
        phaseRef=ref(snapshot.payload['phaseASnapshotRef']);phaseKind='task-input-snapshot'
        if(!sameData(phaseRef,currency['snapshot'])
          ||!inputSnapshotReferenceCurrent(view,sid,currency as unknown as InputPreparationCurrency))fail()
      }else if(snapshot.encoding==='core-program-opening-material-record-v1') {
        const preparation=snapshot.payload['openingPreparation']
        exact(preparation,['snapshotRef','ownedBranchRefs','scopeFacts','attempt'])
        const scopes=preparation['scopeFacts']
        if(!object(scopes)||!object(scopes['input'])||scopes['input']['initialization']!=='absent') {
          fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NUMERICAL')
        }
        exact(scopes['initialization'],['kind','markerCount','inventorySha256','initialized'])
        if(scopes['initialization']['kind']!=='absent'||scopes['initialization']['markerCount']!==0
          ||scopes['initialization']['initialized']!==false||!hash(scopes['initialization']['inventorySha256']))fail()
        phaseRef=ref(preparation['snapshotRef']);phaseKind='task-snapshot'
      }else fail()
      const phase=validateRoleplayPhaseABranchRowDataV1(session,phaseRef.key,phaseKind,exactRow(phaseRef))
      if(phase['turnId']!==turn||Object.hasOwn(phase,'numericalState')
        ||phaseKind==='task-snapshot'&&Object.hasOwn(phase,'inputPreparation'))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NUMERICAL')
      associations.push({publication,phaseRef,phase,currency,binding:{publication:nativeRef(event),snapshotRef,planRef,
        phaseASnapshotRef:phaseRef,turn,turnStart:nativeRef(start),turnEnd:nativeRef(end)}})
    }
    const facts:ProgramAbsenceMutableControlFactV1[]=[],skippedRows:Data[]=[]
    const preparationKey=`${sid}__task-preparation`,rawPreparation=read(preparationKey)
    if(rawPreparation!==undefined) {
      const value=validateRoleplayPhaseABranchRowDataV1(session,preparationKey,'task-preparation',rawPreparation)
      if(Object.hasOwn(value,'numericalState'))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NUMERICAL')
      if(!Array.isArray(value['messages'])||value['messages'].length!==0||!Object.hasOwn(value,'inputPreparation')) {
        // Exact opening rows and hot Phase-A facts are supplied separately.
        // Absence of this narrower cold association never blocks those facts.
        skippedRows.push({key:preparationKey,sha256:recordSha256(value),reason:'requires-exact-opening-or-other-owner-facts'})
      }else {
        const currency=absenceCurrency(value['inputPreparation'],true),matches=associations.filter(item=>{
          if(!item.currency||value['turn']!==item.phase['turnId']||value['id']!==currency['preparationId'])return false
          const {snapshot:_snapshot,...materialBasis}=item.currency
          return Object.hasOwn(currency,'snapshot')?sameData(currency,item.currency):sameData(currency,materialBasis)
        })
        if(!matches.length)skippedRows.push({key:preparationKey,sha256:recordSha256(value),reason:'no-closed-bound-story-material'})
        else facts.push({table:'branch',key:preparationKey,kind:'task-preparation',family:'branch-control',
          evidenceKind:'native-associated-typed-local-data',value,sha256:recordSha256(value),
          boundFields:{inputPreparation:currency,associations:matches.map(item=>item.binding)},
          unboundControlFields:['status','createdAt','completedAt','sourceHash','messages(empty-display-control-shape)']})
      }
    }
    const windowKey=`${sid}__context-window`,rawWindow=read(windowKey)
    if(rawWindow!==undefined) {
      const value=validateRoleplayPhaseABranchRowDataV1(session,windowKey,'context-window',rawWindow),
        matches=associations.filter(item=>{
          const window=item.phase['contextWindow'] as Data
          return value['windowNumber']===window['windowNumber']&&value['windowId']===window['windowId']
            &&(value['previousWindowId']??null)===window['previousWindowId']
        })
      // Inheritance creates this control before the child's first request.
      // A closed material cannot be a prerequisite for its cold DATA reader.
      // The window's own grammar and actual Native relations explain it;
      // existing material associations are descriptive evidence only.
      {
        const start=Number(value['startSeq']),through=Object.hasOwn(value,'throughSeq')?Number(value['throughSeq']):undefined
        if(start>=events.length||through!==undefined&&(through>=events.length||through<start))fail()
        if(Object.hasOwn(value,'inheritedFrom')||Object.hasOwn(value,'inheritedAtSeedLength')) {
          if(value['inheritedFrom']!==session.header.parentSession||value['inheritedAtSeedLength']!==inherited
            ||!id(session.header.parentSession))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_WINDOW_INHERITANCE_INVALID')
        }
        const tail=value['tailSeqs'],shadowed=value['shadowedSeqs'],checkpoint=value['checkpointSeq'],
          referenced:Data[]=[]
        if(checkpoint!==undefined) {
          const event=events[Number(checkpoint)]
          if(!event||event.type!=='user/message'||!Array.isArray(tail)||!tail.length
            ||!Array.isArray(shadowed)||!shadowed.length||new Set(tail).size!==tail.length
            ||new Set(shadowed).size!==shadowed.length)fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_CHECKPOINT_INVALID')
          const source=event.data.source as unknown as Data,operation=event.surfaceOp
          if(!source||source['kind']!=='roleplay-context-window'||source['form']!=='snapshot'||source['schemaVersion']!==1
            ||operation==='append'||!operation||operation.op!=='replace'||operation.startSeq!==shadowed[0]
            ||operation.endSeq!==shadowed.at(-1)||recordSha256(event.sourceEventSeqs)!==recordSha256(shadowed)
            ||shadowed.some(seq=>!events[Number(seq)]||Number(seq)>=Number(checkpoint))
            ||tail.some(seq=>!events[Number(seq)]||Number(seq)>=Number(checkpoint)||shadowed.includes(seq))
            ||start!==Number(tail[0])-1)fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_CHECKPOINT_INVALID')
          // This is the same actual Session object, viewed by the existing Core
          // event classifier. No fabricated Session or reconstructed Agent exists.
          const internal=internalTaskSeqs(session as unknown as TaskContextSession)
          for(const seq of tail) {
            const original=events[Number(seq)]!,message=session.deriveEventMessage(original),data=original.data as unknown as Data
            if(original.type==='user/message'?(data['source'] as Data)?.['kind']!=='user'
              :original.type!=='assistant/message'||internal.has(Number(seq))
                ||!message||!textOf(message.content).trim()
                ||message.content.some(block=>['tool-call','tool-result'].includes(block.type)))fail()
            referenced.push({seq:Number(seq),sha256:nativeInputSha256(original),relation:'retained-story-tail'})
          }
          referenced.push({...nativeRef(event),relation:'actual-checkpoint-replacement'})
        }else if(tail!==undefined||shadowed!==undefined)fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_CHECKPOINT_INVALID')
        facts.push({table:'branch',key:windowKey,kind:'context-window',family:'branch-control',
          evidenceKind:'typed-local-window-data',value,sha256:recordSha256(value),
          boundFields:{windowIdentity:{windowNumber:value['windowNumber'],windowId:value['windowId'],
            previousWindowId:value['previousWindowId']??null},associations:matches.map(item=>item.binding),referencedNative:referenced},
          unboundControlFields:['startSeq(range-checked)','throughSeq(range-checked)','storyTokens','previousStoryTokens',
            'continuityTailTokens','continuityTokens','createdAt','updatedAt','rolloverCount','reason',
            'inheritedFrom(header-associated)','inheritedAtSeedLength(header-associated)',
            'tailSeqs(order-selection-not-whole-writer-ack)']})
      }
    }
    const assertNativeFrame=()=>{
      const actualEvents=readEvents(session),actualProjections=projections()
      if(Number(session.seq)!==cursor||session.inheritedEventCount!==inherited
        ||nativeInputSha256(session.header)!==headerSha256||nativeInputSha256(surfaceData())!==surfaceSha256
        ||actualEvents.length!==events.length||nativeInputSha256(actualEvents)!==historySha256
        ||actualProjections.length!==pins.length||actualProjections.some((definition,index)=>{
          const pin=projectionPin(definition),expected=pins[index]!
          return pin.definition!==expected.definition||pin.type!==expected.type||pin.project!==expected.project
        }))fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_NATIVE_CHANGED')
    }
    const assertCurrent=()=>{
      assertMaterialOwnerFactsCurrent()
      assertNativeFrame()
      for(const [key,row] of rows) {
        const raw=get.call(branch,key)
        if(row.exists?(raw===undefined||!sameData(raw,row.value)||recordSha256(raw)!==row.sha256):raw!==undefined) {
          fail('PROGRAM_ABSENCE_MUTABLE_CONTROL_ROW_CHANGED')
        }
      }
      // Exact mutable reads and the material namespace can run callbacks.
      // One full producer check follows them; surface/derive pins are ours.
      materialAssert.call(material)
      assertMaterialOwnerFactsCurrent()
      assertNativeFrame()
      assertMaterialBindingsCurrent()
      assertIdentity()
    }
    assertCurrent()
    return {rows:freeze(facts),evidence:freeze({schemaVersion:1,encoding:'native-associated-absence-mutable-controls-v1',
      authority:'consumer-data-only',sessionId:sid,historySha256,inheritedEventCount:inherited,
      rowRefs:facts.map(({key,kind,sha256,evidenceKind})=>({key,kind,sha256,evidenceKind})),skippedRows}),assertCurrent}
  }
  return {capture}
}
