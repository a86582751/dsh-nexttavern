import type {AuthorNativeBindingV1} from '../core/author-native-helper-types.js';
import type {ReaderRegexDocumentBindingV1} from '../core/reader-regex-document-types.mjs';
import type {OrdinaryAuthorChatBatchUpdateV3}
    from '../core/roleplay-author-chat-state-types.js';

interface OrdinaryNamespacePendingV2 {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-ordinary-pending-v2';
    browserBinding: AuthorNativeBindingV1;
    operation: OrdinaryAuthorChatBatchUpdateV3;
    state: 'pending' | 'unknown';
    code?: string;
    manualReleased?: boolean;
}
export interface AuthorBrowserOrdinaryNamespacePendingV2 extends OrdinaryNamespacePendingV2 {
    readonly principal?:'helper';
}
export interface ReaderOrdinaryNamespacePendingV2 extends OrdinaryNamespacePendingV2 {
    readonly principal:'reader-regex-document';
    readonly browserBinding:ReaderRegexDocumentBindingV1;
}
export type AuthorBrowserOrdinaryPending=AuthorBrowserOrdinaryNamespacePendingV2|ReaderOrdinaryNamespacePendingV2;
interface Collection {
    schemaVersion: 2;
    encoding: 'nexttavern-author-browser-ordinary-operations-v2';
    sessionId: string;
    operations: AuthorBrowserOrdinaryPending[];
}
const storageKey=(sid:string)=>'nexttavern.author-native.namespace-pending.v1:'+sid;
type OrdinaryAddress=Pick<OrdinaryAuthorChatBatchUpdateV3,'namespace'>;
export function sameOrdinarySource(a:OrdinaryAddress,b:OrdinaryAddress):boolean {
    const left=a.namespace.importIncarnation,right=b.namespace.importIncarnation;
    if(a.namespace.sessionId!==b.namespace.sessionId)return false;
    if(left===null||right===null)return left===right;
    return left.sourceRecordSessionId===right.sourceRecordSessionId&&left.importId===right.importId
        &&left.transactionId===right.transactionId&&left.activationSha256===right.activationSha256;
}
export function sameOrdinaryAddress(a:OrdinaryAddress,b:OrdinaryAddress):boolean {
    if(!sameOrdinarySource(a,b))return false;
    const left=a.namespace.target,right=b.namespace.target;
    if(!left||!right)return left===right;
    if(left.kind==='script')return right.kind==='script'&&left.identity.scriptIdentity===right.identity.scriptIdentity;
    if(right.kind!=='message')return false;
    const aMessage=left.identity,bMessage=right.identity;
    return aMessage.ownerSessionId===bMessage.ownerSessionId&&aMessage.nativeSeq===bMessage.nativeSeq
        &&aMessage.messageId===bMessage.messageId&&aMessage.variant.kind===bMessage.variant.kind
        &&(aMessage.variant.kind!=='opening-variant'||bMessage.variant.kind==='opening-variant'&&aMessage.variant.id===bMessage.variant.id);
}

