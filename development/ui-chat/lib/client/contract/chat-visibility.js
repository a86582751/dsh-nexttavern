// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/chat-visibility.ts; edit the TypeScript source.
/**
 * Exclude system prompts, ordinary Context, and permission commands from visible Chat rows.
 * @param node - projected Chat node.
 * @returns whether the node contributes a visible Chat row.
 */
export function isVisibleChatNode(node) {
    return node.visibility === 'visible'
        && node.kind !== 'system-prompt'
        && node.kind !== 'context'
        && !(node.kind === 'command' && node.data.name === 'permission');
}
