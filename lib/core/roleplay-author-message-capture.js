// Generated from runtime/alpha3/src/core/roleplay-author-message-capture.ts; edit the TypeScript source.
/** Actual Native message addresses and their ordinary State read cut. This
 * owner is shared by schema and plain consumers; DATA never grants a writer. */
import { recordSha256 } from './roleplay-data.js';
import { authorOrdinaryMessageSelectionV1 } from './roleplay-author-prompt-capture.js';
export function captureAuthorMessageViewV1(input) {
    const { namespace, opening, inputState, state } = input;
    const captured = inputState.captureClosedHistoricalFacts(input.sessionId, `author-ordinary-message-set:${recordSha256(namespace)}:${input.targetSetIdentity}:${JSON.stringify(opening.ordinaryVariants ?? null)}`, () => {
        const result = [];
        const start = input.messages.findIndex(row => row.messageId === opening.messageId);
        if (start < 0)
            throw Error('AUTHOR_MESSAGE_OPENING_UNPROVEN');
        for (const message of input.messages.slice(start)) {
            if (message.nativeSeq === null)
                continue;
            if (message.messageId === opening.messageId && opening.ordinaryVariants === null)
                continue;
            const variants = message.messageId === opening.messageId && opening.ordinaryVariants
                ? opening.ordinaryVariants.variant_ids.map(id => ({ kind: 'opening-variant', id })) : [{ kind: 'native-canonical' }];
            for (const variant of variants) {
                const target = { ...namespace, target: { kind: 'message', identity: {
                            ownerSessionId: input.nativeOwnerForSeq(message.nativeSeq), nativeSeq: message.nativeSeq, messageId: message.messageId, variant
                        } } };
                const read = inputState.captureClosedHistoricalFacts(input.sessionId, `author-ordinary-message:${recordSha256(target)}`, () => state.captureNamespaceV3(target));
                result.push(read.data);
            }
        }
        return result;
    });
    let messages;
    return Object.freeze({ opening, ordinaryMessages: captured.data,
        get messages() {
            if (messages)
                return messages;
            const ordinaryFor = authorOrdinaryMessageSelectionV1(captured.data, opening);
            return messages = Object.freeze(input.messages.map(row => {
                const ordinary = ordinaryFor(row);
                return Object.freeze({ ...row, ...ordinary ? { ordinary } : {} });
            }));
        },
        current: () => input.current() && captured.current() });
}
