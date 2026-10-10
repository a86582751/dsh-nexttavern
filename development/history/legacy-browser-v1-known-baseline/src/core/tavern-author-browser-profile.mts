/** Positive browser grammar and exact facade contract. Nothing in this file
 * implements a snapshot provider, a Promise bridge, or a BrowserSession. */
import {recordSha256} from './roleplay-data.js'
import type {BrowserCapabilityContractV1,BrowserCapabilityV1} from './tavern-author-browser-types.mjs'

export const BROWSER_BOUNDS_V1=Object.freeze({scripts:64,sourceBytes:1_048_576,javascriptBytes:4_194_304,
  syntaxTokens:64_000,syntaxNodes:64_000,syntaxDepth:128,synchronousWork:20_000})

export const BROWSER_CAPABILITIES_V1:readonly BrowserCapabilityV1[]=Object.freeze([
  'isolated-dom-text','isolated-dom-events','owned-variable-snapshot','owned-message-snapshot',
  'owned-numerical-snapshot','owned-numerical-player-save',
])
const contract={schemaVersion:1 as const,encoding:'native-author-browser-capability-contract-v1' as const,
  authority:'requirements-only' as const,capabilities:BROWSER_CAPABILITIES_V1,
  getters:'synchronous-proven-snapshot-or-explicit-denial' as const,
  writer:'nexttavern-replace-values-with-parent-owned-operation' as const,modelRequests:'none' as const}
export const BROWSER_CAPABILITY_CONTRACT_V1:BrowserCapabilityContractV1=Object.freeze({
  ...contract,contractSha256:recordSha256(contract),
})

export const BROWSER_GLOBALS_V1=Object.freeze([
  'root','document','getVariables','getChatMessages','NextTavern','String','Number','Boolean','JSON',
  'undefined','NaN','Infinity',
])
export const BROWSER_MISSING_HOSTS_V1=Object.freeze([
  'window','parent','top','self','globalThis','global','frames','opener','navigator','location',
  'localStorage','sessionStorage','indexedDB','TavernHelper','SillyTavern','fetch','XMLHttpRequest','WebSocket',
  'Worker','SharedWorker','importScripts','setTimeout','setInterval','requestAnimationFrame','queueMicrotask',
  'eval','Function','AsyncFunction','GeneratorFunction','process','require','module','exports',
  'getMvuData','updateVariablesWith','generateRaw','eventOn','eventOnce','waitGlobalInitialized',
])
export const BROWSER_TAGS_V1=Object.freeze(['div','p','button','span','section','label'])
export const BROWSER_EVENTS_V1=Object.freeze(['click','input','change'])
export const BROWSER_ATTRIBUTES_V1=Object.freeze(['id','class','title','aria-label'])
export const BROWSER_ESCAPE_PROPERTIES_V1=Object.freeze(['constructor','prototype','__proto__'])
export const BROWSER_BUILTIN_CALLS_V1=Object.freeze({
  JSON:['stringify'],
})

/** Exhaustive supported node kinds, not a blacklist over arbitrary statements.
 * Loops, generators, classes, imports/exports, JSX, regex and code reflection
 * require a different bounded execution path and are absent from this profile. */
export const BROWSER_SYNTAX_V1=Object.freeze([
  'SourceFile','EndOfFileToken','Block','VariableStatement','VariableDeclarationList','VariableDeclaration',
  'Identifier','ExpressionStatement','EmptyStatement','IfStatement','ReturnStatement','ThrowStatement',
  'TryStatement','CatchClause','SwitchStatement','CaseBlock','CaseClause','DefaultClause','BreakStatement',
  'FunctionDeclaration','FunctionExpression','ArrowFunction','MethodDeclaration','Parameter',
  'CallExpression','PropertyAccessExpression','ElementAccessExpression',
  'ParenthesizedExpression','BinaryExpression','PrefixUnaryExpression','PostfixUnaryExpression',
  'ConditionalExpression','AwaitExpression','ObjectLiteralExpression','PropertyAssignment',
  'ShorthandPropertyAssignment','ArrayLiteralExpression','SpreadAssignment',
  'ObjectBindingPattern','ArrayBindingPattern','BindingElement','OmittedExpression',
  'NumericLiteral','StringLiteral','NoSubstitutionTemplateLiteral','TrueKeyword','FalseKeyword','NullKeyword',
  'NumberKeyword','StringKeyword','BooleanKeyword','VoidKeyword','UnknownKeyword','LiteralType','UnionType',
  'AsyncKeyword','QuestionToken','ColonToken','QuestionDotToken','DotDotDotToken','EqualsGreaterThanToken',
  'EqualsToken','PlusToken','MinusToken','AsteriskToken','SlashToken','PercentToken','AsteriskAsteriskToken',
  'PlusPlusToken','MinusMinusToken','ExclamationToken','TildeToken','AmpersandToken','BarToken','CaretToken',
  'LessThanToken','GreaterThanToken','LessThanEqualsToken','GreaterThanEqualsToken',
  'EqualsEqualsToken','ExclamationEqualsToken','EqualsEqualsEqualsToken','ExclamationEqualsEqualsToken',
  'AmpersandAmpersandToken','BarBarToken','QuestionQuestionToken',
  'MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken',
])

