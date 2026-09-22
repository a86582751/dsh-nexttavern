// Generated from runtime/alpha3/compat/ui-chat/src/client/stores.ts; edit the TypeScript source.
/** Per-Session Chat view store. */
import { defineStore } from '@deepseek-ai/dsh-client-store';
/**
 * Resolve the manually expanded answer for one Turn.
 * @param state - Chat store snapshot.
 * @param turn - owning Turn.
 * @returns the Turn's stored entry, when present.
 */
export function storedTurnProcessEntry(state, turn) {
    return state.turnProcesses.find(entry => entry.turn === turn);
}
/**
 * Create the Chat view store handle.
 * @returns a handle instantiated once per rendered Session scope.
 */
export function createChatStore() {
    return defineStore({
        init: () => ({ turnProcesses: [] }),
        actions: {
            setTurnProcessOpen: (draft, turn, answerStep, open) => {
                const index = draft.turnProcesses.findIndex(entry => entry.turn === turn);
                if (!open) {
                    if (index >= 0)
                        draft.turnProcesses.splice(index, 1);
                    return;
                }
                const next = { turn, answerStep };
                if (index < 0)
                    draft.turnProcesses.push(next);
                else
                    draft.turnProcesses[index] = next;
            },
        },
    });
}
