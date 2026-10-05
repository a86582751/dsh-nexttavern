// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-scope-facts.ts; edit the TypeScript source.
/** Deterministic formatting of already proven Source/Native/state facts.
 * These JSON records describe reads; their hashes never create a write lease.
 * Core supplies a completed verified fold before exposing any of its values. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { surfaceEntries } from './roleplay-context.js';
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
import { compileSchemaMvuInitData } from './tavern-mvu-initvar.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
const scopePolicy = { schemaVersion: 1, id: 'native-mvu-published-scope-policy-v1',
    initializationChat: 'configured-book-baseline', storyChat: 'configured-message-publication', manualScope: 'chat',
    newMessage: 'empty-until-publication', otherScopes: 'session-source-owned-empty' };
export const MVU_SCHEMA_SCOPE_POLICY_V1 = Object.freeze({ ...scopePolicy, sha256: recordSha256(scopePolicy) });
function fail(code) { throw Error(code); }
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
export function schemaScopeOwner(source, scope, identity = scope, sessionId = source.sessionId) {
    return { namespace: 'session-source', sessionId, sourceRecordSessionId: source.sourceRecordSessionId,
        importId: source.importId, scope, identity };
}
export function schemaScopeEmpty(owner) {
    return { kind: 'available', variables: {}, variablesSha256: recordSha256({}),
        provenance: { kind: 'initialized-empty', owner, revision: 0 } };
}
export function schemaScopeReowner(variables, owner) {
    return variables.kind === 'unavailable' ? variables : { ...variables, provenance: { ...variables.provenance, owner } };
}
export function schemaScopePublished(owner, input, values, context) {
    if (Object.hasOwn(context, 'stat_data') || recordSha256(values) !== input.valuesSha256)
        fail('SCHEMA_SCOPE_STATE_UNPROVEN');
    const variables = cloneSchemaData({ ...context, stat_data: values }, 1_048_576);
    const variablesSha256 = recordSha256(variables);
    // This stable scope-state summary references the immutable publication row.
    // It does not hash today's mutable Source currency or current numerical head.
    const snapshotSha256 = recordSha256({ schemaVersion: 1, encoding: 'native-mvu-published-scope-state-v1',
        ...input, variablesSha256 });
    return { kind: 'available', variables, variablesSha256,
        provenance: { kind: 'published-state', owner, state: { ...input, snapshotSha256 } } };
}
function pointerValue(document, pointer) {
    if (pointer === '')
        return document;
    if (!pointer.startsWith('/') || /~(?![01])/.test(pointer))
        fail('SCHEMA_SCOPE_CONFIG_UNPROVEN');
    let value = document;
    for (const encoded of pointer.slice(1).split('/')) {
        const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
        if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
            fail('SCHEMA_SCOPE_CONFIG_UNPROVEN');
        value = value[key];
    }
    return value;
}
/** Fixed MVU default is false. A disabled embedded primary config_override
 * entry is data, never a prompt or guest module. All selected bytes remain
 * bound to the original Source snapshot; opaque uploaded scopes are ignored. */
