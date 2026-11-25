/** Product-owned Loader subtree. Native and replacement providers never overlap. */
import {Service, type Fiber, type FiberState, type Context} from '@deepseek-ai/cordis'
import {EntryTree, type EntryOptions} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-connection'
import {createRequire} from 'node:module'
import {readFileSync, realpathSync} from 'node:fs'
import {isAbsolute, relative, sep} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {capture, composition, loaderEntry, PRODUCT_ENTRY, productWanted, providerDisabledExpression,
  type CompositionState, type ProfilePlan} from './nexttavern-entry-policy.mjs'
import {inspectBundledPackages} from './bundled-package-bootstrap.mjs'
import {bindPackagePreparation, createOwnedPackagePreparation, relinkPreparedReferences,
  type PackagePreparationScheduler} from './nexttavern-package-preparation.mjs'
import {createOwnedMarketInstallation} from './nexttavern-market.mjs'
import {mountSettingsBridge, type RehomedSettingsRow, type SettingsBridge} from './nexttavern-settings-bridge.mjs'

const productRoot = fileURLToPath(new URL('../../', import.meta.url))
const productRequire = createRequire(new URL('../../package.json', import.meta.url))
const productMetadata: {peerDependencies?: Record<string, string>; bundleDependencies?: string[]} = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
// Cordis publishes this as an ambient const enum, with no runtime export.
// The member type verifies the numeric value against the pinned declaration.
const ACTIVE_FIBER_STATE: FiberState.ACTIVE = 2

function ownedModule(specifier: string): string {
  const resolved = realpathSync(specifier.startsWith('file:')
    ? fileURLToPath(specifier) : productRequire.resolve(specifier))
  const within = relative(realpathSync(productRoot), resolved)
  if (isAbsolute(within) || within === '..' || within.startsWith('../') || within.startsWith('..\\')) {
    throw Error(`NextTavern module resolved outside its product bundle: ${specifier}`)
  }
  return pathToFileURL(resolved).href
}

function addonModule(specifier: string): string {
  // Native declarations are shared host peers, not private replacement code.
  // The candidate inventory verifies their identity against the host before
  // activation. Other addons must still resolve inside the product bundle.
  if (specifier.startsWith('@deepseek-ai/') && productMetadata.peerDependencies?.[specifier]) {
    return pathToFileURL(realpathSync(productRequire.resolve(specifier))).href
  }
  return ownedModule(specifier)
}

export interface ProviderReplacement {
  id: string
  original: string
  replacement: string
}
export interface NextTavernEntryConfig {
  /** Supplied by the product bundle, never discovered by scanning node_modules. */
  providers: ProviderReplacement[]
  addons?: EntryOptions[]
  /** A host half inside this root package; never a second Loader/browser source. */
  host?: string
}

export default class NextTavernEntry extends EntryTree {
  private host: EntryTree
  private state: CompositionState
  private closing = false
  private stopping?: Promise<void>
  private released = false
  private epoch = 0
  private modules = new Map<string,string>()
  private hostFiber?: Fiber
  private settingsBridge?: SettingsBridge
  private preparation?: PackagePreparationScheduler
  private market?: PackagePreparationScheduler
  private setupStarted = false

