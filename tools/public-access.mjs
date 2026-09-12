import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditPatches} from './patch-harness.mjs';
import {applyTransaction, rollbackTransaction} from './public-transaction.mjs';

const options = {}, args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('public-access --root ROOT --group harness|profile [--patches FILE] [--apply --stopped --backup NEW_DIR] | --rollback BACKUP --stopped\nDefault: audit. Writes require DSH_ALLOW_PUBLIC_ACCESS=1. Does not open ports, configure Cloudflare, change providers, or restart services.');
  process.exit(0);
}
for (let i = 0; i < args.length; i++) {
  const key = args[i].replace(/^--/, '');
  if (['apply','stopped'].includes(key)) options[key] = true;
  else if (['root','group','patches','backup','rollback'].includes(key)) options[key] = args[++i];
  else throw Error('Unknown option: ' + args[i]);
}
if ((options.apply || options.rollback) && (!options.stopped || process.env.DSH_ALLOW_PUBLIC_ACCESS !== '1')) throw Error('Explicit --stopped and DSH_ALLOW_PUBLIC_ACCESS=1 required');
if (options.rollback) {
  console.log(JSON.stringify(rollbackTransaction(options.rollback), null, 2));
} else {
  if (!options.root || !['harness','profile'].includes(options.group)) throw Error('--root and --group harness|profile are required');
  const file = options.patches ?? fileURLToPath(new URL('./public-access.json', import.meta.url));
  const data = JSON.parse(fs.readFileSync(file));
  if (data.schemaVersion !== 1 || data.kind !== 'nexttavern-public-access' || !Array.isArray(data.patches)) throw Error('Invalid public-access manifest');
  const patches = data.patches.filter(patch => patch.group === options.group);
  if (patches.length !== (options.group === 'harness' ? 2 : 1)) throw Error('Incomplete public-access patch group');
  const audit = auditPatches({harness: options.root, patches});
  let transaction = null;
  if (options.apply && audit.files.length) {
    if (!options.backup) throw Error('A new --backup directory is required');
    transaction = applyTransaction({root: path.resolve(options.root), backup: options.backup, files: audit.files, purpose: 'public-access-' + options.group});
  }
  console.log(JSON.stringify({schemaVersion: 1, group: options.group, applied: !!options.apply, results: audit.results, transaction, modelRequests: 0, serviceRestarted: false}, null, 2));
}
