/** Exact previous-message selection and readonly clonePreviousMessage data.
 * Membership/active swipe facts are required; no variables or flags are written. */
import {recordSha256} from './roleplay-data.js'
import {promptExact,promptFail,promptFact,promptRef,promptRead,promptValues,
  TAVERN_PROMPT_VARIABLE_BOUNDS_V1} from './roleplay-tavern-prompt-variables-data.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernPromptMessageHistoryV1,TavernPromptVariableAvailabilityV1,
  TavernPromptVariablePacketV1,TavernPromptVariableReadV1,TavernPromptMessageSelectionV2,
  TavernPromptMessageVariablesFactV1} from './roleplay-tavern-prompt-variables-types.js'

export function selectCurrentPromptMessageV2(count:number,at:(index:number)=>TavernPromptMessageVariablesFactV1,
  selectedBaseSha256:string,membership:TavernPromptVariableReadV1):TavernPromptMessageSelectionV2 {
  const selected=(count?at(count-1):undefined)!,reads:TavernPromptVariableReadV1[]=[membership],base={schemaVersion:2 as const,
    encoding:'owned-prompt-message-selection-v2' as const,selectedBaseSha256,reads},
    result=(kind:TavernPromptMessageSelectionV2['kind'],values:MvuJsonObject|null,
      disposition:TavernPromptVariablePacketV1['selection']['disposition'],messageId:string|null,
      previousMessageId:string|null=null,missingEvidence:readonly string[]=[]):TavernPromptMessageSelectionV2=>
      Object.freeze({...base,kind,values,missingEvidence,selection:{disposition,messageId,swipe:messageId===null?null:selected!.selectedSwipe,
        previousMessageId,selectedValuesSha256:values===null?null:recordSha256(values)}})
  if(!count)return result('empty',{},'empty-chat',null)
  const own=selected!.selected!
  const use=(row:TavernPromptMessageVariablesFactV1,selected=false)=>{
    const fact=selected?row.selected!:row.active
    if(fact.kind!=='unavailable')reads.push({kind:'message',identity:row.messageId,
      valueSha256:fact.kind==='values'?fact.valuesSha256:recordSha256({kind:'absent'}),provenance:fact.provenance})
    return fact
  }
  use(selected!,true)
  if(selected.initializedRef)reads.push({kind:'message',identity:selected.messageId+':initialized',
    valueSha256:recordSha256({initialized:selected.selectedInitialized}),provenance:selected.initializedRef})
  if(!selected.initializedRef||own.kind==='unavailable')return result('unavailable',null,'unavailable',selected.messageId,
    null,own.kind==='unavailable'?own.missingEvidence:['selected.variables_initialized actual presence/value ref'])
  const ownValues=own.kind==='values'?own.values:{}
  if(selected.selectedInitialized===true)return result('values',ownValues,'already-initialized',selected.messageId)
  if(count===1)return result('values',ownValues,'readonly-own-first-message',selected.messageId)
  for(let index=count-2;index>=0;index--){
    const row=at(index),fact=use(row)
    if(fact.kind==='unavailable')return result('unavailable',null,'unavailable',selected.messageId,null,fact.missingEvidence)
    if(fact.kind==='values')return result('values',{...fact.values,...ownValues},'readonly-previous-copy',selected.messageId,row.messageId)
  }
  return result('initial-fallback',ownValues,'readonly-initial-fallback',selected.messageId)
}