  constructor(ctx: Context, private config: NextTavernEntryConfig) {
    // Capture before super attaches the product's subtree to its main entry.
    const host = loaderEntry(ctx).parent.tree
    const state = composition(ctx)
    // A native preset records its declaring context's base URL. Resolve its
    // child rows and resources from this installed product, never profile cwd.
    super(ctx.extend({baseUrl: pathToFileURL(productRoot + sep).href}))
    this.host = host
    this.state = state
    if (state.owner) throw Error('NextTavern already owns this profile')
    state.owner = this
    ctx.on('loader/patch-context', (entry, next) => {
      // Include starts new rows before removing old rows. Uninstall may remove
      // the conditional patch entirely, so native startup must drain us first.
      if (!this.released && entry.parent.tree === host && this.config.providers.some(provider =>
        provider.id === entry.options.id && provider.original === entry.options.name)) {
        throw Error('NextTavern provider restoration requires a completed product shutdown')
      }
      return next()
    }, {global: true})

    const owner = this
    ctx.on('internal/update', async function (candidate, next) {
      if (this.entry !== host.ctx.fiber.entry) return next()
      // Capture before Include applies the proposal. The host awaits this update,
      // including the product restart and the deferred Include reconciliation.
      const patches = (candidate as {patches?: unknown}).patches
      if (state.applyHostUpdate) throw Error('NextTavern profile update is still running; retry the profile update')
      const proposal = capture(ctx, patches)
      const ownedIntent = (plan: ProfilePlan) => ({
        selected: plan.selected,
        product: plan.rows.find(row => row.id === loaderEntry(owner.ctx).options.id),
        providers: owner.config.providers.map(provider => plan.provider({id:provider.id,module:provider.original})),
      })
      const before = ownedIntent(state.plan)
      const after = ownedIntent(proposal)
      const updates: (() => Promise<void>)[] = []
      const canUpdate = before.selected === after.selected && isDeepStrictEqual(before.product, after.product)
        && after.providers.every((provider, index) => {
          const previous = before.providers[index]
          if (isDeepStrictEqual(provider, previous)) return true
          if (!provider || !previous || !isDeepStrictEqual(provider.ancestors, previous.ancestors)) return false
          const {config: incoming, ...nextRow} = provider.row
          const {config: _config, ...previousRow} = previous.row
          if (!isDeepStrictEqual(nextRow, previousRow)) return false
          const entry = [...owner.entries()].find(row => row.options.id === nextRow.id)
          const update = entry && owner.settingsBridge?.providerUpdate(entry, incoming)
          if (!update) return false
          updates.push(update)
          return true
        })
      if (canUpdate) {
        // Native settings saves also update Include. Keep unrelated rows on
        // that normal path so a welcome/theme edit cannot revoke live Session
        // RPCs and browser scope adapters by restarting the entire product.
        const accepted = {plan:state.plan, patches:state.patches}
        state.plan = proposal
        state.patches = proposal.rows
        let result
        try {result = await next()} catch (error) {
          state.plan = accepted.plan
          state.patches = accepted.patches
          throw error
        }
        // Keep the new plan if a mounted update fails after Include committed.
        // ConfigEditor restores the file and reconciles against that committed plan.
        for (const update of updates) await update()
        return result
      }
      state.previousPlan = state.plan
      state.plan = proposal
      state.patches = proposal.rows
      state.applying = true
      // Defer Include's tree mutation until our old children have drained.
      // Otherwise Include starts an original provider before removing ours.
      let includeUpdate: Promise<void> | undefined
      state.applyHostUpdate = () => {
        includeUpdate = Promise.resolve(next())
        // Include can reject while the old product is still being disposed.
        // The enclosing update returns that rejection after the restart settles.
        void includeUpdate.catch(() => {})
      }
      await owner.ctx.fiber.restart()
      await includeUpdate
    }, {global: true, prepend: true})
  }

  /** Child edits belong to this transient subtree, never the profile file. */
  commit(): void {}

  override import(name: string, getOuterStack?: () => string[]) {
    return super.import(this.modules.get(name)??name, getOuterStack)
  }

  /**
   * The deferred writer for this install's durable package references. It never
   * runs inside the loading lifecycle: `reconcile` only inspects read-only, and
   * the returned scheduler acquires the host writer lock on a later turn.
   */
  private preparationState(): PackagePreparationScheduler {
    if (this.preparation) return this.preparation
    const {name: profile, home, installAnchor} = this.ctx.profileContext
    this.preparation = createOwnedPackagePreparation({
      productRoot, hostAnchor: installAnchor, home, profile,
      resolvePeerManifest: this.peerManifestResolver(),
      logger: this.ctx.logger,
    })
    return this.preparation
  }

  private peerManifestResolver() {
    const packages = this.ctx.get('pluginPackages')
    return packages ? (name: string, parentURL: string) => packages.packageOf(name, parentURL)?.manifestPath : undefined
  }

