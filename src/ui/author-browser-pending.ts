import type {BrowserBindingV1,BrowserSaveRequestV1} from '../core/tavern-author-browser-types.mjs';
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from '../core/roleplay-mvu-player-types.js';
import type {BrowserWorldbookMutationRequestV2,BrowserWorldbookMutationReplyV2,
    BrowserPersonaMutationRequestV2,BrowserPersonaMutationReplyV2}
    from '../core/tavern-author-browser-types-v2.mjs';

import type {TavernLoreEditRefV1,TavernLoreMutationRetryLocatorV1}
    from '../core/roleplay-tavern-lore-edits-types.js';

type WorldbookResult = BrowserWorldbookMutationReplyV2['result'];
export interface AuthorBrowserWorldbookPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-worldbook-pending-v1';
    binding: BrowserBindingV1;
    sessionId: string;
    operationId: string;
    name: string;
    state: 'pending' | 'unknown' | 'terminal';
    result?: WorldbookResult;
    code?: string;
}
interface WorldbookPendingCollectionV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-worldbook-operations-v1';
    sessionId: string;
    operations: AuthorBrowserWorldbookPendingV1[];
}
export type AuthorBrowserWorldbookPendingScopeV2 =
    | {kind: 'known-namespace'; identitySha256: string}
    | {kind: 'legacy-event-ref'; eventRef: TavernLoreEditRefV1}
    | {kind: 'legacy-unlocated'; manualReleased: boolean};
export interface AuthorBrowserWorldbookPendingV2 extends
    Omit<AuthorBrowserWorldbookPendingV1, 'schemaVersion' | 'encoding'> {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-worldbook-pending-v2';
    scope: AuthorBrowserWorldbookPendingScopeV2;
}
interface WorldbookPendingCollectionV2 {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-worldbook-operations-v2';
    sessionId: string;
    operations: AuthorBrowserWorldbookPendingV2[];
}
// Keep the physical key so an upgrade reads the user's existing records.
const worldbookKey = (sessionId: string) => 'nexttavern.author-browser.worldbook-pending.v1:' + sessionId;
export const terminalWorldbookReceipt = (result: WorldbookResult) => result.kind === 'edited-data'
    || result.diagnostics.some(value => value.code === 'OPERATION_NOT_RECORDED');
function worldbookResultScope(result?: WorldbookResult): AuthorBrowserWorldbookPendingScopeV2 | undefined {
    if (result?.kind === 'edited-data') return {kind: 'known-namespace', identitySha256: result.receipt.identitySha256};
    if (result?.kind !== 'refused') return;
    const recovery = result.diagnostics.find(value => value.recovery)?.recovery;
    if (recovery) return {kind: 'known-namespace', identitySha256: recovery.identitySha256};
    const pending = result.diagnostics.find(value => value.pending)?.pending;
    if (pending) return {kind: 'legacy-event-ref', eventRef: pending.eventRef};
}
export function worldbookPendingRetryLocator(envelope: AuthorBrowserWorldbookPendingV2):
    TavernLoreMutationRetryLocatorV1 | undefined {
    const scope = envelope.scope;
    return scope.kind === 'known-namespace' ? {identitySha256: scope.identitySha256}
        : scope.kind === 'legacy-event-ref' ? {eventRef: scope.eventRef} : undefined;
}
export function worldbookPendingBlocksNamespace(envelope: AuthorBrowserWorldbookPendingV2,
    identitySha256: string | undefined): boolean {
    if (envelope.state === 'terminal') return false;
    const scope = envelope.scope;
    return scope.kind === 'known-namespace' ? scope.identitySha256 === identitySha256
        : scope.kind === 'legacy-unlocated' ? !scope.manualReleased : true;
}

type PersonaResult = BrowserPersonaMutationReplyV2['result'];
type PersonaStoredResult = Pick<Extract<PersonaResult, {kind: 'committed'}>, 'schemaVersion' | 'kind' | 'receipt'>
    | Extract<PersonaResult, {kind: 'refused'}>;
export interface AuthorBrowserPersonaPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-persona-pending-v1';
    binding: BrowserBindingV1;
    sessionId: string;
    operationId: string;
    scriptIdentity: string;
    state: 'pending' | 'unknown' | 'terminal';
    result?: PersonaStoredResult;
    code?: string;
}
interface PersonaPendingCollectionV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-persona-operations-v1';
    sessionId: string;
    operations: AuthorBrowserPersonaPendingV1[];
}
const personaKey = (sessionId: string) => 'nexttavern.author-browser.persona-pending.v1:' + sessionId;

