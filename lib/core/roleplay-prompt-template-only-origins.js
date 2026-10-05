// Generated from runtime/alpha3/src/core/roleplay-prompt-template-only-origins.ts; edit the TypeScript source.
/** Exact normalizer/assignment/row origin ownership. The ordinary projector
 * is authoritative; no substring, author's allow bit or sanitized raw copy
 * grants the whole current field an EJS exemption. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { projectStructuredImport, spanText, sourceDescriptor } from './roleplay-import-record.js';
import { PROMPT_TEMPLATE_ONLY_FIELDS_V1, promptTemplateOnlyFail, segmentPromptTemplateOnlyFieldV1 } from './roleplay-prompt-template-only-data.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const lf = (text) => text.replace(/\r\n?/g, '\n') + '\n';
function failure(pointer) { return promptTemplateOnlyFail('PROMPT_TEMPLATE_CURRENT_ORIGIN_UNPROVEN', pointer); }
function assignmentsMatch(actual, expected, portable = false) {
    if (!same(actual.sourceSpans, expected.sourceSpans) || actual.target !== expected.target
        || actual.id !== expected.id || actual.name !== expected.name || actual.kind !== expected.kind
        || actual.merge_group !== expected.merge_group || actual.secondary === true || actual.reuse_reason !== undefined
        || (actual.locked === true) !== (expected.locked === true)
        || (portable ? (actual.always_on === true) !== (expected.always_on === true) : actual.always_on === true)
        || ['aliases', 'keywords', 'triggers'].some(key => !same(actual[key] ?? [], expected[key] ?? [])))
        return false;
    if (Number(actual.priority ?? 0) !== Number(expected.priority ?? 0)
        || Number(actual.token_budget ?? 0) !== Number(expected.token_budget ?? 0)
        || Number(actual.order ?? actual.sourceSpans[0]?.startLine) !== Number(expected.order ?? expected.sourceSpans[0]?.startLine))
        return false;
    return Object.keys(actual).every(key => ['target', 'id', 'name', 'kind', 'sourceSpans', 'sourceSha256', 'materializedSha256',
        'locked', 'secondary', 'merge_group', 'aliases', 'keywords', 'triggers', 'priority', 'token_budget', 'always_on', 'order', 'stagedAt'].includes(key));
}
/** A complete deterministic section list, not matching text by occurrence.
 * It retains schema4's full archive as a distinct non-executable section. */
