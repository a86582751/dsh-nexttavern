// Generated from runtime/alpha3/src/memory/memory-local-worker.mts; edit the TypeScript source.
// Optional CPU backend, loaded only after a player explicitly installs a model.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync, rmSync, statfsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { freemem } from 'node:os';
import { spawn } from 'node:child_process';
import { LOCAL_MODELS, LOCAL_RUNTIME_VERSION, localTokenBudget, localInputPrefix, localTextRanges } from './memory-local-catalog.js';
const templates = dirname(fileURLToPath(new URL('../../memory/embedding-runtime/package.json', import.meta.url)));
const runtimeLock = createHash('sha256').update(readFileSync(join(templates, 'package-lock.json'), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const home = resolve(process.argv[2]), models = join(home, 'models'), runtime = join(home, 'runtimes', runtimeLock.slice(0, 16)), stateFile = join(home, 'local-state.json');
const encoderOnly = process.argv[3] === 'encoder';
mkdirSync(models, { recursive: true, mode: 0o700 });
mkdirSync(runtime, { recursive: true, mode: 0o700 });
const artifactFingerprint = (m) => createHash('sha256').update(JSON.stringify([m.repo, m.revision, m.files])).digest('hex');
let states = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : [];
function runtimeReady() { try {
    const marker = JSON.parse(readFileSync(join(runtime, 'installed.json'), 'utf8'));
    return marker.schemaVersion === 2 && marker.lockHash === runtimeLock && marker.version === LOCAL_RUNTIME_VERSION && ['@huggingface/transformers', 'onnxruntime-node'].every(p => existsSync(join(runtime, 'node_modules', p, 'package.json')));
}
catch {
    return false;
} }
const runtimeUpdate = '本地运行环境需要更新，请点击下载／安装；已校验的模型文件会复用';
states = LOCAL_MODELS.map(m => { const saved = states.find(s => s.id === m.id), changed = !!saved?.artifactFingerprint && saved.artifactFingerprint !== artifactFingerprint(m), update = saved?.status === 'installed' && !runtimeReady(); return { schemaVersion: 2, artifactFingerprint: saved?.artifactFingerprint, id: m.id, status: saved?.status === 'installed' && !changed && !update ? 'installed' : saved && saved.status !== 'not-installed' ? 'paused' : 'not-installed', downloadedBytes: changed ? 0 : Math.min(saved?.downloadedBytes ?? 0, m.files.reduce((n, f) => n + f.bytes, 0)), totalBytes: m.files.reduce((n, f) => n + f.bytes, 0), error: changed ? '模型版本已变化，请下载／校验新版本' : update ? runtimeUpdate : undefined }; });
let download = null;
let extractor = null, loaded = '', tokenizer = null, tokenizerLoaded = '', embedding = Promise.resolve(null);
function publish() { if (encoderOnly)
    return; const temporary = `${stateFile}.tmp`; writeFileSync(temporary, JSON.stringify(states), { mode: 0o600 }); renameSync(temporary, stateFile); process.send?.({ catalog: states }); }
publish();
function model(id) { const item = LOCAL_MODELS.find(m => m.id === id); if (!item)
    throw Error('本地模型不在受信目录'); return item; }
function state(id) {
    if (encoderOnly && existsSync(stateFile)) {
        const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
        return saved.find(s => s.id === id) ?? states.find(s => s.id === id);
    }
    return states.find(s => s.id === id);
}
async function fileHash(path) { const hash = createHash('sha256'); for await (const bytes of createReadStream(path))
    hash.update(bytes); return hash.digest('hex'); }
async function dependencies(signal) {
    if (runtimeReady())
        return;
    for (const name of ['package.json', 'package-lock.json'])
        writeFileSync(join(runtime, name), readFileSync(join(templates, name)));
    await new Promise((resolve, reject) => {
        // npm executable is fixed, never constructed from model IDs or arbitrary commands.
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const child = spawn(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: runtime, stdio: 'ignore', shell: process.platform === 'win32', signal, windowsHide: true, env: { ...process.env, ONNXRUNTIME_NODE_INSTALL: 'skip' } });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve() : reject(Error('本地推理依赖安装失败')));
    });
    writeFileSync(join(runtime, 'installed.json'), JSON.stringify({ schemaVersion: 2, lockHash: runtimeLock, version: LOCAL_RUNTIME_VERSION }), { mode: 0o600 });
}
async function install(item, controller) {
    const s = state(item.id);
    s.status = 'downloading';
    s.error = undefined;
    publish();
    try {
        const fs = statfsSync(models);
        if (fs.bavail * fs.bsize < s.totalBytes * 1.2)
            throw Error('磁盘空间不足');
        let completed = 0;
        for (const file of item.files) {
            controller.signal.throwIfAborted();
            const target = join(models, item.id, file.name), partial = `${target}.part`;
            mkdirSync(dirname(target), { recursive: true });
            if (existsSync(target) && statSync(target).size === file.bytes && await fileHash(target) === file.sha256) {
                completed += file.bytes;
                continue;
            }
            let offset = existsSync(partial) ? statSync(partial).size : 0;
            if (offset >= file.bytes) {
                if (offset === file.bytes && await fileHash(partial) === file.sha256) {
                    renameSync(partial, target);
                    completed += file.bytes;
                    continue;
                }
                rmSync(partial);
                offset = 0;
            }
            const response = await fetch(`https://huggingface.co/${item.repo}/resolve/${item.revision}/${file.name}`, { headers: offset ? { Range: `bytes=${offset}-` } : {}, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]) });
            if (!response.ok)
                throw Error(`下载失败 HTTP ${response.status}`);
            if (offset && response.status === 206 && !response.headers.get('content-range')?.startsWith(`bytes ${offset}-`))
                throw Error('下载续传范围无效');
            if (offset && response.status !== 206)
                offset = 0;
            const stream = createWriteStream(partial, { flags: offset ? 'a' : 'w', mode: 0o600 }), reader = response.body.getReader();
            let written = offset, last = 0;
            try {
                for (;;) {
                    const part = await reader.read();
                    if (part.done)
                        break;
                    written += part.value.length;
                    if (written > file.bytes)
                        throw Error('模型文件超过登记大小');
                    if (!stream.write(part.value))
                        await new Promise((resolve, reject) => { const drained = () => { stream.off('error', failed); resolve(); }, failed = (e) => { stream.off('drain', drained); reject(e); }; stream.once('drain', drained); stream.once('error', failed); });
                    if (Date.now() - last > 400) {
                        s.downloadedBytes = completed + written;
                        publish();
                        last = Date.now();
                    }
                }
                await new Promise((resolve, reject) => { stream.end(resolve); stream.once('error', reject); });
            }
            finally {
                stream.destroy();
                await reader.cancel().catch(() => { });
            }
            if (written !== file.bytes || await fileHash(partial) !== file.sha256)
                throw Error('模型文件摘要校验失败');
            renameSync(partial, target);
            completed += written;
            s.downloadedBytes = completed;
            publish();
        }
        s.status = 'installing';
        publish();
        await dependencies(controller.signal);
        s.status = 'installed';
        s.artifactFingerprint = artifactFingerprint(item);
        s.schemaVersion = 2;
        s.downloadedBytes = s.totalBytes;
        publish();
    }
    catch (error) {
        s.status = controller.signal.aborted ? 'paused' : 'failed';
        s.error = controller.signal.aborted ? undefined : String(error.message).slice(0, 160);
        publish();
    }
    finally {
        download = null;
    }
}
async function unload() { if (extractor)
    await extractor.dispose(); extractor = null; loaded = ''; tokenizer = null; tokenizerLoaded = ''; }
