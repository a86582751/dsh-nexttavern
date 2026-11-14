// Generated from runtime/alpha3/src/core/roleplay-story-text.ts; edit the TypeScript source.
/** Consumption text is separate from Native message/proof identity. The schema
 * owner supplies accepted bodies; this adapter owns their one text-block mapping
 * for Reader, prompt material and memory consumers. */
import { recordSha256, textOf } from './roleplay-data.js';
export function createRoleplayStoryTextReader(capture, messageVersion = recordSha256) {
    return (sessionId, options) => {
        const accepted = capture(sessionId, options);
        // An empty accepted index can still guard a completed numerical Story
        // whose settlement is pending or unknown. Keep that owner's capture so
        // consumers cannot reuse raw-body material across its completion.
        if (!accepted)
            return undefined;
        const read = (seq, message, versionSha256) => {
            if (message.role !== undefined && message.role !== 'assistant')
                return undefined;
            versionSha256 ??= messageVersion(message);
            return accepted.read({ seq, messageId: message.id, versionSha256 });
        };
        return {
            hasValues: accepted.hasValues,
            text: (seq, message, originalText = textOf(message.content), versionSha256) => read(seq, message, versionSha256)?.message_content ?? originalText,
            blocks: (seq, message, versionSha256) => {
                const body = read(seq, message, versionSha256);
                if (!body)
                    return undefined;
                let first = true;
                return new Map(message.content.flatMap((block, index) => {
                    if (block.type !== 'text')
                        return [];
                    const text = first ? body.message_content : '';
                    first = false;
                    return [[index, text]];
                }));
            }, current: () => accepted.current(),
        };
    };
}
