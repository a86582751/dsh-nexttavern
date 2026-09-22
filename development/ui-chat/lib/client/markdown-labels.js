// Generated from runtime/alpha3/compat/ui-chat/src/client/markdown-labels.ts; edit the TypeScript source.
/** Localized copy adapters for Cordis-free Markdown primitives. */
/**
 * Build the complete Markdown chrome copy for one locale revision.
 * @param t - Chat locale seat.
 * @returns Labels for code fences and footnotes.
 */
export function markdownLabels(t) {
    return {
        code: { copyLabel: t('copy'), copiedLabel: t('copied') },
        footnotes: t('markdown.footnotes'),
    };
}
