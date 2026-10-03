// Generated from runtime/alpha3/src/core/tavern-template-worker.mts; edit the TypeScript source.
/** Only this actual QuickJS worker executes author code. Node owns the text,
 * dependency and proposal logs; guests never receive Node objects or owners. */
import { parentPort, workerData } from 'node:worker_threads';
import { recordSha256 } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { normalizeTemplateInventoryV1, templateEngineIdentityV1 } from './tavern-template-descriptor.mjs';
import { compileTemplateFunctionV1 } from './tavern-template-compiler.mjs';
import { TEMPLATE_INJECTION_GUEST_BRIDGE_V1 } from './tavern-template-injection-guest.mjs';
import { validateInjectionPhaseV1, injectionPhaseRequestV1, injectionCreationHeadV1, validateInjectionReceiptV1 } from './tavern-template-injection-data.mjs';
import { TEMPLATE_LIMITS_V1, TemplateRefusalV1, templateFail, templateExact, templateId, validateTemplateRequestV1, validateTemplateOutputV1, templateReadV1, templateActivationV1, cloneTemplateEnvelopeV1, templateLoreBindingV1, templateVariableValueV1, validateTemplateInjectionEffectsV1 } from './tavern-template-data.mjs';
const unavailable = (code, pointer = null, limit = null) => ({ kind: 'refused', diagnostic: { schemaVersion: 1, code, sourcePointer: pointer, limit } });
/** Captured VM intrinsics decode only trusted JSON copies. The private handle
 * remains in this worker; author code cannot replace it by mutating JSON. */
const READONLY_DECODE = String.raw `(function(){
  const parse=JSON.parse,freeze=Object.freeze,keys=Object.keys;
  function frozen(value){if(value&&typeof value==='object'){
    const names=keys(value);for(let i=0;i<names.length;i++)frozen(value[names[i]]);freeze(value);
  }return value;}
  return text=>frozen(parse(text));
})()`;
const MUTABLE_DECODE = String.raw `(function(){const parse=JSON.parse;return text=>parse(text)})()`;
/** Author options are inspected inside QuickJS with captured intrinsics. A
 * Proxy/getter can spend only this VM's deadline; Node never reflects on it. */
const CAPTURE_VARIABLE_ARGUMENTS = String.raw `(function(){
  const descriptors=Object.getOwnPropertyDescriptors,prototype=Object.getPrototypeOf;
  const keys=Reflect.ownKeys,array=Array.isArray,own=Object.hasOwn,stringify=JSON.stringify;
  const create=Object.create,setPrototype=Object.setPrototypeOf;
  const string=String;
  const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,finite=Number.isFinite;
  const safe=Number.isSafeInteger;
  function captured(key,options){
    if(key!==null&&typeof key!=='string')throw Error('argument');
    if(typeof key==='string'&&key.length>4096)throw Error('argument');
    let nodes=0;const ancestors=[];
    function copy(value,depth){
      if(++nodes>4096||depth>32)throw Error('argument');
      if(value===null||typeof value==='boolean'||typeof value==='string')return value;
      if(typeof value==='number'){if(!finite(value))throw Error('argument');return value;}
      if(typeof value!=='object')throw Error('argument');
      for(let index=0;index<ancestors.length;index++)if(ancestors[index]===value)throw Error('argument');
      const list=array(value),base=prototype(value);
      if(list?base!==arrayPrototype:base!==objectPrototype&&base!==null)throw Error('argument');
      const names=keys(value),props=descriptors(value);
      if(names.length>4097)throw Error('argument');
      for(let index=0;index<names.length;index++)if(typeof names[index]!=='string')throw Error('argument');
      ancestors[ancestors.length]=value;let result;
      if(list){
        const length=props.length.value;
        if(!safe(length)||length<0||length>4096||names.length!==length+1)throw Error('argument');
        result=[];setPrototype(result,null);
        for(let index=0;index<length;index++){
          const item=props[string(index)];
          if(!item||!own(item,'value')||!item.enumerable)throw Error('argument');
          result[result.length]=copy(item.value,depth+1);
        }
      }else{
        result=create(null);
        for(let index=0;index<names.length;index++){
          const name=names[index];
          const item=props[name];
          if(name==='__proto__'||name==='constructor'||name==='prototype'||!own(item,'value')||!item.enumerable)throw Error('argument');
          if(item.value!==undefined)result[name]=copy(item.value,depth+1);
        }
      }
      ancestors.length--;return result;
    }
    const nativeScopeString=typeof options==='string';
    if(options===undefined)options={};
    if(nativeScopeString)options={scope:options};
    if(options===null||typeof options!=='object'||array(options))throw Error('argument');
    const names=keys(options);
    for(let index=0;index<names.length;index++){
      const name=names[index];
      if(typeof name!=='string'||name!=='scope'&&name!=='defaults'&&name!=='index'&&name!=='clone'&&name!=='noCache')throw Error('argument');
    }
    const data=create(null);data.key=key;data.options=copy(options,0);data.nativeScopeString=nativeScopeString;
    const wire=stringify(data);
    if(wire.length>65536)throw Error('argument');
    return wire;
  }
  return captured;
})()`;
const DETERMINISM = String.raw `(function(clock,random){
  'use strict';const OriginalDate=Date,construct=Reflect.construct,define=Object.defineProperty;
  function FixedDate(...args){const value=construct(OriginalDate,args.length?args:[clock()]);
    return new.target?value:value.toString();}
  FixedDate.prototype=OriginalDate.prototype;
  define(FixedDate.prototype,'constructor',{value:FixedDate,writable:false,configurable:false});
  define(FixedDate,'now',{value:()=>clock(),writable:false,configurable:false});
  FixedDate.parse=OriginalDate.parse;FixedDate.UTC=OriginalDate.UTC;
  define(globalThis,'Date',{value:FixedDate,writable:false,configurable:false});
  define(Math,'random',{value:random,writable:false,configurable:false});
  return String;
})`;
/** Open/close capabilities and frame identities stay in a trusted lexical
 * closure. All author compilation/evaluation occurs inside this same realm;
 * native callbacks never reenter an author function. Capture intrinsics before
 * the first author turn so sibling jobs cannot alter bridge bookkeeping. */
