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
    if (row['schemaVersion'] !== 1 || row['encoding'] !== 'native-request-material-v1' || !integer(row['turn']) || row['turn'] < 1
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
    const delta = record(row['delta'], ['insertions', 'protectedPrefixLength'], subject);
    if (!integer(delta['protectedPrefixLength'], messages.length))
        fail(subject);
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
