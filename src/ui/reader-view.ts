import { createReaderBeautyCache } from './reader-beauty.js';
import { AUTHOR_FRAME_MAX_ROWS, createAuthorFrame, type AuthorFrameLayout, type AuthorFramePart } from './author-runtime.js';
export { createAuthorRuntime } from './author-runtime.js';
import type * as ReactAPI from 'react';
import type { createMessageActionComponents } from './message-actions.js';
import type { StateReply } from './state-store.js';
import type { ActivityState, ActivityComponents } from './activity-view.js';
import { normalizeConversationNodes, readerNodeSeq, readerMessageId, readerText, readerTime, usageTokens, formatReaderTime } from './reader-model.js';
import { scopeReaderCss, READER_BASE_CSS } from './reader-rendering.js';


import type { ReaderRule } from './reader-regex.js';


interface ReaderNode extends Record<string, unknown> {
    kind?: string;visibility?: string;
    data?: {status?: string;turn?: number;step?: number;blocks?: {kind?: string;text?: string;}[];usage?: unknown;tokenUsage?: unknown;tokensPerSecond?: number;closing?: {finalNode?: {messageId?: string;};};};
    location?: {turn?: {start?: {time?: number;};end?: {time?: number;};};};
}
interface TurnMeta {usage: unknown;runMs: number | null;tokensPerSecond: number;}
interface ReaderPart {kind: 'user' | 'narrator';text: string;time: number;seq?: number;messageId?: string;failedTurn?: number;usage?: unknown;turnMeta?: TurnMeta | null;transient?: boolean;streamKey?: string;}
interface HistoryAnchor {
    sessionId: string | null;key: string | null;top: number;headKey: string | null | undefined;count: number;
    resetIfMissing?: boolean;
}
interface ReaderState extends StateReply {
    activity?: ActivityState;
    rules?: {beauty?: {regexRules?: ReaderRule[];css?: string;js?: string;};};
    surfaceNodes?: {seq?: number;}[];
    failedTurnRecoveryByTurn?: Record<string, unknown>;
}
interface ChatSnapshot {order?: string[];nodes?: {get(key: string): ReaderNode | undefined;};}
interface ReaderSessionSnapshot {loadingOlder?: boolean;hasMore?: boolean;}
interface ReaderViewProps {
    sessionId?: string;scope?: {sessionId?: string;};
    useChat?(selector: (value: ChatSnapshot) => ChatSnapshot): ChatSnapshot;
    useConversation?(selector: (value: unknown) => unknown): unknown;
    useSession?(selector: (value: ReaderSessionSnapshot) => ReaderSessionSnapshot): ReaderSessionSnapshot;
    snapshot?: unknown;conversation?: unknown;
    loadOlder?(): unknown | PromiseLike<unknown>;
}
type MessageComponents = ReturnType<typeof createMessageActionComponents>;
interface ReaderDependencies extends Pick<MessageComponents, 'UserActions' | 'AssistantActions' | 'actionIconButton' | 'ICONS'> {
    React: typeof ReactAPI;
    resolveActiveSessionId(): string | null;
    isRoleplaySession(id: string): boolean;
    useTavernActivity: ActivityComponents['useTavernActivity'];
    fetchState(id: string, force?: boolean): Promise<ReaderState>;
    subscribeState(id: string, listener: () => void): () => void;
    sessionsService: {using<T>(id: string, options: {source: 'nexttavernReader'}, operation: (reference: {binding: {session: {loadOlder(): Promise<void>}}}) => T | Promise<T>): Promise<T>};
    toast(text: string): void;
    pendingPlayerBubble: ActivityComponents['pendingPlayerBubble'];
    ActivityBanner: ActivityComponents['ActivityBanner'];
    ACTIVITY_CSS: string;
}

