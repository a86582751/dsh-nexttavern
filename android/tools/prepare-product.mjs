// Generated from android/tools/prepare-product.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Assemble an Android product from the public checkout and its pinned inputs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const toolRoot = path.resolve(import.meta.dirname, '../..');
const operations = fs.existsSync(path.join(toolRoot, 'release/source-manifest.json'))
    ? path.join(toolRoot, 'runtime/alpha3/lib/operations') : path.join(toolRoot, 'lib/operations');
const { assembleProduct } = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(operations, 'product-assembly.mjs')).href));
const { admitPublicVendorFile } = await import(__rewriteRelativeImportExtension(pathToFileURL(path.join(operations, 'public-vendor-admission.mjs')).href));
export function prepareProduct(options) {
    const repo = fs.realpathSync(options.repo), output = path.resolve(options.output);
    const map = JSON.parse(fs.readFileSync(path.join(repo, 'tools/build-map.json'), 'utf8'));
    const plan = structuredClone(map.compilerPlan);
    plan.product.bundleTarget = { platform: 'android', arch: options.abi };
    plan.product.bundlePlatforms = ['android-' + options.abi];
    const metadata = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
    // The caller supplies an empty candidate, never an installed user profile.
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(output);
    const roots = new Set([...metadata.files.filter(file => file !== 'node_modules' && file !== 'nexttavern.dependencies.json'),
        'package.json', 'LICENSE', ...(plan.product.bundles ?? []).map(bundle => plan.publicRelease.layoutPaths[bundle.layout])]);
    for (const relative of roots) {
        if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..') || /[*?]/.test(relative)) {
            throw Error('Unsupported product file declaration: ' + relative);
        }
        const target = path.join(output, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.cpSync(path.join(repo, relative), target, { recursive: true, errorOnExist: true, force: false });
    }
    const inventory = assembleProduct({ repo, plan, packageRoot: output, archives: options.archives,
        libraryRoot: options.libraryRoot ?? path.join(repo, 'build-tools/node_modules'),
        includeDevelopmentCopies: false, admitVendoredFile: admitPublicVendorFile });
    return { output, abi: options.abi, productVersion: inventory.productVersion,
        packages: inventory.packages.length, hostForks: inventory.hostForks.length, bundles: inventory.bundles.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = new Map();
    for (let i = 2; i < process.argv.length; i += 2)
        args.set(process.argv[i], process.argv[i + 1] ?? '');
    const required = (name) => { const value = args.get('--' + name); if (!value)
        throw Error('Missing --' + name); return value; };
    const abi = required('abi');
    if (abi !== 'arm64' && abi !== 'x64')
        throw Error('Use --abi arm64 or x64');
    console.log(JSON.stringify(prepareProduct({ repo: required('repo'), output: required('out'), abi,
        archives: { 'pi-ai': required('pi-ai-archive') }, ...(args.get('--library-root') ? { libraryRoot: args.get('--library-root') } : {}) })));
}
