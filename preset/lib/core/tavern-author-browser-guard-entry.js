// Generated from runtime/alpha3/src/core/tavern-author-browser-guard-entry.ts; edit the TypeScript source.
/** Actual trusted guard entry. Its frame-src policy confines the opaque child;
 * it forwards one port and exposes no child WindowProxy to author code. */
export {};
const element = document.getElementById('owned-browser-guard-config');
if (!element?.textContent)
    throw Error('BROWSER_GUARD_CONFIGURATION_MISSING');
const config = JSON.parse(element.textContent);
const child = document.createElement('iframe');
child.sandbox.add('allow-scripts');
child.referrerPolicy = 'no-referrer';
child.title = 'Owned author browser';
child.style.cssText = 'display:block;width:100%;height:150px;border:0';
child.srcdoc = config.childDocument;
document.body.append(child);
let bound = false, loads = 0;
child.addEventListener('load', () => {
    if (++loads > 1)
        window.parent.postMessage({ v: 2, nonce: config.nonce, generation: config.generation, type: 'guard-failed' }, '*');
});
window.addEventListener('message', event => {
    const data = event.data;
    if (data?.v !== 2 || data.nonce !== config.nonce || data.generation !== config.generation)
        return;
    if (event.source === child.contentWindow && event.origin === 'null' && data.type === 'transport-ready') {
        window.parent.postMessage(data, '*');
        return;
    }
    if (event.source !== window.parent)
        return;
    if (data.type === 'bind' && !bound && event.ports?.[0]) {
        bound = true;
        child.contentWindow?.postMessage(data, '*', [event.ports[0]]);
    }
    else if (data.type === 'height' && Number.isFinite(data.height) && data.height >= 1 && data.height <= 2_000_000) {
        child.style.height = Math.ceil(data.height) + 'px';
    }
});
