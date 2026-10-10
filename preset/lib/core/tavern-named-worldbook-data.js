// Generated from runtime/alpha3/src/core/tavern-named-worldbook-data.ts; edit the TypeScript source.
const positions = ['before_character_definition', 'after_character_definition',
    'before_author_note', 'after_author_note', 'at_depth', 'before_example_messages', 'after_example_messages', 'outlet'];
const roles = ['system', 'user', 'assistant'];
const secondaryLogic = ['and_any', 'not_all', 'not_any', 'and_all'];
const controlsKey = 'nexttavern_worldbook_entry';
const controlsEncoding = 'nexttavern-worldbook-entry-controls-v1';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = (value) => structuredClone(value);
const positive = (value) => typeof value === 'number' && value > 0 ? value : null;
const extensionsOf = (raw) => isObject(raw.extensions) ? raw.extensions : {};
/** Match the fixed ST slash parser, including its literal fallback for invalid
 * regex syntax/flags. Canonical strings represent the RegExp returned by Helper. */
function wireKey(key) {
    const match = key.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
    if (!match || /(^|[^\\])\//.test(match[1]))
        return key;
    try {
        return new RegExp(match[1].replace('\\/', '/'), match[2]).toString();
    }
    catch {
        return key;
    }
}
/** Ordering fallback is supplied from the actual collection by its owner.
 * It is independent of both an entry's UID and its insertion order. */
export function namedWorldbookDisplayIndexV1(raw, fallbackDisplayIndex) {
    const displayIndex = extensionsOf(raw).display_index ?? fallbackDisplayIndex;
    if (typeof displayIndex !== 'number')
        throw Error('NAMED_WORLDBOOK_DISPLAY_INDEX_REQUIRED');
    return displayIndex;
}
/** The membership owner supplies Helper's numeric UID projection. Without that
 * projection, a stock numeric id can still be consumed directly. */
export function nativeNamedWorldbookEntryToWireV1(raw, options = {}) {
    const uid = options.uid ?? raw.id;
    if (typeof uid !== 'number')
        throw Error('NAMED_WORLDBOOK_UID_REQUIRED');
    const extensions = extensionsOf(raw), comment = (raw.comment || '');
    const position = (extensions.position ?? (raw.position === 'before_char' ? 0 : 1));
    const role = (extensions.role ?? 0);
    const logic = (extensions.selectiveLogic ?? 0);
    const entry = {
        uid, name: comment, enabled: !!raw.enabled,
        strategy: { type: raw.constant ? 'constant' : extensions.vectorized ? 'vectorized' : 'selective',
            keys: raw.keys.map(wireKey),
            keys_secondary: { logic: secondaryLogic[logic], keys: (raw.secondary_keys ?? []).map(wireKey) },
            scan_depth: (extensions.scan_depth ?? 'same_as_global') },
        position: { type: positions[position], role: roles[role], depth: (extensions.depth ?? 4),
            order: raw.insertion_order },
        content: raw.content,
        probability: extensions.useProbability === false ? 100 : (extensions.probability ?? 100),
        recursion: { prevent_incoming: (extensions.exclude_recursion ?? false),
            prevent_outgoing: (extensions.prevent_recursion ?? false),
            delay_until: positive(extensions.delay_until_recursion) },
        effect: { sticky: positive(extensions.sticky), cooldown: positive(extensions.cooldown), delay: positive(extensions.delay) },
        addMemo: !!comment,
        matchPersonaDescription: (extensions.match_persona_description ?? false),
        matchCharacterDescription: (extensions.match_character_description ?? false),
        matchCharacterPersonality: (extensions.match_character_personality ?? false),
        matchCharacterDepthPrompt: (extensions.match_character_depth_prompt ?? false),
        matchScenario: (extensions.match_scenario ?? false),
        matchCreatorNotes: (extensions.match_creator_notes ?? false),
        group: (extensions.group ?? ''), groupOverride: (extensions.group_override ?? false),
        groupWeight: (extensions.group_weight ?? 100), caseSensitive: (extensions.case_sensitive ?? null),
        matchWholeWords: (extensions.match_whole_words ?? null),
        useGroupScoring: (extensions.use_group_scoring ?? null),
        automationId: (extensions.automation_id ?? ''), ignoreBudget: (extensions.ignore_budget ?? false),
        outletName: (extensions.outlet_name ?? ''), triggers: copy((extensions.triggers ?? [])),
        characterFilter: { isExclude: false, names: [], tags: [] },
        ...(isObject(raw.extra) ? { extra: copy(raw.extra) } : {})
    };
    const controls = extensions[controlsKey];
    if (controls !== undefined) {
        if (!isObject(controls) || controls.schemaVersion !== 1 || controls.encoding !== controlsEncoding) {
            throw Error('NAMED_WORLDBOOK_CONTROLS_VERSION_UNSUPPORTED');
        }
        const explicit = controls;
        entry.addMemo = explicit.addMemo;
        entry.characterFilter = copy(explicit.characterFilter);
        // The extension is a complete explicit override: omitted extra resets its
        // current value while preserved raw.extra remains original author metadata.
        delete entry.extra;
        if (explicit.extra)
            entry.extra = copy(explicit.extra);
    }
    return entry;
}
/** Helper replacement semantics: omitted known fields reset to its creation
 * defaults. The supplied base preserves unknown DATA, not prior current fields.
 * The owner has already resolved collisions and the final display ordinal. */
export function worldbookWireToNativeEntryV1(input, identity, unknownBase = {}) {
    const raw = copy(unknownBase), extensions = copy(extensionsOf(unknownBase));
    const position = positions.indexOf(input.position?.type ?? 'at_depth');
    // Existing native ids are metadata of the retained incarnation. A Helper
    // numeric projection never rewrites a textual id in its Native export.
    if (!Object.hasOwn(raw, 'id'))
        raw.id = identity.uid;
    raw.keys = copy(input.strategy?.keys ?? []);
    raw.secondary_keys = copy(input.strategy?.keys_secondary?.keys ?? []);
    raw.comment = input.name ?? '';
    raw.content = input.content ?? '';
    raw.constant = input.strategy?.type ? input.strategy.type === 'constant' : true;
    raw.selective = input.strategy?.type === 'selective';
    raw.insertion_order = input.position?.order ?? 100;
    raw.enabled = input.enabled ?? true;
    raw.position = position === 0 ? 'before_char' : 'after_char';
    raw.use_regex = true;
    Object.assign(extensions, {
        position, display_index: identity.displayIndex,
        exclude_recursion: input.recursion?.prevent_incoming ?? false,
        prevent_recursion: input.recursion?.prevent_outgoing ?? false,
        delay_until_recursion: input.recursion?.delay_until ?? false,
        probability: input.probability ?? 100, useProbability: true,
        depth: input.position?.depth ?? 4, role: roles.indexOf(input.position?.role ?? 'system'),
        selectiveLogic: secondaryLogic.indexOf(input.strategy?.keys_secondary?.logic ?? 'and_any'),
        scan_depth: input.strategy?.scan_depth === 'same_as_global' ? null : input.strategy?.scan_depth ?? null,
        vectorized: input.strategy?.type === 'vectorized',
        sticky: input.effect?.sticky ?? null, cooldown: input.effect?.cooldown ?? null, delay: input.effect?.delay ?? null,
        match_persona_description: input.matchPersonaDescription ?? false,
        match_character_description: input.matchCharacterDescription ?? false,
        match_character_personality: input.matchCharacterPersonality ?? false,
        match_character_depth_prompt: input.matchCharacterDepthPrompt ?? false,
        match_scenario: input.matchScenario ?? false, match_creator_notes: input.matchCreatorNotes ?? false,
        group: input.group ?? '', group_override: input.groupOverride ?? false, group_weight: input.groupWeight ?? 100,
        case_sensitive: input.caseSensitive ?? null, match_whole_words: input.matchWholeWords ?? null,
        use_group_scoring: input.useGroupScoring ?? null, automation_id: input.automationId ?? '',
        ignore_budget: input.ignoreBudget ?? false, outlet_name: input.outletName ?? '', triggers: copy(input.triggers ?? [])
    });
    const originalControls = extensions[controlsKey];
    const controls = { ...(isObject(originalControls) ? originalControls : {}), schemaVersion: 1,
        encoding: controlsEncoding, addMemo: input.addMemo ?? true,
        characterFilter: { isExclude: input.characterFilter?.isExclude ?? false,
            names: copy(input.characterFilter?.names ?? []), tags: copy(input.characterFilter?.tags ?? []) } };
    delete controls.extra;
    if (input.extra)
        controls.extra = copy(input.extra);
    extensions[controlsKey] = controls;
    raw.extensions = extensions;
    return raw;
}
