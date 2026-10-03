// Generated from runtime/alpha3/src/core/tavern-lore-fixed-profile.mts; edit the TypeScript source.
/** Facts read from one fixed primary source. These are importer defaults,
 * never a snapshot of player-selected global settings. No upstream code runs. */
import { recordSha256 } from './roleplay-data.js';
export const ST_LORE_COMMIT = '06bde939fb1e9c4c8d8641d810f0a916b5bce127';
const base = `https://github.com/SillyTavern/SillyTavern/blob/${ST_LORE_COMMIT}/public/`;
export const ST_LORE_PRIMARY_EVIDENCE_V1 = Object.freeze({
    logic: `${base}scripts/world-info.js#L31-L35`,
    positions: `${base}scripts/world-info.js#L791-L799`,
    roles: `${base}script.js#L469-L473`,
    constants: `${base}scripts/world-info.js#L89-L91`,
    importer: `${base}scripts/world-info.js#L5207-L5261`,
    template: `${base}scripts/world-info.js#L3805-L3848`,
    matching: `${base}scripts/world-info.js#L249-L337`,
    placement: `${base}scripts/world-info.js#L4831-L4880`,
    probability: `${base}scripts/world-info.js#L4667-L4687`,
    group: `${base}scripts/world-info.js#L5042-L5069`,
});
export const ST_LORE_LOGIC_V1 = Object.freeze(['and-any', 'not-all', 'not-any', 'and-all']);
export const ST_LORE_POSITION_V1 = Object.freeze(['before-character', 'after-character', 'before-authors-note',
    'after-authors-note', 'at-chat-depth', 'before-examples', 'after-examples', 'named-outlet']);
export const ST_LORE_ROLE_V1 = Object.freeze(['system', 'user', 'assistant']);
/** keys/content/order are deliberately absent: convertCharacterBook writes
 * those properties directly, overriding the new-entry template even when the
 * original value is missing. selective is false here; the editor template's
 * true is not the embedded-character-book import default. */
export const ST_LORE_ENTRY_DEFAULTS_V1 = Object.freeze({
    enabled: false, constant: false, selective: false, secondaryKeys: Object.freeze([]),
    selectiveLogic: 'and-any', keyMatcher: 'st-slash-regex-or-literal-v1',
    caseSensitive: null, matchWholeWords: null, scanDepth: null,
    position: 'after-character', role: 'system', depth: 4, ignoreBudget: false,
    excludeRecursion: false, preventRecursion: false, delayUntilRecursion: false,
    probability: 100, useProbability: true, group: '', groupOverride: false, groupWeight: 100, useGroupScoring: null,
    sticky: null, cooldown: null, delay: null, outletName: '', vectorized: false, automationId: '', triggers: Object.freeze([]),
    matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false,
});
export const ST_LORE_PROFILE_V1 = Object.freeze({ schemaVersion: 1, encoding: 'st-character-book-fixed-import-profile-v1',
    commit: ST_LORE_COMMIT, evidence: ST_LORE_PRIMARY_EVIDENCE_V1,
    logic: ST_LORE_LOGIC_V1, positions: ST_LORE_POSITION_V1, roles: ST_LORE_ROLE_V1,
    entryDefaults: ST_LORE_ENTRY_DEFAULTS_V1, positionFallback: 'only-before_char-is-before-otherwise-after',
    enabledAbsence: 'disabled', entryOrderAbsence: 'unresolved-required',
    globalInheritance: Object.freeze(['case-sensitive', 'whole-word', 'scan-depth', 'group-scoring', 'recursion', 'budget', 'book-insertion-strategy']),
});
export const ST_LORE_PROFILE_SHA256 = recordSha256(ST_LORE_PROFILE_V1);
