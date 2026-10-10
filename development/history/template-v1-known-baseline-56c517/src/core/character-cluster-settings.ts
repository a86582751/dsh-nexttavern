import { withTavernLock } from './tavern-tasks.js';
import {
    clusterRoute,
    clusterSettings,
    type CharacterRoute,
    type CharacterSettings
} from './character-cluster-projection.js';
interface SettingsRecord extends Omit<CharacterSettings, 'defaultRoute'> {
    schemaVersion: 1;
    revision: number;
    defaultRoute?: CharacterRoute | null;
    updatedAt?: number;
}
export interface ClusterSettingsTable {
    get(key: string): unknown;
    put(key: string, value: unknown): void | PromiseLike<unknown>;
}
export const clusterRecord = (value: unknown): Record<string,
     unknown> | undefined => value !== null
    && typeof value === 'object'
    && !Array.isArray(value) ? value as Record<string,
     unknown> : undefined;
function assertSettings(value: unknown): asserts value is SettingsRecord {
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
const clone = <T>(v: T): T => structuredClone(v);
/** One settings owner for conversation roots and the global model override; saves retain revision CAS. */
export function createCharacterClusterSettings<S extends {
    id: string;
}>(table: ClusterSettingsTable, rootOf: (session: S) => string) {
    const settingsKey = (s: S) => `character-cluster-settings__${rootOf(s)}`;
    const globalKey = 'character-cluster-model-global';
    const readGlobal = () => {
        const value = table.get(globalKey);
        if (value === undefined || value === null)
            return {
                schemaVersion: 1 as const,
                revision: 0,
                enabled: false,
                defaultRoute: null,
                characters: {}
            };
        assertSettings(value);
        return clone(value);
    };
    const readLocal = (s: S) => {
        const value = table.get(settingsKey(s)) ?? {
            schemaVersion: 1, revision: 0, enabled: false, defaultRoute: null, characters: {}
        };
        assertSettings(value);
        return clone(value);
    };
    const read = (s: S) => {
        const local = readLocal(s), global = readGlobal();
        // Preserve old profiles until the user explicitly chooses a global model.
        return {
            ...local, defaultRoute: global.revision > 0 ? global.defaultRoute : local.defaultRoute
        };
    };
    async function saveGlobal(value: unknown, expectedRevision: number) {
        const route = clusterRoute(clusterRecord(value)?.defaultRoute);
        return withTavernLock(table, globalKey, async () => {
            const previous = readGlobal();
            if (previous.revision !== expectedRevision)
                throw new Error('全局角色模型已更新，请刷新后重试');
            const next = {
                schemaVersion: 1 as const,
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
    async function save(s: S, value: unknown, expectedRevision: number) {
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
