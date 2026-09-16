// Generated from runtime/alpha3/ui/build-client.mts; edit the TypeScript source.
import { createRequire } from 'node:module';
import { resolve, dirname, basename } from 'node:path';
import { writeFileSync } from 'node:fs';
const require = createRequire(new URL('../build-tools/package.json', import.meta.url));
const { build } = require('esbuild');
const [entry, outfile, moduleId = 'dsh-roleplay-ui'] = process.argv.slice(2);
if (!entry || !outfile)
    throw new Error('usage: node build-client.mjs <entry> <outfile>');
const result = await build({
    metafile: true,
    absWorkingDir: dirname(resolve(entry)),
    entryPoints: [basename(entry)],
    outfile: resolve(outfile),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    external: ['react', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
    banner: {
        js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(moduleId)}, factory: function (require) { var module = { exports: {} }; var exports = module.exports;`,
    },
    footer: {
        js: 'return module.exports; } });',
    },
    logLevel: 'info',
});
writeFileSync(resolve(outfile) + '.meta.json', JSON.stringify(result.metafile, null, 2) + '\n');
