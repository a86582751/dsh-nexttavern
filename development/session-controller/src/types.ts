/** Keep the native wire vocabulary and projection augmentations on one shared owner. */
export * from '@deepseek-ai/dsh-api-session-controller/types'

import type {ContentBlock,MessageSource} from 'dsh-nexttavern-native-llm'
import type {MessageSourceMaterialV1} from '../../llm/src/types.js'

export interface AuthorUserInput {
  readonly operationId:string
  readonly producer:string
  readonly origin:string
  readonly text:string
  assertCurrent():void
}

export interface UserSourceOperationInput {
  readonly content:readonly ContentBlock[]
  readonly source:MessageSource
  readonly isEdit:boolean
  readonly signal:AbortSignal
  /** Read inside the Source FIFO before processing a duplicate prompt RPC.
   * Final publication still performs its own synchronous duplicate check. */
  readonly alreadyAccepted?:()=>boolean
}
export interface UserSourceOperationResult {
  readonly content:readonly ContentBlock[]
  readonly material?:MessageSourceMaterialV1
}
/** The actual Source owner encloses publication in its existing FIFO. The
 * callback creates/persists Native identity only after preparation. An async
 * publication retains the Source FIFO until its Native flush finishes. */
export interface UserSourceOperation {
  admit(input:UserSourceOperationInput,publish:(result:UserSourceOperationResult)=>void|Promise<void>):Promise<void>
}
