import type {Context} from '@deepseek-ai/cordis'
import type {Message,MessageSourceMaterialV1} from 'dsh-nexttavern-native-llm/types'
import type {Session, SessionEvent, SessionSeq} from 'dsh-nexttavern-native-session'
import {foldSurface} from 'dsh-nexttavern-native-session/surface'
import {MESSAGE_EDIT_EVENT, assertMessageEdit, editMessageText, messageEditProjection,
  type MessageEdit,type MessageEditOperationV1} from './projection.js'
export type {MessageEditOperationV1,ReaderMessageEditOriginV1} from './projection.js'
import {mvuPlayerMarkers} from './mvu-player-marker.js'
import {mvuSchemaMarkers} from './mvu-schema-marker.js'
import {authorInjectionCleanupMarkers,authorInjectionDeclarationMarkers} from './author-injection-cleanup.js'
import {authorChatRootMarkers} from './author-chat-marker.js'
export {AUTHOR_CHAT_ROOT_EVENT,appendAuthorChatRootMarker,assertAuthorChatRootMarker,
  authorChatRootMarkers} from './author-chat-marker.js'
export type {AuthorChatRootMarkerV1} from './author-chat-marker.js'

export {AUTHOR_INJECTION_CLEANUP_EVENT, appendAuthorInjectionCleanup, assertAuthorInjectionCleanup,
  authorInjectionCleanupMarkers} from './author-injection-cleanup.js'
export type {AuthorInjectionResourceV1, AuthorInjectionCleanupV1} from './author-injection-cleanup.js'
export {AUTHOR_INJECTION_DECLARATION_EVENT,appendAuthorInjectionDeclaration,assertAuthorInjectionDeclaration,
  authorInjectionDeclarationMarkers} from './author-injection-cleanup.js'
export type {AuthorInjectionDeclarationV1,AuthorInjectionPromptV1} from './author-injection-cleanup.js'

export interface MessageEdits {
  append: typeof appendMessageEdit
  latest: typeof latestMessageEdit
  current: typeof currentMessageEdits
  lookupOperation:typeof lookupMessageEditOperation
  lookupTarget:typeof lookupMessageEditTarget
  projectPrefix: typeof projectMessageEditPrefix
  assertMessageEdit: typeof assertMessageEdit
  editMessageText: typeof editMessageText
}

export interface MessageEditPrefixProjection {
  nodes: readonly SessionSeq[]
  projectedMessageAt(seq: SessionSeq): Message | undefined
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    nexttavernMessageEdits: MessageEdits
    nexttavernMvuPlayerMarkers: typeof mvuPlayerMarkers
    nexttavernMvuSchemaMarkers: typeof mvuSchemaMarkers
    nexttavernAuthorInjectionCleanupMarkers: typeof authorInjectionCleanupMarkers
    nexttavernAuthorInjectionDeclarationMarkers:typeof authorInjectionDeclarationMarkers
    nexttavernAuthorChatRootMarkers:typeof authorChatRootMarkers
  }
}

export const name = 'nexttavern-message-edits'
export const inject = ['sessions']

/** Register once at profile scope, before sessions are created or restored. */
export function apply(ctx: Context): void {
  ctx.sessions.registerMessageProjection(messageEditProjection)
  ctx.provide('nexttavernMessageEdits', {
    append: appendMessageEdit, latest: latestMessageEdit, current: currentMessageEdits,
    lookupOperation:lookupMessageEditOperation,
    lookupTarget:lookupMessageEditTarget,
    projectPrefix: projectMessageEditPrefix,
    assertMessageEdit, editMessageText,
  })
  ctx.provide('nexttavernMvuPlayerMarkers', mvuPlayerMarkers)
  ctx.provide('nexttavernMvuSchemaMarkers', mvuSchemaMarkers)
  ctx.provide('nexttavernAuthorInjectionCleanupMarkers', authorInjectionCleanupMarkers)
  ctx.provide('nexttavernAuthorInjectionDeclarationMarkers',authorInjectionDeclarationMarkers)
  ctx.provide('nexttavernAuthorChatRootMarkers',authorChatRootMarkers)
}

