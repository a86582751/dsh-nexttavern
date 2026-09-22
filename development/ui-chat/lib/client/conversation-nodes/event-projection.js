// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/event-projection.ts; edit the TypeScript source.
/** Chat-owned conversion from durable Session events to Chat view data. */
/* jscpd:ignore-start -- Chat and Trajectory own independent event-to-view projections. */
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function readString(record, key) {
    const value = record[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function collect(source, member, field) {
    const list = source[member];
    if (!Array.isArray(list))
        return [];
    const seen = [];
    for (const entry of list) {
        const record = asRecord(entry);
        const value = record === null ? null : readString(record, field);
        if (value !== null && !seen.includes(value))
            seen.push(value);
    }
    return seen;
}
function joined(names) {
    return names.length > 0 ? names.join(', ') : null;
}
/** Forms Chat presents structurally; unknown merge-extensible values remain opaque. */
const KNOWN_FORMS = [
    'instructions', 'catalog', 'snapshot', 'notice', 'relay', 'recall',
];
/**
 * Read the target-supported presentation form from a durable message source.
 * @param source - Logged `user/message` source.
 * @returns Supported form, or null for the opaque presentation.
 */
export function contextForm(source) {
    const record = asRecord(source);
    const form = record === null ? null : readString(record, 'form');
    return form !== null && KNOWN_FORMS.includes(form)
        ? form
        : null;
}
/**
 * Project a durable message source to the Chat row's role and producer label.
 * @param source - Logged `user/message` source.
 * @returns Role and label rendered by Chat.
 */
export function contextProducer(source) {
    const record = asRecord(source);
    const kind = record === null ? null : readString(record, 'kind');
    if (record === null || kind === null)
        return { role: 'inject', label: null };
    switch (kind) {
        case 'session-reference':
            return { role: 'recall', label: joined(collect(record, 'references', 'label')) ?? kind };
        case 'agent-instructions':
            return { role: 'inject', label: joined(collect(record, 'changes', 'path')) ?? kind };
        case 'skill-invocation':
            return { role: 'inject', label: readString(record, 'name') ?? kind };
        default:
            // MessageSourceMap is merge-extensible; keep an unknown producer
            // visible by its durable kind.
            return { role: 'inject', label: kind };
    }
}
/**
 * Read distinct labels cited by a durable cross-session recall source.
 * @param source - Logged `user/message` source.
 * @returns Labels in first-seen order.
 */
export function sessionRecallLabels(source) {
    const record = asRecord(source);
    if (record === null || readString(record, 'kind') !== 'session-reference')
        return [];
    return collect(record, 'references', 'label');
}
/**
 * Read the skill name a durable skill-invocation injection loaded.
 * @param source - Logged `user/message` source.
 * @returns The skill name, or null for every other source.
 */
export function skillInvocationName(source) {
    const record = asRecord(source);
    if (record === null || readString(record, 'kind') !== 'skill-invocation')
        return null;
    return readString(record, 'name');
}
/**
 * Classify finalized Assistant content for Chat rendering.
 * @param content - Core content blocks.
 * @returns Chat blocks in source order.
 */
export function toAssistantBlocks(content) {
    return content.map(toAssistantBlock);
}
/**
 * Classify one finalized Assistant block for Chat rendering.
 * @param block - Core content block.
 * @returns Chat block.
 */
export function toAssistantBlock(block) {
    switch (block.type) {
        case 'text': return { kind: 'text', text: block.text };
        case 'reasoning': return { kind: 'reasoning', text: block.text };
        case 'image': return { kind: 'image', attachment: block.attachment };
        case 'tool-call': return { kind: 'tool-call', callId: String(block.id), name: block.name, argsRaw: block.arguments };
        default: return { kind: 'other', block };
    }
}
/**
 * Create the initial Chat block for one streamed Assistant block kind.
 * @param blockType - Wire block kind.
 * @returns Empty block ready to receive deltas.
 */
export function emptyAssistantBlock(blockType) {
    switch (blockType) {
        case 'text': return { kind: 'text', text: '' };
        case 'reasoning': return { kind: 'reasoning', text: '' };
        case 'tool-call': return { kind: 'tool-call', callId: '', name: '', argsRaw: '' };
        default: return { kind: 'other', block: null };
    }
}
/**
 * Convert a durable failure to locale-independent fields safe for Chat.
 * @param failure - Failure preserved by a Session event.
 * @returns Sanitized message and optional stable provider code.
 */
export function displayFailure(failure) {
    if (failure === null || typeof failure !== 'object')
        return { message: String(failure) };
    const record = failure;
    const code = typeof record.code === 'string' ? record.code : undefined;
    // Provider AUTH messages may echo a masked or partially preserved credential.
    // Keep the raw diagnostic in the Session log, but never retain it in UI state.
    if (code === 'AUTH')
        return { code, message: '' };
    return {
        ...(code === undefined ? {} : { code }),
        message: typeof record.message === 'string' ? record.message : JSON.stringify(failure),
    };
}
/**
 * Whether a stream chunk carries visible model output for Chat timing.
 * @param chunk - Stream chunk to inspect.
 * @returns true for a non-empty text, reasoning, or Tool-call delta.
 */
export function isTokenDelta(chunk) {
    switch (chunk.type) {
        case 'text-delta':
        case 'reasoning-delta':
            return chunk.text !== '';
        case 'tool-call-delta':
            return chunk.argumentsDelta !== '' || chunk.name !== undefined;
        default:
            return false;
    }
}
/* jscpd:ignore-end */
