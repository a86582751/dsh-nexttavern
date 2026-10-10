/** Worker-internal complete browser profile compiler. Source is parsed, lexically bound,
 * semantically checked and transpiled; author code is never evaluated here. */
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type * as TypeScript from 'typescript'
import {recordSha256,sha256} from './roleplay-data.js'
import {ownedBrowserRuntimeIdentityV1,ownedBrowserCompilerIdentityV1} from './tavern-author-browser-artifact.mjs'
import {BROWSER_AMBIENT_V1,BROWSER_ATTRIBUTES_V1,BROWSER_BOUNDS_V1,BROWSER_BUILTIN_CALLS_V1,
  BROWSER_CAPABILITY_CONTRACT_V1,BROWSER_EVENTS_V1,BROWSER_ESCAPE_PROPERTIES_V1,BROWSER_GLOBALS_V1,
  BROWSER_MISSING_HOSTS_V1,BROWSER_PROFILE_V1,BROWSER_SYNTAX_V1,BROWSER_TAGS_V1} from './tavern-author-browser-profile.mjs'
import type {BrowserAstCoverageV1,BrowserCapabilityV1,BrowserCompilationInputV1,BrowserCompilationV1,
  BrowserCompiledScriptV1,BrowserCompilerIdentityV1,BrowserCompilerV1,BrowserDiagnosticV1,
  BrowserProgramV1,BrowserRawScriptV1,BrowserRuntimeArtifactV1,BrowserCandidateBatchV1,BrowserCandidateRowV1,
  BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'

const require=createRequire(new URL('../package.json',import.meta.url))
const typescriptEntry=fileURLToPath(new URL('../node_modules/typescript/lib/typescript.js',import.meta.url))
const ts:typeof TypeScript=require(typescriptEntry) as typeof TypeScript
const bounds=BROWSER_BOUNDS_V1,HASH=/^[a-f0-9]{64}$/
const ENTRY='__owned_browser_program_v1_entry__',PREFIX=`async function ${ENTRY}() {\n`
const BUDGET='__owned_browser_budget_v1__'
const ambientName='owned-browser-profile-v1.d.ts',authorName='owned-browser-author-v1.ts'
const allowedSyntax=new Set<TypeScript.SyntaxKind>(BROWSER_SYNTAX_V1.map(name=>
  ts.SyntaxKind[name as keyof typeof ts.SyntaxKind]))
const allowedGlobals=new Set<string>(BROWSER_GLOBALS_V1)
const missingHosts=new Set<string>(BROWSER_MISSING_HOSTS_V1),escapeProperties=new Set<string>(BROWSER_ESCAPE_PROPERTIES_V1)
const implicitCallables=new Set(['toString','valueOf','toJSON','then'])
type Callable=TypeScript.FunctionDeclaration|TypeScript.FunctionExpression|TypeScript.ArrowFunction|TypeScript.MethodDeclaration
interface Parsed {
  file:TypeScript.SourceFile
  original:TypeScript.SourceFile
  entry:TypeScript.FunctionDeclaration
  checker:TypeScript.TypeChecker
  program:TypeScript.Program
}
class BrowserRefusal extends Error {
  constructor(readonly diagnostic:BrowserDiagnosticV1) {super(diagnostic.code)}
}
function fail(code:string,script?:BrowserRawScriptV1,parsed?:Parsed,node?:TypeScript.Node,feature?:string):never {
  const offset=parsed&&node?Math.max(0,Math.min(script!.descriptor.source.length,node.getStart(parsed.file)-PREFIX.length)):0
  const position=parsed?.original.getLineAndCharacterOfPosition(offset)
  throw new BrowserRefusal({code,...script?{scriptIdentity:script.descriptor.identity,pointer:script.descriptor.pointer,
    ordinal:script.ordinal}:{},...position?{line:position.line+1,column:position.character+1}:{},...feature?{feature}:{}})
}
function callable(node:TypeScript.Node):node is Callable {
  return ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node)
}
function transparentExpression(node:TypeScript.Node):node is TypeScript.ParenthesizedExpression
  |TypeScript.AsExpression|TypeScript.TypeAssertion|TypeScript.NonNullExpression|TypeScript.SatisfiesExpression {
  return ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)
    ||ts.isNonNullExpression(node)||ts.isSatisfiesExpression(node)
}
function memberName(expression:TypeScript.Expression):string|undefined {
  if(ts.isPropertyAccessExpression(expression))return expression.name.text
  if(ts.isElementAccessExpression(expression)&&ts.isStringLiteralLike(expression.argumentExpression)) {
    return expression.argumentExpression.text
  }
  return undefined
}
function nameOnly(node:TypeScript.Identifier):boolean {
  const parent=node.parent
  return ts.isPropertyAccessExpression(parent)&&parent.name===node
    ||(ts.isPropertyAssignment(parent)||ts.isMethodDeclaration(parent))&&parent.name===node
    ||ts.isBindingElement(parent)&&parent.propertyName===node
    ||(ts.isVariableDeclaration(parent)||ts.isParameter(parent)||ts.isFunctionDeclaration(parent)
      ||ts.isFunctionExpression(parent))&&parent.name===node
}
function scan(script:BrowserRawScriptV1):void {
  const source=script.descriptor.source
  if(Buffer.byteLength(source,'utf8')>bounds.sourceBytes)fail('BROWSER_SOURCE_BYTE_LIMIT',script)
  const scanner=ts.createScanner(ts.ScriptTarget.ES2023,false,ts.LanguageVariant.Standard,source)
  let tokens=0,depth=0
  for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan()) {
    if(++tokens>bounds.syntaxTokens)fail('BROWSER_SYNTAX_TOKEN_LIMIT',script)
    if([ts.SyntaxKind.OpenBraceToken,ts.SyntaxKind.OpenParenToken,ts.SyntaxKind.OpenBracketToken].includes(token)) {
      if(++depth>bounds.syntaxDepth)fail('BROWSER_SYNTAX_DEPTH_LIMIT',script)
    }else if([ts.SyntaxKind.CloseBraceToken,ts.SyntaxKind.CloseParenToken,ts.SyntaxKind.CloseBracketToken].includes(token)) {
      depth=Math.max(0,depth-1)
    }
  }
}
function parse(script:BrowserRawScriptV1):Parsed {
  scan(script)
  const original=ts.createSourceFile('original-browser-author.ts',script.descriptor.source,
    ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS)
  const file=ts.createSourceFile(authorName,PREFIX+script.descriptor.source+'\n}',
    ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS)
  const parserDiagnostics=(file as TypeScript.SourceFile&{parseDiagnostics:readonly TypeScript.Diagnostic[]}).parseDiagnostics
  if(parserDiagnostics.length)fail('BROWSER_TYPESCRIPT_SYNTAX',script)
  const entry=file.statements[0]
  if(file.statements.length!==1||!entry||!ts.isFunctionDeclaration(entry)||!entry.body||entry.name?.text!==ENTRY) {
    fail('BROWSER_SCRIPT_SCOPE_INVALID',script)
  }
  const options:TypeScript.CompilerOptions={target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None,
    strict:true,noEmit:true,lib:['lib.es2023.d.ts']}
  const nativeHost=ts.createCompilerHost(options,true),libraryRoot=path.dirname(typescriptEntry)
  const ambient=ts.createSourceFile(ambientName,BROWSER_AMBIENT_V1,ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS)
  const host:TypeScript.CompilerHost={...nativeHost,
    getSourceFile:(name,version,onError,create)=>name===authorName?file:name===ambientName?ambient:
      path.dirname(path.resolve(name))===libraryRoot?nativeHost.getSourceFile(name,version,onError,create):undefined,
    fileExists:name=>name===authorName||name===ambientName||path.dirname(path.resolve(name))===libraryRoot&&nativeHost.fileExists(name),
    readFile:name=>name===authorName?file.text:name===ambientName?BROWSER_AMBIENT_V1:
      path.dirname(path.resolve(name))===libraryRoot?nativeHost.readFile(name):undefined,
    getDefaultLibFileName:()=>path.join(libraryRoot,'lib.es2023.d.ts'),
    writeFile:()=>{},
  }
  const program=ts.createProgram([authorName,ambientName],options,host)
  return {file,original,entry,checker:program.getTypeChecker(),program}
}

