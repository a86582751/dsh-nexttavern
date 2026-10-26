import type * as ReactAPI from 'react'
import type { NarrativePreset, StyleSelection, StyleMode } from '../core/narrative-presets.js'
import {projectConversationList, resolveConversationExecution} from './conversation-projection.js'
import type {ConversationCatalog, SessionList} from './conversation-projection.js'
import {createCommunityPresetPanel} from './community-preset-panel.js'
import {createCommunityRegexPanel} from './community-regex-panel.js'
import {createCommunityCardMappingPanel} from './community-card-mapping-panel.js'

export function presetConversationChoices(snapshot: SessionList, catalog: ConversationCatalog, isRoleplaySession: (id: string) => boolean) {
  const visible = projectConversationList(snapshot, catalog)
  return (visible.ids ?? []).filter(id => visible.byId?.[id]?.origin !== 'subagent' && (isRoleplaySession(id) || isRoleplaySession(resolveConversationExecution(id, catalog))))
    .map(id => ({id: resolveConversationExecution(id, catalog), label: String(visible.byId?.[id]?.title ?? visible.byId?.[id]?.displayTitle ?? `对话 ${id.slice(-8)}`)}))
}

interface Policy {
  revision: number; presets: NarrativePreset[]; global: StyleSelection; local: StyleSelection | null
  effective: StyleSelection; summary: string; conversationId: string
}
interface Dependencies {
  React: typeof ReactAPI
  jsonFetch<T>(url: string, init?: RequestInit): Promise<T>
  toast(text: string): void
  confirmWithDialog(document: Document, message: string, options?: {title?: string; confirmLabel?: string}): Promise<boolean>
  conversations(): Promise<{id: string; label: string}[]>
}
const modes: [StyleMode, string][] = [['system', '沿用系统美学'], ['blend', '融合卡片文风'], ['card', '完全采用卡片文风']]
const describe = (mode: StyleMode) => mode === 'system' ? '不注入卡片的叙事规则、回复规则、文风示例。' : mode === 'blend' ? '同时注入预设和卡片文风；冲突时预设优先。' : '只采用卡片文风，不注入预设正文。'
const sections=[
  ['selection','选择与导入'],['features','功能与方案'],['prompts','提示词条目'],
  ['style','创作文风'],['mapping','字段映射'],['regex','正则规则'],
] as const
type PresetSection=typeof sections[number][0]
export function createPresetPanel({React, jsonFetch, toast, confirmWithDialog, conversations}: Dependencies) {
  const h = React.createElement
  const communityToast=(text:string)=>{toast(text);window.dispatchEvent(new Event('dsh-community-preset-changed'))}
  const CommunityPanel=createCommunityPresetPanel({React,jsonFetch,toast:communityToast,conversations})
  const RegexPanel=createCommunityRegexPanel({React,jsonFetch,toast:communityToast,conversations})
  const CardMappingPanel=createCommunityCardMappingPanel({React,jsonFetch,toast})
  function Editor({sessionId, scope, onLocked}: {sessionId: string; scope: 'global' | 'conversation'; onLocked(value: boolean): void}) {
    const [data, setData] = React.useState<Policy | null>(null)
    const [selected, setSelected] = React.useState(''), [mode, setMode] = React.useState<StyleMode>('system')
    const [draft, setDraft] = React.useState<{name: string; text: string} | null>(null)
    const [creating, setCreating] = React.useState(false), [busy, setBusy] = React.useState(false), [error, setError] = React.useState('')
    const sequence = React.useRef(0)
    const accept = (value: Policy) => {
      setData(value)
      const selection = scope === 'global' ? value.global : value.effective
      setSelected(selection.presetId); setMode(selection.mode)
    }
    const load = async () => {
      const ticket = ++sequence.current
      setBusy(true); setError('')
      try { const value = await jsonFetch<Policy>(`/api/roleplay/presets?sessionId=${encodeURIComponent(sessionId)}`); if (ticket === sequence.current) accept(value) }
      catch (e) { if (ticket === sequence.current) setError(String((e as Error).message)) }
      finally { if (ticket === sequence.current) setBusy(false) }
    }
    React.useEffect(() => { void load(); return () => { sequence.current++ } }, [sessionId, scope])
    React.useEffect(() => { onLocked(busy || !!draft); return () => onLocked(false) }, [busy, draft])
    const preset = data?.presets.find(p => p.id === selected)
    const saved = data && (scope === 'global' ? data.global : data.effective)
    const pending = saved && (saved.presetId !== selected || saved.mode !== mode)
    const mutate = async (body: Record<string, unknown>) => {
      if (!data || busy) return
      const ticket = ++sequence.current
      setBusy(true); setError('')
      try {
        const value = await jsonFetch<Policy>('/api/roleplay/presets', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({...body, sessionId, expectedRevision: data.revision})})
        if (ticket !== sequence.current) return
        accept(value); setDraft(null); setCreating(false)
        if (body.action === 'create') setSelected(value.presets.find(p => !data.presets.some(old => old.id === p.id))?.id ?? value.effective.presetId)
        else if (body.action === 'update') setSelected(selected)
        toast(body.action === 'select' || body.action === 'inherit' ? '预设生效设置已保存，将用于后续生成' : '预设库已保存')
      } catch (e) { if (ticket === sequence.current) setError(String((e as Error).message)) }
      finally { if (ticket === sequence.current) setBusy(false) }
    }
    const button = (label: string, action: () => void, disabled = false) => h('button', {className: 'dsh-rp-btn', disabled: busy || disabled, onClick: action}, label)
    const discard = () => { setDraft(null); setCreating(false) }
    return h('div', {className: 'dsh-rp-preset-content'},
      error && h('div', {role: 'alert', className: 'dsh-rp-error'}, error),
      !data && h('p', {role: 'status'}, busy ? '正在读取预设…' : '预设暂时不可用'),
      button('刷新预设', () => void load(), !!draft),
      data && h('div', {className: 'dsh-rp-preset-content'},
        h('p', {className: 'dsh-rp-muted', role: 'status'}, scope === 'global' ? '全局设置供未单独覆盖的对话继承。' : data.local ? '该对话已单独设置，所有世界线共用。' : '该对话当前继承全局设置。'),
        h('div', {className: 'dsh-rp-item', 'aria-label': '当前生效规则'}, scope === 'global' ? `全局：${data.presets.find(p => p.id === data.global.presetId)?.name} · ${modes.find(m => m[0] === data.global.mode)?.[1]}。${describe(data.global.mode)}` : data.summary),
        h('label', null, '选择预设', h('select', {className: 'dsh-rp-input', 'aria-label': '选择预设', value: selected, disabled: busy || !!draft, onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)}, data.presets.map(p => h('option', {key: p.id, value: p.id}, p.name + (p.readonly ? '（系统）' : ''))))),
        h('label', null, '文风模式', h('select', {className: 'dsh-rp-input', 'aria-label': '文风模式', value: mode, disabled: busy || !!draft, onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as StyleMode)}, modes.map(([id, label]) => h('option', {key: id, value: id}, label)))),
        h('p', {className: 'dsh-rp-muted'}, describe(mode), mode !== 'card' && !preset?.text ? ' 空白正文不附加预设文风要求。' : ''),
        h('div', {className: 'dsh-rp-row'}, button('应用到所选范围', () => void mutate({action: 'select', scope, selection: {presetId: selected, mode}}), !!draft), scope === 'conversation' && button('清除对话覆盖，沿用全局', () => void mutate({action: 'inherit', scope}), !!draft || !data.local)),
        pending && h('p', {className: 'dsh-rp-muted'}, '选择尚未应用。点击“应用到所选范围”后生效。'),
        h('hr'), h('h4', null, '预设正文'),
        h('p', {className: 'dsh-rp-muted'}, '预设库由所有对话共享。修改已被使用的预设，会影响使用它的对话后续生成。系统预设只能查看或另存副本。'),
        h('div', {className: 'dsh-rp-row'}, button('新增预设', () => { setCreating(true); setDraft({name: '', text: ''}) }, !!draft), button('另存副本', () => { setCreating(true); setDraft({name: `${preset?.name ?? ''} 副本`, text: preset?.text ?? ''}) }, !!draft), button('修改预设', () => { setCreating(false); setDraft({name: preset!.name, text: preset!.text}) }, !!draft || !preset || preset.readonly), button('删除预设', () => { void (async () => { if (await confirmWithDialog(document, `删除「${preset?.name}」？正在使用的预设须先切换后才能删除。`, {title: '删除预设', confirmLabel: '删除'})) await mutate({action: 'delete', presetId: selected}) })() }, !!draft || !preset || preset.readonly)),
        draft && h('label', null, '预设名称', h('input', {className: 'dsh-rp-input', 'aria-label': '预设名称', value: draft.name, maxLength: 100, disabled: busy, onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => setDraft({...draft, name: e.target.value})})),
        h('textarea', {className: 'dsh-rp-input', 'aria-label': '顶层创作提示词', style: {width: '100%', minHeight: 360, resize: 'vertical', lineHeight: 1.65}, value: draft?.text ?? preset?.text ?? '', readOnly: !draft, disabled: busy, placeholder: '空白预设：不附加文风提示词', onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => draft && setDraft({...draft, text: e.target.value})}),
        draft && h('div', {className: 'dsh-rp-row'}, button('保存预设', () => void mutate({action: creating ? 'create' : 'update', presetId: selected, preset: draft}), !draft.name.trim()), button('取消编辑', discard))
      ))
  }
  return function PresetPanel({sessionId}: {sessionId: string}) {
    const [scope, setScope] = React.useState('current'), [target, setTarget] = React.useState('')
    const [locked, setLocked] = React.useState(false), [communityLocked,setCommunityLocked] = React.useState(false)
    const [mappingLocked,setMappingLocked]=React.useState(false),[regexLocked,setRegexLocked]=React.useState(false)
    const [section,setSection]=React.useState<PresetSection>('selection')
    const [visited,setVisited]=React.useState<readonly PresetSection[]>([])
    const root=React.useRef<HTMLElement|null>(null),prefix=React.useId()
    const [targets, setTargets] = React.useState<{id: string; label: string}[]>([]), [error, setError] = React.useState('')
    React.useEffect(() => { let live = true; conversations().then(value => { if (live) setTargets(value) }).catch(e => { if (live) setError(String((e as Error).message)) }); return () => { live = false } }, [sessionId])
    const actual = scope === 'target' ? target : sessionId
    const scopeLocked=locked||communityLocked||mappingLocked||regexLocked
    const lockReasons=[
      communityLocked&&'社区预设正在处理，或“提示词条目”有草稿待保存／取消',
      locked&&'“创作文风”正在处理或有草稿待保存／取消',
      mappingLocked&&'“字段映射”正在处理或有草稿，可保存或刷新放弃',
      regexLocked&&'“正则规则”正在处理或有草稿待保存／取消',
    ].filter(Boolean)
    const activate=(next:PresetSection)=>{
      setSection(next)
      if(['style','mapping','regex'].includes(next))setVisited(before=>before.includes(next)?before:[...before,next])
      if(root.current)root.current.scrollTop=0
    }
    const keydown=(event:ReactAPI.KeyboardEvent<HTMLButtonElement>,index:number)=>{
      let next:number
      if(event.key==='ArrowRight')next=(index+1)%sections.length
      else if(event.key==='ArrowLeft')next=(index+sections.length-1)%sections.length
      else if(event.key==='Home')next=0
      else if(event.key==='End')next=sections.length-1
      else return
      event.preventDefault()
      const id=sections[next]![0]
      activate(id)
      event.currentTarget.ownerDocument.getElementById(`${prefix}-tab-${id}`)?.focus()
    }
    const panel=(id:PresetSection)=>({
      id:`${prefix}-panel-${id}`,role:'tabpanel','aria-labelledby':`${prefix}-tab-${id}`,
      hidden:section!==id,className:'dsh-rp-preset-content',tabIndex:0,
    })
    return h('section', {ref:root,className: 'dsh-rp-panel dsh-rp-presets', 'aria-label': '预设'},
      h('div',{className:'dsh-rp-preset-heading'},h('div',null,h('h3',null,'预设'),
        h('p',{className:'dsh-rp-muted'},'管理社区预设与创作文风，为后续生成选择规则。'))),
      h('div',{className:'dsh-rp-preset-scope'},
      h('label', null, '生效范围', h('select', {className: 'dsh-rp-input', 'aria-label': '生效范围', value: scope, disabled: scopeLocked, onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => setScope(e.target.value)}, [['current', '当前对话'], ['target', '指定对话'], ['global', '全局']].map(([id, label]) => h('option', {key: id, value: id}, label)))),
      scope === 'target' && h('label', null, '指定对话', h('select', {className: 'dsh-rp-input', 'aria-label': '指定对话', value: target, disabled: scopeLocked, onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => setTarget(e.target.value)}, h('option', {value: ''}, '请选择对话'), targets.map(item => h('option', {key: item.id, value: item.id}, item.label)))),
      scope === 'target' && error && h('p', {role: 'alert'}, error)),
      scopeLocked&&h('p',{role:'status',className:'dsh-rp-preset-lock'},`生效范围暂不可切换。${lockReasons.join('；')}。可切换下方标签查看。`),
      h('div',{role:'tablist','aria-label':'预设功能分类',className:'dsh-rp-preset-tabs'},sections.map(([id,label],index)=>
        h('button',{key:id,type:'button',role:'tab',id:`${prefix}-tab-${id}`,'aria-controls':`${prefix}-panel-${id}`,
          'aria-selected':section===id,tabIndex:section===id?0:-1,className:'dsh-rp-btn',
          onClick:()=>activate(id),onKeyDown:(event:ReactAPI.KeyboardEvent<HTMLButtonElement>)=>keydown(event,index)},label))),
      !actual&&h('p',{role:'status',className:'dsh-rp-muted'},'请选择要管理的对话。'),
      !actual&&sections.slice(0,3).map(([id])=>h('div',{...panel(id),key:id})),
      actual&&h(CommunityPanel,{key:`community:${scope}:${actual}`,sessionId:actual,
        scope:scope==='global'?'global':'conversation',onLocked:setCommunityLocked,idPrefix:prefix,
        view:['selection','features','prompts'].includes(section)?section as 'selection'|'features'|'prompts':'hidden'}),
      h('div',panel('style'),actual&&visited.includes('style')&&h(React.Fragment,null,h('h4',null,'创作文风'),
        h('p',{className:'dsh-rp-muted'},'额外的叙事与文风要求。可与社区预设分别选择。'),
        h(Editor, {key: `${scope}:${actual}`, sessionId: actual, scope: scope === 'global' ? 'global' : 'conversation', onLocked: setLocked}))),
      h('div',panel('mapping'),actual&&visited.includes('mapping')&&
        h(CardMappingPanel,{key:`card-mapping:${actual}`,sessionId:actual,onLocked:setMappingLocked})),
      h('div',panel('regex'),actual&&visited.includes('regex')&&
        h(RegexPanel,{key:`regex:${scope}:${actual}`,sessionId:actual,scope:scope==='global'?'global':'conversation',onLocked:setRegexLocked})))
  }
}
