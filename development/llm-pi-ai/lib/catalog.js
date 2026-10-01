// Generated from runtime/alpha3/compat/llm-pi-ai/src/catalog.ts; edit the TypeScript source.
/**
 * Materialization of one provider route's model catalog. The installed pi-ai
 * catalog supplies defaults keyed by model id, and a profile's own model
 * entries override them field by field, so a route naming a catalog provider
 * stays configuration-free while a route pi-ai has never heard of is fully
 * describable from `cordis.patch.yml`.
 *
 * Strict resolution rejects unserviceable models before settings writes.
 * Deferred resolution retains their diagnostics so stored catalog drift does
 * not prevent inspection, repair, or requests to independently valid models.
 *
 * @module dsh-llm-pi-ai/catalog
 */
import { builtinProviders, getBuiltinModels, getBuiltinProviders } from 'dsh-nexttavern-pi-ai/providers/all';
/**
 * Pricing for a model the installed catalog does not describe. The harness
 * never reads pi-ai's cost metadata — `replay.ts` zeroes it and no consumer
 * reports spend — so this is the absence of a fact, not a configurable rate.
 */
const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
/**
 * Every pi-ai request modality. The `Record` key type is a drift gate: a pi-ai
 * upgrade that adds or removes a modality fails compilation here naming the
 * drifted key, instead of silently narrowing what a profile may declare.
 */
const MODALITY_GATE = {
    text: true,
    image: true,
};
/** Every request modality a profile may declare. */
export const MODALITIES = Object.keys(MODALITY_GATE);
/**
 * One entry's modality list, or `undefined` when it states no answer. Absent
 * and empty mean the same thing — `[]` describes a model that accepts nothing
 * and could serve no request — which is what makes an entry naming a catalog
 * model without declaring modalities keep the catalog's, since the config
 * schema materializes `[]` for an absent array.
 * @param configured - the list a `models` or `modelOverrides` entry supplied.
 * @returns the declared modalities, or `undefined` to ask the next level.
 */
function declaredInput(configured) {
    return configured === undefined || configured.length === 0 ? undefined : [...configured];
}
/**
 * Every pi-ai thinking level, in pi-ai's canonical escalation order. The
 * `Record` key type is a drift gate: a pi-ai upgrade that adds or removes a
 * level fails compilation here naming the drifted key, instead of silently
 * narrowing what a profile may declare.
 */
const THINKING_LEVEL_GATE = {
    off: true,
    minimal: true,
    low: true,
    medium: true,
    high: true,
    xhigh: true,
    max: true,
};
/** Every pi-ai thinking level a profile may declare, in escalation order. */
export const THINKING_LEVELS = Object.keys(THINKING_LEVEL_GATE);
/**
 * The nameable reasoning-dispatch formats, most-reached first. The `Record`
 * key type is a drift gate: an upstream format addition fails compilation
 * here until it is named, so the offer never silently lags the upstream set.
 * The two `chat-template` variants are nameable because
 * {@link PiAiCompatProfile.chatTemplateKwargs} carries their kwargs;
 * `baseten` is nameable because {@link PiAiCompatProfile.chatTemplateArgs}
 * carries its arguments.
 */
