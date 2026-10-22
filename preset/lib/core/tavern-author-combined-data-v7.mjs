// Generated from runtime/alpha3/src/core/tavern-author-combined-data-v7.mts; edit the TypeScript source.
/** Stored Combined7 disposition DATA. Neither a known declaration nor its
 * unavailable row grants an external runtime, Native owner or execution ACK. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaDescriptorEnvelopeV4 } from './tavern-mvu-schema-data.js';
import { validateSchemaCompilationInputV4, validateSchemaProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { validatePromptProgramV1 } from './tavern-author-prompt-data.mjs';
import { validateStoredBrowserProgramDataV3 } from './tavern-author-combined-data-v6.mjs';
import { identifyUnavailableExternalAddonV1, EXTERNAL_ADDON_RUNTIME_UNAVAILABLE } from './tavern-author-external-addons.mjs';
import { COMBINED_AUTHOR_DATA_BOUNDS_V7 as bounds } from './tavern-author-combined-types-v7.mjs';
const validatedPrograms = new WeakSet();
const same = (left, right) => recordSha256(left) === recordSha256(right);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function fail() { throw Error('COMBINED7_PROGRAM_DATA_INVALID'); }
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
/** Fresh compilation already owns the nested results. Capture their immutable
 * DATA once under the same aggregate budget as historical decoding. */
export function captureCompiledCombinedAuthorProgramV7(program) {
    return freeze(captureRecord(program));
}
function checksum(value, key) {
    const { [key]: expected, ...body } = value;
    if (!hash(expected) || recordSha256(body) !== expected)
        fail();
}
export function validateCombinedAuthorProgramV7(input) {
    if (validatedPrograms.has(input))
        return input;
    const program = captureRecord(input);
    if (program.schemaVersion !== 7 || program.encoding !== 'native-author-combined-program-v7'
        || program.authority !== 'compiled-program-data-only' || typeof program.sourceRecordSessionId !== 'string'
        || !program.sourceRecordSessionId.length || program.sourceRecordSessionId.length > 256)
        fail();
    if (program.compiler?.id !== 'native-author-combined-compiler' || program.compiler.version !== 1
        || program.compiler.hostProtocol !== 5 || !hash(program.compiler.implementationSha256))
        fail();
    const original = validateSchemaCompilationInputV4(program.original);
    const server = program.serverProgram === null ? null : validateSchemaProgramV4(program.serverProgram);
    const browser = program.browserProgram === null ? null : validateStoredBrowserProgramDataV3(program.browserProgram);
    const prompt = program.promptProgram === null ? null : validatePromptProgramV1(program.promptProgram);
    const { material: _material, ...source } = original.source;
    const locator = { ...source, sourceRecordSessionId: program.sourceRecordSessionId };
    if (server && !same(server.source, original.source) || browser && !same(browser.source, locator)
        || prompt && !same(prompt.source, locator))
        fail();
    const plan = program.executionPlan;
    if (plan?.schemaVersion !== 4 || plan.encoding !== 'native-author-source-disposition-plan-v4'
        || plan.authority !== 'compiled-program-data-only' || !Array.isArray(plan.scripts)
        || plan.scripts.length !== original.scripts.length)
        fail();
    let serverIndex = 0, browserIndex = 0, promptIndex = 0, enabledBrowser = 0, disabled = 0, enabledExternalAddonsUnavailable = 0;
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
        else if (row.disposition === 'prompt') {
            const compiled = prompt?.scripts[promptIndex];
            if (!descriptor.enabled || !compiled || compiled.disposition !== 'compiled-prompt'
                || compiled.ordinal !== ordinal || !same(compiled.descriptor, descriptor))
                fail();
            expected = { ...common, disposition: 'prompt', promptIndex };
            promptIndex++;
        }
        else if (row.disposition === 'browser' || row.disposition === 'disabled-source-retained') {
            const compiled = browser?.scripts[browserIndex];
            if (!compiled || compiled.ordinal !== ordinal || !same(compiled.descriptor, descriptor)
                || compiled.disposition !== (descriptor.enabled ? 'compiled-browser' : 'disabled-source-retained'))
                fail();
            expected = { ...common, disposition: descriptor.enabled ? 'browser' : 'disabled-source-retained', browserIndex };
            if (descriptor.enabled)
                enabledBrowser++;
            else
                disabled++;
            browserIndex++;
        }
        else
            fail();
        if (!same(row, expected))
            fail();
    }
    if (serverIndex !== (server?.scripts.length ?? 0) || browserIndex !== (browser?.scripts.length ?? 0)
        || promptIndex !== (prompt?.scripts.length ?? 0))
        fail();
    if (!same(plan.summary, { enabledServerSchema: server?.executionPlan.summary.enabledServerSchema ?? 0,
        enabledNativeLoaders: server?.executionPlan.summary.enabledNativeLoaders ?? 0, enabledBrowser, disabled,
        enabledPrompt: promptIndex, enabledExternalAddonsUnavailable }))
        fail();
    checksum(plan, 'executionPlanSha256');
    checksum(program, 'combinedProgramSha256');
    freeze(program);
    validatedPrograms.add(program);
    return program;
}
export function combinedCompilationInputForProgramV7(program) {
    return { schemaVersion: 7, encoding: 'native-author-combined-compilation-input-v7',
        original: program.original, sourceRecordSessionId: program.sourceRecordSessionId };
}
