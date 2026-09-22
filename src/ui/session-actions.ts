import type {ConversationCatalog} from './conversation-projection.js'

interface ActionError extends Error {status?: number; payload?: unknown; operationStateUnknown?: boolean; safeToAbort?: boolean}
const errorDetails = (value: unknown): Partial<ActionError> => value && typeof value === 'object' ? value : {}
interface SaveReply extends Record<string, unknown> {ok?: boolean; error?: string}
interface SetReply extends SaveReply {recordVersions:Record<string,unknown> & {cards?:Record<string,unknown>;worldbook?:Record<string,unknown>}}
interface BranchRequest<A extends string> extends Record<string, unknown> {action: A; childSessionId?: string; sessionId?: string}
interface BranchResult extends SaveReply {
  conversations?: ConversationCatalog
  status?: string
  registered?: boolean
  requestAccepted?: boolean
  alreadyAccepted?: boolean
  nextSessionId?: string
}
type BranchReply<A extends string> = BranchResult & (A extends 'prepare' ? {operationId: string;
     promptText: string} : A extends 'create-worldline' ? {childSessionId: string} : {})
interface Registration {operationId: string; childSessionId: string; requestId?: string; promptText: string}
interface MaintenanceJob {id: string; state: string; error?: string}
type RemoteResult<T> = {ok: true; value: T; error?: never} | {ok?: false; value?: never; error?: {code?: string; message?: string}}
interface Selection {provider?: string; model?: string; reasoningEffort?: string}
interface Submission {requestId: string; abandon(): void}
interface SessionBinding {
  session: {
    loadOlder(): Promise<void>
    getSnapshot?(): {running?: boolean}
    projections?: {faceOf?(key: string): {getSnapshot?(): Selection & {next?: Selection; selected?: Selection}} | undefined}
    beginSubmission(input: {mode: 'queue'; text: string; attachments: unknown[]}): Submission
    prompt(blocks: {type: 'text'; text: string}[], mode: 'queue', images: undefined, requestId: string): Promise<RemoteResult<unknown>>
  }
}
interface SessionService {
  using<T>(id: string, options: {source: 'nexttavernAction' | 'nexttavernState' | 'nexttavernReader'}, operation: (reference: {binding: SessionBinding}) => T | Promise<T>): Promise<T>
  refresh(): unknown | PromiseLike<unknown>
  list?: {getSnapshot?(): {byId?: Record<string, {cwd?: string}>}}
}
interface ActionDependencies {
  sessionsService: SessionService
  openSession(id: string): void
  workspacesService?: {list?: {getSnapshot?(): {items?: {sessionIds?: string[]; workspaceId?: string}[]}}} | null
  remoteSession?: {
    create?(input: {agentPreset: string; workspaceId?: string; cwd?: string}): Promise<RemoteResult<{agentPreset?: string; sessionId: string}>>
    selectModel?(input: {sessionId: string; provider: string; model: string; reasoningEffort?: string}): Promise<RemoteResult<unknown>>
  } | null
  resolveActiveSessionId(): string | null
  isRoleplaySession(id: string): boolean
  wakeSessionForState(id: string): Promise<boolean>
  invalidateState(id: string): void
  acceptConversations(value: ConversationCatalog): void
  loadConversations(): Promise<unknown>
  toast(text: string): void
  fetch?: typeof globalThis.fetch
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>
  now?(): number
  wait?(ms: number): Promise<void>
}

