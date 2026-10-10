// Generated from runtime/alpha3/src/core/tavern-author-browser-guest-v2.ts; edit the TypeScript source.
/** Evaluated only inside QuickJS. The returned controller is retained by the
 * Worker as a private handle; author code receives only the declared facade. */
export function browserGuestBootstrapV2(config) {
    const parse = JSON.parse.bind(JSON), stringify = JSON.stringify.bind(JSON);
    const clone = (value) => parse(stringify(value));
    const freeze = (value) => {
        if (value && typeof value === 'object') {
            for (const child of Object.values(value))
                freeze(child);
            Object.freeze(value);
        }
        return value;
    };
    const dom = globalThis.__ownedDomV2, asyncRpc = globalThis.__ownedAsyncV2;
    const notify = globalThis.__ownedNotifyV2;
    delete globalThis.__ownedDomV2;
    delete globalThis.__ownedAsyncV2;
    delete globalThis.__ownedNotifyV2;
    const callbacks = new Map(), callbackIds = new WeakMap();
    const refs = new Map(), metadata = new WeakMap(), methods = new Set(config.methods);
    const instances = Object.create(null), registrations = [], effects = [], cleanupRemovals = [];
    const sourceResources = new Map();
    let sequence = 0, origin = null, snapshot = freeze(config.snapshot), invocation = null, activeCallback = null;
    let gestureId, generatedTask = null, saveSequence = 0;
    let executionCallback = null;
    let worldbookSequence = 0, worldbookRevoked = false;
    let personaSequence = 0, personaRevoked = false;
    const chatMetadata = { tainted: false };
    const withOrigin = (next, fn) => { const old = origin; origin = next; try {
        return fn();
    }
    finally {
        origin = old;
    } };
    const callback = (fn) => {
        let id = callbackIds.get(fn);
        if (id === undefined) {
            id = ++sequence;
            callbackIds.set(fn, id);
            callbacks.set(id, { fn, origin });
        }
        return { __callback: id, scriptIdentity: callbacks.get(id).origin.scriptIdentity };
    };
    function encode(value) {
        if (value === undefined)
            return { __undefined: true };
        if (typeof value === 'function')
            return callback(value);
        if (value && typeof value === 'object') {
            const owned = metadata.get(value);
            if (owned)
                return owned;
            if (Array.isArray(value))
                return value.map(encode);
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
        }
        return value;
    }
    const rpc = (payload) => {
        const result = parse(dom(stringify(payload)));
        if (result.error)
            throw Error(result.error);
        return decode(result.value);
    };
    function decode(value) {
        if (value && typeof value === 'object') {
            if (value.__undefined)
                return undefined;
            if (value.__window)
                return facade;
            if (value.__handle !== undefined) {
                const id = value.__handle;
                if (refs.has(id))
                    return refs.get(id);
                const proxy = new Proxy(Object.create(null), {
                    get(_target, key) {
                        if (typeof key === 'symbol' || key === 'then')
                            return undefined;
                        if (methods.has(key))
                            return (...args) => rpc({ op: 'call', handle: id, method: key, args: encode(args) });
                        return rpc({ op: 'get', handle: id, key });
                    },
                    set(_target, key, next) { rpc({ op: 'set', handle: id, key, value: encode(next) }); return true; },
                });
                refs.set(id, proxy);
                metadata.set(proxy, value);
                return proxy;
            }
            if (Array.isArray(value))
                return value.map(decode);
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
        }
        return value;
    }
    const request = (kind, payload) => asyncRpc(stringify({ kind, callbackId: executionCallback,
        scriptIdentity: origin?.scriptIdentity, ...payload })).then(parse);
    function setSnapshot(next) {
        if (next.readRevision < snapshot.readRevision)
            return;
        if (next.basis.sourceSnapshotSha256 !== snapshot.basis.sourceSnapshotSha256)
            sourceResources.clear();
        snapshot = freeze(next);
    }
    function worldbookData() {
        if (worldbookRevoked)
            throw Error('BROWSER_GENERATION_REVOKED');
        if (!snapshot.worldbook)
            throw Error('AUTHOR_WORLDBOOK_UNAVAILABLE');
        return snapshot.worldbook;
    }
    function namedWorldbookData(name) {
        const data = worldbookData();
        if (name !== data.primaryName)
            throw Error('AUTHOR_WORLDBOOK_NOT_FOUND');
        return data;
    }
    function worldbookEntries(entries) {
        const keys = (values) => values.map(key => {
            const match = key.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
            if (!match || /(^|[^\\])\//.test(match[1]))
                return key;
            try {
                return new RegExp(match[1].replace('\\/', '/'), match[2]);
            }
            catch {
                return key;
            }
        });
        return clone(entries).map((entry) => {
            entry.strategy.keys = keys(entry.strategy.keys);
            entry.strategy.keys_secondary.keys = keys(entry.strategy.keys_secondary.keys);
            return entry;
        });
    }
    const getWorldbookNames = () => clone(worldbookData().names);
    const getCurrentCharPrimaryLorebook = () => worldbookData().primaryName;
    const getCharWorldbookNames = (name) => {
        if (name !== 'current')
            throw Error('AUTHOR_WORLDBOOK_CHARACTER_UNSUPPORTED');
        return { primary: getCurrentCharPrimaryLorebook(), additional: [] };
    };
    const getWorldbook = (name) => worldbookEntries(namedWorldbookData(name).entries);
    async function mutateWorldbook(name, mutation, context) {
        if (!origin)
            throw Error('BROWSER_SCRIPT_NOT_OWNED');
        if (worldbookRevoked)
            throw Error('BROWSER_GENERATION_REVOKED');
        const basis = context?.basis ?? namedWorldbookData(name), scriptIdentity = context?.scriptIdentity ?? origin.scriptIdentity;
        // Every guest operation has its own stable ID. Transport retries reuse the
        // exact request; a following delete/create never collapses into one intent.
        const operationId = 'browser-worldbook-' + config.worldbookOperationPrefix + '-' + ++worldbookSequence;
        const wire = parse(stringify(mutation, (_key, value) => value instanceof RegExp ? value.toString() : value));
        const reply = await request('mutate-worldbook', { scriptIdentity, request: { scriptIdentity, name, operationId,
                expectedDataSha256: basis.dataSha256, mutation: wire } });
        if (reply.result.kind === 'refused')
            throw Error(reply.result.diagnostics.map((row) => row.code).join(','));
        if (!reply.snapshot) {
            worldbookRevoked = true;
            throw Error('BROWSER_GENERATION_REVOKED');
        }
        setSnapshot(reply.snapshot);
        return reply;
    }
    const replaceWorldbook = async (name, entries) => {
        await mutateWorldbook(name, { kind: 'replace-worldbook', entries });
    };
    const updateWorldbookWith = async (name, updater) => {
        const context = { basis: namedWorldbookData(name), scriptIdentity: origin?.scriptIdentity };
        const entries = await updater(getWorldbook(name));
        const reply = await mutateWorldbook(name, { kind: 'replace-worldbook', entries }, context);
        return worldbookEntries(reply.worldbook);
    };
    const createWorldbookEntries = async (name, entries) => {
        const reply = await mutateWorldbook(name, { kind: 'create-entries', entries });
        return { worldbook: worldbookEntries(reply.worldbook), new_entries: worldbookEntries(reply.new_entries) };
    };
    const deleteWorldbookEntries = async (name, predicate) => {
        const uids = getWorldbook(name).filter((entry) => predicate(entry)).map((entry) => entry.uid);
        const reply = await mutateWorldbook(name, { kind: 'delete-entries', uids });
        return { worldbook: worldbookEntries(reply.worldbook), deleted_entries: worldbookEntries(reply.deleted_entries) };
    };
    const worldbookApis = { getWorldbookNames, getWorldbook, replaceWorldbook, updateWorldbookWith,
        createWorldbookEntries, deleteWorldbookEntries, getCurrentCharPrimaryLorebook, getCharWorldbookNames };
    function personaData() {
        if (personaRevoked)
            throw Error('BROWSER_GENERATION_REVOKED');
        if (!snapshot.personas)
            throw Error('NATIVE_PERSONA_UNAVAILABLE');
        return snapshot.personas;
    }
    function findPersonaId(id = 'current') {
        const data = personaData();
        if (!id || id === 'current')
            return data.selectedId;
        if (data.profiles.some((row) => row.avatar_id === id))
            return id;
        const matches = data.profiles.filter((row) => row.name.toLowerCase() === id.toLowerCase());
        return matches.length === 1 ? matches[0].avatar_id : null;
    }
    const personaFields = ['avatar_id', 'avatar', 'name', 'title', 'description', 'position', 'depth', 'role',
        'lorebook', 'connections', 'is_default'];
    const personaValue = (value) => clone(Object.fromEntries(personaFields.filter(key => value[key] !== undefined)
        .map(key => [key, value[key]])));
    const getPersonaIds = () => personaData().profiles.map((row) => row.avatar_id);
    const getPersonaNames = () => personaData().profiles.map((row) => row.name);
    const getCurrentPersonaId = () => personaData().selectedId;
    const getCurrentPersonaName = () => personaData().profiles.find((row) => row.avatar_id === personaData().selectedId)?.name ?? null;
    function getPersona(id = 'current') {
        const avatarId = findPersonaId(id), row = personaData().profiles.find((item) => item.avatar_id === avatarId);
        if (!row)
            throw Error(`persona '${id}' 不存在或名称不唯一`);
        return personaValue(row);
    }
    const getPersonaAvatarPath = (id = 'current') => {
        const avatarId = findPersonaId(id);
        return avatarId ? '/api/roleplay/persona-avatar?id=' + encodeURIComponent(avatarId) : null;
    };
    function mutatePersona(mutation) {
        if (!origin)
            throw Error('BROWSER_SCRIPT_NOT_OWNED');
        const data = personaData(), scriptIdentity = origin.scriptIdentity;
        const operationId = 'browser-persona-' + config.worldbookOperationPrefix + '-' + ++personaSequence;
        const request = { scriptIdentity, operationId, expectedDataSha256: data.dataSha256, mutation: clone(mutation) };
        // Asyncify waits for the account owner's actual receipt. The same primitive
        // also backs el.click(), whose original author call has no await.
        const reply = parse(dom(stringify({ op: 'persona-mutation', scriptIdentity, request })));
        if (reply.error) {
            personaRevoked = true;
            throw Error(reply.error);
        }
        const result = reply.value;
        if (result.result.kind === 'refused')
            throw Error(result.result.code);
        if (!result.snapshot) {
            personaRevoked = true;
            throw Error('BROWSER_GENERATION_REVOKED');
        }
        setSnapshot(result.snapshot);
        return result.result.receipt.result;
    }
    const createPersona = async (name, partial = {}, _options = {}) => mutatePersona({ kind: 'create', name, persona: personaValue(partial) });
    const replacePersona = async (id, partial = {}, _options = {}) => {
        const avatarId = findPersonaId(id);
        if (!avatarId)
            throw Error(`persona '${id}' 不存在或名称不唯一`);
        mutatePersona({ kind: 'replace', id: avatarId, persona: personaValue(partial) });
    };
    const personaApis = { getPersonaIds, getPersonaNames, getCurrentPersonaId, getCurrentPersonaName,
        getPersona, getPersonaAvatarPath, createPersona, replacePersona };
    const personaNodes = new Map();
    const personaNode = (id) => {
        if (!personaNodes.has(id))
            personaNodes.set(id, Object.freeze({
                dataset: Object.freeze({ avatarId: id }), getAttribute: (key) => key === 'data-avatar-id' ? id : null,
                click: () => {
                    if (!personaData().profiles.some((row) => row.avatar_id === id))
                        throw Error('NATIVE_PERSONA_NOT_FOUND');
                    mutatePersona({ kind: 'select', id });
                },
            }));
        return personaNodes.get(id);
    };
    function personaSelection(selector, within = false) {
        const root = '#user_avatar_block';
        if (selector === root)
            return [personaRoot];
        const container = selector.startsWith(root + ' ') ? selector.slice(root.length + 1) : within ? selector : '';
        if (container === '.avatar-container')
            return personaData().profiles.map((row) => personaNode(row.avatar_id));
        const match = container.match(/^\.avatar-container\[data-avatar-id="((?:\\.|[^"\\])*)"\]$/);
        if (!match)
            return selector.startsWith(root) ? [] : undefined;
        const id = match[1].replace(/\\(["\\])/g, '$1');
        return personaData().profiles.some((row) => row.avatar_id === id) ? [personaNode(id)] : [];
    }
    const personaRoot = Object.freeze({
        querySelector: (selector) => personaSelection(selector, true)?.[0] ?? null,
        querySelectorAll: (selector) => personaSelection(selector, true) ?? [],
    });
    function personaJQuery(selector) {
        const nodes = personaSelection(selector, true) ?? [];
        const collection = { length: nodes.length,
            find: (query) => personaJQuery(selector === '#user_avatar_block' ? '#user_avatar_block ' + query : ''),
            attr: (key) => nodes[0]?.getAttribute?.(key),
            click: () => { for (const node of nodes)
                node.click?.(); return collection; }, };
        nodes.forEach((node, index) => { collection[index] = node; });
        return Object.freeze(collection);
    }
    // The catalog is fully projected; there is no invented pagination state.
    personaJQuery.fn = Object.freeze({});
    async function avatarFetch(url, options = {}) {
        if (url !== '/api/avatars/get' || options.method !== 'POST')
            throw Error('BROWSER_FETCH_UNSUPPORTED');
        const ids = clone(personaData().avatarIds);
        return Object.freeze({ ok: true, status: 200, json: async () => clone(ids) });
    }
    function sourceResource(operation) {
        if (!origin)
            throw Error('BROWSER_SCRIPT_NOT_OWNED');
        const key = stringify([origin.scriptIdentity, origin.descriptorSha256, operation]);
        if (!sourceResources.has(key)) {
            // Asyncify suspends this ordinary guest call. DATA is parsed directly,
            // so author keys never become DOM handles through decode's control tags.
            const reply = parse(dom(stringify({ op: 'source-resource', scriptIdentity: origin.scriptIdentity, operation })));
            if (reply.error)
                throw Error(reply.error);
            sourceResources.set(key, freeze(reply.value));
        }
        // Upstream getters detach returned DATA. The immutable cache avoids another
        // HTTP/HTML transfer while each author receives its own ordinary JSON value.
        return clone(sourceResources.get(key));
    }
    const getScriptId = () => sourceResource({ kind: 'script-id' });
    const getScriptTrees = (option) => sourceResource({ kind: 'script-trees', scope: option?.type });
    const variableValue = (value) => value?.kind === 'available' ? value.variables : undefined;
    function getVariables(option = { type: 'chat' }) {
        if (option.type === 'script')
            return sourceResource({ kind: 'self-script-data' });
        const frame = snapshot.scopeFrame;
        let result;
        if (option.type === 'chat') {
            result = variableValue(frame.scopes.chat);
            if (config.ownedChatKey && snapshot.authorChat?.exists)
                result = { ...(result || {}), [config.ownedChatKey]: snapshot.authorChat.value };
        }
        else if (option.type === 'character' || option.type === 'global')
            result = variableValue(frame.scopes[option.type]);
        else if (option.type === 'message') {
            const messages = snapshot.messages;
            const id = option.message_id === undefined || option.message_id === 'latest' ? -1 : option.message_id;
            const position = id < 0 ? messages.length + id : id;
            result = variableValue(messages[position]?.variables);
        }
        return result === undefined ? undefined : freeze(clone(result));
    }
    function getParentVariables(option = { type: 'chat' }) {
        if (option.type !== 'script')
            return getVariables(option);
        if (typeof option.script_id !== 'string' || !option.script_id)
            throw Error('AUTHOR_SCRIPT_RESOURCE_SCRIPT_ID_REQUIRED');
        return sourceResource({ kind: 'explicit-script-data', scriptId: option.script_id });
    }
    function getChatMessages(range = '0-{{lastMessageId}}', options = {}) {
        const rows = snapshot.messages, last = rows.length - 1;
        const resolve = (text) => {
            const token = String(text).replaceAll('{{lastMessageId}}', String(last));
            const number = Number(token);
            return number < 0 ? rows.length + number : number;
        };
        let first = 0, end = last;
        if (typeof range === 'number')
            first = end = resolve(range);
        else {
            const match = String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/);
            if (!match)
                throw Error('BROWSER_MESSAGE_RANGE_UNSUPPORTED');
            first = resolve(match[1]);
            end = resolve(match[2] ?? match[1]);
        }
        return freeze(rows.filter((row) => row.index >= first && row.index <= end && (!options.role || options.role === 'all' || row.role === options.role))
            .map((row) => ({ message_id: row.index, name: row.role === 'user' ? snapshot.persona.name : '', role: row.role,
            is_hidden: false, message: row.message, data: variableValue(row.variables) || {},
            ...options.include_swipes && row.variants ? { swipes: row.variants.swipes, swipe_id: row.variants.swipe_id } : {} })));
    }
    const subscribe = (priority, type, fn) => {
        const reference = callback(fn);
        if (type === 'GENERATION_AFTER_COMMANDS') {
            const registration = { ...origin, callbackId: String(reference.__callback), priority, registrationOrder: registrations.length };
            registrations.push(registration);
            return () => { const index = registrations.indexOf(registration); if (index >= 0)
                registrations.splice(index, 1); };
        }
        const id = rpc({ op: 'subscribe', type, callback: reference });
        return () => rpc({ op: 'unsubscribe', id });
    };
    const listenerIds = new Map();
    const addListener = (type, fn, options) => {
        let group = listenerIds.get(type);
        if (!group) {
            group = new Map();
            listenerIds.set(type, group);
        }
        let captures = group.get(fn);
        if (!captures) {
            captures = new Map();
            group.set(fn, captures);
        }
        const capture = typeof options === 'boolean' ? options : options?.capture === true;
        captures.set(capture, rpc({ op: 'listen', type, callback: callback(fn), options }));
    };
    const removeListener = (type, fn, options) => {
        const captures = listenerIds.get(type)?.get(fn);
        const capture = typeof options === 'boolean' ? options : options?.capture === true, id = captures?.get(capture);
        if (id !== undefined) {
            rpc({ op: 'unlisten', id });
            captures.delete(capture);
        }
    };
    const doc = decode(config.document);
    const parentDocument = new Proxy(doc, {
        get(target, key) {
            if (key === 'querySelector' || key === 'querySelectorAll')
                return (selector) => {
                    const selected = personaSelection(selector);
                    return selected === undefined ? target[key](selector) : key === 'querySelector' ? selected[0] ?? null : selected;
                };
            if (key === 'getElementById')
                return (id) => id === 'user_avatar_block' ? personaRoot : target[key](id);
            return target[key];
        }, set(target, key, value) { target[key] = value; return true; },
    });
    const timeout = (fn, delay) => rpc({ op: 'timer', callback: callback(fn), delay });
    const raf = (fn) => rpc({ op: 'raf', callback: callback(fn) });
    const Observer = function (kind, fn) { return rpc({ op: 'observer', kind, callback: callback(fn) }); };
    const url = function (value, base) {
        const result = rpc({ op: 'url', url: value, base });
        Object.assign(this, result);
        this.searchParams = Object.freeze({ get: (key) => result.searchParams[key] ?? null });
    };
    Object.assign(url, { createObjectURL: (file) => rpc({ op: 'object-url', file: encode(file) }),
        revokeObjectURL: (value) => rpc({ op: 'revoke-object-url', url: value }) });
    const storage = Object.freeze({ getItem: () => null });
    const requestHeaders = () => Object.freeze({ 'Content-Type': 'application/json' });
    const tavern = Object.freeze({ getCurrentChatId: () => config.binding.sessionId,
        getContext: () => Object.freeze({ name1: snapshot.persona.name, name2: snapshot.character?.name ?? '',
            chatId: config.binding.sessionId, characterId: snapshot.character ? 0 : undefined,
            characters: freeze(snapshot.character ? [{ name: snapshot.character.name, sourceId: snapshot.character.sourceId,
                    ...snapshot.character.avatar ? { avatar: snapshot.character.avatar } : {} }] : []), chatMetadata, getRequestHeaders: requestHeaders }) });
    const globals = { document: doc, root: doc.body, Image: function () { return rpc({ op: 'image' }); }, URL: url,
        MutationObserver: function (fn) { return new Observer('mutation', fn); },
        ResizeObserver: function (fn) { return new Observer('resize', fn); },
        localStorage: storage, SillyTavern: tavern, setTimeout: timeout, clearTimeout: (id) => rpc({ op: 'clear-timer', id }),
        requestAnimationFrame: raf, cancelAnimationFrame: (id) => rpc({ op: 'cancel-raf', id }),
        Event: function (type, options) { return rpc({ op: 'event', type, options: encode(options) }); },
        CustomEvent: function (type, options) { return rpc({ op: 'event', type, options: encode(options), custom: true }); },
        structuredClone: clone, getVariables, getChatMessages, getScriptId, getScriptTrees, ...worldbookApis, ...personaApis,
        TavernHelper: freeze({ getVariables: getParentVariables, getScriptId, getScriptTrees, ...worldbookApis, ...personaApis }),
        jQuery: personaJQuery, $: personaJQuery, fetch: avatarFetch,
        eventOn: (type, fn) => subscribe('normal', type, fn),
        eventMakeFirst: (type, fn) => subscribe('first', type, fn),
        eventRemoveListener: (type, fn) => {
            const id = callbackIds.get(fn), index = registrations.findIndex(row => row.callbackId === String(id));
            if (type === 'GENERATION_AFTER_COMMANDS' && index >= 0)
                registrations.splice(index, 1);
        },
        tavern_events: freeze(Object.fromEntries(config.events.map((name) => [name,
            name === 'CHAT_CHANGED' ? 'chat_id_changed' : name === 'SETTINGS_UPDATED' ? 'settings_updated' : name]))),
        injectPrompts: (prompts, options = {}) => {
            if (!invocation || !activeCallback)
                throw Error('BROWSER_GENERATION_INVOCATION_REQUIRED');
            effects.push({ ...origin, callbackId: activeCallback, kind: 'inject', prompts: clone(prompts), once: options.once === true });
            return prompts.map(row => row.id);
        },
        uninjectPrompts: (ids) => {
            if (invocation && activeCallback)
                effects.push({ ...origin, callbackId: activeCallback, kind: 'remove', ids: clone(ids) });
            else
                cleanupRemovals.push({ ...origin, ids: clone(ids) });
        },
        generateRaw: (options) => {
            if (!gestureId)
                throw Error('BROWSER_TRUSTED_FORM_REQUIRED');
            const gesture = gestureId;
            gestureId = undefined;
            return request('generate-raw', { request: { scriptIdentity: origin.scriptIdentity, options: clone(options), gestureId: gesture } })
                .then((reply) => { generatedTask = reply.task; return reply.text; });
        },
        updateVariablesWith: (fn, option = { type: 'chat' }) => {
            if (option.type !== 'chat' || origin.originalOrdinal !== config.ownedChatWriter?.ordinal || !generatedTask)
                throw Error('BROWSER_CHAT_UPDATE_NOT_ADMITTED');
            const complete = getVariables({ type: 'chat' }) || freeze({}), next = fn(complete);
            const key = config.ownedChatKey, task = generatedTask;
            generatedTask = null;
            // The admitted updater is synchronous. A short Asyncify primitive waits
            // for the actual State commit before original author UI can say saved.
            // Long provider generation uses the separate deferred VM Promise above.
            const capture = rpc({ op: 'author-chat-update', scriptIdentity: origin.scriptIdentity,
                request: { scriptIdentity: origin.scriptIdentity, expected: snapshot.authorChat.revision,
                    value: clone(next[key]), task } });
            setSnapshot({ ...snapshot, authorChat: capture });
            return getVariables({ type: 'chat' });
        },
        NextTavern: freeze({ getNumericalState: () => snapshot.numerical,
            replaceNumericalValues: (values, expected) => request('save', { request: { requestId: ++saveSequence,
                    generation: config.binding.generation, readRevision: snapshot.readRevision,
                    scriptIdentity: origin.scriptIdentity, values: clone(values), expected: clone(expected) } }).then((reply) => {
                setSnapshot(reply.snapshot);
                return reply.result;
            }) }),
        console: freeze({ log: () => { }, info: () => { }, warn: () => { }, error: () => { }, debug: () => { } }), };
    const facade = new Proxy(instances, {
        get(target, key) {
            if (key === 'parent')
                return parentFacade;
            if (key === 'window')
                return facade;
            if (key in globals)
                return globals[key];
            if (key === 'name1')
                return snapshot.persona.name;
            if (['devicePixelRatio', 'innerWidth', 'innerHeight', 'visualViewport'].includes(key))
                return rpc({ op: 'window-read', key });
            if (key === 'performance')
                return freeze({ now: () => rpc({ op: 'performance-now' }) });
            if (key === 'getComputedStyle')
                return (node) => rpc({ op: 'computed-style', node: encode(node) });
            if (key === 'matchMedia')
                return (query) => rpc({ op: 'match-media', query });
            if (key === 'addEventListener')
                return addListener;
            if (key === 'removeEventListener')
                return removeListener;
            return target[key];
        }, set(target, key, value) { target[key] = value; return true; },
    });
    const parentFacade = new Proxy(facade, {
        get(target, key) {
            if (key === 'parent' || key === 'window')
                return parentFacade;
            if (key === 'document')
                return parentDocument;
            if (key === 'getVariables')
                return getParentVariables;
            return target[key];
        },
    });
    Object.assign(globalThis, globals, { window: facade, parent: parentFacade });
    // Each callback has one asynchronous root. Resource continuations may enter
    // the Actor while its Promise is pending; provider waits never hold Ccall.
    const deliver = (id, argsText, completionId, resource, token) => {
        const owned = callbacks.get(id);
        if (!owned)
            throw Error('BROWSER_CALLBACK_UNAVAILABLE');
        origin = owned.origin;
        const previousCallback = executionCallback;
        executionCallback = id;
        if (!resource) {
            gestureId = token;
            generatedTask = null;
        }
        let result;
        try {
            result = owned.fn(...decode(parse(argsText)));
        }
        catch {
            notify(stringify({ type: 'callback-complete', id: completionId, error: true }));
            executionCallback = previousCallback;
            return;
        }
        if (resource)
            executionCallback = previousCallback;
        Promise.resolve(result).then(() => notify(stringify({ type: 'callback-complete', id: completionId })), () => notify(stringify({ type: 'callback-complete', id: completionId, error: true })));
    };
    return {
        select: (text) => {
            const { callbackId, ...selected } = parse(text);
            origin = selected;
            if (callbackId !== undefined)
                executionCallback = callbackId;
        },
        snapshot: (text) => { setSnapshot(parse(text)); },
        registrations: () => stringify(registrations),
        deliver: (text) => { const data = parse(text); deliver(data.id, stringify(data.args), data.completionId, data.resource, data.gestureId); },
        generation: (text) => {
            const data = parse(text);
            invocation = data;
            setSnapshot(data.snapshot);
            effects.length = 0;
            const ordered = [...registrations].sort((a, b) => (a.priority === 'first' ? 0 : 1) - (b.priority === 'first' ? 0 : 1) || a.registrationOrder - b.registrationOrder);
            let completed = 0;
            const run = async () => {
                for (const row of ordered) {
                    const owned = callbacks.get(Number(row.callbackId));
                    origin = owned.origin;
                    activeCallback = row.callbackId;
                    await owned.fn();
                    completed++;
                }
                notify(stringify({ type: 'generation-complete', invocationId: data.invocationId,
                    effects, cleanupRemovals, callbacksExecuted: completed }));
            };
            void run().catch(() => notify(stringify({ type: 'generation-complete', invocationId: data.invocationId, error: true })))
                .finally(() => { invocation = null; activeCallback = null; });
        },
        destroy: () => {
            for (const value of Object.values(instances))
                if (value && typeof value.destroy === 'function')
                    withOrigin(origin, () => value.destroy());
            callbacks.clear();
            refs.clear();
            sourceResources.clear();
            personaNodes.clear();
            registrations.length = 0;
        },
    };
}
