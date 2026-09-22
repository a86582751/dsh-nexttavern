// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/snapshot.ts; edit the TypeScript source.
const EMPTY_LIST = [];
const EMPTY_TIMELINE = { turnOrder: EMPTY_LIST, turns: new Map() };
const EMPTY_NODE_SOURCE = {
    getSnapshot: () => undefined,
    subscribe: () => () => { },
};
const EMPTY_NODE_PROCESS_SOURCE = {
    getSnapshot: () => undefined,
    subscribe: () => () => { },
};
const EMPTY_TURN_NODE_SOURCE = {
    getSnapshot: () => EMPTY_LIST,
    subscribe: () => () => { },
};
/** Empty Chat target used before a view builder is registered. */
export const EMPTY_CHAT_SNAPSHOT = {
    order: EMPTY_LIST,
    nodes: {
        get: () => undefined,
        source: () => EMPTY_NODE_SOURCE,
        turnDataSource: () => EMPTY_TURN_NODE_SOURCE,
        processSource: () => EMPTY_NODE_PROCESS_SOURCE,
        values: () => EMPTY_LIST,
    },
    locations: {
        getTurn: () => EMPTY_LIST,
        getStep: () => EMPTY_LIST,
    },
    navigation: {
        items: () => EMPTY_LIST,
    },
    timeline: EMPTY_TIMELINE,
    legacy: {
        nodes: EMPTY_LIST,
        turnTimings: new Map(),
        turnEnds: new Map(),
        partial: null,
        runningCalls: EMPTY_LIST,
    },
};