function localFunction(expression:TypeScript.Expression,parsed:Parsed,seen=new Set<TypeScript.Symbol>()):Callable|undefined {
  while(transparentExpression(expression))expression=expression.expression
  if(callable(expression))return expression
  const symbol=parsed.checker.getSymbolAtLocation(expression)
  if(!symbol||seen.has(symbol))return undefined
  seen.add(symbol)
  for(const declaration of symbol.declarations??[]) {
    if(declaration.getSourceFile()!==parsed.file)continue
    if(callable(declaration)&&declaration.body)return declaration
    if(ts.isVariableDeclaration(declaration)&&declaration.initializer) {
      if(!ts.isVariableDeclarationList(declaration.parent)
        ||!(declaration.parent.flags&ts.NodeFlags.Const))return undefined
      return localFunction(declaration.initializer,parsed,seen)
    }
    if(ts.isPropertyAssignment(declaration))return localFunction(declaration.initializer,parsed,seen)
  }
  return undefined
}
function signatureOwner(declaration:TypeScript.SignatureDeclaration|TypeScript.JSDocSignature|undefined):{owner:string;name:string}|undefined {
  if(!declaration)return undefined
  const name='name' in declaration&&declaration.name&&ts.isIdentifier(declaration.name)?declaration.name.text:''
  const parent=declaration.parent
  return ts.isInterfaceDeclaration(parent)?{owner:parent.name.text,name}:{owner:'',name}
}
/** NoDetachedStartup: every Promise-valued author call stays in the awaited
 * entry/handler return chain, so entry completion cannot leave startup work
 * running after the child changes its lifecycle to started. This is not a
 * Source/Native permission check. Promise variable transfers need a separate
 * supported ownership grammar; this profile only admits direct await/return. */
