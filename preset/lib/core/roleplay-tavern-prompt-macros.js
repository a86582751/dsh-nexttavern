// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-macros.ts; edit the TypeScript source.
/** Frozen aliases are produced from the actual activated card/context. Runtime
 * globals and ST player settings are never inferred from another installation. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { communityMacroClock } from './community-preset-macros.js';
import { readTavernCardMacroFields } from './nexttavern-card.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { TAVERN_PROMPT_CARD_ORDER_V1 } from './tavern-prompt-transform-types.mjs';
export const TAVERN_NATIVE_MACRO_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-card-prompt-macro-policy-v1', group: 'single-activated-character',
    characterFields: 'activated-raw-card-trimmed; native-card-style-selection-gates-prompt-and-jailbreak',
    examples: 'ordered-chat-start-blocks; no-instruct-mode', persona: 'actual-current-user-card-content',
    variables: 'explicit-read-only-captured-scopes', model: 'unresolved-route-refuses-only-on-read',
    clock: 'captured-attempt-local-wall-clock-en-US', random: 'captured-attempt-stream; stable-chat-content-offset-pick',
    regex: 'owned-scoped-raw-card-rules; imported-allow-decision; no-global-or-preset-registry',
    outlets: 'phase-captured-values-or-catalog-proven-negative-read',
    messageVariables: 'nearest-published-active-message-in-actual-prefix; unavailable-blocks; pending-absence-skipped',
    userGender: 'existing-native-author-interpolation; actual-opening-context-binding' });
export const TAVERN_NATIVE_MACRO_POLICY_SHA256 = recordSha256(TAVERN_NATIVE_MACRO_POLICY_V1);
function fail(code) { throw Error(code); }
const text = (value) => typeof value === 'string' ? value : '';
const frozen = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            frozen(child);
        Object.freeze(value);
    }
    return value;
};
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export function produceRoleplayTavernMacroSnapshotV1(input) {
    const { source, includeCardStyle, scopes } = input, card = cloneRoleplayTavernLoreDataV1(input.cardData, 8_388_608), explicitScopes = input.variableScopes, messageScope = explicitScopes?.message !== undefined ? explicitScopes.message
        : input.messageVariables !== undefined ? input.messageVariables : null, chatScope = explicitScopes?.chat !== undefined ? explicitScopes.chat : scopes.find(row => row.scope === 'chat') ?? null, characterScope = explicitScopes?.character !== undefined ? explicitScopes.character : scopes.find(row => row.scope === 'card') ?? null, presetScope = explicitScopes?.preset !== undefined ? explicitScopes.preset
        : input.presetVariables !== undefined ? input.presetVariables
            : scopes.find(row => row.scope === 'preset') ?? null, globalScope = explicitScopes?.global !== undefined ? explicitScopes.global : scopes.find(row => row.scope === 'global') ?? null, variableScopes = Object.freeze({
        message: messageScope, chat: chatScope, character: characterScope, preset: presetScope, global: globalScope,
    }), basis = source.sourceSha256, ownerId = `${source.sessionId}:native-card`;
    const binding = (key, value, original = value, versionSha256 = basis, scope = 'card', owner = ownerId) => ({ key, value, valueSha256: value === null ? null : sha256(value), read: { kind: 'variable', purpose: 'read', scope,
            ownerId: owner, key, present: value !== null, versionSha256, valueSha256: value === null ? null : recordSha256(original),
            entryId: null, sourcePointer: null } });
    const user = source.current.openingContext.context.user, char = source.current.openingContext.context.char, context = source.current.openingContext.context;
    if (typeof user !== 'string' || typeof char !== 'string')
        fail('INPUT_MATERIAL_OPENING_NAMES_UNAVAILABLE');
    const names = { user: binding('user', user, user, source.current.openingContext.bindingSha256),
        char: binding('char', char, char, source.current.openingContext.bindingSha256),
        group: binding('group', char), charIfNotGroup: binding('charIfNotGroup', char),
        groupNotMuted: binding('groupNotMuted', char), notChar: binding('notChar', user),
        model: binding('model', input.preparedRoute?.model ?? null, input.preparedRoute?.model ?? null, input.preparedRoute?.configSha256 ?? recordSha256({ schemaVersion: 1, encoding: 'native-route-unresolved-v1', source: basis })) };
    const userRow = source.current.rows.find(row => row.ref.table === 'cards' && row.ref.key === `${source.sessionId}__user`);
    const aliases = readTavernCardMacroFields(card, source.original.decodedFormat);
    const persona = text(userRow?.value?.content).trim(), examples = text(aliases.mes_example).trim();
    const parsedExamples = !examples || examples === '<START>' ? '' :
        (examples.startsWith('<START>') ? examples : `<START>\n${examples}`).split(/<START>/gi).slice(1)
            .map(block => `<START>\n${block.trim()}\n`).join('');
    const depth = object(card.extensions) && object(card.extensions.depth_prompt) ? text(card.extensions.depth_prompt.prompt).trim() : '';
    const cardAliases = { charPrompt: includeCardStyle ? text(aliases.system_prompt).trim() : '',
        charJailbreak: includeCardStyle ? text(aliases.post_history_instructions).trim() : '',
        charInstruction: includeCardStyle ? text(aliases.post_history_instructions).trim() : '',
        description: text(aliases.description).trim(), personality: text(aliases.personality).trim(), scenario: text(aliases.scenario).trim(),
        persona, mesExamples: parsedExamples, mesExamplesRaw: examples, charVersion: text(card.character_version),
        char_version: text(card.character_version), charDepthPrompt: depth, creatorNotes: text(card.creator_notes).trim(),
        ...input.currentCardFields };
    const variableBindings = (scopeName, scope) => {
        if (!scope)
            return [];
        return Object.keys(scope.values).map(key => {
            const value = scope.values[key];
            // Values are purpose-cloned inert JSON. String conversion cannot invoke
            // accessors, prototypes or an author-provided conversion hook.
            return binding(key, typeof value === 'string' ? value : String(value), value, scope.versionSha256, scopeName, scope.ownerId);
        });
    };
    const byOutlet = new Map(input.outlets.map(row => [row.name, row]));
    if (byOutlet.size !== input.outlets.length)
        fail('INPUT_MATERIAL_OUTLET_DUPLICATE');
    const outlets = [...new Set(input.declaredOutlets)].map(name => {
        const row = byOutlet.get(name);
        return binding(name, row?.text ?? null, row?.text ?? null, row?.versionSha256 ??
            recordSha256({ schemaVersion: 1, encoding: 'native-lore-outlet-absent-at-phase-v1', source: basis, name }));
    });
    // Ordinary ST getvar/getglobalvar macros continue reading flat string bindings in
    // localVariables/globalVariables; structured helper get/format_*_variable macros
    // read exclusively from variableScopes.
    const snapshot = { schemaVersion: 1, engine: 'legacy', authority: 'consumer-data-only',
        sourceSnapshotSha256: basis, names, card: TAVERN_PROMPT_CARD_ORDER_V1.map(key => binding(key, cardAliases[key], cardAliases[key])),
        ...input.randomSeed === undefined ? {} : { random: { seed: input.randomSeed, pickSeed: source.sessionId } },
        input: binding('input', input.inputText), instruct: [],
        dynamic: [binding('user_gender', context.user_gender ?? null, context.user_gender ?? null, source.current.openingContext.bindingSha256),
            ...input.avatarPaths ? [binding('userAvatarPath', input.avatarPaths.user ?? ''),
                binding('charAvatarPath', input.avatarPaths.character ?? '')] : []], registered: [],
        localVariables: variableBindings('chat', chatScope), globalVariables: variableBindings('global', globalScope), outlets,
        post: input.clockEpochMs === undefined ? [] : Object.entries(communityMacroClock(input.clockEpochMs))
            .map(([key, value]) => binding(key, value, value, recordSha256({ clockEpochMs: input.clockEpochMs }))), characterOverrides: [] };
    // These readonly scopes are the owners' captured values. Freeze only this
    // packet's new envelope; copying or walking each table again adds no facts.
    return Object.freeze({ snapshot: Object.freeze({ ...frozen(snapshot), variableScopes }),
        policySha256: TAVERN_NATIVE_MACRO_POLICY_SHA256 });
}
/** Preserve actual rule order and explicit false/zero values. Permission to
 * execute this imported scoped registry belongs to the trusted Core caller. */
