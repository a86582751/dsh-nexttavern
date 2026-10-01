// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/use-turn-data.ts; edit the TypeScript source.
import { useSyncExternalStore } from 'react';
const EMPTY_SOURCE = {
    getSnapshot: () => undefined,
    subscribe: () => () => { },
};
/**
 * Subscribe to one value from a Turn's keyed Location-data store.
 * @param data - current Turn data store, or absence for a Node outside a Turn.
 * @param key - declaration-merged business key.
 * @returns the current value for that key.
 */
export function useTurnDataValue(data, key) {
    const source = data?.source(key) ?? EMPTY_SOURCE;
    return useSyncExternalStore(source.subscribe, source.getSnapshot);
}
