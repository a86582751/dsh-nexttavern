/** Current authoring DATA for Markdown export. Source/journal owners establish
 * bindings once; this projection never executes macros/EJS or mutates rows. */
import {recordSha256} from './roleplay-data.js'
import {stableJson} from './card-export-projection.js'
import {resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import type {ExportMaterial} from './card-export-projection.js'
import type {TavernLoreSourceCaptureV1} from './roleplay-tavern-lore-source-types.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'

export type TavernLoreExportReadV1=
  | {readonly kind:'none'}
  | {readonly kind:'blocked';readonly code:string}
  | {readonly kind:'ready';readonly sessionId:string;readonly sourceSha256:string;
      readonly currentLoreSha256:string;readonly materials:ExportMaterial[];
      readonly skipWorldbookKeys:readonly string[];readonly skipRulesCore:boolean}

interface Dependencies {
  readonly source:{capture(sessionId:string):TavernLoreSourceCaptureV1}
  readonly edits:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,
    'observeSourceDataWithLegacyData'|'observeJournalDataWithLegacyData'>
  readonly books?:Pick<import('./roleplay-author-source-context.js').RoleplayAuthorContextV1,'captureCompilation'>
}

export function captureRoleplayTavernLoreExportDataV1(deps:Dependencies,sessionId:string):TavernLoreExportReadV1 {
  const captured=deps.source.capture(sessionId)
  if(captured.kind==='outside-declared-domain') {
    // The legacy semantic export still consumes actual current author rows.
    // An unprojectable merge supplies no single-book overlay; it is not a
    // corrupt Source and must not disable that existing export workflow.
    return ['ACTIVE_SOURCE_MISSING','LEGACY_SOURCE_OUTSIDE_DOMAIN','MERGE_PROVENANCE_UNPROVEN'].includes(captured.code)
      ?{kind:'none'}:{kind:'blocked',code:captured.code}
  }
  if(captured.kind==='refused')return {kind:'blocked',code:captured.diagnostics[0]?.code??'SOURCE_READ_FAILED'}
  const bookCapture=deps.books?.captureCompilation(captured.source),
    journalPacket=bookCapture?deps.edits.observeJournalDataWithLegacyData(captured):undefined,
    editorPacket=bookCapture?undefined:deps.edits.observeSourceDataWithLegacyData(captured),
    {observed,legacy}=journalPacket??editorPacket!
  if(observed.kind==='refused')return {kind:'blocked',code:observed.diagnostics[0]?.code??'STORAGE_READ_FAILED'}
  // A successful observation and its legacy bindings are one supplier result.
  const bindings=legacy!,source=captured.source,{data}=observed,
    editor=editorPacket?.observed.kind==='captured-data'?editorPacket.observed.editor:undefined,
    compilation=bookCapture?.compilation,
    bookSources=new Map(compilation?.plan.boundBooks?.map(book=>[book.plan.bookId,book.plan.source])??[]),
    entries=compilation?compilation.plan.entries.map(entry=>({entryId:entry.entryId,
      rawEntryPointer:entry.sourcePointer,rawEntrySha256:entry.rawEntrySha256,disposition:entry.disposition,
      semantic:{...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1,
      contentText:resolveTavernLoreContentTextV1(compilation.plan,entry.sourcePointer+'/content').text,
      fieldSources:entry.fieldSources,diagnosticCodes:entry.diagnosticIndexes.map(index=>compilation.diagnostics[index]!.code),
      currentNativeMember:entry.currentNativeMember,book:bookSources.get(entry.bookId!)}))
      :editor!.entries.map(entry=>({...entry,book:undefined}))
  const provenance={schemaVersion:1,encoding:'tavern-lore-current-export-source-v1',sessionId,
    sourceRecordSessionId:source.sourceRecordSessionId,importId:source.original.activePointer.importId,
    rawSha256:source.original.rawSha256,normalizedSha256:source.original.normalizedSha256,
    sourceSha256:source.sourceSha256,importRecordRef:source.original.importRecordRef,
    activePointerRef:source.original.activePointerRef,
    ...(compilation?{journalRevision:data.revision}:{revision:editor!.revision}),dataSha256:data.dataSha256,
    headRef:data.headRef,journalSha256:data.journalSha256,journalRefs:data.journalRefs,
    ...(data.inheritance?{inheritance:data.inheritance}:{}),
    ...(source.legacyInheritance?{legacyInheritance:source.legacyInheritance}:{}),
    ...(source.inheritance?{sourceInheritance:source.inheritance}:{}),
    ...(compilation?{bookCollection:{source:compilation.plan.source,
      sourceReferenceSha256:compilation.plan.sourceReferenceSha256,planSha256:compilation.plan.planSha256}}:{})}
  const materials:ExportMaterial[]=entries.flatMap(entry=>{
    const entrySource={...provenance,rawEntryPointer:entry.rawEntryPointer,rawEntrySha256:entry.rawEntrySha256,
      ...(entry.book?{book:entry.book}:{}),
      ...(entry.currentNativeMember?{currentNativeMember:entry.currentNativeMember}:{})},
      {content:_contentReference,...fields}=entry.semantic
    return [{label:`当前结构化世界书正文: ${entry.entryId}`,text:entry.contentText,source:entrySource},
      {label:`当前结构化世界书字段与来源: ${entry.entryId}`,
        text:'```json\n'+stableJson({role:'current-structured-lore',entryId:entry.entryId,disposition:entry.disposition,
          fields,fieldSources:entry.fieldSources,diagnosticCodes:entry.diagnosticCodes})+'\n```',source:entrySource}]
  })
  const skipRulesCore=bindings.contributions.coreData.kind==='legacy-projection'
    &&bindings.contributions.overlays.some(entry=>entry.kind==='constant-current-overlay-missing')
  if(skipRulesCore) {
    // Import projected constant entries into one core text. The proven legacy
    // resolver has already matched that complete text to its source fragments.
    // Preserve it as original evidence rather than inventing current split text.
    materials.push({label:'原件核心映射（含原卡常驻条目；原件来源，不作为当前条目）',
      // Export organization materializes source text, so the original/current
      // distinction must travel in that text rather than only its review label.
      text:'> 原件核心映射（含原卡常驻条目；原件来源，不作为当前条目）\n\n'
        +bindings.contributions.residualCore,source:{...provenance,
        role:'original-import-core-projection',rulesRow:bindings.contributions.rulesRow,
        fragments:bindings.contributions.orderedBefore,coreSha256:bindings.contributions.beforeCoreSha256}})
  }
  if(source.original.primary.binding==='proven-absence')materials.push({
    label:'结构化原件世界书缺席证明',text:'```json\n'+stableJson({binding:'proven-absence',
      bookPointer:source.original.primary.bookPointer,absenceProofSha256:source.original.primary.absenceProof.absenceProofSha256,
      documentSha256:source.original.documentSha256,importRecordRef:source.original.importRecordRef})+'\n```',
    source:provenance})
  const skipWorldbookKeys=bindings.linkedRowKeys,
    currentLoreSha256=recordSha256({sourceSha256:source.sourceSha256,dataSha256:data.dataSha256,
      ...(compilation?{compilationPlanSha256:compilation.plan.planSha256}:{editor}),skipWorldbookKeys,skipRulesCore})
  return {kind:'ready',sessionId,sourceSha256:source.sourceSha256,currentLoreSha256,
    materials,skipWorldbookKeys,skipRulesCore}
}
