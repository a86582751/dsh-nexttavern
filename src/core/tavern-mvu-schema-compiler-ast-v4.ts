/** New v4 canonical schema AST gates. Source is inspected/transpiled only.
 * Registration intent is not execution evidence: the guest still must really
 * register/validate every enabled schema path, with no loader fallback. */
import ts from 'dsh-nexttavern-typescript-runtime'
import type * as TypeScript from 'typescript'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {C_SCHEMA_IMPORT_POLICY_V4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {MvuSchemaCompilationInputV4, RawAuthorScriptV4,RegisteredCommandPolicyBindingV1,
  InitializationWriteBindingV1}
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
const ownedStagedogBridge = 'nexttavern:stagedog-schema-bridge'
function fail(code: string, script: RawAuthorScriptV4, file: TypeScript.SourceFile, node?: TypeScript.Node): never {
  const position = node ? file.getLineAndCharacterOfPosition(node.getStart(file)) : undefined
  throw new SchemaAstRefusalV4({code, pointer: script.pointer, scriptIdentity: script.identity,
    ...(position ? {line: position.line + 1, column: position.character + 1} : {})})
}
function isNameOnly(node: TypeScript.Identifier): boolean {
  const parent = node.parent
  return ts.isPropertyAccessExpression(parent) && parent.name === node
    || (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent))
      && parent.name === node
    || ts.isBindingElement(parent) && parent.propertyName === node
    || ts.isImportSpecifier(parent) && parent.propertyName === node
    || ts.isExportSpecifier(parent) && parent.propertyName === node
}
function symbol(checker: TypeScript.TypeChecker, node: TypeScript.Node): TypeScript.Symbol | undefined {
  return checker.getSymbolAtLocation(node)
}
interface DynamicSchemaImportV4 {
  readonly specifiers: readonly string[]
  readonly bounded: boolean
}
/** Same-admission facts over the planner's actual AST/checker, never DATA or
 * persisted authority. Intent claims an owner; full compilation admits it. */
export interface BoundSchemaAstFactsV4 {
  readonly nodes: readonly {readonly node: TypeScript.Node; readonly depth: number}[]
  readonly dynamicImports: ReadonlyMap<TypeScript.CallExpression, DynamicSchemaImportV4>
  readonly readyCallbacks: ReadonlySet<TypeScript.CallExpression>
  readonly registrationIntent: boolean
}
function unwrapped(expression: TypeScript.Expression): TypeScript.Expression {
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression
  return expression
}
/** The private worker derives this once; partition and full gates consume the
 * same bound facts. An unbound fallback cannot turn a schema claim into Browser
 * or zero-registration execution merely because its import is nonliteral. */
