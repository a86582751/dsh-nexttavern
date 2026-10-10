/** Hot nomination of actual Native after-story messages under one unchanged
 * prepared work. Owns reference tokens only; never an inbox, body or cold grant. */
import {recordSha256} from './roleplay-data.js'
import type {NativeOwnedContinuationControlV1,NativeInputSupplementProposalV1,
  NativeInputSupplementV1,NativeDurableInputWorkReceiptV1,NativeInputRef}
  from '@deepseek-ai/dsh-agent-loop'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'

type Message=Parameters<NativeOwnedContinuationControlV1['steerOwnedContinuation']>[0]
export type OwnedContinuationResult=ReturnType<NativeOwnedContinuationControlV1['steerOwnedContinuation']>
export interface RoleplayContinuationScope {
  currency:InputPreparationCurrency
  checkpoint:NativeDurableInputWorkReceiptV1
}
interface Nomination {
  epoch:number
  currencySha256:string
  parentSha256:string
  turn:number
  messageId:string
  messageSha256:string
  purpose:'after-story'
  ref?:NativeInputRef
  claimSha256?:string
  blocked?:true
}
const blocked=(code:string)=>({kind:'blocked' as const,code})
const allow={kind:'allow' as const}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function purpose(message:Message,turn:number) {
  // Core's producer is outside Native's closed source union. Inspect the
  // actual producer fields without extending that upstream public union.
  const source=message.source as unknown as Record<string,unknown>|undefined
  return source?.kind==='roleplay-tasks'&&source.form==='phase'
    &&source.stage==='after-story'&&source.turn===turn
}

