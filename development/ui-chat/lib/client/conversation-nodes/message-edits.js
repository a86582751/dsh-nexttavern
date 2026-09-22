// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/message-edits.ts; edit the TypeScript source.
import { assertMessageEdit } from 'dsh-nexttavern-session-format/projection';
import { chatNode } from "./common.js";
export const messageEditDefinition = {
    kind: 'roleplay-message-edit',
    target: 'chat',
    // Update-only contexts also work when the first edit precedes the loaded
    // window. They need no synthetic start event or target-message mutation.
    match: event => event.type === 'roleplay/message-edit'
        ? { id: String(event.data.targetSeq), role: 'update' } : null,
    start: () => undefined,
    update: () => undefined,
    buildViewNode(context) {
        const event = context.matches.at(-1)?.event;
        if (event?.type !== 'roleplay/message-edit')
            return null;
        assertMessageEdit(event.data);
        if (event.ignorable || event.data.targetSeq >= event.seq)
            throw Error('Invalid required chat message edit');
        return chatNode(context, 'message-edit', event.data.targetSeq, { ...event.data, editSeq: event.seq }, { visibility: 'hidden', location: { kind: 'session' } });
    },
};
function userContent(content, text) {
    let inserted = false;
    const result = [];
    for (const block of content) {
        if (block.type !== 'text')
            result.push(block);
        else if (!inserted) {
            result.push({ type: 'text', text });
            inserted = true;
        }
    }
    if (!inserted)
        result.unshift({ type: 'text', text });
    return result;
}
function assistantContent(content, text) {
    let inserted = false;
    const result = [];
    for (const block of content) {
        if (block.kind !== 'text')
            result.push(block);
        else if (!inserted) {
            result.push({ kind: 'text', text });
            inserted = true;
        }
    }
    if (!inserted)
        result.unshift({ kind: 'text', text });
    return result;
}
function editedAssistant(data, edit) {
    if (edit.role !== 'assistant' || data.finalNode.messageId !== edit.messageId)
        throw Error('Chat assistant edit identity mismatch');
    const blocks = assistantContent(data.blocks, edit.text);
    return { ...data, blocks, finalNode: { ...data.finalNode, blocks } };
}
function targetSeq(raw) {
    const node = raw;
    if (node.kind === 'user' || node.kind === 'steering')
        return node.data.seq;
    if (node.kind === 'assistant-step')
        return node.data.finalNode?.seq;
    if (node.kind === 'turn-tail')
        return node.data.closing?.finalNode.seq;
    return undefined;
}
function project(raw, edit) {
    if (edit === undefined)
        return raw;
    const node = raw;
    if (node.kind === 'user' || node.kind === 'steering') {
        if (edit.role !== 'user' || node.data.messageId !== edit.messageId)
            throw Error('Chat user edit identity mismatch');
        return { ...node, data: { ...node.data, content: userContent(node.data.content, edit.text) } };
    }
    if (node.kind === 'assistant-step' && node.data.finalNode !== undefined) {
        const data = editedAssistant(node.data, edit);
        const visible = data.blocks.some(block => block.kind !== 'tool-call'
            && ((block.kind !== 'text' && block.kind !== 'reasoning') || block.text.trim() !== ''));
        return { ...node, data, visibility: visible ? 'visible' : 'hidden' };
    }
    if (node.kind === 'turn-tail' && node.data.closing !== null) {
        return { ...node, data: { ...node.data, closing: editedAssistant(node.data.closing, edit) } };
    }
    return raw;
}
/** Each Session view builder owns this index; releasing that builder releases every retained edit. */
export class ChatMessageEditProjector {
    edits = new Map();
    raw = new Map();
    keysByTarget = new Map();
    targetByKey = new Map();
    replace(nodes) {
        this.raw.clear();
        this.keysByTarget.clear();
        this.targetByKey.clear();
        // The tail page can hold an edit whose target is loaded by a later page.
        // Keep newest known decisions for this Session across window replacement.
        return this.apply(nodes);
    }
    apply(nodes) {
        const dirty = new Set();
        const changedTargets = new Set();
        for (const raw of nodes) {
            const node = raw;
            if (node.kind === 'message-edit') {
                const previous = this.edits.get(node.data.targetSeq);
                if (previous === undefined || previous.editSeq < node.data.editSeq) {
                    this.edits.set(node.data.targetSeq, node.data);
                    changedTargets.add(node.data.targetSeq);
                }
                continue;
            }
            this.raw.set(node.key, raw);
            dirty.add(node.key);
            const oldTarget = this.targetByKey.get(node.key);
            const target = targetSeq(raw);
            if (oldTarget !== target && oldTarget !== undefined) {
                const keys = this.keysByTarget.get(oldTarget);
                keys?.delete(node.key);
                if (!keys?.size)
                    this.keysByTarget.delete(oldTarget);
                this.targetByKey.delete(node.key);
            }
            if (target !== undefined) {
                this.targetByKey.set(node.key, target);
                let keys = this.keysByTarget.get(target);
                if (keys === undefined)
                    this.keysByTarget.set(target, keys = new Set());
                keys.add(node.key);
            }
        }
        for (const target of changedTargets)
            for (const key of this.keysByTarget.get(target) ?? [])
                dirty.add(key);
        return [...dirty].map(key => {
            const raw = this.raw.get(key);
            const target = this.targetByKey.get(key);
            return project(raw, target === undefined ? undefined : this.edits.get(target));
        });
    }
}
export function registerMessageEdits(ctx) {
    ctx.uiConversation.events.register(messageEditDefinition);
}
