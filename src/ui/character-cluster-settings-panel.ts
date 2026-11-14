import type * as ReactAPI from 'react'
import {offscreenSettings, type CharacterRoute, type CharacterSettings} from '../core/character-cluster-projection.js'
import {updatePanelDraft, type PanelDraft} from './panel-state.js'
import {buildReasoningEffortOptions} from './settings-projection.js'

type Scope = 'session' | 'global'
type Page = 'offscreen' | 'models'
interface SettingsRecord extends CharacterSettings {revision: number}
interface ClusterReply {
  settings: SettingsRecord
  session: SettingsRecord
  global: SettingsRecord
  characters: {id: string; name: string}[]
}
interface ModelsReply {
  main?: {provider: string; model: string; reasoningEffort?: string}
  catalog?: {provider: string; model: string; label?: string;
    reasoning?: {efforts?: {id: string; name?: string}[]; defaultEffort?: string}}[]
}
interface FieldDraft extends PanelDraft {
  target: {sessionId: string; scope: Scope; page: Page}
  values: Record<string, unknown>
  bases: Record<string, unknown>
}
interface Dependencies {
  React: typeof ReactAPI
  sessionDrafts: Map<string, PanelDraft>
  jsonFetch<T>(url: string, init?: RequestInit): Promise<T>
}
const errorText = (error: unknown) => String(error instanceof Error ? error.message : error)
function field(record: SettingsRecord, key: string): unknown {
  if (key.startsWith('offscreen.')) return offscreenSettings(record.offscreen)[key.slice(10) as 'enabled'|'maxCharacters'|'route']
  if (key.startsWith('characters.')) {
    const id = key.slice(11)
    return Object.hasOwn(record.characters, id) ? record.characters[id] ?? null : null
  }
  return record.defaultRoute ?? null
}
function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  const a = left as CharacterRoute, b = right as CharacterRoute
  return ('main' in a ? a.main : undefined) === ('main' in b ? b.main : undefined)
    && ('provider' in a ? a.provider : undefined) === ('provider' in b ? b.provider : undefined)
    && ('model' in a ? a.model : undefined) === ('model' in b ? b.model : undefined)
    && a.reasoningEffort === b.reasoningEffort
}
function applyFields(current: SettingsRecord, values: Record<string, unknown>): SettingsRecord {
  const next = {...current, characters: {...current.characters}}
  const editsOffscreen = Object.keys(values).some(key => key.startsWith('offscreen.'))
  if (editsOffscreen) next.offscreen = offscreenSettings(current.offscreen)
  for (const [key, value] of Object.entries(values)) {
    if (key === 'defaultRoute') next.defaultRoute = value as CharacterRoute | null
    else if (key.startsWith('characters.')) Object.defineProperty(next.characters, key.slice(11), {
      value: value as CharacterRoute | null, enumerable: true, writable: true, configurable: true,
    })
    else if (key === 'offscreen.enabled') next.offscreen!.enabled = value as boolean
    else if (key === 'offscreen.maxCharacters') next.offscreen!.maxCharacters = Number(value)
    else if (key === 'offscreen.route') next.offscreen!.route = value as CharacterRoute | null
  }
  // Use the scheduler's actual schema/defaults, including configurable K > 2.
  if (editsOffscreen) next.offscreen = offscreenSettings(next.offscreen)
  return next
}
const describe = (value: unknown) => value == null ? '沿用默认'
  : typeof value === 'boolean' ? value ? '开启' : '关闭'
    : typeof value !== 'object' ? String(value)
      : ('main' in value ? '跟随主模型'
        : `${(value as {provider?: string}).provider} / ${(value as {model?: string}).model}`)
        + ` · 思考强度：${(value as CharacterRoute).reasoningEffort ?? '模型默认'}`

function mergeConfirmed(previous: ClusterReply, incoming: ClusterReply, local: boolean, roster: boolean): ClusterReply {
  const session = local && incoming.session.revision >= previous.session.revision ? incoming.session : previous.session
  const global = incoming.global.revision >= previous.global.revision ? incoming.global : previous.global
  return {...previous, session, global,
    settings: {...session, defaultRoute: global.revision > 0 ? global.defaultRoute : session.defaultRoute},
    characters: roster && session === incoming.session && global === incoming.global ? incoming.characters : previous.characters}
}

/** Concrete editors for the existing cluster settings owner. Mount these through
 * CharacterClusterPanel's render slots; no new settings store or model routing. */
