// Generated from runtime/alpha3/src/operations/nexttavern-market.mts; edit the TypeScript source.
/**
 * One deferred round that brings the upstream market onto a profile that does
 * not have it yet.
 *
 * The market is what can switch the shipped skin on, so this product never
 * ships a market of its own, never replaces one a person installed, and never
 * upgrades it afterwards. A missing market is resolved from upstream release
 * metadata at this install - not from a version written down when this product
 * was built - and the exact version that answered is the one this round asks
 * the host's own pnpm path for. A failure is reported as a failure: nothing
 * falls back to an older market, and nothing is reported as installed that the
 * profile does not carry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contained } from './public-transaction.mjs';
import { inspectBundledPackages, isWriterLockBusy } from './bundled-package-bootstrap.mjs';
import { recoverProtectedPackages } from './protected-packages.mjs';
import { readBundleReferenceState, createPackagePreparation } from './nexttavern-package-preparation.mjs';
export const MARKET_PACKAGE = 'dshmarket';
/** This product's own record of the market it installed; the profile's dependency stays the person's. */
export const MARKET_RECORD = '.nexttavern-market.json';
const RECORD_SCHEMA_VERSION = 1;
/**
 * A preparation round that may wait for the host's package transaction is
 * bounded the same way the reference round is; the market additionally waits
 * for that round's own decision, which is reached within its retry budget.
 */
const DEFER_RETRY_DELAY_MS = 250;
const DEFER_MAX_RETRY_DELAY_MS = 2_000;
const DEFER_RETRY_LIMIT = 24;
/**
 * The deferred round itself. Results are stated by this module, so the shared
 * scheduler's line about durable references is never printed for the market.
 */
export function createOwnedMarketInstallation(facts) {
    // A manager may already have applied pnpm's edits when another profile owns
    // the home. Keep this exact install's acceptance context until
    // the scheduler can finish it, including across an exhausted timer budget.
    let finishApplied;
    return createPackagePreparation({
        retryDelayMs: facts.retryDelayMs ?? DEFER_RETRY_DELAY_MS,
        maxRetryDelayMs: facts.maxRetryDelayMs ?? DEFER_MAX_RETRY_DELAY_MS,
        retryLimit: facts.retryLimit ?? DEFER_RETRY_LIMIT,
        inspect: () => ({ installedVersion: readInstalledMarketVersion(facts.home, facts.profile) }),
        prepare: async () => {
            try {
                const outcome = finishApplied ? finishApplied()
                    : await round(facts, finish => { finishApplied = finish; });
                if (outcome.state !== 'lock-busy')
                    finishApplied = undefined;
                return outcome;
            }
            catch (error) {
                const applied = finishApplied !== undefined;
                finishApplied = undefined;
                facts.logger?.warn(applied
                    ? 'NextTavern applied the upstream market installation but could not verify it'
                    : 'NextTavern did not install the upstream market', error);
                throw error;
            }
        },
    });
}
/**
 * A profile whose references were just prepared is relinked by the market's own
 * pnpm run, so a missing market is installed after them and never before them:
 * the other order would leave the shipped skin and those references unlinked
 * until some later package-manager operation.
 */
