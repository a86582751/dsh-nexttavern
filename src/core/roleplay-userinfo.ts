import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Host routes must also work before any roleplay session has been mounted.
export const userInfoPath = (): string =>
  process.env.DSH_ROLEPLAY_USERINFO_PATH ??
  join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'roleplay-userinfo.json')

export function readUserInfo(): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(userInfoPath(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** Write one complete document; callers decide whether a failure is recoverable. */
export function writeUserInfo(record: unknown): void {
  const path = userInfoPath()
  const temporary = `${path}.tmp-${randomUUID()}`
  mkdirSync(dirname(path), { recursive: true })
  // A reader must see either the previous document or this one, never a partial JSON write.
  try {
    writeFileSync(temporary, JSON.stringify(record, null, 2), 'utf8')
    renameSync(temporary, path)
  } finally {
    // Failed replacement leaves the previous document intact. Cleanup must not hide its error.
    try { unlinkSync(temporary) } catch {}
  }
}
