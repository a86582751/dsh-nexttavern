// Generated from runtime/alpha3/compat/llm-pi-ai/src/index.ts; edit the TypeScript source.
/**
 * Generic pi-ai-backed LLM adapter plugin. One plugin instance owns a dict of
 * provider routes; a route naming an installed pi-ai provider inherits that
 * provider's endpoint, protocol, and model catalog as defaults, and a route
 * pi-ai does not ship is declared outright. Profile facts resolve per request
 * over the optional `llm-pi-ai` user-settings section and the optional
 * credential seam, so a changed key, endpoint, model, or knob reaches the next
 * request without a restart; a changed *route set* (or a route's
 * registration-captured retry policy) re-registers the same adapter instance
 * in place.
 *
 * ```yaml
 * - id: llm
 *   name: '@deepseek-ai/dsh-llm-pi-ai'
 *   config:
 *     providers:
 *       # Catalog route: everything but the credential comes from pi-ai.
 *       openai:
 *         apiKeyEnv: OPENAI_API_KEY
 *         retryPolicy:
 *           mode: normal
 *           maxRetries: 2
 *       # Catalog route with the catalog narrowed and one capacity corrected.
 *       anthropic:
 *         apiKeyEnv: ANTHROPIC_API_KEY
 *         models:
 *           - id: claude-sonnet-4-5
 *             contextWindow: 200000
 *       # Hand-declared route: pi-ai ships nothing under this key.
 *       acme-gateway:
 *         displayName: Acme Gateway
 *         apiKeyEnv: ACME_GATEWAY_API_KEY
 *         api: openai-completions
 *         baseURL: https://gateway.acme.example/v1
 *         # Reasoning dialect for a URL pi-ai cannot recognize.
 *         compat:
 *           thinkingFormat: deepseek
 *         models:
 *           - id: acme-large
 *             name: Acme Large
 *             contextWindow: 65536
 *             maxTokens: 4096
 *           - id: acme-think
 *             name: Acme Think
 *             contextWindow: 262144
 *             maxTokens: 32768
 *             # key = selectable level, value = wire spelling; only off may
 *             # leave the value empty (supported, send nothing).
 *             reasoningEfforts:
 *               off:
 *               high: high
 *               max: ultra
 * ```
 *
 * @module @deepseek-ai/dsh-llm-pi-ai
 */
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { assertUsableApiKey, LlmError, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm';
import { deepEqualJson } from '@deepseek-ai/dsh-util-values';
import { PiAiAdapter } from './adapter.js';
import { authContextFrom, credentialStoreFrom } from './auth.js';
import { catalogProviderIds } from './catalog.js';
import { assertServiceable, Config, resolveProfiles } from './config.js';
import { discoverModels } from './discovery.js';
import { registerPiAiFlows } from './login.js';
export { PiAiAdapter } from './adapter.js';
export { Config } from './config.js';
export { recordKeyFor } from './auth.js';
export { supportedProtocols } from './provider.js';
export const name = 'nexttavern-llm-pi-ai';
export const inject = ['llm'];
const NS = 'llm-pi-ai';
/**
 * The registry captures these per route; a change here must re-register.
 * Sorted by provider so a settings document that merely reorders its keys is
 * not mistaken for a route change.
 */
function registrationFacts(profiles) {
    return [...profiles.entries()]
        // `displayName` rides along because the registry hands it to every selector
        // through `providerInfo()`: a rename that did not re-register would leave
        // the old label showing until some unrelated fact happened to change.
        .map(([provider, profile]) => ({
        provider,
        displayName: profile.displayName,
        retryPolicy: profile.retryPolicy,
    }))
        .sort((left, right) => left.provider.localeCompare(right.provider));
}
/**
 * The configurable-provider directory: every installed catalog route, plus
 * every route the current profiles declare. A hand-declared route has no
 * catalog entry, so without this union it would have no settings address and
 * configuration surfaces could neither show nor edit it.
 * @param profiles - the currently resolved provider profiles.
 * @returns the directory entries in catalog order, declared routes last.
 */
function directoryEntries(profiles) {
    const catalog = new Set(catalogProviderIds());
    const entries = new Map();
    const declare = (provider, displayName, error) => {
        entries.set(provider, {
            provider,
            displayName,
            settingsNs: NS,
            settingsPath: ['providers', provider],
            // Membership of the installed catalog, not of the settings document:
            // narrowing a shipped provider's models stores a profile too, and that
            // route is still one pi-ai knows.
            declared: !catalog.has(provider),
            ...error === undefined ? {} : { error },
        });
    };
    for (const provider of catalog)
        declare(provider, provider);
    for (const [provider, profile] of profiles)
        declare(provider, profile.displayName, profile.catalogError);
    return [...entries.values()];
}
/** Register one generic pi-ai adapter for all configured provider routes. */
export function apply(ctx, config) {
    let current = () => config;
    let acceptedRaw = config;
    let acceptedProfiles = resolveProfiles(config.providers, 'deferred');
    // Stored settings are a draft until both registries accept them. In particular,
    // a rejected added route must not change an existing route's endpoint or key.
    const profiles = () => acceptedProfiles;
    const resolveApiKey = async (provider, profile) => {
        const ref = profile.apiKeyEnv;
        // Only a profile that names no credential at all defers to pi-ai's
        // provider-native discovery. Once one is named, a miss must fail loud:
        // handing pi-ai `undefined` would let it pick up an unrelated ambient key
        // (OPENAI_API_KEY and friends), billing another tenant for a request the
        // deployment meant to authenticate differently.
        if (ref === undefined)
            return undefined;
        const credentials = ctx.get('credentials');
        const hit = credentials !== undefined
            ? (await credentials.resolve(ref))?.value
            // Without the seam the environment is the whole credential plane.
            : launchEnvironmentOf(ctx).get(ref)?.value;
        if (hit !== undefined && hit.length > 0)
            return assertUsableApiKey(hit, 'llm-pi-ai', ref);
        throw new LlmError(`llm-pi-ai: no credential for provider route "${provider}"; its profile resolves ${ref}, which is not`
            + ` set — store ${ref} through the credentials service (the web Models page writes it) or export it,`
            + ' and remove apiKeyEnv only if this provider should authenticate from pi-ai\'s own environment discovery', 'MISSING_CREDENTIAL');
    };
    // One store and one ambient context for the whole plugin instance: both read
    // through `ctx` per call, so they stay correct across the collection rebuilds
    // a configuration change causes, and a sign-in survives one.
    const auth = { credentials: credentialStoreFrom(ctx), authContext: authContextFrom(ctx) };
    const adapter = new PiAiAdapter({
        profiles,
        resolveApiKey,
        auth,
        resolveAttachments: () => ctx.get('attachments'),
        resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath), ref),
        onReplayDegrade: ({ provider, model, reason }) => {
            ctx.logger.warn(`llm-pi-ai: unusable replay state on assistant history for route "${provider}/${model}";`
                + ` sending that message as provider-neutral content (${reason})`);
        },
    });
    // Independent of the route set: signing in is what makes a route worth
    // adding, so the flows are offered before any profile names their provider.
    // Scoped to the authorization seam rather than injected outright, because a
    // composition without it (headless, ACP) simply has no surface to sign in
    // from, while everything else this plugin does still works.
    ctx.inject(['authorization'], (authorized) => { registerPiAiFlows(authorized, auth); });
    // The full installed catalog is configurable from the moment the plugin
    // mounts — dormant or not — so configuration surfaces can offer every
    // pi-ai provider before any route exists. Hand-declared routes join it as
    // profiles appear, and leave with them.
    let directory;
    let directoryFacts;
    const ensureDirectory = () => {
        const entries = directoryEntries(profiles());
        if (deepEqualJson(entries, directoryFacts))
            return;
        // Atomic replace, never dispose-then-register: a route another adapter
        // family already declares (a profile keyed `deepseek-official`) would
        // otherwise leave this plugin's whole directory withdrawn and the Models
        // page empty. The candidate set is validated first, so a collision keeps
        // the previous entries serving and only costs a diagnostic.
        if (directory === undefined) {
            directory = ctx.llm.registerConfigurableProviders(entries);
        }
        else {
            directory.replace(entries);
        }
        directoryFacts = entries;
    };
    ensureDirectory();
    /** Host-owned request inputs for discovery of one configured route. */
    const storedDiscoveryProfile = (provider) => {
        if (provider === undefined)
            return undefined;
        const profile = profiles().get(provider);
        if (profile === undefined)
            return undefined;
        return {
            headers: profile.headers,
            resolveApiKey: () => resolveApiKey(provider, profile),
        };
    };
    // Interrogating an endpoint is a configuration-time action over a draft, so
    // it is offered for the whole namespace rather than per route: the provider
    // a surface is adding does not exist yet. The draft is the whole request
    // except the stored credential and deployment-owned headers: the curated UI
    // accepts neither, so an already-configured route supplies both inside the
    // Host rather than widening the discovery request.
    ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels({ ...request, ...signal === undefined ? {} : { signal } }, () => storedDiscoveryProfile(request.provider)));
    // Route effects bind to this apply fiber via the stable `ctx` reference,
    // even when a swap runs inside the scoped settings callback below. A bare
    // mount (zero routes) is the dormant posture: nothing registers until a
    // settings section supplies profiles, and routes drop when it empties.
    let registration;
    let registeredFacts;
    const ensureRegistrationFacts = () => {
        const facts = registrationFacts(profiles());
        if (deepEqualJson(facts, registeredFacts))
            return;
        // The registry captures the route set and each route's retry policy at
        // registration, so a change to either must re-register. The swap is
        // atomic (same adapter instance, validated before anything moves): a
        // conflicting route leaves the previous routes serving requests, and
        // `registeredFacts` only advances once the registry actually holds the
        // new set — so returning to a working configuration always re-applies.
        const routes = [...profiles().keys()];
        if (registration === undefined) {
            // Dormant bare mount: nothing is registered until a section supplies
            // profiles, and an empty section keeps it that way.
            if (routes.length === 0) {
                registeredFacts = facts;
                return;
            }
            registration = ctx.llm.registerAdapter(routes, adapter);
        }
        else {
            registration.replace(routes);
        }
        registeredFacts = facts;
    };
    ensureRegistrationFacts();
    ctx.inject(['settings'], (settingsCtx) => {
        let registering = true;
        settingsCtx.settings.installSection(ctx, NS, Config, config, {
            validate: (value) => {
                // Stored catalog drift must not prevent registration of the repair UI.
                if (registering) {
                    resolveProfiles(value.providers, 'deferred');
                }
                else {
                    assertServiceable(value, current());
                }
            },
            setSource: (source) => {
                current = source;
            },
            onChange: () => {
                const raw = current();
                if (raw === acceptedRaw)
                    return;
                const previous = acceptedProfiles;
                const next = resolveProfiles(raw.providers, 'deferred');
                // Both native registry replacements are synchronous. Directory changes
                // emit no event; route replacement publishes the completed generation.
                // Expose the candidate only while its metadata is being validated.
                acceptedProfiles = next;
                try {
                    ensureDirectory();
                    ensureRegistrationFacts();
                    acceptedRaw = raw;
                }
                catch (error) {
                    acceptedProfiles = previous;
                    // Restore the directory after a refused route candidate. The route
                    // handle normally rejected before mutation; also restore it if a
                    // synchronous observer threw after the native publication point.
                    ensureDirectory();
                    registration?.replace([...previous.keys()]);
                    registeredFacts = registrationFacts(previous);
                    ctx.logger.error('llm-pi-ai: keeping the previous configuration after a refused registry update');
                    ctx.logger.error(error);
                }
            },
        });
        registering = false;
    });
}
