// Generated from runtime/alpha3/src/core/tavern-author-combined-compiler.mts; edit the TypeScript source.
/** Pure compilation over admitted implementations. Source currentness, Native
 * publication and Browser activation remain with the actual live Core owner. */
import { recordSha256 } from './roleplay-data.js';
import { validateSchemaCompilationInputV4 } from './tavern-mvu-schema-program-v4.js';
import { validateCombinedAuthorProgramV3, validateCombinedAuthorProgramV4, combinedCompilationInputForProgram } from './tavern-author-combined-data.mjs';
export function createCombinedAuthorCompilerV3(deps) {
    // The owned package factory supplies its admitted implementation bytes.
    // These compilation identities are DATA; they do not mint a live lease.
    const identity = Object.freeze({ id: 'native-author-combined-compiler', version: 1, hostProtocol: 5,
        implementationSha256: recordSha256({ implementationSha256: deps.implementationSha256,
            server: deps.server.identity, browser: deps.browser.identity }) });
    const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
    async function compile(input, signal) {
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        let original;
        try {
            original = validateSchemaCompilationInputV4(input.original);
        }
        catch {
            return refused('COMBINED_ORIGINAL_INPUT_INVALID');
        }
        const { material: _material, ...source } = original.source;
        const locator = { ...source, sourceRecordSessionId: input.sourceRecordSessionId };
        const partition = await deps.browser.partition({ schemaVersion: 1,
            encoding: 'native-author-browser-compilation-input-v1', source: locator,
            scripts: original.scripts.map((descriptor, ordinal) => ({ ordinal, descriptor })) }, signal);
        if (partition.kind === 'refused')
            return partition;
        const browserProgram = partition.browserProgram;
        const serverRows = partition.serverOrdinals.map(ordinal => ({ ordinal, descriptor: original.scripts[ordinal] }));
        const browserIndices = new Map(browserProgram?.scripts.map((script, index) => [script.ordinal, index]) ?? []);
        const serverIndices = new Map(serverRows.map((row, index) => [row.ordinal, index]));
        let serverProgram = null;
        if (serverRows.length) {
            // Native indices are contiguous in the real compiler4 subset. Plan2
            // retains the original ordinals and proves the complete association.
            const server = await deps.server.compile({ ...original,
                scripts: serverRows.map(row => row.descriptor), executionPlan: null }, signal);
            if (server.kind === 'refused')
                return server;
            serverProgram = server.program;
        }
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        const rows = original.scripts.map((descriptor, ordinal) => {
            const base = { originalOrdinal: ordinal, identity: descriptor.identity, pointer: descriptor.pointer,
                enabled: descriptor.enabled, sourceSha256: descriptor.sourceSha256, rawDescriptorSha256: recordSha256(descriptor) };
            const browserIndex = browserIndices.get(ordinal);
            if (browserIndex !== undefined) {
                return { ...base, browserIndex, disposition: descriptor.enabled ? 'browser' : 'disabled-source-retained' };
            }
            const serverIndex = serverIndices.get(ordinal), plan = serverProgram.executionPlan.scripts[serverIndex];
            return { ...base, serverIndex, disposition: 'server',
                classification: plan.classification };
        });
        const planBody = { schemaVersion: 2, encoding: 'native-author-complete-execution-plan-v2',
            authority: 'compiled-program-data-only', scripts: rows,
            summary: { enabledServerSchema: serverProgram?.executionPlan.summary.enabledServerSchema ?? 0,
                enabledNativeLoaders: serverProgram?.executionPlan.summary.enabledNativeLoaders ?? 0,
                enabledBrowser: rows.filter(row => row.disposition === 'browser').length,
                disabled: rows.filter(row => row.disposition === 'disabled-source-retained').length } };
        const executionPlan = { ...planBody, executionPlanSha256: recordSha256(planBody) };
        const body = { schemaVersion: 3, encoding: 'native-author-combined-program-v3',
            authority: 'compiled-program-data-only', compiler: identity, original,
            sourceRecordSessionId: input.sourceRecordSessionId, executionPlan, serverProgram, browserProgram };
        return { kind: 'compiled', program: { ...body, combinedProgramSha256: recordSha256(body) } };
    }
    return { identity, compile,
        async verifyProgram(program, signal) {
            try {
                program = validateCombinedAuthorProgramV3(program);
                const fresh = await compile({ schemaVersion: 3, encoding: 'native-author-combined-compilation-input-v3',
                    original: program.original, sourceRecordSessionId: program.sourceRecordSessionId }, signal);
                return fresh.kind === 'compiled' && recordSha256(fresh.program) === recordSha256(program);
            }
            catch {
                return false;
            }
        } };
}
/** Prompt1 proves a complete generation registration before Browser1 and the
 * real ABI4 server consume the remaining original ordinals. Disabled Source
 * retains its existing Browser disposition and never becomes executable. */
