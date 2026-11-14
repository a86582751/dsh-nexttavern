import type {AuthorNativeBindingV1} from '../core/author-native-helper-types.js';
import type {AuthorNativeSaveRequestV1,AuthorNativeWorldbookRequestV1,AuthorNativePersonaRequestV1,
    AuthorNativeWorldbookReplyV1,AuthorNativePersonaReplyV1}
    from '../core/roleplay-author-browser-types.js';
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from '../core/roleplay-mvu-player-types.js';

import type {TavernLoreMutationRetryLocatorV1}
    from '../core/roleplay-tavern-lore-edits-types.js';
import type {ReaderRegexDocumentBindingV1,ReaderOpeningVariantResultV1}
    from '../core/reader-regex-document-types.mjs';
import type {OpeningVariantMutationRequestV1} from '../core/roleplay-opening-variant-types.js';
import type {AuthorMessageBodyRequestV1,AuthorMessageEditResultV1,ReaderMessageEditOriginV1} from '../core/roleplay-author-message-edit-types.js';

type WorldbookResult = AuthorNativeWorldbookReplyV1['result'];
export interface AuthorBrowserWorldbookPendingV2 {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-worldbook-pending-v2';
    binding: AuthorNativeBindingV1;
    sessionId: string;
    operationId: string;
    name: string;
    state: 'pending' | 'unknown' | 'terminal';
    result?: WorldbookResult;
    code?: string;
    scope: AuthorBrowserWorldbookPendingScopeV2;
}
export type AuthorBrowserWorldbookPendingScopeV2={kind:'known-namespace';identitySha256:string};
interface WorldbookPendingCollectionV2 {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-worldbook-operations-v2';
    sessionId: string;
    operations: AuthorBrowserWorldbookPendingV2[];
}
// Native helper outboxes are separate from unpublished VM test records.
const worldbookKey = (sessionId: string) => 'nexttavern.author-native.worldbook-pending.v1:' + sessionId;
export const terminalWorldbookReceipt = (result: WorldbookResult) => result.kind === 'edited-data'
    || result.diagnostics.some(value => value.code === 'OPERATION_NOT_RECORDED');
function worldbookResultScope(result?: WorldbookResult): AuthorBrowserWorldbookPendingScopeV2 | undefined {
    if (result?.kind === 'edited-data') return {kind: 'known-namespace', identitySha256: result.receipt.identitySha256};
    if (result?.kind !== 'refused') return;
    const recovery = result.diagnostics.find(value => value.recovery)?.recovery;
    if (recovery) return {kind: 'known-namespace', identitySha256: recovery.identitySha256};
}
export function worldbookPendingRetryLocator(envelope: AuthorBrowserWorldbookPendingV2):
    TavernLoreMutationRetryLocatorV1 | undefined {
    const scope = envelope.scope;
    return {identitySha256:scope.identitySha256};
}
export function worldbookPendingBlocksNamespace(envelope: AuthorBrowserWorldbookPendingV2,
    identitySha256: string | undefined): boolean {
    if (envelope.state === 'terminal') return false;
    const scope = envelope.scope;
    return scope.identitySha256 === identitySha256;
}

type PersonaResult = AuthorNativePersonaReplyV1['result'];
type PersonaStoredResult = Pick<Extract<PersonaResult, {kind: 'committed'}>, 'schemaVersion' | 'kind' | 'receipt'>
    | Extract<PersonaResult, {kind: 'refused'}>;
export interface AuthorBrowserPersonaPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-persona-pending-v1';
    binding: AuthorNativeBindingV1;
    sessionId: string;
    operationId: string;
    realmId: string;
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
const personaKey = (sessionId: string) => 'nexttavern.author-native.persona-pending.v1:' + sessionId;

