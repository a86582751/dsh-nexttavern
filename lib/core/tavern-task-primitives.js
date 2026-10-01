// Generated from runtime/alpha3/src/core/tavern-task-primitives.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
/** Cancel this wait without cancelling work shared with another caller. */
export function untilAborted(promise, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason ?? new Error('任务已取消'));
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        if (signal.aborted)
            abort();
    });
}
export function decodeTaskSelection(value) {
    const record = (input) => input !== null && typeof input === 'object' && !Array.isArray(input);
    const route = (input) => record(input) && typeof input.provider === 'string' && typeof input.model === 'string';
    if (!record(value) || (value.execution !== 'inline' && value.execution !== 'spawn') || !route(value.main) || !route(value.actualRoute)) {
        throw new Error('任务模型路由无效，无法恢复原始选择');
    }
    return { ...value, execution: value.execution, main: value.main, actualRoute: value.actualRoute };
}
function stable(value) {
    if (!value || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map(stable);
    const record = value;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, stable(record[key])]));
}
export function taskHash(value) {
    // Preserve the original JSON encoding, including rejection of undefined.
    return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
export function isInlinePending(error) {
    return error?.code === 'TAVERN_INLINE_PENDING';
}
export function decodeTaskRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const record = value;
    if (record.schemaVersion !== 1 || typeof record.id !== 'string' || typeof record.sessionId !== 'string' ||
        (record.branchId !== undefined && typeof record.branchId !== 'string') || typeof record.kind !== 'string' || typeof record.status !== 'string' ||
        !['queued', 'running', 'waiting-main', 'completed', 'failed', 'cancelled', 'stale'].includes(record.status) ||
        !['inline', 'spawn'].includes(String(record.execution ?? 'spawn')))
        return null;
    return record;
}
