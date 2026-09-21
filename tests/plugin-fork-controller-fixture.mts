/** Real Controller/AgentLoop cold activation; no Harness, network adapter or product preset. */
import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const load = (name: string) => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
const {Context} = await load('cordis')
const {default: Loader} = await load('cordis-plugin-loader')
const {default: SessionStore} = await load('dsh-session')
const {default: SessionProjectionRegistry} = await load('dsh-session-projection')
const {default: JsonlSessionPersistence} = await load('dsh-session-persistence-jsonl')
const {default: AgentRegistry, agentEvents, assembleContextFor} = await load('dsh-agent')
const {default: AgentLoop} = await load('dsh-agent-loop')
const {default: SessionQueryEngine} = await load('dsh-session-query')
const {default: TypertRegistry} = await load('dsh-typert-registry')
const {default: SystemPrompt, renderPrompt} = await load('dsh-system-prompt')
const {default: ToolRuntime} = await load('dsh-tools')
const {default: LlmRuntime} = await load('dsh-llm')
const {default: SettingsProvider} = await load('dsh-settings')
const {default: AgentDefaultModel} = await load('dsh-agent-default-model')
const {default: AgentPresets, COMPOSITION_FILE} = await load('dsh-agent-presets')
const {default: SessionController} = await load('dsh-api-session-controller')

/** Only settings storage is synthetic; registration, validation and live updates are native. */
class MemorySettings extends SettingsProvider {
  writable = true
  stored: Record<string, unknown> = {}
  async load() { return structuredClone(this.stored) }
  async persist(namespace: string, section: unknown) { this.stored[namespace] = structuredClone(section) }
}

/** Use native observation/leases/projections; searching is outside this probe. */
class PointQuery extends SessionQueryEngine {
  async searchSessions() { throw Error('Search is outside the cold-activation fixture') }
  async searchEvents() { throw Error('Search is outside the cold-activation fixture') }
}

export async function prepareControllerHost(ctx: any, options: {
  directory: string
  Projection?: any
  Format?: any
  Persistence?: any
  workspaces?: any[]
  deferPersistence?: boolean
}) {
  const presetRoot = path.join(options.directory, 'presets')
  const presetDir = path.join(presetRoot, 'probe')
  const uploadResolvers = new Set<unknown>()

  async function writePreset(duplicate = false) {
    await mkdir(presetDir, {recursive: true})
    const row = {id: 'persona', name: '@deepseek-ai/dsh-persona', config: {
      prefix: 'Cold probe {{provider}}/{{model}}', complete: true, includeRuntimeContext: false,
    }}
    const rows = duplicate ? [row, {...row, id: 'conflicting-persona'}] : [row]
    await writeFile(path.join(presetDir, COMPOSITION_FILE), JSON.stringify(rows), 'utf8')
  }

  await writePreset()
  await ctx.plugin(SessionStore)
  if (options.Format) await ctx.plugin(options.Format)
  await ctx.plugin(options.Projection ?? SessionProjectionRegistry)
  if (!options.deferPersistence) {
    await ctx.plugin(options.Persistence ?? JsonlSessionPersistence, {
      root: path.join(options.directory, 'sessions'), compression: 'none',
    })
  }
  await ctx.plugin(PointQuery)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(MemorySettings)
  await ctx.plugin(SystemPrompt, {includeHarnessIdentity: false, includeRuntimeContext: false, persona: ''})
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentDefaultModel, {provider: 'fixture-default', model: 'before'})
  await ctx.plugin(AgentLoop, {agents: []})
  await ctx.plugin(AgentPresets, {
    default: 'probe', roots: [{path: presetRoot, trust: 'user'}], includeShippedRoot: false, includeUserRoot: false,
  })
  // Cold projection reads image policy, but this fixture must never touch
  // attachment bytes or workspace operations.
  const peripheral = (values: Record<string, unknown> = {}) => new Proxy(values, {get: (target, key) => {
    if (typeof key === 'symbol') return undefined // Cordis checks optional tracing metadata.
    if (key === 'typertRemote') return undefined // Gateway scans optional Remote service markers.
    if (Object.hasOwn(target, key)) return target[key]
    throw Error(`Unexpected peripheral access: ${key}`)
  }})
  ctx.provide('attachments', peripheral({imageLimits: {
    maxImageBytes: 1024, maxImagesPerMessage: 1, maxMessageImageBytes: 1024,
    maxImagePixels: 1024, maxImageDimension: 32, mediaTypes: ['image/png'],
  }}))
  ctx.provide('fileUploads', peripheral({registerAgentResolver(resolver: unknown) {
    uploadResolvers.add(resolver)
    return () => {uploadResolvers.delete(resolver)}
  }}))
  ctx.provide('workspaceRegistry', peripheral({list: () => options.workspaces ?? []}))

  return {writePreset, uploadResolverCount: () => uploadResolvers.size}
}

