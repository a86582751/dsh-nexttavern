// Generated from runtime/alpha3/src/core/tavern-author-browser-child.ts; edit the TypeScript source.
/** Actual opaque-realm implementation, bundled by the owned producer. Its
 * snapshots and numerical save results must arrive through the real parent
 * port. Missing data never becomes a fabricated ready/empty snapshot. */
import { BrowserBudgetError, BrowserBudgetV1, freezeBrowserSnapshot, quantifyBrowserTransport } from './tavern-author-browser-budget.js';
function runtimeError(code) { throw new BrowserBudgetError(code); }
const errorCode = (error) => error instanceof BrowserBudgetError ? error.code : 'BROWSER_AUTHOR_ERROR';
export function startBrowserRuntimeV1(config) {
    if (!document.body || !config?.nonce || !config.binding?.generation || !config.runtime?.implementationSha256) {
        runtimeError('BROWSER_RUNTIME_CONFIGURATION_MISSING');
    }
    const authorRoot = document.createElement('div'), messageRoot = document.createElement('div'), sheet = document.createElement('style');
    authorRoot.className = 'owned-author-root';
    messageRoot.className = 'owned-trusted-message-root';
    document.body.append(sheet, messageRoot, authorRoot);
    const budget = new BrowserBudgetV1(), nativeNodes = new WeakMap(), facades = new WeakMap();
    const listenerDisposers = new Set(), pending = new Map();
    let port = null, snapshot, started = false, starting = false, active = true;
    let sent = 0, requestId = 0, renderRevision = 0, unknownRequest;
    const send = (type, data = {}) => {
        if (active && port)
            port.postMessage({ v: 2, nonce: config.nonce, generation: config.binding.generation,
                browserSessionId: config.binding.browserSessionId, sequence: ++sent, type, ...data });
    };
    const installSnapshot = (next) => {
        if (next.generation !== config.binding.generation || next.basis.sessionId !== config.binding.sessionId
            || !Number.isSafeInteger(next.readRevision) || next.readRevision < 1
            || snapshot && next.readRevision < snapshot.readRevision)
            runtimeError('BROWSER_SNAPSHOT_BINDING_MISMATCH');
        // Parent has quantified the complete projection before sending it. The
        // incoming clone is frozen once, with no Source revalidation in getters.
        snapshot = freezeBrowserSnapshot(next);
        if (next.numerical.kind === 'ready' || next.numerical.kind === 'schema-ready')
            budget.registerNumericalValues(next.numerical.values);
    };
    const currentSnapshot = () => {
        if (!active || !port || !snapshot)
            runtimeError('BROWSER_SNAPSHOT_UNAVAILABLE');
        return snapshot;
    };
    const measure = () => send('layout', { height: Math.max(1, Math.ceil(document.body.getBoundingClientRect().height)), renderRevision });
    const facadeFor = (element) => {
        const known = facades.get(element);
        if (known)
            return known;
        const bytes = new Map(), listeners = new Map();
        const textAssignment = (key, value, write) => {
            const next = budget.domText(value, bytes.get(key) ?? 0);
            write();
            bytes.set(key, next);
            measure();
        };
        const facade = Object.create(null);
        Object.defineProperties(facade, {
            id: { enumerable: true, get: () => element.id, set: (value) => textAssignment('id', value, () => { element.id = value; }) },
            className: { enumerable: true, get: () => element.className, set: (value) => textAssignment('class', value, () => { element.className = value; }) },
            textContent: { enumerable: true, get: () => element.textContent, set: (value) => {
                    const text = value ?? '';
                    textAssignment('text', text, () => { element.textContent = text; });
                } },
        });
        if (element.tagName === 'BUTTON')
            Object.defineProperty(facade, 'disabled', { enumerable: true,
                get: () => element.disabled, set: (value) => { element.disabled = value; } });
        facade.append = (...nodes) => {
            const accepted = [];
            for (const node of nodes) {
                if (typeof node === 'string') {
                    budget.createNode();
                    budget.domText(node);
                    accepted.push(document.createTextNode(node));
                }
                else {
                    const native = nativeNodes.get(node);
                    if (!native)
                        runtimeError('BROWSER_DOM_OWNER_MISMATCH');
                    accepted.push(native);
                }
            }
            element.append(...accepted);
            measure();
        };
        facade.querySelector = selector => {
            // Initial profile deliberately supports the fixture's scoped id lookup,
            // not an arbitrary CSS parser over an attacker-sized selector.
            if (!/^#[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(selector))
                runtimeError('BROWSER_DOM_SELECTOR_UNSUPPORTED');
            const found = element.querySelector(selector);
            return found ? facadeFor(found) : null;
        };
        facade.setAttribute = (name, value) => {
            if (!['id', 'class', 'title', 'aria-label'].includes(name) && !/^data-[a-z0-9_-]{1,128}$/.test(name)) {
                runtimeError('BROWSER_DOM_ATTRIBUTE_UNSUPPORTED');
            }
            textAssignment(name, value, () => element.setAttribute(name, value));
        };
        facade.addEventListener = (type, listener) => {
            if (!['click', 'input', 'change'].includes(type))
                runtimeError('BROWSER_DOM_EVENT_UNSUPPORTED');
            let held = listeners.get(type);
            if (!held) {
                held = new Map();
                listeners.set(type, held);
            }
            if (held.has(listener))
                return;
            const wrapped = event => {
                if (!active || !started)
                    return;
                // Promise settlement is observed; there is no dummy resolved Promise.
                Promise.resolve().then(() => listener(Object.freeze({ preventDefault: () => event.preventDefault(),
                    stopPropagation: () => event.stopPropagation() }))).catch(error => send('handler-error', { code: errorCode(error) }));
            };
            held.set(listener, wrapped);
            element.addEventListener(type, wrapped);
            listenerDisposers.add(() => element.removeEventListener(type, wrapped));
        };
        facade.removeEventListener = (type, listener) => {
            const held = listeners.get(type), wrapped = held?.get(listener);
            if (wrapped) {
                element.removeEventListener(type, wrapped);
                held.delete(listener);
            }
        };
        Object.freeze(facade);
        nativeNodes.set(facade, element);
        facades.set(element, facade);
        return facade;
    };
    const root = facadeFor(authorRoot), ownedDocument = Object.freeze({
        createElement(tag) {
            if (!['div', 'p', 'button', 'span', 'section', 'label'].includes(tag))
                runtimeError('BROWSER_DOM_TAG_UNSUPPORTED');
            budget.createNode();
            return facadeFor(document.createElement(tag));
        }, querySelector: (selector) => root.querySelector(selector),
    });
    const getVariablesFor = (scriptIdentity) => (option) => {
        const frame = currentSnapshot().scopeFrame, script = frame.scripts.find(row => row.scriptId === scriptIdentity);
        if (!script)
            runtimeError('SCOPE_READ_SCRIPT_UNAVAILABLE');
        const selected = option ?? { type: 'chat' };
        const available = (row) => {
            if (row.kind !== 'available')
                runtimeError(row.code);
            return row.variables;
        };
        if (selected.type === 'chat' || selected.type === 'character' || selected.type === 'global')
            return available(frame.scopes[selected.type]);
        if (selected.type === 'script') {
            if (selected.script_id !== undefined && selected.script_id !== scriptIdentity)
                runtimeError('SCOPE_READ_REQUEST_INVALID');
            return available(script.variables);
        }
        if (selected.type !== 'message')
            runtimeError('SCOPE_READ_REQUEST_INVALID');
        const id = selected.message_id;
        const row = id === undefined || id === 'latest' ? frame.messages.findLast(item => !item.isSystem) :
            typeof id === 'number' && Number.isSafeInteger(id) ? frame.messages[id < 0 ? frame.messages.length + id : id] : undefined;
        if (!row)
            runtimeError(id === undefined || id === 'latest' ? 'MESSAGE_STATE_UNAVAILABLE' : 'SCOPE_READ_MESSAGE_INDEX_OUT_OF_RANGE');
        return available(row.variables);
    };
    const bridgeFor = (scriptIdentity) => Object.freeze({
        getNumericalState() {
            if (unknownRequest !== undefined)
                runtimeError('BROWSER_SAVE_ACK_UNKNOWN');
            if (pending.size)
                runtimeError('BROWSER_SAVE_PENDING');
            return currentSnapshot().numerical;
        },
        replaceNumericalValues(values, expected) {
            // Startup may read and construct DOM, but opening the realm must not write player state.
            if (!started)
                runtimeError('BROWSER_PLAYER_WRITE_BEFORE_STARTUP');
            const read = currentSnapshot(), numerical = read.numerical;
            if (unknownRequest !== undefined)
                runtimeError('BROWSER_SAVE_ACK_UNKNOWN');
            if (pending.size)
                runtimeError('BROWSER_SAVE_PENDING');
            if (numerical.kind !== 'ready' && numerical.kind !== 'schema-ready')
                runtimeError('BROWSER_NUMERICAL_UNAVAILABLE');
            if (!numerical.canEdit || expected !== numerical.expected)
                runtimeError('BROWSER_NUMERICAL_BASE_STALE');
            const id = ++requestId, request = { requestId: id, generation: config.binding.generation,
                readRevision: read.readRevision, scriptIdentity, values, expected };
            quantifyBrowserTransport(request);
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject, readRevision: read.readRevision });
                send('rpc-save', { request });
            });
        },
    });
    const render = (next) => {
        if (!Number.isSafeInteger(next.renderRevision) || next.renderRevision <= renderRevision)
            return;
        renderRevision = next.renderRevision;
        sheet.textContent = next.css;
        const fragment = document.createDocumentFragment();
        for (const part of next.parts) {
            const section = document.createElement('section');
            section.dataset.readerKey = part.key;
            if (part.kind === 'user')
                section.textContent = part.text;
            else
                section.innerHTML = part.html;
            fragment.append(section);
        }
        // Only trusted message DOM is replaced; authorRoot and its listeners persist.
        messageRoot.replaceChildren(fragment);
        measure();
    };
    const dispose = () => {
        if (!active)
            return;
        active = false;
        for (const stop of listenerDisposers)
            stop();
        listenerDisposers.clear();
        for (const request of pending.values())
            request.reject(new BrowserBudgetError('BROWSER_GENERATION_REVOKED'));
        pending.clear();
        port?.close();
        port = null;
        snapshot = undefined;
    };
    const startup = async (program, read) => {
        if (started || starting)
            runtimeError('BROWSER_STARTUP_ALREADY_REQUESTED');
        if (program.programSha256 !== config.binding.programSha256
            || program.runtime.implementationSha256 !== config.runtime.implementationSha256
            || program.runtime.capabilityContractSha256 !== config.runtime.capabilityContractSha256) {
            runtimeError('BROWSER_RUNTIME_IMPLEMENTATION_MISMATCH');
        }
        starting = true;
        installSnapshot(read);
        let ordinal = -1;
        try {
            for (const script of program.scripts) {
                ordinal = script.ordinal;
                if (script.disposition === 'disabled-source-retained')
                    continue;
                if (script.disposition !== 'compiled-browser' || !active)
                    runtimeError('BROWSER_PROGRAM_NOT_EXECUTABLE');
                const entry = new Function('root', 'document', 'getVariables', 'getChatMessages', 'NextTavern', '__owned_browser_budget_v1__', 'String', 'Number', 'JSON', script.javascript);
                await entry(root, ownedDocument, getVariablesFor(script.descriptor.identity), () => currentSnapshot().messages, bridgeFor(script.descriptor.identity), budget, budget.string.bind(budget), budget.number.bind(budget), Object.freeze({ stringify: budget.stringify.bind(budget) }));
            }
            if (!active)
                runtimeError('BROWSER_GENERATION_REVOKED');
            started = true;
            starting = false;
            send('startup-complete', { readRevision: currentSnapshot().readRevision });
        }
        catch (error) {
            starting = false;
            send('startup-failed', { ordinal, code: errorCode(error) });
            dispose();
        }
    };
    window.addEventListener('message', event => {
        const data = event.data;
        if (event.source !== window.parent || data?.v !== 2 || data.type !== 'bind' || data.nonce !== config.nonce
            || data.generation !== config.binding.generation || !event.ports?.[0] || port)
            return;
        port = event.ports[0];
        port.onmessage = event => {
            const data = event.data;
            if (!active || data?.v !== 2 || data.nonce !== config.nonce || data.generation !== config.binding.generation)
                return;
            try {
                if (data.type === 'initialize')
                    void startup(data.program, data.snapshot)
                        .catch(error => { send('startup-failed', { code: errorCode(error) }); dispose(); });
                else if (data.type === 'snapshot')
                    installSnapshot(data.snapshot);
                else if (data.type === 'render')
                    render(data.render);
                else if (data.type === 'revoke')
                    dispose();
                else if (data.type === 'rpc-result') {
                    const reply = data.reply, request = pending.get(reply.requestId);
                    if (reply.generation !== config.binding.generation)
                        return;
                    if (!request && unknownRequest !== reply.requestId)
                        return;
                    installSnapshot(reply.snapshot);
                    if (reply.result.operation?.outcome === 'unknown' || reply.result.code === 'MVU_PLAYER_WRITE_UNKNOWN')
                        unknownRequest = reply.requestId;
                    else if (unknownRequest === reply.requestId)
                        unknownRequest = undefined;
                    if (request) {
                        pending.delete(reply.requestId);
                        request.resolve(reply.result);
                    }
                }
                else if (data.type === 'rpc-error') {
                    const request = pending.get(data.requestId);
                    if (request) {
                        unknownRequest = data.requestId;
                        pending.delete(data.requestId);
                        request.reject(new BrowserBudgetError('BROWSER_SAVE_ACK_UNKNOWN'));
                    }
                }
                else if (data.type === 'rpc-denied') {
                    const request = pending.get(data.requestId);
                    if (request) {
                        pending.delete(data.requestId);
                        request.reject(new BrowserBudgetError(data.code));
                    }
                }
            }
            catch (error) {
                send('runtime-error', { code: errorCode(error) });
                dispose();
            }
        };
        port.start();
        send('bound');
    });
    window.parent.postMessage({ v: 2, type: 'transport-ready', nonce: config.nonce, generation: config.binding.generation }, '*');
}
export function startBrowserRuntimeFromDocumentV1() {
    const element = document.getElementById('owned-browser-runtime-config');
    if (!element?.textContent)
        runtimeError('BROWSER_RUNTIME_CONFIGURATION_MISSING');
    startBrowserRuntimeV1(JSON.parse(element.textContent));
}