  /**
   * The deferred round that brings the upstream market onto a profile that does
   * not have one. It never runs inside the loading lifecycle, and it reads the
   * host's manager service late because that service may load after this one.
   */
  private marketState(): PackagePreparationScheduler {
    if (this.market) return this.market
    const profileContext = this.ctx.profileContext
    const {name: profile, home, installAnchor} = profileContext
    this.market = createOwnedMarketInstallation({
      productRoot, hostAnchor: installAnchor, home, profile,
      manager: () => this.ctx.get('pluginManager'),
      references: this.preparationState(),
      relink: async () => {
        const result = await relinkPreparedReferences(profileContext)
        const hmr = this.ctx.get('hmr')
        if (result === 'linked' && hmr) await hmr.runExclusive(() => hmr.reconcileProfile())
        return result
      },
      resolvePeerManifest: this.peerManifestResolver(),
      logger: this.ctx.logger,
    })
    return this.market
  }

  /**
   * The replaced provider rows as this activation mounted them, for the
   * settings bridge: each carries the id it kept and the profile-declared
     * specifier the official editor matches its document row by.
   */
  private rehomedSettingsRows(): RehomedSettingsRow[] {
    const declared = new Map(this.config.providers.map(provider => [provider.id, provider.original]))
    return [...this.entries()].flatMap(entry => {
      const original = declared.get(entry.options.id)
      // The id, not the current module, identifies a replacement: a settings
      // write presents the profile specifier on this very row for the length
      // of the write, and the row must stay addressable throughout.
      return original === undefined ? [] : [{id: entry.options.id, declared: original, entry}]
    })
  }

  private rows(): EntryOptions[] {
    const ids = new Set<string>()
    const modules = new Map<string,string>()
    const rows = this.config.providers.map(provider => {
      if (ids.has(provider.id)) throw Error(`Duplicate NextTavern provider ${provider.id}`)
      ids.add(provider.id)
      const intent = this.state.plan.provider({id: provider.id, module: provider.original})
      if (!intent) throw Error(`Missing NextTavern provider ${provider.id}`)
      // Default official providers are all root rows. Rehoming a user-isolated
      // provider would silently change its service identity; fail explicitly.
      if (intent.ancestors.length || Reflect.get(intent.row, 'isolate') || Reflect.get(intent.row, 'intercept')) {
        throw Error(`NextTavern provider ${provider.id} has a custom scope`)
      }
      const native = this.host.resolve(provider.id)
      const disabled = native.options.disabled as unknown
      if (!disabled || typeof disabled !== 'object' || !('__jsExpr' in disabled)
        || disabled.__jsExpr !== providerDisabledExpression) {
        throw Error(`NextTavern does not own provider policy ${provider.id}`)
      }
      // Keep Loader's package identity visible to plugin discovery, while
      // imports still use the exact admitted product-owned entry point.
      modules.set(provider.replacement, ownedModule(provider.replacement))
      return {...structuredClone(intent.row), name: provider.replacement}
    })
    const addons = structuredClone(this.config.addons ?? []).map(row => {
      if (!row.id || ids.has(row.id)) throw Error(`Duplicate or missing NextTavern addon identity ${row.id}`)
      ids.add(row.id)
      modules.set(row.name, addonModule(row.name))
      return row
    })
    this.modules = modules
    return [...rows, ...addons]
  }

  private async settleNativeDependencies(epoch: number): Promise<void> {
    // Replacing persistence wakes native Workspace; Connection may still be
    // loading its browser credentials. Our subtree's await() returns for PENDING
    // consumers before that independent I/O completes. Loader also tracks
    // imports that have started but have not created their fiber yet.
    const excluded = new Set([...this.entries()].map(entry => entry.fiber))
    let ancestor = this.ctx.fiber
    while (!excluded.has(ancestor)) {
      excluded.add(ancestor)
      ancestor = ancestor.parent.fiber
    }
    while ([...this.entries()].some(entry => !entry.disabled && entry.fiber?.state !== ACTIVE_FIBER_STATE)) {
      const running = new Set([...this.host.entries()].flatMap(entry => {
        // The host tree also includes this entry's init, which is awaiting reconcile.
        if (entry.options.id === PRODUCT_ENTRY) return []
        const fiber = entry.fiber
        if(fiber&&excluded.has(fiber)) return []
        const task=entry._initTask??fiber?.inertia
        return task ? [task] : []
      }))
      // Once a required service arrives, unrelated siblings need not finish.
      if (running.size) await Promise.race([...running].map(task=>task.catch(()=>{})))
      else if (!this.getTasks().length) return
      if (this.closing || epoch !== this.epoch) return
      await this.await()
    }
  }

