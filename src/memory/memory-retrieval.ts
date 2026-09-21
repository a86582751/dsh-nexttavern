import { fork, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    selectedRetrievalRows,
    queryRetrievalRows,
    readRetrievalRows,
    projectedSourceOffset,
} from './memory-story-text.js';
import type { RetrievalRow } from './memory-story-text.js';
import type { StorySession, StoryEvent } from './memory-history.js';
import { LOCAL_MODELS, localTokenBudget } from './memory-local-catalog.js';
import { boundedJSON } from './memory-embedding-api.js';
import type {
    EmbeddingProvider,
    EmbeddingCall,
    RetrievalMode,
    VectorSource,
    WorkerRequest,
} from './memory-retrieval-types.js';
type Session = StorySession & {
    header?: {
        cwd?: string;
        agentPreset?: string;
        origin?: string;
        id?: string | null;
        parentSession?: string;
        createdAt?: number;
    };
};
interface Settings {
    schemaVersion: 1;
    revision: number;
    adaptationRevision: number;
    adaptationProviderId: string | null;
    chunkChars: number;
    globalMode: RetrievalMode;
    overrides: Record<string, RetrievalMode | 'inherit'>;
    activeProviderId: string | null;
    providers: EmbeddingProvider[];
    enabled: string[];
    autoIndexNewConversations: boolean;
    autoRebuildLocalOnRetrieval: boolean;
    autoIndexNewSince: number | null;
    autoConversations: Record<string, string | null>;
    conversationScopeSince: number;
    conversationIndex: Record<string, boolean>;
}
interface Dependencies {
    table: {
        get(key: string): unknown;
        put(key: string, value: unknown): unknown | PromiseLike<unknown>;
    };
    record(call: EmbeddingCall): unknown | PromiseLike<unknown>;
    session(id: string): Session | null | undefined;
    list?(): Promise<{
        header?: Session['header'];
    }[]>;
    read?(id: string): Promise<{
        session: Session['header'];
        events: readonly unknown[];
        view?: Session;
    }>;
    active(session: Session): boolean;
    scopeOf?(session: Session): string;
}
interface RebuildOffer {
    kind: 'story' | 'novel';
    action?: 'configure-adaptation-model';
    target: string;
    model: string;
    reason: string;
    key: string;
    valid(): boolean;
    confirm(): Promise<unknown>;
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const MODE = ['keyword', 'semantic', 'hybrid'];
const SETTINGS = 'memory-retrieval-settings-v1';
function eligible(session: Session) {
    let preset = session.header?.agentPreset;
    for (const e of session.events ?? session.log ?? [])
        if (e.type === 'agent-preset/selected')
            preset = e.data?.agentPreset as string | undefined;
    return preset === 'roleplay' && session.header?.origin !== 'subagent';
}
const initial = (): Settings => ({
    schemaVersion: 1,
    revision: 0,
    adaptationRevision: 0,
    adaptationProviderId: null,
    chunkChars: 480,
    globalMode: 'keyword',
    overrides: {},
    activeProviderId: null,
    providers: [],
    enabled: [],
    autoIndexNewConversations: false,
    autoRebuildLocalOnRetrieval: false,
    autoIndexNewSince: null,
    autoConversations: {},
    conversationScopeSince: Date.now(),
    conversationIndex: {}
});
/** Metadata-only replay of the native surface contract; required edits need a host-prepared view. */
export function retrievalColdSession(id: string, header: Session['header'], events: readonly unknown[]): Session {
    const nodes: number[] = [];
    for (const value of events) {
        // Legacy metadata-only callers cannot interpret required message edits.
        // Current product reads supply a host-prepared view instead of this fallback.
        if ((value as {type?: string})?.type === 'roleplay/message-edit') {
            throw Error('消息编辑归档必须使用宿主投影读取');
        }
        const e = value as {
            seq: number;
            surfaceOp?: unknown;
        };
        if (e.surfaceOp === 'append')
            nodes.push(e.seq);
        else if (e.surfaceOp && typeof e.surfaceOp === 'object') {
            const op = e.surfaceOp as {
                op?: string;
                startSeq?: number;
                endSeq?: number;
            }, start = nodes.indexOf(op.startSeq!), end = nodes.indexOf(op.endSeq!);
            if (op.op !== 'replace' || start < 0 || end < start)
                throw Error('无法确认归档世界线来源');
            nodes.splice(start, end - start + 1, e.seq);
        }
    }
    return {
        id, header, events: events as readonly StoryEvent[], surface: {
            nodes
        }
    };
}
export function createMemoryRetrieval(deps: Dependencies) {
    const home = resolve(process.env.NEXTTAVERN_MEMORY_HOME ?? join(homedir(), '.nexttavern-memory'));
    let worker: ChildProcess | null = null,
        serial = 0,
        disposed = false,
        mutation = Promise.resolve<unknown>(null),
        ledgerWrites = Promise.resolve<unknown>(null);
    const previous = deps.table.get(SETTINGS) as Settings | undefined;
    // Freeze legacy workspace enrollment at upgrade time; future conversations use only the explicit default.
    const migration = previous && (previous.conversationScopeSince === undefined || previous.adaptationProviderId === undefined) ? (async () => {
        const since = previous.conversationScopeSince ?? Date.now(), conversationIndex: Record<string, boolean> = {
            ...previous.conversationIndex
        };
        if (previous.conversationScopeSince === undefined && previous.enabled.length)
            for (const item of await deps.list?.() ?? []) {
                const h = item.header;
                if (!h?.id || !h.cwd || h.origin === 'subagent' || h.agentPreset !== 'roleplay' || Number(h.createdAt ?? 0) > since
                    || !previous.enabled.includes(hash(resolve(h.cwd))))
                    continue;
                conversationIndex[deps.scopeOf?.({
                    id: h.id, header: h, events: []
                } as Session) ?? h.id] = true;
            }
        // Freeze the former shared choice once on upgrade; subsequent choices are independent.
        await deps.table.put(SETTINGS, {
            ...previous,
            conversationScopeSince: since,
            conversationIndex,
            adaptationProviderId: previous.adaptationProviderId === undefined ? previous.activeProviderId : previous.adaptationProviderId,
            adaptationRevision: previous.adaptationRevision ?? 0
        });
    })() : Promise.resolve();
    mutation = migration;
    void migration.catch(() => {
    }); // Report through the owning API; an upgrade write failure must not crash the host.
    const scans = new Map<string, Promise<void>>();
    const localRebuilds = new Map<string, {
        generation: string;
        startedAt: number;
        pending: boolean;
    }>();
    const waiting = new Map<number, {
        resolve(value: unknown): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    const configured = new Map<string, string>(), modelLists = new Map<string, {
        ids: string[];
        fetchedAt: number;
        error?: string;
    }>(), refreshes = new Map<string, Promise<void>>();
    const workspaceKinds = new Map<string, 'story' | 'novel'>();
    const confirmations = new Map<string, {
        id: string;
        sessionId: string;
        offer: RebuildOffer;
        expires: number;
        busy: boolean;
        cancelled: boolean;
    }>();
    function rebuildConfirmation(session: Session, offer: RebuildOffer) {
        for (const [key, item] of confirmations)
            if (item.expires < Date.now() || !item.offer.valid())
                confirmations.delete(key);
        const key = `${session.id}:${offer.kind}:${offer.key}`, existing = confirmations.get(key);
        if (existing)
            return {
                status: existing.cancelled ? 'rebuild-cancelled' : 'awaiting-rebuild-confirmation', confirmationId: existing.id
            };
        if (confirmations.size >= 256)
            confirmations.delete(confirmations.keys().next().value!);
        const id = randomUUID();
        confirmations.set(key, {
            id, sessionId: session.id, offer, expires: Date.now() + 15 * 60000, busy: false, cancelled: false
        });
        return {
            status: 'awaiting-rebuild-confirmation', confirmationId: id
        };
    }
    function pendingRebuilds(session: Session) {
        return [...confirmations.values()].filter(item => item.sessionId === session.id && !item.cancelled && item.expires > Date.now() && deps.active(session)
            && item.offer.valid()).map(({ id, offer }) => ({
            id,
            kind: offer.kind,
            ...(offer.action ? {
                action: offer.action
            } : {}),
            target: offer.target,
            model: offer.model,
            reason: offer.reason
        }));
    }
    async function resolveRebuild(session: Session, id: string, action: string) {
        if (!['confirm', 'cancel'].includes(action))
            throw Error('确认操作无效');
        const pair = [...confirmations].find(([, item]) => item.id === id), item = pair?.[1];
        if (!item || item.sessionId !== session.id || item.expires < Date.now() || !deps.active(session) || !item.offer.valid()
            || item.cancelled)
            throw Error('重建目标或模型已变化，请重新查询');
        if (item.busy)
            throw Error('重建正在提交，请勿重复确认');
        if (action === 'cancel') {
            if (item.offer.action === 'configure-adaptation-model')
                confirmations.delete(pair![0]);
            else {
                item.cancelled = true;
                item.expires = Date.now() + 30000;
            }
            return {
                ok: true
            };
        }
        item.busy = true;
        try {
            await item.offer.confirm();
            confirmations.delete(pair![0]);
            return {
                ok: true
            };
        }
        catch (error) {
            item.busy = false;
            throw error;
        }
    }
    // Epochs invalidate an in-flight configure/reset before it can publish a stale worker state.
    const configurationEpochs = new Map<string, number>();
    async function setConfiguration(ws: string, message: WorkerRequest, generation: string) {
        const epoch = configurationEpochs.get(ws) ?? 0;
        await request(message);
        if ((configurationEpochs.get(ws) ?? 0) !== epoch)
            throw Error('向量模型设置已变化，请重试');
        configured.set(ws, generation);
    }
    const delayed = new Map<string, ReturnType<typeof setTimeout>>();
    function modeFor(session: Session, cfg: Settings): RetrievalMode {
        let current: Session | undefined = session;
        const seen = new Set<string>();
        while (current && !seen.has(current.id)) {
            seen.add(current.id);
            const own = cfg.overrides[current.id];
            if (own)
                return own === 'inherit' ? cfg.globalMode : own;
            const parent: string | undefined = current.header?.parentSession;
            if (!parent)
                break;
            const inherited = cfg.overrides[parent];
            if (inherited)
                return inherited === 'inherit' ? cfg.globalMode : inherited;
            current = deps.session(parent) ?? undefined;
        }
        return cfg.globalMode;
    }
    function settings(): Settings {
        const value = deps.table.get(SETTINGS) as Settings | undefined;
        if (!value)
            return initial();
        if (value.schemaVersion !== 1 || !Array.isArray(value.providers))
            throw Error('检索设置版本无效');
        const result = {
            ...initial(), ...structuredClone(value)
        };
        if (!Number.isSafeInteger(result.chunkChars) || result.chunkChars < 128 || result.chunkChars > 2048)
            throw Error('索引块大小设置无效');
        return result;
    }
    const pathWorkspace = (session: Session) => {
        if (!session.header?.cwd)
            throw Error('会话工作区不可用');
        return hash(resolve(session.header.cwd));
    };
    const conversation = (session: Session) => deps.scopeOf?.(session) ?? session.id;
    const workspace = (session: Session) => hash(`story-conversation-v1:${pathWorkspace(session)}:${conversation(session)}`);
    const sessionEnabled = (cfg: Settings, s: Session) => {
        const root = conversation(s);
        if (Object.hasOwn(cfg.conversationIndex, root))
            return cfg.conversationIndex[root] === true;
        if (Object.hasOwn(cfg.autoConversations, root))
            return cfg.autoConversations[root] !== null;
        return cfg.enabled.includes(pathWorkspace(s)) && Number(s.header?.createdAt ?? 0) < cfg.conversationScopeSince;
    };
    function pauseConversation(cfg: Settings, s: Session) {
        const root = conversation(s);
        cfg.conversationIndex[root] = false;
        cfg.autoConversations[root] = null;
    }
    /** Native announce also fires on load: use durable birth time and decisions, never first observation. */
    async function created(session: Session) {
        const run = mutation.catch(() => {
        }).then(async () => {
            await migration;
            if (disposed || !session.header?.cwd || session.header.parentSession || !eligible(session))
                return;
            const cfg = settings();
            if (!cfg.autoIndexNewConversations || cfg.autoIndexNewSince === null || !Number.isFinite(session.header.createdAt)
                || session.header.createdAt! < cfg.autoIndexNewSince
                || Object.hasOwn(cfg.autoConversations, session.id))
                return;
            cfg.autoConversations[session.id] = cfg.providers.some(p => p.id === cfg.activeProviderId && p.ready) ? workspace(session) : null;
            cfg.revision++;
            await deps.table.put(SETTINGS, cfg);
        });
        mutation = run;
        return run;
    }
    const keyPath = (id: string) => join(home, 'credentials', `${hash(id)}.key`);
    const secret = (p: EmbeddingProvider, cfg: Settings) => ({
        ...p, chunkChars: cfg.chunkChars, apiKey: existsSync(keyPath(p.id)) ? readFileSync(keyPath(p.id), 'utf8') : undefined
    });
    function request(message: WorkerRequest, timeout = 10000): Promise<unknown> {
        if (disposed)
            return Promise.reject(Error('检索服务已关闭'));
        if (!worker) {
            mkdirSync(home, {
                recursive: true, mode: 0o700
            });
            worker = fork(fileURLToPath(new URL('./memory-vector-worker.mjs', import.meta.url)), [home], {
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=256']
            });
            worker.on('message', (raw: unknown) => {
                const message = raw as {
                    id?: number;
                    result?: unknown;
                    error?: string;
                    code?: string;
                    call?: EmbeddingCall;
                };
                const guard = raw as {
                    sourceCheck?: {
                        id: number;
                        owner: string;
                    };
                };
                if (guard.sourceCheck) {
                    const owner = deps.session(guard.sourceCheck.owner);
                    let allowed = false;
                    try {
                        allowed = !!owner && !disposed && deps.active(owner);
                    }
                    catch {
                    }
                    worker?.send({
                        sourceCheckId: guard.sourceCheck.id, allowed
                    });
                    return;
                }
                if (message.call) {
                    const call = message.call;
                    ledgerWrites = ledgerWrites.catch(() => {
                    }).then(() => deps.record(call));
                    return;
                }
                const p = waiting.get(message.id!);
                if (!p)
                    return;
                clearTimeout(p.timer);
                waiting.delete(message.id!);
                message.error ? p.reject(Object.assign(Error(message.error), {
                    code: message.code
                })) : p.resolve(message.result);
            });
            worker.on('exit', () => {
                worker = null;
                configured.clear();
                for (const p of waiting.values()) {
                    clearTimeout(p.timer);
                    p.reject(Error('向量服务已退出，已回退关键词'));
                }
                waiting.clear();
            });
            worker.on('error', () => {
            });
        }
        const id = ++serial;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                waiting.delete(id);
                reject(Error('检索服务超时'));
            }, timeout);
            waiting.set(id, {
                resolve, reject, timer
            });
            worker!.send({
                id, ...message
            });
        });
    }
    const vectorSources = (session: Session, rows: RetrievalRow[]): VectorSource[] => eligible(session) ? rows.filter(r => !r.unresolved).map(row => ({
        id: row.id, sessionId: session.id, seq: row.seq, role: row.role, text: row.text, hash: hash(row.text)
    })) : [];
    async function configure(session: Session) {
        await migration;
        const cfg = settings(),
            ws = workspace(session),
            provider = cfg.providers.find(p => p.id === cfg.activeProviderId),
            enabled = sessionEnabled(cfg, session),
            generation = hash(JSON.stringify([
                provider?.revision,
                provider?.ready,
                provider?.dimensions,
                enabled,
                cfg.chunkChars,
            ]));
        workspaceKinds.set(ws, 'story');
        if (!worker && !provider)
            return {
                cfg, ws, provider, generation
            };
        if (configured.get(ws) !== generation)
            await setConfiguration(ws, {
                action: 'configure', workspace: ws, provider: provider?.ready ? secret(provider, cfg) : undefined, enabled, generation
            }, generation);
        return {
            cfg, ws, provider, generation
        };
    }
    async function sync(session: Session) {
        if (disposed || !eligible(session) || !deps.active(session))
            return;
        const cfg = settings(), ws = workspace(session);
        if (!sessionEnabled(cfg, session) || !cfg.activeProviderId)
            return;
        await configure(session);
        const rows = selectedRetrievalRows(session);
        await request({
            action: 'sync', workspace: ws, legacyWorkspace: pathWorkspace(session), sources: vectorSources(session, rows)
        }, 30000);
    }
    function changed(session: Session) {
        if (disposed || !session.header?.cwd || !sessionEnabled(settings(), session) || !eligible(session))
            return;
        if (delayed.has(session.id))
            clearTimeout(delayed.get(session.id));
        delayed.set(session.id, setTimeout(() => {
            delayed.delete(session.id);
            void sync(session).catch(() => {
            });
        }, 500));
    }
    async function backfill(session: Session) {
        const ws = workspace(session), pending = scans.get(ws);
        if (pending)
            return pending;
        const scan = (async () => {
            await sync(session);
            for (const item of await deps.list?.() ?? []) {
                const header = item.header;
                if (!header?.id || !header.cwd || resolve(header.cwd) !== resolve(session.header!.cwd!) || header.origin === 'subagent'
                    || header.agentPreset !== 'roleplay')
                    continue;
                if (disposed || !sessionEnabled(settings(), session))
                    break;
                if (conversation({
                    id: header.id, header, events: []
                } as Session) !== conversation(session))
                    continue;
                try {
                    const live = deps.session(header.id);
                    if (live) {
                        await sync(live);
                        continue;
                    }
                    const snapshot = await deps.read?.(header.id);
                    if (snapshot)
                        await sync(snapshot.view ?? retrievalColdSession(header.id, snapshot.session, snapshot.events));
                }
                catch { /* Invalid source remains absent; never guess its worldline. */
                }
            }
        })();
        scans.set(ws, scan);
        try {
            await scan;
        }
        finally {
            if (scans.get(ws) === scan)
                scans.delete(ws);
        }
    }
    async function restoreEnabled() {
        const seen = new Set<string>();
        for (const item of await deps.list?.() ?? []) {
            const h = item.header;
            if (disposed)
                return;
            if (!h?.id || !h.cwd || h.origin === 'subagent' || h.agentPreset !== 'roleplay')
                continue;
            const candidate = {
                id: h.id, header: h, events: []
            } as Session, ws = workspace(candidate);
            if (seen.has(ws) || !sessionEnabled(settings(), candidate))
                continue;
            try {
                const live = deps.session(h.id), snapshot = live ? null : await deps.read?.(h.id);
                const session = live ?? (snapshot
                    ? snapshot.view ?? retrievalColdSession(h.id, snapshot.session, snapshot.events) : null);
                if (session) {
                    seen.add(ws);
                    await backfill(session);
                }
            }
            catch { /* A corrupt session must not prevent another workspace from restoring. */
            }
        }
    }
    async function view(session: Session) {
        await migration;
        const cfg = settings(), ws = workspace(session);
        let status: {
            progress?: Record<string, unknown>;
            catalog?: Record<string, unknown>[];
            rss?: number;
        } = {};
        if (worker || cfg.activeProviderId) {
            await configure(session);
            status = await request({
                action: 'status',
                workspace: ws,
                legacyWorkspace: pathWorkspace(session),
                sources: vectorSources(session, selectedRetrievalRows(session))
            }) as typeof status;
        }
        return {
            revision: cfg.revision,
            chunkChars: cfg.chunkChars,
            effectiveChunkChars: cfg.chunkChars,
            mode: modeFor(session, cfg),
            scope: cfg.overrides[session.id] && cfg.overrides[session.id] !== 'inherit' ? 'session' : 'global',
            indexEnabled: sessionEnabled(cfg, session) && status.progress?.stale !== true,
            autoIndexNewConversations: cfg.autoIndexNewConversations,
            autoRebuildLocalOnRetrieval: cfg.autoRebuildLocalOnRetrieval,
            activeProviderId: cfg.activeProviderId,
            adaptationProviderId: cfg.adaptationProviderId,
            providers: cfg.providers.map(({ apiKey: _, ...p }) => ({
                ...p, dimensions: p.requestedDimensions ?? null, actualDimensions: p.dimensions, keySet: existsSync(keyPath(p.id))
            })),
            catalog: LOCAL_MODELS.map(({ files, repo, revision, pooling, queryPrefix, ...item }) => ({
                ...item,
                status: 'not-installed',
                totalBytes: files.reduce((n, f) => n + f.bytes, 0),
                downloadedBytes: 0,
                ...status.catalog?.find(c => c.id === item.id)
            })),
            progress: status.progress ?? {
                vectors: 0, sources: 0, covered: 0, pending: 0, running: 0, failed: 0, unknown: 0, bytes: 0, lastError: null
            },
            scanning: scans.has(ws),
            modelList: modelLists.get(cfg.activeProviderId ?? '') ?? {
                ids: [], fetchedAt: null
            }
        };
    }
    /** Novel model metadata must not configure, wake or inspect the story index. */
    async function adaptationModels(_session: Session) {
        await migration;
        const cfg = settings();
        return {
            revision: cfg.adaptationRevision,
            activeProviderId: cfg.adaptationProviderId,
            providers: cfg.providers.map(({ apiKey: _, ...p }) => ({
                ...p, dimensions: p.requestedDimensions ?? null, actualDimensions: p.dimensions, keySet: existsSync(keyPath(p.id))
            }))
        };
    }
    function adaptationCurrent(revision: number) {
        return settings().adaptationRevision === revision;
    }
    /** Diagnosis never starts/configures a worker, imports legacy vectors, tests a model or enqueues work. */
    async function diagnose(session: Session) {
        await migration;
        const cfg = settings(),
            ws = workspace(session),
            provider = cfg.providers.find(p => p.id === cfg.activeProviderId),
            enabled = sessionEnabled(cfg, session);
        const generation = hash(JSON.stringify([provider?.revision, provider?.ready, provider?.dimensions, enabled, cfg.chunkChars]));
        let progress: Record<string, unknown> | null = null;
        if (worker && configured.get(ws) === generation) {
            try {
                const reply = await request({
                    action: 'status', workspace: ws, sources: vectorSources(session, selectedRetrievalRows(session))
                }, 3000) as {
                    progress: Record<string, unknown>;
                };
                if (settings().revision === cfg.revision)
                    progress = Object.fromEntries([
                        'fingerprint', 'stale', 'staleVectors', 'vectors', 'sources', 'covered', 'pending', 'running', 'failed', 'unknown'
                    ].map(k => [k, reply.progress[k] ?? null]));
            }
            catch { /* A cold or failed worker is unavailable evidence, not a reason to start it. */
            }
        }
        return {
            revision: cfg.revision,
            conversationId: conversation(session),
            mode: modeFor(session, cfg),
            indexAutoUpdateRequested: enabled,
            autoIndexNewConversations: cfg.autoIndexNewConversations,
            autoRebuildLocalOnRetrieval: cfg.autoRebuildLocalOnRetrieval,
            activeProvider: provider ? {
                id: provider.id,
                name: provider.name,
                kind: provider.kind,
                protocol: provider.protocol,
                model: provider.model,
                revision: provider.revision,
                embeddingRevision: provider.embeddingRevision ?? null,
                dimensions: provider.dimensions,
                ready: provider.ready
            } : null,
            progress,
            progressCoverage: progress ? 'current-worker' : 'unavailable; inspect Embedding panel',
            rebuildScheduled: localRebuilds.get(ws)?.pending === true,
            extraModelCalls: 0
        };
    }
    async function mutate(session: Session, body: Record<string, unknown>) {
        const run = mutation.catch(() => {
        }).then(async () => {
            await migration;
            const cfg = settings();
            if (body.expectedRevision !== (body.action === 'activate-adaptation-provider' ? cfg.adaptationRevision : cfg.revision))
                throw Error('检索设置已更新，请刷新后重试');
            const action = String(body.action), ws = workspace(session), id = String(body.providerId ?? '');
            const priorStory = cfg.activeProviderId, priorNovel = cfg.adaptationProviderId;
            const provider = cfg.providers.find(p => p.id === id);
            if (action === 'mode') {
                if (!MODE.includes(String(body.mode)))
                    throw Error('检索模式无效');
                if (body.scope === 'global') {
                    cfg.globalMode = body.mode as RetrievalMode;
                    cfg.overrides[session.id] = 'inherit';
                }
                else
                    cfg.overrides[session.id] = body.mode as RetrievalMode;
            }
            else if (action === 'auto-index-new-conversations') {
                if (typeof body.enabled !== 'boolean')
                    throw Error('自动索引开关无效');
                if (body.enabled && !cfg.providers.some(p => p.id === cfg.activeProviderId && p.ready))
                    throw Error('请先启用已测试可用的向量模型');
                if (body.enabled && !cfg.autoIndexNewConversations)
                    cfg.autoIndexNewSince = Date.now();
                cfg.autoIndexNewConversations = body.enabled;
            }
            else if (action === 'auto-rebuild-local-on-retrieval') {
                if (typeof body.enabled !== 'boolean')
                    throw Error('自动重建开关无效');
                cfg.autoRebuildLocalOnRetrieval = body.enabled;
            }
            else if (action === 'index-chunk-size') {
                if (!Number.isSafeInteger(body.chunkChars) || Number(body.chunkChars) < 128 || Number(body.chunkChars) > 2048)
                    throw Error('索引块大小须为 128–2048 的整数');
                cfg.chunkChars = Number(body.chunkChars);
            }
            else if (action === 'save-provider') {
                const input = body.provider as Record<string, unknown>;
                if (!input || typeof input !== 'object')
                    throw Error('缺少接入配置');
                const previous = cfg.providers.find(p => p.id === input.id),
                    id = previous?.id ?? randomUUID(),
                    kind = input.kind === 'local' ? 'local' : 'online';
                const protocol = String(input.protocol ?? 'openai');
                if (!['openai', 'dashscope-text', 'dashscope-multimodal'].includes(protocol))
                    throw Error('协议无效');
                const model = String(input.model ?? '').trim();
                if (!model || model.length > 200)
                    throw Error('模型 ID 无效');
                let baseUrl = kind === 'online' ? String(input.baseUrl ?? '').trim().replace(/\/+$/, '') : '';
                if (kind === 'online') {
                    const url = new URL(baseUrl);
                    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
                        throw Error('请填写不含认证信息的 API 根 URL');
                    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
                        throw Error('远程 API 必须使用 HTTPS');
                }
                else if (!LOCAL_MODELS.some(m => m.id === model))
                    throw Error('本地模型不在受信目录');
                const dimensions = input.dimensions == null || input.dimensions === '' ? null : Number(input.dimensions);
                if (dimensions !== null && (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 8192))
                    throw Error('维度必须为1–8192');
                const embeddingRevision = kind === 'online' ? String(input.embeddingRevision ?? '').trim() : '';
                if (embeddingRevision.length > 200)
                    throw Error('模型修订版本过长');
                const p: EmbeddingProvider = {
                    id,
                    name: String(input.name ?? model).slice(0, 100),
                    kind,
                    protocol: protocol as EmbeddingProvider['protocol'],
                    baseUrl,
                    model,
                    dimensions,
                    ready: false,
                    revision: randomUUID(),
                    requestedDimensions: dimensions,
                    embeddingRevision: embeddingRevision || undefined
                };
                if (kind === 'local')
                    p.localMaxTokens = localTokenBudget(model, input.localMaxTokens ?? 512);
                if (kind === 'local') {
                    if (existsSync(keyPath(id)))
                        unlinkSync(keyPath(id));
                }
                else if (input.apiKey) {
                    mkdirSync(join(home, 'credentials'), {
                        recursive: true, mode: 0o700
                    });
                    writeFileSync(keyPath(id), String(input.apiKey), {
                        mode: 0o600
                    });
                }
                cfg.providers = cfg.providers.filter(p => p.id !== id).concat(p);
                modelLists.delete(id);
            }
            else if (action === 'test-provider') {
                if (!provider)
                    throw Error('接入不存在');
                const result = await request({
                    action: 'test', workspace: ws, provider: secret(provider, cfg)
                }, 45000) as {
                    dimensions: number;
                };
                provider.dimensions = result.dimensions;
                provider.ready = true;
                provider.error = undefined;
            }
            else if (action === 'activate-provider') {
                if (!provider?.ready)
                    throw Error('请先完成接入测试');
                cfg.activeProviderId = provider.id;
            }
            else if (action === 'activate-adaptation-provider') {
                if (id && !provider?.ready)
                    throw Error('请先完成接入测试');
                cfg.adaptationProviderId = id || null;
            }
            else if (action === 'delete-provider') {
                if (!provider)
                    throw Error('接入不存在');
                cfg.providers = cfg.providers.filter(p => p.id !== id);
                if (cfg.activeProviderId === id)
                    cfg.activeProviderId = null;
                if (cfg.adaptationProviderId === id)
                    cfg.adaptationProviderId = null;
                if (existsSync(keyPath(id)))
                    unlinkSync(keyPath(id));
            }
            else if (action === 'index') {
                if (body.enabled && !cfg.providers.find(p => p.id === cfg.activeProviderId)?.ready)
                    throw Error('请先启用可用向量来源');
                if (body.enabled && (await view(session)).progress?.stale)
                    throw Error('Embedding 配置已变化，请先重建向量数据库');
                pauseConversation(cfg, session);
                cfg.conversationIndex[conversation(session)] = !!body.enabled;
            }
            else if (action === 'clear-index' || action === 'rebuild-index') {
                const active = cfg.providers.find(p => p.id === cfg.activeProviderId);
                if (body.confirmProviderId !== cfg.activeProviderId || (action === 'rebuild-index' && !active?.ready))
                    throw Error('当前向量来源已变化，请重新确认');
                // Persist pause before clearing. A crash or failed clear cannot silently refill it.
                pauseConversation(cfg, session);
                cfg.revision++;
                await deps.table.put(SETTINGS, cfg);
                configured.delete(ws);
                await configure(session);
                try {
                    await request({
                        action: 'clear-index', workspace: ws
                    }, 30000);
                }
                catch {
                    throw Error('自动更新已暂停，但清空结果尚未确认；请刷新进度后再操作');
                }
                configured.delete(ws);
                await scans.get(ws)?.catch(() => {
                });
                if (action === 'rebuild-index')
                    cfg.conversationIndex[conversation(session)] = true;
            }
            else if (action === 'reindex') {
                if (!cfg.providers.some(p => p.id === cfg.activeProviderId && p.ready))
                    throw Error('请先启用可用向量来源');
                if ((await view(session)).progress?.stale)
                    throw Error('Embedding 配置已变化，请先重建向量数据库');
                cfg.conversationIndex[conversation(session)] = true;
                await configure(session);
                await request({
                    action: 'retry', workspace: ws
                });
            }
            else if (action === 'refresh-models') {
                if (!provider || provider.kind !== 'online')
                    throw Error('请选择在线接入');
                if (!refreshes.has(id)) {
                    const run = (async () => {
                        const old = modelLists.get(id);
                        try {
                            const p = secret(provider, cfg),
                                root = p.protocol === 'openai'
                                    ? p.baseUrl
                                    : p.baseUrl.replace(/\/api\/v1$/, '/compatible-mode/v1');
                            const response = await fetch(`${root}/models`, {
                                headers: {
                                    authorization: `Bearer ${p.apiKey ?? ''}`
                                }, signal: AbortSignal.timeout(10000)
                            });
                            if (!response.ok)
                                throw Error(`模型列表 HTTP ${response.status}`);
                            const data = await boundedJSON(response, 2 * 1024 ** 2);
                            const ids = [
                                ...new Set((Array.isArray(data.data) ? data.data : []).map(r => typeof r === 'object' && r ? String((r as {
                                    id?: unknown;
                                }).id ?? '') : '').filter(id => id.length <= 200 && id.toLowerCase().includes('embedding')))
                            ].slice(0, 1000);
                            modelLists.set(id, {
                                ids, fetchedAt: Date.now()
                            });
                        }
                        catch (error) {
                            modelLists.set(id, {
                                ids: old?.ids ?? [], fetchedAt: old?.fetchedAt ?? 0, error: String((error as Error).message)
                            });
                        }
                    })();
                    refreshes.set(id, run);
                    try {
                        await run;
                    }
                    finally {
                        refreshes.delete(id);
                    }
                }
                else
                    await refreshes.get(id);
                return {
                    ...await view(session), modelList: modelLists.get(id)
                };
            }
            else if (['download-model', 'pause-download', 'delete-model'].includes(action)) {
                if (action === 'delete-model'
                    && cfg.providers.some(p =>
                        (p.id === cfg.activeProviderId || p.id === cfg.adaptationProviderId)
                        && p.kind === 'local'
                        && p.model === body.modelId))
                    throw Error('请先切换或删除剧情记忆和小说研究中正在使用的接入');
                await request({
                    action, modelId: String(body.modelId)
                }, 30000);
                if (action === 'delete-model')
                    for (const p of cfg.providers)
                        if (p.kind === 'local' && p.model === body.modelId)
                            p.ready = false;
            }
            else
                throw Error('检索操作无效');
            const editedId = action === 'save-provider' ? String((body.provider as Record<string, unknown>)?.id ?? '') : id;
            const providerChanged = ['save-provider', 'delete-provider', 'test-provider'].includes(action);
            const storyChanged = action === 'activate-provider' || action === 'index-chunk-size' || (providerChanged && editedId === priorStory);
            const novelChanged = action === 'activate-adaptation-provider' || action === 'index-chunk-size' || (providerChanged && editedId === priorNovel);
            if (novelChanged)
                cfg.adaptationRevision++;
            if (action !== 'activate-adaptation-provider')
                cfg.revision++;
            await deps.table.put(SETTINGS, cfg);
            if (worker)
                for (const [key, kind] of workspaceKinds)
                    if (kind === 'story' ? storyChanged : novelChanged) {
                        configurationEpochs.set(key, (configurationEpochs.get(key) ?? 0) + 1);
                        configured.delete(key);
                        await request({
                            action: 'reset', workspace: key
                        });
                    }
            if (action === 'activate-adaptation-provider')
                return adaptationModels(session);
            await configure(session);
            if (sessionEnabled(cfg, session) && ['index', 'reindex', 'activate-provider', 'rebuild-index'].includes(action))
                void backfill(session).catch(() => {
                });
            if (['activate-provider', 'delete-provider', 'save-provider'].includes(action))
                void restoreEnabled().catch(() => {
                });
            return view(session);
        });
        mutation = run;
        return run;
    }
    /** Lazy repair is requested only by a stale story query, never by viewing, loading or switching models. */
    function scheduleLocalRebuild(session: Session, captured: Settings, provider: EmbeddingProvider, invalid = false): boolean {
        if (!captured.autoRebuildLocalOnRetrieval || provider.kind !== 'local' || !provider.ready
            || !sessionEnabled(captured, session))
            return false;
        const ws = workspace(session), generation = `${captured.revision}:${provider.id}:${provider.revision}`, previous = localRebuilds.get(ws);
        if (previous?.pending)
            return true;
        if (previous?.generation === generation && Date.now() - previous.startedAt < 30000)
            return false;
        const attempt = {
            generation, startedAt: Date.now(), pending: true
        };
        localRebuilds.set(ws, attempt);
        const valid = () => {
            const cfg = settings(), p = cfg.providers.find(p => p.id === cfg.activeProviderId);
            return !disposed && eligible(session) && deps.active(session) && cfg.revision === captured.revision
                && cfg.autoRebuildLocalOnRetrieval
                && sessionEnabled(cfg, session)
                && modeFor(session, cfg) !== 'keyword'
                && p?.id === provider.id
                && p.revision === provider.revision
                && p.ready
                && p.kind === 'local';
        };
        const run = mutation.catch(() => {
        }).then(async () => {
            if (!valid())
                return;
            await configure(session);
            const status = await request({
                action: 'status', workspace: ws
            }) as {
                progress: {
                    stale: boolean;
                    fingerprint: string;
                };
            };
            if (!valid() || (!invalid && !status.progress.stale))
                return;
            // Same mutation lane as model changes; worker additionally verifies the captured space.
            await request({
                action: 'clear-index', workspace: ws, expectedFingerprint: status.progress.fingerprint
            }, 30000);
            configured.delete(ws);
            await scans.get(ws)?.catch(() => {
            });
            if (valid())
                await configure(session);
        });
        mutation = run;
        // Enqueue source work outside the settings lane; encoding stays in the existing bounded worker.
        void run.then(async () => {
            if (valid())
                await backfill(session);
        }).catch(() => {
        }).finally(() => {
            attempt.pending = false;
        });
        return true;
    }
    async function search(session: Session, options: Record<string, unknown> = {}) {
        if (options.scope && options.scope !== 'story')
            throw Error('剧情检索只允许玩家输入和有效正文');
        if (!eligible(session) || !deps.active(session))
            throw Error('当前世界线已失效');
        const rows = selectedRetrievalRows(session), cfg = settings(), mode = modeFor(session, cfg);
        const keyword = queryRetrievalRows(rows, session.id, options), started = Date.now();
        const p = cfg.providers.find(p => p.id === cfg.activeProviderId);
        if (mode === 'keyword' || !String(options.query ?? '').trim())
            return {
                ...keyword, mode: 'keyword', requestedMode: mode, elapsedMs: Date.now() - started
            };
        if (!p?.ready)
            return {
                ...keyword, mode: 'keyword', requestedMode: mode, fallback: '向量来源未就绪'
            };
        const fingerprint = hash(JSON.stringify(rows.map(r => [r.id, r.text])));
        try {
            await configure(session);
            const before = Number.isSafeInteger(options.beforeSeq) ? rows.findIndex(r => r.seq === options.beforeSeq) : rows.length;
            if (before < 0)
                throw Error('历史游标不属于当前选中分支');
            const hits = await request({
                action: 'query',
                workspace: workspace(session),
                legacyWorkspace: pathWorkspace(session),
                provider: secret(p, cfg),
                sessionId: session.id,
                query: p.kind === 'local' ? String(options.query) : String(options.query).slice(0, 4000),
                sources: vectorSources(session, rows.slice(0, before)),
                limit: 24
            }, 4000) as {
                id: string;
                score: number;
                offset: number;
            }[];
            if (!deps.active(session)
                || fingerprint !== hash(JSON.stringify(selectedRetrievalRows(session).map(r => [r.id, r.text])))
                || settings().activeProviderId !== p.id
                || settings().providers.find(x => x.id === p.id)?.revision !== p.revision
                || settings().chunkChars !== cfg.chunkChars)
                throw Error('查询期间来源已变化，请重新查询');
            if (!hits.length) {
                const status = await request({
                    action: 'status', workspace: workspace(session)
                }) as {
                    progress: {
                        vectors: number;
                        pending: number;
                        running: number;
                    };
                };
                if (p.kind === 'online' && rows.length && status.progress.vectors === 0 && !status.progress.pending
                    && !status.progress.running)
                    throw Object.assign(Error('当前对话尚未建立语义索引'), {
                        code: 'EMBEDDING_INDEX_EMPTY'
                    });
                return {
                    ...keyword, mode: 'keyword', requestedMode: mode, fallback: '当前正文尚无可用向量，正在等待后台索引', elapsedMs: Date.now() - started
                };
            }
            const ranked = new Map<string, {
                score: number;
                offset: number;
                semanticScore?: number;
            }>();
            hits.forEach((h, i) => {
                if (!ranked.has(h.id))
                    ranked.set(h.id, {
                        score: 1 / (60 + i + 1), offset: h.offset, semanticScore: h.score
                    });
            });
            const lexical = queryRetrievalRows(rows, session.id, {
                ...options, limit: 24, maxChars: 60000
            });
            if (mode === 'hybrid')
                lexical.entries.slice().reverse().forEach((r, i) => {
                    const old = ranked.get(r.id);
                    ranked.set(r.id, {
                        score: (old?.score ?? 0) + 1 / (60 + i + 1), offset: old?.offset ?? 0, semanticScore: old?.semanticScore
                    });
                });
            const cap = Math.max(1, Math.min(100, Number(options.limit) || 8)), best = [...ranked].sort((a, b) => b[1].score - a[1].score).slice(0, cap);
            if (mode === 'hybrid')
                for (const entry of lexical.entries.slice(-Math.min(2, cap))) {
                    if (best.some(([id]) => id === entry.id))
                        continue;
                    best.pop();
                    best.unshift([entry.id, ranked.get(entry.id)!]);
                }
            let budget = Math.max(256, Math.min(60000, Number(options.maxChars) || 12000));
            const entries = best.map(([id, hit], rank) => {
                const row = rows.find(r => r.id === id)!;
                return {
                    row, hit, rank: rank + 1
                };
            }).sort((a, b) => rows.indexOf(a.row) - rows.indexOf(b.row)).flatMap(({ row, hit, rank }) => {
                if (budget <= 0)
                    return [];
                const offset = Math.max(0, hit.offset - 120), text = row.text.slice(offset, offset + Math.min(2400, budget));
                budget -= text.length;
                return [
                    {
                        id: row.id,
                        seq: row.seq,
                        role: row.role,
                        turn: row.turn,
                        messageId: row.messageId,
                        time: row.time,
                        text,
                        textOffset: projectedSourceOffset(row, offset),
                        truncated: offset > 0 || text.length < row.text.length,
                        rank,
                        ...(Number.isFinite(hit.semanticScore) ? {
                            score: hit.semanticScore
                        } : {})
                    }
                ];
            });
            return {
                sessionId: session.id,
                mode,
                requestedMode: mode,
                totalEntries: rows.length,
                matchedEntries: ranked.size,
                entries,
                nextBeforeSeq: null,
                pagination: 'none',
                elapsedMs: Date.now() - started
            };
        }
        catch (error) {
            if (!deps.active(session)
                || fingerprint !== hash(JSON.stringify(selectedRetrievalRows(session).map(r => [r.id, r.text]))))
                throw Error('查询期间来源已变化，请重新查询');
            if (/来源已变化|世界线/.test(String((error as Error).message)))
                throw error;
            const repairable = ['EMBEDDING_INDEX_STALE', 'EMBEDDING_INDEX_INVALID', 'EMBEDDING_INDEX_EMPTY'].includes((error as {
                code?: string;
            }).code ?? '');
            const rebuilding = repairable && thisIsCurrent()
                && scheduleLocalRebuild(session, cfg, p, (error as {
                    code?: string;
                }).code === 'EMBEDDING_INDEX_INVALID');
            const confirmation = repairable && !rebuilding && thisIsCurrent() ? rebuildConfirmation(session, {
                kind: 'story',
                target: '当前对话的剧情历史索引',
                model: p.name + ' · ' + p.model,
                reason: String((error as Error).message),
                key: `${workspace(session)}:${cfg.revision}`,
                valid: () => thisIsCurrent() && fingerprint === hash(JSON.stringify(selectedRetrievalRows(session).map(r => [r.id, r.text]))),
                confirm: () => mutate(session, {
                    action: 'rebuild-index', expectedRevision: cfg.revision, confirmProviderId: p.id
                })
            }) : null;
            return {
                ...keyword,
                mode: 'keyword',
                requestedMode: mode,
                ...confirmation,
                fallback: rebuilding ? '本地模型配置已变化，已安排当前对话后台重建；本轮使用关键词检索' : confirmation ? `${String((error as Error).message)}；等待玩家在确认框中决定重建，当前只提供关键词结果，不代表语义查询成功` : String((error as Error).message),
                elapsedMs: Date.now() - started
            };
        }
        function thisIsCurrent() {
            return deps.active(session) && settings().revision === cfg.revision;
        }
    }
    function read(session: Session, options: Record<string, unknown> = {}) {
        if (!deps.active(session))
            throw Error('当前世界线已失效');
        if (options.scope && options.scope !== 'story')
            throw Error('只允许正文回读');
        return readRetrievalRows(selectedRetrievalRows(session), options);
    }
    /** A separate workspace namespace keeps novel research out of story sources, scans and clear/rebuild operations. */
    async function adaptation(
        session: Session,
        sourceId: string,
        action: 'index' | 'status' | 'query' | 'pause' | 'rebuild' | 'retry' | 'clear',
        sources: VectorSource[] = [],
        query = '',
        conversationId = session.id,
        expectedFingerprint?: string,
        original?: {
        assetId: string;
        enabled: boolean;
    }, expectedModelRevision?: number) {
        const run = async () => {
            await migration;
            if (!eligible(session) || !deps.active(session) || !/^[a-f0-9]{64}$/.test(sourceId))
                throw Error('改编资料会话无效');
            const cfg = settings(), provider = cfg.providers.find(p => p.id === cfg.adaptationProviderId);
            if (expectedModelRevision !== undefined && expectedModelRevision !== cfg.adaptationRevision)
                throw Error('小说模型配置已变化，拒绝按新模型意外建库');
            if (original && !/^[a-f0-9]{64}$/.test(original.assetId))
                throw Error('原著资料标识无效');
            const ws = hash(
                original
                    ? `card-adaptation-library-v1:${original.assetId}`
                    : `card-adaptation-v1:${pathWorkspace(session)}:${conversationId}:${sourceId}`,
            );
            workspaceKinds.set(ws, 'novel');
            if (action === 'pause' && !original?.enabled) {
                configured.delete(ws);
                if (worker)
                    await request({
                        action: 'configure', workspace: ws
                    });
                return {
                    paused: true
                };
            }
            if (action === 'clear') {
                configured.delete(ws);
                return request({
                    action: 'clear-index', workspace: ws
                }, 30000);
            }
            if (!provider?.ready)
                throw Error('Embedding 未就绪；可继续关键词查询和顺序阅读');
            const generation = hash(JSON.stringify([provider.id, provider.revision, provider.dimensions, cfg.chunkChars, original?.enabled]));
            const guard = original ? {
                sharedOriginal: true
            } : {
                guardOwner: session.id
            };
            if (action === 'rebuild') {
                if (!expectedFingerprint)
                    throw Error('缺少预期向量模型指纹，请刷新后重新确认');
                await request({
                    action: 'configure', workspace: ws, provider: secret(provider, cfg), enabled: false, generation, ...guard
                });
                await request({
                    action: 'clear-index', workspace: ws, expectedFingerprint, currentSpaceOnly: !!original
                }, 30000);
                configured.delete(ws);
            }
            if (action === 'index' || action === 'retry' || configured.get(ws) !== generation)
                await setConfiguration(ws, {
                    action: 'configure',
                    workspace: ws,
                    provider: secret(provider, cfg),
                    enabled: original?.enabled ?? (action === 'index' || action === 'retry'),
                    generation,
                    ...guard
                }, generation);
            if (settings().adaptationRevision !== cfg.adaptationRevision)
                throw Error('小说模型配置已变化，请重新确认');
            if (original && sources.length && (action === 'index' || action === 'status'))
                await request({
                    action: 'import-original',
                    workspace: ws,
                    legacyWorkspace: hash(`card-adaptation-v1:${pathWorkspace(session)}:${conversationId}:${sourceId}`),
                    provider: secret(provider, cfg),
                    sources,
                    sharedOriginal: true
                }, 30000);
            if (settings().adaptationRevision !== cfg.adaptationRevision)
                throw Error('小说模型配置已变化，请重新确认');
            const result = action === 'rebuild' ? {
                cleared: true, nextCursor: 0
            } : action === 'pause' ? {
                paused: false, sharedIndexRunning: true
            } : await request({
                action: action === 'index' ? 'sync' : action === 'status' ? 'status' : action === 'retry' ? 'retry' : 'query',
                workspace: ws,
                provider: secret(provider, cfg),
                sessionId: session.id,
                sources,
                query,
                limit: 12
            }, action === 'query' ? 4000 : 30000);
            if (!deps.active(session) || settings().adaptationRevision !== cfg.adaptationRevision
                || settings().adaptationProviderId !== provider.id
                || settings().providers.find(p => p.id === provider.id)?.revision !== provider.revision
                || settings().chunkChars !== cfg.chunkChars)
                throw Error('改编检索期间来源或模型设置已变化');
            return result;
        };
        // Rebuild and provider mutations share one queue: a model cannot change between configure and clear.
        if (action === 'rebuild') {
            const pending = mutation.catch(() => {
            }).then(run);
            mutation = pending;
            return pending;
        }
        return run();
    }
    function dispose() {
        disposed = true;
        clearTimeout(restoreTimer);
        for (const timer of delayed.values())
            clearTimeout(timer);
        worker?.disconnect();
    }
    // Resume only already-enabled workspaces. Listing/replay is read-only and never wakes story agents.
    const restoreTimer = setTimeout(() => {
        void restoreEnabled().catch(() => {
        });
    }, 1000);
    restoreTimer.unref();
    return {
        view,
        adaptationModels,
        adaptationCurrent,
        diagnose,
        mutate,
        search,
        read,
        changed,
        sync,
        backfill,
        dispose,
        adaptation,
        created,
        rebuildConfirmation,
        pendingRebuilds,
        resolveRebuild
    };
}
