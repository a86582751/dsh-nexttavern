import type * as ReactAPI from 'react'
import type {createMessageActionComponents} from './message-actions.js'
import type {StateReply} from './state-store.js'
import type {ActivityState,ActivityComponents} from './activity-view.js'
import {normalizeConversationNodes,readerNodeSeq,readerMessageId,readerText,readerTime,usageTokens,formatReaderTime} from './reader-model.js'
import {renderReaderNarrative,renderReaderNarrativeAsync,scopeReaderCss,READER_BASE_CSS} from './reader-rendering.js'
import {runReaderRegex} from './reader-regex.js'
import type {ReaderRule, SourceTask, FallbackTask, SourceResult, FallbackResult} from './reader-regex.js'

interface ReaderNode extends Record<string,unknown> {
  kind?: string; visibility?: string
  data?: {status?: string; turn?: number; step?: number; blocks?: {kind?: string; text?: string}[]; usage?: unknown; tokenUsage?: unknown; tokensPerSecond?: number; closing?: {finalNode?: {messageId?: string}}}
  location?: {turn?: {start?: {time?: number}; end?: {time?: number}}}
}
interface TurnMeta {usage: unknown; runMs: number | null; tokensPerSecond: number}
interface ReaderPart {kind: 'user' | 'narrator'; text: string; time: number; seq?: number; messageId?: string; failedTurn?: number; usage?: unknown; turnMeta?: TurnMeta | null; transient?: boolean; streamKey?: string}
interface HistoryAnchor {sessionId: string | null; key: string | null; top: number; headKey: string | null | undefined; count: number}
interface ReaderState extends StateReply {
  activity?: ActivityState
  rules?: {beauty?: {regexRules?: ReaderRule[]; css?: string; js?: string}}
  surfaceNodes?: {seq?: number}[]
  failedTurnRecoveryByTurn?: Record<string, unknown>
}
interface ChatSnapshot {order?: string[]; nodes?: {get(key: string): ReaderNode | undefined}}
interface ReaderViewProps {
  sessionId?: string; scope?: {sessionId?: string}
  useChat?(selector: (value: ChatSnapshot) => ChatSnapshot): ChatSnapshot
  useConversation?(selector: (value: unknown) => unknown): unknown
  snapshot?: unknown; conversation?: unknown
  loadOlder?(): unknown | PromiseLike<unknown>
}
type MessageComponents = ReturnType<typeof createMessageActionComponents>
interface ReaderDependencies extends Pick<MessageComponents,'UserActions'|'AssistantActions'|'actionIconButton'|'ICONS'> {
  React: typeof ReactAPI
  resolveActiveSessionId(): string | null
  isRoleplaySession(id: string): boolean
  useTavernActivity: ActivityComponents['useTavernActivity']
  fetchState(id: string, force?: boolean): Promise<ReaderState>
  sessionsService?: {binding?(id: string | null): {session?: {subscribe?(listener: () => void): () => void;getSnapshot?(): {loadingOlder?: boolean; hasMore?: boolean};loadOlder?(): unknown | PromiseLike<unknown>}} | null | undefined}
  toast(text: string): void
  pendingPlayerBubble: ActivityComponents['pendingPlayerBubble']
  ActivityBanner: ActivityComponents['ActivityBanner']
  ACTIVITY_CSS: string
}

// Author JS is card data, and the documented contract already gives it nothing
// but `root` and `fill`. A bare `new Function` still left the real `document`
// and `window` in scope, so a card could register a page-wide listener that no
// teardown ever removed; because this script re-runs for every committed
// paragraph, the leak grew by one more duplicate handler per run and any event
// they listened for would fan out into all of them. Hand the card restricted
// faces instead: event registration lands on `root` and is recorded, timers are
// recorded, and teardown then unhooks everything the card registered on top of
// whatever cleanup it returned itself. Name-based escapes through
// `root.ownerDocument` or an inner `eval` still exist; a real sandbox needs a
// frame.
type AuthorRegistration = {type: string; handler: EventListenerOrEventListenerObject; options?: AddEventListenerOptions}

