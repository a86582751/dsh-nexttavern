// Generated from runtime/alpha3/src/core/community-preset-card-material.ts; edit the TypeScript source.
/** Field ownership before rendering. Captured Source owns import/current-row
 * validity; this producer only partitions current author material for ST slots. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { projectStructuredImport, sourceDescriptor } from './roleplay-import-record.js';
import { renderCards, renderCoreContributionV1 } from './roleplay-author-contributions.js';
const markers = { description: 'charDescription', personality: 'charPersonality',
    scenario: 'scenario', persona: 'personaDescription' };
const fieldNames = ['description', 'personality', 'scenario', 'persona', 'residual'];
const same = (left, right) => recordSha256(left) === recordSha256(right);
const escape = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');
const offsets = (record, span) => ({ start: record.lineStarts[span.startLine - 1],
    end: span.endLine < record.lineCount ? record.lineStarts[span.endLine] : record.normalizedSource.length });
/** The maintained projector labels each raw field immediately before its
 * payload. Those exact source spans, rather than prose matching, own the slot. */
function sourceRegions(captured) {
    if (captured.decoded.format === 'json-nexttavern-v1')
        return [];
    const projection = projectStructuredImport(captured.record, captured.decoded), regions = [];
    for (const field of ['description', 'personality', 'scenario']) {
        const raw = captured.decoded.data[field];
        if (raw === undefined || raw === null || raw === '')
            continue;
        const label = projection.assignments.findIndex(row => row.target === 'archive-only' && row.name === field);
        const payload = projection.assignments[label + 1];
        for (const span of payload.sourceSpans)
            regions.push({ field, ...offsets(captured.record, span),
                rawText: String(raw), pointer: `/data/${field}` });
    }
    return regions;
}
function sourceSegments(record, spans, regions) {
    const output = [];
    for (const span of [...spans].sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)) {
        const { start, end } = offsets(record, span);
        const cuts = [start, ...regions.flatMap(region => [region.start, region.end]).filter(at => at > start && at < end), end]
            .sort((a, b) => a - b);
        for (let index = 1; index < cuts.length; index++) {
            const from = cuts[index - 1], to = cuts[index], region = regions.find(region => from >= region.start && to <= region.end);
            const field = region?.field ?? 'residual', previous = output.at(-1), text = record.normalizedSource.slice(from, to);
            if (previous?.field === field && previous.end === from) {
                previous.text += text;
                previous.end = to;
            }
            else if (text)
                output.push({ field, text, start: from, end: to });
        }
    }
    return output;
}
function overrideSegments(text, mapping) {
    const ranges = [...mapping.ranges].sort((a, b) => a.start - b.start || a.end - b.end), segments = [];
    let offset = 0;
    for (const range of ranges) {
        if (!Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < offset
            || range.end < range.start || range.end > text.length || !fieldNames.includes(range.field))
            return null;
        if (range.start > offset)
            segments.push({ field: 'residual', text: text.slice(offset, range.start) });
        if (range.end > range.start)
            segments.push({ field: range.field, text: text.slice(range.start, range.end) });
        offset = range.end;
    }
    if (offset < text.length)
        segments.push({ field: 'residual', text: text.slice(offset) });
    return segments;
}
function currentSegments(part, currentText, baseline, linked, native, override, required, mappingScope) {
    const fields = [...new Set(baseline.filter(part => part.field !== 'residual').map(part => part.field))];
    // Worldlines copy the same current field under their own row key. Persist
    // its attribution at conversation scope while retaining the actual row ref.
    const identity = mappingScope ? `${part.row.table}:${mappingScope.conversationId}__` +
        part.row.key.slice(mappingScope.sessionId.length + 2) + (part.kind === 'core' ? '/core' : '') : part.identity;
    const mapping = override?.groups.find(group => group.identity === identity);
    const require = (reason) => {
        required.push({ identity, row: part.row, field: part.kind === 'card' ? 'content' : 'core', currentText,
            originalTextSha256: sha256(currentText), fields: fields.length ? [...fields, 'residual'] :
                part.kind === 'card' ? ['description', 'personality', 'residual'] : ['scenario', 'residual'], reason });
        return null;
    };
    if (mapping) {
        if (mapping.originalTextSha256 !== sha256(currentText))
            return require('mapping-stale');
        const segments = overrideSegments(currentText, mapping);
        return segments ?? require('mapping-range-invalid');
    }
    // Clearing a current field clears all of its former marker values.
    if (!currentText)
        return [];
    if (native)
        return require('native-field-unmapped');
    if (!fields.length)
        return [{ field: 'residual', text: currentText }];
    if (!linked)
        return require('current-provenance-changed');
    if (baseline.map(part => part.text).join('') === currentText)
        return [...baseline];
    if (fields.length === 1 && !baseline.some(part => part.field === 'residual' && part.text))
        return [{ field: fields[0], text: currentText }];
    return require('shared-field-edited');
}
function addInputs(output, regions, part, segments) {
    for (const [index, segment] of segments.entries())
        if (segment.field !== 'residual' && segment.text) {
            const original = regions.find(region => region.field === segment.field && region.start === segment.start && region.end === segment.end);
            output[markers[segment.field]].push({ key: `community-${segment.field}-${sha256(part.identity).slice(0, 16)}-${index}`,
                pointer: original?.pointer ?? `/native/current-author/${escape(part.identity)}/${segment.field}/${index}`,
                text: original?.rawText ?? segment.text });
        }
}
const remaining = (segments) => segments.filter(part => part.field === 'residual').map(part => part.text).join('');
function residualCard(part, row, content) {
    if (content === part.originalText)
        return part;
    // This private one-row table only selects the maintained text wrapper. The
    // returned part retains its actual captured row identity and original body.
    const value = { ...row, content }, key = 'community__card';
    const text = renderCards({ cards: { get: () => value, entries: () => [[key, value]] } }, 'community');
    return { ...part, text, textSha256: sha256(text) };
}
function residualCore(part, content) {
    if (!content)
        return null;
    if (content === part.originalText)
        return part;
    const text = renderCoreContributionV1(content);
    return { ...part, text, textSha256: sha256(text) };
}
export function produceCommunityPresetCardMaterialV1(input) {
    const { captured } = input, { record, source, residual, contributions } = captured, regions = sourceRegions(captured);
    const output = {
        charDescription: [], charPersonality: [], scenario: [], personaDescription: []
    };
    const residualCards = [], residualRules = [];
    const required = [];
    const rows = new Map(source.current.rows.map(row => [`${row.ref.table}:${row.ref.key}`, row]));
    let hasUserCard = false;
    for (const part of residual.parts) {
        if (part.kind !== 'card' && part.kind !== 'core') {
            if (part.kind !== 'examples')
                residualRules.push(part);
            continue;
        }
        const row = rows.get(`${part.row.table}:${part.row.key}`);
        if (part.kind === 'card' && row.value?.kind === 'user') {
            hasUserCard = true;
            output.personaDescription.push({ key: `community-persona-${sha256(part.identity).slice(0, 16)}`,
                pointer: `/native/current-author/${escape(part.identity)}/persona`, text: part.text });
            continue;
        }
        if (part.kind === 'card') {
            const assignments = record.assignments.filter(assignment => assignment.target === 'card'
                && `${source.sessionId}__${assignment.kind === 'user' ? 'user' : assignment.id}` === part.row.key)
                .sort((a, b) => a.sourceSpans[0].startLine - b.sourceSpans[0].startLine || Number(a.order) - Number(b.order));
            const native = captured.decoded.format === 'json-nexttavern-v1' && assignments.length > 0;
            const baseline = sourceSegments(record, assignments.flatMap(assignment => assignment.sourceSpans), regions);
            const linked = !!row.value && row.value.importId === record.importId
                && same(row.value.sources, assignments.map(assignment => sourceDescriptor(record, assignment)));
            const segments = currentSegments(part, part.originalText, baseline, linked, native, input.override, required, input.mappingScope);
            if (!segments)
                continue;
            addInputs(output, regions, part, segments);
            residualCards.push(residualCard(part, row.value, remaining(segments)));
        }
        else {
            const baseline = sourceSegments(record, contributions.orderedAfter.map(fragment => fragment.span), regions);
            const segments = currentSegments(part, contributions.residualCore, baseline, true, captured.decoded.format === 'json-nexttavern-v1', input.override, required, input.mappingScope);
            if (!segments)
                continue;
            addInputs(output, regions, part, segments);
            const core = residualCore(part, remaining(segments));
            if (core)
                residualRules.push(core);
        }
    }
    if (!hasUserCard)
        output.personaDescription.push(...input.persona ?? []);
    return required.length ? { schemaVersion: 1, kind: 'mapping-required', groups: required } :
        { schemaVersion: 1, kind: 'mapped', markers: output, residualCards, residualRules };
}
/** No imported field provenance exists on this path. Native card kind owns
 * persona; NPC/core attribution is an explicit current-field mapping once. */
