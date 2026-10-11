/**
 * C pointer to type `CType`. Pointer types are used internally for FFI, but
 * are not intended for external use.
 *
 * @unstable This type is considered private and may change.
 */
type Pointer<CType extends string> = number & {
    ctype: CType;
};
type Brand<T, B> = T & {
    brand: B;
};
/**
 * `JSRuntime*`.
 */
type JSRuntimePointer = Pointer<"JSRuntime">;
/**
 * `JSContext*`.
 */
type JSContextPointer = Pointer<"JSContext">;
/**
 * `JSContext**`. Used internally for execute pending jobs.
 */
type JSContextPointerPointer = Pointer<"JSContext">;
/**
 * `JSModuleDef*`.
 */
type JSModuleDefPointer = Pointer<"JSModuleDef">;
/**
 * `JSValue*`.
 * See {@link JSValue}.
 */
type JSValuePointer = Pointer<"JSValue">;
/**
 * `JSValueConst*
 * See {@link JSValueConst} and {@link StaticJSValue}.
 */
type JSValueConstPointer = Pointer<"JSValueConst">;
/**
 * Used internally for Javascript-to-C function calls.
 */
type JSValuePointerPointer = Pointer<"JSValue[]">;
/**
 * Used internally for Javascript-to-C function calls.
 */
type JSValuePointerPointerPointer = Pointer<"*JSValue[]">;
/**
 * Used internally for Javascript-to-C function calls.
 */
type JSValueConstPointerPointer = Pointer<"JSValueConst[]">;
/**
 * Used internally for C-to-Javascript function calls.
 */
/**
 * Used internally for C-to-Javascript function calls.
 */
type QTS_C_To_HostCallbackFuncPointer = Pointer<"C_To_HostCallbackFunc">;
/**
 * Used internally for C-to-Javascript interrupt handlers.
 */
type QTS_C_To_HostInterruptFuncPointer = Pointer<"C_To_HostInterruptFunc">;
/**
 * Used internally for C-to-Javascript module loading.
 */
type QTS_C_To_HostLoadModuleFuncPointer = Pointer<"C_To_HostLoadModuleFunc">;
/**
 * Used internally for Javascript-to-C calls that may contain strings too large
 * for the Emscripten stack.
 */
type BorrowedHeapCharPointer = Pointer<"const char" | "char" | "js const char">;
/**
 * Used internally for Javascript-to-C calls that may contain strings too large
 * for the Emscripten stack.
 */
type OwnedHeapCharPointer = Pointer<"char">;
/**
 * Used internally for Javascript-to-C calls that may contain strings too large
 * for the Emscripten stack.
 */
type JSBorrowedCharPointer = Pointer<"js const char">;
/**
 * Opaque pointer that was allocated by js_malloc.
 */
type JSVoidPointer = Pointer<any>;
type UInt32Pointer = Pointer<"uint32_t">;
/**
 * @private
 */
type EvalDetectModule = Brand<number, "EvalDetectModule">;
/**
 * @private
 */
type HostRefId = Brand<number, "HostRefId">;
declare function assertSync<Args extends any[], R>(fn: (...args: Args) => R): (...args: Args) => R;
/**
 * @private
 */
type EvalFlags = Brand<number, "EvalFlags">;
/** Bitfield options for JS_Eval() C function. */
declare const EvalFlags: {
    /** global code (default) */
    readonly JS_EVAL_TYPE_GLOBAL: number;
    /** module code */
    readonly JS_EVAL_TYPE_MODULE: number;
    /** direct call (internal use) */
    readonly JS_EVAL_TYPE_DIRECT: number;
    /** indirect call (internal use) */
    readonly JS_EVAL_TYPE_INDIRECT: number;
    readonly JS_EVAL_TYPE_MASK: number;
    /** force 'strict' mode */
    readonly JS_EVAL_FLAG_STRICT: number;
    /** force 'strip' mode */
    readonly JS_EVAL_FLAG_STRIP: number;
    /**
     * compile but do not run. The result is an object with a
     * JS_TAG_FUNCTION_BYTECODE or JS_TAG_MODULE tag. It can be executed
     * with JS_EvalFunction().
     */
    readonly JS_EVAL_FLAG_COMPILE_ONLY: number;
    /** don't include the stack frames before this eval in the Error() backtraces */
    readonly JS_EVAL_FLAG_BACKTRACE_BARRIER: number;
};
/**
 * @private
 */