function promiseCallIsOwned(node:TypeScript.CallExpression):boolean {
  let value:TypeScript.Expression=node
  while(transparentExpression(value.parent))value=value.parent
  const parent=value.parent
  return ts.isAwaitExpression(parent)&&parent.expression===value
    ||ts.isReturnStatement(parent)&&parent.expression===value
    ||ts.isArrowFunction(parent)&&parent.body===value
}
type PromiseKind='sync'|'promise'|'unproven'
function mergePromiseKinds(left:PromiseKind,right:PromiseKind):PromiseKind {
  return left==='unproven'||right==='unproven'?'unproven':left==='promise'||right==='promise'?'promise':'sync'
}
function promiseTypeKind(type:TypeScript.Type,node:TypeScript.Node,parsed:Parsed):PromiseKind {
  if(type.isUnion())return type.types.reduce<PromiseKind>((kind,item)=>
    mergePromiseKinds(kind,promiseTypeKind(item,node,parsed)),'sync')
  if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown))return 'unproven'
  const then=type.getProperty('then')
  return then&&parsed.checker.getTypeOfSymbolAtLocation(then,node).getCallSignatures().length?'promise':'sync'
}
function returnedPromiseKind(expression:TypeScript.Expression,parsed:Parsed,
  facts:ReadonlyMap<Callable,PromiseKind>):PromiseKind {
  while(transparentExpression(expression))expression=expression.expression
  if(ts.isCallExpression(expression)) {
    const own=localFunction(expression.expression,parsed)
    // Actual local bodies, not author return annotations, own this fact. The
    // existing call DAG has evaluated their callees before their callers.
    if(own)return facts.get(own)??'unproven'
  }
  if(ts.isConditionalExpression(expression))return mergePromiseKinds(
    returnedPromiseKind(expression.whenTrue,parsed,facts),returnedPromiseKind(expression.whenFalse,parsed,facts))
  if(ts.isBinaryExpression(expression)&&[ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken].includes(expression.operatorToken.kind))return mergePromiseKinds(
    returnedPromiseKind(expression.left,parsed,facts),returnedPromiseKind(expression.right,parsed,facts))
  return promiseTypeKind(parsed.checker.getTypeAtLocation(expression),expression,parsed)
}
function semanticFailure(script:BrowserRawScriptV1,parsed:Parsed):void {
  const diagnostic=parsed.program.getSemanticDiagnostics(parsed.file)[0]
  if(!diagnostic)return
  const start=diagnostic.start??PREFIX.length,offset=Math.max(0,start-PREFIX.length)
  const position=parsed.original.getLineAndCharacterOfPosition(Math.min(offset,script.descriptor.source.length))
  const code=[2339,2551,7053].includes(diagnostic.code)?'BROWSER_MEMBER_UNSUPPORTED':'BROWSER_TYPESCRIPT_CONTRACT'
  let located:TypeScript.Node=parsed.file
  for(;;) {
    let childAt:TypeScript.Node|undefined
    ts.forEachChild(located,child=>{
      if(child.getStart(parsed.file)<=start&&start<child.end)childAt=child
    })
    if(!childAt)break
    located=childAt
  }
  const feature=ts.isIdentifier(located)?located.text:`TS${diagnostic.code}`
  throw new BrowserRefusal({code,scriptIdentity:script.descriptor.identity,pointer:script.descriptor.pointer,
    ordinal:script.ordinal,line:position.line+1,column:position.character+1,feature})
}
function ownedNumericalValues(expression:TypeScript.Expression,parsed:Parsed):boolean {
  const seen=new Set<TypeScript.Symbol>()
  for(;;) {
    if(ts.isParenthesizedExpression(expression)){expression=expression.expression;continue}
    if(ts.isPropertyAccessExpression(expression)&&expression.name.text==='values') {
      return parsed.checker.getSymbolAtLocation(expression.name)?.declarations?.some(node=>
        node.getSourceFile().fileName===ambientName)===true
    }
    if(!ts.isIdentifier(expression))return false
    const symbol=parsed.checker.getSymbolAtLocation(expression)
    if(!symbol||seen.has(symbol))return false
    seen.add(symbol)
    const declaration=symbol.valueDeclaration
    if(declaration&&ts.isVariableDeclaration(declaration)&&declaration.initializer
      &&ts.isVariableDeclarationList(declaration.parent)&&declaration.parent.flags&ts.NodeFlags.Const) {
      expression=declaration.initializer;continue
    }
    if(declaration&&ts.isBindingElement(declaration)&&ts.isObjectBindingPattern(declaration.parent)
      &&ts.isVariableDeclaration(declaration.parent.parent)&&declaration.parent.parent.initializer
      &&(declaration.propertyName?.getText(parsed.file)??declaration.name.getText(parsed.file))==='values') {
      const value=parsed.checker.getTypeAtLocation(declaration.parent.parent.initializer).getProperty('values')
      return value?.declarations?.some(node=>node.getSourceFile().fileName===ambientName)===true
    }
    return false
  }
}

