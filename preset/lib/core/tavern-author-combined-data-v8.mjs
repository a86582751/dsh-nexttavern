// Generated from runtime/alpha3/src/core/tavern-author-combined-data-v8.mts; edit the TypeScript source.
/** Stored Combined8 Source layout and dispositions. DATA restoration grants
 * neither a live native bridge nor a numerical publication owner. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaDescriptorEnvelopeV4 } from './tavern-mvu-schema-data.js';
import { validateSchemaCompilationInputV4, validateMvuExecutableProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { authorNativeProgramSha256V1 } from './author-native-program.mjs';
import { identifyUnavailableExternalAddonV1, EXTERNAL_ADDON_RUNTIME_UNAVAILABLE } from './tavern-author-external-addons.mjs';
import { COMBINED_AUTHOR_DATA_BOUNDS_V8 as bounds } from './tavern-author-combined-types-v8.mjs';
const validatedPrograms = new WeakSet();
const same = (left, right) => recordSha256(left) === recordSha256(right);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function fail() { throw Error('COMBINED8_PROGRAM_DATA_INVALID'); }
function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function captureRecord(input) {
    return cloneSchemaDescriptorEnvelopeV4(input, bounds.descriptorBytes, { nodes: bounds.descriptorNodes, depth: bounds.descriptorDepth,
        arrayLength: bounds.descriptorArrayLength });
}
/** Fresh compiler outputs already own their accepted nested facts. */
export function captureCompiledCombinedAuthorProgramV8(program) {
    return freeze(captureRecord(program));
}
function checksum(value, key) {
    const { [key]: expected, ...body } = value;
    if (!hash(expected) || recordSha256(body) !== expected)
        fail();
}
export function validateCombinedAuthorProgramV8(input) {
    if (validatedPrograms.has(input))
        return input;
    const program = captureRecord(input);
    if (program.schemaVersion !== 8 || program.encoding !== 'native-author-combined-program-v8'
        || program.authority !== 'compiled-program-data-only' || typeof program.sourceRecordSessionId !== 'string'
        || !program.sourceRecordSessionId.length || program.sourceRecordSessionId.length > 256)
        fail();
    if (program.compiler?.id !== 'native-author-combined-compiler' || program.compiler.version !== 1
        || program.compiler.hostProtocol !== 5 || !hash(program.compiler.implementationSha256))
        fail();
    const original = validateSchemaCompilationInputV4(program.original);
    const executable = program.serverProgram === null ? null : validateMvuExecutableProgramV4(program.serverProgram);
    const owned = executable?.encoding === 'native-mvu-owned-state-program-v1' ? executable : null;
    const server = executable?.encoding === 'native-mvu-author-schema-program-v2' ? executable : null;
    const native = program.nativeProgram, layout = program.nativeLayout;
    if (!layout || !Array.isArray(layout.realms)
        || layout.numericalProfile !== null && layout.numericalProfile !== 'native-mvu-state-v1')
        fail();
    const membership = new Map();
    for (const realm of layout.realms) {
        if (typeof realm.realmId !== 'string' || typeof realm.groupId !== 'string' || !Array.isArray(realm.originalOrdinals))
            fail();
        for (const ordinal of realm.originalOrdinals)
            membership.set(ordinal, realm.realmId);
    }
    const { material: _material, ...source } = original.source;
    const locator = { ...source, sourceRecordSessionId: program.sourceRecordSessionId };
    if (executable && (!same(executable.source, original.source) || !same(executable.bridge, original.bridge)
        || !same(executable.stateLoader, original.stateLoader) || !same(executable.libraries, original.libraries)))
        fail();
    if (native !== null) {
        if (native.schemaVersion !== 1 || native.encoding !== 'author-native-program-v1'
            || native.authority !== 'captured-source-data-only' || !Array.isArray(native.scripts)
            || !same(native.source, locator))
            fail();
        const nativeOrdinals = new Set(native.scripts.map(script => script.originalOrdinal));
        if (!same(native.realms, layout.realms.filter(realm => realm.originalOrdinals.some((ordinal) => nativeOrdinals.has(ordinal)))
            .map(({ realmId, groupId }) => ({ realmId, groupId }))))
            fail();
        const { programSha256, ...body } = native;
        if (programSha256 !== authorNativeProgramSha256V1(body))
            fail();
    }
    const needsOwned = native?.scripts.some(script => script.enabled) && layout.numericalProfile === 'native-mvu-state-v1';
    if (owned && !needsOwned || needsOwned && !executable)
        fail();
    const plan = program.executionPlan;
    if (plan?.schemaVersion !== 4 || plan.encoding !== 'native-author-source-disposition-plan-v4'
        || plan.authority !== 'compiled-program-data-only' || !Array.isArray(plan.scripts)
        || plan.scripts.length !== original.scripts.length)
        fail();
    let serverIndex = 0, nativeIndex = 0, enabledNative = 0, disabled = 0, enabledExternalAddonsUnavailable = 0;
    for (const [ordinal, row] of plan.scripts.entries()) {
        const descriptor = original.scripts[ordinal];
        const common = { originalOrdinal: ordinal, identity: descriptor.identity, pointer: descriptor.pointer,
            enabled: descriptor.enabled, sourceSha256: descriptor.sourceSha256, rawDescriptorSha256: recordSha256(descriptor) };
        const dependency = identifyUnavailableExternalAddonV1(descriptor);
        let expected;
        if (dependency) {
            expected = { ...common, enabled: true, disposition: 'external-addon-unavailable', dependency,
                reason: EXTERNAL_ADDON_RUNTIME_UNAVAILABLE };
            enabledExternalAddonsUnavailable++;
        }
        else if (row.disposition === 'server') {
            const compiled = server?.scripts[serverIndex], classified = server?.executionPlan.scripts[serverIndex];
            if (!descriptor.enabled || !compiled || !classified)
                fail();
            const { javascript: _javascript, javascriptSha256: _sha, ...raw } = compiled;
            if (!same(raw, descriptor))
                fail();
            expected = { ...common, disposition: 'server', serverIndex,
                classification: classified.classification };
            serverIndex++;
        }
        else if (row.disposition === 'native' || row.disposition === 'disabled-source-retained') {
            const captured = native?.scripts[nativeIndex];
            if (!captured || captured.originalOrdinal !== ordinal || captured.realmId !== membership.get(ordinal)
                || captured.identity !== descriptor.identity || captured.pointer !== descriptor.pointer
                || captured.enabled !== descriptor.enabled || captured.javascript !== descriptor.source
                || captured.sourceSha256 !== descriptor.sourceSha256 || captured.descriptorSha256 !== common.rawDescriptorSha256)
                fail();
            expected = { ...common, disposition: descriptor.enabled ? 'native' : 'disabled-source-retained', nativeIndex };
            if (descriptor.enabled)
                enabledNative++;
            else
                disabled++;
            nativeIndex++;
        }
        else
            fail();
        if (!same(row, expected))
            fail();
    }
    if (serverIndex !== (server?.scripts.length ?? 0) || nativeIndex !== (native?.scripts.length ?? 0))
        fail();
    if (!same(plan.summary, { enabledServerSchema: server?.executionPlan.summary.enabledServerSchema ?? 0,
        enabledNativeLoaders: server?.executionPlan.summary.enabledNativeLoaders ?? 0, enabledNative, disabled,
        enabledExternalAddonsUnavailable }))
        fail();
    checksum(plan, 'executionPlanSha256');
    checksum(program, 'combinedProgramSha256');
    const checked = freeze({ ...program, original, serverProgram: executable, nativeProgram: native });
    validatedPrograms.add(checked);
    return checked;
}
export function combinedCompilationInputForProgramV8(program) {
    return { schemaVersion: 8, encoding: 'native-author-combined-compilation-input-v8',
        original: program.original, sourceRecordSessionId: program.sourceRecordSessionId, nativeLayout: program.nativeLayout };
}
