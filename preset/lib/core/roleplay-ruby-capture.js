// Generated from runtime/alpha3/src/core/roleplay-ruby-capture.ts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { captureRoleplayTavernPromptSourceDataV1 } from './roleplay-tavern-prompt-source.js';
import { captureReadonlyAuthorDialogChatClockV1 } from './roleplay-tavern-chat-clock.js';
import { produceRoleplayTavernMacroSnapshotV1 } from './roleplay-tavern-prompt-macros.js';
import { applyTavernPromptTransformsV1 } from './tavern-prompt-transform.mjs';
import { readRubyConfigurationV1, RUBY_BUILTIN_REFERENCES_V1 } from './roleplay-ruby-config.js';
import { findRubyEntryV1 } from './roleplay-ruby-input.js';
export function createRoleplayRubyCaptureV1(deps) {
    function configurationSummary(id) {
        return deps.inputState.captureObservation(id, () => {
            const original = deps.source.capture(id);
            if (original.kind !== 'captured-data')
                return { configurationStatus: 'uninitialized', configurationIssues: [] };
            const metadata = deps.edits.observeAuthorMetadataData(original);
            if (metadata.kind !== 'captured-data')
                throw Error(metadata.diagnostics[0]?.code ?? 'RUBY_SOURCE_UNAVAILABLE');
            const raw = metadata.data.extensions?.RubyAnalyzer, configuration = readRubyConfigurationV1(raw, { ownerId: id, sourcePath: '/data/extensions/RubyAnalyzer',
                version: recordSha256(raw ?? null) });
            return { configurationStatus: configuration.status, configurationIssues: configuration.issues,
                summaryProvider: configuration.summaryProvider, summaryProviderStatus: configuration.summaryProviderStatus,
                generation: configuration.generation ?? null,
                tasks: configuration.tasks.map(task => ({ taskKey: task.taskKey, name: task.displayName, enabled: task.enabled,
                    cyclePositions: task.cyclePositions, useReferences: task.useReferences, useOutputs: task.useOutputs })) };
        }, 'ruby-configuration-summary').data;
    }
    async function capture(id, signal, options) {
        const session = deps.session(id);
        if (!session)
            throw Error('RUBY_SESSION_UNAVAILABLE');
        const assertOwnerFactsCurrent = () => {
            signal.throwIfAborted();
            if (deps.session(id) !== session)
                throw Error('RUBY_SESSION_CHANGED');
        };
        const read = await deps.withSourceLock(id, async () => deps.inputState.captureRuby({ session, signal,
            assertOwnerFactsCurrent }, 'source', () => {
            const original = deps.source.capture(id);
            if (original.kind === 'outside-declared-domain')
                return undefined;
            if (original.kind !== 'captured-data')
                throw Error(original.diagnostics[0]?.code ?? 'RUBY_SOURCE_UNAVAILABLE');
            const metadata = deps.edits.observeAuthorMetadataData(original);
            if (metadata.kind !== 'captured-data')
                throw Error(metadata.diagnostics[0]?.code ?? 'RUBY_SOURCE_UNAVAILABLE');
            const raw = metadata.data.extensions?.RubyAnalyzer, configuration = readRubyConfigurationV1(raw, { ownerId: id, sourcePath: '/data/extensions/RubyAnalyzer',
                version: recordSha256(raw ?? null) });
            if (configuration.status === 'empty' && !options?.readOnly && !options?.includeEmpty)
                return undefined;
            // The synchronous Source supplier is already captured. Consumers reuse
            // it rather than rebuilding a book merely to discover no Ruby producer.
            const includeCardStyle = deps.includeCardStyle(id), captured = captureRoleplayTavernPromptSourceDataV1({
                source: { capture: () => original }, edits: deps.edits
            }, id, includeCardStyle);
            if (captured.kind === 'outside-declared-domain')
                return undefined;
            const { source, compilation, cardData } = captured, context = source.current.openingContext.context, actualCharName = context.char ?? '', clock = options?.readOnly ? undefined : captureReadonlyAuthorDialogChatClockV1({ session,
                projections: deps.projections(), assertOwnerCurrent: assertOwnerFactsCurrent }), messages = clock?.data.rows.map((row, index) => ({
                ref: { ownerId: id, sourcePath: `native/messages/${row.id}`, version: row.messageSha256 },
                seq: row.seq, messageId: row.id, messageVersion: row.messageSha256, role: row.role,
                speakerName: row.role === 'user' ? context.user ?? '' : actualCharName, text: clock.scanRows[index].text
            })) ?? [], entries = compilation.plan.entries.map(planEntry => {
                // The compiler's current directory owns membership and raw order.
                // Iterating the archive would resurrect removed prompts and hide new ones.
                const member = planEntry.currentNativeMember
                    ? compilation.plan.currentNativeMembership.members[planEntry.ordinal] : undefined, archived = member ? undefined : source.original.primary.entries.find(entry => entry.ref.entryPointer === planEntry.sourcePointer), rawEntry = member?.rawEntry ?? archived.value, rawRef = member ? { entryPointer: planEntry.sourcePointer, entrySha256: planEntry.currentNativeMember.rawEntrySha256 } : archived.ref, content = planEntry.semanticOverrides.content, text = content?.currentNative?.text ?? (typeof rawEntry.content === 'string' ? rawEntry.content : ''), keys = planEntry.semanticOverrides.primaryKeys ?? (Array.isArray(rawEntry.keys)
                    ? rawEntry.keys.filter((key) => typeof key === 'string') : []);
                return { ref: { ownerId: source.sourceRecordSessionId, sourcePath: planEntry.sourcePointer,
                        version: recordSha256({ rawEntry: rawRef, keys, text }) }, keys, resolvedContent: text,
                    uid: member?.uid ?? planEntry.upstreamUid.value ?? planEntry.ordinal,
                    comment: typeof rawEntry.comment === 'string' ? rawEntry.comment : typeof rawEntry.name === 'string' ? rawEntry.name : '',
                    disabled: planEntry.disposition === 'disabled', constant: planEntry.semanticOverrides.constant ?? !!rawEntry.constant };
            }), book = { ref: { ownerId: id, sourcePath: source.original.primary.bookPointer,
                    version: recordSha256(entries) }, entries }, declaredOutlets = compilation.plan.entries.flatMap(entry => entry.semanticOverrides.outletName ? [entry.semanticOverrides.outletName] : []);
            // Identity covers the actual rule/config and explicit lookup content.
            // Session-local Source references remain separate, permitting a fork to
            // inherit accepted output without rewriting the immutable original.
            const sourceIdentitySha256 = recordSha256({ configuration: raw ?? null, entries: entries.map(entry => ({
                    keys: entry.keys, text: entry.resolvedContent
                })), context });
            return { configuration, actualCharName, messages, book, records: entries,
                primaryName: typeof source.original.primary.value?.name === 'string' ? source.original.primary.value.name : null,
                macroInput: { source, cardData, includeCardStyle, inputText: null, scopes: [], outlets: [], declaredOutlets },
                sourceIdentitySha256,
                sourceSnapshotSha256: source.sourceSha256 };
        }), signal);
        if (!read.data) {
            read.release();
            return undefined;
        }
        try {
            const data = read.data;
            const makeMacros = () => ({ ...produceRoleplayTavernMacroSnapshotV1(data.macroInput).snapshot,
                deferredMacros: [...new Set(['CHAR_NAME', 'recentMessages',
                        ...data.configuration.referencePool.map(reference => reference.varName),
                        ...data.configuration.tasks.flatMap(task => [task.outputVarName, ...task.useReferences, ...task.useOutputs])])] });
            async function transformEntries(selectedEntries, macros, sourcePath) {
                const transformed = await applyTavernPromptTransformsV1({ schemaVersion: 1,
                    encoding: 'owned-tavern-prompt-transform-v1', authority: 'consumer-data-only',
                    sourceSnapshotSha256: data.sourceSnapshotSha256, regexDisabled: true, macros, rules: [],
                    entries: selectedEntries.map((entry, index) => ({ key: `ruby-explicit-${index}`, bookId: null, entryId: null,
                        sourcePointer: entry.ref.sourcePath, sourceSnapshotSha256: data.sourceSnapshotSha256,
                        rawText: entry.resolvedContent, storyText: entry.resolvedContent, inputText: entry.resolvedContent,
                        pipeline: 'macro-only', channel: 'prompt', placement: 3, depth: null, isEdit: false, characterOverride: null, required: true })) }, { assertCurrent: read.assertCurrent, signal });
                if (transformed.kind === 'transformed')
                    return { kind: 'transformed',
                        texts: transformed.output.entries.map(entry => entry.outputText) };
                if (transformed.kind === 'refused')
                    return { kind: 'unsupported',
                        issues: transformed.diagnostics.map(diagnostic => ({ code: diagnostic.code,
                            sourcePath: selectedEntries.find((_entry, index) => diagnostic.entryKey === `ruby-explicit-${index}`)
                                ?.ref.sourcePath ?? sourcePath })) };
                signal.throwIfAborted();
                throw Error(transformed.diagnostics[0]?.code ?? 'PROMPT_TRANSFORM_CANCELLED');
            }
            const resolveEntryContent = async (entries) => {
                if (!entries.length)
                    return [];
                const result = await transformEntries(entries, makeMacros(), '/ruby/read');
                if (result.kind === 'unsupported')
                    throw Error(result.issues[0]?.code ?? 'RUBY_READ_MACROS_UNAVAILABLE');
                return result.texts;
            };
            const resolveInputBooks = async (task, chatBook) => {
                const references = new Map(data.configuration.referencePool.map(reference => [reference.varName, reference])), outputs = new Map(data.configuration.tasks.filter(output => output.outputKey)
                    .map(output => [output.outputVarName, output])), referenceKeys = task.useReferences.flatMap(name => {
                    const reference = references.get(name) ?? RUBY_BUILTIN_REFERENCES_V1.find(reference => reference.varName === name);
                    return reference ? [reference.entryKey] : [];
                }), outputKeys = task.useOutputs.flatMap(name => {
                    const output = outputs.get(name);
                    return output ? [output.outputKey] : [];
                }), lookups = [{ key: task.promptKey, books: [data.book, chatBook] },
                    ...[...referenceKeys, ...outputKeys].map(key => ({ key, books: [chatBook, data.book] }))], resolved = new Map();
                let pending = lookups, macros;
                for (const priority of [0, 1]) {
                    const selectedEntries = [...new Set(pending.flatMap(lookup => {
                            const entry = findRubyEntryV1(lookup.books[priority], lookup.key);
                            return entry && !resolved.has(entry) ? [entry] : [];
                        }))];
                    if (selectedEntries.length) {
                        // Eligibility is settled before this method. Only real winning
                        // lookups enter the Worker; empty projections unlock the next book.
                        const transformed = await transformEntries(selectedEntries, macros ??= makeMacros(), task.sourcePath);
                        if (transformed.kind === 'unsupported')
                            return transformed;
                        selectedEntries.forEach((entry, index) => resolved.set(entry, transformed.texts[index]));
                    }
                    pending = pending.filter(lookup => {
                        const entry = findRubyEntryV1(lookup.books[priority], lookup.key);
                        return !entry || !resolved.get(entry).trim();
                    });
                }
                const projected = (book) => ({ ...book, entries: book.entries.map(entry => resolved.has(entry) ? { ...entry, resolvedContent: resolved.get(entry) } : entry) });
                return { kind: 'resolved', characterBook: projected(data.book), chatBook: projected(chatBook) };
            };
            return { session, configuration: data.configuration, sourceIdentitySha256: data.sourceIdentitySha256,
                actualCharName: data.actualCharName, messages: data.messages, characterBook: data.book, resolveInputBooks,
                primaryName: data.primaryName, records: data.records, resolveEntryContent,
                assertCurrent: read.assertCurrent, current: read.current, release: read.release };
        }
        catch (error) {
            read.release();
            throw error;
        }
    }
    return { capture, configurationSummary };
}
