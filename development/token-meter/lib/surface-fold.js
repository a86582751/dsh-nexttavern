// Generated from runtime/alpha3/compat/token-meter/src/surface-fold.ts; edit the TypeScript source.
/**
 * Positional pricing shared by measurement and the context-breakdown fold:
 * measurement retains attachment details for route pricing; breakdown keeps
 * only retained node identities, heuristic prices, and system classification.
 * The occupancy projection uses the scalar shadow-price protocol instead.
 *
 * The fold is a plan/commit pair: {@link planSurfaceTokens} runs every
 * fallible step read-only and {@link commitSurfaceTokens} mutates in place,
 * so a throw leaves the caller's state untouched and the same malformed
 * event fails identically on every retry.
 * Nodes also carry durable attachment occurrences and their structural prices,
 * so `measure()` can price the request representation sent to the model.
 *
 * @module @deepseek-ai/dsh-token-meter/surface-fold
 */
import { deriveEventMessage, isSurfaceEvent, SessionSeq } from '@deepseek-ai/dsh-session';
import { z } from 'zod';
import { assertMessageEdit, isMessageEdit } from 'dsh-nexttavern-session-format/projection';
import { estimateContent, estimateMessage, estimateStructuralBlock } from './estimate.js';
// Edits replace top-level text only. Keep its price and identity, never a copy
// of the story; reasoning, nested tool output and attachments keep their price.
const editPriceSchema = z.object({
    role: z.enum(['user', 'assistant']),
    messageId: z.string().min(1),
    textTokens: z.number().int().nonnegative(),
}).strict();
export const retainedPriceSchema = z.object({
    seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq),
    heuristicTokens: z.number().int().nonnegative(),
    system: z.boolean(),
    edit: editPriceSchema.optional(),
}).strict();
function editablePrice(message) {
    if (message.role !== 'user' && message.role !== 'assistant')
        return undefined;
    return {
        role: message.role,
        messageId: message.id,
        textTokens: estimateContent(message.content.filter(block => block.type === 'text')),
    };
}
/** Collect projected attachment occurrences and their structural prices. */
function collectProjectedAttachments(blocks, images, files) {
    let imageTokens = 0;
    let fileTokens = 0;
    for (const block of blocks) {
        if (block.type === 'image') {
            images.push(block);
            imageTokens += estimateStructuralBlock(block);
        }
        else if (block.type === 'file') {
            files.push(block.attachment);
            fileTokens += estimateStructuralBlock(block);
        }
        else if (block.type === 'tool-result') {
            const nested = collectProjectedAttachments(block.content, images, files);
            imageTokens += nested.imageTokens;
            fileTokens += nested.fileTokens;
        }
    }
    return { imageTokens, fileTokens };
}
/** Build one priced node from a surface event's derived message. */
function analyzeNode(seq, message) {
    if (message === null) {
        return {
            seq,
            heuristicTokens: 0,
            imageStructuralTokens: 0,
            fileStructuralTokens: 0,
            images: [],
            files: [],
        };
    }
    const heuristicTokens = estimateMessage(message);
    const images = [];
    const files = [];
    const structural = collectProjectedAttachments(message.content, images, files);
    return {
        seq,
        heuristicTokens,
        imageStructuralTokens: structural.imageTokens,
        fileStructuralTokens: structural.fileTokens,
        images,
        files,
        edit: editablePrice(message),
    };
}
/** Price an edit at its exact log position; never consult the Session's final projection. */
export function planMessageEdit(nodes, event) {
    assertMessageEdit(event.data);
    const edit = event.data;
    const index = nodes.findIndex(node => node.seq === edit.targetSeq);
    const previous = nodes[index];
    if (event.ignorable || edit.targetSeq >= event.seq || previous?.edit?.role !== edit.role ||
        previous.edit.messageId !== edit.messageId) {
        throw Error(`token surface: edit at seq ${event.seq} has no matching current message`);
    }
    const textTokens = estimateContent([{ type: 'text', text: edit.text }]);
    const deltaTokens = textTokens - previous.edit.textTokens;
    const node = {
        ...previous,
        heuristicTokens: previous.heuristicTokens + deltaTokens,
        edit: { ...previous.edit, textTokens },
    };
    return { node, tokens: node.heuristicTokens, deltaTokens, target: { startIdx: index, endIdx: index } };
}
/** Shared retained-node plan for pure checkpoint folds; attachment details stay in the service. */
export function planRetainedSurface(nodes, event) {
    if (isMessageEdit(event))
        return planMessageEdit(nodes, event);
    if (!isSurfaceEvent(event))
        return undefined;
    const plan = planSurfaceTokens(nodes, event);
    return { ...plan, node: {
            seq: event.seq,
            heuristicTokens: plan.tokens,
            system: event.type === 'system/message',
            ...(plan.node.edit === undefined ? {} : { edit: plan.node.edit }),
        } };
}
/**
 * Validate and price one surface event without mutating the surface.
 * @param nodes - the priced surface preceding this event, in model-visible order.
 * @param event - the surface event to place.
 * @returns the plan for {@link commitSurfaceTokens}.
 * @throws when a replacement names a range absent from `nodes` — committed
 *   logs are surface-validated at append time, so an unresolvable range is log
 *   corruption and must fail loud rather than skip the event.
 */
export function planSurfaceTokens(nodes, event) {
    const node = analyzeNode(event.seq, deriveEventMessage(event));
    const tokens = node.heuristicTokens;
    const op = event.surfaceOp;
    if (op === 'append') {
        return { tokens, deltaTokens: tokens, node, target: 'append' };
    }
    const startIdx = nodes.findIndex(candidate => candidate.seq === op.startSeq);
    const endIdx = nodes.findIndex(candidate => candidate.seq === op.endSeq);
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
        throw new Error(`token surface: replace at seq ${event.seq} has invalid current range ${op.startSeq}-${op.endSeq}`);
    }
    const removed = nodes
        .slice(startIdx, endIdx + 1)
        .reduce((total, candidate) => total + candidate.heuristicTokens, 0);
    return { tokens, deltaTokens: tokens - removed, node, target: { startIdx, endIdx } };
}
/**
 * Apply one validated plan to the priced surface in place; infallible, so it
 * cannot leave a half-applied surface behind.
 * @param nodes - the exact priced surface the plan was built against.
 * @param plan - the transition returned by {@link planSurfaceTokens}.
 */
export function commitSurfaceTokens(nodes, plan) {
    if (plan.target === 'append') {
        nodes.push(plan.node);
        return;
    }
    nodes.splice(plan.target.startIdx, plan.target.endIdx - plan.target.startIdx + 1, plan.node);
}
