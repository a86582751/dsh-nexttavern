// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/use-chat-reading.ts; edit the TypeScript source.
/** Follow-tail ownership, saved-position restoration, and sampled reader movement. */
import { useLayoutEffect, useState } from 'react';
const FOLLOW_THRESHOLD = 24;
const SCROLL_SAMPLE_INTERVAL_MS = 500;
/** Owns reading policy and its cancellable sampling work, without DOM access. */
export class ChatReading {
    viewport;
    store;
    state;
    onChange;
    sampleTimer = null;
    probeFrame = null;
    sampled = null;
    constructor(viewport, store, state, onChange) {
        this.viewport = viewport;
        this.store = store;
        this.state = state;
        this.onChange = onChange;
    }
    /**
     * Expose pending reader ownership to navigation and resize handlers.
     * @returns whether reader input still awaits interval or scrollend sampling.
     */
    get pending() { return this.sampleTimer !== null; }
    /**
     * Expose the active follow policy.
     * @returns whether content growth retains bottom-follow ownership.
     */
    get followingTail() { return this.state.followingTail; }
    /**
     * Adopt the committed Session's scroll memory.
     * @param store - scroll memory for the current Session.
     */
    setStore(store) { this.store = store; }
    /**
     * Connect history policy to settled reading observations.
     * @param sampled - receives settled reader positions.
     * @returns a disposer that disconnects only this listener.
     */
    connect(sampled) {
        this.sampled = sampled;
        return () => { if (this.sampled === sampled)
            this.sampled = null; };
    }
    /** Cancel timers and animation frames and detach the sample listener. */
    dispose() {
        this.cancelPending();
        this.sampled = null;
    }
    /** Release bottom follow and pending sampling for an explicit navigation. */
    pauseFollowing() {
        this.cancelPending();
        this.publish({ ...this.state, followingTail: false });
    }
    /** Land at the current floor and clear saved reader position. */
    followTail() {
        const landing = this.viewport.scrollToBottom();
        if (landing === null)
            return;
        this.cancelPending();
        this.commit(landing, true, this.viewport.latestTurn);
    }
    /** Restore the Session's semantic position, or follow the tail when none is saved. */
    restore() {
        const saved = this.store.read();
        if (saved === null) {
            this.followTail();
            return;
        }
        const landing = this.viewport.restore(saved);
        if (landing === null)
            return;
        this.cancelPending();
        const following = this.nearBottom(landing.metrics);
        this.commit(landing, following, following ? this.viewport.latestTurn : this.state.activeTurn, following);
        if (!this.state.followingTail && landing.position === null) {
            const position = this.viewport.capturePosition();
            if (position !== null)
                this.store.save(position);
        }
        this.refreshActiveTurn();
    }
    /**
     * Adopt a known landing without rediscovering its anchor.
     * @param landing - measured navigation result that replaces pending reader input.
     */
    acceptNavigation(landing) {
        this.cancelPending();
        const following = this.nearBottom(landing.metrics);
        this.commit(landing, following, landing.turn ?? (following ? this.viewport.latestTurn : this.state.activeTurn));
    }
    /**
     * Retain reading policy while history changes the anchor's geometry.
     * @param landing - compensated position that retains the current reading policy.
     */
    preservePosition(landing) {
        this.cancelPending();
        this.commit(landing, this.state.followingTail, this.state.activeTurn);
    }
    /**
     * Handle pinned layout movement and reader arrivals at the floor immediately.
     * @param scroll - attributed scroll delivery; other reader movement remains pending until sampled.
     */
    onScroll = (scroll) => {
        if ((!scroll.movedByReader && this.state.followingTail)
            || (scroll.movedByReader && scroll.metrics.top >= scroll.metrics.floor)) {
            this.followTail();
            this.sampled?.({ position: null, movedByReader: scroll.movedByReader, followingTail: true });
            return;
        }
        this.sampleTimer ??= window.setTimeout(this.flushSample, SCROLL_SAMPLE_INTERVAL_MS);
    };
    /** Settle pending reader movement at the browser's scrollend. */
    onScrollEnd = () => { this.flushSample(); };
    /** Reconcile a layout change without overriding unsampled reader input. */
    onResize() {
        if (this.pending)
            return;
        if (this.state.followingTail)
            this.followTail();
        else
            this.refreshActiveTurn();
    }
    /** Resolve the active turn from tail ownership or a coalesced reading-line probe. */
    refreshActiveTurn() {
        if (this.pending)
            return;
        if (this.state.followingTail) {
            this.publish({ ...this.state, initialized: true, activeTurn: this.viewport.latestTurn });
            return;
        }
        if (this.probeFrame !== null)
            return;
        if (typeof requestAnimationFrame !== 'function')
            this.probe();
        else
            this.probeFrame = requestAnimationFrame(this.probe);
    }
    nearBottom(metrics) {
        return metrics.floor - metrics.top <= FOLLOW_THRESHOLD + 1;
    }
    commit(landing, followingTail, activeTurn, initialized = true) {
        if (followingTail)
            this.store.save(null);
        else if (landing.position !== null)
            this.store.save(landing.position);
        this.publish({ initialized, followingTail, activeTurn });
    }
    publish(state) {
        if (state.initialized === this.state.initialized && state.followingTail === this.state.followingTail
            && state.activeTurn === this.state.activeTurn)
            return;
        this.state = state;
        this.onChange(state);
    }
    cancelPending() {
        if (this.sampleTimer !== null)
            window.clearTimeout(this.sampleTimer);
        if (this.probeFrame !== null && typeof cancelAnimationFrame === 'function')
            cancelAnimationFrame(this.probeFrame);
        this.sampleTimer = null;
        this.probeFrame = null;
    }
    probe = () => {
        this.probeFrame = null;
        if (this.pending)
            return;
        const scroll = this.viewport.readScroll();
        if (scroll === null)
            return;
        const activeTurn = this.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
        this.publish({ ...this.state, initialized: true, activeTurn });
    };
    flushSample = () => {
        if (!this.pending)
            return;
        this.cancelPending();
        const scroll = this.viewport.readScroll();
        if (scroll === null)
            return;
        const followingTail = scroll.movedByReader ? this.nearBottom(scroll.metrics) : this.state.followingTail;
        let position = null;
        if (!scroll.movedByReader && followingTail)
            this.followTail();
        else {
            position = followingTail ? null : this.viewport.capturePosition();
            this.viewport.acknowledge(scroll.metrics);
            if (followingTail || position !== null)
                this.store.save(position);
            const activeTurn = this.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
            this.publish({ initialized: true, followingTail, activeTurn });
        }
        this.sampled?.({ position, movedByReader: scroll.movedByReader, followingTail });
    };
}
/**
 * Retain reading policy and expose only changes in visible reading state.
 * @param viewport - turn-aware DOM operations.
 * @param store - Session-owned semantic scroll memory.
 * @param initialTurn - latest loaded turn before the first landing.
 * @returns the reading owner and its React-visible state.
 */
export function useChatReading(viewport, store, initialTurn) {
    const [state, setState] = useState(() => ({
        initialized: false,
        followingTail: store.read() === null,
        activeTurn: initialTurn,
    }));
    const [reading] = useState(() => new ChatReading(viewport, store, state, setState));
    useLayoutEffect(() => { reading.setStore(store); }, [reading, store]);
    useLayoutEffect(() => () => { reading.dispose(); }, [reading]);
    return { reading, state };
}
