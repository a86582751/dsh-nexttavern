/** Product-owned Loader subtree. Native and replacement providers never overlap. */
import {Service, type Context} from '@deepseek-ai/cordis'
import {EntryTree, type EntryOptions} from '@deepseek-ai/cordis-plugin-loader'
import {createRequire} from 'node:module'
import {realpathSync} from 'node:fs'
import {isAbsolute, relative} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {capture, composition, loaderEntry, productWanted, providerDisabledExpression,
  type CompositionState, type ProfilePlan} from './nexttavern-entry-policy.mjs'

const productRoot = fileURLToPath(new URL('../../', import.meta.url))
const productRequire = createRequire(new URL('../../package.json', import.meta.url))

function ownedModule(specifier: string): string {
  const resolved = realpathSync(specifier.startsWith('file:')
    ? fileURLToPath(specifier) : productRequire.resolve(specifier))
  const within = relative(realpathSync(productRoot), resolved)
  if (isAbsolute(within) || within === '..' || within.startsWith('../') || within.startsWith('..\\')) {
    throw Error(`NextTavern module resolved outside its product bundle: ${specifier}`)
  }
  return pathToFileURL(resolved).href
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
}

export default class NextTavernEntry extends EntryTree {
  private host: EntryTree
  private state: CompositionState
  private closing = false
  private stopping?: Promise<void>
  private released = false
  private epoch = 0

  constructor(ctx: Context, private config: NextTavernEntryConfig) {
    // Capture before super attaches the product's subtree to its main entry.
    const host = loaderEntry(ctx).parent.tree
    const state = composition(ctx)
    super(ctx)
    this.host = host
    this.state = state
    if (state.owner) throw Error('NextTavern already owns this profile')
    state.owner = this

    ctx.on('loader/patch-context', async (entry, next) => {
      // Include starts new rows before removing old rows. Uninstall may remove
      // the conditional patch entirely, so native startup must drain us first.
      if (entry.parent.tree === host && this.config.providers.some(provider =>
        provider.id === entry.options.id && provider.original === entry.options.name)) {
        await this.stop()
      }
      await next()
    }, {global: true})

    const owner = this
    ctx.on('internal/update', async function (candidate, _noSave, next) {
      if (this.entry !== host.ctx.fiber.entry) return next()
      // Capture the argument, not Entry.options: a later update can replace
      // those options before this update reaches Include's own apply queue.
      const patches = (candidate as {patches?: unknown}).patches
      const task = state.queue.then(async () => {
        const before = state.plan
        const beforePatches = state.patches
        state.plan = capture(ctx, patches)
        state.patches = JSON.stringify(patches)
        state.applying = true
        try {
          await next()
          if (!owner.closing && state.owner === owner) await owner.reconcile(before)
        } catch (error) {
          state.plan = before
          state.patches = beforePatches
          throw error
        } finally {state.applying = false}
      })
      state.queue = task.catch(() => {})
      await task
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
    return [...rows, ...structuredClone(this.config.addons ?? []).map(row => ({...row, name: ownedModule(row.name)}))]
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
    await this.reconcile()
  }
}
