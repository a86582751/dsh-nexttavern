/** Keep the upstream Promise contract while loading APK-installed flock on Android. */
import { getSystemErrorName } from 'node:util'
import { tryLockExclusive as tryLockExclusiveUpstream } from '@deepseek-ai/node-addon-system/flock'

interface AndroidBinding {
  tryLock(fd: number, callback: (errno: number) => void): void
}

let androidBinding: AndroidBinding | undefined

function loadAndroidBinding(): AndroidBinding {
  if (androidBinding) return androidBinding
  // The native supervisor supplies the current installer's nativeLibraryDir.
  // Upstream 0.1.2's JS loader only recognizes Linux/Darwin; its unmodified
  // Node-API C binding still performs real LOCK_EX | LOCK_NB on Android/Bionic.
  const path = process.env.NEXTTAVERN_FLOCK_ADDON
  if (!path) throw new Error('Android flock requires NEXTTAVERN_FLOCK_ADDON from the native supervisor')
  const native = { exports: {} }
  process.dlopen(native as NodeModule, path)
  androidBinding = native.exports as AndroidBinding
  return androidBinding
}

async function tryLockExclusiveAndroid(fd: number): Promise<void> {
  const errno = await new Promise<number>((resolve) => {
    loadAndroidBinding().tryLock(fd, resolve)
  })
  if (errno === 0) return
  const code = getSystemErrorName(-errno)
  throw Object.assign(new Error(`${code}: flock failed`), { code, errno, syscall: 'flock' })
}

/** The caller owns fd until settlement; closing it releases the kernel lock. */
export function tryLockExclusive(fd: number): Promise<void> {
  return process.platform === 'android' ? tryLockExclusiveAndroid(fd) : tryLockExclusiveUpstream(fd)
}
