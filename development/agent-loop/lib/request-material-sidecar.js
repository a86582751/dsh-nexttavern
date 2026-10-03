// Generated from runtime/alpha3/compat/agent-loop/src/request-material-sidecar.ts; edit the TypeScript source.
/** Process-local request/material association. Durable descriptors are never
 * looked up as a current owner; only this exact branded request has a binding. */
import { bindAgentLoopRequestGuard, isAgentLoopRequest } from '@deepseek-ai/dsh-llm';
import { nativeInputSha256 } from './input-admission.js';
import { planNativeRequestMaterialV1 } from './request-material.js';
const bindings = new WeakMap();
/** Used by Native immediately after the actual material append and recheck. */
export function bindNativeRequestMaterial(request, binding) {
    if (!isAgentLoopRequest(request) || !Object.isFrozen(request) || !Object.isFrozen(request.messages)
        || bindings.has(request) || binding.event.type !== 'request/material') {
        throw Error('REQUEST_MATERIAL_BINDING_INVALID');
    }
    const captured = Object.freeze({ ...binding });
    bindings.set(request, captured);
    bindAgentLoopRequestGuard(request, () => { captured.assertOwnerCurrent(); assertBoundMaterialBase(request, captured); });
}
/** Reconstruct the current exact base from its actual Session. This live path
 * does not repeatedly refold prior request-only overlays or cache Source. */
function assertBoundMaterialBase(request, binding) {
    const { session, event } = binding, record = event.data, boundary = session.currentRequestBoundary();
    if (Number(session.seq) !== event.seq + 1 || event.seq !== record.base.boundarySeq + 1
        || request.sessionId !== session.id) {
        throw Error('REQUEST_MATERIAL_BOUNDARY_CHANGED');
    }
    const header = session.requestHeaderBoundary();
    if (!header || header.seq !== record.header.seq || nativeInputSha256(header.header) !== record.header.sha256) {
        throw Error('REQUEST_MATERIAL_HEADER_CHANGED');
    }
    const result = planNativeRequestMaterialV1({ turn: record.turn, step: record.step, header: record.header,
        snapshot: record.snapshot, plan: record.plan, boundarySeq: record.base.boundarySeq,
        contentGeneration: boundary.contentGeneration, surfaceNodes: boundary.surfaceNodes,
        baseMessages: boundary.messages, baseRefs: boundary.messageNodes.map(({ seq, message }) => ({ seq, id: message.id,
            role: message.role, messageSha256: nativeInputSha256(message) })),
        protectedPrefixLength: record.delta.protectedPrefixLength, insertions: record.delta.insertions });
    if (nativeInputSha256(result.record) !== nativeInputSha256(record)
        || JSON.stringify(request.messages) !== JSON.stringify(result.messages)) {
        throw Error('REQUEST_MATERIAL_RECONSTRUCTION_CHANGED');
    }
    return result.messages;
}
/** Invariant reads its already-owned immutable event snapshot. A copied or
 * latest unrelated material event cannot substitute for the bound event. */
export function nativeRequestMaterialInvariant(request, session, events) {
    const binding = bindings.get(request);
    if (!binding) {
        // This is only a refusal: a prepared required record cannot substitute
        // for the private association, even when its delta contains no insertions.
        if (events.at(-1)?.type === 'request/material')
            throw Error('REQUEST_MATERIAL_BINDING_REQUIRED');
        return undefined;
    }
    if (binding.session !== session || events[binding.event.seq] !== binding.event) {
        throw Error('REQUEST_MATERIAL_BINDING_CHANGED');
    }
    binding.assertOwnerCurrent();
    return assertBoundMaterialBase(request, binding);
}
