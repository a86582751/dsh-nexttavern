// Generated from runtime/alpha3/src/core/tavern-mvu-schema-worker-v4.mts; edit the TypeScript source.
/** Trusted worker owns the VM, fixed-core updates and sealed v4 scope reads.
 * Guests see JSON copies and pinned libraries, never Node handles or write owners. */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import ts from 'dsh-nexttavern-typescript-runtime';
import { mergeMvuSchemaValues } from './tavern-mvu-schema-values-merge.js';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, unpackSchemaEnvelopeV4 } from './tavern-mvu-schema-data.js';
import { schemaPhaseErrorPolicyForProgramV4, schemaExecutionViewV4 } from './tavern-mvu-schema-program-v4.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
import { validateSchemaGuestOutputForParsedProgramV4, validateUnregisteredTrialOutputV4, schemaPhaseScopeFromLoadV4 } from './tavern-mvu-schema-runner-v4.js';
import { createMvuScopeReaderV1, createMvuScopeReaderV2, readMvuVariable, MvuScopeReadError } from './tavern-mvu-scope-read.js';
import { createMvuScopeViewResolverV2 } from './tavern-mvu-scope-view-v2.js';
const require = createRequire(import.meta.url);
const MAX_JOBS = 1024;
const scopedNames = ['getVariables', 'getAllVariables', 'getMvuData', 'getMvuVariable', 'getvar',
    'Mvu', 'registerMvuSchema', '$', 'jQuery', 'readSchemaSource', 'waitGlobalInitialized', 'globalThis', 'insertOrAssignVariables'];
const unavailable = (code) => ({ kind: 'unavailable', code });
/** A single Native wait slot is armed before publishing the completed phase.
 * No Source queue or saved DTO can advance a terminated operation. */
function manualWorkerInbox() {
    const port = parentPort;
    let receive;
    const message = (value) => {
        const waiting = receive;
        receive = undefined;
        waiting?.(value);
    };
    port.on('message', message);
    function wait(response) {
        const next = new Promise(resolve => { receive = resolve; });
        port.postMessage(response);
        return next;
    }
    return {
        park: json => wait({ kind: 'manual-phase', json }),
        ready: () => wait({ kind: 'hot-ready' }),
        replayed: stepSha256 => wait({ kind: 'hot-replayed', stepSha256 }),
        dispose() { receive = undefined; port.off('message', message); },
    };
}
class GuestRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function guestError(error, _context) {
    // A primitive string is just as forgeable as an Error.message. Only normal
    // controller return branches can produce a completed refusal envelope.
    error.dispose();
    throw new GuestRefusal('SCHEMA_GUEST_ERROR');
}
function checked(result, context) {
    if (result.error)
        guestError(result.error, context);
    return result.value;
}
function runJobs(runtime, context, budget) {
    while (runtime.hasPendingJob()) {
        if (budget.jobs++ >= MAX_JOBS)
            throw new GuestRefusal('SCHEMA_JOB_LIMIT');
        const result = runtime.executePendingJobs(1);
        if (result.error)
            guestError(result.error, context);
    }
}
function completed(context, runtime, handle, budget) {
    runJobs(runtime, context, budget);
    const state = context.getPromiseState(handle);
    if (state.type === 'pending')
        throw new GuestRefusal('SCHEMA_ASYNC_UNSETTLED');
    if (state.type === 'rejected')
        guestError(state.error, context);
    if (state.type === 'fulfilled' && !state.notAPromise)
        state.value.dispose();
}
function peerVersions() {
    if (ts.version !== '5.9.3')
        return false;
    for (const name of ['quickjs-emscripten-core', '@jitl/quickjs-wasmfile-release-sync']) {
        const metadata = JSON.parse(readFileSync(resolve(dirname(require.resolve(name)), '..', 'package.json'), 'utf8'));
        if (metadata.name !== name || metadata.version !== '0.32.0')
            return false;
    }
    return true;
}
/** Module-local namespace references survive every async continuation. The
 * checker binds only this source: no host libraries, dependency resolution or
 * execution. Local names and property keys remain the author's own bindings. */
function bindAuthorScope(javascript, filename, moduleName) {
    const file = ts.createSourceFile(filename, javascript, ts.ScriptTarget.ES2023, true, ts.ScriptKind.JS);
    if (file.parseDiagnostics.length) {
        throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_INVALID');
    }
    const options = { allowJs: true, checkJs: false, noResolve: true, noLib: true,
        target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext };
    const host = { getSourceFile: name => name === filename ? file : undefined, getDefaultLibFileName: () => '', writeFile: () => { },
        getCurrentDirectory: () => '', getDirectories: () => [], fileExists: name => name === filename,
        readFile: name => name === filename ? javascript : undefined, getCanonicalFileName: name => name,
        useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
    const checker = ts.createProgram([filename], options, host).getTypeChecker();
    const pending = [{ node: file, depth: 0 }], identifiers = new Set();
    let visited = 0;
    while (pending.length) {
        const { node, depth } = pending.pop();
        if (++visited > MVU_SCHEMA_BOUNDS.syntaxTokens || depth > MVU_SCHEMA_BOUNDS.syntaxDepth) {
            throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_LIMIT');
        }
        if (ts.isIdentifier(node))
            identifiers.add(node.text);
        ts.forEachChild(node, child => { pending.push({ node: child, depth: depth + 1 }); });
    }
    let namespace = '__nativeMvuScope';
    while (identifiers.has(namespace))
        namespace += '_';
    const bound = new Set(scopedNames);
    // JS expando writes synthesize Identifier declarations on free globals.
    // Only lexical declarations can shadow the author's scoped SDK binding.
    const declared = (symbol) => symbol?.declarations
        ?.some(declaration => !ts.isIdentifier(declaration));
    const free = (node) => !declared(checker.getSymbolAtLocation(node));
    const nameOnly = (node) => {
        const parent = node.parent;
        return ts.isPropertyAccessExpression(parent) && parent.name === node
            || (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)
                || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) && parent.name === node
            || ts.isBindingElement(parent) && parent.propertyName === node
            || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)
            || ts.isLabeledStatement(parent) && parent.label === node
            || (ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node;
    };
    const transformed = ts.transform(file, [context => {
            const member = (name) => context.factory.createPropertyAccessExpression(context.factory.createIdentifier(namespace), name);
            const visit = node => {
                if (ts.isShorthandPropertyAssignment(node) && bound.has(node.name.text)
                    && !declared(checker.getShorthandAssignmentValueSymbol(node))) {
                    if (node.objectAssignmentInitializer)
                        throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_INVALID');
                    return context.factory.createPropertyAssignment(node.name, member(node.name.text));
                }
                if (ts.isIdentifier(node) && bound.has(node.text) && !nameOnly(node) && free(node))
                    return member(node.text);
                return ts.visitEachChild(node, visit, context);
            };
            return root => {
                const rewritten = ts.visitNode(root, visit);
                const imported = context.factory.createImportDeclaration(undefined, context.factory.createImportClause(false, undefined, context.factory.createNamespaceImport(context.factory.createIdentifier(namespace))), context.factory.createStringLiteral(moduleName), undefined);
                return context.factory.updateSourceFile(rewritten, [imported, ...rewritten.statements]);
            };
        }]);
    try {
        const source = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
        if (Buffer.byteLength(source, 'utf8') > MVU_SCHEMA_BOUNDS.programBytes)
            throw new GuestRefusal('SCHEMA_SCOPE_TRANSFORM_LIMIT');
        return source;
    }
    finally {
        transformed.dispose();
    }
}
// This prelude runs before trusted libraries as well as author code. Date's
// original constructor remains only in this closure, including through the
// prototype; no guest path exposes real time or the old Math.random function.
const DETERMINISM = String.raw `(wire=>{
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
})`;
/** All transport serialization uses captured intrinsics and data descriptors.
 * Proxy is unavailable to author code, and serialization never calls toJSON,
 * getters, valueOf or a guest object's iterator. Input strings are VM values,
 * not concatenated source. The controller handles stay private to this worker. */