const THINKING_FORMAT_GATE = {
    'openai': true,
    'deepseek': true,
    'openrouter': true,
    'together': true,
    'baseten': true,
    'zai': true,
    'qwen': true,
    'chat-template': true,
    'qwen-chat-template': true,
    'string-thinking': true,
    'ant-ling': true,
};
/** Reasoning-dispatch wire formats a profile may name, most-reached first. */
export const SUPPORTED_THINKING_FORMATS = Object.keys(THINKING_FORMAT_GATE);
/** Drift gate over {@link PiAiMaxTokensField}; an upstream spelling added here fails compilation until named. */
const MAX_TOKENS_FIELD_GATE = {
    max_completion_tokens: true,
    max_tokens: true,
};
/** The output-cap field spellings a profile may name. */
export const MAX_TOKENS_FIELDS = Object.keys(MAX_TOKENS_FIELD_GATE);
/** An upstream reasoning-budget spelling must be classified before it can be configured. */
const THINKING_TOKEN_BUDGET_FIELD_GATE = {
    thinking_token_budget: true,
    thinking_budget: true,
    thinking_budget_tokens: true,
};
/** The reasoning-budget field spellings a profile may name. */
export const THINKING_TOKEN_BUDGET_FIELDS = Object.keys(THINKING_TOKEN_BUDGET_FIELD_GATE);
/** Drift gate over {@link PiAiCacheControlFormat}; a new upstream convention fails compilation until named. */
const CACHE_CONTROL_FORMAT_GATE = {
    anthropic: true,
};
/** The prompt-cache marker conventions a profile may name. */
export const CACHE_CONTROL_FORMATS = Object.keys(CACHE_CONTROL_FORMAT_GATE);
/** Drift gate over {@link PiAiChatTemplateVar}; a new upstream placeholder fails compilation until named. */
const CHAT_TEMPLATE_VAR_GATE = {
    'thinking.enabled': true,
    'thinking.effort': true,
    'thinking.budget': true,
};
/** The request-state placeholders a profile may name. */
export const CHAT_TEMPLATE_VARS = Object.keys(CHAT_TEMPLATE_VAR_GATE);
let providerIndex;
/**
 * Installed catalog providers by id, constructed once. Each entry owns the API
 * implementations for its own models, which is why a catalog route reuses this
 * provider instead of being rebuilt from parts.
 * @returns the catalog provider index.
 */
function catalogProviders() {
    providerIndex ??= new Map(builtinProviders().map(provider => [provider.id, provider]));
    return providerIndex;
}
/**
 * The installed catalog provider for one route, when pi-ai ships one.
 * @param provider - provider route key.
 * @returns the catalog provider, or `undefined` for a route pi-ai does not ship.
 */
export function catalogProvider(provider) {
    return catalogProviders().get(provider);
}
/**
 * Every provider route the installed pi-ai catalog ships.
 * @returns the catalog provider ids.
 */
export function catalogProviderIds() {
    return getBuiltinProviders();
}
/**
 * The installed catalog models for one route, indexed by model id.
 * @param provider - provider route key.
 * @returns catalog models by id; empty for a route pi-ai does not ship.
 */
export function catalogModels(provider) {
    if (!catalogProviders().has(provider))
        return new Map();
    const models = getBuiltinModels(provider);
    return new Map(models.map(model => [model.id, model]));
}
/**
 * Disposition of every `OpenAICompletionsCompat` field. The `Record` key type
 * is a drift gate: a pi-ai upgrade that adds a field fails compilation here
 * until it is classified, so the offer never silently lags the upstream set.
 */
