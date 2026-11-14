/** Source-owned metadata and formal lifecycle projection. Target macros and
 * execution stay with the consumer; this module never opens a prompt stage. */
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {parseTavernEntryDecoratorsV1,tavernEntryRendersInPhaseV1} from './roleplay-tavern-prompt-variables-data.js'
import type {TavernLorePlanV1,TavernLoreEntryPlanV1,TavernLoreSemanticEntryV1}
  from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreEvaluationCompositionV1} from './tavern-lore-derived.mjs'
import type {TavernPromptMacroSnapshotV1,TavernPromptTransformEntryV1,TavernPromptTransformOutputV1,TavernPromptProjectionV1}
  from './tavern-prompt-transform-types.mjs'
import type {TavernTemplateLoreBindingV1} from './tavern-template-types.mjs'

/** The compiled membership owns current order. An introduced member has no
 * immutable original; an original member keeps its actual archive address.
 * Consumers retain their existing admission/error contracts, without another
 * full-plan validation or hash of these already captured rows. */
export function createTavernSourceEntryResolverV1(source:TavernLoreSourceDataV1,plan:TavernLorePlanV1) {
  const membership=plan.currentNativeMembership,
    originals=membership?new Map(source.original.primary.entries.map(row=>[row.ref.entryPointer,row])):undefined
  return (entry:TavernLoreEntryPlanV1)=>{
    const member=membership?.members[entry.ordinal],identity=entry.currentNativeMember?.identity,
      original=member?identity?.kind==='original'?originals!.get(identity.rawEntryPointer):undefined
        :source.original.primary.entries[entry.ordinal]
    return {member,original,raw:member?.rawEntry??original?.value}
  }
}

export function createTavernSourceRenderCatalogV1(input:{readonly source:TavernLoreSourceDataV1;
  readonly plan:TavernLorePlanV1;readonly invertEnabled?:boolean}) {
  const {source,plan}=input,resolveEntry=createTavernSourceEntryResolverV1(source,plan)
  const createEntry=(entry:TavernLoreEntryPlanV1)=>{
    const joined=resolveEntry(entry),{member,original,raw}=joined
    // Preserve the render owner's existing original-entry identity join. The
    // compiler already owns current-membership integrity and content hashes.
    if(!raw||!member&&(!original||original.ref.entrySha256!==entry.rawEntrySha256))
      throw Error('INPUT_MATERIAL_RENDER_ENTRY_UNPROVEN')
    const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,
      ...entry.semanticOverrides} as TavernLoreSemanticEntryV1,
      resolved=resolveTavernLoreContentTextV1(plan,entry.sourcePointer+'/content'),
      title=typeof raw.comment==='string'?raw.comment:'',
      formal=parseTavernEntryDecoratorsV1({content:resolved.text,decorators:null,title,
        currentSemantic:{enabled:semantic.enabled}},input.invertEnabled??false),
      uid=entry.upstreamUid.origin==='explicit'?Number(entry.upstreamUid.value):Number.NaN
    return {entry,raw,original,member,resolved,semantic,uid,formal}
  }
  type Entry=ReturnType<typeof createEntry>
  const before:Entry[]=[],after:Entry[]=[],indexedBefore=new Map<number,Entry[]>(),indexedAfter=new Map<number,Entry[]>(),
    ordinaryFormalEntries:Entry[]=[],entryById=new Map<string,Entry>()
  const append=(bucket:Entry[],row:Entry)=>{
    // Source entries arrive once in order. Repeated title/decorator matches
    // for this same entry can only duplicate the current bucket's final row.
    if(bucket.at(-1)!==row)bucket.push(row)
  }
  const indexed=(buckets:Map<number,Entry[]>,ordinal:number,row:Entry)=>{
    let bucket=buckets.get(ordinal)
    if(!bucket){bucket=[];buckets.set(ordinal,bucket)}
    append(bucket,row)
  }
  const ordinal=(value:string)=>{
    if(!/^(?:0|[1-9]\d*)$/.test(value))return
    const index=Number(value)
    return Number.isSafeInteger(index)?index:undefined
  }
  const entries=plan.entries.map(entry=>{
    const row=createEntry(entry),title=typeof row.raw.comment==='string'?row.raw.comment:''
    entryById.set(entry.entryId,row)
    if(!row.formal.special&&(row.formal.bodyOffset>0||row.formal.names.length||title.includes('[Preprocessing]')))
      ordinaryFormalEntries.push(row)
    if(title.startsWith('[GENERATE:BEFORE]'))append(before,row)
    if(title.startsWith('[GENERATE:AFTER]'))append(after,row)
    const match=/^\[GENERATE:([^:\]]+):(BEFORE|AFTER)\]/.exec(title)
    if(match){
      const index=ordinal(match[1]!)
      if(index!==undefined)indexed(match[2]==='BEFORE'?indexedBefore:indexedAfter,index,row)
    }
    // Formal arguments distinguish global and indexed declarations. The fixed
    // upstream has() drops arguments and incorrectly runs indexed as global.
    for(const directive of row.formal.directives) {
      if(directive.name!=='@@generate_before'&&directive.name!=='@@generate_after')continue
      const isBefore=directive.name==='@@generate_before'
      if(directive.args==='')append(isBefore?before:after,row)
      else {
        const index=ordinal(directive.args)
        if(index!==undefined)indexed(isBefore?indexedBefore:indexedAfter,index,row)
      }
    }
    return row
  })
  const generateLoaders:{readonly before:readonly Entry[];readonly after:readonly Entry[];
    readonly indexedBefore:ReadonlyMap<number,readonly Entry[]>;readonly indexedAfter:ReadonlyMap<number,readonly Entry[]>}=
    {before,after,indexedBefore,indexedAfter}
  const world=typeof source.original.primary.value?.name==='string'?source.original.primary.value.name:
    `native-primary-${plan.bookId}`
  return {source,plan,entries,entryById,ordinaryFormalEntries,world,generateLoaders,hasFormalRenderEntries:entries.some(({formal,raw})=>
    tavernEntryRendersInPhaseV1(typeof raw.comment==='string'?raw.comment:'',formal.names,'before')
    ||tavernEntryRendersInPhaseV1(typeof raw.comment==='string'?raw.comment:'',formal.names,'after'))}
}
export type TavernSourceRenderCatalogV1=ReturnType<typeof createTavernSourceRenderCatalogV1>
export type TavernSourceRenderCatalogEntryV1=TavernSourceRenderCatalogV1['entries'][number]

