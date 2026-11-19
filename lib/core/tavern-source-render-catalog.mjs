// Generated from runtime/alpha3/src/core/tavern-source-render-catalog.mts; edit the TypeScript source.
/** Source-owned metadata and formal lifecycle projection. Target macros and
 * execution stay with the consumer; this module never opens a prompt stage. */
import { ST_LORE_ENTRY_DEFAULTS_V1, ST_LORE_POSITION_V1, ST_LORE_ROLE_V1, ST_LORE_LOGIC_V1 } from './tavern-lore-fixed-profile.mjs';
import { resolveTavernLoreContentTextV1, compileAuthorWorldbookV1 } from './tavern-lore-compiler.mjs';
import { parseTavernEntryDecoratorsV1, tavernEntryRendersInPhaseV1 } from './roleplay-tavern-prompt-variables-data.js';
import { nativeNamedWorldbookEntryToWireV1 } from './tavern-named-worldbook-data.js';
import { authorWorldbookHelperEntryV1 } from './roleplay-author-worldbook-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
/** The compiled membership owns current order. An introduced member has no
 * immutable original; an original member keeps its actual archive address.
 * Consumers retain their existing admission/error contracts, without another
 * full-plan validation or hash of these already captured rows. */
export function createTavernSourceEntryResolverV1(source, plan) {
    if (plan.boundBooks) {
        const books = new Map(plan.boundBooks.map(book => [book.plan.bookId, book.plan]));
        return (entry) => {
            const local = books.get(entry.bookId), member = local?.currentNativeMembership?.members[entry.localOrdinal];
            return { member, original: undefined, raw: member?.rawEntry,
                bookId: entry.bookId, world: local?.source.encoding === 'author-worldbook-source-reference-v1' ? local.source.name : '' };
        };
    }
    const membership = plan.currentNativeMembership, originals = membership && plan.source.encoding !== 'author-worldbook-source-reference-v1'
        ? new Map(source.original.primary.entries.map(row => [row.ref.entryPointer, row])) : undefined;
    return (entry) => {
        const member = membership?.members[entry.ordinal], identity = entry.currentNativeMember?.identity, original = member ? identity?.kind === 'original' ? originals?.get(identity.rawEntryPointer) : undefined
            : source.original.primary.entries[entry.ordinal];
        return { member, original, raw: member?.rawEntry ?? original?.value, bookId: plan.bookId,
            world: plan.source.encoding === 'author-worldbook-source-reference-v1' ? plan.source.name :
                typeof source.original.primary.value?.name === 'string' ? source.original.primary.value.name : `native-primary-${plan.bookId}` };
    };
}
export function createTavernSourceRenderCatalogV1(input) {
    const { source, plan } = input, resolveEntry = createTavernSourceEntryResolverV1(source, plan);
    const createEntry = (entry) => {
        const joined = resolveEntry(entry), { member, original, raw } = joined;
        // Preserve the render owner's existing original-entry identity join. The
        // compiler already owns current-membership integrity and content hashes.
        if (!raw || !member && (!original || original.ref.entrySha256 !== entry.rawEntrySha256))
            throw Error('INPUT_MATERIAL_RENDER_ENTRY_UNPROVEN');
        const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, displayIndex: entry.ordinal,
            ...entry.semanticOverrides }, resolved = resolveTavernLoreContentTextV1(plan, entry.sourcePointer + '/content'), title = typeof raw.comment === 'string' ? raw.comment : '', formal = parseTavernEntryDecoratorsV1({ content: resolved.text, decorators: null, title,
            currentSemantic: { enabled: semantic.enabled } }, input.invertEnabled ?? false), uid = entry.upstreamUid.origin === 'explicit' ? Number(entry.upstreamUid.value) : Number.NaN;
        return { entry, raw, original, member, resolved, semantic, uid, formal, bookId: joined.bookId, world: joined.world };
    };
    const before = [], after = [], indexedBefore = new Map(), indexedAfter = new Map(), ordinaryFormalEntries = [], entryById = new Map();
    const append = (bucket, row) => {
        // Source entries arrive once in order. Repeated title/decorator matches
        // for this same entry can only duplicate the current bucket's final row.
        if (bucket.at(-1) !== row)
            bucket.push(row);
    };
    const indexed = (buckets, ordinal, row) => {
        let bucket = buckets.get(ordinal);
        if (!bucket) {
            bucket = [];
            buckets.set(ordinal, bucket);
        }
        append(bucket, row);
    };
    const ordinal = (value) => {
        if (!/^(?:0|[1-9]\d*)$/.test(value))
            return;
        const index = Number(value);
        return Number.isSafeInteger(index) ? index : undefined;
    };
    const entries = plan.entries.map(entry => {
        const row = createEntry(entry), title = typeof row.raw.comment === 'string' ? row.raw.comment : '';
        entryById.set(entry.entryId, row);
        if (!row.formal.special && (row.formal.bodyOffset > 0 || row.formal.names.length || title.includes('[Preprocessing]')))
            ordinaryFormalEntries.push(row);
        if (title.startsWith('[GENERATE:BEFORE]'))
            append(before, row);
        if (title.startsWith('[GENERATE:AFTER]'))
            append(after, row);
        const match = /^\[GENERATE:([^:\]]+):(BEFORE|AFTER)\]/.exec(title);
        if (match) {
            const index = ordinal(match[1]);
            if (index !== undefined)
                indexed(match[2] === 'BEFORE' ? indexedBefore : indexedAfter, index, row);
        }
        // Formal arguments distinguish global and indexed declarations. The fixed
        // upstream has() drops arguments and incorrectly runs indexed as global.
        for (const directive of row.formal.directives) {
            if (directive.name !== '@@generate_before' && directive.name !== '@@generate_after')
                continue;
            const isBefore = directive.name === '@@generate_before';
            if (directive.args === '')
                append(isBefore ? before : after, row);
            else {
                const index = ordinal(directive.args);
                if (index !== undefined)
                    indexed(isBefore ? indexedBefore : indexedAfter, index, row);
            }
        }
        return row;
    });
    const generateLoaders = { before, after, indexedBefore, indexedAfter };
    const world = plan.source.encoding === 'author-worldbook-source-reference-v1' ? plan.source.name :
        typeof source.original.primary.value?.name === 'string' ? source.original.primary.value.name :
            `native-primary-${plan.bookId}`;
    return { source, plan, entries, entryById, ordinaryFormalEntries, world, generateLoaders, hasFormalRenderEntries: entries.some(({ formal, raw }) => tavernEntryRendersInPhaseV1(typeof raw.comment === 'string' ? raw.comment : '', formal.names, 'before')
            || tavernEntryRendersInPhaseV1(typeof raw.comment === 'string' ? raw.comment : '', formal.names, 'after')) };
}
const sourcePrograms = new WeakMap();
export function tavernSourceEntryProgramV1(row) {
    let program = sourcePrograms.get(row);
    if (!program) {
        program = Object.freeze({ bodyOffset: row.formal.bodyOffset,
            contentSha256: row.formal.bodyOffset === 0 ? row.resolved.contentSha256 : schemaTextSha256(row.formal.body) });
        sourcePrograms.set(row, program);
    }
    return program;
}
/** Actual Source identity and parsed body are retained by this one supplier.
 * The guest supplies only the desired mode and opaque captured entry key. */