const COMPLETIONS_COMPAT_GATE = {
    supportsStore: 'offer',
    supportsDeveloperRole: 'offer',
    supportsReasoningEffort: 'offer',
    supportsUsageInStreaming: 'offer',
    supportsFinishReason: 'offer',
    maxTokensField: 'offer',
    requiresToolResultName: 'offer',
    requiresAssistantAfterToolResult: 'offer',
    requiresThinkingAsText: 'offer',
    requiresReasoningContentOnAssistantMessages: 'offer',
    thinkingFormat: 'offer',
    chatTemplateKwargs: 'offer',
    chatTemplateArgs: 'offer',
    supportsThinkingTokenBudget: 'offer',
    thinkingTokenBudgetField: 'offer',
    vllmPriority: 'offer',
    supportsStrictMode: 'offer',
    cacheControlFormat: 'offer',
    supportsLongCacheRetention: 'offer',
    openRouterRouting: 'withhold',
    vercelGatewayRouting: 'withhold',
    zaiToolStream: 'withhold',
    supportsOpenAIGrammarTools: 'withhold',
    sendSessionAffinityHeaders: 'withhold',
    deferredToolsMode: 'withhold',
    sessionAffinityFormat: 'withhold',
};
/** Disposition of every `OpenAIResponsesCompat` field; a drift gate like the one above. */
const RESPONSES_COMPAT_GATE = {
    supportsDeveloperRole: 'offer',
    supportsMaxOutputTokens: 'offer',
    supportsStrictMode: 'offer',
    supportsLongCacheRetention: 'offer',
    sessionAffinityFormat: 'withhold',
    supportsOpenAIGrammarTools: 'withhold',
    supportsAdditionalTools: 'withhold',
    supportsToolSearch: 'withhold',
    supportsExplicitPromptCacheMode: 'withhold',
};
/** Disposition of every `AnthropicMessagesCompat` field; a drift gate like the one above. */
const ANTHROPIC_COMPAT_GATE = {
    supportsEagerToolInputStreaming: 'offer',
    supportsLongCacheRetention: 'offer',
    supportsCacheControlOnTools: 'offer',
    supportsTemperature: 'offer',
    forceAdaptiveThinking: 'offer',
    allowEmptySignature: 'offer',
    supportsStrictTools: 'offer',
    sendSessionAffinityHeaders: 'withhold',
    supportsToolReferences: 'withhold',
    supportsMidConvoEffort: 'withhold',
    allowedFallbackModels: 'withhold',
};
/** Disposition of every `BedrockCompat` field; a drift gate like the one above. */
const BEDROCK_COMPAT_GATE = {
    supportsStrictMode: 'offer',
};
/**
 * The compat gate of every wire protocol a profile may configure.
 *
 * Keyed by protocol, but grouped by pi-ai's compat *type*: the three Responses
 * protocols share `OpenAIResponsesCompat`, so a switch settable on one is
 * settable on all three. Keying by protocol alone would refuse
 * `azure-openai-responses` and `openai-codex-responses` the fields their own
 * models declare.
 */
const COMPAT_GATES = {
    'openai-completions': COMPLETIONS_COMPAT_GATE,
    'openai-responses': RESPONSES_COMPAT_GATE,
    'azure-openai-responses': RESPONSES_COMPAT_GATE,
    'openai-codex-responses': RESPONSES_COMPAT_GATE,
    'anthropic-messages': ANTHROPIC_COMPAT_GATE,
    'bedrock-converse-stream': BEDROCK_COMPAT_GATE,
};
/**
 * The compat gate of one resolved protocol. A `string` lookup rather than a
 * keyed read: a route's `api` is configuration, so it may name a protocol
 * pi-ai gives no compat type — or none at all.
 * @param api - resolved wire protocol.
 * @returns that protocol's field gate, or `undefined` when it takes no compat.
 */
function compatGate(api) {
    return COMPAT_GATES[api];
}
/**
 * The compat entries a profile actually set.
 *
 * schemastery materializes an absent dict as `{}` — the behavior
 * `reasoningEfforts` works around with a union — so every parsed profile
 * carries both template-argument keys whether or not anyone wrote them. An
 * empty one states nothing here: it would send no arguments, which is exactly
 * what leaving the field out does, so absent and empty are the same request
 * and neither may make a route look like it configured a switch. A valueless
 * scalar is the other thing schemastery lets through, and it is refused by
 * {@link assertOfferedCompatFields} before this runs rather than filtered.
 * @param compat - the configured switches, when any.
 * @returns the entries carrying a value, in declaration order.
 */
function configuredCompatEntries(compat) {
    return Object.entries(compat ?? {}).flatMap(([field, value]) => {
        const empty = typeof value === 'object' && value !== null && !Array.isArray(value)
            && Object.keys(value).length === 0;
        return empty ? [] : [[field, value]];
    });
}
/**
 * The protocols offering one compat field, in {@link COMPAT_GATES} order.
 * @param field - configured compat field name.
 * @returns the protocols whose compat takes it; empty when none does, which
 *   is either a withheld field or a name no upstream compat type declares.
 */
