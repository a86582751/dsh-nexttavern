import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,schemaTextSha256} from './tavern-mvu-schema-data.js'
import type {TavernTemplateDiagnosticV1,TavernTemplateReadV1,TavernTemplateActivationProposalV1,
  TavernTemplateFrozenSnapshotV1,TavernTemplateInjectionEffectV1} from './tavern-template-types.mjs'

type Data=Record<string,unknown>
export const TEMPLATE_LIMITS_V1=Object.freeze({sourceChars:16384,outputChars:65536,
  snapshotBytes:4_194_304,snapshotNodes:65_536,snapshotDepth:32,
  workerInputBytes:8_388_608,workerInputNodes:131_072,workerInputDepth:48,
  outputBytes:262_144,dataArrayElements:4096,
  vmMemoryBytes:16*1024*1024,vmStackBytes:512*1024,vmDeadlineMs:250,parentDeadlineMs:1500,
  readDependencies:128,activationProposals:64,helperCalls:4096,randomCalls:4096,scopes:7,loreBindings:4096,
  variablePathBytes:4096,variablePathDepth:48,helperArgumentBytes:65_536,
  promiseJobs:4096,templateEvaluations:128,
  cumulativeSourceBytes:262_144,cumulativeCompiledBytes:262_144,cumulativeOutputBytes:262_144,
  injectionScheduleActions:128,injectionHandles:256,injectionEffects:512,
  injectionInputBytes:67_108_864,injectionPromptChars:16384,injectionIds:128})
export class TemplateRefusalV1 extends Error {
  constructor(readonly diagnostic:TavernTemplateDiagnosticV1) {super(diagnostic.code)}
}
function templateFail(code:string,pointer:string|null=null,
  limit:TavernTemplateDiagnosticV1['limit']=null):never {
  throw new TemplateRefusalV1({schemaVersion:1,code,sourcePointer:pointer,limit})
}
const templateObject=(value:unknown):value is Data=>!!value&&typeof value==='object'&&!Array.isArray(value)
const templateHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const templateId=(value:unknown):value is string=>typeof value==='string'&&value.length>0
  &&Buffer.byteLength(value,'utf8')<=256
function templateExact(value:unknown,keys:readonly string[]):asserts value is Data {
  if(!templateObject(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))) {
    templateFail('TEMPLATE_RECORD_SHAPE')
  }
}
function freezeTemplateData<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTemplateData(child);Object.freeze(value)}
  return value
}
type LimitsKey=keyof typeof TEMPLATE_LIMITS_V1
/** Snapshot cloning checks exact escaped JSON UTF-8 bytes before transport. */
function cloneTemplateEnvelopeV1<T>(input:T,fields:{bytes:LimitsKey;nodes:LimitsKey;depth:LimitsKey}):T {
  try {return cloneSchemaData(input,TEMPLATE_LIMITS_V1[fields.bytes],
    {nodes:TEMPLATE_LIMITS_V1[fields.nodes],depth:TEMPLATE_LIMITS_V1[fields.depth]})}
  catch(error) {
    const code=error instanceof Error?error.message:''
    const field=code==='SCHEMA_DATA_BYTE_LIMIT'?fields.bytes:code==='SCHEMA_DATA_NODE_LIMIT'?fields.nodes
      :code==='SCHEMA_DATA_DEPTH_LIMIT'?fields.depth:code==='SCHEMA_ARRAY_LIMIT'?'dataArrayElements':undefined
    if(field)templateFail('TEMPLATE_INPUT_LIMIT',null,
      {field,observed:null,maximum:TEMPLATE_LIMITS_V1[field]})
    templateFail('TEMPLATE_INPUT_INVALID')
  }
}
const scopes=['card','chat','message','script','global','initial','cache','preset'] as const
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
const pointer=(value:unknown):value is string=>typeof value==='string'&&value.startsWith('/')
  &&Buffer.byteLength(value,'utf8')<=4096&&!/~(?![01])/.test(value)
