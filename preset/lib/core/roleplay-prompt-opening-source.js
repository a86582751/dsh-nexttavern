// Generated from runtime/alpha3/src/core/roleplay-prompt-opening-source.ts; edit the TypeScript source.
/** Actual Source/Native relationship readers plus a pure raw-data calculator.
 * Root separately owns fresh basis, protected execution, intent and publication. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { decodeTavernCard, compileTavernOpeningCandidates } from './tavern-card.js';
import { assertImportRecordIntegrity, projectStructuredImport } from './roleplay-import-record.js';
import { compileSchemaMvuInitData, selectNativeMvuInitializationPolicy } from './tavern-mvu-initvar.js';
import { isNativeMvuYamlSourcePolicy } from './roleplay-mvu-source-policy.js';
import { tavernLoreSourceCurrentIdentityV1 } from './roleplay-tavern-lore-source.js';
import { createRoleplayPromptProgramSourceV1, validatePromptProgramSourceInventoryV1 } from './roleplay-prompt-program-source.js';
import { PROMPT_OPENING_SOURCE_POLICY_SHA256, PromptOpeningSourceFailureV1, openingSourceFail, clonePromptOpeningSourceDataV1, freezePromptOpeningSourceDataV1, openingSourceObject, calculatePromptOpeningRawInitV1, promptOpeningInitializationInputBindingV1, readPromptOpeningGreetingBlocksV1, renderPromptOpeningIdentityV1 } from './roleplay-prompt-opening-source-data.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const seal = (value) => freezePromptOpeningSourceDataV1(clonePromptOpeningSourceDataV1(value));
// Only this parser's detached, deeply frozen successful outputs are reusable.
// A stored clone, another process or a live Source capture still needs its own
// validation/current-owner checks; this set supplies no runtime permission.
const parsedOpeningSourceProofs = new WeakSet();
function exact(value, keys, pointer) {
    if (!openingSourceObject(value) || !same(Object.keys(value).sort(), [...keys].sort())) {
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', pointer);
    }
}
function relationBinding(relation, sourceIdentitySha256) {
    // Keep the whole actual ref in the audit proof. Its semantic currency is the
    // Source owner's sole projection, which excludes only three Native counters.
    return { ...relation, branchMetaRef: { ...relation.branchMetaRef, sha256: sourceIdentitySha256 } };
}
function bindingBody(body) {
    const { program, catalog, catalogSha256, ...rest } = body;
    return { ...rest, sourceRelation: relationBinding(body.sourceRelation, program.sourceCurrentIdentitySha256),
        program: { encoding: program.encoding, inventoryBindingSha256: program.bindingSha256 }, catalog,
        catalogSha256, initialization: body.initialization };
}
function validateInitialization(initialization, proof) {
    const value = initialization, bindings = value.bindings;
    exact(value, value.kind === 'absent'
        ? ['kind', 'reason', 'markerCount', 'data', 'calculation', 'dataSha256', 'calculationSha256', 'inputBindingSha256',
            'bindings', 'grammarPolicy', 'schemaExecution', 'calculationPolicy']
        : ['kind', 'markerCount', 'data', 'calculation', 'dataSha256', 'calculationSha256', 'inputBindingSha256',
            'bindings', 'grammarPolicy', 'schemaExecution', 'calculationPolicy'], '/initialization');
    exact(bindings, ['domain', 'bookPresence', 'bookPointer', 'rawBook', 'rawBookSha256', 'rawEntries', 'entryOrderSha256',
        'bookInitEntryPointers', 'greetingFacts', 'greetingFactsSha256', 'originalBookAbsence', 'baselinePolicy', 'otherBindings',
        'schemaExecution'], '/initialization/bindings');
    if (value.schemaExecution !== 'none' || value.calculationPolicy !== 'raw-init-data-v1'
        || bindings.domain !== 'immutable-raw-embedded-primary-and-complete-original-greetings'
        || bindings.bookPointer !== '/data/character_book' || bindings.baselinePolicy !== 'empty-calculation-input-only-not-numerical-absence'
        || bindings.otherBindings !== 'not-authorized-and-not-calculated' || bindings.schemaExecution !== 'none'
        || !Array.isArray(bindings.rawEntries) || bindings.rawEntries.length > 4096
        || !Array.isArray(bindings.greetingFacts) || bindings.greetingFacts.length > 4096
        || recordSha256(bindings.rawBook) !== bindings.rawBookSha256
        || bindings.rawBookSha256 !== proof.program.book.rawBookSha256
        || bindings.rawEntries.length !== proof.program.bookEntries.length)
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/bindings');
    const rawBook = bindings.rawBook, rawContainer = rawBook?.entries;
    const actualEntries = Array.isArray(rawContainer) ? rawContainer.map((entry, index) => [String(index), entry])
        : openingSourceObject(rawContainer) ? Object.entries(rawContainer) : [];
    if (bindings.bookPresence === 'actual-primary-book') {
        if (!openingSourceObject(rawBook) || bindings.originalBookAbsence !== null
            || actualEntries.length !== bindings.rawEntries.length)
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/rawBook');
    }
    else if (bindings.bookPresence !== 'actual-proven-book-absence' || rawBook !== null || bindings.rawEntries.length
        || !bindings.originalBookAbsence)
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/bookAbsence');
    const initEntries = [];
    let macros = false;
    for (const [index, entry] of bindings.rawEntries.entries()) {
        exact(entry, ['ordinal', 'entryId', 'sourceKey', 'sourcePointer', 'rawEntrySha256', 'original', 'isInitVar', 'enabled',
            'renderedContent', 'identityRendering', 'effectivePromptContentSha256'], '/rawEntries/' + index);
        const original = entry.original, actual = actualEntries[index], programEntry = proof.program.bookEntries.find(item => item.originalAddress === entry.sourcePointer);
        if (!openingSourceObject(original) || !actual || actual[0] !== entry.sourceKey || !same(actual[1], original)
            || entry.ordinal !== index || !same(original, actual[1]) || recordSha256(original) !== entry.rawEntrySha256
            || !programEntry || programEntry.entryId !== entry.entryId || programEntry.sourceKey !== entry.sourceKey
            || programEntry.rawEntrySha256 !== entry.rawEntrySha256 || programEntry.original.text !== original.content
            || programEntry.effective.textSha256 !== entry.effectivePromptContentSha256
            || typeof original.content !== 'string' || !hash(entry.effectivePromptContentSha256)
            || entry.sourcePointer !== '/data/character_book/entries/' + entry.sourceKey.replace(/~/g, '~0').replace(/\//g, '~1')
            || entry.isInitVar !== String(original.comment ?? '').toLowerCase().includes('[initvar]')
            || entry.enabled !== (original.enabled !== false && original.disable !== true)) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/rawEntries/' + index);
        }
        if (entry.isInitVar) {
            const rendered = renderPromptOpeningIdentityV1(original.content, proof.context.values, entry.sourcePointer, [{ start: 0, end: original.content.length }]);
            if (entry.renderedContent !== rendered.text || !same(entry.identityRendering, rendered.facts)) {
                openingSourceFail('OPENING_SOURCE_PROOF_INVALID', entry.sourcePointer);
            }
            macros ||= rendered.facts.used;
            initEntries.push({ identity: `entry-${index}`, sourcePointer: entry.sourcePointer, comment: String(original.comment ?? ''),
                enabled: entry.enabled, content: original.content, contentSha256: sha256(original.content), renderedContent: rendered.text,
                renderedContentSha256: sha256(rendered.text) });
        }
        else if (entry.renderedContent !== null || entry.identityRendering !== null) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', entry.sourcePointer);
        }
    }
    if (!same(bindings.bookInitEntryPointers, bindings.rawEntries.filter(entry => entry.isInitVar).map(entry => entry.sourcePointer))
        || bindings.entryOrderSha256 !== recordSha256(bindings.rawEntries.map(entry => ({ ordinal: entry.ordinal,
            pointer: entry.sourcePointer, rawEntrySha256: entry.rawEntrySha256, isInitVar: entry.isInitVar })))
        || bindings.greetingFactsSha256 !== recordSha256(bindings.greetingFacts)
        || bindings.greetingFacts.length !== proof.catalog.candidates.length)
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/bindings/order');
    // Array.isArray narrows a serialized readonly array to an untyped JS array.
    // Restore the protocol row type only after that real shape/budget check;
    // every row still passes exact keys and primitive checks before parsing.
    const greetings = bindings.greetingFacts;
    for (const [index, greeting] of greetings.entries()) {
        exact(greeting, ['index', 'sourcePointer', 'sourceSha256', 'rawText', 'renderedText', 'renderedSha256', 'macros',
            'identityRendering', 'originalInitBlocks', 'renderedInitBlocks'], '/greetings/' + index);
        if (typeof greeting.rawText !== 'string' || typeof greeting.sourcePointer !== 'string' || typeof greeting.renderedText !== 'string') {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/greetings/' + index);
        }
        const candidate = proof.catalog.candidates[index], blocks = readPromptOpeningGreetingBlocksV1(greeting.rawText, greeting.sourcePointer);
        const rendered = renderPromptOpeningIdentityV1(greeting.rawText, proof.context.values, greeting.sourcePointer, blocks.map(block => ({ start: block.bodyStart, end: block.bodyEnd })));
        if (!candidate || greeting.index !== candidate.index || greeting.sourcePointer !== candidate.sourcePointer
            || greeting.rawText !== candidate.rawText || greeting.sourceSha256 !== sha256(greeting.rawText)
            || greeting.renderedText !== candidate.renderedText || greeting.renderedText !== rendered.text
            || greeting.renderedSha256 !== sha256(rendered.text) || !same(greeting.macros, candidate.macros)
            || !same(greeting.identityRendering, rendered.facts) || !same(greeting.originalInitBlocks, blocks)
            || !same(greeting.renderedInitBlocks, readPromptOpeningGreetingBlocksV1(rendered.text, greeting.sourcePointer))) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', greeting.sourcePointer);
        }
        macros ||= rendered.facts.used;
    }
    const books = bindings.bookPresence === 'actual-primary-book'
        ? [{ identity: 'embedded-primary', binding: 'primary', sourcePointer: bindings.bookPointer,
                sourceSha256: bindings.rawBookSha256, entries: initEntries }] : [];
    const swipes = greetings.map(greeting => ({ identity: `swipe-${greeting.index}`,
        sourcePointer: greeting.sourcePointer, sourceSha256: greeting.sourceSha256, rawOpening: greeting.rawText,
        renderedOpening: greeting.renderedText, renderedSha256: greeting.renderedSha256, statData: {} }));
    const policy = selectNativeMvuInitializationPolicy({ books, swipes });
    if (policy.kind !== 'selected' || !same(policy.policy, value.grammarPolicy))
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/grammarPolicy');
    const descriptor = { schemaVersion: 1, encoding: 'native-mvu-schema-opening-init-source-v1',
        grammar: isNativeMvuYamlSourcePolicy(policy.policy) ? 'yaml-1.2-json-data-v1' : 'strict-json-object-v1',
        books, bookStatData: {}, initializedBooks: [], messageIndex: 0, selectedSwipeIdentity: `swipe-${proof.selected.index}`,
        swipes, macros: macros ? 'verified-identity-rendering' : 'none' };
    if (!same(value.data, { ...descriptor, initSourceSha256: recordSha256(descriptor) })
        || value.dataSha256 !== recordSha256(value.data) || value.calculationSha256 !== recordSha256(value.calculation)
        || !same(compileSchemaMvuInitData(value.data), value.calculation) || value.calculation.kind !== 'parsed'
        || value.inputBindingSha256 !== promptOpeningInitializationInputBindingV1(proof.program, value.data, value.grammarPolicy, bindings)) {
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/initialization/calculation');
    }
    const markerCount = initEntries.length + bindings.greetingFacts.reduce((sum, greeting) => sum + greeting.originalInitBlocks.length, 0);
    if (value.markerCount !== markerCount || markerCount > 0 && value.kind !== 'raw-init-data'
        || markerCount === 0 && (value.kind !== 'absent' || value.reason !== 'no-actual-initvar-markers')) {
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/initialization/kind');
    }
}
/** Stored consistency only. Readers must also call the actual owner's current
 * predicate; a checksum or calculator result grants no runtime capability. */
