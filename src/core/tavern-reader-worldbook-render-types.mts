import type {TavernEjsHostCapture,TavernEjsHostOutput,TavernEjsHostDiagnostic,TavernEjsResource}
  from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsRuntimeIdentity,TavernEjsRuntimeInput,TavernEjsRuntimeProgram}
  from './tavern-template-ejs-runtime-types.mjs'

/** Only an actual Reader phase owner may retain the isolated program. The
 * default pure producer still closes its program before returning. */
export interface ReaderWorldbookRenderOwnerV1 {
  readonly consumer:'reader-regex-phase-v1'
  retain(program:TavernEjsRuntimeProgram,input:TavernEjsRuntimeInput):void|Promise<void>
}

export type ReaderWorldbookRenderPhaseV1='before'|'after'
/** Native/Source capture supplies this identity. The producer does not infer
 * message role or historical scope from a current global publication. */
export interface ReaderWorldbookRenderTargetV1 {
  readonly sessionId:string
  readonly messageId:string
  readonly messageVersionSha256:string
  readonly seq:number
  readonly index:number
  readonly swipeId:number
  readonly role:'assistant'|'user'|'system'
  readonly depth:number
  readonly isLast:boolean
}
export interface ReaderWorldbookRenderEntryV1 {
  readonly entryId:string
  readonly ordinal:number
  readonly phase:ReaderWorldbookRenderPhaseV1
  readonly enabled:boolean
  readonly matched:boolean
  readonly effectiveDepth:number
  readonly order:number
  readonly uid:number
  /** The shared formal Source parser already removed directives from text. */
  readonly resource:TavernEjsResource
  readonly directives:readonly {readonly name:string;readonly args:string}[]
  readonly worldInfo:Readonly<Record<string,unknown>>
}
export interface ReaderWorldbookRenderInputV1 {
  readonly capture:TavernEjsHostCapture
  readonly target:ReaderWorldbookRenderTargetV1
  readonly entries:readonly ReaderWorldbookRenderEntryV1[]
  readonly phase:ReaderWorldbookRenderPhaseV1
  /** After receives the actual display result. Before has no display buffer. */
  readonly displayText?:string
}
export interface ReaderWorldbookRenderFragmentV1 {
  readonly entry:{readonly entryId:string;readonly ordinal:number;readonly sourcePointer:string;
    readonly contentSha256:string;readonly sourceSnapshotSha256:string}
  readonly html:string
  readonly renderedSha256:string
  readonly executionResourceSha256:string
  readonly disposition:{readonly kind:'inline'}|{readonly kind:'iframe';readonly title:string}
}
export type ReaderWorldbookRenderResultV1={
  readonly kind:'rendered'
  readonly phase:ReaderWorldbookRenderPhaseV1
  readonly target:ReaderWorldbookRenderTargetV1
  readonly fragments:readonly ReaderWorldbookRenderFragmentV1[]
  readonly engine:TavernEjsRuntimeIdentity
  readonly program:TavernEjsResource
  readonly output:Omit<TavernEjsHostOutput,'renderedText'>
}|{readonly kind:'empty';readonly phase:ReaderWorldbookRenderPhaseV1;readonly target:ReaderWorldbookRenderTargetV1}
 |{readonly kind:'refused';readonly phase:ReaderWorldbookRenderPhaseV1;readonly diagnostic:TavernEjsHostDiagnostic}
