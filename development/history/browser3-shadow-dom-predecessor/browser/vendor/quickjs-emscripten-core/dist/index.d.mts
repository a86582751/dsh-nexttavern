import * as _jitl_quickjs_ffi_types from '@jitl/quickjs-ffi-types';
import { EitherModule, JSValueConstPointerPointer, OwnedHeapCharPointer, JSVoidPointer, HostRefId, EitherFFI, JSRuntimePointer, JSContextPointer, QuickJSAsyncEmscriptenModule, QuickJSAsyncFFI, JSValueConstPointer, JSValuePointer, UInt32Pointer, JSBorrowedCharPointer, EmscriptenModuleCallbacks, Asyncify, AsyncifySleepResult, QuickJSSyncVariant, QuickJSAsyncVariant, SourceMapData, EmscriptenModuleLoaderOptions, QuickJSVariant } from '@jitl/quickjs-ffi-types';
export * from '@jitl/quickjs-ffi-types';
export { QuickJSAsyncVariant, QuickJSSyncVariant, QuickJSVariant } from '@jitl/quickjs-ffi-types';

/**
 * Used as an optional.
 * `{ value: S } | { error: E }`.
 */
type SuccessOrFail<S, F> = {
    value: S;
    error?: undefined;
} | {
    error: F;
};
declare function isSuccess<S, F>(successOrFail: SuccessOrFail<S, F>): successOrFail is {
    value: S;
};
declare function isFail<S, F>(successOrFail: SuccessOrFail<S, F>): successOrFail is {
    error: F;
};
/**
 * Used as an optional for results of a Vm call.
 * `{ value: VmHandle } | { error: VmHandle }`.
 */
type VmCallResult<VmHandle> = SuccessOrFail<VmHandle, VmHandle>;
/**
 * A VmFunctionImplementation takes handles as arguments.
 * It should return a handle, or be void.
 *
 * To indicate an exception, a VMs can throw either a handle (transferred
 * directly) or any other Javascript value (only the poperties `name` and
 * `message` will be transferred). Or, the VmFunctionImplementation may return
 * a VmCallResult's `{ error: handle }` error variant.
 *
 * VmFunctionImplementation should not free its arguments or its return value.
 * It should not retain a reference to its return value or thrown error.
 */
type VmFunctionImplementation<VmHandle> = (this: VmHandle, ...args: VmHandle[]) => VmHandle | VmCallResult<VmHandle> | void;
/**
 * A minimal interface to a Javascript execution environment.
 *
 * Higher-level tools should build over the LowLevelJavascriptVm interface to
 * share as much as possible between executors.
 *
 * From https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
 */
interface LowLevelJavascriptVm<VmHandle> {
    global: VmHandle;
    undefined: VmHandle;
    typeof(handle: VmHandle): string;
    getNumber(handle: VmHandle): number;
    getString(handle: VmHandle): string;
    newNumber(value: number): VmHandle;
    newString(value: string): VmHandle;
    newObject(prototype?: VmHandle): VmHandle;
    newFunction(name: string, value: VmFunctionImplementation<VmHandle>): VmHandle;
    getProp(handle: VmHandle, key: string | VmHandle): VmHandle;
    setProp(handle: VmHandle, key: string | VmHandle, value: VmHandle): void;
    defineProp(handle: VmHandle, key: string | VmHandle, descriptor: VmPropertyDescriptor<VmHandle>): void;
    callFunction(func: VmHandle, thisVal: VmHandle, ...args: VmHandle[]): VmCallResult<VmHandle>;
    evalCode(code: string, filename?: string): VmCallResult<VmHandle>;
}
/**
 * From https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
 */
interface VmPropertyDescriptor<VmHandle> {
    value?: VmHandle;
    configurable?: boolean;
    enumerable?: boolean;
    get?: (this: VmHandle) => VmHandle;
    set?: (this: VmHandle, value: VmHandle) => void;
}

declare function awaitYield<T>(value: T | Promise<T>): Generator<T | Promise<T>, T, T>;
declare function awaitYieldOf<T, Yielded>(generator: Generator<Yielded | Promise<Yielded>, T, Yielded>): Generator<T | Promise<T>, T, T>;
type AwaitYield = typeof awaitYield & {
    of: typeof awaitYieldOf;
};
type MaybeAsyncBlock<Return, This, Yielded, Args extends any[] = []> = (this: This, awaited: AwaitYield, ...args: Args) => Generator<Yielded | Promise<Yielded>, Return, Yielded>;

/**
 * @private
 */
type HeapUint8Array = {
    pointer: JSVoidPointer;
    numBytes: number;
};
/**
 * Add more types as needed.
 * @private
 */
type TypedArray = Int32Array | Uint32Array;
/** @private */
interface TypedArrayConstructor<T> {
    new (length: number): T;
    new (array: ArrayLike<number> | ArrayBufferLike): T;
    new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    BYTES_PER_ELEMENT: number;
}
/** @private */
type HeapTypedArray<JS extends TypedArray, C extends number> = Lifetime<{
    typedArray: JS;
    ptr: C;
}>;
/**
 * @private
 */
declare class ModuleMemory {
    module: EitherModule;
    constructor(module: EitherModule);
    toPointerArray(handleArray: QuickJSHandle[]): Lifetime<JSValueConstPointerPointer>;
    newTypedArray<JS extends TypedArray, C extends number>(kind: TypedArrayConstructor<JS>, length: number): HeapTypedArray<JS, C>;
    newMutablePointerArray<T extends number>(length: number): Lifetime<{
        typedArray: Int32Array;
        ptr: T;
    }>;
    newHeapCharPointer(string: string): Lifetime<{
        ptr: OwnedHeapCharPointer;
        strlen: number;
    }>;
    newHeapBufferPointer(buffer: Uint8Array): Lifetime<HeapUint8Array>;
    consumeHeapCharPointer(ptr: OwnedHeapCharPointer): string;
}

/**
 * HostRefMap stores references to host JavaScript based on an auto-incrementing id.
 */
declare class HostRefMap {
    private nextId;
    private freelist;
    private groups;
    put(value: object): HostRefId;
    get(id: HostRefId): object;
    delete(id: HostRefId): void;
    private allocateId;
}
/**
 * HostRef represents a reference to a host value from a QuickJS guest.
 *
 * The host value is stored with a strong reference in a map within the runtime.
 * Once all references to the HostRef's handle are disposed and there are no
 * more references from the guest, the host value will be removed from the map.
 *
 * This abstraction allows passing values to the guest that need to keep a host
 * value alive for their method callbacks.
 *
 * Note that there may be multiple HostRef instances pointing to the same host
 * value slot in the runtime.
 */
declare class HostRef<T extends object> extends UsingDisposable implements Disposable {
    readonly runtime: QuickJSRuntime;
    readonly handle: QuickJSHandle;
    readonly id: HostRefId;
    constructor(runtime: QuickJSRuntime, handle: QuickJSHandle, id: HostRefId);
    /** true if *this instance's* handle is alive */
    get alive(): boolean;
    /** Dispose this instance's handle */
    dispose(): void;
    /**
     * Retrieve the host value
     * @throws {@link QuickJSHostRefInvalid} if the host value was freed once all reference handles were disposed
     */
    get value(): T;
}

/**
 * Callback called regularly while the VM executes code.
 * Determines if a VM's execution should be interrupted.
 *
 * @returns `true` to interrupt JS execution inside the VM.
 * @returns `false` or `undefined` to continue JS execution inside the VM.
 */
type InterruptHandler = (runtime: QuickJSRuntime) => boolean | undefined | void;
/**
 * Used as an optional for the results of executing pendingJobs.
 * On success, `value` contains the number of async jobs executed
 * by the runtime.
 * @source
 */
type ExecutePendingJobsResult = DisposableResult<
/** Number of jobs successfully executed. */
number, 
/** The error that occurred. */
QuickJSHandle & {
    /** The context where the error occurred. */
    context: QuickJSContext;
}>;
/**
 * A runtime represents a Javascript runtime corresponding to an object heap.
 * Several runtimes can exist at the same time but they cannot exchange objects.
 * Inside a given runtime, no multi-threading is supported.
 *
 * You can think of separate runtimes like different domains in a browser, and
 * the contexts within a runtime like the different windows open to the same
 * domain.
 *
 * Create a runtime via {@link QuickJSWASMModule.newRuntime}.
 *
 * You should create separate runtime instances for untrusted code from
 * different sources for isolation. However, stronger isolation is also
 * available (at the cost of memory usage), by creating separate WebAssembly
 * modules to further isolate untrusted code.
 * See {@link newQuickJSWASMModule}.
 *
 * Implement memory and CPU constraints with {@link setInterruptHandler}
 * (called regularly while the interpreter runs), {@link setMemoryLimit}, and
 * {@link setMaxStackSize}.
 * Use {@link computeMemoryUsage} or {@link dumpMemoryUsage} to guide memory limit
 * tuning.
 *
 * Configure ES module loading with {@link setModuleLoader}.
 */
