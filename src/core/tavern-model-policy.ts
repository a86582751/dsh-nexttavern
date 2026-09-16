import {withTavernLock} from './tavern-task-support.js'

export const PURPOSES = Object.freeze([
  {id:'memory',label:'记忆与场景整理'}, {id:'card-import',label:'读卡'},
  {id:'card-export',label:'角色卡导出'}, {id:'status',label:'状态栏'},
  {id:'decision',label:'决策建议'}, {id:'novel-export',label:'小说整理'},
])

export interface ModelRoute { provider: string; model: string; reasoningEffort?: string }
export interface ModelResolution {
  execution: 'inline' | 'spawn'
  actualRoute: ModelRoute
  main: ModelRoute
  policyRevision: {global: number; session: number}
}
interface Settings { allMain: boolean; routes: Record<string, ModelRoute | null> }
interface RecordBase { schemaVersion: 1; revision: number; source?: unknown; updatedAt?: number; [key: string]: unknown }
type SettingsRecord = RecordBase & Settings & {inherit?: false}
type PolicyRecord = SettingsRecord | (RecordBase & {inherit: true})
export interface PolicySession {
  id: string
  header?: {parentSession?: string}
  events?: readonly {type: string; data?: unknown}[]
  log?: readonly {type: string; data?: unknown}[]
  requestHeader?(): {config?: unknown} | undefined
}
interface PolicyAgent { options?: {provider?: unknown; model?: unknown; [key: string]: unknown} }
interface Options<S, A> {
  table: {get(key: string): unknown; put(key: string, value: unknown): unknown | PromiseLike<unknown>}
  main(target: S, agent?: A): unknown | PromiseLike<unknown>
  session(id: string): S | null | undefined | PromiseLike<S | null | undefined>
  canonicalize?(value: ModelRoute): unknown | PromiseLike<unknown>
  legacy?: {provider?: unknown; model?: unknown; [key: string]: unknown}
}
const copy = <T>(value: T): T => value == null ? value : structuredClone(value)
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
const settingKey = (id: string) => `tavern_policy__${id}`
const validPurpose = (id: string) => PURPOSES.some(p=>p.id===id)

function route(raw: unknown): ModelRoute {
  const value=object(raw)
  if (!value) throw new Error('模型路由无效')
  const {provider,model,reasoningEffort}=value
  if(typeof provider!=='string'||typeof model!=='string'||[provider,model].some(v=>!v.trim()||v.length>300||/[\x00-\x1f]/.test(v)))throw new Error('模型路由无效')
  if(reasoningEffort!=null&&(typeof reasoningEffort!=='string'||reasoningEffort.length>64||/[^a-zA-Z0-9_-]/.test(reasoningEffort)))throw new Error('推理参数无效')
  return {provider:provider.trim(),model:model.trim(),...(typeof reasoningEffort==='string'?{reasoningEffort}:{})}
}
function settings(raw: unknown): Settings {
  const value=object(raw)
  if (!value || typeof value.allMain !== 'boolean') throw new Error('必须指定全部使用主模型开关')
  const routes: Record<string, ModelRoute | null>={}
  for (const [kind,raw] of Object.entries(Object(value.routes??{}) as Record<string, unknown>)) {
    if (!validPurpose(kind)) throw new Error('未知模型用途')
    routes[kind]=raw==null ? null : route(raw)
  }
  return {allMain:value.allMain,routes}
}
function decodePolicy(value: unknown): PolicyRecord {
  const data=object(value)
  if(!data || data.schemaVersion!==1 || typeof data.revision!=='number' || !Number.isSafeInteger(data.revision) || data.revision<0)throw new Error('模型策略记录损坏或版本不受支持')
  if(data.inherit!==undefined&&typeof data.inherit!=='boolean')throw new Error('模型策略记录损坏')
  if(data.inherit!==true) {
    if(typeof data.allMain!=='boolean'||!object(data.routes)||Array.isArray(data.routes))throw new Error('模型策略记录损坏')
    // Validate while preserving stored route bytes and extension metadata.
    settings(data)
  }
  return data as PolicyRecord
}

