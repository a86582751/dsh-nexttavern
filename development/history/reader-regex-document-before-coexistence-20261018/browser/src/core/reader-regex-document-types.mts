/** Ephemeral Reader Source projections. These tags never enter Browser3,
 * Combined6, HTML1 or a journal epoch. A live Reader still owns attachment. */
import type {SourceHtmlDocumentDataV1} from './tavern-author-html-compiler-v1.mjs'
import type {BrowserRuntimeArtifactV3,BrowserRuntimeIdentityV3,BrowserCompilerIdentityV3,
  BrowserCapabilityV3,BrowserPageResourceV3,BrowserSnapshotV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'
import type {TavernPromptDisplayPartV1} from './tavern-prompt-transform-types.mjs'

export interface ReaderRegexDocumentSourceV1 {
  readonly sessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly sourceSnapshotSha256:string
  readonly materialSha256:string
}
export interface ReaderRegexDocumentMessageV1 {
  readonly seq:number
  readonly messageId:string
  readonly messageVersionSha256:string
  readonly depth:number
  readonly isEdit:boolean
}
export interface ReaderRegexDocumentInputV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-input-v1'
  readonly source:ReaderRegexDocumentSourceV1
  readonly documents:readonly {
    readonly regex:{readonly ordinal:number;readonly id:string;readonly pointer:string;
      readonly descriptorSha256:string;readonly replacement:string}
    readonly message:ReaderRegexDocumentMessageV1
    readonly replacementSpan:{readonly start:number;readonly end:number}
    /** Actual display replacement callback retained these Source literals and
     * captured text separately; final model HTML is never an input. */
    readonly parts:readonly TavernPromptDisplayPartV1[]
  }[]
}
export interface ReaderRegexDocumentOriginV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-origin-v1'
  readonly source:ReaderRegexDocumentSourceV1
  readonly regex:{readonly ordinal:number;readonly id:string;readonly pointer:string;
    readonly descriptorSha256:string;readonly replacementSha256:string;
    readonly htmlSpan:{readonly start:number;readonly end:number}}
  readonly message:ReaderRegexDocumentMessageV1
  readonly replacementSpan:{readonly start:number;readonly end:number}
  /** Exact HTML span from Source replaceString, before captured text slots. */
  readonly htmlSha256:string
  readonly htmlUtf8Bytes:number
  readonly htmlUtf16Length:number
}
export interface ReaderRegexDocumentPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-plan-v1'
  readonly authority:'compiled-reader-data-only'
  readonly origin:ReaderRegexDocumentOriginV1
  readonly parsed:SourceHtmlDocumentDataV1
  readonly resources:readonly BrowserPageResourceV3[]
  readonly scripts:readonly {readonly inlineOrdinal:number;readonly javascriptSha256:string;
    readonly coverageSha256:string;readonly requiredCapabilities:readonly BrowserCapabilityV3[]}[]
  readonly requiredCapabilities:readonly BrowserCapabilityV3[]
  readonly pagePlanSha256:string
}
export interface ReaderRegexDocumentProfileV1 {
  readonly id:'nexttavern-reader-regex-document'
  readonly version:1
  readonly absentGlobals:readonly ['indexedDB']
  readonly sourceReads:'captured-source-and-selected-native-scope-frame'
  readonly writes:'none'
  readonly modelRequests:'none'
  readonly sha256:string
}
export interface ReaderRegexDocumentProgramV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-program-v1'
  readonly authority:'compiled-reader-data-only'
  readonly source:ReaderRegexDocumentSourceV1
  readonly compiler:{readonly id:'reader-regex-document-compiler';readonly version:1;
    readonly implementationSha256:string;readonly shared:BrowserCompilerIdentityV3}
  readonly runtime:BrowserRuntimeIdentityV3
  readonly profile:ReaderRegexDocumentProfileV1
  readonly documents:readonly ReaderRegexDocumentPlanV1[]
  readonly programSha256:string
}
export type ReaderRegexDocumentCompilationV1={readonly kind:'compiled';readonly program:ReaderRegexDocumentProgramV1}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV1[]}
export interface ReaderRegexDocumentCompilerV1 {
  compileReaderDocument(input:ReaderRegexDocumentInputV1,signal?:AbortSignal):Promise<ReaderRegexDocumentCompilationV1>
}
export interface ReaderRegexDocumentSnapshotV1 extends Omit<BrowserSnapshotV3,'schemaVersion'|'encoding'> {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-snapshot-v1'
}
export interface ReaderRegexDocumentReadFactsV1 {
  readonly kind:'reader-regex-document-facts'
  readonly data:Omit<ReaderRegexDocumentSnapshotV1,'generation'|'readRevision'>
  current():boolean
}
/** Current default package owns these bytes. A historical epoch's artifact
 * cannot stand in for the independent Reader implementation. */
export interface ReaderRegexDocumentExecutionV1 {
  readonly program:ReaderRegexDocumentProgramV1
  readonly artifact:BrowserRuntimeArtifactV3
  readonly snapshot:ReaderRegexDocumentSnapshotV1
}
export type ReaderRegexDocumentRenderFragmentV1={readonly kind:'text';readonly html:string}
  |{readonly kind:'static-document';readonly html:string}
  |{readonly kind:'reader-document';readonly documentPlanSha256:string}
export interface ReaderRegexDocumentRenderV1 {
  readonly renderRevision:number
  readonly css:string
  readonly parts:readonly ({readonly key:string;readonly kind:'user';readonly text:string}
    |{readonly key:string;readonly kind:'narrator';readonly html:string;
      readonly fragments?:readonly ReaderRegexDocumentRenderFragmentV1[]})[]
}
