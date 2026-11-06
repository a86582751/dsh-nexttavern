// Generated from runtime/alpha3/src/core/community-preset-material.ts; edit the TypeScript source.
import { createCommunityPresetExecution } from './community-preset-execution.js';
import { applyCommunityRegex, communityRegexEntry, communityRegexMacros, communityRegexRules } from './community-regex.js';
import { recordSha256 } from './roleplay-data.js';
import { createRoleplaySourceMessageProcessorV1, roleplaySourceMessageRulesV1 } from './roleplay-source-message.js';
/** The bridge freezes one profile/variable attempt and batches actual Native
 * history text through the same ST Worker as worldbook rendering. The pure
 * profile executor subsequently owns Advice and history wrapping. */
export async function prepareCommunityPresetMaterial(deps, input, signal) {
    const policy = input.policy ?? deps.presets.policy(input.session.id);
    const variableAttempt = policy.preset ? deps.variables.capture(policy.preset.id, input.session.id, input.inputId, input.attemptId) : null;
    const promptHistoryTextEdits = [];
    const executor = policy.preset && variableAttempt ? createCommunityPresetExecution({ ...input, policy, variableAttempt,
        modelName: deps.modelName(input.session.id), promptHistoryTextEdits }) : null;
    const prefix = executor?.prefix();
    const chat = prefix?.chat ?? variableAttempt?.chat ?? {}, global = prefix?.global ?? variableAttempt?.global ?? {};
    const historyText = (row) => {
        if (!row)
            return '';
        const original = row.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        return row.eventSeq === null ? original : input.storyText?.text(row.eventSeq, row.message, original, row.messageSha256) ?? original;
    };
    const aliases = { ...input.aliases, model: deps.modelName(input.session.id), input: input.inputText, lastUserMessage: input.inputText,
        lastMessage: historyText(input.historyRows.at(-1)), lastCharMessage: historyText(input.historyRows.findLast(row => row.role === 'assistant')) };
    const entries = input.historyRows.flatMap((row, index) => {
        const settled = row.eventSeq === null ? undefined : input.storyText?.blocks(row.eventSeq, row.message, row.messageSha256);
        return row.message.content.flatMap((block, blockIndex) => block.type === 'text'
            ? [{ row, blockIndex, originalText: block.text, entry: communityRegexEntry(`history-${index}-${blockIndex}`, settled?.get(blockIndex) ?? block.text, policy.fingerprint, { channel: 'prompt', placement: row.role === 'user' ? 1 : 2, depth: input.historyRows.length - index - 1 }) }] : []);
    });
    const output = await applyCommunityRegex(policy, entries.map(row => row.entry), { ...communityRegexMacros(aliases, chat, global, policy.fingerprint, { preset: policy.helperVariables }),
        ...input.deferredMacroFamilies ? { deferredMacroFamilies: input.deferredMacroFamilies } : {} }, input.scopedRules, signal);
    let stageValues = input.ordinary.values, scopeCache = new WeakMap();
    function scopes(base) {
        if (stageValues !== input.ordinary.values) {
            stageValues = input.ordinary.values;
            scopeCache = new WeakMap();
        }
        const values = { chat: stageValues, global: executor?.bindings.global ?? {} };
        const merged = base.map(binding => {
            if (binding.scope !== 'chat' && binding.scope !== 'global')
                return binding;
            const prior = scopeCache.get(binding);
            if (prior)
                return prior;
            if (binding.scope === 'global' && !executor)
                return binding;
            const combined = binding.scope === 'chat' ? {
                ...Object.hasOwn(binding.values, 'stat_data') ? { stat_data: binding.values.stat_data } : {}, ...values.chat
            }
                : { ...binding.values, ...values.global };
            const result = { ...binding, values: combined, valuesSha256: recordSha256(combined),
                versionSha256: recordSha256({ version: binding.versionSha256, preset: policy.fingerprint, values: combined }) };
            scopeCache.set(binding, result);
            scopeCache.set(result, result);
            return result;
        });
        for (const scope of ['chat', 'global'])
            if ((scope === 'chat' || executor) && !merged.some(binding => binding.scope === scope)) {
                const hash = recordSha256(values[scope]);
                merged.push({ scope, ownerId: scope === 'chat' ? input.session.id : `community:${policy.preset.id}:${scope}`,
                    values: values[scope], valuesSha256: hash, versionSha256: hash });
            }
        return merged;
    }
    const rules = communityRegexRules(policy, input.scopedRules);
    // Source scripts rewrite the stored AI message once, at the actual write.
    // The capture is frozen with this attempt so a retry never sees new rules.
    const sourceRules = roleplaySourceMessageRulesV1(rules, 2);
    const sourceMessage = sourceRules.length ? createRoleplaySourceMessageProcessorV1({ schemaVersion: 1,
        encoding: 'nexttavern-source-message-capture-v1', authority: 'consumer-data-only',
        sourceSnapshotSha256: policy.fingerprint, placement: 2, isEdit: false, depth: null, pipeline: 'regex-only',
        rules: sourceRules, macros: communityRegexMacros(aliases, chat, global, policy.fingerprint, { preset: policy.helperVariables }),
        scriptOrder: policy.regexOrder }) : undefined;
    return { scopes, renderPlainAuthor: (value) => executor?.renderPlainAuthor(value) ?? value,
        rules, regexOrder: policy.regexOrder,
        preset: policy.preset, cardMapping: policy.effective.features.nativeCardMapping,
        finish(finish) {
            // Regex/macros already ran once. Only the material owner's final named
            // outlet expansion waits for all later EJS upserts in this assembly.
            const historyEdits = new Map();
            for (const [index, row] of entries.entries()) {
                const projected = input.projectHistoryText ? input.projectHistoryText(row.row.id, output[index]) : output[index], text = finish.finalizeText?.(projected) ?? projected;
                if (text === row.originalText)
                    continue;
                let edit = historyEdits.get(row.row.id);
                if (!edit) {
                    edit = { target: { id: row.row.id, messageSha256: row.row.messageSha256 }, blocks: [] };
                    historyEdits.set(row.row.id, edit);
                }
                edit.blocks.push({ index: row.blockIndex, text });
            }
            promptHistoryTextEdits.push(...historyEdits.values());
            const transformed = executor?.finish(finish);
            const projection = promptHistoryTextEdits.length
                ? { schemaVersion: 1, encoding: 'native-request-message-projection-v1', groups: [], textEdits: promptHistoryTextEdits } : undefined;
            const result = transformed ?? { ...finish.layout, ...projection ? { messageProjection: projection } : {}, record: undefined,
                responseHooks: undefined, story: undefined };
            return { ...result, responseHooks: sourceMessageHooks(result.responseHooks, sourceMessage) };
        } };
}
function sourceMessageHooks(hooks, processor) {
    if (!processor)
        return hooks;
    const { schemaVersion: _version, ...shared } = hooks ?? { schemaVersion: 1 };
    return { ...shared, schemaVersion: 2,
        finalizeText: ({ text, signal }) => processor.finalize(text, signal, () => signal.throwIfAborted()) };
}
