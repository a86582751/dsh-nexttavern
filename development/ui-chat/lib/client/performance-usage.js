// Generated from runtime/alpha3/compat/ui-chat/src/client/performance-usage.ts; edit the TypeScript source.
/** Performance detail preference with process-local choices on memory-only settings scopes. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { DEFAULT_PERFORMANCE_USAGE } from "../chat-settings.js";
/** Shared live preference for the settings row and chat statistics. */
export class PerformanceUsagePolicy {
    host;
    unsubscribe;
    /** Current choice, reconciled with accepted Host settings when available. */
    mode = createSnapshotStore(DEFAULT_PERFORMANCE_USAGE);
    /** @param host - Chat settings scope, durable on loopback and memory-only elsewhere. */
    constructor(host) {
        this.host = host;
        const adopt = () => {
            const accepted = host.getSnapshot().value?.performanceUsage;
            if (accepted !== undefined)
                this.mode.set(accepted);
        };
        this.unsubscribe = host.subscribe(adopt);
        adopt();
    }
    /** Release the accepted-value subscription. */
    dispose() { this.unsubscribe(); }
    /**
     * Publish a choice immediately and persist it when the scope supports writes.
     * @param mode - Statistics detail selected by the user.
     */
    setMode(mode) {
        if (mode === this.mode.getSnapshot())
            return;
        this.mode.set(mode);
        void this.host.set('performanceUsage', mode);
    }
}
