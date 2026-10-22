/** Complete original-JS admission. The AST worker never executes author code. */
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import type * as TypeScript from 'typescript'
import {recordSha256,sha256} from './roleplay-data.js'
import {BROWSER_BOUNDS_V2 as bounds,BROWSER_GLOBALS_V2,BROWSER_UNAVAILABLE_HOSTS_V2,
  BROWSER_PROFILE_V2,BROWSER_CAPABILITY_CONTRACT_V2,BROWSER_TAGS_V2}
  from './tavern-author-browser-profile-v2.mjs'
import {ownedBrowserCompilerIdentityV2,ownedBrowserRuntimeIdentityV2}
  from './tavern-author-browser-artifact-v2.mjs'
import type {BrowserRuntimeArtifactV2,BrowserCompilerV2,BrowserRawScriptV2,BrowserCompiledScriptV2,
  BrowserCompilationInputV2,BrowserCompilationV2,BrowserCandidateBatchV2,BrowserCandidateRowV2,
  BrowserProgramV2,BrowserDiagnosticV2,BrowserCapabilityV2,BrowserAstCoverageV2}
  from './tavern-author-browser-types-v2.mjs'

const require=createRequire(import.meta.url)
let language:typeof TypeScript|undefined
function typescript():typeof TypeScript {
  if(language)return language
  const entry=fileURLToPath(new URL('../node_modules/typescript/lib/typescript.js',import.meta.url))
  language=require(entry) as typeof TypeScript
  if(language.version!=='5.9.3')throw Error('BROWSER_TYPESCRIPT_IDENTITY')
  return language
}
class Refusal extends Error {
  constructor(readonly diagnostic:BrowserDiagnosticV2){super(diagnostic.code)}
}
const freeze=<T,>(value:T):T=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const globals=new Set<string>(BROWSER_GLOBALS_V2),unavailable=new Set<string>(BROWSER_UNAVAILABLE_HOSTS_V2)
const apiCapabilities:Readonly<Record<string,BrowserCapabilityV2>>={
  getVariables:'owned-variable-snapshot',getChatMessages:'owned-message-snapshot',
  updateVariablesWith:'owned-chat-key-update',generateRaw:'owned-generate-raw-gesture',
  injectPrompts:'owned-prompt-effects',uninjectPrompts:'owned-prompt-effects',
  eventMakeFirst:'owned-generation-callbacks',eventOn:'owned-resource-callbacks',
  eventRemoveListener:'owned-resource-callbacks',getNumericalState:'owned-numerical-snapshot',
  replaceNumericalValues:'owned-numerical-player-save',
  getScriptId:'owned-script-source-resources',getScriptTrees:'owned-script-source-resources',
  getWorldbookNames:'owned-named-worldbooks',getWorldbook:'owned-named-worldbooks',
  getCurrentCharPrimaryLorebook:'owned-named-worldbooks',getCharWorldbookNames:'owned-named-worldbooks',
  createWorldbookEntries:'owned-named-worldbooks',deleteWorldbookEntries:'owned-named-worldbooks',
  updateWorldbookWith:'owned-named-worldbooks',
  replaceWorldbook:'owned-named-worldbooks',
  getPersonaIds:'owned-native-personas',getPersonaNames:'owned-native-personas',
  getCurrentPersonaId:'owned-native-personas',getCurrentPersonaName:'owned-native-personas',
  getPersona:'owned-native-personas',getPersonaAvatarPath:'owned-native-personas',
  createPersona:'owned-native-personas',replacePersona:'owned-native-personas',
  jQuery:'owned-native-personas',$:'owned-native-personas',fetch:'owned-native-personas',
}
const helperPersonaApis=new Set(['getPersonaIds','getPersonaNames','getCurrentPersonaId','getCurrentPersonaName',
  'getPersona','getPersonaAvatarPath','createPersona','replacePersona'])
type Callable=TypeScript.FunctionDeclaration|TypeScript.FunctionExpression|TypeScript.ArrowFunction

/** This is a DATA producer for the fixed AST worker and focused source tests.
 * Package/Source admission remains the parent factory and Core's responsibility. */
