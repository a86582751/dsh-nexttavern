/** Owns the bounded table inputs of one successful schema prefix validation.
 * The closed reader can replay facts; it cannot publish or create a hot owner. */
import {recordSha256} from './roleplay-data.js'
import {freezeMvuSchemaInheritanceData} from './roleplay-mvu-schema-derived-types.js'
import {createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'

interface Table {
  get(key:string):unknown
  entries(prefix?:string,include?:(key:string,value:unknown)=>boolean):Iterable<[string,unknown]>
  put(key:string,value:unknown):Promise<unknown>
}
export interface MvuSchemaPrefixInputBindingV1 {
  sessionId:string
  inheritedEventCount:number
  nativeCut:number
  nativePrefixSha256:string
  sourceSha256:string
  prefixSha256:string
}
interface Row {key:string;exists:boolean;sha256:string;value:unknown}
export interface MvuSchemaPrefixInputClosureV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-prefix-input-closure-v1'
  authority:'consumer-data-only'
  binding:MvuSchemaPrefixInputBindingV1
  tables:readonly {table:'branch'|'status';membership:readonly string[];rows:readonly Row[]}[]
  closureSha256:string
}
type TableName='branch'|'status'
export interface FrozenPrefixCapture {
  read(table:TableName,key:string):unknown
  declareMember(table:TableName,key:string):void
}
interface RowReference {key:string;exists:boolean;sha256:string}
export interface MvuSchemaPrefixInputClosureV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-prefix-input-closure-v2'
  authority:'consumer-data-only'
  binding:MvuSchemaPrefixInputBindingV1
  tables:readonly {table:TableName;membership:readonly string[];rows:readonly RowReference[]}[]
  closureSha256:string
}
export type MvuSchemaPrefixInputClosure=MvuSchemaPrefixInputClosureV1|MvuSchemaPrefixInputClosureV2
interface FrozenInputObjectV2 {
  schemaVersion:2
  encoding:'native-mvu-schema-prefix-input-object-v2'
  table:TableName
  key:string
  sha256:string
  value:unknown
}
interface ResolvedInput {value:unknown;object?:FrozenInputObjectV2;sourceScope?:string}
const readContextData=Symbol('frozen-prefix-input-read-context')
export interface FrozenInputsReadContext {
  readonly storageScope:string
  readonly [readContextData]:Map<string,ResolvedInput>
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const key=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value)
function fail(code='SCHEMA_FROZEN_INPUT_INVALID'):never {throw Error(code)}
function exact(value:unknown,fields:readonly string[]):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)
    ||!same(Object.keys(value).sort(),[...fields].sort()))fail()
}
function data<T>(input:T):T {
  return freezeMvuSchemaInheritanceData(input)
}
function enumerationKey(table:'branch'|'status',value:string,journalInventory=false):boolean {
  return table==='branch'
    ?/^[A-Za-z0-9_-]+__(?:native-input-v2-(?:work|terminal)-|mvu-schema-player-plan-)/.test(value)
    :/^[A-Za-z0-9_-]+__mvu-state-schema-(?:story|player|revision)-event-/.test(value)
      ||journalInventory&&/^[A-Za-z0-9_-]+__mvu-schema-(?:epoch|dispatch|completion)-/.test(value)
}
export function validateMvuSchemaPrefixInputClosureV1(raw:unknown,
  expected:MvuSchemaPrefixInputBindingV1):MvuSchemaPrefixInputClosureV1 {
  const value=validateClosureDescriptor(raw as MvuSchemaPrefixInputClosureV1)
  if(!same(value.binding,expected))fail()
  return value
}
const validateClosureDescriptor=createImmutableDescriptorValidator(validateClosureUncached)
function validateClosureUncached(raw:MvuSchemaPrefixInputClosureV1):MvuSchemaPrefixInputClosureV1 {
  const value=data(raw)
  exact(value,['schemaVersion','encoding','authority','binding','tables','closureSha256'])
  exact(value.binding,['sessionId','inheritedEventCount','nativeCut','nativePrefixSha256','sourceSha256','prefixSha256'])
  const expected=value.binding
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-prefix-input-closure-v1'
    ||value.authority!=='consumer-data-only'||!hash(value.closureSha256)
    ||!key(expected.sessionId)||![expected.inheritedEventCount,expected.nativeCut].every(v=>Number.isSafeInteger(v)&&v>=0)
    ||expected.inheritedEventCount>=expected.nativeCut
    ||![expected.nativePrefixSha256,expected.sourceSha256,expected.prefixSha256].every(hash)
    ||!Array.isArray(value.tables)||value.tables.length!==2)fail()
  let count=0
  for(const [index,table] of value.tables.entries()) {
    exact(table,['table','membership','rows'])
    const name=index===0?'branch':'status'
    if(table.table!==name||!Array.isArray(table.membership)||!Array.isArray(table.rows))fail()
    const rows=new Map<string,Row>()
    for(const row of table.rows) {
      exact(row,['key','exists','sha256','value'])
      if(!key(row.key)||!row.key.includes('__')||rows.has(row.key)||typeof row.exists!=='boolean'
        ||(row.exists?!hash(row.sha256)||recordSha256(row.value)!==row.sha256:row.sha256!=='missing'||row.value!==null)
        ||++count>16_384)fail()
      rows.set(row.key,row as unknown as Row)
    }
    const seen=new Set<string>()
    for(const member of table.membership) {
      if(!key(member)||!member.startsWith(`${expected.sessionId}__`)
        ||!enumerationKey(name,member,true)||seen.has(member)||!rows.get(member)?.exists)fail()
      seen.add(member)
    }
  }
  const {closureSha256,...body}=value
  if(recordSha256(body)!==closureSha256)fail()
  return value as unknown as MvuSchemaPrefixInputClosureV1
}

