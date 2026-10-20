// Generated from runtime/alpha3/compat/session/src/request-material-types.ts; edit the TypeScript source.
function fail(subject) { throw Error(`${subject} has invalid required request material`); }
const record = (value, fields, subject) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key)))
        return fail(subject);
    return value;
};
const integer = (value, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0 && value <= max && !Object.is(value, -0);
const identity = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256
    && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const list = (value, max, subject) => Array.isArray(value) && value.length <= max ? value : fail(subject);
function dataRef(value, subject) {
    const row = record(value, ['key', 'sha256'], subject);
    if (!identity(row['key']) || !sha(row['sha256']))
        fail(subject);
}
/** Unknown schema/encoding is a required semantic read failure. It must not
 * be treated as an ignorable event or as an unchanged base request. */
export function validateNativeRequestMaterialDataV1(value, subject) {
    const row = record(value, ['schemaVersion', 'encoding', 'turn', 'step', 'header', 'snapshot', 'plan', 'base', 'delta', 'placements', 'outputSha256'], subject);
    const version = row['schemaVersion'];
    if (!(version === 1 && row['encoding'] === 'native-request-material-v1'
        || version === 2 && row['encoding'] === 'native-request-material-v2') || !integer(row['turn']) || row['turn'] < 1
        || !integer(row['step']) || row['step'] < 1 || !sha(row['outputSha256']))
        fail(subject);
    dataRef(row['snapshot'], subject);
    dataRef(row['plan'], subject);
    const header = record(row['header'], ['seq', 'sha256'], subject);
    const base = record(row['base'], ['boundarySeq', 'contentGeneration', 'surfaceNodes', 'messages', 'sha256'], subject);
    if (!integer(base['boundarySeq'], 65535) || !integer(base['contentGeneration']) || !sha(base['sha256'])
        || !integer(header['seq']) || header['seq'] > base['boundarySeq'] || !sha(header['sha256']))
        fail(subject);
    const boundarySeq = base['boundarySeq'];
    const nodes = list(base['surfaceNodes'], 65536, subject);
    if (nodes.some(seq => !integer(seq) || seq > boundarySeq) || new Set(nodes).size !== nodes.length)
        fail(subject);
    const messages = list(base['messages'], 4096, subject);
    let priorPosition = -1;
    const ids = new Set();
    for (const item of messages) {
        const ref = record(item, ['seq', 'id', 'role', 'messageSha256'], subject);
        const position = nodes.indexOf(ref['seq']);
        if (!integer(ref['seq']) || position <= priorPosition || !identity(ref['id']) || ids.has(ref['id'])
            || !['system', 'developer', 'user', 'assistant', 'tool'].includes(String(ref['role'])) || !sha(ref['messageSha256']))
            fail(subject);
        priorPosition = position;
        ids.add(ref['id']);
    }
    const rawDelta = row['delta'];
    const delta = record(rawDelta, ['insertions', 'protectedPrefixLength',
        ...version === 2 ? ['messageTextProjections'] : [],
        ...Object.hasOwn(rawDelta, 'messageProjection') ? ['messageProjection'] : [],
        ...Object.hasOwn(rawDelta, 'requestLocalSampling') ? ['requestLocalSampling'] : []], subject);
    if (delta['messageProjection'] !== undefined)
        validateNativeMessageProjectionV1(delta['messageProjection'], subject);
    if (delta['requestLocalSampling'] !== undefined) {
        const local = record(delta['requestLocalSampling'], ['schemaVersion', 'base'], subject);
        if (local['schemaVersion'] !== 1)
            fail(subject);
        const raw = local['base'];
        const base = record(raw, ['temperature', 'maxTokens', 'stop'].filter(key => Object.hasOwn(raw, key)), subject);
        if (base['temperature'] !== undefined && (typeof base['temperature'] !== 'number' || !Number.isFinite(base['temperature'])))
            fail(subject);
        if (base['maxTokens'] !== undefined && (!integer(base['maxTokens']) || base['maxTokens'] < 1))
            fail(subject);
        if (base['stop'] !== undefined && list(base['stop'], 128, subject).some(value => typeof value !== 'string'))
            fail(subject);
    }
    if (!integer(delta['protectedPrefixLength'], messages.length))
        fail(subject);
    if (version === 2) {
        const projected = new Set();
        for (const value of list(delta['messageTextProjections'], 4096, subject)) {
            const projection = record(value, ['target', 'textEdits', 'projectionSha256'], subject);
            const target = record(projection['target'], ['id', 'role', 'messageSha256'], subject);
            if (!identity(target['id']) || projected.has(target['id']) || !['user', 'assistant'].includes(String(target['role']))
                || !sha(target['messageSha256']) || !sha(projection['projectionSha256']))
                fail(subject);
            projected.add(target['id']);
            const edits = list(projection['textEdits'], 4096, subject), indices = new Set();
            if (!edits.length)
                fail(subject);
            for (const value of edits) {
                const edit = record(value, ['blockIndex', 'replacementText'], subject);
                if (!integer(edit['blockIndex'], 4095) || indices.has(edit['blockIndex']) || typeof edit['replacementText'] !== 'string'
                    || !edit['replacementText'].isWellFormed())
                    fail(subject);
                indices.add(edit['blockIndex']);
            }
        }
    }
    const insertions = list(delta['insertions'], 128, subject), contributions = new Set(), orders = new Set();
    let bytes = 0;
    for (const item of insertions) {
        const insertion = record(item, ['contributionRef', 'sourceSha256', 'renderedText', 'renderedSha256',
            'requestedRole', 'requestedDepth', 'stableOrder'], subject);
        if (!identity(insertion['contributionRef']) || contributions.has(insertion['contributionRef'])
            || !sha(insertion['sourceSha256']) || !sha(insertion['renderedSha256'])
            || typeof insertion['renderedText'] !== 'string' || !insertion['renderedText'].trim()
            || !insertion['renderedText'].isWellFormed() || insertion['renderedText'].length > 65536
            || !['system', 'user', 'assistant'].includes(String(insertion['requestedRole']))
            || !integer(insertion['requestedDepth'], 4096) || !integer(insertion['stableOrder']) || orders.has(insertion['stableOrder']))
            fail(subject);
        contributions.add(insertion['contributionRef']);
        orders.add(insertion['stableOrder']);
        bytes += new TextEncoder().encode(insertion['renderedText']).byteLength;
        if (bytes > 1048576)
            fail(subject);
    }
    const placements = list(row['placements'], 128, subject);
    if (placements.length !== insertions.length)
        fail(subject);
    const placed = new Set(), placementIds = new Set();
    for (const item of placements) {
        const placement = record(item, ['contributionRef', 'baseIndex', 'protectedPrefixLength', 'effectiveDepth', 'messageId'], subject);
        if (!identity(placement['contributionRef']) || !contributions.has(placement['contributionRef']) || placed.has(placement['contributionRef'])
            || !integer(placement['baseIndex'], messages.length) || placement['baseIndex'] < delta['protectedPrefixLength']
            || placement['protectedPrefixLength'] !== delta['protectedPrefixLength']
            || placement['effectiveDepth'] !== messages.length - placement['baseIndex'] || !identity(placement['messageId'])
            || ids.has(placement['messageId']) || placementIds.has(placement['messageId']))
            fail(subject);
        placed.add(placement['contributionRef']);
        placementIds.add(placement['messageId']);
    }
}
export function validateNativeMessageProjectionV1(value, subject) {
    const projection = record(value, ['schemaVersion', 'encoding', 'groups',
        ...value !== null && typeof value === 'object' && Object.hasOwn(value, 'textEdits') ? ['textEdits'] : []], subject);
    if (projection['schemaVersion'] !== 1 || projection['encoding'] !== 'native-request-message-projection-v1')
        fail(subject);
    const ids = new Set();
    let bytes = 0;
    for (const item of list(projection['groups'], 4096, subject)) {
        const group = record(item, ['targets', 'role', 'renderedText'], subject);
        const targets = list(group['targets'], 4096, subject);
        if (!targets.length || !['system', 'user', 'assistant'].includes(String(group['role']))
            || typeof group['renderedText'] !== 'string' || !group['renderedText'].isWellFormed())
            fail(subject);
        bytes += new TextEncoder().encode(group['renderedText']).byteLength;
        if (bytes > 4194304)
            fail(subject);
        for (const value of targets) {
            const target = record(value, ['id', 'messageSha256'], subject);
            if (!identity(target['id']) || !sha(target['messageSha256']) || ids.has(target['id']))
                fail(subject);
            ids.add(target['id']);
        }
    }
    if (projection['textEdits'] !== undefined)
        for (const value of list(projection['textEdits'], 4096, subject)) {
            const edit = record(value, ['target', 'blocks'], subject), target = record(edit['target'], ['id', 'messageSha256'], subject);
            if (!identity(target['id']) || !sha(target['messageSha256']) || ids.has(target['id']))
                fail(subject);
            ids.add(target['id']);
            const indexes = new Set();
            for (const value of list(edit['blocks'], 4096, subject)) {
                const block = record(value, ['index', 'text'], subject);
                if (!integer(block['index']) || indexes.has(block['index']) || typeof block['text'] !== 'string' || !block['text'].isWellFormed())
                    fail(subject);
                indexes.add(block['index']);
                bytes += new TextEncoder().encode(block['text']).byteLength;
                if (bytes > 4194304)
                    fail(subject);
            }
        }
}
