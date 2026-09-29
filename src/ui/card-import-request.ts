export type CardImportRequestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface CardImportRequestIndex {
    schemaVersion: 1;
    sessionId: string;
    resourceId: string;
    requestId: string;
    createdAt: number;
}

export function createCardImportRequestJournal({storage}: {
    storage?: CardImportRequestStorage;
} = {}) {
    // Only failed preflight writes need a volatile candidate. No POST can use
    // that identity until persistence succeeds; a remount reads the saved index.
    const unsaved = new Map<string, CardImportRequestIndex>();
    const keyFor = (sessionId: string, resourceId: string) =>
        `dsh.nexttavern.card-import.v1.${encodeURIComponent(JSON.stringify([sessionId, resourceId]))}`;
    const read = (sessionId: string, resourceId: string): CardImportRequestIndex | null => {
        if ([sessionId, resourceId].some(value => typeof value !== 'string' || value.length < 1 || value.length > 256)) {
            throw new Error('角色卡导入的会话或资源标识无效；已停止提交，请刷新资源列表后核对');
        }
        let saved: string | null;
        try {
            saved = (storage ?? globalThis.localStorage).getItem(keyFor(sessionId, resourceId));
        } catch {
            throw new Error('无法读取角色卡导入恢复标识；为避免重复导入，已停止提交。请检查浏览器站点存储后重试');
        }
        if (saved === null) return null;
        try {
            if (saved.length > 2048) throw new Error('oversized identity record');
            const value: unknown = JSON.parse(saved);
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const index = value as Partial<CardImportRequestIndex>;
                const fields = ['schemaVersion', 'sessionId', 'resourceId', 'requestId', 'createdAt'];
                if (Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key))
                    && index.schemaVersion === 1 && index.sessionId === sessionId && index.resourceId === resourceId
                    && typeof index.requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(index.requestId)
                    && typeof index.createdAt === 'number' && Number.isSafeInteger(index.createdAt)
                    && index.createdAt >= 0 && index.createdAt <= 8.64e15) {
                    return index as CardImportRequestIndex;
                }
            }
        } catch {}
        // A damaged/unknown index may still identify an admitted server job.
        // Never discard it or replace it with a fresh identity automatically.
        throw new Error('角色卡导入恢复标识格式损坏或版本不支持；已停止提交。请保留站点存储并核对原导入任务');
    };
    return {
        prepare(sessionId: string, resourceId: string) {
            const saved = read(sessionId, resourceId);
            if (saved) return {index: saved, reused: true};
            const key = keyFor(sessionId, resourceId);
            const index = unsaved.get(key) ?? {
                schemaVersion: 1 as const, sessionId, resourceId,
                requestId: crypto.randomUUID(), createdAt: Date.now(),
            };
            unsaved.set(key, index);
            try {
                (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(index));
            } catch {
                throw new Error('无法保存角色卡导入恢复标识；尚未提交导入。请检查浏览器站点存储后重试');
            }
            unsaved.delete(key);
            return {index, reused: false};
        },
        complete(index: CardImportRequestIndex) {
            // An old response must not erase the identity of a newer operation.
            const current = read(index.sessionId, index.resourceId);
            // Another matching completed receipt may already have cleared it.
            // Absence is an idempotent success; a stored newer identity is not.
            if (current === null) return true;
            if (current.requestId !== index.requestId) return false;
            try {
                (storage ?? globalThis.localStorage).removeItem(keyFor(index.sessionId, index.resourceId));
            } catch {
                throw new Error('原导入任务已完成，但无法清除恢复标识；请检查浏览器站点存储，之后可再次点击确认同一任务');
            }
            return true;
        },
    };
}
