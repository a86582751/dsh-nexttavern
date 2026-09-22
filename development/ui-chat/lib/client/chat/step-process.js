// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/step-process.ts; edit the TypeScript source.
/**
 * Compose a closed group's localized title from its top three categories without counts.
 * @param summary - ranked work and phase evidence for this range.
 * @param t - Chat namespace translator.
 * @returns the secondary disclosure title.
 */
export function processTitle(summary, t) {
    const labels = summary.counts.slice(0, 3).map(({ kind }) => t(`message.stepProcess.done.${kind}`));
    const first = labels[0];
    if (first === undefined)
        return t('message.stepProcess.done.thinking');
    const continuation = (label) => label.charAt(0).toLowerCase() + label.slice(1);
    const second = labels[1];
    if (second === undefined)
        return first;
    if (labels.length === 2) {
        const prefix = t('message.stepProcess.sharedPrefix');
        const shared = prefix !== '' && first.startsWith(prefix) && second.startsWith(prefix);
        return t('message.stepProcess.joinTwo', { first, second: continuation(shared ? second.slice(prefix.length) : second) });
    }
    const title = [first, ...labels.slice(1).map(continuation)].join(t('message.stepProcess.comma'));
    return summary.counts.length > 3 ? t('message.stepProcess.more', { title }) : title;
}
