// Generated from runtime/alpha3/compat/pi-ai/src/api/openai-ordered-input.ts; edit the TypeScript source.
/** Protocol-local ordered input. Public digests describe data, never Native permission. */
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { Tool } from '../types.js';
export interface OrderedTextPartV1 {
    readonly type: 'text';
    readonly text: string;
}
export interface OrderedUserImagePartV1 {
    readonly type: 'image';
    readonly data: string;
    readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}
export interface OrderedToolCallPartV1 {
    readonly type: 'tool-call';
    readonly id: string;
    readonly name: string;
    /** Valid JSON object text, preserved verbatim rather than parsed and reserialized. */
    readonly arguments: string;
}
interface OrderedMessageBaseV1 {
    readonly key: string;
    readonly origin: 'durable' | 'request-material';
}
export type OrderedCompletionsMessageV1 = (OrderedMessageBaseV1 & {
    readonly role: 'system';
    readonly content: readonly OrderedTextPartV1[];
}) | (OrderedMessageBaseV1 & {
    readonly role: 'user';
    readonly content: readonly (OrderedTextPartV1 | OrderedUserImagePartV1)[];
}) | (OrderedMessageBaseV1 & {
    readonly role: 'assistant';
    readonly content: readonly (OrderedTextPartV1 | OrderedToolCallPartV1)[];
}) | (OrderedMessageBaseV1 & {
    readonly role: 'tool';
    readonly toolCallId: string;
    readonly content: readonly OrderedTextPartV1[];
});
export interface OrderedCompletionsInputV1 {
    readonly schemaVersion: 1;
    readonly encoding: 'nexttavern-ordered-chat-completions-v1';
    readonly messages: readonly OrderedCompletionsMessageV1[];
    readonly tools?: readonly Tool[];
}
export interface OrderedCompletionsTraceRowV1 {
    readonly inputKey: string;
    readonly inputRole: OrderedCompletionsMessageV1['role'];
    readonly wireIndices: readonly [number];
    readonly transformation: 'identity' | 'text-parts-concatenated' | 'prepared-user-image';
}
export interface OrderedCompletionsTraceReceiptV1 {
    readonly schemaVersion: 1;
    readonly encoding: 'nexttavern-ordered-chat-completions-trace-v1';
    readonly inputSha256: string;
    /** SHA256 of canonical ordered SDK messages JSON, not full HTTP params. */
    readonly wireSha256: string;
    readonly traceSha256: string;
    readonly trace: readonly OrderedCompletionsTraceRowV1[];
}
export interface OrderedCompletionsSerializationV1 extends OrderedCompletionsTraceReceiptV1 {
    readonly input: OrderedCompletionsInputV1;
    readonly messages: readonly ChatCompletionMessageParam[];
    readonly tools?: readonly Tool[];
    readonly hasToolHistory: boolean;
    readonly hasImages: boolean;
}
export declare class OrderedCompletionsInputError extends Error {
    readonly path: string;
    readonly code = "ORDERED_COMPLETIONS_UNSUPPORTED_INPUT";
    constructor(path: string, reason: string);
}
export declare const ORDERED_COMPLETIONS_POLICY_V1: Readonly<{
    maxBytes: number;
    maxNodes: 131072;
    maxDepth: 48;
    maxMessages: 2048;
    maxParts: 4096;
    maxTools: 256;
    maxTextChars: number;
}>;
/** Strict single-request conversion. No generic transformMessages, synthetic
 * tool result, assistant bridge, Unicode repair, role change or message merge. */
export declare function serializeOrderedCompletionsV1(raw: OrderedCompletionsInputV1): Promise<OrderedCompletionsSerializationV1>;
export {};