export function createCharacterClusterSettingsPanels({React, sessionDrafts, jsonFetch}: Dependencies) {
  const h = React.createElement
  type SavedNotice = {sessionId: string; scope: Scope; data: ClusterReply}
  // Broadcast only an acknowledged owner reply; this holds no settings copy.
  const savedListeners = new Set<(notice: SavedNotice) => void>()
  function SettingsPanel({sessionId, scope, page}: {sessionId: string; scope: Scope; page: Page}) {
    const tab = `cluster-settings-${scope}-${page}`, key = `${sessionId}:${tab}`
    const [snapshot, setSnapshot] = React.useState<{sessionId: string; data: ClusterReply; models: ModelsReply} | null>(null)
    const [refresh, setRefresh] = React.useState(0), [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState('')
    const [characterId, setCharacterId] = React.useState(''), [query, setQuery] = React.useState('')
    const [conflict, setConflict] = React.useState<{key: string; current: Record<string, unknown>} | null>(null)
    const [, redraw] = React.useReducer(value => value + 1, 0)
    const target = React.useRef(key); target.current = key
    const pending = React.useRef(false)
    const data = snapshot?.sessionId === sessionId ? snapshot.data : null
    const models = snapshot?.sessionId === sessionId ? snapshot.models : null
    const draft = sessionDrafts.get(key) as FieldDraft | undefined
    const record = data?.[scope]
    const legacyGlobal = scope === 'global' && page === 'models' && record?.revision === 0
    React.useEffect(() => {
      const receive = (notice: SavedNotice) => setSnapshot(previous => {
        if (!previous || previous.sessionId !== sessionId) return previous
        if (notice.sessionId === sessionId) return {...previous, data: mergeConfirmed(previous.data, notice.data, true, false)}
        if (notice.scope !== 'global') return previous
        // The global default is shared; another branch's local settings and
        // roster remain owned by that branch's previously confirmed reply.
        return {...previous, data: mergeConfirmed(previous.data, notice.data, false, false)}
      })
      savedListeners.add(receive)
      return () => {savedListeners.delete(receive)}
    }, [sessionId])
    React.useEffect(() => {
      let live = true
      setError('')
      Promise.all([
        jsonFetch<ClusterReply>(`/api/roleplay/character-cluster?sessionId=${encodeURIComponent(sessionId)}`),
        jsonFetch<ModelsReply>(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`),
      ]).then(([data, models]) => {if (live) setSnapshot(previous => ({sessionId, models,
        data: previous?.sessionId === sessionId ? mergeConfirmed(previous.data, data, true, true) : data}))})
        .catch(reason => {if (live) setError(errorText(reason))})
      return () => {live = false}
    }, [key, refresh])
    const get = (name: string) => draft && name in draft.values ? draft.values[name] : record ? field(record, name) : null
    const change = (name: string, value: unknown) => {
      if (!record) return
      const prior = sessionDrafts.get(key) as FieldDraft | undefined
      updatePanelDraft(sessionDrafts, sessionId, tab, {
        target: {sessionId, scope, page}, dirty: true,
        bases: {...prior?.bases, [name]: prior && name in prior.bases ? prior.bases[name] : field(record, name)},
        values: {...prior?.values, [name]: value},
      })
      redraw()
    }
    const save = async () => {
      const captured = sessionDrafts.get(key) as FieldDraft | undefined
      if (!captured || pending.current) return
      const branch = captured.target.sessionId
      pending.current = true; setSaving(true); setError('')
      try {
        const current = await jsonFetch<ClusterReply>(`/api/roleplay/character-cluster?sessionId=${encodeURIComponent(branch)}`)
        const base = current[captured.target.scope]
        const differences = Object.fromEntries(Object.keys(captured.values).filter(name =>
          !same(field(base, name), captured.bases[name])).map(name => [name, field(base, name)]))
        if (Object.keys(differences).length) {
          if (target.current === key) {
            setConflict({key, current: differences})
            setSnapshot(previous => previous?.sessionId === branch
              ? {...previous, data: mergeConfirmed(previous.data, current, true, false)} : previous)
          }
          throw Error('这些字段已更新，草稿已保留；请核对当前值与玩家修改。')
        }
        const settings = captured.target.scope === 'global'
          ? {defaultRoute: captured.values.defaultRoute}
          : applyFields(base, captured.values)
        const saved = await jsonFetch<ClusterReply>('/api/roleplay/character-cluster', {
          method: 'POST', headers: {'content-type': 'application/json'},
          body: JSON.stringify({sessionId: branch, scope: captured.target.scope, settings, expectedRevision: base.revision}),
        })
        const latest = sessionDrafts.get(key) as FieldDraft | undefined
        if (latest === captured) sessionDrafts.delete(key)
        else if (latest) {
          // Typing while the request runs belongs to the next save. Advance only
          // fields this request actually saved, retaining its newer user values.
          const bases = {...latest.bases}
          for (const name of Object.keys(captured.values)) if (name in latest.values)
            bases[name] = field(saved[captured.target.scope], name)
          sessionDrafts.set(key, {...latest, bases})
        }
        for (const receive of savedListeners) receive({sessionId: branch, scope: captured.target.scope, data: saved})
        if (target.current === key) {
          setConflict(null); setError(''); redraw()
        }
      } catch (reason) {if (target.current === key) setError(errorText(reason))}
      finally {pending.current = false; setSaving(false)}
    }
    const selector = (label: string, name: string, defaultLabel: string) => {
      const route = get(name) as CharacterRoute | null
      const effective = route && 'main' in route ? {...models?.main, ...route}
        : route ?? (scope === 'global' ? models?.main : data?.settings.defaultRoute && 'main' in data.settings.defaultRoute
          ? {...models?.main, ...data.settings.defaultRoute} : data?.settings.defaultRoute ?? models?.main)
      const catalog = models?.catalog ?? []
      const model = effective && 'provider' in effective
        ? catalog.find(item => item.provider === effective.provider && item.model === effective.model) : undefined
      const value = route && 'main' in route ? 'main' : route && 'provider' in route ? `${route.provider}\u0000${route.model}` : ''
      const inheritedEffort = effective?.reasoningEffort == null ? '' : String(effective.reasoningEffort)
      const effort = route?.reasoningEffort == null ? route ? '' : inheritedEffort : String(route.reasoningEffort)
      const efforts = buildReasoningEffortOptions(model, effort)
      return h('div', {className: 'rp-cluster-settings-field', key: name},
        h('label', null, label, h('select', {'aria-label': label, value,
          onChange: (event: ReactAPI.ChangeEvent<HTMLSelectElement>) => {
            const selected = event.target.value
            if (!selected) change(name, null)
            else if (selected === 'main') change(name, {main: true})
            else {const [provider, model] = selected.split('\u0000'); change(name, {provider, model})}
          }}, h('option', {value: ''}, defaultLabel), h('option', {value: 'main'}, '跟随主模型（独立角色任务）'),
          value && value !== 'main' && !model ? h('option', {value}, `${describe(route)}（目录不可用，保留）`) : null,
          catalog.map(item => h('option', {key: `${item.provider}:${item.model}`, value: `${item.provider}\u0000${item.model}`},
            `${item.label ?? item.model} · ${item.provider}`)))),
        h('label', null, `${label}思考强度`, h('select', {'aria-label': `${label}思考强度`,
          value: effort, disabled: !route || !model,
          onChange: (event: ReactAPI.ChangeEvent<HTMLSelectElement>) => {
            if (route) change(name, {...route, reasoningEffort: event.target.value || undefined})
          }}, efforts.map(option => h('option', {key: option.id, value: option.id}, String(option.name))))),
        h('p', null, `实际继承来源：${route ? '本页单独选择' : scope === 'global' ? '主模型' : '已保存集群默认模型'}；`
          + `当前解析：${describe(effective)}。`),
        !route ? h('p', null, '沿用默认时，思考强度也随默认模型。')
          : !model ? h('p', {role: 'status'}, '该模型不在当前目录，已保留原值；实际运行不可用时按任务合同显示失败，不静默换模型。') : null)
    }
    const title = page === 'offscreen' ? '当前对话场外推理' : scope === 'global' ? '全局默认模型' : '当前对话人物模型覆盖'
    const selected = data?.characters.find(character => character.id === characterId) ?? data?.characters[0]
    const fieldLabel = (name: string) => name === 'offscreen.enabled' ? '场外推理开关'
      : name === 'offscreen.maxCharacters' ? '每批最多人数'
        : name === 'offscreen.route' ? '场外推理模型'
          : name === 'defaultRoute' ? '全局默认角色模型'
            : `${data?.characters.find(character => character.id === name.slice(11))?.name ?? '该人物'}模型`
    return h('section', {className: 'rp-cluster-settings', 'aria-label': title},
      h('style', null, `
        .rp-cluster-settings{font-size:14px;line-height:1.6;overflow-wrap:anywhere}
        .rp-cluster-settings-field{border-top:1px solid var(--dsw-alias-border-l2,currentColor);padding:12px 0}
        .rp-cluster-settings label{display:block;margin:.5rem 0}
        .rp-cluster-settings :is(select,input[type=number]){display:block;box-sizing:border-box;width:100%;min-width:0;max-width:100%}
        .rp-cluster-settings :is(button,select,input){font:inherit;min-height:36px;border:1px solid var(--dsw-alias-border-l2,currentColor);border-radius:8px;background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;padding:5px 10px}
        .rp-cluster-settings input[type=checkbox]{min-height:0;width:auto;margin-right:8px}
        .rp-cluster-settings button{margin:4px 8px 4px 0;white-space:normal}
        .rp-cluster-settings-roster{display:flex;flex-wrap:wrap;max-height:12rem;overflow:auto;gap:4px}
        .rp-cluster-settings-roster button[aria-pressed=true]{color:var(--dsw-alias-brand-primary,inherit);border-color:currentColor}
        .rp-cluster-settings :is(button,select,input):focus-visible{outline:2px solid currentColor;outline-offset:3px}
      `),
      h('h4', null, title),
      error ? h('p', {role: 'alert'}, error) : null,
      !record ? h(React.Fragment, null, h('p', {role: 'status'}, '正在读取设置；未保存草稿会保留。'),
        h('button', {type: 'button', onClick: () => setRefresh(value => value + 1)}, '刷新设置')) : h(React.Fragment, null,
        page === 'offscreen' ? h(React.Fragment, null,
          h('label', null, h('input', {type: 'checkbox', checked: get('offscreen.enabled') === true,
            onChange: (event: ReactAPI.ChangeEvent<HTMLInputElement>) => change('offscreen.enabled', event.target.checked)}), '开启场外推理'),
          h('label', null, '每批最多人数', h('input', {type: 'number', min: 1, step: 1, 'aria-label': '每批最多人数',
            value: String(get('offscreen.maxCharacters') ?? 2),
            onChange: (event: ReactAPI.ChangeEvent<HTMLInputElement>) => change('offscreen.maxCharacters', event.target.value)})),
          selector('场外推理模型', 'offscreen.route', '沿用角色集群默认模型'),
          h('p', null, '默认每批最多 2 人，可配置更多；实际人数受有效候选与已有预算限制。场外模型独立于前台人物覆盖。'),
          h('p', null, '设置只影响后续批次；已运行批次保留冻结配置，关闭按既有取消合同停止。'))
          : scope === 'global' ? h(React.Fragment, null, selector('全局默认角色模型', 'defaultRoute', '跟随主模型'),
            legacyGlobal ? h('p', null, '全局默认尚未显式确认；各对话暂保留原有默认。保存此选择后才统一继承，不会开启集群。') : null)
            : h(React.Fragment, null,
              h('label', null, '搜索人物', h('input', {type: 'search', value: query, 'aria-label': '搜索人物模型',
                onChange: (event: ReactAPI.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)})),
              h('div', {className: 'rp-cluster-settings-roster', 'aria-label': '人物模型名单'},
                data?.characters.filter(character => character.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                  .map(character => h('button', {key: character.id, type: 'button',
                    'aria-pressed': selected?.id === character.id, onClick: () => setCharacterId(character.id)}, character.name))),
              selected ? selector(`${selected.name}模型`, `characters.${selected.id}`, '使用集群默认模型') : null,
              !data?.characters.length ? h('p', null, '尚无可设置的人物。') : null),
        conflict?.key === key ? h('div', {role: 'alert'},
          Object.entries(conflict.current).map(([name, value]) => h('div', {key: name},
            h('p', null, `${fieldLabel(name)}：当前 ${describe(value)}；玩家修改 ${describe(draft?.values[name])}`),
            h('details', null, h('summary', null, '定位详情'), h('code', null, name)))),
          h('button', {type: 'button', onClick: () => {
            const latest = sessionDrafts.get(key) as FieldDraft | undefined
            if (latest) sessionDrafts.set(key, {...latest, bases: {...latest.bases, ...conflict.current}})
            setConflict(null); setError(''); redraw()
          }}, '已核对，保留修改并采用当前版本')) : null,
        h('button', {type: 'button', disabled: saving || !draft?.dirty && !legacyGlobal, onClick: () => {
          if (!draft?.dirty && legacyGlobal) change('defaultRoute', record.defaultRoute ?? null)
          void save()
        }},
          saving ? '保存中…' : page === 'offscreen' ? '保存场外设置' : scope === 'global' ? '保存全局默认模型' : '保存人物模型覆盖'),
        h('button', {type: 'button', disabled: saving, onClick: () => {sessionDrafts.delete(key); setConflict(null); redraw()}}, '放弃本页草稿'),
        h('button', {type: 'button', onClick: () => setRefresh(value => value + 1)}, '刷新设置'),
        h('p', null, '查看、修改与保存设置不启动模型请求。只保存本页修改的字段，其他页面的草稿继续保留。')))
  }
  return {
    OffscreenSettingsPanel: ({sessionId}: {sessionId: string}) => h(SettingsPanel, {sessionId, scope: 'session', page: 'offscreen'}),
    ModelsPanel: ({sessionId, scope}: {sessionId: string; scope: Scope}) => h(SettingsPanel, {sessionId, scope, page: 'models'}),
  }
}
