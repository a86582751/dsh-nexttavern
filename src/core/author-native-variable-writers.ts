import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export interface AuthorNativeVariableOptionsV1 {
  readonly type?:string
  readonly message_id?:number|'latest'
  readonly script_id?:string
}
interface VariableCapture {
  readonly variables:MvuJsonObject
  commit(next:MvuJsonObject):Promise<unknown>
}
interface VariableLodash {
  mergeWith(...values:any[]):MvuJsonObject
  isArray(value:unknown):boolean
  unset(value:MvuJsonObject,path:string):boolean
}

/** Author callbacks stay inside their realm. Each adapter captures its read
 * scope before awaiting the updater and resolves commit only after real ACK. */
export function createAuthorNativeVariableWriters(
  capture:(options:AuthorNativeVariableOptionsV1)=>VariableCapture,
  lodash:()=>VariableLodash) {
  const updateVariablesWith=async(updater:(variables:MvuJsonObject)=>MvuJsonObject|Promise<MvuJsonObject>,
    options:AuthorNativeVariableOptionsV1={type:'chat'})=>{
    const basis=capture(options),next=await updater(basis.variables)
    await basis.commit(next)
    return next
  }
  return {
    updateVariablesWith,
    replaceVariables:(next:MvuJsonObject,options?:AuthorNativeVariableOptionsV1)=>updateVariablesWith(()=>next,options),
    insertOrAssignVariables:(patch:MvuJsonObject,options?:AuthorNativeVariableOptionsV1)=>updateVariablesWith(value=>{
      const api=lodash()
      return api.mergeWith(value,patch,(_lhs:unknown,rhs:unknown)=>api.isArray(rhs)?rhs:undefined)
    },options),
    insertVariables:(patch:MvuJsonObject,options?:AuthorNativeVariableOptionsV1)=>updateVariablesWith(value=>{
      const api=lodash()
      return api.mergeWith({},patch,value,(_lhs:unknown,rhs:unknown)=>api.isArray(rhs)?rhs:undefined)
    },options),
    deleteVariable:async(path:string,options?:AuthorNativeVariableOptionsV1)=>{
      let delete_occurred=false
      const variables=await updateVariablesWith(value=>{
        delete_occurred=lodash().unset(value,path)
        return value
      },options)
      return {variables,delete_occurred}
    },
  }
}
