import {BlockedError} from './model.mts';
import {isAbsolute} from 'node:path';
import {getSystemErrorName} from 'node:util';

export function flockLoaderDescription(): Record<string, unknown> {
  const path = process.env.NEXTTAVERN_FLOCK_ADDON;
  return path ? {loader: 'explicit-installed-native-dlopen', path, packageAPI: '0.1.2 callback tryLock -> Promise tryLockExclusive'}
    : {loader: 'upstream-package', package: '@deepseek-ai/node-addon-system/flock'};
}

function loaderError(error: unknown): never {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED', 'ERR_FLOCK_UNSUPPORTED_PLATFORM'].includes(code ?? '')) {
    throw new BlockedError('ADDON_UNAVAILABLE', `Native flock binding unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  throw error;
}

/** Exact public lease API, not a file-exists lock or successful no-op substitute. */
export async function loadFlock(): Promise<(fd: number) => Promise<void>> {
  const path = process.env.NEXTTAVERN_FLOCK_ADDON;
  if (path) {
    if (!isAbsolute(path)) throw new BlockedError('ADDON_PATH_INVALID', 'NEXTTAVERN_FLOCK_ADDON must be an absolute installer-provided native path');
    const native: {exports: {tryLock?: (fd: number, callback: (errno: number) => void) => void}} = {exports: {}};
    try {process.dlopen(native as NodeModule, path);} catch (error) {
      throw new BlockedError('ADDON_UNAVAILABLE', `Cannot dlopen installed flock addon ${path}: ${String(error)}`);
    }
    if (typeof native.exports.tryLock !== 'function') throw new BlockedError('ADDON_API_UNAVAILABLE', 'Native addon does not export callback tryLock(fd, callback)');
    return async fd => {
      const errno = await new Promise<number>(resolve => native.exports.tryLock!(fd, resolve));
      if (!Number.isInteger(errno) || errno < 0) throw new Error(`Invalid native flock errno ${errno}`);
      if (errno === 0) return;
      const code = getSystemErrorName(-errno);
      throw Object.assign(new Error(`${code}: flock failed`), {code, errno, syscall: 'flock'});
    };
  }
  const specifier = '@deepseek-ai/node-addon-system/flock';
  let module: {tryLockExclusive?: unknown};
  try {
    module = await import(specifier);
  } catch (error) {
    throw new BlockedError('ADDON_UNAVAILABLE', `Cannot load ${specifier}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof module.tryLockExclusive !== 'function') {
    throw new BlockedError('ADDON_API_UNAVAILABLE', `${specifier} does not export tryLockExclusive(fd)`);
  }
  const tryLock = module.tryLockExclusive as (fd: number) => Promise<void>;
  // Upstream loads its native binary lazily, so classify failures at invocation too.
  return async fd => {try {await tryLock(fd);} catch (error) {loaderError(error);}};
}