export function tavernSourceTemplateActivationV1(catalog, proposal) {
    const row = catalog.entryById.get(proposal.entryId);
    if (!row)
        throw Error('INPUT_MATERIAL_ACTIVATION_CHANGED');
    return { entryId: row.entry.entryId, rawEntrySha256: row.entry.rawEntrySha256,
        ...proposal.mode ? { mode: proposal.mode, sourceProgram: tavernSourceEntryProgramV1(row) } : {} };
}
/** The compiler owns imported UID fallback and effective current controls.
 * Raw extensions remain the actual imported fields instead of a reconstruction. */
function worldInfoEntry(row, semantic, world) {
    const uid = Number(row.entry.upstreamUid.value);
    const raw = row.raw;
    if (world === undefined || row.entry.upstreamUid.origin === 'invalid' || !Number.isSafeInteger(uid) || uid < 0)
        return;
    // Optional metadata uses the same DTO producer as an explicit Helper read.
    // A projection failure leaves raw getwi text available and metadata absent.
    try {
        const wire = row.member ? authorWorldbookHelperEntryV1(row.member) : nativeNamedWorldbookEntryToWireV1(raw, { uid });
        return { uid, world, comment: typeof raw.comment === 'string' ? raw.comment : '', content: row.formal.body,
            decorators: [...row.formal.names], key: [...semantic.primaryKeys], keysecondary: [...semantic.secondaryKeys],
            disable: !semantic.enabled, constant: semantic.constant, vectorized: semantic.vectorized,
            selective: semantic.selective, selectiveLogic: ST_LORE_LOGIC_V1.indexOf(semantic.selectiveLogic), addMemo: wire.addMemo,
            order: semantic.order, position: ST_LORE_POSITION_V1.indexOf(semantic.position), role: ST_LORE_ROLE_V1.indexOf(semantic.role),
            depth: semantic.depth, excludeRecursion: semantic.excludeRecursion, preventRecursion: semantic.preventRecursion,
            delayUntilRecursion: semantic.delayUntilRecursion, probability: semantic.probability, useProbability: semantic.useProbability,
            group: semantic.group, groupOverride: semantic.groupOverride, groupWeight: semantic.groupWeight,
            scanDepth: semantic.scanDepth, caseSensitive: semantic.caseSensitive, matchWholeWords: semantic.matchWholeWords,
            useGroupScoring: semantic.useGroupScoring, automationId: semantic.automationId, displayIndex: semantic.displayIndex,
            sticky: semantic.sticky, cooldown: semantic.cooldown, delay: semantic.delay, ignoreBudget: semantic.ignoreBudget,
            outletName: semantic.outletName, triggers: [...semantic.triggers], extensions: structuredClone(raw.extensions ?? {}),
            characterFilter: structuredClone(wire.characterFilter), characterFilterNames: [...wire.characterFilter.names],
            characterFilterTags: [...wire.characterFilter.tags], characterFilterExclude: wire.characterFilter.isExclude,
            matchPersonaDescription: semantic.matchPersonaDescription, matchCharacterDescription: semantic.matchCharacterDescription,
            matchCharacterPersonality: semantic.matchCharacterPersonality, matchCharacterDepthPrompt: semantic.matchCharacterDepthPrompt,
            matchScenario: semantic.matchScenario, matchCreatorNotes: semantic.matchCreatorNotes,
            ...wire.extra ? { extra: structuredClone(wire.extra) } : {} };
    }
    catch {
        return undefined;
    }
}
function worldInfoCatalog(catalog, authorsNoteDepth) {
    const plan = catalog.plan, books = plan.boundBooks?.flatMap(({ plan: book }) => book.source.encoding === 'author-worldbook-source-reference-v1' ? [{ bookId: book.bookId, world: book.source.name }] : [])
        ?? (plan.source.encoding === 'author-worldbook-source-reference-v1' ? [{ bookId: plan.bookId, world: plan.source.name }] :
            typeof catalog.source.original.primary.value?.name === 'string'
                ? [{ bookId: plan.bookId, world: catalog.source.original.primary.value.name }] : []), bindings = { character: [], global: [], persona: null, characterExtra: [], chat: null };
    if (plan.source.encoding === 'author-worldbook-collection-source-reference-v1') {
        for (const { selection } of plan.source.bindings) {
            if (selection.kind === 'character') {
                if (selection.primary !== null)
                    bindings.character.push(selection.primary);
                bindings.characterExtra.push(...selection.additional);
            }
            else if (selection.kind === 'profile')
                bindings.global.push(...selection.enabled);
            else
                bindings.chat = selection.bookId;
        }
    }
    else if (books.length && plan.source.encoding !== 'author-worldbook-source-reference-v1')
        bindings.character.push(plan.bookId);
    return { schemaVersion: 1, encoding: 'source-world-info-catalog-v1', books, bindings,
        defaultBookId: bindings.character[0] ?? bindings.persona ?? bindings.chat, authorsNoteDepth };
}
/** This is lookup/render order, separate from the lore evaluator's admission
 * order. NaN UIDs deliberately fall through to the actual Source ordinal. */
