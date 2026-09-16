import { randomUUID } from 'node:crypto'
import { keyOf, durableSeq, sha256, recordSha256 } from './roleplay-data.js'
import { surfaceEvents } from './roleplay-context.js'
import { jsonResponse } from './roleplay-state.js'
import type { BranchRouteSession, StoredBranchOperation, BranchRouteBody, BranchRouteError, ForkReservation, BranchRoutesDependencies } from './roleplay-branch-routes-types.js'

export function registerBranchRoutes({ctx, T, resolveRoleplaySession, cloneBranchRecord, assertStoryBranchActive, withForkMutationLock, forkOperationKey, reconcileCanonicalPlayerVariants, buildForkLookupIndex, userForkContext, locatePlayerRecoveryTarget, assistantMessageId, forkPointerFor, hydrateForkGroup, forkGroupKey, groupMemberForSession, locateForkTarget, bootstrapChildBranch, registerRecoveryFork, registerNativeFork, forkAnchorLockKey, requestUserEvent, forkPendingKey, reconcileNativeFork, replaceAssistantText, replaceUserText}: BranchRoutesDependencies) {
  const readOperation=(key: string)=>cloneBranchRecord(T.branch.get(key)) as StoredBranchOperation | undefined
  const updateOperation=(key: string,work: (current: StoredBranchOperation | undefined) => object)=>T.branch.update(key,current=>work(current as StoredBranchOperation | undefined)) as PromiseLike<StoredBranchOperation>
  async function publishWorldlineSelection(operation: StoredBranchOperation,child: BranchRouteSession) {
    const catalog=ctx.get('tavernConversations')
    if(!catalog)return null // Compatibility for non-web fixtures/older hosts.
    await catalog.ready
    await catalog.reserve({sourceSessionId:operation.anchor.sourceSessionId,childSessionId:child.id,operationId:operation.operationId,kind:operation.kind,sourceHash:recordSha256(operation.anchor)})
    return catalog.markReady(child.id)
  }
  async function failWorldlineCatalog(operation: StoredBranchOperation) {
    const catalog=ctx.get('tavernConversations'),childId=operation.reservedChildSessionId??operation.childSessionId
    if(!catalog||!childId)return null
    await catalog.ready
    return catalog.fail(childId,operation.operationId)
  }
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/branch',
        methods: ['POST'],
        fetch: async (request) => {
          try {
            const body = await request.json() as BranchRouteBody
            const action = String(body?.action ?? '')
            if(action==='select-worldline') {
              const session=await resolveRoleplaySession(body.sessionId),catalog=ctx.get('tavernConversations')
              if(!session||!catalog)return jsonResponse(404,{ok:false,error:'酒馆会话尚未就绪'})
              assertStoryBranchActive(session)
              await catalog.ready
              return jsonResponse(200,{ok:true,conversations:await catalog.activate(session.id),executionSessionId:session.id})
            }
            if(action==='create-worldline')return await withForkMutationLock(`operation:${body.operationId}`,async()=>{
              const operationKey=forkOperationKey(body.operationId),operation=readOperation(operationKey)
              const catalog=ctx.get('tavernConversations')
              if(!operation||!catalog)return jsonResponse(404,{ok:false,error:'世界线操作或酒馆会话目录不存在'})
              if(operation.state==='failed'||operation.state==='aborted'||operation.abortedAt||Date.now()>operation.expiresAt)throw new Error('世界线操作已经失效，请重新发起')
              const source=await resolveRoleplaySession(operation.anchor.sourceSessionId)
              if(!source)throw new Error('源角色扮演会话不可用')
              assertStoryBranchActive(source)
              await catalog.ready
              const failReservation=async(childId: string | null)=>{
                if(childId)await catalog.fail(childId,operation.operationId)
                await T.branch.put(operationKey,{...readOperation(operationKey),state:'failed',failureReason:'世界线创建失败，请重新发起',failedAt:Date.now()})
              }
              const lookupReserved=async(childId: string)=>{
                if(ctx.sessions.get(childId))return ctx.sessions.get(childId)
                const found=await ctx.sessionController.resolveAgent(childId)
                if(found?.error&&found.error.code!=='session/not-found')throw found.error
                return found?.agent?.session??ctx.sessions.get(childId)??null
              }
              if(operation.reservedChildSessionId) {
                const existing=await lookupReserved(operation.reservedChildSessionId)
                if(existing)return jsonResponse(200,{ok:true,childSessionId:existing.id,conversations:catalog.snapshot()})
                await failReservation(operation.reservedChildSessionId)
                throw new Error('世界线创建已失效，请重新发起')
              }
              const active=await ctx.sessionController.resolveAgent(source.id)
              if(active?.agent?.status&&active.agent.status!=='idle')throw new Error('请等待当前轮次完成后再切换世界线')
              let reservedId: string | null=null,reservationCommitted=false
              const reserve=async({sourceSessionId,childSessionId,seedLength}: ForkReservation)=>{
                if(sourceSessionId!==source.id)throw new Error('原生分支来源不匹配')
                reservedId=childSessionId
                await catalog.reserve({sourceSessionId,childSessionId,operationId:operation.operationId,kind:operation.kind,sourceHash:recordSha256(operation.anchor)})
                await T.branch.put(operationKey,{...operation,reservedChildSessionId:childSessionId,presentation:{schemaVersion:1,kind:'worldline',conversationId:catalog.rootOf(source.id),sourceSessionId,seedLength},reservedAt:Date.now()})
                reservationCommitted=true
              }
              let created
              try {
              if(operation.anchor.previousTurnEndSeq==null) {
                const childSessionId=`session-${randomUUID()}`
                await reserve({sourceSessionId:source.id,childSessionId,seedLength:0})
                created=await ctx.sessionController.create({sessionId:childSessionId,...(source.header?.cwd?{cwd:source.header.cwd}:{}),agentPreset:'roleplay'})
              } else {
                if(typeof ctx.sessionController.forkPrepared!=='function')throw new Error('原生世界线创建支持尚未安装，请刷新或联系维护者')
                created=await ctx.sessionController.forkPrepared({sessionId:source.id,atSeq:operation.anchor.previousTurnEndSeq},reserve)
              }
              if(!created?.sessionId)throw new Error('原生会话未返回世界线标识')
              } catch(error) {
                // A callback rejection precedes native publication. After native
                // creation, preserve a real child so attach failures can resume.
                if(!reservationCommitted||!reservedId||!await lookupReserved(reservedId))await failReservation(reservedId)
                throw error
              }
              return jsonResponse(200,{ok:true,childSessionId:created.sessionId,conversations:catalog.snapshot()})
            })
            if (action === 'prepare') {
              const source = await resolveRoleplaySession(body?.sessionId)
              if (!source) return jsonResponse(404, { ok: false, error: '角色扮演源会话不存在或无法恢复' })
              await reconcileCanonicalPlayerVariants(source, buildForkLookupIndex(source))
              const kind = body?.kind === 'player-edit' || body?.kind === 'edit'
                ? 'player-edit'
                : body?.kind === 'delete-user'
                  ? 'delete-user'
                  : 'regenerate'
              let requestedMessageId = String(body?.messageId ?? '')
              if (!requestedMessageId && kind === 'regenerate' && durableSeq(body?.userSeq) === null) {
                // A terminal turn-error has no assistant message id. Resolve
                // the newest incomplete player turn as the recovery target.
                const surface = surfaceEvents(source)
                for (let index = surface.length - 1; index >= 0; index -= 1) {
                  const candidate = surface[index]
                  if (candidate?.type !== 'user/message' || candidate.data?.source?.kind !== 'user') continue
                  const context = userForkContext(source, Number(candidate.seq))
                  if (locatePlayerRecoveryTarget(source, Number(candidate.seq))) {
                    body.userSeq = Number(candidate.seq)
                    break
                  }
                }
              }
              if (!requestedMessageId && (kind === 'player-edit' || kind === 'regenerate')) {
                const requestedUserSeq = durableSeq(body?.userSeq)
                if (requestedUserSeq === null) {
                  return jsonResponse(400, { ok: false, error: '缺少玩家消息 seq，无法恢复失败轮次' })
                }
                const playerContext = userForkContext(source, requestedUserSeq)
                const recovery = locatePlayerRecoveryTarget(source, requestedUserSeq)
                requestedMessageId = recovery ? '' : assistantMessageId(playerContext.followingAssistant)
                if (recovery) {
                  // Failed/incomplete turns have no assistant anchor.  Keep the
                  // operation valid by using a synthetic player recovery anchor;
                  // register will create a clean child and replay the prompt.
                  const operationId = randomUUID()
                  const operation = {
                    schemaVersion: 1,
                    operationId,
                    kind,
                    anchor: recovery,
                    promptText: recovery.promptText,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 15 * 60 * 1000,
                    consumed: false,
                  }
                  await T.branch.put(forkOperationKey(operationId), operation)
                  return jsonResponse(200, {
                    ok: true,
                    operationId,
                    kind,
                    promptText: recovery.promptText,
                    previousTurnEndSeq: recovery.previousTurnEndSeq,
                    sourceTurn: recovery.sourceTurn,
                    recoveryOnly: true,
                  })
                }
              }
              if (!requestedMessageId) {
                return jsonResponse(400, { ok: false, error: '缺少 Agent 回复锚点' })
              }
              const existingPointer = forkPointerFor(source, requestedMessageId)
              const existingGroup = existingPointer?.groupId
                ? hydrateForkGroup(T.branch.get(forkGroupKey(existingPointer.groupId)))
                : null
              const exactMember = existingGroup?.members?.find((member) =>
                member.sessionId === source.id && member.assistantMessageId === requestedMessageId)
              const nearestMember = groupMemberForSession(existingGroup, source, requestedMessageId, { includeDeleted: true })
              if (exactMember?.deleted || (!exactMember && nearestMember?.deleted)) {
                return jsonResponse(409, { ok: false, error: '这个回复版本已经删除；请切换到仍然活动的分支' })
              }
              const anchor = locateForkTarget(source, requestedMessageId)
              const operationId = randomUUID()
              const operation = {
                schemaVersion: 1,
                operationId,
                kind,
                anchor,
                promptText: anchor.promptText,
                createdAt: Date.now(),
                expiresAt: Date.now() + 15 * 60 * 1000,
                consumed: false,
              }
              await T.branch.put(forkOperationKey(operationId), operation)
              return jsonResponse(200, {
                ok: true,
                operationId,
                kind,
                promptText: anchor.promptText,
                previousTurnEndSeq: anchor.previousTurnEndSeq,
                sourceTurn: anchor.sourceTurn,
              })
            }

            if (action === 'register') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, { ok: false, error: '缺少分支操作 operationId' })
              return await withForkMutationLock(`operation:${operationId}`, async () => {
              const operationKey = forkOperationKey(operationId)
              const initial = readOperation(operationKey)
              if (!initial) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期，请重试' })
              const child = await resolveRoleplaySession(body?.childSessionId)
              if (!child) return jsonResponse(404, { ok: false, error: '新分支会话尚未在服务器就绪' })
              if(initial.reservedChildSessionId&&initial.reservedChildSessionId!==child.id)return jsonResponse(409,{ok:false,error:'世界线与预留会话标识不匹配'})
              const promptText = String(body?.promptText ?? '').trim()
              const requestId = initial.kind === 'delete-user' ? '' : String(body?.requestId ?? '').trim()
              if (initial.kind !== 'delete-user' && (!requestId || requestId.length > 256 || /[\u0000-\u001f]/.test(requestId))) {
                return jsonResponse(400, { ok: false, error: '缺少或无效的分支请求 requestId' })
              }
              if (!promptText && initial.kind !== 'delete-user') return jsonResponse(400, { ok: false, error: '修改后的消息不能为空' })
              if (promptText.length > 1_000_000) return jsonResponse(413, { ok: false, error: '消息超过 1,000,000 字符' })
              if (initial.kind === 'regenerate' && promptText !== initial.anchor.promptText) {
                return jsonResponse(409, { ok: false, error: '重新生成必须复用原玩家消息；需要修改请使用编辑按钮' })
              }
              const promptSha256 = sha256(promptText)
              let operation
              try {
                operation = await updateOperation(operationKey, (current) => {
                  const record = cloneBranchRecord(current)
                  if (!record) throw new Error('分支操作不存在')
                  const state = record.state ?? (record.consumed ? 'registered' : 'prepared')
                  if (state === 'aborted') throw new Error('分支操作已被客户端撤销')
                  if (state === 'failed') throw new Error(record.failureReason || '分支操作已经失败，请重新发起')
                  const sameIdentity =
                    String(record.childSessionId ?? '') === child.id &&
                    String(record.requestId ?? '') === requestId &&
                    String(record.promptSha256 ?? sha256(String(record.promptText ?? '').trim())) === promptSha256
                  if (state === 'registering' || state === 'registered') {
                    if (!sameIdentity) throw new Error('同一分支操作已由不同的会话或请求占用')
                    return record
                  }
                  if (Number(record.expiresAt) < Date.now()) throw new Error('分支操作已过期，请重试')
                  return {
                    ...record,
                    state: 'registering',
                    childSessionId: child.id,
                    requestId,
                    promptText,
                    promptSha256,
                    registeringAt: Date.now(),
                  }
                })
              } catch (error) {
                return jsonResponse(409, { ok: false, error: String((error as BranchRouteError | null)?.message ?? error) })
              }

              if ((operation.state ?? (operation.consumed ? 'registered' : 'prepared')) === 'registered') {
                return jsonResponse(200, { ok: true, ...(operation.registration ?? {}), promptText: operation.promptText,conversations:await publishWorldlineSelection(operation,child) })
              }

              if (operation.kind === 'delete-user') {
                try {
                  await bootstrapChildBranch(operation, child)
                  const metaKey = keyOf(child.id, 'meta')
                  await T.branch.put(metaKey, {
                    ...(T.branch.get(metaKey) as object | null | undefined ?? { createdAt: Date.now() }),
                    truncatedFrom: operation.anchor.sourceSessionId,
                    deletedUserMessageId: operation.anchor.sourceUserMessageId,
                    deletedFromTurn: operation.anchor.sourceTurn,
                    updatedAt: Date.now(),
                  })
                  const registration = { truncated: true, childSessionId: child.id }
                  operation = await updateOperation(operationKey, (current) => ({
                    ...cloneBranchRecord(current),
                    state: 'registered',
                    consumed: true,
                    childSessionId: child.id,
                    registration,
                    registeredAt: Date.now(),
                  }))
                  return jsonResponse(200, { ok: true, ...registration,conversations:await publishWorldlineSelection(operation,child) })
                } catch (error) {
                  try {
                    await updateOperation(operationKey, (current) => ({
                      ...cloneBranchRecord(current), state: 'failed', failedAt: Date.now(),
                      failureReason: String((error as BranchRouteError | null)?.message ?? error).slice(0, 500),
                    }))
                  } catch {}
                  await failWorldlineCatalog(operation)
                  throw error
                }
              }
              let registration: Awaited<ReturnType<typeof registerNativeFork>>
              try {
                registration = operation.anchor?.recoveryOnly
                  ? await registerRecoveryFork(operation, child)
                  : await registerNativeFork(operation, child)
                operation = await updateOperation(operationKey, (current) => {
                  const record = cloneBranchRecord(current)
                  if (String(record?.childSessionId ?? '') !== child.id || String(record?.requestId ?? '') !== requestId) {
                    throw new Error('分支操作登记身份在提交期间发生变化')
                  }
                  return {
                    ...record,
                    state: 'registered',
                    registration,
                    consumed: true,
                    childSessionId: child.id,
                    groupId: registration!.groupId,
                    ordinal: registration!.ordinal,
                    registeredAt: Date.now(),
                  }
                })
              } catch (error) {
                // Leave a durable failure marker so a dropped response or a
                // service restart cannot make the same operation look fresh;
                // remove only the exact pending member when one was created.
                try {
                  await updateOperation(operationKey, (current) => ({
                    ...cloneBranchRecord(current), state: 'failed', failedAt: Date.now(),
                    failureReason: String((error as BranchRouteError | null)?.message ?? error).slice(0, 500),
                  }))
                } catch {}
                await failWorldlineCatalog(operation)
                throw error
              }
              return jsonResponse(200, { ok: true, ...registration, promptText,conversations:await publishWorldlineSelection(operation,child) })
              })
            }

            if (action === 'abort') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, { ok: false, error: '缺少分支操作 operationId' })
              return jsonResponse(200, await withForkMutationLock(`operation:${operationId}`, async () => {
                const loadedOperation = readOperation(forkOperationKey(operationId))
                if (!loadedOperation) return { ok: false, error: '分支操作不存在或已过期' }
                let operation = loadedOperation
                const failCatalog=async()=>{
                  const catalog=ctx.get('tavernConversations'),childId=operation.childSessionId??operation.reservedChildSessionId
                  if(!catalog||!childId)return null
                  await catalog.ready
                  return catalog.fail(childId,operation.operationId)
                }
                if (operation.abortedAt) return { ok: true, alreadyAborted: true,conversations:await failCatalog() }
                if (operation.groupId && operation.childSessionId) {
                  const childSessionId = operation.childSessionId
                  let requestAlreadyAccepted = false
                  const initialGroup = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
                  const abortLockKey = initialGroup?.anchor
                    ? forkAnchorLockKey(initialGroup.anchor)
                    : forkAnchorLockKey(operation.anchor)
                  await withForkMutationLock(abortLockKey, async () => {
                    const group = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
                    const member = group?.members?.find((item) =>
                      item.sessionId === operation.childSessionId && Number(item.ordinal) === Number(operation.ordinal))
                    const child = ctx.sessions.get(childSessionId)
                    requestAlreadyAccepted = Boolean(child && operation.requestId && requestUserEvent(child, String(operation.requestId)))
                    if (requestAlreadyAccepted) return
                    if (group && member && member.pending) {
                      member.deleted = true
                      member.pending = false
                      member.failed = true
                      member.failureReason = '客户端放弃等待'
                      member.deletedAt = Date.now()
                      group.updatedAt = Date.now()
                      await T.branch.put(forkGroupKey(group.groupId), group)
                    }
                    await T.branch.delete(forkPendingKey(childSessionId, operation.groupId))
                  })
                  if (requestAlreadyAccepted) {
                    return {
                      ok: true,
                      aborted: false,
                      alreadyAccepted: true,
                      operationId: operation.operationId,
                    }
                  }
                }
                operation = await updateOperation(forkOperationKey(operation.operationId), (record) => ({
                  ...cloneBranchRecord(record), abortedAt: Date.now(), state: 'aborted',
                }))
                return { ok: true, operationId: operation.operationId,conversations:await failCatalog() }
              }))
            }

            if (action === 'operation-status') {
              const operation = readOperation(forkOperationKey(body?.operationId))
              if (!operation) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期' })
              if (operation.state === 'failed' || operation.state === 'aborted') {
                await failWorldlineCatalog(operation)
                return jsonResponse(200, { ok: true, status: 'failed', error: operation.failureReason ?? '分支操作已失败' })
              }
              if (operation.kind === 'delete-user' && operation.consumed && operation.registration?.truncated) {
                return jsonResponse(200, {
                  ok: true,
                  status: 'completed',
                  operationState: operation.state ?? 'registered',
                  registered: true,
                  childSessionId: operation.childSessionId,
                  truncated: true,
                })
              }
              if (!operation.consumed || !operation.childSessionId || !operation.groupId) {
                return jsonResponse(200, {
                  ok: true,
                  status: operation.state === 'registering' ? 'pending' : 'prepared',
                  operationState: operation.state ?? 'prepared',
                  registered: false,
                  requestAccepted: false,
                })
              }
              const child = await resolveRoleplaySession(operation.childSessionId)
              if (child) await reconcileNativeFork(child)
              const group = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
              const member = group?.members?.find((item) =>
                item.sessionId === operation.childSessionId && Number(item.ordinal) === Number(operation.ordinal))
              if (!member) return jsonResponse(409, { ok: false, error: '分支成员索引缺失' })
              const status = member.failed || (member.deleted && !member.assistantMessageId)
                ? 'failed'
                : member.pending
                  ? 'pending'
                  : member.assistantMessageId
                    ? 'completed'
                    : 'pending'
              return jsonResponse(200, {
                ok: true,
                status,
                operationState: operation.state ?? 'registered',
                registered: true,
                requestAccepted: child ? Boolean(requestUserEvent(child, String(operation.requestId ?? ''))) : false,
                childSessionId: operation.childSessionId,
                assistantMessageId: member.assistantMessageId ?? null,
                error: status === 'failed' ? String(member.failureReason ?? '分支生成失败') : undefined,
              })
            }

            if (action === 'delete') {
              const session = await resolveRoleplaySession(body?.sessionId)
              if (!session) return jsonResponse(404, { ok: false, error: '角色扮演会话不存在或无法恢复' })
              const messageId = String(body?.messageId ?? '')
              const pointer = forkPointerFor(session, messageId)
              const initialGroup = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
              if (!initialGroup) return jsonResponse(404, { ok: false, error: '这条回复尚未形成可删除的分支组' })
              return withForkMutationLock(forkAnchorLockKey(initialGroup.anchor), async () => {
                const group = hydrateForkGroup(T.branch.get(forkGroupKey(initialGroup.groupId)))
                if (!group) return jsonResponse(404, { ok: false, error: '分支组已被移除，请刷新后重试' })
                const exactMember = groupMemberForSession(group, session, messageId, { includeDeleted: true })
                if (exactMember?.deleted && exactMember.deleteResult) {
                  const activeNow = group.members.filter((member) => !member.deleted)
                  const preferred = activeNow.find((member) => member.sessionId === exactMember.deleteResult!.nextSessionId)
                    ?? activeNow[0]
                  if (!preferred) return jsonResponse(409, { ok: false, error: '分支组已没有可切换的活动版本' })
                  return jsonResponse(200, {
                    ok: true,
                    ...exactMember.deleteResult,
                    nextSessionId: preferred.sessionId,
                    remaining: activeNow.length,
                    alreadyDeleted: true,
                  })
                }
                const active = group.members.filter((member) => !member.deleted)
                if (active.length <= 1) return jsonResponse(409, { ok: false, error: '至少保留一个可用分支；请先重新生成，再删除不需要的版本' })
                const victimMember = exactMember
                const index = active.findIndex((member) => member === victimMember)
                if (index < 0) return jsonResponse(409, { ok: false, error: '当前回复不属于该活动分支组' })
                const victim = active[index]!
                const next = (active[index + 1] ?? active[index - 1])!
                victim.deleted = true
                victim.deletedAt = Date.now()
                victim.deleteResult = {
                  nextSessionId: next.sessionId,
                  remaining: active.length - 1,
                  deletedOrdinal: index + 1,
                }
                group.updatedAt = Date.now()
                await T.branch.put(forkGroupKey(group.groupId), group)
                return jsonResponse(200, {
                  ok: true,
                  ...victim.deleteResult,
                })
              })
            }

            if (action === 'replace-message') {
              const session = await resolveRoleplaySession(body?.sessionId)
              if (!session) return jsonResponse(404, { ok: false, error: '角色扮演会话不存在或无法恢复' })
              const text = String(body?.text ?? '').trim()
              if (!text) return jsonResponse(400, { ok: false, error: '消息不能为空' })
              if (text.length > 1_000_000) return jsonResponse(413, { ok: false, error: '消息超过 1,000,000 字符' })
              if (body?.role === 'assistant') {
                const messageId = String(body?.messageId ?? '')
                if (!messageId) return jsonResponse(400, { ok: false, error: '缺少 Agent messageId' })
                const replacement = await replaceAssistantText(session, messageId, text)
                return jsonResponse(200, { ok: true, seq: Number(replacement!.seq), messageId })
              }
              if (body?.role === 'user') {
                const seq = Number(body?.seq)
                if (!Number.isSafeInteger(seq) || seq < 0) return jsonResponse(400, { ok: false, error: '玩家消息 seq 无效' })
                const result = await replaceUserText(session, seq, text)
                return jsonResponse(200, { ok: true, ...result })
              }
              return jsonResponse(400, { ok: false, error: 'role 必须是 user 或 assistant' })
            }

            return jsonResponse(400, { ok: false, error: `未知 branch action: ${action}` })
          } catch (error) {
            return jsonResponse((error as BranchRouteError | null)?.code==='ROLEPLAY_NOT_STORY'?400:500, { ok: false, error: String((error as BranchRouteError | null)?.message ?? error) })
          }
        },
      }),
    'roleplay: route native branch'
  )

}
