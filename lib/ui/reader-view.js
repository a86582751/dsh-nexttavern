// Generated from runtime/alpha3/src/ui/reader-view.ts; edit the TypeScript source.
import { createReaderBeautyCache } from './reader-beauty.js';
import { AUTHOR_FRAME_MAX_ROWS, createAuthorFrame } from './author-runtime.js';
export { createAuthorRuntime } from './author-runtime.js';
import { normalizeConversationNodes, readerNodeSeq, readerMessageId, readerText, readerTime, usageTokens, formatReaderTime } from './reader-model.js';
import { scopeReaderCss, READER_BASE_CSS, renderReaderNarrative } from './reader-rendering.js';
import { createAuthorBrowserSession, createReaderRegexDocumentSession } from './author-browser-session.js';
import { createAuthorReaderSurface } from '../core/tavern-author-reader-surface.js';
import { mountStaticAuthorDocument } from './author-runtime.js';
import { createReaderCommunityCache, createCommunityOptionsRenderer, COMMUNITY_READER_CSS } from './reader-community.js';
import { COMMUNITY_READER_WINDOW_MESSAGES } from '../core/community-preset-types.js';
/** The UI alone owns the real editor. A guest receives only this narrow
 * capability; it cannot traverse Main DOM or dispatch a send action. */
