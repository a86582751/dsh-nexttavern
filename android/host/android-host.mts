/** Private native-pipe readiness/stop bridge; it does not own turn completion. */
import { createInterface } from 'node:readline'
import { constants } from 'node:fs'
import { open, opendir, type FileHandle } from 'node:fs/promises'
import { isAbsolute, relative } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { auditStartupEntries, getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'

export const name = 'nexttavern-mobile-host'
export const inject = ['connection', 'webServer', 'tools', 'workingDirectory']
export const PROTOCOL = 'nexttavern-mobile-v1'

export interface AndroidHostContext {
  root: Context
  connection: { authenticatedUrl(baseUrl: string): string }
  webServer: { port: number }
  tools: { register(definition: ReturnType<typeof workspaceTool>): unknown }
  workingDirectory: { ensure(agent: unknown, signal: AbortSignal): Promise<string> }
  get(name: 'loader'): { await(): Promise<void> } | undefined
  get(name: 'tavernConversations'): { ready: PromiseLike<unknown>; stopOwnedWork(): Promise<void> } | undefined
  effect(work: () => () => void, label?: string): unknown
}

export function apply(ctx: AndroidHostContext): void {
  const generation = process.env.NEXTTAVERN_GENERATION
  if (!generation) throw new Error('NEXTTAVERN_GENERATION must be supplied by the native supervisor')
  ctx.tools.register(workspaceTool(process.cwd(), (agent, signal) => ctx.workingDirectory.ensure(agent, signal)))
  let disposed = false
  let stopping = false
  const emit = (event: Record<string, unknown>) => {
    // This dedicated protocol pipe is private to the native supervisor. Never
    // send the authenticated URL through console or an ordinary diagnostic log.
    process.stdout.write(JSON.stringify({ protocol: PROTOCOL, generation, pid: process.pid, ...event }) + '\n')
  }

  const reader = createInterface({ input: process.stdin, terminal: false })
  const onLine = (line: string) => {
    let command: { protocol?: unknown; generation?: unknown; command?: unknown } | null
    try { command = JSON.parse(line) } catch { return }
    if (!command || command.protocol !== PROTOCOL || command.generation !== generation
      || command.command !== 'stop' || stopping) return
    stopping = true
    // Stop actual product owners before Cordis begins concurrent provider
    // disposal. Cancellation/settlement is interruption, not turn success.
    void (async () => {
      await ctx.get('tavernConversations')?.stopOwnedWork()
      await ctx.root.fiber.dispose()
    })().then(() => {
      emit({ event: 'STOPPED', completion: 'interrupted', drained: false })
    }).catch(() => {
      emit({ event: 'ERROR', phase: 'stop', code: 'HOST_STOP_FAILED' })
    })
  }
  reader.on('line', onLine)
  ctx.effect(() => () => {
    disposed = true
    reader.off('line', onLine)
    reader.close()
  }, 'nexttavern mobile private command pipe')

  // Never await Loader settlement inside plugin activation: Loader also waits
  // for this activation. Follow the pinned web-app's detached readiness path.
  const settled = ctx.get('loader')?.await() ?? Promise.resolve()
  void settled.then(async () => {
    await auditStartupEntries(ctx.root, 'nexttavern mobile', () => {})
    if (disposed || stopping) return
    const product = ctx.get('tavernConversations')
    if (!product) throw new Error('NextTavern conversation service is not active')
    await product.ready
    if (disposed || stopping) return
    const url = ctx.connection.authenticatedUrl(`http://127.0.0.1:${ctx.webServer.port}`)
    emit({ event: 'READY', url, hostVersion: getDshRuntimeVersion() })
  }).catch(() => {
    // Startup errors may carry URLs or other private configuration. The Host
    // owns detailed diagnostics; this protocol reports only a safe category.
    if (!disposed && !stopping) emit({ event: 'ERROR', phase: 'startup', code: 'HOST_STARTUP_FAILED' })
  })
}

const WORKSPACE_COMMAND_TIMEOUT_MS = 5000
const MAX_RESULTS = 100, MAX_VISITS = 800, MAX_DEPTH = 8
const MAX_FILE_BYTES = 64 * 1024, MAX_SEARCH_BYTES = 4 * 1024 * 1024
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
const fileFlags = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
const fdPath = (directory: FileHandle, leaf?: string) => '/proc/self/fd/' + directory.fd
  + (leaf === undefined ? '' : '/' + leaf)
const safeSegment = (name: string) => name.length > 0 && !name.startsWith('.') && !/[\\/\u0000-\u001f\u007f]/.test(name)
type WorkspaceCommand = { operation: 'pwd' | 'list' | 'find' | 'search'; path?: string; query?: string }
type WorkspaceEntry = { path: string; kind: 'file' | 'directory'; lines?: number[] }
type WorkspaceResult = { directory: string; entries: WorkspaceEntry[]; truncated: boolean }

/** Workspace discovery is not a subprocess or a compatibility shell. Open
 * each one-component child with O_NOFOLLOW relative to an already-open
 * directory inode. Where Android denies access to the process's own fd
 * anchors, report unavailable; never revert to path-based traversal. */
export async function runWorkspaceCommand(root: string, cwd: string, input: WorkspaceCommand,
  signal: AbortSignal): Promise<WorkspaceResult> {
  if (![constants.O_DIRECTORY, constants.O_NOFOLLOW, constants.O_NONBLOCK].every(flag => Number.isInteger(flag) && flag > 0)) {
    throw new Error('Android workspace file safeguards are unavailable')
  }
  if (!['pwd', 'list', 'find', 'search'].includes(input.operation)) throw new Error('Unsupported workspace command')
  const nested = relative(root, cwd)
  const cwdParts = nested === '' ? [] : nested.split('/')
  const target = input.path ?? '.'
  const targetParts = target === '.' ? [] : target.split('/')
  if (!isAbsolute(root) || !isAbsolute(cwd) || isAbsolute(nested)
    || !cwdParts.every(safeSegment) || !targetParts.every(safeSegment) || cwdParts.length + targetParts.length > MAX_DEPTH
    || (input.operation === 'pwd' && target !== '.')) throw new Error('Choose a relative path inside the Android workspace')
  const query = input.query
  if ((input.operation === 'find' || input.operation === 'search')
    && (typeof query !== 'string' || query.trim() === '' || query.length > 160 || /[\u0000-\u001f\u007f]/.test(query))) {
    throw new Error('Provide a non-empty literal name or text fragment (up to 160 characters)')
  }
  const parts = [...cwdParts, ...targetParts]
  const result: WorkspaceResult = { directory: parts.join('/') || '.', entries: [], truncated: false }
  const visitedLimit = { entries: 0, bytes: 0, stop: false }
  const scan = async (directory: FileHandle, from: string, depth: number): Promise<void> => {
    // A directory iterator on this proc fd opens the same inode, not a name
    // re-resolved under an ancestor the caller can swap. The parent stays open.
    for await (const entry of await opendir(fdPath(directory))) {
      signal.throwIfAborted()
      if (visitedLimit.stop || ++visitedLimit.entries > MAX_VISITS || result.entries.length >= MAX_RESULTS) {
        result.truncated = true
        visitedLimit.stop = true
        return
      }
      if (!safeSegment(entry.name) || (!entry.isDirectory() && !entry.isFile())) continue
      const file = from === '' ? entry.name : from + '/' + entry.name
      if (input.operation === 'list' || (input.operation === 'find' && entry.name.includes(query!))) {
        result.entries.push({path: file, kind: entry.isDirectory() ? 'directory' : 'file'})
      }
      if (input.operation === 'list') continue
      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) { result.truncated = true; continue }
        await using child = await open(fdPath(directory, entry.name), directoryFlags)
        await scan(child, file, depth + 1)
        if (visitedLimit.stop) return
      } else if (input.operation === 'search') {
        if (visitedLimit.bytes + MAX_FILE_BYTES > MAX_SEARCH_BYTES) { result.truncated = true; visitedLimit.stop = true; return }
        // A stale d_type is not trusted: reject symlink swaps, reject nonregular
        // and multiply-linked content, and make a raced FIFO nonblocking.
        await using child = await open(fdPath(directory, entry.name), fileFlags)
        const stat = await child.stat()
        if (!stat.isFile() || stat.nlink !== 1) continue
        if (stat.size > MAX_FILE_BYTES) { result.truncated = true; continue }
        const data = Buffer.alloc(MAX_FILE_BYTES + 1)
        let bytesRead = 0
        while (bytesRead < data.length) {
          signal.throwIfAborted()
          const next = await child.read(data, bytesRead, data.length - bytesRead, bytesRead)
          if (next.bytesRead === 0) break
          bytesRead += next.bytesRead
        }
        visitedLimit.bytes += bytesRead
        if (bytesRead > MAX_FILE_BYTES) { result.truncated = true; continue }
        const bytes = data.subarray(0, bytesRead)
        if (bytes.includes(0)) continue
        let text: string
        try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes) } catch { continue }
        const lines: number[] = []
        for (const [index, line] of text.split('\n').entries()) {
          if (!line.includes(query!)) continue
          if (lines.length === 12) { result.truncated = true; break }
          lines.push(index + 1)
        }
        if (lines.length > 0) result.entries.push({path: file, kind: 'file', lines})
      }
    }
  }
  const descend = async (directory: FileHandle, remaining: string[]): Promise<void> => {
    signal.throwIfAborted()
    if (remaining.length === 0) {
      if (input.operation !== 'pwd') await scan(directory, '', parts.length)
      return
    }
    await using child = await open(fdPath(directory, remaining[0]!), directoryFlags)
    await descend(child, remaining.slice(1))
  }
  try {
    await using directory = await open(root, directoryFlags)
    await descend(directory, parts)
  } catch {
    signal.throwIfAborted()
    throw new Error('Android workspace path unavailable or not a plain directory')
  }
  return result
}

