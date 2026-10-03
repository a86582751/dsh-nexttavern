/** New v4 canonical schema AST gates. Source is inspected/transpiled only.
 * Registration intent is not execution evidence: the guest still must really
 * register/validate every enabled schema path, with no loader fallback. */
import ts from 'typescript'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {MvuSchemaCompilationInputV4, RawAuthorScriptV4}
  from './tavern-mvu-author-execution-types-v4.mjs'

export class SchemaAstRefusalV4 extends Error {
  constructor(readonly diagnostic: MvuSchemaDiagnostic) {super(diagnostic.code)}
}
const hostNames = new Set(['window', 'parent', 'top', 'self', 'globalThis', 'global', 'document', 'frames', 'opener',
  'process', 'require', 'module', 'exports', 'eval', 'Function', 'AsyncFunction', 'GeneratorFunction',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'importScripts', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'TavernHelper', 'SillyTavern', 'setTimeout', 'setInterval',
  'requestAnimationFrame', 'queueMicrotask'])
const escapeProperties = new Set(['__proto__', 'constructor', 'prototype'])
function fail(code: string, script: RawAuthorScriptV4, file: ts.SourceFile, node?: ts.Node): never {
  const position = node ? file.getLineAndCharacterOfPosition(node.getStart(file)) : undefined
  throw new SchemaAstRefusalV4({code, pointer: script.pointer, scriptIdentity: script.identity,
    ...(position ? {line: position.line + 1, column: position.character + 1} : {})})
}
function isNameOnly(node: ts.Identifier): boolean {
  const parent = node.parent
  return ts.isPropertyAccessExpression(parent) && parent.name === node
    || (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent))
      && parent.name === node
    || ts.isBindingElement(parent) && parent.propertyName === node
    || ts.isImportSpecifier(parent) && parent.propertyName === node
    || ts.isExportSpecifier(parent) && parent.propertyName === node
}
function symbol(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
  return checker.getSymbolAtLocation(node)
}
/** Only compile-bound bridge imports or this script's free owned facade can
 * supply the syntactic registration intent. A similarly named object method
 * or local fake function alone does not make arbitrary source schema code. */
function hasRegistrationIntent(script: RawAuthorScriptV4, file: ts.SourceFile, checker: ts.TypeChecker): boolean {
  const bridgeSpecifiers = new Set(script.imports.filter(item => item.kind === 'schema-bridge').map(item => item.specifier))
  const receivers = new Set<ts.Symbol>(), functions = new Set<ts.Symbol>(), nodes: ts.Node[] = []
  const pending: ts.Node[] = [file]
  while (pending.length) {
    const node = pending.pop()!
    nodes.push(node)
    ts.forEachChild(node, child => {pending.push(child)})
  }
  const importedNamespace = (expression: ts.Expression | undefined): boolean => {
    if (!expression) return false
    if (ts.isAwaitExpression(expression)) return importedNamespace(expression.expression)
    if (!ts.isCallExpression(expression) || expression.expression.kind !== ts.SyntaxKind.ImportKeyword) return false
    const argument = expression.arguments[0]
    return expression.arguments.length === 1 && !!argument && ts.isStringLiteralLike(argument)
      && bridgeSpecifiers.has(argument.text)
  }
  for (const node of nodes) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && bridgeSpecifiers.has(node.moduleSpecifier.text) && !node.importClause?.isTypeOnly) {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamespaceImport(bindings)) {
        const value = symbol(checker, bindings.name);if (value) receivers.add(value)
      } else if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) {
        if (!entry.isTypeOnly && (entry.propertyName ?? entry.name).text === 'registerMvuSchema') {
          const value = symbol(checker, entry.name);if (value) functions.add(value)
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && importedNamespace(node.initializer)) {
      const value = symbol(checker, node.name);if (value) receivers.add(value)
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left) && importedNamespace(node.right)) {
      const value = symbol(checker, node.left);if (value) receivers.add(value)
    }
  }
  const registrationReference = (expression: ts.Expression): boolean => {
    if (ts.isIdentifier(expression)) {
      const value = symbol(checker, expression)
      return !!value && functions.has(value) || !value && expression.text === 'registerMvuSchema'
    }
    if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'registerMvuSchema') return false
    const object = expression.expression
    return ts.isIdentifier(object) && (object.text === 'globalThis' && !symbol(checker, object)
      || !!symbol(checker, object) && receivers.has(symbol(checker, object)!))
  }
  // Resolve finite alias chains using declared symbols, without evaluation.
  // The fixed bound avoids turning a cycle into endless discovery work.
  for (let pass = 0; pass < MVU_SCHEMA_BOUNDS.scripts; pass++) {
    const before = functions.size
    for (const node of nodes) {
      if (!ts.isVariableDeclaration(node) || !node.initializer) continue
      if (ts.isIdentifier(node.name) && registrationReference(node.initializer)) {
        const value = symbol(checker, node.name);if (value) functions.add(value)
      } else if (ts.isObjectBindingPattern(node.name) && (importedNamespace(node.initializer)
        || ts.isIdentifier(node.initializer) && receivers.has(symbol(checker, node.initializer)!))) {
        for (const entry of node.name.elements) if (!entry.dotDotDotToken && ts.isIdentifier(entry.name)
          && (entry.propertyName?.getText(file) ?? entry.name.text) === 'registerMvuSchema') {
          const value = symbol(checker, entry.name);if (value) functions.add(value)
        }
      }
    }
    if (functions.size === before) break
  }
  return nodes.some(node => ts.isCallExpression(node) && registrationReference(node.expression))
}

