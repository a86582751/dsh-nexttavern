// Generated from runtime/alpha3/src/core/tavern-prompt-transform-execution.mts; edit the TypeScript source.
import { createTavernPromptTextKernelV1 } from './tavern-prompt-text-kernel.mjs';
import { createHash } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';
import { communityMacroLiteral, createCommunityMacroRandom } from './community-preset-macros.js';
import { recordSha256, stableJson, sha256 } from './roleplay-data.js';
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
const textKernel = createTavernPromptTextKernelV1({ recordSha256, stringifyYaml,
    createRandom: createCommunityMacroRandom, literal: communityMacroLiteral,
    cardOrder: TAVERN_PROMPT_CARD_ORDER_V1, postOrder: TAVERN_PROMPT_POST_ORDER_V1,
    instructOrder: TAVERN_PROMPT_INSTRUCT_ORDER_V1 });
export const hasTavernPromptMacroSyntaxV1 = textKernel.hasMacroSyntax;
export const tavernPromptRegexAppliesToChannelV1 = textKernel.appliesToChannel;
export const createTavernPromptMacroProjectorV1 = textKernel.createMacroProjector;
export const formatTavernPromptTextV1 = textKernel.format;
export const compileTavernPromptRegexV1 = textKernel.compileRegex;
/** Regex trim uses the selected speaker. Explicit names belong to the message
 * version; absent names retain their actual captured persona/card fallback. */
export function captureTavernMessageMacrosV1(macros, message) {
    const fallback = message.nameSource === 'user' ? macros.names.user :
        message.nameSource === 'character' ? macros.names.char : undefined, read = fallback?.read ?? {
        kind: 'variable', purpose: 'read', scope: 'message', ownerId: message.messageId, key: 'name', present: true,
        versionSha256: message.messageVersionSha256, valueSha256: recordSha256(message.name), entryId: null, sourcePointer: null
    }, name = { key: 'char', value: message.name, valueSha256: sha256(message.name), read };
    return { ...macros, characterOverrides: [{ name: message.name, names: { ...macros.names, char: name } }] };
}
export function countInputChars(input) {
    if (typeof input === 'string')
        return input.length;
    if (!input || typeof input !== 'object')
        return 0;
    return Object.entries(input).reduce((sum, [key, value]) => sum + key.length + countInputChars(value), 0);
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
    const sanitizeRegexMacro = textKernel.sanitizeRegexMacro;
    const compile = (source) => {
        limit('patternChars', source.length);
        return textKernel.compileRegex(source);
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
    const eligible = (current, text) => textKernel.regexSkipReason(current, text, entry, input.regexDisabled);
    const filter = (text, current) => textKernel.trimCapture(text, current, value => macros(value, trimNames()), replace, job);
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
            const trim = current.trimStrings.length ? (capture) => filter(capture, current) : undefined;
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
                    const value = textKernel.captureValue(token, m, result, trim, issue);
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
