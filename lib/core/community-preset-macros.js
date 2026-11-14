// Generated from runtime/alpha3/src/core/community-preset-macros.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
const stringify = (value) => value == null ? '' : typeof value === 'string' ? value :
    typeof value === 'object' ? JSON.stringify(value) : String(value);
const numeric = (value) => Number(value ?? 0) || 0;
/** Common inert primitives. Callers retain ordering, scope writes and snapshots. */
export function communityMacroLiteral(body) {
    const name = body.toLowerCase();
    if (name === 'noop' || name === 'trim')
        return '';
    if (name === 'newline')
        return '\n';
    if (name === 'space')
        return ' ';
    if (name.startsWith('reverse:'))
        return Array.from(body.slice(body[8] === ':' ? 9 : 8)).reverse().join('');
    return undefined;
}
/** ST legacy list grammar: only comma lists trim, and escaped commas are data. */
export function communityMacroChoices(source) {
    return source.includes('::') ? source.split('::') :
        source.replace(/\\,/g, '\u0000').split(',').map(value => value.trim().replaceAll('\u0000', ','));
}
/** Entropy belongs to the captured attempt. Pick belongs to chat/content/offset
 * and never advances that stream. This is NextTavern's replayable RNG, not
 * bit-for-bit seedrandom emulation of ST's browser entropy. */
