// Generated from runtime/alpha3/src/operations/nexttavern-package-preparation.mts; edit the TypeScript source.
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { bootstrapBundledPackages, isWriterLockBusy, readBundleIdentity } from './bundled-package-bootstrap.mjs';
/** Receipt the preparing transaction writes into the profile it edits. */
const RECEIPT = '.nexttavern-protected-packages.json';
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
 * The profile receipt currently recording durable references for one profile,
 * or null when nothing was prepared yet. The receipt's own paths and hashes are
 * revalidated inside the preparing transaction; this read only decides whether
 * that transaction is needed at all.
 */
function preparedVersions(facts) {
    try {
        const receipt = JSON.parse(fs.readFileSync(join(facts.home, 'profiles', facts.profile, RECEIPT), 'utf8'));
        if (receipt?.schemaVersion !== 1 || receipt.profile !== facts.profile || !Array.isArray(receipt.packages))
            return null;
        const recorded = new Map();
        for (const item of receipt.packages) {
            if (typeof item?.name !== 'string' || typeof item.version !== 'string')
                return null;
            recorded.set(item.name, item.version);
        }
        return recorded;
    }
    catch {
        return null;
    }
}
/** Whether the receipt already records exactly this bundle's owned packages at these versions. */
function referencesCurrent(recorded, version, names) {
    if (!recorded || recorded.size !== names.length)
        return false;
    return names.every(name => recorded.get(name) === version);
}
/**
 * The product's own durable-reference work against one installed profile.
 *
 * The read-only step decides from the bundle's identity alone whether the
 * durable references already describe it; admission of the bytes, the peers and
 * the entry points happens once inside the locked transaction that may write.
 * A profile or tree edited after that decision is still rejected by the
 * transaction, because nothing is written against unverified bytes.
 */
export function createOwnedPackagePreparation(facts) {
    return createPackagePreparation({
        logger: facts.logger,
        inspect: () => {
            const versions = new Set(preparedVersions(facts)?.values() ?? []);
            return { installedVersion: versions.size === 1 ? [...versions][0] : null };
        },
        prepare: async () => {
            const identity = readBundleIdentity(facts.productRoot);
            const names = identity.packages.map(spec => spec.name);
            if (referencesCurrent(preparedVersions(facts), identity.version, names))
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
