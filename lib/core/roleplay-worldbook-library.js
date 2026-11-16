// Generated from runtime/alpha3/src/core/roleplay-worldbook-library.ts; edit the TypeScript source.
/** Manual library operations use the catalog and binding journals already
 * shared by Helper and prompt preparation. Workspace selection owns admission. */
import { recordSha256 } from './roleplay-data.js';
import { jsonResponse } from './roleplay-state.js';
import { AuthorWorldbookWriteUnknownV1 } from './roleplay-author-worldbook-journal.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every(item => typeof item === 'string');
const reference = (value) => value === null
    || object(value) && typeof value.key === 'string' && typeof value.sha256 === 'string';
function parseRequest(value) {
    if (!object(value) || typeof value.sessionId !== 'string' || typeof value.operationId !== 'string' || !value.operationId)
        throw Error('WORLDBOOK_LIBRARY_REQUEST_INVALID');
    if (value.action === 'import') {
        if (typeof value.fileName !== 'string' || typeof value.json !== 'string' || !reference(value.expectedCatalogHead))
            throw Error('WORLDBOOK_LIBRARY_REQUEST_INVALID');
        return value;
    }
    if (value.action === 'bind' && reference(value.expectedHead) && object(value.expectedOwner) && object(value.selection)) {
        const selection = value.selection;
        if (value.target === 'profile' && selection.kind === 'profile' && strings(selection.enabled)
            || value.target === 'character' && selection.kind === 'character' && strings(selection.additional)
                && (selection.primary === null || typeof selection.primary === 'string')
            || value.target === 'chat' && selection.kind === 'chat' && (selection.bookId === null || typeof selection.bookId === 'string'))
            return value;
    }
    throw Error('WORLDBOOK_LIBRARY_REQUEST_INVALID');
}
function codeOf(error) {
    return error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
        ? error.message : 'WORLDBOOK_LIBRARY_UNAVAILABLE';
}
export function registerWorldbookLibraryRoutesV1(deps) {
    function captureLibrary(sessionId, source) {
        const context = deps.context.captureBindings(source), catalog = deps.catalog.captureCatalog(), profile = context.bindings.find(binding => binding.owner.kind === 'profile'), character = context.bindings.find(binding => binding.owner.kind === 'character'), chat = context.bindings.find(binding => binding.owner.kind === 'chat');
        if (!profile || !character || !chat)
            throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_INVALID');
        const library = { schemaVersion: 1, sessionId, catalog, bindings: { profile, character, chat } };
        return library;
    }
    function capture(sessionId) {
        const read = deps.source.captureCurrent(sessionId), source = read.captured;
        if (source.kind !== 'captured-data')
            throw Error('AUTHOR_WORLDBOOK_SOURCE_UNAVAILABLE');
        return { source: source.source, library: captureLibrary(sessionId, source.source), assertCurrent: read.assertCurrent };
    }
    async function mutate(body, scope, signal, onReceipt) {
        return deps.withSourceLock(scope.sessionId, async () => {
            scope.assertCurrent();
            const basis = capture(scope.sessionId), binding = body.action === 'bind' ? basis.library.bindings[body.target] : undefined, address = body.action === 'import' ? { kind: 'catalog', profileId: basis.library.catalog.profileId }
                : { kind: 'bindings', profileId: basis.library.catalog.profileId, owner: binding.owner }, addressSha256 = recordSha256(address), writer = {
                owns: owner => recordSha256(owner) === addressSha256,
                isCurrent: () => {
                    scope.assertCurrent();
                    basis.assertCurrent();
                    return !signal.aborted;
                }
            };
            if (body.action === 'bind' && recordSha256({ kind: 'bindings', profileId: basis.library.catalog.profileId,
                owner: body.expectedOwner }) !== addressSha256) {
                // Receipt lookup reads the original owner's published operation. The
                // current Source still owns every new mutation admitted below.
                let published;
                try {
                    published = deps.bindings.publishedReceipt(body.expectedOwner, body.operationId, { expectedHead: body.expectedHead, selection: body.selection });
                }
                catch (error) {
                    if (!(error instanceof Error) || error.message !== 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
                        throw error;
                }
                if (published)
                    return { schemaVersion: 1, ok: true, library: basis.library,
                        receipt: published, historical: true };
                throw Error('AUTHOR_WORLDBOOK_BINDING_OWNER_CHANGED');
            }
            // Let the journal compare the supplied head after checking an existing
            // operation. A lost acknowledgement must recover its original payload.
            const result = body.action === 'import'
                ? await deps.catalog.importBook({ expectedHead: body.expectedCatalogHead, fileName: body.fileName, json: body.json }, body.operationId, writer)
                : await deps.bindings.bindBooks({ ...binding, head: body.expectedHead }, body.selection, body.operationId, writer);
            onReceipt(result.receipt);
            if ('readError' in result && result.readError)
                throw Error(result.readError.code);
            scope.assertCurrent();
            return { schemaVersion: 1, ok: true, library: captureLibrary(scope.sessionId, basis.source),
                receipt: result.receipt, ...'bookId' in result ? { bookId: result.bookId } : {} };
        });
    }
    deps.ctx.effect(() => deps.ctx.connection.fetch.register({ path: '/api/roleplay/worldbooks', methods: ['GET', 'POST'],
        requestBody: 'buffered', fetch: async (request) => {
            let body, receipt;
            try {
                if (request.method === 'POST') {
                    let parsed;
                    try {
                        parsed = JSON.parse(await request.text());
                    }
                    catch {
                        throw Error('WORLDBOOK_LIBRARY_REQUEST_INVALID');
                    }
                    body = parseRequest(parsed);
                }
                const sessionId = body?.sessionId ?? new URL(request.url).searchParams.get('sessionId');
                if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId))
                    throw Error('WORLDBOOK_LIBRARY_REQUEST_INVALID');
                const scope = await deps.resolveSessionScope(sessionId);
                if (!scope)
                    return jsonResponse(404, { schemaVersion: 1, ok: false, code: 'WORLDBOOK_LIBRARY_SESSION_UNAVAILABLE',
                        error: '当前工作区会话不可访问', outcome: 'no-write' });
                scope.assertCurrent();
                const result = body ? await mutate(body, scope, request.signal, value => { receipt = value; })
                    : await deps.withSourceLock(scope.sessionId, () => {
                        scope.assertCurrent();
                        return { schemaVersion: 1, ok: true, library: capture(scope.sessionId).library };
                    });
                scope.assertCurrent();
                return jsonResponse(200, result);
            }
            catch (error) {
                const unknown = error instanceof AuthorWorldbookWriteUnknownV1 || receipt !== undefined, code = codeOf(error);
                const invalid = code === 'WORLDBOOK_LIBRARY_REQUEST_INVALID' || code.startsWith('AUTHOR_WORLDBOOK_FILE_');
                return jsonResponse(unknown ? 503 : invalid ? 400 : code === 'LORE_DATA_BUDGET' ? 413 : 409, {
                    schemaVersion: 1, ok: false, code, error: unknown ? '世界书操作结果待确认，请保留并重试本次操作' : '暂时无法完成世界书操作',
                    outcome: unknown ? 'unknown' : 'no-write', ...body ? { operationId: body.operationId } : {}, ...receipt ? { receipt } : {},
                });
            }
        } }), 'roleplay: profile worldbook library and bindings');
}
