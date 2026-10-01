// Generated from runtime/alpha3/src/operations/protected-packages.mts; edit the TypeScript source.
/** Prepare immutable owned package generations and profile references, without running pnpm. */
import fs from 'node:fs';
import path from 'node:path';
import { applyTransaction, contained, digest, recoverInterruptedTransaction } from './public-transaction.mjs';
const transactionPurpose = 'prepare-protected-package-references';
const receiptName = '.nexttavern-protected-packages.json';
/** The profile's own patch layer, the file a client-only claim has to reach. */
const patchLayerName = 'cordis.patch.yml';
/**
 * The profile patch layer's own vocabulary for the claim, kept as the single
 * place that spells it: a person reading the layer later has to be able to see
 * which rows this installer owns, and a manager scanning the layer has to
 * recognise the ids.
 */
function clientClaimBlock(names) {
    const comment = [
        '# NextTavern owns the Loader rows of its client-only packages: its own bundle',
        '# layer mounts each browser half together with its host half, so a manager that',
        '# mounts installed client-only packages by itself (dshmarket\'s client-only',
        '# shim) has to skip a name claimed here. These rows are inert labels for that',
        '# claim: `disabled` keeps them out of every composition, and the ids are what',
        '# such a manager scans for. Removing them brings the second Loader source back',
        '# and breaks this profile the next time the product itself is switched off.',
    ].join('\n');
    return `${comment}\n- insert:\n` + names.map(name => `    - id: ${name}\n      disabled: true\n`).join('');
}
/**
 * Whether one patch layer names `id` anywhere: the same line-wise read a
 * manager performs before it decides that a name is not its own to mount. An
 * exact id or package name is enough, so a person may rewrite the claim by
 * hand into any shape their loader accepts. Deliberately not a YAML parse:
 * the read-only path runs on whatever the profile happens to hold.
 */
