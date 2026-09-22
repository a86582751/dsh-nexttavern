// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/render-entry.ts; edit the TypeScript source.
import { assertNever } from '@deepseek-ai/dsh-util-values';
/**
 * Identify a rendering position independently of presentation mode.
 * @param entry - mode-independent rendering reference.
 * @returns its collision-free React key.
 */
export function chatRenderKey(entry) {
    switch (entry.kind) {
        case 'node': return JSON.stringify(['node', entry.key, entry.groupPart ?? null]);
        case 'group': return JSON.stringify(['group', entry.key]);
        default: return assertNever(entry);
    }
}