export function captureRoleplayTavernScopedRegexV1(cardData, sourceSnapshotSha256, allowed) {
    const extensions = object(cardData.extensions) ? cardData.extensions : {}, raw = extensions.regex_scripts;
    if (raw === undefined)
        return [];
    if (!Array.isArray(raw) || raw.length > 256)
        fail('INPUT_MATERIAL_REGEX_CATALOG_INVALID');
    return frozen(raw.map((item, index) => {
        if (!object(item))
            fail('INPUT_MATERIAL_REGEX_RULE_INVALID');
        const pointer = `/data/extensions/regex_scripts/${index}`;
        const boolean = (key, defaultValue) => {
            if (item[key] === undefined)
                return defaultValue;
            if (typeof item[key] !== 'boolean')
                fail('INPUT_MATERIAL_REGEX_RULE_INVALID');
            return item[key];
        };
        const nullable = (key) => {
            const value = item[key];
            if (value === undefined || value === null)
                return null;
            if (typeof value !== 'number')
                fail('INPUT_MATERIAL_REGEX_RULE_INVALID');
            return value;
        };
        if (typeof item.findRegex !== 'string' || typeof item.replaceString !== 'string' || !Array.isArray(item.placement)
            || item.placement.some(value => typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 6)
            || item.trimStrings !== undefined && (!Array.isArray(item.trimStrings) || item.trimStrings.some(value => typeof value !== 'string')))
            fail('INPUT_MATERIAL_REGEX_RULE_INVALID');
        const substituteRegex = item.substituteRegex ?? 0;
        if (substituteRegex !== 0 && substituteRegex !== 1 && substituteRegex !== 2)
            fail('INPUT_MATERIAL_REGEX_RULE_INVALID');
        return { id: `scoped-${index}-${recordSha256(item)}`, sourcePointer: pointer, sourceSnapshotSha256, origin: 'scoped', allowed,
            disabled: boolean('disabled', false), findRegex: item.findRegex, replaceString: item.replaceString,
            trimStrings: (item.trimStrings ?? []), placement: item.placement,
            promptOnly: boolean('promptOnly', false), markdownOnly: boolean('markdownOnly', false), runOnEdit: boolean('runOnEdit', false),
            minDepth: nullable('minDepth'), maxDepth: nullable('maxDepth'), substituteRegex };
    }));
}
