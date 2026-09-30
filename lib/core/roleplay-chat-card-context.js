// Generated from runtime/alpha3/src/core/roleplay-chat-card-context.ts; edit the TypeScript source.
import { eventsOf } from './roleplay-context.js';
function fail(reason) { throw new Error(`聊天角色卡：${reason}`); }
const integer = (value) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
/** This adapter reads the retained native Session, rather than accepting
 * attachment IDs, paths or asserted ownership from a tool's arguments. */
export function createChatCardNativeContext(deps) {
    function readNativeMessages(session) {
        if (deps.session(session.id) !== session)
            fail('当前原生会话观察不可用');
        const events = eventsOf(session), boundary = session.inheritedEventCount;
        if (!integer(boundary) || boundary > events.length || events.some((event, index) => event.seq !== index)
            || !session.surface?.nodes || typeof session.deriveEventMessage !== 'function')
            fail('原生消息投影尚未就绪');
        const visible = new Set(session.surface.nodes), deleted = new Set(deps.deletedMessageIds(session));
        const messages = [];
        let turn = null;
        for (const event of events) {
            if (event.type === 'turn/start')
                turn = integer(event.data?.turn) && event.data.turn > 0 ? event.data.turn : null;
            if (event.seq < boundary || event.type !== 'user/message' || !visible.has(event.seq)
                || event.data?.source?.kind !== 'user' || deleted.has(String(event.data.id ?? '')))
                continue;
            if (turn === null)
                fail('玩家附件没有原生回合身份');
            const currentMessage = session.deriveEventMessage(event);
            if (!currentMessage)
                fail('玩家消息的当前投影不可用');
            messages.push({ seq: event.seq, turn, originalMessage: event.data, currentMessage });
        }
        if (messages.length > 2048)
            fail('当前可见消息过多，请缩小会话后再导入');
        return { sessionId: session.id, inheritedEventCount: boundary, messages };
    }
    function readNativeContext(session, exec) {
        if (!exec.agent || exec.agent.session !== session || deps.ownedAgent(exec.agent) !== exec.agent)
            fail('当前主代理身份不可用');
        exec.signal?.throwIfAborted();
        const view = readNativeMessages(session), events = eventsOf(session);
        const start = events.findLast(event => event.type === 'turn/start');
        const turn = start?.data?.turn;
        if (!start || !integer(turn) || turn < 1 || start.seq < view.inheritedEventCount
            || events.some(event => event.seq > start.seq && event.type === 'turn/end'))
            fail('导入调用没有正在执行的原生回合');
        const calls = events.filter(event => event.seq > start.seq && event.type === 'tool/call' && event.data?.callId === exec.callId);
        const call = calls[0];
        if (!exec.callId || calls.length !== 1 || !call || call.data?.name !== 'rp_card_import_begin'
            || call.data.turn !== turn || events.some(event => event.seq > call.seq && event.type === 'tool/result'
            && event.data?.callId === exec.callId))
            fail('当前原生导入工具调用未证实');
        const intent = view.messages.at(-1);
        if (!intent || intent.turn !== turn || intent.seq >= call.seq)
            fail('当前导入指令不属于这个工具回合');
        return { ...view, turn, call: { id: exec.callId, turn, name: 'rp_card_import_begin' }, intent };
    }
    return { readNativeMessages, readNativeContext };
}
