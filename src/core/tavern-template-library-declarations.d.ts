/** Locked Lodash is supplied by the independent EJS package dependency owner. */
declare module 'nexttavern-mvu-lodash' {
  const lodash:{
    mergeWith(object:unknown,source:unknown,customizer:(target:unknown,source:unknown)=>unknown):any
    cloneDeep<T>(value:T):T
    concat<T>(array:readonly T[],...values:any[]):T[]
    get(object:unknown,path:string|readonly string[],defaultValue?:unknown):any
    has(object:unknown,path:string|readonly string[]):boolean
    set<T>(object:T,path:string|readonly string[],value:unknown):T
    unset(object:unknown,path:string|readonly string[]):boolean
  }
  export default lodash
}
