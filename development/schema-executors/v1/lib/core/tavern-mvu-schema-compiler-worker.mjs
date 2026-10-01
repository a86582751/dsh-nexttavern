// Generated from runtime/alpha3/schema-executors/v1/src/core/tavern-mvu-schema-compiler-worker.mts; edit the TypeScript source.
/** Trusted compiler worker. Author source is parsed/transpiled, never evaluated. */
import { parentPort, workerData } from 'node:worker_threads';
import ts from 'typescript';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256, validateSchemaProgram } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
class Refusal extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
function fail(code, script, file, node) {
    const position = file && node ? file.getLineAndCharacterOfPosition(node.getStart(file)) : undefined;
    throw new Refusal({ code, ...(script ? { scriptIdentity: script.identity, pointer: script.pointer } : {}),
        ...(position ? { line: position.line + 1, column: position.character + 1 } : {}) });
}
const hostNames = new Set(['window', 'parent', 'top', 'self', 'globalThis', 'global', 'document', 'frames', 'opener',
    'process', 'require', 'module', 'exports', 'eval', 'Function', 'AsyncFunction', 'GeneratorFunction',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'importScripts', 'navigator', 'location',
    'localStorage', 'sessionStorage', 'indexedDB', 'TavernHelper', 'SillyTavern', 'setTimeout', 'setInterval',
    'requestAnimationFrame', 'queueMicrotask']);
