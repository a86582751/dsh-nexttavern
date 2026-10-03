/** Trusted worker owns the VM, atomic v2 updates and sealed v3 scope reads.
 * Guests see JSON copies and pinned libraries, never Node handles or write owners. */
import {parentPort,workerData} from 'node:worker_threads'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import ts from 'typescript'
import {reduceSchemaUpdateOperationV2,mergeSchemaUpdateValuesV2} from './tavern-mvu-schema-update-effects-v2.js'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,cloneSchemaValues,schemaTextSha256,validateSchemaProgram} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validateSchemaEvaluationInputV3,validateSchemaGuestOutputV3,
  validateSchemaTraceInputV3,validateSchemaScopeProgramFrameV3} from './tavern-mvu-schema-runner-v3.js'
import {createMvuScopeReaderV1,readMvuVariable,MvuScopeReadError} from './tavern-mvu-scope-read.js'
import type {MvuUpdateOperationV2} from './roleplay-mvu-update-v2.js'
import type {MvuSchemaCleanupEffectV2} from './tavern-mvu-schema-update-effects-v2.js'
import type {MvuJsonObject} from './tavern-mvu-json-types-v3.js'
import type {QuickJSContext,QuickJSHandle,QuickJSRuntime} from 'quickjs-emscripten-core'
import type {MvuSchemaWorkerRequestV3,MvuSchemaWorkerResponseV3} from './tavern-mvu-schema-runner-v3.js'
import type {MvuSchemaEvaluationInputV3,MvuSchemaTraceFrameV3} from './tavern-mvu-schema-types-v3.js'

const require=createRequire(import.meta.url)
const MAX_JOBS=1024
const scopedNames=['getVariables','getAllVariables','getMvuData','getMvuVariable','getvar',
  'Mvu','registerMvuSchema','$','jQuery','readSchemaSource','waitGlobalInitialized','globalThis'] as const
const unavailable=(code:string):MvuSchemaWorkerResponseV3=>({kind:'unavailable',code})
class GuestRefusal extends Error {constructor(readonly code:string){super(code)}}
function guestError(error:QuickJSHandle,_context?:QuickJSContext):never {
  // A primitive string is just as forgeable as an Error.message. Only normal
  // controller return branches can produce a completed refusal envelope.
  error.dispose()
  throw new GuestRefusal('SCHEMA_GUEST_ERROR')
}
function checked(result:{value?:QuickJSHandle;error?:QuickJSHandle},context?:QuickJSContext):QuickJSHandle {
  if(result.error)guestError(result.error,context)
  return result.value!
}
function runJobs(runtime:QuickJSRuntime,context:QuickJSContext,budget:{jobs:number}):void {
  while(runtime.hasPendingJob()) {
    if(budget.jobs++>=MAX_JOBS)throw new GuestRefusal('SCHEMA_JOB_LIMIT')
    const result=runtime.executePendingJobs(1)
    if(result.error)guestError(result.error,context)
  }
}
function completed(context:QuickJSContext,runtime:QuickJSRuntime,handle:QuickJSHandle,budget:{jobs:number}):void {
  runJobs(runtime,context,budget)
  const state=context.getPromiseState(handle)
  if(state.type==='pending')throw new GuestRefusal('SCHEMA_ASYNC_UNSETTLED')
  if(state.type==='rejected')guestError(state.error,context)
  if(state.type==='fulfilled'&&!state.notAPromise)state.value.dispose()
}
function peerVersions():boolean {
  if(ts.version!=='5.9.3')return false
  for(const name of ['quickjs-emscripten-core','@jitl/quickjs-wasmfile-release-sync']) {
    const metadata=JSON.parse(readFileSync(resolve(dirname(require.resolve(name)),'..','package.json'),'utf8'))
    if(metadata.name!==name||metadata.version!=='0.32.0')return false
  }
  return true
}

/** Module-local namespace references survive every async continuation. The
 * checker binds only this source: no host libraries, dependency resolution or
 * execution. Local names and property keys remain the author's own bindings. */
