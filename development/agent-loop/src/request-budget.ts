/** Numeric observations of the final adapter projection. The meter owns all
 * token estimation; this owner only attributes and applies observed error. */
import type {GenerateOptions,RequestMessage, ProjectedLlmRequest, TokenUsage,TokenRequestMeasurement} from '@deepseek-ai/dsh-llm'
import {nativeInputSha256} from './input-admission.js'

export type RequestComponent = 'systemFixed'|'authorEffective'|'dynamicState'|'storyPlayer'
  |'toolSchemas'|'toolCatalog'|'toolResults'|'maintenanceInput'|'receipts'|'unattributed'
export type RequestComponents = Readonly<Record<RequestComponent,number>>
export interface NativeRequestMeter {
  measureRequest(request:ProjectedLlmRequest):TokenRequestMeasurement
}
export interface NativeRequestMeasurementV1 {
  readonly schemaVersion:1
  readonly encoding:'native-final-request-measurement-v1'
  readonly sourceSha256:string
  readonly provider:string
  readonly model:string
  readonly estimate:TokenRequestMeasurement
  readonly components:RequestComponents
  readonly capacity:{readonly status:'known';readonly contextWindow:number;readonly outputReserve:number;
    readonly observedErrorMargin:number;readonly availableInput:number;readonly excess:number;
    readonly calibration:{readonly sourceSha256:string;readonly estimatedInput:number;readonly providerInput:number;
      readonly samples:number}}
    |{readonly status:'unknown';readonly reason:'context-window'|'output-reserve'|'uncalibrated'|'image-pricing'}
}
const measurements=new WeakMap<object,NativeRequestMeasurementV1>()
/** The existing telemetry writer reads the owning request's numeric result;
 * this data bridge grants no material/dispatch or Source authority. */
export function readNativeRequestMeasurementV1(request:object):NativeRequestMeasurementV1|undefined {
  return measurements.get(request)
}
export function retainNativeRequestMeasurement(request:GenerateOptions,value:NativeRequestMeasurementV1):void {
  measurements.set(request,value)
}
declare module '@deepseek-ai/cordis' {
  interface Events {
    /** Numeric/hash diagnostics only; no prompt or tool argument body. */
    'native/request-observed'(observation:{readonly schemaVersion:1;readonly sessionId:string;
      readonly turn:number;readonly step:number;readonly measurement:NativeRequestMeasurementV1;
      readonly usage:ReturnType<NativeRequestBudget['observeUsage']>|'unknown';
      readonly firstOutputMs:number|null;readonly elapsedMs:number}):void
  }
}
function component(message:RequestMessage):RequestComponent {
  const source=message.source as {kind?:string;form?:string;stage?:string}|undefined
  if(source?.kind==='tool-registry')return 'toolCatalog'
  if(message.role==='tool'||message.content.some(block=>block.type==='tool-call'))return 'toolResults'
  if(source?.kind==='request-material')return 'authorEffective'
  if(message.role==='system')return 'systemFixed'
  if(source?.kind==='roleplay-context'||source?.kind==='runtime-context'
    ||source?.kind==='roleplay-context-window')return 'dynamicState'
  if(source?.kind==='roleplay-tasks'){
    if(source.form==='phase'&&source.stage==='story')return 'systemFixed'
    return ['management-receipt','maintenance-receipt','read-evidence-receipt'].includes(source.form??'')?'receipts':'maintenanceInput'
  }
  if(source?.kind==='user')return 'storyPlayer'
  // A model producer does not prove narrative purpose: maintenance can also
  // return plain assistant text. Keep that residual explicit, without parsing
  // prose or replaying a second Session history solely for attribution.
  return 'unattributed'
}

/** Calibration belongs to this Agent lifetime and route. A new Agent or cold
 * restart stays unknown until it observes comparable provider usage; estimates
 * never invent a starting margin. Provider input includes disjoint cache input,
 * while output never enters the input error. */
