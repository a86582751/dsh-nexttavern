// Generated from runtime/alpha3/src/core/roleplay-reader-worldbook-context.ts; edit the TypeScript source.
/** Reader-only selected-message DATA. Source/Native capture owners have already
 * authenticated these facts; this adapter neither prepares Main nor owns effects. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { applyAuthorChatOverlayV3 } from './roleplay-author-chat-state-types.js';
export const READER_SELECTED_MESSAGE_CACHE_POLICY_V1 = 'reader-selected-message-cache-v1';
/** No whole-frame/history identity is used for a variable binding. Each scope
 * carries its actual owner publication, including inherited message owners. */
function scopeBinding(scope, fact) {
    if (fact.kind !== 'available')
        return;
    return { scope, ownerId: fact.provenance.owner.identity, versionSha256: recordSha256(fact.provenance),
        values: fact.variables, valuesSha256: fact.variablesSha256 };
}
export function createReaderWorldbookTargetCaptureV1(input) {
    const { source, snapshot, row, lore, macros, clockEpochMs } = input, policy = READER_SELECTED_MESSAGE_CACHE_POLICY_V1;
    if (!Number.isSafeInteger(clockEpochMs) || Math.abs(clockEpochMs) > 8640000000000000)
        return { kind: 'unsupported', code: 'READER_WORLDBOOK_CLOCK_UNAVAILABLE' };
    const matches = snapshot.messages.filter(message => message.nativeSeq === row.seq && message.messageId === row.messageId
        && message.messageVersionSha256 === row.messageVersionSha256);
    if (matches.length !== 1)
        return { kind: 'unsupported', code: 'READER_WORLDBOOK_TARGET_UNAVAILABLE' };
    const message = matches[0], facts = snapshot.scopeFrame.messages.filter(fact => fact.ownerSessionId === message.ownerSessionId
        && fact.nativeSeq === message.nativeSeq && fact.messageId === message.messageId
        && fact.messageVersionSha256 === message.messageVersionSha256);
    if (facts.length !== 1)
        return { kind: 'unsupported', code: 'READER_WORLDBOOK_TARGET_UNAVAILABLE' };
    const selected = facts[0], last = snapshot.messages.at(-1), target = {
        sessionId: source.sessionId, messageId: message.messageId, messageVersionSha256: message.messageVersionSha256,
        seq: row.seq, index: message.index, swipeId: message.variants?.swipe_id ?? 0,
        role: selected.isSystem ? 'system' : message.role, depth: row.depth, isLast: last === message
    };
    const raw = snapshot.scopeFrame.scopes, ordinary = snapshot.ordinaryChat, global = scopeBinding('global', raw.global), card = scopeBinding('card', raw.character), baseChat = scopeBinding('chat', raw.chat), messageScope = scopeBinding('message', selected.variables), scopes = [];
    if (global)
        scopes.push(global);
    if (card)
        scopes.push(card);
    if (baseChat) {
        if (Object.keys(ordinary.values).length || ordinary.deletedKeys?.length) {
            const values = applyAuthorChatOverlayV3(baseChat.values, ordinary);
            scopes.push({ ...baseChat, values, valuesSha256: recordSha256(values),
                versionSha256: recordSha256({ policy, base: baseChat.versionSha256, ordinaryRoot: ordinary.root }) });
        }
        else
            scopes.push(baseChat);
    }
    if (messageScope)
        scopes.push(messageScope);
    if (global && baseChat && messageScope) {
        const manual = target.isLast && raw.chat.kind === 'available' && raw.chat.provenance.kind === 'published-state'
            && raw.chat.provenance.state.kind === 'manual'
            && (snapshot.numerical.kind === 'ready' || snapshot.numerical.kind === 'schema-ready')
            && raw.chat.provenance.state.revision === snapshot.numerical.expected.revision
            && Object.hasOwn(raw.chat.variables, 'stat_data') ? raw.chat : null;
        // This deliberately omits initial/trace. The final overlay applies once
        // after all Native layers so a tombstone cannot revive an older value.
        const values = applyAuthorChatOverlayV3({ ...global.values, ...baseChat.values, ...messageScope.values,
            ...manual ? { stat_data: manual.variables.stat_data } : {} }, ordinary);
        scopes.push({ scope: 'cache', ownerId: `${source.sessionId}:${policy}:${message.ownerSessionId}:${message.messageId}`,
            versionSha256: recordSha256({ policy, global: global.versionSha256, chat: baseChat.versionSha256,
                selected: { owner: message.ownerSessionId, seq: message.nativeSeq, id: message.messageId,
                    version: message.messageVersionSha256, variables: messageScope.versionSha256 },
                manual: manual?.provenance ?? null, ordinaryRoot: ordinary.root }), values, valuesSha256: recordSha256(values) });
    }
    const turnId = `reader:${message.ownerSessionId}:${row.seq}:${message.messageId}`, randomSeed = `${source.sourceSha256}:${message.messageVersionSha256}`, body = { schemaVersion: 1, encoding: 'owned-template-frozen-snapshot-v1',
        authority: 'consumer-data-only', sessionId: source.sessionId, branchId: source.sessionId,
        revision: snapshot.numerical.kind === 'ready' || snapshot.numerical.kind === 'schema-ready'
            ? snapshot.numerical.expected.revision : snapshot.basis.nativeCut,
        turnId, attemptId: `${turnId}:cut:${snapshot.basis.nativeCut}:${message.messageVersionSha256}`,
        packageSha256: source.original.documentSha256, sourceSnapshotSha256: source.sourceSha256,
        stateSnapshotSha256: snapshot.basis.numericalSnapshotSha256, defaultVariableScope: 'cache',
        scopes, scopesSha256: recordSha256(scopes), lore, loreSha256: input.loreSha256 ?? recordSha256(lore),
        clockEpochMs, randomSeed, randomSeedSha256: sha256(randomSeed) };
    // These fields come from the authenticated Source/Native owners above. The
    // protected runtime validates its incoming DATA at its execution boundary.
    const frozen = { ...body, snapshotSha256: recordSha256(body) }, names = { user: snapshot.persona.name, char: snapshot.character?.name ?? source.current.openingContext.context.char };
    const targetMacros = { ...macros, variableScopes: { ...macros.variableScopes, message: messageScope ?? null } };
    return { kind: 'captured', policy, target, capture: { snapshot: frozen, macros: targetMacros,
            ...input.presetCatalog ? { presetCatalog: input.presetCatalog } : {},
            resources: lore.map(entry => ({ id: entry.key, sourcePointer: entry.sourcePointer,
                sourceSnapshotSha256: entry.sourceSnapshotSha256, contentSha256: entry.contentSha256,
                text: entry.content, loreKey: entry.key })),
            context: { user: names.user, char: names.char, messages: snapshot.messages.map(item => {
                    const role = item === message ? target.role : item.role;
                    return { messageId: item.messageId, role, content: item.message, mes: item.message, is_user: role === 'user',
                        name: role === 'user' ? names.user : names.char };
                }), message_id: target.index, messageId: target.messageId,
                swipe_id: target.swipeId, depth: target.depth, is_user: target.role === 'user', is_system: target.role === 'system',
                is_last: target.isLast }, ordinaryNamespace: { root: ordinary.root, values: ordinary.values },
            ordinaryMessageView: { messages: snapshot.messages.map(item => ({ index: item.index, messageId: item.messageId,
                    ownerSessionId: item.ownerSessionId, nativeSeq: item.nativeSeq, messageVersionSha256: item.messageVersionSha256,
                    role: item.role, variables: item.variables, ...item.ordinary ? { ordinary: item.ordinary } : {},
                    ...item.variants?.swipes_data ? { variantVariables: item.variants.swipes_data } : {} })),
                captures: snapshot.ordinaryMessages ?? [], current: { message_id: target.index, swipe_id: target.swipeId } } } };
}
