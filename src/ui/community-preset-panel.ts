import type * as ReactAPI from 'react'
import type {CommunityPresetPolicy,CommunitySelection} from '../core/community-presets.js'
import type {CommunityJson,CommunityPresetPrompt,CommunityPresetV1} from '../core/community-preset-types.js'
import {communityBetweenOptions} from '../core/community-preset-controls.js'
export {communityBetweenOptions} from '../core/community-preset-controls.js'

export interface CommunityPanelDependencies {
  React:typeof ReactAPI
  jsonFetch<T>(url:string,init?:RequestInit):Promise<T>
  toast(text:string):void
  conversations():Promise<{id:string;label:string}[]>
}
type Data=Record<string,CommunityJson>
const object=(value:unknown):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value as Data:{}
const list=(value:unknown):CommunityJson[]=>Array.isArray(value)?value:[]
const message=(error:unknown)=>error instanceof Error?error.message:String(error)
const mutationNotices:Readonly<Record<string,string>>={
  import:'社区预设已导入预设库；点击“应用社区预设”后生效',
  'import-plans':'方案包已导入；预览后显式应用',
  select:'社区预设已应用，将用于后续生成',
  inherit:'已沿用全局社区预设',
  copy:'社区预设副本已保存到预设库，尚未应用',
  delete:'社区预设已删除',
  update:'预设库修改已保存',
  'save-plan':'当前方案已保存',
  'apply-plans':'所选方案已应用',
}
export function downloadCommunityJson(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click()
  URL.revokeObjectURL(url)
}
interface PromptDraft {presetId:string;name:string;prompts:CommunityPresetPrompt[];order:string[]}
interface PlanPreview {changed?:{identifier:string;name:string;before:boolean;after:boolean}[];unresolved?:{id?:string;name?:string}[]}
export type CommunityPresetView='selection'|'features'|'prompts'|'hidden'|'all'

