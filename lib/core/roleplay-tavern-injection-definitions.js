// Generated from runtime/alpha3/src/core/roleplay-tavern-injection-definitions.ts; edit the TypeScript source.
/** Logical program definitions come from the same captured import/overlay and
 * author producer as prompt text. Variable snapshots and a keyword miss do
 * not revoke a definition; a real definition edit or disable does. */
import { recordSha256 } from './roleplay-data.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
/** Both ordinary browser declarations and generation consumers use the same
 * captured Source program. Neither needs to fabricate a generation output. */
export function captureNativeTavernInjectionDefinitionV1(sessionId, program) {
    const logicalOwnerId = `source-${recordSha256({ sessionId, sourceRecordSessionId: program.source.sourceRecordSessionId,
        importId: program.source.importId, importRecordSha256: program.source.importRecordSha256 })}:generation-prompt`;
    return Object.freeze({ logicalOwnerId, definitionSha256: recordSha256({ schemaVersion: 1,
            encoding: 'author-native-generation-definition-v1', logicalOwnerId, nativeProgramSha256: program.programSha256 }),
        nativeProgramSha256: program.programSha256 });
}
export function captureRoleplayTavernInjectionDefinitionsV1(source, plan, residual, nativeProgram, authorSources, sourceCatalog) {
    const owner = recordSha256({ schemaVersion: 1, encoding: 'native-logical-template-Source-owner-v1',
        sessionId: source.sessionId, sourceRecordSessionId: source.sourceRecordSessionId,
        importId: source.original.activePointer.importId, rawSha256: source.original.rawSha256,
        documentSha256: source.original.documentSha256, activation: source.original.activePointerRef });
    const byKey = new Map();
    for (const entry of plan.entries) {
        const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, ...entry.semanticOverrides }, formal = sourceCatalog?.entries[entry.ordinal]?.formal, forced = formal && !formal.special && formal.names.includes('@@activate') && !formal.names.includes('@@dont_activate');
        // A disabled force declaration can enable only its own actual Source
        // entry. The shared evaluator still owns eligibility, timing and budget.
        if (!(formal?.enabled ?? semantic.enabled) && !forced)
            continue;
        const content = resolveTavernLoreContentTextV1(plan, `${entry.sourcePointer}/content`);
        const { content: _content, ...controls } = semantic;
        const logicalOwnerId = `source-${owner}:lore-${entry.entryId}`;
        byKey.set(entry.entryId, Object.freeze({ logicalOwnerId, definitionSha256: recordSha256({ logicalOwnerId,
                rawEntrySha256: entry.rawEntrySha256, contentSha256: content.contentSha256, controls }) }));
    }
    const author = authorSources ?? [['cards', residual.cardsText], ['rules', residual.rulesText], ['examples', residual.examplesText]]
        .map(([field, text]) => ({ pointer: `/native/current-author/${field}`, text: text }));
    for (const { pointer, text } of author) {
        // Retain accepted aggregate identities; field Sources use their full pointer
        // so /data/description and /data/personality cannot share an empty owner.
        const field = pointer.match(/^\/native\/current-author\/(cards|rules|examples)$/)?.[1] ?? recordSha256({ pointer }), logicalOwnerId = `source-${owner}:author-${field}`;
        byKey.set(pointer, Object.freeze({ logicalOwnerId, definitionSha256: recordSha256({ logicalOwnerId,
                text, includeCardStyle: residual.includeCardStyle }) }));
    }
    const nativeDefinition = nativeProgram ? captureNativeTavernInjectionDefinitionV1(source.sessionId, nativeProgram) : undefined;
    // Final request text is a distinct Native producer. Its creations retain the
    // exact slot/resource/capture; the logical owner follows the current author
    // Source, rather than transient message IDs or the refs its output creates.
    const finalMessageOwner = `source-${owner}:generate-final`, finalMessageDefinition = Object.freeze({ logicalOwnerId: finalMessageOwner, definitionSha256: recordSha256({
            logicalOwnerId: finalMessageOwner, sourceSha256: source.sourceSha256, includeCardStyle: residual.includeCardStyle
        }) });
    const readerDefinitions = Object.fromEntries(['before', 'after'].map(phase => {
        const logicalOwnerId = `source-${owner}:reader-${phase}`;
        return [phase, Object.freeze({ logicalOwnerId, definitionSha256: recordSha256({ logicalOwnerId,
                    sourceSha256: source.sourceSha256, includeCardStyle: residual.includeCardStyle }) })];
    }));
    return { definitions: Object.freeze([...byKey.values(), finalMessageDefinition,
            ...Object.values(readerDefinitions), ...nativeDefinition ? [nativeDefinition] : []]),
        nativeDefinition, finalMessageDefinition, readerDefinitions,
        definitionFor(pointer, entryId) {
            const value = byKey.get(entryId ?? pointer);
            if (!value)
                throw Error('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_UNAVAILABLE');
            return value;
        } };
}
