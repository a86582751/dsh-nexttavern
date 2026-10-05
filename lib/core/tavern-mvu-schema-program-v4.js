// Generated from runtime/alpha3/src/core/tavern-mvu-schema-program-v4.ts; edit the TypeScript source.
/** Unapplied v4 data contract. Checksums describe bytes, never Source/Native
 * authority. Full AST plan recomputation remains in the bounded owned worker. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, cloneSchemaEnvelopeV4, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
import { PINNED_C_SCHEMA_IMPORT_POLICY_V1 } from './tavern-mvu-schema-import-policy.js';
import { FIXED_STATE_LOADER_POLICY_V1, FIXED_STATE_LOADER_POLICY_SHA256 } from './tavern-mvu-state-loader-policy-v4.mjs';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max;
const same = (a, b) => recordSha256(a) === recordSha256(b);
const EMPTY_JS_SHA256 = schemaTextSha256('');
function fail(code) { throw Error(code); }
function exact(value, fields) {
    if (!object(value) || Object.keys(value).length !== fields.length
        || Object.keys(value).some(key => !fields.includes(key)))
        fail('SCHEMA_V4_RECORD_SHAPE');
}
function text(value, max, empty = false) {
    return typeof value === 'string' && (empty || value.length > 0) && Buffer.byteLength(value, 'utf8') <= max;
}
function freezeData(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeData(child);
        Object.freeze(value);
    }
    return value;
}
function implementation(value, compiler = false) {
    exact(value, compiler ? ['id', 'version', 'implementationSha256', 'typescriptVersion']
        : ['id', 'version', 'implementationSha256']);
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
        || value.version !== 4 || !hash(value.implementationSha256)
        || compiler && value.typescriptVersion !== '5.9.3')
        fail('SCHEMA_V4_IMPLEMENTATION_INVALID');
}
function bridgeIdentity(value) {
    implementation(value);
    if (value.id !== 'native-mvu-schema-bridge')
        fail('SCHEMA_V4_BRIDGE_IDENTITY');
}
const retainedPolicy = freezeData(cloneSchemaData(FIXED_STATE_LOADER_POLICY_V1, MVU_SCHEMA_BOUNDS.inputBytes));
if (recordSha256(retainedPolicy) !== FIXED_STATE_LOADER_POLICY_SHA256)
    throw Error('SCHEMA_V4_FIXED_POLICY_INVALID');
const fixedEntries = new Map(retainedPolicy.entries.map(([group, url]) => [url, {
        exactSpecifier: url, group, upstreamRootBytes: retainedPolicy.roots[group].bytes,
        upstreamRootSha256: retainedPolicy.roots[group].sha256,
        namespaceContract: group === 'D' ? 'side-effect-only' : 'empty-esm-namespace',
    }]));
// This exact author URL maps to the owned registration/update contract. The
// reviewed upstream differs only in browser error notification; no remote code
// or notification callback is loaded into the atomic-refusal executor.
export const C_SCHEMA_IMPORT_POLICY_V4 = Object.freeze({
    version: 4, contract: 'native-register-mvu-schema-atomic-refusal-v4',
    reviewedUpstream: Object.freeze({ bytes: 4607,
        sha256: 'e540ab99589ad83de1495056a84693bda00af92f8848926bcb9a53b9263a0302' }),
    entries: Object.freeze([...PINNED_C_SCHEMA_IMPORT_POLICY_V1.entries.map(item => item.specifier),
        'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js']),
});
const fixedCSpecifiers = new Set(C_SCHEMA_IMPORT_POLICY_V4.entries);
/** The fixed policy SHA is module-owned. No caller supplied mapper key, policy
 * SHA, downloaded helper bytes, or import fulfilment can alter this identity. */
export function deriveOwnedStateLoaderIdentityV4(rawBridge) {
    const bridge = cloneSchemaData(rawBridge, MVU_SCHEMA_BOUNDS.inputBytes);
    bridgeIdentity(bridge);
    const implementationSha256 = recordSha256({ schemaVersion: 1,
        encoding: 'native-mvu-owned-state-loader-identity-v4', bridge,
        dependencyPolicySha256: FIXED_STATE_LOADER_POLICY_SHA256 });
    return freezeData({ id: 'native-mvu-state-loader', version: 4, implementationSha256 });
}
export const nativeStateLoaderIdentityV4 = deriveOwnedStateLoaderIdentityV4;
export function pinnedNativeStateLoaderImportBindingsV4(bridge) {
    const owned = deriveOwnedStateLoaderIdentityV4(bridge);
    return freezeData(retainedPolicy.entries.map(([, specifier]) => ({ specifier,
        kind: 'native-state-loader', implementationSha256: owned.implementationSha256 })));
}
/** These aliases bind to the actual new bridge. Existing v1/v2/v3 policy
 * helpers and their admitted program import bytes remain untouched. */
