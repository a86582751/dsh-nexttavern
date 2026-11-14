// Generated from runtime/alpha3/src/core/roleplay-reader-native-origin.ts; edit the TypeScript source.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
/** Serves one public static bootstrap only. Each Surface permission group gets
 * a fresh hostname; Source snapshots, credentials and Core requests never enter it. */
export function createReaderNativeOriginService({ shellHtml, remoteOriginTemplate }) {
    if (remoteOriginTemplate !== undefined) {
        try {
            const first = new URL(remoteOriginTemplate.replaceAll('{nonce}', 'a'.repeat(32)));
            const second = new URL(remoteOriginTemplate.replaceAll('{nonce}', 'b'.repeat(32)));
            if (!remoteOriginTemplate.includes('{nonce}') || first.protocol !== 'https:' || second.protocol !== 'https:'
                || first.hostname === second.hostname)
                throw Error('template');
        }
        catch {
            throw Error('READER_NATIVE_ORIGIN_TEMPLATE_UNSUPPORTED');
        }
    }
    let server, listening, closing, disposed = false;
    function localPort() {
        return listening ??= new Promise((resolve, reject) => {
            server = createServer((request, response) => {
                if (request.method !== 'GET' || request.url !== '/reader-native/') {
                    response.writeHead(404);
                    response.end();
                    return;
                }
                response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                response.end(shellHtml);
            });
            const failed = (error) => reject(error);
            server.once('error', failed);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', failed);
                resolve(server.address().port);
            });
        });
    }
    return {
        async acquire() {
            if (disposed)
                throw Error('READER_NATIVE_ORIGIN_DISPOSED');
            const nonce = randomUUID().replaceAll('-', '');
            if (remoteOriginTemplate !== undefined)
                return { url: new URL(remoteOriginTemplate.replaceAll('{nonce}', nonce)).href };
            const port = await localPort();
            if (disposed)
                throw Error('READER_NATIVE_ORIGIN_DISPOSED');
            return { url: `http://${nonce}.localhost:${port}/reader-native/` };
        },
        dispose() {
            disposed = true;
            return closing ??= (async () => {
                if (!listening)
                    return;
                try {
                    await listening;
                }
                catch {
                    return;
                }
                await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            })();
        },
    };
}