function admit(script:BrowserRawScriptV1,parsed:Parsed):{coverage:BrowserAstCoverageV1;capabilities:readonly BrowserCapabilityV1[]} {
  const checker=parsed.checker,functions:Callable[]=[parsed.entry],ids=new Map<Callable,number>([[parsed.entry,0]])
  const weights=[0],edges:Map<number,number>[]=[new Map()],capabilities=new Set<BrowserCapabilityV1>()
  const returnedExpressions:TypeScript.Expression[][]=[[]],promiseFacts=new Map<Callable,PromiseKind>()
  const statements:BrowserAstCoverageV1['statements'][number][]=[],calls:{node:TypeScript.CallExpression|TypeScript.NewExpression;owner:number}[]=[]
  const pending:{node:TypeScript.Node;depth:number;owner:number}[]=[{node:parsed.entry.body!,depth:0,owner:0}]
  let nodeCount=0
  function edge(from:number,target:Callable,node:TypeScript.Node):void {
    const to=ids.get(target)
    if(to===undefined)fail('BROWSER_CALL_TARGET_UNPROVEN',script,parsed,node)
    edges[from]!.set(to,(edges[from]!.get(to)??0)+1)
  }
  while(pending.length) {
    const held=pending.pop()!,node=held.node
    if(held.depth>bounds.syntaxDepth)fail('BROWSER_AST_DEPTH_LIMIT',script,parsed,node)
    if(++nodeCount>bounds.syntaxNodes)fail('BROWSER_AST_NODE_LIMIT',script,parsed,node)
    let owner=held.owner
    if(callable(node)) {
      if(!ts.isArrowFunction(node)&&node.asteriskToken)fail('BROWSER_GENERATOR_UNSUPPORTED',script,parsed,node)
      weights[owner]=weights[owner]!+1
      owner=functions.length;functions.push(node);ids.set(node,owner);weights.push(0);edges.push(new Map());returnedExpressions.push([])
      if(ts.isArrowFunction(node)&&!ts.isBlock(node.body))returnedExpressions[owner]!.push(node.body)
    }
    weights[owner]=weights[owner]!+1
    const kind=ts.SyntaxKind[node.kind]
    if(!allowedSyntax.has(node.kind)) {
      const unbounded=ts.isForStatement(node)||ts.isForInStatement(node)||ts.isForOfStatement(node)
        ||ts.isWhileStatement(node)||ts.isDoStatement(node)
      fail(unbounded?'BROWSER_UNBOUNDED_CONTROL_FLOW':'BROWSER_SYNTAX_UNSUPPORTED',script,parsed,node,kind)
    }
    if(node!==parsed.entry.body&&ts.isStatement(node))statements.push({
      start:Math.max(0,node.getFullStart()-PREFIX.length),end:node.end-PREFIX.length,syntaxKind:kind,
    })
    if(ts.isIdentifier(node)&&(node.text===ENTRY||node.text===BUDGET))fail('BROWSER_RESERVED_BINDING',script,parsed,node)
    if(ts.isSpreadAssignment(node)&&(!ts.isObjectLiteralExpression(node.parent)||node.parent.properties.length!==1
      ||!ownedNumericalValues(node.expression,parsed)))fail('BROWSER_NUMERICAL_SPREAD_UNSUPPORTED',script,parsed,node)
    if(ts.isIdentifier(node)&&!nameOnly(node)) {
      const symbol=checker.getSymbolAtLocation(node),local=symbol?.declarations?.some(item=>item.getSourceFile()===parsed.file)
      if(!local) {
        if(!allowedGlobals.has(node.text))fail(missingHosts.has(node.text)?'BROWSER_HOST_CAPABILITY_UNSUPPORTED':
          'BROWSER_FREE_NAME_UNSUPPORTED',script,parsed,node,node.text)
        if(node.text==='root'||node.text==='document')capabilities.add('isolated-dom-text')
        if(node.text==='getVariables')capabilities.add('owned-variable-snapshot')
        if(node.text==='getChatMessages')capabilities.add('owned-message-snapshot')
      }
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
      const name=memberName(node)
      if(name&&escapeProperties.has(name))fail('BROWSER_DYNAMIC_CODE_ACCESS',script,parsed,node,name)
    }
    if(ts.isMethodDeclaration(node)||ts.isPropertyAssignment(node)||ts.isShorthandPropertyAssignment(node)) {
      const property=ts.isIdentifier(node.name)||ts.isStringLiteralLike(node.name)?node.name.text:undefined
      if(property&&escapeProperties.has(property))fail('BROWSER_DYNAMIC_CODE_ACCESS',script,parsed,node,property)
      const propertyValue=ts.isPropertyAssignment(node)?node.initializer:node.name
      if(property&&implicitCallables.has(property)&&(ts.isMethodDeclaration(node)
        ||checker.getTypeAtLocation(propertyValue).getCallSignatures().length)) {
        fail('BROWSER_IMPLICIT_CALLABLE_UNSUPPORTED',script,parsed,node,property)
      }
    }
    if(ts.isBinaryExpression(node)&&node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment
      &&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment
      ||ts.isPrefixUnaryExpression(node)&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator)
      ||ts.isPostfixUnaryExpression(node)) {
      const target=ts.isBinaryExpression(node)?node.left:node.operand
      if(checker.getTypeAtLocation(target).getCallSignatures().length)fail('BROWSER_CALLABLE_MUTATION',script,parsed,node)
      if(ts.isElementAccessExpression(target)&&!ts.isStringLiteralLike(target.argumentExpression)
        &&!ts.isNumericLiteral(target.argumentExpression))fail('BROWSER_DYNAMIC_WRITE_UNSUPPORTED',script,parsed,node)
      const property=memberName(target)
      if(property==='length')fail('BROWSER_LENGTH_WRITE_UNSUPPORTED',script,parsed,node)
      if(ts.isBinaryExpression(node)&&property&&implicitCallables.has(property)
        &&checker.getTypeAtLocation(node.right).getCallSignatures().length) {
        fail('BROWSER_IMPLICIT_CALLABLE_UNSUPPORTED',script,parsed,node,property)
      }
    }
    if(ts.isCallExpression(node)||ts.isNewExpression(node))calls.push({node,owner})
    if(ts.isReturnStatement(node)&&node.expression)returnedExpressions[owner]!.push(node.expression)
    ts.forEachChild(node,child=>{pending.push({node:child,depth:held.depth+1,owner})})
  }
  // Every node was admitted before types/call targets are consumed. The checker
  // binds local aliases and precise owned signatures; it cannot confer an owner.
  semanticFailure(script,parsed)
  for(const {node,owner} of calls) {
    const target=node.expression,own=localFunction(target,parsed)
    if(own) {edge(owner,own,node);continue}
    const declaration=checker.getResolvedSignature(node)?.declaration,signature=signatureOwner(declaration)
    const origin=declaration?.getSourceFile().fileName
    if(!declaration||!signature)fail('BROWSER_CALL_TARGET_UNPROVEN',script,parsed,node)
    if(ts.isNewExpression(node)) {
      if(!ts.isIdentifier(target)||target.text!=='Error'||origin===parsed.file.fileName) {
        fail('BROWSER_CONSTRUCTOR_UNSUPPORTED',script,parsed,node)
      }
      continue
    }
    if(origin===ambientName) {
      const {name,owner:surface}=signature
      if(!surface&&['getVariables','getChatMessages'].includes(name)) {
        if(!ts.isIdentifier(target)||target.text!==name)fail('BROWSER_HOST_CALL_ALIAS_UNSUPPORTED',script,parsed,node)
        capabilities.add(name==='getVariables'?'owned-variable-snapshot':'owned-message-snapshot');continue
      }
      if(!memberName(target))fail('BROWSER_HOST_CALL_ALIAS_UNSUPPORTED',script,parsed,node)
      if(surface==='BrowserNumericalBridgeV1') {
        capabilities.add(name==='getNumericalState'?'owned-numerical-snapshot':'owned-numerical-player-save');continue
      }
      if(surface==='BrowserDocumentV1'||surface==='BrowserElementV1'||surface==='BrowserButtonV1') {
        capabilities.add('isolated-dom-text')
        const first=node.arguments[0],literal=first&&ts.isStringLiteralLike(first)?first.text:undefined
        if(name==='createElement'&&(!literal||!(BROWSER_TAGS_V1 as readonly string[]).includes(literal))) {
          fail('BROWSER_DOM_TAG_UNSUPPORTED',script,parsed,node)
        }
        if(name==='querySelector'&&(!literal||!/^#[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(literal))) {
          fail('BROWSER_DOM_SELECTOR_UNSUPPORTED',script,parsed,node)
        }
        if(name==='setAttribute'&&(!literal||!(BROWSER_ATTRIBUTES_V1 as readonly string[]).includes(literal)
          &&!/^data-[a-z0-9_-]+$/.test(literal))) {
          fail('BROWSER_DOM_ATTRIBUTE_UNSUPPORTED',script,parsed,node)
        }
        if(name==='addEventListener'||name==='removeEventListener') {
          capabilities.add('isolated-dom-events')
          if(!literal||!(BROWSER_EVENTS_V1 as readonly string[]).includes(literal))fail('BROWSER_DOM_EVENT_UNSUPPORTED',script,parsed,node)
          if(name==='addEventListener'&&owner!==0)fail('BROWSER_EVENT_REGISTRATION_NOT_STARTUP',script,parsed,node)
          const callback=node.arguments[1],handler=callback&&localFunction(callback,parsed)
          if(!handler)fail('BROWSER_CALLBACK_UNPROVEN',script,parsed,node)
          if(name==='addEventListener')edge(owner,handler,node)
        }
        continue
      }
      if(surface==='BrowserDomEventV1') {capabilities.add('isolated-dom-events');continue}
      fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',script,parsed,node,`${surface}.${name}`)
    }
    if(origin===parsed.file.fileName)fail('BROWSER_CALL_TARGET_UNPROVEN',script,parsed,node)
    // Signature provenance also covers const aliases. The runtime supplies the
    // real bounded String/Number/JSON functions, so an alias cannot reach the
    // unbounded native implementation. Function.call/apply/bind remain absent.
    if(['StringConstructor','NumberConstructor','BooleanConstructor'].includes(signature.owner)) {
      if(signature.owner!=='BooleanConstructor'&&node.arguments.length!==1) {
        fail('BROWSER_PRIMITIVE_SIGNATURE_UNSUPPORTED',script,parsed,node)
      }
      continue
    }
    const name=signature.name||memberName(target),surface=signature.owner
    const allowed=BROWSER_BUILTIN_CALLS_V1[surface as keyof typeof BROWSER_BUILTIN_CALLS_V1] as readonly string[]|undefined
    if(!name||!allowed?.includes(name))fail('BROWSER_BUILTIN_CALL_UNSUPPORTED',script,parsed,node,name??surface)
    if(surface==='JSON'&&name==='stringify'&&node.arguments.length!==1) {
      fail('BROWSER_JSON_SIGNATURE_UNSUPPORTED',script,parsed,node,name)
    }
  }
  // Reverse DAG evaluation avoids a recursive compiler walk and rejects both
  // direct recursion and cycles through local aliases/object methods/Promises.
  const dependents:Map<number,number>[]=[]
  for(let index=0;index<functions.length;index++)dependents.push(new Map())
  edges.forEach((targets,from)=>targets.forEach((count,to)=>dependents[to]!.set(from,count)))
  const remaining=edges.map(targets=>targets.size),work=[...weights],queue:number[]=[]
  remaining.forEach((count,index)=>{if(!count)queue.push(index)})
  let processed=0
  for(let cursor=0;cursor<queue.length;cursor++) {
    const target=queue[cursor]!,targetWork=work[target]!
    if(targetWork>bounds.synchronousWork)fail('BROWSER_SYNCHRONOUS_WORK_LIMIT',script,parsed,functions[target])
    const fn=functions[target]!
    const actualAsync=ts.getModifiers(fn)?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword)===true
    promiseFacts.set(fn,actualAsync?'promise':returnedExpressions[target]!.reduce<PromiseKind>((kind,expression)=>
      mergePromiseKinds(kind,returnedPromiseKind(expression,parsed,promiseFacts)),'sync'))
    processed++
    for(const [parent,multiplier] of dependents[target]!) {
      work[parent]=Math.min(bounds.synchronousWork+1,work[parent]!+targetWork*multiplier)
      remaining[parent]=remaining[parent]!-1
      if(remaining[parent]===0)queue.push(parent)
    }
  }
  if(processed!==functions.length)fail('BROWSER_CALL_CYCLE_UNSUPPORTED',script,parsed,
    functions[remaining.findIndex(count=>count>0)])
  for(const {node} of calls) {
    if(!ts.isCallExpression(node))continue
    const kind=returnedPromiseKind(node,parsed,promiseFacts)
    if(kind==='unproven')fail('BROWSER_PROMISE_LIFECYCLE_UNPROVEN',script,parsed,node)
    if(kind==='promise'&&!promiseCallIsOwned(node))fail('BROWSER_DETACHED_PROMISE_UNSUPPORTED',script,parsed,node)
  }
  statements.sort((left,right)=>left.start-right.start||right.end-left.end)
  return {coverage:{encoding:'native-author-browser-complete-ast-coverage-v1',sourceSha256:script.descriptor.sourceSha256,
    nodeCount,statements,startupWork:work[0]!,callableWork:functions.slice(1).map((fn,index)=>({
      start:fn.getStart(parsed.file)-PREFIX.length,end:fn.end-PREFIX.length,work:work[index+1]!,
    }))},capabilities:[...capabilities].sort()}
}

