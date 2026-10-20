// Generated from runtime/alpha3/compat/llm-deepseek/src/request-files.ts; edit the TypeScript source.
/** Shared Files resolution, bounded stale-id recovery, and normalized-image diagnostics. */
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { deadline } from '@deepseek-ai/dsh-timeout';
/** A file upload failure eligible for request-wide inline fallback. */
export class FileResolutionFailure extends Error {
    constructor(cause) {
        super('DeepSeek Files API could not resolve a request image.', { cause });
        this.name = 'FileResolutionFailure';
    }
}
function providerRejectedNormalizedImage(detail) {
    const reasonBeforeImage = /(?:unsupported|invalid|cannot read|failed to (?:decode|process)).{0,40}image/iu;
    const imageBeforeReason = /image.{0,40}(?:unsupported|invalid|cannot be decoded)/iu;
    return reasonBeforeImage.test(detail) || imageBeforeReason.test(detail);
}
function providerRejectedFileId(detail) {
    const file = /\bfile(?:[_ -]?(?:id|api|not[_ -]?found|deleted|expired))?/iu.test(detail);
    const missing = /(?:expired|not[_ -]?found|deleted|do(?:es)? not exist|not created under (?:this|your) account)/iu.test(detail);
    const invalidId = /(?:invalid.{0,20}file[_ -]?(?:id|api)|file[_ -]?(?:id|api).{0,20}invalid)/iu.test(detail);
    return file && (missing || invalidId);
}
function detailNamesFileId(detail, fileId) {
    let index = detail.indexOf(fileId);
    while (index >= 0) {
        const before = detail[index - 1];
        const after = detail[index + fileId.length];
        if ((before === undefined || !/[\p{L}\p{N}_-]/u.test(before))
            && (after === undefined || !/[\p{L}\p{N}_-]/u.test(after)))
            return true;
        index = detail.indexOf(fileId, index + 1);
    }
    return false;
}
function staleMappings(files, detail) {
    const unique = [...new Map(files.map(file => [`${file.version.variantId}\0${file.fileId}`, file])).values()];
    const exact = unique.filter(file => detailNamesFileId(detail, file.fileId));
    return exact.length > 0 ? exact : unique;
}
function normalizedImageFacts(file) {
    const version = file.version;
    const name = version.attachment.name ?? version.attachment.attachmentId;
    const colour = version.hasAlpha ? 'sRGBA' : 'sRGB';
    return `"${name}" at message ${file.location.message}, image ${file.location.image} `
        + `(${version.mediaType}, 8-bit ${colour}, ${version.width}x${version.height})`;
}
function normalizedImageDiagnostic(files, providerMessage, providerDetail) {
    const exact = files.find(file => detailNamesFileId(providerDetail, file.fileId));
    const target = exact ?? (files.length === 1 ? files[0] : undefined);
    if (target !== undefined) {
        return `DeepSeek rejected normalized image ${normalizedImageFacts(target)}: ${providerMessage}. `
            + 'The provider rejected bytes already normalized by the harness; PNG, JPEG, WebP, and GIF remain supported input formats.';
    }
    const candidates = [...new Map(files.map(file => [
            `${file.version.variantId}\0${file.location.message}\0${file.location.image}`,
            file,
        ])).values()];
    return `DeepSeek rejected a normalized request image: ${providerMessage}. Candidate images: `
        + `${candidates.map(normalizedImageFacts).join('; ')}. `
        + 'The provider rejected bytes already normalized by the harness; PNG, JPEG, WebP, and GIF remain supported input formats.';
}
/** Files state owned by one model request, including at most one stale-id retry. */
export class RequestFiles {
    files;
    connection;
    policy;
    timeoutMs;
    signal;
    activity;
    used = [];
    retried = false;
    constructor(files, connection, policy, timeoutMs, signal, activity) {
        this.files = files;
        this.connection = connection;
        this.policy = policy;
        this.timeoutMs = timeoutMs;
        this.signal = signal;
        this.activity = activity;
    }
    /** Reset occurrence tracking before serializing the next HTTP attempt. */
    beginAttempt() { this.used = []; }
    /**
     * Resolve a retained image under its own upload deadline.
     * @param version - prepared request image.
     * @param location - occurrence used by provider-rejection diagnostics.
     * @returns the reusable provider id.
     */
    async resolve(version, location) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const limit = __addDisposableResource(env_1, deadline(this.signal, this.timeoutMs, 'DEEPSEEK_FILES_API_TIMEOUT'), false);
            let resolved;
            try {
                resolved = await this.files.ensureUploaded(version, this.connection, this.policy, limit.signal);
            }
            catch (error) {
                if (this.signal.aborted)
                    throw error;
                throw new FileResolutionFailure(error);
            }
            this.activity();
            this.used.push({ version, fileId: resolved.record.fileId, location });
            return resolved.record.fileId;
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    /**
     * Invalidate rejected mappings; only the first stale-id response permits another request.
     * @param detail - provider error fields used for stale-id classification.
     * @returns whether the caller should serialize and dispatch again.
     */
    async retry(detail) {
        if (this.used.length === 0 || !providerRejectedFileId(detail))
            return false;
        await Promise.all(staleMappings(this.used, detail).map(file => this.files.invalidate(file.version, file.fileId, this.connection)));
        if (this.retried)
            return false;
        this.retried = true;
        return true;
    }
    /**
     * Attribute a normalized-image rejection to the actual uploaded image occurrences.
     * @param status - rejected request's HTTP status.
     * @param message - provider's error message.
     * @param detail - provider error classification fields.
     * @returns the image diagnostic or the original provider message.
     */
    errorMessage(status, message, detail) {
        return status === 400 && this.used.length > 0 && providerRejectedNormalizedImage(detail)
            ? normalizedImageDiagnostic(this.used, message, detail)
            : message;
    }
}
