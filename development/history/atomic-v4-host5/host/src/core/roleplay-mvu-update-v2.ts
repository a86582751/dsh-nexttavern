/** Bounded data-only MVU v2. It deliberately uses atomic refusal, rather than
 * the upstream helper's per-command skip policy. No script or writer runs here. */
import {recordSha256} from './roleplay-data.js'
import {MVU_UPDATE_BOUNDS as B,reduceMvuUpdateOperations} from './roleplay-mvu-update.js'
import type {MvuPatchOperation} from './roleplay-mvu-update.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

export type MvuLegacyCommandV2=
  | {type:'set'|'insert'|'delete';path:readonly string[];args:readonly MvuJsonValue[]}
  | {type:'add';path:readonly string[];delta:MvuJsonValue}
export type MvuUpdateOperationV2=
  | {kind:'jsonpatch';operation:MvuPatchOperation}
  | {kind:'legacy';command:MvuLegacyCommandV2}
interface VersionV2 {schemaVersion:2;protocol:'native-mvu-update-v2'}
export interface MvuUpdateRejectionV2 extends VersionV2 {
  kind:'rejected';code:string;pointer?:string;operationIndex?:number
}
export interface ParsedMvuUpdateV2 extends VersionV2 {
  kind:'parsed';errorPolicy:'atomic-refusal';operations:readonly MvuUpdateOperationV2[];candidateSha256:string
}
export interface PreparedMvuUpdateV2 extends VersionV2 {
  kind:'prepared';errorPolicy:'atomic-refusal';operations:readonly MvuUpdateOperationV2[]
  baseValuesSha256:string;values:MvuJsonObject;valuesSha256:string;proposalSha256:string
}
export type MvuUpdateCandidateV2=ParsedMvuUpdateV2|MvuUpdateRejectionV2|({kind:'no-update'}&VersionV2)
export type MvuUpdatePreparationV2=PreparedMvuUpdateV2|MvuUpdateRejectionV2|({kind:'no-update'}&VersionV2)
const version={schemaVersion:2 as const,protocol:'native-mvu-update-v2' as const}
const policy={...version,errorPolicy:'atomic-refusal' as const}
const forbidden=new Set(['__proto__','constructor','prototype'])
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key)
const object=(value:unknown):value is MvuJsonObject=>!!value&&typeof value==='object'&&!Array.isArray(value)
const escaped=(key:string)=>key.replace(/~/g,'~0').replace(/\//g,'~1')
const pointerOf=(parts:readonly string[])=>parts.length?'/'+parts.map(escaped).join('/') : ''
class Refusal extends Error {
  constructor(readonly code:string,readonly pointer?:string,readonly operationIndex?:number){super(code)}
}
function reject(code:string,pointer?:string,index?:number):never {throw new Refusal(code,pointer,index)}
function rejected(error:unknown,index?:number):MvuUpdateRejectionV2 {
  return {kind:'rejected',...version,code:error instanceof Refusal?error.code:'UPDATE_INPUT_UNKNOWN',
    ...(error instanceof Refusal&&error.pointer!==undefined?{pointer:error.pointer}:{}),
    ...(error instanceof Refusal&&error.operationIndex!==undefined?{operationIndex:error.operationIndex}:
      index!==undefined?{operationIndex:index}:{})}
}
function exact(value:MvuJsonObject,fields:readonly string[],code='OPERATION_SHAPE') {
  if(fields.some(key=>!own(value,key))||Object.keys(value).some(key=>!fields.includes(key)))reject(code)
}

/** Raw operations also come from guest output. Validate descriptors before
 * reading properties, and detach aliases without invoking getters/toJSON. */
function clone(input:unknown,depthLimit:number=B.dataDepth):MvuJsonValue {
  let nodes=0,bytes=0
  const ancestors=new Set<object>()
  function visit(value:unknown,depth:number,path:string):MvuJsonValue {
    if(++nodes>B.nodes)reject('DATA_NODE_LIMIT',path)
    if(depth>depthLimit)reject('DATA_DEPTH_LIMIT',path)
    if(value===null||typeof value==='boolean')return value
    if(typeof value==='number') {
      if(!Number.isFinite(value)||Math.abs(value)>B.numberMagnitude)reject('NUMBER_LIMIT',path)
      return Object.is(value,-0)?0:value
    }
    if(typeof value==='string') {
      bytes+=Buffer.byteLength(value,'utf8');if(bytes>B.dataBytes)reject('DATA_BYTE_LIMIT',path)
      return value
    }
    if(!value||typeof value!=='object')reject('NON_JSON_VALUE',path)
    if(ancestors.has(value))reject('CYCLIC_VALUE',path)
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value)
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)reject('OBJECT_PROTOTYPE',path)
    if(Object.getOwnPropertySymbols(value).length)reject('NON_JSON_VALUE',path)
    const descriptors=Object.getOwnPropertyDescriptors(value)
    ancestors.add(value)
    const result:MvuJsonValue=array?[]:{}
    if(array) {
      const length=descriptors.length?.value as unknown
      if(typeof length!=='number'||!Number.isSafeInteger(length)||length>B.arrayLength)reject('ARRAY_LIMIT',path)
      if(Object.keys(descriptors).some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=length))) {
        reject('ARRAY_PROPERTY',path)
      }
      for(let i=0;i<length;i++) {
        const descriptor=descriptors[String(i)]
        if(!descriptor||!own(descriptor,'value')||!descriptor.enumerable)reject('NON_JSON_VALUE',path)
        ;(result as MvuJsonValue[]).push(visit(descriptor.value,depth+1,`${path}/${i}`))
      }
    } else for(const key of Object.keys(descriptors)) {
      bytes+=Buffer.byteLength(key,'utf8');if(bytes>B.dataBytes)reject('DATA_BYTE_LIMIT',path)
      if(forbidden.has(key))reject('PROTOTYPE_KEY',`${path}/${escaped(key)}`)
      const descriptor=descriptors[key]!
      if(!own(descriptor,'value')||!descriptor.enumerable)reject('NON_JSON_VALUE',path)
      ;(result as MvuJsonObject)[key]=visit(descriptor.value,depth+1,`${path}/${escaped(key)}`)
    }
    ancestors.delete(value)
    return result
  }
  const result=visit(input,0,'')
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>B.dataBytes)reject('DATA_BYTE_LIMIT')
  return result
}
function numerical(value:unknown):MvuJsonObject {
  const result=clone(value)
  if(!object(result))reject('ROOT_OBJECT_REQUIRED','')
  return result
}

