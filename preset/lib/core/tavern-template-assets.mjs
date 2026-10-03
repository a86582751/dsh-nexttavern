// Generated from runtime/alpha3/src/core/tavern-template-assets.mts; edit the TypeScript source.
/** One independently admitted package tree owns every executed dependency.
 * No template input, profile path or optional Host worker can select it. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { recordSha256 } from './roleplay-data.js';
import { TEMPLATE_PACKAGE_NAME, TEMPLATE_PACKAGE_VERSION, TEMPLATE_DESCRIPTOR_PATH, TEMPLATE_DEPENDENCY_PINS, TEMPLATE_MODULES, TEMPLATE_DESCRIPTOR_PROPOSAL_V1, templateAssetPath, templateAssetSha, normalizeTemplateInventoryV1, templateEngineIdentityV1 } from './tavern-template-descriptor.mjs';
import { templateFail, templateObject, cloneTemplateEnvelopeV1 } from './tavern-template-data.mjs';
function regularFiles(root) {
    const files = [];
    let visited = 0;
    const walk = (directory, depth) => {
        if (depth > 64)
            templateFail('TEMPLATE_PACKAGE_TREE_LIMIT');
        for (const row of fs.readdirSync(directory, { withFileTypes: true })) {
            if (++visited > 16384)
                templateFail('TEMPLATE_PACKAGE_TREE_LIMIT');
            const full = path.join(directory, row.name);
            const actual = fs.lstatSync(full);
            if (row.isSymbolicLink() || actual.isSymbolicLink())
                templateFail('TEMPLATE_PACKAGE_SYMLINK');
            if (row.isDirectory() && actual.isDirectory())
                walk(full, depth + 1);
            else if (row.isFile() && actual.isFile())
                files.push(path.relative(root, full).replaceAll('\\', '/'));
            else
                templateFail('TEMPLATE_PACKAGE_SPECIAL_FILE');
        }
    };
    walk(root, 0);
    return files.sort();
}
const inside = (root, relative) => {
    if (!templateAssetPath(relative))
        templateFail('TEMPLATE_ASSET_PATH');
    // The union keeps generic contained()'s per-member component link check.
    // Never reuse a directory lstat from enumeration or another member read.
    let current = root;
    for (const part of relative.split('/')) {
        current = path.join(current, part);
        if (fs.lstatSync(current).isSymbolicLink())
            templateFail('TEMPLATE_PACKAGE_SYMLINK');
    }
    const full = path.join(root, ...relative.split('/'));
    const resolved = path.relative(root, fs.realpathSync(full));
    if (path.isAbsolute(resolved) || resolved === '..' || resolved.startsWith('..' + path.sep)) {
        templateFail('TEMPLATE_ASSET_OUTSIDE_PACKAGE');
    }
    return full;
};
function dependencyGraph(root, readJsonMember) {
    const require = createRequire(path.join(root, 'package.json'));
    const roots = [];
    for (const row of fs.readdirSync(path.join(root, 'node_modules'), { withFileTypes: true })) {
        if (!row.isDirectory())
            templateFail('TEMPLATE_DEPENDENCY_SET');
        if (row.name.startsWith('@')) {
            for (const child of fs.readdirSync(path.join(root, 'node_modules', row.name), { withFileTypes: true })) {
                if (!child.isDirectory())
                    templateFail('TEMPLATE_DEPENDENCY_SET');
                roots.push(`${row.name}/${child.name}`);
            }
        }
        else
            roots.push(row.name);
    }
    if (JSON.stringify(roots.sort()) !== JSON.stringify(Object.keys(TEMPLATE_DEPENDENCY_PINS).sort())) {
        templateFail('TEMPLATE_DEPENDENCY_SET');
    }
    for (const [name, version] of Object.entries(TEMPLATE_DEPENDENCY_PINS)) {
        const packageRoot = inside(root, `node_modules/${name}`);
        const metadata = readJsonMember(`node_modules/${name}/package.json`);
        if (metadata.name !== name || metadata.version !== version)
            templateFail('TEMPLATE_DEPENDENCY_PIN');
        const entry = fs.realpathSync(require.resolve(name)), owned = fs.realpathSync(packageRoot);
        if (!entry.startsWith(owned + path.sep))
            templateFail('TEMPLATE_DEPENDENCY_RESOLUTION');
    }
    for (const owner of ['quickjs-emscripten-core', '@jitl/quickjs-wasmfile-release-sync']) {
        const require = createRequire(inside(root, `node_modules/${owner}/package.json`));
        const ffi = fs.realpathSync(require.resolve('@jitl/quickjs-ffi-types'));
        if (!ffi.startsWith(fs.realpathSync(inside(root, 'node_modules/@jitl/quickjs-ffi-types')) + path.sep)) {
            templateFail('TEMPLATE_FFI_RESOLUTION');
        }
    }
    const metadata = readJsonMember('package.json');
    if (metadata.name !== TEMPLATE_PACKAGE_NAME || metadata.version !== TEMPLATE_PACKAGE_VERSION || metadata.type !== 'module'
        || metadata.main !== './' + TEMPLATE_MODULES.provider
        || recordSha256(metadata.dependencies) !== recordSha256(TEMPLATE_DEPENDENCY_PINS)
        || !Array.isArray(metadata.bundleDependencies)
        || JSON.stringify([...metadata.bundleDependencies].sort()) !== JSON.stringify(Object.keys(TEMPLATE_DEPENDENCY_PINS).sort())
        || recordSha256(metadata.exports) !== recordSha256({ '.': './dist/index.mjs', './package.json': './package.json' })) {
        templateFail('TEMPLATE_PACKAGE_METADATA');
    }
    const descriptor = readJsonMember(TEMPLATE_DESCRIPTOR_PATH);
    if (recordSha256(descriptor) !== recordSha256(TEMPLATE_DESCRIPTOR_PROPOSAL_V1))
        templateFail('TEMPLATE_DESCRIPTOR_INVALID');
}
/** One fresh runtime-owned filesystem observation satisfies both package gates.
 * The inventory is expected data, never a callback approval or byte witness.
 * Initial product verification before importing this code remains mandatory.
 * This deliberately replaces the old pair of independent scans: metadata below
 * consumes this same pass's actual bytes, never a prior verification's bytes. */