export function schemaScopeConfiguration(snapshot, material) {
    const card = material.card;
    if (!object(card) || recordSha256(card) !== snapshot.documentSha256)
        fail('SCHEMA_SCOPE_CONFIG_UNPROVEN');
    const primary = snapshot.bindings.primary;
    let pointer = null, contentSha256 = null, updateChat = false;
    if (primary) {
        const book = pointerValue(card, primary.pointer);
        const native = card.spec === 'nexttavern_card';
        if (!object(book) || !(Array.isArray(book.entries) || native && object(book.entries))
            || recordSha256(book) !== primary.sha256) {
            fail('SCHEMA_SCOPE_CONFIG_UNPROVEN');
        }
        const matches = Object.entries(book.entries).map(([key, raw]) => ({ raw, key })).filter(({ raw }) => object(raw)
            && (raw.enabled === false || raw.disable === true)
            && String(raw.comment ?? raw.name ?? '').trim().toLowerCase() === '[config_override]');
        // Array or native object enumeration preserves the author's first disabled
        // override. Its pointer keeps the original key, independently of identity.
        if (matches.length) {
            const { raw, key } = matches[0];
            if (!object(raw) || typeof raw.content !== 'string' || Buffer.byteLength(raw.content, 'utf8') > 1_048_576) {
                fail('SCHEMA_SCOPE_CONFIG_INVALID');
            }
            let config;
            try {
                config = cloneSchemaData(JSON.parse(raw.content), 1_048_576);
            }
            catch {
                fail('SCHEMA_SCOPE_CONFIG_INVALID');
            }
            if (!object(config))
                fail('SCHEMA_SCOPE_CONFIG_INVALID');
            const compatibility = config['兼容性'];
            if (compatibility !== undefined) {
                if (!object(compatibility))
                    fail('SCHEMA_SCOPE_CONFIG_INVALID');
                const option = compatibility['更新到聊天变量'];
                if (option !== undefined && typeof option !== 'boolean')
                    fail('SCHEMA_SCOPE_CONFIG_INVALID');
                updateChat = option === true;
            }
            pointer = primary.pointer + '/entries/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
            contentSha256 = sha256(raw.content);
        }
    }
    const body = { schemaVersion: 1, encoding: 'native-mvu-scope-configuration-v1',
        policySha256: MVU_SCHEMA_SCOPE_POLICY_V1.sha256, documentSha256: snapshot.documentSha256,
        primaryPointer: primary?.pointer ?? null, pointer, contentSha256, updateChat };
    return Object.freeze({ ...body, configurationSha256: recordSha256(body) });
}
export function schemaScopeSource(snapshot, sessionId = snapshot.source.sessionId) {
    const source = snapshot.source;
    return { sessionId, sourceRecordSessionId: source.sourceRecordSessionId, importId: source.importId,
        rawSha256: source.rawSha256, sourceSnapshotSha256: snapshot.snapshotSha256 };
}
export function schemaScopeInitialChat(preparation, material, originalCut, source = schemaScopeSource(preparation.sourceSnapshot)) {
    const owner = schemaScopeOwner(source, 'chat');
    const configuration = schemaScopeConfiguration(preparation.sourceSnapshot, material);
    const parsed = compileSchemaMvuInitData(preparation.initSource);
    if (parsed.kind !== 'parsed' || originalCut.sessionId !== preparation.identity.sessionId
        || originalCut.ownerSessionId !== preparation.identity.sessionId || originalCut.materialSha256 !== recordSha256(material)
        || originalCut.sourceSnapshotSha256 !== preparation.sourceSnapshot.snapshotSha256
        || originalCut.nativePrefixSha256 !== preparation.freshNativeBasisProof.native.historyVersionSha256
        || originalCut.nativeCut !== preparation.freshNativeBasisProof.native.observedThroughSeq + 1
        || !same(originalCut.anchor, preparation.selector.anchor))
        fail('SCHEMA_SCOPE_BASELINE_UNPROVEN');
    if (!configuration.updateChat)
        return schemaScopeEmpty(owner);
    const baseline = parsed.baseline, initialized = {};
    for (const identity of baseline.initializedBooks)
        initialized[identity] = true;
    const variables = { initialized_lorebooks: initialized, stat_data: baseline.statData };
    return { kind: 'available', variables, variablesSha256: recordSha256(variables), provenance: {
            kind: 'initialization-baseline', owner, initialization: { ownerSessionId: preparation.identity.sessionId,
                operationId: preparation.identity.operationId, preparationSha256: preparation.preparationSha256,
                initSourceSha256: preparation.initSource.initSourceSha256, sourceSnapshotSha256: preparation.sourceSnapshot.snapshotSha256,
                freshBasisProofSha256: preparation.freshNativeBasisProof.proofSha256,
                initialSourceNativeCutSha256: recordSha256(originalCut), policySha256: MVU_SCHEMA_SCOPE_POLICY_V1.sha256,
                configurationSha256: configuration.configurationSha256, baselineSha256: recordSha256(baseline),
                valuesSha256: baseline.dataSha256 }
        } };
}
export function buildSchemaScopeReadFrame(source, cutSha256, scripts, chat, messages) {
    const body = { schemaVersion: 1, encoding: 'native-mvu-scope-read-frame-v1', source,
        sourceNativeCutSha256: cutSha256, viewKind: 'script',
        scopes: { chat: schemaScopeReowner(chat, schemaScopeOwner(source, 'chat')),
            character: schemaScopeEmpty(schemaScopeOwner(source, 'character')),
            global: schemaScopeEmpty(schemaScopeOwner(source, 'global')) },
        scripts: scripts.map(script => ({ scriptId: script.identity, pointer: script.pointer, sourceSha256: script.sourceSha256,
            variables: schemaScopeEmpty(schemaScopeOwner(source, 'script', script.identity)) })), messages };
    return validateMvuScopeReadFrameV1({ ...body, frameSha256: recordSha256(body) });
}
export function rebindSchemaScopeReadFrame(input, cutSha256) {
    const { frameSha256: _old, ...body } = validateMvuScopeReadFrameV1(input);
    const next = { ...body, sourceNativeCutSha256: cutSha256 };
    return validateMvuScopeReadFrameV1({ ...next, frameSha256: recordSha256(next) });
}
export function schemaScopeReadFactsEqual(left, right) {
    const { frameSha256: _left, sourceNativeCutSha256: _leftCut, ...a } = validateMvuScopeReadFrameV1(left);
    const { frameSha256: _right, sourceNativeCutSha256: _rightCut, ...b } = validateMvuScopeReadFrameV1(right);
    return same(a, b);
}
export const schemaScopeMessageKey = (ownerSessionId, nativeSeq, messageId, versionSha256) => recordSha256({ ownerSessionId, nativeSeq, messageId, versionSha256 });
export function schemaScopeVisibleMessages(events, projectPrefix, source, ownerForSeq, published) {
    const projected = projectPrefix(events);
    const session = { id: source.sessionId, events, surface: { nodes: projected.nodes },
        deriveEventMessage: (entry) => projected.projectedMessageAt(entry.seq) };
    return surfaceEntries(session).map((entry, position) => {
        const event = events[entry.seq];
        // The format projector returns only an edit override. An unchanged Native
        // message remains in its original event; absence is not a missing message.
        const original = event?.type === 'assistant/message' ? event.data.message : event?.type === 'user/message' ? event.data : undefined;
        const message = projected.projectedMessageAt(entry.seq) ?? original, ownerSessionId = ownerForSeq(entry.seq);
        if (!message || message.id !== entry.messageId || !ownerSessionId)
            fail('SCHEMA_SCOPE_MESSAGE_UNPROVEN');
        const messageVersionSha256 = recordSha256(message);
        const key = schemaScopeMessageKey(ownerSessionId, entry.seq, entry.messageId, messageVersionSha256);
        const owner = schemaScopeOwner(source, 'message', entry.messageId, ownerSessionId);
        const variables = schemaScopeReowner(published.get(key) ?? schemaScopeEmpty(owner), owner);
        return { position, ownerSessionId, nativeSeq: entry.seq, messageId: entry.messageId, messageVersionSha256,
            selectedVariant: messageVersionSha256, isSystem: false, variables };
    });
}
