// Generated from runtime/alpha3/compat/session-format/src/author-generation-effects.ts; edit the TypeScript source.
export const AUTHOR_GENERATION_EFFECTS_EVENT = 'roleplay/author-generation-effects';
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && value.length > 0;
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const eventRef = (value) => object(value) && integer(value.seq) && sha(value.sha256);
const dataRef = (value) => object(value) && id(value.key) && sha(value.sha256);
const identity = (value, root) => object(value) && value.kind === 'author-generation'
    && value.rootSessionId === root && sha(value.planSha256)
    && ['taskId', 'generation', 'operationId', 'generationId', 'childSessionId', 'messageId'].every(key => id(value[key]));
export function assertAuthorGenerationEffects(value) {
    if (!object(value) || value.schemaVersion !== 1 || value.encoding !== 'native-author-generation-effects-v1'
        || !id(value.rootSessionId))
        throw Error('AUTHOR_GENERATION_EFFECTS_INVALID');
    if (value.kind === 'accepted') {
        const checkpoint = value.checkpoint;
        if (identity(value.identity, value.rootSessionId) && object(checkpoint)
            && eventRef(checkpoint.headerRef) && eventRef(checkpoint.materialRef) && integer(checkpoint.turn) && integer(checkpoint.step)
            && dataRef(value.snapshotRef) && dataRef(value.planRef) && (value.effects === 'source' || value.effects === 'readonly'))
            return;
    }
    else if (value.kind === 'settled' && eventRef(value.acceptedRef))
        return;
    else if (value.kind === 'terminal' && eventRef(value.acceptedRef)) {
        const terminal = value.terminal;
        if (object(terminal) && identity(terminal.identity, value.rootSessionId) && eventRef(terminal.turnEndRef)
            && integer(terminal.turn) && object(terminal.reason)
            && ['completed', 'max-tokens', 'error', 'aborted', 'blocked'].includes(String(terminal.reason.kind)))
            return;
    }
    throw Error('AUTHOR_GENERATION_EFFECTS_INVALID');
}
export function appendAuthorGenerationEffects(session, marker) {
    if (marker.rootSessionId !== session.id)
        throw Error('AUTHOR_GENERATION_EFFECTS_ROOT_CHANGED');
    return session.append(AUTHOR_GENERATION_EFFECTS_EVENT, marker);
}
export const authorGenerationEffectsMarkers = Object.freeze({ eventType: AUTHOR_GENERATION_EFFECTS_EVENT,
    append: appendAuthorGenerationEffects, assert: assertAuthorGenerationEffects });
