// Generated from runtime/alpha3/src/ui/pending-opening-source-host.ts; edit the TypeScript source.
import { createAuthorBrowserSession } from './author-browser-session.js';
/** The opening operation owns this temporary child Source attachment while
 * the player's selected conversation continues to show its parent. */
export function createPendingOpeningSourceHost(input, options) {
    const container = options.document.createElement('div');
    container.dataset.pendingOpeningOperation = input.operationId;
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    options.document.body.append(container);
    const lifetime = new AbortController();
    let active = true, started = false, retryAttach = false, timer;
    let claim, unsubscribe;
    const current = () => active && options.current();
    const controller = (options.createSession ?? createAuthorBrowserSession)({
        sessionId: input.childSessionId, container, current, nativeLibraries: options.nativeLibraries,
        reportExtensionFailure: options.reportExtensionFailure,
        commandUi: options.commandUi, preparation: state => claim?.publish(state), status(value) {
            retryAttach = value.kind === 'inactive'
                && (value.code === 'BROWSER_SESSION_INACTIVE' || value.code === 'BROWSER_PROGRAM_UNAVAILABLE');
            clearTimeout(timer);
            timer = undefined;
            if (started && retryAttach)
                schedule();
            if (value.kind === 'failed') {
                options.failed?.(value.code ?? 'AUTHOR_NATIVE_SOURCE_FAILED');
                dispose();
            }
        },
    });
    unsubscribe = options.subscribeCurrent?.(() => { if (!current())
        dispose(); });
    function dispose() {
        if (!active)
            return;
        active = false;
        lifetime.abort();
        clearTimeout(timer);
        unsubscribe?.();
        claim?.dispose();
        controller.dispose();
        container.remove();
    }
    async function refresh() {
        if (!current()) {
            dispose();
            return;
        }
        await controller.refresh();
    }
    function schedule() {
        if (!current()) {
            dispose();
            return;
        }
        if (timer || !retryAttach || controller.hasFrame())
            return;
        timer = setTimeout(() => { timer = undefined; void poll(); }, 300);
    }
    async function poll() {
        if (!current()) {
            dispose();
            return;
        }
        try {
            if (retryAttach && !controller.hasFrame())
                await refresh();
        }
        catch {
            dispose();
        }
        finally {
            schedule();
        }
    }
    return { refresh, dispose, signal: lifetime.signal, async prepareOpening(index, handoff) {
            claim = handoff.mount(input.childSessionId, selectedIndex => controller.prepareSource(selectedIndex));
            try {
                const ticket = await handoff.prepareSource(input.childSessionId, index);
                return { ...ticket, close() { ticket.close(); dispose(); } };
            }
            catch (error) {
                dispose();
                throw error;
            }
        }, start() {
            if (started || !active)
                return;
            started = true;
            // Starting is deliberately asynchronous. Awaiting Source readiness here
            // would prevent generate-opening from creating its hot Source owner.
            void controller.start().catch(() => { dispose(); }).finally(schedule);
        } };
}