function compatProtocols(field) {
    return Object.entries(COMPAT_GATES).flatMap(([api, gate]) => gate[field] === 'offer' ? [api] : []);
}
/**
 * The compat fields one protocol offers, for a diagnostic that has to show
 * what was available instead of the name that missed.
 * @param api - wire protocol.
 * @returns the offered field names, or an empty list for a protocol taking no compat.
 */
function offeredCompatFields(api) {
    return Object.entries(compatGate(api) ?? {}).flatMap(([field, disposition]) => disposition === 'offer' ? [field] : []);
}
/**
 * Every offered field name, deduplicated, for the one diagnostic that cannot
 * narrow by protocol: the vocabulary check runs before any protocol resolves,
 * which is what lets it refuse a misspelling on a route whose models would
 * never have reached the protocol that declares the intended field.
 * @returns the offered field names across every protocol, in gate order.
 */
function allOfferedCompatFields() {
    const fields = new Set();
    for (const api of Object.keys(COMPAT_GATES)) {
        for (const field of offeredCompatFields(api))
            fields.add(field);
    }
    return [...fields];
}
/**
 * Reject a compat key no protocol offers. Runs before any protocol is
 * resolved, so a withheld field or a misspelling fails even on a route whose
 * models never reach the protocol that would have taken it — the alternative
 * being the silent drop that let an unreadable switch look applied.
 * @param provider - provider route key, for diagnostics.
 * @param site - the configuration site, for diagnostics.
 * @param compat - the configured switches, when any.
 * @throws Error naming the offending key.
 */
function assertOfferedCompatFields(provider, site, compat) {
    // Every key, not only the ones carrying a value: a withheld or undeclared
    // name is never in the schema, so schemastery cannot have materialized it —
    // whatever its value, a person wrote it and expects it to do something.
    for (const [field, value] of Object.entries(compat ?? {})) {
        // The name is judged before the value, so a withheld or misspelled key
        // written bare is refused for being that name rather than for being empty:
        // the other order sends someone to supply a value the key would be refused
        // with anyway.
        if (compatProtocols(field).length === 0) {
            const declared = Object.values(COMPAT_GATES).some(gate => gate[field] !== undefined);
            if (declared) {
                invalid(provider, `${site} sets compat "${field}", which is not configurable here: pi-ai's installed`
                    + ' catalog sets it for the vendors that need it, so name that provider as the route instead');
            }
            invalid(provider, `${site} sets compat "${field}", which no wire protocol declares; the configurable`
                + ` switches are ${allOfferedCompatFields().join(', ')}`);
        }
        // A valueless key (`supportsDeveloperRole:`) survives schemastery, which
        // passes nullable data through before any member schema runs — the same
        // behavior `reasoningEfforts` documents — and a `cordis.yml` entry may
        // reach the same state through `!!js undefined`. Either way the key is
        // kept, so carrying it forward writes nothing over whatever the next layer
        // resolved, leaving pi-ai's `??` at its baseURL detection: the "written but
        // not applied" outcome this surface exists to refuse.
        if (value == null) {
            invalid(provider, `${site} sets compat "${field}" with no value; give it one, or remove the key to`
                + ' leave the field to the next layer — the installed catalog entry, then pi-ai\'s own detection');
        }
    }
}
/** An expected configuration failure that stored-catalog reads may retain for repair. */
export class PiAiCatalogError extends Error {
}
/** Report a route the deployment cannot serve, naming the settings key at fault. */
function invalid(provider, detail) {
    throw new PiAiCatalogError(`llm-pi-ai: provider "${provider}" ${detail}`);
}
/**
 * The one wire protocol a catalog route's shipped models agree on. This is what
 * lets a deployment add a model the installed catalog has not caught up with —
 * a provider's newest release — without restating the protocol its siblings
 * already use. A route whose shipped models disagree (an OpenAI-style catalog
 * spanning Responses and Chat Completions) has no such answer, so a model it
 * does not describe must name its protocol at the route.
 */
