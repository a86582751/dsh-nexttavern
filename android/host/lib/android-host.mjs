// Generated from android/host/android-host.mts; edit the TypeScript source.
/** Private native-pipe readiness/stop bridge; it does not own turn completion. */
import { createInterface } from 'node:readline';
import { auditStartupEntries, getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot';
export const name = 'nexttavern-mobile-host';
export const inject = ['connection', 'webServer'];
export const PROTOCOL = 'nexttavern-mobile-v1';
export function apply(ctx) {
    const generation = process.env.NEXTTAVERN_GENERATION;
    if (!generation)
        throw new Error('NEXTTAVERN_GENERATION must be supplied by the native supervisor');
    let disposed = false;
    let stopping = false;
    const emit = (event) => {
        // This dedicated protocol pipe is private to the native supervisor. Never
        // send the authenticated URL through console or an ordinary diagnostic log.
        process.stdout.write(JSON.stringify({ protocol: PROTOCOL, generation, pid: process.pid, ...event }) + '\n');
    };
    const reader = createInterface({ input: process.stdin, terminal: false });
    const onLine = (line) => {
        let command;
        try {
            command = JSON.parse(line);
        }
        catch {
            return;
        }
        if (!command || command.protocol !== PROTOCOL || command.generation !== generation
            || command.command !== 'stop' || stopping)
            return;
        stopping = true;
        // Stop actual product owners before Cordis begins concurrent provider
        // disposal. Cancellation/settlement is interruption, not turn success.
        void (async () => {
            await ctx.get('tavernConversations')?.stopOwnedWork();
            await ctx.root.fiber.dispose();
        })().then(() => {
            emit({ event: 'STOPPED', completion: 'interrupted', drained: false });
        }).catch(() => {
            emit({ event: 'ERROR', phase: 'stop', code: 'HOST_STOP_FAILED' });
        });
    };
    reader.on('line', onLine);
    ctx.effect(() => () => {
        disposed = true;
        reader.off('line', onLine);
        reader.close();
    }, 'nexttavern mobile private command pipe');
    // Never await Loader settlement inside plugin activation: Loader also waits
    // for this activation. Follow the pinned web-app's detached readiness path.
    const settled = ctx.get('loader')?.await() ?? Promise.resolve();
    void settled.then(async () => {
        await auditStartupEntries(ctx.root, 'nexttavern mobile', () => { });
        if (disposed || stopping)
            return;
        const product = ctx.get('tavernConversations');
        if (!product)
            throw new Error('NextTavern conversation service is not active');
        await product.ready;
        if (disposed || stopping)
            return;
        const url = ctx.connection.authenticatedUrl(`http://127.0.0.1:${ctx.webServer.port}`);
        emit({ event: 'READY', url, hostVersion: getDshRuntimeVersion() });
    }).catch(() => {
        // Startup errors may carry URLs or other private configuration. The Host
        // owns detailed diagnostics; this protocol reports only a safe category.
        if (!disposed && !stopping)
            emit({ event: 'ERROR', phase: 'startup', code: 'HOST_STARTUP_FAILED' });
    });
}