declare class QuickJSRuntime extends UsingDisposable implements Disposable$1 {
    /**
     * If this runtime was created as as part of a context, points to the context
     * associated with the runtime.
     *
     * If this runtime was created stand-alone, this may or may not contain a context.
     * A context here may be allocated if one is needed by the runtime, eg for {@link computeMemoryUsage}.
     */
    context: QuickJSContext | undefined;
    /** @private */
    protected module: EitherModule;
    /** @private */
    protected memory: ModuleMemory;
    /** @private */
    protected ffi: EitherFFI;
    /** @private */
    protected rt: Lifetime<JSRuntimePointer>;
    /** @private */
    protected callbacks: QuickJSModuleCallbacks;
    /** @private */
    protected scope: Scope;
    /** @private */
    protected contextMap: Map<JSContextPointer, QuickJSContext>;
    /** @private */
    protected moduleLoader: JSModuleLoader | undefined;
    /** @private */
    protected moduleNormalizer: JSModuleNormalizer | undefined;
    /** @private */
    hostRefs: HostRefMap;
    /** @private */
    constructor(args: {
        module: EitherModule;
        ffi: EitherFFI;
        rt: Lifetime<JSRuntimePointer>;
        callbacks: QuickJSModuleCallbacks;
        ownedLifetimes?: Disposable$1[];
    });
    get alive(): boolean;
    dispose(): void;
    /**
     * Create a new context within this runtime. Contexts have isolated globals,
     * but you can explicitly share objects between contexts with the same
     * runtime.
     *
     * You should dispose a created context before disposing this runtime.
     */
    newContext(options?: ContextOptions): QuickJSContext;
    /**
     * Set the loader for EcmaScript modules requested by any context in this
     * runtime.
     *
     * The loader can be removed with {@link removeModuleLoader}.
     */
    setModuleLoader(moduleLoader: JSModuleLoader, moduleNormalizer?: JSModuleNormalizer): void;
    /**
     * Remove the the loader set by {@link setModuleLoader}. This disables module loading.
     */
    removeModuleLoader(): void;
    /**
     * In QuickJS, promises and async functions create pendingJobs. These do not execute
     * immediately and need to be run by calling {@link executePendingJobs}.
     *
     * @return true if there is at least one pendingJob queued up.
     */
    hasPendingJob(): boolean;
    private interruptHandler;
    /**
     * Set a callback which is regularly called by the QuickJS engine when it is
     * executing code. This callback can be used to implement an execution
     * timeout.
     *
     * The interrupt handler can be removed with {@link removeInterruptHandler}.
     */
    setInterruptHandler(cb: InterruptHandler): void;
    /**
     * Remove the interrupt handler, if any.
     * See {@link setInterruptHandler}.
     */
    removeInterruptHandler(): void;
    /**
     * Execute pendingJobs on the runtime until `maxJobsToExecute` jobs are
     * executed (default all pendingJobs), the queue is exhausted, or the runtime
     * encounters an exception.
     *
     * In QuickJS, promises and async functions *inside the runtime* create
     * pendingJobs. These do not execute immediately and need to triggered to run.
     *
     * @param maxJobsToExecute - When negative, run all pending jobs. Otherwise execute
     * at most `maxJobsToExecute` before returning.
     *
     * @return On success, the number of executed jobs. On error, the exception
     * that stopped execution, and the context it occurred in. Note that
     * executePendingJobs will not normally return errors thrown inside async
     * functions or rejected promises. Those errors are available by calling
     * {@link QuickJSContext#resolvePromise} on the promise handle returned by the async function.
     */
    executePendingJobs(maxJobsToExecute?: number | void): ExecutePendingJobsResult;
    /**
     * Set the max memory this runtime can allocate.
     * To remove the limit, set to `-1`.
     */
    setMemoryLimit(limitBytes: number): void;
    /**
     * Compute memory usage for this runtime. Returns the result as a handle to a
     * JSValue object. Use {@link QuickJSContext#dump} to convert to a native object.
     * Calling this method will allocate more memory inside the runtime. The information
     * is accurate as of just before the call to `computeMemoryUsage`.
     * For a human-digestible representation, see {@link dumpMemoryUsage}.
     */
    computeMemoryUsage(): QuickJSHandle;
    /**
     * @returns a human-readable description of memory usage in this runtime.
     * For programmatic access to this information, see {@link computeMemoryUsage}.
     */
    dumpMemoryUsage(): string;
    /**
     * Set the max stack size for this runtime, in bytes.
     * To remove the limit, set to `0`.
     */
    setMaxStackSize(stackSize: number): void;
    /**
     * Assert that `handle` is owned by this runtime.
     * @throws QuickJSWrongOwner if owned by a different runtime.
     */
    assertOwned(handle: QuickJSHandle): void;
    private _debugMode;
    /**
     * Enable or disable debug logging.
     *
     * If this module is a DEBUG variant, more logs will be printed from the C
     * code.
     */
    setDebugMode(enabled: boolean): void;
    /**
     * @returns true if debug logging is enabled
     */
    isDebugMode(): boolean;
    /**
     * In debug mode, log the result of calling `msg()`.
     *
     * We take a function instead of a log message to avoid expensive string
     * manipulation if debug logging is disabled.
     */
    debugLog(...msg: unknown[]): void;
    private getSystemContext;
    private cToHostCallbacks;
}

declare class QuickJSAsyncRuntime extends QuickJSRuntime {
    context: QuickJSAsyncContext | undefined;
    /** @private */
    protected module: QuickJSAsyncEmscriptenModule;
    /** @private */
    protected ffi: QuickJSAsyncFFI;
    /** @private */
    protected rt: Lifetime<JSRuntimePointer>;
    /** @private */
    protected callbacks: QuickJSModuleCallbacks;
    /** @private */
    protected contextMap: Map<JSContextPointer, QuickJSAsyncContext>;
    /** @private */
    constructor(args: {
        module: QuickJSAsyncEmscriptenModule;
        ffi: QuickJSAsyncFFI;
        rt: Lifetime<JSRuntimePointer>;
        callbacks: QuickJSModuleCallbacks;
    });
    newContext(options?: ContextOptions): QuickJSAsyncContext;
    setModuleLoader(moduleLoader: JSModuleLoaderAsync, moduleNormalizer?: JSModuleNormalizerAsync): void;
    /**
     * Set the max stack size for this runtime in bytes.
     * To remove the limit, set to `0`.
     *
     * Setting this limit also adjusts the global `ASYNCIFY_STACK_SIZE` for the entire {@link QuickJSAsyncWASMModule}.
     * See the [pull request](https://github.com/justjake/quickjs-emscripten/pull/114) for more details.
     */
    setMaxStackSize(stackSize: number): void;
}

type AsyncFunctionImplementation = (this: QuickJSHandle, ...args: QuickJSHandle[]) => Promise<QuickJSHandle | VmCallResult<QuickJSHandle> | void>;
/**
 * Asyncified version of {@link QuickJSContext}.
 *
 * *Asyncify* allows normally synchronous code to wait for asynchronous Promises
 * or callbacks. The asyncified version of QuickJSContext can wait for async
 * host functions as though they were synchronous.
 */
declare class QuickJSAsyncContext extends QuickJSContext {
    runtime: QuickJSAsyncRuntime;
    /** @private */
    protected module: QuickJSAsyncEmscriptenModule;
    /** @private */
    protected ffi: QuickJSAsyncFFI;
    /** @private */
    protected rt: Lifetime<JSRuntimePointer>;
    /** @private */
    protected callbacks: QuickJSModuleCallbacks;
    /**
     * Asyncified version of {@link evalCode}.
     */
    evalCodeAsync(code: string, filename?: string, 
    /** See {@link EvalFlags} for number semantics */
    options?: number | ContextEvalOptions): Promise<QuickJSContextResult<QuickJSHandle>>;
    /**
     * Similar to {@link newFunction}.
     * Convert an async host Javascript function into a synchronous QuickJS function value.
     *
     * Whenever QuickJS calls this function, the VM's stack will be unwound while
     * waiting the async function to complete, and then restored when the returned
     * promise resolves.
     *
     * Asyncified functions must never call other asyncified functions or
     * `import`, even indirectly, because the stack cannot be unwound twice.
     *
     * See [Emscripten's docs on Asyncify](https://emscripten.org/docs/porting/asyncify.html).
     */
    newAsyncifiedFunction(name: string, fn: AsyncFunctionImplementation): QuickJSHandle;
}

/**
 * A QuickJSHandle to a constant that will never change, and does not need to
 * be disposed.
 */
type StaticJSValue = Lifetime<JSValueConstPointer, JSValueConstPointer, QuickJSRuntime>;
/**
 * A QuickJSHandle to a borrowed value that does not need to be disposed.
 *
 * In QuickJS, a JSValueConst is a "borrowed" reference that isn't owned by the
 * current scope. That means that the current scope should not `JS_FreeValue`
 * it, or retain a reference to it after the scope exits, because it may be
 * freed by its owner.
 *
 * quickjs-emscripten takes care of disposing JSValueConst references.
 */
type JSValueConst = Lifetime<JSValueConstPointer, JSValuePointer, QuickJSRuntime>;
/**
 * A owned QuickJSHandle that should be disposed or returned.
 *
 * The QuickJS interpreter passes Javascript values between functions as
 * `JSValue` structs that references some internal data. Because passing
 * structs cross the Empscripten FFI interfaces is bothersome, we use pointers
 * to these structs instead.
 *
 * A JSValue reference is "owned" in its scope. before exiting the scope, it
 * should be freed,  by calling `JS_FreeValue(ctx, js_value)`) or returned from
 * the scope. We extend that contract - a JSValuePointer (`JSValue*`) must also
 * be `free`d.
 *
 * You can do so from Javascript by calling the .dispose() method.
 */
type JSValue = Lifetime<JSValuePointer, JSValuePointer, QuickJSRuntime>;
/**
 * Wraps a C pointer to a QuickJS JSValue, which represents a Javascript value inside
 * a QuickJS virtual machine.
 *
 * Values must not be shared between QuickJSContext instances.
 * You must dispose of any handles you create by calling the `.dispose()` method.
 */
type QuickJSHandle = StaticJSValue | JSValue | JSValueConst;
type JSModuleLoadSuccess = string;
type JSModuleLoadFailure = Error | QuickJSHandle;
type JSModuleLoadResult = JSModuleLoadSuccess | SuccessOrFail<JSModuleLoadSuccess, JSModuleLoadFailure>;
interface JSModuleLoaderAsync {
    /** Load module (async) */
    (moduleName: string, context: QuickJSAsyncContext): JSModuleLoadResult | Promise<JSModuleLoadResult>;
}
interface JSModuleLoader {
    /** Load module (sync) */
    (moduleName: string, context: QuickJSContext): JSModuleLoadResult;
}
type JSModuleNormalizeSuccess = string;
type JSModuleNormalizeFailure = Error | QuickJSHandle;
type JSModuleNormalizeResult = JSModuleNormalizeSuccess | SuccessOrFail<JSModuleNormalizeSuccess, JSModuleNormalizeFailure>;
interface JSModuleNormalizerAsync {
    (baseModuleName: string, requestedName: string, vm: QuickJSAsyncContext): JSModuleNormalizeResult | Promise<JSModuleNormalizeResult>;
}
interface JSModuleNormalizer extends JSModuleNormalizerAsync {
    (baseModuleName: string, requestedName: string, vm: QuickJSContext): JSModuleNormalizeResult;
}
type TODO<hint extends string = "?", typeHint = unknown> = hint & typeHint & never;
interface RuntimeOptionsBase {
    interruptHandler?: InterruptHandler;
    maxStackSizeBytes?: number;
    memoryLimitBytes?: number;
    promiseRejectionHandler?: TODO<"JSHostPromiseRejectionTracker">;
    runtimeInfo?: TODO<"JS_SetRuntimeInfo", string>;
    gcThreshold?: TODO<"JS_SetGCThreshold", number>;
    sharedArrayBufferFunctions?: TODO<"JS_SetJSSharedArrayBufferFunctions", {
        sab_alloc: TODO;
        sab_free: TODO;
        sab_dup: TODO;
        sab_opaque: TODO;
    }>;
    /**
     * Extra lifetimes the runtime should dispose of after it is destroyed.
     * @private
     */
    ownedLifetimes?: Disposable$1[];
}
interface RuntimeOptions extends RuntimeOptionsBase {
    moduleLoader?: JSModuleLoader;
}
interface AsyncRuntimeOptions extends RuntimeOptionsBase {
    moduleLoader?: JSModuleLoaderAsync | JSModuleLoader;
}
/**
 * Language features that can be enabled or disabled in a QuickJSContext.
 * @see {@link ContextOptions}
 */