export function analyzeBoundSchemaAstV4(script: RawAuthorScriptV4, file: TypeScript.SourceFile,
  checker: TypeScript.TypeChecker): BoundSchemaAstFactsV4 {
  const bridgeSpecifiers = new Set(script.imports.filter(item => item.kind === 'schema-bridge').map(item => item.specifier))
  const receivers = new Set<TypeScript.Symbol>(), functions = new Set<TypeScript.Symbol>()
  const nodes: {node: TypeScript.Node; depth: number}[] = []
  const pending = [{node: file as TypeScript.Node, depth: 0}]
  while (pending.length) {
    const entry = pending.pop()!
    nodes.push(entry)
    ts.forEachChild(entry.node, child => {pending.push({node: child, depth: entry.depth + 1})})
  }
  const references = new Map<TypeScript.Symbol, TypeScript.Identifier[]>()
  const arrays = new Map<TypeScript.Symbol, {name: TypeScript.Identifier; specifiers: readonly string[];
    declaration: TypeScript.VariableDeclaration}>()
  const callbackValues = new Map<TypeScript.Symbol, TypeScript.Expression | TypeScript.FunctionDeclaration>()
  for (const {node} of nodes) {
    if (ts.isIdentifier(node)) {
      // A shorthand has a property symbol and a distinct lexical value symbol.
      const value = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
        ? checker.getShorthandAssignmentValueSymbol(node.parent) : symbol(checker, node)
      if (value) {
        const uses = references.get(value)
        if (uses) uses.push(node)
        else references.set(value, [node])
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const value = symbol(checker, node.name)
      if (value) callbackValues.set(value, node)
    }
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer
      || !ts.isVariableDeclarationList(node.parent) || !(node.parent.flags & ts.NodeFlags.Const)) continue
    const value = symbol(checker, node.name)
    if (!value) continue
    callbackValues.set(value, node.initializer)
    if (ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length
      && node.initializer.elements.every(ts.isStringLiteralLike)) {
      arrays.set(value, {name: node.name, declaration: node,
        specifiers: node.initializer.elements.map(item => (item as TypeScript.StringLiteralLike).text)})
    }
  }
  const dynamicImports = new Map<TypeScript.CallExpression, DynamicSchemaImportV4>()
  for (const {node} of nodes) {
    if (!ts.isForOfStatement(node) || node.awaitModifier || !ts.isIdentifier(node.expression)
      || !ts.isVariableDeclarationList(node.initializer) || !(node.initializer.flags & ts.NodeFlags.Const)
      || node.initializer.declarations.length !== 1) continue
    const array = arrays.get(symbol(checker, node.expression)!)
    const binding = node.initializer.declarations[0]
    if (!array || !binding || !ts.isIdentifier(binding.name) || binding.initializer) continue
    const loopSymbol = symbol(checker, binding.name)
    if (!loopSymbol) continue
    const statement = array.declaration.parent.parent
    // The literal array may only supply this real for-of; exporting, mutating,
    // passing or capturing it would destroy the finite import-argument proof.
    const bounded = ts.isVariableStatement(statement) && !statement.modifiers?.length
      && (references.get(symbol(checker, array.name)!) ?? []).every(use =>
        use === array.name || use === node.expression)
    for (const use of references.get(loopSymbol) ?? []) {
      const call = use.parent
      if (ts.isCallExpression(call) && call.expression.kind === ts.SyntaxKind.ImportKeyword
        && call.arguments.length === 1 && call.arguments[0] === use && !call.typeArguments?.length) {
        dynamicImports.set(call, {specifiers: array.specifiers, bounded})
      }
    }
  }
  const importedNamespace = (expression: TypeScript.Expression | undefined): boolean => {
    if (!expression) return false
    expression = unwrapped(expression)
    if (ts.isAwaitExpression(expression)) return importedNamespace(expression.expression)
    if (!ts.isCallExpression(expression) || expression.expression.kind !== ts.SyntaxKind.ImportKeyword
      || expression.arguments.length !== 1) return false
    const argument = expression.arguments[0]
    if (argument && ts.isStringLiteralLike(argument)) return bridgeSpecifiers.has(argument.text)
    // A known bridge candidate claims the registration intent even if another
    // authored fallback is unknown/unproved. The full gate must refuse it.
    return dynamicImports.get(expression)?.specifiers.some(item => bridgeSpecifiers.has(item)) ?? false
  }
  for (const {node} of nodes) {
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
      && importedNamespace(node.right)) {
      const target = unwrapped(node.left)
      if (ts.isIdentifier(target)) {
        const value = symbol(checker, target);if (value) receivers.add(value)
      } else if (ts.isObjectLiteralExpression(target)) for (const property of target.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'registerMvuSchema'
          && !property.objectAssignmentInitializer) {
          const value = checker.getShorthandAssignmentValueSymbol(property)
          if (value) functions.add(value)
        } else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)
          && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          && property.name.text === 'registerMvuSchema') {
          const value = symbol(checker, property.initializer);if (value) functions.add(value)
        }
      }
    }
  }
  const registrationReference = (expression: TypeScript.Expression): boolean => {
    expression = unwrapped(expression)
    if (ts.isIdentifier(expression)) {
      const value = symbol(checker, expression)
      return !!value && functions.has(value) || !value && expression.text === 'registerMvuSchema'
    }
    if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'registerMvuSchema') return false
    const object = expression.expression
    return ts.isIdentifier(object) && (object.text === 'globalThis' && !symbol(checker, object)
      || !!symbol(checker, object) && receivers.has(symbol(checker, object)!))
  }
  // Keep existing static/literal namespace and registration alias rules.
  for (let pass = 0; pass < MVU_SCHEMA_BOUNDS.scripts; pass++) {
    const before = functions.size
    for (const {node} of nodes) {
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
  const callbackValue = (expression: TypeScript.Expression): boolean => {
    const seen = new Set<TypeScript.Symbol>()
    let value: TypeScript.Expression | TypeScript.FunctionDeclaration = unwrapped(expression)
    while (ts.isIdentifier(value)) {
      const binding = symbol(checker, value)
      if (!binding || seen.has(binding)) return false
      seen.add(binding)
      const target = callbackValues.get(binding)
      if (!target) return false
      value = ts.isFunctionDeclaration(target) ? target : unwrapped(target)
    }
    return ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isFunctionDeclaration(value)
  }
  const readyCallbacks = new Set<TypeScript.CallExpression>()
  for (const {node} of nodes) if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    && node.expression.text === '$' && !symbol(checker, node.expression)
    && node.arguments.length === 1 && node.arguments[0] && callbackValue(node.arguments[0])) readyCallbacks.add(node)
  return {nodes, dynamicImports, readyCallbacks,
    registrationIntent: nodes.some(({node}) => ts.isCallExpression(node) && registrationReference(node.expression))}
}
/** Compatibility entry point; the private worker shares the richer facts
 * directly instead of calling this wrapper before full compilation. */
