/** Combined5 changes the Browser projection, retaining the original Host5,
 * server ABI4, stateless Prompt1 and complete execution plan3 contracts. */
import type {BrowserProgramV2,BrowserDiagnosticV2} from './tavern-author-browser-types-v2.mjs'
import type {PromptDiagnosticV1} from './tavern-author-prompt-types.mjs'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {CombinedCompilationInputV3,CombinedCompilationInputV4,
  CombinedAuthorProgramV3,CombinedAuthorProgramV4,CombinedCompilerIdentityV1}
  from './tavern-author-combined-types.mjs'

export interface CombinedCompilationInputV5 extends Omit<CombinedCompilationInputV4,'schemaVersion'|'encoding'> {
  readonly schemaVersion:5
  readonly encoding:'native-author-combined-compilation-input-v5'
}
export interface CombinedAuthorProgramV5 extends Omit<CombinedAuthorProgramV4,'schemaVersion'|'encoding'|'browserProgram'> {
  readonly schemaVersion:5
  readonly encoding:'native-author-combined-program-v5'
  readonly browserProgram:BrowserProgramV2|null
}
export type CombinedCompilationV5={readonly kind:'compiled';readonly program:CombinedAuthorProgramV5}
  |{readonly kind:'refused';readonly diagnostics:readonly (MvuSchemaDiagnostic|BrowserDiagnosticV2|PromptDiagnosticV1)[]}
export interface CombinedAuthorCompilerV5 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV3|CombinedCompilationInputV4|CombinedCompilationInputV5,
    signal?:AbortSignal):Promise<CombinedCompilationV5>
  verifyProgram(program:CombinedAuthorProgramV3|CombinedAuthorProgramV4|CombinedAuthorProgramV5,
    signal?:AbortSignal):Promise<boolean>
}