export function verifyTemplateOwnedTreeV1(ownRootURL, raw) {
    if (ownRootURL.protocol !== 'file:')
        templateFail('TEMPLATE_PACKAGE_ROOT');
    const root = fs.realpathSync(fileURLToPath(ownRootURL));
    const inventory = normalizeTemplateInventoryV1(cloneTemplateEnvelopeV1(raw, { bytes: 'inventoryBytes', nodes: 'inventoryNodes', depth: 'inventoryDepth' }));
    // Exact portable-path/case-alias predicates from protected normalizedFiles.
    // normalizeTemplateInventory already checks case aliases, path syntax/hash,
    // required package metadata and the canonical name/version/file generation.
    for (const file of inventory.files)
        if (file.path.split('/').some(part => /[<>:"\\|?*\u0000-\u001f]|[. ]$/.test(part)
            || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
            templateFail('TEMPLATE_INVENTORY_INVALID');
        }
    const all = regularFiles(root);
    if (JSON.stringify(all) !== JSON.stringify(inventory.files.map(row => row.path)))
        templateFail('TEMPLATE_PACKAGE_FILE_SET');
    const jsonPaths = new Set(['package.json', TEMPLATE_DESCRIPTOR_PATH,
        ...Object.keys(TEMPLATE_DEPENDENCY_PINS).map(name => `node_modules/${name}/package.json`)]), actualJson = new Map();
    for (const file of inventory.files) {
        const bytes = fs.readFileSync(inside(root, file.path));
        if (templateAssetSha(bytes) !== file.sha256)
            templateFail('TEMPLATE_PACKAGE_BYTE_IDENTITY');
        if (jsonPaths.has(file.path))
            actualJson.set(file.path, bytes);
    }
    const parsedJson = new Map();
    const readJsonMember = (relative) => {
        if (parsedJson.has(relative))
            return parsedJson.get(relative);
        const bytes = actualJson.get(relative);
        if (!bytes)
            templateFail('TEMPLATE_INVENTORY_INCOMPLETE');
        const value = JSON.parse(bytes.toString('utf8'));
        parsedJson.set(relative, value);
        return value;
    };
    // Keep the generic identity predicate before template dependency predicates,
    // using this pass's already read package.json bytes rather than rereading it.
    const metadata = readJsonMember('package.json');
    if (metadata.name !== inventory.name || metadata.version !== inventory.version)
        templateFail('TEMPLATE_PACKAGE_METADATA');
    dependencyGraph(root, readJsonMember);
    return { root, inventory, engine: templateEngineIdentityV1(inventory) };
}
export function templateFactoryDeps(value) {
    if (!templateObject(value) || Object.keys(value).length !== 1 || typeof value.verifyOwnedPackage !== 'function') {
        templateFail('TEMPLATE_FACTORY_DEPS');
    }
}