const validateClosureV2=createImmutableDescriptorValidator((raw:MvuSchemaPrefixInputClosureV2)=>{
  const value=data(raw)
  exact(value,['schemaVersion','encoding','authority','binding','tables','closureSha256'])
  exact(value.binding,['sessionId','inheritedEventCount','nativeCut','nativePrefixSha256','sourceSha256','prefixSha256'])
  const binding=value.binding
  if(value.schemaVersion!==2||value.encoding!=='native-mvu-schema-prefix-input-closure-v2'
    ||value.authority!=='consumer-data-only'||!hash(value.closureSha256)||!key(binding.sessionId)
    ||![binding.inheritedEventCount,binding.nativeCut].every(v=>Number.isSafeInteger(v)&&v>=0)
    ||binding.inheritedEventCount>=binding.nativeCut
    ||![binding.nativePrefixSha256,binding.sourceSha256,binding.prefixSha256].every(hash)
    ||!Array.isArray(value.tables)||value.tables.length!==2)fail()
  let count=0
  for(const [index,table] of value.tables.entries()) {
    exact(table,['table','membership','rows'])
    if(table.table!==(index===0?'branch':'status')||!Array.isArray(table.rows)||!Array.isArray(table.membership))fail()
    const rows=new Map<string,RowReference>()
    for(const row of table.rows) {
      exact(row,['key','exists','sha256'])
      if(!key(row.key)||rows.has(row.key)||typeof row.exists!=='boolean'
        ||(row.exists?!hash(row.sha256):row.sha256!=='missing')||++count>16_384)fail()
      rows.set(row.key,row as unknown as RowReference)
    }
    const seen=new Set<string>()
    for(const member of table.membership) {
      if(!key(member)||!member.startsWith(binding.sessionId+'__')||seen.has(member)||!rows.get(member)?.exists)fail()
      seen.add(member)
    }
  }
  const {closureSha256,...body}=value
  if(recordSha256(body)!==closureSha256)fail()
  return value as unknown as MvuSchemaPrefixInputClosureV2
})
export function validateMvuSchemaPrefixInputClosure(raw:unknown,
  expected:MvuSchemaPrefixInputBindingV1):MvuSchemaPrefixInputClosure {
  if((raw as {schemaVersion?:unknown})?.schemaVersion===1)return validateMvuSchemaPrefixInputClosureV1(raw,expected)
  const value=validateClosureV2(raw as MvuSchemaPrefixInputClosureV2)
  if(!same(value.binding,expected))fail()
  return value
}
const validateObject=createImmutableDescriptorValidator((raw:FrozenInputObjectV2)=>{
  const value=data(raw)
  exact(value,['schemaVersion','encoding','table','key','sha256','value'])
  if(value.schemaVersion!==2||value.encoding!=='native-mvu-schema-prefix-input-object-v2'
    ||!['branch','status'].includes(value.table)||!key(value.key)
    ||!hash(value.sha256)||recordSha256(value.value)!==value.sha256)fail()
  return value as unknown as FrozenInputObjectV2
})
const identity=(table:TableName,row:RowReference)=>JSON.stringify([table,row.key,row.sha256])
const contextIdentity=(context:FrozenInputsReadContext,table:TableName,row:RowReference)=>
  JSON.stringify([context.storageScope,table,row.key,row.sha256])
