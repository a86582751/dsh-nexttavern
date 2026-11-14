// Generated from runtime/alpha3/src/core/community-presets.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { withTavernLock } from './tavern-task-support.js';
import { recordSha256 } from './roleplay-data.js';
import { parseCommunityPreset, normalizeCommunityRegexes, communityTavernRegexDto } from './community-preset-import.js';
import { parseCommunityIzumiPlanPack, applyCommunityIzumiPlans, annotateCommunityIzumiPrompts } from './community-preset-plans.js';
import { applyCommunityPresetControl, resolveCommunityPresetControls } from './community-preset-controls.js';
import { extractCommunityPresetProfile } from './community-preset-profiles.js';
export const COMMUNITY_PRESETS_KEY = 'community-presets-v1';
const emptySelection = () => ({ presetId: null, applySampling: false, prompts: {}, contents: {}, features: {}, regexes: {}, regexOrder: null });
const copy = (value) => structuredClone(value);
const object = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('配置必须是对象');
    return value;
};
const jsonObject = (value) => copy(object(value));
const text = (value) => typeof value === 'string' ? value : '';
function selection(value, state) {
    const raw = object(value), presetId = raw.presetId === null ? null : text(raw.presetId);
    if (presetId !== null && !state.presets.some(p => p.id === presetId))
        throw Error('社区预设不存在');
    const booleans = (value) => {
        const entries = Object.entries(object(value ?? {}));
        if (entries.some(([, value]) => typeof value !== 'boolean'))
            throw Error('条目开关必须为布尔值');
        return Object.fromEntries(entries);
    };
    const order = raw.regexOrder ?? null;
    if (order !== null && (!Array.isArray(order) || order.length !== 3
        || new Set(order).size !== 3 || order.some(value => !['global', 'preset', 'scoped'].includes(String(value))))) {
        throw Error('正则来源顺序必须包含全局、预设、角色卡各一次');
    }
    const contents = object(raw.contents ?? {});
    if (Object.values(contents).some(value => typeof value !== 'string'))
        throw Error('提示条目正文必须为文本');
    return { presetId, applySampling: raw.applySampling === true, prompts: booleans(raw.prompts), contents: copy(contents),
        features: jsonObject(raw.features ?? {}), regexes: booleans(raw.regexes), regexOrder: order };
}
function exportPreset(preset) {
    const raw = copy(preset.source.raw);
    raw.prompts = preset.prompts.map(prompt => ({ ...prompt.raw, identifier: prompt.identifier, name: prompt.name,
        content: prompt.content, role: prompt.role, enabled: prompt.enabled, marker: !!prompt.marker,
        injection_position: prompt.injectionPosition, injection_depth: prompt.injectionDepth, injection_order: prompt.injectionOrder }));
    const orders = Array.isArray(raw.prompt_order) ? raw.prompt_order : [];
    const selected = orders.find(row => row.character_id === preset.characterId);
    if (selected)
        selected.order = copy(preset.promptOrder);
    else
        orders.push({ character_id: preset.characterId ?? 100001, order: copy(preset.promptOrder) });
    raw.prompt_order = orders;
    const extensions = raw.extensions && typeof raw.extensions === 'object' && !Array.isArray(raw.extensions) ? raw.extensions : {};
    extensions.regex_scripts = preset.regexes.map(({ raw: source, ...rule }) => ({ ...source, ...rule }));
    const native = extensions.nexttavern && typeof extensions.nexttavern === 'object' && !Array.isArray(extensions.nexttavern)
        ? extensions.nexttavern : {};
    // Persisted v1 profiles already contain a resolved native contract. Export
    // makes that choice explicit so re-import never needs source recognition.
    const extra = preset.profile.configuration.extraParameters;
    const enabled = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra.enabled : undefined;
    extensions.nexttavern = { ...native, profile: preset.profile.id,
        ...typeof enabled === 'boolean' ? { extraParameters: enabled } : {} };
    raw.extensions = extensions;
    return raw;
}
/** One owner supplies both preset and independent regex state. Library edits
 * are shared; selection overrides belong to the selected conversation scope. */
