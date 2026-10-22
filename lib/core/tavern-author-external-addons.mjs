// Generated from runtime/alpha3/src/core/tavern-author-external-addons.mts; edit the TypeScript source.
/** Known author declarations whose external runtime is not implemented here.
 * Recognition records an explicit unavailable disposition, never execution. */
export const EXTERNAL_ADDON_CATALOG_V1 = Object.freeze([
    Object.freeze({ id: 'zhino-script', version: '5.2.0',
        specifier: 'https://cdn.jsdelivr.net/gh/sillytavner-jpg/zhino-script@v5.2.0/dist/index.js' }),
]);
export const EXTERNAL_ADDON_RUNTIME_UNAVAILABLE = 'EXTERNAL_ADDON_RUNTIME_UNAVAILABLE';
// This complete grammar admits only the researched declaration. A binding,
// unknown version or any following author statement stays with its compiler.
const zhinoDeclaration = /^\s*import\s*(['"])https:\/\/cdn\.jsdelivr\.net\/gh\/sillytavner-jpg\/zhino-script@v5\.2\.0\/dist\/index\.js\1\s*;?\s*$/u;
export function identifyUnavailableExternalAddonV1(script) {
    return script.enabled && zhinoDeclaration.test(script.source) ? EXTERNAL_ADDON_CATALOG_V1[0] : undefined;
}