type IntrinsicsFlags = Brand<number, "IntrinsicsFlags">;
/** Bitfield options for QTS_NewContext intrinsics */
declare const IntrinsicsFlags: {
    readonly BaseObjects: number;
    readonly Date: number;
    readonly Eval: number;
    readonly StringNormalize: number;
    readonly RegExp: number;
    readonly RegExpCompiler: number;
    readonly JSON: number;
    readonly Proxy: number;
    readonly MapSet: number;
    readonly TypedArrays: number;
    readonly Promise: number;
    readonly BigInt: number;
    readonly BigFloat: number;
    readonly BigDecimal: number;
    readonly OperatorOverloading: number;
    readonly BignumExt: number;
};
/**
 * State of a promise.
 */
type JSPromiseStateEnum = Brand<(typeof JSPromiseStateEnum)[keyof typeof JSPromiseStateEnum], "JSPromiseStateEnum">;
declare const JSPromiseStateEnum: {
    readonly Pending: 0;
    readonly Fulfilled: 1;
    readonly Rejected: 2;
};
/**
 * @private
 */
type GetOwnPropertyNamesFlags = Brand<number, "GetOwnPropertyNamesFlags">;
/** Bitfield options for QTS_GetOwnPropertyNames */
declare const GetOwnPropertyNamesFlags: {
    JS_GPN_STRING_MASK: number;
    JS_GPN_SYMBOL_MASK: number;
    JS_GPN_PRIVATE_MASK: number;
    JS_GPN_ENUM_ONLY: number;
    JS_GPN_SET_ENUM: number;
    QTS_GPN_NUMBER_MASK: number;
    QTS_STANDARD_COMPLIANT_NUMBER: number;
};
/**
 * @private
 */
type IsEqualOp = Brand<number, "IsEqualOp">;
declare const IsEqualOp: {
    IsStrictlyEqual: IsEqualOp;
    IsSameValue: IsEqualOp;
    IsSameValueZero: IsEqualOp;
};

declare namespace Emscripten {
    interface FileSystemType {
    }
    type EnvironmentType = "WEB" | "NODE" | "SHELL" | "WORKER";
    type ValueType = "number" | "string" | "array" | "boolean";
    type TypeCompatibleWithC = number | string | any[] | boolean;
    type WebAssemblyImports = Array<{
        name: string;
        kind: string;
    }>;
    type WebAssemblyExports = Array<{
        module: string;
        name: string;
        kind: string;
    }>;
    interface CCallOpts {
        async?: boolean;
    }
    class WasmOffsetConverter {
        constructor(wasmBytes: ArrayBuffer, wasmModule: WebAssembly.Module);
        convert(funcidx: number, offset: number): number;
        getIndex(offset: number): number;
        isSameFunc(offset1: number, offset2: number): boolean;
        getName(offset: number): string;
    }
}
interface SourceMapData {
    version: number;
    sources: string[];
    names: string[];
    mappings: string;
}
/** @private */
interface QuickJSEmscriptenExtensions {
    mock?: boolean;
    removeRunDependency?(name: string): void;
    receiveSourceMapJSON?(data: SourceMapData): void;
    WasmOffsetConverter?: typeof Emscripten.WasmOffsetConverter;
    existingWasmOffsetConverter?: Emscripten.WasmOffsetConverter;
    receiveWasmOffsetConverter?(bytes: ArrayBuffer, mod: WebAssembly.Module): void;
    getWasmMemory?(): WebAssembly.Memory;
}
/**
 * This structure is defined by Emscripten.
 * It's possible to provide these parameters to an emscripten module loader.
 * See [the Emscripten Module API reference](https://emscripten.org/docs/api_reference/module.html).
 */
