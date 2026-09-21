import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createTestDirectory, cleanupTestDirectory} from '../lib/operations/test-temp.mjs';
import {changedFiles} from '../lib/operations/quality-context.mjs';
import {makePlan} from '../lib/operations/quality-plan.mjs';
import {executePlan} from '../lib/operations/quality-run.mjs';
import {runProcess, capabilityProblem} from '../lib/operations/quality-process.mjs';
import {executeTask} from '../lib/operations/quality-actions.mjs';

const root = createTestDirectory('quality-runner-');
const write = (file, text = 'export {};\n') => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, text);
};
for (const file of ['src/core/cards.ts', 'src/core/status.ts', 'tests/cards.test.mjs', 'tests/status.test.mjs']) write(file);

const request = (command, targets = [], extra = {}) => ({command, targets, plan: false, force: false, portable: false, ...extra});
const task = (id, modules, extra = {}) => ({id, action: 'test', artifact: id + '-file', modules, ...extra});
const registry = {
  schemaVersion: 1,
  modules: [
    {id: 'cards', aliases: ['写卡'], patterns: ['cards']},
    {id: 'status', aliases: ['状态栏'], patterns: ['status']},
  ],
  tasks: [
    task('shared', ['cards']),
    task('cards:unit', ['cards'], {depends: ['shared']}),
    task('cards:integration', ['cards'], {depends: ['shared']}),
    task('status:unit', ['status']),
    task('needs-capability', [], {requires: ['fixture-capability']}),
    task('fails', []),
    task('independent', []),
    task('dependent', [], {depends: ['fails']}),
    task('windows-contract', []),
    {id: 'generated', action: 'generated', modules: []},
    {id: 'bundle', action: 'bundle', modules: []},
    {id: 'archive', action: 'archive', modules: [], heavy: true},
    {id: 'install', action: 'install', modules: [], heavy: true, depends: ['archive']},
    {id: 'installer:windows', action: 'installer', modules: [], heavy: true, depends: ['archive', 'windows-contract']},
    {id: 'candidate', action: 'candidate', modules: [], heavy: true},
    {id: 'harness', action: 'harness', modules: [], heavy: true},
  ],
};
const artifacts = [
  ['cards-source', 'src/core/cards.ts'], ['status-source', 'src/core/status.ts'],
  ['shared-file', 'tests/cards.test.mjs'], ['cards:unit-file', 'tests/cards.test.mjs'],
  ['cards:integration-file', 'tests/cards.test.mjs'], ['status:unit-file', 'tests/status.test.mjs'],
  ['needs-capability-file', 'tests/status.test.mjs'], ['fails-file', 'tests/status.test.mjs'],
  ['independent-file', 'tests/status.test.mjs'], ['dependent-file', 'tests/status.test.mjs'],
  ['windows-contract-file', 'tests/status.test.mjs'],
].map(([id, source]) => ({id, source}));
const context = {
  root, audience: 'public', registry,
  mapping: {artifacts, builds: [], typeScript: {config: 'tsconfig.json', checker: 'tools/check.mjs', declarationPackages: []}},
  artifactPaths: new Map(artifacts.map(item => [item.id, item.source])),
  stateDirectory: path.join(root, 'artifacts/checks'),
};
const ids = plan => plan.tasks.map(item => item.id);
const passed = {status: 0, timedOut: false, interrupted: false};

