// Generated from runtime/alpha3/compat/session/src/surface.ts; edit the TypeScript source.
/**
 * Surface layer on top of the session event log: an ordered view of events
 * that produce LLM messages. The append-only log remains the source of truth.
 *
 * Browser-safe: web clients consume this subpath export, so it must stay free
 * of `node:` imports (they break the vite bundle).
 *
 * @module @deepseek-ai/dsh-session/surface
 */
import { SessionLogOffset, SessionSeq } from './types.js';
import { KNOWN_SESSION_EVENT_TYPES, MESSAGE_PROJECTION_EVENT_TYPES } from './known-event-types.js';
/** Runtime counterpart of the message-producing event union. */
const SURFACE_EVENT_TYPES = new Set([
    'system/message',
    'developer/message',
    'user/message',
    'assistant/message',
    'tool/result',
]);
/**
 * Whether an event type can join the model-visible surface.
 * @param type - event type to test.
 * @returns true for one of the message-producing event types.
 */
export function isSurfaceEligibleType(type) {
    return SURFACE_EVENT_TYPES.has(type);
}
/**
 * Narrow an event to a surface-eligible event carrying its required marker.
 * @param event - event to test.
 * @returns true when both the type and marker identify a surface event.
 */
export function isSurfaceEvent(event) {
    if (!SURFACE_EVENT_TYPES.has(event.type))
        return false;
    const candidate = event;
    return candidate.surfaceOp !== undefined;
}
/**
 * Narrow an event to an append-origin surface event: one that entered the
 * surface at its own log position and was never itself a replacement copy.
 *
 * The model-visible surface deliberately shadows replaced ranges, so it is the
 * wrong source for a human transcript — a landed replacement would erase
 * conversation the user already saw. Append-origin events are that transcript's
 * durable source material; replacement copies stay model-only.
 * @param event - event to test.
 * @returns true when the event appended to the surface tail.
 */
export function isAppendSurfaceEvent(event) {
    return isSurfaceEvent(event) && event.surfaceOp === 'append';
}
/**
 * Narrow an event to a surface replacement: a node that shadowed an existing
 * surface range instead of appending to the tail. The counterpart of
 * {@link isAppendSurfaceEvent} over the two {@link SurfaceOp} variants.
 * @param event - event to test.
 * @returns true when the event replaced a surface range.
 */
export function isReplacementSurfaceEvent(event) {
    return isSurfaceEvent(event) && event.surfaceOp !== 'append';
}
/**
 * Project a single event into the LLM message it derives to, or null when it
 * produces none — a non-surface event (attempt, boundary, log-only record) or an
 * empty-content system, developer, or assistant message. A caller
 * reconstructing model input supplies the same prefix's `projectedMessages`
 * from {@link foldSurface}; without that map this function reads original
 * event content. Session instance methods apply the live projection. Messages
 * are immutable and unchanged content retains its durable identity.
 * @param event - the event to project.
 * @param projectedMessages - message projections from the same log prefix's surface fold.
 * @returns the derived message, or null when the event produces none.
 */
export function deriveEventMessage(event, projectedMessages) {
    const projected = projectedMessages?.get(event.seq);
    if (projected !== undefined)
        return projected;
    // Intentionally non-exhaustive: only message-producing events derive
    // history; turn/step boundaries, failed attempts, and errors are trace/replay
    // data.
    switch (event.type) {
        // Ordinary prompts and injected context project in user role: the event's
        // model-facing content stays verbatim. Do NOT re-add per-type framing
        // (e.g. `<context>`) here: framing is caller-owned — a producer bakes it
        // into `content`, as agent-instructions does with `<system-reminder>` — or,
        // if reintroduced, must be driven by the event `meta` map and a dedicated
        // renderer, keeping this projection a verbatim pass-through. See the
        // deferred design note in
        // ../../../../.agents/notes/implemented/simplification/2026-07-20-unwrap-injected-content-envelopes.md
        case 'user/message': {
            return event.data;
        }
        // Empty system and developer nodes retain their surface positions without
        // adding wire messages. An empty assistant event hosts a max-tokens step's
        // usage and must not inject a content-less turn into the provider transcript.
        case 'system/message':
        case 'developer/message':
        case 'assistant/message': {
            if (event.data.message.content.length === 0)
                return null;
            return event.data.message;
        }
        case 'tool/result': {
            return event.data.message;
        }
        default:
            // A non-surface event (boundary, attempt, log-only record) projects to
            // no message. Merge-extensible union: no assertNever here.
            return null;
    }
}
/** Whether a payload field is a JSON object rather than an array or scalar. */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Reject noncanonical request-header fields, developer roles/content, and contradictory tool failure metadata.
 * This does not validate complete event payloads or embedded provider streams.
 * @param event - event whose locally related payload fields are inspected.
 * @param subject - event location to include in validation errors.
 * @throws when request-header fields, developer roles/content, or tool failure metadata are invalid.
 */
