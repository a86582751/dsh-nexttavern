/** Original author provenance and current story material are separate facts.
 * Neither descriptor can recreate Core's private Native publication owner. */
import {recordSha256} from './roleplay-data.js'
import {createRoleplayMvuSource,readMvuSchemaCurrentAuthorSource} from './roleplay-mvu-source.js'
import {freezeSchemaJournalData,createRoleplayMvuSchemaJournal} from './roleplay-mvu-schema-journal.js'
import {validateMvuSchemaOpeningPreparation} from './roleplay-mvu-schema-opening-types.js'
import {compileSchemaMvuInitData} from './tavern-mvu-initvar.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {buildSchemaScopeReadFrame,schemaScopeSource,schemaScopeInitialChat,schemaScopeVisibleMessages}
  from './roleplay-mvu-schema-scope-facts.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {mvuSchemaMarkers} from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuSourceDeps,MvuSchemaAuthorSource} from './roleplay-mvu-source.js'
import type {MvuSchemaOpeningPreparation} from './roleplay-mvu-schema-opening-types.js'
import type {SchemaJournalReady,SchemaJournalTable} from './roleplay-mvu-schema-journal.js'
import type {SchemaAuthorCompilationInput} from './roleplay-mvu-schema-executor-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {RoleplayInputStateOwner,RoleplayInputStateRead} from './roleplay-input-state.js'

export interface SchemaFrozenOriginal {
  schemaVersion:1
  encoding:'native-mvu-schema-frozen-original-v1'
  sessionId:string
  preparation:MvuSchemaOpeningPreparation
  sourceSnapshot:MvuSchemaAuthorSource['snapshot']
  authorInput:SchemaAuthorCompilationInput
  programSha256:string
  realmEpoch:string
  originalSha256:string
}
export interface SchemaStorySourceFrame {
  schemaVersion:1
  encoding:'native-mvu-schema-story-source-frame-v1'
  sessionId:string
  material:MvuJsonObject
  materialSha256:string
  snapshot:MvuSchemaAuthorSource['snapshot']
  snapshotSha256:string
}
/** Read-only DATA suppliers for one synchronous Source-owned capture.
 * A supplied table or Native prefix cannot mint a live execution owner; the
 * actual Story/Tavern binder still owns currentness and publication. */
