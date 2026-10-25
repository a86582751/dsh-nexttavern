/** One deterministic numerical Source encoding. Both today's reader and a
 * frozen inheritance package describe the same owner fields; lore journals,
 * Native work records and numerical publications do not enter this identity. */
import {recordSha256} from './roleplay-data.js'

export interface RoleplayInputSourceCaptureV1 {
  readonly sessionId:string
  readonly pointer:Readonly<Record<string,unknown>>|undefined
  readonly imported:Readonly<Record<string,unknown>>|undefined
  readonly versions:{readonly cards:Readonly<Record<string,string>>;
    readonly worldbook:Readonly<Record<string,string>>;readonly rules:string;readonly settings:string}
  readonly statusSpecSha256:string
  readonly openingSha256:string
  readonly openingContextBindingSha256:string|null
}
export function describeRoleplayInputSourceV1(captured:RoleplayInputSourceCaptureV1) {
  const {sessionId,pointer,imported,versions}=captured,
    cards=pointer?versions.cards:Object.fromEntries(Object.entries(versions.cards).filter(([key])=>key!=='user'))
  return {schemaVersion:1 as const,encoding:'roleplay-input-source-observation-v1' as const,sessionId,
    pointer:pointer??null,importIdentity:imported?{importId:imported['importId'],rawSha256:imported['rawSha256'],
      normalizedSha256:imported['normalizedSha256'],coverage:imported['fieldProof'],activation:imported['activation']}:null,
    versions:{cards,worldbook:versions.worldbook,rules:versions.rules,settings:versions.settings},
    statusSpec:captured.statusSpecSha256,opening:captured.openingSha256,
    openingContext:pointer?captured.openingContextBindingSha256:null}
}
export type RoleplayInputSourceDescriptorV1=ReturnType<typeof describeRoleplayInputSourceV1>
export const roleplayInputSourceSha256V1=(captured:RoleplayInputSourceCaptureV1)=>
  recordSha256(describeRoleplayInputSourceV1(captured))
