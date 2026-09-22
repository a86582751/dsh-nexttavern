// Generated from runtime/alpha3/compat/session-controller/src/client/sessions/projection-store.ts; edit the TypeScript source.
import { Notifier } from './notifier.js';
/**
 * One session's projection values. Framework semantics, uniform across every
 * key. Sequenced writes (a baseline seeds rows at its cut, a push frame
 * updates one row) compare seqs among themselves: a lower-or-equal seq within
 * the Host generation loses, so a replayed frame cannot regress a value and a
 * stale baseline cannot overwrite a newer frame. Cached writes (the session
 * list's zero-I/O block) only fill keys no sequenced row holds, and a baseline
 * discards every cached row before it seeds, regardless of seq: the connected
 * Session is the truth and a cached value never outranks it. A key the store
 * has never seen reads `undefined` (capability absent). Faces are identity-stable
 * per key (create-on-demand, cached) so the React side binds each exactly
 * once; the store-level channel (`subscribeAny`) serves coarse consumers (the
 * manager's list projection reads the `title` key).
 */
export class ProjectionValueStore {
    rows = new Map();
    channels = new Map();
    valuesCache;
    /** Coarse any-key channel (no snapshot cache to rebuild: reads hit rows directly). */
    anyNotifier = new Notifier(() => { });
    /**
     * Key-addressed bare observable face (the useProjection resolution path).
     * Always defined — absence is an `undefined` snapshot, never a missing
     * face, so a component may subscribe before the key ever carries a value.
     * @param key - projection key.
     * @returns the identity-stable face for this key.
     */
    faceOf(key) {
        return this.channel(key).face;
    }
    /**
     * Current whole value for a key (erased framework read; typed reads go
     * through `useProjection`'s map lookup).
     * @param key - projection key.
     * @returns the value, or undefined while the key is absent.
     */
    get(key) {
        return this.rows.get(key)?.value;
    }
    /**
     * Read every current projection value as one reference-stable snapshot.
     * @returns The same frozen value map until a row changes.
     */
    values() {
        if (this.valuesCache === undefined) {
            this.valuesCache = Object.freeze(Object.fromEntries([...this.rows].map(([key, row]) => [key, row.value])));
        }
        return this.valuesCache;
    }
    /**
     * Subscribe to any-key changes (microtask-batched) — the manager's list
     * rebuild channel.
     * @param listener - change callback.
     * @returns the unsubscribe function.
     */
    subscribeAny(listener) {
        return this.anyNotifier.subscribe(listener);
    }
    /**
     * Apply one finished value from the Session control stream.
     * @param key - projection key.
     * @param value - whole value computed by the host unit.
     * @param seq - the unit's watermark at emission.
     */
    apply(key, value, seq) {
        const row = this.rows.get(key);
        // higher seq wins among sequenced rows; replays and stale frames drop. A
        // cached row has no comparable seq and always yields.
        if (row?.kind === 'sequenced' && seq <= row.seq)
            return;
        this.rows.set(key, { kind: 'sequenced', value, seq });
        this.changed(key);
    }
    /**
     * Fill keys from a session-list block the Host labeled `cached`: a zero-I/O
     * view of the persisted checkpoint. A cached value lands only where no
     * sequenced row exists: a connected Session has already answered for such
     * a key, and the list's view of the persisted checkpoint cannot be newer
     * than it.
     * @param values - whole values by key viewed from the persisted checkpoint.
     */
    applyCached(values) {
        for (const key of Object.keys(values)) {
            if (this.rows.get(key)?.kind === 'sequenced')
                continue;
            this.rows.set(key, { kind: 'cached', value: values[key] });
            this.changed(key);
        }
    }
    /**
     * Seed from a history tail page's projections block. Every cached row is
     * discarded first, regardless of seq: the block comes from the connected
     * Session, and a value viewed from the persisted checkpoint never outranks
     * it. Then every carried key lands under the same seq rule as frames, and a
     * key the block omits is capability-absent as of the cut — its row clears
     * unless a newer frame already superseded the cut (a stale baseline can
     * neither overwrite nor clear newer sequenced values).
     * @param baseline - the response's projections block.
     */
    seed(baseline) {
        for (const [key, row] of this.rows) {
            if (row.kind !== 'cached')
                continue;
            this.rows.delete(key);
            this.changed(key);
        }
        // Erased walk: the framework crosses the open key space; per-key typing
        // is re-established at the consumer (useProjection's map lookup).
        const values = baseline.values;
        for (const key of Object.keys(values))
            this.apply(key, values[key], baseline.asOfSeq);
        for (const [key, row] of this.rows) {
            if (Object.hasOwn(values, key))
                continue;
            // Every cached row was deleted above; the kind test only narrows the
            // type so `row.seq` is readable.
            if (row.kind === 'sequenced' && row.seq > baseline.asOfSeq)
                continue;
            this.rows.delete(key);
            this.changed(key);
        }
    }
    /** Discard one Host generation's values and watermarks while preserving subscribed faces. */
    clear() {
        for (const key of this.rows.keys()) {
            this.rows.delete(key);
            this.changed(key);
        }
    }
    changed(key) {
        this.valuesCache = undefined;
        this.channels.get(key)?.notifier.markDirty();
        this.anyNotifier.markDirty();
    }
    channel(key) {
        let channel = this.channels.get(key);
        if (channel === undefined) {
            // The notifier only batches (no snapshot cache to rebuild: faces read rows directly).
            const notifier = new Notifier(() => { });
            channel = {
                notifier,
                face: {
                    getSnapshot: () => this.rows.get(key)?.value,
                    subscribe: listener => notifier.subscribe(listener),
                },
            };
            this.channels.set(key, channel);
        }
        return channel;
    }
}
