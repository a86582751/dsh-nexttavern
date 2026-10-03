/** Typed extension of the one existing Native v2 input owner. Serializable
 * material is data; the active registration and actual v2 work remain the
 * only dispatch permission. */
import {types as utilTypes} from 'node:util'
import {deepFreeze} from '@deepseek-ai/dsh-util-values'
import type {Message, PreparedLlmCall,AssistantMessage} from '@deepseek-ai/dsh-llm'
import type {PromptAssembly} from '@deepseek-ai/dsh-system-prompt'
import type {SessionRequestPreview} from '@deepseek-ai/dsh-session'
import type {NativeOpeningIdentityV1,NativeOpeningEventRefV1,NativeGeneratedOpeningReceiptV1,SessionEvent}
  from '@deepseek-ai/dsh-session'
import type {NativeInputAdmissionCheckV2} from './input-admission.js'
import type {NativeMaterialDataRefV1, NativeMaterialInsertionV1} from './request-material.js'
import {nativeInputSha256} from './input-admission.js'

export interface NativeMaterialSelectedMessageV1 {
  readonly origin:'surface'|'pending-decision'
  readonly eventSeq:number|null
  readonly id:string
  readonly role:Message['role']
  readonly messageSha256:string
  readonly message:Message
}
export interface NativeMaterialSelectedBaseV1 {
  readonly contentGeneration:number
  readonly boundarySeq:number
  readonly surfaceNodes:readonly number[]
  readonly messages:readonly NativeMaterialSelectedMessageV1[]
  readonly sha256:string
}
/** Serializable observations only. These values never issue a Native lease,
 * Source scope, dispatch token or permission to manufacture selected objects. */
export interface NativeMaterialSelectionEventV1 {
  readonly kind:'native-append'|'image-offload-recovery'
  readonly seq:number
  readonly type:string
  readonly sha256:string
  readonly beforeBoundarySha256:string
  readonly afterBoundarySha256:string
  readonly admitted?:{readonly pendingIndex:number;readonly id:string;readonly role:'user';readonly messageSha256:string}
  readonly failureSha256?:string
  readonly offloadImages?:number
  readonly targets?:readonly {readonly seq:number;readonly imageIndexes:readonly number[]}[]
}
export interface NativeMaterialSelectionEvidenceV1 {
  readonly schemaVersion:1
  readonly encoding:'native-request-material-selection-lineage-v1'
  readonly sessionId:string
  readonly turn:number
  readonly step:number
  readonly initialSha256:string
  readonly currentSha256:string
  readonly boundarySeq:number
  readonly contentGeneration:number
  readonly pendingMessages:number
  readonly revision:number
  readonly checkpointSha256?:string
  readonly events:readonly NativeMaterialSelectionEventV1[]
}
export interface NativeRequestMaterialInputV1 {
  readonly schemaVersion:1
  readonly admission:NativeInputAdmissionCheckV2
  readonly turn:number
  readonly step:number
  readonly firstAttempt:boolean
  readonly signal:AbortSignal
  readonly preparedRoute:{readonly configSha256:string;
    readonly requestMaterialText?:PreparedLlmCall['requestMaterialText'];
    readonly systemPromptUpdate?:PreparedLlmCall['systemPromptUpdate'];readonly toolUpdate?:PreparedLlmCall['toolUpdate']}
  readonly finalAssembly:Readonly<PromptAssembly>
  readonly assemblySha256:string
  readonly selected:NativeMaterialSelectedBaseV1
}
/** One actual final step decision, before Native appends step/start. The
 * owning Core has already begun its opaque step and finished Phase A. Route
 * capability is checked later by the synchronous transform after prepareCall. */
export type NativeRequestMaterialPrepareInputV1=Omit<NativeRequestMaterialInputV1,'preparedRoute'|'firstAttempt'>
export type NativeRequestMaterialPrepareDecisionV1={readonly kind:'prepared'}|{readonly kind:'unchanged'}
  |{readonly kind:'blocked';readonly code:string}
