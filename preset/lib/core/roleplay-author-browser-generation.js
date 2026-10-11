// Generated from runtime/alpha3/src/core/roleplay-author-browser-generation.ts; edit the TypeScript source.
/** One live attachment owns its waiting Reader and pending preparation call.
 * A long-poll transports the challenge; it never grants Native permission. */
import { randomUUID } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
const sameBinding = (left, right) => left.browserSessionId === right.browserSessionId && left.generation === right.generation
    && left.sessionId === right.sessionId && left.programSha256 === right.programSha256;
function fail(code) { throw Error(code); }
export function createRoleplayAuthorBrowserGeneration(options) {
    let closed = false, waiter, pending;
    let producedPrompts = false;
    const current = () => !closed && options.current();
    const assertCurrent = () => { if (!current())
        fail('BROWSER_ATTACHMENT_REVOKED'); };
    const assertBinding = (binding) => {
        if (!sameBinding(binding, options.binding))
            fail('BROWSER_ATTACHMENT_REVOKED');
        assertCurrent();
    };
    const admittedOrigin = (row) => {
        const script = options.program.scripts.find(candidate => candidate.ordinal === row.originalOrdinal
            && candidate.descriptor.identity === row.scriptIdentity && candidate.descriptorSha256 === row.descriptorSha256);
        if (!script)
            return false;
        if (options.program.schemaVersion === 2)
            return 'priority' in row
                && script.requiredCapabilities.includes('owned-generation-callbacks');
        if (!('page' in row) || row.resource.browserSessionId !== options.binding.browserSessionId
            || row.resource.generation !== options.binding.generation)
            return false;
        if (row.page === null)
            return script.requiredCapabilities.includes('owned-generation-callbacks');
        const origin = row.page;
        const mountedPages = script.sourcePagePlans;
        return options.program.sourcePages.some(page => page.origin.carrier.identity === row.scriptIdentity
            && page.origin.htmlSha256 === origin.htmlSha256 && mountedPages.includes(page.pagePlanSha256)
            && page.scripts.some(unit => unit.inlineOrdinal === origin.inlineOrdinal
                && unit.javascriptSha256 === origin.javascriptSha256
                && unit.requiredCapabilities.includes('owned-generation-callbacks')));
    };
    function registrations(input) {
        const ids = new Set();
        const accepted = input.map(row => {
            if (!admittedOrigin(row) || ids.has(row.callbackId)
                || typeof row.callbackId !== 'string' || !row.callbackId.length
                || options.program.schemaVersion === 2 && (!('priority' in row)
                    || !['first', 'normal'].includes(row.priority) || !Number.isSafeInteger(row.registrationOrder)
                    || row.registrationOrder < 0))
                fail('BROWSER_GENERATION_REGISTRATION_INVALID');
            ids.add(row.callbackId);
            return Object.freeze({ ...row });
        });
        if (options.program.schemaVersion === 2 && !accepted.length)
            fail('BROWSER_GENERATION_CALLBACK_UNAVAILABLE');
        // V2 transports priority metadata. V3 already carries the actual guest
        // list after eventMakeFirst, so sorting it here would change author order.
        if (options.program.schemaVersion === 2) {
            accepted.sort((left, right) => {
                if (left.priority !== right.priority)
                    return left.priority === 'first' ? -1 : 1;
                return left.priority === 'first' ? right.registrationOrder - left.registrationOrder
                    : left.registrationOrder - right.registrationOrder;
            });
        }
        return Object.freeze(accepted);
    }
    function wait(binding, input, signal) {
        assertBinding(binding);
        signal.throwIfAborted();
        if (waiter || pending)
            fail('BROWSER_GENERATION_BUSY');
        const callbacks = registrations(input);
        return new Promise((resolve, reject) => {
            const abort = () => {
                if (waiter !== value)
                    return;
                waiter = undefined;
                value.cleanup();
                reject(Error('BROWSER_GENERATION_READER_DISCONNECTED'));
            };
            const value = { registrations: callbacks, resolve, reject,
                cleanup: () => signal.removeEventListener('abort', abort) };
            waiter = value;
            signal.addEventListener('abort', abort, { once: true });
        });
    }
    function invoke(input, signal) {
        assertCurrent();
        signal.throwIfAborted();
        if (pending)
            fail('BROWSER_GENERATION_BUSY');
        const reader = waiter;
        if (!reader)
            fail('BROWSER_GENERATION_READER_UNAVAILABLE');
        if (input.capture.sessionId !== options.binding.sessionId || input.snapshot.generation !== options.binding.generation
            || input.capture.attemptId !== input.attemptId)
            fail('BROWSER_GENERATION_CAPTURE_CHANGED');
        const invocation = Object.freeze({ schemaVersion: options.program.schemaVersion,
            encoding: options.program.schemaVersion === 2 ? 'native-author-browser-generation-invocation-v2'
                : 'native-author-browser-generation-invocation-v3', invocationId: randomUUID(),
            binding: options.binding, registrations: reader.registrations, ...input });
        const result = new Promise((resolve, reject) => {
            const abort = () => {
                if (pending !== value)
                    return;
                pending = undefined;
                value.cleanup();
                reject(Error('BROWSER_GENERATION_CANCELLED'));
            };
            const value = { invocation, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) };
            pending = value;
            signal.addEventListener('abort', abort, { once: true });
        });
        waiter = undefined;
        reader.cleanup();
        reader.resolve(invocation);
        return result;
    }
    function complete(result) {
        assertBinding(result.binding);
        const value = pending;
        if (!value || value.invocation.invocationId !== result.invocationId)
            fail('BROWSER_GENERATION_INVOCATION_REVOKED');
        const refuse = (code) => {
            pending = undefined;
            value.cleanup();
            value.reject(Error(code));
            return fail(code);
        };
        if (result.kind !== 'executed') {
            pending = undefined;
            value.cleanup();
            value.reject(Error(result.diagnostics[0]?.code ?? 'BROWSER_GENERATION_REFUSED'));
            return;
        }
        const output = result.output, invocation = value.invocation;
        if (output.schemaVersion !== options.program.schemaVersion || output.encoding !== (options.program.schemaVersion === 2
            ? 'native-author-browser-generation-output-v2' : 'native-author-browser-generation-output-v3')
            || output.authority !== 'consumer-data-only' || output.invocationId !== invocation.invocationId
            || output.programSha256 !== options.program.programSha256 || output.captureSha256 !== invocation.capture.captureSha256
            || output.callbacksExecuted !== invocation.registrations.length)
            refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
        const callbacks = new Map(invocation.registrations.map(row => [row.callbackId, row]));
        for (const effect of output.effects) {
            const callback = callbacks.get(effect.callbackId);
            if (!callback)
                return refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
            if (callback.originalOrdinal !== effect.originalOrdinal || callback.scriptIdentity !== effect.scriptIdentity
                || callback.descriptorSha256 !== effect.descriptorSha256)
                refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
            if ('page' in callback) {
                if (!('page' in effect) || callback.page === null && effect.page !== null
                    || callback.page !== null && (effect.page === null
                        || callback.page.htmlSha256 !== effect.page.htmlSha256
                        || callback.page.inlineOrdinal !== effect.page.inlineOrdinal
                        || callback.page.javascriptSha256 !== effect.page.javascriptSha256))
                    refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
                if (!('resource' in effect) || callback.resource.browserSessionId !== effect.resource.browserSessionId
                    || callback.resource.generation !== effect.resource.generation
                    || callback.resource.pageId !== effect.resource.pageId)
                    refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
            }
        }
        const { outputSha256, ...body } = output;
        if (recordSha256(body) !== outputSha256)
            refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
        producedPrompts ||= output.effects.some(effect => effect.kind === 'inject' && effect.prompts.length > 0);
        pending = undefined;
        value.cleanup();
        value.resolve(output);
    }
    function dispose() {
        if (closed)
            return;
        closed = true;
        const reader = waiter, call = pending;
        waiter = undefined;
        pending = undefined;
        reader?.cleanup();
        call?.cleanup();
        reader?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
        call?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
    }
    function retireResource(pageId) {
        const belongs = (row) => 'resource' in row && row.resource.pageId === pageId;
        if (waiter?.registrations.some(belongs)) {
            const reader = waiter;
            waiter = undefined;
            reader.cleanup();
            reader.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
        if (pending?.invocation.registrations.some(belongs)) {
            const call = pending;
            pending = undefined;
            call.cleanup();
            call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
    }
    return { wait, invoke, complete, dispose, retireResource,
        hasProducedPrompts: () => producedPrompts, hasReader: () => current() && waiter !== undefined };
}
export function createRoleplayAuthorBrowserGenerationV2(options) {
    const owner = createRoleplayAuthorBrowserGeneration(options);
    return { ...owner,
        wait: (binding, rows, signal) => owner.wait(binding, rows, signal),
        invoke: (input, signal) => owner.invoke(input, signal),
        complete: (result) => owner.complete(result) };
}
export function createRoleplayAuthorBrowserGenerationV3(options) {
    const owner = createRoleplayAuthorBrowserGeneration(options);
    return { ...owner,
        wait: (binding, rows, signal) => owner.wait(binding, rows, signal),
        invoke: (input, signal) => owner.invoke(input, signal),
        complete: (result) => owner.complete(result) };
}