export function createReaderView({
React,
     resolveActiveSessionId,
     isRoleplaySession,
     useTavernActivity,
     fetchState,
     subscribeState,
     sessionsService,
     toast,
     UserActions,
     AssistantActions,
     actionIconButton,
     ICONS,
     pendingPlayerBubble,
     ActivityBanner,
     ACTIVITY_CSS
}: ReaderDependencies) {
    const noopSnapshotHook = () => null;
    function ReaderView(props: ReaderViewProps) {
        // Scoped provider identity is authoritative, including a secondary view.
        const sessionId = props.sessionId ?? props.scope?.sessionId ?? null;
        React.useEffect(
        () => {
            const restore = () => window.dispatchEvent(new Event('dsh-roleplay-view-activated'));
            restore();
            return () => { restore(); };
        },
            [sessionId]
        );
        const [state, setState] = React.useState<ReaderState | null>(null);
        const [loadError, setLoadError] = React.useState<string | null>(null);
        const [readerStart, setReaderStart] = React.useState<number | null>(null);
        const [loadingOlder, setLoadingOlder] = React.useState(false);
        const [historyError, setHistoryError] = React.useState<string | null>(null);
        const activity = useTavernActivity(sessionId, state?.activity);
        const [, refreshBeauty] = React.useState(0);
        const beautyCacheRef = React.useRef<ReturnType<typeof createReaderBeautyCache> | null>(null);
        beautyCacheRef.current ??= createReaderBeautyCache();
        const historyRequestRef = React.useRef<object | null>(null);
        const historyAnchorRef = React.useRef<HistoryAnchor | null>(null);
        const readerSessionRef = React.useRef(sessionId);
        const stateRequestRef = React.useRef(0);
        const frameRef = React.useRef<HTMLIFrameElement>(null);
        const frameControllerRef = React.useRef<ReturnType<typeof createAuthorFrame> | null>(null);
        const frameIdentityRef = React.useRef('');
        const [frameEpoch, setFrameEpoch] = React.useState(0);
        const [frameLayout, setFrameLayout] = React.useState<{identity: string;value: AuthorFrameLayout;} | null>(null);
        const [frameFailure, setFrameFailure] = React.useState<{identity: string;reason: string;} | null>(null);
        const streamLeaseRef = React.useRef<{sessionId: string;turn: number;step: number;} | null>(null);
        readerSessionRef.current = sessionId;
        if (streamLeaseRef.current?.sessionId !== sessionId) streamLeaseRef.current = null;
        React.useEffect(
        () => {
            setState(null);
            setLoadError(null);
            setReaderStart(null);
            setLoadingOlder(false);
            setHistoryError(null);
            historyRequestRef.current = null;
            historyAnchorRef.current = null;
            if (!sessionId) return;
            if (!isRoleplaySession(sessionId)) return;
            let alive = true;
            const requestedSessionId = sessionId;
            const load = (evenWhenHidden = false) => {
                if (!evenWhenHidden && typeof document !== 'undefined' && document.hidden) return;
                const request = ++stateRequestRef.current;
                fetchState(requestedSessionId, true).then((d) => {
                    if (!alive || request !== stateRequestRef.current) return;
                    if (d?.sessionId && d.sessionId !== requestedSessionId) return;
                    setLoadError(d?.ok === false ? String(d.error ?? '角色扮演状态不可用') : null);
                    setState(d);
                }).catch(error => {
                    if (!alive || request !== stateRequestRef.current) return;
                    const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
                    setLoadError(String(message));
                });
            };
            load();
            const timer = setInterval(load, 30000);
            const unsubscribe = subscribeState(requestedSessionId, () => {
                // Invalidation may select a new worldline without changing the view's
                // sessionId. Revoke old author capabilities before fetching new state.
                frameControllerRef.current?.dispose();
                frameControllerRef.current = null;
                setFrameEpoch(value => value + 1);
                setState(null);
                load(true);
            });
            return () => { alive = false; stateRequestRef.current++; clearInterval(timer); unsubscribe(); };
        },
            [sessionId]
        );
        React.useEffect(
        () => {
            if (!sessionId || !activity) return;
            let alive = true;
            const request = ++stateRequestRef.current;
            fetchState(sessionId, true).then(data => {
                if (!alive || request !== stateRequestRef.current || data?.sessionId !== sessionId) return;
                setState(data);
                setLoadError(null);
            }).catch(() => { });
            return () => { alive = false; };
        },
            [sessionId, activity?.storySeq, activity?.stage]
        );
        // useChat activates and subscribes the authoritative chat target. A
        // conversation view can otherwise open with no chat snapshot after refresh.
        const useChat = typeof props.useChat === 'function' ? props.useChat : noopSnapshotHook;
        const chat = useChat((value) => value);
        const useConv = typeof props.useConversation === 'function' ? props.useConversation : noopSnapshotHook;
        const snapshot = useConv((value) => value) ?? props.snapshot ?? props.conversation ?? null;
        const readerRef = React.useRef<HTMLDivElement>(null);
        const scrollRef = React.useRef<HTMLDivElement>(null);
        const useSession = props.useSession ?? noopSnapshotHook;
        const historySnapshot = useSession(value => value);
        // Paging can outlive a view switch, so retain its exact Session through
        // the native pager's completion. Rendering belongs to the slot owner.
        const loadOlder = sessionId ? () => sessionsService.using(sessionId,
            {source: 'nexttavernReader'}, reference => reference.binding.session.loadOlder()) : null;

        const fillComposer = (text: string, allowClipboard = true) => {
            if (!sessionId || resolveActiveSessionId() !== sessionId) {
                toast('请先切换到此对话，再填入输入框');
                return;
            }
            const editor = document.querySelector<HTMLElement>('[data-composer-input]');
            if (editor) {
                try {
                    editor.focus();
                    const sel = window.getSelection();
                    if (sel && typeof sel.removeAllRanges === 'function') {
                        sel.removeAllRanges();
                        const range = document.createRange();
                        range.selectNodeContents(editor);
                        range.collapse(false);
                        sel.addRange(range);
                    }
                    if (document.execCommand('insertText', false, text)) {
                        toast('已填入输入框');
                        return;
                    }
                } catch { }
            }
            if (allowClipboard && navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => toast('输入框不可达，已复制到剪贴板')).catch(() => { });
            }
        };

        const beauty = state?.rules?.beauty ?? null;
        const rules = Array.isArray(beauty?.regexRules) ? beauty.regexRules : [];
        const authorCss = String(beauty?.css ?? '');
        const authorJs = String(beauty?.js ?? '');
        const authorWindow = !!authorJs.trim();

        // Collect only the authoritative surface of this Session.  The Chat
        // target may retain audit/shadow nodes after a replacement, and sibling
        // Sessions may be resident in the client cache; neither belongs in the
        // selected branch's reader or memory view.
        const parts: ReaderPart[] = [];
        const nodes: ReaderNode[] = Array.isArray(chat?.order) && chat?.nodes && typeof chat.nodes.get === 'function'
            ? chat.order.map((key) => chat.nodes!.get(key)).filter((node): node is ReaderNode => !!node && node.visibility !== 'hidden')
            : (normalizeConversationNodes(snapshot) as ReaderNode[]).filter((node) => node && node.visibility !== 'hidden');
        const surfaceSeqs = new Set((state?.surfaceNodes ?? []).map((entry) => Number(entry?.seq)).filter(Number.isSafeInteger));
        const turnMetaByMessageId = new Map<string, TurnMeta>();
        for (const node of nodes) {
            if (node?.kind !== 'turn-tail') continue;
            const messageId = String(node.data?.closing?.finalNode?.messageId ?? '');
            if (!messageId) continue;
            const startTime = Number(node.location?.turn?.start?.time);
            const endTime = Number(node.location?.turn?.end?.time);
            turnMetaByMessageId.set(
            messageId,
                {
                    usage: node.data?.tokenUsage,

                    runMs: Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, endTime - startTime) : null,

                    tokensPerSecond: Number(node.data?.tokensPerSecond),
                }
            );
        }
        const selectedNodeSeqs = new Set();
        const selectedNodes = nodes.filter((node) => {
            const kind = String(node?.kind ?? '');
            if (!['user', 'assistant-step', 'assistant', 'narrator'].includes(kind)) return false;
            // A multi-step turn can project several assistant-step nodes whose
            // finalNode points at the same closing assistant message. Reader is a
            // prose surface, so keep only settled/final material and dedupe by the
            // server-authoritative surface sequence.
            if (kind === 'assistant-step' && node?.data?.status && node.data.status !== 'settled') return false;
            const seq = readerNodeSeq(node);
            if (seq === null || !surfaceSeqs.has(seq) || selectedNodeSeqs.has(seq)) return false;
            selectedNodeSeqs.add(seq);
            return true;
        });
        const windowStart = readerStart === null
            ? Math.max(0, selectedNodes.length - 500)
            : Math.min(Math.max(0, readerStart), Math.max(0, selectedNodes.length - 1));
        const authorHistoryPage = authorWindow && windowStart < Math.max(0, selectedNodes.length - 500);
        const readerNodes = selectedNodes.slice(windowStart);
        const settledStoryKeys = new Set(readerNodes
            .filter((node) => node?.kind === 'assistant-step' && node?.data?.status === 'settled')
            .map((node) => `${node.data?.turn ?? ''}:${node.data?.step ?? ''}`));
        const failedTurnByUserSeq = new Map<number, number>();
        if (!(activity?.sessionId === sessionId && activity.running === true)) {
            for (const [turnKey, recoverySeq] of Object.entries(state?.failedTurnRecoveryByTurn ?? {})) {
                const turn = Number(turnKey);
                if (!Number.isSafeInteger(turn) || turn < 0 || typeof recoverySeq !== 'number'
                    || !Number.isSafeInteger(recoverySeq)
                    || recoverySeq < 0) continue;
                failedTurnByUserSeq.set(recoverySeq, turn);
            }
        }
        for (const node of readerNodes) {
            if (!node || typeof node !== 'object') continue;
            const text = readerText(node);
            if (!text) continue;
            const seq = readerNodeSeq(node)!;
            const messageId = readerMessageId(node);
            if (node.kind === 'user') {
                parts.push({ kind: 'user', text, seq, time: readerTime(node), failedTurn: failedTurnByUserSeq.get(seq) });
            } else if (node.kind === 'assistant-step' || node.kind === 'assistant' || node.kind === 'narrator') {
                parts.push({
                    kind: 'narrator',
                    text,
                    seq,
                    messageId,
                    time: readerTime(node),

                    usage: node.data?.usage,
                    turnMeta: turnMetaByMessageId.get(messageId) ?? null,
                });
            }
        }
        // A running story step is a transient reader-only projection.  It must
        // come from the exact text block and the current activity coordinates;
        // it has no Session seq/message identity and therefore cannot acquire
        // history or branch actions.
        if (streamLeaseRef.current
            && (streamLeaseRef.current.sessionId !== sessionId

                || (activity?.sessionId === sessionId && Number.isSafeInteger(activity.turn)
                    && activity.turn !== streamLeaseRef.current.turn))) streamLeaseRef.current = null;
        if (sessionId && activity?.sessionId === sessionId && activity.running && activity.stage === 'story'

            && typeof activity.turn === 'number'
            && Number.isSafeInteger(activity.turn)
            && typeof activity.storyStep === 'number'
            && Number.isSafeInteger(activity.storyStep)) {
            streamLeaseRef.current = { sessionId, turn: activity.turn!, step: activity.storyStep! };
        }
        const streamLease = streamLeaseRef.current;
        if (streamLease?.sessionId === sessionId && !authorHistoryPage) {
            const streamTurn = streamLease.turn;
            const streamStep = streamLease.step;
            const streamKey = `${streamTurn}:${streamStep}`;
            if (settledStoryKeys.has(streamKey)) streamLeaseRef.current = null;
            if (!settledStoryKeys.has(streamKey)) {
                const candidates = [];
                for (const node of nodes) {
                    if (node?.kind !== 'assistant-step' || !['running', 'settled'].some(status => status === node?.data?.status)) continue;
                    if (node.data?.turn !== streamTurn || node.data?.step !== streamStep) continue;
                    const blocks = node.data?.blocks;
                    const text = Array.isArray(blocks)
                        ? blocks.filter(block => block?.kind === 'text' && typeof block.text === 'string').map(block => block.text).filter(Boolean).join('\n')
                        : '';
                    if (text) candidates.push({ node, text });
                }
                const candidate = candidates.find(item => item.node.data?.status === 'settled') ?? candidates[0];
                if (candidate) {
                    parts.push({
                        kind: 'narrator',
                        text: candidate.text,
                        time: readerTime(candidate.node),
                        transient: true,
                        streamKey: `stream:${streamTurn}:${streamStep}`
                    });
                }
            }
        }

        // Author frames, native action rows and beauty work share one window.
        // A current stream owns one slot; older pages never mix in live prose.
        // Keep the complete collected suffix available for explicit navigation.
        const transientParts = parts.filter(part => part.transient);
        const committedParts = parts.filter(part => !part.transient);
        const visibleParts = authorWindow
            ? [...committedParts.slice(0, AUTHOR_FRAME_MAX_ROWS - transientParts.length), ...transientParts]
            : parts;

        const beautyScope = sessionId + '\0' + JSON.stringify(rules);
        const beautyCache = beautyCacheRef.current;
        beautyCache.selectScope(beautyScope);
        // Keep transient stream text out of regex work; it still gets immediate fallback rendering.
        const beautyTasks = visibleParts.filter(part => part.kind === 'narrator' && !part.transient).map(part => part.text);
        const beautyInput = JSON.stringify(beautyTasks);
        React.useEffect(
        () => beautyCache.run(beautyScope, beautyTasks, rules, () => refreshBeauty(n => n + 1)),

            [beautyScope, beautyInput]
        );
        const applyBeauty = beautyCache.htmlFor;
        const beautyFailed = beautyCache.failed(beautyTasks);
        const renderedParts = visibleParts.map((part) => ({
            ...part,
            html: part.kind === 'narrator' ? applyBeauty(part.text) : '',
        }));
        if (state !== null && selectedNodes.length === 0) {
            console.warn(
            '[roleplay-reader] selected surface empty',
                {
                    sessionId,

                    allNodeCount: nodes.length,

                    surfaceSeqs: [...surfaceSeqs].slice(-12),

                    snapshotType: typeof snapshot,

                    snapshotKeys: snapshot && typeof snapshot === 'object' ? Object.keys(snapshot).slice(0, 12) : null,
                }
            );
        }
        const docHtml = renderedParts.map((part) => part.kind === 'narrator' ? part.html : part.text).join('\n');
        const committedDocHtml = renderedParts.filter(part => !part.transient).map(part => part.kind === 'narrator' ? part.html : part.text).join('\n');
        const historyBusy = loadingOlder || historySnapshot?.loadingOlder === true;
        const canLoadOlder = windowStart > 0 || (!!loadOlder && historySnapshot?.hasMore === true);
        const canLoadNewer = authorWindow && visibleParts.length < parts.length;
        const canLoadLatest = authorWindow && readerStart !== null;
        const readerPartKey = (part: ReaderPart) => part.transient
            ? part.streamKey ?? 'stream:unknown'
            : `${part.kind}:${part.seq ?? ''}:${part.messageId ?? ''}`;
        const renderedHeadKey = renderedParts.length ? readerPartKey(renderedParts[0]!) : null;
        const frameIdentity = JSON.stringify([
            frameEpoch, sessionId, state?.sessionId, state?.preset, authorJs, authorCss, committedDocHtml,
        ]);
        frameIdentityRef.current = frameIdentity;
        const framed = !!authorJs.trim() && frameFailure?.identity !== frameIdentity;
        const activeFrameLayout = frameLayout?.identity === frameIdentity ? frameLayout.value : null;
        const framePayload = JSON.stringify(renderedParts.map(part => ({
            key: readerPartKey(part), kind: part.kind, text: part.text, html: part.html,
        } satisfies AuthorFramePart)));
        React.useEffect(() => {
            if (!framed || !sessionId || state?.sessionId !== sessionId || state?.preset !== 'roleplay' || !frameRef.current) return;
            const identity = frameIdentity;
            const controller = createAuthorFrame(frameRef.current, {
                source: authorJs,
                css: authorCss,
                baseCss: READER_BASE_CSS,
                current: () => readerSessionRef.current === sessionId && frameIdentityRef.current === identity,
                fill: text => fillComposer(text, false),
                layout: value => setFrameLayout({identity, value}),
                failed: reason => setFrameFailure({identity, reason}),
            });
            frameControllerRef.current = controller;
            return () => {
                controller.dispose();
                if (frameControllerRef.current === controller) frameControllerRef.current = null;
            };
        }, [frameIdentity, framed, sessionId, state?.sessionId, state?.preset]);
        React.useEffect(() => {
            if (framed) frameControllerRef.current?.update(JSON.parse(framePayload) as AuthorFramePart[]);
        }, [frameIdentity, framePayload, framed]);
        // Native history prepends must not push the paragraph under the pointer
        // off-screen. Keep a DOM row anchor, not a scrollHeight approximation:
        // author HTML can change height after the response arrives.
        React.useLayoutEffect(
        () => {
            const held = historyAnchorRef.current;
            const scroller = scrollRef.current;
            if (!held || !scroller || held.sessionId !== sessionId) return;
            if (held.headKey === renderedHeadKey && held.count === renderedParts.length) return;
            if (framed && !activeFrameLayout) return;
            const row = Array.from(scroller.querySelectorAll('[data-reader-key]'))
                .find((element) => element.getAttribute('data-reader-key') === held.key);
            if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - held.top;
            else if (held.resetIfMissing) scroller.scrollTop = 0;
            historyAnchorRef.current = null;
        },
            [docHtml, renderedHeadKey, renderedParts.length, sessionId, activeFrameLayout]
        );

        const holdHistoryAnchor = (resetIfMissing = false) => {
            const scroller = scrollRef.current;
            const viewportTop = scroller?.getBoundingClientRect().top ?? 0;
            const anchor = scroller
                && Array.from(scroller.querySelectorAll('[data-reader-key]'))
                    .find((element) => element.getBoundingClientRect().bottom > viewportTop + 1);
            historyAnchorRef.current = anchor ? {
                sessionId,
                key: anchor.getAttribute('data-reader-key'),

                top: anchor.getBoundingClientRect().top - viewportTop,

                headKey: renderedHeadKey,
                count: renderedParts.length,
                resetIfMissing,
            } : null;
        };
        const requestOlder = async () => {
            if (!canLoadOlder || historyBusy || historyRequestRef.current) return;
            const requestedSessionId = sessionId;
            const request = {};
            historyRequestRef.current = request;
            setHistoryError(null);
            holdHistoryAnchor(authorWindow);
            setLoadingOlder(true);
            try {
                if (windowStart > 0) {
                    setReaderStart(Math.max(0, windowStart - 500));
                } else {
                    // A zero local slice offset is not the server's end-of-history.
                    // Once paging starts keep the loaded branch window visible.
                    setReaderStart(0);
                    await loadOlder?.();
                }
            } catch (error) {
                if (readerSessionRef.current !== requestedSessionId) return;
                historyAnchorRef.current = null;
                setHistoryError(String(error && typeof error === 'object' && 'message' in error ? error.message : error));
            } finally {
                if (historyRequestRef.current === request) {
                    historyRequestRef.current = null;
                    setLoadingOlder(false);
                }
            }
        };
        const requestNewer = () => {
            if (!canLoadNewer || historyBusy || historyRequestRef.current) return;
            // Overlap the pages so an on-screen original-seq row can stay put.
            const next = visibleParts[Math.max(0, visibleParts.length - 100)];
            const nextStart = selectedNodes.findIndex(node => readerNodeSeq(node) === next?.seq);
            if (nextStart <= windowStart) return;
            holdHistoryAnchor(true);
            setHistoryError(null);
            setReaderStart(nextStart);
        };
        const requestLatest = () => {
            if (historyBusy || historyRequestRef.current) return;
            historyAnchorRef.current = null;
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setHistoryError(null);
            setReaderStart(null);
        };
        // Scope the two sheets independently, then append author CSS last so the
        // card can reliably override defaults even when its own CSS is malformed.
        // Cascade layer makes the built-in paper theme a true fallback: even a
        // low-specificity author selector such as `h2 { ... }` wins merely by
        // appearing as unlayered author CSS. Inline styles from the card remain
        // authoritative as usual.
        const scopedCss = '@layer dsh-roleplay-reader-default {\n' +
            scopeReaderCss(READER_BASE_CSS) + '\n}\n' + (framed ? '' : scopeReaderCss(authorCss)) + `
.rp-author-frame-host { position: relative; width: min(1500px, 100%); align-self: center; overflow: hidden; }
.rp-author-guard-frame { display: block; width: 100%; height: 150px; border: 0; }
.rp-author-action-layer { position: absolute; inset: 0; pointer-events: none; }
.rp-author-action-row { position: absolute; left: 0; right: 0; min-height: 32px;
  padding: 0 clamp(22px, 4.8vw, 72px); box-sizing: border-box; pointer-events: none; }
.rp-author-action-row .rp-reader-actions { pointer-events: auto; }
`;

        // Keep every hook above all exits; otherwise switching between loading,
        // non-roleplay and roleplay states changes the hook count and crashes React.
        if (!sessionId) return null;
        if (state === null) {
            return React.createElement(
            'div',
                { className: 'rp-reader-view' },

                React.createElement('div', { className: 'rp-reader-empty' }, '正在加载阅读视图…')
            );
        }
        if (state.sessionId !== sessionId || state.preset !== 'roleplay') {
            return React.createElement(
            'div',
                { className: 'rp-reader-view' },

                React.createElement('div', { className: 'rp-reader-empty' }, '「阅读」视图仅在角色扮演会话中可用')
            );
        }

        const copyReaderText = async (text: string) => {
            try {
                await navigator.clipboard.writeText(String(text ?? ''));
                toast('已复制');
            } catch {toast('复制失败');}
        };
        const renderReaderActions = (part: ReaderPart) => {
            if (part.transient) return null;
            // Reader is a first-class long-lived view, not a passive transcript.
            // Instantiate the roleplay controls directly: some alpha.3 view hosts
            // return an empty-but-non-null slot fragment, which used to suppress the
            // fallback and leave Reader without edit/regenerate/branch controls.
            const extensionActions = part.kind === 'user'
                ? Number.isSafeInteger(part.failedTurn)
                    ? React.createElement(
                    AssistantActions,
                        { sessionId, messageId: undefined, turn: part.failedTurn, text: part.text }
                    )
                    : React.createElement(UserActions, { sessionId, seq: part.seq, text: part.text })
                : React.createElement(AssistantActions, { sessionId, messageId: part.messageId, text: part.text });
            const usage = usageTokens(part.turnMeta?.usage ?? part.usage);
            const meta = [
                usage !== null ? `用量 ${usage.toLocaleString()} tok` : '',

                Number.isFinite(part.turnMeta?.runMs) ? `用时 ${(part.turnMeta!.runMs! / 1000).toFixed(1)} 秒` : '',

                Number.isFinite(part.turnMeta?.tokensPerSecond) ? `${part.turnMeta!.tokensPerSecond.toFixed(1)} tok/s` : '',

                formatReaderTime(part.time),
            ].filter(Boolean).join(' · ');
            return React.createElement(
            'div',
                { className: 'rp-reader-actions' },

                actionIconButton('复制', ICONS.copy, () => copyReaderText(part.text)),

                extensionActions,

                meta ? React.createElement('span', { className: 'rp-reader-meta' }, meta) : null

            );
        };

        return React.createElement(
        'div',
            {
                className: 'rp-reader-view',

                ref: scrollRef,

                onScroll: (event) => {
                    if (event.currentTarget.scrollTop < 140 && !historyError) void requestOlder();
                },

                onWheel: (event) => {
                    // At the very top a wheel gesture need not emit `scroll` at all.
                    if (event.deltaY < 0 && event.currentTarget.scrollTop < 140 && !historyError) void requestOlder();
                },
            },

            React.createElement('style', null, scopedCss + ACTIVITY_CSS),
            frameFailure?.identity === frameIdentity ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' },
                '隔离阅读视图不可用，已保留正文和原生操作；作者脚本未运行。' + frameFailure.reason) : null,

            beautyFailed ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '部分美化规则未能安全完成，已保留完整正文。修改规则后会重新匹配。') : null,

            canLoadOlder || historyBusy || historyError || canLoadNewer || canLoadLatest
                ? React.createElement(
                'div',
                    { className: 'rp-reader-history', role: 'status', 'aria-live': 'polite' },

                    canLoadOlder || historyBusy || historyError ? React.createElement(
                    'button',
                        { type: 'button', className: 'rp-reader-load-older', onClick: requestOlder, disabled: historyBusy },

                        historyBusy ? React.createElement('span', { className: 'rp-reader-spinner', 'aria-hidden': 'true' }) : null,

                        historyBusy ? '正在加载更早剧情…' : historyError ? '加载失败，点击重试' : '加载更早剧情'
                    ) : null,
                    canLoadNewer ? React.createElement('button', {
                        type: 'button', className: 'rp-reader-load-newer', onClick: requestNewer, disabled: historyBusy,
                    }, '查看较新剧情') : null,
                    canLoadLatest ? React.createElement('button', {
                        type: 'button', className: 'rp-reader-load-latest', onClick: requestLatest, disabled: historyBusy,
                    }, '回到最新剧情') : null,
                    authorWindow ? React.createElement('span', {className: 'rp-reader-page-info'},
                        `${authorHistoryPage ? '较早剧情' : '最新剧情'} · 本页 ${visibleParts.length} 段`) : null
                )
                : null,

            loadError ? React.createElement('div', { className: 'rp-reader-empty' }, '阅读器加载失败：' + loadError) : null,

            !loadError && state !== null && selectedNodes.length === 0
                ? React.createElement('div', { className: 'rp-reader-empty' }, '暂无可阅读的正文')
                : null,

            framed
                ? React.createElement('div', { className: 'rp-author-frame-host' },
                    React.createElement('iframe', {
                        className: 'rp-author-guard-frame', title: '隔离阅读内容', ref: frameRef,
                    }),
                    activeFrameLayout ? React.createElement('div', { className: 'rp-author-action-layer' },
                        renderedParts.map((part, index) => React.createElement('section', {
                            className: 'rp-reader-message rp-author-action-row',
                            'data-kind': part.kind === 'user' ? 'user' : 'assistant',
                            'data-reader-key': readerPartKey(part),
                            key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
                            style: {top: activeFrameLayout.rows[index] ?? 0},
                        }, renderReaderActions(part)))) : null)
                : React.createElement('div', {
                    className: 'rp-reader', ref: readerRef,
                    onClick: (event: ReactAPI.MouseEvent<HTMLDivElement>) => {
                        const f = event.target
                            && typeof (event.target as Element).closest === 'function' ? (event.target as Element).closest<HTMLElement>('.f') : null;
                        if (f) {
                            event.preventDefault();
                            event.stopPropagation();
                            fillComposer(f.innerText || f.textContent || '');
                        }
                    },
                }, renderedParts.map((part, index) => React.createElement('section', {
                    className: 'rp-reader-message',
                    'data-kind': part.kind === 'user' ? 'user' : 'assistant',
                    'data-reader-key': readerPartKey(part),
                    key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
                }, part.kind === 'user'
                    ? React.createElement('p', { className: 'rp-user-line' }, '◈ 你：' + part.text)
                    : React.createElement('div', { className: 'rp-reader-narrative', dangerouslySetInnerHTML: { __html: part.html } }),
                renderReaderActions(part)))),

            pendingPlayerBubble(activity, nodes),

            React.createElement(ActivityBanner, { activity })

        );
    }


    return ReaderView;
}