interface EmscriptenModuleLoaderOptions {
    /**
     * If set, this method will be called when the runtime needs to load a file,
     * such as a .wasm WebAssembly file, .mem memory init file, or a file
     * generated by the file packager.
     *
     * The function receives two parameters:
     *
     * - `fileName`, the relative path to the file as configured in build
     * process, eg `"emscripten-module.wasm"`.
     * - `prefix` (path to the main JavaScript file’s directory). This may be `''`
     * (empty string) in some cases if the Emscripten Javascript code can't locate
     * itself. Try logging it in your environment.
     *
     * It should return the actual URI or path to the requested file.
     *
     * This lets you host file packages on a different location than the directory
     * of the JavaScript file (which is the default expectation), for example if
     * you want to host them on a CDN.
     */
    locateFile?(fileName: "emscripten-module.wasm" | "emscripten-module.wasm.map" | string, 
    /** Often `''` (empty string) */
    prefix: string): string;
    /** Compile this to WebAssembly.Module */
    wasmBinary?: ArrayBuffer;
    /** If provided, use this WebAssembly.Memory instead of an automatically created one. */
    wasmMemory?: WebAssembly.Memory;
    /** Create an instance of the WASM module, call onSuccess(instance), then return instance.exports */
    instantiateWasm?(imports: WebAssembly.Imports, onSuccess: (instance: WebAssembly.Instance) => void): WebAssembly.Exports | Promise<WebAssembly.Exports>;
    /** Called by emscripten as dependencies blocking initialization are added or fulfilled. May only be called in debug builds. */
    monitorRunDependencies?(left: number): void;
    /**
     * Emscripten may mutate the loader options object to contain this function.
     * It's added in our --pre-js / pre.js file, and used by custom variant loaders.
     * @private
     */
    quickjsEmscriptenInit?(log: typeof console.log): QuickJSEmscriptenExtensions;
}
/**
 * Typings for the features we use to interface with our Emscripten build of
 * QuickJS.
 */
interface EmscriptenModule extends EmscriptenModuleLoaderOptions {
    /**
     * Write JS `str` to HeapChar pointer.
     * https://emscripten.org/docs/api_reference/preamble.js.html#stringToUTF8
     */
    stringToUTF8(str: string, outPtr: OwnedHeapCharPointer, maxBytesToRead?: number): void;
    /**
     * HeapChar to JS string.
     * https://emscripten.org/docs/api_reference/preamble.js.html#UTF8ToString
     */
    UTF8ToString(ptr: BorrowedHeapCharPointer, maxBytesToRead?: number): string;
    lengthBytesUTF8(str: string): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    cwrap(ident: string, returnType: Emscripten.ValueType | null, argTypes: Emscripten.ValueType[], opts?: Emscripten.CCallOpts): (...args: any[]) => any;
    HEAP8: Int8Array;
    HEAP16: Int16Array;
    HEAP32: Int32Array;
    HEAPU8: Uint8Array;
    HEAPU16: Uint16Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    HEAPF64: Float64Array;
    TOTAL_STACK: number;
    TOTAL_MEMORY: number;
    FAST_MEMORY: number;
}
declare const AsyncifySleepReturnValue: unique symbol;
/** @private */
type AsyncifySleepResult<T> = T & typeof AsyncifySleepReturnValue;
/**
 * Allows us to optionally suspend the Emscripten runtime to wait for a promise.
 * https://emscripten.org/docs/porting/asyncify.html#ways-to-use-async-apis-in-older-engines
 * ```
 * EM_JS(int, do_fetch, (), {
 *   return Asyncify.handleSleep(function (wakeUp) {
 *     out("waiting for a fetch");
 *     fetch("a.html").then(function (response) {
 *       out("got the fetch response");
 *       // (normally you would do something with the fetch here)
 *       wakeUp(42);
 *     });
 *   });
 * });
 * ```
 * @private
 */
interface Asyncify {
    handleSleep<T>(maybeAsyncFn: (wakeUp: (result: T) => void) => void): AsyncifySleepResult<T>;
}
/**
 * @private
 */