export interface NativeOwnedSectionPreconditionV1 {readonly name:string;readonly sha256:string}
export interface NativeOwnedSectionReplacementV1 {
  readonly name:string
  readonly expectedSectionSha256:string
  readonly replacementText:string
  readonly interpolate:false
}
/** An owner names a message it actually received in selected. Only Native's
 * real preview resolves this intent; it contains no guessed seq or index. */
export interface NativeOwnedMaterialAnchorV1 {
  readonly schemaVersion:1
  readonly encoding:'native-selected-message-anchor-v1'
  readonly side:'before'|'after'
  readonly target:{readonly id:string;readonly role:'user';readonly messageSha256:string}
}
export type NativeOwnedMaterialAnchoredInsertionV1=Omit<NativeMaterialInsertionV1,'requestedDepth'>
  &{readonly anchor:NativeOwnedMaterialAnchorV1}
export interface NativeRequestMaterialTransformV1 {
  readonly kind:'transform'
  readonly schemaVersion:1
  readonly encoding:'native-request-material-owner-transform-v1'
  readonly snapshot:NativeMaterialDataRefV1
  readonly plan:NativeMaterialDataRefV1
  readonly captureSha256:string
  readonly expectedAssemblySha256:string
  readonly expectedSelectedBaseSha256:string
  readonly requiredSections:readonly NativeOwnedSectionPreconditionV1[]
  readonly sections:readonly NativeOwnedSectionReplacementV1[]
  readonly insertions:readonly NativeMaterialInsertionV1[]
  /** Versioned consumer intent. Durable Native v1 stores resolved depths;
   * its bound Core plan retains these original explanatory anchor records. */
  readonly anchoredInsertions?:readonly NativeOwnedMaterialAnchoredInsertionV1[]
}
export type NativeRequestMaterialDecisionV1={readonly kind:'unchanged'}
  | {readonly kind:'blocked';readonly code:string}|NativeRequestMaterialTransformV1
export interface NativeRequestMaterialOwnerV1 {
  readonly schemaVersion:1
  /** Names owned by this actual registration. Final assembly must have one
   * exact surviving section per required precondition; ambiguous names refuse. */
  readonly sectionNames:readonly string[]
  /** Program data preparation under this same captured owner. It may await
   * bounded deterministic workers, but may not mutate the Native request cut. */
  prepare?(input:NativeRequestMaterialPrepareInputV1):Promise<NativeRequestMaterialPrepareDecisionV1>
  transform(input:NativeRequestMaterialInputV1):NativeRequestMaterialDecisionV1
  check(input:{readonly admission:NativeInputAdmissionCheckV2;
    readonly phase:'planned-precommit'|'committed-predispatch';readonly decision:NativeRequestMaterialTransformV1;
    /** Present only after this actual owner's prepare returned prepared. Each
     * phase receives a fresh exact current cut, including remaining pending input. */
    readonly selected?:NativeMaterialSelectedBaseV1;
    readonly materialRef?:{readonly seq:number;readonly sha256:string}}):
    {readonly kind:'allow'}|{readonly kind:'blocked';readonly code:string}
}
/** Separate no-player authority. The original player input type above and its
 * serialization are unchanged; opening data never supplies admission/claim. */
export interface NativeOpeningOwnerIdentityV1 {
  readonly kind:'programmatic-opening'
  readonly identity:NativeOpeningIdentityV1
  readonly invocationRef:NativeOpeningEventRefV1
}
export type NativeOpeningMaterialInputV1=Omit<NativeRequestMaterialInputV1,'admission'> & {
  readonly owner:NativeOpeningOwnerIdentityV1
  readonly attempt:number
  readonly noPlayer:{readonly kind:'no-player';readonly selectedUserMessageIds:readonly []}
}
export type NativeOpeningMaterialPrepareInputV1=Omit<NativeOpeningMaterialInputV1,
  'preparedRoute'|'firstAttempt'|'attempt'>
