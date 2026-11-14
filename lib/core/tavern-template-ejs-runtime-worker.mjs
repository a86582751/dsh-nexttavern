// Generated from runtime/alpha3/src/core/tavern-template-ejs-runtime-worker.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createReplayableTavernEjsHost, restoreReplayableTavernEjsHost } from './tavern-template-ejs-replay.mjs';
// One module instance serves isolated runtimes/contexts. The actor processes
// each command synchronously, preserving every resident's live closure cells.
const root = new URL('../', import.meta.url), require = createRequire(new URL('package.json', root));
const compiler = require('./node_modules/ejs/lib/ejs.js');
const core = await import(__rewriteRelativeImportExtension(new URL('node_modules/quickjs-emscripten-core/dist/index.mjs', root).href));
const variant = await import(__rewriteRelativeImportExtension(new URL('node_modules/@jitl/quickjs-wasmfile-release-sync/dist/index.mjs', root).href));
const quickjs = await core.newQuickJSWASMModuleFromVariant(variant.default);
const start = workerData, dependencies = { quickjs, compiler,
    // Trusted dependency bytes are read once per actor; each isolated VM loads
    // them only when an executable preset helper needs its real merge semantics.
    lodashGuestSource: readFileSync(require.resolve('nexttavern-mvu-lodash/lodash.min.js'), 'utf8') };
const programs = new Map();
const post = (reply) => parentPort.postMessage(reply);
parentPort.on('message', (command) => {
    let session = programs.get(command.programId);
    const response = { id: command.id, programId: command.programId };
    try {
        if (command.kind === 'prepare' || command.kind === 'restore') {
            session = command.kind === 'prepare'
                ? createReplayableTavernEjsHost(dependencies, start.identity, command.input.capture, command.input.resource, command.input.consumer)
                : restoreReplayableTavernEjsHost(dependencies, start.identity, command.record);
            programs.set(command.programId, session);
            post({ ...response, kind: 'created', creation: session.prepare() });
        }
        else if (command.kind === 'dispose') {
            session?.dispose();
            programs.delete(command.programId);
            post({ ...response, kind: 'disposed' });
        }
        else {
            if (!session)
                throw Error('TEMPLATE_EJS_PROGRAM_RETIRED');
            if (command.kind === 'checkpoint')
                post({ ...response, kind: 'checkpoint', record: session.record() });
            else {
                const result = session.invoke(command.operationId, command.action, command.capture);
                post({ ...response, kind: 'invoked', output: { result, delta: session.delta(command.operationId) } });
            }
        }
    }
    catch (error) {
        session?.dispose();
        programs.delete(command.programId);
        post({ ...response, kind: 'failed', code: error instanceof Error ? error.message : 'TEMPLATE_EJS_WORKER_FAILED' });
    }
});
parentPort.on('close', () => { for (const session of programs.values())
    session.dispose(); programs.clear(); });
post({ id: 0, kind: 'ready' });
