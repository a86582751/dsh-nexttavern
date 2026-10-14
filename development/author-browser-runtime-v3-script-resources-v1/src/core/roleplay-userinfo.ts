import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import type { EventEmitter } from 'node:events'
import type {
  NativePersonaConnectionV1, NativePersonaDataV1, NativePersonaMutationResultV1, NativePersonaOperationV1,
  NativePersonaReceiptV1, NativePersonaWireV1,
} from './roleplay-native-persona-types.js'

const USER_INFO_CHANGED = 'nexttavern:user-info-changed'
const userInfoEvents: EventEmitter = process
export function onUserInfoChanged(listener: () => void): () => void {
  const changed = (path: string) => { if (path === userInfoPath()) listener() }
  userInfoEvents.on(USER_INFO_CHANGED, changed)
  return () => { userInfoEvents.off(USER_INFO_CHANGED, changed) }
}

export const userInfoPath = (): string => process.env.DSH_ROLEPLAY_USERINFO_PATH ??
  join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'roleplay-userinfo.json')

type RecordValue = Record<string, unknown>
interface OwnedAvatar {
  schemaVersion: 1
  kind: 'generated-default-svg'
  templateVersion: 1
  seed: string
}
interface PersonaCatalog extends RecordValue {
  schemaVersion: 1
  revision: number
  selectedId: string | null
  defaultId: string | null
  profiles: Record<string, RecordValue>
  avatars: Record<string, OwnedAvatar>
  receipts: Record<string, NativePersonaReceiptV1>
}
const LEGACY_ID = 'nexttavern-legacy-user.png'
const own = (record: object, key: string): boolean => Object.hasOwn(record, key)
const put = (record: object, key: string, value: unknown): void => {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true })
}
const object = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const defaults = { title: '', description: '', position: 0, depth: 2, role: 0, lorebook: '', connections: [] }
const profileFields = ['name', 'gender', 'title', 'description', 'position', 'depth', 'role', 'lorebook', 'connections'] as const

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const record = value as RecordValue
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}
const hash = (value: unknown): string => createHash('sha256').update(stableJson(value)).digest('hex')

function readDocument(): RecordValue {
  try {
    const parsed: unknown = JSON.parse(readFileSync(userInfoPath(), 'utf8'))
    if (!object(parsed)) throw new Error('Native userinfo document must be an object')
    return parsed
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
    throw error
  }
}

/** Legacy callers keep their best-effort raw-document read contract. */
export function readUserInfo(): RecordValue | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(userInfoPath(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed as RecordValue : null
  } catch { return null }
}

function legacyText(document: RecordValue, names: readonly string[]): string {
  for (const name of names) if (typeof document[name] === 'string' && document[name].trim()) return document[name]
  return ''
}
const defaultAvatar = (seed: string): OwnedAvatar =>
  ({ schemaVersion: 1, kind: 'generated-default-svg', templateVersion: 1, seed })
