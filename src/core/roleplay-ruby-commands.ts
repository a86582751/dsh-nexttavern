/** Finite Ruby commands coordinate existing Source and task owners. Reads do
 * not schedule work, and preset selection never creates a second config store. */
import type {AuthorNativeRubyCommand} from './author-native-commands.js'
import type {AuthorNativeRubyCommandOutcomeV1} from './roleplay-author-commands.js'
import type {RubyReadableEntryV1,RubySourceReadCaptureV1} from './roleplay-ruby-capture.js'
import type {createRoleplayRubyOwnerV1} from './roleplay-ruby-owner.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {TavernLoreEditsDepsV1,TavernLorePublicationObserverV1,TavernLoreEditRefusalV1,
  TavernAuthorMetadataRetryResultV1,TavernAuthorMetadataDataV1} from './roleplay-tavern-lore-edits-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'

export interface RubyCommandControlsV1 {
  assertCurrent():void
  writeCurrent():boolean
  published(source:TavernLoreSourceDataV1):Promise<void>|void
  readonly observePublication?:TavernLorePublicationObserverV1
}
export interface RoleplayRubyCommandsDependenciesV1 {
  readonly source:Pick<TavernLoreEditsDepsV1['source'],'capture'>
  readonly edits:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,
    'observeAuthorMetadataData'|'mutateAuthorMetadata'|'retryAuthorMetadata'>
  capture(sid:string,signal:AbortSignal):Promise<RubySourceReadCaptureV1|undefined>
  readonly ruby:Pick<ReturnType<typeof createRoleplayRubyOwnerV1>,'run'|'confirmRun'|'rearm'|'status'>&{
    readEntries(sid:string,capture:Pick<RubySourceReadCaptureV1,'sourceIdentitySha256'|'configuration'|'assertCurrent'>)
      :readonly RubyReadableEntryV1[]
  }
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
}
type Outcome=AuthorNativeRubyCommandOutcomeV1
const object=(value:unknown):Readonly<Record<string,unknown>>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,unknown>>:{}
const codeOf=(error:unknown)=>error instanceof Error?error.message:String(error)
function sourceRefusal(value:TavernLoreEditRefusalV1):Outcome {
  const code=value.diagnostics[0]?.code??'RUBY_SOURCE_UNAVAILABLE'
  return {kind:code==='WRITE_UNKNOWN'||code==='PENDING_INTENT'?'unknown':'refused',code}
}
function lookupKeys(entry:RubyReadableEntryV1):string[] {
  return entry.keys.flatMap(raw=>{
    const key=raw.trim()
    return !key?[]:key.includes(',')?[key,...key.split(',').map(part=>part.trim()).filter(Boolean)]:[key]
  })
}
function selectEntries(entries:readonly RubyReadableEntryV1[],key:string,all:boolean) {
  const exact:{entry:RubyReadableEntryV1;keys:string[]}[]=[],fuzzy:typeof exact=[]
  for(const entry of entries) {
    const keys=lookupKeys(entry)
    if(!key) {
      if(!keys.length)continue
      if(!all)return [{entry,keys}]
      fuzzy.push({entry,keys})
    }else if(keys.includes(key)) {
      if(!all)return [{entry,keys}]
      exact.push({entry,keys})
    }else if((all||!fuzzy.length)&&keys.some(candidate=>candidate.includes(key)))fuzzy.push({entry,keys})
  }
  if(!all)return fuzzy.length?[fuzzy[0]!]:[]
  const exactIds=new Set(exact.map(row=>row.entry.uid))
  return [...exact,...fuzzy.filter(row=>!exactIds.has(row.entry.uid))]
}

