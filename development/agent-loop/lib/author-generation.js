// Generated from runtime/alpha3/compat/agent-loop/src/author-generation.ts; edit the TypeScript source.
import { nativeInputSha256 } from './input-admission.js';
import { reconstructNativeRequestMaterialV1 } from './request-material.js';
export function inspectNativeAuthorGenerationTerminalV1(identity, events) {
    const material = events.find(event => event.type === 'request/material' && event.data.schemaVersion === 3
        && nativeInputSha256(event.data.owner) === nativeInputSha256(identity));
    if (material?.type !== 'request/material')
        return undefined;
    const end = events.find(event => event.type === 'turn/end' && event.data.turn === material.data.turn && event.seq > material.seq);
    if (end?.type !== 'turn/end' || !['completed', 'max-tokens', 'error', 'aborted', 'blocked'].includes(end.data.reason.kind))
        return undefined;
    return { identity, turnEndRef: { seq: Number(end.seq), sha256: nativeInputSha256(end) }, turn: end.data.turn, reason: end.data.reason };
}
export function inspectNativeAuthorGenerationV1(identity, events, projections) {
    const material = events.find(event => event.type === 'request/material' && event.data.schemaVersion === 3
        && nativeInputSha256(event.data.owner) === nativeInputSha256(identity)), assistant = events.find(event => event.type === 'assistant/message' && event.data.message.id === identity.messageId);
    if (material?.type !== 'request/material' || assistant?.type !== 'assistant/message')
        return;
    const end = events.find(event => event.type === 'turn/end' && event.data.turn === assistant.data.turn);
    if (end?.type !== 'turn/end' || !['completed', 'max-tokens'].includes(end.data.reason.kind))
        return;
    reconstructNativeRequestMaterialV1({ materialEvent: material, events, projections, expectedHeaderSha256: material.data.header.sha256 });
    const finish = assistant.data.stream?.findLast(record => record.type === 'chunk' && record.chunk.type === 'finish');
    if (finish?.type !== 'chunk' || finish.chunk.type !== 'finish')
        return;
    return { identity, materialRef: { seq: material.seq, sha256: nativeInputSha256(material) },
        assistantRef: { seq: assistant.seq, sha256: nativeInputSha256(assistant) }, turnEndRef: { seq: end.seq, sha256: nativeInputSha256(end) },
        message: assistant.data.message, finishReason: finish.chunk.reason };
}
