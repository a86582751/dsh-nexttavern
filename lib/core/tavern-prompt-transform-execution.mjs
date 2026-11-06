// Generated from runtime/alpha3/src/core/tavern-prompt-transform-execution.mts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';
import { communityMacroLiteral, createCommunityMacroRandom } from './community-preset-macros.js';
import { recordSha256, sha256, stableJson } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { createTavernPromptTransformOutputV1 } from './tavern-prompt-transform-output.mjs';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as LIMITS, TAVERN_PROMPT_POST_ORDER_V1, TAVERN_PROMPT_CARD_ORDER_V1, TAVERN_PROMPT_INSTRUCT_ORDER_V1 } from './tavern-prompt-transform-types.mjs';
const legacyAliases = [['<USER>', 'user'], ['<BOT>', 'char'], ['<CHAR>', 'char'],
    ['<CHARIFNOTGROUP>', 'group'], ['<GROUP>', 'group']];
/** Negative syntax test shares the literal alias grammar with execution. */
export function hasTavernPromptMacroSyntaxV1(text) {
    if (text.includes('{{'))
        return true;
    const lower = text.toLowerCase();
    return legacyAliases.some(([pattern]) => lower.includes(pattern.toLowerCase()));
}
/** Channel applicability is independent of the current text and rule order. */
export function tavernPromptRegexAppliesToChannelV1(rule, channel) {
    return channel === 'display' ? rule.markdownOnly : channel === 'prompt' ? rule.promptOnly :
        !rule.markdownOnly && !rule.promptOnly;
}
class Refusal extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Macro ordering, entropy and bounded replacements have one implementation.
 * The owning transform or EJS host retains its own read and work budgets. */
