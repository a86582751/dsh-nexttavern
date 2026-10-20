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
import type {PromptProgramV1} from './tavern-author-prompt-types.mjs'
import type {BrowserProgramV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'

export function captureRoleplayTavernInjectionDefinitionsV1(source:TavernLoreSourceDataV1,
  plan:TavernLorePlanV1,residual:AuthorContributionDataV1,promptProgram?:PromptProgramV1,
  browserProgram?:BrowserProgramV2|BrowserProgramV3,
  authorSources?:readonly {pointer:string;text:string}[]) {
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
  const author=authorSources??[['cards',residual.cardsText],['rules',residual.rulesText],['examples',residual.examplesText]]
    .map(([field,text])=>({pointer:`/native/current-author/${field}`,text:text!}))
  for(const {pointer,text} of author) {
    // Retain accepted aggregate identities; field Sources use their full pointer
    // so /data/description and /data/personality cannot share an empty owner.
    const field=pointer.match(/^\/native\/current-author\/(cards|rules|examples)$/)?.[1]??recordSha256({pointer}),
      logicalOwnerId=`source-${owner}:author-${field}`
    byKey.set(pointer,Object.freeze({logicalOwnerId,definitionSha256:recordSha256({logicalOwnerId,
      text,includeCardStyle:residual.includeCardStyle})}))
  }
  const logicalOwnerId=`source-${owner}:generation-prompt`
  const generationDefinition=browserProgram?Object.freeze({logicalOwnerId,definitionSha256:recordSha256({
    schemaVersion:3,encoding:'native-author-generation-definition-v3',logicalOwnerId,
    browserProgramSha256:browserProgram.programSha256,promptProgramSha256:promptProgram?.programSha256??null,
  }),...browserProgram.schemaVersion===3?{browserProgramV3Sha256:browserProgram.programSha256}:{}}):promptProgram?Object.freeze({logicalOwnerId,
    definitionSha256:recordSha256({logicalOwnerId,programSha256:promptProgram.programSha256})}):undefined
  const browserDefinition=browserProgram?generationDefinition:undefined,
    promptDefinition=promptProgram?generationDefinition:undefined
  // Both producers share one Source generation ID space and one definition.
  // The catalog contains it once; each typed producer receives its same ref.
  return {definitions:Object.freeze([...byKey.values(),...generationDefinition?[generationDefinition]:[]]),
    browserDefinition,promptDefinition,
    definitionFor(pointer:string,entryId:string|undefined) {
    const value=byKey.get(entryId??pointer)
    if(!value)throw Error('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_UNAVAILABLE')
    return value
  }}
}
