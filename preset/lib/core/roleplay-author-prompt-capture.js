// Generated from runtime/alpha3/src/core/roleplay-author-prompt-capture.ts; edit the TypeScript source.
/** The input owner supplies completed Native history and Source-bound scopes.
 * This projection creates readonly worker DATA, never an execution lease. */
import { recordSha256 } from './roleplay-data.js';
import { schemaScopeEmpty, schemaScopeOwner } from './roleplay-mvu-schema-scope-facts.js';
/** The same actual Source owns both script namespaces. Project the compiled
 * Prompt members from that captured frame without another Native/table read. */
export function produceAuthorPromptScopeFrameV1(frame, program) {
    const { frameSha256: _old, ...sourceFrame } = frame;
    const body = { ...sourceFrame, scripts: program.scripts.map(({ descriptor }) => ({
            scriptId: descriptor.identity, pointer: descriptor.pointer, sourceSha256: descriptor.sourceSha256,
            variables: schemaScopeEmpty(schemaScopeOwner(frame.source, 'script', descriptor.identity)),
        })) };
    return { ...body, frameSha256: recordSha256(body) };
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
        return { index, messageId: ref.id, ownerSessionId, nativeSeq: ref.seq,
            messageVersionSha256: ref.messageSha256, role: ref.role, message: content.text, variables,
            variants: index === 0 && ref.messageSha256 === opening.originalMessageVersionSha256
                ? opening.copiedCandidates : null };
    });
    const body = { schemaVersion: 1, encoding: 'native-author-prompt-capture-v1',
        authority: 'consumer-data-only', sessionId: history.data.sessionId,
        sourceSnapshotSha256: scopes.source.sourceSnapshotSha256, nativeCut: history.data.nativeCut,
        nativePrefixSha256: history.data.nativePrefixSha256, attemptId: input.attemptId,
        clockEpochMs: input.clockEpochMs, randomSeed: input.randomSeed, messages, scopeFrame: scopes };
    return { ...body, captureSha256: recordSha256(body) };
}
