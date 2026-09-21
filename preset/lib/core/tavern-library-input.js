// Generated from runtime/alpha3/src/core/tavern-library-input.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
export const LIBRARY_NAME_LIMIT = 160;
export const safeLibraryName = (value) => {
    if (typeof value !== 'string')
        throw new Error('资源名称无效');
    const name = value.normalize('NFC').trim();
    if (!name || name.length > LIBRARY_NAME_LIMIT || /[\x00-\x1f<>:"/\\|?*]/.test(name) || name === '.' || name === '..')
        throw new Error('资源名称包含不安全字符');
    return name;
};
export const safeLibraryType = (value) => {
    if (typeof value !== 'string'
        || !/^[a-z]+\/[a-z0-9!#$&^_.+-]+(?:;\s*charset=(?:utf-8|us-ascii))?$/i.test(value)
        || value.length > 128)
        throw new Error('资源类型无效');
    return value.toLowerCase();
};
export const librarySource = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('资源来源无效');
    const source = {};
    for (const [key, item] of Object.entries(value)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || typeof item !== 'string' || item.length > 1024)
            throw new Error('资源来源字段无效');
        source[key] = item;
    }
    if (!source.sessionId)
        throw new Error('资源来源必须包含 sessionId');
    return source;
};
export const createLibraryObjectName = (sha256, name) => `${sha256}--${safeLibraryName(name)}`;
// Keep the old public helper name for callers outside the archive owner.
export const libraryObjectName = createLibraryObjectName;
export const libraryContentDisposition = (name) => {
    const fallback = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};
export const libraryStableId = (workspaceHash, fullSha256) => createHash('sha256').update(`tavern-library\0${workspaceHash}\0${fullSha256}`).digest('hex');
