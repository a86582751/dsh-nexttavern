/** Complete deterministic scope/value proof. Nothing here evaluates author JS. */
import ts from 'typescript'
import {sha256} from './roleplay-data.js'
import {BROWSER_BOUNDS_V3,BROWSER_APIS_V3,BROWSER_METHODS_V3,BROWSER_PROPERTIES_V3,
  BROWSER_GUEST_INTRINSICS_V3,BROWSER_ABSENT_PROBES_V3,BROWSER_CLOSED_DOM_FACADES_V3,BROWSER_SERVER_GLOBALS_V3}
  from './tavern-author-browser-profile-v3.mjs'
import type {BrowserFacadeKindV3,BrowserOperationV3} from './tavern-author-browser-profile-v3.mjs'
import type {BrowserAstCoverageV3,BrowserCapabilityV3,BrowserScriptResourceProjectionV3}
  from './tavern-author-browser-types-v3.mjs'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'
import {BROWSER_NATIVE_METHODS_V3,BROWSER_NATIVE_PROPERTIES_V3} from './tavern-author-browser-renderer-v3.js'

export interface BrowserAstUnitV3 {
  readonly realm:string
  readonly parentRealm:string
  readonly javascript:string
  readonly ordinal:number
  readonly identity:string
  readonly pointer:string
  readonly pageId:string|null
  readonly inlineOrdinal:number|null
  readonly sourceResources:BrowserScriptResourceProjectionV3
  readonly sourceHtml?:{readonly pageId:string;readonly html:string;readonly scriptIdentity:string;
    readonly resourcePath?:readonly string[]}
}
export interface BrowserAstProofV3 {
  readonly unit:BrowserAstUnitV3
  readonly coverage:BrowserAstCoverageV3
  readonly capabilities:readonly BrowserCapabilityV3[]
  readonly keys:readonly string[]
  readonly pageMounts:readonly string[]
  readonly media:readonly {value:string;kind:'image'|'audio';start:number;end:number}[]
}
export interface BrowserAstResultV3 {
  readonly proofs:readonly BrowserAstProofV3[]
  readonly diagnostics:readonly BrowserDiagnosticV1[]
  readonly diagnosticEvidence?:readonly BrowserDiagnosticEvidenceV3[]
}
export interface BrowserTextEvidenceV3 {readonly codeUnits:number;readonly utf8Bytes:number;readonly sha256:string}
export interface BrowserValueEvidenceV3 {
  readonly count:number
  readonly kinds:Readonly<Record<string,number>>
  readonly atoms:readonly {readonly kind:string;readonly nativeName?:string;readonly facade?:BrowserFacadeKindV3;
    readonly fixedGuard?:boolean;
    readonly realm?:string;readonly pageId?:string;readonly literal?:{readonly type:string;readonly text:BrowserTextEvidenceV3};
    readonly fields?:readonly {readonly key:BrowserTextEvidenceV3;readonly count:number;
      readonly kinds:Readonly<Record<string,number>>}[];
    readonly sourceRefs?:readonly {readonly kind:string;readonly pageId?:string}[];
    readonly choice?:{readonly pure:readonly boolean[];readonly producerStart?:number;readonly producerEnd?:number;
      readonly selections:readonly {readonly key:BrowserTextEvidenceV3;readonly count:number;
        readonly kinds:Readonly<Record<string,number>>;readonly nativeNames:readonly string[];
        readonly boundOrigins:readonly {readonly realm:string;readonly inlineOrdinal:number|null;
          readonly start:number;readonly end:number;readonly receiverKind:string;readonly nativeName?:string}[]}[]}}[]
  readonly omittedAtoms:number
}
export interface BrowserDiagnosticEvidenceV3 {
  readonly code:string
  readonly ordinal:number
  readonly inlineOrdinal:number|null
  readonly pageId:string|null
  readonly realm:string
  readonly scriptIdentitySha256:string
  readonly pointerSha256:string
  readonly line?:number
  readonly column?:number
  readonly syntaxKind?:string
  readonly start?:number
  readonly end?:number
  readonly feature?:BrowserTextEvidenceV3
  readonly target?:BrowserValueEvidenceV3
  readonly receiver?:BrowserValueEvidenceV3
  readonly assigned?:BrowserValueEvidenceV3
  readonly priorGuards?:readonly {readonly start:number;readonly end:number;readonly truth?:boolean;
    readonly values:BrowserValueEvidenceV3}[]
  readonly nativeCalls?:readonly {readonly nativeName:string;readonly receiver:BrowserValueEvidenceV3;
    readonly args:readonly BrowserValueEvidenceV3[]}[]
}
type Value=Set<Atom>
interface Cell {readonly values:Value;readonly readers:Set<ts.Node>}
interface Scope {readonly parent:Scope|null;readonly functionScope:boolean;readonly bindings:Map<string,Cell>;
  readonly lexical:Set<string>;readonly global:Atom;readonly fn:Atom|null;readonly catchParameter?:string}
interface Atom {
  readonly id:number
  readonly kind:'guest'|'unknown'|'absent'|'literal'|'object'|'array'|'function'|'native'|'handle'|'blob'|'url'|'html'|'missing'
    |'invoke'|'bound'|'combiner'|'promise'|'choice'|'factory-callback'
  readonly literal?:string|number|boolean|null
  readonly fields?:Map<string,Cell>
  readonly elements?:Cell
  readonly fn?:ts.FunctionLikeDeclaration
  readonly params?:readonly Cell[]
  readonly returns?:Cell
  readonly thisValue?:Cell
  readonly boundPrefixUnproven?:Cell
  readonly boundOrigin?:ts.CallExpression|ts.NewExpression
  readonly nativeName?:string
  readonly operation?:BrowserOperationV3
  readonly receiver?:Atom
  readonly handle?:BrowserFacadeKindV3
  readonly realm?:string
  readonly pageId?:string
  readonly sources?:Cell
  readonly mount?:boolean
  readonly written?:Set<string>
  readonly mime?:Cell
  readonly prototypes?:Cell
  /** Only a fixed profile absence may suppress a boundary in an original guard. */
  readonly fixedGuard?:boolean
  readonly snapshot?:boolean
  readonly choices?:Map<string,Cell>
  readonly choiceSelector?:ts.Expression
  readonly choiceProducer?:ts.CallExpression
  readonly choicePure?:Cell
  readonly callback?:{readonly recipe:FactoryRecipe;readonly captures:Map<Cell,Value>;readonly plan:FactoryPlan}
  readonly callbackTargets?:Cell
}
type FactoryRecipe={readonly kind:'existing';readonly expression:ts.Expression}
  |{readonly kind:'binding';readonly binding:Cell;readonly expression:ts.Identifier}
  |{readonly kind:'member';readonly node:ts.PropertyAccessExpression|ts.ElementAccessExpression;
    readonly receiver:FactoryRecipe;readonly selector:string|FactoryRecipe}
  |{readonly kind:'union';readonly recipes:readonly FactoryRecipe[]}
  |{readonly kind:'guarded';readonly guards:readonly {readonly recipe:FactoryGuard;readonly truthy:boolean}[];readonly recipe:FactoryRecipe}
  |{readonly kind:'call';readonly node:ts.CallExpression;readonly target:FactoryRecipe;
    readonly args:readonly {readonly recipe:FactoryRecipe;readonly spread:boolean}[]}
  |{readonly kind:'callback';readonly node:ts.ArrowFunction|ts.FunctionExpression;readonly recipe:FactoryRecipe}
type FactoryGuard={readonly kind:'truth';readonly recipe:FactoryRecipe}
  |{readonly kind:'callable';readonly recipe:FactoryRecipe}
  |{readonly kind:'and';readonly left:FactoryGuard;readonly right:FactoryGuard}
  |{readonly kind:'not';readonly recipe:FactoryGuard}
interface FactoryPlan {readonly fn:Atom;readonly bindings:Map<Cell,readonly ts.Expression[]>;
  readonly returns:readonly FactoryRecipe[];readonly getterCalls:readonly ts.CallExpression[];readonly pure:boolean}
interface UnitState {readonly input:BrowserAstUnitV3;readonly file:ts.SourceFile;
  readonly nodes:readonly ts.Node[];readonly coverage:BrowserAstCoverageV3;
  readonly caps:Set<BrowserCapabilityV3>;readonly keys:Set<string>;readonly mounts:Set<string>;
  readonly media:Map<string,{value:string;kind:'image'|'audio';start:number;end:number}>}
const assignment=(node:ts.BinaryExpression)=>node.operatorToken.kind>=ts.SyntaxKind.FirstAssignment
  &&node.operatorToken.kind<=ts.SyntaxKind.LastAssignment
const cell=():Cell=>({values:new Set(),readers:new Set()})
const callable=(node:ts.Node):node is ts.FunctionLikeDeclaration=>ts.isFunctionDeclaration(node)
  ||ts.isFunctionExpression(node)||ts.isArrowFunction(node)||ts.isMethodDeclaration(node)
  ||ts.isGetAccessorDeclaration(node)||ts.isSetAccessorDeclaration(node)||ts.isConstructorDeclaration(node)
const ordinaryDeclaration=(node:ts.FunctionDeclaration)=>!node.asteriskToken
  &&!node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.AsyncKeyword)
function strictDirective(statements:readonly ts.Statement[]):boolean {
  for(const statement of statements){
    if(!ts.isExpressionStatement(statement)||!ts.isStringLiteral(statement.expression))break
    // Escaped or parenthesized strings are not Use Strict Directives.
    const raw=statement.expression.getText()
    if(raw==='"use strict"'||raw==="'use strict'")return true
  }
  return false
}
function namePosition(node:ts.Identifier):boolean {
  const p=node.parent
  return ts.isPropertyAccessExpression(p)&&p.name===node
    ||(ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p))&&p.name===node
    ||ts.isBindingElement(p)&&p.propertyName===node
    ||(ts.isVariableDeclaration(p)||ts.isParameter(p)||callable(p)||ts.isClassDeclaration(p))&&p.name===node
    ||ts.isLabeledStatement(p)&&p.label===node
    ||(ts.isBreakStatement(p)||ts.isContinueStatement(p))&&p.label===node
}

