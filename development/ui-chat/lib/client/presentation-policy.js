// Generated from runtime/alpha3/compat/ui-chat/src/client/presentation-policy.ts; edit the TypeScript source.
/**
 * Runtime vocabulary derived from the persisted work-details mode. Renderers
 * and seats select single fields of this policy; none of them compares the
 * mode enum, so adding a mode changes only the table below.
 */
const POLICIES = {
    compact: {
        mode: 'compact',
        foldCompletedTurns: true,
        stepGrouping: 'collapsed',
        liveProcessDetail: false,
        settledReasoningPreview: false,
    },
    detailed: {
        mode: 'detailed',
        foldCompletedTurns: true,
        stepGrouping: 'collapsed',
        liveProcessDetail: true,
        settledReasoningPreview: true,
    },
    expanded: {
        mode: 'expanded',
        foldCompletedTurns: true,
        stepGrouping: 'none',
        liveProcessDetail: true,
        settledReasoningPreview: true,
    },
};
/**
 * Resolve the policy constant for one mode. The same mode always yields the
 * same object, so selectors over a policy see stable identities.
 * @param mode - persisted work-details mode.
 * @returns the mode's presentation policy.
 */
export function presentationPolicyFor(mode) {
    return POLICIES[mode];
}
/**
 * Derive a policy observable from the mode observable without a subscription of
 * its own: reads are a table lookup and change notifications are the mode's.
 * @param mode - live work-details mode.
 * @returns observable policy that changes exactly when the mode changes.
 */
export function derivePresentationPolicy(mode) {
    return {
        getSnapshot: () => POLICIES[mode.getSnapshot()],
        subscribe: listener => mode.subscribe(listener),
    };
}