export function validateTemplateSnapshotV1(input:unknown):TavernTemplateFrozenSnapshotV1 {
  const value=cloneTemplateEnvelopeV1(input,{bytes:'snapshotBytes',nodes:'snapshotNodes',depth:'snapshotDepth'})
  templateExact(value,['schemaVersion','encoding','authority','sessionId','branchId','revision','turnId','attemptId',
    'packageSha256','sourceSnapshotSha256','stateSnapshotSha256','defaultVariableScope','scopes','scopesSha256',
    'lore','loreSha256','clockEpochMs','randomSeed','randomSeedSha256','snapshotSha256'])
  if(value.schemaVersion!==1||value.encoding!=='owned-template-frozen-snapshot-v1'
    ||value.authority!=='consumer-data-only'||!integer(value.revision))templateFail('TEMPLATE_SNAPSHOT_INVALID')
  for(const key of ['sessionId','branchId','turnId','attemptId'])if(!templateId(value[key]))templateFail('TEMPLATE_SNAPSHOT_INVALID')
  for(const key of ['packageSha256','sourceSnapshotSha256','stateSnapshotSha256','scopesSha256','loreSha256',
    'randomSeedSha256','snapshotSha256'])if(!templateHash(value[key]))templateFail('TEMPLATE_SNAPSHOT_HASH')
  if(!scopes.includes(value.defaultVariableScope as typeof scopes[number])||!Array.isArray(value.scopes)
    ||value.scopes.length>TEMPLATE_LIMITS_V1.scopes)templateFail('TEMPLATE_SCOPE_INVALID')
  const known=new Set<string>()
  for(const row of value.scopes) {
    templateExact(row,['scope','ownerId','versionSha256','values','valuesSha256'])
    if(!scopes.includes(row.scope as typeof scopes[number])||known.has(String(row.scope))||!templateId(row.ownerId)
      ||!templateHash(row.versionSha256)||!templateObject(row.values)||!templateHash(row.valuesSha256)
      ||recordSha256(row.values)!==row.valuesSha256)templateFail('TEMPLATE_SCOPE_INVALID')
    known.add(String(row.scope))
  }
  // An uncaptured default remains unavailable. Marker-free templates can run;
  // the actual getvar read refuses rather than borrowing another scope.
  if(!Array.isArray(value.lore)||value.lore.length>TEMPLATE_LIMITS_V1.loreBindings)templateFail('TEMPLATE_LORE_LIMIT')
  const keys=new Set<string>(),entries=new Set<string>()
  for(const row of value.lore) {
    const hasLookup=templateObject(row)&&Object.hasOwn(row,'lookup')
    const hasDiagnostic=templateObject(row)&&Object.hasOwn(row,'readDiagnostic')
    templateExact(row,['key','bookId','entryId','sourcePointer','sourceSnapshotSha256','content','contentSha256','activationAllowed',
      ...hasLookup?['lookup']:[],...hasDiagnostic?['readDiagnostic']:[]])
    if(!templateId(row.key)||row.key.startsWith('missing-query-')||keys.has(row.key)||!templateHash(row.bookId)||!templateHash(row.entryId)
      ||entries.has(row.entryId)||!pointer(row.sourcePointer)||row.sourceSnapshotSha256!==value.sourceSnapshotSha256
      ||typeof row.content!=='string'||!templateHash(row.contentSha256)||schemaTextSha256(row.content)!==row.contentSha256
      ||typeof row.activationAllowed!=='boolean')templateFail('TEMPLATE_LORE_INVALID')
    keys.add(row.key);entries.add(row.entryId)
    if(hasLookup) {
      templateExact(row.lookup,['world','title','uid'])
      if(typeof row.lookup.world!=='string'||Buffer.byteLength(row.lookup.world,'utf8')>512
        ||typeof row.lookup.title!=='string'||Buffer.byteLength(row.lookup.title,'utf8')>4096
        ||row.lookup.uid!==null&&!integer(row.lookup.uid))templateFail('TEMPLATE_LORE_LOOKUP_INVALID')
    }
    if(hasDiagnostic) {
      templateExact(row.readDiagnostic,['code','projectionSha256'])
      if(typeof row.readDiagnostic.code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(row.readDiagnostic.code)
        ||!templateHash(row.readDiagnostic.projectionSha256))templateFail('TEMPLATE_LORE_DIAGNOSTIC_INVALID')
    }
  }
  if(typeof value.clockEpochMs!=='number'||!Number.isSafeInteger(value.clockEpochMs)||Math.abs(value.clockEpochMs)>8640000000000000
    ||!templateId(value.randomSeed)||schemaTextSha256(value.randomSeed)!==value.randomSeedSha256) {
    templateFail('TEMPLATE_DETERMINISM_INVALID')
  }
  if(recordSha256(value.scopes)!==value.scopesSha256||recordSha256(value.lore)!==value.loreSha256) {
    templateFail('TEMPLATE_SNAPSHOT_COMPONENT_HASH')
  }
  const {snapshotSha256,...body}=value
  if(recordSha256(body)!==snapshotSha256)templateFail('TEMPLATE_SNAPSHOT_HASH')
  return freezeTemplateData(value as unknown as TavernTemplateFrozenSnapshotV1)
}
/** Expected dependencies are derived from the frozen scope, never the guest's
 * claimed hash or a textual source label. Reads still require actual owner proof. */