export function admitBrowserScriptV2(script:BrowserRawScriptV2):BrowserCompiledScriptV2 {
  const ts=typescript(),descriptor=script.descriptor
  function fail(code:string,node?:TypeScript.Node,feature?:string):never {
    const position=node?file.getLineAndCharacterOfPosition(node.getStart(file)):undefined
    throw new Refusal({code,ordinal:script.ordinal,scriptIdentity:descriptor.identity,pointer:descriptor.pointer,
      ...position?{line:position.line+1,column:position.character+1}:{},...feature?{feature}:{}})
  }
  if(typeof descriptor.enabled!=='boolean'||typeof descriptor.source!=='string'
    ||!hash(descriptor.sourceSha256)||sha256(descriptor.source)!==descriptor.sourceSha256) {
    throw new Refusal({code:'BROWSER_DESCRIPTOR_SOURCE_INVALID',ordinal:script.ordinal})
  }
  const common={...script,descriptorSha256:recordSha256(descriptor)}
  if(!descriptor.enabled)return {...common,disposition:'disabled-source-retained',javascript:'',
    javascriptSha256:sha256(''),entrypoint:'disabled',coverage:null,requiredCapabilities:[],
    ownedChatKey:null,mediaSources:[]}
  if(Buffer.byteLength(descriptor.source,'utf8')>bounds.sourceBytes) {
    throw new Refusal({code:'BROWSER_SOURCE_BYTE_LIMIT',ordinal:script.ordinal})
  }
  const file=ts.createSourceFile('owned-browser-author-v2.js',descriptor.source,
    ts.ScriptTarget.ES2023,true,ts.ScriptKind.JS)
  const diagnostics=(file as TypeScript.SourceFile&{parseDiagnostics:readonly TypeScript.Diagnostic[]}).parseDiagnostics
  if(diagnostics.length)fail('BROWSER_JAVASCRIPT_SYNTAX')
  // A no-lib checker supplies lexical symbols only. We do not type-check an
  // opaque DOM as lib.dom, or turn an untyped callback into a guessed host API.
  const host:TypeScript.CompilerHost={getSourceFile:name=>name===file.fileName?file:undefined,
    getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'',getDirectories:()=>[],
    fileExists:name=>name===file.fileName,readFile:name=>name===file.fileName?descriptor.source:undefined,
    getCanonicalFileName:name=>name,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'}
  const checker=ts.createProgram([file.fileName],{noLib:true,allowJs:true,noEmit:true},host).getTypeChecker()
  const symbol=(node:TypeScript.Node)=>ts.isIdentifier(node)&&ts.isShorthandPropertyAssignment(node.parent)
    ?checker.getShorthandAssignmentValueSymbol(node.parent):checker.getSymbolAtLocation(node)
  const references=new Map<TypeScript.Symbol,TypeScript.Identifier[]>()
  const collectReferences=(node:TypeScript.Node)=>{
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(ref){const uses=references.get(ref)??[];uses.push(node);references.set(ref,uses)}
    }
    ts.forEachChild(node,collectReferences)
  }
  collectReferences(file)
  const unwrap=(expression:TypeScript.Expression):TypeScript.Expression=>{
    while(ts.isParenthesizedExpression(expression))expression=expression.expression
    return expression
  }
  function localInitializer(node:TypeScript.Identifier):TypeScript.Expression|undefined {
    const declaration=symbol(node)?.valueDeclaration
    return declaration&&ts.isVariableDeclaration(declaration)?declaration.initializer:undefined
  }
  function staticString(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):string|undefined {
    node=unwrap(node)
    if(ts.isStringLiteralLike(node))return node.text
    if(ts.isIdentifier(node)) {
      const ref=symbol(node),declaration=ref?.valueDeclaration
      if(!ref||seen.has(ref)||!declaration||!ts.isVariableDeclaration(declaration)
        ||!ts.isVariableDeclarationList(declaration.parent)||!(declaration.parent.flags&ts.NodeFlags.Const)
        ||!declaration.initializer)return undefined
      seen.add(ref);return staticString(declaration.initializer,seen)
    }
    return undefined
  }
  const member=(node:TypeScript.PropertyAccessExpression|TypeScript.ElementAccessExpression)=>
    ts.isPropertyAccessExpression(node)?node.name.text:node.argumentExpression?staticString(node.argumentExpression):undefined
  const assigned=(node:TypeScript.Identifier)=>{
    let target:TypeScript.Node=node
    while(ts.isParenthesizedExpression(target.parent)||ts.isArrayLiteralExpression(target.parent)
      ||ts.isShorthandPropertyAssignment(target.parent)
      ||ts.isPropertyAssignment(target.parent)&&target.parent.initializer===target
      ||ts.isObjectLiteralExpression(target.parent))target=target.parent
    const parent=target.parent
    return ts.isBinaryExpression(parent)&&parent.left===target
      &&parent.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&parent.operatorToken.kind<=ts.SyntaxKind.LastAssignment
      ||(ts.isPrefixUnaryExpression(parent)||ts.isPostfixUnaryExpression(parent))
        &&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(parent.operator)
  }
  function preceding(assignment:TypeScript.Node,use:TypeScript.Node):boolean {
    let statement:TypeScript.Node=assignment
    while(statement.parent&&!ts.isBlock(statement.parent))statement=statement.parent
    if(!statement.parent||!ts.isBlock(statement.parent))return false
    let consumer:TypeScript.Node=use
    while(consumer.parent&&consumer.parent!==statement.parent)consumer=consumer.parent
    return consumer.parent===statement.parent&&statement.end<=consumer.getStart(file)
  }
  /** A closed literal table can feed the original var-key for-loop. No author
   * code runs, and a mutated/escaped table cannot supply a finite name proof. */
  function finiteNames(expression:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):Set<string>|undefined {
    expression=unwrap(expression)
    if(ts.isStringLiteralLike(expression))return new Set([expression.text])
    if(ts.isConditionalExpression(expression)) {
      const yes=finiteNames(expression.whenTrue,new Set(seen)),no=finiteNames(expression.whenFalse,new Set(seen))
      return yes&&no?new Set([...yes,...no]):undefined
    }
    if(ts.isIdentifier(expression)) {
      const ref=symbol(expression),declaration=ref?.valueDeclaration
      if(!ref||seen.has(ref)||!declaration||!ts.isVariableDeclaration(declaration))return undefined
      seen.add(ref)
      const writes=(references.get(ref)??[]).filter(assigned)
      if(!writes.length&&declaration.initializer)return finiteNames(declaration.initializer,seen)
      if(declaration.initializer||writes.length!==1)return undefined
      const write=writes[0]!.parent
      return ts.isBinaryExpression(write)&&write.operatorToken.kind===ts.SyntaxKind.EqualsToken
        &&preceding(write,expression)?finiteNames(write.right,seen):undefined
    }
    if(ts.isElementAccessExpression(expression)&&ts.isIdentifier(expression.expression)) {
      const ref=symbol(expression.expression),declaration=ref?.valueDeclaration
      if(!ref||seen.has(ref)||!declaration||!ts.isVariableDeclaration(declaration)
        ||!declaration.initializer||!ts.isArrayLiteralExpression(declaration.initializer))return undefined
      const table=declaration.initializer
      if(!table.elements.length||!table.elements.every(ts.isStringLiteralLike))return undefined
      for(const use of references.get(ref)??[]) {
        if(use===declaration.name)continue
        const parent=use.parent
        if(ts.isPropertyAccessExpression(parent)&&parent.expression===use&&parent.name.text==='length')continue
        if(ts.isElementAccessExpression(parent)&&parent.expression===use&&!ts.isBinaryExpression(parent.parent))continue
        // The supported loop assigns its table element to the scalar key.
        if(ts.isElementAccessExpression(parent)&&parent.expression===use&&ts.isBinaryExpression(parent.parent)
          &&parent.parent.right===parent&&parent.parent.operatorToken.kind===ts.SyntaxKind.EqualsToken)continue
        return undefined
      }
      const index=expression.argumentExpression&&unwrap(expression.argumentExpression)
      if(index&&ts.isNumericLiteral(index)&&Number.isInteger(Number(index.text))&&Number(index.text)<table.elements.length) {
        return new Set([(table.elements[Number(index.text)] as TypeScript.StringLiteralLike).text])
      }
      if(!index||!ts.isIdentifier(index))return undefined
      let loop:TypeScript.Node|undefined=expression.parent
      while(loop&&!ts.isForStatement(loop)&&!ts.isFunctionLike(loop))loop=loop.parent
      if(!loop||!ts.isForStatement(loop)||!loop.initializer||!ts.isBinaryExpression(loop.initializer)
        ||loop.initializer.operatorToken.kind!==ts.SyntaxKind.EqualsToken||!ts.isIdentifier(loop.initializer.left)
        ||symbol(loop.initializer.left)!==symbol(index)||!ts.isNumericLiteral(loop.initializer.right)
        ||loop.initializer.right.text!=='0'||!loop.condition||!ts.isBinaryExpression(loop.condition)
        ||loop.condition.operatorToken.kind!==ts.SyntaxKind.LessThanToken||!ts.isIdentifier(loop.condition.left)
        ||symbol(loop.condition.left)!==symbol(index)||!ts.isPropertyAccessExpression(loop.condition.right)
        ||loop.condition.right.name.text!=='length'||symbol(loop.condition.right.expression)!==ref
        ||!loop.incrementor||!ts.isPostfixUnaryExpression(loop.incrementor)
        ||loop.incrementor.operator!==ts.SyntaxKind.PlusPlusToken||symbol(loop.incrementor.operand)!==symbol(index))return undefined
      const indexWrites=(references.get(symbol(index)!)??[]).filter(assigned)
      const initialIndex=loop.initializer.left,incrementIndex=loop.incrementor.operand
      if(indexWrites.some(use=>use!==initialIndex&&use!==incrementIndex))return undefined
      return new Set(table.elements.map(item=>(item as TypeScript.StringLiteralLike).text))
    }
    return undefined
  }
  function hostRoot(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):string|undefined {
    node=unwrap(node)
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(!ref)return globals.has(node.text)?node.text:undefined
      if(seen.has(ref))return undefined
      seen.add(ref)
      const initial=localInitializer(node)
      return initial?hostRoot(initial,seen):undefined
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))return hostRoot(node.expression,seen)
    if(ts.isBinaryExpression(node))return hostRoot(node.left,new Set(seen))??hostRoot(node.right,seen)
    if(ts.isConditionalExpression(node))return hostRoot(node.whenTrue,new Set(seen))??hostRoot(node.whenFalse,seen)
    return undefined
  }
  function apiName(node:TypeScript.Expression):string|undefined {
    node=unwrap(node)
    if(ts.isIdentifier(node)) {
      if(!symbol(node))return node.text
      const reflected=resolverTargets(node)
      if(reflected)return reflected.size===1?[...reflected][0]:reflected.size
        &&[...reflected].every(name=>['eventOn','eventMakeFirst'].includes(name))?'event-registration':undefined
      const targets=registrationTargets(node)
      return targets?.size?targets.size===1?[...targets][0]:'event-registration':undefined
    }
    if(ts.isConditionalExpression(node)) {
      const targets=registrationTargets(node)
      return targets?.size?targets.size===1?[...targets][0]:'event-registration':undefined
    }
    if(ts.isCallExpression(node)) {
      const reflected=resolverTargets(node)
      return reflected?.size===1?[...reflected][0]:reflected?.size
        &&[...reflected].every(name=>['eventOn','eventMakeFirst'].includes(name))?'event-registration':undefined
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
      const root=hostRoot(node.expression)
      return root&&['window','parent','NextTavern','SillyTavern','TavernHelper'].includes(root)?member(node):undefined
    }
    return undefined
  }
  /** Only this Source facade is admitted. Other TavernHelper methods still need
   * their own real owner; allowing the container cannot imply their support. */
  function sourceFacade(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):boolean {
    node=unwrap(node)
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(!ref)return node.text==='TavernHelper'
      if(seen.has(ref))return false
      seen.add(ref)
      const initial=localInitializer(node)
      return !!initial&&sourceFacade(initial,seen)
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
      return member(node)==='TavernHelper'&&['window','parent'].includes(hostRoot(node.expression)??'')
    }
    if(ts.isCallExpression(node)) {
      const fn=callable(node.expression)
      if(!fn?.body)return false
      const ref=ts.isIdentifier(node.expression)?symbol(node.expression):undefined
      if(ref&&seen.has(ref))return false
      if(ref)seen.add(ref)
      if(!ts.isBlock(fn.body))return sourceFacade(fn.body,seen)
      let owned=false
      const returns=(child:TypeScript.Node)=>{
        if(child!==fn.body&&ts.isFunctionLike(child))return
        if(ts.isReturnStatement(child)&&child.expression&&sourceFacade(child.expression,new Set(seen)))owned=true
        ts.forEachChild(child,returns)
      }
      returns(fn.body)
      return owned
    }
    if(ts.isBinaryExpression(node))return sourceFacade(node.left,new Set(seen))||sourceFacade(node.right,seen)
    if(ts.isConditionalExpression(node))return sourceFacade(node.whenTrue,new Set(seen))||sourceFacade(node.whenFalse,seen)
    return false
  }
  /** These two host functions are the supported registration seam. A lexical
   * const/ternary alias preserves that seam without evaluating author code. */
  function registrationTargets(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):Set<string>|undefined {
    node=unwrap(node)
    const reflected=resolverTargets(node)
    if(reflected&&[...reflected].every(name=>['eventOn','eventMakeFirst'].includes(name)))return reflected
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(!ref)return ['eventOn','eventMakeFirst'].includes(node.text)?new Set([node.text]):undefined
      const declaration=ref.valueDeclaration
      if(seen.has(ref)||!declaration||!ts.isVariableDeclaration(declaration)
        ||!ts.isVariableDeclarationList(declaration.parent)||!(declaration.parent.flags&ts.NodeFlags.Const)
        ||!declaration.initializer)return undefined
      seen.add(ref);return registrationTargets(declaration.initializer,seen)
    }
    if(ts.isConditionalExpression(node)) {
      const yes=registrationTargets(node.whenTrue,new Set(seen)),no=registrationTargets(node.whenFalse,new Set(seen))
      return yes&&no?new Set([...yes,...no]):undefined
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
      const name=member(node)
      if(['window','parent'].includes(hostRoot(node.expression)??'')&&['eventOn','eventMakeFirst'].includes(name??'')) {
        return new Set([name!])
      }
    }
    return undefined
  }
  function eventName(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):string|undefined {
    node=unwrap(node)
    const literal=staticString(node)
    if(literal!==undefined)return literal
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(!ref||seen.has(ref))return undefined
      seen.add(ref);const initial=localInitializer(node)
      return initial?eventName(initial,seen):undefined
    }
    if((ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))
      &&hostRoot(node.expression)==='tavern_events')return member(node)
    if(ts.isBinaryExpression(node)) {
      const left=eventName(node.left,new Set(seen)),right=eventName(node.right,new Set(seen))
      return left===right?left:undefined
    }
    if(ts.isConditionalExpression(node)) {
      const yes=eventName(node.whenTrue,new Set(seen)),no=eventName(node.whenFalse,new Set(seen))
      return yes===no?yes:undefined
    }
    return undefined
  }
  function optionType(node:TypeScript.Expression|undefined):string|undefined {
    if(!node)return 'chat'
    node=unwrap(node)
    if(ts.isIdentifier(node)) {const value=localInitializer(node);return value?optionType(value):undefined}
    if(!ts.isObjectLiteralExpression(node))return undefined
    for(const property of node.properties) {
      if(ts.isPropertyAssignment(property)&&property.name&&
        (ts.isIdentifier(property.name)?property.name.text:ts.isStringLiteralLike(property.name)?property.name.text:'')==='type') {
        return staticString(property.initializer)
      }
    }
    return undefined
  }
  function chatRead(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):boolean {
    node=unwrap(node)
    if(ts.isCallExpression(node))return apiName(node.expression)==='getVariables'&&optionType(node.arguments[0])==='chat'
    if(ts.isIdentifier(node)) {
      const ref=symbol(node)
      if(!ref||seen.has(ref))return false
      seen.add(ref);const initial=localInitializer(node)
      return !!initial&&chatRead(initial,seen)
    }
    if(ts.isBinaryExpression(node))return chatRead(node.left,new Set(seen))||chatRead(node.right,seen)
    return false
  }
  function callable(node:TypeScript.Expression):Callable|undefined {
    node=unwrap(node)
    if(ts.isArrowFunction(node)||ts.isFunctionExpression(node))return node
    if(ts.isIdentifier(node)) {
      const declaration=symbol(node)?.valueDeclaration
      if(declaration&&ts.isFunctionDeclaration(declaration))return declaration
      const initial=localInitializer(node)
      if(initial&&initial!==node)return callable(initial)
    }
    return undefined
  }
  type ResolverProof={names:Set<string>;calls:Map<TypeScript.CallExpression,Set<string>>;
    accesses:Set<TypeScript.ElementAccessExpression>}
  const resolvers=new Map<TypeScript.FunctionDeclaration,ResolverProof|undefined>()
  const inheritedNames=new Set(Object.getOwnPropertyNames(Object.prototype))
  function lookupSurface(expression:TypeScript.Expression,helper:boolean,seen=new Set<TypeScript.Symbol>()):boolean {
    expression=unwrap(expression)
    if(ts.isIdentifier(expression)) {
      const ref=symbol(expression)
      if(!ref)return helper?expression.text==='TavernHelper':['window','parent'].includes(expression.text)
      if(seen.has(ref))return false
      seen.add(ref)
      const initial=localInitializer(expression)
      if(!initial||!lookupSurface(initial,helper,new Set(seen)))return false
      return (references.get(ref)??[]).filter(assigned).every(use=>{
        const assignment=use.parent
        return ts.isBinaryExpression(assignment)&&assignment.operatorToken.kind===ts.SyntaxKind.EqualsToken
          &&lookupSurface(assignment.right,helper,new Set(seen))
      })
    }
    if(ts.isPropertyAccessExpression(expression)||ts.isElementAccessExpression(expression)) {
      return (helper?member(expression)==='TavernHelper':['window','parent'].includes(member(expression)??''))
        &&lookupSurface(expression.expression,false,seen)
    }
    if(ts.isBinaryExpression(expression)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken]
      .includes(expression.operatorToken.kind)) {
      return lookupSurface(expression.left,helper,new Set(seen))&&lookupSurface(expression.right,helper,new Set(seen))
    }
    return false
  }
  function resolverProof(fn:TypeScript.FunctionDeclaration):ResolverProof|undefined {
    if(resolvers.has(fn))return resolvers.get(fn)
    resolvers.set(fn,undefined)
    if(!fn.name||!fn.body||fn.parameters.length!==1||!ts.isIdentifier(fn.parameters[0]!.name))return undefined
    const parameter=fn.parameters[0]!,ref=symbol(parameter.name),functionRef=symbol(fn.name)
    if(!ref||!functionRef)return undefined
    const accesses=new Set<TypeScript.ElementAccessExpression>()
    for(const use of references.get(ref)??[]) {
      if(use===parameter.name)continue
      const access=use.parent
      if(!ts.isElementAccessExpression(access)||access.argumentExpression!==use
        ||(!lookupSurface(access.expression,true)&&!lookupSurface(access.expression,false)))return undefined
      accesses.add(access)
    }
    if(!accesses.size)return undefined
    const sameAccess=(expression:TypeScript.Expression,access:TypeScript.ElementAccessExpression)=>{
      expression=unwrap(expression)
      return ts.isElementAccessExpression(expression)&&expression.getText(file)===access.getText(file)
    }
    function functionTest(expression:TypeScript.Expression,access:TypeScript.ElementAccessExpression):boolean {
      expression=unwrap(expression)
      if(!ts.isBinaryExpression(expression))return false
      if(expression.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken) {
        return functionTest(expression.left,access)||functionTest(expression.right,access)
      }
      return expression.operatorToken.kind===ts.SyntaxKind.EqualsEqualsEqualsToken
        &&ts.isTypeOfExpression(expression.left)&&sameAccess(expression.left.expression,access)
        &&ts.isStringLiteralLike(expression.right)&&expression.right.text==='function'
    }
    const returned=new Set<TypeScript.ElementAccessExpression>()
    for(const access of accesses) {
      if(ts.isTypeOfExpression(access.parent))continue
      let expression:TypeScript.Expression=access
      if(ts.isPropertyAccessExpression(access.parent)&&access.parent.name.text==='bind'
        &&ts.isCallExpression(access.parent.parent)&&access.parent.parent.expression===access.parent) {
        const call=access.parent.parent
        if(call.arguments.length!==1||call.arguments[0]!.getText(file)!==access.expression.getText(file))return undefined
        expression=call
      }
      if(!ts.isReturnStatement(expression.parent))return undefined
      let parent:TypeScript.Node=expression.parent
      while(parent.parent&&parent.parent!==fn.body&&!ts.isIfStatement(parent.parent))parent=parent.parent
      if(!parent.parent||!ts.isIfStatement(parent.parent)||parent.parent.thenStatement!==parent
        ||!functionTest(parent.parent.expression,access))return undefined
      returned.add(access)
    }
    let validReturns=true
    const inspectReturns=(node:TypeScript.Node)=>{
      if(node!==fn.body&&ts.isFunctionLike(node)){validReturns=false;return}
      if(ts.isReturnStatement(node)&&node.expression&&node.expression.kind!==ts.SyntaxKind.NullKeyword
        &&!(ts.isIdentifier(node.expression)&&node.expression.text==='undefined')) {
        if(![...returned].some(access=>access===node.expression||access.parent.parent===node.expression))validReturns=false
      }
      ts.forEachChild(node,inspectReturns)
    }
    inspectReturns(fn.body)
    if(!validReturns||!returned.size)return undefined
    const names=new Set<string>(),calls=new Map<TypeScript.CallExpression,Set<string>>()
    for(const use of references.get(functionRef)??[]) {
      if(use===fn.name)continue
      const call=use.parent
      if(!ts.isCallExpression(call)||call.expression!==use||call.arguments.length!==1)return undefined
      const values=finiteNames(call.arguments[0]!)
      if(!values||[...values].some(name=>inheritedNames.has(name)))return undefined
      calls.set(call,values);for(const name of values)names.add(name)
    }
    if(!calls.size)return undefined
    const proof={names,calls,accesses};resolvers.set(fn,proof);return proof
  }
  function resolverTargets(expression:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):Set<string>|undefined {
    expression=unwrap(expression)
    if(ts.isIdentifier(expression)) {
      const ref=symbol(expression),initial=localInitializer(expression)
      if(!ref||seen.has(ref)||!initial||(references.get(ref)??[]).some(assigned))return undefined
      seen.add(ref);return resolverTargets(initial,seen)
    }
    if(!ts.isCallExpression(expression))return undefined
    const fn=callable(expression.expression)
    if(!fn||!ts.isFunctionDeclaration(fn))return undefined
    const names=resolverProof(fn)?.calls.get(expression)
    return names?new Set([...names].filter(name=>!!apiCapabilities[name])):undefined
  }
  function reflectedAccess(access:TypeScript.ElementAccessExpression):ResolverProof|undefined {
    if(!access.argumentExpression||!ts.isIdentifier(access.argumentExpression))return undefined
    const declaration=symbol(access.argumentExpression)?.valueDeclaration
    if(!declaration||!ts.isParameter(declaration)||!ts.isFunctionDeclaration(declaration.parent))return undefined
    const fn=declaration.parent
    // Only the resolver's three owned surfaces are covered here. Ordinary
    // instance-slot indexing keeps its existing local-state meaning.
    if(!sourceFacade(access.expression)&&!['window','parent'].includes(hostRoot(access.expression)??''))return undefined
    const proof=resolverProof(fn)
    if(!proof||!proof.accesses.has(access))fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',access,'owned facade dynamic resolver')
    return proof
  }
  const readKeys=new Set<string>(),writeKeys=new Set<string>(),capabilities=new Set<BrowserCapabilityV2>()
  const media=new Set<string>(),statements:BrowserAstCoverageV2['statements'][number][]=[]
  let nodeCount=0
  function proveUpdate(call:TypeScript.CallExpression) {
    if(optionType(call.arguments[1])!=='chat')fail('BROWSER_CHAT_UPDATE_SCOPE_UNSUPPORTED',call)
    const callback=call.arguments[0]&&callable(call.arguments[0]),parameter=callback?.parameters[0]
    if(!callback?.body||!parameter||!ts.isIdentifier(parameter.name))fail('BROWSER_CHAT_KEY_UNPROVEN',call)
    const original=symbol(parameter.name),returns:TypeScript.Expression[]=[]
    if(!ts.isBlock(callback.body))returns.push(callback.body)
    else {
      const visit=(node:TypeScript.Node)=>{
        if(node!==callback.body&&(ts.isFunctionLike(node)))return
        if(ts.isReturnStatement(node)&&node.expression)returns.push(node.expression)
        ts.forEachChild(node,visit)
      }
      visit(callback.body)
    }
    if(!returns.length)fail('BROWSER_CHAT_KEY_UNPROVEN',call)
    for(let result of returns) {
      result=unwrap(result)
      if(!ts.isObjectLiteralExpression(result)||result.properties.length!==2)fail('BROWSER_CHAT_KEY_UNPROVEN',call)
      const spread=result.properties.find(ts.isSpreadAssignment),replacement=result.properties.find(ts.isPropertyAssignment)
      if(!spread||!replacement||!ts.isIdentifier(unwrap(spread.expression))
        ||symbol(unwrap(spread.expression))!==original)fail('BROWSER_CHAT_KEY_UNPROVEN',call)
      const key=ts.isComputedPropertyName(replacement.name)?staticString(replacement.name.expression):
        ts.isIdentifier(replacement.name)||ts.isStringLiteralLike(replacement.name)?replacement.name.text:undefined
      if(!key||key==='stat_data')fail('BROWSER_CHAT_KEY_UNPROVEN',replacement)
      writeKeys.add(key)
    }
  }
  function isName(node:TypeScript.Identifier):boolean {
    const parent=node.parent
    return ts.isPropertyAccessExpression(parent)&&parent.name===node
      ||(ts.isPropertyAssignment(parent)||ts.isMethodDeclaration(parent)||ts.isPropertyDeclaration(parent))&&parent.name===node
      ||ts.isBindingElement(parent)&&parent.propertyName===node
      ||(ts.isVariableDeclaration(parent)||ts.isParameter(parent)||ts.isFunctionDeclaration(parent)
        ||ts.isFunctionExpression(parent)||ts.isClassDeclaration(parent))&&parent.name===node
      ||ts.isLabeledStatement(parent)&&parent.label===node
      ||(ts.isBreakStatement(parent)||ts.isContinueStatement(parent))&&parent.label===node
  }
  function walk(node:TypeScript.Node,depth:number) {
    if(++nodeCount>bounds.syntaxNodes||depth>bounds.syntaxDepth)fail('BROWSER_AST_LIMIT',node)
    if(ts.isStatement(node))statements.push({start:node.getStart(file),end:node.end,syntaxKind:ts.SyntaxKind[node.kind]})
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isExportAssignment(node)
      ||ts.isTypeNode(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)
      ||ts.isEnumDeclaration(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node)) {
      fail('BROWSER_ORIGINAL_JAVASCRIPT_REQUIRED',node,ts.SyntaxKind[node.kind])
    }
    if(ts.isIdentifier(node)&&!isName(node)&&!symbol(node)&&!globals.has(node.text)) {
      fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',node,node.text)
    }
    if(ts.isIdentifier(node)&&!isName(node)&&!symbol(node)
      &&['TavernHelper','getScriptId','getScriptTrees'].includes(node.text)) {
      capabilities.add('owned-script-source-resources')
    }
    if(ts.isIdentifier(node)&&!isName(node)&&!symbol(node)
      &&['owned-named-worldbooks','owned-native-personas'].includes(apiCapabilities[node.text]??'')) {
      capabilities.add(apiCapabilities[node.text]!)
    }
    if(ts.isVariableDeclaration(node)&&ts.isObjectBindingPattern(node.name)
      &&node.initializer&&(sourceFacade(node.initializer)||['window','parent'].includes(hostRoot(node.initializer)??''))) {
      for(const binding of node.name.elements) {
        const key=binding.propertyName??binding.name
        const name=ts.isIdentifier(key)||ts.isStringLiteralLike(key)?key.text:undefined
        if(['owned-named-worldbooks','owned-native-personas'].includes(apiCapabilities[name??'']??'')) {
          capabilities.add(apiCapabilities[name??'']!)
        }
      }
    }
    if(ts.isIdentifier(node)&&!symbol(node)&&node.text==='getVariables'
      &&!(ts.isCallExpression(node.parent)&&node.parent.expression===node)) {
      capabilities.add('owned-script-source-resources')
    }
    if(ts.isStringLiteralLike(node)) {
      if(node.text.startsWith('#user_avatar_block'))capabilities.add('owned-native-personas')
      if(/^(?:https?:\/\/|data:image\/)/.test(node.text))media.add(node.text)
      for(const match of node.text.matchAll(/url\(\s*['"]?((?:https?:\/\/|data:image\/)[^)'"\s]+)['"]?\s*\)/g))media.add(match[1]!)
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
      const name=member(node),root=hostRoot(node.expression)
      const reflected=!name&&ts.isElementAccessExpression(node)?reflectedAccess(node):undefined
      if(reflected) {
        for(const target of reflected.names) {
          const helper=sourceFacade(node.expression)
          if(helper&&!['getVariables','getScriptId','getScriptTrees'].includes(target)
            &&apiCapabilities[target]!=='owned-named-worldbooks'&&!helperPersonaApis.has(target))continue
          // A registration getter alone does not choose an event. Its exact
          // returned alias is consumed by apiName at the actual registration.
          if(['eventOn','eventMakeFirst'].includes(target))continue
          const capability=helper&&target==='getVariables'?'owned-script-source-resources':apiCapabilities[target]
          if(capability)capabilities.add(capability)
        }
      }
      // Original Helpers can be returned by a local function before a method
      // is read. Requirements still describe the actual Native seam; Core
      // separately owns authority for every resulting mutation request.
      if(apiCapabilities[name??'']==='owned-native-personas')capabilities.add('owned-native-personas')
      if(['window','parent'].includes(root??'')&&apiCapabilities[name??'']==='owned-named-worldbooks') {
        capabilities.add('owned-named-worldbooks')
      }
      if(sourceFacade(node)||apiName(node)==='getVariables'
        &&!(ts.isCallExpression(node.parent)&&node.parent.expression===node)) {
        capabilities.add('owned-script-source-resources')
      }
      if(sourceFacade(node.expression)) {
        if(!reflected&&!['getVariables','getScriptId','getScriptTrees'].includes(name??'')
          &&apiCapabilities[name??'']!=='owned-named-worldbooks'&&!helperPersonaApis.has(name??'')) {
          fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',node,name??'TavernHelper dynamic member')
        }
        if(!reflected)capabilities.add(['owned-named-worldbooks','owned-native-personas'].includes(apiCapabilities[name??'']??'')
          ?apiCapabilities[name??'']!:'owned-script-source-resources')
      }
      if(root&&['window','parent','document'].includes(root)&&name&&unavailable.has(name)) {
        fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',node,name)
      }
      if(chatRead(node.expression)&&name)readKeys.add(name)
      if(name==='style'||name==='classList')capabilities.add('isolated-dom-style')
      if(name==='getContext'||name==='measureText'||name==='drawImage')capabilities.add('isolated-dom-canvas')
      if(root&&['window','parent','SillyTavern'].includes(root)&&['name1','getContext','getCurrentChatId'].includes(name??'')) {
        capabilities.add('owned-persona-snapshot')
      }
    }
    if(ts.isCallExpression(node)||ts.isNewExpression(node)) {
      if(node.expression.kind===ts.SyntaxKind.ImportKeyword)fail('BROWSER_IMPORT_UNSUPPORTED',node)
      const targets=resolverTargets(node.expression)
      if(targets&&targets.size>1
        &&[...targets].some(target=>['getVariables','updateVariablesWith','eventOn','eventMakeFirst'].includes(target))
        &&![...targets].every(target=>['eventOn','eventMakeFirst'].includes(target))) {
        fail('BROWSER_HOST_CAPABILITY_UNSUPPORTED',node,'owned facade callable targets')
      }
      const name=apiName(node.expression)
      if(name&&apiCapabilities[name]&&!['eventOn','eventMakeFirst'].includes(name))capabilities.add(apiCapabilities[name]!)
      if(name==='getVariables'&&ts.isCallExpression(node)
        &&!['chat','character','global','message'].includes(optionType(node.arguments[0])??'')) {
        capabilities.add('owned-script-source-resources')
      }
      if(name==='updateVariablesWith'&&ts.isCallExpression(node))proveUpdate(node)
      if(['eventOn','eventMakeFirst','event-registration'].includes(name??'')&&node.arguments?.[0]) {
        capabilities.add(eventName(node.arguments[0])==='GENERATION_AFTER_COMMANDS'
          ?'owned-generation-callbacks':'owned-resource-callbacks')
      }
      if(['Image','URL'].includes(name??''))capabilities.add('owned-media')
      if(['setTimeout','requestAnimationFrame','MutationObserver','ResizeObserver'].includes(name??'')) {
        capabilities.add('owned-resource-callbacks')
      }
      if(ts.isPropertyAccessExpression(node.expression)||ts.isElementAccessExpression(node.expression)) {
        const method=member(node.expression)
        if(['querySelector','querySelectorAll','createElement','getElementById','createElementNS','attachShadow'].includes(method??'')) {
          capabilities.add('isolated-dom-text')
        }
        if(['addEventListener','removeEventListener','dispatchEvent'].includes(method??''))capabilities.add('isolated-dom-events')
        if(method==='createElement'&&node.arguments?.[0]) {
          const tag=staticString(node.arguments[0])
          if(tag&&!BROWSER_TAGS_V2.includes(tag as typeof BROWSER_TAGS_V2[number]))fail('BROWSER_DOM_TAG_UNSUPPORTED',node,tag)
        }
      }
    }
    ts.forEachChild(node,child=>walk(child,depth+1))
  }
  walk(file,0)
  if(writeKeys.size>1)fail('BROWSER_CHAT_MULTIPLE_KEYS_UNSUPPORTED')
  const ownedChatKey=writeKeys.size?[...writeKeys][0]!:null
  if(ownedChatKey&&!readKeys.has(ownedChatKey))fail('BROWSER_CHAT_READ_KEY_UNPROVEN')
  const coverage:BrowserAstCoverageV2={encoding:'native-author-browser-complete-ast-coverage-v2',
    sourceSha256:descriptor.sourceSha256,nodeCount,statements}
  return {...common,disposition:'compiled-browser',javascript:descriptor.source,
    javascriptSha256:descriptor.sourceSha256,entrypoint:'global-script',coverage,
    requiredCapabilities:[...capabilities].sort(),ownedChatKey,mediaSources:[...media]}
}

