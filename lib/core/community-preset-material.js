// Generated from runtime/alpha3/src/core/community-preset-material.ts; edit the TypeScript source.
import { createCommunityPresetExecution } from './community-preset-execution.js';
import { applyCommunityRegex, communityRegexEntry, communityRegexMacros, communityRegexRules } from './community-regex.js';
import { recordSha256 } from './roleplay-data.js';
/** The bridge freezes one profile/variable attempt and batches actual Native
 * history text through the same ST Worker as worldbook rendering. The pure
 * profile executor subsequently owns Advice and history wrapping. */
export async function prepareCommunityPresetMaterial(deps, input, signal) {
    await deps.settlement.reconcile(input.session);
    const policy = input.policy ?? deps.presets.policy(input.session.id);
    const inheritedAttempts = deps.settlement.attemptIds(input.session.snapshotEvents());
    if (policy.preset)
        await deps.variables.configure(policy.preset.id, input.session.id, deps.presets.configurations(input.session.id, policy.preset.id), inheritedAttempts);
    const variableAttempt = policy.preset ? deps.variables.capture(policy.preset.id, input.session.id, input.inputId, input.attemptId, inheritedAttempts) : null;
    const promptHistoryTextEdits = [];
    const executor = policy.preset && variableAttempt ? createCommunityPresetExecution({ ...input, policy, variableAttempt,
        modelName: deps.modelName(input.session.id), promptHistoryTextEdits }) : null;
    const prefix = executor?.prefix();
    const chat = prefix?.chat ?? variableAttempt?.chat ?? {}, global = prefix?.global ?? variableAttempt?.global ?? {};
    const aliases = { ...input.aliases, model: deps.modelName(input.session.id), input: input.inputText, lastUserMessage: input.inputText,
        lastMessage: input.historyRows.at(-1)?.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? '',
        lastCharMessage: input.historyRows.findLast(row => row.role === 'assistant')?.message.content
            .filter(block => block.type === 'text').map(block => block.text).join('\n') ?? '' };
    const entries = input.historyRows.flatMap((row, index) => row.message.content.flatMap((block, blockIndex) => block.type === 'text'
        ? [{ row, blockIndex, entry: communityRegexEntry(`history-${index}-${blockIndex}`, block.text, policy.fingerprint, { channel: 'prompt', placement: row.role === 'user' ? 1 : 2, depth: input.historyRows.length - index - 1 }) }] : []));
    const output = await applyCommunityRegex(policy, entries.map(row => row.entry), communityRegexMacros(aliases, chat, global, policy.fingerprint), input.scopedRules, signal);
    const historyEdits = new Map();
    for (const [index, row] of entries.entries())
        if (output[index] !== row.entry.inputText) {
            let edit = historyEdits.get(row.row.id);
            if (!edit) {
                edit = { target: { id: row.row.id, messageSha256: row.row.messageSha256 }, blocks: [] };
                historyEdits.set(row.row.id, edit);
            }
            edit.blocks.push({ index: row.blockIndex, text: output[index] });
        }
    promptHistoryTextEdits.push(...historyEdits.values());
    const scopeCache = new WeakMap();
    function scopes(base) {
        if (!executor)
            return base;
        const values = executor.bindings;
        const merged = base.map(binding => {
            if (binding.scope !== 'chat' && binding.scope !== 'global')
                return binding;
            const prior = scopeCache.get(binding);
            if (prior)
                return prior;
            const combined = { ...binding.values, ...values[binding.scope] };
            const result = { ...binding, values: combined, valuesSha256: recordSha256(combined),
                versionSha256: recordSha256({ version: binding.versionSha256, preset: policy.fingerprint, values: combined }) };
            scopeCache.set(binding, result);
            scopeCache.set(result, result);
            return result;
        });
        for (const scope of ['chat', 'global'])
            if (!merged.some(binding => binding.scope === scope)) {
                const hash = recordSha256(values[scope]);
                merged.push({ scope, ownerId: `community:${policy.preset.id}:${scope}`, values: values[scope], valuesSha256: hash, versionSha256: hash });
            }
        return merged;
    }
    return { scopes, renderPlainAuthor: (value) => executor?.renderPlainAuthor(value) ?? value,
        rules: communityRegexRules(policy, input.scopedRules), regexOrder: policy.regexOrder,
        preset: policy.preset, cardMapping: policy.effective.features.nativeCardMapping,
        finish(finish) {
            const transformed = executor?.finish(finish);
            const projection = promptHistoryTextEdits.length
                ? { schemaVersion: 1, encoding: 'native-request-message-projection-v1', groups: [], textEdits: promptHistoryTextEdits } : undefined;
            return transformed ?? { ...finish.layout, ...projection ? { messageProjection: projection } : {}, record: undefined, responseHooks: undefined, story: undefined };
        } };
}
