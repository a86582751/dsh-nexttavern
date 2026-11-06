// Generated from runtime/alpha3/compat/llm-deepseek-account/src/index.ts; edit the TypeScript source.
import { ACCOUNT_QUOTA_EXCEEDED_CODE, LlmError, QUOTA_EXCEEDED_CODE } from 'dsh-nexttavern-native-llm';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { plainOptions, resolveAdapterOptions, registerDeepSeekProvider, catalogModelInfo } from 'dsh-nexttavern-native-llm-deepseek';
import { Config } from '@deepseek-ai/dsh-llm-deepseek-account';
export { Config } from '@deepseek-ai/dsh-llm-deepseek-account';
export const name = 'llm-deepseek-account';
export const inject = ['llm'];
const PROVIDER = 'deepseek-account';
export function apply(ctx, config) {
    const options = () => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx));
    options();
    const resolveAuth = async (connection) => {
        const account = ctx.get('deepseekAccount');
        const token = await account?.resolveToken(connection.baseURL);
        if (token === undefined)
            throw new LlmError('Sign in to DeepSeek to use the account provider. The request destination must allow account authentication.', 'ACCOUNT_SIGN_IN_REQUIRED');
        return {
            headers: { 'x-dsh-auth-token': token },
            onRequestError: async (error) => {
                if (!(error instanceof LlmError))
                    return error;
                if (error.code === QUOTA_EXCEEDED_CODE) {
                    return new LlmError(error.message, ACCOUNT_QUOTA_EXCEEDED_CODE, { ...error.failure, cause: error });
                }
                if (error.failure.status !== 401)
                    return error;
                const rejected = new LlmError(error.message, 'ACCOUNT_TOKEN_INVALID', { ...error.failure, cause: error });
                try {
                    await account?.rejectToken(token);
                }
                catch (_credentialRemovalFailed) { /* Storage failure cannot replace the inference failure. */ }
                return rejected;
            },
        };
    };
    ctx.llm.registerConfigurableProviders([
        { provider: PROVIDER, displayName: 'DeepSeek Account', settingsNs: ctx.fiber.entry?.options.id ?? name, settingsPath: [] },
    ]);
    registerDeepSeekProvider(ctx, PROVIDER, {
        options, resolveAuth, providerName: 'DeepSeek Account',
        discoverModels: async (provider) => {
            const connection = options();
            try {
                await resolveAuth(connection);
            }
            catch (error) {
                if (error instanceof LlmError && error.code === 'ACCOUNT_SIGN_IN_REQUIRED')
                    return [];
                throw error;
            }
            return connection.models.map(model => catalogModelInfo(provider, model));
        },
    });
}
