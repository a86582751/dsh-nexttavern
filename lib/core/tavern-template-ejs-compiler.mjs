// Generated from runtime/alpha3/src/core/tavern-template-ejs-compiler.mts; edit the TypeScript source.
export const TAVERN_EJS_COMPILER_PROFILE = Object.freeze({
    encoding: 'st-template-ejs-3.1.10-source-v1', version: '3.1.10',
    async: true, client: true, _with: true, localsName: 'locals', outputFunctionName: 'print',
    compileDebug: true, rmWhitespace: false, delimiter: '%', openDelimiter: '<', closeDelimiter: '>',
});
export class TavernEjsCompileError extends Error {
    code = 'TEMPLATE_EJS_COMPILE_FAILED';
    sourcePointer;
    constructor(sourcePointer) {
        super('TEMPLATE_EJS_COMPILE_FAILED');
        this.name = 'TavernEjsCompileError';
        this.sourcePointer = sourcePointer;
    }
}
export function createTavernEjsSourceCompiler(library) {
    // Admission belongs to the component owner. A version mismatch here means
    // the owner supplied a different compiler contract, not an author failure.
    if (library.VERSION !== TAVERN_EJS_COMPILER_PROFILE.version)
        throw Error('TEMPLATE_EJS_COMPILER_VERSION');
    const Template = library.Template;
    return (template, sourcePointer) => {
        let generator;
        try {
            generator = new Template(template, TAVERN_EJS_COMPILER_PROFILE);
            generator.generateSource();
        }
        catch {
            throw new TavernEjsCompileError(sourcePointer);
        }
        // generateSource owns delimiter parsing and JS emission. compile()/render()
        // would construct a function in Node, so neither is used. EJS __append uses
        // default-hint coercion and omits null/undefined; String(value) differs.
        const functionSource = `(async function(locals,rethrow,include){
var __line=1,__output='';
function __append(value){if(value!==undefined&&value!==null)__output+=value}
function escapeFn(value){return value}
var print=__append;
try { with(locals || {}) {
${generator.source}
} return __output; } catch(error){rethrow(error,${JSON.stringify(sourcePointer)},__line)}
})`;
        return { profile: TAVERN_EJS_COMPILER_PROFILE, sourcePointer, functionSource };
    };
}
