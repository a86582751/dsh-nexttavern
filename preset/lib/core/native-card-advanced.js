// Generated from runtime/alpha3/src/core/native-card-advanced.ts; edit the TypeScript source.
/** Classification binds beside the current Source. Applying it never reimports
 * author text, replays an opening or mutates author/editor tables. */
import { materializeNativeCardConversionV1, validateNativeCardClassificationV1 } from './native-card-conversion.js';
export const nativeCardAdvancedKeyV1 = (sessionId) => `${sessionId}__native-card-classification-v1`;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export function createNativeCardAdvancedV1(deps) {
    // InputState owns snapshot invalidation. Reusing its immutable snapshot also
    // reuses this imported-data boundary check, rather than revalidating on every
    // status/UI/cluster read or rehashing the complete author document here.
    const imported = new WeakMap();
    const bindings = new WeakMap();
    const views = new WeakMap();
    function cacheBinding(snapshot, raw, value) {
        let cache = bindings.get(snapshot);
        if (!cache) {
            cache = new WeakMap();
            bindings.set(snapshot, cache);
        }
        cache.set(raw, value);
    }
    function resolve(snapshot, raw, embedded) {
        if (!object(raw) || raw.schemaVersion !== 1
            || raw.encoding !== (embedded ? 'nexttavern-classification-v1' : 'nexttavern-card-classification-binding-v1')) {
            return { state: 'unconverted', reason: '角色卡分类记录无效，需要重新转换' };
        }
        if (raw.sourceSha256 !== snapshot.sourceSha256)
            return { state: 'stale', reason: '作者设定已变化，需要重新转换' };
        try {
            // Uploaded source directories are never trusted: the validator resolves
            // their assignments against the current program-owned source units, and
            // materialization regenerates every pointer from those actual units.
            const proposal = embedded ? { characters: raw.characters, assignments: raw.assignments } : raw.classification;
            const classification = validateNativeCardClassificationV1(snapshot, proposal);
            return { state: 'ready', classification, ...!embedded && typeof raw.resourceId === 'string' ? { resourceId: raw.resourceId } : {} };
        }
        catch (error) {
            return { state: 'unconverted', reason: error instanceof Error ? error.message : '角色卡分类记录无效，需要重新转换' };
        }
    }
    function embedded(snapshot) {
        let result = imported.get(snapshot);
        if (!result) {
            result = resolve(snapshot, snapshot.document.data.compatibility?.classification, true);
            imported.set(snapshot, result);
        }
        return result;
    }
    function ready(captured, resolved) {
        const { snapshot, nativeAuthoring } = captured, classification = resolved?.classification;
        const prior = views.get(snapshot);
        if (prior && prior.resolved === resolved && prior.nativeAuthoring === nativeAuthoring)
            return prior.value;
        const sourceDocument = classification ? materializeNativeCardConversionV1(snapshot, classification) : snapshot.document;
        // This is an advanced-context view, never the portable execution document.
        // Dynamic rules arrive only from the actual request's rendered material.
        const rules = { ...sourceDocument.data.rules };
        for (const field of ['core', 'plot', 'narrative', 'reply', 'style'])
            if (rules[field]?.includes('<%'))
                delete rules[field];
        const document = { ...sourceDocument, data: { ...sourceDocument.data, rules } };
        const dynamic = new Set();
        if (classification) {
            const atomic = new Set(snapshot.units.filter(unit => unit.kind === 'author' && unit.atomic).map(unit => unit.id));
            for (const span of classification.assignments)
                if (span.target === 'character' && atomic.has(span.sourceId)) {
                    dynamic.add(span.characterId);
                }
        }
        const characters = [];
        let expected = 0;
        for (const [index, row] of document.data.cards.entries()) {
            if (row.kind === 'user' || row.enabled === false)
                continue;
            expected++;
            const id = typeof row.characterId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(row.characterId)
                ? row.characterId : `native-character-${index + 1}`;
            if (!row.content.trim() || row.content.includes('<%') || dynamic.has(id))
                continue;
            characters.push({ id, name: row.name ?? document.data.name, content: row.content,
                ...row.aliases ? { aliases: [...row.aliases] } : {} });
        }
        const staticReady = characters.length === expected;
        const value = { state: 'ready', sourceSha256: snapshot.sourceSha256, nativeAuthoring, document,
            ...classification ? { classification } : {}, characters, staticReady,
            ...!staticReady ? { reason: '部分人物需要已渲染的动态人设或缺少可用正文' } : {},
            ...resolved?.resourceId ? { resourceId: resolved.resourceId } : {} };
        views.set(snapshot, { resolved, nativeAuthoring, value });
        return value;
    }
    function read(sessionId) {
        const captured = deps.capture(sessionId), { snapshot, nativeAuthoring } = captured;
        const raw = deps.branch.get(nativeCardAdvancedKeyV1(sessionId));
        let binding;
        if (raw !== undefined && raw !== null) {
            binding = object(raw) ? bindings.get(snapshot)?.get(raw) : undefined;
            if (!binding) {
                binding = resolve(snapshot, raw, false);
                if (object(raw))
                    cacheBinding(snapshot, raw, binding);
            }
            if (binding.state === 'ready')
                return ready(captured, binding);
        }
        if (nativeAuthoring && snapshot.document.spec_version === '1.0')
            return ready(captured);
        if (snapshot.document.spec_version === '1.1') {
            const imported = embedded(snapshot);
            if (imported.state === 'ready')
                return ready(captured, imported);
            binding ??= imported;
        }
        const reason = binding && binding.state !== 'ready' ? binding.reason : undefined;
        return { state: binding?.state ?? 'unconverted', sourceSha256: snapshot.sourceSha256, nativeAuthoring,
            characters: [], staticReady: false, reason: reason ?? '需要转换为 NextTavern 原生结构才能启用高级功能' };
    }
    async function apply(sessionId, input) {
        return deps.withSourceLock(sessionId, async () => {
            const captured = deps.capture(sessionId);
            if (captured.snapshot.sourceSha256 !== input.sourceSha256)
                throw Error('角色卡来源已变化，转换结果已保留，请基于当前设定重新转换');
            const classification = structuredClone({
                characters: input.classification.characters, assignments: input.classification.assignments,
            });
            const binding = { schemaVersion: 1, encoding: 'nexttavern-card-classification-binding-v1',
                sourceSha256: input.sourceSha256, classification,
                ...input.resourceId ? { resourceId: input.resourceId } : {} };
            await deps.branch.put(nativeCardAdvancedKeyV1(sessionId), binding);
            const resolved = { state: 'ready', classification,
                ...input.resourceId ? { resourceId: input.resourceId } : {} };
            const stored = deps.branch.get(nativeCardAdvancedKeyV1(sessionId));
            if (object(stored))
                cacheBinding(captured.snapshot, stored, resolved);
            return ready(captured, resolved);
        });
    }
    function captureForkSeed(parentSessionId) {
        const current = read(parentSessionId);
        if (current.state !== 'ready' || !current.classification)
            return undefined;
        return { schemaVersion: 1, encoding: 'nexttavern-card-conversion-fork-seed-v1', parentSessionId,
            binding: { schemaVersion: 1, encoding: 'nexttavern-card-classification-binding-v1', sourceSha256: current.sourceSha256,
                classification: structuredClone(current.classification), ...current.resourceId ? { resourceId: current.resourceId } : {} } };
    }
    /** The inheritance owner calls this before ready while holding the child
     * Source FIFO. Its frozen prepared seed is authoritative, never parent latest. */
    async function applyForkSeed(childSessionId, seed) {
        await deps.branch.put(nativeCardAdvancedKeyV1(childSessionId), structuredClone(seed.binding));
    }
    return { read, apply, captureForkSeed, applyForkSeed };
}