  async reconcile(previousPlan?: ProfilePlan): Promise<void> {
    if (this.closing || !productWanted(this.ctx, this.state)) return
    try {
      // A published product owns a private dependency inventory. Admit it before
      // stopping native providers or evaluating any private entry. This read-only
      // path is safe while the official manager holds its profile writer lock;
      // durable pin preparation must not be awaited from this reload lifecycle.
      if (productMetadata.bundleDependencies) {
        const packages = this.ctx.get('pluginPackages')
        inspectBundledPackages(productRoot, this.ctx.profileContext.installAnchor,
          packages ? (name, parentURL) => packages.packageOf(name, parentURL)?.manifestPath : undefined)
      }
      const rows = this.rows()
      const epoch = this.epoch
      this.state.restoring = false
      // Native imports and disposal can already be in flight in sibling entries.
      // Await those exact fibers, not host.await(), which would await this entry.
      for (const provider of this.config.providers) {
        await this.host.resolve(provider.id).update({}, false, true)
      }
      for (const fiber of this.state.nativeFibers) {
        await fiber.dispose()
        while (fiber.inertia) await fiber.inertia
      }
      this.state.nativeFibers.clear()
      if (this.closing || epoch !== this.epoch) return
      this.released = false
      await this.root.update(rows)
      await this.await()
      await this.settleNativeDependencies(epoch)
      if (this.closing || epoch !== this.epoch) return
      const outcomes = await Promise.allSettled([...this.entries()].map(entry => entry.fiber?.await()))
      const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
      if (failures.length) throw new AggregateError(failures.map(outcome => outcome.reason),
        'NextTavern child activation failed')
      // await() drains work but also returns for PENDING fibers whose hard
      // dependencies never appeared. Do not report a half-active takeover.
      for (const entry of this.entries()) {
        if (!entry.disabled && entry.fiber?.state !== ACTIVE_FIBER_STATE) {
          throw Error(`NextTavern enabled entry is not active: ${entry.id}`)
        }
      }
      if (this.config.host) {
        // Register profile-wide routes only after the required providers are
        // active. A Loader row for this same package would claim its browser
        // identity a second time; a native child fiber shares this root owner.
        const hostModule = await import(ownedModule(this.config.host))
        if (this.closing || epoch !== this.epoch) return
        this.hostFiber = this.ctx.plugin(hostModule)
        await this.hostFiber.await()
        if (this.hostFiber.state !== ACTIVE_FIBER_STATE) throw Error('NextTavern host routes are not active')
      }
      this.schedulePackageSetup()
    } catch (error) {
      // A hot reconfiguration failure does not dispose the main entry. Its
      // init-generator cleanup alone cannot restore services in this path.
      try {
        await this.stop()
        if (previousPlan) this.state.plan = previousPlan
        await this.restoreNative()
      } catch (rollback) {
        throw new AggregateError([error, rollback], 'NextTavern activation and restoration failed')
      }
      throw error
    }
  }