function sharedCatalogApi(defaults) {
    const apis = new Set();
    for (const model of defaults.values())
        apis.add(model.api);
    return apis.size === 1 ? [...apis][0] : undefined;
}
/**
 * Resolve one model's reasoning capability from its declared efforts.
 *
 * A declared dict translates to pi-ai's `thinkingLevelMap` with every level
 * decided explicitly: declared levels carry their wire spelling, undeclared
 * levels are pinned to `null` (unsupported). Pinning matters because pi-ai's
 * own defaulting is asymmetric — an absent key means "supported" for the five
 * base levels but "unsupported" for `xhigh`/`max` — and a profile author
 * should not need to know that. A declared `off` with no value is the one
 * exception: it stays absent from the map, which pi-ai reads as "supported,
 * send nothing" — the correct dispatch where not thinking is the parameter's
 * absence — while `off` with a value sends that value.
 * @param provider - provider route key, for diagnostics.
 * @param entry - the configured model entry.
 * @param base - the installed catalog entry of the same id, when one exists.
 * @returns the reasoning fields the materialized model carries.
 */
function resolveModelReasoning(provider, entry, base) {
    const efforts = entry.reasoningEfforts;
    if (efforts === undefined) {
        // Reasoning rides the installed entry or is absent: a bare capability flag
        // would make pi-ai advertise effort levels with no `thinkingLevelMap` to
        // spell them, and no listing endpoint reports a model's reasoning
        // protocol. The entry's map (when any) arrives through the `...base`
        // spread in the model literal.
        return { reasoning: base?.reasoning ?? false };
    }
    // The installed entry's map may ride along through `...base`; pi-ai never
    // reads it on a non-reasoning model, so stripping it is not worth a field
    // enumeration here.
    if (efforts === false)
        return { reasoning: false };
    // A YAML `reasoningEfforts:` left valueless arrives as null through the
    // schema union — outside the field's declared type, hence the widening —
    // while an explicit `{}` arrives as an empty dict. Both declare nothing,
    // and neither is a spelling of "inherit" or "disable".
    if (efforts === null || Object.keys(efforts).length === 0) {
        invalid(provider, `model "${entry.id}" has an empty reasoningEfforts; declare the offered levels, set`
            + ' false for a non-reasoning model, or omit the field to keep the installed catalog\'s capability');
    }
    const declared = THINKING_LEVELS.flatMap((level) => {
        const wire = efforts[level];
        return wire === undefined ? [] : [[level, wire]];
    });
    for (const [level, wire] of declared) {
        if (wire === null) {
            if (level !== 'off') {
                invalid(provider, `model "${entry.id}" reasoningEfforts.${level} needs the wire value dispatch`
                    + ' should send; only "off" may leave it empty');
            }
        }
        else if (wire.length === 0) {
            invalid(provider, `model "${entry.id}" reasoningEfforts.${level} must not be an empty string`);
        }
    }
    if (!declared.some(([level]) => level !== 'off')) {
        invalid(provider, `model "${entry.id}" reasoningEfforts offers no level beyond "off"; declare a thinking`
            + ' level, or set reasoningEfforts to false for a non-reasoning model');
    }
    const map = {};
    for (const level of THINKING_LEVELS) {
        const wire = efforts[level];
        if (wire === undefined) {
            map[level] = null;
        }
        else if (wire !== null) {
            map[level] = wire;
        }
    }
    return { reasoning: true, thinkingLevelMap: map };
}
/**
 * Resolve one model's compat block from the profile's switches.
 *
 * A model switch wins over the route switch field by field; whatever neither
 * sets keeps the installed entry's value, and a field no layer decides falls
 * through to pi-ai's own detection. A model-level switch its protocol does not
 * take fails resolution — about one named model it can only be a mistake —
 * while a route-level one skips past such models, since a route default must
 * stay settable on a route whose models do not all speak one protocol. Every
 * field reaching here is offered by some protocol; {@link
 * assertOfferedCompatFields} has already refused the rest.
 * @param provider - provider route key, for diagnostics.
 * @param entry - the configured model entry.
 * @param route - the route-level switches, when any.
 * @param base - the installed catalog entry of the same id, when one exists.
 * @param api - the model's resolved wire protocol.
 * @returns a `compat` field to spread into the model, or nothing.
 */
