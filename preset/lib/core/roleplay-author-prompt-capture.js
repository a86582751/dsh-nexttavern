// Generated from runtime/alpha3/src/core/roleplay-author-prompt-capture.ts; edit the TypeScript source.
/** The input owner supplies completed Native history and Source-bound scopes.
 * This projection creates readonly worker DATA, never an execution lease. */
import { recordSha256 } from './roleplay-data.js';
import { schemaScopeEmpty, schemaScopeOwner } from './roleplay-mvu-schema-scope-facts.js';
import { applyAuthorChatOverlayV3 } from './roleplay-author-chat-state-types.js';
/** One row's effective ordinary DATA. stat_data remains the MVU owner's fact;
 * a message tombstone cannot erase an earlier row in getAllVariables. */
export function authorOrdinaryMessageVariablesV1(variables, capture) {
    const base = variables.kind === 'available' ? variables.variables : {}, values = capture ? applyAuthorChatOverlayV3(base, capture) : base, { stat_data: _ordinaryStat, ...effective } = values;
    if (Object.hasOwn(base, 'stat_data'))
        effective.stat_data = base.stat_data;
    return effective;
}
/** Index identity DATA once; body versions and author swipe positions never
 * enter ordinary addresses. A pending input has no address in this view. */
export function authorOrdinaryMessageSelectionV1(captures, opening) {
    const byMessage = new Map();
    // This actual visible Native cut has one row per seq/id. MVU publication
    // owners may be children; ordinary addresses retain their Native birth owner.
    const key = (row) => JSON.stringify([row.nativeSeq, row.messageId]);
    for (const capture of captures) {
        const target = capture.root.namespace.target;
        if (!target)
            continue;
        const address = key(target.identity), rows = byMessage.get(address) ?? [];
        rows.push(target);
        byMessage.set(address, rows);
    }
    return (row) => {
        if (row.nativeSeq === null)
            return;
        const variants = byMessage.get(key(row));
        if (!variants)
            return;
        const selectedTarget = variants.find(target => row.messageId === opening.messageId && opening.ordinaryVariants
            ? target.identity.variant.kind === 'opening-variant' && target.identity.variant.id === opening.ordinaryVariants.activeVariantId
            : target.identity.variant.kind === 'native-canonical');
        return selectedTarget ? { selectedTarget, variants } : undefined;
    };
}
export function produceAuthorPromptCaptureV1(input) {
    const { history, scopes, opening } = input;
    // Compatibility position zero is the proven program opening. Import-tool
    // dialogue before that anchor is not story history for an author callback.
    const refs = [...history.data.rows, ...history.data.pendingRows];
    const start = refs.findIndex(row => row.id === opening.messageId);
    if (start < 0)
        throw Error('PROMPT_PROGRAM_OPENING_INDEX_UNAVAILABLE');
    const scopeById = new Map(scopes.messages.map(row => [row.messageId, row]));
    const ordinaryFor = authorOrdinaryMessageSelectionV1(input.ordinaryMessages ?? [], opening);
    const messages = refs.slice(start).map((ref, index) => {
        const content = history.scanRows[start + index];
        const scoped = scopeById.get(ref.id);
        let variables, ownerSessionId;
        if (ref.seq === null) {
            // The real pending player input has not published a message state.
            // Its null sequence is retained; no synthetic Native event is invented.
            ownerSessionId = history.data.sessionId;
            variables = schemaScopeEmpty(schemaScopeOwner(scopes.source, 'message', ref.id, ownerSessionId));
        }
        else if (scoped && scoped.messageVersionSha256 === ref.messageSha256) {
            ownerSessionId = scoped.ownerSessionId;
            variables = scoped.variables;
        }
        else
            throw Error('PROMPT_PROGRAM_MESSAGE_SCOPE_UNAVAILABLE');
        const ordinary = ordinaryFor({ messageId: ref.id, ownerSessionId, nativeSeq: ref.seq });
        return { index, messageId: ref.id, ownerSessionId, nativeSeq: ref.seq, ...ordinary ? { ordinary } : {},
            messageVersionSha256: ref.messageSha256, role: ref.role, message: content.text, variables,
            variants: index === 0 && ref.messageSha256 === opening.originalMessageVersionSha256
                ? opening.copiedCandidates : null };
    });
    const body = { schemaVersion: 1, encoding: 'native-author-prompt-capture-v1',
        authority: 'consumer-data-only', sessionId: history.data.sessionId,
        sourceSnapshotSha256: scopes.source.sourceSnapshotSha256, nativeCut: history.data.nativeCut,
        nativePrefixSha256: history.data.nativePrefixSha256, attemptId: input.attemptId,
        clockEpochMs: input.clockEpochMs, randomSeed: input.randomSeed, messages, scopeFrame: scopes,
        ...input.ordinaryChat ? { ordinaryChat: input.ordinaryChat } : {},
        ...input.ordinaryMessages ? { ordinaryMessages: input.ordinaryMessages } : {} };
    return { ...body, captureSha256: recordSha256(body) };
}