export function compileSchemaAstV4(script: RawAuthorScriptV4, input: MvuSchemaCompilationInputV4,
  file: ts.SourceFile, checker: ts.TypeChecker): {kind: 'schema'; javascript: string}
    | {kind: 'not-schema'} {
  if (ts.version !== '5.9.3' || input.bridge.version !== 4 || file.text !== script.source) {
    fail('MVU_SCHEMA_V4_AST_IDENTITY', script, file)
  }
  try {
    const bindings = new Map(script.imports.map(item => [item.specifier, item]))
    const libraries = new Map(input.libraries.map(item => [item.kind, item.bundleSha256]))
    const redirects = new Map<ts.Node, string>()
    const rewriteSpecifier = (literal: ts.StringLiteralLike, node: ts.Node) => {
      const binding = bindings.get(literal.text)
      if (!binding) fail('MVU_SCHEMA_IMPORT_UNBOUND', script, file, node)
      if (binding.kind === 'native-state-loader') fail('MVU_SCHEMA_V4_MIXED_NATIVE_IMPORT', script, file, node)
      const expected = binding.kind === 'schema-bridge' ? input.bridge.implementationSha256 : libraries.get(binding.kind)
      if (!expected || expected !== binding.implementationSha256) fail('MVU_SCHEMA_IMPORT_IDENTITY', script, file, node)
      return `nexttavern:${binding.kind}`
    }
    // The planner already bounded scanner/parser/binder work before invoking
    // this private closure. The complete canonical gate still inspects every
    // node, including unreachable branches and code before/after registration.
    const pending: {node: ts.Node; depth: number}[] = [{node: file, depth: 0}]
    while (pending.length) {
      const {node, depth} = pending.pop()!
      if (depth > MVU_SCHEMA_BOUNDS.syntaxDepth) fail('MVU_SCHEMA_AST_DEPTH_LIMIT', script, file, node)
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) {
        if (node.attributes) fail('MVU_SCHEMA_IMPORT_ATTRIBUTES', script, file, node)
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) fail('MVU_SCHEMA_IMPORT_LITERAL', script, file, node)
        redirects.set(node.moduleSpecifier, rewriteSpecifier(node.moduleSpecifier, node))
      }
      if (ts.isImportEqualsDeclaration(node) || ts.isExternalModuleReference(node)) {
        fail('MVU_SCHEMA_REQUIRE_UNSUPPORTED', script, file, node)
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const literal = node.arguments[0]
        if (node.arguments.length !== 1 || !literal
          || !ts.isStringLiteral(literal) && !ts.isNoSubstitutionTemplateLiteral(literal)) {
          fail('MVU_SCHEMA_DYNAMIC_IMPORT_LITERAL', script, file, node)
        }
        redirects.set(literal, rewriteSpecifier(literal, node))
      }
      if (ts.isImportTypeNode(node)) fail('MVU_SCHEMA_IMPORT_TYPE_UNSUPPORTED', script, file, node)
      if (ts.isMetaProperty(node) || node.kind === ts.SyntaxKind.WithStatement) fail('MVU_SCHEMA_HOST_ACCESS', script, file, node)
      const ownGlobal = ts.isIdentifier(node) && node.text === 'globalThis'
      if (ts.isIdentifier(node) && !isNameOnly(node) && hostNames.has(node.text) && !ownGlobal
        && !checker.getSymbolAtLocation(node)) fail('MVU_SCHEMA_HOST_ACCESS', script, file, node)
      if (ts.isPropertyAccessExpression(node) && escapeProperties.has(node.name.text)
        || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
          && escapeProperties.has(node.argumentExpression.text)) fail('MVU_SCHEMA_DYNAMIC_CODE_ACCESS', script, file, node)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === '$'
        && !checker.getSymbolAtLocation(node.expression)) {
        const callback = node.arguments[0]
        if (node.arguments.length !== 1 || !callback || !ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) {
          fail('MVU_SCHEMA_READY_CALLBACK_REQUIRED', script, file, node)
        }
      }
      ts.forEachChild(node, child => {pending.push({node: child, depth: depth + 1})})
    }
    if (!hasRegistrationIntent(script, file, checker)) return {kind: 'not-schema'}
    const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
      const visit: ts.Visitor = node => {
        const redirect = redirects.get(node)
        return redirect ? context.factory.createStringLiteral(redirect) : ts.visitEachChild(node, visit, context)
      }
      return root => ts.visitNode(root, visit) as ts.SourceFile
    }
    const transformed = ts.transform(file, [transformer])
    let redirected: string
    try {redirected = ts.createPrinter({newLine: ts.NewLineKind.LineFeed}).printFile(transformed.transformed[0]!)}
    finally {transformed.dispose()}
    const result = ts.transpileModule(redirected, {fileName: 'author-schema.ts', reportDiagnostics: true,
      compilerOptions: {target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, isolatedModules: true,
        newLine: ts.NewLineKind.LineFeed, sourceMap: false, removeComments: false}})
    if (result.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) {
      fail('MVU_SCHEMA_TYPESCRIPT_TRANSPILE', script, file)
    }
    return {kind: 'schema', javascript: result.outputText}
  } catch (error) {
    if (error instanceof RangeError) fail('MVU_SCHEMA_SYNTAX_DEPTH_LIMIT', script, file)
    throw error
  }
}
