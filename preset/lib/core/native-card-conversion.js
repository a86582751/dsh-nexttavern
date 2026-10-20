// Generated from runtime/alpha3/src/core/native-card-conversion.ts; edit the TypeScript source.
/** Classification carries coordinates only. Author execution remains a single
 * preserved source; advanced projections never promote conditional lore. */
import { createHash } from 'node:crypto';
import { sourceLines, stableJson } from './card-export-projection.js';
import { nextTavernExecutionAuthorData } from './nexttavern-card.js';
/** Native 1.0 owns its explicit fields. Converted 1.1 also owns coordinates,
 * which can be reused only while their author source is unchanged. */
export function nativeCardConversionIsDeterministicV1(input) {
    if (input.classification)
        return true;
    if (!input.nativeAuthoring)
        return false;
    if (input.snapshot.document.spec_version === '1.0')
        return true;
    const stored = input.snapshot.document.data.compatibility?.classification;
    return stored?.sourceSha256 === input.snapshot.sourceSha256;
}
const ruleFields = ['core', 'plot', 'narrative', 'reply', 'style'];
const targets = new Set(['character', ...ruleFields, 'other']);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const pointerKey = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
// clusterSettings addresses converted characters by this exact identifier domain.
const characterIdentity = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
function freeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
/** The decoder owns document validation. Clone once so later editor mutations
 * cannot change the text or conditional metadata seen by an in-flight task. */
export function freezeNativeCardConversionV1(document) {
    const captured = structuredClone(document), data = nextTavernExecutionAuthorData(captured.data);
    const units = [];
    const add = (pointer, text, kind) => {
        units.push({ id: `source-${units.length + 1}`, pointer, text, sha256: sha256(text),
            lineCount: sourceLines(text).length, kind, atomic: text.includes('<%') });
    };
    data.cards.forEach((row, index) => add(`/data/compatibility/authorExecution/cards/${index}/content`, row.content, 'author'));
    for (const field of ruleFields)
        if (data.rules[field] !== undefined) {
            add(`/data/compatibility/authorExecution/rules/${field}`, data.rules[field], 'author');
        }
    data.worldbook.forEach((row, index) => add(`/data/worldbook/${index}/content`, row.content, 'worldbook'));
    const entries = data.character_book?.entries ?? [];
    for (const [key, entry] of Object.entries(entries))
        if (typeof entry.content === 'string') {
            add(`/data/character_book/entries/${pointerKey(key)}/content`, entry.content, 'worldbook');
        }
    // Our execution/classification containers are projections, not new author
    // input. Excluding them keeps conversion/re-export on the same source hash.
    const { authorExecution: _execution, classification: _classification, ...compatibility } = data.compatibility ?? {};
    // Opening materialization and live status/settings are not classification
    // inputs. Export carries their current values without paying to classify
    // unchanged character/rule text again after an opening choice.
    const { opening: _opening, status: _status, settings: _settings, ...classificationData } = data;
    const sourceSha256 = sha256(stableJson({ schemaVersion: 1, data: { ...classificationData, compatibility },
        sources: units.map(({ id, pointer, sha256 }) => ({ id, pointer, sha256 })) }));
    return freeze({ schemaVersion: 1, sourceSha256, document: captured, units });
}
function fields(value, allowed, message) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)))
        throw Error(message);
}
/** This is the model-output boundary: reject rewritten text and require every
 * source line exactly once. No normalization can repair a malformed response. */