export function createAuthorRuntime(root: HTMLElement, fill: (text: string) => void): {run: (source: string) => (() => void) | null; teardown: () => void} {
  const registrations: AuthorRegistration[] = []
  const timers = new Set<number>()
  const add = (type: unknown, handler: unknown, options?: unknown): void => {
    if (typeof type !== 'string' || !handler) return
    const registration: AuthorRegistration = {type, handler: handler as EventListenerOrEventListenerObject, options: options as AddEventListenerOptions | undefined}
    registrations.push(registration)
    root.addEventListener(registration.type, registration.handler, registration.options)
  }
  const remove = (type: unknown, handler: unknown, options?: unknown): void => {
    const index = registrations.findIndex(item => item.type === type && item.handler === handler)
    if (index >= 0) registrations.splice(index, 1)
    if (typeof type === 'string' && handler) root.removeEventListener(type, handler as EventListenerOrEventListenerObject, options as EventListenerOptions | undefined)
  }
  const clock = (name: string) => (name === 'setTimeout' || name === 'setInterval')
    ? (callback: unknown, delay?: unknown): number => {
      if (typeof callback !== 'function') return 0
      const id = name === 'setTimeout' ? setTimeout(callback as () => void, delay as number) : setInterval(callback as () => void, delay as number)
      const numeric = Number(id)
      timers.add(numeric)
      return numeric
    }
    : (id: unknown): void => {
      const numeric = Number(id)
      timers.delete(numeric)
      if (name === 'clearTimeout') clearTimeout(numeric)
      else clearInterval(numeric)
    }
  let windowFace: object | undefined
  const face = (target: object): object => new Proxy(target, {
    get(inner, key) {
      if (typeof key !== 'string') return Reflect.get(inner, key, inner)
      if (key === 'addEventListener') return add
      if (key === 'removeEventListener') return remove
      if (key === 'setTimeout' || key === 'setInterval' || key === 'clearTimeout' || key === 'clearInterval') return clock(key)
      if (key === 'document') return documentFace
      if (key === 'window' || key === 'self' || key === 'globalThis' || key === 'top' || key === 'parent') return windowFace ?? inner
      const value: unknown = Reflect.get(inner, key, inner)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(inner) : value
    },
  })
  const documentFace = face(document)
  windowFace = face(window)
  const timeout = clock('setTimeout'), interval = clock('setInterval')
  const args = [root, fill, documentFace, windowFace, windowFace, windowFace, windowFace, windowFace, timeout, interval, clock('clearTimeout'), clock('clearInterval')]
  return {
    run: (source: string) => {
      const author = new Function('root', 'fill', 'document', 'window', 'globalThis', 'self', 'top', 'parent', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', source) as (...values: unknown[]) => unknown
      // Sloppy-mode `this` is the global object for a plain call, which would
      // hand the card the real `window` and undo the parameter shadowing.
      const result = author.call(windowFace, ...args)
      return typeof result === 'function' ? result as () => void : null
    },
    teardown: () => {
      for (const registration of registrations.splice(0)) {
        try { root.removeEventListener(registration.type, registration.handler, registration.options) } catch { /* already detached */ }
      }
      for (const id of timers) { clearTimeout(id); clearInterval(id) }
      timers.clear()
    },
  }
}

export function createReaderView({React,resolveActiveSessionId,isRoleplaySession,useTavernActivity,fetchState,sessionsService,toast,UserActions,AssistantActions,actionIconButton,ICONS,pendingPlayerBubble,ActivityBanner,ACTIVITY_CSS}: ReaderDependencies) {
  const noopSnapshotHook = () => null
    function ReaderView(props: ReaderViewProps) {
      const sessionId = props.sessionId ?? props.scope?.sessionId ?? resolveActiveSessionId()
      React.useEffect(() => {
        const restore = () => window.dispatchEvent(new Event('dsh-roleplay-view-activated'))
        restore()
        return () => { restore() }
      }, [sessionId])
      const [state, setState] = React.useState<ReaderState | null>(null)
      const [loadError, setLoadError] = React.useState<string | null>(null)
      const [readerStart, setReaderStart] = React.useState<number | null>(null)
      const [loadingOlder, setLoadingOlder] = React.useState(false)
      const [historyError, setHistoryError] = React.useState<string | null>(null)
      const activity=useTavernActivity(sessionId,state?.activity)
      const [, refreshBeauty] = React.useState(0)
      const beautyCacheRef = React.useRef(new Map<string, {html: string; error?: string}>())
      const beautyScopeRef = React.useRef('')
      const historyRequestRef = React.useRef<object | null>(null)
      const historyAnchorRef = React.useRef<HistoryAnchor | null>(null)
      const readerSessionRef = React.useRef(sessionId)
      const streamLeaseRef = React.useRef<{sessionId: string; turn: number; step: number} | null>(null)
      readerSessionRef.current = sessionId
      if (streamLeaseRef.current?.sessionId !== sessionId) streamLeaseRef.current = null
      React.useEffect(() => {
        setState(null)
        setLoadError(null)
        setReaderStart(null)
        setLoadingOlder(false)
        setHistoryError(null)
        historyRequestRef.current = null
        historyAnchorRef.current = null
        if (!sessionId) return
        if (!isRoleplaySession(sessionId)) return
        let alive = true
        const requestedSessionId = sessionId
        const load = () => {
          if (typeof document !== 'undefined' && document.hidden) return
          fetchState(requestedSessionId, true).then((d) => {
            if (!alive) return
            if (d?.sessionId && d.sessionId !== requestedSessionId) return
            setLoadError(d?.ok === false ? String(d.error ?? '角色扮演状态不可用') : null)
            setState(d)
          }).catch((error) => { if (alive) setLoadError(String(error && typeof error === 'object' && 'message' in error ? error.message : error)) })
        }
        load()
        const timer = setInterval(load, 30000)
        return () => { alive = false; clearInterval(timer) }
      }, [sessionId])
      React.useEffect(()=>{
        if(!sessionId||!activity)return
        let alive=true
        fetchState(sessionId,true).then(data=>{if(alive&&data?.sessionId===sessionId){setState(data);setLoadError(null)}}).catch(()=>{})
        return()=>{alive=false}
      },[sessionId,activity?.storySeq,activity?.stage])
      // useChat activates and subscribes the authoritative chat target. A
      // conversation view can otherwise open with no chat snapshot after refresh.
      const useChat = typeof props.useChat === 'function' ? props.useChat : noopSnapshotHook
      const chat = useChat((value) => value)
      const useConv = typeof props.useConversation === 'function' ? props.useConversation : noopSnapshotHook
      const snapshot = useConv((value) => value) ?? props.snapshot ?? props.conversation ?? null
      const readerRef = React.useRef<HTMLDivElement>(null)
      const scrollRef = React.useRef<HTMLDivElement>(null)
      // `conversation.view` does not inherit ChatView's loadOlder injection.
      // Use the same Session face and pager as Chat, never a second history API.
      const sessionFace = sessionsService?.binding?.(sessionId)?.session ?? null
      const sessionSnapshot = React.useSyncExternalStore(
        React.useCallback((notify) => sessionFace?.subscribe?.(notify) ?? (() => {}), [sessionFace]),
        React.useCallback(() => sessionFace?.getSnapshot?.() ?? null, [sessionFace]),
        () => null,
      )
      const historySnapshot = sessionSnapshot
      const loadOlder = sessionFace && typeof sessionFace.loadOlder === 'function'
        ? () => sessionFace.loadOlder!()
        : typeof props.loadOlder === 'function' ? props.loadOlder : null

      const fillComposer = (text: string) => {
        const editor = document.querySelector<HTMLElement>('[data-composer-input]')
        if (editor) {
          try {
            editor.focus()
            const sel = window.getSelection()
            if (sel && typeof sel.removeAllRanges === 'function') {
              sel.removeAllRanges()
              const range = document.createRange()
              range.selectNodeContents(editor)
              range.collapse(false)
              sel.addRange(range)
            }
            if (document.execCommand('insertText', false, text)) {
              toast('已填入输入框')
              return
            }
          } catch {}
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => toast('输入框不可达，已复制到剪贴板')).catch(() => {})
        }
      }

      const beauty = state?.rules?.beauty ?? null
      const rules = Array.isArray(beauty?.regexRules) ? beauty.regexRules : []
      const authorCss = String(beauty?.css ?? '')
      const authorJs = String(beauty?.js ?? '')

      // Collect only the authoritative surface of this Session.  The Chat
      // target may retain audit/shadow nodes after a replacement, and sibling
      // Sessions may be resident in the client cache; neither belongs in the
      // selected branch's reader or memory view.
      const parts: ReaderPart[] = []
      const nodes: ReaderNode[] = Array.isArray(chat?.order) && chat?.nodes && typeof chat.nodes.get === 'function'
        ? chat.order.map((key) => chat.nodes!.get(key)).filter((node): node is ReaderNode => !!node && node.visibility !== 'hidden')
        : (normalizeConversationNodes(snapshot) as ReaderNode[]).filter((node) => node && node.visibility !== 'hidden')
      const surfaceSeqs = new Set((state?.surfaceNodes ?? []).map((entry) => Number(entry?.seq)).filter(Number.isSafeInteger))
      const turnMetaByMessageId = new Map<string, TurnMeta>()
      for (const node of nodes) {
        if (node?.kind !== 'turn-tail') continue
        const messageId = String(node.data?.closing?.finalNode?.messageId ?? '')
        if (!messageId) continue
        const startTime = Number(node.location?.turn?.start?.time)
        const endTime = Number(node.location?.turn?.end?.time)
        turnMetaByMessageId.set(messageId, {
          usage: node.data?.tokenUsage,
          runMs: Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, endTime - startTime) : null,
          tokensPerSecond: Number(node.data?.tokensPerSecond),
        })
      }
      const selectedNodeSeqs = new Set()
      const selectedNodes = nodes.filter((node) => {
        const kind = String(node?.kind ?? '')
        if (!['user', 'assistant-step', 'assistant', 'narrator'].includes(kind)) return false
        // A multi-step turn can project several assistant-step nodes whose
        // finalNode points at the same closing assistant message. Reader is a
        // prose surface, so keep only settled/final material and dedupe by the
        // server-authoritative surface sequence.
        if (kind === 'assistant-step' && node?.data?.status && node.data.status !== 'settled') return false
        const seq = readerNodeSeq(node)
        if (seq === null || !surfaceSeqs.has(seq) || selectedNodeSeqs.has(seq)) return false
        selectedNodeSeqs.add(seq)
        return true
      })
      const windowStart = readerStart === null
        ? Math.max(0, selectedNodes.length - 500)
        : Math.min(Math.max(0, readerStart), Math.max(0, selectedNodes.length - 1))
      const readerNodes = selectedNodes.slice(windowStart)
      const settledStoryKeys = new Set(readerNodes
        .filter((node) => node?.kind === 'assistant-step' && node?.data?.status === 'settled')
        .map((node) => `${node.data?.turn ?? ''}:${node.data?.step ?? ''}`))
      const failedTurnByUserSeq = new Map<number, number>()
      if (!(activity?.sessionId === sessionId && activity.running === true)) {
        for (const [turnKey, recoverySeq] of Object.entries(state?.failedTurnRecoveryByTurn ?? {})) {
          const turn = Number(turnKey)
          if (!Number.isSafeInteger(turn) || turn < 0 || typeof recoverySeq !== 'number' || !Number.isSafeInteger(recoverySeq) || recoverySeq < 0) continue
          failedTurnByUserSeq.set(recoverySeq, turn)
        }
      }
      for (const node of readerNodes) {
        if (!node || typeof node !== 'object') continue
        const text = readerText(node)
        if (!text) continue
        const seq = readerNodeSeq(node)!
        const messageId = readerMessageId(node)
        if (node.kind === 'user') {
          parts.push({ kind: 'user', text, seq, time: readerTime(node), failedTurn: failedTurnByUserSeq.get(seq) })
        } else if (node.kind === 'assistant-step' || node.kind === 'assistant' || node.kind === 'narrator') {
          parts.push({
            kind: 'narrator', text, seq, messageId, time: readerTime(node),
            usage: node.data?.usage, turnMeta: turnMetaByMessageId.get(messageId) ?? null,
          })
        }
      }
      // A running story step is a transient reader-only projection.  It must
      // come from the exact text block and the current activity coordinates;
      // it has no Session seq/message identity and therefore cannot acquire
      // history or branch actions.
      if(streamLeaseRef.current&&(streamLeaseRef.current.sessionId!==sessionId
        ||(activity?.sessionId===sessionId&&Number.isSafeInteger(activity.turn)&&activity.turn!==streamLeaseRef.current.turn)))streamLeaseRef.current=null
      if (sessionId && activity?.sessionId === sessionId && activity.running && activity.stage === 'story'
        && typeof activity.turn==='number' && Number.isSafeInteger(activity.turn) && typeof activity.storyStep==='number' && Number.isSafeInteger(activity.storyStep)) {
        streamLeaseRef.current = { sessionId, turn: activity.turn!, step: activity.storyStep! }
      }
      const streamLease = streamLeaseRef.current
      if (streamLease?.sessionId === sessionId) {
        const streamTurn = streamLease.turn
        const streamStep = streamLease.step
        const streamKey = `${streamTurn}:${streamStep}`
        if(settledStoryKeys.has(streamKey))streamLeaseRef.current=null
        if (!settledStoryKeys.has(streamKey)) {
          const candidates = []
          for (const node of nodes) {
            if (node?.kind !== 'assistant-step' || !['running', 'settled'].some(status=>status === node?.data?.status)) continue
            if (node.data?.turn !== streamTurn || node.data?.step !== streamStep) continue
            const blocks = node.data?.blocks
            const text = Array.isArray(blocks)
              ? blocks.filter(block => block?.kind === 'text' && typeof block.text === 'string').map(block => block.text).filter(Boolean).join('\n')
              : ''
            if (text) candidates.push({ node, text })
          }
          const candidate = candidates.find(item => item.node.data?.status === 'settled') ?? candidates[0]
          if (candidate) {
            parts.push({ kind: 'narrator', text: candidate.text, time: readerTime(candidate.node), transient: true, streamKey: `stream:${streamTurn}:${streamStep}` })
          }
        }
      }

      const beautyScope = sessionId + '\0' + JSON.stringify(rules)
      if(beautyScopeRef.current!==beautyScope){beautyCacheRef.current.clear();beautyScopeRef.current=beautyScope}
      // Regex workers and author JS run on committed paragraphs, not on every
      // token delta. Streaming retains Markdown and the author CSS immediately.
      const beautyTasks = parts.filter(part=>part.kind==='narrator'&&!part.transient).map(part=>part.text)
      const beautyInput = JSON.stringify(beautyTasks)
      React.useEffect(()=>{
        if(!rules.length)return
        let cancelled=false
        const cache=beautyCacheRef.current
        function runBeautyRegex(task: SourceTask): Promise<SourceResult>
        function runBeautyRegex(task: FallbackTask): Promise<FallbackResult>
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult>
        function runBeautyRegex(task: SourceTask | FallbackTask): Promise<SourceResult | FallbackResult> {
          if(cancelled)throw new Error('cancelled')
          return runReaderRegex(task)
        }
        void (async()=>{
          for(const raw of beautyTasks){
            if(cancelled)break
            if(cache.has(raw))continue
            let value
            try {value={html:await renderReaderNarrativeAsync(raw,rules,runBeautyRegex)}}catch(error){value={html:renderReaderNarrative(raw,[]),error:String(error && typeof error === 'object' && 'message' in error ? error.message : error)}}
            if(cancelled||beautyScopeRef.current!==beautyScope)break
            cache.set(raw,value)
            while(cache.size>500)cache.delete(cache.keys().next().value!)
            refreshBeauty(n=>n+1)
          }
        })()
        return()=>{cancelled=true}
      },[beautyScope,beautyInput])
      const applyBeauty = (raw: string) => beautyCacheRef.current.get(raw)?.html ?? renderReaderNarrative(raw, [])
      const beautyFailed = beautyTasks.some(raw=>beautyCacheRef.current.get(raw)?.error)
      const renderedParts = parts.map((part) => ({
        ...part,
        html: part.kind === 'narrator' ? applyBeauty(part.text) : '',
      }))
      if (state !== null && selectedNodes.length === 0) {
        console.warn('[roleplay-reader] selected surface empty', {
          sessionId,
          allNodeCount: nodes.length,
          surfaceSeqs: [...surfaceSeqs].slice(-12),
          snapshotType: typeof snapshot,
          snapshotKeys: snapshot && typeof snapshot === 'object' ? Object.keys(snapshot).slice(0, 12) : null,
        })
      }
      const docHtml = renderedParts.map((part) => part.kind === 'narrator' ? part.html : part.text).join('\n')
      const committedDocHtml = renderedParts.filter(part=>!part.transient).map(part=>part.kind==='narrator'?part.html:part.text).join('\n')
      const historyBusy = loadingOlder || historySnapshot?.loadingOlder === true
      const canLoadOlder = windowStart > 0 || (!!loadOlder && historySnapshot?.hasMore === true)
      const readerPartKey = (part: ReaderPart) => part.transient ? part.streamKey : `${part.kind}:${part.seq ?? ''}:${part.messageId ?? ''}`
      const renderedHeadKey = renderedParts.length ? readerPartKey(renderedParts[0]!) : null
      // Native history prepends must not push the paragraph under the pointer
      // off-screen. Keep a DOM row anchor, not a scrollHeight approximation:
      // author HTML can change height after the response arrives.
      React.useLayoutEffect(() => {
        const held = historyAnchorRef.current
        const scroller = scrollRef.current
        if (!held || !scroller || held.sessionId !== sessionId) return
        if (held.headKey === renderedHeadKey && held.count === renderedParts.length) return
        const row = Array.from(scroller.querySelectorAll('[data-reader-key]'))
          .find((element) => element.getAttribute('data-reader-key') === held.key)
        if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - held.top
        historyAnchorRef.current = null
      }, [docHtml, renderedHeadKey, renderedParts.length, sessionId])

      const requestOlder = async () => {
        if (!canLoadOlder || historyBusy || historyRequestRef.current) return
        const requestedSessionId = sessionId
        const request = {}
        historyRequestRef.current = request
        setHistoryError(null)
        const scroller = scrollRef.current
        const viewportTop = scroller?.getBoundingClientRect().top ?? 0
        const anchor = scroller && Array.from(scroller.querySelectorAll('[data-reader-key]'))
          .find((element) => element.getBoundingClientRect().bottom > viewportTop + 1)
        historyAnchorRef.current = anchor ? {
          sessionId, key: anchor.getAttribute('data-reader-key'),
          top: anchor.getBoundingClientRect().top - viewportTop,
          headKey: renderedHeadKey, count: renderedParts.length,
        } : null
        setLoadingOlder(true)
        try {
          if (windowStart > 0) {
            setReaderStart(Math.max(0, windowStart - 500))
          } else {
            // A zero local slice offset is not the server's end-of-history.
            // Once paging starts keep the loaded branch window visible.
            setReaderStart(0)
            await loadOlder?.()
          }
        } catch (error) {
          if (readerSessionRef.current !== requestedSessionId) return
          historyAnchorRef.current = null
          setHistoryError(String(error && typeof error === 'object' && 'message' in error ? error.message : error))
        } finally {
          if (historyRequestRef.current === request) {
            historyRequestRef.current = null
            setLoadingOlder(false)
          }
        }
      }
      // Scope the two sheets independently, then append author CSS last so the
      // card can reliably override defaults even when its own CSS is malformed.
      // Cascade layer makes the built-in paper theme a true fallback: even a
      // low-specificity author selector such as `h2 { ... }` wins merely by
      // appearing as unlayered author CSS. Inline styles from the card remain
      // authoritative as usual.
      const scopedCss = '@layer dsh-roleplay-reader-default {\n' +
        scopeReaderCss(READER_BASE_CSS) + '\n}\n' + scopeReaderCss(authorCss)

      // 渲染后：作者 JS（受限 document/window，注册必被卸载）；.f 点击填入输入框委托
      React.useEffect(() => {
        const el = readerRef.current
        if (!el || !sessionId || !isRoleplaySession(sessionId) || state?.sessionId !== sessionId || state?.preset !== 'roleplay') return
        const runtime = createAuthorRuntime(el, fillComposer)
        let cleanup: (() => void) | null = null
        if (authorJs.trim()) {
          try {
            cleanup = runtime.run(authorJs)
          } catch (err) {
            console.warn('[roleplay-reader] author js failed:', err)
          }
        }
        return () => {
          try { cleanup?.() } catch (err) { console.warn('[roleplay-reader] author js cleanup failed:', err) }
          runtime.teardown()
        }
      }, [committedDocHtml, authorJs, sessionId, state?.sessionId, state?.preset])

      // Keep every hook above all exits; otherwise switching between loading,
      // non-roleplay and roleplay states changes the hook count and crashes React.
      if (!sessionId) return null
      if (state === null) {
        return React.createElement('div', { className: 'rp-reader-view' },
          React.createElement('div', { className: 'rp-reader-empty' }, '正在加载阅读视图…'))
      }
      if (state.sessionId !== sessionId || state.preset !== 'roleplay') {
        return React.createElement('div', { className: 'rp-reader-view' },
          React.createElement('div', { className: 'rp-reader-empty' }, '「阅读」视图仅在角色扮演会话中可用'))
      }

      const copyReaderText = async (text: string) => {
        try {
          await navigator.clipboard.writeText(String(text ?? ''))
          toast('已复制')
        } catch { toast('复制失败') }
      }
      const renderReaderActions = (part: ReaderPart) => {
        if (part.transient) return null
        // Reader is a first-class long-lived view, not a passive transcript.
        // Instantiate the roleplay controls directly: some alpha.3 view hosts
        // return an empty-but-non-null slot fragment, which used to suppress the
        // fallback and leave Reader without edit/regenerate/branch controls.
        const extensionActions = part.kind === 'user'
          ? Number.isSafeInteger(part.failedTurn)
            ? React.createElement(AssistantActions, { sessionId, messageId: undefined, turn: part.failedTurn, text: part.text })
            : React.createElement(UserActions, { sessionId, seq: part.seq, text: part.text })
          : React.createElement(AssistantActions, { sessionId, messageId: part.messageId, text: part.text })
        const usage = usageTokens(part.turnMeta?.usage ?? part.usage)
        const meta = [
          usage !== null ? `用量 ${usage.toLocaleString()} tok` : '',
          Number.isFinite(part.turnMeta?.runMs) ? `用时 ${(part.turnMeta!.runMs! / 1000).toFixed(1)} 秒` : '',
          Number.isFinite(part.turnMeta?.tokensPerSecond) ? `${part.turnMeta!.tokensPerSecond.toFixed(1)} tok/s` : '',
          formatReaderTime(part.time),
        ].filter(Boolean).join(' · ')
        return React.createElement('div', { className: 'rp-reader-actions' },
          actionIconButton('复制', ICONS.copy, () => copyReaderText(part.text)),
          extensionActions,
          meta ? React.createElement('span', { className: 'rp-reader-meta' }, meta) : null
        )
      }

      return React.createElement('div', {
        className: 'rp-reader-view',
        ref: scrollRef,
        onScroll: (event) => {
          if (event.currentTarget.scrollTop < 140 && !historyError) void requestOlder()
        },
        onWheel: (event) => {
          // At the very top a wheel gesture need not emit `scroll` at all.
          if (event.deltaY < 0 && event.currentTarget.scrollTop < 140 && !historyError) void requestOlder()
        },
      },
        React.createElement('style', null, scopedCss+ACTIVITY_CSS),
        beautyFailed ? React.createElement('div',{className:'rp-reader-empty',role:'status'},'部分美化规则未能安全完成，已保留完整正文。修改规则后会重新匹配。') : null,
        canLoadOlder || historyBusy || historyError
          ? React.createElement('div', { className: 'rp-reader-history', role: 'status', 'aria-live': 'polite' },
              React.createElement('button', { type: 'button', className: 'rp-reader-load-older', onClick: requestOlder, disabled: historyBusy },
                historyBusy ? React.createElement('span', { className: 'rp-reader-spinner', 'aria-hidden': 'true' }) : null,
                historyBusy ? '正在加载更早剧情…' : historyError ? '加载失败，点击重试' : '加载更早剧情'))
          : null,
        loadError ? React.createElement('div', { className: 'rp-reader-empty' }, '阅读器加载失败：' + loadError) : null,
        !loadError && state !== null && selectedNodes.length === 0
          ? React.createElement('div', { className: 'rp-reader-empty' }, '暂无可阅读的正文')
          : null,
        React.createElement('div', {
          className: 'rp-reader',
          ref: readerRef,
          onClick: (event) => {
            const f = event.target && typeof (event.target as Element).closest === 'function' ? (event.target as Element).closest<HTMLElement>('.f') : null
            if (f) {
              event.preventDefault()
              event.stopPropagation()
              fillComposer(f.innerText || f.textContent || '')
            }
          },
        }, renderedParts.map((part, index) => React.createElement('section', {
          className: 'rp-reader-message',
          'data-kind': part.kind === 'user' ? 'user' : 'assistant',
          'data-reader-key': readerPartKey(part),
          key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ''}`,
        },
          part.kind === 'user'
            ? React.createElement('p', { className: 'rp-user-line' }, '◈ 你：' + part.text)
            : React.createElement('div', { className: 'rp-reader-narrative', dangerouslySetInnerHTML: { __html: part.html } }),
          renderReaderActions(part)
        ))),
        pendingPlayerBubble(activity,nodes),
        React.createElement(ActivityBanner,{activity})
      )
    }


  return ReaderView
}
