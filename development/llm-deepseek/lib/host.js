// Generated from runtime/alpha3/compat/llm-deepseek/src/host.ts; edit the TypeScript source.
import { resolveImageAttachmentAccess } from 'dsh-nexttavern-native-llm';
import { getOrCreateAnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id';
import { deepEqualJson } from '@deepseek-ai/dsh-util-values';
import { createNativeHttpTransport } from 'dsh-nexttavern-native-http';
import { DeepSeekAdapter } from './adapter.js';
/**
 * Register one provider with request-local transport services and live retry policy.
 * @param ctx - provider plugin lifetime with the LLM registry injected.
 * @param provider - exact route owned by this plugin.
 * @param dependencies - provider-owned discovery, credential, and configuration callbacks.
 */
export function registerDeepSeekProvider(ctx, provider, dependencies) {
    const transport = createNativeHttpTransport();
    ctx.effect(() => () => transport.close(), 'llm-deepseek.http()');
    ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
    let userId;
    const adapter = new DeepSeekAdapter({
        ...dependencies,
        fetch: transport.fetch,
        resolveUserId: () => userId ??= getOrCreateAnonymousUserId(),
        onReplayDegrade: ({ provider, model, reason }) => {
            ctx.logger.warn(`llm-deepseek: unusable Messages replay state on assistant history for route "${provider}/${model}"; sending provider-neutral content (${reason})`);
        },
        onExtensionsOmitted: ({ provider, model, fields, error }) => {
            ctx.logger.warn(`llm-deepseek: sending route "${provider}/${model}" without request extension fields ${fields.join(', ')} because they failed to serialize: %o`, error);
        },
        resolveAttachments: () => ctx.get('attachments'),
        resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath), ref),
        prepareExtensions: request => ctx.get('deepseekLlmApiExtensions')?.prepare(request)
            ?? Promise.resolve({ fields: {}, accept: () => Promise.resolve() }),
    });
    const registration = ctx.llm.registerAdapter([provider], adapter);
    let registeredPolicy = dependencies.options().retryPolicy;
    ctx.on('loader/volatile-update', () => {
        let policy;
        try {
            policy = dependencies.options().retryPolicy;
        }
        catch (error) {
            ctx.logger.warn(error);
            return;
        }
        if (deepEqualJson(policy, registeredPolicy))
            return;
        registration.replace([provider]);
        registeredPolicy = policy;
    });
}