/** Fold one complete original-seq prefix without borrowing a live Session surface. */
export function projectMessageEditPrefix(events: readonly SessionEvent[]): MessageEditPrefixProjection {
  for (const [index, event] of events.entries()) {
    if (event?.seq !== index) {
      throw Error(`Message edit prefix must start at seq 0 and remain contiguous; expected ${index}`)
    }
  }
  const folded = foldSurface(events, [messageEditProjection])
  // Native Session records are immutable. Keep only the detached fold result;
  // callers can release or change their observation array after this returns.
  return {
    nodes: Object.freeze([...folded.nodes]),
    projectedMessageAt: seq => folded.projectedMessages.get(seq),
  }
}

/** Append a required edit synchronously; callers own branch locks and derived-state invalidation. */
export function appendMessageEdit(
  session: Session,
  targetSeq: SessionSeq,
  identity: Pick<MessageEdit, 'messageId' | 'role'>,
  text: string,
  sourceMaterial?:MessageSourceMaterialV1,
  operation?:MessageEditOperationV1,
): SessionEvent<'roleplay/message-edit'> {
  const metadata=operation?{operation}:{}
  if(sourceMaterial) {
    return session.append(MESSAGE_EDIT_EVENT,{schemaVersion:2,targetSeq,...identity,text,sourceMaterial,...metadata})
  }
  return session.append(MESSAGE_EDIT_EVENT, {schemaVersion: 1, targetSeq, ...identity, text,...metadata})
}

/** Reuse an accepted edit after a later metadata write failed; never manufacture a model message. */
export function latestMessageEdit(events: readonly SessionEvent[], targetSeq: SessionSeq): SessionEvent<'roleplay/message-edit'> | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type === MESSAGE_EDIT_EVENT && event.data.targetSeq === targetSeq) return event
  }
  return null
}

interface EditIndex {
  length: number
  first: SessionEvent | undefined
  last: SessionEvent | undefined
  byTarget: Map<SessionSeq, SessionEvent<'roleplay/message-edit'>>
  byOperation:Map<string,SessionEvent<'roleplay/message-edit'>>
  snapshot: readonly SessionEvent<'roleplay/message-edit'>[]|undefined
}
const editIndexes = new WeakMap<Session, EditIndex>()

/** Latest accepted decisions, including archived nodes; unchanged polls inspect only prefix endpoints. */
function advanceEditIndex(session:Session,events:{readonly length:number;at(seq:number):SessionEvent|undefined}):EditIndex {
  const previous = editIndexes.get(session)
  // Accepted Session records are immutable. These pins distinguish append-only
  // growth from a replaced/shrunk observation without scanning the old history.
  const extendsPrefix = previous && events.length >= previous.length && events.at(0) === previous.first &&
    (previous.length === 0 || events.at(previous.length - 1) === previous.last)
  const index: EditIndex = extendsPrefix ? previous : {
    length: 0, first: undefined, last: undefined, byTarget: new Map(), byOperation:new Map(),snapshot:Object.freeze([]),
  }
  for (let offset = index.length; offset < events.length; offset++) {
    const event = events.at(offset)!
    if (event.type === MESSAGE_EDIT_EVENT) {
      index.byTarget.set(event.data.targetSeq, event)
      const operationId=event.data.operation?.operationId
      // The writer resolves retries before append. Keep the original accepted
      // operation fact even when later edits replace this target's prose.
      if(operationId&&!index.byOperation.has(operationId))index.byOperation.set(operationId,event)
      index.snapshot=undefined
    }
  }
  index.length = events.length
  index.first = events.at(0)
  index.last = events.length ? events.at(events.length - 1) : undefined
  editIndexes.set(session, index)
  return index
}

export function currentMessageEdits(session:Session,
  events:{readonly length:number;at(seq:number):SessionEvent|undefined}):readonly SessionEvent<'roleplay/message-edit'>[] {
  const index=advanceEditIndex(session,events)
  return index.snapshot??=Object.freeze([...index.byTarget.values()])
}

/** Exact accepted operation DATA; neither a current target nor write permission. */
export function lookupMessageEditOperation(session:Session,
  events:{readonly length:number;at(seq:number):SessionEvent|undefined},operationId:string)
  :SessionEvent<'roleplay/message-edit'>|undefined {
  return advanceEditIndex(session,events).byOperation.get(operationId)
}

export function lookupMessageEditTarget(session:Session,
  events:{readonly length:number;at(seq:number):SessionEvent|undefined},targetSeq:SessionSeq)
  :SessionEvent<'roleplay/message-edit'>|undefined {
  return advanceEditIndex(session,events).byTarget.get(targetSeq)
}
