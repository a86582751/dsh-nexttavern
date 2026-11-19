import {jsonResponse} from './roleplay-state.js'
import {parseAuthorWorldbookEditorRequestV1} from './roleplay-author-worldbook-editor.js'
import type {TavernLoreEditorRefusalV1,TavernLoreEditorReplyV1,TavernLoreEditorRouteDependenciesV1,
  TavernLoreEditorFailureDetailsV1,TavernLoreEditorSessionScopeV1,TavernLoreEditorCodeV1,TavernLoreEditorRequestV1}
  from './roleplay-tavern-lore-editor-types.js'

const SID=/^[a-zA-Z0-9_-]{1,128}$/
const preWriteCodes=new Set(['REQUEST_INVALID','REQUEST_DATA_INVALID','SOURCE_UNAVAILABLE','SOURCE_CHANGED',
  'SOURCE_IDENTITY_INVALID','DATA_BUDGET','REVISION_MISMATCH','ENTRY_LINK_INVALID','FIELDS_INVALID'])
function refusalDetails(refusal:TavernLoreEditorRefusalV1):TavernLoreEditorFailureDetailsV1 {
  if(refusal.receipt)return {phase:'after-store',outcome:'edited-unconfirmed',receipt:refusal.receipt,refusal}
  if(refusal.outcome)return {phase:'after-store',outcome:refusal.outcome,refusal}
  const unknown=refusal.diagnostics.some(d=>d.recovery||d.code.endsWith('WRITE_UNKNOWN'))
  const noWrite=!unknown&&refusal.diagnostics.length>0&&refusal.diagnostics.every(d=>preWriteCodes.has(d.code))
  return {phase:'after-store',outcome:unknown?'unknown':noWrite?'no-write':'refused',refusal}
}
function status(code:TavernLoreEditorCodeV1):number {
  if(code==='LORE_EDITOR_BODY_INVALID'||code==='REQUEST_INVALID'||code==='REQUEST_DATA_INVALID')return 400
  if(code==='LORE_EDITOR_BODY_LIMIT'||code==='DATA_BUDGET')return 413
  if(code==='LORE_EDITOR_SESSION_UNAVAILABLE')return 404
  if(code==='WRITE_UNKNOWN'||code==='LORE_EDITOR_WRITE_UNKNOWN'||code==='LORE_EDITOR_READ_UNAVAILABLE'
    ||code==='STORAGE_READ_FAILED'||code==='AUTHOR_WORLDBOOK_WRITE_UNKNOWN'||code==='SOURCE_UNAVAILABLE')return 503
  return 409
}
function failed(code:TavernLoreEditorCodeV1,details:TavernLoreEditorFailureDetailsV1,
  error='暂时无法保存结构化世界书；请保留本次修改并重新确认'):Response {
  return jsonResponse(status(code),{schemaVersion:1,ok:false,code,error,details} satisfies TavernLoreEditorReplyV1)
}
function captureScopeCheck(scope:TavernLoreEditorSessionScopeV1,sid:string):()=>void {
  if(scope.sessionId!==sid||typeof scope.assertCurrent!=='function')throw Error('scope-mismatch')
  const assertion=scope.assertCurrent
  return ()=>{
    if(scope.sessionId!==sid||scope.assertCurrent!==assertion)throw Error('scope-binding-changed')
    const result:unknown=assertion.call(scope)
    if(result!==undefined)throw Error('scope-assertion-must-be-synchronous')
  }
}
/** The actual Workspace supplier establishes scope. Browser bodies select no
 * reader, table, lock or permission. Store retains its own Source/write checks. */
export function registerTavernLoreEditorRoutesV1(deps:TavernLoreEditorRouteDependenciesV1):void {
  deps.ctx.effect(()=>deps.ctx.connection.fetch.register({requestBody:'buffered',
    path:'/api/roleplay/tavern-lore-editor',methods:['GET','POST'],fetch:async request=>{
      let calledStore=false
      let attemptedWrite=false
      let result:Awaited<ReturnType<typeof deps.store.observe>>|Awaited<ReturnType<typeof deps.store.edit>>|undefined
      try {
        const url=new URL(request.url)
        let body:TavernLoreEditorRequestV1|undefined
        if(request.method==='POST') {
          const text=await request.text()
          if(Buffer.byteLength(text,'utf8')>1_048_576)
            return failed('LORE_EDITOR_BODY_LIMIT',{phase:'before-store',outcome:'no-write'},'世界书修改过大')
          try {
            body=parseAuthorWorldbookEditorRequestV1(JSON.parse(text))
          }
          catch {return failed('LORE_EDITOR_BODY_INVALID',{phase:'before-store',outcome:'no-write'},'世界书请求格式无效')}
        }
        const sid=body?.sessionId??url.searchParams.get('sessionId')
        if(typeof sid!=='string'||!SID.test(sid))return failed('LORE_EDITOR_BODY_INVALID',
          {phase:'before-store',outcome:'no-write'},'请选择有效会话')
        const scope=await deps.resolveSessionScope(sid)
        if(!scope)return failed('LORE_EDITOR_SESSION_UNAVAILABLE',{phase:'before-store',outcome:'no-write'},
          '当前工作区会话不可访问')
        let check:()=>void
        try {check=captureScopeCheck(scope,sid);check()} catch {return failed('LORE_EDITOR_SCOPE_CHANGED',
          {phase:'before-store',outcome:'no-write'},'会话选择已变化，请重新加载')}
        calledStore=true
        attemptedWrite=body!==undefined
        result=!body?await deps.store.observe(scope.sessionId):await deps.store.edit(body,()=>{
          try {check();return true} catch {return false}
        })
        // This assertion never retries or adds a write. An already durable edit
        // is an unconfirmed outcome after scope loss; preserve its exact fact.
        try {check()} catch {
          const details:TavernLoreEditorFailureDetailsV1=result.kind==='refused'
            ?{...refusalDetails(result),phase:'after-store'}
            :result.kind==='edited-data'?{phase:'after-store',outcome:'edited-unconfirmed',receipt:result.receipt}
              :{phase:'after-store',outcome:'refused'}
          return failed('LORE_EDITOR_SCOPE_CHANGED',details,'会话选择已变化；本次结果需重新确认')
        }
        if(result.kind==='refused')return failed(result.diagnostics[0]?.code??'STORAGE_READ_FAILED',refusalDetails(result))
        const editor=result.editor
        if(editor.sessionId!==scope.sessionId)throw Error('editor-scope-mismatch')
        return jsonResponse(200,{schemaVersion:1,ok:true,editor,
          ...(result.kind==='edited-data'?{receipt:result.receipt}:{})} satisfies TavernLoreEditorReplyV1)
      } catch {
        // Never interpolate a Source/archive/body into an HTTP error. Unknown
        // thrown transport outcomes keep the pending payload recoverable.
        const details:TavernLoreEditorFailureDetailsV1=result?.kind==='refused'?refusalDetails(result)
          :result?.kind==='edited-data'?{phase:'after-store',outcome:'edited-unconfirmed',receipt:result.receipt}
            :{phase:calledStore?'after-store':'before-store',outcome:calledStore?'unknown':'no-write'}
        return failed(calledStore&&attemptedWrite?'LORE_EDITOR_WRITE_UNKNOWN':'LORE_EDITOR_READ_UNAVAILABLE',details)
      }
    },
  }),'roleplay: append-only structured lore editor')
}
