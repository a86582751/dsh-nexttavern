/** EJS language adapter for a NEW component generation. The admitted owner
 * supplies EJS; this module generates text and never constructs a JS function.
 * Do not replace the frozen v2 compiler with this implementation in place. */
export interface TavernEjsSourceGenerator {
  source:string
  generateSource():void
}
export interface TavernEjsCompilerLibrary {
  readonly VERSION:string
  readonly Template:new (text:string,options:Readonly<Record<string,unknown>>)=>TavernEjsSourceGenerator
}
export const TAVERN_EJS_COMPILER_PROFILE=Object.freeze({
  encoding:'st-template-ejs-3.1.10-source-v1',version:'3.1.10',
  async:true,client:true,_with:true,localsName:'locals',outputFunctionName:'print',
  compileDebug:true,rmWhitespace:false,delimiter:'%',openDelimiter:'<',closeDelimiter:'>',
})
export interface TavernEjsCompiledSource {
  readonly profile:typeof TAVERN_EJS_COMPILER_PROFILE
  readonly sourcePointer:string
  /** Evaluate only in the owned isolated realm. locals and this are guest
   * values. rethrow must also be a guest function, never a Node value.
   * include is an explicit owner capability; EJS filesystem lookup is unused.
   * Resolves to the native EJS return value (including arbitrary JS return).
   * The consumer owns text conversion/refusal and final output limits, and
   * publishes only after success. Realm memory/deadline bounds intermediate
   * work, including buffered text discarded by an early return. */
  readonly functionSource:string
}
export class TavernEjsCompileError extends Error {
  readonly code='TEMPLATE_EJS_COMPILE_FAILED'
  readonly sourcePointer:string
  constructor(sourcePointer:string) {
    super('TEMPLATE_EJS_COMPILE_FAILED')
    this.name='TavernEjsCompileError'
    this.sourcePointer=sourcePointer
  }
}

export function createTavernEjsSourceCompiler(library:TavernEjsCompilerLibrary) {
  // Admission belongs to the component owner. A version mismatch here means
  // the owner supplied a different compiler contract, not an author failure.
  if(library.VERSION!==TAVERN_EJS_COMPILER_PROFILE.version)throw Error('TEMPLATE_EJS_COMPILER_VERSION')
  const Template=library.Template
  return (template:string,sourcePointer:string):TavernEjsCompiledSource=>{
    let generator:TavernEjsSourceGenerator
    try {
      generator=new Template(template,TAVERN_EJS_COMPILER_PROFILE)
      generator.generateSource()
    }catch {throw new TavernEjsCompileError(sourcePointer)}
    // generateSource owns delimiter parsing and JS emission. compile()/render()
    // would construct a function in Node, so neither is used. EJS __append uses
    // default-hint coercion and omits null/undefined; String(value) differs.
    const functionSource=`(async function(locals,rethrow,include){
var __line=1,__output='';
function __append(value){if(value!==undefined&&value!==null)__output+=value}
function escapeFn(value){return value}
var print=__append;
try { with(locals || {}) {
${generator.source}
} return __output; } catch(error){rethrow(error,${JSON.stringify(sourcePointer)},__line)}
})`
    return {profile:TAVERN_EJS_COMPILER_PROFILE,sourcePointer,functionSource}
  }
}
