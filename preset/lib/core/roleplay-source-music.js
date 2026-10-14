// Generated from runtime/alpha3/src/core/roleplay-source-music.ts; edit the TypeScript source.
/** Discover inert audio references; selection owns embedded bytes and live URLs. */
import { htmlLiteralsV1, scriptLiteralsV1 } from './roleplay-source-music-parser.mjs';
import { recordSha256 } from './roleplay-data.js';
const audioData = /^data:(audio\/[a-z0-9.+-]+)((?:;[^,]*)?),(.*)$/is;
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const pointer = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');
const remoteAudioTypes = {
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
    flac: 'audio/flac', opus: 'audio/ogg', webm: 'audio/webm',
};
function remoteAudioType(uri) {
    if (!/^https?:\/\//i.test(uri))
        return;
    try {
        return remoteAudioTypes[new URL(uri).pathname.split('.').at(-1).toLowerCase()];
    }
    catch {
        return;
    }
}
function discover(data) {
    const found = [];
    const add = (uri, carrier, position, name) => {
        const match = audioData.exec(uri);
        const type = match?.[1]?.toLowerCase() ?? remoteAudioType(uri);
        if (!type)
            return;
        found.push({ uri, candidate: { candidateId: recordSha256([carrier, position]),
                name: name ?? `角色卡音频 ${found.length + 1}`, type, carrier, position, storage: match ? 'embedded' : 'remote' } });
    };
    const assets = (value, position, name) => {
        if (typeof value === 'string') {
            add(value, 'asset', position, name);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, index) => assets(item, position + '/' + index, name));
            return;
        }
        if (object(value))
            for (const [key, item] of Object.entries(value)) {
                assets(item, position + '/' + pointer(key), typeof value.name === 'string' ? value.name : name);
            }
    };
    const script = (source, position) => {
        for (const literal of scriptLiteralsV1(source, position))
            add(literal.value, literal.carrier, literal.position, literal.name);
    };
    const html = (source, position) => {
        for (const literal of htmlLiteralsV1(source, position))
            add(literal.value, literal.carrier, literal.position, literal.name);
    };
    assets(data.assets, '/data/assets');
    for (const field of ['cards', 'worldbook'])
        data[field].forEach((row, index) => html(row.content, `/data/${field}/${index}/content`));
    for (const [key, entry] of Object.entries(data.character_book?.entries ?? {})) {
        if (object(entry) && typeof entry.content === 'string')
            html(entry.content, '/data/character_book/entries/' + pointer(key) + '/content');
    }
    if (data.opening) {
        html(data.opening.text, '/data/opening/text');
        if (Array.isArray(data.opening.catalog))
            data.opening.catalog.forEach((value, index) => {
                if (object(value) && typeof value.rawText === 'string')
                    html(value.rawText, '/data/opening/catalog/' + index + '/rawText');
            });
    }
    for (const [key, value] of Object.entries(data.rules))
        if (typeof value === 'string')
            html(value, '/data/rules/' + pointer(key));
    if (data.status)
        html(data.status.text, '/data/status/text');
    const beauty = data.rules.beauty;
    if (typeof beauty?.js === 'string')
        script(beauty.js, '/data/rules/beauty/js');
    const extensions = data.extensions;
    const helper = object(extensions) && extensions.tavern_helper;
    const scriptTree = (values, position) => values.forEach((value, index) => {
        if (!object(value))
            return;
        const descriptor = position + '/' + index;
        if (value.type === 'folder' && Array.isArray(value.scripts)) {
            scriptTree(value.scripts, descriptor + '/scripts');
            return;
        }
        const content = value.content ?? value.code;
        if (typeof content === 'string')
            script(content, descriptor + '/content');
        // Script resource HTML is inert author DATA, separate from its executable
        // content. Original cards keep embedded media in this field.
        if (object(value.data) && typeof value.data.html === 'string')
            html(value.data.html, descriptor + '/data/html');
    });
    if (object(helper) && Array.isArray(helper.scripts))
        scriptTree(helper.scripts, '/data/extensions/tavern_helper/scripts');
    return found;
}
export function createSourceMusicV1(deps) {
    const catalogs = new Map();
    const catalog = (session) => {
        const source = deps.read(session), previous = catalogs.get(session.id);
        if (!source) {
            catalogs.delete(session.id);
            return null;
        }
        if (previous?.sourceHash === source.sourceHash)
            return previous;
        const next = { sourceHash: source.sourceHash, importId: source.importId, items: discover(source.data) };
        catalogs.set(session.id, next);
        return next;
    };
    return {
        list(session) {
            const current = catalog(session);
            return { sourceHash: current?.sourceHash ?? null, candidates: current?.items.map(item => item.candidate) ?? [] };
        },
        async select(session, sourceHash, candidateId) {
            const current = catalog(session);
            if (!current || current.sourceHash !== sourceHash)
                throw Error('角色卡来源已变化，请刷新音乐列表后重新选择。');
            const item = current.items.find(value => value.candidate.candidateId === candidateId);
            if (!item)
                throw Error('角色卡音频已不存在，请刷新音乐列表。');
            if (item.candidate.storage === 'remote')
                return { id: recordSha256([current.sourceHash, candidateId]),
                    name: item.candidate.name, type: item.candidate.type, url: item.uri };
            const match = audioData.exec(item.uri);
            const bytes = /;base64(?:;|$)/i.test(match[2]) ? Buffer.from(match[3], 'base64')
                : Buffer.concat(match[3].split(/(%[a-f0-9]{2})/i).map(part => /^%[a-f0-9]{2}$/i.test(part)
                    ? Buffer.from([Number.parseInt(part.slice(1), 16)]) : Buffer.from(part, 'utf8')));
            return deps.libraryFor(session).archive({ name: item.candidate.name, type: item.candidate.type, bytes,
                source: { kind: 'source-media-v1', sessionId: session.id, importId: current.importId,
                    sourceHash: current.sourceHash, candidateId } });
        },
        dispose() { catalogs.clear(); },
    };
}
