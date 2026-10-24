// Generated from runtime/alpha3/compat/client-modules/src/client/index.ts; edit the TypeScript source.
import { ClientModuleSystem } from './system.js';
import { parseBootManifest } from './manifest.js';
export { ClientModuleSystem };
export { tearDownEntryFiber } from './entry-lifecycle.js';
export { exactPackageSpecifier, parseBootManifest, parseDshClient, stripClientSuffix } from './manifest.js';
/**
 * Build the live module system from the HTML facade's materialized modules bundle.
 * @param target - Stable registration facade whose pending queue becomes the live sink.
 * @param bootstrapModule - This bundle's id and already-materialized exports.
 * @param options - Raw boot graph, platform seed, and optional bundle transport.
 * @returns The created module system.
 */
export function createClientModuleSystem(target, bootstrapModule, options) {
    return new ClientModuleSystem({
        manifest: parseBootManifest(options.boot),
        staticModules: options.staticModules,
        registrationTarget: target,
        bootstrapModule,
        ...(options.loadBundle === undefined ? {} : { loadBundle: options.loadBundle }),
    });
}
/** Required service: the Loader whose internal module system this plugin publishes. */
export const inject = ['loader'];
/**
 * Enroll the kernel-built module system as `ctx.modules`.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const loader = ctx.loader;
    const modules = loader.internal;
    if (modules?.version !== 'client') {
        throw new Error('client-modules: the Loader has no client module system');
    }
    ctx.reflect.provide('modules', modules);
}
