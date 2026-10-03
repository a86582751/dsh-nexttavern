// Generated from runtime/alpha3/compat/agent-loop/src/opening-record-hashes.ts; edit the TypeScript source.
/** Node-only counterpart of Session's browser-safe shape parser. Native owns
 * complete canonical digest verification; no Source or live registration is
 * reconstructed from a checksum. Player hashes remain in their old module. */
import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import { nativeOpeningDataV1, nativeOpeningCanonicalV1, NativeOpeningRecordFailureV1, NATIVE_OPENING_RECORD_BOUNDS_V1, validateNativeOpeningInvocationV1 as shapeInvocation, validateNativeOpeningRequestAttemptV1 as shapeAttempt, validateNativeGeneratedOpeningReceiptV1 as shapeReceipt, validateNativeOpeningClosingAckV1 as shapeAck } from '@deepseek-ai/dsh-session/surface';
/** Proxies are not plain Native data even when they mimic descriptors. Walk
 * before the browser-safe copier; it then owns getter/cycle/budget refusal. */
function refuseProxies(value) {
    const seen = new WeakSet(), pending = [{ value, depth: 0 }];
    let nodes = 0;
    while (pending.length) {
        const item = pending.pop();
        if (++nodes > NATIVE_OPENING_RECORD_BOUNDS_V1.nodes || item.depth > NATIVE_OPENING_RECORD_BOUNDS_V1.depth)
            throw new NativeOpeningRecordFailureV1('OPENING_RECORD_BUDGET');
        const current = item.value;
        if (current === null || typeof current !== 'object' || seen.has(current))
            continue;
        if (utilTypes.isProxy(current))
            throw new NativeOpeningRecordFailureV1('OPENING_RECORD_INVALID');
        seen.add(current);
        for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current))) {
            if (Object.hasOwn(descriptor, 'value'))
                pending.push({ value: descriptor.value, depth: item.depth + 1 });
        }
    }
}
export function nativeOpeningRecordSha256V1(value) {
    refuseProxies(value);
    return createHash('sha256').update(nativeOpeningCanonicalV1(nativeOpeningDataV1(value)), 'utf8').digest('hex');
}
const utf8TextSha256V1 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
export const nativeOpeningInstructionSha256V1 = (text) => utf8TextSha256V1(text);
/** Original model text blocks in durable order, with no trimming or separators. */
export const nativeOpeningTextSha256V1 = (text) => utf8TextSha256V1(text);
export function sealNativeOpeningRecordV1(body, key) {
    return nativeOpeningDataV1({ ...body, [key]: nativeOpeningRecordSha256V1(body) });
}
function complete(value, parser, key) {
    refuseProxies(value);
    const data = parser(value), expected = data[key], body = Object.fromEntries(Object.entries(data).filter(([name]) => name !== key));
    if (nativeOpeningRecordSha256V1(body) !== expected)
        throw new NativeOpeningRecordFailureV1('OPENING_RECORD_HASH_CHANGED');
    return data;
}
export const validateNativeOpeningInvocationV1 = (value) => {
    const data = complete(value, shapeInvocation, 'invocationSha256');
    if (data.identity.instructionSha256 !== nativeOpeningInstructionSha256V1(data.identity.instruction))
        throw new NativeOpeningRecordFailureV1('OPENING_INSTRUCTION_CHANGED');
    return data;
};
export const validateNativeOpeningRequestAttemptV1 = (value) => complete(value, shapeAttempt, 'attemptSha256');
export const validateNativeGeneratedOpeningReceiptV1 = (value) => {
    const data = complete(value, shapeReceipt, 'receiptSha256');
    if (data.identity.instructionSha256 !== nativeOpeningInstructionSha256V1(data.identity.instruction))
        throw new NativeOpeningRecordFailureV1('OPENING_INSTRUCTION_CHANGED');
    return data;
};
export const validateNativeOpeningClosingAckV1 = (value) => complete(value, shapeAck, 'ackSha256');
