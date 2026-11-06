// Generated from runtime/alpha3/src/core/roleplay-author-commands.ts; edit the TypeScript source.
/** The bounded command language only coordinates existing owners. User text is
 * published once by Native; a trigger never creates another user message. */
import { AuthorNativeCommandParseError, parseAuthorNativeCommands } from './author-native-commands.js';
export async function executeAuthorNativeCommands(request, owners, signal) {
    if (typeof request.operationId !== 'string' || !request.operationId)
        throw Error('AUTHOR_NATIVE_COMMAND_OPERATION_REQUIRED');
    // Parsing the entire chain precedes any effect. Pipe replacement is data,
    // never a second parser invocation that could introduce another command.
    const steps = [], pipe = '';
    const result = { operationId: request.operationId, pipe, steps };
    let commands;
    try {
        commands = parseAuthorNativeCommands(request.command).commands;
    }
    catch (error) {
        if (!(error instanceof AuthorNativeCommandParseError))
            throw error;
        return { ...result, kind: 'refused', code: error.code,
            diagnostic: { commandIndex: error.commandIndex, offset: error.offset } };
    }
    for (const command of commands) {
        signal.throwIfAborted();
        owners.assertCurrent();
        const operationId = request.operationId + ':' + command.index;
        if (command.kind === 'send') {
            const text = command.text.replaceAll('{{pipe}}', pipe).trim();
            if (!text)
                return { ...result, kind: 'refused', code: 'AUTHOR_NATIVE_SEND_EMPTY' };
            const published = await owners.publish(operationId, text);
            if (published.kind !== 'published')
                return { ...result, kind: published.kind === 'unknown' ? 'unknown' : 'refused', code: published.code };
            steps.push({ index: command.index, kind: 'send', receipt: published.receipt });
        }
        else {
            const outcome = await owners.trigger(operationId, command.awaitCompletion), triggered = outcome.result;
            if (triggered.kind !== 'triggered')
                return { ...result, kind: triggered.kind === 'unknown' ? 'unknown' : 'refused', code: triggered.code };
            const started = ['started', 'latched', 'running'].includes(triggered.wake.kind);
            steps.push({ index: command.index, kind: 'trigger', receipt: triggered.receipt,
                state: outcome.completion === 'completed' ? 'completed' : started ? 'started' : 'accepted' });
            if (outcome.completion !== 'completed' && !started)
                return { ...result, kind: 'refused', code: outcome.code ?? 'AUTHOR_NATIVE_TRIGGER_NOT_STARTED' };
            if (command.awaitCompletion && outcome.completion !== 'completed')
                return { ...result, kind: 'unknown', code: outcome.code ?? 'AUTHOR_NATIVE_STORY_NOT_COMPLETED' };
        }
    }
    return { ...result, kind: 'executed' };
}