function sectionsOf(decoded, schema) {
    const data = decoded.data, result = [];
    const add = (text, target, field = null) => {
        if (text === undefined || text === null || text === '')
            return;
        result.push({ text: lf(String(text)), field, target });
    };
    add(`# ${data.name.replace(/[\r\n\x00-\x1f]/g, ' ')}`, 'archive-only');
    for (const [field, label, target] of [
        ['description', '人物设定', 'card'], ['personality', '性格', 'card'],
        ['scenario', '初始场景', 'core-setting'], ['mes_example', '对白示例', 'rule-style'],
    ]) {
        add(`## ${label}`, 'archive-only');
        add(data[field], target, field);
    }
    add(data.system_prompt, 'rule-narrative', 'system_prompt');
    add(data.post_history_instructions, 'rule-reply', 'post_history_instructions');
    add(data.first_mes, 'opening');
    if (schema === 4)
        add('## 完整结构化原件（只归档，不注入剧情）\n' + JSON.stringify(decoded.document, null, 2), 'archive-only');
    return result;
}
export function mapPromptTemplateOnlyOriginsV1(input) {
    const { decoded, record, source } = input, projection = projectStructuredImport(record, decoded);
    const sections = sectionsOf(decoded, record.schemaVersion === 4 ? 4 : 5);
    if (record.normalizedSource !== sections.map(section => section.text).join('')
        || projection.text !== record.normalizedSource || projection.assignments.length !== sections.length
        || record.assignments.length !== projection.assignments.length || projection.worldbook.length !== 0)
        failure('/normalizer');
    const pieces = [];
    let nextLine = 1;
    for (const [index, section] of sections.entries()) {
        const expected = projection.assignments[index], actual = record.assignments[index];
        const count = section.text.split('\n').length - 1;
        if (expected.target !== section.target || !same(expected.sourceSpans, [{ startLine: nextLine, endLine: nextLine + count - 1 }])
            || !assignmentsMatch(actual, expected) || spanText(record, actual.sourceSpans) !== section.text
            || actual.sourceSha256 !== sha256(section.text) || actual.materializedSha256 !== sha256(section.text)) {
            failure(`/assignments/${index}`);
        }
        nextLine += count;
        if (section.field)
            pieces.push({ field: section.field, assignment: actual, assignmentIndex: index, text: section.text });
    }
    const rowOf = (table, key) => {
        const row = source.current.rows.find(row => row.ref.table === table && row.ref.key === key);
        if (!row?.ref.exists || !row.value || recordSha256(row.value) !== row.ref.sha256)
            failure('/current/rows');
        return row;
    };
    const groups = new Map();
    for (const piece of pieces) {
        const target = piece.assignment.target;
        const table = target === 'card' ? 'cards' : 'rules';
        const key = target === 'card' ? `${source.sessionId}__${piece.assignment.id}` : `${source.sessionId}__spec`;
        const field = target === 'card' ? 'content' : target === 'core-setting' ? 'core' : target === 'rule-style' ? 'style'
            : target === 'rule-narrative' ? 'narrative' : 'reply';
        const identity = `${table}:${key}:${field}`, current = groups.get(identity);
        if (current) {
            current.value += piece.text;
            current.pieces.push(piece);
            current.sources.push(sourceDescriptor(record, piece.assignment));
        }
        else
            groups.set(identity, { row: rowOf(table, key), field, value: piece.text, pieces: [piece],
                sources: [sourceDescriptor(record, piece.assignment)] });
    }
    const mapped = new Map();
    const owned = new Map();
    for (const group of groups.values()) {
        const row = group.row.value;
        if (row[group.field] !== group.value || row.importId !== record.importId)
            failure('/current/owned-field');
        const actualSources = group.row.ref.table === 'cards' ? row.sources : object(row.sources) ? row.sources[group.field] : undefined;
        if (!same(actualSources, group.sources))
            failure('/current/owned-field/sources');
        let offset = 0;
        for (const piece of group.pieces) {
            mapped.set(piece.field, { row: group.row.ref, fieldPointer: `/${group.field}`, valueSha256: sha256(group.value),
                valueLength: group.value.length, start: offset, end: offset + piece.text.length, normalizedTextSha256: sha256(piece.text),
                assignmentIndex: piece.assignmentIndex, assignmentSha256: recordSha256(piece.assignment),
                sourceDescriptorSha256: recordSha256(sourceDescriptor(record, piece.assignment)), sourceSpans: piece.assignment.sourceSpans });
            offset += piece.text.length;
        }
        const rowKey = `${group.row.ref.table}:${group.row.ref.key}`;
        const fields = new Map(owned.get(rowKey) ?? []);
        fields.set(group.field, group.value);
        owned.set(rowKey, fields);
    }
    const fields = PROMPT_TEMPLATE_ONLY_FIELDS_V1.map(field => {
        const pointer = `/data/${field}`, raw = decoded.data[field];
        if (raw === undefined)
            return { field, sourcePointer: pointer, presence: 'absent', rawText: null, rawTextSha256: null,
                rawLength: 0, segments: [], segmentsSha256: recordSha256([]), normalizedText: null,
                normalizedSegments: [], normalizedSegmentsSha256: recordSha256([]), projection: null };
        if (typeof raw !== 'string')
            failure(pointer);
        const segments = segmentPromptTemplateOnlyFieldV1(raw, pointer), origin = mapped.get(field) ?? null;
        const normalizedText = raw === '' ? '' : lf(raw), normalizedSegments = segmentPromptTemplateOnlyFieldV1(normalizedText, pointer);
        if (raw !== '' && !origin || raw === '' && origin !== null)
            failure(pointer);
        return { field, sourcePointer: pointer, presence: 'text', rawText: raw, rawTextSha256: sha256(raw), rawLength: raw.length,
            segments, segmentsSha256: recordSha256(segments), normalizedText, normalizedSegments,
            normalizedSegmentsSha256: recordSha256(normalizedSegments), projection: origin };
    });
    return { fields, owned, sectionInventory: sections.map((section, index) => ({ assignmentIndex: index, target: section.target,
            field: section.field, textSha256: sha256(section.text), disposition: section.field ? 'owned-author-prompt' : 'strict-literal-or-archive-only' })) };
}
/** Match the maintained stage's classification shape, while full portable
 * author controls remain in DATA. This does not copy author provenance. */
