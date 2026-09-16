import { keyOf, estimateTokens, recordSha256, readUserInfo } from './roleplay-data.js'
import { boundedRegexMatch, worldbookRegex } from './bounded-regex.js'
import type { WorldbookRegex } from './bounded-regex.js'
import { createStableRoleplayFence, promptSafeAuthorText } from './roleplay-context.js'
import { statusAuthorRules } from '../status-template.js'
import { cardContentText } from './tavern-card.js'
import type { AuthorRecord, AuthorTable, AuthorTables, AuthorMemory, AuthorScene, AuthorDependency, DecisionContextInput, AuthorPromptDependencies } from './roleplay-author-context-types.js'

export function renderWorldbookEntry(e: AuthorRecord) {
  const lines = []
  lines.push(`【${e.name ?? e.id}】(id: ${e.id}, 类型: ${e.kind ?? 'term'}, 优先级: ${e.priority ?? 0}${e.locked ? ', 锁定' : ''})`)
  if (Array.isArray(e.aliases) && e.aliases.length) lines.push(`别名：${e.aliases.join('、')}`)
  if (Array.isArray(e.keywords) && e.keywords.length) lines.push(`关键词：${e.keywords.join('、')}`)
  if (e.content) lines.push(e.content)
  return lines.join('\n')
}

export async function retrieveWorldbook(T: Pick<AuthorTables, 'worldbook'>, branchId: string, userText: string, scene: AuthorScene | null | undefined, budgetTokens: number) {
  const prefix = `${branchId}__`
  const entries = []
  for (const [k, v] of T.worldbook.entries()) {
    if (!k.startsWith(prefix) || !v || v.enabled === false) continue
    entries.push(v)
  }
  const scenePlace = scene?.place ?? ''
  const present = Array.isArray(scene?.present) ? scene.present.join(' ') : ''
  // The model derives a query from director notes and the current request.
  // Old transcript mentions never keep a database entry permanently active.
  const originalHay = `${userText} ${scenePlace} ${present}`
  const hay = originalHay.toLowerCase()
  const requests: WorldbookRegex[] = [], requestIds = new Map<string | undefined, number[]>()
  for (const e of entries) {
    if (!e.tavern?.useRegex) continue
    const indices = []
    for (const key of [...(e.keywords ?? []), ...(e.tavern.secondaryKeys ?? [])]) {
      indices.push(requests.length); requests.push(worldbookRegex(key,e.tavern.caseSensitive))
    }
    requestIds.set(e.id,indices)
  }
  const regex = await boundedRegexMatch(requests,originalHay.slice(-32768))
  const scored = []
  for (const e of entries) {
    let score = 0
    const reasons = []
    if (e.tavern) {
      const primary = e.keywords ?? [], secondary = e.tavern.secondaryKeys ?? []
      const values = e.tavern.useRegex
        ? (requestIds.get(e.id) ?? []).map(i => regex.ok && regex.matches[i] === true)
        : [...primary,...secondary].map(key => e.tavern!.caseSensitive ? originalHay.includes(key) : hay.includes(key.toLowerCase()))
      const hit = values.slice(0,primary.length).some(Boolean)
        && (!e.tavern.selective || values.slice(primary.length).some(Boolean))
      if (!hit) continue
    }
    const names = e.tavern ? [] : [e.name, ...(e.aliases ?? []), ...(e.keywords ?? []), ...(e.triggers ?? [])]
    if (e.tavern) {score += 200; reasons.push('card-keys')}
    for (const n of names) {
      if (!n) continue
      if (hay.includes(String(n).toLowerCase())) {
        score += 200
        reasons.push(`命中:${n}`)
      }
    }
    if (score <= 0) continue
    const rendered = renderWorldbookEntry(e)
    scored.push({
      e,
      rendered,
      score,
      reasons: [...new Set(reasons)].slice(0, 4),
      // tokenBudget 是作者的上限提示，不可把任意长正文固定算成 400/500。
      budgetTokens: Math.max(estimateTokens(rendered), Number(e.tokenBudget) > 0 ? Number(e.tokenBudget) : 0),
    })
  }
  scored.sort(
    (a, b) =>
      (Number(b.e.priority) ?? 0) - (Number(a.e.priority) ?? 0) ||
      b.score - a.score
  )
  const picked = []
  let used = 0
  for (const s of scored) {
    if (used + s.budgetTokens > budgetTokens) continue
    used += s.budgetTokens
    picked.push(s)
  }
  return {
    entries: picked.map((s) => ({
      id: s.e.id,
      name: s.e.name,
      kind: s.e.kind,
      version: s.e.version,
      priority: s.e.priority,
      locked: s.e.locked === true,
      score: s.score,
      reasons: s.reasons,
    })),
    text: picked.map((s) => s.rendered).join('\n\n'),
    usedTokens: used,
    regexStatus: regex.ok ? 'ready' : regex.reason,
  }
}

