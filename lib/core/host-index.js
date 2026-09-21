// Generated from runtime/alpha3/src/core/host-index.ts; edit the TypeScript source.
// Host-wide routes exist before any roleplay Agent has been mounted.
// Userinfo shares the preset's roleplay-userinfo.json storage.
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createConversationCatalog } from './tavern-conversations.js';
import { readUserInfo as readUserInfoFile, writeUserInfo } from './roleplay-userinfo.js';
// HTTP clients expect an object even before a user profile exists.
const readUserInfo = () => readUserInfoFile() ?? {};
const jsonResponse = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const requestBody = (value) => value && typeof value === 'object' ? value : {};
const errorText = (error) => String(error !== null && typeof error === 'object' && 'message' in error ? error.message ?? error : error);
export const name = 'dsh-roleplay-ui';
export const inject = ['connection', 'sessionController'];
export function apply(ctx) {
    const home = process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh');
    const catalogPath = process.env.DSH_ROLEPLAY_CONVERSATIONS_PATH ?? join(home, 'roleplay-conversations.json');
    const catalog = createConversationCatalog({
        read: () => {
            try {
                return JSON.parse(readFileSync(catalogPath, 'utf8'));
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                    return null;
                throw error;
            }
        },
        write: (record) => {
            mkdirSync(join(catalogPath, '..'), { recursive: true });
            const temporary = `${catalogPath}.${randomUUID()}.tmp`;
            writeFileSync(temporary, JSON.stringify(record), 'utf8');
            renameSync(temporary, catalogPath);
        },
    });
    // Only registered RP operations establish ownership, never Session archives
    // or native parentSession links. Catalog migration validates durable IDs.
    const branchDirectory = join(home, 'storages', 'roleplay', 'branch');
    const legacy = [];
    try {
        for (const filename of readdirSync(branchDirectory))
            if (/^fork-op-[a-zA-Z0-9-]+\.json$/.test(filename)) {
                try {
                    const value = JSON.parse(readFileSync(join(branchDirectory, filename), 'utf8'));
                    if (value === null)
                        throw new Error('Null legacy worldline operation');
                    const record = requestBody(value).record;
                    // Preserve the legacy envelope/anchor bytes. The catalog applies its
                    // eligibility and durable identity checks before any ownership write.
                    legacy.push((record ?? value));
                }
                catch {
                    ctx.logger?.warn?.('roleplay: invalid legacy worldline operation was not migrated');
                }
            }
    }
    catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
            throw error;
    }
    const ready = catalog.migrate(legacy);
    // Retain rejection for request-time 503 without an unhandled startup error.
    void ready.catch(() => ctx.logger?.warn?.('roleplay: worldline catalog migration failed; original records retained'));
    ctx.provide?.('tavernConversations', { ...catalog, ready });
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/conversations', methods: ['GET'], fetch: async () => {
            try {
                await ready;
                return jsonResponse(200, { ok: true, ...catalog.snapshot() });
            }
            catch {
                return jsonResponse(503, { ok: false, error: '酒馆会话目录未就绪，原有记录未改写' });
            }
        } }), 'roleplay-ui: durable book/worldline catalog');
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/userinfo', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                if (request.method === 'GET')
                    return jsonResponse(200, { ok: true, userinfo: readUserInfo() });
                const body = requestBody(await request.json().catch(() => null));
                const next = { ...readUserInfo(), ...(body.name !== undefined ? { name: String(body.name).slice(0, 60) } : {}), ...(body.gender !== undefined ? { gender: String(body.gender).slice(0, 30) } : {}), updatedAt: Date.now() };
                writeUserInfo(next);
                return jsonResponse(200, { ok: true, userinfo: next });
            }
            catch (error) {
                return jsonResponse(500, { ok: false, error: errorText(error) });
            }
        } }), 'roleplay-ui: userinfo route');
    // Resume only the selected Session after a Host restart. No prompt or sibling
    // wake is issued; agent-owned routes become available through native resume.
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/wake', methods: ['POST'], fetch: async (request) => {
            try {
                const body = requestBody(await request.json().catch(() => null));
                const sessionId = String(body.sessionId ?? '').trim();
                if (!sessionId || sessionId.length > 200 || /[\u0000-\u001f]/.test(sessionId))
                    return jsonResponse(400, { ok: false, error: 'sessionId 无效' });
                const found = await ctx.sessionController.resolveAgent(sessionId);
                if (!found || 'error' in found || !found.agent?.session)
                    return jsonResponse(404, { ok: false, error: '会话不存在或无法恢复' });
                const session = found.agent.session;
                let preset = session.header?.agentPreset;
                // Pinned alpha.3 synchronous history adapter. GA needs an upstream
                // projection/async reader (docs/migration-ga.md), not snapshotEvents.
                const events = session.events ?? [];
                for (let index = events.length - 1; index >= 0; index -= 1) {
                    const event = events[index];
                    if (event?.type === 'agent-preset/selected' && event.data?.agentPreset) {
                        preset = event.data.agentPreset;
                        break;
                    }
                }
                if (preset !== 'roleplay')
                    return jsonResponse(409, { ok: false, error: '目标不是角色扮演会话' });
                return jsonResponse(200, { ok: true, sessionId: session.id, preset: 'roleplay' });
            }
            catch (error) {
                return jsonResponse(500, { ok: false, error: errorText(error) });
            }
        } }), 'roleplay-ui: cold Session wake route');
}
