// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-assets.ts; edit the TypeScript source.
/** Resolve the schema engine from this admitted product, never a profile,
 * build-tools, card path or optional dependency discovered on the host. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const packageName = 'dsh-nexttavern-mvu-schema-runtime';
const packageVersion = '0.3.0';
const sameDirectory = (left, right) => left.protocol === 'file:'
    && fs.realpathSync(fileURLToPath(left)) === right;
function productRoot() {
    // Root lib/core and preset/lib/core are the two registered delivery layouts.
    // Standalone historical presets and maintenance build-tools are unsupported.
    for (const relative of ['../../', '../../../']) {
        const root = fs.realpathSync(fileURLToPath(new URL(relative, import.meta.url)));
        const metadata = path.join(root, 'package.json');
        if (!fs.existsSync(metadata))
            continue;
        const value = JSON.parse(fs.readFileSync(metadata, 'utf8'));
        if (value.name === 'dsh-nexttavern' && value.dependencies?.[packageName] === packageVersion)
            return root;
    }
    throw Error('SCHEMA_RUNTIME_PRODUCT_OWNER_UNAVAILABLE');
}
/** Core owns this lazy lifecycle. Revocation during loading disposes the
 * actual factory instead of allowing a delayed import to recreate it. */
export function createRoleplayMvuSchemaAssetOwner() {
    let closed = false;
    let runtime;
    let verify;
    async function load() {
        const root = productRoot(), require = createRequire(path.join(root, 'package.json'));
        const metadataPath = fs.realpathSync(require.resolve(packageName + '/package.json'));
        const owned = fs.realpathSync(path.join(root, 'node_modules', packageName));
        if (metadataPath !== path.join(owned, 'package.json'))
            throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
        const entry = fs.realpathSync(require.resolve(packageName));
        const relative = path.relative(owned, entry);
        if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
            throw Error('SCHEMA_RUNTIME_ENTRY_OWNER_CHANGED');
        }
        const bootstrap = await import(pathToFileURL(path.join(root, 'lib/operations/bundled-package-bootstrap.mjs')).href);
        const protection = await import(pathToFileURL(path.join(root, 'lib/operations/protected-packages.mjs')).href);
        verify = () => {
            const identity = bootstrap.readBundleIdentity(root);
            const specs = identity.packages.filter(spec => spec.name === packageName);
            if (identity.productRoot !== root || specs.length !== 1 || specs[0].version !== packageVersion
                || fs.realpathSync(require.resolve(packageName + '/package.json')) !== metadataPath
                || fs.realpathSync(path.join(root, 'node_modules', packageName)) !== owned) {
                throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED');
            }
            const spec = specs[0];
            protection.verifyProtectedPackage(owned, spec);
            return { name: packageName, version: packageVersion, files: structuredClone(spec.files), generation: spec.generation };
        };
        verify();
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const module = await import(pathToFileURL(entry).href);
        if (closed)
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        const loaded = await module.createMvuSchemaRuntime({ verifyOwnedPackage: fixed => {
                if (!sameDirectory(fixed, owned))
                    throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED');
                return verify();
            } });
        if (closed) {
            await loaded.dispose();
            throw Error('SCHEMA_RUNTIME_DISPOSED');
        }
        return loaded;
    }
    return {
        async get() {
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            // Failed admission is not memoized as usable. A correction still needs
            // this actual product inventory; no host fallback is tried.
            runtime ??= load().catch(error => { runtime = undefined; throw error; });
            const actual = await runtime;
            if (closed)
                throw Error('SCHEMA_RUNTIME_DISPOSED');
            verify();
            return actual;
        },
        async dispose() {
            closed = true;
            const active = runtime;
            if (active)
                try {
                    await (await active).dispose();
                }
                catch { /* Loading already refused or revoked. */ }
        },
    };
}