export interface NumericalPendingV2 {
    schemaVersion: 2;
    encoding: 'nexttavern-numerical-pending-v2';
    origin: {kind:'helper';binding:AuthorNativeBindingV1;child:AuthorNativeSaveRequestV1}
        |{kind:'reader';binding:ReaderRegexDocumentBindingV1;documentPlanSha256:string;readRevision:number};
    // Values and expected occur exactly once. Retry reconstructs the child DATA
    // from this fixed operation; author code is never called for a retry.
    operation: MvuPlayerEditRequest;
    state: 'pending' | 'unknown' | 'terminal';
    receipt?: Pick<MvuPlayerEditResponse, 'ok' | 'operation' | 'code' | 'error'>;
}
const key = (sessionId: string) => 'nexttavern.author-native.numerical-pending.v1:' + sessionId;
export type AuthorNativeNumericalRequestV1=AuthorNativeSaveRequestV1&Pick<MvuPlayerEditRequest,'expected'|'values'|'target'>;
export const terminalBrowserReceipt = (result: MvuPlayerEditResponse) =>
    result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';

export interface ReaderOpeningVariantPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-reader-opening-variant-pending-v1';
    binding: ReaderRegexDocumentBindingV1;
    documentPlanSha256: string;
    request: OpeningVariantMutationRequestV1;
    state: 'pending' | 'unknown' | 'terminal';
    result?: ReaderOpeningVariantResultV1;
    code?: string;
    manualReleased?: boolean;
}
const readerKey = (sessionId: string) => 'nexttavern.reader.opening-variant-pending.v1:' + sessionId;

export interface AuthorNativeOpeningPendingV1 {
    readonly schemaVersion:1;
    readonly encoding:'author-native-opening-pending-v1';
    readonly binding:AuthorNativeBindingV1;
    readonly realmId:string;
    readonly request:OpeningVariantMutationRequestV1;
    readonly state:'pending'|'unknown'|'terminal';
    readonly result?:ReaderOpeningVariantResultV1;
    readonly manualReleased?:boolean;
}
const openingKey=(sid:string)=>'nexttavern.author-native.opening-pending.v1:'+sid;

export interface AuthorNativeMessageBodyPendingV1 {
    readonly schemaVersion:1;
    readonly encoding:'author-native-message-body-pending-v1';
    readonly binding:AuthorNativeBindingV1;
    readonly sourceProgramSha256:string;
    readonly realmId:string;
    readonly request:AuthorMessageBodyRequestV1;
    readonly state:'pending'|'unknown'|'terminal';
    readonly result?:AuthorMessageEditResultV1;
    readonly code?:string;
}
export interface ReaderMessageBodyPendingV1 {
    readonly schemaVersion:1;
    readonly encoding:'reader-message-body-pending-v1';
    readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;
    readonly origin:ReaderMessageEditOriginV1;
    readonly request:AuthorMessageBodyRequestV1;
    readonly state:'pending'|'unknown'|'terminal';
    readonly result?:AuthorMessageEditResultV1;
    readonly code?:string;
}
export type MessageBodyPendingV1=AuthorNativeMessageBodyPendingV1|ReaderMessageBodyPendingV1;
interface AuthorNativeMessagePendingCollectionV1 {
    readonly schemaVersion:1;
    readonly encoding:'author-native-message-operations-v1';
    readonly opening?:AuthorNativeOpeningPendingV1;
    readonly messageBodies:readonly MessageBodyPendingV1[];
}

export function createAuthorBrowserPendingStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    function readMessageOperations(sid:string):AuthorNativeMessagePendingCollectionV1 {
        const bytes=storage.getItem(openingKey(sid));
        if(!bytes)return {schemaVersion:1,encoding:'author-native-message-operations-v1',messageBodies:[]};
        const value=JSON.parse(bytes) as AuthorNativeMessagePendingCollectionV1|AuthorNativeOpeningPendingV1;
        // Preserve the actual opening outbox already stored by this development
        // runtime when its shared message collection is first written.
        return value.encoding==='author-native-opening-pending-v1'
            ?{schemaVersion:1,encoding:'author-native-message-operations-v1',opening:value,messageBodies:[]}:value;
    }
    function writeMessageOperations(sid:string,value:AuthorNativeMessagePendingCollectionV1) {
        storage.setItem(openingKey(sid),JSON.stringify(value));
    }
    function readOpening(sid:string):AuthorNativeOpeningPendingV1|undefined {
        return readMessageOperations(sid).opening;
    }
    function beginOpening(binding:AuthorNativeBindingV1,realmId:string,request:OpeningVariantMutationRequestV1) {
        const previous=readOpening(binding.sessionId);
        if(previous&&previous.state!=='terminal')
            throw Error('READER_OPENING_VARIANTS_CONFIRMATION_REQUIRED');
        const envelope:AuthorNativeOpeningPendingV1={schemaVersion:1,encoding:'author-native-opening-pending-v1',
            binding,realmId,request,state:'pending'};
        writeMessageOperations(binding.sessionId,{...readMessageOperations(binding.sessionId),opening:envelope});
        return readOpening(binding.sessionId)!;
    }
    function recordOpening(envelope:AuthorNativeOpeningPendingV1,result?:ReaderOpeningVariantResultV1) {
        const previous=readOpening(envelope.binding.sessionId);
        if(previous?.request.operationId!==envelope.request.operationId)return previous??envelope;
        if(previous.result?.kind==='committed')return previous;
        const next:AuthorNativeOpeningPendingV1={...envelope,result,state:result&&result.kind!=='unknown'?'terminal':'unknown'};
        writeMessageOperations(envelope.binding.sessionId,{...readMessageOperations(envelope.binding.sessionId),opening:next});
        return next;
    }
    function releaseOpening(envelope:AuthorNativeOpeningPendingV1) {
        const previous=readOpening(envelope.binding.sessionId);
        if(previous?.request.operationId===envelope.request.operationId)
            writeMessageOperations(envelope.binding.sessionId,{...readMessageOperations(envelope.binding.sessionId),
                opening:{...previous,manualReleased:true}});
    }
    function readBodies(sid:string):readonly AuthorNativeMessageBodyPendingV1[] {
        return readMessageOperations(sid).messageBodies.filter((row):row is AuthorNativeMessageBodyPendingV1=>
            row.encoding==='author-native-message-body-pending-v1');
    }
    function readReaderBodies(sid:string):readonly ReaderMessageBodyPendingV1[] {
        return readMessageOperations(sid).messageBodies.filter((row):row is ReaderMessageBodyPendingV1=>
            row.encoding==='reader-message-body-pending-v1');
    }
    function persistBody<T extends MessageBodyPendingV1>(envelope:T):T {
        const {binding,request}=envelope,collection=readMessageOperations(binding.sessionId);
        if(collection.messageBodies.some(row=>row.state!=='terminal'
            &&row.request.expected.seq===request.expected.seq&&row.request.expected.messageId===request.expected.messageId))
            throw Error('AUTHOR_NATIVE_MESSAGE_BODY_CONFIRMATION_REQUIRED');
        writeMessageOperations(binding.sessionId,{...collection,
            messageBodies:[...collection.messageBodies.filter(row=>row.state!=='terminal'),envelope]});
        return readMessageOperations(binding.sessionId).messageBodies.find(row=>row.request.operationId===request.operationId)! as T;
    }
    function beginBody(binding:AuthorNativeBindingV1,sourceProgramSha256:string,realmId:string,request:AuthorMessageBodyRequestV1) {
        return persistBody({schemaVersion:1,encoding:'author-native-message-body-pending-v1',
            binding,sourceProgramSha256,realmId,request,state:'pending'} as AuthorNativeMessageBodyPendingV1);
    }
    function beginReaderBody(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
        origin:ReaderMessageEditOriginV1,request:AuthorMessageBodyRequestV1) {
        return persistBody({schemaVersion:1,encoding:'reader-message-body-pending-v1',
            binding,documentPlanSha256,origin,request,state:'pending'} as ReaderMessageBodyPendingV1);
    }
    function recordBody<T extends MessageBodyPendingV1>(envelope:T,result?:AuthorMessageEditResultV1,code?:string):T {
        const sid=envelope.binding.sessionId,collection=readMessageOperations(sid),
            previous=collection.messageBodies.find(row=>row.request.operationId===envelope.request.operationId);
        if(!previous)return envelope;
        if(previous.state==='terminal'&&(!result||previous.result?.kind==='committed'||result.kind!=='committed'))return previous as T;
        const next:MessageBodyPendingV1={...previous,result,code:result&&'code' in result?result.code:code,
            state:result&&result.kind!=='unknown'?'terminal':'unknown'};
        writeMessageOperations(sid,{...collection,messageBodies:collection.messageBodies.map(row=>row===previous?next:row)});
        return next as T;
    }
    function readReader(sessionId: string): ReaderOpeningVariantPendingV1 | undefined {
        const bytes = storage.getItem(readerKey(sessionId));
        if (!bytes) return;
        const envelope = JSON.parse(bytes) as ReaderOpeningVariantPendingV1;
        if (envelope.schemaVersion !== 1 || envelope.encoding !== 'nexttavern-reader-opening-variant-pending-v1'
            || envelope.binding.sessionId !== sessionId) throw Error('READER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function beginReader(binding: ReaderRegexDocumentBindingV1, documentPlanSha256: string,
        request: OpeningVariantMutationRequestV1): ReaderOpeningVariantPendingV1 {
        const previous = readReader(binding.sessionId);
        if (previous && previous.state !== 'terminal')
            throw Error('READER_OPENING_VARIANTS_CONFIRMATION_REQUIRED');
        const envelope: ReaderOpeningVariantPendingV1 = {schemaVersion: 1,
            encoding: 'nexttavern-reader-opening-variant-pending-v1', binding, documentPlanSha256, request, state: 'pending'};
        // Dispatch consumes the serialized original DATA. Storage failure must
        // precede admission, including for the next write in the same callback.
        storage.setItem(readerKey(binding.sessionId), JSON.stringify(envelope));
        return readReader(binding.sessionId)!;
    }
    function recordReader(envelope: ReaderOpeningVariantPendingV1, result?: ReaderOpeningVariantResultV1,
        code?: string): ReaderOpeningVariantPendingV1 {
        const previous = readReader(envelope.binding.sessionId);
        if (previous && previous.request.operationId !== envelope.request.operationId) return previous;
        if (previous?.request.operationId === envelope.request.operationId && previous.result?.kind === 'committed') return previous;
        const next: ReaderOpeningVariantPendingV1 = {...envelope,
            state: result && result.kind !== 'unknown' ? 'terminal' : 'unknown',
            ...(result ? {result} : {}), ...(code ? {code} : {})};
        if (previous?.request.operationId === envelope.request.operationId)
            storage.setItem(readerKey(envelope.binding.sessionId), JSON.stringify(next));
        return next;
    }
    function releaseReader(envelope: ReaderOpeningVariantPendingV1): void {
        const previous = readReader(envelope.binding.sessionId);
        if (previous?.request.operationId === envelope.request.operationId)
            storage.setItem(readerKey(envelope.binding.sessionId), JSON.stringify({...previous, manualReleased: true}));
    }
    function read(sessionId: string): NumericalPendingV2 | undefined {
        const bytes = storage.getItem(key(sessionId));
        if (!bytes) return;
        const envelope = JSON.parse(bytes) as NumericalPendingV2;
        if (envelope.schemaVersion !== 2 || envelope.encoding !== 'nexttavern-numerical-pending-v2'
            || envelope.operation.sessionId !== sessionId) throw Error('BROWSER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function persistNumerical<T extends NumericalPendingV2>(envelope:T):T {
        const sessionId=envelope.operation.sessionId,previous = read(sessionId);
        if (previous && previous.state !== 'terminal') {
            throw Error('BROWSER_SAVE_CONFIRMATION_REQUIRED');
        }
        // Freeze the submitted DATA through the one shared storage slot before
        // either Reader or helper dispatch. A storage failure blocks the write.
        storage.setItem(key(sessionId), JSON.stringify(envelope));
        return read(sessionId)! as T;
    }
    function begin(binding: AuthorNativeBindingV1, request: AuthorNativeNumericalRequestV1,operationId:string=crypto.randomUUID()) {
        return persistNumerical({
            schemaVersion: 2, encoding: 'nexttavern-numerical-pending-v2',
            origin:{kind:'helper',binding,child: {requestId: request.requestId, generation: request.generation,
                readRevision: request.readRevision, realmId: request.realmId}},
            operation: {schemaVersion: 1, sessionId: binding.sessionId, operationId,
                action: 'replace-values', expected: request.expected, values: request.values,
                ...request.target?{target:request.target}:{}},
            state: 'pending',
        });
    }
    function beginReaderNumerical(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,readRevision:number,
        operation:MvuPlayerEditRequest):NumericalPendingV2 {
        return persistNumerical({schemaVersion:2,encoding:'nexttavern-numerical-pending-v2',
            origin:{kind:'reader',binding,documentPlanSha256,readRevision},operation,state:'pending'});
    }
    function record(envelope: NumericalPendingV2, result?: MvuPlayerEditResponse) {
        const previous=read(envelope.operation.sessionId);
        if(previous?.operation.operationId===envelope.operation.operationId&&previous.state==='terminal')return previous;
        const next: NumericalPendingV2 = {...envelope,
            state: result && terminalBrowserReceipt(result) ? 'terminal' : 'unknown',
            ...(result ? {receipt: {ok: result.ok, operation: result.operation, code: result.code, error: result.error}} : {}),
        };
        // An old ACK may finish its old record, but cannot replace a newer
        // operation admitted by another view after terminal confirmation.
        if (previous?.operation.operationId === envelope.operation.operationId) {
            storage.setItem(key(envelope.operation.sessionId), JSON.stringify(next));
        }
        return next;
    }
    function readWorldbooks(sessionId: string): AuthorBrowserWorldbookPendingV2[] {
        const bytes = storage.getItem(worldbookKey(sessionId));
        if (!bytes) return [];
        const collection = JSON.parse(bytes) as WorldbookPendingCollectionV2;
        if (collection.schemaVersion !== 2 || collection.encoding !== 'nexttavern-author-browser-worldbook-operations-v2'
            ||collection.sessionId!==sessionId) {
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        }
        return collection.operations;
    }
    function writeWorldbooks(sessionId: string, operations: AuthorBrowserWorldbookPendingV2[]) {
        const collection: WorldbookPendingCollectionV2 = {schemaVersion: 2,
            encoding: 'nexttavern-author-browser-worldbook-operations-v2', sessionId, operations};
        storage.setItem(worldbookKey(sessionId), JSON.stringify(collection));
    }
    function beginWorldbook(binding: AuthorNativeBindingV1, request: AuthorNativeWorldbookRequestV1, identitySha256: string) {
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
        const scope=observedScope??previous.scope;
        const next: AuthorBrowserWorldbookPendingV2 = {...previous, scope,
            state: result && terminalWorldbookReceipt(result) ? 'terminal' : 'unknown',
            result: keptResult, code};
        if (index === -1) operations.push(next);
        else operations[index] = next;
        writeWorldbooks(envelope.sessionId, operations);
        return next;
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
    function beginPersona(binding: AuthorNativeBindingV1, request: AuthorNativePersonaRequestV1) {
        const operations = readPersonas(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous) return previous;
        const envelope: AuthorBrowserPersonaPendingV1 = {schemaVersion: 1,
            encoding: 'nexttavern-author-browser-persona-pending-v1', binding, sessionId: binding.sessionId,
            operationId: request.operationId, realmId: request.realmId, state: 'pending'};
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
    return {read, begin, beginReaderNumerical, record,
        readBodies,beginBody,readReaderBodies,beginReaderBody,recordBody,
        readOpening,beginOpening,recordOpening,releaseOpening,readReader,beginReader,recordReader,releaseReader,
        readWorldbooks, beginWorldbook, recordWorldbook,
        readPersonas, beginPersona, recordPersona};
}

export function pendingBrowserRequest(envelope: NumericalPendingV2): AuthorNativeNumericalRequestV1 {
    if(envelope.origin.kind!=='helper')throw Error('NUMERICAL_PENDING_HELPER_ORIGIN_REQUIRED');
    return {...envelope.origin.child, expected: envelope.operation.expected, values: envelope.operation.values,
        ...envelope.operation.target?{target:envelope.operation.target}:{}};
}