export function createBrowserCompilerV2(artifact:BrowserRuntimeArtifactV2):BrowserCompilerV2 {
  const identity=ownedBrowserCompilerIdentityV2(artifact),runtime=ownedBrowserRuntimeIdentityV2(artifact)
  const batches=new WeakSet<BrowserCandidateBatchV2>()
  function compileCandidates(input:BrowserCompilationInputV2):BrowserCandidateBatchV2 {
    if(input.schemaVersion!==2||input.encoding!=='native-author-browser-compilation-input-v2'
      ||input.scripts.length>bounds.scripts)throw new Refusal({code:'BROWSER_COMPILATION_INPUT_INVALID'})
    const rows:BrowserCandidateRowV2[]=[],seen=new Set<string>()
    let previous=-1
    for(const raw of input.scripts) {
      if(!Number.isSafeInteger(raw.ordinal)||raw.ordinal<=previous||seen.has(raw.descriptor.identity)) {
        throw new Refusal({code:'BROWSER_DESCRIPTOR_ORDER_INVALID'})
      }
      previous=raw.ordinal;seen.add(raw.descriptor.identity)
      const owned={ordinal:raw.ordinal,descriptor:{...raw.descriptor,imports:raw.descriptor.imports.map(row=>({...row}))}}
      try {
        const compiled=admitBrowserScriptV2(owned)
        rows.push({...owned,kind:raw.descriptor.enabled?'compiled':'disabled',compiled})
      }catch(error) {
        if(!(error instanceof Refusal))throw error
        rows.push({...owned,kind:'refused',diagnostics:[error.diagnostic]})
      }
    }
    const batch=freeze({schemaVersion:2 as const,encoding:'native-author-browser-candidate-batch-v2' as const,
      source:{...input.source},rows})
    batches.add(batch);return batch
  }
  function assembleAccepted(batch:BrowserCandidateBatchV2,ordinals:readonly number[]):BrowserCompilationV2 {
    if(!batches.has(batch))return {kind:'refused',diagnostics:[{code:'BROWSER_CANDIDATE_BATCH_NOT_OWNED'}]}
    const scripts:BrowserCompiledScriptV2[]=[],required=new Set<BrowserCapabilityV2>(),keys=new Set<string>()
    const writers:BrowserCompiledScriptV2[]=[]
    let previous=-1,bytes=0
    for(const ordinal of ordinals) {
      const row=batch.rows.find(item=>item.ordinal===ordinal)
      if(!row||ordinal<=previous||row.kind==='refused')return {kind:'refused',diagnostics:[{code:'BROWSER_CANDIDATE_SELECTION_INVALID'}]}
      previous=ordinal;scripts.push(row.compiled);bytes+=Buffer.byteLength(row.compiled.javascript,'utf8')
      if(bytes>bounds.programBytes)return {kind:'refused',diagnostics:[{code:'BROWSER_PROGRAM_BYTE_LIMIT'}]}
      for(const capability of row.compiled.requiredCapabilities)required.add(capability)
      if(row.compiled.ownedChatKey){keys.add(row.compiled.ownedChatKey);writers.push(row.compiled)}
    }
    if(keys.size>1||writers.length>1)return {kind:'refused',diagnostics:[{code:'BROWSER_CHAT_MULTIPLE_WRITERS_UNSUPPORTED'}]}
    const body={schemaVersion:2 as const,encoding:'native-author-browser-program-v2' as const,
      authority:'compiled-program-data-only' as const,source:batch.source,compiler:identity,profile:BROWSER_PROFILE_V2,
      runtime,capabilityContract:BROWSER_CAPABILITY_CONTRACT_V2,scripts,requiredCapabilities:[...required].sort(),
      ownedChatKey:keys.size?[...keys][0]!:null,
      ownedChatWriter:writers.length?{ordinal:writers[0]!.ordinal,descriptorSha256:writers[0]!.descriptorSha256}:null}
    return {kind:'compiled',program:freeze({...body,programSha256:recordSha256(body)})}
  }
  function compile(input:BrowserCompilationInputV2):BrowserCompilationV2 {
    try {
      const batch=compileCandidates(input),refused=batch.rows.filter(row=>row.kind==='refused')
      return refused.length?{kind:'refused',diagnostics:refused.flatMap(row=>row.kind==='refused'?row.diagnostics:[])}:
        assembleAccepted(batch,batch.rows.map(row=>row.ordinal))
    }catch(error) {
      if(error instanceof Refusal)return {kind:'refused',diagnostics:[error.diagnostic]}
      throw error
    }
  }
  return {identity,compile,compileCandidates,assembleAccepted,verifyProgram(program) {
    const fresh=compile({schemaVersion:2,encoding:'native-author-browser-compilation-input-v2',
      source:program.source,scripts:program.scripts.map(({ordinal,descriptor})=>({ordinal,descriptor}))})
    return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(program)
  }}
}