function patchLayerMentions(text, id) {
    const rowId = id.replace(/^@/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    for (const line of text.split(/\r?\n/)) {
        const declared = /^\s*-?\s*id:\s*['"]?([A-Za-z0-9._/@-]+)/.exec(line)?.[1];
        if (declared === id || declared === rowId)
            return true;
        if (/^\s*name:\s*['"]?([^'"\s]+)/.exec(line)?.[1] === id)
            return true;
    }
    return false;
}
/**
 * Why this patch layer cannot take an appended block, or null when it can.
 *
 * The profile template ships a bare `[]` placeholder, and appending after it
 * would put two top-level nodes in one document — the exact YAML error a hand
 * edit runs into. Comments only, that placeholder, and a block sequence are
 * appendable; a flow-style row list or a document that is not a list at all is
 * refused, and the caller keeps its read-only verdict instead of writing a
 * file it would have to guess about.
 */
function clientClaimRefusal(text) {
    const core = text.replace(/^[ \t]*#.*$/gmu, '').trim();
    if (core === '' || core === '[]' || core === '[ ]')
        return null;
    const last = text.split(/\r?\n/).map(line => line.trim())
        .filter(line => line !== '' && !line.startsWith('#')).pop() ?? '';
    if (/^[[{]/u.test(last))
        return 'the patch layer ends in a top-level flow structure';
    if (!core.startsWith('-'))
        return 'the patch layer is not a top-level entry list';
    return null;
}
/** The claim block appended to a layer this module already admitted. */
function clientClaimBytes(text, names) {
    const core = text.replace(/^[ \t]*#.*$/gmu, '').trim();
    const body = core === '[]' || core === '[ ]'
        ? text.replace(/^[ \t]*\[[ \t]*\][ \t]*(?:#.*)?(?:\r?\n|$)/mu, '# []\n')
        : text;
    return Buffer.from((body === '' || body.endsWith('\n') ? body : `${body}\n`) + clientClaimBlock(names));
}
/**
 * The claim rows this profile's patch layer still has to take, and the write
 * that would add them.
 *
 * The layer is append-only for this installer: a name already named there is
 * left exactly as the person wrote it, and nothing this product ever wrote is
 * edited or removed. `update` is null both when every name is already claimed
 * and when the layer cannot take an appended block at all.
 */
function planClientClaim(home, profile, names) {
    const relative = `profiles/${profile}/${patchLayerName}`;
    const file = contained(home, relative);
    const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
    const text = current?.toString('utf8') ?? '';
    const missing = names.filter(name => !patchLayerMentions(text, name));
    if (!missing.length)
        return { missing, update: null, detail: undefined };
    const refusal = clientClaimRefusal(text);
    if (refusal !== null)
        return { missing, update: null, detail: refusal };
    return { missing, update: { path: relative, before: current === null ? null : digest(current),
            bytes: clientClaimBytes(text, missing) }, detail: undefined };
}
function inventory(root, prefix = '') {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
        const relative = prefix + entry.name;
        if (entry.isSymbolicLink())
            throw Error('Protected package contains a link: ' + relative);
        if (entry.isDirectory())
            return inventory(path.join(root, entry.name), relative + '/');
        if (!entry.isFile())
            throw Error('Protected package contains a special file: ' + relative);
        return [relative];
    }).sort();
}
function normalizedFiles(files) {
    if (!Array.isArray(files) || !files.length)
        throw Error('Protected package inventory is empty');
    const seen = new Set();
    return files.map(file => {
        if (!file || typeof file.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
            throw Error('Invalid protected package inventory member');
        }
        if (file.path.split('/').some(part => /[<>:"\\|?*\u0000-\u001f]|[. ]$/.test(part)
            || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
            throw Error('Protected path is not portable: ' + file.path);
        }
        // Windows treats these names as aliases even when the source was built on Linux.
        const identity = file.path.toLowerCase();
        if (seen.has(identity))
            throw Error('Duplicate protected package path: ' + file.path);
        seen.add(identity);
        return { path: file.path, sha256: file.sha256 };
    }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
/**
 * Identity of one protected generation. Every byte that reaches a durable
 * directory is named by this digest, so equal generations are interchangeable
 * and a verification of one cannot stand in for another.
 */
export function protectedGeneration(input) {
    return generationOf(input, normalizedFiles(input.files));
}
const generationOf = (input, files) => digest(JSON.stringify({ name: input.name, version: input.version, files }));
function recordFor(home, profile, input, source) {
    if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.name))
        throw Error('Only independently named NextTavern child packages may be protected');
    if (typeof input.version !== 'string' || !input.version)
        throw Error('Protected package version is required');
    const files = normalizedFiles(input.files);
    for (const file of files)
        contained(home, file.path);
    if (!files.some(file => file.path === 'package.json'))
        throw Error('Protected inventory must include package.json');
    if (input.bundle === true && source !== undefined)
        assertBundleActivationLayer(source, input.name);
    const generation = generationOf(input, files);
    const directory = `maintenance/fixed-packages/${input.name}/${generation}`;
    const reference = 'file:' + path.relative(contained(home, `profiles/${profile}`), contained(home, directory)).replaceAll('\\', '/');
    return input.bundle === true
        ? { name: input.name, version: input.version, files, directory, reference, bundle: true }
        : { name: input.name, version: input.version, files, directory, reference };
}
/**
 * An owned bundle is only useful with its activation layer, so a record that
 * claims to be one must carry a patch file this tree actually contains. The
 * compatibility packages take the opposite gate in the bundle admission, which
 * rejects any `dsh.bundle` declaration.
 */
function assertBundleActivationLayer(source, name) {
    const metadata = JSON.parse(fs.readFileSync(contained(source, 'package.json'), 'utf8'));
    const patch = metadata.dsh?.bundle?.patch;
    if (typeof patch !== 'string' || patch === '')
        throw Error('Owned bundle has no activation layer: ' + name);
    // The manifest names the patch the way DSH reads it (`./cordis.patch.yml`),
    // and the containment gate rejects a leading `./`, so normalise first.
    const relative = patch.replace(/^\.\//, '');
    if (!fs.existsSync(contained(source, relative)))
        throw Error('Owned bundle patch file is missing: ' + name);
}
/**
 * The profile's own bundle roster, in its existing order. Only entries this
 * installer owns are edited: the product's compatibility packages have no
 * activation layer, and a third-party bundle a person installed is never
 * reordered or removed.
 */
function profileBundles(manifest) {
    const dsh = manifest.dsh;
    if (dsh === undefined)
        return [];
    if (!dsh || typeof dsh !== 'object' || Array.isArray(dsh))
        throw Error('Invalid profile dsh section');
    const profile = dsh.profile;
    if (profile === undefined)
        return [];
    if (!profile || typeof profile !== 'object' || Array.isArray(profile))
        throw Error('Invalid profile dsh.profile section');
    const bundles = profile.bundles;
    if (bundles === undefined)
        return [];
    if (!Array.isArray(bundles) || bundles.some(name => typeof name !== 'string' || name === '')) {
        throw Error('Invalid profile dsh.profile.bundles');
    }
    return [...bundles];
}
function setProfileBundles(manifest, bundles) {
    const dsh = manifest.dsh === undefined || manifest.dsh === null || typeof manifest.dsh !== 'object'
        || Array.isArray(manifest.dsh) ? {} : { ...manifest.dsh };
    const profile = dsh.profile === undefined || dsh.profile === null || typeof dsh.profile !== 'object'
        || Array.isArray(dsh.profile) ? {} : { ...dsh.profile };
    profile.bundles = bundles;
    dsh.profile = profile;
    manifest.dsh = dsh;
}
/** The same inventory gate protects a runtime bundle and its later durable copy. */
export function verifyProtectedPackage(root, record) {
    normalizedFiles(record.files);
    const actual = inventory(root);
    const expected = record.files.map(file => file.path).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw Error('Protected package file inventory differs: ' + record.name);
    for (const file of record.files) {
        if (digest(fs.readFileSync(contained(root, file.path))) !== file.sha256)
            throw Error('Protected package hash differs: ' + record.name + '/' + file.path);
    }
    const metadata = JSON.parse(fs.readFileSync(contained(root, 'package.json'), 'utf8'));
    if (metadata.name !== record.name || metadata.version !== record.version)
        throw Error('Protected package identity differs from receipt');
}
export function readPreparedProfile(home, profile) {
    try {
        const root = fs.realpathSync(home);
        const receipt = JSON.parse(fs.readFileSync(contained(root, `profiles/${profile}/${receiptName}`), 'utf8'));
        if (receipt?.schemaVersion !== 1 || receipt.profile !== profile
            || receipt.state !== 'references-prepared' || !Array.isArray(receipt.packages)
            || !Array.isArray(receipt.clientClaims)
            || receipt.clientClaims.some(name => typeof name !== 'string'))
            return null;
        const recorded = new Map();
        for (const item of receipt.packages) {
            const record = recordFor(root, profile, item);
            if (recorded.has(record.name))
                return null;
            recorded.set(record.name, { ...record, generation: generationOf(record, record.files) });
        }
        return { references: recorded, clientClaims: [...receipt.clientClaims] };
    }
    catch {
        return null;
    }
}
/**
 * Whether one profile still carries exactly these durable references.
 *
 * The structural half of the locked transaction's own admission, for a caller
 * that must decide whether that transaction is needed: the profile's own
 * `dependencies` name every recorded reference and no other dependency map
 * claims one of those names, no pnpm override shadows them, and each generation
 * directory still holds the identity and the file set its name promises, and
 * the patch layer still claims every client-only package the receipt recorded.
 * No member's bytes are read here - only the locked transaction verifies those
 * and only it may write - so a mismatch means "run the round", never "repair".
 */
export function durableReferencesIntact(home, profile, references, clientClaims) {
    try {
        const root = fs.realpathSync(home);
        const manifest = JSON.parse(fs.readFileSync(contained(root, `profiles/${profile}/package.json`), 'utf8'));
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
            return false;
        const dependencies = dependencyMap(manifest.dependencies, 'dependencies');
        const others = ['devDependencies', 'optionalDependencies', 'peerDependencies']
            .map(field => dependencyMap(manifest[field], field));
        const roster = new Set(profileBundles(manifest));
        const names = new Set();
        for (const reference of references) {
            if (dependencies[reference.name] !== reference.reference)
                return false;
            if (others.some(map => Object.hasOwn(map, reference.name)))
                return false;
            names.add(reference.name);
            // An owned bundle is only composed when the roster still lists it, so a
            // profile that dropped the name needs the locked transaction, not a
            // fast path that would leave its activation layer silently missing.
            if (reference.bundle === true && !roster.has(reference.name))
                return false;
            const directory = contained(root, reference.directory);
            const metadata = JSON.parse(fs.readFileSync(contained(directory, 'package.json'), 'utf8'));
            if (metadata?.name !== reference.name || metadata.version !== reference.version)
                return false;
            if (reference.bundle === true
                && (typeof metadata.dsh?.bundle?.patch !== 'string' || metadata.dsh.bundle.patch === ''))
                return false;
            if (JSON.stringify(inventory(directory)) !== JSON.stringify(reference.files.map(file => file.path).sort())) {
                return false;
            }
        }
        assertNoResolutionOverride(manifest, names);
        if (clientClaims.length) {
            const layer = contained(root, `profiles/${profile}/${patchLayerName}`);
            const text = fs.existsSync(layer) ? fs.readFileSync(layer, 'utf8') : '';
            // A layer that cannot take the block has nothing left for the round to
            // do; every other layer still has to name every claimed row, because the
            // next manager startup is what composes a second Loader source without.
            if (clientClaimRefusal(text) === null
                && clientClaims.some(name => !patchLayerMentions(text, name)))
                return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
function dependencyMap(value, field) {
    if (value === undefined)
        return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.values(value).some(item => typeof item !== 'string'))
        throw Error('Invalid profile ' + field);
    return { ...value };
}
function assertNoResolutionOverride(manifest, names) {
    if (manifest.pnpm === undefined)
        return;
    const pnpm = manifest.pnpm;
    if (!pnpm || typeof pnpm !== 'object' || Array.isArray(pnpm))
        throw Error('Invalid profile pnpm configuration');
    for (const field of ['overrides', 'patchedDependencies']) {
        const entries = pnpm[field];
        if (entries === undefined)
            continue;
        if (!entries || typeof entries !== 'object' || Array.isArray(entries))
            throw Error('Invalid profile pnpm.' + field);
        for (const selector of Object.keys(entries)) {
            for (const name of names) {
                if (new RegExp('(^|>)\\s*' + name + '(?:@|\\s*$)').test(selector)) {
                    throw Error('Protected package conflicts with pnpm.' + field + ': ' + selector);
                }
            }
        }
    }
}
/**
 * Plan one metadata transaction. Source inventories come from release assembly,
 * not from a fresh trust-on-first-use hash of an installed upstream package.
 * No existing generation is edited or deleted, including on downgrade/remove.
 */
export function planProtectedPackages(options) {
    const home = fs.realpathSync(options.home);
    const { profile } = options;
    if (!/^[a-zA-Z0-9_-]+$/.test(profile))
        throw Error('Invalid profile name');
    // A caller that admitted these exact generations against these exact trees
    // while holding the same writer lock has already paid for the read; asking
    // for it twice per preparation is what a product-sized bundle cannot afford.
    const admitted = new Map((options.verifiedSources ?? []).map(entry => [entry.generation, entry.source]));
    const manifestPath = `profiles/${profile}/package.json`;
    const receiptPath = `profiles/${profile}/${receiptName}`;
    const manifestBytes = fs.readFileSync(contained(home, manifestPath));
    const manifest = JSON.parse(manifestBytes.toString());
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
        throw Error('Invalid profile manifest');
    const dependencies = dependencyMap(manifest.dependencies, 'dependencies');
    const otherDependencies = ['devDependencies', 'optionalDependencies', 'peerDependencies'].map(field => dependencyMap(manifest[field], field));
    const receiptFile = contained(home, receiptPath);
    const receiptBytes = fs.existsSync(receiptFile) ? fs.readFileSync(receiptFile) : null;
    let previous = [];
    if (receiptBytes) {
        const prior = JSON.parse(receiptBytes.toString());
        if (prior.schemaVersion !== 1 || prior.profile !== profile || prior.state !== 'references-prepared' || !Array.isArray(prior.packages)) {
            throw Error('Unsupported protected package receipt');
        }
        const seen = new Set();
        previous = prior.packages.map(item => {
            const canonical = recordFor(home, profile, item);
            if (seen.has(item.name) || canonical.directory !== item.directory || canonical.reference !== item.reference) {
                throw Error('Invalid protected package ownership receipt');
            }
            seen.add(item.name);
            if (dependencies[item.name] !== item.reference || otherDependencies.some(map => Object.hasOwn(map, item.name))) {
                throw Error('Protected profile reference changed: ' + item.name);
            }
            verifyProtectedPackage(contained(home, item.directory), canonical);
            if (canonical.bundle === true)
                assertBundleActivationLayer(contained(home, item.directory), item.name);
            return canonical;
        });
    }
    const previousNames = new Set(previous.map(item => item.name));
    assertNoResolutionOverride(manifest, new Set([...previousNames, ...options.packages.map(item => item.name)]));
    const nextNames = new Set();
    const changes = [];
    const reused = new Map(previous.map(record => [record.directory, record]));
    const emptyGenerations = [];
    const next = options.packages.map(input => {
        const record = recordFor(home, profile, input, input.source);
        if (nextNames.has(record.name))
            throw Error('Duplicate protected package: ' + record.name);
        nextNames.add(record.name);
        if (otherDependencies.some(map => Object.hasOwn(map, record.name))
            || (Object.hasOwn(dependencies, record.name) && !previousNames.has(record.name))) {
            throw Error('Existing profile dependency is not owned by this installer: ' + record.name);
        }
        const source = fs.realpathSync(input.source);
        if (admitted.get(generationOf(record, record.files)) !== source)
            verifyProtectedPackage(source, record);
        const target = contained(home, record.directory);
        const existing = fs.existsSync(target) ? inventory(target) : [];
        if (existing.length) {
            verifyProtectedPackage(target, record);
            reused.set(record.directory, record);
        }
        else {
            emptyGenerations.push(record.directory);
            // File-level rollback deliberately retains directories. An empty failed
            // generation can be retried; any nonempty unknown generation must verify.
            for (const file of record.files) {
                const bytes = fs.readFileSync(contained(source, file.path));
                // The input can change between audit and capture. Only the exact
                // release bytes may enter the transactional write set.
                if (digest(bytes) !== file.sha256)
                    throw Error('Protected source changed during planning');
                changes.push({ path: record.directory + '/' + file.path, before: null, bytes });
            }
        }
        dependencies[record.name] = record.reference;
        return record;
    }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const record of previous)
        if (!nextNames.has(record.name))
            delete dependencies[record.name];
    manifest.dependencies = dependencies;
    // The installer owns the activation layer of the bundles it ships: a name
    // the profile lost is restored, and a name it no longer ships is dropped.
    // Every entry a person or another installer added keeps its own position.
    const ownedBundles = next.filter(record => record.bundle === true).map(record => record.name);
    const previouslyOwned = new Set(previous.filter(record => record.bundle === true).map(record => record.name));
    const roster = profileBundles(manifest);
    const merged = roster.filter(name => !previouslyOwned.has(name) || ownedBundles.includes(name));
    for (const name of ownedBundles)
        if (!merged.includes(name))
            merged.push(name);
    if (JSON.stringify(merged) !== JSON.stringify(roster))
        setProfileBundles(manifest, merged);
    // The product's own Loader rows for its client-only packages are part of the
    // profile's durable state, so the same round that pins the bytes also claims
    // them in the profile's patch layer. Nothing here edits or removes what the
    // layer already holds, and a layer that cannot take the block is reported
    // instead of being rewritten.
    const clientClaims = options.packages.filter(input => input.client === true)
        .map(input => input.name).sort();
    const claim = clientClaims.length ? planClientClaim(home, profile, clientClaims) : null;
    const receipt = { schemaVersion: 1, state: 'references-prepared', profile, packages: next, clientClaims };
    const updates = [
        { path: manifestPath, before: digest(manifestBytes), bytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') },
        { path: receiptPath, before: receiptBytes ? digest(receiptBytes) : null, bytes: Buffer.from(JSON.stringify(receipt, null, 2) + '\n') },
    ];
    if (claim?.update)
        updates.push(claim.update);
    changes.push(...updates.filter(file => digest(file.bytes) !== file.before));
    const assertUnchanged = () => {
        // Reused generations are read-only dependencies, not transactional writes.
        // Verify them and every metadata preimage again after acquiring the lock.
        for (const record of reused.values())
            verifyProtectedPackage(contained(home, record.directory), record);
        for (const directory of emptyGenerations) {
            const target = contained(home, directory);
            if (fs.existsSync(target) && inventory(target).length)
                throw Error('Protected generation changed since planning: ' + directory);
        }
        for (const update of updates) {
            const target = contained(home, update.path);
            const current = fs.existsSync(target) ? digest(fs.readFileSync(target)) : null;
            if (current !== update.before)
                throw Error('Protected metadata changed since planning: ' + update.path);
        }
    };
    const claimState = { names: clientClaims, state: 'none' };
    if (claim?.update)
        claimState.state = 'declared';
    else if (claim?.detail !== undefined) {
        claimState.state = 'refused';
        claimState.detail = claim.detail;
    }
    else if (claim)
        claimState.state = 'current';
    return { home, profile, changes, receipt, assertUnchanged, requiresRelink: true, clientClaims: claimState };
}
/** Explicit crash recovery before replanning; a live home owner is never stopped. */
export function recoverProtectedPackages(home) {
    return recoverInterruptedTransaction(home, transactionPurpose);
}
/**
 * This is the preparation boundary, not an installation-success signal.
 * The caller must relink and verify the package-manager graph before activation;
 * graph rollback after pnpm mutations is a separate caller-owned transaction.
 */
export function prepareProtectedPackages(options) {
    if (fs.existsSync(contained(options.home, '.nexttavern-transaction.lock'))) {
        throw Error('Pending home transaction; run recoverProtectedPackages before preparing references');
    }
    const plan = planProtectedPackages(options);
    const transaction = plan.changes.length ? applyTransaction({ root: plan.home, backup: options.backup,
        files: plan.changes, purpose: transactionPurpose, assertUnchanged: plan.assertUnchanged }) : null;
    return { state: 'references-prepared', requiresRelink: true, receipt: plan.receipt,
        clientClaims: plan.clientClaims, transaction };
}
