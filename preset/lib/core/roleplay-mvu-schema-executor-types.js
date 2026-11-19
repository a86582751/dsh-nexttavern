// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-executor-types.ts; edit the TypeScript source.
/** The admitted catalog binds each V4 epoch to its actual implementation. */
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
import { validateMvuExecutableProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { MVU_SCHEMA_LIBRARY_PINS } from './tavern-mvu-schema-types.js';
export const validateSchemaAuthorProgram = validateMvuExecutableProgramV4;
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
        if (value.id !== id || value.version !== 4 || !/^[a-f0-9]{64}$/.test(value.implementationSha256))
            fail();
    }
    if (tuple.compiler.version !== tuple.runner.version || tuple.bridge.version !== tuple.runner.version
        || tuple.compiler.typescriptVersion !== '5.9.3' || tuple.runner.quickjsVersion !== '0.32.0'
        || !Array.isArray(tuple.libraries) || tuple.libraries.length !== 3
        || new Set(tuple.libraries.map(library => library.kind)).size !== 3)
        fail();
    for (const library of tuple.libraries) {
        exact(library, ['kind', 'packageName', 'version', 'bundleSha256', 'globalName']);
        const pin = MVU_SCHEMA_LIBRARY_PINS[library.kind];
        if (!pin || library.packageName !== pin.packageName || library.version !== pin.version
            || library.globalName !== pin.globalName || !/^[a-f0-9]{64}$/.test(library.bundleSha256))
            fail();
    }
    return tuple;
}
/** Initialization and editing carry no command authority. For external pack
 * adoption, use external-pack-replacement with the prior canonical base and
 * donor values/context. Acceptance records raw adoption, not schema parsing. */
export function schemaEmptyPhaseInput(version, phase, base, values, context, clockEpochMs, randomSeed, scopeReadFrame, errorPolicy = 'atomic-refusal', scopeReadRef) {
    const body = { phase, base, values, context, clockEpochMs, randomSeed };
    if (scopeReadRef)
        return { schemaVersion: version, encoding: 'native-mvu-author-schema-phase-input-v4-scope-ref-v2',
            errorPolicy, ...body, scopeReadRef };
    if (!scopeReadFrame)
        throw Error('SCHEMA_SCOPE_READ_REQUIRED');
    return { schemaVersion: version, encoding: 'native-mvu-author-schema-phase-input-v4',
        errorPolicy, ...body, scopeReadFrame };
}
export function schemaRealmLoadFrame(version, binding, values, context, clockEpochMs, randomSeed, scopeReadFrame) {
    const body = { ...binding, values, context, clockEpochMs, randomSeed };
    if (!scopeReadFrame)
        throw Error('SCHEMA_SCOPE_READ_REQUIRED');
    return { schemaVersion: version, ...body, scopeReadFrame };
}
/** Keep the actual scope input shape supplied by the owning producer. */
export function schemaTraceRequestedStep(eventId, binding, input) {
    return { eventId, frame: { ...binding, input } };
}
