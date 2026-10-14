// Generated from runtime/alpha3/src/core/tavern-prompt-transform-worker.mts; edit the TypeScript source.
import { parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { recordSha256, sha256, stableJson } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { createTavernPromptTransformOutputV1 } from './tavern-prompt-transform-output.mjs';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as LIMITS, TAVERN_PROMPT_POST_ORDER_V1, TAVERN_PROMPT_CARD_ORDER_V1, TAVERN_PROMPT_INSTRUCT_ORDER_V1 } from './tavern-prompt-transform-types.mjs';
class Refusal extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
function run(data) {
    const { input } = data, macro = input.macros;
    const deferredMacros = new Set(macro.deferredMacros ?? []);
    let entry = null, rule = null;
    let jobs = 0, matches = 0, workChars = 0, outputChars = 0, compiledRules = 0, receiptCount = 0, receiptChars = 0;
    let reads = new Map();
    let diagnostics = [];
    const compiled = new Map();
    let ruleMetadata;
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
    const collect = (binding) => {
        if (binding.key === 'model' && binding.value === null)
            issue('PROMPT_TRANSFORM_BINDING_MISSING', 'model');
        const key = recordSha256(binding.read);
        if (!reads.has(key)) {
            receipt(binding.read);
            reads.set(key, binding.read);
        }
        return binding.value ?? '';
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
    const trimNames = () => entry?.characterOverride === null || !entry ? null :
        macro.characterOverrides.find(row => row.name === entry.characterOverride).names;
    const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizeRegexMacro = (text) => text.replace(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, s => {
        const controls = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\f': '\\f', '\0': '\\0' };
        return controls[s] ?? '\\' + s;
    });
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
            limit('outputChars', size);
            work(part.length);
            parts.push(part);
        };
        for (;;) {
            const m = regex.exec(text);
            if (!m) {
                // A zero-match scan already owns its input work. Reuse the exact
                // string instead of rebuilding and charging an unchanged output.
                if (parts.length === 0) {
                    limit('outputChars', text.length);
                    return text;
                }
                break;
            }
            job();
            if (untrusted)
                limit('matches', ++matches);
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
    const fixed = (text, regex, binding, post, token) => replace(text, regex, m => {
        if (!binding) {
            issue('PROMPT_TRANSFORM_BINDING_MISSING', token);
            return m[0];
        }
        return post(collect(binding));
    });
    const recognized = (token, environment) => {
        const name = token.toLowerCase();
        return environment.some(b => b.key.toLowerCase() === name) || TAVERN_PROMPT_POST_ORDER_V1.some(n => n.toLowerCase() === name)
            || TAVERN_PROMPT_INSTRUCT_ORDER_V1.some(n => n.toLowerCase().split('|').includes(name))
            || ['newline', 'trim', 'noop', 'input'].includes(name)
            || /^(getvar|getglobalvar|outlet)::.+$/.test(name) || /^reverse:.+$/.test(name) || name.startsWith('//');
    };
    const macros = (text, override = null, post = value => value) => {
        if (!text)
            return '';
        if (macro.engine !== 'legacy') {
            issue('PROMPT_TRANSFORM_MACRO_ENGINE_UNSUPPORTED', 'experimental');
            return text;
        }
        if (!text.includes('<') && !text.includes('{{'))
            return text;
        const environment = override ? env(override) : baseEnv;
        const get = (key) => environment.find(b => b.key === key);
        let result = text;
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
        for (const [pattern, key] of [['<USER>', 'user'], ['<BOT>', 'char'], ['<CHAR>', 'char'],
            ['<CHARIFNOTGROUP>', 'group'], ['<GROUP>', 'group']]) {
            if (hasLiteral([pattern]))
                result = fixed(result, new RegExp(pattern, 'gi'), get(key), post, key);
        }
        if (!result.includes('{{'))
            return result;
        if (result.includes('{{'))
            replace(result, /{{roll[ : ]([^}]+)}}/gi, m => {
                issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                return m[0];
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
                result = replace(result, new RegExp('{{' + name + '::([^}]+)}}', 'gi'), m => {
                    const key = m[1].trim(), binding = bindings.find(b => b.key === key);
                    if (!binding) {
                        issue('PROMPT_TRANSFORM_BINDING_MISSING', m[0]);
                        return m[0];
                    }
                    return post(collect(binding));
                });
        }
        if (result.includes('{{'))
            result = replace(result, /{{newline}}/gi, () => post('\n'));
        if (result.includes('{{'))
            result = replace(result, /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, () => post(''));
        if (result.includes('{{'))
            result = replace(result, /{{noop}}/gi, () => post(''));
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
            result = replace(result, /{{reverse:(.+?)}}/gi, m => post(Array.from(m[1]).reverse().join('')));
        if (result.includes('{{'))
            result = replace(result, /\{\{\/\/([\s\S]*?)\}\}/gm, () => post(''));
        for (const name of TAVERN_PROMPT_POST_ORDER_V1.slice(15))
            postValue(name);
        // Outlet strings are inserted only here, after all environment macros.
        // They are never recursively expanded and never appended automatically.
        if (result.includes('{{'))
            result = replace(result, /{{outlet::(.+?)}}/gi, m => {
                const binding = macro.outlets.find(b => b.key === m[1].trim());
                if (!binding) {
                    issue('PROMPT_TRANSFORM_BINDING_MISSING', m[0]);
                    return m[0];
                }
                return post(collect(binding));
            });
        if (result.includes('{{'))
            replace(result, /{{([\s\S]*?)}}/g, m => {
                if (!recognized(m[1], environment) && !deferredMacros.has(m[1]))
                    issue('PROMPT_TRANSFORM_MACRO_UNSUPPORTED', m[0]);
                return m[0];
            });
        return result;
    };
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
        const cached = compiled.get(current.id);
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
            compiled.set(current.id, value);
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
        const isMarkdown = entry.channel === 'display', isPrompt = entry.channel === 'prompt';
        if (!((current.markdownOnly && isMarkdown) || (current.promptOnly && isPrompt)
            || (!current.markdownOnly && !current.promptOnly && !isMarkdown && !isPrompt)))
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
            result = replace(result, c.regex, m => {
                // A template cannot consume output or substitution work until a match.
                replacement ??= current.replaceString.replace(/{{match}}/gi, '$0');
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
                    if (!capture)
                        return '';
                    if (typeof capture !== 'string') {
                        issue('PROMPT_TRANSFORM_CAPTURE_UNSUPPORTED', token[0]);
                        return token[0];
                    }
                    return filter(capture, current);
                });
                return macros(substituted);
            }, true);
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
        let text = current.inputText;
        const rawSha256 = schemaTextSha256(current.rawText);
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
    }
    return createTavernPromptTransformOutputV1(data, outputs, {
        outputChars, workChars, jobs, matches, compiledRules, receipts: receiptCount, receiptChars,
    }, canonicalEntries);
}
try {
    const data = workerData, result = run(data);
    // Transport packing follows canonical receipt/hash construction. The three
    // originals remain owned by the bounded caller's admitted batch input.
    const message = data.projectionTransport === 'input-backed' && result.kind === 'transformed'
        ? { kind: 'transformed', output: { ...result.output, entries: result.output.entries.map(({ rawText: _rawText, storyText: _storyText, inputText: _inputText, ...projection }) => projection) } }
        : result;
    parentPort?.postMessage(message);
}
catch (error) {
    const diagnostic = error instanceof Refusal ? error.diagnostic : { schemaVersion: 1,
        code: 'PROMPT_TRANSFORM_WORKER', entryKey: null, ruleId: null, macro: null, limit: null };
    parentPort?.postMessage({ kind: 'refused', diagnostics: [diagnostic] });
}