interface EmscriptenModuleCallbacks {
    freeHostRef: (asyncify: Asyncify | undefined, rt: JSRuntimePointer, host_ref_id: HostRefId) => void;
    callFunction: (asyncify: Asyncify | undefined, ctx: JSContextPointer, this_ptr: JSValueConstPointer, argc: number, argv: JSValueConstPointer, host_ref_id: HostRefId) => JSValuePointer | AsyncifySleepResult<JSValuePointer>;
    loadModuleSource: (asyncify: Asyncify | undefined, rt: JSRuntimePointer, ctx: JSContextPointer, module_name: string) => BorrowedHeapCharPointer | AsyncifySleepResult<BorrowedHeapCharPointer>;
    normalizeModule: (asyncify: Asyncify | undefined, rt: JSRuntimePointer, ctx: JSContextPointer, module_base_name: string, module_name: string) => BorrowedHeapCharPointer | AsyncifySleepResult<BorrowedHeapCharPointer>;
    shouldInterrupt: (asyncify: Asyncify | undefined, rt: JSRuntimePointer) => 0 | 1 | AsyncifySleepResult<0 | 1>;
}
interface QuickJSEmscriptenModule extends EmscriptenModule {
    type: "sync";
    callbacks: EmscriptenModuleCallbacks;
}
interface QuickJSAsyncEmscriptenModule extends EmscriptenModule {
    /** @todo Implement this field */
    type: "async";
    callbacks: EmscriptenModuleCallbacks;
}
type EitherModule = QuickJSEmscriptenModule | QuickJSAsyncEmscriptenModule;
interface EmscriptenModuleLoader<T extends EmscriptenModule> {
    (options?: EmscriptenModuleLoaderOptions): Promise<T>;
}

/**
 * Low-level FFI bindings to QuickJS's Emscripten module.
 * See instead {@link QuickJSContext}, the public Javascript interface exposed by this
 * library.
 *
 * @unstable The FFI interface is considered private and may change.
 */
