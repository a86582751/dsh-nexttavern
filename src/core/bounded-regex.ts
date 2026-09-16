import { Worker } from 'node:worker_threads'

export interface RegexPattern {
  readonly pattern: string
  readonly flags?: unknown
}

export interface WorldbookRegex {
  readonly pattern: string
  readonly flags: string
}

export type BoundedRegexFailureReason = 'limit' | 'busy' | 'timeout' | 'worker'

export interface BoundedRegexSuccess {
  readonly ok: true
  readonly matches: boolean[]
}

export interface BoundedRegexFailure {
  readonly ok: false
  readonly reason: BoundedRegexFailureReason
  readonly matches: []
}

export type BoundedRegexResult = BoundedRegexSuccess | BoundedRegexFailure

export interface BoundedRegexOptions {
  readonly timeoutMs?: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isAllowedFlags = (value: unknown): boolean =>
  /^[imsu]*$/.test(String(value ?? ''))

const isRegexPattern = (value: unknown): value is RegexPattern =>
  isRecord(value) && typeof value.pattern === 'string' && value.pattern.length <= 512 && isAllowedFlags(value.flags)

// Never run a third-party expression on the Harness event loop. A timeout is
// enforced by the parent, including parsing/compilation, and destroys the worker.
let active = 0
const workerCode = `const {parentPort,workerData}=require('node:worker_threads');
const result=workerData.patterns.map(p=>{try{return new RegExp(p.pattern,p.flags).test(workerData.text)}catch{return false}});
parentPort.postMessage(result);`

export async function boundedRegexMatch(
  patterns: unknown,
  text: unknown,
  { timeoutMs = 250 }: BoundedRegexOptions = {},
): Promise<BoundedRegexResult> {
  if (!Array.isArray(patterns) || patterns.length > 128 || typeof text !== 'string' || text.length > 32768
    || patterns.some(pattern => !isRegexPattern(pattern)))
    return { ok: false, reason: 'limit', matches: [] }
  if (!patterns.length) return { ok: true, matches: [] }
  if (active >= 4) return { ok: false, reason: 'busy', matches: [] }
  active++
  let worker: Worker | undefined
  try {
    return await new Promise<BoundedRegexResult>(resolve => {
      let settled = false
      const done = (value: BoundedRegexResult): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      }
      const timer = setTimeout(() => done({ ok: false, reason: 'timeout', matches: [] }), Math.min(500, Math.max(10, Number(timeoutMs))))
      try {
        worker = new Worker(workerCode, { eval: true, workerData: { patterns, text }, resourceLimits: { maxOldGenerationSizeMb: 24, stackSizeMb: 2 } })
        worker.once('message', (matches: unknown) => done({ ok: true, matches: matches as boolean[] }))
        worker.once('error', () => done({ ok: false, reason: 'worker', matches: [] }))
        worker.once('exit', () => done({ ok: false, reason: 'worker', matches: [] }))
      } catch {
        done({ ok: false, reason: 'worker', matches: [] })
      }
    })
  } finally {
    if (worker) await worker.terminate()
    active--
  }
}

export function worldbookRegex(key: unknown, caseSensitive = false): WorldbookRegex {
  if (typeof key !== 'string') return { pattern: '', flags: 'i' }
  if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
    const end = key.lastIndexOf('/')
    return { pattern: key.slice(1, end), flags: key.slice(end + 1).replace(/[gy]/g, '') }
  }
  return { pattern: key, flags: caseSensitive ? '' : 'i' }
}
