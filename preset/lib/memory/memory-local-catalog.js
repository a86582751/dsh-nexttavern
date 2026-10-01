// Generated from runtime/alpha3/src/memory/memory-local-catalog.ts; edit the TypeScript source.
export const LOCAL_RUNTIME_VERSION = 'transformers-3.8.1/onnxruntime-1.29.0';
export function localTokenBudget(modelId, requested = 512) {
    const model = LOCAL_MODELS.find(m => m.id === modelId);
    if (!model)
        throw Error('本地模型不在受信目录');
    if (!Number.isSafeInteger(requested) || Number(requested) < 64 || Number(requested) > model.maxInputTokens)
        throw Error(`本地编码预算须为 64–${model.maxInputTokens} tokens（包含前缀与特殊 token）`);
    return Number(requested);
}
export const localInputPrefix = (model, purpose) => purpose === 'query' ? model.queryPrefix : (model.documentPrefix ?? (model.id === 'e5-small' ? 'passage: ' : ''));
/** Original UTF-16 offsets, with scalar boundaries and verified complete encoder inputs. */
export async function localTextRanges(text, chars, budget, count) {
    if (!Number.isSafeInteger(chars) || chars < 128 || chars > 2048)
        throw Error('索引块大小无效');
    const boundary = (at) => at > 0 && at < text.length && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]) ? at - 1 : at;
    const ranges = [], overlap = Math.floor(chars / 6);
    for (let offset = 0; offset < text.length;) {
        let end = boundary(Math.min(text.length, offset + chars));
        if (await count(text.slice(offset, end)) > budget) {
            const ends = [];
            for (let at = offset; at < end;) {
                at += text.codePointAt(at) > 0xffff ? 2 : 1;
                ends.push(at);
            }
            let low = 0, high = ends.length - 1, best = -1;
            while (low <= high) {
                const middle = Math.floor((low + high) / 2);
                if (await count(text.slice(offset, ends[middle])) <= budget) {
                    best = middle;
                    low = middle + 1;
                }
                else
                    high = middle - 1;
            }
            if (best < 0)
                throw Error('本地编码预算无法容纳单个字符及任务前缀／特殊 token；请提高预算或更换模型');
            end = ends[best];
        }
        // Never trust token counts inferred from character counts or a previous substring.
        if (end <= offset || await count(text.slice(offset, end)) > budget)
            throw Error('本地 tokenizer 分段校验失败，未截断或标记覆盖');
        ranges.push({ offset, end });
        if (end === text.length)
            break;
        const next = boundary(Math.max(offset + 1, end - Math.min(overlap, Math.floor((end - offset) / 6))));
        offset = next > offset ? next : offset + (text.codePointAt(offset) > 0xffff ? 2 : 1);
    }
    return ranges;
}
/**
 * Verified local ONNX candidates. Revisions and file digests are pinned so a
 * later downloader can verify every artifact before it enters the local cache.
 * estimatedMiB is a planning budget, not a runtime measurement.
 */