/** This is lookup/render order, separate from the lore evaluator's admission
 * order. NaN UIDs deliberately fall through to the actual Source ordinal. */
export function orderTavernSourceRenderCatalogV1(catalog:TavernSourceRenderCatalogV1,authorsNoteDepth:number,
  selected:readonly TavernSourceRenderCatalogEntryV1[]=catalog.entries) {
  const top=Math.max(0,...selected.filter(row=>row.semantic.position==='at-chat-depth')
    .map(row=>row.semantic.depth))
  const offsets:Partial<Record<TavernLoreSemanticEntryV1['position'],number>>=
    {'before-character':4,'after-character':3,'before-examples':2,'after-examples':1}
  return selected.map(row=>{
    const semantic=row.semantic,offset=offsets[semantic.position],
      effectiveDepth=semantic.position==='before-authors-note'||semantic.position==='after-authors-note'
        ?authorsNoteDepth+semantic.depth:offset===undefined?semantic.depth:top+offset
    return {...row,effectiveDepth}
  }).sort((a,b)=>b.effectiveDepth-a.effectiveDepth||a.semantic.order-b.semantic.order
    ||b.uid-a.uid||a.entry.ordinal-b.entry.ordinal)
}

/** The source regex pass can read target macros even in regex-only mode.
 * Capture and reuse belong to that macro cut's existing owner, not a Source
 * hash cache. The callback retains its transform ledger and await checks. */
export async function projectTavernSourceRenderEntriesV1(input:{readonly catalog:TavernSourceRenderCatalogV1;
  readonly entries:readonly TavernSourceRenderCatalogEntryV1[];readonly macros:TavernPromptMacroSnapshotV1;
  transform(entries:readonly TavernPromptTransformEntryV1[],macros:TavernPromptMacroSnapshotV1)
    :Promise<TavernPromptTransformOutputV1>}):Promise<ReadonlyMap<string,TavernPromptProjectionV1>> {
  const {source,plan}=input.catalog,
    output=await input.transform(input.entries.map(({entry,resolved,formal})=>({
      key:entry.entryId,bookId:entry.sourcePointer.startsWith('derived:')?null:plan.bookId,entryId:entry.entryId,
      sourcePointer:resolved.pointer,sourceSnapshotSha256:source.sourceSha256,
      rawText:formal.body,storyText:'',inputText:formal.body,pipeline:'regex-only',channel:'source',placement:5,
      depth:null,isEdit:false,characterOverride:null,required:false})),input.macros)
  return new Map(output.entries.map(projection=>[projection.entryId!,projection]))
}
export async function projectTavernSourceRenderLoreV1(input:{readonly catalog:TavernSourceRenderCatalogV1;
  readonly authorsNoteDepth:number;readonly macros:TavernPromptMacroSnapshotV1;
  readonly evaluationComposition?:TavernLoreEvaluationCompositionV1;
  transform(entries:readonly TavernPromptTransformEntryV1[],macros:TavernPromptMacroSnapshotV1)
    :Promise<TavernPromptTransformOutputV1>}) :Promise<{readonly lore:readonly TavernTemplateLoreBindingV1[];
      readonly byEntryId:ReadonlyMap<string,TavernPromptProjectionV1>}> {
  const {catalog}=input,{source,plan}=catalog,
    ordered=orderTavernSourceRenderCatalogV1(catalog,input.authorsNoteDepth),
    projections=await projectTavernSourceRenderEntriesV1({catalog,entries:ordered,macros:input.macros,transform:input.transform}),
    overrides=input.evaluationComposition?.ref?new Map(input.evaluationComposition.entries
      .flatMap(entry=>'semantic' in entry?[[entry.entryId,entry.semantic] as const]:[])):undefined
  const lore=ordered.map(({entry,raw,semantic,uid})=>{
    const projection=projections.get(entry.entryId)!
    return {key:entry.entryId,bookId:plan.bookId,entryId:entry.entryId,sourcePointer:projection.sourcePointer,
      sourceSnapshotSha256:source.sourceSha256,content:projection.outputText,contentSha256:projection.outputSha256,
      activationAllowed:(overrides?.get(entry.entryId)??semantic).enabled&&entry.disposition==='eligible-semantic-data',
      lookup:{world:catalog.world,title:typeof raw.comment==='string'?raw.comment:'',
        uid:Number.isSafeInteger(uid)&&uid>=0?uid:null},
      ...projection.deferredDiagnostics.length?{readDiagnostic:{code:projection.deferredDiagnostics[0]!.code,
        projectionSha256:projection.projectionSha256}}:{}}
  })
  return {lore,byEntryId:projections}
}
