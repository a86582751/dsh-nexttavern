import { keyOf, sha256 } from './roleplay-data.js'
import { maintenancePrompt } from './tavern-task-context.js'
import { surfaceEntries } from './roleplay-context.js'
import { fenceCardContent } from './tavern-card.js'
import type { DecisionDependencies, DecisionSnapshot, DecisionSession, DecisionEvent, DecisionJob, DecisionOption } from './roleplay-decision-types.js'

  // A task may be admitted by a tool or a recovery event before turn-stopping
  // attaches. Every owner can cancel the same durable task, including when
  // its original admission had no turn signal. Listeners end with the job.
export function taskCancellation(initial?: AbortSignal) {
    const controller=new AbortController(),listeners=new Map<AbortSignal, () => void>()
    const follow=(signal?: AbortSignal)=>{
      if(!signal||listeners.has(signal))return
      const abort=()=>controller.abort(signal.reason)
      listeners.set(signal,abort)
      signal.addEventListener('abort',abort,{once:true})
      if(signal.aborted)abort()
    }
    follow(initial)
    return {signal:controller.signal,follow,retrySignal:()=>listeners.size?AbortSignal.any([...listeners.keys()]):undefined,
      dispose:()=>{for(const [signal,abort] of listeners)signal.removeEventListener('abort',abort);listeners.clear()}}
  }
