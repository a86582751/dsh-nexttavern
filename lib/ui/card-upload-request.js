// Generated from runtime/alpha3/src/ui/card-upload-request.ts; edit the TypeScript source.
export class CardUploadRequestError extends Error {
}
const fields = ['schemaVersion', 'sessionId', 'receiptId', 'requestId', 'createdAt'];
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const sameIdentity = (a, b) => fields.every(field => a[field] === b[field]);
export function createCardUploadRequestJournal({ storage } = {}) {
    // A failed write may retry its identity, but cannot admit a job before readback.
    const unsaved = new Map();
    const keyFor = (sessionId) => `dsh.nexttavern.card-upload.v1.${encodeURIComponent(sessionId)}`;
    const read = (sessionId) => {
        if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 256) {
            throw new CardUploadRequestError('角色卡导入的会话标识无效；已停止提交，请核对当前对话');
        }
        let saved;
        try {
            saved = (storage ?? globalThis.localStorage).getItem(keyFor(sessionId));
        }
        catch {
            throw new CardUploadRequestError('无法读取角色卡上传恢复标识；已停止提交。请检查浏览器站点存储后重试');
        }
        if (saved === null)
            return null;
        try {
            if (saved.length > 2048)
                throw new Error('oversized record');
            const value = JSON.parse(saved);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const index = value;
                if (Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key))
                    && index.schemaVersion === 1 && index.sessionId === sessionId
                    && validId(index.receiptId) && validId(index.requestId)
                    && typeof index.createdAt === 'number' && Number.isSafeInteger(index.createdAt)
                    && index.createdAt >= 0 && index.createdAt <= 8.64e15) {
                    return index;
                }
            }
        }
        catch { }
        // Unknown records may represent admitted jobs; never replace or discard them.
        throw new CardUploadRequestError('角色卡上传恢复标识格式损坏或版本不支持；已停止提交。请保留站点存储并核对原导入任务');
    };
    return {
        read,
        volatilePending(sessionId) {
            // A volatile candidate never bypasses an unreadable or damaged durable record.
            if (read(sessionId))
                return null;
            const index = unsaved.get(sessionId);
            return index ? { ...index } : null;
        },
        prepare(sessionId, receiptId) {
            const saved = read(sessionId);
            if (!validId(receiptId)) {
                throw new CardUploadRequestError('上传回执标识无效；尚未提交导入，请核对上传状态');
            }
            if (saved) {
                if (saved.receiptId !== receiptId) {
                    throw new CardUploadRequestError('当前对话还有待确认的原导入任务；不能用新文件替换恢复标识');
                }
                return { index: saved, reused: true };
            }
            const previous = unsaved.get(sessionId);
            if (previous && previous.receiptId !== receiptId) {
                throw new CardUploadRequestError('当前上传的恢复标识尚未保存；请先重试保存同一次上传');
            }
            const index = previous ?? {
                schemaVersion: 1, sessionId, receiptId,
                requestId: crypto.randomUUID(), createdAt: Date.now(),
            };
            unsaved.set(sessionId, index);
            try {
                (storage ?? globalThis.localStorage).setItem(keyFor(sessionId), JSON.stringify(index));
            }
            catch {
                throw new CardUploadRequestError('无法保存角色卡上传恢复标识；尚未提交导入。请检查浏览器站点存储后重试');
            }
            const persisted = read(sessionId);
            if (!persisted || !sameIdentity(persisted, index)) {
                throw new CardUploadRequestError('角色卡上传恢复标识未能可靠保存；尚未提交导入，请核对浏览器站点存储');
            }
            unsaved.delete(sessionId);
            return { index: persisted, reused: false };
        },
        clear(index) {
            const current = read(index.sessionId);
            if (current && !sameIdentity(current, index))
                return false;
            try {
                if (current)
                    (storage ?? globalThis.localStorage).removeItem(keyFor(index.sessionId));
            }
            catch {
                throw new CardUploadRequestError('无法清除这次导入的本地恢复标识；请检查浏览器站点存储后再次确认同一任务');
            }
            if (read(index.sessionId)) {
                throw new CardUploadRequestError('这次导入的本地恢复标识未能清除；请核对浏览器站点存储后重试');
            }
            const pending = unsaved.get(index.sessionId);
            if (pending && sameIdentity(pending, index))
                unsaved.delete(index.sessionId);
            return true;
        },
    };
}
