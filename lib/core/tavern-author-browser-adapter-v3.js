// Generated from runtime/alpha3/src/core/tavern-author-browser-adapter-v3.ts; edit the TypeScript source.
/** One Actor owns all entries and retained handles in a shared Asyncify runtime.
 * Source, permissions, host-wait cancellation and hard termination stay outside. */
import { createAsyncifyRuntimeV2 } from './tavern-author-browser-adapter-v2.js';
const closedConstruction = `(()=>{
  const define=Object.defineProperty,prototype=Object.getPrototypeOf;
  for(const fn of [function(){},async function(){},function*(){},async function*(){}]){
    define(prototype(fn),'constructor',{value:undefined,writable:false,configurable:false});
  }
  for(const name of ['eval','Function']){
    define(globalThis,name,{value:undefined,writable:false,configurable:false});
  }
})()`;
export class BrowserActorV3 {
    module;
    cleanup;
    entryObserver;
    runtime;
    parent;
    pages = new Map();
    realms = new Map();
    tail = Promise.resolve();
    disposal;
    asyncCall;
    asyncJob;
    constructor(core, module, cleanup = {}, entryObserver) {
        this.module = module;
        this.cleanup = cleanup;
        this.entryObserver = entryObserver;
        this.runtime = createAsyncifyRuntimeV2(core, module, cleanup);
        try {
            this.parent = this.createRealm();
        }
        catch (error) {
            this.runtime.dispose();
            throw error;
        }
        this.realms.set(this.parent, { handles: new Set() });
        // Numeric-only cwrap without options bypasses Asyncify's ccall wait.
        this.asyncCall = module.module.cwrap('QTS_Call', 'number', Array(5).fill('number'), { async: true });
        this.asyncJob = module.module.cwrap('QTS_ExecutePendingJob', 'number', Array(3).fill('number'), { async: true });
    }
    enqueue(operation) {
        const result = this.tail.then(async () => {
            this.entryObserver?.begin();
            try {
                return await operation();
            }
            finally {
                this.entryObserver?.end();
            }
        });
        this.tail = result.catch(() => { });
        return result;
    }
    /** Native setup/settlement uses this same queue. Do not await another queued
     * Actor method from this callback or from an Asyncify host callback. */
    enter(operation) {
        if (this.disposal)
            return Promise.reject(Error('BROWSER_REALM_DISPOSED'));
        return this.enqueue(operation);
    }
    createRealm() {
        const context = this.runtime.newContext();
        // A fresh realm has no author code or host callbacks. This trusted pure
        // bootstrap cannot suspend and closes code construction before sharing.
        const result = context.evalCode(closedConstruction, 'owned-browser-bootstrap-v3.js');
        if (result.error) {
            result.error.dispose();
            context.dispose();
            throw Error('BROWSER_REALM_INITIALIZATION_FAILED');
        }
        result.value.dispose();
        return context;
    }
    createPage(id) {
        return this.enter(() => {
            const existing = this.pages.get(id);
            if (existing)
                return existing;
            const context = this.createRealm();
            this.pages.set(id, context);
            this.realms.set(context, { handles: new Set() });
            return context;
        });
    }
    getPage(id) { return this.pages.get(id); }
    /** These are actual same-runtime guest values. The Worker owns the named
     * global slots and unlinks its other callback/window references before close. */
    linkPage(id, parentGlobalName) {
        return this.enter(() => {
            const context = this.pages.get(id);
            const group = this.realms.get(context);
            if (group.parentGlobalName !== undefined && group.parentGlobalName !== parentGlobalName)
                this.parent.setProp(this.parent.global, group.parentGlobalName, this.parent.undefined);
            this.parent.setProp(this.parent.global, parentGlobalName, context.global);
            context.setProp(context.global, 'parent', this.parent.global);
            group.parentGlobalName = parentGlobalName;
        });
    }
    resultHandle(context, pointer) {
        const errorPointer = context.ffi.QTS_ResolveException(context.ctx.value, pointer);
        if (errorPointer) {
            context.ffi.QTS_FreeValuePointer(context.ctx.value, pointer);
            return { error: context.memory.heapValueHandle(errorPointer) };
        }
        return { value: context.memory.heapValueHandle(pointer) };
    }
    async evalHandle(context, code, filename) {
        const text = context.memory.newHeapCharPointer(code);
        let pointer;
        try {
            pointer = await context.ffi.QTS_Eval_MaybeAsync(context.ctx.value, text.value.ptr, text.value.strlen, filename, 1, 0);
        }
        finally {
            text.dispose();
        }
        return this.resultHandle(context, pointer);
    }
    async callHandle(context, callback, args, receiver) {
        const argv = context.memory.toPointerArray(args);
        let pointer;
        // Borrowed arguments and argv remain live through the entire suspension.
        try {
            pointer = await this.asyncCall(context.ctx.value, callback.value, receiver.value, args.length, argv.value);
        }
        finally {
            argv.dispose();
        }
        return this.resultHandle(context, pointer);
    }
    primitive(context, handle) {
        const type = context.typeof(handle);
        if (type === 'number')
            return context.getNumber(handle);
        if (type === 'string')
            return context.getString(handle);
        if (type === 'undefined')
            return undefined;
        throw Error('BROWSER_CONTROLLER_PRIMITIVE_REQUIRED');
    }
    async guestError(context, error) {
        // Conversion executes in the context that actually raised the exception.
        // Borrow the error as an argument rather than overwrite an author global.
        let converter, converted;
        try {
            converter = await this.evalHandle(context, 'value=>String(value)', 'owned-browser-error-v3.js');
            if (converter.error)
                return Error('BROWSER_GUEST_ERROR');
            converted = await this.callHandle(context, converter.value, [error], context.undefined);
            if (converted.error)
                return Error('BROWSER_GUEST_ERROR');
            return Error(String(this.primitive(context, converted.value)));
        }
        finally {
            error.dispose();
            if (converter)
                (converter.error ?? converter.value).dispose();
            if (converted)
                (converted.error ?? converted.value).dispose();
        }
    }
    async consume(context, result) {
        if (result.error)
            throw await this.guestError(context, result.error);
        try {
            return this.primitive(context, result.value);
        }
        finally {
            result.value.dispose();
        }
    }
    /** The completion of an original global script need not be primitive. */
    runSource(context, code, filename = 'owned-browser-author-v3.js') {
        return this.enter(async () => {
            const result = await this.evalHandle(context, code, filename);
            if (result.error)
                throw await this.guestError(context, result.error);
            result.value.dispose();
        });
    }
    /** Retain the original value/closure until its owning realm closes. */
    capture(context, code, filename = 'owned-browser-capture-v3.js') {
        return this.enter(async () => {
            const result = await this.evalHandle(context, code, filename);
            if (result.error)
                throw await this.guestError(context, result.error);
            this.realms.get(context).handles.add(result.value);
            return result.value;
        });
    }
    /** A private controller may return real guest functions/objects to another
     * realm. Retain that value in its actual caller context without JSON, eval
     * aliases or an author-visible global slot. */
    captureCall(context, callback, args = [], receiver = context.undefined) {
        return this.enter(async () => {
            const result = await this.callHandle(context, callback, args, receiver);
            if (result.error)
                throw await this.guestError(context, result.error);
            this.realms.get(context).handles.add(result.value);
            return result.value;
        });
    }
    call(context, callback, args = [], receiver = context.undefined) {
        return this.enter(async () => this.consume(context, await this.callHandle(context, callback, args, receiver)));
    }
    /** A pending Promise does not hold the Actor while waiting for host work.
     * Promise rejections are consumed here; they normally are not job faults. */
    promiseResult(context, promise) {
        return this.enter(async () => {
            const result = context.getPromiseState(promise);
            if (result.type === 'pending')
                return { kind: 'pending' };
            if (result.type === 'rejected')
                throw await this.guestError(context, result.error);
            // getPromiseState borrows its input when the value is not a Promise;
            // only a real fulfilled Promise gives us an owned result to consume.
            const value = result.notAPromise ? this.primitive(context, result.value) :
                await this.consume(context, { value: result.value });
            return { kind: 'fulfilled', value };
        });
    }
    drain() {
        return this.enter(async () => {
            while (this.runtime.hasPendingJob()) {
                const output = this.runtime.memory.newMutablePointerArray(1);
                let pointer, contextPointer;
                try {
                    pointer = await this.asyncJob(this.runtime.rt.value, 1, output.value.ptr);
                    // Asyncify may grow memory: read the fresh heap after resumption.
                    contextPointer = new Int32Array(this.runtime.module.HEAPU8.buffer)[output.value.ptr >> 2];
                }
                finally {
                    output.dispose();
                }
                if (contextPointer === 0) {
                    this.runtime.ffi.QTS_FreeValuePointerRuntime(this.runtime.rt.value, pointer);
                    continue;
                }
                const context = this.runtime.contextMap.get(contextPointer);
                const result = context.memory.heapValueHandle(pointer);
                if (context.typeof(result) !== 'number')
                    throw await this.guestError(context, result);
                result.dispose();
            }
        });
    }
    closePage(id, context) {
        const group = this.realms.get(context);
        if (group.parentGlobalName !== undefined)
            this.parent.setProp(this.parent.global, group.parentGlobalName, this.parent.undefined);
        context.setProp(context.global, 'parent', context.undefined);
        this.closeContext(context);
        this.pages.delete(id);
        this.cleanup.pageContextsDisposed = (this.cleanup.pageContextsDisposed ?? 0) + 1;
    }
    closeContext(context) {
        const group = this.realms.get(context);
        for (const handle of group.handles)
            handle.dispose();
        group.handles.clear();
        context.dispose();
        this.realms.delete(context);
    }
    /** The Worker first cancels this page's host waits and removes callbacks.
     * This release runs only after the currently entered phase has returned. */
    disposePage(id) {
        return this.enter(() => {
            const context = this.pages.get(id);
            if (context)
                this.closePage(id, context);
        });
    }
    /** Queue a graceful release; it cannot interrupt a suspended/running entry.
     * The Worker cancels host waits first; the browser watchdog owns terminate. */
    dispose() {
        if (this.disposal)
            return this.disposal;
        this.disposal = this.enqueue(() => {
            for (const [id, context] of this.pages)
                this.closePage(id, context);
            this.closeContext(this.parent);
            this.cleanup.contextDisposed = !this.parent.alive;
            this.runtime.dispose();
            this.cleanup.runtimeDisposed = !this.runtime.alive;
            this.cleanup.hostRefGroupsAfterFree = this.runtime.hostRefs.groups.size;
            this.cleanup.contextRegistrationsAfterFree = this.module.callbacks.contextCallbacks.size;
            this.cleanup.runtimeRegistrationsAfterFree = this.module.callbacks.runtimeCallbacks.size;
            this.cleanup.retainedHandlesAfterFree = [...this.realms.values()].reduce((total, group) => total + group.handles.size, 0);
            this.cleanup.clean = this.cleanup.contextDisposed && this.cleanup.runtimeDisposed && this.cleanup.runtimeFreeReturned
                && this.cleanup.runtimeRegisteredBeforeFree && this.cleanup.runtimeRegistrationRemoved
                && this.cleanup.hostRefGroupsAfterFree === 0 && this.cleanup.contextRegistrationsAfterFree === 0
                && this.cleanup.runtimeRegistrationsAfterFree === 0;
        });
        return this.disposal;
    }
}