/** The outbox owns dispatch DATA only. State2 owns receipts and every write. */
export function createAuthorBrowserOrdinaryPendingStore(storage:Pick<Storage,'getItem'|'setItem'>) {
    // These facts live only in this consumer. A failed local write cannot
    // undo a canonical ACK or the user's decision to display current DATA.
    const acknowledged=new Set<string>(),released=new Set<string>();
    const identity=(operation:OrdinaryAuthorChatBatchUpdateV3)=>{
        const namespace=operation.namespace,imported=namespace.importIncarnation;
        return JSON.stringify([namespace.sessionId,imported?[imported.sourceRecordSessionId,imported.importId,
            imported.transactionId,imported.activationSha256]:null,namespace.target??null,operation.operationId]);
    };
    function stored(sid:string):AuthorBrowserOrdinaryPending[] {
        const bytes=storage.getItem(storageKey(sid));
        if(!bytes)return [];
        const record=JSON.parse(bytes) as Collection;
        if(!(record.schemaVersion===2&&record.encoding==='nexttavern-author-browser-ordinary-operations-v2')
            ||record.sessionId!==sid)throw Error('AUTHOR_CHAT_PENDING_FORMAT_UNSUPPORTED');
        return record.operations;
    }
    function read(sid:string):AuthorBrowserOrdinaryPending[] {
        const result:AuthorBrowserOrdinaryPending[]=[];
        for(const row of stored(sid)) {
            const key=identity(row.operation);
            if(!acknowledged.has(key))result.push(released.has(key)?{...row,manualReleased:true}:row);
        }
        return result;
    }
    function readHelper(sid:string):AuthorBrowserOrdinaryNamespacePendingV2[] {
        return read(sid).filter((row):row is AuthorBrowserOrdinaryNamespacePendingV2=>row.principal!=='reader-regex-document');
    }
    function readReader(sid:string):ReaderOrdinaryNamespacePendingV2[] {
        return read(sid).filter((row):row is ReaderOrdinaryNamespacePendingV2=>row.principal==='reader-regex-document');
    }
    function write(sid:string,operations:AuthorBrowserOrdinaryPending[]):void {
        storage.setItem(storageKey(sid),JSON.stringify({schemaVersion:2,
            encoding:'nexttavern-author-browser-ordinary-operations-v2',sessionId:sid,operations} satisfies Collection));
    }
    function change(envelope:AuthorBrowserOrdinaryPending,
        update:(row:AuthorBrowserOrdinaryPending)=>AuthorBrowserOrdinaryPending|undefined):void {
        const operation=envelope.operation,rows=stored(operation.namespace.sessionId);
        const key=identity(operation),index=rows.findIndex(row=>identity(row.operation)===key);
        if(index<0)return;
        const next=update(rows[index]!);
        if(next)rows[index]=next;else rows.splice(index,1);
        write(operation.namespace.sessionId,rows);
    }
    function persist<T extends AuthorBrowserOrdinaryPending>(envelope:T):T {
            const {operation}=envelope,sid=operation.namespace.sessionId,rows=read(sid);
            if(rows.some(row=>!row.manualReleased&&sameOrdinaryAddress(row.operation,operation)))
                throw Error('AUTHOR_CHAT_CONFIRMATION_REQUIRED');
            rows.push(envelope);
            // Storage must succeed before dispatch. Reading the serialized row
            // also detaches expected/value from the author's mutable request.
            write(sid,rows);
            return read(sid).at(-1)! as T;
    }
    function begin(browserBinding:AuthorNativeBindingV1,operation:OrdinaryAuthorChatBatchUpdateV3):AuthorBrowserOrdinaryNamespacePendingV2 {
        return persist({schemaVersion:2,encoding:'nexttavern-author-browser-ordinary-pending-v2',browserBinding,operation,state:'pending'});
    }
    function beginReader(browserBinding:ReaderRegexDocumentBindingV1,operation:OrdinaryAuthorChatBatchUpdateV3):ReaderOrdinaryNamespacePendingV2 {
        return persist({schemaVersion:2,encoding:'nexttavern-author-browser-ordinary-pending-v2',
            principal:'reader-regex-document',browserBinding,operation,state:'pending'});
    }
    return {
        read,readHelper,readReader,begin,beginReader,
        unknown(envelope:AuthorBrowserOrdinaryPending,code:string):void {
            change(envelope,row=>({...row,state:'unknown',code}));
        },
        acknowledge(envelope:AuthorBrowserOrdinaryPending):void {
            // State2 retains the append-only receipt. Only this exact local
            // dispatch is retired; a late ACK cannot remove a newer operation.
            const key=identity(envelope.operation);
            try {change(envelope,()=>undefined);acknowledged.delete(key);}
            catch(error) {acknowledged.add(key);throw error;}
        },
        release(envelope:AuthorBrowserOrdinaryPending):void {
            const key=identity(envelope.operation);
            try {change(envelope,row=>({...row,manualReleased:true}));released.delete(key);}
            catch(error) {released.add(key);throw error;}
        },
    };
}
