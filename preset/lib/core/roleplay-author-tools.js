// Generated from runtime/alpha3/src/core/roleplay-author-tools.ts; edit the TypeScript source.
import { keyOf, recordSha256 } from './roleplay-data.js';
import { lastSeq, eventsOf } from './roleplay-context.js';
import { retrieveWorldbook } from './roleplay-author-context.js';
import { fenceCardContent } from './tavern-card.js';
export function registerAuthorTools({ ctx, T, simpleTool, sessionOf, storyBranchIsActive }) {
    ctx.effect(() => ctx.tools.register(simpleTool('rp_card_set', '写入或更新当前分支的一张角色卡（玩家角色用 card_id="user"）。角色卡始终作为独立设定注入；locked 仅表示关键设定，不会复制进剧情摘要。', {
        type: 'object',
        properties: {
            card_id: { type: 'string', description: '卡片 id；玩家角色固定用 "user"' },
            name: { type: 'string' },
            kind: { type: 'string', enum: ['user', 'npc', 'other'] },
            content: { type: 'string', description: '人设正文（性格/口吻/动机/秘密/外貌/能力/价值底线等）' },
            locked: { type: 'boolean' },
        },
        required: ['card_id', 'content'],
        additionalProperties: false,
    }, async (args, exec) => {
        const session = await sessionOf(exec);
        const cardId = String(args.card_id);
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cardId))
            return { ok: false, error: `card_id 只能包含字母/数字/下划线/连字符（1-64 字符）：${cardId}` };
        const prev = T.cards.get(keyOf(session.id, cardId)) ?? {};
        const card = {
            ...prev, schemaVersion: 1, verified: false,
            editedFrom: { sha256: recordSha256(prev), source: 'native-tool', seq: lastSeq(session) },
            id: cardId,
            name: args.name ?? prev.name ?? cardId,
            kind: args.kind ?? prev.kind ?? (cardId === 'user' ? 'user' : 'npc'),
            content: String(args.content),
            locked: args.locked === true,
            version: (Number(prev.version) || 0) + 1,
            updatedAtSeq: lastSeq(session),
        };
        await T.cards.put(keyOf(session.id, card.id), card);
        return { ok: true, card_id: card.id, version: card.version };
    })), 'roleplay: tool rp_card_set');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_card_list', '列出当前分支的全部角色卡（仅摘要，不含正文）。', { type: 'object', properties: {}, additionalProperties: false }, async (_args, exec) => {
        const session = await sessionOf(exec);
        const prefix = `${session.id}__`;
        const out = [];
        for (const [k, v] of T.cards.entries()) {
            if (!k.startsWith(prefix) || !v)
                continue;
            out.push({ id: v.id, name: v.name, kind: v.kind, locked: v.locked === true, version: v.version, chars: String(v.content ?? '').length });
        }
        return { cards: out };
    })), 'roleplay: tool rp_card_list');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_worldbook_add', '向当前分支添加世界书条目（角色/地点/组织/国家/术语/物品/规则/时间线/剧情事件/风格）。写入前应先用 rp_worldbook_list 查重；内容有疑问时先问用户，不要编造。', {
        type: 'object',
        properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['character', 'place', 'org', 'country', 'term', 'item', 'rule', 'timeline', 'event', 'style'] },
            name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            triggers: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
            token_budget: { type: 'number' },
            always_on: { type: 'boolean' },
            content: { type: 'string' },
            locked: { type: 'boolean' },
        },
        required: ['id', 'name', 'kind', 'content'],
        additionalProperties: false,
    }, async (args, exec) => {
        const session = await sessionOf(exec);
        const id = String(args.id);
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
            return { ok: false, error: `条目 id 只能包含字母/数字/下划线/连字符（1-64 字符）：${id}` };
        const prev = T.worldbook.get(keyOf(session.id, id));
        if (prev)
            return { ok: false, error: `条目 ${id} 已存在；用 rp_worldbook_update 修改，或先 rp_worldbook_remove` };
        const entry = {
            id,
            kind: args.kind ?? 'term',
            name: String(args.name),
            aliases: args.aliases ?? [],
            keywords: args.keywords ?? [],
            triggers: args.triggers ?? [],
            priority: Number(args.priority) || 0,
            tokenBudget: Number(args.token_budget) || 400,
            alwaysOn: args.always_on === true,
            content: String(args.content),
            locked: args.locked === true,
            version: 1,
            updatedAtSeq: lastSeq(session),
        };
        await T.worldbook.put(keyOf(session.id, id), entry);
        return { ok: true, id, version: 1 };
    })), 'roleplay: tool rp_worldbook_add');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_worldbook_update', '更新当前分支的世界书条目（只改传入的字段；lock 或解锁用 locked 字段）。', {
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            triggers: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
            token_budget: { type: 'number' },
            always_on: { type: 'boolean' },
            content: { type: 'string' },
            locked: { type: 'boolean' },
        },
        required: ['id'],
        additionalProperties: false,
    }, async (args, exec) => {
        const session = await sessionOf(exec);
        const id = String(args.id);
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
            return { ok: false, error: `条目 id 只能包含字母/数字/下划线/连字符（1-64 字符）：${id}` };
        const prev = T.worldbook.get(keyOf(session.id, id));
        if (!prev)
            return { ok: false, error: `条目 ${id} 不存在` };
        const next = { ...prev };
        for (const f of ['name', 'content'])
            if (args[f] !== undefined)
                next[f] = String(args[f]);
        for (const f of ['aliases', 'keywords', 'triggers'])
            if (Array.isArray(args[f]))
                next[f] = args[f].map(String);
        if (args.priority !== undefined)
            next.priority = Number(args.priority) || 0;
        if (args.token_budget !== undefined)
            next.tokenBudget = Number(args.token_budget) || 400;
        if (args.always_on !== undefined)
            next.alwaysOn = args.always_on === true;
        if (args.locked !== undefined)
            next.locked = args.locked === true;
        next.version = (Number(prev.version) || 1) + 1;
        next.updatedAtSeq = lastSeq(session);
        await T.worldbook.put(keyOf(session.id, id), next);
        return { ok: true, id, version: next.version };
    })), 'roleplay: tool rp_worldbook_update');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_worldbook_remove', '从当前分支删除世界书条目。', { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }, async (args, exec) => {
        const session = await sessionOf(exec);
        await T.worldbook.delete(keyOf(session.id, String(args.id)));
        return { ok: true };
    })), 'roleplay: tool rp_worldbook_remove');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_worldbook_list', '列出当前分支的世界书条目摘要（供查重与触发条件管理）。', { type: 'object', properties: {}, additionalProperties: false }, async (_args, exec) => {
        const session = await sessionOf(exec);
        const prefix = `${session.id}__`;
        const out = [];
        for (const [k, v] of T.worldbook.entries()) {
            if (!k.startsWith(prefix) || !v)
                continue;
            out.push({
                id: v.id,
                name: v.name,
                kind: v.kind,
                aliases: v.aliases,
                keywords: v.keywords,
                priority: v.priority,
                alwaysOn: v.alwaysOn === true,
                locked: v.locked === true,
                version: v.version,
            });
        }
        return { entries: out, count: out.length };
    })), 'roleplay: tool rp_worldbook_list');
    ctx.effect(() => ctx.tools.register(simpleTool('rp_worldbook_search', '按导演笔记、当前问题中的明确关键词查询当前分支世界书。世界书是被动资料库；查询结果不是已发生事件。可先用 rp_worldbook_list 查看名称与关键词。', { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 2400 }, max_tokens: { type: 'integer', minimum: 500, maximum: 16000 } }, required: ['query'], additionalProperties: false }, async (args, exec) => {
        const session = await sessionOf(exec), query = String(args.query ?? '').trim();
        if (!query || query.length > 2400)
            return { ok: false, error: '请输入 1–2400 字的世界书查询关键词' };
        const sourceHash = recordSha256([...T.worldbook.entries()].filter(([key]) => key.startsWith(`${session.id}__`)));
        const found = await retrieveWorldbook(T, session.id, query, null, Math.min(16000, Math.max(500, Number(args.max_tokens) || 6000)));
        if (!storyBranchIsActive(session) || sourceHash !== recordSha256([...T.worldbook.entries()].filter(([key]) => key.startsWith(`${session.id}__`))))
            return { ok: false, error: '查询来源已变更，请重试' };
        if (found.text)
            await T.branch.put(keyOf(session.id, `cluster-lore-${lastSeq(session)}`), { schemaVersion: 1, branchId: session.id, seq: lastSeq(session),
                turn: Number(eventsOf(session).findLast(e => e.type === 'turn/start')?.data?.turn), callId: exec.rootCallId ?? exec.callId, text: found.text, sourceHash });
        return { ok: true, branchId: session.id, sourceHash, count: found.entries.length, entries: found.entries.map(e => ({ id: e.id, name: e.name, version: e.version })), text: found.text ? fenceCardContent(found.text, 'worldbook') : '' };
    })), 'roleplay: tool rp_worldbook_search');
}