export function createRoleplayDecision(deps: DecisionDependencies) {
  const { withDecisionMutationLock, normalizeDecisionRecord, T, taskStory, isStale, isLatestVisibleTurn, statusSource, modelPolicy, selectedStatusRecord, sameModelRoute, normalizeStatusRecord, normalizeStatusOption, buildDecisionContext, memoryForContext, ctx, resolveRoute, llmJson, DECISION_SYSTEM, cfg, DEFAULT_CONFIG } = deps
  const decisionJobs=new Map<string, DecisionJob>()
  function publishTurnDecision(session: DecisionSession,event: DecisionEvent,snapshot: DecisionSnapshot,narrative: string,signal?: AbortSignal) {
    const key=`${session.id}:${event.seq}`
    if(decisionJobs.has(key)) {
      const existing=decisionJobs.get(key)!
      existing.cancellation.follow(signal)
      return existing
    }
    const cancellation=taskCancellation(signal)
    let admitted!: (value: unknown) => void
    const admission=new Promise(resolve=>{admitted=resolve})
    const work=Promise.resolve().then(()=>generateTurnDecision(session,event,snapshot,narrative,admitted,cancellation.signal))
      .finally(()=>{cancellation.dispose();admitted(null);if(decisionJobs.get(key)===work)decisionJobs.delete(key)}) as DecisionJob
    work.admission=admission
    work.cancellation=cancellation
    decisionJobs.set(key,work)
    return work
  }
  async function generateTurnDecision(session: DecisionSession, event: DecisionEvent, snapshot: DecisionSnapshot, narrative: string, onAdmission: (value: unknown) => void, signal?: AbortSignal) {
    const branchId = session.id
    const key = keyOf(branchId, 'current')
    const canPublish = () => {
      const current = normalizeDecisionRecord(T.decision.get(key))
      const currentTurn = Number(current?.turnId)
      const requestedTurn = Number(snapshot.turnId)
      // Only a decision from this turn or a later turn can block publication.
      // A previous turn is deliberately superseded when the new narrative ends.
      if (current && Number.isFinite(currentTurn) && currentTurn > requestedTurn) return false
      if (current && currentTurn === requestedTurn) {
        if (current.answered === true || current.superseded === true) return false
        if (Array.isArray(current.options) && current.options.length > 0) return false
      }
      return isLatestVisibleTurn(session, snapshot.turnId, event.seq)
        && !isStale(session, snapshot, event.seq)
    }

    // Admission is serialized, but the worker call is not: holding the lock for
    // up to 60s would block a user answer or a new-turn supersede operation.
    const admitted = await withDecisionMutationLock(branchId, async () => canPublish())
    if (!admitted) return

    const toolInput = T.status.get(keyOf(branchId, `input-${Number(snapshot.turnId)}`))
    const source = statusSource(session, event)
    const inputMatches = toolInput?.sessionId === branchId && toolInput?.userSeq === source?.sourceSeqs?.[0] &&
      toolInput?.userHash === sha256(surfaceEntries(session).find(entry => entry.seq === toolInput.userSeq)?.text ?? '')
    const selection=await modelPolicy.resolve(session,'decision',snapshot?.agent)
    const candidates=[selectedStatusRecord(session),...(inputMatches?[normalizeStatusRecord(toolInput)]:[])]
    const panelNow=candidates.find(panel=>sameModelRoute(panel?.provenance?.actualRoute,selection.actualRoute)&&
      (Number(panel?.turnId)===Number(snapshot.turnId)||(panel?.turnId==null&&Number(panel?.atSeq??-1)>Number(snapshot.baseRevision)&&Number(panel?.atSeq??-1)<=Number(event.seq))))
    let executionProvenance: Record<string, unknown> | null=panelNow?{...panelNow.provenance,reusedFrom:'status',statusSeq:panelNow.atSeq}:null
    let decisionOptions: DecisionOption[] = []
    const panelBelongsToTurn =
      Number(panelNow?.turnId) === Number(snapshot.turnId) ||
      (panelNow?.turnId == null &&
        Number(panelNow?.atSeq ?? -1) > Number(snapshot.baseRevision) &&
        Number(panelNow?.atSeq ?? -1) <= Number(event.seq))
    if (panelBelongsToTurn && Array.isArray(panelNow?.panel?.options)) {
      decisionOptions = panelNow.panel.options
        .map(normalizeStatusOption)
        .filter((option) => option.label)
        .map((option) => ({
          label: option.label.slice(0, 60),
          description: option.description ? option.description.slice(0, 120) : undefined,
          heart: option.heart === true,
        }))
        .slice(0, 3)
    }

    if (!decisionOptions.length) {
      const decisionContext=await buildDecisionContext(T,branchId,{narrative,userText:snapshot.userText,
        scene:T.scene.get(keyOf(branchId,'current')),memory:memoryForContext(session),
        directorNotes:ctx.get('compaction')?.directorNotes?.(session)?.text})
      const generated = await llmJson(ctx, resolveRoute(session, snapshot?.agent), {
        system: DECISION_SYSTEM,
        signal,
        onAdmission,
        selection,
        source:{events:taskStory(session).filter(e=>source!.sourceSeqs.includes(e.seq)).map(e=>({seq:e.seq,hash:sha256(e.text)})),dependencies:decisionContext.dependencies},
        onResult:task=>{executionProvenance={taskId:task.id,generation:task.generation,actualRoute:task.actualRoute,execution:task.execution}},
        ...maintenancePrompt(decisionContext.context,'当前分支的决策依据：\n','\n\n依据最新正文、人物动机、导演笔记及本轮世界书查询提出可选行动。剧情指引是可能性，不是已发生事实；不要替玩家执行选项，不要泄露角色尚不知道的秘密。只输出决策卡选项 JSON，不输出美化代码。','decision'),
        maxTokens: 800,
        temperature: 0.7,
        timeoutMs: Number(cfg.decisionWorkerTimeoutMs) || DEFAULT_CONFIG.decisionWorkerTimeoutMs,
      })
      if (generated && Array.isArray(generated.options)) {
        decisionOptions = generated.options
          .map(normalizeStatusOption)
          .filter((option) => option.label)
          .map((option) => ({
            label: option.label.slice(0, 60),
            description: option.description ? option.description.slice(0, 120) : undefined,
            heart: option.heart === true,
          }))
          .slice(0, 3)
      }
    }

    if (!decisionOptions.length) return
    return withDecisionMutationLock(branchId, async () => {
      if (!canPublish()) return
      const record = {
        schemaVersion: 1,
        source: 'auto',
        provenance:executionProvenance,
        sessionId: branchId,
        atSeq: event.seq,
        seq: event.seq,
        turnId: snapshot.turnId,
        question: '',
        options: decisionOptions,
        multiSelect: false,
        answered: false,
        choiceIndex: null,
        time: Date.now(),
      }
      if (T.decision.get(key) !== undefined && typeof T.decision.update === 'function') {
        await T.decision.update(key, (currentRaw) => {
          const current = normalizeDecisionRecord(currentRaw)
          if (Number(current?.turnId) === Number(snapshot.turnId) &&
            (current?.answered === true || current?.superseded === true)) return currentRaw
          if (current && Number.isFinite(Number(current.turnId))
            && Number(current.turnId) > Number(snapshot.turnId)) return currentRaw
          return record
        })
      } else {
        await T.decision.put(key, record)
      }
    })
  }
  return { publishTurnDecision, generateTurnDecision }
}
