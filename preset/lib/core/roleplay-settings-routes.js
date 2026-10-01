// Generated from runtime/alpha3/src/core/roleplay-settings-routes.ts; edit the TypeScript source.
import { jsonResponse } from './roleplay-state.js';
import { selectedMainRoute, withTavernLock } from './tavern-tasks.js';
import { clusterSettings } from './character-cluster.js';
export function registerSettingsRoutes({ ctx, T, resolveRoleplaySession, modelPolicy, ensureBranch, taskAgents, characterCluster, characterRoster, memorySettingFields, memorySettingsPolicy, svc, narrativePresets }) {
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered', path: '/api/roleplay/presets', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? new URL(request.url).searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演对话不存在' });
                await ctx.get('tavernConversations')?.ready;
                const policy = body ? await narrativePresets.mutate(session.id, body) : narrativePresets.policy(session.id);
                return jsonResponse(200, { ok: true, ...policy });
            }
            catch (error) {
                const message = String(error.message);
                return jsonResponse(message.includes('已更新') ? 409 : 400, { ok: false, error: message });
            }
        } }), 'roleplay: narrative preset management');
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered', path: '/api/roleplay/models', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body) {
                    for (const selected of Object.values(body.settings?.routes ?? {})) {
                        if (!selected?.reasoningEffort)
                            continue;
                        if (!ctx.llm.resolveModelInfo)
                            throw new Error('当前模型目录不可用，无法验证思考等级；请稍后重试');
                        const info = await ctx.llm.resolveModelInfo(selected.provider, selected.model);
                        if (!info.reasoning?.efforts?.some(e => e.id === selected.reasoningEffort))
                            throw new Error(`模型 ${selected.model} 不支持思考等级 ${selected.reasoningEffort}`);
                    }
                    await modelPolicy.save(session, body.scope, body.settings, body.expectedRevision);
                }
                const data = await modelPolicy.read(session);
                const catalog = [];
                for (const provider of ctx.llm.listProviders?.() ?? []) {
                    try {
                        for (const model of await ctx.llm.listModels(provider.id)) {
                            let reasoning;
                            try {
                                reasoning = (await ctx.llm.resolveModelInfo?.(provider.id, model.id))?.reasoning;
                            }
                            catch { }
                            catalog.push({ provider: provider.id, model: model.id, label: model.name ?? model.id,
                                ...(Array.isArray(reasoning?.efforts) ? { reasoning: { efforts: reasoning.efforts.map(({ id, name, description }) => ({ id, name, ...(description ? { description } : {}) })), ...(reasoning.defaultEffort ? { defaultEffort: reasoning.defaultEffort } : {}) } } : {}) });
                        }
                    }
                    catch { }
                }
                return jsonResponse(200, { ok: true, ...data, catalog });
            }
            catch (error) {
                return jsonResponse(String(error.message).includes('已更新') ? 409 : 400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: model policy route');
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered', path: '/api/roleplay/character-cluster', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                await ensureBranch(session);
                await ctx.get('tavernConversations')?.ready;
                if (body) {
                    if (body.scope !== undefined && !['global', 'session'].includes(body.scope))
                        throw new Error('必须指定全局或会话范围');
                    const settings = clusterSettings(body.scope === 'global' ? { enabled: false, defaultRoute: body.settings?.defaultRoute, characters: {} } : body.settings);
                    const primary = selectedMainRoute(session, taskAgents.get(session.id), ctx.agentDefaultModel.currentSelection());
                    for (const selected of [settings.defaultRoute, ...Object.values(settings.characters)].filter((route) => route != null)) {
                        const route = 'main' in selected ? { ...primary, ...selected } : selected;
                        const info = await ctx.llm.resolveModelInfo?.(route.provider, route.model);
                        if (!info)
                            throw new Error('所选模型不在当前目录中');
                        if (route.reasoningEffort && !info.reasoning?.efforts?.some(e => e.id === route.reasoningEffort))
                            throw new Error('所选模型不支持该思考等级');
                    }
                    if (body.scope === 'global')
                        await characterCluster.saveGlobal(settings, body.expectedRevision);
                    else
                        await characterCluster.save(session, settings, body.expectedRevision);
                }
                return jsonResponse(200, { ok: true, sessionId: session.id, settings: characterCluster.read(session), session: characterCluster.readLocal(session), global: characterCluster.readGlobal(), characters: characterRoster(session).map(({ id, name }) => ({ id, name })) });
            }
            catch (error) {
                return jsonResponse(String(error.message).includes('已更新') ? 409 : 400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: character cluster settings');
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered', path: '/api/roleplay/memory-settings', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body) {
                    if (!['global', 'session'].includes(body.scope))
                        throw new Error('必须指定全局或会话范围');
                    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings))
                        throw new Error('记忆设置格式无效');
                    const patch = {};
                    for (const [field, raw] of Object.entries(body.settings)) {
                        if (!memorySettingFields.includes(field))
                            throw new Error(`未知设置：${field}`);
                        const value = raw === null ? 0 : Number(raw), minimum = field === 'autoNotesEveryTurns' ? 1 : ['contextWindowTokens', 'continuityTailTokens'].includes(field) ? 1000 : 1;
                        if (!Number.isSafeInteger(value) || value < 0 || (value > 0 && value < minimum))
                            throw new Error(`${field} 必须为至少 ${minimum} 的整数；0 或 null 表示继承`);
                        patch[field] = value || null;
                    }
                    if (!Object.keys(patch).length)
                        throw new Error('没有需要保存的字段');
                    await withTavernLock(T.branch, body.scope === 'global' ? 'memory-settings-global' : `panel-save:${session.id}`, async () => {
                        const policy = memorySettingsPolicy(session.id);
                        if (body.expectedRevision !== policy[body.scope].revision)
                            throw new Error('记忆设置已更新，请刷新后重试');
                        if (body.scope === 'session')
                            await svc.setSettings(session.id, patch);
                        else
                            await T.branch.put('memory-settings-global', { schemaVersion: 1, settings: { ...policy.global.settings, ...patch }, updatedAt: Date.now() });
                    });
                }
                return jsonResponse(200, { ok: true, ...memorySettingsPolicy(session.id) });
            }
            catch (error) {
                return jsonResponse(String(error.message).includes('已更新') ? 409 : 400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: memory settings policy');
}