export const LOCAL_MODELS = [
    {
        id: 'jina-v5-small-int8', name: 'Jina v5 Text Small Retrieval (ONNX INT8 · cstr)', license: 'CC-BY-NC-4.0',
        maxInputTokens: 32768,
        repo: 'cstr/jina-embeddings-v5-text-small-retrieval-onnx-int8', revision: '2dd90f70b5bce80f21a7a80a04ed616ff12f22d7',
        dimensions: 1024, pooling: 'last_token', queryPrefix: 'Query: ', documentPrefix: 'Document: ', runtime: 'onnx', dtype: 'q8', onnxFile: 'model.int8.onnx', x64QuantPrecision: true, estimatedMiB: 2000, languages: 'multilingual',
        description: '第三方 SmoothQuant INT8 转换，下载约 1.08 GB；Query / Document 分别编码。非商业许可；内存紧张时优先 Nano。',
        files: [
            { name: 'model.int8.onnx', bytes: 3744337, sha256: 'e8af7f2a1d4b2daa53cf9f9440fd8410f5f2b1df5379c62aac975a8a5fb5ac9b' },
            { name: 'model.int8.onnx.data', bytes: 1063768064, sha256: '3ded0d6f00b878d3c11f305fdd22e16bc121b314163b8116a212d82ce037ad6e' },
            { name: 'config.json', bytes: 1510, sha256: 'd6cc749796016b49553e3892f27184bd1cfc440f1ad1a7252e22e72dbfb5be90' },
            { name: 'tokenizer.json', bytes: 11422654, sha256: 'aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4' },
            { name: 'tokenizer_config.json', bytes: 670, sha256: '9da9b391de9bb545e047bdfd5d9abefe32ee41937acf6c3b06aae33d85d0a4b4' },
        ],
    },
    {
        id: 'jina-v5-nano', name: 'Jina v5 Text Nano Retrieval (ONNX q8)', license: 'CC-BY-NC-4.0',
        maxInputTokens: 8192,
        repo: 'jinaai/jina-embeddings-v5-text-nano-retrieval', revision: 'ac5d898c8d382b17167c33e5c8af644a3519b47d',
        dimensions: 768, pooling: 'last_token', queryPrefix: 'Query: ', documentPrefix: 'Document: ', runtime: 'onnx', dtype: 'q8', estimatedMiB: 1000, languages: 'multilingual',
        description: '官方 q8 检索版，下载约 264 MB；Query / Document 分别编码。使用已升级的 ONNX Runtime。非商业许可。',
        files: [
            { name: 'onnx/model_quantized.onnx', bytes: 131365, sha256: 'ac93a7417c216e5076e37da2b3599f7ef16513934098a477680440c09f735a08' },
            { name: 'onnx/model_quantized.onnx_data', bytes: 247006208, sha256: 'ee7870eb143a7353be08b33f79992a51de3e32b41f684ccd82953a710c2f2f9c' },
            { name: 'config.json', bytes: 1361, sha256: '367857e3a726df6f1997bcb8443a4351e68b29c65f996e5874a4b3e7c5661a16' },
            { name: 'tokenizer.json', bytes: 17210235, sha256: '98d4a1d32152d6cedf85b5e88f3b205106dca1fe72aaab34e0ac13c238421069' },
            { name: 'tokenizer_config.json', bytes: 487, sha256: '6c4640d432db970b2436a4386d3ee992b99e756b62c37446c3f581c8d09cbb05' },
        ],
    },
    {
        id: 'nomic-v2-moe', name: 'Nomic Embed v2 MoE (ONNX q8 · Netrias)', license: 'Apache-2.0',
        maxInputTokens: 512,
        repo: 'netrias/nomic-embed-text-v2-moe-onnx', revision: '5dcdc1a46ce6d4c529fadb42cccf9ea72d36eb0b',
        dimensions: 768, pooling: 'mean', queryPrefix: 'search_query: ', documentPrefix: 'search_document: ', x64QuantPrecision: true, estimatedMiB: 1800, languages: 'multilingual (100+ languages)',
        description: 'Nomic 权重的第三方 ONNX 转换，非官方导出；已启用旧 x64 CPU 的量化精度保护，旧计算配置的索引需重建。',
        files: [
            { name: 'onnx/model_quantized.onnx', bytes: 477684870, sha256: 'eadbfd196723bec38191b36c471c95b58e6e91f9ba8c1c6b23cc4d1b0f8eeef7' },
            { name: 'config.json', bytes: 2482, sha256: '4f076b4798fc2ba916f1900e0d10177714ee1aa94e0ef809102e723078d3efd3' },
            { name: 'tokenizer.json', bytes: 17082734, sha256: '3a56def25aa40facc030ea8b0b87f3688e4b3c39eb8b45d5702b3a1300fe2a20' },
            { name: 'tokenizer_config.json', bytes: 1147, sha256: 'f90024142df07163e5e6c5b9a6ad7c8c68b22a9112af11e3db4559a9ff90f737' },
            { name: 'special_tokens_map.json', bytes: 964, sha256: '8c785abebea9ae3257b61681b4e6fd8365ceafde980c21970d001e834cf10835' },
        ],
    },
    {
        id: 'qwen3-0.6b',
        maxInputTokens: 32768,
        license: 'Apache-2.0',
        name: 'Qwen3 Embedding 0.6B (ONNX q8)',
        repo: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
        revision: 'c25a394dd583836952667c12f008335071b3f43d',
        dimensions: 1024,
        pooling: 'last_token',
        queryPrefix: 'Instruct: Retrieve narrative passages relevant to the question, including clues and earlier events.\nQuery: ',
        estimatedMiB: 1400,
        languages: 'multilingual (100+ languages)',
        description: 'Instruction-aware retrieval embedding; documents have no instruction prefix.',
        files: [
            { name: 'onnx/model_quantized.onnx', sha256: '87cd124e0ef1fd1f223ebc283efccbaeac386d0b08344701c46975d0657b591f', bytes: 613527631 },
            { name: 'config.json', sha256: '66a10929782f3c9a3cd5dec90e2a95c60e05736134a63cd54479eeae80bed175', bytes: 1576 },
            { name: 'tokenizer.json', sha256: 'def76fb086971c7867b829c23a26261e38d9d74e02139253b38aeb9df8b4b50a', bytes: 11423705 },
            { name: 'tokenizer_config.json', sha256: '977648852447cb6587327ff3205b0a84cf2fc9f05621d6c8e88a497caafab2e1', bytes: 9731 },
            { name: 'special_tokens_map.json', sha256: '76862e765266b85aa9459767e33cbaf13970f327a0e88d1c65846c2ddd3a1ecd', bytes: 613 },
        ],
    },
    {
        id: 'bge-small-zh',
        maxInputTokens: 512,
        license: 'MIT',
        name: 'BGE small zh v1.5 (ONNX q8)',
        repo: 'Xenova/bge-small-zh-v1.5',
        revision: '75c43b069aac4d136ba6bc1122f995fedcfd2781',
        dimensions: 512,
        pooling: 'cls',
        queryPrefix: '',
        estimatedMiB: 220,
        languages: 'Chinese',
        description: 'Compact Chinese embedding; optional retrieval instruction is deliberately omitted by default.',
        files: [
            { name: 'onnx/model_quantized.onnx', sha256: '15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc', bytes: 24010842 },
            { name: 'config.json', sha256: 'd4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f', bytes: 716 },
            { name: 'tokenizer.json', sha256: '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26', bytes: 439125 },
            { name: 'tokenizer_config.json', sha256: 'e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a', bytes: 367 },
            { name: 'special_tokens_map.json', sha256: 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3', bytes: 125 },
        ],
    },
    {
        id: 'e5-small',
        maxInputTokens: 512,
        license: 'MIT',
        name: 'Multilingual E5 small (ONNX q8)',
        repo: 'Xenova/multilingual-e5-small',
        revision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
        dimensions: 384,
        pooling: 'average',
        queryPrefix: 'query: ',
        estimatedMiB: 350,
        languages: 'multilingual',
        description: 'Retrieval embedding; use query: and passage: prefixes for asymmetric retrieval.',
        files: [
            { name: 'onnx/model_quantized.onnx', sha256: 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193', bytes: 118308185 },
            { name: 'config.json', sha256: 'cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1', bytes: 658 },
            { name: 'tokenizer.json', sha256: '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39', bytes: 17082730 },
            { name: 'tokenizer_config.json', sha256: 'a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b', bytes: 443 },
            { name: 'special_tokens_map.json', sha256: 'd05497f1da52c5e09554c0cd874037a083e1dc1b9cfd48034d1c717f1afc07a7', bytes: 167 },
        ],
    },
    {
        id: 'bge-m3',
        maxInputTokens: 8192,
        license: 'MIT',
        name: 'BGE-M3 (ONNX q8)',
        repo: 'Xenova/bge-m3',
        revision: '4de13258303883538bd53b696b452bf8099f0858',
        dimensions: 1024,
        pooling: 'cls',
        queryPrefix: '',
        estimatedMiB: 850,
        languages: 'multilingual',
        description: 'Multilingual dense embedding; official card says query instructions are unnecessary.',
        files: [
            { name: 'onnx/model_quantized.onnx', sha256: '0826f8c1ab9edf1801db86c61919d4d108e8bfc0b809ec823ad366882ff0b77d', bytes: 569694530 },
            { name: 'config.json', sha256: '734a79bf12d388c1467a4e3ab625f45de7f6906cffcfb93a1eca1787504bed95', bytes: 770 },
            { name: 'tokenizer.json', sha256: '6710678b12670bc442b99edc952c4d996ae309a7020c1fa0096dd245c2faf790', bytes: 17082821 },
            { name: 'tokenizer_config.json', sha256: '7e4c1cc848840aeccdd763458c18dd525eb0f795c992e00ebe9c28554e7db2d4', bytes: 1173 },
            { name: 'special_tokens_map.json', sha256: '8c785abebea9ae3257b61681b4e6fd8365ceafde980c21970d001e834cf10835', bytes: 964 },
        ],
    },
];