export function validateNativeCardClassificationV1(snapshot, value) {
    fields(value, ['characters', 'assignments'], '原生卡分类只能返回人物与原文跨度');
    if (!Array.isArray(value.characters) || !Array.isArray(value.assignments))
        throw Error('原生卡分类缺少人物或跨度列表');
    const characters = [], ids = new Set();
    for (const character of value.characters) {
        fields(character, ['id', 'name', 'aliases'], '人物分类不能提供替代正文');
        if (!characterIdentity(character.id) || !nonempty(character.name) || ids.has(character.id)
            || character.aliases !== undefined && (!Array.isArray(character.aliases) || !character.aliases.every(nonempty))) {
            throw Error('原生卡人物身份或别名无效');
        }
        ids.add(character.id);
        characters.push({ id: character.id, name: character.name,
            ...character.aliases !== undefined ? { aliases: [...character.aliases] } : {} });
    }
    const units = new Map(snapshot.units.map(unit => [unit.id, unit]));
    const coverage = new Map(), assignments = [];
    for (const assignment of value.assignments) {
        fields(assignment, ['sourceId', 'startLine', 'endLine', 'target', 'characterId'], '跨度分类不能提供替代正文');
        const unit = typeof assignment.sourceId === 'string' ? units.get(assignment.sourceId) : undefined;
        if (!unit || !Number.isSafeInteger(assignment.startLine) || !Number.isSafeInteger(assignment.endLine)
            || assignment.startLine < 1 || assignment.endLine < assignment.startLine
            || assignment.endLine > unit.lineCount || typeof assignment.target !== 'string' || !targets.has(assignment.target)) {
            throw Error('原生卡分类来源或行号无效');
        }
        if (assignment.target === 'character'
            ? typeof assignment.characterId !== 'string' || !ids.has(assignment.characterId)
            : assignment.characterId !== undefined)
            throw Error('原生卡跨度人物关联无效');
        if (unit.atomic && (assignment.startLine !== 1 || assignment.endLine !== unit.lineCount))
            throw Error('动态模板原文必须整块保留');
        const span = { sourceId: unit.id, startLine: assignment.startLine,
            endLine: assignment.endLine, target: assignment.target,
            ...assignment.characterId !== undefined ? { characterId: assignment.characterId } : {} };
        assignments.push(span);
        const spans = coverage.get(unit.id) ?? [];
        spans.push(span);
        coverage.set(unit.id, spans);
    }
    for (const unit of snapshot.units) {
        let next = 1;
        for (const span of (coverage.get(unit.id) ?? []).sort((left, right) => left.startLine - right.startLine)) {
            if (span.startLine !== next)
                throw Error('原生卡分类必须完整覆盖原文，不能重复或漏行');
            next = span.endLine + 1;
        }
        if (next !== unit.lineCount + 1)
            throw Error('原生卡分类必须完整覆盖原文，不能重复或漏行');
    }
    return freeze({ characters, assignments });
}
/** Consume the already-validated classification. Static fragments keep source
 * order; lore and templates stay references for the existing admission/render
 * owners, rather than becoming always-on character or rule material. */
export function materializeNativeCardConversionV1(snapshot, classification) {
    const document = structuredClone(snapshot.document);
    const author = nextTavernExecutionAuthorData(document.data), rules = { ...author.rules };
    for (const field of ruleFields)
        delete rules[field];
    const characterParts = new Map(classification.characters.map(character => [character.id, []]));
    const ruleParts = new Map();
    for (const unit of snapshot.units) {
        if (unit.kind !== 'author' || unit.atomic)
            continue;
        const lines = sourceLines(unit.text);
        const spans = classification.assignments.filter(span => span.sourceId === unit.id)
            .sort((left, right) => left.startLine - right.startLine);
        for (const span of spans) {
            const text = lines.slice(span.startLine - 1, span.endLine).join('');
            if (span.target === 'character')
                characterParts.get(span.characterId).push(text);
            else if (span.target !== 'other') {
                const parts = ruleParts.get(span.target) ?? [];
                parts.push(text);
                ruleParts.set(span.target, parts);
            }
        }
    }
    for (const field of ruleFields)
        if (ruleParts.has(field))
            rules[field] = ruleParts.get(field).join('');
    const stored = { schemaVersion: 1, encoding: 'nexttavern-classification-v1',
        sourceSha256: snapshot.sourceSha256, ...structuredClone(classification),
        sources: snapshot.units.map(({ text: _text, ...source }) => ({ ...source })) };
    document.spec_version = '1.1';
    document.data = { ...document.data, cards: classification.characters.map(character => ({
            characterId: character.id, name: character.name,
            ...character.aliases !== undefined ? { aliases: structuredClone(character.aliases) } : {},
            content: characterParts.get(character.id).join(''),
        })), rules, compatibility: { ...document.data.compatibility,
            authorExecution: { schemaVersion: 1, mode: 'preserved-author', cards: author.cards, rules: author.rules }, classification: stored } };
    return document;
}
