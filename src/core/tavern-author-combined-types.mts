/** Complete author compilation DATA. Host5 is independent of the guest ABI4;
 * neither a stored program nor a plan can authorize Native or Browser use. */
import type {MvuSchemaCompilationInputV4,MvuSchemaProgramV4}
  from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {BrowserProgramV1,BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'

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