function bindAuthorScope(javascript:string,filename:string,moduleName:string):string {
  const file=ts.createSourceFile(filename,javascript,ts.ScriptTarget.ES2023,true,ts.ScriptKind.JS)
  if((file as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length) {
    throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_INVALID')
  }
  const options:ts.CompilerOptions={allowJs:true,checkJs:false,noResolve:true,noLib:true,
    target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}
  const host:ts.CompilerHost={getSourceFile:name=>name===filename?file:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},
    getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:name=>name===filename,
    readFile:name=>name===filename?javascript:undefined,getCanonicalFileName:name=>name,
    useCaseSensitiveFileNames:()=>true,getNewLine:()=>'\n'}
  const checker=ts.createProgram([filename],options,host).getTypeChecker()
  const pending:{node:ts.Node;depth:number}[]=[{node:file,depth:0}],identifiers=new Set<string>()
  let visited=0
  while(pending.length) {
    const {node,depth}=pending.pop()!
    if(++visited>MVU_SCHEMA_BOUNDS.syntaxTokens||depth>MVU_SCHEMA_BOUNDS.syntaxDepth) {
      throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_LIMIT')
    }
    if(ts.isIdentifier(node))identifiers.add(node.text)
    ts.forEachChild(node,child=>{pending.push({node:child,depth:depth+1})})
  }
  let namespace='__nativeMvuScope'
  while(identifiers.has(namespace))namespace+='_' 
  const bound=new Set<string>(scopedNames)
  const free=(node:ts.Identifier)=>!checker.getSymbolAtLocation(node)?.declarations?.length
  const nameOnly=(node:ts.Identifier)=>{
    const parent=node.parent
    return ts.isPropertyAccessExpression(parent)&&parent.name===node
      ||(ts.isPropertyAssignment(parent)||ts.isMethodDeclaration(parent)||ts.isPropertyDeclaration(parent)
        ||ts.isGetAccessorDeclaration(parent)||ts.isSetAccessorDeclaration(parent))&&parent.name===node
      ||ts.isBindingElement(parent)&&parent.propertyName===node
      ||ts.isImportSpecifier(parent)||ts.isExportSpecifier(parent)
      ||ts.isLabeledStatement(parent)&&parent.label===node
      ||(ts.isBreakStatement(parent)||ts.isContinueStatement(parent))&&parent.label===node
  }
  const transformed=ts.transform(file,[context=>{
    const member=(name:string)=>context.factory.createPropertyAccessExpression(
      context.factory.createIdentifier(namespace),name)
    const visit:ts.Visitor=node=>{
      if(ts.isShorthandPropertyAssignment(node)&&bound.has(node.name.text)
        &&!checker.getShorthandAssignmentValueSymbol(node)?.declarations?.length) {
        if(node.objectAssignmentInitializer)throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_INVALID')
        return context.factory.createPropertyAssignment(node.name,member(node.name.text))
      }
      if(ts.isIdentifier(node)&&bound.has(node.text)&&!nameOnly(node)&&free(node))return member(node.text)
      return ts.visitEachChild(node,visit,context)
    }
    return root=>{
      const rewritten=ts.visitNode(root,visit) as ts.SourceFile
      const imported=context.factory.createImportDeclaration(undefined,context.factory.createImportClause(false,undefined,
        context.factory.createNamespaceImport(context.factory.createIdentifier(namespace))),
      context.factory.createStringLiteral(moduleName),undefined)
      return context.factory.updateSourceFile(rewritten,[imported,...rewritten.statements])
    }
  }])
  try {
    const source=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(transformed.transformed[0]!)
    if(Buffer.byteLength(source,'utf8')>MVU_SCHEMA_BOUNDS.programBytes)throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_LIMIT')
    return source
  } finally {transformed.dispose()}
}

// This prelude runs before trusted libraries as well as author code. Date's
// original constructor remains only in this closure, including through the
// prototype; no guest path exposes real time or the old Math.random function.
const DETERMINISM=String.raw`(wire=>{
  const parse=JSON.parse,OriginalDate=Date,construct=Reflect.construct,imul=Math.imul;
  const char=String.prototype.charCodeAt,apply=Reflect.apply;
  let clock,seed;
  function frame(wire){const input=parse(wire);clock=input.clockEpochMs;seed=2166136261;
    for(let index=0;index<input.randomSeed.length;index++)seed=imul(seed^apply(char,input.randomSeed,[index]),16777619)>>>0;}
  frame(wire);
  function FixedDate(...args){const value=construct(OriginalDate,args.length?args:[clock]);
    return new.target?value:value.toString();}
  FixedDate.prototype=OriginalDate.prototype;
  Object.defineProperty(FixedDate.prototype,'constructor',{value:FixedDate,writable:false,configurable:false});
  FixedDate.now=()=>clock;FixedDate.parse=OriginalDate.parse;FixedDate.UTC=OriginalDate.UTC;
  Object.defineProperty(globalThis,'Date',{value:FixedDate,writable:false,configurable:false});
  Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  // Only the worker holds this frame setter. Re-seeding per event is an owned
  // deterministic replay rule, not an emulation of a host-wide RNG lifetime.
  return frame;
})`

/** All transport serialization uses captured intrinsics and data descriptors.
 * Proxy is unavailable to author code, and serialization never calls toJSON,
 * getters, valueOf or a guest object's iterator. Input strings are VM values,
 * not concatenated source. The controller handles stay private to this worker. */