function resolveModelCompat(provider, entry, route, base, api) {
    const gate = compatGate(api);
    const configured = {};
    for (const [field, value] of configuredCompatEntries(route)) {
        if (gate?.[field] !== 'offer')
            continue;
        configured[field] = value;
    }
    for (const [field, value] of configuredCompatEntries(entry.compat)) {
        if (gate?.[field] !== 'offer') {
            const offered = offeredCompatFields(api);
            invalid(provider, `model "${entry.id}" sets compat "${field}", but its api is "${api}", which does not`
                + ` take it; that switch exists on ${compatProtocols(field).join(', ')}, and "${api}" offers`
                + ` ${offered.length === 0 ? 'no configurable compat' : offered.join(', ')}`);
        }
        configured[field] = value;
    }
    if (Object.keys(configured).length === 0)
        return {};
    // The installed entry's compat matches the entry's OWN api — a route-level
    // `api` repoint (an anthropic catalog served through an OpenAI-compatible
    // gateway) leaves `base.compat` in the other protocol's shape, so it is
    // inherited only while the resolved api still is the entry's. A repointed
    // model starts from pi-ai's baseURL-derived detection instead, which is
    // what a protocol change means for every other compat field too.
    const inherited = base?.api === api ? base.compat : undefined;
    return { compat: { ...inherited, ...configured } };
}
/**
 * Materialize one route's catalog by merging the installed catalog defaults
 * under the configured entries. A route with no configured `models` serves the
 * installed catalog unchanged, which is what keeps an existing
 * `providers: { deepseek: { apiKeyEnv: … } }` profile working untouched.
 * @param request - the route-level catalog facts.
 * @param validation - strict writes reject every error; deferred reads retain model diagnostics.
 * @returns the materialized models and the explicitly configured request caps.
 */