type Intrinsics = {
    BaseObjects?: boolean;
    Date?: boolean;
    Eval?: boolean;
    StringNormalize?: boolean;
    RegExp?: boolean;
    RegExpCompiler?: boolean;
    JSON?: boolean;
    Proxy?: boolean;
    MapSet?: boolean;
    TypedArrays?: boolean;
    Promise?: boolean;
    BigInt?: boolean;
    BigFloat?: boolean;
    BigDecimal?: boolean;
    OperatorOverloading?: boolean;
    BignumExt?: boolean;
};
/**
 * The default {@link Intrinsics} language features enabled in a QuickJSContext.
 * @see {@link ContextOptions}
 */
declare const DefaultIntrinsics: Readonly<{
    readonly BaseObjects: true;
    readonly Date: true;
    readonly Eval: true;
    readonly StringNormalize: true;
    readonly RegExp: true;
    readonly JSON: true;
    readonly Proxy: true;
    readonly MapSet: true;
    readonly TypedArrays: true;
    readonly Promise: true;
}>;
/**
 * Options for creating a {@link QuickJSContext} or {@link QuickJSAsyncContext}
 * Pass to {@link QuickJSRuntime#newContext}.
 */
interface ContextOptions {
    /**
     * What built-in objects and language features to enable?
     * If unset, the default intrinsics will be used.
     * To omit all intrinsics, pass an empty array.
     *
     * To remove a specific intrinsic, but retain the other defaults,
     * override it from {@link DefaultIntrinsics}
     * ```ts
     * const contextWithoutDateOrEval = runtime.newContext({
     *   intrinsics: {
     *     ...DefaultIntrinsics,
     *     Date: false,
     *   }
     * })
     * ```
     */
    intrinsics?: Intrinsics;
    /**
     * Wrap the provided context instead of constructing a new one.
     * @private
     */
    contextPointer?: JSContextPointer;
    /**
     * Extra lifetimes the context should dispose of after it is destroyed.
     * @private
     */
    ownedLifetimes?: Disposable$1[];
}
interface ContextEvalOptions {
    /**
     * Global code (default), or "module" code?
     *
     * - When type is `"global"`, the code is evaluated in the global scope of the QuickJSContext, and the return value is the result of the last expression.
     * - When type is `"module"`, the code is evaluated is a module scope, may use `import`, `export`, and top-level `await`. The return value is the module's exports, or a promise for the module's exports.
     */
    type?: "global" | "module";
    /** Force "strict" mode */
    strict?: boolean;
    /** Force "strip" mode */
    strip?: boolean;
    /**
     * compile but do not run. The result is an object with a
     * JS_TAG_FUNCTION_BYTECODE or JS_TAG_MODULE tag. It can be executed
     * with JS_EvalFunction().
     */
    compileOnly?: boolean;
    /** don't include the stack frames before this eval in the Error() backtraces */
    backtraceBarrier?: boolean;
}
interface GetOwnPropertyNamesOptions {
    /** Include number properties like array indexes *as numbers* in the result. This is not standards-compliant */
    numbers?: boolean;
    /** Enable standards-compliant number properties. When set, `includeNumbers` is ignored. */
    numbersAsStrings?: boolean;
    /** Include strings in the result */
    strings?: boolean;
    /** Include symbols in the result */
    symbols?: boolean;
    /** Include implementation-specific private properties in the result */
    quickjsPrivate?: boolean;
    /** Only include the enumerable properties */
    onlyEnumerable?: boolean;
}
type PromiseExecutor<ResolveT, RejectT> = (resolve: (value: ResolveT | PromiseLike<ResolveT>) => void, reject: (reason: RejectT) => void) => void;

/**
 * An object that can be disposed.
 * {@link Lifetime} is the canonical implementation of Disposable.
 * Use {@link Scope} to manage cleaning up multiple disposables.
 */
interface Disposable$1 {
    /**
     * Dispose of the underlying resources used by this object.
     */
    dispose(): void;
    /**
     * @returns true if the object is alive
     * @returns false after the object has been {@link dispose}d
     */
    alive: boolean;
    /**
     * A method that is used to release resources held by an object. Called by the semantics of the `using` statement.
     */
    [Symbol.dispose](): void;
}
/**
 * Base abstract class that helps implement {@link Disposable} by providing a default implementation of {@link Symbol.dispose}.
 */
declare abstract class UsingDisposable implements Disposable$1 {
    /**
     * @returns true if the object is alive
     * @returns false after the object has been {@link dispose}d
     */
    abstract readonly alive: boolean;
    /**
     * Dispose of the underlying resources used by this object.
     */
    abstract dispose(): void;
    /**
     * Just calls the standard .dispose() method of this class.
     */
    [Symbol.dispose](): void;
}
/**
 * A lifetime prevents access to a value after the lifetime has been
 * {@link dispose}ed.
 *
 * Typically, quickjs-emscripten uses Lifetimes to protect C memory pointers.
 */
declare class Lifetime<T, TCopy = never, Owner = never> extends UsingDisposable implements Disposable$1 {
    protected readonly _value: T;
    protected readonly copier?: ((value: T | TCopy) => TCopy) | undefined;
    protected readonly disposer?: ((value: T | TCopy) => void) | undefined;
    protected readonly _owner?: Owner | undefined;
    protected _alive: boolean;
    protected _constructorStack: string | undefined;
    /**
     * When the Lifetime is disposed, it will call `disposer(_value)`. Use the
     * disposer function to implement whatever cleanup needs to happen at the end
     * of `value`'s lifetime.
     *
     * `_owner` is not used or controlled by the lifetime. It's just metadata for
     * the creator.
     */
    constructor(_value: T, copier?: ((value: T | TCopy) => TCopy) | undefined, disposer?: ((value: T | TCopy) => void) | undefined, _owner?: Owner | undefined);
    get alive(): boolean;
    /**
     * The value this Lifetime protects. You must never retain the value - it
     * may become invalid, leading to memory errors.
     *
     * @throws If the lifetime has been {@link dispose}d already.
     */
    get value(): T;
    get owner(): Owner | undefined;
    get dupable(): boolean;
    /**
     * Create a new handle pointing to the same {@link value}.
     */
    dup(): Lifetime<TCopy, TCopy, Owner>;
    /**
     * Call `map` with this lifetime, then dispose the lifetime.
     * @return the result of `map(this)`.
     */
    consume<O>(map: (lifetime: this) => O): O;
    consume<O>(map: (lifetime: QuickJSHandle) => O): O;
    /**
     * Call `map` with this lifetime, returning the result.
     * Does not dispose the lifetime.
     * @return the result of `map(this)`.
     */
    map<O>(map: (lifetime: this) => O): O;
    map<O>(map: (lifetime: QuickJSHandle) => O): O;
    /**
     * Call `fn` with this lifetime, then return `this`. Does not dispose the
     * lifetime. Useful for imperative operations within an expression, like when
     * you're building up objects, or to add logging in the middle of a call chain.
     * @returns this
     */
    tap(fn: (lifetime: this) => void): this;
    tap(fn: (lifetime: QuickJSHandle) => void): QuickJSHandle;
    /**
     * Dispose of {@link value} and perform cleanup.
     */
    dispose(): void;
    protected assertAlive(): void;
}
/**
 * A Lifetime that lives forever. Used for constants.
 */
declare class StaticLifetime<T, Owner = never> extends Lifetime<T, T, Owner> {
    constructor(value: T, owner?: Owner);
    get dupable(): boolean;
    dup(): this;
    dispose(): void;
}
/**
 * A Lifetime that does not own its `value`. A WeakLifetime never calls its
 * `disposer` function, but can be `dup`ed to produce regular lifetimes that
 * do.
 *
 * Used for function arguments.
 */
declare class WeakLifetime<T, TCopy = never, Owner = never> extends Lifetime<T, TCopy, Owner> {
    constructor(value: T, copier?: (value: T | TCopy) => TCopy, disposer?: (value: TCopy) => void, owner?: Owner);
    dispose(): void;
}
/**
 * Scope helps reduce the burden of manually tracking and disposing of
 * Lifetimes. See {@link withScope}. and {@link withScopeAsync}.
 */
declare class Scope extends UsingDisposable implements Disposable$1 {
    /**
     * Run `block` with a new Scope instance that will be disposed after the block returns.
     * Inside `block`, call `scope.manage` on each lifetime you create to have the lifetime
     * automatically disposed after the block returns.
     *
     * @warning Do not use with async functions. Instead, use {@link withScopeAsync}.
     */
    static withScope<R>(block: (scope: Scope) => R): R;
    static withScopeMaybeAsync<Return, This, Yielded>(_this: This, block: MaybeAsyncBlock<Return, This, Yielded, [Scope]>): Return | Promise<Return>;
    /**
     * Run `block` with a new Scope instance that will be disposed after the
     * block's returned promise settles. Inside `block`, call `scope.manage` on each
     * lifetime you create to have the lifetime automatically disposed after the
     * block returns.
     */
    static withScopeAsync<R>(block: (scope: Scope) => Promise<R>): Promise<R>;
    private _disposables;
    /**
     * Track `lifetime` so that it is disposed when this scope is disposed.
     */
    manage: <T extends Disposable$1>(lifetime: T) => T;
    get alive(): boolean;
    dispose(): void;
}
/**
 * An `Array` that also implements {@link Disposable}:
 *
 * - Considered {@link Disposable#alive} if any of its elements are `alive`.
 * - When {@link Disposable#dispose}d, it will dispose of all its elements that are `alive`.
 */
type DisposableArray<T> = T[] & Disposable$1;
/**
 * Create an array that also implements {@link Disposable}.
 */
