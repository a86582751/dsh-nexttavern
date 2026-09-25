import type {Context} from '@deepseek-ai/cordis'
import {defineTool} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-agent'
import {createDocumentReader, documentPage} from './document-reader.js'

export const name = 'dsh-nexttavern-anydoc'

export const inject = ['tools', 'fs']

const ERROR_HINTS: Record<string, string> = {
  unsupported: '不支持的文件格式或无法转换的内容',
  malformed: '文件结构损坏，无法提取有效内容',
  encrypted: '文件已加密或受密码保护',
  needsOcr: '包含扫描或图像页面，需要先做 OCR；此工具不会自动调用在线识别服务',
  resourceLimit: '超出安全限制（解压、嵌套、节点数）',
  missingPart: '缺少生成输出所需的部件',
  io: '无法读取文件',
}

export function apply(ctx: Context) {
  const reader = createDocumentReader()
  ctx.effect(() => () => reader.dispose())
  ctx.tools.register(defineTool({
    name: 'anydoc',
    description: '读取上传文件或工作区文档。支持 Word、PowerPoint、Excel、PDF、EPUB、RTF、CSV、OpenDocument 及 UTF-8 txt/md。长文档按 nextOffset 连续读取；返回的 totalCharacters 是全文大小，当前窗口不是全文。outputFilePath 可将完整转换文本一次落盘，供角色卡导入。',
    parameters: {
      filePath: {type: 'string', required: true, description: '要转换文件的绝对路径或相对路径'},
      format: {type: 'string', description: '可选，显式指定格式（如 csv）；缺省时根据文件内容自动检测'},
      outputFilePath: {type: 'string', description: '可选，将转换结果写入该文件并返回摘要，而非返回完整 Markdown 文本'},
      offset: {type: 'integer', description: '可选，字符偏移（UTF-16）；首次为 0，续读使用返回的 nextOffset'},
      limit: {type: 'integer', description: '可选，当前窗口字符上限，默认 16000，最大 32000'},
    },
    output: {
      schema: {type: 'string'},
      render: (_args, value) => [{type: 'text', text: value}],
    },
    isConcurrencySafe(args) {
      // Read-only conversions may overlap. A file output is a scheduler
      // barrier because another call can target the same user-supplied path.
      if (!args || typeof args !== 'object') return false
      return !('outputFilePath' in args) || !args.outputFilePath
    },
    async execute(args, exec) {
      // A preset scope resolves host services through its declaring Loader, so
      // the calling agent's own tree may carry no filesystem at all: reading
      // `agent.ctx.fs` there throws "cannot get property "fs" without inject".
      // Prefer the agent-scoped provider when it resolves — that keeps the read
      // on the same instance the session's other tools use — and fall back to
      // this tool's injected provider, which is that same shared instance in
      // every composition that mounts one for the profile.
      const fs = exec.agent?.ctx?.get?.('fs') ?? ctx.fs
      const cwd = exec.agent?.session.header.cwd
      try {
        if (args.outputFilePath && (args.offset !== undefined || args.limit !== undefined)) {
          throw Error('outputFilePath 写入全文，不能与 offset/limit 同时使用')
        }
        // Validate paging before conversion, including calls that hit the cache.
        documentPage('', 0, args.limit)
        if (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || args.offset < 0)) {
          throw Error('offset 必须是非负整数')
        }
        const {markdown, target, version} = await reader.read(fs, args.filePath, args.format, cwd, exec.signal)
        // Dispatch from this plugin's own context, like the native file tools:
        // the observations must reach the profile-mounted policy, while the
        // actor argument keeps the calling session identifiable.
        ctx.emit('fs/observed', target, {kind: 'present', version}, exec)
        if (args.outputFilePath) {
          const output = await fs.resolve(args.outputFilePath, {cwd, signal: exec.signal})
          if (output.targetKey === target.targetKey) throw Error('输出路径不能覆盖输入文档')
          const intent = await ctx.waterfall('fs/write-intent', output, exec, () => undefined)
          const written = await fs.writeText(output, markdown, intent, exec.signal)
          ctx.emit('fs/observed', output, {kind: 'present', version: written.version}, exec)
          return `已转换 "${args.filePath}" 并写入 "${output.displayPath}"（${markdown.length} 字符，完整文档）。`
        }
        return JSON.stringify({filePath: target.displayPath, ...documentPage(markdown, args.offset, args.limit)})
      } catch (error) {
        const code = (error as {code?: string}).code
        const hint = code && ERROR_HINTS[code] ? `（${ERROR_HINTS[code]}）` : ''
        throw new Error(`转换 "${args.filePath}" 失败: ${(error as Error).message}${hint}`)
      }

    },
  }))
}
