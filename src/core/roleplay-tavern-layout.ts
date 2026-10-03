/** Native layout data comes from actual author/Phase-A producers. This module
 * checks complete section preimages and expresses chat anchors; only Native
 * resolves those anchors against its real envelope/Session preview. */
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareInputV1,
  NativeRequestMaterialTransformV1,NativeOwnedMaterialAnchoredInsertionV1}
  from '@deepseek-ai/dsh-agent-loop'
import {recordSha256,sha256} from './roleplay-data.js'
import {createStableRoleplayFence} from './roleplay-context.js'
import type {AuthorContributionDataV1} from './roleplay-author-contributions.js'
import type {TavernLoreEvaluationPlanV1} from './tavern-lore-evaluator-types.mjs'
import type {PreparationSnapshot} from './roleplay-preparation-types.js'

export const TAVERN_NATIVE_LAYOUT_SLOTS_V1=Object.freeze([
  Object.freeze({name:'roleplay:lore-before-character',order:149}),
  Object.freeze({name:'roleplay:lore-after-character',order:151}),
  Object.freeze({name:'roleplay:lore-before-examples',order:163}),
  Object.freeze({name:'roleplay:examples',order:164}),
  Object.freeze({name:'roleplay:lore-after-examples',order:165}),
])
export const TAVERN_NATIVE_OWNED_SECTION_NAMES_V1=Object.freeze([
  'roleplay:lore-before-character','roleplay:cards','roleplay:lore-after-character','roleplay:rules',
  'roleplay:lore-before-examples','roleplay:examples','roleplay:lore-after-examples',
])
export const TAVERN_NATIVE_LAYOUT_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'roleplay-tavern-native-layout-policy-v1',
  system:'exact-owned-section-preimage-and-final-assembly-order',
  examples:'native-author-samples-group; field-producer-residual; material-only-split',
  authorsNote:'native-director-notes-anchor-v1; exact-current-phase-a-produced-user-message',
  authorsNoteConfiguration:'explicit-owned-native-layout-adaptation; no-claim-of-captured-st-user-an-settings',
  chat:'native-preview-resolved-selected-anchor-or-canonical-depth',
  namedOutlet:'explicit-macro-consumption-only; never-automatic-append',
  persistentNative:'resolved-numeric-v1; original-versioned-intent-retained-in-bound-core-plan',
})
export const TAVERN_NATIVE_LAYOUT_POLICY_SHA256=recordSha256(TAVERN_NATIVE_LAYOUT_POLICY_V1)
const slotFor=Object.freeze({'before-character':'roleplay:lore-before-character',
  'after-character':'roleplay:lore-after-character','before-examples':'roleplay:lore-before-examples',
  'after-examples':'roleplay:lore-after-examples'})
