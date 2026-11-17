import {randomUUID} from 'node:crypto'
import {sha256} from './roleplay-data.js'
import type {NextTavernCardDocument} from './nexttavern-card.js'
import type {TextOnlyStoryMessageV1} from './roleplay-text-only-source.js'
import type {TextOnlyContinuationPreviewV1,TextOnlyContinuationResultV1} from './roleplay-extension-types.js'

export interface TextOnlyContinuationSnapshotV1 {
  readonly sourceSessionId:string
  readonly revision:string
  readonly document:NextTavernCardDocument
  readonly history:readonly TextOnlyStoryMessageV1[]
  readonly preview:Omit<TextOnlyContinuationPreviewV1,'ok'|'operationId'|'sourceSessionId'|'revision'>
  readonly model:{readonly provider:string;readonly model:string;readonly reasoningEffort?:string}|null
  readonly provenance:Readonly<Record<string,unknown>>
}
export interface TextOnlyContinuationSnapshotRecordV1 {
  readonly schemaVersion:1
  readonly encoding:'text-only-continuation-snapshot-v1'
  readonly operationId:string
  readonly sourceSessionId:string
  readonly childSessionId:string
  readonly snapshot:TextOnlyContinuationSnapshotV1
}
export type TextOnlyContinuationProgressV3={
  readonly schemaVersion:3
  readonly encoding:'text-only-continuation-operation-v3'
  readonly operationId:string
  readonly sourceSessionId:string
  readonly childSessionId:string
  readonly revision:string
  readonly completedStep:number
  readonly error?:string
}&({readonly status:'prepared';readonly completion?:never}
  |{readonly status:'ready';readonly completion:{
    readonly preview:TextOnlyContinuationSnapshotV1['preview']
    readonly provenance:TextOnlyContinuationSnapshotV1['provenance']
  }})
export type TextOnlyContinuationOperationV3=TextOnlyContinuationProgressV3&{
  readonly snapshot:TextOnlyContinuationSnapshotV1
}
interface Dependencies {
  table:{get(key:string):unknown;delete(key:string):unknown;
    put(key:string,value:TextOnlyContinuationProgressV3|TextOnlyContinuationSnapshotRecordV1):PromiseLike<unknown>}
  withLock<T>(operationId:string,work:()=>Promise<T>):Promise<T>
  capture(sessionId:string):Promise<{snapshot:TextOnlyContinuationSnapshotV1;assertCurrent():void}>
  reserveCatalog(operation:TextOnlyContinuationOperationV3):Promise<unknown>
  ensureNativeRoot(operation:TextOnlyContinuationOperationV3):Promise<unknown>
  importDocument(operation:TextOnlyContinuationOperationV3):Promise<unknown>
  writeHistory(operation:TextOnlyContinuationOperationV3):Promise<unknown>
  markCatalogReady(operation:TextOnlyContinuationOperationV3):Promise<unknown>
}
interface SourceRequest {sessionId:string;operationId:string}
interface ContinuationError extends Error {
  status:number
  code:string
  operationState?:'not-started'
}
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error)
const refusal=(status:number,code:string,message=code):ContinuationError=>Object.assign(new Error(message),{status,code})
const sourceChanged=()=>Object.assign(refusal(409,'TEXT_ONLY_SOURCE_CHANGED','源设定或已确认剧情已变化，请重新预览'),
  {operationState:'not-started' as const})
export const textOnlyContinuationOperationKeyV1=(operationId:string)=>'text_only_continuation_operation_'+sha256(operationId)
export const textOnlyContinuationSnapshotKeyV1=(operationId:string)=>'text_only_continuation_snapshot_'+sha256(operationId)

/** This owner freezes the one target and advances durable receipts. Native
 * creation, import, history and catalog owners supply idempotent real actions. */