const escapeProperties = new Set(['__proto__', 'constructor', 'prototype']);
function lexicalBudget(script) {
    if (Buffer.byteLength(script.source, 'utf8') > MVU_SCHEMA_BOUNDS.sourceBytes)
        fail('MVU_SCHEMA_SOURCE_BYTE_LIMIT', script);
    // Scanner trivia is counted too; source bytes, tokens and bracket nesting
    // are bounded here. Prefix/arrow recursion can still exhaust TS's parser
    // stack; its RangeError is a depth refusal inside the disposable worker.
    const scanner = ts.createScanner(ts.ScriptTarget.ES2023, false, ts.LanguageVariant.Standard, script.source);
    let tokens = 0, depth = 0;
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (++tokens > MVU_SCHEMA_BOUNDS.syntaxTokens)
            fail('MVU_SCHEMA_SYNTAX_TOKEN_LIMIT', script);
        if ([ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.OpenBracketToken].includes(token)) {
            if (++depth > MVU_SCHEMA_BOUNDS.syntaxDepth)
                fail('MVU_SCHEMA_SYNTAX_DEPTH_LIMIT', script);
        }
        else if ([ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CloseBracketToken].includes(token)) {
            depth = Math.max(0, depth - 1);
        }
    }
}
function isNameOnly(node) {
    const p = node.parent;
    return (ts.isPropertyAccessExpression(p) && p.name === node)
        || ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === node)
        || (ts.isBindingElement(p) && p.propertyName === node)
        || (ts.isImportSpecifier(p) && p.propertyName === node)
        || (ts.isExportSpecifier(p) && p.propertyName === node);
}
function compileScript(script, input) {
    try {
        return compileScriptWithinBudget(script, input);
    }
    catch (error) {
        // TypeScript also recurses on expressions without nested brackets. Keep
        // those parser/binder/transpiler stack failures explicit; the parent still
        // provides the actual memory/deadline boundary and terminates this worker.
        if (error instanceof RangeError)
            fail('MVU_SCHEMA_SYNTAX_DEPTH_LIMIT', script);
        throw error;
    }
}
function compileScriptWithinBudget(script, input) {
    lexicalBudget(script);
    const file = ts.createSourceFile('author-schema.ts', script.source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
    const diagnostics = file.parseDiagnostics;
    if (diagnostics.length)
        fail('MVU_SCHEMA_TYPESCRIPT_SYNTAX', script);
    // Bind lexical names without resolving dependencies or loading host libs.
    // A local `module`/`parent` variable is data, while an unbound host name is
    // refused. This checker provides symbols, never semantic authority.
    const options = { noResolve: true, noLib: true, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext };
    const host = { getSourceFile: name => name === file.fileName ? file : undefined,
        getDefaultLibFileName: () => '', writeFile: () => { }, getCurrentDirectory: () => '', getDirectories: () => [],
        fileExists: name => name === file.fileName, readFile: name => name === file.fileName ? script.source : undefined,
        getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
    const checker = ts.createProgram([file.fileName], options, host).getTypeChecker();
    const bindings = new Map(script.imports.map(binding => [binding.specifier, binding]));
    const libraries = new Map(input.libraries.map(library => [library.kind, library.bundleSha256]));
    const rewriteSpecifier = (literal, node) => {
        const binding = bindings.get(literal.text);
        if (!binding)
            fail('MVU_SCHEMA_IMPORT_UNBOUND', script, file, node);
        const expected = binding.kind === 'schema-bridge' ? input.bridge.implementationSha256 : libraries.get(binding.kind);
        if (!expected || binding.implementationSha256 !== expected)
            fail('MVU_SCHEMA_IMPORT_IDENTITY', script, file, node);
        return `nexttavern:${binding.kind}`;
    };
    // Iterative inspection avoids recursive visitors before the AST depth gate.
    const pending = [{ node: file, depth: 0 }];
    const redirects = new Map();
    while (pending.length) {
        const { node, depth } = pending.pop();
        if (depth > MVU_SCHEMA_BOUNDS.syntaxDepth)
            fail('MVU_SCHEMA_AST_DEPTH_LIMIT', script, file, node);
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) {
            if (node.attributes)
                fail('MVU_SCHEMA_IMPORT_ATTRIBUTES', script, file, node);
            if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier))
                fail('MVU_SCHEMA_IMPORT_LITERAL', script, file, node);
            redirects.set(node.moduleSpecifier, rewriteSpecifier(node.moduleSpecifier, node));
        }
        if (ts.isImportEqualsDeclaration(node) || ts.isExternalModuleReference(node))
            fail('MVU_SCHEMA_REQUIRE_UNSUPPORTED', script, file, node);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const literal = node.arguments[0];
            if (node.arguments.length !== 1 || !literal || !ts.isStringLiteral(literal) && !ts.isNoSubstitutionTemplateLiteral(literal)) {
                fail('MVU_SCHEMA_DYNAMIC_IMPORT_LITERAL', script, file, node);
            }
            redirects.set(literal, rewriteSpecifier(literal, node));
        }
        if (ts.isImportTypeNode(node))
            fail('MVU_SCHEMA_IMPORT_TYPE_UNSUPPORTED', script, file, node);
        if (ts.isMetaProperty(node) || node.kind === ts.SyntaxKind.WithStatement)
            fail('MVU_SCHEMA_HOST_ACCESS', script, file, node);
        if (ts.isIdentifier(node) && !isNameOnly(node) && hostNames.has(node.text) && !checker.getSymbolAtLocation(node)) {
            fail('MVU_SCHEMA_HOST_ACCESS', script, file, node);
        }
        if (ts.isPropertyAccessExpression(node) && escapeProperties.has(node.name.text)
            || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
                && escapeProperties.has(node.argumentExpression.text))
            fail('MVU_SCHEMA_DYNAMIC_CODE_ACCESS', script, file, node);
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === '$'
            && !checker.getSymbolAtLocation(node.expression)) {
            const callback = node.arguments[0];
            if (node.arguments.length !== 1 || !callback || !ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
                fail('MVU_SCHEMA_READY_CALLBACK_REQUIRED', script, file, node);
            }
        }
        ts.forEachChild(node, child => { pending.push({ node: child, depth: depth + 1 }); });
    }
    const transformer = context => {
        const visit = node => {
            const redirect = redirects.get(node);
            return redirect ? context.factory.createStringLiteral(redirect) : ts.visitEachChild(node, visit, context);
        };
        return root => ts.visitNode(root, visit);
    };
    // transpileModule reparses its source; node identities from our inspected AST
    // are not reused. Rewrite only exact literal locations, never script strings.
    const transformed = ts.transform(file, [transformer]);
    let redirectedText;
    try {
        redirectedText = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
    }
    finally {
        transformed.dispose();
    }
    const result = ts.transpileModule(redirectedText, { fileName: 'author-schema.ts', reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, isolatedModules: true,
            newLine: ts.NewLineKind.LineFeed, sourceMap: false, removeComments: false } });
    if (result.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error))
        fail('MVU_SCHEMA_TYPESCRIPT_TRANSPILE', script);
    return result.outputText;
}
function compile() {
    if (ts.version !== '5.9.3')
        fail('MVU_SCHEMA_TYPESCRIPT_VERSION');
    const message = cloneSchemaData(workerData, MVU_SCHEMA_BOUNDS.inputBytes);
    const { identity, input } = message;
    // A provisional descriptor invokes the shared data validator before any AST
    // work. Its empty JS is internal data and is never returned as compilation.
    const original = { schemaVersion: 1, encoding: 'native-mvu-author-schema-program-v1',
        compiler: identity, source: input.source, bridge: input.bridge, libraries: input.libraries,
        scripts: input.scripts.map(script => ({ ...script, javascript: '', javascriptSha256: schemaTextSha256('') })) };
    const checked = validateSchemaProgram({ ...original, programSha256: recordSha256(original) });
    const scripts = checked.scripts.map(script => {
        const javascript = script.enabled ? compileScript(script, input) : '';
        return { ...script, javascript, javascriptSha256: schemaTextSha256(javascript) };
    });
    const descriptor = { ...original, scripts };
    const program = validateSchemaProgram({ ...descriptor, programSha256: recordSha256(descriptor) });
    return { kind: 'compiled', program };
}
try {
    parentPort?.postMessage(compile());
}
catch (error) {
    parentPort?.postMessage({ kind: 'refused', diagnostics: [error instanceof Refusal ? error.diagnostic :
                { code: 'MVU_SCHEMA_COMPILER_INPUT_INVALID' }] });
}
