/** Main-thread facade plus the worker-only complete AST compiler. */
import {createRequire} from 'node:module'
import path from 'node:path'
import type * as TypeScript from 'typescript'
import {recordSha256} from './roleplay-data.js'
import {schemaTextSha256} from './tavern-mvu-schema-data.js'
import {PROMPT_AMBIENT_V1,PROMPT_BOUNDS_V1 as bounds,PROMPT_ESCAPE_PROPERTIES_V1,
  PROMPT_GLOBALS_V1,PROMPT_GLOBAL_MEMBERS_V1,PROMPT_MUTATING_METHODS_V1,PROMPT_PROFILE_SHA256_V1,PROMPT_SYNTAX_V1}
  from './tavern-author-prompt-profile.mjs'
import type {PromptCompilationInputV1,PromptCompilationV1,PromptCandidateBatchV1,PromptCandidateRowV1,
  PromptCompilerIdentityV1,PromptCompilerV1,PromptRuntimeIdentityV1,PromptProgramV1,
  PromptRawScriptV1,PromptCompiledScriptV1,PromptDiagnosticV1,PromptWorkerRequestV1,PromptExecutionV1} from './tavern-author-prompt-types.mjs'

class Refusal extends Error {constructor(readonly diagnostic:PromptDiagnosticV1){super(diagnostic.code)}}
function frozen<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value)}
  return value
}
function assemble(batch:PromptCandidateBatchV1,ordinals:readonly number[],
  compiler:PromptCompilerIdentityV1,runtime:PromptRuntimeIdentityV1):PromptCompilationV1 {
  const scripts:PromptCompiledScriptV1[]=[]
  for(const ordinal of ordinals) {
    const row=batch.rows.find(item=>item.ordinal===ordinal)
    if(!row||row.kind==='refused')return {kind:'refused',diagnostics:row?.kind==='refused'?row.diagnostics:
      [{code:'PROMPT_ORDINAL_UNAVAILABLE',ordinal}]}
    scripts.push(row.compiled)
  }
  if(new Set(ordinals).size!==ordinals.length||scripts.some((row,i)=>i>0&&row.ordinal<=scripts[i-1]!.ordinal))
    return {kind:'refused',diagnostics:[{code:'PROMPT_ORDINAL_ORDER'}]}
  const data={schemaVersion:1 as const,encoding:'native-author-prompt-program-v1' as const,
    authority:'compiled-program-data-only' as const,source:batch.source,compiler,runtime,
    profileSha256:PROMPT_PROFILE_SHA256_V1,scripts}
  return {kind:'compiled',program:{...data,programSha256:recordSha256(data)}}
}
export function createAuthorPromptCompilerV1(deps:{compiler:PromptCompilerIdentityV1;runtime:PromptRuntimeIdentityV1;
  dispatch(request:PromptWorkerRequestV1,signal?:AbortSignal):Promise<PromptCandidateBatchV1|PromptExecutionV1>;
  accept(program:PromptProgramV1):void}):PromptCompilerV1 {
  const {compiler,runtime}=deps
  const ownedBatches=new WeakSet<PromptCandidateBatchV1>()
  const compileCandidates=async(input:PromptCompilationInputV1,signal?:AbortSignal):Promise<PromptCandidateBatchV1>=>{
    const result=await deps.dispatch({kind:'compile',input,compiler,runtime},signal)
    if(!('rows' in result))throw new Error('PROMPT_COMPILER_WORKER_REFUSED')
    frozen(result);ownedBatches.add(result);return result
  }
  const assembleAccepted=(batch:PromptCandidateBatchV1,ordinals:readonly number[]):PromptCompilationV1=>{
    // Only this live compiler's completed worker result may be assembled. A
    // persisted program is verified by actual recompilation instead.
    if(!ownedBatches.has(batch))return {kind:'refused',diagnostics:[{code:'PROMPT_CANDIDATE_BATCH_UNOWNED'}]}
    const result=assemble(batch,ordinals,compiler,runtime)
    if(result.kind==='compiled')deps.accept(result.program)
    return frozen(result)
  }
  const compile=async(input:PromptCompilationInputV1,signal?:AbortSignal):Promise<PromptCompilationV1>=>{
    try {const batch=await compileCandidates(input,signal);return assembleAccepted(batch,batch.rows.map(row=>row.ordinal))}
    catch {return {kind:'refused',diagnostics:[{code:signal?.aborted?'PROMPT_CANCELLED':'PROMPT_COMPILATION_FAILED'}]}}
  }
  return {identity:compiler,runtime,compileCandidates,assembleAccepted,compile,
    async verifyProgram(program:PromptProgramV1,signal?:AbortSignal):Promise<boolean> {
      const result=await compile({schemaVersion:1,encoding:'native-author-prompt-compilation-input-v1',
        source:program.source,scripts:program.scripts.map(({ordinal,descriptor})=>({ordinal,descriptor}))},signal)
      const verified=result.kind==='compiled'&&recordSha256(result.program)===recordSha256(program)
      if(verified)deps.accept(program)
      return verified
    }}
}