export function resolveRouteModels(request, validation = 'strict') {
    const { provider } = request;
    const defaults = catalogModels(provider);
    const providerBaseUrl = catalogProvider(provider)?.baseUrl;
    // An absent `models` key and an empty one are the same request: the config
    // schema materializes `[]` for the absent case, and an empty catalog could
    // serve no request anyway, so both mean "serve the installed catalog".
    const configured = request.models ?? [];
    const overrides = request.modelOverrides ?? {};
    const modelErrors = new Map();
    // Writes reject missing referents. Stored overrides retain a diagnostic
    // after catalog removal rather than silently disappearing.
    for (const [id, override] of Object.entries(overrides)) {
        if (id.length === 0)
            invalid(provider, 'has a modelOverrides entry with an empty model id');
        if (defaults.size === 0) {
            invalid(provider, `sets modelOverrides for "${id}", but the installed catalog does not describe this route;`
                + ' a declared route spells every model out in its models list');
        }
        if (configured.length > 0) {
            invalid(provider, `sets modelOverrides for "${id}" beside a models list; models already replaces the served`
                + ' catalog, so declare the fields on its entries');
        }
        if (!defaults.has(id)) {
            const message = `modelOverrides names "${id}", which the installed catalog does not describe`;
            if (validation === 'strict')
                invalid(provider, message);
            modelErrors.set(id, `llm-pi-ai: provider "${provider}" ${message}`);
        }
        // The id lives in the dict key; a value carrying its own would quietly
        // rename the model it meant to customize. The static shape already omits
        // it — this guards the schema boundary, which passes unknown keys through.
        if ('id' in override) {
            invalid(provider, `modelOverrides entry "${id}" sets "id", which is the dict key`);
        }
    }
    // An override becomes the catalog entry's configuration, so everything a
    // models entry may declare — capacities, efforts, compat — resolves through
    // the same path with the same diagnostics and request-default semantics.
    const entries = configured.length > 0
        ? configured
        : [...defaults.values()].map(model => ({ id: model.id, ...overrides[model.id] }));
    if (entries.length === 0) {
        invalid(provider, 'resolves no models; the installed catalog does not describe this route, so its models'
            + ' must be listed in configuration');
    }
    const routeApi = sharedCatalogApi(defaults);
    // Vocabulary before protocols: a withheld or undeclared switch is refused
    // wherever it is written, so it cannot look applied on a route whose models
    // never reach the protocol that would have taken it.
    assertOfferedCompatFields(provider, 'route', request.compat);
    const seen = new Set();
    const configuredMaxTokens = new Map();
    const resolveEntry = (entry) => {
        assertOfferedCompatFields(provider, `model "${entry.id}"`, entry.compat);
        if (entry.id.length === 0)
            invalid(provider, 'has a model with an empty id');
        if (seen.has(entry.id))
            invalid(provider, `lists model "${entry.id}" more than once`);
        seen.add(entry.id);
        const base = defaults.get(entry.id);
        const api = request.api ?? base?.api ?? routeApi;
        if (api === undefined) {
            invalid(provider, `model "${entry.id}" needs an api; the installed catalog does not describe it, so set the`
                + ' route\'s api to the wire protocol its endpoint speaks');
        }
        const baseUrl = request.baseURL ?? base?.baseUrl ?? providerBaseUrl;
        if (baseUrl === undefined) {
            invalid(provider, `model "${entry.id}" needs a baseURL; the installed catalog does not describe this route`);
        }
        // Capacities fall back to the route's own defaults, so a model listing that
        // discloses nothing but ids still yields a serviceable route. The fallback
        // is a guess by construction, which is why it is a configurable route field
        // rather than a constant buried here.
        const contextWindow = entry.contextWindow ?? base?.contextWindow ?? request.defaultContextWindow;
        if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
            invalid(provider, `model "${entry.id}" contextWindow must be a positive integer`);
        }
        const maxTokens = entry.maxTokens ?? base?.maxTokens ?? request.defaultMaxTokens;
        if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
            invalid(provider, `model "${entry.id}" maxTokens must be a positive integer`);
        }
        // Only a value the profile named is a deployment choice; the catalog's is
        // the model's capability and stays out of request defaults.
        if (entry.maxTokens !== undefined)
            configuredMaxTokens.set(entry.id, entry.maxTokens);
        return {
            // The installed entry lays the floor, and the fields below override it.
            // Enumerating instead would silently drop every `Model` field this
            // package does not model — reasoning-level spellings, compatibility
            // quirks, model headers, and whatever a pi-ai upgrade adds next. Spread,
            // never enumerate.
            ...base,
            id: entry.id,
            name: entry.name ?? base?.name ?? entry.id,
            api,
            provider,
            baseUrl,
            input: declaredInput(entry.input) ?? base?.input ?? [...request.defaultInput],
            cost: base?.cost ?? NO_COST,
            contextWindow,
            maxTokens,
            ...resolveModelReasoning(provider, entry, base),
            ...resolveModelCompat(provider, entry, request.compat, base, api),
        };
    };
    const models = [];
    for (const entry of entries) {
        let model;
        try {
            model = resolveEntry(entry);
        }
        catch (error) {
            if (validation === 'strict' || !(error instanceof PiAiCatalogError))
                throw error;
            modelErrors.set(entry.id, error.message);
            continue;
        }
        models.push(model);
    }
    // A later duplicate invalidates the id, including an earlier resolved entry.
    const serviceableModels = models.filter(model => !modelErrors.has(model.id));
    // Per field, not per block: a route may default a switch its completions
    // models take beside one only its anthropic models do, and neither should
    // fail for the other's sake. What is refused is a route default no model on
    // the route could ever read, which is a route that will not behave as written.
    for (const [field] of configuredCompatEntries(request.compat)) {
        const takers = compatProtocols(field);
        if (serviceableModels.some(model => takers.includes(model.api)))
            continue;
        invalid(provider, `sets compat "${field}", but no model on the route speaks a protocol that takes it;`
            + ` it exists on ${takers.join(', ')}`);
    }
    return { models: serviceableModels, configuredMaxTokens, modelErrors };
}
