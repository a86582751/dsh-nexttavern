import {recordSha256} from './roleplay-data.js'
import {withTavernLock} from './tavern-task-support.js'
import type {CommunityPresetTable,CommunityVariableConfiguration} from './community-presets.js'
import type {CommunityJson} from './community-preset-types.js'
import type {CommunityMacroWrite} from './community-preset-macros.js'

interface VariableRecord {
  schemaVersion:1
  revision:number
  values:Record<string,CommunityJson>
  baselines:Record<string,Record<string,CommunityJson>>
  globalBaselines:Record<string,Record<string,CommunityJson>>
  accepted:Record<string,{digest:string;values:Record<string,CommunityJson>;configurationApplied:string[]}>
  configurationApplied:string[]
}
interface PresetVariables {
  schemaVersion:1
  revision:number
  global:Record<string,CommunityJson>
  globalBase:Record<string,CommunityJson>
  publications:{source:string;writes:readonly CommunityMacroWrite[]}[]
  configurationApplied:string[]
  conversations:Record<string,VariableRecord>
}
export interface CommunityVariableAttempt {
  schemaVersion:1
  presetId:string
  sessionId:string
  inputId:string
  attemptId:string
  chat:Record<string,CommunityJson>
  global:Record<string,CommunityJson>
  chatRevision:number
  globalRevision:number
  configurationApplied?:readonly string[]
}
const initial=():VariableRecord=>({schemaVersion:1,revision:0,values:{},baselines:{},globalBaselines:{},accepted:{},configurationApplied:[]})
const clone=<T>(value:T):T=>structuredClone(value)
/** Only accepted story results publish macro writes. Provider retries share
 * the attempt; regeneration starts from the saved player-input baseline. */
