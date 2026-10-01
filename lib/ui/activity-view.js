// Generated from runtime/alpha3/src/ui/activity-view.ts; edit the TypeScript source.
import { fetchRoleplayText, startActivityPolling } from './panel-state.js';
import { readerMessageId } from './reader-model.js';
export const ACTIVITY_CSS = `
.rp-activity{display:flex;align-items:center;gap:12px;margin:20px auto;padding:14px 18px;max-width:var(--dsh-chat-content-width,900px);box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#333);font:inherit;box-shadow:var(--dsw-shadow-lv1,0 2px 8px #00000006)}
.rp-activity strong{font-weight:500}.rp-activity small{display:block;font-size:12px;color:var(--dsw-alias-label-caption,#888);margin-top:4px}.rp-activity time{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-caption,#888)}.rp-activity-whale{font-size:24px;animation:rp-whale-breathe 2.4s ease-in-out infinite}
.rp-pending-player{width:fit-content;max-width:85%;margin:16px 0 16px auto;padding:12px 18px;border-radius:14px;background:var(--dsw-alias-interactive-bg-hover-solid,#efede8);color:var(--dsw-alias-label-primary,#333);white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.rp-pending-player small{display:block;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-caption,#888)}
@keyframes rp-whale-breathe{50%{transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.rp-activity-whale{animation:none}}
`;
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const readCollectionValue = (value, key) => {
    if (!isRecord(value) || typeof value.get !== 'function')
        return undefined;
    return value.get(key);
};
const activityOf = (value) => isRecord(value) ? value : null;
export function tavernActivityPresentation(activity, now = Date.now()) {
    if (!activity || (!activity.running && activity.stage !== 'paused'))
        return null;
    const phrases = {
        prepare: ['导演正在赶来的路上…', '场景组正在摆放道具…'],
        story: ['小鲸鱼正在疯狂码字…', '下一幕正在冒出墨香…', '故事的小引擎正在开足马力…'],
        memory: ['导演正抱着笔记赶来…', '正在把伏笔收进小抽屉…'],
        status: ['场记正在清点背包…', '正在核对这一幕的变化…'],
        decision: ['岔路口的路牌正在立起来…', '正在寻找下一步的灵感…'],
        management: ['幕后小组正在收尾…', '故事档案正在归位…'],
        paused: ['幕后工作已暂停，可在日志中查看原因'],
    };
    const labels = {
        prepare: '准备场景', story: '正文生成', memory: '记忆更新', status: '状态栏更新',
        decision: '决策建议', management: '后台整理', paused: '已暂停',
    };
    const elapsed = Math.max(0, Number(activity.elapsedMs) || 0) +
        (activity.running ? Math.max(0, now - (Number(activity.observedAt) || now)) : 0);
    const stage = String(activity.stage ?? '');
    const choices = phrases[stage] ?? phrases.management ?? [];
    const label = labels[stage] ?? labels.management ?? '';
    return { label, text: choices[Math.floor(elapsed / 8000) % choices.length] ?? '', seconds: Math.floor(elapsed / 1000) };
}
const backgroundJobsOf = (activity) => Array.isArray(activity.backgroundJobs)
    ? activity.backgroundJobs.filter(isRecord).map(job => job)
    : [];
