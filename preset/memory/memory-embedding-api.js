// Generated from runtime/alpha3/memory/memory-embedding-api.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
const count = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
// Gemini Embedding 2 uses asymmetric text instructions; Embedding 1's task_type does not apply.
export function onlineEmbeddingProfile(provider) {
    return provider.kind === 'online' && provider.protocol === 'openai' && ['gemini-embedding-2', 'gemini-embedding-2-preview'].includes(provider.model)
        ? { version: 'google-embedding-2-retrieval-v1', documentPrefix: 'title: none | text: ', queryPrefix: 'task: search result | query: ', normalization: 'l2' } : undefined;
}
export async function boundedJSON(response, bytes = 16 * 1024 * 1024) {
    if (Number(response.headers.get('content-length')) > bytes)
        throw Error('响应超过大小限制');
    const reader = response.body?.getReader();
    if (!reader)
        throw Error('空响应');
    const chunks = [];
    let size = 0;
    try {
        for (;;) {
            const next = await reader.read();
            if (next.done)
                break;
            size += next.value.length;
            if (size > bytes)
                throw Error('响应超过大小限制');
            chunks.push(next.value);
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function validateVectors(value, expectedCount, dimensions) {
    if (!Array.isArray(value) || value.length !== expectedCount)
        throw Error('向量数量与输入不一致');
    let width = dimensions;
    return value.map(vector => {
        if (!Array.isArray(vector) || !vector.length || vector.length > 8192 || vector.some(v => typeof v !== 'number' || !Number.isFinite(v)))
            throw Error('向量格式无效');
        width ??= vector.length;
        if (vector.length !== width)
            throw Error('向量维度发生变化，请重新测试接入');
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        if (!norm)
            throw Error('返回零向量');
        return vector.map((v) => v / norm);
    });
}
export async function onlineEmbedding(provider, input, purpose, workspaceId, ownerSessionId, record, timeoutMs) {
    const call = { schemaVersion: 1, id: randomUUID(), ownerSessionId, workspaceId, provider: provider.name, model: provider.model,
        purpose, startedAt: Date.now(), completedAt: Date.now(), status: 'unknown', inputTokens: null, totalTokens: null, providerUsage: {} };
    record(call); // Durable attempt before transport: crash/timeout is unknown, never silently retried.
    let received = false;
    try {
        if (!provider.apiKey)
            throw Error('尚未设置 API Key');
        const root = provider.baseUrl.replace(/\/+$/, '');
        let url, body;
        if (provider.protocol === 'openai') {
            const profile = onlineEmbeddingProfile(provider), prefix = profile ? (purpose === 'query' ? profile.queryPrefix : profile.documentPrefix) : '';
            url = `${root}/embeddings`;
            body = { model: provider.model, input: prefix ? input.map(text => prefix + text) : input, encoding_format: 'float' };
            if (provider.requestedDimensions)
                body.dimensions = provider.requestedDimensions;
        }
        else {
            const multimodal = provider.protocol === 'dashscope-multimodal';
            url = `${root}/services/embeddings/${multimodal ? 'multimodal-embedding/multimodal-embedding' : 'text-embedding/text-embedding'}`;
            body = { model: provider.model, input: multimodal ? { contents: input.map(text => ({ text })) } : { texts: input } };
            if (provider.requestedDimensions && provider.model !== 'tongyi-embedding-vision-flash')
                body.parameters = { dimension: provider.requestedDimensions };
        }
        const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
        const payload = await boundedJSON(response);
        received = true;
        call.requestId = String(payload.request_id ?? response.headers.get('x-request-id') ?? '').slice(0, 200);
        const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage : {};
        for (const field of ['prompt_tokens', 'input_tokens', 'total_tokens', 'output_tokens', 'image_tokens']) {
            const n = count(usage[field]);
            if (n !== null)
                call.providerUsage[field] = n;
        }
        call.inputTokens = count(usage.prompt_tokens) ?? count(usage.input_tokens);
        call.totalTokens = count(usage.total_tokens);
        if (call.inputTokens === null && provider.protocol === 'dashscope-text')
            call.inputTokens = call.totalTokens;
        if (!response.ok || payload.code)
            throw Error(`嵌入服务请求失败 HTTP ${response.status}`);
        const output = payload.output;
        const rows = (provider.protocol === 'openai' ? payload.data : output?.embeddings);
        if (!Array.isArray(rows) || rows.length !== input.length)
            throw Error('嵌入响应条目不完整');
        const ordered = new Array(input.length), seen = new Set();
        for (const row of rows) {
            const index = row.index ?? row.text_index;
            if (!Number.isSafeInteger(index) || index < 0 || index >= input.length || seen.has(index))
                throw Error('嵌入响应索引无效');
            if (provider.protocol === 'dashscope-multimodal' && row.type !== (provider.model === 'qwen3-vl-embedding' ? 'vl' : 'text'))
                throw Error('嵌入响应不是所需的独立文本向量');
            seen.add(index);
            ordered[index] = row.embedding;
        }
        const vectors = validateVectors(ordered, input.length, provider.dimensions);
        call.status = 'completed';
        return vectors;
    }
    catch (error) {
        call.status = received ? 'failed' : 'unknown';
        throw error;
    }
    finally {
        call.completedAt = Date.now();
        record(call);
    }
}
