// Generated from runtime/alpha3/src/core/roleplay-mvu-browser-hook.ts; edit the TypeScript source.
/** Durable browser callback execution shared by the actual opening and Story
 * owners. The producer retains its Source lease, payload and write authority. */
import { recordSha256 } from './roleplay-data.js';
import { freezeSchemaJournalData, isAuthorHostJournalReadyV5, isSchemaBrowserFacts, schemaEpochAuthorIdentity, schemaJournalHostFrontierSha256, schemaJournalServerTailSha256, sealSchemaJournalRecord } from './roleplay-mvu-schema-journal.js';
function fail(code) { throw Error(code); }
export async function executeRoleplayMvuBrowserHook(request, deps) {
    deps.check();
    const { session, signal } = deps, prepared = await deps.prepareHook(request, signal);
    if (!prepared)
        return;
    let dispatch, dispatchRef, dispatchMarker;
    try {
        await deps.withSourceBoundary(async () => {
            signal.throwIfAborted();
            deps.beforeDispatch?.();
            const events = deps.nativeEvents(), ready = deps.captureReady();
            if (ready.kind !== 'ready' || !isAuthorHostJournalReadyV5(ready))
                fail('SCHEMA_BROWSER_HOST_REQUIRED');
            dispatch = sealSchemaJournalRecord({ schemaVersion: 5, encoding: 'native-author-browser-hook-dispatch-v5',
                sessionId: session.id, realmEpoch: deps.realmEpoch, batchId: prepared.identity.invocationId, epoch: ready.epochRef,
                previousTailSha256: schemaJournalServerTailSha256(ready), sourceNativeCut: deps.sourceNativeCut(events),
                request, identity: prepared.identity });
            deps.admitRecord?.(dispatch);
            dispatchRef = await deps.journal.putProduced(dispatch);
            deps.check('SCHEMA_BROWSER_DISPATCH_CHANGED');
            if (deps.nativeEvents().length !== events.length)
                fail('SCHEMA_BROWSER_DISPATCH_CHANGED');
            const marker = deps.markers.appendDispatch(session, { schemaVersion: 1, encoding: 'native-mvu-schema-dispatch-marker-v1',
                sessionId: session.id, realmEpoch: deps.realmEpoch, batchId: dispatch.batchId,
                programSha256: deps.programSha256, sourceSha256: schemaEpochAuthorIdentity(ready.epoch).sourceSha256,
                previousTailSha256: dispatch.previousTailSha256, dispatchRecordSha256: dispatch.recordSha256,
                loadDescriptorSha256: null, observedNativeSeq: session.seq - 1 });
            dispatchMarker = { seq: marker.seq, sha256: recordSha256(marker) };
            if (!await deps.flush())
                fail('SCHEMA_BROWSER_DISPATCH_FLUSH_UNKNOWN');
            deps.check('SCHEMA_BROWSER_DISPATCH_CHANGED');
            if (deps.nativeEvents().length !== dispatchMarker.seq + 1)
                fail('SCHEMA_BROWSER_DISPATCH_CHANGED');
        });
        // Callback SDK writes own their namespace/worldbook boundaries. Waiting
        // outside Source lets those writes finish before this owner accepts DATA.
        const result = await prepared.execute();
        return await deps.withSourceBoundary(async () => {
            signal.throwIfAborted();
            const events = deps.nativeEvents();
            if (result.stage !== request.stage || events.length < dispatchMarker.seq + 1
                || recordSha256(events.at(dispatchMarker.seq)) !== dispatchMarker.sha256)
                fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
            deps.onCompletion?.(result);
            const completion = sealSchemaJournalRecord({ schemaVersion: 5, encoding: 'native-author-browser-hook-completion-v5',
                sessionId: session.id, realmEpoch: deps.realmEpoch, batchId: dispatch.batchId, dispatch: dispatchRef,
                dispatchMarker, result });
            deps.admitRecord?.(completion);
            await deps.journal.putProduced(completion);
            deps.check('SCHEMA_BROWSER_COMPLETION_CHANGED');
            if (deps.nativeEvents().length !== events.length)
                fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
            const completed = deps.markers.appendCompletion(session, { schemaVersion: 1, encoding: 'native-mvu-schema-completion-marker-v1',
                sessionId: session.id, realmEpoch: deps.realmEpoch, batchId: dispatch.batchId, dispatchSeq: dispatchMarker.seq,
                dispatchRecordSha256: dispatch.recordSha256, completionRecordSha256: completion.recordSha256,
                completedTailSha256: dispatch.previousTailSha256, observedNativeSeq: session.seq - 1 });
            if (!await deps.flush())
                fail('SCHEMA_BROWSER_COMPLETION_FLUSH_UNKNOWN');
            deps.check('SCHEMA_BROWSER_COMPLETION_CHANGED');
            if (deps.nativeEvents().length !== completed.seq + 1)
                fail('SCHEMA_BROWSER_COMPLETION_CHANGED');
            const ready = deps.captureReady();
            if (ready.kind !== 'ready')
                fail(ready.code);
            const pair = ready.entries?.at(-1);
            if (!pair || !isSchemaBrowserFacts(pair) || pair.dispatch.recordSha256 !== dispatch.recordSha256
                || pair.completion.recordSha256 !== completion.recordSha256)
                fail('SCHEMA_BROWSER_COMPLETION_UNPROVEN');
            return freezeSchemaJournalData({ schemaVersion: 1, request, result: pair.completion.result, journal: pair,
                frontier: { nativeCut: pair.completionMarker.seq + 1, tailSha256: schemaJournalServerTailSha256(ready),
                    frontierSha256: schemaJournalHostFrontierSha256(ready) } });
        });
    }
    finally {
        prepared.dispose();
    }
}
