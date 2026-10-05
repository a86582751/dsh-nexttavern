// Generated from runtime/alpha3/src/core/tavern-author-prompt-profile.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
export const PROMPT_BOUNDS_V1 = Object.freeze({ scripts: 64, sourceBytes: 1_048_576, nodes: 64_000, depth: 128,
    memoryBytes: 134_217_728, stackBytes: 1_048_576, vmDeadlineMs: 2000, parentDeadlineMs: 10_000,
    outputBytes: 2_097_152, effects: 256, callbacks: 256 });
export const PROMPT_PROFILE_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-author-prompt-profile-v1', registration: 'GENERATION_AFTER_COMMANDS',
    cleanup: 'Source-close-fixed-id-removal-only', reinstantiation: 'stateless-captured-input-v1',
    clock: 'capture-fixed', random: 'capture-seeded', messages: 'actual-native-capture',
    messageRanges: 'ST-clamped-sorted-indices; captured-lastMessageId-macro; unparseable-empty',
    variants: 'proven-opening-candidates-or-explicit-unsupported', variables: 'direct-owned-readonly-capture-tables',
    effects: 'ordered-inject-remove-consumer-data', modelRequests: { normal: 0, retry: 0, fallback: 0 }, bounds: PROMPT_BOUNDS_V1 });
export const PROMPT_PROFILE_SHA256_V1 = recordSha256(PROMPT_PROFILE_V1);
export const PROMPT_GLOBALS_V1 = new Set(['eventOn', 'tavern_events', 'getChatMessages', 'getVariables',
    'injectPrompts', 'uninjectPrompts', 'window', 'String', 'Number', 'Boolean', 'Object', 'Array', 'JSON',
    'Math', 'Date', 'RegExp', 'Set', 'Map', 'undefined', 'NaN', 'Infinity', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
export const PROMPT_ESCAPE_PROPERTIES_V1 = new Set(['constructor', 'prototype', '__proto__',
    'eval', 'Function', 'then', 'caller', 'callee', 'arguments']);
export const PROMPT_MUTATING_METHODS_V1 = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse',
    'fill', 'copyWithin', 'add', 'set', 'delete', 'clear', 'setTime', 'setDate', 'setMonth', 'setFullYear',
    'setHours', 'setMinutes', 'setSeconds', 'setMilliseconds', 'setUTCDate', 'setUTCMonth', 'setUTCFullYear',
    'setUTCHours', 'setUTCMinutes', 'setUTCSeconds', 'setUTCMilliseconds']);
export const PROMPT_GLOBAL_MEMBERS_V1 = Object.freeze({
    window: ['addEventListener'], tavern_events: ['GENERATION_AFTER_COMMANDS'],
    Object: ['keys', 'values', 'entries', 'fromEntries', 'hasOwn', 'is', 'freeze'], Array: ['isArray', 'from', 'of'],
    String: ['fromCharCode', 'fromCodePoint', 'raw'], Number: ['isInteger', 'isSafeInteger', 'isFinite', 'isNaN',
        'parseInt', 'parseFloat', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'MAX_VALUE', 'MIN_VALUE', 'EPSILON'],
    Date: ['now', 'parse', 'UTC'], JSON: ['parse', 'stringify'],
    Math: ['abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh', 'cbrt', 'ceil', 'clz32', 'cos', 'cosh',
        'exp', 'expm1', 'floor', 'fround', 'hypot', 'imul', 'log', 'log10', 'log1p', 'log2', 'max', 'min', 'pow', 'random',
        'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc', 'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E', 'PI', 'SQRT1_2', 'SQRT2'],
});
/** Explicit executable grammar. Every descendant of every dormant branch is
 * checked; runtime interrupts additionally bound recursion and collection work. */
