// Generated from runtime/alpha3/src/core/roleplay-program-absence-branch-controls.ts; edit the TypeScript source.
/** Current legacy branch control DTOs associated with actual Native history.
 * The wrapper has a schema; the old stored rows are neither rewritten nor
 * promoted to authentic writer, completion, readiness or scheduling proof. */
import { types } from 'node:util';
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { foldSurface, deriveEventMessage } from '@deepseek-ai/dsh-session';
import { recordSha256, textOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
function fail(code) { throw Error(code); }
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, minimum = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= minimum && !Object.is(value, -0);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function exact(value, required, optional = []) {
    if (!object(value) || required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_SCHEMA_INVALID');
}
/** The shared bounded clone checks descriptors/proxies before reading values.
 * Complete own-data comparison then rejects its normalization aliases: omitted
 * undefined, -0, holes or any extra own key cannot equal the detached spelling. */
function sameData(actual, expected) {
    if (Object.is(actual, expected))
        return true;
    if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
        || types.isProxy(actual) || types.isProxy(expected) || Array.isArray(actual) !== Array.isArray(expected))
        return false;
    if (Array.isArray(actual) ? Object.getPrototypeOf(actual) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(actual)))
        return false;
    const a = Object.getOwnPropertyDescriptors(actual), b = Object.getOwnPropertyDescriptors(expected), left = Reflect.ownKeys(actual), right = Reflect.ownKeys(expected);
    return left.length === right.length && left.every(key => typeof key === 'string' && right.includes(key)) && right.every(key => {
        if (typeof key !== 'string')
            return false;
        const x = a[key], y = b[key];
        return !!x && !!y && Object.hasOwn(x, 'value') && Object.hasOwn(y, 'value') && x.enumerable === y.enumerable
            && sameData(x.value, y.value);
    });
}
function strictData(raw, budget) {
    const detached = cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 }, budget);
    if (!sameData(raw, detached))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ROW_SPELLING_INVALID');
    return freeze(detached);
}
function projectionPin(definition) {
    if (!object(definition) || types.isProxy(definition)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(definition)))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
    const descriptors = Object.getOwnPropertyDescriptors(definition), type = descriptors['type'], project = descriptors['project'];
    if (Reflect.ownKeys(definition).length !== 2 || !type || !project || !type.enumerable || !project.enumerable
        || !Object.hasOwn(type, 'value') || !Object.hasOwn(project, 'value') || typeof type.value !== 'string' || !type.value
        || typeof project.value !== 'function' || types.isProxy(project.value))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
    return { definition, type: type.value, project: project.value };
}
function projectionList(raw) {
    if (!raw || typeof raw !== 'object' || types.isProxy(raw) || !Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
    const descriptors = Object.getOwnPropertyDescriptors(raw), length = Object.getOwnPropertyDescriptor(raw, 'length'), result = [];
    if (!length || !Object.hasOwn(length, 'value') || !integer(length.value) || length.value > 16_384
        || Reflect.ownKeys(raw).length !== length.value + 1)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
    for (let index = 0; index < length.value; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
        result.push(descriptor.value);
    }
    return result;
}
function turnFromKey(suffix, prefix) {
    const spelling = suffix.slice(prefix.length);
    if (!/^[1-9]\d{0,15}$/.test(spelling))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ADDRESS_INVALID');
    const turn = Number(spelling);
    if (!integer(turn, 1) || String(turn) !== spelling)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ADDRESS_INVALID');
    return turn;
}
function phaseB(value, sid, turn) {
    exact(value, ['state', 'turnId', 'assistantSeq', 'sessionId', 'startedAt', 'attempt'], ['memoryMode', 'completedAt', 'error', 'failedAt']);
    if (value['sessionId'] !== sid || value['turnId'] !== turn || !integer(value['assistantSeq']) || !integer(value['startedAt'])
        || !integer(value['attempt'], 1) || !['running', 'completed', 'waiting-main', 'retry'].includes(String(value['state'])))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID');
    if (value['memoryMode'] !== undefined && !['background-notes', 'foreground-ledger'].includes(String(value['memoryMode'])))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID');
    for (const field of ['completedAt', 'failedAt'])
        if (value[field] !== undefined && !integer(value[field]))
            fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID');
    if (value['error'] !== undefined && value['error'] !== null && (typeof value['error'] !== 'string' || value['error'].length > 500))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID');
    if (value['state'] === 'completed' && (!integer(value['completedAt']) || value['error'] !== null || !value['memoryMode'])
        || value['state'] === 'waiting-main' && value['error'] !== null
        || value['state'] === 'retry' && (!integer(value['failedAt']) || typeof value['error'] !== 'string'))
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PHASE_B_INVALID');
    return value;
}
function steering(value, sid, turn) {
    exact(value, ['schemaVersion', 'sessionId', 'turn', 'fingerprint', 'attempt', 'source']);
    if (value['schemaVersion'] !== 1 || value['sessionId'] !== sid || value['turn'] !== turn || !hash(value['fingerprint'])
        || !integer(value['attempt'], 1) || !Array.isArray(value['source']) || value['source'].length > 4096
        || !value['source'].every(id) || new Set(value['source']).size !== value['source'].length)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_STEERING_INVALID');
    return value;
}
const timingStages = Object.freeze(['enter', 'workflows-resumed', 'story-selected', 'status-admitted', 'decision-admitted',
    'status-ready-or-inline', 'decision-ready-or-inline', 'phase-bc-ready', 'maintenance-steered', 'finished']);
function timing(value, sid, turn) {
    exact(value, ['schemaVersion', 'sessionId', 'turn', 'updatedAt', 'samples']);
    if (value['schemaVersion'] !== 1 || value['sessionId'] !== sid || value['turn'] !== turn || !integer(value['updatedAt'])
        || !Array.isArray(value['samples']) || !value['samples'].length || value['samples'].length > 64)
        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TIMING_INVALID');
    for (const sample of value['samples']) {
        exact(sample, ['stage', 'wallAt', 'elapsedMs', 'deltaMs']);
        if (typeof sample['stage'] !== 'string' || !timingStages.includes(sample['stage']) || !integer(sample['wallAt'])
            || !integer(sample['elapsedMs']) || !integer(sample['deltaMs']))
            fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TIMING_INVALID');
    }
    return value;
}
/** Root supplies original actual lookup/history/projection functions once.
 * A capture checks the entire present namespace, even though only three exact
 * control families receive facts. Other rows never acquire a fallback grant. */
export function createRoleplayProgramAbsenceBranchControlsV1(deps) {
    const tables = deps.tables, lookup = deps.session, readEvents = deps.events, readProjections = deps.projections, tableObjects = { branch: tables.branch, status: tables.status }, methods = { branch: { get: tables.branch.get, entries: tables.branch.entries }, status: { get: tables.status.get, entries: tables.status.entries } };
    function capture(session) {
        const sid = session.id;
        const assertIdentity = () => {
            if (deps.tables !== tables || deps.session !== lookup || deps.events !== readEvents || deps.projections !== readProjections
                || !id(sid) || session.id !== sid || lookup(sid) !== session)
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_SESSION_CHANGED');
            for (const table of ['branch', 'status'])
                if (tables[table] !== tableObjects[table]
                    || tableObjects[table].get !== methods[table].get || tableObjects[table].entries !== methods[table].entries)
                    fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_CHANGED');
        };
        assertIdentity();
        const events = readEvents(session), projections = projectionList(readProjections()), pins = projections.map(projectionPin), cursor = Number(session.seq), birth = Number(session.inheritedEventCount), header = session.header, headerSha256 = nativeInputSha256(header);
        if (!Array.isArray(events) || types.isProxy(events) || !integer(cursor) || !integer(birth) || birth > cursor || events.length !== cursor
            || events.some((event, index) => !integer(event.seq) || Number(event.seq) !== index)
            || (header.parentSession === undefined || header.parentSession === null ? birth !== 0 : !id(header.parentSession) || header.parentSession === sid))
            fail('PROGRAM_ABSENCE_BRANCH_CONTROL_HISTORY_UNAVAILABLE');
        const historySha256 = nativeInputSha256(events);
        if (new Set(pins.map(pin => pin.type)).size !== pins.length)
            fail('PROGRAM_ABSENCE_BRANCH_CONTROL_PROJECTIONS_CHANGED');
        const namespace = () => {
            const rows = new Map(), budget = { bytes: 0, nodes: 0 };
            for (const table of ['branch', 'status'])
                for (const entry of methods[table].entries.call(tableObjects[table])) {
                    if (!entry || typeof entry !== 'object' || types.isProxy(entry) || !Array.isArray(entry))
                        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_INVALID');
                    const descriptors = Object.getOwnPropertyDescriptors(entry), length = Object.getOwnPropertyDescriptor(entry, 'length'), keyValue = descriptors['0'], rawValue = descriptors['1'];
                    if (Reflect.ownKeys(entry).length !== 3 || !length || !Object.hasOwn(length, 'value') || length.value !== 2
                        || !keyValue || !rawValue || !Object.hasOwn(keyValue, 'value') || !Object.hasOwn(rawValue, 'value')
                        || !keyValue.enumerable || !rawValue.enumerable || typeof keyValue.value !== 'string')
                        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TABLE_INVALID');
                    const key = keyValue.value;
                    if (!key.startsWith(sid + '__'))
                        continue;
                    const address = table + ':' + key;
                    if (rows.has(address) || rows.size >= 16_384)
                        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_BUDGET_OR_DUPLICATE');
                    const value = strictData(rawValue.value, budget), actual = methods[table].get.call(tableObjects[table], key);
                    if (!sameData(actual, value) || recordSha256(actual) !== recordSha256(value))
                        fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_CHANGED');
                    rows.set(address, { table, key, value, sha256: recordSha256(value) });
                }
            return rows;
        };
        const namespaceRows = namespace();
        const assertNativeFrame = () => {
            assertIdentity();
            const actualEvents = readEvents(session), actualProjections = projectionList(readProjections());
            if (Number(session.seq) !== cursor || Number(session.inheritedEventCount) !== birth || session.header !== header
                || nativeInputSha256(session.header) !== headerSha256 || actualEvents.length !== events.length
                || nativeInputSha256(actualEvents) !== historySha256 || actualProjections.length !== pins.length
                || actualProjections.some((definition, index) => {
                    const actual = projectionPin(definition), pin = pins[index];
                    return actual.definition !== pin.definition || actual.type !== pin.type || actual.project !== pin.project;
                }))
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_HISTORY_CHANGED');
            assertIdentity();
        };
        const assertCurrent = () => {
            assertNativeFrame();
            const actual = namespace();
            if (actual.size !== namespaceRows.size || [...namespaceRows].some(([address, row]) => {
                const now = actual.get(address);
                return !now || now.sha256 !== row.sha256 || !sameData(now.value, row.value);
            }))
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_NAMESPACE_CHANGED');
            // Namespace reads may have synchronous callbacks. Observe actual Native
            // and owner identities again after the last table operation.
            assertNativeFrame();
        };
        assertCurrent();
        const surface = foldSurface(events, projections), visible = new Set(surface.nodes), associations = new Map();
        function association(turn, requestedSeq) {
            const cacheKey = turn + ':' + (requestedSeq ?? 'last'), previous = associations.get(cacheKey);
            if (previous)
                return previous;
            const starts = events.filter(event => event.type === 'turn/start' && event.data.turn === turn), ends = events.filter(event => event.type === 'turn/end' && event.data.turn === turn);
            if (starts.length !== 1 || ends.length !== 1)
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TURN_UNPROVEN');
            const start = starts[0], end = ends[0];
            if (Number(start.seq) < birth || Number(end.seq) <= Number(start.seq)
                || events.slice(Number(start.seq) + 1, Number(end.seq)).some(event => event.type === 'turn/start' || event.type === 'turn/end'))
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_TURN_UNPROVEN');
            const assistants = events.slice(Number(start.seq) + 1, Number(end.seq)).filter(event => event.type === 'assistant/message' && event.data.turn === turn && event.data.interrupted !== true && event.surfaceOp !== undefined);
            const assistant = requestedSeq === undefined ? assistants.findLast(event => {
                const message = deriveEventMessage(event, surface.projectedMessages);
                return !!message && message.role === 'assistant' && !!textOf(message.content).trim();
            }) : assistants.find(event => Number(event.seq) === requestedSeq);
            if (!assistant || assistant.type !== 'assistant/message')
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ASSISTANT_UNPROVEN');
            const message = deriveEventMessage(assistant, surface.projectedMessages);
            if (!message || message.role !== 'assistant' || !textOf(message.content).trim())
                fail('PROGRAM_ABSENCE_BRANCH_CONTROL_ASSISTANT_UNPROVEN');
            const result = freeze({ turn, startSeq: Number(start.seq), endSeq: Number(end.seq), assistantSeq: Number(assistant.seq),
                assistantEventSha256: nativeInputSha256(assistant), assistantMessageSha256: nativeInputSha256(message),
                assistantSurface: visible.has(Number(assistant.seq)) ? 'current-node' : 'retained-historical-node',
                inheritedEventCount: birth });
            associations.set(cacheKey, result);
            return result;
        }
        const facts = [], unsupportedMutableRows = [];
        for (const entry of namespaceRows.values()) {
            if (entry.table !== 'branch')
                continue;
            const suffix = entry.key.slice(sid.length + 2);
            if (suffix === 'task-preparation' || suffix === 'context-window') {
                unsupportedMutableRows.push({ table: 'branch', key: entry.key, sha256: entry.sha256, kind: suffix,
                    reason: 'requires-native-bound-field-contract' });
                continue;
            }
            const prefix = suffix.startsWith('phaseb-') ? 'phaseb-' : suffix.startsWith('task-steering-') ? 'task-steering-'
                : suffix.startsWith('maintenance-timing-') ? 'maintenance-timing-' : undefined;
            if (!prefix)
                continue;
            const turn = turnFromKey(suffix, prefix), kind = prefix === 'phaseb-' ? 'phase-b'
                : prefix === 'task-steering-' ? 'task-steering' : 'maintenance-timing', value = kind === 'phase-b' ? phaseB(entry.value, sid, turn) : kind === 'task-steering' ? steering(entry.value, sid, turn) : timing(entry.value, sid, turn), native = association(turn, kind === 'phase-b' ? value['assistantSeq'] : undefined), nativeAssociatedFields = kind === 'phase-b' ? ['turnId', 'assistantSeq', 'sessionId'] : ['sessionId', 'turn'], unboundControlFields = Object.keys(value).filter(field => !nativeAssociatedFields.includes(field));
            facts.push(freeze({ schemaVersion: 1, table: 'branch', key: entry.key, value, sha256: entry.sha256,
                family: 'branch-control', kind, evidenceKind: 'native-associated-typed-local-data',
                evidenceGrade: 'strict-control-dto-with-native-turn-association', nativeAssociatedFields, unboundControlFields,
                nativeAssociation: native, wholeRowWriterProvenance: 'not-proven', completionEvidence: 'not-checked', executionAuthority: 'none' }));
        }
        facts.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const currentNamespace = [...namespaceRows.values()].map(({ table, key, sha256 }) => ({ table, key, sha256 }))
            .sort((a, b) => a.table < b.table ? -1 : a.table > b.table ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const evidence = freeze({ schemaVersion: 1,
            encoding: 'native-associated-branch-control-facts-v1', authority: 'consumer-data-only',
            evidenceKind: 'native-associated-typed-local-data', sessionId: sid,
            history: { eventCount: events.length, inheritedEventCount: birth, sha256: historySha256 }, namespace: currentNamespace,
            coveredKinds: ['phase-b', 'task-steering', 'maintenance-timing'], unsupportedMutableRows,
            wholeRowWriterProvenance: 'not-proven', executionAuthority: 'none' });
        assertCurrent();
        return { rows: freeze(facts), evidence, assertCurrent };
    }
    return { capture };
}