/** Identity gates bracket actual Native reservation persistence. The reserved
 * phase carries only the live work's exact invocation ref, before Phase-A. */
export type NativeOpeningMaterialCheckV1={readonly identity:NativeOpeningIdentityV1;
  readonly phase:'invocation-reservation'|'cold-closing-recovery'|'closing-precommit';readonly signal:AbortSignal}
  |{readonly identity:NativeOpeningIdentityV1;readonly phase:'invocation-reserved';
    readonly invocationRef:NativeOpeningEventRefV1;readonly signal:AbortSignal}
  |{readonly owner:NativeOpeningOwnerIdentityV1;readonly phase:'prepared-precheckpoint';
    readonly selected:NativeMaterialSelectedBaseV1;readonly assemblySha256:string}
  |{readonly owner:NativeOpeningOwnerIdentityV1;readonly phase:'planned-precommit'|'committed-predispatch';
    readonly decision:NativeRequestMaterialTransformV1;readonly selected:NativeMaterialSelectedBaseV1;
    readonly materialRef?:NativeOpeningEventRefV1}
export interface NativeOpeningClosingInputV1 {
  readonly schemaVersion:1
  readonly owner:NativeOpeningOwnerIdentityV1
  readonly generatedReceiptRef:NativeOpeningEventRefV1
  readonly receipt:NativeGeneratedOpeningReceiptV1
  readonly originalModelMessages:readonly {readonly eventRef:NativeOpeningEventRefV1;readonly message:AssistantMessage}[]
  readonly toolEvents:readonly SessionEvent<'tool/call'|'tool/result'>[]
  readonly signal:AbortSignal
}
export type NativeOpeningClosingAcknowledgementV1={readonly kind:'settled';readonly receiptSha256:string;
  readonly ownerReceiptSha256:string}|{readonly kind:'blocked'|'unknown';readonly receiptSha256:string;readonly code:string}
export interface NativeOpeningMaterialOwnerV1 {
  readonly schemaVersion:1
  readonly sectionNames:readonly string[]
  prepare(input:NativeOpeningMaterialPrepareInputV1):Promise<NativeRequestMaterialPrepareDecisionV1>
  transform(input:NativeOpeningMaterialInputV1):NativeRequestMaterialDecisionV1
  check(input:NativeOpeningMaterialCheckV1):{readonly kind:'allow'}|{readonly kind:'blocked';readonly code:string}
  closing(input:NativeOpeningClosingInputV1):Promise<NativeOpeningClosingAcknowledgementV1>
}
/** One actual owner is captured and bound. JSON packets cannot create this
 * registration; the Agent/factory verify their live constructor identity. */