declare function createDisposableArray<T extends Disposable$1>(items?: Iterable<T>): DisposableArray<T>;
declare abstract class AbstractDisposableResult extends UsingDisposable implements Disposable$1 {
    static success<S, F>(value: S): DisposableSuccess<S>;
    static fail<S, F>(error: F, onUnwrap: (status: SuccessOrFail<S, F>) => void): DisposableFail<F>;
    static is<S, F>(result: SuccessOrFail<S, F>): result is DisposableResult<S, F>;
    abstract get alive(): boolean;
    abstract dispose(): void;
}
declare class DisposableSuccess<S> extends AbstractDisposableResult {
    readonly value: S;
    error?: undefined;
    constructor(value: S);
    get alive(): boolean;
    dispose(): void;
    unwrap(): S;
    unwrapOr<T>(_fallback: T): S | T;
}
declare class DisposableFail<F> extends AbstractDisposableResult {
    readonly error: F;
    private readonly onUnwrap;
    constructor(error: F, onUnwrap: (status: SuccessOrFail<never, F>) => void);
    get alive(): boolean;
    dispose(): void;
    unwrap(): never;
    unwrapOr<T>(fallback: T): T;
}
type DisposableResult<S, F> = DisposableSuccess<S> | DisposableFail<F>;
declare const DisposableResult: typeof AbstractDisposableResult;

/**
 * A promise state inside QuickJS, which can be pending, fulfilled, or rejected.
 * You can unwrap a JSPromiseState with {@link QuickJSContext#unwrapResult}.
 */
type JSPromiseState = JSPromiseStatePending | JSPromiseStateFulfilled | JSPromiseStateRejected;
/**
 * Pending promise state.
 * See {@link JSPromiseState}.
 */
interface JSPromiseStatePending {
    type: "pending";
    /**
     * The error property here allows unwrapping a JSPromiseState with {@link QuickJSContext#unwrapResult}.
     * Unwrapping a pending promise will throw a {@link QuickJSPromisePending} error.
     */
    get error(): Error;
}
/**
 * Fulfilled promise state.
 * See {@link JSPromiseState}.
 */
interface JSPromiseStateFulfilled {
    type: "fulfilled";
    value: QuickJSHandle;
    error?: undefined;
    /** Trying to get the promise state of a non-Promise value returns a fulfilled state with the original value, and `notAPromise: true`. */
    notAPromise?: boolean;
}
/**
 * Rejected promise state.
 * See {@link JSPromiseState}.
 */
interface JSPromiseStateRejected {
    type: "rejected";
    error: QuickJSHandle;
}
/**
 * QuickJSDeferredPromise wraps a QuickJS promise {@link handle} and allows
 * {@link resolve}ing or {@link reject}ing that promise. Use it to bridge asynchronous
 * code on the host to APIs inside a QuickJSContext.
 *
 * Managing the lifetime of promises is tricky. There are three
 * {@link QuickJSHandle}s inside of each deferred promise object: (1) the promise
 * itself, (2) the `resolve` callback, and (3) the `reject` callback.
 *
 * - If the promise will be fulfilled before the end of it's {@link owner}'s lifetime,
 *   the only cleanup necessary is `deferred.handle.dispose()`, because
 *   calling {@link resolve} or {@link reject} will dispose of both callbacks automatically.
 *
 * - As the return value of a {@link VmFunctionImplementation}, return {@link handle},
 *   and ensure that either {@link resolve} or {@link reject} will be called. No other
 *   clean-up is necessary.
 *
 * - In other cases, call {@link dispose}, which will dispose {@link handle} as well as the
 *   QuickJS handles that back {@link resolve} and {@link reject}. For this object,
 *   {@link dispose} is idempotent.
 */
declare class QuickJSDeferredPromise extends UsingDisposable implements Disposable$1 {
    owner: QuickJSRuntime;
    context: QuickJSContext;
    /**
     * A handle of the Promise instance inside the QuickJSContext.
     * You must dispose {@link handle} or the entire QuickJSDeferredPromise once you
     * are finished with it.
     */
    handle: QuickJSHandle;
    /**
     * A native promise that will resolve once this deferred is settled.
     */
    settled: Promise<void>;
    private resolveHandle;
    private rejectHandle;
    private onSettled;
    /**
     * Use {@link QuickJSContext#newPromise} to create a new promise instead of calling
     * this constructor directly.
     */
    constructor(args: {
        context: QuickJSContext;
        promiseHandle: QuickJSHandle;
        resolveHandle: QuickJSHandle;
        rejectHandle: QuickJSHandle;
    });
    /**
     * Resolve {@link handle} with the given value, if any.
     * Calling this method after calling {@link dispose} is a no-op.
     *
     * Note that after resolving a promise, you may need to call
     * {@link QuickJSRuntime#executePendingJobs} to propagate the result to the promise's
     * callbacks.
     */
    resolve: (value?: QuickJSHandle) => void;
    /**
     * Reject {@link handle} with the given value, if any.
     * Calling this method after calling {@link dispose} is a no-op.
     *
     * Note that after rejecting a promise, you may need to call
     * {@link QuickJSRuntime#executePendingJobs} to propagate the result to the promise's
     * callbacks.
     */
    reject: (value?: QuickJSHandle) => void;
    get alive(): boolean;
    dispose: () => void;
    private disposeResolvers;
}

/**
 * Proxies the iteration protocol from the host to a guest iterator.
 * The guest iterator is a QuickJS object with a `next` method.
 * See [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).
 *
 * If calling the `next` method or any other method of the iteration protocol throws an error,
 * the iterator is disposed after returning the exception as the final value.
 *
 * When the iterator is done, the handle is disposed automatically.
 * The caller is responsible for disposing each successive value.
 *
 * ```typescript
 * for (const nextResult of context.unwrapResult(context.getIterator(arrayHandle)) {
 *   const nextHandle = context.unwrapResult(nextResult)
 *   try {
 *     // Do something with nextHandle
 *     console.log(context.dump(nextHandle))
 *   } finally {
 *     nextHandle.dispose()
 *   }
 * }
 * ```
 */
declare class QuickJSIterator extends UsingDisposable implements Disposable, IterableIterator<QuickJSContextResult<QuickJSHandle>> {
    handle: QuickJSHandle;
    context: QuickJSContext;
    owner: QuickJSRuntime;
    private _next;
    private _isDone;
    constructor(handle: QuickJSHandle, context: QuickJSContext);
    [Symbol.iterator](): this;
    next(value?: QuickJSHandle): IteratorResult<QuickJSContextResult<QuickJSHandle>, any>;
    return(value?: QuickJSHandle): IteratorResult<QuickJSContextResult<QuickJSHandle>, any>;
    throw(e?: any): IteratorResult<QuickJSContextResult<QuickJSHandle>, any>;
    get alive(): boolean;
    dispose(): void;
    private callIteratorMethod;
}

type QuickJSContextResult<S> = DisposableResult<S, QuickJSHandle>;
/**
 * Property key for getting or setting a property on a handle with
 * {@link QuickJSContext#getProp}, {@link QuickJSContext#setProp}, or {@link QuickJSContext#defineProp}.
 */
type QuickJSPropertyKey = number | string | QuickJSHandle;
/**
 * @private
 */
declare class ContextMemory extends ModuleMemory implements Disposable$1 {
    readonly owner: QuickJSRuntime;
    readonly ctx: Lifetime<JSContextPointer>;
    readonly rt: Lifetime<JSRuntimePointer>;
    readonly module: EitherModule;
    readonly ffi: EitherFFI;
    readonly scope: Scope;
    /** @private */
    constructor(args: {
        owner: QuickJSRuntime;
        module: EitherModule;
        ffi: EitherFFI;
        ctx: Lifetime<JSContextPointer>;
        rt: Lifetime<JSRuntimePointer>;
        ownedLifetimes?: Disposable$1[];
    });
    get alive(): boolean;
    dispose(): void;
    [Symbol.dispose](): void;
    /**
     * Track `lifetime` so that it is disposed when this scope is disposed.
     */
    manage<T extends Disposable$1>(lifetime: T): T;
    copyJSValue: (ptr: JSValuePointer | JSValueConstPointer) => JSValuePointer;
    freeJSValue: (ptr: JSValuePointer) => void;
    consumeJSCharPointer(ptr: JSBorrowedCharPointer): string;
    heapValueHandle(ptr: JSValuePointer, extraDispose?: () => void): JSValue;
    /** Manage a heap pointer with the lifetime of the context */
    staticHeapValueHandle(ptr: JSValuePointer | JSValueConstPointer): StaticJSValue;
}
/**
 * QuickJSContext wraps a QuickJS Javascript context (JSContext*) within a
 * runtime. The contexts within the same runtime may exchange objects freely.
 * You can think of separate runtimes like different domains in a browser, and
 * the contexts within a runtime like the different windows open to the same
 * domain. The {@link runtime} references the context's runtime.
 *
 * This class's methods return {@link QuickJSHandle}, which wrap C pointers (JSValue*).
 * It's the caller's responsibility to call `.dispose()` on any
 * handles you create to free memory once you're done with the handle.
 *
 * Use {@link QuickJSRuntime#newContext} or {@link QuickJSWASMModule#newContext}
 * to create a new QuickJSContext.
 *
 * Create QuickJS values inside the interpreter with methods like
 * {@link newNumber}, {@link newString}, {@link newArray}, {@link newObject},
 * {@link newFunction}, and {@link newPromise}.
 *
 * Call {@link setProp} or {@link defineProp} to customize objects. Use those methods
 * with {@link global} to expose the values you create to the interior of the
 * interpreter, so they can be used in {@link evalCode}.
 *
 * Use {@link evalCode} or {@link callFunction} to execute Javascript inside the VM. If
 * you're using asynchronous code inside the QuickJSContext, you may need to also
 * call {@link QuickJSRuntime#executePendingJobs}. Executing code inside the runtime returns a
 * result object representing successful execution or an error. You must dispose
 * of any such results to avoid leaking memory inside the VM.
 *
 * Implement memory and CPU constraints at the runtime level, using {@link runtime}.
 * See {@link QuickJSRuntime} for more information.
 *
 */
