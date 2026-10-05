// Generated from runtime/alpha3/src/core/tavern-author-host-provider.mts; edit the TypeScript source.
/** Actual protected Host5 implementation. The bundled provider includes the
 * same maintained replay/journal source; no lower replay plus JSON stamp can
 * mint its evidence. Source, locks and Native callbacks stay with Core. */
import { recordSha256 } from './roleplay-data.js';
import { createCombinedAuthorCompilerV4 } from './tavern-author-combined-compiler.mjs';
import { createRoleplayMvuSchemaReplay } from './roleplay-mvu-schema-replay.js';
export const AUTHOR_HOST_NAME_V5 = 'dsh-nexttavern-author-host-runtime-v5';
export const AUTHOR_HOST_VERSION_V5 = '0.5.1';
const ownRoot = new URL('../', import.meta.url);
let loadedGeneration;
export async function createOwnedAuthorHostRuntimeV5(deps) {
    // Core verified these package bytes before import. This one callback fixes
    // the admitted generation; loaded calls never rescan its filesystem.
    const pin = deps.verifyOwnedPackage(new URL(ownRoot));
    if (pin.name !== AUTHOR_HOST_NAME_V5 || pin.version !== AUTHOR_HOST_VERSION_V5)
        throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED');
    if (loadedGeneration !== undefined && loadedGeneration !== pin.generation)
        throw Error('AUTHOR_HOST_GENERATION_RESTART_REQUIRED');
    loadedGeneration ??= pin.generation;
    if (deps.server.executorVersion !== 4)
        throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED');
    const server = Object.freeze({ compiler: deps.server.compiler.identity,
        bridge: deps.server.bridge, libraries: deps.server.libraries, stateLoader: deps.server.stateLoader,
        runner: deps.server.runner.identity });
    const actualCompiler = createCombinedAuthorCompilerV4({ server: deps.server.compiler,
        browser: deps.browser, prompt: deps.prompt.compiler, implementationSha256: pin.generation });
    const identity = Object.freeze({ id: 'native-author-host', version: 5,
        implementationSha256: recordSha256({ encoding: 'native-author-host-implementation-v5', generation: pin.generation,
            combinedCompiler: actualCompiler.identity, server, browser: { compiler: deps.browser.identity, runtime: deps.browser.runtime },
            prompt: { compiler: deps.prompt.compiler.identity, runtime: deps.prompt.runtime } }) });
    let disposed = false;
    const owners = new Set();
    const checkCurrent = () => { if (disposed)
        throw Error('AUTHOR_HOST_RUNTIME_DISPOSED'); };
    const compiler = { identity: actualCompiler.identity,
        compile(input, signal) { checkCurrent(); return actualCompiler.compile(input, signal); },
        verifyProgram(program, signal) { checkCurrent(); return actualCompiler.verifyProgram(program, signal); } };
    return Object.freeze({ identity, server, compiler, prompt: deps.prompt,
        createReplay(bindings) {
            checkCurrent();
            const replay = createRoleplayMvuSchemaReplay({ ...bindings, compiler: deps.server.compiler, runner: deps.server.runner,
                executorVersion: 4, hostV5: { identity, compiler: actualCompiler, server } });
            const dispose = replay.dispose;
            replay.dispose = () => { owners.delete(replay); dispose(); };
            owners.add(replay);
            return replay;
        }, checkCurrent,
        dispose() {
            if (disposed)
                return;
            disposed = true;
            for (const replay of owners)
                replay.dispose();
            owners.clear();
            // Core owns the injected server, Browser and Prompt component lifetimes.
        } });
}
