/** Product-level management. Only the official manager owns profile writes. */
export const NEXTTAVERN_BUNDLE = 'dsh-nexttavern'

export interface BundleState {
  name: string
  enabled: boolean
  rows: {rowId: string; moduleName: string}[]
  overrides: string[]
  readOnlyReason?: string
  error?: {code: string; message?: string; diagnostic?: string}
}

export interface BundleChange {
  application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'
  changed: boolean
  error?: {code: string; message?: string; diagnostic?: string}
}

/** The published manager provides both calls; absent capability has no fallback. */
export interface BundleManager {
  listBundles(): BundleState[] | Promise<BundleState[]>
  setBundleEnabled(name: string, enabled: boolean): Promise<BundleChange>
}

export interface ProductSnapshot {
  available: boolean
  selected: boolean | null
  reason?: string
  /** Historical result from this control instance, never a claim about current live state. */
  lastOperation?: Omit<BundleChange, 'changed'> & {changed: boolean | null; enabled: boolean; at: string}
}

export interface ProductSwitch {
  ok: boolean
  restart: boolean
  reason?: string
  product: ProductSnapshot
}

export function createNextTavernLifecycle(
  managerOf: () => BundleManager | undefined,
  hotReloadAvailable: () => boolean,
) {
  let lastManager: unknown
  let lastOperation: ProductSnapshot['lastOperation']

  const identity = (value: BundleManager | undefined): unknown => value
    ? Reflect.get(value, Symbol.for('cordis.original')) ?? value : undefined

  function manager() {
    const current = managerOf()
    // Do not carry an accepted result across service replacement or reload.
    // Cordis returns a fresh contextual proxy for each lookup. Compare its
    // public original identity, but keep calling through the contextual proxy.
    if (identity(current) !== lastManager) {
      lastManager = identity(current)
      lastOperation = undefined
    }
    return current
  }

  async function snapshot(): Promise<ProductSnapshot> {
    try {
      const current = manager()
      if (!current) return {available: false, selected: null, reason: 'This host does not provide bundle management / 此宿主不支持整包管理'}
      const bundle = (await current.listBundles()).find(row => row.name === NEXTTAVERN_BUNDLE)
      if (!bundle) return {available: false, selected: null, reason: 'NextTavern bundle is unavailable / 未找到 NextTavern 插件包'}
      // Native alpha.6 hot removal may report applied after original providers
      // failed to restart beside still-live replacements. Refuse BEFORE writes;
      // post-hoc verification cannot make that transaction restart-only.
      if (hotReloadAvailable()) return {available: false, selected: bundle.enabled, lastOperation,
        reason: 'Hot reload is active; stop the profile before switching bundles / 热重载已启用，请先停止 profile 再切换插件包'}
      const reason = bundle.readOnlyReason ?? bundle.error?.diagnostic ?? bundle.error?.message ?? bundle.error?.code
      // A malformed but selected bundle must remain deselectable. The manager
      // validates each requested operation; only its explicit protection blocks both.
      return {available: bundle.readOnlyReason === undefined, selected: bundle.enabled, reason, lastOperation}
    } catch (error) {
      return {available: false, selected: null, reason: error instanceof Error ? error.message : String(error)}
    }
  }

  async function switchEnabled(enabled: boolean): Promise<ProductSwitch> {
    const current = manager()
    const before = await snapshot()
    if (!before.available || !current) return {ok: false, restart: false, reason: before.reason, product: before}
    if (identity(manager()) !== identity(current)) {
      return {ok: false, restart: false, reason: 'Manager changed; retry / 管理器已更新，请重试', product: await snapshot()}
    }
    // snapshot awaits the bundle list; the host may have gained HMR meanwhile.
    if (hotReloadAvailable()) return {ok: false, restart: false, product: await snapshot(),
      reason: 'Hot reload became active; no change saved / 热重载已启用，未保存任何变更'}
    let change: Omit<BundleChange, 'changed'> & {changed: boolean | null}
    try {
      change = await current.setBundleEnabled(NEXTTAVERN_BUNDLE, enabled)
    } catch (error) {
      // An exception can follow a durable write. Do not invent unchanged disk state.
      change = {application: 'failed', changed: null,
        error: {code: 'manager-call-failed', message: error instanceof Error ? error.message : String(error)}}
    }
    if (identity(manager()) !== identity(current)) {
      return {ok: false, restart: false, reason: 'Manager changed; outcome unknown / 管理器已更新，结果未确认', product: await snapshot()}
    }
    lastOperation = {...change, enabled, at: new Date().toISOString()}
    const product = await snapshot()
    const ok = (change.application === 'applied' || change.application === 'restart-required')
      && product.selected === enabled && product.available
    return {ok, restart: change.application === 'restart-required', product,
      reason: ok ? undefined : change.error?.diagnostic ?? change.error?.message ?? change.error?.code ?? product.reason
        ?? 'Bundle change was not confirmed / 未确认整包操作成功'}
  }

  return {snapshot, switchEnabled}
}