function compileScript(script:BrowserRawScriptV1):BrowserCompiledScriptV1 {
  const descriptor=script.descriptor
  if(typeof descriptor.enabled!=='boolean'||typeof descriptor.source!=='string'
    ||!HASH.test(descriptor.sourceSha256)||sha256(descriptor.source)!==descriptor.sourceSha256) {
    fail('BROWSER_DESCRIPTOR_SOURCE_INVALID',script)
  }
  const common={...script,descriptorSha256:recordSha256(descriptor)}
  if(!descriptor.enabled)return {...common,disposition:'disabled-source-retained',javascript:'',
    javascriptSha256:sha256(''),entrypoint:'disabled',coverage:null,requiredCapabilities:[]}
  const parsed=parse(script),admitted=admit(script,parsed)
  const transformed=ts.transform(parsed.file,[context=>{
    const invoke=(name:string,args:readonly TypeScript.Expression[])=>ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(BUDGET),name),undefined,args)
    const visit:TypeScript.Visitor=node=>{
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken) {
        return invoke('add',[ts.visitNode(node.left,visit) as TypeScript.Expression,
          ts.visitNode(node.right,visit) as TypeScript.Expression])
      }
      if(ts.isObjectLiteralExpression(node)&&node.properties.length===1&&ts.isSpreadAssignment(node.properties[0]!)) {
        return invoke('copyNumericalValues',[ts.visitNode(node.properties[0]!.expression,visit) as TypeScript.Expression])
      }
      return ts.visitEachChild(node,visit,context)
    }
    return file=>ts.visitNode(file,visit) as TypeScript.SourceFile
  }])
  const transformedSource=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(transformed.transformed[0]!)
  transformed.dispose()
  const emitted=ts.transpileModule(transformedSource,{fileName:authorName,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None,newLine:ts.NewLineKind.LineFeed,
      sourceMap:false,removeComments:false}})
  if(emitted.diagnostics?.some(item=>item.category===ts.DiagnosticCategory.Error))fail('BROWSER_TYPESCRIPT_TRANSPILE',script)
  const javascript='"use strict";\n'+emitted.outputText+`\nreturn ${ENTRY}();\n`
  return {...common,disposition:'compiled-browser',javascript,javascriptSha256:sha256(javascript),
    entrypoint:'promise-returning-function-body',coverage:admitted.coverage,requiredCapabilities:admitted.capabilities}
}