declare class QuickJSContext extends UsingDisposable implements LowLevelJavascriptVm<QuickJSHandle>, Disposable$1 {
    /**
     * The runtime that created this context.
     */
    readonly runtime: QuickJSRuntime;
    /** @private */
    protected readonly ctx: Lifetime<JSContextPointer>;
    /** @private */
    protected readonly rt: Lifetime<JSRuntimePointer>;
    /** @private */
    protected readonly module: EitherModule;
    /** @private */
    protected readonly ffi: EitherFFI;
    /** @private */
    protected memory: ContextMemory;
    /** @private */
    protected _undefined: QuickJSHandle | undefined;
    /** @private */
    protected _null: QuickJSHandle | undefined;
    /** @private */
    protected _false: QuickJSHandle | undefined;
    /** @private */
    protected _true: QuickJSHandle | undefined;
    /** @private */
    protected _global: QuickJSHandle | undefined;
    /** @private */
    protected _BigInt: QuickJSHandle | undefined;
    /** @private  */
    protected uint32Out: HeapTypedArray<Uint32Array, UInt32Pointer>;
    /** @private */
    protected _Symbol: QuickJSHandle | undefined;
    /** @private */
    protected _SymbolIterator: QuickJSHandle | undefined;
    /** @private */
    protected _SymbolAsyncIterator: QuickJSHandle | undefined;
    /**
     * Use {@link QuickJSRuntime#newContext} or {@link QuickJSWASMModule#newContext}
     * to create a new QuickJSContext.
     */
    constructor(args: {
        module: EitherModule;
        ffi: EitherFFI;
        ctx: Lifetime<JSContextPointer>;
        rt: Lifetime<JSRuntimePointer>;
        runtime: QuickJSRuntime;
        ownedLifetimes?: Disposable$1[];
        callbacks: QuickJSModuleCallbacks;
    });
    get alive(): boolean;
    /**
     * Dispose of this VM's underlying resources.
     *
     * @throws Calling this method without disposing of all created handles
     * will result in an error.
     */
    dispose(): void;
    /**
     * [`undefined`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined).
     */
    get undefined(): QuickJSHandle;
    /**
     * [`null`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null).
     */
    get null(): QuickJSHandle;
    /**
     * [`true`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/true).
     */
    get true(): QuickJSHandle;
    /**
     * [`false`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/false).
     */
    get false(): QuickJSHandle;
    /**
     * [`global`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects).
     * A handle to the global object inside the interpreter.
     * You can set properties to create global variables.
     */
    get global(): QuickJSHandle;
    /**
     * Converts a Javascript number into a QuickJS value.
     */
    newNumber(num: number): QuickJSHandle;
    /**
     * Create a QuickJS [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) value.
     */
    newString(str: string): QuickJSHandle;
    /**
     * Create a QuickJS [symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol) value.
     * No two symbols created with this function will be the same value.
     */
    newUniqueSymbol(description: string | symbol): QuickJSHandle;
    /**
     * Get a symbol from the [global registry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#shared_symbols_in_the_global_symbol_registry) for the given key.
     * All symbols created with the same key will be the same value.
     */
    newSymbolFor(key: string | symbol): QuickJSHandle;
    /**
     * Access a well-known symbol that is a property of the global Symbol object, like `Symbol.iterator`.
     */
    getWellKnownSymbol(name: string): QuickJSHandle;
    /**
     * Create a QuickJS [bigint](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) value.
     */
    newBigInt(num: bigint): QuickJSHandle;
    /**
     * `{}`.
     * Create a new QuickJS [object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer).
     *
     * @param prototype - Like [`Object.create`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create).
     */
    newObject(prototype?: QuickJSHandle): QuickJSHandle;
    /**
     * `[]`.
     * Create a new QuickJS [array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array).
     */
    newArray(): QuickJSHandle;
    /**
     *  Create a new QuickJS [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).
     */
    newArrayBuffer(buffer: ArrayBufferLike): QuickJSHandle;
    /**
     * Create a new {@link QuickJSDeferredPromise}. Use `deferred.resolve(handle)` and
     * `deferred.reject(handle)` to fulfill the promise handle available at `deferred.handle`.
     * Note that you are responsible for calling `deferred.dispose()` to free the underlying
     * resources; see the documentation on {@link QuickJSDeferredPromise} for details.
     */
    newPromise(): QuickJSDeferredPromise;
    /**
     * Create a new {@link QuickJSDeferredPromise} that resolves when the
     * given native Promise<QuickJSHandle> resolves. Rejections will be coerced
     * to a QuickJS error.
     *
     * You can still resolve/reject the created promise "early" using its methods.
     */
    newPromise(promise: Promise<QuickJSHandle>): QuickJSDeferredPromise;
    /**
     * Construct a new native Promise<QuickJSHandle>, and then convert it into a
     * {@link QuickJSDeferredPromise}.
     *
     * You can still resolve/reject the created promise "early" using its methods.
     */
    newPromise(newPromiseFn: PromiseExecutor<QuickJSHandle, Error | QuickJSHandle>): QuickJSDeferredPromise;
    /**
     * Convert a Javascript function into a QuickJS function value.
     * See {@link VmFunctionImplementation} for more details.
     *
     * A {@link VmFunctionImplementation} should not free its arguments or its return
     * value. A VmFunctionImplementation should also not retain any references to
     * its return value.
     *
     * For constructors (functions that will be called with `new ...`), use {@link newConstructorFunction}.
     *
     * The function argument handles are automatically disposed when the function
     * returns. If you want to retain a handle beyond the end of the function, you
     * can call {@link Lifetime#dup} to create a copy of the handle that you own
     * and must dispose manually. For example, you need to use this API and do some
     * extra book keeping to implement `setInterval`:
     *
     * ```typescript
     * // This won't work because `callbackHandle` expires when the function returns,
     * // so when the interval fires, the callback handle is already disposed.
     * const WRONG_setIntervalHandle = context.newFunction("setInterval", (callbackHandle, delayHandle) => {
     *   const delayMs = context.getNumber(delayHandle)
     *   const intervalId = globalThis.setInterval(() => {
     *     // ERROR: callbackHandle is already disposed here.
     *     context.callFunction(callbackHandle)
     *   }, intervalId)
     *   return context.newNumber(intervalId)
     * })
     *
     * // This works since we dup the callbackHandle.
     * // We just need to make sure we clean it up manually when the interval is cleared --
     * // so we need to keep track of those interval IDs, and make sure we clean all
     * // of them up when we dispose the owning context.
     *
     * const setIntervalHandle = context.newFunction("setInterval", (callbackHandle, delayHandle) => {
     *   // Ensure the guest can't overload us by scheduling too many intervals.
     *   if (QuickJSInterval.INTERVALS.size > 100) {
     *     throw new Error(`Too many intervals scheduled already`)
     *   }
     *
     *   const delayMs = context.getNumber(delayHandle)
     *   const longLivedCallbackHandle = callbackHandle.dup()
     *   const intervalId = globalThis.setInterval(() => {
     *     context.callFunction(longLivedCallbackHandle)
     *   }, intervalId)
     *   const disposable = new QuickJSInterval(longLivedCallbackHandle, context, intervalId)
     *   QuickJSInterval.INTERVALS.set(intervalId, disposable)
     *   return context.newNumber(intervalId)
     * })
     *
     * const clearIntervalHandle = context.newFunction("clearInterval", (intervalIdHandle) => {
     *   const intervalId = context.getNumber(intervalIdHandle)
     *   const disposable = QuickJSInterval.INTERVALS.get(intervalId)
     *   disposable?.dispose()
     * })
     *
     * class QuickJSInterval extends UsingDisposable {
     *   static INTERVALS = new Map<number, QuickJSInterval>()
     *
     *   static disposeContext(context: QuickJSContext) {
     *     for (const interval of QuickJSInterval.INTERVALS.values()) {
     *       if (interval.context === context) {
     *         interval.dispose()
     *       }
     *     }
     *   }
     *
     *   constructor(
     *     public fnHandle: QuickJSHandle,
     *     public context: QuickJSContext,
     *     public intervalId: number,
     *   ) {
     *     super()
     *   }
     *
     *   dispose() {
     *     globalThis.clearInterval(this.intervalId)
     *     this.fnHandle.dispose()
     *     QuickJSInterval.INTERVALS.delete(this.fnHandle.value)
     *   }
     *
     *   get alive() {
     *     return this.fnHandle.alive
     *   }
     * }
     * ```
     *
     * To implement an async function, create a promise with {@link newPromise}, then
     * return the deferred promise handle from `deferred.handle` from your
     * function implementation:
     *
     * ```typescript
     * const deferred = vm.newPromise()
     * someNativeAsyncFunction().then(deferred.resolve)
     * return deferred.handle
     * ```
     */
    newFunction(fn: VmFunctionImplementation<QuickJSHandle>): QuickJSHandle;
    newFunction(name: string | undefined, fn: VmFunctionImplementation<QuickJSHandle>): QuickJSHandle;
    /**
     * Convert a Javascript function into a QuickJS constructor function.
     * See {@link newFunction} for more details.
     */
    newConstructorFunction(fn: VmFunctionImplementation<QuickJSHandle>): QuickJSHandle;
    newConstructorFunction(name: string | undefined, fn: VmFunctionImplementation<QuickJSHandle>): QuickJSHandle;
    /**
     * Lower-level API for creating functions.
     * See {@link newFunction} for more details on how to use functions.
     */
    newFunctionWithOptions(args: {
        name: string | undefined;
        length: number;
        isConstructor: boolean;
        fn: VmFunctionImplementation<QuickJSHandle>;
    }): QuickJSHandle;
    newError(error: {
        name: string;
        message: string;
    }): QuickJSHandle;
    newError(message: string): QuickJSHandle;
    newError(): QuickJSHandle;
    /**
     * Create an opaque handle object that stores a reference to a host JavaScript object.
     *
     * The guest cannot access the host object directly, but you may use
     * {@link getHostRef} to convert a HostRef handle back into a HostRef<T> from
     * inside a function implementation.
     *
     * You must call {@link HostRef#dispose} or otherwise consume the {@link HostRef#handle} to ensure the handle is not leaked.
     */
    newHostRef<T extends object>(value: T): HostRef<T>;
    /**
     * If `handle` is a `HostRef<T>.handle`, return a new `HostRef<T>` instance wrapping the handle.
     *
     * You must call {@link HostRef#dispose} or otherwise consume the {@link HostRef#handle} to ensure the handle is not leaked.
     */
    toHostRef<T extends object>(handle: QuickJSHandle): HostRef<T> | undefined;
    /**
     * If `handle` is a `HostRef<T>.handle`, return the host value `T`.
     * @throws {@link QuickJSHostRefInvalid} if `handle` is not a `HostRef<T>.handle`
     */
    unwrapHostRef<T extends object>(handle: QuickJSHandle): T;
    /**
     * `typeof` operator. **Not** [standards compliant](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof).
     *
     * @remarks
     * Does not support BigInt values correctly.
     */
    typeof(handle: QuickJSHandle): string;
    /**
     * Converts `handle` into a Javascript number.
     * @returns `NaN` on error, otherwise a `number`.
     */
    getNumber(handle: QuickJSHandle): number;
    /**
     * Converts `handle` to a Javascript string.
     */
    getString(handle: QuickJSHandle): string;
    /**
     * Converts `handle` into a Javascript symbol. If the symbol is in the global
     * registry in the guest, it will be created with Symbol.for on the host.
     */
    getSymbol(handle: QuickJSHandle): symbol;
    /**
     * Converts `handle` to a Javascript bigint.
     */
    getBigInt(handle: QuickJSHandle): bigint;
    /**
     * Coverts `handle` to a JavaScript ArrayBuffer
     */
    getArrayBuffer(handle: QuickJSHandle): Lifetime<Uint8Array>;
    /**
     * Get the current state of a QuickJS promise, see {@link JSPromiseState} for the possible states.
     * This can be used to expect a promise to be fulfilled when combined with {@link unwrapResult}:
     *
     * ```typescript
     * const promiseHandle = context.evalCode(`Promise.resolve(42)`);
     * const resultHandle = context.unwrapResult(
     *  context.getPromiseState(promiseHandle)
     * );
     * context.getNumber(resultHandle) === 42; // true
     * resultHandle.dispose();
     * ```
     */
    getPromiseState(handle: QuickJSHandle): JSPromiseState;
    /**
     * `Promise.resolve(value)`.
     * Convert a handle containing a Promise-like value inside the VM into an
     * actual promise on the host.
     *
     * @remarks
     * You may need to call {@link runtime}.{@link QuickJSRuntime#executePendingJobs} to ensure that the promise is resolved.
     *
     * @param promiseLikeHandle - A handle to a Promise-like value with a `.then(onSuccess, onError)` method.
     */
    resolvePromise(promiseLikeHandle: QuickJSHandle): Promise<QuickJSContextResult<QuickJSHandle>>;
    private isEqual;
    /**
     * `handle === other` - IsStrictlyEqual.
     * See [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness).
     */
    eq(handle: QuickJSHandle, other: QuickJSHandle): boolean;
    /**
     * `Object.is(a, b)`
     * See [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness).
     */
    sameValue(handle: QuickJSHandle, other: QuickJSHandle): boolean;
    /**
     * SameValueZero comparison.
     * See [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness).
     */
    sameValueZero(handle: QuickJSHandle, other: QuickJSHandle): boolean;
    /**
     * `handle[key]`.
     * Get a property from a JSValue.
     *
     * @param key - The property may be specified as a JSValue handle, or as a
     * Javascript string (which will be converted automatically).
     */
    getProp(handle: QuickJSHandle, key: QuickJSPropertyKey): QuickJSHandle;
    /**
     * `handle.length` as a host number.
     *
     * Example use:
     * ```typescript
     * const length = context.getLength(arrayHandle) ?? 0
     * for (let i = 0; i < length; i++) {
     *   using value = context.getProp(arrayHandle, i)
     *   console.log(`array[${i}] =`, context.dump(value))
     * }
     * ```
     *
     * @returns a number if the handle has a numeric length property, otherwise `undefined`.
     */
    getLength(handle: QuickJSHandle): number | undefined;
    /**
     * `Object.getOwnPropertyNames(handle)`.
     * Similar to the [standard semantics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames),
     * but with extra, non-standard options for:
     *
     * - fetching array indexes as numbers (`numbers: true`)
     * - including symbols (`symbols: true`)
     * - only iterating over enumerable properties (`onlyEnumerable: true`)
     *
     * The default behavior is to emulate the standard:
     * ```typescript
     * context.getOwnPropertyNames(handle, { strings: true, numbersAsStrings: true })
     * ```
     *
     * Note when passing an explicit options object, you must set at least one
     * option, and `strings` are not included unless specified.
     *
     * Example use:
     * ```typescript
     * for (using prop of context.getOwnPropertyNames(objectHandle).unwrap()) {
     *   using value = context.getProp(handle, prop)
     *   console.log(context.dump(prop), '->', context.dump(value))
     * }
     * ```
     *
     * @returns an an array of handles of the property names. The array itself is disposable for your convenience.
     * @throws QuickJSEmptyGetOwnPropertyNames if no options are set.
     */
    getOwnPropertyNames(handle: QuickJSHandle, options?: GetOwnPropertyNamesOptions): QuickJSContextResult<DisposableArray<QuickJSHandle>>;
    /**
     * `handle[Symbol.iterator]()`. See {@link QuickJSIterator}.
     * Returns a host iterator that wraps and proxies calls to a guest iterator handle.
     * Each step of the iteration returns a result, either an error or a handle to the next value.
     * Once the iterator is done, the handle is automatically disposed, and the iterator
     * is considered done if the handle is disposed.
     *
     * ```typescript
     * for (using entriesHandle of context.getIterator(mapHandle).unwrap()) {
     *   using keyHandle = context.getProp(entriesHandle, 0)
     *   using valueHandle = context.getProp(entriesHandle, 1)
     *   console.log(context.dump(keyHandle), '->', context.dump(valueHandle))
     * }
     * ```
     */
    getIterator(iterableHandle: QuickJSHandle): QuickJSContextResult<QuickJSIterator>;
    /**
     * `handle[key] = value`.
     * Set a property on a JSValue.
     *
     * @remarks
     * Note that the QuickJS authors recommend using {@link defineProp} to define new
     * properties.
     *
     * @param key - The property may be specified as a JSValue handle, or as a
     * Javascript string or number (which will be converted automatically to a JSValue).
     */
    setProp(handle: QuickJSHandle, key: QuickJSPropertyKey, value: QuickJSHandle): void;
    /**
     * [`Object.defineProperty(handle, key, descriptor)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty).
     *
     * @param key - The property may be specified as a JSValue handle, or as a
     * Javascript string or number (which will be converted automatically to a JSValue).
     */
    defineProp(handle: QuickJSHandle, key: QuickJSPropertyKey, descriptor: VmPropertyDescriptor<QuickJSHandle>): void;
    /**
     * [`func.call(thisVal, ...args)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call) or
     * [`func.apply(thisVal, args)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply).
     * Call a JSValue as a function.
     *
     * See {@link unwrapResult}, which will throw if the function returned an error, or
     * return the result handle directly. If evaluation returned a handle containing
     * a promise, use {@link resolvePromise} to convert it to a native promise and
     * {@link runtime}.{@link QuickJSRuntime#executePendingJobs} to finish evaluating the promise.
     *
     * @returns A result. If the function threw synchronously, `result.error` be a
     * handle to the exception. Otherwise `result.value` will be a handle to the
     * value.
     *
     * Example:
     *
     * ```typescript
     * using parseIntHandle = context.getProp(global, "parseInt")
     * using stringHandle = context.newString("42")
     * using resultHandle = context.callFunction(parseIntHandle, context.undefined, stringHandle).unwrap()
     * console.log(context.dump(resultHandle)) // 42
     * ```
     */
    callFunction(func: QuickJSHandle, thisVal: QuickJSHandle, args?: QuickJSHandle[]): QuickJSContextResult<QuickJSHandle>;
    callFunction(func: QuickJSHandle, thisVal: QuickJSHandle, ...args: QuickJSHandle[]): QuickJSContextResult<QuickJSHandle>;
    /**
     * `handle[key](...args)`
     *
     * Call a method on a JSValue. This is a convenience method that calls {@link getProp} and {@link callFunction}.
     *
     * @returns A result. If the function threw synchronously, `result.error` be a
     * handle to the exception. Otherwise `result.value` will be a handle to the
     * value.
     */
    callMethod(thisHandle: QuickJSHandle, key: QuickJSPropertyKey, args?: QuickJSHandle[]): QuickJSContextResult<QuickJSHandle>;
    /**
     * Like [`eval(code)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#Description).
     *
     * Evaluates `code`, as though it's in a file named `filename`, with options `options`.
     *
     * - When `options.type` is `"global"`, the code is evaluated in the global
     *   scope of the QuickJSContext, and the return value is the result of the last
     *   expression.
     * - When `options.type` is `"module"`, the code is evaluated is a module scope.
     *   It may use `import` and `export` if {@link runtime}.{@link QuickJSRuntime#setModuleLoader} was called.
     *   It may use top-level await if supported by the underlying QuickJS library.
     *   The return value is the module's exports, or a promise for the module's exports.
     * - When `options.type` is unset, the code is evaluated as a module if it
     *   contains an `import` or `export` statement, otherwise it is evaluated in
     *   the global scope.
     *
     * When working with async code, you many need to call {@link runtime}.{@link QuickJSRuntime#executePendingJobs}
     * to execute callbacks pending after synchronous evaluation returns.
     *
     * See {@link unwrapResult}, which will throw if the function returned an error, or
     * return the result handle directly. If evaluation returned a handle containing
     * a promise, use {@link resolvePromise} to convert it to a native promise and
     * {@link QuickJSRuntime#executePendingJobs} to finish evaluating the promise.
     *
     * *Note*: to protect against infinite loops, provide an interrupt handler to
     * {@link QuickJSRuntime#setInterruptHandler}. You can use {@link shouldInterruptAfterDeadline} to
     * create a time-based deadline.
     *
     * @returns The last statement's value. If the code threw synchronously,
     * `result.error` will be a handle to the exception. If execution was
     * interrupted, the error will have name `InternalError` and message
     * `interrupted`.
     */
    evalCode(code: string, filename?: string, 
    /**
     * If no options are passed, a heuristic will be used to detect if `code` is
     * an ES module.
     *
     * See {@link EvalFlags} for number semantics.
     */
    options?: number | ContextEvalOptions): QuickJSContextResult<QuickJSHandle>;
    /**
     * Throw an error in the VM, interrupted whatever current execution is in progress when execution resumes.
     * @experimental
     */
    throw(error: Error | QuickJSHandle): JSValuePointer;
    /**
     * @private
     */
    protected borrowPropertyKey(key: QuickJSPropertyKey): QuickJSHandle;
    /**
     * @private
     */
    getMemory(rt: JSRuntimePointer): ContextMemory;
    /**
     * Dump a JSValue to Javascript in a best-effort fashion.
     * If the value is a promise, dumps the promise's state.
     * Returns `handle.toString()` if it cannot be serialized to JSON.
     */
    dump(handle: QuickJSHandle): any;
    /**
     * Unwrap a SuccessOrFail result such as a {@link VmCallResult} or a
     * {@link ExecutePendingJobsResult}, where the fail branch contains a handle to a QuickJS error value.
     * If the result is a success, returns the value.
     * If the result is an error, converts the error to a native object and throws the error.
     */
    unwrapResult<T>(result: SuccessOrFail<T, QuickJSHandle>): T;
    /** @private */
    protected getFunction(fn_id: HostRefId): VmFunctionImplementation<QuickJSHandle>;
    /**
     * @hidden
     */
    private cToHostCallbacks;
    private errorToHandle;
    /**
     * Outputs QuickJS Objects in binary form
     *
     * **WARNING**: QuickJS's binary JSON doesn't have a standard so expect it to change between version
     *
     * ```ts
     * // imagine sending data to another via IPC
     * let dataLifetime = context.newString("This is an example")
     *  ?.consume(handle => context.encodeBinaryJSON(handle))
     *  ?.consume(handle => context.getArrayBuffer(handle))
     * socket.write(dataLifetime?.value)
     * ```
     */
    encodeBinaryJSON(handle: QuickJSHandle): QuickJSHandle;
    /**
     * Outputs Handle of the given QuickJS Object in binary form
     *
     * ```ts
     * // imagine receiving data from another via IPC
     * socket.on("data", chunk => {
     *  context.newArrayBuffer(chunk)
     *    ?.consume(handle => context.decodeBinaryJSON(handle))
     *    ?.consume(handle => console.log(context.dump(handle)))
     * })
     * ```
     */
    decodeBinaryJSON(handle: QuickJSHandle): QuickJSHandle;
    protected success<S>(value: S): DisposableSuccess<S>;
    protected fail(error: QuickJSHandle): DisposableFail<QuickJSHandle>;
}

