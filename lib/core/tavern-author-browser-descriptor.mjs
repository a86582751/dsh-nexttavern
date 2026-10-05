// Generated from runtime/alpha3/src/core/tavern-author-browser-descriptor.mts; edit the TypeScript source.
/** One component role contract. The manifest owns source/delivery mappings;
 * these fixed package-relative roles are the factory's execution protocol. */
import { createHash } from 'node:crypto';
export const AUTHOR_BROWSER_RUNTIME_NAME = 'dsh-nexttavern-author-browser-runtime-v1';
export const AUTHOR_BROWSER_RUNTIME_VERSION = '0.1.0';
export const AUTHOR_BROWSER_RUNTIME_PINS = Object.freeze({ typescript: '5.9.3' });
export const AUTHOR_BROWSER_RUNTIME_DESCRIPTOR = 'assets/runtime.json';
export const AUTHOR_BROWSER_SOURCE_INPUTS = 'assets/source-inputs.json';
export const AUTHOR_BROWSER_MODULES = Object.freeze({ provider: 'dist/index.mjs', partition: 'dist/partition.mjs',
    'ast-worker': 'dist/browser-ast-worker.mjs', child: 'dist/browser-runtime-child.js', guard: 'dist/browser-runtime-guard.js' });
export const authorBrowserAssetSha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function authorBrowserImplementationV1(kind, modules, typescriptArtifactSha256, profileSha256) {
    return authorBrowserAssetSha(JSON.stringify({ encoding: 'native-author-browser-delivery-identity-v1', kind,
        modules, typescriptArtifactSha256, profileSha256 }));
}