const BOOTSTRAP=String.raw`((wire,materialWire,libraryWire,scriptWire,reduceOperation,mergeOperation,readOperation)=>{
  'use strict';
  const G=globalThis,O=Object,A=Array,Jparse=JSON.parse,Jstring=JSON.stringify,apply=Reflect.apply;
  const descriptors=O.getOwnPropertyDescriptors,keys=O.keys,symbols=O.getOwnPropertySymbols,proto=O.getPrototypeOf;
  const array=A.isArray,own=O.hasOwn,freeze=O.freeze,define=O.defineProperty,finite=Number.isFinite;
  const char=String.prototype.charCodeAt,push=A.prototype.push,slice=A.prototype.slice;
  const objectProto=O.prototype,arrayProto=A.prototype;
  let input=Jparse(wire);const material=Jparse(materialWire),libraries=Jparse(libraryWire),scripts=Jparse(scriptWire);
  const zNamespace=G[libraries.zod],z=zNamespace.z||zNamespace,rawLodash=G[libraries.lodash],lodash=rawLodash.default||rawLodash;
  const ZodObject=z.ZodObject,looseObject=z.looseObject;
  const registrations=[],readyCallbacks=[];
  let values=input.values,commands=input.commands,metadata=input.context;
  let scopeFault;
  const fail=code=>{throw code;};
  function utf8(text){let bytes=0;for(let index=0;index<text.length;index++){
    const point=apply(char,text,[index]);if(point<128)bytes++;else if(point<2048)bytes+=2;
    else if(point>=55296&&point<=56319&&index+1<text.length){
      const next=apply(char,text,[index+1]);if(next>=56320&&next<=57343){bytes+=4;index++;}else bytes+=3;
    }else bytes+=3;}return bytes;}
  function encode(value,maxBytes=2097152,maxDepth=64,maxNodes=64000){
    let nodes=0,bytes=0;const ancestors=[];
    const append=text=>{bytes+=utf8(text);if(bytes>maxBytes)fail('SCHEMA_OUTPUT_LIMIT');return text;};
    function visit(item,depth){
      if(++nodes>maxNodes||depth>maxDepth)fail('SCHEMA_OUTPUT_LIMIT');
      if(item===null)return append('null');
      if(typeof item==='boolean')return append(item?'true':'false');
      if(typeof item==='number'){
        if(!finite(item)||item>9007199254740991||item<-9007199254740991)fail('SCHEMA_OUTPUT_DATA_INVALID');
        return append(Jstring(item));}
      if(typeof item==='string')return append(Jstring(item));
      if(!item||typeof item!=='object')fail('SCHEMA_OUTPUT_DATA_INVALID');
      for(let index=0;index<ancestors.length;index++)if(ancestors[index]===item)fail('SCHEMA_OUTPUT_DATA_INVALID');
      const isArray=array(item),prototype=proto(item);
      if(isArray?prototype!==arrayProto:prototype!==objectProto&&prototype!==null)fail('SCHEMA_OUTPUT_DATA_INVALID');
      if(symbols(item).length)fail('SCHEMA_OUTPUT_DATA_INVALID');
      const fields=descriptors(item),names=keys(fields);
      apply(push,ancestors,[item]);
      let result=append(isArray?'[':'{');
      if(isArray){
        const length=fields.length.value;if(length>4096||names.length!==length+1)fail('SCHEMA_OUTPUT_LIMIT');
        for(let index=0;index<length;index++){
          const field=fields[index];if(!field||!own(field,'value')||!field.enumerable)fail('SCHEMA_OUTPUT_DATA_INVALID');
          if(index)result+=append(',');result+=visit(field.value,depth+1);}
      }else for(let index=0;index<names.length;index++){
        const name=names[index],field=fields[name];
        if(name==='__proto__'||name==='constructor'||name==='prototype'||!field.enumerable||!own(field,'value')) {
          fail('SCHEMA_OUTPUT_DATA_INVALID');}
        if(index)result+=append(',');result+=append(Jstring(name))+append(':')+visit(field.value,depth+1);}
      ancestors.length--;return result+append(isArray?']':'}');
    }
    return visit(value,0);
  }
  const clone=value=>Jparse(encode(value));
  function numerical(value){
    if(!value||typeof value!=='object'||array(value))fail('SCHEMA_ROOT_OBJECT_REQUIRED');
    return Jparse(encode(value,1048576,32,32000));}
  function frozen(value){if(value&&typeof value==='object'){
    const names=keys(value);for(let index=0;index<names.length;index++)frozen(value[names[index]]);freeze(value);}return value;}
  let source=frozen(material);
  function readSource(){if(arguments.length)fail('SCHEMA_READ_UNSUPPORTED');return source;}
  function schemaFor(entry){
    const registration=entry.registration;
    const schema=typeof registration==='function'?registration():registration;
    if(!schema||typeof schema.safeParse!=='function')fail('SCHEMA_REGISTRATION_INVALID');
    return schema instanceof ZodObject?apply(looseObject,z,[schema.shape]):schema;
  }
  function parse(schema,candidate){
    const result=schema.safeParse(clone(candidate));
    if(!result||typeof result!=='object')fail('SCHEMA_SCHEMA_RESULT_INVALID');
    const success=descriptors(result).success;
    if(!success||!own(success,'value'))fail('SCHEMA_SCHEMA_RESULT_INVALID');
    if(success.value===false)return null;
    if(success.value!==true)fail('SCHEMA_SCHEMA_RESULT_INVALID');
    return numerical(result.data);
  }
  const outputWire={schemaVersion:3,encoding:'native-mvu-author-schema-phase-output-v3',
    commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:'atomic-refusal'};
  const refused=diagnostics=>encode({...outputWire,kind:'refused',diagnostics:scopeFault?[scopeFault]:diagnostics});
  function registerMvuSchema(owner,registration){
    if(registrations.length>=64)fail('SCHEMA_REGISTRATION_LIMIT');
    const entry={owner,registration};schemaFor(entry);apply(push,registrations,[entry]);
  }
  function ready(owner,callback){if(typeof callback!=='function')fail('SCHEMA_READY_INVALID');
    if(readyCallbacks.length>=64)fail('SCHEMA_JOB_LIMIT');apply(push,readyCallbacks,[{owner,callback}]);}
  const unbound=()=>fail('SCHEMA_SCOPE_OWNER_UNAVAILABLE');
  const globals={z,_:lodash,$:unbound,jQuery:unbound,registerMvuSchema:unbound,getVariables:unbound,
    getAllVariables:unbound,getvar:unbound,getMvuVariable:unbound,getMvuData:unbound,
    readSchemaSource:unbound,waitGlobalInitialized:unbound,
    console:freeze({log(){},info(){},warn(){},error(){}})};
  const names=keys(globals);
  for(let index=0;index<names.length;index++)define(G,names[index],{value:globals[names[index]],writable:false,configurable:false});
  for(const name of ['Proxy','process','require','fetch','WebSocket','XMLHttpRequest','window','document','navigator',
    'localStorage','sessionStorage','setTimeout','setInterval','queueMicrotask','Deno','Bun']) {
    define(G,name,{value:undefined,writable:false,configurable:false});}
  const Mvu=freeze({getMvuData:unbound,getMvuVariable:unbound});
  define(G,'Mvu',{value:Mvu,writable:false,configurable:false});
  function optionData(option){
    if(!option||typeof option!=='object'||array(option))return option;
    const fields=descriptors(option),result={};
    if(symbols(option).length||proto(option)!==objectProto&&proto(option)!==null)fail('SCHEMA_OUTPUT_DATA_INVALID');
    for(const name of keys(fields)){
      const field=fields[name];
      if(!own(field,'value')||!field.enumerable||name==='__proto__'||name==='constructor'||name==='prototype') {
        fail('SCHEMA_OUTPUT_DATA_INVALID');}
      if(field.value!==undefined)define(result,name,{value:field.value,enumerable:true});
    }
    return result;
  }
  function scopeCall(owner,method,fields){
    let result;
    try {const data=typeof fields==='function'?fields():fields;
      result=Jparse(readOperation(encode({schemaVersion:1,encoding:'native-mvu-scope-read-call-v1',
        scriptId:owner.scriptId,method,...data},8388608)));}
    catch(error){scopeFault={code:'SCHEMA_SCOPE_READ_FAILED',scriptPointer:owner.pointer,
      readCode:'SCHEMA_OUTPUT_DATA_INVALID'};throw error;}
    if(result.kind==='unavailable'){
      scopeFault={code:'SCHEMA_SCOPE_READ_FAILED',scriptPointer:owner.pointer,readCode:result.code};fail(result.code);}
    if(result.kind!=='read'||typeof result.present!=='boolean')fail('SCHEMA_SCOPE_CALLBACK_FAILED');
    return result.present?frozen(result.value):undefined;
  }
  function capabilities(scriptId){
    let owner;
    for(const script of scripts)if(script.scriptId===scriptId){owner=script;break;}
    if(!owner)fail('SCHEMA_SCOPE_OWNER_UNAVAILABLE');
    function getVariables(option){return scopeCall(owner,'variables',()=>
      option===undefined?{}:{option:optionData(option)});}
    function getAllVariables(){if(arguments.length)fail('SCHEMA_READ_UNSUPPORTED');return scopeCall(owner,'all',{});}
    function getMvuVariable(data,path,options){
      return scopeCall(owner,'variable',()=>({data,path,...(options===undefined?{}:{option:optionData(options)})}));}
    function getvar(path){if(arguments.length!==1||typeof path!=='string')fail('SCHEMA_READ_UNSUPPORTED');
      return getMvuVariable({stat_data:getAllVariables()},path);}
    const jq=argument=>{if(typeof argument==='function'){ready(owner,argument);return;}
      fail('SCHEMA_HOST_UNAVAILABLE');};
    const mvu=freeze({getMvuData:getVariables,getMvuVariable});
    const bound=freeze({getVariables,getAllVariables,getMvuData:getVariables,getMvuVariable,getvar,Mvu:mvu,
      registerMvuSchema:registration=>registerMvuSchema(owner,registration),$:jq,jQuery:jq,
      readSchemaSource:readSource,waitGlobalInitialized:async name=>{if(name!=='Mvu')fail('SCHEMA_HOST_UNAVAILABLE');}});
    // The facade contains only VM intrinsics and this owner's functions. Its
    // methods close over owner; dynamic lookups and extracted aliases cannot
    // inherit another script's most recent callback or module-load context.
    const facade=O.create(null),globalFields=descriptors(G);
    for(const name of keys(globalFields))if(name!=='globalThis'&&!own(bound,name)){
      const field=globalFields[name];if(own(field,'value'))define(facade,name,{value:field.value,enumerable:field.enumerable});}
    for(const name of keys(bound))define(facade,name,{value:bound[name],enumerable:true});
    define(facade,'globalThis',{value:facade,enumerable:true});freeze(facade);
    return freeze({...bound,globalThis:facade});
  }
  return {
    capabilities,
    frame(wire,materialWire){input=Jparse(wire);values=input.values;commands=input.commands;metadata=input.context;
      source=frozen(Jparse(materialWire));},
    loaded(){if(!registrations.length)fail('SCHEMA_REGISTRATION_MISSING');},
    async ready(){for(let index=0;index<readyCallbacks.length;index++){
      await readyCallbacks[index].callback();}
    },
    run(){
      if(scopeFault)return refused([scopeFault]);
      if(!registrations.length)fail('SCHEMA_REGISTRATION_MISSING');
      if(input.phase==='initialization'||input.phase==='manual-replacement') {
        for(let index=0;index<registrations.length;index++){
          const parsed=parse(schemaFor(registrations[index]),values);
          if(parsed===null)return refused([{code:'SCHEMA_VALIDATION_FAILED',registrationIndex:index}]);
          if(input.phase==='manual-replacement')values=parsed;
          else{const merged=clone(values),names=keys(parsed);
            for(let field=0;field<names.length;field++)define(merged,names[field],{value:parsed[names[field]],enumerable:true,writable:true,configurable:true});
            values=numerical(merged);}
        }
      }else if(input.phase==='command-parsed') {
        // Indices belong to this original phase array, not a shrinking list or
        // descriptor equality. Identical commands remain distinguishable.
        let pending=[];
        for(let index=0;index<commands.length;index++)apply(push,pending,[
          {operation:commands[index],commandIndex:index,failedRegistrationIndexes:[]}]);
        for(let registration=0;registration<registrations.length;registration++) {
          const schema=schemaFor(registrations[registration]),remaining=[];
          for(let index=0;index<pending.length;index++) {
            const item=pending[index],wire=encode({schemaVersion:2,
              encoding:'native-mvu-schema-reduce-one-input-v2',values,operation:item.operation},8388608);
            const reduced=Jparse(reduceOperation(wire));
            if(reduced.schemaVersion!==2||reduced.encoding!=='native-mvu-schema-reduce-one-output-v2') {
              fail('SCHEMA_UPDATE_CALLBACK_FAILED');}
            if(reduced.kind==='rejected')return refused([{code:'SCHEMA_UPDATE_OPERATION_REJECTED',
              commandIndex:item.commandIndex,registrationIndex:registration,updateCode:reduced.code,
              ...(own(reduced,'pointer')?{pointer:reduced.pointer}:{})}]);
            if(reduced.kind!=='prepared')fail('SCHEMA_UPDATE_CALLBACK_FAILED');
            const parsed=parse(schema,reduced.values);
            if(parsed===null){
              apply(push,item.failedRegistrationIndexes,[registration]);apply(push,remaining,[item]);continue;
            }
            const merged=Jparse(mergeOperation(encode({schemaVersion:2,
              encoding:'native-mvu-schema-merge-one-input-v2',before:values,reduced:reduced.values,
              parsed,cleanupEffect:reduced.cleanupEffect},8388608)));
            if(merged.schemaVersion!==2||merged.encoding!=='native-mvu-schema-merge-one-output-v2'
              ||merged.kind!=='merged')fail('SCHEMA_COMMAND_CLEANUP_FAILED');
            values=numerical(merged.values);
          }
          pending=remaining;
        }
        if(pending.length){const diagnostics=[];
          for(let index=0;index<pending.length;index++){const item=pending[index];
            apply(push,diagnostics,[{code:'SCHEMA_VALIDATION_FAILED',commandIndex:item.commandIndex,
              failedRegistrationIndexes:item.failedRegistrationIndexes}]);}
          return refused(diagnostics);}
        commands=[];
      }else if(input.phase==='commands-parsed')commands=[];
      else if(input.phase==='update-ended'){
        // Owned opaque placeholder: equivalent metadata behavior, not copied
        // helper bytes and never a schema descriptor or publication authority.
        metadata.schema='native-zod-schema';delete metadata.display_data;delete metadata.delta_data;
      }else fail('SCHEMA_PHASE_UNSUPPORTED');
      if(scopeFault)return refused([scopeFault]);
      return encode({...outputWire,kind:'accepted',values:numerical(values),commands:clone(commands),
        context:clone(metadata),registrations:registrations.length});
    },
    encode,
  };
})`

