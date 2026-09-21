// Regenerates the JavaScript this package ships from the TypeScript it also
// ships, so a change to a `.ts` file can be completed here instead of only in
// the maintainer's tree.
//
//   npm run build:modules          # write every generated file
//   npm run check -- task generated # fail if any generated file is stale
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
const typesOnly = process.argv.includes('--types');
const map = JSON.parse(fs.readFileSync(path.join(root, 'tools/build-map.json'), 'utf8'));

if (map.schemaVersion !== 2) throw Error('Unsupported source/build map version');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'build-tools/package-lock.json'), 'utf8'));
if (ts.version !== lock.packages['node_modules/typescript']?.version) throw Error('TypeScript differs from lockfile');
const configFile = path.join(root, 'build-tools/tsconfig.json');
const config = ts.readConfigFile(configFile, ts.sys.readFile);
const converted = ts.convertCompilerOptionsFromJson(config.config?.compilerOptions ?? {}, path.dirname(configFile));
const options = converted.options;
if (!options.strict || !options.noUncheckedIndexedAccess || !options.noEmitOnError) throw Error('Strict compiler options are required');
const sourcePaths = new Set(map.modules.map(module => path.resolve(root, module.source)));
const outputs = new Set(map.modules.flatMap(module => module.outputs));
const allowedOutputs = new Set([...outputs, ...map.bundles]);
function safe(file) {
  if (!file || file.includes('\\') || file.includes(':') || file.startsWith('/')
      || file.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe build mapping: ' + file);
  return path.join(root, file);
}
for (const module of map.modules) {
  safe(module.source);
  for (const output of module.outputs) safe(output);
}
if (sourcePaths.size !== map.modules.length
    || outputs.size !== map.modules.flatMap(module => module.outputs).length) throw Error('Duplicate source/output mapping');
for (const bundle of map.bundles) {
  safe(bundle);
  if (check && !typesOnly && !fs.existsSync(safe(bundle))) throw Error('Missing registered browser bundle: ' + bundle);
}
const program = ts.createProgram([...sourcePaths], options);
const diagnostics = [...(config.error ? [config.error] : []), ...converted.errors, ...ts.getPreEmitDiagnostics(program)];
for (const source of program.getSourceFiles()) {
  if (program.isSourceFileDefaultLibrary(source) || source.fileName.replaceAll('\\', '/').includes('/node_modules/')) continue;
  if (!sourcePaths.has(path.resolve(source.fileName))) throw Error('Unmapped public TypeScript dependency: ' + source.fileName);
}
const compiled = new Map();
if (!diagnostics.length) {
  const result = program.emit(undefined, (_file, text, _bom, _error, sources) => {
    if (!sources || sources.length !== 1) throw Error('Ambiguous compiler output');
    compiled.set(path.resolve(sources[0].fileName), text.replaceAll('\r\n', '\n'));
  });
  diagnostics.push(...result.diagnostics);
}
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n'
}));
if (typesOnly) {
  console.log('strict project types=ok (' + map.modules.length + ' modules; no writes)');
  process.exit(0);
}

// Both directions are checked: every mapping has a source/output, and no extra
// source or generated module may hide outside the contributor build map.
function tree(file, name) {
  const parts = file.split('/'), index = parts.lastIndexOf(name);
  if (index < 0) throw Error('Expected ' + name + '/ in mapped path: ' + file);
  return parts.slice(0, index + 1).join('/');
}
function inspect(directory, sourceTree) {
  if (!fs.existsSync(safe(directory))) return;
  for (const item of fs.readdirSync(safe(directory), {withFileTypes: true})) {
    const file = directory + '/' + item.name;
    if (item.isSymbolicLink()) throw Error('Unexpected link in generated tree: ' + file);
    if (item.isDirectory()) { inspect(file, sourceTree); continue; }
    if (/\.(?:ts|mts)$/.test(file) && (!sourceTree || !sourcePaths.has(path.resolve(root, file)))) throw Error('Unmapped TypeScript source: ' + file);
    if (/\.(?:js|mjs|cjs)$/.test(file) && (sourceTree || !allowedOutputs.has(file))) throw Error('Unmapped generated module: ' + file);
  }
}
for (const directory of new Set(map.modules.map(module => tree(module.source, 'src')))) inspect(directory, true);
for (const directory of new Set([...allowedOutputs].map(file => tree(file, 'lib')))) inspect(directory, false);

/** The release build stamps every generated file with the source it came from. */
const compile = module => {
  const source = path.join(root, module.source);
  if (!fs.existsSync(source)) throw Error('tools/build-map.json names a missing source: ' + module.source);
  const emitted = compiled.get(path.resolve(source));
  if (emitted === undefined) throw Error('Missing compiler output: ' + module.source);
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
for (const entry of map.compatibilityEntrypoints ?? []) {
  const module = map.modules.find(module => module.artifact === entry.artifact);
  if (!module?.primaryOutput) throw Error('Compatibility entry has no canonical module: ' + entry.path);
  const file = safe(entry.path);
  let relative = path.posix.relative(path.posix.dirname(entry.path), module.primaryOutput);
  if (!relative.startsWith('.')) relative = './' + relative;
  const code = entry.invoke
    ? `import { ${entry.invoke} } from ${JSON.stringify(relative)};\n${entry.invoke}();\n`
    : `import ${JSON.stringify(relative)};\n`;
  const expected = '// Generated legacy CLI compatibility entry; implementation lives in lib/.\n' + code;
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') : null;
  if (current === expected) continue;
  if (check) { stale += 1; console.log('stale compatibility entry: ' + entry.path); }
  else { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, expected); written += 1; }
}
if (stale) {
  console.log('\n' + stale + ' generated file(s) do not match their TypeScript source.');
  console.log('Run `npm run build:modules` and commit the result, or edit the TypeScript instead of the JavaScript.');
  process.exit(1);
}
console.log(check ? 'generated modules match their sources (' + map.modules.length + ' modules)' : 'wrote ' + written + ' file(s)');
