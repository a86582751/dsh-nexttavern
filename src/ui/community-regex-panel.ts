import type * as ReactAPI from 'react'
import type {CommunityPresetPolicy,CommunityRegexLibraryEntry,CommunityRegexOrigin} from '../core/community-presets.js'
import type {CommunityRegexRule} from '../core/community-preset-types.js'
import type {CommunityPanelDependencies} from './community-preset-panel.js'
import {downloadCommunityJson} from './community-preset-panel.js'

interface RegexDraft {id:string;name:string;rules:CommunityRegexRule[];bindingScope:'global'|'conversation'|'preset';presetId:string}
type RegexPolicy=CommunityPresetPolicy&{regexLibrary?:CommunityRegexLibraryEntry[]}
const message=(value:unknown)=>value instanceof Error?value.message:String(value)
const previewText=(value:unknown):string=>{
  if(typeof value==='string')return value
  if(value&&typeof value==='object'){
    const result=value as Record<string,unknown>
    if('result' in result)return previewText(result.result)
    if(typeof result.text==='string')return result.text
    if(typeof result.output==='string')return result.output
  }
  return ''
}
const originLabels:Record<CommunityRegexOrigin,string>={global:'全局正则',preset:'社区预设正则',scoped:'对话与角色卡正则'}
export function createCommunityRegexPanel({React,jsonFetch,toast}:CommunityPanelDependencies) {
  const h=React.createElement
  return function CommunityRegexPanel({sessionId,scope='conversation',onLocked}:{
    sessionId:string;scope?:'global'|'conversation';onLocked?(value:boolean):void
  }) {
    const [policy,setPolicy]=React.useState<RegexPolicy|null>(null),[selected,setSelected]=React.useState('')
    const [draft,setDraft]=React.useState<RegexDraft|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('')
    const [bindingScope,setBindingScope]=React.useState<'global'|'conversation'|'preset'>('global'),[presetId,setPresetId]=React.useState('')
    const [text,setText]=React.useState(''),[placement,setPlacement]=React.useState(2),[depth,setDepth]=React.useState(0)
    const [preview,setPreview]=React.useState<{prompt:string;display:string}|null>(null),[query,setQuery]=React.useState('')
    const sequence=React.useRef(0),abort=React.useRef<AbortController|null>(null)
    const api=`/api/roleplay/regexes?sessionId=${encodeURIComponent(sessionId)}`
    const accept=(value:RegexPolicy)=>{
      setPolicy(value)
      const library=value.regexLibrary??value.regexes
      if(!selected||!library.some(item=>item.id===selected))setSelected(library[0]?.id??'')
      if(!presetId)setPresetId(value.effective.presetId??value.presets[0]?.id??'')
    }
    const load=async()=>{
      const ticket=++sequence.current;abort.current?.abort();const controller=new AbortController();abort.current=controller
      setBusy(true);setError('')
      try{const value=await jsonFetch<RegexPolicy>(api,{signal:controller.signal});if(ticket===sequence.current)accept(value)}
      catch(e){if(ticket===sequence.current)setError(message(e))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    React.useEffect(()=>{
      setPolicy(null);setDraft(null);setSelected('');setPreview(null);void load()
      return()=>{sequence.current++;abort.current?.abort()}
    },[sessionId,scope])
    React.useEffect(()=>{onLocked?.(busy||!!draft);return()=>onLocked?.(false)},[busy,draft,onLocked])
    const mutate=async(body:Record<string,unknown>,clearDraft=false)=>{
      if(!policy||busy)return
      const ticket=++sequence.current;setBusy(true);setError('')
      try{
        const value=await jsonFetch<RegexPolicy>(api,{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({...body,sessionId,expectedRevision:policy.revision})})
        if(ticket!==sequence.current)return
        accept(value);if(clearDraft)setDraft(null);setPreview(null);toast('正则库已保存')
      }catch(e){if(ticket===sequence.current)setError(message(e))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    const library=policy?.regexLibrary??policy?.regexes??[]
    const entry=library.find(item=>item.id===selected)
    const globalProfile=policy?.presets.find(preset=>preset.id===policy.global.presetId)?.profile
    const displayedOrder=scope==='global'?(policy?.global.regexOrder??(globalProfile&&['kemini','reborn','izumi'].includes(globalProfile)
      ?['preset','global','scoped']:['global','preset','scoped']) as CommunityRegexOrigin[]):policy?.regexOrder??[]
    const edit=(entry:CommunityRegexLibraryEntry)=>setDraft({id:entry.id,name:entry.name,rules:structuredClone(entry.rules),
      bindingScope:entry.binding.scope,presetId:entry.binding.scope==='preset'?entry.binding.id??'':presetId})
    const changeRule=(index:number,patch:Partial<CommunityRegexRule>)=>setDraft(before=>before?{
      ...before,rules:before.rules.map((rule,at)=>at===index?{...rule,...patch}:rule),
    }:before)
    const move=(index:number,direction:number)=>{
      if(!draft)return
      const rules=[...draft.rules],target=index+direction
      if(target<0||target>=rules.length)return
      ;[rules[index],rules[target]]=[rules[target]!,rules[index]!];setDraft({...draft,rules})
    }
    const importFile=async(file:File|undefined)=>{
      if(!file)return
      const ticket=sequence.current
      try{const rawText=await file.text();if(ticket!==sequence.current)return
        await mutate({action:'import',rawText,fileName:file.name,bindingScope,presetId})
      }catch(e){if(ticket===sequence.current)setError(message(e))}
    }
    const runPreview=async()=>{
      if(!policy||busy)return
      const ticket=++sequence.current;setBusy(true);setError('')
      const call=(channel:'prompt'|'display')=>jsonFetch<unknown>(api,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'preview',sessionId,expectedRevision:policy.revision,text,channel,placement,depth})})
      try{
        const [prompt,display]=await Promise.all([call('prompt'),call('display')])
        if(ticket===sequence.current)setPreview({prompt:previewText(prompt),display:previewText(display)})
      }catch(e){if(ticket===sequence.current)setError(message(e))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    const sourceOrder=async(index:number,direction:number)=>{
      if(!policy||busy)return
      const order=[...displayedOrder],target=index+direction
      if(target<0||target>=order.length)return
      ;[order[index],order[target]]=[order[target]!,order[index]!]
      const ticket=++sequence.current;setBusy(true);setError('')
      try{
        const value=await jsonFetch<RegexPolicy>(`/api/roleplay/community-presets?sessionId=${encodeURIComponent(sessionId)}`,{
          method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'configure',sessionId,scope,
            expectedRevision:policy.revision,patch:{regexOrder:order}})})
        if(ticket===sequence.current)accept(value)
      }catch(e){if(ticket===sequence.current)setError(message(e))}
      finally{if(ticket===sequence.current)setBusy(false)}
    }
    const button=(label:string,action:()=>void,disabled=false)=>h('button',{className:'dsh-rp-btn',disabled:busy||disabled,onClick:action},label)
    const input=(label:string,value:string,onChange:(value:string)=>void,type='text')=>h('label',null,label,
      h('input',{className:'dsh-rp-input','aria-label':label,type,value,disabled:busy,
        onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>onChange(event.target.value)}))
    const checkbox=(label:string,checked:boolean,onChange:(checked:boolean)=>void,disabled=false)=>h('label',{key:label,className:'dsh-rp-row'},
      h('input',{type:'checkbox','aria-label':label,checked,disabled:busy||disabled,
        onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>onChange(event.target.checked)}),label)
    const bindingFields=(current:'global'|'conversation'|'preset',boundPreset:string,
      onScope:(value:'global'|'conversation'|'preset')=>void,onPreset:(value:string)=>void)=>h('div',null,
      h('label',null,'正则绑定范围',h('select',{'aria-label':draft?'编辑正则绑定范围':'导入正则绑定范围',className:'dsh-rp-input',value:current,disabled:busy,
        onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>onScope(event.target.value as typeof current)},
        h('option',{value:'global'},'全局'),h('option',{value:'conversation'},'当前对话'),h('option',{value:'preset'},'指定社区预设'))),
      current==='preset'&&h('label',null,'绑定社区预设',h('select',{'aria-label':'正则绑定社区预设',className:'dsh-rp-input',value:boundPreset,disabled:busy,
        onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>onPreset(event.target.value)},
        h('option',{value:''},'请选择'),policy?.presets.map(item=>h('option',{key:item.id,value:item.id},item.name)))))
    const rules=draft?.rules??entry?.rules??[]
    return h('section',{className:'dsh-rp-panel','aria-label':'独立正则库'},h('h4',null,'独立正则库'),
      h('p',{className:'dsh-rp-muted'},'正则可独立于社区预设使用。库编辑为共享修改，预览分别显示发送给模型与显示在界面的文本。'),
      error&&h('div',{role:'alert',className:'dsh-rp-error'},error,'；编辑草稿保留，可刷新版本后重试。'),
      button(draft?'刷新正则版本，保留草稿':'刷新正则库',()=>void load()),
      !policy&&h('p',{role:'status'},busy?'正在读取正则库…':'暂无正则库数据'),
      policy&&h('div',{style:{display:'flex',flexDirection:'column',gap:10}},
        h('fieldset',{disabled:busy||!!draft},h('legend',null,'导入与绑定'),bindingFields(bindingScope,presetId,setBindingScope,setPresetId),
          h('label',null,'导入正则JSON',h('input',{type:'file',accept:'.json,application/json','aria-label':'导入正则JSON',
            disabled:busy||bindingScope==='preset'&&!presetId,onChange:(event:ReactAPI.ChangeEvent<HTMLInputElement>)=>{
              const file=event.target.files?.[0];event.target.value='';void importFile(file)
            }}))),
        h('label',null,'正则库选择',h('select',{'aria-label':'正则库选择',className:'dsh-rp-input',value:selected,disabled:busy||!!draft,
          onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setSelected(event.target.value)},
          h('option',{value:''},'请选择正则库'),library.map(item=>h('option',{key:item.id,value:item.id},`${item.name} · ${item.binding.scope}`)))),
        entry&&h('div',null,h('p',{className:'dsh-rp-muted'},`${entry.rules.length}条规则；绑定${entry.binding.scope}${entry.binding.id?'：'+entry.binding.id:''}`),
          h('div',{className:'dsh-rp-row'},button('编辑正则库',()=>edit(entry),!!draft),
            button('导出正则库',()=>downloadCommunityJson(entry.rules.map(rule=>({...rule.raw,...rule,raw:undefined})),`${entry.name}.json`)),
            button('删除正则库',()=>void mutate({action:'delete',id:entry.id}),!!draft))),
        draft&&h('div',null,input('正则库名称',draft.name,name=>setDraft({...draft,name})),
          bindingFields(draft.bindingScope,draft.presetId,bindingScope=>setDraft({...draft,bindingScope}),presetId=>setDraft({...draft,presetId})),
          h('div',{className:'dsh-rp-row'},button('保存正则库',()=>void mutate({action:'update',...draft},true),
            !draft.name.trim()||draft.bindingScope==='preset'&&!draft.presetId),
            button('取消正则编辑',()=>setDraft(null)),button('新增正则规则',()=>setDraft({...draft,rules:[...draft.rules,{
              id:crypto.randomUUID(),scriptName:'新规则',findRegex:'',replaceString:'',trimStrings:[],placement:[2],disabled:true,
              markdownOnly:false,promptOnly:false,runOnEdit:false,substituteRegex:0,minDepth:null,maxDepth:null,raw:{},
            }]})))),
        input('搜索正则规则',query,setQuery),
        rules.map((rule,index)=>!query||`${rule.scriptName} ${rule.findRegex}`.toLowerCase().includes(query.toLowerCase())
          ?h('details',{key:`${rule.id}:${index}`},h('summary',null,rule.scriptName,rule.disabled?' [关闭]':' [开启]'),
            h('p',{className:'dsh-rp-muted'},`ID：${rule.id}`),
            checkbox(`启用正则：${rule.scriptName}`,!rule.disabled,enabled=>{
              if(draft)changeRule(index,{disabled:!enabled})
              else if(entry)void mutate({action:'update',id:entry.id,rules:entry.rules.map((item,at)=>at===index?{...item,disabled:!enabled}:item)})
            }),
            draft&&h('div',null,input(`规则名称：${index+1}`,rule.scriptName,scriptName=>changeRule(index,{scriptName})),
              button(`上移正则：${rule.scriptName}`,()=>move(index,-1),index===0),
              button(`下移正则：${rule.scriptName}`,()=>move(index,1),index===rules.length-1),
              button(`删除规则：${rule.scriptName} #${index+1}`,()=>setDraft({...draft,rules:draft.rules.filter((_item,at)=>at!==index)}))),
            h('label',null,'查找表达式',h('textarea',{className:'dsh-rp-input','aria-label':`查找表达式：${index+1}`,value:rule.findRegex,readOnly:!draft,disabled:busy,
              onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>changeRule(index,{findRegex:event.target.value})})),
            h('label',null,'替换内容',h('textarea',{className:'dsh-rp-input','aria-label':`替换内容：${index+1}`,value:rule.replaceString,readOnly:!draft,disabled:busy,
              onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>changeRule(index,{replaceString:event.target.value})})),
            draft&&h('div',null,
              checkbox(`仅显示：${index+1}`,rule.markdownOnly,markdownOnly=>changeRule(index,{markdownOnly})),
              checkbox(`仅发送：${index+1}`,rule.promptOnly,promptOnly=>changeRule(index,{promptOnly})),
              checkbox(`编辑时运行：${index+1}`,rule.runOnEdit,runOnEdit=>changeRule(index,{runOnEdit})),
              h('label',null,'查找式宏替换',h('select',{'aria-label':`查找式宏替换：${index+1}`,value:rule.substituteRegex,
                onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>changeRule(index,{substituteRegex:Number(event.target.value)})},
                h('option',{value:0},'不替换宏'),h('option',{value:1},'使用宏原值'),h('option',{value:2},'转义宏值'))),
              input(`最小深度：${index+1}`,rule.minDepth===null?'':String(rule.minDepth),value=>changeRule(index,{minDepth:value===''?null:Number(value)}),'number'),
              input(`最大深度：${index+1}`,rule.maxDepth===null?'':String(rule.maxDepth),value=>changeRule(index,{maxDepth:value===''?null:Number(value)}),'number'),
              h('label',null,'修剪字符串（每行一项）',h('textarea',{'aria-label':`修剪字符串：${index+1}`,className:'dsh-rp-input',
                value:rule.trimStrings.join('\n'),onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>changeRule(index,
                  {trimStrings:event.target.value.split('\n').filter(Boolean)})})),
              h('fieldset',null,h('legend',null,'运行位置'),[[1,'用户输入'],[2,'模型回复'],[3,'快捷命令'],[5,'世界书'],[6,'思考内容']]
                .map(([value,label])=>checkbox(`${label}：${index+1}`,rule.placement.includes(Number(value)),enabled=>changeRule(index,{
                  placement:enabled?[...rule.placement,Number(value)]:rule.placement.filter(item=>item!==Number(value)),
                })))))):null),
        h('fieldset',{disabled:busy||!!draft},h('legend',null,'正则来源顺序'),
          displayedOrder.map((origin,index)=>h('div',{key:origin,className:'dsh-rp-row'},originLabels[origin],
            button(`上移${originLabels[origin]}`,()=>void sourceOrder(index,-1),index===0),
            button(`下移${originLabels[origin]}`,()=>void sourceOrder(index,1),index===displayedOrder.length-1)))),
        h('fieldset',{disabled:busy||!!draft},h('legend',null,'双通道预览'),
          h('label',null,'预览原文',h('textarea',{'aria-label':'正则预览原文',className:'dsh-rp-input',value:text,
            onChange:(event:ReactAPI.ChangeEvent<HTMLTextAreaElement>)=>{setText(event.target.value);setPreview(null)}})),
          h('label',null,'预览运行位置',h('select',{'aria-label':'正则预览位置',value:placement,
            onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>)=>setPlacement(Number(event.target.value))},
            h('option',{value:1},'用户输入'),h('option',{value:2},'模型回复'))),
          input('正则预览深度',String(depth),value=>setDepth(Number(value)),'number'),
          button('预览双通道',()=>void runPreview()),
          preview&&h('div',null,h('label',null,'发送给模型',h('textarea',{'aria-label':'发送通道预览',readOnly:true,value:preview.prompt,className:'dsh-rp-input'})),
            h('label',null,'显示在界面',h('textarea',{'aria-label':'显示通道预览',readOnly:true,value:preview.display,className:'dsh-rp-input'}))))))
  }
}
