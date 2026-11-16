import {randomUUID} from 'node:crypto'
import {withTavernLock} from './tavern-task-support.js'
import {recordSha256} from './roleplay-data.js'
import {parseCommunityPreset,normalizeCommunityRegexes,communityTavernRegexDto,communityRegexesFromTavernDto,
  communityPresetDataV1,communityDefaultPresetDataV1,communityPresetFromDataV1,communityPresetExtensionsV1,
  communityPresetHelperVariablesV1,exportCommunityPresetV1} from './community-preset-import.js'
import {parseCommunityIzumiPlanPack,applyCommunityIzumiPlans,annotateCommunityIzumiPrompts} from './community-preset-plans.js'
import {applyCommunityPresetControl,resolveCommunityPresetControls,communityPresetControlAnswers} from './community-preset-controls.js'
import {extractCommunityPresetProfile,resolveCommunityProfileConfiguration} from './community-preset-profiles.js'
import type {CommunityProfileEvaluatorV1} from './community-preset-profiles.js'
import type {CommunityMacroWrite} from './community-preset-macros.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {TavernEjsPresetCatalogV1} from './tavern-template-ejs-host-types.mjs'
import type {AuthorPersistentScopeReplaceV1} from './roleplay-author-scope-types.js'
import {CommunityAuthorPresetRefusalV1} from './community-preset-types.js'
import type {CommunityJson,CommunityPresetV1,CommunityRegexRule,CommunityIzumiPlanPackV2,
  CommunityPresetPrompt,CommunityPresetDataV1,CommunityAuthorPresetTargetV1,CommunityAuthorPresetOperationV1,
  CommunityAuthorPresetReceiptV1,CommunityAuthorPresetResultV1,CommunityAuthorPresetResolvedTargetV1,
  CommunityAuthorPresetCatalogV1} from './community-preset-types.js'

export type CommunityScope = 'global'|'conversation'
export type CommunityRegexOrigin = 'global'|'preset'|'scoped'
export interface CommunityReadonlyPresetDataV1 {
  readonly settings:Readonly<Record<string,CommunityJson>>
  readonly prompts:readonly Readonly<Record<string,CommunityJson>>[]
  readonly prompts_unused:readonly Readonly<Record<string,CommunityJson>>[]
  readonly extensions:Readonly<Record<string,CommunityJson>>
}
export type CommunityReadonlyPresetV1=
  |{readonly kind:'none';readonly fingerprint:string}
  |{readonly kind:'available';readonly loadedName:string;readonly fingerprint:string;
    readonly settingsComplete:false;readonly preset:CommunityReadonlyPresetDataV1}
export interface CommunitySelection {
  presetId:string|null
  /** Detached working content. The loaded library identity remains presetId. */
  current?:CommunityPresetV1
  applySampling:boolean
  prompts:Record<string,boolean>
  contents:Record<string,string>
  features:Record<string,CommunityJson>
  regexes:Record<string,boolean>
  regexOrder:CommunityRegexOrigin[]|null
}
export interface CommunityRegexLibraryEntry {
  id:string
  name:string
  rules:CommunityRegexRule[]
  binding:{scope:'global'|'conversation'|'preset';id:string|null}
}
export interface CommunityPresetStateV1 {
  schemaVersion:1
  revision:number
  presets:CommunityPresetV1[]
  global:CommunitySelection
  conversations:Record<string,CommunitySelection>
  planPacks:Record<string,CommunityIzumiPlanPackV2>
  regexes:CommunityRegexLibraryEntry[]
  configurationWrites:CommunityVariableConfiguration[]
  authorOperations?:Readonly<Record<string,CommunityAuthorPresetReceiptV1>>
  authorPending?:{readonly schemaVersion:1;readonly operationId:string;readonly update:AuthorPersistentScopeReplaceV1}
}
export interface CommunityVariableConfiguration {
  id:string
  presetId:string
  conversationId:string|null
  writes:readonly CommunityMacroWrite[]
}
export interface CommunityPresetTable {
  get(key:string):unknown
  put(key:string,value:unknown):unknown|PromiseLike<unknown>
}
export const COMMUNITY_PRESETS_KEY='community-presets-v1'
const emptySelection=():CommunitySelection=>({presetId:null,applySampling:false,prompts:{},contents:{},features:{},regexes:{},regexOrder:null})
const copy=<T>(value:T):T=>structuredClone(value)
const object=(value:unknown):Record<string,unknown>=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('配置必须是对象')
  return value as Record<string,unknown>
}
const jsonObject=(value:unknown)=>copy(object(value)) as Record<string,CommunityJson>
const text=(value:unknown)=>typeof value==='string'?value:''
function selection(value:unknown,state:CommunityPresetStateV1):CommunitySelection {
  const raw=object(value),presetId=raw.presetId===null?null:text(raw.presetId)
  if(presetId!==null&&!state.presets.some(p=>p.id===presetId))throw Error('社区预设不存在')
  const booleans=(value:unknown):Record<string,boolean>=>{
    const entries=Object.entries(object(value??{}))
    if(entries.some(([,value])=>typeof value!=='boolean'))throw Error('条目开关必须为布尔值')
    return Object.fromEntries(entries) as Record<string,boolean>
  }
  const order=raw.regexOrder??null
  if(order!==null&&(!Array.isArray(order)||order.length!==3
    ||new Set(order).size!==3||order.some(value=>!['global','preset','scoped'].includes(String(value))))) {
    throw Error('正则来源顺序必须包含全局、预设、角色卡各一次')
  }
  const contents=object(raw.contents??{})
  if(Object.values(contents).some(value=>typeof value!=='string'))throw Error('提示条目正文必须为文本')
  return {presetId,applySampling:raw.applySampling===true,prompts:booleans(raw.prompts),contents:copy(contents) as Record<string,string>,
    features:jsonObject(raw.features??{}),regexes:booleans(raw.regexes),regexOrder:order as CommunityRegexOrigin[]|null}
}
const exportPreset=exportCommunityPresetV1
function applySelectionContent(preset:CommunityPresetV1,current:CommunitySelection):void {
  for(const prompt of preset.prompts) {
    if(Object.hasOwn(current.prompts,prompt.identifier))prompt.enabled=current.prompts[prompt.identifier]!
    if(Object.hasOwn(current.contents,prompt.identifier))prompt.content=current.contents[prompt.identifier]!
  }
  for(const row of preset.promptOrder)if(Object.hasOwn(current.prompts,row.identifier))row.enabled=current.prompts[row.identifier]!
  for(const rule of preset.regexes)if(Object.hasOwn(current.regexes,rule.id))rule.disabled=!current.regexes[rule.id]
}
function freezeData<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freezeData(child)
    Object.freeze(value)
  }
  return value
}
/** One owner supplies both preset and independent regex state. Library edits
 * are shared; selection overrides belong to the selected conversation scope. */