type TemplateLookups={lore:Map<string,TavernTemplateFrozenSnapshotV1['lore'][number]>;
  scopes:Map<string,TavernTemplateFrozenSnapshotV1['scopes'][number]>}
const lookups=new WeakMap<TavernTemplateFrozenSnapshotV1,TemplateLookups>()
function templateLookups(snapshot:TavernTemplateFrozenSnapshotV1):TemplateLookups {
  const old=lookups.get(snapshot)
  if(old)return old
  const data={lore:new Map(snapshot.lore.map(row=>[row.key,row])),
    scopes:new Map(snapshot.scopes.map(row=>[row.scope,row]))}
  // Only a validated frozen catalog is memoized; arbitrary mutable data gets
  // a fresh index and can never stale a later certified missing-key result.
  if(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.lore)&&Object.isFrozen(snapshot.scopes))lookups.set(snapshot,data)
  return data
}
function templateLoreBindingV1(snapshot:TavernTemplateFrozenSnapshotV1,key:string) {
  return templateLookups(snapshot).lore.get(key)
}
const forbiddenVariableKeys=new Set(['__proto__','prototype','constructor'])
const templateVariableKeyV1=(key:unknown):key is string|null=>key===null||typeof key==='string'
  &&Buffer.byteLength(key,'utf8')<=TEMPLATE_LIMITS_V1.variablePathBytes
function variablePath(key:string):string[] {
  if(!templateVariableKeyV1(key))templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
  const parts:string[]=[]
  let index=0,expectName=true
  const add=(part:string)=>{
    if(forbiddenVariableKeys.has(part)||parts.length>=TEMPLATE_LIMITS_V1.variablePathDepth)templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
    parts.push(part)
  }
  while(index<key.length) {
    if(key[index]==='.') {
      if(expectName)add('')
      index++;expectName=true
      if(index===key.length)add('')
      continue
    }
    if(key[index]==='[') {
      index++
      const quote=key[index]
      let part=''
      if(quote==='"'||quote==="'") {
        index++
        let closed=false
        while(index<key.length) {
          const char=key[index++]!
          if(char===quote){closed=true;break}
          if(char==='\\'){if(index>=key.length)templateFail('TEMPLATE_VARIABLE_PATH_INVALID');part+=key[index++]!}
          else part+=char
        }
        if(!closed)templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
      }else {
        const start=index
        while(index<key.length&&key[index]!==']')index++
        part=key.slice(start,index)
        if(part!==''&&!/^-?\d+(?:\.\d+)?$/.test(part))templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
      }
      if(key[index++]!==']')templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
      add(part);expectName=false
      if(index<key.length&&key[index]!=='.'&&key[index]!=='[')templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
      continue
    }
    const start=index
    while(index<key.length&&key[index]!=='.'&&key[index]!=='[') {
      if(key[index]===']')templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
      index++
    }
    add(key.slice(start,index));expectName=false
  }
  return parts
}
// The current host overlay and frozen binding share this bounded key grammar.
export {variablePath as templateVariablePathV1}
/** A null key is the whole certified binding. No prototype/inherited lookup,
 * category stripping or implicit live scope/cache reconstruction occurs here. */
