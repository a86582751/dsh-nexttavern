// Generated from runtime/alpha3/compat/mvu-schema-runtime/src/descriptor.ts; edit the TypeScript source.
/** Delivery metadata is comparison data. Only the product inventory admits it. */
import { createHash } from 'node:crypto';
export const SCHEMA_RUNTIME_NAME = 'dsh-nexttavern-mvu-schema-runtime';
export const SCHEMA_RUNTIME_VERSION = '0.3.0';
export const SCHEMA_RUNTIME_DESCRIPTOR = 'assets/runtime.json';
export const SCHEMA_RUNTIME_PINS = Object.freeze({ typescript: '5.9.3', 'quickjs-emscripten-core': '0.32.0',
    '@jitl/quickjs-wasmfile-release-sync': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0' });
export const schemaAssetSha = (data) => createHash('sha256').update(data).digest('hex');
export const schemaAssetPath = (value) => typeof value === 'string' && value.length > 0 && !value.includes('\\')
    && !value.includes(':') && !value.startsWith('/') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
/** Logical package-relative paths give copied installs the same identity. All
 * delivered implementation/guest/dependency bytes participate, including TS,
 * FFI and WASM; source-only development copies are not execution identities. */
export function schemaRuntimeImplementation(kind, files) {
    const executed = files.filter(file => file.path !== SCHEMA_RUNTIME_DESCRIPTOR && !file.path.startsWith('src/'))
        .map(file => ({ path: file.path, sha256: file.sha256 })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return schemaAssetSha(JSON.stringify({ encoding: 'native-mvu-schema-delivery-identity-v1', kind, files: executed }));
}
