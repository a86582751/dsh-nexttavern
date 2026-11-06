import {randomUUID} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import {createCharacterOffscreen, OFFSCREEN_PERSONA, type OffscreenRoute, type OffscreenTask} from './character-cluster-offscreen.js'
import type {CharacterSettings} from './character-cluster-projection.js'
import type {ClusterSettingsTable} from './character-cluster-settings.js'
import type {NativeDurableInputWorkReceiptV1} from 'dsh-nexttavern-native-agent-loop'
import {createCharacterPrivateMemory, characterPrivatePrompt, CharacterPrivateConflict, type CharacterPrivateTable,
  type CharacterPrivateView, type CharacterViewIdentity, type CharacterPrivateRecord,
  type CharacterForkSnapshot,type CharacterPrivateInput,type CharacterPrivatePersona} from '../memory/character-private-memory.js'

export interface CharacterMaterial {
  id:string
  name:string
  /** Stable on append, changed by the Source owner on removal or replacement. */
  identity:string
  materialId:string
  sourceKeys:readonly string[]
  /** Bounded static author refs; the Source owner keeps historical memory keys separately. */
  authorSourceKeys?:readonly string[]
  authorText:string
  /** Dynamic authors join extraction only with the body's published material. */
  requiresPublishedMaterial?:true
  available:boolean
  player?:boolean
  presence?:'present'|'absent'|'unknown'
}
export interface CharacterTaskReference {
  kind:'character-perception'|'character-offscreen'
  taskId:string
  generation:string
  childSessionId?:string
  resultSha256?:string
}
export interface CharacterTaskResult extends CharacterTaskReference {result:unknown;resultSha256:string}
export interface CharacterPrivateRequest {
  branchId:string
  kind:CharacterTaskReference['kind']
  sourceKey:string
  input:Record<string,unknown>
  system:string
  user:string
  route?:OffscreenRoute
  signal:AbortSignal
  current():boolean
  onPrepared(reference:CharacterTaskReference):Promise<void>
}
export interface CharacterCanonicalAcceptance {
  branchId:string
  inputId:string
  ordinal:number
  kind:'story'|'regenerate'|'management'
  canonical:{key:string;seq:number;text:string}
  /** Already published author material at this body's actual request cut. */
  authorMaterial?:unknown
}
export interface CharacterAcceptedInput {
  branchId:string
  inputId:string
  ordinal:number
  kind:'story'|'regenerate'|'management'
  checkpoint?:NativeDurableInputWorkReceiptV1
  completedWorkRequired?:true
}
export interface CharacterInputIntent {
  branchId:string
  inputId:string
  ordinal:number
  checkpoint:NativeDurableInputWorkReceiptV1
  completedWorkRequired?:true
  members:readonly {
    id:string
    identity:string
    materialId:string
    sourceKeys:readonly string[]
    view:CharacterViewIdentity
  }[]
}
export type CharacterCompletedInput={kind:'completed';canonical:CharacterCanonicalAcceptance['canonical'];authorMaterial?:unknown}
  |{kind:'pending';reason:string}
  |{kind:'interrupted';reason:string}
  |{kind:'unavailable';reason:string}
export interface CharacterPrivateDependencies {
  memoryTable:CharacterPrivateTable
  branchTable:ClusterSettingsTable
  withSourceLock<T>(branchId:string,work:()=>Promise<T>):Promise<T>
  characters(branchId:string):readonly CharacterMaterial[]
  settings(branchId:string):CharacterSettings
  request(input:CharacterPrivateRequest):Promise<CharacterTaskResult>
  readCompleted(branchId:string,reference:CharacterTaskReference):CharacterTaskResult|undefined
  readCompletedInput?(branchId:string,intent:CharacterInputIntent):Promise<CharacterCompletedInput>
  mainRoute(branchId:string):OffscreenRoute|PromiseLike<OffscreenRoute>
  active(branchId:string):boolean
  budget?(branchId:string,route:OffscreenRoute):number
}
export interface CharacterPrivateForkV1 {
  schemaVersion:1
  parentBranchId:string
  characters:{id:string;snapshot:CharacterForkSnapshot}[]
}
interface Member {
  id:string
  identity:string
  materialId:string
  view:CharacterViewIdentity
  sourceKeys?:readonly string[]
  input?:CharacterPrivateInput
  status:'pending'|'published'|'stale'
  reason?:string
}
interface PerceptionCharacter {
  id:string
  ready:boolean
  persona?:string
  personaSourceKeys?:string[]
  presence?:CharacterPrivatePersona['presence']
  records:Pick<CharacterPrivateRecord,'category'|'text'|'certainty'|'sourceKeys'|'evidenceSeq'>[]
}
interface Run {
  schemaVersion:1
  id:string
  branchId:string
  inputId:string
  ordinal?:number
  canonical?:CharacterCanonicalAcceptance['canonical']
  authorMaterial?:unknown
  members:Member[]
  status:'queued'|'running'|'generated'|'completed'|'failed'|'interrupted'
  task?:CharacterTaskReference
  result?:PerceptionCharacter[]
  reason?:string
}
interface Head {schemaVersion:1;pending:string[];latest?:string;inputIntents?:CharacterInputIntent[]}
interface OffscreenResult {schemaVersion:1;task:CharacterTaskReference;text:string;input?:CharacterPrivateInput}
const retryable=(job:Run)=>job.status==='failed'||job.status==='interrupted'||job.members.some(member=>member.status==='stale')
const referenceOf=({result:_result,...reference}:CharacterTaskResult):CharacterTaskReference=>reference
const materialSourceKey=(value:unknown)=>{
  const key=(value as {sourceKey?:unknown}|undefined)?.sourceKey
  return typeof key==='string'?key:undefined
}
const scope=(branchId:string,characterId:string)=>({branchId,characterId})
const identity=({branchId,characterId,revision,boundaryId,materialId}:CharacterViewIdentity):CharacterViewIdentity=>
  ({branchId,characterId,revision,boundaryId,materialId})
