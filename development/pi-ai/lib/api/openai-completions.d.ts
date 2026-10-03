// Generated from runtime/alpha3/compat/pi-ai/src/api/openai-completions.ts; edit the TypeScript source.
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { Context, Model, OpenAICompletionsCompat, SimpleStreamOptions, StreamFunction, StreamOptions, ThinkingBudgets } from "../types.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { type OrderedCompletionsInputV1, type OrderedCompletionsTraceReceiptV1 } from "./openai-ordered-input.js";
export interface OpenAICompletionsOptions extends StreamOptions {
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    /** Token budgets per thinking level. Used when `compat.thinkingTokenBudgetField` or `compat.supportsThinkingTokenBudget` is set, or by `{ "$var": "thinking.budget" }`. */
    thinkingBudgets?: ThinkingBudgets;
}
/** The key is already resolved by the existing owning adapter. This protocol
 * entry performs no Models auth, ambient credential lookup or Native admission. */
export interface OrderedCompletionsOptionsV1 extends OpenAICompletionsOptions {
    apiKey: string;
    maxRetries: 0;
    /** Synchronous data receipt; a throw refuses transport. It grants no authority. */
    onOrderedTrace?: (receipt: OrderedCompletionsTraceReceiptV1) => void;
}
/** Adapter preparation and dispatch share this exact effective SDK model
 * predicate, including provider/baseUrl detection. It reads no credentials. */
export declare function assertOrderedCompletionsModelV1(model: Model<"openai-completions">): void;
export declare function supportsOrderedCompletionsModelV1(model: Model<"openai-completions">): boolean;
export interface ConvertCompletionsMessagesOptions {
    grammarToolInputProperties?: ReadonlyMap<string, string>;
}
type ResolvedOpenAICompletionsCompat = Omit<Required<OpenAICompletionsCompat>, "cacheControlFormat" | "deferredToolsMode" | "supportsThinkingTokenBudget" | "thinkingTokenBudgetField" | "vllmPriority"> & {
    cacheControlFormat?: OpenAICompletionsCompat["cacheControlFormat"];
    deferredToolsMode?: OpenAICompletionsCompat["deferredToolsMode"];
    supportsThinkingTokenBudget?: OpenAICompletionsCompat["supportsThinkingTokenBudget"];
    thinkingTokenBudgetField?: OpenAICompletionsCompat["thinkingTokenBudgetField"];
    vllmPriority?: OpenAICompletionsCompat["vllmPriority"];
};
export declare const stream: StreamFunction<"openai-completions", OpenAICompletionsOptions>;
/** Initial params come directly from the ordered serializer. Generic Pi
 * Context/Message and all other provider protocols keep their existing shape. */
export declare function streamOrderedCompletions(model: Model<"openai-completions">, input: OrderedCompletionsInputV1, options: OrderedCompletionsOptionsV1): AssistantMessageEventStream;
export declare const streamSimple: StreamFunction<"openai-completions", SimpleStreamOptions>;
export declare function convertMessages(model: Model<"openai-completions">, context: Context, compat: ResolvedOpenAICompletionsCompat, options?: ConvertCompletionsMessagesOptions): ChatCompletionMessageParam[];
export {};
