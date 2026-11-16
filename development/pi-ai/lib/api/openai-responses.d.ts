// Generated from runtime/alpha3/compat/pi-ai/src/api/openai-responses.ts; edit the TypeScript source.
import type { ResponseCreateParamsStreaming, ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses.js";
import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
export interface OpenAIResponsesOptions extends StreamOptions {
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    reasoningSummary?: "auto" | "detailed" | "concise" | null;
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    toolChoice?: ResponseCreateParamsStreaming["tool_choice"];
    topP?: number;
    responseFormat?: {
        readonly type: "json_schema";
        readonly jsonSchema: Omit<ResponseFormatTextJSONSchemaConfig, "type">;
    };
    /** Explicit unsupported controls remain visible until pre-dispatch refusal. */
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
}
export type OpenAIResponsesSimpleOptions = Omit<SimpleStreamOptions, "toolChoice"> & Pick<OpenAIResponsesOptions, "toolChoice" | "topP" | "responseFormat" | "topK" | "frequencyPenalty" | "presencePenalty" | "stop">;
/**
 * Generate function for OpenAI Responses API
 */
export declare const stream: StreamFunction<"openai-responses", OpenAIResponsesOptions>;
export declare const streamSimple: StreamFunction<"openai-responses", OpenAIResponsesSimpleOptions>;
