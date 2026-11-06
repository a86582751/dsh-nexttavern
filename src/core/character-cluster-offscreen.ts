import { randomUUID } from 'node:crypto';
import { withTavernLock } from './tavern-task-support.js';
import { offscreenSettings, type CharacterSettings } from './character-cluster-projection.js';
import type { ClusterSettingsTable } from './character-cluster-settings.js';

export interface OffscreenRoute { provider: string; model: string; reasoningEffort?: unknown }
export interface OffscreenCandidate {
    characterId: string;
    player: boolean;
    presence: 'present' | 'absent' | 'unknown';
    ready: boolean;
    priority: number;
    relevance: number;
    activeGoals: number;
    lastAdvancedOrdinal: number;
    /** Frozen, already published private view; never the newly accepted player input. */
    view: unknown;
}
export interface OffscreenMember {
    characterId: string;
    view: unknown;
    taskId: string;
    generation: string;
    status: 'queued' | 'running' | 'generated' | 'published' | 'stale' | 'cancelled' | 'failed' | 'interrupted';
    result?: string;
    reason?: string;
    publicationId?: string;
}
export interface OffscreenBatch {
    schemaVersion: 1;
    id: string;
    branchId: string;
    inputId: string;
    ordinal: number;
    route: OffscreenRoute;
    members: OffscreenMember[];
}
export type OffscreenTask = Omit<OffscreenBatch, 'members'> & { member: OffscreenMember };
export const OFFSCREEN_PERSONA = `依据提供的本人已知材料，推演一小段本人场外生活、想法和持续目标的进展。
你不是旁白或世界裁判。不要替玩家或其他人物作决定，不确认物品转移、数值变化或重大世界变化。
涉及外部人物或世界的未确认结果只描述自己的尝试、意向或未证实认知，不把想做写成已经发生。
结果只会进入本人的私有记忆，后续可由本人的动作和台词影响剧情。只使用本人材料，不要求查看全局剧情。
用简短自然语言输出本人的进展，保留未知和误解，不输出HTML或系统报告。`;
interface BranchState {
    schemaVersion: 1;
    lastOrdinal: number;
    acceptedCount: number;
    previousBatches?: string[];
    batch?: OffscreenBatch;
}
type Publication = { status: 'published'; publicationId: string }
    | { status: 'pending' | 'stale' | 'failed'; reason: string };
interface Options {
    table: ClusterSettingsTable;
    settings(branchId: string): CharacterSettings;
    main(branchId: string): OffscreenRoute | PromiseLike<OffscreenRoute>;
    candidates(branchId: string): OffscreenCandidate[];
    /** Existing budget owner returns the allowed member count, not a concurrency override. */
    budget(branchId: string, route: OffscreenRoute): number;
    /** Adapter must reuse Native task/spawn and its request ledger; no foreground turn currency. */
    execute(task: OffscreenTask, signal: AbortSignal): Promise<string>;
    /** Read an already completed Native task after a process interruption.
     * This callback performs no request or regeneration. */
    recoverResult?(batch: OffscreenBatch, member: OffscreenMember): string | undefined | PromiseLike<string | undefined>;
    /** Private owner atomically checks source/profile/revision and publishes by task+generation.
     * Deterministic validation/currency failures return failed/stale; storage failures throw for publication-only retry. */
    publish(batch: OffscreenBatch, member: OffscreenMember): Promise<Publication>;
}