try {
  // A changed source selects only its feature's lightweight tests and one shared
  // prerequisite. Heavy candidate, installer and Harness actions cannot leak in.
  const filePlan = makePlan(context, request('file', ['src/core/cards.ts']));
  assert.deepEqual(ids(filePlan), ['shared', 'cards:unit', 'cards:integration']);
  assert.equal(filePlan.tasks.some(item => item.heavy), false);
  assert.equal(filePlan.tasks.some(item => ['candidate', 'harness'].includes(item.id)), false);

  const chinesePlan = makePlan(context, request('module', ['写卡']));
  assert.deepEqual(ids(chinesePlan), ids(filePlan), 'Chinese aliases select the same feature graph');
  assert.equal(ids(chinesePlan).filter(id => id === 'shared').length, 1, 'shared prerequisites run once');

  const unknown = makePlan(context, request('file', ['src/core/unmapped.ts']));
  assert.equal(unknown.tasks.length, 0);
  assert.match(unknown.uncovered[0], /not registered/);
  const uncovered = await executePlan(context, unknown, {execute: async () => passed});
  assert.equal(uncovered.status, 'uncovered', 'an unmapped file cannot report success');

  const missingCapability = makePlan(context, request('task', ['needs-capability']));
  const unsupported = await executePlan(context, missingCapability, {
    capability: (_context, selected) => selected.id === 'needs-capability' ? 'fixture capability unavailable' : null,
    execute: async () => { throw Error('unsupported task must not execute'); },
  });
  assert.equal(unsupported.status, 'failed');
  assert.deepEqual(unsupported.results.map(result => result.status), ['unsupported']);
  assert.match(capabilityProblem(context, {id: 'unknown-capability', requires: ['unknown-capability']}), /Unknown/);

  const mixed = makePlan(context, request('task', ['fails', 'independent', 'dependent']));
  const mixedRun = await executePlan(context, mixed, {execute: async (_context, _plan, selected) =>
    selected.id === 'fails' ? {...passed, status: 1} : passed});
  assert.deepEqual(mixedRun.results.map(result => [result.id, result.status]), [
    ['fails', 'failed'], ['independent', 'passed'], ['dependent', 'blocked'],
  ], 'a failed prerequisite blocks only its dependent task');
  const mixedPassed = await executePlan(context, mixed, {previous: mixedRun, execute: async () => passed});
  registry.tasks.find(task => task.id === 'fails').args = ['changed-prerequisite-command'];
  const dependencyChanged = await executePlan(context, makePlan(context, mixed.request), {
    previous: mixedPassed, execute: async () => passed,
  });
  assert.deepEqual(dependencyChanged.results.map(result => result.status), ['passed', 'reused', 'passed'],
    'changed prerequisite command invalidates its dependent, not independent tests');

  let temporaries = [];
  const first = await executePlan(context, chinesePlan, {execute: async (_context, _plan, selected, options) => {
    temporaries.push(options.temporary);
    return selected.id === 'cards:integration' ? {...passed, status: 1} : passed;
  }});
  assert.equal(first.status, 'failed');
  assert.deepEqual(first.results.map(result => result.status), ['passed', 'passed', 'failed']);
  assert(temporaries.every(directory => !fs.existsSync(directory)), 'runner removes only its own temporary directory after failure');

  temporaries = [];
  const resumed = await executePlan(context, chinesePlan, {previous: first, execute: async (_context, _plan, _selected, options) => {
    temporaries.push(options.temporary);
    return passed;
  }});
  assert.deepEqual(resumed.results.map(result => result.status), ['reused', 'reused', 'passed'], 'resume reruns only the failed item');
  assert(temporaries.every(directory => !fs.existsSync(directory)), 'runner cleans its own resume temporary directory');

  write('docs/unrelated.md', '# unrelated\n');
  const docsChanged = await executePlan(context, chinesePlan, {previous: resumed, execute: async () => {
    throw Error('an unrelated document must not invalidate feature results');
  }});
  assert.deepEqual(docsChanged.results.map(result => result.status), ['reused', 'reused', 'reused']);
  write('src/core/cards.ts', 'export const changed = true;\n');
  const inputChanged = await executePlan(context, chinesePlan, {previous: docsChanged, execute: async () => passed});
  assert.deepEqual(inputChanged.results.map(result => result.status), ['passed', 'passed', 'passed'], 'feature input changes invalidate only its cached tasks');

  const timeoutPlan = makePlan(context, request('task', ['independent'], {force: true}));
  const timeout = await executePlan(context, timeoutPlan, {execute: async () => ({status: 1, timedOut: true, interrupted: false})});
  assert.deepEqual(timeout.results.map(result => result.status), ['timed-out']);
  assert.equal(timeout.status, 'failed');
  const childTimeout = await runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    cwd: root, env: process.env, timeoutMs: 100, signal: new AbortController().signal,
  });
  assert.equal(childTimeout.timedOut, true, 'real timed-out child exits');
  assert.notEqual(childTimeout.status, 0);
  const childController = new AbortController();
  const abortTimer = setTimeout(() => childController.abort(), 100);
  try {
    const childAbort = await runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      cwd: root, env: process.env, timeoutMs: 3000, signal: childController.signal,
    });
    assert.equal(childAbort.interrupted, true, 'real interrupted child exits');
  } finally {clearTimeout(abortTimer);}

  const controller = new AbortController();
  const interruptedPlan = makePlan(context, request('task', ['shared', 'cards:unit'], {force: true}));
  const interrupted = await executePlan(context, interruptedPlan, {signal: controller.signal, execute: async (_context, _plan, _task, options) => {
    controller.abort();
    return {...passed, interrupted: options.signal.aborted};
  }});
  assert.equal(interrupted.status, 'interrupted');
  assert.deepEqual(interrupted.results.map(result => result.id), ['shared'], 'interrupt stops before unrelated remaining work');

  const maintenance = {...context, audience: 'maintenance'};
  const release = makePlan(maintenance, request('release', [], {bundle: 'candidate'}));
  assert(release.tasks.some(item => item.id === 'archive'));
  assert(release.tasks.some(item => item.id === 'install'));
  assert.equal(release.tasks.some(item => ['candidate', 'installer:windows', 'harness'].includes(item.id)), false,
    'offline release consumes a candidate and does not build installers or start Harness');
  const installer = makePlan(maintenance, request('installer', ['windows'], {bundle: 'candidate', output: 'installer-output'}));
  assert.deepEqual(ids(installer), ['archive', 'windows-contract', 'installer:windows']);
  assert.equal(installer.tasks.some(item => ['candidate', 'harness'].includes(item.id)), false,
    'an installer consumes only the named candidate');

  // Drive the real action adapter against tiny command recorders. This proves
  // argv/call-count boundaries without rebuilding a second real release.
  const deliveryScripts = ['build-public-from-pins', 'verify-release', 'verify-install', 'build-linux-setup'];
  const deliveryArtifacts = deliveryScripts.map(id => ({id, source: 'release/' + id + '.mjs'}));
  for (const item of deliveryArtifacts) write(item.source,
    "import fs from 'node:fs'; import path from 'node:path'; fs.appendFileSync(path.join(import.meta.dirname,'../calls.log'), JSON.stringify({script:path.basename(import.meta.filename),args:process.argv.slice(2)})+'\\n');\n");
  const deliveryContext = {...maintenance, mapping: {...context.mapping, artifacts: [...artifacts, ...deliveryArtifacts]},
    artifactPaths: new Map([...context.artifactPaths, ...deliveryArtifacts.map(item => [item.id, item.source])])};
  const deliveryPlan = {...installer, request: {...installer.request, inputs: 'inputs'}};
  for (const action of ['candidate', 'archive', 'install', 'installer']) {
    const result = await executeTask(deliveryContext, deliveryPlan, {id: action === 'installer' ? 'installer:linux' : action, action, modules: []},
      {temporary: root, signal: new AbortController().signal});
    assert.equal(result.status, 0);
  }
  const calls = fs.readFileSync(path.join(root, 'calls.log'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map(call => call.script), deliveryScripts.map(id => id + '.mjs'));
  assert(calls[0].args.includes('--skip-installers'));
  for (const call of calls.slice(1)) assert(call.args.includes(path.join(root, 'candidate')));
  assert.equal(calls[3].args[0], path.join(root, 'installer-output'), 'Linux builder uses its documented positional output');
  assert(!calls.some(call => call.script.includes('harness')));

  // A second maintained browser output must not hide behind the first one.
  // Explicit artifact selection should still avoid rebuilding unrelated clients.
  write('bundle-builder.mjs', [
    "import fs from 'node:fs';",
    'const [entry, output] = process.argv.slice(2);',
    "fs.appendFileSync('bundle-calls.log', entry + '\\n');",
    'fs.copyFileSync(entry, output);',
  ].join('\n'));
  const browserArtifacts = ['first', 'second'].map(id => ({id, source: id + '-expected.js'}));
  const browserBuilds = browserArtifacts.map(({id}) => ({
    id, artifact: id, entry: id + '-entry.js', builder: 'bundle-builder.mjs', inputs: [],
  }));
  for (const {id} of browserArtifacts) {
    write(id + '-entry.js', id);
    write(id + '-expected.js', id);
  }
  const browserContext = {...context, audience: 'maintenance',
    mapping: {...context.mapping, artifacts: browserArtifacts, builds: browserBuilds},
    artifactPaths: new Map(browserArtifacts.map(item => [item.id, item.source])),
  };
  const browserTask = {id: 'bundle', action: 'bundle', modules: []};
  const browserOptions = {temporary: root, signal: new AbortController().signal};
  assert.equal((await executeTask(browserContext, release, browserTask, browserOptions)).status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'bundle-calls.log'), 'utf8').trim().split('\n').length, 2);
  write('second-expected.js', 'stale');
  await assert.rejects(executeTask(browserContext, release, browserTask, browserOptions), /Stale browser bundle second/);
  assert.equal((await executeTask(browserContext, release, {...browserTask, artifact: 'first'}, browserOptions)).status, 0);

  // The fixture is nested in this repository's Git worktree. Its public context
  // must refuse to borrow the parent repository's changes as an archive default.
  assert.throws(() => changedFiles(context), /no own Git metadata|No Git metadata/);
  console.log('quality-runner=ok; selection, prerequisites, cache, interruption, candidate boundaries and archive guidance');
} finally {
  cleanupTestDirectory(root);
}