export function nativeOpeningMaterialOwnerRegistrationV1(value:unknown):NativeOpeningMaterialOwnerV1 {
  const row=object(value,['schemaVersion','sectionNames','prepare','transform','check','closing'])
  if(row['schemaVersion']!==1||['prepare','transform','check','closing'].some(key=>typeof row[key]!=='function'))return fail()
  const sectionNames=array(row['sectionNames'],NATIVE_REQUEST_OWNER_BOUNDS.sections).map(identity)
  if(!sectionNames.length||new Set(sectionNames).size!==sectionNames.length)return fail()
  return Object.freeze({schemaVersion:1,sectionNames:Object.freeze(sectionNames),
    prepare:(row['prepare'] as NativeOpeningMaterialOwnerV1['prepare']).bind(value),
    transform:(row['transform'] as NativeOpeningMaterialOwnerV1['transform']).bind(value),
    check:(row['check'] as NativeOpeningMaterialOwnerV1['check']).bind(value),
    closing:(row['closing'] as NativeOpeningMaterialOwnerV1['closing']).bind(value)})
}
export function nativeOpeningClosingAcknowledgementV1(value:unknown,receiptSha256:string):NativeOpeningClosingAcknowledgementV1 {
  if(value===null||typeof value!=='object'||utilTypes.isProxy(value))return fail()
  const kind=Object.getOwnPropertyDescriptor(value,'kind')
  if(!kind||!Object.hasOwn(kind,'value'))return fail()
  if(kind.value==='settled') {
    const row=object(value,['kind','receiptSha256','ownerReceiptSha256'])
    if(row['receiptSha256']!==receiptSha256)return fail()
    return Object.freeze({kind:'settled',receiptSha256,ownerReceiptSha256:sha(row['ownerReceiptSha256'])})
  }
  if(kind.value!=='blocked'&&kind.value!=='unknown')return fail()
  const row=object(value,['kind','receiptSha256','code'])
  if(row['receiptSha256']!==receiptSha256||typeof row['code']!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(row['code']))return fail()
  return Object.freeze({kind:kind.value,receiptSha256,code:row['code']})
}
export const NATIVE_REQUEST_OWNER_BOUNDS=Object.freeze({sections:32,sectionChars:1_048_576,
  sectionBytes:4_194_304,insertions:128,textChars:65_536,renderedBytes:1_048_576})
function fail():never {throw Error('REQUEST_MATERIAL_OWNER_DATA_INVALID')}
const object=(value:unknown,fields:readonly string[]):Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value)||utilTypes.isProxy(value))return fail()
  const prototype=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value)
  if(prototype!==Object.prototype&&prototype!==null||keys.length!==fields.length
    ||keys.some(key=>typeof key!=='string'||!fields.includes(key)))return fail()
  const row:Record<string,unknown>={}
  for(const field of fields){const descriptor=Object.getOwnPropertyDescriptor(value,field)
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)return fail()
    row[field]=descriptor.value}
  return row
}
const array=(value:unknown,max:number):unknown[]=>{
  if(!Array.isArray(value)||utilTypes.isProxy(value)||value.length>max
    ||Reflect.ownKeys(value).length!==value.length+1)return fail()
  const result:unknown[]=[]
  for(let index=0;index<value.length;index++){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index))
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)return fail()
    result.push(descriptor.value)
  }
  return result
}
const identity=(value:unknown):string=>{
  if(typeof value!=='string'||!value.length||value.length>256||value!==value.trim()
    ||/[\u0000-\u001f\u007f-\u009f]/.test(value))return fail()
  return value
}
const sha=(value:unknown):string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:fail()
const count=(value:unknown,max=4096):number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=0&&value<=max&&!Object.is(value,-0)?value:fail()
const ref=(value:unknown):NativeMaterialDataRefV1=>{const row=object(value,['key','sha256'])
  return {key:identity(row['key']),sha256:sha(row['sha256'])}}
const text=(value:unknown,max:number):string=>typeof value==='string'&&value.length<=max?value:fail()

/** Capture callbacks once at registration. A later property mutation cannot
 * substitute another material owner under an already captured v2 work. */
export function nativeRequestMaterialOwnerRegistrationV1(value:unknown):NativeRequestMaterialOwnerV1 {
  const ownsPrepare=value!==null&&typeof value==='object'&&!utilTypes.isProxy(value)&&Object.hasOwn(value,'prepare')
  const row=object(value,['schemaVersion','sectionNames','transform','check',...ownsPrepare?['prepare']:[]])
  if(row['schemaVersion']!==1||typeof row['transform']!=='function'||typeof row['check']!=='function')return fail()
  if(ownsPrepare&&typeof row['prepare']!=='function')return fail()
  const sectionNames=array(row['sectionNames'],NATIVE_REQUEST_OWNER_BOUNDS.sections).map(identity)
  if(!sectionNames.length||new Set(sectionNames).size!==sectionNames.length)return fail()
  return Object.freeze({schemaVersion:1,sectionNames:Object.freeze(sectionNames),
    ...ownsPrepare?{prepare:(row['prepare'] as NonNullable<NativeRequestMaterialOwnerV1['prepare']>).bind(value)}:{},
    transform:row['transform'].bind(value) as NativeRequestMaterialOwnerV1['transform'],
    check:row['check'].bind(value) as NativeRequestMaterialOwnerV1['check']})
}

