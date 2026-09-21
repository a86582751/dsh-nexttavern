// Generated from runtime/alpha3/compat/session-controller/src/client/scope.ts; edit the TypeScript source.
/** Client scope generations route local events independently of Host Agent residency. */
import { Context as CordisContext } from '@deepseek-ai/cordis';
/** Context tag written by {@link createScope}. */
const kScope = Symbol('dsh.client.scope');
/** Shared no-op plugin backing each Agent scope fiber. */
function agentScope() { }
/**
 * Mint an Agent scope under `ctx`: a no-op plugin fiber whose context
 * carries the agent tag and the dispatch filter — untagged listeners are
 * admitted globally, tagged listeners only for the same Client generation.
 * Registrations through the returned ctx dispose with the fiber.
 * @param ctx - client root context the scope fiber mounts under.
 * @param key - durable Session identity carried by this generation.
 * @returns the tagged context and its backing fiber.
 */
export function createScope(ctx, key) {
    const fiber = ctx.plugin(agentScope);
    const identity = { sessionId: key };
    const scoped = fiber.ctx.extend({
        [kScope]: identity,
        [CordisContext.filter](listenerCtx) {
            const tag = scopeIdentityOf(listenerCtx);
            return tag === undefined || tag === identity;
        },
    });
    return {
        fiber,
        ctx: scoped,
    };
}
/**
 * Read the nearest agent tag inherited by a context.
 * @param ctx - any client context.
 * @returns its agent identity (the session id), or undefined for root contexts.
 */
export function scopeOf(ctx) {
    return scopeIdentityOf(ctx)?.sessionId;
}
/**
 * Read the exact generation identity inherited by a Client Context.
 * @param ctx - scoped or root Client Context.
 * @returns the generation identity, or undefined for an unscoped Context.
 */
export function scopeIdentityOf(ctx) {
    return ctx[kScope];
}
