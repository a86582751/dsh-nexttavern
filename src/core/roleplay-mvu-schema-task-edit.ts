/** Durable edit intent owns the short Source/Native append boundary. Schema
 * phases remain exclusively owned by the existing Story revision publisher. */
import {recordSha256} from './roleplay-data.js'
import {schemaTaskEditIntentKey,schemaTaskEditBindingKey,schemaTaskEditActiveKey,
  validateSchemaTaskEditIntentV1,validateSchemaTaskEditBindingV1} from './roleplay-mvu-schema-task-edit-types.js'
import {SchemaTaskEditNotAppliedError} from './roleplay-mvu-schema-task-edit-types.js'
import type {SchemaTaskEditIntentV1,SchemaTaskEditBindingV1,SchemaTaskEditOptionsV1,
  SchemaTaskArtifactV1,SchemaTaskEditRecovery,SchemaTaskEditNotAppliedReason} from './roleplay-mvu-schema-task-edit-types.js'
import type {ContextEvent} from './roleplay-context.js'
interface Table {get(key:string):unknown;put(key:string,value:unknown):Promise<unknown>}
type EditEvent=ContextEvent
interface SessionCut {id:string;seq?:number}
interface EditTarget {role:'user'|'assistant';seq:number;messageId:string;text:string;previousVersionSha256:string}
interface Facts {
  artifacts:readonly SchemaTaskArtifactV1[];sourceSha256:string;headSha256:string;nativeCut:number
  pendingStory:boolean
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
    const intent=validateSchemaTaskEditIntentV1(deps.status.get(ref.key) as SchemaTaskEditIntentV1)
    if(recordSha256(intent)!==ref.sha256)throw Error('SCHEMA_TASK_EDIT_INTENT_UNPROVEN')
    return intent
  }
  function bindingFor(intent:SchemaTaskEditIntentV1) {
    const key=schemaTaskEditBindingKey(intent.sessionId,intent.operationId)
    const raw=deps.status.get(key)
    if(raw===undefined)return
    const binding=validateSchemaTaskEditBindingV1(raw as SchemaTaskEditBindingV1)
    if(binding.intent.key!==schemaTaskEditIntentKey(intent.sessionId,intent.operationId)
      ||binding.intent.sha256!==recordSha256(intent))throw Error('SCHEMA_TASK_EDIT_BINDING_UNPROVEN')
    return binding
  }
  function exactEdit(session:SessionCut,intent:SchemaTaskEditIntentV1):EditEvent|undefined {
    const event=deps.events(session)[intent.basis.nativeCut]
    if(!event)return
    const {target}=intent
    if(event.seq!==intent.basis.nativeCut||event.type!=='roleplay/message-edit'
      ||event.data?.targetSeq!==target.seq||event.data.messageId!==target.messageId
      ||event.data.role!==target.role||event.data.text!==target.text)
      return
    return event
  }
  function notAppliedReason(session:SessionCut,intent:SchemaTaskEditIntentV1):SchemaTaskEditNotAppliedReason|undefined {
    if(session.seq!==intent.basis.nativeCut)return 'native-cut-changed'
    if(deps.sourceSha256(session.id)!==intent.basis.sourceSha256)return 'source-changed'
  }
  async function clearOwnActive(sid:string,intent:SchemaTaskEditIntentV1) {
    const active=activeRef(sid)
    if(active?.key===schemaTaskEditIntentKey(sid,intent.operationId)&&active.sha256===recordSha256(intent))
      await deps.branch.delete(schemaTaskEditActiveKey(sid))
  }
  async function bind(session:SessionCut,intent:SchemaTaskEditIntentV1,event:EditEvent) {
    await deps.flush(session)
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-task-edit-binding-v1' as const,
      sessionId:session.id,intent:{key:schemaTaskEditIntentKey(session.id,intent.operationId),sha256:recordSha256(intent)},
      edit:{seq:event.seq,sha256:recordSha256(event)}}
    const binding=validateSchemaTaskEditBindingV1({...body,bindingSha256:recordSha256(body)})
    await deps.status.put(schemaTaskEditBindingKey(session.id,intent.operationId),binding)
    return binding
  }
  async function prepare(session:SessionCut,target:EditTarget,options:SchemaTaskEditOptionsV1):Promise<SchemaTaskEditIntentV1|undefined> {
    const requestSha256=recordSha256({target:{role:target.role,seq:target.seq,messageId:target.messageId,text:target.text},options})
    // A durable active write can lose its response before Native append. Direct
    // saves must retire that expired cut through the same owner as state reads.
    const recovery=activeRef(session.id)?await recover(session):undefined
    const ownRecovery=recovery?.intent.operationId===options.operationId?recovery:undefined
    const raw=ownRecovery?.intent??deps.status.get(schemaTaskEditIntentKey(session.id,options.operationId))
    if(raw!==undefined) {
      const intent=ownRecovery?.intent??validateSchemaTaskEditIntentV1(raw as SchemaTaskEditIntentV1)
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
    if(!facts?.artifacts.length)return
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
    return validateSchemaTaskEditIntentV1({...body,intentSha256:recordSha256(body)})
  }
  async function storeIntent(session:SessionCut,intent:SchemaTaskEditIntentV1) {
    const key=schemaTaskEditIntentKey(session.id,intent.operationId),raw=deps.status.get(key) as SchemaTaskEditIntentV1|undefined
    if(raw) {
      if(raw.intentSha256!==intent.intentSha256)throw Error('SCHEMA_TASK_EDIT_OPERATION_CONFLICT')
      return
    }
    await deps.status.put(key,intent)
  }
  const persistIntent=(session:SessionCut,intent:SchemaTaskEditIntentV1)=>
    deps.withSourceLock(session.id,()=>storeIntent(session,intent))
  async function activate(session:SessionCut,intent:SchemaTaskEditIntentV1) {
    const key=schemaTaskEditIntentKey(session.id,intent.operationId),active=activeRef(session.id)
    if(active&&active.key!==key)throw Error('SCHEMA_TASK_EDIT_PENDING')
    if(!active)await deps.branch.put(schemaTaskEditActiveKey(session.id),{schemaVersion:1,
      encoding:'native-mvu-schema-task-edit-active-v1',key,sha256:recordSha256(intent)})
  }
  async function append(session:SessionCut,intent:SchemaTaskEditIntentV1,append:()=>EditEvent):Promise<EditEvent> {
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
  async function complete(sid:string,editSeq:number) {
    const ref=activeRef(sid)
    if(!ref)return
    const intent=intentAt(ref),binding=bindingFor(intent)
    if(binding?.edit.seq===editSeq)await deps.branch.delete(schemaTaskEditActiveKey(sid))
  }
  return {prepare,persistIntent,append,recover,complete,bindingFor}
}
