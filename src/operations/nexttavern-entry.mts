/** Product-owned Loader subtree. Native and replacement providers never overlap. */
import {Service, type Fiber, type FiberState, type Context} from '@deepseek-ai/cordis'
import {EntryTree, type EntryOptions} from '@deepseek-ai/cordis-plugin-loader'
import {createRequire} from 'node:module'
import {readFileSync, realpathSync} from 'node:fs'
import {isAbsolute, relative, sep} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {capture, composition, loaderEntry, productWanted, providerDisabledExpression,
  type CompositionState, type ProfilePlan} from './nexttavern-entry-policy.mjs'

const productRoot = fileURLToPath(new URL('../../', import.meta.url))
const productRequire = createRequire(new URL('../../package.json', import.meta.url))
const productMetadata: {peerDependencies?: Record<string, string>} = JSON.parse(
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
  private hostFiber?: Fiber

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
    ctx.on('internal/update', function (candidate, _noSave, next) {
      if (this.entry !== host.ctx.fiber.entry) return next()
      // Fiber.update does not await waterfall promises. Capture synchronously
      // and use the product fiber's native restart lifecycle, which Loader and
      // the official manager actually await and inspect for failure.
      const patches = (candidate as {patches?: unknown}).patches
      if (state.applyHostUpdate) throw Error('NextTavern profile update is still running; retry the profile update')
      const proposal = capture(ctx, patches)
      state.previousPlan = state.plan
      state.plan = proposal
      state.patches = proposal.rows
      state.applying = true
      // Defer Include's tree mutation until our old children have drained.
      // Otherwise Include starts an original provider before removing ours.
      state.applyHostUpdate = next
      // restart records errors on the fiber; consume this returned promise
      // because its caller is synchronous, not a second admission channel.
      void owner.ctx.fiber.restart().catch(() => {})
    }, {global: true, prepend: true})
  }

  /** Child edits belong to this transient subtree, never the profile file. */
  write(): void {}

  private rows(): EntryOptions[] {
    const ids = new Set<string>()
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
      return {...structuredClone(intent.row), name: ownedModule(provider.replacement)}
    })
    const addons = structuredClone(this.config.addons ?? []).map(row => {
      if (!row.id || ids.has(row.id)) throw Error(`Duplicate or missing NextTavern addon identity ${row.id}`)
      ids.add(row.id)
      return {...row, name: addonModule(row.name)}
    })
    return [...rows, ...addons]
  }

  async reconcile(previousPlan?: ProfilePlan): Promise<void> {
    if (this.closing || !productWanted(this.ctx, this.state)) return
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
    try {
      await this.root.update(rows)
      await this.await()
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

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping
    if (this.released) return
    this.epoch += 1
    this.stopping = (async () => {
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
    this.state.previousPlan = undefined
  }
}
