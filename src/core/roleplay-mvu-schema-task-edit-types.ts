/** Message edits select completed task DATA; they never create a task lease. */
import {recordSha256} from './roleplay-data.js'
import type {SchemaJournalRef} from './roleplay-mvu-schema-journal.js'

export interface SchemaTaskEditOptionsV1 {
  schemaVersion:1
  operationId:string
  target?:{expectedArtifactSha256:string;mode:'retain'|'replace'|'clear'}
  suffix:'retain'
}
export interface SchemaTaskArtifactV1 {
  canonicalSeq:number
  originEventRef:SchemaJournalRef
  sourceEventRef:SchemaJournalRef
  effectiveKind:'patch'|'unchanged'|'cleared'
}
export interface SchemaTaskEditIntentV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-task-edit-intent-v1'
  sessionId:string
  operationId:string
  requestSha256:string
  target:{role:'user'|'assistant';seq:number;messageId:string;text:string;previousVersionSha256:string}
  options:SchemaTaskEditOptionsV1
  artifacts:readonly {canonicalSeq:number;artifact:SchemaTaskArtifactV1;mode:'retain'|'replace'|'clear'}[]
  basis:{nativeCut:number;sourceSha256:string;headSha256:string}
  intentSha256:string
}
export interface SchemaTaskEditBindingV1 {
  schemaVersion:1
  encoding:'native-mvu-schema-task-edit-binding-v1'
  sessionId:string
  intent:SchemaJournalRef
  edit:{seq:number;sha256:string}
  bindingSha256:string
}
export interface SchemaTaskRevisionSelectionV1 extends SchemaTaskArtifactV1 {
  mode:'retain'|'replace'|'clear'
  intent:SchemaJournalRef
  binding:SchemaJournalRef
}
export type SchemaTaskEditNotAppliedReason='native-cut-changed'|'source-changed'
export type SchemaTaskEditRecovery=
  |{kind:'matched';intent:SchemaTaskEditIntentV1;event:import('./roleplay-context.js').ContextEvent}
  |{kind:'pending';intent:SchemaTaskEditIntentV1}
  |{kind:'not-applied';intent:SchemaTaskEditIntentV1;reason:SchemaTaskEditNotAppliedReason}
export class SchemaTaskEditNotAppliedError extends Error {
  constructor(readonly intent:SchemaTaskEditIntentV1,readonly reason:SchemaTaskEditNotAppliedReason) {
    super('SCHEMA_TASK_EDIT_NOT_APPLIED')
  }
}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
function fail():never {throw Error('SCHEMA_TASK_EDIT_INVALID')}
function fields(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||keys.some(key=>!Object.hasOwn(value,key)))fail()
}
function ref(value:SchemaJournalRef) {
  fields(value,['key','sha256'])
  if(typeof value.key!=='string'||!value.key||!hash(value.sha256))fail()
}
export function validateSchemaTaskEditOptionsV1(value:unknown):SchemaTaskEditOptionsV1 {
  fields(value,['schemaVersion','operationId','suffix'])
  if(value.schemaVersion!==1||value.suffix!=='retain'||typeof value.operationId!=='string'
    ||!/^[A-Za-z0-9_-]{1,128}$/.test(value.operationId))fail()
  if(value.target!==undefined) {
    fields(value.target,['expectedArtifactSha256','mode'])
    if(!hash(value.target.expectedArtifactSha256)||!['retain','replace','clear'].includes(String(value.target.mode)))fail()
  }
  return {schemaVersion:1,operationId:value.operationId,suffix:'retain',
    ...(value.target?{target:{expectedArtifactSha256:value.target.expectedArtifactSha256 as string,
      mode:value.target.mode as 'retain'|'replace'|'clear'}}:{})}
}
export function validateSchemaTaskArtifactV1(value:SchemaTaskArtifactV1):SchemaTaskArtifactV1 {
  fields(value,['canonicalSeq','originEventRef','sourceEventRef','effectiveKind'])
  ref(value.originEventRef);ref(value.sourceEventRef)
  if(!Number.isSafeInteger(value.canonicalSeq)||value.canonicalSeq<0
    ||!['patch','unchanged','cleared'].includes(value.effectiveKind))fail()
  return value
}
export function validateSchemaTaskEditIntentV1(value:SchemaTaskEditIntentV1):SchemaTaskEditIntentV1 {
  fields(value,['schemaVersion','encoding','sessionId','operationId','requestSha256','target','options','artifacts','basis','intentSha256'])
  fields(value.target,['role','seq','messageId','text','previousVersionSha256'])
  fields(value.basis,['nativeCut','sourceSha256','headSha256'])
  validateSchemaTaskEditOptionsV1(value.options)
  const {intentSha256,...body}=value
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-task-edit-intent-v1'
    ||value.operationId!==value.options.operationId||typeof value.sessionId!=='string'
    ||!hash(value.requestSha256)||!hash(value.target.previousVersionSha256)
    ||!['user','assistant'].includes(value.target.role)||!Number.isSafeInteger(value.target.seq)
    ||typeof value.target.text!=='string'||typeof value.target.messageId!=='string'
    ||!Number.isSafeInteger(value.basis.nativeCut)||value.basis.nativeCut<=value.target.seq
    ||!hash(value.basis.sourceSha256)||!hash(value.basis.headSha256)
    ||!Array.isArray(value.artifacts)||!value.artifacts.length||recordSha256(body)!==intentSha256)fail()
  for(const row of value.artifacts as SchemaTaskEditIntentV1['artifacts']) {
    fields(row,['canonicalSeq','artifact','mode']);validateSchemaTaskArtifactV1(row.artifact)
    if(row.canonicalSeq!==row.artifact.canonicalSeq||row.canonicalSeq<value.target.seq
      ||!['retain','replace','clear'].includes(row.mode))fail()
  }
  return value
}
export function validateSchemaTaskEditBindingV1(value:SchemaTaskEditBindingV1):SchemaTaskEditBindingV1 {
  fields(value,['schemaVersion','encoding','sessionId','intent','edit','bindingSha256'])
  ref(value.intent);fields(value.edit,['seq','sha256'])
  const {bindingSha256,...body}=value
  if(value.schemaVersion!==1||value.encoding!=='native-mvu-schema-task-edit-binding-v1'
    ||typeof value.sessionId!=='string'||!Number.isSafeInteger(value.edit.seq)||!hash(value.edit.sha256)
    ||recordSha256(body)!==bindingSha256)fail()
  return value
}
export const schemaTaskEditIntentKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-task-edit-intent-${id}`
export const schemaTaskEditBindingKey=(sid:string,id:string)=>`${sid}__mvu-state-schema-task-edit-binding-${id}`
export const schemaTaskEditActiveKey=(sid:string)=>`${sid}__mvu-state-schema-task-edit-active`
