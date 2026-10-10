/** Combined6 is a new DATA contract. The existing Host5 loader does not accept
 * it; actual Source attachment and Native publication remain Core-owned. */
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'
import type {PromptDiagnosticV1} from './tavern-author-prompt-types.mjs'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {CombinedCompilationInputV4,CombinedAuthorProgramV4,CombinedCompilerIdentityV1}
  from './tavern-author-combined-types.mjs'
import type {AuthorScriptResourceDescriptorV1,AuthorScriptResourceReaderV1}
  from './roleplay-author-script-resources.js'

/** Combined6 aggregates Browser3's 24 MiB program, the unchanged server's
 * 4 MiB program, and 4 MiB for Prompt1/original descriptors/plan metadata.
 * This descriptor budget does not enlarge an execution envelope or Source
 * material: the existing DATA owner accounts Source separately at 64 MiB.
 * The current 16 MiB Journal/Host transport is not a Combined6 consumer yet. */
export const COMBINED_AUTHOR_DATA_BOUNDS_V6=Object.freeze({descriptorBytes:32*1_048_576,
  descriptorNodes:1_048_576,descriptorDepth:96,descriptorArrayLength:131_072})

export interface CombinedCompilationInputV6 extends Omit<CombinedCompilationInputV4,'schemaVersion'|'encoding'> {
  readonly schemaVersion:6
  readonly encoding:'native-author-combined-compilation-input-v6'
}
/** Nested server ABI4, Prompt1 and Browser3 retain their own compiler/runtime
 * identities and historical program hashes. No identity is a live grant. */
export interface CombinedAuthorProgramV6 extends Omit<CombinedAuthorProgramV4,'schemaVersion'|'encoding'|'browserProgram'> {
  readonly schemaVersion:6
  readonly encoding:'native-author-combined-program-v6'
  readonly browserProgram:BrowserProgramV3|null
}
export type CombinedCompilationV6={readonly kind:'compiled';readonly program:CombinedAuthorProgramV6}
  |{readonly kind:'refused';readonly diagnostics:readonly (MvuSchemaDiagnostic|BrowserDiagnosticV1|PromptDiagnosticV1)[]}
/** This callback belongs to the Core invocation's already captured Source.
 * It is never stored on a shared runtime or serialized as program authority. */
export type CombinedSourceResourcesV6=(source:CombinedAuthorProgramV6['original']['source'],
  pins:readonly AuthorScriptResourceDescriptorV1[])=>AuthorScriptResourceReaderV1
export interface CombinedAuthorCompilerV6 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV6,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<CombinedCompilationV6>
  verifyProgram(program:CombinedAuthorProgramV6,signal?:AbortSignal,resources?:CombinedSourceResourcesV6):Promise<boolean>
}
