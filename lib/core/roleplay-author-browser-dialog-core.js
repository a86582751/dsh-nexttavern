// Generated from runtime/alpha3/src/core/roleplay-author-browser-dialog-core.ts; edit the TypeScript source.
/** The live Reader operation, Source FIFO and actual Native task own author
 * dialogue. Guest request records only identify those existing owners. */
import { recordSha256 } from './roleplay-data.js';
import { deriveAuthorChatBindingV1, deriveAuthorChatBindingV2 } from './roleplay-author-chat-state.js';
function fail(code) { throw Error(code); }
export function createRoleplayAuthorBrowserDialogCoreV1(deps) {
    const requests = new Map();
    let closed = false;
    const assertLive = (current, signal) => {
        signal.throwIfAborted();
        if (closed || !current())
            fail('BROWSER_ATTACHMENT_REVOKED');
    };
    async function generateRaw(sid, program, request, current, signal) {
        assertLive(current, signal);
        const binding = program.schemaVersion === 2 ? deriveAuthorChatBindingV1(sid, program) : (() => {
            const declaration = program.declarations.find(row => row.declarationId === program.generationDeclarationId);
            if (!declaration || declaration.kind !== 'ordinary-source-key'
                || declaration.writer.scriptIdentity !== request.scriptIdentity)
                fail('BROWSER_GENERATION_UNAVAILABLE');
            return deriveAuthorChatBindingV2(sid, program, declaration);
        })();
        if (!binding || typeof request.gestureId !== 'string' || !request.gestureId.length)
            fail('BROWSER_AUTHOR_GESTURE_UNAVAILABLE');
        const operationId = recordSha256({ encoding: 'native-author-dialog-gesture-operation-v1', binding,
            gestureId: request.gestureId }), requestSha256 = recordSha256(request), prior = requests.get(operationId);
        if (prior && prior.requestSha256 !== requestSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        let result = prior?.result;
        if (!result) {
            const controller = new AbortController(), requestSignal = AbortSignal.any([signal, controller.signal]);
            const target = { programSha256: program.programSha256,
                scriptIdentity: request.scriptIdentity, binding };
            result = (async () => {
                const captured = await deps.capturePrompt(sid, target, request, operationId, current, requestSignal);
                try {
                    assertLive(current, requestSignal);
                    captured.assertCurrent();
                    const owner = () => {
                        try {
                            assertLive(current, requestSignal);
                            captured.assertCurrent();
                            return true;
                        }
                        catch {
                            return false;
                        }
                    };
                    const completed = await deps.requestTask(sid, captured.prompt, owner, requestSignal);
                    assertLive(current, requestSignal);
                    captured.assertCurrent();
                    return completed;
                }
                finally {
                    captured.release();
                }
            })();
            requests.set(operationId, { requestSha256, result, current, controller });
            // An interrupted provider run is not a completed receipt. A manual
            // retry may ask TaskHost to resume its actual reserved Native job.
            void result.catch(() => { if (requests.get(operationId)?.result === result)
                requests.delete(operationId); });
        }
        const completed = await result;
        assertLive(current, signal);
        return { text: completed.text, task: completed.task };
    }
    async function updateAuthorChat(sid, program, request, current, signal) {
        assertLive(current, signal);
        const binding = deriveAuthorChatBindingV1(sid, program);
        if (!binding)
            fail('AUTHOR_CHAT_BINDING_CHANGED');
        const sourceCurrent = await deps.captureCurrent(sid, program, current);
        return deps.withSourceLock(sid, async () => {
            assertLive(sourceCurrent, signal);
            const completed = deps.completedTask(sid, program, request);
            if (!completed)
                fail('AUTHOR_CHAT_COMPLETED_TASK_MISSING');
            if (recordSha256(request.expected) !== recordSha256(completed.revision))
                fail('AUTHOR_CHAT_REVISION_CHANGED');
            const result = await deps.state.commit({ binding, expected: completed.revision,
                operationId: completed.operationId, value: request.value, task: completed.task }, {
                isCurrent: () => !closed && !signal.aborted && sourceCurrent(),
                // This exact result came from TaskHost's actual completed Native job.
                completedTask: () => true,
            });
            return result.capture;
        }, signal);
    }
    function releaseOwner(current) {
        for (const [id, request] of requests)
            if (request.current === current) {
                requests.delete(id);
                request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'));
            }
    }
    return { generateRaw, updateAuthorChat, releaseOwner, dispose: () => {
            closed = true;
            for (const request of requests.values())
                request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'));
            requests.clear();
        } };
}