interface QuickJSFFI {
    /** Set at compile time. */
    readonly DEBUG: boolean;
    QTS_Throw: (ctx: JSContextPointer, error: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewError: (ctx: JSContextPointer) => JSValuePointer;
    QTS_RuntimeSetMemoryLimit: (rt: JSRuntimePointer, limit: number) => void;
    QTS_RuntimeComputeMemoryUsage: (rt: JSRuntimePointer, ctx: JSContextPointer) => JSValuePointer;
    QTS_RuntimeDumpMemoryUsage: (rt: JSRuntimePointer) => OwnedHeapCharPointer;
    QTS_RecoverableLeakCheck: () => number;
    QTS_BuildIsSanitizeLeak: () => number;
    QTS_RuntimeSetMaxStackSize: (rt: JSRuntimePointer, stack_size: number) => void;
    QTS_GetUndefined: () => JSValueConstPointer;
    QTS_GetNull: () => JSValueConstPointer;
    QTS_GetFalse: () => JSValueConstPointer;
    QTS_GetTrue: () => JSValueConstPointer;
    QTS_NewHostRef: (ctx: JSContextPointer, id: HostRefId) => JSValuePointer;
    QTS_GetHostRefId: (value: JSValuePointer | JSValueConstPointer) => HostRefId;
    QTS_NewRuntime: () => JSRuntimePointer;
    QTS_FreeRuntime: (rt: JSRuntimePointer) => void;
    QTS_NewContext: (rt: JSRuntimePointer, intrinsics: IntrinsicsFlags) => JSContextPointer;
    QTS_FreeContext: (ctx: JSContextPointer) => void;
    QTS_FreeValuePointer: (ctx: JSContextPointer, value: JSValuePointer) => void;
    QTS_FreeValuePointerRuntime: (rt: JSRuntimePointer, value: JSValuePointer) => void;
    QTS_FreeVoidPointer: (ctx: JSContextPointer, ptr: JSVoidPointer) => void;
    QTS_FreeCString: (ctx: JSContextPointer, str: JSBorrowedCharPointer) => void;
    QTS_DupValuePointer: (ctx: JSContextPointer, val: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewObject: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewObjectProto: (ctx: JSContextPointer, proto: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewArray: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewArrayBuffer: (ctx: JSContextPointer, buffer: JSVoidPointer, length: number) => JSValuePointer;
    QTS_NewFloat64: (ctx: JSContextPointer, num: number) => JSValuePointer;
    QTS_GetFloat64: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_NewString: (ctx: JSContextPointer, string: BorrowedHeapCharPointer) => JSValuePointer;
    QTS_GetString: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_GetArrayBuffer: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => JSVoidPointer;
    QTS_GetArrayBufferLength: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => number;
    QTS_NewSymbol: (ctx: JSContextPointer, description: BorrowedHeapCharPointer, isGlobal: number) => JSValuePointer;
    QTS_GetSymbolDescriptionOrKey: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_IsGlobalSymbol: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_IsJobPending: (rt: JSRuntimePointer) => number;
    QTS_ExecutePendingJob: (rt: JSRuntimePointer, maxJobsToExecute: number, lastJobContext: JSContextPointerPointer) => JSValuePointer;
    QTS_GetProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_GetPropNumber: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: number) => JSValuePointer;
    QTS_SetProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer, prop_value: JSValuePointer | JSValueConstPointer) => void;
    QTS_DefineProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer, prop_value: JSValuePointer | JSValueConstPointer, get: JSValuePointer | JSValueConstPointer, set: JSValuePointer | JSValueConstPointer, configurable: boolean, enumerable: boolean, has_value: boolean) => void;
    QTS_GetOwnPropertyNames: (ctx: JSContextPointer, out_ptrs: JSValuePointerPointerPointer, out_len: UInt32Pointer, obj: JSValuePointer | JSValueConstPointer, flags: number) => JSValuePointer;
    QTS_Call: (ctx: JSContextPointer, func_obj: JSValuePointer | JSValueConstPointer, this_obj: JSValuePointer | JSValueConstPointer, argc: number, argv_ptrs: JSValueConstPointerPointer) => JSValuePointer;
    QTS_ResolveException: (ctx: JSContextPointer, maybe_exception: JSValuePointer) => JSValuePointer;
    QTS_Dump: (ctx: JSContextPointer, obj: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_Eval: (ctx: JSContextPointer, js_code: BorrowedHeapCharPointer, js_code_length: number, filename: string, detectModule: EvalDetectModule, evalFlags: EvalFlags) => JSValuePointer;
    QTS_GetModuleNamespace: (ctx: JSContextPointer, module_func_obj: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_Typeof: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => OwnedHeapCharPointer;
    QTS_GetLength: (ctx: JSContextPointer, out_len: UInt32Pointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_IsEqual: (ctx: JSContextPointer, a: JSValuePointer | JSValueConstPointer, b: JSValuePointer | JSValueConstPointer, op: IsEqualOp) => number;
    QTS_GetGlobalObject: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewPromiseCapability: (ctx: JSContextPointer, resolve_funcs_out: JSValuePointerPointer) => JSValuePointer;
    QTS_PromiseState: (ctx: JSContextPointer, promise: JSValuePointer | JSValueConstPointer) => JSPromiseStateEnum;
    QTS_PromiseResult: (ctx: JSContextPointer, promise: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_TestStringArg: (string: string) => void;
    QTS_GetDebugLogEnabled: (rt: JSRuntimePointer) => number;
    QTS_SetDebugLogEnabled: (rt: JSRuntimePointer, is_enabled: number) => void;
    QTS_BuildIsDebug: () => number;
    QTS_BuildIsAsyncify: () => number;
    QTS_NewFunction: (ctx: JSContextPointer, name: string, arg_length: number, is_constructor: boolean, host_ref_id: HostRefId) => JSValuePointer;
    QTS_ArgvGetJSValueConstPointer: (argv: JSValuePointer | JSValueConstPointer, index: number) => JSValueConstPointer;
    QTS_RuntimeEnableInterruptHandler: (rt: JSRuntimePointer) => void;
    QTS_RuntimeDisableInterruptHandler: (rt: JSRuntimePointer) => void;
    QTS_RuntimeEnableModuleLoader: (rt: JSRuntimePointer, use_custom_normalize: number) => void;
    QTS_RuntimeDisableModuleLoader: (rt: JSRuntimePointer) => void;
    QTS_bjson_encode: (ctx: JSContextPointer, val: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_bjson_decode: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => JSValuePointer;
}

/**
 * Low-level FFI bindings to QuickJS's Emscripten module.
 * See instead {@link QuickJSContext}, the public Javascript interface exposed by this
 * library.
 *
 * @unstable The FFI interface is considered private and may change.
 */
interface QuickJSAsyncFFI {
    /** Set at compile time. */
    readonly DEBUG: boolean;
    QTS_Throw: (ctx: JSContextPointer, error: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewError: (ctx: JSContextPointer) => JSValuePointer;
    QTS_RuntimeSetMemoryLimit: (rt: JSRuntimePointer, limit: number) => void;
    QTS_RuntimeComputeMemoryUsage: (rt: JSRuntimePointer, ctx: JSContextPointer) => JSValuePointer;
    QTS_RuntimeDumpMemoryUsage: (rt: JSRuntimePointer) => OwnedHeapCharPointer;
    QTS_RecoverableLeakCheck: () => number;
    QTS_BuildIsSanitizeLeak: () => number;
    QTS_RuntimeSetMaxStackSize: (rt: JSRuntimePointer, stack_size: number) => void;
    QTS_GetUndefined: () => JSValueConstPointer;
    QTS_GetNull: () => JSValueConstPointer;
    QTS_GetFalse: () => JSValueConstPointer;
    QTS_GetTrue: () => JSValueConstPointer;
    QTS_NewHostRef: (ctx: JSContextPointer, id: HostRefId) => JSValuePointer;
    QTS_GetHostRefId: (value: JSValuePointer | JSValueConstPointer) => HostRefId;
    QTS_NewRuntime: () => JSRuntimePointer;
    QTS_FreeRuntime: (rt: JSRuntimePointer) => void;
    QTS_NewContext: (rt: JSRuntimePointer, intrinsics: IntrinsicsFlags) => JSContextPointer;
    QTS_FreeContext: (ctx: JSContextPointer) => void;
    QTS_FreeValuePointer: (ctx: JSContextPointer, value: JSValuePointer) => void;
    QTS_FreeValuePointerRuntime: (rt: JSRuntimePointer, value: JSValuePointer) => void;
    QTS_FreeVoidPointer: (ctx: JSContextPointer, ptr: JSVoidPointer) => void;
    QTS_FreeCString: (ctx: JSContextPointer, str: JSBorrowedCharPointer) => void;
    QTS_DupValuePointer: (ctx: JSContextPointer, val: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewObject: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewObjectProto: (ctx: JSContextPointer, proto: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_NewArray: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewArrayBuffer: (ctx: JSContextPointer, buffer: JSVoidPointer, length: number) => JSValuePointer;
    QTS_NewFloat64: (ctx: JSContextPointer, num: number) => JSValuePointer;
    QTS_GetFloat64: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_NewString: (ctx: JSContextPointer, string: BorrowedHeapCharPointer) => JSValuePointer;
    QTS_GetString: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_GetArrayBuffer: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => JSVoidPointer;
    QTS_GetArrayBufferLength: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => number;
    QTS_NewSymbol: (ctx: JSContextPointer, description: BorrowedHeapCharPointer, isGlobal: number) => JSValuePointer;
    QTS_GetSymbolDescriptionOrKey: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_GetSymbolDescriptionOrKey_MaybeAsync: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer | Promise<JSBorrowedCharPointer>;
    QTS_IsGlobalSymbol: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_IsJobPending: (rt: JSRuntimePointer) => number;
    QTS_ExecutePendingJob: (rt: JSRuntimePointer, maxJobsToExecute: number, lastJobContext: JSContextPointerPointer) => JSValuePointer;
    QTS_ExecutePendingJob_MaybeAsync: (rt: JSRuntimePointer, maxJobsToExecute: number, lastJobContext: JSContextPointerPointer) => JSValuePointer | Promise<JSValuePointer>;
    QTS_GetProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_GetProp_MaybeAsync: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer) => JSValuePointer | Promise<JSValuePointer>;
    QTS_GetPropNumber: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: number) => JSValuePointer;
    QTS_GetPropNumber_MaybeAsync: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: number) => JSValuePointer | Promise<JSValuePointer>;
    QTS_SetProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer, prop_value: JSValuePointer | JSValueConstPointer) => void;
    QTS_SetProp_MaybeAsync: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer, prop_value: JSValuePointer | JSValueConstPointer) => void | Promise<void>;
    QTS_DefineProp: (ctx: JSContextPointer, this_val: JSValuePointer | JSValueConstPointer, prop_name: JSValuePointer | JSValueConstPointer, prop_value: JSValuePointer | JSValueConstPointer, get: JSValuePointer | JSValueConstPointer, set: JSValuePointer | JSValueConstPointer, configurable: boolean, enumerable: boolean, has_value: boolean) => void;
    QTS_GetOwnPropertyNames: (ctx: JSContextPointer, out_ptrs: JSValuePointerPointerPointer, out_len: UInt32Pointer, obj: JSValuePointer | JSValueConstPointer, flags: number) => JSValuePointer;
    QTS_GetOwnPropertyNames_MaybeAsync: (ctx: JSContextPointer, out_ptrs: JSValuePointerPointerPointer, out_len: UInt32Pointer, obj: JSValuePointer | JSValueConstPointer, flags: number) => JSValuePointer | Promise<JSValuePointer>;
    QTS_Call: (ctx: JSContextPointer, func_obj: JSValuePointer | JSValueConstPointer, this_obj: JSValuePointer | JSValueConstPointer, argc: number, argv_ptrs: JSValueConstPointerPointer) => JSValuePointer;
    QTS_Call_MaybeAsync: (ctx: JSContextPointer, func_obj: JSValuePointer | JSValueConstPointer, this_obj: JSValuePointer | JSValueConstPointer, argc: number, argv_ptrs: JSValueConstPointerPointer) => JSValuePointer | Promise<JSValuePointer>;
    QTS_ResolveException: (ctx: JSContextPointer, maybe_exception: JSValuePointer) => JSValuePointer;
    QTS_Dump: (ctx: JSContextPointer, obj: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer;
    QTS_Dump_MaybeAsync: (ctx: JSContextPointer, obj: JSValuePointer | JSValueConstPointer) => JSBorrowedCharPointer | Promise<JSBorrowedCharPointer>;
    QTS_Eval: (ctx: JSContextPointer, js_code: BorrowedHeapCharPointer, js_code_length: number, filename: string, detectModule: EvalDetectModule, evalFlags: EvalFlags) => JSValuePointer;
    QTS_Eval_MaybeAsync: (ctx: JSContextPointer, js_code: BorrowedHeapCharPointer, js_code_length: number, filename: string, detectModule: EvalDetectModule, evalFlags: EvalFlags) => JSValuePointer | Promise<JSValuePointer>;
    QTS_GetModuleNamespace: (ctx: JSContextPointer, module_func_obj: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_Typeof: (ctx: JSContextPointer, value: JSValuePointer | JSValueConstPointer) => OwnedHeapCharPointer;
    QTS_GetLength: (ctx: JSContextPointer, out_len: UInt32Pointer, value: JSValuePointer | JSValueConstPointer) => number;
    QTS_IsEqual: (ctx: JSContextPointer, a: JSValuePointer | JSValueConstPointer, b: JSValuePointer | JSValueConstPointer, op: IsEqualOp) => number;
    QTS_GetGlobalObject: (ctx: JSContextPointer) => JSValuePointer;
    QTS_NewPromiseCapability: (ctx: JSContextPointer, resolve_funcs_out: JSValuePointerPointer) => JSValuePointer;
    QTS_PromiseState: (ctx: JSContextPointer, promise: JSValuePointer | JSValueConstPointer) => JSPromiseStateEnum;
    QTS_PromiseResult: (ctx: JSContextPointer, promise: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_TestStringArg: (string: string) => void;
    QTS_GetDebugLogEnabled: (rt: JSRuntimePointer) => number;
    QTS_SetDebugLogEnabled: (rt: JSRuntimePointer, is_enabled: number) => void;
    QTS_BuildIsDebug: () => number;
    QTS_BuildIsAsyncify: () => number;
    QTS_NewFunction: (ctx: JSContextPointer, name: string, arg_length: number, is_constructor: boolean, host_ref_id: HostRefId) => JSValuePointer;
    QTS_ArgvGetJSValueConstPointer: (argv: JSValuePointer | JSValueConstPointer, index: number) => JSValueConstPointer;
    QTS_RuntimeEnableInterruptHandler: (rt: JSRuntimePointer) => void;
    QTS_RuntimeDisableInterruptHandler: (rt: JSRuntimePointer) => void;
    QTS_RuntimeEnableModuleLoader: (rt: JSRuntimePointer, use_custom_normalize: number) => void;
    QTS_RuntimeDisableModuleLoader: (rt: JSRuntimePointer) => void;
    QTS_bjson_encode: (ctx: JSContextPointer, val: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    QTS_bjson_decode: (ctx: JSContextPointer, data: JSValuePointer | JSValueConstPointer) => JSValuePointer;
}

type EmscriptenImport<T extends EmscriptenModule> = EmscriptenModuleLoader<T> | {
    default: EmscriptenModuleLoader<T>;
} | {
    default: {
        default: EmscriptenModuleLoader<T>;
    };
};
/**
 * A standard (sync) build variant.
 *
 * quickjs-emscripten provides multiple build variants of the core WebAssembly
 * module. These variants are each intended for a different use case.
 *
 * To create an instance of the library using a specific build variant, pass the
 * build variant to {@link newQuickJSWASMModule} or {@link newQuickJSAsyncWASMModule}.
 */
interface QuickJSSyncVariant {
    readonly type: "sync";
    readonly importFFI: () => Promise<new (module: QuickJSEmscriptenModule) => QuickJSFFI>;
    readonly importModuleLoader: () => Promise<EmscriptenImport<QuickJSEmscriptenModule>>;
}
/**
 * An ASYNCIFY build variant.
 *
 * quickjs-emscripten provides multiple build variants of the core WebAssembly
 * module. These variants are each intended for a different use case.
 *
 * To create an instance of the library using a specific build variant, pass the
 * build variant to {@link newQuickJSWASMModule} or {@link newQuickJSAsyncWASMModule}.
 */
interface QuickJSAsyncVariant {
    readonly type: "async";
    readonly importFFI: () => Promise<new (module: QuickJSAsyncEmscriptenModule) => QuickJSAsyncFFI>;
    readonly importModuleLoader: () => Promise<EmscriptenImport<QuickJSAsyncEmscriptenModule>>;
}
type QuickJSVariant = QuickJSSyncVariant | QuickJSAsyncVariant;
type EitherFFI = QuickJSFFI | QuickJSAsyncFFI;

export { type Asyncify, type AsyncifySleepResult, type BorrowedHeapCharPointer, type EitherFFI, type EitherModule, type EmscriptenModule, type EmscriptenModuleCallbacks, type EmscriptenModuleLoader, type EmscriptenModuleLoaderOptions, type EvalDetectModule, EvalFlags, GetOwnPropertyNamesFlags, type HostRefId, IntrinsicsFlags, IsEqualOp, type JSBorrowedCharPointer, type JSContextPointer, type JSContextPointerPointer, type JSModuleDefPointer, JSPromiseStateEnum, type JSRuntimePointer, type JSValueConstPointer, type JSValueConstPointerPointer, type JSValuePointer, type JSValuePointerPointer, type JSValuePointerPointerPointer, type JSVoidPointer, type OwnedHeapCharPointer, type QTS_C_To_HostCallbackFuncPointer, type QTS_C_To_HostInterruptFuncPointer, type QTS_C_To_HostLoadModuleFuncPointer, type QuickJSAsyncEmscriptenModule, type QuickJSAsyncFFI, type QuickJSAsyncVariant, type QuickJSEmscriptenExtensions, type QuickJSEmscriptenModule, type QuickJSFFI, type QuickJSSyncVariant, type QuickJSVariant, type SourceMapData, type UInt32Pointer, assertSync };
