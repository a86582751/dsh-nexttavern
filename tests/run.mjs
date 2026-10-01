// Thin public compatibility entry. Selection, prerequisites, caching and
// capability reporting belong to the package's quality-cli registry.
// The old filename substring filter is retired; use `tests [--portable]` or
// an explicit quality-cli command instead.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cliArgs = args.length ? (args[0].startsWith('-') ? ['tests', ...args] : args) : ['tests'];
const result = spawnSync(process.execPath, [path.join(root, 'lib/operations/quality-cli.mjs'), ...cliArgs], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