function catalogOf(document: RecordValue): PersonaCatalog {
  if (own(document, 'nextTavernPersonas')) {
    const value = document.nextTavernPersonas
    if (!object(value) || value.schemaVersion !== 1 || !object(value.profiles) ||
      !object(value.avatars) || !object(value.receipts)) throw new Error('Unsupported Native persona catalog')
    return value as unknown as PersonaCatalog
  }
  const name = legacyText(document, ['name', 'user', 'displayName'])
  return {
    schemaVersion: 1, revision: 0, selectedId: name ? LEGACY_ID : null, defaultId: null,
    profiles: name ? { [LEGACY_ID]: { ...defaults, name, gender: legacyText(document, ['gender', 'sex']) } } : {},
    avatars: name ? { [LEGACY_ID]: defaultAvatar(LEGACY_ID) } : {}, receipts: {},
  }
}
function avatarAvailable(value: unknown): value is OwnedAvatar {
  return object(value) && value.schemaVersion === 1 && value.kind === 'generated-default-svg' &&
    value.templateVersion === 1 && typeof value.seed === 'string'
}
function personaWire(id: string, profile: RecordValue, catalog: PersonaCatalog): NativePersonaWireV1 {
  const known: RecordValue = { ...defaults }
  for (const key of profileFields) if (profile[key] !== undefined) known[key] = profile[key]
  // Native connection extensions stay in the file, like profile extensions.
  known.connections = ((profile.connections ?? []) as readonly NativePersonaConnectionV1[])
    .map(connection => ({ type: connection.type, id: connection.id }))
  return { ...known, name: String(profile.name ?? ''), avatar_id: id, avatar: id,
    is_default: catalog.defaultId === id } as unknown as NativePersonaWireV1
}
function project(catalog: PersonaCatalog): NativePersonaDataV1 {
  const value = {
    schemaVersion: 1 as const, encoding: 'native-account-persona-data-v1' as const,
    revision: catalog.revision, selectedId: catalog.selectedId, defaultId: catalog.defaultId,
    profiles: Object.entries(catalog.profiles).map(([id, profile]) => personaWire(id, profile, catalog)),
    avatarIds: Object.keys(catalog.avatars).filter(id => avatarAvailable(catalog.avatars[id])),
  }
  return { ...value, dataSha256: hash(value) }
}
export function readNativePersonas(): NativePersonaDataV1 { return project(catalogOf(readDocument())) }

function effective(document: RecordValue, catalog: PersonaCatalog): RecordValue {
  const { nextTavernPersonas: _catalog, updatedAt: _updatedAt, ...extras } = document
  const selected = catalog.selectedId === null ? undefined : catalog.profiles[catalog.selectedId]
  return selected ? { ...extras, name: selected.name, gender: selected.gender ?? '' } : extras
}
export function readEffectiveUserInfo(): RecordValue {
  const document = readDocument()
  return effective(document, catalogOf(document))
}

/** IDs only index owned descriptors; they are never interpreted as file paths. */
export function readNativePersonaAvatar(id: string): string | null {
  const avatars = catalogOf(readDocument()).avatars
  const descriptor = own(avatars, id) ? avatars[id] : undefined
  if (!avatarAvailable(descriptor)) return null
  const digest = createHash('sha256').update(descriptor.seed).digest('hex')
  const color = `#${digest.slice(0, 6)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="24" fill="${color}"/><circle cx="64" cy="44" r="22" fill="#fff"/>` +
    '<path d="M22 116c0-27 18-44 42-44s42 17 42 44" fill="#fff"/></svg>'
}