const basisAddress=(table:TableName,keyValue:string)=>table==='status'
  ?/^([A-Za-z0-9_-]+)__mvu-state-schema-revision-basis-([a-f0-9]{64})$/.exec(keyValue):null
const basisKey=(scope:string,basisSha256:string)=>`${scope}__mvu-state-schema-revision-basis-${basisSha256}`
const objectKey=(scope:string,table:TableName,row:RowReference)=>
  `${scope}__mvu-prefix-input-object-v2-${recordSha256({table,key:row.key,sha256:row.sha256})}`

export function createRoleplayMvuSchemaPrefixInputs(tables:{branch:Table;status:Table}) {
  let active:{branch:Table;status:Table}|undefined
  const views=Object.fromEntries((['branch','status'] as const).map(name=>[name,{
    get:(key:string)=>(active?.[name]??tables[name]).get(key),
    // InputState subscribes to prefixes but yields the whole table. This view
    // owns actual filtering; include belongs to the consumer, not that proxy.
    entries:(prefix?:string,include?:(key:string,value:unknown)=>boolean)=>active
      ?active[name].entries(prefix,include)
      :[...tables[name].entries(prefix)].filter(([key,value])=>(prefix===undefined||key.startsWith(prefix))
        &&(!include||include(key,value))),
    put:(key:string,value:unknown)=>{
      if(active)fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED')
      return tables[name].put(key,value)
    },
  }])) as {branch:Table;status:Table}
  function scoped<T>(scope:{branch:Table;status:Table},action:()=>T):T {
    if(active)fail('SCHEMA_FROZEN_INPUT_SCOPE_CONFLICT')
    active=scope
    try {return action()}finally {active=undefined}
  }
  function createReadContext(storageScope:string):FrozenInputsReadContext {
    if(!key(storageScope))fail()
    return {storageScope,[readContextData]:new Map()}
  }
  function resolve(table:TableName,row:RowReference,context:FrozenInputsReadContext):ResolvedInput {
    const cache=context[readContextData],cacheKey=contextIdentity(context,table,row)
    const known=cache.get(cacheKey)
    if(known)return known
    const basis=basisAddress(table,row.key)
    let result:ResolvedInput
    if(basis) {
      // A descendant's physical copy retains the original logical session and
      // key. Missing child DATA never falls through to a live ancestor.
      const value=tables.status.get(basisKey(context.storageScope,basis[2]!))
      if(value===undefined)fail('SCHEMA_FROZEN_INPUT_OBJECT_MISSING')
      if(recordSha256(value)!==row.sha256)fail('SCHEMA_FROZEN_INPUT_CHANGED')
      result={value,sourceScope:context.storageScope}
    }else {
      const raw=tables[table].get(objectKey(context.storageScope,table,row))
      if(raw===undefined)fail('SCHEMA_FROZEN_INPUT_OBJECT_MISSING')
      const object=validateObject(raw as FrozenInputObjectV2)
      if(object.table!==table||object.key!==row.key||object.sha256!==row.sha256)fail()
      result={value:object.value,object,sourceScope:context.storageScope}
    }
    cache.set(cacheKey,result)
    return result
  }
  async function putExact(table:Table,keyValue:string,value:unknown) {
    const existing=table.get(keyValue)
    if(existing!==undefined) {
      if(!same(existing,value))fail('SCHEMA_FROZEN_INPUT_WRITE_CONFLICT')
      return
    }
    try {await table.put(keyValue,value)}catch { /* Exact readback owns a lost acknowledgement. */ }
    if(!same(table.get(keyValue),value))fail('SCHEMA_FROZEN_INPUT_WRITE_UNKNOWN')
  }
  function retention(closure:MvuSchemaPrefixInputClosure,context:FrozenInputsReadContext,
    pending:ReadonlyMap<string,ResolvedInput>) {
    return async(storageScope:string):Promise<void>=>{
      if(!key(storageScope))fail()
      const retained=new Set<string>()
      async function retain(current:MvuSchemaPrefixInputClosure):Promise<void> {
        for(const table of current.tables)for(const row of table.rows) {
          if(!row.exists)continue
          const id=identity(table.table,row)
          if(current.schemaVersion===2&&retained.has(id))continue
          const input:ResolvedInput=current.schemaVersion===1?{value:(row as Row).value}
            :pending.get(id)??resolve(table.table,row,context)
          const basis=basisAddress(table.table,row.key)
          // A durable identity in this physical scope already owns its entire
          // dependency closure. Reuse that fact before traversing old bases.
          if(input.sourceScope===storageScope) {
            retained.add(id)
            if(basis)retained.add('closure:'+id)
            continue
          }
          if(basis&&!retained.has('closure:'+id)) {
            // Only the canonical revision-basis owner declares closure edges.
            // Arbitrary author JSON is never searched for apparent references.
            const dependency=(input.value as {closure:MvuSchemaPrefixInputClosure}).closure
            const nested=validateMvuSchemaPrefixInputClosure(dependency,dependency?.binding)
            await retain(nested)
            retained.add('closure:'+id)
          }
          if(current.schemaVersion===2) {
            if(basis) {
              await putExact(tables.status,basisKey(storageScope,basis[2]!),input.value)
            }else {
              const object=input.object??data({schemaVersion:2 as const,
                encoding:'native-mvu-schema-prefix-input-object-v2' as const,table:table.table,
                key:row.key,sha256:row.sha256,value:input.value})
              await putExact(tables[table.table],objectKey(storageScope,table.table,row),object)
            }
          }
          // V1 values are portable inline DATA. Walking them does not prove
          // that a later V2 reference has its physical object in the child.
          if(current.schemaVersion===2)retained.add(id)
        }
      }
      await retain(closure)
    }
  }
  function record<T>(sessionId:string,inputs:{branch:Table;status:Table},action:(capture:FrozenPrefixCapture)=>T,
    bindingFor:(result:T)=>MvuSchemaPrefixInputBindingV1,context?:FrozenInputsReadContext,
    source?:MvuSchemaPrefixInputClosure) {
    const pending=new Map<string,ResolvedInput>()
    const recordings=(['branch','status'] as const).map(name=>{
      const live=inputs[name],rows=new Map<string,RowReference>(),membership=new Set<string>()
      const sourceRows=source?new Map(source.tables.find(table=>table.table===name)!.rows.map(row=>[row.key,row])):undefined
      const enumerations:{prefix:string|undefined;include:((key:string,value:unknown)=>boolean)|undefined;keys:string[]}[]=[]
      const entries=(prefix?:string,include?:(key:string,value:unknown)=>boolean)=>[...live.entries(prefix)]
        .filter(([key,value])=>key.startsWith(`${sessionId}__`)&&(prefix===undefined||key.startsWith(prefix))
          &&(!include||include(key,value)))
      function remember(keyValue:string,value:unknown):unknown {
        const previous=rows.get(keyValue)
        if(previous)return value
        // A closed view already owns this exact row identity and immutable
        // value. A recut does not hash that resolved Source payload again.
        const sha256=sourceRows?.get(keyValue)?.sha256??(value===undefined?'missing':recordSha256(value))
        const row=data({key:keyValue,exists:value!==undefined,sha256})
        if(!key(keyValue)||rows.size>=16_384&&!rows.has(keyValue))fail()
        rows.set(keyValue,row)
        if(row.exists) {
          const known=context?.[readContextData].get(contextIdentity(context,name,row)),basis=basisAddress(name,keyValue)
          if(known)pending.set(identity(name,row),known)
          else if(basis)pending.set(identity(name,row),{value,sourceScope:context?undefined:basis[1]!})
          else {
            const object=data({schemaVersion:2 as const,encoding:'native-mvu-schema-prefix-input-object-v2' as const,
              table:name,key:keyValue,sha256,value})
            pending.set(identity(name,row),{value:object.value,object})
          }
        }
        return value
      }
      const view:Table={get:key=>remember(key,live.get(key)),entries:(prefix,include)=>{
        const actual=entries(prefix,include),keys=actual.map(([key])=>key)
        enumerations.push({prefix,include,keys})
        for(const key of keys)membership.add(key)
        return actual.map(([key,value])=>[key,remember(key,value)] as [string,unknown])
      },put:async()=>fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED')}
      return {name,view,rows,membership:()=>[...membership],read:(key:string)=>{
        const row=rows.get(key)
        // Reuse the value already retained by this capture, including an
        // explicit absence. Typed historical edges need no second live read.
        return row?row.exists?pending.get(identity(name,row))!.value:undefined:view.get(key)
      },declareMember:(key:string)=>{
        if(key.startsWith(sessionId+'__')&&rows.get(key)?.exists)membership.add(key)
      },assertCurrent:()=>{
        for(const enumeration of enumerations)if(!same(enumeration.keys,
          entries(enumeration.prefix,enumeration.include).map(([key])=>key)))fail('SCHEMA_FROZEN_INPUT_CHANGED')
        for(const row of rows.values())if(row.exists?recordSha256(live.get(row.key))!==row.sha256
          :live.get(row.key)!==undefined)fail('SCHEMA_FROZEN_INPUT_CHANGED')
      }}
    })
    const result=scoped({branch:recordings[0]!.view,status:recordings[1]!.view},()=>action({
      read:(table,key)=>recordings[table==='branch'?0:1]!.read(key),
      declareMember:(table,key)=>recordings[table==='branch'?0:1]!.declareMember(key),
    }))
    const binding=bindingFor(result)
    const body={schemaVersion:2 as const,encoding:'native-mvu-schema-prefix-input-closure-v2' as const,
      authority:'consumer-data-only' as const,binding,tables:recordings.map(recording=>({table:recording.name,
        membership:recording.membership(),rows:[...recording.rows.values()]}))}
    const closure=validateMvuSchemaPrefixInputClosure({...body,closureSha256:recordSha256(body)},binding)
    const assertCurrent=()=>{for(const recording of recordings)recording.assertCurrent()}
    return {result,closure,assertCurrent,retainInputs:retention(closure,context??createReadContext(sessionId),pending)}
  }
  function closedTables(closure:MvuSchemaPrefixInputClosure,context:FrozenInputsReadContext):{branch:Table;status:Table} {
    const closed=closure.tables.map(table=>{
      const rows=new Map(table.rows.map(row=>[row.key,row]))
      return {get:(key:string)=>{
        const row=rows.get(key)
        if(!row)fail('SCHEMA_FROZEN_INPUT_READ_UNRECORDED')
        return row.exists?closure.schemaVersion===1?(row as Row).value:resolve(table.table,row,context).value:undefined
      },entries:(prefix?:string,include?:(key:string,value:unknown)=>boolean)=>table.membership.filter(key=>
        prefix===undefined||key.startsWith(prefix)).map(key=>{
        const row=rows.get(key)!
        return [key,closure.schemaVersion===1?(row as Row).value:resolve(table.table,row,context).value] as [string,unknown]
      }).filter(([key,value])=>!include||include(key,value)),
      put:async()=>fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED')}
    })
    return {branch:closed[0]!,status:closed[1]!}
  }
  function capture<T>(binding:MvuSchemaPrefixInputBindingV1,action:(capture:FrozenPrefixCapture)=>T) {
    return record(binding.sessionId,tables,action,()=>binding)
  }
  function captureComputed<T>(sessionId:string,action:()=>T,bindingFor:(result:T)=>MvuSchemaPrefixInputBindingV1) {
    return record(sessionId,tables,action,bindingFor)
  }
  function verify<T>(raw:unknown,binding:MvuSchemaPrefixInputBindingV1,action:()=>T,
    context=createReadContext(binding.sessionId)):T {
    return scoped(closedTables(validateMvuSchemaPrefixInputClosure(raw,binding),context),action)
  }
  /** Resolve immutable dependency closures before entering this owner's view.
   * A revision baseline may itself be a frozen prefix; scopes never nest. */
  function prepareClosed(raw:unknown,binding:MvuSchemaPrefixInputBindingV1,context=createReadContext(binding.sessionId)) {
    const inputs=closedTables(validateMvuSchemaPrefixInputClosure(raw,binding),context)
    return {...inputs,read:<T>(action:()=>T)=>scoped(inputs,action)}
  }
  /** A historical recut records its reads from one immutable closed view.
   * It never nests verify/capture scopes or falls through to live ancestors. */
  function derive<T>(raw:unknown,source:MvuSchemaPrefixInputBindingV1,action:(capture:FrozenPrefixCapture)=>T,
    bindingFor:(result:T)=>MvuSchemaPrefixInputBindingV1,context=createReadContext(source.sessionId)) {
    const closure=validateMvuSchemaPrefixInputClosure(raw,source),inputs=closedTables(closure,context)
    const captured=record(source.sessionId,inputs,action,bindingFor,context,closure)
    return {...captured,assertCurrent(){/* The input rows are immutable frozen DATA. */}}
  }
  return {branch:views.branch,status:views.status,createReadContext,capture,captureComputed,verify,prepareClosed,derive}
}
