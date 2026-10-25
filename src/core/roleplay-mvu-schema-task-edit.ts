/** Durable edit intent owns the short Source/Native append boundary. Schema
 * phases remain exclusively owned by the existing Story revision publisher. */
import {recordSha256} from './roleplay-data.js'
import {schemaTaskEditIntentKey,schemaTaskEditBindingKey,schemaTaskEditActiveKey,
  validateSchemaTaskEditIntent,validateSchemaTaskEditBindingV1,schemaExistingUserEditRecoveryIntentKey,
  validateSchemaExistingUserEditRecoveryIntentV1} from './roleplay-mvu-schema-task-edit-types.js'
import {SchemaTaskEditNotAppliedError} from './roleplay-mvu-schema-task-edit-types.js'
import type {SchemaTaskEditIntent,SchemaTaskEditBindingV1,SchemaTaskEditOptionsV1,
  SchemaTaskArtifactV1,SchemaTaskEditRecovery,SchemaTaskEditNotAppliedReason,SchemaExistingUserEditRecoveryRequest,
  SchemaExistingUserEditRecoveryIntentV1,SchemaExistingUserEditRequestOrigin} from './roleplay-mvu-schema-task-edit-types.js'
import type {ContextEvent} from './roleplay-context.js'
interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
type EditEvent=ContextEvent
interface SessionCut {id:string;seq?:number}
interface EditTarget {role:'user'|'assistant';seq:number;messageId:string;text:string;previousVersionSha256:string}
interface Facts {
  artifacts:readonly SchemaTaskArtifactV1[];sourceSha256:string;headSha256:string;nativeCut:number
  pendingStory:boolean;canReviseSettledCanonicalSuffix:boolean
}
export function createRoleplayMvuSchemaTaskEdits(deps:{status:Table;branch:Table&{delete(key:string):Promise<unknown>};
  withSourceLock<T>(sid:string,work:()=>Promise<T>):Promise<T>;
  facts(sid:string,target:Pick<EditTarget,'seq'|'role'|'messageId'>):Promise<Facts|undefined>;
  sourceSha256(sid:string):string;events(session:SessionCut):readonly EditEvent[];
  currentEditSeq(session:SessionCut,targetSeq:number):number|undefined;
  begin(sid:string):void;flush(session:SessionCut):Promise<void>;
  parse(text:string):{kind:string};}) {
  const activeRef=(sid:string)=>deps.branch.get(schemaTaskEditActiveKey(sid)) as {key:string;sha256:string}|undefined
  function intentAt(ref:{key:string;sha256:string}) {
    const intent=validateSchemaTaskEditIntent(deps.status.get(ref.key) as SchemaTaskEditIntent)
    if(recordSha256(intent)!==ref.sha256)throw Error('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
    return intent
  }
  function bindingFor(intent:SchemaTaskEditIntent) {
    const key=schemaTaskEditBindingKey(intent.sessionId,intent.operationId)
    const raw=deps.status.get(key)
    if(raw===undefined)return
    const binding=validateSchemaTaskEditBindingV1(raw as SchemaTaskEditBindingV1)
    if(binding.intent.key!==schemaTaskEditIntentKey(intent.sessionId,intent.operationId)
      ||binding.intent.sha256!==recordSha256(intent))throw Error('SCHEMA_TASK_EDIT_BINDING_UNPROVEN')
    return binding
  }
  function exactEdit(session:SessionCut,intent:SchemaTaskEditIntent):EditEvent|undefined {
    const event=deps.events(session)[intent.basis.nativeCut]
    if(!event)return
    const {target}=intent
    if(event.seq!==intent.basis.nativeCut||event.type!=='roleplay/message-edit'
      ||event.data?.targetSeq!==target.seq||event.data.messageId!==target.messageId
      ||event.data.role!==target.role||event.data.text!==target.text)
      return
    return event
  }
  function notAppliedReason(session:SessionCut,intent:SchemaTaskEditIntent):SchemaTaskEditNotAppliedReason|undefined {
    if(session.seq!==intent.basis.nativeCut)return 'native-cut-changed'
    if(deps.sourceSha256(session.id)!==intent.basis.sourceSha256)return 'source-changed'
  }
  async function clearOwnActive(sid:string,intent:SchemaTaskEditIntent) {
    const active=activeRef(sid)
    if(active?.key===schemaTaskEditIntentKey(sid,intent.operationId)&&active.sha256===recordSha256(intent))
      await deps.branch.delete(schemaTaskEditActiveKey(sid))
  }
  async function bind(session:SessionCut,intent:SchemaTaskEditIntent,event:EditEvent) {
    await deps.flush(session)
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-task-edit-binding-v1' as const,
      sessionId:session.id,intent:{key:schemaTaskEditIntentKey(session.id,intent.operationId),sha256:recordSha256(intent)},
      edit:{seq:event.seq,sha256:recordSha256(event)}}
    const binding=validateSchemaTaskEditBindingV1({...body,bindingSha256:recordSha256(body)})
    await deps.status.put(schemaTaskEditBindingKey(session.id,intent.operationId),binding)
    return binding
  }
  async function prepare(session:SessionCut,target:EditTarget,options:SchemaTaskEditOptionsV1):Promise<SchemaTaskEditIntent|undefined> {
    const requestSha256=recordSha256({target:{role:target.role,seq:target.seq,messageId:target.messageId,text:target.text},options})
    // A durable active write can lose its response before Native append. Direct
    // saves must retire that expired cut through the same owner as state reads.
    const recovery=activeRef(session.id)?await recover(session):undefined
    const ownRecovery=recovery?.intent.operationId===options.operationId?recovery:undefined
    const raw=ownRecovery?.intent??deps.status.get(schemaTaskEditIntentKey(session.id,options.operationId))
    if(raw!==undefined) {
      const intent=ownRecovery?.intent??validateSchemaTaskEditIntent(raw as SchemaTaskEditIntent)
      if(intent.requestSha256!==requestSha256)throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
      const applied=ownRecovery
        ?ownRecovery.kind==='matched'?ownRecovery.event:undefined
        :exactEdit(session,intent)
      // A bound edit proves the earlier save, not permission to replay its
      // effects over a later edit of this target (including unchanged prose).
      if(applied&&deps.currentEditSeq(session,target.seq)!==applied.seq)
        throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
      if(!applied) {
        const reason=ownRecovery
          ?ownRecovery.kind==='not-applied'?ownRecovery.reason:undefined
          :notAppliedReason(session,intent)
        if(reason)throw new SchemaTaskEditNotAppliedError(intent,reason)
      }
      return intent
    }
    if(activeRef(session.id))throw Error('SCHEMA_TASK_EDIT_PENDING')
    // Capture is read-only. Player fanout must finish every target's preflight
    // before creating any intent, active pointer or numerical invalidation.
    const facts=await deps.facts(session.id,target)
    if(facts?.pendingStory)throw Error('SCHEMA_TASK_EDIT_FANOUT_PENDING')
    if(!facts)return
    if(!facts.artifacts.length) {
      if(target.role!=='user')return
      if(options.target)throw Error('SCHEMA_TASK_EDIT_ARTIFACT_CHANGED')
      if(!facts.canReviseSettledCanonicalSuffix)throw Error('SCHEMA_TASK_EDIT_FANOUT_BASIS_UNAVAILABLE')
      const body={schemaVersion:2 as const,encoding:'native-mvu-schema-suffix-edit-intent-v2' as const,
        scope:'settled-canonical-suffix' as const,sessionId:session.id,operationId:options.operationId,
        requestSha256,target:{...target,role:'user' as const},options,artifacts:[] as const,
        basis:{nativeCut:facts.nativeCut,sourceSha256:facts.sourceSha256,headSha256:facts.headSha256}}
      return validateSchemaTaskEditIntent({...body,intentSha256:recordSha256(body)})
    }
    const parsed=target.role==='assistant'?deps.parse(target.text):undefined
    if(parsed?.kind==='rejected')throw Error('SCHEMA_TASK_EDIT_MALFORMED_UPDATE')
    const own=facts.artifacts.find(row=>row.canonicalSeq===target.seq)
    if(own&&!options.target)throw Error('SCHEMA_TASK_EDIT_TARGET_REQUIRED')
    if(options.target&&(!own||own.sourceEventRef.sha256!==options.target.expectedArtifactSha256))
      throw Error('SCHEMA_TASK_EDIT_ARTIFACT_CHANGED')
    const mode=options.target?.mode??'retain'
    if(own&&mode!=='replace'&&parsed?.kind!=='no-update')throw Error('SCHEMA_TASK_EDIT_REPLACE_REQUIRED')
    if(own&&mode==='replace'&&parsed?.kind!=='parsed')throw Error('SCHEMA_TASK_EDIT_UPDATE_REQUIRED')
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-task-edit-intent-v1' as const,
      sessionId:session.id,operationId:options.operationId,requestSha256,target,options,
      artifacts:facts.artifacts.map(artifact=>({canonicalSeq:artifact.canonicalSeq,artifact,
        mode:artifact===own?mode:'retain' as const})),
      basis:{nativeCut:facts.nativeCut,sourceSha256:facts.sourceSha256,headSha256:facts.headSha256}}
    return validateSchemaTaskEditIntent({...body,intentSha256:recordSha256(body)})
  }
  async function storeIntent(session:SessionCut,intent:SchemaTaskEditIntent) {
    const key=schemaTaskEditIntentKey(session.id,intent.operationId),raw=deps.status.get(key) as SchemaTaskEditIntent|undefined
    if(raw) {
      if(raw.intentSha256!==intent.intentSha256)throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
      return
    }
    await deps.status.put(key,intent)
  }
  const persistIntent=(session:SessionCut,intent:SchemaTaskEditIntent)=>
    deps.withSourceLock(session.id,()=>storeIntent(session,intent))
  async function activate(session:SessionCut,intent:SchemaTaskEditIntent) {
    const key=schemaTaskEditIntentKey(session.id,intent.operationId),active=activeRef(session.id)
    if(active&&active.key!==key)throw Error('SCHEMA_TASK_EDIT_PENDING')
    if(!active)await deps.branch.put(schemaTaskEditActiveKey(session.id),{schemaVersion:1,
      encoding:'native-mvu-schema-task-edit-active-v1',key,sha256:recordSha256(intent)})
  }
  async function append(session:SessionCut,intent:SchemaTaskEditIntent,append:()=>EditEvent):Promise<EditEvent> {
    return deps.withSourceLock(session.id,async()=>{
      await storeIntent(session,intent)
      const binding=bindingFor(intent)
      if(binding) {
        const event=exactEdit(session,intent)
        if(!event||event.seq!==binding.edit.seq||recordSha256(event)!==binding.edit.sha256)
          throw Error('SCHEMA_TASK_EDIT_BINDING_UNPROVEN')
        return event
      }
      let event=exactEdit(session,intent)
      await activate(session,intent)
      if(!event) {
        const reason=notAppliedReason(session,intent)
        if(reason) {
          await clearOwnActive(session.id,intent)
          throw new SchemaTaskEditNotAppliedError(intent,reason)
        }
        // Inbox splicing can append during activate's put. Denial and Native
        // append therefore share this final synchronous boundary.
        deps.begin(session.id)
        event=append()
      }else deps.begin(session.id)
      await bind(session,intent,event)
      return event
    })
  }
  async function recover(session:SessionCut):Promise<SchemaTaskEditRecovery|undefined> {
    if(!activeRef(session.id))return
    return deps.withSourceLock(session.id,async()=>{
      const ref=activeRef(session.id)
      if(!ref)return
      const intent=intentAt(ref),event=exactEdit(session,intent),binding=bindingFor(intent)
      if(binding&&(!event||binding.edit.seq!==event.seq||binding.edit.sha256!==recordSha256(event)))
        throw Error('SCHEMA_TASK_EDIT_BINDING_UNPROVEN')
      if(event) {
        if(!binding)await bind(session,intent,event)
        return {kind:'matched',intent,event}
      }
      const reason=notAppliedReason(session,intent)
      if(!reason)return {kind:'pending',intent}
      await clearOwnActive(session.id,intent)
      return {kind:'not-applied',intent,reason}
    })
  }
  async function complete(sid:string,editSeq:number,resolved=true) {
    const ref=activeRef(sid)
    if(!ref)return
    const intent=intentAt(ref),binding=bindingFor(intent)
    if(binding?.edit.seq!==editSeq)return
    // This is the revision owner's existing fold result. The intent owner
    // consumes it before acknowledging the save; it does not replay History.
    if(!resolved) {
      if(intent.schemaVersion===2)throw Error('SCHEMA_SUFFIX_EDIT_UNRESOLVED')
      return
    }
    await deps.branch.delete(schemaTaskEditActiveKey(sid))
  }
  async function prepareExistingUserEditRecovery(session:SessionCut,request:SchemaExistingUserEditRecoveryRequest,
    authorize:(edit:EditEvent,storedOrigin?:SchemaExistingUserEditRequestOrigin)=>SchemaExistingUserEditRequestOrigin) {
    return deps.withSourceLock(session.id,async()=>{
      if(activeRef(session.id))throw Error('SCHEMA_TASK_EDIT_PENDING')
      const key=schemaExistingUserEditRecoveryIntentKey(session.id,request.recoveryOperationId),raw=deps.status.get(key),
        stored=raw===undefined?undefined:validateSchemaExistingUserEditRecoveryIntentV1(raw as SchemaExistingUserEditRecoveryIntentV1)
      if(stored&&(stored.sessionId!==session.id||stored.save.key!==request.oldSaveRef.key
        ||stored.save.sha256!==request.oldSaveRef.sha256||stored.edit.seq!==request.editRef.seq
        ||stored.edit.sha256!==request.editRef.sha256))throw Error('SCHEMA_USER_EDIT_RECOVERY_OPERATION_CONFLICT')
      // A prior flush error can leave an exact live edit without a durable
      // anchor. The Native writer owns this barrier before the new DATA ref.
      await deps.flush(session)
      const events=deps.events(session),edit=events[request.editRef.seq]
      if(edit?.type!=='roleplay/message-edit'||edit.seq!==request.editRef.seq||edit.data?.role!=='user'
        ||recordSha256(edit)!==request.editRef.sha256
        ||deps.currentEditSeq(session,Number(edit.data.targetSeq))!==edit.seq)
        throw Error('SCHEMA_USER_EDIT_RECOVERY_TARGET_UNPROVEN')
      const origin=authorize(edit,stored?.requestOrigin)
      if(stored) {
        if(origin.sessionId!==stored.requestOrigin.sessionId||origin.seq!==stored.requestOrigin.seq
          ||origin.messageId!==stored.requestOrigin.messageId)throw Error('SCHEMA_USER_EDIT_RECOVERY_OPERATION_CONFLICT')
        return {intent:stored,ref:{key,sha256:recordSha256(stored)}}
      }
      const body={schemaVersion:1 as const,encoding:'native-mvu-user-edit-recovery-intent-v1' as const,
        operationId:request.recoveryOperationId,sessionId:session.id,save:request.oldSaveRef,requestOrigin:origin,
        edit:request.editRef,fence:{nativeCut:events.length,sourceSha256:deps.sourceSha256(session.id)}},
        intent=validateSchemaExistingUserEditRecoveryIntentV1({...body,intentSha256:recordSha256(body)})
      await deps.status.put(key,intent)
      return {intent,ref:{key,sha256:recordSha256(intent)}}
    })
  }
  return {prepare,persistIntent,append,recover,complete,bindingFor,prepareExistingUserEditRecovery}
}