export function createReaderComposerAccess(document, current) {
    const editor = () => {
        if (!current())
            throw Error('BROWSER_COMPOSER_SESSION_CHANGED');
        const value = document.querySelector('[data-composer-input]');
        if (!value)
            throw Error('BROWSER_COMPOSER_UNAVAILABLE');
        return value;
    };
    const text = (value) => value.innerText ?? value.textContent ?? '';
    return {
        read: () => text(editor()),
        replace(value, expectedText) {
            const target = editor();
            if (text(target) !== expectedText)
                throw Error('BROWSER_COMPOSER_CHANGED');
            target.focus();
            const selection = document.defaultView.getSelection();
            if (!selection)
                throw Error('BROWSER_COMPOSER_SELECTION_UNAVAILABLE');
            const range = document.createRange();
            range.selectNodeContents(target);
            selection.removeAllRanges();
            selection.addRange(range);
            if (!document.execCommand('insertText', false, value))
                throw Error('BROWSER_COMPOSER_REPLACE_FAILED');
        },
        dispatch: type => { editor().dispatchEvent(new document.defaultView.Event(type, { bubbles: true })); },
        focus: () => editor().focus(),
    };
}
export function createReaderView({ React, resolveActiveSessionId, isRoleplaySession, useTavernActivity, fetchState, jsonFetch, fetchReaderDisplay = async (sessionId, messages, signal) => {
    const response = await globalThis.fetch('/api/roleplay/state', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal,
        body: JSON.stringify({ action: 'reader-display', sessionId, messages }),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true)
        throw new Error(result.code ?? result.error
            ?? `Reader display HTTP ${response.status}`);
    return result;
}, subscribeState, sessionsService, toast, UserActions, AssistantActions, actionIconButton, ICONS, pendingPlayerBubble, ActivityBanner, ACTIVITY_CSS, images, readerHandoff }) {
    const noopSnapshotHook = () => null;
    const actionProps = (part, sessionId) => ({
        sessionId, kind: part.kind, text: part.text, time: part.time,
        seq: part.seq, messageId: part.messageId, turn: part.turn,
        failedTurn: part.failedTurn, transient: part.transient,
        tokens: usageTokens(part.turnMeta?.usage ?? part.usage),
        runMs: part.turnMeta?.runMs, tokensPerSecond: part.turnMeta?.tokensPerSecond,
    });
    const copyReaderText = async (text) => {
        try {
            await navigator.clipboard.writeText(String(text ?? ''));
            toast('已复制');
        }
        catch {
            toast('复制失败');
        }
    };
    const renderReaderActions = (part) => {
        if (part.transient)
            return null;
        const { sessionId } = part;
        // Reader is a first-class long-lived view. Instantiate controls directly:
        // an empty-but-non-null host slot must not suppress edit/branch actions.
        const extensionActions = part.kind === 'user'
            ? Number.isSafeInteger(part.failedTurn)
                ? React.createElement(AssistantActions, { sessionId, messageId: undefined, turn: part.failedTurn, text: part.text })
                : React.createElement(UserActions, { sessionId, seq: part.seq, text: part.text })
            : React.createElement(AssistantActions, {
                sessionId, messageId: part.messageId, turn: part.turn, text: part.text,
            });
        const meta = [
            part.tokens !== null ? `用量 ${part.tokens.toLocaleString()} tok` : '',
            Number.isFinite(part.runMs) ? `用时 ${(part.runMs / 1000).toFixed(1)} 秒` : '',
            Number.isFinite(part.tokensPerSecond) ? `${part.tokensPerSecond.toFixed(1)} tok/s` : '',
            formatReaderTime(part.time),
        ].filter(Boolean).join(' · ');
        return React.createElement('div', { className: 'rp-reader-actions' }, actionIconButton('复制', ICONS.copy, () => copyReaderText(part.text)), extensionActions, meta ? React.createElement('span', { className: 'rp-reader-meta' }, meta) : null);
    };
    // The parent reads live mutable nodes on every update. Only the exact scalar
    // presentation/action inputs are compared here, never a guessed history revision.
    const ReaderMessage = React.memo(function ReaderMessage(part) {
        return React.createElement('section', {
            className: 'rp-reader-message',
            'data-kind': part.kind === 'user' ? 'user' : 'assistant',
            'data-reader-key': part.readerKey,
        }, React.createElement('div', {
            className: part.kind === 'user' ? 'rp-user-line' : 'rp-reader-narrative',
            dangerouslySetInnerHTML: { __html: part.kind === 'user' ? '◈ 你：' + part.html : part.html },
        }), renderReaderActions(part));
    });
    function ReaderView(props) {
        // Scoped provider identity is authoritative, including a secondary view.
        const sessionId = props.sessionId ?? props.scope?.sessionId ?? null;
        React.useEffect(() => {
            const restore = () => window.dispatchEvent(new Event('dsh-roleplay-view-activated'));
            restore();
            return () => { restore(); };
        }, [sessionId]);
        const [state, setState] = React.useState(null);
        const [loadError, setLoadError] = React.useState(null);
        const [readerStart, setReaderStart] = React.useState(null);
        const [loadingOlder, setLoadingOlder] = React.useState(false);
        const [historyError, setHistoryError] = React.useState(null);
        const activity = useTavernActivity(sessionId, state?.activity);
        const [, refreshBeauty] = React.useState(0);
        const [communityReload, reloadCommunity] = React.useState(0);
        const beautyCacheRef = React.useRef(null);
        beautyCacheRef.current ??= createReaderBeautyCache();
        const communityCacheRef = React.useRef(null);
        if (jsonFetch)
            communityCacheRef.current ??= createReaderCommunityCache(jsonFetch);
        const communityOptionsRef = React.useRef(null);
        communityOptionsRef.current ??= createCommunityOptionsRenderer();
        const communityUserHtmlRef = React.useRef(new Map());
        const historyRequestRef = React.useRef(null);
        const historyAnchorRef = React.useRef(null);
        const readerSessionRef = React.useRef(sessionId);
        const stateRequestRef = React.useRef(0);
        const frameRef = React.useRef(null);
        const frameControllerRef = React.useRef(null);
        const browserContainerRef = React.useRef(null);
        const browserControllerRef = React.useRef(null);
        const readerSubmissionRef = React.useRef(null);
        const readerDocumentContainerRef = React.useRef(null);
        const readerDocumentControllerRef = React.useRef(null);
        const readerSurfaceRef = React.useRef(null);
        const readerActionLayerRef = React.useRef(null);
        const readerSurfacePageRef = React.useRef('');
        const [readerSurfaceLayout, setReaderSurfaceLayout] = React.useState(null);
        const readerSurfaceFactoryRef = React.useRef(null);
        const [readerSurfaceEpoch, setReaderSurfaceEpoch] = React.useState(0);
        const readerSurfaceRevisionRef = React.useRef(0);
        const browserObservedStateRef = React.useRef(null);
        const [browserStatus, setBrowserStatus] = React.useState({ kind: 'loading' });
        const [readerDocumentStatus, setReaderDocumentStatus] = React.useState({ kind: 'inactive' });
        const frameIdentityRef = React.useRef('');
        const [frameEpoch, setFrameEpoch] = React.useState(0);
        const [frameLayout, setFrameLayout] = React.useState(null);
        const [frameFailure, setFrameFailure] = React.useState(null);
        const streamLeaseRef = React.useRef(null);
        readerSessionRef.current = sessionId;
        if (streamLeaseRef.current?.sessionId !== sessionId)
            streamLeaseRef.current = null;
        React.useEffect(() => {
            setState(null);
            setLoadError(null);
            setReaderStart(null);
            setLoadingOlder(false);
            setHistoryError(null);
            historyRequestRef.current = null;
            historyAnchorRef.current = null;
            if (!sessionId)
                return;
            if (!isRoleplaySession(sessionId))
                return;
            const readerSubmission = readerHandoff?.mount(sessionId);
            readerSubmissionRef.current = readerSubmission ?? null;
            let alive = true;
            const requestedSessionId = sessionId;
            const load = (evenWhenHidden = false) => {
                if (!evenWhenHidden && typeof document !== 'undefined' && document.hidden)
                    return;
                const request = ++stateRequestRef.current;
                fetchState(requestedSessionId, true).then((d) => {
                    if (!alive || request !== stateRequestRef.current)
                        return;
                    if (d?.sessionId && d.sessionId !== requestedSessionId)
                        return;
                    if (d?.ok === false)
                        readerSubmission?.publish({ kind: 'failed', code: String(d.error ?? '角色扮演状态不可用') });
                    setLoadError(d?.ok === false ? String(d.error ?? '角色扮演状态不可用') : null);
                    setState(d);
                }).catch(error => {
                    if (!alive || request !== stateRequestRef.current)
                        return;
                    const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
                    setLoadError(String(message));
                });
            };
            load();
            const timer = setInterval(load, 30000);
            const communityChanged = () => load(true);
            window.addEventListener('dsh-community-preset-changed', communityChanged);
            const unsubscribe = subscribeState(requestedSessionId, () => {
                // Invalidation may select a new worldline without changing the view's
                // sessionId. Revoke old author capabilities before fetching new state.
                frameControllerRef.current?.dispose();
                frameControllerRef.current = null;
                setFrameEpoch(value => value + 1);
                void browserControllerRef.current?.refresh();
                load(true);
            });
            return () => {
                alive = false;
                stateRequestRef.current++;
                clearInterval(timer);
                unsubscribe();
                readerSubmission?.dispose();
                if (readerSubmissionRef.current === readerSubmission)
                    readerSubmissionRef.current = null;
                window.removeEventListener('dsh-community-preset-changed', communityChanged);
            };
        }, [sessionId]);
        React.useEffect(() => {
            if (!sessionId || !activity)
                return;
            let alive = true;
            const request = ++stateRequestRef.current;
            fetchState(sessionId, true).then(data => {
                if (!alive || request !== stateRequestRef.current || data?.sessionId !== sessionId)
                    return;
                setState(data);
                setLoadError(null);
            }).catch(() => { });
            return () => { alive = false; };
        }, [sessionId, activity?.storySeq, activity?.stage]);
        // useChat activates and subscribes the authoritative chat target. A
        // conversation view can otherwise open with no chat snapshot after refresh.
        const useChat = typeof props.useChat === 'function' ? props.useChat : noopSnapshotHook;
        const chat = useChat((value) => value);
        const useConv = typeof props.useConversation === 'function' ? props.useConversation : noopSnapshotHook;
        const snapshot = useConv((value) => value) ?? props.snapshot ?? props.conversation ?? null;
        const readerRef = React.useRef(null);
        const scrollRef = React.useRef(null);
        const useSession = props.useSession ?? noopSnapshotHook;
        const historySnapshot = useSession(value => value);
        // Paging can outlive a view switch, so retain its exact Session through
        // the native pager's completion. Rendering belongs to the slot owner.
        const loadOlder = sessionId ? () => sessionsService.using(sessionId, { source: 'nexttavernReader' }, reference => reference.binding.session.loadOlder()) : null;
        const fillComposer = (text, allowClipboard = true) => {
            if (!sessionId || resolveActiveSessionId() !== sessionId) {
                toast('请先切换到此对话，再填入输入框');
                return;
            }
            const editor = document.querySelector('[data-composer-input]');
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
                }
                catch { }
            }
            if (allowClipboard && navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => toast('输入框不可达，已复制到剪贴板')).catch(() => { });
            }
        };
        const beauty = state?.rules?.beauty ?? null;
        const rules = Array.isArray(beauty?.regexRules) ? beauty.regexRules : [];
        const authorCss = String(beauty?.css ?? '');
        const authorJs = String(beauty?.js ?? '');
        const numerical = state?.sessionId === sessionId ? state.numericalState : undefined;
        const displayEnabled = state?.sessionId === sessionId && state.readerDisplay?.enabled === true;
        // The selected Source/Native scope owns document fragments and normal
        // beauty results together, including the author frame's history window.
        const beautyScope = sessionId + '\0' + JSON.stringify([rules, state?.communityPresets?.fingerprint, displayEnabled
                ? [state.surfaceNodes, state.recordVersions, numerical?.kind,
                    numerical?.snapshot?.revision, numerical?.snapshot?.stateSnapshotSha256,
                    numerical?.snapshot?.valuesSha256, numerical?.snapshot?.sourceSha256]
                : null]);
        const beautyCache = beautyCacheRef.current;
        beautyCache.selectScope(beautyScope);
        const actualBrowserFramed = browserControllerRef.current?.hasFrame() === true
            && browserStatus.kind !== 'failed' && browserStatus.kind !== 'inactive';
        const actualReaderFramed = readerDocumentControllerRef.current?.hasFrame() === true
            && readerDocumentStatus.kind !== 'failed' && readerDocumentStatus.kind !== 'inactive';
        const helperSupportsReader = browserControllerRef.current?.supportsReaderSurface() === true;
        const helperAllowsReader = browserStatus.kind === 'inactive' || helperSupportsReader;
        const actualSharedBrowserFramed = actualBrowserFramed && helperSupportsReader;
        const actualSharedFramed = actualReaderFramed || actualSharedBrowserFramed;
        const actualFramed = actualBrowserFramed || actualReaderFramed;
        const authorWindow = actualFramed || !!authorJs.trim() || beautyCache.hasDocuments() || !!beautyCache.execution();
        // Collect only the authoritative surface of this Session.  The Chat
        // target may retain audit/shadow nodes after a replacement, and sibling
        // Sessions may be resident in the client cache; neither belongs in the
        // selected branch's reader or memory view.
        const parts = [];
        const surfaceNodesBySeq = new Map();
        for (const entry of state?.surfaceNodes ?? []) {
            const seq = Number(entry?.seq);
            if (!Number.isSafeInteger(seq))
                continue;
            // A duplicate seq keeps its first position and last metadata, as Map
            // construction did. Depth is derived only for the visible page below.
            const index = surfaceNodesBySeq.get(seq)?.index ?? surfaceNodesBySeq.size;
            surfaceNodesBySeq.set(seq, { turn: entry.turn, index });
        }
        const nodes = [];
        const selectedNodes = [];
        const selectedNodeSeqs = new Set();
        const turnMetaByMessageId = new Map();
        const collectNode = (node) => {
            if (!node || node.visibility === 'hidden')
                return;
            nodes.push(node);
            if (node.kind === 'turn-tail') {
                const messageId = String(node.data?.closing?.finalNode?.messageId ?? '');
                if (messageId) {
                    const startTime = Number(node.location?.turn?.start?.time);
                    const endTime = Number(node.location?.turn?.end?.time);
                    turnMetaByMessageId.set(messageId, {
                        usage: node.data?.tokenUsage,
                        runMs: Number.isFinite(startTime) && Number.isFinite(endTime)
                            ? Math.max(0, endTime - startTime) : null,
                        tokensPerSecond: Number(node.data?.tokensPerSecond),
                    });
                }
                return;
            }
            const kind = String(node?.kind ?? '');
            if (!['user', 'assistant-step', 'assistant', 'narrator'].includes(kind))
                return;
            // A multi-step turn can project several assistant-step nodes whose
            // finalNode points at the same closing assistant message. Reader is a
            // prose surface, so keep only settled/final material and dedupe by the
            // server-authoritative surface sequence.
            if (kind === 'assistant-step' && node?.data?.status && node.data.status !== 'settled')
                return;
            const seq = readerNodeSeq(node);
            if (seq === null || !surfaceNodesBySeq.has(seq) || selectedNodeSeqs.has(seq))
                return;
            selectedNodeSeqs.add(seq);
            selectedNodes.push(node);
        };
        if (Array.isArray(chat?.order) && chat.nodes && typeof chat.nodes.get === 'function') {
            for (const key of chat.order)
                collectNode(chat.nodes.get(key));
        }
        else {
            for (const node of normalizeConversationNodes(snapshot))
                collectNode(node);
        }
        // Source-backed display expands each Native row before rendering. Its
        // body, author documents and native actions share this small page.
        const nativePageRows = displayEnabled ? 16 : COMMUNITY_READER_WINDOW_MESSAGES;
        const windowStart = readerStart === null
            ? Math.max(0, selectedNodes.length - nativePageRows)
            : Math.min(Math.max(0, readerStart), Math.max(0, selectedNodes.length - 1));
        const authorHistoryPage = (authorWindow || displayEnabled)
            && windowStart < Math.max(0, selectedNodes.length - nativePageRows);
        const readerNodes = displayEnabled ? selectedNodes.slice(windowStart, windowStart + nativePageRows)
            : selectedNodes.slice(windowStart);
        const settledStoryKeys = new Set(readerNodes
            .filter((node) => node?.kind === 'assistant-step' && node?.data?.status === 'settled')
            .map((node) => `${node.data?.turn ?? ''}:${node.data?.step ?? ''}`));
        const failedTurnByUserSeq = new Map();
        if (!(activity?.sessionId === sessionId && activity.running === true)) {
            for (const [turnKey, recoverySeq] of Object.entries(state?.failedTurnRecoveryByTurn ?? {})) {
                const turn = Number(turnKey);
                if (!Number.isSafeInteger(turn) || turn < 0 || typeof recoverySeq !== 'number'
                    || !Number.isSafeInteger(recoverySeq)
                    || recoverySeq < 0)
                    continue;
                failedTurnByUserSeq.set(recoverySeq, turn);
            }
        }
        for (const node of readerNodes) {
            if (!node || typeof node !== 'object')
                continue;
            const text = readerText(node);
            if (!text)
                continue;
            const seq = readerNodeSeq(node);
            const messageId = readerMessageId(node);
            if (node.kind === 'user') {
                parts.push({ kind: 'user', text, seq, messageId, time: readerTime(node), failedTurn: failedTurnByUserSeq.get(seq) });
            }
            else if (node.kind === 'assistant-step' || node.kind === 'assistant' || node.kind === 'narrator') {
                parts.push({
                    kind: 'narrator',
                    text,
                    seq,
                    messageId,
                    turn: surfaceNodesBySeq.get(seq).turn,
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
                    && activity.turn !== streamLeaseRef.current.turn)))
            streamLeaseRef.current = null;
        if (sessionId && activity?.sessionId === sessionId && activity.running && activity.stage === 'story'
            && typeof activity.turn === 'number'
            && Number.isSafeInteger(activity.turn)
            && typeof activity.storyStep === 'number'
            && Number.isSafeInteger(activity.storyStep)) {
            streamLeaseRef.current = { sessionId, turn: activity.turn, step: activity.storyStep };
        }
        const streamLease = streamLeaseRef.current;
        if (streamLease?.sessionId === sessionId && !authorHistoryPage) {
            const streamTurn = streamLease.turn;
            const streamStep = streamLease.step;
            const streamKey = `${streamTurn}:${streamStep}`;
            if (settledStoryKeys.has(streamKey))
                streamLeaseRef.current = null;
            if (!settledStoryKeys.has(streamKey)) {
                const candidates = [];
                for (const node of nodes) {
                    if (node?.kind !== 'assistant-step' || !['running', 'settled'].some(status => status === node?.data?.status))
                        continue;
                    if (node.data?.turn !== streamTurn || node.data?.step !== streamStep)
                        continue;
                    const blocks = node.data?.blocks;
                    const text = Array.isArray(blocks)
                        ? blocks.filter(block => block?.kind === 'text' && typeof block.text === 'string').map(block => block.text).filter(Boolean).join('\n')
                        : '';
                    if (text)
                        candidates.push({ node, text });
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
        const visibleParts = displayEnabled
            ? [...committedParts, ...transientParts]
            : authorWindow
                ? [...committedParts.slice(0, AUTHOR_FRAME_MAX_ROWS - transientParts.length), ...transientParts]
                : parts;
        const displayUpdates = numerical?.sessionId === sessionId
            && (numerical.kind === 'ready' || numerical.kind === 'schema-ready')
            && Array.isArray(numerical.displayUpdates) ? numerical.displayUpdates : [];
        const displayByMessage = new Map();
        for (const update of displayUpdates) {
            if (!update?.canonical)
                continue;
            const key = JSON.stringify([update.canonical.seq, update.canonical.messageId]);
            // Even equal-looking facts with different owners are ambiguous to
            // this selected surface; omission leaves the original text visible.
            displayByMessage.set(key, displayByMessage.has(key) ? null : update);
        }
        const taskFor = (part) => {
            if (part.kind !== 'narrator' || part.transient)
                return part.text;
            const accepted = displayByMessage.get(JSON.stringify([part.seq, part.messageId]));
            return { text: part.text, seq: part.seq, messageId: part.messageId,
                ...(accepted ? { displayUpdate: accepted } : {}) };
        };
        const communityCache = communityCacheRef.current;
        const communityScope = sessionId + '\0' + (state?.communityPresets?.fingerprint ?? 'unselected');
        const communityDepth = (seq) => {
            const selected = surfaceNodesBySeq.get(seq);
            return selected ? surfaceNodesBySeq.size - selected.index - 1 : 0;
        };
        communityCache?.selectScope(communityScope);
        // Source-backed assistants consume the effective community/card registry
        // once on the server, retaining document and mapped-output provenance.
        const communityTasks = visibleParts.filter(part => !part.transient && part.seq !== undefined && !!part.messageId
            && (!displayEnabled || part.kind === 'user'))
            .map(part => ({ seq: part.seq, messageId: part.messageId, text: part.text, depth: communityDepth(part.seq) }));
        const communityInput = communityCache?.versionFor(communityTasks) ?? 0;
        React.useEffect(() => sessionId ? communityCache?.run(communityScope, sessionId, communityTasks, () => refreshBeauty(n => n + 1)) : undefined, [communityScope, communityInput, communityReload]);
        const projectedParts = visibleParts.map(part => {
            if (part.transient || part.seq === undefined || !part.messageId || !communityCache
                || displayEnabled && part.kind === 'narrator')
                return part;
            return { ...part, text: communityCache.textFor({ seq: part.seq, messageId: part.messageId, text: part.text,
                    depth: communityDepth(part.seq) }) };
        });
        const visibleTasks = projectedParts.map((part, index) => {
            const task = taskFor(part);
            return typeof task === 'string' ? task : { ...task, canonicalText: visibleParts[index].text };
        });
        // Keep transient stream text out of regex work; it still gets immediate fallback rendering.
        const beautyTasks = visibleTasks.filter((_, index) => visibleParts[index].kind === 'narrator'
            && !visibleParts[index].transient);
        const readerExecution = beautyCache.execution(beautyTasks);
        const beautyInput = JSON.stringify(beautyTasks);
        React.useEffect(() => beautyCache.run(beautyScope, beautyTasks, rules, () => refreshBeauty(n => n + 1), displayEnabled && sessionId ? { sessionId, read: fetchReaderDisplay } : undefined), [beautyScope, beautyInput]);
        const applyBeauty = beautyCache.htmlFor;
        const beautyFailed = beautyCache.failed(beautyTasks);
        const userHtml = (text) => {
            const cache = communityUserHtmlRef.current;
            let html = cache.get(text);
            if (html === undefined)
                html = renderReaderNarrative(text, []);
            else
                cache.delete(text);
            cache.set(text, html);
            while (cache.size > COMMUNITY_READER_WINDOW_MESSAGES)
                cache.delete(cache.keys().next().value);
            return html;
        };
        const renderedParts = projectedParts.map((part, index) => {
            const display = communityOptionsRef.current(part.kind === 'narrator'
                ? applyBeauty(visibleTasks[index], displayEnabled) : userHtml(part.text));
            return { ...visibleParts[index], displayText: part.kind === 'narrator'
                    ? beautyCache.textFor(visibleTasks[index], displayEnabled) : part.text,
                html: display.html, frameHtml: display.frameHtml, communityOptions: display.options,
                fragments: part.kind === 'narrator' ? beautyCache.fragmentsFor(visibleTasks[index])?.map(fragment => fragment.kind === 'text' ? { ...fragment, html: communityOptionsRef.current(fragment.html).html } : fragment) : undefined,
                readerFragments: part.kind === 'narrator' ? beautyCache.readerFragmentsFor(visibleTasks[index]) : undefined,
                nativeUserProjection: part.kind === 'user' && (part.text !== visibleParts[index].text || display.options.length > 0) };
        });
        if (state !== null && selectedNodes.length === 0) {
            console.warn('[roleplay-reader] selected surface empty', {
                sessionId,
                allNodeCount: nodes.length,
                surfaceSeqs: [...surfaceNodesBySeq.keys()].slice(-12),
                snapshotType: typeof snapshot,
                snapshotKeys: snapshot && typeof snapshot === 'object' ? Object.keys(snapshot).slice(0, 12) : null,
            });
        }
        const docHtml = renderedParts.map((part) => part.kind === 'narrator' ? part.html : part.text).join('\n');
        const committedDocHtml = renderedParts.filter(part => !part.transient).map(part => part.kind === 'narrator' ? part.html : part.text).join('\n');
        const historyBusy = loadingOlder || historySnapshot?.loadingOlder === true;
        const canLoadOlder = windowStart > 0 || (!!loadOlder && historySnapshot?.hasMore === true);
        const canLoadNewer = displayEnabled ? windowStart + readerNodes.length < selectedNodes.length
            : authorWindow && visibleParts.length < parts.length;
        const canLoadLatest = (authorWindow || displayEnabled) && readerStart !== null;
        const readerPartKey = (part) => part.transient
            ? part.streamKey ?? 'stream:unknown'
            : `${part.kind}:${part.seq ?? ''}:${part.messageId ?? ''}`;
        const renderedHeadKey = renderedParts.length ? readerPartKey(renderedParts[0]) : null;
        const frameIdentity = JSON.stringify([
            frameEpoch, sessionId, state?.sessionId, state?.preset, authorJs, authorCss, committedDocHtml,
            beautyCache.hasDocuments(),
        ]);
        frameIdentityRef.current = frameIdentity;
        const framed = browserStatus.kind === 'inactive' && (!readerExecution || !!authorJs.trim())
            && (!!authorJs.trim() || beautyCache.hasDocuments())
            && frameFailure?.identity !== frameIdentity;
        const activeFrameLayout = frameLayout?.identity === frameIdentity ? frameLayout.value : null;
        const activeReaderLayout = readerSurfaceLayout?.surface === readerSurfaceRef.current
            ? readerSurfaceLayout?.value : undefined;
        const restoreHistoryAnchor = () => {
            const held = historyAnchorRef.current, scroller = scrollRef.current;
            if (!held || !scroller || held.sessionId !== sessionId)
                return;
            if (held.headKey === renderedHeadKey && held.count === renderedParts.length)
                return;
            const row = Array.from(scroller.querySelectorAll('[data-reader-key]'))
                .find(element => element.getAttribute('data-reader-key') === held.key);
            if (row)
                scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - held.top;
            else if (held.resetIfMissing)
                scroller.scrollTop = 0;
            historyAnchorRef.current = null;
        };
        const framePayload = JSON.stringify(renderedParts.map(part => ({
            key: readerPartKey(part), kind: part.kind, text: part.displayText, html: part.html, fragments: part.fragments,
        })));
        const committedBrowserPayload = JSON.stringify(renderedParts.filter(part => !part.transient).map(part => ({
            key: readerPartKey(part), kind: part.kind, text: part.kind === 'user' ? part.text : part.displayText, html: part.frameHtml,
        })));
        // Frozen frames retain complete user DATA. Their duplicate projected
        // row is hidden while native Reader owns community option controls.
        const browserUserKeys = renderedParts.filter(part => part.nativeUserProjection && !part.transient)
            .map(part => `[data-reader-key=${JSON.stringify(readerPartKey(part))}]`);
        const readerBaseCss = READER_BASE_CSS + '\n' + COMMUNITY_READER_CSS + '\n' + authorCss;
        const browserReaderCss = readerBaseCss
            + (browserUserKeys.length ? '\n' + browserUserKeys.join(',') + '{display:none!important}' : '');
        const sharedReaderCss = readerBaseCss
            + (browserUserKeys.length ? '\n' + browserUserKeys.map(key => key + ' > .rp-user-line').join(',')
                + '{display:none!important}' : '');
        const readerDocumentPayload = JSON.stringify(renderedParts.filter(part => !part.transient).map(part => part.kind === 'user' ? { key: readerPartKey(part), kind: part.kind, text: part.text }
            : { key: readerPartKey(part), kind: part.kind, html: part.frameHtml,
                fragments: part.readerFragments?.map(fragment => fragment.kind === 'text'
                    ? { ...fragment, html: communityOptionsRef.current(fragment.html).frameHtml } : fragment) }));
        const readerSurfacePayload = JSON.stringify(renderedParts.map(part => part.kind === 'user' ? { key: readerPartKey(part), kind: part.kind, text: part.text }
            : { key: readerPartKey(part), kind: part.kind, html: part.frameHtml,
                fragments: part.readerFragments?.map(fragment => fragment.kind === 'text'
                    ? { ...fragment, html: communityOptionsRef.current(fragment.html).frameHtml } : fragment) }));
        const readerDocumentConflict = readerExecution && !helperAllowsReader
            && browserStatus.kind !== 'loading' ? 'READER_REGEX_DOCUMENT_LEGACY_FRAME_ACTIVE'
            : readerExecution && authorJs.trim() ? 'READER_REGEX_DOCUMENT_LEGACY_SCRIPT_ACTIVE' : undefined;
        React.useEffect(() => {
            if (!sessionId || state?.sessionId !== sessionId || state?.preset !== 'roleplay'
                || !readerDocumentContainerRef.current)
                return;
            const container = readerDocumentContainerRef.current;
            let active = true, surface;
            const acquire = () => {
                if (surface)
                    return surface;
                const outer = container.ownerDocument.createElement('iframe');
                outer.className = 'rp-author-guard-frame';
                outer.title = '作者交互阅读内容';
                container.append(outer);
                const created = createAuthorReaderSurface(outer, {
                    current: () => active && readerSessionRef.current === sessionId && readerSurfaceRef.current === created,
                    layout: value => setReaderSurfaceLayout({ surface: created, page: readerSurfacePageRef.current, value }),
                    mountStaticDocument: (node, html, layout) => mountStaticAuthorDocument(node, html, {
                        current: () => active && readerSurfaceRef.current === created,
                        fill: text => fillComposer(text, false), layout
                    }),
                });
                surface = created;
                readerSurfaceRef.current = created;
                readerSurfaceRevisionRef.current = 0;
                setReaderSurfaceEpoch(value => value + 1);
                return created;
            };
            readerSurfaceFactoryRef.current = acquire;
            return () => {
                active = false;
                readerDocumentControllerRef.current?.dispose();
                browserControllerRef.current?.dispose();
                surface?.dispose();
                surface?.outer.remove();
                if (readerSurfaceRef.current === surface)
                    readerSurfaceRef.current = null;
                if (readerSurfaceFactoryRef.current === acquire)
                    readerSurfaceFactoryRef.current = null;
            };
        }, [sessionId, state?.sessionId, state?.preset]);
        React.useLayoutEffect(() => {
            const surface = readerSurfaceRef.current, layer = readerActionLayerRef.current;
            if (!actualSharedFramed || !surface || !layer || readerSurfaceLayout?.surface !== surface
                || readerSurfaceLayout.page !== readerSurfacePayload)
                return;
            const rows = Array.from(layer.querySelectorAll('.rp-author-shared-action-row'));
            const measure = () => surface.setActionHeights(Object.fromEntries(rows.map(row => [row.dataset.readerKey, row.getBoundingClientRect().height])));
            // An observer may run before React commits the surface's next
            // coordinates. It only submits heights; the layout receipt restores
            // the reading anchor after those heights have reached the document.
            const observer = new layer.ownerDocument.defaultView.ResizeObserver(() => { measure(); });
            for (const row of rows)
                observer.observe(row);
            const hasPendingLayout = measure();
            if (!hasPendingLayout)
                restoreHistoryAnchor();
            return () => observer.disconnect();
        }, [actualSharedFramed, activeReaderLayout, framePayload, readerSurfacePayload]);
        React.useEffect(() => {
            if (!sessionId || state?.sessionId !== sessionId || state?.preset !== 'roleplay'
                || !readerDocumentContainerRef.current)
                return;
            const controller = createReaderRegexDocumentSession({ sessionId, container: readerDocumentContainerRef.current,
                fill: text => fillComposer(text, false),
                surface: () => readerSurfaceFactoryRef.current(),
                current: () => readerSessionRef.current === sessionId && readerDocumentControllerRef.current === controller,
                status: setReaderDocumentStatus,
                images: (owner, pageId, values) => images?.acceptBrowserImages(sessionId, owner, pageId, values),
                releaseImages: owner => images?.releaseBrowserImages(owner) });
            readerDocumentControllerRef.current = controller;
            setReaderDocumentStatus({ kind: 'inactive' });
            return () => { controller.dispose(); if (readerDocumentControllerRef.current === controller)
                readerDocumentControllerRef.current = null; };
        }, [sessionId, state?.sessionId, state?.preset]);
        React.useEffect(() => {
            readerSurfacePageRef.current = readerSurfacePayload;
            readerSurfaceRef.current?.render({ renderRevision: ++readerSurfaceRevisionRef.current,
                css: scopeReaderCss(sharedReaderCss), parts: JSON.parse(readerSurfacePayload) });
        }, [readerSurfaceEpoch, readerSurfacePayload, sharedReaderCss]);
        React.useEffect(() => {
            const controller = readerDocumentControllerRef.current;
            if (!controller)
                return;
            if (!readerExecution || !helperAllowsReader || authorJs.trim()) {
                controller.invalidate();
                return;
            }
            controller.update(readerExecution, { css: sharedReaderCss, parts: JSON.parse(readerDocumentPayload) });
        }, [readerExecution, readerDocumentPayload, helperAllowsReader, authorJs, sharedReaderCss]);
        React.useEffect(() => {
            if (!sessionId || state?.sessionId !== sessionId || state?.preset !== 'roleplay' || !browserContainerRef.current)
                return;
            const readerSubmission = readerSubmissionRef.current;
            const controller = createAuthorBrowserSession({
                sessionId, container: browserContainerRef.current,
                surface: () => readerSurfaceFactoryRef.current(),
                composer: createReaderComposerAccess(document, () => resolveActiveSessionId() === sessionId),
                current: () => readerSessionRef.current === sessionId && browserControllerRef.current === controller,
                status: setBrowserStatus,
                preparation: value => readerSubmission?.publish(value),
                images: (owner, pageId, values) => images?.acceptBrowserImages(sessionId, owner, pageId, values),
                releaseImages: owner => images?.releaseBrowserImages(owner),
            });
            browserControllerRef.current = controller;
            browserObservedStateRef.current = state;
            setBrowserStatus({ kind: 'loading' });
            void controller.start();
            return () => {
                controller.dispose();
                if (browserControllerRef.current === controller)
                    browserControllerRef.current = null;
            };
        }, [sessionId, state?.sessionId, state?.preset]);
        React.useEffect(() => {
            browserControllerRef.current?.render({
                css: browserReaderCss,
                parts: JSON.parse(committedBrowserPayload),
            });
        }, [sessionId, state?.sessionId, state?.preset, committedBrowserPayload, browserReaderCss]);
        React.useEffect(() => {
            // Core decides whether a changed cut is merely a read revision or a
            // new author generation. React never derives that from body text.
            if (state?.sessionId === sessionId && browserObservedStateRef.current !== state) {
                browserObservedStateRef.current = state;
                void browserControllerRef.current?.refresh();
            }
        }, [state, sessionId]);
        React.useEffect(() => {
            if (!framed || !sessionId || state?.sessionId !== sessionId || state?.preset !== 'roleplay' || !frameRef.current)
                return;
            const identity = frameIdentity;
            const controller = createAuthorFrame(frameRef.current, {
                ...(authorJs.trim() ? { mode: 'script', source: authorJs } : { mode: 'static-document' }),
                css: authorCss,
                baseCss: READER_BASE_CSS + '\n' + COMMUNITY_READER_CSS,
                current: () => readerSessionRef.current === sessionId && frameIdentityRef.current === identity,
                fill: text => fillComposer(text, false),
                layout: value => setFrameLayout({ identity, value }),
                failed: reason => setFrameFailure({ identity, reason }),
            });
            frameControllerRef.current = controller;
            return () => {
                controller.dispose();
                if (frameControllerRef.current === controller)
                    frameControllerRef.current = null;
            };
        }, [frameIdentity, framed, sessionId, state?.sessionId, state?.preset]);
        React.useEffect(() => {
            if (framed)
                frameControllerRef.current?.update(JSON.parse(framePayload));
        }, [frameIdentity, framePayload, framed]);
        // Native history prepends must not push the paragraph under the pointer
        // off-screen. Keep a DOM row anchor, not a scrollHeight approximation:
        // author HTML can change height after the response arrives.
        React.useLayoutEffect(() => {
            if (actualSharedFramed)
                return;
            if (framed && !activeFrameLayout)
                return;
            restoreHistoryAnchor();
        }, [docHtml, renderedHeadKey, renderedParts.length, sessionId, activeFrameLayout, actualSharedFramed]);
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
            if (!canLoadOlder || historyBusy || historyRequestRef.current)
                return;
            const requestedSessionId = sessionId;
            const request = {};
            historyRequestRef.current = request;
            setHistoryError(null);
            holdHistoryAnchor(authorWindow);
            setLoadingOlder(true);
            try {
                if (windowStart > 0) {
                    setReaderStart(Math.max(0, windowStart - nativePageRows));
                }
                else {
                    // A zero local slice offset is not the server's end-of-history.
                    // Once paging starts keep the loaded branch window visible.
                    setReaderStart(0);
                    await loadOlder?.();
                }
            }
            catch (error) {
                if (readerSessionRef.current !== requestedSessionId)
                    return;
                historyAnchorRef.current = null;
                setHistoryError(String(error && typeof error === 'object' && 'message' in error ? error.message : error));
            }
            finally {
                if (historyRequestRef.current === request) {
                    historyRequestRef.current = null;
                    setLoadingOlder(false);
                }
            }
        };
        const requestNewer = () => {
            if (!canLoadNewer || historyBusy || historyRequestRef.current)
                return;
            // Overlap the pages so an on-screen original-seq row can stay put.
            const next = visibleParts[Math.max(0, visibleParts.length - (displayEnabled ? 1 : 100))];
            const nextStart = selectedNodes.findIndex(node => readerNodeSeq(node) === next?.seq);
            if (nextStart <= windowStart)
                return;
            holdHistoryAnchor(true);
            setHistoryError(null);
            setReaderStart(nextStart);
        };
        const requestLatest = () => {
            if (historyBusy || historyRequestRef.current)
                return;
            historyAnchorRef.current = null;
            if (scrollRef.current)
                scrollRef.current.scrollTop = 0;
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
            scopeReaderCss(READER_BASE_CSS + '\n' + COMMUNITY_READER_CSS) + '\n}\n' + (framed ? '' : scopeReaderCss(authorCss)) + `
.rp-author-frame-host { position: relative; width: min(1500px, 100%); align-self: center; overflow: hidden; }
.rp-reader-view > .rp-author-frame-host { flex-shrink: 0; }
.rp-author-guard-frame { display: block; width: 100%; height: 150px; border: 0; }
.rp-author-action-layer { position: absolute; inset: 0; pointer-events: none; }
.rp-author-action-row { position: absolute; left: 0; right: 0; min-height: 32px;
  padding: 0 clamp(22px, 4.8vw, 72px); box-sizing: border-box; pointer-events: none; }
.rp-author-action-row .rp-reader-actions { pointer-events: auto; }
.rp-author-shared-action-row { position: absolute; display: flow-root; box-sizing: border-box;
  color: var(--rp-reader-ink); pointer-events: auto; }
.rp-author-shared-action-layer { z-index: 1; }
`;
        // Keep every hook above all exits; otherwise switching between loading,
        // non-roleplay and roleplay states changes the hook count and crashes React.
        if (!sessionId)
            return null;
        if (state === null) {
            return React.createElement('div', { className: 'rp-reader-view' }, React.createElement('div', { className: 'rp-reader-empty' }, '正在加载阅读视图…'));
        }
        if (state.sessionId !== sessionId || state.preset !== 'roleplay') {
            return React.createElement('div', { className: 'rp-reader-view' }, React.createElement('div', { className: 'rp-reader-empty' }, '「阅读」视图仅在角色扮演会话中可用'));
        }
        const renderFramedPart = (part, index) => {
            const key = readerPartKey(part), slot = activeReaderLayout?.rows[key];
            if (actualSharedFramed && !slot)
                return null;
            return React.createElement('section', {
                className: 'rp-reader-message' + (actualSharedFramed ? ' rp-author-shared-action-row' : ''),
                'data-kind': actualSharedFramed ? (part.kind === 'user' ? 'user' : 'assistant') : undefined, 'data-reader-key': key,
                key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
                style: actualSharedFramed ? { top: slot.top, left: slot.left, width: slot.width } : undefined,
            }, part.transient && !actualSharedFramed || part.nativeUserProjection ? React.createElement('div', {
                className: part.kind === 'user' ? 'rp-user-line' : 'rp-reader-narrative',
                dangerouslySetInnerHTML: { __html: part.kind === 'user' ? '◈ 你：' + part.frameHtml : part.html }
            }) : null, !part.transient && part.communityOptions.length ? React.createElement('div', { className: 'community-options' }, React.createElement('p', null, '选择内容会追加到输入草稿'), part.communityOptions.map(option => React.createElement('button', { type: 'button', className: 'community-option',
                key: option.id, onClick: () => fillComposer(option.text, false) }, option.label))) : null, renderReaderActions(actionProps(part, sessionId)));
        };
        return React.createElement('div', {
            className: 'rp-reader-view',
            ref: scrollRef,
            onScroll: (event) => {
                if (event.currentTarget.scrollTop < 140 && !historyError)
                    void requestOlder();
            },
            onWheel: (event) => {
                // At the very top a wheel gesture need not emit `scroll` at all.
                if (event.deltaY < 0 && event.currentTarget.scrollTop < 140 && !historyError)
                    void requestOlder();
            },
        }, React.createElement('style', null, scopedCss + ACTIVITY_CSS), browserStatus.kind === 'pending' ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '作者数值保存尚未确认，已保留原请求。', React.createElement('button', { type: 'button', onClick: () => void browserControllerRef.current?.confirm() }, '确认保存结果'), React.createElement('button', { type: 'button', onClick: () => void browserControllerRef.current?.retry() }, '重试同一次保存')) : null, browserStatus.kind === 'failed' ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '作者交互视图不可用：' + browserStatus.code, React.createElement('button', { type: 'button', onClick: () => void browserControllerRef.current?.confirm() }, '重新连接')) : null, frameFailure?.identity === frameIdentity ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '隔离阅读视图不可用，已保留正文和原生操作；作者脚本未运行。' + frameFailure.reason) : null, beautyFailed ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '部分美化规则未能安全完成，已保留可读正文和原生操作。修改规则后会重新匹配。') : null, readerDocumentConflict || readerDocumentStatus.kind === 'failed'
            ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '作者正则文档未执行：' + (readerDocumentConflict ?? readerDocumentStatus.code)) : null, communityCache?.failed() ? React.createElement('div', { className: 'rp-reader-empty', role: 'status' }, '社区显示规则未能完成，已保留原文。', React.createElement('button', { type: 'button', onClick: () => reloadCommunity(n => n + 1) }, '重试显示规则')) : null, canLoadOlder || historyBusy || historyError || canLoadNewer || canLoadLatest
            ? React.createElement('div', { className: 'rp-reader-history', role: 'status', 'aria-live': 'polite' }, canLoadOlder || historyBusy || historyError ? React.createElement('button', { type: 'button', className: 'rp-reader-load-older', onClick: requestOlder, disabled: historyBusy }, historyBusy ? React.createElement('span', { className: 'rp-reader-spinner', 'aria-hidden': 'true' }) : null, historyBusy ? '正在加载更早剧情…' : historyError ? '加载失败，点击重试' : '加载更早剧情') : null, canLoadNewer ? React.createElement('button', {
                type: 'button', className: 'rp-reader-load-newer', onClick: requestNewer, disabled: historyBusy,
            }, '查看较新剧情') : null, canLoadLatest ? React.createElement('button', {
                type: 'button', className: 'rp-reader-load-latest', onClick: requestLatest, disabled: historyBusy,
            }, '回到最新剧情') : null, authorWindow ? React.createElement('span', { className: 'rp-reader-page-info' }, `${authorHistoryPage ? '较早剧情' : '最新剧情'} · 本页 ${visibleParts.length} 段`) : null)
            : null, loadError ? React.createElement('div', { className: 'rp-reader-empty' }, '阅读器加载失败：' + loadError) : null, !loadError && state !== null && selectedNodes.length === 0
            ? React.createElement('div', { className: 'rp-reader-empty' }, '暂无可阅读的正文')
            : null, React.createElement('div', { className: 'rp-author-frame-host', ref: browserContainerRef,
            style: { display: actualBrowserFramed && !actualSharedBrowserFramed ? undefined : 'none' } }), React.createElement('div', { className: 'rp-author-frame-host',
            style: { display: actualSharedFramed ? undefined : 'none' } }, React.createElement('div', { ref: readerDocumentContainerRef }), actualSharedFramed ? React.createElement('div', {
            className: 'rp-author-action-layer rp-author-shared-action-layer', ref: readerActionLayerRef,
        }, renderedParts.map(renderFramedPart)) : null), actualSharedFramed ? null : actualFramed
            ? React.createElement('div', { className: 'rp-reader' }, renderedParts.map(renderFramedPart))
            : framed
                ? React.createElement('div', { className: 'rp-author-frame-host' }, React.createElement('iframe', {
                    className: 'rp-author-guard-frame', title: '隔离阅读内容', ref: frameRef,
                }), activeFrameLayout ? React.createElement('div', { className: 'rp-author-action-layer' }, renderedParts.map((part, index) => React.createElement('section', {
                    className: 'rp-reader-message rp-author-action-row',
                    'data-kind': part.kind === 'user' ? 'user' : 'assistant',
                    'data-reader-key': readerPartKey(part),
                    key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
                    style: { top: activeFrameLayout.rows[index] ?? 0 },
                }, renderReaderActions(actionProps(part, sessionId))))) : null)
                : React.createElement('div', {
                    className: 'rp-reader', ref: readerRef,
                    onClick: (event) => {
                        const f = event.target
                            && typeof event.target.closest === 'function' ? event.target.closest('[data-community-option],.f') : null;
                        if (f) {
                            event.preventDefault();
                            event.stopPropagation();
                            fillComposer(f.dataset.communityOption ?? f.innerText ?? f.textContent ?? '');
                        }
                    },
                }, renderedParts.map((part, index) => React.createElement(ReaderMessage, {
                    ...actionProps(part, sessionId),
                    html: part.html, readerKey: readerPartKey(part),
                    key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
                }))), pendingPlayerBubble(activity, nodes), React.createElement(ActivityBanner, { activity }));
    }
    return ReaderView;
}