export function createRoleplayActions({sessionsService,
    openSession,
    workspacesService,
    remoteSession,
    resolveActiveSessionId,
    isRoleplaySession,
    wakeSessionForState,
    invalidateState,
    acceptConversations,
    loadConversations,
    toast,
    fetch=globalThis.fetch,
    storage,
    now=Date.now,
    wait=ms=>new Promise(resolve=>setTimeout(resolve,
    ms))}: ActionDependencies) {
  // Resolve storage lazily: browser privacy settings may throw on access.
  const localStorage = {
    getItem:(key: string)=>(storage ?? globalThis.localStorage).getItem(key),
    setItem:(key: string,value: string)=>(storage ?? globalThis.localStorage).setItem(key,value),
    key:(index: number)=>(storage ?? globalThis.localStorage).key(index),
    get length(){return (storage ?? globalThis.localStorage).length},
  }
  const saveState = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/roleplay/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data: SetReply = await res.json()
    if (!data.ok) throw new Error(data.error ?? '保存失败')
    return data
  }

  const branchRequest = async <A extends string>(body: BranchRequest<A>): Promise<BranchReply<A>> => {
    // The branch route belongs to the per-Agent roleplay preset. A freshly
    // created/forked Session may exist in the client list before that preset is
    // mounted, which previously turned register into a plain proxy 404.
    const wakeTarget = String(body?.childSessionId ?? body?.sessionId ?? resolveActiveSessionId() ?? '')
    if (wakeTarget) await wakeSessionForState(wakeTarget)
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch('/api/roleplay/branch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await res.text()
      let data: BranchReply<A> | null = null
      try { data = raw ? JSON.parse(raw) : null } catch {}
      // Retry only a route-level/plain-text 404. A JSON 404 is a durable
      // business result (missing operation/member) and must be shown as-is.
      if (res.status === 404 && data === null && attempt === 0 && wakeTarget) {
        await wakeSessionForState(wakeTarget)
        await wait(220)
        continue
      }
      if (!res.ok || !data?.ok) {
        const detail = data?.error ?? raw.trim().replace(/\s+/g, ' ').slice(0, 160)
        const error: ActionError = new Error(detail || `分支请求失败（HTTP ${res.status}）`)
        error.status = res.status
        error.payload = data
        throw error
      }
      if(data.conversations)acceptConversations(data.conversations)
      return data
    }
    throw new Error('分支接口在唤醒会话后仍不可用')
  }

  const delay = wait

  const runMaintenance = async (sessionId: string, action: string) => {
    const request = async (nextAction: string) => {
      const response = await fetch('/api/roleplay/maintenance', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, action: nextAction }),
      })
      const data: {ok?: boolean; error?: string; job?: MaintenanceJob} = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data.job
    }
    let job = await request(action)
    const jobId = job?.id
    const deadline = now() + 15 * 60 * 1000
    while (['running','waiting-main'].some(state=>state === job?.state) && now() < deadline) {
      await delay(1200)
      job = await request('status')
      if (!job || job.id !== jobId) throw new Error('维护任务状态已变化，请刷新检查')
    }
    if (job?.state !== 'completed') throw new Error(job?.error || '后台整理仍在进行，请稍后刷新')
    invalidateState(sessionId)
    return job
  }

  const registerBranchOperation = async (payload: Registration) => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await branchRequest({ action: 'register', ...payload })
      } catch (error) {
        lastError = error
        // Identity/validation conflicts are durable business failures. Network
        // errors and 5xx responses may merely mean the committed response was
        // lost, so retry the exact operationId+requestId idempotently.
        if (Number.isFinite(errorDetails(error).status) && Number(errorDetails(error).status) < 500) throw error
        await delay(250 * (attempt + 1))
      }
    }
    try {
      const status = await branchRequest({ action: 'operation-status', operationId: payload.operationId })
      if (status.status === 'completed' || (status.status === 'pending' && status.registered === true)) {
        return { ok: true, recovered: true, ...status }
      }
      if (status.status === 'failed') throw new Error(status.error || '分支登记失败')
    } catch (statusError) {
      if (Number.isFinite(errorDetails(statusError).status) && Number(errorDetails(statusError).status) < 500) throw statusError
    }
    const error = (lastError ?? new Error('无法确认分支登记状态')) as ActionError
    error.operationStateUnknown = true
    throw error
  }

  const retryBranchMutation = async (body: BranchRequest<string>, attempts = 4) => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { return await branchRequest(body) } catch (error) {
        lastError = error
        if (Number.isFinite(errorDetails(error).status) && Number(errorDetails(error).status) < 500) throw error
        if (attempt + 1 < attempts) await delay(250 * (attempt + 1))
      }
    }
    throw lastError ?? new Error('分支操作失败')
  }

  const remoteFailure = (label: string, result: RemoteResult<unknown> | null | undefined) => {
    const code = result?.error?.code ? `${result.error.code}: ` : ''
    return new Error(label + '：' + code + String(result?.error?.message ?? '未知远端错误'))
  }

  // Each asynchronous action owns its exact generation until settlement.
  // A navigation change must not dispose the source or child mid-submission.
  const withSession = <T>(sessionId: string, operation: (binding: SessionBinding) => Promise<T>) =>
    sessionsService.using(sessionId, {source: 'nexttavernAction'}, reference => operation(reference.binding))

  const repairActiveConversationDraft = () => {
    const sessionId = resolveActiveSessionId()
    const keys = new Set<string>()
    if (sessionId && isRoleplaySession(sessionId)) keys.add(`dsh.conversation.${sessionId}`)
    // The catalog can arrive after the native shell reads persisted state.
    // Repair our old view-only records before that read, retaining every valid
    // draft and touching only the conversation persistence namespace.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('dsh.conversation.')) keys.add(key)
      }
    } catch {}
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (value && typeof value.view === 'string' && typeof value.draft !== 'string') {
          localStorage.setItem(key, JSON.stringify({ ...value, draft: '' }))
        }
      } catch {}
    }
  }
  repairActiveConversationDraft()

  const openSessionPreservingView = async (targetSessionId: string, sourceSessionId = resolveActiveSessionId()) => {
    // View preference is persisted per Session. Copy only the selected view so
    // branch navigation from Reader remains in Reader without copying drafts.
    if (sourceSessionId && targetSessionId && sourceSessionId !== targetSessionId) {
      try {
        const sourceKey = `dsh.conversation.${sourceSessionId}`
        const targetKey = `dsh.conversation.${targetSessionId}`
        const source = JSON.parse(localStorage.getItem(sourceKey) ?? 'null')
        if (source && typeof source.view === 'string') {
          const target = JSON.parse(localStorage.getItem(targetKey) ?? '{}')
          localStorage.setItem(targetKey, JSON.stringify({ ...target,
            draft: typeof target?.draft === 'string' ? target.draft : '',
            view: source.view, viewRequest: null }))
        }
      } catch {}
    }
    const selected=await branchRequest({action:'select-worldline',sessionId:targetSessionId})
    if(selected.conversations)acceptConversations(selected.conversations)
    openSession(targetSessionId)
  }

  const workspaceIdForSession = (sessionId: string) => {
    try {
      const items = workspacesService?.list?.getSnapshot?.()?.items ?? []
      return items.find((workspace) =>
        Array.isArray(workspace?.sessionIds) && workspace.sessionIds.includes(sessionId))?.workspaceId
    } catch {
      return undefined
    }
  }

  const copyModelSelection = async (sourceBinding: SessionBinding, childId: string) => {
    try {
      const projected = sourceBinding?.session?.projections?.faceOf?.('modelSelection')?.getSnapshot?.()
      const selection = projected?.next ?? projected?.selected ?? projected
      if (!selection?.provider || !selection?.model || !remoteSession?.selectModel) return
      const result = await remoteSession.selectModel({
        sessionId: childId,
        provider: selection.provider,
        model: selection.model,
        ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}),
      })
      if (!result?.ok) toast('新分支已创建，但模型选择未能继承：' + String(result?.error?.message ?? '未知错误'))
    } catch (error) {
      toast('新分支已创建，但模型选择未能继承：' + String(errorDetails(error).message ?? error))
    }
  }

  const createFirstTurnBranch = async (sourceSessionId: string) => withSession(sourceSessionId, async sourceBinding => {
    if (!remoteSession?.create) throw new Error('会话创建服务尚未就绪')
    const sourceRow = sessionsService?.list?.getSnapshot?.()?.byId?.[sourceSessionId]
    const workspaceId = workspaceIdForSession(sourceSessionId)
    const request = workspaceId
      ? { workspaceId, agentPreset: 'roleplay' }
      : { ...(sourceRow?.cwd ? { cwd: sourceRow.cwd } : {}), agentPreset: 'roleplay' }
    const created = await remoteSession.create(request)
    if (!created?.ok) throw remoteFailure('创建首轮分支失败', created)
    if (created.value?.agentPreset && created.value.agentPreset !== 'roleplay') {
      throw new Error(`新分支 preset 异常：${created.value.agentPreset}`)
    }
    const childId = created.value.sessionId
    await sessionsService?.refresh?.()
    await copyModelSelection(sourceBinding, childId)
    return { childId }
  })

  const waitForBranchOperation = async (operationId: string,
       timeoutMs = 15 * 60 * 1000,
       options: {requireRequestAdmission?: boolean;
       admissionGraceMs?: number} = {}) => {
    const deadline = now() + timeoutMs
    let transientFailures = 0
    let notAcceptedSince: number | null = null
    while (now() < deadline) {
      let result: BranchReply<string> | undefined
      try {
        result = await branchRequest({ action: 'operation-status', operationId })
        transientFailures = 0
      } catch (error) {
        // A short reconnect must not turn a successfully admitted generation into a
        // deleted branch. Only surface the error after several consecutive polls.
        transientFailures += 1
        if (transientFailures >= 5) throw error
      }
      if (result?.status === 'completed') return result
      if (result?.status === 'failed') throw new Error(result.error || '分支生成失败')
      if (options.requireRequestAdmission && result?.registered === true && result?.requestAccepted === false) {
        if (notAcceptedSince === null) notAcceptedSince = now()
        if (now() - notAcceptedSince >= Number(options.admissionGraceMs ?? 15000)) {
          const error: ActionError = new Error('发送请求未进入新分支；已安全停止等待')
          error.safeToAbort = true
          throw error
        }
      } else {
        notAcceptedSince = null
      }
      await delay(900)
    }
    throw new Error('等待分支生成完成超时；分支仍保留为待处理状态，可稍后切换回来查看')
  }

  const replaceMessage = async ({ sessionId,
       role,
       seq,
       messageId,
       text }: {sessionId: string;
       text: string} & ({role: 'user';
       seq: number;
       messageId?: string} | {role: 'assistant';
       seq?: number;
       messageId: string})) => {
    const result = await retryBranchMutation({
      action: 'replace-message', sessionId, role, seq, messageId, text,
    })
    invalidateState(sessionId)
    return result
  }

  const forkAndPrompt = async ({ sourceSessionId,
       messageId,
       userSeq,
       kind,
       editedText }: {sourceSessionId: string;
       messageId?: string;
       userSeq?: number;
       kind: string;
       editedText?: string | null}) => {
    const prepared = await branchRequest({
      action: 'prepare', sessionId: sourceSessionId, messageId, userSeq, kind,
    })
    let promptText: string | null | undefined = prepared.promptText
    if (kind === 'player-edit') {
      promptText = editedText
      if (promptText === null || promptText === undefined) return null
      promptText = String(promptText).trim()
      if (!promptText) throw new Error('消息不能为空')
    }

    return withSession(sourceSessionId, async sourceBinding => {
      if (sourceBinding?.session?.getSnapshot?.()?.running) throw new Error('请等待当前一轮完成后再创建分支')
      const created=await branchRequest({action:'create-worldline',operationId:prepared.operationId,sessionId:sourceSessionId})
      const childId=created.childSessionId
      if(created.conversations)acceptConversations(created.conversations)
      await sessionsService.refresh()
      await loadConversations()
      return withSession(childId, async childBinding => {
        await copyModelSelection(sourceBinding,childId)

        const submission = childBinding.session.beginSubmission({ mode: 'queue', text: promptText, attachments: [] })
        try {
          await wakeSessionForState(childId)
          await registerBranchOperation({
            operationId: prepared.operationId,
            childSessionId: childId,
            requestId: submission.requestId,
            promptText,
          })
        } catch (error) {
          submission.abandon()
          // Abort only when registration is known not to be in an indeterminate
          // committed state. A lost response must never delete a valid member.
          if (!errorDetails(error).operationStateUnknown) {
            try { await branchRequest({ action: 'abort', operationId: prepared.operationId }) } catch {}
          }
          await openSessionPreservingView(sourceSessionId, childId)
          throw error
        }
        invalidateState(sourceSessionId)
        invalidateState(childId)
        await openSessionPreservingView(childId, sourceSessionId)

        let result
        try {
          result = await childBinding.session.prompt(
            [{ type: 'text', text: promptText }],
            'queue',
            undefined,
            submission.requestId
          )
        } catch (error) {
          // A transport exception does not prove commands/prompt was rejected: the
          // server may already be generating. Observe the durable requestId-linked
          // operation first; only an explicit no-admission timeout is safe to abort.
          try {
            await waitForBranchOperation(prepared.operationId, 15 * 60 * 1000, {
              requireRequestAdmission: true,
              admissionGraceMs: 15000,
            })
            invalidateState(sourceSessionId)
            invalidateState(childId)
            return childId
          } catch (observedError) {
            if (errorDetails(observedError).safeToAbort) {
              let abortResult = null
              try { abortResult = await branchRequest({ action: 'abort', operationId: prepared.operationId }) } catch {}
              if (abortResult?.alreadyAccepted) {
                try {
                  await waitForBranchOperation(prepared.operationId)
                  invalidateState(sourceSessionId)
                  invalidateState(childId)
                  return childId
                } catch (acceptedError) {
                  await openSessionPreservingView(sourceSessionId, childId)
                  throw new Error('发送已被服务器接纳，但未能确认最终结果：' + String(errorDetails(acceptedError).message ?? acceptedError))
                }
              }
              submission.abandon()
            }
            await openSessionPreservingView(sourceSessionId, childId)
            if (errorDetails(observedError).safeToAbort) throw observedError
            throw new Error(`${String(errorDetails(error).message ?? error)}；且未能确认分支最终状态：${String(errorDetails(observedError).message ?? observedError)}`)
          }
        }
        if (!result?.ok) {
          try { await branchRequest({ action: 'abort', operationId: prepared.operationId }) } catch {}
          await openSessionPreservingView(sourceSessionId, childId)
          throw remoteFailure(kind === 'player-edit' ? '修改后发送失败' : '重新生成失败', result)
        }
        try {
          await waitForBranchOperation(prepared.operationId)
        } finally {
          invalidateState(sourceSessionId)
          invalidateState(childId)
        }
        return childId
      })
    })
  }

  const forkWithoutUserTurn = async ({ sourceSessionId, messageId }: {sourceSessionId: string; messageId?: string}) => {
    const prepared = await branchRequest({
      action: 'prepare', sessionId: sourceSessionId, messageId, kind: 'delete-user',
    })
    const created=await branchRequest({action:'create-worldline',operationId:prepared.operationId,sessionId:sourceSessionId})
    const childId=created.childSessionId
    if(created.conversations)acceptConversations(created.conversations)
    await sessionsService.refresh()
    await loadConversations()
    await registerBranchOperation({
      operationId: prepared.operationId,
      childSessionId: childId,
      promptText: '',
    })
    invalidateState(sourceSessionId)
    invalidateState(childId)
    await openSessionPreservingView(childId, sourceSessionId)
    return childId
  }

  const openNativeBranch = async (member: {sessionId?: string} | null | undefined) => {
    if (!member?.sessionId) return
    await openSessionPreservingView(member.sessionId)
  }


  return {saveState,
      branchRequest,
      runMaintenance,
      registerBranchOperation,
      retryBranchMutation,
      repairActiveConversationDraft,
      openSessionPreservingView,
      createFirstTurnBranch,
      waitForBranchOperation,
      replaceMessage,
      forkAndPrompt,
      forkWithoutUserTurn,
      openNativeBranch}
}