function portableAssignmentShape(expected) {
    const number = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value ?? 0)));
    return { ...expected,
        ...(expected.name === undefined ? {} : { name: expected.name.trim() }),
        ...(expected.target === 'card' ? { kind: expected.kind === 'user' ? 'user' : 'npc',
            ...(expected.kind === 'user' ? { id: 'user' } : {}) } : {}),
        priority: number(expected.priority, -1_000_000, 1_000_000),
        token_budget: number(expected.token_budget, 0, 10_000_000) };
}
/** DATA owns exact author bytes; assignment spans own only the normalized
 * classifier receipt. Raw book content is independently owned by its compiler. */
function mapNextTavernPromptAuthorOriginsV1(input, projection, inventory) {
    const { decoded, record, source } = input, data = decoded.data;
    const fields = [], groups = [];
    const rowOf = (table, key) => source.current.rows.find(row => row.ref.table === table && row.ref.key === key);
    const add = (field, raw, table, key, rowField, assignmentIndex) => {
        const originalPointer = `/data/${field}`;
        if (raw === '') {
            fields.push({ field, originalPointer, presence: 'text', rawText: '', normalizedText: '', assignment: null,
                currentGroupId: null, originalGroupSpan: null });
            return;
        }
        const assignment = inventory[assignmentIndex], row = rowOf(table, key), current = row?.value, sources = table === 'rules' && object(current?.sources) ? current.sources[rowField] : current?.sources, expectedSources = table === 'status' ? inventory.filter(item => item.assignment.target === 'status')
            .map(item => item.sourceDescriptor) : [assignment.sourceDescriptor];
        if (!current || current.importId !== record.importId || typeof current[rowField] !== 'string'
            || !same(sources, expectedSources))
            failure('/program/current/portable-provenance');
        const exact = current[rowField] === raw, editedFrom = exact ? null : current.editedFrom;
        // The Source already owns today's complete row/membership. In particular
        // rp_worldbook_update has no editedFrom marker; do not require another edit
        // protocol to consume its actual current bytes and unchanged source link.
        const groupId = `${table}:${key}:/${rowField}`, span = { start: 0, end: raw.length };
        fields.push({ field, originalPointer, presence: 'text', rawText: raw, normalizedText: lf(raw), assignment,
            currentGroupId: groupId, originalGroupSpan: span });
        groups.push({ groupId, row: row.ref, fieldPointer: `/${rowField}`, originalProjection: raw,
            effectiveText: current[rowField],
            parts: [{ kind: 'author-field', originalPointer, authorField: field, rawEntryPointer: null, ...span, assignment }],
            currentFieldOffsets: exact ? 'same-as-original' : 'unavailable-shared-group-edit',
            currentOrigin: { kind: exact ? 'exact-portable-author-data' : 'actual-current-row-edit', row: row.ref,
                sourceDescriptorsSha256: recordSha256(sources), editedFrom: object(editedFrom) ? editedFrom : null,
                editedFromSha256: editedFrom ? recordSha256(editedFrom) : null } });
    };
    // Ordinal/ID identity comes from the projector, never from locating text.
    for (const [table, rows, target] of [['cards', data.cards, 'card'], ['worldbook', data.worldbook, 'worldbook']]) {
        for (const [index, row] of rows.entries()) {
            const expectedId = `${projection.cardId}-${target}-${index}`, at = projection.assignments.findIndex(assignment => assignment.target === target && assignment.id === expectedId), id = table === 'cards' && row.kind === 'user' ? 'user' : expectedId;
            add(`${table}/${index}/content`, row.content, table, `${source.sessionId}__${id}`, 'content', at);
        }
    }
    for (const [field, target] of [['core', 'core-setting'], ['plot', 'plot-guidance'], ['narrative', 'rule-narrative'],
        ['reply', 'rule-reply'], ['style', 'rule-style']]) {
        const raw = data.rules[field];
        if (raw !== undefined)
            add(`rules/${field}`, raw, 'rules', `${source.sessionId}__spec`, field, projection.assignments.findIndex(assignment => assignment.target === target));
    }
    if (data.status)
        add('status/text', data.status.text, 'status', `${source.sessionId}__spec`, 'text', projection.assignments.findLastIndex(assignment => assignment.target === 'status'));
    const compatibility = object(data.compatibility) ? data.compatibility.sillytavernMacroFields : undefined;
    if (object(compatibility))
        for (const field of PROMPT_TEMPLATE_ONLY_FIELDS_V1) {
            const raw = compatibility[field];
            if (typeof raw !== 'string')
                continue;
            const key = `compatibility/sillytavernMacroFields/${field}`;
            // Macro aliases are immutable Source inputs, not a second author row or
            // independent prompt contribution. Only a real render can consume them.
            fields.push({ field: key, originalPointer: `/data/${key}`, presence: 'text', rawText: raw,
                normalizedText: raw === '' ? '' : lf(raw), assignment: null, currentGroupId: null, originalGroupSpan: null });
        }
    const bookAssignments = [];
    for (const [ordinal, entry] of source.original.primary.entries.entries()) {
        if (entry.value.content === '')
            continue;
        const id = projection.worldbook[ordinal].id, at = projection.assignments.findIndex(assignment => assignment.target === 'archive-only' && assignment.id === id);
        bookAssignments.push({ rawEntryPointer: entry.ref.entryPointer, assignment: inventory[at] });
    }
    return { fields, groups, assignmentInventory: inventory, bookAssignments };
}
/** Complete author groups, including canonical constant-book fragments in a
 * shared rules field. Changed shared groups are never split by text matching. */
