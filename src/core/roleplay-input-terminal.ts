/** Hot terminal permission over one actual original Native work. The input
 * owner alone persists its intent/stop/settlement. No Source lock, input queue,
 * table writer or reconstructed cold permission belongs to this module. */
import {recordSha256} from './roleplay-data.js'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'
import type {NativeCompletedInputWorkReceiptV1,NativeDurableInputWorkReceiptV1}
  from '@deepseek-ai/dsh-agent-loop'
import type {MvuStateTerminalIntent} from './roleplay-mvu-state.js'

export interface InputTerminalCurrent {
  currency:InputPreparationCurrency
  checkpoint:NativeDurableInputWorkReceiptV1
}
export interface InputTerminalDependencies {
  /** Read the exact hot work without requiring its old numerical head to stay
   * current after publication. Stopped/disposed/unknown work returns nothing. */
  current():InputTerminalCurrent|undefined
  /** Ordinary Source/head/snapshot currency, used only before nomination. */
  checkOriginal():string|undefined
  /** Durable original work/pointer/credential/snapshot/stop checks. Must not
   * acquire a queue/Source lock or compare the old head with the new head. */
  checkStored(currency:InputPreparationCurrency,receipt:NativeCompletedInputWorkReceiptV1):string|undefined
  sourceCurrent(sourceSha256:string):boolean
  canonicalCurrent(intent:MvuStateTerminalIntent):boolean
  /** The current actual Native pending completion plus exact closing history.
   * This hot check is not the historical stored-intent reader. */
  nativeCurrent(receipt:NativeCompletedInputWorkReceiptV1):boolean
}
interface Permission {
  currency:InputPreparationCurrency
  receipt:NativeCompletedInputWorkReceiptV1
  intent:MvuStateTerminalIntent
  generation:number
  closed:boolean
}
export type InputTerminalNomination={kind:'nominated';token:object}
  |{kind:'blocked';code:string}
const equal=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const blocked=(code:string)=>({kind:'blocked' as const,code})

/** The factory lives inside one input-owner binding. Its WeakMap accepts only
 * its own object identity; a JSON receipt/intent cannot reconstruct a token. */
export function createRoleplayInputTerminal(deps:InputTerminalDependencies) {
  const tokens=new WeakMap<object,Permission>()
  let generation=0,live=true,active:object|undefined,lastReceiptSha256:string|undefined
  function nominate(receipt:NativeCompletedInputWorkReceiptV1,intent:MvuStateTerminalIntent):InputTerminalNomination {
    try {
      const current=deps.current(),code=deps.checkOriginal()
      if(!live||active||code||!current||current.currency.source.kind!=='story'
        ||!current.currency.source.headRef||!current.currency.snapshot
        ||!equal(current.checkpoint,receipt.checkpoint)||!deps.nativeCurrent(receipt)) {
        return blocked(code??'INPUT_TERMINAL_SCOPE_INVALID')
      }
      const head=current.currency.source.headRef
      const currency=current.currency,receiptSha256=recordSha256(receipt)
      if(lastReceiptSha256===receiptSha256)return blocked('INPUT_TERMINAL_RECEIPT_USED')
      if(intent.sessionId!==receipt.checkpoint.sessionId||intent.sourceSha256!==currency.source.sourceSha256
        ||intent.preparationId!==currency.preparationId||intent.credentialSha256!==currency.credentialSha256
        ||intent.receiptGeneration!==currency.receiptGeneration||intent.attemptGeneration!==currency.attemptGeneration
        ||intent.stopGeneration!==generation||intent.refsSha256!==recordSha256(receipt.checkpoint.refs)
        ||intent.completedReceiptSha256!==receiptSha256||!equal(intent.preparationSnapshot,currency.snapshot)
        ||intent.base.headSha256!==head.sha256||!deps.canonicalCurrent(intent)) {
        return blocked('INPUT_TERMINAL_IDENTITY_CHANGED')
      }
      const {intentSha256,...descriptor}=intent
      if(recordSha256(descriptor)!==intentSha256)return blocked('INPUT_TERMINAL_INTENT_HASH_INVALID')
      const stored=deps.checkStored(currency,receipt)
      if(stored)return blocked(stored)
      const token=Object.freeze({})
      tokens.set(token,{currency:structuredClone(currency),receipt,intent:structuredClone(intent),generation,closed:false})
      active=token
      lastReceiptSha256=receiptSha256
      return {kind:'nominated',token}
    } catch {return blocked('INPUT_TERMINAL_SCOPE_UNKNOWN')}
  }
  function check(token:object,intent:MvuStateTerminalIntent):{kind:'allow'}|{kind:'blocked';code:string} {
    try {
      const permission=tokens.get(token),current=deps.current()
      if(!live||active!==token||!permission||permission.closed||permission.generation!==generation
        ||!current||!equal(permission.currency,current.currency)
        ||!equal(permission.receipt.checkpoint,current.checkpoint)||!equal(permission.intent,intent)) {
        return blocked('INPUT_TERMINAL_PERMISSION_REVOKED')
      }
      const code=deps.checkStored(permission.currency,permission.receipt)
      if(code)return blocked(code)
      if(!deps.sourceCurrent(intent.sourceSha256)||!deps.canonicalCurrent(intent)
        ||!deps.nativeCurrent(permission.receipt))return blocked('INPUT_TERMINAL_SOURCE_CHANGED')
      return {kind:'allow'}
    } catch {return blocked('INPUT_TERMINAL_SCOPE_UNKNOWN')}
  }
  function revoke():void {
    generation++
    if(active) {
      const permission=tokens.get(active)
      if(permission)permission.closed=true
    }
    active=undefined
  }
  return {nominate,check,stopGeneration:()=>generation,
    finish(token:object):void {
      const permission=tokens.get(token)
      if(permission)permission.closed=true
      if(active===token)active=undefined
    },
    revoke,
    dispose():void {live=false;revoke()},
  }
}