type EmscriptenCallback<BaseArgs extends any[], Result> = (...args: [Asyncify | undefined, ...BaseArgs]) => Result | AsyncifySleepResult<Result>;
type MaybeAsyncEmscriptenCallback<T extends EmscriptenCallback<any, any>> = T extends EmscriptenCallback<infer Args, infer Result> ? (...args: Args) => Result | Promise<Result> : never;
type MaybeAsyncEmscriptenCallbacks = {
    [K in keyof EmscriptenModuleCallbacks]: MaybeAsyncEmscriptenCallback<EmscriptenModuleCallbacks[K]>;
};
/**
 * @private
 */
interface ContextCallbacks {
    callFunction: MaybeAsyncEmscriptenCallbacks["callFunction"];
}
/**
 * @private
 */
interface RuntimeCallbacks {
    freeHostRef: MaybeAsyncEmscriptenCallbacks["freeHostRef"];
    shouldInterrupt: MaybeAsyncEmscriptenCallbacks["shouldInterrupt"];
    loadModuleSource: MaybeAsyncEmscriptenCallbacks["loadModuleSource"];
    normalizeModule: MaybeAsyncEmscriptenCallbacks["normalizeModule"];
}
/**
 * Options for {@link QuickJSWASMModule#evalCode}.
 */
