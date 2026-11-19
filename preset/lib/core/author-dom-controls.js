// Generated from runtime/alpha3/src/core/author-dom-controls.ts; edit the TypeScript source.
/** Owns Source DOM control discovery and one finite primary-press transaction.
 * Serialized into the isolated parent shell, with no Main or Core references. */
export function createAuthorDomControls(publish, publishViewport) {
    const controls = new Map(), elements = new Map();
    const descriptions = new Map();
    const shadowRoots = new Set();
    const viewportFrames = new Set();
    let viewportActive = false, viewportCheck;
    const refreshViewport = () => {
        viewportCheck = undefined;
        let next = false;
        for (const frame of viewportFrames) {
            if (!frame.isConnected) {
                viewportFrames.delete(frame);
                continue;
            }
            if (next)
                continue;
            const css = getComputedStyle(frame);
            if (css.position !== 'fixed' || css.visibility !== 'visible' || css.pointerEvents === 'none')
                continue;
            const viewportHeight = /^100(?:%|[dls]?vh)$/.test(frame.style.height)
                || frame.computedStyleMap?.().get('height')?.toString() === '100%';
            if (!viewportHeight)
                continue;
            const { top, left, right, bottom } = frame.getBoundingClientRect();
            if (right > left && bottom > top && top <= 1 && left <= 1 && right >= innerWidth - 1 && bottom >= innerHeight - 1)
                next = true;
        }
        if (next === viewportActive)
            return;
        viewportActive = next;
        publishViewport?.(next);
    };
    const scheduleViewport = () => {
        if (viewportCheck === undefined && viewportFrames.size)
            viewportCheck = requestAnimationFrame(refreshViewport);
    };
    let active = true;
    const listenerFacts = new WeakMap();
    // Detached child documents may disappear while the Source scene stays alive.
    // Adoption keeps its native subscription, without retaining that child signal.
    const abortSubscriptions = new Map();
    const actionTypes = new Set(['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup']);
    const interactive = (element) => {
        if (semanticControl(element) || listenerFacts.get(element)?.length)
            return true;
        for (const type of actionTypes)
            if (typeof element['on' + type] === 'function' || element.hasAttribute('on' + type))
                return true;
        return false;
    };
    let observer;
    const observation = { subtree: true, childList: true, characterData: true, attributes: true };
    const composedParent = (element) => element.assignedSlot ?? element.parentElement
        ?? element.getRootNode().host ?? null;
    const owned = (element) => {
        if (!element.isConnected || element.ownerDocument !== document)
            return false;
        let root = element.getRootNode();
        while (root.nodeType === 11) {
            if (!shadowRoots.has(root))
                return false;
            root = root.host.getRootNode();
        }
        return root === document;
    };
    const semanticControl = (element) => element.getAttribute('role') === 'button'
        || element.localName === 'button' && element.namespaceURI === 'http://www.w3.org/1999/xhtml';
    const flatText = (node) => {
        if (node.nodeType === 3)
            return node.textContent ?? '';
        if (node.nodeType !== 1)
            return '';
        const element = node;
        if (element.localName === 'img')
            return element.getAttribute('alt') ?? '';
        const slot = element, assigned = element.localName === 'slot' ? slot.assignedNodes({ flatten: true }) : [];
        const children = element.localName === 'slot' && assigned.length ? assigned : element.shadowRoot?.childNodes ?? node.childNodes;
        return [...children].map(flatText).join('');
    };
    let controlSnapshot = [];
    const describe = (element) => {
        if (!interactive(element) || !owned(element))
            return;
        let fixed = false, disabled = false;
        for (let node = element; node; node = composedParent(node)) {
            if (node.matches('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]'))
                return;
            const style = getComputedStyle(node);
            if (node.hasAttribute('hidden') || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true'
                || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')
                return;
            if (style.position === 'fixed')
                fixed = true;
            if (node.getAttribute('aria-disabled') === 'true')
                disabled = true;
        }
        if (!fixed || !element.getClientRects().length)
            return;
        const scope = element.getRootNode();
        const labelled = element.getAttribute('aria-labelledby')?.split(/\s+/)
            .map(id => { const label = scope.getElementById(id); return label ? flatText(label) : ''; }).join(' ').trim();
        const label = labelled || element.getAttribute('aria-label')?.trim() || flatText(element).trim() || element.getAttribute('title')?.trim();
        if (!label)
            return;
        return { label, disabled: disabled || element.matches(':disabled') };
    };
    const publishControls = () => {
        const next = [...descriptions.values()].filter(row => !preferDescendant(elements.get(row.id)));
        if (next.length === controlSnapshot.length && next.every((row, index) => {
            const old = controlSnapshot[index];
            return row.id === old.id && row.label === old.label && row.disabled === old.disabled;
        }))
            return;
        controlSnapshot = next;
        publish(next);
    };
    const changedControls = new Set();
    const ancestorControls = new Map(), controlAncestors = new Map();
    const trackAncestors = (element) => {
        const next = [];
        if (owned(element) && interactive(element))
            for (let node = element; node; node = composedParent(node))
                next.push(node);
        const previous = controlAncestors.get(element) ?? [];
        if (next.length === previous.length && next.every((node, index) => node === previous[index]))
            return;
        for (const node of previous) {
            const dependents = ancestorControls.get(node);
            dependents.delete(element);
            if (!dependents.size)
                ancestorControls.delete(node);
        }
        if (!next.length) {
            controlAncestors.delete(element);
            return;
        }
        controlAncestors.set(element, next);
        for (const node of next) {
            let dependents = ancestorControls.get(node);
            if (!dependents) {
                dependents = new Set();
                ancestorControls.set(node, dependents);
            }
            dependents.add(element);
        }
    };
    const changedDescendants = (element) => { for (const control of ancestorControls.get(element) ?? [])
        changedControls.add(control); };
    const preferDescendant = (element) => {
        if (semanticControl(element))
            return false;
        for (const descendant of ancestorControls.get(element) ?? []) {
            const value = descriptions.get(controls.get(descendant));
            if (descendant !== element && value && !value.disabled)
                return true;
        }
        return false;
    };
    const labelReferences = new Map(), controlLabels = new Map();
    const trackLabels = (element) => {
        const previous = controlLabels.get(element) ?? '', next = owned(element) && interactive(element)
            ? element.getAttribute('aria-labelledby')?.trim() ?? '' : '';
        if (previous === next)
            return;
        for (const id of previous.split(/\s+/)) {
            const dependents = labelReferences.get(id);
            dependents?.delete(element);
            if (!dependents?.size)
                labelReferences.delete(id);
        }
        controlLabels.delete(element);
        if (next) {
            controlLabels.set(element, next);
            for (const id of next.split(/\s+/)) {
                let dependents = labelReferences.get(id);
                if (!dependents) {
                    dependents = new Set();
                    labelReferences.set(id, dependents);
                }
                dependents.add(element);
            }
        }
    };
    const labelChanged = (element) => {
        for (let node = element; node; node = composedParent(node))
            for (const control of labelReferences.get(node.id) ?? [])
                changedControls.add(control);
    };
    const changedLabelSubtree = (node) => {
        if (node.nodeType !== 1 || !labelReferences.size)
            return;
        const element = node;
        labelChanged(element);
        for (const label of element.querySelectorAll('[id]'))
            labelChanged(label);
    };
    const register = (element) => {
        if (!controls.has(element)) {
            if (!owned(element) || !interactive(element))
                return;
            const id = crypto.randomUUID();
            controls.set(element, id);
            elements.set(id, element);
        }
        changedControls.add(element);
    };
    const discover = (node) => {
        if (node.nodeType !== 1 && node.nodeType !== 11)
            return false;
        const root = node;
        let stylesheet = false;
        const visit = (element) => {
            if (element.matches('style,link'))
                stylesheet = true;
            if (publishViewport && element.localName === 'iframe' && !element.closest('[data-author-scene-child]')) {
                viewportFrames.add(element);
            }
            register(element);
            const shadow = element.shadowRoot;
            if (shadow && owned(element) && !shadowRoots.has(shadow)) {
                shadowRoots.add(shadow);
                observer.observe(shadow, observation);
                shadow.addEventListener('slotchange', slotChanged);
                discover(shadow);
            }
            else if (shadow)
                for (const control of controls.keys())
                    if (control.getRootNode() === shadow)
                        changedControls.add(control);
        };
        if (node.nodeType === 1)
            visit(root);
        for (const element of root.querySelectorAll('*'))
            visit(element);
        return stylesheet;
    };
    const slotChanged = (event) => {
        const target = event.target;
        changedDescendants(target.getRootNode().host);
        for (let node = target; node; node = composedParent(node))
            if (interactive(node)) {
                register(node);
                break;
            }
        labelChanged(target);
        refreshControls();
    };
    const refreshControls = () => {
        if (!active)
            return;
        let changed = false;
        for (const element of changedControls) {
            trackLabels(element);
            trackAncestors(element);
            const id = controls.get(element), previous = descriptions.get(id), value = interactive(element) ? describe(element) : undefined;
            if (!owned(element) || !interactive(element)) {
                controls.delete(element);
                elements.delete(id);
            }
            if (value) {
                if (!previous || previous.label !== value.label || previous.disabled !== value.disabled) {
                    descriptions.set(id, { id, ...value });
                    changed = true;
                }
            }
            else if (descriptions.delete(id))
                changed = true;
        }
        changedControls.clear();
        if (changed)
            publishControls();
    };
    observer = new MutationObserver(records => {
        let viewportChanged = false;
        for (const record of records) {
            if (record.type === 'childList') {
                let stylesheet = false;
                const frameCount = viewportFrames.size;
                for (const node of record.addedNodes) {
                    stylesheet = discover(node) || stylesheet;
                    changedLabelSubtree(node);
                }
                for (const node of record.removedNodes) {
                    changedLabelSubtree(node);
                    if (node.nodeType === 1 && (node.matches('style,link') || node.querySelector('style,link')))
                        stylesheet = true;
                }
                if (stylesheet)
                    for (const element of controls.keys())
                        changedControls.add(element);
                if (frameCount !== viewportFrames.size || stylesheet
                    || [...viewportFrames].some(frame => !frame.isConnected))
                    viewportChanged = true;
            }
            const target = record.target.nodeType === 1 ? record.target
                : record.target.nodeType === 11 ? record.target.host : record.target.parentElement;
            if (!target)
                continue;
            for (let node = target; node; node = composedParent(node))
                if (interactive(node)) {
                    register(node);
                    break;
                }
            if (record.type === 'attributes') {
                register(target);
                changedDescendants(target);
            }
            if (target.shadowRoot)
                changedDescendants(target);
            labelChanged(target);
            // Renaming a label can remove its former binding as well as add a new one.
            if (record.type === 'attributes' && record.attributeName === 'id')
                for (const dependents of labelReferences.values())
                    for (const element of dependents)
                        changedControls.add(element);
            // Stylesheets can change fixed positioning outside their own subtree.
            if (target.closest('style') || target.tagName === 'LINK') {
                viewportChanged = true;
                for (const element of controls.keys())
                    changedControls.add(element);
            }
            if (record.type === 'attributes' && !viewportChanged)
                for (const frame of viewportFrames) {
                    for (let node = frame; node; node = composedParent(node))
                        if (node === target) {
                            viewportChanged = true;
                            break;
                        }
                    if (viewportChanged)
                        break;
                }
        }
        const removedElements = records.some(record => record.type === 'childList' && [...record.removedNodes].some(node => node.nodeType === 1));
        if (removedElements)
            for (const element of controls.keys())
                if (!owned(element))
                    changedControls.add(element);
        const retired = removedElements ? [...shadowRoots].filter(root => !owned(root.host)) : [];
        if (retired.length) {
            for (const root of retired) {
                shadowRoots.delete(root);
                root.removeEventListener('slotchange', slotChanged);
            }
            observer.disconnect();
            observer.observe(document.documentElement, observation);
            for (const root of shadowRoots)
                observer.observe(root, observation);
        }
        refreshControls();
        if (viewportChanged)
            scheduleViewport();
    });
    observer.observe(document.documentElement, observation);
    discover(document.documentElement);
    refreshControls();
    if (publishViewport) {
        scheduleViewport();
        addEventListener('resize', scheduleViewport);
    }
    const eventChanged = (element) => { if (active && (controls.has(element) || owned(element))) {
        register(element);
        refreshControls();
    } };
    const retire = (element, fact) => {
        const facts = listenerFacts.get(element);
        if (!facts?.includes(fact))
            return;
        facts.splice(facts.indexOf(fact), 1);
        if (!facts.length)
            listenerFacts.delete(element);
        if (fact.abort) {
            fact.signal.removeEventListener('abort', fact.abort);
            abortSubscriptions.delete(fact.abort);
        }
        eventChanged(element);
    };
    let pointerSequence = -2147483648;
    let press;
    const pointerEvent = (type, cancelable = true) => new PointerEvent(type, {
        bubbles: true, composed: true, cancelable, pointerId: press.id, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: press.down ? 1 : 0, clientX: press.x, clientY: press.y, view: window, detail: type === 'click' ? 1 : 0
    });
    const processCapture = () => {
        const current = press;
        const previous = current.capture, next = current.pending;
        if (previous === next)
            return;
        current.capture = next;
        if (previous)
            previous.dispatchEvent(pointerEvent('lostpointercapture', false));
        if (next)
            next.dispatchEvent(pointerEvent('gotpointercapture', false));
    };
    const activate = (id) => {
        const element = elements.get(id), value = element && describe(element);
        if (!value || preferDescendant(element))
            return 'AUTHOR_CONTROL_UNAVAILABLE';
        if (value.disabled)
            return 'AUTHOR_CONTROL_DISABLED';
        const rect = element.getBoundingClientRect();
        press = { id: pointerSequence++, down: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const mouse = (type, target) => target.dispatchEvent(new MouseEvent(type, {
            bubbles: true, composed: true, cancelable: true, button: 0, buttons: press.down ? 1 : 0,
            clientX: press.x, clientY: press.y, view: window, detail: 1
        }));
        try {
            const compatibility = element.dispatchEvent(pointerEvent('pointerdown'));
            if (compatibility)
                mouse('mousedown', element);
            processCapture();
            const released = press.capture ?? element;
            press.down = false;
            released.dispatchEvent(pointerEvent('pointerup'));
            if (compatibility)
                mouse('mouseup', released);
            // Capture at pointerup determines click even after implicit release.
            let clicked = released;
            if (!press.capture)
                while (clicked && !clicked.contains(element))
                    clicked = composedParent(clicked);
            press.pending = undefined;
            processCapture();
            if (clicked?.isConnected)
                clicked.dispatchEvent(pointerEvent('click'));
            return undefined;
        }
        finally {
            press.pending = undefined;
            processCapture();
            press = undefined;
        }
    };
    const realmHooks = new Map();
    const hookRealm = (view) => {
        const realm = view, restores = [];
        if (realmHooks.has(realm.Element.prototype))
            return;
        const patch = (prototype, name, value) => {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
            Object.defineProperty(prototype, name, { ...descriptor, value });
            restores.push(() => {
                if (Object.getOwnPropertyDescriptor(prototype, name)?.value === value)
                    Object.defineProperty(prototype, name, descriptor);
            });
            return descriptor.value;
        };
        const eventPrototype = realm.EventTarget.prototype;
        const nativeAdd = eventPrototype.addEventListener, nativeRemove = eventPrototype.removeEventListener;
        patch(eventPrototype, 'addEventListener', function (type, callback, options) {
            'use strict';
            // A bare global addEventListener call must retain this child Window.
            // A non-strict wrapper created in the parent would default to the parent.
            const target = this === undefined ? view : this;
            if (!callback || target.nodeType !== 1 || !actionTypes.has(type))
                return nativeAdd.call(target, type, callback, options);
            const element = target;
            // Read WebIDL option getters once. Browser registration remains authoritative.
            const config = options !== null && (typeof options === 'object' || typeof options === 'function') ? {
                capture: !!options.capture, once: !!options.once,
                passive: options.passive, signal: options.signal
            } : !!options;
            const capture = typeof config === 'boolean' ? config : !!config?.capture;
            const previous = listenerFacts.get(element)?.find(fact => fact.type === type && fact.callback === callback && fact.capture === capture);
            if (previous)
                return nativeAdd.call(target, type, previous.effective, config);
            const fact = { type, callback, capture, effective: callback };
            if (typeof config === 'object' && config.once)
                fact.effective = function (event) {
                    retire(element, fact);
                    if (typeof callback === 'function')
                        callback.call(this, event);
                    else
                        callback.handleEvent(event);
                };
            nativeAdd.call(target, type, fact.effective, config);
            if (typeof config === 'object' && config.signal?.aborted)
                return;
            const facts = listenerFacts.get(element) ?? [];
            facts.push(fact);
            listenerFacts.set(element, facts);
            if (typeof config === 'object' && config.signal) {
                // Native abort propagation survives a child realm's navigation. A JS
                // listener on that retired child's signal no longer receives events.
                fact.signal = AbortSignal.any([config.signal]);
                const target = new WeakRef(element), registration = new WeakRef(fact);
                fact.abort = () => { const node = target.deref(), record = registration.deref(); if (node && record)
                    retire(node, record); };
                fact.signal.addEventListener('abort', fact.abort, { once: true });
                abortSubscriptions.set(fact.abort, new WeakRef(fact.signal));
            }
            eventChanged(element);
        });
        patch(eventPrototype, 'removeEventListener', function (type, callback, options) {
            'use strict';
            const target = this === undefined ? view : this;
            if (target.nodeType !== 1 || !actionTypes.has(type))
                return nativeRemove.call(target, type, callback, options);
            const capture = typeof options === 'object' || typeof options === 'function' ? !!options?.capture : !!options, element = target;
            const fact = listenerFacts.get(element)?.find(value => value.type === type && value.callback === callback && value.capture === capture);
            nativeRemove.call(target, type, fact?.effective ?? callback, capture);
            if (fact)
                retire(element, fact);
        });
        for (const prototype of [realm.HTMLElement.prototype, realm.SVGElement.prototype])
            for (const type of actionTypes) {
                const name = 'on' + type, descriptor = Object.getOwnPropertyDescriptor(prototype, name);
                if (!descriptor?.set)
                    continue;
                const setter = function (value) { descriptor.set.call(this, value); eventChanged(this); };
                Object.defineProperty(prototype, name, { ...descriptor, set: setter });
                restores.push(() => {
                    if (Object.getOwnPropertyDescriptor(prototype, name)?.set === setter)
                        Object.defineProperty(prototype, name, descriptor);
                });
            }
        const elementPrototype = realm.Element.prototype, nativeAttach = elementPrototype.attachShadow;
        patch(elementPrototype, 'attachShadow', function (options) {
            const root = nativeAttach.call(this, options);
            if (owned(this)) {
                changedDescendants(this);
                if (root.mode === 'open') {
                    shadowRoots.add(root);
                    observer.observe(root, observation);
                    root.addEventListener('slotchange', slotChanged);
                    discover(root);
                }
                register(this);
                labelChanged(this);
                refreshControls();
            }
            return root;
        });
        const nativeSet = elementPrototype.setPointerCapture, nativeRelease = elementPrototype.releasePointerCapture, nativeHas = elementPrototype.hasPointerCapture;
        patch(elementPrototype, 'setPointerCapture', function (id) {
            if (!press || press.id !== id)
                return nativeSet.call(this, id);
            if (!this.isConnected)
                throw new DOMException('The capture target is disconnected', 'InvalidStateError');
            if (press.down)
                press.pending = this;
        });
        patch(elementPrototype, 'releasePointerCapture', function (id) {
            if (!press || press.id !== id)
                return nativeRelease.call(this, id);
            if (press.pending === this)
                press.pending = undefined;
        });
        patch(elementPrototype, 'hasPointerCapture', function (id) {
            return press?.id === id ? press.pending === this : nativeHas.call(this, id);
        });
        realmHooks.set(elementPrototype, () => { for (const restore of restores.reverse())
            restore(); });
    };
    hookRealm(window);
    const frames = new Map(), frameSync = new Map();
    const releaseFrame = (id) => { frames.get(id)?.(); frames.delete(id); };
    const watchFrame = (id, frame) => {
        releaseFrame(id);
        let prototype;
        const sync = () => {
            const view = frame.contentDocument?.defaultView;
            const next = view ? view.Element.prototype : undefined;
            if (next === prototype)
                return;
            if (prototype) {
                realmHooks.get(prototype)?.();
                realmHooks.delete(prototype);
            }
            prototype = next;
            if (view)
                hookRealm(view);
        };
        frameSync.set(frame, sync);
        frame.addEventListener('load', sync);
        frames.set(id, () => {
            frameSync.delete(frame);
            frame.removeEventListener('load', sync);
            if (prototype) {
                realmHooks.get(prototype)?.();
                realmHooks.delete(prototype);
            }
        });
    };
    // Native bootstrap sends this synchronously before any inline author Source.
    const earlyRealm = (event) => frameSync.get(event.detail)?.();
    addEventListener('nexttavern-author-realm-ready', earlyRealm);
    const dispose = () => {
        active = false;
        observer.disconnect();
        removeEventListener('nexttavern-author-realm-ready', earlyRealm);
        removeEventListener('resize', scheduleViewport);
        if (viewportCheck !== undefined)
            cancelAnimationFrame(viewportCheck);
        viewportFrames.clear();
        if (press) {
            press.pending = undefined;
            processCapture();
            press = undefined;
        }
        for (const [listener, signal] of abortSubscriptions)
            signal.deref()?.removeEventListener('abort', listener);
        abortSubscriptions.clear();
        controls.clear();
        elements.clear();
        descriptions.clear();
        changedControls.clear();
        labelReferences.clear();
        controlLabels.clear();
        ancestorControls.clear();
        controlAncestors.clear();
        for (const root of shadowRoots)
            root.removeEventListener('slotchange', slotChanged);
        shadowRoots.clear();
        controlSnapshot = [];
        for (const release of frames.values())
            release();
        frames.clear();
        for (const restore of realmHooks.values())
            restore();
        realmHooks.clear();
    };
    return { activate, watchFrame, releaseFrame, dispose };
}
