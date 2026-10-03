// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-executor-types.ts; edit the TypeScript source.
/** Host transport unions do not choose an executor. The admitted catalog binds
 * each epoch to its complete original implementation tuple before dispatch. */
import { types } from 'node:util';
import { cloneSchemaData, validateSchemaProgram } from './tavern-mvu-schema-data.js';
import { validateSchemaProgramV4 } from './tavern-mvu-schema-program-v4.js';
/** Version dispatch validates data only. The catalog and compiler still admit
 * the actual implementation and recompute the complete raw author plan. */
export function validateSchemaAuthorProgram(input) {
    if (input !== null && typeof input === 'object' && types.isProxy(input))
        throw Error('SCHEMA_PROXY_VALUE');
    // Inspect only an own data discriminator without invoking a getter. The
    // selected validator still clones and validates the entire bounded program.
    const version = input !== null && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'schemaVersion') : undefined;
    return version && Object.hasOwn(version, 'value') && version.value === 2
        ? validateSchemaProgramV4(input) : validateSchemaProgram(input);
}
/** Exact bounded comparison data. Passing this validation does not prove an
 * owned package or a historical execution; both are checked by their owners. */
export function validateSchemaExecutorIdentityTuple(input) {
    const tuple = cloneSchemaData(input, 16384);
    const fail = () => { throw Error('SCHEMA_EXECUTOR_IDENTITY_INVALID'); };
    const exact = (value, keys) => {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
            || Object.keys(value).some(key => !keys.includes(key)))
            fail();
    };
    exact(tuple, ['compiler', 'bridge', 'libraries', 'runner']);
    for (const [key, id, extra] of [['compiler', 'native-mvu-schema-compiler', 'typescriptVersion'],
        ['bridge', 'native-mvu-schema-bridge', null], ['runner', 'native-mvu-schema-runner', 'quickjsVersion']]) {
        const value = tuple[key];
        exact(value, ['id', 'version', 'implementationSha256', ...(extra ? [extra] : [])]);
        if (value.id !== id || ![1, 2, 3, 4].includes(value.version) || !/^[a-f0-9]{64}$/.test(value.implementationSha256))
            fail();
    }
    if (tuple.compiler.version !== tuple.runner.version || tuple.bridge.version !== tuple.runner.version
        || tuple.compiler.typescriptVersion !== '5.9.3' || tuple.runner.quickjsVersion !== '0.32.0'
        || !Array.isArray(tuple.libraries) || tuple.libraries.length !== 2
        || new Set(tuple.libraries.map(library => library.kind)).size !== 2)
        fail();
    for (const library of tuple.libraries) {
        exact(library, ['kind', 'packageName', 'version', 'bundleSha256', 'globalName']);
        if (!['zod', 'lodash'].includes(library.kind) || library.packageName !== library.kind
            || library.version !== (library.kind === 'zod' ? '4.4.3' : '4.18.1')
            || library.globalName !== (library.kind === 'zod' ? 'z' : '_') || !/^[a-f0-9]{64}$/.test(library.bundleSha256))
            fail();
    }
    return tuple;
}
/** Initialization and editing have no command authority. Preserve the original
 * envelope for v1; v2 carries its explicit normalized-operation contract. */
export function schemaEmptyPhaseInput(version, phase, base, values, context, clockEpochMs, randomSeed, scopeReadFrame) {
    const body = { phase, base, values, commands: [], context, clockEpochMs, randomSeed };
    if (version === 4) {
        if (!scopeReadFrame)
            throw Error('SCHEMA_SCOPE_READ_REQUIRED');
        return { schemaVersion: 4, encoding: 'native-mvu-author-schema-phase-input-v4',
            commandsEncoding: 'native-mvu-update-operations-v2', errorPolicy: 'atomic-refusal', ...body, scopeReadFrame };
    }
    if (version === 3) {
        if (!scopeReadFrame)
            throw Error('SCHEMA_SCOPE_READ_REQUIRED');
        return { schemaVersion: 3, encoding: 'native-mvu-author-schema-phase-input-v3',
            commandsEncoding: 'native-mvu-update-operations-v2', errorPolicy: 'atomic-refusal', ...body, scopeReadFrame };
    }
    return version === 1 ? { schemaVersion: 1, ...body } : { schemaVersion: 2,
        encoding: 'native-mvu-author-schema-phase-input-v2', commandsEncoding: 'native-mvu-update-operations-v2',
        errorPolicy: 'atomic-refusal', ...body };
}
export function schemaRealmLoadFrame(version, binding, values, context, clockEpochMs, randomSeed, scopeReadFrame) {
    const body = { ...binding, values, context, clockEpochMs, randomSeed };
    if (version === 1)
        return { schemaVersion: 1, ...body };
    if (version === 2)
        return { schemaVersion: 2, ...body };
    if (!scopeReadFrame)
        throw Error('SCHEMA_SCOPE_READ_REQUIRED');
    if (version === 4)
        return { schemaVersion: 4, ...body, scopeReadFrame };
    return { schemaVersion: 3, ...body, scopeReadFrame };
}
/** Preserve the discriminated ABI when a host builds a frame from shared
 * read facts. The branch narrows the actual input without any wire coercion. */
export function schemaTraceRequestedStep(eventId, binding, input) {
    if (input.schemaVersion === 1)
        return { eventId, frame: { ...binding, input } };
    if (input.schemaVersion === 2)
        return { eventId, frame: { ...binding, input } };
    if (input.schemaVersion === 3)
        return { eventId, frame: { ...binding, input } };
    return { eventId, frame: { ...binding, input } };
}
