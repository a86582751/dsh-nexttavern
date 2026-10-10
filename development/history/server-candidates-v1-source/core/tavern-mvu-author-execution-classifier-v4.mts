/** Unapplied local AST-only proposal. It never evaluates source, fetches a URL,
 * creates a schema, publishes Native state, or emits a state-ready receipt. */
import ts from 'typescript'
import {recordSha256, sha256} from './roleplay-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {fixedStateLoaderDependency, FIXED_STATE_LOADER_POLICY_SHA256}
  from './tavern-mvu-state-loader-policy-v4.mjs'
import type {AstSpanV1, AuthorExecutionPlanV1, ExecutionPlanScriptV1,
  ExecutorSelectionHintV1,
  FixedStateDependencyV1, LoaderImportSiteV1, PlannerOwnedDependenciesV1,
  RawAuthorScriptV4, ScriptAstCoverageV1} from './tavern-mvu-author-execution-types-v4.mjs'

const HASH = /^[0-9a-f]{64}$/
const C23_A_ORDER = [
  'https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',
  'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',
  'https://fastly.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',
] as const
class RejectedShape extends Error {
  constructor(readonly code: string) { super(code) }
}
function reject(code: string): never { throw new RejectedShape(code) }
const span = (node: ts.Node): AstSpanV1 => ({start: node.getFullStart(), end: node.end})
function freezeData<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child)
    Object.freeze(value)
  }
  return value
}
function walk(node: ts.Node, visit: (node: ts.Node, depth: number) => void, depth = 0): void {
  visit(node, depth)
  ts.forEachChild(node, child => walk(child, visit, depth + 1))
}
function checkerFor(file: ts.SourceFile, source: string): ts.TypeChecker {
  const options: ts.CompilerOptions = {noResolve: true, noLib: true,
    target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext}
  const host: ts.CompilerHost = {
    getSourceFile: name => name === file.fileName ? file : undefined,
    getDefaultLibFileName: () => '', writeFile() {}, getCurrentDirectory: () => '',
    getDirectories: () => [], fileExists: name => name === file.fileName,
    readFile: name => name === file.fileName ? source : undefined,
    getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  }
  return ts.createProgram([file.fileName], options, host).getTypeChecker()
}
function parse(script: RawAuthorScriptV4) {
  const scanner = ts.createScanner(ts.ScriptTarget.ES2023, false, ts.LanguageVariant.Standard, script.source)
  let tokens = 0, brackets = 0
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (++tokens > MVU_SCHEMA_BOUNDS.syntaxTokens) reject('EXECUTION_AST_TOKEN_LIMIT')
    if ([ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.OpenBracketToken].includes(token)) {
      if (++brackets > MVU_SCHEMA_BOUNDS.syntaxDepth) reject('EXECUTION_AST_DEPTH_LIMIT')
    } else if ([ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.CloseParenToken,
      ts.SyntaxKind.CloseBracketToken].includes(token)) brackets = Math.max(0, brackets - 1)
  }
  const file = ts.createSourceFile('author-execution.ts', script.source,
    ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS)
  const diagnostics = (file as ts.SourceFile & {parseDiagnostics: readonly ts.Diagnostic[]}).parseDiagnostics
  if (diagnostics.length) reject('EXECUTION_TYPESCRIPT_SYNTAX')
  let nodeCount = 0
  walk(file, (_node, depth) => {
    if (depth > MVU_SCHEMA_BOUNDS.syntaxDepth) reject('EXECUTION_AST_DEPTH_LIMIT')
    if (++nodeCount > MVU_SCHEMA_BOUNDS.syntaxTokens) reject('EXECUTION_AST_NODE_LIMIT')
  })
  return {file, nodeCount, checker: checkerFor(file, script.source)}
}
function coverage(file: ts.SourceFile, sourceSha256: string, nodeCount: number): ScriptAstCoverageV1 {
  return {encoding: 'native-mvu-complete-script-ast-coverage-v1', sourceSha256,
    nodeCount, statementSpans: file.statements.map(span)}
}

