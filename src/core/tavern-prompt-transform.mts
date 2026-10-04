import {cloneSchemaData,schemaTextSha256} from './tavern-mvu-schema-data.js'
import {recordSha256} from './roleplay-data.js'
import {boundedSTPromptTransformBatchV1} from './bounded-regex.js'
import {createTavernPromptTransformOutputV1} from './tavern-prompt-transform-output.mjs'
import {TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as LIMITS,TAVERN_PROMPT_CARD_ORDER_V1,
  TAVERN_PROMPT_POST_ORDER_V1,TAVERN_PROMPT_INSTRUCT_ORDER_V1} from './tavern-prompt-transform-types.mjs'
export {TAVERN_PROMPT_CARD_ORDER_V1,TAVERN_PROMPT_POST_ORDER_V1,
  TAVERN_PROMPT_INSTRUCT_ORDER_V1} from './tavern-prompt-transform-types.mjs'
import type {TavernPromptBindingV1,TavernPromptMacroSnapshotV1,TavernPromptNamesV1,
  TavernPromptProjectionV1,TavernPromptTransformInputV1,TavernPromptTransformResultV1,
  TavernPromptTransformDependenciesV1,TavernPromptTransformDiagnosticV1} from './tavern-prompt-transform-types.mjs'

const names=['user','char','group','charIfNotGroup','groupNotMuted','notChar','model'] as const
export const TAVERN_PROMPT_TRANSFORM_POLICY_V1=frozen({schemaVersion:1,
  encoding:'owned-st-legacy-prompt-transform-policy-v1',upstreamCommit:'06bde939fb1e9c4c8d8641d810f0a916b5bce127',
  unit:'utf16-code-units',limits:LIMITS,macroEngine:'legacy-frozen-read-only',
  scriptOrder:['global','preset','scoped'],capture:'st-callback-full-numeric-and-named-trim-macro',
  unknown:'selected-refusal-catalog-deferred',outlet:'explicit-read-only-macro-consumption',
  pipelines:['macro-only','regex-only','macro-then-regex','regex-then-macro'],
  authority:'consumer-data-only',additionalModelRequests:{normal:0,retry:0,fallback:0},
})
export class TavernPromptTransformErrorV1 extends Error {
  readonly diagnostic:TavernPromptTransformDiagnosticV1
  constructor(code:string,limit:TavernPromptTransformDiagnosticV1['limit']=null) {
    super(code);this.name='TavernPromptTransformErrorV1'
    this.diagnostic=Object.freeze({schemaVersion:1,code,entryKey:null,ruleId:null,macro:null,limit})
  }
}
function fail(code:string):never {throw new TavernPromptTransformErrorV1(code)}
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x)
const member=(x:unknown,choices:readonly string[]):x is string=>typeof x==='string'&&choices.includes(x)
function exact(x:unknown,keys:readonly string[]):asserts x is Record<string,unknown> {
  if(!object(x)||Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k)))
    fail('PROMPT_TRANSFORM_SHAPE')
}
function text(x:unknown,max=4096):asserts x is string {
  if(typeof x!=='string'||x.length>max)fail('PROMPT_TRANSFORM_TEXT')
}
function list(x:unknown,max:number=LIMITS.bindings):asserts x is unknown[] {
  if(!Array.isArray(x)||x.length>max)fail('PROMPT_TRANSFORM_ARRAY_LIMIT')
}
function frozen<T>(x:T):T {
  if(x&&typeof x==='object'){for(const value of Object.values(x))frozen(value);Object.freeze(x)}
  return x
}
function read(x:unknown):void {
  exact(x,['kind','purpose','scope','ownerId','key','present','versionSha256','valueSha256','entryId','sourcePointer'])
  if(!member(x.kind,['variable','lore'])||x.purpose!=='read'||typeof x.present!=='boolean'
    ||!hash(x.versionSha256)||!(x.present?hash(x.valueSha256):x.valueSha256===null))fail('PROMPT_TRANSFORM_READ')
  for(const key of ['ownerId','key','entryId','sourcePointer'])if(x[key]!==null)text(x[key])
  if(x.scope!==null&&!member(x.scope,['card','chat','message','script','global','initial','cache']))
    fail('PROMPT_TRANSFORM_READ')
  if(x.kind==='variable'&&(x.scope===null||x.ownerId===null||x.entryId!==null||x.sourcePointer!==null))
    fail('PROMPT_TRANSFORM_READ')
  if(x.kind==='lore'&&(x.scope!==null||x.ownerId!==null||x.key===null))fail('PROMPT_TRANSFORM_READ')
}
function binding(x:unknown):asserts x is TavernPromptBindingV1 {
  exact(x,['key','value','valueSha256','read']);text(x.key,256)
  if(!x.key||/[{}]/.test(x.key))fail('PROMPT_TRANSFORM_BINDING_KEY')
  read(x.read)
  if(x.value===null) {
    if(x.valueSha256!==null||(x.read as {present:boolean}).present)fail('PROMPT_TRANSFORM_BINDING')
  } else {
    text(x.value,LIMITS.inputChars)
    if(!hash(x.valueSha256)||schemaTextSha256(x.value)!==x.valueSha256
      ||!(x.read as {present:boolean}).present)fail('PROMPT_TRANSFORM_BINDING')
  }
}
function bindings(x:unknown):asserts x is TavernPromptBindingV1[] {
  list(x);const keys=new Set<string>()
  for(const row of x){binding(row);if(keys.has(row.key))fail('PROMPT_TRANSFORM_BINDING_DUPLICATE');keys.add(row.key)}
}
function validateNames(x:unknown):asserts x is TavernPromptNamesV1 {
  exact(x,names)
  for(const key of names){const value=x[key];binding(value)
    if(value.key!==key||value.value===null&&key!=='model')fail('PROMPT_TRANSFORM_NAMES')}
}
function macroSnapshot(x:unknown):asserts x is TavernPromptMacroSnapshotV1 {
  exact(x,['schemaVersion','engine','authority','sourceSnapshotSha256','names','card','input','instruct','dynamic','registered',
    'localVariables','globalVariables','outlets','post','characterOverrides'])
  if(x.schemaVersion!==1||!member(x.engine,['legacy','experimental'])
    ||x.authority!=='consumer-data-only'||!hash(x.sourceSnapshotSha256))fail('PROMPT_TRANSFORM_MACRO_SNAPSHOT')
  validateNames(x.names);binding(x.input)
  // A Native generated opening has no player input. The binding/read checks
  // above retain that explicit negative fact, including its null hashes.
  if(x.input.key!=='input')fail('PROMPT_TRANSFORM_MACRO_SNAPSHOT')
  for(const key of ['instruct','dynamic','registered','localVariables','globalVariables','outlets','post'])bindings(x[key])
  if(x.card!==null) {
    bindings(x.card)
    if(x.card.length!==TAVERN_PROMPT_CARD_ORDER_V1.length
      ||x.card.some((row,i)=>row.key!==TAVERN_PROMPT_CARD_ORDER_V1[i]||row.value===null))
      fail('PROMPT_TRANSFORM_CARD_ORDER')
  }
  const posts=x.post as TavernPromptBindingV1[]
  if(posts.some(row=>!TAVERN_PROMPT_POST_ORDER_V1.includes(row.key)))fail('PROMPT_TRANSFORM_POST_BINDING')
  const instruct=x.instruct as TavernPromptBindingV1[]
  if(instruct.some(row=>!TAVERN_PROMPT_INSTRUCT_ORDER_V1.includes(row.key)))fail('PROMPT_TRANSFORM_INSTRUCT_BINDING')
  list(x.characterOverrides,256);const overrides=new Set<string>()
  for(const row of x.characterOverrides) {
    exact(row,['name','names']);text(row.name);validateNames(row.names)
    if(overrides.has(row.name)||row.names.char.value!==row.name)fail('PROMPT_TRANSFORM_CHARACTER_OVERRIDE')
    overrides.add(row.name)
  }
}
/** Descriptor clone excludes accessors/Proxies before hashing. The selected
 * Source owner remains responsible for original refs, defaults and policy. */
