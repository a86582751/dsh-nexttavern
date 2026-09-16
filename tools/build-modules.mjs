// Regenerates the JavaScript this package ships from the TypeScript it also
// ships, so a change to a `.ts` file can be completed here instead of only in
// the maintainer's tree.
//
//   npm run build:modules          # write every generated file
//   npm run check                  # fail if any generated file is stale
//
// `tools/build-map.json` names each TypeScript source and every JavaScript file
// that must equal its compiled output - the same source is installed into more
// than one location, and the package is distributed with both. The compiler and
// its options are the ones the release build used: the pinned TypeScript in
// `build-tools/`, ES2022 modules, verbatim module syntax, LF line endings.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'build-tools/package.json'));
const ts = require('typescript');
const check = !process.argv.includes('--write');
const map = JSON.parse(fs.readFileSync(path.join(root, 'tools/build-map.json'), 'utf8'));

const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  verbatimModuleSyntax: true,
  newLine: ts.NewLineKind.LineFeed
};

/** The release build stamps every generated file with the source it came from. */
const compile = module => {
  const source = path.join(root, module.source);
  if (!fs.existsSync(source)) throw Error('tools/build-map.json names a missing source: ' + module.source);
  const emitted = ts.transpileModule(fs.readFileSync(source, 'utf8'), {compilerOptions: options, fileName: path.basename(module.source)}).outputText.replaceAll('\r\n', '\n');
  const banner = '// Generated from ' + module.banner + '; edit the TypeScript source.\n';
  const shebang = emitted.startsWith('#!') ? emitted.indexOf('\n') + 1 : 0;
  return emitted.slice(0, shebang) + banner + emitted.slice(shebang);
};

let stale = 0, written = 0;
for (const module of map.modules) {
  const text = compile(module);
  for (const output of module.outputs) {
    const file = path.join(root, output);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') : null;
    if (current === text) continue;
    if (check) {
      stale += 1;
      console.log('stale: ' + output + (current === null ? ' (missing)' : ''));
    } else {
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, text);
      written += 1;
      console.log('wrote: ' + output);
    }
  }
}
if (stale) {
  console.log('\n' + stale + ' generated file(s) do not match their TypeScript source.');
  console.log('Run `npm run build:modules` and commit the result, or edit the TypeScript instead of the JavaScript.');
  process.exit(1);
}
console.log(check ? 'generated modules match their sources (' + map.modules.length + ' modules)' : 'wrote ' + written + ' file(s)');