export function createCommunityPresets(table:CommunityPresetTable,rootOf:(id:string)=>string,runtime?:{
  evaluateProfileConfiguration?:CommunityProfileEvaluatorV1
  prepare(result:CommunityAuthorPresetResultV1):AuthorPersistentScopeReplaceV1|undefined
  complete(update:AuthorPersistentScopeReplaceV1):Promise<void>
}) {
  let policyRevision:number|undefined
  const policies=new Map<string,ReturnType<typeof buildPolicy>>()
  const catalogEntries=new Map<string,CommunityAuthorPresetCatalogV1['presets'][number]>()
  const catalogs=new Map<string,CommunityAuthorPresetCatalogV1>()
  function stored():CommunityPresetStateV1 {
    const raw=table.get(COMMUNITY_PRESETS_KEY)
    if(raw==null)return {schemaVersion:1,revision:0,presets:[],global:emptySelection(),conversations:{},planPacks:{},regexes:[],configurationWrites:[]}
    const state=raw as CommunityPresetStateV1
    if(state.schemaVersion!==1)throw Error('社区预设存储版本不受支持，未覆盖原记录')
    return state
  }
  function read():CommunityPresetStateV1 {
    const {authorOperations:_receipts,authorPending:_pending,...semantic}=stored()
    return copy(semantic)
  }
  async function finishPending():Promise<void> {
    const pending=stored().authorPending
    if(!pending)return
    if(!runtime)throw Error('COMMUNITY_AUTHOR_OPERATION_PENDING')
    await runtime.complete(pending.update)
    const {authorPending:_pending,...settled}=stored()
    try {await table.put(COMMUNITY_PRESETS_KEY,settled)}catch(error) {
      if(stored().authorPending)throw error
    }
  }
  const settleAuthorPending=()=>withTavernLock(table,COMMUNITY_PRESETS_KEY,finishPending)
  function withAuthorRuntime<T>(work:()=>Promise<T>):Promise<T> {
    return withTavernLock(table,COMMUNITY_PRESETS_KEY,async()=>{
      await finishPending()
      return work()
    })
  }
  function effectivePreset(state:CommunityPresetStateV1,current:CommunitySelection):CommunityPresetV1|null {
    const saved=state.presets.find(preset=>preset.id===current.presetId),base=current.current??saved
    if(!base)return null
    const preset=copy(base)
    if(saved)preset.name=saved.name
    applySelectionContent(preset,current)
    return preset
  }
  function publishWorking(current:CommunitySelection,preset:CommunityPresetV1|null):void {
    if(preset)current.current=preset
    else delete current.current
    current.prompts={};current.contents={};current.regexes={}
  }
  function writeState():CommunityPresetStateV1 {
    const raw=stored(),state={...raw,presets:[...raw.presets],global:copy(raw.global),conversations:copy(raw.conversations),
      planPacks:{...raw.planPacks},regexes:copy(raw.regexes),configurationWrites:[...raw.configurationWrites]}
    // Older selected rows gain their detached copy before a named edit can
    // change its source library. This runs only under the existing writer FIFO.
    for(const current of [state.global,...Object.values(state.conversations)]) {
      if(!current.current&&current.presetId!==null)publishWorking(current,effectivePreset(state,current))
    }
    return state
  }
  function buildPolicy(sessionId:string) {
    const state=read(),conversationId=rootOf(sessionId),local=state.conversations[conversationId]??null
    const effective=local??state.global,stored=state.presets.find(p=>p.id===effective.presetId)??null
    const preset=effectivePreset(state,effective),globalPreset=local?effectivePreset(state,state.global):preset
    const libraries=state.regexes.filter(item=>item.binding.scope==='global'
      ||item.binding.scope==='conversation'&&item.binding.id===conversationId
      ||item.binding.scope==='preset'&&item.binding.id===effective.presetId)
    const defaultRegexOrder=(value:CommunityPresetV1|null):CommunityRegexOrigin[]=>
      value&&['kemini','reborn','izumi'].includes(String(value.profile.transport.kind))
        ?['preset','global','scoped']:['global','preset','scoped']
    const regexOrder=effective.regexOrder??defaultRegexOrder(preset),
      globalRegexOrder=state.global.regexOrder??defaultRegexOrder(globalPreset)
    const {current:_working,...controls}=effective,fingerprint=recordSha256({preset,selection:controls,regexes:libraries,regexOrder})
    let helperVariables:TavernTemplateScopeBindingV1|null=null
    if(preset) {
      // These are the selected preset's own TavernHelper settings, not the
      // separate Community global-variable journal. Missing/invalid tables use
      // the upstream PresetSettings default; no selected preset stays absent.
      const values=communityPresetHelperVariablesV1(preset),valuesSha256=recordSha256(values)
      helperVariables={scope:'preset',ownerId:`community:${preset.id}:tavern-helper`,
        versionSha256:recordSha256({presetId:preset.id,revision:preset.contentRevision??preset.source.sha256}),values,valuesSha256}
    }
    return {revision:state.revision,conversationId,global:state.global,local,effective,preset,globalPreset,
      helperVariables,
      presets:state.presets.map(p=>({id:p.id,name:p.name,profile:p.profile.id,prompts:p.prompts.length,regexes:p.regexes.length})),
      planPack:stored?state.planPacks[stored.id]??null:null,regexes:libraries,regexLibrary:state.regexes,
      regexOrder,globalRegexOrder,fingerprint}
  }
  function policy(sessionId:string) {
    const source=stored(),root=rootOf(sessionId)
    if(source.authorPending)throw Error('COMMUNITY_AUTHOR_OPERATION_PENDING')
    if(source.revision!==policyRevision){policies.clear();catalogs.clear();policyRevision=source.revision}
    let value=policies.get(root)
    if(!value){value=buildPolicy(sessionId);policies.set(root,value)}
    return value
  }
  const readonlyPresets=new WeakMap<ReturnType<typeof buildPolicy>,CommunityReadonlyPresetV1>()
  const ejsPresets=new WeakMap<ReturnType<typeof buildPolicy>,TavernEjsPresetCatalogV1>()
  const globalRegexes=new WeakMap<ReturnType<typeof buildPolicy>,readonly Readonly<Record<string,CommunityJson>>[]>()
  function readonlyGlobalRegexes(sessionId:string) {
    const current=policy(sessionId),saved=globalRegexes.get(current)
    if(saved)return saved
    const result=current.regexes.filter(library=>library.binding.scope==='global')
      .flatMap(library=>library.rules.map(communityTavernRegexDto))
    globalRegexes.set(current,result)
    return result
  }
  function ejsPreset(sessionId:string,current=policy(sessionId)):TavernEjsPresetCatalogV1 {
    const saved=ejsPresets.get(current)
    if(saved)return saved
    const preset=current.preset,result:TavernEjsPresetCatalogV1=preset?{
      kind:'available',id:preset.id,loadedName:preset.name,fingerprint:current.fingerprint,
      prompts:Object.freeze(preset.prompts.map((row,index)=>Object.freeze({name:row.name,content:row.content,
        sourcePointer:`/community/presets/${preset.id.replaceAll('~','~0').replaceAll('/','~1')}/prompts/${index}/content`})))}
      :{kind:'none',fingerprint:current.fingerprint}
    Object.freeze(result);ejsPresets.set(current,result)
    return result
  }
  function readonlyPreset(sessionId:string):CommunityReadonlyPresetV1 {
    const current=policy(sessionId),saved=readonlyPresets.get(current)
    if(saved)return saved
    const preset=current.preset
    let result:CommunityReadonlyPresetV1
    if(!preset)result={kind:'none',fingerprint:current.fingerprint}
    else {
      const data=communityPresetDataV1(preset)
      // Only these two imported fields are actually passed to Native sampling.
      // Other imported parameters do not establish current provider settings.
      const settings:Record<string,CommunityJson>={}
      if(current.effective.applySampling) {
        if(typeof preset.parameters.temperature==='number')settings.temperature=preset.parameters.temperature
        if(typeof preset.parameters.openai_max_tokens==='number')settings.max_completion_tokens=preset.parameters.openai_max_tokens
      }
      result={kind:'available',loadedName:preset.name,fingerprint:current.fingerprint,settingsComplete:false,
        preset:{settings,prompts:data.prompts as unknown as Record<string,CommunityJson>[],
          prompts_unused:data.prompts_unused as unknown as Record<string,CommunityJson>[],extensions:data.extensions}}
    }
    freezeData(result)
    readonlyPresets.set(current,result)
    return result
  }
  function scopeSelection(state:CommunityPresetStateV1,sessionId:string,scope:CommunityScope):CommunitySelection {
    if(scope==='global')return state.global
    const root=rootOf(sessionId)
    return state.conversations[root]??(state.conversations[root]=copy(state.global))
  }
  function deleteSavedPreset(state:CommunityPresetStateV1,id:string):void {
    state.presets=state.presets.filter(preset=>preset.id!==id)
    catalogEntries.delete(id)
    const fallback=state.presets[0]??null
    for(const current of [state.global,...Object.values(state.conversations)])if(current.presetId===id) {
      current.presetId=fallback?.id??null
      current.features={};current.regexOrder=null
      publishWorking(current,fallback?copy(fallback):null)
    }
    delete state.planPacks[id]
    state.regexes=state.regexes.filter(library=>library.binding.scope!=='preset'||library.binding.id!==id)
    state.configurationWrites=state.configurationWrites.filter(row=>row.presetId!==id)
  }
  function prunePlans(state:CommunityPresetStateV1,preset:CommunityPresetV1):void {
    const previous=state.planPacks[preset.id]
    if(!previous)return
    const ids=new Set(preset.prompts.map(prompt=>prompt.identifier)),names=new Set(preset.prompts.map(prompt=>prompt.name)),
      pack=copy(previous)
    for(const plan of pack.plans)plan.entries=plan.entries.filter(entry=>entry.id?ids.has(entry.id):names.has(entry.name??''))
    state.planPacks[preset.id]=pack
  }
  function preparedPlans(state:CommunityPresetStateV1,sessionId:string,scope:CommunityScope,preset:CommunityPresetV1,ids:string[]) {
    const current=scope==='global'?state.global:state.conversations[rootOf(sessionId)]??state.global
    const effective=current.presetId===preset.id?effectivePreset(state,current)!:copy(preset)
    const pack=state.planPacks[preset.id]
    if(!pack)throw Error('请先导入方案包')
    return {effective,applied:applyCommunityIzumiPlans(effective,pack.plans.filter(plan=>ids.includes(plan.id)))}
  }
  // Callers with cancellable ownership recheck synchronously at publication,
  // after the shared FIFO has released every preceding mutation.
  async function mutate(sessionId:string,value:unknown,callerCurrent?:()=>void) {
    const body=object(value)
    return withTavernLock(table,COMMUNITY_PRESETS_KEY,async()=>{
      await finishPending()
      callerCurrent?.()
      const state=writeState()
      if(body.expectedRevision!==state.revision)throw Error('社区预设已更新，请刷新后重试')
      const scope=body.scope==='global'?'global':'conversation'
      let result:Record<string,unknown>={}
      const found=()=>{
        const index=state.presets.findIndex(item=>item.id===body.presetId)
        if(index<0)throw Error('社区预设不存在')
        const preset=copy(state.presets[index]!)
        state.presets[index]=preset
        return preset
      }
      switch(body.action) {
        case 'profile': {
          const preset=found(),id=text(body.profile)
          if(!id.trim())throw Error('原生适配类型无效')
          const raw=exportPreset(preset),extensions=raw.extensions as Record<string,CommunityJson>
          const native=extensions.nexttavern as Record<string,CommunityJson>
          if(id!==preset.profile.id)delete native.profileConfiguration
          extensions.nexttavern={...native,profile:id,
            ...body.profileConfiguration!==undefined?{profileConfiguration:body.profileConfiguration as CommunityJson}:{}}
          const {regex_scripts:_embedded,...currentExtensions}=extensions
          preset.extensions=currentExtensions
          preset.profile=extractCommunityPresetProfile(raw)
          await resolveCommunityProfileConfiguration(preset,runtime?.evaluateProfileConfiguration)
          if(preset.profile.id!==id)throw Error('该适配缺少已启用的声明配置')
          if(preset.profile.transport.kind==='izumi')annotateCommunityIzumiPrompts(preset.prompts,preset.promptOrder)
          preset.contentRevision=state.revision+1
          break
        }
        case 'import': {
          const rawText=text(body.rawText),input=body.data??JSON.parse(rawText)
          const preset=parseCommunityPreset(input,{id:`community-${randomUUID()}`,name:text(body.name)||text(body.fileName).replace(/\.json$/i,'')||'社区预设',fileName:text(body.fileName),rawText})
          await resolveCommunityProfileConfiguration(preset,runtime?.evaluateProfileConfiguration)
          preset.contentRevision=state.revision+1
          state.presets.push(preset);result={importedId:preset.id};break
        }
        case 'copy': {
          const source=found(),preset=copy(source);preset.id=`community-${randomUUID()}`;preset.name=text(body.name)||`${source.name} 副本`
          preset.contentRevision=state.revision+1
          state.presets.push(preset)
          if(state.planPacks[source.id])state.planPacks[preset.id]=copy(state.planPacks[source.id]!)
          result={importedId:preset.id};break
        }
        case 'update': {
          const preset=found()
          if(body.name!==undefined)preset.name=text(body.name)
          if(body.prompts!==undefined) {
            for(const change of body.prompts as Partial<CommunityPresetPrompt>[]) {
              const prompt=preset.prompts.find(item=>item.identifier===change.identifier)
              if(!prompt)throw Error('提示条目不存在')
              if(prompt.readOnly||prompt.configurationOnly)throw Error('只读或配置专用条目不可编辑')
              for(const key of ['name','content','role','injectionPosition','injectionDepth','injectionOrder'] as const) {
                const value=change[key]
                if(value===undefined)continue
                if(key==='role'&&!['system','user','assistant'].includes(String(value)))throw Error('提示角色无效')
                if((key==='name'||key==='content')&&typeof value!=='string')throw Error('提示正文与名称必须为文本')
                if(key.startsWith('injection')&&(!Number.isSafeInteger(value)
                  ||key==='injectionDepth'&&Number(value)<0||key==='injectionPosition'&&value!==0&&value!==1))throw Error('提示位置无效')
                const mutable=prompt as unknown as Record<string,unknown>
                mutable[key]=value
              }
            }
          }
          if(body.order!==undefined) {
            const ids=body.order as string[]
            if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!preset.prompts.some(p=>p.identifier===id)))throw Error('提示条目顺序无效')
            const before=new Map((preset.promptOrder.length?preset.promptOrder
              :preset.prompts.filter(prompt=>!prompt.unused)).map(row=>[row.identifier,row.enabled]))
            preset.promptOrder=ids.map(identifier=>({identifier,enabled:before.get(identifier)??false}))
            for(const prompt of preset.prompts)prompt.unused=!ids.includes(prompt.identifier)
          }
          preset.contentRevision=state.revision+1
          break
        }
        case 'delete': {
          const preset=found()
          deleteSavedPreset(state,preset.id);break
        }
        case 'select': {
          const next=selection(body.selection,state)
          publishWorking(next,effectivePreset(state,next))
          if(scope==='global')state.global=next
          else state.conversations[rootOf(sessionId)]=next
          break
        }
        case 'configure': {
          const current=scopeSelection(state,sessionId,scope)
          const next=selection({...current,...object(body.patch)},state),same=next.presetId===current.presetId
          next.current=same?effectivePreset(state,current)??undefined:undefined
          const effective=effectivePreset(state,next)
          publishWorking(next,effective)
          Object.assign(current,next)
          if(!effective)delete current.current
          break
        }
        case 'inherit':delete state.conversations[rootOf(sessionId)];break
        case 'import-plans': {
          const preset=found(),pack=parseCommunityIzumiPlanPack(body.data??JSON.parse(text(body.rawText)))
          const prior=state.planPacks[preset.id]
          if(prior) {
            const merged=new Map(prior.plans.map(plan=>[plan.id,plan]))
            for(const plan of pack.plans) {
              if(!merged.has(plan.id)) {
                const name=plan.name;let suffix=2
                while([...merged.values()].some(p=>p.name===plan.name))plan.name=`${name} (${suffix++})`
              }
              merged.set(plan.id,plan)
            }
            pack.plans=[...merged.values()]
          }
          state.planPacks[preset.id]=pack;break
        }
        case 'apply-plans': {
          const preset=found(),pack=state.planPacks[preset.id]
          if(!pack)throw Error('请先导入方案包')
          const current=scopeSelection(state,sessionId,scope)
          const {applied}=preparedPlans(state,sessionId,scope,preset,body.planIds as string[])
          current.presetId=preset.id
          applied.preset.contentRevision=state.revision+1
          publishWorking(current,applied.preset)
          result={applied:applied.applied,unresolved:applied.unresolved};break
        }
        case 'save-plan': {
          const preset=found(),current=scopeSelection(state,sessionId,scope)
          const active=current.presetId===preset.id?effectivePreset(state,current)!:preset
          const layer=text(body.layer)||'function',section=text(body.section)
          if(!['structure','function','style'].includes(layer))throw Error('方案层无效')
          const entries=active.prompts.filter(p=>p.layer===layer&&(!section||p.section===section)).map(prompt=>({
            id:prompt.identifier,name:prompt.name,sameNameIndex:active.prompts.filter(p=>p.name===prompt.name).indexOf(prompt),
            enabled:prompt.enabled,raw:{}}))
          const pack=copy(state.planPacks[preset.id]??parseCommunityIzumiPlanPack({schema:'izumi-layer-plan-pack',version:2,plans:[],active:{},quickSlots:[]}))
          const id=randomUUID()
          pack.plans.push({id,name:text(body.name)||'新方案',layer:layer as 'structure'|'function'|'style',section,
            strict:body.strict!==false,entries,raw:{}})
          state.planPacks[preset.id]=pack;result={savedPlanId:id};break
        }
        case 'control': {
          const preset=state.presets.find(item=>item.id===body.presetId)
          if(!preset)throw Error('社区预设不存在')
          const current=scopeSelection(state,sessionId,scope)
          const effective=current.presetId===preset.id?effectivePreset(state,current)!:copy(preset)
          await resolveCommunityPresetControls(effective)
          const request={groupId:text(body.groupId),optionId:text(body.optionId),enabled:body.enabled===true,
            value:body.value as CommunityJson,answers:body.answers as Record<string,CommunityJson>|undefined}
          const answers=communityPresetControlAnswers(effective,request),
            predicates=await resolveCommunityProfileConfiguration(effective,runtime?.evaluateProfileConfiguration,answers)
          const previousPromptCount=effective.prompts.length,
            applied=applyCommunityPresetControl(effective,request,predicates,answers)
          if(applied.preset.prompts.length!==previousPromptCount)await resolveCommunityPresetControls(applied.preset)
          current.presetId=preset.id
          applied.preset.contentRevision=state.revision+1
          publishWorking(current,applied.preset)
          if(applied.writes.length)state.configurationWrites.push({id:randomUUID(),presetId:preset.id,
            conversationId:scope==='global'?null:rootOf(sessionId),writes:applied.writes})
          result={unresolved:applied.unresolved};break
        }
        default:throw Error('未知社区预设操作')
      }
      callerCurrent?.()
      if(['import','copy','select','update','profile'].includes(String(body.action))) {
        const selected=body.action==='select'?scopeSelection(state,sessionId,scope).presetId:undefined
        const target=body.action==='select'?scopeSelection(state,sessionId,scope).current
          :state.presets.find(preset=>preset.id===(selected??result.importedId??body.presetId))
        if(target)await resolveCommunityPresetControls(target,body.action==='import')
      }
      callerCurrent?.()
      state.revision++;await table.put(COMMUNITY_PRESETS_KEY,state)
      return {...policy(sessionId),...result}
    })
  }
  async function mutateRegex(sessionId:string,value:unknown,callerCurrent?:()=>void) {
    const body=object(value)
    return withTavernLock(table,COMMUNITY_PRESETS_KEY,async()=>{
      await finishPending()
      callerCurrent?.()
      const state=writeState()
      if(body.expectedRevision!==state.revision)throw Error('正则库已更新，请刷新后重试')
      if(body.action==='import') {
        const bindingScope=body.bindingScope==='preset'?'preset':body.bindingScope==='global'?'global':'conversation'
        const id=bindingScope==='preset'?text(body.presetId):bindingScope==='conversation'?rootOf(sessionId):null
        if(bindingScope==='preset'&&!state.presets.some(p=>p.id===id))throw Error('绑定预设不存在')
        state.regexes.push({id:`regex-${randomUUID()}`,name:text(body.name)||text(body.fileName)||'导入正则',
          rules:normalizeCommunityRegexes(body.data??JSON.parse(text(body.rawText))),binding:{scope:bindingScope,id}})
      } else {
        const item=state.regexes.find(r=>r.id===body.id)
        if(!item)throw Error('正则不存在')
        if(body.action==='delete')state.regexes=state.regexes.filter(r=>r.id!==item.id)
        else if(body.action==='update') {
          if(body.name!==undefined)item.name=text(body.name)
          if(body.rules!==undefined)item.rules=normalizeCommunityRegexes(body.rules)
          if(body.bindingScope!==undefined) {
            const bindingScope=body.bindingScope==='preset'?'preset':body.bindingScope==='global'?'global':'conversation'
            const id=bindingScope==='preset'?text(body.presetId):bindingScope==='conversation'?rootOf(sessionId):null
            if(bindingScope==='preset'&&!state.presets.some(p=>p.id===id))throw Error('绑定预设不存在')
            item.binding={scope:bindingScope,id}
          }
        } else throw Error('未知正则操作')
      }
      callerCurrent?.()
      state.revision++;await table.put(COMMUNITY_PRESETS_KEY,state)
      return policy(sessionId)
    })
  }
  async function ensureControls(sessionId:string,presetId?:string) {
    const pending=(state:CommunityPresetStateV1|undefined)=>{
      const id=presetId??(state?.conversations[rootOf(sessionId)]??state?.global)?.presetId
      const selected=state?.conversations[rootOf(sessionId)]??state?.global,
        preset=presetId?state?.presets.find(preset=>preset.id===id):selected?.current??state?.presets.find(preset=>preset.id===id)
      return preset?.profile.groups.some(group=>group.options.some(option=>option.match
        &&typeof option.raw.resolvedRangeBasis!=='string'))?preset:undefined
    }
    // Ordinary reads consume the published range. Only a legacy record without
    // that publication enters the existing writer lock and gets migrated once.
    const raw=stored()
    if(!raw.authorPending&&!pending(raw))return
    await withTavernLock(table,COMMUNITY_PRESETS_KEY,async()=>{
      await finishPending()
      const state=writeState(),preset=pending(state)
      if(!preset)return
      if(presetId)state.presets[state.presets.findIndex(row=>row.id===presetId)]=copy(preset)
      const target=presetId?state.presets.find(row=>row.id===presetId)!:preset
      await resolveCommunityPresetControls(target)
      state.revision++;await table.put(COMMUNITY_PRESETS_KEY,state)
    })
  }
  function authorCatalog(sessionId:string):CommunityAuthorPresetCatalogV1 {
    const state=stored(),conversationId=rootOf(sessionId),previous=catalogs.get(conversationId)
    if(state.authorPending)throw Error('COMMUNITY_AUTHOR_OPERATION_PENDING')
    if(previous?.revision===state.revision)return previous
    const current=policy(sessionId),loaded=state.presets.find(preset=>preset.id===current.effective.presetId),
      presets=state.presets.map(preset=>{
        const saved=catalogEntries.get(preset.id),revision=preset.contentRevision??0
        if(saved?.revision===revision&&saved.name===preset.name)return saved
        const entry=freezeData({presetId:preset.id,name:preset.name,revision,data:communityPresetDataV1(preset)})
        catalogEntries.set(preset.id,entry);return entry
      }),data=freezeData({schemaVersion:1 as const,encoding:'community-author-preset-catalog-v1' as const,
        revision:state.revision,conversationId,names:['in_use',...presets.map(preset=>preset.name)],
        loaded:loaded?{presetId:loaded.id,name:loaded.name}:null,
        current:{presetId:current.preset?.id??null,data:current.preset?communityPresetDataV1(current.preset):communityDefaultPresetDataV1()},
        presets,globalRegexes:readonlyGlobalRegexes(sessionId)})
    catalogs.set(conversationId,data);return data
  }
  function authorTarget(sessionId:string,name:string):CommunityAuthorPresetTargetV1|null {
    if(name==='in_use')return {kind:'in-use',conversationId:rootOf(sessionId)}
    const saved=stored().presets.find(preset=>preset.name===name)
    return saved?{kind:'saved',presetId:saved.id}:null
  }
  const operationPayload=(operation:CommunityAuthorPresetOperationV1)=>recordSha256({schemaVersion:operation.schemaVersion,
    origin:operation.origin,expectedRevision:operation.expectedRevision,command:operation.command})
  function operationResult(operation:CommunityAuthorPresetOperationV1,receipt:CommunityAuthorPresetReceiptV1,
    normalized?:CommunityPresetDataV1):CommunityAuthorPresetResultV1 {
    const command=operation.command,full=command.kind==='replace'||command.kind==='create-or-replace'
      ||command.kind==='create'&&receipt.result.kind==='boolean'&&receipt.result.value
    let data:CommunityPresetDataV1|undefined
    if(full) {
      const supplied='data' in command?command.data:undefined
      data=normalized??communityPresetFromDataV1(supplied??communityDefaultPresetDataV1(),
        {id:receipt.target&&'presetId' in receipt.target?receipt.target.presetId:'',name:'in_use'},path=>{
          const id=receipt.assignedIds[path]
          if(id===undefined)throw Error('PRESET_RECEIPT_ASSIGNED_ID_MISSING')
          return id
        }).data
    }
    const helper=data?.extensions.tavern_helper,variables=helper&&typeof helper==='object'&&!Array.isArray(helper)?helper.variables:undefined,
      desired=variables&&typeof variables==='object'&&!Array.isArray(variables)?variables:{},
      runtimeTarget=receipt.target?.kind==='in-use'?receipt.target:undefined
    return {receipt:copy(receipt),target:copy(receipt.target),
      ...receipt.result.kind==='boolean'?{value:receipt.result.value}:{},...data?{data}:{},
      ...data&&runtimeTarget?{scopeVariables:{presetId:runtimeTarget.presetId,values:copy(desired)}}:{}}
  }
  function recoverAuthorOperation(operation:CommunityAuthorPresetOperationV1):CommunityAuthorPresetResultV1|undefined {
    const state=stored(),receipt=state.authorOperations?.[operation.operationId]
    if(!receipt)return
    if(receipt.payloadSha256!==operationPayload(operation))throw Error('PRESET_OPERATION_CONFLICT')
    if(state.authorPending?.operationId===operation.operationId)throw Error('COMMUNITY_AUTHOR_OPERATION_PENDING')
    return operationResult(operation,receipt)
  }
  async function manage(sessionId:string,operation:CommunityAuthorPresetOperationV1,callerCurrent:()=>void)
    :Promise<CommunityAuthorPresetResultV1> {
    const payloadSha256=operationPayload(operation)
    return withTavernLock(table,COMMUNITY_PRESETS_KEY,async()=>{
      let mayHaveBeenAccepted=false
      try {
        const existing=stored().authorOperations?.[operation.operationId]
        if(existing) {
          mayHaveBeenAccepted=true
          if(existing.payloadSha256!==payloadSha256)throw Error('PRESET_OPERATION_CONFLICT')
          await finishPending()
          return operationResult(operation,existing)
        }
        await finishPending()
        callerCurrent()
        const state=writeState(),command=operation.command,assignedIds:Record<string,string>={}
        if(operation.expectedRevision!==state.revision)throw Error('PRESET_REVISION_CONFLICT')
        if(operation.schemaVersion!==1||operation.origin.sessionId!==sessionId)throw Error('PRESET_OPERATION_ORIGIN_INVALID')
        const assign=(path:string)=>assignedIds[path]??(assignedIds[path]=randomUUID()),
          selected=()=>scopeSelection(state,sessionId,'conversation'),
          resolve=(target:CommunityAuthorPresetTargetV1)=>{
            if(target.kind==='saved') {
              const preset=state.presets.find(row=>row.id===target.presetId)
              if(!preset)throw Error('PRESET_NOT_FOUND')
              return preset
            }
            if(target.conversationId!==rootOf(sessionId))throw Error('PRESET_TARGET_UNAVAILABLE')
            return effectivePreset(state,selected())
          }
        let target:CommunityAuthorPresetResolvedTargetV1|null=null,result:CommunityAuthorPresetReceiptV1['result']={kind:'void'},
          normalized:CommunityPresetDataV1|undefined,changed=true
        const replace=async(address:CommunityAuthorPresetTargetV1,data:CommunityPresetDataV1)=>{
          const previous=resolve(address),id=previous?.id??`community-${assign('working-preset')}`,
            next=communityPresetFromDataV1(data,{id,name:previous?.name??'in_use'},assign,previous?.source)
          await resolveCommunityProfileConfiguration(next.preset,runtime?.evaluateProfileConfiguration)
          await resolveCommunityPresetControls(next.preset)
          next.preset.contentRevision=state.revision+1;normalized=communityPresetDataV1(next.preset)
          if(address.kind==='saved') {
            state.presets[state.presets.findIndex(row=>row.id===id)]=next.preset
            prunePlans(state,next.preset);target=address
          }else {
            const current=selected();current.applySampling=true;current.features={};current.regexOrder=null
            publishWorking(current,next.preset)
            target={...address,presetId:id}
          }
        }
        if(command.kind==='create'||command.kind==='create-or-replace') {
          const saved=state.presets.find(preset=>preset.name===command.name),inUse=command.name==='in_use'
          if(command.kind==='create'&&(saved||inUse)) {
            result={kind:'boolean',value:false};changed=false
            target=saved?{kind:'saved',presetId:saved.id}:null
          }else if(saved||inUse) {
            await replace(inUse?{kind:'in-use',conversationId:rootOf(sessionId)}:{kind:'saved',presetId:saved!.id},
              command.data??communityDefaultPresetDataV1())
            result={kind:'boolean',value:false}
          }else {
            if(!command.name)throw Error('PRESET_NAME_REQUIRED')
            const id=`community-${assign('saved-preset')}`,next=communityPresetFromDataV1(command.data??communityDefaultPresetDataV1(),
              {id,name:command.name},assign)
            await resolveCommunityProfileConfiguration(next.preset,runtime?.evaluateProfileConfiguration)
            await resolveCommunityPresetControls(next.preset)
            next.preset.contentRevision=state.revision+1;state.presets.push(next.preset);normalized=communityPresetDataV1(next.preset)
            target={kind:'saved',presetId:id};result={kind:'boolean',value:true}
          }
        }else if(command.kind==='replace')await replace(command.target,command.data)
        else if(command.kind==='replace-preset-regexes') {
          const previous=resolve(command.target)
          if(!previous) {
            const initial=communityDefaultPresetDataV1();initial.extensions.regex_scripts=copy(command.rules) as CommunityJson
            await replace(command.target,initial)
          }else {
            const next=copy(previous);next.regexes=communityRegexesFromTavernDto(command.rules);next.regexSource='native'
            next.extensions=copy(communityPresetExtensionsV1(previous));delete next.extensions.regex_scripts
            await resolveCommunityPresetControls(next)
            next.contentRevision=state.revision+1
            if(command.target.kind==='saved') {
              state.presets[state.presets.findIndex(row=>row.id===next.id)]=next;target=command.target
            }else {publishWorking(selected(),next);target={...command.target,presetId:next.id}}
          }
        }else if(command.kind==='replace-global-regexes') {
          const first=state.regexes.find(library=>library.binding.scope==='global'),rules=communityRegexesFromTavernDto(command.rules)
          target={kind:'global-regexes'}
          if(!first&&!rules.length)changed=false
          else {
            const replacement={id:first?.id??`regex-${assign('global-regex-library')}`,name:first?.name??'Global regexes',rules,
              binding:{scope:'global' as const,id:null}}
            let inserted=false
            state.regexes=state.regexes.flatMap(library=>{
              if(library.binding.scope!=='global')return [library]
              if(inserted)return []
              inserted=true;return [replacement]
            })
            if(!inserted)state.regexes.push(replacement)
          }
        }else if(command.kind==='delete'||command.kind==='load'||command.kind==='rename') {
          const saved=command.name==='in_use'||command.presetId===null?undefined:state.presets.find(preset=>preset.id===command.presetId)
          result={kind:'boolean',value:!!saved};changed=!!saved
          if(saved) {
            target={kind:'saved',presetId:saved.id}
            if(command.kind==='delete')deleteSavedPreset(state,saved.id)
            else if(command.kind==='load') {
              const current=selected();current.presetId=saved.id;current.applySampling=true
              current.features={};current.regexOrder=null
              publishWorking(current,copy(saved))
            }else if(!command.newName||command.newName==='in_use'||state.presets.some(row=>row.id!==saved.id&&row.name===command.newName)) {
              result={kind:'boolean',value:false};changed=false
            }else if(saved.name===command.newName)changed=false
            else state.presets[state.presets.indexOf(saved)]={...saved,name:command.newName,contentRevision:state.revision+1}
          }
        }else throw Error('PRESET_COMMAND_INVALID')
        callerCurrent()
        if(changed)state.revision++
        const receipt:CommunityAuthorPresetReceiptV1={schemaVersion:1,operationId:operation.operationId,payloadSha256,
          origin:copy(operation.origin),target,result,assignedIds,revision:state.revision}
        state.authorOperations={...state.authorOperations,[operation.operationId]:receipt}
        let accepted=operationResult(operation,receipt,normalized)
        if(result.kind==='boolean'&&result.value&&(command.kind==='load'||command.kind==='delete')) {
          const selection=state.conversations[rootOf(sessionId)]??state.global,current=effectivePreset(state,selection)
          if(current)accepted={...accepted,
            scopeVariables:{presetId:current.id,values:copy(communityPresetHelperVariablesV1(current))}}
        }
        const update=accepted.scopeVariables?runtime?.prepare(accepted):undefined
        if(update)state.authorPending={schemaVersion:1,operationId:operation.operationId,update:copy(update)}
        // Storage may accept this operation even when its acknowledgement fails.
        mayHaveBeenAccepted=true
        try {await table.put(COMMUNITY_PRESETS_KEY,state)}catch(error) {
          const actual=stored().authorOperations?.[operation.operationId]
          if(!actual||actual.payloadSha256!==payloadSha256)throw error
          await finishPending()
          return operationResult(operation,actual,normalized)
        }
        await finishPending()
        return operationResult(operation,receipt,normalized)
      } catch(error) {
        if(mayHaveBeenAccepted)throw error
        throw new CommunityAuthorPresetRefusalV1(operation.operationId,error instanceof Error?error.message:String(error))
      }
    })
  }
  return {read,policy,readonlyPreset,ejsPreset,readonlyGlobalRegexes,mutate,mutateRegex,ensureControls,
    authorCatalog,authorTarget,manage,recoverAuthorOperation,settleAuthorPending,withAuthorRuntime,
    configurations(sessionId:string,presetId:string) {
    const conversationId=rootOf(sessionId)
    return read().configurationWrites.filter(row=>row.presetId===presetId).map(row=>({...row,
      writes:row.writes.filter(write=>write.scope==='global'||row.conversationId===null||row.conversationId===conversationId)}))
  },summary(sessionId:string) {
    const value=policy(sessionId)
    return {revision:value.revision,fingerprint:value.fingerprint,presetId:value.preset?.id??null,
      name:value.preset?.name??null,regexes:value.regexes.length+(value.preset?.regexes.length??0)}
  },previewPlans(sessionId:string,presetId:string,planIds:string[],scope:CommunityScope='conversation') {
    const state=read(),preset=state.presets.find(p=>p.id===presetId)
    if(!preset)throw Error('社区预设不存在')
    const {effective,applied}=preparedPlans(state,sessionId,scope,preset,planIds)
    return {changed:applied.preset.prompts.filter((prompt,index)=>prompt.enabled!==effective.prompts[index]?.enabled)
      .map(prompt=>({identifier:prompt.identifier,name:prompt.name,before:effective.prompts.find(p=>p.identifier===prompt.identifier)?.enabled,
        after:prompt.enabled})),unresolved:applied.unresolved}
  },exportPreset(id:string){const preset=read().presets.find(p=>p.id===id);if(!preset)throw Error('社区预设不存在');return exportPreset(preset)}}
}
export type CommunityPresets=ReturnType<typeof createCommunityPresets>
export type CommunityPresetPolicy=ReturnType<CommunityPresets['policy']>
