// Generated from runtime/alpha3/src/core/tavern-prompt-text-kernel.mts; edit the TypeScript source.
/** Self-contained so native author realms can receive this factory as source. */
export function createTavernPromptTextKernelV1(services) {
    const legacyAliases = [['<USER>', 'user'], ['<BOT>', 'char'], ['<CHAR>', 'char'],
        ['<CHARIFNOTGROUP>', 'group'], ['<GROUP>', 'group']];
    /** Negative syntax test shares the literal alias grammar with execution. */
    function hasTavernPromptMacroSyntaxV1(text) {
        if (text.includes('{{'))
            return true;
        const lower = text.toLowerCase();
        return legacyAliases.some(([pattern]) => lower.includes(pattern.toLowerCase()));
    }
    /** Channel applicability is independent of the current text and rule order. */
    function tavernPromptRegexAppliesToChannelV1(rule, channel) {
        return channel === 'display' ? rule.markdownOnly : channel === 'prompt' ? rule.promptOnly :
            !rule.markdownOnly && !rule.promptOnly;
    }
    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /** Macro ordering, entropy and bounded replacements have one implementation.
     * The owning transform or EJS host retains its own read and work budgets. */
    function createTavernPromptMacroProjectorV1(macro, deps) {
        const { issue, recordRead, budget } = deps, { job, work } = budget;
        const random = macro.random ? services.createRandom(macro.random.seed, macro.random.pickSeed) : null;
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
                versionSha256: scope.versionSha256, valueSha256: present ? services.recordSha256(value) : null, entryId: null, sourcePointer: null });
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
                for (const name of services.cardOrder)
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
            return environment.some(b => b.key.toLowerCase() === name) || services.postOrder.some(n => n.toLowerCase() === name)
                || services.instructOrder.some(n => n.toLowerCase().split('|').includes(name))
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
            for (const key of services.instructOrder) {
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
                result = substitute(result, /{{(?:newline|space)}}/gi, m => post(services.literal(m[0].slice(2, -2))));
            if (result.includes('{{'))
                result = substitute(result, /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, () => post(''));
            if (result.includes('{{'))
                result = substitute(result, /{{noop}}/gi, m => post(services.literal(m[0].slice(2, -2))));
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
            for (const name of services.postOrder.slice(0, 15))
                postValue(name);
            if (result.includes('{{'))
                result = substitute(result, /{{reverse:(.+?)}}/gi, m => post(services.literal(m[0].slice(2, -2))));
            if (result.includes('{{'))
                result = substitute(result, /\{\{\/\/([\s\S]*?)\}\}/gm, () => post(''));
            for (const name of services.postOrder.slice(15))
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
                let previousEnd = 0, prefix = deps.formatPrefix ?? '';
                result = substitute(before, /{{format_(message|chat|character|preset|global)_variable::(.*?)}}/gi, m => {
                    const gap = before.slice(previousEnd, m.index), lineStart = Math.max(gap.lastIndexOf('\n'), gap.lastIndexOf('\r'), gap.lastIndexOf('\u2028'), gap.lastIndexOf('\u2029')) + 1;
                    prefix = lineStart ? gap.slice(lineStart) : prefix + gap;
                    const scope = m[1].toLowerCase();
                    const value = helperVariable(scope, m[2], m[0]), formatted = typeof value === 'string' ? value :
                        services.stringifyYaml(value, { blockQuote: 'literal' }).trimEnd();
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
                    if (!macro.preserveUnknownMacros && !recognized(m[1], environment)
                        && !(namedOutletsDeferred && /^outletPromptsInjected:[^{}]+$/.test(m[1])))
                        issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                    return m[0];
                });
            return finish(result);
        };
        return { project: macros, replace };
    }
    function sanitizeRegexMacro(text) {
        return text.replace(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, character => {
            const controls = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\f': '\\f', '\0': '\\0' };
            return controls[character] ?? '\\' + character;
        });
    }
    function compileRegex(source) {
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
    }
    function regexSkipReason(current, text, entry, regexDisabled = false) {
        if (regexDisabled)
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
        return current.findRegex ? null : 'empty-find';
    }
    function trimCapture(text, current, project, replace, job) {
        let result = text;
        for (const trim of current.trimStrings) {
            job();
            const sub = project(trim);
            if (sub)
                result = replace(result, new RegExp(escape(sub), 'g'), () => '');
        }
        return result;
    }
    function captureValue(token, match, input, filter, issue) {
        // SillyTavern indexes the replacement callback arguments. An untrimmed
        // numeric offset is stringified by replaceAll, with offset zero treated as empty.
        let capture;
        if (token[1]) {
            const index = Number(token[1]);
            if (index < match.length)
                capture = match[index];
            else if (index === match.length)
                capture = match.index;
            else if (index === match.length + 1)
                capture = input;
            else if (index === match.length + 2 && match.groups)
                capture = match.groups;
        }
        else
            capture = match.groups?.[token[2]];
        if (!capture)
            return '';
        if (typeof capture === 'string')
            return filter ? filter(capture) : capture;
        if (typeof capture === 'number' && !filter)
            return String(capture);
        issue('PROMPT_TRANSFORM_CAPTURE_UNSUPPORTED', token[0]);
        return token[0];
    }
    function format(text, rules, macro, entry, deps, regexDisabled = false, options = {}) {
        let issueCount = 0;
        const issue = (code, token) => { issueCount++; deps.issue(code, token); }, projector = createTavernPromptMacroProjectorV1(macro, { ...deps, issue }), { project, replace } = projector, override = entry.characterOverride === null ? null :
            macro.characterOverrides.find(row => row.name === entry.characterOverride)?.names ?? null;
        let result = text;
        for (const rule of rules) {
            deps.budget.job();
            if (regexSkipReason(rule, result, entry, regexDisabled))
                continue;
            const before = issueCount, source = rule.substituteRegex === 0 ? rule.findRegex : project(rule.findRegex, null, rule.substituteRegex === 2 ? sanitizeRegexMacro : undefined);
            deps.pattern(source.length);
            const regex = issueCount === before ? (options.compileRegex ?? compileRegex)(source) : null;
            if (!regex) {
                if (issueCount === before)
                    issue('PROMPT_TRANSFORM_REGEX_INVALID');
                continue;
            }
            let replacement;
            const original = result, filter = rule.trimStrings.length
                ? (capture) => trimCapture(capture, rule, value => project(value, override), replace, deps.budget.job)
                : undefined;
            result = replace(original, regex, match => {
                if (replacement === undefined) {
                    deps.replacement(rule.replaceString.length);
                    replacement = rule.replaceString.replace(/{{match}}/gi, '$0');
                }
                const substituted = replace(replacement, /\$(\d+)|\$<([^>]+)>/g, token => captureValue(token, match, original, filter, issue));
                return project(substituted);
            }, true);
        }
        // The Native helper supplies character_name to its final substitution.
        // ST-Prompt-Template chat helpers use the default names at that same step.
        return project(result, options.finalNames === 'default' ? null : override);
    }
    return { createMacroProjector: createTavernPromptMacroProjectorV1, hasMacroSyntax: hasTavernPromptMacroSyntaxV1,
        appliesToChannel: tavernPromptRegexAppliesToChannelV1, sanitizeRegexMacro, compileRegex, regexSkipReason,
        trimCapture, captureValue, format, recordSha256: services.recordSha256 };
}
/** Shared entropy primitives preserve the same SHA-256/LE32 draws in each realm. */
export function createTavernPromptMacroPrimitivesV1(hashText) {
    const digestDraw = (text) => {
        const bytes = hashText(text);
        const value = (bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24) >>> 0;
        return value / 0x1_0000_0000;
    };
    /** Common inert primitives. Callers retain ordering, scope writes and snapshots. */
    function communityMacroLiteral(body) {
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
    function communityMacroChoices(source) {
        return source.includes('::') ? source.split('::') :
            source.replace(/\\,/g, '\u0000').split(',').map(value => value.trim().replaceAll('\u0000', ','));
    }
    /** Entropy belongs to the captured attempt. Pick belongs to chat/content/offset
     * and never advances that stream. This is NextTavern's replayable RNG, not
     * bit-for-bit seedrandom emulation of ST's browser entropy. */
    function createCommunityMacroRandom(seed, pickSeed = seed) {
        let ordinal = 0;
        const random = () => digestDraw(`${seed}:${ordinal++}`);
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
                const draw = pick ? digestDraw(JSON.stringify([pickSeed, rawText, offset])) : random();
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
    return { literal: communityMacroLiteral, choices: communityMacroChoices, createRandom: createCommunityMacroRandom };
}
