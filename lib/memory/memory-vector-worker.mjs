// Generated from runtime/alpha3/src/memory/memory-vector-worker.mts; edit the TypeScript source.
// Standalone process: SQLite, HTTP and vector scans never block the story event loop.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LOCAL_MODELS, LOCAL_RUNTIME_VERSION, localTokenBudget } from './memory-local-catalog.js';
import { onlineEmbedding, onlineEmbeddingProfile, validateVectors } from './memory-embedding-api.js';
const home = resolve(process.argv[2]);
mkdirSync(home, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(home, 'vectors.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS metadata(version INTEGER NOT NULL);
INSERT INTO metadata SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM metadata);
CREATE TABLE IF NOT EXISTS vectors(space TEXT,key TEXT,data BLOB,PRIMARY KEY(space,key));
CREATE TABLE IF NOT EXISTS sources(workspace TEXT,session TEXT,id TEXT,rowid TEXT,seq INTEGER,key TEXT,offset INTEGER,PRIMARY KEY(workspace,session,id));
CREATE TABLE IF NOT EXISTS jobs(workspace TEXT,space TEXT,key TEXT,owner TEXT,text TEXT,status TEXT,error TEXT,PRIMARY KEY(workspace,space,key));
CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,data TEXT);
UPDATE jobs SET status='unknown',error='进程中断，结果未知；可手动重试' WHERE status='running';`);
if (db.prepare('SELECT version FROM metadata').get().version !== 1)
    throw Error('Unsupported vector schema');
// Additive, independently-versioned registry: older runtimes can still open the core v1 tables on rollback.
db.exec(`BEGIN; CREATE TABLE IF NOT EXISTS space_metadata(version INTEGER NOT NULL); INSERT INTO space_metadata SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM space_metadata); CREATE TABLE IF NOT EXISTS spaces(space TEXT PRIMARY KEY,workspace TEXT NOT NULL,family TEXT NOT NULL,recipe TEXT NOT NULL); COMMIT;`);
if (db.prepare('SELECT version FROM space_metadata').get().version !== 1)
    throw Error('Unsupported embedding fingerprint schema');
db.exec('CREATE TABLE IF NOT EXISTS conversation_scope(workspace TEXT PRIMARY KEY,version INTEGER NOT NULL,legacyBlocked INTEGER NOT NULL)');
if (db.prepare('SELECT 1 FROM conversation_scope WHERE version<>1 LIMIT 1').get())
    throw Error('Unsupported conversation index scope');
// Only offsets are persisted; authoritative text stays in the caller's selected source projection.
db.exec('CREATE TABLE IF NOT EXISTS local_chunk_plans(workspace TEXT,space TEXT,session TEXT,rowid TEXT,version INTEGER,sourceHash TEXT,ranges TEXT,error TEXT,PRIMARY KEY(workspace,space,session,rowid))');
if (db.prepare('SELECT 1 FROM local_chunk_plans WHERE version<>1 LIMIT 1').get())
    throw Error('Unsupported local chunk plan schema');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const spaces = new Map();
let sourceCheckSerial = 0;
const sourceChecks = new Map();
function sourceActive(owner) {
    const id = ++sourceCheckSerial;
    return new Promise(resolve => {
        const timer = setTimeout(() => { sourceChecks.delete(id); resolve(false); }, 2000);
        sourceChecks.set(id, allowed => { clearTimeout(timer); sourceChecks.delete(id); resolve(allowed); });
        process.send?.({ sourceCheck: { id, owner } });
    });
}
const queryCache = new Map();
const legacySpaceOf = (p, workspace) => hash(JSON.stringify([1, workspace, p.kind, p.protocol, p.baseUrl, p.model, p.dimensions, 'catalog-v1', 'story-v1', 'chunk480-overlap80']));
const familyOf = (p) => hash(JSON.stringify([p.kind, p.protocol, p.baseUrl, p.model]));
function chunking(p) {
    const requested = p?.chunkChars ?? 480;
    if (!Number.isSafeInteger(requested) || requested < 128 || requested > 2048)
        throw Error('索引块大小无效');
    const chars = requested, overlap = Math.floor(chars / 6);
    return { chars, overlap, stride: chars - overlap, requested };
}
const embeddingOf = (p) => {
    const m = p.kind === 'local' ? LOCAL_MODELS.find(m => m.id === p.model) : undefined;
    const chunks = chunking(p);
    const online = onlineEmbeddingProfile(p);
    return { schemaVersion: 1, embedding_model: m?.repo ?? p.model, embedding_revision: m?.revision ?? (p.embeddingRevision || 'provider-managed'), dimensions: p.dimensions, task: 'document',
        pooling: m ? (m.pooling === 'average' ? 'mean' : m.pooling.replaceAll('_', '-')) : 'provider-defined', documentPrefix: m?.documentPrefix ?? online?.documentPrefix ?? (m?.id === 'e5-small' ? 'passage: ' : ''),
        query: { task: 'query', prefix: m?.queryPrefix ?? online?.queryPrefix ?? '' }, dtype: m?.dtype ?? (m ? 'q8' : 'provider-defined'), runtime: m ? `${m.runtime ?? 'transformers'}:${LOCAL_RUNTIME_VERSION}` : 'online', modelFile: m?.onnxFile, cpuQuantization: m?.x64QuantPrecision ? 'u8u8-safe' : undefined,
        inputProfile: online?.version, normalization: online?.normalization,
        preprocessing: { version: 'story-v1', chunkChars: chunks.chars, overlapChars: chunks.overlap, maxTokens: m ? localTokenBudget(p.model, p.localMaxTokens) : null, ...(m ? { segmentation: 'tokenizer-scalar-v1', modelMaxTokens: m.maxInputTokens, addSpecialTokens: true, truncation: false } : {}) } };
};
function sourceRanges(p, workspace, source) {
    if (p.kind === 'online') {
        const chunks = chunking(p), result = [];
        for (let offset = 0; offset < source.text.length; offset += chunks.stride)
            result.push({ offset, end: Math.min(source.text.length, offset + chunks.chars) });
        return result;
    }
    const saved = db.prepare('SELECT sourceHash,ranges,error FROM local_chunk_plans WHERE workspace=? AND space=? AND session=? AND rowid=?').get(workspace, spaceOf(p, workspace), source.sessionId, source.id);
    if (!saved || saved.error || saved.sourceHash !== hash(source.text))
        return null;
    let ranges;
    const invalid = (message) => Object.assign(Error(message), { code: 'EMBEDDING_INDEX_INVALID' });
    try {
        ranges = JSON.parse(saved.ranges);
    }
    catch {
        throw invalid('本地来源区间计划格式损坏');
    }
    if (!Array.isArray(ranges))
        throw invalid('本地来源区间计划无效');
    let covered = 0;
    for (const range of ranges) {
        if (!range || !Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.end) || range.offset < 0 || range.offset > covered || range.end <= range.offset || range.end > source.text.length)
            throw invalid('本地来源区间计划无效');
        covered = Math.max(covered, range.end);
    }
    if (covered !== source.text.length)
        throw invalid('本地来源区间计划不完整');
    return ranges;
}
const recipeOf = (p) => JSON.stringify(embeddingOf(p));
const spaceOf = (p, workspace) => hash(JSON.stringify([2, workspace, p.kind, p.protocol, p.baseUrl, recipeOf(p)]));
function registerSpace(p, workspace) {
    const family = familyOf(p), legacy = legacySpaceOf(p, workspace), space = spaceOf(p, workspace);
    if (db.prepare('SELECT 1 FROM vectors WHERE space=? LIMIT 1').get(legacy) || db.prepare('SELECT 1 FROM jobs WHERE workspace=? AND space=? LIMIT 1').get(workspace, legacy))
        db.prepare('INSERT OR IGNORE INTO spaces VALUES(?,?,?,?)').run(legacy, workspace, family, 'legacy-catalog-v1');
    db.prepare('INSERT OR IGNORE INTO spaces VALUES(?,?,?,?)').run(space, workspace, family, recipeOf(p));
    return space;
}
const indexEpochs = new Map();
function staleIndex(p, workspace) {
    const fingerprint = spaceOf(p, workspace);
    if (db.prepare('SELECT 1 FROM vectors WHERE space=? LIMIT 1').get(fingerprint))
        return false;
    return !!db.prepare('SELECT 1 FROM vectors WHERE space IN (SELECT space FROM spaces WHERE workspace=? UNION SELECT space FROM jobs WHERE workspace=?) LIMIT 1').get(workspace, workspace);
}
function indexIdentity(p, workspace) {
    const fingerprint = spaceOf(p, workspace), vectors = db.prepare('SELECT COUNT(*) AS n FROM vectors WHERE space=?').get(fingerprint).n;
    const known = db.prepare('SELECT space FROM spaces WHERE workspace=? UNION SELECT DISTINCT space FROM jobs WHERE workspace=?').all(workspace, workspace);
    let staleVectors = 0;
    for (const { space } of known)
        if (space !== fingerprint)
            staleVectors += db.prepare('SELECT COUNT(*) AS n FROM vectors WHERE space=?').get(space).n;
    return { fingerprint, embedding: embeddingOf(p), stale: vectors === 0 && staleVectors > 0, staleVectors };
}
/** Reuse only content authorized by the current conversation; preserve legacy shared caches for other conversations. */
function importLegacy(message) {
    const workspace = message.workspace, legacy = message.legacyWorkspace, p = message.provider ?? spaces.get(workspace)?.provider;
    if (!legacy || legacy === workspace || !p || !message.sources?.length || db.prepare('SELECT 1 FROM conversation_scope WHERE workspace=? AND legacyBlocked=1').get(workspace))
        return;
    registerSpace(p, legacy);
    const old = db.prepare('SELECT space,family,recipe FROM spaces WHERE workspace=?').all(legacy);
    const current = spaceOf(p, workspace), family = familyOf(p), find = db.prepare('SELECT data FROM vectors WHERE space=? AND key=?'), insert = db.prepare('INSERT OR IGNORE INTO vectors VALUES(?,?,?)');
    db.exec('BEGIN');
    try {
        for (const source of message.sources)
            for (let offset = 0; offset < source.text.length; offset += 400) {
                const key = hash(`${source.role}\n${source.text.slice(offset, offset + 480)}`);
                if (find.get(current, key))
                    continue;
                for (const row of old) {
                    const stored = find.get(row.space, key);
                    if (!stored)
                        continue;
                    const target = row.family === family && row.recipe !== 'legacy-catalog-v1' ? hash(JSON.stringify([2, workspace, p.kind, p.protocol, p.baseUrl, row.recipe])) : hash(`legacy-scope:${workspace}:${row.space}`);
                    db.prepare('INSERT OR IGNORE INTO spaces VALUES(?,?,?,?)').run(target, workspace, row.family, row.recipe);
                    insert.run(target, key, stored.data);
                }
            }
        db.prepare('INSERT OR IGNORE INTO conversation_scope VALUES(?,1,0)').run(workspace);
        db.exec('COMMIT');
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
/** Exact-recipe migration of authorized immutable source text. Never reuse a
 * legacy geometry by guessing offsets, nor copy running/failed jobs. */
function importOriginal(message) {
    const workspace = message.workspace, legacy = message.legacyWorkspace, p = message.provider;
    if (!message.sharedOriginal || !p || !legacy || legacy === workspace || db.prepare('SELECT 1 FROM conversation_scope WHERE workspace=? AND legacyBlocked=1').get(workspace))
        return;
    const old = spaceOf(p, legacy), target = registerSpace(p, workspace);
    const metadata = db.prepare('SELECT recipe FROM spaces WHERE space=? AND workspace=?').get(old, legacy);
    if (metadata?.recipe !== recipeOf(p))
        return;
    db.exec('BEGIN');
    try {
        for (const source of message.sources ?? []) {
            if (source.role !== 'adaptation-source' || source.hash !== hash(source.text))
                throw Error('原著迁移来源校验失败');
            let ranges = null;
            if (p.kind === 'local') {
                const plan = db.prepare('SELECT ranges FROM local_chunk_plans WHERE workspace=? AND space=? AND rowid=? AND sourceHash=? AND error IS NULL').get(legacy, old, source.id, hash(source.text));
                if (plan) {
                    // sourceRanges performs the same persisted-range validation as query.
                    db.prepare('INSERT OR IGNORE INTO local_chunk_plans VALUES(?,?,?,?,1,?,?,NULL)').run(workspace, target, source.sessionId, source.id, hash(source.text), plan.ranges);
                    ranges = sourceRanges(p, workspace, source);
                }
            }
            else
                ranges = sourceRanges(p, workspace, source);
            for (const { offset, end } of ranges ?? []) {
                const key = hash(`${source.role}\n${source.text.slice(offset, end)}`), saved = db.prepare('SELECT data FROM vectors WHERE space=? AND key=?').get(old, key);
                if (saved)
                    db.prepare('INSERT OR IGNORE INTO vectors VALUES(?,?,?)').run(target, key, saved.data);
            }
        }
        db.exec('COMMIT');
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
let local = null, localModel = '', localSeq = 0;
let localOperations = Promise.resolve(null), localExitReason = '';
function withLocalModel(work) {
    const run = localOperations.catch(() => { }).then(work);
    localOperations = run;
    return run;
}
function releaseUnusedLocal() {
    if (!local)
        return;
    void withLocalModel(async () => { if (![...spaces.values()].some(config => config.provider.kind === 'local'))
        await unloadLocal(); }).catch(() => { });
}
async function unloadLocal() {
    const child = local;
    if (!child)
        return;
    try {
        await localRequest('unload');
    }
    finally {
        // ONNX/V8 may retain RSS after dispose; a fresh encoder makes the next ceiling reliable.
        if (local === child)
            await new Promise(resolve => {
                const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
                child.once('exit', () => { clearTimeout(timer); resolve(); });
                if (child.connected)
                    child.disconnect();
                else
                    child.kill();
            });
    }
}
const localPending = new Map();
let catalog = [];
const monitor = setInterval(() => {
    if (!local?.pid || !localModel)
        return;
    const item = LOCAL_MODELS.find(m => m.id === localModel);
    if (!item)
        return;
    if (process.platform === 'linux')
        try {
            const status = readFileSync(`/proc/${local.pid}/status`, 'utf8'), rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
            const ceiling = (item.id === 'bge-small-zh' ? 768 : Math.ceil(item.estimatedMiB * 1.5)) * 1024 ** 2;
            if (rss > ceiling) {
                localExitReason = `本地模型超过内存保护上限（${Math.round(ceiling / 1024 ** 2)} MiB）`;
                local.kill('SIGKILL');
            }
        }
        catch { }
}, 250);
monitor.unref();
const localStateFile = join(home, 'local-state.json');
function localRequest(action, params = {}, timeout = 60000) {
    if (!local) {
        localExitReason = '';
        local = fork(fileURLToPath(new URL('./memory-local-worker.mjs', import.meta.url)), [home, 'encoder'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=512'], env: { ...process.env, OMP_NUM_THREADS: '2', TOKENIZERS_PARALLELISM: 'false' } });
        local.on('message', (raw) => {
            const msg = raw;
            if (msg.catalog)
                catalog = msg.catalog;
            if (!msg.id)
                return;
            const p = localPending.get(msg.id);
            if (!p)
                return;
            clearTimeout(p.timer);
            localPending.delete(msg.id);
            msg.error ? p.reject(Error(msg.error)) : p.resolve(msg.result);
        });
        local.on('exit', () => { local = null; localModel = ''; for (const p of localPending.values()) {
            clearTimeout(p.timer);
            p.reject(Error(localExitReason || '本地模型进程已退出'));
        } localPending.clear(); });
    }
    const id = ++localSeq;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { localPending.delete(id); reject(Error('本地模型操作超时')); }, timeout);
        localPending.set(id, { resolve, reject, timer });
        local.send({ id, action, ...params });
    });
}
// Downloads have their own small process so replacing an encoder cannot pause a transfer.
let downloader = null, downloadSeq = 0;
const downloadPending = new Map();
function catalogRequest(action, modelId) {
    if (!downloader) {
        downloader = fork(fileURLToPath(new URL('./memory-local-worker.mjs', import.meta.url)), [home], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=128'] });
        downloader.on('message', (raw) => {
            const msg = raw;
            if (msg.catalog)
                catalog = msg.catalog;
            const pending = msg.id ? downloadPending.get(msg.id) : undefined;
            if (!pending)
                return;
            clearTimeout(pending.timer);
            downloadPending.delete(msg.id);
            msg.error ? pending.reject(Error(msg.error)) : pending.resolve(msg.result);
        });
        downloader.on('exit', () => { downloader = null; for (const pending of downloadPending.values()) {
            clearTimeout(pending.timer);
            pending.reject(Error('模型下载进程已退出，可恢复下载'));
        } downloadPending.clear(); });
    }
    const id = ++downloadSeq;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { downloadPending.delete(id); reject(Error('模型管理操作超时')); }, 60000);
        downloadPending.set(id, { resolve, reject, timer });
        downloader.send({ id, action, modelId });
    });
}
const record = (call) => {
    db.prepare('INSERT OR REPLACE INTO calls VALUES(?,?)').run(call.id, JSON.stringify(call));
    process.send?.({ call });
};
async function encode(p, texts, purpose, workspace, session, timeout) {
    if (p.kind === 'online')
        return onlineEmbedding(p, texts, purpose, workspace, session, record, timeout);
    return withLocalModel(async () => {
        // Keep the old model's RSS ceiling until its inference and disposal finish.
        // Test/query/index requests share this lane, so another request cannot lower it mid-call.
        if (localModel !== p.model)
            await unloadLocal();
        localModel = p.model;
        return validateVectors(await localRequest('encode', { modelId: p.model, texts, purpose, localMaxTokens: localTokenBudget(p.model, p.localMaxTokens) }, timeout), texts.length, p.dimensions);
    });
}
let pumping = false;
async function pump() {
    if (pumping)
        return;
    pumping = true;
    try {
        for (const [workspace, config] of spaces) {
            if (!config.enabled || (!config.sharedOriginal && staleIndex(config.provider, workspace)))
                continue;
            const space = spaceOf(config.provider, workspace);
            const epoch = indexEpochs.get(workspace) ?? 0;
            const largeLocal = config.provider.kind === 'local' && ((LOCAL_MODELS.find(m => m.id === config.provider.model)?.estimatedMiB ?? 0) >= 800 || localTokenBudget(config.provider.model, config.provider.localMaxTokens) > 512);
            const rows = db.prepare("SELECT key,text,owner FROM jobs WHERE workspace=? AND space=? AND status='queued' LIMIT ?").all(workspace, space, largeLocal ? 1 : 4);
            if (!rows.length)
                continue;
            const batch = rows.filter(r => r.owner === rows[0].owner);
            if (config.guardOwner && !(await sourceActive(config.guardOwner))) {
                config.enabled = false;
                continue;
            }
            if (spaces.get(workspace) !== config || !config.enabled)
                continue;
            if (statSync(join(home, 'vectors.sqlite')).size > 2 * 1024 ** 3) {
                config.enabled = false;
                continue;
            }
            for (const row of batch)
                db.prepare("UPDATE jobs SET status='running' WHERE workspace=? AND space=? AND key=?").run(workspace, space, row.key);
            try {
                const vectors = await encode(config.provider, batch.map(r => r.text), 'index', workspace, batch[0].owner, largeLocal ? 60000 : 30000);
                if (config.guardOwner && !(await sourceActive(config.guardOwner)))
                    config.enabled = false;
                if ((indexEpochs.get(workspace) ?? 0) !== epoch)
                    continue;
                // Branch selection does not cancel encoding; provider/index generation does.
                if (spaces.get(workspace)?.generation !== config.generation || !spaces.get(workspace)?.enabled) {
                    for (const row of batch)
                        db.prepare("UPDATE jobs SET status='queued' WHERE workspace=? AND space=? AND key=?").run(workspace, space, row.key);
                    continue;
                }
                db.exec('BEGIN');
                try {
                    batch.forEach((row, i) => {
                        const vector = Float32Array.from(vectors[i]);
                        db.prepare('INSERT OR IGNORE INTO vectors VALUES(?,?,?)').run(space, row.key, Buffer.from(vector.buffer));
                        db.prepare("UPDATE jobs SET status='done',error=NULL,text='' WHERE workspace=? AND space=? AND key=?").run(workspace, space, row.key);
                    });
                    db.exec('COMMIT');
                }
                catch (error) {
                    db.exec('ROLLBACK');
                    throw error;
                }
            }
            catch (error) {
                if ((indexEpochs.get(workspace) ?? 0) !== epoch)
                    continue;
                const message = String(error.message).slice(0, 160);
                for (const row of batch)
                    db.prepare("UPDATE jobs SET status=?,error=? WHERE workspace=? AND space=? AND key=?").run(/超时|fetch|aborted|timeout/i.test(message) ? 'unknown' : 'failed', message, workspace, space, row.key);
            }
        }
    }
    finally {
        pumping = false;
    }
}
const timer = setInterval(() => { void pump(); }, 250);
timer.unref();
async function sync(workspace, sources, billingSession) {
    const config = spaces.get(workspace);
    if (!config)
        return;
    const chunks = chunking(config.provider);
    if (!config.sharedOriginal && staleIndex(config.provider, workspace))
        return;
    const space = spaceOf(config.provider, workspace);
    const epoch = indexEpochs.get(workspace) ?? 0, plans = new Map();
    for (const source of sources) {
        let ranges = sourceRanges(config.provider, workspace, source);
        if (!ranges)
            try {
                ranges = await withLocalModel(async () => {
                    if (localModel !== config.provider.model)
                        await unloadLocal();
                    localModel = config.provider.model;
                    const result = await localRequest('split', { modelId: config.provider.model, texts: [source.text], chunkChars: chunks.chars, localMaxTokens: localTokenBudget(config.provider.model, config.provider.localMaxTokens) });
                    return result[0];
                });
            }
            catch (error) {
                if (spaces.get(workspace) === config && (indexEpochs.get(workspace) ?? 0) === epoch)
                    db.prepare('INSERT OR REPLACE INTO local_chunk_plans VALUES(?,?,?,?,1,?,NULL,?)').run(workspace, space, source.sessionId, source.id, hash(source.text), String(error.message).slice(0, 160));
                throw error;
            }
        if (spaces.get(workspace) !== config || (indexEpochs.get(workspace) ?? 0) !== epoch)
            throw Error('索引配置已变化，丢弃过期分段');
        plans.set(source, ranges);
    }
    db.exec('BEGIN');
    try {
        for (const source of sources) {
            // Replace references for this exact durable row, never mutate raw history or other worlds.
            db.prepare('DELETE FROM sources WHERE workspace=? AND session=? AND rowid=?').run(workspace, source.sessionId, source.id);
            if (config.provider.kind === 'local')
                db.prepare('INSERT OR REPLACE INTO local_chunk_plans VALUES(?,?,?,?,1,?,?,NULL)').run(workspace, space, source.sessionId, source.id, hash(source.text), JSON.stringify(plans.get(source)));
            for (const { offset, end } of plans.get(source)) {
                const text = source.text.slice(offset, end);
                if (!text.trim())
                    continue;
                const key = hash(`${source.role}\n${text}`), id = hash(`${source.id}:${source.hash}:${offset}`);
                db.prepare('INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?,?,?)').run(workspace, source.sessionId, id, source.id, source.seq, key, offset);
                if (!db.prepare('SELECT 1 FROM vectors WHERE space=? AND key=?').get(space, key))
                    db.prepare("INSERT OR IGNORE INTO jobs VALUES(?,?,?,?,?,'queued',NULL)").run(workspace, space, key, billingSession ?? source.sessionId, text);
            }
        }
        db.exec('COMMIT');
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
function progress(workspace, sources = []) {
    const config = spaces.get(workspace), space = config ? spaceOf(config.provider, workspace) : '';
    const counts = {};
    for (const row of db.prepare('SELECT status,COUNT(*) AS count FROM jobs WHERE workspace=? AND space=? GROUP BY status').all(workspace, space))
        counts[row.status] = row.count;
    const planFailures = db.prepare('SELECT error FROM local_chunk_plans WHERE workspace=? AND space=? AND error IS NOT NULL').all(workspace, space);
    counts.failed = (counts.failed ?? 0) + planFailures.length;
    let covered = 0;
    for (const source of sources) {
        const ranges = config ? sourceRanges(config.provider, workspace, source) : null;
        let complete = !!source.text.trim() && ranges !== null;
        for (const { offset, end } of ranges ?? []) {
            const text = source.text.slice(offset, end);
            if (text.trim() && !db.prepare('SELECT 1 FROM vectors WHERE space=? AND key=?').get(space, hash(`${source.role}\n${text}`)))
                complete = false;
        }
        if (complete)
            covered++;
    }
    return { ...(config ? indexIdentity(config.provider, workspace) : {}), enabled: config?.enabled === true, vectors: db.prepare('SELECT COUNT(*) AS n FROM vectors WHERE space=?').get(space).n, sources: sources.length, covered, pending: counts.queued ?? 0, running: counts.running ?? 0, failed: counts.failed ?? 0, unknown: counts.unknown ?? 0, bytes: statSync(join(home, 'vectors.sqlite')).size, lastError: planFailures[0]?.error ?? db.prepare('SELECT error FROM jobs WHERE workspace=? AND space=? AND error IS NOT NULL LIMIT 1').get(workspace, space)?.error ?? null };
}
async function dispatch(message) {
    const workspace = message.workspace ?? '';
    if (['sync', 'status', 'query'].includes(message.action))
        importLegacy(message);
    if (message.action === 'reset') {
        if (message.workspace)
            spaces.delete(message.workspace);
        else
            spaces.clear();
        releaseUnusedLocal();
        return true;
    }
    if (message.action === 'configure') {
        if (message.provider) {
            registerSpace(message.provider, workspace);
            spaces.set(workspace, { provider: message.provider, generation: message.generation, enabled: !!message.enabled, guardOwner: message.guardOwner, sharedOriginal: message.sharedOriginal });
        }
        else
            spaces.delete(workspace);
        // Online novel research may run alongside local story retrieval. Configuring
        // one consumer must not repeatedly evict the other's single local encoder.
        if (message.provider?.kind !== 'local')
            releaseUnusedLocal();
        return true;
    }
    if (message.action === 'clear-index') {
        const current = spaces.get(workspace);
        if (message.expectedFingerprint && (!current || spaceOf(current.provider, workspace) !== message.expectedFingerprint))
            throw Error('向量模型指纹已变化，拒绝过期重建请求');
        // v1 jobs already own their workspace, even when the old provider was deleted.
        if (message.currentSpaceOnly && (!current || !message.expectedFingerprint))
            throw Error('缺少当前索引空间确认');
        indexEpochs.set(workspace, (indexEpochs.get(workspace) ?? 0) + 1);
        spaces.delete(workspace);
        const targets = message.currentSpaceOnly ? [{ space: message.expectedFingerprint }] : db.prepare('SELECT space FROM spaces WHERE workspace=? UNION SELECT DISTINCT space FROM jobs WHERE workspace=?').all(workspace, workspace);
        db.exec('BEGIN');
        try {
            db.prepare('INSERT OR REPLACE INTO conversation_scope VALUES(?,1,1)').run(workspace);
            if (!message.currentSpaceOnly)
                db.prepare('DELETE FROM local_chunk_plans WHERE workspace=?').run(workspace);
            for (const { space } of targets) {
                db.prepare('DELETE FROM local_chunk_plans WHERE workspace=? AND space=?').run(workspace, space);
                db.prepare('DELETE FROM vectors WHERE space=?').run(space);
                db.prepare('DELETE FROM jobs WHERE workspace=? AND space=?').run(workspace, space);
                db.prepare('DELETE FROM spaces WHERE space=?').run(space);
                for (const key of queryCache.keys())
                    if (key.startsWith(space + ':'))
                        queryCache.delete(key);
            }
            db.exec('COMMIT');
        }
        catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
        return { clearedSpaces: targets.length };
    }
    if (message.action === 'import-original') {
        importOriginal(message);
        return true;
    }
    if (message.action === 'sync') {
        await sync(workspace, message.sources ?? [], message.sessionId);
        return progress(workspace, message.sources);
    }
    if (message.action === 'status') {
        if (existsSync(localStateFile)) {
            try {
                catalog = JSON.parse(readFileSync(localStateFile, 'utf8'));
            }
            catch { }
        }
        return { progress: progress(workspace, message.sources), catalog, rss: process.memoryUsage().rss };
    }
    if (message.action === 'calls')
        return db.prepare('SELECT data FROM calls').all().map(row => JSON.parse(String(row.data)));
    if (message.action === 'retry') {
        const config = spaces.get(workspace);
        if (!config)
            throw Error('没有启用的向量来源');
        db.prepare("UPDATE jobs SET status='queued',error=NULL WHERE workspace=? AND space=? AND status IN ('failed','unknown')").run(workspace, spaceOf(config.provider, workspace));
        if (message.sources?.length)
            await sync(workspace, message.sources);
        return true;
    }
    if (message.action === 'test')
        return { dimensions: (await encode(message.provider, ['她把旧姓藏在信封后。', 'She hid her former surname behind the envelope.'], 'test', workspace, null, 30000))[0].length };
    if (['download-model', 'pause-download', 'delete-model', 'catalog'].includes(message.action)) {
        if (message.action === 'delete-model')
            await withLocalModel(async () => { if (localModel === message.modelId)
                await unloadLocal(); });
        return catalogRequest(message.action, message.modelId);
    }
    if (message.action === 'query') {
        const p = message.provider, space = spaceOf(p, workspace), sources = message.sources ?? [];
        if (staleIndex(p, workspace))
            throw Object.assign(Error('Embedding 配置已变化，索引已过期（stale），请重建向量数据库'), { code: 'EMBEDDING_INDEX_STALE' });
        registerSpace(p, workspace);
        const epoch = indexEpochs.get(workspace) ?? 0;
        const cacheKey = space + ':' + hash(`${p.revision}:${message.query}`);
        let query = queryCache.get(cacheKey);
        if (!query) {
            query = (await encode(p, [message.query], 'query', workspace, message.sessionId, 3000))[0];
            if ((indexEpochs.get(workspace) ?? 0) !== epoch)
                throw Error('向量索引已清空或重建，请重新查询');
            queryCache.set(cacheKey, query);
            if (queryCache.size > 128)
                queryCache.delete(queryCache.keys().next().value);
        }
        else {
            queryCache.delete(cacheKey);
            queryCache.set(cacheKey, query);
        }
        const hits = [];
        const seen = new Map();
        // Authorize candidates BEFORE top-k. Unselected sibling entries never participate.
        for (const source of sources)
            for (const { offset, end } of sourceRanges(p, workspace, source) ?? []) {
                const row = { key: hash(`${source.role}\n${source.text.slice(offset, end)}`), offset };
                let score = seen.get(row.key);
                if (score === undefined) {
                    const stored = db.prepare('SELECT data FROM vectors WHERE space=? AND key=?').get(space, row.key);
                    if (!stored)
                        continue;
                    const invalid = () => Object.assign(Error('已保存向量的数据格式或维度无效，请重建索引'), { code: 'EMBEDDING_INDEX_INVALID' });
                    if (stored.data.byteLength !== query.length * 4)
                        throw invalid();
                    let data;
                    try {
                        data = new Float32Array(stored.data.buffer, stored.data.byteOffset, stored.data.byteLength / 4);
                    }
                    catch {
                        throw invalid();
                    }
                    if (data.some(value => !Number.isFinite(value)))
                        throw invalid();
                    score = 0;
                    for (let i = 0; i < data.length; i++)
                        score += data[i] * query[i];
                    seen.set(row.key, score);
                }
                hits.push({ id: source.id, offset: row.offset, score });
            }
        return hits.sort((a, b) => b.score - a.score).slice(0, message.limit ?? 24);
    }
    throw Error('未知向量操作');
}
process.on('message', (raw) => {
    const guard = raw;
    if (guard.sourceCheckId) {
        sourceChecks.get(guard.sourceCheckId)?.(guard.allowed === true);
        return;
    }
    const { id, ...message } = raw;
    void dispatch(message).then(result => process.send?.({ id, result }), error => process.send?.({ id, error: String(error.message).slice(0, 200), code: ['EMBEDDING_INDEX_STALE', 'EMBEDDING_INDEX_INVALID'].includes(error.code) ? error.code : undefined }));
});
process.on('disconnect', () => { local?.kill(); downloader?.kill(); db.close(); process.exit(0); });
for (const row of db.prepare('SELECT data FROM calls').all())
    process.send?.({ call: JSON.parse(String(row.data)) });