export function createRoleplayTextOnlyContinuationV1(deps:Dependencies) {
  const steps=[deps.reserveCatalog,deps.ensureNativeRoot,deps.importDocument,deps.writeHistory,deps.markCatalogReady]
  let inspected:{operationId:string;sessionId:string;capture:Awaited<ReturnType<Dependencies['capture']>>}|undefined
  function read({sessionId,operationId}:{sessionId?:string;operationId:string}):TextOnlyContinuationProgressV3|undefined {
    const operation=deps.table.get(textOnlyContinuationOperationKeyV1(operationId)) as TextOnlyContinuationProgressV3|undefined
    if(!operation)return undefined
    if(operation.schemaVersion!==3||operation.encoding!=='text-only-continuation-operation-v3'
      ||operation.operationId!==operationId)throw refusal(500,'TEXT_ONLY_OPERATION_INVALID')
    if(sessionId!==undefined&&operation.sourceSessionId!==sessionId)
      throw refusal(409,'TEXT_ONLY_OPERATION_SOURCE_MISMATCH')
    return operation
  }
  function readSnapshot({sessionId,operationId}:SourceRequest,revision?:string) {
    const archived=deps.table.get(textOnlyContinuationSnapshotKeyV1(operationId)) as
      TextOnlyContinuationSnapshotRecordV1|undefined
    if(!archived)return undefined
    if(archived.schemaVersion!==1||archived.encoding!=='text-only-continuation-snapshot-v1'
      ||archived.operationId!==operationId||revision!==undefined&&archived.snapshot.revision!==revision)
      throw refusal(500,'TEXT_ONLY_SNAPSHOT_INVALID')
    if(archived.sourceSessionId!==sessionId||archived.snapshot.sourceSessionId!==sessionId)
      throw refusal(409,'TEXT_ONLY_OPERATION_SOURCE_MISMATCH')
    return archived
  }
  function readyTarget({operationId,childSessionId}:{operationId:string;childSessionId:string}) {
    const operation=read({operationId})
    if(operation?.status!=='ready'||operation.childSessionId!==childSessionId)return undefined
    return {revision:operation.revision,operationId:operation.operationId}
  }
  async function result(operation:TextOnlyContinuationProgressV3,preview:TextOnlyContinuationSnapshotV1['preview'])
    :Promise<TextOnlyContinuationResultV1> {
    if(operation.status==='ready') {
      // The ready receipt is self-contained before construction data is
      // removed. A failed delete stays ready and retries on status/prepare.
      try {await deps.table.delete(textOnlyContinuationSnapshotKeyV1(operation.operationId))} catch {}
    }
    const {omittedCount,historyMessages,draftText,attachmentCount}=preview
    return {ok:operation.status==='ready',operationId:operation.operationId,sourceSessionId:operation.sourceSessionId,
      childSessionId:operation.childSessionId,status:operation.status,omittedCount,historyMessages,draftText,attachmentCount,
      ...operation.error?{error:operation.error}:{}}
  }
  async function resume(initial:TextOnlyContinuationProgressV3,knownSnapshot?:TextOnlyContinuationSnapshotV1):Promise<TextOnlyContinuationResultV1> {
    let operation=initial
    if(operation.status==='ready')return result(operation,operation.completion.preview)
    let snapshot=knownSnapshot
    if(!snapshot) {
      const archived=readSnapshot({sessionId:operation.sourceSessionId,operationId:operation.operationId},operation.revision)
      if(!archived||archived.childSessionId!==operation.childSessionId)throw refusal(500,'TEXT_ONLY_SNAPSHOT_INVALID')
      snapshot=archived.snapshot
    }
    try {
      for(let step=operation.completedStep;step<steps.length;step++) {
        // Lost callback ACKs replay that owner's stable operation, never a new
        // target. A checkpoint is recorded only after its real owner returns.
        await steps[step]!({...operation,snapshot})
        const {completion:_completion,...progress}=operation
        const next:TextOnlyContinuationProgressV3=step+1===steps.length
          ?{...progress,completedStep:step+1,status:'ready',error:undefined,
            completion:{preview:snapshot.preview,provenance:snapshot.provenance}}
          :{...progress,completedStep:step+1,status:'prepared',error:undefined}
        await deps.table.put(textOnlyContinuationOperationKeyV1(operation.operationId),next)
        operation=next
      }
      return result(operation,snapshot.preview)
    } catch(error) {
      // A successful table commit may lose its ACK. Reuse that owner's actual
      // record before retaining an error, including an already-ready target.
      const observed=read({sessionId:operation.sourceSessionId,operationId:operation.operationId})!
      if(observed.status==='ready')return result(observed,observed.completion.preview)
      const pending:TextOnlyContinuationProgressV3={...observed,error:errorText(error)}
      await deps.table.put(textOnlyContinuationOperationKeyV1(operation.operationId),pending)
      return result(pending,snapshot.preview)
    }
  }
  async function start(archived:TextOnlyContinuationSnapshotRecordV1) {
    const {operationId,sourceSessionId,childSessionId,snapshot}=archived,
      operation:TextOnlyContinuationProgressV3={schemaVersion:3,encoding:'text-only-continuation-operation-v3',
        operationId,sourceSessionId,childSessionId,status:'prepared',completedStep:0,revision:snapshot.revision}
    // The archive already owns this child, including a lost archive ACK. No
    // Native/catalog step starts until the compact progress write succeeds.
    await deps.table.put(textOnlyContinuationOperationKeyV1(operationId),operation)
    return resume(operation,snapshot)
  }
  async function inspect({sessionId}:{sessionId:string}):Promise<TextOnlyContinuationPreviewV1> {
    const capture=await deps.capture(sessionId)
    if(capture.snapshot.sourceSessionId!==sessionId)throw refusal(409,'TEXT_ONLY_CAPTURE_SOURCE_MISMATCH')
    try {capture.assertCurrent()} catch {throw sourceChanged()}
    const operationId=randomUUID()
    inspected={operationId,sessionId,capture}
    return {...capture.snapshot.preview,ok:true,operationId,sourceSessionId:sessionId,
      revision:capture.snapshot.revision}
  }
  const prepare=(request:SourceRequest&{expectedRevision:string})=>deps.withLock(request.operationId,async()=>{
    const latest=inspected,matching=latest?.operationId===request.operationId&&latest.sessionId===request.sessionId
    if(matching)inspected=undefined
    const existing=read(request)
    if(existing)return resume(existing)
    const retained=readSnapshot(request)
    if(retained)return start(retained)
    let capture:Awaited<ReturnType<Dependencies['capture']>>|undefined
    if(matching&&latest.capture.snapshot.revision===request.expectedRevision) {
      try {latest.capture.assertCurrent();capture=latest.capture} catch {}
    }
    if(!capture) {
      capture=await deps.capture(request.sessionId)
      try {capture.assertCurrent()} catch {throw sourceChanged()}
    }
    const snapshot=capture.snapshot
    if(snapshot.sourceSessionId!==request.sessionId)throw refusal(409,'TEXT_ONLY_CAPTURE_SOURCE_MISMATCH')
    if(snapshot.revision!==request.expectedRevision)throw sourceChanged()
    const archived:TextOnlyContinuationSnapshotRecordV1={schemaVersion:1,encoding:'text-only-continuation-snapshot-v1',
      operationId:request.operationId,sourceSessionId:request.sessionId,childSessionId:'session-'+randomUUID(),snapshot}
    await deps.table.put(textOnlyContinuationSnapshotKeyV1(request.operationId),archived)
    return start(archived)
  })
  const status=(request:SourceRequest)=>deps.withLock(request.operationId,async()=>{
    const operation=read(request)
    if(operation)return resume(operation)
    const archived=readSnapshot(request)
    if(archived)return start(archived)
    throw refusal(404,'TEXT_ONLY_OPERATION_NOT_FOUND')
  })
  return {inspect,prepare,status,readyTarget}
}