export function freezeTavernPromptTransformInputV1(value:unknown):TavernPromptTransformInputV1 {
  let input:unknown
  try {input=cloneSchemaData(value,16_777_216,{nodes:131_072,depth:32})}
  catch(error) {
    if(error instanceof Error&&error.message==='SCHEMA_ARRAY_LIMIT')fail('PROMPT_TRANSFORM_ARRAY_LIMIT')
    fail('PROMPT_TRANSFORM_DATA_INVALID')
  }
  exact(input,['schemaVersion','encoding','authority','sourceSnapshotSha256','regexDisabled','macros','rules','entries'])
  if(input.schemaVersion!==1||input.encoding!=='owned-tavern-prompt-transform-v1'
    ||input.authority!=='consumer-data-only'||!hash(input.sourceSnapshotSha256)
    ||typeof input.regexDisabled!=='boolean')fail('PROMPT_TRANSFORM_INPUT')
  macroSnapshot(input.macros);list(input.rules,LIMITS.rules);list(input.entries,LIMITS.entries)
  const ids=new Set<string>();let previousOrigin=-1
  for(const row of input.rules) {
    exact(row,['id','sourcePointer','sourceSnapshotSha256','origin','allowed','disabled','findRegex','replaceString',
      'trimStrings','placement','promptOnly','markdownOnly','runOnEdit','minDepth','maxDepth','substituteRegex'])
    text(row.id);text(row.sourcePointer);text(row.findRegex,LIMITS.patternChars)
    text(row.replaceString,LIMITS.replacementChars)
    const origin=typeof row.origin==='string'?['global','preset','scoped'].indexOf(row.origin):-1
    if(!row.id||ids.has(row.id)||!hash(row.sourceSnapshotSha256)||origin<previousOrigin||origin<0)
      fail('PROMPT_TRANSFORM_RULE_ORDER')
    ids.add(row.id);previousOrigin=origin
    for(const k of ['allowed','disabled','promptOnly','markdownOnly','runOnEdit'])
      if(typeof row[k]!=='boolean')fail('PROMPT_TRANSFORM_RULE')
    if(typeof row.substituteRegex!=='number'||![0,1,2].includes(row.substituteRegex))
      fail('PROMPT_TRANSFORM_SUBSTITUTE_REGEX')
    for(const k of ['minDepth','maxDepth'])if(row[k]!==null
      &&(typeof row[k]!=='number'||!Number.isFinite(row[k])))fail('PROMPT_TRANSFORM_DEPTH')
    list(row.placement,7)
    if(row.placement.some(p=>typeof p!=='number'||!Number.isInteger(p)||p<0||p>6))fail('PROMPT_TRANSFORM_PLACEMENT')
    list(row.trimStrings,256);for(const trim of row.trimStrings)text(trim,LIMITS.replacementChars)
  }
  const keys=new Set<string>()
  for(const row of input.entries) {
    exact(row,['key','bookId','entryId','sourcePointer','sourceSnapshotSha256','rawText','storyText','inputText',
      'pipeline','channel','placement','depth','isEdit','characterOverride','required'])
    text(row.key);text(row.sourcePointer)
    for(const key of ['bookId','entryId','characterOverride'])if(row[key]!==null)text(row[key])
    for(const key of ['rawText','storyText','inputText'])text(row[key],LIMITS.inputChars)
    if(!row.key||keys.has(row.key)||!hash(row.sourceSnapshotSha256)
      ||!member(row.pipeline,['macro-only','regex-only','macro-then-regex','regex-then-macro'])
      ||!member(row.channel,['source','prompt','display'])
      ||typeof row.placement!=='number'||!Number.isInteger(row.placement)||row.placement<0||row.placement>6
      ||typeof row.isEdit!=='boolean'||typeof row.required!=='boolean'
      ||row.depth!==null&&(typeof row.depth!=='number'||!Number.isFinite(row.depth)))fail('PROMPT_TRANSFORM_ENTRY')
    if(row.characterOverride!==null&&!input.macros.characterOverrides.some(o=>o.name===row.characterOverride))
      fail('PROMPT_TRANSFORM_CHARACTER_OVERRIDE_MISSING')
    keys.add(row.key)
  }
  let chars=0
  const count=(x:unknown):void=>{
    if(typeof x==='string')chars+=x.length
    else if(x&&typeof x==='object')for(const [key,child] of Object.entries(x)){chars+=key.length;count(child)}
  }
  count(input)
  if(chars>LIMITS.inputChars)throw new TavernPromptTransformErrorV1('PROMPT_TRANSFORM_LIMIT',{
    field:'inputChars',observed:chars,maximum:LIMITS.inputChars,
  })
  return frozen(input as unknown as TavernPromptTransformInputV1)
}
function current(assertCurrent:()=>void):void {
  const result:unknown=assertCurrent()
  if(result!==undefined)fail('PROMPT_TRANSFORM_ASYNC_CURRENT_ASSERTION')
}
export async function applyTavernPromptTransformsV1(value:unknown,
  dependencies:TavernPromptTransformDependenciesV1):Promise<TavernPromptTransformResultV1> {
  const assertCurrent=dependencies.assertCurrent,signal=dependencies.signal
  if(typeof assertCurrent!=='function')fail('PROMPT_TRANSFORM_CURRENT_ASSERTION_REQUIRED')
  current(assertCurrent)
  let input:TavernPromptTransformInputV1
  try {input=freezeTavernPromptTransformInputV1(value)} catch(error) {
    current(assertCurrent)
    if(error instanceof TavernPromptTransformErrorV1)return frozen({kind:'refused',diagnostics:[error.diagnostic]})
    throw error
  }
  let result:TavernPromptTransformResultV1
  if(input.entries.length===0) {
    // Full input admission above still covers macros, rules and every data cap.
    // No entry can execute, so share the worker's envelope without dispatching.
    result=createTavernPromptTransformOutputV1({inputSha256:recordSha256(input),
      policySha256:recordSha256(TAVERN_PROMPT_TRANSFORM_POLICY_V1),inputChars:countInputChars(input)},[],{
      outputChars:0,workChars:0,jobs:0,matches:0,compiledRules:0,receipts:0,receiptChars:0,
    })
  } else {
    current(assertCurrent)
    result=await boundedSTPromptTransformBatchV1({input,inputSha256:recordSha256(input),
      policySha256:recordSha256(TAVERN_PROMPT_TRANSFORM_POLICY_V1),inputChars:countInputChars(input)},signal)
  }
  // Includes worker termination: a cancelled/stale invocation cannot publish
  // either a successful projection or a diagnostic from an expired selection.
  current(assertCurrent)
  if(signal?.aborted)return frozen({kind:'cancelled',diagnostics:[{
    schemaVersion:1,code:'PROMPT_TRANSFORM_CANCELLED',entryKey:null,ruleId:null,macro:null,limit:null,
  }]})
  return frozen(result)
}
function countInputChars(input:unknown):number {
  if(typeof input==='string')return input.length
  if(!input||typeof input!=='object')return 0
  return Object.entries(input).reduce((sum,[key,value])=>sum+key.length+countInputChars(value),0)
}
/** Data-integrity admission only. Caller's actual Source/current owner must
 * still authorize consuming the matching entry; this function cannot do so. */