const BOOTSTRAP = String.raw `((wire,materialWire,libraryWire,scriptWire,planWire,mergeValues,readOperation)=>{
  'use strict';
  const G=globalThis,O=Object,A=Array,Jparse=JSON.parse,Jstring=JSON.stringify,apply=Reflect.apply;
  const NativeProxy=Proxy,reflectGet=Reflect.get;
  const descriptors=O.getOwnPropertyDescriptors,keys=O.keys,symbols=O.getOwnPropertySymbols,proto=O.getPrototypeOf;
  const array=A.isArray,own=O.hasOwn,freeze=O.freeze,define=O.defineProperty,finite=Number.isFinite;
  const char=String.prototype.charCodeAt,push=A.prototype.push,slice=A.prototype.slice;
  const objectProto=O.prototype,arrayProto=A.prototype;
  const plan=Jparse(planWire);
  let input=Jparse(wire);
  const libraries=plan.stateOnly?undefined:Jparse(libraryWire),scripts=plan.stateOnly?[]:Jparse(scriptWire);
  let zNamespace,z,lodash,ZodObject,looseObject;
  if(!plan.stateOnly){
    zNamespace=G[libraries.zod];
    const rawLodash=G[libraries.lodash];
    z=zNamespace.z||zNamespace;lodash=rawLodash.default||rawLodash;
    ZodObject=z.ZodObject;looseObject=z.looseObject;
  }
  const registrations=[],readyCallbacks=[];
  let values=input.values,metadata=input.context;
  const initializationWriters=new Set();
  let initializationWriteOpen=true,initializationWriteFault,initializationCandidate;
  let initializationHandoffPending=true;
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
  let source=plan.stateOnly?undefined:frozen(Jparse(materialWire));
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
  const outputWire=plan.unregisteredTrial?{}:{schemaVersion:4,encoding:'native-mvu-author-schema-phase-output-v4',
    errorPolicy:plan.errorPolicy,
    executionPlanSha256:plan.executionPlanSha256};
  const refused=diagnostics=>encode({...outputWire,kind:'refused',diagnostics:scopeFault?[scopeFault]:diagnostics});
  function registerMvuSchema(owner,registration,policy){
    if(registrations.length>=64)fail('SCHEMA_REGISTRATION_LIMIT');
    const entry={owner,registration,policy};schemaFor(entry);apply(push,registrations,[entry]);
  }
  function registrationBoundary(){
    if(plan.stateOnly){if(registrations.length)fail('SCHEMA_REGISTRATION_INVALID');return;}
    if(!plan.serverScriptIds.length)fail('SCHEMA_REGISTRATION_MISSING');
    // An unrelated author's registration cannot satisfy this script's contract.
    // Check after all ready callbacks, including async module registrations.
    for(let index=0;index<plan.serverScriptIds.length;index++){
      const scriptId=plan.serverScriptIds[index];let found=false;
      for(let registration=0;registration<registrations.length;registration++){
        if(registrations[registration].owner.scriptId===scriptId){found=true;break;}}
      if(!found)fail('SCHEMA_REGISTRATION_MISSING');}
  }
  function ready(owner,callback){if(typeof callback!=='function')fail('SCHEMA_READY_INVALID');
    if(readyCallbacks.length>=64)fail('SCHEMA_JOB_LIMIT');apply(push,readyCallbacks,[{owner,callback}]);}
  const unbound=()=>fail('SCHEMA_SCOPE_OWNER_UNAVAILABLE');
  // The Helper global is the same Zod namespace used for ESM exports.
  const libraryGlobals={z:zNamespace,_:lodash,console:freeze({log(){},info(){},warn(){},error(){}})};
  for(const name of keys(libraryGlobals))define(G,name,{value:libraryGlobals[name],writable:false,configurable:false});
  const globals={$:unbound,jQuery:unbound,registerMvuSchema:unbound,getVariables:unbound,
    getAllVariables:unbound,getvar:unbound,getMvuVariable:unbound,getMvuData:unbound,
    readSchemaSource:unbound,waitGlobalInitialized:unbound,insertOrAssignVariables:unbound};
  const names=keys(globals);
  for(const name of names){
    const value=globals[name];
    // Getter descriptors keep raw reflective reads unbound and permit the
    // lexical owner's Proxy to return its API without violating VM invariants.
    define(G,name,{get:()=>value,configurable:false});
  }
  for(const name of ['Proxy','process','require','fetch','WebSocket','XMLHttpRequest','window','document','navigator',
    'localStorage','sessionStorage','setTimeout','setInterval','queueMicrotask','Deno','Bun']) {
    define(G,name,{value:undefined,writable:false,configurable:false});}
  const Mvu=freeze({getMvuData:unbound,getMvuVariable:unbound});
  define(G,'Mvu',{get:()=>Mvu,configurable:false});
  define(G,'globalThis',{get:()=>G,configurable:false});
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
  function capabilities(scriptId,registrationPolicy='atomic-refusal'){
    let owner;
    for(const script of scripts)if(script.scriptId===scriptId){owner=script;break;}
    if(!owner)fail('SCHEMA_SCOPE_OWNER_UNAVAILABLE');
    function getVariables(option){
      const fields=option===undefined?{}:{option:optionData(option)};
      const current=scopeCall(owner,'variables',()=>fields);
      if(!initializationWriters.has(scriptId)||option!==undefined&&fields.option.type!=='chat')return current;
      // The published scope owns outer metadata (including initialized books).
      // Only stat_data follows the current VM candidate; this is no write lease.
      return frozen({...current,stat_data:clone(values)});
    }
    function insertOrAssignVariables(data,option){
      try {
        if(!initializationWriteOpen||input.phase!=='initialization')fail('SCHEMA_INITIALIZATION_WRITE_PHASE_UNSUPPORTED');
        const payload=clone(data),options=option===undefined?{type:'chat'}:clone(option);
        if(arguments.length>2||!payload||typeof payload!=='object'||array(payload)
          ||keys(payload).length!==1||!own(payload,'stat_data')
          ||!options||typeof options!=='object'||array(options)
          ||keys(options).length!==1||options.type!=='chat')fail('SCHEMA_INITIALIZATION_WRITE_UNSUPPORTED');
        const incoming=numerical(payload.stat_data);
        values=numerical(lodash.mergeWith({},values,incoming,(_before,after)=>array(after)?after:undefined));
        initializationCandidate=values;
        initializationWriters.add(scriptId);
        return getVariables({type:'chat'});
      }catch(code){initializationWriteFault=typeof code==='string'?code:'SCHEMA_INITIALIZATION_WRITE_UNSUPPORTED';throw code;}
    }
    function getAllVariables(){if(arguments.length)fail('SCHEMA_READ_UNSUPPORTED');return scopeCall(owner,'all',{});}
    function getMvuVariable(data,path,options){
      return scopeCall(owner,'variable',()=>({data,path,...(options===undefined?{}:{option:optionData(options)})}));}
    function getvar(path){if(arguments.length!==1||typeof path!=='string')fail('SCHEMA_READ_UNSUPPORTED');
      return getMvuVariable({stat_data:getAllVariables()},path);}
    const jq=argument=>{if(typeof argument==='function'){ready(owner,argument);return;}
      fail('SCHEMA_HOST_UNAVAILABLE');};
    const mvu=freeze({getMvuData:getVariables,getMvuVariable});
    const bound=freeze({getVariables,getAllVariables,getMvuData:getVariables,getMvuVariable,getvar,Mvu:mvu,
      registerMvuSchema:registration=>registerMvuSchema(owner,registration,registrationPolicy),$:jq,jQuery:jq,
      readSchemaSource:readSource,waitGlobalInitialized:async name=>{if(name!=='Mvu')fail('SCHEMA_HOST_UNAVAILABLE');},
      insertOrAssignVariables});
    // Custom exports use the real VM global environment, including bare
    // identifiers in later modules. SDK reads retain this lexical owner.
    const facade=new NativeProxy(G,{get(target,name,receiver){
      if(name==='globalThis')return facade;
      if(own(bound,name))return bound[name];
      return reflectGet(target,name,receiver);
    }});
    return freeze({...bound,globalThis:facade});
  }
  let updateController,updateNamespace;
  const updateRefusal={};let updateRefusalWire;
  function installUpdateLibrary(namespace,rawLodash){
      updateNamespace=namespace;lodash=rawLodash.default||rawLodash;
      const nil=()=>{};
      const core=namespace.createMvu196Core({lodash,parseString:namespace.parseMvu196StructuredValue,
        substituteMacros:()=>input.update.macros?.expandedMessage??input.update.message,
        translate:(key,parameters)=>key+Jstring(parameters||{}),
        diagnostics:{info:nil,warn:nil,error:nil,log:nil}});
      updateController=namespace.createMvu196UpdateController(core,plan.stateOnly?{publicTrial:plan.trial||undefined}:{
        publicTrial:plan.trial||undefined,
        executionMode:'zod-managed',
        afterCommands(frame){
          if(frame.firstError){
            updateRefusalWire=refused([{code:'SCHEMA_UPDATE_COMPUTATION_FAILED',
              commandIndex:frame.firstError.commandIndex,message:frame.firstError.message}]);
            throw updateRefusal;
          }
          // The one operation body has already computed this batch and emitted
          // its real SINGLE callbacks. Schema merge consumes its actual effects;
          // it never interprets or runs those canonical commands a second time.
          const collector=frame.internalData,
            before={...frame.before.stat_data},candidate={...frame.variables.stat_data};
          delete before.$internal;delete candidate.$internal;
          let next=candidate,basis=before;
          for(let registration=0;registration<registrations.length;registration++){
            const parsed=parse(schemaFor(registrations[registration]),next);
            if(parsed===null){
              updateRefusalWire=refused([{code:plan.errorPolicy==='update-batch-atomic-v1'
                ?'SCHEMA_UPDATE_BATCH_VALIDATION_FAILED':'SCHEMA_VALIDATION_FAILED',registrationIndex:registration}]);
              throw updateRefusal;
            }
            const merged=Jparse(mergeValues(encode({schemaVersion:1,
              encoding:'native-mvu-schema-values-merge-v1',before:basis,candidate:next,parsed,
              mutationEffects:frame.mutationEffects},8388608)));
            if(merged.kind!=='merged')fail('SCHEMA_VALUES_MERGE_FAILED');
            next=merged.values;basis=next;
          }
          frame.variables.stat_data={...next,$internal:collector};
        },
        endedForZod(frame){
          frame.variables.schema='native-zod-schema';
          delete frame.variables.display_data;delete frame.variables.delta_data;
          return {schemaVersion:1,kind:'keys',keys:['schema','display_data','delta_data']};
        }
      });
  }
  return {
    capabilities,
    installUpdateLibrary,
    initializationWriteError(){return initializationWriteFault;},
    source(){return source;},
    material(wire){return frozen(Jparse(wire));},
    frame(wire,material){input=Jparse(wire);values=input.values;metadata=input.context;
      // Loading the guest prepared one candidate. Hand it to the actual initial
      // event once; replayed commands and manual replacements own their values.
      if(initializationHandoffPending){
        if(input.phase==='initialization'&&initializationCandidate!==undefined)values=initializationCandidate;
        initializationHandoffPending=false;initializationCandidate=undefined;}
      if(!plan.stateOnly)source=material;},
    loaded(){registrationBoundary();},
    async ready(){for(let index=0;index<readyCallbacks.length;index++){
      await readyCallbacks[index].callback();}
      initializationWriteOpen=false;
    },
    run(){
      try {
      if(scopeFault)return refused([scopeFault]);
      // The external message-pack setter stores raw state. frame() already
      // adopted this owner's values/context without rebuilding the live realm.
      // Keep registrations and closures, but run none of their phase callbacks.
      if(input.phase==='external-pack-replacement')return encode({...outputWire,kind:'accepted',
        values:numerical(values),context:clone(metadata),registrations:registrations.length});
      registrationBoundary();
      let contextWrites;
      if(input.phase==='update-core'){
        if(!updateController)installUpdateLibrary(updateNamespace,lodash);
        const result=updateController.advance(input.update,{...metadata,stat_data:values});
        values=result.variables.stat_data;
        metadata={...result.variables};delete metadata.stat_data;
        return encode({...outputWire,kind:'accepted',values:numerical(values),context:clone(metadata),
          registrations:registrations.length,...(plan.unregisteredTrial?{}:{contextWrites:result.contextWrites}),update:result.update});
      }
      if(plan.stateOnly){
        if(input.phase==='manual-replacement'){
          const changed=keys(metadata).filter(key=>key==='display_data'||key==='delta_data');
          delete metadata.display_data;delete metadata.delta_data;
          contextWrites={schemaVersion:1,kind:'keys',keys:changed};
        }
        else if(input.phase!=='initialization')fail('SCHEMA_PHASE_UNSUPPORTED');
        return encode({...outputWire,kind:'accepted',values:numerical(values),
          context:clone(metadata),registrations:0,...(contextWrites?{contextWrites}:{})});
      }
      if(input.phase==='initialization'||input.phase==='manual-replacement') {
        for(let index=0;index<registrations.length;index++){
          const parsed=parse(schemaFor(registrations[index]),values);
          if(parsed===null)return refused([{code:'SCHEMA_VALIDATION_FAILED',registrationIndex:index}]);
          if(input.phase==='manual-replacement')values=parsed;
          else{const merged=clone(values),names=keys(parsed);
            for(let field=0;field<names.length;field++)define(merged,names[field],{value:parsed[names[field]],enumerable:true,writable:true,configurable:true});
            values=numerical(merged);}
        }
        if(input.phase==='manual-replacement'){
          const changed=keys(metadata).filter(key=>key==='display_data'||key==='delta_data');
          if(metadata.schema!=='native-zod-schema')changed.push('schema');
          metadata.schema='native-zod-schema';delete metadata.display_data;delete metadata.delta_data;
          contextWrites={schemaVersion:1,kind:'keys',keys:changed};
        }
      }else fail('SCHEMA_PHASE_UNSUPPORTED');
      if(scopeFault)return refused([scopeFault]);
      return encode({...outputWire,kind:'accepted',values:numerical(values),
        context:clone(metadata),registrations:registrations.length,
        ...(contextWrites?{contextWrites}:{})});
      } catch(error){
        if(error!==updateRefusal)throw error;
        updateController=undefined;
        return updateRefusalWire;
      } finally {
        // Schema callbacks can catch a forbidden write during parse. The VM
        // owner's sticky fault must govern every result, including early refusals.
        if(initializationWriteFault)fail(initializationWriteFault);
      }
    },
    encode,
  };
})`;
async function evaluateGuest(request, manual, materialIdentity) {
    if (!peerVersions())
        return { kind: 'unavailable', code: 'SCHEMA_IMPLEMENTATION_UNAVAILABLE' };
    // The private parent parsed and bound the complete program and phase inputs
    // before transfer. This worker owns fresh guest output and replay semantics.
    const program = request.program;
    const view = program === null ? { stateOnly: true, serverScripts: [], scripts: [],
        executionPlanSha256: undefined } : schemaExecutionViewV4(program);
    const { serverScripts, stateOnly, scripts } = view;
    const schemaPlan = program?.encoding === 'native-mvu-author-schema-program-v2' ? program.executionPlan : null;
    const errorPolicy = program === null ? 'atomic-refusal' : schemaPhaseErrorPolicyForProgramV4(program);
    if (!stateOnly && !serverScripts.length)
        return unavailable('SCHEMA_REGISTRATION_MISSING');
    const trace = 'trace' in request ? request.trace : undefined;
    const trial = 'response' in request && request.response === 'trial-stream';
    const loadFrame = trace?.loadFrame ?? ('loadFrame' in request ? request.loadFrame : undefined);
    const stream = 'response' in request && (request.response === 'hot' || request.response === 'manual-stream' || trial);
    const input = loadFrame ? { schemaVersion: 4, ...schemaPhaseScopeFromLoadV4(loadFrame),
        errorPolicy,
        phase: 'initialization', base: null, values: loadFrame.values,
        context: loadFrame.context,
        clockEpochMs: loadFrame.clockEpochMs, randomSeed: loadFrame.randomSeed } :
        trial ? (() => {
            const { update: _update, ...registrationInput } = request.input;
            // Registration loading is private to this trial. Its initialization
            // candidate is discarded by frame() before the original clone is used.
            return { ...registrationInput, phase: 'initialization' };
        })() : request.input;
    // The parent admitted these exact library identities and bytes before transfer.
    const libraries = request.libraries;
    const quickjs = await newQuickJSWASMModuleFromVariant(variant);
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(MVU_SCHEMA_BOUNDS.vmMemoryBytes);
    runtime.setMaxStackSize(MVU_SCHEMA_BOUNDS.vmStackBytes);
    const deadline = Date.now() + MVU_SCHEMA_BOUNDS.vmDeadlineMs;
    let workMs = 0, workStarted = 0, workDepth = 0, updateBudgetActive = false;
    // Each update retains one VM-work budget across its real suspensions.
    // Parked Native waits do not contribute to the manual/update work clock.
    const expired = () => manual || updateBudgetActive
        ? workMs + (workDepth ? performance.now() - workStarted : 0) >= MVU_SCHEMA_BOUNDS.vmDeadlineMs
        : Date.now() >= deadline;
    let timedOut = false, denied = false, callbackFault;
    function guestWork(operation) {
        if (!workDepth) {
            if (expired()) {
                timedOut = true;
                throw new GuestRefusal('SCHEMA_VM_TIMEOUT');
            }
            workStarted = performance.now();
        }
        workDepth++;
        try {
            return operation();
        }
        finally {
            if (!--workDepth)
                workMs += performance.now() - workStarted;
        }
    }
    const budget = { jobs: 0 };
    runtime.setInterruptHandler(() => { if (expired())
        timedOut = true; return timedOut; });
    const context = runtime.newContext(), owned = [];
    {
        const evaluate = context.evalCode.bind(context);
        // The SDK accepts both an optional handle array and individual handles.
        // Keep those argument tuples intact rather than selecting one overload.
        const call = context.callFunction.bind(context);
        const jobs = runtime.executePendingJobs.bind(runtime);
        context.evalCode = (...args) => guestWork(() => evaluate(...args));
        context.callFunction = (...args) => guestWork(() => call(...args));
        runtime.executePendingJobs = (...args) => guestWork(() => jobs(...args));
    }
    let readInput = input;
    let readers = new Map();
    const incomingScopeObjects = new Map();
    const scopeKey = (reference) => JSON.stringify([reference.ownerSessionId, reference.key, reference.sha256]);
    let scopeResolver;
    let scopeBaseKey;
    function stageScopeObjects(objects) {
        if (objects)
            for (const item of objects)
                incomingScopeObjects.set(scopeKey(item.ref), item);
    }
    function phaseReaders(current) {
        if (current.encoding === 'native-mvu-author-schema-phase-input-v4') {
            return { scripts: current.scopeReadFrame.scripts, readers: stateOnly ? new Map() : new Map(current.scopeReadFrame.scripts.map(script => [
                    script.scriptId, createMvuScopeReaderV1(current.scopeReadFrame, script.scriptId)
                ])) };
        }
        const base = scopeKey(current.scopeReadRef.baseRef);
        if (scopeBaseKey !== base) {
            scopeResolver = createMvuScopeViewResolverV2({ read(reference) {
                    const key = scopeKey(reference), item = incomingScopeObjects.get(key);
                    incomingScopeObjects.delete(key);
                    return item?.object;
                } });
            scopeBaseKey = base;
        }
        const resolved = scopeResolver.resolve(current.scopeReadRef), scripts = [...resolved.scripts()];
        return { scripts, readers: stateOnly ? new Map() : new Map(scripts.map(script => [
                script.scriptId, createMvuScopeReaderV2(resolved.view, script.scriptId)
            ])) };
    }
    let initializationWriteError;
    try {
        stageScopeObjects(request.scopeObjects);
        const initialScopes = phaseReaders(input);
        readers = initialScopes.readers;
        const inputHandle = context.newString(JSON.stringify(input));
        owned.push(inputHandle);
        const determinism = checked(context.evalCode(DETERMINISM, 'trusted-clock.js'));
        owned.push(determinism);
        const clockFrame = checked(context.callFunction(determinism, context.undefined, inputHandle));
        owned.push(clockFrame);
        if (!stateOnly)
            for (const library of libraries.filter(library => library.kind !== 'mvu-196')) {
                checked(context.evalCode(library.code, `trusted-${library.kind}.js`)).dispose();
            }
        const mergePayload = (wireHandle) => {
            if (context.typeof(wireHandle) !== 'string')
                throw Error('SCHEMA_CALLBACK_INPUT_INVALID');
            const wire = context.getString(wireHandle);
            if (Buffer.byteLength(wire, 'utf8') > MVU_SCHEMA_BOUNDS.inputBytes)
                throw Error('SCHEMA_CALLBACK_INPUT_INVALID');
            const payload = cloneSchemaData(JSON.parse(wire), MVU_SCHEMA_BOUNDS.inputBytes);
            const fields = ['schemaVersion', 'encoding', 'before', 'candidate', 'parsed', 'mutationEffects'];
            if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 1
                || payload.encoding !== 'native-mvu-schema-values-merge-v1' || Object.keys(payload).length !== fields.length
                || Object.keys(payload).some(key => !fields.includes(key)))
                throw Error('SCHEMA_CALLBACK_INPUT_INVALID');
            return payload;
        };
        const mergeValues = context.newFunction('nativeMvuSchemaValuesMergeV1', wireHandle => {
            try {
                const payload = mergePayload(wireHandle);
                const values = mergeMvuSchemaValues(payload.before, payload.candidate, payload.parsed, payload.mutationEffects);
                return context.newString(JSON.stringify({ kind: 'merged', values }));
            }
            catch {
                callbackFault = 'SCHEMA_VALUES_MERGE_FAILED';
                return context.newString(JSON.stringify({ kind: 'unavailable', code: callbackFault }));
            }
        });
        owned.push(mergeValues);
        const read = context.newFunction('nativeMvuReadScopeV1', wireHandle => {
            try {
                if (context.typeof(wireHandle) !== 'string')
                    throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID');
                const wire = context.getString(wireHandle);
                if (Buffer.byteLength(wire, 'utf8') > MVU_SCHEMA_BOUNDS.inputBytes)
                    throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID');
                const payload = cloneSchemaData(JSON.parse(wire), MVU_SCHEMA_BOUNDS.inputBytes);
                if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schemaVersion !== 1
                    || payload.encoding !== 'native-mvu-scope-read-call-v1' || typeof payload.scriptId !== 'string') {
                    throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID');
                }
                const reader = readers.get(payload.scriptId);
                if (!reader)
                    throw new MvuScopeReadError('SCOPE_READ_SCRIPT_UNAVAILABLE');
                const header = ['schemaVersion', 'encoding', 'scriptId', 'method'], option = Object.hasOwn(payload, 'option') ? ['option'] : [];
                const fields = payload.method === 'variables' ? [...header, ...option] : payload.method === 'all' ? header :
                    payload.method === 'variable' ? [...header, 'data', 'path', ...option] : [];
                if (!fields.length || Object.keys(payload).length !== fields.length
                    || Object.keys(payload).some(key => !fields.includes(key)))
                    throw new MvuScopeReadError('SCOPE_READ_REQUEST_INVALID');
                const value = payload.method === 'all' ? reader.getAllVariables() : payload.method === 'variables' ?
                    reader.getVariables(payload.option) :
                    readMvuVariable(payload.data, payload.path, payload.option);
                return context.newString(JSON.stringify({ kind: 'read', present: value !== undefined, ...(value === undefined ? {} : { value }) }));
            }
            catch (error) {
                const candidate = error instanceof Error ? error.message : undefined;
                const code = typeof candidate === 'string' && (/^(?:SCHEMA_|SCOPE_READ_)[A-Z_]+$/.test(candidate)
                    || ['SCOPE_SOURCE_UNAVAILABLE', 'MESSAGE_STATE_UNAVAILABLE'].includes(candidate)) ? candidate : 'SCHEMA_SCOPE_CALLBACK_FAILED';
                return context.newString(JSON.stringify({ kind: 'unavailable', code }));
            }
        });
        owned.push(read);
        // Parent projection omits material only for state-only execution; author
        // programs retain complete Source for this branch and later material use.
        const material = stateOnly ? context.undefined :
            context.newString(JSON.stringify(loadFrame?.material ?? program.source.material));
        const names = stateOnly ? context.undefined :
            context.newString(JSON.stringify(Object.fromEntries(libraries.map(library => [library.kind, library.globalName]))));
        const scriptScopes = stateOnly ? context.undefined :
            context.newString(JSON.stringify(initialScopes.scripts.map(({ scriptId, pointer }) => ({ scriptId, pointer }))));
        const execution = context.newString(JSON.stringify({ executionPlanSha256: view.executionPlanSha256, stateOnly,
            trial, unregisteredTrial: program === null,
            errorPolicy,
            serverScriptIds: serverScripts.map(({ script }) => script.identity) }));
        if (!stateOnly)
            owned.push(material, names, scriptScopes);
        owned.push(execution);
        const bootstrap = checked(context.evalCode(BOOTSTRAP, 'trusted-schema-bridge.js'));
        owned.push(bootstrap);
        const controller = checked(context.callFunction(bootstrap, context.undefined, inputHandle, material, names, scriptScopes, execution, mergeValues, read));
        owned.push(controller);
        if (!stateOnly) {
            initializationWriteError = context.getProp(controller, 'initializationWriteError');
            owned.push(initializationWriteError);
        }
        const ready = context.getProp(controller, 'ready'), run = context.getProp(controller, 'run');
        const frame = context.getProp(controller, 'frame'), loaded = context.getProp(controller, 'loaded');
        owned.push(ready, run, frame, loaded);
        let materialHandle;
        if (!stateOnly) {
            const sourceValue = context.getProp(controller, 'source'), prepareMaterial = context.getProp(controller, 'material');
            owned.push(sourceValue, prepareMaterial);
            // Schema closures retain their complete immutable Source snapshots.
            // State-only phases never read Source, so they prepare no guest material.
            const materials = new Map();
            const initialMaterial = loadFrame?.material ?? program.source.material;
            const initialSource = checked(context.callFunction(sourceValue, controller), context);
            materials.set(initialMaterial, initialSource);
            owned.push(initialSource);
            materialHandle = value => {
                const cached = materials.get(value);
                if (cached)
                    return cached;
                const wire = context.newString(JSON.stringify(value));
                try {
                    const source = checked(context.callFunction(prepareMaterial, controller, wire), context);
                    materials.set(value, source);
                    owned.push(source);
                    return source;
                }
                finally {
                    wire.dispose();
                }
            };
        }
        // State-only phases have no author modules or registrations. Their fixed
        // computational libraries load privately when the first update starts.
        if (!stateOnly) {
            const capabilities = context.getProp(controller, 'capabilities');
            owned.push(capabilities);
            const modules = new Map();
            for (const library of libraries.filter(library => library.kind !== 'mvu-196')) {
                const handle = context.getProp(context.global, library.globalName);
                let exported;
                try {
                    const list = checked(context.evalCode(`Object.keys(globalThis[${JSON.stringify(library.globalName)}])`, 'trusted-exports.js'));
                    try {
                        exported = context.dump(list);
                    }
                    finally {
                        list.dispose();
                    }
                }
                finally {
                    handle.dispose();
                }
                const source = exported.filter(name => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !['__proto__', 'constructor', 'prototype'].includes(name))
                    .map((name, index) => `const value${index}=globalThis[${JSON.stringify(library.globalName)}][${JSON.stringify(name)}];export {value${index} as ${name}};`);
                if (!exported.includes('default'))
                    source.push(`export default globalThis.${library.kind === 'zod' ? 'z' : '_'};`);
                if (library.kind === 'lodash' && !exported.includes('_'))
                    source.push('export const _=globalThis._;');
                if (library.kind === 'zod' && !exported.includes('z'))
                    source.push('export const z=globalThis.z;');
                modules.set(`nexttavern:${library.kind}`, source.join('\n'));
            }
            const scopeModules = new Map(scripts.map((script, index) => [index, `nexttavern:scope-author-${index}`]));
            const stagedogModules = new Map((schemaPlan?.commandPolicyProfile?.bindings ?? []).map(binding => [
                binding.scriptOrdinal, `nexttavern:scope-author-${binding.scriptOrdinal}-stagedog`
            ]));
            const scopeLoaderKey = '__native_mvu_scope_preload';
            for (const { index, script } of serverScripts) {
                const exports = scopedNames.map((name, ordinal) => `const value${ordinal}=owner[${JSON.stringify(name)}];export {value${ordinal} as ${name}};`).join('\n');
                modules.set(scopeModules.get(index), `const owner=globalThis[${JSON.stringify(scopeLoaderKey)}];\n${exports}`);
                if (stagedogModules.has(index)) {
                    modules.set(stagedogModules.get(index), `const owner=globalThis[${JSON.stringify(scopeLoaderKey)}];\n${exports}`);
                }
            }
            const allowed = new Map(serverScripts.map(({ script, index }) => [`author-${index}.mjs`, new Set([
                    ...script.imports.map(binding => `nexttavern:${binding.kind}`), scopeModules.get(index),
                    ...(stagedogModules.has(index) ? ['nexttavern:stagedog-schema-bridge'] : [])
                ])]));
            runtime.setModuleLoader(name => {
                const source = modules.get(name);
                if (source === undefined) {
                    denied = true;
                    throw Error('SCHEMA_IMPORT_UNAVAILABLE');
                }
                return source;
            }, (base, name) => {
                if (base !== 'trusted-preload.mjs' && !base.startsWith('trusted-scope-preload-') && !allowed.get(base)?.has(name)) {
                    denied = true;
                    throw Error('SCHEMA_IMPORT_UNAVAILABLE');
                }
                if (name === 'nexttavern:schema-bridge' || name === 'nexttavern:stagedog-schema-bridge') {
                    const index = scripts.findIndex((_script, index) => base === `author-${index}.mjs`);
                    if (index < 0) {
                        denied = true;
                        throw Error('SCHEMA_IMPORT_UNAVAILABLE');
                    }
                    return name === 'nexttavern:stagedog-schema-bridge' ? stagedogModules.get(index) : scopeModules.get(index);
                }
                return name;
            });
            // Cache library/bridge exports before author code can mutate library globals.
            const preload = checked(context.evalCode([...modules.keys()].filter(name => !name.startsWith('nexttavern:scope-author-'))
                .map(name => `import ${JSON.stringify(name)};`).join('\n'), 'trusted-preload.mjs', { type: 'module' }));
            try {
                completed(context, runtime, preload, loadFrame ? budget : { jobs: 0 });
            }
            finally {
                preload.dispose();
            }
            // Preload each capability export while only trusted code can see its VM
            // object, then delete the temporary global before evaluating any author.
            for (const { index, script } of serverScripts) {
                const exports = [{ module: scopeModules.get(index), policy: 'atomic-refusal' }];
                if (stagedogModules.has(index))
                    exports.push({ module: stagedogModules.get(index),
                        policy: schemaPlan.commandPolicyProfile.bindings.find(binding => binding.scriptOrdinal === index).policy });
                for (const entry of exports) {
                    const id = context.newString(script.identity), policy = context.newString(entry.policy);
                    const bound = (() => {
                        try {
                            return checked(context.callFunction(capabilities, controller, id, policy));
                        }
                        finally {
                            id.dispose();
                            policy.dispose();
                        }
                    })();
                    try {
                        context.setProp(context.global, scopeLoaderKey, bound);
                        const preloaded = checked(context.evalCode(`import ${JSON.stringify(entry.module)};`, `trusted-scope-preload-${index}-${entry.policy}.mjs`, { type: 'module' }));
                        try {
                            completed(context, runtime, preloaded, loadFrame ? budget : { jobs: 0 });
                        }
                        finally {
                            preloaded.dispose();
                        }
                    }
                    finally {
                        checked(context.evalCode(`delete globalThis[${JSON.stringify(scopeLoaderKey)}];`, 'trusted-scope-cleanup.js')).dispose();
                        bound.dispose();
                    }
                }
            }
            for (const { index, script } of serverScripts) {
                if (expired())
                    throw new GuestRefusal('SCHEMA_VM_TIMEOUT');
                const filename = `author-${index}.mjs`, source = bindAuthorScope(script.javascript, filename, scopeModules.get(index));
                const result = checked(context.evalCode(source, filename, { type: 'module' }), context);
                try {
                    completed(context, runtime, result, loadFrame ? budget : { jobs: 0 });
                }
                finally {
                    result.dispose();
                }
            }
        }
        const readyResult = checked(context.callFunction(ready, controller), context);
        try {
            completed(context, runtime, readyResult, loadFrame ? budget : { jobs: 0 });
        }
        finally {
            readyResult.dispose();
        }
        let updateLibraryInstalled = false;
        function phaseBudget(current) {
            if (current.phase !== 'update-core') {
                updateBudgetActive = false;
                return;
            }
            if (current.update.encoding === 'native-mvu-196-update-start-v1') {
                workMs = 0;
                budget.jobs = 0;
                updateBudgetActive = true;
            }
        }
        function prepareUpdate(current) {
            if (current.phase !== 'update-core')
                return;
            if (updateLibraryInstalled)
                return;
            const computational = libraries.find(library => library.kind === 'mvu-196');
            const lodashLibrary = libraries.find(library => library.kind === 'lodash');
            // The bridge has already fixed its global names. Capture the unchanged
            // UMD export privately for a state-only VM, and keep the computational
            // bundle's var local instead of relying on deleting a global var slot.
            const namespace = checked(context.evalCode(`(()=>{${computational.code}\nreturn ${computational.globalName};})()`, 'trusted-mvu-196.js'), context);
            const lodash = stateOnly ? checked(context.evalCode(`(()=>{const module={exports:{}},exports=module.exports;\n`
                + lodashLibrary.code + '\nreturn module.exports;})()', 'trusted-lodash.js'), context)
                : context.getProp(context.global, lodashLibrary.globalName);
            const install = context.getProp(controller, 'installUpdateLibrary');
            try {
                checked(context.callFunction(install, controller, namespace, lodash), context).dispose();
                updateLibraryInstalled = true;
            }
            finally {
                install.dispose();
                lodash.dispose();
                namespace.dispose();
            }
        }
        if (trace || stream) {
            // The load boundary must finish before any historical event exists.
            checked(context.callFunction(loaded, controller), context).dispose();
            const nextOnly = 'response' in request && request.response === 'next', outputs = [];
            let responseBytes = 2, lastOutput = '';
            function evaluateStep(step) {
                const current = step.frame;
                phaseBudget(current.input);
                if (timedOut || expired())
                    return unavailable('SCHEMA_VM_TIMEOUT');
                const scoped = phaseReaders(current.input);
                readInput = current.input;
                readers = scoped.readers;
                const wire = context.newString(JSON.stringify(current.input));
                try {
                    checked(context.callFunction(clockFrame, context.undefined, wire), context).dispose();
                    prepareUpdate(current.input);
                    if (stateOnly)
                        checked(context.callFunction(frame, controller, wire), context).dispose();
                    else
                        checked(context.callFunction(frame, controller, wire, materialHandle(current.material)), context).dispose();
                }
                finally {
                    wire.dispose();
                }
                let output;
                const handle = checked(context.callFunction(run, controller), context);
                try {
                    completed(context, runtime, handle, budget);
                    if (context.typeof(handle) !== 'string')
                        throw new GuestRefusal('SCHEMA_TRACE_OUTPUT_INVALID');
                    const json = context.getString(handle);
                    if (Buffer.byteLength(json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
                        throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT');
                    output = program === null ? validateUnregisteredTrialOutputV4(JSON.parse(json), current.input) :
                        validateSchemaGuestOutputForParsedProgramV4(JSON.parse(json), program, current.input);
                }
                finally {
                    handle.dispose();
                }
                if (callbackFault)
                    return unavailable(callbackFault);
                if (timedOut || expired())
                    return unavailable('SCHEMA_VM_TIMEOUT');
                if (denied)
                    return { kind: 'unavailable', code: 'SCHEMA_IMPORT_UNAVAILABLE' };
                // A disproved old event stops replay before the next event can change
                // a closure. The parent consumes this worker's checked output DATA.
                if ('output' in step && recordSha256(output) !== recordSha256(step.output)) {
                    return { kind: 'unavailable', code: 'SCHEMA_TRACE_PREFIX_MISMATCH' };
                }
                return { kind: 'phase', output };
            }
            if (stream) {
                let next = await manual.ready();
                let manualMaterial, manualForeground = false;
                while (next.kind !== 'close') {
                    stageScopeObjects(next.scopeObjects);
                    if (next.kind === 'trial-advance') {
                        if (!trial)
                            return unavailable('SCHEMA_TRIAL_INPUT_INVALID');
                        const phase = evaluateStep({ frame: { input: next.input, ...program ? { material: program.source.material } : {} } });
                        if (phase.kind === 'unavailable')
                            return phase;
                        if (phase.output.kind !== 'accepted')
                            return { kind: 'output', json: JSON.stringify(phase.output) };
                        next = await manual.park(JSON.stringify(phase.output));
                        continue;
                    }
                    const step = next.kind === 'advance' ? { eventId: next.step.eventId, frame: { ...next.step.frame, material: manualMaterial } } :
                        unpackSchemaEnvelopeV4(next.step, next.kind === 'hot-replay' ? MVU_SCHEMA_BOUNDS.inputBytes + MVU_SCHEMA_BOUNDS.outputBytes + 4096 : MVU_SCHEMA_BOUNDS.inputBytes, { nodes: MVU_SCHEMA_BOUNDS.evaluationNodes, depth: MVU_SCHEMA_BOUNDS.evaluationDepth }, materialIdentity);
                    // Reconstruct every actual historical closure in order. Each event
                    // retains its original phase budget; Native's one cold watchdog
                    // bounds the complete reconstruction including these round trips.
                    // Historical reconstruction is preparation. Once a foreground
                    // manual edit starts, its requested phase and every advance share
                    // the original cumulative budget, excluding parked Native waits.
                    if (!manualForeground && (step.frame.input.phase !== 'update-core'
                        || step.frame.input.update.encoding === 'native-mvu-196-update-start-v1')) {
                        workMs = 0;
                        budget.jobs = 0;
                    }
                    if (next.kind === 'hot-advance' && 'response' in request && request.response === 'manual-stream') {
                        manualForeground = true;
                        manualMaterial = step.frame.material;
                    }
                    const phase = evaluateStep(step);
                    if (phase.kind === 'unavailable')
                        return phase;
                    if (next.kind === 'hot-replay') {
                        const historical = step;
                        next = await manual.replayed(historical.stepSha256);
                    }
                    else if (phase.output.kind === 'accepted')
                        next = await manual.park(JSON.stringify(phase.output));
                    else
                        return { kind: 'next-output', json: JSON.stringify(phase.output) };
                }
                return { kind: 'manual-finished' };
            }
            for (const step of [...trace.prefix, trace.requestedStep]) {
                const phase = evaluateStep(step);
                if (phase.kind === 'unavailable')
                    return phase;
                let output = phase.output;
                if (manual && !('output' in step)) {
                    const material = trace.requestedStep.frame.material;
                    while (output.kind === 'accepted') {
                        // completed() drained all actual jobs before evaluateStep returned.
                        // Await Native only after this single wait slot has been armed.
                        const next = await manual.park(JSON.stringify(output));
                        if (next.kind === 'close')
                            return { kind: 'manual-finished' };
                        if (next.kind !== 'advance')
                            throw new GuestRefusal('SCHEMA_WORKER_OUTPUT_INVALID');
                        stageScopeObjects(next.scopeObjects);
                        const fresh = evaluateStep({ eventId: next.step.eventId,
                            frame: stateOnly ? next.step.frame : { ...next.step.frame, material } });
                        if (fresh.kind === 'unavailable')
                            return fresh;
                        output = fresh.output;
                    }
                    // Refusal is emitted by the entry only after original cleanup ran.
                    return { kind: 'next-output', json: JSON.stringify(output) };
                }
                if (nextOnly) {
                    if (!('output' in step))
                        lastOutput = JSON.stringify(output);
                }
                else {
                    // Each output already passed its real grammar and byte limit. Charge
                    // the full array's exact bytes once, including commas and brackets.
                    const json = JSON.stringify(output);
                    responseBytes += Buffer.byteLength(json, 'utf8') + (outputs.length ? 1 : 0);
                    if (responseBytes > MVU_SCHEMA_BOUNDS.outputBytes)
                        throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT');
                    outputs.push(json);
                }
            }
            if (timedOut || expired())
                return { kind: 'unavailable', code: 'SCHEMA_VM_TIMEOUT' };
            return nextOnly ? { kind: 'next-output', json: lastOutput } : { kind: 'trace-output', json: `[${outputs.join(',')}]` };
        }
        phaseBudget(input);
        prepareUpdate(input);
        const output = checked(context.callFunction(run, controller), context);
        try {
            completed(context, runtime, output, { jobs: 0 });
            // A guest can catch QuickJS's soft interrupt. Exhausting this budget
            // still invalidates its output; the parent owns the hard termination.
            if (timedOut || expired())
                return unavailable('SCHEMA_VM_TIMEOUT');
            if (denied)
                return unavailable('SCHEMA_IMPORT_UNAVAILABLE');
            if (callbackFault)
                return unavailable(callbackFault);
            if (context.typeof(output) !== 'string')
                return unavailable('SCHEMA_OUTPUT_INVALID');
            const json = context.getString(output);
            if (Buffer.byteLength(json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
                return unavailable('SCHEMA_OUTPUT_LIMIT');
            validateSchemaGuestOutputForParsedProgramV4(JSON.parse(json), program, input);
            if (timedOut || expired())
                return unavailable('SCHEMA_VM_TIMEOUT');
            return { kind: 'output', json };
        }
        finally {
            output.dispose();
        }
    }
    catch (error) {
        let writeFailure;
        // Only the trusted owner can set this fault. An authored thrown message is
        // never interpreted as a capability receipt or as a typed refusal code.
        if (initializationWriteError && !timedOut && !denied && !callbackFault) {
            const fault = context.callFunction(initializationWriteError, context.undefined);
            if (fault.error)
                fault.error.dispose();
            else {
                const value = fault.value;
                try {
                    if (context.typeof(value) === 'string')
                        writeFailure = context.getString(value);
                }
                finally {
                    value.dispose();
                }
            }
        }
        const code = timedOut || expired() ? 'SCHEMA_VM_TIMEOUT' : denied ? 'SCHEMA_IMPORT_UNAVAILABLE' :
            callbackFault ?? writeFailure ?? (error instanceof GuestRefusal ? error.code : 'SCHEMA_GUEST_ERROR');
        return unavailable(code);
    }
    finally {
        incomingScopeObjects.clear();
        scopeResolver = undefined;
        readers.clear();
        // Attempt every owned cleanup even if one disposer fails. A failed cleanup
        // invalidates a previously computed output rather than completing a phase.
        let cleanupFailed = false;
        for (const handle of owned.reverse())
            try {
                handle.dispose();
            }
            catch {
                cleanupFailed = true;
            }
        try {
            context.dispose();
        }
        catch {
            cleanupFailed = true;
        }
        try {
            runtime.dispose();
        }
        catch {
            cleanupFailed = true;
        }
        if (cleanupFailed)
            throw new GuestRefusal('SCHEMA_WORKER_CLEANUP');
    }
}
if (parentPort) {
    const seed = workerData;
    const materialIdentity = new Map();
    const bounds = { nodes: MVU_SCHEMA_BOUNDS.evaluationNodes, depth: MVU_SCHEMA_BOUNDS.evaluationDepth };
    const request = seed.kind === 'live-open' ? {
        ...unpackSchemaEnvelopeV4(seed.header, 2 * MVU_SCHEMA_BOUNDS.programBytes, bounds, materialIdentity),
        loadFrame: unpackSchemaEnvelopeV4(seed.load, MVU_SCHEMA_BOUNDS.inputBytes, undefined, materialIdentity),
        response: seed.mode, scopeObjects: seed.scopeObjects
    } : seed.kind === 'scope-reference-request-v2' ? {
        ...unpackSchemaEnvelopeV4(seed.request, 2 * MVU_SCHEMA_BOUNDS.programBytes + MVU_SCHEMA_BOUNDS.inputBytes, bounds),
        scopeObjects: seed.scopeObjects
    } :
        unpackSchemaEnvelopeV4(workerData, 2 * MVU_SCHEMA_BOUNDS.programBytes + MVU_SCHEMA_BOUNDS.inputBytes, bounds);
    if ('response' in request && (request.response === 'manual' || request.response === 'hot' || request.response === 'manual-stream'
        || request.response === 'trial-stream')) {
        const inbox = manualWorkerInbox();
        evaluateGuest(request, inbox, materialIdentity).then(result => {
            inbox.dispose();
            const value = result.kind === 'output' || result.kind === 'next-output' || result.kind === 'unavailable' ?
                { kind: 'manual-closed', cleanup: 'completed', result } : { kind: 'manual-closed', cleanup: 'completed' };
            parentPort.postMessage(value);
            parentPort.close();
        }, error => {
            inbox.dispose();
            parentPort.postMessage({ kind: 'manual-closed', cleanup: 'failed', code: error instanceof GuestRefusal ? error.code :
                    'SCHEMA_WORKER_UNAVAILABLE' });
            parentPort.close();
        });
    }
    else {
        evaluateGuest(request).then(result => parentPort.postMessage(result), error => parentPort.postMessage({ kind: 'unavailable', code: error instanceof GuestRefusal ? error.code :
                'SCHEMA_WORKER_UNAVAILABLE' }));
    }
}
