// ask-user-decision-pr.js — 官方 ask_user_question 的 RP 专版克隆。
//
// 克隆自 @deepseek-ai/dsh-tool-ask-user（参数/输出契约照抄官方：
// questions[id/question/header/options/multi_select]），差异在 RP 语义：
//
//   1. execute 不调用 ctx.userQuestions.ask —— 官方机制会把答案作为工具结果
//      回到「同一轮」继续执行（这正是多轮剧情被压进一轮、前几轮沦为中间过程的
//      根源）；本版改为把问题写入 roleplay 决策卡（decision 记录，经 roleplay
//      服务的 askDecision 接口），本轮立即结束；
//   2. 玩家作答后，答案以「我选择：…」用户消息注入，自动开启下一轮——
//      一问一轮、轮轮独立，正文始终是该轮的最终输出；
//   3. 单轮输出达到上限也不影响提问：决策卡由轮末 host 兜底生成（roleplay-core
//      阶段 B），本工具是「剧情分歧点显式提问」的入口。
//
// 官方插件（dsh-tool-ask-user / dsh-user-questions /
// dsh-client-ui-user-questions）均未做任何修改。

export const name = 'ask-user-decision-pr'

export const inject = ['tools']

export function apply(ctx) {
  // 与本 preset isolate group 内的 roleplay 编排核心通信（惰性获取，
  // 与 roleplay-memory-engine 同模式；行序上 roleplay-core 先注册其服务）。
  const roleplay = ctx.get('roleplay')

  ctx.tools.register({
    name: 'ask_user_decision_pr',
    description:
      '在剧情分歧点向玩家提问（官方 ask_user_question 的 RP 专版，参数一致）：' +
      '问题会以决策卡弹出，玩家作答后自动作为下一轮的用户指令继续剧情；' +
      '调用本工具后本轮立即结束——不要再输出任何文字，答案不会回到本轮。' +
      '一次只问一个问题。',
    parameters: {
      type: 'object',
      required: ['questions'],
      properties: {
        questions: {
          type: 'array',
          description: '要问玩家的问题（RP 版建议只给 1 个；多个时仅呈现第一个）。',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              id: { type: 'string', description: '问题 id（保留字段，兼容官方契约）' },
              question: { type: 'string', description: '要问玩家的具体问题（如：面对她的挑衅，{{user}} 接下来怎么做？）' },
              header: { type: 'string', description: '可选短标题，如「抉择」' },
              options: {
                type: 'array',
                description: '可选选项；heart=true 标记 ❤️ 好感选项。不提供时玩家可自由输入。',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    label: { type: 'string', description: '选项文案（50 字内，第三人称叙事口吻）' },
                    description: { type: 'string', description: '一句话解释该选择的影响' },
                    heart: { type: 'boolean', description: '是否标记 ❤️' },
                  },
                },
              },
              multi_select: { type: 'boolean', description: '是否允许多选，默认 false' },
            },
          },
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const session = exec?.agent?.session
      if (!session) throw new Error('ask_user_decision_pr 需要在会话内使用')
      if (roleplay === undefined) throw new Error('roleplay 服务不可用')
      const questions = Array.isArray(args.questions) ? args.questions : []
      const q = questions.find((x) => x && typeof x === 'object') ?? {}
      await roleplay.askDecision(session.id, {
        source: 'tool',
        seq: session.log?.length ?? 0,
        question: String(q.question ?? ''),
        header: q.header !== undefined ? String(q.header) : undefined,
        options: Array.isArray(q.options)
          ? q.options.map((o) => ({
              label: String(o?.label ?? ''),
              description: o?.description !== undefined ? String(o.description) : undefined,
              heart: o?.heart === true,
            }))
          : [],
        multiSelect: q.multi_select === true,
      })
      return {
        ok: true,
        presented: true,
        message:
          '问题已以决策卡呈现给玩家。本轮到此结束：不要再输出任何文字；玩家作答后系统会自动开启下一轮。',
      }
    },
    timeoutMs: 30000,
  })
}