interface ModuleEvalOptions {
    /**
     * Interrupt evaluation if `shouldInterrupt` returns `true`.
     * See {@link shouldInterruptAfterDeadline}.
     */
    shouldInterrupt?: InterruptHandler;
    /**
     * Memory limit, in bytes, of WebAssembly heap memory used by the QuickJS VM.
     */
    memoryLimitBytes?: number;
    /**
     * Stack size limit for this vm, in bytes
     * To remove the limit, set to `0`.
     */
    maxStackSizeBytes?: number;
    /**
     * Module loader for any `import` statements or expressions.
     */
    moduleLoader?: JSModuleLoader;
}
/**
 * We use static functions per module to dispatch runtime or context calls from
 * C to the host.  This class manages the indirection from a specific runtime or
 * context pointer to the appropriate callback handler.
 *
 * @private
 */
declare class QuickJSModuleCallbacks {
    private module;
    private contextCallbacks;
    private runtimeCallbacks;
    constructor(module: EitherModule);
    setRuntimeCallbacks(rt: JSRuntimePointer, callbacks: RuntimeCallbacks): void;
    deleteRuntime(rt: JSRuntimePointer): void;
    setContextCallbacks(ctx: JSContextPointer, callbacks: ContextCallbacks): void;
    deleteContext(ctx: JSContextPointer): void;
    private suspendedCount;
    private suspended;
    private handleAsyncify;
    private cToHostCallbacks;
}
/**
 * This class presents a Javascript interface to QuickJS, a Javascript interpreter
 * that supports EcmaScript 2020 (ES2020).
 *
 * It wraps a single WebAssembly module containing the QuickJS library and
 * associated helper C code. WebAssembly modules are completely isolated from
 * each other by the host's WebAssembly runtime. Separate WebAssembly modules
 * have the most isolation guarantees possible with this library.
 *
 * The simplest way to start running code is {@link evalCode}. This shortcut
 * method will evaluate Javascript safely and return the result as a native
 * Javascript value.
 *
 * For more control over the execution environment, or to interact with values
 * inside QuickJS, create a context with {@link newContext} or a runtime with
 * {@link newRuntime}.
 */
declare class QuickJSWASMModule {
    /** @private */
    protected ffi: EitherFFI;
    /** @private */
    protected callbacks: QuickJSModuleCallbacks;
    /** @private */
    protected module: EitherModule;
    /** @private */
    constructor(module: EitherModule, ffi: EitherFFI);
    /**
     * Create a runtime.
     * Use the runtime to set limits on CPU and memory usage and configure module
     * loading for one or more {@link QuickJSContext}s inside the runtime.
     */
    newRuntime(options?: RuntimeOptions): QuickJSRuntime;
    /**
     * A simplified API to create a new {@link QuickJSRuntime} and a
     * {@link QuickJSContext} inside that runtime at the same time. The runtime will
     * be disposed when the context is disposed.
     */
    newContext(options?: ContextOptions): QuickJSContext;
    /**
     * One-off evaluate code without needing to create a {@link QuickJSRuntime} or
     * {@link QuickJSContext} explicitly.
     *
     * To protect against infinite loops, use the `shouldInterrupt` option. The
     * {@link shouldInterruptAfterDeadline} function will create a time-based deadline.
     *
     * If you need more control over how the code executes, create a
     * {@link QuickJSRuntime} (with {@link newRuntime}) or a {@link QuickJSContext} (with
     * {@link newContext} or {@link QuickJSRuntime#newContext}), and use its
     * {@link QuickJSContext#evalCode} method.
     *
     * Asynchronous callbacks may not run during the first call to `evalCode`. If
     * you need to work with async code inside QuickJS, create a runtime and use
     * {@link QuickJSRuntime#executePendingJobs}.
     *
     * @returns The result is coerced to a native Javascript value using JSON
     * serialization, so properties and values unsupported by JSON will be dropped.
     *
     * @throws If `code` throws during evaluation, the exception will be
     * converted into a native Javascript value and thrown.
     *
     * @throws if `options.shouldInterrupt` interrupted execution, will throw a Error
     * with name `"InternalError"` and  message `"interrupted"`.
     */
    evalCode(code: string, options?: ModuleEvalOptions): unknown;
    /**
     * Retrieve the WebAssembly memory used by this QuickJS module.
     * Use this access very carefully - you are responsible for safe interaction with the memory.
     *
     * To supply a custom, pre-initialized memory to QuickJS, create a new variant
     * and provide the {@link CustomizeVariantOptions#wasmMemory} option.
     *
     * @experimental
     */
    getWasmMemory(): WebAssembly.Memory;
    /**
     * Get a low-level interface to the QuickJS functions in this WebAssembly
     * module.
     * @experimental
     * @unstable No warranty is provided with this API. It could change at any time.
     * @private
     */
    getFFI(): EitherFFI;
}

/**
 * Asyncified version of {@link QuickJSWASMModule}.
 *
 * Due to limitations of Emscripten's ASYNCIFY process, only a single async
 * function call can happen at a time across the entire WebAssembly module.
 *
 * That means that all runtimes, contexts, functions, etc created inside this
 * WebAssembly are limited to a single concurrent async action.
 * **Multiple concurrent async actions is an error.**
 *
 * To allow for multiple concurrent async actions, you must create multiple WebAssembly
 * modules.
 */
declare class QuickJSAsyncWASMModule extends QuickJSWASMModule {
    /** @private */
    protected ffi: QuickJSAsyncFFI;
    /** @private */
    protected module: QuickJSAsyncEmscriptenModule;
    /** @private */
    constructor(module: QuickJSAsyncEmscriptenModule, ffi: QuickJSAsyncFFI);
    /**
     * Create a new async runtime inside this WebAssembly module. All runtimes inside a
     * module are limited to a single async call at a time. For multiple
     * concurrent async actions, create multiple WebAssembly modules.
     */
    newRuntime(options?: AsyncRuntimeOptions): QuickJSAsyncRuntime;
    /**
     * A simplified API to create a new {@link QuickJSAsyncRuntime} and a
     * {@link QuickJSAsyncContext} inside that runtime at the same time. The runtime will
     * be disposed when the context is disposed.
     */
    newContext(options?: ContextOptions): QuickJSAsyncContext;
    /** Synchronous evalCode is not supported. */
    evalCode(): never;
    /**
     * One-off evaluate code without needing to create a {@link QuickJSAsyncRuntime} or
     * {@link QuickJSAsyncContext} explicitly.
     *
     * This version allows for asynchronous Ecmascript module loading.
     *
     * Note that only a single async action can occur at a time inside the entire WebAssembly module.
     * **Multiple concurrent async actions is an error.**
     *
     * See the documentation for {@link QuickJSWASMModule#evalCode} for more details.
     */
    evalCodeAsync(code: string, options: ModuleEvalOptions): Promise<unknown>;
}

type PromisedDefault<T> = T | Promise<T> | Promise<{
    default: T;
}> | Promise<{
    default: {
        default: T;
    };
}>;
/**
 * Create a new, completely isolated WebAssembly module containing the QuickJS library.
 * See the documentation on {@link QuickJSWASMModule}.
 *
 * Note that there is a hard limit on the number of WebAssembly modules in older
 * versions of v8:
 * https://bugs.chromium.org/p/v8/issues/detail?id=12076
 *
 * @example
 * ```ts
 * const quickjs = new newQuickJSWASMModuleFromVariant(
 *   import('@jitl/quickjs-browser-release-sync-wasm')
 * )
 * ```
 */
declare function newQuickJSWASMModuleFromVariant(
/**
 * A {@link QuickJSSyncVariant} to construct the WebAssembly module.
 */
variantOrPromise: PromisedDefault<QuickJSSyncVariant>): Promise<QuickJSWASMModule>;
/**
 * Create a new, completely isolated WebAssembly module containing a version of the QuickJS library
 * compiled with Emscripten's [ASYNCIFY](https://emscripten.org/docs/porting/asyncify.html) transform.
 *
 * This version of the library offers features that enable synchronous code
 * inside the VM to interact with asynchronous code in the host environment.
 * See the documentation on {@link QuickJSAsyncWASMModule}, {@link QuickJSAsyncRuntime},
 * and {@link QuickJSAsyncContext}.
 *
 * Note that there is a hard limit on the number of WebAssembly modules in older
 * versions of v8:
 * https://bugs.chromium.org/p/v8/issues/detail?id=12076
 *
 * @example
 * ```ts
 * const quickjs = new newQuickJSAsyncWASMModuleFromVariant(
 *   import('@jitl/quickjs-browser-debug-asyncify-wasm')
 * )
 * ```
 */
