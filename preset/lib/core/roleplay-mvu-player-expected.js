// Generated from runtime/alpha3/src/core/roleplay-mvu-player-expected.ts; edit the TypeScript source.
/** Share the writer's exact base identity without exposing snapshot payloads as
 * expected fields or asking callers to infer the edit contract. */
export function mvuPlayerEditExpectedV1(state) {
    return {
        sourceSha256: state.snapshot.sourceSha256,
        root: structuredClone(state.snapshot.root),
        revision: state.snapshot.revision,
        headSha256: state.snapshot.headSha256,
        valuesSha256: state.snapshot.valuesSha256,
        stateSnapshotSha256: state.snapshot.stateSnapshotSha256,
        observedNativeSeq: state.observedNativeSeq,
    };
}
