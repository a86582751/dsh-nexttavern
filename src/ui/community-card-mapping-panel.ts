import type * as ReactAPI from 'react'

export interface CommunityCardMappingPanelDependencies {
  React:typeof ReactAPI
  jsonFetch<T>(url:string,init?:RequestInit):Promise<T>
  toast(text:string):void
}
type CardField='description'|'personality'|'scenario'|'persona'|'residual'
interface CardRange {start:number;end:number;field:CardField}
interface SavedGroup {identity:string;originalTextSha256:string;ranges:readonly CardRange[]}
interface SavedMapping {schemaVersion:1;groups:readonly SavedGroup[]}
interface RequiredGroup {
  identity:string
  currentText:string
  originalTextSha256:string
  fields:readonly CardField[]
  row:unknown
  field:'content'|'core'
  reason:string
}
interface MappingReply {
  ok:boolean
  revision:number
  effective:{features:Record<string,unknown>}
  mapping:SavedMapping|null
  material:{kind:'mapped'}|{kind:'mapping-required';groups:readonly RequiredGroup[]}
  presetActive:boolean
}
interface GroupDraft {field:CardField;ranges:CardRange[];confirmed:boolean}
interface TextSelection {start:number;end:number}
const fields:readonly CardField[]=['description','personality','scenario','persona','residual']
const labels:Record<CardField,string>={description:'角色描述',personality:'角色性格',scenario:'场景',persona:'玩家',residual:'其他设定'}
const message=(error:unknown)=>error instanceof Error?error.message:String(error)

