// Generated from runtime/alpha3/src/core/tavern-template-ejs-host.mts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import lodash from 'nexttavern-mvu-lodash';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { createTavernEjsSourceCompiler, TavernEjsCompileError } from './tavern-template-ejs-compiler.mjs';
import { TAVERN_EJS_HOST_GUEST } from './tavern-template-ejs-host-guest.mjs';
import { TEMPLATE_LIMITS_V1, validateTemplateSnapshotV1, templateVariableValueV1, templateReadV1, templateActivationV1, TemplateRefusalV1, validateTemplateInjectionEffectsV1 } from './tavern-template-data.mjs';
import { templateVariablePathV1 } from './tavern-template-data.mjs';
import { createTavernPromptMacroProjectorV1 } from './tavern-prompt-transform-execution.mjs';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as macroLimits } from './tavern-prompt-transform-types.mjs';
import { EJS_READER_RENDER_POLICY_V1, EJS_READER_RENDER_POLICY_SHA256, EJS_READER_REGEX_PHASE_POLICY_V1, EJS_READER_REGEX_PHASE_POLICY_SHA256 } from './tavern-template-ejs-runtime-types.mjs';
/** The admitted component supplies its fixed compiler/module, not request data.
 * A host is one captured preparation and its actual injection closure lifetime.
 * No filesystem resolution, persistent state writes or provider publication. */
