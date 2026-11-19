// Generated from runtime/alpha3/src/ui/author-native-helper-frame.ts; edit the TypeScript source.
import { AUTHOR_NATIVE_MVU_HOOK_EVENTS } from '../core/author-native-mvu-hook-types.js';
import { READER_NATIVE_RESOURCE_CSP } from '../core/reader-native-parent-realm.js';
import { createReaderDocumentLayoutRealm } from '../core/tavern-author-reader-document-layout.js';
import { createAuthorNativeMvuApi } from './author-native-mvu-sdk.js';
import { createAuthorNativeMvuTrialEvents } from './author-native-mvu-trial.js';
import { createAuthorNativeEventOwner } from './author-native-events.js';
import { createAuthorNativeScriptButtonCatalog } from './author-native-script-buttons.js';
import { createAuthorNativeMvuHookGraph } from '../core/author-native-mvu-hook-graph.js';
import { createAuthorNativeMessageVariables } from '../core/author-native-message-variables.js';
import { createAuthorNativeCurrentRegex, createAuthorNativeFormatterV1 } from '../core/author-native-current-regex.js';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 } from '../core/tavern-prompt-transform-types.mjs';
import { communityDefaultPresetDataV1 } from '../core/community-preset-types.js';
import { createAuthorNativeVariableWriters } from '../core/author-native-variable-writers.js';
import { createAuthorNativeGenerationApi } from '../core/author-native-generation-api.js';
import { createAuthorNativeCommandLanguageV1 } from '../core/author-native-commands.js';
/** Serialized into the child before unmodified Source scripts. All asynchronous
 * code in this window shares one principal; script locations are DATA only. */
