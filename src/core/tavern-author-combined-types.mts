/** Current author compilation vocabulary. Serialized DATA grants no execution lease. */
export interface CombinedCompilerIdentityV1 {
  readonly id:'native-author-combined-compiler'
  readonly version:1
  readonly hostProtocol:5
  readonly implementationSha256:string
}
export type {CombinedPlanRowV4,AuthorExecutionPlanV4,
  CombinedCompilationInputV8 as CombinedCompilationInput,CombinedAuthorProgramV8 as CombinedAuthorProgram,
  AuthorExecutionPlanV4 as AuthorExecutionPlan,CombinedCompilationV8 as CombinedCompilation,
  CombinedAuthorCompilerV8 as CombinedAuthorCompiler} from './tavern-author-combined-types-v8.mjs'
