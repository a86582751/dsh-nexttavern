/** Author programs and execution records are data, never numerical authority.
 * Core proves their immutable Source/Native boundary; its replay owner alone
 * may mint process-private evidence after actual historical execution. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

export const MVU_SCHEMA_BOUNDS=Object.freeze({sourceBytes:1048576,programBytes:4194304,scripts:64,
  syntaxTokens:64000,syntaxDepth:128,inputBytes:8388608,outputBytes:2097152,
  valuesBytes:1048576,dataNodes:32000,dataDepth:32,arrayLength:4096,
  evaluationNodes:131072,evaluationDepth:66,traceSteps:64,
  vmMemoryBytes:134217728,vmStackBytes:1048576,vmDeadlineMs:2000,parentDeadlineMs:5000})
export type MvuSchemaDependencyKind='zod'|'lodash'|'schema-bridge'
export interface MvuSchemaImplementationIdentity {
  id:string
  version:number
  implementationSha256:string
}
export interface MvuSchemaLibraryIdentity {
  kind:'zod'|'lodash'
  packageName:string
  version:string
  bundleSha256:string
  /** Only fixed identifier names owned by the trusted asset provider. */
  globalName:string
}
export interface MvuSchemaLibraryBytes extends MvuSchemaLibraryIdentity {code:string}
export interface MvuSchemaImportBinding {
  specifier:string
  kind:MvuSchemaDependencyKind
  implementationSha256:string
}
export interface MvuSchemaAuthorScript {
  identity:string
  pointer:string
  enabled:boolean
  source:string
  sourceSha256:string
  imports:readonly MvuSchemaImportBinding[]
}
export interface MvuSchemaSourceBinding {
  ownerSessionId:string
  importId:string
  /** Hash of the original PNG/JSON bytes in OpeningSource.rawSha256. Document,
   * script text and author descriptor hashes remain separate identities. */
  sourceSha256:string
  importRecordSha256:string
  sourceSnapshotSha256:string
  /** Complete immutable values/references for every allowed source read. */
  material:MvuJsonObject
  materialSha256:string
}
export interface MvuSchemaCompilerIdentity extends MvuSchemaImplementationIdentity {typescriptVersion:'5.9.3'}
export interface MvuSchemaDiagnostic {
  code:string
  pointer?:string
  scriptIdentity?:string
  line?:number
  column?:number
  /** No original author code, values, stack or arbitrary guest message. */
  issuePath?:readonly (string|number)[]
}
/** The Core driver fixes the supported helper event order. A phase is not an
 * instruction to execute model text; only parsed JSON commands cross here. */
export type MvuSchemaPhase='initialization'|'command-parsed'|'commands-parsed'
  |'update-ended'|'manual-replacement'|'external-pack-replacement'|'hook-reconcile'
/** Realm/cut fields are comparison data supplied by Core, never capabilities.
 * Core must prove the load boundary and complete execution journal, including
 * attempts that changed closures without a successful numerical commit. */
export interface MvuSchemaRealmReadBinding {
  ownerSessionId:string
  sourceNativeCutSha256:string
  /** Allowed read material at this frame; original author-source identity
   * remains program.source and does not change when this material changes. */
  material:MvuJsonObject
}
export interface MvuSchemaRunnerIdentity extends MvuSchemaImplementationIdentity {quickjsVersion:'0.32.0'}
export interface MvuSchemaRunnerDeps {
  identity:MvuSchemaRunnerIdentity
  bridge:MvuSchemaImplementationIdentity
  libraries:readonly MvuSchemaLibraryBytes[]
  workerUrl?:URL
}
export type MvuSchemaJsonValue=MvuJsonValue
