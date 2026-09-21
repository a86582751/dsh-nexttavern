// Generated from runtime/alpha3/src/core/character-cluster-settings.ts; edit the TypeScript source.
import { withTavernLock } from './tavern-tasks.js';
import { clusterRoute, clusterSettings } from './character-cluster-projection.js';
export const clusterRecord = (value) => value !== null
    && typeof value === 'object'
    && !Array.isArray(value) ? value : undefined;
function assertSettings(value) {
    const data = clusterRecord(value);
    if (data?.schemaVersion !== 1)
        throw new Error('角色集群设置版本不受支持');
    if (typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision) || data.revision < 0
        ||
            typeof data.enabled !== 'boolean'
        || !clusterRecord(data.characters))
        throw new Error('角色集群设置损坏');
    // Validate without normalizing stored routes or discarding extension fields.
    clusterSettings(data);
}
const clone = (v) => structuredClone(v);
/** One settings owner for conversation roots and the global model override; saves retain revision CAS. */
export function createCharacterClusterSettings(table, rootOf) {
    const settingsKey = (s) => `character-cluster-settings__${rootOf(s)}`;
    const globalKey = 'character-cluster-model-global';
    const readGlobal = () => {
        const value = table.get(globalKey);
        if (value === undefined || value === null)
            return {
                schemaVersion: 1,
                revision: 0,
                enabled: false,
                defaultRoute: null,
                characters: {}
            };
        assertSettings(value);
        return clone(value);
    };
    const readLocal = (s) => {
        const value = table.get(settingsKey(s)) ?? {
            schemaVersion: 1, revision: 0, enabled: false, defaultRoute: null, characters: {}
        };
        assertSettings(value);
        return clone(value);
    };
    const read = (s) => {
        const local = readLocal(s), global = readGlobal();
        // Preserve old profiles until the user explicitly chooses a global model.
        return {
            ...local, defaultRoute: global.revision > 0 ? global.defaultRoute : local.defaultRoute
        };
    };
    async function saveGlobal(value, expectedRevision) {
        const route = clusterRoute(clusterRecord(value)?.defaultRoute);
        return withTavernLock(table, globalKey, async () => {
            const previous = readGlobal();
            if (previous.revision !== expectedRevision)
                throw new Error('全局角色模型已更新，请刷新后重试');
            const next = {
                schemaVersion: 1,
                revision: previous.revision + 1,
                enabled: false,
                defaultRoute: route,
                characters: {},
                updatedAt: Date.now()
            };
            await table.put(globalKey, next);
            return clone(next);
        });
    }
    async function save(s, value, expectedRevision) {
        return withTavernLock(table, settingsKey(s), async () => {
            const previous = readLocal(s);
            if (previous.revision !== expectedRevision)
                throw new Error('集群设置已更新，请刷新后重试');
            const next = {
                schemaVersion: 1,
                revision: previous.revision + 1,
                ...clusterSettings(value),
                updatedAt: Date.now()
            };
            await table.put(settingsKey(s), next);
            return clone(next);
        });
    }
    return {
        read, readLocal, readGlobal, save, saveGlobal
    };
}
