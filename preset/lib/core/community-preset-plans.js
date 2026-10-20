// Generated from runtime/alpha3/src/core/community-preset-plans.ts; edit the TypeScript source.
const obj = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' ? value : '';
const nameKey = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const linkageKey = (value) => nameKey(value).replace(/[\uFE0E\uFE0F]/g, '').replace(/\s+/g, '')
    .replace(/^[^0-9A-Za-z一-鿿]+/u, '').toLowerCase();
const layerOf = (value) => value === 'tail' ? 'structure' : value === 'structure' || value === 'function' || value === 'style' ? value : undefined;
const sectionOf = (value) => ['plain', 'tail', 'armor', 'tucao', 'thinking', 'extra'].includes(text(value)) ? value : undefined;
/** Explicit author pins win. Named section boundaries then establish a contiguous
 * region; content tags classify unpinned prompts before descriptive names do. */
export function annotateCommunityIzumiPrompts(prompts, order) {
    const positions = new Map(order.map((item, index) => [item.identifier, index]));
    const sorted = [...prompts].sort((a, b) => (positions.get(a.identifier) ?? Infinity) - (positions.get(b.identifier) ?? Infinity));
    let region, section;
    for (const prompt of sorted) {
        const extra = obj(prompt.raw.extra), name = nameKey(prompt.name), body = prompt.content.replace(/\{\{\/\/[\s\S]*?\}\}/g, '').trim();
        const explicitLayer = prompt.raw.izumi_layer ?? extra.izumi_layer ?? prompt.raw.layer;
        const explicitSection = sectionOf(prompt.raw.izumi_function_section ?? extra.izumi_function_section);
        let starts, ends = false;
        if (/↓四选一开↓/.test(name))
            starts = 'tucao';
        else if (/↑必开其一↑/.test(name))
            ends = section === 'tucao';
        else if (/思维链开始/.test(name))
            starts = 'thinking';
        else if (/思维链结束/.test(name))
            ends = section === 'thinking';
        else if (/破甲加强区/.test(name)) {
            if (section === 'armor')
                ends = true;
            else
                starts = 'armor';
        }
        if (starts)
            section = starts;
        if (/可选功能(?:开始|区域开始)|功能(?:模块)?开始/.test(name))
            region = 'function';
        if (/文风(?:开始|区域开始)/.test(name))
            region = 'style';
        const pinnedTail = ['基米flash破甲1', '基米flash尾部1', '短对话模式'].some(value => linkageKey(name) === linkageKey(value));
        const pinnedThinking = /思维链语言[-－—]/.test(name);
        const resolvedSection = explicitSection ?? (explicitLayer === 'tail' ? 'tail' : undefined)
            ?? (pinnedTail ? 'tail' : pinnedThinking ? 'thinking' : layerOf(explicitLayer) ? undefined : section);
        let layer = layerOf(explicitLayer);
        if (resolvedSection && resolvedSection !== 'plain' && resolvedSection !== 'extra') {
            layer = resolvedSection === 'tail' || resolvedSection === 'armor' ? 'structure' : 'function';
        }
        if (!layer) {
            if (/^<(?:writing_style|tone|narrative_style)\b|^\[(?:writing\s*style|style)\]/i.test(body))
                layer = 'style';
            else if (/^<(?:konatan_planning|summary|summary_format|output_format|tucao_cot|tucao_format|chain_of_thought|options|disclaimer)\b/i.test(body)) {
                layer = 'structure';
                prompt.section = 'tail';
            }
            else if (/^<\/?(?:main_task|identity_isolation|izumikonata|basic_[^>]+|user|character|history|information|context|world|system|role|admin)\b/i.test(body)
                || prompt.marker)
                layer = 'structure';
            else if (/^<(?:narrative_config|characterization_settings|text_constraints|front_end|mvu|updatevariable|ban|difficulty_mode|dialogue|total_settings)\b/i.test(body))
                layer = 'function';
            else if (region)
                layer = region;
            else if (/文风|写作风格|语言风格|叙事风格/.test(name + ' ' + body.slice(0, 180)))
                layer = 'style';
            else if (/思维链|预填充|输出格式|摘要|总结|尾部/.test(name)) {
                layer = 'structure';
                prompt.section = 'tail';
            }
            else if (/功能|适配|防|禁止|抢话|转述|剧情|字数|变量|NSFW|MVU/i.test(name + ' ' + body.slice(0, 120)))
                layer = 'function';
            else
                layer = 'structure';
        }
        prompt.layer = layer;
        prompt.section = resolvedSection ?? prompt.section ?? 'plain';
        if (starts || ends)
            prompt.sectionBoundary = true;
        if (ends)
            section = undefined;
        if (/文风(?:结束|区域结束)|可选功能(?:结束|区域结束)|功能(?:模块)?结束/.test(name))
            region = undefined;
    }
}
export function parseCommunityIzumiPlanPack(input) {
    const raw = obj(input);
    if (raw.schema !== 'izumi-layer-plan-pack' || raw.version !== 2 || !Array.isArray(raw.plans)) {
        throw Error('需要 izumi-layer-plan-pack v2 小方案包');
    }
    const plans = raw.plans.map(value => {
        const plan = obj(value), layer = layerOf(plan.layer);
        if (!layer)
            throw Error('小方案缺少有效层');
        return { id: text(plan.id), name: text(plan.name), layer, section: plan.layer === 'tail' ? 'tail' : text(plan.section),
            strict: plan.strict === true, entries: list(plan.entries).map(value => {
                const raw = obj(value);
                return { id: text(raw.id) || undefined, name: text(raw.name) || undefined,
                    sameNameIndex: typeof raw.sameNameIndex === 'number' ? raw.sameNameIndex : 0, enabled: raw.enabled !== false, raw };
            }), raw: plan };
    });
    return { schema: 'izumi-layer-plan-pack', version: 2, plans, active: obj(raw.active), quickSlots: list(raw.quickSlots), raw };
}
export function applyCommunityIzumiPlans(preset, plans, options = {}) {
    const next = structuredClone(preset), unresolved = [], applied = [];
    const byId = new Map(next.prompts.map(prompt => [prompt.identifier, prompt]));
    const byName = new Map();
    for (const prompt of next.prompts) {
        const key = nameKey(prompt.name), twins = byName.get(key) ?? [];
        twins.push(prompt);
        byName.set(key, twins);
    }
    const conflicts = [['抢话', '防抢话'], ['转述', '防转述'], ['摘要-ny', '新摘要']];
    const enable = (target, value) => {
        target.enabled = value;
        if (!value)
            return;
        const targetKey = linkageKey(target.name);
        for (const group of conflicts) {
            if (!group.includes(targetKey) && !(targetKey === 'ny-摘要' && group[0] === '摘要-ny'))
                continue;
            for (const other of next.prompts) {
                if (other !== target && (group.includes(linkageKey(other.name))
                    || (group[0] === '摘要-ny' && linkageKey(other.name) === 'ny-摘要')))
                    other.enabled = false;
            }
        }
    };
    for (const plan of plans) {
        const touched = new Set();
        for (const entry of plan.entries) {
            const twins = byName.get(nameKey(entry.name ?? ''));
            const target = (entry.id ? byId.get(entry.id) : undefined) ?? twins?.[entry.sameNameIndex] ?? (twins?.length === 1 ? twins[0] : undefined);
            if (!target) {
                unresolved.push(entry);
                continue;
            }
            touched.add(target);
            enable(target, entry.enabled);
        }
        if (plan.strict) {
            for (const prompt of next.prompts) {
                if (prompt.layer === plan.layer && (!plan.section || prompt.section === plan.section) && !prompt.sectionBoundary && !touched.has(prompt))
                    enable(prompt, false);
            }
        }
        applied.push(plan.id);
    }
    const tucao = next.prompts.filter(prompt => prompt.section === 'tucao' && !prompt.sectionBoundary);
    if (tucao.length && !tucao.some(prompt => prompt.enabled))
        throw Error('吐槽区至少需要开启一项');
    for (const order of next.promptOrder) {
        const prompt = byId.get(order.identifier);
        if (prompt)
            order.enabled = prompt.enabled;
    }
    const enabledSummaries = next.prompts.filter(prompt => prompt.enabled).map(prompt => linkageKey(prompt.name));
    const summary = enabledSummaries.includes('新摘要') ? 'new' : enabledSummaries.some(name => name === '摘要-ny' || name === 'ny-摘要') ? 'ny' : '';
    const night = options.night ?? next.regexes.some(rule => !rule.disabled && linkageKey(rule.scriptName) === '0夜间美化状态栏');
    const eventVariant = night ? '12美化事件(夜间-护眼版)' : '12美化事件';
    const hasEventVariant = next.regexes.some(rule => linkageKey(rule.scriptName) === eventVariant);
    for (const regex of next.regexes) {
        const name = linkageKey(regex.scriptName);
        if (['9保留progress', '9只保留progress(11楼后)', '10隐藏progress', '10隐藏近期旧progress(4-10楼)', '11清理多余事件'].includes(name))
            regex.disabled = summary !== 'new';
        if (['5摘要其一', '6摘要其二'].includes(name))
            regex.disabled = summary !== 'ny';
        if (['12美化事件', '12美化事件(夜间-护眼版)'].includes(name)) {
            if (summary === 'ny')
                regex.disabled = true;
            else if (hasEventVariant)
                regex.disabled = name !== eventVariant;
        }
    }
    return { preset: next, applied, unresolved };
}
