/** Combined7 retains every original declaration, including known external
 * add-ons that have no runtime. A disposition is DATA, never execution proof. */
import type {CombinedPlanRowV3,AuthorExecutionPlanV3,CombinedCompilerIdentityV1}
  from './tavern-author-combined-types.mjs'
import type {CombinedCompilationInputV6,CombinedAuthorProgramV6,CombinedCompilationV6,CombinedSourceResourcesV6}
  from './tavern-author-combined-types-v6.mjs'
import {COMBINED_AUTHOR_DATA_BOUNDS_V6} from './tavern-author-combined-types-v6.mjs'
import type {ExternalAddonDependencyV1} from './tavern-author-external-addons.mjs'
import type {EXTERNAL_ADDON_RUNTIME_UNAVAILABLE} from './tavern-author-external-addons.mjs'

export const COMBINED_AUTHOR_DATA_BOUNDS_V7=COMBINED_AUTHOR_DATA_BOUNDS_V6
export type CombinedPlanRowV4=CombinedPlanRowV3|(
  Pick<CombinedPlanRowV3,'originalOrdinal'|'identity'|'pointer'|'sourceSha256'|'rawDescriptorSha256'>&{
    readonly enabled:true
    readonly disposition:'external-addon-unavailable'
    readonly dependency:ExternalAddonDependencyV1
    readonly reason:typeof EXTERNAL_ADDON_RUNTIME_UNAVAILABLE
  }
)
export interface AuthorExecutionPlanV4 {
  readonly schemaVersion:4
  readonly encoding:'native-author-source-disposition-plan-v4'
  readonly authority:'compiled-program-data-only'
  readonly scripts:readonly CombinedPlanRowV4[]
  readonly summary:AuthorExecutionPlanV3['summary']&{readonly enabledExternalAddonsUnavailable:number}
  readonly executionPlanSha256:string
}
export interface CombinedCompilationInputV7 extends Omit<CombinedCompilationInputV6,'schemaVersion'|'encoding'> {
  readonly schemaVersion:7
  readonly encoding:'native-author-combined-compilation-input-v7'
}
export interface CombinedAuthorProgramV7 extends Omit<CombinedAuthorProgramV6,'schemaVersion'|'encoding'|'executionPlan'> {
  readonly schemaVersion:7
  readonly encoding:'native-author-combined-program-v7'
  readonly executionPlan:AuthorExecutionPlanV4
}
export type CombinedCompilationV7={readonly kind:'compiled';readonly program:CombinedAuthorProgramV7}
  |Extract<CombinedCompilationV6,{kind:'refused'}>
export interface CombinedAuthorCompilerV7 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV7,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<CombinedCompilationV7>
  verifyProgram(program:CombinedAuthorProgramV7,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<boolean>
}