export function hasRegistrationIntentV4(script: RawAuthorScriptV4, file: TypeScript.SourceFile,
  checker: TypeScript.TypeChecker): boolean {
  return analyzeBoundSchemaAstV4(script, file, checker).registrationIntent
}

export function compileSchemaAstV4(script: RawAuthorScriptV4,
  input: Pick<MvuSchemaCompilationInputV4,'bridge'|'libraries'>,
  file: TypeScript.SourceFile, checker: TypeScript.TypeChecker,ordinal:number,
  facts?: BoundSchemaAstFactsV4): {
    kind: 'schema'; javascript: string;commandPolicyBindings:readonly RegisteredCommandPolicyBindingV1[];
    initializationWriteBindings:readonly InitializationWriteBindingV1[]}
    | {kind: 'not-schema'} {
  if (ts.version !== '5.9.3' || input.bridge.version !== 4 || file.text !== script.source) {
    fail('MVU_SCHEMA_V4_AST_IDENTITY', script, file)
  }
  try {
    const analysis = facts ?? analyzeBoundSchemaAstV4(script, file, checker)
    const bindings = new Map(script.imports.map(item => [item.specifier, item]))
    const libraries = new Map(input.libraries.map(item => [item.kind, item.bundleSha256]))
    const redirects = new Map<TypeScript.Node, TypeScript.Expression>()
    const commandPolicyBindings:RegisteredCommandPolicyBindingV1[]=[]
    const initializationWriteBindings:InitializationWriteBindingV1[]=[]
    const literalName=(name:TypeScript.PropertyName)=>ts.isIdentifier(name)||ts.isStringLiteral(name)?name.text:undefined
    const initializationWrite=(call:TypeScript.CallExpression)=>{
      const payload=call.arguments[0],option=call.arguments[1]
      const field=payload&&ts.isObjectLiteralExpression(payload)&&payload.properties.length===1
        ?payload.properties[0]:undefined
      const type=option&&ts.isObjectLiteralExpression(option)&&option.properties.length===1
        ?option.properties[0]:undefined
      if(call.arguments.length!==2||call.typeArguments?.length||call.questionDotToken
        ||!field||!(ts.isPropertyAssignment(field)||ts.isShorthandPropertyAssignment(field))
        ||literalName(field.name)!=='stat_data'
        ||ts.isShorthandPropertyAssignment(field)&&field.objectAssignmentInitializer
        ||!type||!ts.isPropertyAssignment(type)||literalName(type.name)!=='type'
        ||!ts.isStringLiteral(type.initializer)||type.initializer.text!=='chat') {
        fail('MVU_SCHEMA_INITIALIZATION_WRITE_UNSUPPORTED',script,file,call)
      }
      initializationWriteBindings.push({scriptOrdinal:ordinal,scriptIdentity:script.identity,
        sourceSha256:script.sourceSha256,sourceSpan:{start:call.getStart(file),end:call.end},
        capability:'insert-or-assign-chat-stat-data-v1'})
    }
    const policyBinding=(specifier:string,node:TypeScript.Node,
      fields:Pick<RegisteredCommandPolicyBindingV1,'importKind'|'importedName'|'localName'>)=>{
      commandPolicyBindings.push({scriptOrdinal:ordinal,scriptIdentity:script.identity,
        sourceSpan:{start:node.getStart(file),end:node.end},specifier,...fields,policy:'stagedog-command-discard-v1'})
    }
    const rewriteSpecifier = (specifier: string, node: TypeScript.Node) => {
      const binding = bindings.get(specifier)
      if (!binding) fail('MVU_SCHEMA_IMPORT_UNBOUND', script, file, node)
      if (binding.kind === 'native-state-loader') fail('MVU_SCHEMA_V4_MIXED_NATIVE_IMPORT', script, file, node)
      const expected = binding.kind === 'schema-bridge' ? input.bridge.implementationSha256 : libraries.get(binding.kind)
      if (!expected || expected !== binding.implementationSha256) fail('MVU_SCHEMA_IMPORT_IDENTITY', script, file, node)
      if(binding.kind==='schema-bridge'&&C_SCHEMA_IMPORT_POLICY_V4.entries.includes(specifier)) {
        const before=commandPolicyBindings.length
        if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly) {
          const imported=node.importClause?.namedBindings
          if(imported&&ts.isNamespaceImport(imported))policyBinding(specifier,imported,
            {importKind:'namespace',importedName:'*',localName:imported.name.text})
          else if(imported&&ts.isNamedImports(imported))for(const entry of imported.elements) {
            if(!entry.isTypeOnly&&(entry.propertyName??entry.name).text==='registerMvuSchema') {
              policyBinding(specifier,entry,{importKind:'named',importedName:'registerMvuSchema',localName:entry.name.text})
            }
          }
        }else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword) {
          policyBinding(specifier,node,{importKind:'dynamic-namespace',importedName:'*',localName:null})
        }
        // A bare import or re-export does not supply this script a registration
        // binding. Its free/global registerMvuSchema remains the atomic facade.
        if(commandPolicyBindings.length>before)return ownedStagedogBridge
      }
      return `nexttavern:${binding.kind}`
    }
    // The planner already bounded scanner/parser/binder work before invoking
    // this private closure. The complete canonical gate still inspects every
    // node, including unreachable branches and code before/after registration.
    for (const {node, depth} of analysis.nodes) {
      if (depth > MVU_SCHEMA_BOUNDS.syntaxDepth) fail('MVU_SCHEMA_AST_DEPTH_LIMIT', script, file, node)
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) {
        if (node.attributes) fail('MVU_SCHEMA_IMPORT_ATTRIBUTES', script, file, node)
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) fail('MVU_SCHEMA_IMPORT_LITERAL', script, file, node)
        redirects.set(node.moduleSpecifier, ts.factory.createStringLiteral(rewriteSpecifier(node.moduleSpecifier.text, node)))
      }
      if (ts.isImportEqualsDeclaration(node) || ts.isExternalModuleReference(node)) {
        fail('MVU_SCHEMA_REQUIRE_UNSUPPORTED', script, file, node)
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0]
        if (node.arguments.length !== 1 || !argument) fail('MVU_SCHEMA_DYNAMIC_IMPORT_LITERAL', script, file, node)
        if (ts.isStringLiteralLike(argument)) {
          redirects.set(argument, ts.factory.createStringLiteral(rewriteSpecifier(argument.text, node)))
        } else {
          const site = analysis.dynamicImports.get(node)
          if (!site?.bounded) fail('MVU_SCHEMA_DYNAMIC_IMPORT_LITERAL', script, file, node)
          for (const specifier of site.specifiers) {
            // Keep raw binding/identity and policy ownership in the existing
            // resolver; unknown fallbacks must retain IMPORT_UNBOUND.
            const target = rewriteSpecifier(specifier, node)
            if (target !== ownedStagedogBridge) {
              fail('MVU_SCHEMA_DYNAMIC_IMPORT_LITERAL', script, file, node)
            }
          }
          // Every supported C alias names this same owned module. Preserve
          // authored array/loop/log/try/break and change only the import argument.
          redirects.set(argument, ts.factory.createStringLiteral(ownedStagedogBridge))
        }
      }
      if (ts.isImportTypeNode(node)) fail('MVU_SCHEMA_IMPORT_TYPE_UNSUPPORTED', script, file, node)
      if(ts.isIdentifier(node)&&node.text==='insertOrAssignVariables'&&!isNameOnly(node)
        &&!checker.getSymbolAtLocation(node)) {
        const parent=node.parent
        if(ts.isCallExpression(parent)&&parent.expression===node)initializationWrite(parent)
        else if(!ts.isTypeOfExpression(parent)||parent.expression!==node) {
          fail('MVU_SCHEMA_INITIALIZATION_WRITE_UNSUPPORTED',script,file,node)
        }
      }
      if(ts.isPropertyAccessExpression(node)&&node.name.text==='insertOrAssignVariables'
        &&ts.isIdentifier(node.expression)&&node.expression.text==='globalThis'
        &&!checker.getSymbolAtLocation(node.expression)) {
        fail('MVU_SCHEMA_INITIALIZATION_WRITE_UNSUPPORTED',script,file,node)
      }
      if (ts.isMetaProperty(node) || node.kind === ts.SyntaxKind.WithStatement) fail('MVU_SCHEMA_HOST_ACCESS', script, file, node)
      const ownGlobal = ts.isIdentifier(node) && node.text === 'globalThis'
      if (ts.isIdentifier(node) && !isNameOnly(node) && hostNames.has(node.text) && !ownGlobal
        && !checker.getSymbolAtLocation(node)) fail('MVU_SCHEMA_HOST_ACCESS', script, file, node)
      if (ts.isPropertyAccessExpression(node) && escapeProperties.has(node.name.text)
        || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
          && escapeProperties.has(node.argumentExpression.text)) fail('MVU_SCHEMA_DYNAMIC_CODE_ACCESS', script, file, node)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === '$'
        && !checker.getSymbolAtLocation(node.expression)) {
        if (!analysis.readyCallbacks.has(node)) {
          fail('MVU_SCHEMA_READY_CALLBACK_REQUIRED', script, file, node)
        }
      }
    }
    if (!analysis.registrationIntent) return {kind: 'not-schema'}
    const transformer: TypeScript.TransformerFactory<TypeScript.SourceFile> = context => {
      const visit: TypeScript.Visitor = node => {
        const redirect = redirects.get(node)
        return redirect ?? ts.visitEachChild(node, visit, context)
      }
      return root => ts.visitNode(root, visit) as TypeScript.SourceFile
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
    commandPolicyBindings.sort((left,right)=>left.sourceSpan.start-right.sourceSpan.start)
    initializationWriteBindings.sort((left,right)=>left.sourceSpan.start-right.sourceSpan.start)
    return {kind: 'schema', javascript: result.outputText,commandPolicyBindings,initializationWriteBindings}
  } catch (error) {
    if (error instanceof RangeError) fail('MVU_SCHEMA_SYNTAX_DEPTH_LIMIT', script, file)
    throw error
  }
}
