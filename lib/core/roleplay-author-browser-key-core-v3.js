// Generated from runtime/alpha3/src/core/roleplay-author-browser-key-core-v3.ts; edit the TypeScript source.
/** The retained native attachment admits one actual realm. State owns namespace
 * revisions, Source FIFO, the immutable operation and its durable receipt. */
import { authorNativeNamespaceCauseV1 } from './author-native-origin.js';
import { applyAuthorChatOverlayV3, prepareOrdinaryAuthorChatBatchV3 } from './roleplay-author-chat-state-types.js';
import { recordSha256 } from './roleplay-data.js';
import { createAuthorNativeMessageVariables } from './author-native-message-variables.js';
function fail(code) { throw Error(code); }
function ownScript(program, realm) {
    const scripts = program.scripts.filter(script => script.enabled && script.realmId === realm.realmId);
    if (scripts.length !== 1 || !program.realms.some(row => row.realmId === realm.realmId && row.groupId === realm.groupId))
        fail('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
    return scripts[0];
}
export function createRoleplayAuthorBrowserKeyCoreV3(deps) {
    let closed = false;
    async function mutateCapturedNamespace(sid, input, current, signal) {
        signal.throwIfAborted();
        if (closed || !current())
            fail('BROWSER_ATTACHMENT_REVOKED');
        const { previous, nextVariables: next, root, cause } = input;
        if (!next || typeof next !== 'object' || Array.isArray(next))
            fail('BROWSER_CHAT_UPDATE_RESULT_INVALID');
        if (Object.hasOwn(previous, 'stat_data') !== Object.hasOwn(next, 'stat_data')
            || Object.hasOwn(previous, 'stat_data') && recordSha256(previous.stat_data) !== recordSha256(next.stat_data))
            fail('AUTHOR_CHAT_NUMERICAL_KEY_RESERVED');
        const { stat_data: _before, ...basisValues } = previous;
        const source = await deps.captureCurrent(sid, current);
        const { target: _target, ...sourceNamespace } = root.namespace;
        if (recordSha256(source.namespace) !== recordSha256(sourceNamespace))
            fail('AUTHOR_CHAT_BINDING_CHANGED');
        return deps.withSourceLock(sid, async () => {
            signal.throwIfAborted();
            const live = () => !closed && !signal.aborted && source.current();
            if (!live())
                fail('BROWSER_ATTACHMENT_REVOKED');
            return deps.state.commitOrdinaryBatchV3(prepareOrdinaryAuthorChatBatchV3(root, next, input.operationId, cause), { basisValues, ownsNamespace: () => true, isCurrent: live });
        }, signal);
    }
    async function retryCapturedNamespace(sid, operation, cause, current, signal) {
        signal.throwIfAborted();
        if (closed || !current())
            fail('BROWSER_ATTACHMENT_REVOKED');
        if (recordSha256(operation.cause) !== recordSha256(cause))
            fail('AUTHOR_CHAT_RECOVERY_SOURCE_CHANGED');
        const source = await deps.captureCurrent(sid, current);
        const { target: _target, ...sourceNamespace } = operation.namespace;
        if (recordSha256(source.namespace) !== recordSha256(sourceNamespace))
            fail('AUTHOR_CHAT_BINDING_CHANGED');
        return deps.withSourceLock(sid, async () => {
            const live = () => !closed && !signal.aborted && source.current();
            if (!live())
                fail('BROWSER_ATTACHMENT_REVOKED');
            // Retry consumes State's original immutable operation, never a new diff
            // derived from the currently displayed page or a superseded read basis.
            return deps.state.commitOrdinaryBatchV3(operation, { ownsNamespace: () => true, isCurrent: live });
        }, signal);
    }
    async function mutateNamespace(sid, program, realm, request, basis, current, signal) {
        const cause = authorNativeNamespaceCauseV1(program.programSha256, realm);
        const next = request.nextVariables;
        const selector = request.selector, scope = basis.scopeFrame.scopes.chat;
        let capture = basis.ordinaryChat, previous;
        if (selector?.type === 'script') {
            const script = ownScript(program, realm), self = basis.context?.realmScripts?.[realm.realmId];
            if (!self || self.identity !== script.identity || self.ordinary.root.namespace.target?.kind !== 'script'
                || self.ordinary.root.namespace.target.identity.scriptIdentity !== script.identity)
                fail('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
            if (self.variables === undefined)
                fail('AUTHOR_NATIVE_SCRIPT_VARIABLES_UNAVAILABLE');
            capture = self.ordinary;
            previous = self.variables;
        }
        else if (selector) {
            const selected = createAuthorNativeMessageVariables(basis).resolve(selector, true);
            capture = selected.capture;
            previous = selected.values;
        }
        else
            previous = applyAuthorChatOverlayV3(scope.kind === 'available' ? scope.variables : {}, capture);
        return mutateCapturedNamespace(sid, { root: capture.root, previous, nextVariables: next,
            operationId: request.operationId, cause }, current, signal);
    }
    async function retryNamespace(sid, program, realm, operation, current, signal) {
        if (operation.namespace.target?.kind === 'script'
            && operation.namespace.target.identity.scriptIdentity !== ownScript(program, realm).identity)
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        return retryCapturedNamespace(sid, operation, authorNativeNamespaceCauseV1(program.programSha256, realm), current, signal);
    }
    return { mutateNamespace, retryNamespace, mutateCapturedNamespace, retryCapturedNamespace, dispose: () => { closed = true; } };
}
