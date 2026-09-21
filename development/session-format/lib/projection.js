// Generated from runtime/alpha3/compat/session-format/src/projection.ts; edit the TypeScript source.
import { deriveEventMessage } from '@deepseek-ai/dsh-session/surface';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
export const MESSAGE_EDIT_EVENT = 'roleplay/message-edit';
/** Reject future versions and malformed records before storage or replay can accept them. */
export function assertMessageEdit(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw Error('Invalid message edit payload');
    const data = value;
    if (Object.keys(data).sort().join(',') !== 'messageId,role,schemaVersion,targetSeq,text'
        || data.schemaVersion !== 1 || !Number.isSafeInteger(data.targetSeq) || Number(data.targetSeq) < 0
        || Object.is(data.targetSeq, -0) || typeof data.messageId !== 'string' || data.messageId.length === 0
        || (data.role !== 'assistant' && data.role !== 'user') || typeof data.text !== 'string'
        || data.text.length > 1_000_000)
        throw Error('Unsupported or malformed message edit v1');
}
/** Replace prose only; tool calls, reasoning, attachments and source attribution remain intact. */
export function editMessageText(message, edit) {
    if (message.role !== edit.role || message.id !== edit.messageId)
        throw Error('Message edit identity mismatch');
    if (message.role !== 'assistant' && message.role !== 'user')
        throw Error('Message is not editable');
    const content = [];
    let inserted = false;
    for (const block of message.content) {
        if (block.type !== 'text')
            content.push(block);
        else if (!inserted) {
            content.push({ type: 'text', text: edit.text });
            inserted = true;
        }
    }
    if (!inserted)
        content.unshift({ type: 'text', text: edit.text });
    return deepFreeze({ ...message, content });
}
export const messageEditProjection = {
    type: MESSAGE_EDIT_EVENT,
    project(event, context) {
        if (event.ignorable)
            throw Error('Message edits cannot be marked ignorable');
        assertMessageEdit(event.data);
        const edit = event.data;
        if (edit.targetSeq >= event.seq || !context.nodes.includes(edit.targetSeq)) {
            throw Error('Message edit must target an earlier current surface node');
        }
        const original = context.events[edit.targetSeq - context.baseSeq];
        if (original?.seq !== edit.targetSeq
            || (original.type !== 'assistant/message' && original.type !== 'user/message')) {
            throw Error('Message edit target is not a user or assistant message');
        }
        const current = context.messages.get(edit.targetSeq) ?? deriveEventMessage(original);
        if (current === null)
            throw Error('Message edit target has no derived message');
        // Session keeps the original seq as the presentation and model-history anchor.
        return new Map([[edit.targetSeq, editMessageText(current, edit)]]);
    },
};
export function isMessageEdit(event) {
    return event.type === MESSAGE_EDIT_EVENT;
}
