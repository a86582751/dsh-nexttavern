// Generated from runtime/alpha3/src/operations/install-public.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { digest, contained, applyTransaction, rollbackTransaction } from './public-transaction.mjs';
const options = {}, args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('install --package PACKAGE_ROOT --home DSH_HOME --harness HARNESS_ROOT [--profile web] [--documents] [--apply --stopped --backup NEW_DIR] [--uninstall] | --rollback BACKUP --stopped\nDefault: audit. Existing user presets or edited managed files are never overwritten. Does not install dependencies, configure providers, apply Harness patches, or restart services.');
    process.exit(0);
}
for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (['apply', 'stopped', 'documents', 'uninstall'].includes(key))
        options[key] = true;
    else if (['package', 'home', 'harness', 'profile', 'backup', 'rollback'].includes(key))
        options[key] = args[++i];
    else
        throw Error('Unknown option: ' + args[i]);
}
if (options.rollback) {
    if (!options.stopped)
        throw Error('Stop the instance before rollback');
    console.log(JSON.stringify(rollbackTransaction(options.rollback), null, 2));
    process.exit(0);
}
if (!options.home || !options.harness)
    throw Error('Explicit --home and --harness are required');
// Both the maintained and published implementation live at lib/operations;
// legacy tools/install.mjs imports this single implementation without a second root.
const packageRoot = fs.realpathSync(options.package ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const home = path.resolve(options.home), harness = fs.realpathSync(options.harness);
const profile = options.profile ?? 'web';
if (!/^[a-zA-Z0-9_-]+$/.test(profile))
    throw Error('Invalid profile name');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(packageRoot, 'provenance.json'), 'utf8'));
if (pkg.name !== 'dsh-nexttavern' || receipt.schemaVersion !== 1)
    throw Error('Not a supported NextTavern package');
for (const file of receipt.files)
    if (digest(fs.readFileSync(contained(packageRoot, file.path))) !== file.sha256)
        throw Error('Package integrity mismatch: ' + file.path);
const stampPath = '.nexttavern-install.json';
const stampFile = contained(home, stampPath);
const prior = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf8')) : null;
if (prior && (prior.schemaVersion !== 1 || !Array.isArray(prior.files)))
    throw Error('Unsupported install record');
if (prior && prior.profile !== profile)
    throw Error('Existing installation belongs to another profile; uninstall that profile first');
const currentHash = (relative) => { const file = contained(home, relative); return fs.existsSync(file) ? digest(fs.readFileSync(file)) : null; };
for (const file of prior?.files ?? [])
    if (currentHash(file.path) !== file.sha256)
        throw Error('Managed file was edited; preserve or reconcile it before proceeding: ' + file.path);
const managed = new Map((prior?.files ?? []).map(file => [file.path, file.sha256]));
const files = [];
const profilePath = 'profiles/' + profile + '/package.json';
const profileFile = contained(home, profilePath);
if (!fs.existsSync(profileFile))
    throw Error('Initialize this Harness profile before installing NextTavern');
const profilePackage = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
if (!Array.isArray(profilePackage.dsh?.profile?.bundles))
    throw Error('Unsupported Harness profile metadata');
if (!options.uninstall) {
    const resolveTools = (base) => fs.realpathSync(createRequire(path.join(base, 'package.json')).resolve('@deepseek-ai/dsh-tools/package.json'));
    if (resolveTools(path.dirname(profileFile)) !== resolveTools(harness))
        throw Error('Profile must reuse the Harness dsh-tools instance; install its local directory dependency as documented');
}
if (options.uninstall) {
    for (const [relative, before] of managed)
        files.push({ path: relative, before, bytes: null });
    if (prior)
        files.push({ path: stampPath, before: currentHash(stampPath), bytes: null });
}
else {
    const require = createRequire(path.join(packageRoot, 'package.json'));
    const YAML = require('yaml');
    const destination = path.join(home, '.agent-presets/roleplay').replaceAll('\\', '/');
    const modulePath = (name) => {
        for (const base of [packageRoot, path.join(home, 'profiles', profile), harness]) {
            const resolver = createRequire(path.join(base, 'package.json'));
            try {
                return resolver.resolve(name).replaceAll('\\', '/');
            }
            catch (error) {
                if (error.code !== 'MODULE_NOT_FOUND')
                    throw error;
            }
        }
        throw Error('Document integration dependency is not installed: ' + name);
    };
    for (const member of receipt.files.filter(file => file.path.startsWith('preset/'))) {
        const relative = '.agent-presets/roleplay/' + member.path.slice('preset/'.length);
        const before = currentHash(relative);
        if (before !== null && !managed.has(relative))
            throw Error('Existing roleplay preset conflicts with install: ' + relative);
        let bytes = fs.readFileSync(contained(packageRoot, member.path));
        if (/\.(md|yml)$/.test(member.path))
            bytes = Buffer.from(bytes.toString().replaceAll('__NEXTTAVERN_PRESET__', destination));
        if (member.path.endsWith('/agent.cordis.yml')) {
            const doc = YAML.parseDocument(bytes.toString(), { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] });
            const index = doc.contents.items.findIndex(node => node.get('id') === 'anydoc');
            // Only the canonical root preset must declare the document integration.
            // Catalog overlays re-assert package composition and carry no dependency
            // rows of their own, so they are installed unchanged.
            if (index < 0) {
                if (member.path === 'preset/agent.cordis.yml')
                    throw Error('Missing document integration definition');
            }
            else {
                if (!options.documents)
                    doc.contents.items.splice(index, 1);
                else
                    doc.contents.items[index].set('name', modulePath('dsh-nexttavern-anydoc'));
                bytes = Buffer.from(doc.toString());
            }
        }
        files.push({ path: relative, before, bytes });
    }
    const nextPaths = new Set(files.map(file => file.path));
    for (const [relative, before] of managed)
        if (!nextPaths.has(relative))
            files.push({ path: relative, before, bytes: null });
    const next = { schemaVersion: 1, version: pkg.version, profile, documents: !!options.documents, files: files.filter(file => file.bytes !== null).map(file => ({ path: file.path, sha256: digest(file.bytes) })) };
    files.push({ path: stampPath, before: currentHash(stampPath), bytes: Buffer.from(JSON.stringify(next, null, 2) + '\n') });
}
const bundles = profilePackage.dsh.profile.bundles;
if (options.uninstall)
    profilePackage.dsh.profile.bundles = bundles.filter(name => name !== pkg.name);
else if (!bundles.includes(pkg.name))
    bundles.push(pkg.name);
files.push({ path: profilePath, before: currentHash(profilePath), bytes: Buffer.from(JSON.stringify(profilePackage, null, 2) + '\n') });
const changes = files.filter(file => file.before !== (file.bytes === null ? null : digest(file.bytes)));
let transaction = null;
if (options.apply && changes.length) {
    if (!options.stopped || !options.backup)
        throw Error('Apply requires --stopped and a new --backup directory');
    fs.mkdirSync(home, { recursive: true });
    transaction = applyTransaction({ root: home, backup: options.backup, files: changes, purpose: options.uninstall ? 'uninstall-preset' : 'install-preset' });
}
console.log(JSON.stringify({ schemaVersion: 1, mode: options.uninstall ? 'uninstall' : 'install', applied: !!options.apply, changes: changes.map(file => ({ path: file.path, before: file.before, after: file.bytes === null ? null : digest(file.bytes) })), transaction, modelRequests: 0, serviceRestarted: false }, null, 2));
