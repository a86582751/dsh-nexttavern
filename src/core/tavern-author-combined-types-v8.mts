/** Complete current author Source, projections and disposition DATA. */
import type {CombinedCompilerIdentityV1} from './tavern-author-combined-types.mjs'
import type {MvuSchemaCompilationInputV4} from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {AuthorNativeProgramV1,AuthorNativeLayoutV1} from './author-native-program.mjs'
import type {ExternalAddonDependencyV1,EXTERNAL_ADDON_RUNTIME_UNAVAILABLE} from './tavern-author-external-addons.mjs'

/** Aggregate descriptor budget for native Source and ABI4. Source material
 * retains its independent budget and owner. This does not enlarge transport. */
export const COMBINED_AUTHOR_DATA_BOUNDS_V8=Object.freeze({descriptorBytes:32*1_048_576,
  descriptorNodes:1_048_576,descriptorDepth:96,descriptorArrayLength:131_072})
interface CombinedPlanScript {
  readonly originalOrdinal:number
  readonly identity:string
  readonly pointer:string
  readonly enabled:boolean
  readonly sourceSha256:string
  readonly rawDescriptorSha256:string
}
export type CombinedPlanRowV4=CombinedPlanScript&(
  |{readonly disposition:'server';readonly serverIndex:number;readonly classification:'server-schema'|'native-state-loader'}
  |{readonly disposition:'native';readonly nativeIndex:number}
  |{readonly disposition:'disabled-source-retained';readonly nativeIndex:number}
  |{readonly enabled:true;readonly disposition:'external-addon-unavailable';readonly dependency:ExternalAddonDependencyV1;
    readonly reason:typeof EXTERNAL_ADDON_RUNTIME_UNAVAILABLE}
)
export interface AuthorExecutionPlanV4 {
  readonly schemaVersion:4
  readonly encoding:'native-author-source-disposition-plan-v4'
  readonly authority:'compiled-program-data-only'
  readonly scripts:readonly CombinedPlanRowV4[]
  readonly summary:{readonly enabledServerSchema:number;readonly enabledNativeLoaders:number;
    readonly enabledNative:number;readonly disabled:number;
    readonly enabledExternalAddonsUnavailable:number}
  readonly executionPlanSha256:string
}
export interface CombinedCompilationInputV8 {
  readonly schemaVersion:8
  readonly encoding:'native-author-combined-compilation-input-v8'
  readonly original:MvuSchemaCompilationInputV4
  readonly sourceRecordSessionId:string
  readonly nativeLayout:AuthorNativeLayoutV1
}
export interface CombinedAuthorProgramV8 {
  readonly schemaVersion:8
  readonly encoding:'native-author-combined-program-v8'
  readonly authority:'compiled-program-data-only'
  readonly compiler:CombinedCompilerIdentityV1
  readonly original:MvuSchemaCompilationInputV4
  readonly sourceRecordSessionId:string
  readonly nativeLayout:AuthorNativeLayoutV1
  readonly executionPlan:AuthorExecutionPlanV4
  readonly serverProgram:MvuExecutableProgramV4|null
  readonly nativeProgram:AuthorNativeProgramV1|null
  readonly combinedProgramSha256:string
}
export type CombinedCompilationV8={readonly kind:'compiled';readonly program:CombinedAuthorProgramV8}
  |{readonly kind:'refused';readonly diagnostics:readonly MvuSchemaDiagnostic[]}
export interface CombinedAuthorCompilerV8 {
  readonly identity:CombinedCompilerIdentityV1
  compile(input:CombinedCompilationInputV8,signal?:AbortSignal):Promise<CombinedCompilationV8>
  verifyProgram(program:CombinedAuthorProgramV8,signal?:AbortSignal):Promise<boolean>
}