async function round(facts, retainApplied) {
    await facts.references.settle();
    const references = facts.references.state();
    if (references.state === 'inspect-only')
        return { state: 'lock-busy' };
    if (references.state !== 'prepared') {
        facts.logger?.warn('NextTavern did not install the upstream market: its durable package references are not'
            + ' prepared' + (references.detail ? ': ' + references.detail : ''));
        return { state: 'failed' };
    }
    const installed = installedMarketVersion(facts.home, facts.profile);
    if (installed !== null) {
        // Whoever installed this market owns its version. Reusing it is the whole
        // contract here: no update, no reinstall, no version this product prefers.
        facts.logger?.info(`NextTavern keeps the ${MARKET_PACKAGE} already installed at ${installed}`);
        return { state: 'current' };
    }
    return installMarket(facts, retainApplied);
}
async function installMarket(facts, retainApplied) {
    const manager = facts.manager();
    if (!manager)
        throw Error('NextTavern cannot resolve the upstream market without the host plugin manager');
    const resolution = await manager.inspect(MARKET_PACKAGE);
    if (resolution.status !== 'accepted') {
        throw Error(`The upstream market could not be resolved: ${resolution.problem}: ${resolution.reason}`);
    }
    const version = resolution.version;
    if (typeof version !== 'string' || version === '') {
        throw Error('The upstream market resolution named no exact version');
    }
    if (resolution.bundle !== true) {
        throw Error(`The upstream market ${MARKET_PACKAGE}@${version} does not declare a bundle patch`);
    }
    const spec = `${MARKET_PACKAGE}@${version}`;
    // One installation must use one resolution: the spec above is that exact
    // version and the registry asked first is the one that answered for it.
    const source = await resolveRegistrySource(manager, resolution.registry);
    const result = await manager.installBundle(spec, { enabled: true, registry: resolution.registry });
    if (result.application !== 'applied') {
        const detail = describeChange(result);
        // A profile another process still holds is busy, not rejected; the
        // scheduler's bounded deferral retries exactly this case.
        if (isWriterLockBusy(Error(detail)))
            return { state: 'lock-busy' };
        throw Error(`Installing ${spec} did not apply: ${detail}`);
    }
    const finish = () => {
        const verification = verifyInstalledMarket(facts, version);
        if (verification.state === 'pending-home-transaction')
            return { state: 'lock-busy' };
        if (verification.state === 'changed') {
            // The manager owns installation and its rollback. After it returns applied,
            // this product can report acceptance but cannot undo its or a later user's edits.
            throw Error(`The host manager applied ${spec}, but post-install verification failed: ${verification.problem}`);
        }
        const record = {
            schemaVersion: RECORD_SCHEMA_VERSION,
            profile: facts.profile,
            state: 'installed',
            resolvedAt: (facts.now?.() ?? new Date()).toISOString(),
            package: MARKET_PACKAGE,
            version,
            registry: source,
            integrity: readLockfileIntegrity(facts.home, facts.profile, version),
        };
        writeMarketRecord(facts.home, record);
        facts.logger?.info(`NextTavern installed the upstream market ${spec} from `
            + `${source ?? "pnpm's configured registry"}; integrity ${record.integrity ?? 'not recorded'}`);
        return { state: 'prepared', version };
    };
    retainApplied(finish);
    return finish();
}
/**
 * The registry this round actually asked, named concretely when the host can.
 * An inspection that defers to pnpm's own configuration answers with null, and
 * that registry's URL is what the record should carry.
 */
