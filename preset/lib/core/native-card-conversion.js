// Generated from runtime/alpha3/src/core/native-card-conversion.ts; edit the TypeScript source.
/** Classification carries coordinates only. Author execution remains a single
 * preserved source; advanced projections never promote conditional lore. */
import { createHash } from 'node:crypto';
import { sourceLines, stableJson } from './card-export-projection.js';
/** Source provenance distinguishes an authored card from a community projection.
 * A present classification, including an invalid one, retains its derived role. */
export function nativeCardConversionIsDeterministicV1(input) {
    if (input.classification)
        return true;
    if (input.nativeAuthoring && !Object.hasOwn(input.snapshot.document, 'classification'))
        return true;
    return readNativeCardClassificationV1(input.snapshot) !== undefined;
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
    const captured = structuredClone(document), data = captured.data;
    const units = [];
    const add = (pointer, text, kind) => {
        units.push({ id: `source-${units.length + 1}`, pointer, text, sha256: sha256(text),
            lineCount: sourceLines(text).length, kind, atomic: text.includes('<%') });
    };
    data.cards.forEach((row, index) => {
        if (row.enabled === false || row.kind === 'user')
            return;
        add(`/data/cards/${index}/content`, row.content, 'author');
    });
    for (const field of ruleFields)
        if (data.rules[field] !== undefined) {
            add(`/data/rules/${field}`, data.rules[field], 'author');
        }
    data.worldbook.forEach((row, index) => add(`/data/worldbook/${index}/content`, row.content, 'worldbook'));
    const entries = data.character_book?.entries ?? [];
    for (const [key, entry] of Object.entries(entries))
        if (typeof entry.content === 'string') {
            add(`/data/character_book/entries/${pointerKey(key)}/content`, entry.content, 'worldbook');
        }
    // These are the classifier's actual inputs. Full export identity belongs to
    // the workflow capture, so metadata edits can retain these same coordinates.
    const sourceSha256 = sha256(stableJson({ name: data.name,
        sources: units.map(({ text: _text, ...unit }) => unit) }));
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
const importedClassifications = new WeakMap();
/** One imported-classification boundary per immutable snapshot. Uploaded source
 * directories never override the units derived from current author DATA. */
export function readNativeCardClassificationV1(snapshot) {
    const cached = importedClassifications.get(snapshot);
    if (cached !== undefined)
        return cached ?? undefined;
    const stored = snapshot.document.classification;
    let classification;
    if (stored?.schemaVersion === 1 && stored.encoding === 'nexttavern-classification-v1'
        && stored.sourceSha256 === snapshot.sourceSha256) {
        try {
            classification = validateNativeCardClassificationV1(snapshot, { characters: stored.characters, assignments: stored.assignments });
        }
        catch { /* Ordinary author DATA remains usable when an optional classification is invalid. */ }
    }
    importedClassifications.set(snapshot, classification ?? null);
    return classification;
}
/** Persist coordinates beside the single author document. Derived character
 * and rule text belongs only to the advanced read view. */
export function materializeNativeCardConversionV1(snapshot, classification) {
    const document = structuredClone(snapshot.document);
    const stored = { schemaVersion: 1, encoding: 'nexttavern-classification-v1',
        sourceSha256: snapshot.sourceSha256, ...structuredClone(classification),
        sources: snapshot.units.map(({ text: _text, ...source }) => ({ ...source })) };
    document.classification = stored;
    return document;
}
