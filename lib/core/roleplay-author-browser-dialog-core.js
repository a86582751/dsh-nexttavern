// Generated from runtime/alpha3/src/core/roleplay-author-browser-dialog-core.ts; edit the TypeScript source.
/** The live Reader operation, Source FIFO and actual Native task own author
 * dialogue. Guest request records only identify those existing owners. */
import { recordSha256 } from './roleplay-data.js';
function fail(code) { throw Error(code); }
export function createRoleplayAuthorBrowserDialogCoreV1(deps) {
    const requests = new Map();
    let closed = false;
    const assertLive = (current, signal) => {
        signal.throwIfAborted();
        if (closed || !current())
            fail('BROWSER_ATTACHMENT_REVOKED');
    };
    async function generateRaw(sid, program, realm, request, current, signal) {
        assertLive(current, signal);
        const source = await deps.captureCurrent(sid, program, current), binding = { namespace: source.namespace,
            programSha256: program.programSha256, realmId: realm.realmId, groupId: realm.groupId };
        assertLive(source.current, signal);
        const operationId = recordSha256({ schemaVersion: 1, encoding: 'author-native-dialog-operation-v1', binding,
            operationId: request.operationId }), requestSha256 = recordSha256(request), prior = requests.get(operationId);
        if (prior && prior.requestSha256 !== requestSha256)
            fail('AUTHOR_CHAT_OPERATION_CHANGED');
        let result = prior?.result;
        if (!result) {
            const controller = new AbortController(), requestSignal = AbortSignal.any([signal, controller.signal]);
            const target = { binding };
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
    function releaseOwner(current) {
        for (const [id, request] of requests)
            if (request.current === current) {
                requests.delete(id);
                request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'));
            }
    }
    return { generateRaw, releaseOwner, dispose: () => {
            closed = true;
            for (const request of requests.values())
                request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'));
            requests.clear();
        } };
}
