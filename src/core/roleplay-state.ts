import { keyOf, recordSha256 } from './roleplay-data.js'
import { eventsOf, canonicalAssistantForTurn, readRoleplayActivity, surfaceEntries } from './roleplay-context.js'
import { internalTaskSeqs } from './tavern-tasks.js'
import { importActiveKey } from './roleplay-import.js'
import type { StoryEvent } from './roleplay-worldline-types.js'
import type { ImportRecord } from './roleplay-import-types.js'
import type { StateSession, StateDependencies, StatePreparation, FailedTurnGroup } from './roleplay-state-types.js'

export const jsonResponse = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })

export function createRoleplayState({ctx, T, awaitImportBarrier, ensureBranch, buildForkLookupIndex, reconcileCanonicalPlayerVariants, statusRecoveredSessions, recoverStatusObligations, nativeBranchGroupsFor, nativePlayerGroupsFor, assistantMessageId, userForkContext, locatePlayerRecoveryTarget, failedForkMembership, isRecoverySourceMember, backfillRecoverySourceMember, importRecordKey, preparationRecordKey, tavernTasks, memoryForContext, cloneContextWindow, contextWindowFor, selectedStatusRecord, selectedStatusGeneration, importSummary, deletedBranchMessageIdsFor, inheritedAssistantMessageIdsFor, normalizeDecisionRecord, userValues, svc, resolveRoleplaySession}: StateDependencies) {
  const collectBranchRecords = (session: StateSession) => {
    const prefix = `${session.id}__`
    const cards = []
    for (const [k, v] of T.cards.entries()) if (k.startsWith(prefix) && v) cards.push(v)
    const worldbook = []
    for (const [k, v] of T.worldbook.entries()) if (k.startsWith(prefix) && v) worldbook.push(v)
    return { cards, worldbook }
  }

  const recordVersionsFor = (session: Pick<StateSession,'id'>) => ({
    cards:Object.fromEntries([...T.cards.entries()].filter(([k])=>k.startsWith(`${session.id}__`)).map(([k,v])=>[k.slice(session.id.length+2),recordSha256(v)])),
    worldbook:Object.fromEntries([...T.worldbook.entries()].filter(([k])=>k.startsWith(`${session.id}__`)).map(([k,v])=>[k.slice(session.id.length+2),recordSha256(v)])),
    memory:recordSha256(T.memory.get(keyOf(session.id,'head'))),settings:recordSha256(T.branch.get(keyOf(session.id,'settings'))),
    status:recordSha256(T.status.get(keyOf(session.id,'spec'))),rules:recordSha256(T.rules.get(keyOf(session.id,'spec'))),opening:recordSha256(T.opening.get(keyOf(session.id,'scene'))),
  })
  const readRoleplayState = async (session: StateSession) => {
    await awaitImportBarrier(session.id)
    await ensureBranch(session)
    let forkLookup = buildForkLookupIndex(session)
    await reconcileCanonicalPlayerVariants(session, forkLookup)
    if (!statusRecoveredSessions.has(session.id)) {
      statusRecoveredSessions.add(session.id)
      recoverStatusObligations(session, 'session-resume')
    }
    const branchGroupsByMessageId = await nativeBranchGroupsFor(session, forkLookup)
    // nativeBranchGroupsFor deliberately rebuilds its own lookup after repair;
    // use a fresh index for the related player/deletion projections too.
    forkLookup = buildForkLookupIndex(session)
    const userActionsBySeq = await nativePlayerGroupsFor(session, branchGroupsByMessageId)
    const failedTurnRecoveryByTurn: Record<string, number> = {}, failedTurnBranchGroupByTurn: Record<string, FailedTurnGroup> = {}, assistantActionAnchorsByTurn: Record<string, {seq: number; messageId: string}> = {}
    const internalMessages = internalTaskSeqs(session)
    const internalAssistantMessageIds: string[] = []
    const endedTurns = new Set<number>()
    for (const event of eventsOf(session)) {
      if (event.type === 'assistant/message' && internalMessages.has(event.seq)) {
        const id = assistantMessageId(event as StoryEvent)
        if (id) internalAssistantMessageIds.push(id)
      }
      if (event.type === 'turn/end') endedTurns.add(Number(event.data?.turn))
    }
    for (const turn of endedTurns) {
      const canonical = canonicalAssistantForTurn(session, turn)
      const messageId = canonical && assistantMessageId(canonical as StoryEvent)
      if (messageId) assistantActionAnchorsByTurn[String(turn)] = { seq:Number(canonical.seq), messageId }
    }
    const maintenanceTurns = new Set<number>(), playerTurns = new Set<number>()
    let activeTurn: number | null = null
    for (const event of eventsOf(session)) {
      if (event?.type === 'turn/start') activeTurn = Number(event.data?.turn)
      if (event?.type === 'user/message' && event.data?.source?.kind === 'roleplay-tasks' && Number.isSafeInteger(activeTurn)) maintenanceTurns.add(activeTurn!)
      if (event?.type === 'user/message' && event.data?.source?.kind === 'user' && Number.isSafeInteger(activeTurn)) {
        playerTurns.add(activeTurn!)
        try {
          if (endedTurns.has(activeTurn!) && !canonicalAssistantForTurn(session, activeTurn)) {
            const context = userForkContext(session, Number(event.seq))
            failedTurnRecoveryByTurn[String(activeTurn)] = Number(context.event.seq)
            const recovery = locatePlayerRecoveryTarget(session, Number(context.event.seq))
            let membership = failedForkMembership(session, context.event, forkLookup)
            // A historical child can belong to a recovery group whose anchor
            // points at its failed root.  Repair that root, rather than
            // treating the child as a new source with a different anchor.
            const repairAnchor = membership?.group?.anchor?.recoveryOnly === true
              ? membership!.group.anchor
              : recovery
            const hasOrigin=membership?.group?.members.some(member=>isRecoverySourceMember(member,repairAnchor))
            if (repairAnchor && !hasOrigin && await backfillRecoverySourceMember(repairAnchor)) {
              forkLookup = buildForkLookupIndex(session)
              membership = failedForkMembership(session, context.event, forkLookup)
            }
            const group = membership?.group
            if (group) {
              const current = membership!.member
              // Legacy failure cleanup marked empty failed members deleted.
              // Restore navigation for this proven current failed request only;
              // explicit deletion of completed prose is never revived.
              const members = group.members.filter(member =>
                member.playerVariantId === current.playerVariantId &&
                (!member.deleted || member === current && member.failed && !member.assistantMessageId && member.failureReason !== '客户端放弃等待'))
              if (members.includes(current)) failedTurnBranchGroupByTurn[String(activeTurn)] = {
                groupId:group.groupId,currentOrdinal:members.indexOf(current)+1,total:members.length,
                members:members.map((member,index)=>({sessionId:member.sessionId,ordinal:index+1,sourceOrdinal:member.ordinal,kind:member.kind,pending:member.pending===true,failed:member.failed===true})),
              }
            }
          }
        } catch {}
      }
    }
    const { cards, worldbook } = collectBranchRecords(session)
    const activeImport = T.branch.get(importActiveKey(session.id)) ?? null
    const importSourceSessionId = activeImport?.sourceRecordSessionId ?? session.id
    const activeImportRecord = activeImport?.importId
      ? T.branch.get(importRecordKey(importSourceSessionId, activeImport.importId))
      : null
    const versions = T.branch.get(keyOf(session.id, 'versions')) ?? { anchors: {} }
    const flatVersions = []
    for (const [anchor, group] of Object.entries(versions.anchors ?? {})) {
      for (const [i, e] of (group.entries ?? []).entries()) {
        flatVersions.push({
          anchorSeq: Number(anchor),
          turn: Number(e.turn),
          seq: Number(e.seq),
          ordinal: i + 1,
          total: group.entries!.length,
        })
      }
    }
    return {
      ok: true,
      preset: 'roleplay',
      sessionId: session.id,
      activity:readRoleplayActivity(session,T.branch.get(preparationRecordKey(session.id)) as unknown as StatePreparation,tavernTasks.activity(session)),
      // The state endpoint is also consumed by the Reader UI.  It must expose
      // the same branch-filtered ledger used for prompt assembly; returning the
      // raw head here leaked post-fork parent facts into an unselected child.
      memory: memoryForContext(session),
      directorNotes: ctx.get('compaction')?.directorNotes?.(session) ?? null,
      contextWindow: cloneContextWindow(contextWindowFor(session)),
      cards,
      worldbook,
      scene: T.scene.get(keyOf(session.id, 'current')) ?? null,
      settings: T.branch.get(keyOf(session.id, 'settings')) ?? null,
      statusSpec: T.status.get(keyOf(session.id, 'spec')) ?? null,
      statusPanel: selectedStatusRecord(session),
      statusGeneration: selectedStatusGeneration(session),
      rules: T.rules.get(keyOf(session.id, 'spec')) ?? null,
      opening: T.opening.get(keyOf(session.id, 'scene')) ?? null,
      cardImport: activeImportRecord
        ? { ...importSummary(activeImportRecord as unknown as ImportRecord), sourceRecordSessionId: importSourceSessionId }
        : activeImport,
      drafts: [...T.drafts.entries()].filter(([k]) => k.startsWith(`${session.id}__draft__`)).map(([, v]) => ({ draft_id: v?.id, idea: String(v?.idea ?? '').slice(0, 80), modules: Object.keys(v?.modules ?? {}), updatedAt: v?.updatedAt })),
      versions: flatVersions,
      branchGroupsByMessageId,
      userActionsBySeq,
      failedTurnRecoveryByTurn,
      failedTurnBranchGroupByTurn,
      assistantActionAnchorsByTurn,
      internalAssistantMessageIds,
      internalMaintenanceTurns:[...maintenanceTurns].filter(turn=>endedTurns.has(turn)&&!playerTurns.has(turn)&&!assistantActionAnchorsByTurn[String(turn)]),
      deletedBranchMessageIds: deletedBranchMessageIdsFor(session, forkLookup),
      inheritedAssistantMessageIds: inheritedAssistantMessageIdsFor(session, forkLookup),
      // The append-only audit log can contain regenerated/deleted siblings.
      // Reader and memory consumers must address only these authoritative
      // nodes, which are exactly what the next model request sees.
      recordVersions:recordVersionsFor(session),
      surfaceNodes: surfaceEntries(session).map((entry) => ({
        seq: entry.seq,
        kind: entry.kind,
        messageId: entry.messageId,
        turn: entry.turn,
        step: entry.step,
        time: entry.time,
      })),
       decision: normalizeDecisionRecord(T.decision.get(keyOf(session.id, 'current'))),
       userinfo: userValues(session.id),
      lineage: svc.branchLineage(session),
    }
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({requestBody: 'buffered',
        path: '/api/roleplay/state',
        methods: ['GET'],
        fetch: async (request) => {
          try {
            const url = new URL(request.url)
            const session = await resolveRoleplaySession(url.searchParams.get('sessionId'))
            if (!session) return jsonResponse(404, { ok: false, error: 'roleplay 会话不存在、无法恢复或并非角色扮演会话' })
            return jsonResponse(200, await readRoleplayState(session))
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String((error as {message?: unknown})?.message ?? error) })
          }
        },
      }),
    'roleplay: route state'
  )

  ctx.effect(()=>ctx.connection.fetch.register({requestBody: 'buffered',path:'/api/roleplay/activity',methods:['GET'],fetch:async request=>{
    const session=await resolveRoleplaySession(new URL(request.url).searchParams.get('sessionId'))
    if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
    return jsonResponse(200,{ok:true,...readRoleplayActivity(session,T.branch.get(preparationRecordKey(session.id)) as unknown as StatePreparation,tavernTasks.activity(session))})
  }}),'roleplay: lightweight activity and deferred player echo')

  return {collectBranchRecords, recordVersionsFor, readRoleplayState}
}
