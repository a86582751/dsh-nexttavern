// Generated from runtime/alpha3/src/core/roleplay-opening-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
import { createHash } from 'node:crypto';
/** Selection belongs to the active session; the route never accepts source bytes or text from a client. */
export function registerOpeningRoutes(deps) {
    const { ctx, resolveRoleplaySession, selection, canCommit, openingContext, legacyOpeningAlreadyRequested, priorOpeningInHistory } = deps;
    ctx.effect(() => ctx.connection.fetch.register({
        requestBody: 'buffered', path: '/api/roleplay/openings', methods: ['GET', 'POST'],
        fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                const context = openingContext(session.id);
                const catalog = selection.readCatalog(session.id, context);
                const intent = selection.readIntent(catalog.source);
                const legacyDisplayed = legacyOpeningAlreadyRequested(session.id, catalog.source.importId);
                const priorOpening = priorOpeningInHistory(session);
                if (!body)
                    return jsonResponse(200, { ok: true,
                        available: !legacyDisplayed && !priorOpening && await canCommit(session.id),
                        legacyDisplayed, priorOpening,
                        source: { importId: catalog.source.importId,
                            rawSha256: catalog.source.rawSha256, transactionId: catalog.source.transactionId },
                        candidates: catalog.candidates.map(candidate => ({ index: candidate.index, label: candidate.label,
                            sourcePointer: candidate.sourcePointer, sourceSha256: candidate.sourceSha256,
                            renderedSha256: createHash('sha256').update(candidate.renderedText).digest('hex'),
                            text: candidate.renderedText, macros: candidate.macros })),
                        selection: intent ? { status: intent.status, index: intent.index, operationId: intent.operationId,
                            committedTurn: intent.committedTurn } : null });
                if (body.action === 'recover') {
                    const recovered = await selection.recover(session.id, catalog.source.importId);
                    return jsonResponse(200, { ok: true, selection: recovered ? { status: recovered.status,
                            index: recovered.index, operationId: recovered.operationId,
                            committedTurn: recovered.committedTurn } : null });
                }
                if (legacyDisplayed)
                    return jsonResponse(409, { ok: false,
                        error: '该导入已请求旧版模型开场；需先按消息历史明确迁移，避免重复开场' });
                if (priorOpening)
                    return jsonResponse(409, { ok: false,
                        error: '当前会话历史已有可见开场或剧情；再次导入或分支继承不会自动写第二条' });
                if (body.action !== 'select' || !Number.isSafeInteger(body.index)
                    || typeof body.operationId !== 'string' || typeof body.expectedRenderedSha256 !== 'string')
                    return jsonResponse(400, { ok: false, error: '无效的开场选择请求' });
                const candidate = catalog.candidates.find(item => item.index === body.index);
                if (!candidate || createHash('sha256').update(candidate.renderedText).digest('hex')
                    !== body.expectedRenderedSha256)
                    return jsonResponse(409, { ok: false, error: '开场预览已变化，请刷新后重新选择' });
                if (!await canCommit(session.id))
                    return jsonResponse(409, { ok: false, error: '当前宿主尚未提供原生零模型开场提交能力' });
                const result = await selection.select(session.id, body.index, body.operationId, context);
                const pending = 'intent' in result;
                const selected = pending ? result.intent : result;
                return jsonResponse(pending ? 202 : 200, { ok: true,
                    selection: { status: selected.status, index: selected.index, operationId: selected.operationId,
                        committedTurn: selected.committedTurn } });
            }
            catch (error) {
                return jsonResponse(409, { ok: false, error: String(error.message) });
            }
        },
    }), 'roleplay: native opening selection');
}