const same=(a:CharacterViewIdentity,b:CharacterViewIdentity)=>a.branchId===b.branchId&&a.characterId===b.characterId
  &&a.revision===b.revision&&a.boundaryId===b.boundaryId&&a.materialId===b.materialId
const headKey=(branch:string)=>`character_private_service__${branch}`
const runKey=(id:string)=>`character_private_perception__${recordSha256(id)}`
const scopeKey=(branch:string,id:string)=>recordSha256([branch,id])
const offscreenKey=(task:OffscreenTask)=>`character_private_offscreen__${recordSha256([task.member.taskId,task.member.generation])}`
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error)
const PERCEPTION_SYSTEM=`你是受信任的角色知情材料提取器。作者归属全文仅供你判断，不等于该角色本人知情。
一次为输入清单中的每个人返回 {characters:[{id,ready,persona?,personaSourceKeys?,presence?,records:[]}]}。
persona必须是可扮演的本人私有人格，排除本人不知道的秘密。没有可靠材料时ready=false，不能用作者全文兜底。
已可靠且没有变化的人物返回ready=true,records=[]，不重复旧知识。若未改变私有人格，省略persona。
每条records包括category(experience/hearsay/belief/emotion/relationship/goal/state)、text、certainty(confirmed/unconfirmed/intention)、sourceKeys，evidenceSeq可选。
保留误解、传闻、意向与未知；不把推演当世界事实。sourceKeys及personaSourceKeys只能引用该人物输入allowedSourceKeys。
personSourceKeys不是新的权限；更改persona时用personaSourceKeys明确引用已给来源。presence仅present/absent/unknown。
只返回JSON，不新增人物，不提出工具或模型请求。`

/** Source owns material currency, TavernTasks owns Native execution, and the
 * memory owner alone publishes private records. Network work holds no Source lock. */