export function authorNativeHelperBootstrap(initial, initialReadScope, channel, realmId, resource, scripts, libraries, createLayout, layoutConfig, importModule, createMvu, createEvents, createButtons, buttonScripts, createMessageVariables, createCurrentRegex, createVariableWriters, routeEvents = false, createHookGraph, initialPresetLibrary, defaultPreset, createFormatter, formatterLimits, initialCharacterLibrary, createGeneration, createCommands, createTrialEvents, hookEvents = AUTHOR_NATIVE_MVU_HOOK_EVENTS) {
    parent.dispatchEvent(new CustomEvent('nexttavern-author-realm-ready', { detail: window.frameElement }));
    const realm = window, clone = (value) => value === undefined ? undefined : structuredClone(value);
    let snapshot = initial, scope = initialReadScope, explicitScope = initialReadScope, active = true, sequence = 0, sourceLoaded = false;
    let presetLibrary = initialPresetLibrary, pendingLoadedName, presetBarrier = Promise.resolve();
    let characterLibrary = initialCharacterLibrary;
    const libraryReads = new Map();
    const recordLibraryRead = (read) => libraryReads.set(JSON.stringify(read), read);
    const presetRead = (selector, operation) => {
        if (presetLibrary)
            recordLibraryRead({ kind: 'preset', revision: presetLibrary.revision, selector, operation });
    };
    const characterRead = (selector, operation) => {
        if (characterLibrary)
            recordLibraryRead({ kind: 'character', epoch: characterLibrary.epoch, selector, operation });
    };
    let messageSnapshot = snapshot, messageVariables = createMessageVariables(snapshot);
    const messageData = () => {
        if (messageSnapshot !== snapshot) {
            messageSnapshot = snapshot;
            messageVariables = createMessageVariables(snapshot);
        }
        return messageVariables;
    };
    let avatarStyle, userAvatar, charAvatar;
    const updateAvatarStyles = () => {
        const paths = snapshot.avatarPaths;
        if (paths?.user === userAvatar && paths?.character === charAvatar)
            return;
        userAvatar = paths?.user;
        charAvatar = paths?.character;
        avatarStyle ??= document.head.appendChild(document.createElement('style'));
        const background = (uri) => uri ? 'url(' + JSON.stringify(uri) + ')' : 'none';
        avatarStyle.textContent = paths ? '.user_avatar,.user-avatar{background-image:' + background(userAvatar) + '}'
            + '.char_avatar,.char-avatar{background-image:' + background(charAvatar) + '}' : '';
    };
    updateAvatarStyles();
    let port;
    const sourceUrls = [];
    let layout, layoutRevision = 0;
    const layoutWrites = new Map();
    const frame = window.frameElement;
    let ownHeight = frame.style.height;
    const height = async (value) => {
        const id = ++sequence;
        ownHeight = `${Math.ceil(value)}px`;
        frame.style.height = ownHeight;
        await new Promise((resolve, reject) => {
            layoutWrites.set(id, { resolve, reject });
            send({ op: 'layout-height', id, revision: layoutRevision, height: value });
        });
    };
    const frameChanges = new MutationObserver(records => {
        if (records.some(record => record.attributeName === 'height') || frame.style.height !== ownHeight) {
            // An explicit author frame size pauses automatic sizing until an
            // explicit Auto/Fit retry, following the shared Reader layout policy.
            layout?.pause();
            void height(frame.getBoundingClientRect().height).catch(error => { if (active)
                report(error); });
        }
    });
    frameChanges.observe(frame, { attributes: true, attributeFilter: ['style', 'height'] });
    const queued = [], pending = new Map();
    const reads = new WeakMap();
    // A committed value can survive loss of the parent's current read scope.
    // Track the snapshot actually adopted with that reply, rather than its value's optional snapshot.
    const repliesWithSnapshot = new WeakSet();
    let invocation;
    let mutableHook;
    const send = (message) => { if (port)
        port.postMessage(message);
    else
        queued.push(message); };
    const dispatchRequest = (operation, payload, readScope, operationId) => new Promise((resolve, reject) => {
        if (!active) {
            reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'));
            return;
        }
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        try {
            send({ op: 'request', id, request: { operationId, operation, payload, readScope } });
        }
        catch (error) {
            pending.delete(id);
            reject(error);
        }
    });
    const request = (operation, payload, readScope = scope, operationId = crypto.randomUUID()) => presetBarrier.then(() => dispatchRequest(operation, payload, readScope, operationId));
    const filters = new Map();
    const retireFilters = (ids) => { for (const id of ids)
        filters.delete(id); };
    const mutatePrompts = (mutation) => {
        const operationId = crypto.randomUUID();
        const work = request('mutate-prompts', { resource, mutation, libraryReads: [...libraryReads.values()] }, scope, operationId)
            .then(reply => retireFilters(reply?.retiredFilterCallbackIds ?? []));
        void work.catch(report);
        return operationId;
    };
    const available = (value) => value?.kind === 'available' ? value.variables : {};
    const sharedCapture = (options) => {
        const type = options.type ?? 'chat', scopes = snapshot.sharedScopes, extensions = scopes?.extensions, capture = type === 'extension'
            ? extensions && Object.hasOwn(extensions, options.extension_id) ? extensions[options.extension_id] : undefined
            : scopes?.[type];
        if (!capture)
            throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
        return capture;
    };
    const variables = (options = { type: 'chat' }) => {
        const type = options.type ?? 'chat';
        if (type === 'chat') {
            const base = available(snapshot.scopeFrame.scopes.chat), retained = snapshot.ordinaryChat.replaceOrdinary
                ? Object.hasOwn(base, 'stat_data') ? { stat_data: base.stat_data } : {} : base;
            const result = { ...clone(retained), ...clone(snapshot.ordinaryChat.values) };
            for (const key of snapshot.ordinaryChat.deletedKeys ?? [])
                delete result[key];
            return result;
        }
        if (type === 'global')
            return clone(snapshot.preparedSharedScopes?.global?.values ?? sharedCapture(options).values);
        if (type === 'character' || type === 'preset' || type === 'extension')
            return clone(sharedCapture(options).values);
        if (type === 'script') {
            const address = selfScript();
            if (address.variables === undefined)
                throw Error('AUTHOR_NATIVE_SCRIPT_VARIABLES_UNAVAILABLE');
            return clone(address.variables);
        }
        if (type === 'message') {
            return clone(messageData().resolve(options).values);
        }
        throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
    };
    const messageObjects = (rows) => [rows, ...rows.flatMap(row => [row, row.data, row.extra, row.swipes, row.swipes_data, row.swipes_info,
            ...(row.swipes_data ?? []), ...(row.swipes_info ?? [])])];
    const getChatMessages = (range = '0-{{lastMessageId}}', options = {}) => {
        const rows = snapshot.messages, last = rows.length - 1;
        const position = (id) => {
            const n = Number(id.replaceAll('{{lastMessageId}}', String(last)));
            return n < 0 ? rows.length + n : n;
        };
        const match = String(range).match(/^(-?\d+|\{\{lastMessageId\}\})(?:-(-?\d+|\{\{lastMessageId\}\}))?$/);
        const start = match ? position(match[1]) : 0, end = match ? position(match[2] ?? match[1]) : -1;
        const result = rows.filter(row => !!match && row.index >= Math.min(start, end) && row.index <= Math.max(start, end)
            && (options.hide_state === 'hidden' ? row.is_hidden === true : options.hide_state === 'unhidden' ? row.is_hidden !== true : true)
            && (!options.role || options.role === 'all' || row.role === options.role))
            .map(row => clone(messageData().chatMessage(row, options.include_swipes === true)));
        explicitScope = scope;
        for (const object of messageObjects(result))
            if (object && typeof object === 'object')
                reads.set(object, scope);
        return result;
    };
    const setChatMessages = (rows, options = {}) => {
        const scopes = new Set(messageObjects(rows).map(object => object && typeof object === 'object' ? reads.get(object) : undefined)
            .filter(value => value !== undefined));
        if (scopes.size > 1)
            throw Error('AUTHOR_NATIVE_MIXED_READ_BASIS');
        return request('set-chat-messages', { rows, refresh: options.refresh ?? 'affected' }, scopes.values().next().value ?? explicitScope).then(result => {
            if (result.kind === 'refused' || result.kind === 'unknown')
                throw Error(result.code);
            return result;
        });
    };
    const variableWriters = createVariableWriters((options) => {
        const type = options.type ?? 'chat', readScope = scope;
        if (!['chat', 'message', 'script', 'global', 'character', 'preset', 'extension'].includes(type))
            throw Error('AUTHOR_NATIVE_VARIABLE_SCOPE_UNAVAILABLE');
        const selector = type === 'message' ? { type: 'message', message_id: options.message_id ?? 'latest' }
            : type === 'script' ? { type: 'script' } : type === 'extension' ? { type: 'extension', extension_id: options.extension_id }
                : type === 'chat' ? undefined : { type };
        const current = type === 'message' ? clone(messageData().resolve({ type: 'message', message_id: options.message_id ?? 'latest' }, true).values)
            : ['global', 'character', 'preset', 'extension'].includes(type) ? clone(sharedCapture(options).values) : variables(options);
        const replaceNumerical = type === 'chat' ? captureChatVariableReplacement() : undefined;
        return { variables: current, commit: (nextVariables) => replaceNumerical?.(nextVariables)
                || request('mutate-author-namespace', { nextVariables, ...selector ? { selector } : {} }, readScope) };
    }, () => realm._);
    function report(error) {
        const code = error instanceof Error ? error.message : String(error);
        mutableHook?.diagnostics.push({ code, realmId, callbackId: mutableHook.callbackId });
        send({ op: 'diagnostic', code });
    }
    const events = createEvents({
        create: (event, once) => ({ callbackId: crypto.randomUUID(), realmId, resource, event, once, makeFirst: false, order: 0 }),
        positioned: (previous, position) => {
            const registration = { ...previous, makeFirst: position === 'first', order: ++sequence };
            void request('generation-listener-add', { registration }).catch(report);
            return registration;
        },
        removed: registration => { if (active)
            void request('generation-listener-remove', { callbackId: registration.callbackId }).catch(report); },
        beforeInvoke: registration => {
            if (invocation)
                invocation.callbackId = registration.callbackId;
            if (mutableHook)
                mutableHook.callbackId = registration.callbackId;
        }, report,
    });
    const trialEvents = createTrialEvents?.(createHookGraph, events.registrations, events.request, hookEvents);
    const emit = async (event, args, callbackIds) => {
        const invoked = await events.emit(event, args, callbackIds ? registration => callbackIds.includes(registration.callbackId) : undefined);
        return invoked.map(registration => registration.callbackId);
    };
    const books = () => snapshot.worldbook;
    const generation = createGeneration({ realmId, current: () => active,
        request: (operation, payload, operationId) => ['stop-author-generation', 'stop-all-author-generations', 'generation-release',
            'author-generation-next', 'invoke-author-generation-filter', 'author-generation-filter-result'].includes(operation)
            ? dispatchRequest(operation, payload, scope, operationId) : request(operation, payload, scope, operationId), filters,
        emit: (event, args) => routeEvents ? request('emit-event', { event, args }) : emit(event, args) });
    let bookReadScope = scope;
    const loadedBooks = new Map();
    const staleBookSnapshots = new Set();
    const syncBookScope = () => {
        if (bookReadScope !== scope) {
            bookReadScope = scope;
            loadedBooks.clear();
            staleBookSnapshots.clear();
        }
    };
    const invalidateBook = (name) => {
        syncBookScope();
        loadedBooks.delete(name);
        staleBookSnapshots.add(name);
    };
    const book = async (name) => {
        await presetBarrier;
        syncBookScope();
        const data = books(), stale = staleBookSnapshots.has(name);
        if (!stale && !data?.names.includes(name))
            throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE');
        const frozen = stale ? undefined : loadedBooks.get(name) ?? data?.books.find((value) => value.name === name);
        if (frozen?.entries)
            return frozen;
        const originalScope = scope, value = await request('worldbook-read', { name, expectedDataSha256: data.dataSha256 }, originalScope);
        if (scope !== originalScope)
            throw Error('AUTHOR_NATIVE_READ_BASIS_CHANGED');
        loadedBooks.set(name, value);
        staleBookSnapshots.delete(name);
        return value;
    };
    const bookBasis = (value) => ({ dataSha256: books()?.dataSha256, readScope: scope,
        target: { bookId: value.address.bookId, contentRef: value.content, metadataRef: value.metadata } });
    const dataReads = new WeakMap();
    const capturedBook = async (name) => {
        await presetBarrier;
        const originalScope = scope, value = await book(name);
        if (scope !== originalScope)
            throw Error('AUTHOR_NATIVE_READ_BASIS_CHANGED');
        return { value, basis: bookBasis(value) };
    };
    const readBook = async (name) => {
        const { value, basis } = await capturedBook(name), entries = clone(value.entries);
        dataReads.set(entries, basis);
        for (const entry of entries)
            dataReads.set(entry, basis);
        return entries;
    };
    const mutateBook = async (name, mutation, basis) => {
        const reply = await request('worldbook-mutate', {
            name, mutation, expectedDataSha256: basis.dataSha256, target: basis.target
        }, basis.readScope);
        if (reply.result.kind === 'refused')
            throw Error(reply.result.diagnostics[0]?.code ?? 'AUTHOR_WORLDBOOK_MUTATION_REFUSED');
        if (reply.readError || !reply.worldbookReadCurrent && !repliesWithSnapshot.has(reply))
            invalidateBook(name);
        if (reply.readError)
            throw Error(reply.readError.code, { cause: { result: reply.result, readError: reply.readError } });
        let currentBasis = null;
        if (reply.worldbookReadCurrent && reply.target && reply.worldbook) {
            syncBookScope();
            staleBookSnapshots.delete(name);
            const actual = { name, address: { bookId: reply.target.bookId }, content: reply.target.contentRef,
                metadata: reply.target.metadataRef, entries: reply.worldbook };
            loadedBooks.set(name, actual);
            currentBasis = bookBasis(actual);
        }
        // Operation outcomes describe the accepted event. A later shared-book
        // version can be a current read while those historical rows stay stale.
        const event = reply.result.receipt?.event, content = reply.target?.contentRef;
        const outcomeBasis = currentBasis && event?.key === content?.key && event?.sha256 === content?.sha256 ? currentBasis : null;
        for (const [rows, read] of [[reply.worldbook, currentBasis], [reply.new_entries, outcomeBasis],
            [reply.deleted_entries, outcomeBasis]])
            if (rows) {
                dataReads.set(rows, read);
                for (const entry of rows)
                    dataReads.set(entry, read);
            }
        return reply;
    };
    const retainedBookBasis = (entries) => {
        const captured = dataReads.get(entries);
        if (captured === null)
            throw Error('AUTHOR_NATIVE_READ_BASIS_CHANGED');
        if (captured)
            return captured;
        let basis;
        for (const entry of entries) {
            const read = entry && typeof entry === 'object' ? dataReads.get(entry) : undefined;
            if (read === null)
                throw Error('AUTHOR_NATIVE_READ_BASIS_CHANGED');
            if (!read)
                continue;
            if (basis && (read.dataSha256 !== basis.dataSha256 || read.readScope !== basis.readScope
                || read.target.bookId !== basis.target.bookId))
                throw Error('AUTHOR_NATIVE_MIXED_READ_BASIS');
            basis = read;
        }
        return basis;
    };
    const manageBooks = async (mutation, basis) => {
        await presetBarrier;
        const captured = basis ?? { dataSha256: books()?.dataSha256, readScope: scope };
        const reply = await request('worldbook-manage', { mutation, expectedDataSha256: captured.dataSha256 }, captured.readScope);
        if (reply.result.kind === 'refused')
            throw Error(reply.result.diagnostics[0]?.code ?? 'AUTHOR_WORLDBOOK_MUTATION_REFUSED');
        if (reply.readError || !repliesWithSnapshot.has(reply))
            invalidateBook(mutation.name);
        if (reply.readError)
            throw Error(reply.readError.code, { cause: { result: reply.result, readError: reply.readError } });
        return reply;
    };
    const currentCharacter = (selector) => {
        if (selector !== 'current')
            throw Error('AUTHOR_NATIVE_CURRENT_CHARACTER_REQUIRED');
    };
    const currentChat = (selector) => {
        if (selector !== 'current')
            throw Error('AUTHOR_NATIVE_CURRENT_CHAT_REQUIRED');
    };
    const bindBooks = async (kind, names) => {
        await presetBarrier;
        const data = books(), binding = data?.bindings.find((value) => value.owner.kind === kind);
        if (!binding)
            throw Error('AUTHOR_NATIVE_WORLDBOOK_BINDING_UNAVAILABLE');
        const catalog = new Map(data.catalog.books.map((value) => [value.name, value.address.bookId])), id = (name) => {
            const bookId = catalog.get(name);
            if (bookId === undefined)
                throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE');
            return bookId;
        };
        let selection;
        if (kind === 'profile')
            selection = { kind, enabled: names.map(id) };
        else if (kind === 'character')
            selection = { kind, primary: names.primary === null ? null : id(names.primary),
                additional: names.additional.map(id) };
        else
            selection = { kind, bookId: id(names) };
        await manageBooks({ kind: 'bind-books', target: { owner: binding.owner, head: binding.head }, selection });
    };
    const personas = () => snapshot.personas;
    const personaReads = new WeakMap();
    const personaId = (id = 'current') => id === 'current' ? personas()?.selectedId : id;
    const selfScript = () => {
        const address = snapshot.context?.script;
        if (!address || typeof address.identity !== 'string')
            throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
        return address;
    };
    const buttonCatalog = createButtons(buttonScripts);
    let buttonBasis = initial.scriptButtons;
    let pendingButtonWrites = 0, lastButtonOperationId;
    const acceptButtons = (value) => {
        if (value)
            buttonBasis = value;
        if (!pendingButtonWrites && buttonBasis)
            buttonCatalog.acceptSnapshot(buttonBasis);
    };
    acceptButtons();
    const replaceButtons = (buttons) => {
        if (!active)
            return;
        const before = buttonCatalog.getScriptButtons(selfScript().id);
        if (before.length === buttons.length && before.every((button, index) => button.name === buttons[index].name
            && button.visible === buttons[index].visible))
            return;
        const basis = buttonBasis;
        if (!basis)
            throw Error('AUTHOR_SCRIPT_BUTTON_WRITE_UNAVAILABLE');
        const next = buttons.map(button => ({ name: button.name, visible: button.visible })), operationId = crypto.randomUUID(), previousOperationId = lastButtonOperationId;
        buttonCatalog.replaceScriptButtons(selfScript().id, next);
        pendingButtonWrites++;
        lastButtonOperationId = operationId;
        void request('replace-script-buttons', { buttons: next, expectedSourceSha256: basis.sourceSha256,
            expectedRevision: basis.revision, previousOperationId }, scope, operationId).then(result => {
            if (result.kind !== 'edited-data')
                throw Error(result.diagnostics?.[0]?.code ?? 'AUTHOR_SCRIPT_BUTTON_SAVE_FAILED');
        }).catch(report).finally(() => { pendingButtonWrites--; acceptButtons(); });
    };
    const updateButtons = (updater) => {
        const result = updater(buttonCatalog.getScriptButtons(selfScript().id));
        if (result && typeof result.then === 'function')
            return result.then((buttons) => { replaceButtons(buttons); return buttons; });
        replaceButtons(result);
        return result;
    };
    const currentPreset = () => {
        const value = snapshot.readonlyPreset;
        if (value?.kind !== 'available')
            throw Error('AUTHOR_NATIVE_CURRENT_PRESET_UNAVAILABLE');
        return value;
    };
    const library = () => {
        if (!presetLibrary)
            throw Error('AUTHOR_NATIVE_PRESET_LIBRARY_UNAVAILABLE');
        return presetLibrary;
    };
    const savedPreset = (name) => library().presets.find(row => row.name === name);
    const presetTarget = (name) => {
        if (name === 'in_use')
            return { kind: 'in-use', conversationId: library().conversationId };
        const saved = savedPreset(name);
        if (!saved)
            throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED');
        return { kind: 'saved', presetId: saved.presetId };
    };
    const readPreset = (name, operation = 'value') => {
        presetRead(name === 'in_use' && pendingLoadedName ? pendingLoadedName : name, operation);
        if (presetLibrary) {
            let value;
            if (name === 'in_use')
                value = pendingLoadedName ? savedPreset(pendingLoadedName)?.data : library().current.data;
            else
                value = savedPreset(name)?.data;
            if (!value)
                throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED');
            return clone(value);
        }
        const value = currentPreset();
        if (name !== 'in_use' && name !== value.loadedName)
            throw Error('AUTHOR_NATIVE_PRESET_SELECTOR_UNSUPPORTED');
        return clone(value.preset);
    };
    const submitPreset = (payload, operationId) => dispatchRequest('preset-manage', payload, scope, operationId).then(result => {
        if (result?.kind === 'refused')
            throw Error(result.code);
        return result;
    });
    const managePreset = (command, expectedRevision) => {
        const payload = clone({ command, expectedRevision }), operationId = crypto.randomUUID();
        const work = presetBarrier.then(() => submitPreset(payload, operationId));
        presetBarrier = work.then(() => { });
        void presetBarrier.catch(() => { });
        return work;
    };
    const presetCommand = async (build) => {
        await presetBarrier;
        const revision = library().revision;
        return managePreset(build(), revision);
    };
    const replacePreset = async (name, data) => {
        await presetBarrier;
        const target = presetTarget(name), revision = library().revision;
        return managePreset({ kind: 'replace', target, data }, revision);
    };
    const updatePreset = async (name, updater) => {
        await presetBarrier;
        const target = presetTarget(name), revision = library().revision, value = readPreset(name);
        const next = await updater(value);
        const result = await managePreset({ kind: 'replace', target, data: next }, revision);
        return clone(result.data);
    };
    const presetRegexes = (options) => {
        if (options.type === 'global') {
            presetRead('', 'global-regex');
            return clone(library().globalRegexes);
        }
        if (options.type === 'preset')
            return clone(readPreset(options.name ?? 'in_use', 'regex').extensions.regex_scripts ?? []);
        throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED');
    };
    const fillRegexNames = (rules) => {
        for (const rule of rules)
            if (rule.script_name === '')
                rule.script_name = '未命名-' + rule.id;
        return rules;
    };
    const regexCommand = (rules, options) => {
        fillRegexNames(rules);
        if (options.type === 'global')
            return { kind: 'replace-global-regexes', rules };
        if (options.type === 'preset')
            return { kind: 'replace-preset-regexes', target: presetTarget(options.name ?? 'in_use'), rules };
        throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED');
    };
    const namedCharacter = (name) => {
        if (!characterLibrary)
            throw Error('AUTHOR_NATIVE_CHARACTER_LIBRARY_UNAVAILABLE');
        const key = name.toLowerCase(), entry = characterLibrary.entries.find(row => row.descriptor.name.toLowerCase() === key || row.descriptor.avatar?.toLowerCase() === key);
        if (!entry)
            throw Error('AUTHOR_NATIVE_CHARACTER_SELECTOR_UNSUPPORTED');
        return entry;
    };
    const currentRegexes = createCurrentRegex(() => ({ ...snapshot, characterLibrary,
        ...presetLibrary ? { tavernRegexes: { ...snapshot.tavernRegexes, global: library().globalRegexes } } : {} }));
    const readRegexes = (options = {}) => {
        if (options.type === 'character' && options.name !== undefined && options.name !== 'current')
            characterRead(options.name, 'regex');
        if (presetLibrary && options.type === 'preset')
            return presetRegexes(options);
        if (options.type === 'global' || options.type === undefined && (options.scope ?? 'all') !== 'character')
            presetRead('', 'global-regex');
        return currentRegexes(options);
    };
    const characterRegexBasis = (options) => {
        const name = options.name ?? 'current';
        if (name === 'current') {
            const current = snapshot.tavernRegexes?.character, metadata = current?.metadata;
            if (!current || !metadata)
                throw Error('AUTHOR_NATIVE_CHARACTER_METADATA_UNAVAILABLE');
            return { target: metadata.registration, ownerSessionId: metadata.registration.locator.ownerSessionId,
                identitySha256: metadata.identitySha256, expectedSourceSha256: metadata.sourceSha256,
                expectedRevision: metadata.revision, rules: clone(current.rules) };
        }
        characterRead(name, 'regex');
        const entry = namedCharacter(name);
        return { epoch: characterLibrary.epoch, target: entry.registration, ownerSessionId: entry.registration.locator.ownerSessionId,
            identitySha256: entry.regex.identitySha256,
            expectedSourceSha256: entry.regex.sourceSha256, expectedRevision: entry.regex.revision, rules: clone(entry.regex.rules) };
    };
    const acceptCharacterWrite = (value) => {
        if (value?.kind === 'refused')
            throw Error(value.diagnostics?.[0]?.code ?? value.code ?? 'AUTHOR_NATIVE_CHARACTER_WRITE_REFUSED');
        return value;
    };
    const replaceCharacterRegexes = (basis, rules) => request('character-regex-replace', { ...basis, rules: fillRegexNames(clone(rules)) }).then(acceptCharacterWrite);
    let formatter;
    const format = (...args) => {
        if (!active)
            throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
        if (!formatter) {
            const kernel = realm.__nextTavernPromptTextKernelV1;
            if (!kernel || !createFormatter || !formatterLimits)
                throw Error('AUTHOR_NATIVE_FORMATTER_UNAVAILABLE');
            formatter = createFormatter(context => {
                const captured = snapshot.formatter;
                if (!captured)
                    return {};
                const row = context?.depth === null || context?.depth === undefined
                    ? snapshot.messages.findLast(message => message.variables.kind === 'available' || messageData().forMessage(message).capture?.exists)
                    : snapshot.messages[snapshot.messages.length - context.depth - 1];
                const data = messageData().forMessage(row), message = row ? { scope: 'message', ownerId: row.ownerSessionId + ':' + row.messageId,
                    versionSha256: kernel.recordSha256({ messageVersionSha256: row.messageVersionSha256, ordinaryRoot: data.capture?.root ?? null }),
                    values: data.values, valuesSha256: kernel.recordSha256(data.values) } : null;
                return { formatter: { ...captured, macros: { ...captured.macros,
                            variableScopes: { ...captured.macros.variableScopes, message,
                                ...snapshot.preparedSharedScopes?.global ? { global: snapshot.preparedSharedScopes.global } : {} } } } };
            }, kernel, formatterLimits, (type, key) => {
                const values = variables({ type });
                const value = values[key];
                return { value: value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value) };
            });
        }
        return formatter(...args);
    };
    const setChatMessage = (fields, messageId, options = {}) => {
        const update = messageData().legacySetChatMessage(fields, messageId, options, (text, index) => (realm.__nextTavernPromptTextKernelV1?.hasMacroSyntax(text) ?? text.includes('{{'))
            ? format(text, snapshot.messages[index]?.role === 'user' ? 'user_input' : 'ai_output', 'prompt', { depth: snapshot.messages.length - index - 1, macrosOnly: true }) : text);
        for (const row of update.rows)
            reads.set(row, scope);
        return setChatMessages(update.rows, { refresh: update.refresh });
    };
    const getContext = () => {
        const captured = scope;
        const draft = messageData().contextChatDraft(rows => {
            for (const row of rows)
                reads.set(row, captured);
            return setChatMessages(rows);
        });
        return { ...clone(snapshot.context), ...draft, setChatMessage };
    };
    const api = { getVariables: variables, getAllVariables: () => Object.assign({}, variables({ type: 'global' }), variables({ type: 'character' }), variables({ type: 'script' }), variables()), getChatMessages, setChatMessages, setChatMessage,
        getContext,
        getPresetNames: () => { presetRead('', 'names'); return clone(library().names); },
        getLoadedPresetName: () => {
            presetRead(pendingLoadedName ?? 'in_use', 'loaded');
            return pendingLoadedName ?? (presetLibrary ? library().loaded?.name ?? '' : currentPreset().loadedName);
        },
        getPreset: readPreset, default_preset: clone(defaultPreset),
        isPresetSystemPrompt: (prompt) => ['main', 'nsfw', 'jailbreak', 'enhanceDefinitions'].includes(prompt.id),
        isPresetPlaceholderPrompt: (prompt) => ['worldInfoBefore', 'personaDescription', 'charDescription', 'charPersonality',
            'scenario', 'worldInfoAfter', 'dialogueExamples', 'chatHistory'].includes(prompt.id),
        isPresetNormalPrompt: (prompt) => !api.isPresetSystemPrompt(prompt) && !api.isPresetPlaceholderPrompt(prompt),
        loadPreset: (name) => {
            if (name === 'in_use')
                return false;
            const saved = savedPreset(name);
            if (!saved)
                return false;
            pendingLoadedName = name;
            const previous = presetBarrier, operationId = crypto.randomUUID();
            const work = previous.then(() => submitPreset({
                command: { kind: 'load', presetId: saved.presetId, name }, expectedRevision: library().revision
            }, operationId));
            presetBarrier = work.then(() => { if (pendingLoadedName === name)
                pendingLoadedName = undefined; }, error => {
                pendingLoadedName = undefined;
                throw error;
            });
            void presetBarrier.catch(report);
            return true;
        },
        createPreset: async (name, data) => (await presetCommand(() => ({ kind: 'create', name, data }))).value,
        createOrReplacePreset: async (name, data) => (await presetCommand(() => ({ kind: 'create-or-replace', name, data }))).value,
        deletePreset: async (name) => (await presetCommand(() => ({ kind: 'delete', name, presetId: savedPreset(name)?.presetId ?? null }))).value,
        renamePreset: async (name, newName) => (await presetCommand(() => ({ kind: 'rename', name, newName,
            presetId: savedPreset(name)?.presetId ?? null }))).value,
        replacePreset: async (name, data) => { await replacePreset(name, data); },
        updatePresetWith: updatePreset,
        setPreset: (name, data) => updatePreset(name, (current) => ({
            prompts: data.prompts ?? current.prompts, prompts_unused: data.prompts_unused ?? current.prompts_unused,
            settings: realm._.defaultsDeep({}, clone(data.settings ?? {}), current.settings),
            extensions: realm._.defaultsDeep({}, clone(data.extensions ?? {}), current.extensions)
        })),
        getTavernRegexes: readRegexes,
        replaceTavernRegexes: async (rules, options) => {
            if (options.type === 'character')
                await replaceCharacterRegexes(characterRegexBasis(options), rules);
            else
                await presetCommand(() => regexCommand(rules, options));
        },
        updateTavernRegexesWith: async (updater, options) => {
            await presetBarrier;
            if (options.type === 'character') {
                const basis = characterRegexBasis(options), next = await updater(clone(basis.rules));
                await replaceCharacterRegexes(basis, next);
                return next;
            }
            const revision = library().revision, command = regexCommand([], options), next = await updater(presetRegexes(options));
            await managePreset({ ...command, rules: fillRegexNames(next) }, revision);
            return next;
        },
        formatAsTavernRegexedString: format,
        getLastMessageId: () => snapshot.messages.length - 1,
        ...Object.fromEntries(Object.entries(variableWriters).map(([name, write]) => [name, async (...args) => {
                await presetBarrier;
                return write(...args);
            }])),
        eventOn: events.on, eventOnce: events.once, eventMakeFirst: events.makeFirst, eventMakeLast: events.makeLast,
        eventRemoveListener: events.remove, eventClearEvent: events.clearEvent, eventClearListener: events.clearListener,
        eventClearAll: events.clearAll, eventEmit: async (event, ...args) => {
            if (!active)
                return;
            if (!routeEvents) {
                await emit(event, args);
                return;
            }
            await request('emit-event', { event, args });
        },
        eventEmitAndWait: (event, ...args) => {
            events.emitAndWait(event, args);
            if (!active || !routeEvents)
                return;
            void request('emit-event', { event, args, excludeSelf: true }).catch(report);
        }, errorCatched: (fn) => (...args) => fn(...args),
        generate: generation.generate, generateRaw: generation.generateRaw,
        placeholder_prompt_default_order: generation.placeholder_prompt_default_order,
        builtin_prompt_default_order: generation.builtin_prompt_default_order,
        stopGenerationById: generation.stopGenerationById, stopAllGeneration: generation.stopAllGeneration,
        triggerSlash: async (command) => {
            if (createCommands) {
                const language = createCommands(), operationId = crypto.randomUUID(), pipeline = language.parse(command), result = await language.execute(pipeline, operationId, {
                    assertCurrent() { if (!active)
                        throw Error('AUTHOR_NATIVE_BINDING_REVOKED'); },
                    release: async () => { await request('command-release', {}, scope, operationId); },
                    readVariable: (type, key) => variables({ type })[key],
                    async writeVariable(type, key, value, stepId) {
                        const current = type === 'global' ? clone(sharedCapture({ type }).values) : variables({ type });
                        await request('mutate-author-namespace', { nextVariables: { ...current, [key]: value },
                            ...type === 'global' ? { selector: { type } } : {} }, scope, stepId);
                    },
                    input: (text, defaultValue, stepId) => request('command-input', { text, defaultValue }, scope, stepId),
                    echo: async (text, stepId) => { await request('command-echo', { text }, scope, stepId); },
                    remote: (step, original, pipe) => request('execute-commands', { command: '', step, pipe }, scope, original),
                });
                if (result.kind !== 'executed')
                    throw Object.assign(Error(result.code), { result });
                return result.pipe;
            }
            const result = await request('execute-commands', { command });
            if (result.kind !== 'executed')
                throw Object.assign(Error(result.code), { result });
            return result.pipe;
        },
        getResource: (address) => request('resource-read', { resource: address }),
        getScriptId: () => selfScript().id,
        getButtonEvent: (name) => buttonCatalog.getButtonEvent(selfScript().id, name),
        getScriptButtons: () => buttonCatalog.getScriptButtons(selfScript().id),
        replaceScriptButtons: replaceButtons,
        updateScriptButtonsWith: updateButtons,
        appendInexistentScriptButtons: (buttons) => {
            updateButtons((existing) => [...existing,
                ...buttons.filter(button => !existing.some(row => row.name === button.name))]);
        },
        getAllEnabledScriptButtons: buttonCatalog.getAllEnabledScriptButtons,
        getScriptData: (identity) => {
            const address = identity === undefined ? selfScript() : undefined;
            const script = address && { identity: address.identity, descriptorSha256: address.descriptorSha256,
                sourceSnapshotSha256: address.sourceSnapshotSha256, originalOrdinal: address.originalOrdinal };
            return request('resource-read', { resource: address ? { kind: 'self-script-data', script } : { kind: 'script-data', identity } });
        },
        getWorldbookNames: () => clone(books()?.names ?? []),
        getGlobalWorldbookNames: () => clone(books()?.globalNames ?? []),
        getCharWorldbookNames: (selector = 'current') => {
            if (selector !== undefined && selector !== 'current') {
                characterRead(selector, 'bindings');
                const selection = namedCharacter(selector).binding.selection;
                if (selection.kind !== 'character')
                    throw Error('AUTHOR_NATIVE_CHARACTER_BINDING_UNAVAILABLE');
                const name = (id) => id === null ? null : characterLibrary.catalog.names.find(book => book.bookId === id)?.name ?? null;
                return { primary: name(selection.primary), additional: selection.additional.flatMap(id => {
                        const value = name(id);
                        return value === null ? [] : [value];
                    }) };
            }
            currentCharacter(selector);
            return clone(books()?.characterNames ?? { primary: null, additional: [] });
        },
        getChatWorldbookName: (selector) => { currentChat(selector); return books()?.chatName ?? null; },
        rebindGlobalWorldbooks: async (names) => bindBooks('profile', names),
        rebindCharWorldbooks: async (selector, names) => {
            if (selector !== undefined && selector !== 'current') {
                characterRead(selector, 'bindings');
                const entry = namedCharacter(selector), epoch = characterLibrary.epoch, bookId = (name) => {
                    const book = characterLibrary.catalog.names.find(book => book.name === name);
                    if (!book)
                        throw Error('AUTHOR_NATIVE_WORLDBOOK_UNAVAILABLE');
                    return book.bookId;
                }, selection = { kind: 'character', primary: names.primary === null ? null : bookId(names.primary), additional: names.additional.map(bookId) };
                await request('named-character-worldbook-bind', { epoch, target: entry.registration,
                    ownerSessionId: entry.registration.locator.ownerSessionId, expectedHead: entry.binding.head, selection })
                    .then(acceptCharacterWrite);
                return;
            }
            currentCharacter(selector);
            await bindBooks('character', names);
        },
        rebindChatWorldbook: async (selector, name) => { currentChat(selector); await bindBooks('chat', name); },
        getCurrentCharPrimaryLorebook: () => books()?.primaryName ?? null,
        getWorldbook: async (name) => readBook(name),
        createWorldbook: async (name, entries = []) => {
            await presetBarrier;
            if (books()?.names.includes(name))
                return false;
            await manageBooks({ kind: 'create-book', name, entries });
            return true;
        },
        createOrReplaceWorldbook: async (name, entries = []) => {
            await presetBarrier;
            if (!books()?.names.includes(name)) {
                await manageBooks({ kind: 'create-book', name, entries });
                return true;
            }
            const basis = retainedBookBasis(entries) ?? (await capturedBook(name)).basis;
            await mutateBook(name, { kind: 'replace-worldbook', entries }, basis);
            return false;
        },
        deleteWorldbook: async (name) => {
            await presetBarrier;
            if (!books()?.names.includes(name))
                return false;
            const { basis } = await capturedBook(name);
            await manageBooks({ kind: 'delete-book', name, target: basis.target }, basis);
            return true;
        },
        replaceWorldbook: async (name, entries) => {
            const basis = retainedBookBasis(entries) ?? (await capturedBook(name)).basis;
            await mutateBook(name, { kind: 'replace-worldbook', entries }, basis);
        },
        updateWorldbookWith: async (name, updater) => {
            const current = await readBook(name), basis = dataReads.get(current), entries = await updater(current);
            return (await mutateBook(name, { kind: 'replace-worldbook', entries }, basis)).worldbook;
        }, createWorldbookEntries: async (name, entries) => {
            const { basis } = await capturedBook(name), reply = await mutateBook(name, { kind: 'create-entries', entries }, basis);
            return { worldbook: reply.worldbook, new_entries: reply.new_entries };
        },
        deleteWorldbookEntries: async (name, predicate) => {
            const current = await readBook(name), basis = dataReads.get(current), reply = await mutateBook(name, { kind: 'delete-entries',
                uids: current.filter(predicate).map((row) => row.uid) }, basis);
            return { worldbook: reply.worldbook, deleted_entries: reply.deleted_entries };
        },
        getPersonaIds: () => personas()?.profiles.map((row) => row.avatar_id) ?? [],
        getPersonaNames: () => personas()?.profiles.map((row) => row.name) ?? [],
        getCurrentPersonaId: () => personaId(), getPersona: (id) => {
            const persona = clone(personas()?.profiles.find((row) => row.avatar_id === personaId(id)));
            if (persona)
                personaReads.set(persona, { dataSha256: personas().dataSha256, readScope: scope });
            return persona;
        },
        createPersona: async (name, persona = {}) => {
            await presetBarrier;
            const reply = await request('persona-mutate', {
                expectedDataSha256: personas()?.dataSha256, mutation: { kind: 'create', name, persona }
            });
            if (reply.result.kind === 'refused')
                throw Error(reply.result.code);
            return reply.result.receipt.result;
        },
        replacePersona: async (id, persona) => {
            await presetBarrier;
            const basis = persona && typeof persona === 'object' ? personaReads.get(persona) : undefined;
            const reply = await request('persona-mutate', {
                expectedDataSha256: basis?.dataSha256 ?? personas()?.dataSha256,
                mutation: { kind: 'replace', id: personaId(id), persona }
            }, basis?.readScope ?? scope);
            if (reply.result.kind === 'refused')
                throw Error(reply.result.code);
        },
        injectPrompts: (prompts, options = {}) => {
            const rows = prompts.map(prompt => {
                const { filter } = prompt;
                if (filter !== undefined && filter !== null && typeof filter !== 'function')
                    throw Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID');
                const filterCallbackId = filter ? crypto.randomUUID() : undefined;
                if (filterCallbackId)
                    filters.set(filterCallbackId, filter);
                return { id: prompt.id ?? crypto.randomUUID(), position: prompt.position === 'none' ? 'none' : 'in_chat',
                    depth: prompt.depth ?? 0, role: prompt.role ?? 'system', content: prompt.content ?? '', should_scan: prompt.should_scan ?? false,
                    ...filterCallbackId ? { filterCallbackId } : {} };
            });
            const registrationOperationId = mutatePrompts({ kind: 'register', prompts: rows, once: options.once === true });
            let deleted = false;
            return { uninject() {
                    if (deleted)
                        return;
                    deleted = true;
                    mutatePrompts({ kind: 'remove-ids', ids: rows.map(row => row.id), registrationOperationId });
                } };
        }, uninjectPrompts: (ids) => {
            mutatePrompts({ kind: 'remove-ids', ids: clone(ids) });
        },
    };
    api.SillyTavern = { getContext: api.getContext };
    api.nextTavern = { flushPresetWrites: () => presetBarrier, getNumericalState: () => clone(snapshot.numerical),
        replaceNumericalValues: (values, expected) => request('numerical-replace', { values, expected }),
        getComposer: () => request('composer', { action: 'get' }), setComposer: (value) => request('composer', { action: 'set', value }) };
    const { captureChatVariableReplacement, ...mvu } = createMvu({ snapshot: () => snapshot, readScope: () => scope, variables,
        parse: (message, oldData) => request('parse-mvu-message', { message, oldData, trialId: crypto.randomUUID() }),
        replace: (value, readScope) => request('numerical-replace', value, readScope) }, hookEvents);
    api.Mvu = mvu;
    api.waitGlobalInitialized = async (name) => {
        if (!Object.hasOwn(realm, name))
            throw Error('AUTHOR_NATIVE_GLOBAL_UNAVAILABLE');
        // Product libraries and the Mvu facade are installed before Source runs.
        // Their presence does not grant numerical read/write permission.
    };
    api.event_types = api.tavern_events = { ...clone(snapshot.context?.eventTypes ?? {}), GENERATION_STOPPED: 'generation_stopped' };
    api.iframe_events = { GENERATION_REQUESTED: 'js_generation_requested', GENERATION_STARTED: 'js_generation_started',
        GENERATION_BEFORE_END: 'js_generation_before_end', GENERATION_ENDED: 'js_generation_ended',
        STREAM_TOKEN_RECEIVED_FULLY: 'js_stream_token_received_fully', STREAM_TOKEN_RECEIVED_INCREMENTALLY: 'js_stream_token_received_incrementally',
        REASONING_TOKEN_RECEIVED_FULLY: 'js_reasoning_token_received_fully', REASONING_TOKEN_RECEIVED_INCREMENTALLY: 'js_reasoning_token_received_incrementally' };
    Object.assign(realm, api);
    realm.TavernHelper = api;
    async function loadSource() {
        layout = createLayout(document, layoutConfig, height);
        // Helper Source is a module in TavernHelper. Each descriptor therefore has
        // its own lexical scope even when this permission group shares a window.
        // Blob payloads preserve raw strings and HTML closing delimiters verbatim.
        for (const library of libraries) {
            const url = URL.createObjectURL(new Blob([library.javascript], { type: 'text/javascript' }));
            sourceUrls.push(url);
            await new Promise((resolve, reject) => {
                const element = document.createElement('script');
                element.src = url;
                element.onload = () => resolve();
                element.onerror = () => reject(Error('AUTHOR_NATIVE_LIBRARY_LOAD_FAILED'));
                document.head.appendChild(element);
            });
        }
        for (const source of scripts) {
            if (!active)
                return;
            const url = URL.createObjectURL(new Blob([source.javascript], { type: 'text/javascript' }));
            sourceUrls.push(url);
            // import() resolves after module evaluation, including top-level await;
            // a mere bridge connection or script fetch is not Source readiness.
            await importModule(url);
        }
        await presetBarrier;
        if (active) {
            sourceLoaded = true;
            send({ op: 'source-ready' });
        }
    }
    const receive = async (data) => {
        if (data.op === 'layout-height-ack') {
            const write = layoutWrites.get(data.id);
            layoutWrites.delete(data.id);
            if (data.error)
                write?.reject(Error(data.error));
            else
                write?.resolve();
        }
        else if (data.op === 'layout-config') {
            layoutRevision = data.revision;
            layoutConfig = data.config;
            layout?.update(layoutConfig, data.explicit);
        }
        else if (data.op === 'reply') {
            const entry = pending.get(data.id);
            pending.delete(data.id);
            if (data.error) {
                entry?.reject(Error(data.error));
                send({ op: 'ack-observed', id: data.id });
            }
            else {
                if (data.reply.presetLibrary)
                    presetLibrary = data.reply.presetLibrary;
                if (data.reply.characterLibrary)
                    characterLibrary = data.reply.characterLibrary;
                if (data.reply.snapshot) {
                    snapshot = data.reply.snapshot;
                    scope = data.reply.readScope ?? scope;
                    updateAvatarStyles();
                    if (data.reply.value && typeof data.reply.value === 'object')
                        repliesWithSnapshot.add(data.reply.value);
                    acceptButtons(data.reply.snapshot.scriptButtons);
                }
                entry?.resolve(data.reply.value);
                send({ op: 'ack-observed', id: data.id });
            }
        }
        else if (data.op === 'preset-library') {
            presetLibrary = data.catalog;
        }
        else if (data.op === 'character-library') {
            characterLibrary = data.packet;
        }
        else if (data.op === 'snapshot') {
            snapshot = data.snapshot;
            scope = data.readScope;
            updateAvatarStyles();
            acceptButtons(data.snapshot.scriptButtons);
        }
        else if (data.op === 'event') {
            await presetBarrier;
            if (data.requested) {
                if (data.event === 'js_generation_requested') {
                    generation.beginRequested(data.operationId);
                    data.args[2] = generation.decode(data.args[2]);
                }
                await events.request(data.event, data.args);
                if (data.event === 'js_generation_requested')
                    data.args[2] = generation.encode(data.args[2], data.args[0], data.operationId, true);
            }
            else
                await emit(data.event, data.args, data.callbackId ? [data.callbackId] : undefined);
            if (data.id)
                send({ op: 'control-reply', id: data.id, value: data.args });
        }
        else if (data.op === 'generation-cancel')
            generation.stopLocal(data.operationId);
        else if (data.op === 'generation-invoke-filter') {
            const accepted = await generation.invokeFilter(data.callbackId, data.operationId);
            send({ op: 'control-reply', id: data.id, value: { accepted } });
        }
        else if (data.op === 'generation-release-filters')
            generation.releaseFilters(data.operationId, data.ids);
        else if (data.op === 'mvu-trial-interests')
            send({ op: 'control-reply', id: data.id, value: trialEvents?.interests() ?? [] });
        else if (data.op === 'mvu-trial-hook') {
            if (!trialEvents)
                throw Error('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE');
            const graph = await trialEvents.invoke(data.stage, data.graph);
            send({ op: 'control-reply', id: data.id, value: graph });
        }
        else if (data.op === 'callbacks')
            send({ op: 'control-reply', id: data.id, value: events.registrations() });
        else if (data.op === 'library-reads')
            send({ op: 'control-reply', id: data.id, value: { libraryReads: [...libraryReads.values()],
                    ...presetLibrary ? { presetRevision: presetLibrary.revision } : {}, ...characterLibrary ? { characterEpoch: characterLibrary.epoch } : {} } });
        else if (data.op === 'flush-preset') {
            try {
                await presetBarrier;
                send({ op: 'control-reply', id: data.id });
            }
            catch (error) {
                send({ op: 'control-reply', id: data.id, error: error instanceof Error ? error.message : String(error) });
            }
        }
        else if (data.op === 'invoke') {
            const input = data.invocation;
            if (invocation || mutableHook)
                throw Error('AUTHOR_NATIVE_GENERATION_BUSY');
            if (input.snapshot) {
                snapshot = input.snapshot;
                scope = input.readScope ?? scope;
                updateAvatarStyles();
            }
            invocation = { id: input.invocationId, effects: [], callbackId: '' };
            try {
                const callbackIds = await emit(input.event, input.args, input.callbackIds);
                send({ op: 'control-reply', id: data.id, value: { invocationId: input.invocationId,
                        callbackIds, effects: invocation.effects, libraryReads: [...libraryReads.values()] } });
            }
            finally {
                invocation = undefined;
            }
        }
        else if (data.op === 'invoke-filter') {
            const input = data.invocation, callback = filters.get(input.filterCallbackId);
            try {
                if (!callback)
                    throw Error('AUTHOR_NATIVE_INJECTION_FILTER_RETIRED');
                const accepted = await callback();
                if (typeof accepted !== 'boolean')
                    throw Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID_RESULT');
                send({ op: 'control-reply', id: data.id, value: { accepted, libraryReads: [...libraryReads.values()] } });
            }
            catch (error) {
                send({ op: 'control-reply', id: data.id, error: error instanceof Error ? error.message : String(error) });
            }
        }
        else if (data.op === 'retire-filters') {
            retireFilters(data.ids);
        }
        else if (data.op === 'invoke-mvu-hook') {
            if (invocation || mutableHook)
                throw Error('AUTHOR_NATIVE_GENERATION_BUSY');
            const input = data.invocation, payload = input.request.payload, stage = input.request.stage;
            const event = hookEvents[stage];
            const writes = new Set(), owners = new WeakMap(), roots = new WeakSet(), proxies = new WeakMap(), originals = new WeakMap(), overlayOwners = new WeakMap();
            const readView = payload.readVariables?.appliedWrites?.kind === 'replace' ? undefined : payload.readVariables, shadow = new Set(readView?.appliedWrites?.keys ?? []), deleted = new Set(readView?.deletedKeys ?? []);
            let overlayRoot;
            let replaced = false;
            const object = (value) => value !== null && typeof value === 'object';
            const unwrap = (value) => object(value) ? originals.get(value) ?? value : value;
            const link = (value, key, index = owners) => {
                const raw = unwrap(value);
                if (!object(raw))
                    return;
                let keys = index.get(raw);
                if (!keys) {
                    keys = new Set();
                    index.set(raw, keys);
                }
                if (keys.has(key))
                    return;
                keys.add(key);
                for (const child of Object.values(raw))
                    link(child, key, index);
            };
            const root = (value) => {
                const raw = unwrap(value);
                if (object(raw) && !roots.has(raw)) {
                    roots.add(raw);
                    for (const key of Object.keys(raw))
                        link(raw[key], key);
                }
                return wrap(raw);
            };
            function changed(raw, key, value) {
                // The ordinary object joins the canonical graph only after an author
                // mutates it. Shared descendants promote every owning top-level key.
                if (!replaced && overlayRoot)
                    for (const owner of overlayOwners.get(raw) ?? []) {
                        if (shadow.has(owner))
                            continue;
                        Reflect.set(overlayRoot, owner, readView.values[owner], overlayRoot);
                        shadow.add(owner);
                        writes.add(owner);
                        link(readView.values[owner], owner);
                    }
                if (roots.has(raw) && typeof key === 'string') {
                    shadow.add(key);
                    writes.add(key);
                    link(value, key);
                }
                for (const owner of owners.get(raw) ?? []) {
                    writes.add(owner);
                    link(value, owner);
                }
            }
            function overlaid(raw, key) {
                return raw === overlayRoot && !replaced && typeof key === 'string' && !shadow.has(key)
                    && (deleted.has(key) || Object.hasOwn(readView.values, key));
            }
            function wrap(value) {
                const raw = unwrap(value);
                if (!object(raw))
                    return raw;
                let proxy = proxies.get(raw);
                if (proxy)
                    return proxy;
                proxy = new Proxy(raw, {
                    get(target, key) {
                        if (overlaid(target, key))
                            return deleted.has(key) ? undefined : wrap(readView.values[key]);
                        const value = Reflect.get(target, key, target), descriptor = Reflect.getOwnPropertyDescriptor(target, key);
                        // Proxy invariants require the exact value of a frozen data slot.
                        if (descriptor?.configurable === false && descriptor.writable === false)
                            return value;
                        return wrap(value);
                    },
                    getOwnPropertyDescriptor(target, key) {
                        if (overlaid(target, key))
                            return deleted.has(key) ? undefined :
                                { value: wrap(readView.values[key]), writable: true, enumerable: true, configurable: true };
                        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
                        if (!descriptor || !('value' in descriptor)
                            || descriptor.configurable === false && descriptor.writable === false)
                            return descriptor;
                        return { ...descriptor, value: wrap(descriptor.value) };
                    },
                    has(target, key) { return overlaid(target, key) ? !deleted.has(key) : Reflect.has(target, key); },
                    ownKeys(target) {
                        if (target !== overlayRoot || replaced)
                            return Reflect.ownKeys(target);
                        const keys = new Set(Reflect.ownKeys(target));
                        for (const key of Object.keys(readView.values))
                            if (!shadow.has(key))
                                keys.add(key);
                        for (const key of deleted)
                            if (!shadow.has(key))
                                keys.delete(key);
                        return [...keys];
                    },
                    set(target, key, value) {
                        const plain = unwrap(value), accepted = Reflect.set(target, key, plain, target);
                        if (accepted)
                            changed(target, key, plain);
                        return accepted;
                    },
                    deleteProperty(target, key) {
                        const accepted = Reflect.deleteProperty(target, key);
                        if (accepted)
                            changed(target, key);
                        return accepted;
                    },
                    defineProperty(target, key, descriptor) {
                        const next = 'value' in descriptor ? { ...descriptor, value: unwrap(descriptor.value) } : descriptor, accepted = Reflect.defineProperty(target, key, next);
                        if (accepted)
                            changed(target, key, 'value' in next ? next.value : undefined);
                        return accepted;
                    },
                });
                proxies.set(raw, proxy);
                originals.set(proxy, raw);
                return proxy;
            }
            // Tracking owns no cloned baseline. Only result containers containing
            // retained proxy references need materializing for MessagePort transport.
            const transported = new WeakMap();
            function plain(value) {
                const raw = unwrap(value);
                if (!object(raw))
                    return raw;
                if (transported.has(raw))
                    return transported.get(raw);
                let copy = raw;
                transported.set(raw, raw);
                for (const key of Object.keys(raw)) {
                    const child = raw[key], next = plain(child);
                    if (next === child)
                        continue;
                    if (copy === raw) {
                        copy = Array.isArray(raw) ? raw.slice() : { ...raw };
                        transported.set(raw, copy);
                    }
                    copy[key] = next;
                }
                return copy;
            }
            const graph = payload.graph ? createHookGraph() : undefined, graphRoots = graph?.materialize(payload.graph);
            const canonical = graphRoots ? graphRoots[0] : stage === 'before-message-update' ? payload.context.variables : payload.variables;
            if (readView) {
                overlayRoot = canonical;
                for (const key of Object.keys(readView.values))
                    if (!shadow.has(key) && !deleted.has(key)) {
                        link(readView.values[key], key, overlayOwners);
                    }
            }
            const variables = root(canonical);
            const context = stage === 'before-message-update' ? new Proxy(payload.context, {
                get(target, key) { return key === 'variables' ? root(target.variables) : Reflect.get(target, key, target); },
                set(target, key, value) {
                    const accepted = Reflect.set(target, key, unwrap(value), target);
                    if (accepted && key === 'variables') {
                        replaced = true;
                        root(target.variables);
                    }
                    return accepted;
                },
                defineProperty(target, key, descriptor) {
                    const next = 'value' in descriptor ? { ...descriptor, value: unwrap(descriptor.value) } : descriptor, accepted = Reflect.defineProperty(target, key, next);
                    if (accepted && key === 'variables') {
                        replaced = true;
                        root(target.variables);
                    }
                    return accepted;
                },
                deleteProperty(target, key) {
                    const accepted = Reflect.deleteProperty(target, key);
                    if (accepted && key === 'variables')
                        replaced = true;
                    return accepted;
                },
            }) : undefined;
            const args = stage === 'initialized' ? [variables, graphRoots[1]]
                : graphRoots ? wrap(graphRoots[2]) : stage === 'command-parsed' ? [variables, payload.commands, payload.message_content]
                    : stage === 'update-ended' ? [variables, payload.variables_before_update] : [context];
            mutableHook = { diagnostics: [], callbackId: '' };
            try {
                const callbackIds = await emit(event, args, input.callbackIds), output = graph && graphRoots
                    ? { graph: graph.capture(graphRoots, unwrap) } : stage === 'command-parsed'
                    ? { variables: payload.variables, commands: payload.commands } : stage === 'update-ended'
                    ? { variables: payload.variables } : { context: payload.context };
                send({ op: 'control-reply', id: data.id, value: { invocationId: input.invocationId, callbackIds,
                        result: { stage, output: graph ? output : plain(output), diagnostics: mutableHook.diagnostics,
                            contextWrites: replaced ? { schemaVersion: 1, kind: 'replace' } : { schemaVersion: 1, kind: 'keys', keys: [...writes] } } } });
            }
            finally {
                mutableHook = undefined;
            }
        }
    };
    const connect = (event) => {
        if (port || event.data?.op !== 'connect' || event.data.channel !== channel || !event.ports[0])
            return;
        port = event.ports[0];
        removeEventListener('message', connect);
        port.onmessage = event => void receive(event.data).catch(error => {
            if (event.data.id)
                send({ op: 'control-reply', id: event.data.id, error: error instanceof Error ? error.message : String(error) });
            else
                report(error);
        });
        port.start();
        for (const message of queued)
            port.postMessage(message);
        queued.length = 0;
        send({ op: 'bridge-ready' });
        void loadSource().catch(error => send({ op: 'source-error', code: error instanceof Error ? error.message : String(error) }));
    };
    addEventListener('message', connect);
    addEventListener('error', (event) => {
        if (active && sourceLoaded && event.error)
            send({ op: 'diagnostic', code: event.message, line: event.lineno, column: event.colno });
    });
    addEventListener('pagehide', () => {
        generation.dispose();
        active = false;
        port?.close();
        removeEventListener('message', connect);
        layout?.dispose();
        frameChanges.disconnect();
        for (const write of layoutWrites.values())
            write.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'));
        layoutWrites.clear();
        for (const entry of pending.values())
            entry.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'));
        pending.clear();
        events.dispose();
        filters.clear();
        queued.length = 0;
        for (const url of sourceUrls)
            URL.revokeObjectURL(url);
        sourceUrls.length = 0;
    }, { once: true });
}
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
export function authorNativeHelperHtml(program, binding, snapshot, readScope, channel, resource, libraries = [], layoutConfig = { mode: 'auto', viewportHeight: 600 }, routeEvents = false, presetLibrary, characterLibrary, sceneTopOffsets) {
    const scripts = program.scripts.filter(row => row.enabled && row.realmId === binding.realmId).map(row => {
        const offsets = sceneTopOffsets?.[row.originalOrdinal];
        if (!offsets)
            return { javascript: row.javascript };
        const parts = [];
        let cursor = 0;
        for (const start of offsets) {
            parts.push(row.javascript.slice(cursor, start), 'parent');
            cursor = start + 3;
        }
        parts.push(row.javascript.slice(cursor));
        return { javascript: parts.join('') };
    });
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'
        + READER_NATIVE_RESOURCE_CSP + '"><meta name="referrer" content="no-referrer"><style>body{margin:0}</style>'
        + '<script>(' + authorNativeHelperBootstrap.toString() + ')('
        + [snapshot, readScope, channel, binding.realmId, resource, scripts, libraries]
            .map(json).join(',') + ',(' + createReaderDocumentLayoutRealm.toString() + '),' + json(layoutConfig)
        // Keep this native JS import expression at the HTML serialization boundary.
        // TypeScript rewrites variable imports using a module-scoped helper; that
        // helper is absent from the independently serialized child bootstrap.
        + ',url=>import(url),(' + createAuthorNativeMvuApi.toString() + '),(' + createAuthorNativeEventOwner.toString() + '),('
        + createAuthorNativeScriptButtonCatalog.toString() + '),' + json(program.scripts.map(({ scriptId, identity, realmId, enabled, button, name }) => ({ scriptId, identity, realmId, enabled, button, name })))
        + ',(' + createAuthorNativeMessageVariables.toString() + '),(' + createAuthorNativeCurrentRegex.toString() + '),('
        + createAuthorNativeVariableWriters.toString() + '),' + json(routeEvents) + ',(' + createAuthorNativeMvuHookGraph.toString() + '),'
        + (presetLibrary ? json(presetLibrary) : 'undefined') + ',' + json(communityDefaultPresetDataV1()) + ',('
        + createAuthorNativeFormatterV1.toString() + '),' + json(TAVERN_PROMPT_TRANSFORM_LIMITS_V1) + ','
        + (characterLibrary ? json(characterLibrary) : 'undefined') + ',(' + createAuthorNativeGenerationApi.toString() + '),('
        + createAuthorNativeCommandLanguageV1.toString() + '),(' + createAuthorNativeMvuTrialEvents.toString() + '),' + json(AUTHOR_NATIVE_MVU_HOOK_EVENTS) + ')</script>';
}
export function createAuthorNativeHelperFrame(outer, program, binding, initial, host, options) {
    const view = outer.ownerDocument.defaultView, frame = options.scene ? undefined : outer.ownerDocument.createElement('iframe');
    const channel = crypto.randomUUID(), ports = new view.MessageChannel(), abort = new AbortController();
    let active = true, ready = false, sequence = 0, lostAcknowledgement = false;
    let resolveStarted, rejectStarted, resolveDisposed;
    let snapshot = initial.snapshot, readScope = initial.readScope, layoutRevision = 0, presetLibrary = options.presetLibrary;
    let characterLibrary = options.characterLibrary;
    const layoutConfig = () => options.documentLayout?.get() ?? { mode: 'auto', viewportHeight: view.innerHeight };
    const started = new Promise((yes, no) => { resolveStarted = yes; rejectStarted = no; });
    void started.catch(() => { });
    const disposed = new Promise(yes => { resolveDisposed = yes; });
    const controls = new Map();
    let eventEndpoint;
    const writes = new Map();
    const finishWrite = (id, unobserved = false) => {
        const write = writes.get(id);
        if (!write)
            return;
        lostAcknowledgement ||= unobserved;
        writes.delete(id);
        write.finish();
    };
    const send = (message) => ports.port1.postMessage(message);
    const current = () => active && options.current();
    const reportFailure = (code, impact, location) => {
        if (impact === 'partial' && ['AUTHOR_GENERATION_CANCELLED', 'AUTHOR_NATIVE_INVOCATION_ABORTED', 'ABORTED'].includes(code))
            return;
        if (code === 'AUTHOR_NATIVE_BINDING_REVOKED')
            impact = 'story-paused';
        const scripts = program.scripts.filter(script => script.realmId === binding.realmId && script.enabled);
        const script = scripts.length === 1 ? scripts[0] : undefined;
        options.reportExtensionFailure?.({ schemaVersion: 1, sessionId: options.attachment?.sessionId ?? snapshot.basis?.sessionId ?? '',
            id: binding.realmId + ':' + code, extension: 'author-script', code, phase: ready ? 'callback' : 'startup',
            sourceRevision: program.programSha256, impact, sourcePointer: script?.pointer, scriptIdentity: script?.identity, reason: code, ...location });
    };
    ports.port1.onmessage = event => {
        if (!current())
            return;
        const data = event.data;
        if (data.op === 'parent-ready')
            send({ op: 'mount', html: authorNativeHelperHtml(program, binding, snapshot, readScope, channel, options.resource, options.libraries, layoutConfig(), !!options.eventRoute, presetLibrary, characterLibrary, options.scene ? options.sceneTopOffsets : undefined),
                libraries: options.libraries?.map(row => row.javascript) ?? [], messageIndex: 0,
                sdkGlobals: ['getVariables', 'getAllVariables', 'getContext', 'getLastMessageId', 'getChatMessages', 'setChatMessages', 'updateVariablesWith', 'triggerSlash',
                    'replaceVariables', 'insertOrAssignVariables', 'insertVariables', 'deleteVariable', 'eventOn', 'eventOnce', 'eventMakeFirst', 'eventMakeLast', 'eventRemoveListener',
                    'eventEmit', 'eventEmitAndWait', 'eventClearEvent', 'eventClearListener', 'eventClearAll',
                    'generate', 'generateRaw', 'stopGenerationById', 'stopAllGeneration', 'placeholder_prompt_default_order', 'builtin_prompt_default_order',
                    'getResource', 'getScriptId', 'getScriptData', 'getButtonEvent', 'getScriptButtons', 'getAllEnabledScriptButtons',
                    'replaceScriptButtons', 'updateScriptButtonsWith', 'appendInexistentScriptButtons',
                    'getPresetNames', 'getLoadedPresetName', 'getPreset', 'loadPreset', 'createPreset', 'createOrReplacePreset', 'deletePreset',
                    'renamePreset', 'replacePreset', 'updatePresetWith', 'setPreset', 'default_preset', 'isPresetNormalPrompt',
                    'isPresetSystemPrompt', 'isPresetPlaceholderPrompt', 'replaceTavernRegexes', 'updateTavernRegexesWith', 'formatAsTavernRegexedString',
                    'getWorldbookNames', 'getGlobalWorldbookNames', 'getCharWorldbookNames', 'getChatWorldbookName',
                    'rebindGlobalWorldbooks', 'rebindCharWorldbooks', 'rebindChatWorldbook', 'createWorldbook',
                    'createOrReplaceWorldbook', 'deleteWorldbook', 'getWorldbook', 'replaceWorldbook', 'updateWorldbookWith', 'getTavernRegexes',
                    'createWorldbookEntries', 'deleteWorldbookEntries', 'getCurrentCharPrimaryLorebook', 'getPersonaIds', 'getPersonaNames',
                    'getCurrentPersonaId', 'getPersona', 'createPersona', 'replacePersona', 'injectPrompts', 'uninjectPrompts', 'SillyTavern',
                    'nextTavern', 'Mvu', 'waitGlobalInitialized', 'event_types', 'tavern_events', 'iframe_events', 'errorCatched', 'TavernHelper'] });
        else if (data.op === 'parent-error') {
            reportFailure(data.code, 'story-paused');
            rejectStarted(Error(data.code));
            options.failed?.(data.code);
        }
        else if (data.op === 'bridge-ready') {
            eventEndpoint = options.eventRoute?.register((event, args, requested, operationId) => new Promise((resolve, reject) => {
                const id = ++sequence;
                controls.set(id, { resolve, reject });
                send({ op: 'event', id, event, args, requested, operationId });
            }), current, { realmId: binding.realmId, attachment: options.attachment, async invokeFilter(callbackId, operationId, consumer) {
                    await control('flush-preset', {}, abort.signal);
                    const result = await control('generation-invoke-filter', { callbackId, operationId, consumer }, abort.signal);
                    return result.accepted;
                }, async trialInterests() {
                    return await control('mvu-trial-interests', {}, abort.signal);
                }, async invokeTrialHook(stage, graph) {
                    return await control('mvu-trial-hook', { stage, graph }, abort.signal);
                }, async captureLibraryReads() {
                    const result = await control('library-reads', {});
                    return result.libraryReads;
                }, retireFilters: (operationId, ids) => send({ op: 'generation-release-filters', operationId, ids }),
                cancel: operationId => send({ op: 'generation-cancel', operationId }) });
        }
        else if (data.op === 'source-ready') {
            ready = true;
            resolveStarted();
            send({ op: 'snapshot', snapshot, readScope });
            send({ op: 'layout-config', revision: layoutRevision, config: layoutConfig() });
        }
        else if (data.op === 'source-error') {
            reportFailure(data.code, 'story-paused');
            rejectStarted(Error(data.code));
            options.failed?.(data.code);
        }
        else if (data.op === 'layout-height') {
            if (data.revision !== layoutRevision) {
                send({ op: 'layout-height-ack', id: data.id, error: 'AUTHOR_NATIVE_LAYOUT_SUPERSEDED' });
                return;
            }
            if (frame)
                frame.style.height = `${Math.ceil(data.height)}px`;
            view.requestAnimationFrame(() => { if (current())
                send({ op: 'layout-height-ack', id: data.id }); });
        }
        else if (data.op === 'control-reply') {
            const entry = controls.get(data.id);
            controls.delete(data.id);
            if (data.error)
                entry?.reject(Error(data.error));
            else
                entry?.resolve(data.value);
        }
        else if (data.op === 'ack-observed')
            finishWrite(data.id);
        else if (data.op === 'request') {
            if (data.request.operation === 'generation-requested') {
                const args = data.request.payload.args, delivery = eventEndpoint ? eventEndpoint.transform('js_generation_requested', args, data.request.operationId) :
                    new Promise((resolve, reject) => {
                        const id = ++sequence;
                        controls.set(id, { resolve, reject });
                        send({ op: 'event', id, event: 'js_generation_requested', args,
                            requested: true, operationId: data.request.operationId });
                    });
                void delivery.then(value => { if (current())
                    send({ op: 'reply', id: data.id, reply: { value } }); }, error => {
                    if (current())
                        send({ op: 'reply', id: data.id, error: error instanceof Error ? error.message : String(error) });
                });
                return;
            }
            if (data.request.operation === 'emit-event') {
                const { event, args, excludeSelf } = data.request.payload;
                const delivery = eventEndpoint ? eventEndpoint.emit(event, args, excludeSelf)
                    : excludeSelf ? Promise.resolve() : new Promise((resolve, reject) => {
                        const id = ++sequence;
                        controls.set(id, { resolve: () => resolve(), reject });
                        send({ op: 'event', id, event, args });
                    });
                void delivery.then(() => { if (current())
                    send({ op: 'reply', id: data.id, reply: {} }); }, error => {
                    if (current())
                        send({ op: 'reply', id: data.id, error: error instanceof Error ? error.message : String(error) });
                });
                return;
            }
            // The binding is captured by Main; no child realm or group field is used.
            // The actual request owner notifies only when its write branch starts.
            const sourceWriteStarted = () => {
                let finish;
                writes.set(data.id, { done: new Promise(yes => { finish = yes; }), finish: () => finish() });
            };
            void host.request(binding, data.request, abort.signal, sourceWriteStarted).then(reply => {
                if (current())
                    send({ op: 'reply', id: data.id, reply });
                else
                    finishWrite(data.id, true);
            }, error => {
                if (current())
                    send({ op: 'reply', id: data.id, error: error instanceof Error ? error.message : String(error) });
                else
                    finishWrite(data.id, true);
            });
        }
        else if (data.op === 'diagnostic')
            reportFailure(data.code, 'partial', { line: data.line, column: data.column });
    };
    ports.port1.start();
    if (frame) {
        frame.setAttribute('credentialless', '');
        frame.sandbox.add('allow-scripts', 'allow-same-origin');
    }
    const unsubscribeLayout = options.documentLayout?.subscribe(explicit => {
        layoutRevision++;
        if (current())
            send({ op: 'layout-config', revision: layoutRevision, config: layoutConfig(), explicit });
    });
    if (frame) {
        frame.title = '作者原生助手';
        frame.style.cssText = 'display:block;width:100%;height:1px;border:0';
    }
    const parent = new URL(options.parentOrigin);
    parent.hash = new URLSearchParams({ channel }).toString();
    frame?.addEventListener('load', () => {
        if (current())
            frame.contentWindow.postMessage({ op: 'connect-parent', channel }, parent.origin, [ports.port2]);
    }, { once: true });
    const sceneChild = options.scene?.mount({ id: 'helper:' + binding.realmId, kind: 'helper', channel, port: ports.port2 });
    if (frame) {
        frame.src = parent.href;
        outer.appendChild(frame);
    }
    const control = async (op, payload, signal) => {
        await started;
        if (!current() || signal?.aborted)
            throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
        return new Promise((resolve, reject) => {
            const id = ++sequence;
            const cancelled = () => { controls.delete(id); reject(Error('AUTHOR_NATIVE_INVOCATION_ABORTED')); };
            controls.set(id, { resolve: value => { signal?.removeEventListener('abort', cancelled); resolve(value); },
                reject: error => { signal?.removeEventListener('abort', cancelled); reject(error); } });
            signal?.addEventListener('abort', cancelled, { once: true });
            send({ op, id, ...payload });
        });
    };
    return { started, disposed, hardTermination: 'unavailable',
        cancelGeneration: operationId => { if (current())
            send({ op: 'generation-cancel', operationId }); },
        updatePresetLibrary(catalog) { presetLibrary = catalog; if (current())
            send({ op: 'preset-library', catalog }); },
        updateCharacterLibrary(packet) { characterLibrary = packet; if (current())
            send({ op: 'character-library', packet }); },
        captureLibraryReads: () => control('library-reads', {}),
        updateSnapshot(value, scope) { snapshot = value; readScope = scope; if (current() && ready)
            send({ op: 'snapshot', snapshot, readScope }); },
        dispatchEvent(event, args, _resource, callbackId) { if (current())
            send({ op: 'event', event, args, callbackId }); },
        async waitForAdmittedSourceWrites() {
            await control('flush-preset', {});
            await Promise.all([...writes.values()].map(row => row.done));
            if (lostAcknowledgement)
                throw Error('AUTHOR_NATIVE_ACK_UNOBSERVED');
        },
        generationCallbacks: () => control('callbacks', {}),
        async invokeGeneration(invocation, signal) {
            await control('flush-preset', {}, signal);
            return control('invoke', { invocation }, signal);
        },
        async invokeFilter(invocation, signal) {
            await control('flush-preset', {}, signal);
            return control('invoke-filter', { invocation }, signal);
        },
        retireFilterCallbacks: ids => { if (current())
            send({ op: 'retire-filters', ids }); },
        async invokeMvuHook(invocation, signal) {
            await control('flush-preset', {}, signal);
            return control('invoke-mvu-hook', { invocation }, signal);
        },
        dispose() {
            if (!active)
                return;
            active = false;
            eventEndpoint?.dispose();
            abort.abort();
            unsubscribeLayout?.();
            ports.port1.close();
            ports.port2.close();
            sceneChild?.dispose();
            frame?.remove();
            rejectStarted(Error('AUTHOR_NATIVE_BINDING_REVOKED'));
            for (const entry of controls.values())
                entry.reject(Error('AUTHOR_NATIVE_BINDING_REVOKED'));
            controls.clear();
            lostAcknowledgement ||= writes.size > 0;
            for (const row of writes.values())
                row.finish();
            writes.clear();
            resolveDisposed();
        } };
}
