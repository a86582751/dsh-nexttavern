/** Complete author compilation DATA. Host5 is independent of the guest ABI4;
 * neither a stored program nor a plan can authorize Native or Browser use. */
import type {MvuSchemaCompilationInputV4,MvuSchemaProgramV4}
  from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {BrowserProgramV1,BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'
import type {PromptProgramV1,PromptDiagnosticV1} from './tavern-author-prompt-types.mjs'

export interface CombinedCompilerIdentityV1 {
  readonly id:'native-author-combined-compiler'
  readonly version:1
  readonly hostProtocol:5
  readonly implementationSha256:string
}
export type CombinedPlanRowV2={
  readonly originalOrdinal:number
  readonly identity:string
  readonly pointer:string
  readonly enabled:boolean
  readonly sourceSha256:string
  readonly rawDescriptorSha256:string
} & (
  |{readonly disposition:'server';readonly serverIndex:number;
    readonly classification:'server-schema'|'native-state-loader'}
  |{readonly disposition:'browser';readonly browserIndex:number}
  |{readonly disposition:'disabled-source-retained';readonly browserIndex:number}
)
export interface AuthorExecutionPlanV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-complete-execution-plan-v2'
  readonly authority:'compiled-program-data-only'
  readonly scripts:readonly CombinedPlanRowV2[]
  readonly summary:{readonly enabledServerSchema:number;readonly enabledNativeLoaders:number;
    readonly enabledBrowser:number;readonly disabled:number}
  readonly executionPlanSha256:string
}
export interface CombinedCompilationInputV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-combined-compilation-input-v3'
  /** Complete Source and descriptors precede both execution projections. */
  readonly original:MvuSchemaCompilationInputV4
  readonly sourceRecordSessionId:string
}
export interface CombinedAuthorProgramV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-combined-program-v3'
  readonly authority:'compiled-program-data-only'
  readonly compiler:CombinedCompilerIdentityV1
  readonly original:MvuSchemaCompilationInputV4
  readonly sourceRecordSessionId:string
  readonly executionPlan:AuthorExecutionPlanV2
  /** Real compiler4 result, retaining its ordinals, hash and receipt ABI. */
  readonly serverProgram:MvuSchemaProgramV4|null
  readonly browserProgram:BrowserProgramV1|null
  readonly combinedProgramSha256:string
}
export type CombinedCompilationV3={readonly kind:'compiled';readonly program:CombinedAuthorProgramV3}
  |{readonly kind:'refused';readonly diagnostics:readonly (MvuSchemaDiagnostic|BrowserDiagnosticV1)[]}
export interface CombinedAuthorCompilerV3 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV3,signal?:AbortSignal):Promise<CombinedCompilationV3>
  verifyProgram(program:CombinedAuthorProgramV3,signal?:AbortSignal):Promise<boolean>
}

export type CombinedPlanRowV3=CombinedPlanRowV2|(
  Omit<CombinedPlanRowV2,'disposition'>&{readonly disposition:'prompt';readonly promptIndex:number}
)
export interface AuthorExecutionPlanV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-complete-execution-plan-v3'
  readonly authority:'compiled-program-data-only'
  readonly scripts:readonly CombinedPlanRowV3[]
  readonly summary:AuthorExecutionPlanV2['summary']&{readonly enabledPrompt:number}
  readonly executionPlanSha256:string
}
export interface CombinedCompilationInputV4 extends Omit<CombinedCompilationInputV3,'schemaVersion'|'encoding'> {
  readonly schemaVersion:4
  readonly encoding:'native-author-combined-compilation-input-v4'
}
export interface CombinedAuthorProgramV4 extends Omit<CombinedAuthorProgramV3,'schemaVersion'|'encoding'|'executionPlan'> {
  readonly schemaVersion:4
  readonly encoding:'native-author-combined-program-v4'
  readonly executionPlan:AuthorExecutionPlanV3
  readonly promptProgram:PromptProgramV1|null
}
export type CombinedCompilationV4={readonly kind:'compiled';readonly program:CombinedAuthorProgramV4}
  |{readonly kind:'refused';readonly diagnostics:readonly (MvuSchemaDiagnostic|BrowserDiagnosticV1|PromptDiagnosticV1)[]}
export type CombinedCompilationInput=CombinedCompilationInputV3|CombinedCompilationInputV4
export type CombinedAuthorProgram=CombinedAuthorProgramV3|CombinedAuthorProgramV4
export type AuthorExecutionPlan=AuthorExecutionPlanV2|AuthorExecutionPlanV3
export type CombinedCompilation=CombinedCompilationV3|CombinedCompilationV4
/** Host accepts tagged historical inputs. Each actual compiler implements its
 * own input version; a new generation cannot execute a legacy identity. */
export interface CombinedAuthorCompiler {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInput,signal?:AbortSignal):Promise<CombinedCompilation>
  verifyProgram(program:CombinedAuthorProgram,signal?:AbortSignal):Promise<boolean>
}
export interface CombinedAuthorCompilerV4 extends CombinedAuthorCompiler {
  compile(input:CombinedCompilationInput,signal?:AbortSignal):Promise<CombinedCompilationV4>
}