export async function controllerFixture(options: {
  Controller?: any
  Projection?: any
  Format?: any
  Persistence?: any
  controllerPackage?: {name: string; baseUrl: string}
  workspaces?: any[]
} = {}) {
  const Controller = options.Controller ?? SessionController
  const dir = createTestDirectory('plugin-fork-controller-')
  const ctx = new Context()
  ctx.baseUrl = options.controllerPackage?.baseUrl ?? new URL('../build-tools/', import.meta.url).href
  const published: string[] = []
  const registrations: {event: string}[] = []
  let writePreset: (duplicate?: boolean) => Promise<void>
  let uploadResolverCount = () => 0
  let controllerFiber: any

  async function startController() {
    if (options.controllerPackage) {
      await ctx.loader.root.update([{
        id: 'session-controller', name: options.controllerPackage.name, config: {nativeOpen: false},
      }])
      await ctx.loader.await()
    } else {
      controllerFiber = await ctx.plugin(Controller, {nativeOpen: false})
    }
  }

  async function stopController() {
    if (options.controllerPackage) await ctx.loader.root.update([])
    else await controllerFiber.dispose()
  }

  try {
    ctx.on('agent/created', ({agent}: any) => published.push(agent.id))
    // Observe registrations forward through Cordis's event, without reading
    // private hook arrays or reaching through a dispatch context's inject scope.
    // Each fixture controls its Agent creation; initial host hooks are excluded.
    ctx.on('internal/listener', (event: string) => {
      if (event !== 'system-prompt/assemble' && event !== 'agent/request') return
      registrations.push({event})
    })
    await ctx.plugin(Loader)
    const preparedHost = await prepareControllerHost(ctx, {
      directory: dir,
      Projection: options.Projection,
      Format: options.Format,
      Persistence: options.Persistence,
      workspaces: options.workspaces,
    })
    writePreset = preparedHost.writePreset
    uploadResolverCount = preparedHost.uploadResolverCount
    await startController()
    registrations.length = 0
  } catch (error) {
    try { await ctx.fiber.dispose() }
    finally { cleanupTestDirectory(dir) }
    throw error
  }

  async function stageFrom(id: string, source: any) {
    const seed = source.snapshotEvents()
    const child = ctx.sessions.prepare(id, {seed, inheritedEventCount: seed.length, meta: {
      cwd: dir, parentSession: source.id, isSeeded: true, agentPreset: 'probe',
    }})
    const handle = await ctx.sessionPersistence.create(child.header, {inheritedEventCount: child.inheritedEventCount})
    try {await handle.append(child.snapshotEvents()); await handle.flush()} finally {await handle.close()}
    assert.equal(ctx.sessions.get(id), undefined)
    return child
  }

  return {ctx, dir, published, registrations, writePreset, stageFrom,
    uploadResolverCount,
    stopController, startController,
    async stage(id: string, selection?: {provider: string; model: string; reasoningEffort?: string}) {
      const source = ctx.sessions.prepare(`source-${id}`, {meta: {cwd: dir, agentPreset: 'probe'}})
      source.append('turn/start', {turn: 1})
      source.append('turn/end', {turn: 1, reason: {kind: 'completed'}})
      if (selection) source.append('model/selection', selection)
      return stageFrom(id, source)
    },
    async requestSelection(agent: any, afterAssembly?: () => Promise<void>) {
      const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
      await afterAssembly?.()
      const request = await agentEvents(ctx, agent).waterfall('agent/request', {
        config: {provider: 'unselected', model: 'unselected', reasoningEffort: 'inherited'},
      }, async () => ({provider: 'unselected', model: 'unselected', reasoningEffort: 'inherited'}))
      return {request, prompt: renderPrompt(assembly)}
    },
    async close() {
      try { await ctx.fiber.dispose() }
      finally { cleanupTestDirectory(dir) }
    },
  }
}