export interface AuthorBrowserPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-pending-v1';
    binding: BrowserBindingV1;
    child: Pick<BrowserSaveRequestV1, 'requestId' | 'generation' | 'readRevision' | 'scriptIdentity'>;
    // Values and expected occur exactly once. Retry reconstructs the child DATA
    // from this fixed operation; author code is never called for a retry.
    operation: MvuPlayerEditRequest;
    state: 'pending' | 'unknown' | 'terminal';
    receipt?: Pick<MvuPlayerEditResponse, 'ok' | 'operation' | 'code' | 'error'>;
}
const key = (sessionId: string) => 'nexttavern.author-browser.pending.v1:' + sessionId;
export const terminalBrowserReceipt = (result: MvuPlayerEditResponse) =>
    result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';

export function createAuthorBrowserPendingStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    function read(sessionId: string): AuthorBrowserPendingV1 | undefined {
        const bytes = storage.getItem(key(sessionId));
        if (!bytes) return;
        const envelope = JSON.parse(bytes) as AuthorBrowserPendingV1;
        if (envelope.schemaVersion !== 1 || envelope.encoding !== 'nexttavern-author-browser-pending-v1'
            || envelope.operation.sessionId !== sessionId) throw Error('BROWSER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function begin(binding: BrowserBindingV1, request: BrowserSaveRequestV1): AuthorBrowserPendingV1 {
        const previous = read(binding.sessionId);
        if (previous && previous.state !== 'terminal') {
            throw Error('BROWSER_SAVE_CONFIRMATION_REQUIRED');
        }
        const envelope: AuthorBrowserPendingV1 = {
            schemaVersion: 1, encoding: 'nexttavern-author-browser-pending-v1', binding,
            child: {requestId: request.requestId, generation: request.generation,
                readRevision: request.readRevision, scriptIdentity: request.scriptIdentity},
            operation: {schemaVersion: 1, sessionId: binding.sessionId, operationId: crypto.randomUUID(),
                action: 'replace-values', expected: request.expected, values: request.values},
            state: 'pending',
        };
        // Freeze the submitted DATA through the storage serialization, before
        // sending anything. A storage failure must prevent the write.
        storage.setItem(key(binding.sessionId), JSON.stringify(envelope));
        return read(binding.sessionId)!;
    }
    function record(envelope: AuthorBrowserPendingV1, result?: MvuPlayerEditResponse) {
        const next: AuthorBrowserPendingV1 = {...envelope,
            state: result && terminalBrowserReceipt(result) ? 'terminal' : 'unknown',
            ...(result ? {receipt: {ok: result.ok, operation: result.operation, code: result.code, error: result.error}} : {}),
        };
        // An old ACK may finish its old record, but cannot replace a newer
        // operation admitted by another view after terminal confirmation.
        if (read(envelope.operation.sessionId)?.operation.operationId === envelope.operation.operationId) {
            storage.setItem(key(envelope.operation.sessionId), JSON.stringify(next));
        }
        return next;
    }
    function readWorldbooks(sessionId: string): AuthorBrowserWorldbookPendingV2[] {
        const bytes = storage.getItem(worldbookKey(sessionId));
        if (!bytes) return [];
        const collection = JSON.parse(bytes) as WorldbookPendingCollectionV1 | WorldbookPendingCollectionV2;
        if (collection.sessionId !== sessionId) throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        if (collection.schemaVersion === 2 && collection.encoding === 'nexttavern-author-browser-worldbook-operations-v2') {
            return collection.operations;
        }
        if (collection.schemaVersion !== 1 || collection.encoding !== 'nexttavern-author-browser-worldbook-operations-v1') {
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        }
        const operations: AuthorBrowserWorldbookPendingV2[] = collection.operations.map(previous => ({
            ...previous, schemaVersion: 2, encoding: 'nexttavern-author-browser-worldbook-pending-v2',
            scope: worldbookResultScope(previous.result) ?? {kind: 'legacy-unlocated', manualReleased: false},
            // V1 called any unanchored refusal terminal, including a lookup in
            // a newer namespace. Preserve that evidence without claiming absence.
            state: previous.result && terminalWorldbookReceipt(previous.result) ? 'terminal'
                : previous.state === 'pending' ? 'pending' : 'unknown',
        }));
        writeWorldbooks(sessionId, operations);
        return operations;
    }
    function writeWorldbooks(sessionId: string, operations: AuthorBrowserWorldbookPendingV2[]) {
        const collection: WorldbookPendingCollectionV2 = {schemaVersion: 2,
            encoding: 'nexttavern-author-browser-worldbook-operations-v2', sessionId, operations};
        storage.setItem(worldbookKey(sessionId), JSON.stringify(collection));
    }
    function beginWorldbook(binding: BrowserBindingV1, request: BrowserWorldbookMutationRequestV2, identitySha256: string) {
        const operations = readWorldbooks(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous) return previous;
        const envelope: AuthorBrowserWorldbookPendingV2 = {schemaVersion: 2,
            encoding: 'nexttavern-author-browser-worldbook-pending-v2', binding,
            sessionId: binding.sessionId, operationId: request.operationId, name: request.name, state: 'pending',
            scope: {kind: 'known-namespace', identitySha256}};
        // Save the actual captured namespace before dispatch. An address is
        // DATA for the journal owner; it grants no Source or realm permission.
        writeWorldbooks(binding.sessionId, [...operations, envelope]);
        return envelope;
    }
    function recordWorldbook(envelope: AuthorBrowserWorldbookPendingV2, result?: WorldbookResult, code?: string) {
        const operations = readWorldbooks(envelope.sessionId);
        const index = operations.findIndex(value => value.operationId === envelope.operationId);
        const previous = operations[index] ?? envelope;
        if (previous.state === 'terminal' && (!result
            || previous.result?.kind === 'edited-data' && result.kind !== 'edited-data')) return previous;
        const observedScope = worldbookResultScope(result);
        const hasAnchor = worldbookResultScope(previous.result) !== undefined;
        const keptResult = hasAnchor && result?.kind === 'refused' && !observedScope
            && !terminalWorldbookReceipt(result) ? previous.result : result ?? previous.result;
        const scope = observedScope?.kind === 'known-namespace' ? observedScope
            : previous.scope.kind === 'known-namespace' ? previous.scope : observedScope ?? previous.scope;
        const next: AuthorBrowserWorldbookPendingV2 = {...previous, scope,
            state: result && terminalWorldbookReceipt(result) ? 'terminal' : 'unknown',
            result: keptResult, code};
        if (index === -1) operations.push(next);
        else operations[index] = next;
        writeWorldbooks(envelope.sessionId, operations);
        return next;
    }
    function releaseLegacyWorldbook(operationId: string, sessionId: string) {
        const operations = readWorldbooks(sessionId);
        const index = operations.findIndex(value => value.operationId === operationId);
        const envelope = operations[index];
        if (!envelope || envelope.state === 'terminal' || envelope.scope.kind !== 'legacy-unlocated') return;
        operations[index] = {...envelope, scope: {...envelope.scope, manualReleased: true}};
        writeWorldbooks(sessionId, operations);
    }
    function readPersonas(sessionId: string): AuthorBrowserPersonaPendingV1[] {
        const bytes = storage.getItem(personaKey(sessionId));
        if (!bytes) return [];
        const collection = JSON.parse(bytes) as PersonaPendingCollectionV1;
        if (collection.schemaVersion !== 1 || collection.encoding !== 'nexttavern-author-browser-persona-operations-v1'
            || collection.sessionId !== sessionId) throw Error('BROWSER_PERSONA_PENDING_FORMAT_UNSUPPORTED');
        return collection.operations;
    }
    function writePersonas(sessionId: string, operations: AuthorBrowserPersonaPendingV1[]) {
        const collection: PersonaPendingCollectionV1 = {schemaVersion: 1,
            encoding: 'nexttavern-author-browser-persona-operations-v1', sessionId, operations};
        storage.setItem(personaKey(sessionId), JSON.stringify(collection));
    }
    function beginPersona(binding: BrowserBindingV1, request: BrowserPersonaMutationRequestV2) {
        const operations = readPersonas(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous) return previous;
        const envelope: AuthorBrowserPersonaPendingV1 = {schemaVersion: 1,
            encoding: 'nexttavern-author-browser-persona-pending-v1', binding, sessionId: binding.sessionId,
            operationId: request.operationId, scriptIdentity: request.scriptIdentity, state: 'pending'};
        // The Native account owns the intent and receipt. Browser recovery only
        // needs identity; neither persona DATA nor an old VM callback is durable.
        writePersonas(binding.sessionId, [...operations, envelope]);
        return envelope;
    }
    function recordPersona(envelope: AuthorBrowserPersonaPendingV1, result?: PersonaResult, code?: string) {
        const operations = readPersonas(envelope.sessionId);
        const index = operations.findIndex(value => value.operationId === envelope.operationId);
        const previous = operations[index];
        // A delayed ACK cannot erase a committed receipt. A real committed ACK
        // may still replace an earlier lookup that reached Core before its write.
        if (previous?.state === 'terminal' && (!result
            || previous.result?.kind === 'committed' && result.kind !== 'committed')) return previous;
        const stored: PersonaStoredResult | undefined = result?.kind === 'committed'
            ? {schemaVersion: result.schemaVersion, kind: result.kind, receipt: result.receipt} : result;
        const next: AuthorBrowserPersonaPendingV1 = {...envelope, state: result ? 'terminal' : 'unknown',
            result: stored, code: result?.kind === 'refused' ? result.code : code};
        if (index === -1) operations.push(next);
        else operations[index] = next;
        writePersonas(envelope.sessionId, operations);
        return next;
    }
    return {read, begin, record, readWorldbooks, beginWorldbook, recordWorldbook, releaseLegacyWorldbook,
        readPersonas, beginPersona, recordPersona};
}

export function pendingBrowserRequest(envelope: AuthorBrowserPendingV1): BrowserSaveRequestV1 {
    return {...envelope.child, expected: envelope.operation.expected, values: envelope.operation.values};
}
