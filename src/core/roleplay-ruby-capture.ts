/** One Source/history read for Ruby. Explicit lookups retain raw book order,
 * disabled entries and current author content; no evaluator activates them. */
import type {Session,SessionMessageProjection} from 'dsh-nexttavern-native-session'
import {recordSha256} from './roleplay-data.js'
import {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'
import {captureReadonlyAuthorDialogChatClockV1} from './roleplay-tavern-chat-clock.js'
import {produceRoleplayTavernMacroSnapshotV1} from './roleplay-tavern-prompt-macros.js'
import {applyTavernPromptTransformsV1} from './tavern-prompt-transform.mjs'
import {readRubyConfigurationV1,RUBY_BUILTIN_REFERENCES_V1} from './roleplay-ruby-config.js'
import {findRubyEntryV1} from './roleplay-ruby-input.js'
import {createTavernSourceEntryResolverV1} from './tavern-source-render-catalog.mjs'
import {namedWorldbookKeyToWireV1} from './tavern-named-worldbook-data.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import type {RubyConfigurationV1,RubyIssueV1,RubySelectedMessageV1,RubyTaskV1,RubyWorldbookEntryV1,
  RubyWorldbookV1} from './roleplay-ruby-types.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {createRoleplayAuthorWorldbookCoreV1} from './roleplay-author-worldbook-core.js'
import type {AuthorWorldbookCaptureV1} from './roleplay-author-worldbook-types.js'

