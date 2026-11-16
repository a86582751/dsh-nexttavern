// Generated from runtime/alpha3/src/core/roleplay-author-browser-key-core-v3.ts; edit the TypeScript source.
/** The retained native attachment admits one actual realm. Canonical chat and
 * shared scope owners publish immutable operations and durable receipts. */
import { authorNativeNamespaceCauseV1 } from './author-native-origin.js';
import { applyAuthorChatOverlayV3, prepareOrdinaryAuthorChatBatchV3 } from './roleplay-author-chat-state-types.js';
import { recordSha256 } from './roleplay-data.js';
import { createAuthorNativeMessageVariables } from './author-native-message-variables.js';
import { authorSharedScopeCaptureV1, isAuthorSharedScopeOperationV1, authorOrdinarySourceNamespaceV1 } from './roleplay-author-scope-owner.js';
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
        const next = input.nextVariables;
        if (!next || typeof next !== 'object' || Array.isArray(next))
            fail('BROWSER_CHAT_UPDATE_RESULT_INVALID');
        const shared = 'kind' in input && input.kind === 'shared-scope' ? input : undefined;
        if (shared)
            return retryCapturedNamespace(sid, { kind: 'shared-scope', sourceNamespace: shared.sourceNamespace,
                expectedRoot: shared.capture.root, operationId: shared.operationId, values: next, cause: shared.cause }, shared.cause, current, signal);
        const { previous, root, cause, expectedScopeRef } = input;
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
            return deps.state.commitOrdinaryBatchV3(prepareOrdinaryAuthorChatBatchV3(root, next, input.operationId, cause, expectedScopeRef), { basisValues, ownsNamespace: () => true, isCurrent: live });
        }, signal);
    }
    async function retryCapturedNamespace(sid, operation, cause, current, signal) {
        signal.throwIfAborted();
        if (closed || !current())
            fail('BROWSER_ATTACHMENT_REVOKED');
        if (recordSha256(operation.cause) !== recordSha256(cause))
            fail('AUTHOR_CHAT_RECOVERY_SOURCE_CHANGED');
        const source = await deps.captureCurrent(sid, current);
        const { target: _target, ...sourceNamespace } = authorOrdinarySourceNamespaceV1(operation);
        if (recordSha256(source.namespace) !== recordSha256(sourceNamespace))
            fail('AUTHOR_CHAT_BINDING_CHANGED');
        return deps.withSourceLock(sid, async () => {
            const live = () => !closed && !signal.aborted && source.current();
            if (!live())
                fail('BROWSER_ATTACHMENT_REVOKED');
            // Retry consumes State's original immutable operation, never a new diff
            // derived from the currently displayed page or a superseded read basis.
            if (isAuthorSharedScopeOperationV1(operation)) {
                if (!deps.sharedScopes)
                    fail('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
                return deps.sharedScopes.replace(sid, operation, live);
            }
            return deps.state.commitOrdinaryBatchV3(operation, { ownsNamespace: () => true, isCurrent: live });
        }, signal);
    }
    async function mutateNamespace(sid, program, realm, request, basis, current, signal) {
        const cause = authorNativeNamespaceCauseV1(program.programSha256, realm);
        const next = request.nextVariables;
        const selector = request.selector, scope = basis.scopeFrame.scopes.chat;
        if (selector && selector.type !== 'script' && selector.type !== 'message') {
            const capture = authorSharedScopeCaptureV1(basis.sharedScopes, selector);
            return mutateCapturedNamespace(sid, { kind: 'shared-scope', capture, sourceNamespace: basis.ordinaryChat.root.namespace,
                nextVariables: next, operationId: request.operationId, cause }, current, signal);
        }
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
        else if (selector?.type === 'message') {
            const selected = createAuthorNativeMessageVariables(basis).resolve(selector, true);
            capture = selected.capture;
            previous = selected.values;
        }
        else
            previous = applyAuthorChatOverlayV3(scope.kind === 'available' ? scope.variables : {}, capture);
        return mutateCapturedNamespace(sid, { root: capture.root, expectedScopeRef: capture.scopeRef, previous, nextVariables: next,
            operationId: request.operationId, cause }, current, signal);
    }
    async function retryNamespace(sid, program, realm, operation, current, signal) {
        if (!isAuthorSharedScopeOperationV1(operation) && operation.namespace.target?.kind === 'script'
            && operation.namespace.target.identity.scriptIdentity !== ownScript(program, realm).identity)
            fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE');
        return retryCapturedNamespace(sid, operation, authorNativeNamespaceCauseV1(program.programSha256, realm), current, signal);
    }
    async function confirmNamespace(sid, operation) {
        if (authorOrdinarySourceNamespaceV1(operation).sessionId !== sid)
            fail('AUTHOR_CHAT_BINDING_CHANGED');
        if (isAuthorSharedScopeOperationV1(operation)) {
            if (!deps.sharedScopes)
                fail('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
            return deps.sharedScopes.lookup(operation);
        }
        if (!deps.state.confirmOrdinaryBatchV3)
            fail('AUTHOR_CHAT_RECOVERY_UNAVAILABLE');
        return deps.state.confirmOrdinaryBatchV3(operation);
    }
    return { mutateNamespace, retryNamespace, mutateCapturedNamespace, retryCapturedNamespace, confirmNamespace, dispose: () => { closed = true; } };
}