export function orderTavernSourceRenderCatalogV1(catalog, authorsNoteDepth, selected = catalog.entries) {
    const top = Math.max(0, ...selected.filter(row => row.semantic.position === 'at-chat-depth')
        .map(row => row.semantic.depth));
    const offsets = { 'before-character': 4, 'after-character': 3, 'before-examples': 2, 'after-examples': 1 };
    return selected.map(row => {
        const semantic = row.semantic, offset = offsets[semantic.position], effectiveDepth = semantic.position === 'before-authors-note' || semantic.position === 'after-authors-note'
            ? authorsNoteDepth + semantic.depth : offset === undefined ? semantic.depth : top + offset;
        return { ...row, effectiveDepth };
    }).sort((a, b) => b.effectiveDepth - a.effectiveDepth || a.semantic.order - b.semantic.order
        || b.uid - a.uid || a.entry.ordinal - b.entry.ordinal);
}
/** The source regex pass can read target macros even in regex-only mode.
 * Capture and reuse belong to that macro cut's existing owner, not a Source
 * hash cache. The callback retains its transform ledger and await checks. */
export async function projectTavernSourceRenderEntriesV1(input) {
    const { source, plan } = input.catalog, output = await input.transform(input.entries.map(({ entry, resolved, formal, bookId }) => ({
        key: entry.entryId, bookId: entry.sourcePointer.startsWith('derived:') ? null : bookId, entryId: entry.entryId,
        sourcePointer: resolved.pointer, sourceSnapshotSha256: source.sourceSha256,
        rawText: formal.body, storyText: '', inputText: formal.body, pipeline: 'regex-only', channel: 'source', placement: 5,
        depth: null, isEdit: false, characterOverride: null, required: false
    })), input.macros);
    return new Map(output.entries.map(projection => [projection.entryId, projection]));
}
export async function projectTavernSourceRenderLoreV1(input) {
    const { catalog } = input, { source, plan } = catalog, ordered = orderTavernSourceRenderCatalogV1(catalog, input.authorsNoteDepth), projections = await projectTavernSourceRenderEntriesV1({ catalog, entries: ordered, macros: input.macros, transform: input.transform }), overrides = input.evaluationComposition?.ref ? new Map(input.evaluationComposition.entries
        .flatMap(entry => 'semantic' in entry ? [[entry.entryId, entry.semantic]] : [])) : undefined;
    const lore = ordered.map(row => {
        const { entry, raw, semantic, uid, bookId, world } = row, effective = overrides?.get(entry.entryId) ?? semantic, actualWorld = plan.boundBooks ? world : plan.source.encoding === 'author-worldbook-source-reference-v1' ? plan.source.name :
            typeof source.original.primary.value?.name === 'string' ? source.original.primary.value.name : undefined, metadata = worldInfoEntry(row, effective, actualWorld);
        const projection = projections.get(entry.entryId);
        return { key: entry.entryId, bookId, entryId: entry.entryId, sourcePointer: projection.sourcePointer,
            sourceSnapshotSha256: source.sourceSha256, content: projection.outputText, contentSha256: projection.outputSha256,
            activationAllowed: effective.enabled && entry.disposition === 'eligible-semantic-data',
            ...metadata ? { worldInfo: metadata } : {},
            lookup: { world, title: typeof raw.comment === 'string' ? raw.comment : '',
                uid: Number.isSafeInteger(uid) && uid >= 0 ? uid : null },
            ...projection.deferredDiagnostics.length ? { readDiagnostic: { code: projection.deferredDiagnostics[0].code,
                    projectionSha256: projection.projectionSha256 } } : {} };
    });
    return { lore, worldInfo: worldInfoCatalog(catalog, input.authorsNoteDepth), byEntryId: projections };
}
/** An explicit read projects only its captured book. The caller retains the
 * existing read basis and bound-book snapshot, including their permissions. */
export async function projectCapturedNamedTavernWorldbookV1(input) {
    const { book } = input, { plan } = compileAuthorWorldbookV1(book), catalog = createTavernSourceRenderCatalogV1({ source: input.source, plan }), { lore } = await projectTavernSourceRenderLoreV1({ ...input, catalog });
    return { schemaVersion: 1, encoding: 'source-named-worldbook-projection-v1', book: {
            profileId: book.address.profileId, bookId: book.address.bookId, name: book.name, revision: book.revision,
            contentRef: book.content, metadataRef: book.metadata
        }, lore };
}
