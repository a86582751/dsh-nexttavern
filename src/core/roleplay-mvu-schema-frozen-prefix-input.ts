/** Owns the bounded table inputs of one successful schema prefix validation.
 * The closed reader can replay facts; it cannot publish or create a hot owner. */
import {recordSha256} from './roleplay-data.js'
import {freezeMvuSchemaInheritanceData} from './roleplay-mvu-schema-derived-types.js'
import {createImmutableDescriptorValidator} from './roleplay-mvu-schema-descriptor-data.js'

interface Table {
  get(key:string):unknown
  entries():Iterable<[string,unknown]>
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
function enumerationKey(table:'branch'|'status',value:string):boolean {
  return table==='branch'
    ?/^[A-Za-z0-9_-]+__(?:native-input-v2-(?:work|terminal)-|mvu-schema-player-plan-)/.test(value)
    :/^[A-Za-z0-9_-]+__mvu-state-schema-(?:story|player)-event-/.test(value)
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
        ||!enumerationKey(name,member)||seen.has(member)||!rows.get(member)?.exists)fail()
      seen.add(member)
    }
  }
  const {closureSha256,...body}=value
  if(recordSha256(body)!==closureSha256)fail()
  return value as unknown as MvuSchemaPrefixInputClosureV1
}

export function createRoleplayMvuSchemaPrefixInputs(tables:{branch:Table;status:Table}) {
  let active:{branch:Table;status:Table}|undefined
  const views=Object.fromEntries((['branch','status'] as const).map(name=>[name,{
    get:(key:string)=>(active?.[name]??tables[name]).get(key),
    entries:()=>(active?.[name]??tables[name]).entries(),
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
  function capture<T>(binding:MvuSchemaPrefixInputBindingV1,action:()=>T) {
    const recordings=(['branch','status'] as const).map(name=>{
      const live=tables[name],rows=new Map<string,Row>()
      let membership:readonly string[]|undefined
      const entries=()=>[...live.entries()].filter(([key])=>key.startsWith(`${binding.sessionId}__`)
        &&enumerationKey(name,key))
      function remember(keyValue:string,value:unknown):unknown {
        const sha256=value===undefined?'missing':recordSha256(value),previous=rows.get(keyValue)
        if(previous) {
          if(previous.sha256!==sha256||previous.exists!==(value!==undefined))fail('SCHEMA_FROZEN_INPUT_CHANGED')
          return value
        }
        // One detached row per (table,key). Its new envelope pays for its value
        // once; the final closure independently pays for the complete record.
        const row=data({key:keyValue,exists:value!==undefined,sha256,value:value===undefined?null:value})
        if(!key(keyValue)||!keyValue.includes('__')||rows.size>=16_384&&!rows.has(keyValue))fail()
        rows.set(keyValue,row)
        return value
      }
      const view:Table={get:key=>remember(key,live.get(key)),entries:()=>{
        const actual=entries(),keys=actual.map(([key])=>key)
        if(membership&&!same(membership,keys))fail('SCHEMA_FROZEN_INPUT_CHANGED')
        membership=keys
        return actual.map(([key,value])=>[key,remember(key,value)] as [string,unknown])
      },put:async()=>fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED')}
      return {name,view,rows,membership:()=>membership??[],assertCurrent:()=>{
        if(membership&&!same(membership,entries().map(([key])=>key)))fail('SCHEMA_FROZEN_INPUT_CHANGED')
        for(const row of rows.values())if(recordSha256(live.get(row.key))!==row.sha256)fail('SCHEMA_FROZEN_INPUT_CHANGED')
      }}
    })
    const result=scoped({branch:recordings[0]!.view,status:recordings[1]!.view},action)
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-prefix-input-closure-v1' as const,
      authority:'consumer-data-only' as const,binding,tables:recordings.map(recording=>({table:recording.name,
        membership:recording.membership(),rows:[...recording.rows.values()]}))}
    const closure=validateMvuSchemaPrefixInputClosureV1({...body,closureSha256:recordSha256(body)},binding)
    const assertCurrent=()=>{for(const recording of recordings)recording.assertCurrent()}
    assertCurrent()
    return {result,closure,assertCurrent}
  }
  function verify<T>(raw:unknown,binding:MvuSchemaPrefixInputBindingV1,action:()=>T):T {
    const closure=validateMvuSchemaPrefixInputClosureV1(raw,binding)
    const closed=closure.tables.map(table=>{
      const rows=new Map(table.rows.map(row=>[row.key,row]))
      return {get:(key:string)=>{
        const row=rows.get(key)
        if(!row)fail('SCHEMA_FROZEN_INPUT_READ_UNRECORDED')
        return row.exists?row.value:undefined
      },entries:()=>table.membership.map(key=>[key,rows.get(key)!.value] as [string,unknown]),
      put:async()=>fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED')}
    })
    return scoped({branch:closed[0]!,status:closed[1]!},action)
  }
  return {branch:views.branch,status:views.status,capture,verify}
}
