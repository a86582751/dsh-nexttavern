// Generated from runtime/alpha3/src/core/roleplay-side-chat-bridge.ts; edit the TypeScript source.
// Host UI and Roleplay Core are delivered in different packages. Their module
// copies share one process realm, so the registration state must not live in a
// package-local module instance.
const registry = globalThis;
const state = registry[Symbol.for('dsh.nexttavern.side-chat-bridge.v1')] ??=
    { published: null, receiver: null, dispose: null };
const connectBridge = () => {
    state.dispose?.();
    state.dispose = state.published && state.receiver ? state.receiver(state.published) : null;
};
/** The Host shell owns registration; Roleplay Core supplies the owner-backed definitions. */
export function receiveSideChatBridge(receiver) {
    state.receiver = receiver;
    connectBridge();
    return () => { if (state.receiver === receiver) {
        state.receiver = null;
        connectBridge();
    } };
}
export function publishSideChatBridge(bridge) {
    state.published = bridge;
    connectBridge();
    return () => { if (state.published === bridge) {
        state.published = null;
        connectBridge();
    } };
}
