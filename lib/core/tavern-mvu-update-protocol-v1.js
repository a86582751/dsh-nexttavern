// Generated from runtime/alpha3/src/core/tavern-mvu-update-protocol-v1.ts; edit the TypeScript source.
import { validateAuthorNativeMvuHookGraphV1 } from './author-native-mvu-hook-graph.js';
const stages = ['update-started', 'command-parsed', 'command-parsed-for-zod',
    'command-parsed-ended-for-zod', 'single-variable-updated', 'update-ended', 'update-ended-for-zod'];
const commands = ['set', 'insert', 'assign', 'remove', 'unset', 'delete', 'add', 'move'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const ordinal = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function fail() { throw Error('SCHEMA_UPDATE_PROTOCOL_INVALID'); }
function exact(value, fields) {
    if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key)))
        fail();
}
/** Already-budgeted JSON DATA enters through the runner once. No additional
 * clone, digest, sanitization or graph validation belongs to its consumers. */
export function assertMvu196ContextWritesV1(value) {
    if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'keys' && value.kind !== 'replace')
        throw Error('SCHEMA_CONTEXT_INVALID');
    exact(value, ['schemaVersion', 'kind', ...(value.kind === 'keys' ? ['keys'] : [])]);
    if (value.kind === 'keys' && (!Array.isArray(value.keys) || value.keys.some(key => typeof key !== 'string')))
        throw Error('SCHEMA_CONTEXT_INVALID');
}
/** Canonical literal records are admitted as DATA. Their operation semantics
 * remain with the single fixed-core generator that consumes them. */
export function assertMvu196CommandsV1(value) {
    if (!Array.isArray(value))
        fail();
    for (const command of value) {
        if (!object(command))
            fail();
        exact(command, ['type', 'full_match', 'args', 'reason']);
        if (typeof command.type !== 'string' || !commands.includes(command.type) || typeof command.full_match !== 'string'
            || typeof command.reason !== 'string' || !Array.isArray(command.args)
            || command.args.some(argument => typeof argument !== 'string'))
            fail();
    }
}
export function assertMvu196UpdateInputV1(value) {
    if (!object(value) || value.schemaVersion !== 1 || typeof value.updateId !== 'string' || !value.updateId.length
        || !Array.isArray(value.interests) || value.interests.some(stage => typeof stage !== 'string' || !stages.includes(stage)))
        fail();
    if (value.encoding === 'native-mvu-196-update-start-v1') {
        exact(value, ['schemaVersion', 'encoding', 'updateId', 'message', 'interests',
            ...(Object.hasOwn(value, 'macros') ? ['macros'] : []), ...(Object.hasOwn(value, 'maintenance') ? ['maintenance'] : [])]);
        if (typeof value.message !== 'string')
            fail();
        if (Object.hasOwn(value, 'maintenance') && value.maintenance !== true)
            fail();
        if (value.macros !== undefined) {
            const macros = value.macros;
            if (!object(macros))
                fail();
            exact(macros, ['schemaVersion', 'expandedMessage', 'policySha256', 'reads']);
            if (macros.schemaVersion !== 1 || typeof macros.expandedMessage !== 'string'
                || typeof macros.policySha256 !== 'string' || !Array.isArray(macros.reads))
                fail();
        }
    }
    else if (value.encoding === 'native-mvu-196-native-resume-v1') {
        exact(value, ['schemaVersion', 'encoding', 'updateId', 'yieldOrdinal', 'commands', 'interests']);
        if (!ordinal(value.yieldOrdinal))
            fail();
        assertMvu196CommandsV1(value.commands);
    }
    else if (value.encoding === 'native-mvu-196-update-resume-v1') {
        exact(value, ['schemaVersion', 'encoding', 'updateId', 'yieldOrdinal', 'graph', 'interests',
            ...(Object.hasOwn(value, 'contextWrites') ? ['contextWrites'] : [])]);
        if (!ordinal(value.yieldOrdinal))
            fail();
        validateAuthorNativeMvuHookGraphV1(value.graph);
        if (Object.hasOwn(value, 'contextWrites'))
            assertMvu196ContextWritesV1(value.contextWrites);
    }
    else
        fail();
}
export function assertMvu196UpdateProgressV1(value) {
    if (!object(value) || value.schemaVersion !== 1 || typeof value.updateId !== 'string' || !value.updateId.length)
        fail();
    if (value.kind === 'complete')
        exact(value, ['schemaVersion', 'kind', 'updateId']);
    else if (value.kind === 'native-commands-ready') {
        exact(value, ['schemaVersion', 'kind', 'updateId', 'yieldOrdinal', 'commands']);
        if (!ordinal(value.yieldOrdinal))
            fail();
        assertMvu196CommandsV1(value.commands);
    }
    else if (value.kind === 'yield') {
        exact(value, ['schemaVersion', 'kind', 'updateId', 'yieldOrdinal', 'stage', 'graph']);
        if (!ordinal(value.yieldOrdinal) || typeof value.stage !== 'string' || !stages.includes(value.stage))
            fail();
        validateAuthorNativeMvuHookGraphV1(value.graph);
    }
    else
        fail();
}