async function loadTokenizer(item) {
    if (!runtimeReady())
        throw Error(runtimeUpdate);
    if (state(item.id).status !== 'installed')
        throw Error('请先手动下载并安装模型');
    if (tokenizerLoaded === item.id && tokenizer)
        return tokenizer;
    if (state(item.id).artifactFingerprint !== artifactFingerprint(item))
        for (const file of item.files) {
            const target = join(models, item.id, file.name);
            if (!existsSync(target) || statSync(target).size !== file.bytes || await fileHash(target) !== file.sha256)
                throw Error('模型文件版本不匹配，请重新下载／校验');
        }
    const imported = await import(pathToFileURL(join(runtime, 'node_modules/@huggingface/transformers/src/transformers.js')).href);
    imported.env.allowRemoteModels = false;
    imported.env.allowLocalModels = true;
    imported.env.backends.onnx.wasm.numThreads = 2;
    tokenizer = await imported.AutoTokenizer.from_pretrained(join(models, item.id));
    tokenizerLoaded = item.id;
    if (typeof tokenizer !== 'function')
        throw Error('本地 tokenizer 不可用，拒绝静默截断');
    return tokenizer;
}
async function tokenCount(item, text) {
    const tokenize = await loadTokenizer(item), tokens = await tokenize([text], { padding: false, truncation: false, add_special_tokens: true });
    const ids = tokens.input_ids;
    if (!ids || ids.dims.length !== 2 || ids.dims[0] !== 1 || !Number.isSafeInteger(ids.dims[1]) || ids.dims[1] < 1 || ids.data.length !== ids.dims[1])
        throw Error('本地 tokenizer 计数无效，拒绝静默截断');
    return ids.dims[1];
}
// Older x64 CPUs can saturate U8S8 matmuls. Use ORT's exact U8U8 conversion for affected catalog models.
const cpuOptions = (item) => ({ intraOpNumThreads: 2, interOpNumThreads: 1, ...(item.x64QuantPrecision ? { extra: { session: { x64quantprecision: '1' } } } : {}) });
async function directOnnx(item, imported) {
    const root = join(models, item.id), tokenizer = await loadTokenizer(item);
    const ort = await import(pathToFileURL(join(runtime, 'node_modules/onnxruntime-node/dist/index.js')).href);
    const filename = item.onnxFile ?? ('onnx/' + (item.dtype === 'fp32' ? 'model.onnx' : 'model_quantized.onnx'));
    if (!item.files.some(f => f.name === filename))
        throw Error('本地模型入口未登记');
    const session = await ort.InferenceSession.create(join(root, filename), { executionProviders: ['cpu'], ...cpuOptions(item) });
    const run = async (texts, options) => {
        const tokens = await tokenizer(texts, { padding: true, truncation: false, add_special_tokens: true });
        const ids = tokens.input_ids, mask = tokens.attention_mask;
        if (!ids || !mask || ids.dims.length !== 2)
            throw Error('本地模型分词输出无效');
        const feeds = {};
        for (const name of session.inputNames) {
            if (name === 'position_ids') {
                const positions = new BigInt64Array(ids.data.length), width = ids.dims[1];
                for (let row = 0; row < texts.length; row++) {
                    let pos = 0n;
                    for (let col = 0; col < width; col++) {
                        const i = row * width + col;
                        if (mask.data[i])
                            positions[i] = pos++;
                    }
                }
                feeds[name] = new ort.Tensor('int64', positions, ids.dims);
            }
            else if (tokens[name])
                feeds[name] = new ort.Tensor('int64', tokens[name].data, tokens[name].dims);
            else
                throw Error('本地模型存在未支持的输入：' + name);
        }
        const output = (await session.run(feeds)).sentence_embedding;
        if (!output || output.dims.length !== 2 || output.dims[0] !== texts.length || output.dims[1] !== item.dimensions || !(output.data instanceof Float32Array))
            throw Error('本地模型未返回有效句向量');
        return { tolist: () => texts.map((_, i) => Array.from(output.data.subarray(i * item.dimensions, (i + 1) * item.dimensions))) };
    };
    return Object.assign(run, { dispose: () => session.release() });
}
async function encode(item, texts, purpose, requested) {
    const budget = localTokenBudget(item.id, requested);
    const input = texts.map(text => localInputPrefix(item, purpose) + text);
    for (const text of input)
        if (await tokenCount(item, text) > budget)
            throw Error(`本地编码输入超过 ${budget} tokens（包含任务前缀与特殊 token），未截断；请缩短查询或重建索引`);
    if (!runtimeReady())
        throw Error(runtimeUpdate);
    if (state(item.id).status !== 'installed')
        throw Error('请先手动下载并安装模型');
    if (loaded !== item.id) {
        await unload();
        // Legacy cache entries have no artifact identity. Verify bytes before naming them as the pinned revision.
        if (state(item.id).artifactFingerprint !== artifactFingerprint(item))
            for (const file of item.files) {
                const target = join(models, item.id, file.name);
                if (!existsSync(target) || statSync(target).size !== file.bytes || await fileHash(target) !== file.sha256)
                    throw Error('模型文件版本不匹配，请重新下载／校验');
            }
        if (freemem() < item.estimatedMiB * 1024 ** 2)
            throw Error('可用内存不足，建议使用更小模型或在线 API');
        const imported = await import(pathToFileURL(join(runtime, 'node_modules/@huggingface/transformers/src/transformers.js')).href);
        imported.env.allowRemoteModels = false;
        imported.env.allowLocalModels = true;
        imported.env.backends.onnx.wasm.numThreads = 2;
        extractor = item.runtime === 'onnx' ? await directOnnx(item, imported) : await imported.pipeline('feature-extraction', join(models, item.id), { dtype: item.dtype ?? 'q8', device: 'cpu', session_options: cpuOptions(item) });
        loaded = item.id;
    }
    const result = await extractor(input, { pooling: item.pooling, normalize: true, truncation: false, add_special_tokens: true, padding: true });
    return result.tolist();
}
async function dispatch(message) {
    if (encoderOnly && !['encode', 'split', 'unload'].includes(message.action))
        throw Error('编码进程不处理模型管理操作');
    if (message.action === 'catalog')
        return states;
    if (message.action === 'unload') {
        await embedding;
        await unload();
        return true;
    }
    const item = model(message.modelId);
    if (message.action === 'download-model') {
        if (download) {
            if (download.id === item.id)
                return states;
            throw Error('另一个模型正在下载');
        }
        download = { id: item.id, controller: new AbortController() };
        void install(item, download.controller);
        return states;
    }
    if (message.action === 'pause-download') {
        if (download?.id === item.id)
            download.controller.abort();
        return states;
    }
    if (message.action === 'delete-model') {
        if (download?.id === item.id)
            throw Error('请先暂停下载');
        await embedding;
        if (loaded === item.id)
            await unload();
        const target = resolve(models, item.id);
        if (!target.startsWith(resolve(models) + (process.platform === 'win32' ? '\\' : '/')))
            throw Error('非法模型路径');
        rmSync(target, { recursive: true, force: true });
        Object.assign(state(item.id), { status: 'not-installed', downloadedBytes: 0, error: undefined });
        publish();
        return states;
    }
    if (message.action === 'split') {
        const run = embedding.catch(() => { }).then(async () => { const budget = localTokenBudget(item.id, message.localMaxTokens), result = []; for (const text of message.texts ?? [])
            result.push(await localTextRanges(text, message.chunkChars ?? 480, budget, value => tokenCount(item, localInputPrefix(item, 'index') + value))); return result; });
        embedding = run;
        return run;
    }
    if (message.action === 'encode') {
        const run = embedding.catch(() => { }).then(() => encode(item, message.texts, message.purpose, message.localMaxTokens));
        embedding = run;
        return run;
    }
    throw Error('未知本地模型操作');
}
process.on('message', (raw) => { const message = raw; void dispatch(message).then(result => process.send?.({ id: message.id, result }), error => process.send?.({ id: message.id, error: String(error.message).slice(0, 200) })); });
process.on('disconnect', () => process.exit(0));
