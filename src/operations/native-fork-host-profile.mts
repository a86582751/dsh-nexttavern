/** Host payload membership belongs to the assembly recipes; activation remains manual. */
export const HOST_VERSION='0.1.7-rc.2'

/** Historical unprofiled inventories and schema 1 receipts retain their original members. */
export const NATIVE_FORKS=[
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-agent-loop',
] as const

export type HostForkProfileDescriptorV1={
  schemaVersion:1
  encoding:'owned-native-host-fork-profile-v1'
  id:'nexttavern-owned-author-dialog-v1'
  hostVersion:typeof HOST_VERSION
  activation:'manual-only'
}
export type HostForkProfileV1=HostForkProfileDescriptorV1 & {members:string[]}

function descriptor(value:unknown):HostForkProfileDescriptorV1{
  const row=value as Partial<HostForkProfileDescriptorV1>|null
  if(!row||row.schemaVersion!==1||row.encoding!=='owned-native-host-fork-profile-v1'||
    row.id!=='nexttavern-owned-author-dialog-v1'||row.hostVersion!==HOST_VERSION||
    row.activation!=='manual-only')throw Error('Unsupported host fork profile')
  return {schemaVersion:1,encoding:row.encoding,id:row.id,hostVersion:row.hostVersion,
    activation:row.activation}
}

/** Called once while writing an inventory. No second package-name list is maintained. */
export function makeHostForkProfile(value:HostForkProfileDescriptorV1,
  recipes:readonly {name:string}[]):HostForkProfileV1{
  return readHostForkProfile({...value,members:recipes.map(recipe=>recipe.name)})!
}

/** Parse the durable inventory boundary; undefined identifies the historical payload. */
export function readHostForkProfile(value:unknown):HostForkProfileV1|undefined{
  if(value===undefined)return undefined
  const profile=descriptor(value)
  const members=(value as {members?:unknown}).members
  if(!Array.isArray(members)||members.length===0||
    members.some(name=>typeof name!=='string'||!/^@deepseek-ai\/dsh-[a-z0-9-]+$/.test(name))||
    new Set(members).size!==members.length)throw Error('Invalid host fork profile members')
  return {...profile,members:[...members]}
}

/** Consumers use the parsed member set; old receipts remain a three-member contract. */
export const hostForkNames=(profile?:HostForkProfileV1):readonly string[]=>profile?.members??NATIVE_FORKS