function loaderRecognizer(file: ts.SourceFile, checker: ts.TypeChecker,
  owned: PlannerOwnedDependenciesV1): readonly LoaderImportSiteV1[] | undefined {
  const sites: LoaderImportSiteV1[] = []
  const dependency = (specifier: string, candidateOrdinal: number): FixedStateDependencyV1 => {
    const fixed = fixedStateLoaderDependency(specifier)
    if (!fixed) reject('STATE_LOADER_UNKNOWN_EXACT_URL')
    return {...fixed, candidateOrdinal, ownedImplementation: owned.stateLoaderImplementation}
  }
  const literalImport = (statement: ts.Statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression)) return undefined
    const call = statement.expression.expression
    if (!ts.isCallExpression(call) || call.expression.kind !== ts.SyntaxKind.ImportKeyword) return undefined
    const argument = call.arguments[0]
    if (call.arguments.length !== 1 || call.typeArguments?.length || !argument || !ts.isStringLiteral(argument)) {
      reject('STATE_LOADER_LITERAL_REQUIRED')
    }
    return {kind: 'bare-await-literal' as const, importSpan: span(call), argumentSpan: span(argument),
      dependencies: [dependency(argument.text, 0)], lowering: 'replace-literal-specifier' as const}
  }
  const isFreeConsoleLog = (statement: ts.Statement, allowed: ReadonlySet<ts.Symbol>): boolean => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false
    const call = statement.expression, target = call.expression
    if (!ts.isPropertyAccessExpression(target) || !ts.isIdentifier(target.expression)
      || target.expression.text !== 'console' || checker.getSymbolAtLocation(target.expression)
      || !['log', 'info', 'warn', 'error'].includes(target.name.text)
      || call.arguments.length > 2 || call.typeArguments?.length) return false
    const data = (node: ts.Expression): boolean => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return true
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node)
        return !!symbol && allowed.has(symbol)
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return data(node.left) && data(node.right)
      }
      return ts.isTemplateExpression(node) && node.templateSpans.every(item => data(item.expression))
    }
    return call.arguments.every(data)
  }
  const failureTerminal = (statement: ts.Statement): boolean => {
    if (isFreeConsoleLog(statement, new Set())) return true
    if (!ts.isThrowStatement(statement) || !ts.isNewExpression(statement.expression)) return false
    const error = statement.expression
    const argument = error.arguments?.[0]
    return ts.isIdentifier(error.expression) && error.expression.text === 'Error'
      && !checker.getSymbolAtLocation(error.expression) && !error.typeArguments?.length && error.arguments?.length === 1
      && !!argument && ts.isStringLiteral(argument)
  }
  let statements: readonly ts.Statement[] = file.statements
  // Only a zero-argument async arrow IIFE is a loader wrapper. Function bodies,
  // callbacks, exports, arbitrary call chains and outer trailing statements
  // are not silently treated as inert bootstrap code.
  const outerStatement = statements[0]
  if (statements.length === 1 && outerStatement && ts.isExpressionStatement(outerStatement)) {
    const expression = outerStatement.expression
    if (ts.isCallExpression(expression) && expression.arguments.length === 0) {
      let callee: ts.Expression = expression.expression
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression
      if (ts.isArrowFunction(callee) && callee.parameters.length === 0 && !callee.typeParameters?.length && !callee.type
        && callee.modifiers?.length === 1 && callee.modifiers[0]?.kind === ts.SyntaxKind.AsyncKeyword
        && ts.isBlock(callee.body)) statements = callee.body.statements
    }
  }
  if (!statements.length) return undefined
  // Length proves the finite grammar; retain each indexed node locally so
  // strict indexed access also proves its presence before a shape check.
  const firstStatement = statements[0], secondStatement = statements[1]

  // Complete sequence of direct side-effect imports, or complete sequence of
  // unused bare await literal imports. No namespace/default/named consumption.
  if (statements.every(ts.isImportDeclaration)) {
    for (const statement of statements as readonly ts.ImportDeclaration[]) {
      if (statement.importClause) reject('STATE_LOADER_EXPORT_CONSUMPTION_UNSUPPORTED')
      if (statement.attributes || !ts.isStringLiteral(statement.moduleSpecifier)) {
        reject('STATE_LOADER_IMPORT_ATTRIBUTES_UNSUPPORTED')
      }
      sites.push({kind: 'bare-static', importSpan: span(statement), argumentSpan: span(statement.moduleSpecifier),
        dependencies: [dependency(statement.moduleSpecifier.text, 0)], lowering: 'replace-literal-specifier'})
    }
  } else if (statements.every(statement => ts.isExpressionStatement(statement)
    && ts.isAwaitExpression(statement.expression)
    && ts.isCallExpression(statement.expression.expression)
    && statement.expression.expression.expression.kind === ts.SyntaxKind.ImportKeyword)) {
    for (const statement of statements) sites.push(literalImport(statement)!)
  } else if (statements.length === 1 && firstStatement && ts.isTryStatement(firstStatement)) {
    const attempt = firstStatement
    if (attempt.finallyBlock || !attempt.catchClause || attempt.tryBlock.statements.length !== 1
      || attempt.catchClause.block.statements.length !== 1) return undefined
    const binding = attempt.catchClause.variableDeclaration?.name
    if (binding && !ts.isIdentifier(binding)) return undefined
    if (attempt.catchClause.variableDeclaration?.type || attempt.catchClause.variableDeclaration?.initializer) return undefined
    const primaryStatement = attempt.tryBlock.statements[0], fallbackStatement = attempt.catchClause.block.statements[0]
    if (!primaryStatement || !fallbackStatement) return undefined
    const primary = literalImport(primaryStatement)
    const fallback = literalImport(fallbackStatement)
    if (!primary || !fallback) return undefined
    // These are ordered authored sites. No HTTP winner or retry is recorded.
    sites.push(primary, {...fallback, dependencies: fallback.dependencies.map(item => ({...item, candidateOrdinal: 1}))})
  } else if (statements.length >= 2 && statements.length <= 3
    && firstStatement && secondStatement
    && ts.isVariableStatement(firstStatement) && ts.isForOfStatement(secondStatement)) {
    const declaration = firstStatement.declarationList, loop = secondStatement
    if ((declaration.flags & ts.NodeFlags.BlockScoped) !== ts.NodeFlags.Const
      || declaration.declarations.length !== 1 || firstStatement.modifiers?.length) return undefined
    const array = declaration.declarations[0]
    if (!array || !ts.isIdentifier(array.name) || array.type || array.exclamationToken
      || !array.initializer || !ts.isArrayLiteralExpression(array.initializer)
      || array.initializer.elements.length !== C23_A_ORDER.length) return undefined
    const literals = array.initializer.elements
    if (!literals.every((item, index) => ts.isStringLiteral(item) && item.text === C23_A_ORDER[index])) return undefined
    const arraySymbol = checker.getSymbolAtLocation(array.name)
    if (!arraySymbol || !ts.isIdentifier(loop.expression)
      || checker.getSymbolAtLocation(loop.expression) !== arraySymbol || loop.awaitModifier
      || !ts.isVariableDeclarationList(loop.initializer)
      || (loop.initializer.flags & ts.NodeFlags.BlockScoped) !== ts.NodeFlags.Const
      || loop.initializer.declarations.length !== 1) return undefined
    const loopBinding = loop.initializer.declarations[0]
    if (!loopBinding || !ts.isIdentifier(loopBinding.name) || loopBinding.type || loopBinding.exclamationToken
      || loopBinding.initializer || !ts.isBlock(loop.statement)
      || loop.statement.statements.length !== 1) return undefined
    const loopSymbol = checker.getSymbolAtLocation(loopBinding.name)
    const attempt = loop.statement.statements[0]
    if (!attempt || !ts.isTryStatement(attempt) || !loopSymbol || attempt.finallyBlock || !attempt.catchClause
      || !attempt.catchClause.variableDeclaration || attempt.catchClause.variableDeclaration.type
      || attempt.catchClause.variableDeclaration.initializer
      || !ts.isIdentifier(attempt.catchClause.variableDeclaration.name)) {
      return undefined
    }
    const caught = checker.getSymbolAtLocation(attempt.catchClause.variableDeclaration.name)
    const allowed = new Set([loopSymbol, ...(caught ? [caught] : [])])
    const body = attempt.tryBlock.statements, first = body[0], last = body.at(-1)
    if (body.length < 2 || body.length > 3 || !first || !ts.isExpressionStatement(first)
      || !ts.isAwaitExpression(first.expression) || !ts.isCallExpression(first.expression.expression)
      || !last || !ts.isReturnStatement(last) || last.expression) return undefined
    const call = first.expression.expression
    const argument = call.arguments[0]
    if (call.expression.kind !== ts.SyntaxKind.ImportKeyword || call.arguments.length !== 1 || call.typeArguments?.length
      || !argument || !ts.isIdentifier(argument) || checker.getSymbolAtLocation(argument) !== loopSymbol) {
      return undefined
    }
    const successLog = body[1], failureLog = attempt.catchClause.block.statements[0], terminal = statements[2]
    if (body.length === 3 && (!successLog || !isFreeConsoleLog(successLog, new Set([loopSymbol])))) return undefined
    if (attempt.catchClause.block.statements.length !== 1
      || !failureLog || !isFreeConsoleLog(failureLog, allowed)) return undefined
    if (statements.length === 3 && (!terminal || !failureTerminal(terminal))) return undefined
    // Immutable binding is insufficient alone: prove there are no aliases,
    // element mutations, property accesses or additional reads of the array.
    let arrayUses = 0, forbiddenUse = false
    walk(file, node => {
      if (ts.isIdentifier(node) && node !== array.name && checker.getSymbolAtLocation(node) === arraySymbol) {
        arrayUses++
        if (node !== loop.expression) forbiddenUse = true
      }
      if (ts.isIdentifier(node) && node !== loopBinding.name
        && checker.getSymbolAtLocation(node) === loopSymbol
        && (node.getStart(file) < loop.getStart(file) || node.end > loop.end)) forbiddenUse = true
    })
    if (arrayUses !== 1 || forbiddenUse) return undefined
    sites.push({kind: 'bounded-const-forof', importSpan: span(call), argumentSpan: span(argument),
      dependencies: C23_A_ORDER.map(dependency), lowering: 'exact-url-conditional'})
  } else return undefined
  const families = new Set(sites.flatMap(site => site.dependencies.map(item => item.group)))
  if (families.size !== 1) reject('STATE_LOADER_MULTIPLE_FAMILIES_UNSUPPORTED')
  return sites
}