declare function newQuickJSAsyncWASMModuleFromVariant(
/**
 * A {@link QuickJSAsyncVariant} to construct the WebAssembly module.
 */
variantOrPromise: PromisedDefault<QuickJSAsyncVariant>): Promise<QuickJSAsyncWASMModule>;
/**
 * Helper intended to memoize the creation of a WebAssembly module.
 * ```typescript
 * const getDebugModule = memoizePromiseFactory(() => newQuickJSWASMModule(DEBUG_SYNC))
 * ```
 */
declare function memoizePromiseFactory<T>(fn: () => Promise<T>): () => Promise<T>;
type OrLoader<T> = T | (() => Promise<T>);
interface CustomizeVariantOptions {
    /** If given, Emscripten will try to load the WebAssembly module data from this location (path or URI) as appropriate for the current platform. */
    wasmLocation?: string;
    /** If given, Emscripten will compile the WebAssembly.Module from these bytes. */
    wasmBinary?: OrLoader<ArrayBuffer>;
    /** If given, Emscripten will instantiate the WebAssembly.Instance from this existing WebAssembly.Module */
    wasmModule?: OrLoader<WebAssembly.Module>;
    /** If given, use the Memory when instantiating the WebAssembly.Instance. */
    wasmMemory?: OrLoader<WebAssembly.Memory>;
    /** If given, Emscripten will try to load the source map for the WebAssembly module from this location (path or URI) as appropriate for the current platform. */
    wasmSourceMapLocation?: string;
    /** If given, we will provide the source map to Emscripten directly. This may only be respected if wasmModule is also provided. */
    wasmSourceMapData?: OrLoader<string | SourceMapData>;
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
    locateFile?: EmscriptenModuleLoaderOptions["locateFile"];
    /** The enumerable properties of this object will be passed verbatim, although they may be overwritten if you pass other options. */
    emscriptenModule?: EmscriptenModuleLoaderOptions;
    /** Debug logger */
    log?: typeof console.log;
}
/**
 * Create a new variant by overriding how Emscripten obtains the WebAssembly module.
 * This may be necessary in Cloudflare Workers, which can't compile WebAssembly modules from binary data.
 */
declare function newVariant<T extends QuickJSVariant>(baseVariant: T, options: CustomizeVariantOptions): T;

/**
 * Returns an interrupt handler that interrupts Javascript execution after a deadline time.
 *
 * @param deadline - Interrupt execution if it's still running after this time.
 *   Number values are compared against `Date.now()`
 */
declare function shouldInterruptAfterDeadline(deadline: Date | number): InterruptHandler;

/**
 * Error thrown if {@link QuickJSContext#unwrapResult} unwraps an error value that isn't an object.
 */
declare class QuickJSUnwrapError extends Error {
    cause: unknown;
    context?: QuickJSContext | undefined;
    name: string;
    constructor(cause: unknown, context?: QuickJSContext | undefined);
}
declare class QuickJSWrongOwner extends Error {
    name: string;
}
declare class QuickJSUseAfterFree extends Error {
    name: string;
}
declare class QuickJSNotImplemented extends Error {
    name: string;
}
declare class QuickJSAsyncifyError extends Error {
    name: string;
}
declare class QuickJSAsyncifySuspended extends Error {
    name: string;
}
declare class QuickJSMemoryLeakDetected extends Error {
    name: string;
}
declare class QuickJSEmscriptenModuleError extends Error {
    name: string;
}
declare class QuickJSUnknownIntrinsic extends TypeError {
    name: string;
}
declare class QuickJSPromisePending extends Error {
    name: string;
}
declare class QuickJSEmptyGetOwnPropertyNames extends Error {
    name: string;
}
declare class QuickJSHostRefRangeExceeded extends Error {
    name: string;
}
declare class QuickJSHostRefInvalid extends Error {
    name: string;
}

type errors_QuickJSAsyncifyError = QuickJSAsyncifyError;
declare const errors_QuickJSAsyncifyError: typeof QuickJSAsyncifyError;
type errors_QuickJSAsyncifySuspended = QuickJSAsyncifySuspended;
declare const errors_QuickJSAsyncifySuspended: typeof QuickJSAsyncifySuspended;
type errors_QuickJSEmptyGetOwnPropertyNames = QuickJSEmptyGetOwnPropertyNames;
declare const errors_QuickJSEmptyGetOwnPropertyNames: typeof QuickJSEmptyGetOwnPropertyNames;
type errors_QuickJSEmscriptenModuleError = QuickJSEmscriptenModuleError;
declare const errors_QuickJSEmscriptenModuleError: typeof QuickJSEmscriptenModuleError;
type errors_QuickJSHostRefInvalid = QuickJSHostRefInvalid;
declare const errors_QuickJSHostRefInvalid: typeof QuickJSHostRefInvalid;
type errors_QuickJSHostRefRangeExceeded = QuickJSHostRefRangeExceeded;
declare const errors_QuickJSHostRefRangeExceeded: typeof QuickJSHostRefRangeExceeded;
type errors_QuickJSMemoryLeakDetected = QuickJSMemoryLeakDetected;
declare const errors_QuickJSMemoryLeakDetected: typeof QuickJSMemoryLeakDetected;
type errors_QuickJSNotImplemented = QuickJSNotImplemented;
declare const errors_QuickJSNotImplemented: typeof QuickJSNotImplemented;
type errors_QuickJSPromisePending = QuickJSPromisePending;
declare const errors_QuickJSPromisePending: typeof QuickJSPromisePending;
type errors_QuickJSUnknownIntrinsic = QuickJSUnknownIntrinsic;
declare const errors_QuickJSUnknownIntrinsic: typeof QuickJSUnknownIntrinsic;
type errors_QuickJSUnwrapError = QuickJSUnwrapError;
declare const errors_QuickJSUnwrapError: typeof QuickJSUnwrapError;
type errors_QuickJSUseAfterFree = QuickJSUseAfterFree;
declare const errors_QuickJSUseAfterFree: typeof QuickJSUseAfterFree;
type errors_QuickJSWrongOwner = QuickJSWrongOwner;
declare const errors_QuickJSWrongOwner: typeof QuickJSWrongOwner;
declare namespace errors {
  export { errors_QuickJSAsyncifyError as QuickJSAsyncifyError, errors_QuickJSAsyncifySuspended as QuickJSAsyncifySuspended, errors_QuickJSEmptyGetOwnPropertyNames as QuickJSEmptyGetOwnPropertyNames, errors_QuickJSEmscriptenModuleError as QuickJSEmscriptenModuleError, errors_QuickJSHostRefInvalid as QuickJSHostRefInvalid, errors_QuickJSHostRefRangeExceeded as QuickJSHostRefRangeExceeded, errors_QuickJSMemoryLeakDetected as QuickJSMemoryLeakDetected, errors_QuickJSNotImplemented as QuickJSNotImplemented, errors_QuickJSPromisePending as QuickJSPromisePending, errors_QuickJSUnknownIntrinsic as QuickJSUnknownIntrinsic, errors_QuickJSUnwrapError as QuickJSUnwrapError, errors_QuickJSUseAfterFree as QuickJSUseAfterFree, errors_QuickJSWrongOwner as QuickJSWrongOwner };
}

/**
 * A test wrapper of {@link QuickJSWASMModule} that keeps a reference to each
 * context or runtime created.
 *
 * Call {@link disposeAll} to reset these sets and calls `dispose` on any left alive
 * (which may throw an error).
 *
 * Call {@link assertNoMemoryAllocated} at the end of a test, when you expect that you've
 * freed all the memory you've ever allocated.
 */
declare class TestQuickJSWASMModule implements Pick<QuickJSWASMModule, keyof QuickJSWASMModule> {
    private parent;
    contexts: Set<QuickJSContext>;
    runtimes: Set<QuickJSRuntime>;
    constructor(parent: QuickJSWASMModule);
    newRuntime(options?: RuntimeOptions): QuickJSRuntime;
    newContext(options?: ContextOptions): QuickJSContext;
    evalCode(code: string, options?: ModuleEvalOptions): unknown;
    disposeAll(): void;
    assertNoMemoryAllocated(): void;
    getWasmMemory(): WebAssembly.Memory;
    /** @private */
    getFFI(): _jitl_quickjs_ffi_types.EitherFFI;
}

/**
 * Enable (or disable) debug logging and object creation tracking globally.
 * This setting is inherited by newly created QuickJSRuntime instances.
 * To get debug logging in the WebAssembly module, you need to use a debug build variant.
 * See [the quickjs-emscripten-core README](https://github.com/justjake/quickjs-emscripten/tree/main/doc/quickjs-emscripten-core) for more about build variants.
 */
declare function setDebugMode(enabled?: boolean): void;
/**
 * @private
 */
declare function debugLog(...args: any[]): void;

export { type AsyncFunctionImplementation, type AsyncRuntimeOptions, type ContextEvalOptions, type ContextOptions, type CustomizeVariantOptions, DefaultIntrinsics, type Disposable$1 as Disposable, type DisposableArray, DisposableFail, DisposableResult, DisposableSuccess, type ExecutePendingJobsResult, type InterruptHandler, type Intrinsics, type JSModuleLoadFailure, type JSModuleLoadResult, type JSModuleLoadSuccess, type JSModuleLoader, type JSModuleLoaderAsync, type JSModuleNormalizeFailure, type JSModuleNormalizeResult, type JSModuleNormalizeSuccess, type JSModuleNormalizer, type JSModuleNormalizerAsync, type JSPromiseState, type JSPromiseStateFulfilled, type JSPromiseStatePending, type JSPromiseStateRejected, type JSValue, type JSValueConst, Lifetime, type LowLevelJavascriptVm, type ModuleEvalOptions, type OrLoader, type PromiseExecutor, type PromisedDefault, QuickJSAsyncContext, QuickJSAsyncRuntime, QuickJSAsyncWASMModule, QuickJSContext, QuickJSDeferredPromise, type QuickJSHandle, type QuickJSPropertyKey, QuickJSRuntime, QuickJSWASMModule, type RuntimeOptions, type RuntimeOptionsBase, Scope, type StaticJSValue, StaticLifetime, type SuccessOrFail, TestQuickJSWASMModule, UsingDisposable, type VmCallResult, type VmFunctionImplementation, type VmPropertyDescriptor, WeakLifetime, createDisposableArray, debugLog, errors, isFail, isSuccess, memoizePromiseFactory, newQuickJSAsyncWASMModuleFromVariant, newQuickJSWASMModuleFromVariant, newVariant, setDebugMode, shouldInterruptAfterDeadline };
