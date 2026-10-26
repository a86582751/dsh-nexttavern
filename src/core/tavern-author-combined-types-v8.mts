/** Combined8 connects complete Browser execution to owned numerical state.
 * The source disposition remains V4; an owned state program has no script row. */
import type {CombinedCompilerIdentityV1} from './tavern-author-combined-types.mjs'
import type {CombinedCompilationInputV7,CombinedAuthorProgramV7,CombinedCompilationV7}
  from './tavern-author-combined-types-v7.mjs'
import type {CombinedSourceResourcesV6} from './tavern-author-combined-types-v6.mjs'
import {COMBINED_AUTHOR_DATA_BOUNDS_V7} from './tavern-author-combined-types-v7.mjs'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'

export const COMBINED_AUTHOR_DATA_BOUNDS_V8=COMBINED_AUTHOR_DATA_BOUNDS_V7
export interface CombinedCompilationInputV8 extends Omit<CombinedCompilationInputV7,'schemaVersion'|'encoding'> {
  readonly schemaVersion:8
  readonly encoding:'native-author-combined-compilation-input-v8'
}
export interface CombinedAuthorProgramV8 extends Omit<CombinedAuthorProgramV7,
  'schemaVersion'|'encoding'|'serverProgram'> {
  readonly schemaVersion:8
  readonly encoding:'native-author-combined-program-v8'
  readonly serverProgram:MvuExecutableProgramV4|null
}
export type CombinedCompilationV8={readonly kind:'compiled';readonly program:CombinedAuthorProgramV8}
  |Extract<CombinedCompilationV7,{kind:'refused'}>
export interface CombinedAuthorCompilerV8 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV8,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<CombinedCompilationV8>
  verifyProgram(program:CombinedAuthorProgramV8,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<boolean>
}