export function createCommunityCardMappingPanel({React,jsonFetch,toast}:CommunityCardMappingPanelDependencies) {
  const h=React.createElement
  return function CommunityCardMappingPanel({sessionId,onLocked}:{sessionId:string;onLocked?(value:boolean):void}) {
    const [data,setData]=React.useState<MappingReply|null>(null)
    const [drafts,setDrafts]=React.useState<Record<string,GroupDraft>>({})
    const [selections,setSelections]=React.useState<Record<string,TextSelection>>({})
    const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const [dirty,setDirty]=React.useState(false)
    const sequence=React.useRef(0)
    const textareas=React.useRef(new Map<string,HTMLTextAreaElement>())
    const url=`/api/roleplay/community-presets?sessionId=${encodeURIComponent(sessionId)}&action=card-mapping`

    const load=async()=>{
      const ticket=++sequence.current
      setBusy(true);setError('')
      try{
        const value=await jsonFetch<MappingReply>(url)
        if(ticket!==sequence.current)return
        if(!value.ok)throw new Error('无法读取此对话的角色字段归属。')
        setData(value)
        setDirty(false)
        setDrafts(value.material.kind==='mapping-required'?Object.fromEntries(value.material.groups.map(group=>[
          group.identity,{field:group.fields[0]??'residual',ranges:[],confirmed:false},
        ])): {})
        setSelections({})
      }catch(caught){if(ticket===sequence.current)setError(message(caught))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    React.useEffect(()=>{
      setData(null);setDrafts({});setSelections({});textareas.current.clear()
      void load()
      return()=>{sequence.current++}
    },[sessionId])
    React.useEffect(()=>{onLocked?.(busy||dirty);return()=>onLocked?.(false)},[busy,dirty,onLocked])

    const updateDraft=(identity:string,update:(draft:GroupDraft)=>GroupDraft)=>{
      setDirty(true)
      setDrafts(before=>{
        const current=before[identity]??{field:'residual',ranges:[],confirmed:false}
        return {...before,[identity]:update(current)}
      })
    }
    const addSelection=(identity:string)=>{
      const area=textareas.current.get(identity)
      const liveSelection=area?{start:area.selectionStart,end:area.selectionEnd}:undefined
      const selection=liveSelection&&liveSelection.end>liveSelection.start?liveSelection:selections[identity]
      const draft=drafts[identity]
      if(!selection||selection.end<=selection.start||!draft)return
      const range={...selection,field:draft.field}
      updateDraft(identity,current=>({
        ...current,ranges:[...current.ranges,range].sort((a,b)=>a.start-b.start||a.end-b.end),confirmed:true,
      }))
      setSelections(before=>{const next={...before};delete next[identity];return next})
    }
    const markResidual=(identity:string)=>{
      updateDraft(identity,current=>({...current,ranges:[],confirmed:true}))
      setSelections(before=>{const next={...before};delete next[identity];return next})
    }
    const removeRange=(identity:string,index:number)=>updateDraft(identity,current=>{
      const ranges=current.ranges.filter((_,row)=>row!==index)
      return {...current,ranges,confirmed:ranges.length>0}
    })
    const save=async()=>{
      if(!data||busy||data.material.kind!=='mapping-required')return
      const groups=data.material.groups
      if(!groups.every(group=>drafts[group.identity]?.confirmed))return
      const ticket=++sequence.current
      setBusy(true);setError('')
      try{
        const activeIdentities=new Set(groups.map(group=>group.identity))
        const previous=(data.mapping?.groups??[]).filter(group=>!activeIdentities.has(group.identity))
        const confirmed=groups.map(group=>({identity:group.identity,originalTextSha256:group.originalTextSha256,
          ranges:drafts[group.identity]!.ranges}))
        const features={...data.effective.features,nativeCardMapping:{schemaVersion:1,groups:[...previous,...confirmed]}}
        const result=await jsonFetch<{ok?:boolean;error?:string}>('/api/roleplay/community-presets',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({action:'configure',scope:'conversation',sessionId,expectedRevision:data.revision,
            patch:{features}}),
        })
        if(ticket!==sequence.current)return
        if(result.ok===false)throw new Error(result.error??'角色字段归属保存失败。')
        toast('此对话的角色字段归属已保存')
        await load()
        window.dispatchEvent(new Event('dsh-community-preset-changed'))
      }catch(caught){if(ticket===sequence.current)setError(message(caught))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }

    const button=(label:string,onClick:()=>void,disabled=false)=>h('button',{
      type:'button',className:'dsh-rp-btn',disabled:busy||disabled,onClick,
    },label)
    const mappedSummary=()=>{
      const groups=data?.mapping?.groups??[]
      if(!groups.length)return h('p',{className:'dsh-rp-muted'},'当前内容的角色字段归属已确认，无需补充映射。')
      return h('div',null,
        h('p',{className:'dsh-rp-muted'},'已确认字段归属；未选内容会保留为其他设定。'),
        h('ul',null,groups.map((group,index)=>{
          const mapped:CardField[]=group.ranges.length?[...new Set(group.ranges.map(range=>range.field))]:['residual']
          return h('li',{key:group.identity},`第 ${index+1} 组：${mapped.map(field=>labels[field]).join('、')}`)
        })),
      )
    }
    const mappingEditor=()=>{
      if(!data||data.material.kind!=='mapping-required')return null
      return h('div',null,
        h('p',{className:'dsh-rp-muted'},'此映射只影响当前对话。未选择的文字会保留为其他设定。'),
        data.material.groups.map((group,index)=>{
          const draft=drafts[group.identity]??{field:'residual' as const,ranges:[],confirmed:false}
          const selection=selections[group.identity]
          return h('fieldset',{key:group.identity,disabled:busy},
            h('legend',null,`待确认文字组 ${index+1}`),
            h('label',null,'当前角色文字',h('textarea',{ref:(node:HTMLTextAreaElement|null):void=>{
              if(node)textareas.current.set(group.identity,node)
              else textareas.current.delete(group.identity)
            },className:'dsh-rp-input','aria-label':`当前角色文字组 ${index+1}`,value:group.currentText,readOnly:true,rows:8,
            style:{width:'100%',boxSizing:'border-box'},onSelect:(event:ReactAPI.SyntheticEvent<HTMLTextAreaElement>)=>{
              const area=event.currentTarget
              setSelections(before=>({...before,[group.identity]:{start:area.selectionStart,end:area.selectionEnd}}))
            }})),
            h('label',null,'所选文字归入',h('select',{className:'dsh-rp-input','aria-label':`所选文字归入字段 ${index+1}`,
              value:draft.field,onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>updateDraft(group.identity,current=>({
                ...current,field:event.target.value as CardField,
              }))},fields.map(field=>h('option',{key:field,value:field},labels[field])))),
            button('添加所选范围',()=>addSelection(group.identity),!selection||selection.end<=selection.start),
            button('全部作为其他设定',()=>markResidual(group.identity)),
            draft.ranges.length?h('ul',null,draft.ranges.map((range,rangeIndex)=>h('li',{
              key:`${range.start}:${range.end}:${rangeIndex}`,
            },h('span',null,`${labels[range.field]}：${group.currentText.slice(range.start,range.end)}`),
            button('删除',()=>removeRange(group.identity,rangeIndex))))):h('p',{className:'dsh-rp-muted',role:'status'},
              draft.confirmed?'已确认：全部作为其他设定。':'选择一段文字，或确认整组都作为其他设定。'),
          )
        }),
        button('保存此对话的字段归属',()=>void save(),!data.material.groups.length
          ||!data.material.groups.every(group=>drafts[group.identity]?.confirmed)),
      )
    }

    return h('section',{className:'dsh-rp-panel','aria-label':'角色字段归属'},
      h('h4',null,'角色字段归属'),
      error&&h('div',{role:'alert',className:'dsh-rp-error'},error),
      button('刷新字段归属',()=>void load()),
      !data&&h('p',{role:'status'},busy?'正在读取字段归属…':'尚无字段归属数据'),
      data&&!data.presetActive&&h('p',{className:'dsh-rp-muted',role:'status'},'请先启用当前对话的社区预设，再查看或调整角色字段归属。'),
      data&&data.presetActive&&data.material.kind==='mapped'&&mappedSummary(),
      data&&data.presetActive&&data.material.kind==='mapping-required'&&mappingEditor(),
    )
  }
}
