// Generated from runtime/alpha3/src/core/community-preset-static.ts; edit the TypeScript source.
/** A data-only reader, deliberately smaller than JavaScript: no calls, properties,
 * interpolation, operators or statements are evaluated. */
export function readCommunityStaticValue(source, start = 0, constants = {}) {
    let index = start;
    const space = () => {
        while (index < source.length) {
            if (/\s/.test(source[index])) {
                index++;
                continue;
            }
            if (source.startsWith('//', index)) {
                const end = source.indexOf('\n', index);
                index = end < 0 ? source.length : end + 1;
                continue;
            }
            if (source.startsWith('/*', index)) {
                const end = source.indexOf('*/', index + 2);
                if (end < 0)
                    throw Error('Unclosed static comment');
                index = end + 2;
                continue;
            }
            break;
        }
    };
    const string = () => {
        const quote = source[index++], parts = [];
        while (index < source.length) {
            const char = source[index++];
            if (char === quote)
                return parts.join('');
            if (quote === '`' && char === '$' && source[index] === '{')
                throw Error('Static templates cannot interpolate');
            if (char !== '\\') {
                parts.push(char);
                continue;
            }
            const escaped = source[index++];
            const table = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
            if (escaped === 'u' || escaped === 'x') {
                const count = escaped === 'u' ? 4 : 2, hex = source.slice(index, index + count);
                if (!new RegExp(`^[0-9a-f]{${count}}$`, 'i').test(hex))
                    throw Error('Invalid static escape');
                parts.push(String.fromCharCode(parseInt(hex, 16)));
                index += count;
            }
            else if (escaped === '\r') {
                if (source[index] === '\n')
                    index++;
            }
            else if (escaped !== '\n')
                parts.push(table[escaped] ?? escaped);
        }
        throw Error('Unclosed static string');
    };
    const value = () => {
        space();
        const char = source[index];
        if (char === '"' || char === "'" || char === '`')
            return string();
        if (char === '[') {
            index++;
            const result = [];
            space();
            while (source[index] !== ']') {
                result.push(value());
                space();
                if (source[index] !== ',')
                    break;
                index++;
                space();
            }
            if (source[index++] !== ']')
                throw Error('Invalid static array');
            return result;
        }
        if (char === '{') {
            index++;
            const result = {};
            space();
            while (source[index] !== '}') {
                let key;
                if (['"', "'", '`'].includes(source[index]))
                    key = string();
                else {
                    const match = /^[\w$]+/.exec(source.slice(index));
                    if (!match)
                        throw Error('Invalid static key');
                    key = match[0];
                    index += key.length;
                }
                space();
                if (source[index++] !== ':')
                    throw Error('Invalid static property');
                Object.defineProperty(result, key, { value: value(), enumerable: true, writable: true, configurable: true });
                space();
                if (source[index] !== ',')
                    break;
                index++;
                space();
            }
            if (source[index++] !== '}')
                throw Error('Invalid static object');
            return result;
        }
        const number = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(index));
        if (number) {
            index += number[0].length;
            return Number(number[0]);
        }
        const word = /^[\w$]+/.exec(source.slice(index));
        if (!word)
            throw Error('Not static data');
        index += word[0].length;
        if (word[0] === 'true')
            return true;
        if (word[0] === 'false')
            return false;
        if (word[0] === 'null')
            return null;
        if (Object.hasOwn(constants, word[0]))
            return constants[word[0]];
        throw Error(`Unknown static reference: ${word[0]}`);
    };
    return { value: value(), end: index };
}
export function extractCommunityStatic(source, names, constants = {}) {
    const result = {};
    for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(`\\bconst\\s+(${escaped}(?:\\$\\d+)?)\\s*=\\s*`).exec(source);
        if (!match)
            continue;
        try {
            const parsed = readCommunityStaticValue(source, match.index + match[0].length, { ...constants, ...result });
            result[name] = parsed.value;
            if (match[1] !== name)
                result[match[1]] = parsed.value;
        }
        catch { /* Unknown source expressions stay inert in the preserved original. */ }
    }
    return result;
}