export function validatePromptOpeningSourceProofV1(input) {
    try {
        if (input !== null && typeof input === 'object' && parsedOpeningSourceProofs.has(input)) {
            return input;
        }
        const value = clonePromptOpeningSourceDataV1(input);
        exact(value, ['schemaVersion', 'encoding', 'authority', 'policySha256', 'source', 'sourceRelation', 'program', 'catalog',
            'catalogSha256', 'context', 'selected', 'initialization', 'initializationInputBindingSha256',
            'promptCurrentInputBindingSha256', 'authorityLimits', 'bindingSha256', 'proofSha256'], '/proof');
        const proof = value;
        const { proofSha256, bindingSha256, ...body } = proof;
        if (proof.schemaVersion !== 1 || proof.encoding !== 'native-prompt-opening-source-proof-v1'
            || proof.authority !== 'consumer-data-only' || proof.policySha256 !== PROMPT_OPENING_SOURCE_POLICY_SHA256
            || proofSha256 !== recordSha256({ bindingSha256, ...body }) || bindingSha256 !== recordSha256(bindingBody(body))) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/proof/hash');
        }
        const program = validatePromptProgramSourceInventoryV1(proof.program), tuple = program.importTuple, selected = proof.selected;
        exact(proof.source, ['sessionId', 'importId', 'sourceRecordSessionId', 'rawSha256', 'normalizedSha256', 'transactionId',
            'coverageSha256', 'pointer'], '/source');
        exact(proof.context, ['values', 'bindingSha256', 'valuesSha256', 'policy'], '/context');
        exact(selected, ['index', 'sourcePointer', 'sourceSha256', 'rawText', 'renderedText', 'renderedSha256'], '/selected');
        if (proof.source.sessionId !== program.sessionId || proof.source.sourceRecordSessionId !== tuple.sourceRecordSessionId
            || proof.source.importId !== tuple.importId || proof.source.rawSha256 !== tuple.rawSha256
            || proof.source.normalizedSha256 !== tuple.normalizedSha256 || proof.source.transactionId !== tuple.transactionId
            || proof.source.coverageSha256 !== tuple.coverageSha256 || !same(proof.source.pointer, tuple.activePointer)
            || !same(proof.catalog.source, proof.source) || proof.catalogSha256 !== recordSha256(proof.catalog)
            || proof.context.policy !== 'only-actual-three-identity-macros-v1' || !hash(proof.context.bindingSha256)
            || proof.context.valuesSha256 !== recordSha256(proof.context.values)
            || !Number.isSafeInteger(selected.index) || selected.index < 0)
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/source/binding');
        const candidate = proof.catalog.candidates.find(item => item.index === selected.index);
        if (!candidate || candidate.sourcePointer !== selected.sourcePointer || candidate.sourceSha256 !== selected.sourceSha256
            || candidate.rawText !== selected.rawText || candidate.renderedText !== selected.renderedText
            || selected.renderedSha256 !== sha256(selected.renderedText)
            || !same(proof.authorityLimits, { freshBasis: 'not-proven', numericalAbsence: 'not-proven', initialized: 'not-claimed',
                schemaExecution: 'none', native: 'not-authorized', protectedRenderer: 'not-authorized', publish: 'not-authorized' })) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/selection');
        }
        exact(proof.sourceRelation, ['kind', 'native', 'branchMetaRef', 'inheritance', 'setup'], '/sourceRelation');
        exact(proof.sourceRelation.native, ['sessionId', 'headerId', 'parentSessionId', 'inheritedEventCount', 'origin'], '/native');
        const relation = proof.sourceRelation;
        if (relation.native.sessionId !== program.sessionId || relation.native.parentSessionId !== null
            || relation.native.inheritedEventCount !== 0 || relation.branchMetaRef.table !== 'branch'
            || relation.branchMetaRef.key !== program.sessionId + '__meta' || relation.branchMetaRef.exists !== true
            || !program.currentRows.some(row => same(row, relation.branchMetaRef)))
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/relation');
        if (relation.kind === 'own-root-source') {
            if (relation.inheritance !== null || relation.setup !== null || tuple.sourceInheritance !== null
                || tuple.sourceRecordSessionId !== program.sessionId)
                openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/relation/root');
        }
        else if (relation.kind !== 'committed-fresh-cut0-source' || !same(relation.inheritance, tuple.sourceInheritance)
            || relation.inheritance.childSessionId !== program.sessionId || relation.inheritance.nativeCut.kind !== 'reserved-fresh-branch'
            || relation.inheritance.nativeCut.seedLength !== 0 || !same(relation.setup.applyIntentRef, relation.inheritance.applyIntentRef)
            || relation.setup.nativeSetupSha256 !== recordSha256(relation.setup.nativeSetup)) {
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/relation/fresh');
        }
        validateInitialization(proof.initialization, proof);
        if (proof.initializationInputBindingSha256 !== proof.initialization.inputBindingSha256
            || proof.promptCurrentInputBindingSha256 !== program.bindingSha256)
            openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/inputBindings');
        const checked = freezePromptOpeningSourceDataV1(proof);
        parsedOpeningSourceProofs.add(checked);
        return checked;
    }
    catch (error) {
        if (error instanceof PromptOpeningSourceFailureV1)
            throw error;
        return openingSourceFail('OPENING_SOURCE_PROOF_INVALID', '/proof');
    }
}
export function createRoleplayPromptOpeningSourceV1(deps) {
    const programs = createRoleplayPromptProgramSourceV1(deps);
    let closed = false;
    let captures = new WeakMap();
    function readRelation(source) {
        const sid = source.sessionId, session = deps.session(sid), header = session?.header, meta = source.current.rows.find(row => row.ref.table === 'branch' && row.ref.key === sid + '__meta');
        if (!session || session.id !== sid || !header || header.parentSession !== undefined && header.parentSession !== ''
            || session.inheritedEventCount !== 0 || !meta?.ref.exists || !meta.value) {
            openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN', '/native');
        }
        const native = { sessionId: sid, headerId: typeof header.id === 'string' ? header.id : null, parentSessionId: null,
            inheritedEventCount: 0, origin: typeof header.origin === 'string' ? header.origin : null };
        if (!source.inheritance) {
            const pointer = source.original.activePointer;
            if (source.sourceRecordSessionId !== sid || pointer.inheritedFrom !== undefined
                || ['sourceInheritance', 'inheritanceState', 'freshBranchFrom', 'inheritedFrom', 'inheritedAtSeedLength']
                    .some(key => Object.hasOwn(meta.value, key)))
                openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN', '/source/root');
            return seal({ kind: 'own-root-source', native, branchMetaRef: meta.ref, inheritance: null, setup: null });
        }
        if (!deps.sourceInheritance)
            openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN', '/source/inheritance-owner');
        const actual = deps.sourceInheritance.readCommittedStaticSourceInheritance(sid), inheritance = actual.inheritance, apply = actual.applyIntent;
        if (!same(inheritance, source.inheritance) || inheritance.childSessionId !== sid
            || inheritance.nativeCut.kind !== 'reserved-fresh-branch' || inheritance.nativeCut.seedLength !== 0
            || actual.prepared.childSessionId !== sid || actual.prepared.nativeCut.kind !== 'reserved-fresh-branch'
            || actual.prepared.nativeCut.seedLength !== 0 || apply.childSessionId !== sid || !apply.nativeSetup
            || recordSha256(actual.prepared) !== inheritance.preparedRef.sha256
            || recordSha256(apply) !== inheritance.applyIntentRef.sha256
            || recordSha256(actual.commit) !== inheritance.commitRef.sha256
            || recordSha256(actual.ready) !== inheritance.readyRef.sha256
            || !Number.isSafeInteger(apply.nativeSetup.eventCount) || apply.nativeSetup.eventCount < 0
            || !hash(apply.nativeSetup.prefixSha256) || !same(apply.preparedRef, inheritance.preparedRef)
            || !same(actual.commit.applyIntentRef, inheritance.applyIntentRef)
            || !same(actual.ready.binding.commitRef, inheritance.commitRef)
            || inheritance.originalBinding.sourceRecordSessionId !== source.sourceRecordSessionId
            || inheritance.originalBinding.importId !== source.original.activePointer.importId
            || inheritance.originalBinding.importRecordRef.sha256 !== source.original.importRecordRef.sha256
            || inheritance.originalBinding.rawSha256 !== source.original.rawSha256
            || inheritance.originalBinding.normalizedSha256 !== source.original.normalizedSha256
            || inheritance.originalBinding.coverageSha256 !== source.original.coverageSha256
            || inheritance.originalBinding.transactionId !== source.original.transactionId
            || inheritance.originalBinding.normalizer !== source.normalizer
            || inheritance.originalBinding.documentSha256 !== source.original.documentSha256
            || inheritance.originalBinding.dataSha256 !== source.original.dataSha256) {
            openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN', '/source/fresh');
        }
        // The actual Source owner has validated the original setup prefix in the
        // real Session. Do not require today's events to be empty after append.
        return seal({ kind: 'committed-fresh-cut0-source', native, branchMetaRef: meta.ref, inheritance,
            setup: { applyIntentRef: inheritance.applyIntentRef, nativeSetup: apply.nativeSetup,
                nativeSetupSha256: recordSha256(apply.nativeSetup) } });
    }
    function read(sid, index, style, assertOwnerCurrent, saveCapture) {
        if (closed)
            openingSourceFail('OPENING_SOURCE_CHANGED', '/owner/disposed');
        assertOwnerCurrent();
        if (!sid || !Number.isSafeInteger(index) || index < 0 || typeof style !== 'boolean') {
            openingSourceFail('OPENING_SOURCE_SELECTION_INVALID', '/request');
        }
        const sessionReader = deps.session, contextReader = deps.readOpeningContext, inheritanceOwner = deps.sourceInheritance, inheritanceReader = inheritanceOwner?.readCommittedStaticSourceInheritance, actualSession = deps.session(sid);
        const supplied = programs.captureWithCurrentSource(sid, style, assertOwnerCurrent);
        if (supplied.kind !== 'captured-program-source')
            openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE', '/program');
        const source = supplied.source, program = supplied.data, tuple = program.importTuple;
        if (program.audit.wholeSourceSha256 !== source.sourceSha256
            || program.sourceCurrentIdentitySha256 !== recordSha256(tavernLoreSourceCurrentIdentityV1(source))) {
            openingSourceFail('OPENING_SOURCE_CHANGED', '/source/program');
        }
        const record = clonePromptOpeningSourceDataV1(deps.readImportRecord(source.sourceRecordSessionId, tuple.importId));
        assertImportRecordIntegrity(record);
        if (!record.sourceEnvelope || !record.activation || record.status !== 'active' || record.sessionId !== source.sourceRecordSessionId
            || record.importId !== tuple.importId || recordSha256(record) !== tuple.importRecordRef.sha256
            || record.rawSha256 !== tuple.rawSha256 || record.normalizedSha256 !== tuple.normalizedSha256
            || recordSha256(record.activation) !== tuple.activationSha256)
            openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN', '/importRecord');
        const decoded = decodeTavernCard(Buffer.from(record.sourceEnvelope.base64, 'base64'), record.sourceEnvelope.extension);
        if (decoded.data !== decoded.document.data || decoded.format !== tuple.format
            || recordSha256(decoded.document) !== tuple.documentSha256 || recordSha256(decoded.data) !== tuple.dataSha256
            || projectStructuredImport(record, decoded).text !== record.normalizedSource) {
            openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN', '/decoded');
        }
        const context = clonePromptOpeningSourceDataV1(deps.readOpeningContext(sid));
        if (!same(context.context, source.current.openingContext.context)
            || context.bindingSha256 !== source.current.openingContext.bindingSha256
            || recordSha256(context.context) !== source.current.openingContext.valuesSha256)
            openingSourceFail('OPENING_SOURCE_CHANGED', '/context');
        const openingSource = { sessionId: sid, importId: tuple.importId, sourceRecordSessionId: tuple.sourceRecordSessionId,
            rawSha256: tuple.rawSha256, normalizedSha256: tuple.normalizedSha256, transactionId: tuple.transactionId,
            coverageSha256: tuple.coverageSha256, pointer: tuple.activePointer };
        const catalog = { source: openingSource, candidates: compileTavernOpeningCandidates(decoded, context.context) }, candidate = catalog.candidates.find(item => item.index === index);
        if (!candidate)
            openingSourceFail('OPENING_SOURCE_SELECTION_INVALID', '/selection');
        const sourceRelation = readRelation(source), initialization = calculatePromptOpeningRawInitV1({ source, decoded, record, program,
            candidates: catalog.candidates, selectedIndex: index, context: context.context });
        const body = { schemaVersion: 1, encoding: 'native-prompt-opening-source-proof-v1',
            authority: 'consumer-data-only', policySha256: PROMPT_OPENING_SOURCE_POLICY_SHA256,
            source: openingSource, sourceRelation, program, catalog, catalogSha256: recordSha256(catalog),
            context: { values: context.context, bindingSha256: context.bindingSha256, valuesSha256: recordSha256(context.context),
                policy: 'only-actual-three-identity-macros-v1' },
            selected: { index, sourcePointer: candidate.sourcePointer, sourceSha256: candidate.sourceSha256, rawText: candidate.rawText,
                renderedText: candidate.renderedText, renderedSha256: sha256(candidate.renderedText) }, initialization,
            initializationInputBindingSha256: initialization.inputBindingSha256, promptCurrentInputBindingSha256: program.bindingSha256,
            authorityLimits: { freshBasis: 'not-proven', numericalAbsence: 'not-proven', initialized: 'not-claimed',
                schemaExecution: 'none', native: 'not-authorized', protectedRenderer: 'not-authorized',
                publish: 'not-authorized' } };
        const bound = { ...body, bindingSha256: recordSha256(bindingBody(body)) };
        const proof = validatePromptOpeningSourceProofV1({ ...bound, proofSha256: recordSha256(bound) }), importRecordSha256 = tuple.importRecordRef.sha256, contextSha256 = recordSha256(context), relationSha256 = recordSha256(relationBinding(sourceRelation, program.sourceCurrentIdentitySha256));
        const assertReaderOwners = () => {
            if (closed || deps.session !== sessionReader || deps.readOpeningContext !== contextReader
                || deps.sourceInheritance !== inheritanceOwner
                || inheritanceOwner?.readCommittedStaticSourceInheritance !== inheritanceReader
                || !actualSession || deps.session(sid) !== actualSession) {
                openingSourceFail('OPENING_SOURCE_CHANGED', '/owner/readers');
            }
        };
        const assertCurrent = () => {
            assertReaderOwners();
            assertOwnerCurrent();
            // Same producer-owned Source/edit footprint as the program inventory.
            // Decode, catalog and raw calculator are pure results from that complete
            // first validation; the actual Session/setup reader remains live.
            supplied.assertCurrent();
            if (recordSha256(deps.readImportRecord(source.sourceRecordSessionId, tuple.importId)) !== importRecordSha256
                || recordSha256(clonePromptOpeningSourceDataV1(deps.readOpeningContext(sid))) !== contextSha256
                || recordSha256(relationBinding(readRelation(source), program.sourceCurrentIdentitySha256)) !== relationSha256) {
                openingSourceFail('OPENING_SOURCE_CHANGED', '/current');
            }
            assertReaderOwners();
            assertOwnerCurrent();
        };
        assertCurrent();
        saveCapture?.(proof, { wholeSha256: recordSha256(proof), proofSha256: proof.proofSha256, assertCurrent });
        return proof;
    }
    function capture(sessionId, selectedIndex, includeCardStyle, assertOwnerCurrent) {
        try {
            const proof = read(sessionId, selectedIndex, includeCardStyle, assertOwnerCurrent, (owned, currency) => captures.set(owned, currency)), live = captures.get(proof);
            if (!live)
                openingSourceFail('OPENING_SOURCE_UNAVAILABLE', '/capture');
            return { kind: 'captured-opening-source', proof, assertCurrent: live.assertCurrent };
        }
        catch (error) {
            const diagnostic = error instanceof PromptOpeningSourceFailureV1
                ? { code: error.code, pointer: error.pointer, ...(error.calculatorCode ? { calculatorCode: error.calculatorCode } : {}) }
                : { code: 'OPENING_SOURCE_UNAVAILABLE', pointer: '/source' };
            return seal({ kind: 'refused', authority: 'none', diagnostics: [diagnostic] });
        }
    }
    function current(input, assertOwnerCurrent) {
        try {
            const proof = validatePromptOpeningSourceProofV1(input);
            return read(proof.source.sessionId, proof.selected.index, proof.program.includeCardStyle, assertOwnerCurrent)
                .bindingSha256 === proof.bindingSha256;
        }
        catch {
            return false;
        }
    }
    function currentCaptured(input, assertActualOwnerCurrent) {
        try {
            assertActualOwnerCurrent();
            const live = input && typeof input === 'object' ? captures.get(input) : undefined;
            if (!live)
                return current(input, assertActualOwnerCurrent);
            if (closed || !Object.isFrozen(input) || input.proofSha256 !== live.proofSha256) {
                openingSourceFail('OPENING_SOURCE_CHANGED', '/capture');
            }
            live.assertCurrent();
            assertActualOwnerCurrent();
            return true;
        }
        catch {
            return false;
        }
    }
    function dispose() { closed = true; captures = new WeakMap(); programs.dispose(); }
    return { capture, current, currentCaptured, dispose };
}
