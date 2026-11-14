import type {TavernEjsHostCapture,TavernEjsPhaseCapture,TavernEjsResource,TavernEjsHost,
  TavernEjsHostResult} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsReplayEngine,TavernEjsReplayRecord,TavernEjsReplayDelta} from './tavern-template-ejs-replay.mjs'
import {recordSha256} from './roleplay-data.js'
import {TEMPLATE_LIMITS_V1} from './tavern-template-data.mjs'

export type TavernEjsConsumer='reader-render-v1'|'reader-regex-phase-v1'
/** Source catalogue capacity, actor transport capacity and final HTML capacity
 * are independent owners. VM execution limits remain the existing limits. */
export const EJS_READER_RENDER_POLICY_V1=Object.freeze({id:'reader-render-v1' as const,
  sourceBytes:2_000_000,cumulativeSourceBytes:TEMPLATE_LIMITS_V1.workerInputBytes,
  cumulativeCompiledBytes:TEMPLATE_LIMITS_V1.workerInputBytes,
  htmlBytes:8*1_048_576,packetBytes:TEMPLATE_LIMITS_V1.workerInputBytes,
  effects:'refused' as const})
export const EJS_READER_RENDER_POLICY_SHA256=recordSha256(EJS_READER_RENDER_POLICY_V1)
export const EJS_READER_REGEX_PHASE_POLICY_V1=Object.freeze({...EJS_READER_RENDER_POLICY_V1,
  id:'reader-regex-phase-v1' as const,effects:'regex-only' as const})
export const EJS_READER_REGEX_PHASE_POLICY_SHA256=recordSha256(EJS_READER_REGEX_PHASE_POLICY_V1)

export const EJS_RUNTIME_PACKAGE='dsh-nexttavern-template-runtime-v3'
export const EJS_RUNTIME_VERSION='0.1.0'
export const EJS_RUNTIME_POLICY=Object.freeze({schemaVersion:1,factory:'template-ejs-v1',
  compiler:'ejs-3.1.10',quickjs:'0.32.0',execution:'retained-actor-realms',
  maxActors:4,actorOldGenerationMiB:128,programCapacity:'registry-owner',
  replay:'creation-and-ordered-action-deltas',publication:'consumer-data-only'})
export interface TavernEjsRuntimeIdentity extends TavernEjsReplayEngine {
  readonly schemaVersion:1
  readonly encoding:'owned-ejs-template-engine-v1'
  readonly factory:'template-ejs-v1'
  readonly policySha256:string
  readonly implementationSha256:string
}
export interface TavernEjsRuntimeInventory {
  readonly name:string
  readonly version:string
  readonly generation:string
  readonly files:readonly {readonly path:string;readonly sha256:string}[]
}
export interface TavernEjsRuntimeInput {
  readonly consumer?:TavernEjsConsumer
  readonly capture:TavernEjsHostCapture
  readonly resource:TavernEjsResource
}
export type TavernEjsRuntimeAction=Parameters<TavernEjsHost['invoke']>[0]
export interface TavernEjsRuntimeInvocation {
  readonly result:ReturnType<TavernEjsHost['invoke']>
  readonly delta:TavernEjsReplayDelta|undefined
}
/** Each program retains its own realm on a shared Worker actor. */
export interface TavernEjsRuntimeProgram {
  readonly creation:TavernEjsHostResult
  invoke(operationId:string,action:TavernEjsRuntimeAction,capture?:TavernEjsPhaseCapture,
    signal?:AbortSignal):Promise<TavernEjsRuntimeInvocation>
  checkpoint(signal?:AbortSignal):Promise<TavernEjsReplayRecord>
  dispose():Promise<void>
}
export interface TavernEjsRuntime {
  readonly identity:TavernEjsRuntimeIdentity
  current():TavernEjsRuntimeInventory
  checkCurrentSync(check:()=>void):void
  prepare(input:TavernEjsRuntimeInput,signal?:AbortSignal):Promise<TavernEjsRuntimeProgram>
  restore(record:TavernEjsReplayRecord,signal?:AbortSignal):Promise<TavernEjsRuntimeProgram>
  dispose():Promise<void>
}
export interface EjsWorkerStart {readonly identity:TavernEjsRuntimeIdentity}
export type EjsWorkerProgramStart=
  {readonly kind:'prepare';readonly input:TavernEjsRuntimeInput}|
  {readonly kind:'restore';readonly record:TavernEjsReplayRecord}
export type EjsWorkerProgramCommand=EjsWorkerProgramStart|
  {readonly kind:'checkpoint'}|{readonly kind:'dispose'}|{readonly kind:'invoke';readonly operationId:string;
    readonly action:TavernEjsRuntimeAction;readonly capture?:TavernEjsPhaseCapture}
export type EjsWorkerCommand={readonly id:number;readonly programId:number}&EjsWorkerProgramCommand
export type EjsWorkerReply={readonly id:0;readonly kind:'ready'}|({readonly id:number;readonly programId:number}&(
  {readonly kind:'created';readonly creation:TavernEjsHostResult}|
  {readonly kind:'invoked';readonly output:TavernEjsRuntimeInvocation}|
  {readonly kind:'checkpoint';readonly record:TavernEjsReplayRecord}|
  {readonly kind:'disposed'}|{readonly kind:'failed';readonly code:string}))
