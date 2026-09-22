// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/derived.ts; edit the TypeScript source.
/**
 * Project one observable into another, recomputing only when the source
 * snapshot changes identity, so consumers that select from the projection
 * (a Set lookup per row) never rebuild it per read.
 * @param source - the observable to project.
 * @param project - pure projection of one source snapshot.
 * @returns the projected observable, subscribing through the source.
 */
export function derive(source, project) {
    let seen;
    let value;
    return {
        getSnapshot: () => {
            const snapshot = source.getSnapshot();
            if (value === undefined || snapshot !== seen) {
                seen = snapshot;
                value = project(snapshot);
            }
            return value;
        },
        subscribe: listener => source.subscribe(listener),
    };
}
