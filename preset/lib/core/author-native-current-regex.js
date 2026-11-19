// Generated from runtime/alpha3/src/core/author-native-current-regex.ts; edit the TypeScript source.
/** Serialized with each realm. The supplied kernel owns the shared synchronous
 * semantics and this call consumes the actual current captured DATA. */
export function createAuthorNativeFormatterV1(read, kernel, limits, variables) {
    return (text, source, destination, options = {}) => {
        const placements = { user_input: 1, ai_output: 2, slash_command: 3, world_info: 5, reasoning: 6 };
        if (!Object.hasOwn(placements, source))
            throw Error('AUTHOR_NATIVE_FORMATTER_SOURCE_UNSUPPORTED');
        if (destination !== 'display' && destination !== 'prompt')
            throw Error('AUTHOR_NATIVE_FORMATTER_DESTINATION_UNSUPPORTED');
        const depth = options.depth ?? null, captured = read({ source, destination, depth }).formatter;
        if (!captured)
            throw Error('AUTHOR_NATIVE_FORMATTER_UNAVAILABLE');
        if (text.length > limits.inputChars)
            throw Error('AUTHOR_NATIVE_FORMATTER_LIMIT_INPUTCHARS');
        let jobs = 0, work = 0, matches = 0;
        const check = (field, value) => {
            if (value > limits[field])
                throw Error('AUTHOR_NATIVE_FORMATTER_LIMIT_' + field.toUpperCase());
        };
        const macros = captured.macros, name = options.character_name, nameSha256 = name === undefined ? undefined : kernel.recordSha256(name), names = name === undefined ? undefined : Object.fromEntries(Object.entries(macros.names).map(([key, binding]) => ['char', 'group', 'charIfNotGroup', 'groupNotMuted'].includes(key)
            ? [key, { ...binding, value: name, valueSha256: nameSha256 }] : [key, binding])), current = name === undefined ? macros : { ...macros, characterOverrides: [{ name, names: names }, ...macros.characterOverrides] };
        const result = kernel.format(text, options.macrosOnly ? [] : captured.rules, current, { channel: destination, placement: placements[source],
            depth, isEdit: false, characterOverride: name ?? null }, {
            issue(code) { throw Error(code); }, recordRead() { }, variable: variables,
            budget: { job() { check('jobs', ++jobs); }, work(chars) { work += chars; check('workChars', work); },
                output(chars) { check('outputChars', chars); }, match() { check('matches', ++matches); } },
            pattern(chars) { check('patternChars', chars); }, replacement(chars) { check('replacementChars', chars); },
        }, captured.regexDisabled);
        check('outputChars', result.length);
        return result;
    };
}
/** Serialized with each SDK realm. Owners supply standard DTOs at capture;
 * this facade only selects, filters and detaches that current DATA. */
export function createAuthorNativeCurrentRegex(read) {
    return (options = {}) => {
        const snapshot = read();
        let state;
        let rules;
        const global = () => {
            const value = snapshot.tavernRegexes?.global;
            if (value === undefined)
                throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE');
            return value;
        };
        const character = (name = 'current') => {
            if (name !== 'current' && snapshot.characterLibrary) {
                const key = name.toLowerCase(), entry = snapshot.characterLibrary.entries.find(row => row.descriptor.name.toLowerCase() === key || row.descriptor.avatar?.toLowerCase() === key);
                if (!entry)
                    throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED');
                return entry.regex.rules;
            }
            const value = snapshot.tavernRegexes?.character;
            if (value === undefined)
                throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE');
            if (name !== 'current' && name !== value.name)
                throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED');
            return value.rules;
        };
        if (options.type === 'preset') {
            const value = snapshot.readonlyPreset;
            if (value?.kind !== 'available')
                throw Error('AUTHOR_NATIVE_CURRENT_PRESET_UNAVAILABLE');
            if (options.name !== undefined && options.name !== 'in_use' && options.name !== value.loadedName)
                throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED');
            const current = value.preset.extensions.regex_scripts;
            if (!Array.isArray(current))
                throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE');
            rules = current;
        }
        else if (options.type === 'character')
            rules = character(options.name);
        else if (options.type === 'global')
            rules = global();
        else if (options.type === undefined) {
            state = options.enable_state ?? 'all';
            if (state !== 'all' && state !== 'enabled' && state !== 'disabled')
                throw Error('AUTHOR_NATIVE_REGEX_ENABLE_STATE_UNSUPPORTED');
            const scope = options.scope ?? 'all';
            const scoped = (rows, scope) => rows.map(rule => ({ ...rule, scope }));
            if (scope === 'all')
                rules = [...scoped(global(), 'global'), ...scoped(character(), 'character')];
            else if (scope === 'global')
                rules = scoped(global(), 'global');
            else if (scope === 'character')
                rules = scoped(character(), 'character');
            else
                throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNSUPPORTED');
        }
        else
            throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNSUPPORTED');
        return structuredClone(state === undefined || state === 'all' ? rules : rules.filter(rule => rule.enabled === (state === 'enabled')));
    };
}
