import { savePanelSetting } from './roleplay-setting-store.js';
export { savePanelSetting } from './roleplay-setting-store.js';
export { registerSettingTool } from './roleplay-setting-tools.js';
import { keyOf } from './roleplay-data.js';
import { jsonResponse } from './roleplay-state.js';
import { decodeTavernCard } from './tavern-card.js';
import { importActiveKey } from './roleplay-import.js';
import type { ImportRecord } from './roleplay-import-types.js';
import type { PanelRouteBody, PanelRoutesDependencies } from './roleplay-panel-routes-types.js';
export function registerAvatarRoute({
ctx, T, resolveRoleplaySession, ensureBranch, awaitImportBarrier, importRecordKey, assertImportRecordIntegrity
}: Pick<PanelRoutesDependencies,
     'ctx' | 'T' | 'resolveRoleplaySession' | 'ensureBranch' | 'awaitImportBarrier' | 'importRecordKey' | 'assertImportRecordIntegrity'>) {
    ctx.effect(
    () => ctx.connection.fetch.register({
        path: '/api/roleplay/card-avatar',
        methods: ['GET'],
        fetch: async (request) => {
            try {
                const session = await resolveRoleplaySession(new URL(request.url).searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, {
                        ok: false, error: 'roleplay 会话不存在'
                    });
                await ensureBranch(session);
                await awaitImportBarrier(session.id);
                const pointer = T.branch.get(importActiveKey(session.id));
                const record = (pointer?.importId ? T.branch.get(importRecordKey(pointer.sourceRecordSessionId
                    ?? pointer.sourceSessionId
                    ?? session.id,
                     pointer.importId)) : null) as ImportRecord | null;
                if (!record?.sourceEnvelope || record.sourceEnvelope.extension !== '.png')
                    return jsonResponse(404, {
                        ok: false, error: '当前角色卡没有 PNG 头像'
                    });
                assertImportRecordIntegrity(record);
                const avatar = decodeTavernCard(Buffer.from(record.sourceEnvelope.base64, 'base64'), '.png');
                return new Response(Buffer.from(avatar.avatarBase64!, 'base64'), {
                    headers: {
                        'content-type': 'image/png',
                        'cache-control': 'private, no-store',
                        'x-content-type-options': 'nosniff',
                        'etag': `"${avatar.avatarSha256}"`
                    }
                });
            }
            catch {
                return jsonResponse(400, {
                    ok: false, error: '角色卡头像来源验证失败'
                });
            }
        }
    }),
        'roleplay: avatar interface'
    );
}
export function registerPanelRoutes({
ctx,
     T,
     resolveRoleplaySession,
     ensureBranch,
     withDecisionMutationLock,
     normalizeDecisionRecord,
     recordVersionsFor,
     readRoleplayState,
     svc,
     RULE_TEXT_FIELDS,
     withImportLock
}: Pick<PanelRoutesDependencies,
      'ctx' | 'T' | 'resolveRoleplaySession' | 'ensureBranch' | 'withDecisionMutationLock'
      | 'normalizeDecisionRecord' | 'recordVersionsFor' | 'readRoleplayState' | 'svc'
      | 'RULE_TEXT_FIELDS' | 'withImportLock'>) {
    // 轮末决策卡：玩家点选后标记已答；前端随即以「我选择：…」用户消息开启下一轮。
    ctx.effect(
    () => ctx.connection.fetch.register({
        path: '/api/roleplay/decision',

        methods: ['POST'],

        fetch: async (request) => {
            try {
                const body = await request.json() as PanelRouteBody;
                const session = await resolveRoleplaySession(body?.sessionId);
                if (!session)
                    return jsonResponse(404, {
                        ok: false, error: 'roleplay 会话不存在或无法恢复'
                    });
                return await withDecisionMutationLock(
                session.id,
                    async () => {
                        const key = keyOf(session.id, 'current');
                        const rec = normalizeDecisionRecord(T.decision.get(key));
                        if (!rec || rec.answered || rec.superseded)
                            return jsonResponse(409, {
                                ok: false, error: '没有待处理的决策卡'
                            });
                        const idx = body?.choiceIndex !== undefined ? Number(body.choiceIndex) : -1;
                        const customText = typeof body?.customText === 'string' ? body.customText.trim().slice(0, 500) : '';
                        const isCustom = customText !== '';
                        if (!isCustom && (!Number.isInteger(idx) || idx < 0 || idx >= rec.options.length))
                            return jsonResponse(400, {
                                ok: false, error: 'choiceIndex 无效'
                            });
                        const label = isCustom ? customText : rec.options[idx]!.label;
                        await T.decision.put(
                        key,
                            {
                                ...rec,

                                answered: true,

                                choiceIndex: isCustom ? null : idx,

                                choiceLabel: label,

                                customText: isCustom ? customText : undefined,

                                answeredAt: Date.now(),
                            }
                        );
                        return jsonResponse(200, {
                            ok: true, label
                        });
                    }
                );
            }
            catch (error) {
                return jsonResponse(
                500,
                    {
                        ok: false,
                        error: String((error as {
                            message?: unknown;
                        } | null)?.message ?? error)
                    }
                );
            }
        },
    }),
        'roleplay: route decision'
    );
    ctx.effect(
    () => ctx.connection.fetch.register({
        path: '/api/roleplay/set',

        methods: ['POST'],

        fetch: async (request) => {
            let body;
            try {
                body = await request.json() as PanelRouteBody;
            }
            catch {
                return jsonResponse(400, {
                    ok: false, error: '请求体必须是 JSON'
                });
            }
            try {
                const session = await resolveRoleplaySession(body?.sessionId);
                if (!session)
                    return jsonResponse(404, {
                        ok: false, error: 'roleplay 会话不存在或无法恢复'
                    });
                await ensureBranch(session);
                const saved = await withImportLock(
                session.id,
                    null,
                    () => savePanelSetting(
                    {
                        ctx, T, recordVersionsFor, svc, RULE_TEXT_FIELDS
                    },
                        session,
                        body
                    )
                );
                if (!saved.ok)
                    return saved;
                return jsonResponse(200, await readRoleplayState(session));
            }
            catch (error) {
                return jsonResponse(
                500,
                    {
                        ok: false,
                        error: String((error as {
                            message?: unknown;
                        } | null)?.message ?? error)
                    }
                );
            }
        },
    }),
        'roleplay: route set'
    );
}