export function validateSessionEventData(event, subject) {
    const data = event.data;
    if (SURFACE_EVENT_TYPES.has(event.type) && isRecord(data)) {
        const message = event.type === 'user/message' ? data : data['message'];
        if (isRecord(message)) {
            if ((event.type === 'developer/message') !== (message['role'] === 'developer')) {
                throw new Error(`${subject} developer/message and developer role must occur together`);
            }
            if (message['role'] !== 'developer' && Array.isArray(message['content'])
                && message['content'].some((block) => isRecord(block)
                    && (block['type'] === 'tool-addition' || block['type'] === 'tool-removal'))) {
                throw new Error(`${subject} tool-change blocks require developer role`);
            }
            if (event.type === 'developer/message' && Array.isArray(message['content'])) {
                let hasAdditions = false;
                for (const block of message['content']) {
                    if (!isRecord(block) || (block['type'] !== 'tool-addition' && block['type'] !== 'tool-removal'))
                        continue;
                    if (typeof block['toolName'] !== 'string' || block['toolName'].length === 0) {
                        throw new Error(`${subject} ${block['type']} requires a nonempty toolName`);
                    }
                    if (block['type'] === 'tool-addition') {
                        hasAdditions = true;
                        if (Object.hasOwn(block, 'tool'))
                            throw new Error(`${subject} tool-addition must omit inline tool definitions`);
                    }
                }
                if (hasAdditions ? !isEventSeq(data['headerSeq']) : Object.hasOwn(data, 'headerSeq')) {
                    throw new Error(`${subject} requires headerSeq exactly when tool additions are present`);
                }
            }
        }
    }
    if (event.type === 'request/header') {
        if (!isRecord(data))
            throw new Error(`${subject} data must be an object`);
        const header = data['header'];
        if (!isRecord(header))
            throw new Error(`${subject} header must be an object`);
        if (Object.hasOwn(header, 'system'))
            throw new Error(`${subject} must omit header.system; use system/message`);
        if (Array.isArray(header['tools']) && header['tools'].length === 0) {
            throw new Error(`${subject} must omit empty tools`);
        }
        const defaults = header['adapterDefaults'];
        if (isRecord(defaults) && Object.keys(defaults).length === 0) {
            throw new Error(`${subject} must omit empty adapterDefaults`);
        }
    }
    else if (event.type === 'tool/result') {
        if (!isRecord(data))
            throw new Error(`${subject} data must be an object`);
        if (data['error'] === undefined)
            return;
        const message = data['message'];
        if (!isRecord(message) || message['isError'] !== true) {
            throw new Error(`${subject} error requires message.isError === true`);
        }
    }
}
/** Create an empty surface fold state. */
function createFoldState() {
    return { nodes: [], replaceGeneration: 0, contentGeneration: 0, projectedMessages: new Map(), projections: new Set() };
}
/** Whether a runtime value is a non-negative safe event sequence. */
function isEventSeq(value) {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 0
        && !Object.is(value, -0);
}
/** Whether a runtime value is the exact positional-replacement shape. */
function isReplaceOp(value) {
    const op = value;
    return Object.keys(op).length === 3
        && Object.hasOwn(op, 'op')
        && Object.hasOwn(op, 'startSeq')
        && Object.hasOwn(op, 'endSeq')
        && op['op'] === 'replace'
        && isEventSeq(op['startSeq'])
        && isEventSeq(op['endSeq']);
}
/** Validate event-local surface eligibility and return its operation. */
function surfaceOpOf(event) {
    const raw = event;
    if (!isSurfaceEligibleType(event.type)) {
        // Unknown ignorable records retain opaque metadata without affecting history.
        if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true)
            return;
        if (raw.surfaceOp !== undefined) {
            throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
        }
        if (raw.sourceEventSeqs !== undefined) {
            throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
        }
        return;
    }
    const op = raw.surfaceOp;
    if (op === undefined) {
        throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
    }
    if (op === 'append')
        return op;
    if (op === null || typeof op !== 'object' || Array.isArray(op)) {
        throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
    }
    if (!isReplaceOp(op)) {
        throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
    }
    return op;
}
/** Validate cited source-event seqs against prior log entries and the replacement range. */
function assertSourceEventReferences(event, shadowedSeqs) {
    const raw = event.sourceEventSeqs;
    if (event.type === 'assistant/message' && raw !== undefined) {
        throw new Error('assistant/message embeds its source stream and cannot carry sourceEventSeqs');
    }
    const sources = new Set();
    if (raw !== undefined) {
        if (!Array.isArray(raw)) {
            throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
        }
        if (raw.length === 0) {
            throw new Error('sourceEventSeqs must not be empty');
        }
        let nonEarlierSource;
        for (const source of raw) {
            if (!isEventSeq(source)) {
                throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
            }
            sources.add(source);
            if (nonEarlierSource === undefined && source >= event.seq)
                nonEarlierSource = source;
        }
        if (sources.size !== raw.length) {
            throw new Error('sourceEventSeqs must not contain duplicates');
        }
        if (nonEarlierSource !== undefined) {
            throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
        }
    }
    const missing = shadowedSeqs.filter(seq => !sources.has(seq));
    if (missing.length > 0) {
        throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(', ')}`);
    }
}
/** Resolve tool additions against their immutable historical request header. */
function assertDeveloperHeader(event, events, baseSeq) {
    if (event.type !== 'developer/message')
        return;
    validateSessionEventData(event, `developer/message at seq ${event.seq}`);
    if (event.data.headerSeq === undefined)
        return;
    const headerSeq = event.data.headerSeq;
    const headerEvent = events[headerSeq - baseSeq];
    if (headerSeq >= event.seq || headerEvent?.type !== 'request/header') {
        throw new Error('developer/message headerSeq must reference an earlier request/header');
    }
    for (const block of event.data.message.content) {
        if (block.type !== 'tool-addition')
            continue;
        const definitions = headerEvent.data.header.tools?.filter(tool => tool.name === block.toolName) ?? [];
        if (definitions.length !== 1) {
            throw new Error(`developer/message tool-addition "${block.toolName}" must name exactly one tool in headerSeq ${headerSeq}`);
        }
        const definition = definitions[0];
        if (typeof definition.description !== 'string' || !isRecord(definition.parameters)) {
            throw new Error(`developer/message tool-addition "${block.toolName}" requires a complete tool definition in headerSeq ${headerSeq}`);
        }
        if (Object.hasOwn(definition, 'deferLoading') && definition.deferLoading !== true) {
            throw new Error('developer/message referenced tool deferLoading must be true when present');
        }
    }
}
/**
 * Validate one event's surface metadata without checking membership in a log or surface.
 * @param event - event whose marker and source sequence values are inspected.
 * Unknown ignorable records retain opaque metadata and never change the surface.
 * @returns the validated operation, or undefined for a log-only or unknown ignorable event.
 * @throws when metadata violates event-local eligibility, marker, or source-sequence rules.
 */
export function validateSurfaceMetadata(event) {
    const op = surfaceOpOf(event);
    if (op !== undefined && op !== 'append'
        && (op.startSeq >= event.seq || op.endSeq >= event.seq)) {
        throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
    }
    if (op !== undefined)
        assertSourceEventReferences(event, []);
    return op;
}
/** Locate one replacement range without mutating the current fold state. */
function replacementRange(state, op) {
    const startIdx = state.nodes.indexOf(op.startSeq);
    if (startIdx === -1) {
        throw new Error(`surface replace: start seq ${op.startSeq} not found in surface`);
    }
    const endIdx = state.nodes.indexOf(op.endSeq);
    if (endIdx === -1) {
        throw new Error(`surface replace: end seq ${op.endSeq} not found in surface`);
    }
    if (startIdx > endIdx) {
        throw new Error(`surface replace: start seq ${op.startSeq} (index ${startIdx}) is after end seq ${op.endSeq} (index ${endIdx})`);
    }
    return {
        startIdx,
        endIdx,
        shadowedSeqs: state.nodes.slice(startIdx, endIdx + 1),
    };
}
/**
 * Deep structural equality over the session-event JSON value domain
 * (null/boolean/number/string, arrays, plain objects). Replaces
 * `node:util`'s isDeepStrictEqual to keep this module browser-safe.
 */
function isDeepEqualJson(a, b) {
    if (a === b)
        return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
            return false;
        return a.every((item, i) => isDeepEqualJson(item, b[i]));
    }
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
        return false;
    const aKeys = Object.keys(a);
    const bRecord = b;
    if (aKeys.length !== Object.keys(b).length)
        return false;
    return aKeys.every(key => Object.hasOwn(b, key) && isDeepEqualJson(a[key], bRecord[key]));
}
/** Restrict a tool-result replacement to one current result's content. */
function assertToolResultRewrite(event, shadowedSeqs, events, baseSeq) {
    if (event.type !== 'tool/result')
        return;
    if (shadowedSeqs.length !== 1) {
        throw new Error('tool/result surface replacement must rewrite exactly one current node');
    }
    for (const originalSeq of shadowedSeqs) {
        const original = events[originalSeq - baseSeq];
        if (original?.type !== 'tool/result') {
            throw new Error('tool/result surface replacement must target a current tool/result');
        }
        const originalRest = { ...original.data };
        const replacementRest = { ...event.data };
        originalRest['message'] = {
            ...original.data.message,
            content: null,
        };
        replacementRest['message'] = {
            ...event.data.message,
            content: null,
        };
        if (!isDeepEqualJson(originalRest, replacementRest)) {
            throw new Error('tool/result surface replacement may change only content');
        }
    }
}
/**
 * Protect the system prompt at surface node 0. A replacement covering node 0
 * while that node is a `system/message` must itself be a `system/message` over
 * exactly that node; later system nodes carry no protection and a compaction
 * range may shadow them.
 */
function assertSystemHeadRewrite(event, state, startIdx, shadowedSeqs, events, baseSeq) {
    if (startIdx !== 0)
        return;
    const head = events[state.nodes[0] - baseSeq];
    if (head?.type !== 'system/message')
        return;
    if (event.type !== 'system/message' || shadowedSeqs.length !== 1) {
        throw new Error('surface replace: node 0 holds the system prompt and may be rewritten only by a system/message over exactly that node');
    }
}
/** Validate one event at its replay boundary and prepare its atomic fold transition. */
function planSurfaceEvent(state, event, expectedSeq, events, baseSeq, projections) {
    if (event.seq !== expectedSeq) {
        throw new Error(`session event seq ${event.seq} is not contiguous; expected ${expectedSeq}`);
    }
    const surfaceOp = validateSurfaceMetadata(event);
    assertDeveloperHeader(event, events, baseSeq);
    const projection = projections.find(item => item.type === event.type);
    if (projection !== undefined) {
        return { kind: 'project', projection, messages: projection.project(event, {
                nodes: state.nodes, events, baseSeq, messages: state.projectedMessages,
            }) };
    }
    if (MESSAGE_PROJECTION_EVENT_TYPES.has(event.type)) {
        throw new Error(`session event "${event.type}" requires a message projection; load its owning plugin or supply its projection definition`);
    }
    if (surfaceOp === undefined)
        return;
    if (surfaceOp === 'append') {
        return { kind: 'append', seq: event.seq };
    }
    const range = replacementRange(state, surfaceOp);
    assertSourceEventReferences(event, range.shadowedSeqs);
    assertToolResultRewrite(event, range.shadowedSeqs, events, baseSeq);
    assertSystemHeadRewrite(event, state, range.startIdx, range.shadowedSeqs, events, baseSeq);
    return {
        kind: 'replace',
        seq: event.seq,
        start: surfaceOp.startSeq,
        end: surfaceOp.endSeq,
        ...range,
    };
}
/** Apply one event and return replacement metadata only when one occurred. */
function applySurfaceEvent(state, event, expectedSeq, events, baseSeq, projections) {
    const plan = planSurfaceEvent(state, event, expectedSeq, events, baseSeq, projections);
    return applySurfacePlan(state, plan);
}
/** Commit one previously validated surface transition. */
function applySurfacePlan(state, plan) {
    if (plan?.kind === 'append') {
        state.nodes.push(plan.seq);
    }
    else if (plan?.kind === 'replace') {
        state.nodes.splice(plan.startIdx, plan.endIdx - plan.startIdx + 1, plan.seq);
        state.replaceGeneration += 1;
        state.contentGeneration += 1;
    }
    else if (plan?.kind === 'project') {
        for (const [seq, message] of plan.messages)
            state.projectedMessages.set(seq, message);
        state.projections.add(plan.projection);
        state.contentGeneration += 1;
    }
    if (plan?.kind !== 'replace')
        return;
    return {
        seq: plan.seq,
        start: plan.start,
        end: plan.end,
        shadowedSeqs: plan.shadowedSeqs,
    };
}
/**
 * Replay a complete session log through the canonical surface fold.
 * @param events - session events in contiguous seq order.
 * @param projections - pure interpreters for plugin-owned message changes; required definitions must be supplied.
 * @returns detached current sequences and replacement history.
 * @throws when an interpreter is missing or an event violates its projection, surface metadata, source attribution, or replacement rules.
 */
export function foldSurface(events, projections = []) {
    const state = createFoldState();
    const replacements = [];
    for (const [index, event] of events.entries()) {
        const replacement = applySurfaceEvent(state, event, SessionSeq(index), events, SessionLogOffset(0), projections);
        if (replacement !== undefined)
            replacements.push(replacement);
    }
    return { nodes: [...state.nodes], replacements, projectedMessages: new Map(state.projectedMessages) };
}
/** Incremental ordered surface view and append-boundary validator. */
export class SurfaceManager {
    log;
    baseSeq;
    projections;
    /** Shared transition state; replacement history is not retained. */
    _state = createFoldState();
    /** Last processed absolute seq. */
    _lastProcessedSeq;
    /** Candidate already validated by `validateNext`, pending exact log admission. */
    _pendingPlan;
    /**
     * @param log - Contiguous complete log or loaded event window.
     * @param baseSeq - Absolute sequence of the window's first event.
     * @param projections - live borrowed definitions; removing a used definition invalidates further reads.
     */
    constructor(log, baseSeq = SessionLogOffset(0), projections = []) {
        this.log = log;
        this.baseSeq = baseSeq;
        this.projections = projections;
        this._lastProcessedSeq = baseSeq === 0 ? -1 : SessionSeq(baseSeq - 1);
    }
    /**
     * Validate the next candidate without mutating the committed surface.
     * @param event - candidate event that has not entered the log yet.
     */
    validateNext(event) {
        this._assertProjections();
        if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1)
            this._processDelta();
        const expectedSeq = SessionSeq(this.baseSeq + this.log.length);
        this._pendingPlan = {
            event,
            expectedSeq,
            plan: planSurfaceEvent(this._state, event, expectedSeq, this.log, this.baseSeq, this.projections),
        };
    }
    /** Monotonic count of folded positional replacements. */
    get replaceGeneration() {
        this._assertProjections();
        if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1)
            this._processDelta();
        return this._state.replaceGeneration;
    }
    /** Monotonic count of committed changes to existing model-visible content. */
    get contentGeneration() {
        this._assertProjections();
        if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1)
            this._processDelta();
        return this._state.contentGeneration;
    }
    /**
     * Project one message with every committed message projection applied.
     * @param event - message-producing or log-only event.
     * @returns its immutable projected message, or null when it produces none.
     */
    deriveEventMessage(event) {
        this._assertProjections();
        if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1)
            this._processDelta();
        return deriveEventMessage(event, this._state.projectedMessages);
    }
    /** Surface event sequences in model-visible order. */
    get nodes() {
        this._assertProjections();
        if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1)
            this._processDelta();
        return this._state.nodes;
    }
    /** Fold events appended since the previous access. */
    _processDelta() {
        const tailSeq = this.baseSeq + this.log.length - 1;
        for (let seq = this._lastProcessedSeq + 1; seq <= tailSeq; seq++) {
            const index = seq - this.baseSeq;
            // oxlint-disable-next-line typescript/no-non-null-assertion -- bounded by the loop condition
            const event = this.log[index];
            const pending = this._pendingPlan;
            if (pending?.event === event && pending.expectedSeq === seq) {
                applySurfacePlan(this._state, pending.plan);
            }
            else {
                applySurfaceEvent(this._state, event, SessionSeq(seq), this.log, this.baseSeq, this.projections);
            }
            if (pending !== undefined && pending.expectedSeq <= seq)
                this._pendingPlan = undefined;
            this._lastProcessedSeq = SessionSeq(seq);
        }
    }
    /** Cached messages cannot outlive the definitions that interpreted their log. */
    _assertProjections() {
        const candidate = this._pendingPlan;
        const pending = candidate !== undefined && this.log[candidate.expectedSeq - this.baseSeq] === candidate.event
            ? candidate.plan : undefined;
        const required = pending?.kind === 'project'
            ? [...this._state.projections, pending.projection]
            : this._state.projections;
        for (const projection of required) {
            if (!this.projections.includes(projection)) {
                throw new Error(`session message projection "${projection.type}" was removed or replaced; restore the session with its owning plugin`);
            }
        }
    }
}