const validated=new WeakSet<object>()
/** Decode stored DATA once; no AST re-execution and no protected admission. */
export function validateBrowserProgramV2(input:unknown):BrowserProgramV2 {
  if(validated.has(input as object))return input as BrowserProgramV2
  const fail=():never=>{throw Error('BROWSER_PROGRAM_DATA_INVALID')}
  if(!input||typeof input!=='object'||Array.isArray(input))fail()
  const program=input as BrowserProgramV2
  if(program.schemaVersion!==2||program.encoding!=='native-author-browser-program-v2'
    ||program.authority!=='compiled-program-data-only'||!Array.isArray(program.scripts)
    ||program.profile?.id!==BROWSER_PROFILE_V2.id||program.profile.version!==2
    ||program.compiler?.version!==2||program.runtime?.version!==2
    ||program.capabilityContract?.schemaVersion!==2||!Array.isArray(program.requiredCapabilities)
    ||!(program.ownedChatKey===null||typeof program.ownedChatKey==='string'))fail()
  let previous=-1
  const required=new Set<string>(),keys=new Set<string>(),writers:BrowserCompiledScriptV2[]=[]
  for(const script of program.scripts) {
    if(!Number.isSafeInteger(script.ordinal)||script.ordinal<=previous||!script.descriptor
      ||script.descriptorSha256!==recordSha256(script.descriptor)
      ||sha256(script.descriptor.source)!==script.descriptor.sourceSha256
      ||!Array.isArray(script.requiredCapabilities)||!Array.isArray(script.mediaSources))fail()
    previous=script.ordinal
    const enabled=script.descriptor.enabled
    if(script.disposition!==(enabled?'compiled-browser':'disabled-source-retained')
      ||script.entrypoint!==(enabled?'global-script':'disabled')
      ||script.javascript!==(enabled?script.descriptor.source:'')
      ||script.javascriptSha256!==sha256(script.javascript)
      ||enabled&&script.coverage?.sourceSha256!==script.descriptor.sourceSha256
      ||!enabled&&script.coverage!==null)fail()
    for(const capability of script.requiredCapabilities)required.add(capability)
    if(script.ownedChatKey!==null) {
      if(typeof script.ownedChatKey!=='string'||!script.ownedChatKey||script.ownedChatKey==='stat_data')fail()
      keys.add(script.ownedChatKey)
      writers.push(script)
    }
  }
  const writer=writers[0]
  if(keys.size>1||writers.length>1||program.ownedChatKey!==(keys.size?[...keys][0]:null)
    ||recordSha256(program.ownedChatWriter)!==recordSha256(writer?{ordinal:writer.ordinal,descriptorSha256:writer.descriptorSha256}:null)
    ||recordSha256([...required].sort())!==recordSha256(program.requiredCapabilities))fail()
  const {programSha256,...body}=program
  if(!hash(programSha256)||recordSha256(body)!==programSha256)fail()
  freeze(program);validated.add(program);return program
}