export interface TavernNativeFinalLoreTextV1 {
  readonly entryId:string
  readonly inputSha256:string
  readonly text:string
  readonly outputSha256:string
}
interface LayoutInput {
  readonly native:Omit<NativeRequestMaterialPrepareInputV1,'admission'>
  readonly original:AuthorContributionDataV1
  readonly residual:AuthorContributionDataV1
  readonly renderedAuthor:{readonly cardsText:string;readonly rulesText:string;readonly examplesText:string}
  readonly evaluation:TavernLoreEvaluationPlanV1
  /** WORLD_INFO prompt transforms occur after budget admission, independently
   * from getwi's source-channel regex→macro→nested-template chain. */
  readonly finalLore:readonly TavernNativeFinalLoreTextV1[]
  readonly phaseASnapshot:PreparationSnapshot['contextMessageRefs']
  readonly injected?:readonly Omit<NativeRequestMaterialTransformV1['insertions'][number],'stableOrder'>[]
}
function fail(code:string):never {throw Error(code)}
const freeze=<T>(value:T):T=>{
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function currentAuthorsNote(selected:NativeMaterialSelectedBaseV1,
  witness:PreparationSnapshot['contextMessageRefs'],sessionId:string,turn:number) {
  if(!witness||witness.schemaVersion!==1||witness.encoding!=='roleplay-context-produced-message-refs-v1'
    ||witness.sessionId!==sessionId||witness.turn!==turn)fail('INPUT_MATERIAL_AN_PRODUCER_UNPROVEN')
  const refs=witness.refs.filter(row=>row.form==='director-notes')
  if(refs.length!==1)fail('INPUT_MATERIAL_AN_PRODUCER_UNPROVEN')
  const ref=refs[0]!,matches=selected.messages.filter(row=>row.id===ref.id&&row.role==='user'
    &&row.messageSha256===ref.messageSha256)
  if(matches.length!==1)fail('INPUT_MATERIAL_AN_SELECTED_UNPROVEN')
  const row=matches[0]!,source=row.message.source as Record<string,unknown>|undefined
  if(!source||source.kind!=='roleplay-context'||source.form!=='director-notes'||source.schemaVersion!==1
    ||source.branchId!==sessionId||nativeInputSha256(source)!==ref.sourceSha256) {
    fail('INPUT_MATERIAL_AN_SOURCE_UNPROVEN')
  }
  return {id:row.id,role:'user' as const,messageSha256:row.messageSha256}
}

export function produceRoleplayTavernLayoutV1(input:LayoutInput) {
  const {native,original,residual,evaluation}=input,sessionId=original.sessionId
  if(sessionId!==residual.sessionId||sessionId!==evaluation.sessionId||sessionId!==evaluation.branchId
    ||original.includeCardStyle!==residual.includeCardStyle
    ||recordSha256(original.rows)!==recordSha256(residual.rows)
    ||nativeInputSha256(native.finalAssembly)!==native.assemblySha256)fail('INPUT_MATERIAL_LAYOUT_SOURCE_CHANGED')
  const fence=createStableRoleplayFence()
  const originalTexts:Record<string,string>={
    'roleplay:cards':original.cardsText.trim()?fence(original.cardsText,'card'):'',
    'roleplay:rules':original.rulesText?fence(original.rulesText,'rules'):'',
  }
  const requiredSections:NativeRequestMaterialTransformV1['requiredSections'][number][]=[]
  const sectionHashes=new Map<string,string>(),positions:number[]=[]
  for(const name of TAVERN_NATIVE_OWNED_SECTION_NAMES_V1) {
    const matches=native.finalAssembly.sections.map((section,index)=>({section,index})).filter(row=>row.section.name===name)
    if(matches.length!==1)fail('INPUT_MATERIAL_LAYOUT_SECTION_MISSING')
    const {section,index}=matches[0]!,empty=Object.hasOwn(originalTexts,name)===false
    const expected={name,text:empty?'':originalTexts[name]!,...empty?{interpolate:false}:{}}
    if(nativeInputSha256(section)!==nativeInputSha256(expected))fail('INPUT_MATERIAL_LAYOUT_SECTION_PREIMAGE')
    positions.push(index)
    const hash=nativeInputSha256(section);sectionHashes.set(name,hash);requiredSections.push({name,sha256:hash})
  }
  if(positions.some((value,index)=>index>0&&value<=positions[index-1]!))fail('INPUT_MATERIAL_LAYOUT_ORDER_CHANGED')
  const byId=new Map(input.finalLore.map(row=>[row.entryId,row]))
  if(byId.size!==input.finalLore.length||byId.size!==evaluation.placements.length)fail('INPUT_MATERIAL_LAYOUT_RENDER_SET')
  const slotTexts=new Map<string,string[]>(),outlets=new Map<string,string[]>()
  const insertions:NativeRequestMaterialTransformV1['insertions'][number][]=[]
  const anchoredInsertions:NativeOwnedMaterialAnchoredInsertionV1[]=[]
  let authorsNote:ReturnType<typeof currentAuthorsNote>|undefined
  for(const [stableOrder,placement] of evaluation.placements.entries()) {
    const rendered=byId.get(placement.entryId)
    if(!rendered||rendered.inputSha256!==placement.effectiveContentSha256
      ||sha256(rendered.text)!==rendered.outputSha256)fail('INPUT_MATERIAL_LAYOUT_RENDER_CHANGED')
    if(!rendered.text)continue
    if(placement.position==='named-outlet') {
      const texts=outlets.get(placement.outletName)??[];texts.push(rendered.text);outlets.set(placement.outletName,texts)
      continue
    }
    if(Object.hasOwn(slotFor,placement.position)) {
      const name=slotFor[placement.position as keyof typeof slotFor]
      const texts=slotTexts.get(name)??[];texts.push(rendered.text);slotTexts.set(name,texts)
      continue
    }
    const common={contributionRef:`lore-${placement.entryId}`,sourceSha256:placement.sourceContentSha256,
      renderedText:rendered.text,renderedSha256:rendered.outputSha256,stableOrder}
    if(placement.position==='at-chat-depth') {
      insertions.push({...common,requestedRole:placement.role,requestedDepth:placement.depth})
    }else if(placement.position==='before-authors-note'||placement.position==='after-authors-note') {
      // AN's role follows the actual Native user-note destination. The ST role
      // control applies only to at-chat-depth, as the compiler profile records.
      authorsNote??=currentAuthorsNote(native.selected,input.phaseASnapshot,sessionId,native.turn)
      anchoredInsertions.push({...common,requestedRole:'user',anchor:{schemaVersion:1,
        encoding:'native-selected-message-anchor-v1',side:placement.position==='before-authors-note'?'before':'after',
        target:authorsNote}})
    }else fail('INPUT_MATERIAL_LAYOUT_POSITION_UNSUPPORTED')
  }
  for(const [index,injected] of (input.injected??[]).entries()) {
    if(sha256(injected.renderedText)!==injected.renderedSha256)fail('INPUT_MATERIAL_INJECTION_RENDER_CHANGED')
    if(injected.renderedText)insertions.push({...injected,stableOrder:evaluation.placements.length+index})
  }
  const body=input.renderedAuthor
  const replacementTexts:Record<string,string>={
    'roleplay:cards':body.cardsText.trim()?fence(body.cardsText,'card'):'',
    'roleplay:rules':body.rulesText?fence(body.rulesText,'rules'):'',
    'roleplay:examples':body.examplesText?fence(body.examplesText,'examples'):'',
    ...Object.fromEntries([...slotTexts].map(([name,texts])=>[name,texts.join('\n')])),
  }
  const sections=TAVERN_NATIVE_OWNED_SECTION_NAMES_V1.map(name=>({name,expectedSectionSha256:sectionHashes.get(name)!,
    replacementText:replacementTexts[name]??'',interpolate:false as const}))
  return freeze({requiredSections,sections,insertions,anchoredInsertions,
    layout:{schemaVersion:1,encoding:'roleplay-tavern-native-layout-data-v1',authority:'consumer-data-only',
      policySha256:TAVERN_NATIVE_LAYOUT_POLICY_SHA256,assemblySha256:native.assemblySha256,
      originalAuthorSha256:original.dataSha256,residualAuthorSha256:residual.dataSha256,
      sectionPositions:TAVERN_NATIVE_OWNED_SECTION_NAMES_V1.map((name,index)=>({name,index:positions[index]!})),
      authorsNote:authorsNote??null,outlets:[...outlets].map(([name,texts])=>({name,text:texts.join('\n')}))}})
}