const dependencyValue=(record: AuthorRecord | null | undefined,fields?: string[]): Record<string, unknown> | null=>fields ? Object.fromEntries(fields.map(field=>[field,record?.[field]??null])) : record??null
export function taskDependenciesCurrent(T: AuthorTables,branchId: string,dependencies: readonly AuthorDependency[]=[]) {
  return dependencies.every(d=>['cards','rules','worldbook'].includes(d.table)&&d.key.startsWith(`${branchId}__`)
    && recordSha256(dependencyValue(T[d.table].get(d.key),d.fields))===d.hash)
}
export async function buildDecisionContext(T: AuthorTables,branchId: string,{narrative,userText,scene,directorNotes,memory,budgetTokens=6000}: DecisionContextInput) {
  const frozen={} as Record<keyof AuthorTables, Map<string, AuthorRecord>>
  const prefix=`${branchId}__`
  for(const table of ['cards','rules','worldbook'] as const){
    const records=new Map<string, AuthorRecord>()
    for(const [key,value] of T[table].entries())if(key.startsWith(prefix))records.set(key,structuredClone(value))
    frozen[table]=records
  }
  const dependencies: AuthorDependency[]=[]
  const read=(table: keyof AuthorTables,key: string,fields?: string[])=>{
    const value=dependencyValue(frozen[table].get(key),fields)
    dependencies.push({table,key,fields,hash:recordSha256(value)})
    return value
  }
  const characters=[...frozen.cards.keys()].filter(key=>key.startsWith(`${branchId}__`))
    .map(key=>read('cards',key,['id','name','kind','content']))
  const rules=read('rules',keyOf(branchId,'spec'),['core','plot'])
  // Search inside the owning branch before spawning. Children cannot escape
  // their frozen scope by using a parent session's arbitrary storage tools.
  const lore=await retrieveWorldbook(frozen,branchId,`${userText??''}\n${narrative}\n${directorNotes??memory?.summary??''}`,scene,budgetTokens)
  for(const entry of lore.entries)read('worldbook',keyOf(branchId,entry.id!))
  return {dependencies,context:{userAction:userText??'',narrative,scene:scene??{},characters,
    core:rules!.core,possiblePlotGuidance:rules!.plot,directorNotes:directorNotes??memory?.summary??'',
    worldbook:{text:lore.text,entries:lore.entries,usedTokens:lore.usedTokens,regexStatus:lore.regexStatus}}}
}

// ── 锁定事实 / 角色卡渲染 ────────────────────────────────────────────────────

export function lockedFactsOf(T: {cards: Pick<AuthorTable, 'entries'>; worldbook: Pick<AuthorTable, 'entries'>; memory: Pick<AuthorTable<AuthorMemory>, 'get'>}, branchId: string) {
  const prefix = `${branchId}__`
  const facts = []
  for (const [k, v] of T.cards.entries()) {
    if (!k.startsWith(prefix) || !v) continue
    if (v.locked === true && v.content) facts.push({ source: `card:${v.id}`, text: v.content })
  }
  for (const [k, v] of T.worldbook.entries()) {
    if (!k.startsWith(prefix) || !v) continue
    if (v.enabled !== false && v.locked === true && v.content) facts.push({ source: `worldbook:${v.id}`, text: v.content })
  }
  const mem = T.memory.get(keyOf(branchId, 'head'))
  if (mem && Array.isArray(mem.lockedFacts)) {
    for (const f of mem.lockedFacts) facts.push({ source: 'memory-locked', text: typeof f === 'string' ? f : f?.text ?? '' })
  }
  return facts.filter((f) => f.text)
}

