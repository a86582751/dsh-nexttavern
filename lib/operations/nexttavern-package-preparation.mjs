// Generated from runtime/alpha3/src/operations/nexttavern-package-preparation.mts; edit the TypeScript source.
import { dirname, join } from 'node:path';
import { bootstrapBundledPackages, isWriterLockBusy, readBundleIdentity } from './bundled-package-bootstrap.mjs';
import { durableReferencesIntact, readPreparedReferences } from './protected-packages.mjs';
/**
 * The official manager holds this lock across its own operation, including the
 * reload it awaits before publishing `plugin-manager/changed`. This bound
 * covers the remainder of that transaction; a longer hold is reported as a
 * busy profile and resolved by the host's next notice or activation.
 */
const LOCK_WAIT_MS = 120_000;
const RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 1_600;
const RETRY_LIMIT = 6;
/** Further attempts the host's own later notices may start after the timer budget. */
const NOTICE_RESUME_LIMIT = 8;
export function createPackagePreparation(options) {
    const logger = options.logger;
    const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
    const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
    const maxRetryDelayMs = options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS;
    const retryLimit = options.retryLimit ?? RETRY_LIMIT;
    // One in-flight attempt, one retry timer, and a bounded number of attempts:
    // a repeated change notice cannot stack writer-lock waits behind one shutdown.
    let running;
    let retry;
    let attempts = 0;
    let attempted = false;
    let closed = false;
    let current = { state: 'inspect-only', relinkPending: true };
    async function attempt() {
        attempts += 1;
        let inspectedVersion;
        try {
            inspectedVersion = options.inspect().installedVersion;
        }
        catch (error) {
            current = { state: 'failed', relinkPending: true, detail: text(error) };
            logger?.warn('NextTavern cannot read its prepared package references', error);
            return;
        }
        let outcome;
        try {
            outcome = await options.prepare();
        }
        catch (error) {
            current = { state: 'failed', relinkPending: true, detail: text(error) };
            logger?.warn('NextTavern could not prepare durable bundled package references', error);
            return;
        }
        if (outcome.state === 'lock-busy') {
            // The host holds its own writer lock. That is a busy profile, not a failed
            // install, so a bounded backoff follows it. A notice or activation the
            // host raises after that starts the next round, so this never polls.
            if (attempts <= retryLimit && !closed) {
                const delay = Math.min(retryDelayMs * 2 ** (attempts - 1), maxRetryDelayMs);
                retry = setTimer(() => { retry = undefined; run(); }, delay);
            }
            return;
        }
        if (outcome.state === 'failed') {
            current = { state: 'failed', relinkPending: true };
            return;
        }
        current = { state: 'prepared', relinkPending: false };
        if (outcome.state === 'current')
            return;
        logger?.info(inspectedVersion === null
            ? `NextTavern prepared durable references to its bundled packages at ${outcome.version}`
            : `NextTavern refreshed durable bundled package references from ${inspectedVersion} to ${outcome.version}`);
    }
    function run() {
        running = attempt().finally(() => { running = undefined; });
    }
    /**
     * A busy profile keeps its question open, a verified or rejected bundle does
     * not. Timers stop at `retryLimit` so a long host transaction is not polled;
     * the host's own later notice or activation may still finish the job, up to a
     * hard ceiling that no sequence of notices can push past.
     */
    const canRetry = () => current.state === 'inspect-only' && attempts <= retryLimit;
    const canResume = () => current.state === 'inspect-only' && attempts < retryLimit + NOTICE_RESUME_LIMIT;
    return {
        schedule() {
            if (closed || running || retry !== undefined)
                return;
            if (!attempted) {
                attempted = true;
                run();
                return;
            }
            if (canRetry() || canResume())
                run();
        },
        settle() {
            // One read is enough: the caller observes the attempt it just scheduled,
            // and an attempt that is still pending is exactly what it must wait for.
            return running ?? Promise.resolve();
        },
        close() {
            closed = true;
            if (retry !== undefined) {
                clearTimer(retry);
                retry = undefined;
            }
        },
        state: () => current,
    };
}
/**
 * Bind the preparation to this product's running context. The change notice
 * reports a completed manager operation on this profile; only an instance that
 * owns the profile prepares references through it, never a host that merely
 * loaded this package.
 */
export function bindPackagePreparation(ctx, preparation) {
    ctx.on('plugin-manager/changed', (_change) => {
        // Returns without awaiting: this notice is published while the manager
        // still holds the writer lock this work has to acquire.
        preparation.schedule();
    });
}
/**
 * Whether the receipt already pins exactly this bundle: the same owned names,
 * and for each one the same version and the same bytes. Owned packages release
 * on their own versions, so the product version is never the right key here.
 */
function referencesCurrent(recorded, packages) {
    if (recorded.size !== packages.length)
        return false;
    return packages.every(spec => {
        const item = recorded.get(spec.name);
        return item?.version === spec.version && item.generation === spec.generation;
    });
}
/**
 * The product's own durable-reference work against one installed profile.
 *
 * The read-only step decides from the bundle's identity, the profile's recorded
 * references and each generation's own identity whether this round can stand
 * down. Admission of the member bytes, the peers and the entry points stays in
 * the locked transaction that may write, so a tree edited after that decision is
 * still rejected there, and nothing is ever written against unverified bytes.
 */
export function createOwnedPackagePreparation(facts) {
    return createPackagePreparation({
        logger: facts.logger,
        inspect: () => {
            // Logging only: the shipped bundle versions each owned package, so a
            // single recorded version names it; mixed versions stay unnamed.
            const versions = new Set([...readPreparedReferences(facts.home, facts.profile)?.values() ?? []]
                .map(item => item.version));
            return { installedVersion: versions.size === 1 ? [...versions][0] : null };
        },
        prepare: async () => {
            const identity = readBundleIdentity(facts.productRoot);
            const recorded = readPreparedReferences(facts.home, facts.profile);
            // Both halves decide, because either one alone would report a profile that
            // is not actually ready. The receipt must name this bundle's own versions
            // and generations, and the profile must still carry the references and
            // generations those records describe. A mismatch in either half leaves the
            // decision - and every write - to the locked transaction, which is also
            // the only reader of member bytes.
            if (recorded && referencesCurrent(recorded, [...identity.packages, ...identity.bundles])
                && durableReferencesIntact(facts.home, facts.profile, recorded.values()))
                return { state: 'current' };
            let version;
            try {
                const prepared = await bootstrapBundledPackages({
                    productRoot: facts.productRoot, hostAnchor: facts.hostAnchor,
                    home: facts.home, profile: facts.profile,
                    // A preparation transaction keeps its rollback copy beside the home it
                    // edits: the profile tree itself must never receive these journals.
                    backup: join(dirname(facts.home), 'nexttavern-prepare-backup', `${Date.now()}-${process.pid}`),
                    resolvePeerManifest: facts.resolvePeerManifest,
                    lockWaitMs: facts.lockWaitMs ?? LOCK_WAIT_MS,
                });
                version = prepared.version;
            }
            catch (error) {
                // A lock the host held for longer than that bound is a busy profile,
                // not a rejected bundle: the next notice or activation retries it.
                if (isWriterLockBusy(error))
                    return { state: 'lock-busy' };
                throw error;
            }
            return { state: 'prepared', version };
        },
    });
}
function text(error) {
    return error instanceof Error ? error.message : String(error);
}
