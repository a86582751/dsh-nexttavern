// Generated from runtime/alpha3/src/core/roleplay-opening-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
import { createHash } from 'node:crypto';
const openingView = (intent) => intent.schemaVersion === 7 ? ({
    schemaVersion: 7, status: intent.status, mode: intent.mode, index: intent.index, operationId: intent.operationId,
    production: intent.production, committedTurn: intent.committedTurn, diagnosis: intent.diagnosis,
}) : ({
    status: intent.status, index: intent.index, operationId: intent.operationId,
    committedTurn: intent.committedTurn, rejectionCode: intent.rejectionCode,
    ...(intent.schemaVersion === 3 || intent.schemaVersion === 4 || intent.schemaVersion === 5 ? { schemaVersion: intent.schemaVersion,
        initializationCode: intent.initializationCode, textRetained: intent.textRetained } : {}),
    ...(intent.schemaVersion === 4 || intent.schemaVersion === 5 ? { mode: intent.mode } : {}),
});
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
                const program = deps.program?.verified(session.id);
                if (program?.kind === 'blocked')
                    throw Error(program.code);
                const intent = program?.kind === 'ready' ? program.intent : await selection.readIntentVerified(catalog.source);
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
                        selection: intent ? openingView(intent) : null });
                if (body.expectedSource !== undefined) {
                    const expected = body.expectedSource;
                    if (!expected || typeof expected !== 'object' || Array.isArray(expected)
                        || Object.keys(expected).length !== 3 || expected.importId !== catalog.source.importId
                        || expected.rawSha256 !== catalog.source.rawSha256 || expected.transactionId !== catalog.source.transactionId)
                        return jsonResponse(409, { ok: false, error: '角色卡已变化，请重新查看当前开场' });
                }
                if (body.action === 'recover') {
                    if (program?.kind === 'ready') {
                        const old = program.context.seed, recovered = await deps.program.run({ sessionId: session.id, index: old.selected.index,
                            operationId: old.operationId, messageId: old.requestedMessageId, production: old.production,
                            instruction: program.context.input.instruction });
                        if (recovered.kind !== 'ready')
                            throw Error(recovered.kind === 'blocked' ? recovered.code : 'PROGRAM_OPENING_NOT_FOUND');
                        return jsonResponse(recovered.intent.status === 'completed' ? 200 : 202, { ok: true, selection: openingView(recovered.intent) });
                    }
                    const recovered = await selection.recover(session.id, catalog.source.importId);
                    return jsonResponse(200, { ok: true, selection: recovered ? openingView(recovered) : null });
                }
                if (body.action !== 'select' || !Number.isSafeInteger(body.index)
                    || typeof body.operationId !== 'string' || typeof body.expectedRenderedSha256 !== 'string')
                    return jsonResponse(400, { ok: false, error: '无效的开场选择请求' });
                const candidate = catalog.candidates.find(item => item.index === body.index);
                if (!candidate || createHash('sha256').update(candidate.renderedText).digest('hex')
                    !== body.expectedRenderedSha256)
                    return jsonResponse(409, { ok: false, error: '开场预览已变化，请刷新后重新选择' });
                const messageSha256 = createHash('sha256').update(`${session.id}\0${catalog.source.importId}\0${body.operationId}`).digest('hex'), messageId = `opening-${messageSha256.slice(0, 32)}`;
                if (program?.kind === 'ready') {
                    // Replaying the exact immutable request reaches the owner's receipt
                    // reader even after its visible opening exists. A different operation
                    // still has no authority to create a second opening.
                    const old = program.context.seed;
                    if (old.operationId !== body.operationId || old.selected.index !== body.index
                        || old.requestedMessageId !== messageId || old.production !== 'selected-card-copy'
                        || program.context.input.instruction !== null)
                        return jsonResponse(409, { ok: false, error: 'PROGRAM_OPENING_IDENTITY_CONFLICT' });
                    const result = await deps.program.run({ sessionId: session.id, index: body.index,
                        operationId: body.operationId, messageId, production: 'selected-card-copy', instruction: null });
                    if (result.kind !== 'ready')
                        throw Error(result.kind === 'blocked' ? result.code : 'PROGRAM_OPENING_SOURCE_UNAVAILABLE');
                    return jsonResponse(result.intent.status === 'completed' ? 200 : 202, { ok: true, selection: openingView(result.intent) });
                }
                if (legacyDisplayed)
                    return jsonResponse(409, { ok: false,
                        error: '该导入已请求旧版模型开场；需先按消息历史明确迁移，避免重复开场' });
                if (priorOpening)
                    return jsonResponse(409, { ok: false,
                        error: '当前会话历史已有可见开场或剧情；再次导入或分支继承不会自动写第二条' });
                if (!await canCommit(session.id))
                    return jsonResponse(409, { ok: false, error: '当前宿主尚未提供原生零模型开场提交能力' });
                const programCatalog = await deps.program?.catalog(session.id);
                if (programCatalog) {
                    if (programCatalog.source.rawSha256 !== catalog.source.rawSha256
                        || programCatalog.source.transactionId !== catalog.source.transactionId)
                        throw Error('PROGRAM_OPENING_SOURCE_CHANGED');
                    const result = await deps.program.run({ sessionId: session.id, index: body.index,
                        operationId: body.operationId, messageId, production: 'selected-card-copy', instruction: null });
                    if (result.kind !== 'ready')
                        throw Error(result.kind === 'blocked' ? result.code : 'PROGRAM_OPENING_SOURCE_UNAVAILABLE');
                    return jsonResponse(result.intent.status === 'completed' ? 200 : 202, { ok: true, selection: openingView(result.intent) });
                }
                const result = await selection.select(session.id, body.index, body.operationId, context);
                const pending = 'intent' in result;
                const selected = pending ? result.intent : result;
                return jsonResponse(pending || selected.status !== 'completed' ? 202 : 200, { ok: true, selection: openingView(selected) });
            }
            catch (error) {
                return jsonResponse(409, { ok: false, error: String(error.message) });
            }
        },
    }), 'roleplay: native opening selection');
}
