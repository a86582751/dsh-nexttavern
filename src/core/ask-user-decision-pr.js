// Generated from runtime/alpha3/core/ask-user-decision-pr.ts; edit the TypeScript source.
// ask-user-decision-pr.ts — 官方 ask_user_question 的 RP 专版克隆。
//
// 克隆自 @deepseek-ai/dsh-tool-ask-user；问题参数契约保持官方形状。
// RP 语义仍由本地 roleplay.askDecision 负责：答案进入下一轮，决策卡在本轮结束时提交。
// 官方 dsh-tool-ask-user / dsh-user-questions / dsh-client-ui-user-questions 未修改。
export const name = 'ask-user-decision-pr';
export const inject = ['tools'];
const record = (value) => value !== null && typeof value === 'object' ? value : {};
const questionOf = (value) => record(value);
const optionsOf = (value) => Array.isArray(value) ? value.map(item => {
    const option = record(item);
    return {
        label: String(option.label ?? ''),
        description: option.description !== undefined ? String(option.description) : undefined,
        heart: option.heart === true,
    };
}) : [];
export function apply(ctx) {
    const roleplay = ctx.get('roleplay');
    ctx.tools.register({
        name: 'ask_user_decision_pr',
        description: '在剧情分歧点向玩家提问（官方 ask_user_question 的 RP 专版，参数一致）：' +
            '问题会以决策卡弹出，玩家作答后自动作为下一轮的用户指令继续剧情；' +
            '调用本工具后本轮立即结束——不要再输出任何文字，答案不会回到本轮。' +
            '一次只问一个问题。',
        parameters: {
            type: 'object', required: ['questions'],
            properties: {
                questions: { type: 'array', description: '要问玩家的问题（RP 版建议只给 1 个；多个时仅呈现第一个）。', items: { type: 'object', additionalProperties: true, properties: {
                            id: { type: 'string', description: '问题 id（保留字段，兼容官方契约）' },
                            question: { type: 'string', description: '要问玩家的具体问题（如：面对她的挑衅，{{user}} 接下来怎么做？）' },
                            header: { type: 'string', description: '可选短标题，如「抉择」' },
                            options: { type: 'array', description: '可选选项；heart=true 标记 ❤️ 好感选项。不提供时玩家可自由输入。', items: { type: 'object', additionalProperties: true, properties: {
                                        label: { type: 'string', description: '选项文案（50 字内，第三人称叙事口吻）' },
                                        description: { type: 'string', description: '一句话解释该选择的影响' },
                                        heart: { type: 'boolean', description: '是否标记 ❤️' },
                                    } } },
                            multi_select: { type: 'boolean', description: '是否允许多选，默认 false' },
                        } } },
            },
        },
        output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
        async execute(args, exec) {
            const session = exec?.agent?.session;
            if (!session)
                throw new Error('ask_user_decision_pr 需要在会话内使用');
            if (roleplay === undefined)
                throw new Error('roleplay 服务不可用');
            const input = record(args);
            const questions = Array.isArray(input.questions) ? input.questions : [];
            const question = questionOf(questions.find(item => item !== null && typeof item === 'object'));
            await roleplay.askDecision(session.id, {
                source: 'tool', seq: session.log?.length ?? 0, question: String(question.question ?? ''),
                header: question.header !== undefined ? String(question.header) : undefined,
                options: optionsOf(question.options), multiSelect: question.multi_select === true,
            });
            return { ok: true, presented: true, message: '问题已以决策卡呈现给玩家。本轮到此结束：不要再输出任何文字；玩家作答后系统会自动开启下一轮。' };
        },
        timeoutMs: 30000,
    });
}
