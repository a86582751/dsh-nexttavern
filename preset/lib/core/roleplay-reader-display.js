// Generated from runtime/alpha3/src/core/roleplay-reader-display.ts; edit the TypeScript source.
/** Reader consumes current author DATA and selected committed Native messages.
 * Display projections never replace canonical text or own a Native write. */
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { sourceLiteralReaderCss } from './roleplay-reader-style-parser.mjs';
import { eventsOf, surfaceEntries } from './roleplay-context.js';
import { produceRoleplayTavernMacroSnapshotV1, captureRoleplayTavernScopedRegexV1 } from './roleplay-tavern-prompt-macros.js';
import { applyTavernPromptTransformsV1 } from './tavern-prompt-transform.mjs';
import { projectReaderNarrativeDisplay } from './roleplay-reader-narrative-display.js';
import { createMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { communityRegexRules, communityRegexMacros } from './community-regex.js';
import { nativeCommunityDisplayRule } from './community-preset-display.js';
/** A document is selected from the applied Source template, never from the
 * mixed final text. The DOM owner separately admits its plain text slots. */
export function projectReaderDisplayFragments(text, replacements) {
    const fragments = [];
    let cursor = 0, documents = 0;
    for (const replacement of replacements) {
        let literal = replacement.parts.filter(part => part.kind === 'literal').map(part => part.text).join('').trim();
        const fence = literal.match(/^(`{3,}|~{3,})(?:html)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i);
        if (fence)
            literal = fence[2].trim();
        if (!/^(?:<!doctype\s+html>\s*)?<html(?:\s[^>]*)?>[\s\S]*<\/html>$/i.test(literal))
            continue;
        if (replacement.start > cursor)
            fragments.push({ kind: 'text', text: text.slice(cursor, replacement.start) });
        const { ruleId, sourcePointer, sourceSnapshotSha256 } = replacement;
        fragments.push({ kind: 'author-document', origin: { ruleId, sourcePointer, sourceSnapshotSha256,
                displaySpan: { start: replacement.start, end: replacement.end } }, parts: replacement.parts });
        documents++;
        cursor = replacement.end;
    }
    if (!documents)
        return;
    if (cursor < text.length)
        fragments.push({ kind: 'text', text: text.slice(cursor) });
    return fragments;
}
/** A completed plain opening proves absence, not initialized empty variables.
 * Reuse the Reader's current Source and Native projection without schema replay. */
export function capturePlainReaderDocumentFacts(read, plain, numerical) {
    const { source, session, events, entries, cardData } = read, receipt = plain.data.nativeOpening, start = entries.findIndex(entry => entry.seq === receipt.assistantSeq && entry.messageId === receipt.messageId);
    if (start < 0)
        fail('READER_DISPLAY_MESSAGE_UNAVAILABLE');
    const variables = { kind: 'unavailable', code: 'MESSAGE_STATE_UNAVAILABLE' }, copy = source.legacyInheritance, messages = entries.slice(start).map((entry, index) => {
        const event = events[entry.seq], message = (session.deriveEventMessage?.(event)
            ?? (entry.kind === 'assistant' ? event.data?.message : event.data));
        const ownerSessionId = copy && entry.seq < copy.seedLength ? copy.parentSessionId : session.id;
        return { index, ownerSessionId, nativeSeq: entry.seq, messageId: entry.messageId,
            messageVersionSha256: recordSha256(message), role: entry.kind, message: textOf(message.content), variables, variants: null };
    }), basis = { sessionId: session.id, sourceSnapshotSha256: source.sourceSha256, materialSha256: source.current.materialSha256,
        // Reuse the owner's completed absence identity, never an MVU head.
        numericalSnapshotSha256: plain.data.absenceScopeRef.sha256,
        nativeCut: events.length, nativePrefixSha256: recordSha256(events) }, unavailable = { kind: 'unavailable', code: 'SCOPE_SOURCE_UNAVAILABLE' }, scopeFrame = createMvuScopeReadFrameV1({ schemaVersion: 1, encoding: 'native-mvu-scope-read-frame-v1',
        source: { sessionId: session.id, sourceRecordSessionId: source.sourceRecordSessionId,
            importId: source.original.activePointer.importId, rawSha256: source.original.rawSha256, sourceSnapshotSha256: source.sourceSha256 },
        sourceNativeCutSha256: recordSha256(basis), viewKind: 'script',
        scopes: { chat: unavailable, character: unavailable, global: unavailable }, scripts: [],
        messages: messages.map(({ index, ownerSessionId, nativeSeq, messageId, messageVersionSha256 }) => ({ position: index,
            ownerSessionId, nativeSeq, messageId, messageVersionSha256, selectedVariant: messageVersionSha256, isSystem: false, variables })) }), context = source.current.openingContext.context;
    return { kind: 'reader-regex-document-facts', current: plain.current,
        data: { schemaVersion: 1, encoding: 'reader-regex-document-snapshot-v1', basis, scopeFrame, messages,
            numerical: { kind: numerical.kind, code: numerical.code, canEdit: false },
            persona: { name: context.user ?? '', ...context.user_gender !== undefined ? { gender: context.user_gender } : {}, avatar: null },
            character: { sourceId: source.original.activePointer.importId, name: String(cardData.name),
                ...typeof cardData.avatar === 'string' ? { avatar: cardData.avatar } : {} }, authorChats: [] } };
}
function fail(code) { throw Error(code); }
function acceptedScope(row, updates) {
    const matches = updates.filter(update => update.canonical.seq === row.seq && update.canonical.messageId === row.messageId);
    if (matches.length !== 1)
        return;
    const update = matches[0];
    if (update.canonical.versionSha256 !== row.messageVersionSha256
        || update.canonical.narrativeSha256 !== sha256(row.rawText))
        return;
    const start = row.rawText.indexOf('<UpdateVariable>'), close = row.rawText.indexOf('</UpdateVariable>');
    if (start < 0 || close < start)
        return;
    return { role: 'assistant', protocol: update.protocol, acceptedRange: { start, end: close + '</UpdateVariable>'.length } };
}
export function createRoleplayReaderDisplay(deps) {
    const compiledDocuments = new Map();
    let documentSource = '', readRevision = 0;
    async function capture(sid, messages, signal) {
        signal.throwIfAborted();
        const session = deps.session(sid);
        if (!session)
            fail('READER_DISPLAY_SESSION_INACTIVE');
        // Keep only author/scopes in the existing Source slot. Native rows and their
        // full canonical depth are fresh for each requested batch, never cached here.
        const read = deps.inputState.captureSource(sid, 'reader-display-author', () => {
            const captured = deps.source.capture(sid);
            if (captured.kind !== 'captured-data')
                fail(captured.kind === 'refused'
                    ? captured.diagnostics[0]?.code ?? 'READER_DISPLAY_SOURCE_UNAVAILABLE' : 'READER_DISPLAY_SOURCE_UNAVAILABLE');
            // Negative schema scope reads must expire when its owner publishes a
            // recovered view. The existing observation slot propagates that change
            // to this Source capture without rebuilding any prompt scope.
            const scopes = deps.scopes(sid, captured.source), identity = scopes?.source, source = captured.source;
            if (identity && (identity.sessionId !== sid || identity.sourceRecordSessionId !== source.sourceRecordSessionId
                || identity.importId !== source.original.activePointer.importId || identity.rawSha256 !== source.original.rawSha256))
                fail('READER_DISPLAY_SCOPE_SOURCE_CHANGED');
            const cardData = captured.contributionInput.rawDecoded.data;
            const scopedRules = captureRoleplayTavernScopedRegexV1(cardData, source.sourceSha256, true);
            const policy = deps.community?.policy(sid);
            const variables = policy?.preset ? deps.community.variables(sid, policy.preset.id) : undefined;
            const adapted = policy ? { ...policy,
                preset: policy.preset ? { ...policy.preset, regexes: policy.preset.regexes.map(nativeCommunityDisplayRule) } : null,
                regexes: policy.regexes.map(library => ({ ...library, rules: library.rules.map(nativeCommunityDisplayRule) })) } : undefined;
            const rules = adapted ? communityRegexRules(adapted, scopedRules) : scopedRules;
            const rawRules = cardData.extensions?.regex_scripts ?? [];
            const nativeMacros = produceRoleplayTavernMacroSnapshotV1({ source, cardData,
                includeCardStyle: deps.includeCardStyle(sid), inputText: null, scopes: scopes?.bindings ?? [],
                outlets: [], declaredOutlets: [] }).snapshot;
            const communityBindings = variables && policy ? communityRegexMacros({}, variables.chat, variables.global, policy.fingerprint) : undefined;
            // Source owns MVU and native scopes; accepted community values overlay
            // only their matching chat/global keys without mutating its frozen input.
            const mergeBindings = (key) => [...new Map([...nativeMacros[key], ...communityBindings[key]].map(binding => [binding.key, binding])).values()];
            const macros = communityBindings ? { ...nativeMacros,
                localVariables: mergeBindings('localVariables'), globalVariables: mergeBindings('globalVariables') } : nativeMacros;
            return { source, cardData, sourceIdentitySha256: captured.currentIdentitySha256, scopes, macros, policy, variables,
                literalStyles: new Map(),
                rules, documentRules: scopedRules.map((rule, ordinal) => ({
                    ruleId: rules.find(effective => effective.sourcePointer === rule.sourcePointer
                        && effective.sourceSnapshotSha256 === rule.sourceSnapshotSha256).id,
                    ordinal, id: typeof rawRules[ordinal].id === 'string'
                        ? rawRules[ordinal].id : rule.id, pointer: rule.sourcePointer,
                    descriptorSha256: recordSha256(rawRules[ordinal]), replacement: rule.replaceString
                })) };
        });
        const current = () => {
            signal.throwIfAborted();
            read.assertCurrent();
        };
        current();
        const events = eventsOf(session), edits = new Map(deps.messageEdits.current(session, events)
            .map(event => [Number(event.data?.targetSeq), event]));
        const select = () => {
            const actual = eventsOf(session), entries = surfaceEntries(session), bySeq = new Map(entries.map((entry, index) => [entry.seq, { entry, index }]));
            const rows = messages.map(ref => {
                const found = bySeq.get(ref.seq), event = actual[ref.seq];
                if (!found || found.entry.kind !== 'assistant' || found.entry.messageId !== ref.messageId
                    || event?.type !== 'assistant/message')
                    fail('READER_DISPLAY_MESSAGE_UNAVAILABLE');
                const message = (session.deriveEventMessage?.(event) ?? event.data?.message);
                if (!message || message.id !== ref.messageId)
                    fail('READER_DISPLAY_MESSAGE_CHANGED');
                const edit = edits.get(ref.seq);
                return { seq: ref.seq, messageId: ref.messageId, rawText: textOf(message.content),
                    messageVersionSha256: recordSha256(message), depth: entries.length - found.index - 1,
                    isEdit: edit?.data?.role === 'assistant' && edit.data.messageId === ref.messageId };
            });
            return { rows, entries, events: actual, order: entries.map(entry => ({ seq: entry.seq, messageId: entry.messageId, kind: entry.kind })) };
        };
        const selected = select(), { source, scopes, macros, rules, policy, variables } = read.data;
        const input = { schemaVersion: 1, encoding: 'owned-tavern-prompt-transform-v1',
            authority: 'consumer-data-only', sourceSnapshotSha256: source.sourceSha256, regexDisabled: false, macros, rules,
            ...policy ? { scriptOrder: policy.regexOrder } : {},
            entries: selected.rows.map(row => {
                const storyText = projectReaderNarrativeDisplay(row.rawText, acceptedScope(row, scopes?.displayUpdates ?? []));
                return { key: `reader:${row.seq}:${row.messageId}`, bookId: null, entryId: null,
                    sourcePointer: `/native/messages/${row.seq}`, sourceSnapshotSha256: source.sourceSha256,
                    rawText: row.rawText, storyText, inputText: storyText, pipeline: 'regex-only', channel: 'display', placement: 2,
                    depth: row.depth, isEdit: row.isEdit, characterOverride: null, required: true };
            }) };
        const transformed = await applyTavernPromptTransformsV1(input, { assertCurrent: current, signal, displayProvenance: true });
        current();
        if (transformed.kind !== 'transformed')
            fail(transformed.diagnostics[0]?.code ?? 'READER_DISPLAY_UNAVAILABLE');
        let rows = selected.rows.map((row, index) => {
            const displayText = transformed.output.entries[index].outputText, replacements = transformed.displayProvenance?.[index]?.replacements ?? [], fragments = projectReaderDisplayFragments(displayText, replacements), styles = new Set();
            for (const replacement of replacements) {
                if (fragments?.some(fragment => fragment.kind === 'author-document'
                    && fragment.origin.displaySpan.start === replacement.start && fragment.origin.displaySpan.end === replacement.end))
                    continue;
                for (const part of replacement.parts)
                    if (part.kind === 'literal') {
                        let css = read.data.literalStyles.get(part.text);
                        if (css === undefined) {
                            css = sourceLiteralReaderCss(part.text);
                            if (css)
                                read.data.literalStyles.set(part.text, css);
                        }
                        if (css) {
                            styles.delete(css);
                            styles.add(css);
                        }
                    }
            }
            const css = Array.from(styles).join('\n');
            return { ...row, displayText, ...fragments ? { fragments } : {}, ...css ? { css } : {} };
        });
        let execution, documentDiagnostics;
        const documents = [], locations = [];
        for (const [rowIndex, row] of rows.entries())
            for (const [fragmentIndex, fragment] of (row.fragments ?? []).entries()) {
                if (fragment.kind !== 'author-document')
                    continue;
                const regex = read.data.documentRules.find(rule => rule.ruleId === fragment.origin.ruleId);
                // This routes Source markup to the complete parser; it grants no script
                // permission. Script-free documents retain the existing static owner.
                if (!regex || !/<script(?:\s|>)/i.test(regex.replacement))
                    continue;
                const { seq, messageId, messageVersionSha256, depth, isEdit } = row;
                documents.push({ regex, message: { seq, messageId, messageVersionSha256, depth, isEdit },
                    replacementSpan: fragment.origin.displaySpan, parts: fragment.parts });
                locations.push({ row: rowIndex, fragment: fragmentIndex });
            }
        if (documents.length) {
            const facts = await deps.documentFacts?.(sid, { source, session, entries: selected.entries, events: selected.events,
                cardData: read.data.cardData }), runtime = facts && await deps.documentRuntime?.();
            if (!facts || !runtime)
                documentDiagnostics = [{ code: 'READER_REGEX_DOCUMENT_RUNTIME_UNAVAILABLE' }];
            else {
                const scopeSource = facts.data.scopeFrame.source;
                if (scopeSource.sessionId !== sid || scopeSource.sourceRecordSessionId !== source.sourceRecordSessionId
                    || scopeSource.importId !== source.original.activePointer.importId || scopeSource.rawSha256 !== source.original.rawSha256)
                    fail('READER_REGEX_DOCUMENT_SCOPE_SOURCE_CHANGED');
                const input = { schemaVersion: 1, encoding: 'reader-regex-document-input-v1',
                    source: { sessionId: sid, sourceRecordSessionId: source.sourceRecordSessionId,
                        importId: source.original.activePointer.importId, rawSha256: source.original.rawSha256,
                        sourceSnapshotSha256: source.sourceSha256, materialSha256: source.current.materialSha256 }, documents };
                if (documentSource !== source.sourceSha256) {
                    compiledDocuments.clear();
                    documentSource = source.sourceSha256;
                }
                const key = recordSha256({ input, compiler: runtime.artifact.compiler });
                let program = compiledDocuments.get(key);
                if (!program) {
                    const result = await runtime.compileReaderDocument(input, signal);
                    if (result.kind === 'compiled') {
                        program = result.program;
                        compiledDocuments.set(key, program);
                        while (compiledDocuments.size > 8)
                            compiledDocuments.delete(compiledDocuments.keys().next().value);
                    }
                    else
                        documentDiagnostics = result.diagnostics;
                }
                current();
                if (!facts.current())
                    fail('READER_REGEX_DOCUMENT_SCOPE_CHANGED');
                if (program) {
                    const byLocation = new Map(locations.map((location, index) => [location.row + ':' + location.fragment,
                        program.documents[index].pagePlanSha256]));
                    rows = rows.map((row, rowIndex) => ({ ...row, fragments: row.fragments?.map((fragment, fragmentIndex) => fragment.kind === 'author-document' ? { ...fragment, documentPlanSha256: byLocation.get(rowIndex + ':' + fragmentIndex) } : fragment) }));
                    execution = { program, artifact: runtime.artifact, snapshot: { ...facts.data,
                            generation: program.programSha256, readRevision: ++readRevision } };
                }
            }
        }
        // A new visible user/assistant can change depth without editing these rows.
        // Rejoin the actual selected messages after Worker completion before reply.
        const latest = select();
        for (let index = 0; index < selected.rows.length; index++) {
            const before = selected.rows[index], after = latest.rows[index];
            if (before.messageVersionSha256 !== after.messageVersionSha256 || before.depth !== after.depth)
                fail('READER_DISPLAY_MESSAGE_CHANGED');
        }
        return { ok: true, sessionId: sid, contextRevision: recordSha256({ source: read.data.sourceIdentitySha256,
                scopes: scopes?.versionSha256 ?? null, community: policy ? { fingerprint: policy.fingerprint, variables } : null, order: selected.order,
                messages: selected.rows.map(({ seq, messageId, messageVersionSha256, depth, isEdit }) => ({ seq, messageId, messageVersionSha256, depth, isEdit })) }),
            rows, ...execution ? { execution } : {}, ...documentDiagnostics ? { documentDiagnostics } : {} };
    }
    return { capture };
}
