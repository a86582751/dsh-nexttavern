// Generated from runtime/alpha3/src/core/roleplay-mvu-player-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
const statusFor = (code) => !code ? 200 : code === 'MVU_PLAYER_DATA_LIMIT' ? 413
    : code === 'MVU_PLAYER_DATA_INVALID' ? 400 : code === 'MVU_PLAYER_SESSION_INACTIVE' ? 404
        : code === 'MVU_PLAYER_BUSY' ? 423 : ['MVU_PLAYER_WRITE_UNKNOWN', 'MVU_PLAYER_PENDING', 'READ_OR_PERMISSION_UNKNOWN',
            'OWNED_PARTIAL_OR_ORPHAN', 'SCHEMA_PLAYER_PENDING', 'SCHEMA_PLAYER_HISTORY_UNPROVEN'].includes(code) ? 503 : 409;
/** The session resolver supplies the actual current owner. Expected hashes are
 * comparison data; the client cannot supply a receipt, intent or write token. */
export function registerMvuPlayerRoutes({ ctx, resolveRoleplaySession, player, observe }) {
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered', path: '/api/roleplay/mvu-state', methods: ['GET', 'POST'],
        fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const text = request.method === 'POST' ? await request.text() : undefined;
                if (text !== undefined && Buffer.byteLength(text, 'utf8') > 2 * 1048576) {
                    return jsonResponse(413, { ok: false, code: 'MVU_PLAYER_DATA_LIMIT', error: '数值内容过大' });
                }
                let body;
                try {
                    body = text === undefined ? undefined : JSON.parse(text);
                }
                catch {
                    return jsonResponse(400, { ok: false, code: 'MVU_PLAYER_DATA_INVALID', error: '数值请求格式无效' });
                }
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, code: 'MVU_PLAYER_SESSION_INACTIVE', error: '角色扮演会话不存在' });
                if (text === undefined)
                    return jsonResponse(200, { ok: true, numericalState: observe ? await observe(session.id) : player.observe(session.id) });
                const result = await player.submit(body);
                return jsonResponse(statusFor(result.code), result);
            }
            catch {
                return jsonResponse(503, { ok: false, code: 'MVU_PLAYER_WRITE_UNKNOWN', error: '暂时无法确认数值，请保留当前修改并重试' });
            }
        },
    }), 'roleplay: explicit player numerical edits');
}
