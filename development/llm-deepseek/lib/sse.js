// Generated from runtime/alpha3/compat/llm-deepseek/src/sse.ts; edit the TypeScript source.
/** SSE framing delegated to eventsource-parser; JSON errors remain provider failures. */
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { LlmError } from '@deepseek-ai/dsh-llm';
import { object } from './replay.js';
import { providerError } from './transport.js';
/** Decode complete SSE frames without treating an unterminated tail as an event.
 * @param body - provider response bytes.
 * @param activity - pulse the idle watchdog for events and heartbeat comments.
 * @returns JSON events, including message_stop; the translator owns completion.
 */
export async function* parseSse(body, activity) {
    const events = body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream({ onComment: activity }));
    for await (const frame of events) {
        activity();
        let raw;
        try {
            raw = JSON.parse(frame.data);
        }
        catch (_invalidSseJson) {
            throw new LlmError('DeepSeek Messages SSE contains invalid JSON', 'MALFORMED_RESPONSE');
        }
        const event = object(raw);
        if (typeof event.type !== 'string' || (frame.event !== undefined && frame.event !== event.type)) {
            throw new LlmError('DeepSeek Messages SSE event type mismatch', 'MALFORMED_RESPONSE');
        }
        if (event.type === 'error')
            throw providerError(event, undefined);
        yield event;
    }
}
