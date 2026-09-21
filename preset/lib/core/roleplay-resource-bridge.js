// Generated from runtime/alpha3/src/core/roleplay-resource-bridge.ts; edit the TypeScript source.
import { realpathSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createTavernLibrary } from './tavern-library.js';
import { decodeTavernCard } from './tavern-card.js';
import { sha256, isPathWithin } from './roleplay-data.js';
export function createResourceBridge(deps) {
    const { T } = deps;
    const libraries = new Map();
    const libraryFor = (session) => {
        const workspace = realpathSync(session.header.cwd);
        if (!libraries.has(workspace))
            libraries.set(workspace, createTavernLibrary({ workspace, table: T.branch }));
        return libraries.get(workspace);
    };
    const resourceName = (name, extension = '.md') => `${String(name ?? '角色卡').normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]/g, '-').replace(/[. ]+$/, '').slice(0, 90) || '角色卡'}${extension}`;
    async function archiveImported(session, record) {
        const extension = record.sourceEnvelope?.extension ?? extname(record.sourceFile ?? '').toLowerCase();
        const bytes = record.sourceEnvelope ? Buffer.from(record.sourceEnvelope.base64, 'base64') : Buffer.from(record.rawSource, 'utf8');
        if (sha256(bytes) !== record.rawSha256)
            throw new Error('入库原卡哈希不匹配');
        let name = '角色卡';
        if (record.sourceEnvelope)
            name = decodeTavernCard(bytes, extension).data.name ?? name;
        else
            name = record.assignments?.find(a => a.target === 'card')?.name ?? name;
        if (record.resourceTitle)
            name = record.resourceTitle;
        const migrated = await libraryFor(session).migrate({ id: `import-${record.importId}`, name: resourceName(name, extension || '.md'),
            type: extension === '.png' ? 'image/png' : extension === '.json' ? 'application/json' : 'text/markdown', bytes,
            source: { sessionId: record.sessionId ?? session.id, kind: 'card-import', importId: record.importId, sha256: record.rawSha256 } });
        if (!migrated.ok)
            throw new Error('角色卡入库待重试');
        return migrated.resource;
    }
    async function migrateResources(session) {
        const library = libraryFor(session), workspace = realpathSync(session.header.cwd);
        for (const record of [...T.branch.values?.() ?? [...T.branch.entries()].map(([, v]) => v)]) {
            if (record?.importId && record.status === 'active' && record.workspaceRoot === workspace)
                try {
                    await archiveImported(session, record);
                }
                catch { }
            if (record?.exportId && record.status === 'completed' && typeof record.file === 'string' && isPathWithin(workspace, resolve(record.file))) {
                await library.migrate({ id: `export-${record.exportId}`, name: resourceName(record.title ?? '角色卡'), type: 'text/markdown', path: record.file,
                    source: { sessionId: record.branchId ?? session.id, kind: 'card-export', exportId: record.exportId, sha256: record.resultHash } });
            }
        }
        return library;
    }
    return { libraryFor, resourceName, archiveImported, migrateResources };
}
