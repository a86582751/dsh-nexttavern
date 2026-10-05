// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-frozen-prefix-input.ts; edit the TypeScript source.
/** Owns the bounded table inputs of one successful schema prefix validation.
 * The closed reader can replay facts; it cannot publish or create a hot owner. */
import { recordSha256 } from './roleplay-data.js';
import { freezeImmutableSchemaDescriptorDataV4 } from './roleplay-mvu-schema-descriptor-data.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);
function fail(code = 'SCHEMA_FROZEN_INPUT_INVALID') { throw Error(code); }
function exact(value, fields) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || !same(Object.keys(value).sort(), [...fields].sort()))
        fail();
}
function data(input) {
    return freezeImmutableSchemaDescriptorDataV4(input, 67_108_864, { nodes: 524_288, depth: 96 });
}
function enumerationKey(table, value) {
    return table === 'branch'
        ? /^[A-Za-z0-9_-]+__(?:native-input-v2-(?:work|terminal)-|mvu-schema-player-plan-)/.test(value)
        : /^[A-Za-z0-9_-]+__mvu-state-schema-(?:story|player)-event-/.test(value);
}
export function validateMvuSchemaPrefixInputClosureV1(raw, expected) {
    const value = data(raw);
    exact(value, ['schemaVersion', 'encoding', 'authority', 'binding', 'tables', 'closureSha256']);
    exact(value.binding, ['sessionId', 'inheritedEventCount', 'nativeCut', 'nativePrefixSha256', 'sourceSha256', 'prefixSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-prefix-input-closure-v1'
        || value.authority !== 'consumer-data-only' || !same(value.binding, expected) || !hash(value.closureSha256)
        || !key(expected.sessionId) || ![expected.inheritedEventCount, expected.nativeCut].every(v => Number.isSafeInteger(v) && v >= 0)
        || expected.inheritedEventCount >= expected.nativeCut
        || ![expected.nativePrefixSha256, expected.sourceSha256, expected.prefixSha256].every(hash)
        || !Array.isArray(value.tables) || value.tables.length !== 2)
        fail();
    let count = 0;
    for (const [index, table] of value.tables.entries()) {
        exact(table, ['table', 'membership', 'rows']);
        const name = index === 0 ? 'branch' : 'status';
        if (table.table !== name || !Array.isArray(table.membership) || !Array.isArray(table.rows))
            fail();
        const rows = new Map();
        for (const row of table.rows) {
            exact(row, ['key', 'exists', 'sha256', 'value']);
            if (!key(row.key) || !row.key.includes('__') || rows.has(row.key) || typeof row.exists !== 'boolean'
                || (row.exists ? !hash(row.sha256) || recordSha256(row.value) !== row.sha256 : row.sha256 !== 'missing' || row.value !== null)
                || ++count > 16_384)
                fail();
            rows.set(row.key, row);
        }
        const seen = new Set();
        for (const member of table.membership) {
            if (!key(member) || !member.startsWith(`${expected.sessionId}__`)
                || !enumerationKey(name, member) || seen.has(member) || !rows.get(member)?.exists)
                fail();
            seen.add(member);
        }
    }
    const { closureSha256, ...body } = value;
    if (recordSha256(body) !== closureSha256)
        fail();
    return value;
}
export function createRoleplayMvuSchemaPrefixInputs(tables) {
    let active;
    const views = Object.fromEntries(['branch', 'status'].map(name => [name, {
            get: (key) => (active?.[name] ?? tables[name]).get(key),
            entries: () => (active?.[name] ?? tables[name]).entries(),
            put: (key, value) => {
                if (active)
                    fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED');
                return tables[name].put(key, value);
            },
        }]));
    function scoped(scope, action) {
        if (active)
            fail('SCHEMA_FROZEN_INPUT_SCOPE_CONFLICT');
        active = scope;
        try {
            return action();
        }
        finally {
            active = undefined;
        }
    }
    function capture(binding, action) {
        const recordings = ['branch', 'status'].map(name => {
            const live = tables[name], rows = new Map();
            let membership;
            const entries = () => [...live.entries()].filter(([key]) => key.startsWith(`${binding.sessionId}__`)
                && enumerationKey(name, key));
            function remember(keyValue, value) {
                const copied = value === undefined ? null : data(value);
                const row = data({ key: keyValue, exists: value !== undefined, sha256: value === undefined ? 'missing' : recordSha256(copied), value: copied });
                if (!key(keyValue) || !keyValue.includes('__') || rows.size >= 16_384 && !rows.has(keyValue))
                    fail();
                const previous = rows.get(keyValue);
                if (previous && !same(previous, row))
                    fail('SCHEMA_FROZEN_INPUT_CHANGED');
                rows.set(keyValue, row);
                return value;
            }
            const view = { get: key => remember(key, live.get(key)), entries: () => {
                    const actual = entries(), keys = actual.map(([key]) => key);
                    if (membership && !same(membership, keys))
                        fail('SCHEMA_FROZEN_INPUT_CHANGED');
                    membership = keys;
                    return actual.map(([key, value]) => [key, remember(key, value)]);
                }, put: async () => fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED') };
            return { name, view, rows, membership: () => membership ?? [], assertCurrent: () => {
                    if (membership && !same(membership, entries().map(([key]) => key)))
                        fail('SCHEMA_FROZEN_INPUT_CHANGED');
                    for (const row of rows.values())
                        if (recordSha256(live.get(row.key)) !== row.sha256)
                            fail('SCHEMA_FROZEN_INPUT_CHANGED');
                } };
        });
        const result = scoped({ branch: recordings[0].view, status: recordings[1].view }, action);
        const body = { schemaVersion: 1, encoding: 'native-mvu-schema-prefix-input-closure-v1',
            authority: 'consumer-data-only', binding, tables: recordings.map(recording => ({ table: recording.name,
                membership: recording.membership(), rows: [...recording.rows.values()] })) };
        const closure = validateMvuSchemaPrefixInputClosureV1({ ...body, closureSha256: recordSha256(body) }, binding);
        const assertCurrent = () => { for (const recording of recordings)
            recording.assertCurrent(); };
        assertCurrent();
        return { result, closure, assertCurrent };
    }
    function verify(raw, binding, action) {
        const closure = validateMvuSchemaPrefixInputClosureV1(raw, binding);
        const closed = closure.tables.map(table => {
            const rows = new Map(table.rows.map(row => [row.key, row]));
            return { get: (key) => {
                    const row = rows.get(key);
                    if (!row)
                        fail('SCHEMA_FROZEN_INPUT_READ_UNRECORDED');
                    return row.exists ? row.value : undefined;
                }, entries: () => table.membership.map(key => [key, rows.get(key).value]),
                put: async () => fail('SCHEMA_FROZEN_INPUT_WRITE_REFUSED') };
        });
        return scoped({ branch: closed[0], status: closed[1] }, action);
    }
    return { branch: views.branch, status: views.status, capture, verify };
}