export function backgroundNotesPresentation(activity, sessionId, now = Date.now()) {
    if (!sessionId || activity?.sessionId !== sessionId)
        return null;
    const jobs = backgroundJobsOf(activity).filter(job => job.kind === 'memory' && ['queued', 'running'].some(status => status === job.status));
    if (!jobs.length)
        return null;
    const startedAt = Math.min(...jobs.map(job => Number(job.createdAt)).filter(time => Number.isFinite(time) && time > 0));
    const stale = now - Number(activity.observedAt ?? 0) > 15000;
    const running = jobs.some(job => job.status === 'running');
    return {
        label: stale ? '正在重新确认后台进度' : running ? '导演正在整理笔记' : '导演笔记已进入后台队列',
        detail: '可继续阅读和发送 · 故事不会在这里停下',
        seconds: Number.isFinite(startedAt) ? Math.max(0, Math.floor(((stale ? Number(activity.observedAt) : now) - startedAt) / 1000)) : null,
        stale,
        running,
    };
}
export const BACKGROUND_NOTES_CSS = `
.rp-background-notes{position:fixed;z-index:700;top:calc(70px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 18px 13px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#24334a) 14%,transparent);border-radius:16px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fffdf8) 95%,transparent);color:var(--dsw-alias-label-primary,#24334a);box-shadow:0 8px 28px #152b481c,0 1px 4px #152b4808;backdrop-filter:blur(14px);pointer-events:none;font:inherit;overflow:hidden}
.rp-background-notes::after{content:'';position:absolute;bottom:0;left:0;width:38%;height:2px;background:linear-gradient(90deg,transparent,#5cc4d0,#3977d6,transparent);animation:rp-notes-ink 3s ease-in-out infinite}
.rp-background-notes[data-stale=true]::after{animation:none;opacity:.35}
.rp-background-notes-icon{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:#428baf;background:color-mix(in srgb,#58b7c9 12%,transparent)}
.rp-background-notes strong{display:block;font-size:13px;line-height:1.6;font-weight:600;letter-spacing:.03em}
.rp-background-notes small{display:block;font-size:11px;line-height:1.7;color:var(--dsw-alias-label-caption,#778293)}
.rp-background-notes time{margin-left:12px;padding-left:14px;border-left:1px solid color-mix(in srgb,currentColor 12%,transparent);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-caption,#778293)}
@keyframes rp-notes-ink{0%,100%{transform:translateX(-100%)}65%{transform:translateX(280%)}}
@media(max-width:540px){.rp-background-notes{top:calc(62px + env(safe-area-inset-top,0px));gap:9px;padding:9px 12px 10px 9px;border-radius:13px}.rp-background-notes time{margin-left:0;padding-left:9px}.rp-background-notes small{font-size:10px}}
@media(prefers-reduced-motion:reduce){.rp-background-notes::after{animation:none;width:100%;opacity:.5}}
`;
export function createActivityComponents({ React, isRoleplaySession, peekState }) {
    const useTavernActivity = (sessionId, seed = null) => {
        const [activity, setActivity] = React.useState(null);
        const [running, setRunning] = React.useState(false);
        React.useEffect(() => { setActivity(null); setRunning(false); }, [sessionId]);
        React.useEffect(() => {
            if (!sessionId)
                return;
            return startActivityPolling({
                eligible: () => isRoleplaySession(sessionId),
                read: async () => {
                    const { response, raw } = await fetchRoleplayText('/api/roleplay/activity?sessionId=' + encodeURIComponent(sessionId), 5000);
                    const data = JSON.parse(raw);
                    return response.ok && isRecord(data) && data.sessionId === sessionId && data.schemaVersion === 1 ? data : null;
                },
                receive: data => { setRunning(!!(data && data.running)); if (data)
                    setActivity(data); },
                // A conversation that is not generating gains nothing from a fast poll,
                // and every attempt is a full round trip that competes with the reader.
                schedule: fn => setInterval(fn, running ? 3000 : 30000),
            });
        }, [sessionId, running]);
        return activity?.sessionId === sessionId ? activity : seed?.sessionId === sessionId ? seed : null;
    };
    const ActivityBanner = ({ activity }) => {
        const [now, setNow] = React.useState(Date.now());
        React.useEffect(() => {
            if (!activity?.running)
                return;
            const timer = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(timer);
        }, [activity?.running]);
        const value = tavernActivityPresentation(activity, now);
        return value ? React.createElement('div', { className: 'rp-activity', role: 'status', 'aria-live': 'polite' }, React.createElement('span', { className: 'rp-activity-whale', 'aria-hidden': true }, '🐋'), React.createElement('span', null, React.createElement('strong', null, value.text), React.createElement('small', null, value.label)), React.createElement('time', { 'aria-hidden': true }, `${value.seconds}s`)) : null;
    };
    const BackgroundNotesBanner = ({ activity, sessionId }) => {
        const [now, setNow] = React.useState(Date.now());
        const active = Boolean(backgroundNotesPresentation(activity, sessionId));
        React.useEffect(() => {
            if (!active)
                return;
            setNow(Date.now());
            const timer = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(timer);
        }, [active, sessionId]);
        const value = backgroundNotesPresentation(activity, sessionId, now);
        if (!value)
            return null;
        return React.createElement(React.Fragment, null, React.createElement('style', null, BACKGROUND_NOTES_CSS), React.createElement('aside', { className: 'rp-background-notes', 'data-stale': value.stale, 'data-session-id': sessionId, role: 'status', 'aria-live': 'polite' }, React.createElement('span', { className: 'rp-background-notes-icon', 'aria-hidden': true }, React.createElement('svg', { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M8 8h3M8 12h2M8 16h7m0-8 5-5 2 2-5 5-3 1z' }))), React.createElement('span', null, React.createElement('strong', null, value.label), React.createElement('small', null, value.detail)), value.seconds !== null ? React.createElement('time', { 'aria-hidden': true }, `${value.seconds}s`) : null));
    };
    const pendingPlayerBubble = (activity, nodes = [], hasNativePending = false) => {
        const pending = activityOf(activity)?.pendingPlayer;
        const pendingRecord = isRecord(pending) ? pending : null;
        if (!pendingRecord || hasNativePending || nodes.some(node => node.kind === 'user' && readerMessageId(node) === pendingRecord.messageId))
            return null;
        return React.createElement('div', { className: 'rp-pending-player', 'data-roleplay-pending-player': pendingRecord.messageId }, React.createElement('div', null, pendingRecord.text || '已发送附件'), React.createElement('small', null, activity?.stage === 'paused' ? '消息已保留 · 等待继续' : '已发送 · 正在准备场景'));
    };
    function DeferredPlayerInput(props) {
        const activity = useTavernActivity(props.sessionId, peekState(props.sessionId)?.activity);
        const useChat = typeof props.useChat === 'function' ? props.useChat : (() => null);
        const chat = useChat(state => state);
        const nodes = chat?.nodes && Array.isArray(chat.order) && isRecord(chat.nodes)
            ? chat.order.map(key => readCollectionValue(chat.nodes, key)).filter(isRecord)
            : [];
        return React.createElement(React.Fragment, null, React.createElement('style', null, ACTIVITY_CSS), pendingPlayerBubble(activity, nodes, props.hasNativePending));
    }
    return { useTavernActivity, ActivityBanner, BackgroundNotesBanner, pendingPlayerBubble, DeferredPlayerInput };
}