const ASYNC_BRIDGE = TEMPLATE_INJECTION_GUEST_BRIDGE_V1;
async function evaluateOwnedTemplateWorkerV1(raw) {
    const message = cloneTemplateEnvelopeV1(raw, { bytes: 'workerInputBytes', nodes: 'workerInputNodes', depth: 'workerInputDepth' });
    const restoration = !!message && typeof message === 'object' && !Array.isArray(message) && Object.hasOwn(message, 'restore');
    templateExact(message, ['request', 'engine', 'inventory', ...restoration ? ['restore'] : []]);
    let programInstanceId = '', phaseCount = 0;
    if (restoration) {
        templateExact(message.restore, ['programInstanceId', 'phaseCount']);
        if (!templateId(message.restore.programInstanceId) || typeof message.restore.phaseCount !== 'number'
            || !Number.isSafeInteger(message.restore.phaseCount) || message.restore.phaseCount < 1
            || message.restore.phaseCount > TEMPLATE_LIMITS_V1.injectionJournalPhases + 1)
            templateFail('TEMPLATE_INJECTION_PROTOCOL');
        programInstanceId = message.restore.programInstanceId;
        phaseCount = message.restore.phaseCount;
    }
    // The parent factory admitted this loaded component generation. Parse the
    // actual worker envelope and bind its engine; do not repeat the package scan.
    const inventory = normalizeTemplateInventoryV1(message.inventory), admitted = { engine: templateEngineIdentityV1(inventory) };
    if (recordSha256(message.engine) !== recordSha256(admitted.engine))
        templateFail('TEMPLATE_ENGINE_IDENTITY');
    const request = validateTemplateRequestV1(message.request), pointer = request.source.pointer;
    let activeRequest = request;
    const compiled = compileTemplateFunctionV1(request.source.template, pointer);
    // The admitted component owns these fixed imports. The worker protocol
    // supplies neither dependency paths nor a different executable module.
    const core = await import('quickjs-emscripten-core');
    const wasm = await import('@jitl/quickjs-wasmfile-release-sync');
    const quickjs = await core.newQuickJSWASMModuleFromVariant(wasm.default);
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(TEMPLATE_LIMITS_V1.vmMemoryBytes);
    runtime.setMaxStackSize(TEMPLATE_LIMITS_V1.vmStackBytes);
    const deadline = performance.now() + TEMPLATE_LIMITS_V1.vmDeadlineMs;
    let timedOut = false, callbackFault;
    const fault = (code, limit = null) => {
        callbackFault ??= { schemaVersion: 1, code, sourcePointer: pointer, limit };
    };
    const limit = (field, observed) => fault('TEMPLATE_HELPER_LIMIT', { field, observed, maximum: TEMPLATE_LIMITS_V1[field] });
    runtime.setInterruptHandler(() => { if (performance.now() >= deadline)
        timedOut = true; return timedOut; });
    runtime.setModuleLoader(() => { fault('TEMPLATE_IMPORT_UNSUPPORTED'); throw Error('TEMPLATE_IMPORT_UNSUPPORTED'); });
    let context;
    const owned = [];
    const reads = [];
    const activations = [];
    const readKeys = new Set(), activationKeys = new Set();
    const effects = [];
    let nextBatchOrdinal = 0, nextCallbackOrdinal = 0, nextEffectOrdinal = 0, templateEvaluations = 1, jobs = 0;
    let totalReads = 0, totalActivations = 0;
    let randomOrdinal = 0, randomDomain;
    const rootBinding = activeRequest.snapshot.lore.find(row => row.sourcePointer === pointer
        && (request.source.rootEntryId ? row.entryId === request.source.rootEntryId : row.contentSha256 === request.source.templateSha256));
    const frames = new Map([[0, { invocation: 0, parentInvocation: null, depth: 0,
                entryId: rootBinding?.entryId ?? null, sourcePointer: pointer, contentSha256: request.source.templateSha256,
                compiledSourceSha256: schemaTextSha256(compiled.factorySource), parts: [], chars: 0, bytes: 0,
                closed: false, renderedTextSha256: null }]]);
    let sourceBytes = Buffer.byteLength(request.source.template, 'utf8');
    let compiledBytes = Buffer.byteLength(compiled.factorySource, 'utf8'), outputBytes = 0, calls = 0, randomCalls = 0;
    let outcome = unavailable('TEMPLATE_GUEST_ERROR', pointer);
    try {
        context = runtime.newContext();
        const ctx = context;
        const checked = (result) => {
            if (result.error) {
                result.error.dispose();
                throw Error('TEMPLATE_GUEST_ERROR');
            }
            return result.value;
        };
        const decoder = checked(ctx.evalCode(READONLY_DECODE, 'owned-template-json-decoder.js'));
        owned.push(decoder);
        const mutableDecoder = checked(ctx.evalCode(MUTABLE_DECODE, 'owned-template-mutable-json-decoder.js'));
        owned.push(mutableDecoder);
        const captureArguments = checked(ctx.evalCode(CAPTURE_VARIABLE_ARGUMENTS, 'owned-template-arguments.js'));
        owned.push(captureArguments);
        const readValue = (value, mutable = false) => {
            const wire = ctx.newString(JSON.stringify(value));
            try {
                return checked(ctx.callFunction(mutable ? mutableDecoder : decoder, ctx.undefined, wire));
            }
            finally {
                wire.dispose();
            }
        };
        const before = () => {
            if (callbackFault)
                return false;
            if (performance.now() >= deadline) {
                timedOut = true;
                return false;
            }
            if (++calls > TEMPLATE_LIMITS_V1.helperCalls) {
                limit('helperCalls', calls);
                return false;
            }
            return true;
        };
        const stringArg = (value) => {
            if (!value || ctx.typeof(value) !== 'string') {
                fault('TEMPLATE_HELPER_ARGUMENT');
                return null;
            }
            const text = ctx.getString(value);
            if (!templateId(text)) {
                fault('TEMPLATE_HELPER_ARGUMENT');
                return null;
            }
            return text;
        };
        const addRead = (row) => {
            const identity = recordSha256(row);
            if (readKeys.has(identity))
                return true;
            if (totalReads >= TEMPLATE_LIMITS_V1.readDependencies) {
                limit('readDependencies', totalReads + 1);
                return false;
            }
            totalReads++;
            readKeys.add(identity);
            reads.push(row);
            return true;
        };
        const getvar = ctx.newFunction('getvar', (...args) => {
            if (!before())
                return ctx.null;
            if (args.length < 1 || args.length > 2) {
                fault('TEMPLATE_HELPER_ARITY');
                return ctx.null;
            }
            try {
                const captured = checked(ctx.callFunction(captureArguments, ctx.undefined, args[0], args[1] ?? ctx.undefined));
                let wire;
                try {
                    wire = ctx.getString(captured);
                }
                finally {
                    captured.dispose();
                }
                if (Buffer.byteLength(wire, 'utf8') > TEMPLATE_LIMITS_V1.helperArgumentBytes) {
                    limit('helperArgumentBytes', Buffer.byteLength(wire, 'utf8'));
                    return ctx.null;
                }
                const data = JSON.parse(wire);
                const key = data.key, options = data.options;
                if (options.scope !== undefined && typeof options.scope !== 'string'
                    || options.clone !== undefined && typeof options.clone !== 'boolean'
                    || options.noCache !== undefined && typeof options.noCache !== 'boolean'
                    || options.index !== undefined && options.index !== null
                        && (typeof options.index !== 'number' || !Number.isSafeInteger(options.index) || options.index < 0 || options.index > 4096)) {
                    fault('TEMPLATE_HELPER_ARGUMENT');
                    return ctx.null;
                }
                if (options.noCache === true) {
                    fault('TEMPLATE_HELPER_UNSUPPORTED');
                    return ctx.null;
                }
                const selected = options.scope === undefined ? activeRequest.snapshot.defaultVariableScope : String(options.scope);
                // ST options.message without withMsg reads its captured cache. Native
                // explicit scope-string calls retain the separate message binding.
                // Initial remains unavailable unless the owner supplies its own real
                // InitialVariables basis; neither card nor MVU InitVar is an alias.
                const scope = selected === 'local' ? 'chat' : selected === 'message' && !data.nativeScopeString ? 'cache' : selected;
                const row = templateReadV1(activeRequest.snapshot, 'variable', key, scope, 'read');
                if (!addRead(row))
                    return ctx.null;
                const actual = templateVariableValueV1(activeRequest.snapshot, key, scope);
                let present = actual.present, value = actual.value;
                if (options.index !== undefined && options.index !== null) {
                    if (present && typeof value !== 'string') {
                        fault('TEMPLATE_HELPER_ARGUMENT');
                        return ctx.null;
                    }
                    const raw = present && value ? String(value) : '{}';
                    if (Buffer.byteLength(raw, 'utf8') > TEMPLATE_LIMITS_V1.helperArgumentBytes) {
                        limit('helperArgumentBytes', Buffer.byteLength(raw, 'utf8'));
                        return ctx.null;
                    }
                    const parsed = JSON.parse(raw);
                    const index = String(options.index);
                    present = parsed !== null && typeof parsed === 'object' && Object.hasOwn(parsed, index);
                    value = present ? parsed[index] : null;
                }
                if (!present)
                    value = Object.hasOwn(options, 'defaults') ? options.defaults : null;
                return readValue(value, options.clone === true);
            }
            catch (error) {
                fault(error instanceof TemplateRefusalV1 ? error.diagnostic.code : 'TEMPLATE_HELPER_ARGUMENT');
                return ctx.null;
            }
        });
        owned.push(getvar);
        const getFrame = (handle) => {
            if (!handle || ctx.typeof(handle) !== 'number') {
                fault('TEMPLATE_FRAME_INVALID');
                return null;
            }
            const id = ctx.getNumber(handle), frame = frames.get(id);
            if (!Number.isSafeInteger(id) || !frame || frame.closed) {
                fault('TEMPLATE_FRAME_INVALID');
                return null;
            }
            return frame;
        };
        const open = ctx.newFunction('open-owned-template-frame', (...args) => {
            const denied = () => ctx.newString('{"refused":true}');
            if (!before())
                return denied();
            if (args.length !== 3 || ctx.typeof(args[2]) !== 'boolean') {
                fault('TEMPLATE_HELPER_ARITY');
                return denied();
            }
            const missing = ctx.dump(args[2]) === true;
            const query = missing && ctx.typeof(args[1]) === 'string' ? ctx.getString(args[1]) : null;
            const parent = getFrame(args[0]), key = missing && query !== null
                ? `missing-query-${schemaTextSha256(query)}` : stringArg(args[1]);
            if (!parent || key === null)
                return denied();
            if (query !== null && Buffer.byteLength(query, 'utf8') > TEMPLATE_LIMITS_V1.helperArgumentBytes) {
                limit('helperArgumentBytes', Buffer.byteLength(query, 'utf8'));
                return denied();
            }
            const row = templateReadV1(activeRequest.snapshot, 'lore', key, null, 'read');
            if (!addRead(row))
                return denied();
            const binding = templateLoreBindingV1(activeRequest.snapshot, key);
            if (!binding)
                return ctx.newString('{"missing":true}');
            if (binding.readDiagnostic) {
                fault(binding.readDiagnostic.code);
                return denied();
            }
            try {
                let ancestor = parent;
                while (ancestor) {
                    if (ancestor.entryId === binding.entryId) {
                        fault('TEMPLATE_NESTED_CYCLE');
                        return denied();
                    }
                    ancestor = ancestor.parentInvocation === null ? undefined : frames.get(ancestor.parentInvocation);
                }
                if (parent.depth + 1 > TEMPLATE_LIMITS_V1.nestedDepth) {
                    limit('nestedDepth', parent.depth + 1);
                    return denied();
                }
                if (templateEvaluations >= TEMPLATE_LIMITS_V1.templateEvaluations) {
                    limit('templateEvaluations', templateEvaluations + 1);
                    return denied();
                }
                if (binding.content.length > TEMPLATE_LIMITS_V1.sourceChars) {
                    limit('sourceChars', binding.content.length);
                    return denied();
                }
                sourceBytes += Buffer.byteLength(binding.content, 'utf8');
                if (sourceBytes > TEMPLATE_LIMITS_V1.cumulativeSourceBytes) {
                    limit('cumulativeSourceBytes', sourceBytes);
                    return denied();
                }
                const nested = compileTemplateFunctionV1(binding.content, binding.sourcePointer);
                compiledBytes += Buffer.byteLength(nested.factorySource, 'utf8');
                if (compiledBytes > TEMPLATE_LIMITS_V1.cumulativeCompiledBytes) {
                    limit('cumulativeCompiledBytes', compiledBytes);
                    return denied();
                }
                const invocation = frames.size;
                templateEvaluations++;
                frames.set(invocation, { invocation, parentInvocation: parent.invocation, depth: parent.depth + 1,
                    entryId: binding.entryId, sourcePointer: binding.sourcePointer, contentSha256: binding.contentSha256,
                    compiledSourceSha256: schemaTextSha256(nested.factorySource), parts: [], chars: 0, bytes: 0,
                    closed: false, renderedTextSha256: null });
                return ctx.newString(JSON.stringify({ invocation, factorySource: nested.factorySource }));
            }
            catch (error) {
                if (error instanceof TemplateRefusalV1)
                    callbackFault ??= error.diagnostic;
                else
                    fault('TEMPLATE_BRIDGE_VALUE_FAILED');
                return denied();
            }
        });
        owned.push(open);
        const activate = ctx.newFunction('activateWI', (...args) => {
            if (!before())
                return ctx.false;
            if (args.length !== 1) {
                fault('TEMPLATE_HELPER_ARITY');
                return ctx.false;
            }
            const key = stringArg(args[0]);
            if (key === null)
                return ctx.false;
            const row = templateReadV1(activeRequest.snapshot, 'lore', key, null, 'activation-proposal');
            if (!addRead(row))
                return ctx.false;
            const proposal = templateActivationV1(activeRequest.snapshot, key);
            if (!proposal) {
                fault('TEMPLATE_ACTIVATION_NOT_ALLOWED');
                return ctx.false;
            }
            if (!activationKeys.has(proposal.entryId)) {
                if (totalActivations >= TEMPLATE_LIMITS_V1.activationProposals) {
                    limit('activationProposals', totalActivations + 1);
                    return ctx.false;
                }
                totalActivations++;
                activationKeys.add(proposal.entryId);
                activations.push(proposal);
            }
            return ctx.true;
        });
        owned.push(activate);
        const queryFault = ctx.newFunction('refuse-owned-lore-query', (...args) => {
            if (!before())
                return ctx.undefined;
            const code = args.length === 1 ? stringArg(args[0]) : null;
            fault(code && ['TEMPLATE_HELPER_ARITY', 'TEMPLATE_LORE_QUERY_INVALID', 'TEMPLATE_ACTIVATION_NOT_ALLOWED',
                'TEMPLATE_INJECTION_ARGUMENT', 'TEMPLATE_INJECTION_RESTORE_LIMIT', 'TEMPLATE_INJECTION_HANDLE_MISSING',
                'TEMPLATE_INJECTION_FILTER_BOOLEAN'].includes(code)
                ? code : 'TEMPLATE_LORE_QUERY_INVALID');
            return ctx.undefined;
        });
        owned.push(queryFault);
        const emit = ctx.newFunction('record-owned-injection-effect', (...args) => {
            if (!before())
                return ctx.undefined;
            try {
                if (args.length !== 1 || ctx.typeof(args[0]) !== 'string')
                    templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
                const wire = ctx.getString(args[0]);
                if (Buffer.byteLength(wire, 'utf8') > TEMPLATE_LIMITS_V1.helperArgumentBytes) {
                    limit('helperArgumentBytes', Buffer.byteLength(wire, 'utf8'));
                    return ctx.undefined;
                }
                const row = validateTemplateInjectionEffectsV1(JSON.parse(`[${wire}]`))[0];
                if (row.ordinal !== nextEffectOrdinal)
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                if (row.kind === 'batch-created') {
                    if (row.batchOrdinal !== nextBatchOrdinal)
                        templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                    nextBatchOrdinal++;
                }
                else if (row.kind === 'register') {
                    if (row.prompt.batchOrdinal >= nextBatchOrdinal)
                        templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                    if (row.prompt.callbackOrdinal !== null) {
                        if (row.prompt.callbackOrdinal !== nextCallbackOrdinal)
                            templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                        nextCallbackOrdinal++;
                    }
                }
                else if (row.batchOrdinal !== null && row.batchOrdinal >= nextBatchOrdinal)
                    templateFail('TEMPLATE_INJECTION_EFFECT_ORDER');
                nextEffectOrdinal++;
                effects.push(row);
            }
            catch (error) {
                fault(error instanceof TemplateRefusalV1 ? error.diagnostic.code : 'TEMPLATE_INJECTION_EFFECT_INVALID');
            }
            return ctx.undefined;
        });
        owned.push(emit);
        const unsupported = ctx.newFunction('unsupported-template-helper', () => {
            if (before())
                fault('TEMPLATE_HELPER_UNSUPPORTED');
            return ctx.undefined;
        });
        owned.push(unsupported);
        const append = ctx.newFunction('append-owned-template-text', (...args) => {
            if (!before())
                return ctx.undefined;
            if (args.length !== 2 || ctx.typeof(args[1]) !== 'string') {
                fault('TEMPLATE_APPEND_INVALID');
                return ctx.undefined;
            }
            const frame = getFrame(args[0]);
            if (!frame)
                return ctx.undefined;
            const value = ctx.getString(args[1]), observed = frame.chars + value.length;
            if (observed > TEMPLATE_LIMITS_V1.outputChars) {
                fault('TEMPLATE_OUTPUT_LIMIT', { field: 'outputChars', observed, maximum: TEMPLATE_LIMITS_V1.outputChars });
                return ctx.undefined;
            }
            const bytes = Buffer.byteLength(value, 'utf8');
            if (outputBytes + bytes > TEMPLATE_LIMITS_V1.cumulativeOutputBytes) {
                limit('cumulativeOutputBytes', outputBytes + bytes);
                return ctx.undefined;
            }
            outputBytes += bytes;
            frame.bytes += bytes;
            frame.chars = observed;
            frame.parts.push(value);
            return ctx.undefined;
        });
        owned.push(append);
        const close = ctx.newFunction('close-owned-template-frame', (...args) => {
            if (!before())
                return ctx.newString('');
            if (args.length !== 1) {
                fault('TEMPLATE_FRAME_INVALID');
                return ctx.newString('');
            }
            const frame = getFrame(args[0]);
            if (!frame)
                return ctx.newString('');
            for (const child of frames.values())
                if (child.parentInvocation === frame.invocation && !child.closed) {
                    fault('TEMPLATE_NESTED_NOT_AWAITED');
                    return ctx.newString('');
                }
            const text = frame.parts.join('');
            if (text.includes('<%') || text.includes('{{')) {
                fault('TEMPLATE_OUTPUT_UNRESOLVED');
                return ctx.newString('');
            }
            frame.closed = true;
            frame.renderedTextSha256 = schemaTextSha256(text);
            return ctx.newString(text);
        });
        owned.push(close);
        const guard = ctx.newFunction('guard-owned-template-interpolation', (...args) => {
            if (!before())
                return ctx.undefined;
            if (args.length !== 1) {
                fault('TEMPLATE_APPEND_INVALID');
                return ctx.undefined;
            }
            const state = ctx.getPromiseState(args[0]);
            if (state.type === 'pending')
                fault('TEMPLATE_ASYNC_VALUE_NOT_AWAITED');
            else if (state.type === 'rejected') {
                state.error.dispose();
                fault('TEMPLATE_ASYNC_VALUE_NOT_AWAITED');
            }
            else if (!state.notAPromise) {
                state.value.dispose();
                fault('TEMPLATE_ASYNC_VALUE_NOT_AWAITED');
            }
            return ctx.undefined;
        });
        owned.push(guard);
        const random = ctx.newFunction('owned-template-random', () => {
            if (callbackFault)
                return ctx.newNumber(0);
            if (performance.now() >= deadline) {
                timedOut = true;
                return ctx.newNumber(0);
            }
            if (++randomCalls > TEMPLATE_LIMITS_V1.randomCalls) {
                limit('randomCalls', randomCalls);
                return ctx.newNumber(0);
            }
            const digest = recordSha256({ encoding: 'owned-template-random-v1', seed: activeRequest.snapshot.randomSeed,
                requestSha256: activeRequest.requestSha256, ordinal: ++randomOrdinal, ...randomDomain ? { invocationDomain: randomDomain } : {} });
            return ctx.newNumber((Number.parseInt(digest.slice(0, 13), 16) + 0.5) / 4503599627370496);
        });
        owned.push(random);
        const determinism = checked(ctx.evalCode(DETERMINISM, 'owned-template-clock.js'));
        owned.push(determinism);
        const clock = ctx.newFunction('owned-template-clock', () => {
            if (!before())
                return ctx.newNumber(0);
            return ctx.newNumber(activeRequest.snapshot.clockEpochMs);
        });
        owned.push(clock);
        const string = checked(ctx.callFunction(determinism, ctx.undefined, clock, random));
        owned.push(string);
        const bridge = checked(ctx.evalCode(ASYNC_BRIDGE, 'owned-template-async-bridge.js'));
        owned.push(bridge);
        const catalog = ctx.newString(JSON.stringify(activeRequest.snapshot.lore.map(row => ({ key: row.key, lookup: row.lookup ?? null }))));
        owned.push(catalog);
        const dispatcher = checked(ctx.callFunction(bridge, ctx.undefined, getvar, activate, unsupported, open, close, append, guard, string, catalog, queryFault, emit));
        owned.push(dispatcher);
        const run = ctx.getProp(dispatcher, 'run'), invoke = ctx.getProp(dispatcher, 'invoke');
        owned.push(run, invoke);
        const pump = (result) => {
            let resolved;
            for (;;) {
                if (callbackFault)
                    break;
                if (performance.now() >= deadline) {
                    timedOut = true;
                    break;
                }
                const state = ctx.getPromiseState(result);
                let fulfilled = false;
                if (state.type === 'rejected') {
                    state.error.dispose();
                    fault('TEMPLATE_GUEST_ERROR');
                    break;
                }
                if (state.type === 'fulfilled') {
                    if (state.notAPromise) {
                        fault('TEMPLATE_ASYNC_PROTOCOL');
                        break;
                    }
                    if (!resolved)
                        resolved = state.value;
                    else
                        state.value.dispose();
                    fulfilled = true;
                }
                if (!runtime.hasPendingJob()) {
                    if (!fulfilled)
                        fault('TEMPLATE_ASYNC_UNSETTLED');
                    break;
                }
                if (++jobs > TEMPLATE_LIMITS_V1.promiseJobs) {
                    limit('promiseJobs', jobs);
                    break;
                }
                const job = runtime.executePendingJobs(1);
                if (job.error) {
                    job.dispose();
                    fault('TEMPLATE_ASYNC_JOB_ERROR');
                    break;
                }
                job.dispose();
            }
            if (timedOut || performance.now() >= deadline) {
                resolved?.dispose();
                templateFail('TEMPLATE_VM_TIMEOUT', pointer, { field: 'vmDeadlineMs', observed: TEMPLATE_LIMITS_V1.vmDeadlineMs,
                    maximum: TEMPLATE_LIMITS_V1.vmDeadlineMs });
            }
            if (callbackFault) {
                resolved?.dispose();
                throw new TemplateRefusalV1(callbackFault);
            }
            if (!resolved)
                templateFail('TEMPLATE_ASYNC_UNSETTLED', pointer);
            return resolved;
        };
        const source = ctx.newString(compiled.factorySource);
        owned.push(source);
        const result = checked(ctx.callFunction(run, ctx.undefined, source));
        owned.push(result);
        pump(result).dispose();
        const output = () => {
            if (!callbackFault)
                for (const frame of frames.values())
                    if (!frame.closed) {
                        fault('TEMPLATE_ASYNC_UNSETTLED');
                        break;
                    }
            if (callbackFault)
                throw new TemplateRefusalV1(callbackFault);
            const renderedText = frames.get(0).parts.join('');
            if (renderedText.includes('<%') || renderedText.includes('{{'))
                templateFail('TEMPLATE_OUTPUT_UNRESOLVED', pointer);
            const nestedRenders = [];
            for (const frame of frames.values())
                if (frame.invocation !== 0)
                    nestedRenders.push({
                        invocation: frame.invocation, parentInvocation: frame.parentInvocation, entryId: frame.entryId,
                        sourcePointer: frame.sourcePointer, contentSha256: frame.contentSha256,
                        compiledSourceSha256: frame.compiledSourceSha256, renderedTextSha256: frame.renderedTextSha256,
                        outputChars: frame.chars, outputBytes: frame.bytes
                    });
            const body = { schemaVersion: 1, encoding: 'owned-template-output-v1',
                authority: 'consumer-data-only', requestSha256: activeRequest.requestSha256, sourceSha256: request.source.templateSha256,
                sourcePointer: pointer, snapshotSha256: activeRequest.snapshot.snapshotSha256, engine: admitted.engine,
                renderedText, renderedTextSha256: schemaTextSha256(renderedText), readDependencies: reads,
                activationProposals: activations, nestedRenders, ...effects.length ? { injectionEffects: [...effects] } : {} };
            const wire = { ...body, outputSha256: recordSha256(body) };
            // This is host-owned plain data. Charge the whole result before cloning
            // so log/metadata amplification receives the same explicit char limit.
            const outputChars = JSON.stringify(wire).length;
            if (outputChars > TEMPLATE_LIMITS_V1.outputChars)
                templateFail('TEMPLATE_OUTPUT_LIMIT', pointer, { field: 'outputChars', observed: outputChars, maximum: TEMPLATE_LIMITS_V1.outputChars });
            return validateTemplateOutputV1(wire, activeRequest, admitted.engine);
        };
        const creationOutput = output();
        if (!restoration)
            outcome = { kind: 'rendered', output: creationOutput };
        else {
            let head = injectionCreationHeadV1(programInstanceId, request, creationOutput);
            let inputBytes = Buffer.byteLength(JSON.stringify(message), 'utf8');
            const nextPhase = (sequence) => new Promise((resolve, reject) => {
                parentPort.once('message', (rawPhase) => {
                    try {
                        const packet = cloneTemplateEnvelopeV1(rawPhase, { bytes: 'workerInputBytes', nodes: 'workerInputNodes', depth: 'workerInputDepth' });
                        templateExact(packet, ['kind', 'sequence', 'phase']);
                        if (packet.kind !== 'phase' || packet.sequence !== sequence)
                            templateFail('TEMPLATE_INJECTION_PROTOCOL');
                        inputBytes += Buffer.byteLength(JSON.stringify(packet), 'utf8');
                        if (inputBytes > TEMPLATE_LIMITS_V1.injectionInputBytes)
                            templateFail('TEMPLATE_INJECTION_RESTORE_LIMIT', pointer, { field: 'injectionInputBytes', observed: inputBytes, maximum: TEMPLATE_LIMITS_V1.injectionInputBytes });
                        if (performance.now() >= deadline)
                            templateFail('TEMPLATE_VM_TIMEOUT', pointer);
                        resolve(validateInjectionPhaseV1(packet.phase));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            let waiting = nextPhase(1);
            parentPort.postMessage({ kind: 'phase-result', sequence: 0, output: creationOutput });
            for (let sequence = 1; sequence <= phaseCount; sequence++) {
                const phase = await waiting;
                if (phase.snapshot.sessionId !== request.snapshot.sessionId || phase.snapshot.branchId !== request.snapshot.branchId
                    || phase.snapshot.packageSha256 !== request.snapshot.packageSha256)
                    templateFail('TEMPLATE_INJECTION_READ_BASIS_MISMATCH', pointer);
                activeRequest = injectionPhaseRequestV1(request, phase);
                const invocations = [];
                for (const action of phase.schedule) {
                    if (++templateEvaluations > TEMPLATE_LIMITS_V1.templateEvaluations)
                        templateFail('TEMPLATE_INJECTION_RESTORE_LIMIT', pointer, { field: 'templateEvaluations', observed: templateEvaluations, maximum: TEMPLATE_LIMITS_V1.templateEvaluations });
                    // Fresh root, no reopening of a creation/nested closed frame. The
                    // guest private token redirects captured getwi to this execution.
                    const activeRootBinding = phase.snapshot.lore.find(row => row.sourcePointer === pointer
                        && row.contentSha256 === request.source.templateSha256);
                    frames.clear();
                    frames.set(0, { invocation: 0, parentInvocation: null, depth: 0, entryId: activeRootBinding?.entryId ?? null, sourcePointer: pointer,
                        contentSha256: request.source.templateSha256, compiledSourceSha256: schemaTextSha256(compiled.factorySource),
                        parts: [], chars: 0, bytes: 0, closed: false, renderedTextSha256: null });
                    reads.length = 0;
                    activations.length = 0;
                    effects.length = 0;
                    readKeys.clear();
                    activationKeys.clear();
                    randomOrdinal = 0;
                    randomDomain = recordSha256({ phaseSha256: phase.phaseSha256, action });
                    const actionHandle = ctx.newString(JSON.stringify(action));
                    const catalogHandle = ctx.newString(JSON.stringify(phase.snapshot.lore.map(row => ({ key: row.key, lookup: row.lookup ?? null }))));
                    let invocationResult, settledResult;
                    try {
                        invocationResult = checked(ctx.callFunction(invoke, ctx.undefined, actionHandle, catalogHandle));
                        settledResult = pump(invocationResult);
                        const actual = JSON.parse(ctx.getString(settledResult));
                        templateExact(actual, ['accepted', 'nextBatchOrdinal', 'nextCallbackOrdinal', 'nextEffectOrdinal']);
                        if (actual.nextBatchOrdinal !== nextBatchOrdinal || actual.nextCallbackOrdinal !== nextCallbackOrdinal
                            || actual.nextEffectOrdinal !== nextEffectOrdinal
                            || (action.kind === 'filter' ? typeof actual.accepted !== 'boolean' : actual.accepted !== null))
                            templateFail('TEMPLATE_INJECTION_PROTOCOL', pointer);
                        invocations.push({ action, accepted: actual.accepted, output: output() });
                    }
                    finally {
                        settledResult?.dispose();
                        invocationResult?.dispose();
                        catalogHandle.dispose();
                        actionHandle.dispose();
                    }
                }
                const body = { schemaVersion: 1,
                    encoding: 'owned-template-injection-receipt-v1', authority: 'consumer-data-only', programInstanceId,
                    phaseSha256: phase.phaseSha256, previousHeadSha256: head, engine: admitted.engine, invocations,
                    nextBatchOrdinal, nextCallbackOrdinal, nextEffectOrdinal };
                const receipt = validateInjectionReceiptV1({ ...body, receiptSha256: recordSha256(body) }, programInstanceId, head, phase, request, admitted.engine);
                head = receipt.receiptSha256;
                if (sequence === phaseCount)
                    outcome = { kind: 'injection-evaluated', receipt };
                else {
                    waiting = nextPhase(sequence + 1);
                    parentPort.postMessage({ kind: 'phase-result', sequence, receipt });
                }
            }
        }
    }
    catch (error) {
        if (timedOut || performance.now() >= deadline)
            outcome = unavailable('TEMPLATE_VM_TIMEOUT', pointer);
        else if (callbackFault)
            outcome = { kind: 'refused', diagnostic: callbackFault };
        else if (error instanceof TemplateRefusalV1)
            outcome = { kind: 'refused', diagnostic: error.diagnostic };
        else
            outcome = unavailable('TEMPLATE_GUEST_ERROR', pointer);
    }
    finally {
        // Clean every owned handle and VM even after one disposer fails. Failed
        // cleanup cannot publish a prior result. The parent additionally terminates.
        let cleanupFailed = false;
        for (const handle of owned.reverse())
            try {
                handle.dispose();
            }
            catch {
                cleanupFailed = true;
            }
        try {
            context?.dispose();
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
            outcome = unavailable('TEMPLATE_VM_CLEANUP', pointer);
    }
    return outcome;
}
if (parentPort) {
    evaluateOwnedTemplateWorkerV1(workerData).then(result => parentPort.postMessage(result), error => {
        parentPort.postMessage(error instanceof TemplateRefusalV1 ? { kind: 'refused', diagnostic: error.diagnostic }
            : unavailable('TEMPLATE_WORKER_UNAVAILABLE'));
    });
}