function commit(document: RecordValue, changed: boolean, current?: () => boolean): boolean {
  const path = userInfoPath()
  const temporary = `${path}.tmp-${randomUUID()}`
  mkdirSync(dirname(path), { recursive: true })
  try {
    writeFileSync(temporary, JSON.stringify(document, null, 2), 'utf8')
    // The sender remains authoritative until the actual atomic replacement.
    // Nothing yields between this check and rename, including Core callers.
    if (current && !current()) return false
    renameSync(temporary, path)
    if (changed) userInfoEvents.emit(USER_INFO_CHANGED, path)
    return true
  } finally { try { unlinkSync(temporary) } catch {} }
}
const refused = (code: string): NativePersonaMutationResultV1 => ({ schemaVersion: 1, kind: 'refused', code })
function findId(catalog: PersonaCatalog, input: string): string | null {
  if (!input || input === 'current') return catalog.selectedId
  if (own(catalog.profiles, input)) return input
  const matches = Object.keys(catalog.profiles).filter(id => String(catalog.profiles[id]!.name).toLowerCase() === input.toLowerCase())
  return matches.length === 1 ? matches[0]! : null
}
function generatedId(catalog: PersonaCatalog, name: string): string {
  const stem = name.replace(/[^a-zA-Z0-9]/g, '') || 'persona'
  let id = `${Date.now()}-${stem}.png`
  while (own(catalog.profiles, id)) id = `${Date.now()}-${stem}${randomUUID().replace(/-/g, '')}.png`
  return id
}
function updateProfile(profile: RecordValue, values: Partial<NativePersonaWireV1>): void {
  for (const key of profileFields) if (values[key] !== undefined && values[key] !== null) profile[key] = values[key]
}
function ensureAvatar(catalog: PersonaCatalog, id: string, avatar?: string): boolean {
  if (avatar && avatar !== id) {
    if (!own(catalog.avatars, avatar) || !avatarAvailable(catalog.avatars[avatar])) return false
    put(catalog.avatars, id, { ...catalog.avatars[avatar]! })
  } else if (!own(catalog.avatars, id) || !avatarAvailable(catalog.avatars[id])) put(catalog.avatars, id, defaultAvatar(id))
  return true
}
function setDefault(catalog: PersonaCatalog, id: string, value?: boolean): void {
  if (value === true) catalog.defaultId = id
  else if (value === false && catalog.defaultId === id) catalog.defaultId = null
}
function applyMutation(catalog: PersonaCatalog, operation: NativePersonaOperationV1): boolean | null | string {
  const mutation = operation.mutation
  switch (mutation.kind) {
    case 'create': {
      const id = mutation.persona.avatar_id ?? generatedId(catalog, mutation.name)
      if (mutation.name === 'current' || own(catalog.profiles, id) || Object.values(catalog.profiles)
        .some(profile => String(profile.name).toLowerCase() === mutation.name.toLowerCase())) return false
      if (!ensureAvatar(catalog, id, mutation.persona.avatar)) return 'NATIVE_PERSONA_AVATAR_UNAVAILABLE'
      const profile: RecordValue = { ...defaults, connections: [] }
      updateProfile(profile, mutation.persona)
      profile.name = mutation.name
      put(catalog.profiles, id, profile)
      setDefault(catalog, id, mutation.persona.is_default)
      return true
    }
    case 'replace': {
      const id = findId(catalog, mutation.id)
      if (!id) return 'NATIVE_PERSONA_NOT_FOUND'
      if (!ensureAvatar(catalog, id, mutation.persona.avatar)) return 'NATIVE_PERSONA_AVATAR_UNAVAILABLE'
      updateProfile(catalog.profiles[id]!, mutation.persona)
      setDefault(catalog, id, mutation.persona.is_default)
      return null
    }
    case 'select': {
      if (!own(catalog.profiles, mutation.id)) return 'NATIVE_PERSONA_NOT_FOUND'
      catalog.selectedId = mutation.id
      return null
    }
    case 'update-current': {
      let id = catalog.selectedId
      if (id === null) {
        const hasName = Boolean(mutation.values.name?.trim())
        const hasGender = Boolean(mutation.values.gender?.trim())
        if (!hasName && !hasGender) return null
        const name = hasName ? mutation.values.name! : '用户'
        id = generatedId(catalog, name)
        put(catalog.profiles, id, { ...defaults, connections: [], name, gender: '' })
        put(catalog.avatars, id, defaultAvatar(id))
        catalog.selectedId = id
        updateProfile(catalog.profiles[id]!, { ...mutation.values, name })
        return null
      }
      updateProfile(catalog.profiles[id]!, mutation.values)
      return null
    }
    default: return 'NATIVE_PERSONA_OPERATION_INVALID'
  }
}

