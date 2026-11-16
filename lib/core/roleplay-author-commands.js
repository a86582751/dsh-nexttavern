// Generated from runtime/alpha3/src/core/roleplay-author-commands.ts; edit the TypeScript source.
/** The bounded command language only coordinates existing owners. User text is
 * published once by Native; a trigger never creates another user message. */
import { AuthorNativeCommandParseError, parseAuthorNativeCommands, executeParsedAuthorNativeCommandsV1 } from './author-native-commands.js';
/** Delegated wire steps have already been parsed, but the realm's JSON DTO
 * still enters through the same finite Native/Ruby contract. */
function remoteStepData(command) {
    switch (command.kind) {
        case 'send': return typeof command.text === 'string';
        case 'trigger': return typeof command.awaitCompletion === 'boolean';
        case 'ruby-read': return typeof command.key === 'string' && typeof command.book === 'string'
            && typeof command.json === 'boolean' && typeof command.all === 'boolean' && typeof command.raw === 'boolean';
        case 'ruby-run': return ['tasks', 'startup', 'all'].includes(command.selection) && Array.isArray(command.taskSpecs)
            && command.taskSpecs.every(value => typeof value === 'string') && typeof command.json === 'boolean';
        case 'ruby-preset': return typeof command.selector === 'string';
        case 'ruby-status':
        case 'ruby-panel':
        case 'ruby-reload': return true;
        default: return false;
    }
}
async function executeRemoteStep(request, owners, signal, command, pipe) {
    if (typeof request.operationId !== 'string' || !request.operationId)
        throw Error('AUTHOR_NATIVE_COMMAND_OPERATION_REQUIRED');
    // Parsing the entire chain precedes any effect. Pipe replacement is data,
    // never a second parser invocation that could introduce another command.
    const steps = [];
    const result = { operationId: request.operationId, pipe, steps };
    signal.throwIfAborted();
    owners.assertCurrent();
    const operationId = request.operationId + ':' + command.index;
    if (command.kind === 'send') {
        const text = command.text.trim();
        if (!text)
            return { ...result, kind: 'refused', code: 'AUTHOR_NATIVE_SEND_EMPTY' };
        const published = await owners.publish(operationId, text);
        if (published.kind !== 'published')
            return { ...result, kind: published.kind === 'unknown' ? 'unknown' : 'refused', code: published.code };
        steps.push({ index: command.index, kind: 'send', receipt: published.receipt });
        result.refreshRequired = true;
    }
    else if (command.kind === 'trigger') {
        const outcome = await owners.trigger(operationId, command.awaitCompletion), triggered = outcome.result;
        if (triggered.kind !== 'triggered')
            return { ...result, kind: triggered.kind === 'unknown' ? 'unknown' : 'refused', code: triggered.code };
        const started = ['started', 'latched', 'running'].includes(triggered.wake.kind);
        steps.push({ index: command.index, kind: 'trigger', receipt: triggered.receipt,
            state: outcome.completion === 'completed' ? 'completed' : started ? 'started' : 'accepted' });
        result.refreshRequired = true;
        if (outcome.completion !== 'completed' && !started)
            return { ...result, kind: 'refused', code: outcome.code ?? 'AUTHOR_NATIVE_TRIGGER_NOT_STARTED' };
        if (command.awaitCompletion && outcome.completion !== 'completed')
            return { ...result, kind: 'unknown', code: outcome.code ?? 'AUTHOR_NATIVE_STORY_NOT_COMPLETED' };
    }
    else {
        if (!owners.ruby)
            return { ...result, kind: 'refused', code: 'AUTHOR_NATIVE_RUBY_UNSUPPORTED' };
        const action = command.kind.slice('ruby-'.length);
        const outcome = await owners.ruby(operationId, command, signal);
        if (outcome.pipe !== undefined)
            result.pipe = outcome.pipe;
        if (outcome.kind === 'executed' || outcome.receipt)
            steps.push({ index: command.index, kind: 'ruby', action,
                ...(outcome.receipt ? { receipt: outcome.receipt } : {}),
                ...(outcome.sourceDataPublished ? { sourceDataPublished: true } : {}) });
        if (outcome.sourceDataPublished)
            delete result.refreshRequired;
        else if (action === 'run' && outcome.receipt)
            result.refreshRequired = true;
        if (outcome.kind !== 'executed')
            return { ...result, kind: outcome.kind,
                code: outcome.code ?? (outcome.kind === 'unknown' ? 'AUTHOR_NATIVE_RUBY_UNKNOWN' : 'AUTHOR_NATIVE_RUBY_REFUSED') };
    }
    return { ...result, kind: 'executed' };
}
export async function executeAuthorNativeCommands(request, owners, signal) {
    if (typeof request.operationId !== 'string' || !request.operationId)
        throw Error('AUTHOR_NATIVE_COMMAND_OPERATION_REQUIRED');
    if (request.step) {
        const step = request.step;
        if (!Number.isSafeInteger(step.index) || step.index < 0 || !remoteStepData(step)
            || request.pipe !== undefined && typeof request.pipe !== 'string')
            return { operationId: request.operationId, pipe: request.pipe ?? '', steps: [], kind: 'refused', code: 'AUTHOR_NATIVE_COMMAND_UNSUPPORTED' };
        return executeRemoteStep(request, owners, signal, step, request.pipe ?? '');
    }
    try {
        const pipeline = parseAuthorNativeCommands(request.command);
        return executeParsedAuthorNativeCommandsV1(pipeline, request.operationId, {
            assertCurrent() { signal.throwIfAborted(); owners.assertCurrent(); },
            remote: (step, operationId, pipe) => executeAuthorNativeCommands({ operationId, command: '', step, pipe }, owners, signal),
        });
    }
    catch (error) {
        if (!(error instanceof AuthorNativeCommandParseError))
            throw error;
        return { operationId: request.operationId, pipe: '', steps: [], kind: 'refused', code: error.code,
            diagnostic: { commandIndex: error.commandIndex, offset: error.offset } };
    }
}
