/** One Native publication point selects already durable ordinary-chat DATA. */
import type {Session,SessionEvent} from 'dsh-nexttavern-native-session'

export const AUTHOR_CHAT_ROOT_EVENT='roleplay/author-chat-root' as const
export interface AuthorChatRootMarkerV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-chat-root-marker-v1'
  readonly sessionId:string
  readonly namespaceSha256:string
  readonly publication:{readonly key:string;readonly sha256:string}
  readonly base:{readonly key:string;readonly sha256:string}|null
}
declare module 'dsh-nexttavern-native-session/types' {
  interface SessionEventMap {
    'roleplay/author-chat-root':AuthorChatRootMarkerV1
  }
}

export function assertAuthorChatRootMarker(value:unknown):asserts value is AuthorChatRootMarkerV1 {
  if(!value||typeof value!=='object')throw Error('AUTHOR_CHAT_ROOT_MARKER_INVALID')
  const marker=value as AuthorChatRootMarkerV1
  const ref=(item:AuthorChatRootMarkerV1['publication']|null)=>!!item&&typeof item==='object'
    &&typeof item.key==='string'&&item.key.length>0&&typeof item.sha256==='string'&&/^[a-f0-9]{64}$/.test(item.sha256)
  if(marker.schemaVersion!==1||marker.encoding!=='native-author-chat-root-marker-v1'
    ||typeof marker.sessionId!=='string'||!marker.sessionId.length
    ||typeof marker.namespaceSha256!=='string'||!/^[a-f0-9]{64}$/.test(marker.namespaceSha256)
    ||!ref(marker.publication)||marker.base!==null&&!ref(marker.base))throw Error('AUTHOR_CHAT_ROOT_MARKER_INVALID')
}

/** Publication is allowed within an open turn, before the prepared request. */
export function appendAuthorChatRootMarker(session:Session,marker:AuthorChatRootMarkerV1)
  :SessionEvent<typeof AUTHOR_CHAT_ROOT_EVENT> {
  if(marker.sessionId!==session.id)throw Error('AUTHOR_CHAT_ROOT_SESSION_CHANGED')
  return session.append(AUTHOR_CHAT_ROOT_EVENT,marker)
}

export const authorChatRootMarkers=Object.freeze({eventType:AUTHOR_CHAT_ROOT_EVENT,
  append:appendAuthorChatRootMarker,assert:assertAuthorChatRootMarker})
