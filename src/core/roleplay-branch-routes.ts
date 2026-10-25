import { randomUUID } from 'node:crypto'
import { keyOf, durableSeq, sha256, recordSha256 } from './roleplay-data.js'
import { eventsOf, surfaceEvents, isCompletedTurnEnd } from './roleplay-context.js'
import { jsonResponse } from './roleplay-state.js'
import { activeOpeningSource } from './roleplay-import.js'
import type { BranchRouteSession, StoredBranchOperation, BranchRouteBody, BranchRouteError, ForkReservation,
  BranchRoutesDependencies,CleanBranchInspection,CleanBranchRequest,CleanBranchPreparation,
  CleanBranchPreparationSummary } from './roleplay-branch-routes-types.js'

export function registerBranchRoutes(deps: BranchRoutesDependencies) {
  const {ctx, T, resolveRoleplaySession, cloneBranchRecord, assertStoryBranchActive, withForkMutationLock,
    forkOperationKey, reconcileCanonicalPlayerVariants, buildForkLookupIndex, userForkContext, locatePlayerRecoveryTarget,
    assistantMessageId, forkPointerFor, hydrateForkGroup, forkGroupKey, groupMemberForSession, locateForkTarget,
    locateProgrammaticOpeningTarget, bootstrapChildBranch, registerRecoveryFork, registerNativeFork, forkAnchorLockKey,
    requestUserEvent, forkPendingKey, reconcileNativeFork, failPendingNativeFork, replaceAssistantText, replaceUserText,
    prepareWorldlineInheritance,releaseWorldlineInheritance,numericalForkBlockCode} = deps
  const readOperation=(key: string)=>cloneBranchRecord(T.branch.get(key)) as StoredBranchOperation | undefined
  const updateOperation=(key: string,work: (current: StoredBranchOperation | undefined) => object)=>T.branch.update(key,current=>work(current as StoredBranchOperation | undefined)) as PromiseLike<StoredBranchOperation>
  const routeError=(message:string,httpStatus=409,code?:string)=>Object.assign(Error(message),{httpStatus,...code?{code}:{}})
  // Both ordinary branch routes and clean recovery reserve through this one
  // Native/Source coordinator. Replays retain the exact reserved child and DATA.
  async function createWorldline(operationId:string,callerCurrent?:()=>void,beforeReserve?:()=>void,
    includeConversations=true) {
    const operationKey=forkOperationKey(operationId),operation=readOperation(operationKey)
    const catalog=ctx.get('tavernConversations')
    if(!operation||!catalog)throw routeError('世界线操作或酒馆会话目录不存在',404)
    callerCurrent?.()
    const frozenClean=operation.kind==='prepare-clean-branch'&&!!operation.reservedChildSessionId
    if(operation.state==='failed'||operation.state==='aborted'||operation.abortedAt
      ||!frozenClean&&Date.now()>operation.expiresAt) {
      const childId=operation.reservedChildSessionId??operation.childSessionId
      if(childId)releaseWorldlineInheritance?.(childId)
      throw Error('世界线操作已经失效，请重新发起')
    }
    const source=await resolveRoleplaySession(operation.anchor.sourceSessionId)
    if(!source)throw Error('源角色扮演会话不可用')
    const numericalBlock=numericalForkBlockCode?.(source.id)
    if(numericalBlock)throw routeError('该角色卡的数值世界线尚不能复制',409,numericalBlock)
    assertStoryBranchActive(source)
    await catalog.ready
    const failReservation=async(childId:string|null)=>{
      if(childId) {releaseWorldlineInheritance?.(childId);await catalog.fail(childId,operation.operationId)}
      await T.branch.put(operationKey,{...readOperation(operationKey),state:'failed',
        failureReason:'世界线创建失败，请重新发起',failedAt:Date.now()})
    }
    const lookupReserved=async(childId:string)=>{
      if(ctx.sessions.get(childId))return ctx.sessions.get(childId)
      const found=await ctx.sessionController.resolveAgent(childId)
      if(found?.error&&found.error.code!=='session/not-found')throw found.error
      return found?.agent?.session??ctx.sessions.get(childId)??null
    }
    if(operation.reservedChildSessionId) {
      const existing=await lookupReserved(operation.reservedChildSessionId)
      if(existing)return {childSessionId:existing.id,...includeConversations?{conversations:catalog.snapshot()}:{}}
      await failReservation(operation.reservedChildSessionId)
      throw Error('世界线创建已失效，请重新发起')
    }
    const active=await ctx.sessionController.resolveAgent(source.id)
    if(active?.agent?.status&&active.agent.status!=='idle')throw Error('请等待当前轮次完成后再切换世界线')
    let reservedId:string|null=null,reservationCommitted=false
    const reserve=async({sourceSessionId,childSessionId,seedLength}:ForkReservation)=>{
      callerCurrent?.()
      if(sourceSessionId!==source.id)throw Error('原生分支来源不匹配')
      reservedId=childSessionId
      const reservedOperation={...operation,anchor:{...operation.anchor,expectedSeedLength:seedLength}},
        reservation={sourceSessionId,childSessionId,seedLength}
      const sourcePrepared=await prepareWorldlineInheritance?.(reservedOperation,reservation)
      if(operation.kind==='prepare-clean-branch'&&sourcePrepared?.kind!=='prepared-data')
        throw Error('CLEAN_BRANCH_FROZEN_SOURCE_UNAVAILABLE')
      if(sourcePrepared?.kind==='prepared-data'&&sourcePrepared.disposition==='created')
        deps.sourceInheritance!.assertPreparedParentCurrent(childSessionId)
      beforeReserve?.()
      await catalog.reserve({sourceSessionId,childSessionId,operationId:operation.operationId,
        kind:operation.kind==='opening-regenerate'?'regenerate':operation.kind,
        sourceHash:recordSha256(reservedOperation.anchor)},callerCurrent)
      callerCurrent?.()
      await T.branch.put(operationKey,{...reservedOperation,reservedChildSessionId:childSessionId,
        presentation:{schemaVersion:1,kind:'worldline',conversationId:catalog.rootOf(source.id),sourceSessionId,seedLength},reservedAt:Date.now()})
      reservationCommitted=true
      callerCurrent?.()
    }
    let created
    try {
      if(operation.anchor.previousTurnEndSeq==null) {
        const childSessionId=`session-${randomUUID()}`
        await reserve({sourceSessionId:source.id,childSessionId,seedLength:0})
        created=await ctx.sessionController.create({sessionId:childSessionId,
          ...(source.header?.cwd?{cwd:source.header.cwd}:{}),agentPreset:'roleplay'})
      }else {
        if(typeof ctx.sessionController.forkPrepared!=='function')throw Error('原生世界线创建支持尚未安装，请刷新或联系维护者')
        created=await ctx.sessionController.forkPrepared({sessionId:source.id,atSeq:operation.anchor.previousTurnEndSeq},reserve)
      }
      if(!created?.sessionId)throw Error('原生会话未返回世界线标识')
    }catch(error) {
      // A response can be lost after Native publication. Keep a real reserved
      // child for resumption; a missing child is terminal, never silently remade.
      if(!reservationCommitted||!reservedId||!await lookupReserved(reservedId))await failReservation(reservedId)
      throw error
    }
    return {childSessionId:created.sessionId,...includeConversations?{conversations:catalog.snapshot()}:{}}
  }
  async function captureCleanInspection(sessionId:string) {
    const source=await resolveRoleplaySession(sessionId),catalog=ctx.get('tavernConversations')
    if(!source||!catalog)throw Error('CLEAN_BRANCH_SOURCE_UNAVAILABLE')
    await catalog.ready
    assertStoryBranchActive(source)
    const selection=catalog.selectionOf(source.id),active=await ctx.sessionController.resolveAgent(source.id)
    if(!active?.agent||active.agent.status!=='idle')throw Error('CLEAN_BRANCH_MAIN_NOT_IDLE')
    if(!deps.readInputRecoveryDiagnostic||!deps.readMainModelSelection||!deps.captureCleanBranchSource)
      throw Error('CLEAN_BRANCH_OWNERS_UNAVAILABLE')
    const diagnostic=deps.readInputRecoveryDiagnostic(source.id)
    if(!diagnostic||diagnostic.sourceKind!=='story'||!['unknown','stopped'].includes(diagnostic.status))
      throw Error('CLEAN_BRANCH_FAILED_INPUT_REQUIRED')
    const events=eventsOf(source),completed=events.findLast(isCompletedTurnEnd)
    if(!completed)throw Error('CLEAN_BRANCH_COMPLETED_BOUNDARY_MISSING')
    const sourceRead=deps.captureCleanBranchSource(source),model=cloneBranchRecord(deps.readMainModelSelection(source)),
      nativeThroughSeq=Number(events.at(-1)?.seq),completedTurnEndSha256=recordSha256(completed),
      completedBoundary={turn:Number(completed.data?.turn),turnEndSeq:Number(completed.seq)},
      revision=recordSha256({sessionId:source.id,selectionRevision:selection.revision,
        diagnosticRevision:diagnostic.revision,sourceRevision:sourceRead.revision,
        nativeThroughSeq,completedTurnEndSha256,model})
    const assertBeforeReserve=()=>{
      sourceRead.assertCurrent()
      const current=catalog.selectionOf(source.id)
      if(active.agent!.status!=='idle'||current.activeSessionId!==source.id||current.revision!==selection.revision
        ||deps.readInputRecoveryDiagnostic!(source.id)?.revision!==diagnostic.revision
        ||Number(eventsOf(source).at(-1)?.seq)!==nativeThroughSeq
        ||recordSha256(deps.readMainModelSelection!(source))!==recordSha256(model))
        throw Error('CLEAN_BRANCH_DIAGNOSIS_CHANGED')
    }
    return {source,sourceRead,model,diagnostic,completedBoundary,completedTurnEndSha256,nativeThroughSeq,
      selectionRevision:selection.revision,revision,assertBeforeReserve}
  }
  async function inspectCleanBranch(sessionId:string):Promise<CleanBranchInspection> {
    const observed=await captureCleanInspection(sessionId)
    return {ok:true,branchId:observed.source.id,operationId:randomUUID(),revision:observed.revision,
      selectionRevision:observed.selectionRevision,diagnostic:observed.diagnostic,
      completedBoundary:observed.completedBoundary,model:observed.model}
  }
  function cleanBranchStatus(sessionId:string,operationId:string,
    options:{includeConversations:false}):Promise<CleanBranchPreparationSummary>
  function cleanBranchStatus(sessionId:string,operationId:string):Promise<CleanBranchPreparation>
  async function cleanBranchStatus(sessionId:string,operationId:string,
    options?:{includeConversations:false}):Promise<CleanBranchPreparation|CleanBranchPreparationSummary> {
    const operation=readOperation(forkOperationKey(operationId)),catalog=ctx.get('tavernConversations')
    if(!operation||operation.kind!=='prepare-clean-branch'||!operation.clean||!catalog
      ||catalog.rootOf(sessionId)!==catalog.rootOf(operation.anchor.sourceSessionId))
      throw Error('CLEAN_BRANCH_OPERATION_UNAVAILABLE')
    return {ok:operation.state!=='failed'&&operation.state!=='aborted',kind:'prepare-clean-branch',operationId,
      sourceSessionId:operation.anchor.sourceSessionId,
      childSessionId:operation.childSessionId??operation.reservedChildSessionId??null,
      status:operation.state==='ready'?'ready':['failed','aborted'].includes(operation.state??'')?'failed':'prepared',
      requiresPlayerInput:true,error:operation.failureReason??null,
      ...options?.includeConversations===false?{}:{conversations:catalog.snapshot()}}
  }
  function prepareCleanBranch(request:CleanBranchRequest,callerCurrent:()=>void,
    options:{includeConversations:false}):Promise<CleanBranchPreparationSummary>
  function prepareCleanBranch(request:CleanBranchRequest,callerCurrent:()=>void):Promise<CleanBranchPreparation>
  async function prepareCleanBranch(request:CleanBranchRequest,callerCurrent:()=>void,
    options?:{includeConversations:false}):Promise<CleanBranchPreparation|CleanBranchPreparationSummary> {
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(request.operationId)||!request.expectedRevision)
      throw Error('CLEAN_BRANCH_OPERATION_ID_REQUIRED')
    return withForkMutationLock(`operation:${request.operationId}`,async()=>{
      callerCurrent()
      const key=forkOperationKey(request.operationId)
      let operation=readOperation(key),observed:Awaited<ReturnType<typeof captureCleanInspection>>|undefined
      if(operation) {
        if(operation.kind!=='prepare-clean-branch'||operation.anchor.sourceSessionId!==request.sessionId
          ||operation.clean?.expectedRevision!==request.expectedRevision)throw Error('CLEAN_BRANCH_OPERATION_CHANGED')
      }
      // Reservation freezes Source and the Native cut. Only a new reservation
      // must still match live diagnosis; resumption uses its saved DATA/model.
      if(!operation?.reservedChildSessionId) {
        observed=await captureCleanInspection(request.sessionId)
        if(observed.revision!==request.expectedRevision)throw Error('CLEAN_BRANCH_DIAGNOSIS_CHANGED')
      }
      if(!operation) {
        const facts=observed!
        operation={schemaVersion:2,operationId:request.operationId,kind:'prepare-clean-branch',promptText:'',
          anchor:{sourceSessionId:request.sessionId,sourceTurn:facts.completedBoundary.turn,
            previousTurnEndSeq:facts.completedBoundary.turnEndSeq,promptText:''},
          clean:{schemaVersion:1,expectedRevision:request.expectedRevision,diagnostic:facts.diagnostic,
            sourceRevision:facts.sourceRead.revision,selectionRevision:facts.selectionRevision,
            completedTurnEndSha256:facts.completedTurnEndSha256,nativeThroughSeq:facts.nativeThroughSeq,model:facts.model},
          state:'prepared',consumed:false,createdAt:Date.now(),expiresAt:Date.now()+15*60*1000}
        callerCurrent()
        await T.branch.put(key,operation)
      }
      try {
        // Clean preparation only consumes the child identity. The chosen
        // public view is assembled once after bootstrap/model publication.
        const created=await createWorldline(request.operationId,callerCurrent,observed?.assertBeforeReserve,false)
        operation=readOperation(key)!
        if(operation.state==='ready')return options?.includeConversations===false
          ?cleanBranchStatus(request.sessionId,request.operationId,options)
          :cleanBranchStatus(request.sessionId,request.operationId)
        const child=await resolveRoleplaySession(created.childSessionId)
        if(!child)throw Error('CLEAN_BRANCH_CHILD_UNAVAILABLE')
        if(!operation.clean!.bootstrapComplete) {
          callerCurrent()
          await bootstrapChildBranch(operation,child)
          operation=await updateOperation(key,current=>({...current!,state:'preparing-clean',
            clean:{...current!.clean!,bootstrapComplete:true}}))
        }
        if(!operation.clean!.modelCopied) {
          if(!ctx.sessionController.selectModelForSession||!deps.readMainModelSelection)
            throw Error('CLEAN_BRANCH_MODEL_OWNER_UNAVAILABLE')
          callerCurrent()
          const model=operation.clean!.model
          if(recordSha256(deps.readMainModelSelection(child))!==recordSha256(model))
            await ctx.sessionController.selectModelForSession({sessionId:child.id,...model})
          if(!await ctx.sessions.flush(child))throw Error('CLEAN_BRANCH_MODEL_FLUSH_FAILED')
          operation=await updateOperation(key,current=>({...current!,state:'preparing-clean',
            clean:{...current!.clean!,modelCopied:true}}))
        }
        await ctx.get('tavernConversations')!.markReady(child.id,callerCurrent)
        callerCurrent()
        await updateOperation(key,current=>({...current!,state:'ready',consumed:true,childSessionId:child.id,
          failure:null,failureReason:null,readyAt:Date.now()}))
        return options?.includeConversations===false?cleanBranchStatus(request.sessionId,request.operationId,options)
          :cleanBranchStatus(request.sessionId,request.operationId)
      }catch(error) {
        const current=readOperation(key)
        if(current&&current.state!=='ready') {
          const failure={schemaVersion:1 as const,code:'CLEAN_BRANCH_PREPARATION_FAILED',
            message:String((error as Error).message??error),at:Date.now()}
          await updateOperation(key,value=>({...value!,
            state:value!.state==='failed'||!value!.reservedChildSessionId?'failed':'preparing-clean',
            failure,failureReason:failure.message,failedAt:failure.at}))
        }
        throw error
      }
    })
  }
  async function publishWorldlineSelection(operation: StoredBranchOperation,child: BranchRouteSession) {
    const catalog=ctx.get('tavernConversations')
    if(!catalog)return null // Compatibility for non-web fixtures/older hosts.
    await catalog.ready
    await catalog.reserve({sourceSessionId:operation.anchor.sourceSessionId,childSessionId:child.id,
      operationId:operation.operationId,kind:operation.kind === 'opening-regenerate' ? 'regenerate' : operation.kind,
      sourceHash:recordSha256(operation.anchor)})
    return catalog.markReady(child.id)
  }
  async function failWorldlineCatalog(operation: StoredBranchOperation) {
    const catalog=ctx.get('tavernConversations'),childId=operation.reservedChildSessionId??operation.childSessionId
    if(childId)releaseWorldlineInheritance?.(childId)
    if(!catalog||!childId)return null
    await catalog.ready
    return catalog.fail(childId,operation.operationId)
  }
  async function failOpeningBeforeGeneration(operation: StoredBranchOperation, code: string, message: string) {
    const failure = {schemaVersion: 1 as const, code, message, at: Date.now()}
    await updateOperation(forkOperationKey(operation.operationId), current => ({...cloneBranchRecord(current),
      state: 'failed', failureReason: message, failure, failedAt: failure.at}))
    const conversations = await failWorldlineCatalog(operation)
    return jsonResponse(409, {ok: false, status: 'failed', operationId: operation.operationId,
      childSessionId: operation.reservedChildSessionId ?? operation.childSessionId ?? null,
      error: message, failure, conversations})
  }
  async function settleOpeningFailure(operation: StoredBranchOperation, child: BranchRouteSession) {
    if (operation.kind !== 'opening-regenerate' || !operation.groupId) return
    const failedTurn = eventsOf(child).find(event => event.type === 'turn/end'
      && Number(event.data?.turn) === 1 && ['error', 'aborted', 'blocked', 'max-tokens'].includes(String(event.data?.reason?.kind)))
    if (failedTurn && await ctx.sessions.flush(child)) {
      await failPendingNativeFork(child, '首条开场模型生成失败')
    }
  }
  async function openingOutcome(operation: StoredBranchOperation, child: BranchRouteSession | null) {
    const childId = operation.childSessionId ?? operation.reservedChildSessionId ?? null
    if (!operation.groupId || !child) {
      if (operation.state === 'generating' || operation.state === 'waiting-agent') {
        const message = '开场生成中的世界线无法恢复；原世界线已保留，请重新创建分支'
        const failure = {schemaVersion: 1 as const, code: 'OPENING_CHILD_LOST', message, at: Date.now()}
        await updateOperation(forkOperationKey(operation.operationId), current => ({...cloneBranchRecord(current),
          state: 'failed', failureReason: message, failure, failedAt: failure.at}))
        const conversations = await failWorldlineCatalog(operation)
        return {ok: true, status: 'failed', operationState: 'failed', operationId: operation.operationId,
          childSessionId: childId, registered: !!operation.groupId, requestAccepted: true,
          error: message, failure, conversations}
      }
      return {ok: true, status: 'prepared', operationId: operation.operationId,
        childSessionId: childId, registered: false, requestAccepted: false}
    }
    await reconcileNativeFork(child)
    await settleOpeningFailure(operation, child)
    const group = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
    const member = group?.members.find(item => item.operationId === operation.operationId
      && item.sessionId === child.id && Number(item.ordinal) === Number(operation.ordinal))
    if (member?.assistantMessageId) {
      // A prior request may have committed its reply and lost the markReady
      // acknowledgement. Reconcile the catalog only after exact durable proof.
      const conversations = await publishWorldlineSelection(operation, child)
      if (operation.state !== 'registered') await updateOperation(forkOperationKey(operation.operationId),
        current => ({...cloneBranchRecord(current), state: 'registered', registeredAt: Date.now()}))
      return {ok: true, status: 'completed', operationState: 'registered', operationId: operation.operationId,
        childSessionId: child.id, registered: true, requestAccepted: true,
        assistantMessageId: member.assistantMessageId, conversations}
    }
    if (operation.state === 'waiting-agent' && member && !member.failed) return {ok: true, status: 'pending',
      operationState: 'waiting-agent', operationId: operation.operationId,
      childSessionId: child.id, registered: true, requestAccepted: false,
      assistantMessageId: null}
    if (member?.failed || operation.state === 'generating' || operation.state === 'waiting-agent') {
      const active = member?.failed ? null : await ctx.sessionController.resolveAgent(child.id)
      if (!member?.failed && active?.agent?.status === 'running') return {ok: true, status: 'pending',
        operationState: 'generating', operationId: operation.operationId,
        childSessionId: child.id, registered: true, requestAccepted: true,
        assistantMessageId: null}
      const reason = member?.failureReason ?? '开场生成结果无法确认；原世界线已保留，请从原开场重新创建分支'
      if (!member?.failed) await failPendingNativeFork(child, reason)
      const failure = {schemaVersion: 1 as const, code: member?.failed
        ? 'OPENING_GENERATION_FAILED' : 'OPENING_GENERATION_UNKNOWN', message: reason, at: Date.now()}
      await updateOperation(forkOperationKey(operation.operationId), current => ({...cloneBranchRecord(current),
        state: 'failed', failureReason: reason, failure, failedAt: failure.at}))
      const conversations = await failWorldlineCatalog(operation)
      return {ok: true, status: 'failed', operationState: 'failed', operationId: operation.operationId,
        childSessionId: child.id, registered: true, requestAccepted: true,
        assistantMessageId: null, error: reason, failure, conversations}
    }
    return {ok: true, status: 'prepared', operationId: operation.operationId,
      childSessionId: childId, registered: false, requestAccepted: false}
  }
  ctx.effect(
    () =>
      ctx.connection.fetch.register({requestBody: 'buffered',
        path: '/api/roleplay/branch',
        methods: ['POST'],
        fetch: async (request) => {
          try {
            const body = await request.json() as BranchRouteBody
            const action = String(body?.action ?? '')
            if(action==='inspect-clean-branch')return jsonResponse(200,await inspectCleanBranch(String(body.sessionId??'')))
            if(action==='prepare-clean-branch')return jsonResponse(200,await prepareCleanBranch({
              sessionId:String(body.sessionId??''),operationId:String(body.operationId??''),
              expectedRevision:String(body.expectedRevision??'')},()=>request.signal.throwIfAborted()))
            if(action==='clean-branch-status')return jsonResponse(200,
              await cleanBranchStatus(String(body.sessionId??''),String(body.operationId??'')))
            if(['prepare','generate-opening','register'].includes(action)) {
              const source=await resolveRoleplaySession(body.sessionId)
              const code=source&&numericalForkBlockCode?.(source.id)
              if(code)return jsonResponse(409,{ok:false,code,error:'该角色卡的数值世界线尚不能复制'})
            }
            if(action==='select-worldline') {
              const session=await resolveRoleplaySession(body.sessionId),catalog=ctx.get('tavernConversations')
              if(!session||!catalog)return jsonResponse(404,{ok:false,error:'酒馆会话尚未就绪'})
              assertStoryBranchActive(session)
              await catalog.ready
              return jsonResponse(200,{ok:true,conversations:await catalog.activate(session.id),executionSessionId:session.id})
            }
            if(action==='create-worldline')return await withForkMutationLock(`operation:${body.operationId}`,async()=>{
              try {return jsonResponse(200,{ok:true,...await createWorldline(String(body.operationId??''))})}
              catch(error) {
                const failure=error as Error&{httpStatus?:number;code?:string}
                return jsonResponse(failure.httpStatus??500,{ok:false,error:failure.message,
                  ...failure.code?{code:failure.code}:{}})
              }
            })
            if (action === 'prepare') {
              const source = await resolveRoleplaySession(body?.sessionId)
              if (!source) return jsonResponse(404, { ok: false, error: '角色扮演源会话不存在或无法恢复' })
              if (body?.kind === 'opening-regenerate') {
                assertStoryBranchActive(source)
                const anchor = locateProgrammaticOpeningTarget(source, body?.messageId, body?.seq)
                const operationId = randomUUID()
                await T.branch.put(forkOperationKey(operationId), {schemaVersion: 1, operationId,
                  kind: 'opening-regenerate', anchor, promptText: '', createdAt: Date.now(),
                  expiresAt: Date.now() + 15 * 60 * 1000, consumed: false})
                return jsonResponse(200, {ok: true, operationId, kind: 'opening-regenerate',
                  previousTurnEndSeq: null, sourceTurn: 1, requiresPrompt: false})
              }
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
              const existingPointer = forkPointerFor(source, requestedMessageId, null, false)
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

            if (action === 'generate-opening') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, {ok: false, error: '缺少 operationId'})
              return await withForkMutationLock(`operation:${operationId}`, async () => {
                const key = forkOperationKey(operationId)
                let operation = readOperation(key)
                if (!operation || operation.kind !== 'opening-regenerate') {
                  return jsonResponse(404, {ok: false, error: '程序开场分支操作不存在'})
                }
                if (operation.state === 'failed' || operation.state === 'aborted') {
                  return jsonResponse(409, {ok: false, error: operation.failureReason ?? '分支操作已失效'})
                }
                const childId = String(body?.childSessionId ?? '')
                if (!childId || childId !== operation.reservedChildSessionId) {
                  return jsonResponse(409, {ok: false, error: '世界线与预留会话标识不匹配'})
                }
                const child = await resolveRoleplaySession(childId)
                if (!child) return failOpeningBeforeGeneration(operation, 'OPENING_CHILD_UNAVAILABLE',
                  '新世界线无法恢复；原世界线已保留，请重新创建分支')
                if (operation.state === 'generating' || operation.state === 'registered') {
                  return jsonResponse(200, await openingOutcome(operation, child))
                }
                if (Date.now() > operation.expiresAt) {
                  return failOpeningBeforeGeneration(operation, 'OPENING_OPERATION_EXPIRED',
                    '开场生成操作已过期；原世界线已保留，请重新创建分支')
                }
                const source = await resolveRoleplaySession(operation.anchor.sourceSessionId)
                if (!source) return failOpeningBeforeGeneration(operation, 'OPENING_SOURCE_UNAVAILABLE',
                  '原始开场会话无法恢复；请切换到可用的原世界线')
                try {
                  assertStoryBranchActive(source)
                  const currentAnchor = locateProgrammaticOpeningTarget(source,
                    operation.anchor.sourceAssistantMessageId, operation.anchor.sourceAssistantSeq)
                  if (currentAnchor.sourceAssistantSeq !== operation.anchor.sourceAssistantSeq
                    || currentAnchor.sourceSessionId !== operation.anchor.sourceSessionId) throw new Error('开场锚点已变化')
                } catch {
                  return failOpeningBeforeGeneration(operation, 'OPENING_SOURCE_CHANGED',
                    '原始开场锚点已变化；原世界线已保留，请重新创建分支')
                }
                const found = await ctx.sessionController.resolveAgent(childId)
                const agent = found?.agent
                if (operation.state === 'waiting-agent' && agent?.status !== 'idle') {
                  return jsonResponse(202, await openingOutcome(operation, child))
                }
                if (!agent || agent.status !== 'idle' || !agent.generateProgrammaticAssistant) {
                  return failOpeningBeforeGeneration(operation, agent?.status === 'running'
                    ? 'OPENING_CHILD_BUSY' : 'OPENING_NATIVE_UNAVAILABLE',
                  '新世界线当前无法受理开场生成；原世界线已保留，请稍后重新创建分支')
                }
                let registration: Awaited<ReturnType<typeof registerNativeFork>>
                if (operation.state === 'waiting-agent' && operation.groupId && operation.ordinal) {
                  registration = {groupId: operation.groupId, ordinal: operation.ordinal,
                    total: 0, playerTotal: 0}
                } else {
                  try { registration = await registerNativeFork({...operation, requestId: operationId}, child) }
                  catch { return failOpeningBeforeGeneration(operation, 'OPENING_REGISTER_FAILED',
                    '开场分支登记失败；原世界线已保留，请重新创建分支') }
                }
                if (!registration) return failOpeningBeforeGeneration(operation, 'OPENING_REGISTER_FAILED',
                  '开场分支登记失败；原世界线已保留，请重新创建分支')
                // Fresh first-turn children receive their static card state in
                // registerNativeFork/bootstrapChildBranch, not at reservation.
                const childSource = activeOpeningSource(T.branch, childId)
                const expectedSource = operation.anchor.openingSource
                if (!expectedSource || !childSource
                  || childSource.importId !== expectedSource.importId
                  || childSource.normalizedSha256 !== expectedSource.normalizedSha256
                  || childSource.transactionId !== expectedSource.transactionId) {
                  return failOpeningBeforeGeneration(operation, 'OPENING_SOURCE_CHANGED',
                    '新世界线的角色卡来源已变化；原世界线已保留，请重新创建分支')
                }
                const retainedRegistration = operation.registration ?? registration
                operation = await updateOperation(key, current => ({...cloneBranchRecord(current),
                  requestId: operationId, childSessionId: childId, groupId: registration.groupId,
                  ordinal: registration.ordinal, registration: retainedRegistration,
                  state: 'generating', consumed: true,
                  generatingAt: Date.now()}))
                const instruction='请根据当前角色、世界设定与规则，直接创作一段全新的开场剧情正文。此轮没有玩家输入；不要假装玩家说过话，也不要解释任务。'
                const messageId=`opening-regenerate-${operationId}`
                const generation=await deps.generateProgramOpening?.({sessionId:childId,operation,messageId,instruction})
                  ??await agent.generateProgrammaticAssistant({operationId,messageId,instruction})
                if (generation.kind === 'busy') {
                  operation = await updateOperation(key, current => ({...cloneBranchRecord(current),
                    state: 'waiting-agent', requestAccepted: false}))
                  return jsonResponse(202, await openingOutcome(operation, child))
                }
                return jsonResponse(200, await openingOutcome(operation, child))
              })
            }

            if (action === 'register') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, { ok: false, error: '缺少分支操作 operationId' })
              return await withForkMutationLock(`operation:${operationId}`, async () => {
              const operationKey = forkOperationKey(operationId)
              const initial = readOperation(operationKey)
              if (!initial) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期，请重试' })
              if (initial.kind === 'opening-regenerate') return jsonResponse(400,
                {ok: false, error: '程序开场必须通过 generate-opening 执行'})
              const child = await resolveRoleplaySession(body?.childSessionId)
              if (!child) return jsonResponse(404, { ok: false, error: '新分支会话尚未在服务器就绪' })
              if(initial.reservedChildSessionId&&initial.reservedChildSessionId!==child.id)return jsonResponse(409,{ok:false,error:'世界线与预留会话标识不匹配'})
              const promptText = String(body?.promptText ?? '')
              const requestId = initial.kind === 'delete-user' ? '' : String(body?.requestId ?? '').trim()
              if (initial.kind !== 'delete-user' && (!requestId || requestId.length > 256 || /[\u0000-\u001f]/.test(requestId))) {
                return jsonResponse(400, { ok: false, error: '缺少或无效的分支请求 requestId' })
              }
              if (!promptText.trim() && initial.kind !== 'delete-user') return jsonResponse(400, { ok: false, error: '修改后的消息不能为空' })
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
                    String(record.promptSha256 ?? sha256(String(record.promptText ?? ''))) === promptSha256
                  if (state === 'registering' || state === 'registered') {
                    if (!sameIdentity) throw new Error('同一分支操作已由不同的会话或请求占用')
                    return record
                  }
                  if (Number(record.expiresAt) < Date.now()) {
                    releaseWorldlineInheritance?.(child.id)
                    throw new Error('分支操作已过期，请重试')
                  }
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
                const failCatalog=()=>failWorldlineCatalog(operation)
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
              const operationId = String(body?.operationId ?? '')
              const operation = readOperation(forkOperationKey(operationId))
              if (!operation) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期' })
              if (operation.kind === 'opening-regenerate') {
                return await withForkMutationLock(`operation:${operationId}`, async () => {
                  const current = readOperation(forkOperationKey(operationId))
                  if (!current) return jsonResponse(404, {ok: false, error: '程序开场分支操作不存在'})
                  if (current.state === 'failed' || current.state === 'aborted') {
                    await failWorldlineCatalog(current)
                    return jsonResponse(200, {ok: true, status: 'failed', operationState: current.state,
                      childSessionId: current.childSessionId ?? current.reservedChildSessionId ?? null,
                      error: current.failureReason ?? '程序开场分支操作已失效', failure: current.failure})
                  }
                  const childId = current.childSessionId ?? current.reservedChildSessionId
                  const child = childId ? await resolveRoleplaySession(childId) : null
                  return jsonResponse(200, await openingOutcome(current, child ?? null))
                })
              }
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
                  const activeNow = group.members.filter((member) => !member.deleted && !!member.assistantMessageId)
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
                // Deletion must return a reply the user can open. Empty failed
                // reservations stay in the ledger for their owning recovery.
                const active = group.members.filter((member) => !member.deleted && !!member.assistantMessageId)
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
              assertStoryBranchActive(session)
              const text = String(body?.text ?? '')
              if (!text.trim()) return jsonResponse(400, { ok: false, error: '消息不能为空' })
              if (text.length > 1_000_000) return jsonResponse(413, { ok: false, error: '消息超过 1,000,000 字符' })
              if (body?.role === 'assistant') {
                const messageId = String(body?.messageId ?? '')
                if (!messageId) return jsonResponse(400, { ok: false, error: '缺少 Agent messageId' })
                const replacement = await replaceAssistantText(session, messageId, text,body.schemaTaskEdit)
                return jsonResponse(200, { ok: true, seq: Number(replacement!.seq), messageId })
              }
              if (body?.role === 'user') {
                const seq = Number(body?.seq)
                if (!Number.isSafeInteger(seq) || seq < 0) return jsonResponse(400, { ok: false, error: '玩家消息 seq 无效' })
                const result = await replaceUserText(session, seq, text,body.schemaTaskEdit)
                return jsonResponse(200, { ok: true, ...result })
              }
              return jsonResponse(400, { ok: false, error: 'role 必须是 user 或 assistant' })
            }

            return jsonResponse(400, { ok: false, error: `未知 branch action: ${action}` })
          } catch (error) {
            const message = String((error as BranchRouteError | null)?.message ?? error)
            let status = (error as BranchRouteError | null)?.code === 'ROLEPLAY_NOT_STORY' ? 400 : 500
            // These decisions cannot succeed by resending the same saved intent.
            // Keep transport/unknown outcomes retryable through the existing client.
            switch (message) {
              case 'SCHEMA_TASK_EDIT_INVALID':
              case 'SCHEMA_TASK_EDIT_TARGET_REQUIRED':
              case 'SCHEMA_TASK_EDIT_REPLACE_REQUIRED':
              case 'SCHEMA_TASK_EDIT_UPDATE_REQUIRED':
              case 'SCHEMA_TASK_EDIT_MALFORMED_UPDATE':
                status = 400
                break
              case 'SCHEMA_TASK_EDIT_ARTIFACT_CHANGED':
              case 'SCHEMA_TASK_EDIT_OPERATION_CONFLICT':
              case 'SCHEMA_TASK_EDIT_BASIS_CHANGED':
              case 'SCHEMA_TASK_EDIT_NOT_APPLIED':
              case 'SCHEMA_TASK_EDIT_PENDING':
              case 'SCHEMA_MAINTENANCE_REVISION_REQUIRED':
              case 'SCHEMA_TASK_EDIT_FANOUT_BASIS_UNAVAILABLE':
              case 'SCHEMA_TASK_EDIT_FANOUT_TARGET_UNPROVEN':
              case 'SCHEMA_TASK_EDIT_FANOUT_PENDING':
                status = 409
                break
            }
            return jsonResponse(status, { ok: false, error: message })
          }
        },
      }),
    'roleplay: route native branch'
  )
  return {inspectCleanBranch,prepareCleanBranch,cleanBranchStatus}
}