export class NativeRequestBudget {
  private readonly errors=new Map<string,{estimate:number;providerInput:number;underestimate:number;samples:number;sourceSha256:string}>()
  private readonly measured=new WeakMap<ProjectedLlmRequest,NativeRequestMeasurementV1>()
  private route(request:ProjectedLlmRequest):string {
    return nativeInputSha256({provider:request.options.provider,model:request.options.model,
      contextWindow:request.context?.contextWindow??null})
  }
  measure(request:ProjectedLlmRequest,meter:NativeRequestMeter):NativeRequestMeasurementV1 {
    const cached=this.measured.get(request)
    if(cached)return cached
    const estimate=meter.measureRequest(request)
    const components:Record<RequestComponent,number>={systemFixed:estimate.systemTokens,authorEffective:0,
      dynamicState:0,storyPlayer:0,toolSchemas:estimate.toolTokens,toolCatalog:0,toolResults:0,
      maintenanceInput:0,receipts:0,unattributed:0}
    request.options.messages.forEach((message,index)=>{
      const parts=estimate.messageParts[index]!
      if(parts.length)for(const part of parts){
        const category=Object.hasOwn(components,part.category)?part.category as RequestComponent:'unattributed'
        components[category]+=part.tokens
      }
      else components[component(message)]+=estimate.messageTokens[index]!
    })
    const contextWindow=request.context?.contextWindow,outputReserve=request.options.maxTokens,
      calibration=this.errors.get(this.route(request))
    let capacity:NativeRequestMeasurementV1['capacity']
    if(contextWindow===undefined)capacity={status:'unknown',reason:'context-window'}
    else if(outputReserve===undefined)capacity={status:'unknown',reason:'output-reserve'}
    else if(estimate.imagePricing==='unknown')capacity={status:'unknown',reason:'image-pricing'}
    else if(calibration===undefined)capacity={status:'unknown',reason:'uncalibrated'}
    else {
      // Scale the largest observed relative underestimate to this input size.
      // Integer numerator/denominator retains the exact same-size difference.
      const observedErrorMargin=Math.ceil(estimate.inputTokens*calibration.underestimate/calibration.estimate)
      const availableInput=Math.max(0,contextWindow-outputReserve-observedErrorMargin)
      capacity={status:'known',contextWindow,outputReserve,observedErrorMargin,availableInput,
        excess:Math.max(0,estimate.inputTokens-availableInput),calibration:Object.freeze({sourceSha256:calibration.sourceSha256,
          estimatedInput:calibration.estimate,providerInput:calibration.providerInput,samples:calibration.samples})}
    }
    const result=Object.freeze({schemaVersion:1 as const,encoding:'native-final-request-measurement-v1' as const,
      sourceSha256:nativeInputSha256({provider:request.options.provider,model:request.options.model,
        system:request.options.system??null,messages:request.options.messages,tools:request.options.tools??[],
        toolHistory:request.options.toolHistory??null}),provider:request.options.provider,model:request.options.model,
      estimate,components:Object.freeze(components),capacity:Object.freeze(capacity)})
    this.measured.set(request,result)
    return result
  }
  observeUsage(request:ProjectedLlmRequest,measurement:NativeRequestMeasurementV1,usage:TokenUsage|undefined) {
    if(!usage)return undefined
    const providerInput=usage.totalTokens!==undefined?usage.totalTokens-usage.outputTokens
      :usage.cacheReadTokens!==undefined&&usage.cacheWriteTokens!==undefined
        ?usage.inputTokens+usage.cacheReadTokens+usage.cacheWriteTokens:undefined
    const inputDifference=providerInput===undefined?undefined:providerInput-measurement.estimate.inputTokens
    const key=this.route(request)
    if(providerInput!==undefined&&measurement.estimate.inputTokens>0){
      const previous=this.errors.get(key),underestimate=Math.max(0,inputDifference!)
      const sample={estimate:measurement.estimate.inputTokens,providerInput,underestimate,
        sourceSha256:measurement.sourceSha256,samples:(previous?.samples??0)+1}
      this.errors.set(key,previous&&previous.underestimate*sample.estimate>=underestimate*previous.estimate
        ?{...previous,samples:sample.samples}:sample)
    }
    return Object.freeze({inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,
      cacheReadTokens:usage.cacheReadTokens??null,cacheWriteTokens:usage.cacheWriteTokens??null,
      providerInput:providerInput??'unknown',inputDifference:inputDifference??'unknown'})
  }
}
