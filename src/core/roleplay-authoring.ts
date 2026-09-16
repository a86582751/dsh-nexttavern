import { keyOf, stableImportId, sha256 } from './roleplay-data.js'
import { lastSeq, type ContextSession } from './roleplay-context.js'
import { readCardSource } from './tavern-card.js'
import { statusTemplateDiagnostics } from '../status-template.js'
import { boundedRegexMatch } from './bounded-regex.js'
import { simpleTool } from './roleplay-task-tools.js'
import type { TaskToolExecution } from './roleplay-task-tools-types.js'
import type { AuthoringInput, AuthoringDependencies, DraftDependencies, DraftInput, DraftRegex } from './roleplay-authoring-types.js'

export function registerCardAuthoring({ctx, T, svc, RULE_TEXT_FIELDS, sessionOf,beforeWrite}: AuthoringDependencies) {
  // rp_commit_card 的结构化写入（id 一律 sanitize）
  async function commitParsedCard(session: ContextSession, data: AuthoringInput, atSeq: number) {
    const written = []
    for (const c of data.cards ?? []) {
      const id = c.kind === 'user' ? 'user' : stableImportId(c.card_id ?? c.name)
      const prev = T.cards.get(keyOf(session.id, id)) ?? {}
      await T.cards.put(keyOf(session.id, id), {
        id,
        name: String(c.name ?? id).slice(0, 60),
        kind: c.kind === 'user' ? 'user' : 'npc',
        content: String(c.content ?? ''),
        locked: c.locked === undefined ? prev.locked === true : c.locked === true,
        version: (Number(prev.version) || 0) + 1,
        updatedAtSeq: atSeq,
        verified: false,
        source: 'authored-by-agent',
      })
      written.push({ target: 'cards', id })
    }
    for (const e of data.worldbook ?? []) {
      const id = stableImportId(e.id ?? e.name)
      const prev = T.worldbook.get(keyOf(session.id, id)) ?? {}
      await T.worldbook.put(keyOf(session.id, id), {
        id,
        kind: e.kind ?? 'term',
        name: String(e.name ?? id).slice(0, 60),
        aliases: (e.aliases ?? prev.aliases ?? []).map(String),
        keywords: (e.keywords ?? prev.keywords ?? []).map(String),
        triggers: (e.triggers ?? prev.triggers ?? []).map(String),
        priority: e.priority === undefined ? Number(prev.priority) || 0 : Number(e.priority) || 0,
        tokenBudget: e.tokenBudget === undefined ? Number(prev.tokenBudget) || 500 : Number(e.tokenBudget) || 500,
        alwaysOn: e.alwaysOn === undefined ? prev.alwaysOn === true : e.alwaysOn === true,
        content: String(e.content ?? ''),
        locked: e.locked === undefined ? prev.locked === true : e.locked === true,
        version: (Number(prev.version) || 0) + 1,
        updatedAtSeq: atSeq,
        verified: false,
        source: 'authored-by-agent',
      })
      written.push({ target: 'worldbook', id })
    }
    if (data.statusSpec) {
      await svc.setStatusSpec(session.id, String(data.statusSpec), atSeq)
      written.push({ target: 'status' })
    }
    if (data.rules && typeof data.rules === 'object') {
      const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {}
      const acceptedRules: Record<string, string> = {}
      for (const key of RULE_TEXT_FIELDS) {
        if (typeof data.rules[key] === 'string') acceptedRules[key] = data.rules[key]
      }
      await svc.setRules(session.id, { ...prev, ...acceptedRules, verified: false, source: 'authored-by-agent' }, atSeq)
      written.push({ target: 'rules' })
    }
    if (data.beauty && typeof data.beauty === 'object') {
      // 排版美化：正文渲染层的作者特效（正则规则 + 作用域 CSS + 渲染后 JS）
      const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {}
      const rawRegexRules = Array.isArray(data.beauty.regexRules) ? data.beauty.regexRules : []
      if (rawRegexRules.length > 200) throw new Error('beauty.regexRules 超过 200 条；拒绝静默截断')
      const regexRules = rawRegexRules
        .filter((r) => r && typeof r === 'object' && typeof r.match === 'string' && typeof r.replace === 'string')
        .map((r) => ({ match: String(r.match), replace: String(r.replace) }))
      const css = typeof data.beauty.css === 'string' ? data.beauty.css : ''
      const js = typeof data.beauty.js === 'string' ? data.beauty.js : ''
      if (css.length > 200000 || js.length > 100000) throw new Error('beauty CSS/JS 过大；拒绝静默截断，请拆分后再提交')
      const beauty = {
        regexRules,
        css,
        js,
      }
      await svc.setRules(session.id, { ...prev, beauty, verified: false, source: 'authored-by-agent' }, atSeq)
      written.push({ target: 'beauty' })
    }
    if (data.opening) {
      await svc.setOpening(session.id, String(data.opening), atSeq)
      written.push({ target: 'opening' })
    }
    return written
  }

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool<AuthoringInput, TaskToolExecution, Promise<unknown>>(
        'rp_commit_card',
        '写卡工作流最后一步：主代理完成合成与矫审后，把最终结构化的角色卡/世界书/状态栏设定/叙事规则/初始剧情一次性写入当前分支（旧栏目为新版本，绝不覆盖历史）。',
        {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: { card_id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' }, content: { type: 'string' }, locked: { type: 'boolean' } },
                required: ['name', 'content'],
                additionalProperties: false,
              },
            },
            worldbook: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'string' }, kind: { type: 'string' }, name: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, keywords: { type: 'array', items: { type: 'string' } }, triggers: { type: 'array', items: { type: 'string' } }, priority: { type: 'number' }, token_budget: { type: 'number' }, always_on: { type: 'boolean' }, content: { type: 'string' }, locked: { type: 'boolean' } },
                required: ['name', 'content'],
                additionalProperties: false,
              },
            },
            statusSpec: { type: 'string' },
            rules: {
              type: 'object',
              properties: {
                core: { type: 'string', description:'常驻核心设定：世界基础、核心威胁、长期矛盾，完整保留。' },
                plot: { type: 'string', description:'剧情指引：路线、条件与可能结局，不是已发生事实。' },
                narrative: { type: 'string' },
                reply: { type: 'string' },
                style: { type: 'string', description:'文风特化：完整写作要求和示例，不精简为关键词。' },
              },
              additionalProperties: false,
            },
            opening: { type: 'string' },
            beauty: {
              type: 'object',
              additionalProperties: true,
              description: '「排版美化」栏目：正文渲染层的作者特效（正则规则 + CSS + JS；regexRules 与状态栏同格式）。',
              properties: {
                regexRules: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { match: { type: 'string' }, replace: { type: 'string' } },
                    required: ['match', 'replace'],
                    additionalProperties: true,
                  },
                },
                css: { type: 'string', description: '作用域样式（选择器自动加 .rp-reader 前缀）' },
                js: { type: 'string', description: '渲染后执行的脚本（沙箱参数：root=阅读容器元素, fill=填入输入框函数）' },
              },
            },
          },
          required: [],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          await beforeWrite?.(exec)
          const data = {
            cards: args.cards ?? [],
            worldbook: (args.worldbook ?? []).map((e) => ({ ...e, tokenBudget: e.token_budget, alwaysOn: e.always_on })),
            statusSpec: args.statusSpec ?? null,
            rules: args.rules ?? null,
            opening: args.opening ?? null,
            beauty: args.beauty ?? null,
          }
          const written = await commitParsedCard(session, data, lastSeq(session))
          return { ok: true, written }
        }
      )
    ),
    'roleplay: tool rp_commit_card'
  )

}

