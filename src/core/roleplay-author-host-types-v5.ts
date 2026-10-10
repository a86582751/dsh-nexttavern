/** Host5 binds the complete author program to real server ABI4 execution.
 * Durable records remain facts; the live replay owner's private evidence
 * still owns publication. Browser readiness is a separate Core lifecycle. */
import type {CombinedAuthorProgram,CombinedCompilationInput,AuthorExecutionPlan} from './tavern-author-combined-types.mjs'
import type {MvuSchemaProgramV4} from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuSchemaRunnerIdentity} from './tavern-mvu-schema-types.js'
import type {MvuSchemaRealmLoadFrameV4,MvuSchemaTraceRequestedStepV4,MvuSchemaTraceEvaluationStepV4}
  from './tavern-mvu-schema-types-v4.js'
import type {SourceNativeCutFacts,SchemaExecutionAnchor,SchemaJournalRef,SchemaNativeMarkerRef}
  from './roleplay-mvu-schema-journal.js'
import type {MvuSchemaOpeningPreparationV1} from './roleplay-mvu-schema-opening-types.js'
import type {SchemaMvuInitDataSourceV2} from './tavern-mvu-initvar.js'
import type {SchemaExecutionSelector} from './roleplay-mvu-schema-replay.js'

export interface AuthorHostIdentityV5 {
  readonly id:'native-author-host'
  readonly version:5
  readonly implementationSha256:string
}
export interface AuthorServerExecutorV4 {
  readonly compiler:MvuSchemaProgramV4['compiler']
  readonly bridge:MvuSchemaProgramV4['bridge']
  readonly libraries:MvuSchemaProgramV4['libraries']
  readonly stateLoader:MvuSchemaProgramV4['stateLoader']
  readonly runner:MvuSchemaRunnerIdentity&{readonly version:4}
}
export interface AuthorOpeningPreparationV5 extends Omit<MvuSchemaOpeningPreparationV1,
  'schemaVersion'|'encoding'|'preparationSha256'> {
  readonly schemaVersion:5
  readonly encoding:'native-author-opening-preparation-v5'
  readonly host:AuthorHostIdentityV5
  readonly compilation:CombinedCompilationInput
  readonly preparationSha256:string
}
export interface AuthorOpeningPreparationV6 extends Omit<AuthorOpeningPreparationV5,
  'schemaVersion'|'encoding'|'initSource'> {
  readonly schemaVersion:6
  readonly encoding:'native-author-opening-preparation-v6'
  readonly initSource:SchemaMvuInitDataSourceV2
  /** The first selector retains the realm's original load provenance. */
  readonly phaseSelectors:readonly [
    {readonly phase:'initialization';readonly selector:SchemaExecutionSelector},
    {readonly phase:'command-parsed';readonly selector:SchemaExecutionSelector},
    {readonly phase:'commands-parsed';readonly selector:SchemaExecutionSelector},
    {readonly phase:'update-ended';readonly selector:SchemaExecutionSelector},
  ]
}
export interface AuthorFrozenOriginalV5 {
  readonly schemaVersion:5
  readonly encoding:'native-author-frozen-original-v5'
  readonly sessionId:string
  /** One preparation owns the frozen snapshot and the complete input. */
  readonly preparation:AuthorOpeningPreparationV5|AuthorOpeningPreparationV6
  readonly combinedProgramSha256:string
  /** Small projection metadata from the same checked epoch. Complete raw
   * descriptors remain in preparation; scope reads never infer membership. */
  readonly executionPlan:AuthorExecutionPlan
  readonly serverProgramSha256:string
  readonly realmEpoch:string
  readonly originalSha256:string
}
interface AuthorHostRecordHeaderV5 {
  readonly schemaVersion:5
  readonly sessionId:string
  readonly realmEpoch:string
  readonly recordSha256:string
}
export interface AuthorHostEpochV5 extends AuthorHostRecordHeaderV5 {
  readonly encoding:'native-mvu-schema-epoch-v5'
  readonly host:AuthorHostIdentityV5
  readonly program:CombinedAuthorProgram
  /** Only real nonempty server execution creates a numerical Host5 epoch.
   * Browser-only compilation has no synthetic load or zero-step receipt. */
  readonly server:{readonly executor:AuthorServerExecutorV4;
    readonly loadFrame:MvuSchemaRealmLoadFrameV4;readonly loadAnchorSha256:string}
}
export interface AuthorHostDispatchV5 extends AuthorHostRecordHeaderV5 {
  readonly encoding:'native-mvu-schema-dispatch-v5'
  readonly batchId:string
  readonly ordinal:number
  readonly epoch:SchemaJournalRef
  readonly combinedProgramSha256:string
  readonly serverProgramSha256:string
  readonly previousTailSha256:string
  readonly requestedStep:MvuSchemaTraceRequestedStepV4
  readonly sourceNativeCut:SourceNativeCutFacts
}
export interface AuthorHostCompletionV5 extends AuthorHostRecordHeaderV5 {
  readonly encoding:'native-mvu-schema-completion-v5'
  readonly batchId:string
  readonly dispatch:SchemaJournalRef
  readonly dispatchMarker:SchemaNativeMarkerRef
  readonly combinedProgramSha256:string
  readonly serverProgramSha256:string
  readonly runner:AuthorServerExecutorV4['runner']
  readonly step:MvuSchemaTraceEvaluationStepV4
}
export interface AuthorHostUnavailableV5 extends AuthorHostRecordHeaderV5 {
  readonly encoding:'native-mvu-schema-unavailable-v5'
  readonly batchId:string
  readonly dispatch:SchemaJournalRef|null
  readonly sourceNativeCut:SourceNativeCutFacts
  readonly combinedProgramSha256:string
  readonly code:string
}
export type AuthorHostRecordV5=AuthorHostEpochV5|AuthorHostDispatchV5
  |AuthorHostCompletionV5|AuthorHostUnavailableV5
export interface AuthorHostAssociationV5 {
  readonly schemaVersion:5
  readonly encoding:'native-author-host-association-v5'
  readonly sessionId:string
  readonly realmEpoch:string
  readonly batchId:string
  readonly anchor:SchemaExecutionAnchor
  readonly sourceNativeCutSha256:string
  readonly combinedProgramSha256:string
  readonly serverProgramSha256:string
  readonly epoch:SchemaJournalRef
  readonly dispatch:SchemaJournalRef
  readonly completion:SchemaJournalRef
  readonly dispatchMarker:SchemaNativeMarkerRef
  readonly completionMarker:SchemaNativeMarkerRef
  readonly serverTailSha256:string
  readonly hostFrontierSha256:string
  readonly outputSha256:string
}