export function createCommunityMacroRandom(seed, pickSeed = seed) {
    let ordinal = 0;
    const random = () => createHash('sha256').update(`${seed}:${ordinal++}`).digest().readUInt32LE(0) / 0x1_0000_0000;
    return { random,
        /** Fixed lodash numeric-range semantics using this same captured stream.
         * Source selection supplies its compiled finite numeric bounds. */
        range(lower, upper) {
            if (lower > upper)
                [lower, upper] = [upper, lower];
            const draw = random();
            return lower % 1 || upper % 1
                ? Math.min(lower + draw * (upper - lower + Number.parseFloat('1e-' + (String(draw).length - 1))), upper)
                : lower + Math.floor(draw * (upper - lower + 1));
        },
        choose(source, rawText, offset, pick) {
            const values = communityMacroChoices(source);
            const draw = pick ? createHash('sha256').update(JSON.stringify([pickSeed, rawText, offset]))
                .digest().readUInt32LE(0) / 0x1_0000_0000 : random();
            return values[Math.floor(draw * values.length)] ?? '';
        },
        roll(source) {
            let formula = source.trim().replace(/^::?/, '').trim();
            if (/^\d+$/.test(formula))
                formula = `1d${formula}`;
            const dice = /^(?:(\d+)\s*)?d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(formula);
            if (!dice)
                throw Error(`不支持的骰子表达式：${formula}`);
            const count = Number(dice[1] || 1), sides = Number(dice[2]);
            if (!Number.isSafeInteger(count) || count < 1 || count > 10_000 || !Number.isSafeInteger(sides) || sides < 1)
                throw Error('骰子数量或面数无效');
            let sum = 0;
            for (let index = 0; index < count; index++)
                sum += Math.floor(random() * sides) + 1;
            if (dice[3])
                sum += (dice[3] === '-' ? -1 : 1) * Number(dice[4]);
            return String(sum);
        }, get draws() { return ordinal; } };
}
/** Local wall-clock aliases from a captured instant, never an implicit Date.now. */
export function communityMacroClock(clockEpochMs) {
    const date = new Date(clockEpochMs), pad = (value) => String(value).padStart(2, '0');
    return { time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
        isotime: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
        isodate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
}
/** A bounded syntax walk, not a JS evaluator. One evaluator is shared by the
 * ordered prompt list so assignments and random draws have one chronology. */
export function createCommunityMacroEvaluator(input) {
    const chat = input.ordinary ? {} : structuredClone(input.chat), global = structuredClone(input.global), writes = [];
    const random = createCommunityMacroRandom(input.seed, input.pickSeed);
    function variable(scope, key) {
        return scope === 'chat' && input.ordinary ? input.ordinary.read(key) : (scope === 'chat' ? chat : global)[key];
    }
    function write(scope, key, operation, value) {
        const values = scope === 'chat' ? chat : global;
        if (scope === 'chat' && input.ordinary)
            input.ordinary.apply([operation === 'delete'
                    ? { key, operation } : { key, operation, value }]);
        else if (operation === 'delete')
            delete values[key];
        else if (operation === 'add')
            values[key] = numeric(values[key]) + numeric(value);
        else if (operation === 'append')
            values[key] = stringify(values[key]) + stringify(value);
        else
            values[key] = value;
        writes.push({ scope, key, operation, value });
    }
    function evaluate(body, rawText, offset) {
        const divider = body.indexOf('::'), name = (divider < 0 ? body : body.slice(0, divider)).trim(), lower = name.toLowerCase();
        const argumentsText = divider < 0 ? '' : body.slice(divider + 2);
        const next = argumentsText.indexOf('::'), key = (next < 0 ? argumentsText : argumentsText.slice(0, next)).trim();
        const value = next < 0 ? '' : argumentsText.slice(next + 2);
        if (name.startsWith('//'))
            return '';
        const literal = communityMacroLiteral(body);
        if (literal !== undefined)
            return literal;
        if (['setvar', 'setglobalvar', 'addvar', 'addglobalvar', 'incvar', 'incglobalvar', 'decvar', 'decglobalvar', 'unsetvar', 'unsetglobalvar'].includes(lower)) {
            const scope = lower.includes('global') ? 'global' : 'chat';
            if (!key)
                throw Error(`社区宏 ${name} 缺少变量名`);
            const operation = lower.startsWith('unset') ? 'delete' : lower.startsWith('set') ? 'set' :
                lower.startsWith('add') && (!value.trim() || !Number.isFinite(Number(value))
                    || !Number.isFinite(Number(variable(scope, key) ?? 0))) ? 'append' : 'add';
            const assigned = lower.startsWith('inc') ? 1 : lower.startsWith('dec') ? -1 :
                operation === 'add' ? Number(value || 0) : value;
            write(scope, key, operation, assigned);
            return lower.startsWith('inc') || lower.startsWith('dec') ? stringify(variable(scope, key)) : '';
        }
        if (lower === 'getvar' || lower === 'getglobalvar')
            return stringify(variable(lower === 'getvar' ? 'chat' : 'global', key));
        if (lower === 'random' || lower === 'pick' || lower.startsWith('random:') || lower.startsWith('pick:')) {
            const source = lower.startsWith('random:') ? name.slice(7) : lower.startsWith('pick:') ? name.slice(5) : argumentsText;
            return random.choose(source, rawText, offset, lower.startsWith('pick'));
        }
        if (lower.startsWith('roll')) {
            return random.roll(lower === 'roll' ? argumentsText : body.slice(4));
        }
        if (lower === 'trim')
            return '';
        if (lower === 'newline')
            return '\n';
        if (lower === 'space')
            return ' ';
        if (lower === 'reverse')
            return [...argumentsText].reverse().join('');
        if (lower === 'outlet' || name === '压缩相邻消息') {
            if (Object.hasOwn(input.outlets ?? {}, key))
                return input.outlets[key];
            if (name === '压缩相邻消息')
                return '';
            throw Error(`未绑定提示词出口：${key}`);
        }
        if (['time', 'date', 'isodate', 'isotime', 'weekday'].includes(lower))
            return communityMacroClock(input.clockEpochMs)[lower];
        const alias = Object.keys(input.aliases).find(key => key.toLowerCase() === lower);
        if (alias !== undefined)
            return input.aliases[alias];
        // Kemini uses these exact braces as output-format notation, not variables.
        if (['思考内容', '正文内容', '可能要求的附加内容'].includes(name))
            return `{{${name}}}`;
        if (/^(?:MEMORY_|VECTOR_MEMORY)/i.test(name))
            throw Error(`此提示条目依赖尚未接入的外部记忆插件：${name}`);
        throw Error(`尚未支持的社区宏：${name}`);
    }
    function render(text, depth = 0) {
        if (depth > 128)
            throw Error('社区宏嵌套过深');
        let result = '', cursor = 0, trimNext = false;
        while (cursor < text.length) {
            let start = text.indexOf('{{', cursor);
            if (start < 0) {
                result += trimNext ? text.slice(cursor).replace(/^(?:\r?\n)*/, '') : text.slice(cursor);
                break;
            }
            // An extra literal opening brace precedes a normal macro in the simple
            // preset's shipped initializer ("{{{setvar::...}}"). Keep that literal.
            while (text[start + 2] === '{')
                start++;
            const literal = text.slice(cursor, start);
            result += trimNext ? literal.replace(/^(?:\r?\n)*/, '') : literal;
            trimNext = false;
            let nesting = 1, end = start + 2;
            while (end < text.length && nesting) {
                if (text.startsWith('{{', end)) {
                    nesting++;
                    end += 2;
                }
                else if (text.startsWith('}}', end)) {
                    nesting--;
                    end += 2;
                }
                else
                    end++;
            }
            if (nesting)
                throw Error('社区宏缺少结束括号');
            const rawBody = text.slice(start + 2, end - 2);
            // Comments are removed before descending: they never perform assignments.
            if (!rawBody.trimStart().startsWith('//')) {
                const body = render(rawBody, depth + 1);
                if (body.trim().toLowerCase() === 'trim') {
                    result = result.replace(/(?:\r?\n)*$/, '');
                    trimNext = true;
                }
                else
                    result += evaluate(body, text, start);
            }
            cursor = end;
        }
        return result;
    }
    return { render, get chat() { return input.ordinary?.values ?? chat; }, global, writes, get randomDraws() { return random.draws; } };
}