export function registerDraftCheck({ctx, sessionOf,beforeWrite}: DraftDependencies) {
  ctx.effect(()=>ctx.tools.register(simpleTool<DraftInput, TaskToolExecution, Promise<unknown>>(
    'rp_card_draft_check',
    '写卡管理入口与只读文件检查。开始创作/询问偏好时不传路径；定稿后传 source_path 检查实际 Markdown 文件、JSON、美化规则。不会激活角色卡或生成剧情。',
    {type:'object',properties:{source_path:{type:'string'},review:{type:'array',maxItems:12,items:{type:'object',properties:{id:{type:'string'},section:{type:'string',description:'实际文件中对应章节的完整标题，不含 #'},basis:{type:'string',enum:['confirmed','default']}},required:['id','section','basis'],additionalProperties:false}}},additionalProperties:false},
    async(args,exec)=>{
      const session=await sessionOf(exec)
      const checklist=Object.entries({overview:'角色卡整体概述',world:'世界观：背景、核心矛盾/剧情驱动力、特殊种族、与现实的核心区别',factions:'势力设定',locations:'重要地点场景描述',characters:'多角色：基本信息、小传、外貌、性格、萌点、特质、语言风格、喜好、行为逻辑',plot:'剧情发展指引',style:'文风特化示例',opening:'开场剧情',status:'状态栏',rules:'叙事与回复规则',beauty:'HTML/CSS美化',regex:'正则表达式'}).map(([id,label])=>({id,label}))
      if(!args.source_path)return {ok:true,mode:'authoring',checklist,next:'先通过原生 ask_user_question / questions 分批交流偏好，每批3–4个有具体选项的问题，保留自由描述，根据上一批回答调整下一批。用户说你来决定即可跳过剩余问题，但仍需检查全部12项。大纲明确后可并行细化独立模块。不要向玩家解释内部管理标记。'}
      await beforeWrite?.(exec)
      const source=readCardSource(session.header.cwd,args.source_path)
      if(!['.md','.markdown'].includes(source.extension)||source.bytes.length>1_000_000)throw new Error('请提供当前工作区内 1MB 以内的 Markdown 草稿')
      const text=source.bytes.toString('utf8'),errors: string[]=[],rules: DraftRegex[]=[]
      const headings=[...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m=>m[1]!.trim())
      const review=Array.isArray(args.review)?args.review:[]
      for(const item of checklist){
        const records=review.filter(r=>r.id===item.id)
        if(records.length!==1||!['confirmed','default'].includes(records[0]!.basis)||!headings.includes(records[0]!.section))errors.push(`请审阅 ${item.id}（${item.label}），提交对应实际章节与 confirmed/default 依据`)
      }
      if(review.some(r=>!checklist.some(c=>c.id===r.id)))errors.push('审阅记录包含未知清单项')
      const statusReview = review.find(item => item.id === 'status')
      const headingRows = [...text.matchAll(/^(#{1,3})\s+(.+)$/gm)]
      const statusIndex = headingRows.findIndex(row => row[2]!.trim() === statusReview?.section)
      let statusRendering: ReturnType<typeof statusTemplateDiagnostics> | null = null
      if (statusIndex >= 0) {
        const start = headingRows[statusIndex]!, end = headingRows.slice(statusIndex + 1).find(row => row[1]!.length <= start[1]!.length)?.index ?? text.length
        statusRendering = statusTemplateDiagnostics(text.slice(start.index, end))
        errors.push(...statusRendering.errors)
      }
      let jsonBlocks=0
      for(const match of text.matchAll(/^```json\s*\r?\n([\s\S]*?)^```\s*$/gm)){
        jsonBlocks++
        try {
          const value=JSON.parse(match[1]!),items=Array.isArray(value)?value:value.regexRules??(value.match?[value]:[])
          for(const r of items){
            if(typeof r.match!=='string'||typeof r.replace!=='string'){errors.push('正则条目需要 match/replace 字符串');continue}
            rules.push(r)
          }
        }catch{errors.push(`第 ${jsonBlocks} 个 JSON 代码块无法解析`)}
      }
      const regex=await boundedRegexMatch(rules.map(r=>({pattern:r.match,flags:String(r.flags??'m').replace(/[gy]/g,'')})),text.slice(-32768))
      if(!jsonBlocks||rules.length<2)errors.push('全量草稿应提供至少两条正则规则及对应示例')
      if(!regex.ok)errors.push(`正则检查未完成：${regex.reason}`)
      else regex.matches.forEach((matched,i)=>{if(!matched)errors.push(`第 ${i+1} 条正则无有效匹配示例或表达式无效`)})
      return {ok:errors.length===0,schemaVersion:1,sourcePath:source.sourcePath,bytes:source.sourceBytes,sha256:sha256(text),
        headings:headings.slice(0,100),jsonBlocks,regexRules:rules.length,errors,checklist,statusRendering,
        limitations:'程序仅检查文件与可解析/匹配结构；人物深度、栏目语义完整性、CSS视觉效果及剧情一致性仍需创作者核对。没有激活卡片。'}
    }
  )),'roleplay: draft authoring check')

}
