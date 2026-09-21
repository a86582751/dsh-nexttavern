// Generated from runtime/alpha3/compat/llm-pi-ai/src/context.ts; edit the TypeScript source.
/**
 * Harness request-history conversion into pi-ai's Context vocabulary.
 *
 * @module dsh-llm-pi-ai/context
 */
import { brandString } from '@deepseek-ai/dsh-brand';
import { contentHasImage, IMAGE_OFFLOAD_REQUIRED_CODE, LlmError, offloadedImageText, projectOffloadedImages, requestImageHandleText, requiredImageOffload } from '@deepseek-ai/dsh-llm';
import { toPiAssistant } from './replay.js';
import { requestImageDimensions } from '@deepseek-ai/dsh-attachment';
import { DEFAULT_REQUEST_IMAGE_MAX_BYTES, DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET } from './config.js';
/** Join the text blocks of a harness message. */
function flattenText(message) {
    return message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
}
/** Flatten text recursively inside one tool result. */
function toolResultText(blocks) {
    return blocks.map(block => block.type === 'text'
        ? block.text
        : block.type === 'tool-result' ? toolResultText(block.content) : '').join('');
}
/** Reject image roles that pi-ai cannot replay before request-size offloading can replace them. */
function assertSupportedImageRoles(messages) {
    for (const message of messages) {
        if (message.role !== 'user' && contentHasImage(message.content)) {
            throw new LlmError(`pi-ai cannot represent an image in an in-history ${message.role} message`, 'UNSUPPORTED_CONTENT');
        }
    }
}
async function userContent(blocks, requestImages, resolveImageAccess) {
    const content = [];
    for (const block of blocks) {
        switch (block.type) {
            case 'text':
                if (block.text.length > 0)
                    content.push({ type: 'text', text: block.text });
                break;
            case 'image': {
                const version = requestImages.get(block.attachment.attachmentId);
                content.push({
                    type: 'text',
                    text: requestImageHandleText(block.attachment, version, resolveImageAccess(block.attachment)),
                });
                content.push({
                    type: 'image',
                    data: Buffer.from(version.data).toString('base64'),
                    mimeType: version.mediaType,
                });
                break;
            }
            case 'tool-result':
                {
                    const nested = await userContent(block.content, requestImages, resolveImageAccess);
                    if (typeof nested === 'string') {
                        if (nested.length > 0)
                            content.push({ type: 'text', text: nested });
                    }
                    else {
                        content.push(...nested);
                    }
                }
                break;
            default:
                // Other merge-extensible blocks are not user-input vocabulary for pi-ai.
                break;
        }
    }
    if (content.every(block => block.type === 'text'))
        return content.map(block => block.text).join('');
    return content;
}
function collectImageRefs(blocks, refs) {
    for (const block of blocks) {
        if (block.type === 'image') {
            if (block.offloaded !== true)
                refs.set(block.attachment.attachmentId, block.attachment);
        }
        else if (block.type === 'tool-result') {
            collectImageRefs(block.content, refs);
        }
    }
}
async function prepareRequestImages(messages, attachments, budget, signal) {
    const refs = new Map();
    for (const message of messages)
        collectImageRefs(message.content, refs);
    const orderedRefs = [...refs.values()];
    const prepared = await Promise.all(orderedRefs.map(ref => attachments.readImageRequest(ref, requestImageTarget(ref, budget), signal)));
    const versions = new Map();
    for (const [index, ref] of orderedRefs.entries()) {
        versions.set(ref.attachmentId, prepared[index]);
    }
    return versions;
}
function toolsOf(options) {
    return options.tools?.map(tool => ({
        name: tool.name,
        description: tool.description,
        // ToolSchema.parameters is a JSON Schema object; pi-ai's TSchema
        // (TypeBox) is structurally JSON Schema, so it assigns directly.
        parameters: tool.parameters,
    }));
}
/**
 * Select the pi-ai `systemPrompt` source shared by both conversion paths.
 * `options.system` wins when defined and every history message converts,
 * including a leading `system` message, which then folds into a `user`
 * message. Otherwise a leading `system` history message supplies the prompt
 * and leaves the converted history; empty leading text sends no prompt.
 */
