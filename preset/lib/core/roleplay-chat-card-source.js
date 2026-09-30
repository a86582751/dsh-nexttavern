// Generated from runtime/alpha3/src/core/roleplay-chat-card-source.ts; edit the TypeScript source.
import { extname } from 'node:path';
import { recordSha256 } from './roleplay-data.js';
import { CARD_LIMITS } from './tavern-card.js';
const hashPattern = /^[a-f0-9]{64}$/;
const fileTypes = new Set(['.png', '.json', '.md', '.txt']);
function fail(code) { throw new Error(`聊天角色卡：${code}`); }
function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('消息或来源记录无效');
    return value;
}
function exact(value, keys) {
    if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))
        fail('来源字段无效');
}
function id(value) {
    if (typeof value !== 'string' || !value || value.length > 256 || /[\x00-\x1f\x7f]/.test(value))
        fail('消息身份无效');
    return value;
}
function seq(value) {
    if (!Number.isSafeInteger(value) || Number(value) < 0)
        fail('消息游标无效');
    return Number(value);
}
export function chatCardSelector(value) {
    const selector = object(value);
    if (Object.keys(selector).some(key => key !== 'name'))
        fail('附件仅接受自然文件名选择');
    if (selector.name === undefined)
        return {};
    if (typeof selector.name !== 'string' || !selector.name.trim() || selector.name !== selector.name.trim()
        || Buffer.byteLength(selector.name, 'utf8') > 255 || /[\x00-\x1f\x7f/\\]/.test(selector.name))
        fail('附件名称无效');
    return { name: selector.name };
}
function file(value) {
    const ref = object(value);
    exact(ref, ['attachmentId', 'name', 'bytes']);
    if (typeof ref.attachmentId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(ref.attachmentId))
        fail('原件哈希无效');
    if (typeof ref.name !== 'string' || !ref.name.trim() || ref.name !== ref.name.trim()
        || /[\x00-\x1f\x7f<>:"/\\|?*]/.test(ref.name) || /[. ]$/.test(ref.name)
        || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(ref.name)
        || Buffer.byteLength(ref.name, 'utf8') > 255 || !fileTypes.has(extname(ref.name).toLowerCase()))
        fail('原件类型或名称无效');
    if (!Number.isSafeInteger(ref.bytes) || Number(ref.bytes) < 1 || Number(ref.bytes) > CARD_LIMITS.bytes)
        fail('原件大小超限');
    return { attachmentId: ref.attachmentId, name: ref.name, bytes: Number(ref.bytes) };
}
function messageIdentity(value) {
    const identity = object(value);
    exact(identity, ['seq', 'turn', 'messageId', 'messageSha256']);
    if (typeof identity.messageSha256 !== 'string' || !hashPattern.test(identity.messageSha256))
        fail('消息哈希无效');
    if (seq(identity.turn) < 1)
        fail('消息回合无效');
    return { seq: seq(identity.seq), turn: Number(identity.turn), messageId: id(identity.messageId), messageSha256: identity.messageSha256 };
}
function requestIdentity(proof) {
    return `chat-card-${recordSha256(proof)}`;
}
/** Revalidate durable metadata before using it for recovery or a server projection. */
export function validateChatCardProof(value) {
    const proof = object(value);
    exact(proof, ['schemaVersion', 'channel', 'sessionId', 'requestId', 'intent', 'source', 'attachmentIndex', 'file', 'proofSha256']);
    if (proof.schemaVersion !== 1 || proof.channel !== 'chat-attachment')
        fail('来源版本无效');
    const content = { schemaVersion: 1, channel: 'chat-attachment', sessionId: id(proof.sessionId),
        intent: messageIdentity(proof.intent), source: messageIdentity(proof.source), attachmentIndex: seq(proof.attachmentIndex), file: file(proof.file) };
    if (content.source.seq > content.intent.seq || content.attachmentIndex > 1023
        || proof.requestId !== requestIdentity(content) || proof.proofSha256 !== recordSha256({ ...content, requestId: proof.requestId })) {
        fail('不可变来源身份无效');
    }
    return { ...content, requestId: proof.requestId, proofSha256: proof.proofSha256 };
}
export function chatCardProjection(value) {
    const proof = validateChatCardProof(value);
    return { channel: proof.channel, requestId: proof.requestId, intentMessageId: proof.intent.messageId,
        sourceMessageId: proof.source.messageId, sourceMessageSeq: proof.source.seq, sourceSha256: proof.file.attachmentId.slice(7) };
}
function nativeMessage(row, inherited) {
    if (!row || seq(row.seq) < inherited)
        fail('不能读取继承消息的附件');
    const original = object(row.originalMessage), current = object(row.currentMessage);
    if (recordSha256(original) !== recordSha256(current))
        fail('消息已编辑或版本已变化');
    if (current.role !== 'user' || object(current.source).kind !== 'user' || !Array.isArray(current.content)
        || current.content.length > 1024)
        fail('不是实际玩家消息');
    if (seq(row.turn) < 1)
        fail('消息回合无效');
    return { identity: { seq: row.seq, turn: row.turn, messageId: id(current.id), messageSha256: recordSha256(current) }, content: current.content };
}
function capture(session, exec, context, selector, frozenSourceSeq) {
    if (!exec.agent || exec.agent.session !== session || session.header.origin === 'subagent'
        || Number(exec.agent.options?.subagentDepth) > 0)
        fail('附件不属于当前主会话');
    if (context.sessionId !== session.id || !Number.isSafeInteger(context.inheritedEventCount)
        || context.inheritedEventCount < 0 || !Number.isSafeInteger(context.turn) || context.turn < 1
        || context.call?.id !== exec.callId || !exec.callId || context.call.name !== 'rp_card_import_begin'
        || context.call.turn !== context.turn || !Array.isArray(context.messages) || context.messages.length > 2048)
        fail('当前导入调用未证实');
    const intent = nativeMessage(context.intent, context.inheritedEventCount);
    if (context.intent.turn !== context.turn)
        fail('导入意图不属于当前工具回合');
    if (!intent.content.some(block => object(block).type === 'text' && typeof object(block).text === 'string'
        && String(object(block).text).trim()))
        fail('上传本身不授权导入，请明确告诉我是否导入');
    const ordered = context.messages.map(row => {
        if (seq(row.seq) < context.inheritedEventCount)
            fail('可见候选包含继承消息');
        return { row, content: object(row.currentMessage).content };
    });
    if (new Set(ordered.map(item => item.row.seq)).size !== ordered.length)
        fail('可见消息身份不唯一');
    const latest = ordered.toSorted((a, b) => b.row.seq - a.row.seq)[0];
    if (!latest || recordSha256(nativeMessage(latest.row, context.inheritedEventCount).identity)
        !== recordSha256(intent.identity))
        fail('当前导入请求已变化或不可见');
    const attachments = ordered.filter(item => item.row.seq <= intent.identity.seq
        && Array.isArray(item.content) && item.content.some(block => object(block).type === 'file' || object(block).type === 'image'))
        .toSorted((a, b) => b.row.seq - a.row.seq);
    if (!attachments.length)
        fail('当前会话没有可见原件，请上传角色卡');
    // "This card" stays bound to the latest attachment message, including an
    // ordinary image. An explicit natural filename can select an older owned,
    // visible original; duplicate occurrences remain ambiguous.
    const candidates = frozenSourceSeq !== undefined ? attachments.filter(item => item.row.seq === frozenSourceSeq)
        : selector.name === undefined ? attachments.slice(0, 1) : attachments;
    const files = candidates.flatMap(source => source.content.flatMap((block, index) => {
        const part = object(block);
        return part.type === 'file' ? [{ source, index, file: object(part.attachment) }] : [];
    }));
    const selected = selector.name === undefined ? files : files.filter(item => item.file.name === selector.name);
    if (selected.length !== 1)
        fail(selected.length ? '存在多个附件，请说明要导入的文件名' : '没有匹配的原件，不能读取图片预览');
    const sourceMessage = nativeMessage(selected[0].source.row, context.inheritedEventCount);
    const content = { schemaVersion: 1, channel: 'chat-attachment', sessionId: session.id,
        intent: intent.identity, source: sourceMessage.identity, attachmentIndex: selected[0].index, file: file(selected[0].file) };
    const bound = { ...content, requestId: requestIdentity(content) };
    return { ...bound, proofSha256: recordSha256(bound) };
}
/** No upload, semantic classification, persistence tree or background queue is owned here. */
export function createChatCardSources({ sources, readNativeContext, readNativeMessages }) {
    const current = (session, exec, expected) => {
        exec.signal?.throwIfAborted();
        // Select the same immutable source occurrence, never a path or a newer upload.
        let actual;
        try {
            actual = capture(session, exec, readNativeContext(session, exec), { name: expected.file.name }, expected.source.seq);
        }
        catch (cause) {
            throw new Error('聊天角色卡：原导入请求或附件已隐藏、编辑或失效', { cause });
        }
        if (recordSha256(actual) !== recordSha256(expected))
            fail('导入请求或附件消息已变化');
    };
    function assertCurrent(session, requestId) {
        const proof = sources.readChatProof(session, requestId);
        if (!proof)
            fail('缺少原聊天附件准入身份');
        const view = readNativeMessages(session);
        if (view.sessionId !== session.id || proof.sessionId !== session.id
            || !Number.isSafeInteger(view.inheritedEventCount) || view.inheritedEventCount < 0
            || !Array.isArray(view.messages) || view.messages.length > 2048)
            fail('当前消息观察未证实');
        // Later user turns/uploads must not replace the durable intent or source.
        for (const identity of [proof.intent, proof.source]) {
            const matches = view.messages.filter(row => row.seq === identity.seq);
            if (matches.length !== 1 || recordSha256(nativeMessage(matches[0], view.inheritedEventCount).identity)
                !== recordSha256(identity))
                fail('原导入请求或附件已隐藏、编辑或失效');
        }
        const source = nativeMessage(view.messages.find(row => row.seq === proof.source.seq), view.inheritedEventCount);
        const selected = object(source.content[proof.attachmentIndex]);
        if (selected.type !== 'file' || recordSha256(file(selected.attachment)) !== recordSha256(proof.file))
            fail('原件引用已变化');
    }
    async function resolve(session, exec, selected) {
        const proof = capture(session, exec, readNativeContext(session, exec), chatCardSelector(selected));
        const result = await sources.materializeChat(session, exec.agent, proof, () => current(session, exec, proof));
        current(session, exec, proof);
        return { ...result, requestId: proof.requestId, cardImport: chatCardProjection(proof) };
    }
    return { resolve, assertCurrent };
}
