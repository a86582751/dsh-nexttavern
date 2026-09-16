// Generated from runtime/alpha3/core/tavern-library-record.ts; edit the TypeScript source.
export const libraryRecordKey = (prefix, workspaceHash, id) => `${prefix}${workspaceHash}__${id}`;
export const libraryPendingKey = (prefix, workspaceHash, id) => `${prefix}${workspaceHash}__${id}`;
export const librarySourceKey = (source) => JSON.stringify(Object.fromEntries(Object.entries(source).sort(([left], [right]) => left.localeCompare(right, 'en'))));
export function libraryObjectName(value, safeName, fileName) {
    const record = value;
    if (!record || typeof record.fullSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.fullSha256) || typeof record.objectName !== 'string' || /[\\/]/.test(record.objectName) || record.objectName !== fileName(record.fullSha256, safeName(record.name)))
        throw new Error('资源记录损坏');
    return record.objectName;
}
