export type CharacterRoute = ({ main: true } | { provider: string; model: string }) & {
  // Legacy validation coerces effort for matching but preserves the stored value.
  reasoningEffort?: unknown
}

export interface CharacterSettings {
  enabled: boolean
  defaultRoute: CharacterRoute | null
  characters: Record<string, CharacterRoute | null>
}

export function clusterRoute(raw: unknown): CharacterRoute | null {
  if (raw == null) return null
  const value = Object(raw) as Record<string, unknown>
  const { provider, model, reasoningEffort } = value
  if (reasoningEffort != null && !/^[a-zA-Z0-9_-]{1,64}$/.test(String(reasoningEffort))) throw new Error('思考等级无效')
  const effort = reasoningEffort ? { reasoningEffort } : {}
  if (value.main === true) return { main: true, ...effort }
  if (typeof provider !== 'string' || typeof model !== 'string' || !provider || !model || [provider, model].some((item) => item.length > 300 || /[\x00-\x1f]/.test(item))) throw new Error('角色模型无效')
  return { provider, model, ...effort }
}

export function clusterSettings(raw: unknown): CharacterSettings {
  const value = Object(raw) as Record<string, unknown>
  if (typeof value.enabled !== 'boolean') throw new Error('必须指定集群开关')
  const characters: Record<string, CharacterRoute | null> = {}
  for (const [id, route] of Object.entries(Object(value.characters ?? {}) as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('人物 ID 无效')
    characters[id] = clusterRoute(route)
  }
  return { enabled: value.enabled, defaultRoute: clusterRoute(value.defaultRoute), characters }
}

export interface CharacterInputSource {
  character: { id: string; name: unknown; content: unknown }
  core?: unknown
  stories: readonly { seq: number; kind: string; text: unknown }[]
  notes?: unknown
  lore: readonly { text: unknown }[]
  userText?: unknown
  branchId: string
  turn: number
}

export function characterInput({ character, core, stories, notes, lore, userText, branchId, turn }: CharacterInputSource) {
  return { schemaVersion: 1, branchId, turn, character: { id: character.id, name: character.name, content: character.content },
    core: String(core ?? ''), stories: stories.map(({ seq, kind, text }) => ({ seq, kind, text })),
    directorNotes: String(notes ?? ''), worldbook: lore.map(({ text }) => String(text)), playerInput: String(userText ?? '') }
}