export interface TavernPromptSelectedMessageDataV1 {
  readonly values:MvuJsonObject|null
  readonly emptyChat:boolean
  readonly missingEvidence:readonly string[]
  readonly reads:readonly TavernPromptVariableReadV1[]
  readonly selection:TavernPromptVariablePacketV1['selection']
}
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
export function readPromptSelectedMessageDataV1(history:TavernPromptMessageHistoryV1,
  initial:TavernPromptVariableAvailabilityV1):TavernPromptSelectedMessageDataV1 {
  const reads:TavernPromptVariableReadV1[]=[]
  const unavailable=(missingEvidence:readonly string[],messageId:string|null=null,swipe:number|null=null)
    :TavernPromptSelectedMessageDataV1=>({values:null,emptyChat:false,missingEvidence,reads,
      selection:{disposition:'unavailable',messageId,swipe,previousMessageId:null,selectedValuesSha256:null}})
  if(history.kind==='unavailable') {
    promptExact(history,['kind','missingEvidence'])
    if(!Array.isArray(history.missingEvidence)||!history.missingEvidence.length
      ||history.missingEvidence.some(value=>typeof value!=='string'||!value||value.length>4096)) {
      promptFail('PROMPT_VARIABLE_HISTORY_UNAVAILABLE_INVALID')
    }
    return unavailable(history.missingEvidence)
  }
  const messages=history.messages
  promptExact(history,['kind','messageCount','selectedIndex','selectedSwipe','messages','membershipRef'])
  if(history.kind!=='complete-prefix'||!integer(history.messageCount)||!Array.isArray(history.messages)
    ||history.messages.length>TAVERN_PROMPT_VARIABLE_BOUNDS_V1.historyMessages)promptFail('PROMPT_VARIABLE_HISTORY_INVALID')
  promptRef(history.membershipRef)
  reads.push(promptRead('history','complete-visible-prefix',recordSha256(history),history.membershipRef))
  if(history.messageCount===0) {
    if(history.selectedIndex!==null||history.selectedSwipe!==null||history.messages.length) {
      promptFail('PROMPT_VARIABLE_EMPTY_HISTORY_INVALID')
    }
    return {values:{},emptyChat:true,missingEvidence:[],reads,
      selection:{disposition:'empty-chat',messageId:null,swipe:null,previousMessageId:null,selectedValuesSha256:recordSha256({})}}
  }
  if(!integer(history.selectedIndex)||history.selectedIndex>=history.messageCount||!integer(history.selectedSwipe)
    ||history.messages.length!==history.selectedIndex+1)promptFail('PROMPT_VARIABLE_HISTORY_INCOMPLETE')
  const ids=new Set<string>()
  for(const [index,row] of messages.entries()) {
    promptExact(row,['index','messageId','activeSwipe','active','selectedSwipe','selected','selectedInitialized',
      'initializedRef','messageRef'])
    if(row.index!==index||typeof row.messageId!=='string'||!row.messageId||row.messageId.length>256
      ||ids.has(row.messageId)||!integer(row.activeSwipe))promptFail('PROMPT_VARIABLE_MESSAGE_IDENTITY')
    ids.add(row.messageId);promptRef(row.messageRef);promptFact(row.active)
    reads.push(promptRead('message',`${row.messageId}:membership-active-swipe`,recordSha256(row),row.messageRef))
    if(index!==history.selectedIndex) {
      if(row.selectedSwipe!==null||row.selected!==null||row.selectedInitialized!==null||row.initializedRef!==null) {
        promptFail('PROMPT_VARIABLE_NONSELECTED_SWIPE_FACT')
      }
    } else {
      if(row.selectedSwipe!==history.selectedSwipe||!row.selected
        ||row.selectedInitialized!==null&&typeof row.selectedInitialized!=='boolean') {
        promptFail('PROMPT_VARIABLE_SELECTED_SWIPE_INVALID')
      }
      if(row.initializedRef)promptRef(row.initializedRef)
      const selected=promptFact(row.selected),active=promptFact(row.active)
      // The same physical swipe cannot supply different initialized values or
      // presence facts through two aliases in this consumer packet.
      if(row.selectedSwipe===row.activeSwipe&&recordSha256(row.selected)!==recordSha256(row.active)) {
        promptFail('PROMPT_VARIABLE_SELECTED_ACTIVE_MISMATCH')
      }
      if(selected.kind==='known')reads.push({...selected.read,kind:'message',identity:`${row.messageId}:${row.selectedSwipe}:own`})
      if(active.kind==='unavailable'&&row.selectedSwipe===row.activeSwipe
        &&selected.kind!=='unavailable')promptFail('PROMPT_VARIABLE_SELECTED_ACTIVE_MISMATCH')
    }
  }
  const selectedRow=messages[history.selectedIndex]!,own=promptFact(selectedRow.selected!)
  if(!selectedRow.initializedRef)return unavailable(['selected.variables_initialized actual presence/value ref'],
    selectedRow.messageId,history.selectedSwipe)
  reads.push(promptRead('message',`${selectedRow.messageId}:${history.selectedSwipe}:initialized`,
    recordSha256({initialized:selectedRow.selectedInitialized}),selectedRow.initializedRef))
  if(own.kind==='unavailable')return unavailable(own.missingEvidence,selectedRow.messageId,history.selectedSwipe)
  const result=(values:MvuJsonObject,disposition:TavernPromptVariablePacketV1['selection']['disposition'],
    previousMessageId:string|null):TavernPromptSelectedMessageDataV1=>({values:promptValues(values),emptyChat:false,
      missingEvidence:[],reads,selection:{disposition,messageId:selectedRow.messageId,swipe:history.selectedSwipe,
        previousMessageId,selectedValuesSha256:recordSha256(values)}})
  if(selectedRow.selectedInitialized===true)return result(own.values,'already-initialized',null)
  // clonePreviousMessage returns before cloning if chat[message_id-1] is absent.
  if(history.selectedIndex===0)return result(own.values,'readonly-own-first-message',null)
  for(let index=history.selectedIndex-1;index>=0;index--) {
    const row=messages[index]!,fact=promptFact(row.active)
    if(fact.kind==='unavailable')return unavailable(fact.missingEvidence,selectedRow.messageId,history.selectedSwipe)
    reads.push({...fact.read,kind:'message',identity:`${row.messageId}:${row.activeSwipe}:previous-search`})
    if(row.active.kind==='values') {
      // Fixed findPreviousMessageVariables uses values!=null, not the earlier
      // message's initialized flag. Never skip the nearest present object.
      return result({...fact.values,...own.values},'readonly-previous-copy',row.messageId)
    }
  }
  if(initial.kind!=='bound')return unavailable(['initial fallback for previous-message search',...initial.missingEvidence],
    selectedRow.messageId,history.selectedSwipe)
  reads.push(...initial.reads)
  return result({...initial.binding.values,...own.values},'readonly-initial-fallback',null)
}