export function nativeRequestMaterialPrepareDecisionV1(value:unknown):NativeRequestMaterialPrepareDecisionV1 {
  if(value===null||typeof value!=='object'||utilTypes.isProxy(value))return fail()
  const descriptor=Object.getOwnPropertyDescriptor(value,'kind')
  if(!descriptor||!Object.hasOwn(descriptor,'value'))return fail()
  if(descriptor.value==='prepared'||descriptor.value==='unchanged') {
    object(value,['kind']);return Object.freeze({kind:descriptor.value})
  }
  if(descriptor.value!=='blocked')return fail()
  const row=object(value,['kind','code']),code=row['code']
  if(typeof code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(code))return fail()
  return Object.freeze({kind:'blocked',code})
}

export function nativeRequestMaterialOwnerCheckV1(value:unknown):ReturnType<NativeRequestMaterialOwnerV1['check']> {
  if(value===null||typeof value!=='object'||utilTypes.isProxy(value))return fail()
  const descriptor=Object.getOwnPropertyDescriptor(value,'kind')
  if(!descriptor||!Object.hasOwn(descriptor,'value'))return fail()
  if(descriptor.value==='allow'){object(value,['kind']);return Object.freeze({kind:'allow'})}
  if(descriptor.value!=='blocked')return fail()
  const row=object(value,['kind','code']),code=row['code']
  if(typeof code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(code))return fail()
  return Object.freeze({kind:'blocked',code})
}

/** Only detached exact data crosses from the callback to Native's planner.
 * The original return object is never used as a capability or live row cache. */
