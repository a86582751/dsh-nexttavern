// Generated from runtime/alpha3/src/memory/memory-summary.ts; edit the TypeScript source.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const SUMMARY_SYSTEM = '你是角色扮演工作台的记忆整理员。基于既有记忆与待归档的原文区间，生成增量记忆摘要。' +
    '**核心原则：详细保留，不以节约 tokens 为目的。目标是让 AI 拿到尽可能充分的故事信息，同时避免原文阻塞注意力窗口。**' +
    '\n输出 Markdown，严格按以下 8 段组织，缺失内容写「无」：' +
    '\n1. 用户锁定的剧情事实（必须一字不差地保留下方给定的用户锁定事实；这里不收录角色卡或世界书）' +
    '\n2. 主角与用户边界（用户明确表达的偏好、底线、纠正）' +
    '\n3. 角色簿（**详细记录**：姓名/别名/身份/外貌特征/穿搭细节/性格特质/口吻习惯/能力/动机/秘密/恐惧/软肋/目标/行为模式）' +
    '\n4. 关系图（**详细记录关系演变**：有向关系类型/当前阶段/关键亲密节点/冲突与和解/嫉妒/秘密/承诺/未来约定 + 变化的具体证据与台词）' +
    '\n5. 世界规则（**完整保留设定**：现实/平行边界、国家体制、城市地理、学校/组织架构、技术水平、经济政治规则、魔法/超能力系统、公开与秘密状态）' +
    '\n6. 时间线与剧情账本（**详细剧情脉络**：精确日期/学期进度/地点转换/天气/在场人物/事件触发条件/行动细节/结果/长期后果/伏笔/已兑现与未兑现约定）' +
    '\n7. 当前场景快照（**当前状态快照**：精确位置/每个角色的服装状态/道具持有/身体状态/情绪细节/进行中动作/环境氛围）' +
    '\n8. 核心矛盾、伏笔、未解决问题、用户否定过的分支、待确认事项（**保留所有伏笔与未解决线索**）' +
    '\n**记录要求**：' +
    '\n- 每条信息末尾附 (seq:来源序号)' +
    '\n- 保留专名、数字、具体地点、先后顺序、因果链、关键台词与用户明确更正' +
    '\n- 剧情细节优先：人物重要行为、关系变化、势力动向、新增设定等全部详细记录' +
    '\n- 一次性描写不得升级为永久规则' +
    '\n- 宁可详细，不可精简：目标是高质量长流程 RP，不是节约 tokens' +
    '\n- 只整理剧情。不得把角色卡、世界书、叙事规则、状态栏模板、工具输出或后台提示复制进摘要；这些材料由独立存储按需注入';