function splitSystemPrompt(options) {
    if (options.system !== undefined)
        return { systemPrompt: options.system, messages: options.messages };
    const [first, ...rest] = options.messages;
    if (first?.role !== 'system')
        return { systemPrompt: undefined, messages: options.messages };
    const text = flattenText(first);
    return { systemPrompt: text.length > 0 ? text : undefined, messages: rest };
}
/** Assemble the request-level pi-ai context envelope shared by both conversion paths. */
function piContext(systemPrompt, options, messages) {
    const tools = toolsOf(options);
    return {
        ...systemPrompt !== undefined ? { systemPrompt } : {},
        messages,
        ...tools !== undefined && tools.length > 0 ? { tools } : {},
    };
}
function appendAssistant(message, messages, toolNames, onReplayDegrade) {
    const assistant = toPiAssistant(message, onReplayDegrade);
    for (const block of assistant.content) {
        if (block.type === 'toolCall')
            toolNames.set(brandString(block.id), block.name);
    }
    messages.push(assistant);
}
function textOnlyContext(options, onReplayDegrade) {
    assertSupportedImageRoles(options.messages);
    const split = splitSystemPrompt(options);
    const toolNames = new Map();
    const messages = [];
    for (const message of split.messages) {
        if (contentHasImage(message.content)) {
            throw new LlmError('pi-ai image conversion requires the durable attachment service', 'UNSUPPORTED_CONTENT');
        }
        if (message.role === 'system') {
            // pi-ai has a single systemPrompt slot; a system message that did not
            // supply it folds into a user message to preserve order.
            messages.push({ role: 'user', content: flattenText(message), timestamp: 0 });
            continue;
        }
        if (message.role === 'assistant') {
            appendAssistant(message, messages, toolNames, onReplayDegrade);
            continue;
        }
        const text = flattenText(message);
        const results = message.content.filter(block => block.type === 'tool-result');
        if (text.length > 0 || results.length === 0)
            messages.push({ role: 'user', content: text, timestamp: 0 });
        for (const result of results) {
            messages.push({
                role: 'toolResult',
                toolCallId: result.toolCallId,
                toolName: toolNames.get(result.toolCallId) ?? 'unknown',
                content: [{
                        type: 'text',
                        text: toolResultText(result.content) || '(no output)',
                    }],
                isError: result.isError ?? false,
                timestamp: 0,
            });
        }
    }
    return piContext(split.systemPrompt, options, messages);
}
/** Deterministic request target for one source under the route budgets. */
function requestImageTarget(ref, budget) {
    return { ...requestImageDimensions(ref.width, ref.height, budget.maxPixels), maxBytes: budget.maxBytes };
}
export function toPiContext(options, images, onReplayDegrade) {
    return images === undefined
        ? textOnlyContext(options, onReplayDegrade)
        : toPiContextWithImages(options, images, onReplayDegrade);
}
async function toPiContextWithImages(options, images, onReplayDegrade) {
    const { attachments, resolveImageAccess, maxRequestImageBytes } = images;
    const requestImagePolicy = images.requestImagePolicy ?? {
        maxPixels: DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
        maxBytes: DEFAULT_REQUEST_IMAGE_MAX_BYTES,
    };
    assertSupportedImageRoles(options.messages);
    const split = splitSystemPrompt(options);
    const requestImages = await prepareRequestImages(split.messages, attachments, requestImagePolicy, options.signal);
    if (maxRequestImageBytes !== undefined) {
        const offloadImages = requiredImageOffload(split.messages, { representation: 'base64', maxBytes: maxRequestImageBytes }, block => requestImages.get(block.attachment.attachmentId).bytes);
        if (offloadImages > 0) {
            throw new LlmError(`pi-ai request images exceed the ${maxRequestImageBytes}-byte base64 bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`, IMAGE_OFFLOAD_REQUIRED_CODE, { offloadImages });
        }
    }
    const exactMessages = projectOffloadedImages(split.messages, ref => offloadedImageText(ref, resolveImageAccess(ref)));
    const toolNames = new Map();
    const messages = [];
    for (const message of exactMessages) {
        if (message.role === 'system') {
            // pi-ai has a single systemPrompt slot; a system message that did not
            // supply it folds into a user message to preserve order.
            messages.push({ role: 'user', content: flattenText(message), timestamp: 0 });
            continue;
        }
        if (message.role === 'assistant') {
            appendAssistant(message, messages, toolNames, onReplayDegrade);
            continue;
        }
        // user role: text + tool results (each result becomes its own message).
        const regular = message.content.filter(block => block.type !== 'tool-result');
        const content = await userContent(regular, requestImages, resolveImageAccess);
        const results = message.content.filter((block) => (block.type === 'tool-result'));
        if (content.length > 0 || results.length === 0) {
            messages.push({ role: 'user', content, timestamp: 0 });
        }
        for (const result of results) {
            const resultContent = await userContent(result.content, requestImages, resolveImageAccess);
            messages.push({
                role: 'toolResult',
                toolCallId: result.toolCallId,
                toolName: toolNames.get(result.toolCallId) ?? 'unknown',
                content: typeof resultContent === 'string'
                    ? [{ type: 'text', text: resultContent || '(no output)' }]
                    : resultContent,
                isError: result.isError ?? false,
                timestamp: 0,
            });
        }
    }
    return piContext(split.systemPrompt, options, messages);
}