export function nativeRequestMaterialDecisionV1(value:unknown):NativeRequestMaterialDecisionV1 {
  if(value===null||typeof value!=='object'||utilTypes.isProxy(value))return fail()
  const kindDescriptor=Object.getOwnPropertyDescriptor(value,'kind')
  if(!kindDescriptor||!Object.hasOwn(kindDescriptor,'value'))return fail()
  const kind=kindDescriptor.value
  if(kind==='unchanged'){object(value,['kind']);return Object.freeze({kind})}
  if(kind==='blocked'){const row=object(value,['kind','code']),code=row['code']
    if(typeof code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(code))return fail()
    return Object.freeze({kind,code})}
  if(kind!=='transform')return fail()
  const hasAnchors=Object.hasOwn(value,'anchoredInsertions')
  const row=object(value,['kind','schemaVersion','encoding','snapshot','plan','captureSha256',
    'expectedAssemblySha256','expectedSelectedBaseSha256','requiredSections','sections','insertions',
    ...hasAnchors?['anchoredInsertions']:[]])
  if(row['schemaVersion']!==1||row['encoding']!=='native-request-material-owner-transform-v1')return fail()
  const requiredSections=array(row['requiredSections'],NATIVE_REQUEST_OWNER_BOUNDS.sections).map(item=>{
    const section=object(item,['name','sha256']);return {name:identity(section['name']),sha256:sha(section['sha256'])}})
  let sectionBytes=0
  const sections=array(row['sections'],NATIVE_REQUEST_OWNER_BOUNDS.sections).map(item=>{
    const section=object(item,['name','expectedSectionSha256','replacementText','interpolate'])
    if(section['interpolate']!==false)return fail()
    const replacementText=text(section['replacementText'],NATIVE_REQUEST_OWNER_BOUNDS.sectionChars)
    sectionBytes+=Buffer.byteLength(replacementText,'utf8')
    if(sectionBytes>NATIVE_REQUEST_OWNER_BOUNDS.sectionBytes)return fail()
    return {name:identity(section['name']),expectedSectionSha256:sha(section['expectedSectionSha256']),
      replacementText,interpolate:false as const}})
  let renderedBytes=0
  const insertions=array(row['insertions'],NATIVE_REQUEST_OWNER_BOUNDS.insertions).map((item):NativeMaterialInsertionV1=>{
    const insertion=object(item,['contributionRef','sourceSha256','renderedText','renderedSha256',
      'requestedRole','requestedDepth','stableOrder']),role=insertion['requestedRole']
    if(role!=='system'&&role!=='user'&&role!=='assistant')return fail()
    const renderedText=text(insertion['renderedText'],NATIVE_REQUEST_OWNER_BOUNDS.textChars)
    // SDK serializers may drop blank assistant text or replace lone UTF-16
    // surrogates. Refuse before Native commits rather than changing author text.
    if(!renderedText.trim()||!renderedText.isWellFormed())return fail()
    renderedBytes+=Buffer.byteLength(renderedText,'utf8')
    if(renderedBytes>NATIVE_REQUEST_OWNER_BOUNDS.renderedBytes)return fail()
    return {contributionRef:identity(insertion['contributionRef']),sourceSha256:sha(insertion['sourceSha256']),
      renderedText,renderedSha256:sha(insertion['renderedSha256']),requestedRole:role,
      requestedDepth:count(insertion['requestedDepth']),stableOrder:count(insertion['stableOrder'],Number.MAX_SAFE_INTEGER)}})
  const anchoredInsertions=hasAnchors?array(row['anchoredInsertions'],NATIVE_REQUEST_OWNER_BOUNDS.insertions)
    .map((item):NativeOwnedMaterialAnchoredInsertionV1=>{
      const insertion=object(item,['contributionRef','sourceSha256','renderedText','renderedSha256',
        'requestedRole','stableOrder','anchor']),role=insertion['requestedRole']
      if(role!=='system'&&role!=='user'&&role!=='assistant')return fail()
      const renderedText=text(insertion['renderedText'],NATIVE_REQUEST_OWNER_BOUNDS.textChars)
      if(!renderedText.trim()||!renderedText.isWellFormed())return fail()
      renderedBytes+=Buffer.byteLength(renderedText,'utf8')
      if(renderedBytes>NATIVE_REQUEST_OWNER_BOUNDS.renderedBytes)return fail()
      const anchor=object(insertion['anchor'],['schemaVersion','encoding','side','target'])
      if(anchor['schemaVersion']!==1||anchor['encoding']!=='native-selected-message-anchor-v1'
        ||anchor['side']!=='before'&&anchor['side']!=='after')return fail()
      const target=object(anchor['target'],['id','role','messageSha256'])
      if(target['role']!=='user')return fail()
      return {contributionRef:identity(insertion['contributionRef']),sourceSha256:sha(insertion['sourceSha256']),
        renderedText,renderedSha256:sha(insertion['renderedSha256']),requestedRole:role,
        stableOrder:count(insertion['stableOrder'],Number.MAX_SAFE_INTEGER),
        anchor:{schemaVersion:1,encoding:'native-selected-message-anchor-v1',side:anchor['side'],
          target:{id:identity(target['id']),role:'user',messageSha256:sha(target['messageSha256'])}}}
    }):undefined
  if(insertions.length+(anchoredInsertions?.length??0)>NATIVE_REQUEST_OWNER_BOUNDS.insertions)return fail()
  if(new Set(requiredSections.map(item=>item.name)).size!==requiredSections.length
    ||new Set(sections.map(item=>item.name)).size!==sections.length)return fail()
  return deepFreeze({kind:'transform',schemaVersion:1,encoding:'native-request-material-owner-transform-v1',
    snapshot:ref(row['snapshot']),plan:ref(row['plan']),captureSha256:sha(row['captureSha256']),
    expectedAssemblySha256:sha(row['expectedAssemblySha256']),expectedSelectedBaseSha256:sha(row['expectedSelectedBaseSha256']),
    requiredSections,sections,insertions,...anchoredInsertions?{anchoredInsertions}:{}})
}