export function mutateNativePersona(operation: NativePersonaOperationV1, current?: () => boolean): NativePersonaMutationResultV1 {
  return mutateDocument(operation, current)
}
function mutateDocument(operation: NativePersonaOperationV1, current?: () => boolean, extras?: RecordValue): NativePersonaMutationResultV1 {
  if (operation?.schemaVersion !== 1 || operation.encoding !== 'native-account-persona-operation-v1' ||
    !operation.operationId || !operation.origin || !operation.mutation) return refused('NATIVE_PERSONA_OPERATION_INVALID')
  const document = readDocument()
  const catalog = catalogOf(document)
  const payloadSha256 = hash(operation)
  const recorded = own(catalog.receipts, operation.operationId) ? catalog.receipts[operation.operationId] : undefined
  // Durable replay precedes the optimistic basis: a lost ACK must retain its
  // original boolean and generated identity even after another writer commits.
  if (recorded) return recorded.payloadSha256 === payloadSha256
    ? { schemaVersion: 1, kind: 'committed', receipt: recorded, data: project(catalog) }
    : refused('NATIVE_PERSONA_OPERATION_CONFLICT')
  const before = project(catalog)
  if (operation.expectedDataSha256 && operation.expectedDataSha256 !== before.dataSha256)
    return refused('NATIVE_PERSONA_DATA_CHANGED')
  const beforeSemantic = hash({ profiles: catalog.profiles, avatars: catalog.avatars,
    selectedId: catalog.selectedId, defaultId: catalog.defaultId })
  const result = applyMutation(catalog, operation)
  if (typeof result === 'string') return refused(result)
  const changed = beforeSemantic !== hash({ profiles: catalog.profiles, avatars: catalog.avatars,
    selectedId: catalog.selectedId, defaultId: catalog.defaultId })
  if (changed) catalog.revision += 1
  const data = project(catalog)
  const receipt: NativePersonaReceiptV1 = {
    schemaVersion: 1, encoding: 'native-account-persona-receipt-v1', operationId: operation.operationId,
    payloadSha256, origin: operation.origin, revision: catalog.revision, dataSha256: data.dataSha256, changed, result,
  }
  put(catalog.receipts, operation.operationId, receipt)
  document.nextTavernPersonas = catalog
  const extrasChanged = extras !== undefined && Object.keys(extras)
    .some(key => stableJson(document[key]) !== stableJson(extras[key]))
  if (extras) for (const [key, value] of Object.entries(extras)) put(document, key, value)
  if (changed || extrasChanged) {
    document.updatedAt = Date.now()
    const selected = catalog.selectedId === null ? undefined : catalog.profiles[catalog.selectedId]
    if (selected) { document.name = selected.name; document.gender = selected.gender ?? '' }
  }
  if (!commit(document, changed || extrasChanged, current)) return refused('NATIVE_PERSONA_OWNER_CHANGED')
  return { schemaVersion: 1, kind: 'committed', receipt, data }
}

export function retryNativePersona(operationId: string, current?: () => boolean, sessionId?: string): NativePersonaMutationResultV1 {
  const catalog = catalogOf(readDocument())
  const recorded = own(catalog.receipts, operationId) ? catalog.receipts[operationId] : undefined
  if (!recorded) return refused('NATIVE_PERSONA_OPERATION_NOT_RECORDED')
  if ((current && !current()) || (sessionId !== undefined && recorded.origin.sessionId !== sessionId))
    return refused('NATIVE_PERSONA_OWNER_CHANGED')
  return { schemaVersion: 1, kind: 'committed', receipt: recorded, data: project(catalog) }
}

/** Legacy writes update the current profile; a stale raw document never owns
 * the catalog. Account extensions are merged into the freshly read document. */
export function writeUserInfo(record: unknown): void {
  if (!object(record)) throw new Error('Native userinfo update must be an object')
  const values = { ...(record.name !== undefined ? { name: String(record.name) } : {}),
    ...(record.gender !== undefined ? { gender: String(record.gender) } : {}) }
  const extras = Object.fromEntries(Object.entries(record)
    .filter(([key]) => !['nextTavernPersonas', 'updatedAt', 'name', 'gender'].includes(key)))
  const result = mutateDocument({ schemaVersion: 1, encoding: 'native-account-persona-operation-v1',
    operationId: randomUUID(), origin: { kind: 'legacy' }, mutation: { kind: 'update-current', values } }, undefined, extras)
  if (result.kind === 'refused') throw new Error(result.code)
}
