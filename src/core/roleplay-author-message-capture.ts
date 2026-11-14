/** Actual Native message addresses and their ordinary State read cut. This
 * owner is shared by schema and plain consumers; DATA never grants a writer. */
import {recordSha256} from './roleplay-data.js'
import {authorOrdinaryMessageSelectionV1} from './roleplay-author-prompt-capture.js'
import type {AuthorPromptOpeningFactsV1} from './roleplay-author-prompt-capture.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorChatNamespaceV3} from './roleplay-author-chat-state-types.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorMessageOrdinaryV1,AuthorOrdinaryMessageCaptureV1,PromptCapturedMessageV1}
  from './tavern-author-prompt-types.mjs'

export interface AuthorMessageIdentityV1 {
  readonly ownerSessionId:string
  readonly nativeSeq:number|null
  readonly messageId:string
}
export type AuthorMessageMetadataV1=Pick<PromptCapturedMessageV1,
  'index'|'messageId'|'ownerSessionId'|'nativeSeq'|'messageVersionSha256'|'role'|'variables'> & {
    readonly variantVariables?:readonly (MvuJsonObject|null)[]
  }
export interface AuthorMessageViewV1<T extends AuthorMessageIdentityV1=AuthorMessageMetadataV1> {
  readonly opening:AuthorPromptOpeningFactsV1
  readonly messages:readonly (T&{readonly ordinary?:AuthorMessageOrdinaryV1})[]
  readonly ordinaryMessages:readonly AuthorOrdinaryMessageCaptureV1[]
  current():boolean
}
export function captureAuthorMessageViewV1<T extends AuthorMessageIdentityV1>(input:{
  readonly sessionId:string
  readonly namespace:AuthorChatNamespaceV3
  readonly state:CanonicalAuthorChatStateV1
  readonly inputState:Pick<RoleplayInputStateOwner,'captureClosedHistoricalFacts'>
  readonly messages:readonly T[]
  readonly opening:AuthorPromptOpeningFactsV1
  readonly nativeOwnerForSeq:(seq:number)=>string
  readonly targetSetIdentity:string
  readonly current:()=>boolean
}):AuthorMessageViewV1<T> {
  const {namespace,opening,inputState,state}=input
  const captured=inputState.captureClosedHistoricalFacts(input.sessionId,
    `author-ordinary-message-set:${recordSha256(namespace)}:${input.targetSetIdentity}:${JSON.stringify(opening.ordinaryVariants??null)}`,()=>{
      const result:AuthorOrdinaryMessageCaptureV1[]=[]
      const start=input.messages.findIndex(row=>row.messageId===opening.messageId)
      if(start<0)throw Error('AUTHOR_MESSAGE_OPENING_UNPROVEN')
      for(const message of input.messages.slice(start)) {
        if(message.nativeSeq===null)continue
        if(message.messageId===opening.messageId&&opening.ordinaryVariants===null)continue
        const variants=message.messageId===opening.messageId&&opening.ordinaryVariants
          ?opening.ordinaryVariants.variant_ids.map(id=>({kind:'opening-variant' as const,id})):[{kind:'native-canonical' as const}]
        for(const variant of variants) {
          const target:AuthorChatNamespaceV3={...namespace,target:{kind:'message',identity:{
            ownerSessionId:input.nativeOwnerForSeq(message.nativeSeq),nativeSeq:message.nativeSeq,messageId:message.messageId,variant}}}
          const read=inputState.captureClosedHistoricalFacts(input.sessionId,`author-ordinary-message:${recordSha256(target)}`,
            ()=>state.captureNamespaceV3(target))
          result.push(read.data as AuthorOrdinaryMessageCaptureV1)
        }
      }
      return result
    })
  let messages:AuthorMessageViewV1<T>['messages']|undefined
  return Object.freeze({opening,ordinaryMessages:captured.data,
    get messages() {
      if(messages)return messages
      const ordinaryFor=authorOrdinaryMessageSelectionV1(captured.data,opening)
      return messages=Object.freeze(input.messages.map(row=>{const ordinary=ordinaryFor(row)
        return Object.freeze({...row,...ordinary?{ordinary}:{}})}))
    },
    current:()=>input.current()&&captured.current()})
}
