// Generated from runtime/alpha3/compat/client-modules/src/client/manifest.ts; edit the TypeScript source.
/**
 * Client module system: the browser peer of Node's internal ESM loader, built
 * as a lazy CJS table. The vendored cordis Loader consumes this object
 * through its `internal` contract (the only call site is `EntryTree.import` →
 * `internal.import`), which keeps entry governance (fiber lifecycle, inject
 * waiting, update/refresh) entirely on the vendored side while this package
 * owns code arrival.
 *
 * Lazy CJS model: executing a plugin bundle only REGISTERS its
 * factory (`window.__ModuleLoader__.load({id, factory})`); every module body
 * side effect — including CSS injection — lives inside the factory closure
 * and runs at materialization, not at script execution. Materialization
 * (factory(require) → exports) happens on first import/require and is
 * memoized in {@link ClientModuleLoader.loadCache}; a factory that requires
 * another registered-but-unmaterialized module materializes it recursively,
 * so load order needs no external sequencing.
 *
 * Resolution branch order (import): seed word → shell instance; memoized
 * record → exports; graph row → register its dependency factories and own
 * factory; registered factory → materialize; anything else → throw (loud —
 * the runtime mirror of the build-time bundle purity gate).
 * The synchronous `require` handed to factories walks the same order minus
 * the load branch. Loading is async, so a requested dynamic package must have
 * registered its factory before a consumer materializes.
 *
 * This file is the browser-safe contract face (zero node imports): the
 * `__DSH_BOOT__` wire types, the boot-manifest parser, and the boundaries around
 * {@link ClientModuleSystem}. The package root is the host-side service that
 * composes the wire.
 */
/**
 * Validate an optional string-array field read from a `dsh.client` declaration
 * or from the boot wire.
 * @param subject - diagnostic prefix naming the package or the wire row.
 * @param field - field name as it appears in the diagnostic.
 * @param value - the raw field value.
 * @returns the validated array, or undefined when the field is absent.
 * @throws {Error} when the value is present but is not an array of strings.
 */
export function optionalStringArray(subject, field, value) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error(`client-modules: ${subject} ${field} must be a string array`);
    }
    return value;
}
/**
 * Narrow an unknown parsed JSON value to the `dsh.client` declaration. Shared
 * by the node half's Loader scan and the roster generator, so both read a
 * package's browser declaration through one validator.
 * @param pkgName - package name used as the diagnostic prefix.
 * @param value - the raw `dsh.client` field of the package manifest.
 * @returns the validated declaration, or undefined when the field is absent.
 * @throws {Error} when the field is present but any member is malformed.
 */
export function parseDshClient(pkgName, value) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'object' || value === null) {
        throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`);
    }
    const decl = value;
    if (typeof decl.platform !== 'string') {
        throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
    }
    const inject = optionalStringArray(pkgName, 'dsh.client.inject', decl.inject);
    const external = optionalStringArray(pkgName, 'dsh.client.external', decl.external);
    if (decl.immediately !== undefined && typeof decl.immediately !== 'boolean') {
        throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`);
    }
    return {
        platform: decl.platform,
        ...(inject !== undefined ? { inject } : {}),
        ...(external !== undefined ? { external } : {}),
        ...(decl.immediately !== undefined ? { immediately: decl.immediately } : {}),
    };
}
/**
 * The bare package-root specifier `specifier` names, or undefined for a subpath, a path, or any scheme-qualified
 * specifier (`cordis:` builtins, `node:` modules, URLs).
 * @param specifier - Loader row name.
 * @returns the package name, or undefined.
 */
export function exactPackageSpecifier(specifier) {
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.length === 2 && parts.every(Boolean) ? specifier : undefined;
    }
    return specifier.length > 0 && !specifier.includes('/') && !specifier.includes(':') ? specifier : undefined;
}
/**
 * Normalize a module specifier onto the graph row that owns it: a plugin bundle
 * IS its package's client half, so `<id>/client` (the exports subpath external
 * bundles emit) and the bare package name resolve to the same exports. Both the
 * require path and graph composition normalize here, which is what lets each
 * importing package request the subpath its own code imports.
 * @param spec - module specifier as a bundle requires it or a declaration spells it.
 * @returns the specifier with a trailing `/client` removed.
 */