export function createRoleplayRubyCommandsV1(deps:RoleplayRubyCommandsDependenciesV1) {
  async function read(sid:string,command:Extract<AuthorNativeRubyCommand,{kind:'ruby-read'}>,
    signal:AbortSignal,controls:RubyCommandControlsV1):Promise<Outcome> {
    const capture=await deps.capture(sid,signal)
    if(!capture) {
      signal.throwIfAborted();controls.assertCurrent()
      return {kind:'executed',pipe:command.json?'[]':command.key?`entry not found: ${command.key}`:'no worldbook entries'}
    }
    try {
      signal.throwIfAborted();controls.assertCurrent();capture.assertCurrent()
      const wanted=command.key.trim(),book=command.book.trim()||'chat',channel=book.toLowerCase(),
        chat=channel==='chat',character=channel==='char'||book===capture.primaryName,
        named=chat||character?undefined:await capture.readBook(book),
        entries=chat?deps.ruby.readEntries(sid,capture):character?capture.records:named?.records??[],
        selected=selectEntries(entries,wanted,command.all)
      if(!selected.length)return {kind:'executed',pipe:command.json?'[]':wanted?`entry not found: ${wanted}`:'no worldbook entries'}
      const content=command.raw?selected.map(row=>row.entry.resolvedContent)
        :await capture.resolveEntryContent(selected.map(row=>row.entry))
      signal.throwIfAborted();controls.assertCurrent();capture.assertCurrent()
      const records=selected.map(({entry,keys},index)=>({uid:entry.uid,book:chat?'chat':named?.name??capture.primaryName??'char',
        keys,comment:entry.comment,content:content[index]!,disabled:entry.disabled,constant:entry.constant}))
      return {kind:'executed',pipe:command.json?JSON.stringify(command.all?records:records[0])
        :records.map(record=>record.content.trim()).filter(Boolean).join('\n\n---\n\n')||'(empty content)'}
    }finally{capture.release()}
  }
  async function run(sid:string,origin:string,operationId:string,
    command:Extract<AuthorNativeRubyCommand,{kind:'ruby-run'}>,signal:AbortSignal,
    controls:RubyCommandControlsV1):Promise<Outcome> {
    try {
      const outcome=await deps.ruby.run(sid,{operationId,origin,kind:command.selection,taskSpecs:command.taskSpecs},
        signal,()=>!signal.aborted&&controls.writeCurrent())
      return {kind:outcome.kind==='completed'?'executed':'unknown',receipt:outcome.receipt,
        pipe:command.json?JSON.stringify(outcome.result):outcome.result.summary,
        ...(outcome.kind==='unknown'?{code:'RUBY_MANUAL_RUN_UNKNOWN'}:{})}
    }catch(error) {
      // Only an exceptional completion consults the existing accepted fact.
      // It neither reschedules a task nor turns Stop into a new execution ACK.
      const known=deps.ruby.confirmRun(sid,operationId)
      return {kind:known?'unknown':'refused',code:codeOf(error),...(known?{receipt:known.receipt,
        pipe:command.json?JSON.stringify(known.result):known.result.summary}:{})}
    }
  }
  async function preset(sid:string,operationId:string,selector:string,signal:AbortSignal,
    controls:RubyCommandControlsV1):Promise<Outcome> {
    const prepared=await deps.withSourceLock(sid,async()=>{
      signal.throwIfAborted();controls.assertCurrent()
      const captured=deps.source.capture(sid)
      if(captured.kind!=='captured-data')return {kind:'outcome' as const,outcome:{kind:'refused' as const,
        code:captured.kind==='refused'?captured.diagnostics[0]?.code??'RUBY_SOURCE_UNAVAILABLE':captured.code}}
      const observed=deps.edits.observeAuthorMetadataData(captured,selector.trim()?operationId:undefined)
      if(observed.kind==='refused') {
        const diagnostic=observed.diagnostics[0]
        if(diagnostic?.code==='PENDING_INTENT'&&diagnostic.pending?.operationId===operationId)
          return {kind:'retry' as const,eventRef:diagnostic.pending.eventRef}
        return {kind:'outcome' as const,outcome:sourceRefusal(observed)}
      }
      if(observed.operation)return {kind:'outcome' as const,outcome:{kind:'executed' as const,
        receipt:observed.operation,pipe:'preset publication confirmed'}}
      const raw=object(observed.data.extensions?.RubyAnalyzer),
        presets=(Array.isArray(raw.presets)?raw.presets:[]).map(object)
      if(!presets.length)return {kind:'outcome' as const,outcome:{kind:'executed' as const,pipe:'no presets configured'}}
      const title=(value:Readonly<Record<string,unknown>>)=>String(value.name||value.id),wanted=selector.trim()
      if(!wanted)return {kind:'outcome' as const,outcome:{kind:'executed' as const,
        pipe:'presets: '+presets.map(row=>`${title(row)}${row.id===raw.activePresetId?' [active]':''}`).join(' | ')}}
      const target=presets.find(row=>row.id===wanted)||presets.find(row=>String(row.name||'')===wanted)
        ||presets.find(row=>String(row.name||'').includes(wanted)||String(row.id).includes(wanted))
      if(!target)return {kind:'outcome' as const,outcome:{kind:'executed' as const,
        pipe:`preset not found: ${wanted} (available: ${presets.map(title).join(', ')})`}}
      if(target.id===raw.activePresetId)return {kind:'active' as const,title:title(target)}
      if(typeof target.id!=='string'&&typeof target.id!=='number')return {kind:'outcome' as const,
        outcome:{kind:'refused' as const,code:'RUBY_PRESET_ID_UNAVAILABLE'}}
      return {kind:'change' as const,title:title(target),source:observed.data.source,revision:observed.data.revision,
        id:target.id,tasks:Array.isArray(target.tasks)?target.tasks:[]}
    },signal)
    if(prepared.kind==='outcome')return prepared.outcome
    if(prepared.kind==='active') {
      await deps.ruby.rearm(sid,signal,controls.writeCurrent)
      return {kind:'executed',pipe:`preset already active: ${prepared.title} (engine re-armed)`}
    }
    // The Source writer takes the same FIFO itself. Do not nest its lock inside
    // the short read above; its captured source/revision are the actual CAS.
    const result:TavernAuthorMetadataRetryResultV1&{readonly data?:TavernAuthorMetadataDataV1}=prepared.kind==='retry'
      ?await deps.edits.retryAuthorMetadata(sid,operationId,controls.writeCurrent,{eventRef:prepared.eventRef})
      :await deps.edits.mutateAuthorMetadata({schemaVersion:1,encoding:'tavern-author-metadata-mutation-request-v1',
        sessionId:sid,operationId,expectedSourceSha256:prepared.source.sourceSha256,expectedRevision:prepared.revision,
        mutation:{kind:'extension-fields',extension:'RubyAnalyzer',set:{activePresetId:prepared.id}}},
      controls.writeCurrent,controls.observePublication)
    if(result.kind!=='edited-data')return sourceRefusal(result)
    const data=result.data
    if(data===undefined)return {kind:'executed',receipt:result.receipt,pipe:'preset publication confirmed'}
    const saved=prepared.kind==='change'?`preset switched: ${prepared.title} | tasks: ${prepared.tasks
      .filter(task=>object(task).enabled).length}/${prepared.tasks.length} enabled`:'preset publication confirmed'
    try {
      // Publication is durable before adoption/rearming. A stopped owner cannot
      // revoke its receipt or authorize another command using an old Source.
      await controls.published(data.source)
      await deps.ruby.rearm(sid,signal,controls.writeCurrent)
      return {kind:'executed',receipt:result.receipt,sourceDataPublished:true,pipe:`${saved} | engine re-armed`}
    }catch(error) {
      return {kind:'unknown',receipt:result.receipt,sourceDataPublished:true,code:codeOf(error),
        pipe:`${saved} | engine re-arm pending`}
    }
  }
  async function execute(sid:string,origin:string,operationId:string,command:AuthorNativeRubyCommand,
    signal:AbortSignal,controls:RubyCommandControlsV1):Promise<Outcome> {
    try {
      signal.throwIfAborted();controls.assertCurrent()
      if(command.kind==='ruby-read')return await read(sid,command,signal,controls)
      if(command.kind==='ruby-run')return await run(sid,origin,operationId,command,signal,controls)
      if(command.kind==='ruby-preset')return await preset(sid,operationId,command.selector,signal,controls)
      if(command.kind==='ruby-panel')return {kind:'executed',pipe:'panel opened'}
      if(command.kind==='ruby-reload') {
        await deps.ruby.rearm(sid,signal,controls.writeCurrent)
        signal.throwIfAborted();controls.assertCurrent()
        return {kind:'executed',pipe:'engine reloaded'}
      }
      const status=deps.ruby.status(sid,{offset:0,limit:1}),latest=status.runs.at(-1)
      const lastRun=latest?`${latest.taskName} (${latest.status})${latest.reason?': '+latest.reason:''}`:'never'
      return {kind:'executed',pipe:[`enabled: ${status.enabled}`,`running: ${status.busy}`,
        `configuration: ${status.configurationStatus}`,`cycleBaseline: ${status.cycleBaseline??'not configured'}`,
        `lastRun: ${lastRun}`].join(' | ')}
    }catch(error){return {kind:'refused',code:codeOf(error)}}
  }
  return {execute}
}
