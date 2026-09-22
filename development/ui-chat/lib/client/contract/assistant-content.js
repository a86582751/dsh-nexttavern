// Generated from runtime/alpha3/compat/ui-chat/src/client/contract/assistant-content.ts; edit the TypeScript source.
/**
 * Test whether Assistant blocks contain a user-facing reply rather than only
 * reasoning or Tool-call protocol material.
 * @param blocks - Assistant content blocks.
 * @returns whether the blocks contain visible reply content.
 */
export function hasAssistantReplyContent(blocks) {
    return blocks.some((block) => {
        if (block.kind === 'reasoning' || block.kind === 'tool-call')
            return false;
        if (block.kind === 'text')
            return block.text.trim() !== '';
        return true;
    });
}