export function createTavernPromptMacroProjectorV1(macro, deps) {
    const { issue, recordRead, budget } = deps, { job, work } = budget;
    const random = macro.random ? createCommunityMacroRandom(macro.random.seed, macro.random.pickSeed) : null;
    const deferredMacros = new Set(macro.deferredMacros ?? []);
    const namedOutletsDeferred = macro.deferredMacroFamilies?.includes('ejs-named-queue-outlet') === true;
    const collect = (binding) => {
        if (binding.key === 'model' && binding.value === null)
            issue('PROMPT_TRANSFORM_BINDING_MISSING', 'model');
        recordRead(binding.read);
        return binding.value ?? '';
    };
    const helperScope = (scopeName) => macro.variableScopes?.[scopeName] ?? null;
    const helperVariable = (scopeName, path, token) => {
        const scope = helperScope(scopeName);
        if (!scope) {
            issue('PROMPT_TRANSFORM_BINDING_MISSING', token);
            return null;
        }
        const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
        const key = path.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => entities[entity]);
        const parts = [];
        if (Object.hasOwn(scope.values, key))
            parts.push(key);
        else {
            if (key.startsWith('.'))
                parts.push('');
            key.replace(/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, (part, number, quote, quoted) => {
                parts.push(quote ? quoted.replace(/\\(\\)?/g, '$1') : number ?? part);
                return part;
            });
        }
        let value = parts.length ? scope.values : null, present = parts.length > 0;
        for (const part of parts) {
            if (value === null || !Object.hasOwn(Object(value), part)) {
                present = false;
                value = null;
                break;
            }
            value = Object(value)[part];
        }
        recordRead({ kind: 'variable', purpose: 'read', scope: scope.scope, ownerId: scope.ownerId, key, present,
            versionSha256: scope.versionSha256, valueSha256: present ? recordSha256(value) : null, entryId: null, sourcePointer: null });
        // JS-Slash-Runner removes private keys only within the selected subtree;
        // arrays (including [value, description]) remain ordinary authored data.
        const withoutPrivate = (item) => {
            if (Array.isArray(item))
                return item.map(withoutPrivate);
            if (item && typeof item === 'object')
                return Object.fromEntries(Object.entries(item)
                    .filter(([name]) => !name.startsWith('$')).map(([name, child]) => [name, withoutPrivate(child)]));
            return item;
        };
        return withoutPrivate(value);
    };
    const env = (override) => {
        const values = [];
        const merge = (binding) => {
            const index = values.findIndex(v => v.key === binding.key);
            if (index < 0)
                values.push(binding);
            else
                values[index] = binding;
        };
        if (macro.card)
            for (const name of TAVERN_PROMPT_CARD_ORDER_V1)
                merge(macro.card.find(b => b.key === name));
        const n = override ?? macro.names;
        for (const name of ['user', 'char', 'charIfNotGroup', 'group', 'groupNotMuted', 'notChar', 'model'])
            merge(n[name]);
        // Object.assign and registered macro population replace in place while
        // preserving the original insertion position of an existing name.
        for (const row of macro.dynamic)
            merge(row);
        for (const row of macro.registered)
            merge(row);
        return values;
    };
    const baseEnv = env(null);
    const advance = (regex, text) => {
        const i = regex.lastIndex;
        regex.lastIndex = i + (regex.unicode && i < text.length && (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1);
    };
    /** Own every exec and output chunk. No native replace constructs an unbounded
     * result before its cap; empty global matches advance by actual UTF-16 width. */
    const replace = (text, regex, callback, untrusted = false) => {
        work(text.length);
        regex.lastIndex = 0;
        let cursor = 0, size = 0;
        const parts = [];
        const add = (part) => {
            size += part.length;
            budget.output(size);
            work(part.length);
            parts.push(part);
        };
        for (;;) {
            const m = regex.exec(text);
            if (!m) {
                // A zero-match scan already owns its input work. Reuse the exact
                // string instead of rebuilding and charging an unchanged output.
                if (parts.length === 0) {
                    budget.output(text.length);
                    return text;
                }
                break;
            }
            job();
            if (untrusted)
                budget.match();
            add(text.slice(cursor, m.index));
            add(callback(m));
            cursor = m.index + m[0].length;
            if (!regex.global)
                break;
            if (!m[0].length)
                advance(regex, text);
        }
        add(text.slice(cursor));
        return parts.join('');
    };
    const recognized = (token, environment) => {
        const name = token.toLowerCase();
        return environment.some(b => b.key.toLowerCase() === name) || TAVERN_PROMPT_POST_ORDER_V1.some(n => n.toLowerCase() === name)
            || TAVERN_PROMPT_INSTRUCT_ORDER_V1.some(n => n.toLowerCase().split('|').includes(name))
            || ['newline', 'trim', 'noop', 'space', 'input'].includes(name)
            || /^(getvar|getglobalvar|outlet)::.+$/.test(name) || /^reverse:.+$/.test(name) || name.startsWith('//')
            || /^(get|format)_(message|chat|character|preset|global)_variable::/.test(name);
    };
    const macros = (text, override = null, post = value => value, trace) => {
        let offset = 0;
        let spans = trace ? trace.parts.filter(part => part.text.length || part.origin.kind !== 'literal').map(part => {
            const span = { length: part.text.length, source: 0, offset, display: part.origin };
            offset += part.text.length;
            return span;
        }) : [{ length: text.length, source: 0, offset: 0 }];
        const finish = (value) => {
            if (trace) {
                let cursor = 0;
                const parts = [];
                for (const span of spans) {
                    const origin = span.display, text = value.slice(cursor, cursor + span.length);
                    cursor += span.length;
                    const part = origin.kind === 'macro' ? { ...origin, text } : { kind: origin.kind, text };
                    const prior = parts.at(-1);
                    if (prior && prior.kind === part.kind && (part.kind !== 'macro' || prior.kind === 'macro'
                        && prior.sourceSpan.start === part.sourceSpan.start && prior.sourceSpan.end === part.sourceSpan.end))
                        parts[parts.length - 1] = { ...prior, text: prior.text + text };
                    else
                        parts.push(part);
                }
                trace.complete(parts);
            }
            return value;
        };
        if (!text)
            return finish('');
        if (macro.engine !== 'legacy') {
            issue('PROMPT_TRANSFORM_MACRO_ENGINE_UNSUPPORTED', 'experimental');
            return finish(text);
        }
        if (!text.includes('<') && !text.includes('{{'))
            return finish(text);
        const environment = override ? env(override) : baseEnv;
        const get = (key) => environment.find(b => b.key === key);
        let result = text;
        let matchedOrigin = 0;
        /** Preserve copied UTF-16 spans. Insertions carry their source location as
         * a structured path, so an injected pick cannot steal a literal's offset.
         * Tracking runs only for captured entropy or opt-in display provenance. */
        const substitute = (current, regex, callback) => {
            if (!random && !trace)
                return replace(current, regex, callback);
            const next = [];
            let cursor = 0, index = 0, start = 0, changed = false;
            const append = (span) => {
                if (!span.length && (!trace || span.display?.kind === 'literal'))
                    return;
                const previous = next.at(-1);
                if (!trace && previous && previous.source === span.source && previous.offset + previous.length === span.offset)
                    previous.length += span.length;
                else
                    next.push(span);
            };
            const consume = (end, copy, boundary = true) => {
                while (cursor < end || boundary && spans[index]?.length === 0) {
                    const span = spans[index], inside = cursor - start, length = Math.min(end - cursor, span.length - inside);
                    // Empty DATA is still a boundary between Source fragments. Keep its
                    // provenance when a later replacement consumes surrounding text.
                    if (copy || span.length === 0)
                        append({ length, source: span.source, offset: span.offset + inside,
                            ...trace ? { display: span.display.kind === 'literal'
                                    ? { kind: 'literal', start: span.display.start + inside } : span.display } : {} });
                    cursor += length;
                    if (cursor === start + span.length) {
                        start = cursor;
                        index++;
                    }
                }
            };
            const output = replace(current, regex, m => {
                changed = true;
                consume(m.index, true);
                const span = spans[index], inside = m.index - start;
                matchedOrigin = typeof span.source === 'number' ? span.source + span.offset + inside :
                    [...span.source, span.offset + inside];
                let display;
                if (trace) {
                    let position = m.index, partIndex = index, partStart = start, sourceStart, sourceEnd = 0;
                    let root, captured = false;
                    while (position < m.index + m[0].length) {
                        const part = spans[partIndex], origin = part.display, within = position - partStart, length = Math.min(m.index + m[0].length - position, part.length - within);
                        if (!part.length) {
                            captured = true;
                            partIndex++;
                            continue;
                        }
                        if (origin.kind === 'capture')
                            captured = true;
                        else if (origin.kind === 'macro') {
                            if (sourceStart !== undefined || root && root !== origin)
                                captured = true;
                            root = origin;
                        }
                        else {
                            const from = origin.start + within;
                            if (root || sourceStart !== undefined && from !== sourceEnd)
                                captured = true;
                            sourceStart ??= from;
                            sourceEnd = from + length;
                        }
                        position += length;
                        partStart += part.length;
                        partIndex++;
                    }
                    if (captured || sourceStart === undefined && !root)
                        display = { kind: 'capture' };
                    else if (root)
                        display = root;
                    else {
                        const tokenStart = m[0].indexOf('{{'), tokenEnd = m[0].lastIndexOf('}}');
                        const from = sourceStart + (tokenStart < 0 ? 0 : tokenStart), end = tokenStart < 0 ? sourceEnd : sourceStart + tokenEnd + 2;
                        display = { kind: 'macro', sourceText: trace.sourceText.slice(from, end), sourceSpan: { start: from, end } };
                    }
                }
                const replacement = callback(m);
                const copiedStart = next.length;
                consume(m.index + m[0].length, replacement === m[0], false);
                if (trace && replacement === m[0])
                    for (let i = copiedStart; i < next.length; i++)
                        if (next[i].length)
                            next[i].display = display;
                if (replacement !== m[0])
                    append({ length: replacement.length,
                        source: typeof matchedOrigin === 'number' ? [matchedOrigin] : matchedOrigin, offset: 0, ...trace ? { display } : {} });
                return replacement;
            });
            if (changed) {
                consume(current.length, true);
                spans = next;
            }
            return output;
        };
        const fixed = (current, regex, binding, post, token) => substitute(current, regex, m => {
            if (!binding) {
                issue('PROMPT_TRANSFORM_BINDING_MISSING', token);
                return m[0];
            }
            return post(collect(binding));
        });
        let literalSource, literalText = '';
        const hasLiteral = (tokens) => {
            // Reuse only this stage's current text. Earlier substitutions can insert
            // later aliases, so a changed result always refreshes this derived value.
            if (literalSource !== result) {
                literalSource = result;
                literalText = result.toLowerCase();
            }
            return tokens.some(token => literalText.includes(token.toLowerCase()));
        };
        for (const [pattern, key] of legacyAliases) {
            if (hasLiteral([pattern]))
                result = fixed(result, new RegExp(pattern, 'gi'), get(key), post, key);
        }
        if (!result.includes('{{'))
            return finish(result);
        if (result.includes('{{'))
            result = substitute(result, /{{roll[ : ]([^}]+)}}/gi, m => {
                if (!random) {
                    issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                    return m[0];
                }
                try {
                    return post(random.roll(m[1]));
                }
                catch {
                    issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                    return m[0];
                }
            });
        for (const key of TAVERN_PROMPT_INSTRUCT_ORDER_V1) {
            if (!result.includes('{{'))
                break;
            if (!hasLiteral(key.split('|').map(alias => `{{${alias}}}`)))
                continue;
            result = fixed(result, new RegExp('{{(' + key + ')}}', 'gi'), macro.instruct.find(b => b.key === key), post, key);
        }
        // Read-only subset of getVariableMacros in its real pre-env position.
        // Mutation macros and clock/random command forms have no side effects here.
        if (result.includes('{{'))
            replace(result, /{{(?:setvar|addvar|incvar|decvar|setglobalvar|addglobalvar|incglobalvar|decglobalvar)::[^}]*}}/gi, m => {
                issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                return m[0];
            });
        for (const [name, bindings] of [['getvar', macro.localVariables], ['getglobalvar', macro.globalVariables]]) {
            if (result.includes('{{'))
                result = substitute(result, new RegExp('{{' + name + '::([^}]+)}}', 'gi'), m => {
                    const key = m[1].trim(), resolved = deps.variable?.(name === 'getvar' ? 'chat' : 'global', key);
                    if (resolved !== undefined)
                        return post(resolved.value);
                    const binding = bindings.find(b => b.key === key);
                    if (!binding) {
                        issue('PROMPT_TRANSFORM_BINDING_MISSING', m[0]);
                        return m[0];
                    }
                    return post(collect(binding));
                });
        }
        if (result.includes('{{'))
            result = substitute(result, /{{(?:newline|space)}}/gi, m => post(communityMacroLiteral(m[0].slice(2, -2))));
        if (result.includes('{{'))
            result = substitute(result, /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, () => post(''));
        if (result.includes('{{'))
            result = substitute(result, /{{noop}}/gi, m => post(communityMacroLiteral(m[0].slice(2, -2))));
        if (hasLiteral(['{{input}}']))
            result = fixed(result, /{{input}}/gi, macro.input, post, 'input');
        for (const row of environment) {
            if (!result.includes('{{'))
                break;
            // Arbitrary registered Unicode keys retain the exact non-u /i matching
            // relation; lowercase literal lookup is equivalent only for ASCII keys.
            if (!/[^\x00-\x7f]/.test(row.key) && !hasLiteral([`{{${row.key}}}`]))
                continue;
            result = fixed(result, new RegExp('{{' + escape(row.key) + '}}', 'gi'), row, post, row.key);
        }
        // Reverse/comment occur between the ID aliases and clock aliases in ST.
        const postValue = (name) => {
            if (hasLiteral([`{{${name}}}`]))
                result = fixed(result, new RegExp('{{' + name + '}}', 'gi'), macro.post.find(b => b.key === name), post, name);
        };
        for (const name of TAVERN_PROMPT_POST_ORDER_V1.slice(0, 15))
            postValue(name);
        if (result.includes('{{'))
            result = substitute(result, /{{reverse:(.+?)}}/gi, m => post(communityMacroLiteral(m[0].slice(2, -2))));
        if (result.includes('{{'))
            result = substitute(result, /\{\{\/\/([\s\S]*?)\}\}/gm, () => post(''));
        for (const name of TAVERN_PROMPT_POST_ORDER_V1.slice(15))
            postValue(name);
        // Outlet strings are inserted only here, after all environment macros.
        // They are never recursively expanded and never appended automatically.
        if (result.includes('{{'))
            result = substitute(result, /{{outlet::(.+?)}}/gi, m => {
                const binding = macro.outlets.find(b => b.key === m[1].trim());
                if (!binding) {
                    issue('PROMPT_TRANSFORM_BINDING_MISSING', m[0]);
                    return m[0];
                }
                return post(collect(binding));
            });
        // ST random/pick run after outlets. Their seed is captured, never ambient.
        for (const name of ['random', 'pick']) {
            if (!hasLiteral(['{{' + name]))
                continue;
            if (result.includes('{{'))
                result = substitute(result, new RegExp('{{' + name + '\\s?::?([^}]+)}}', 'gi'), m => {
                    if (!random) {
                        issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                        return m[0];
                    }
                    return post(random.choose(m[1], text, matchedOrigin, name === 'pick'));
                });
        }
        // These helper macros run after ordinary ST substitution. Paths may be
        // introduced by an alias or regex, so the Worker reads the frozen owner
        // directly rather than requiring a pre-enumerated list of macro tokens.
        if (result.includes('{{'))
            result = substitute(result, /{{get_(message|chat|character|preset|global)_variable::(.*?)}}/gi, m => {
                const scope = m[1].toLowerCase();
                const value = helperVariable(scope, m[2], m[0]);
                return post(typeof value === 'string' ? value : JSON.stringify(value));
            });
        if (result.includes('{{')) {
            const before = result;
            let previousEnd = 0, prefix = '';
            result = substitute(before, /{{format_(message|chat|character|preset|global)_variable::(.*?)}}/gi, m => {
                const gap = before.slice(previousEnd, m.index), lineStart = Math.max(gap.lastIndexOf('\n'), gap.lastIndexOf('\r'), gap.lastIndexOf('\u2028'), gap.lastIndexOf('\u2029')) + 1;
                prefix = lineStart ? gap.slice(lineStart) : prefix + gap;
                const scope = m[1].toLowerCase();
                const value = helperVariable(scope, m[2], m[0]), formatted = typeof value === 'string' ? value :
                    stringifyYaml(value, { blockQuote: 'literal' }).trimEnd();
                const replacement = formatted.replaceAll('\n', '\n' + ' '.repeat(prefix.length));
                // Upstream's recursive prefix retains earlier formatted newlines on
                // the same original line; the next macro counts that complete prefix.
                prefix += replacement;
                previousEnd = m.index + m[0].length;
                return post(replacement);
            });
        }
        if (result.includes('{{'))
            replace(result, /{{([\s\S]*?)}}/g, m => {
                if (!recognized(m[1], environment) && !deferredMacros.has(m[1])
                    && !(namedOutletsDeferred && /^outletPromptsInjected:[^{}]+$/.test(m[1])))
                    issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                return m[0];
            });
        return finish(result);
    };
    return { project: macros, replace };
}
function run(data) {
    const { input } = data, macro = input.macros;
    let entry = null, rule = null;
    let jobs = 0, matches = 0, workChars = 0, outputChars = 0, compiledRules = 0, receiptCount = 0, receiptChars = 0;
    let reads = new Map();
    let diagnostics = [];
    const compiled = new Map();
    let ruleMetadata;
    let displayReplacements;
    const displayProvenance = [];
    let displaySeed;
    const diag = (code, token = null, limit = null) => ({
        schemaVersion: 1, code, entryKey: entry?.key ?? null, ruleId: rule?.id ?? null, macro: token, limit,
    });
    const limit = (field, observed) => {
        if (observed > LIMITS[field])
            throw new Refusal(diag('PROMPT_TRANSFORM_LIMIT', null, { field, observed, maximum: LIMITS[field] }));
    };
    const job = () => { limit('jobs', ++jobs); };
    const work = (n) => { workChars += n; limit('workChars', workChars); };
    const encodeFields = (fields) => {
        const chunks = [], metadata = ['{'];
        for (const [index, key] of [...fields.keys()].sort().entries()) {
            metadata.push((index ? ',' : '') + JSON.stringify(key) + ':');
            const encoded = fields.get(key);
            if (typeof encoded === 'string')
                metadata.push(encoded);
            else {
                chunks.push(metadata.join(''), encoded);
                metadata.length = 0;
            }
        }
        metadata.push('}');
        chunks.push(metadata.join(''));
        return chunks;
    };
    const receipt = (value, fields, metadata) => {
        limit('receipts', ++receiptCount);
        let serialized, chunks;
        let textEncodings;
        if (fields) {
            const record = value, rawJson = stableJson(record.rawText);
            const storyJson = record.storyText === record.rawText ? rawJson : stableJson(record.storyText);
            let inputJson = rawJson;
            if (record.inputText !== record.rawText)
                inputJson = record.inputText === record.storyText ? storyJson : stableJson(record.inputText);
            let outputJson = rawJson;
            if (record.outputText !== record.rawText) {
                if (record.outputText === record.storyText)
                    outputJson = storyJson;
                else if (record.outputText === record.inputText)
                    outputJson = inputJson;
                else
                    outputJson = stableJson(record.outputText);
            }
            textEncodings = [rawJson, storyJson, inputJson, outputJson];
            for (const [key, item] of Object.entries(record)) {
                if (item === undefined)
                    continue;
                let encoded;
                if (key === 'rawText')
                    encoded = rawJson;
                else if (key === 'storyText')
                    encoded = storyJson;
                else if (key === 'inputText')
                    encoded = inputJson;
                else if (key === 'outputText')
                    encoded = outputJson;
                else if (key === 'rules')
                    encoded = fields.get(key) ?? stableJson(item);
                else
                    encoded = stableJson(item);
                fields.set(key, encoded);
            }
            chunks = [];
            let metadata = ['{'];
            for (const [index, key] of [...fields.keys()].sort().entries()) {
                metadata.push((index ? ',' : '') + JSON.stringify(key) + ':');
                const encoded = fields.get(key);
                // Keep large text encodings shared, and join adjacent metadata so the
                // same canonical bytes need at most nine native hash writes per entry.
                if (key === 'rawText' || key === 'storyText' || key === 'inputText' || key === 'outputText') {
                    chunks.push(metadata.join(''), encoded);
                    metadata = [];
                }
                else
                    metadata.push(encoded);
            }
            metadata.push('}');
            chunks.push(metadata.join(''));
        }
        else if (metadata !== undefined) {
            const outcome = value;
            serialized = `{"matches":${outcome.matches},"reason":${JSON.stringify(outcome.reason)}`
                + metadata + JSON.stringify(outcome.status) + '}';
        }
        else
            serialized = JSON.stringify(value);
        // Charge every occurrence before hashing, even when text encodings alias.
        // Only the final sealed projection needs a complete allocated JSON string.
        receiptChars += chunks ? chunks.reduce((sum, chunk) => sum + chunk.length, 0) : serialized.length;
        limit('receiptChars', receiptChars);
        if (!chunks)
            return serialized;
        // The meter above charges every UTF-16 occurrence before allocating bytes.
        // Both hashes consume these complete JSON tokens, sharing their UTF-8 once.
        const [rawJson, storyJson, inputJson, outputJson] = textEncodings;
        const rawBytes = Buffer.from(rawJson, 'utf8');
        const storyBytes = storyJson === rawJson ? rawBytes : Buffer.from(storyJson, 'utf8');
        const inputBytes = inputJson === rawJson ? rawBytes :
            inputJson === storyJson ? storyBytes : Buffer.from(inputJson, 'utf8');
        const outputBytes = outputJson === rawJson ? rawBytes : outputJson === storyJson ? storyBytes :
            outputJson === inputJson ? inputBytes : Buffer.from(outputJson, 'utf8');
        fields.set('rawText', rawBytes);
        fields.set('storyText', storyBytes);
        fields.set('inputText', inputBytes);
        fields.set('outputText', outputBytes);
        // Text fields occur in this fixed lexical order between adjacent metadata.
        for (const [index, bytes] of [inputBytes, outputBytes, rawBytes, storyBytes].entries())
            chunks[index * 2 + 1] = bytes;
        const hash = createHash('sha256');
        for (const chunk of chunks) {
            if (typeof chunk === 'string')
                hash.update(chunk, 'utf8');
            else
                hash.update(chunk);
        }
        return hash.digest('hex');
    };
    const issue = (code, token = null) => {
        const value = diag(code, token);
        if (entry?.required)
            throw new Refusal(value);
        if (!diagnostics.some(d => d.code === code && d.macro === token && d.ruleId === value.ruleId)) {
            receipt(value);
            diagnostics.push(value);
        }
    };
    const recordRead = (read) => {
        const key = recordSha256(read);
        if (!reads.has(key)) {
            receipt(read);
            reads.set(key, read);
        }
    };
    const projectorDeps = { issue, recordRead, budget: { job, work,
            output: (chars) => limit('outputChars', chars), match: () => limit('matches', ++matches) } };
    const promptProjector = createTavernPromptMacroProjectorV1(macro, projectorDeps);
    let macros = promptProjector.project, replace = promptProjector.replace;
    const trimNames = () => entry?.characterOverride === null || !entry ? null :
        macro.characterOverrides.find(row => row.name === entry.characterOverride).names;
    const sanitizeRegexMacro = (text) => text.replace(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, s => {
        const controls = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\f': '\\f', '\0': '\\0' };
        return controls[s] ?? '\\' + s;
    });
    /** Fixed upstream regexFromString algorithm, including its flag fallback.
     * Only this worker parses/compiles third-party findRegex strings. */
    const compile = (source) => {
        limit('patternChars', source.length);
        try {
            const match = source.match(/(\/?)(.+)\1([a-z]*)/i);
            if (!match)
                return null;
            if (match[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(match[3]))
                return new RegExp(source);
            return new RegExp(match[2], match[3]);
        }
        catch {
            return null;
        }
    };
    const getCompiled = (current) => {
        const cacheKey = current.substituteRegex !== 0 && displaySeed !== undefined
            ? JSON.stringify([current.id, displaySeed]) : current.id;
        const cached = compiled.get(cacheKey);
        if (cached) {
            for (const dependency of cached.reads)
                reads.set(recordSha256(dependency), dependency);
            for (const diagnostic of cached.diagnostics)
                issue(diagnostic.code, diagnostic.macro);
            return cached;
        }
        const savedReads = reads, savedDiagnostics = diagnostics;
        reads = new Map();
        diagnostics = [];
        let value;
        try {
            const source = current.substituteRegex === 0 ? current.findRegex :
                macros(current.findRegex, null, current.substituteRegex === 2 ? sanitizeRegexMacro : undefined);
            const regex = diagnostics.length ? null : compile(source);
            if (!regex && !diagnostics.length)
                issue('PROMPT_TRANSFORM_REGEX_INVALID');
            value = { regex, reads: [...reads.values()], diagnostics: [...diagnostics] };
            if (regex)
                compiledRules++;
            compiled.set(cacheKey, value);
        }
        finally {
            reads = savedReads;
            diagnostics = savedDiagnostics;
        }
        for (const dependency of value.reads)
            reads.set(recordSha256(dependency), dependency);
        for (const diagnostic of value.diagnostics)
            issue(diagnostic.code, diagnostic.macro);
        return value;
    };
    const eligible = (current, text) => {
        if (input.regexDisabled)
            return 'regex-disabled';
        if (!current.allowed)
            return 'not-allowed';
        if (current.disabled)
            return 'disabled';
        if (!text)
            return 'empty-input';
        if (!tavernPromptRegexAppliesToChannelV1(current, entry.channel))
            return 'channel';
        if (entry.isEdit && !current.runOnEdit)
            return 'edit';
        if (entry.depth !== null) {
            if (current.minDepth !== null && current.minDepth >= -1 && entry.depth < current.minDepth)
                return 'min-depth';
            if (current.maxDepth !== null && current.maxDepth >= 0 && entry.depth > current.maxDepth)
                return 'max-depth';
        }
        if (!current.placement.includes(entry.placement))
            return 'placement';
        if (!current.findRegex)
            return 'empty-find';
        return null;
    };
    const filter = (text, current) => {
        let result = text;
        for (const trim of current.trimStrings) {
            job();
            const sub = macros(trim, trimNames());
            // ST replaceAll(literal, '') includes JS's empty-string behavior (no-op).
            if (sub)
                result = replace(result, new RegExp(escape(sub), 'g'), () => '');
        }
        return result;
    };
    const regexStage = (text, receipts, encodings) => {
        let result = text;
        // Immutable rule identity belongs to this batch. Encode it only when a
        // regex stage runs; each outcome's canonical DATA then serves both charges.
        ruleMetadata ??= input.rules.map(current => `,"ruleId":${JSON.stringify(current.id)}`
            + `,"sourcePointer":${JSON.stringify(current.sourcePointer)},"status":`);
        for (const [index, current] of input.rules.entries()) {
            const add = (value) => {
                encodings.push(receipt(value, undefined, ruleMetadata[index]));
                receipts.push(value);
            };
            rule = current;
            job();
            const skip = eligible(current, result);
            if (skip) {
                add({ ruleId: current.id, sourcePointer: current.sourcePointer,
                    status: 'skipped', reason: skip, matches: 0 });
                continue;
            }
            const c = getCompiled(current);
            if (!c.regex) {
                add({ ruleId: current.id, sourcePointer: current.sourcePointer,
                    status: 'deferred', reason: c.diagnostics[0]?.code ?? 'PROMPT_TRANSFORM_REGEX_INVALID', matches: 0 });
                continue;
            }
            const before = matches;
            let replacement;
            const replacementSpans = [];
            const original = result, prior = displayReplacements, next = [];
            let cursor = 0, outputCursor = 0;
            const unchanged = (end) => {
                if (prior)
                    for (const item of prior)
                        if (item.start >= cursor && item.end <= end)
                            next.push({ ...item, start: item.start + outputCursor - cursor, end: item.end + outputCursor - cursor });
                outputCursor += end - cursor;
            };
            result = replace(original, c.regex, m => {
                if (prior)
                    unchanged(m.index);
                // A template cannot consume output or substitution work until a match.
                if (replacement === undefined) {
                    if (prior) {
                        const chunks = [];
                        let sourceCursor = 0, normalizedCursor = 0;
                        const append = (text, sourceStart) => {
                            chunks.push(text);
                            replacementSpans.push({ start: normalizedCursor, end: normalizedCursor + text.length, sourceStart });
                            normalizedCursor += text.length;
                        };
                        for (const token of current.replaceString.matchAll(/{{match}}/gi)) {
                            append(current.replaceString.slice(sourceCursor, token.index), sourceCursor);
                            append('$0', token.index);
                            sourceCursor = token.index + token[0].length;
                        }
                        append(current.replaceString.slice(sourceCursor), sourceCursor);
                        replacement = chunks.join('');
                    }
                    else
                        replacement = current.replaceString.replace(/{{match}}/gi, '$0');
                }
                const initialParts = [];
                let replacementSpanCursor = 0;
                const literal = (start, end) => {
                    while (replacementSpanCursor < replacementSpans.length && replacementSpans[replacementSpanCursor].end <= start)
                        replacementSpanCursor++;
                    for (let i = replacementSpanCursor; i < replacementSpans.length; i++) {
                        const span = replacementSpans[i];
                        if (span.start >= end)
                            break;
                        const from = Math.max(start, span.start), to = Math.min(end, span.end);
                        if (from < to)
                            initialParts.push({ text: replacement.slice(from, to),
                                origin: { kind: 'literal', start: span.sourceStart + from - span.start } });
                    }
                };
                let templateCursor = 0;
                const substituted = replace(replacement, /\$(\d+)|\$<([^>]+)>/g, token => {
                    let capture;
                    if (token[1]) {
                        const n = Number(token[1]);
                        // ST's callback arguments also expose offset/input/groups. Preserve
                        // string and falsey cases; a truthy number/object would throw in its
                        // trim helper and receives an explicit domain refusal here.
                        if (n < m.length)
                            capture = m[n];
                        else if (n === m.length)
                            capture = m.index;
                        else if (n === m.length + 1)
                            capture = result;
                        else if (n === m.length + 2 && m.groups)
                            capture = m.groups;
                    }
                    else
                        capture = m.groups?.[token[2]];
                    const value = !capture ? '' : typeof capture === 'string' ? filter(capture, current) : token[0];
                    if (capture && typeof capture !== 'string')
                        issue('PROMPT_TRANSFORM_CAPTURE_UNSUPPORTED', token[0]);
                    if (prior) {
                        literal(templateCursor, token.index);
                        initialParts.push({ text: value, origin: { kind: 'capture' } });
                        templateCursor = token.index + token[0].length;
                    }
                    return value;
                });
                let parts = [];
                if (prior)
                    literal(templateCursor, replacement.length);
                const value = macros(substituted, null, undefined, prior ? { sourceText: current.replaceString, parts: initialParts,
                    complete: value => { parts = value; } } : undefined);
                if (prior) {
                    next.push({ ruleId: current.id,
                        sourcePointer: current.sourcePointer, sourceSnapshotSha256: current.sourceSnapshotSha256,
                        start: outputCursor, end: outputCursor + value.length, parts });
                    outputCursor += value.length;
                    cursor = m.index + m[0].length;
                }
                return value;
            }, true);
            if (prior) {
                unchanged(original.length);
                displayReplacements = next;
            }
            add({ ruleId: current.id, sourcePointer: current.sourcePointer, status: 'applied', reason: null, matches: matches - before });
        }
        rule = null;
        return result;
    };
    const outputs = [];
    const canonicalEntries = [];
    for (const current of input.entries) {
        entry = current;
        rule = null;
        reads = new Map();
        diagnostics = [];
        job();
        displayReplacements = data.displayProvenance && current.channel === 'display' && current.pipeline === 'regex-only' ? [] : undefined;
        let text = current.inputText;
        const rawSha256 = schemaTextSha256(current.rawText);
        // Reader entries retain their Source and Native message version identity.
        // A separate display stream makes paging/order irrelevant to that message;
        // prompt entries keep their existing shared captured-attempt stream.
        displaySeed = current.channel === 'display' && macro.random
            ? recordSha256({ seed: macro.random.seed, key: current.key, rawSha256 }) : undefined;
        const projector = displaySeed !== undefined ? createTavernPromptMacroProjectorV1({ ...macro,
            random: { ...macro.random, seed: displaySeed } }, projectorDeps) : promptProjector;
        macros = projector.project;
        replace = projector.replace;
        const storySha256 = current.storyText === current.rawText ? rawSha256 : schemaTextSha256(current.storyText);
        const inputSha256 = current.inputText === current.rawText ? rawSha256 :
            current.inputText === current.storyText ? storySha256 : schemaTextSha256(current.inputText);
        let textSha256 = inputSha256;
        const stages = [], receipts = [], ruleEncodings = [];
        const stage = (kind) => {
            const before = text, beforeSha256 = textSha256;
            text = kind === 'macro' ? macros(text) : regexStage(text, receipts, ruleEncodings);
            if (text !== before)
                textSha256 = schemaTextSha256(text);
            stages.push({ stage: kind, inputSha256: beforeSha256, outputSha256: textSha256 });
        };
        if (current.pipeline === 'macro-only')
            stage('macro');
        else if (current.pipeline === 'regex-only')
            stage('regex');
        else if (current.pipeline === 'macro-then-regex') {
            stage('macro');
            stage('regex');
        }
        else {
            stage('regex');
            stage('macro');
        }
        outputChars += text.length;
        limit('outputChars', outputChars);
        const projection = { ...current, schemaVersion: 1, encoding: 'owned-tavern-prompt-projection-v1',
            authority: 'consumer-data-only', batchInputSha256: data.inputSha256, policySha256: data.policySha256,
            rawSha256, storySha256, inputSha256,
            outputText: text, outputSha256: textSha256, stages, rules: receipts,
            readDependencies: [...reads.values()], deferredDiagnostics: diagnostics };
        // Count the original projection receipt once. Reuse each field's encoding
        // when adding its hash and sealing the whole batch in the same invocation.
        const fields = new Map([['rules', '[' + ruleEncodings.join(',') + ']']]);
        const projectionSha256 = receipt(projection, fields);
        fields.set('projectionSha256', stableJson(projectionSha256));
        canonicalEntries.push(encodeFields(fields));
        outputs.push({ ...projection, projectionSha256 });
        if (displayReplacements)
            displayProvenance.push({ entryKey: current.key, replacements: displayReplacements });
    }
    const result = createTavernPromptTransformOutputV1(data, outputs, {
        outputChars, workChars, jobs, matches, compiledRules, receipts: receiptCount, receiptChars,
    }, canonicalEntries);
    return result.kind === 'transformed' && data.displayProvenance ? { ...result, displayProvenance } : result;
}
export function executeTavernPromptTransformsV1(data) {
    try {
        return run(data);
    }
    catch (error) {
        const diagnostic = error instanceof Refusal ? error.diagnostic : { schemaVersion: 1,
            code: 'PROMPT_TRANSFORM_WORKER', entryKey: null, ruleId: null, macro: null, limit: null };
        return { kind: 'refused', diagnostics: [diagnostic] };
    }
}