export function assertTavernPromptProjectionReadyV1(projection:TavernPromptProjectionV1):void {
  let row:TavernPromptProjectionV1
  try {row=cloneSchemaData(projection,16_777_216,{nodes:131_072,depth:32})}
  catch {fail('PROMPT_TRANSFORM_PROJECTION')}
  if(row.schemaVersion!==1||row.encoding!=='owned-tavern-prompt-projection-v1'
    ||row.authority!=='consumer-data-only'||!hash(row.batchInputSha256)||!hash(row.policySha256)
    ||!hash(row.projectionSha256)||!hash(row.outputSha256)||!hash(row.inputSha256)
    ||!hash(row.rawSha256)||!hash(row.storySha256)||typeof row.outputText!=='string'
    ||typeof row.rawText!=='string'||typeof row.storyText!=='string'||typeof row.inputText!=='string'
    ||!Array.isArray(row.deferredDiagnostics))fail('PROMPT_TRANSFORM_PROJECTION')
  const {projectionSha256,...data}=row
  if(recordSha256(data)!==projectionSha256||schemaTextSha256(row.outputText)!==row.outputSha256
    ||schemaTextSha256(row.rawText)!==row.rawSha256||schemaTextSha256(row.storyText)!==row.storySha256
    ||schemaTextSha256(row.inputText)!==row.inputSha256)fail('PROMPT_TRANSFORM_PROJECTION_HASH')
  if(row.deferredDiagnostics.length) {
    const error=new TavernPromptTransformErrorV1('PROMPT_TRANSFORM_DEFERRED_ENTRY')
    throw error
  }
}