function workspaceTool(root: string, resolveCwd: (agent: unknown, signal: AbortSignal) => Promise<string>) {
  return {
    name: 'workspace_command',
    description: 'Android read-only workspace commands: pwd (relative location), list (directory names), find (literal file-name fragment), '
      + 'search (literal text fragment with relative paths and line numbers). No shell, program execution, or write access. '
      + 'Hidden entries, symbolic links and content outside the session workspace are not searched. Use the standard read/edit tools for files.',
    parameters: {
      type: 'object', required: ['operation'], additionalProperties: false,
      properties: {
        operation: { type: 'string', enum: ['pwd', 'list', 'find', 'search'], description: 'A fixed workspace command (not shell text).' },
        path: { type: 'string', description: 'Optional directory relative to the session workspace; defaults to ".".' },
        query: { type: 'string', description: 'Literal fragment required for find and search. Not a regular expression.' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args: unknown, value: WorkspaceResult) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs: WORKSPACE_COMMAND_TIMEOUT_MS,
    isConcurrencySafe: () => true,
    async execute(args: WorkspaceCommand, exec: { agent?: unknown; signal: AbortSignal }): Promise<WorkspaceResult> {
      if (exec.agent === undefined) throw new Error('Android workspace commands require a session workspace')
      const cwd = await resolveCwd(exec.agent, exec.signal)
      return runWorkspaceCommand(root, cwd, args, exec.signal)
    },
  }
}