type SourceDependencies=Parameters<typeof captureRoleplayTavernPromptSourceDataV1>[0]
export interface RubySourceCaptureV1 {
  readonly session:Session
  readonly configuration:RubyConfigurationV1
  readonly sourceIdentitySha256:string
  readonly actualCharName:string
  readonly messages:readonly RubySelectedMessageV1[]
  readonly characterBook:RubyWorldbookV1
  resolveInputBooks(task:RubyTaskV1,chatBook:RubyWorldbookV1):Promise<
    {readonly kind:'resolved';readonly characterBook:RubyWorldbookV1;readonly chatBook:RubyWorldbookV1}
    |{readonly kind:'unsupported';readonly issues:readonly RubyIssueV1[]}>
  assertCurrent():void
  current():boolean
  release():void
}
export interface RubyReadableEntryV1 extends RubyWorldbookEntryV1 {
  readonly uid:string|number
  readonly comment:string
  readonly disabled:boolean
  readonly constant:boolean
}
export interface RubySourceReadCaptureV1 extends RubySourceCaptureV1 {
  readonly primaryName:string|null
  readonly records:readonly RubyReadableEntryV1[]
  readBook(name:string):Promise<{readonly name:string;
    readonly book:Pick<AuthorWorldbookCaptureV1,'address'|'content'|'metadata'|'name'>;
    readonly records:readonly RubyReadableEntryV1[]}|undefined>
  resolveEntryContent(entries:readonly RubyWorldbookEntryV1[]):Promise<readonly string[]>
}
interface Dependencies extends SourceDependencies {
  readonly worldbooks?:Pick<ReturnType<typeof createRoleplayAuthorWorldbookCoreV1>,'capture'|'read'>
  readonly edits:SourceDependencies['edits']&Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,
    'observeAuthorMetadataData'>
  readonly inputState:RoleplayInputStateOwner
  session(id:string):Session|undefined
  projections():readonly SessionMessageProjection[]
  includeCardStyle(id:string):boolean
  withSourceLock<T>(id:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
}
export function createRoleplayRubyCaptureV1(deps:Dependencies) {
  function configurationSummary(id:string) {
    return deps.inputState.captureObservation(id,()=>{
      const original=deps.source.capture(id)
      if(original.kind!=='captured-data')return {configurationStatus:'uninitialized' as const,configurationIssues:[]}
      const metadata=deps.edits.observeAuthorMetadataData(original)
      if(metadata.kind!=='captured-data')throw Error(metadata.diagnostics[0]?.code??'RUBY_SOURCE_UNAVAILABLE')
      const raw=metadata.data.extensions?.RubyAnalyzer,
        configuration=readRubyConfigurationV1(raw,{ownerId:id,sourcePath:'/data/extensions/RubyAnalyzer',
          version:recordSha256(raw??null)})
      return {configurationStatus:configuration.status,configurationIssues:configuration.issues,
        summaryProvider:configuration.summaryProvider,summaryProviderStatus:configuration.summaryProviderStatus,
        generation:configuration.generation??null,
        tasks:configuration.tasks.map(task=>({taskKey:task.taskKey,name:task.displayName,enabled:task.enabled,
          cyclePositions:task.cyclePositions,useReferences:task.useReferences,useOutputs:task.useOutputs}))}
    },'ruby-configuration-summary').data
  }
  function capture(id:string,signal:AbortSignal,options:{readOnly:true}):Promise<RubySourceReadCaptureV1|undefined>
  function capture(id:string,signal:AbortSignal,options?:{includeEmpty:true}):Promise<RubySourceCaptureV1|undefined>
  async function capture(id:string,signal:AbortSignal,options?:{readOnly?:true;includeEmpty?:true})
    :Promise<RubySourceReadCaptureV1|undefined> {
    const session=deps.session(id)
    if(!session)throw Error('RUBY_SESSION_UNAVAILABLE')
    const assertOwnerFactsCurrent=()=>{
      signal.throwIfAborted()
      if(deps.session(id)!==session)throw Error('RUBY_SESSION_CHANGED')
    }
    const read=await deps.withSourceLock(id,async()=>deps.inputState.captureRuby({session,signal,
      assertOwnerFactsCurrent},'source',()=>{
      const original=deps.source.capture(id)
      if(original.kind==='outside-declared-domain')return undefined
      if(original.kind!=='captured-data')throw Error(original.diagnostics[0]?.code??'RUBY_SOURCE_UNAVAILABLE')
      const metadata=deps.edits.observeAuthorMetadataData(original)
      if(metadata.kind!=='captured-data')throw Error(metadata.diagnostics[0]?.code??'RUBY_SOURCE_UNAVAILABLE')
      const raw=metadata.data.extensions?.RubyAnalyzer,
        configuration=readRubyConfigurationV1(raw,{ownerId:id,sourcePath:'/data/extensions/RubyAnalyzer',
          version:recordSha256(raw??null)})
      if(configuration.status==='empty'&&!options?.readOnly&&!options?.includeEmpty)return undefined
      // The synchronous Source supplier is already captured. Consumers reuse
      // it rather than rebuilding a book merely to discover no Ruby producer.
      const includeCardStyle=deps.includeCardStyle(id),captured=captureRoleplayTavernPromptSourceDataV1({
        source:{capture:()=>original},edits:deps.edits,books:deps.books},id,includeCardStyle)
      if(captured.kind==='outside-declared-domain')return undefined
      const {source,compilation,cardData}=captured,context=source.current.openingContext.context,
        actualCharName=context.char??'',clock=options?.readOnly?undefined:captureReadonlyAuthorDialogChatClockV1({session,
          projections:deps.projections(),assertOwnerCurrent:assertOwnerFactsCurrent}),
        messages:RubySelectedMessageV1[]=clock?.data.rows.map((row,index)=>({
          ref:{ownerId:id,sourcePath:`native/messages/${row.id}`,version:row.messageSha256},
          seq:row.seq!,messageId:row.id,messageVersion:row.messageSha256,role:row.role,
          speakerName:row.role==='user'?context.user??'':actualCharName,text:clock.scanRows[index]!.text}))??[],
        bookContext=captured.bookContext,primary=bookContext?.primary,
        resolveEntry=createTavernSourceEntryResolverV1(source,compilation.plan),
        bookRecords=new Map<string,readonly RubyReadableEntryV1[]>()
      const recordsFor=(actual?:AuthorWorldbookCaptureV1):readonly RubyReadableEntryV1[]=>{
        const key=actual?.address.bookId??compilation.plan.bookId,previous=bookRecords.get(key)
        if(previous)return previous
        const selected=compilation.plan.boundBooks?compilation.plan.entries.filter(entry=>entry.bookId===actual?.address.bookId)
            :compilation.plan.entries,
          records=selected.map(planEntry=>{
            // The shared resolver joins local book ordinals to their captured
            // owner. Collection ordinals never index a single membership array.
            const {member,raw}=resolveEntry(planEntry),rawEntry=raw!,
              content=planEntry.semanticOverrides.content,
              text=content?.currentNative?.text??(typeof rawEntry.content==='string'?rawEntry.content:''),
              rawKeys=Array.isArray(rawEntry.keys)?rawEntry.keys.filter((key):key is string=>typeof key==='string'):[],
              keys=planEntry.semanticOverrides.primaryKeys??(member?rawKeys.map(namedWorldbookKeyToWireV1):rawKeys),
              enabled=planEntry.semanticOverrides.enabled??(member?!!rawEntry.enabled:planEntry.disposition!=='disabled')
            return {ref:{ownerId:actual?.address.profileId??source.sourceRecordSessionId,sourcePath:planEntry.sourcePointer,
              version:planEntry.entryPlanSha256},keys,resolvedContent:text,
              uid:member?.uid??planEntry.upstreamUid.value??planEntry.ordinal,
              comment:typeof rawEntry.comment==='string'?rawEntry.comment
                :typeof rawEntry.name==='string'?rawEntry.name:'',
              disabled:!enabled,constant:planEntry.semanticOverrides.constant??!!rawEntry.constant}
          })
        bookRecords.set(key,records)
        return records
      }
      const entries=bookContext&&!primary?[]:recordsFor(primary),
        characterBinding=bookContext?.bindings.find(binding=>binding.owner.kind==='character'),
        primaryPlan=primary?compilation.plan.boundBooks?.find(book=>book.plan.bookId===primary.address.bookId)?.plan:undefined,
        book:RubyWorldbookV1={ref:{ownerId:primary?.address.profileId??id,
          sourcePath:primary?primaryPlan!.source.bookPointer:bookContext
            ?characterBinding?.head?.key??bookContext.registrationRef.key:source.original.primary.bookPointer,
          version:primary?recordSha256({content:primary.content,metadata:primary.metadata}):compilation.plan.planSha256},entries},
        declaredOutlets=compilation.plan.entries.flatMap(entry=>entry.semanticOverrides.outletName?[entry.semanticOverrides.outletName]:[])
      // Identity covers the actual rule/config and explicit lookup content.
      // Session-local Source references remain separate, permitting a fork to
      // inherit accepted output without rewriting the immutable original.
      const sourceIdentitySha256=recordSha256({configuration:raw??null,entries:entries.map(entry=>({
        keys:entry.keys,text:entry.resolvedContent})),context})
      return {configuration,actualCharName,messages,book,records:entries,bookContext,recordsFor,
        primaryName:bookContext?primary?.name??null:
          typeof source.original.primary.value?.name==='string'?source.original.primary.value.name:null,
        macroInput:{source,cardData,includeCardStyle,inputText:null,scopes:[],outlets:[],declaredOutlets},
        sourceIdentitySha256,
        sourceSnapshotSha256:source.sourceSha256}
    }),signal)
    if(!read.data){read.release();return undefined}
    try {
      const data=read.data
      let worldbookRead:ReturnType<NonNullable<Dependencies['worldbooks']>['capture']>|undefined
      const readBook:RubySourceReadCaptureV1['readBook']=async name=>{
        read.assertCurrent()
        const bound=data.bookContext?.books.find(book=>book.name===name)
        if(bound)return {name:bound.name,book:bound,records:data.recordsFor(bound)}
        if(!deps.worldbooks)return undefined
        const actual=await (worldbookRead??=deps.worldbooks.capture(id))
        read.assertCurrent();actual.assertCurrent()
        if(actual.data.sourceSha256!==data.sourceSnapshotSha256)throw Error('RUBY_SOURCE_CHANGED')
        if(!actual.data.names.includes(name))return undefined
        const current=()=>read.current()&&actual.current(),
          book=await deps.worldbooks.read(id,name,actual.data,current,signal)
        read.assertCurrent();actual.assertCurrent()
        return {name:book.name,book,records:readCatalogRubyEntries(book)}
      }
      const makeMacros=()=>({...produceRoleplayTavernMacroSnapshotV1(data.macroInput).snapshot,
        preserveUnknownMacros:true})
      async function transformEntries(selectedEntries:readonly RubyWorldbookEntryV1[],macros:ReturnType<typeof makeMacros>,
        sourcePath:string) {
        const transformed=await applyTavernPromptTransformsV1({schemaVersion:1,
          encoding:'owned-tavern-prompt-transform-v1',authority:'consumer-data-only',
          sourceSnapshotSha256:data.sourceSnapshotSha256,regexDisabled:true,macros,rules:[],
          entries:selectedEntries.map((entry,index)=>({key:`ruby-explicit-${index}`,bookId:null,entryId:null,
            sourcePointer:entry.ref.sourcePath,sourceSnapshotSha256:data.sourceSnapshotSha256,
            rawText:entry.resolvedContent,storyText:entry.resolvedContent,inputText:entry.resolvedContent,
            pipeline:'macro-only',channel:'prompt',placement:3,depth:null,isEdit:false,characterOverride:null,required:true}))},
          {assertCurrent:read.assertCurrent,signal})
        if(transformed.kind==='transformed')return {kind:'transformed' as const,
          texts:transformed.output.entries.map(entry=>entry.outputText)}
        if(transformed.kind==='refused')return {kind:'unsupported' as const,
          issues:transformed.diagnostics.map(diagnostic=>({code:diagnostic.code,
            sourcePath:selectedEntries.find((_entry,index)=>diagnostic.entryKey===`ruby-explicit-${index}`)
              ?.ref.sourcePath??sourcePath}))}
        signal.throwIfAborted()
        throw Error(transformed.diagnostics[0]?.code??'PROMPT_TRANSFORM_CANCELLED')
      }
      const resolveEntryContent:RubySourceReadCaptureV1['resolveEntryContent']=async entries=>{
        if(!entries.length)return []
        const result=await transformEntries(entries,makeMacros(),'/ruby/read')
        if(result.kind==='unsupported')throw Error(result.issues[0]?.code??'RUBY_READ_MACROS_UNAVAILABLE')
        return result.texts
      }
      const resolveInputBooks:RubySourceCaptureV1['resolveInputBooks']=async(task,chatBook)=>{
        const references=new Map(data.configuration.referencePool.map(reference=>[reference.varName,reference])),
          outputs=new Map(data.configuration.tasks.filter(output=>output.outputKey)
            .map(output=>[output.outputVarName,output])),
          referenceKeys=task.useReferences.flatMap(name=>{
            const reference=references.get(name)??RUBY_BUILTIN_REFERENCES_V1.find(reference=>reference.varName===name)
            return reference?[reference.entryKey]:[]
          }),outputKeys=task.useOutputs.flatMap(name=>{
            const output=outputs.get(name)
            return output?[output.outputKey]:[]
          }),lookups=[{key:task.promptKey,books:[data.book,chatBook] as const},
            ...[...referenceKeys,...outputKeys].map(key=>({key,books:[chatBook,data.book] as const}))],
          resolved=new Map<RubyWorldbookEntryV1,string>()
        let pending=lookups,macros:ReturnType<typeof makeMacros>|undefined
        for(const priority of [0,1] as const) {
          const selectedEntries=[...new Set(pending.flatMap(lookup=>{
            const entry=findRubyEntryV1(lookup.books[priority],lookup.key)
            return entry&&!resolved.has(entry)?[entry]:[]
          }))]
          if(selectedEntries.length) {
            // Eligibility is settled before this method. Only real winning
            // lookups enter the Worker; empty projections unlock the next book.
            const transformed=await transformEntries(selectedEntries,macros??=makeMacros(),task.sourcePath)
            if(transformed.kind==='unsupported')return transformed
            selectedEntries.forEach((entry,index)=>resolved.set(entry,transformed.texts[index]!))
          }
          pending=pending.filter(lookup=>{
            const entry=findRubyEntryV1(lookup.books[priority],lookup.key)
            return !entry||!resolved.get(entry)!.trim()
          })
        }
        const projected=(book:RubyWorldbookV1):RubyWorldbookV1=>({...book,entries:book.entries.map(entry=>
          resolved.has(entry)?{...entry,resolvedContent:resolved.get(entry)!}:entry)})
        return {kind:'resolved',characterBook:projected(data.book),chatBook:projected(chatBook)}
      }
      return {session,configuration:data.configuration,sourceIdentitySha256:data.sourceIdentitySha256,
        actualCharName:data.actualCharName,messages:data.messages,characterBook:data.book,resolveInputBooks,
        primaryName:data.primaryName,records:data.records,readBook,resolveEntryContent,
        assertCurrent:read.assertCurrent,current:read.current,release:read.release}
    }catch(error){read.release();throw error}
  }
  return {capture,configurationSummary}
}

/** Explicit console lookups consume raw member fields without requiring the
 * full Helper DTO's position controls. Unselected content stays inert. */
function readCatalogRubyEntries(book:AuthorWorldbookCaptureV1):readonly RubyReadableEntryV1[] {
  const pointer='/books/'+book.address.bookId.replaceAll('~','~0').replaceAll('/','~1'),
    version=recordSha256({content:book.content,metadata:book.metadata})
  return book.membership.members.map((member,index)=>({member,index}))
    .sort((a,b)=>a.member.displayIndex-b.member.displayIndex).map(({member,index})=>{
      const raw=member.rawEntry
      return {ref:{ownerId:book.address.profileId,sourcePath:`${pointer}/members/${index}/rawEntry`,
        version:recordSha256({version,identity:member.identity})},uid:member.uid,
        keys:Array.isArray(raw.keys)?raw.keys.filter((key):key is string=>typeof key==='string').map(namedWorldbookKeyToWireV1):[],
        comment:typeof raw.comment==='string'?raw.comment:typeof raw.name==='string'?raw.name:'',
        resolvedContent:typeof raw.content==='string'?raw.content:'',disabled:!raw.enabled,constant:!!raw.constant}
    })
}
