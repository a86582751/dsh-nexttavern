/** A numerical program with no author execution or schema registration.
 * Its Browser binding is reconstructed from the full original Combined input. */
import type {MvuSchemaProgramV4,MvuSchemaCompilationInputV4}
  from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuSchemaCandidateCompilerV4} from './tavern-mvu-schema-program-v4.js'
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'

export interface OwnedMvuStateExecutionPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-owned-state-execution-plan-v1'
  readonly browserProgramSha256:string
  readonly dependencyGroup:'B'
  readonly phaseAbi:4
  readonly errorPolicy:'update-batch-atomic-v1'
  readonly registrationPolicy:'none'
  readonly executionPlanSha256:string
}
export interface OwnedMvuStateProgramV1 extends Pick<MvuSchemaProgramV4,
  'source'|'compiler'|'bridge'|'stateLoader'|'libraries'> {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-owned-state-program-v1'
  readonly executionPlan:OwnedMvuStateExecutionPlanV1
  readonly programSha256:string
}
export type MvuExecutableProgramV4=MvuSchemaProgramV4|OwnedMvuStateProgramV1

/** Trusted compiler closure only: callers pass its same captured original and
 * the Browser result from that compilation, never a deserialized proof. */
export interface MvuOwnedStateCandidateCompilerV1 extends MvuSchemaCandidateCompilerV4 {
  assembleOwnedStateProgram(original:MvuSchemaCompilationInputV4,
    browserProgram:BrowserProgramV3):OwnedMvuStateProgramV1
}
