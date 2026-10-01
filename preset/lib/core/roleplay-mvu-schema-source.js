// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-source.ts; edit the TypeScript source.
/** Original author provenance and current story material are separate facts.
 * Neither descriptor can recreate Core's private Native publication owner. */
import { recordSha256 } from './roleplay-data.js';
import { createRoleplayMvuSource, readMvuSchemaCurrentAuthorSource } from './roleplay-mvu-source.js';
import { freezeSchemaJournalData, createRoleplayMvuSchemaJournal } from './roleplay-mvu-schema-journal.js';
import { validateMvuSchemaOpeningPreparation } from './roleplay-mvu-schema-opening-types.js';
import { compileSchemaMvuInitData } from './tavern-mvu-initvar.js';
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'SCHEMA_SOURCE_INVALID';
const hash = (input) => typeof input === 'string' && /^[a-f0-9]{64}$/.test(input);
function exact(input, keys) {
    if (!same(Object.keys(input).sort(), [...keys].sort()))
        fail('SCHEMA_CURRENT_MATERIAL_INVALID');
}
/** Bounded data validation only. A matching checksum does not establish the
 * original program, a current Source observation or publication permission. */
export function validateSchemaStorySourceFrame(input) {
    try {
        const frame = cloneSchemaData(input, 8 * 1048576), snapshot = frame.snapshot, material = frame.material;
        exact(frame, ['schemaVersion', 'encoding', 'sessionId', 'material', 'materialSha256', 'snapshot', 'snapshotSha256']);
        exact(material, ['card', 'rows', 'openingContext']);
        cloneSchemaData(material, 4 * 1048576);
        exact(snapshot, ['schemaVersion', 'encoding', 'source', 'pointerSha256', 'importRecordSha256', 'coverageSha256', 'materialRows',
            'settings', 'bindings', 'selected', 'swipes', 'macroContext', 'documentSha256', 'snapshotSha256']);
        const { snapshotSha256, ...body } = snapshot;
        if (frame.schemaVersion !== 1 || frame.encoding !== 'native-mvu-schema-story-source-frame-v1'
            || typeof frame.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(frame.sessionId)
            || snapshot.schemaVersion !== 1 || snapshot.encoding !== 'native-mvu-author-source-snapshot-v1'
            || snapshot.source.sessionId !== frame.sessionId || !hash(snapshotSha256) || recordSha256(body) !== snapshotSha256
            || frame.snapshotSha256 !== snapshotSha256 || frame.materialSha256 !== recordSha256(material)
            || snapshot.documentSha256 !== recordSha256(material.card)
            || !Array.isArray(material.rows) || !Array.isArray(snapshot.materialRows)
            || material.rows.length !== snapshot.materialRows.length || material.rows.length > 4096) {
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        }
        const refs = new Map(snapshot.materialRows.map(ref => [`${ref.table}:${ref.key}`, ref]));
        if (refs.size !== snapshot.materialRows.length)
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        const materialRefs = new Map(refs);
        for (const ref of refs.values())
            exact(ref, ['table', 'key', 'exists', 'sha256']);
        for (const raw of material.rows) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                fail('SCHEMA_CURRENT_MATERIAL_INVALID');
            const row = raw;
            exact(row, ['table', 'key', 'exists', 'value']);
            const ref = refs.get(`${row.table}:${row.key}`);
            if (!ref || !['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'].includes(row.table)
                || !row.key.startsWith(`${frame.sessionId}__`) || typeof row.exists !== 'boolean' || ref.exists !== row.exists
                || !row.exists && row.value !== null || ref.sha256 !== recordSha256(row.exists ? row.value : undefined)) {
                fail('SCHEMA_CURRENT_MATERIAL_INVALID');
            }
            if ((row.table === 'branch' && row.key !== `${frame.sessionId}__settings`)
                || (row.table === 'rules' && row.key !== `${frame.sessionId}__spec`)
                || (row.table === 'status' && row.key !== `${frame.sessionId}__spec`)
                || (row.table === 'opening' && row.key !== `${frame.sessionId}__scene`))
                fail('SCHEMA_CURRENT_MATERIAL_INVALID');
            refs.delete(`${row.table}:${row.key}`);
        }
        if (refs.size)
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        exact(snapshot.settings, ['cards', 'worldbook', 'rules', 'settings', 'membershipSha256']);
        const { membershipSha256, ...membership } = snapshot.settings;
        if (membershipSha256 !== recordSha256(membership))
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        for (const table of ['cards', 'worldbook']) {
            const declared = snapshot.settings[table];
            const actual = Object.fromEntries([...materialRefs.values()].filter(ref => ref.table === table && ref.exists)
                .map(ref => [ref.key.slice(frame.sessionId.length + 2), ref.sha256]));
            if (!same(actual, declared))
                fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        }
        if (snapshot.settings.rules !== materialRefs.get(`rules:${frame.sessionId}__spec`)?.sha256
            || snapshot.settings.settings !== materialRefs.get(`branch:${frame.sessionId}__settings`)?.sha256) {
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        }
        const context = material.openingContext;
        if (!context || typeof context !== 'object' || Array.isArray(context)
            || Object.keys(context).some(key => !['user', 'char', 'user_gender'].includes(key))
            || Object.values(context).some(value => typeof value !== 'string' || value.length > 512))
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        exact(snapshot.macroContext, ['used', 'bindingSha256', 'valuesSha256']);
        if (typeof snapshot.macroContext.used !== 'boolean' || (snapshot.macroContext.used
            ? !hash(snapshot.macroContext.bindingSha256) || snapshot.macroContext.valuesSha256 !== recordSha256(context)
            : snapshot.macroContext.bindingSha256 !== null || snapshot.macroContext.valuesSha256 !== null)) {
            fail('SCHEMA_CURRENT_MATERIAL_INVALID');
        }
        return freezeSchemaJournalData(frame);
    }
    catch (error) {
        fail(codeOf(error));
    }
}
export function createRoleplayMvuSchemaSource(deps, markers) {
    function originalRecord(original) {
        const source = original.sourceSnapshot.source;
        const record = deps.readImportRecord(source.sourceRecordSessionId, source.importId);
        if (recordSha256(record) !== original.sourceSnapshot.importRecordSha256)
            fail('SCHEMA_ORIGINAL_SOURCE_CHANGED');
        return record;
    }
    function reconstruct(preparation, material) {
        const snapshot = preparation.sourceSnapshot, sid = preparation.identity.sessionId;
        const rows = material.rows;
        if (!Array.isArray(rows) || !same(Object.keys(material).sort(), ['card', 'openingContext', 'rows'])) {
            fail('SCHEMA_FROZEN_MATERIAL_INVALID');
        }
        const byKey = new Map();
        for (const raw of rows) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                fail('SCHEMA_FROZEN_MATERIAL_INVALID');
            const row = raw;
            if (!same(Object.keys(row).sort(), ['exists', 'key', 'table', 'value']) || typeof row.exists !== 'boolean'
                || typeof row.table !== 'string' || typeof row.key !== 'string' || !row.key.startsWith(`${sid}__`)) {
                fail('SCHEMA_FROZEN_MATERIAL_INVALID');
            }
            const key = `${row.table}:${row.key}`;
            if (byKey.has(key) || !row.exists && row.value !== null)
                fail('SCHEMA_FROZEN_MATERIAL_INVALID');
            byKey.set(key, row);
        }
        // These are recorded inputs for historical reconstruction, not today's row
        // reads. The real immutable ImportRecord still supplies envelope/coverage.
        const historical = { ...deps,
            readActivePointer: () => snapshot.source.pointer,
            readImportRecord: () => originalRecord({ sourceSnapshot: snapshot }),
            readRow: (table, key) => {
                const row = byKey.get(`${table}:${key}`);
                if (!row)
                    fail('SCHEMA_FROZEN_MATERIAL_INVALID');
                return row.exists ? row.value : undefined;
            },
            recordVersionsFor: () => snapshot.settings,
            readOpeningContext: () => ({ context: material.openingContext,
                bindingSha256: snapshot.macroContext.bindingSha256 ?? recordSha256({}) }),
            readFreshNativeBasis: () => { fail('SCHEMA_FRESH_BASIS_UNSUPPORTED'); }, };
        const found = createRoleplayMvuSource(historical).readSchemaOpeningData(sid, preparation.identity.index);
        if (found.kind !== 'schema-opening-data' || !same(found.authorSource.snapshot, snapshot)
            || !same(found.authorSource.material, material)
            || found.authorSource.authorSourceSha256 !== preparation.authorSourceSha256)
            fail('SCHEMA_ORIGINAL_SOURCE_UNPROVEN');
        // Equal parsed values cannot prove the original raw entry identity, source
        // pointer, rendering bytes or grammar. Compare the complete real descriptor.
        if (!same(found.initSource, preparation.initSource))
            fail('SCHEMA_ORIGINAL_INIT_SOURCE_UNPROVEN');
        return found.authorSource;
    }
    function readFrozenOriginal(input, ready, actualEvents) {
        try {
            const preparation = validateMvuSchemaOpeningPreparation(input), sid = preparation.identity.sessionId;
            const records = new Map(ready.frozen.records.map(row => [row.key, row.record]));
            const journal = createRoleplayMvuSchemaJournal({ markers, table: {
                    get: key => records.get(key), entries: () => records.entries(), put: async () => { fail('SCHEMA_SOURCE_READ_ONLY'); },
                } });
            if (ready.frozen.nativeCut > actualEvents.length)
                fail('SCHEMA_NATIVE_CUT_UNPROVEN');
            const cut = actualEvents.slice(0, ready.frozen.nativeCut);
            const frozen = journal.validateFrozen(ready.frozen, cut);
            const actual = journal.captureFrozen(sid, preparation.realmEpoch, cut, frozen.records);
            if (actual.kind !== 'ready' || !same(actual, ready))
                fail('SCHEMA_NATIVE_CUT_UNPROVEN');
            const { epoch } = actual, first = actual.steps[0];
            if (epoch.sessionId !== sid || epoch.realmEpoch !== preparation.realmEpoch
                || first.dispatch.batchId !== preparation.selector.batchId
                || !same(first.dispatch.sourceNativeCut.anchor, preparation.selector.anchor)
                || first.dispatchMarker.seq !== preparation.freshNativeBasisProof.native.observedThroughSeq + 1
                || first.dispatch.sourceNativeCut.nativePrefixSha256 !== preparation.freshNativeBasisProof.native.historyVersionSha256
                || first.dispatch.sourceNativeCut.sourceSnapshotSha256 !== preparation.sourceSnapshot.snapshotSha256) {
                fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
            }
            const author = reconstruct(preparation, epoch.program.source.material), binding = epoch.program.source;
            const source = author.snapshot.source;
            if (binding.ownerSessionId !== sid || binding.importId !== source.importId || binding.sourceSha256 !== source.rawSha256
                || binding.importRecordSha256 !== author.snapshot.importRecordSha256
                || binding.sourceSnapshotSha256 !== author.snapshot.snapshotSha256 || binding.materialSha256 !== author.materialSha256
                || !same(epoch.program.scripts.map(({ imports: _imports, javascript: _js, javascriptSha256: _hash, ...script }) => script), author.scripts))
                fail('SCHEMA_ORIGINAL_PROGRAM_UNPROVEN');
            const parsed = compileSchemaMvuInitData(preparation.initSource), load = epoch.loadFrame, frame = first.step.frame;
            if (parsed.kind !== 'parsed' || load.ownerSessionId !== sid || frame.ownerSessionId !== sid
                || !same(load.material, author.material) || !same(frame.material, author.material)
                || !same(load.values, parsed.values) || !same(load.context, parsed.context)
                || !same(frame.input.values, parsed.values) || !same(frame.input.context, parsed.context)
                || frame.input.phase !== 'initialization' || frame.input.base !== null || frame.input.commands.length !== 0
                || load.sourceNativeCutSha256 !== recordSha256(first.dispatch.sourceNativeCut)
                || frame.sourceNativeCutSha256 !== load.sourceNativeCutSha256
                || load.clockEpochMs !== preparation.clockEpochMs || load.randomSeed !== preparation.randomSeed
                || frame.input.clockEpochMs !== load.clockEpochMs || frame.input.randomSeed !== load.randomSeed) {
                fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN');
            }
            const authorInput = { schemaVersion: 1, source: epoch.program.source,
                libraries: epoch.program.libraries, bridge: epoch.program.bridge,
                scripts: epoch.program.scripts.map(({ javascript: _js, javascriptSha256: _hash, ...script }) => script) };
            const body = { schemaVersion: 1, encoding: 'native-mvu-schema-frozen-original-v1', sessionId: sid,
                preparation, sourceSnapshot: author.snapshot, authorInput, programSha256: epoch.program.programSha256,
                realmEpoch: epoch.realmEpoch };
            return freezeSchemaJournalData({ ...body, originalSha256: recordSha256(body) });
        }
        catch (error) {
            fail(codeOf(error));
        }
    }
    function originalCurrent(original) {
        try {
            original = freezeSchemaJournalData(original);
            const { originalSha256, ...body } = original;
            exact(original, ['schemaVersion', 'encoding', 'sessionId', 'preparation', 'sourceSnapshot', 'authorInput',
                'programSha256', 'realmEpoch', 'originalSha256']);
            validateMvuSchemaOpeningPreparation(original.preparation);
            if (original.schemaVersion !== 1 || original.encoding !== 'native-mvu-schema-frozen-original-v1'
                || recordSha256(body) !== originalSha256 || original.sessionId !== original.preparation.identity.sessionId
                || original.realmEpoch !== original.preparation.realmEpoch
                || !same(original.sourceSnapshot, original.preparation.sourceSnapshot))
                return false;
            originalRecord(original);
            const author = reconstruct(original.preparation, original.authorInput.source.material), source = author.snapshot.source;
            if (!same(original.authorInput.source, { ownerSessionId: original.sessionId, importId: source.importId,
                sourceSha256: source.rawSha256, importRecordSha256: author.snapshot.importRecordSha256,
                sourceSnapshotSha256: author.snapshot.snapshotSha256, material: author.material, materialSha256: author.materialSha256 })
                || !same(original.authorInput.scripts.map(({ imports: _imports, ...script }) => script), author.scripts))
                return false;
            return same(deps.readActivePointer(original.sessionId), original.sourceSnapshot.source.pointer);
        }
        catch {
            return false;
        }
    }
    function captureFrame(original) {
        try {
            if (!originalCurrent(original))
                fail('SCHEMA_ORIGINAL_SOURCE_CHANGED');
            const found = readMvuSchemaCurrentAuthorSource(deps, original.sessionId, original.preparation.identity.index);
            if (found.kind !== 'author-source')
                fail('SCHEMA_CURRENT_MATERIAL_INVALID');
            const author = found.source;
            if (!same(author.scripts, original.authorInput.scripts.map(({ imports: _imports, ...script }) => script))
                || author.snapshot.documentSha256 !== original.sourceSnapshot.documentSha256 || !originalCurrent(original)) {
                fail('SCHEMA_ORIGINAL_SOURCE_CHANGED');
            }
            return validateSchemaStorySourceFrame({ schemaVersion: 1, encoding: 'native-mvu-schema-story-source-frame-v1',
                sessionId: original.sessionId, material: author.material, materialSha256: author.materialSha256,
                snapshot: author.snapshot, snapshotSha256: author.snapshot.snapshotSha256 });
        }
        catch (error) {
            fail(codeOf(error));
        }
    }
    function frameCurrent(original, frame) {
        try {
            return same(frame, captureFrame(original));
        }
        catch {
            return false;
        }
    }
    return { readFrozenOriginal, captureFrame, originalCurrent, frameCurrent };
}