  private schedulePackageSetup(): void {
    const schedule = () => {
      if (this.closing || this.setupStarted) return
      this.setupStarted = true
      const preparation = this.preparationState()
      const market = this.marketState()
      bindPackagePreparation(this.ctx, preparation)
      bindPackagePreparation(this.ctx, market)
      preparation.schedule()
      market.schedule()
    }
    if (this.ctx.profileContext.name !== 'desktop') {
      schedule()
      return
    }
    // The Desktop shell still reads settings, credentials and account state
    // after exchanging its launch cookie. Wait for the workspace's session
    // list or an authenticated Tavern request before recomposing the host.
    let scheduled = false
    const afterResponse = () => {
      if (scheduled) return
      scheduled = true
      void dispose()
      schedule()
    }
    const dispose = this.ctx.on('connection/request', (request, response, next) => {
      const path = request.url?.split('?', 1)[0]
      if (path === '/api/session/list' || path?.startsWith('/api/roleplay/')) {
        response.once('finish', afterResponse)
      }
      return next()
    }, {global: true})
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping
    if (this.released) return
    this.epoch += 1
    // Cancel a preparation that has not started, so a stopping product never
    // begins a profile write transaction; an already running one finishes
    // inside its own lock and is awaited by nobody here.
    this.preparation?.close()
    this.market?.close()
    this.stopping = (async () => {
      // Stop advertising replaced rows for settings before the rows drain: the
      // adapter must never outlive the composition it describes. Advertising
      // stops synchronously — the row-disabling below must not wait — and the
      // host methods it wrapped come back with the child fiber.
      const bridge = this.settingsBridge
      this.settingsBridge = undefined
      bridge?.close()
      if (bridge) void bridge.dispose().catch(error => this.ctx.logger?.warn?.(
        `nexttavern: settings adapter release failed: ${String(error)}`))
      // Mark our transient rows synchronously, before host disposal yields.
      // Calling entry.update here would also stop their providers too early;
      // root.stop below owns that disposal, after route handles have drained.
      // Browser discovery can run on the first disposal microtask and must
      // already see every old source disabled. These rows are never persisted.
      for (const entry of this.entries()) entry.options.disabled = true
      // Routes may retain provider handles. Release them before their backing
      // storage/controller providers and before native fallback can start.
      if (this.hostFiber) {
        const host = this.hostFiber
        this.hostFiber = undefined
        await host.dispose()
        while (host.inertia) await host.inertia
      }
      // A late import can still publish a fiber. Wait for known child work,
      // then include uncommitted rows, not only EntryGroup.data. Keep the
      // native-start middleware blocked until every captured fiber drains.
      while (this.getTasks().length) await Promise.allSettled(this.getTasks())
      const fibers = [...this.entries()].flatMap(entry => entry.fiber ? [entry.fiber] : [])
      await this.root.stop()
      for (const entry of [...this.entries()]) await entry.parent.remove(entry.options.id, true)
      for (const fiber of fibers) {
        await fiber.dispose()
        while (fiber.inertia) await fiber.inertia
      }
      this.released = true
    })()
    try {await this.stopping} finally {this.stopping = undefined}
  }

  private async release(): Promise<void> {
    this.closing = true
    await this.stop()
    if (this.state.owner !== this) return
    this.state.owner = undefined
    const apply = this.state.applyHostUpdate
    if (apply) {
      this.state.applyHostUpdate = undefined
      try {apply()} finally {this.state.applying = false}
      if (productWanted(this.ctx, this.state)) return
    }
    await this.restoreNative()
  }

  private async restoreNative(): Promise<void> {
    this.state.restoring = true
    // Shutdown must not resurrect services under a disposing Include. Ordinary
    // disable restores native rows only after every product child was released.
    if (this.host.ctx.fiber.uid === null) return
    for (const provider of this.config.providers) {
      const entry = this.host.store[provider.id]
      if (entry?.options.name !== provider.original) continue
      const intent = this.state.plan.provider({id:provider.id,module:provider.original})
      if (!intent) throw Error(`Cannot restore original configuration for ${provider.id}`)
      await entry.update({config:structuredClone(intent.row.config)}, false, true)
    }
  }

  async *[Service.init]() {
    yield () => this.release()
    const version = this.state.plan.version
    try {
      await this.reconcile(this.state.previousPlan)
    } catch (cause) {
      // Official reconciliation compares diagnostics for already-failed rows.
      // Include the proposal identity so a second failed provider-only edit
      // cannot be mistaken for an unchanged pre-existing failure.
      throw new Error(`NextTavern activation failed for profile generation ${version}`, {cause})
    }
    // Replaced providers keep their volatile configuration on the official
    // settings page only through this adapter, and only while they run. It
    // rides the product fiber, so a stopped product publishes nothing, and it
    // loads by itself whenever a settings surface exists.
    this.settingsBridge = mountSettingsBridge(this.ctx, () => this.rehomedSettingsRows())
    this.state.previousPlan = undefined
  }
}
