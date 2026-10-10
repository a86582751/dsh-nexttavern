// Generated from runtime/alpha3/src/core/tavern-author-combined-compiler-v6.mts; edit the TypeScript source.
/** The actual server compiler owns schema/loader disposition. Browser3 proves
 * all remaining Native effects and mounts from complete captured Source. */
import { recordSha256 } from './roleplay-data.js';
import { projectAuthorScriptResourcesV3 } from './tavern-author-browser-source-projection-v3.mjs';
import { validateCombinedAuthorProgramV6, combinedCompilationInputForProgramV6, captureCompiledCombinedAuthorProgramV6 } from './tavern-author-combined-data-v6.mjs';
export function createCombinedAuthorCompilerV6(deps) {
    const browser = deps.browser;
    const identity = Object.freeze({ id: 'native-author-combined-compiler', version: 1, hostProtocol: 5,
        implementationSha256: recordSha256({ implementationSha256: deps.implementationSha256,
            server: deps.server.identity, browser: { compiler: browser.identity, runtime: browser.runtime },
            prompt: { compiler: deps.prompt.identity, runtime: deps.prompt.runtime } }) });
    const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
    const compile = async (input, signal, capturedResources) => {
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        if (input.schemaVersion !== 6 || input.encoding !== 'native-author-combined-compilation-input-v6')
            return refused('COMBINED_COMPILER_INPUT_VERSION');
        // The actual server owner validates/captures the complete original once;
        // all consumers reuse its immutable input after code disposition settles.
        const server = await deps.server.partitionCandidates(input.original, signal);
        if (server.kind === 'refused')
            return server.diagnostics[0]?.code === 'MVU_SCHEMA_COMPILER_INPUT_INVALID'
                ? refused('COMBINED_ORIGINAL_INPUT_INVALID') : server;
        const original = server.original;
        const { material: _material, ...source } = original.source;
        const locator = { ...source, sourceRecordSessionId: input.sourceRecordSessionId };
        const scripts = original.scripts.map((descriptor, ordinal) => ({ ordinal, descriptor }));
        // This one worker returns accepted server code as well as its original
        // ordinals. A rejected Browser2 script is never a server ownership proof.
        const serverIndices = new Map(server.serverOrdinals.map((ordinal, index) => [ordinal, index]));
        const remainingServer = scripts.filter(row => !serverIndices.has(row.ordinal));
        let promptProgram = null;
        let promptOrdinals;
        try {
            const candidates = await deps.prompt.compileCandidates({ schemaVersion: 1,
                encoding: 'native-author-prompt-compilation-input-v1', source: locator, scripts: remainingServer }, signal);
            promptOrdinals = candidates.rows.filter(row => row.kind === 'compiled' && row.descriptor.enabled).map(row => row.ordinal);
            if (promptOrdinals.length) {
                const result = deps.prompt.assembleAccepted(candidates, promptOrdinals);
                if (result.kind === 'refused')
                    return result;
                promptProgram = result.program;
            }
        }
        catch {
            return refused(signal?.aborted ? 'COMBINED_COMPILER_CANCELLED' : 'COMBINED_PROMPT_COMPILATION_FAILED');
        }
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        const promptIndices = new Map(promptOrdinals.map((ordinal, index) => [ordinal, index]));
        const remaining = remainingServer.filter(row => !promptIndices.has(row.ordinal));
        let browserProgram = null;
        if (remaining.length) {
            const pins = remaining.map(({ ordinal, descriptor }) => ({ originalOrdinal: ordinal, identity: descriptor.identity,
                pointer: descriptor.pointer, rawDescriptorSha256: recordSha256(descriptor) }));
            let sourceResources;
            try {
                sourceResources = projectAuthorScriptResourcesV3((capturedResources ?? deps.resources)(original.source, pins), pins);
            }
            catch {
                return refused('COMBINED_SOURCE_RESOURCES_UNAVAILABLE');
            }
            const sourcePages = [];
            for (const caller of sourceResources.callers) {
                const raw = original.scripts[caller.originalOrdinal], data = caller.data;
                if (raw.enabled && data !== null && typeof data === 'object' && !Array.isArray(data) && typeof data.html === 'string') {
                    sourcePages.push({ schemaVersion: 1, encoding: 'source-html-compile-input-v1', source: locator,
                        carrier: { originalOrdinal: caller.originalOrdinal, identity: raw.identity, pointer: raw.pointer,
                            descriptorSha256: recordSha256(raw) }, resourcePath: ['data', 'html'], html: data.html });
                }
            }
            const result = await browser.compile({ schemaVersion: 3, encoding: 'native-author-browser-compilation-input-v3', source: locator,
                scripts: remaining, sourcePages, sourceResources }, signal);
            if (result.kind === 'refused')
                return result;
            browserProgram = result.program;
        }
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        const browserIndices = new Map(browserProgram?.scripts.map((script, index) => [script.ordinal, index]) ?? []);
        const serverProgram = server.serverProgram;
        const rows = scripts.map(({ descriptor, ordinal }) => {
            const base = { originalOrdinal: ordinal, identity: descriptor.identity, pointer: descriptor.pointer,
                enabled: descriptor.enabled, sourceSha256: descriptor.sourceSha256, rawDescriptorSha256: recordSha256(descriptor) };
            const promptIndex = promptIndices.get(ordinal);
            if (promptIndex !== undefined)
                return { ...base, disposition: 'prompt', promptIndex };
            const browserIndex = browserIndices.get(ordinal);
            if (browserIndex !== undefined)
                return { ...base, browserIndex, disposition: descriptor.enabled ? 'browser' : 'disabled-source-retained' };
            const serverIndex = serverIndices.get(ordinal), plan = serverProgram.executionPlan.scripts[serverIndex];
            return { ...base, serverIndex, disposition: 'server',
                classification: plan.classification };
        });
        const planBody = { schemaVersion: 3, encoding: 'native-author-complete-execution-plan-v3',
            authority: 'compiled-program-data-only', scripts: rows,
            summary: { enabledServerSchema: serverProgram?.executionPlan.summary.enabledServerSchema ?? 0,
                enabledNativeLoaders: serverProgram?.executionPlan.summary.enabledNativeLoaders ?? 0,
                enabledBrowser: rows.filter(row => row.disposition === 'browser').length,
                disabled: rows.filter(row => row.disposition === 'disabled-source-retained').length, enabledPrompt: promptOrdinals.length } };
        const executionPlan = { ...planBody, executionPlanSha256: recordSha256(planBody) };
        const body = { schemaVersion: 6, encoding: 'native-author-combined-program-v6',
            authority: 'compiled-program-data-only', compiler: identity, original,
            sourceRecordSessionId: input.sourceRecordSessionId, executionPlan, serverProgram, browserProgram, promptProgram };
        try {
            const program = captureCompiledCombinedAuthorProgramV6({ ...body, combinedProgramSha256: recordSha256(body) });
            return { kind: 'compiled', program };
        }
        catch {
            return refused('COMBINED6_PROGRAM_DATA_LIMIT');
        }
    };
    return { identity, compile, async verifyProgram(program, signal, resources) {
            if (program.schemaVersion !== 6)
                return false;
            try {
                const checked = validateCombinedAuthorProgramV6(program);
                const fresh = await compile(combinedCompilationInputForProgramV6(checked), signal, resources);
                return fresh.kind === 'compiled' && recordSha256(fresh.program) === recordSha256(checked);
            }
            catch {
                return false;
            }
        } };
}
