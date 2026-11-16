// Generated from runtime/alpha3/src/core/community-preset-response.ts; edit the TypeScript source.
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const protectedNames = new Set(['updatevariable', 'jsonpatch', 'mvu', 'stat_data', 'delta_data', 'variable', 'variables']);
/** Imported replacement data is literal. This scanner never evaluates a
 * supplied pattern, macro, EJS body or variable update. */
function mapOutsideProtected(text, replace) {
    let result = '', plain = 0, index = 0;
    while (index < text.length) {
        let end = -1;
        if (text.startsWith('<%', index)) {
            const close = text.lastIndexOf('%>');
            if (close >= index)
                end = close + 2;
        }
        else if (text.startsWith('{{', index)) {
            let depth = 1, cursor = index + 2;
            while (cursor < text.length && depth) {
                if (text.startsWith('{{', cursor)) {
                    depth++;
                    cursor += 2;
                }
                else if (text.startsWith('}}', cursor)) {
                    depth--;
                    cursor += 2;
                }
                else
                    cursor++;
            }
            if (!depth)
                end = cursor;
        }
        else if (text[index] === '<') {
            const opening = /^<([A-Za-z_]+)\b[^>]*>/.exec(text.slice(index));
            if (opening && protectedNames.has(opening[1].toLowerCase())) {
                const close = text.toLowerCase().indexOf(`</${opening[1].toLowerCase()}`, index + opening[0].length);
                if (close >= 0) {
                    const bracket = text.indexOf('>', close);
                    if (bracket >= 0)
                        end = bracket + 1;
                }
            }
        }
        if (end >= 0) {
            result += replace(text.slice(plain, index)) + text.slice(index, end);
            plain = end;
            index = end;
        }
        else
            index++;
    }
    return result + replace(text.slice(plain));
}
function literalSubstitute(text, replacements, ignoreCase = false) {
    let result = '', index = 0;
    const search = ignoreCase ? text.toLowerCase() : text;
    while (index < text.length) {
        const found = replacements.find(([key]) => search.startsWith(ignoreCase ? key.toLowerCase() : key, index));
        if (found) {
            result += found[1];
            index += found[0].length;
        }
        else
            result += text[index++];
    }
    return result;
}
export function createCommunitySanitizer(profile, overrides = {}) {
    const configured = object(profile.configuration[profile.id]);
    const config = { ...object(configured.sanitizer), ...object(overrides.sanitizer) };
    const enabled = profile.transport.kind === 'izumi' && config.enabled !== false;
    const replacements = Object.entries(object(config.replacements)).filter((entry) => typeof entry[1] === 'string')
        .sort((a, b) => b[0].length - a[0].length);
    // Deletion has no output token to restore. An empty reverse key cannot
    // identify a deleted occurrence and would never advance the stream cursor.
    const reverse = replacements.filter(([, to]) => to.length > 0)
        .map(([from, to]) => [to, from]).sort((a, b) => b[0].length - a[0].length);
    const zero = typeof config.zeroWidthChar === 'string' ? config.zeroWidthChar : '\u200b';
    const words = (Array.isArray(config.words) ? config.words : []).filter((word) => typeof word === 'string' && !!word
        && !replacements.some(([key]) => key === word)).sort((a, b) => b.length - a.length);
    const maximum = Math.max(1, ...reverse.map(([key]) => key.length));
    const restore = (text) => literalSubstitute(text, reverse).split(zero).join('');
    const exemptNames = (Array.isArray(config.exemptNames) ? config.exemptNames : [])
        .filter((name) => typeof name === 'string' && name.length > 0).sort((a, b) => b.length - a.length);
    const transformPlain = (plain) => {
        const pieces = literalSubstitute(plain, replacements);
        let output = '', offset = 0;
        const search = pieces.toLowerCase();
        while (offset < pieces.length) {
            const word = words.find(word => search.startsWith(word.toLowerCase(), offset));
            if (word) {
                output += pieces.slice(offset, offset + word.length).split('').join(zero);
                offset += word.length;
            }
            else
                output += pieces[offset++];
        }
        return output;
    };
    const forward = (text) => mapOutsideProtected(text, plain => {
        let output = '', start = 0, index = 0;
        while (index < plain.length) {
            const name = exemptNames.find(name => plain.startsWith(name, index));
            if (name) {
                output += transformPlain(plain.slice(start, index)) + name;
                index += name.length;
                start = index;
            }
            else
                index++;
        }
        return output + transformPlain(plain.slice(start));
    });
    return { enabled, config, forward: (text) => enabled ? forward(text) : text,
        reverse: (text) => enabled && config.reverseEnabled !== false ? restore(text) : text,
        strategy(floor) {
            if (!enabled)
                return 'none';
            if (config.scopeMode === 'forever')
                return 'all';
            const threshold = Math.max(1, Number(config.threshold) || 10);
            if (config.scopeMode !== 'none' && floor <= threshold)
                return 'all';
            return config.inputOnlyAfterX !== false ? 'input_only' : 'none';
        }, createReverseStream() {
            if (!enabled || config.reverseEnabled === false)
                return { push: text => text, finish: () => '' };
            let pending = '';
            const consume = (final) => {
                let output = '', index = 0;
                while (index < pending.length && (final || pending.length - index >= maximum)) {
                    const match = reverse.find(([key]) => pending.startsWith(key, index));
                    if (match) {
                        output += match[1];
                        index += match[0].length;
                    }
                    else if (pending.startsWith(zero, index))
                        index += zero.length;
                    else
                        output += pending[index++];
                }
                pending = pending.slice(index);
                return output;
            };
            return { push(text) { pending += text; return consume(false); }, finish: () => consume(true) };
        } };
}
/** Reborn only strips metadata at the beginning. Once ordinary prose starts,
 * identical labels inside the story remain visible. */
