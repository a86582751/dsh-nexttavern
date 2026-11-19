import type {AuthorWorldbookBindingCaptureV1,AuthorWorldbookBindingSelectionV1,
  AuthorWorldbookCatalogCaptureV1,AuthorWorldbookReceiptV1,AuthorWorldbookRefV1}
  from './roleplay-author-worldbook-types.js'

export type WorldbookLibraryBindingTargetV1='profile'|'character'|'chat'

export interface WorldbookLibraryDataV1 {
  readonly schemaVersion:1
  readonly sessionId:string
  readonly catalog:AuthorWorldbookCatalogCaptureV1
  readonly bindings:Readonly<Record<WorldbookLibraryBindingTargetV1,AuthorWorldbookBindingCaptureV1>>
}

interface WorldbookLibraryOperationV1 {
  readonly sessionId:string
  readonly operationId:string
}

export type WorldbookLibraryRequestV1=WorldbookLibraryOperationV1&(
  |{readonly action:'import';readonly expectedCatalogHead:AuthorWorldbookRefV1|null;
    readonly fileName:string;readonly json:string}
  |{readonly action:'bind';readonly target:WorldbookLibraryBindingTargetV1;
    readonly expectedOwner:AuthorWorldbookBindingCaptureV1['owner'];
    readonly expectedHead:AuthorWorldbookRefV1|null;readonly selection:AuthorWorldbookBindingSelectionV1})

export type WorldbookLibraryReplyV1=
  |{readonly schemaVersion:1;readonly ok:true;readonly library:WorldbookLibraryDataV1;
    readonly receipt?:AuthorWorldbookReceiptV1;readonly bookId?:string;readonly historical?:true}
  |{readonly schemaVersion:1;readonly ok:false;readonly code:string;readonly error:string;
    readonly outcome:'no-write'|'unknown';readonly operationId?:string;readonly receipt?:AuthorWorldbookReceiptV1}