export function selectedMainRoute(session: PolicySession | null | undefined,agent: PolicyAgent | null | undefined,fallback: unknown): ModelRoute {
  let pending: Record<string, unknown> | undefined,used: Record<string, unknown> | undefined
  // alpha.3 selection history adapter; GA projections/async history need a separate migration.
  for(const event of session?.events??session?.log??[]) {
    if(event?.type==='model/selection')pending=object(event.data)
    if(event?.type==='request/header') {
      used=object(object(object(event.data)?.header)?.config)??used
      if(pending&&used&&pending.provider===used.provider&&pending.model===used.model&&pending.reasoningEffort===used.reasoningEffort)pending=undefined
    }
  }
  const configured=pending??used??object(session?.requestHeader?.()?.config)
  return configured?.provider&&configured?.model?route(configured):agent?.options?.provider&&agent?.options?.model?route(agent.options):route(fallback)
}

/** Models come from the host; no provider credentials are copied into records. */
export function createModelPolicy<S extends PolicySession, A = PolicyAgent>({table,main,session,canonicalize=value=>value,legacy}: Options<S,A>) {
  async function globalRecord(): Promise<SettingsRecord> {
    return withTavernLock(table,settingKey('global'),async()=>{
      let raw=table.get(settingKey('global'))
      if(raw===undefined) {
        const worker=legacy?.provider&&legacy?.model?route(legacy):null
        raw={schemaVersion:1,revision:1,allMain:!worker,routes:worker?Object.fromEntries(['memory','status','decision'].map(id=>[id,worker])):{},source:{kind:worker?'legacy-explicit-worker':'default'},updatedAt:Date.now()}
        await table.put(settingKey('global'),raw)
      }
      const value=decodePolicy(raw)
      if(value.inherit===true)throw new Error('全局模型策略不能继承')
      return copy(value)
    })
  }
  async function read(target: S,agent?: A) {
    const global=await globalRecord()
    let override: SettingsRecord | null=null,owner: S | null | undefined=target
    const seen=new Set<string>()
    while(owner&&!seen.has(owner.id)) {
      seen.add(owner.id)
      const raw=table.get(settingKey(owner.id))
      if(raw!==undefined) {const stored=decodePolicy(raw);if(stored.inherit===true)break;override=copy(stored);break}
      owner=owner.header?.parentSession?await session(owner.header.parentSession):null
    }
    const effective=override?{...global,...override,routes:{...global.routes,...override.routes}}:global
    const local=table.get(settingKey(target.id))
    return {global,session:local===undefined?null:copy(decodePolicy(local)),effective,main:route(await main(target,agent)),inheritedFrom:override&&owner&&owner.id!==target.id?owner.id:null,purposes:PURPOSES}
  }
  return {
    read,
    async save(target: S,scope: string,value: unknown,expectedRevision?: number | null) {
      if(!['global','session'].includes(scope))throw new Error('配置范围无效')
      if(scope==='global'&&value===null)throw new Error('全局配置不能清除')
      const key=settingKey(scope==='global'?'global':target.id)
      return withTavernLock(table,key,async()=>{
        const raw=table.get(key),prior=raw===undefined?null:decodePolicy(raw)
        if(expectedRevision!=null&&expectedRevision!==(prior?.revision??0))throw new Error('配置已更新，请重新载入后保存')
        const next: PolicyRecord={schemaVersion:1,revision:(prior?.revision??0)+1,...(value===null?{inherit:true as const}:settings(value)),source:{kind:'player-settings',sessionId:target.id},updatedAt:Date.now()}
        await table.put(key,next)
        return copy(next)
      })
    },
    async resolve(target: S,kind: string,agent?: A): Promise<ModelResolution> {
      if(!validPurpose(kind))throw new Error('未知模型用途')
      const data=await read(target,agent),selected=data.effective.allMain?data.main:data.effective.routes[kind]??data.main
      const actual=route(await canonicalize(selected)),primary=route(await canonicalize(data.main))
      const inline=actual.provider===primary.provider&&actual.model===primary.model
      return {execution:inline?'inline':'spawn',actualRoute:inline?primary:actual,main:primary,policyRevision:{global:data.global.revision,session:data.session?.revision??0}}
    },
  }
}