export function mapPromptProgramAuthorOriginsV1(input) {
    const { decoded, record, source } = input, projection = projectStructuredImport(record, decoded);
    if (projection.text !== record.normalizedSource || projection.assignments.length !== record.assignments.length) {
        failure('/program/normalizer');
    }
    const inventory = record.assignments.map((actual, index) => {
        const expected = projection.assignments[index], text = spanText(record, expected.sourceSpans);
        const native = decoded.format === 'json-nexttavern-v1';
        if (!assignmentsMatch(actual, native ? portableAssignmentShape(expected) : expected, native) || actual.sourceSha256 !== sha256(text)
            || actual.materializedSha256 !== sha256(text))
            failure(`/program/assignments/${index}`);
        const descriptor = sourceDescriptor(record, actual);
        return { assignmentIndex: index, assignment: actual, assignmentSha256: recordSha256(actual),
            sourceDescriptor: descriptor, sourceDescriptorSha256: recordSha256(descriptor),
            normalizedSectionSha256: sha256(text), normalizedSectionLength: text.length };
    });
    if (decoded.format === 'json-nexttavern-v1')
        return mapNextTavernPromptAuthorOriginsV1(input, projection, inventory);
    const prefix = sectionsOf(decoded, 5), authorAt = new Map();
    for (const [index, section] of prefix.entries()) {
        if (spanText(record, record.assignments[index].sourceSpans) !== section.text
            || projection.assignments[index].target !== section.target)
            failure(`/program/author-prefix/${index}`);
        if (section.field)
            authorAt.set(index, section.field);
    }
    const entries = source.original.primary.entries, bookAt = new Map();
    if (projection.worldbook.length !== entries.length)
        failure('/program/primary/entries');
    let next = prefix.length;
    for (const [ordinal, entry] of entries.entries()) {
        const projected = projection.worldbook[ordinal];
        if (entry.ref.entryOrdinal !== ordinal || projected.sourceIndex !== ordinal
            || typeof entry.value.content !== 'string')
            failure('/program/primary/ordinal');
        if (entry.value.content === '')
            continue;
        const target = projected.constant && projected.enabled ? 'core-setting' : 'worldbook';
        if (projection.assignments[next]?.target !== target
            || spanText(record, record.assignments[next].sourceSpans) !== lf(entry.value.content)) {
            failure(`/program/primary/entries/${ordinal}`);
        }
        bookAt.set(next, entry.ref.entryPointer);
        next++;
    }
    if (next + (record.schemaVersion === 4 ? 1 : 0) !== projection.assignments.length)
        failure('/program/normalizer/tail');
    if (record.schemaVersion === 4 && projection.assignments[next]?.target !== 'archive-only')
        failure('/program/normalizer/archive');
    const groups = new Map(), fieldMapping = new Map();
    for (const [index, assignment] of record.assignments.entries()) {
        const field = authorAt.get(index), bookPointer = bookAt.get(index);
        if (!field && !bookPointer)
            continue;
        if (!['card', 'core-setting', 'rule-style', 'rule-narrative', 'rule-reply'].includes(assignment.target))
            continue;
        const table = assignment.target === 'card' ? 'cards' : 'rules', rowField = assignment.target === 'card' ? 'content'
            : assignment.target === 'core-setting' ? 'core' : assignment.target === 'rule-style' ? 'style'
                : assignment.target === 'rule-narrative' ? 'narrative' : 'reply';
        const key = table === 'cards' ? `${source.sessionId}__${assignment.id}` : `${source.sessionId}__spec`;
        const groupId = `${table}:${key}:/${rowField}`;
        let group = groups.get(groupId);
        if (!group) {
            const row = source.current.rows.find(item => item.ref.table === table && item.ref.key === key);
            if (!row?.ref.exists || !row.value || recordSha256(row.value) !== row.ref.sha256)
                failure('/program/current/row');
            group = { row, field: rowField, text: '', parts: [], descriptors: [] };
            groups.set(groupId, group);
        }
        const text = spanText(record, assignment.sourceSpans), start = group.text.length, end = start + text.length;
        const pointer = field ? `/data/${field}` : `${bookPointer}/content`;
        group.parts.push({ kind: field ? 'author-field' : 'worldbook-content', originalPointer: pointer,
            authorField: field ?? null, rawEntryPointer: bookPointer ?? null, start, end, assignment: inventory[index] });
        group.text += text;
        group.descriptors.push(inventory[index].sourceDescriptor);
        if (field) {
            const raw = decoded.data[field];
            if (typeof raw !== 'string' || lf(raw) !== text)
                failure(pointer);
            fieldMapping.set(field, { field, originalPointer: pointer, presence: 'text', rawText: raw, normalizedText: text,
                assignment: inventory[index], currentGroupId: groupId, originalGroupSpan: { start, end } });
        }
    }
    const mappedGroups = [];
    for (const [groupId, group] of groups) {
        const value = group.row.value, current = value[group.field], sources = group.row.ref.table === 'cards' ? value.sources
            : object(value.sources) ? value.sources[group.field] : undefined;
        if (value.importId !== record.importId || typeof current !== 'string' || !same(sources, group.descriptors)) {
            failure('/program/current/group-provenance');
        }
        const changed = current !== group.text, editedFrom = changed ? value.editedFrom : null;
        if (changed) {
            // Existing edit paths own whole fields. Mixed constant-book/author edits
            // need a real boundary supplier; no guessed offsets can authorize them.
            if (group.parts.some(part => part.kind !== 'author-field') || !object(editedFrom)
                || Object.keys(editedFrom).some(key => !['sha256', 'source', 'seq', 'repairId'].includes(key))
                || typeof editedFrom.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(editedFrom.sha256)
                || !['user-edit', 'agent-edit', 'native-tool'].includes(String(editedFrom.source))
                || !Number.isSafeInteger(editedFrom.seq) || Number(editedFrom.seq) < -1
                || group.row.ref.table === 'cards' && (!Number.isSafeInteger(value.version) || Number(value.version) < 2)) {
                failure('/program/current/edit-origin');
            }
        }
        mappedGroups.push({ groupId, row: group.row.ref, fieldPointer: `/${group.field}`, originalProjection: group.text,
            effectiveText: current, parts: group.parts, currentFieldOffsets: changed ? 'unavailable-shared-group-edit' : 'same-as-original',
            currentOrigin: { kind: changed ? 'actual-current-row-edit' : 'exact-original-projection', row: group.row.ref,
                sourceDescriptorsSha256: recordSha256(sources), editedFrom: object(editedFrom) ? editedFrom : null,
                editedFromSha256: editedFrom ? recordSha256(editedFrom) : null } });
    }
    const fields = PROMPT_TEMPLATE_ONLY_FIELDS_V1.map(field => {
        const existing = fieldMapping.get(field);
        if (existing)
            return existing;
        const raw = decoded.data[field];
        if (raw !== undefined && raw !== '')
            failure(`/data/${field}`);
        return { field, originalPointer: `/data/${field}`, presence: raw === undefined ? 'absent' : 'text', rawText: raw ?? null,
            normalizedText: raw === undefined ? null : '', assignment: null, currentGroupId: null, originalGroupSpan: null };
    });
    return { fields, groups: mappedGroups, assignmentInventory: inventory,
        bookAssignments: [...bookAt].map(([index, rawEntryPointer]) => ({ rawEntryPointer, assignment: inventory[index] })) };
}