export function templateVariableValueV1(snapshot:TavernTemplateFrozenSnapshotV1,key:string|null,scope:string|null)
  :{readonly present:boolean;readonly value:unknown} {
  const row=templateLookups(snapshot).scopes.get(scope??'')
  if(!row)templateFail('TEMPLATE_SCOPE_UNAVAILABLE')
  if(!templateVariableKeyV1(key))templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
  if(key===null)return {present:true,value:row.values}
  if(forbiddenVariableKeys.has(key))templateFail('TEMPLATE_VARIABLE_PATH_INVALID')
  if(Object.hasOwn(row.values,key))return {present:true,value:row.values[key]}
  const parts=variablePath(key)
  let value:unknown=row.values
  if(!parts.length)return {present:false,value:null}
  for(const part of parts) {
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,part))return {present:false,value:null}
    value=(value as Record<string,unknown>)[part]
  }
  return {present:true,value}
}
export function templateReadV1(snapshot:TavernTemplateFrozenSnapshotV1,kind:'variable'|'lore',key:string|null,
  scope:string|null,purpose:'read'|'activation-proposal'):TavernTemplateReadV1 {
  if(kind==='variable') {
    const row=templateLookups(snapshot).scopes.get(scope??'')
    if(!row)templateFail('TEMPLATE_SCOPE_UNAVAILABLE')
    const result=templateVariableValueV1(snapshot,key,scope)
    return {kind,purpose,scope:row.scope,ownerId:row.ownerId,key,present:result.present,versionSha256:row.versionSha256,
      valueSha256:result.present?recordSha256(result.value):null,entryId:null,sourcePointer:null}
  }
  if(key===null)templateFail('TEMPLATE_LORE_INVALID')
  const row=templateLoreBindingV1(snapshot,key)
  return {kind,purpose,scope:null,ownerId:null,key,present:!!row,versionSha256:snapshot.sourceSnapshotSha256,
    valueSha256:row?.contentSha256??null,entryId:row?.entryId??null,sourcePointer:row?.sourcePointer??null}
}
export function templateActivationV1(snapshot:TavernTemplateFrozenSnapshotV1,key:string):TavernTemplateActivationProposalV1|null {
  const row=templateLoreBindingV1(snapshot,key)
  if(!row||!row.activationAllowed)return null
  return {schemaVersion:1,kind:'activate-lore-entry',entryId:row.entryId,bookId:row.bookId,sourcePointer:row.sourcePointer,
    contentSha256:row.contentSha256,sourceSnapshotSha256:row.sourceSnapshotSha256,baseSnapshotSha256:snapshot.snapshotSha256,
    branchId:snapshot.branchId,turnId:snapshot.turnId,attemptId:snapshot.attemptId}
}
export function validateTemplateInjectionEffectsV1(input:unknown):readonly TavernTemplateInjectionEffectV1[] {
  if(!Array.isArray(input)||!input.length||input.length>TEMPLATE_LIMITS_V1.injectionEffects) {
    templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
  }
  let last=-1
  for(const item of input) {
    if(!templateObject(item)||!integer(item.ordinal)||item.ordinal<=last
      ||item.ordinal>=TEMPLATE_LIMITS_V1.injectionEffects)templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
    last=item.ordinal
    if(item.kind==='named-upsert') {
      templateExact(item,['ordinal','kind','key','uid','prompt','order','sticky'])
      if(typeof item.key!=='string'||item.key.length>256||!templateId(item.uid)
        ||typeof item.prompt!=='string'||item.prompt.length>TEMPLATE_LIMITS_V1.injectionPromptChars
        ||typeof item.order!=='number'||!Number.isFinite(item.order)
        ||typeof item.sticky!=='number'||!Number.isFinite(item.sticky))templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
    }else if(item.kind==='batch-created') {
      templateExact(item,['ordinal','kind','batchOrdinal','once','ids'])
      if(!integer(item.batchOrdinal)||item.batchOrdinal>=TEMPLATE_LIMITS_V1.injectionHandles
        ||typeof item.once!=='boolean'||!Array.isArray(item.ids)||item.ids.length>TEMPLATE_LIMITS_V1.injectionIds
        ||item.ids.some(id=>!templateId(id)))templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
    }else if(item.kind==='register') {
      templateExact(item,['ordinal','kind','prompt'])
      templateExact(item.prompt,['id','position','depth','role','content','should_scan','once','batchOrdinal','callbackOrdinal'])
      const row=item.prompt
      if(!templateId(row.id)||!['in_chat','none'].includes(String(row.position))||!integer(row.depth)
        ||row.depth>65536||!['system','user','assistant'].includes(String(row.role))
        ||typeof row.content!=='string'||row.content.length>TEMPLATE_LIMITS_V1.injectionPromptChars
        ||typeof row.should_scan!=='boolean'||typeof row.once!=='boolean'
        ||!integer(row.batchOrdinal)||row.batchOrdinal>=TEMPLATE_LIMITS_V1.injectionHandles
        ||row.callbackOrdinal!==null&&(!integer(row.callbackOrdinal)||row.callbackOrdinal>=TEMPLATE_LIMITS_V1.injectionHandles)) {
        templateFail('TEMPLATE_INJECTION_PROMPT_INVALID')
      }
    }else if(item.kind==='remove-ids') {
      templateExact(item,['ordinal','kind','ids','batchOrdinal'])
      if(!Array.isArray(item.ids)||item.ids.length>TEMPLATE_LIMITS_V1.injectionIds
        ||item.ids.some(id=>!templateId(id))
        ||item.batchOrdinal!==null&&(!integer(item.batchOrdinal)||item.batchOrdinal>=TEMPLATE_LIMITS_V1.injectionHandles)) {
        templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
      }
    }else templateFail('TEMPLATE_INJECTION_EFFECT_INVALID')
  }
  return input as readonly TavernTemplateInjectionEffectV1[]
}
