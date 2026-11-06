// Generated from runtime/alpha3/src/core/tavern-author-reader-surface.ts; edit the TypeScript source.
import { createReaderDocumentLayoutSettings } from './tavern-author-reader-document-layout.js';
import { createReaderNativeBeautyFrame } from '../ui/reader-native-beauty-frame.js';
export function createAuthorReaderSurface(outer, options) {
    const documentLayout = createReaderDocumentLayoutSettings();
    const view = outer.ownerDocument.defaultView, rows = new Map(), containers = new Map();
    let active = true, document, root, style;
    let pending, renderRevision = 0, layoutFrame;
    let latestRender, beautyExecution;
    let beautyRunKey = '', beautyIdentity = '', beautyFill = () => { };
    let beauty, beautyHost;
    let lastDocumentHeights = {};
    const staticSlots = new Map();
    let actionHeights = {};
    let resize, mutation;
    let helperTail = Promise.resolve();
    let readerProgram = '';
    const failures = new Map();
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // The view may close before an Actor begins awaiting its document.
    void ready.catch(() => { });
    const current = () => active && options.current();
    function failureView(node, code, html, waiting = false) {
        const message = document.createElement('p');
        message.setAttribute('role', waiting ? 'status' : 'alert');
        message.className = 'rp-reader-document-error';
        message.textContent = waiting ? '作者文档编译服务暂不可用：' + code + '。请重试显示编译。'
            : '作者文档不可用：' + code + '。请修复失败文档后刷新视图。';
        node.replaceChildren(message);
        let preview, details;
        const open = () => {
            if (!details?.open || preview)
                return;
            const target = document.createElement('div');
            details.appendChild(target);
            if (options.mountStaticDocument)
                preview = options.mountStaticDocument(target, html, scheduleLayout);
            else {
                const raw = document.createElement('pre');
                raw.textContent = html;
                target.appendChild(raw);
                preview = { dispose() { } };
            }
            scheduleLayout();
        };
        if (html) {
            details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = '查看静态内容（脚本未运行）';
            details.appendChild(summary);
            details.addEventListener('toggle', open);
            node.appendChild(details);
        }
        return { dispose() { details?.removeEventListener('toggle', open); preview?.dispose(); } };
    }
    function showFailure(plan, node) {
        const failure = failures.get(plan);
        if (!failure || failure.node === node)
            return;
        failure.view?.dispose();
        failure.node = node;
        failure.view = failureView(node, failure.code);
    }
    function sameFragmentShape(before, after) {
        return before.length === after.length && before.every((fragment, index) => {
            const next = after[index];
            if (fragment.kind === 'text')
                return next.kind === 'text';
            if (fragment.kind === 'reader-document')
                return next.kind === 'reader-document'
                    && fragment.documentPlanSha256 === next.documentPlanSha256;
            if (fragment.kind === 'static-document')
                return next.kind === 'static-document' && fragment.html === next.html;
            return next.kind === fragment.kind && fragment.code === next.code && fragment.html === next.html;
        });
    }
    function fragmentNode(fragment, row) {
        const node = document.createElement('div');
        if (fragment.kind === 'text') {
            if (!beautyExecution)
                node.innerHTML = fragment.html;
            row.textFragments.push({ node, html: fragment.html });
        }
        else if (fragment.kind === 'static-document') {
            const slot = { html: fragment.html, view: !beautyExecution
                    ? options.mountStaticDocument(node, fragment.html, scheduleLayout) : undefined };
            staticSlots.set(node, slot);
            row.staticDocuments.push({ dispose() { slot.view?.dispose(); staticSlots.delete(node); } });
        }
        else if (fragment.kind === 'failed-document' || fragment.kind === 'pending-document')
            row.staticDocuments.push(failureView(node, fragment.code, fragment.html, fragment.kind === 'pending-document'));
        else {
            node.dataset.readerRegexDocument = fragment.documentPlanSha256;
            containers.set(fragment.documentPlanSha256, node);
            row.documentPlans.push(fragment.documentPlanSha256);
            showFailure(fragment.documentPlanSha256, node);
        }
        row.fragmentNodes.push(node);
        return node;
    }
    function scheduleLayout() {
        if (!current() || layoutFrame !== undefined)
            return;
        layoutFrame = view.requestAnimationFrame(() => {
            layoutFrame = undefined;
            if (!current() || !document)
                return;
            if (beautyExecution) {
                publishBeautySlots();
                return;
            }
            const body = document.body, bounds = body.getBoundingClientRect(), top = bounds.top;
            // Content bounds can shrink; body.scrollHeight retains the old viewport.
            const height = Math.ceil(Array.from(body.children).reduce((height, element) => Math.max(height, element.getBoundingClientRect().bottom - top), 0));
            const positions = Object.fromEntries(Array.from(rows, ([key, row]) => {
                const slot = row.actions.getBoundingClientRect();
                return [key, { top: slot.top - top, left: slot.left - bounds.left, width: slot.width }];
            }));
            outer.style.height = height + 'px';
            options.layout({ height, renderRevision, rows: positions });
        });
    }
    function publishBeautySlots() {
        const heights = Object.fromEntries([...containers].map(([key, node]) => [key, Math.ceil(node.getBoundingClientRect().height)]));
        const changed = Object.keys(heights).length !== Object.keys(lastDocumentHeights).length
            || Object.entries(heights).some(([key, value]) => lastDocumentHeights[key] !== value);
        if (!changed)
            return;
        lastDocumentHeights = heights;
        beauty?.slots(actionHeights, heights);
    }
    function beautyLayout(value) {
        if (!current() || !beautyExecution || value.revision !== renderRevision)
            return;
        for (const [plan, node] of containers) {
            const slot = value.documents[plan];
            node.style.visibility = slot ? 'visible' : 'hidden';
            if (slot) {
                node.style.top = slot.top + 'px';
                node.style.left = slot.left + 'px';
                node.style.width = slot.width + 'px';
            }
        }
        outer.style.height = value.height + 'px';
        options.layout({ height: value.height, renderRevision, rows: value.rows });
    }
    function syncBeauty() {
        if (!document || !root)
            return;
        if (!beautyExecution && !beauty)
            return;
        const viewport = root.parentElement;
        viewport.style.position = beautyExecution ? 'absolute' : '';
        viewport.style.inset = beautyExecution ? '0' : '';
        viewport.style.zIndex = beautyExecution ? '1' : '';
        viewport.style.visibility = beautyExecution ? 'hidden' : '';
        viewport.style.width = beautyExecution ? '100%' : '';
        viewport.style.overflow = beautyExecution ? 'visible' : '';
        root.style.visibility = beautyExecution ? 'hidden' : '';
        root.style.transform = beautyExecution ? 'none' : '';
        root.style.overflow = beautyExecution ? 'visible' : '';
        for (const row of rows.values()) {
            row.node.style.display = beautyExecution ? 'contents' : '';
            row.actions.style.display = beautyExecution ? 'none' : '';
            const body = row.node.firstElementChild;
            if (body)
                body.style.display = beautyExecution ? (row.documentPlans.length ? 'contents' : 'none') : '';
            for (const fragment of row.fragmentNodes)
                if (!fragment.dataset.readerRegexDocument)
                    fragment.style.display = beautyExecution ? 'none' : '';
        }
        for (const node of containers.values()) {
            node.style.position = beautyExecution ? 'absolute' : '';
            if (!beautyExecution) {
                node.style.visibility = '';
                node.style.top = '';
                node.style.left = '';
                node.style.width = '';
            }
            else if (!beauty)
                node.style.visibility = 'hidden';
        }
        if (!beautyExecution) {
            beauty?.dispose();
            beauty = undefined;
            beautyHost?.remove();
            beautyHost = undefined;
            beautyIdentity = '';
            return;
        }
        const identity = beautyExecution.source.sessionId + '\0' + beautyExecution.source.rulesRecordSha256;
        if (identity !== beautyIdentity || !beauty) {
            beauty?.dispose();
            beautyHost?.remove();
            beautyIdentity = identity;
            beautyHost = document.createElement('div');
            beautyHost.style.cssText = 'position:relative;width:100%';
            document.body.append(beautyHost);
            beauty = createReaderNativeBeautyFrame(beautyHost, beautyExecution, {
                current, fill: text => beautyFill(text), layout: beautyLayout,
                failed: code => {
                    // Losing the author realm must not erase the canonical Reader body.
                    // Restore the inert surface; this never executes Source JS in Main.
                    setNativeBeauty(undefined, '', beautyFill);
                    scheduleLayout();
                    console.warn('[roleplay-reader] Native beauty JS:', code);
                }
            });
            lastDocumentHeights = {};
        }
        publishBeautySlots();
        beauty.slots(actionHeights, lastDocumentHeights);
        if (latestRender)
            beauty.render(latestRender, beautyRunKey);
    }
    function setNativeBeauty(execution, runKey, fill) {
        const changed = !!beautyExecution !== !!execution;
        const runChanged = beautyRunKey !== runKey || beautyExecution?.source.rulesRecordSha256 !== execution?.source.rulesRecordSha256;
        beautyExecution = execution;
        beautyRunKey = runKey;
        beautyFill = fill;
        if (changed)
            for (const row of rows.values())
                for (const fragment of row.textFragments) {
                    if (execution)
                        fragment.node.replaceChildren();
                    else
                        fragment.node.innerHTML = fragment.html;
                }
        if (changed)
            for (const [node, slot] of staticSlots) {
                slot.view?.dispose();
                slot.view = execution ? undefined : options.mountStaticDocument(node, slot.html, scheduleLayout);
            }
        if (runChanged && execution) {
            for (const node of containers.values())
                node.style.visibility = 'hidden';
            options.layout({ height: outer.getBoundingClientRect().height, renderRevision, rows: {} });
        }
        if (!execution)
            syncBeauty();
    }
    function releaseRow(row) {
        for (const child of row.staticDocuments)
            child.dispose();
        for (const plan of row.documentPlans) {
            containers.delete(plan);
            const failure = failures.get(plan);
            if (failure) {
                failure.view?.dispose();
                delete failure.view;
                delete failure.node;
            }
        }
        row.staticDocuments = [];
        row.documentPlans = [];
        row.textFragments = [];
        row.fragments = undefined;
        row.fragmentNodes = [];
    }
    function render(value) {
        if (!current())
            return;
        latestRender = value;
        if (!root || !style || !document) {
            pending = value;
            return;
        }
        renderRevision = value.renderRevision;
        const css = value.css + '\nhtml,body{margin:0;overflow:hidden}' +
            '.rp-reader-view{min-height:0;overflow:visible;display:block}';
        if (style.textContent !== css)
            style.textContent = css;
        const next = new Set(value.parts.map(part => part.key));
        for (const [key, row] of rows)
            if (!next.has(key)) {
                releaseRow(row);
                row.node.remove();
                rows.delete(key);
            }
        let cursor = root.firstChild;
        for (const part of value.parts) {
            const fragments = part.kind === 'narrator' && 'fragments' in part ? part.fragments : undefined;
            const content = part.kind === 'user' ? part.text : fragments ? JSON.stringify(fragments) : part.html;
            let row = rows.get(part.key);
            if (!row) {
                const node = document.createElement('section');
                node.className = 'rp-reader-message';
                node.dataset.readerKey = part.key;
                const actions = document.createElement('div');
                actions.className = 'rp-reader-action-space';
                actions.setAttribute('aria-hidden', 'true');
                actions.style.height = (actionHeights[part.key] ?? 0) + 'px';
                row = { node, actions, kind: part.kind, content: '', staticDocuments: [], documentPlans: [], textFragments: [], fragmentNodes: [] };
                rows.set(part.key, row);
            }
            // Text around a live document can change without changing that program.
            // Keep its ancestor nodes in place: moving an iframe would reload it.
            if (row.kind === part.kind && fragments && row.fragments && sameFragmentShape(row.fragments, fragments)) {
                row.textFragments = [];
                for (const [index, fragment] of fragments.entries())
                    if (fragment.kind === 'text') {
                        const node = row.fragmentNodes[index];
                        if (!beautyExecution && row.fragments[index].kind === 'text' && row.fragments[index].html !== fragment.html)
                            node.innerHTML = fragment.html;
                        row.textFragments.push({ node, html: fragment.html });
                    }
                row.fragments = fragments;
                row.content = content;
            }
            else if (row.kind === 'narrator' && part.kind === 'narrator' && fragments && row.fragments && row.node.firstChild) {
                const plans = fragments.flatMap(fragment => fragment.kind === 'reader-document' ? [fragment.documentPlanSha256] : []);
                if (plans.length === row.documentPlans.length && plans.every((plan, index) => row.documentPlans[index] === plan)) {
                    // Only non-executable siblings change. Retain each document's real
                    // parent in the DOM instead of moving it through a rebuilt row.
                    for (const child of row.staticDocuments)
                        child.dispose();
                    for (const [index, fragment] of row.fragments.entries())
                        if (fragment.kind !== 'reader-document')
                            row.fragmentNodes[index].remove();
                    row.staticDocuments = [];
                    row.textFragments = [];
                    row.fragmentNodes = [];
                    const body = row.node.firstChild;
                    let anchor = body.firstChild;
                    for (const fragment of fragments) {
                        if (fragment.kind === 'reader-document') {
                            const node = containers.get(fragment.documentPlanSha256);
                            row.fragmentNodes.push(node);
                            anchor = node.nextSibling;
                        }
                        else
                            body.insertBefore(fragmentNode(fragment, row), anchor);
                    }
                    row.fragments = fragments;
                    row.content = content;
                }
            }
            if (!row.node.firstChild || row.kind !== part.kind || row.content !== content) {
                releaseRow(row);
                const body = document.createElement(part.kind === 'user' ? 'p' : 'div');
                body.className = part.kind === 'user' ? 'rp-user-line' : 'rp-reader-narrative';
                if (part.kind === 'user')
                    body.textContent = '◈ 你：' + part.text;
                else if (fragments)
                    for (const fragment of fragments)
                        body.appendChild(fragmentNode(fragment, row));
                else {
                    if (!beautyExecution)
                        body.innerHTML = part.html;
                    row.textFragments.push({ node: body, html: part.html });
                }
                row.node.replaceChildren(body, row.actions);
                row.node.dataset.kind = part.kind === 'user' ? 'user' : 'assistant';
                row.kind = part.kind;
                row.content = content;
                row.fragments = fragments;
            }
            // Keep unchanged media and Source documents in place across captures.
            if (row.node !== cursor)
                root.insertBefore(row.node, cursor);
            cursor = row.node.nextSibling;
        }
        syncBeauty();
        scheduleLayout();
    }
    function loaded() {
        if (!current() || document)
            return;
        document = outer.contentDocument;
        document.open();
        document.write(readerSurfaceInertShell(options.nativeDocuments));
        document.close();
        style = document.createElement('style');
        document.head.append(style);
        const viewport = document.createElement('div');
        viewport.className = 'rp-reader-view';
        root = document.createElement('div');
        root.className = 'rp-reader';
        viewport.append(root);
        document.body.append(viewport);
        resize = new view.ResizeObserver(scheduleLayout);
        resize.observe(document.body);
        mutation = new view.MutationObserver(scheduleLayout);
        mutation.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        if (pending) {
            const value = pending;
            pending = undefined;
            render(value);
        }
        resolveReady(document);
    }
    // Descendant scripts inherit this flag. The Surface's own CSP keeps its raw
    // markup inert while native author documents retain their opaque sandbox.
    outer.setAttribute('sandbox', 'allow-same-origin allow-forms' + (options.nativeDocuments ? ' allow-scripts' : ''));
    outer.style.cssText = 'display:block;width:100%;height:620px;border:0';
    outer.addEventListener('load', loaded);
    outer.src = 'about:blank';
    return { outer, ready, render, scheduleLayout, documentLayout, setNativeBeauty, async acquireHelperLease() {
            const previous = helperTail;
            let unlock;
            const released = new Promise(resolve => { unlock = resolve; });
            helperTail = previous.then(() => released);
            await previous;
            if (!active) {
                unlock();
                throw Error('READER_SURFACE_CLOSED');
            }
            let done = false;
            return { release() {
                    if (done)
                        return;
                    done = true;
                    try {
                        // The normalized Source render belongs to the current entries. Restore
                        // only these text fragments; replacing a row discarded its old entry,
                        // and independent regex documents/frames remain untouched.
                        if (active)
                            for (const row of rows.values())
                                for (const fragment of row.textFragments)
                                    if (row.node.contains(fragment.node) && fragment.node.innerHTML !== fragment.html)
                                        fragment.node.innerHTML = fragment.html;
                    }
                    finally {
                        unlock();
                    }
                } };
        }, setActionHeights(value) {
            const previous = actionHeights;
            actionHeights = value;
            let changed = false;
            for (const [key, row] of rows) {
                const height = value[key] ?? 0;
                // Only a changed toolbar height needs another document layout. Measuring
                // the same React row again must not create a resize/render feedback loop.
                // CSSOM rounds fractional pixel strings; compare Main's owned numbers.
                if ((previous[key] ?? 0) !== height) {
                    row.actions.style.height = height + 'px';
                    changed = true;
                }
            }
            if (changed) {
                beauty?.slots(actionHeights, lastDocumentHeights);
                scheduleLayout();
            }
            return layoutFrame !== undefined;
        }, documentContainer: plan => containers.get(plan), setReaderProgram(identity) {
            if (readerProgram === identity)
                return;
            readerProgram = identity;
            for (const failure of failures.values()) {
                failure.view?.dispose();
                failure.node?.replaceChildren();
            }
            failures.clear();
        }, failDocument(plan, code) {
            const node = containers.get(plan);
            if (!current() || !document || failures.get(plan)?.code === code)
                return;
            failures.get(plan)?.view?.dispose();
            failures.set(plan, { code });
            if (node)
                showFailure(plan, node);
            scheduleLayout();
        }, dispose() {
            if (!active)
                return;
            active = false;
            outer.removeEventListener('load', loaded);
            beauty?.dispose();
            beautyHost?.remove();
            beauty = undefined;
            beautyExecution = undefined;
            resize?.disconnect();
            mutation?.disconnect();
            if (layoutFrame !== undefined)
                view.cancelAnimationFrame(layoutFrame);
            for (const row of rows.values())
                releaseRow(row);
            for (const failure of failures.values())
                failure.view?.dispose();
            failures.clear();
            rows.clear();
            containers.clear();
            pending = undefined;
            rejectReady(Error('READER_SURFACE_CLOSED'));
            outer.removeAttribute('src');
            outer.removeAttribute('srcdoc');
        } };
}
export function readerSurfaceInertShell(nativeDocuments = false) {
    return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" ' +
        'content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\' https:; ' +
        'img-src data: blob: https:; media-src data: blob: https:; font-src data: https:; ' +
        'connect-src http: https:; frame-src about:' + (nativeDocuments ? ' http: https:' : '') + '; form-action \'none\'"></head><body></body></html>';
}