/** Durable cadence and per-member publication. This owner never writes Main, notes or world state. */
export function createCharacterOffscreen(options: Options) {
    const { table } = options;
    const running = new Map<string, Map<string, AbortController>>();
    const knownBranches = new Set<string>();
    let disposed = false;
    const key = (branch: string) => `character-offscreen__${branch}`;
    const storedState = (branch: string): BranchState => {
        knownBranches.add(branch);
        const stored = table.get(key(branch)) as BranchState | undefined;
        if (stored && stored.schemaVersion !== 1) throw new Error('场外任务记录版本不受支持');
        return stored ?? { schemaVersion: 1, lastOrdinal: 0, acceptedCount: 0 };
    };
    const read = (branch: string): BranchState => structuredClone(storedState(branch));
    const locked = <T>(branch: string, fn: () => Promise<T>) => withTavernLock(table, key(branch), fn);
    async function update(batch: OffscreenBatch, id: string, change: (member: OffscreenMember) => void) {
        return locked(batch.branchId, async () => {
            const state = read(batch.branchId);
            if (state.batch?.id !== batch.id) return;
            const member = state.batch.members.find(row => row.characterId === id)!;
            change(member);
            await table.put(key(batch.branchId), state);
        });
    }
    async function publish(batch: OffscreenBatch, member: OffscreenMember) {
        // Serialize correction/cancel with publication; the memory adapter owns its own source transaction.
        await locked(batch.branchId, async () => {
            const state = read(batch.branchId);
            if (state.batch?.id !== batch.id) return;
            const current = state.batch.members.find(row => row.characterId === member.characterId)!;
            if (current.status !== 'generated') return;
            const settings = options.settings(batch.branchId);
            if (disposed || !settings.enabled || !offscreenSettings(settings.offscreen).enabled) {
                current.status = 'cancelled'; current.reason = '场外推理已关闭';
                await table.put(key(batch.branchId), state);
                return;
            }
            const result = await options.publish(state.batch, current);
            if (result.status === 'published') {
                current.status = 'published'; current.publicationId = result.publicationId; delete current.reason;
            } else {
                if (result.status === 'stale' || result.status === 'failed') current.status = result.status;
                current.reason = result.reason;
            }
            await table.put(key(batch.branchId), state);
        });
    }
    /** Source/perception publication calls this in the same process. It never executes a model. */
    async function flush(branch: string) {
        if (disposed) return;
        const batch = storedState(branch).batch;
        if (!batch) return;
        const failures: unknown[] = [];
        for (const member of batch.members) {
            if (member.status !== 'generated') continue;
            try { await publish(batch, member); }
            catch (error) {
                // A failed storage publication retains generated text; another member can still publish.
                // Identity/material rejections must be returned as stale by the private owner adapter.
                try {
                    await update(batch, member.characterId, current => {
                        if (current.status === 'generated') current.reason = error instanceof Error ? error.message : String(error);
                    });
                } catch (writeError) { failures.push(writeError); }
            }
        }
        if (failures.length) throw new AggregateError(failures, '部分场外发布记录未能写入');
    }
    async function work(batch: OffscreenBatch, member: OffscreenMember, controller: AbortController) {
        try {
            const settings = options.settings(batch.branchId);
            if (disposed || !settings.enabled || !offscreenSettings(settings.offscreen).enabled) {
                await update(batch, member.characterId, current => {
                    current.status = 'cancelled'; current.reason = '场外推理已关闭';
                });
                return;
            }
            let admitted = false;
            await update(batch, member.characterId, current => {
                if (current.status === 'queued' && !controller.signal.aborted) {
                    current.status = 'running'; admitted = true;
                }
            });
            if (!admitted || controller.signal.aborted) return;
            // The executor receives only this member; another member's view cannot enter its prompt by serializing the task.
            const { members: _members, ...identity } = batch;
            const result = await options.execute({ ...identity, member }, controller.signal);
            if (!result.trim()) throw new Error('场外角色返回空结果');
            await update(batch, member.characterId, current => {
                if (current.status !== 'running' || controller.signal.aborted) return;
                current.status = 'generated'; current.result = result;
            });
            await publish(batch, member);
        } catch (error) {
            await update(batch, member.characterId, current => {
                if (current.status === 'cancelled' || current.status === 'published') return;
                // A generated result survives a publication write failure; recovery retries publication only.
                if (current.status !== 'generated') current.status = 'failed';
                current.reason = error instanceof Error ? error.message : String(error);
            });
        } finally {
            const members = running.get(batch.branchId);
            members?.delete(member.characterId);
            if (members?.size === 0) running.delete(batch.branchId);
        }
    }
    async function accepted(input: { branchId: string; inputId: string; ordinal: number; kind: 'story' | 'regenerate' | 'management' }) {
        if (disposed || input.kind !== 'story') return { status: 'ignored' as const };
        await flush(input.branchId);
        return locked(input.branchId, async () => {
            const state = read(input.branchId);
            // The accepted-input owner supplies a durable monotonic ordinal; retries reuse that ordinal.
            if (input.ordinal <= state.lastOrdinal) return { status: 'duplicate' as const };
            state.lastOrdinal = input.ordinal;
            const settings = options.settings(input.branchId), config = offscreenSettings(settings.offscreen);
            if (settings.enabled && config.enabled) state.acceptedCount++;
            const busy = running.has(input.branchId) || state.batch?.members.some(m =>
                ['queued', 'running', 'generated'].includes(m.status));
            if (!settings.enabled || !config.enabled || state.acceptedCount % 2 !== 0 || busy) {
                await table.put(key(input.branchId), state);
                return { status: busy ? 'busy' as const : 'skipped' as const };
            }
            const selected = config.route ?? settings.defaultRoute;
            const primary = !selected || 'main' in selected ? await options.main(input.branchId) : undefined;
            const route: OffscreenRoute = selected && !('main' in selected) ? { ...selected }
                : { ...primary!, ...(selected?.reasoningEffort ? { reasoningEffort: selected.reasoningEffort } : {}) };
            const limit = Math.min(config.maxCharacters, options.budget(input.branchId, route));
            const candidates = options.candidates(input.branchId).filter(c => !c.player && c.presence === 'absent'
                && c.ready && input.ordinal - c.lastAdvancedOrdinal >= 2)
                .sort((a, b) => b.priority - a.priority || b.relevance - a.relevance
                    || b.activeGoals - a.activeGoals || a.lastAdvancedOrdinal - b.lastAdvancedOrdinal
                    || a.characterId.localeCompare(b.characterId)).slice(0, Math.max(0, limit));
            if (!candidates.length) {
                await table.put(key(input.branchId), state);
                return { status: 'empty' as const };
            }
            const id = randomUUID();
            const batch: OffscreenBatch = { schemaVersion: 1, id, branchId: input.branchId,
                inputId: input.inputId, ordinal: input.ordinal, route, members: candidates.map(c => ({
                    characterId: c.characterId, view: structuredClone(c.view), taskId: `${id}:${c.characterId}`,
                    generation: randomUUID(), status: 'queued'
                })) };
            // Retain completed/failed/cancelled anchors before replacing the live batch.
            // If archival fails the old branch row remains recoverable and no new work starts.
            if (state.batch) {
                await table.put(`character-offscreen-batch__${state.batch.id}`, state.batch);
                state.previousBatches = [...(state.previousBatches ?? []), state.batch.id];
            }
            state.batch = batch;
            await table.put(key(input.branchId), state);
            const controllers = new Map(batch.members.map(m => [m.characterId, new AbortController()]));
            running.set(input.branchId, controllers);
            // Model execution runs after this scheduler transaction; no foreground writer uses this lock.
            queueMicrotask(() => { for (const member of batch.members)
                void work(batch, member, controllers.get(member.characterId)!).catch(() => { /* durable write failure: recovery retains queued/running anchor */ }); });
            return { status: 'started' as const, batchId: id };
        });
    }
    async function cancel(branch: string, reason: string, characterIds?: readonly string[]) {
        for (const [id, controller] of running.get(branch) ?? [])
            if (!characterIds || characterIds.includes(id)) controller.abort(new Error(reason));
        await locked(branch, async () => {
            const state = read(branch);
            let changed = false;
            for (const member of state.batch?.members ?? []) {
                if ((!characterIds || characterIds.includes(member.characterId))
                    && ['queued', 'running', 'generated'].includes(member.status)) {
                    member.status = 'cancelled'; member.reason = reason;
                    changed = true;
                }
            }
            if (changed) await table.put(key(branch), state);
        });
    }
    async function recover(branch: string) {
        if (running.has(branch)) { await flush(branch); return; }
        const batch = storedState(branch).batch, recovered = new Map<string, string>();
        if (batch && options.recoverResult) for (const member of batch.members) {
            if (member.status !== 'queued' && member.status !== 'running' && member.status !== 'failed') continue;
            const text = await options.recoverResult(batch, member);
            if (text?.trim()) recovered.set(member.characterId, text);
        }
        await locked(branch, async () => {
            const state = read(branch);
            let changed = false;
            for (const member of state.batch?.members ?? []) {
                if (member.status === 'queued' || member.status === 'running' || recovered.has(member.characterId)) {
                    const text = state.batch?.id === batch?.id ? recovered.get(member.characterId) : undefined;
                    if (text !== undefined) {
                        member.status = 'generated'; member.result = text; delete member.reason;
                    } else {
                        member.status = 'interrupted'; member.reason = '进程中断；未自动重新调用模型';
                    }
                    changed = true;
                }
            }
            if (changed) await table.put(key(branch), state);
        });
        await flush(branch);
    }
    const status = (branch: string) => {
        const state = storedState(branch), batch = state.batch;
        return { acceptedCount: state.acceptedCount, batch: batch ? {
            id: batch.id, branchId: batch.branchId, inputId: batch.inputId, route: { ...batch.route },
            members: batch.members.map(({ characterId, taskId, generation, status, reason, publicationId }) =>
                ({ characterId, taskId, generation, status, reason, publicationId }))
        } : undefined };
    };
    const history = (branch: string, offset = 0, limit = 20) => {
        const ids = storedState(branch).previousBatches ?? [];
        const start = Math.max(0, Math.trunc(offset)), cap = Math.max(1, Math.min(100, Math.trunc(limit)));
        return { batches: ids.slice(start, start + cap).map(id =>
            structuredClone(table.get(`character-offscreen-batch__${id}`)) as OffscreenBatch),
            nextOffset: start + cap < ids.length ? start + cap : null };
    };
    async function dispose() {
        disposed = true;
        for (const controllers of running.values()) for (const controller of controllers.values())
            controller.abort(new Error('场外任务已关闭'));
        await Promise.all([...knownBranches].map(branch => cancel(branch, '场外任务已关闭')));
    }
    return { accepted, cancel, recover, flush, dispose, read, status, history };
}
