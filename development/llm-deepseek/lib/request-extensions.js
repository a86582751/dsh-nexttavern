// Generated from runtime/alpha3/compat/llm-deepseek/src/request-extensions.ts; edit the TypeScript source.
/** Prepare plugin-contributed request fields and commit their delivery after HTTP acceptance. */
import { LlmError } from '@deepseek-ai/dsh-llm';
/**
 * Merge contributions without replacing Messages fields. Preparation and
 * acceptance failures report REQUEST_EXTENSION. When the merged request fails
 * to serialize, the payload is the base request alone and acceptance is a no-op,
 * so contributors resend their unaccepted state on a later request.
 * @param body - serialized Messages request before extension fields.
 * @param options - request identity, purpose, and cancellation.
 * @param prepare - contributor registry captured for this adapter.
 * @param onOmitted - receives the omitted field names and the serialization failure.
 * @returns HTTP payload and a commit to invoke only after a successful HTTP response.
 */
export async function prepareRequestExtensions(body, options, prepare, onOmitted) {
    let extensions;
    try {
        extensions = await prepare({ body, ...options });
    }
    catch (error) {
        throw new LlmError('DeepSeek request extension preparation failed', 'REQUEST_EXTENSION', { cause: error });
    }
    const fields = Object.keys(extensions.fields);
    for (const field of fields) {
        if (Object.hasOwn(body, field)) {
            throw new LlmError(`DeepSeek request extension field ${JSON.stringify(field)} collides with the base request`, 'REQUEST_EXTENSION');
        }
    }
    let payload;
    try {
        payload = JSON.stringify({ ...body, ...extensions.fields });
    }
    catch (error) {
        // A base request that cannot serialize throws here, before any field is reported as omitted.
        const base = JSON.stringify(body);
        onOmitted(fields, error);
        return { payload: base, accept: () => Promise.resolve() };
    }
    return {
        payload,
        async accept() {
            try {
                await extensions.accept();
            }
            catch (error) {
                throw new LlmError('DeepSeek request extension acceptance failed', 'REQUEST_EXTENSION', { cause: error });
            }
        },
    };
}