/** Constructor dependencies are trusted compiler-worker closures/assets, not
 * author/host inputs. Raw descriptors must already satisfy canonical Source
 * data bounds/descriptors; this classifier cannot replace Source admission. */
export function createAuthorExecutionPlannerV1(owned: PlannerOwnedDependenciesV1) {
  if (ts.version !== '5.9.3') throw Error('EXECUTION_TYPESCRIPT_VERSION')
  const implementation = owned.stateLoaderImplementation
  if (implementation.id !== 'native-mvu-state-loader' || implementation.version !== 4
    || !HASH.test(implementation.implementationSha256)) throw Error('EXECUTION_OWNED_LOADER_IDENTITY')
  const retainedImplementation = freezeData({...implementation})
  const privateOwned = {...owned, stateLoaderImplementation: retainedImplementation}
  const classify = (script: RawAuthorScriptV4, ordinal: number, candidate = false): ExecutionPlanScriptV1 => {
    const base = {ordinal, identity: script.identity, pointer: script.pointer, enabled: script.enabled,
      sourceSha256: script.sourceSha256, rawDescriptorSha256: recordSha256(script)}
    const refused = (codes: readonly string[]): ExecutionPlanScriptV1 => ({...base,
      classification: 'unsupported', disposition: 'refused', coverage: null, loaderImports: [],
      diagnosticCodes: codes, evidence: 'none'})
    try {
      if (typeof script.source !== 'string' || !HASH.test(script.sourceSha256)
        || sha256(script.source) !== script.sourceSha256) reject('EXECUTION_RAW_SOURCE_HASH_MISMATCH')
      if (Buffer.byteLength(script.source, 'utf8') > MVU_SCHEMA_BOUNDS.sourceBytes) reject('EXECUTION_SOURCE_BYTE_LIMIT')
      if (!script.enabled) return {...base, classification: 'disabled', disposition: 'disabled',
        coverage: null, loaderImports: [], diagnosticCodes: [], evidence: 'disabled-source-retained'}
      const parsed = parse(script), complete = coverage(parsed.file, script.sourceSha256, parsed.nodeCount)
      const localEvidence = privateOwned.localBrowserAuditEvidence?.find(item => item.localOnly
        && item.sourceSha256 === script.sourceSha256)
      if (localEvidence) {
        // Exact whole bytes are only local audit evidence. They intentionally
        // grant neither server execution nor generic browser support.
        if (localEvidence.exactSpecifiers.some(url => !fixedStateLoaderDependency(url))) {
          reject('EXECUTION_LOCAL_BROWSER_UNKNOWN_DEPENDENCY')
        }
        return {...base, classification: localEvidence.classification, disposition: 'browser-deferred',
          coverage: null, loaderImports: [], diagnosticCodes: ['LOCAL_BROWSER_AUDIT_NOT_PUBLIC_AST_ADMISSION'],
          evidence: 'local-audit-only'}
      }
      let stateLiteralImport = false, stateArrayImport = false, schemaReference = false, browserHost = false
      const stateArraySymbols = new Set<ts.Symbol>()
      walk(parsed.file, node => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
          && ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length
          && node.initializer.elements.every(item => ts.isStringLiteral(item) && fixedStateLoaderDependency(item.text))) {
          const symbol = parsed.checker.getSymbolAtLocation(node.name)
          if (symbol) stateArraySymbols.add(symbol)
        }
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const specifier = node.moduleSpecifier.text
          if (fixedStateLoaderDependency(specifier)) stateLiteralImport = true
          if (script.imports.some(binding => binding.specifier === specifier
            && binding.kind === 'schema-bridge')) schemaReference = true
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = node.arguments[0]
          if (argument && ts.isStringLiteral(argument) && fixedStateLoaderDependency(argument.text)) stateLiteralImport = true
        }
        if (ts.isForOfStatement(node) && ts.isIdentifier(node.expression)
          && stateArraySymbols.has(parsed.checker.getSymbolAtLocation(node.expression)!)) stateArrayImport = true
        if (ts.isIdentifier(node) && ['window', 'parent', 'document', 'setTimeout'].includes(node.text)
          && !parsed.checker.getSymbolAtLocation(node)) browserHost = true
      })
      if ((stateLiteralImport || stateArrayImport) && schemaReference) {
        reject('EXECUTION_MIXED_SCHEMA_AND_STATE_LOADER_UNSUPPORTED')
      }
      // Schema import-only scripts must not be mistaken for a state loader.
      // Native recognition is attempted only for a real fixed state import or
      // its linked const-array loop; every remaining statement is still checked.
      if (stateLiteralImport || stateArrayImport) {
        const sites = loaderRecognizer(parsed.file, parsed.checker, privateOwned)
        if (sites) return {...base, classification: 'native-state-loader', disposition: 'native-owned',
          coverage: complete, loaderImports: sites, diagnosticCodes: [], evidence: 'complete-loader-ast'}
        reject(browserHost ? 'EXECUTION_BROWSER_BOOTSTRAP_DEFERRED_AST_UNPROVEN'
          : 'EXECUTION_STATE_LOADER_COMPLETE_SHAPE_UNSUPPORTED')
      }
      // Candidate admission asks the worker's canonical schema owner whether
      // this AST is claimed before its gates can reject ordinary browser code.
      if (browserHost && !candidate) reject('EXECUTION_BROWSER_SCRIPT_DEFERRED_AST_UNPROVEN')
      const schema = privateOwned.admitSchemaAst?.({script, ordinal,
        sourceFile: parsed.file, checker: parsed.checker})
      if (schema?.kind === 'accepted-schema') {
        if (schema.admittedSourceSha256 !== script.sourceSha256
          || recordSha256(schema.statementSpans) !== recordSha256(complete.statementSpans)) {
          reject('EXECUTION_SCHEMA_AST_COVERAGE_MISMATCH')
        }
        return {...base, classification: 'server-schema', disposition: 'server', coverage: complete,
          loaderImports: [], diagnosticCodes: [], evidence: 'trusted-schema-worker'}
      }
      return refused(schema?.diagnosticCodes.length ? schema.diagnosticCodes : ['EXECUTION_COMPLETE_SHAPE_UNSUPPORTED'])
    } catch (error) {
      return refused([error instanceof RejectedShape ? error.code : error instanceof RangeError
        ? 'EXECUTION_AST_DEPTH_LIMIT' : 'EXECUTION_CLASSIFICATION_FAILED'])
    }
  }
  // The worker retains classify results and accepted JS together. Assembly
  // consumes those rows without reparsing/recompiling the accepted Source.
  const assemblePlan = (rows: readonly ExecutionPlanScriptV1[]): AuthorExecutionPlanV1 => {
    const enabledFamilies = new Set(rows.filter(row => row.enabled
      && row.classification === 'native-state-loader').flatMap(row =>
      row.loaderImports.flatMap(site => site.dependencies.map(item => item.group))))
    // Unsupported/deferred rows already cannot obtain execution authority.
    // Fully recognized native rows also cannot silently combine different
    // researched state dialects into one Program/owned Native initializer.
    if (enabledFamilies.size > 1) throw Error('EXECUTION_PROGRAM_MULTIPLE_STATE_FAMILIES_UNSUPPORTED')
    const count = (classification: ExecutionPlanScriptV1['classification']) =>
      rows.filter(row => row.enabled && row.classification === classification).length
    const body = {schemaVersion: 1 as const, encoding: 'native-mvu-author-execution-plan-v1' as const,
      classifier: {id: 'owned-author-ast-classifier' as const, version: 1 as const,
        typescriptVersion: '5.9.3' as const}, dependencyPolicySha256: FIXED_STATE_LOADER_POLICY_SHA256,
      scripts: rows, summary: {enabledServerSchema: count('server-schema'),
        enabledNativeLoaders: count('native-state-loader'),
        enabledBrowserDeferred: count('browser-bootstrap') + count('browser-script'),
        unsupportedEnabled: count('unsupported')},
      zeroRegistrationPolicy: 'forbid-if-any-enabled-server-schema' as const,
      rawExecutionPolicy: 'execute-only-server-schema' as const,
      containsLocalAuditEvidence: rows.some(row => row.evidence === 'local-audit-only')}
    return freezeData({...body, executionPlanSha256: recordSha256(body)})
  }
  return Object.freeze({
    classify: (script: RawAuthorScriptV4, ordinal: number) => classify(script, ordinal),
    classifyCandidate: (script: RawAuthorScriptV4, ordinal: number) => classify(script, ordinal, true),
    assemblePlan,
    /** Keep fresh schema-only inputs on executor3. An enabled fixed dependency
     * selects the independent executor4 candidate without admitting the whole
     * script. Actual loader effects never result from this hint or fulfilled
     * import; raw loader source is not executed by the future server worker. */
    selectionHint: selectionHintForScriptsV1,
    plan(scripts: readonly RawAuthorScriptV4[]): AuthorExecutionPlanV1 {
      if (scripts.length > MVU_SCHEMA_BOUNDS.scripts) throw Error('EXECUTION_SCRIPT_LIMIT')
      if (new Set(scripts.map(script => script.identity)).size !== scripts.length
        || new Set(scripts.map(script => script.pointer)).size !== scripts.length) {
        throw Error('EXECUTION_DUPLICATE_RAW_SCRIPT_DESCRIPTOR')
      }
      return assemblePlan(scripts.map((script, ordinal) => classify(script, ordinal)))
    },
  })
}

