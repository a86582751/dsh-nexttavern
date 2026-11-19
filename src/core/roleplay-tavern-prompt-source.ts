/** Captures the actual current import and editing journal, then removes only
 * provenance-proven legacy duplication from the ordinary author producer. */
import {recordSha256,cloneRecord} from './roleplay-data.js'
import {resolveCapturedLegacyContributionDataV1} from './roleplay-tavern-lore-contributions.js'
import {produceRoleplayTavernCurrentLegacyOverlayV1,composeRoleplayTavernCurrentOverlayV1}
  from './roleplay-tavern-current-overlay.js'
import {compileTavernLoreBookV1} from './tavern-lore-compiler.mjs'
import {produceAuthorContributionDataV1} from './roleplay-author-contributions.js'
import type {AuthorRecord,AuthorTables,AuthorTable} from './roleplay-author-context-types.js'
import type {TavernLoreSourceCaptureV1,TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreEditObservationV1,TavernLoreEditsDataV1,TavernLoreEditSourceDataCaptureV1}
  from './roleplay-tavern-lore-edits-types.js'
import type {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import {readCapturedTavernAvatarV1} from './roleplay-tavern-lore-source.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import {materializeAuthorMetadataExtensionsV1} from './roleplay-tavern-source-author-metadata.js'
import {materializeAuthorWorldbookCaptureV1} from './roleplay-author-source-context.js'
import {materializeTavernEffectiveBookV1} from './roleplay-tavern-lore-edits-data.js'
import {produceCommunityPresetCardMaterialV1,projectCapturedStRuleTextV1,projectCapturedStOpeningTextV1}
  from './community-preset-card-material.js'
import type {CommunityPresetCardMaterialV1} from './community-preset-card-material.js'
import type {TavernEjsCurrentCharacterSupplierV1} from './tavern-template-ejs-host-types.mjs'

interface SourceDependencies {
  readonly tables:AuthorTables&{status:AuthorTable}
  readonly source:{capture(sessionId:string):TavernLoreSourceCaptureV1;current(source:TavernLoreSourceDataV1):boolean;
    captureCurrent?:ReturnType<typeof createRoleplayTavernLoreSourceV1>['captureCurrent']}
  readonly edits:{observe(sessionId:string):TavernLoreEditObservationV1;current(data:TavernLoreEditsDataV1):boolean;
    observeCurrent?:ReturnType<typeof createRoleplayTavernLoreEditsV1>['observeCurrent']}
  readonly books?:Pick<import('./roleplay-author-source-context.js').RoleplayAuthorContextV1,'captureCompilation'|'capture'>
}
interface SourceDataDependencies {
  readonly source:Pick<SourceDependencies['source'],'capture'>
  readonly edits:Pick<ReturnType<typeof createRoleplayTavernLoreEditsV1>,'observeJournalDataWithLegacyData'>
  readonly books?:SourceDependencies['books']
}
function fail(code:string):never {throw Error(code)}
const freeze=<T>(value:T):T=>{
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}

/** Private immutable table snapshot for the existing author field producer.
 * Every row and complete membership came from the same actual Source capture;
 * author projection cannot add another live table inventory. */
function sourceAuthorTables(source:TavernLoreSourceDataV1):AuthorTables&{status:AuthorTable} {
  const rows={cards:new Map<string,AuthorRecord>(),worldbook:new Map<string,AuthorRecord>(),
    rules:new Map<string,AuthorRecord>(),status:new Map<string,AuthorRecord>()}
  for(const row of source.current.rows) {
    const name=row.ref.table
    if((name==='cards'||name==='worldbook'||name==='rules'||name==='status')&&row.ref.exists&&row.value) {
      rows[name].set(row.ref.key,row.value as AuthorRecord)
    }
  }
  const snapshot=(values:Map<string,AuthorRecord>):AuthorTable=>Object.freeze({
    get:(key:string)=>values.get(key),entries:()=>values.entries()})
  return Object.freeze({cards:snapshot(rows.cards),worldbook:snapshot(rows.worldbook),
    rules:snapshot(rows.rules),status:snapshot(rows.status)})
}
function assemblePromptSourceData(captured:TavernLoreEditSourceDataCaptureV1,edited:TavernLoreEditsDataV1,
  sessionId:string,includeCardStyle:boolean,tables:AuthorTables&{status:AuthorTable},
  legacy:ReturnType<typeof produceRoleplayTavernCurrentLegacyOverlayV1>,books?:SourceDependencies['books']) {
  const {source,currentIdentitySha256,contributionInput}=captured
  const first=legacy.contributions,
    linkedRows=new Set(legacy.linkedRowKeys),bookCapture=books?.captureCompilation(source)
  const compilation=bookCapture?.compilation??compileTavernLoreBookV1({schemaVersion:1,encoding:'st-character-book-compilation-input-v1',
    source:{schemaVersion:1,encoding:'st-character-book-source-reference-v1',ownerSessionId:sessionId,
      sourceRecordSessionId:source.sourceRecordSessionId,importId:source.original.activePointer.importId,
      rawSourceSha256:source.original.rawSha256,importRecordSha256:source.original.importRecordRef.sha256,
      sourceSnapshotSha256:source.sourceSha256,documentSha256:source.original.documentSha256,
      bookPointer:source.original.primary.bookPointer,bookValueSha256:source.original.primary.bookSha256,
      sourceFormat:source.original.decodedFormat==='json-nexttavern-v1'?'nexttavern-character-book'
        :source.original.decodedFormat.endsWith('v3')?'ccv3-character-book':'ccv2-character-book',
      ...(source.inheritance?{inheritance:source.inheritance}:{}),
      ...(source.legacyInheritance?{legacyInheritance:source.legacyInheritance}:{}),
      ...(source.original.primary.binding==='proven-absence'
        ?{bookPresence:'proven-absence' as const,absenceProof:source.original.primary.absenceProof}:{})},
    book:source.original.primary.value,
    currentNativeOverlay:composeRoleplayTavernCurrentOverlayV1(legacy.overlay,edited.overlay),
    ...(edited.currentNativeMembership?{currentNativeMembership:edited.currentNativeMembership}:{})})
  if(compilation.kind!=='compiled')fail(compilation.diagnostics[0]?.code??'INPUT_MATERIAL_LORE_COMPILATION_REFUSED')
  const suppressRawEntryPointers=first.overlays.filter(item=>item.kind==='constant-current-overlay-missing')
    .map(item=>item.rawEntry.entryPointer)
  // A current linked row moved to always-on is replaced by the evaluator's
  // exact constant control. Other explicitly authored rows keep their producer.
  const suppressAlwaysOnRowKeys=contributionInput.currentWorldbook.filter(item=>linkedRows.has(item.ref.key)
    &&item.value.enabled!==false&&item.value.alwaysOn===true).map(item=>item.ref.key)
  const contributions=resolveCapturedLegacyContributionDataV1(contributionInput,{
    suppressRawEntryPointers,suppressAlwaysOnRowKeys})
  if(contributions.kind!=='proven-consumer-data')fail(contributions.code)
  const original=produceAuthorContributionDataV1(tables,sessionId,includeCardStyle)
  const residual=produceAuthorContributionDataV1(tables,sessionId,includeCardStyle,{schemaVersion:1,
    authority:'consumer-data-only',rulesRowSha256:contributions.rulesRow.sha256,
    beforeCoreSha256:contributions.beforeCoreSha256,residualCore:contributions.residualCore,
    worldbookMembershipSha256:contributions.worldbookMembershipSha256,
    suppressAlwaysOn:contributions.directAlwaysOn.map(item=>({key:item.ref.key,sha256:item.ref.sha256})),
    splitExamples:true,nativeLoreReadPolicy:'automatic'})
  const originalCardData=freeze(contributionInput.rawDecoded.data),
    cardData:typeof originalCardData=edited.authorMetadataOverlay&&(edited.authorMetadataOverlay.extensions.length
      ||edited.authorMetadataOverlay.regexScripts!==undefined)?Object.freeze({...originalCardData,
      extensions:materializeAuthorMetadataExtensionsV1(originalCardData.extensions,edited.authorMetadataOverlay)}):originalCardData
  return {kind:'captured-data' as const,source,currentIdentitySha256,edits:edited,legacyOverlay:legacy.overlay,
    compilation,contributions,original,residual,
    ...bookCapture?{bookContext:bookCapture.context}:{},
    record:contributionInput.activeImport,decoded:contributionInput.rawDecoded,
    cardData,avatarPath:readCapturedTavernAvatarV1(captured)}
}

type CapturedCharacterSource=Extract<ReturnType<typeof captureRoleplayTavernPromptSourceDataV1>,{kind:'captured-data'}>
/** Identity reuses the actual immutable producers. Complete character DATA is
 * materialized only by a getter and retained by the existing read journal. */
export function captureTavernEjsCurrentCharacterV1(captured:CapturedCharacterSource,
  mapping:CommunityPresetCardMaterialV1|undefined,policyFingerprint:string|null):TavernEjsCurrentCharacterSupplierV1 {
  const primary=captured.bookContext?.primary
  let value:ReturnType<TavernEjsCurrentCharacterSupplierV1['read']>|undefined
  return {reference:{schemaVersion:1,encoding:'ejs-current-character-reference-v1',
    sourceSnapshotSha256:captured.source.sourceSha256,editsDataSha256:captured.edits.dataSha256,policyFingerprint,
    primaryBook:captured.bookContext===undefined?{kind:'source-fallback'}:primary
      ?{kind:'captured',address:primary.address,content:primary.content,metadata:primary.metadata}:{kind:'absent'}},
    read(){
      if(value)return value
      const projected=projectCapturedTavernCharacterDataV1(captured,mapping)
      value=projected.kind==='available'?{sourcePointer:'/data',
        sourceSnapshotSha256:projected.identity.sourceSnapshotSha256,data:projected.character}
        :{unavailable:projected.kind==='unavailable'?projected.code:'COMMUNITY_CARD_MAPPING_REQUIRED'}
      return value
    }}
}
export type CapturedTavernCharacterDataV1={readonly schemaVersion:1;readonly kind:'available';
  readonly identity:{readonly sessionId:string;readonly sourceRecordSessionId:string;readonly importId:string;
    readonly sourceSnapshotSha256:string;readonly materialSha256:string};
  readonly character:Readonly<Record<string,unknown>>&{readonly data:Readonly<Record<string,unknown>>}}
  |{readonly schemaVersion:1;readonly kind:'mapping-required';readonly mapping:Extract<CommunityPresetCardMaterialV1,{kind:'mapping-required'}>}
  |{readonly schemaVersion:1;readonly kind:'unavailable';readonly code:'NATIVE_CHARACTER_MAPPING_REQUIRED'}

/** Complete current character DATA from one already captured Source cut. */
export function projectCapturedTavernCharacterDataV1(captured:CapturedCharacterSource,
  mapping?:CommunityPresetCardMaterialV1):CapturedTavernCharacterDataV1 {
  if(captured.decoded.format==='json-nexttavern-v1')return {schemaVersion:1,kind:'unavailable',code:'NATIVE_CHARACTER_MAPPING_REQUIRED'}
  const material=mapping??produceCommunityPresetCardMaterialV1({captured})
  if(material.kind==='mapping-required')return {schemaVersion:1,kind:'mapping-required',mapping:material}
  const {source,record,decoded}=captured,data:Record<string,unknown>=cloneRecord(captured.cardData),
    rows=new Map(source.current.rows.map(row=>[row.ref.table+':'+row.ref.key,row.value])),
    rules=rows.get('rules:'+source.sessionId+'__spec') as AuthorRecord|undefined,
    scene=rows.get('opening:'+source.sessionId+'__scene') as AuthorRecord|undefined
  data.name=decoded.data.name
  data.description=material.markers.charDescription.map(part=>part.text).join('')
  data.personality=material.markers.charPersonality.map(part=>part.text).join('')
  data.scenario=material.markers.scenario.map(part=>part.text).join('')
  data.mes_example=projectCapturedStRuleTextV1(record,decoded.data,rules,'style')
  data.system_prompt=projectCapturedStRuleTextV1(record,decoded.data,rules,'narrative')
  data.post_history_instructions=projectCapturedStRuleTextV1(record,decoded.data,rules,'reply')
  data.first_mes=projectCapturedStOpeningTextV1(record,decoded.data,scene)
  const book=captured.bookContext?captured.bookContext.primary
    ?materializeAuthorWorldbookCaptureV1(captured.bookContext.primary):undefined
    :materializeTavernEffectiveBookV1(source,captured.edits,captured.legacyOverlay)
  if(book===undefined)delete data.character_book
  else data.character_book=cloneRecord(book)
  if(captured.avatarPath!==null)data.avatar=captured.avatarPath
  return {schemaVersion:1,kind:'available',identity:{sessionId:source.sessionId,sourceRecordSessionId:source.sourceRecordSessionId,
    importId:source.original.activePointer.importId,sourceSnapshotSha256:source.sourceSha256,
    materialSha256:source.current.materialSha256},character:{...data,data}}
}

/** Synchronous DATA supplier for the actual input Owner under its Source lock.
 * Currency belongs to that Owner; this return value creates no live callback. */
export function captureRoleplayTavernPromptSourceDataV1(deps:SourceDataDependencies,sessionId:string,
  includeCardStyle:boolean) {
  const captured=deps.source.capture(sessionId)
  if(captured.kind==='outside-declared-domain')return {kind:'outside-declared-domain' as const,reason:captured.code}
  if(captured.kind!=='captured-data')fail(captured.diagnostics[0]?.code??'INPUT_MATERIAL_SOURCE_UNAVAILABLE')
  if(captured.source.sessionId!==sessionId)fail('INPUT_MATERIAL_SOURCE_CHANGED')
  // Prompt consumes published journal fields, not the editor's independently
  // compiled entry view. The journal retains this same captured Source.
  const {observed:edited,legacy}=deps.edits.observeJournalDataWithLegacyData(captured)
  if(edited.kind!=='captured-data')fail(edited.diagnostics[0]?.code??'INPUT_MATERIAL_EDIT_UNAVAILABLE')
  const assembled=assemblePromptSourceData(captured,edited.data,sessionId,includeCardStyle,
    sourceAuthorTables(captured.source),legacy!,deps.books)
  return {...assembled,...(captured.sourceLineage?{sourceLineage:captured.sourceLineage}:{})}
}

/** Other callers retain their actual after-await Source/editor/author checks. */
export function captureRoleplayTavernPromptSourceV1(deps:SourceDependencies,sessionId:string,
  includeCardStyle:boolean,assertOwnerCurrent:()=>void) {
  assertOwnerCurrent()
  const liveSource=deps.source.captureCurrent?.(sessionId),captured=liveSource?.captured??deps.source.capture(sessionId)
  if(captured.kind==='outside-declared-domain')return {kind:'outside-declared-domain' as const,reason:captured.code}
  if(captured.kind!=='captured-data')fail(captured.diagnostics[0]?.code??'INPUT_MATERIAL_SOURCE_UNAVAILABLE')
  const {source}=captured,liveEdits=deps.edits.observeCurrent?.(sessionId),
    edited=liveEdits?.observed??deps.edits.observe(sessionId)
  if(edited.kind!=='captured-data')fail(edited.diagnostics[0]?.code??'INPUT_MATERIAL_EDIT_UNAVAILABLE')
  // Independent live readers can capture different Source versions. Join the
  // owner-supplied identities without hashing their complete DATA again.
  if(source.sourceSha256!==edited.data.source.sourceSha256)fail('INPUT_MATERIAL_EDIT_SOURCE_CHANGED')
  const legacy=produceRoleplayTavernCurrentLegacyOverlayV1(captured.contributionInput),
    data=assemblePromptSourceData(captured,edited.data,sessionId,includeCardStyle,deps.tables,legacy,deps.books),original=data.original
  const assertCurrent=()=>{
    assertOwnerCurrent()
    if(liveSource)liveSource.assertCurrent()
    else if(!deps.source.current(source))fail('INPUT_MATERIAL_SOURCE_CHANGED')
    if(liveEdits)liveEdits.assertCurrent()
    else if(!deps.edits.current(edited.data))fail('INPUT_MATERIAL_SOURCE_CHANGED')
    if(data.bookContext&&deps.books?.capture(source)!==data.bookContext)fail('INPUT_MATERIAL_SOURCE_CHANGED')
    const now=produceAuthorContributionDataV1(deps.tables,sessionId,includeCardStyle)
    if(now.dataSha256!==original.dataSha256)fail('INPUT_MATERIAL_AUTHOR_CHANGED')
  }
  assertCurrent()
  return {...data,assertCurrent}
}