interface RouteContext {
  effect(setup:()=>unknown,label:string):unknown
  connection:{fetch:{register(route:unknown):unknown}}
}
export function registerRoleplayTextOnlyContinuation({ctx,owner}:{
  ctx:RouteContext;owner:ReturnType<typeof createRoleplayTextOnlyContinuationV1>
}) {
  ctx.effect(()=>ctx.connection.fetch.register({requestBody:'buffered',path:'/api/roleplay/text-only-continuation',
    methods:['POST'],fetch:async(request:Request)=>{
      let body:Record<string,unknown>
      try {body=await request.json() as Record<string,unknown>}
      catch {return Response.json({ok:false,code:'TEXT_ONLY_REQUEST_INVALID',error:'请求体必须是 JSON'},{status:400})}
      if(!body||typeof body.sessionId!=='string'||!body.sessionId)
        return Response.json({ok:false,code:'TEXT_ONLY_REQUEST_INVALID',error:'缺少来源 Session ID'},{status:400})
      const sessionId=body.sessionId
      try {
        if(body.action==='inspect')return Response.json(await owner.inspect({sessionId}))
        if(typeof body.operationId!=='string'||!body.operationId)
          return Response.json({ok:false,code:'TEXT_ONLY_REQUEST_INVALID',error:'缺少操作 ID'},{status:400})
        const operationId=body.operationId
        if(body.action==='status')return Response.json(await owner.status({sessionId,operationId}))
        if(body.action!=='prepare'||typeof body.expectedRevision!=='string')
          return Response.json({ok:false,code:'TEXT_ONLY_REQUEST_INVALID',error:'纯文字续玩操作无效'},{status:400})
        return Response.json(await owner.prepare({sessionId,operationId,expectedRevision:body.expectedRevision}))
      } catch(error) {
        const failure=error as Partial<ContinuationError>
        return Response.json({ok:false,code:failure.code??'TEXT_ONLY_PREPARATION_UNAVAILABLE',
          error:errorText(error),...failure.operationState?{operationState:failure.operationState}:{}},
        {status:failure.status??500})
      }
    }}),'roleplay: text-only continuation')
}
