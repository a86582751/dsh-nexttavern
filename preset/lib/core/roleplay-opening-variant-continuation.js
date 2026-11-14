// Generated from runtime/alpha3/src/core/roleplay-opening-variant-continuation.ts; edit the TypeScript source.
/** Detached candidate execution. The caller owns donor capture and publication. */
import { recordSha256 } from './roleplay-data.js';
export async function evaluateOpeningVariantContinuation(input, signal) {
    const { donor, requestedStep, program, runner } = input;
    const fields = { schemaVersion: 4, realmEpoch: donor.realmEpoch,
        prefix: donor.completedPrefix, requestedStep };
    const trace = donor.loadFrame.scopeReadRef || requestedStep.frame.input.scopeReadRef
        ? { ...fields, encoding: 'native-mvu-author-schema-trace-input-v4-scope-ref-v2', loadFrame: donor.loadFrame }
        : { ...fields, encoding: 'native-mvu-author-schema-trace-input-v4',
            loadFrame: donor.loadFrame };
    let record;
    if (runner.openManualRun) {
        const opened = await runner.openManualRun(program, trace, signal);
        if (opened.kind !== 'opened-manual-run')
            throw Error(opened.diagnostics[0]?.code ?? 'OPENING_VARIANT_CONTINUATION_UNAVAILABLE');
        // Publication cannot observe the receipt until actual candidate cleanup
        // and Worker termination have succeeded. This run is never the main realm.
        await opened.run.close();
        record = opened.record;
    }
    else {
        const evaluated = await runner.evaluateTrace(program, trace, signal);
        if (evaluated.kind !== 'evaluated-trace')
            throw Error(evaluated.diagnostics[0]?.code ?? 'OPENING_VARIANT_CONTINUATION_UNAVAILABLE');
        record = evaluated.evaluation.records.at(-1);
    }
    const { ownerSessionId, sourceNativeCutSha256, input: phaseInput } = requestedStep.frame;
    const body = { schemaVersion: 1, encoding: 'opening-variant-continuation-v1', donorRef: input.donorRef,
        requested: { eventId: requestedStep.eventId, frame: { ownerSessionId, sourceNativeCutSha256, input: phaseInput } },
        record, scopeObjects: input.scopeObjects ?? [] };
    return { ...body, sha256: recordSha256(body) };
}