export function createTavernEjsHost(deps, capture, consumer) {
    if (consumer !== undefined && consumer !== 'reader-render-v1' && consumer !== 'reader-regex-phase-v1') {
        throw Error('TEMPLATE_CONSUMER_UNSUPPORTED');
    }
    const reader = consumer !== undefined, policy = consumer === 'reader-regex-phase-v1'
        ? EJS_READER_REGEX_PHASE_POLICY_V1 : EJS_READER_RENDER_POLICY_V1;
    let effectConsumer = consumer;
    const consumerPolicy = () => effectConsumer === 'reader-regex-phase-v1'
        ? { id: EJS_READER_REGEX_PHASE_POLICY_V1.id, sha256: EJS_READER_REGEX_PHASE_POLICY_SHA256 }
        : effectConsumer === 'reader-render-v1' ? { id: EJS_READER_RENDER_POLICY_V1.id, sha256: EJS_READER_RENDER_POLICY_SHA256 } : undefined;
    const limits = reader ? { ...TEMPLATE_LIMITS_V1,
        cumulativeSourceBytes: policy.cumulativeSourceBytes, cumulativeCompiledBytes: policy.cumulativeCompiledBytes,
        cumulativeOutputBytes: policy.htmlBytes, outputBytes: policy.packetBytes } : TEMPLATE_LIMITS_V1;
    let snapshot = validateTemplateSnapshotV1(capture.snapshot);
    const sourceBasis = { sessionId: snapshot.sessionId, branchId: snapshot.branchId,
        packageSha256: snapshot.packageSha256 };
    const compile = createTavernEjsSourceCompiler(deps.compiler);
    let resources = new Map(capture.resources.map(row => [row.id, { ...row }]));
    let lore = new Map(snapshot.lore.map(row => [row.key, row]));
    let ordinary = capture.ordinaryNamespace ? structuredClone(capture.ordinaryNamespace) : undefined;
    let messageView = capture.ordinaryMessageView ? structuredClone(capture.ordinaryMessageView) : undefined;
    let presetCatalog = capture.presetCatalog;
    const presetHashes = new Map();
    const namedCapture = (queues) => queues === undefined ? undefined :
        new Map(queues.map(queue => [queue.key, new Map(queue.entries.map(entry => [entry.uid, { ...entry }]))]));
    let namedQueues = namedCapture(capture.namedPromptQueues);
    const requireNamed = () => {
        if (!namedQueues)
            throw Error('TEMPLATE_NAMED_QUEUE_CAPTURE_REQUIRED');
        return namedQueues;
    };
    let macros = capture.macros, macroProjector;
    let macroPointer = '', macroJobs = 0, macroWorkChars = 0, macroMatches = 0;
    const overlay = new Map();
    const deleted = Symbol('ordinary-deleted'), cacheOverlay = new Map(), messageOverlay = new Map();
    let cacheRebuilt = false;
    const targetKey = (target) => JSON.stringify(target.identity);
    let messageCaptures = new Map();
    const indexMessages = () => {
        messageCaptures = new Map((messageView?.captures ?? []).flatMap(row => row.root.namespace.target ? [[targetKey(row.root.namespace.target), row]] : []));
    };
    indexMessages();
    const messageAt = (index, swipe) => {
        const row = messageView?.messages[index], targets = row?.ordinary?.variants ?? [], selected = row?.ordinary?.selectedTarget, selectedIndex = selected ? targets.findIndex(target => targetKey(target) === targetKey(selected)) : 0, page = swipe === undefined ? Math.max(0, selectedIndex) : swipe < 0 ? targets.length + swipe : swipe, target = targets[page], captured = target ? messageCaptures.get(targetKey(target)) : undefined, base = page === selectedIndex && row?.variables.kind === 'available' ? row.variables.variables : row?.variantVariables?.[page] ?? undefined, changes = target ? messageOverlay.get(targetKey(target)) : undefined, exists = captured?.exists === true || changes !== undefined || row?.variantVariables?.[page] != null
            || page === selectedIndex && row?.variables.kind === 'available' && row.variables.provenance.kind !== 'initialized-empty';
        const literal = (key) => {
            if (key === 'stat_data')
                return base && Object.hasOwn(base, key) ? { present: true, value: base[key] } : { present: false, value: null };
            if (changes?.has(key)) {
                const value = changes.get(key);
                return value === deleted ? { present: false, value: null } : { present: true, value };
            }
            if (captured && Object.hasOwn(captured.values, key))
                return { present: true, value: captured.values[key] };
            if (captured?.deletedKeys?.includes(key))
                return { present: false, value: null };
            return base && Object.hasOwn(base, key) ? { present: true, value: base[key] } : { present: false, value: null };
        };
        return { row, target, captured, exists, literal, get values() {
                const values = { ...base, ...captured?.values };
                for (const key of captured?.deletedKeys ?? [])
                    delete values[key];
                for (const [key, value] of changes ?? []) {
                    if (value === deleted)
                        delete values[key];
                    else
                        values[key] = value;
                }
                if (base && Object.hasOwn(base, 'stat_data'))
                    values.stat_data = base.stat_data;
                else
                    delete values.stat_data;
                return values;
            } };
    };
    const selectMessage = (selector, getter) => {
        if (!messageView)
            throw Error('TEMPLATE_MESSAGE_SELECTOR_UNAVAILABLE');
        const rows = messageView.messages, current = messageView.current;
        let index;
        if (selector?.id !== undefined)
            index = selector.id < 0 ? rows.length + selector.id : selector.id;
        else if (selector?.role !== undefined)
            index = rows.findLastIndex((row, position) => (selector.role === 'any' || row.role === selector.role) && (!getter || messageAt(position).exists));
        else if (getter) {
            const last = current === null ? rows.length - 1 : current.message_id;
            index = rows.slice(0, last + 1).findLastIndex((_row, position) => messageAt(position).exists);
        }
        else
            index = current?.message_id ?? -1;
        return messageAt(index, selector?.swipe_id ?? current?.swipe_id);
    };
    const assignOverlay = (values, changes) => {
        for (const [key, value] of changes) {
            if (value === deleted)
                delete values[key];
            else
                values[key] = value;
        }
        return values;
    };
    const rebuildCache = () => {
        const values = {};
        if (cacheRebuilt && messageView?.current) {
            for (const scope of ['global', 'initial', 'chat'])
                Object.assign(values, snapshot.scopes.find(row => row.scope === scope)?.values);
            Object.assign(values, ordinary?.values);
            assignOverlay(values, overlay);
            Object.assign(values, messageAt(messageView.current.message_id, messageView.current.swipe_id).values);
        }
        else {
            Object.assign(values, snapshot.scopes.find(row => row.scope === 'cache')?.values, ordinary?.values);
            assignOverlay(values, overlay);
        }
        return values;
    };
    const compiled = new Map();
    const runtime = deps.quickjs.newRuntime();
    runtime.setMemoryLimit(limits.vmMemoryBytes);
    runtime.setMaxStackSize(limits.vmStackBytes);
    let deadline = 0, disposed = false, fault, pointer = '';
    let calls = 0, sourceBytes = 0, compiledBytes = 0, evaluations = 0, jobs = 0;
    runtime.setInterruptHandler(() => performance.now() >= deadline);
    runtime.setModuleLoader(() => { throw Error('TEMPLATE_IMPORT_UNSUPPORTED'); });
    const context = runtime.newContext(), owned = [];
    const reads = [], readKeys = new Set();
    const dependencyRows = new Map();
    const resourceReads = new Map();
    const activations = [], activationKeys = new Set();
    const effects = [];
    const regexEffects = [];
    const ordinaryReads = new Set();
    const messageReads = new Map();
    let messageReadCount = 0;
    const dependencyCount = () => ordinaryReads.size + reads.length + messageReadCount;
    const noteMessageRead = (target, key) => {
        const identity = targetKey(target), row = messageReads.get(identity) ?? { messageTarget: target, keys: new Set(), readAll: false };
        if (row.readAll || key !== null && row.keys.has(key))
            return;
        if (dependencyCount() >= limits.readDependencies)
            throw Error('TEMPLATE_READ_LIMIT');
        messageReadCount++;
        if (key === null)
            row.readAll = true;
        else
            row.keys.add(key);
        messageReads.set(identity, row);
    };
    const messageReadOutput = () => messageReads.size ? { ordinaryMessageReads: [...messageReads.values()].map(row => ({
            messageTarget: row.messageTarget, keys: [...row.keys], readAll: row.readAll
        })) } : {};
    let ordinaryReadAll = false;
    const ordinaryWrites = [];
    let proposalBytes = 0;
    const noteOrdinary = (key) => {
        if (!ordinary || ordinaryReads.has(key))
            return;
        if (dependencyCount() >= limits.readDependencies)
            throw Error('TEMPLATE_READ_LIMIT');
        ordinaryReads.add(key);
    };
    const ordinaryHas = (key) => overlay.has(key) || ordinary !== undefined && Object.hasOwn(ordinary.values, key);
    const ordinaryValue = (key) => overlay.has(key) ? overlay.get(key) : ordinary.values[key];
    const charge = (wire) => {
        proposalBytes += Buffer.byteLength(wire, 'utf8');
        if (proposalBytes > limits.cumulativeOutputBytes)
            throw Error('TEMPLATE_OUTPUT_LIMIT');
    };
    const recordFault = (code, sourcePointer = pointer, line) => {
        fault ??= { code, sourcePointer, ...line === undefined ? {} : { line } };
    };
    const refuseEffect = (helper) => {
        if (!effectConsumer || effectConsumer === 'reader-regex-phase-v1' && helper === 'activateRegex')
            return;
        fault ??= { code: 'READER_TEMPLATE_EFFECT_UNSUPPORTED', sourcePointer: pointer, helper };
        throw Error('READER_TEMPLATE_EFFECT_UNSUPPORTED');
    };
    const fromError = (error) => {
        if (error instanceof TavernEjsCompileError)
            recordFault(error.code, error.sourcePointer);
        else if (error instanceof TemplateRefusalV1)
            recordFault(error.diagnostic.code, error.diagnostic.sourcePointer ?? pointer);
        else
            recordFault(error instanceof Error && /^TEMPLATE_[A-Z_]+$/.test(error.message)
                ? error.message : 'TEMPLATE_EJS_HOST_ERROR');
    };
    const checked = (result) => {
        if (result.error) {
            result.error.dispose();
            throw Error('TEMPLATE_EJS_GUEST_ERROR');
        }
        return result.value;
    };
    const before = () => {
        if (fault)
            return false;
        if (performance.now() >= deadline) {
            recordFault('TEMPLATE_VM_TIMEOUT');
            return false;
        }
        if (++calls > limits.helperCalls) {
            recordFault('TEMPLATE_HELPER_LIMIT');
            return false;
        }
        return true;
    };
    const retainRead = (read) => {
        const identity = JSON.stringify(['fact', read.kind, read.purpose, read.scope, read.ownerId, read.key, read.present,
            read.versionSha256, read.valueSha256, read.entryId, read.sourcePointer]);
        if (readKeys.has(identity))
            return;
        if (dependencyCount() >= limits.readDependencies)
            throw Error('TEMPLATE_READ_LIMIT');
        reads.push(read);
        readKeys.add(identity);
    };
    const noteRead = (kind, key, scope, purpose) => {
        const identity = JSON.stringify([kind, scope, key, purpose]);
        if (readKeys.has(identity))
            return;
        if (kind === 'variable' && key !== null && readKeys.has(JSON.stringify([kind, scope, null, purpose])))
            return;
        let row = dependencyRows.get(identity);
        if (!row) {
            const binding = kind === 'variable' && key === null ? snapshot.scopes.find(item => item.scope === scope) : undefined;
            // This host's snapshot is already validated. A whole-binding read uses
            // its exact certified hash; no second serialization of the entire map.
            row = binding ? { kind, purpose, scope: binding.scope, ownerId: binding.ownerId, key, present: true,
                versionSha256: binding.versionSha256, valueSha256: binding.valuesSha256, entryId: null, sourcePointer: null }
                : templateReadV1(snapshot, kind, key, scope, purpose);
            dependencyRows.set(identity, row);
        }
        retainRead(row);
        readKeys.add(identity);
    };
    const macroFault = (code, token = null, limit = null) => {
        fault ??= { code, sourcePointer: macroPointer, macro: token, limit };
        throw Error('TEMPLATE_EJS_MACRO_REFUSED');
    };
    const macroLimit = (field, observed) => {
        if (observed > macroLimits[field])
            macroFault('PROMPT_TRANSFORM_LIMIT', null, { field, observed, maximum: macroLimits[field] });
    };
    const projectLoreMacros = (row) => {
        macroPointer = row.sourcePointer;
        macroProjector ??= createTavernPromptMacroProjectorV1(macros, {
            issue: macroFault, recordRead: retainRead, budget: {
                job: () => macroLimit('jobs', ++macroJobs),
                work: chars => { macroWorkChars += chars; macroLimit('workChars', macroWorkChars); },
                output: chars => macroLimit('outputChars', chars), match: () => macroLimit('matches', ++macroMatches)
            },
            variable: (scope, key) => {
                if (scope !== 'chat' || !ordinary)
                    return undefined;
                noteOrdinary(key);
                if (!ordinaryHas(key))
                    return undefined;
                const value = ordinaryValue(key);
                if (value === deleted)
                    return { value: '' };
                return { value: value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value) };
            }
        });
        return macroProjector.project(row.text);
    };
    const compileResource = (row, projectMacros = false, ownedContentSha256) => {
        if (row.sourceSnapshotSha256 !== snapshot.sourceSnapshotSha256)
            throw Error('TEMPLATE_SOURCE_CHANGED');
        if (++evaluations > limits.templateEvaluations)
            throw Error('TEMPLATE_EVALUATION_LIMIT');
        const text = projectMacros ? projectLoreMacros(row) : row.text;
        if (!reader && text.length > limits.sourceChars)
            throw Error('TEMPLATE_SOURCE_LIMIT');
        let byText = compiled.get(row.sourcePointer);
        if (!byText) {
            byText = new Map();
            compiled.set(row.sourcePointer, byText);
        }
        let item = byText.get(text);
        if (item === undefined) {
            const inputBytes = Buffer.byteLength(text, 'utf8');
            if (reader && inputBytes > policy.sourceBytes)
                throw Error('TEMPLATE_SOURCE_LIMIT');
            const contentSha256 = ownedContentSha256 ?? schemaTextSha256(text);
            if (text === row.text && contentSha256 !== row.contentSha256)
                throw Error('TEMPLATE_RESOURCE_CONTENT_CHANGED');
            const source = compile(text, row.sourcePointer).functionSource;
            item = { source, sourceBytes: inputBytes, compiledBytes: Buffer.byteLength(source, 'utf8'), contentSha256 };
            byText.set(text, item);
        }
        if (text === row.text && item.contentSha256 !== row.contentSha256)
            throw Error('TEMPLATE_RESOURCE_CONTENT_CHANGED');
        sourceBytes += item.sourceBytes;
        if (sourceBytes > limits.cumulativeSourceBytes)
            throw Error('TEMPLATE_SOURCE_LIMIT');
        // Each returned source is evaluated/parses again inside QuickJS, even on a
        // Node compiler-cache hit. Charge actual cumulative execution input, while
        // reusing byte lengths of these identical immutable compiler strings.
        compiledBytes += item.compiledBytes;
        if (compiledBytes > limits.cumulativeCompiledBytes)
            throw Error('TEMPLATE_COMPILED_LIMIT');
        return { sourcePointer: row.sourcePointer, functionSource: item.source, identity: row.sourcePointer };
    };
    const native = (name, callback) => {
        const handle = context.newFunction(name, (...args) => {
            if (!before())
                return context.undefined;
            try {
                return callback(...args);
            }
            catch (error) {
                fromError(error);
                return context.undefined;
            }
        });
        owned.push(handle);
        return handle;
    };
    const readVariable = (key, options) => {
        if (options.noCache) {
            cacheOverlay.clear();
            cacheRebuilt = true;
        }
        const selected = options.scope ?? 'cache';
        // Fixed ST-Prompt-Template's unselected message scope deliberately reads
        // its merged cache. withMsg is the distinct message/swipe selector and
        // cannot be resolved from arbitrary lexical context objects.
        const scope = selected === 'local' ? 'chat' : selected === 'message' ? 'cache' : selected;
        // Every read below already resolves the current captured phase plus this
        // invocation's ordinary overlay. noCache therefore bypasses no owner and
        // never queries live Session/global state outside the supplied capture.
        let actual;
        const binding = snapshot.scopes.find(row => row.scope === scope);
        const literal = key !== null && binding !== undefined && Object.hasOwn(binding.values, key);
        // Complete literal keys precede nested paths across both captured layers.
        // Absent ordinary keys are dependencies too: a future literal can change
        // which layer/path this same helper resolves.
        let parts = [];
        if (key !== null && ordinary && (scope === 'chat' || scope === 'cache') && !(selected === 'message' && options.withMsg !== undefined)) {
            noteOrdinary(key);
            if (ordinaryHas(key))
                parts = [key];
            else if (!literal && !options.literalOnly) {
                parts = templateVariablePathV1(key);
                if (parts[0] !== undefined)
                    noteOrdinary(parts[0]);
            }
        }
        const ordinaryKey = parts[0];
        const readValues = (values, available = true) => {
            if (!available)
                return { present: false, value: null };
            if (key === null)
                return { present: true, value: values };
            const path = Object.hasOwn(values, key) || options.literalOnly ? [key] : templateVariablePathV1(key);
            let value = values;
            for (const part of path) {
                if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
                    return { present: false, value: null };
                value = value[part];
            }
            return { present: true, value };
        };
        if (selected === 'message' && options.withMsg !== undefined) {
            const target = selectMessage(options.withMsg, true);
            if (target.target)
                noteMessageRead(target.target, key);
            if (!target.exists)
                actual = { present: false, value: null };
            else if (key === null)
                actual = { present: true, value: target.values };
            else {
                actual = target.literal(key);
                if (!actual.present && !options.literalOnly) {
                    const path = templateVariablePathV1(key);
                    actual = target.literal(path[0]);
                    for (const part of path.slice(1)) {
                        if (!actual.present || actual.value === null || typeof actual.value !== 'object' || !Object.hasOwn(actual.value, part)) {
                            actual = { present: false, value: null };
                            break;
                        }
                        actual = { present: true, value: actual.value[part] };
                    }
                }
            }
        }
        else if (scope === 'cache' && (cacheRebuilt || cacheOverlay.size)) {
            if (key === null) {
                if (ordinary)
                    ordinaryReadAll = true;
            }
            else if (ordinary && ordinaryHas(key))
                noteOrdinary(key);
            noteRead('variable', key, scope, 'read');
            if (messageView?.current) {
                const current = messageAt(messageView.current.message_id, messageView.current.swipe_id);
                if (current.target)
                    noteMessageRead(current.target, key);
            }
            actual = readValues(assignOverlay(rebuildCache(), cacheOverlay));
        }
        else if (ordinaryKey !== undefined && ordinaryHas(ordinaryKey)) {
            const value = ordinaryValue(ordinaryKey);
            actual = value === deleted ? { present: false, value: null } : { present: true, value };
            for (const part of parts.slice(1)) {
                if (!actual.present || actual.value === null || typeof actual.value !== 'object' || !Object.hasOwn(actual.value, part)) {
                    actual = { present: false, value: null };
                    break;
                }
                actual = { present: true, value: actual.value[part] };
            }
        }
        else if (options.literalOnly && key !== null) {
            if (!binding)
                throw Error('TEMPLATE_SCOPE_UNAVAILABLE');
            actual = literal ? { present: true, value: binding.values[key] } : { present: false, value: null };
            // variables is a property map, not getvar's path API. An absent literal
            // (or a literal outside the old path grammar) depends on the certified
            // binding; that receipt neither materializes its values nor invents a
            // path read whose result differs from this actual property lookup.
            if (literal && !options.presenceOnly) {
                try {
                    noteRead('variable', key, scope, 'read');
                }
                catch (error) {
                    if (!(error instanceof TemplateRefusalV1) || error.diagnostic.code !== 'TEMPLATE_VARIABLE_PATH_INVALID')
                        throw error;
                    noteRead('variable', null, scope, 'read');
                }
            }
            else
                noteRead('variable', null, scope, 'read');
        }
        else {
            noteRead('variable', key, scope, 'read');
            actual = templateVariableValueV1(snapshot, key, scope);
            if (key === null && (scope === 'chat' || scope === 'cache')) {
                const values = Object.assign(Object.create(null), actual.value);
                if (ordinary) {
                    ordinaryReadAll = true;
                    Object.assign(values, ordinary.values);
                }
                assignOverlay(values, overlay);
                actual = { present: true, value: values };
            }
        }
        let present = actual.present, value = actual.present ? actual.value : null;
        if (options.index !== undefined) {
            const parsed = JSON.parse(String(value || '{}'));
            const path = options.indexPath && (selected === 'global' || selected === 'local' || selected === 'chat'
                || selected === 'message' || selected === 'initial');
            const index = options.indexPath && !path ? 'NaN' : options.index;
            if (parsed !== null && typeof parsed === 'object' && Object.hasOwn(parsed, index)) {
                value = parsed[index];
                present = true;
            }
            else if (path) {
                let current = parsed;
                const parts = templateVariablePathV1(index);
                present = parts.length > 0;
                for (const part of parts) {
                    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) {
                        present = false;
                        break;
                    }
                    current = current[part];
                }
                value = present ? current : null;
            }
            else {
                present = false;
                value = null;
            }
        }
        return { present, value };
    };
    const read = native('captured-variable-read', (keyHandle, optionsHandle) => {
        const key = context.typeof(keyHandle) === 'string' ? context.getString(keyHandle) : null, wire = context.getString(optionsHandle);
        if (Buffer.byteLength(wire, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        const options = JSON.parse(wire), result = readVariable(key, options);
        return context.newString(JSON.stringify(options.presenceOnly ? { present: result.present } : result));
    });
    const open = native('captured-template-resource', (kindHandle, keyHandle) => {
        const kind = context.getString(kindHandle), key = context.getString(keyHandle);
        if (Buffer.byteLength(key, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        let row, projectMacros = kind === 'lore', ownedContentSha256;
        if (kind === 'preset-merge-library') {
            if (!deps.lodashGuestSource)
                throw Error('TEMPLATE_PRESET_LIBRARY_UNAVAILABLE');
            return context.newString(JSON.stringify(deps.lodashGuestSource));
        }
        if (kind === 'preset' || kind === 'preset-content' || kind === 'preset-result') {
            if (!presetCatalog)
                throw Error('TEMPLATE_PRESET_CAPTURE_REQUIRED');
            const result = kind === 'preset-result' ? JSON.parse(key) : undefined, index = result?.index ?? Number(key), entry = presetCatalog.kind === 'available' ? presetCatalog.prompts[index] : undefined;
            if (kind === 'preset-result')
                return context.newString(JSON.stringify(entry && result
                    ? projectLoreMacros({ sourcePointer: entry.sourcePointer, text: result.text }) : ''));
            if (entry) {
                // This resource is constructed here from the captured Community row;
                // retain this owner's exact content hash across unchanged phase cuts.
                const previous = presetHashes.get(index);
                ownedContentSha256 = previous?.text === entry.content ? previous.sha256 : schemaTextSha256(entry.content);
                if (previous?.text !== entry.content)
                    presetHashes.set(index, { text: entry.content, sha256: ownedContentSha256 });
                row = { id: `preset:${index}`, sourcePointer: entry.sourcePointer, sourceSnapshotSha256: snapshot.sourceSnapshotSha256,
                    contentSha256: ownedContentSha256, text: entry.content };
                resourceReads.set(row.id, { id: row.id, sourcePointer: row.sourcePointer,
                    sourceSnapshotSha256: row.sourceSnapshotSha256, contentSha256: row.contentSha256 });
            }
            if (kind === 'preset-content')
                return context.newString(JSON.stringify(entry?.content || null));
        }
        else if (kind === 'missing-lore') {
            noteRead('lore', 'missing-query-' + schemaTextSha256(key), null, 'read');
        }
        else if (kind === 'lore') {
            noteRead('lore', key, null, 'read');
            const entry = lore.get(key);
            if (entry?.readDiagnostic) {
                recordFault(entry.readDiagnostic.code, entry.sourcePointer);
                return context.undefined;
            }
            if (entry)
                row = { id: entry.key, sourcePointer: entry.sourcePointer, sourceSnapshotSha256: entry.sourceSnapshotSha256,
                    contentSha256: entry.contentSha256, text: entry.content };
        }
        else if (kind === 'include') {
            row = resources.get(key);
            if (row && !resourceReads.has(key))
                resourceReads.set(key, { id: row.id, sourcePointer: row.sourcePointer,
                    sourceSnapshotSha256: row.sourceSnapshotSha256, contentSha256: row.contentSha256 });
            if (row?.loreKey !== undefined) {
                const entry = lore.get(row.loreKey);
                if (!entry)
                    throw Error('TEMPLATE_INCLUDE_UNAVAILABLE');
                if (entry.readDiagnostic) {
                    recordFault(entry.readDiagnostic.code, entry.sourcePointer);
                    return context.undefined;
                }
                row = { ...row, sourcePointer: entry.sourcePointer, sourceSnapshotSha256: entry.sourceSnapshotSha256,
                    contentSha256: entry.contentSha256, text: entry.content };
                projectMacros = true;
            }
        }
        else
            throw Error('TEMPLATE_RESOURCE_KIND');
        return context.newString(JSON.stringify(row ? compileResource(row, projectMacros, ownedContentSha256) : null));
    });
    const activate = native('captured-worldbook-activation', (keyHandle) => {
        refuseEffect('activateWI');
        const key = context.getString(keyHandle);
        noteRead('lore', key, null, 'activation-proposal');
        const proposal = templateActivationV1(snapshot, key);
        if (!proposal) {
            recordFault('TEMPLATE_ACTIVATION_NOT_ALLOWED');
            return context.false;
        }
        if (!activationKeys.has(proposal.entryId)) {
            if (activations.length >= limits.activationProposals)
                throw Error('TEMPLATE_ACTIVATION_LIMIT');
            activationKeys.add(proposal.entryId);
            activations.push(proposal);
        }
        return context.true;
    });
    const emit = native('staged-template-injection', (wireHandle) => {
        refuseEffect('injectPrompts');
        const wire = context.getString(wireHandle);
        if (Buffer.byteLength(wire, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        const row = validateTemplateInjectionEffectsV1(JSON.parse('[' + wire + ']'))[0];
        if (effects.length + ordinaryWrites.length + regexEffects.length >= limits.injectionEffects)
            throw Error('TEMPLATE_EFFECT_LIMIT');
        charge(wire);
        if (row.kind === 'named-upsert') {
            const queues = requireNamed(), queue = queues.get(row.key) ?? new Map();
            queue.set(row.uid, { uid: row.uid, prompt: row.prompt, order: row.order, sticky: row.sticky });
            queues.set(row.key, queue);
        }
        effects.push(row);
        return context.undefined;
    });
    const named = native('captured-named-prompt', (kindHandle, valueHandle) => {
        const queues = requireNamed(), kind = context.getString(kindHandle), value = context.getString(valueHandle);
        if (Buffer.byteLength(value, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        if (kind === 'uid')
            return context.newString(createHash('sha256').update(value).digest('hex'));
        if (kind !== 'get')
            throw Error('TEMPLATE_HELPER_ARGUMENT');
        return context.newString([...(queues.get(value)?.values() ?? [])].sort((a, b) => a.order - b.order)
            .map(row => row.prompt).join('\n'));
    });
    const regex = native('staged-template-regex', (kindHandle, valueHandle) => {
        refuseEffect('activateRegex');
        const kind = context.getString(kindHandle), wire = context.getString(valueHandle);
        if (Buffer.byteLength(wire, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        if (kind === 'uid')
            return context.newString(createHash('sha256').update(wire).digest('hex'));
        if (kind !== 'upsert')
            throw Error('TEMPLATE_REGEX_ARGUMENT');
        if (effects.length + ordinaryWrites.length + regexEffects.length >= limits.injectionEffects)
            throw Error('TEMPLATE_EFFECT_LIMIT');
        // The trusted guest helper owns argument normalization. This boundary
        // owns proposal size, while callbacks and search values stay in QuickJS.
        charge(wire);
        regexEffects.push(JSON.parse(wire));
        return context.undefined;
    });
    const write = native('staged-ordinary-variable', (keyHandle, valueHandle, optionsHandle) => {
        refuseEffect('setvar');
        const key = context.getString(keyHandle), wire = context.getString(valueHandle), optionsWire = context.getString(optionsHandle);
        if (Buffer.byteLength(wire, 'utf8') > limits.helperArgumentBytes
            || Buffer.byteLength(optionsWire, 'utf8') > limits.helperArgumentBytes)
            throw Error('TEMPLATE_HELPER_LIMIT');
        const options = JSON.parse(optionsWire);
        if (!options || typeof options !== 'object' || Array.isArray(options)
            || Object.keys(options).some(name => !['scope', 'results', 'withMsg', 'noCache', 'operation', 'index', 'indexPath', 'flags', 'merge', 'dryRun'].includes(name))
            || options.scope !== undefined && !['local', 'chat', 'message', 'cache'].includes(options.scope)
            || options.results !== undefined && options.results !== 'old' && options.results !== 'new' && options.results !== 'fullcache') {
            throw Error('TEMPLATE_HELPER_UNSUPPORTED');
        }
        if (options.noCache) {
            cacheOverlay.clear();
            cacheRebuilt = true;
        }
        const parts = templateVariablePathV1(key), top = parts[0];
        if (top === 'stat_data')
            throw Error('TEMPLATE_NUMERICAL_OWNER_REQUIRED');
        // Main's owned preparation is not an ST global dry-run. The option permits
        // writes in ST dry-runs; it never grants this Host or Reader new authority.
        const cache = assignOverlay(rebuildCache(), cacheOverlay), pathFor = (values, name, parsed) => Object.hasOwn(values, name) ? [name] : parsed, lookup = (values, path) => {
            let current = values;
            for (const part of path) {
                if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part))
                    return { present: false, value: null };
                current = current[part];
            }
            return { present: true, value: current };
        };
        const cachePath = pathFor(cache, key, parts), parent = lookup(cache, cachePath), indexed = options.index !== undefined, cacheData = indexed ? JSON.parse(String(parent.present ? parent.value : '{}')) : undefined, parsedIndex = options.indexPath ? templateVariablePathV1(options.index) : [options.index], indexPath = (data) => options.indexPath && data !== null && typeof data === 'object'
            ? pathFor(data, options.index, parsedIndex) : parsedIndex, old = indexed ? lookup(cacheData, indexPath(cacheData)) : parent;
        if (options.flags || options.merge || options.results === 'old')
            readVariable(key, { scope: 'cache' });
        if (options.flags === 'nx' && old.present || options.flags === 'xx' && !old.present)
            return context.newString('{"present":false}');
        if (options.flags === 'nxs' || options.flags === 'xxs') {
            // This is getter selection, not the later writer target: unselected
            // message scope aliases cache, while withMsg may search older containers.
            const selected = readVariable(key, { ...options, noCache: false });
            if (options.flags === 'nxs' && selected.present || options.flags === 'xxs' && !selected.present)
                return context.newString('{"present":false}');
        }
        const cacheOnly = options.scope === 'cache', message = options.scope === undefined || options.scope === 'message'
            ? selectMessage(options.withMsg, false) : undefined;
        if (message && !message.captured)
            throw Error('TEMPLATE_MESSAGE_TARGET_UNAVAILABLE');
        if (!cacheOnly && !message && !ordinary)
            throw Error('TEMPLATE_VARIABLE_NAMESPACE_REQUIRED');
        let value = options.operation === 'delete' ? undefined : JSON.parse(wire);
        if (options.merge) {
            const before = old.present ? old.value : undefined;
            value = (before === undefined || Array.isArray(before)) && Array.isArray(value)
                ? lodash.concat(before ?? [], value)
                : lodash.mergeWith(lodash.cloneDeep(before ?? {}), value, (_destination, source) => Array.isArray(source) ? source : undefined);
        }
        const remove = value === undefined;
        const mutateIndex = (data) => {
            if (remove)
                lodash.unset(data, indexPath(data));
            else
                lodash.set(data, indexPath(data), value);
            return JSON.stringify(data);
        };
        const cachedValue = indexed ? mutateIndex(cacheData) : value, replacement = (values, nextValue) => {
            const path = pathFor(values, key, parts), rootKey = path[0];
            if (path.length === 1)
                return { top: rootKey, next: nextValue === undefined ? deleted : nextValue };
            const holder = { [rootKey]: lodash.cloneDeep(values[rootKey]) };
            if (nextValue === undefined) {
                const container = lookup(holder, path.slice(0, -1)).value;
                if (Array.isArray(container) && Object.hasOwn(container, path.at(-1)))
                    throw Error('TEMPLATE_VARIABLE_VALUE_UNSUPPORTED');
                lodash.unset(holder, path);
            }
            else
                lodash.set(holder, path, nextValue);
            return { top: rootKey, next: holder[rootKey] };
        };
        let cached = replacement(cache, cachedValue);
        // The cache always changes first, even for writes to a historical message.
        cacheOverlay.set(cached.top, cached.next);
        if (!cacheOnly) {
            const targetValues = message?.values ?? assignOverlay({ ...snapshot.scopes.find(row => row.scope === 'chat')?.values, ...ordinary.values }, overlay), previous = lookup(targetValues, pathFor(targetValues, key, parts)), targetValue = indexed ? message && !options.withMsg ? cachedValue :
                mutateIndex(JSON.parse(String(previous.value || '{}'))) : value, next = replacement(targetValues, targetValue);
            if (next.top === 'stat_data')
                throw Error('TEMPLATE_NUMERICAL_OWNER_REQUIRED');
            if (message?.target)
                noteMessageRead(message.target, next.top);
            else
                noteOrdinary(next.top);
            if (effects.length + ordinaryWrites.length + regexEffects.length >= limits.injectionEffects)
                throw Error('TEMPLATE_EFFECT_LIMIT');
            const effect = { ordinal: ordinaryWrites.length, key: next.top, ...message?.target ? { messageTarget: message.target } : {},
                ...next.next === deleted ? { operation: 'delete' } : { ...message ? { operation: 'set' } : {},
                    value: next.next } };
            charge(JSON.stringify(effect));
            ordinaryWrites.push(effect);
            if (message?.target) {
                const identity = targetKey(message.target), changes = messageOverlay.get(identity) ?? new Map();
                changes.set(next.top, next.next);
                messageOverlay.set(identity, changes);
                const current = messageView?.current;
                if (indexed && current && message.row?.index === current.message_id
                    && targetKey(message.target) === targetKey(messageAt(current.message_id, current.swipe_id).target)) {
                    cached = replacement(cache, targetValue);
                    cacheOverlay.set(cached.top, cached.next);
                }
            }
            else
                overlay.set(next.top, next.next);
        }
        const currentCache = assignOverlay(rebuildCache(), cacheOverlay);
        cacheOverlay.set('_modify_id', currentCache._modify_id + 1 || 1);
        const result = options.results === 'old' ? old : options.results === 'fullcache'
            ? { present: true, value: assignOverlay(rebuildCache(), cacheOverlay) } : { present: !remove, value: remove ? null : value };
        return context.newString(JSON.stringify(result));
    });
    const fail = native('template-helper-failure', (codeHandle, pointerHandle, lineHandle, helperHandle) => {
        const code = context.getString(codeHandle);
        const candidate = pointerHandle && context.typeof(pointerHandle) === 'string' ? context.getString(pointerHandle) : pointer;
        const sourcePointer = candidate === pointer || [...resources.values()].some(row => row.sourcePointer === candidate)
            || snapshot.lore.some(row => row.sourcePointer === candidate) ? candidate : pointer;
        const rawLine = lineHandle && context.typeof(lineHandle) === 'number' ? context.getNumber(lineHandle) : undefined;
        const line = rawLine !== undefined && Number.isSafeInteger(rawLine) && rawLine > 0 ? rawLine : undefined;
        recordFault(code, sourcePointer, line);
        if (effectConsumer && helperHandle && context.typeof(helperHandle) === 'string')
            fault = { ...fault, helper: context.getString(helperHandle) };
        return context.undefined;
    });
    let dispatcher, run, invoke;
    // The guest only selects lore keys. Variables, full source text and owner
    // resources stay here; sending them too would duplicate the frozen capture
    // without granting any functionality to the guest.
    const guestCatalog = () => ({ snapshot: { lore: snapshot.lore.map(row => ({ key: row.key, lookup: row.lookup })) },
        ...presetCatalog ? { presetCatalog: { kind: presetCatalog.kind, prompts: presetCatalog.kind === 'available'
                    ? presetCatalog.prompts.map((row, index) => ({ index, name: row.name })) : [] } } : {} });
    try {
        // Boot is trusted code, but still uses the same VM memory/deadline bounds.
        deadline = performance.now() + limits.vmDeadlineMs;
        let randomOrdinal = 0;
        const random = native('captured-template-random', () => {
            if (++randomOrdinal > limits.randomCalls)
                throw Error('TEMPLATE_RANDOM_LIMIT');
            const hash = createHash('sha256').update(JSON.stringify([snapshot.randomSeed, randomOrdinal])).digest('hex');
            return context.newNumber((Number.parseInt(hash.slice(0, 13), 16) + 0.5) / 4503599627370496);
        });
        const clock = native('captured-template-clock', () => context.newNumber(snapshot.clockEpochMs));
        context.setProp(context.global, '__ownedTemplateRandom', random);
        context.setProp(context.global, '__ownedTemplateClock', clock);
        const determinism = checked(context.evalCode(`(function(random,clock){
      const D=Date,construct=Reflect.construct,define=Object.defineProperty;
      function FixedDate(...args){const date=construct(D,args.length?args:[clock()]);
        return new.target?date:date.toString()}
      FixedDate.prototype=D.prototype;FixedDate.now=clock;
      FixedDate.parse=D.parse;FixedDate.UTC=D.UTC;
      define(D.prototype,'constructor',{value:FixedDate,writable:false,configurable:false});
      define(globalThis,'Date',{value:FixedDate,writable:false,configurable:false});
      define(Math,'random',{value:random,writable:false,configurable:false});
      delete globalThis.__ownedTemplateRandom;
      delete globalThis.__ownedTemplateClock;
    })(__ownedTemplateRandom,__ownedTemplateClock)`, 'owned-ejs-clock.js'));
        determinism.dispose();
        const bridge = checked(context.evalCode(TAVERN_EJS_HOST_GUEST, 'owned-ejs-host.js'));
        owned.push(bridge);
        const wire = context.newString(JSON.stringify({ ...guestCatalog(), context: capture.context, ...reader ? { consumer } : {} }));
        try {
            dispatcher = checked(context.callFunction(bridge, context.undefined, read, open, activate, emit, write, named, regex, fail, wire));
        }
        finally {
            wire.dispose();
        }
        owned.push(dispatcher);
        run = context.getProp(dispatcher, 'run');
        invoke = context.getProp(dispatcher, 'invoke');
        owned.push(run, invoke);
    }
    catch (error) {
        dispose();
        throw error;
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        for (const value of owned.reverse())
            value.dispose();
        context.dispose();
        runtime.dispose();
        compiled.clear();
    }
    function call(fn, args) {
        const handles = args.map(value => context.newString(value));
        let promise;
        try {
            promise = checked(context.callFunction(fn, context.undefined, ...handles));
            for (;;) {
                if (fault)
                    throw Error(fault.code);
                if (performance.now() >= deadline) {
                    recordFault('TEMPLATE_VM_TIMEOUT');
                    throw Error();
                }
                const state = context.getPromiseState(promise);
                if (state.type === 'rejected') {
                    state.error.dispose();
                    recordFault('TEMPLATE_EJS_GUEST_ERROR');
                    throw Error();
                }
                if (state.type === 'fulfilled') {
                    if (!state.notAPromise && !runtime.hasPendingJob())
                        return state.value;
                    state.value.dispose();
                }
                if (!runtime.hasPendingJob()) {
                    recordFault('TEMPLATE_ASYNC_UNSETTLED');
                    throw Error();
                }
                if (++jobs > limits.promiseJobs) {
                    recordFault('TEMPLATE_PROMISE_LIMIT');
                    throw Error();
                }
                const job = runtime.executePendingJobs(1);
                if (job.error) {
                    job.dispose();
                    recordFault('TEMPLATE_EJS_GUEST_ERROR');
                    throw Error();
                }
                job.dispose();
            }
        }
        finally {
            promise?.dispose();
            for (const handle of handles)
                handle.dispose();
        }
    }
    const begin = () => {
        if (disposed)
            throw Error('TEMPLATE_DISPOSED');
        if (fault)
            throw Error(fault.code);
        deadline = performance.now() + limits.vmDeadlineMs;
        // Deadline is per active action (parked time is not CPU). Work/input/job
        // counters and staged-effect bytes remain bounded over this host lifetime.
    };
    let creation;
    let rootContentSha256 = '';
    const basis = () => ({ sourcePointer: pointer, contentSha256: rootContentSha256,
        sourceSnapshotSha256: snapshot.sourceSnapshotSha256, snapshotSha256: snapshot.snapshotSha256 });
    const publicPacket = (value) => {
        // This is the one transport copy/publication budget for host-owned JSON,
        // including metadata. Caller mutation cannot alter cached/live VM facts.
        const wire = JSON.stringify(value);
        if (Buffer.byteLength(wire, 'utf8') > limits.outputBytes)
            throw Error('TEMPLATE_OUTPUT_LIMIT');
        return JSON.parse(wire);
    };
    return {
        render(resource) {
            if (disposed)
                return { kind: 'refused', diagnostic: { code: 'TEMPLATE_DISPOSED', sourcePointer: resource.sourcePointer } };
            if (creation) {
                if (creation.pointer === resource.sourcePointer && creation.text === resource.text)
                    return structuredClone(creation.result);
                return { kind: 'refused', diagnostic: { code: 'TEMPLATE_PREPARATION_SOURCE_CHANGED', sourcePointer: resource.sourcePointer } };
            }
            pointer = resource.sourcePointer;
            rootContentSha256 = resource.contentSha256;
            let result;
            let returned;
            try {
                begin();
                const descriptor = compileResource(resource);
                const value = call(run, [descriptor.sourcePointer, descriptor.functionSource]);
                let text;
                try {
                    if (context.typeof(value) !== 'string')
                        throw Error('TEMPLATE_EJS_RETURN_TYPE');
                    text = context.getString(value);
                }
                finally {
                    value.dispose();
                }
                if (!reader && text.length > limits.outputChars || Buffer.byteLength(text, 'utf8') + proposalBytes > limits.cumulativeOutputBytes) {
                    recordFault('TEMPLATE_OUTPUT_LIMIT');
                    throw Error();
                }
                const output = { basis: basis(), renderedText: text, reads: [...reads], resourceReads: [...resourceReads.values()],
                    ...reader ? { consumerPolicy: consumerPolicy() } : {},
                    activations: [...activations], injections: [...effects],
                    ...(regexEffects.length ? { regexEffects: [...regexEffects] } : {}),
                    ...(ordinary ? { ordinaryRoot: ordinary.root } : {}), ordinaryReads: [...ordinaryReads], ordinaryReadAll,
                    ...messageReadOutput(), ordinaryWrites: [...ordinaryWrites] };
                // No live guest handles/functions leave this host. Caller receives a
                // detached proposal packet; it cannot rewrite the duplicate result.
                result = { kind: 'rendered', output };
                returned = publicPacket(result);
            }
            catch (error) {
                fromError(error);
                result = { kind: 'refused', diagnostic: fault };
            }
            creation = { pointer: resource.sourcePointer, text: resource.text, result };
            return returned ?? structuredClone(result);
        },
        invoke(action, nextCapture) {
            const previousConsumer = effectConsumer;
            effectConsumer = consumer === 'reader-render-v1' ? consumer :
                action.kind === 'regex' ? action.consumer ?? consumer : consumer;
            const start = effects.length;
            const writeStart = ordinaryWrites.length, activationStart = activations.length, regexStart = regexEffects.length;
            try {
                begin();
                if (!creation || creation.result.kind !== 'rendered')
                    throw Error('TEMPLATE_CREATION_REQUIRED');
                reads.length = 0;
                readKeys.clear();
                resourceReads.clear();
                ordinaryReads.clear();
                ordinaryReadAll = false;
                activationKeys.clear();
                messageReads.clear();
                messageReadCount = 0;
                if (nextCapture) {
                    const next = validateTemplateSnapshotV1(nextCapture.snapshot);
                    if (next.sessionId !== sourceBasis.sessionId || next.branchId !== sourceBasis.branchId
                        || next.packageSha256 !== sourceBasis.packageSha256)
                        throw Error('TEMPLATE_SOURCE_CHANGED');
                    // Core retains the actual logical Source definition and lifetime.
                    // Native metadata counters can change the whole Source audit hash
                    // while that definition and its original lexical cells remain live.
                    snapshot = next;
                    dependencyRows.clear();
                    resources = new Map(nextCapture.resources.map(row => [row.id, { ...row }]));
                    lore = new Map(snapshot.lore.map(row => [row.key, row]));
                    ordinary = nextCapture.ordinaryNamespace ? structuredClone(nextCapture.ordinaryNamespace) : undefined;
                    messageView = nextCapture.ordinaryMessageView ? structuredClone(nextCapture.ordinaryMessageView) : undefined;
                    indexMessages();
                    messageOverlay.clear();
                    cacheOverlay.clear();
                    cacheRebuilt = false;
                    namedQueues = namedCapture(nextCapture.namedPromptQueues);
                    presetCatalog = nextCapture.presetCatalog;
                    macros = nextCapture.macros;
                    macroProjector = undefined;
                    overlay.clear();
                }
                const value = call(invoke, [JSON.stringify(action), JSON.stringify(nextCapture ? guestCatalog() : null)]);
                let result;
                try {
                    result = JSON.parse(context.getString(value));
                }
                finally {
                    value.dispose();
                }
                return publicPacket({ kind: 'evaluated', accepted: result.accepted, output: {
                        ...effectConsumer ? { consumerPolicy: consumerPolicy() } : {},
                        basis: basis(), reads: [...reads], resourceReads: [...resourceReads.values()],
                        activations: activations.slice(activationStart), injections: effects.slice(start),
                        ...(regexEffects.length > regexStart ? { regexEffects: regexEffects.slice(regexStart) } : {}),
                        ...(result.regexResults === undefined ? {} : { regexResults: result.regexResults }),
                        ...(ordinary ? { ordinaryRoot: ordinary.root } : {}), ordinaryReads: [...ordinaryReads], ordinaryReadAll,
                        ...messageReadOutput(), ordinaryWrites: ordinaryWrites.slice(writeStart)
                    } });
            }
            catch (error) {
                fromError(error);
                return { kind: 'refused', diagnostic: { ...fault } };
            }
            finally {
                effectConsumer = previousConsumer;
            }
        }, dispose,
    };
}
