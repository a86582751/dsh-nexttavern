import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import type {EventEmitter} from 'node:events'

// Host routes and the preset can load different copies of this module. The
// process event joins their actual writer to the Core read owner without file
// polling; a service restart naturally establishes a new file baseline.
const USER_INFO_CHANGED='nexttavern:user-info-changed'
const userInfoEvents:EventEmitter=process
export function onUserInfoChanged(listener:()=>void):()=>void {
  const changed=(path:string)=>{if(path===userInfoPath())listener()}
  userInfoEvents.on(USER_INFO_CHANGED,changed)
  return ()=>{userInfoEvents.off(USER_INFO_CHANGED,changed)}
}

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
    userInfoEvents.emit(USER_INFO_CHANGED,path)
  } finally {
    // Failed replacement leaves the previous document intact. Cleanup must not hide its error.
    try { unlinkSync(temporary) } catch {}
  }
}
