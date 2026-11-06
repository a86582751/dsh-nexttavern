// Generated from runtime/alpha3/compat/llm-deepseek-api-key/src/index.ts; edit the TypeScript source.
import { assertUsableApiKey, LlmError } from 'dsh-nexttavern-native-llm';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { registerDeepSeekProvider, catalogModelInfo } from 'dsh-nexttavern-native-llm-deepseek';
import { Config, plainOptions, resolveAdapterOptions } from '@deepseek-ai/dsh-llm-deepseek-api-key';
export { Config, plainOptions, resolveAdapterOptions } from '@deepseek-ai/dsh-llm-deepseek-api-key';
export const name = 'llm-deepseek-api-key';
export const inject = ['llm'];
const PROVIDER = 'deepseek-official';
export function apply(ctx, config) {
    const options = () => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx));
    options();
    const resolveApiKey = async (connection) => {
        const ref = connection.apiKeyEnv;
        const credentials = ctx.get('credentials');
        if (credentials !== undefined) {
            const hit = await credentials.resolve(ref);
            if (hit !== undefined)
                return assertUsableApiKey(hit.value, 'llm-deepseek', ref);
        }
        else {
            const ambient = launchEnvironmentOf(ctx).get(ref);
            if (ambient !== undefined && ambient.value.length > 0)
                return assertUsableApiKey(ambient.value, 'llm-deepseek', ref);
        }
        throw new LlmError(`llm-deepseek: no API key for provider route "${PROVIDER}"; store ${ref} through the credentials`
            + ` service (the web Models page writes it), or export ${ref} in the launching environment`, 'MISSING_CREDENTIAL');
    };
    ctx.llm.registerConfigurableProviders([
        { provider: PROVIDER, displayName: 'DeepSeek', settingsNs: ctx.fiber.entry?.options.id ?? name, settingsPath: [] },
    ]);
    registerDeepSeekProvider(ctx, PROVIDER, {
        options, providerName: 'DeepSeek',
        resolveAuth: async (connection) => ({ headers: { 'x-api-key': await resolveApiKey(connection) } }),
        discoverModels: (provider) => {
            const connection = options();
            return Promise.resolve(connection.models.map(model => catalogModelInfo(provider, model)));
        },
    });
}
