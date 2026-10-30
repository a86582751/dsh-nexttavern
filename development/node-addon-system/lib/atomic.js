// Generated from runtime/alpha3/compat/node-addon-system/src/atomic.ts; edit the TypeScript source.
import { getSystemErrorName } from 'node:util';
import { loadAndroidBinding } from './android-binding.js';
/**
 * Android atomic no-clobber publication. Success consumes source; EEXIST
 * preserves source and target. The caller owns file/directory fsync and must
 * await the queued syscall before releasing or cleaning either path.
 */
export async function publishNoReplace(source, target) {
    if (process.platform !== 'android')
        throw Object.assign(new Error('Android no-clobber publication is unavailable on this platform'), {
            code: 'ERR_ATOMIC_PUBLISH_UNSUPPORTED_PLATFORM', syscall: 'renameat2',
        });
    const errno = await new Promise(resolve => loadAndroidBinding().publishNoReplace(source, target, resolve));
    if (errno === 0)
        return;
    const code = getSystemErrorName(-errno);
    throw Object.assign(new Error(`${code}: renameat2(RENAME_NOREPLACE) failed`), { code, errno, syscall: 'renameat2' });
}