/** Not an admission API: the bounded Node worker alone calls this routine. */
export function compilePromptCandidatesInWorkerV1(input:PromptCompilationInputV1,
  compiler:PromptCompilerIdentityV1,runtime:PromptRuntimeIdentityV1):PromptCandidateBatchV1 {
  const require=createRequire(import.meta.url)
  let ts:typeof TypeScript
  try {ts=require('typescript') as typeof TypeScript}
  catch {ts=createRequire(new URL('../../build-tools/package.json',import.meta.url))('typescript') as typeof TypeScript}
  if(ts.version!=='5.9.3')throw new Error('PROMPT_TYPESCRIPT_VERSION')
  const allowedSyntax=new Set([...PROMPT_SYNTAX_V1].map(name=>ts.SyntaxKind[name as keyof typeof ts.SyntaxKind]))
  if(input.schemaVersion!==1||input.encoding!=='native-author-prompt-compilation-input-v1'
    ||input.scripts.length>bounds.scripts)throw new Error('PROMPT_COMPILATION_INPUT')
  const rows:PromptCandidateRowV1[]=[],ordinals=new Set<number>()
  for(const row of input.scripts) {
    if(!Number.isSafeInteger(row.ordinal)||row.ordinal<0||ordinals.has(row.ordinal))throw new Error('PROMPT_ORDINAL_ORDER')
    ordinals.add(row.ordinal)
    try {rows.push({ ...row,kind:row.descriptor.enabled?'compiled':'disabled',compiled:compileScript(row)})}
    catch(error) {rows.push({...row,kind:'refused',diagnostics:[error instanceof Refusal?error.diagnostic:
      {code:'PROMPT_AST_FAILED',ordinal:row.ordinal,scriptIdentity:row.descriptor.identity,pointer:row.descriptor.pointer}]})}
  }
  void compiler;void runtime
  return {schemaVersion:1,encoding:'native-author-prompt-candidate-batch-v1',source:input.source,rows}

  function compileScript(row:PromptRawScriptV1):PromptCompiledScriptV1 {
    const descriptor=row.descriptor,source=descriptor.source
    const empty={...row,descriptorSha256:recordSha256(descriptor),javascript:'',javascriptSha256:schemaTextSha256('')}
    if(!descriptor.enabled)return {...empty,disposition:'disabled-source-retained',coverage:null,reinstantiation:'disabled'}
    if(Buffer.byteLength(source,'utf8')>bounds.sourceBytes)throw new Refusal({code:'PROMPT_SOURCE_BYTE_LIMIT',
      ordinal:row.ordinal,scriptIdentity:descriptor.identity,pointer:descriptor.pointer,line:1,column:1})
    const file=ts.createSourceFile('owned-author-prompt.ts',source,ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS)
    function fail(code:string,node?:TypeScript.Node,feature?:string):never {
      const pos=file.getLineAndCharacterOfPosition(node?.getStart(file)??0)
      throw new Refusal({code,ordinal:row.ordinal,scriptIdentity:descriptor.identity,pointer:descriptor.pointer,
        line:pos.line+1,column:pos.character+1,...feature?{feature}:{}})
    }
    if(schemaTextSha256(source)!==descriptor.sourceSha256)fail('PROMPT_SOURCE_HASH')
    const options:TypeScript.CompilerOptions={target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None,
      noEmit:true,lib:['lib.es2023.d.ts'],noResolve:false}
    const host=ts.createCompilerHost(options,true),ambient='owned-author-prompt-host.d.ts'
    const libraryRoot=path.dirname(path.resolve(host.getDefaultLibFileName(options)))
    const nativeGet=host.getSourceFile.bind(host),nativeRead=host.readFile.bind(host),nativeExists=host.fileExists.bind(host)
    host.getSourceFile=(name,version,onError,create)=>name===file.fileName?file:name===ambient?
      ts.createSourceFile(ambient,PROMPT_AMBIENT_V1,ts.ScriptTarget.ES2023,true):
      path.dirname(path.resolve(name))===libraryRoot?nativeGet(name,version,onError,create):undefined
    host.readFile=name=>name===file.fileName?source:name===ambient?PROMPT_AMBIENT_V1:
      path.dirname(path.resolve(name))===libraryRoot?nativeRead(name):undefined
    host.fileExists=name=>name===file.fileName||name===ambient
      ||path.dirname(path.resolve(name))===libraryRoot&&nativeExists(name)
    const program=ts.createProgram([file.fileName,ambient],options,host),checker=program.getTypeChecker()
    if(program.getSyntacticDiagnostics(file).length)fail('PROMPT_SYNTAX_INVALID')
    const statements:{start:number;end:number}[]=[]
    const writes:{target:TypeScript.Expression;at:TypeScript.Node;mutation:boolean}[]=[]
    const assignments=new Map<TypeScript.Symbol,TypeScript.Expression[]>()
    let nodeCount=0,generationRegistrations=0
    const fn=(node:TypeScript.Node):node is TypeScript.FunctionLikeDeclaration=>
      ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node)
    const enclosing=(node:TypeScript.Node):TypeScript.Node=>{
      for(let parent=node.parent;parent;parent=parent.parent)if(fn(parent))return parent
      return file
    }
    const symbol=(node:TypeScript.Node)=>checker.getSymbolAtLocation(node)
    const external=(node:TypeScript.Identifier)=>!(symbol(node)?.declarations??[]).some(d=>d.getSourceFile()===file)
    function nameOnly(node:TypeScript.Identifier):boolean {
      const p=node.parent
      return ts.isPropertyAccessExpression(p)&&p.name===node
        ||(ts.isPropertyAssignment(p)||ts.isBindingElement(p))&&p.name===node
        ||(ts.isVariableDeclaration(p)||ts.isParameter(p)||fn(p))&&p.name===node
        ||ts.isBindingElement(p)&&p.propertyName===node
    }
    function member(node:TypeScript.Expression):string|undefined {
      return ts.isPropertyAccessExpression(node)?node.name.text:
        ts.isElementAccessExpression(node)?literalString(node.argumentExpression):undefined
    }
    function localFunction(node:TypeScript.Expression):TypeScript.FunctionLikeDeclaration|undefined {
      if(fn(node))return node
      if(ts.isIdentifier(node))for(const declaration of symbol(node)?.declarations??[]) {
        if(fn(declaration))return declaration
        if(ts.isVariableDeclaration(declaration)&&declaration.initializer&&fn(declaration.initializer))return declaration.initializer
      }
      return undefined
    }
    function literalString(node:TypeScript.Expression,seen=new Set<TypeScript.Symbol>()):string|undefined {
      if(ts.isStringLiteralLike(node))return node.text
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken) {
        const left=literalString(node.left,new Set(seen)),right=literalString(node.right,new Set(seen))
        return left===undefined||right===undefined?undefined:left+right
      }
      if(ts.isIdentifier(node)) {
        const s=symbol(node);if(!s||seen.has(s))return undefined;seen.add(s)
        for(const d of s.declarations??[])if(ts.isVariableDeclaration(d)&&d.initializer
          &&ts.isVariableDeclarationList(d.parent)&&(d.parent.flags&ts.NodeFlags.Const))return literalString(d.initializer,seen)
      }
      return undefined
    }
    function proveCleanup(node:TypeScript.Node):void {
      if(ts.isBlock(node)){for(const s of node.statements)proveCleanup(s);return}
      if(ts.isIfStatement(node)&&!node.elseStatement){
        const pure=(condition:TypeScript.Node):void=>{
          if(ts.isCallExpression(condition)||ts.isNewExpression(condition)||ts.isPostfixUnaryExpression(condition)
            ||ts.isBinaryExpression(condition)&&condition.operatorToken.kind>=ts.SyntaxKind.FirstAssignment
              &&condition.operatorToken.kind<=ts.SyntaxKind.LastAssignment)fail('PROMPT_CLEANUP_STATEFUL_UNSUPPORTED',condition)
          ts.forEachChild(condition,pure)
        }
        pure(node.expression);proveCleanup(node.thenStatement);return
      }
      const call=ts.isCallExpression(node)?node:
        ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)?node.expression:undefined
      if(call) {
        const args=call.arguments
        if(ts.isIdentifier(call.expression)&&call.expression.text==='uninjectPrompts'&&external(call.expression)
          &&args.length===1&&ts.isArrayLiteralExpression(args[0]!)
          &&args[0]!.elements.every(element=>literalString(element)!==undefined))return
      }
      fail('PROMPT_CLEANUP_STATEFUL_UNSUPPORTED',node)
    }
    function write(node:TypeScript.Expression,at:TypeScript.Node,mutation:boolean,
      seen=new Set<TypeScript.Symbol>()):void {
      if(mutation&&ts.isElementAccessExpression(node))fail('PROMPT_STATEFUL_ALIAS_UNSUPPORTED',at)
      if(mutation&&ts.isPropertyAccessExpression(node)&&ts.isPropertyAccessExpression(node.expression))
        fail('PROMPT_STATEFUL_ALIAS_UNSUPPORTED',at)
      while(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)||ts.isParenthesizedExpression(node))node=node.expression
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
        &&['filter','map','flatMap','slice','concat','split'].includes(node.expression.name.text))return
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
        &&['get','values','entries','at'].includes(node.expression.name.text)) {
        write(node.expression.expression,at,true,seen);return
      }
      if(!ts.isIdentifier(node))fail('PROMPT_STATEFUL_UNSUPPORTED',at)
      const s=symbol(node)
      if(!s||external(node))fail('PROMPT_STATEFUL_UNSUPPORTED',at)
      if(seen.has(s))return;seen.add(s)
      for(const d of s.declarations??[]) {
        // Nested collection callbacks may mutate their invocation's own local
        // accumulator. Only Source/startup lifetime captures survive events.
        if(enclosing(d)===file&&enclosing(at)!==file||mutation&&ts.isParameter(d))fail('PROMPT_STATEFUL_UNSUPPORTED',at)
        if(mutation&&ts.isVariableDeclaration(d)&&d.initializer
          &&(ts.isIdentifier(d.initializer)||ts.isPropertyAccessExpression(d.initializer)
            ||ts.isElementAccessExpression(d.initializer)||ts.isCallExpression(d.initializer)))write(d.initializer,at,true,seen)
        if(mutation&&ts.isVariableDeclaration(d)&&ts.isVariableDeclarationList(d.parent)
          &&ts.isForOfStatement(d.parent.parent))write(d.parent.parent.expression,at,true,seen)
      }
      if(mutation)for(const assigned of assignments.get(s)??[])write(assigned,at,true,seen)
    }
    function visit(node:TypeScript.Node,depth:number):void {
      if(++nodeCount>bounds.nodes||depth>bounds.depth)fail('PROMPT_AST_LIMIT',node)
      const kind=ts.SyntaxKind[node.kind]
      if(!allowedSyntax.has(node.kind))fail('PROMPT_SYNTAX_UNSUPPORTED',node,kind)
      if(ts.isStatement(node))statements.push({start:node.getStart(file),end:node.end})
      if(ts.isIdentifier(node)&&!nameOnly(node)&&external(node)&&!PROMPT_GLOBALS_V1.has(node.text))
        fail('PROMPT_FREE_CAPABILITY_UNSUPPORTED',node,node.text)
      if(ts.isIdentifier(node)&&!nameOnly(node)&&external(node)
        &&!['undefined','NaN','Infinity'].includes(node.text)) {
        const parent=node.parent
        if(!((ts.isCallExpression(parent)||ts.isNewExpression(parent))&&parent.expression===node
          ||(ts.isPropertyAccessExpression(parent)||ts.isElementAccessExpression(parent))&&parent.expression===node
          ||ts.isTypeOfExpression(parent)))fail('PROMPT_CAPABILITY_ALIAS_UNSUPPORTED',node,node.text)
      }
      if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
        const name=member(node)
        if(name&&PROMPT_ESCAPE_PROPERTIES_V1.has(name))fail('PROMPT_ESCAPE_UNSUPPORTED',node,name)
        if(ts.isElementAccessExpression(node)&&name===undefined) {
          const type=checker.getTypeAtLocation(node.argumentExpression)
          if(!(type.flags&ts.TypeFlags.NumberLike))fail('PROMPT_DYNAMIC_MEMBER_UNSUPPORTED',node)
        }
        if(ts.isIdentifier(node.expression)&&external(node.expression)) {
          if(!name||!PROMPT_GLOBAL_MEMBERS_V1[node.expression.text]?.includes(name))
            fail('PROMPT_HOST_MEMBER_UNSUPPORTED',node,name)
        }
      }
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment
        &&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment) {
        writes.push({target:node.left,at:node,mutation:!ts.isIdentifier(node.left)})
        if(ts.isIdentifier(node.left)) {
          const s=symbol(node.left)
          if(s){const values=assignments.get(s)??[];values.push(node.right);assignments.set(s,values)}
        }
      }
      if((ts.isPostfixUnaryExpression(node)||ts.isPrefixUnaryExpression(node))
        &&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator))
        writes.push({target:node.operand,at:node,mutation:!ts.isIdentifier(node.operand)})
      if(ts.isNewExpression(node)&&(!ts.isIdentifier(node.expression)
        ||!['Set','Map','Date','RegExp','Array'].includes(node.expression.text)||!external(node.expression)))
        fail('PROMPT_CONSTRUCTOR_UNSUPPORTED',node)
      if(ts.isCallExpression(node)) {
        const expression=node.expression,name=member(expression)
        if(ts.isElementAccessExpression(expression)&&name===undefined)fail('PROMPT_DYNAMIC_CALL_UNSUPPORTED',node)
        if(name&&PROMPT_MUTATING_METHODS_V1.has(name)
          &&(ts.isPropertyAccessExpression(expression)||ts.isElementAccessExpression(expression)))
          writes.push({target:expression.expression,at:node,mutation:true})
        if(ts.isIdentifier(expression)&&external(expression)&&expression.text==='eventOn') {
          const callback=node.arguments[1]&&localFunction(node.arguments[1])
          const event=node.arguments[0]
          if(node.arguments.length!==2||!callback||!event||!ts.isPropertyAccessExpression(event)
            ||!ts.isIdentifier(event.expression)||event.expression.text!=='tavern_events'
            ||event.name.text!=='GENERATION_AFTER_COMMANDS'||enclosing(node)!==file)
            fail('PROMPT_REGISTRATION_UNSUPPORTED',node)
          generationRegistrations++
        }
        if(ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression)
          &&expression.expression.text==='window') {
          const callback=node.arguments[1]&&localFunction(node.arguments[1])
          if(expression.name.text!=='addEventListener'||node.arguments.length!==2
            ||!node.arguments[0]||literalString(node.arguments[0])!=='pagehide'||!callback||!callback.body
            ||enclosing(node)!==file)fail('PROMPT_LIFECYCLE_UNSUPPORTED',node)
          proveCleanup(callback.body)
        }
      }
      ts.forEachChild(node,child=>visit(child,depth+1))
    }
    visit(file,0)
    for(const {target,at,mutation} of writes)write(target,at,mutation)
    if(!generationRegistrations)fail('PROMPT_GENERATION_REGISTRATION_MISSING')
    function startup(node:TypeScript.Node,seen=new Set<TypeScript.Node>()):void {
      if(fn(node))return
      if(ts.isCallExpression(node)) {
        const expression=node.expression
        if(ts.isIdentifier(expression)&&external(expression)) {
          if(expression.text==='eventOn')return
          if(['getVariables','getChatMessages','Date'].includes(expression.text))
            fail('PROMPT_STATEFUL_STARTUP_READ_UNSUPPORTED',node,expression.text)
        }
        if(ts.isPropertyAccessExpression(expression)&&ts.isIdentifier(expression.expression)
          &&external(expression.expression)) {
          if(expression.expression.text==='window')return
          if(expression.expression.text==='Date'||expression.expression.text==='Math'&&expression.name.text==='random')
            fail('PROMPT_STATEFUL_STARTUP_READ_UNSUPPORTED',node,expression.expression.text)
        }
        for(const candidate of [expression,...node.arguments]) {
          const callable=localFunction(candidate)
          if(callable?.body&&!seen.has(callable)){seen.add(callable);startup(callable.body,seen)}
        }
      }
      if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Date')
        fail('PROMPT_STATEFUL_STARTUP_READ_UNSUPPORTED',node,'Date')
      ts.forEachChild(node,child=>startup(child,seen))
    }
    startup(file)
    const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText
    return {...empty,disposition:'compiled-prompt',javascript,javascriptSha256:schemaTextSha256(javascript),
      coverage:{encoding:'native-author-prompt-complete-ast-coverage-v1',sourceSha256:descriptor.sourceSha256,nodeCount,statements},
      reinstantiation:'stateless-captured-input-v1'}
  }
}