export function createCombinedAuthorCompilerV4(deps) {
    const identity = Object.freeze({ id: 'native-author-combined-compiler', version: 1, hostProtocol: 5,
        implementationSha256: recordSha256({ implementationSha256: deps.implementationSha256,
            server: deps.server.identity, browser: deps.browser.identity, prompt: { compiler: deps.prompt.identity, runtime: deps.prompt.runtime } }) });
    const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
    async function compile(input, signal) {
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        if (input.schemaVersion !== 4 || input.encoding !== 'native-author-combined-compilation-input-v4') {
            return refused('COMBINED_COMPILER_INPUT_VERSION');
        }
        let original;
        try {
            original = validateSchemaCompilationInputV4(input.original);
        }
        catch {
            return refused('COMBINED_ORIGINAL_INPUT_INVALID');
        }
        const { material: _material, ...source } = original.source;
        const locator = { ...source, sourceRecordSessionId: input.sourceRecordSessionId };
        const scripts = original.scripts.map((descriptor, ordinal) => ({ ordinal, descriptor }));
        let promptProgram = null;
        let promptOrdinals;
        try {
            const candidates = await deps.prompt.compileCandidates({ schemaVersion: 1,
                encoding: 'native-author-prompt-compilation-input-v1', source: locator, scripts }, signal);
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
        const partition = await deps.browser.partition({ schemaVersion: 1,
            encoding: 'native-author-browser-compilation-input-v1', source: locator,
            scripts: scripts.filter(row => !promptIndices.has(row.ordinal)) }, signal);
        if (partition.kind === 'refused')
            return partition;
        const browserProgram = partition.browserProgram;
        const serverRows = partition.serverOrdinals.map(ordinal => ({ ordinal, descriptor: original.scripts[ordinal] }));
        const browserIndices = new Map(browserProgram?.scripts.map((script, index) => [script.ordinal, index]) ?? []);
        const serverIndices = new Map(serverRows.map((row, index) => [row.ordinal, index]));
        let serverProgram = null;
        if (serverRows.length) {
            const result = await deps.server.compile({ ...original, scripts: serverRows.map(row => row.descriptor), executionPlan: null }, signal);
            if (result.kind === 'refused')
                return result;
            serverProgram = result.program;
        }
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        const rows = scripts.map(({ descriptor, ordinal }) => {
            const base = { originalOrdinal: ordinal, identity: descriptor.identity, pointer: descriptor.pointer,
                enabled: descriptor.enabled, sourceSha256: descriptor.sourceSha256, rawDescriptorSha256: recordSha256(descriptor) };
            const promptIndex = promptIndices.get(ordinal);
            if (promptIndex !== undefined)
                return { ...base, disposition: 'prompt', promptIndex };
            const browserIndex = browserIndices.get(ordinal);
            if (browserIndex !== undefined) {
                return { ...base, browserIndex, disposition: descriptor.enabled ? 'browser' : 'disabled-source-retained' };
            }
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
        const body = { schemaVersion: 4, encoding: 'native-author-combined-program-v4',
            authority: 'compiled-program-data-only', compiler: identity, original,
            sourceRecordSessionId: input.sourceRecordSessionId, executionPlan, serverProgram, browserProgram, promptProgram };
        return { kind: 'compiled', program: { ...body, combinedProgramSha256: recordSha256(body) } };
    }
    return { identity, compile, async verifyProgram(program, signal) {
            try {
                const checked = validateCombinedAuthorProgramV4(program);
                const fresh = await compile(combinedCompilationInputForProgram(checked), signal);
                return fresh.kind === 'compiled' && recordSha256(fresh.program) === recordSha256(checked);
            }
            catch {
                return false;
            }
        } };
}
