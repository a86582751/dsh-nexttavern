/** Shared installer-owned Android Node-API binding; never loads during import. */
export interface AndroidSystemBinding {
  tryLock(fd: number, callback: (errno: number) => void): void
  publishNoReplace(source: string, target: string, callback: (errno: number) => void): void
}

let binding: AndroidSystemBinding | undefined
export function loadAndroidBinding(): AndroidSystemBinding {
  if (binding) return binding
  const path = process.env.NEXTTAVERN_FLOCK_ADDON
  if (!path) throw new Error('Android system primitives requires NEXTTAVERN_FLOCK_ADDON from the native supervisor')
  const native = {exports: {}}
  process.dlopen(native as NodeModule, path)
  binding = native.exports as AndroidSystemBinding
  return binding
}
