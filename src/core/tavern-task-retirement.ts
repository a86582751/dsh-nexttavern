import { randomUUID } from 'node:crypto';
import { taskHash } from './tavern-task-primitives.js';
import { retireFinishedAdaptation, retireDeliveredDraft } from './card-adaptation-context.js';
import { taskValidationFailure, taskFailureDetails, FAILURE_LABELS } from './tavern-task-support.js';
import type { TaskContextSession, TaskEvent, TaskBlock, InlineContextJob } from './tavern-task-context.js';
interface TurnGroup {
    turn?: number;
    export: boolean;
    story: boolean;
    completed: boolean;
}
export const taskContextRecord = (value: unknown): Record<string,
     unknown> | undefined => value !== null
    && typeof value === 'object' ? value as Record<string,
     unknown> : undefined;
/** Share the owning projection cache while keeping all receipt writes in one implementation. */
export function createTaskRetirement({ internalTaskSeqs, inlineTaskEnvelope }: {
    internalTaskSeqs(session: TaskContextSession): Set<number>;
    inlineTaskEnvelope(text: string): unknown;
}) {
    function completedImportSpan(nodes: number[], lookup: Map<number, TaskEvent>) {
        const callsOf = (e: TaskEvent | undefined) => e?.type === 'assistant/message' ? (e.data?.message?.content
            ?? []).filter(b => b.type === 'tool-call') : [];
        const begin = nodes.findIndex(seq => callsOf(lookup.get(seq)).some(b => b.name === 'rp_card_import_begin'));
        if (begin < 0)
            return null;
        const calls = new Map<string,
             string>(),
             results = new Set<string>(),
             allowed = /^(?:skill|rp_card_import_(?:begin|chunk|stage|finalize)|rp_task_(?:read|submit))$/;
        for (let i = begin; i < nodes.length; i++) {
            const e = lookup.get(nodes[i]!);
            if (e?.type === 'assistant/message') {
                const blocks = callsOf(e);
                if (!blocks.length)
                    return null;
                for (const b of blocks) {
                    if (!allowed.test(b.name ?? '') || !b.id || calls.has(b.id))
                        return null;
                    calls.set(b.id, b.name!);
                }
            }
            else if (e?.type === 'tool/result') {
                const m = e.data?.message, id = m?.source?.callId;
                if (!m || !id || !calls.has(id) || results.has(id))
                    return null;
                results.add(id);
                if (calls.get(id) === 'rp_card_import_finalize') {
                    const wrapped = (m.content ?? []).filter(b => b.type === 'tool-result');
                    if (wrapped.length && (wrapped.length !== 1 || wrapped[0]!.toolCallId !== id))
                        return null;
                    const result = wrapped[0] ?? m;
                    let proof: Record<string, unknown> | undefined;
                    try {
                        proof = taskContextRecord(JSON.parse((result.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')));
                    }
                    catch {
                        return null;
                    }
                    // Native finalize's `status` is the presence of a status template,
                    // not the import lifecycle. Activation time/hash prove the commit.
                    if (m.isError || result.isError || proof?.ok !== true
                        || !(typeof proof.activatedAt === 'number' && proof.activatedAt > 0)
                        || !Number.isFinite(proof.activatedAt)
                        || !/^[a-f0-9]{64}$/.test(String(proof.normalizedSha256 ?? ''))
                        || proof.coverage !== 1
                        || !proof.importId
                        || calls.size !== results.size)
                        return null;
                    return {
                        nodes: nodes.slice(begin, i + 1),
                        importId: proof.importId,
                        normalizedSha256: proof.normalizedSha256
                    };
                }
            }
            else if (e?.type !== 'user/message' || e.data?.source?.kind !== 'plugin' || e.data.source.plugin !== 'roleplay-tasks'
                || e.data.source.form !== 'phase'
                || ['story', 'after-story'].includes(e.data.source.stage ?? ''))
                return null;
        }
        return null;
    }
    /** Retire completed export-only turns and proven import tool preludes once. Ordinary story/maintenance prefixes
     * stay byte-identical until hard-window eviction. The audit log is never edited. */
    function retireCompletedTaskContexts(session: TaskContextSession, currentTurn: number, activeImport?: {
        importId: string;
        normalizedSha256: string;
        opening: string;
    }) {
        if (typeof session?.append !== 'function')
            return 0;
        const retiredResearch = retireDeliveredDraft(session, currentTurn) + retireFinishedAdaptation(session, currentTurn, activeImport);
        const events = session.events
            ?? session.log
            ?? [],
             groups: TurnGroup[] = [],
             bySeq = new Map<number,
             TurnGroup>(),
             lookup = new Map<number,
             TaskEvent>();
        let group: TurnGroup | null = null;
        for (const e of events) {
            if (!e)
                continue;
            lookup.set(e.seq, e);
            if (e.type === 'turn/start') {
                group = {
                    turn: e.data?.turn, export: false, story: false, completed: false
                };
                groups.push(group);
            }
            if (group)
                bySeq.set(e.seq, group);
            const source = e.type === 'user/message' ? e.data?.source : null;
            if (group && source?.kind === 'plugin' && source.plugin === 'roleplay-tasks') {
                if (['card-export', 'novel-export'].includes(source.jobKind ?? ''))
                    group.export = true;
                if (source.form === 'phase' && ['story', 'after-story'].includes(source.stage ?? ''))
                    group.story = true;
            }
            if (group && e.type === 'tool/call'
                && /^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export)$/.test(e.data?.name ?? ''))
                group.export = true;
            if (group && e.type === 'turn/end') {
                group.completed = e.data?.reason?.kind === 'completed';
                group = null;
            }
        }
        const visible = [...(session.surface?.nodes ?? [])], nodesByGroup = new Map<TurnGroup, number[]>(), positions = new Map<number, number>();
        for (let index = 0; index < visible.length; index++) {
            const seq = visible[index]!;
            if (!positions.has(seq))
                positions.set(seq, index);
            const owner = bySeq.get(seq);
            if (owner) {
                if (!nodesByGroup.has(owner))
                    nodesByGroup.set(owner, []);
                nodesByGroup.get(owner)!.push(seq);
            }
        }
        let retired = retiredResearch;
        for (const candidate of groups) {
            const currentImport = !!activeImport && candidate.turn === currentTurn;
            if ((!candidate.completed || candidate.turn === currentTurn) && !currentImport)
                continue;
            const groupNodes = nodesByGroup.get(candidate) ?? [];
            const imported = completedImportSpan(groupNodes, lookup);
            if (currentImport
                && (!imported || imported.importId !== activeImport!.importId
                    || imported.normalizedSha256 !== activeImport!.normalizedSha256))
                continue;
            if (!imported && (!candidate.export || candidate.story))
                continue;
            const selected = imported?.nodes ?? groupNodes;
            if (!selected.length)
                continue;
            const start = selected[0]!, end = selected.at(-1)!, first = positions.get(start)!, last = positions.get(end)!;
            // A branch-local replacement/checkpoint can interleave nodes from another
            // turn. Never consume a foreign story to retire management material.
            if (last - first + 1 !== selected.length)
                continue;
            let contiguous = true;
            for (let index = first; index <= last; index++) {
                const seq = visible[index]!;
                if (!lookup.has(seq) || bySeq.get(seq) !== candidate) {
                    contiguous = false;
                    break;
                }
            }
            if (!contiguous)
                continue;
            const receipt = {
                schemaVersion: 1,
                kind: 'plugin',
                plugin: 'roleplay-tasks',
                form: 'management-receipt',
                sessionId: session.id,
                sourceTurn: candidate.turn,
                sourceSha256: taskHash(selected.map(seq => lookup.get(seq))),
                start,
                end,
                ...(imported ? {
                    jobKind: 'card-import', importId: imported.importId
                } : {})
            };
            session.append('user/message', {
                id: randomUUID(),
                role: 'user',
                source: receipt,
                content: [
                    {
                        type: 'text',
                        text: imported ? `读卡已完整激活。设定由当前角色扮演栏目提供，原始读卡消息与工具结果保存在历史 seq ${start}–${end}。${currentImport ? '作者原始开场（原样展示，不提前续写）：\n' + activeImport!.opening : '以下继续剧情。'}` : `导出操作已结束。原始消息与工具结果保存在历史 seq ${start}–${end}，导出文件可在资源库查看。以下继续剧情。`
                    }
                ]
            }, {
                surfaceOp: {
                    op: 'replace', start, end
                },
                sourceEventSeqs: selected
            });
            retired += selected.length;
        }
        return retired;
    }
    /** Program-selected prompt retention. Terminal task attempts become receipts;
     * durable source data, validation results and every raw event stay recoverable. */
    function retireSettledInlineContexts(session: TaskContextSession, currentTurn: number, jobs: readonly InlineContextJob[]) {
        if (!session.append)
            return 0;
        const events = session.events
            ?? session.log
            ?? [],
             lookup = new Map(events.map(e => [e.seq,
             e])),
             owners = new Map<number,
             number>(),
             ended = new Set<number>();
        let turn: number | undefined;
        for (const e of events) {
            if (e.type === 'turn/start')
                turn = e.data?.turn;
            if (turn !== undefined)
                owners.set(e.seq, turn);
            if (e.type === 'turn/end') {
                if (turn !== undefined)
                    ended.add(turn);
                turn = undefined;
            }
        }
        const internal = internalTaskSeqs(session), visible = [...(session.surface?.nodes ?? [])], groups: number[][] = [];
        let group: number[] = [];
        const flush = () => {
            if (group.length)
                groups.push(group);
            group = [];
        };
        for (const seq of visible) {
            const e = lookup.get(seq)!, source = e.type === 'user/message' ? e.data?.source : undefined, owner = owners.get(seq);
            if (owner === undefined || owner >= currentTurn || !ended.has(owner)
                || group.length && owners.get(group[0]!) !== owner) {
                flush();
                if (owner === undefined || owner >= currentTurn || !ended.has(owner))
                    continue;
            }
            if (e.type === 'user/message') {
                if (source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' && source.form === 'phase'
                    && ['after-story', 'prepare', 'management'].includes(source.stage ?? '')) {
                    flush();
                    group.push(seq);
                    continue;
                }
                flush();
                continue;
            }
            if (group.length && ((e.type === 'assistant/message' && internal.has(seq)) || e.type === 'tool/result'))
                group.push(seq);
            else
                flush();
        }
        flush();
        const jobById = new Map(jobs.map(j => [j.id, j])), terminal = new Set(['completed', 'failed', 'cancelled', 'stale']);
        let retired = 0;
        for (const selected of groups) {
            const attempts = new Map<string, {
                id: string;
                generation: string;
                sourceHash: string;
                kind: string;
                state: string;
                failure?: string;
            }>(), calls = new Set<string>(), results = new Set<string>();
            let valid = true;
            for (const seq of selected) {
                const e = lookup.get(seq)!;
                if (e.type === 'user/message') {
                    const source = e.data?.source;
                    if (source?.storySeq !== undefined) {
                        const story = lookup.get(Number(source.storySeq));
                        if (!story || !Number.isSafeInteger(source.storySeq) || source.turn !== owners.get(seq)
                            || story.type !== 'assistant/message'
                            || owners.get(story.seq) !== owners.get(seq)
                            || internal.has(story.seq)
                            || story.seq >= seq) {
                            valid = false;
                            break;
                        }
                    }
                    const text = (e.data?.content as readonly TaskBlock[] | undefined ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
                    let tasks: unknown;
                    try {
                        tasks = inlineTaskEnvelope(text);
                    }
                    catch {
                        valid = false;
                        break;
                    }
                    if (tasks === null)
                        continue;
                    if (!Array.isArray(tasks) || !tasks.length) {
                        valid = false;
                        break;
                    }
                    for (const raw of tasks) {
                        const task = taskContextRecord(raw), job = typeof task?.id === 'string' ? jobById.get(task.id) : undefined;
                        if (!task || !job || job.sessionId !== session.id || job.execution !== 'inline'
                            || !['status', 'decision', 'memory'].includes(job.kind)
                            || job.kind !== task.kind
                            || typeof task.generation !== 'string'
                            || !task.generation
                            || !job.generation
                            || !job.sourceHash
                            || job.sourceHash !== task.sourceHash) {
                            valid = false;
                            break;
                        }
                        const same = job.generation === task.generation;
                        // Explicit retry changes generation. The old attempt is retired even
                        // while the new one runs; the new attempt's context is preserved.
                        if (same && !terminal.has(job.status)) {
                            valid = false;
                            break;
                        }
                        const category = taskContextRecord(job.failure)?.category;
                        const failure = job.status === 'failed'
                            ? taskValidationFailure(job)
                                ? '任务结果校验失败'
                                : typeof category === 'string'
                                    && Object.hasOwn(FAILURE_LABELS, category)
                                    ? FAILURE_LABELS[category as keyof typeof FAILURE_LABELS]
                                    : taskFailureDetails(job.error).label
                            : job.status === 'stale'
                                ? '来源已变化，旧结果不可使用'
                                : undefined;
                        attempts.set(`${job.id}:${task.generation}`, {
                            id: job.id,
                            generation: task.generation,
                            sourceHash: job.sourceHash,
                            kind: job.kind,
                            state: same || ['cancelled', 'stale', 'failed'].includes(job.status) ? job.status : 'superseded',
                            ...(failure ? {
                                failure
                            } : {})
                        });
                    }
                    if (!valid)
                        break;
                }
                else if (e.type === 'assistant/message') {
                    for (const b of e.data?.message?.content ?? [])
                        if (b.type === 'tool-call') {
                            if (typeof b.id !== 'string' || calls.has(b.id)
                                || !['rp_task_read', 'rp_task_submit', 'run_code'].includes(b.name ?? '')) {
                                valid = false;
                                break;
                            }
                            calls.add(b.id);
                        }
                }
                else if (e.type === 'tool/result') {
                    const id = e.data?.message?.source?.callId;
                    if (typeof id !== 'string' || !calls.has(id) || results.has(id)) {
                        valid = false;
                        break;
                    }
                    results.add(id);
                }
                if (!valid)
                    break;
            }
            if (!valid || !attempts.size)
                continue;
            // A stopped attempt can have no result. It is safe to retire the call only
            // when no still-visible result elsewhere would become orphaned.
            const selectedSet = new Set(selected);
            if (visible.some(seq => {
                const e = lookup.get(seq);
                return !selectedSet.has(seq) && e?.type === 'tool/result' && calls.has(e.data?.message?.source?.callId ?? '');
            }))
                continue;
            const details = [...attempts.values()],
                 recover = details.filter(a => a.state === 'failed'),
                 stale = details.some(a => a.state === 'stale'),
                 sourceTurn = owners.get(selected[0]!)!;
            const text = `先前维护尝试已结束或被新尝试替代，完整参数、输出与错误记录保留在历史 seq ${selected[0]}–${selected.at(-1)}。成功结果采用最新状态及笔记；失败、取消或过期不是剧情事实。任务概况：${JSON.stringify(details.slice(0,
                 8).map(({ id,
                 kind,
                 state,
                 failure }) => ({
                id,
                kind,
                state,
                ...(failure ? {
                    failure
                } : {})
            })))}${details.length > 8 ? `；其余 ${details.length - 8} 项见酒馆管理日志。` : ''}${recover.length ? '尚未解决的失败可在酒馆管理日志中重试；需要完整来源时用 rp_task_read(id)，不要依据旧尝试继续提交。' : ''}${stale ? '过期任务须由酒馆管理按当前来源重新发起，不能重交旧快照；详情可用 rp_task_read(id) 查阅。' : ''}`;
            session.append('user/message', {
                id: randomUUID(),
                role: 'user',
                source: {
                    kind: 'plugin',
                    plugin: 'roleplay-tasks',
                    form: 'maintenance-receipt',
                    schemaVersion: 1,
                    sessionId: session.id,
                    sourceTurn,
                    attempts: details,
                    sourceSha256: taskHash(selected.map(seq => lookup.get(seq)))
                },
                content: [{
                        type: 'text', text
                    }]
            }, {
                surfaceOp: {
                    op: 'replace', start: selected[0]!, end: selected.at(-1)!
                },
                sourceEventSeqs: selected
            });
            retired += selected.length;
        }
        return retired;
    }
    /** Read evidence survives the request that needs it. At a later player turn,
     * retire pure read groups only after a committed body and completed turn. */
    function retireUsedStoryReads(session: TaskContextSession, currentTurn: number) {
        if (!session.append)
            return 0;
        const events = session.events
            ?? session.log
            ?? [],
             lookup = new Map(events.map(e => [e.seq,
             e])),
             nodes = [...(session.surface?.nodes
            ?? [])],
             owners = new Map<number,
             number>(),
             completed = new Set<number>(),
             bodies = new Map<number,
             number>();
        let turn: number | undefined;
        for (const e of events) {
            if (e.type === 'turn/start')
                turn = e.data?.turn;
            if (turn !== undefined)
                owners.set(e.seq, turn);
            const source = e.type === 'user/message' ? e.data?.source : undefined;
            if (turn !== undefined && source?.kind === 'plugin' && source.plugin === 'roleplay-tasks'
                && source.form === 'phase'
                && source.stage === 'after-story'
                && source.turn === turn
                && Number.isSafeInteger(source.storySeq)) {
                const body = lookup.get(Number(source.storySeq));
                if (body?.type === 'assistant/message' && owners.get(body.seq) === turn && body.seq < e.seq)
                    bodies.set(turn, body.seq);
            }
            if (e.type === 'turn/end') {
                if (turn !== undefined && e.data?.reason?.kind === 'completed')
                    completed.add(turn);
                turn = undefined;
            }
        }
        const allowed = new Set(['rp_history', 'rp_worldbook_list', 'rp_worldbook_search']), internal = internalTaskSeqs(session);
        let retired = 0;
        for (let i = 0; i < nodes.length; i++) {
            const e = lookup.get(nodes[i]!)!, owner = owners.get(e.seq), body = owner === undefined ? undefined : bodies.get(owner);
            if (e.type !== 'assistant/message' || owner === undefined || owner >= currentTurn || !completed.has(owner)
                || body === undefined
                || body <= e.seq
                || internal.has(body))
                continue;
            const blocks = (e.data?.message?.content ?? []).filter(b => b.type !== 'reasoning' && !(b.type === 'text' && !String(b.text ?? '').trim()));
            if (!blocks.length || blocks.some(b => b.type !== 'tool-call' || !b.id || !allowed.has(b.name ?? '')))
                continue;
            const calls = new Set(blocks.map(b => b.id!));
            if (calls.size !== blocks.length)
                continue;
            const selected = [e.seq], pending = new Set(calls);
            let j = i + 1;
            for (; j < nodes.length && pending.size; j++) {
                const result = lookup.get(nodes[j]!)!, id = result.data?.message?.source?.callId;
                if (result.type !== 'tool/result' || owners.get(result.seq) !== owner || result.seq >= body || !id
                    || !pending.has(id))
                    break;
                pending.delete(id);
                selected.push(result.seq);
            }
            if (pending.size)
                continue;
            const start = selected[0]!, end = selected.at(-1)!, tools = [...new Set(blocks.map(b => b.name!))];
            session.append('user/message', {
                id: randomUUID(),
                role: 'user',
                source: {
                    kind: 'plugin',
                    plugin: 'roleplay-tasks',
                    form: 'read-evidence-receipt',
                    schemaVersion: 1,
                    sessionId: session.id,
                    sourceTurn: owner,
                    bodySeq: body,
                    tools,
                    sourceSha256: taskHash(selected.map(seq => lookup.get(seq)))
                },
                content: [
                    {
                        type: 'text',
                        text: `先前 ${tools.join(' / ')} 读取已完成本轮使用；原始调用与结果保留于历史 seq ${start}–${end}。需要旧事实或世界知识时重新按当前世界线查阅，读取记录本身不是已发生剧情；失败结果不作事实依据。`
                    }
                ]
            }, {
                surfaceOp: {
                    op: 'replace', start, end
                },
                sourceEventSeqs: selected
            });
            retired += selected.length;
            i = j - 1;
        }
        return retired;
    }
    return {
        retireCompletedTaskContexts, retireSettledInlineContexts, retireUsedStoryReads
    };
}