export function pinnedCSchemaImportBindingsV4(rawBridge) {
    const bridge = cloneSchemaData(rawBridge, MVU_SCHEMA_BOUNDS.inputBytes);
    bridgeIdentity(bridge);
    return freezeData([...fixedCSpecifiers].map(specifier => ({ specifier,
        kind: 'schema-bridge', implementationSha256: bridge.implementationSha256 })));
}
function library(value) {
    exact(value, ['kind', 'packageName', 'version', 'bundleSha256', 'globalName']);
    if (!['zod', 'lodash'].includes(String(value.kind)) || !text(value.packageName, 256)
        || !text(value.version, 128) || !hash(value.bundleSha256) || typeof value.globalName !== 'string'
        || !/^[A-Za-z_$][\w$]{0,127}$/.test(value.globalName)
        || ['__proto__', 'constructor', 'prototype'].includes(value.globalName))
        fail('SCHEMA_V4_LIBRARY_INVALID');
}
function source(value) {
    exact(value, ['ownerSessionId', 'importId', 'sourceSha256', 'importRecordSha256',
        'sourceSnapshotSha256', 'material', 'materialSha256']);
    if (!text(value.ownerSessionId, 256) || !text(value.importId, 256) || !hash(value.sourceSha256)
        || !hash(value.importRecordSha256) || !hash(value.sourceSnapshotSha256)
        || !hash(value.materialSha256) || !object(value.material)
        || recordSha256(value.material) !== value.materialSha256)
        fail('SCHEMA_V4_SOURCE_INVALID');
}
function binding(value, libraries, bridge, stateLoader) {
    exact(value, ['specifier', 'kind', 'implementationSha256']);
    if (!text(value.specifier, 4096) || !hash(value.implementationSha256))
        fail('SCHEMA_V4_IMPORT_INVALID');
    let expected;
    if (value.kind === 'native-state-loader') {
        if (!fixedEntries.has(value.specifier))
            fail('SCHEMA_V4_NATIVE_EXACT_URL_REQUIRED');
        expected = stateLoader.implementationSha256;
    }
    else if (value.kind === 'schema-bridge') {
        if (!['schema-bridge', 'nexttavern:schema-bridge'].includes(value.specifier)
            && !fixedCSpecifiers.has(value.specifier))
            fail('SCHEMA_V4_SCHEMA_ALIAS_UNBOUND');
        expected = bridge.implementationSha256;
    }
    else if (value.kind === 'zod' || value.kind === 'lodash') {
        if (![value.kind, `nexttavern:${value.kind}`].includes(value.specifier))
            fail('SCHEMA_V4_LIBRARY_ALIAS_UNBOUND');
        expected = libraries.find(item => item.kind === value.kind)?.bundleSha256;
    }
    else
        fail('SCHEMA_V4_IMPORT_KIND');
    if (!expected || value.implementationSha256 !== expected)
        fail('SCHEMA_V4_IMPORT_CLOSURE');
}
function script(value, libraries, bridge, stateLoader, compiled) {
    exact(value, ['identity', 'pointer', 'enabled', 'source', 'sourceSha256', 'imports',
        ...(compiled ? ['javascript', 'javascriptSha256'] : [])]);
    if (!text(value.identity, 256) || !text(value.pointer, 4096, true)
        || value.pointer !== '' && !value.pointer.startsWith('/') || typeof value.enabled !== 'boolean'
        || !text(value.source, MVU_SCHEMA_BOUNDS.sourceBytes, true) || !hash(value.sourceSha256)
        || schemaTextSha256(value.source) !== value.sourceSha256
        || !Array.isArray(value.imports) || value.imports.length > 128)
        fail('SCHEMA_V4_SCRIPT_INVALID');
    const names = new Set();
    for (const item of value.imports) {
        binding(item, libraries, bridge, stateLoader);
        if (names.has(item.specifier))
            fail('SCHEMA_V4_IMPORT_DUPLICATE');
        names.add(item.specifier);
    }
    if (compiled && (!text(value.javascript, MVU_SCHEMA_BOUNDS.programBytes, true)
        || !hash(value.javascriptSha256) || schemaTextSha256(value.javascript) !== value.javascriptSha256)) {
        fail('SCHEMA_V4_COMPILED_SCRIPT_INVALID');
    }
}
function rawScript(value) {
    return { identity: value.identity, pointer: value.pointer, enabled: value.enabled,
        source: value.source, sourceSha256: value.sourceSha256, imports: value.imports };
}
function span(value, sourceLength) {
    exact(value, ['start', 'end']);
    if (!integer(value.start, 0, sourceLength) || !integer(value.end, 0, sourceLength)
        || value.end < value.start)
        fail('SCHEMA_V4_AST_SPAN');
}
function checksum(value, key, code) {
    const { [key]: digest, ...body } = value;
    if (!hash(digest) || recordSha256(body) !== digest)
        fail(code);
}
function executionPlan(raw, scripts, stateLoader, compiled) {
    exact(raw, ['schemaVersion', 'encoding', 'classifier', 'dependencyPolicySha256', 'scripts', 'summary',
        'zeroRegistrationPolicy', 'rawExecutionPolicy', 'containsLocalAuditEvidence', 'executionPlanSha256']);
    if (raw.schemaVersion !== 1 || raw.encoding !== 'native-mvu-author-execution-plan-v1'
        || raw.dependencyPolicySha256 !== FIXED_STATE_LOADER_POLICY_SHA256
        || raw.zeroRegistrationPolicy !== 'forbid-if-any-enabled-server-schema'
        || raw.rawExecutionPolicy !== 'execute-only-server-schema' || raw.containsLocalAuditEvidence !== false) {
        fail('SCHEMA_V4_EXECUTION_PLAN_POLICY');
    }
    exact(raw.classifier, ['id', 'version', 'typescriptVersion']);
    if (raw.classifier.id !== 'owned-author-ast-classifier' || raw.classifier.version !== 1
        || raw.classifier.typescriptVersion !== '5.9.3')
        fail('SCHEMA_V4_CLASSIFIER_IDENTITY');
    if (!Array.isArray(raw.scripts) || raw.scripts.length !== scripts.length)
        fail('SCHEMA_V4_PLAN_SCRIPT_MEMBERSHIP');
    let serverSchema = 0, nativeLoaders = 0;
    const families = new Set();
    for (const [ordinal, row] of raw.scripts.entries()) {
        exact(row, ['ordinal', 'identity', 'pointer', 'enabled', 'sourceSha256', 'rawDescriptorSha256',
            'classification', 'disposition', 'coverage', 'loaderImports', 'diagnosticCodes', 'evidence']);
        const original = scripts[ordinal];
        if (!original || row.ordinal !== ordinal || row.identity !== original.identity || row.pointer !== original.pointer
            || row.enabled !== original.enabled || row.sourceSha256 !== original.sourceSha256
            || row.rawDescriptorSha256 !== recordSha256(rawScript(original))
            || !Array.isArray(row.loaderImports) || !Array.isArray(row.diagnosticCodes) || row.diagnosticCodes.length) {
            fail('SCHEMA_V4_PLAN_RAW_SCRIPT_REFERENCE');
        }
        if (!original.enabled) {
            if (row.classification !== 'disabled' || row.disposition !== 'disabled'
                || row.evidence !== 'disabled-source-retained' || row.coverage !== null || row.loaderImports.length) {
                fail('SCHEMA_V4_DISABLED_PLAN_INVALID');
            }
        }
        else {
            if (row.classification === 'server-schema') {
                if (row.disposition !== 'server' || row.evidence !== 'trusted-schema-worker' || row.loaderImports.length) {
                    fail('SCHEMA_V4_SCHEMA_PLAN_INVALID');
                }
                serverSchema++;
            }
            else if (row.classification === 'native-state-loader') {
                if (row.disposition !== 'native-owned' || row.evidence !== 'complete-loader-ast' || !row.loaderImports.length) {
                    fail('SCHEMA_V4_NATIVE_PLAN_INVALID');
                }
                nativeLoaders++;
            }
            else
                fail('SCHEMA_V4_ENABLED_SCRIPT_UNSUPPORTED');
            exact(row.coverage, ['encoding', 'sourceSha256', 'nodeCount', 'statementSpans']);
            if (row.coverage.encoding !== 'native-mvu-complete-script-ast-coverage-v1'
                || row.coverage.sourceSha256 !== original.sourceSha256
                || !integer(row.coverage.nodeCount, 1, MVU_SCHEMA_BOUNDS.syntaxTokens)
                || !Array.isArray(row.coverage.statementSpans) || !row.coverage.statementSpans.length
                || row.coverage.statementSpans.length > MVU_SCHEMA_BOUNDS.syntaxTokens)
                fail('SCHEMA_V4_AST_COVERAGE');
            let priorStatement = 0;
            for (const statement of row.coverage.statementSpans) {
                span(statement, original.source.length);
                if (statement.start < priorStatement || statement.end <= statement.start)
                    fail('SCHEMA_V4_AST_COVERAGE_ORDER');
                priorStatement = statement.end;
            }
        }
        let priorImport = 0;
        for (const [siteIndex, site] of row.loaderImports.entries()) {
            exact(site, ['kind', 'importSpan', 'argumentSpan', 'dependencies', 'lowering']);
            if (!['bare-static', 'bare-await-literal', 'bounded-const-forof'].includes(String(site.kind))
                || site.lowering !== (site.kind === 'bounded-const-forof' ? 'exact-url-conditional' : 'replace-literal-specifier')
                || !Array.isArray(site.dependencies) || !site.dependencies.length || site.dependencies.length > 3) {
                fail('SCHEMA_V4_LOADER_SITE_INVALID');
            }
            span(site.importSpan, original.source.length);
            span(site.argumentSpan, original.source.length);
            if (site.importSpan.start < priorImport || site.importSpan.end <= site.importSpan.start
                || site.argumentSpan.start < site.importSpan.start || site.argumentSpan.end > site.importSpan.end
                || site.argumentSpan.end <= site.argumentSpan.start)
                fail('SCHEMA_V4_LOADER_SITE_ORDER');
            priorImport = site.importSpan.end;
            const urls = new Set();
            for (const [candidateIndex, dependency] of site.dependencies.entries()) {
                exact(dependency, ['exactSpecifier', 'group', 'upstreamRootSha256', 'upstreamRootBytes',
                    'namespaceContract', 'ownedImplementation', 'candidateOrdinal']);
                if (typeof dependency.exactSpecifier !== 'string')
                    fail('SCHEMA_V4_FIXED_DEPENDENCY_INVALID');
                const fixed = fixedEntries.get(dependency.exactSpecifier);
                if (!fixed || urls.has(dependency.exactSpecifier) || dependency.group !== fixed.group
                    || dependency.upstreamRootSha256 !== fixed.upstreamRootSha256
                    || dependency.upstreamRootBytes !== fixed.upstreamRootBytes
                    || dependency.namespaceContract !== fixed.namespaceContract
                    || !same(dependency.ownedImplementation, stateLoader)
                    || !integer(dependency.candidateOrdinal, 0, 2))
                    fail('SCHEMA_V4_FIXED_DEPENDENCY_INVALID');
                implementation(dependency.ownedImplementation);
                urls.add(dependency.exactSpecifier);
                families.add(fixed.group);
                const admitted = original.imports.find(item => item.specifier === dependency.exactSpecifier);
                if (!admitted || admitted.kind !== 'native-state-loader'
                    || admitted.implementationSha256 !== stateLoader.implementationSha256)
                    fail('SCHEMA_V4_NATIVE_IMPORT_CLOSURE');
                if (site.kind === 'bounded-const-forof') {
                    if (dependency.candidateOrdinal !== candidateIndex || dependency.group !== 'A'
                        || dependency.exactSpecifier !== retainedPolicy.entries[2 + candidateIndex]?.[1]) {
                        fail('SCHEMA_V4_BOUNDED_ARRAY_POLICY');
                    }
                }
                else if (site.dependencies.length !== 1 || dependency.candidateOrdinal !== 0
                    && !(site.kind === 'bare-await-literal' && siteIndex === 1 && row.loaderImports.length === 2
                        && dependency.candidateOrdinal === 1))
                    fail('SCHEMA_V4_LITERAL_SITE_POLICY');
            }
            if (site.kind === 'bounded-const-forof' && site.dependencies.length !== 3)
                fail('SCHEMA_V4_BOUNDED_ARRAY_POLICY');
        }
        if (compiled) {
            const output = original;
            if (row.classification === 'server-schema') {
                if (!output.javascript.length)
                    fail('SCHEMA_V4_SCHEMA_JAVASCRIPT_MISSING');
            }
            else if (output.javascript !== '' || output.javascriptSha256 !== EMPTY_JS_SHA256) {
                fail('SCHEMA_V4_NON_SCHEMA_JAVASCRIPT_FORBIDDEN');
            }
        }
    }
    if (families.size > 1)
        fail('SCHEMA_V4_PROGRAM_MULTIPLE_STATE_FAMILIES');
    if (!serverSchema && !nativeLoaders)
        fail('SCHEMA_V4_EXECUTABLE_SCRIPT_REQUIRED');
    exact(raw.summary, ['enabledServerSchema', 'enabledNativeLoaders', 'enabledBrowserDeferred', 'unsupportedEnabled']);
    if (raw.summary.enabledServerSchema !== serverSchema || raw.summary.enabledNativeLoaders !== nativeLoaders
        || raw.summary.enabledBrowserDeferred !== 0 || raw.summary.unsupportedEnabled !== 0)
        fail('SCHEMA_V4_PLAN_SUMMARY');
    checksum(raw, 'executionPlanSha256', 'SCHEMA_V4_EXECUTION_PLAN_HASH');
}
function compilationCode(value, compiled) {
    bridgeIdentity(value.bridge);
    implementation(value.stateLoader);
    if (!same(value.stateLoader, deriveOwnedStateLoaderIdentityV4(value.bridge)))
        fail('SCHEMA_V4_STATE_LOADER_IDENTITY');
    if (!Array.isArray(value.libraries) || value.libraries.length > 2)
        fail('SCHEMA_V4_LIBRARY_INVALID');
    const kinds = new Set(), globals = new Set(), libraries = [];
    for (const item of value.libraries) {
        library(item);
        if (kinds.has(item.kind) || globals.has(item.globalName))
            fail('SCHEMA_V4_LIBRARY_DUPLICATE');
        kinds.add(item.kind);
        globals.add(item.globalName);
        libraries.push(item);
    }
    if (!Array.isArray(value.scripts) || !value.scripts.length || value.scripts.length > MVU_SCHEMA_BOUNDS.scripts) {
        fail('SCHEMA_V4_SCRIPT_LIMIT');
    }
    const identities = new Set(), pointers = new Set(), scripts = [];
    let sourceBytes = 0;
    for (const item of value.scripts) {
        script(item, libraries, value.bridge, value.stateLoader, compiled);
        if (identities.has(item.identity) || pointers.has(item.pointer))
            fail('SCHEMA_V4_SCRIPT_DUPLICATE');
        identities.add(item.identity);
        pointers.add(item.pointer);
        scripts.push(item);
        sourceBytes += Buffer.byteLength(item.source, 'utf8');
        if (sourceBytes > MVU_SCHEMA_BOUNDS.sourceBytes)
            fail('SCHEMA_V4_SOURCE_TOTAL_LIMIT');
    }
    if (compiled || value.executionPlan !== null)
        executionPlan(value.executionPlan, scripts, value.stateLoader, compiled);
}
export function validateSchemaCompilerIdentityV4(input) {
    const value = cloneSchemaData(input, MVU_SCHEMA_BOUNDS.inputBytes);
    implementation(value, true);
    return freezeData(value);
}
export function validateSchemaCompilationInputV4(input) {
    const value = cloneSchemaEnvelopeV4(input, MVU_SCHEMA_BOUNDS.inputBytes);
    exact(value, ['schemaVersion', 'encoding', 'source', 'scripts', 'libraries', 'bridge', 'stateLoader', 'executionPlan']);
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-author-compilation-input-v2')
        fail('SCHEMA_V4_INPUT_INVALID');
    source(value.source);
    compilationCode(value, false);
    return freezeData(value);
}
// Only this owner can certify its deeply frozen result. Wire/JSON copies and
// values from other implementations still require their first full validation.
const validatedPrograms = new WeakSet();
export function validateSchemaProgramV4(input) {
    if (validatedPrograms.has(input))
        return input;
    const value = cloneSchemaEnvelopeV4(input, MVU_SCHEMA_BOUNDS.programBytes);
    exact(value, ['schemaVersion', 'encoding', 'compiler', 'source', 'scripts', 'libraries',
        'bridge', 'stateLoader', 'executionPlan', 'programSha256']);
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-author-schema-program-v2')
        fail('SCHEMA_V4_PROGRAM_INVALID');
    implementation(value.compiler, true);
    source(value.source);
    compilationCode(value, true);
    checksum(value, 'programSha256', 'SCHEMA_V4_PROGRAM_HASH');
    const program = freezeData(value);
    validatedPrograms.add(program);
    return program;
}
export function validateSchemaCompilationCodeV4(input) {
    const value = cloneSchemaData(input, MVU_SCHEMA_BOUNDS.inputBytes);
    exact(value, ['scripts', 'libraries', 'bridge', 'stateLoader', 'executionPlan']);
    compilationCode(value, false);
    return freezeData(value);
}
export function validateSchemaCompiledCodeV4(input) {
    const value = cloneSchemaData(input, MVU_SCHEMA_BOUNDS.programBytes);
    exact(value, ['compiler', 'scripts', 'libraries', 'bridge', 'stateLoader', 'executionPlan']);
    implementation(value.compiler, true);
    compilationCode(value, true);
    return freezeData(value);
}
