// Generated from runtime/alpha3/compat/token-meter/src/route-pricing.ts; edit the TypeScript source.
/**
 * Request-projected surface pricing: replaces attachment-block heuristics with
 * the image and file representations sent to the routed model.
 *
 * @module @deepseek-ai/dsh-token-meter/route-pricing
 */
import { estimateContent, estimateMessage, estimateStructuralBlock, estimateSystemText, estimateToolsTokens } from './estimate.js';
/** Price the exact already-projected request once; toolHistory is projection input, never a second schema charge. */
export function priceRequest(request) {
    const { options, imageRequestPricing } = request;
    let imageCount = 0;
    const nodes = options.messages.map((message, index) => {
        const images = [];
        for (const block of message.content) {
            if (block.type === 'image')
                images.push(block);
        }
        imageCount += images.length;
        return {
            // priceSurface only carries this positional identity through; these nodes are never Session events.
            seq: index,
            heuristicTokens: estimateMessage(message),
            imageStructuralTokens: images.reduce((sum, block) => sum + estimateStructuralBlock(block), 0),
            fileStructuralTokens: 0,
            images,
            files: [],
        };
    });
    const surface = priceSurface(nodes, imageRequestPricing);
    const messageTokens = surface.nodes.map(node => node.tokens);
    const messageParts = options.messages.map((message, index) => {
        const source = message.source;
        if (message.role !== 'system' || source?.kind !== 'system-prompt' || !source.requestAttribution)
            return Object.freeze([]);
        let characters = 0, allocated = 0;
        const parts = source.requestAttribution.parts.map(part => {
            const before = estimateSystemText(characters, true);
            characters += part.characters;
            const tokens = estimateSystemText(characters, true) - before;
            allocated += tokens;
            return Object.freeze({ category: part.category, tokens });
        });
        // Role framing and any adapter-visible residual have a single owner.
        parts.push(Object.freeze({ category: 'systemFixed', tokens: messageTokens[index] - allocated }));
        return Object.freeze(parts);
    });
    const systemTokens = estimateSystemText(options.system?.length ?? 0);
    const toolTokens = estimateToolsTokens(options.tools === undefined ? undefined : { config: options, tools: options.tools });
    const schemaBytes = options.tools === undefined || options.tools.length === 0
        ? 0 : new TextEncoder().encode(JSON.stringify(options.tools)).byteLength;
    return Object.freeze({
        inputTokens: surface.surfaceTokens + systemTokens + toolTokens,
        messageTokens: Object.freeze(messageTokens), messageParts: Object.freeze(messageParts), systemTokens, toolTokens, schemaBytes,
        toolCount: options.tools?.length ?? 0,
        imageCount,
        imagePricing: imageCount === 0 ? 'none' : imageRequestPricing === undefined ? 'unknown' : 'known',
    });
}
/**
 * Price one ordered surface under its model-request attachment projection.
 * @param nodes - the fold's current or snapshotted surface, in model-visible order.
 * @param pricing - the routed model's image pricing, or undefined to keep the fixed heuristic.
 * @param fileText - exact file handle projection used by the mounted LLM service.
 * @returns detached public nodes and their route-priced total.
 * @throws when the pricing answers a different occurrence count than it was
 *   asked — misalignment would silently misprice nodes, so it must fail loud.
 */
export function priceSurface(nodes, pricing, fileText) {
    const images = pricing === undefined ? [] : nodes.flatMap(node => node.images);
    const hasFiles = fileText !== undefined && nodes.some(node => node.files.length > 0);
    if ((pricing === undefined || images.length === 0) && !hasFiles) {
        let surfaceTokens = 0;
        const publicNodes = nodes.map((node) => {
            surfaceTokens += node.heuristicTokens;
            return { seq: node.seq, tokens: node.heuristicTokens, heuristicTokens: node.heuristicTokens };
        });
        return { nodes: publicNodes, surfaceTokens };
    }
    const prices = pricing === undefined ? [] : pricing.priceImages(images);
    if (pricing !== undefined && prices.length !== images.length) {
        throw new Error(`token meter: route image pricing answered ${prices.length} prices for ${images.length} occurrences`);
    }
    let cursor = 0;
    let surfaceTokens = 0;
    const publicNodes = nodes.map((node) => {
        let tokens = node.heuristicTokens;
        if (fileText !== undefined && node.files.length > 0) {
            tokens -= node.fileStructuralTokens;
            for (const file of node.files) {
                tokens += estimateContent([{ type: 'text', text: fileText(file) }]);
            }
        }
        if (pricing !== undefined && node.images.length > 0) {
            tokens -= node.imageStructuralTokens;
            for (let occurrence = 0; occurrence < node.images.length; occurrence += 1) {
                // oxlint-disable-next-line typescript/no-non-null-assertion -- length equality is asserted above
                const price = prices[cursor];
                cursor += 1;
                tokens += price.visualTokens + estimateContent([{ type: 'text', text: price.text }]);
            }
        }
        surfaceTokens += tokens;
        return { seq: node.seq, tokens, heuristicTokens: node.heuristicTokens };
    });
    return { nodes: publicNodes, surfaceTokens };
}