async function resolveRegistrySource(manager, asked) {
    if (asked !== null)
        return asked;
    try {
        return (await manager.registries?.())?.resolved ?? null;
    }
    catch {
        return null;
    }
}
function verifyInstalledMarket(facts, version) {
    let references = readBundleReferenceState(facts.productRoot, facts.home, facts.profile);
    if (references === 'pending-home-transaction') {
        try {
            recoverProtectedPackages(facts.home);
        }
        catch (error) {
            if (isWriterLockBusy(error))
                return { state: 'pending-home-transaction' };
            throw error;
        }
        // Recovery (or release since the read) changes the home owner condition.
        references = readBundleReferenceState(facts.productRoot, facts.home, facts.profile);
        if (references === 'pending-home-transaction')
            return { state: 'pending-home-transaction' };
    }
    let installed;
    try {
        installed = installedMarketVersion(facts.home, facts.profile);
    }
    catch (error) {
        return { state: 'changed', problem: 'left the profile manifest unreadable (' + text(error) + ')' };
    }
    if (installed !== version)
        return { state: 'changed',
            problem: `did not leave ${MARKET_PACKAGE}@${version} in the profile dependencies` };
    if (references === 'changed') {
        return { state: 'changed', problem: 'changed the durable references this product prepared for its bundled packages' };
    }
    try {
        inspectBundledPackages(facts.productRoot, facts.hostAnchor, facts.resolvePeerManifest);
    }
    catch (error) {
        return { state: 'changed', problem: 'changed a protected package or the host instance it shares (' + text(error) + ')' };
    }
    return { state: 'verified' };
}
function describeChange(result) {
    const parts = [`the host manager reported ${result.application} at its ${result.stage} step`];
    if (result.error) {
        parts.push(result.error.code + (result.error.diagnostic ? ': ' + result.error.diagnostic : ''));
    }
    if (result.failedAt)
        parts.push('failed at ' + result.failedAt);
    if (result.pendingBuilds?.length)
        parts.push('pending build scripts: ' + result.pendingBuilds.join(', '));
    if (result.packageResult) {
        parts.push(`pnpm exited with code ${result.packageResult.exitCode}`
            + (result.packageResult.kind ? ' (' + result.packageResult.kind + ')' : ''));
    }
    return parts.join('; ');
}
/** The version this profile's own manifest already names, or null when it has no market. */
export function installedMarketVersion(home, profile) {
    const manifest = readProfileManifest(home, profile);
    const declared = manifest.dependencies?.[MARKET_PACKAGE];
    return typeof declared === 'string' && declared !== '' ? declared : null;
}
/** The same read for a caller that only decides whether a round is needed. */
function readInstalledMarketVersion(home, profile) {
    try {
        return installedMarketVersion(home, profile);
    }
    catch {
        return null;
    }
}
/** The record this product wrote for one profile, or null when it installed no market there. */
export function readMarketRecord(home, profile) {
    try {
        const file = contained(fs.realpathSync(home), `profiles/${profile}/${MARKET_RECORD}`);
        const record = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (record?.schemaVersion !== RECORD_SCHEMA_VERSION || record.profile !== profile
            || record.package !== MARKET_PACKAGE || record.state !== 'installed'
            || typeof record.version !== 'string' || typeof record.resolvedAt !== 'string')
            return null;
        return record;
    }
    catch {
        return null;
    }
}
function writeMarketRecord(home, record) {
    const file = contained(fs.realpathSync(home), `profiles/${record.profile}/${MARKET_RECORD}`);
    const temporary = file + '.write';
    fs.writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n');
    fs.renameSync(temporary, file);
}
function readProfileManifest(home, profile) {
    const parsed = JSON.parse(fs.readFileSync(path.join(profileDirectory(home, profile), 'package.json'), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw Error('Invalid profile manifest');
    return parsed;
}
function profileDirectory(home, profile) {
    if (!/^[a-zA-Z0-9_-]+$/.test(profile))
        throw Error('Invalid profile name');
    return path.dirname(contained(fs.realpathSync(home), `profiles/${profile}/package.json`));
}
/**
 * The integrity pnpm itself recorded for the installed market, read from the
 * profile's lockfile. The lockfile is the package manager's own record of what
 * it fetched, so a missing entry is reported as no integrity, never guessed.
 */
function readLockfileIntegrity(home, profile, version) {
    try {
        const lockfile = path.join(profileDirectory(home, profile), 'pnpm-lock.yaml');
        const lock = fs.readFileSync(lockfile, 'utf8');
        const key = new RegExp(`^ {2}${escapeExpression(MARKET_PACKAGE)}@${escapeExpression(version)}`
            + '(?:\\([^)]*\\))?:', 'm');
        const found = key.exec(lock);
        if (!found)
            return null;
        const integrity = /resolution: \{integrity: ([A-Za-z0-9+/=._-]+)/.exec(lock.slice(found.index, found.index + 400));
        return integrity?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function escapeExpression(value) {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function text(error) {
    return error instanceof Error ? error.message : String(error);
}