/** Pure package selection: no mapper, worker admission, or runtime activation. */
export function selectionHintForScriptsV1(scripts: readonly RawAuthorScriptV4[]): ExecutorSelectionHintV1 {
  const known: ExecutorSelectionHintV1['knownEnabledDependencies'][number][] = []
  const diagnosticCodes: string[] = []
  for (const [scriptOrdinal, script] of scripts.entries()) {
    if (!script.enabled) continue
    try {
      if (sha256(script.source) !== script.sourceSha256) reject('EXECUTION_RAW_SOURCE_HASH_MISMATCH')
      if (Buffer.byteLength(script.source, 'utf8') > MVU_SCHEMA_BOUNDS.sourceBytes) reject('EXECUTION_SOURCE_BYTE_LIMIT')
      const parsed = parse(script), arraySymbols = new Map<ts.Symbol, readonly string[]>()
      const add = (exactSpecifier: string) => {
        const fixed = fixedStateLoaderDependency(exactSpecifier)
        if (fixed) known.push({scriptOrdinal, exactSpecifier, group: fixed.group})
      }
      walk(parsed.file, node => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
          && ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length
          && node.initializer.elements.every(ts.isStringLiteral)) {
          const symbol = parsed.checker.getSymbolAtLocation(node.name)
          if (symbol) arraySymbols.set(symbol, node.initializer.elements.map(item => (item as ts.StringLiteral).text))
        }
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.text)
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = node.arguments[0]
          if (node.arguments.length === 1 && argument && ts.isStringLiteral(argument)) add(argument.text)
        }
        if (ts.isForOfStatement(node) && ts.isIdentifier(node.expression)) {
          const values = arraySymbols.get(parsed.checker.getSymbolAtLocation(node.expression)!)
          if (values) {
            const loopSymbols = ts.isVariableDeclarationList(node.initializer)
              ? new Set(node.initializer.declarations.map(item => parsed.checker.getSymbolAtLocation(item.name))) : new Set()
            walk(node.statement, child => {
              if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
                const argument = child.arguments[0]
                if (child.arguments.length === 1 && argument && ts.isIdentifier(argument)
                  && loopSymbols.has(parsed.checker.getSymbolAtLocation(argument))) values.forEach(add)
              }
            })
          }
        }
      })
    } catch (error) {
      diagnosticCodes.push(error instanceof RejectedShape ? error.code : 'EXECUTION_HINT_AST_UNAVAILABLE')
    }
  }
  return freezeData({suggestedExecutorVersion: known.length ? 4 : 3,
    authority: 'selection-hint-only', knownEnabledDependencies: known, diagnosticCodes})
}
