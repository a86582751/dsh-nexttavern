/** Required Native DATA for author cleanup across successor Main turns.
 * Private Core attachments own admission; restored rows grant no live rights. */
import type {Session, SessionEvent} from 'dsh-nexttavern-native-session'

export const AUTHOR_INJECTION_CLEANUP_EVENT = 'roleplay/author-injection-cleanup' as const
export const AUTHOR_INJECTION_DECLARATION_EVENT = 'roleplay/author-injection-declaration' as const
export interface AuthorInjectionResourceV1 {
  readonly browserSessionId: string
  readonly generation: string
  /** Omitted only for a whole attachment's resource-closed record. */
  readonly pageId?: string
}
export type AuthorInjectionCleanupV1 = {
  readonly schemaVersion: 1
  readonly encoding: 'native-author-injection-cleanup-v1'
  readonly sessionId: string
  readonly programSha256: string
  readonly resource: AuthorInjectionResourceV1
} & (
  | {readonly kind: 'remove-ids'; readonly ids: readonly string[]}
  | {readonly kind: 'resource-closed'}
)

/** Functions remain in the admitted browser realm. Native records retain only
 * their addresses, so restoring a declaration cannot recreate a live filter. */
export interface AuthorInjectionPromptV1 {
  readonly id:string
  readonly position:'in_chat'|'none'
  readonly depth:number
  readonly role:'system'|'user'|'assistant'
  readonly content:string
  readonly should_scan:boolean
  readonly filterCallbackId?:string
}
export interface AuthorInjectionDeclarationV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-injection-declaration-v1'
  readonly sessionId:string
  readonly operationId:string
  readonly programSha256:string
  readonly definition:{readonly logicalOwnerId:string;readonly definitionSha256:string}
  readonly realmId:string
  readonly groupId:string
  readonly resource:AuthorInjectionResourceV1&{readonly pageId:string}
  readonly mutation:
    |{readonly kind:'register';readonly prompts:readonly AuthorInjectionPromptV1[];readonly once:boolean}
    |{readonly kind:'remove-ids';readonly ids:readonly string[];readonly registrationOperationId?:string}
}

declare module 'dsh-nexttavern-native-session/types' {
  interface SessionEventMap {
    'roleplay/author-injection-cleanup': AuthorInjectionCleanupV1
    'roleplay/author-injection-declaration':AuthorInjectionDeclarationV1
  }
}

export function assertAuthorInjectionDeclaration(value:unknown):asserts value is AuthorInjectionDeclarationV1 {
  const data=value as AuthorInjectionDeclarationV1|undefined
  if(!data||data.schemaVersion!==1||data.encoding!=='native-author-injection-declaration-v1'
    ||typeof data.sessionId!=='string'||typeof data.operationId!=='string'||typeof data.programSha256!=='string'
    ||!data.definition||typeof data.definition.logicalOwnerId!=='string'||typeof data.definition.definitionSha256!=='string'
    ||typeof data.realmId!=='string'||typeof data.groupId!=='string'
    ||!data.resource||typeof data.resource.browserSessionId!=='string'||typeof data.resource.generation!=='string'
    ||typeof data.resource.pageId!=='string'||!data.mutation)throw Error('AUTHOR_INJECTION_DECLARATION_INVALID')
  const mutation=data.mutation
  if(mutation.kind==='remove-ids') {
    if(!Array.isArray(mutation.ids)||!mutation.ids.every(id=>typeof id==='string')
      ||mutation.registrationOperationId!==undefined&&typeof mutation.registrationOperationId!=='string')
      throw Error('AUTHOR_INJECTION_DECLARATION_INVALID')
  }else if(mutation.kind==='register') {
    if(typeof mutation.once!=='boolean'||!Array.isArray(mutation.prompts)||!mutation.prompts.every(prompt=>
      prompt&&typeof prompt.id==='string'&&(prompt.position==='none'||prompt.position==='in_chat')
      &&Number.isSafeInteger(prompt.depth)&&prompt.depth>=0
      &&['system','user','assistant'].includes(prompt.role)&&typeof prompt.content==='string'
      &&typeof prompt.should_scan==='boolean'
      &&(prompt.filterCallbackId===undefined||typeof prompt.filterCallbackId==='string')))
      throw Error('AUTHOR_INJECTION_DECLARATION_INVALID')
  }else throw Error('AUTHOR_INJECTION_DECLARATION_INVALID')
}

export function appendAuthorInjectionDeclaration(session:Session,data:AuthorInjectionDeclarationV1)
  :SessionEvent<typeof AUTHOR_INJECTION_DECLARATION_EVENT> {
  if(session.id!==data.sessionId)throw Error('AUTHOR_INJECTION_DECLARATION_SESSION_CHANGED')
  assertAuthorInjectionDeclaration(data)
  return session.append(AUTHOR_INJECTION_DECLARATION_EVENT,data)
}

export const authorInjectionDeclarationMarkers=Object.freeze({eventType:AUTHOR_INJECTION_DECLARATION_EVENT,
  append:appendAuthorInjectionDeclaration,assert:assertAuthorInjectionDeclaration})

/** Decode this durable version only; Core owns Source and resource authority. */
export function assertAuthorInjectionCleanup(value: unknown): asserts value is AuthorInjectionCleanupV1 {
  if (!value || typeof value !== 'object') throw Error('AUTHOR_INJECTION_CLEANUP_INVALID')
  const data = value as AuthorInjectionCleanupV1
  if (data.schemaVersion !== 1 || data.encoding !== 'native-author-injection-cleanup-v1'
    || typeof data.sessionId !== 'string' || typeof data.programSha256 !== 'string'
    || !data.resource || typeof data.resource !== 'object'
    || typeof data.resource.browserSessionId !== 'string' || typeof data.resource.generation !== 'string'
    || data.resource.pageId !== undefined && typeof data.resource.pageId !== 'string'
    || data.kind !== 'remove-ids' && data.kind !== 'resource-closed'
    || data.kind === 'remove-ids' && (!Array.isArray(data.ids) || !data.ids.every(id => typeof id === 'string'))) {
    throw Error('AUTHOR_INJECTION_CLEANUP_INVALID')
  }
}

/** Synchronous required append. The Core owner invalidates its captured input. */
export function appendAuthorInjectionCleanup(
  session: Session,
  data: AuthorInjectionCleanupV1,
): SessionEvent<typeof AUTHOR_INJECTION_CLEANUP_EVENT> {
  return session.append(AUTHOR_INJECTION_CLEANUP_EVENT, data)
}

export const authorInjectionCleanupMarkers = Object.freeze({
  eventType: AUTHOR_INJECTION_CLEANUP_EVENT,
  append: appendAuthorInjectionCleanup,
  assert: assertAuthorInjectionCleanup,
})
