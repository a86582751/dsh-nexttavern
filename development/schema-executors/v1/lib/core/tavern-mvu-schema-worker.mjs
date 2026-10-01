// Generated from runtime/alpha3/schema-executors/v1/src/core/tavern-mvu-schema-worker.mts; edit the TypeScript source.
/** Trusted worker owns the VM and a pure JSONPatch bridge. Guest programs see
 * JSON copies and pinned library modules, never Node handles or write owners. */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import { prepareMvuUpdate } from './roleplay-mvu-update.js';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, cloneSchemaValues, schemaTextSha256, validateSchemaProgram } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
const require = createRequire(import.meta.url);
const MAX_JOBS = 1024;
const refuse = (code) => ({ kind: 'refused', code });
class GuestRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
const guestCodes = new Set(['SCHEMA_REGISTRATION_MISSING', 'SCHEMA_REGISTRATION_INVALID', 'SCHEMA_REGISTRATION_LIMIT',
    'SCHEMA_READY_INVALID', 'SCHEMA_JOB_LIMIT', 'SCHEMA_READ_UNSUPPORTED', 'SCHEMA_HOST_UNAVAILABLE',
    'SCHEMA_VALIDATION_FAILED', 'SCHEMA_OUTPUT_LIMIT', 'SCHEMA_OUTPUT_DATA_INVALID', 'SCHEMA_ROOT_OBJECT_REQUIRED',
    'SCHEMA_PHASE_UNSUPPORTED', 'SCHEMA_COMMAND_CLEANUP_FAILED']);
