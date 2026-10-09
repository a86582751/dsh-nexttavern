/** Complete parsed Source DATA. Browser3 admission and live ownership are separate. */
import type {BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'

/** Original HTML and parsed payload offsets are UTF-16, half-open. */
export interface HtmlSpanV1 {readonly start:number;readonly end:number}
export interface HtmlCarrierV1 {
  readonly originalOrdinal:number
  readonly identity:string
  readonly pointer:string
  readonly descriptorSha256:string
}
export interface SourceHtmlInputV1 {
  readonly schemaVersion:1
  readonly encoding:'source-html-compile-input-v1'
  readonly source:BrowserProgramSourceLocatorV1
  readonly carrier:HtmlCarrierV1
  readonly resourcePath:readonly ['data','html']
  readonly html:string
}
/** The Source/frame-mount join is provenance DATA, never a live attachment. */
export interface SourcePageOriginV1 {
  readonly source:BrowserProgramSourceLocatorV1
  readonly carrier:HtmlCarrierV1
  readonly resourcePath:readonly ['data','html']
  readonly htmlSha256:string
  readonly htmlUtf8Bytes:number
  readonly htmlUtf16Length:number
}
export interface HtmlAttributeV1 {
  readonly name:string
  readonly value:string
  readonly namespace?:string
  readonly prefix?:string
}
export type HtmlDocumentModeV1='no-quirks'|'quirks'|'limited-quirks'
/** Script/style text references avoid copying their payload into DOM steps. */
export type HtmlParsedTextV1={readonly kind:'literal';readonly value:string}
  |{readonly kind:'script';readonly inlineOrdinal:number}
  |{readonly kind:'style';readonly styleOrdinal:number}
interface HtmlNodeBaseV1 {readonly nodeId:number;readonly span:HtmlSpanV1|null}
export type HtmlParsedNodeV1=HtmlNodeBaseV1&(
  |{readonly kind:'document';readonly mode:HtmlDocumentModeV1;readonly children:readonly number[]}
  |{readonly kind:'fragment';readonly children:readonly number[]}
  |{readonly kind:'element';readonly tagName:string;readonly namespaceURI:string;
    readonly attributes:readonly HtmlAttributeV1[];readonly children:readonly number[];readonly templateContent:number|null}
  |{readonly kind:'doctype';readonly name:string;readonly publicId:string;readonly systemId:string}
  |{readonly kind:'text';readonly text:HtmlParsedTextV1}
  |{readonly kind:'comment';readonly data:string})
export type HtmlNodeCreationV1=
  |{readonly kind:'document';readonly nodeId:number;readonly mode:HtmlDocumentModeV1}
  |{readonly kind:'fragment';readonly nodeId:number}
  |{readonly kind:'element';readonly nodeId:number;readonly tagName:string;readonly namespaceURI:string;
    readonly attributes:readonly HtmlAttributeV1[]}
  |{readonly kind:'doctype';readonly nodeId:number;readonly name:string;readonly publicId:string;readonly systemId:string}
  |{readonly kind:'text';readonly nodeId:number;readonly textSpan:HtmlSpanV1}
  |{readonly kind:'comment';readonly nodeId:number;readonly data:string}
/** Replay applies effects to live node IDs, not successive final-tree resets.
 * Text spans index that node's final payload. Adjacent appends to the same
 * node are combined, without crossing a script boundary or another effect. */
export type HtmlParserStepV1=
  |{readonly kind:'create-node';readonly node:HtmlNodeCreationV1}
  |{readonly kind:'append-child';readonly parentId:number;readonly nodeId:number}
  |{readonly kind:'insert-before';readonly parentId:number;readonly nodeId:number;readonly referenceId:number}
  |{readonly kind:'detach-node';readonly nodeId:number}
  |{readonly kind:'append-text';readonly nodeId:number;readonly textSpan:HtmlSpanV1}
  |{readonly kind:'adopt-attributes';readonly nodeId:number;readonly attributes:readonly HtmlAttributeV1[]}
  |{readonly kind:'set-template-content';readonly nodeId:number;readonly contentId:number}
  |{readonly kind:'set-doctype';readonly nodeId:number;readonly name:string;readonly publicId:string;readonly systemId:string}
  |{readonly kind:'set-document-mode';readonly nodeId:number;readonly mode:HtmlDocumentModeV1}
  |{readonly kind:'script-boundary';readonly nodeId:number;readonly inlineOrdinal:number}
  |{readonly kind:'end-document'}
export interface HtmlParseDiagnosticV1 {
  readonly phase:'html'|'javascript'|'css'
  readonly code:string
  readonly message?:string
  readonly nodeId?:number
  readonly inlineOrdinal?:number
  readonly styleOrdinal?:number
  /** Original HTML for HTML diagnostics; parsed JS/CSS payload for the others. */
  readonly span:HtmlSpanV1|null
}
export type HtmlSyntacticMemberV1={readonly kind:'identifier';readonly name:string}
  |{readonly kind:'property';readonly name:string}
  |{readonly kind:'computed';readonly literalName:string|null}
  |{readonly kind:'other'}
/** These are syntax candidates. Even literal names/keys grant no host rights. */
export interface HtmlCallCandidateV1 {
  readonly span:HtmlSpanV1
  readonly calleeSpan:HtmlSpanV1
  readonly callee:HtmlSyntacticMemberV1
  readonly argumentSpans:readonly HtmlSpanV1[]
}
export interface HtmlAssignmentCandidateV1 {
  readonly span:HtmlSpanV1
  readonly targetSpan:HtmlSpanV1
  readonly target:HtmlSyntacticMemberV1
  readonly valueSpan:HtmlSpanV1
  readonly operator:number
}
export interface HtmlJavascriptAstCoverageV1 {
  readonly encoding:'html-complete-javascript-ast-coverage-v1'
  readonly javascriptSha256:string
  readonly nodeCount:number
  readonly maxDepth:number
  /** Complete preorder walk: fullStart, end, TS 5.9.3 SyntaxKind, depth. */
  readonly nodes:readonly (readonly [number,number,number,number])[]
  readonly syntaxDiagnostics:readonly HtmlParseDiagnosticV1[]
  readonly calls:readonly HtmlCallCandidateV1[]
  readonly assignments:readonly HtmlAssignmentCandidateV1[]
}
export interface HtmlParsedScriptV1 {
  readonly inlineOrdinal:number
  readonly nodeId:number
  /** MIME/language/source attributes remain available to actual admission. */
  readonly mode:'classic'|'module'|'data'
  readonly inTemplate:boolean
  readonly attributes:readonly HtmlAttributeV1[]
  readonly tagSpan:HtmlSpanV1
  readonly bodySpan:HtmlSpanV1
  readonly originalBodySha256:string
  readonly javascript:string
  readonly javascriptSha256:string
  readonly ast:HtmlJavascriptAstCoverageV1|null
}
export interface HtmlParsedStyleV1 {
  readonly styleOrdinal:number
  readonly nodeId:number
  readonly kind:'stylesheet'|'style-attribute'
  /** Body span for STYLE, complete raw attribute span for a style attribute. */
  readonly htmlSpan:HtmlSpanV1
  readonly originalSourceSha256:string
  readonly css:string
  readonly cssSha256:string
  readonly cssNodeCount:number
  readonly diagnostics:readonly HtmlParseDiagnosticV1[]
}
export interface HtmlLiteralResourceCandidateV1 {
  readonly kind:'attribute-url'|'css-url'|'css-import'
  readonly nodeId:number
  readonly attributeName?:string
  readonly styleOrdinal?:number
  readonly value:string
  /** Original raw attribute span, or parsed CSS payload span. */
  readonly span:HtmlSpanV1|null
}
export interface HtmlParsedCandidateV1 {
  readonly schemaVersion:1
  readonly encoding:'source-html-parsed-candidate-v1'
  readonly authority:'parsed-source-data-only'
  readonly origin:SourcePageOriginV1
  readonly parser:{readonly html:'parse5';readonly htmlVersion:'8.0.1';
    readonly css:'css-tree';readonly cssVersion:'3.2.1';readonly javascript:'typescript';readonly javascriptVersion:'5.9.3'}
  readonly document:{readonly documentNodeId:number;readonly mode:HtmlDocumentModeV1;
    readonly nodes:readonly HtmlParsedNodeV1[]}
  readonly steps:readonly HtmlParserStepV1[]
  readonly scripts:readonly HtmlParsedScriptV1[]
  readonly styles:readonly HtmlParsedStyleV1[]
  readonly resources:readonly HtmlLiteralResourceCandidateV1[]
  readonly diagnostics:readonly HtmlParseDiagnosticV1[]
  readonly candidateSha256:string
}