export function stripClientSuffix(spec) {
    return spec.endsWith('/client') ? spec.slice(0, -'/client'.length) : spec;
}
/**
 * Parse `window.__DSH_BOOT__` into the two consumer views. Wire boundary:
 * a missing or malformed graph throws (the shell shows the loud failure —
 * a page without a valid manifest cannot boot anything).
 * @param wire - the raw `window.__DSH_BOOT__` value.
 * @returns the manifest with optional plugin-view fields normalized.
 */
export function parseBootManifest(wire) {
    if (typeof wire !== 'object' || wire === null) {
        throw new Error('client-modules: window.__DSH_BOOT__ is missing or not an object');
    }
    const graph = wire;
    if (typeof graph.rev !== 'string') {
        throw new Error('client-modules: boot manifest rev must be a string');
    }
    if (!Array.isArray(graph.entries)) {
        throw new Error('client-modules: boot manifest entries must be an array');
    }
    if (!Array.isArray(graph.batches)) {
        throw new Error('client-modules: boot manifest batches must be an array');
    }
    const moduleFields = [];
    const plugins = [];
    const seenEntryIds = new Set();
    for (const value of graph.entries) {
        if (typeof value !== 'object' || value === null) {
            throw new Error('client-modules: boot manifest entry is not an object');
        }
        const row = value;
        const where = typeof row.id === 'string' ? `"${row.id}"` : JSON.stringify(row);
        if (typeof row.id !== 'string' || typeof row.url !== 'string' || typeof row.rev !== 'string') {
            throw new Error(`client-modules: boot manifest entry ${where} must carry string id/url/rev`);
        }
        if (seenEntryIds.has(row.id))
            throw new Error(`client-modules: duplicate graph entry "${row.id}"`);
        seenEntryIds.add(row.id);
        const subject = `boot manifest entry ${where}`;
        const inject = optionalStringArray(subject, 'inject', row.inject);
        const external = optionalStringArray(subject, 'external', row.external);
        if (row.immediately !== undefined && typeof row.immediately !== 'boolean') {
            throw new Error(`client-modules: boot manifest entry ${where} immediately must be a boolean`);
        }
        moduleFields.push({
            id: row.id,
            url: row.url,
            rev: row.rev,
            inject: inject === undefined ? [] : [...inject],
            external: external === undefined ? [] : [...external],
        });
        plugins.push({
            id: row.id,
            inject: inject === undefined ? [] : [...inject],
            immediately: row.immediately === true,
        });
    }
    const entryIds = new Set(moduleFields.map(row => row.id));
    const initialUrls = new Map();
    const batchUrls = new Set();
    for (const value of graph.batches) {
        if (typeof value !== 'object' || value === null) {
            throw new Error('client-modules: boot manifest batch is not an object');
        }
        const batch = value;
        const phase = batch.phase;
        if (phase !== 'bootstrap' && phase !== 'application') {
            throw new Error(`client-modules: boot manifest batch phase must be "bootstrap" or "application", received ${JSON.stringify(phase)}`);
        }
        if (typeof batch.url !== 'string' || typeof batch.rev !== 'string') {
            throw new Error(`client-modules: boot manifest ${phase} batch must carry string url/rev`);
        }
        if (batchUrls.has(batch.url)) {
            throw new Error(`client-modules: boot manifest carries duplicate batch URL ${JSON.stringify(batch.url)}`);
        }
        batchUrls.add(batch.url);
        const entries = optionalStringArray(`boot manifest ${phase} batch`, 'entries', batch.entries);
        if (entries === undefined || entries.length === 0) {
            throw new Error(`client-modules: boot manifest ${phase} batch entries must be a non-empty string array`);
        }
        for (const id of entries) {
            if (!entryIds.has(id)) {
                throw new Error(`client-modules: boot manifest ${phase} batch names unknown entry "${id}"`);
            }
            if (initialUrls.has(id)) {
                throw new Error(`client-modules: boot manifest entry "${id}" belongs to more than one batch`);
            }
            initialUrls.set(id, batch.url);
        }
    }
    const modules = moduleFields.map((row) => {
        const initialUrl = initialUrls.get(row.id);
        if (initialUrl === undefined) {
            throw new Error(`client-modules: boot manifest entry "${row.id}" belongs to no initial-load batch`);
        }
        return { ...row, initialUrl };
    });
    return { rev: graph.rev, modules, plugins };
}
