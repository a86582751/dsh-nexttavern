import type {ReaderRegexDocumentOriginV1,ReaderWorldbookDocumentOriginV1,ReaderRegexDocumentSourceV1,ReaderRegexDocumentFailureV1,
  ReaderWorldbookDocumentFailureV1,ReaderWorldbookProducerFactsV1,ReaderRegexDocumentSnapshotV1,
  ReaderRegexDocumentBindingV1} from './reader-regex-document-types.mjs'
import type {AuthorNativeDiagnosticV1} from './author-native-helper-types.js'
import type {AuthorReaderSurface} from './tavern-author-reader-surface.js'
import type {ReaderRegexDocumentHostV1,ReaderRegexDocumentRenderV1} from './reader-regex-document-types.mjs'

/** Core captures these bytes from Source or an owned EJS producer. Model
 * display HTML must never be promoted to this contract. DATA slots have already
 * been escaped by the capturing owner; this transport grants no write rights. */
export interface ReaderNativeDocumentPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-native-document-plan-v1'
  /** Hash of this native-plan payload, minted by its capturing owner. Never an
   * old AST-plan hash relabelled as native execution evidence. */
  readonly documentPlanSha256:string
  readonly origin:ReaderRegexDocumentOriginV1|ReaderWorldbookDocumentOriginV1
  readonly html:string
  readonly writes:'source-regex'|'none'
}

export interface ReaderNativeDocumentCompilationV1 {
  readonly documents:readonly ReaderNativeDocumentPlanV1[]
  readonly documentInputIndices:readonly number[]
  /** Ephemeral owner mapping; consumers never rediscover failures by hashing
   * or rescanning their Source/message identity. */
  readonly documentFailures:readonly {readonly inputIndex:number;readonly diagnostics:readonly AuthorNativeDiagnosticV1[]}[]
  readonly failedDocuments?:readonly ReaderRegexDocumentFailureV1[]
  readonly failedWorldbookDocuments?:readonly ReaderWorldbookDocumentFailureV1[]
  readonly worldbookProducers?:readonly ReaderWorldbookProducerFactsV1[]
}

export interface ReaderNativeDocumentProfileV1 {
  readonly id:'reader-native-browser'
  readonly version:1
  readonly browser:'supplied'
  readonly modelRequests:'none'
  readonly writes:'owned-source-regex'
  readonly readSemantics:'live'
  readonly writeBasis:'explicit-message-read'
  readonly receipt:'guest-observed-not-callback-ended'
}

export interface ReaderNativeDocumentProgramV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-native-document-program-v1'
  readonly authority:'captured-reader-source-only'
  readonly source:ReaderRegexDocumentSourceV1
  readonly profile:ReaderNativeDocumentProfileV1
  readonly documents:readonly ReaderNativeDocumentPlanV1[]
  readonly failedDocuments?:readonly ReaderRegexDocumentFailureV1[]
  readonly failedWorldbookDocuments?:readonly ReaderWorldbookDocumentFailureV1[]
  readonly worldbookProducers?:readonly ReaderWorldbookProducerFactsV1[]
  readonly programSha256:string
}

export interface ReaderNativeDocumentExecutionV1 {
  readonly backend:'browser-native-v1'
  readonly program:ReaderNativeDocumentProgramV1
  readonly snapshot:ReaderRegexDocumentSnapshotV1
  readonly binding?:ReaderRegexDocumentBindingV1
  /** Permission groups have distinct origins even when they share a Surface. */
  readonly parentOrigins:Readonly<Partial<Record<ReaderNativeDocumentPlanV1['writes'],string>>>
}

/** Frozen product library bytes, executed by the browser in the author realm.
 * This is not a DOM/library emulation or a per-card script classifier. */
export interface ReaderNativeLibraryV1 {
  readonly name:string
  readonly javascript:string
}

/** A receipt observed by the author realm is weaker than an ended callback.
 * Unavailable observation never changes the Core's durable operation result. */
export type ReaderNativeReceiptObservationV1='none'|'observed'|'unavailable'

export interface ReaderNativeFrameLifecycleV1 {
  readonly backend:'native-browser'
  readonly bridgeRevoked:Promise<void>
  readonly framesRemoved:Promise<void>
  readonly hardTermination:'unavailable'
}

/** Native Reader bridge contract, independent of AST artifacts and VM frames. */
export interface ReaderNativeFrameOptionsV1 {
  readonly surface?:AuthorReaderSurface
  readonly host?:ReaderRegexDocumentHostV1
  readonly startupDeadlineMs:number
  current():boolean
  layout(value:{height:number;renderRevision:number}):void
  diagnostic(code:string):void
  failed?(code:string):void
  onImages?(pageId:string,images:readonly ReaderNativeImageV1[]):void
  mountStaticDocument(container:HTMLElement,html:string,layout:()=>void):{dispose():void}
}
export interface ReaderNativeDocumentFrameControllerV1 {
  readonly started:Promise<void>
  readonly disposed:Promise<void>
  readonly lifecycle:ReaderNativeFrameLifecycleV1
  publishSnapshot(snapshot:ReaderRegexDocumentSnapshotV1):void
  render(value:ReaderRegexDocumentRenderV1):void
  waitForReceiptObservation():Promise<ReaderNativeReceiptObservationV1>
  waitForAdmittedSourceWrites():Promise<void>
  dispose():void
}

/** Actual page image observation DATA; this numeric identity is not a VM handle route. */
export interface ReaderNativeImageV1 {
  readonly target:{readonly handle:number}
  readonly originalUrl:string
  readonly url:string
  readonly name:string
}
