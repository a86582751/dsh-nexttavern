// Generated from runtime/alpha3/compat/ui-chat/src/client/transcript-view.ts; edit the TypeScript source.
/** Host-backed work-details presentation policy. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { DEFAULT_TRANSCRIPT_VIEW_MODE, LEGACY_TRANSCRIPT_VIEW_MODE, LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE, TRANSCRIPT_VIEW_FIELD, } from "../chat-settings.js";
/** Live work-details preference consumed by Chat and its Settings row. */
export class TranscriptViewPolicy {
    host;
    unsubscribe;
    /** Reactive current mode; defaults to Standard before Host settings arrive. */
    mode = createSnapshotStore(DEFAULT_TRANSCRIPT_VIEW_MODE);
    /**
     * @param host - durable Chat settings scope.
     */
    constructor(host) {
        this.host = host;
        this.unsubscribe = host.subscribe(() => { this.adopt(); });
        this.adopt();
    }
    /** Release the accepted-value subscription. */
    dispose() { this.unsubscribe(); }
    /**
     * Publish and persist one explicit user choice.
     * @param mode - Compact, Standard, Detailed, or Verbose work details.
     */
    setMode(mode) {
        if (this.mode.getSnapshot() === mode)
            return;
        this.mode.set(mode);
        void this.host.set(TRANSCRIPT_VIEW_FIELD, mode);
    }
    /** Adopt the latest accepted Host section without writing it back. */
    adopt() {
        const section = this.host.getSnapshot().value;
        if (section === undefined)
            return;
        const saved = section.transcriptView;
        const mode = saved === LEGACY_TRANSCRIPT_VIEW_MODE ? 'standard'
            : saved === LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE ? 'detailed' : saved;
        if (this.mode.getSnapshot() !== mode)
            this.mode.set(mode);
    }
}