export function createRoleplayCharacterPrivate(deps:CharacterPrivateDependencies) {
  const memory=createCharacterPrivateMemory(deps.memoryTable),loaded=new Set<string>()
  const boundaries=new Map<string,string>(),sourceVersions=new Map<string,string>(),queues=new Map<string,Promise<void>>()
  const fresh=new Set<string>(),generated=new Map<string,Run>(),controllers=new Map<string,AbortController>()
  const inputStates=new Map<string,Map<string,CharacterCompletedInput>>()
  let disposed=false
  const enabled=(branch:string)=>!disposed&&deps.active(branch)&&deps.settings(branch).enabled
  const roster=(branch:string)=>deps.characters(branch).filter(row=>!row.player)
  const head=(branch:string):Head=>deps.branchTable.get(headKey(branch)) as Head??{schemaVersion:1,pending:[]}
  const run=(id:string)=>deps.branchTable.get(runKey(id)) as Run|undefined
  const material=(branch:string,id:string)=>roster(branch).find(row=>row.id===id)
  const locked=<T>(branch:string,work:()=>Promise<T>)=>deps.withSourceLock(branch,work)
  const states=(branch:string)=>{
    let value=inputStates.get(branch)
    if(!value)inputStates.set(branch,value=new Map())
    return value
  }
  function inputBarrier(branch:string,characterId?:string) {
    return (head(branch).inputIntents??[]).find(intent=>
      (characterId===undefined||intent.members.some(member=>member.id===characterId))
      &&inputStates.get(branch)?.get(intent.inputId)?.kind!=='pending')
  }
  const sourceVersion=(row:CharacterMaterial)=>`${row.identity}:${row.available}`
  async function synchronize(branch:string) {
    for(const row of roster(branch)) {
      const key=scopeKey(branch,row.id),version=sourceVersion(row)
      if(sourceVersions.get(key)===version)continue
      const boundaryId=row.identity
      await memory.synchronize(scope(branch,row.id),{identity:boundaryId,materialId:row.materialId,
        playablePersona:'',sourceKeys:row.sourceKeys,ready:row.available})
      boundaries.set(key,boundaryId)
      sourceVersions.set(key,version)
    }
  }
  function memberCurrent(branch:string,member:Member) {
    const row=material(branch,member.id)
    return !!row?.available&&row.identity===member.identity&&row.materialId===member.materialId
      &&same(memory.view(scope(branch,member.id)),member.view)
  }
  function parseResult(value:unknown,job:Run):PerceptionCharacter[] {
    const parsed=typeof value==='string'?JSON.parse(value):value
    const rows=(parsed as {characters?:PerceptionCharacter[]})?.characters,members=job.members.filter(member=>member.status==='pending')
    if(!Array.isArray(rows)||rows.length!==members.length)throw Error('角色感知结果缺少人物或包含未知人物')
    const ids=new Set<string>()
    for(const row of rows) {
      if(!row||ids.has(row.id)||!members.some(member=>member.id===row.id)
        ||typeof row.ready!=='boolean'||!Array.isArray(row.records))throw Error('角色感知人物结果无效')
      ids.add(row.id)
      if(row.persona!==undefined&&(typeof row.persona!=='string'||!row.persona.trim()
        ||!Array.isArray(row.personaSourceKeys)))throw Error('角色私有人格缺少可靠来源')
      if(row.presence!==undefined&&!['present','absent','unknown'].includes(row.presence))throw Error('人物在场状态无效')
      for(const record of row.records)if(!record||typeof record.text!=='string'||!record.text.trim()
        ||!['experience','hearsay','belief','emotion','relationship','goal','state'].includes(record.category)
        ||!['confirmed','unconfirmed','intention'].includes(record.certainty)||!Array.isArray(record.sourceKeys)
        ||record.sourceKeys.some(key=>typeof key!=='string'))throw Error('角色感知记录无效')
    }
    return structuredClone(rows)
  }
  async function saveRun(job:Run) {await deps.branchTable.put(runKey(job.id),job)}
  async function restoreRun(job:Run) {
    if(job.status==='queued'&&!job.task) {
      // Native dispatch waits for onPrepared to persist its real task ref.
      // A queued row without that ref has never spent its first request.
      fresh.add(job.id);return
    }
    if(job.status!=='queued'&&job.status!=='running')return
    const completed=job.task&&deps.readCompleted(job.branchId,job.task)
    if(completed) {
      job.task=referenceOf(completed);job.result=parseResult(completed.result,job);job.status='generated'
    }else {job.status='interrupted';job.reason='进程中断；未自动再次请求模型'}
    await saveRun(job)
  }
  async function publish(job:Run) {
    await locked(job.branchId,async()=>{
      await synchronize(job.branchId)
      const failures:unknown[]=[]
      for(const member of job.members) {
        if(member.status!=='pending')continue
        const output=job.result!.find(row=>row.id===member.id)!,row=material(job.branchId,member.id)
        const publication=`${job.task!.taskId}:${job.task!.generation}:${member.id}`
        // One owner publication atomically includes the persona and records.
        // Its durable receipt survives a failed service progress ACK.
        if(memory.generatedReceipt(scope(job.branchId,member.id),publication)) {
          member.status='published';await saveRun(job);continue
        }
        if(!enabled(job.branchId)||!row?.available||row.identity!==member.identity||row.materialId!==member.materialId
          ||!memberCurrent(job.branchId,member)) {
          member.status='stale';member.reason='人物资料、私有修订或来源已变化';await saveRun(job);continue
        }
        if(member.sourceKeys) {
          const supplied=new Set([...member.sourceKeys,...member.input?.sourceKeys??[]])
          if([...(output.personaSourceKeys??[]),...output.records.flatMap(record=>record.sourceKeys)]
            .some(key=>!supplied.has(key))) {
            member.status='stale';member.reason='感知引用本次未提供的来源';await saveRun(job);continue
          }
        }
        if(!output.ready) {
          member.status='stale';member.reason='缺少可靠私有人格或知情材料';await saveRun(job);continue
        }
        if(row.requiresPublishedMaterial&&output.persona
          &&!output.personaSourceKeys?.includes(materialSourceKey(job.authorMaterial)??'')) {
          member.status='stale';member.reason='动态私有人格没有引用本轮实际发表材料';await saveRun(job);continue
        }
        const currentPersona=memory.persona(scope(job.branchId,member.id))
        if(!currentPersona&&!output.persona) {
          member.status='stale';member.reason='首次感知没有提供可靠私有人格';await saveRun(job);continue
        }
        const changedText=output.persona!==undefined&&(output.persona!==currentPersona?.text||!currentPersona)
        const changedPresence=currentPersona&&output.presence!==undefined&&output.presence!==currentPersona.presence
        const persona:CharacterPrivatePersona|undefined=changedText||changedPresence
          ?{id:`${publication}:persona`,
            materialId:row.materialId,text:changedText?output.persona!:currentPersona!.text,
            sourceKeys:changedText?output.personaSourceKeys!:currentPersona!.sourceKeys,
            publicationId:`${publication}:persona`,presence:output.presence??currentPersona?.presence??'unknown'}
          :undefined
        const records=output.records.map((record,index):CharacterPrivateRecord=>({...record,schemaVersion:1,
          id:`${publication}:${index}`,kind:'perceived',materialId:row.materialId,consumedRevision:member.view.revision,
          evidenceSeq:job.canonical&&record.sourceKeys.includes(job.canonical.key)?job.canonical.seq:undefined,
          triggerInputId:job.inputId,taskId:job.task!.taskId,generation:job.task!.generation,
          publicationId:`${publication}:${index}`,publicationBranchId:job.branchId}))
        if(!member.input) {
          member.status='stale';member.reason='已生成结果缺少原消费依赖，保留结果供检查';await saveRun(job);continue
        }
        try {await memory.publishGenerated(scope(job.branchId,member.id),member.view,
          {id:publication,input:member.input,...persona?{persona}:{},records})}
        catch(error) {
          if(error instanceof CharacterPrivateConflict) {
            member.status='stale';member.reason=error.message;await saveRun(job)
          }else failures.push(error)
          continue
        }
        member.status='published';await saveRun(job)
      }
      if(failures.length)throw new AggregateError(failures,'部分角色记忆发布失败，已生成结果保留供恢复')
      job.status='completed';await saveRun(job)
      const current=head(job.branchId)
      await deps.branchTable.put(headKey(job.branchId),{...current,pending:current.pending.filter(id=>id!==job.id)})
      generated.delete(job.id)
    })
  }
  async function load(branch:string) {
    await synchronize(branch)
    if(loaded.has(branch))return
    for(const id of head(branch).pending) {
      const stored=run(id),job=stored&&structuredClone(stored)
      if(!job)throw Error('角色感知待处理记录缺失')
      await restoreRun(job)
    }
    loaded.add(branch)
  }
  async function route(branch:string):Promise<OffscreenRoute> {
    const selected=deps.settings(branch).defaultRoute
    if(selected&&!('main' in selected))return {...selected}
    return {...await deps.mainRoute(branch),...(selected?.reasoningEffort?{reasoningEffort:selected.reasoningEffort}:{})}
  }
  async function execute(job:Run) {
    if(job.status==='queued') {
      if(!fresh.delete(job.id)) {
        job.status='interrupted';job.reason='准备记录未获确认；未自动再次请求模型'
        await locked(job.branchId,()=>saveRun(job));return
      }
      const controller=new AbortController();controllers.set(job.branchId,controller)
      const current=()=>enabled(job.branchId)&&job.members.some(member=>member.status==='pending'&&memberCurrent(job.branchId,member))
      try {
        const input=await locked(job.branchId,async()=>{
          await synchronize(job.branchId)
          for(const member of job.members) {
            const row=material(job.branchId,member.id)
            if(!row?.available||row.identity!==member.identity||row.materialId!==member.materialId) {
              member.status='stale';member.reason='原输入人物来源已变化，感知不可用'
            }
            else member.view=identity(memory.view(scope(job.branchId,member.id)))
          }
          if(!job.members.some(member=>member.status==='pending')) {
            job.status='completed';await saveRun(job);return undefined
          }
          if(!current())throw Error('角色感知来源已失效')
          const input={canonical:job.canonical,authorMaterial:job.authorMaterial,
            characters:job.members.filter(member=>member.status==='pending').map(member=>{
              const row=material(job.branchId,member.id)!,view=memory.view(scope(job.branchId,member.id))
              const privateView=view.ready?characterPrivatePrompt(view):null
              member.input=memory.captureInput(scope(job.branchId,member.id),privateView?.memories.map(record=>record.id)??[],
                {sourceKeys:[...job.canonical?[job.canonical.key]:[],
                  ...materialSourceKey(job.authorMaterial)?[materialSourceKey(job.authorMaterial)!]:[]],
                ...(job.canonical?{originCut:job.canonical.seq+1}:{}),consumePersona:privateView!==null})
              return {id:row.id,name:row.name,authorText:row.authorText,
                allowedSourceKeys:[...new Set([...member.sourceKeys??row.sourceKeys,...member.input.sourceKeys])],privateView}
            })}
          job.status='running';await saveRun(job)
          return input
        })
        if(!input)return
        const result=await deps.request({branchId:job.branchId,kind:'character-perception',sourceKey:job.id,
          input,system:PERCEPTION_SYSTEM,user:JSON.stringify(input),route:await route(job.branchId),signal:controller.signal,current,
          onPrepared:reference=>locked(job.branchId,async()=>{job.task=reference;await saveRun(job)})})
        job.task=referenceOf(result);job.result=parseResult(result.result,job);job.status='generated'
        generated.set(job.id,job)
        await locked(job.branchId,()=>saveRun(job))
      }catch(error) {
        if(job.status!=='generated') {job.status='failed';job.reason=errorText(error);await locked(job.branchId,()=>saveRun(job))}
        throw error
      }finally {if(controllers.get(job.branchId)===controller)controllers.delete(job.branchId)}
    }
    if(job.status==='generated')await publish(job)
  }
  function kick(branch:string) {
    const previous=queues.get(branch)??Promise.resolve()
    const next=previous.catch(()=>{}).then(async()=>{
      if(disposed||!enabled(branch))return
      const ids=await locked(branch,async()=>{await load(branch);return [...head(branch).pending]})
      if(inputBarrier(branch))return
      for(const id of ids) {
        const stored=run(id),job=generated.get(id)??(stored&&structuredClone(stored))
        if(!job)continue
        await execute(job)
        if(job.status==='completed')await locked(branch,async()=>{
          const value=head(branch)
          if(value.pending.includes(id))await deps.branchTable.put(headKey(branch),{...value,pending:value.pending.filter(key=>key!==id)})
        })
      }
      await offscreen.flush(branch)
    })
    queues.set(branch,next)
    void next.finally(()=>{if(queues.get(branch)===next)queues.delete(branch)}).catch(()=>{})
    return next
  }
  async function registerLocked({branch,id,inputId,canonical,authorMaterial,original,intent,ordinal}:{
    branch:string;id:string;inputId:string;canonical?:Run['canonical'];authorMaterial?:unknown;
    original?:Run;intent?:CharacterInputIntent;ordinal?:number}) {
      if(!intent&&!enabled(branch))return
      const oldMaterialKey=original&&materialSourceKey(original.authorMaterial)
      const retryAllowed=(row:CharacterMaterial)=>!original||original.members.some(member=>member.id===row.id&&member.identity===row.identity)
        &&(!original.canonical||row.sourceKeys.includes(original.canonical.key))&&(!oldMaterialKey||row.sourceKeys.includes(oldMaterialKey))
      if(original) {
        if(!roster(branch).some(row=>row.available&&retryAllowed(row)))
          throw Error('原感知来源已失效，请使用当前正文的感知任务')
      }
      const prior=run(id)
      let job=prior&&structuredClone(prior)
      if(!job) {
        const publishedMaterial=materialSourceKey(authorMaterial)
        const candidates=intent?.members??roster(branch).filter(row=>row.available&&retryAllowed(row)
          &&(!row.requiresPublishedMaterial||!!canonical&&!!publishedMaterial))
          .map(row=>({id:row.id,identity:row.identity,materialId:row.materialId,
            sourceKeys:[...row.authorSourceKeys??row.sourceKeys],view:identity(memory.view(scope(branch,row.id)))}))
        const members:Member[]=candidates.map(captured=>{
          const row=material(branch,captured.id),sameSource=row?.available&&row.identity===captured.identity
            &&row.materialId===captured.materialId
          const missingMaterial=row?.requiresPublishedMaterial&&(!canonical||!publishedMaterial),valid=sameSource&&!missingMaterial
          return {...captured,sourceKeys:[...captured.sourceKeys],
            view:valid?identity(memory.view(scope(branch,captured.id))):captured.view,
            status:valid?'pending':'stale',...valid?{}:{reason:missingMaterial
              ?'动态人物尚无本轮实际发表材料':'原输入人物来源已变化，感知不可用'}}
        })
        const acceptedOrdinal=intent?.ordinal??ordinal
        job={schemaVersion:1,id,branchId:branch,inputId,members,
          ...(acceptedOrdinal===undefined?{}:{ordinal:acceptedOrdinal}),
          status:members.some(member=>member.status==='pending')?'queued':'completed',
          ...(canonical?{canonical:structuredClone(canonical)}:{}),...(authorMaterial===undefined?{}:{authorMaterial:structuredClone(authorMaterial)})}
        if(!members.length&&!intent)return
        const additional=[...canonical?[canonical.key]:[],...materialSourceKey(authorMaterial)?[materialSourceKey(authorMaterial)!]:[]]
        if(additional.length)for(const member of members)if(member.status==='pending')
          await memory.extendSources(scope(branch,member.id),additional)
        await saveRun(job)
      }else if(!head(branch).pending.includes(id))await restoreRun(job)
      const value=head(branch)
      if(!prior||intent||job.status!=='completed'&&!value.pending.includes(id)) {
        const pending=job.status==='completed'?value.pending.filter(key=>key!==id)
          :value.pending.includes(id)?[...value.pending]:[...value.pending,id]
        const order=(key:string)=>(key===id?job:run(key))?.ordinal??-1
        pending.sort((left,right)=>order(left)-order(right))
        // One Head put transfers the accepted-input obligation to the existing
        // Run queue. A failed write keeps the original intent recoverable.
        await deps.branchTable.put(headKey(branch),{...value,schemaVersion:1,pending,latest:id,
          ...(intent?{inputIntents:(value.inputIntents??[]).filter(item=>item.inputId!==intent.inputId)}:{})})
      }
      if(job.status==='queued'&&!job.task)fresh.add(id)
      if(intent)states(branch).delete(intent.inputId)
  }
  async function register(branch:string,id:string,inputId:string,canonical?:Run['canonical'],
    authorMaterial?:unknown,original?:Run,ordinal?:number) {
    await locked(branch,async()=>{
      await load(branch)
      const intent=(head(branch).inputIntents??[]).find(item=>item.inputId===inputId)
      await registerLocked({branch,id,inputId,canonical,authorMaterial,original,intent,ordinal})
    })
  }
  async function recoverInputs(branch:string) {
    const intents=await locked(branch,async()=>[...head(branch).inputIntents??[]]
      .sort((left,right)=>left.ordinal-right.ordinal))
    for(const intent of intents) {
      const observed=states(branch)
      if(!observed.has(intent.inputId))
        observed.set(intent.inputId,{kind:'unavailable',reason:'等待原输入的持久完成事实'})
      let completed=observed.get(intent.inputId)!
      if(completed.kind!=='completed') {
        try {
          completed=await deps.readCompletedInput?.(branch,intent)
            ??{kind:'unavailable',reason:'原输入持久完成读取服务不可用'}
        }catch(error) {
          observed.set(intent.inputId,{kind:'unavailable',reason:errorText(error)});throw error
        }
      }
      await locked(branch,async()=>{
        const value=head(branch),currentIntent=value.inputIntents?.find(item=>item.inputId===intent.inputId)
        if(!currentIntent){observed.delete(intent.inputId);return}
        const notified=observed.get(intent.inputId)
        if(completed.kind==='pending'&&notified?.kind==='completed')completed=notified
        observed.set(intent.inputId,completed)
        if(completed.kind==='pending'||completed.kind==='unavailable')return
        if(completed.kind==='interrupted') {
          await deps.branchTable.put(headKey(branch),{...value,
            inputIntents:value.inputIntents!.filter(item=>item.inputId!==intent.inputId)})
          observed.delete(intent.inputId);return
        }
        const id=`body:${recordSha256({branch,key:completed.canonical.key})}`
        await registerLocked({branch,id,inputId:intent.inputId,canonical:completed.canonical,
          authorMaterial:completed.authorMaterial,intent:currentIntent,ordinal:intent.ordinal})
      })
    }
  }
  async function initialize(branch:string) {
    const needed=await locked(branch,async()=>{
      await load(branch)
      return roster(branch).some(row=>row.available&&!row.requiresPublishedMaterial&&!memory.view(scope(branch,row.id)).ready)
    })
    if(!needed)return
    const id=`init:${recordSha256({branch,materials:roster(branch).map(row=>[row.id,row.identity,row.materialId])})}`
    await register(branch,id,'initialization')
    await kick(branch)
  }
  async function ready(branch:string) {
    await locked(branch,()=>load(branch))
    await recoverInputs(branch)
    await kick(branch)
  }
  function rejectedMember(branch:string,characterId:string) {
    const latest=head(branch).latest,job=latest?run(latest):undefined
    return job?.status==='completed'?job.members.find(member=>member.id===characterId&&member.status==='stale'):undefined
  }
  function current(view:CharacterPrivateView) {
    const row=material(view.branchId,view.characterId)
    const rejected=rejectedMember(view.branchId,view.characterId)
    return enabled(view.branchId)&&!!row?.available&&boundaries.get(scopeKey(view.branchId,view.characterId))===view.boundaryId
      &&sourceVersions.get(scopeKey(view.branchId,view.characterId))===sourceVersion(row)
      &&!inputBarrier(view.branchId,view.characterId)&&!rejected
      &&memory.current(view)
  }
  async function prepare(branch:string,id:string,signal?:AbortSignal) {
    signal?.throwIfAborted()
    if(!enabled(branch))throw Error('角色集群未启用')
    await ready(branch)
    const unresolved=inputBarrier(branch,id)
    if(unresolved)throw Error(inputStates.get(branch)?.get(unresolved.inputId)?.kind==='unavailable'
      ?(inputStates.get(branch)!.get(unresolved.inputId) as {reason:string}).reason:'原输入正文感知登记尚未完成')
    const rejected=rejectedMember(branch,id)
    if(rejected)throw Error(`${rejected.reason??'角色材料尚未准备'}，建议暂不可用`)
    if(material(branch,id)?.requiresPublishedMaterial&&!memory.view(scope(branch,id)).ready)
      throw Error('动态人物尚未取得实际发表材料，建议暂不可用')
    if(!memory.view(scope(branch,id)).ready)await initialize(branch)
    signal?.throwIfAborted()
    const view=memory.view(scope(branch,id))
    const pending=head(branch).pending.map(runId=>run(runId)).find(job=>job?.members.some(member=>member.id===id&&member.status==='pending'))
    if(pending||!current(view))throw Error(pending?.reason??'角色感知尚未完成，建议暂不可用')
    return view
  }
  const offscreen=createCharacterOffscreen({table:deps.branchTable,settings:deps.settings,main:deps.mainRoute,
    budget:(branch,selected)=>deps.budget?.(branch,selected)??deps.settings(branch).offscreen?.maxCharacters??2,
    candidates:branch=>roster(branch).map(row=>{
      const view=memory.view(scope(branch,row.id))
      return {characterId:row.id,player:false,presence:view.presence??row.presence??'unknown',
        ready:current(view),priority:0,relevance:0,activeGoals:view.entries.filter(entry=>entry.category==='goal').length,
        lastAdvancedOrdinal:0,view}
    }),
    execute:async(task,signal)=>{
      const view=task.member.view as CharacterPrivateView,key=offscreenKey(task)
      const {input,consumed}=await locked(task.branchId,async()=>{
        const input=characterPrivatePrompt(view)
        const consumed=memory.captureInput(scope(task.branchId,task.member.characterId),
          input.memories.map(record=>record.id),{sourceKeys:[],originCut:task.ordinal+1})
        return {input,consumed}
      })
      const result=await deps.request({branchId:task.branchId,kind:'character-offscreen',sourceKey:key,input,
        system:OFFSCREEN_PERSONA,user:JSON.stringify(input),route:task.route,signal,current:()=>current(view),
        onPrepared:reference=>locked(task.branchId,async()=>{
          await deps.branchTable.put(key,{schemaVersion:1,task:reference,text:'',input:consumed} satisfies OffscreenResult)
        })})
      if(typeof result.result!=='string'||!result.result.trim())throw Error('场外角色返回空结果')
      const text=result.result
      await locked(task.branchId,async()=>{
        await deps.branchTable.put(key,{schemaVersion:1,task:referenceOf(result),text,input:consumed} satisfies OffscreenResult)
      })
      return text
    },
    recoverResult:async(batch,member)=>{
      const key=offscreenKey({...batch,member}),stored=deps.branchTable.get(key) as OffscreenResult|undefined
      if(!stored)return undefined
      if(stored.text)return stored.text
      const completed=deps.readCompleted(batch.branchId,stored.task)
      if(typeof completed?.result!=='string'||!completed.result.trim())return undefined
      await locked(batch.branchId,async()=>{
        await deps.branchTable.put(key,{...stored,schemaVersion:1,task:referenceOf(completed),text:completed.result as string} satisfies OffscreenResult)
      })
      return completed.result
    },
    publish:async(batch,member)=>locked(batch.branchId,async()=>{
      await synchronize(batch.branchId)
      const view=member.view as CharacterPrivateView
      if(inputBarrier(batch.branchId)||head(batch.branchId).pending.some(id=>run(id)?.status!=='completed'))
        return {status:'pending' as const,reason:'等待共享感知完成'}
      const task={...batch,member},stored=deps.branchTable.get(offscreenKey(task)) as OffscreenResult|undefined
      if(!stored?.task)throw Error('场外 Native 任务身份缺失')
      const publicationId=`${stored.task.taskId}:${stored.task.generation}:${member.characterId}`
      if(memory.generatedReceipt(scope(batch.branchId,member.characterId),publicationId))
        return {status:'published' as const,publicationId}
      if(!current(view))return {status:'stale' as const,reason:'本人人格、记忆或来源已变化'}
      if(!stored.input)return {status:'stale' as const,reason:'已生成结果缺少原消费依赖，保留结果供检查'}
      await memory.publishGenerated(scope(batch.branchId,member.characterId),view,{id:publicationId,input:stored.input,records:[{
        schemaVersion:1,id:publicationId,
        kind:'offscreen-generated',category:'state',certainty:'unconfirmed',text:stored.text,sourceKeys:[],
        materialId:view.materialId,consumedRevision:view.revision,triggerInputId:batch.inputId,
        taskId:stored.task.taskId,generation:stored.task.generation,publicationId,publicationBranchId:batch.branchId}]})
      return {status:'published' as const,publicationId}
    })})
  return {
    enabled,prepare,current,initialize,ready,
    async acceptCanonical(input:CharacterCanonicalAcceptance) {
      if(input.kind==='management')return
      const intent=head(input.branchId).inputIntents?.find(item=>item.inputId===input.inputId)
      if(!enabled(input.branchId)&&!intent)return
      if(intent)states(input.branchId).set(input.inputId,{kind:'completed',canonical:input.canonical,
        ...(input.authorMaterial===undefined?{}:{authorMaterial:input.authorMaterial})})
      await locked(input.branchId,()=>load(input.branchId))
      await recoverInputs(input.branchId)
      const id=`body:${recordSha256({branch:input.branchId,key:input.canonical.key})}`
      await register(input.branchId,id,input.inputId,input.canonical,input.authorMaterial,undefined,input.ordinal)
      void kick(input.branchId).catch(()=>{})
    },
    async acceptedInput(input:CharacterAcceptedInput) {
      await locked(input.branchId,async()=>{
        await load(input.branchId)
        if(!input.checkpoint||input.kind==='management'||!enabled(input.branchId))return
        const value=head(input.branchId)
        if(value.inputIntents?.some(intent=>intent.inputId===input.inputId))return
        const intent:CharacterInputIntent={branchId:input.branchId,inputId:input.inputId,ordinal:input.ordinal,
          checkpoint:structuredClone(input.checkpoint),...(input.completedWorkRequired?{completedWorkRequired:true}:{}),
          members:roster(input.branchId).filter(row=>row.available).map(row=>({id:row.id,identity:row.identity,
            materialId:row.materialId,sourceKeys:[...row.authorSourceKeys??row.sourceKeys],
            view:identity(memory.view(scope(input.branchId,row.id)))}))}
        // Native awaits this write before its first provider request. An open
        // input is not an accepted-body barrier for this turn's foreground cast.
        await deps.branchTable.put(headKey(input.branchId),{...value,inputIntents:[...value.inputIntents??[],intent]})
        states(input.branchId).set(input.inputId,{kind:'pending',reason:'原生输入仍在进行中'})
      })
      if(input.checkpoint)await recoverInputs(input.branchId)
      return offscreen.accepted(input)
    },
    async retryPerception(branch:string) {
      const latest=head(branch).latest,prior=latest&&run(latest)
      if(!prior)throw Error('没有可重试的感知任务')
      if(!retryable(prior))throw Error('当前感知任务不需要重新请求')
      await register(branch,`${prior.id}:retry:${randomUUID()}`,prior.inputId,prior.canonical,prior.authorMaterial,prior,prior.ordinal)
      await locked(branch,async()=>{
        const value=head(branch)
        await deps.branchTable.put(headKey(branch),{...value,pending:value.pending.filter(id=>id!==prior.id)})
      })
      await kick(branch)
    },
    beforeCast:(branch:string,ids:readonly string[])=>offscreen.cancel(branch,'前台选角抢占',ids),
    async cancel(branch:string) {controllers.get(branch)?.abort(Error('角色功能关闭或世界线离开'));await offscreen.cancel(branch,'角色功能关闭或世界线离开')},
    async list(branch:string) {
      await locked(branch,()=>load(branch))
      const latest=head(branch).latest,perception=latest?run(latest):undefined
      return {enabled:enabled(branch),...perception?{perception:{status:perception.status,
        reason:perception.reason??perception.members.find(member=>member.status==='stale')?.reason,
        retryable:retryable(perception)}}:{},characters:roster(branch).map(row=>{
        const view=memory.view(scope(branch,row.id))
        const pending=head(branch).pending.map(id=>run(id)).find(job=>job?.members.some(member=>member.id===row.id&&member.status==='pending'))
        const unresolved=inputBarrier(branch,row.id),unavailable=unresolved
          &&inputStates.get(branch)?.get(unresolved.inputId)?.kind==='unavailable'
        return {id:row.id,name:row.name,state:unresolved?unavailable?'error':'pending'
          :pending?pending.status==='failed'||pending.status==='interrupted'?'error':'pending':view.ready?'ready':'unavailable'}
      })}
    },
    async detail(branch:string,id:string,offset=0) {
      await ready(branch)
      const view=memory.view(scope(branch,id)),history=memory.history(scope(branch,id),offset,20)
      return {view:{...identity(view),persona:view.persona,ready:view.ready},history:history.entries,nextOffset:history.nextOffset}
    },
    async correct(input:{target:CharacterViewIdentity;recordId?:string;text:string;category:CharacterPrivateRecord['category'];certainty:CharacterPrivateRecord['certainty']}) {
      return locked(input.target.branchId,async()=>{
        await load(input.target.branchId)
        const currentView=memory.view(input.target)
        const id=`correction:${randomUUID()}`
        await memory.publish(input.target,input.target,{schemaVersion:1,id,kind:'user-correction',
          category:input.category,text:input.text,certainty:input.certainty,sourceKeys:[],
          materialId:currentView.materialId,consumedRevision:input.target.revision,triggerInputId:id,
          taskId:id,generation:id,publicationId:id,publicationBranchId:input.target.branchId,...input.recordId?{replaces:input.recordId}:{}})
        const receipt=memory.publicationReceipt(input.target,id)
        return {view:identity(receipt.view),recordId:id,historyOffset:Math.floor(receipt.historyIndex/20)*20}
      })
    },
    async setActive(target:CharacterViewIdentity,recordId:string,active:boolean) {
      return locked(target.branchId,async()=>{await load(target.branchId);await memory.setActive(target,target,recordId,active,randomUUID())})
    },
    /** Caller holds the parent's existing Source FIFO through prepared capture. */
    async freezeFork(branch:string,seedSourceKeys:ReadonlySet<string>,seedLength?:number):Promise<CharacterPrivateForkV1> {
      await load(branch)
      return {schemaVersion:1,parentBranchId:branch,characters:roster(branch).map(row=>({id:row.id,
        snapshot:memory.freezeFork(scope(branch,row.id),seedSourceKeys,seedLength)}))}
    },
    /** Source holds the child transaction before commit/ready. Install frozen
     * DATA only; the first later load binds it to the actual committed Source. */
    async installFork(branch:string,forkId:string,frozen:CharacterPrivateForkV1) {
      for(const row of frozen.characters) {
        await memory.installFork(scope(branch,row.id),forkId,row.snapshot)
        boundaries.delete(scopeKey(branch,row.id));sourceVersions.delete(scopeKey(branch,row.id))
      }
      loaded.delete(branch)
    },
    offscreenStatus:offscreen.status,offscreenHistory:offscreen.history,
    async recover(branch:string) {await ready(branch);await offscreen.recover(branch)},
    async dispose() {
      disposed=true
      for(const controller of controllers.values())controller.abort(Error('角色服务已释放'))
      await offscreen.dispose();await Promise.allSettled([...queues.values()]);await memory.dispose()
      loaded.clear();boundaries.clear();sourceVersions.clear();generated.clear();inputStates.clear()
    },
  }
}