/** Internal, data-only resolver called once on the actual Session preview.
 * The caller retains registration/claim/selected/current checks. This cannot
 * register a selection or recreate a live owner from stored anchor JSON. */
export function resolveNativeOwnedMaterialAnchorsV1(plan:NativeRequestMaterialTransformV1,
  selected:NativeMaterialSelectedBaseV1,preview:SessionRequestPreview,protectedPrefixLength:number) {
  const insertions:NativeMaterialInsertionV1[]=[...plan.insertions]
  const resolutions:{contributionRef:string;baseIndex:number}[]=[]
  for(const intent of plan.anchoredInsertions??[]) {
    const target=intent.anchor.target
    const candidates=selected.messages.filter(row=>row.id===target.id&&row.role===target.role
      &&row.messageSha256===target.messageSha256)
    if(candidates.length!==1)throw Error('REQUEST_MATERIAL_ANCHOR_SELECTED_UNPROVEN')
    const captured=candidates[0]!
    const matches=preview.messageNodes.map((node,index)=>({node,index})).filter(({node})=>
      node.message.id===target.id&&node.message.role===target.role
      &&nativeInputSha256(node.message)===target.messageSha256)
    if(matches.length!==1)throw Error('REQUEST_MATERIAL_ANCHOR_PREVIEW_UNPROVEN')
    const {node,index}=matches[0]!
    if(captured.origin==='surface') {
      if(captured.eventSeq!==Number(node.seq))throw Error('REQUEST_MATERIAL_ANCHOR_SURFACE_CHANGED')
    }else {
      const events=preview.events.filter(event=>event.type==='user/message'&&Number(event.seq)===Number(node.seq)
        &&nativeInputSha256(event.data)===target.messageSha256)
      if(events.length!==1)throw Error('REQUEST_MATERIAL_ANCHOR_PENDING_UNPROVEN')
    }
    const baseIndex=index+(intent.anchor.side==='after'?1:0)
    if(baseIndex<protectedPrefixLength)throw Error('REQUEST_MATERIAL_ANCHOR_PREFIX_PROTECTED')
    const {anchor:_anchor,...data}=intent
    insertions.push({...data,requestedDepth:preview.messages.length-baseIndex})
    resolutions.push({contributionRef:intent.contributionRef,baseIndex})
  }
  return {insertions,resolutions}
}

/** Replacing a whole surviving owned section preserves its full preimage;
 * prose substrings and marker text cannot grant a lost slot permission. */
export function applyNativeOwnedSectionsV1(assembly:PromptAssembly,decision:NativeRequestMaterialTransformV1,
  sectionNames:readonly string[]):PromptAssembly {
  if(nativeInputSha256(assembly)!==decision.expectedAssemblySha256)throw Error('REQUEST_MATERIAL_ASSEMBLY_CHANGED')
  const required=new Map(decision.requiredSections.map(item=>[item.name,item.sha256]))
  for(const [name,expected] of required){
    const matches=assembly.sections.filter(section=>section.name===name)
    if(!sectionNames.includes(name)||matches.length!==1||nativeInputSha256(matches[0])!==expected){
      throw Error('REQUEST_MATERIAL_SECTION_SUPPRESSED_OR_CHANGED')
    }
  }
  const edits=new Map(decision.sections.map(item=>[item.name,item]))
  for(const edit of edits.values()){
    if(!sectionNames.includes(edit.name)||required.get(edit.name)!==edit.expectedSectionSha256){
      throw Error('REQUEST_MATERIAL_SECTION_PRECONDITION_MISSING')
    }
  }
  return deepFreeze({...assembly,sections:assembly.sections.map(section=>{
    const edit=edits.get(section.name)
    return edit?{...section,text:edit.replacementText,interpolate:false}:section
  })})
}