export function analyseBrowserAstV3(inputs:readonly BrowserAstUnitV3[],
  astOptions:{readonly captureDiagnosticEvidence?:boolean;
    readonly loadSourcePage?:(pageId:string)=>readonly BrowserAstUnitV3[]}={}):BrowserAstResultV3 {
  if(ts.version!=='5.9.3')throw Error('BROWSER3_TYPESCRIPT_IDENTITY')
  const diagnostics:BrowserDiagnosticV1[]=[],diagnosticKeys=new Set<string>()
  const diagnosticSites=astOptions.captureDiagnosticEvidence
    ?[] as {diagnostic:BrowserDiagnosticV1;state:UnitState;node?:ts.Node}[]:undefined
  const values=new Map<ts.Node,Cell>(),scopes=new Map<ts.Node,Scope>(),units=new Map<ts.Node,UnitState>()
  const functions=new Map<ts.Node,Atom>(),objects=new Map<ts.Node,Atom>(),realms=new Map<string,Atom>()
  const realmInputs=new Map(inputs.map(input=>[input.realm,input] as const))
  const sourceParents=new Map(inputs.filter(input=>input.sourceHtml).map(input=>
    [input.sourceHtml!.pageId,input.parentRealm] as const))
  const roots=new Map<string,Scope>(),literalAtoms=new Map<string,Atom>(),nativeAtoms=new Map<string,Atom>()
  const handles=new Map<string,Atom>(),queue:ts.Node[]=[],queued=new Set<ts.Node>()
  const functionFallbackReaders=new Set<ts.Node>()
  const serverNativeReads=new Map<ts.Node,Set<string>>()
  let functionFallback=false
  let missingFallback=false
  let globalMissingFallback=false
  let sequence=0
  const atom=(kind:Atom['kind'],rest:Omit<Atom,'kind'|'id'>={}):Atom=>({id:++sequence,kind,...rest})
  const guest=atom('guest'),unknown=atom('unknown'),absent=atom('absent'),fixedAbsent=atom('absent',{fixedGuard:true})
  const literal=(value:string|number|boolean|null,fixedGuard=false)=>{
    const key=typeof value+':'+String(value)+':'+fixedGuard
    let found=literalAtoms.get(key)
    if(!found){found=atom('literal',{literal:value,fixedGuard});literalAtoms.set(key,found)}
    return found
  }
  function enqueue(node:ts.Node){if(!queued.has(node)){queued.add(node);queue.push(node)}}
  function add(target:Cell,next:Iterable<Atom>):void {
    let changed=false
    for(const value of next)if(!target.values.has(value)){target.values.add(value);changed=true}
    if(changed)for(const node of target.readers)enqueue(node)
  }
  const one=(value:Atom)=>new Set([value])
  function read(target:Cell,node:ts.Node):Value {target.readers.add(node);return target.values}
  function nodeCell(node:ts.Node):Cell {
    let target=values.get(node)
    if(!target){target=cell();values.set(node,target)}
    return target
  }
  const value=(child:ts.Node,node:ts.Node)=>read(nodeCell(child),node)
  function field(owner:Atom,key:string):Cell {
    let target=owner.fields!.get(key)
    if(!target){target=cell();owner.fields!.set(key,target)}
    return target
  }
  function realm(name:string):Atom {
    let found=realms.get(name)
    if(!found){found=atom('object',{fields:new Map(),written:new Set(),realm:name});realms.set(name,found)}
    return found
  }
  function handle(kind:BrowserFacadeKindV3,realmName:string,mount=false,pageId?:string):Atom {
    const key=kind+':'+realmName+':'+mount+':'+(pageId??'')
    let found=handles.get(key)
    if(!found){found=atom('handle',{handle:kind,realm:realmName,mount,...pageId?{pageId}:{},
      ...kind==='frame'?{sources:cell()}:{},
      ...['node','frame','frame-parent'].includes(kind)?{fields:new Map(),written:new Set(),prototypes:cell()}: {}});handles.set(key,found)}
    return found
  }
  function native(name:string,operation:BrowserOperationV3,receiver:Atom):Atom {
    const key=receiver.id+':'+name
    let found=nativeAtoms.get(key)
    if(!found){found=atom('native',{nativeName:name,operation,receiver,fields:new Map(),written:new Set()});nativeAtoms.set(key,found)}
    return found
  }
  function report(state:UnitState,code:string,node?:ts.Node,feature?:string):void {
    const at=node?state.file.getLineAndCharacterOfPosition(node.getStart(state.file)):null
    const key=[state.input.realm,state.input.inlineOrdinal,code,at?.line,at?.character,feature].join(':')
    if(diagnosticKeys.has(key))return
    diagnosticKeys.add(key)
    const diagnostic={code,ordinal:state.input.ordinal,scriptIdentity:state.input.identity,
      pointer:state.input.pointer,...at?{line:at.line+1,column:at.character+1}:{},...feature?{feature}:{}}
    diagnostics.push(diagnostic)
    diagnosticSites?.push({diagnostic,state,...node?{node}:{}})
  }
  function root(input:BrowserAstUnitV3):Scope {
    let found=roots.get(input.realm)
    if(!found){found={parent:null,functionScope:true,bindings:new Map(),lexical:new Set(),global:realm(input.realm),fn:null}
      roots.set(input.realm,found)}
    return found
  }
  function declare(scope:Scope,name:string,isVar:boolean,state:UnitState,node:ts.Node,
    duplicateBlockFunction=false):Cell {
    let owner=scope
    if(isVar)while(owner.parent&&!owner.functionScope)owner=owner.parent
    let target=owner.bindings.get(name)
    const compatibleFunctions=duplicateBlockFunction&&target&&target.values.size>0
      &&[...target.values].every(value=>value.kind==='function'&&value.fn&&ts.isFunctionDeclaration(value.fn)
        &&ordinaryDeclaration(value.fn))
    if(target&&(!isVar||owner.lexical.has(name))&&!compatibleFunctions)
      report(state,'BROWSER3_LEXICAL_DECLARATION_CONFLICT',node,name)
    if(!target){target=owner.parent||!isVar?cell():field(owner.global,name);owner.bindings.set(name,target)}
    if(!isVar)owner.lexical.add(name)
    return target
  }
  function lookup(scope:Scope,name:string):Cell|undefined {
    for(let current:Scope|null=scope;current;current=current.parent){const found=current.bindings.get(name);if(found)return found}
    return undefined
  }
  function bindingScope(node:ts.Node,name:string):Scope|undefined {
    for(let current:Scope|null=scopes.get(node)!;current;current=current.parent)
      if(current.bindings.has(name))return current
    return undefined
  }
  function pattern(name:ts.BindingName,scope:Scope,isVar:boolean,state:UnitState):void {
    const todo:ts.BindingName[]=[name]
    while(todo.length){const item=todo.pop()!
      if(ts.isIdentifier(item))declare(scope,item.text,isVar,state,item)
      else for(const element of item.elements)if(ts.isBindingElement(element))todo.push(element.name)
    }
  }
  function parameterNamed(fn:Atom,name:string):boolean {
    const todo=fn.fn!.parameters.map(parameter=>parameter.name)
    while(todo.length){const binding=todo.pop()!
      if(ts.isIdentifier(binding)){if(binding.text===name)return true}
      else for(const element of binding.elements)if(ts.isBindingElement(element))todo.push(element.name)
    }
    return false
  }
  const states:UnitState[]=[],mountWrites:ts.BinaryExpression[]=[]
  function registerUnit(input:BrowserAstUnitV3):UnitState {
    const index=states.length
    realmInputs.set(input.realm,input)
    const file=ts.createSourceFile('browser3-'+index+'.js',input.javascript,ts.ScriptTarget.ES2023,true,ts.ScriptKind.JS)
    const nodes:ts.Node[]=[],statements:BrowserAstCoverageV3['statements'][number][]=[]
    const state:UnitState={input,file,nodes,coverage:{encoding:'native-author-browser-complete-ast-coverage-v3',
      sourceSha256:sha256(input.javascript),nodeCount:0,statements},caps:new Set(),keys:new Set(),mounts:new Set(),media:new Map()}
    const parse=(file as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics
    if(parse.length)report(state,'BROWSER3_JAVASCRIPT_SYNTAX',file)
    const aliases:{node:ts.FunctionDeclaration;scope:Scope;fn:Atom}[]=[]
    const stack:{node:ts.Node;scope:Scope;depth:number;strict:boolean}[]=[{
      node:file,scope:root(input),depth:0,strict:strictDirective(file.statements)}]
    let exceeded=false
    while(stack.length){const {node,scope,depth,strict}=stack.pop()!;nodes.push(node);units.set(node,state)
      if(!exceeded&&(nodes.length>BROWSER_BOUNDS_V3.syntaxNodes||depth>BROWSER_BOUNDS_V3.syntaxDepth)){
        report(state,'BROWSER3_AST_LIMIT',node);exceeded=true}
      if(ts.isStatement(node))statements.push({start:node.getStart(file),end:node.end,syntaxKind:ts.SyntaxKind[node.kind]})
      let next=scope
      let nextStrict=strict||ts.isClassDeclaration(node)||ts.isClassExpression(node)
      if(callable(node)){
        const lexicalThis=ts.isArrowFunction(node)?scope.fn?.thisValue??cell():cell()
        if(ts.isArrowFunction(node)&&!scope.fn)add(lexicalThis,one(scope.global))
        const fn=atom('function',{fn:node,params:node.parameters.map(()=>cell()),returns:cell(),thisValue:lexicalThis,
          fields:new Map(),written:new Set()})
        functions.set(node,fn)
        if(ts.isFunctionDeclaration(node)&&node.name){
          const blockFunction=ts.isBlock(node.parent)&&!callable(node.parent.parent)
            ||ts.isCaseClause(node.parent)||ts.isDefaultClause(node.parent)
          add(declare(scope,node.name.text,!blockFunction,state,node,
            blockFunction&&!strict&&ordinaryDeclaration(node)),one(fn))
          if(blockFunction&&!strict&&ordinaryDeclaration(node))aliases.push({node,scope,fn})
        }
        let functionParent=scope
        if(ts.isFunctionExpression(node)&&node.name){
          // A named expression's self binding is outside its variable environment.
          functionParent={parent:scope,functionScope:false,bindings:new Map(),lexical:new Set(),global:scope.global,fn:scope.fn}
          add(declare(functionParent,node.name.text,false,state,node),one(fn))
        }
        next={parent:functionParent,functionScope:true,bindings:new Map(),lexical:new Set(),global:scope.global,fn}
        nextStrict=strict||!!node.body&&ts.isBlock(node.body)&&strictDirective(node.body.statements)
        declare(next,'arguments',true,state,node);add(next.bindings.get('arguments')!,one(guest))
        for(let p=0;p<node.parameters.length;p++){
          const parameter=node.parameters[p]!
          pattern(parameter.name,next,true,state)
          if(ts.isIdentifier(parameter.name))next.bindings.set(parameter.name.text,fn.params![p]!)
        }
      }else if(ts.isBlock(node)||ts.isCatchClause(node)||ts.isForStatement(node)||ts.isForOfStatement(node)
        ||ts.isForInStatement(node)||ts.isCaseBlock(node)){
        next={parent:scope,functionScope:false,bindings:new Map(),lexical:new Set(),global:scope.global,fn:scope.fn}
        if(ts.isCatchClause(node)&&node.variableDeclaration&&ts.isIdentifier(node.variableDeclaration.name))
          next={...next,catchParameter:node.variableDeclaration.name.text}
      }
      scopes.set(node,next)
      if(ts.isVariableDeclaration(node)){
        const isVar=ts.isVariableDeclarationList(node.parent)&&!(node.parent.flags&ts.NodeFlags.BlockScoped)
        pattern(node.name,next,isVar,state)
      }
      if(ts.isClassDeclaration(node)&&node.name)declare(next,node.name.text,false,state,node)
      const children:ts.Node[]=[];ts.forEachChild(node,child=>{children.push(child)})
      for(let i=children.length-1;i>=0;i--)stack.push({node:children[i]!,scope:next,depth:depth+1,strict:nextStrict})
    }
    // Process after this unit's declarations: a later lexical declaration also
    // prevents an Annex B var alias. The block's own function binding is excluded.
    for(const {node,scope,fn} of aliases){
      const name=node.name!.text
      let owner=scope.parent!,conflict=false
      while(true){
        if(owner.lexical.has(name)&&owner.catchParameter!==name)conflict=true
        if(owner.functionScope)break
        owner=owner.parent!
      }
      if(conflict||owner.fn&&parameterNamed(owner.fn,name))continue
      add(declare(owner,name,true,state,node),one(fn))
    }
    Object.assign(state.coverage,{nodeCount:nodes.length})
    states.push(state)
    for(const node of nodes)if(ts.isBinaryExpression(node)&&assignment(node)
      &&(ts.isPropertyAccessExpression(node.left)||ts.isElementAccessExpression(node.left)))mountWrites.push(node)
    return state
  }
  for(const input of inputs)registerUnit(input)
  const globalOwnWrites=new Map<string,Set<string>>()
  function registerGlobalWrites(state:UnitState):void {for(const node of state.nodes)
    if(ts.isBinaryExpression(node)&&assignment(node)
      &&(ts.isPropertyAccessExpression(node.left)||ts.isElementAccessExpression(node.left))){
      const access=node.left,base=access.expression
      if(!ts.isIdentifier(base)||!['window','globalThis','parent','top'].includes(base.text)
        ||lookup(scopes.get(base)!,base.text))continue
      const name=ts.isPropertyAccessExpression(access)?access.name.text:
        ts.isStringLiteralLike(access.argumentExpression)?access.argumentExpression.text:undefined
      if(name===undefined)continue
      const realmName=['parent','top'].includes(base.text)?state.input.parentRealm:state.input.realm
      const writes=globalOwnWrites.get(realmName)??new Set<string>();writes.add(name);globalOwnWrites.set(realmName,writes)
    }
  }
  for(const state of states)registerGlobalWrites(state)
  function names(items:Value):Set<string>|undefined {
    if(!items.size||items.size>BROWSER_BOUNDS_V3.finiteNames)return undefined
    const result=new Set<string>()
    for(const item of items)if(item.kind==='literal'&&typeof item.literal==='string')result.add(item.literal)
      else return undefined
    return result
  }
  function key(node:ts.PropertyName|ts.Expression,reader:ts.Node):Set<string>|undefined {
    if(ts.isIdentifier(node)&&!ts.isElementAccessExpression(node.parent))return new Set([node.text])
    if(ts.isStringLiteralLike(node)||ts.isNumericLiteral(node))return new Set([node.text])
    if(ts.isComputedPropertyName(node))return names(value(node.expression,reader))
    return names(value(node,reader))
  }
  function truth(items:Value):boolean|undefined {
    if(!items.size)return undefined
    const results=new Set<boolean>()
    for(const item of items){
      if(item.kind==='absent')results.add(false)
      else if(item.kind==='literal')results.add(Boolean(item.literal))
      else if(['object','array','function','native','handle','blob','url','html','invoke','bound','choice','factory-callback','promise'].includes(item.kind))results.add(true)
      else return undefined
    }
    return results.size===1?[...results][0]:undefined
  }
  function guardTruth(items:Value):boolean|undefined {
    // A genuine fixed absence still controls a guard when ordinary nullable
    // alternatives produce the same truth. Guest-only facts cannot prune it.
    return items.size&&[...items].some(item=>item.fixedGuard)?truth(items):undefined
  }
  function guestFieldsOwner(receiver:Atom):boolean {
    return receiver.kind==='handle'&&['node','frame','frame-parent'].includes(receiver.handle!)
  }
  function guestField(receiver:Atom,name:string):boolean {
    if(!guestFieldsOwner(receiver)||name.startsWith('on'))return false
    const kind=receiver.handle! as 'node'|'frame'|'frame-parent'
    return !BROWSER_NATIVE_PROPERTIES_V3[kind].includes(name)
  }
  const memberResults=new Map<ts.Node,Map<Atom,Value>>()
  const nativeMemberUnknown=new Set<ts.Node>()
  function memberValues(receiver:Atom,names:Set<string>|undefined,node:ts.Node):Value {
    const result=resolveMemberValues(receiver,names,node)
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)){
      let owners=memberResults.get(node)
      if(!owners){owners=new Map();memberResults.set(node,owners)}
      let previous=owners.get(receiver)
      if(!previous){previous=new Set();owners.set(receiver,previous)}
      for(const item of result)previous.add(item)
    }
    return result
  }
  function resolveMemberValues(receiver:Atom,names:Set<string>|undefined,node:ts.Node):Value {
    if(receiver.kind==='choice'){
      const own=names?.size===1?receiver.fields?.get([...names][0]!):undefined
      if(own?.values.size)return new Set(read(own,node))
      const methods:Value=new Set()
      for(const target of choiceValues(one(receiver),node))for(const method of memberValues(target,names,node))methods.add(method)
      if(names?.size===1&&['bind','call','apply'].includes([...names][0]!)&&methods.size
        &&[...methods].every(method=>method.kind==='invoke'&&method.nativeName===[...names][0])){
        const name=[...names][0]!,id='invoke:'+receiver.id+':'+name
        let found=nativeAtoms.get(id)
        if(!found){found=atom('invoke',{nativeName:name,receiver});nativeAtoms.set(id,found)}
        return one(found)
      }
      return methods
    }
    const state=units.get(node)!,out:Value=new Set()
    if(receiver.kind==='unknown'||receiver.kind==='missing')return one(receiver)
    if(receiver.kind==='absent')return one(receiver)
    // A null receiver throws in the actual VM. It cannot produce an opaque
    // callable or resource that contaminates a guarded finite getter's array.
    if(receiver.kind==='literal'&&receiver.literal===null)return one(absent)
    if(receiver.kind==='native'||receiver.kind==='function'||receiver.kind==='bound'||receiver.kind==='factory-callback'){
      if(names?.size===1){
        const name=[...names][0]!,own=read(field(receiver,name),node)
        if(own.size)return new Set(own)
        if(name==='fn'&&receiver.kind==='native'&&receiver.operation?.returns==='persona-catalog')
          return one(sourceDictionary('jquery-marker',[]))
        if(name==='prototype'&&receiver.kind==='function'){
          const prototype=atom('object',{fields:new Map(),written:new Set()})
          add(field(receiver,name),one(prototype));return one(prototype)
        }
      }
      if(names?.size===1&&['bind','call','apply'].includes([...names][0]!)){
        // Resolve authored own members before using Function.prototype. An
        // empty cell during the first propagation pass is not a missing field.
        if(!functionFallback){functionFallbackReaders.add(node);return new Set()}
        const method=[...names][0]!,id='invoke:'+receiver.id+':'+method
        let found=nativeAtoms.get(id)
        if(!found){found=atom('invoke',{nativeName:method,receiver});nativeAtoms.set(id,found)}
        return one(found)
      }
      if(names?.has('constructor')){
        const id=receiver.id+':Function.code-generation'
        let missing=nativeAtoms.get(id)
        if(!missing){missing=atom('missing',{nativeName:'Function.code-generation'});nativeAtoms.set(id,missing)}
        return one(missing)
      }
      if(!missingFallback){functionFallbackReaders.add(node);return new Set()}
      return one(unknown)
    }
    if(receiver.kind==='object'){
      const selected=names??new Set([...receiver.fields!.keys(),...receiver.realm?
        [...Object.keys(BROWSER_METHODS_V3.window!),...Object.keys(BROWSER_PROPERTIES_V3.window!),
          'document','frameElement','TavernHelper','SillyTavern','Mvu','NextTavern','parent','top','URL','Blob',...Object.keys(constructors)]:[]])
      for(const name of selected){
        const own=read(field(receiver,name),node)
        if(own.size)for(const entry of own)out.add(entry)
        else if(receiver.realm){for(const entry of globalValue(name,receiver,node,true))out.add(entry)}
        else if(receiver.prototypes&&read(receiver.prototypes,node).size){
          for(const prototype of read(receiver.prototypes,node))for(const entry of memberValues(prototype,new Set([name]),node))out.add(entry)
        }
        else if(name==='constructor')out.add(intrinsicValue('Object'))
        else if(read(field(receiver,'*'),node).size)for(const entry of read(field(receiver,'*'),node))out.add(entry)
        else if(receiver.snapshot||receiver.prototypes){
          // A concrete guest object has its own finite writes and prototype
          // graph. Wait for those writes before using its real missing value;
          // minting guest here would permanently contaminate Source caches.
          if(!missingFallback){functionFallbackReaders.add(node);continue}
          if(!receiver.snapshot&&['toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf',
            'propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','__proto__'].includes(name))
            out.add(guest)
          else out.add(receiver.snapshot?fixedAbsent:absent)
        }
        else out.add(guest)
      }
      if(receiver.realm&&!names)out.add(unknown)
      return out
    }
    if(receiver.kind==='array'){
      if(names?.size===1){
        const name=[...names][0]!,own=receiver.fields?.get(name)
        if(own?.values.size)return new Set(read(own,node))
        if(['map','filter','find','forEach','some','every','reduce','push','indexOf'].includes(name))
          return one(combiner(receiver,name))
      }
      if(names&&[...names].every(name=>/^\d+$/.test(name))){
        for(const name of names){
          const own=receiver.fields?.get(name)
          for(const item of read(own??receiver.elements!,node))out.add(item)
        }
        return out
      }
      if(!names)return new Set(read(receiver.elements!,node))
      return one(guest)
    }
    if(receiver.kind==='promise')return names?.size===1&&names.has('then')
      ?one(combiner(receiver,'then')):one(unknown)
    if(receiver.kind==='handle'){
      if(!names&&!BROWSER_CLOSED_DOM_FACADES_V3.includes(receiver.handle!)){
        nativeMemberUnknown.add(node);return one(unknown)
      }
      const selected=names??new Set([...Object.keys(BROWSER_METHODS_V3[receiver.handle!]??{}),
        ...Object.keys(BROWSER_PROPERTIES_V3[receiver.handle!]??{}),...receiver.fields?.keys()??[]])
      for(const name of selected){
        if(guestFieldsOwner(receiver)){
          const own=read(field(receiver,name),node)
          if(own.size){for(const item of own)out.add(item);if(!own.has(absent))continue}
          if(!functionFallback){functionFallbackReaders.add(node);continue}
          if(name.startsWith('on')){out.add(absent);continue}
          const kind=receiver.handle! as 'node'|'frame'|'frame-parent'
          if(guestField(receiver,name)&&!BROWSER_NATIVE_METHODS_V3[kind].includes(name)){
            const prototypes=read(receiver.prototypes!,node)
            if(prototypes.size)for(const prototype of prototypes)
              for(const item of memberValues(prototype,new Set([name]),node))out.add(item)
            else if(name==='constructor')out.add(intrinsicValue('Object'))
            else if(missingFallback)out.add(absent)
            else functionFallbackReaders.add(node)
            continue
          }
        }
        if(receiver.handle==='dataset'){out.add(guest);continue}
        if(receiver.handle==='event'&&['touches','changedTouches'].includes(name)){
          out.add(touchList(receiver,name));continue
        }
        const method=BROWSER_METHODS_V3[receiver.handle!]?.[name]
        if(method){out.add(native(name,method,receiver));continue}
        if(receiver.handle==='persona-catalog'&&/^\d+$/.test(name)){
          out.add(handle('persona-row',receiver.realm!));out.add(absent);continue
        }
        if(receiver.handle==='frame'&&name==='nodeType'){out.add(literal(1));continue}
        if(receiver.handle==='frame'&&name==='contentWindow'){
          // The actual frame owner returns its mounted Source page's same-VM
          // global, or null before mounting. It never exports the Main window.
          if(receiver.pageId)out.add(realm(receiver.pageId))
          for(const location of read(receiver.sources!,node)){
            const sources=location.kind==='url'&&location.sources?read(location.sources,node):one(location)
            for(const source of sources)if(source.kind==='html'&&sourceParents.get(source.pageId!)===receiver.realm)
              out.add(realm(source.pageId!))
          }
          if(!out.size){
            if(!missingFallback){functionFallbackReaders.add(node);continue}
            out.add(literal(null))
          }
          continue
        }
        const property=BROWSER_PROPERTIES_V3[receiver.handle!]?.[name]
        if(property==='event-map'){out.add(sourceDictionary('events',sourceEventFields));continue}
        if(property==='mvu-event-map'){out.add(sourceDictionary('mvu-events',sourceMvuEventFields));continue}
        if(property==='absent'){out.add(fixedAbsent);continue}
        if(property==='missing-mvu-owner'){
          const id=receiver.id+':missing-mvu-owner'
          let missing=nativeAtoms.get(id)
          if(!missing){missing=atom('missing',{nativeName:'Mvu.applyVariable'});nativeAtoms.set(id,missing)}
          out.add(missing);continue
        }
        if(property==='nodes'||property==='files'){
          const array=handleArray(receiver,property==='nodes'?'node':'file');out.add(array);continue}
        if(property==='guest'||property==='guest-object'){out.add(guest);continue}
        if(property){out.add(handle(property as BrowserFacadeKindV3,receiver.realm!));continue}
        // getContext returns a copied ordinary guest snapshot, not a Native
        // receiver that exports guessed host functions for missing fields.
        if(receiver.handle==='context'){out.add(fixedAbsent);continue}
        if(receiver.handle==='window'){
          for(const entry of globalValue(name,realm(receiver.realm!),node,true))out.add(entry);continue}
        // Native objects never turn an arbitrary property into a guessed guest method.
        if(scalarProperty(receiver.handle!,name))out.add(guest)
        else if(BROWSER_ABSENT_PROBES_V3.includes(name))out.add(fixedAbsent)
        else if(missingFallback){out.add(unknown);nativeMemberUnknown.add(node)}
        else functionFallbackReaders.add(node)
      }
      // An unknown selector can also read a scalar DOM property. It does not
      // erase the finite method/handle alternatives above or grant host access.
      if(!names)out.add(guest)
      return out
    }
    if(receiver.kind==='guest'&&receiver.nativeName&&names?.size===1){
      if(names.has('constructor'))return one(intrinsicValue('Function'))
      const name=receiver.nativeName+'.'+[...names][0]!,id='guest:'+name
      let fn=nativeAtoms.get(id)
      if(!fn){fn=atom('guest',{nativeName:name});nativeAtoms.set(id,fn)}
      return one(fn)
    }
    if(receiver.kind==='literal'||receiver.kind==='guest')return one(guest)
    if(receiver.kind==='html')return one(guest)
    return one(unknown)
  }
  const arrays=new Map<string,Atom>()
  function touchList(receiver:Atom,name:string):Atom {
    const id=receiver.id+':'+name
    let list=arrays.get(id)
    if(!list){
      const touch=atom('object',{fields:new Map(),written:new Set(),prototypes:cell(),snapshot:true})
      for(const key of ['identifier','clientX','clientY','pageX','pageY','screenX','screenY','radiusX','radiusY','rotationAngle','force']){
        add(field(touch,key),one(guest));touch.written!.add(key)
      }
      add(field(touch,'target'),one(handle('node',receiver.realm!)));touch.written!.add('target')
      list=atom('array',{fields:new Map(),elements:cell(),written:new Set()});arrays.set(id,list)
      add(list.elements!,one(touch))
    }
    return list
  }
  function combiner(receiver:Atom,name:string):Atom {
    const id='combiner:'+receiver.id+':'+name
    let found=nativeAtoms.get(id)
    if(!found){found=atom('combiner',{receiver,nativeName:name});nativeAtoms.set(id,found)}
    return found
  }
  function handleArray(receiver:Atom,kind:BrowserFacadeKindV3):Atom {
    const id=receiver.id+':'+kind
    let found=arrays.get(id)
    if(!found){found=atom('array',{elements:cell()});arrays.set(id,found)
      add(found.elements!,one(handle(kind,receiver.realm!)))}
    return found
  }
  function scalarProperty(kind:BrowserFacadeKindV3,name:string):boolean {
    const scalar:Partial<Record<BrowserFacadeKindV3,readonly string[]>>={
      node:['id','className','textContent','innerHTML','innerText','src','width','height','alt','value','hidden','disabled',
        'checked','scrollTop','scrollHeight','clientWidth','clientHeight','offsetWidth','offsetHeight','isConnected','nodeType',
        'tagName','type','title','placeholder','href','download','open','selectionStart','selectionEnd','naturalWidth','naturalHeight'],
      event:['type','key','code','keyCode','button','buttons','clientX','clientY','pageX','pageY','pointerId','ctrlKey','shiftKey',
        'altKey','metaKey','isTrusted','persisted','bubbles','cancelable','timeStamp','deltaX','deltaY','deltaMode','defaultPrevented'],
      style:['cssText','display','position','top','left','width','height','opacity','zIndex','transform','overflow','color','length'],
      'frame-style':['cssText','display','position','top','left','width','height','opacity','zIndex','transform',
        'overflow','color','clipPath','pointerEvents','length'],
      frame:['id','isConnected','nodeType'],
      audio:['src','volume','currentTime','duration','paused','ended','loop','preload','readyState'],
      file:['name','type','size'], 'file-reader':['result','error','readyState','onload','onerror'],
      point:['x','y','z','w'],matrix:['a','b','c','d','e','f'],
      navigator:['userAgent','maxTouchPoints','platform'],performance:[],
      viewport:['width','height','offsetTop','offsetLeft','scale'],'media-query':['matches','media'],
      canvas:['font','fillStyle','strokeStyle','lineWidth','textAlign','textBaseline','globalAlpha','canvas'],
    }
    return kind==='dataset'||kind==='style'||(kind==='frame-style')&&/^\d+$/.test(name)||scalar[kind]?.includes(name)===true
  }
  const constructors:Readonly<Record<string,{kind:BrowserFacadeKindV3;capability:BrowserCapabilityV3}>>={
    Audio:{kind:'audio',capability:'owned-page-audio'},FileReader:{kind:'file-reader',capability:'owned-page-file-gesture'},
    DOMPoint:{kind:'point',capability:'owned-page-canvas-svg'},
    MutationObserver:{kind:'observer',capability:'owned-resource-callbacks'},
    ResizeObserver:{kind:'observer',capability:'owned-resource-callbacks'},
    IntersectionObserver:{kind:'observer',capability:'owned-resource-callbacks'},
    Event:{kind:'event',capability:'owned-synchronous-page-events'},CustomEvent:{kind:'event',capability:'owned-synchronous-page-events'},
    MouseEvent:{kind:'event',capability:'owned-synchronous-page-events'},
  }
  function intrinsicValue(name:string):Atom {
    const id='guest:'+name
    let intrinsic=nativeAtoms.get(id)
    if(!intrinsic){intrinsic=atom('guest',{nativeName:name});nativeAtoms.set(id,intrinsic)}
    return intrinsic
  }
  function globalValue(name:string,global:Atom,node:ts.Node,namedProperty=false):Value {
    const state=units.get(node)!,input=state.input
    const own=read(field(global,name),node)
    if(own.size)return new Set(own)
    // Ordinary writable Native exports can be shadowed in the actual guest
    // global. Resolve their authored Cells before adding a fallback alternative.
    if(!globalMissingFallback&&globalOwnWrites.get(global.realm!)?.has(name)){
      functionFallbackReaders.add(node);return new Set()
    }
    if(namedProperty&&BROWSER_SERVER_GLOBALS_V3.includes(name)){
      const names=serverNativeReads.get(node)??new Set<string>()
      names.add(name);serverNativeReads.set(node,names)
      return one(unknown)
    }
    if(name==='window'||name==='globalThis')return one(global)
    if(name==='parent'||name==='top')return one(realm(input.parentRealm))
    if(name==='document')return one(handle('document',global.realm!))
    if(name==='frameElement'){
      const owner=realmInputs.get(global.realm!)
      return one(handle('frame',owner?.parentRealm??input.parentRealm,false,owner?.pageId??undefined))
    }
    if(name==='TavernHelper')return one(handle('helper',global.realm!))
    if(name==='SillyTavern')return one(handle('tavern',global.realm!))
    if(name==='Mvu')return one(handle('mvu',global.realm!))
    if(name==='NextTavern')return one(handle('next-tavern',global.realm!))
    if(name==='localStorage')return one(handle('preferences',global.realm!))
    if(name==='URL')return one(handle('url',global.realm!))
    if(name==='navigator')return one(handle('navigator',global.realm!))
    if(name==='performance')return one(handle('performance',global.realm!))
    if(name==='visualViewport')return one(handle('viewport',global.realm!))
    if(name==='event_types'||name==='tavern_events')return one(sourceDictionary('events',sourceEventFields))
    if(BROWSER_GUEST_INTRINSICS_V3.includes(name)){
      if(name==='undefined')return one(absent)
      return one(intrinsicValue(name))
    }
    if(BROWSER_ABSENT_PROBES_V3.includes(name)||name==='location')return one(fixedAbsent)
    if(name==='Blob')return one(native('Blob',{capability:'owned-media',returns:'guest'},global))
    if(constructors[name])return one(native(name,{capability:constructors[name]!.capability,returns:constructors[name]!.kind},global))
    const operation=BROWSER_METHODS_V3.window?.[name]
    if(operation)return one(native(name,operation,global))
    if(BROWSER_PROPERTIES_V3.window?.[name]==='guest'||['innerWidth','innerHeight','devicePixelRatio'].includes(name))return one(guest)
    if(!globalMissingFallback){functionFallbackReaders.add(node);return new Set()}
    return one(namedProperty?absent:unknown)
  }
  function bindPattern(name:ts.BindingName,incoming:Value,node:ts.Node):void {
    const scope=scopes.get(node)!,todo:{name:ts.BindingName;items:Value}[]=[{name,items:incoming}]
    while(todo.length){const entry=todo.pop()!
      if(ts.isIdentifier(entry.name)){const target=lookup(scope,entry.name.text);if(target)add(target,entry.items)}
      else for(let index=0;index<entry.name.elements.length;index++){
        const part=entry.name.elements[index]!
        if(!ts.isBindingElement(part))continue
        const selected=part.propertyName?key(part.propertyName,node):ts.isObjectBindingPattern(entry.name)&&ts.isIdentifier(part.name)
          ?new Set([part.name.text]):new Set([String(index)])
        const items:Value=new Set()
        for(const owner of entry.items)for(const item of memberValues(owner,selected,node))items.add(item)
        todo.push({name:part.name,items})
      }
    }
  }
  function object(node:ts.Node,array=false):Atom {
    let found=objects.get(node)
    if(!found){found=atom(array?'array':'object',{fields:new Map(),written:new Set(),
      ...array?{elements:cell()}: {prototypes:cell()}});objects.set(node,found)}
    return found
  }
  /** Keep boundary references through unmodeled guest results. This is a
   * conservative alias set, not an interpretation of reflection or class code. */
  function boundaryReferences(items:Iterable<Atom>,node:ts.Node):Value {
    const result:Value=new Set(),todo=[...items],seen=new Set<Atom>()
    while(todo.length){
      const item=todo.pop()!
      if(seen.has(item))continue
      seen.add(item)
      // A guest function argument is not the unknown operation's return
      // callee. Its known returned Native/Source DATA still remains below.
      if(['native','handle','missing','blob','url','html'].includes(item.kind)
        ||(item.kind==='choice'||item.kind==='factory-callback')&&nativeFunction(item)
        ||item.kind==='bound'&&nativeFunction(item)||item.kind==='invoke'&&nativeFunction(item.receiver!))result.add(item)
      for(const target of item.fields?.values()??[])todo.push(...read(target,node))
      for(const target of [item.elements,item.prototypes,item.returns,item.sources])if(target)todo.push(...read(target,node))
      if((item.kind==='bound'||item.kind==='invoke')&&item.receiver)todo.push(item.receiver)
      if(item.kind==='bound')for(const target of item.params??[])todo.push(...read(target,node))
      for(const target of item.choices?.values()??[])todo.push(...read(target,node))
      if(item.callbackTargets)todo.push(...read(item.callbackTargets,node))
      for(const target of item.callback?.captures.values()??[])todo.push(...target)
    }
    return result
  }
  const unknownHolders=new Map<ts.Node,Atom>()
  function unknownResult(args:readonly Value[],node:ts.Node):Value {
    const references=boundaryReferences(args.flatMap(items=>[...items]),node),result=one(unknown)
    if(references.size){
      let holder=unknownHolders.get(node)
      if(!holder){holder=atom('object',{fields:new Map(),written:new Set()});unknownHolders.set(node,holder)}
      add(field(holder,'*'),[unknown,...references]);holder.written!.add('*')
      result.add(holder)
      for(const reference of references)result.add(reference)
    }
    return result
  }
  function defineProperty(target:Atom,selected:Set<string>|undefined,descriptors:Value,node:ts.Node):void {
    const incoming:Value=new Set()
    for(const descriptor of descriptors){
      if(descriptor.fields){
        for(const item of read(field(descriptor,'value'),node))incoming.add(item)
        const accessors=[...read(field(descriptor,'get'),node),...read(field(descriptor,'set'),node)]
        if(accessors.length){incoming.add(unknown);for(const item of boundaryReferences(accessors,node))incoming.add(item)}
      }else incoming.add(unknown)
    }
    if(!selected){incoming.add(unknown);selected=new Set(['*'])}
    for(const name of selected){add(field(target,name),incoming);target.written?.add(name)}
  }
  function reflection(name:string,args:readonly Value[],node:ts.Node):Value|undefined {
    if(['Object.freeze','Object.seal','Object.preventExtensions'].includes(name))return args[0]??one(unknown)
    if(name==='Object')return args[0]?.size?new Set(args[0]):one(object(node))
    if(name==='Object.create'){
      const result=object(node)
      add(result.prototypes!,args[0]??one(absent))
      if(args[1])for(const descriptors of args[1])if(descriptors.fields)
        for(const [key,incoming] of descriptors.fields)defineProperty(result,new Set([key]),read(incoming,node),node)
      return one(result)
    }
    if(['Object.defineProperty','Object.defineProperties','Object.setPrototypeOf'].includes(name)){
      const result:Value=new Set()
      for(const target of args[0]??[]){
        if(!target.fields){for(const item of unknownResult(args,node))result.add(item);continue}
        if(name==='Object.setPrototypeOf'&&target.prototypes)add(target.prototypes,args[1]??one(unknown))
        else if(name==='Object.defineProperty')defineProperty(target,names(args[1]??new Set()),args[2]??one(unknown),node)
        else if(name==='Object.defineProperties')for(const descriptors of args[1]??[])if(descriptors.fields)
          for(const [key,incoming] of descriptors.fields)defineProperty(target,new Set([key]),read(incoming,node),node)
        result.add(target)
      }
      return result.size?result:unknownResult(args,node)
    }
    if(name.startsWith('Object.'))return unknownResult(args,node)
    return undefined
  }
  function callGuest(fn:Atom,args:readonly Value[],node:ts.Node,receiver?:Value):Value {
    for(let i=0;i<fn.params!.length;i++){
      const parameter=fn.fn!.parameters[i]!
      let incoming=args[i]??one(absent)
      if(parameter.dotDotDotToken){
        const rest=object(parameter,true)
        for(let index=i;index<args.length;index++){
          add(rest.elements!,args[index]!)
          add(field(rest,String(index-i)),args[index]!);rest.written!.add(String(index-i))
        }
        incoming=one(rest)
      }else if(parameter.initializer){
        const result:Value=new Set()
        for(const item of incoming)if(item.kind==='absent'){
          for(const initial of value(parameter.initializer,node))result.add(initial)
        }else result.add(item)
        incoming=result
      }
      add(fn.params![i]!,incoming)
      if(!ts.isIdentifier(parameter.name))bindPattern(parameter.name,new Set(read(fn.params![i]!,node)),parameter)
    }
    if(!ts.isArrowFunction(fn.fn!))add(fn.thisValue!,receiver??one(scopes.get(node)!.global))
    return new Set(read(fn.returns!,node))
  }
  const factoryPlans=new Map<Atom,FactoryPlan|null>(),buildingFactories=new Set<Atom>()
  const factoryChoices=new Map<ts.CallExpression,Map<Atom,Map<string,Atom>>>()
  const factoryCallbacks=new Map<Atom,Map<ts.Node,Atom>>()
  const factoryArrays=new Map<Atom,Map<ts.Node,Atom>>()
  const factoryInstances=new Map<Atom,Map<string,Atom>>()
  const factoryBounds=new Map<Atom,Map<ts.CallExpression,Map<Atom,Atom>>>()
  const resolvingFactories=new Set<Atom>()
  interface GetterPlan {readonly calls:readonly ts.CallExpression[];readonly arrays:ReadonlySet<ts.ArrayLiteralExpression>}
  const getterPlans=new Map<Atom,GetterPlan|null>()
  function getterPlan(fn:Atom):GetterPlan|null {
    if(getterPlans.has(fn))return getterPlans.get(fn)!
    const declaration=fn.fn!
    if(declaration.parameters.length||!declaration.body){getterPlans.set(fn,null);return null}
    const calls:ts.CallExpression[]=[],arrays=new Set<ts.ArrayLiteralExpression>(),todo:ts.Node[]=[declaration.body]
    let valid=true
    while(todo.length){const node=todo.pop()!
      if(node!==declaration.body&&callable(node))continue
      if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isArrayLiteralExpression(node.initializer))arrays.add(node.initializer)
      if(node.kind===ts.SyntaxKind.ThisKeyword||ts.isNewExpression(node)||ts.isAwaitExpression(node)||ts.isYieldExpression(node)
        ||ts.isDeleteExpression(node))valid=false
      if(ts.isBinaryExpression(node)&&assignment(node))
        if(!ts.isIdentifier(node.left)||bindingScope(node,node.left.text)?.fn!==fn)valid=false
      if((ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))
        &&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator))
        if(!ts.isIdentifier(node.operand)||bindingScope(node,node.operand.text)?.fn!==fn)valid=false
      if(ts.isCallExpression(node))calls.push(node)
      ts.forEachChild(node,child=>{todo.push(child)})
    }
    const result=valid?{calls,arrays}:null
    getterPlans.set(fn,result);return result
  }
  function getterSummary(fn:Atom,node:ts.Node,active=new Set<Atom>()):FactoryEvaluation|undefined {
    const plan=getterPlan(fn)
    if(!plan||active.has(fn))return undefined
    active.add(fn)
    let pending=false,pure=true
    for(const call of plan.calls){
      const targets=read(nodeCell(call.expression),node)
      if(!targets.size){pending=true;continue}
      for(const target of targets){
        if(target.kind==='function'&&!call.arguments.length){
          const summary=getterSummary(target,node,active)
          if(!summary)pure=false
          else {pure&&=summary.pure;pending||=summary.pending}
        }else if(target.kind==='combiner'&&['push','indexOf'].includes(target.nativeName!)
          &&[...plan.arrays].some(array=>objects.get(array)===target.receiver)){
          // These operations only read/update this getter's private guest
          // array. Its real element Cells are maintained by combine below.
        }else pure=false
      }
    }
    active.delete(fn)
    return {values:new Set(read(fn.returns!,node)),pure,pending}
  }
  function getterCallSummary(call:ts.CallExpression,node:ts.Node):FactoryEvaluation {
    const targets=read(nodeCell(call.expression),node),result:Value=new Set()
    let pure=true,pending=!targets.size
    for(const target of targets){
      const summary=target.kind==='function'?getterSummary(target,node):undefined
      if(!summary)pure=false
      else {for(const item of summary.values)result.add(item);pure&&=summary.pure;pending||=summary.pending}
    }
    return {values:result,pure,pending}
  }
  function choiceValues(items:Value,node:ts.Node):Value {
    const result:Value=new Set(),todo=[...items],seen=new Set<Atom>()
    while(todo.length){const item=todo.pop()!
      if(seen.has(item))continue
      seen.add(item)
      if(item.kind==='choice')for(const target of item.choices!.values())todo.push(...read(target,node))
      else result.add(item)
    }
    return result
  }
  function factoryPlan(fn:Atom):FactoryPlan|null {
    if(factoryPlans.has(fn))return factoryPlans.get(fn)!
    if(buildingFactories.has(fn))return null
    buildingFactories.add(fn)
    const declaration=fn.fn!,bindings=new Map<Cell,ts.Expression[]>(),returns:ts.Expression[]=[],calls:ts.CallExpression[]=[]
    const nodes=declaration.body?[declaration.body] as ts.Node[]:[],local=new Set<Cell>(fn.params),writesToParameters=new Set<Cell>()
    let pure=true,selected=false,unsupported=false
    while(nodes.length){const current=nodes.pop()!
      if(current!==declaration.body&&callable(current))continue
      if(ts.isVariableDeclaration(current)&&ts.isIdentifier(current.name)){
        const target=lookup(scopes.get(current)!,current.name.text)!
        local.add(target)
        if(current.initializer){const list=bindings.get(target)??[];list.push(current.initializer);bindings.set(target,list)}
      }
      if(ts.isBinaryExpression(current)&&assignment(current)){
        if(ts.isIdentifier(current.left)){
          const target=lookup(scopes.get(current)!,current.left.text)
          if(target&&bindingScope(current,current.left.text)?.fn===fn){
            if(fn.params!.includes(target))writesToParameters.add(target)
            const list=bindings.get(target)??[];list.push(current.right);bindings.set(target,list)
          }else pure=false
        }else pure=false
      }
      if(ts.isPrefixUnaryExpression(current)||ts.isPostfixUnaryExpression(current)){
        const operand=current.operand
        if([ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(current.operator)
          &&(!ts.isIdentifier(operand)||bindingScope(current,operand.text)?.fn!==fn))pure=false
        if(ts.isIdentifier(operand)){
          const target=lookup(scopes.get(current)!,operand.text)
          if(target&&fn.params!.includes(target))writesToParameters.add(target)
        }
      }
      if(ts.isCallExpression(current))calls.push(current)
      if(ts.isAwaitExpression(current)||ts.isYieldExpression(current)||ts.isNewExpression(current))pure=false
      if(ts.isReturnStatement(current)&&current.expression)returns.push(current.expression)
      ts.forEachChild(current,child=>{nodes.push(child)})
    }
    if(ts.isArrowFunction(declaration)&&!ts.isBlock(declaration.body))returns.push(declaration.body)
    const dependent=(expression:ts.Expression,seen=new Set<Cell>()):boolean=>{
      if(ts.isIdentifier(expression)){
        const target=lookup(scopes.get(expression)!,expression.text)
        if(target===fn.params?.[0])return true
        if(target&&bindings.has(target)&&!seen.has(target)){
          seen.add(target);return bindings.get(target)!.some(item=>dependent(item,seen))
        }
      }
      return false
    }
    const buildRecipe=(expression:ts.Expression):FactoryRecipe|undefined=>{
      if(ts.isParenthesizedExpression(expression))return recipe(expression.expression)
      if(ts.isIdentifier(expression)){
        const binding=lookup(scopes.get(expression)!,expression.text)
        return binding&&(local.has(binding)||bindings.has(binding))?{kind:'binding',binding,expression}
          :{kind:'existing',expression}
      }
      if(ts.isPropertyAccessExpression(expression)||ts.isElementAccessExpression(expression)){
        const receiver=recipe(expression.expression)
        const selector=ts.isPropertyAccessExpression(expression)?expression.name.text:recipe(expression.argumentExpression)
        if(ts.isElementAccessExpression(expression)&&dependent(expression.argumentExpression))selected=true
        return receiver&&selector?{kind:'member',node:expression,receiver,selector}:undefined
      }
      if(ts.isConditionalExpression(expression)){
        const yes=recipe(expression.whenTrue),no=recipe(expression.whenFalse)
        const guard=buildGuard(expression.condition)
        return yes&&no?{kind:'union',recipes:guard?
          [{kind:'guarded',guards:[{recipe:guard,truthy:true}],recipe:yes},
            {kind:'guarded',guards:[{recipe:guard,truthy:false}],recipe:no}]:[yes,no]}:undefined
      }
      if(ts.isBinaryExpression(expression)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)){
        const left=recipe(expression.left),right=recipe(expression.right)
        return left&&right?{kind:'union',recipes:[left,right]}:undefined
      }
      if(ts.isCallExpression(expression)){
        const target=recipe(expression.expression),args=expression.arguments.map(argument=>({
          recipe:recipe(ts.isSpreadElement(argument)?argument.expression:argument),spread:ts.isSpreadElement(argument)}))
        if(expression.arguments[0]&&dependent(expression.arguments[0]))selected=true
        return target&&args.every(item=>item.recipe)?{kind:'call',node:expression,target,
          args:args as {recipe:FactoryRecipe;spread:boolean}[]}:undefined
      }
      if(ts.isArrowFunction(expression)||ts.isFunctionExpression(expression)){
        const body=expression.body
        let forwarded:ts.Expression|undefined
        if(ts.isBlock(body)&&body.statements.length===1){const statement=body.statements[0]!
          forwarded=ts.isReturnStatement(statement)?statement.expression:ts.isExpressionStatement(statement)?statement.expression:undefined
        }else if(!ts.isBlock(body))forwarded=body
        if(!forwarded||!ts.isCallExpression(forwarded)||expression.modifiers?.some(item=>item.kind===ts.SyntaxKind.AsyncKeyword)
          ||ts.isFunctionExpression(expression)&&expression.asteriskToken)return undefined
        for(const target of functions.get(expression)!.params!)local.add(target)
        const forwardedRecipe=recipe(forwarded)
        return forwardedRecipe?{kind:'callback',node:expression,recipe:forwardedRecipe}:undefined
      }
      // An unmodeled expression may be reused only when it does not consume a
      // factory local. Otherwise skipping callGuest would lose its real aliases.
      const pending:ts.Node[]=[expression]
      while(pending.length){const part=pending.pop()!
        if(ts.isIdentifier(part)&&!namePosition(part)){
          const binding=lookup(scopes.get(part)!,part.text)
          if(binding&&local.has(binding))return undefined
        }
        if(part.kind===ts.SyntaxKind.ThisKeyword)return undefined
        ts.forEachChild(part,child=>{pending.push(child)})
      }
      return {kind:'existing',expression}
    }
    const recipe=(expression:ts.Expression):FactoryRecipe|undefined=>{
      const existing=aliasRecipes.get(expression)
      if(existing)return existing
      const built=buildRecipe(expression)
      if(built)aliasRecipes.set(expression,built)
      return built
    }
    const buildGuard=(expression:ts.Expression):FactoryGuard|undefined=>{
      if(ts.isParenthesizedExpression(expression))return buildGuard(expression.expression)
      if(ts.isPrefixUnaryExpression(expression)&&expression.operator===ts.SyntaxKind.ExclamationToken){
        const nested=buildGuard(expression.operand);return nested?{kind:'not',recipe:nested}:undefined
      }
      if(ts.isBinaryExpression(expression)){
        if(expression.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken){
          const left=buildGuard(expression.left),right=buildGuard(expression.right)
          return left&&right?{kind:'and',left,right}:undefined
        }
        if([ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken].includes(expression.operatorToken.kind))
          for(const [left,right] of [[expression.left,expression.right],[expression.right,expression.left]] as const)
            if(ts.isTypeOfExpression(left)&&ts.isStringLiteral(right)&&right.text==='function'){
              const target=recipe(left.expression);return target?{kind:'callable',recipe:target}:undefined
            }
      }
      const target=recipe(expression)
      return target?{kind:'truth',recipe:target}:undefined
    }
    const output=returns.map(expression=>{
      const result=recipe(expression)
      if(!result)return undefined
      const guards:{recipe:FactoryGuard;truthy:boolean}[]=[]
      for(let current:ts.Node=expression;current.parent&&current.parent!==declaration;current=current.parent){
        const parent=current.parent
        if(ts.isIfStatement(parent)&&(current===parent.thenStatement||current===parent.elseStatement)){
          const guard=buildGuard(parent.expression)
          if(guard)guards.unshift({recipe:guard,truthy:current===parent.thenStatement})
        }
      }
      return guards.length?{kind:'guarded' as const,guards,recipe:result}:result
    })
    // Every local alias has one finite definition graph. Parameter reassignment
    // is not an unchanged selector, even when the shared Cell has matching keys.
    for(const expressions of bindings.values())for(const expression of expressions)if(!recipe(expression))unsupported=true
    const getterCalls:ts.CallExpression[]=[]
    for(const call of calls)
      if(ts.isPropertyAccessExpression(call.expression)&&call.expression.name.text==='bind')continue
      else if(!call.arguments.length&&ts.isIdentifier(call.expression))getterCalls.push(call)
      else pure=false
    if(!declaration.parameters.length||!selected||writesToParameters.size>0
      ||output.some(item=>!item)||!returns.length)unsupported=true
    const plan:FactoryPlan|null=unsupported?null:{fn,bindings,returns:output as FactoryRecipe[],getterCalls,pure}
    factoryPlans.set(fn,plan);buildingFactories.delete(fn)
    return plan
  }
  interface FactoryEvaluation {readonly values:Value;readonly pure:boolean;readonly pending:boolean}
  function evaluateFactoryRecipe(recipe:FactoryRecipe,plan:FactoryPlan,context:Map<Cell,Value>,node:ts.Node,
    instance:Atom,active=new Set<Cell>(),refinements=new Map<string,Value>()):FactoryEvaluation {
    const merge=(items:readonly FactoryEvaluation[]):FactoryEvaluation=>({
      values:new Set(items.flatMap(item=>[...item.values])),pure:items.every(item=>item.pure),pending:items.some(item=>item.pending)})
    const evaluate=(next:FactoryRecipe)=>evaluateFactoryRecipe(next,plan,context,node,instance,active,refinements)
    if(recipe.kind==='existing'){
      const binding=ts.isIdentifier(recipe.expression)?lookup(scopes.get(recipe.expression)!,recipe.expression.text):undefined
      return {values:binding&&context.has(binding)?context.get(binding)!:new Set(value(recipe.expression,node)),pure:true,pending:false}
    }
    if(recipe.kind==='guarded'){
      const refinedContext=new Map(context),refinedMembers=new Map(refinements)
      let pure=true,pending=false,feasible=true
      const narrowed=(guard:FactoryGuard,wanted:boolean):boolean=>{
        if(guard.kind==='not')return narrowed(guard.recipe,!wanted)
        if(guard.kind==='and'){
          // The false branch is a union of failed operands; keep it broad.
          return !wanted||narrowed(guard.left,true)&&narrowed(guard.right,true)
        }
        const result=evaluateFactoryRecipe(guard.recipe,plan,refinedContext,node,instance,active,refinedMembers)
        pure&&=result.pure;pending||=result.pending||!result.values.size
        const keep=(item:Atom):boolean=>{
          const actual=guard.kind==='truth'?truth(one(item)):
            ['function','native','bound','invoke','combiner','choice','factory-callback'].includes(item.kind)?true:
              ['absent','literal','object','array','handle','blob','url','html','promise'].includes(item.kind)?false:undefined
          return actual===undefined||actual===wanted
        }
        const selected=new Set([...result.values].filter(keep))
        if(guard.recipe.kind==='binding')refinedContext.set(guard.recipe.binding,selected)
        else if(guard.recipe.kind==='existing'&&ts.isIdentifier(guard.recipe.expression)){
          const binding=lookup(scopes.get(guard.recipe.expression)!,guard.recipe.expression.text)
          if(binding)refinedContext.set(binding,selected)
        }else if(guard.recipe.kind==='member'){
          const member=guard.recipe,owners=evaluateFactoryRecipe(member.receiver,plan,refinedContext,node,instance,active,refinedMembers)
          const keys=typeof member.selector==='string'?new Set([member.selector]):names(
            evaluateFactoryRecipe(member.selector,plan,refinedContext,node,instance,active,refinedMembers).values)
          if(keys)for(const owner of choiceValues(owners.values,node))for(const key of keys){
            const incoming=memberValues(owner,new Set([key]),member.node)
            refinedMembers.set(owner.id+':'+key,new Set([...incoming].filter(keep)))
          }
        }
        return !!selected.size||pending
      }
      for(const guard of recipe.guards)if(!narrowed(guard.recipe,guard.truthy)){feasible=false;break}
      if(!feasible)return {values:new Set(),pure,pending}
      const result=evaluateFactoryRecipe(recipe.recipe,plan,refinedContext,node,instance,active,refinedMembers)
      return {values:result.values,pure:pure&&result.pure,pending:pending||result.pending}
    }
    if(recipe.kind==='binding'){
      const captured=context.get(recipe.binding)
      if(captured)return {values:captured,pure:true,pending:false}
      const definitions=plan.bindings.get(recipe.binding)
      if(!definitions||active.has(recipe.binding))return {values:new Set(read(recipe.binding,node)),pure:false,pending:false}
      active.add(recipe.binding)
      const results=definitions.map(expression=>{
        // Alias expressions are parsed once below; their Cells remain AST-owned.
        const alias=aliasRecipes.get(expression)
        return alias?evaluate(alias):{values:new Set(value(expression,node)),pure:false,pending:false}
      })
      active.delete(recipe.binding)
      return merge(results)
    }
    if(recipe.kind==='union')return merge(recipe.recipes.map(evaluate))
    if(recipe.kind==='member'){
      const receiver=evaluate(recipe.receiver),selector=typeof recipe.selector==='string'
        ?{values:one(literal(recipe.selector)),pure:true,pending:false}:evaluate(recipe.selector)
      const selectedNames=names(selector.values),result:Value=new Set()
      if(!selectedNames&&!selector.values.size)return {values:result,pure:false,pending:true}
      for(const owner of choiceValues(receiver.values,node)){
        if(selectedNames)for(const name of selectedNames)
          for(const item of refinements.get(owner.id+':'+name)??memberValues(owner,new Set([name]),recipe.node))result.add(item)
        else for(const item of memberValues(owner,selectedNames,recipe.node))result.add(item)
      }
      return {values:result,pure:receiver.pure&&selector.pure,pending:receiver.pending||selector.pending}
    }
    if(recipe.kind==='callback'){
      let callbacks=factoryCallbacks.get(instance)
      if(!callbacks){callbacks=new Map();factoryCallbacks.set(instance,callbacks)}
      let callback=callbacks.get(recipe.node)
      if(!callback){callback=atom('factory-callback',{fn:recipe.node,fields:new Map(),written:new Set(),callbackTargets:cell(),
        callback:{recipe:recipe.recipe,captures:new Map(),plan}});callbacks.set(recipe.node,callback)}
      for(const [binding,incoming] of context){const stored=callback.callback!.captures.get(binding)??new Set()
        for(const item of incoming)stored.add(item);callback.callback!.captures.set(binding,stored)}
      if(recipe.recipe.kind==='call')add(callback.callbackTargets!,evaluate(recipe.recipe.target).values)
      return {values:one(callback),pure:true,pending:false}
    }
    const target=evaluate(recipe.target),argumentResults=recipe.args.map(argument=>evaluate(argument.recipe))
    const args:Value[]=[]
    let pending=target.pending||argumentResults.some(item=>item.pending),pure=target.pure
    for(let index=0;index<recipe.args.length;index++){
      const result=argumentResults[index]!
      if(recipe.args[index]!.spread){const expanded=applyArguments(result.values,node)
        if(!expanded)return {values:unknownResult([target.values,...argumentResults.map(item=>item.values)],node),pure:false,pending}
        args.push(...expanded)
      }else args.push(result.values)
      pure&&=result.pure
    }
    const result:Value=new Set()
    for(const fn of target.values){
      if(fn.kind==='invoke'&&fn.nativeName==='bind'){
        let byNode=factoryBounds.get(instance)
        if(!byNode){byNode=new Map();factoryBounds.set(instance,byNode)}
        let byTarget=byNode.get(recipe.node)
        if(!byTarget){byTarget=new Map();byNode.set(recipe.node,byTarget)}
        let bound=byTarget.get(fn.receiver!)
        if(!bound){bound=atom('bound',{receiver:fn.receiver!,boundOrigin:recipe.node,
          params:args.slice(1).map(()=>cell()),boundPrefixUnproven:cell(),
          thisValue:cell(),fields:new Map(),written:new Set()});byTarget.set(fn.receiver!,bound)}
        if(bound.params!.length!==Math.max(0,args.length-1))add(bound.boundPrefixUnproven!,one(unknown))
        add(bound.thisValue!,args[0]??one(absent))
        for(let i=0;i<bound.params!.length;i++)add(bound.params![i]!,args[i+1]??one(absent))
        result.add(bound)
      }else if(fn.kind==='function'){
        const getter=!args.length?getterSummary(fn,node):undefined
        if(getter){
          for(const item of getter.values)result.add(item)
          pure&&=getter.pure;pending||=getter.pending
          if(!getter.pure)for(const item of invokeFunction(fn,args,recipe.node))result.add(item)
          continue
        }
        const resolved=resolver(fn,args,recipe.node)
        if(resolved){for(const item of resolved.values)result.add(item);pure&&=resolved.pure;pending||=resolved.pending}
        else {for(const item of invokeFunction(fn,args,recipe.node))result.add(item);pure=false}
      }else if(fn.kind==='invoke'&&(fn.nativeName==='call'||fn.nativeName==='apply')){
        const forwarded=fn.nativeName==='call'?args.slice(1):args.length<2?[]:applyArguments(args[1]!,node)
        if(forwarded){
          if(fn.receiver!.kind==='function'){
            const resolved=resolver(fn.receiver!,forwarded,recipe.node)
            if(resolved){for(const item of resolved.values)result.add(item);pure&&=resolved.pure;pending||=resolved.pending;continue}
          }
          for(const item of invokeFunction(fn.receiver!,forwarded,recipe.node,args[0]))result.add(item)
        }else for(const item of unknownResult([one(fn),...args],node))result.add(item)
        pure=false
      }else if(fn.kind==='absent')result.add(absent)
      else {for(const item of invokeFunction(fn,args,recipe.node))result.add(item);pure=false}
    }
    if(!target.values.size){pending=true;functionFallbackReaders.add(node)}
    return {values:result,pure,pending}
  }
  const aliasRecipes=new Map<ts.Expression,FactoryRecipe>()
  function resolver(fn:Atom,args:readonly Value[],node:ts.Node,selectorExpression?:ts.Expression):FactoryEvaluation|undefined {
    if(!ts.isCallExpression(node)||resolvingFactories.has(fn))return undefined
    const plan=factoryPlan(fn)
    if(!plan)return undefined
    const selected=names(args[0]??new Set())
    if(!selected)return args[0]?.size?undefined:{values:new Set(),pure:plan.pure,pending:true}
    let choices=factoryChoices.get(node)
    if(!choices){choices=new Map();factoryChoices.set(node,choices)}
    let bySelection=choices.get(fn)
    if(!bySelection){bySelection=new Map();choices.set(fn,bySelection)}
    const selectionKey=JSON.stringify([...selected].sort())
    let choice=bySelection.get(selectionKey)
    if(!choice){choice=atom('choice',{fields:new Map(),written:new Set(),choices:new Map(),choicePure:cell(),
      choiceSelector:selectorExpression??node.arguments[0],choiceProducer:node});bySelection.set(selectionKey,choice)}
    resolvingFactories.add(fn)
    const result:Value=new Set(),evaluations:FactoryEvaluation[]=plan.getterCalls.map(call=>getterCallSummary(call,node))
    for(const name of selected){
      let instances=factoryInstances.get(choice)
      if(!instances){instances=new Map();factoryInstances.set(choice,instances)}
      let instance=instances.get(name)
      if(!instance){instance=atom('object',{fields:new Map()});instances.set(name,instance)}
      const context=new Map<Cell,Value>(fn.params!.map((binding,index)=>[binding,index===0?one(literal(name)):args[index]??one(absent)]))
      const resolved=plan.returns.map(recipe=>evaluateFactoryRecipe(recipe,plan,context,node,instance!))
      evaluations.push(...resolved)
      const callableValues:Value=new Set()
      for(const item of choiceValues(new Set(resolved.flatMap(row=>[...row.values])),node)){
        if(['native','function','bound','factory-callback'].includes(item.kind))callableValues.add(item)
        else result.add(item)
      }
      if(callableValues.size){let target=choice.choices!.get(name)
        if(!target){target=cell();choice.choices!.set(name,target)}
        add(target,callableValues);result.add(choice)}
    }
    resolvingFactories.delete(fn)
    const pending=evaluations.some(item=>item.pending),pure=plan.pure&&evaluations.every(item=>item.pure)
    if(!pending)add(choice.choicePure!,one(literal(pure)))
    return {values:result,pure,pending}
  }
  const bindingChanges=new Map<Cell,ts.Node[]>(),constantBindings=new Map<Cell,ts.VariableDeclaration>()
  const emptyChoiceCell=cell()
  function registerBindingWrites(state:UnitState):void {for(const node of state.nodes){
    let name:ts.Identifier|undefined
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
      const binding=lookup(scopes.get(node)!,node.name.text)!
      if(ts.isVariableDeclarationList(node.parent)&&node.parent.flags&ts.NodeFlags.Const)constantBindings.set(binding,node)
      if(node.initializer)name=node.name
    }else if(ts.isBinaryExpression(node)&&assignment(node)&&ts.isIdentifier(node.left))name=node.left
    else if((ts.isPrefixUnaryExpression(node)||ts.isPostfixUnaryExpression(node))
      &&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(node.operator)&&ts.isIdentifier(node.operand))name=node.operand
    if(name){const binding=lookup(scopes.get(node)!,name.text)
      if(binding){const list=bindingChanges.get(binding)??[];list.push(node);bindingChanges.set(binding,list)}}
  }}
  for(const state of states)registerBindingWrites(state)
  const truthfulReads=new Map<ts.Identifier,boolean>()
  function requiresTruthyRead(identifier:ts.Identifier,binding:Cell):boolean {
    const known=truthfulReads.get(identifier)
    if(known!==undefined)return known
    const changes=bindingChanges.get(binding)
    if(changes?.length!==1||!ts.isVariableDeclaration(changes[0]!)||!changes[0]!.initializer
      ||bindingScope(identifier,identifier.text)?.fn!==scopes.get(identifier)!.fn){
      truthfulReads.set(identifier,false);return false
    }
    const positive=(expression:ts.Expression,wanted:boolean):boolean=>{
      if(ts.isParenthesizedExpression(expression))return positive(expression.expression,wanted)
      if(ts.isIdentifier(expression))return wanted&&lookup(scopes.get(expression)!,expression.text)===binding
      if(ts.isPrefixUnaryExpression(expression)&&expression.operator===ts.SyntaxKind.ExclamationToken)
        return positive(expression.operand,!wanted)
      if(ts.isBinaryExpression(expression)
        &&(wanted&&expression.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken
          ||!wanted&&expression.operatorToken.kind===ts.SyntaxKind.BarBarToken))
        return positive(expression.left,wanted)||positive(expression.right,wanted)
      return false
    }
    const exits=(statement:ts.Statement):boolean=>ts.isReturnStatement(statement)
      ||ts.isBlock(statement)&&!!statement.statements.length&&ts.isReturnStatement(statement.statements.at(-1)!)
    let required=false
    for(let child:ts.Node=identifier;child.parent&&!callable(child.parent);child=child.parent){
      const parent=child.parent
      if(ts.isIfStatement(parent)){
        if(child===parent.thenStatement&&positive(parent.expression,true)
          ||child===parent.elseStatement&&positive(parent.expression,false)){required=true;break}
      }else if(ts.isConditionalExpression(parent)){
        if(child===parent.whenTrue&&positive(parent.condition,true)
          ||child===parent.whenFalse&&positive(parent.condition,false)){required=true;break}
      }else if(ts.isBinaryExpression(parent)&&child===parent.right
        &&(parent.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&positive(parent.left,true)
          ||parent.operatorToken.kind===ts.SyntaxKind.BarBarToken&&positive(parent.left,false))){required=true;break}
      else if(ts.isBlock(parent)){
        for(const statement of parent.statements){
          if(statement===child)break
          if(ts.isIfStatement(statement)
            &&(exits(statement.thenStatement)&&positive(statement.expression,false)
              ||statement.elseStatement&&exits(statement.elseStatement)&&positive(statement.expression,true))){required=true;break}
        }
        if(required)break
      }
    }
    truthfulReads.set(identifier,required);return required
  }
  function selectorBinding(expression:ts.Expression):{binding:Cell;readAt:ts.Expression}|undefined {
    const seen=new Set<Cell>()
    while(true){
      while(ts.isParenthesizedExpression(expression))expression=expression.expression
      if(!ts.isIdentifier(expression))return undefined
      const binding=lookup(scopes.get(expression)!,expression.text)
      if(!binding||seen.has(binding))return undefined
      seen.add(binding)
      const declaration=constantBindings.get(binding)
      if(declaration?.initializer&&ts.isIdentifier(declaration.initializer))expression=declaration.initializer
      else return {binding,readAt:expression}
    }
  }
  function executionBoundary(node:ts.Node):ts.Node {
    for(let current=node.parent;current;current=current.parent)
      if(callable(current)||ts.isForStatement(current)||ts.isForOfStatement(current)||ts.isForInStatement(current)
        ||ts.isWhileStatement(current)||ts.isDoStatement(current))return current
    return node.getSourceFile()
  }
  function relatedSelection(choice:Atom,selector:ts.Expression,write:ts.BinaryExpression):boolean|undefined {
    if(!choice.choiceSelector||!choice.choiceProducer)return false
    const pure=read(choice.choicePure!,write)
    if(!pure.size)return undefined
    if([...pure].some(item=>item.kind!=='literal'||item.literal!==true))return false
    const before=selectorBinding(choice.choiceSelector),after=selectorBinding(selector)
    if(!before||!after||before.binding!==after.binding)return false
    if(constantBindings.has(before.binding))return true
    const producer=choice.choiceProducer,start=Math.min(before.readAt.end,after.readAt.end,producer.end)
    const boundary=executionBoundary(producer)
    if(producer.getSourceFile()!==write.getSourceFile()||boundary!==executionBoundary(write)
      ||executionBoundary(before.readAt)!==boundary||executionBoundary(after.readAt)!==boundary
      ||producer.end>=write.left.getStart())return false
    if((bindingChanges.get(before.binding)??[]).some(change=>change.getStart()>start&&change.getStart()<write.left.getStart()))return false
    for(let current=producer.parent;current&&!ts.isExpressionStatement(current)&&!ts.isVariableStatement(current);current=current.parent){
      if(ts.isCallExpression(current)||ts.isNewExpression(current)||ts.isAwaitExpression(current)||ts.isYieldExpression(current))return false
      if(ts.isBinaryExpression(current)&&assignment(current)&&!ts.isIdentifier(current.left))return false
    }
    const state=units.get(write)!
    // A same-iteration def-use interval is a proof only if no call, suspension,
    // or property write can alter the selector through an alias in between.
    for(const node of state.nodes){
      if(node.getStart(state.file)<=start||node.getStart(state.file)>=write.left.getStart())continue
      if(ts.isCallExpression(node)||ts.isNewExpression(node)||ts.isAwaitExpression(node)||ts.isYieldExpression(node))return false
      if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))return false
      if(ts.isBinaryExpression(node)&&assignment(node)&&!ts.isIdentifier(node.left))return false
    }
    return true
  }
  function sameDataSelector(left:ts.Expression,right:ts.Expression,node:ts.Node):boolean {
    while(ts.isParenthesizedExpression(left))left=left.expression
    while(ts.isParenthesizedExpression(right))right=right.expression
    if(ts.isIdentifier(left)&&ts.isIdentifier(right)){
      const binding=lookup(scopes.get(left)!,left.text)
      return !!binding&&binding===lookup(scopes.get(right)!,right.text)
        &&!!names(read(binding,node))
    }
    if(!ts.isElementAccessExpression(left)||!ts.isElementAccessExpression(right)
      ||!ts.isIdentifier(left.expression)||!ts.isIdentifier(right.expression)
      ||!ts.isIdentifier(left.argumentExpression)||!ts.isIdentifier(right.argumentExpression))return false
    const array=lookup(scopes.get(left.expression)!,left.expression.text),
      index=lookup(scopes.get(left.argumentExpression)!,left.argumentExpression.text)
    if(!array||array!==lookup(scopes.get(right.expression)!,right.expression.text)
      ||!index||index!==lookup(scopes.get(right.argumentExpression)!,right.argumentExpression.text))return false
    const changes=bindingChanges.get(index)
    if(!changes?.length||changes.some(change=>{
      if(ts.isVariableDeclaration(change))return !change.initializer||!ts.isNumericLiteral(change.initializer)
      if(ts.isBinaryExpression(change))return !ts.isNumericLiteral(change.right)
      return !ts.isPrefixUnaryExpression(change)&&!ts.isPostfixUnaryExpression(change)
    }))return false
    const owners=read(array,node)
    return !!owners.size&&[...owners].every(owner=>owner.kind==='array'&&!!owner.fields&&!owner.written?.has('*')
      &&[...owner.fields.values()].every(target=>!!names(read(target,node))))
  }
  function directDataCopy(target:ts.ElementAccessExpression,right:ts.Expression,node:ts.BinaryExpression,
    name:string):Value|undefined {
    while(ts.isParenthesizedExpression(right))right=right.expression
    // Original b[keys[k]] -> window[keys[k]] is one DATA copy. Reading two
    // stable primitive selectors in the same expression cannot cross keys.
    if(!ts.isElementAccessExpression(right)||!ts.isIdentifier(right.expression)
      ||!ts.isIdentifier(target.expression)||!sameDataSelector(target.argumentExpression,right.argumentExpression,node))return undefined
    const sources=value(right.expression,node),result:Value=new Set()
    if(!sources.size)return result
    for(const owner of sources){
      if(owner.kind==='literal'&&owner.literal===null||owner.kind==='absent')continue
      if(owner.kind!=='object'||owner.realm||!owner.fields||owner.written?.has('*'))return undefined
      const selected=read(field(owner,name),node)
      if(!selected.size){if(!functionFallback)return result;continue}
      if([...selected].some(item=>item.kind==='unknown'||item.kind==='missing'))return undefined
      for(const item of selected)result.add(item)
    }
    return result
  }
  /** Guard facts restrict a fixed absent facade path, never remove AST coverage. */
  function unreachable(node:ts.Node):boolean {
    let child=node
    for(let p=node.parent;p;child=p,p=p.parent){
      if(ts.isIfStatement(p)){
        const test=guardTruth(read(nodeCell(p.expression),node))
        if(test===false&&child===p.thenStatement||test===true&&child===p.elseStatement)return true
      }
      if(ts.isBlock(p)){
        const consumer=p.statements.findIndex(statement=>statement===child)
        if(consumer>=0)for(let i=0;i<consumer;i++){
          const previous=p.statements[i]!
          if(ts.isIfStatement(previous)&&guardTruth(read(nodeCell(previous.expression),node))===true
            &&(ts.isReturnStatement(previous.thenStatement)||ts.isBlock(previous.thenStatement)
              &&previous.thenStatement.statements.length===1&&ts.isReturnStatement(previous.thenStatement.statements[0]!)))return true
        }
      }
    }
    return false
  }
  const nativeCalls=new Map<ts.Node,Map<Atom,readonly Value[]>>()
  const boundFunctions=new Map<ts.Node,Map<Atom,Atom>>()
  const unprovenNativeBoundCalls=new Set<ts.Node>()
  function invokeFunction(fn:Atom,args:readonly Value[],node:ts.Node,receiver?:Value,selectorExpression?:ts.Expression):Value {
    if(fn.kind==='choice'){
      const result:Value=new Set()
      for(const target of choiceValues(one(fn),node))for(const item of invokeFunction(target,args,node,receiver))result.add(item)
      return result
    }
    if(fn.kind==='factory-callback'){
      const captures=new Map(fn.callback!.captures),declaration=fn.fn!,parameters=functions.get(declaration)!.params!
      for(let index=0;index<parameters.length;index++){
        const parameter=declaration.parameters[index]!
        if(parameter.dotDotDotToken){
          let arrays=factoryArrays.get(fn)
          if(!arrays){arrays=new Map();factoryArrays.set(fn,arrays)}
          let rest=arrays.get(parameter)
          if(!rest){rest=atom('array',{fields:new Map(),elements:cell(),written:new Set()});arrays.set(parameter,rest)}
          for(let arg=index;arg<args.length;arg++){
            add(rest.elements!,args[arg]!);add(field(rest,String(arg-index)),args[arg]!);rest.written!.add(String(arg-index))
          }
          captures.set(parameters[index]!,one(rest))
        }else captures.set(parameters[index]!,args[index]??one(absent))
      }
      return evaluateFactoryRecipe(fn.callback!.recipe,fn.callback!.plan,captures,node,fn).values
    }
    if(fn.kind==='native'){
      let calls=nativeCalls.get(node)
      if(!calls){calls=new Map();nativeCalls.set(node,calls)}
      const previous=calls.get(fn),merged:Value[]=[]
      for(let index=0;index<Math.max(previous?.length??0,args.length);index++)
        merged.push(new Set([...(previous?.[index]??[]),...(args[index]??one(absent))]))
      calls.set(fn,merged)
      return nativeResult(fn,args,node)
    }
    if(fn.kind==='function'){
      const specialized=resolver(fn,args,node,selectorExpression)
      if(specialized?.pure)return specialized.values
      const returned=callGuest(fn,args,node,receiver)
      return new Set([...returned,...(specialized?.values??[])])
    }
    if(fn.kind==='bound'){
      const prefix=fn.params!.map(target=>new Set(read(target,node)))
      if(read(fn.boundPrefixUnproven!,node).size){
        if(nativeFunction(fn)){
          unprovenNativeBoundCalls.add(node)
          return unknownResult([one(fn),...prefix,...args],node)
        }
        const unknownArguments=unknownResult([...prefix,...args],node)
        return invokeFunction(fn.receiver!,fn.receiver!.params?.map(()=>unknownArguments)??[],node,
          new Set(read(fn.thisValue!,node)))
      }
      return invokeFunction(fn.receiver!,[...prefix,...args],node,new Set(read(fn.thisValue!,node)))
    }
    return one(unknown)
  }
  function applyArguments(items:Value,node:ts.Node):readonly Value[]|undefined {
    if(!items.size)return undefined
    const result:Value[]=[]
    for(const item of items){
      if(item.kind==='absent')continue
      if(item.kind!=='array'||!item.fields||item.written?.has('*'))return undefined
      const indexes=[...item.fields.keys()].filter(name=>/^\d+$/.test(name)).map(Number)
      if(!indexes.length&&read(item.elements!,node).size)return undefined
      for(const index of indexes){result[index]??=new Set()
        for(const value of read(field(item,String(index)),node))result[index]!.add(value)}
    }
    return result.map(value=>value??one(absent))
  }
  function findSelection(fn:Atom,items:Value,node:ts.Node):Value|undefined {
    const declaration=fn.fn,parameter=declaration?.parameters[0]
    if(!declaration||!parameter||!ts.isIdentifier(parameter.name))return undefined
    let expression:ts.Node|undefined=declaration.body
    if(expression&&ts.isBlock(expression)&&expression.statements.length===1){
      const statement=expression.statements[0]!
      expression=ts.isReturnStatement(statement)?statement.expression:undefined
    }
    if(!expression||!ts.isBinaryExpression(expression)
      ||expression.operatorToken.kind!==ts.SyntaxKind.EqualsEqualsEqualsToken)return undefined
    for(const [member,wanted] of [[expression.left,expression.right],[expression.right,expression.left]] as const){
      if(!ts.isPropertyAccessExpression(member)||!ts.isIdentifier(member.expression)
        ||lookup(scopes.get(member)!,member.expression.text)!==fn.params![0])continue
      const desired=names(value(wanted,node))
      if(!desired)return new Set()
      const out:Value=new Set()
      for(const item of items){
        const ids=names(memberValues(item,new Set([member.name.text]),node))
        if(!ids)return undefined
        if([...ids].some(id=>desired.has(id)))out.add(item)
      }
      return out
    }
    return undefined
  }
  function combine(fn:Atom,args:readonly Value[],node:ts.Node):Value {
    const owner=fn.receiver!,items=new Set(read(owner.elements!,node)),name=fn.nativeName!
    if(name==='push'){
      for(const incoming of args){add(owner.elements!,incoming);if(owner.fields)add(field(owner,'*'),incoming)}
      owner.written?.add('*')
      return one(guest)
    }
    if(name==='indexOf')return one(guest)
    const returned:Value=new Set(),selected:Value=new Set()
    for(const callback of args[0]??[]){
      if(!['function','factory-callback','choice','native','bound'].includes(callback.kind)){returned.add(unknown);continue}
      const incoming=name==='reduce'?[args[1]??items,items,one(guest)]:[items,one(guest)]
      for(const item of invokeFunction(callback,incoming,node))returned.add(item)
      for(const item of (name==='find'||name==='filter')&&callback.kind==='function'
        ?findSelection(callback,items,node)??items:items)selected.add(item)
    }
    if(name==='forEach'||name==='some'||name==='every')return one(guest)
    if(name==='find')return selected
    if(name==='reduce')return returned
    let result=objects.get(node)
    if(!result){result=atom(name==='then'?'promise':'array',{elements:cell(),fields:new Map()});objects.set(node,result)}
    add(result.elements!,name==='filter'?selected:returned)
    return one(result)
  }
  function evaluate(node:ts.Node):void {
    const state=units.get(node)!,scope=scopes.get(node)!,output=nodeCell(node)
    const emit=(items:Iterable<Atom>)=>add(output,items)
    if(ts.isStringLiteralLike(node)){emit(one(literal(node.text)));return}
    if(ts.isNumericLiteral(node)){emit(one(literal(Number(node.text))));return}
    if(node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword){emit(one(literal(node.kind===ts.SyntaxKind.TrueKeyword)));return}
    if(node.kind===ts.SyntaxKind.NullKeyword){emit(one(literal(null)));return}
    if(ts.isIdentifier(node)){
      if(namePosition(node))return
      const binding=lookup(scope,node.text)
      if(binding){const incoming=read(binding,node)
        // Original truth guards narrow immutable local DATA reads only. Native
        // references remain truthy and all original effect nodes stay visited.
        emit(requiresTruthyRead(node,binding)?[...incoming].filter(item=>truth(one(item))!==false):incoming)
      }else emit(globalValue(node.text,scope.global,node))
      return
    }
    if(node.kind===ts.SyntaxKind.ThisKeyword){emit(scope.fn?read(scope.fn.thisValue!,node):one(scope.global));return}
    if(callable(node)){emit(one(functions.get(node)!))
      if(ts.isArrowFunction(node)&&!ts.isBlock(node.body))add(functions.get(node)!.returns!,value(node.body,node))
      return}
    if(ts.isParenthesizedExpression(node)){emit(value(node.expression,node));return}
    if(ts.isVariableDeclaration(node)){if(node.initializer)bindPattern(node.name,value(node.initializer,node),node);return}
    if(ts.isObjectLiteralExpression(node)){
      const owner=object(node);emit(one(owner))
      for(const property of node.properties){
        if(ts.isSpreadAssignment(property)){
          for(const source of value(property.expression,node))if(source.fields)
            for(const [name,target] of source.fields){add(field(owner,name),read(target,node));owner.written!.add(name)}
          continue
        }
        const selected=key(property.name,node)
        const next=ts.isShorthandPropertyAssignment(property)?value(property.name,node)
          :ts.isPropertyAssignment(property)?value(property.initializer,node):value(property,node)
        if(selected)for(const name of selected){add(field(owner,name),next);owner.written!.add(name)}
        else if(ts.isComputedPropertyName(property.name)&&value(property.name.expression,node).size){
          add(field(owner,'*'),one(unknown));owner.written!.add('*')
        }
      }
      return
    }
    if(ts.isArrayLiteralExpression(node)){const owner=object(node,true);emit(one(owner))
      for(let index=0;index<node.elements.length;index++){
        const item=node.elements[index]!,incoming=value(ts.isSpreadElement(item)?item.expression:item,node)
        add(owner.elements!,incoming)
        if(!ts.isSpreadElement(item)){add(field(owner,String(index)),incoming);owner.written!.add(String(index))}
        else owner.written!.add('*')
      }
      return
    }
    if(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)){
      const selected=ts.isPropertyAccessExpression(node)?new Set([node.name.text]):key(node.argumentExpression,node)
      if(ts.isElementAccessExpression(node)&&!selected&&!value(node.argumentExpression,node).size)return
      for(const receiver of value(node.expression,node))emit(memberValues(receiver,selected,node));return
    }
    if(ts.isConditionalExpression(node)){
      const test=guardTruth(value(node.condition,node))
      const branch=(expression:ts.Expression)=>[...value(expression,node)].map(item=>
        test!==undefined&&item.kind==='literal'?literal(item.literal!,true):item)
      if(test!==false)emit(branch(node.whenTrue))
      if(test!==true)emit(branch(node.whenFalse))
      return
    }
    if(ts.isPrefixUnaryExpression(node)){
      if(node.operator===ts.SyntaxKind.ExclamationToken){
        for(const item of value(node.operand,node)){
          const test=truth(one(item))
          emit(test===undefined?one(guest):one(literal(!test,!!item.fixedGuard)))
        }
      }else emit(one(guest))
      return
    }
    if(ts.isTypeOfExpression(node)){
      const types=new Set<string>()
      for(const item of value(node.expression,node))types.add(item.kind==='absent'?'undefined':item.kind==='native'||item.kind==='function'?'function'
        :item.kind==='bound'||item.kind==='invoke'||item.kind==='combiner'||item.kind==='choice'||item.kind==='factory-callback'?'function'
        :item.kind==='guest'&&item.nativeName==='Object'?'function'
        :item.kind==='literal'?typeof item.literal:item.kind==='unknown'?'unknown':'object')
      for(const type of types)emit(one(literal(type,
        [...value(node.expression,node)].some(item=>item.fixedGuard))));return
    }
    if(ts.isBinaryExpression(node)){
      const left=value(node.left,node),right=value(node.right,node),op=node.operatorToken.kind
      if(assignment(node)){
        if(ts.isIdentifier(node.left)){const binding=lookup(scope,node.left.text);add(binding??field(scope.global,node.left.text),right)}
        if(ts.isPropertyAccessExpression(node.left)||ts.isElementAccessExpression(node.left)){
          const target=node.left,selected=ts.isPropertyAccessExpression(target)?new Set([target.name.text]):key(target.argumentExpression,node)
          const receivers=value(target.expression,node),owners=new Set(receivers)
          for(const owner of receivers)if(owner.kind==='choice')for(const base of choiceValues(one(owner),node))owners.add(base)
          for(const owner of owners)if(owner.fields){
            if(selected)for(const name of selected){
              if(owner.kind==='object'&&owner.realm&&['name1','name2'].includes(name)&&!owner.written?.has(name))continue
              const incoming:Value=new Set()
              const copied=ts.isElementAccessExpression(target)?directDataCopy(target,node.right,node,name):undefined
              for(const item of copied??right){
                const related=item.kind==='choice'&&ts.isElementAccessExpression(target)
                  ?relatedSelection(item,target.argumentExpression,node):false
                if(related===undefined)continue
                if(related){for(const entry of read(item.choices!.get(name)??emptyChoiceCell,node))incoming.add(entry)}
                else incoming.add(item)
              }
              // Declared native slots are set by their real owner. Their read
              // value may be WebIDL-coerced; only a guest own override retains
              // the raw assignment value in this JS property Cell.
              const ownWrite=!guestFieldsOwner(owner)||guestField(owner,name)||name.startsWith('on')||owner.written?.has(name)
              if(ownWrite){add(field(owner,name),incoming);owner.written?.add(name)}
              if(owner.kind==='handle'&&owner.handle==='frame'&&['src','srcdoc'].includes(name))add(owner.sources!,incoming)
              if(guestFieldsOwner(owner)&&name.startsWith('on')&&(owner.handle==='node'||name==='onload'))
                for(const callback of incoming)if(['function','factory-callback','choice','native','bound'].includes(callback.kind))
                  invokeFunction(callback,[one(handle('event',owner.realm!))],node,one(owner))
            }
            else if(ts.isElementAccessExpression(target)&&value(target.argumentExpression,node).size){
              add(field(owner,'*'),one(unknown));owner.written?.add('*')
            }
          }
        }
        emit(right);return
      }
      if(op===ts.SyntaxKind.BarBarToken){
        if(!left.size)return
        let possibleFalsy=false
        for(const item of left){const test=truth(one(item));if(test!==false)emit(one(item));if(test!==true)possibleFalsy=true}
        if(possibleFalsy)emit(right)
        return
      }
      if(op===ts.SyntaxKind.QuestionQuestionToken){
        const test=guardTruth(left);if(test!==false)emit(left);if(test!==true)emit(right);return}
      if(op===ts.SyntaxKind.AmpersandAmpersandToken){
        if(!left.size)return
        let possibleTruthy=false
        for(const item of left){const test=truth(one(item));if(test!==true)emit(one(item));if(test!==false)possibleTruthy=true}
        if(possibleTruthy)emit(right)
        return
      }
      if([ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(op)){
        if(!left.size||!right.size)return
        if([...left,...right].every(item=>item.kind==='literal'||item.kind==='absent')){
          for(const a of left)for(const b of right)emit(one(literal(
            op===ts.SyntaxKind.EqualsEqualsEqualsToken?a.literal===b.literal:a.literal!==b.literal,
            !!a.fixedGuard||!!b.fixedGuard)))
        }else emit(one(guest));return
      }
      // Arithmetic/string construction never upgrades data to a native value.
      emit(one(guest));return
    }
    if(ts.isAwaitExpression(node)){
      for(const item of value(node.expression,node))emit(item.kind==='promise'?read(item.elements!,node):one(item))
      return
    }
    if(ts.isReturnStatement(node)&&node.expression&&scope.fn&&!unreachable(node)){
      add(scope.fn.returns!,value(node.expression,node));return}
    if(ts.isForOfStatement(node)||ts.isForInStatement(node)){
      const incoming:Value=new Set()
      for(const owner of value(node.expression,node)){
        if(ts.isForOfStatement(node)&&owner.elements)for(const item of read(owner.elements,node))incoming.add(item)
        else if(ts.isForInStatement(node)&&owner.fields)for(const name of owner.fields.keys())incoming.add(literal(name))
        else incoming.add(unknown)
      }
      const target=ts.isVariableDeclarationList(node.initializer)?node.initializer.declarations[0]?.name:node.initializer
      if(target&&ts.isIdentifier(target))bindPattern(target,incoming,node)
      return
    }
    if(ts.isCallExpression(node)||ts.isNewExpression(node)){
      const args=(node.arguments??[]).map(argument=>value(argument,node)),target=value(node.expression,node)
      const access=ts.isPropertyAccessExpression(node.expression)||ts.isElementAccessExpression(node.expression)?node.expression:null
      const receiver=access?value(access.expression,node):undefined
      const selected=access?(ts.isPropertyAccessExpression(access)?new Set([access.name.text]):key(access.argumentExpression,node)):undefined
      if(!target.size){functionFallbackReaders.add(node);if(globalMissingFallback)emit(unknownResult(args,node))}
      for(const fn of target){
        if(fn.kind==='choice'||fn.kind==='factory-callback'){emit(invokeFunction(fn,args,node,receiver));continue}
        if(fn.kind==='combiner'){emit(combine(fn,args,node));continue}
        if(fn.kind==='invoke'){
          if(fn.nativeName==='bind'){
            let boundByTarget=boundFunctions.get(node)
            if(!boundByTarget){boundByTarget=new Map();boundFunctions.set(node,boundByTarget)}
            const target=fn.receiver!,base=target.kind==='bound'?target.receiver!:target
            const prefix=target.kind==='bound'?target.params!.map(entry=>new Set(read(entry,node))):[]
            const incoming=[...prefix,...args.slice(1)]
            let bound=boundByTarget.get(base)
            if(!bound){bound=atom('bound',{receiver:base,boundOrigin:node,
              params:incoming.map(()=>cell()),boundPrefixUnproven:cell(),
              thisValue:cell(),fields:new Map(),written:new Set()});boundByTarget.set(base,bound)}
            // One abstract bound value belongs to this callsite/base pair.
            // A feedback edge cannot mint ever deeper wrappers or an exact
            // argument prefix whose repeated concatenation is not bounded.
            if(incoming.length!==bound.params!.length
              ||target.kind==='bound'&&read(target.boundPrefixUnproven!,node).size)add(bound.boundPrefixUnproven!,one(unknown))
            const boundThis=target.kind==='bound'?new Set(read(target.thisValue!,node)):args[0]??one(absent)
            add(bound.thisValue!,boundThis)
            for(let i=0;i<bound.params!.length;i++)add(bound.params![i]!,incoming[i]??one(unknown))
            emit(one(bound))
          }else{
            const incoming=fn.nativeName==='call'?args.slice(1):args.length<2?[]:applyArguments(args[1]!,node)
            const selector=fn.nativeName==='call'?node.arguments?.[1]
              :node.arguments?.[1]&&ts.isArrayLiteralExpression(node.arguments[1])?node.arguments[1].elements[0]:undefined
            if(incoming)emit(invokeFunction(fn.receiver!,incoming,node,args[0],selector))
            else if(args[1]?.size)emit(one(unknown))
          }
          continue
        }
        if(fn.kind==='bound'){emit(invokeFunction(fn,args,node,receiver));continue}
        if(fn.kind==='function'){
          if(ts.isNewExpression(node)){
            const instance=object(node)
            const prototype=memberValues(fn,new Set(['prototype']),node)
            add(instance.prototypes!,prototype)
            const returned=callGuest(fn,args,node,one(instance))
            emit(one(instance))
            emit([...returned].filter(item=>!['guest','literal','absent'].includes(item.kind)))
            continue
          }
          emit(invokeFunction(fn,args,node,receiver))
        }
        else if(fn.kind==='native')emit(invokeFunction(fn,args,node,receiver))
        else if(fn.kind==='guest'){
          if(fn.nativeName&&fn.nativeName!=='Object.assign'){
            const reflected=reflection(fn.nativeName,args,node)
            if(reflected){emit(reflected);continue}
          }
          if(fn.nativeName==='Array.from'){
            for(const source of args[0]??[])if(source.kind==='array')emit(one(source));else emit(unknownResult([one(source)],node))
            continue
          }
          if(fn.nativeName==='Promise.resolve'){
            let promise=objects.get(node)
            if(!promise){promise=atom('promise',{elements:cell()});objects.set(node,promise)}
            for(const item of args[0]??one(absent)){
              if(item.kind==='promise')add(promise.elements!,read(item.elements!,node))
              else add(promise.elements!,one(item))
            }
            emit(one(promise));continue
          }
          if(fn.nativeName==='Object.assign'){
            for(const target of args[0]??[])if(target.fields)for(const source of args.slice(1).flatMap(set=>[...set])){
              if(source.fields)for(const [name,incoming] of source.fields){
                add(field(target,name),read(incoming,node));target.written?.add(name)
              }else {add(field(target,'*'),one(unknown));target.written?.add('*')}
              emit(one(target))
            }
            continue
          }
          // Known array callbacks retain element provenance. Other guest
          // results remain unknown and keep any actual boundary references.
          for(const owner of receiver??[]){
            const invokesCallback=selected&&[...selected].some(name=>
              ['map','forEach','filter','some','every','reduce'].includes(name))
            if(owner.elements&&invokesCallback){
              for(const callback of args[0]??[])if(['function','factory-callback','choice','native','bound'].includes(callback.kind))
                invokeFunction(callback,[new Set(read(owner.elements,node)),one(guest)],node)
            }
          }
          emit(unknownResult(args,node))
        }else if(fn.kind==='missing'||fn.kind==='unknown')emit(unknownResult(args,node))
        else emit(one(absent))
      }
      return
    }
    if(ts.isDeleteExpression(node)){
      const target=node.expression
      if(ts.isPropertyAccessExpression(target)||ts.isElementAccessExpression(target)){
        const selected=ts.isPropertyAccessExpression(target)?new Set([target.name.text]):key(target.argumentExpression,node)
        if(selected)for(const receiver of value(target.expression,node))if(guestFieldsOwner(receiver))
          for(const name of selected)add(field(receiver,name),one(absent))
      }
      emit(one(guest));return
    }
    if(ts.isTemplateExpression(node)||ts.isRegularExpressionLiteral(node)||ts.isPostfixUnaryExpression(node)
      ||ts.isVoidExpression(node))emit(one(guest))
  }
  const variableObjects=new Map<string,Atom>()
  const contextSnapshots=new Map<ts.Node,Atom>()
  const sourceDictionaries=new Map<string,Atom>()
  const sourceEventFields=['MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_EDITED',
    'MESSAGE_DELETED','CHAT_CHANGED','SETTINGS_UPDATED','USER_MESSAGE_RENDERED','CHARACTER_MESSAGE_RENDERED','GENERATION_AFTER_COMMANDS']
  const sourceMvuEventFields=['VARIABLE_INITIALIZED','VARIABLE_UPDATE_STARTED','COMMAND_PARSED',
    'VARIABLE_UPDATE_ENDED','BEFORE_MESSAGE_UPDATE','SINGLE_VARIABLE_UPDATED']
  const sourceRequestHeaders={'Content-Type':'application/json'}
  function sourceDictionary(name:string,keys:readonly string[]):Atom {
    let result=sourceDictionaries.get(name)
    if(!result){result=atom('object',{fields:new Map(),written:new Set(),snapshot:true});sourceDictionaries.set(name,result)
      for(const key of keys){add(field(result,key),one(guest));result.written!.add(key)}}
    return result
  }
  const sourceAsyncResults=new Map<ts.Node,Map<string,Atom>>()
  function sourcePromise(node:ts.Node,name:string,contents:Atom):Value {
    let byName=sourceAsyncResults.get(node)
    if(!byName){byName=new Map();sourceAsyncResults.set(node,byName)}
    let promise=byName.get(name)
    if(!promise){promise=atom('promise',{elements:cell()});byName.set(name,promise)}
    add(promise.elements!,one(contents));return one(promise)
  }
  const avatarResponses=new Map<ts.Node,Atom>(),avatarIdArrays=new Map<ts.Node,Atom>()
  // The actual hidden Source closure shares this ordinary mutable metadata
  // across calls and same-runtime realms; copied context dictionaries do not.
  const contextMetadata=atom('object',{fields:new Map(),written:new Set(),prototypes:cell(),snapshot:true})
  add(field(contextMetadata,'tainted'),one(literal(false)));contextMetadata.written!.add('tainted')
  const sourceAtoms=new Map<object,Atom>(),catalogs=new Map<BrowserScriptResourceProjectionV3,Map<string,MvuJsonValue>>()
  const ownedHtml=new Map<object,Map<string,Atom>>(),pageHtml=new Map<string,Atom>(),emptyData={}
  const jsonObject=(data:MvuJsonValue):data is {[key:string]:MvuJsonValue}=>
    data!==null&&typeof data==='object'&&!Array.isArray(data)
  // Preserve the reader's shared DATA references. Equal HTML bytes in another
  // catalog item never turn that item's data into the selected page resource.
  for(const state of states){
    const page=state.input.sourceHtml,caller=state.input.sourceResources.callers.find(row=>
      row.identity===page?.scriptIdentity&&row.originalOrdinal===state.input.ordinal)
    if(!page||!caller)continue
    const path=(page.resourcePath??['data','html']).slice(1)
    let parent:MvuJsonValue=caller.data
    for(const part of path.slice(0,-1))parent=jsonObject(parent)?parent[part]??null:null
    const last=path.at(-1)
    if(!last||!jsonObject(parent)||parent[last]!==page.html)continue
    let html=pageHtml.get(page.pageId)
    if(!html){html=atom('html',{pageId:page.pageId});pageHtml.set(page.pageId,html)}
    let fields=ownedHtml.get(parent)
    if(!fields){fields=new Map();ownedHtml.set(parent,fields)}
    fields.set(last,html)
  }
  function sourceAtom(data:MvuJsonValue):Atom {
    if(data===null||typeof data!=='object')return literal(data)
    let result=sourceAtoms.get(data)
    if(result)return result
    const todo:MvuJsonValue[]=[data]
    const make=(entry:MvuJsonValue):Atom=>{
      if(entry===null||typeof entry!=='object')return literal(entry)
      let found=sourceAtoms.get(entry)
      if(!found){found=atom(Array.isArray(entry)?'array':'object',
        {fields:new Map(),written:new Set(),snapshot:true,...Array.isArray(entry)?{elements:cell()}:{}})
        sourceAtoms.set(entry,found);todo.push(entry)}
      return found
    }
    result=make(data)
    const filled=new Set<object>()
    while(todo.length){const entry=todo.pop()!
      if(entry===null||typeof entry!=='object'||filled.has(entry))continue
      filled.add(entry)
      const owner=sourceAtoms.get(entry)!
      if(Array.isArray(entry))for(let index=0;index<entry.length;index++){
        const item=one(make(entry[index]!));add(owner.elements!,item);add(field(owner,String(index)),item);owner.written!.add(String(index))
      }
      else for(const [name,item] of Object.entries(entry)){
        add(field(owner,name),one(ownedHtml.get(entry)?.get(name)??make(item)));owner.written!.add(name)
      }
    }
    return result
  }
  function catalog(projection:BrowserScriptResourceProjectionV3):Map<string,MvuJsonValue> {
    let found=catalogs.get(projection)
    if(found)return found
    found=new Map();catalogs.set(projection,found)
    const todo:MvuJsonValue[]=Array.isArray(projection.characterTrees)?[...projection.characterTrees].reverse():[]
    while(todo.length){const entry=todo.pop()!
      if(!jsonObject(entry))continue
      if(entry.type==='folder'&&Array.isArray(entry.scripts))todo.push(...[...entry.scripts].reverse())
      else if(entry.type==='script'&&typeof entry.id==='string')found.set(entry.id,entry.data??emptyData)
    }
    for(const row of projection.callers)if(!row.hasOriginalId)
      found.set(row.authorId,row.data)
    return found
  }
  function nativeResult(fn:Atom,args:readonly Value[],node:ts.Node):Value {
    const state=units.get(node)!,realmName=state.input.realm,name=fn.nativeName!,operation=fn.operation!
    if(operation.callbacks)for(const argument of args)for(const callback of argument)
      if(['function','factory-callback','choice','bound','native'].includes(callback.kind)){
      const incoming=[one(operation.callbacks==='event'?handle('event',fn.receiver?.realm??realmName):guest)]
      invokeFunction(callback,incoming,node,operation.callbacks==='event'?one(fn.receiver!):undefined)
    }
    if(operation.returns==='context'){
      let snapshot=contextSnapshots.get(node)
      if(!snapshot){
        snapshot=atom('object',{fields:new Map(),written:new Set(),prototypes:cell(),snapshot:true})
        contextSnapshots.set(node,snapshot)
        for(const name of ['name1','name2','chatId','characters','chat']){
          add(field(snapshot,name),one(guest));snapshot.written!.add(name)
        }
        add(field(snapshot,'characterId'),new Set([guest,absent]));snapshot.written!.add('characterId')
        add(field(snapshot,'chatMetadata'),one(contextMetadata));snapshot.written!.add('chatMetadata')
        add(field(snapshot,'eventTypes'),one(sourceDictionary('events',sourceEventFields)));snapshot.written!.add('eventTypes')
        add(field(snapshot,'tavern_events'),one(sourceDictionary('events',sourceEventFields)));snapshot.written!.add('tavern_events')
        add(field(snapshot,'Mvu'),one(handle('mvu',fn.receiver?.realm??realmName)));snapshot.written!.add('Mvu')
        add(field(snapshot,'getRequestHeaders'),one(native('getRequestHeaders',BROWSER_METHODS_V3.context!.getRequestHeaders!,snapshot)))
        snapshot.written!.add('getRequestHeaders')
      }
      return one(snapshot)
    }
    if(name==='getRequestHeaders'&&operation.capability==='owned-persona-snapshot')
      return one(sourceAtom(sourceRequestHeaders))
    if(operation.returns==='avatar-fetch'){
      let response=avatarResponses.get(node)
      if(!response){response=atom('object',{fields:new Map(),written:new Set(),snapshot:true});avatarResponses.set(node,response)
        add(field(response,'ok'),one(literal(true)));response.written!.add('ok')
        add(field(response,'status'),one(literal(200)));response.written!.add('status')
        add(field(response,'json'),one(native('json',{capability:'owned-native-personas',returns:'avatar-ids'},response)))
        response.written!.add('json')}
      return sourcePromise(node,'avatar-fetch',response)
    }
    if(operation.returns==='avatar-ids'){
      let ids=avatarIdArrays.get(node)
      if(!ids){ids=atom('array',{elements:cell()});avatarIdArrays.set(node,ids);add(ids.elements!,one(guest))}
      return sourcePromise(node,'avatar-ids',ids)
    }
    if(name==='Blob'){
      let blob=objects.get(node)
      if(!blob){blob=atom('blob',{sources:cell(),mime:cell()});objects.set(node,blob)}
      for(const array of args[0]??[])if(array.elements)add(blob.sources!,read(array.elements,node))
      for(const option of args[1]??[])if(option.fields)add(blob.mime!,read(field(option,'type'),node))
      return one(blob)
    }
    if(operation.returns==='object-url'){
      let url=objects.get(node)
      if(!url){url=atom('url',{sources:cell()});objects.set(node,url)}
      for(const blob of args[0]??[])if(blob.sources)add(url.sources!,read(blob.sources,node))
      return one(url)
    }
    // Native getters are bound to the descriptor that created their facade.
    // Borrowing a getter into another page does not change that DATA owner.
    const facadeInput=realmInputs.get(fn.receiver?.realm??state.input.realm)!
    const creatorInput=realmInputs.get(facadeInput.parentRealm)??facadeInput
    const projection=creatorInput.sourceResources
    const caller=projection.callers.find(row=>row.identity===creatorInput.identity&&row.originalOrdinal===creatorInput.ordinal)
    if(operation.returns==='source-id')return caller?one(literal(caller.authorId)):one(unknown)
    if(operation.returns==='source-trees'){
      if(!args[0]?.size)return args.length?new Set():one(unknown)
      const scopes:Value=new Set()
      for(const option of args[0])if(option.fields)for(const type of read(field(option,'type'),node))scopes.add(type)
      const selected=names(scopes)
      if(!selected)return scopes.size?one(unknown):new Set()
      // The immutable resource reader throws for global/preset scopes. They
      // have no normal return DATA to feed a caught fallback's guest walker.
      return selected.has('character')?one(sourceAtom(projection.characterTrees)):new Set()
    }
    if(operation.returns==='variables'){
      // A syntactically present argument with an empty cell is still pending.
      // Only an omitted/undefined options value invokes the API's default.
      if(args.length&&!args[0]?.size)return new Set()
      const options=args.length?args[0]!:one(absent),out:Value=new Set()
      let chat=false
      for(const option of options){
        if(option.kind==='absent'){chat=true;continue}
        if(!option.fields){out.add(unknown);continue}
        const types=read(field(option,'type'),node)
        if(!types.size&&!option.written?.has('type')){out.add(absent);continue}
        const selected=names(types)
        if(!selected){if(types.size)out.add(unknown);continue}
        for(const type of selected){
          if(type!=='script'){chat=true;continue}
          const ids=read(field(option,'script_id'),node)
          if(ids.size){
            const selectedIds=names(ids)
            if(!selectedIds){out.add(unknown);continue}
            for(const id of selectedIds)out.add(sourceAtom(catalog(projection).get(id)??emptyData))
          }else if(option.written?.has('script_id'))continue
          else out.add(caller?sourceAtom(caller.data):unknown)
        }
      }
      if(!chat)return out
      let result=variableObjects.get(realmName)
      if(!result){result=atom('object',{fields:new Map()});variableObjects.set(realmName,result)
        add(field(result,'stat_data'),one(guest))}
      out.add(result);return out
    }
    if(operation.returns==='nodes')return one(handleArray(fn.receiver!,'node'))
    if(operation.returns==='guest'||operation.returns==='void')return one(guest)
    if(operation.frameTarget==='receiver-owned-frame')return one(handle('frame',fn.receiver!.realm!))
    const tag=names(args[0]??new Set())
    const frame=name==='createElement'&&tag?.size===1&&tag.has('iframe')
    return one(handle(frame?'frame':operation.returns,fn.receiver?.realm??realmName,frame))
  }
  function drain():void {
    while(queue.length){const node=queue.pop()!;queued.delete(node);evaluate(node)}
  }
  const loadedPages=new Set<string>()
  function discoverMountedPages():boolean {
    if(!astOptions.loadSourcePage)return false
    let loaded=false
    // Visit recorded frame-write sinks, not the complete AST or effect pass.
    // All added units share these Cells, scopes, realms and reader queue.
    for(const node of mountWrites){
      if(unreachable(node))continue
      const target=node.left as ts.PropertyAccessExpression|ts.ElementAccessExpression
      const selected=ts.isPropertyAccessExpression(target)?new Set([target.name.text]):names(finalValue(target.argumentExpression))
      if(!selected)continue
      for(const receiver of finalValue(target.expression))if(receiver.kind==='handle'&&receiver.mount)
        for(const name of selected)if(name==='src'||name==='srcdoc'){
          const incoming=name==='src'?immediatelyStoredObjectUrl(node.right,node)??finalValue(node.right):finalValue(node.right)
          const pageId=mountedPage(incoming,receiver.realm!)
          if(!pageId||loadedPages.has(pageId))continue
          loadedPages.add(pageId)
          for(const input of astOptions.loadSourcePage(pageId)){
            const state=registerUnit(input)
            registerGlobalWrites(state)
            registerBindingWrites(state)
            for(const child of state.nodes)enqueue(child)
          }
          loaded=true
        }
    }
    return loaded
  }
  for(const state of states)for(const node of state.nodes)enqueue(node)
  drain()
  while(discoverMountedPages())drain()
  functionFallback=true
  for(const node of functionFallbackReaders)enqueue(node)
  drain()
  while(discoverMountedPages())drain()
  // Finite DATA absence may select the original loader's fallback. Resolve it
  // before final global/call absence so its mounted declarations can join.
  missingFallback=true
  for(const node of functionFallbackReaders)enqueue(node)
  drain()
  while(discoverMountedPages())drain()
  // Global and call absence is irreversible in Cells, so settle it only after
  // the mounted declaration closure has joined the shared graph.
  globalMissingFallback=true
  for(const node of functionFallbackReaders)enqueue(node)
  drain()
  while(discoverMountedPages())drain()

  function finalValue(node:ts.Node):Value {return nodeCell(node).values}
  function nativeFunction(fn:Atom):boolean {
    const todo=[fn],seen=new Set<Atom>()
    while(todo.length){const item=todo.pop()!
      if(seen.has(item))continue
      seen.add(item)
      if(item.kind==='native')return true
      if(item.kind==='bound')todo.push(item.receiver!)
      if(item.kind==='choice')for(const target of item.choices!.values())todo.push(...target.values)
      if(item.callbackTargets)todo.push(...item.callbackTargets.values)
    }
    return false
  }
  function strings(node:ts.Node):Set<string>|undefined {return names(finalValue(node))}
  function options(args:readonly Value[],state:UnitState,node:ts.Node):void {
    const selected=args[1]
    if(!selected){return}
    const types=new Set<string>()
    for(const owner of selected)if(owner.fields)for(const type of names(field(owner,'type').values)??[])types.add(type)
    if(types.size!==1||!types.has('chat'))report(state,'BROWSER3_CHAT_SCOPE_UNPROVEN',node)
  }
  function insertion(args:readonly Value[],state:UnitState,node:ts.Node):void {
    options(args,state,node)
    const patch=args[0]
    if(!patch){report(state,'BROWSER3_CHAT_PATCH_UNPROVEN',node);return}
    const possibilities=patch
    if(!possibilities.size){report(state,'BROWSER3_CHAT_PATCH_UNPROVEN',node);return}
    for(const owner of possibilities){
      if(owner.kind!=='object'||owner.realm||!owner.fields){report(state,'BROWSER3_CHAT_PATCH_UNPROVEN',node);continue}
      const written=[...(owner.written??[])].map(name=>[name,field(owner,name)] as const)
      if(written.length!==1||written[0]![0]==='*'){
        report(state,'BROWSER3_CHAT_PATCH_UNPROVEN',node);continue}
      const name=written[0]![0]
      if(!name||['__proto__','constructor','prototype'].includes(name))report(state,'BROWSER3_CHAT_KEY_UNSUPPORTED',node,name)
      else if(name==='stat_data')state.caps.add('owned-numerical-variable-replacement')
      else {state.keys.add(name);state.caps.add('owned-declared-key-mutation')}
    }
  }
  function mountSources(items:Value):Value {
    const sources:Value=new Set()
    for(const item of items){
      if(item.kind==='html')sources.add(item)
      else if(item.kind==='url'&&item.sources)for(const source of item.sources.values)sources.add(source)
      else sources.add(unknown)
    }
    return sources
  }
  function mountedPage(items:Value,frameRealm:string):string|undefined {
    const sources=mountSources(items)
    if(sources.size!==1||[...sources][0]!.kind!=='html')return undefined
    const pageId=[...sources][0]!.pageId!
    return sourceParents.get(pageId)===frameRealm?pageId:undefined
  }
  function mountValue(items:Value,state:UnitState,node:ts.Node,frameRealm:string):void {
    const sources=mountSources(items)
    if(sources.size!==1||[...sources][0]!.kind!=='html')report(state,'BROWSER3_SOURCE_PAGE_MOUNT_UNPROVEN',node)
    else {
      const pageId=[...sources][0]!.pageId!
      if(sourceParents.get(pageId)!==frameRealm)report(state,'BROWSER3_SOURCE_PAGE_PARENT_UNPROVEN',node)
      else {state.mounts.add(pageId);state.caps.add('owned-source-html-page')}
    }
  }
  function immediatelyStoredObjectUrl(expression:ts.Expression,write:ts.BinaryExpression):Value|undefined {
    if(!(ts.isPropertyAccessExpression(expression)||ts.isElementAccessExpression(expression))
      ||!ts.isIdentifier(expression.expression)||!ts.isExpressionStatement(write.parent))return undefined
    const statements=ts.isBlock(write.parent.parent)||ts.isSourceFile(write.parent.parent)
      ?write.parent.parent.statements:undefined
    const index=statements?.indexOf(write.parent)??-1,previous=index>0?statements![index-1]:undefined
    if(!previous||!ts.isExpressionStatement(previous)||!ts.isBinaryExpression(previous.expression)
      ||previous.expression.operatorToken.kind!==ts.SyntaxKind.EqualsToken)return undefined
    const stored=previous.expression,target=stored.left
    if(!(ts.isPropertyAccessExpression(target)||ts.isElementAccessExpression(target))
      ||!ts.isIdentifier(target.expression)||!ts.isCallExpression(stored.right))return undefined
    const selected=ts.isPropertyAccessExpression(expression)?new Set([expression.name.text]):names(finalValue(expression.argumentExpression))
    const prior=ts.isPropertyAccessExpression(target)?new Set([target.name.text]):names(finalValue(target.argumentExpression))
    if(selected?.size!==1||prior?.size!==1||[...selected][0]!==[...prior][0]
      ||lookup(scopes.get(expression)!,expression.expression.text)!==lookup(scopes.get(target)!,target.expression.text))return undefined
    // Only the actual Native object-URL constructor may intervene between the
    // receiver read and this adjacent read. Guest calls/argument writes cannot
    // establish a relation across a potentially changed ordinary data owner.
    const callees=finalValue(stored.right.expression)
    if(!callees.size||[...callees].some(fn=>fn.kind!=='native'||fn.operation?.returns!=='object-url')
      ||stored.right.arguments.some(argument=>!ts.isIdentifier(argument)&&!ts.isLiteralExpression(argument)))return undefined
    const owners=finalValue(expression.expression),dataOwners=[...owners].filter(owner=>owner.kind==='object'&&!owner.realm)
    if(dataOwners.length!==1||[...owners].some(owner=>owner!==dataOwners[0]&&truth(one(owner))!==false))return undefined
    const name=[...selected][0]!,owner=dataOwners[0]!,own=owner.fields?.get(name)
    if(!owner.written?.has(name)||!own?.values.size||[...own.values].some(item=>!['literal','url'].includes(item.kind)))return undefined
    const incoming=finalValue(stored.right)
    return incoming.size&&[...incoming].every(item=>item.kind==='url')?incoming:undefined
  }
  const cataloguedMediaKinds=new Map<UnitState,Set<'image'|'audio'>>()
  function mediaUrl(value:string,kind:'image'|'audio'):boolean {
    if(new RegExp('^data:'+kind+'/','i').test(value))return true
    if(!/^https?:\/\/[^\s]+$/i.test(value))return false
    try {const url=new URL(value);return !!url.hostname&&['http:','https:'].includes(url.protocol)}catch{return false}
  }
  function media(items:Value,state:UnitState,node:ts.Node,kind:'image'|'audio'):void {
    const record=(url:string,origin:ts.Node,owner=state)=>{
      if(!mediaUrl(url,kind))return
      const resource={value:url,kind,start:origin.getStart(owner.file),end:origin.end}
      owner.media.set(kind+':'+resource.start+':'+url,resource)
    }
    for(const item of items)if(item.kind==='literal'&&typeof item.literal==='string')record(item.literal,node)
    // Guest selection/string operations consume a finite captured catalog.
    // Its actual Native resourceUrl owner rejects every unregistered value;
    // an unknown scalar never fabricates a resource or URL provenance here.
    // Classic scripts share their page realm, including declared data used by
    // later scripts. Keep each literal's provenance on its declaring unit.
    for(const owner of states) {
      if(owner.input.realm!==state.input.realm||owner.input.pageId!==state.input.pageId)continue
      let kinds=cataloguedMediaKinds.get(owner)
      if(!kinds){kinds=new Set();cataloguedMediaKinds.set(owner,kinds)}
      if(kinds.has(kind))continue
      kinds.add(kind)
      for(const literalNode of owner.nodes)if(ts.isStringLiteralLike(literalNode))record(literalNode.text,literalNode,owner)
    }
  }
  for(const state of states)for(const node of state.nodes){
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isExportAssignment(node)
      ||ts.isTypeNode(node)||ts.isAsExpression(node)||ts.isNonNullExpression(node)){
      report(state,'BROWSER3_ORIGINAL_CLASSIC_JAVASCRIPT_REQUIRED',node,ts.SyntaxKind[node.kind])
    }
    if(ts.isIdentifier(node)&&!namePosition(node)&&!lookup(scopes.get(node)!,node.text)){
      if(BROWSER_SERVER_GLOBALS_V3.includes(node.text))report(state,'BROWSER3_SERVER_NATIVE_UNSUPPORTED',node,node.text)
      if(['eval','Function','AsyncFunction','GeneratorFunction','process','require','module','exports',
        'XMLHttpRequest','WebSocket','Worker','SharedWorker','importScripts','indexedDB'].includes(node.text))
        report(state,'BROWSER3_GLOBAL_UNSUPPORTED',node,node.text)
    }
    if(unreachable(node))continue
    for(const name of serverNativeReads.get(node)??[])report(state,'BROWSER3_SERVER_NATIVE_UNSUPPORTED',node,name)
    if(unprovenNativeBoundCalls.has(node))report(state,'BROWSER3_NATIVE_BIND_PREFIX_UNPROVEN',node)
    if((ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))
      &&!(ts.isBinaryExpression(node.parent)&&node.parent.left===node&&node.parent.operatorToken.kind===ts.SyntaxKind.EqualsToken)){
      if(nativeMemberUnknown.has(node))report(state,'BROWSER3_NATIVE_MEMBER_UNPROVEN',node)
    }
    if(ts.isCallExpression(node)||ts.isNewExpression(node)){
      if(node.expression.kind===ts.SyntaxKind.ImportKeyword){report(state,'BROWSER3_IMPORT_UNSUPPORTED',node);continue}
      const targets=finalValue(node.expression)
      for(const fn of targets){
        if(fn.kind==='invoke'&&fn.nativeName==='apply'&&nativeFunction(fn.receiver!)&&!nativeCalls.get(node)?.size)
          report(state,'BROWSER3_NATIVE_APPLY_ARGUMENTS_UNPROVEN',node)
        if(fn.kind==='missing'){
          report(state,fn.nativeName==='Mvu.applyVariable'?'BROWSER3_MVU_OWNER_MISSING':'BROWSER3_DYNAMIC_CODE_UNSUPPORTED',node,fn.nativeName)
          continue
        }
        if(fn.kind==='guest'&&fn.nativeName==='Function')report(state,'BROWSER3_DYNAMIC_CODE_UNSUPPORTED',node,'Function')
      }
    }
    for(const [fn,args] of nativeCalls.get(node)??[]){
        if(fn.nativeName==='insertOrAssignVariables')insertion(args,state,node)
        else state.caps.add(fn.operation!.capability)
        // Script DATA comes from the captured Source reader at runtime. Keep
        // that transport with this caller's proof, including finite aliases.
        if(fn.nativeName==='getAllVariables'||fn.nativeName==='getVariables'
          &&[...args[0]??[]].some(option=>option.fields&&names(field(option,'type').values)?.has('script')))
          state.caps.add('owned-script-source-resources')
        if(fn.operation!.returns==='avatar-fetch'){
          const urls=args[0]?names(args[0]):undefined,methods:Value=new Set()
          for(const option of args[1]??[])if(option.fields)for(const method of field(option,'method').values)methods.add(method)
          const selected=names(methods)
          if(urls?.size!==1||!urls.has('/api/avatars/get')||selected?.size!==1||!selected.has('POST'))
            report(state,'BROWSER3_NATIVE_MEMBER_UNPROVEN',node,'source-avatar-fetch-input')
        }
        if(fn.nativeName==='Audio'&&args[0])media(args[0],state,node,'audio')
        if(fn.nativeName==='insertAdjacentHTML'&&args[1]) {
          media(args[1],state,node,'image');media(args[1],state,node,'audio')
        }
        if(fn.nativeName==='createElement'){
          const tags=args[0]?names(args[0]):undefined
          if(tags&&[...tags].some(tag=>['script','object','embed'].includes(tag.toLowerCase())))
            report(state,'BROWSER3_ACTIVE_ELEMENT_UNSUPPORTED',node)
        }
        if(fn.nativeName==='Blob')for(const blob of finalValue(node))if(blob.sources
          &&[...blob.sources.values].some(item=>item.kind==='html')){
          const mime=blob.mime?names(blob.mime.values):undefined
          if(mime?.size!==1||![...mime][0]!.toLowerCase().startsWith('text/html'))
            report(state,'BROWSER3_SOURCE_BLOB_MIME_UNSUPPORTED',node)
        }
    }
    if(ts.isBinaryExpression(node)&&assignment(node)
      &&(ts.isPropertyAccessExpression(node.left)||ts.isElementAccessExpression(node.left))){
      const target=node.left,selected=ts.isPropertyAccessExpression(target)?new Set([target.name.text]):key(target.argumentExpression,node)
      for(const receiver of finalValue(target.expression))if(receiver.kind==='handle'){
        if(!selected){report(state,'BROWSER3_NATIVE_MEMBER_UNPROVEN',node);continue}
        for(const name of selected){
          if(receiver.mount&&['src','srcdoc'].includes(name))mountValue(
            name==='src'?immediatelyStoredObjectUrl(node.right,node)??finalValue(node.right):finalValue(node.right),state,node,receiver.realm!)
          else if(guestField(receiver,name))continue
          else if(guestFieldsOwner(receiver)&&name.startsWith('on')&&(receiver.handle==='node'||name==='onload')){
            state.caps.add('owned-synchronous-page-events')
          }
          else if(name==='srcdoc')report(state,'BROWSER3_SOURCE_PAGE_MOUNT_UNPROVEN',node)
          else if(name==='src'&&['node','audio'].includes(receiver.handle!))media(finalValue(node.right),state,node,receiver.handle==='audio'?'audio':'image')
          else if(['innerHTML','outerHTML'].includes(name)&&receiver.handle==='node') {
            // Native fragment rendering consumes the same finite Source URL
            // catalog as src writes. The renderer still owns every actual URL.
            media(finalValue(node.right),state,node,'image');media(finalValue(node.right),state,node,'audio')
          }
          else if(receiver.handle==='frame'&&!scalarProperty('frame',name))report(state,'BROWSER3_NATIVE_PARENT_DOM_UNSUPPORTED',node,name)
          else if(!scalarProperty(receiver.handle!,name)&&receiver.handle!=='style')report(state,'BROWSER3_NATIVE_WRITE_UNSUPPORTED',node,name)
        }
      }
    }
  }
  // Diagnostic capture observes the final cells only. It neither revisits the
  // original AST nor adds readers, propagation, permissions, or source payloads.
  const textEvidence=(text:string):BrowserTextEvidenceV3=>({codeUnits:text.length,
    utf8Bytes:Buffer.byteLength(text,'utf8'),sha256:sha256(text)})
  function kindCounts(items:Iterable<Atom>):Record<string,number> {
    const result:Record<string,number>={}
    for(const item of items)result[item.kind]=(result[item.kind]??0)+1
    return result
  }
  function valueEvidence(items:Value):BrowserValueEvidenceV3 {
    const selected=[...items].slice(0,16)
    return {count:items.size,kinds:kindCounts(items),omittedAtoms:items.size-selected.length,
      atoms:selected.map(item=>({kind:item.kind,
        ...item.fixedGuard?{fixedGuard:true}: {},
        ...item.kind==='native'?{nativeName:item.nativeName}: {},
        ...item.handle?{facade:item.handle}: {},...item.realm?{realm:item.realm}: {},...item.pageId?{pageId:item.pageId}: {},
        ...item.kind==='literal'?{literal:{type:typeof item.literal,text:textEvidence(JSON.stringify(item.literal)!)}}: {},
        ...item.fields?{fields:[...item.fields].slice(0,8).map(([name,target])=>({key:textEvidence(name),
          count:target.values.size,kinds:kindCounts(target.values)}))}: {},
        ...item.sources?{sourceRefs:[...item.sources.values].slice(0,16).map(source=>({kind:source.kind,
          ...source.pageId?{pageId:source.pageId}: {}}))}: {},
        ...item.kind==='choice'?{choice:{pure:[...item.choicePure!.values].flatMap(value=>
          value.kind==='literal'&&typeof value.literal==='boolean'?[value.literal]:[]),
          ...item.choiceProducer?{producerStart:item.choiceProducer.getStart(),producerEnd:item.choiceProducer.end}: {},
          selections:[...item.choices!].slice(0,16).map(([name,target])=>({key:textEvidence(name),count:target.values.size,
            kinds:kindCounts(target.values),nativeNames:[...new Set([...target.values].flatMap(value=>{
              while(value.kind==='bound')value=value.receiver!
              return value.kind==='native'?[value.nativeName!]:[]
            }))].sort(),boundOrigins:[...target.values].filter(value=>value.kind==='bound'&&value.boundOrigin).slice(0,32)
              .map(value=>{const origin=value.boundOrigin!,state=units.get(origin)!,receiver=value.receiver!
                return {realm:state.input.realm,inlineOrdinal:state.input.inlineOrdinal,start:origin.getStart(),end:origin.end,
                  receiverKind:receiver.kind,...receiver.kind==='native'?{nativeName:receiver.nativeName}: {}}
              })}))}}: {},
      }))}
  }
  const diagnosticEvidence=diagnosticSites?.map(({diagnostic,state,node}):BrowserDiagnosticEvidenceV3=>{
    const call=node&&(ts.isCallExpression(node)||ts.isNewExpression(node))?node:undefined
    const assigned=node&&ts.isBinaryExpression(node)&&assignment(node)?node:undefined
    const member=node&&(ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))?node
      :assigned&&(ts.isPropertyAccessExpression(assigned.left)||ts.isElementAccessExpression(assigned.left))?assigned.left
      :call&&(ts.isPropertyAccessExpression(call.expression)||ts.isElementAccessExpression(call.expression))?call.expression:undefined
    const priorGuards:NonNullable<BrowserDiagnosticEvidenceV3['priorGuards']>[number][]=[]
    if(node)for(let child=node;child.parent;child=child.parent)if(ts.isBlock(child.parent)){
      for(const statement of child.parent.statements){
        if(statement===child)break
        if(!ts.isIfStatement(statement))continue
        const items=values.get(statement.expression)?.values??new Set(),test=guardTruth(items)
        priorGuards.push({start:statement.expression.getStart(),end:statement.expression.end,
          ...test!==undefined?{truth:test}: {},values:valueEvidence(items)})
      }
    }
    return {code:diagnostic.code,ordinal:state.input.ordinal,inlineOrdinal:state.input.inlineOrdinal,
      pageId:state.input.pageId,realm:state.input.realm,scriptIdentitySha256:sha256(state.input.identity),
      pointerSha256:sha256(state.input.pointer),...diagnostic.line?{line:diagnostic.line,column:diagnostic.column}: {},
      ...node?{syntaxKind:ts.SyntaxKind[node.kind],start:node.getStart(state.file),end:node.end}: {},
      ...diagnostic.feature?{feature:textEvidence(diagnostic.feature)}: {},
      ...call?{target:valueEvidence(values.get(call.expression)?.values??new Set())}: {},
      ...member?{receiver:valueEvidence(values.get(member.expression)?.values??new Set())}: {},
      ...assigned?{assigned:valueEvidence(values.get(assigned.right)?.values??new Set())}: {},
      ...priorGuards.length?{priorGuards:priorGuards.slice(0,16)}: {},
      ...call?{nativeCalls:[...(nativeCalls.get(call)??[])].slice(0,16).map(([fn,args])=>({
        nativeName:fn.nativeName!,receiver:valueEvidence(one(fn.receiver!)),args:args.slice(0,8).map(valueEvidence),
      }))}: {},
    }
  })
  return {proofs:states.map(state=>({unit:state.input,coverage:state.coverage,capabilities:[...state.caps].sort(),
    keys:[...state.keys].sort(),pageMounts:[...state.mounts].sort(),media:[...state.media.values()]})),diagnostics,
    ...diagnosticEvidence?{diagnosticEvidence}: {}}
}