async function evaluateGuest(request:MvuSchemaWorkerRequestV3):Promise<MvuSchemaWorkerResponseV3> {
  if(!peerVersions())return {kind:'unavailable',code:'SCHEMA_IMPLEMENTATION_UNAVAILABLE'}
  const program=validateSchemaProgram(request.program)
  if(program.compiler.version!==3||program.bridge.version!==3)return unavailable('SCHEMA_IMPLEMENTATION_UNAVAILABLE')
  const trace='trace' in request?validateSchemaTraceInputV3(program,request.trace):undefined
  const input:MvuSchemaEvaluationInputV3=trace?validateSchemaEvaluationInputV3({schemaVersion:3,
    encoding:'native-mvu-author-schema-phase-input-v3',commandsEncoding:'native-mvu-update-operations-v2',errorPolicy:'atomic-refusal',
    phase:'initialization',base:null,values:trace.loadFrame.values,
    commands:[],context:trace.loadFrame.context,scopeReadFrame:trace.loadFrame.scopeReadFrame,
    clockEpochMs:trace.loadFrame.clockEpochMs,randomSeed:trace.loadFrame.randomSeed}):
    validateSchemaEvaluationInputV3((request as Extract<MvuSchemaWorkerRequestV3,{input:unknown}>).input)
  validateSchemaScopeProgramFrameV3(program,input.scopeReadFrame)
  const libraries=cloneSchemaData(request.libraries,MVU_SCHEMA_BOUNDS.programBytes)
  for(const library of libraries)if(schemaTextSha256(library.code)!==library.bundleSha256) {
    return {kind:'unavailable',code:'SCHEMA_LIBRARY_UNAVAILABLE'}
  }
  const quickjs=await newQuickJSWASMModuleFromVariant(variant)
  const runtime=quickjs.newRuntime()
  runtime.setMemoryLimit(MVU_SCHEMA_BOUNDS.vmMemoryBytes)
  runtime.setMaxStackSize(MVU_SCHEMA_BOUNDS.vmStackBytes)
  const deadline=Date.now()+MVU_SCHEMA_BOUNDS.vmDeadlineMs
  let timedOut=false,denied=false,callbackFault:string|undefined
  const budget={jobs:0}
  runtime.setInterruptHandler(()=>{if(Date.now()>=deadline)timedOut=true;return timedOut})
  const context=runtime.newContext(),owned:QuickJSHandle[]=[]
  let readInput=input
  let readers=new Map<string,ReturnType<typeof createMvuScopeReaderV1>>()
  try {
    readers=new Map(input.scopeReadFrame.scripts.map(script=>[script.scriptId,
      createMvuScopeReaderV1(input.scopeReadFrame,script.scriptId)]))
    const inputHandle=context.newString(JSON.stringify(input));owned.push(inputHandle)
    const determinism=checked(context.evalCode(DETERMINISM,'trusted-clock.js'));owned.push(determinism)
    const clockFrame=checked(context.callFunction(determinism,context.undefined,inputHandle));owned.push(clockFrame)
    for(const library of libraries)checked(context.evalCode(library.code,`trusted-${library.kind}.js`)).dispose()
    const callbackPayload=(wireHandle:QuickJSHandle,encoding:string,fields:readonly string[]):Record<string,unknown>=>{
      if(context.typeof(wireHandle)!=='string')throw Error('SCHEMA_CALLBACK_INPUT_INVALID')
      const wire=context.getString(wireHandle)
      if(Buffer.byteLength(wire,'utf8')>MVU_SCHEMA_BOUNDS.inputBytes)throw Error('SCHEMA_CALLBACK_INPUT_INVALID')
      const payload=cloneSchemaData(JSON.parse(wire),MVU_SCHEMA_BOUNDS.inputBytes) as Record<string,unknown>
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.schemaVersion!==2
        ||payload.encoding!==encoding||Object.keys(payload).length!==fields.length
        ||Object.keys(payload).some(key=>!fields.includes(key)))throw Error('SCHEMA_CALLBACK_INPUT_INVALID')
      return payload
    }
    const reduce=context.newFunction('nativeMvuReduceV2',wireHandle=>{
      try {
        const payload=callbackPayload(wireHandle,'native-mvu-schema-reduce-one-input-v2',
          ['schemaVersion','encoding','values','operation'])
        const base=cloneSchemaValues(payload.values)
        const result=reduceSchemaUpdateOperationV2(base,payload.operation as MvuUpdateOperationV2)
        return context.newString(JSON.stringify({schemaVersion:2,encoding:'native-mvu-schema-reduce-one-output-v2',...result}))
      } catch(error) {
        callbackFault=error instanceof Error&&error.message==='SCHEMA_UPDATE_INPUT_UNKNOWN'?
          'SCHEMA_UPDATE_INPUT_UNKNOWN':'SCHEMA_UPDATE_CALLBACK_FAILED'
        return context.newString(JSON.stringify({schemaVersion:2,encoding:'native-mvu-schema-reduce-one-output-v2',
          kind:'unavailable',code:callbackFault}))
      }
    });owned.push(reduce)
    const merge=context.newFunction('nativeMvuMergeV2',wireHandle=>{
      try {
        const payload=callbackPayload(wireHandle,'native-mvu-schema-merge-one-input-v2',
          ['schemaVersion','encoding','before','reduced','parsed','cleanupEffect'])
        const values=mergeSchemaUpdateValuesV2(payload.before as MvuJsonObject,payload.reduced as MvuJsonObject,
          payload.parsed as MvuJsonObject,payload.cleanupEffect as MvuSchemaCleanupEffectV2)
        return context.newString(JSON.stringify({schemaVersion:2,encoding:'native-mvu-schema-merge-one-output-v2',kind:'merged',values}))
      } catch {
        callbackFault='SCHEMA_COMMAND_CLEANUP_FAILED'
        return context.newString(JSON.stringify({schemaVersion:2,encoding:'native-mvu-schema-merge-one-output-v2',
          kind:'unavailable',code:callbackFault}))
      }
    });owned.push(merge)
    const read=context.newFunction('nativeMvuReadScopeV1',wireHandle=>{
      try {
        if(context.typeof(wireHandle)!=='string')throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID')
        const wire=context.getString(wireHandle)
        if(Buffer.byteLength(wire,'utf8')>MVU_SCHEMA_BOUNDS.inputBytes)throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID')
        const payload=cloneSchemaData(JSON.parse(wire),MVU_SCHEMA_BOUNDS.inputBytes) as Record<string,unknown>
        if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.schemaVersion!==1
          ||payload.encoding!=='native-mvu-scope-read-call-v1'||typeof payload.scriptId!=='string') {
          throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID')
        }
        const reader=readers.get(payload.scriptId)
        if(!reader)throw new MvuScopeReadError('SCOPE_READ_SCRIPT_UNAVAILABLE')
        const header=['schemaVersion','encoding','scriptId','method'],option=Object.hasOwn(payload,'option')?['option']:[]
        const fields=payload.method==='variables'?[...header,...option]:payload.method==='all'?header:
          payload.method==='variable'?[...header,'data','path',...option]:[]
        if(!fields.length||Object.keys(payload).length!==fields.length
          ||Object.keys(payload).some(key=>!fields.includes(key)))throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID')
        const value=payload.method==='all'?reader.getAllVariables():payload.method==='variables'?
          reader.getVariables(payload.option as Parameters<typeof reader.getVariables>[0]):
          readMvuVariable(payload.data,payload.path as string,payload.option as Parameters<typeof readMvuVariable>[2])
        return context.newString(JSON.stringify({kind:'read',present:value!==undefined,...(value===undefined?{}:{value})}))
      } catch(error) {
        const candidate=error instanceof Error?error.message:undefined
        const code=typeof candidate==='string'&&(/^(?:SCHEMA_|SCOPE_READ_)[A-Z_]+$/.test(candidate)
          ||['SCOPE_SOURCE_UNAVAILABLE','MESSAGE_STATE_UNAVAILABLE'].includes(candidate))?candidate:'SCHEMA_SCOPE_CALLBACK_FAILED'
        return context.newString(JSON.stringify({kind:'unavailable',code}))
      }
    });owned.push(read)
    const libraryNames=Object.fromEntries(libraries.map(library=>[library.kind,library.globalName]))
    const material=context.newString(JSON.stringify(trace?.loadFrame.material??program.source.material))
    const names=context.newString(JSON.stringify(libraryNames))
    const scriptScopes=context.newString(JSON.stringify(input.scopeReadFrame.scripts.map(({scriptId,pointer})=>({scriptId,pointer}))))
    owned.push(material,names,scriptScopes)
    const bootstrap=checked(context.evalCode(BOOTSTRAP,'trusted-schema-bridge.js'));owned.push(bootstrap)
    const controller=checked(context.callFunction(bootstrap,context.undefined,inputHandle,material,names,scriptScopes,reduce,merge,read))
    owned.push(controller)
    const ready=context.getProp(controller,'ready'),run=context.getProp(controller,'run')
    const frame=context.getProp(controller,'frame'),loaded=context.getProp(controller,'loaded');owned.push(ready,run,frame,loaded)
    const capabilities=context.getProp(controller,'capabilities');owned.push(capabilities)
    const modules=new Map<string,string>()
    for(const library of libraries) {
      const handle=context.getProp(context.global,library.globalName)
      let exported:string[]
      try {
        const list=checked(context.evalCode(`Object.keys(globalThis[${JSON.stringify(library.globalName)}])`,'trusted-exports.js'))
        try {exported=context.dump(list)}finally {list.dispose()}
      } finally {handle.dispose()}
      const source=exported.filter(name=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)&&!['__proto__','constructor','prototype'].includes(name))
        .map((name,index)=>`const value${index}=globalThis[${JSON.stringify(library.globalName)}][${JSON.stringify(name)}];export {value${index} as ${name}};`)
      if(!exported.includes('default'))source.push(`export default globalThis.${library.kind==='zod'?'z':'_'};`)
      if(library.kind==='lodash'&&!exported.includes('_'))source.push('export const _=globalThis._;')
      if(library.kind==='zod'&&!exported.includes('z'))source.push('export const z=globalThis.z;')
      modules.set(`nexttavern:${library.kind}`,source.join('\n'))
    }
    const scopeModules=new Map(program.scripts.map((script,index)=>[index,`nexttavern:scope-author-${index}`]))
    const scopeLoaderKey='__native_mvu_scope_preload'
    for(const [index,script] of program.scripts.entries())if(script.enabled) {
      const exports=scopedNames.map((name,ordinal)=>
        `const value${ordinal}=owner[${JSON.stringify(name)}];export {value${ordinal} as ${name}};`).join('\n')
      modules.set(scopeModules.get(index)!,`const owner=globalThis[${JSON.stringify(scopeLoaderKey)}];\n${exports}`)
    }
    const allowed=new Map(program.scripts.map((script,index)=>[`author-${index}.mjs`,new Set([
      ...script.imports.map(binding=>`nexttavern:${binding.kind}`),scopeModules.get(index)!])]))
    runtime.setModuleLoader(name=>{
      const source=modules.get(name)
      if(source===undefined){denied=true;throw Error('SCHEMA_IMPORT_UNAVAILABLE')}
      return source
    },(base,name)=>{
      if(base!=='trusted-preload.mjs'&&!base.startsWith('trusted-scope-preload-')&&!allowed.get(base)?.has(name)) {
        denied=true;throw Error('SCHEMA_IMPORT_UNAVAILABLE')}
      if(name==='nexttavern:schema-bridge') {
        const index=program.scripts.findIndex((_script,index)=>base===`author-${index}.mjs`)
        if(index<0){denied=true;throw Error('SCHEMA_IMPORT_UNAVAILABLE')}
        return scopeModules.get(index)!
      }
      return name
    })
    // Cache library/bridge exports before author code can mutate library globals.
    const preload=checked(context.evalCode([...modules.keys()].filter(name=>!name.startsWith('nexttavern:scope-author-'))
      .map(name=>`import ${JSON.stringify(name)};`).join('\n'),
      'trusted-preload.mjs',{type:'module'}))
    try {completed(context,runtime,preload,trace?budget:{jobs:0})}finally {preload.dispose()}
    // Preload each capability export while only trusted code can see its VM
    // object, then delete the temporary global before evaluating any author.
    for(const [index,script] of program.scripts.entries())if(script.enabled) {
      const id=context.newString(script.identity)
      const bound=(()=>{
        try {return checked(context.callFunction(capabilities,controller,id))}finally {id.dispose()}
      })()
      try {
        context.setProp(context.global,scopeLoaderKey,bound)
        const preloaded=checked(context.evalCode(`import ${JSON.stringify(scopeModules.get(index))};`,
          `trusted-scope-preload-${index}.mjs`,{type:'module'}))
        try {completed(context,runtime,preloaded,trace?budget:{jobs:0})}finally {preloaded.dispose()}
      } finally {
        checked(context.evalCode(`delete globalThis[${JSON.stringify(scopeLoaderKey)}];`,'trusted-scope-cleanup.js')).dispose()
        bound.dispose()
      }
    }
    for(const [index,script] of program.scripts.entries()) {
      if(!script.enabled)continue
      if(Date.now()>=deadline)throw new GuestRefusal('SCHEMA_VM_TIMEOUT')
      const filename=`author-${index}.mjs`,source=bindAuthorScope(script.javascript,filename,scopeModules.get(index)!)
      const result=checked(context.evalCode(source,filename,{type:'module'}),context)
      try {completed(context,runtime,result,trace?budget:{jobs:0})}finally {result.dispose()}
    }
    const readyResult=checked(context.callFunction(ready,controller),context)
    try {completed(context,runtime,readyResult,trace?budget:{jobs:0})}finally {readyResult.dispose()}
    if(trace) {
      if(trace.prefix.length>=MVU_SCHEMA_BOUNDS.traceSteps)return {kind:'unavailable',code:'SCHEMA_TRACE_INPUT_INVALID'}
      // The load boundary must finish before any historical event exists.
      checked(context.callFunction(loaded,controller),context).dispose()
      const outputs:unknown[]=[]
      for(const step of [...trace.prefix,trace.requestedStep]) {
        if(timedOut||Date.now()>=deadline)return {kind:'unavailable',code:'SCHEMA_VM_TIMEOUT'}
        const current:MvuSchemaTraceFrameV3=step.frame
        readInput=current.input
        readers=new Map(readInput.scopeReadFrame.scripts.map(script=>[script.scriptId,
          createMvuScopeReaderV1(readInput.scopeReadFrame,script.scriptId)]))
        const wire=context.newString(JSON.stringify(current.input)),source=context.newString(JSON.stringify(current.material))
        try {
          checked(context.callFunction(clockFrame,context.undefined,wire),context).dispose()
          checked(context.callFunction(frame,controller,wire,source),context).dispose()
        } finally {wire.dispose();source.dispose()}
        let output:unknown
        const handle=checked(context.callFunction(run,controller),context)
        try {
          completed(context,runtime,handle,budget)
          if(context.typeof(handle)!=='string')throw new GuestRefusal('SCHEMA_TRACE_OUTPUT_INVALID')
          const json=context.getString(handle)
          if(Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT')
          output=validateSchemaGuestOutputV3(JSON.parse(json),current.input)
        } finally {handle.dispose()}
        if(callbackFault)return unavailable(callbackFault)
        if(timedOut||Date.now()>=deadline)return {kind:'unavailable',code:'SCHEMA_VM_TIMEOUT'}
        if(denied)return {kind:'unavailable',code:'SCHEMA_IMPORT_UNAVAILABLE'}
        // A disproved old event stops replay before the next event can change
        // a closure. Parent independently validates the same complete outputs.
        if('output' in step&&recordSha256(output)!==recordSha256(step.output)) {
          return {kind:'unavailable',code:'SCHEMA_TRACE_PREFIX_MISMATCH'}
        }
        outputs.push(output)
        // Bound the complete response as it grows, never one envelope per step.
        try {cloneSchemaData(outputs,MVU_SCHEMA_BOUNDS.outputBytes)}catch {throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT')}
      }
      const json=JSON.stringify(outputs)
      if(timedOut||Date.now()>=deadline)return {kind:'unavailable',code:'SCHEMA_VM_TIMEOUT'}
      return {kind:'trace-output',json}
    }
    const output=checked(context.callFunction(run,controller),context)
    try {
      completed(context,runtime,output,{jobs:0})
      // A guest can catch QuickJS's soft interrupt. Exhausting this budget
      // still invalidates its output; the parent owns the hard termination.
      if(timedOut||Date.now()>=deadline)return unavailable('SCHEMA_VM_TIMEOUT')
      if(denied)return unavailable('SCHEMA_IMPORT_UNAVAILABLE')
      if(callbackFault)return unavailable(callbackFault)
      if(context.typeof(output)!=='string')return unavailable('SCHEMA_OUTPUT_INVALID')
      const json=context.getString(output)
      if(Buffer.byteLength(json,'utf8')>MVU_SCHEMA_BOUNDS.outputBytes)return unavailable('SCHEMA_OUTPUT_LIMIT')
      validateSchemaGuestOutputV3(JSON.parse(json),input)
      if(timedOut||Date.now()>=deadline)return unavailable('SCHEMA_VM_TIMEOUT')
      return {kind:'output',json}
    } finally {output.dispose()}
  } catch(error) {
    const code=timedOut||Date.now()>=deadline?'SCHEMA_VM_TIMEOUT':denied?'SCHEMA_IMPORT_UNAVAILABLE':
      callbackFault??(error instanceof GuestRefusal?error.code:'SCHEMA_GUEST_ERROR')
    return unavailable(code)
  } finally {
    // Attempt every owned cleanup even if one disposer fails. A failed cleanup
    // invalidates a previously computed output rather than completing a phase.
    let cleanupFailed=false
    for(const handle of owned.reverse())try {handle.dispose()}catch {cleanupFailed=true}
    try {context.dispose()}catch {cleanupFailed=true}
    try {runtime.dispose()}catch {cleanupFailed=true}
    if(cleanupFailed)throw new GuestRefusal('SCHEMA_WORKER_CLEANUP')
  }
}

if(parentPort) {
  evaluateGuest(workerData as MvuSchemaWorkerRequestV3).then(result=>parentPort!.postMessage(result),
    error=>parentPort!.postMessage({kind:'unavailable',code:error instanceof GuestRefusal?error.code:
      'SCHEMA_WORKER_UNAVAILABLE'} satisfies MvuSchemaWorkerResponseV3))
}

