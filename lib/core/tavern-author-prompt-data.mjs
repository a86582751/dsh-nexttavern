// Generated from runtime/alpha3/src/core/tavern-author-prompt-data.mts; edit the TypeScript source.
/** Stored Prompt1 DATA decoding only. Actual AST verification and current
 * Source/Native ownership are separate producers, never inferred here. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { PROMPT_PROFILE_SHA256_V1, PROMPT_BOUNDS_V1 as bounds } from './tavern-author-prompt-profile.mjs';
const admitted = new WeakSet();
const decodedInputs = new WeakMap();
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function fail() { throw Error('PROMPT_PROGRAM_DATA_INVALID'); }
function exact(value, fields) {
    if (!object(value) || Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key)))
        fail();
}
function frozen(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            frozen(child);
        Object.freeze(value);
    }
    return value;
}
function text(value, max = 4096) {
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > max)
        fail();
}
export function validatePromptProgramV1(input) {
    if (object(input) && admitted.has(input))
        return input;
    if (object(input)) {
        const cached = decodedInputs.get(input);
        if (cached)
            return cached;
    }
    let data;
    try {
        data = cloneSchemaData(input, 16_777_216, { nodes: 131_072, depth: 48 });
    }
    catch {
        fail();
    }
    exact(data, ['schemaVersion', 'encoding', 'authority', 'source', 'compiler', 'runtime', 'profileSha256', 'scripts', 'programSha256']);
    if (data.schemaVersion !== 1 || data.encoding !== 'native-author-prompt-program-v1'
        || data.authority !== 'compiled-program-data-only' || data.profileSha256 !== PROMPT_PROFILE_SHA256_V1 || !hash(data.programSha256))
        fail();
    exact(data.source, ['ownerSessionId', 'sourceRecordSessionId', 'importId', 'sourceSha256', 'importRecordSha256',
        'sourceSnapshotSha256', 'materialSha256']);
    for (const name of ['ownerSessionId', 'sourceRecordSessionId', 'importId'])
        text(data.source[name]);
    for (const name of ['sourceSha256', 'importRecordSha256', 'sourceSnapshotSha256', 'materialSha256'])
        if (!hash(data.source[name]))
            fail();
    exact(data.compiler, ['id', 'version', 'typescriptVersion', 'implementationSha256']);
    if (data.compiler.id !== 'native-author-prompt-profile-compiler' || data.compiler.version !== 1
        || data.compiler.typescriptVersion !== '5.9.3' || !hash(data.compiler.implementationSha256))
        fail();
    exact(data.runtime, ['id', 'version', 'quickjsVersion', 'implementationSha256']);
    if (data.runtime.id !== 'native-author-prompt-quickjs-runtime' || data.runtime.version !== 1
        || data.runtime.quickjsVersion !== '0.32.0' || !hash(data.runtime.implementationSha256))
        fail();
    if (!Array.isArray(data.scripts) || data.scripts.length > bounds.scripts)
        fail();
    let ordinal = -1;
    for (const script of data.scripts) {
        exact(script, ['ordinal', 'descriptor', 'descriptorSha256', 'disposition', 'javascript', 'javascriptSha256', 'coverage', 'reinstantiation']);
        if (typeof script.ordinal !== 'number' || !Number.isSafeInteger(script.ordinal) || script.ordinal <= ordinal)
            fail();
        ordinal = script.ordinal;
        exact(script.descriptor, ['identity', 'pointer', 'enabled', 'source', 'sourceSha256', 'imports']);
        const descriptor = script.descriptor;
        text(descriptor.identity);
        text(descriptor.pointer);
        text(descriptor.source, bounds.sourceBytes);
        if (typeof descriptor.enabled !== 'boolean' || !hash(descriptor.sourceSha256)
            || schemaTextSha256(descriptor.source) !== descriptor.sourceSha256 || !Array.isArray(descriptor.imports))
            fail();
        for (const binding of descriptor.imports) {
            exact(binding, ['specifier', 'kind', 'implementationSha256']);
            text(binding.specifier);
            if (!['zod', 'lodash', 'schema-bridge', 'native-state-loader'].includes(binding.kind) || !hash(binding.implementationSha256))
                fail();
        }
        text(script.javascript, bounds.sourceBytes * 4);
        if (!hash(script.descriptorSha256) || recordSha256(descriptor) !== script.descriptorSha256
            || !hash(script.javascriptSha256) || schemaTextSha256(script.javascript) !== script.javascriptSha256)
            fail();
        if (!descriptor.enabled) {
            if (script.disposition !== 'disabled-source-retained' || script.reinstantiation !== 'disabled'
                || script.javascript !== '' || script.coverage !== null)
                fail();
            continue;
        }
        if (script.disposition !== 'compiled-prompt' || script.reinstantiation !== 'stateless-captured-input-v1')
            fail();
        exact(script.coverage, ['encoding', 'sourceSha256', 'nodeCount', 'statements']);
        if (script.coverage.encoding !== 'native-author-prompt-complete-ast-coverage-v1'
            || script.coverage.sourceSha256 !== descriptor.sourceSha256 || typeof script.coverage.nodeCount !== 'number'
            || !Number.isSafeInteger(script.coverage.nodeCount) || script.coverage.nodeCount < 1 || script.coverage.nodeCount > bounds.nodes
            || !Array.isArray(script.coverage.statements) || script.coverage.statements.length > bounds.nodes)
            fail();
        for (const span of script.coverage.statements) {
            exact(span, ['start', 'end']);
            if (typeof span.start !== 'number' || typeof span.end !== 'number' || !Number.isSafeInteger(span.start)
                || !Number.isSafeInteger(span.end) || span.start < 0 || span.end < span.start || span.end > descriptor.source.length)
                fail();
        }
    }
    const { programSha256, ...body } = data;
    if (recordSha256(body) !== programSha256)
        fail();
    const result = frozen(data);
    admitted.add(result);
    const immutable = (value) => !value || typeof value !== 'object'
        || Object.isFrozen(value) && Object.values(value).every(immutable);
    if (object(input) && immutable(input))
        decodedInputs.set(input, result);
    return result;
}
