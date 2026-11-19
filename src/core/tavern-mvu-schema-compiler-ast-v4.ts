/** Canonical v4 schema ownership and import compilation. Source is inspected/transpiled only.
 * Registration dependency is not execution evidence: the guest still must really
 * register/validate every enabled schema path, with no loader fallback. */
import ts from 'dsh-nexttavern-typescript-runtime'
import type * as TypeScript from 'typescript'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {C_SCHEMA_IMPORT_POLICY_V4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {MvuSchemaCompilationInputV4, RawAuthorScriptV4,RegisteredCommandPolicyBindingV1}
  from './tavern-mvu-author-execution-types-v4.mjs'

export class SchemaAstRefusalV4 extends Error {
  constructor(readonly diagnostic: MvuSchemaDiagnostic) {super(diagnostic.code)}
}
const ownedStagedogBridge = 'nexttavern:stagedog-schema-bridge'
function fail(code: string, script: RawAuthorScriptV4, file: TypeScript.SourceFile, node?: TypeScript.Node): never {
  const position = node ? file.getLineAndCharacterOfPosition(node.getStart(file)) : undefined
  throw new SchemaAstRefusalV4({code, pointer: script.pointer, scriptIdentity: script.identity,
    ...(position ? {line: position.line + 1, column: position.character + 1} : {})})
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
  readonly registrationIntent: boolean
}
function expressionOperand(node: TypeScript.Node): TypeScript.Expression | undefined {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return node.expression
  return undefined
}
function unwrapped(expression: TypeScript.Expression): TypeScript.Expression {
  let operand = expressionOperand(expression)
  while (operand) {expression = operand; operand = expressionOperand(expression)}
  return expression
}
/** The private worker derives this once; partition and full gates consume the
 * same bound facts. An unbound fallback cannot turn a schema claim into Browser
 * or zero-registration execution merely because its import is nonliteral. */
export function analyzeBoundSchemaAstV4(script: RawAuthorScriptV4, file: TypeScript.SourceFile,
  checker: TypeScript.TypeChecker): BoundSchemaAstFactsV4 {
  const bridgeSpecifiers = new Set(script.imports.filter(item => item.kind === 'schema-bridge').map(item => item.specifier))
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
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer
      || !ts.isVariableDeclarationList(node.parent) || !(node.parent.flags & ts.NodeFlags.Const)) continue
    const value = symbol(checker, node.name)
    if (!value) continue
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
  let registrationImport=false
  for (const {node} of nodes) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && bridgeSpecifiers.has(node.moduleSpecifier.text) && !node.importClause?.isTypeOnly) {
      const bindings = node.importClause?.namedBindings
      registrationImport ||= !!bindings && (ts.isNamespaceImport(bindings)
        || ts.isNamedImports(bindings) && bindings.elements.some(entry=>
          !entry.isTypeOnly && (entry.propertyName??entry.name).text==='registerMvuSchema'))
    }
    if(ts.isCallExpression(node)&&importedNamespace(node))registrationImport=true
    if(registrationImport)break
  }
  // Match the guest scope binder: JS expando writes synthesize Identifier
  // declarations, while actual lexical declarations shadow the global API.
  const declared=(value:TypeScript.Symbol|undefined)=>value?.declarations
    ?.some(declaration=>!ts.isIdentifier(declaration))
  const runtimeValue=(node:TypeScript.Node)=>{
    let expression=node
    while(expressionOperand(expression.parent)===expression)expression=expression.parent
    if(ts.isTypeOfExpression(expression.parent))return false
    for(let parent:TypeScript.Node|undefined=node.parent;parent;parent=parent.parent){
      if(ts.isTypeNode(parent))return false
      if(ts.isExpression(parent)||ts.isStatement(parent))break
    }
    return true
  }
  const globalNamespace=(expression:TypeScript.Expression|undefined):boolean=>{
    const target=expression&&unwrapped(expression)
    return !!target&&ts.isIdentifier(target)&&target.text==='globalThis'&&!declared(symbol(checker,target))
  }
  const registrationValue=(node:TypeScript.Node):boolean=>{
    if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)&&globalNamespace(node.initializer)) {
      return node.name.elements.some(element=>{
        if(element.dotDotDotToken)return false
        const property=element.propertyName??element.name,
          name=ts.isComputedPropertyName(property)?unwrapped(property.expression):property
        return (ts.isIdentifier(name)||ts.isStringLiteralLike(name))&&name.text==='registerMvuSchema'
      })
    }
    if(ts.isIdentifier(node)&&node.text==='registerMvuSchema'){
      const parent=node.parent
      if(ts.isPropertyAccessExpression(parent)&&parent.name===node
        ||(ts.isPropertyAssignment(parent)||ts.isMethodDeclaration(parent)||ts.isPropertyDeclaration(parent)
          ||ts.isGetAccessorDeclaration(parent)||ts.isSetAccessorDeclaration(parent))&&parent.name===node
        ||ts.isBindingElement(parent)&&parent.propertyName===node
        ||ts.isImportSpecifier(parent)||ts.isExportSpecifier(parent)
        ||ts.isLabeledStatement(parent)&&parent.label===node
        ||(ts.isBreakStatement(parent)||ts.isContinueStatement(parent))&&parent.label===node)return false
      const value=ts.isShorthandPropertyAssignment(parent)
        ?checker.getShorthandAssignmentValueSymbol(parent):symbol(checker,node)
      return !declared(value)&&runtimeValue(node)
    }
    const object=ts.isPropertyAccessExpression(node)&&node.name.text==='registerMvuSchema'?node.expression
      :ts.isElementAccessExpression(node)&&ts.isStringLiteralLike(node.argumentExpression)
        &&node.argumentExpression.text==='registerMvuSchema'?node.expression:undefined
    return globalNamespace(object)&&runtimeValue(node)
  }
  // Importing or obtaining the registration capability declares its owner.
  // Calls, aliases and callback factories then execute normally in that owner;
  // the runtime alone establishes whether registration actually happened.
  return {nodes, dynamicImports,
    registrationIntent:registrationImport||nodes.some(({node})=>registrationValue(node))}
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
    kind: 'schema'; javascript: string;commandPolicyBindings:readonly RegisteredCommandPolicyBindingV1[]}
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
    return {kind: 'schema', javascript: result.outputText,commandPolicyBindings}
  } catch (error) {
    if (error instanceof RangeError) fail('MVU_SCHEMA_SYNTAX_DEPTH_LIMIT', script, file)
    throw error
  }
}
