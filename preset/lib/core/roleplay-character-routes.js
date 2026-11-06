// Generated from runtime/alpha3/src/core/roleplay-character-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
export function registerRoleplayCharacterRoutes(deps) {
    const { owner } = deps;
    deps.ctx.effect(() => deps.ctx.connection.fetch.register({ requestBody: 'buffered',
        path: '/api/roleplay/character-private', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : undefined, session = await deps.session(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body) {
                    if (body.action === 'set-enabled') {
                        if (typeof body.enabled !== 'boolean')
                            throw Error('必须指定角色集群开关');
                        await deps.setEnabled(session.id, body.enabled);
                        return jsonResponse(200, { ok: true, ...await owner.list(session.id) });
                    }
                    if (body.action === 'retry-perception') {
                        await owner.retryPerception(session.id);
                        return jsonResponse(200, { ok: true, ...await owner.list(session.id) });
                    }
                    const target = body.target;
                    if (!target || target.branchId !== session.id || typeof target.characterId !== 'string'
                        || !Number.isSafeInteger(target.revision) || target.revision < 0
                        || typeof target.boundaryId !== 'string' || typeof target.materialId !== 'string')
                        throw Error('角色记忆编辑身份无效');
                    if (body.action === 'set-active') {
                        if (typeof body.recordId !== 'string' || typeof body.active !== 'boolean')
                            throw Error('角色记忆操作无效');
                        await owner.setActive(target, body.recordId, body.active);
                        return jsonResponse(200, { ok: true });
                    }
                    if (body.action !== 'correct' || typeof body.text !== 'string'
                        || body.recordId !== undefined && typeof body.recordId !== 'string'
                        || !['experience', 'hearsay', 'belief', 'emotion', 'relationship', 'goal', 'state'].includes(String(body.category))
                        || !['confirmed', 'unconfirmed', 'intention'].includes(String(body.certainty)))
                        throw Error('角色记忆修订无效');
                    return jsonResponse(200, { ok: true, ...await owner.correct({ target, text: body.text,
                            ...(typeof body.recordId === 'string' ? { recordId: body.recordId } : {}),
                            category: body.category,
                            certainty: body.certainty }) });
                }
                const offset = Number(url.searchParams.get('offset') ?? 0);
                if (!Number.isSafeInteger(offset) || offset < 0)
                    throw Error('角色记忆分页位置无效');
                if (url.searchParams.get('section') === 'offscreen') {
                    const status = owner.offscreenStatus(session.id), history = owner.offscreenHistory(session.id, offset, 20), names = new Map((await owner.list(session.id)).characters.map(character => [character.id, character.name])), batches = [...(offset === 0 && status.batch ? [status.batch] : []), ...history.batches];
                    return jsonResponse(200, { ok: true, runs: batches.flatMap(batch => batch.members.map(member => ({
                            id: `${batch.id}:${member.characterId}`, characterId: member.characterId,
                            name: names.get(member.characterId) ?? member.characterId, status: member.status,
                            ...(member.reason ? { reason: member.reason } : {}),
                            ...(member.publicationId ? { publicationId: member.publicationId } : {})
                        }))), nextOffset: history.nextOffset });
                }
                const characterId = url.searchParams.get('characterId');
                return jsonResponse(200, { ok: true, ...characterId ? await owner.detail(session.id, characterId, offset) : await owner.list(session.id) });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return jsonResponse(message.includes('已变化') || message.includes('已更新') ? 409 : 400, { ok: false, error: message });
            }
        } }), 'roleplay: character private memory and offscreen records');
}
