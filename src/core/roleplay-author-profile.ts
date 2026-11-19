/** The actual roleplay Domain owns one identity for its shared author data. */
import {randomUUID} from 'node:crypto'
import {withTavernLock} from './tavern-task-support.js'

export const AUTHOR_PROFILE_IDENTITY_KEY='author-profile-identity-v1'
export interface AuthorProfileIdentityV1 {
  readonly schemaVersion:1
  readonly encoding:'author-profile-identity-v1'
  readonly profileId:string
}
export interface AuthorProfileTableV1 {
  get(key:string):unknown
  put(key:string,value:object):unknown|PromiseLike<unknown>
}

export function readAuthorProfileIdentityV1(table:Pick<AuthorProfileTableV1,'get'>):AuthorProfileIdentityV1|undefined {
  const value=table.get(AUTHOR_PROFILE_IDENTITY_KEY) as AuthorProfileIdentityV1|undefined
  if(value===undefined)return
  if(value.schemaVersion!==1||value.encoding!=='author-profile-identity-v1'
    ||typeof value.profileId!=='string'||!value.profileId)throw Error('AUTHOR_PROFILE_IDENTITY_INVALID')
  return value
}

export async function ensureAuthorProfileIdentityV1(table:AuthorProfileTableV1):Promise<AuthorProfileIdentityV1> {
  return withTavernLock(table,AUTHOR_PROFILE_IDENTITY_KEY,async()=>{
    const previous=readAuthorProfileIdentityV1(table)
    if(previous)return previous
    const value:AuthorProfileIdentityV1=Object.freeze({schemaVersion:1,
      encoding:'author-profile-identity-v1',profileId:randomUUID()})
    try {await table.put(AUTHOR_PROFILE_IDENTITY_KEY,value)}catch(error) {
      if(readAuthorProfileIdentityV1(table)?.profileId!==value.profileId)throw error
    }
    const written=readAuthorProfileIdentityV1(table)
    if(written?.profileId!==value.profileId)throw Error('AUTHOR_PROFILE_IDENTITY_WRITE_UNKNOWN')
    return written
  })
}