export function validateDetailedSummary(summary, sourceText, lockedFacts) {
    const text = String(summary ?? '').trim();
    for (let section = 1; section <= 8; section += 1) {
        const heading = new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${section}[.、．]\\s*`, 'm');
        if (!heading.test(text))
            throw new Error(`记忆摘要缺少第 ${section} 段，未提交不完整结果`);
    }
    for (const raw of lockedFacts) {
        const fact = typeof raw === 'string' ? raw : String(object(raw) ? raw.text ?? '' : '');
        if (fact && !text.includes(fact)) {
            throw new Error(`记忆摘要遗漏用户锁定事实，未提交：${fact.slice(0, 120)}`);
        }
    }
    if (String(sourceText ?? '').length >= 20000) {
        const minimumChars = Math.min(12000, Math.floor(String(sourceText).length * 0.05));
        if (text.length < minimumChars) {
            throw new Error(`记忆摘要过度压缩（${text.length} < ${minimumChars} 字符），未提交低保真结果`);
        }
    }
}
async function summarize(ctx, { session, system, user, maxTokens, timeoutMs, signal, validate, taskStage, background = false, sourceSeqs, }) {
    // Resolve on each request: the roleplay service may mount later or reload.
    const engine = ctx.get('roleplay');
    if (!engine?.nativeTask)
        throw new Error('原生酒馆任务服务尚未就绪');
    const assertCombined = value => {
        if (!object(value) || typeof value.text !== 'string' || !Array.isArray(value.deltas) || !Array.isArray(value.conflicts))
            throw new Error('后台记忆需要笔记、正史增量和冲突数组');
        validate(value.text);
        for (const item of value.deltas) {
            if (!object(item) || typeof item.summary !== 'string' || !item.summary.trim() || (item.status !== 'established' && item.status !== 'uncertain') || !Number.isSafeInteger(item.evidenceSeq))
                throw new Error('正史增量格式无效');
        }
        for (const item of value.conflicts) {
            if (!object(item) || typeof item.claim !== 'string' || typeof item.canon !== 'string' || (item.severity !== 'low' && item.severity !== 'medium' && item.severity !== 'high') || !Number.isSafeInteger(item.evidenceSeq))
                throw new Error('连续性记录格式无效');
        }
        const allowed = new Set(sourceSeqs ?? []);
        for (const items of [value.deltas, value.conflicts]) {
            for (const item of items)
                if (!allowed.has(item.evidenceSeq))
                    throw new Error('后台记忆引用了本批次以外的来源');
        }
    };
    const validateCombined = (value) => {
        assertCombined(value);
        return value;
    };
    let actualRoute;
    const result = await engine.nativeTask({
        session, system, user, kind: 'memory', format: background ? 'json' : 'text', maxTokens, timeoutMs, signal,
        validate: background ? validateCombined : validate, taskStage, background,
        onResult: job => {
            const route = job.actualRoute;
            if (route && !object(route))
                throw new Error('记忆任务返回的模型路由无效');
            actualRoute = object(route) ? { ...route } : undefined;
        },
    });
    // Recheck the returned boundary even when a service skips its validator.
    // This performs no retry or additional model request.
    const combined = background ? validateCombined(result) : undefined;
    const text = combined ? combined.text : validate(result);
    const summary = [{ type: 'text', text }];
    return { text, summary, rawOutput: summary, execution: 'native-task', actualRoute,
        ...(combined ? { deltas: combined.deltas, conflicts: combined.conflicts } : {}) };
}
export function createMemorySummarizer(ctx) {
    async function summarizeDetailed({ session, previousSummary, sourceText, lockedText, maxTokens, timeoutMs, signal, taskStage = 'notes', appendDelta = false, background = false, sourceSeqs }) {
        // A native task may span several loop steps. Its checkpoint and sources
        // remain durable; do not mislabel it as a direct llm.stream replay.
        return summarize(ctx, {
            session,
            system: SUMMARY_SYSTEM + (background
                ? '\n本次将导演笔记、正史增量与连续性核对合并为一个后台任务。仅返回 JSON 对象：{"text":"完整八段 Markdown 笔记","deltas":[{"evidenceSeq":原文seq,"summary":"已发生事实","status":"established或uncertain"}],"conflicts":[{"evidenceSeq":原文seq,"claim":"新说法","canon":"既有记录","severity":"low或medium或high"}]}。text 保留完整细节；deltas 只列新增事实，conflicts 只列有来源支持的矛盾，不把未知情况当冲突。没有增量或冲突时对应数组为空。'
                : '') + (appendDelta
                ? '\n本任务是导演笔记的追加更新：仅输出本次新增或更正，不重写既有笔记。仍按八段输出，只填新增信息，无变化的段落写「无」。既有笔记由后端逐字保留；锁定事实也由后端保留，不需重复输出。状态变化必须说明原状态、现状态与发生顺序；明确更正必须指出被纠正的旧说法及新证据。保留新增剧情全部条件、细节和台词，不以简短为目标。不要删除、概括或重新抄写旧事件。'
                : ''),
            user: (appendDelta
                ? '请根据既有笔记核对本次新增剧情，只返回本次追加记录。后端按来源顺序追加，最新有证据的更正与状态变化优先于旧快照；旧事实并不因此全部失效。'
                :
                    '请把「既有剧情记忆」与「本次新增的连续剧情原文」做增量合并。既有条目除非被新原文明确纠正，否则不得删除；新原文中的独有细节必须逐项加入。' +
                        '\n不要续写，不要把后台材料当剧情，不要为了变短而合并不同事件。') +
                `\n\n## 既有剧情记忆\n${previousSummary || '（首次整理）'}` +
                `\n\n## 本次新增剧情原文\n${sourceText}` +
                `\n\n## 用户显式锁定的剧情事实（逐字保留）\n${lockedText || '（无）'}`,
            maxTokens,
            timeoutMs,
            signal,
            taskStage,
            background,
            sourceSeqs,
            validate: text => {
                if (typeof text !== 'string')
                    throw new Error('记忆摘要结果必须为文本');
                validateDetailedSummary(text, sourceText, !appendDelta && lockedText ? [lockedText] : []);
                return text;
            },
        });
    }
    return summarizeDetailed;
}