export function produceCommunityNativeCardMaterialV1(input) {
    const output = {
        charDescription: [], charPersonality: [], scenario: [], personaDescription: []
    };
    const residualCards = [], residualRules = [];
    const required = [], rows = new Map(input.cardRows.map(row => [row.identity, row.value]));
    let hasUserCard = false;
    for (const part of input.parts) {
        if (part.kind !== 'card' && part.kind !== 'core') {
            if (part.kind !== 'examples')
                residualRules.push(part);
            continue;
        }
        const row = part.kind === 'card' ? rows.get(part.identity) : null;
        if (row?.kind === 'user') {
            hasUserCard = true;
            output.personaDescription.push({ key: `community-persona-${sha256(part.identity).slice(0, 16)}`,
                pointer: `/native/current-author/${escape(part.identity)}/persona`, text: part.text });
            continue;
        }
        const segments = currentSegments(part, part.originalText, [], true, true, input.override, required, input.mappingScope);
        if (!segments)
            continue;
        addInputs(output, [], part, segments);
        if (part.kind === 'card')
            residualCards.push(residualCard(part, row, remaining(segments)));
        else {
            const core = residualCore(part, remaining(segments));
            if (core)
                residualRules.push(core);
        }
    }
    if (!hasUserCard)
        output.personaDescription.push(...input.persona ?? []);
    return required.length ? { schemaVersion: 1, kind: 'mapping-required', groups: required } :
        { schemaVersion: 1, kind: 'mapped', markers: output, residualCards, residualRules };
}