export function createRoleplayInputContinuation({current,checkCurrent}: {
  current():RoleplayContinuationScope|undefined
  checkCurrent():string|undefined
}) {
  let control:NativeOwnedContinuationControlV1|undefined,epoch=0,maintenance=false
  const tokens=new WeakMap<object,Nomination>(),active=new Set<object>()
  function close() {epoch++;maintenance=false;active.clear()}
  function scope() {
    try {
      if(!checkCurrent()) {
        const value=current()
        if(value?.currency.source.kind==='story'&&value.currency.snapshot)return value
      }
    } catch { /* Unknown observation cannot retain a nomination. */ }
    close()
    return undefined
  }
  function valid(token:object,parent:NativeDurableInputWorkReceiptV1,turn:number) {
    const entry=tokens.get(token),live=scope()
    return entry&&live&&!entry.blocked&&entry.epoch===epoch&&entry.turn===turn
      &&entry.parentSha256===recordSha256(parent)&&same(parent,live.checkpoint)
      &&entry.currencySha256===recordSha256(live.currency)?entry:undefined
  }
  function actual(entry:Nomination,ref:NativeInputRef,message:Message,turn:number) {
    return !!entry.ref&&same(entry.ref,ref)&&message.id===entry.messageId
      &&recordSha256(message)===entry.messageSha256&&ref.messageId===message.id
      &&ref.messageSha256===entry.messageSha256&&purpose(message,turn)
  }
  return {
    setControl(value:NativeOwnedContinuationControlV1) {control=value},
    close,
    ownsRefs(refs:readonly NativeInputRef[]) {
      return [...active].some(token=>{
        const entry=tokens.get(token)
        return entry?.ref&&refs.some(ref=>same(ref,entry.ref))
      })
    },
    isMaintenance() {return maintenance&&!!scope()},
    steer(message:Message,turn:number):OwnedContinuationResult {
      const live=scope()
      if(!live||!control||live.checkpoint.actualTurn!==turn||!purpose(message,turn)) {
        return blocked('INPUT_CONTINUATION_SCOPE_INVALID')
      }
      for(const nominated of active) {
        const prior=tokens.get(nominated)!
        if(prior.messageId===message.id)return {kind:'blocked',code:'INPUT_CONTINUATION_ALREADY_NOMINATED',
          ...(prior.ref?{insertedRef:structuredClone(prior.ref)}:{})}
      }
      const token=Object.freeze({}),entry:Nomination={epoch,currencySha256:recordSha256(live.currency),
        parentSha256:recordSha256(live.checkpoint),turn,messageId:message.id,
        messageSha256:recordSha256(message),purpose:'after-story'}
      tokens.set(token,entry);active.add(token)
      let result:OwnedContinuationResult
      try {result=control.steerOwnedContinuation(message,{parent:live.checkpoint,ownerToken:token})}
      catch {entry.blocked=true;return blocked('INPUT_CONTINUATION_INSERT_UNKNOWN')}
      const ref=result.kind==='inserted'?result.ref:result.insertedRef
      if(ref)entry.ref=structuredClone(ref)
      // A stop/reentrant Source change can happen inside the actual insertion.
      // Retain its ref fact; never issue another insertion to repair authority.
      if(result.kind==='blocked'||!valid(token,live.checkpoint,turn)||!entry.ref
        ||entry.ref.messageId!==message.id||entry.ref.messageSha256!==entry.messageSha256) {
        entry.blocked=true
        return {kind:'blocked',code:result.kind==='blocked'?result.code:'INPUT_CONTINUATION_REVOKED',
          ...(ref?{insertedRef:ref}:{})}
      }
      return result
    },
    recognize(input:NativeInputSupplementProposalV1) {
      const {proposal,nominations,parent,turn}=input
      if(!proposal.refs.length||proposal.target!=='next-step'||nominations.length!==proposal.refs.length
        ||proposal.messages.length!==proposal.refs.length||input.step<2||parent.actualTurn!==turn) {
        return blocked('INPUT_CONTINUATION_PROPOSAL_INVALID')
      }
      const unique=new Set<object>()
      for(let index=0;index<proposal.refs.length;index++) {
        const nomination=nominations[index]!,entry=valid(nomination.ownerToken,parent,turn)
        if(!entry||entry.claimSha256||unique.has(nomination.ownerToken)
          ||!same(nomination.ref,proposal.refs[index])
          ||!actual(entry,proposal.refs[index]!,proposal.messages[index]!,turn)) {
          return blocked('INPUT_CONTINUATION_NOMINATION_UNKNOWN')
        }
        unique.add(nomination.ownerToken)
      }
      return allow
    },
    check(input:NativeInputSupplementV1) {
      if(!input.claims.length||input.step<2||input.parent.actualTurn!==input.turn
        ||!same(input.proposal,input.claims.at(-1)!.claim.proposal))return blocked('INPUT_CONTINUATION_CLAIM_INVALID')
      const claimed:{entry:Nomination;sha256:string}[]=[],unique=new Set<object>()
      for(const owned of input.claims) {
        const {claim,ownerTokens}=owned,sha256=recordSha256(claim)
        if(claim.turn!==input.turn||claim.resumed||!claim.spliceSeqs.length
          ||!claim.refs.length||ownerTokens.length!==claim.refs.length||claim.messages.length!==claim.refs.length
          ||!same(claim.refs,claim.proposal.refs))return blocked('INPUT_CONTINUATION_CLAIM_INVALID')
        for(let index=0;index<claim.refs.length;index++) {
          const token=ownerTokens[index]!,entry=valid(token,input.parent,input.turn)
          if(!entry||unique.has(token)||entry.claimSha256&&entry.claimSha256!==sha256
            ||!actual(entry,claim.refs[index]!,claim.messages[index]!,input.turn)) {
            return blocked('INPUT_CONTINUATION_CLAIM_UNKNOWN')
          }
          unique.add(token);claimed.push({entry,sha256})
        }
      }
      // No partial consumption on a later invalid entry. Repeated checks of the
      // same actual claim are allowed; recognize never authorizes another claim.
      for(const {entry,sha256} of claimed)entry.claimSha256=sha256
      maintenance=true
      return allow
    },
  }
}
