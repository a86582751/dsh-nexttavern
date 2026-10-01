// Generated from runtime/alpha3/src/core/roleplay-session-actions.ts; edit the TypeScript source.
import { randomInt } from 'node:crypto';
import { keyOf, rollLogEntries, rollLogRecord } from './roleplay-data.js';
import { lastSeq } from './roleplay-context.js';
import { renderWorldbookEntry } from './roleplay-author-context.js';
export function registerSessionTools({ ctx, T, simpleTool, sessionOf }) {
    ctx.effect(() => ctx.tools.register(simpleTool('rp_roll', '投骰子（如 "2d6+1"、"1d20"、"3d6"）。结果记录进当前分支的投掷日志，数值只能由此产生或修改。', {
        type: 'object',
        properties: {
            spec: { type: 'string', description: '骰子表达式，如 2d6+1' },
            reason: { type: 'string', description: '为什么投（用于日志）' },
        },
        required: ['spec'],
        additionalProperties: false,
    }, async (args, exec) => {
        const session = await sessionOf(exec);
        const m = String(args.spec).trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
        if (!m)
            return { ok: false, error: '无法解析骰子表达式，格式如 2d6+1' };
        const count = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 100);
        const sides = Math.min(Math.max(parseInt(m[2], 10), 1), 1000);
        const rolls = [];
        for (let i = 0; i < count; i++)
            rolls.push(randomInt(1, sides + 1));
        let total = rolls.reduce((a, b) => a + b, 0);
        if (m[3] === '+')
            total += parseInt(m[4] || '0', 10);
        if (m[3] === '-')
            total -= parseInt(m[4] || '0', 10);
        const record = { spec: String(args.spec), rolls, total, reason: args.reason ?? '', atSeq: lastSeq(session), time: Date.now() };
        const rollKey = keyOf(session.id, 'log');
        const log = rollLogEntries(T.rolls.get(rollKey));
        await T.rolls.put(rollKey, rollLogRecord([...log, record]));
        return { ok: true, spec: record.spec, rolls, total, reason: record.reason };
    })), 'roleplay: tool rp_roll');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_state', '查看当前分支的状态面板：场景快照、投掷日志尾部、记忆账本统计、待确认冲突。', { type: 'object', properties: {}, additionalProperties: false }, async (_args, exec) => {
        const session = await sessionOf(exec);
        const mem = T.memory.get(keyOf(session.id, 'head')) ?? {};
        return {
            scene: T.scene.get(keyOf(session.id, 'current')) ?? null,
            rolls: rollLogEntries(T.rolls.get(keyOf(session.id, 'log'))).slice(-10),
            memory: {
                deltaCount: (mem.deltas ?? []).length,
                pendingConfirmations: (mem.pendingConfirmations ?? []).slice(-5),
                lockedFactCount: (mem.lockedFacts ?? []).length,
                version: mem.version ?? 1,
            },
            meta: T.branch.get(keyOf(session.id, 'meta')) ?? null,
        };
    })), 'roleplay: tool rp_state');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_scene_set', '直接修正当前分支的场景快照（用户/模型明确确认的修正；只改传入字段）。', {
        type: 'object',
        properties: {
            place: { type: 'string' },
            time: { type: 'string' },
            timeline: { type: 'string' },
            present: { type: 'array', items: { type: 'string' } },
            positions: { type: 'object' },
            outfits: { type: 'object' },
            items: { type: 'object' },
            moods: { type: 'object' },
            injuries: { type: 'object' },
            pendingActions: { type: 'array', items: { type: 'string' } },
            environment: { type: 'string' },
        },
        required: [],
        additionalProperties: false,
    }, async (args, exec) => {
        const session = await sessionOf(exec);
        const prev = T.scene.get(keyOf(session.id, 'current')) ?? {};
        const next = { ...prev };
        for (const f of ['place', 'time', 'timeline', 'environment'])
            if (args[f] !== undefined)
                next[f] = String(args[f]);
        for (const f of ['present', 'pendingActions'])
            if (Array.isArray(args[f]))
                next[f] = args[f].map(String);
        for (const f of ['positions', 'outfits', 'items', 'moods', 'injuries'])
            if (args[f] && typeof args[f] === 'object')
                next[f] = { ...(prev[f] ?? {}), ...args[f] };
        next.updatedAtSeq = lastSeq(session);
        await T.scene.put(keyOf(session.id, 'current'), next);
        return { ok: true, scene: next };
    })), 'roleplay: tool rp_scene_set');
}
export function registerSessionCommands({ ctx, T, isRoleplaySession, startExportJob, svc }) {
    ctx.effect(() => ctx.commands.register({
        name: 'scene',
        description: '查看/修正当前角色扮演会话的场景状态',
        input: { hint: '（可选）直接描述场景变化' },
        handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            const raw = invocation.rawInput?.trim();
            if (raw) {
                const prev = T.scene.get(keyOf(session.id, 'current')) ?? {};
                await T.scene.put(keyOf(session.id, 'current'), { ...prev, place: raw, updatedAtSeq: lastSeq(session) });
                return { kind: 'success', text: `场景已更新：${raw}` };
            }
            const scene = T.scene.get(keyOf(session.id, 'current'));
            return { kind: 'success', text: scene ? JSON.stringify(scene, null, 2) : '（尚无场景快照）' };
        },
    }), 'roleplay: command scene');
    ctx.effect(() => ctx.commands.register({
        name: 'worldbook',
        description: '查看当前分支的世界书条目',
        input: { hint: '（可选）条目 id 或关键词' },
        handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            const prefix = `${session.id}__`;
            const q = (invocation.rawInput ?? '').trim().toLowerCase();
            const out = [];
            for (const [k, v] of T.worldbook.entries()) {
                if (!k.startsWith(prefix) || !v)
                    continue;
                if (q && !`${v.id} ${v.name} ${(v.keywords ?? []).join(' ')}`.toLowerCase().includes(q))
                    continue;
                out.push(renderWorldbookEntry(v));
            }
            return { kind: 'success', text: out.length ? out.join('\n\n---\n\n') : '（没有匹配的世界书条目）' };
        },
    }), 'roleplay: command worldbook');
    ctx.effect(() => ctx.commands.register({
        name: 'roll',
        description: '投骰子（如 2d6+1）',
        input: { hint: '骰子表达式，如 2d6+1' },
        handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            const m = String(invocation.rawInput ?? '').trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
            if (!m)
                return { kind: 'error', text: '格式如 /roll 2d6+1' };
            const count = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 100);
            const sides = Math.min(Math.max(parseInt(m[2], 10), 1), 1000);
            const rolls = [];
            for (let i = 0; i < count; i++)
                rolls.push(randomInt(1, sides + 1));
            let total = rolls.reduce((a, b) => a + b, 0);
            if (m[3] === '+')
                total += parseInt(m[4] || '0', 10);
            if (m[3] === '-')
                total -= parseInt(m[4] || '0', 10);
            const rollKey = keyOf(session.id, 'log');
            const log = rollLogEntries(T.rolls.get(rollKey));
            const record = { spec: String(invocation.rawInput).trim(), rolls, total, atSeq: lastSeq(session), time: Date.now() };
            await T.rolls.put(rollKey, rollLogRecord([...log, record]));
            return { kind: 'success', text: `🎲 ${invocation.rawInput.trim()} → ${rolls.join(' + ')}${m[3] ? ` ${m[3]} ${m[4]}` : ''} = **${total}**` };
        },
    }), 'roleplay: command roll');
    ctx.effect(() => ctx.commands.register({
        name: 'regenerate',
        description: '兼容提示：重新生成已迁移到消息操作行的原生 Session 分支按钮。',
        input: { hint: '请使用目标回复旁的重新生成/编辑按钮' },
        handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            return {
                kind: 'error',
                text: '为保证分支上下文和记忆隔离，/regenerate 已停用。请在目标回复下点击“重新生成”；需要改写玩家消息时点击旁边的铅笔按钮。',
            };
        },
    }), 'roleplay: command regenerate');
    ctx.effect(() => ctx.commands.register({
        name: 'export-novel', description: '将当前分支完整剧情整理为 Markdown 小说，包含已归档历史。',
        input: { hint: '直接执行即可' }, handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            try {
                const job = await startExportJob(session, 'novel-export', invocation.agent);
                return { kind: 'success', text: `已开始完整小说整理。可在酒馆管理的导出页查看进度和下载，任务编号 ${job.id}。` };
            }
            catch (error) {
                return { kind: 'error', text: String(error.message) };
            }
        },
    }), 'roleplay: command export-novel');
    ctx.effect(() => ctx.commands.register({
        name: 'branch',
        description: '查看当前分支血缘；创建分支请用会话消息末尾的分支按钮（fork）',
        handler: async (invocation) => {
            const session = invocation.agent?.session;
            if (!session || !isRoleplaySession(session))
                return { kind: 'error', text: '当前会话不是角色扮演会话' };
            const chain = svc.branchLineage(session);
            const lines = chain.map((c, i) => {
                const label = i === 0 ? '★ 当前分支' : `祖先 ${i}`;
                return `${label} session=${c.sessionId}${c.seedLength !== null ? ` seedLength=${c.seedLength}` : ''}`;
            });
            return { kind: 'success', text: '分支血缘（当前 → 祖先）：\n' + lines.join('\n') };
        },
    }), 'roleplay: command branch');
}
