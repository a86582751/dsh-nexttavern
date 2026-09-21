import { keyOf, recordSha256 } from './roleplay-data.js';
import { lastSeq } from './roleplay-context.js';
import { jsonResponse } from './roleplay-state.js';
import { withTavernLock } from './tavern-tasks.js';
import type { PanelRouteBody, PanelRoutesDependencies } from './roleplay-panel-routes-types.js';
import { statusTemplateDiagnostics } from '../status-template.js';
import type { HostSession } from './roleplay-task-host-types.js';
import type { StateSession } from './roleplay-state-types.js';
// Shared by the panel and bounded agent edits: one revision check and one mutation path.
export async function savePanelSetting({ ctx,
     T,
     recordVersionsFor,
     svc,
     RULE_TEXT_FIELDS }: Pick<PanelRoutesDependencies,
     'ctx' | 'T' | 'recordVersionsFor' | 'svc' | 'RULE_TEXT_FIELDS'>,
     session: HostSession,
     body: PanelRouteBody,
     validate?: () => void,
     source = 'user-edit') {
    const atSeq = lastSeq(session);
    const kind = body?.kind;
    return await withTavernLock(
    T.branch,
        `panel-save:${session.id}`,
        async () => {
            validate?.();
            if (body.expectedRevision !== undefined) {
                const versions = recordVersionsFor(session);
                const expected = kind === 'card' ? versions.cards[body.card_id!] ?? 'missing'
                    : kind === 'worldbook' || kind === 'worldbook-delete' ? versions.worldbook[body.id!] ?? 'missing' : versions[kind as keyof typeof versions];
                if (expected !== body.expectedRevision)
                    return jsonResponse(409, {
                        ok: false, error: '设定已在其他操作中更新。已保留草稿，请重新载入后合并。'
                    });
            }
            if (kind === 'card') {
                const cardId = String(body.card_id ?? '');
                if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cardId))
                    return jsonResponse(400, {
                        ok: false, error: 'card_id 只能包含字母/数字/下划线/连字符'
                    });
                const prev = T.cards.get(keyOf(session.id, cardId)) ?? {};
                const card = {
                    ...prev,
                    schemaVersion: 1,
                    verified: false,

                    editedFrom: {
                        sha256: recordSha256(prev),
                        source,
                        seq: atSeq,
                        ...(body.repairId ? {
                            repairId: body.repairId
                        } : {})
                    },

                    id: cardId,

                    name: body.name ?? prev.name ?? cardId,

                    kind: body.card_kind ?? prev.kind ?? (cardId === 'user' ? 'user' : 'npc'),

                    content: body.content !== undefined ? String(body.content) : prev.content ?? '',

                    locked: body.locked !== undefined ? body.locked === true : prev.locked === true,

                    version: (Number(prev.version) || 0) + 1,

                    updatedAtSeq: atSeq,
                };
                await T.cards.put(keyOf(session.id, cardId), card);
            }
            else if (kind === 'worldbook') {
                const id = String(body.id ?? '');
                if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
                    return jsonResponse(400, {
                        ok: false, error: '条目 id 只能包含字母/数字/下划线/连字符'
                    });
                const prev = T.worldbook.get(keyOf(session.id, id)) ?? {};
                const entry = {
                    ...prev,
                    schemaVersion: 1,
                    verified: false,

                    editedFrom: {
                        sha256: recordSha256(prev),
                        source,
                        seq: atSeq,
                        ...(body.repairId ? {
                            repairId: body.repairId
                        } : {})
                    },

                    id,

                    kind: body.entry_kind ?? prev.kind ?? 'term',

                    name: body.name ?? prev.name ?? id,

                    aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : prev.aliases ?? [],

                    keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : prev.keywords ?? [],

                    triggers: Array.isArray(body.triggers) ? body.triggers.map(String) : prev.triggers ?? [],

                    priority: body.priority !== undefined ? Number(body.priority) || 0 : prev.priority ?? 0,

                    tokenBudget: body.token_budget !== undefined ? Number(body.token_budget) || 400 : prev.tokenBudget ?? 400,

                    alwaysOn: body.always_on !== undefined ? body.always_on === true : prev.alwaysOn === true,

                    content: body.content !== undefined ? String(body.content) : prev.content ?? '',

                    locked: body.locked !== undefined ? body.locked === true : prev.locked === true,

                    version: (Number(prev.version) || 0) + 1,

                    updatedAtSeq: atSeq,
                };
                await T.worldbook.put(keyOf(session.id, id), entry);
            }
            else if (kind === 'worldbook-delete') {
                await T.worldbook.delete(keyOf(session.id, String(body.id ?? '')));
            }
            else if (kind === 'memory') {
                const patch: Record<string, unknown> = {};
                if (body.summary !== undefined && body.directorNotes === true) {
                    const engine = ctx.get('compaction');
                    if (!engine?.saveDirectorNotes)
                        throw new Error('导演笔记服务尚未就绪');
                    if (typeof (session as Partial<StateSession>).append !== 'function')
                        throw Error('导演笔记需要可追加的原生会话');
                    await engine.saveDirectorNotes(session as StateSession, body.summary);
                }
                else if (body.summary !== undefined)
                    patch.summary = String(body.summary);
                if (Array.isArray(body.lockedFacts))
                    patch.lockedFacts = body.lockedFacts.map((f) => (typeof f === 'string' ? {
                        text: f
                    } : f));
                await svc.memoryUpdate(session.id, patch);
            }
            else if (kind === 'settings') {
                const patch: Record<string, unknown> = {};
                if (body.targetContextTokens !== undefined)
                    patch.targetContextTokens = Math.max(0, Number(body.targetContextTokens) || 0);
                if (body.archiveTokens !== undefined)
                    patch.archiveTokens = Math.max(0, Number(body.archiveTokens) || 0);
                for (const field of ['contextWindowTokens', 'continuityTailTokens'])
                    if (body[field] !== undefined) {
                        const value = body[field] === null ? 0 : Number(body[field]);
                        if (!Number.isSafeInteger(value) || value < 0 || (value > 0 && value < 1000))
                            throw new Error(`${field} 必须为至少 1000 的整数；0 或 null 表示继承全局值`);
                        patch[field] = value || null;
                    }
                await svc.setSettings(session.id, patch);
            }
            else if (kind === 'status') {
                if (body.text !== undefined) {
                    const diagnostics = statusTemplateDiagnostics(body.text);
                    if (!diagnostics.renderable)
                        return jsonResponse(
                        400,
                            {
                                ok: false, error: diagnostics.errors.join('；')
                            }
                        );
                    await svc.setStatusSpec(session.id, String(body.text), atSeq, body.repairId as string | undefined);
                }
            }
            else if (kind === 'rules') {
                const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {};
                const next: Record<string, unknown> = {
                    ...prev,
                    verified: false,
                    editedFrom: {
                        sha256: recordSha256(prev),
                        source,
                        seq: atSeq,
                        ...(body.repairId ? {
                            repairId: body.repairId
                        } : {})
                    }
                };
                for (const f of RULE_TEXT_FIELDS) {
                    if (body[f] !== undefined)
                        next[f] = String(body[f]);
                }
                if (body.beauty !== undefined) {
                    const b = body.beauty;
                    const regexRules = Array.isArray(b?.regexRules)
                        ? b.regexRules
                            .filter((r) => r && typeof r === 'object' && typeof r.match === 'string' && typeof r.replace === 'string')
                            .slice(
                        0,
                            60
                        )
                            .map((r) => ({
                            match: String(r.match).slice(0, 400),
                            replace: String(r.replace).slice(0, 800)
                        }))
                        : [];
                    next.beauty = {
                        regexRules,

                        css: typeof b?.css === 'string' ? b.css.slice(0, 20000) : '',

                        js: typeof b?.js === 'string' ? b.js.slice(0, 8000) : '',
                    };
                }
                await svc.setRules(session.id, next, atSeq);
            }
            else if (kind === 'opening') {
                if (body.text !== undefined)
                    await svc.setOpening(session.id, String(body.text), atSeq);
            }
            else {
                return jsonResponse(400, {
                    ok: false, error: `未知 kind: ${String(kind)}`
                });
            }
            return jsonResponse(200, {
                ok: true
            });
        }
    );
}
