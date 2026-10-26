// Generated from runtime/alpha3/src/core/tavern-author-combined-compiler-v8.mts; edit the TypeScript source.
/** Complete source disposition: real server/Prompt/Browser owners execute only
 * their projections; known unavailable external declarations remain explicit. */
import { recordSha256 } from './roleplay-data.js';
import { projectAuthorScriptResourcesV3 } from './tavern-author-browser-source-projection-v3.mjs';
import { validateCombinedAuthorProgramV8, combinedCompilationInputForProgramV8, captureCompiledCombinedAuthorProgramV8 } from './tavern-author-combined-data-v8.mjs';
import { EXTERNAL_ADDON_CATALOG_V1, EXTERNAL_ADDON_RUNTIME_UNAVAILABLE, identifyUnavailableExternalAddonV1 } from './tavern-author-external-addons.mjs';
import { FIXED_STATE_LOADER_POLICY_V1 } from './tavern-mvu-state-loader-policy-v4.mjs';
const groupBUrls = FIXED_STATE_LOADER_POLICY_V1.entries.filter(([group]) => group === 'B').map(([, url]) => url);
// Routing hint only. The Browser owner still proves complete code and finite
// import sites; these tokens never authorize an import or execution.
function browserBootstrapCandidate(source) {
    return /\bimport\s*\(/.test(source) && /\b(?:window|document|localStorage|sessionStorage)\b/.test(source)
        && groupBUrls.some(url => source.includes(url));
}
export function createCombinedAuthorCompilerV8(deps) {
    const browser = deps.browser;
    const identity = Object.freeze({ id: 'native-author-combined-compiler', version: 1, hostProtocol: 5,
        implementationSha256: recordSha256({ implementationSha256: deps.implementationSha256,
            externalAddons: EXTERNAL_ADDON_CATALOG_V1, sourceDispositionPlan: 4, ownedBrowserState: 1,
            server: deps.server.identity, browser: { compiler: browser.identity, runtime: browser.runtime },
            prompt: { compiler: deps.prompt.identity, runtime: deps.prompt.runtime } }) });
    const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
    const compile = async (input, signal, capturedResources) => {
        if (signal?.aborted)
            return refused('COMBINED_COMPILER_CANCELLED');
        if (input.schemaVersion !== 8 || input.encoding !== 'native-author-combined-compilation-input-v8')
            return refused('COMBINED_COMPILER_INPUT_VERSION');
        // This owner still receives every original descriptor. The disposition
        // below never edits Source or substitutes a fabricated server projection.
        const bootstrapOrdinals = (Array.isArray(input.original?.scripts) ? input.original.scripts : []).flatMap((script, ordinal) => script?.enabled === true && typeof script.source === 'string' && browserBootstrapCandidate(script.source) ? [ordinal] : []);
        const bootstrapCandidates = new Set(bootstrapOrdinals);
        const server = await deps.server.partitionCandidates(input.original, signal, bootstrapOrdinals);
        if (server.kind === 'refused')
            return server.diagnostics[0]?.code === 'MVU_SCHEMA_COMPILER_INPUT_INVALID'
                ? refused('COMBINED_ORIGINAL_INPUT_INVALID') : server;
        const original = server.original;
        const { material: _material, ...source } = original.source;
        const locator = { ...source, sourceRecordSessionId: input.sourceRecordSessionId };
        const scripts = original.scripts.map((descriptor, ordinal) => ({ ordinal, descriptor }));
        const serverIndices = new Map(server.serverOrdinals.map((ordinal, index) => [ordinal, index]));
        const externalAddons = new Map();
        const remainingServer = scripts.filter(({ ordinal, descriptor }) => {
            if (serverIndices.has(ordinal))
                return false;
            const dependency = identifyUnavailableExternalAddonV1(descriptor);
            if (!dependency)
                return true;
            externalAddons.set(ordinal, dependency);
            return false;
        });
        let promptProgram = null;
        let promptOrdinals = [];
        const promptCandidates = remainingServer.filter(row => !bootstrapCandidates.has(row.ordinal));
        if (promptCandidates.length)
            try {
                const candidates = await deps.prompt.compileCandidates({ schemaVersion: 1,
                    encoding: 'native-author-prompt-compilation-input-v1', source: locator,
                    scripts: promptCandidates }, signal);
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
        if (browserProgram?.stateImports && server.serverProgram)
            return refused('COMBINED8_MIXED_STATE_FRAMEWORK_UNSUPPORTED');
        let serverProgram = server.serverProgram;
        if (browserProgram?.stateImports)
            try {
                serverProgram = deps.server.assembleOwnedStateProgram(original, browserProgram);
            }
            catch {
                return refused('COMBINED8_OWNED_STATE_ASSEMBLY_FAILED');
            }
        const rows = scripts.map(({ descriptor, ordinal }) => {
            const base = { originalOrdinal: ordinal, identity: descriptor.identity, pointer: descriptor.pointer,
                enabled: descriptor.enabled, sourceSha256: descriptor.sourceSha256, rawDescriptorSha256: recordSha256(descriptor) };
            const dependency = externalAddons.get(ordinal);
            if (dependency)
                return { ...base, enabled: true, disposition: 'external-addon-unavailable', dependency,
                    reason: EXTERNAL_ADDON_RUNTIME_UNAVAILABLE };
            const promptIndex = promptIndices.get(ordinal);
            if (promptIndex !== undefined)
                return { ...base, disposition: 'prompt', promptIndex };
            const browserIndex = browserIndices.get(ordinal);
            if (browserIndex !== undefined)
                return { ...base, browserIndex, disposition: descriptor.enabled ? 'browser' : 'disabled-source-retained' };
            const serverIndex = serverIndices.get(ordinal), plan = server.serverProgram.executionPlan.scripts[serverIndex];
            return { ...base, serverIndex, disposition: 'server',
                classification: plan.classification };
        });
        const planBody = { schemaVersion: 4, encoding: 'native-author-source-disposition-plan-v4',
            authority: 'compiled-program-data-only', scripts: rows,
            summary: { enabledServerSchema: server.serverProgram?.executionPlan.summary.enabledServerSchema ?? 0,
                enabledNativeLoaders: server.serverProgram?.executionPlan.summary.enabledNativeLoaders ?? 0,
                enabledBrowser: rows.filter(row => row.disposition === 'browser').length,
                disabled: rows.filter(row => row.disposition === 'disabled-source-retained').length,
                enabledPrompt: promptOrdinals.length, enabledExternalAddonsUnavailable: externalAddons.size } };
        const executionPlan = { ...planBody, executionPlanSha256: recordSha256(planBody) };
        const body = { schemaVersion: 8, encoding: 'native-author-combined-program-v8',
            authority: 'compiled-program-data-only', compiler: identity, original,
            sourceRecordSessionId: input.sourceRecordSessionId, executionPlan, serverProgram, browserProgram, promptProgram };
        try {
            const program = captureCompiledCombinedAuthorProgramV8({ ...body, combinedProgramSha256: recordSha256(body) });
            return { kind: 'compiled', program };
        }
        catch {
            return refused('COMBINED8_PROGRAM_DATA_LIMIT');
        }
    };
    return { identity, compile, async verifyProgram(program, signal, resources) {
            if (program.schemaVersion !== 8)
                return false;
            try {
                const checked = validateCombinedAuthorProgramV8(program);
                const fresh = await compile(combinedCompilationInputForProgramV8(checked), signal, resources);
                return fresh.kind === 'compiled' && recordSha256(fresh.program) === recordSha256(checked);
            }
            catch {
                return false;
            }
        } };
}