export function createCommunityPresetVariables(table:CommunityPresetTable) {
  const globalKey=(presetId:string)=>`community-global-v1__${presetId}`
  function read(presetId:string):PresetVariables {
    const record=table.get(globalKey(presetId)) as PresetVariables|undefined
    if(record&&record.schemaVersion!==1)throw Error('社区变量版本不受支持')
    return clone(record??{schemaVersion:1,revision:0,global:{},globalBase:{},publications:[],configurationApplied:[],conversations:{}})
  }
  function chatRecord(record:PresetVariables,sessionId:string,inheritedAttempts:readonly string[]=[]):VariableRecord {
    if(record.conversations[sessionId])return clone(record.conversations[sessionId])
    // A fork inherits the last accepted snapshot present in its actual event
    // cut. Reading the parent's current values would import future turns.
    const chat=initial()
    for(const attemptId of [...inheritedAttempts].reverse()) {
      const prior=Object.values(record.conversations).find(row=>row.accepted[attemptId])?.accepted[attemptId]
      if(prior){chat.values=clone(prior.values);chat.configurationApplied=clone(prior.configurationApplied);break}
    }
    return chat
  }
  function capture(presetId:string,sessionId:string,inputId:string,attemptId:string,
    inheritedAttempts:readonly string[]=[]):CommunityVariableAttempt {
    const record=read(presetId),chat=chatRecord(record,sessionId,inheritedAttempts)
    return {schemaVersion:1,presetId,sessionId,inputId,attemptId,chat:clone(chat.baselines[inputId]??chat.values),
      global:clone(chat.globalBaselines[inputId]??record.global),chatRevision:chat.revision,globalRevision:record.revision,
      configurationApplied:clone(chat.configurationApplied)}
  }
  async function commit(attempt:CommunityVariableAttempt,writes:readonly CommunityMacroWrite[]) {
    // The same preset lock serializes shared globals across conversations. Add
    // operations retain their delta, so concurrent accepted attempts do not lose increments.
    return withTavernLock(table,globalKey(attempt.presetId),async()=>{
      const record=read(attempt.presetId),chat=chatRecord(record,attempt.sessionId)
      const digest=recordSha256(writes)
      if(chat.accepted[attempt.attemptId])return {committed:false,revision:chat.revision}
      chat.configurationApplied=[...new Set([...chat.configurationApplied,...attempt.configurationApplied??[]])]
      if(!Object.hasOwn(chat.baselines,attempt.inputId))chat.baselines[attempt.inputId]=clone(attempt.chat)
      if(!Object.hasOwn(chat.globalBaselines,attempt.inputId))chat.globalBaselines[attempt.inputId]=clone(attempt.global)
      // Accepted regeneration replaces the previous variation's local writes.
      chat.values=clone(attempt.chat)
      const apply=(target:Record<string,CommunityJson>,write:CommunityMacroWrite)=>{
        if(write.operation==='delete')delete target[write.key]
        else if(write.operation==='add')target[write.key]=(Number(target[write.key]??0)||0)+(Number(write.value)||0)
        else if(write.operation==='append')target[write.key]=String(target[write.key]??'')+String(write.value??'')
        else target[write.key]=clone(write.value)
      }
      for(const write of writes)if(write.scope==='chat')apply(chat.values,write)
      const source=`${attempt.sessionId}:${attempt.inputId}`
      record.publications=record.publications.filter(row=>row.source!==source)
      record.publications.push({source,writes:clone(writes.filter(write=>write.scope==='global'))})
      // Rebuild shared values from accepted contributions in publication order.
      // Replacing a variation removes its old adds and string appends exactly,
      // including when another conversation published between the variations.
      record.global=clone(record.globalBase)
      for(const publication of record.publications)for(const write of publication.writes)apply(record.global,write)
      chat.accepted[attempt.attemptId]={digest,values:clone(chat.values),configurationApplied:clone(chat.configurationApplied)};chat.revision++
      record.conversations[attempt.sessionId]=chat;record.revision++
      // One durable write publishes global/local values and the accepted marker
      // together. A failed write cannot leave an increment without its receipt.
      await table.put(globalKey(attempt.presetId),record)
      return {committed:true,revision:chat.revision}
    })
  }
  async function setGlobal(presetId:string,key:string,value:CommunityJson) {
    return withTavernLock(table,globalKey(presetId),async()=>{
      const record=read(presetId);record.globalBase[key]=clone(value);record.global[key]=clone(value)
      for(const publication of record.publications)publication.writes=publication.writes.filter(write=>write.key!==key)
      record.revision++
      await table.put(globalKey(presetId),record);return record.revision
    })
  }
  async function configure(presetId:string,sessionId:string,configurations:readonly CommunityVariableConfiguration[],
    inheritedAttempts:readonly string[]=[]) {
    return withTavernLock(table,globalKey(presetId),async()=>{
      const record=read(presetId),chat=chatRecord(record,sessionId,inheritedAttempts)
      let changed=false
      for(const configuration of configurations) {
        const globalPending=!record.configurationApplied.includes(configuration.id),chatPending=!chat.configurationApplied.includes(configuration.id)
        if(!globalPending&&!chatPending)continue
        for(const write of configuration.writes) {
          if(write.scope==='global'&&!globalPending||write.scope==='chat'&&!chatPending)continue
          const targets=write.scope==='global'?[record.globalBase,record.global]:[chat.values,...Object.values(chat.baselines)]
          for(const target of targets) {
            if(write.operation==='delete')delete target[write.key]
            else target[write.key]=clone(write.value)
          }
          if(write.scope==='global')for(const publication of record.publications) {
            publication.writes=publication.writes.filter(previous=>previous.key!==write.key)
          }
        }
        if(globalPending)record.configurationApplied.push(configuration.id)
        if(chatPending)chat.configurationApplied.push(configuration.id)
        changed=true
      }
      if(changed){record.conversations[sessionId]=chat;record.revision++;await table.put(globalKey(presetId),record)}
    })
  }
  return {capture,commit,setGlobal,configure,readGlobal:(presetId:string)=>{const record=read(presetId);return {revision:record.revision,values:record.global}}}
}