function guestError(error, context) {
    let code = 'SCHEMA_GUEST_ERROR';
    try {
        if (context?.typeof(error) === 'string') {
            // Primitive strings have an own length data property. Bound the copy
            // before reading text; never inspect an object's message or stack.
            const length = context.getProp(error, 'length');
            try {
                const size = context.getNumber(length);
                if (Number.isInteger(size) && size >= 0 && size <= 256) {
                    const actual = context.getString(error);
                    if (guestCodes.has(actual))
                        code = actual;
                }
            }
            finally {
                length.dispose();
            }
        }
    }
    finally {
        error.dispose();
    }
    throw new GuestRefusal(code);
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
    for (const name of ['quickjs-emscripten-core', '@jitl/quickjs-wasmfile-release-sync']) {
        const metadata = JSON.parse(readFileSync(resolve(dirname(require.resolve(name)), '..', 'package.json'), 'utf8'));
        if (metadata.name !== name || metadata.version !== '0.32.0')
            return false;
    }
    return true;
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
const BOOTSTRAP = String.raw `((wire,materialWire,libraryWire,reduceOperation)=>{
  'use strict';
  const G=globalThis,O=Object,A=Array,Jparse=JSON.parse,Jstring=JSON.stringify,apply=Reflect.apply;
  const descriptors=O.getOwnPropertyDescriptors,keys=O.keys,symbols=O.getOwnPropertySymbols,proto=O.getPrototypeOf;
  const array=A.isArray,own=O.hasOwn,freeze=O.freeze,define=O.defineProperty,finite=Number.isFinite;
  const char=String.prototype.charCodeAt,push=A.prototype.push,slice=A.prototype.slice;
  const split=String.prototype.split;
  const objectProto=O.prototype,arrayProto=A.prototype;
  let input=Jparse(wire);const material=Jparse(materialWire),libraries=Jparse(libraryWire);
  const zNamespace=G[libraries.zod],z=zNamespace.z||zNamespace,rawLodash=G[libraries.lodash],lodash=rawLodash.default||rawLodash;
  const ZodObject=z.ZodObject,looseObject=z.looseObject;
  const registrations=[],readyCallbacks=[];
  let values=input.values,commands=input.commands,metadata=input.context;
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
  function hasPointer(root,path){
    if(path==='')return true;
    const parts=apply(split,path,['/']);let current=root;
    for(let index=1;index<parts.length;index++){
      const raw=parts[index];let name='';
      for(let offset=0;offset<raw.length;offset++){
        if(raw[offset]==='~'&&raw[offset+1]==='0'){name+='~';offset++;}
        else if(raw[offset]==='~'&&raw[offset+1]==='1'){name+='/';offset++;}
        else name+=raw[offset];}
      if(!current||typeof current!=='object'||!own(current,name))return false;
      current=current[name];}
    return true;
  }
  function numerical(value){
    if(!value||typeof value!=='object'||array(value))fail('SCHEMA_ROOT_OBJECT_REQUIRED');
    return Jparse(encode(value,1048576,32,32000));}
  function frozen(value){if(value&&typeof value==='object'){
    const names=keys(value);for(let index=0;index<names.length;index++)frozen(value[names[index]]);freeze(value);}return value;}
  let source=frozen(material);
  function fullData(){
    const result=clone(metadata);
    define(result,'stat_data',{value:clone(values),enumerable:true,writable:true,configurable:true});
    return result;
  }
  function readonlyData(){if(arguments.length)fail('SCHEMA_READ_UNSUPPORTED');return frozen(fullData());}
  function readSource(){if(arguments.length)fail('SCHEMA_READ_UNSUPPORTED');return source;}
  function getVariable(path){if(arguments.length!==1||typeof path!=='string')fail('SCHEMA_READ_UNSUPPORTED');
    const read=lodash.get(readonlyData(),path);if(read===undefined)return null;return frozen(clone(read));}
  function schemaFor(registration){
    const schema=typeof registration==='function'?registration():registration;
    if(!schema||typeof schema.safeParse!=='function')fail('SCHEMA_REGISTRATION_INVALID');
    return schema instanceof ZodObject?apply(looseObject,z,[schema.shape]):schema;
  }
  function parse(schema,candidate){
    let result;
    try{result=schema.safeParse(clone(candidate));}catch(error){
      if(typeof error==='string'&&/^SCHEMA_[A-Z_]+$/.test(error))throw error;
      fail('SCHEMA_GUEST_ERROR');}
    if(!result||result.success!==true)return null;
    return numerical(result.data);
  }
  function registerMvuSchema(registration){
    if(registrations.length>=64)fail('SCHEMA_REGISTRATION_LIMIT');
    schemaFor(registration);apply(push,registrations,[registration]);
  }
  function ready(callback){if(typeof callback!=='function')fail('SCHEMA_READY_INVALID');
    if(readyCallbacks.length>=64)fail('SCHEMA_JOB_LIMIT');apply(push,readyCallbacks,[callback]);}
  const jq=argument=>{if(typeof argument==='function'){ready(argument);return;}
    // Only ready callbacks have a proved schema bridge contract. A selector
    // cannot borrow a fictitious DOM or silently turn an unknown UI read false.
    fail('SCHEMA_HOST_UNAVAILABLE');};
  const globals={z,_:lodash,$:jq,jQuery:jq,registerMvuSchema,getAllVariables:readonlyData,
    getvar:getVariable,getMvuVariable:getVariable,getMvuData:readonlyData,
    readSchemaSource:readSource,waitGlobalInitialized:async name=>{
      if(name!=='Mvu')fail('SCHEMA_HOST_UNAVAILABLE');},
    console:freeze({log(){},info(){},warn(){},error(){}})};
  const names=keys(globals);
  for(let index=0;index<names.length;index++)define(G,names[index],{value:globals[names[index]],writable:false,configurable:false});
  for(const name of ['Proxy','process','require','fetch','WebSocket','XMLHttpRequest','window','document','navigator',
    'localStorage','sessionStorage','setTimeout','setInterval','queueMicrotask','Deno','Bun']) {
    define(G,name,{value:undefined,writable:false,configurable:false});}
  const Mvu=freeze({getMvuData:readonlyData,getMvuVariable:getVariable});
  define(G,'Mvu',{value:Mvu,writable:false,configurable:false});
  return {
    frame(wire,materialWire){input=Jparse(wire);values=input.values;commands=input.commands;metadata=input.context;
      source=frozen(Jparse(materialWire));},
    loaded(){if(!registrations.length)fail('SCHEMA_REGISTRATION_MISSING');},
    async ready(){for(let index=0;index<readyCallbacks.length;index++){
      await readyCallbacks[index]();}
    },
    run(){
      if(!registrations.length)fail('SCHEMA_REGISTRATION_MISSING');
      if(input.phase==='initialization'||input.phase==='manual-replacement') {
        for(let index=0;index<registrations.length;index++){
          const parsed=parse(schemaFor(registrations[index]),values);
          if(parsed===null)fail('SCHEMA_VALIDATION_FAILED');
          if(input.phase==='manual-replacement')values=parsed;
          else{const merged=clone(values),names=keys(parsed);
            for(let field=0;field<names.length;field++)define(merged,names[field],{value:parsed[names[field]],enumerable:true,writable:true,configurable:true});
            values=numerical(merged);}
        }
      }else if(input.phase==='command-parsed') {
        for(let registration=0;registration<registrations.length;registration++) {
          const schema=schemaFor(registrations[registration]),remaining=[];
          for(let index=0;index<commands.length;index++) {
            const command=commands[index],wire=encode({values,operation:command},8388608);
            const reduced=Jparse(reduceOperation(wire));
            if(reduced.kind!=='prepared'){apply(push,remaining,[command]);continue;}
            const parsed=parse(schema,reduced.values);
            if(parsed===null){apply(push,remaining,[command]);continue;}
            let merged=clone(values);const names=keys(parsed);
            // Preserve the fixed bridge's merge semantics. Only the explicit
            // RFC remove/move source path may clean the old merge basis; the
            // canonical pure reducer applies that cleanup too.
            if(reduced.cleanupPath!==undefined&&hasPointer(merged,reduced.cleanupPath)&&!hasPointer(parsed,reduced.cleanupPath)){
              const cleaned=Jparse(reduceOperation(encode({values:merged,operation:{op:'remove',path:reduced.cleanupPath}},8388608)));
              if(cleaned.kind!=='prepared')fail('SCHEMA_COMMAND_CLEANUP_FAILED');merged=cleaned.values;
            }
            for(let field=0;field<names.length;field++)define(merged,names[field],{value:parsed[names[field]],enumerable:true,writable:true,configurable:true});
            values=numerical(merged);
          }
          commands=remaining;
        }
      }else if(input.phase==='commands-parsed')commands=[];
      else if(input.phase==='update-ended'){
        // Owned opaque placeholder: equivalent metadata behavior, not copied
        // helper bytes and never a schema descriptor or publication authority.
        metadata.schema='native-zod-schema';delete metadata.display_data;delete metadata.delta_data;
      }else fail('SCHEMA_PHASE_UNSUPPORTED');
      return encode({kind:'accepted',values:numerical(values),commands:clone(commands),context:clone(metadata),registrations:registrations.length});
    },
    encode,
  };
})`;
async function evaluateGuest(request) {
    if (!peerVersions())
        return { kind: 'unavailable', code: 'SCHEMA_IMPLEMENTATION_UNAVAILABLE' };
    const program = validateSchemaProgram(request.program);
    const trace = 'trace' in request ? cloneSchemaData(request.trace, MVU_SCHEMA_BOUNDS.inputBytes) : undefined;
    const input = trace ? { schemaVersion: 1, phase: 'initialization', base: null, values: trace.loadFrame.values,
        commands: [], context: trace.loadFrame.context, clockEpochMs: trace.loadFrame.clockEpochMs, randomSeed: trace.loadFrame.randomSeed } :
        cloneSchemaData(request.input, MVU_SCHEMA_BOUNDS.inputBytes);
    const libraries = cloneSchemaData(request.libraries, MVU_SCHEMA_BOUNDS.programBytes);
    for (const library of libraries)
        if (schemaTextSha256(library.code) !== library.bundleSha256) {
            return { kind: 'unavailable', code: 'SCHEMA_LIBRARY_UNAVAILABLE' };
        }
    const quickjs = await newQuickJSWASMModuleFromVariant(variant);
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(MVU_SCHEMA_BOUNDS.vmMemoryBytes);
    runtime.setMaxStackSize(MVU_SCHEMA_BOUNDS.vmStackBytes);
    const deadline = Date.now() + MVU_SCHEMA_BOUNDS.vmDeadlineMs;
    let timedOut = false, denied = false;
    const budget = { jobs: 0 };
    runtime.setInterruptHandler(() => { if (Date.now() >= deadline)
        timedOut = true; return timedOut; });
    const context = runtime.newContext(), owned = [];
    try {
        const inputHandle = context.newString(JSON.stringify(input));
        owned.push(inputHandle);
        const determinism = checked(context.evalCode(DETERMINISM, 'trusted-clock.js'));
        owned.push(determinism);
        const clockFrame = checked(context.callFunction(determinism, context.undefined, inputHandle));
        owned.push(clockFrame);
        for (const library of libraries)
            checked(context.evalCode(library.code, `trusted-${library.kind}.js`)).dispose();
        const reduce = context.newFunction('nativeJsonPatch', wireHandle => {
            try {
                if (context.typeof(wireHandle) !== 'string')
                    throw Error();
                const wire = context.getString(wireHandle);
                if (Buffer.byteLength(wire, 'utf8') > MVU_SCHEMA_BOUNDS.inputBytes)
                    throw Error();
                const payload = cloneSchemaData(JSON.parse(wire), MVU_SCHEMA_BOUNDS.inputBytes);
                if (Object.keys(payload).sort().join(',') !== 'operation,values')
                    throw Error();
                const base = cloneSchemaValues(payload.values);
                // Only this worker emits the fixed narrative wrapper around JSON data.
                // Guest strings can never become executable code or parser wrappers.
                const json = JSON.stringify([payload.operation]);
                const result = prepareMvuUpdate(`<UpdateVariable><JSONPatch>${json}</JSONPatch></UpdateVariable>`, base);
                const operation = result.kind === 'prepared' ? result.operations[0] : undefined;
                const cleanupPath = operation?.op === 'remove' ? operation.path :
                    operation?.op === 'move' && operation.from !== operation.path ? operation.from : undefined;
                const output = result.kind === 'prepared' ? { kind: 'prepared', values: cloneSchemaValues(result.values),
                    ...(cleanupPath !== undefined ? { cleanupPath } : {}) } : { kind: 'refused' };
                return context.newString(JSON.stringify(output));
            }
            catch {
                return context.newString('{"kind":"refused"}');
            }
        });
        owned.push(reduce);
        const libraryNames = Object.fromEntries(libraries.map(library => [library.kind, library.globalName]));
        const material = context.newString(JSON.stringify(trace?.loadFrame.material ?? program.source.material));
        const names = context.newString(JSON.stringify(libraryNames));
        owned.push(material, names);
        const bootstrap = checked(context.evalCode(BOOTSTRAP, 'trusted-schema-bridge.js'));
        owned.push(bootstrap);
        const controller = checked(context.callFunction(bootstrap, context.undefined, inputHandle, material, names, reduce));
        owned.push(controller);
        const ready = context.getProp(controller, 'ready'), run = context.getProp(controller, 'run');
        const frame = context.getProp(controller, 'frame'), loaded = context.getProp(controller, 'loaded');
        owned.push(ready, run, frame, loaded);
        const modules = new Map();
        for (const library of libraries) {
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
        modules.set('nexttavern:schema-bridge', 'export const registerMvuSchema=globalThis.registerMvuSchema;');
        const allowed = new Map(program.scripts.map((script, index) => [`author-${index}.mjs`, new Set(script.imports.map(binding => `nexttavern:${binding.kind}`))]));
        runtime.setModuleLoader(name => {
            const source = modules.get(name);
            if (source === undefined) {
                denied = true;
                throw Error('SCHEMA_IMPORT_UNAVAILABLE');
            }
            return source;
        }, (base, name) => {
            if (base !== 'trusted-preload.mjs' && !allowed.get(base)?.has(name)) {
                denied = true;
                throw Error('SCHEMA_IMPORT_UNAVAILABLE');
            }
            return name;
        });
        // Cache library/bridge exports before author code can mutate library globals.
        const preload = checked(context.evalCode([...modules.keys()].map(name => `import ${JSON.stringify(name)};`).join('\n'), 'trusted-preload.mjs', { type: 'module' }));
        try {
            completed(context, runtime, preload, trace ? budget : { jobs: 0 });
        }
        finally {
            preload.dispose();
        }
        for (const [index, script] of program.scripts.entries()) {
            if (!script.enabled)
                continue;
            const result = checked(context.evalCode(script.javascript, `author-${index}.mjs`, { type: 'module' }), context);
            try {
                completed(context, runtime, result, trace ? budget : { jobs: 0 });
            }
            finally {
                result.dispose();
            }
        }
        const readyResult = checked(context.callFunction(ready, controller), context);
        try {
            completed(context, runtime, readyResult, trace ? budget : { jobs: 0 });
        }
        finally {
            readyResult.dispose();
        }
        if (trace) {
            if (trace.prefix.length >= MVU_SCHEMA_BOUNDS.traceSteps)
                return { kind: 'unavailable', code: 'SCHEMA_TRACE_INPUT_INVALID' };
            // The load boundary must finish before any historical event exists.
            checked(context.callFunction(loaded, controller), context).dispose();
            const outputs = [];
            for (const step of [...trace.prefix, trace.requestedStep]) {
                if (timedOut || Date.now() >= deadline)
                    return { kind: 'unavailable', code: 'SCHEMA_VM_TIMEOUT' };
                const current = step.frame;
                const wire = context.newString(JSON.stringify(current.input)), source = context.newString(JSON.stringify(current.material));
                try {
                    checked(context.callFunction(clockFrame, context.undefined, wire), context).dispose();
                    checked(context.callFunction(frame, controller, wire, source), context).dispose();
                }
                finally {
                    wire.dispose();
                    source.dispose();
                }
                let output;
                try {
                    const handle = checked(context.callFunction(run, controller), context);
                    try {
                        completed(context, runtime, handle, budget);
                        if (context.typeof(handle) !== 'string')
                            throw new GuestRefusal('SCHEMA_TRACE_OUTPUT_INVALID');
                        const json = context.getString(handle);
                        if (Buffer.byteLength(json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
                            throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT');
                        output = cloneSchemaData(JSON.parse(json), MVU_SCHEMA_BOUNDS.outputBytes);
                    }
                    finally {
                        handle.dispose();
                    }
                }
                catch (error) {
                    // Only known synchronous bridge refusals can complete an event.
                    // Generic VM errors may be allocation failures, so they cannot prove
                    // a completed phase or revive a partially executed realm.
                    // Declared asymmetry: single-phase evidence may record output/job
                    // limits; traces conservatively discard the whole partial execution.
                    if (!(error instanceof GuestRefusal) || !guestCodes.has(error.code)
                        || ['SCHEMA_OUTPUT_LIMIT', 'SCHEMA_JOB_LIMIT'].includes(error.code))
                        throw error;
                    runJobs(runtime, context, budget);
                    output = { kind: 'refused', diagnostics: [{ code: error.code }] };
                }
                if (timedOut || Date.now() >= deadline)
                    return { kind: 'unavailable', code: 'SCHEMA_VM_TIMEOUT' };
                if (denied)
                    return { kind: 'unavailable', code: 'SCHEMA_IMPORT_UNAVAILABLE' };
                // A disproved old event stops replay before the next event can change
                // a closure. Parent independently validates the same complete outputs.
                if ('output' in step && recordSha256(output) !== recordSha256(step.output)) {
                    return { kind: 'unavailable', code: 'SCHEMA_TRACE_PREFIX_MISMATCH' };
                }
                outputs.push(output);
                // Bound the complete response as it grows, never one envelope per step.
                try {
                    cloneSchemaData(outputs, MVU_SCHEMA_BOUNDS.outputBytes);
                }
                catch {
                    throw new GuestRefusal('SCHEMA_OUTPUT_LIMIT');
                }
            }
            const json = JSON.stringify(outputs);
            if (timedOut || Date.now() >= deadline)
                return { kind: 'unavailable', code: 'SCHEMA_VM_TIMEOUT' };
            return { kind: 'trace-output', json };
        }
        const output = checked(context.callFunction(run, controller), context);
        try {
            completed(context, runtime, output, { jobs: 0 });
            // A guest can catch QuickJS's soft interrupt. Exhausting this budget
            // still invalidates its output; the parent owns the hard termination.
            if (timedOut || Date.now() >= deadline)
                return refuse('SCHEMA_VM_TIMEOUT');
            if (denied)
                return refuse('SCHEMA_IMPORT_UNAVAILABLE');
            if (context.typeof(output) !== 'string')
                return refuse('SCHEMA_OUTPUT_INVALID');
            const json = context.getString(output);
            if (Buffer.byteLength(json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
                return refuse('SCHEMA_OUTPUT_LIMIT');
            if (timedOut || Date.now() >= deadline)
                return refuse('SCHEMA_VM_TIMEOUT');
            return { kind: 'output', json };
        }
        finally {
            output.dispose();
        }
    }
    catch (error) {
        const code = timedOut || Date.now() >= deadline ? 'SCHEMA_VM_TIMEOUT' : denied ? 'SCHEMA_IMPORT_UNAVAILABLE' :
            error instanceof GuestRefusal ? error.code : 'SCHEMA_GUEST_ERROR';
        return trace ? { kind: 'unavailable', code } : refuse(code);
    }
    finally {
        for (const handle of owned.reverse())
            handle.dispose();
        context.dispose();
        runtime.dispose();
    }
}
if (parentPort) {
    evaluateGuest(workerData).then(result => parentPort.postMessage(result), () => parentPort.postMessage({ kind: 'unavailable', code: 'SCHEMA_WORKER_UNAVAILABLE' }));
}