/** Worker-internal runtime identity comes from the fixed actual byte loader,
 * never an author DTO or stored audit. The compiled result still grants no
 * current Source, BrowserSession or Native publication authority. */
export function createBrowserCompilerV1(artifact:BrowserRuntimeArtifactV1):BrowserCompilerV1 {
  const runtime=ownedBrowserRuntimeIdentityV1(artifact)
  if(ts.version!=='5.9.3')fail('BROWSER_TYPESCRIPT_IDENTITY')
  if(runtime.id!=='native-author-browser-runtime'||runtime.version!==1||!HASH.test(runtime.implementationSha256)
    ||runtime.capabilityContractSha256!==BROWSER_CAPABILITY_CONTRACT_V1.contractSha256)fail('BROWSER_RUNTIME_CONTRACT_IDENTITY')
  const identity:BrowserCompilerIdentityV1=ownedBrowserCompilerIdentityV1(artifact)
  const ownedRuntime=Object.freeze({...runtime})
  const batches=new WeakMap<BrowserCandidateBatchV1,{source:BrowserProgramSourceLocatorV1;rows:readonly BrowserCandidateRowV1[]}>()
  function compileCandidates(input:BrowserCompilationInputV1):BrowserCandidateBatchV1 {
    if(input.schemaVersion!==1||input.encoding!=='native-author-browser-compilation-input-v1'
      ||input.scripts.length>bounds.scripts)fail('BROWSER_COMPILATION_INPUT_INVALID')
    const source=Object.freeze({ownerSessionId:input.source.ownerSessionId,sourceRecordSessionId:input.source.sourceRecordSessionId,
      importId:input.source.importId,sourceSha256:input.source.sourceSha256,
      importRecordSha256:input.source.importRecordSha256,sourceSnapshotSha256:input.source.sourceSnapshotSha256,
      materialSha256:input.source.materialSha256})
    const rows:BrowserCandidateRowV1[]=[],seen=new Set<string>()
    let previous=-1
    for(const raw of input.scripts) {
      if(!Number.isSafeInteger(raw.ordinal)||raw.ordinal<=previous||seen.has(raw.descriptor.identity)) {
        fail('BROWSER_DESCRIPTOR_ORDER_INVALID',raw)
      }
      previous=raw.ordinal;seen.add(raw.descriptor.identity)
      // Preserve one detached descriptor for both the visible DATA result and
      // private assembly result; later caller mutations cannot replace its JS.
      const descriptor=Object.freeze({...raw.descriptor,
        imports:Object.freeze(raw.descriptor.imports.map(item=>Object.freeze({...item})))})
      const owned={ordinal:raw.ordinal,descriptor}
      try {
        const compiled=compileScript(owned)
        Object.freeze(compiled.requiredCapabilities)
        if(compiled.coverage) {
          for(const span of compiled.coverage.statements)Object.freeze(span)
          for(const work of compiled.coverage.callableWork)Object.freeze(work)
          Object.freeze(compiled.coverage.statements);Object.freeze(compiled.coverage.callableWork);Object.freeze(compiled.coverage)
        }
        Object.freeze(compiled)
        rows.push(Object.freeze({...owned,kind:descriptor.enabled?'compiled' as const:'disabled' as const,compiled}))
      }catch(error) {
        const diagnostics=error instanceof BrowserRefusal?[error.diagnostic]:error instanceof RangeError
          ?[{code:'BROWSER_SYNTAX_DEPTH_LIMIT'}]:undefined
        if(!diagnostics)throw error
        rows.push(Object.freeze({...owned,kind:'refused' as const,diagnostics:Object.freeze(diagnostics.map(item=>Object.freeze(item)))}))
      }
    }
    Object.freeze(rows)
    const batch:BrowserCandidateBatchV1=Object.freeze({schemaVersion:1,encoding:'native-author-browser-candidate-batch-v1',source,rows})
    batches.set(batch,{source,rows});return batch
  }
  function assembleAccepted(batch:BrowserCandidateBatchV1,ordinals:readonly number[]):BrowserCompilationV1 {
    try {
      const owned=batches.get(batch)
      if(!owned)fail('BROWSER_CANDIDATE_BATCH_NOT_OWNED')
      const scripts:BrowserCompiledScriptV1[]=[],required=new Set<BrowserCapabilityV1>()
      let previous=-1,bytes=0
      for(const ordinal of ordinals) {
        const row=owned.rows.find(item=>item.ordinal===ordinal)
        if(!row||ordinal<=previous||row.kind==='refused')fail('BROWSER_CANDIDATE_SELECTION_INVALID')
        previous=ordinal
        const script=row.compiled;scripts.push(script)
        bytes+=Buffer.byteLength(script.javascript,'utf8')
        if(bytes>bounds.javascriptBytes)fail('BROWSER_JAVASCRIPT_AGGREGATE_LIMIT',row)
        for(const capability of script.requiredCapabilities)required.add(capability)
      }
      const body={schemaVersion:1 as const,encoding:'native-author-browser-program-v1' as const,
        authority:'compiled-program-data-only' as const,source:owned.source,compiler:identity,
        profile:{id:BROWSER_PROFILE_V1.id,version:BROWSER_PROFILE_V1.version,sha256:BROWSER_PROFILE_V1.sha256},
        runtime:ownedRuntime,capabilityContract:BROWSER_CAPABILITY_CONTRACT_V1,scripts,
        requiredCapabilities:[...required].sort()}
      return {kind:'compiled',program:{...body,programSha256:recordSha256(body)}}
    }catch(error) {
      if(error instanceof BrowserRefusal)return {kind:'refused',diagnostics:[error.diagnostic]}
      if(error instanceof RangeError)return {kind:'refused',diagnostics:[{code:'BROWSER_SYNTAX_DEPTH_LIMIT'}]}
      throw error
    }
  }
  function compile(input:BrowserCompilationInputV1):BrowserCompilationV1 {
    try {
      const batch=compileCandidates(input),refused=batch.rows.filter(row=>row.kind==='refused')
      if(refused.length)return {kind:'refused',diagnostics:refused.flatMap(row=>row.kind==='refused'?row.diagnostics:[])}
      return assembleAccepted(batch,batch.rows.map(row=>row.ordinal))
    }catch(error) {
      if(error instanceof BrowserRefusal)return {kind:'refused',diagnostics:[error.diagnostic]}
      throw error
    }
  }
  return {identity,compile,compileCandidates,assembleAccepted,verifyProgram(program:BrowserProgramV1):boolean {
    const fresh=compile({schemaVersion:1,encoding:'native-author-browser-compilation-input-v1',
      source:program.source,scripts:program.scripts.map(({ordinal,descriptor})=>({ordinal,descriptor}))})
    return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(program)
  }}
}

