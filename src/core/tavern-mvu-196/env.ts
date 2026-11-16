/** Host-independent dependency seam for the pinned MVU v0.196 core.
 * Implementations and their byte/permission admission belong to the guest host. */
export interface Mvu196LodashChain {
  sortBy(path:string):Mvu196LodashChain
  map(iteratee:(value:any)=>any):Mvu196LodashChain
  value():any
}

/** The upstream algorithm accepts heterogeneous JSON, VWD and template DATA.
 * These signatures preserve that boundary without shipping another library. */
export interface Mvu196Lodash {
  (value:any):Mvu196LodashChain
  concat(...values:any[]):any[]
  escape(value:string):string
  get(value:any,path:string|string[],defaultValue?:any):any
  has(value:any,path:string|string[]):boolean
  isDate(value:any):boolean
  isEqual(left:any,right:any):boolean
  isObject(value:any):boolean
  isPlainObject(value:any):boolean
  isString(value:any):boolean
  merge(target:any,...sources:any[]):any
  omit(value:any,...paths:string[]):any
  set(value:any,path:string|string[],next:any):any
  toPath(path:string):string[]
  unset(value:any,path:string|string[]):boolean
}

export interface Mvu196MathNode {
  [property:string]:any
  filter(predicate:(node:Mvu196MathNode)=>boolean):Mvu196MathNode[]
  compile():{evaluate(scope:Record<string,unknown>):any}
}

export interface Mvu196MathInstance {
  parse(expression:string):Mvu196MathNode
  evaluate(expression:string,scope:Record<string,unknown>):any
}

export interface Mvu196Math {
  readonly all:unknown
  create(all:unknown):Mvu196MathInstance
  isSymbolNode(node:Mvu196MathNode):boolean
  isConstantNode(node:Mvu196MathNode):boolean
  isAssignmentNode(node:Mvu196MathNode):boolean
  isFunctionAssignmentNode(node:Mvu196MathNode):boolean
  isAccessorNode(node:Mvu196MathNode):boolean
  isFunctionNode(node:Mvu196MathNode):boolean
  isComplex(value:any):boolean
  isMatrix(value:any):boolean
  [property:string]:any
}

export interface Mvu196Environment {
  readonly lodash:Mvu196Lodash
  readonly clone:<T>(value:T)=>T
  readonly json5:{parse(text:string):any}
  readonly yaml:{parse(text:string):any}
  readonly math:Mvu196Math
  readonly parseString:(text:string)=>any
  readonly substituteMacros:(text:string)=>string
  readonly translate:(key:string,parameters?:Record<string,unknown>)=>string
  readonly diagnostics:{
    info(...values:any[]):void
    warn(...values:any[]):void
    error(...values:any[]):void
    log(...values:any[]):void
  }
  /** Absence means the actual host's error notifications are disabled. */
  readonly warning?:(message:string,title:string,options:{timeOut:number})=>void
}