export function renderCards(T: Pick<AuthorTables, 'cards'>, branchId: string) {
  const prefix = `${branchId}__`
  const parts = []
  // Storage hydration order can differ from live writes. Stable identities,
  // not Map insertion order, determine the unchanged author prompt prefix.
  for (const [k, v] of [...T.cards.entries()].filter(([key])=>key.startsWith(prefix)).sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    if (!k.startsWith(prefix) || !v) continue
    const lines = []
    lines.push(`## 角色卡：${v.name ?? v.id}${v.kind === 'user' ? '（玩家角色 {{user}}）' : v.kind === 'npc' ? '（NPC）' : ''}`)
    if (v.content) lines.push(v.content)
    if (v.locked === true) lines.push('（本卡含锁定事实）')
    parts.push(lines.join('\n'))
  }
  return parts.join('\n\n')
}

/** Revision of reusable resident facts, excluding source archives and passive lore. */
export function residentAuthorContext(T: AuthorTables,branchId:string) {
  const rules=T.rules.get(keyOf(branchId,'spec'))
  const pinned=[...T.worldbook.entries()].filter(([key,v])=>key.startsWith(`${branchId}__`)&&v?.enabled!==false&&v?.alwaysOn===true)
    .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>renderWorldbookEntry(v))
  const parts=[{section:'roleplay:cards',name:'roleplay:cards',text:renderCards(T,branchId)},
    {section:'roleplay:rules',name:'roleplay:rules / 核心设定',text:String(rules?.core??'')},
    {section:'roleplay:rules',name:'roleplay:rules / 剧情指引',text:String(rules?.plot??'')},
    ...pinned.map((text,index)=>({section:'roleplay:rules',name:`roleplay:rules / 常驻世界书 ${index+1}`,text}))].filter(part=>part.text)
  return {revision:recordSha256(parts),parts:parts.map(part=>({...part,renderedText:cardContentText(promptSafeAuthorText(part.text))}))}
}

export function authorUserValues(T: Pick<AuthorTables, 'cards'>, branchId: string | undefined, textAlias: (record: Record<string, unknown>, names: string[]) => string) {
    const info = (readUserInfo() ?? {}) as Record<string, unknown>
    const card = T.cards.get(keyOf(branchId!, 'user')) ?? {}
    return {
      name: textAlias(info, ['name', 'user', 'displayName']) || textAlias(card, ['name', 'title']) || '用户',
      gender: textAlias(info, ['gender', 'sex']),
    }
  }