export function createCommunityHeaderCleaner(headerLabels = ['finishReason:', 'finishMessage:']) {
    let pending = '', started = false;
    const labels = headerLabels.map(label => label.toLowerCase()).filter(label => label.length > 0);
    const consume = (final) => {
        if (started) {
            const output = pending;
            pending = '';
            return output;
        }
        while (pending) {
            const normalized = pending.trimStart().toLowerCase();
            const label = labels.find(label => normalized.startsWith(label));
            if (label) {
                const start = pending.length - normalized.length + label.length;
                const newline = /\r\n|\r|\n/.exec(pending.slice(start));
                if (!newline) {
                    if (final)
                        pending = '';
                    return '';
                }
                const offset = start + newline.index;
                if (!final && newline[0] === '\r' && offset === pending.length - 1)
                    return '';
                pending = pending.slice(offset + newline[0].length);
                continue;
            }
            if (!final && (!normalized || labels.some(label => label.startsWith(normalized))))
                return '';
            started = true;
            const output = pending;
            pending = '';
            return output;
        }
        return '';
    };
    return { push(text) { pending += text; return consume(false); }, finish: () => consume(true) };
}
export function communityResponseHooks(profile, features = {}) {
    const sanitizer = createCommunitySanitizer(profile, features);
    const configured = object(profile.configuration[profile.id]), configuration = { ...configured, ...features };
    const preprocessing = { ...object(configured.outputPreprocessing), ...object(features.outputPreprocessing) };
    const clean = profile.transport.kind === 'reborn' && preprocessing.enabled === true && features.outputPreprocessing !== false;
    const dream = profile.transport.kind === 'dream' && configuration.emptyPlotRecovery !== false;
    const headerLabels = Array.isArray(preprocessing.headerLabels) ? preprocessing.headerLabels
        .filter((label) => typeof label === 'string') : undefined;
    const factory = () => {
        const head = clean ? createCommunityHeaderCleaner(headerLabels) : { push: (text) => text, finish: () => '' };
        const restore = sanitizer.createReverseStream();
        return { push: text => restore.push(head.push(text)), finish: () => restore.push(head.finish()) + restore.finish() };
    };
    return { schemaVersion: 1, createTextTransform: factory, normalizeText(text) {
            const transform = factory();
            return transform.push(text) + transform.finish();
        }, recoverText(blocks) {
            if (!dream)
                return undefined;
            const extraction = object(configuration.reasoningExtraction);
            if (extraction.start_regex !== undefined && extraction.start_regex !== '^<dream_plot>')
                return undefined;
            if (extraction.end_regex !== undefined && extraction.end_regex !== '')
                return undefined;
            const reasoning = blocks.filter(block => block.type === 'reasoning').map(block => block.text ?? '').join('');
            return reasoning.startsWith('<dream_plot>') ? reasoning.trimEnd() : undefined;
        } };
}
