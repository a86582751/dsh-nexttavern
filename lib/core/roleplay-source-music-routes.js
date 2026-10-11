// Generated from runtime/alpha3/src/core/roleplay-source-music-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
import { assertWorkspaceSession } from './roleplay-context.js';
export function registerSourceMusicRoutesV1(deps) {
    deps.ctx.effect(() => deps.ctx.connection.fetch.register({ requestBody: 'buffered',
        path: '/api/roleplay/source-music', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const body = request.method === 'POST' ? await request.json() : null;
                const session = await deps.resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                assertWorkspaceSession(session);
                return await deps.withSourceLock(session.id, async () => body
                    ? jsonResponse(200, { ok: true, resource: await deps.music.select(session, body.sourceHash, body.candidateId) })
                    : jsonResponse(200, { ok: true, ...deps.music.list(session) }));
            }
            catch (error) {
                return jsonResponse(400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: explicit Source music selection');
}