export function createCommunityPresetPanel({React,jsonFetch,toast}:CommunityPanelDependencies) {
  const h=React.createElement
  return function CommunityPresetPanel({sessionId,scope,onLocked,view='all',idPrefix}:{
    sessionId:string;scope:'global'|'conversation';onLocked?(value:boolean):void
    view?:CommunityPresetView;idPrefix?:string
  }) {
    const showSelection=view==='all'||view==='selection'
    const showFeatures=view==='all'||view==='features'
    const showPrompts=view==='all'||view==='prompts'
    const [policy,setPolicy]=React.useState<CommunityPresetPolicy|null>(null)
    const [selected,setSelected]=React.useState(''),[preset,setPreset]=React.useState<CommunityPresetV1|null>(null)
    const [draft,setDraft]=React.useState<PromptDraft|null>(null),[query,setQuery]=React.useState('')
    const [showHidden,setShowHidden]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const [readingFile,setReadingFile]=React.useState(''),[importStatus,setImportStatus]=React.useState('')
    const [values,setValues]=React.useState<Record<string,string>>({}),[chosenPlans,setChosenPlans]=React.useState<string[]>([])
    const [preview,setPreview]=React.useState<PlanPreview|null>(null),[planName,setPlanName]=React.useState('')
    const [planLayer,setPlanLayer]=React.useState('structure'),[planSection,setPlanSection]=React.useState('')
    const sequence=React.useRef(0),presetSequence=React.useRef(0),abort=React.useRef<AbortController|null>(null)
    const current=policy&&(scope==='global'?policy.global:policy.effective)
    const working=busy||!!readingFile
    const api=`/api/roleplay/community-presets?sessionId=${encodeURIComponent(sessionId)}`
    const load=async(initial=false)=>{
      const ticket=++sequence.current;abort.current?.abort();const controller=new AbortController();abort.current=controller
      setBusy(true);setError('')
      try{
        const value=await jsonFetch<CommunityPresetPolicy>(api,{signal:controller.signal})
        if(ticket!==sequence.current)return
        setPolicy(value);setPreview(null)
        if(initial)setSelected((scope==='global'?value.global:value.effective).presetId??'')
        if(value.preset?.id===selected)setPreset(value.preset)
      }catch(e){if(ticket===sequence.current)setError(message(e))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    React.useEffect(()=>{
      setDraft(null);setPreset(null);setPolicy(null);setValues({});setChosenPlans([]);setPreview(null);setReadingFile('');setImportStatus('')
      void load(true)
      return()=>{sequence.current++;presetSequence.current++;abort.current?.abort()}
    },[sessionId,scope])
    React.useEffect(()=>{onLocked?.(working||!!draft);return()=>onLocked?.(false)},[working,draft,onLocked])
    React.useEffect(()=>{
      const ticket=++presetSequence.current,controller=new AbortController()
      if(!selected){setPreset(null);return()=>controller.abort()}
      if(policy?.preset?.id===selected){setPreset(policy.preset);return()=>controller.abort()}
      setPreset(null)
      void jsonFetch<{preset:CommunityPresetV1}>(`${api}&presetId=${encodeURIComponent(selected)}`,{signal:controller.signal})
        .then(value=>{if(ticket===presetSequence.current)setPreset(value.preset)})
        .catch(e=>{if(ticket===presetSequence.current&&!controller.signal.aborted)setError(message(e))})
      return()=>controller.abort()
    },[selected,sessionId,scope,policy?.revision])
    const mutate=async(body:Record<string,unknown>,clearDraft=false)=>{
      if(!policy||busy)return null
      const ticket=++sequence.current;setBusy(true);setError('')
      try{
        const value=await jsonFetch<CommunityPresetPolicy&{importedId?:string;preview?:PlanPreview}>(api,{method:'POST',
          headers:{'content-type':'application/json'},body:JSON.stringify({...body,sessionId,scope,expectedRevision:policy.revision})})
        if(ticket!==sequence.current)return null
        if(body.action==='preview-plans'){setPreview(value.preview??{});return value}
        setPolicy(value);setPreview(null);if(clearDraft)setDraft(null)
        if(value.importedId)setSelected(value.importedId)
        if(body.action==='delete'){setSelected('');setPreset(null)}
        if(body.action==='select')setImportStatus('社区预设已应用，将用于后续生成。')
        if(body.action==='inherit')setImportStatus('已沿用全局社区预设。')
        if(value.preset?.id===selected)setPreset(value.preset)
        toast(mutationNotices[String(body.action)]??'社区预设设置已保存');return value
      }catch(e){
        if(ticket===sequence.current)setError(body.fileName?`「${String(body.fileName)}」导入失败：${message(e)}`:message(e))
        return null
      }
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    const button=(label:string,action:()=>void,disabled=false)=>h('button',{type:'button',className:'dsh-rp-btn',disabled:working||disabled,onClick:action},label)
    const input=(label:string,value:string,onChange:(value:string)=>void,type='text',disabled=false)=>h('label',null,label,
      h('input',{className:'dsh-rp-input','aria-label':label,type,value,disabled:working||disabled,
        onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>onChange(event.target.value)}))
    const checkbox=(label:string,checked:boolean,onChange:(checked:boolean)=>void,disabled=false)=>h('label',{key:label,className:'dsh-rp-row'},
      h('input',{type:'checkbox','aria-label':label,checked,disabled:working||disabled,
        onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>onChange(event.target.checked)}),label)
    const valueFor=(key:string,fallback='')=>values[key]??fallback
    const setValue=(key:string,value:string)=>setValues(before=>({...before,[key]:value}))
    const configure=(patch:Record<string,unknown>)=>void mutate({action:'configure',patch})
    const features=object(current?.features[preset?.profile.id??''])
    const feature=(path:string[])=>{
      let saved:CommunityJson|undefined=features,base:CommunityJson|undefined=object(preset?.profile.configuration[preset?.profile.id??''])
      for(const key of path){saved=object(saved)[key];base=object(base)[key]}
      return saved??base
    }
    const setFeature=(path:string[],value:CommunityJson)=>{
      if(!preset||!current)return
      const next=structuredClone(features);let cursor=next
      for(const key of path.slice(0,-1)){const child={...object(cursor[key])};cursor[key]=child;cursor=child}
      cursor[path.at(-1)!]=value
      configure({features:{...current.features,[preset.profile.id]:next}})
    }
    const importFile=async(file:File|undefined,plans=false)=>{
      if(!file)return
      const ticket=sequence.current
      setReadingFile(file.name);setImportStatus('');setError('')
      try{
        const rawText=await file.text();if(ticket!==sequence.current)return
        setReadingFile('');setImportStatus(`正在导入「${file.name}」…`)
        const result=await mutate({action:plans?'import-plans':'import',presetId:selected,fileName:file.name,rawText})
        if(result)setImportStatus(plans?`「${file.name}」导入成功。预览后应用所选方案。`
          :`「${file.name}」导入成功。检查下方内容后，点击“应用社区预设”使其生效。`)
        else setImportStatus(`「${file.name}」导入失败，可重新选择文件重试。`)
      }catch(e){if(ticket===sequence.current){setReadingFile('');setError(`「${file.name}」导入失败：${message(e)}`)}}
    }
    const download=async(plans=false)=>{
      const ticket=sequence.current
      try{
        const value=await jsonFetch<unknown>(`${api}&presetId=${encodeURIComponent(selected)}&action=${plans?'export-plans':'export'}`)
        if(ticket!==sequence.current)return
        const exported=plans?object(value).pack:object(value).data
        if(plans&&!exported)throw Error('所选预设没有方案包')
        downloadCommunityJson(exported,`${preset?.name??'community'}${plans?'-plans':''}.json`)
      }catch(e){if(ticket===sequence.current)setError(message(e))}
    }
    const edit=()=>preset&&setDraft({presetId:preset.id,name:preset.name,
      prompts:structuredClone(preset.prompts),order:(preset.promptOrder.length?preset.promptOrder
        :preset.prompts.filter(prompt=>!prompt.unused)).map(row=>row.identifier)})
    const changePrompt=(identifier:string,patch:Partial<CommunityPresetPrompt>)=>setDraft(before=>before?{
      ...before,prompts:before.prompts.map(prompt=>prompt.identifier===identifier?{...prompt,...patch}:prompt),
    }:before)
    const movePrompt=(identifier:string,direction:number)=>{
      if(!draft)return
      const order=[...draft.order],index=order.indexOf(identifier),target=index+direction
      if(index<0||target<0||target>=order.length)return
      ;[order[index],order[target]]=[order[target]!,order[index]!];setDraft({...draft,order})
    }
    const togglePrompt=(prompt:CommunityPresetPrompt,enabled:boolean)=>{
      if(current)configure({prompts:{...current.prompts,[prompt.identifier]:enabled}})
    }
    const control=(groupId:string,optionId:string,enabled:boolean,value?:unknown)=>
      void mutate({action:'control',presetId:selected,groupId,optionId,enabled,...(value===undefined?{}:{value})})
    const orderedPrompts=()=>{
      const prompts=draft?.prompts??preset?.prompts??[],order=draft?.order??preset?.promptOrder.map(row=>row.identifier)??[]
      const rank=new Map(order.map((id,index)=>[id,index]))
      return [...prompts].sort((a,b)=>(rank.get(a.identifier)??Infinity)-(rank.get(b.identifier)??Infinity))
    }
    const promptRows=showPrompts?orderedPrompts().filter(prompt=>(showHidden||!prompt.hidden)
      &&(!query||`${prompt.name} ${prompt.identifier} ${prompt.content}`.toLowerCase().includes(query.toLowerCase()))):[]
    const profileGroups=showFeatures?preset?.profile.groups.map(group=>h('fieldset',{key:group.id,disabled:working||!!draft},
      h('legend',null,group.label||group.id,group.mode==='single'?'（单选）':'（多选）'),group.options.map(option=>{
        const key=`${group.id}/${option.id}`,type=option.type
        if(type==='between'){
          const entries=communityBetweenOptions(preset,option)
          return h('div',{key},entries.length?entries.map(prompt=>h('label',{key:prompt.identifier,className:'dsh-rp-row'},
            h('input',{type:group.mode==='single'?'radio':'checkbox',name:`community-${group.id}`,
              'aria-label':`${group.label}：${prompt.name}`,checked:current?.prompts[prompt.identifier]??prompt.enabled,
              onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>control(group.id,option.id,event.target.checked,prompt.identifier)}),prompt.name))
            :h('p',{className:'dsh-rp-muted'},'未找到该分组边界，请在条目列表中查看。'))
        }
        if(type==='var_input'||type==='global_var_input')return h('div',{key},
          input(option.label,valueFor(key),value=>setValue(key,value)),
          button(`保存${option.label}`,()=>control(group.id,option.id,true,valueFor(key))))
        if(type==='parameters'){
          const variables=list(option.raw.variables).map(object)
          return h('details',{key},h('summary',null,option.label),variables.map(variable=>{
            const name=String(variable.name??''),label=String(variable.displayName??name),field=`${key}/${name}`
            return h('label',{key:name},label,h('textarea',{className:'dsh-rp-input','aria-label':`${option.label}：${label}`,
              value:valueFor(field),onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>setValue(field,event.target.value)}))
          }),button(`保存${option.label}参数`,()=>control(group.id,option.id,true,
            Object.fromEntries(variables.map(variable=>[String(variable.name),valueFor(`${key}/${variable.name}`)])))))
        }
        if(type!=='toggle')return h('p',{key,className:'dsh-rp-muted'},`${option.label}：宿主外部设置，暂不自动执行`)
        const targets=preset.prompts.filter(prompt=>option.enable.includes(prompt.identifier)||option.enable.includes(prompt.name))
        const enabled=targets.length>0&&targets.every(prompt=>current?.prompts[prompt.identifier]??prompt.enabled)
        return h('label',{key,className:'dsh-rp-row'},h('input',{type:group.mode==='single'?'radio':'checkbox',
          name:`community-${group.id}`,'aria-label':`${group.label}：${option.label}`,checked:option.id==='none'
            ?!preset.prompts.some(prompt=>group.disableGroup.includes(prompt.identifier)&&(current?.prompts[prompt.identifier]??prompt.enabled)):enabled,
          onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>control(group.id,option.id,event.target.checked)}),option.label)
      }))):undefined
    const canConfigure=preset?.id===current?.presetId
    const canManagePlans=canConfigure&&policy?.preset?.id===selected
    const pack=canManagePlans?policy?.planPack:null
    const transport=object(features.transport)
    const unmapped=Object.keys(preset?.parameters??{}).filter(key=>!['temperature','openai_max_tokens'].includes(key))
    const panel=(part:'selection'|'features'|'prompts')=>({
      role:idPrefix?'tabpanel':undefined,id:idPrefix?`${idPrefix}-panel-${part}`:undefined,
      'aria-labelledby':idPrefix?`${idPrefix}-tab-${part}`:undefined,
      hidden:view!=='all'&&view!==part,className:'dsh-rp-preset-content',
    })
    return h('section',{'aria-label':'社区预设',className:'dsh-rp-community','aria-busy':working,hidden:view==='hidden'},
      h('div',{className:'dsh-rp-preset-heading'},h('div',null,h('h4',null,
        view==='features'?'功能与方案':view==='prompts'?'提示词条目':'社区预设'),
        h('p',{className:'dsh-rp-muted'},showSelection?'导入酒馆 JSON 预设，选择后应用到当前范围。'
          :preset?`正在查看：${preset.name}`:'先在“选择与导入”选择预设。')),
        button(draft?'刷新版本，保留草稿':'刷新社区预设',()=>void load())),
      error&&h('div',{role:'alert',className:'dsh-rp-error'},error,draft?'；本地草稿保留，可刷新版本后重试。':''),
      !policy&&h('p',{role:'status'},busy?'正在读取社区预设…':'暂无社区预设数据'),
      h('div',panel('selection'),showSelection&&h(React.Fragment,null,
      h('label',{className:'dsh-rp-preset-upload'},h('strong',null,'导入社区预设 JSON'),
        h('span',{className:'dsh-rp-muted'},'选择 .json 文件；导入后会保存在共享预设库。'),
        h('input',{type:'file',accept:'.json,application/json','aria-label':'导入社区预设JSON',
          disabled:working||!!draft||!policy,onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{
            const file=event.target.files?.[0];event.target.value='';void importFile(file)
          }})),
      h('p',{role:'status','aria-label':'社区预设导入状态',className:'dsh-rp-preset-import-status'},
        readingFile?`正在读取「${readingFile}」…`:busy&&importStatus===''?'正在处理…':importStatus),
      policy&&h('div',{className:'dsh-rp-preset-content'},
        h('p',{role:'status',className:'dsh-rp-muted'},scope==='global'?'编辑全局社区预设，供未覆盖的对话继承。'
          :policy.local?'该对话已有独立社区预设设置。':'该对话继承全局社区预设。'),
        h('label',null,'社区预设选择',h('select',{className:'dsh-rp-input','aria-label':'社区预设选择',value:selected,
          disabled:working||!!draft,onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>{
            setSelected(event.target.value);setChosenPlans([]);setPreview(null);setValues({});setImportStatus('')
          }},
          h('option',{value:''},'停用社区预设'),policy.presets.map(item=>h('option',{key:item.id,value:item.id},`${item.name} · ${item.profile}`)))),
        h('div',{className:'dsh-rp-row'},button('应用社区预设',()=>void mutate({action:'select',selection:{
          ...(current??{}),presetId:selected||null,...(selected!==current?.presetId?{prompts:{},contents:{},regexes:{},features:{}}:{}),
        } satisfies Partial<CommunitySelection>}),!!draft),
        scope==='conversation'&&button('社区预设沿用全局',()=>void mutate({action:'inherit'}),!!draft||!policy.local)),
        !policy.presets.length&&h('p',{className:'dsh-rp-preset-empty'},'预设库还是空的。先选择上方 JSON 文件，再在这里应用。'),
        preset&&h('div',null,
          h('p',{className:'dsh-rp-muted'},`${preset.profile.id} · ${preset.prompts.length}条目 · ${preset.regexes.length}条正则 · 来源 ${preset.source.fileName}`),
          h('div',{className:'dsh-rp-row'},button('导出社区预设',()=>void download()),
            button('复制社区预设',()=>void mutate({action:'copy',presetId:selected}),!!draft),
            view==='all'&&button('编辑预设库条目',edit,!!draft),
            button('删除社区预设',()=>void mutate({action:'delete',presetId:selected}),!!draft)))))),
      h('div',panel('features'),showFeatures&&preset&&h('div',null,
          !canConfigure&&h('p',{className:'dsh-rp-muted'},'当前仅查看该库条目。应用到所选范围后，可修改分组与生成设置。'),
          h('fieldset',{disabled:working||!!draft||!canConfigure},h('legend',null,'生成设置'),
            checkbox('应用预设采样参数',current?.applySampling??false,checked=>configure({applySampling:checked})),
            h('p',{className:'dsh-rp-muted'},'可映射：temperature（温度）、openai_max_tokens（最大输出长度）。stop 等其余字段暂不映射。'),
            unmapped.length>0&&h('details',null,h('summary',null,`保留但暂不映射的字段（${unmapped.length}）`),h('p',null,unmapped.join('、'))),
            ['kemini','reborn'].includes(preset.profile.id)&&checkbox('合成函数传输',transport.enabled as boolean??preset.profile.transport.enabled===true,
              enabled=>setFeature(['transport','enabled'],enabled)),
            preset.profile.id==='izumi'&&h('div',null,
              checkbox('advice转移',feature(['advice','enabled'])!==false,enabled=>setFeature(['advice','enabled'],enabled)),
              h('label',null,'advice放置位置',h('select',{'aria-label':'advice放置位置',className:'dsh-rp-input',
                value:String(feature(['advice','position'])??'tail'),
                onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setFeature(['advice','position'],event.target.value)},
                h('option',{value:'tail'},'上一条回复末尾'),h('option',{value:'head'},'思考后、正文前'))),
              checkbox('移除模型旧advice',feature(['advice','stripModelAdvice'])!==false,
                enabled=>setFeature(['advice','stripModelAdvice'],enabled)),
              input('advice继续指令',valueFor('advice-continue',String(feature(['advice','replacementText'])
                ??feature(['advice','continueText'])??'')),value=>setValue('advice-continue',value)),
              button('保存advice继续指令',()=>setFeature(['advice','replacementText'],valueFor('advice-continue',
                String(feature(['advice','replacementText'])??feature(['advice','continueText'])??'')))),
              checkbox('关键词处理',feature(['sanitizer','enabled'])!==false,enabled=>setFeature(['sanitizer','enabled'],enabled)),
              h('label',null,'关键词处理范围',h('select',{'aria-label':'关键词处理范围',className:'dsh-rp-input',value:String(feature(['sanitizer','scopeMode'])??'first_x'),
                onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setFeature(['sanitizer','scopeMode'],event.target.value)},
                [['first_x','前N层'],['forever','始终'],['none','不处理历史']].map(([value,label])=>h('option',{key:value,value},label)))),
              input('关键词处理层数',valueFor('sanitizer-threshold',String(feature(['sanitizer','threshold'])??10)),
                value=>setValue('sanitizer-threshold',value),'number'),
              button('保存关键词层数',()=>setFeature(['sanitizer','threshold'],
                Math.max(1,Math.min(9999,Number(valueFor('sanitizer-threshold',String(feature(['sanitizer','threshold'])??10)))||10)))),
              checkbox('超过范围后仅处理输入',feature(['sanitizer','inputOnlyAfterX'])!==false,enabled=>setFeature(['sanitizer','inputOnlyAfterX'],enabled)),
              checkbox('回复还原关键词',feature(['sanitizer','reverseEnabled'])!==false,enabled=>setFeature(['sanitizer','reverseEnabled'],enabled))),
            preset.profile.id==='reborn'&&h('div',null,
              checkbox('流式头行清洗',feature(['outputPreprocessing','enabled'])!==false,enabled=>setFeature(['outputPreprocessing','enabled'],enabled)),
              checkbox('独立消息后处理',feature(['postscript','enabled'])!==false,enabled=>setFeature(['postscript','enabled'],enabled))),
            preset.profile.id==='dream'&&h('div',null,
              checkbox('梦鲸消息整理',feature(['messageProcessing','enabled'])!==false,enabled=>setFeature(['messageProcessing','enabled'],enabled)),
              h('label',null,'历史压缩方式',h('select',{'aria-label':'历史压缩方式',value:String(feature(['messageProcessing','chat_history','type'])??'squash_into_one'),
                onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setFeature(['messageProcessing','chat_history','type'],event.target.value)},
                h('option',{value:'squash_into_one'},'合并全部历史'),h('option',{value:'squash_nearby'},'合并相邻同角色'))))),
          !!profileGroups?.length&&h('fieldset',{disabled:working||!!draft||!canConfigure},h('legend',null,'预设原生控制'),profileGroups),
          preset.profile.actions.length>0&&h('ul',null,preset.profile.actions.map(action=>h('li',{key:action.id},`${action.id}：后续接入（${action.reason}）`))),
          preset.profile.id==='izumi'&&h('fieldset',{disabled:working||!!draft||!canManagePlans},h('legend',null,'Izumi分层方案'),
            !canManagePlans&&h('p',{className:'dsh-rp-muted'},'当前对话采用的预设与所选预设不同，分层方案暂不可编辑。'),
            h('label',null,'导入Izumi方案包',h('input',{type:'file',accept:'.json,application/json','aria-label':'导入Izumi方案包',
              onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';void importFile(file,true)}})),
            h('p',{className:'dsh-rp-muted'},'导入仅保存方案与active记录；预览后显式应用。'),
            pack?.plans.map(plan=>checkbox(`${plan.name}（${plan.layer}${plan.section?'/'+plan.section:''}）`,chosenPlans.includes(plan.id),
              enabled=>{setChosenPlans(before=>enabled?[...before,plan.id]:before.filter(id=>id!==plan.id));setPreview(null)})),
            button('预览所选方案',()=>void mutate({action:'preview-plans',presetId:selected,planIds:chosenPlans}),!chosenPlans.length),
            preview&&h('div',{role:'status'},h('p',null,`将修改${preview.changed?.length??0}项；未解析${preview.unresolved?.length??0}项`),
              h('ul',null,preview.changed?.map(change=>h('li',{key:change.identifier},`${change.name}：${change.before?'开':'关'} → ${change.after?'开':'关'}`))),
              button('应用已预览方案',()=>void mutate({action:'apply-plans',presetId:selected,planIds:chosenPlans}))),
            input('方案名称',planName,setPlanName),
            h('label',null,'方案层',h('select',{'aria-label':'方案层',value:planLayer,
              onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>{setPlanLayer(event.target.value);setPlanSection('')}},
              ['structure','function','style'].map(layer=>h('option',{key:layer,value:layer},layer)))),
            h('label',null,'方案子区',h('select',{'aria-label':'方案子区',value:planSection,
              onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setPlanSection(event.target.value)},
              h('option',{value:''},'整层'),(planLayer==='structure'?['plain','tail','armor']:planLayer==='function'?['plain','tucao','thinking']:['plain'])
                .map(section=>h('option',{key:section,value:section},section)))),
            button('保存当前为方案',()=>void mutate({action:'save-plan',presetId:selected,name:planName,
              layer:planLayer,section:planSection,strict:true}),!planName.trim()),
            button('导出Izumi方案包',()=>void download(true),!pack)))),
      h('div',panel('prompts'),showPrompts&&preset&&h('div',null,
          view!=='all'&&button('编辑预设库条目',edit,!!draft),
          h('h4',null,`提示条目（${preset.prompts.length}）`),input('搜索提示条目',query,setQuery),
          checkbox('显示隐藏条目',showHidden,setShowHidden),
          draft&&h('div',null,input('社区预设名称',draft.name,name=>setDraft({...draft,name})),
            h('p',{className:'dsh-rp-muted'},'预设库编辑影响所有引用它的对话。草稿仅在保存后写入。'),
            button('保存预设库修改',()=>void mutate({action:'update',presetId:draft.presetId,name:draft.name,
              prompts:draft.prompts.filter(prompt=>!prompt.readOnly&&!prompt.configurationOnly),order:draft.order},true)),
            button('取消预设库编辑',()=>setDraft(null))),
          h('div',{className:'dsh-rp-preset-prompts'},promptRows.map(prompt=>h('details',{key:prompt.identifier},
            h('summary',null,prompt.name,prompt.marker?' [标记]':'',prompt.unused?' [未使用]':'',prompt.hidden?' [隐藏]':'',prompt.readOnly?' [只读]':''),
            checkbox(`启用条目：${prompt.name}`,current?.prompts[prompt.identifier]??prompt.enabled,
              enabled=>togglePrompt(prompt,enabled),!!draft||!canConfigure||prompt.configurationOnly),
            prompt.configurationOnly&&h('p',{className:'dsh-rp-muted'},'插件配置条目，不作为提示词发送。'),
            draft&&h('div',null,input(`名称：${prompt.identifier}`,prompt.name,name=>changePrompt(prompt.identifier,{name}),'text',prompt.readOnly||prompt.configurationOnly),
              h('label',null,'角色',h('select',{'aria-label':`角色：${prompt.identifier}`,disabled:working||prompt.readOnly||prompt.configurationOnly,value:prompt.role,
                onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>changePrompt(prompt.identifier,
                  {role:event.target.value as CommunityPresetPrompt['role']})},
                ['system','user','assistant'].map(role=>h('option',{key:role,value:role},role)))),
              input(`插入位置：${prompt.identifier}`,String(prompt.injectionPosition),
                value=>changePrompt(prompt.identifier,{injectionPosition:Number(value)}),'number',prompt.readOnly||prompt.configurationOnly),
              input(`深度：${prompt.identifier}`,String(prompt.injectionDepth),
                value=>changePrompt(prompt.identifier,{injectionDepth:Number(value)}),'number',prompt.readOnly||prompt.configurationOnly),
              input(`优先级：${prompt.identifier}`,String(prompt.injectionOrder),
                value=>changePrompt(prompt.identifier,{injectionOrder:Number(value)}),'number',prompt.readOnly||prompt.configurationOnly),
              button(`上移条目：${prompt.name}`,()=>movePrompt(prompt.identifier,-1),prompt.readOnly||draft.order.indexOf(prompt.identifier)<=0),
              button(`下移条目：${prompt.name}`,()=>movePrompt(prompt.identifier,1),prompt.readOnly||draft.order.indexOf(prompt.identifier)<0
                ||draft.order.indexOf(prompt.identifier)===draft.order.length-1),
              !draft.order.includes(prompt.identifier)&&button(`加入发送顺序：${prompt.name}`,()=>setDraft({...draft,
                order:[...draft.order,prompt.identifier],prompts:draft.prompts.map(item=>item.identifier===prompt.identifier?{...item,unused:false}:item)})),
              draft.order.includes(prompt.identifier)&&button(`移出发送顺序：${prompt.name}`,()=>setDraft({...draft,
                order:draft.order.filter(id=>id!==prompt.identifier),
                prompts:draft.prompts.map(item=>item.identifier===prompt.identifier?{...item,unused:true}:item)}))),
            h('textarea',{className:'dsh-rp-input','aria-label':`内容：${prompt.identifier}`,value:prompt.content,
              readOnly:!draft||prompt.readOnly||prompt.configurationOnly,disabled:working,style:{width:'100%',minHeight:120},
              onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>draft&&changePrompt(prompt.identifier,{content:event.target.value})})))))))
  }
}