export const PROMPT_SYNTAX_V1 = new Set([
    'SourceFile', 'EndOfFileToken', 'Block', 'VariableStatement', 'VariableDeclarationList', 'VariableDeclaration',
    'Identifier', 'ExpressionStatement', 'EmptyStatement', 'IfStatement', 'ReturnStatement', 'ThrowStatement',
    'TryStatement', 'CatchClause', 'SwitchStatement', 'CaseBlock', 'CaseClause', 'DefaultClause', 'BreakStatement',
    'ContinueStatement', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'Parameter',
    'CallExpression', 'NewExpression', 'PropertyAccessExpression', 'ElementAccessExpression',
    'ParenthesizedExpression', 'BinaryExpression', 'PrefixUnaryExpression', 'PostfixUnaryExpression',
    'ConditionalExpression', 'ObjectLiteralExpression', 'PropertyAssignment', 'ShorthandPropertyAssignment',
    'ArrayLiteralExpression', 'SpreadAssignment', 'SpreadElement', 'ObjectBindingPattern', 'ArrayBindingPattern',
    'BindingElement', 'OmittedExpression', 'NumericLiteral', 'StringLiteral', 'NoSubstitutionTemplateLiteral',
    'RegularExpressionLiteral', 'TemplateExpression', 'TemplateSpan', 'TemplateHead', 'TemplateMiddle', 'TemplateTail',
    'TrueKeyword', 'FalseKeyword', 'NullKeyword', 'TypeOfExpression', 'ForStatement', 'ForOfStatement', 'ForInStatement',
    'QuestionToken', 'ColonToken', 'QuestionDotToken', 'DotDotDotToken', 'EqualsGreaterThanToken',
    'EqualsToken', 'PlusToken', 'MinusToken', 'AsteriskToken', 'SlashToken', 'PercentToken', 'AsteriskAsteriskToken',
    'PlusPlusToken', 'MinusMinusToken', 'ExclamationToken', 'TildeToken', 'AmpersandToken', 'BarToken', 'CaretToken',
    'LessThanToken', 'GreaterThanToken', 'LessThanEqualsToken', 'GreaterThanEqualsToken',
    'EqualsEqualsToken', 'ExclamationEqualsToken', 'EqualsEqualsEqualsToken', 'ExclamationEqualsEqualsToken',
    'AmpersandAmpersandToken', 'BarBarToken', 'QuestionQuestionToken', 'PlusEqualsToken', 'MinusEqualsToken',
    'AsteriskEqualsToken', 'SlashEqualsToken', 'PercentEqualsToken', 'AmpersandEqualsToken', 'BarEqualsToken',
    'CaretEqualsToken', 'LessThanLessThanToken', 'GreaterThanGreaterThanToken', 'GreaterThanGreaterThanGreaterThanToken',
    'AmpersandAmpersandEqualsToken', 'BarBarEqualsToken', 'QuestionQuestionEqualsToken',
]);
export const PROMPT_AMBIENT_V1 = String.raw `
declare function eventOn(event: 'GENERATION_AFTER_COMMANDS',callback:()=>void):void;
declare const tavern_events:{readonly GENERATION_AFTER_COMMANDS:'GENERATION_AFTER_COMMANDS'};
declare function getVariables(option?:{type:'chat'|'character'|'global'|'message'|'script';message_id?:number|'latest';script_id?:string}):any;
interface AuthorPromptChatMessageV1 {readonly message_id:number;readonly role:'user'|'assistant';readonly message:string;
  readonly swipes?:readonly string[];readonly swipe_id?:number}
declare function getChatMessages(range:number|string,option?:{include_swipes?:boolean;role?:'all'|'user'|'assistant';hide_state?:'all'}):readonly AuthorPromptChatMessageV1[];
declare function injectPrompts(prompts:{id:string;position:'none'|'in_chat';depth:number;role:'system'|'user'|'assistant';content:string;should_scan:boolean}[],option?:{once?:boolean}):void;
declare function uninjectPrompts(ids:string[]):void;
declare const window:{addEventListener(event:'pagehide',callback:()=>void):void};
`;