/** The private checker sees real ES2023 declarations and these precise owned
 * host signatures. It does not load lib.dom or expose its unbounded globals.
 * These declarations must be fulfilled by the future real runtime provider. */
export const BROWSER_AMBIENT_V1=String.raw`
type BrowserJsonValueV1=null|boolean|number|string|BrowserJsonValueV1[]|{[key:string]:BrowserJsonValueV1};
interface BrowserJsonObjectV1 {[key:string]:BrowserJsonValueV1}
type BrowserVariableReadOptionV1={type:'chat'|'character'|'global'}
  |{type:'message';message_id?:number|'latest'}|{type:'script';script_id?:string};
interface BrowserChatMessageV1 {
  readonly position:number;readonly ownerSessionId:string;readonly nativeSeq:number;
  readonly messageId:string;readonly messageVersionSha256:string;readonly selectedVariant:string;
  readonly role:'user'|'assistant';readonly text:string;
}
interface BrowserPlayerExpectedV1 {
  readonly sourceSha256:string;readonly root:unknown;readonly revision:number;
  readonly headSha256:string;readonly valuesSha256:string;readonly stateSnapshotSha256:string;
  readonly observedNativeSeq:number;
}
type BrowserNumericalStateV1=
  |{readonly kind:'ready'|'schema-ready';readonly values:BrowserJsonObjectV1;
    readonly expected:BrowserPlayerExpectedV1;readonly canEdit:boolean;readonly editBlockCode?:string}
  |{readonly kind:'blocked';readonly code:string;readonly canEdit:false}
  |{readonly kind:'unknown';readonly code:string;readonly canEdit:false};
interface BrowserPlayerReplyV1 {
  readonly ok:boolean;readonly numericalState?:unknown;readonly code?:string;readonly error?:string;
  readonly operation?:{readonly operationId:string;readonly payloadSha256:string;
    readonly outcome:'updated'|'no-update'|'refused'|'unknown';readonly replayed:boolean;readonly refusalCode?:string};
}
interface BrowserDomEventV1 {preventDefault():void;stopPropagation():void}
type BrowserDomListenerV1=(event:BrowserDomEventV1)=>void|Promise<void>;
interface BrowserElementV1 {
  id:string;className:string;textContent:string|null;
  append(...nodes:(BrowserElementV1|string)[]):void;
  querySelector(selector:string):BrowserElementV1|null;
  setAttribute(name:string,value:string):void;
  addEventListener(type:'click'|'input'|'change',listener:BrowserDomListenerV1):void;
  removeEventListener(type:'click'|'input'|'change',listener:BrowserDomListenerV1):void;
}
interface BrowserButtonV1 extends BrowserElementV1 {disabled:boolean}
interface BrowserDocumentV1 {
  createElement(tag:'button'):BrowserButtonV1;
  createElement(tag:'div'|'p'|'span'|'section'|'label'):BrowserElementV1;
  querySelector(selector:string):BrowserElementV1|null;
}
interface BrowserNumericalBridgeV1 {
  getNumericalState():BrowserNumericalStateV1;
  replaceNumericalValues(values:BrowserJsonObjectV1,expected:BrowserPlayerExpectedV1):Promise<BrowserPlayerReplyV1>;
}
declare const root:BrowserElementV1;
declare const document:BrowserDocumentV1;
declare function getVariables(option?:BrowserVariableReadOptionV1):Readonly<BrowserJsonObjectV1>|undefined;
declare function getChatMessages():readonly BrowserChatMessageV1[];
declare const NextTavern:BrowserNumericalBridgeV1;
`

const profile={schemaVersion:1,id:'nexttavern-browser-dom-snapshot-player' as const,version:1 as const,
  bounds:BROWSER_BOUNDS_V1,globals:BROWSER_GLOBALS_V1,missingHosts:BROWSER_MISSING_HOSTS_V1,
  tags:BROWSER_TAGS_V1,events:BROWSER_EVENTS_V1,attributes:BROWSER_ATTRIBUTES_V1,
  escapeProperties:BROWSER_ESCAPE_PROPERTIES_V1,builtinCalls:BROWSER_BUILTIN_CALLS_V1,syntax:BROWSER_SYNTAX_V1,
  ambientSha256:recordSha256(BROWSER_AMBIENT_V1),
  capabilityContractSha256:BROWSER_CAPABILITY_CONTRACT_V1.contractSha256,
  controlFlow:'finite-statements-acyclic-local-call-graph-no-loop-callbacks',
  promiseOwnership:'direct-await-or-return-no-detached-calls',
  valuePolicy:'budgeted-plus-single-argument-json-primitive-conversion-owned-numerical-spread',
  outputBytes:16*1048576,snapshotBytes:64*1048576,
  eventRegistration:'startup-only-static-dom-events',html:'text-only-no-inline-script-admission'}
export const BROWSER_PROFILE_V1=Object.freeze({...profile,sha256:recordSha256(profile)})

