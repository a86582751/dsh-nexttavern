/** Logical program definitions come from the same captured import/overlay and
 * author producer as prompt text. Variable snapshots and a keyword miss do
 * not revoke a definition; a real definition edit or disable does. */
import {recordSha256} from './roleplay-data.js'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import type {TavernLorePlanV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {AuthorContributionDataV1} from './roleplay-author-contributions.js'
import type {TavernInjectionDefinitionV1} from './roleplay-tavern-injections.js'

export function captureRoleplayTavernInjectionDefinitionsV1(source:TavernLoreSourceDataV1,
  plan:TavernLorePlanV1,residual:AuthorContributionDataV1) {
  const owner=recordSha256({schemaVersion:1,encoding:'native-logical-template-Source-owner-v1',
    sessionId:source.sessionId,sourceRecordSessionId:source.sourceRecordSessionId,
    importId:source.original.activePointer.importId,rawSha256:source.original.rawSha256,
    documentSha256:source.original.documentSha256,activation:source.original.activePointerRef})
  const byKey=new Map<string,TavernInjectionDefinitionV1>()
  for(const entry of plan.entries) {
    const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,...entry.semanticOverrides}
    if(!semantic.enabled)continue
    const content=resolveTavernLoreContentTextV1(plan,`${entry.sourcePointer}/content`)
    const {content:_content,...controls}=semantic
    const logicalOwnerId=`source-${owner}:lore-${entry.entryId}`
    byKey.set(entry.entryId,Object.freeze({logicalOwnerId,definitionSha256:recordSha256({logicalOwnerId,
      rawEntrySha256:entry.rawEntrySha256,contentSha256:content.contentSha256,controls})}))
  }
  const author=[['cards',residual.cardsText],['rules',residual.rulesText],['examples',residual.examplesText]] as const
  for(const [field,text] of author) {
    const pointer=`/native/current-author/${field}`,logicalOwnerId=`source-${owner}:author-${field}`
    byKey.set(pointer,Object.freeze({logicalOwnerId,definitionSha256:recordSha256({logicalOwnerId,
      text,includeCardStyle:residual.includeCardStyle})}))
  }
  return {definitions:Object.freeze([...byKey.values()]),definitionFor(pointer:string,entryId:string|undefined) {
    const value=byKey.get(entryId??pointer)
    if(!value)throw Error('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_UNAVAILABLE')
    return value
  }}
}