export function registerAuthorPrompts({ctx, T, isRoleplaySession, userValues, characterCluster, characterRoster, CARD_CLASSIFICATION_GUIDE, narrativePresets}: AuthorPromptDependencies) {
  ctx.effect(() => ctx.systemPrompt.section({name: 'roleplay:style-policy', order: 140, text: context => {
    const session = context.agent?.session
    if (!session || Number(context.agent?.options?.subagentDepth) > 0 || !isRoleplaySession(session)) return ''
    const policy = narrativePresets.policy(session.id)
    return promptSafeAuthorText(`【当前生效文风规则】\n${policy.summary}\n文风只控制小说表达，不改变人物事实、玩家决定权、工具权限及读卡、状态、记忆、导出流程。\n${policy.effective.mode === 'card' || !policy.preset.text ? '' : '\n【当前预设·顶层创作提示词】\n' + policy.preset.text}`)
  }}), 'roleplay: selected narrative preset')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'roleplay:card-workflows', order: 145,
    text: context => {
      if (Number(context.agent?.options?.subagentDepth)>0) return ''
      if (!isRoleplaySession(context.agent?.session)) return ''
      return `${CARD_CLASSIFICATION_GUIDE}\n【玩家读卡与导出：系统默认工作流】
玩家不是程序员，不需要提供工具名、游标、哈希、覆盖率或实现步骤。识别自然语言意图：“读取这张角色卡，准备开始角色扮演”“导入这张卡”使用读卡流程；“导出角色卡”“把设定保存成文件”使用逆向组卡流程。不要把这些管理请求扩写成剧情。角色设定导出不同于小说正文导出。
创作新卡或检查新卡草稿：加载最新 roleplay-card-authoring 技能，使用 rp_card_draft_check 进入写卡管理与检查文件。12项是AI内部清单，不让用户填工程表或设计CSS；默认用原生 questions 自然聊故事偏好，再把喜好映射成完整卡。用户说你来决定可跳过剩余问卷，但主代理仍逐项审阅；大纲统一后可并行细化独立模块。交付实际文件链接，不把写卡回执或偏好问答当剧情，不另写重复校验脚本。
已导入设定可用 rp_setting list/read 后按版本定点 patch/append/create，不重新导入、不重开对话。演出中发现遗漏或原著疑点，优先 rp_setting repair 提交目标和明确指令，由后台子代理查证修补，提交后继续正文，不轮询等待；玩家新增固定设定用 basis=player，原著纠错用 basis=source 和当前原著 source_id。后台助手只返回补丁，程序校验版本与世界线后写入。无法确认的内容留待玩家决定，不把剧情分歧或角色未知秘密当作设定错误。已保存内容由系统下次上下文组装提供，失败以 jobs 回执为准。
读卡：使用本次附件提供的工作区文件路径或玩家指明的文件。PNG/JSON 直接 rp_card_import_begin，不用图片识别、anydoc 或脚本解析；Markdown/TXT 也直接 begin，PDF/DOCX 才先转换为持久 Markdown。没有附件或路径时只请玩家提供卡片；多个候选不明确时只确认文件，不能翻找旧会话或参考卡代替。普通玩家无需指定格式版本或导入参数。
按 rp_card_import_begin → rp_card_import_chunk → rp_card_import_stage → rp_card_import_finalize 完成导入。chunk 严格跟随 nextCursor 从 1 到 null；完整审阅后按语义分到人物 card、常驻世界背景 core-setting、尚未发生的路线 plot-guidance、完整文风示例 rule-style、被动检索 worldbook 和其他栏目。PNG/JSON 的 suggestedMapping 只是建议；字段混有多种模块时必须按完整原文跨度细分，只有建议确实符合全文语义才用 use_suggested:true。完整新卡默认 replace，明确补充包才 merge。作者设定、状态栏、美化、原始开场和未知字段完整保存，不精简、不改写。激活成功后展示作者原始开场，不提前续写；没有开场才等待玩家行动。状态栏由系统轮末生成。
导出：无须玩家再次指定角色或格式，默认当前选中分支已保存的最新人设、世界书、规则、开场与附加设定，保留全部细节，原件不能覆盖编辑。直接 rp_card_export_begin → rp_card_export_chunk（从 0 沿 nextCursor 读到 null）→ rp_card_export_finalize。深入审阅每项来源，按上方创作用途组织统一 Markdown 章节：用户新增镜头语言放叙事规则，不照搬存储字段名。完整来源用 source_ids；混合来源再用 chunk(source_id) 查看行号，按 source_parts 分到相应章节，每行恰好一次；不精简，不用摘要、手写文件或静态拼接替代原生导出。后端负责完整物化与校验；成功后给出文件与简短完成说明，不复述技术流程，不推进故事。
恢复：用工具实际返回的 ID、游标和哈希；漏页/缺项按错误补齐，临时失败以相同参数有限重试，导出期间设定已改变就重新 begin。无效文件、权限错误或 recoveryRequired 时用普通语言说明未完成及可行下一步；不声称成功、不检查服务器代码、不改原卡或绕开校验。详细规范可读取 roleplay-card-authoring 技能，用户不需要承担这些约束。`
    },
  }), 'roleplay: player card workflows')

  ctx.effect(
      () =>
      ctx.systemPrompt.variable('user', (context) => {
        const session = context.agent?.session
        return userValues(session?.id).name
      }),
    'roleplay: user variable'
  )

  ctx.effect(
      () =>
      ctx.systemPrompt.variable('user_gender', (context) => {
        return userValues(context.agent?.session?.id).gender
      }),
    'roleplay: user_gender variable'
  )
  ctx.effect(()=>ctx.systemPrompt.variable('char',context=>{
    const prefix=`${context.agent?.session?.id}__`
    const cards=[...T.cards.entries()].filter(([key,card])=>key.startsWith(prefix)&&card?.kind!=='user')
      .sort(([a],[b])=>a<b?-1:a>b?1:0)
    return String(cards[0]?.[1]?.name??'角色')
  }),'roleplay: char variable')

  const fixedAuthorFence=createStableRoleplayFence()
  ctx.effect(()=>ctx.systemPrompt.section({name:'roleplay:character-cluster',order:170,text:context=>{
    const session=context.agent?.session
    if(!session||Number(context.agent?.options?.subagentDepth)>0||!isRoleplaySession(session)||!characterCluster.read(session).enabled)return ''
    return `【角色 agent 集群已开启】除读卡、写卡问答、管理与诊断回合之外，每轮正式剧情动笔前调用一次 rp_character_cast。先判断本回合预计出场的主要人物（作者预设或推动剧情的重要人物，排除路人），按 ID 选角；没有主要人物可传空列表。资料不足时先按需查世界书，程序会把当前与最近三个剧情回合已读资料、当前窗口正文、核心设定、各自人设和导演笔记注入独立子代理。不要手工复制或概括这些上下文。新出现且逐渐重要的人物先用 rp_card_set 保存独立人设，再选入集群；现有人物不要重复登记。等待工具返回后把各人物意向作为参考，协调矛盾再写正文。临场出现的意外人物可自由发挥，不必再次调用集群。当前可选人物：${JSON.stringify(characterRoster(session).map(({id,name})=>({id,name})))}`
  }}),'roleplay: character cluster writer instructions')
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'roleplay:cards',
        order: 150,
        text: (context) => {
          if (Number(context.agent?.options?.subagentDepth)>0) return ''
          const session = context.agent?.session
          if (!session || !isRoleplaySession(session)) return ''
          try {
            const cards = renderCards(T, session.id)
            if (!cards.trim()) return ''
            return fixedAuthorFence(cards, 'card')
          } catch {
            return ''
          }
        },
      }),
    'roleplay: cards section'
  )

  // 固定创作设定完整常驻；剧情路线和写作样本不是已发生的剧情。
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'roleplay:rules',
        order: 160,
        text: (context) => {
          if (Number(context.agent?.options?.subagentDepth)>0) return ''
          const session = context.agent?.session
          if (!session || !isRoleplaySession(session)) return ''
          try {
            const parts = []
            const rules = T.rules.get(keyOf(session.id, 'spec'))
            if (rules?.core) parts.push('【核心设定·固定世界基础】\n' + rules.core)
            const legacyPinned=[...T.worldbook.entries()].filter(([key,e])=>key.startsWith(`${session.id}__`)&&e?.enabled!==false&&e?.alwaysOn===true)
              .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,e])=>renderWorldbookEntry(e))
            if(legacyPinned.length)parts.push('【核心设定·旧卡常驻标记兼容投影】\n以下原文由旧constant/always_on标记明确指定为常驻，按核心设定保留；其余世界书条目只按本轮查询读取。\n'+legacyPinned.join('\n\n'))
            if (rules?.plot) parts.push('【剧情指引·尚未发生的作者路线】\n以下目标、触发条件和结局仅是可能性；只有所选分支已发生的事件能满足条件。不能把路线写成既成事实，不能替玩家选择路线。\n' + rules.plot)
            const includeCardStyle = narrativePresets.policy(session.id).effective.mode !== 'system'
            if (includeCardStyle && rules?.narrative) parts.push('【叙事规则】\n' + rules.narrative)
            if (includeCardStyle && rules?.reply) parts.push('【回复规则】\n' + rules.reply)
            if (includeCardStyle && rules?.style) parts.push('【文风特化·作者要求与完整样本】\n模仿叙述方式、节奏与语言质感；示例不是当前剧情，不代表事件已经发生，不搬用样本中的人物与事件。\n' + rules.style)
            parts.push('【世界书查询】世界书是被动资料库，不是常驻背景。根据导演笔记和当前问题，用 rp_worldbook_search 的明确关键词查阅；不要把旧检索结果当作永久上下文。')
            const statusSpec = T.status.get(keyOf(session.id, 'spec'))
            const statusRules=statusAuthorRules(statusSpec?.text)
            if (statusRules) parts.push('【状态规则·创作参考】（遵守其中的数值与状态约束；状态栏及行动建议由程序在正文落盘后交给维护任务生成。主代理只写故事，不生成面板或调用 rp_status_set。）\n' + statusRules)
            if (!parts.length) return ''
            return fixedAuthorFence(parts.join('\n\n'), 'rules')
          } catch {
            return ''
          }
        },
      }),
    'roleplay: rules section'
  )

}
