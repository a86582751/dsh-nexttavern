// Generated from runtime/alpha3/compat/llm-pi-ai/src/index.ts; edit the TypeScript source.
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
function directoryEntries(profiles, settingsNs) {
    const catalog = new Set(catalogProviderIds());
    const entries = new Map();
    const declare = (provider, displayName, error) => {
        entries.set(provider, {
            provider,
            displayName,
            settingsNs,
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
    ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
    const settingsNs = ctx.fiber.entry?.options.id ?? NS;
    const readProviders = () => structuredClone(config.providers.get());
    let acceptedRaw = readProviders();
    let acceptedProfiles = resolveProfiles(acceptedRaw, 'deferred');
    // Loader config is a draft until both registries accept the same generation.
    // Requests and credential snapshots keep using the last accepted generation.
    const profiles = () => acceptedProfiles;
    ctx.on('internal/config', function (_raw, next) {
        const raw = next();
        if (this !== ctx.fiber)
            return raw;
        const candidate = Config(raw);
        assertServiceable({ providers: structuredClone(candidate.providers.get()) }, { providers: acceptedRaw });
        return raw;
    });
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
        const entries = directoryEntries(profiles(), settingsNs);
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
    ctx.llm.registerModelDiscovery(settingsNs, (request, signal) => discoverModels({ ...request, ...signal === undefined ? {} : { signal } }, () => storedDiscoveryProfile(request.provider)));
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
    ctx.on('loader/volatile-update', () => {
        const raw = readProviders();
        if (deepEqualJson(raw, acceptedRaw))
            return;
        const previous = acceptedProfiles;
        try {
            acceptedProfiles = resolveProfiles(raw, 'deferred');
            ensureDirectory();
            ensureRegistrationFacts();
            acceptedRaw = raw;
        }
        catch (error) {
            acceptedProfiles = previous;
            // Directory replacement is silent; route publication is the commit point.
            // Restore both if a route collision or a synchronous observer rejects it.
            ensureDirectory();
            registration?.replace([...previous.keys()]);
            registeredFacts = registrationFacts(previous);
            ctx.logger.error('llm-pi-ai: keeping the previous configuration after a refused registry update');
            ctx.logger.error(error);
        }
    });
}
