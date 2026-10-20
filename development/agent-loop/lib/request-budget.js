// Generated from runtime/alpha3/compat/agent-loop/src/request-budget.ts; edit the TypeScript source.
import { nativeInputSha256 } from './input-admission.js';
const measurements = new WeakMap();
/** The existing telemetry writer reads the owning request's numeric result;
 * this data bridge grants no material/dispatch or Source authority. */
export function readNativeRequestMeasurementV1(request) {
    return measurements.get(request);
}
export function retainNativeRequestMeasurement(request, value) {
    measurements.set(request, value);
}
function component(message) {
    const source = message.source;
    if (source?.kind === 'tool-registry')
        return 'toolCatalog';
    if (message.role === 'tool' || message.content.some(block => block.type === 'tool-call'))
        return 'toolResults';
    if (source?.kind === 'request-material')
        return 'authorEffective';
    if (message.role === 'system')
        return 'systemFixed';
    if (source?.kind === 'roleplay-context' || source?.kind === 'runtime-context'
        || source?.kind === 'roleplay-context-window')
        return 'dynamicState';
    if (source?.kind === 'roleplay-tasks') {
        if (source.form === 'phase' && source.stage === 'story')
            return 'systemFixed';
        return ['management-receipt', 'maintenance-receipt', 'read-evidence-receipt'].includes(source.form ?? '') ? 'receipts' : 'maintenanceInput';
    }
    if (source?.kind === 'user')
        return 'storyPlayer';
    // A model producer does not prove narrative purpose: maintenance can also
    // return plain assistant text. Keep that residual explicit, without parsing
    // prose or replaying a second Session history solely for attribution.
    return 'unattributed';
}
/** Calibration belongs to this Agent lifetime and route. A new Agent or cold
 * restart stays unknown until it observes comparable provider usage; estimates
 * never invent a starting margin. Provider input includes disjoint cache input,
 * while output never enters the input error. */
export class NativeRequestBudget {
    errors = new Map();
    measured = new WeakMap();
    route(request) {
        return nativeInputSha256({ provider: request.options.provider, model: request.options.model,
            contextWindow: request.context?.contextWindow ?? null });
    }
    measure(request, meter) {
        const cached = this.measured.get(request);
        if (cached)
            return cached;
        const estimate = meter.measureRequest(request);
        const components = { systemFixed: estimate.systemTokens, authorEffective: 0,
            dynamicState: 0, storyPlayer: 0, toolSchemas: estimate.toolTokens, toolCatalog: 0, toolResults: 0,
            maintenanceInput: 0, receipts: 0, unattributed: 0 };
        request.options.messages.forEach((message, index) => {
            const parts = estimate.messageParts[index];
            if (parts.length)
                for (const part of parts) {
                    const category = Object.hasOwn(components, part.category) ? part.category : 'unattributed';
                    components[category] += part.tokens;
                }
            else
                components[component(message)] += estimate.messageTokens[index];
        });
        const contextWindow = request.context?.contextWindow, outputReserve = request.options.maxTokens, calibration = this.errors.get(this.route(request));
        let capacity;
        if (contextWindow === undefined)
            capacity = { status: 'unknown', reason: 'context-window' };
        else if (outputReserve === undefined)
            capacity = { status: 'unknown', reason: 'output-reserve' };
        else if (estimate.imagePricing === 'unknown')
            capacity = { status: 'unknown', reason: 'image-pricing' };
        else if (calibration === undefined)
            capacity = { status: 'unknown', reason: 'uncalibrated' };
        else {
            // Scale the largest observed relative underestimate to this input size.
            // Integer numerator/denominator retains the exact same-size difference.
            const observedErrorMargin = Math.ceil(estimate.inputTokens * calibration.underestimate / calibration.estimate);
            const availableInput = Math.max(0, contextWindow - outputReserve - observedErrorMargin);
            capacity = { status: 'known', contextWindow, outputReserve, observedErrorMargin, availableInput,
                excess: Math.max(0, estimate.inputTokens - availableInput), calibration: Object.freeze({ sourceSha256: calibration.sourceSha256,
                    estimatedInput: calibration.estimate, providerInput: calibration.providerInput, samples: calibration.samples }) };
        }
        const result = Object.freeze({ schemaVersion: 1, encoding: 'native-final-request-measurement-v1',
            sourceSha256: nativeInputSha256({ provider: request.options.provider, model: request.options.model,
                system: request.options.system ?? null, messages: request.options.messages, tools: request.options.tools ?? [],
                toolHistory: request.options.toolHistory ?? null }), provider: request.options.provider, model: request.options.model,
            estimate, components: Object.freeze(components), capacity: Object.freeze(capacity) });
        this.measured.set(request, result);
        return result;
    }
    observeUsage(request, measurement, usage) {
        if (!usage)
            return undefined;
        const providerInput = usage.totalTokens !== undefined ? usage.totalTokens - usage.outputTokens
            : usage.cacheReadTokens !== undefined && usage.cacheWriteTokens !== undefined
                ? usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens : undefined;
        const inputDifference = providerInput === undefined ? undefined : providerInput - measurement.estimate.inputTokens;
        const key = this.route(request);
        if (providerInput !== undefined && measurement.estimate.inputTokens > 0) {
            const previous = this.errors.get(key), underestimate = Math.max(0, inputDifference);
            const sample = { estimate: measurement.estimate.inputTokens, providerInput, underestimate,
                sourceSha256: measurement.sourceSha256, samples: (previous?.samples ?? 0) + 1 };
            this.errors.set(key, previous && previous.underestimate * sample.estimate >= underestimate * previous.estimate
                ? { ...previous, samples: sample.samples } : sample);
        }
        return Object.freeze({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens ?? null, cacheWriteTokens: usage.cacheWriteTokens ?? null,
            providerInput: providerInput ?? 'unknown', inputDifference: inputDifference ?? 'unknown' });
    }
}
