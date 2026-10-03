/** Actual closed nonnumerical Source producer. It proves origin and complete
 * source coverage, never JavaScript semantics or authority to run a VM. */
import {recordSha256,sha256} from './roleplay-data.js'
import {decodeTavernCard,compileTavernOpeningCandidates} from './tavern-card.js'
import type {TavernOpeningContext} from './tavern-card.js'
import {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import {validateTavernLoreAbsentSourceReferenceV1} from './tavern-lore-compiler.mjs'
import {assertMvuLiteralSourceTextV1,assertMvuNonSchemaSourceExtensionsV1} from './roleplay-mvu-source.js'
import type {MvuSourceRequest} from './roleplay-mvu-source.js'
import {TEMPLATE_POLICY_SHA256,TEMPLATE_LIMITS_V1} from './tavern-template-data.mjs'
import {mapPromptTemplateOnlyOriginsV1} from './roleplay-prompt-template-only-origins.js'
import {PROMPT_TEMPLATE_ONLY_FIELDS_V1,PROMPT_TEMPLATE_ONLY_POLICY_SHA256,PromptTemplateOnlyRefusalV1,
  promptTemplateOnlyFail,clonePromptTemplateOnlyDataV1,freezePromptTemplateOnlyDataV1,
  validatePromptTemplateOnlySourceProofV1} from './roleplay-prompt-template-only-data.js'
import type {PromptTemplateOnlyCodeV1,PromptTemplateOnlySourceDepsV1,PromptTemplateOnlySourceProofV1,
  PromptTemplateOnlySourceDecisionV1,PromptTemplateOnlyScopeInventoryV1,PromptTemplateOnlyRootDomainV1}
  from './roleplay-prompt-template-only-types.js'
export type * from './roleplay-prompt-template-only-types.js'

const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function fail(...args:Parameters<typeof promptTemplateOnlyFail>):never {return promptTemplateOnlyFail(...args)}
const escape=(part:string)=>part.replace(/~/g,'~0').replace(/\//g,'~1')
const ID=/^[a-zA-Z0-9_-]{1,64}$/
function knownKeys(row:Record<string,unknown>,keys:readonly string[],pointer:string):void {
  if(Object.keys(row).some(key=>!keys.includes(key)))fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',pointer)
}
function literal(text:string,context:TavernOpeningContext,pointer:string,code:PromptTemplateOnlyCodeV1):void {
  try {assertMvuLiteralSourceTextV1(text,context,pointer)}
  catch {fail(code,pointer)}
}
function extension(value:unknown,pointer:string,context:TavernOpeningContext):void {
  try {assertMvuNonSchemaSourceExtensionsV1(value,pointer)}
  catch {fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',pointer)}
  if(object(value)&&object(value.depth_prompt))literal(String(value.depth_prompt.prompt),context,
    `${pointer}/depth_prompt/prompt`,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
}
/** Explicit diagnostics only, not a lexical/AST security proof. The protected
 * worker's absent host capabilities and sticky helper refusals own isolation. */
const unsupportedCalls=new RegExp('\\b(?:'+[
  'registerMvuSchema','setMvuData','updateMvuData','setMvuVariable','initializeMvuData','getMvuData','getMvuVariable',
  'getAllVariables','getVariables','setVariables','updateVariables','replaceVariables','insertOrAssignVariables',
  'setvar','addvar','incvar','decvar','include','runSlashCommand','executeSlashCommands','eval','Function','fetch','import','require',
].join('|')+')\\s*\\(','i')
function programDiagnostic(body:string,pointer:string):void {
  if(unsupportedCalls.test(body)) {
    fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',pointer)
  }
  if(/<\/?(?:script|iframe)\b|\bon[a-z]+\s*=|javascript:|\[initvar\]|<\/?initvar\b/i.test(body)) {
    fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',pointer)
  }
}

/** Actual table inventory, independent of a caller-supplied frame or a fresh
 * basis claiming zero openings. The completed opening may already exist. */
export function readPromptTemplateOnlyScopeInventoryV1(deps:PromptTemplateOnlySourceDepsV1,
  sessionId:string):PromptTemplateOnlyScopeInventoryV1 {
  if(!ID.test(sessionId))fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/sessionId')
  const session=deps.session(sessionId),metaKey=`${sessionId}__meta`
  const meta=clonePromptTemplateOnlyDataV1(deps.readRow('branch',metaKey))
  if(!session||session.id!==sessionId||!deps.branchReady(sessionId)||!object(meta)
    ||session.header?.parentSession||session.header?.origin==='subagent'
    ||session.inheritedEventCount!==0||meta.inheritedFrom||meta.freshBranchFrom||meta.truncatedFrom
    ||meta.inheritanceState!==undefined&&meta.inheritanceState!=='ready') {
    fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/root')
  }
  knownKeys(meta,['createdAt','lastTurn','lastSeq','surfaceTokens','inheritanceState','inheritedFrom',
    'freshBranchFrom','truncatedFrom'],'/root/meta')
  if(meta.createdAt!==undefined&&(!Number.isSafeInteger(meta.createdAt)||Number(meta.createdAt)<0)
    ||['lastTurn','lastSeq','surfaceTokens'].some(key=>meta[key]!==undefined
      &&(!Number.isFinite(meta[key])||typeof meta[key]!=='number')))fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/root/meta')
  const rootBody={sessionId,ownerSessionId:sessionId,metaKey,inheritance:'root' as const,parentSessionId:null,
    inheritedEventCount:0 as const,ready:true as const,meta:{createdAt:typeof meta.createdAt==='number'?meta.createdAt:null,
      inheritanceState:meta.inheritanceState==='ready'?'ready' as const:null,
      inheritedFrom:null,freshBranchFrom:null,truncatedFrom:null}}
  const root:PromptTemplateOnlyRootDomainV1={...rootBody,rootDomainSha256:recordSha256(rootBody)}
  const prefix=`${sessionId}__`,seen=new Set<string>()
  let count=0
  for(const table of ['branch','status'] as const)for(const [key,value] of deps.entries(table)) {
    if(typeof key!=='string'||!key.startsWith(prefix))continue
    if(++count>16_384||seen.has(`${table}:${key}`))fail('PROMPT_TEMPLATE_BUDGET','/scopeInventory')
    seen.add(`${table}:${key}`)
    if(value===undefined||!same(deps.readRow(table,key),value))fail('PROMPT_TEMPLATE_RECORD_INVALID','/scopeInventory')
    const suffix=key.slice(prefix.length)
    if(table==='status'&&!['spec','panel'].includes(suffix)
      ||/^(?:mvu|state|stat_data|statData|variables|schema|opaqueState)(?:[-_]|$)/i.test(suffix)) {
      fail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT','/scopeInventory')
    }
    if(table==='status') {
      const scanned=clonePromptTemplateOnlyDataV1(value)
      const opaque=(entry:unknown):void=>{
        if(!entry||typeof entry!=='object')return
        for(const [field,child] of Object.entries(entry)) {
          if(/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(field)
            ||field.startsWith('$'))fail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT','/scopeInventory')
          opaque(child)
        }
      }
      opaque(scanned)
    }
  }
  const body={schemaVersion:1 as const,encoding:'native-prompt-template-only-empty-state-inventory-v1' as const,
    sessionId,root,numericalRows:[] as [],opaqueRows:[] as [],
    numericalMembershipSha256:recordSha256([]),opaqueMembershipSha256:recordSha256([])}
  return freezePromptTemplateOnlyDataV1({...body,inventorySha256:recordSha256(body)})
}

export function inspectPromptTemplateCurrentRowsV1(source:TavernLoreSourceDataV1,owned:ReadonlyMap<string,ReadonlyMap<string,string>>,
  context:TavernOpeningContext):readonly unknown[] {
  const excluded:unknown[]=[]
  for(const row of source.current.rows) {
    if(row.ref.table==='branch'&&row.ref.key===`${source.sessionId}__meta`)continue
    const ownedFields=owned.get(`${row.ref.table}:${row.ref.key}`)
    const walk=(value:unknown,pointer:string,top=false):void=>{
      if(typeof value==='string') {
        literal(value,context,pointer,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN');return
      }
      if(!value||typeof value!=='object')return
      for(const [key,child] of Object.entries(value)) {
        const next=`${pointer}/${escape(key)}`
        if(top&&ownedFields?.has(key)) {
          if(typeof child!=='string'||child!==ownedFields.get(key))fail('PROMPT_TEMPLATE_CURRENT_ORIGIN_UNPROVEN',next)
          continue
        }
        if(/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
          ||/^(?:card_agent|chaoshen_jixieshi|risuai)$/.test(key)||key.startsWith('$')) {
          fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',next)
        }
        if(key==='extensions')extension(child,next,context)
        if(key==='beauty') {
          if(!object(child)||Object.keys(child).some(field=>!['css','js','regexRules','sources'].includes(field))
            ||child.css!==undefined&&child.css!==''||child.js!==undefined&&child.js!==''
            ||child.regexRules!==undefined&&!same(child.regexRules,[])
            ||child.sources!==undefined&&!same(child.sources,[]))fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',next)
        }
        walk(child,next)
      }
    }
    walk(row.value,`/current/${row.ref.table}/${escape(row.ref.key)}`,true)
    excluded.push({row:row.ref,strictLiteralFieldsExcluded:[...(ownedFields?.keys()??[])].sort()})
  }
  return excluded
}

export function createRoleplayPromptTemplateOnlySourceV1(deps:PromptTemplateOnlySourceDepsV1) {
  const lore=createRoleplayTavernLoreSourceV1(deps)
  function produce(supplied:MvuSourceRequest):PromptTemplateOnlySourceDecisionV1 {
    try {
      const request=clonePromptTemplateOnlyDataV1(supplied)
      if(!object(request)||!object(request.catalog)||!object(request.candidate))fail('PROMPT_TEMPLATE_RECORD_INVALID','/request')
      knownKeys(request as unknown as Record<string,unknown>,['catalog','candidate'],'/request')
      const sessionId=request.catalog.source.sessionId
      const captured=lore.capture(sessionId)
      if(captured.kind!=='captured-data') {
        if(captured.kind==='outside-declared-domain'&&captured.code==='INHERITED_SOURCE_EVIDENCE_MISSING') {
          fail('PROMPT_TEMPLATE_INHERITANCE_UNPROVEN','/source/inheritance')
        }
        fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/source')
      }
      const {source,contributionInput}=captured,record=contributionInput.activeImport
      const envelope=record.sourceEnvelope!
      const decoded=decodeTavernCard(Buffer.from(envelope.base64,'base64'),envelope.extension)
      if(!['json-v2','json-v3','png-v2','png-v3'].includes(decoded.format)||decoded.document.data!==decoded.data
        ||record.mode==='merge'||record.mode!==undefined&&record.mode!=='replace'
        ||source.sourceRecordSessionId!==sessionId||Object.hasOwn(source.original.activePointer,'inheritedFrom')) {
        if(source.sourceRecordSessionId!==sessionId||Object.hasOwn(source.original.activePointer,'inheritedFrom')) {
          fail('PROMPT_TEMPLATE_INHERITANCE_UNPROVEN','/source/inheritance')
        }
        fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/source')
      }
      const containsTemplate=PROMPT_TEMPLATE_ONLY_FIELDS_V1.some(field=>typeof decoded.data[field]==='string'
        &&String(decoded.data[field]).includes('<%'))
      if(!containsTemplate)return {kind:'not-applicable'}
      if(Object.hasOwn(decoded.data,'character_book')||source.original.primary.binding!=='proven-absence') {
        fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN','/data/character_book')
      }
      const primary=source.original.primary
      validateTavernLoreAbsentSourceReferenceV1({schemaVersion:1,encoding:'st-character-book-source-reference-v1',
        ownerSessionId:sessionId,sourceRecordSessionId:source.sourceRecordSessionId,importId:record.importId,
        rawSourceSha256:record.rawSha256,importRecordSha256:source.original.importRecordRef.sha256,
        sourceSnapshotSha256:source.sourceSha256,documentSha256:source.original.documentSha256,
        bookPointer:primary.bookPointer,bookValueSha256:primary.bookSha256,
        sourceFormat:decoded.format.endsWith('v3')?'ccv3-character-book':'ccv2-character-book',
        bookPresence:'proven-absence',absenceProof:primary.absenceProof})
      const inventory=readPromptTemplateOnlyScopeInventoryV1(deps,sessionId)
      const context=source.current.openingContext.context,candidates=compileTavernOpeningCandidates(decoded,context)
      for(const [name,value] of Object.entries(context))literal(String(value),context,
        `/openingContext/${escape(name)}`,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
      const active=source.original.activePointer
      const openingSource={sessionId,importId:record.importId,sourceRecordSessionId:source.sourceRecordSessionId,
        rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,transactionId:source.original.transactionId,
        coverageSha256:source.original.coverageSha256,pointer:active}
      const selected=candidates.find(candidate=>candidate.index===request.candidate.index)
      if(!selected||!same(request.catalog,{source:openingSource,candidates})||!same(request.candidate,selected)) {
        fail('PROMPT_TEMPLATE_SOURCE_CHANGED','/selected')
      }
      knownKeys(decoded.document,['spec','spec_version','data'],'/document')
      knownKeys(decoded.data,['name','description','personality','scenario','first_mes','mes_example','system_prompt',
        'post_history_instructions','creator_notes','tags','creator','character_version','alternate_greetings','extensions'],'/data')
      for(const key of ['spec','spec_version'])literal(String(decoded.document[key]),context,`/${key}`,
        'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
      extension(decoded.data.extensions,'/data/extensions',context)
      for(const [key,value] of Object.entries(decoded.data)) {
        if(PROMPT_TEMPLATE_ONLY_FIELDS_V1.some(field=>field===key)||['extensions','first_mes','alternate_greetings'].includes(key))continue
        const texts=key==='tags'&&Array.isArray(value)?value:[value]
        for(const text of texts) {
          if(typeof text!=='string')fail('PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN',`/data/${escape(key)}`)
          literal(text,context,`/data/${escape(key)}`,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
        }
      }
      for(const candidate of candidates) {
        literal(candidate.rawText,context,candidate.sourcePointer,'PROMPT_TEMPLATE_OPENING_UNSUPPORTED')
        literal(candidate.renderedText,context,candidate.sourcePointer,'PROMPT_TEMPLATE_OPENING_UNSUPPORTED')
      }
      const origins=mapPromptTemplateOnlyOriginsV1({decoded,record,source})
      let programCount=0,sourceBytes=0
      for(const field of origins.fields) {
        if(field.rawText===null)continue
        sourceBytes+=Buffer.byteLength(field.rawText,'utf8')
        for(const part of field.segments) {
          if(part.kind==='literal')literal(field.rawText.slice(part.start,part.end),context,
            field.sourcePointer,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
          else {programCount++;programDiagnostic(field.rawText.slice(part.program!.bodyStart,part.program!.bodyEnd),field.sourcePointer)}
        }
        for(const part of field.normalizedSegments) {
          if(part.kind==='literal')literal(field.normalizedText!.slice(part.start,part.end),context,
            field.sourcePointer,'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN')
          else programDiagnostic(field.normalizedText!.slice(part.program!.bodyStart,part.program!.bodyEnd),field.sourcePointer)
        }
      }
      if(programCount===0||programCount>TEMPLATE_LIMITS_V1.templateEvaluations
        ||sourceBytes>TEMPLATE_LIMITS_V1.cumulativeSourceBytes)fail('PROMPT_TEMPLATE_BUDGET','/templateFields')
      const excluded=inspectPromptTemplateCurrentRowsV1(source,origins.owned,context)
      const materialRows=source.current.rows.filter(row=>!(row.ref.table==='branch'&&row.ref.key===`${sessionId}__meta`))
        .map(row=>row.ref)
      const snapshotBody={schemaVersion:1 as const,encoding:'native-prompt-template-only-source-snapshot-v1' as const,
        source:openingSource,normalizer:source.normalizer,documentSha256:source.original.documentSha256,
        dataSha256:source.original.dataSha256,pointerSha256:source.original.activePointerRef.sha256,
        importRecordSha256:source.original.importRecordRef.sha256,coverageSha256:source.original.coverageSha256,
        materialRows,materialRowsSha256:recordSha256(materialRows),
        membership:{cards:source.current.cards,worldbook:source.current.worldbook,rules:source.current.rules,
          settings:source.current.settings,membershipSha256:source.current.membershipSha256},
        selected:{index:selected.index,pointer:selected.sourcePointer,sourceSha256:selected.sourceSha256,
          renderedSha256:sha256(selected.renderedText)},
        swipes:candidates.map(candidate=>({index:candidate.index,pointer:candidate.sourcePointer,
          sourceSha256:candidate.sourceSha256,renderedSha256:sha256(candidate.renderedText)})),
        openingContext:source.current.openingContext,scopeInventory:inventory}
      const sourceSnapshot={...snapshotBody,snapshotSha256:recordSha256(snapshotBody)}
      const body={schemaVersion:1 as const,encoding:'native-prompt-template-only-source-proof-v1' as const,
        authority:'consumer-data-only' as const,policySha256:PROMPT_TEMPLATE_ONLY_POLICY_SHA256,sourceSnapshot,
        primaryBookAbsence:primary.absenceProof,templateFields:origins.fields,
        fieldInventorySha256:recordSha256(origins.fields),
        exclusionInventorySha256:recordSha256({documentSha256:source.original.documentSha256,
          sections:origins.sectionInventory,current:excluded,root:inventory.root}),
        initialization:{kind:'none' as const,scopeInventorySha256:inventory.inventorySha256},
        requiredPromptRuntime:{protocol:'owned-template-v1' as const,policySha256:TEMPLATE_POLICY_SHA256}}
      const proof=validatePromptTemplateOnlySourceProofV1({...body,proofSha256:recordSha256(body)})
      return freezePromptTemplateOnlyDataV1({kind:'prompt-template-only' as const,proof})
    }catch(error) {
      const diagnostic=error instanceof PromptTemplateOnlyRefusalV1?{code:error.code,pointer:error.pointer}
        :{code:'PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN' as const,pointer:'/source'}
      return freezePromptTemplateOnlyDataV1({kind:'unsupported' as const,diagnostics:[diagnostic]})
    }
  }
  function current(input:PromptTemplateOnlySourceProofV1):boolean {
    try {
      const saved=validatePromptTemplateOnlySourceProofV1(input),snapshot=saved.sourceSnapshot
      const envelope=(deps.readImportRecord(snapshot.source.sourceRecordSessionId,snapshot.source.importId) as
        {sourceEnvelope?:{base64:string;extension:string}}|undefined)?.sourceEnvelope
      if(!envelope)return false
      const decoded=decodeTavernCard(Buffer.from(envelope.base64,'base64'),envelope.extension)
      const candidates=compileTavernOpeningCandidates(decoded,deps.readOpeningContext(snapshot.source.sessionId).context)
      const candidate=candidates.find(candidate=>candidate.index===snapshot.selected.index)
      if(!candidate)return false
      const actual=produce({catalog:{source:snapshot.source,candidates},candidate})
      return actual.kind==='prompt-template-only'&&same(saved,actual.proof)
    }catch{return false}
  }
  function captureCurrent(input:PromptTemplateOnlySourceProofV1) {
    const saved=freezePromptTemplateOnlyDataV1(validatePromptTemplateOnlySourceProofV1(input)),
      sid=saved.sourceSnapshot.source.sessionId,actualSession=deps.session(sid),live=lore.captureCurrent(sid)
    if(live.captured.kind!=='captured-data'||!current(saved))fail('PROMPT_TEMPLATE_SOURCE_CHANGED','/source')
    const assertCurrent=()=>{
      if(deps.session(sid)!==actualSession)fail('PROMPT_TEMPLATE_INHERITANCE_UNPROVEN','/source')
      live.assertCurrent()
      if(!same(readPromptTemplateOnlyScopeInventoryV1(deps,sid),saved.sourceSnapshot.scopeInventory)) {
        fail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT','/scopeInventory')
      }
    }
    assertCurrent()
    return {proof:saved,assertCurrent}
  }
  return {produce,current,captureCurrent,
    readScopeInventory:(sessionId:string)=>readPromptTemplateOnlyScopeInventoryV1(deps,sessionId)}
}