/** A finite literal grammar, not JavaScript/JSON5/YAML. The same quotes can
 * delimit string values and object keys; backticks never interpolate. */
class Literals {
  offset=0
  nodes=0
  constructor(readonly text:string){}
  whitespace(){while(this.offset<this.text.length&&/[\x20\t\r\n]/.test(this.text[this.offset]!))this.offset++}
  string():string {
    const quote=this.text[this.offset++]!,chunks:string[]=[]
    while(this.offset<this.text.length) {
      const char=this.text[this.offset++]!
      if(char===quote)return chunks.join('')
      if(char.charCodeAt(0)<32)reject('STRING_CONTROL_CHARACTER')
      if(quote==='`'&&char==='$'&&this.text[this.offset]==='{')reject('STRING_INTERPOLATION_UNSUPPORTED')
      if(char!=='\\'){chunks.push(char);continue}
      const next=this.text[this.offset++]
      const escapes:Record<string,string>={'"':'"',"'":"'",'`':'`','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'}
      if(next==='u') {
        const hex=this.text.slice(this.offset,this.offset+4)
        if(!/^[0-9a-fA-F]{4}$/.test(hex))reject('STRING_ESCAPE')
        chunks.push(String.fromCharCode(parseInt(hex,16)));this.offset+=4
      } else if(next!==undefined&&own(escapes,next))chunks.push(escapes[next]!)
      else reject('STRING_ESCAPE')
    }
    reject('UNTERMINATED_STRING')
  }
  value(depth=0):MvuJsonValue {
    if(++this.nodes>B.nodes)reject('DATA_NODE_LIMIT')
    if(depth>B.dataDepth+3)reject('DATA_DEPTH_LIMIT')
    this.whitespace()
    const char=this.text[this.offset]
    if(char==='"'||char==="'"||char==='`')return this.string()
    if(char==='['||char==='{') {
      const array=char==='[',end=array?']':'}',result:MvuJsonValue=array?[]:{},keys=new Set<string>()
      this.offset++;this.whitespace()
      if(this.text[this.offset]===end){this.offset++;return result}
      while(this.offset<this.text.length) {
        this.whitespace();let key=''
        if(!array) {
          if(!['"',"'",'`'].includes(this.text[this.offset]??''))reject('NON_LITERAL_JSON')
          key=this.string()
          if(keys.has(key))reject('DUPLICATE_JSON_KEY')
          if(forbidden.has(key))reject('PROTOTYPE_KEY')
          keys.add(key);this.whitespace()
          if(this.text[this.offset++]!==':')reject('NON_LITERAL_JSON')
        }
        const item=this.value(depth+1)
        if(array) {
          if((result as MvuJsonValue[]).length>=B.arrayLength)reject('ARRAY_LIMIT')
          ;(result as MvuJsonValue[]).push(item)
        } else (result as MvuJsonObject)[key]=item
        this.whitespace()
        const separator=this.text[this.offset++]
        if(separator===end)return result
        if(separator!==',')reject('NON_LITERAL_JSON')
      }
      reject('NON_LITERAL_JSON')
    }
    const literal=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(this.text.slice(this.offset))?.[0]
    if(!literal)reject('UNSUPPORTED_VALUE_EXPRESSION')
    this.offset+=literal.length
    return clone(JSON.parse(literal))
  }
}
function pathParts(path:unknown):string[] {
  if(typeof path!=='string'||Buffer.byteLength(path,'utf8')>B.pathBytes)reject('LEGACY_PATH_FORMAT')
  if(path==='')return []
  const reader=new Literals(path),parts:string[]=[]
  function add(key:string) {
    if(forbidden.has(key))reject('PROTOTYPE_KEY')
    if(parts.length>=B.pathDepth)reject('PATH_DEPTH_LIMIT')
    parts.push(key)
  }
  while(reader.offset<path.length) {
    const char=path[reader.offset]
    if(char==='[') {
      reader.offset++;reader.whitespace()
      const next=path[reader.offset]
      let key:string
      if(next==='"'||next==="'"||next==='`')key=reader.string()
      else {
        const start=reader.offset
        while(reader.offset<path.length&&path[reader.offset]!==']')reader.offset++
        key=path.slice(start,reader.offset).trim()
        if(!key||/[\[\]'"`()]/.test(key))reject('LEGACY_PATH_FORMAT')
      }
      reader.whitespace()
      if(path[reader.offset++]!==']')reject('LEGACY_PATH_FORMAT')
      add(key)
    } else {
      let key:string
      if(char==='"'||char==="'"||char==='`')key=reader.string()
      else {
        const start=reader.offset
        while(reader.offset<path.length&&path[reader.offset]!=='.'&&path[reader.offset]!=='[')reader.offset++
        key=path.slice(start,reader.offset)
        if(!key||key!==key.trim()||/[\]'"`()]/.test(key))reject('LEGACY_PATH_FORMAT')
      }
      add(key)
    }
    if(reader.offset===path.length)break
    if(path[reader.offset]==='[')continue
    if(path[reader.offset++]!=='.'||reader.offset===path.length||path[reader.offset]==='[')reject('LEGACY_PATH_FORMAT')
  }
  return parts
}
function validateParts(input:unknown):string[] {
  if(!Array.isArray(input)||input.length>B.pathDepth||input.some(x=>typeof x!=='string'))reject('LEGACY_PATH_FORMAT')
  const parts=input as string[]
  // Joining here measures only cost; it never reparses or resolves literal segments.
  if(Buffer.byteLength(parts.join('.'),'utf8')>B.pathBytes)reject('PATH_BYTE_LIMIT')
  for(const key of parts)if(forbidden.has(key))reject('PROTOTYPE_KEY',pointerOf(parts))
  return [...parts]
}
function jsonPointer(path:unknown):string[] {
  if(typeof path!=='string'||Buffer.byteLength(path,'utf8')>B.pathBytes||path!==''&&!path.startsWith('/'))reject('POINTER_FORMAT')
  if(path==='')return []
  const segments=path.slice(1).split('/')
  if(segments.length>B.pathDepth)reject('POINTER_DEPTH_LIMIT',path)
  const parts=segments.map(key=>{
    if(/~(?:[^01]|$)/.test(key))reject('POINTER_ESCAPE',path)
    return key.replace(/~1/g,'/').replace(/~0/g,'~')
  })
  return validateParts(parts)
}
function command(type:string,path:string[],args:MvuJsonValue[]):MvuLegacyCommandV2 {
  if(args.length>B.arrayLength)reject('ARRAY_LIMIT')
  if(type==='move')reject('LEGACY_COMMAND_UNSUPPORTED')
  if(type==='assign')type='insert'
  if(type==='remove'||type==='unset')type='delete'
  if(type==='add') {
    if(args.length!==1)reject('LEGACY_ARGUMENT_COUNT')
    return {type,path,delta:clone(args[0])}
  }
  if(type!=='set'&&type!=='insert'&&type!=='delete')reject('LEGACY_COMMAND_UNSUPPORTED')
  if(type!=='delete'&&args.length<1)reject('LEGACY_ARGUMENT_COUNT')
  return {type,path,args:args.map(value=>clone(value))}
}
const markup=/<\/?\s*(?:UpdateVariable|JSONPatch|json_patch|Analyze|Analysis)\b/i
const invocation=/\b_\s*\.\s*[a-zA-Z]+\s*\(/
function bodyOf(narrative:string,region?:{outside?:string}):string|undefined {
  if(typeof narrative!=='string')reject('NARRATIVE_TYPE')
  if(Buffer.byteLength(narrative,'utf8')>B.dataBytes)reject('NARRATIVE_BYTE_LIMIT')
  if(!markup.test(narrative)) {
    if(invocation.test(narrative))reject('UPDATE_CONTAINER_REQUIRED')
    return
  }
  const tags:{text:string;index:number}[]=[]
  let cursor=0
  while(cursor<narrative.length) {
    const index=narrative.indexOf('<',cursor)
    if(index<0)break
    cursor=index+1
    if(!/^<\/?UpdateVariable\b/i.test(narrative.slice(index,index+32)))continue
    const close=narrative.indexOf('>',cursor)
    if(close<0)reject('UPDATE_CONTAINER_FORMAT')
    tags.push({text:narrative.slice(index,close+1),index});cursor=close+1
    if(tags.length>2)reject('AMBIGUOUS_UPDATE_CONTAINER')
  }
  if(tags.length!==2||tags[0]!.text!=='<UpdateVariable>'||tags[1]!.text!=='</UpdateVariable>')reject('UPDATE_CONTAINER_FORMAT')
  const start=tags[0]!.index,end=tags[1]!.index+tags[1]!.text.length,block=narrative.slice(start,end)
  if(Buffer.byteLength(block,'utf8')>B.blockBytes)reject('UPDATE_BLOCK_BYTE_LIMIT')
  const outside=narrative.slice(0,start)+narrative.slice(end)
  if(markup.test(outside)||invocation.test(outside))reject('STRAY_UPDATE_MARKUP')
  if(region)region.outside=outside
  let body=block.slice(16,-17).trim()
  if(body.startsWith('<Analyze>')) {
    const close=body.indexOf('</Analyze>')
    if(close<0)reject('ANALYZE_FORMAT')
    if(/<\/?[A-Za-z]/.test(body.slice(9,close)))reject('NESTED_UPDATE_MARKUP')
    body=body.slice(close+10).trim()
  }
  return body
}
function jsonOperation(raw:unknown):MvuUpdateOperationV2 {
  const value=clone(raw,B.dataDepth+1)
  if(!object(value)||typeof value.op!=='string')reject('OPERATION_SHAPE')
  if(value.op==='delta'||value.op==='insert') {
    exact(value,['op','path','value'])
    const path=jsonPointer(value.path)
    if(value.op==='delta')return {kind:'legacy',command:command('add',path,[value.value!])}
    if(!path.length)reject('ROOT_INSERT_UNSUPPORTED','')
    const key=path.pop()!
    const selector=/^(0|[1-9]\d*)$/.test(key)?Number(key):key
    return {kind:'legacy',command:command('insert',path,[selector,value.value!])}
  }
  if(!['test','replace','add','remove','copy','move'].includes(value.op))reject('OPERATION_UNSUPPORTED')
  const fields=value.op==='copy'||value.op==='move'?['op','path','from']:
    value.op==='remove'?['op','path']:['op','path','value']
  exact(value,fields);jsonPointer(value.path)
  let operation:MvuPatchOperation
  if(value.op==='copy'||value.op==='move') {
    jsonPointer(value.from)
    operation={op:value.op,path:value.path as string,from:value.from as string}
  } else if(value.op==='remove')operation={op:'remove',path:value.path as string}
  else operation={op:value.op as 'test'|'replace'|'add',path:value.path as string,value:clone(value.value)}
  // Shape validation is data-only. Do not re-encode guest data as narrative:
  // a wrapper's 64KiB limit is not the reducer's 1MiB data budget. Actual RFC
  // execution remains the unchanged old pure reducer, including all failures.
  return {kind:'jsonpatch',operation}
}
function operationsOf(body:string):MvuUpdateOperationV2[] {
  if(body.startsWith('<JSONPatch>')) {
    if(!body.endsWith('</JSONPatch>'))reject('UPDATE_CONTENT_UNSUPPORTED')
    const text=body.slice(11,-12)
    if(Buffer.byteLength(text,'utf8')>B.jsonBytes)reject('JSON_BYTE_LIMIT')
    if(markup.test(text))reject('NESTED_UPDATE_MARKUP')
    const reader=new Literals(text),raw=reader.value()
    reader.whitespace();if(reader.offset!==text.length)reject('NON_LITERAL_JSON')
    if(!Array.isArray(raw))reject('PATCH_ARRAY_REQUIRED')
    if(!raw.length)reject('EMPTY_PATCH')
    if(raw.length>B.operations)reject('OPERATION_LIMIT')
    return raw.map((value,index)=>{
      try{return jsonOperation(value)}catch(error){throw error instanceof Refusal?
        new Refusal(error.code,error.pointer,index):error}
    })
  }
  const reader=new Literals(body),result:MvuUpdateOperationV2[]=[]
  while(reader.offset<body.length) {
    reader.whitespace()
    if(body.startsWith('//',reader.offset)) {
      while(reader.offset<body.length&&body[reader.offset]!=='\n')reader.offset++
      continue
    }
    if(reader.offset===body.length)break
    const index=result.length
    try {
      if(index>=B.operations)reject('OPERATION_LIMIT')
      if(!body.startsWith('_.',reader.offset))reject('LEGACY_COMMAND_FORMAT')
      reader.offset+=2;const start=reader.offset
      while(reader.offset<body.length&&/[a-zA-Z]/.test(body[reader.offset]!))reader.offset++
      const type=body.slice(start,reader.offset)
      if(type==='move')reject('LEGACY_COMMAND_UNSUPPORTED')
      if(body[reader.offset++]!=='(')reject('LEGACY_COMMAND_FORMAT')
      const args:MvuJsonValue[]=[]
      reader.whitespace()
      if(body[reader.offset]!==')')while(true) {
        args.push(reader.value());reader.whitespace()
        if(body[reader.offset]===')')break
        if(body[reader.offset++]!==',')reject('UNSUPPORTED_VALUE_EXPRESSION')
      }
      reader.offset++
      if(body[reader.offset++]!==';')reject('LEGACY_SEMICOLON_REQUIRED')
      result.push({kind:'legacy',command:command(type,pathParts(args[0]),args.slice(1))})
    } catch(error) {throw error instanceof Refusal?new Refusal(error.code,error.pointer,index):error}
  }
  if(!result.length)reject('EMPTY_UPDATE')
  return result
}

function normalized(raw:unknown):MvuUpdateOperationV2 {
  const value=clone(raw,B.dataDepth+3)
  if(!object(value))reject('OPERATION_SHAPE')
  if(value.kind==='jsonpatch') {
    exact(value,['kind','operation'])
    const next=jsonOperation(value.operation)
    if(next.kind!=='jsonpatch')reject('OPERATION_KIND_MISMATCH')
    return next
  }
  if(value.kind!=='legacy')reject('OPERATION_KIND_UNSUPPORTED')
  exact(value,['kind','command'])
  const cmd=value.command
  if(!object(cmd)||typeof cmd.type!=='string')reject('LEGACY_COMMAND_SHAPE')
  exact(cmd,cmd.type==='add'?['type','path','delta']:['type','path','args'],'LEGACY_COMMAND_SHAPE')
  if(!['set','add','insert','delete'].includes(cmd.type))reject('LEGACY_COMMAND_UNSUPPORTED')
  const path=validateParts(cmd.path)
  if(cmd.type==='add')return {kind:'legacy',command:command('add',path,[cmd.delta!])}
  if(!Array.isArray(cmd.args))reject('LEGACY_COMMAND_SHAPE')
  return {kind:'legacy',command:command(cmd.type,path,cmd.args)}
}
function operationPackage(raw:unknown):MvuUpdateOperationV2[] {
  if(!Array.isArray(raw))reject('PATCH_ARRAY_REQUIRED')
  // Count bytes/nodes over the whole package, including its data envelopes.
  // A legacy value sits below array/op/command/args: reserve four levels here;
  // command() and the RFC parser independently enforce the value's own depth32.
  const safe=clone(raw,B.dataDepth+4) as MvuJsonValue[]
  if(safe.length>B.operations)reject('OPERATION_LIMIT')
  return safe.map((value,index)=>{
    try{return normalized(value)}catch(error){throw error instanceof Refusal?
      new Refusal(error.code,error.pointer,index):error}
  })
}
function index(key:string,length:number,path:string):number {
  if(!/^(0|[1-9]\d*)$/.test(key))reject('ARRAY_INDEX',path)
  const result=Number(key)
  if(!Number.isSafeInteger(result)||result>=length)reject('PATH_MISSING',path)
  return result
}
function read(root:MvuJsonValue,path:readonly string[]):MvuJsonValue {
  let value=root
  for(const key of path) {
    if(Array.isArray(value))value=value[index(key,value.length,pointerOf(path))]!
    else if(object(value)&&own(value,key))value=value[key]!
    else reject('PATH_MISSING',pointerOf(path))
  }
  return value
}
function write(root:MvuJsonObject,path:readonly string[],value:MvuJsonValue,remove=false):MvuJsonObject {
  if(!path.length) {
    if(remove)reject('ROOT_REMOVE_UNSUPPORTED','')
    return numerical(value)
  }
  const parent=read(root,path.slice(0,-1)),key=path.at(-1)!
  if(Array.isArray(parent)) {
    const i=index(key,parent.length,pointerOf(path))
    if(remove)parent.splice(i,1)
    else parent[i]=value
  } else if(object(parent)&&own(parent,key)) {
    if(remove)delete parent[key]
    else parent[key]=value
  } else reject('PATH_MISSING',pointerOf(path))
  return root
}
function merge(target:MvuJsonValue,source:MvuJsonValue,depth=0):MvuJsonValue {
  if(depth>B.dataDepth)reject('DATA_DEPTH_LIMIT')
  if(Array.isArray(source)) {
    const result=Array.isArray(target)?target:[]
    for(let i=0;i<source.length;i++)result[i]=merge(result[i]??null,source[i]!,depth+1)
    return result
  }
  if(object(source)) {
    if(Array.isArray(target))reject('MERGE_TYPE_UNSUPPORTED')
    const result:MvuJsonObject=object(target)?target:{}
    for(const key of Object.keys(source))result[key]=merge(result[key]??null,source[key]!,depth+1)
    return result
  }
  return clone(source)
}
function scalarNumber(value:MvuJsonValue):number {
  // Values are already detached finite JSON; conversion cannot call an author
  // getter or prototype override. This preserves the upstream VWD Number cast.
  let number:number
  try {number=typeof value==='number'?value:Number(value)}catch {reject('NUMBER_LIMIT')}
  if(!Number.isFinite(number)||Math.abs(number)>B.numberMagnitude)reject('NUMBER_LIMIT')
  return Object.is(number,-0)?0:number
}
function applyLegacy(root:MvuJsonObject,cmd:MvuLegacyCommandV2):MvuJsonObject {
  const current=read(root,cmd.path),path=pointerOf(cmd.path)
  if(cmd.type==='set') {
    const value=clone(cmd.args.at(-1))
    if(Array.isArray(current)&&current.length===2&&typeof current[1]==='string'&&!Array.isArray(current[0])) {
      current[0]=typeof current[0]==='number'&&value!==null?scalarNumber(value):value
      return root
    }
    return write(root,cmd.path,typeof current==='number'&&typeof value==='string'?scalarNumber(value):value)
  }
  if(cmd.type==='add') {
    const wrapped=Array.isArray(current)&&current.length===2&&typeof current[1]==='string'&&typeof current[0]!=='object'
    const value=wrapped?current[0]:current
    if(typeof value!=='number')reject('ADD_TARGET_NOT_NUMBER',path)
    if(typeof cmd.delta!=='number')reject('ADD_DELTA_NOT_NUMBER',path)
    // Enforce the finite JSON bound before rounding: twelve significant
    // digits can otherwise hide a sum just beyond the permitted magnitude.
    const sum=scalarNumber(value+cmd.delta)
    const next=scalarNumber(parseFloat(sum.toPrecision(12)))
    if(wrapped){current[0]=next;return root}
    return write(root,cmd.path,next)
  }
  if(cmd.type==='insert') {
    if(!object(current)&&!Array.isArray(current))reject('INSERT_TARGET_NOT_COLLECTION',path)
    if(cmd.args.length===1) {
      const value=clone(cmd.args[0])
      if(Array.isArray(current))current.push(value)
      else {
        if(!object(value))reject('MERGE_VALUE_NOT_OBJECT',path)
        merge(current,value)
      }
    } else {
      const key=cmd.args[0]!,value=clone(cmd.args[1])
      if(Array.isArray(current)) {
        if(key!=='-'&&typeof key!=='number')reject('ARRAY_INDEX',path)
        // JS splice intentionally supplies the upstream negative/oversize index semantics.
        current.splice(key==='-'?current.length:key as number,0,value)
      } else {
        if(typeof key!=='string'&&typeof key!=='number')reject('OBJECT_KEY_TYPE',path)
        if(forbidden.has(String(key)))reject('PROTOTYPE_KEY',path)
        current[String(key)]=value
      }
    }
    return root
  }
  if(!cmd.args.length)return write(root,cmd.path,null,true)
  const selector=cmd.args[0]!
  if(Array.isArray(current)) {
    const i=typeof selector==='number'?selector:current.findIndex(item=>recordSha256(item)===recordSha256(selector))
    if(i<0||i>=current.length)reject('DELETE_TARGET_MISSING',path)
    current.splice(i,1)
  } else if(object(current)) {
    // recordSha256 sorts keys, so insertion-order object index deletion cannot
    // be faithfully bound to this protocol's base hash. Array indices remain supported.
    if(typeof selector==='number')reject('OBJECT_INDEX_UNSUPPORTED',path)
    if(typeof selector!=='string')reject('OBJECT_KEY_TYPE',path)
    if(forbidden.has(selector))reject('PROTOTYPE_KEY',path)
    if(!own(current,selector))reject('DELETE_TARGET_MISSING',path)
    delete current[selector]
  } else reject('DELETE_TARGET_NOT_COLLECTION',path)
  return root
}
/** The Source classifier consumes only the remainder of this same parsed
 * container. It cannot exempt unrelated state syntax elsewhere in the card. */
export function parseMvuUpdateRegionV2(narrative:string):{candidate:MvuUpdateCandidateV2;outside:string} {
  try {
    const region:{outside?:string}={},body=bodyOf(narrative,region)
    if(body===undefined)return {candidate:{kind:'no-update',...version},outside:narrative}
    const operations=operationPackage(operationsOf(body)),descriptor={...policy,operations}
    return {candidate:{kind:'parsed',...descriptor,candidateSha256:recordSha256(descriptor)},outside:region.outside!}
  } catch(error){return {candidate:rejected(error),outside:narrative}}
}
export function parseMvuUpdateV2(narrative:string):MvuUpdateCandidateV2 {
  return parseMvuUpdateRegionV2(narrative).candidate
}
export function reduceMvuUpdateOperationsV2(baseValues:MvuJsonObject,
  rawOperations:readonly unknown[]):PreparedMvuUpdateV2|MvuUpdateRejectionV2 {
  let operationIndex:number|undefined
  try {
    const supplied=operationPackage(rawOperations)
    const base=numerical(baseValues),baseValuesSha256=recordSha256(base),operations:MvuUpdateOperationV2[]=[]
    let values=base
    for(const [i,op] of supplied.entries()) {
      operationIndex=i
      if(op.kind==='jsonpatch') {
        const result=reduceMvuUpdateOperations(values,[op.operation])
        if(result.kind==='rejected')reject(result.code,result.pointer)
        values=result.values
      } else values=numerical(applyLegacy(values,op.command))
      operations.push(op)
    }
    const valuesSha256=recordSha256(values),descriptor={...policy,operations,baseValuesSha256,valuesSha256}
    return {kind:'prepared',...descriptor,values,proposalSha256:recordSha256(descriptor)}
  } catch(error){return rejected(error,operationIndex)}
}
export function prepareMvuUpdateV2(narrative:string,baseValues:MvuJsonObject):MvuUpdatePreparationV2 {
  const candidate=parseMvuUpdateV2(narrative)
  return candidate.kind==='parsed'?reduceMvuUpdateOperationsV2(baseValues,candidate.operations):candidate
}