export interface SchemaCurrentOriginalRead {
  /** Original caller address; preparation does not choose the journal. */
  sessionId:string
  table:Pick<SchemaJournalTable,'get'|'entries'>
  events:readonly SessionEvent[]
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function fail(code:string):never {throw Error(code)}
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_SOURCE_INVALID'
const hash=(input:unknown)=>typeof input==='string'&&/^[a-f0-9]{64}$/.test(input)
function exact(input:object,keys:readonly string[]) {
  if(!same(Object.keys(input).sort(),[...keys].sort()))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
}
/** Bounded data validation only. A matching checksum does not establish the
 * original program, a current Source observation or publication permission. */
export function validateSchemaStorySourceFrame(input:SchemaStorySourceFrame):SchemaStorySourceFrame {
  try {
    const frame=cloneSchemaData(input,8*1048576),snapshot=frame.snapshot,material=frame.material
    exact(frame,['schemaVersion','encoding','sessionId','material','materialSha256','snapshot','snapshotSha256'])
    exact(material,['card','rows','openingContext'])
    cloneSchemaData(material,4*1048576)
    exact(snapshot,['schemaVersion','encoding','source','pointerSha256','importRecordSha256','coverageSha256','materialRows',
      'settings','bindings','selected','swipes','macroContext','documentSha256','snapshotSha256',
      ...Object.hasOwn(snapshot,'sourceProvenance')?['sourceProvenance']:[]])
    const {snapshotSha256,...body}=snapshot
    if(frame.schemaVersion!==1||frame.encoding!=='native-mvu-schema-story-source-frame-v1'
      ||typeof frame.sessionId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(frame.sessionId)
      ||snapshot.schemaVersion!==1||snapshot.encoding!=='native-mvu-author-source-snapshot-v1'
      ||snapshot.source.sessionId!==frame.sessionId||!hash(snapshotSha256)||recordSha256(body)!==snapshotSha256
      ||frame.snapshotSha256!==snapshotSha256||frame.materialSha256!==recordSha256(material)
      ||snapshot.documentSha256!==recordSha256(material.card)
      ||!Array.isArray(material.rows)||!Array.isArray(snapshot.materialRows)
      ||material.rows.length!==snapshot.materialRows.length||material.rows.length>4096) {
      fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    }
    const refs=new Map(snapshot.materialRows.map(ref=>[`${ref.table}:${ref.key}`,ref]))
    if(refs.size!==snapshot.materialRows.length)fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    const materialRefs=new Map(refs)
    for(const ref of refs.values())exact(ref,['table','key','exists','sha256'])
    for(const raw of material.rows) {
      if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
      const row=raw as {table:string;key:string;exists:boolean;value:unknown}
      exact(row,['table','key','exists','value'])
      const ref=refs.get(`${row.table}:${row.key}`)
      if(!ref||!['branch','cards','worldbook','rules','status','opening'].includes(row.table)
        ||!row.key.startsWith(`${frame.sessionId}__`)||typeof row.exists!=='boolean'||ref.exists!==row.exists
        ||!row.exists&&row.value!==null||ref.sha256!==recordSha256(row.exists?row.value:undefined)) {
        fail('SCHEMA_CURRENT_MATERIAL_INVALID')
      }
      if((row.table==='branch'&&row.key!==`${frame.sessionId}__settings`)
        ||(row.table==='rules'&&row.key!==`${frame.sessionId}__spec`)
        ||(row.table==='status'&&row.key!==`${frame.sessionId}__spec`)
        ||(row.table==='opening'&&row.key!==`${frame.sessionId}__scene`))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
      refs.delete(`${row.table}:${row.key}`)
    }
    if(refs.size)fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    exact(snapshot.settings,['cards','worldbook','rules','settings','membershipSha256'])
    const {membershipSha256,...membership}=snapshot.settings
    if(membershipSha256!==recordSha256(membership))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    for(const table of ['cards','worldbook'] as const) {
      const declared=snapshot.settings[table]
      const actual=Object.fromEntries([...materialRefs.values()].filter(ref=>ref.table===table&&ref.exists)
        .map(ref=>[ref.key.slice(frame.sessionId.length+2),ref.sha256]))
      if(!same(actual,declared))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    }
    if(snapshot.settings.rules!==materialRefs.get(`rules:${frame.sessionId}__spec`)?.sha256
      ||snapshot.settings.settings!==materialRefs.get(`branch:${frame.sessionId}__settings`)?.sha256) {
      fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    }
    const context=material.openingContext
    if(!context||typeof context!=='object'||Array.isArray(context)
      ||Object.keys(context).some(key=>!['user','char','user_gender'].includes(key))
      ||Object.values(context).some(value=>typeof value!=='string'||value.length>512))fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    exact(snapshot.macroContext,['used','bindingSha256','valuesSha256'])
    if(typeof snapshot.macroContext.used!=='boolean'||(snapshot.macroContext.used
      ?!hash(snapshot.macroContext.bindingSha256)||snapshot.macroContext.valuesSha256!==recordSha256(context)
      :snapshot.macroContext.bindingSha256!==null||snapshot.macroContext.valuesSha256!==null)) {
      fail('SCHEMA_CURRENT_MATERIAL_INVALID')
    }
    return freezeSchemaJournalData(frame)
  } catch(error) {fail(codeOf(error))}
}

export function createRoleplayMvuSchemaSource(deps:MvuSourceDeps&{inputState:RoleplayInputStateOwner},markers:typeof mvuSchemaMarkers,
  projectPrefix?:WorldlineMessageEdits['projectPrefix']) {
  // This marks only immutable DATA constructed by this factory's complete
  // parser. Version/currentness and all captured results belong to inputState.
  // It cannot recreate a Native execution or a publication lease.
  const parsedOriginals=new WeakSet<SchemaFrozenOriginal>()
  const frameReads=new WeakMap<SchemaStorySourceFrame,{original:SchemaFrozenOriginal;
    read:RoleplayInputStateRead<SchemaStorySourceFrame>}>()
  function originalRecord(original:Pick<SchemaFrozenOriginal,'sourceSnapshot'>) {
    const source=original.sourceSnapshot.source
    const record=deps.readImportRecord(source.sourceRecordSessionId,source.importId)
    if(recordSha256(record)!==original.sourceSnapshot.importRecordSha256)fail('SCHEMA_ORIGINAL_SOURCE_CHANGED')
    return record
  }
  function historicalDeps(snapshot:MvuSchemaAuthorSource['snapshot'],material:MvuJsonObject):MvuSourceDeps {
    const sid=snapshot.source.sessionId
    const rows=material.rows
    if(!Array.isArray(rows)||!same(Object.keys(material).sort(),['card','openingContext','rows'])) {
      fail('SCHEMA_FROZEN_MATERIAL_INVALID')
    }
    const byKey=new Map<string,{exists:boolean;value:unknown}>()
    for(const raw of rows) {
      if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('SCHEMA_FROZEN_MATERIAL_INVALID')
      const row=raw as {table:string;key:string;exists:boolean;value:unknown}
      if(!same(Object.keys(row).sort(),['exists','key','table','value'])||typeof row.exists!=='boolean'
        ||typeof row.table!=='string'||typeof row.key!=='string'||!row.key.startsWith(`${sid}__`)) {
        fail('SCHEMA_FROZEN_MATERIAL_INVALID')
      }
      const key=`${row.table}:${row.key}`
      if(byKey.has(key)||!row.exists&&row.value!==null)fail('SCHEMA_FROZEN_MATERIAL_INVALID')
      byKey.set(key,row)
    }
    // These are recorded inputs for historical reconstruction, not today's row
    // reads. The real immutable ImportRecord still supplies envelope/coverage.
    return {...deps,
      readActivePointer:()=>snapshot.source.pointer,
      readImportRecord:()=>originalRecord({sourceSnapshot:snapshot}),
      readRow:(table,key)=>{
        const row=byKey.get(`${table}:${key}`)
        if(!row)fail('SCHEMA_FROZEN_MATERIAL_INVALID')
        return row.exists?row.value:undefined
      },
      recordVersionsFor:()=>snapshot.settings,
      readOpeningContext:()=>({context:material.openingContext as {user?:string;char?:string;user_gender?:string},
        bindingSha256:snapshot.macroContext.bindingSha256??recordSha256({})}),
      readFreshNativeBasis:()=>{fail('SCHEMA_FRESH_BASIS_UNSUPPORTED')},
    }
  }
  function reconstruct(preparation:MvuSchemaOpeningPreparation,material:MvuJsonObject):MvuSchemaAuthorSource {
    const snapshot=preparation.sourceSnapshot,sid=preparation.identity.sessionId
    const historical=historicalDeps(snapshot,material)
    const found=createRoleplayMvuSource(historical).readSchemaOpeningData(sid,preparation.identity.index)
    if(found.kind!=='schema-opening-data'||!same(found.authorSource.snapshot,snapshot)
      ||!same(found.authorSource.material,material)
      ||found.authorSource.authorSourceSha256!==preparation.authorSourceSha256)fail('SCHEMA_ORIGINAL_SOURCE_UNPROVEN')
    // Equal parsed values cannot prove the original raw entry identity, source
    // pointer, rendering bytes or grammar. Compare the complete real descriptor.
    if(!same(found.initSource,preparation.initSource))fail('SCHEMA_ORIGINAL_INIT_SOURCE_UNPROVEN')
    return found.authorSource
  }
  function readFrozenOriginal(input:MvuSchemaOpeningPreparation,ready:SchemaJournalReady,
    actualEvents:readonly SessionEvent[]):SchemaFrozenOriginal {
    try {
      const preparation=validateMvuSchemaOpeningPreparation(input),sid=preparation.identity.sessionId
      const records=new Map(ready.frozen.records.map(row=>[row.key,row.record]))
      const journal=createRoleplayMvuSchemaJournal({markers,table:{
        get:key=>records.get(key),entries:()=>records.entries(),put:async()=>{fail('SCHEMA_SOURCE_READ_ONLY')},
      }})
      if(ready.frozen.nativeCut>actualEvents.length)fail('SCHEMA_NATIVE_CUT_UNPROVEN')
      const cut=actualEvents.slice(0,ready.frozen.nativeCut)
      const actual=journal.validateFrozenReady(ready.frozen,cut)
      if(actual.frozen.sessionId!==sid||actual.frozen.realmEpoch!==preparation.realmEpoch
        ||!same(actual,ready))fail('SCHEMA_NATIVE_CUT_UNPROVEN')
      // An external frozen input always performs its own complete recovery read.
      return originalFromCheckedJournal(preparation,actual,actualEvents)
    } catch(error) {fail(codeOf(error))}
  }
  // Only the two owned capture/validation paths below reach this constructor.
  // It never accepts a caller's ready/seal/token as proof of checked grammar.
  function originalFromCheckedJournal(preparation:MvuSchemaOpeningPreparation,actual:SchemaJournalReady,
    actualEvents:readonly SessionEvent[]):SchemaFrozenOriginal {
    const sid=preparation.identity.sessionId
    const {epoch}=actual,first=actual.steps[0]!
    if(epoch.sessionId!==sid||epoch.realmEpoch!==preparation.realmEpoch
      ||epoch.schemaVersion!==preparation.schemaVersion
      ||preparation.schemaVersion!==1&&!same(preparation.executor,{compiler:epoch.program.compiler,
        bridge:epoch.program.bridge,libraries:epoch.program.libraries,runner:epoch.runner})
      ||first.dispatch.batchId!==preparation.selector.batchId
      ||!same(first.dispatch.sourceNativeCut.anchor,preparation.selector.anchor)
      ||first.dispatchMarker.seq!==preparation.freshNativeBasisProof.native.observedThroughSeq+1
      ||first.dispatch.sourceNativeCut.nativePrefixSha256!==preparation.freshNativeBasisProof.native.historyVersionSha256
      ||first.dispatch.sourceNativeCut.sourceSnapshotSha256!==preparation.sourceSnapshot.snapshotSha256) {
      fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
    }
    const author=reconstruct(preparation,epoch.program.source.material),binding=epoch.program.source
    const source=author.snapshot.source
    if(binding.ownerSessionId!==sid||binding.importId!==source.importId||binding.sourceSha256!==source.rawSha256
      ||binding.importRecordSha256!==author.snapshot.importRecordSha256
      ||binding.sourceSnapshotSha256!==author.snapshot.snapshotSha256||binding.materialSha256!==author.materialSha256
      ||!same(epoch.program.scripts.map(({imports:_imports,javascript:_js,javascriptSha256:_hash,...script})=>script),
        author.scripts))fail('SCHEMA_ORIGINAL_PROGRAM_UNPROVEN')
    const parsed=compileSchemaMvuInitData(preparation.initSource),load=epoch.loadFrame,frame=first.step.frame
    if(parsed.kind!=='parsed'||load.ownerSessionId!==sid||frame.ownerSessionId!==sid
      ||!same(load.material,author.material)||!same(frame.material,author.material)
      ||!same(load.values,parsed.values)||!same(load.context,parsed.context)
      ||!same(frame.input.values,parsed.values)||!same(frame.input.context,parsed.context)
      ||frame.input.phase!=='initialization'||frame.input.base!==null||frame.input.commands.length!==0
      ||load.sourceNativeCutSha256!==recordSha256(first.dispatch.sourceNativeCut)
      ||frame.sourceNativeCutSha256!==load.sourceNativeCutSha256
      ||load.clockEpochMs!==preparation.clockEpochMs||load.randomSeed!==preparation.randomSeed
      ||frame.input.clockEpochMs!==load.clockEpochMs||frame.input.randomSeed!==load.randomSeed) {
      fail('SCHEMA_ORIGINAL_LOAD_UNPROVEN')
    }
    let authorInput:SchemaAuthorCompilationInput
    if(epoch.schemaVersion===4) {
      const program=validateSchemaProgramV4(epoch.program)
      authorInput={schemaVersion:2,encoding:'native-mvu-author-compilation-input-v2',source:program.source,
        libraries:program.libraries,bridge:program.bridge,stateLoader:program.stateLoader,executionPlan:program.executionPlan,
        scripts:program.scripts.map(({javascript:_js,javascriptSha256:_hash,...script})=>script)}
    }else {
      if(epoch.program.schemaVersion!==1)fail('SCHEMA_ORIGINAL_PROGRAM_UNPROVEN')
      authorInput={schemaVersion:1,source:epoch.program.source,libraries:epoch.program.libraries,bridge:epoch.program.bridge,
        scripts:epoch.program.scripts.map(({javascript:_js,javascriptSha256:_hash,...script})=>script)}
    }
    if(preparation.schemaVersion===3||preparation.schemaVersion===4) {
      if(load.schemaVersion!==preparation.schemaVersion||frame.input.schemaVersion!==preparation.schemaVersion
        ||(load.schemaVersion!==3&&load.schemaVersion!==4)||(frame.input.schemaVersion!==3&&frame.input.schemaVersion!==4)
        ||!projectPrefix)fail('SCHEMA_ORIGINAL_SCOPE_UNPROVEN')
      const originalCut=first.dispatch.sourceNativeCut,scopeSource=schemaScopeSource(preparation.sourceSnapshot)
      const originalEvents=actualEvents.slice(0,originalCut.nativeCut)
      const expected=buildSchemaScopeReadFrame(scopeSource,recordSha256(originalCut),authorInput.scripts,
        schemaScopeInitialChat(preparation,author.material,originalCut),
        schemaScopeVisibleMessages(originalEvents,projectPrefix,scopeSource,()=>sid,new Map()))
      if(!same(load.scopeReadFrame,expected)||!same(frame.input.scopeReadFrame,expected)) {
        fail('SCHEMA_ORIGINAL_SCOPE_UNPROVEN')
      }
    }
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-frozen-original-v1' as const,sessionId:sid,
      preparation,sourceSnapshot:author.snapshot,authorInput,programSha256:epoch.program.programSha256,
      realmEpoch:epoch.realmEpoch}
    const original=freezeSchemaJournalData({...body,originalSha256:recordSha256(body)})
    parsedOriginals.add(original)
    return original
  }
  /** Capture and consume are one synchronous call. External/cold/fork frozen
   * inputs continue through readFrozenOriginal's complete frozen validation.
   * The central owner retains immutable Original data until its exact inputs change. */
  function captureCurrentOriginal(input:MvuSchemaOpeningPreparation,current:SchemaCurrentOriginalRead,
    historical=false):{ready:SchemaJournalReady;original:SchemaFrozenOriginal} {
    try {
      const preparation=validateMvuSchemaOpeningPreparation(input),sid=current.sessionId
      const journal=createRoleplayMvuSchemaJournal({markers,table:{
        get:key=>current.table.get(key),entries:()=>current.table.entries(),
        put:async()=>{fail('SCHEMA_SOURCE_READ_ONLY')},
      }})
      // Preserve actual inventory/get order and the first complete Native
      // fold. Historical edit cuts retain the existing raw inventory budget
      // and duplicate/future-row failure contract; no merge is introduced.
      const events=current.events
      const ready=historical
        ?journal.captureFrozen(sid,preparation.realmEpoch,events,journal.inventory(sid))
        :journal.capture(sid,preparation.realmEpoch,events)
      if(ready.kind!=='ready')fail(ready.code)
      // Join only after the original caller's inventory and Native checks, so
      // a foreign preparation cannot change journal addresses or first errors.
      if(ready.frozen.sessionId!==preparation.identity.sessionId
        ||ready.frozen.realmEpoch!==preparation.realmEpoch)fail('SCHEMA_NATIVE_CUT_UNPROVEN')
      const first=ready.steps[0]!,refs=[ready.epochRef,first.dispatchRef,first.completionRef],
        identity=recordSha256({preparation:preparation.preparationSha256,refs})
      const original=deps.inputState.captureOriginal(sid,identity,()=>{
        // The parsed journal is current, but the Original slot also needs exact
        // dependency reads. Future numerical output does not replace this root.
        for(const ref of refs)current.table.get(ref.key)
        deps.readActivePointer(sid)
        return originalFromCheckedJournal(preparation,ready,events)
      }).data
      parsedOriginals.add(original)
      return {ready,original}
    } catch(error) {fail(codeOf(error))}
  }
  /** Immutable author identity can be checked without consulting the parent's
   * current pointer. A verified child basis freezes this identity at its real
   * Native cut; later parent activation must not rewrite the child's program. */
  function originalFactsCurrent(original:SchemaFrozenOriginal):boolean {
    try {
      original=freezeSchemaJournalData(original)
      const {originalSha256,...body}=original
      exact(original,['schemaVersion','encoding','sessionId','preparation','sourceSnapshot','authorInput',
        'programSha256','realmEpoch','originalSha256'])
      validateMvuSchemaOpeningPreparation(original.preparation)
      if(original.schemaVersion!==1||original.encoding!=='native-mvu-schema-frozen-original-v1'
        ||recordSha256(body)!==originalSha256||original.sessionId!==original.preparation.identity.sessionId
        ||original.realmEpoch!==original.preparation.realmEpoch
        ||!same(original.sourceSnapshot,original.preparation.sourceSnapshot))return false
      const author=reconstruct(original.preparation,original.authorInput.source.material),source=author.snapshot.source
      if(!same(original.authorInput.source,{ownerSessionId:original.sessionId,importId:source.importId,
        sourceSha256:source.rawSha256,importRecordSha256:author.snapshot.importRecordSha256,
        sourceSnapshotSha256:author.snapshot.snapshotSha256,material:author.material,materialSha256:author.materialSha256})
        ||!same(original.authorInput.scripts.map(({imports:_imports,...script})=>script),author.scripts))return false
      return true
    } catch {return false}
  }
  function originalCurrent(original:SchemaFrozenOriginal):boolean {
    return originalFactsCurrent(original)
      &&same(deps.readActivePointer(original.sessionId),original.sourceSnapshot.source.pointer)
  }
  function sameAuthor(original:SchemaFrozenOriginal,author:MvuSchemaAuthorSource):boolean {
    const current=author.snapshot.source,source=original.sourceSnapshot.source
    const identity=['sourceRecordSessionId','importId','rawSha256','normalizedSha256','transactionId','coverageSha256'] as const
    return same(author.scripts,original.authorInput.scripts.map(({imports:_imports,...script})=>script))
      &&identity.every(key=>current[key]===source[key])
      &&author.snapshot.importRecordSha256===original.sourceSnapshot.importRecordSha256
      &&author.snapshot.documentSha256===original.sourceSnapshot.documentSha256
  }
  /** Reconstruct a recorded observation against the real immutable import. Its
   * captured row membership and macros are historical inputs; today's pointer
   * and material never supply authority for an old dispatch. */
  function verifyFrozenFrame(original:SchemaFrozenOriginal,input:SchemaStorySourceFrame):boolean {
    try {
      const frame=validateSchemaStorySourceFrame(input)
      if(!originalFactsCurrent(original))return false
      const found=readMvuSchemaCurrentAuthorSource(historicalDeps(frame.snapshot,frame.material),
        frame.sessionId,original.preparation.identity.index)
      return found.kind==='author-source'&&sameAuthor(original,found.source)
        &&same(found.source.snapshot,frame.snapshot)&&same(found.source.material,frame.material)
        &&found.source.materialSha256===frame.materialSha256
    }catch {return false}
  }
  function captureFrameRead(input:SchemaFrozenOriginal,sessionId:string):RoleplayInputStateRead<SchemaStorySourceFrame> {
    let original=input
    if(!parsedOriginals.has(original)) {
      // External DATA gets its own complete parser and actual Import check.
      // Do not brand a caller-owned mutable object as factory-produced DATA.
      original=freezeSchemaJournalData(original)
      if(!originalFactsCurrent(original))fail('SCHEMA_ORIGINAL_SOURCE_CHANGED')
    }
    return deps.inputState.captureSourceFrame(sessionId,original.originalSha256,()=>{
      const found=readMvuSchemaCurrentAuthorSource(deps,sessionId,original.preparation.identity.index)
      if(found.kind!=='author-source')fail('SCHEMA_CURRENT_MATERIAL_INVALID')
      const author=found.source
      if(!sameAuthor(original,author)||(sessionId===original.sessionId
        &&!same(deps.readActivePointer(sessionId),original.sourceSnapshot.source.pointer))) {
        fail('SCHEMA_ORIGINAL_SOURCE_CHANGED')
      }
      return validateSchemaStorySourceFrame({schemaVersion:1 as const,encoding:'native-mvu-schema-story-source-frame-v1' as const,
        sessionId,material:author.material,materialSha256:author.materialSha256,
        snapshot:author.snapshot,snapshotSha256:author.snapshot.snapshotSha256})
    })
  }
  function captureFrame(original:SchemaFrozenOriginal,sessionId=original.sessionId):SchemaStorySourceFrame {
    try {
      const read=captureFrameRead(original,sessionId)
      frameReads.set(read.data,{original,read})
      return read.data
    } catch(error) {fail(codeOf(error))}
  }
  function frameCurrent(original:SchemaFrozenOriginal,frame:SchemaStorySourceFrame):boolean {
    try {
      const known=frameReads.get(frame)
      if(known?.original===original)return known.read.current()
      const validated=validateSchemaStorySourceFrame(frame),read=captureFrameRead(original,validated.sessionId)
      if(!same(validated,read.data))return false
      // Caller-owned DTOs are DATA inputs, not the captured frame's identity.
      // Their comparison reads the central frame without reparsing Source.
      return read.current()
    } catch {return false}
  }
  return {readFrozenOriginal,captureCurrentOriginal,captureFrame,originalCurrent,
    originalFactsCurrent,frameCurrent,verifyFrozenFrame}
}
