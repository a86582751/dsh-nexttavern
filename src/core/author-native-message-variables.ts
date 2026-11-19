import type {AuthorNativeSnapshotDataV1} from './author-native-helper-types.js'
import type {AuthorOrdinaryMessageCaptureV1,PromptCapturedMessageV1} from './tavern-author-prompt-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type AuthorNativeSetChatMessagesPlanV1=
  |{readonly kind:'unchanged'}
  |{readonly kind:'body';readonly message_id:number;readonly text:string;readonly message:PromptCapturedMessageV1}
  |{readonly kind:'patch';readonly message_id:number;readonly text:string;readonly message:PromptCapturedMessageV1;
    readonly patch:import('./roleplay-author-message-edit-types.js').AuthorMessagePatchRequestV3}
  |{readonly kind:'opening';readonly row:{readonly message_id:number;readonly swipe_id:number}
    |{readonly message_id:number;readonly swipes_data:readonly (MvuJsonObject|null)[]}}

/** Shared captured-message view, serialized into author realms. Ordinary
 * addresses come from Native selection facts, never MVU publication owners. */
export function createAuthorNativeMessageVariables(
  snapshot:Pick<AuthorNativeSnapshotDataV1,'messages'|'ordinaryMessages'>) {
  type Target=NonNullable<AuthorOrdinaryMessageCaptureV1['root']['namespace']['target']>
  const key=(target:Target)=>{
    const identity=target.identity,variant=identity.variant
    return JSON.stringify([identity.ownerSessionId,identity.nativeSeq,identity.messageId,
      variant.kind,variant.kind==='opening-variant'?variant.id:null])
  }
  let captures:Map<string,AuthorOrdinaryMessageCaptureV1>|undefined
  const captured=(target:Target|undefined)=>{
    if(!target)return
    if(!captures) {
      captures=new Map()
      for(const capture of snapshot.ordinaryMessages??[]) {
        const address=capture.root.namespace.target
        if(address)captures.set(key(address),capture)
      }
    }
    return captures.get(key(target))
  }
  const overlay=(base:MvuJsonObject|undefined,capture:AuthorOrdinaryMessageCaptureV1|undefined):MvuJsonObject=>{
    const values={...(capture?.replaceOrdinary?{}:base),...capture?.values}
    for(const name of capture?.deletedKeys??[])delete values[name]
    // Numerical presence and value belong solely to the actual MVU row.
    if(base&&Object.hasOwn(base,'stat_data'))values.stat_data=base.stat_data!
    else delete values.stat_data
    return values
  }
  const forMessage=(message:PromptCapturedMessageV1|undefined)=>{
    const capture=captured(message?.ordinary?.selectedTarget)
    const base=message?.variables.kind==='available'?message.variables.variables:undefined
    return {message,capture,values:overlay(base,capture)}
  }
  const resolve=(selector:{type:'message';message_id?:number|'latest'},forWrite=false)=>{
    const rows=snapshot.messages,id=selector.message_id
    const message=id===undefined||id==='latest'
      ?forWrite?rows.at(-1):rows.findLast(row=>(row.role as string)!=='system')
      :rows[id<0?rows.length+id:id]
    const result=forMessage(message)
    if(forWrite&&!result.capture)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
    return result
  }
  const swipeData=(message:PromptCapturedMessageV1):readonly (MvuJsonObject|null)[]|undefined=>{
    if(!message.variants)return
    return message.variants.swipes.map((_,index)=>{
      const base=message.variants!.swipes_data?.[index]??undefined
      const capture=captured(message.ordinary?.variants[index])
      return base||capture?.exists?overlay(base,capture):null
    })
  }
  const swipeInfo=(message:PromptCapturedMessageV1)=>message.variants?.swipes_info
    ??(message.variants?.swipes??[message.message]).map(()=>({extra:{}}))
  const chatMessage=(message:PromptCapturedMessageV1,includeSwipes=false)=>{
    const data=forMessage(message).values,variants=message.variants,
      swipes=variants?.swipes??[message.message],swipes_data=swipeData(message)??[data],
      common={message_id:message.index,role:message.role,name:message.name??'',
        is_hidden:message.is_hidden??false,extra:message.extra??{},
        swipe_id:variants?.swipe_id??0,swipes,swipes_data}
    return includeSwipes?{...common,swipes_info:swipeInfo(message)}
      :{...common,message:message.message,data}
  }
  /** SillyTavern context uses raw message field names. Its variables array
   * retains every swipe, while TavernHelper exposes the selected DATA DTO. */
  const contextChatMessage=(message:PromptCapturedMessageV1)=>{
    const row=chatMessage(message)
    return {name:row.name,mes:message.message,is_user:message.role==='user',is_system:row.is_hidden,
      extra:row.extra,swipe_id:row.swipe_id,swipes:row.swipes,
      swipe_info:message.variants?.swipes_info?.map(info=>info.extra)??[row.extra],
      variables:row.swipes_data}
  }
  const object=(value:unknown):value is Record<string,unknown>=>
    value!==null&&typeof value==='object'&&!Array.isArray(value)
  const sameJson=(left:unknown,right:unknown):boolean=>{
    if(left===right)return true
    if(left===null||right===null||typeof left!=='object'||typeof right!=='object')return false
    if(Array.isArray(left)!==Array.isArray(right))return false
    if(Array.isArray(left)){
      const other=right as unknown[]
      if(left.length!==other.length)return false
      for(let i=0;i<left.length;i++)if(!sameJson(left[i],other[i]))return false
      return true
    }
    const leftObj=left as Record<string,unknown>,rightObj=right as Record<string,unknown>
    const leftKeys=Object.keys(leftObj).filter(name=>leftObj[name]!==undefined)
    const rightKeys=Object.keys(rightObj).filter(name=>rightObj[name]!==undefined)
    if(leftKeys.length!==rightKeys.length)return false
    for(const name of leftKeys){
      if(!Object.hasOwn(rightObj,name)||rightObj[name]===undefined||!sameJson(leftObj[name],rightObj[name]))return false
    }
    return true
  }
  /** Raw SillyTavern chat edits are drafts. Save through the same captured
   * message operations as Tavern Helper, so switching an opening uses its
   * actual text, initialization, and navigation receipts. */
  const contextChatDraft=(commit:(rows:Record<string,unknown>[])=>Promise<unknown>)=>{
    const baseline=snapshot.messages.map(contextChatMessage),chat=structuredClone(baseline)
    async function saveChat():Promise<unknown> {
      if(chat.length!==baseline.length)throw Error('AUTHOR_NATIVE_CONTEXT_CHAT_SHAPE_UNSUPPORTED')
      const rows:Record<string,unknown>[]=[]
      for(const [index,current] of baseline.entries()) {
        const draft=chat[index]
        if(!object(draft))throw Error('AUTHOR_NATIVE_CONTEXT_CHAT_SHAPE_UNSUPPORTED')
        const {mes,name,extra,is_system,swipe_id,swipes,...retained}=draft
        const {mes:oldText,name:oldName,extra:oldExtra,is_system:oldHidden,swipe_id:oldSwipe,
          swipes:oldSwipes,...previous}=current
        if(!sameJson(retained,previous))throw Error('AUTHOR_NATIVE_CONTEXT_CHAT_DATA_UNSUPPORTED')
        const metadataChanged=name!==oldName||is_system!==oldHidden||!sameJson(extra,oldExtra)
        const row={message_id:index}
        if(swipe_id!==oldSwipe) {
          // Some clients mirror the current body into its swipe before selecting
          // another original. That already committed body needs no extra write.
          const stored=[...oldSwipes];stored[oldSwipe]=oldText
          if(!Number.isInteger(swipe_id)||swipe_id<0||swipe_id>=oldSwipes.length||mes!==oldSwipes[swipe_id]
            ||metadataChanged||!sameJson(swipes,oldSwipes)&&!sameJson(swipes,stored))
            throw Error('AUTHOR_NATIVE_CONTEXT_CHAT_SWIPE_UNSUPPORTED')
          rows.push({...row,swipe_id})
          continue
        }
        if(!sameJson(swipes,oldSwipes)) {
          const mirrored=[...oldSwipes];mirrored[oldSwipe]=mes
          if(!sameJson(swipes,mirrored))throw Error('AUTHOR_NATIVE_MESSAGE_OPENING_SWIPES_UNSUPPORTED')
        }
        if(mes!==oldText||metadataChanged)rows.push({...row,message:mes,name,extra,is_hidden:is_system})
      }
      if(rows.length)return commit(rows)
    }
    return {chat,saveChat}
  }
  const isOrdinaryOwned=(capture:AuthorOrdinaryMessageCaptureV1|undefined,name:string)=>{
    if(name==='stat_data'||!capture)return false
    return capture.replaceOrdinary===true||Object.hasOwn(capture.values,name)||(capture.deletedKeys?.includes(name)??false)
  }
  const reconcilePack=(bankPack:MvuJsonObject|null,effective:MvuJsonObject|null,
    next:MvuJsonObject|null,capture:AuthorOrdinaryMessageCaptureV1|undefined):MvuJsonObject|null=>{
    if(next===null){
      if(effective){
        for(const name of Object.keys(effective)){
          if(effective[name]!==undefined&&isOrdinaryOwned(capture,name))
            throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED')
        }
      }
      return null
    }
    if(effective===null){
      for(const name of Object.keys(next)){
        if(isOrdinaryOwned(capture,name))throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED')
      }
      return next
    }
    // Preserve original bank pack keys (including hidden fallbacks) and never
    // persist unchanged ordinary overlay keys back into opening bank packs.
    const pack:MvuJsonObject={...bankPack}
    const names=new Set<string>([...Object.keys(effective),...Object.keys(next)])
    for(const name of names){
      const hadEffective=Object.hasOwn(effective,name)&&effective[name]!==undefined
      const hasNext=Object.hasOwn(next,name)&&next[name]!==undefined
      const changed=hadEffective!==hasNext||(hadEffective&&!sameJson(effective[name],next[name]))
      if(!changed)continue
      if(isOrdinaryOwned(capture,name))throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED')
      if(hasNext)pack[name]=next[name]!
      else delete pack[name]
    }
    return pack
  }
  const allowedFields=new Set(['message_id','role','is_hidden','message','data',
    'swipe_id','swipes','swipes_data','swipes_info','name','extra'])
  const planTarget=(index:number,merged:Record<string,unknown>):AuthorNativeSetChatMessagesPlanV1=>{
    const message=snapshot.messages[index]!
    if(merged.role!==undefined&&merged.role!==message.role)throw Error('AUTHOR_NATIVE_MESSAGE_ROLE_CHANGE_UNSUPPORTED')
    if(merged.name!==undefined&&typeof merged.name!=='string')throw Error('AUTHOR_NATIVE_MESSAGE_NAME_INVALID')
    if(merged.extra!==undefined&&!object(merged.extra))throw Error('AUTHOR_NATIVE_MESSAGE_EXTRA_INVALID')
    if(merged.is_hidden!==undefined&&typeof merged.is_hidden!=='boolean')throw Error('AUTHOR_NATIVE_MESSAGE_HIDDEN_INVALID')
    const metadata={...merged.name!==undefined&&merged.name!==(message.name??'')?{name:merged.name as string}:{},
      ...merged.is_hidden!==undefined&&merged.is_hidden!==(message.is_hidden??false)?{is_hidden:merged.is_hidden as boolean}:{}}
    const metadataChanged=Object.keys(metadata).length>0
    const extraChanged=merged.extra!==undefined&&!sameJson(merged.extra,message.extra??{})
    const fieldSinglePage=Object.hasOwn(merged,'message')||Object.hasOwn(merged,'data')
    if((metadataChanged||extraChanged)&&!fieldSinglePage) {
      const variants=chatMessage(message,true)
      if(merged.swipe_id!==undefined&&merged.swipe_id!==variants.swipe_id
        ||merged.swipes!==undefined&&!sameJson(merged.swipes,variants.swipes)
        ||merged.swipes_data!==undefined&&!sameJson(merged.swipes_data,variants.swipes_data))
        throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED')
      if(merged.swipes_info!==undefined&&!sameJson(merged.swipes_info,swipeInfo(message)))
        throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INFO_UNSUPPORTED')
    }
    // Upstream chooses the single-page branch by field presence, before
    // comparing values. An explicitly undefined field still selects it.
    const singlePage=fieldSinglePage||metadataChanged||extraChanged
    if(singlePage){
      if(merged.message!==undefined&&typeof merged.message!=='string')throw Error('AUTHOR_NATIVE_MESSAGE_BODY_INVALID')
      if(merged.data!==undefined&&!object(merged.data))throw Error('AUTHOR_NATIVE_MESSAGE_DATA_INVALID')
      const nextData=merged.data as MvuJsonObject|undefined
      const bodyChanged=merged.message!==undefined&&merged.message!==message.message
      const currentData=nextData!==undefined?forMessage(message).values:undefined
      const dataChanged=nextData!==undefined&&!sameJson(currentData,nextData)
      if(!bodyChanged&&!dataChanged&&!metadataChanged&&!extraChanged)return {kind:'unchanged'}
      const numericalChanged=dataChanged&&!sameJson(currentData?.stat_data,nextData?.stat_data)
      if(!message.variants||!bodyChanged&&!numericalChanged&&(metadataChanged||extraChanged||dataChanged)) {
        if(message.nativeSeq===null)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
        if(numericalChanged)
          throw Error('AUTHOR_NATIVE_MESSAGE_NUMERICAL_MIXED_UNSUPPORTED')
        const ordinary=dataChanged?Object.fromEntries(Object.entries(nextData!).filter(([name])=>name!=='stat_data')) as MvuJsonObject:undefined
        if(dataChanged&&!forMessage(message).capture)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
        if(metadataChanged||extraChanged||dataChanged)return {kind:'patch',message_id:index,
          text:merged.message as string|undefined??message.message,message,patch:{
            ...metadataChanged?{metadata}:{},...extraChanged?{extra:merged.extra as MvuJsonObject}:{},
            ...ordinary?{ordinary}:{}}}
        return {kind:'body',message_id:index,text:merged.message as string,message}
      }
      if(metadataChanged||extraChanged)throw Error('AUTHOR_NATIVE_MESSAGE_NUMERICAL_MIXED_UNSUPPORTED')
      if(bodyChanged&&dataChanged)throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED')
      if(bodyChanged){
        if(message.variants||message.ordinary?.selectedTarget.identity.variant.kind==='opening-variant')
          throw Error('AUTHOR_NATIVE_MESSAGE_OPENING_BODY_UNSUPPORTED')
        if(message.nativeSeq===null)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
        return {kind:'body',message_id:index,text:merged.message as string,message}
      }
      if(!message.variants)throw Error('AUTHOR_NATIVE_MESSAGE_DATA_UNSUPPORTED')
      const variants=message.variants
      const selectedIndex=variants.swipe_id
      const capture=captured(message.ordinary?.variants[selectedIndex]??message.ordinary?.selectedTarget)
      const nextPacks=variants.swipes.map((_,candidateIndex)=>{
        const pack=variants.swipes_data?.[candidateIndex]??null
        return candidateIndex===selectedIndex?reconcilePack(pack,currentData!,nextData!,capture):pack
      })
      return {kind:'opening',row:{message_id:index,swipes_data:nextPacks}}
    }
    if(merged.swipes_info!==undefined&&!sameJson(merged.swipes_info,swipeInfo(message)))
      throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INFO_UNSUPPORTED')
    if(merged.swipe_id===undefined&&merged.swipes===undefined&&merged.swipes_data===undefined)return {kind:'unchanged'}
    if(!message.variants) {
      const current=chatMessage(message,true)
      if((merged.swipe_id===undefined||merged.swipe_id===current.swipe_id)
        &&(merged.swipes===undefined||sameJson(merged.swipes,current.swipes))
        &&(merged.swipes_data===undefined||sameJson(merged.swipes_data,current.swipes_data))
        &&(merged.swipes_info===undefined||sameJson(merged.swipes_info,swipeInfo(message))))return {kind:'unchanged'}
      throw Error('AUTHOR_NATIVE_MESSAGE_DATA_UNSUPPORTED')
    }
    const variants=message.variants
    if(merged.swipes!==undefined){
      if(!Array.isArray(merged.swipes)||merged.swipes.some(text=>typeof text!=='string'))
        throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INVALID')
      if(merged.swipes.length!==variants.swipes.length||merged.swipes.some((text,i)=>text!==variants.swipes[i]))
        throw Error('AUTHOR_NATIVE_MESSAGE_OPENING_SWIPES_UNSUPPORTED')
    }
    let activateChanged=false
    if(merged.swipe_id!==undefined){
      if(typeof merged.swipe_id!=='number'||!Number.isInteger(merged.swipe_id)
        ||merged.swipe_id<0||merged.swipe_id>=variants.swipes.length)
        throw Error('AUTHOR_NATIVE_MESSAGE_SWIPE_ID_INVALID')
      activateChanged=merged.swipe_id!==variants.swipe_id
    }
    let nextPacks:(MvuJsonObject|null)[]|undefined,packsChanged=false
    if(merged.swipes_data!==undefined){
      if(!Array.isArray(merged.swipes_data)||merged.swipes_data.length!==variants.swipes.length)
        throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_DATA_INVALID')
      const effectivePacks=swipeData(message)!
      nextPacks=[]
      for(let i=0;i<merged.swipes_data.length;i++){
        const rawNext=merged.swipes_data[i]
        if(rawNext!==null&&!object(rawNext))throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_DATA_INVALID')
        const nextPack=rawNext as MvuJsonObject|null
        const bankPack=variants.swipes_data?.[i]??null,effective=effectivePacks[i]??null
        if(sameJson(effective,nextPack))nextPacks.push(bankPack)
        else {
          packsChanged=true
          nextPacks.push(reconcilePack(bankPack,effective,nextPack,captured(message.ordinary?.variants[i])))
        }
      }
    }
    if(activateChanged&&packsChanged)throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED')
    if(packsChanged)return {kind:'opening',row:{message_id:index,swipes_data:nextPacks!}}
    if(activateChanged)return {kind:'opening',row:{message_id:index,swipe_id:merged.swipe_id as number}}
    return {kind:'unchanged'}
  }
  const planSetChatMessages=(rows:readonly unknown[]):AuthorNativeSetChatMessagesPlanV1=>{
    if(!Array.isArray(rows))throw Error('AUTHOR_NATIVE_MESSAGE_REQUEST_INVALID')
    const mergedByIndex=new Map<number,Record<string,unknown>>()
    for(const row of rows){
      if(!object(row))throw Error('AUTHOR_NATIVE_MESSAGE_REQUEST_INVALID')
      const keys=Object.keys(row)
      for(const name of keys)if(!allowedFields.has(name))throw Error('AUTHOR_NATIVE_MESSAGE_FIELD_UNSUPPORTED')
      const id=row.message_id
      if(typeof id!=='number'||!Number.isInteger(id))throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
      const index=id<0?snapshot.messages.length+id:id
      if(!snapshot.messages[index])throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
      let target=mergedByIndex.get(index)
      if(!target){target={};mergedByIndex.set(index,target)}
      Object.assign(target,row)
    }
    let selected:AuthorNativeSetChatMessagesPlanV1|undefined
    for(const [index,merged] of mergedByIndex){
      const plan=planTarget(index,merged)
      if(plan.kind!=='unchanged'){
        if(selected)throw Error('AUTHOR_NATIVE_MESSAGE_MULTIPLE_TARGETS_UNSUPPORTED')
        selected=plan
      }
    }
    return selected??{kind:'unchanged'}
  }
  const legacySetChatMessage=(fields:string|{message?:string;data?:MvuJsonObject},messageId:number,
    options:{swipe_id?:number|'current';refresh?:'none'|'display_current'|'display_and_render_current'|'all'}={},
    substitute:(text:string,index:number)=>string=(text)=>text)=>{
    const refresh=options.refresh??'display_and_render_current'
    if(refresh==='display_current')throw Error('AUTHOR_NATIVE_LEGACY_DISPLAY_CURRENT_UNSUPPORTED')
    if(!['none','display_and_render_current','all'].includes(refresh))throw Error('AUTHOR_NATIVE_MESSAGE_REFRESH_INVALID')
    const index=messageId<0?snapshot.messages.length+messageId:messageId,message=snapshot.messages[index]
    if(!message)throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE')
    const value=typeof fields==='string'?{message:fields}:fields,current=chatMessage(message,true)
    const selected=current.swipe_id,target=options.swipe_id===undefined||options.swipe_id==='current'?selected:options.swipe_id
    if(!Number.isInteger(target)||target<0||target>=current.swipes.length)throw Error('AUTHOR_NATIVE_MESSAGE_SWIPE_ID_INVALID')
    const row:Record<string,unknown>={message_id:messageId}
    const text=value.message===undefined?undefined:substitute(value.message,index)
    if(target===selected){
      if(text!==undefined)row.message=text
      if(value.data!==undefined)row.data=value.data
    }else{
      if(text!==undefined&&text!==current.swipes[target]){
        const swipes=[...current.swipes];swipes[target]=text;row.swipes=swipes
      }
      if(value.data!==undefined){
        const packs=[...current.swipes_data];packs[target]=value.data;row.swipes_data=packs
      }
      // Upstream can write an unselected page without activating it. The
      // modern owner decides which captured variant edits are supported.
      if(refresh!=='none')row.swipe_id=target
    }
    return {rows:[row],refresh:refresh==='display_and_render_current'?'affected' as const:refresh}
  }
  return {resolve,forMessage,swipeData,chatMessage,contextChatMessage,contextChatDraft,planSetChatMessages,legacySetChatMessage}
}
