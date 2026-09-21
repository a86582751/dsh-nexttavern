// Generated from runtime/alpha3/compat/anydoc/src/index.ts; edit the TypeScript source.
import { defineTool } from '@deepseek-ai/dsh-tools';
import { toMarkdown, toMarkdownBytes } from '@firecrawl/anydoc';
import fs from 'node:fs/promises';
import { dshNormalizeMarkdown } from './normalize-markdown.js';
export const name = 'dsh-nexttavern-anydoc';
export const inject = ['tools'];
const ERROR_HINTS = {
    unsupported: '不支持的文件格式或无法转换的内容',
    malformed: '文件结构损坏，无法提取有效内容',
    encrypted: '文件已加密或受密码保护',
    resourceLimit: '超出安全限制（解压、嵌套、节点数）',
    missingPart: '缺少生成输出所需的部件',
    io: '无法读取文件',
};
export function apply(ctx) {
    ctx.tools.register(defineTool({
        name: 'anydoc',
        description: '将文档（Word、PowerPoint、Excel、PDF、EPUB、RTF、CSV、OpenDocument）转换为 GitHub-Flavored Markdown；转换器产生的 Markdown 防御性转义会在返回前确定性还原（代码块与路径保持不变）。',
        parameters: {
            filePath: { type: 'string', required: true, description: '要转换文件的绝对路径或相对路径' },
            format: { type: 'string', description: '可选，显式指定格式（如 csv）；缺省时根据文件内容自动检测' },
            outputFilePath: { type: 'string', description: '可选，将转换结果写入该文件并返回摘要，而非返回完整 Markdown 文本' },
        },
        output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
        },
        isConcurrencySafe(args) {
            // Read-only conversions may overlap. A file output is a scheduler
            // barrier because another call can target the same user-supplied path.
            if (!args || typeof args !== 'object')
                return false;
            return !('outputFilePath' in args) || !args.outputFilePath;
        },
        async execute(args) {
            let markdown;
            try {
                markdown = args.format
                    ? await toMarkdownBytes(await fs.readFile(args.filePath), args.format)
                    : await toMarkdown(args.filePath);
            }
            catch (error) {
                const code = error.code;
                const hint = code && ERROR_HINTS[code] ? `（${ERROR_HINTS[code]}）` : '';
                throw new Error(`转换 "${args.filePath}" 失败: ${error.message}${hint}`);
            }
            markdown = dshNormalizeMarkdown(markdown);
            if (!markdown.trim()) {
                throw new Error(`转换 "${args.filePath}" 得到空内容，可能是不支持的格式或文件已损坏。`);
            }
            if (args.outputFilePath) {
                await fs.writeFile(args.outputFilePath, markdown, 'utf8');
                return `已转换 "${args.filePath}" 并写入 "${args.outputFilePath}"（${markdown.length} 字符）。`;
            }
            return markdown;
        },
    }));
}