export function createCommunityPresets(table, rootOf) {
    let policySource;
    const policies = new Map();
    function read() {
        const raw = table.get(COMMUNITY_PRESETS_KEY);
        if (raw == null)
            return { schemaVersion: 1, revision: 0, presets: [], global: emptySelection(), conversations: {}, planPacks: {}, regexes: [], configurationWrites: [] };
        const state = raw;
        if (state.schemaVersion !== 1)
            throw Error('社区预设存储版本不受支持，未覆盖原记录');
        return copy(state);
    }
    function buildPolicy(sessionId) {
        const state = read(), conversationId = rootOf(sessionId), local = state.conversations[conversationId] ?? null;
        const effective = local ?? state.global, stored = state.presets.find(p => p.id === effective.presetId) ?? null;
        const preset = stored ? copy(stored) : null;
        if (preset) {
            for (const prompt of preset.prompts)
                if (Object.hasOwn(effective.prompts, prompt.identifier))
                    prompt.enabled = effective.prompts[prompt.identifier];
            for (const prompt of preset.prompts)
                if (Object.hasOwn(effective.contents, prompt.identifier))
                    prompt.content = effective.contents[prompt.identifier];
            for (const item of preset.promptOrder)
                if (Object.hasOwn(effective.prompts, item.identifier))
                    item.enabled = effective.prompts[item.identifier];
            for (const rule of preset.regexes)
                if (Object.hasOwn(effective.regexes, rule.id))
                    rule.disabled = !effective.regexes[rule.id];
        }
        const libraries = state.regexes.filter(item => item.binding.scope === 'global'
            || item.binding.scope === 'conversation' && item.binding.id === conversationId
            || item.binding.scope === 'preset' && item.binding.id === effective.presetId);
        const regexOrder = effective.regexOrder ?? (preset && ['kemini', 'reborn', 'izumi'].includes(preset.profile.id)
            ? ['preset', 'global', 'scoped'] : ['global', 'preset', 'scoped']);
        const fingerprint = recordSha256({ preset, selection: effective, regexes: libraries, regexOrder });
        let helperVariables = null;
        if (preset) {
            // These are the selected preset's own TavernHelper settings, not the
            // separate Community global-variable journal. Missing/invalid tables use
            // the upstream PresetSettings default; no selected preset stays absent.
            const extensions = preset.source.raw.extensions;
            const settings = extensions && typeof extensions === 'object' && !Array.isArray(extensions) ? extensions.tavern_helper : undefined;
            const raw = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings.variables : undefined;
            const values = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
            helperVariables = { scope: 'preset', ownerId: `community:${preset.id}:tavern-helper`,
                versionSha256: preset.source.sha256, values, valuesSha256: recordSha256(values) };
        }
        return { revision: state.revision, conversationId, global: state.global, local, effective, preset,
            helperVariables,
            presets: state.presets.map(p => ({ id: p.id, name: p.name, profile: p.profile.id, prompts: p.prompts.length, regexes: p.regexes.length })),
            planPack: stored ? state.planPacks[stored.id] ?? null : null, regexes: libraries, regexLibrary: state.regexes, regexOrder, fingerprint };
    }
    function policy(sessionId) {
        const source = table.get(COMMUNITY_PRESETS_KEY), root = rootOf(sessionId);
        if (source !== policySource) {
            policies.clear();
            policySource = source;
        }
        let value = policies.get(root);
        if (!value) {
            value = buildPolicy(sessionId);
            policies.set(root, value);
        }
        return value;
    }
    const readonlyPresets = new WeakMap();
    const ejsPresets = new WeakMap();
    const globalRegexes = new WeakMap();
    function readonlyGlobalRegexes(sessionId) {
        const current = policy(sessionId), saved = globalRegexes.get(current);
        if (saved)
            return saved;
        const result = current.regexes.filter(library => library.binding.scope === 'global')
            .flatMap(library => library.rules.map(communityTavernRegexDto));
        globalRegexes.set(current, result);
        return result;
    }
    function ejsPreset(sessionId, current = policy(sessionId)) {
        const saved = ejsPresets.get(current);
        if (saved)
            return saved;
        const preset = current.preset, result = preset ? {
            kind: 'available', id: preset.id, loadedName: preset.name, fingerprint: current.fingerprint,
            prompts: Object.freeze(preset.prompts.map((row, index) => Object.freeze({ name: row.name, content: row.content,
                sourcePointer: `/community/presets/${preset.id.replaceAll('~', '~0').replaceAll('/', '~1')}/prompts/${index}/content` })))
        }
            : { kind: 'none', fingerprint: current.fingerprint };
        Object.freeze(result);
        ejsPresets.set(current, result);
        return result;
    }
    function readonlyPreset(sessionId) {
        const current = policy(sessionId), saved = readonlyPresets.get(current);
        if (saved)
            return saved;
        const preset = current.preset;
        let result;
        if (!preset)
            result = { kind: 'none', fingerprint: current.fingerprint };
        else {
            const prompt = (row) => ({ id: row.identifier, name: row.name,
                enabled: row.enabled, role: row.role,
                ...!['main', 'nsfw', 'jailbreak', 'enhanceDefinitions'].includes(row.identifier) ? { position: row.injectionPosition === 1
                        ? { type: 'in_chat', depth: row.injectionDepth, order: row.injectionOrder } : { type: 'relative' } } : {},
                ...!row.marker ? { content: row.content } : {},
                ...row.raw.extra && typeof row.raw.extra === 'object' ? { extra: copy(row.raw.extra) } : {} });
            const byId = new Map(preset.prompts.map(row => [row.identifier, row])), ordered = preset.promptOrder.length ? preset.promptOrder.map(row => byId.get(row.identifier)).filter(Boolean)
                : preset.prompts.filter(row => !row.unused), raw = preset.source.raw.extensions, extensions = raw && typeof raw === 'object' && !Array.isArray(raw) ? copy(raw) : {};
            extensions.regex_scripts = preset.regexes.map(communityTavernRegexDto);
            const helper = extensions.tavern_helper;
            extensions.tavern_helper = { ...helper && typeof helper === 'object' && !Array.isArray(helper) ? helper : {},
                variables: copy(current.helperVariables.values) };
            // Only these two imported fields are actually passed to Native sampling.
            // Other imported parameters do not establish current provider settings.
            const settings = {};
            if (current.effective.applySampling) {
                if (typeof preset.parameters.temperature === 'number')
                    settings.temperature = preset.parameters.temperature;
                if (typeof preset.parameters.openai_max_tokens === 'number')
                    settings.max_completion_tokens = preset.parameters.openai_max_tokens;
            }
            result = { kind: 'available', loadedName: preset.name, fingerprint: current.fingerprint, settingsComplete: false,
                preset: { settings, prompts: ordered.map(prompt), prompts_unused: preset.prompts.filter(row => row.unused).map(prompt), extensions } };
        }
        function freeze(value) {
            if (value && typeof value === 'object' && !Object.isFrozen(value)) {
                for (const child of Object.values(value))
                    freeze(child);
                Object.freeze(value);
            }
        }
        freeze(result);
        readonlyPresets.set(current, result);
        return result;
    }
    function scopeSelection(state, sessionId, scope) {
        if (scope === 'global')
            return state.global;
        const root = rootOf(sessionId);
        return state.conversations[root] ?? (state.conversations[root] = copy(state.global));
    }
    function preparedPlans(state, sessionId, scope, preset, ids) {
        const current = scope === 'global' ? state.global : state.conversations[rootOf(sessionId)] ?? state.global;
        const effective = copy(preset);
        for (const prompt of effective.prompts)
            if (Object.hasOwn(current.prompts, prompt.identifier))
                prompt.enabled = current.prompts[prompt.identifier];
        for (const row of effective.promptOrder)
            if (Object.hasOwn(current.prompts, row.identifier))
                row.enabled = current.prompts[row.identifier];
        const pack = state.planPacks[preset.id];
        if (!pack)
            throw Error('请先导入方案包');
        return { effective, applied: applyCommunityIzumiPlans(effective, pack.plans.filter(plan => ids.includes(plan.id))) };
    }
    // Callers with cancellable ownership recheck synchronously at publication,
    // after the shared FIFO has released every preceding mutation.
    async function mutate(sessionId, value, callerCurrent) {
        const body = object(value);
        return withTavernLock(table, COMMUNITY_PRESETS_KEY, async () => {
            const state = read();
            if (body.expectedRevision !== state.revision)
                throw Error('社区预设已更新，请刷新后重试');
            const scope = body.scope === 'global' ? 'global' : 'conversation';
            let result = {};
            const found = () => {
                const preset = state.presets.find(item => item.id === body.presetId);
                if (!preset)
                    throw Error('社区预设不存在');
                return preset;
            };
            switch (body.action) {
                case 'profile': {
                    const preset = found(), id = text(body.profile);
                    if (!['standard', 'dream', 'kemini', 'reborn', 'izumi'].includes(id))
                        throw Error('原生适配类型无效');
                    const raw = exportPreset(preset), extensions = raw.extensions;
                    extensions.nexttavern = { ...extensions.nexttavern, profile: id };
                    preset.profile = extractCommunityPresetProfile(raw, preset.prompts);
                    if (preset.profile.id !== id)
                        throw Error('该适配缺少已启用的声明配置');
                    if (id === 'izumi')
                        annotateCommunityIzumiPrompts(preset.prompts, preset.promptOrder);
                    break;
                }
                case 'import': {
                    const rawText = text(body.rawText), input = body.data ?? JSON.parse(rawText);
                    const preset = parseCommunityPreset(input, { id: `community-${randomUUID()}`, name: text(body.name) || text(body.fileName).replace(/\.json$/i, '') || '社区预设', fileName: text(body.fileName), rawText });
                    state.presets.push(preset);
                    result = { importedId: preset.id };
                    break;
                }
                case 'copy': {
                    const source = found(), preset = copy(source);
                    preset.id = `community-${randomUUID()}`;
                    preset.name = text(body.name) || `${source.name} 副本`;
                    state.presets.push(preset);
                    if (state.planPacks[source.id])
                        state.planPacks[preset.id] = copy(state.planPacks[source.id]);
                    result = { importedId: preset.id };
                    break;
                }
                case 'update': {
                    const preset = found();
                    if (body.name !== undefined)
                        preset.name = text(body.name);
                    if (body.prompts !== undefined) {
                        for (const change of body.prompts) {
                            const prompt = preset.prompts.find(item => item.identifier === change.identifier);
                            if (!prompt)
                                throw Error('提示条目不存在');
                            if (prompt.readOnly || prompt.configurationOnly)
                                throw Error('只读或配置专用条目不可编辑');
                            for (const key of ['name', 'content', 'role', 'injectionPosition', 'injectionDepth', 'injectionOrder']) {
                                const value = change[key];
                                if (value === undefined)
                                    continue;
                                if (key === 'role' && !['system', 'user', 'assistant'].includes(String(value)))
                                    throw Error('提示角色无效');
                                if ((key === 'name' || key === 'content') && typeof value !== 'string')
                                    throw Error('提示正文与名称必须为文本');
                                if (key.startsWith('injection') && (!Number.isSafeInteger(value)
                                    || key === 'injectionDepth' && Number(value) < 0 || key === 'injectionPosition' && value !== 0 && value !== 1))
                                    throw Error('提示位置无效');
                                const mutable = prompt;
                                mutable[key] = value;
                            }
                        }
                    }
                    if (body.order !== undefined) {
                        const ids = body.order;
                        if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !preset.prompts.some(p => p.identifier === id)))
                            throw Error('提示条目顺序无效');
                        const before = new Map((preset.promptOrder.length ? preset.promptOrder
                            : preset.prompts.filter(prompt => !prompt.unused)).map(row => [row.identifier, row.enabled]));
                        preset.promptOrder = ids.map(identifier => ({ identifier, enabled: before.get(identifier) ?? false }));
                        for (const prompt of preset.prompts)
                            prompt.unused = !ids.includes(prompt.identifier);
                    }
                    break;
                }
                case 'delete': {
                    const preset = found();
                    if (state.global.presetId === preset.id || Object.values(state.conversations).some(s => s.presetId === preset.id))
                        throw Error('预设仍被使用，请先停用或切换');
                    state.presets = state.presets.filter(p => p.id !== preset.id);
                    delete state.planPacks[preset.id];
                    state.regexes = state.regexes.filter(r => r.binding.scope !== 'preset' || r.binding.id !== preset.id);
                    break;
                }
                case 'select': {
                    const next = selection(body.selection, state);
                    if (scope === 'global')
                        state.global = next;
                    else
                        state.conversations[rootOf(sessionId)] = next;
                    break;
                }
                case 'configure': {
                    const current = scopeSelection(state, sessionId, scope);
                    Object.assign(current, selection({ ...current, ...object(body.patch) }, state));
                    break;
                }
                case 'inherit':
                    delete state.conversations[rootOf(sessionId)];
                    break;
                case 'import-plans': {
                    const preset = found(), pack = parseCommunityIzumiPlanPack(body.data ?? JSON.parse(text(body.rawText)));
                    const prior = state.planPacks[preset.id];
                    if (prior) {
                        const merged = new Map(prior.plans.map(plan => [plan.id, plan]));
                        for (const plan of pack.plans) {
                            if (!merged.has(plan.id)) {
                                const name = plan.name;
                                let suffix = 2;
                                while ([...merged.values()].some(p => p.name === plan.name))
                                    plan.name = `${name} (${suffix++})`;
                            }
                            merged.set(plan.id, plan);
                        }
                        pack.plans = [...merged.values()];
                    }
                    state.planPacks[preset.id] = pack;
                    break;
                }
                case 'apply-plans': {
                    const preset = found(), pack = state.planPacks[preset.id];
                    if (!pack)
                        throw Error('请先导入方案包');
                    const current = scopeSelection(state, sessionId, scope);
                    const { applied } = preparedPlans(state, sessionId, scope, preset, body.planIds);
                    current.presetId = preset.id;
                    current.prompts = Object.fromEntries(applied.preset.prompts.map(p => [p.identifier, p.enabled]));
                    current.regexes = Object.fromEntries(applied.preset.regexes.map(r => [r.id, !r.disabled]));
                    result = { applied: applied.applied, unresolved: applied.unresolved };
                    break;
                }
                case 'save-plan': {
                    const preset = found(), current = scopeSelection(state, sessionId, scope);
                    const layer = text(body.layer) || 'function', section = text(body.section);
                    if (!['structure', 'function', 'style'].includes(layer))
                        throw Error('方案层无效');
                    const entries = preset.prompts.filter(p => p.layer === layer && (!section || p.section === section)).map(prompt => ({
                        id: prompt.identifier, name: prompt.name, sameNameIndex: preset.prompts.filter(p => p.name === prompt.name).indexOf(prompt),
                        enabled: current.prompts[prompt.identifier] ?? prompt.enabled, raw: {}
                    }));
                    const pack = state.planPacks[preset.id] ?? parseCommunityIzumiPlanPack({ schema: 'izumi-layer-plan-pack', version: 2, plans: [], active: {}, quickSlots: [] });
                    const id = randomUUID();
                    pack.plans.push({ id, name: text(body.name) || '新方案', layer: layer, section,
                        strict: body.strict !== false, entries, raw: {} });
                    state.planPacks[preset.id] = pack;
                    result = { savedPlanId: id };
                    break;
                }
                case 'control': {
                    const preset = found(), current = scopeSelection(state, sessionId, scope);
                    const effective = copy(preset);
                    for (const prompt of effective.prompts) {
                        prompt.enabled = current.prompts[prompt.identifier] ?? prompt.enabled;
                        prompt.content = current.contents[prompt.identifier] ?? prompt.content;
                    }
                    await resolveCommunityPresetControls(effective);
                    const applied = applyCommunityPresetControl(effective, { groupId: text(body.groupId), optionId: text(body.optionId),
                        enabled: body.enabled === true, value: body.value, answers: body.answers });
                    current.presetId = preset.id;
                    current.prompts = Object.fromEntries(applied.preset.prompts.map(prompt => [prompt.identifier, prompt.enabled]));
                    current.regexes = Object.fromEntries(applied.preset.regexes.map(rule => [rule.id, !rule.disabled]));
                    // Generated configurable prompts have one library identity, while
                    // their parameter values stay with the chosen scope.
                    for (const changed of applied.preset.prompts) {
                        const stored = preset.prompts.find(prompt => prompt.identifier === changed.identifier);
                        const before = effective.prompts.find(prompt => prompt.identifier === changed.identifier);
                        if (stored) {
                            if (changed.content !== before?.content)
                                current.contents[changed.identifier] = changed.content;
                        }
                        else {
                            preset.prompts.push({ ...changed, content: '', enabled: false });
                            const appliedIndex = applied.preset.promptOrder.findIndex(row => row.identifier === changed.identifier);
                            const nextId = applied.preset.promptOrder.slice(appliedIndex + 1).find(row => preset.promptOrder.some(old => old.identifier === row.identifier))?.identifier;
                            const at = nextId ? preset.promptOrder.findIndex(row => row.identifier === nextId) : preset.promptOrder.length;
                            preset.promptOrder.splice(at, 0, { identifier: changed.identifier, enabled: false });
                            current.contents[changed.identifier] = changed.content;
                        }
                    }
                    if (applied.writes.length)
                        state.configurationWrites.push({ id: randomUUID(), presetId: preset.id,
                            conversationId: scope === 'global' ? null : rootOf(sessionId), writes: applied.writes });
                    result = { unresolved: applied.unresolved };
                    break;
                }
                default: throw Error('未知社区预设操作');
            }
            callerCurrent?.();
            if (['import', 'copy', 'select', 'update', 'profile', 'control'].includes(String(body.action))) {
                const selected = body.action === 'select' ? scopeSelection(state, sessionId, scope).presetId : undefined;
                const target = state.presets.find(preset => preset.id === (selected ?? result.importedId ?? body.presetId));
                if (target)
                    await resolveCommunityPresetControls(target, body.action === 'import');
            }
            state.revision++;
            await table.put(COMMUNITY_PRESETS_KEY, state);
            return { ...policy(sessionId), ...result };
        });
    }
    async function mutateRegex(sessionId, value, callerCurrent) {
        const body = object(value);
        return withTavernLock(table, COMMUNITY_PRESETS_KEY, async () => {
            const state = read();
            if (body.expectedRevision !== state.revision)
                throw Error('正则库已更新，请刷新后重试');
            if (body.action === 'import') {
                const bindingScope = body.bindingScope === 'preset' ? 'preset' : body.bindingScope === 'global' ? 'global' : 'conversation';
                const id = bindingScope === 'preset' ? text(body.presetId) : bindingScope === 'conversation' ? rootOf(sessionId) : null;
                if (bindingScope === 'preset' && !state.presets.some(p => p.id === id))
                    throw Error('绑定预设不存在');
                state.regexes.push({ id: `regex-${randomUUID()}`, name: text(body.name) || text(body.fileName) || '导入正则',
                    rules: normalizeCommunityRegexes(body.data ?? JSON.parse(text(body.rawText))), binding: { scope: bindingScope, id } });
            }
            else {
                const item = state.regexes.find(r => r.id === body.id);
                if (!item)
                    throw Error('正则不存在');
                if (body.action === 'delete')
                    state.regexes = state.regexes.filter(r => r.id !== item.id);
                else if (body.action === 'update') {
                    if (body.name !== undefined)
                        item.name = text(body.name);
                    if (body.rules !== undefined)
                        item.rules = normalizeCommunityRegexes(body.rules);
                    if (body.bindingScope !== undefined) {
                        const bindingScope = body.bindingScope === 'preset' ? 'preset' : body.bindingScope === 'global' ? 'global' : 'conversation';
                        const id = bindingScope === 'preset' ? text(body.presetId) : bindingScope === 'conversation' ? rootOf(sessionId) : null;
                        if (bindingScope === 'preset' && !state.presets.some(p => p.id === id))
                            throw Error('绑定预设不存在');
                        item.binding = { scope: bindingScope, id };
                    }
                }
                else
                    throw Error('未知正则操作');
            }
            callerCurrent?.();
            state.revision++;
            await table.put(COMMUNITY_PRESETS_KEY, state);
            return policy(sessionId);
        });
    }
    async function ensureControls(sessionId, presetId) {
        const pending = (state) => {
            const id = presetId ?? (state?.conversations[rootOf(sessionId)] ?? state?.global)?.presetId;
            const preset = state?.presets.find(preset => preset.id === id);
            return preset?.profile.groups.some(group => group.options.some(option => option.match
                && typeof option.raw.resolvedRangeBasis !== 'string')) ? preset : undefined;
        };
        // Ordinary reads consume the published range. Only a legacy record without
        // that publication enters the existing writer lock and gets migrated once.
        if (!pending(table.get(COMMUNITY_PRESETS_KEY)))
            return;
        await withTavernLock(table, COMMUNITY_PRESETS_KEY, async () => {
            const state = read(), preset = pending(state);
            if (!preset)
                return;
            await resolveCommunityPresetControls(preset);
            state.revision++;
            await table.put(COMMUNITY_PRESETS_KEY, state);
        });
    }
    return { read, policy, readonlyPreset, ejsPreset, readonlyGlobalRegexes, mutate, mutateRegex, ensureControls, configurations(sessionId, presetId) {
            const conversationId = rootOf(sessionId);
            return read().configurationWrites.filter(row => row.presetId === presetId).map(row => ({ ...row,
                writes: row.writes.filter(write => write.scope === 'global' || row.conversationId === null || row.conversationId === conversationId) }));
        }, summary(sessionId) {
            const value = policy(sessionId);
            return { revision: value.revision, fingerprint: value.fingerprint, presetId: value.preset?.id ?? null,
                name: value.preset?.name ?? null, regexes: value.regexes.length + (value.preset?.regexes.length ?? 0) };
        }, previewPlans(sessionId, presetId, planIds, scope = 'conversation') {
            const state = read(), preset = state.presets.find(p => p.id === presetId);
            if (!preset)
                throw Error('社区预设不存在');
            const { effective, applied } = preparedPlans(state, sessionId, scope, preset, planIds);
            return { changed: applied.preset.prompts.filter((prompt, index) => prompt.enabled !== effective.prompts[index]?.enabled)
                    .map(prompt => ({ identifier: prompt.identifier, name: prompt.name, before: effective.prompts.find(p => p.identifier === prompt.identifier)?.enabled,
                    after: prompt.enabled })), unresolved: applied.unresolved };
        }, exportPreset(id) { const preset = read().presets.find(p => p.id === id); if (!preset)
            throw Error('社区预设不存在'); return exportPreset(preset); } };
}
