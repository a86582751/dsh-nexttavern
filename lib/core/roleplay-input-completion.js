// Generated from runtime/alpha3/src/core/roleplay-input-completion.ts; edit the TypeScript source.
/** One original Native work's terminal ledger. Owner writes are short; the
 * numerical/management publisher runs after that queue has been released. */
import { recordSha256 } from './roleplay-data.js';
import { createRoleplayInputTerminal } from './roleplay-input-terminal.js';
export const inputCompletionKey = (sid, id) => `${sid}__native-input-v2-terminal-${id}`;
const same = (a, b) => recordSha256(a) === recordSha256(b);
const seal = (row) => {
    const { recordSha256: _prior, ...body } = row;
    return { ...body, recordSha256: recordSha256(body) };
};
export function readInputCompletion(table, sid, id) {
    try {
        const raw = table.get(inputCompletionKey(sid, id));
        if (!raw || (raw.schemaVersion === 1 ? raw.encoding !== 'roleplay-input-completion-v1' || raw.plan?.kind === 'schema-numerical'
            : raw.schemaVersion !== 2 || raw.encoding !== 'roleplay-input-completion-v2' || raw.plan?.kind !== 'schema-numerical') || raw.sessionId !== sid
            || raw.scope.currency.preparationId !== id || !['pending', 'settled', 'unknown'].includes(raw.status))
            return undefined;
        const { recordSha256: hash, ...body } = raw;
        return hash === recordSha256(body) ? structuredClone(raw) : undefined;
    }
    catch {
        return undefined;
    }
}
export function createRoleplayInputCompletion(deps) {
    let generation = 0, live = true, active = false;
    const terminal = createRoleplayInputTerminal({ current: deps.current, checkOriginal: deps.checkOriginal,
        checkStored: (currency, receipt) => deps.checkStored({ currency, receipt, stopGeneration: generation }),
        sourceCurrent: sha => deps.processor.sourceCurrent(deps.sessionId, sha),
        canonicalCurrent: deps.processor.canonicalCurrent, nativeCurrent: deps.nativeCurrent });
    function current(scope) {
        const actual = deps.current();
        return live && scope.stopGeneration === generation && !!actual && same(actual.currency, scope.currency)
            && same(actual.checkpoint, scope.receipt.checkpoint) && same(actual.transition, scope.transition)
            && !deps.checkStored(scope) && deps.nativeCurrent(scope.receipt);
    }
    async function put(row) {
        const key = inputCompletionKey(deps.sessionId, row.scope.currency.preparationId);
        // A thrown response can still have committed. Exact readback is evidence;
        // it does not authorize a second write or a new completion invocation.
        try {
            await deps.table.put(key, structuredClone(row));
        }
        catch { /* read below */ }
        if (!same(deps.table.get(key), row))
            throw new Error('INPUT_TERMINAL_WRITE_UNCONFIRMED');
    }
    async function complete(receipt, signal) {
        const receiptSha256 = recordSha256(receipt);
        const refuse = (kind, code) => ({ kind, receiptSha256, code });
        if (active || !live)
            return refuse('blocked', 'INPUT_TERMINAL_ALREADY_ATTEMPTED');
        const actual = deps.current();
        if (!actual || !same(actual.checkpoint, receipt.checkpoint) || !deps.nativeCurrent(receipt)) {
            return refuse('blocked', 'INPUT_TERMINAL_NATIVE_CHANGED');
        }
        active = true;
        const scope = { currency: structuredClone(actual.currency), receipt,
            stopGeneration: generation, ...(actual.transition ? { transition: structuredClone(actual.transition) } : {}) };
        let token, closing, record;
        const owned = () => !signal?.aborted && (!deps.closing || !!closing && deps.closing.current(closing, scope));
        try {
            closing = deps.closing?.begin(scope, signal);
            // Preparation can await already-owned Phase B/C work. It holds neither
            // the input writer queue nor a Source lock and never waits Agent idle.
            const plan = await deps.processor.prepare(scope, closing);
            await deps.enqueue(async () => {
                if (!owned() || !current(scope) || deps.checkOriginal())
                    throw new Error('INPUT_TERMINAL_SCOPE_CHANGED');
                const existing = deps.table.get(inputCompletionKey(deps.sessionId, scope.currency.preparationId));
                if (existing !== undefined)
                    throw new Error('INPUT_TERMINAL_ALREADY_ATTEMPTED');
                record = seal({ schemaVersion: plan.kind === 'schema-numerical' ? 2 : 1,
                    encoding: plan.kind === 'schema-numerical' ? 'roleplay-input-completion-v2' : 'roleplay-input-completion-v1', sessionId: deps.sessionId,
                    scope: structuredClone(scope), plan: structuredClone(plan), status: 'pending' });
                await put(record);
                if (!owned() || !current(scope))
                    throw new Error('INPUT_TERMINAL_PERMISSION_REVOKED');
                if (plan.kind === 'numerical') {
                    const nominated = terminal.nominate(receipt, plan.intent);
                    if (nominated.kind !== 'nominated')
                        throw new Error(nominated.code);
                    token = nominated.token;
                }
            });
            if (!owned())
                throw new Error('INPUT_TERMINAL_PERMISSION_REVOKED');
            const published = await deps.processor.publish(scope, plan, token, closing);
            if (published.kind !== 'acknowledged')
                throw new Error(published.code);
            // The numerical head can now differ from the original snapshot. Only
            // the exact hot/stored work and the publisher's complete facts may ACK.
            await deps.enqueue(async () => {
                if (!record || !owned() || !current(scope) || !deps.processor.verifySettlement(scope, plan, published.settlement)
                    || plan.kind === 'numerical' && (!token || terminal.check(token, plan.intent).kind !== 'allow')) {
                    throw new Error('INPUT_TERMINAL_SETTLEMENT_UNCONFIRMED');
                }
                record = seal({ ...record, status: 'settled', settlement: structuredClone(published.settlement) });
                await put(record);
                if (!owned() || !current(scope))
                    throw new Error('INPUT_TERMINAL_PERMISSION_REVOKED');
            });
            if (token)
                terminal.finish(token);
            active = false;
            return { kind: 'settled', receiptSha256, ownerReceiptSha256: record.recordSha256 };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(message) ? message : 'INPUT_TERMINAL_UNKNOWN';
            if (token)
                terminal.finish(token);
            if (record)
                try {
                    await deps.enqueue(async () => {
                        // Never overwrite a concurrent tombstone or a different terminal row.
                        if (!same(deps.table.get(inputCompletionKey(deps.sessionId, scope.currency.preparationId)), record))
                            return;
                        record = seal({ ...record, status: 'unknown', code });
                        await put(record);
                    });
                }
                catch { /* The prior pending/unknown row remains a cold admission gate. */ }
            return refuse('unknown', code);
        }
        finally {
            if (closing)
                deps.closing?.release(closing);
        }
    }
    return { complete,
        checkPermission: (token, intent) => terminal.check(token, intent).kind === 'allow',
        revoke() { generation++; deps.closing?.revoke(); terminal.revoke(); },
        dispose() { live = false; generation++; deps.closing?.revoke(); terminal.dispose(); },
    };
}
