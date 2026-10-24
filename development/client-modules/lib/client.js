window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-client-modules", factory: function (require) { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  ClientModuleSystem: () => ClientModuleSystem,
  apply: () => apply,
  createClientModuleSystem: () => createClientModuleSystem,
  exactPackageSpecifier: () => exactPackageSpecifier,
  inject: () => inject,
  parseBootManifest: () => parseBootManifest,
  parseDshClient: () => parseDshClient,
  stripClientSuffix: () => stripClientSuffix,
  tearDownEntryFiber: () => tearDownEntryFiber
});
module.exports = __toCommonJS(index_exports);

// manifest.ts
function optionalStringArray(subject, field, value) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`client-modules: ${subject} ${field} must be a string array`);
  }
  return value;
}
function parseDshClient(pkgName, value) {
  if (value === void 0) return void 0;
  if (typeof value !== "object" || value === null) {
    throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`);
  }
  const decl = value;
  if (typeof decl.platform !== "string") {
    throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
  }
  const inject2 = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
  const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
  if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") {
    throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`);
  }
  return {
    platform: decl.platform,
    ...inject2 !== void 0 ? { inject: inject2 } : {},
    ...external !== void 0 ? { external } : {},
    ...decl.immediately !== void 0 ? { immediately: decl.immediately } : {}
  };
}
function exactPackageSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length === 2 && parts.every(Boolean) ? specifier : void 0;
  }
  return specifier.length > 0 && !specifier.includes("/") && !specifier.includes(":") ? specifier : void 0;
}
function stripClientSuffix(spec) {
  return spec.endsWith("/client") ? spec.slice(0, -"/client".length) : spec;
}
function parseBootManifest(wire) {
  if (typeof wire !== "object" || wire === null) {
    throw new Error("client-modules: window.__DSH_BOOT__ is missing or not an object");
  }
  const graph = wire;
  if (typeof graph.rev !== "string") {
    throw new Error("client-modules: boot manifest rev must be a string");
  }
  if (!Array.isArray(graph.entries)) {
    throw new Error("client-modules: boot manifest entries must be an array");
  }
  if (!Array.isArray(graph.batches)) {
    throw new Error("client-modules: boot manifest batches must be an array");
  }
  const moduleFields = [];
  const plugins = [];
  const seenEntryIds = /* @__PURE__ */ new Set();
  for (const value of graph.entries) {
    if (typeof value !== "object" || value === null) {
      throw new Error("client-modules: boot manifest entry is not an object");
    }
    const row = value;
    const where = typeof row.id === "string" ? `"${row.id}"` : JSON.stringify(row);
    if (typeof row.id !== "string" || typeof row.url !== "string" || typeof row.rev !== "string") {
      throw new Error(`client-modules: boot manifest entry ${where} must carry string id/url/rev`);
    }
    if (seenEntryIds.has(row.id)) throw new Error(`client-modules: duplicate graph entry "${row.id}"`);
    seenEntryIds.add(row.id);
    const subject = `boot manifest entry ${where}`;
    const inject2 = optionalStringArray(subject, "inject", row.inject);
    const external = optionalStringArray(subject, "external", row.external);
    if (row.immediately !== void 0 && typeof row.immediately !== "boolean") {
      throw new Error(`client-modules: boot manifest entry ${where} immediately must be a boolean`);
    }
    moduleFields.push({
      id: row.id,
      url: row.url,
      rev: row.rev,
      inject: inject2 === void 0 ? [] : [...inject2],
      external: external === void 0 ? [] : [...external]
    });
    plugins.push({
      id: row.id,
      inject: inject2 === void 0 ? [] : [...inject2],
      immediately: row.immediately === true
    });
  }
  const entryIds = new Set(moduleFields.map((row) => row.id));
  const initialUrls = /* @__PURE__ */ new Map();
  const batchUrls = /* @__PURE__ */ new Set();
  for (const value of graph.batches) {
    if (typeof value !== "object" || value === null) {
      throw new Error("client-modules: boot manifest batch is not an object");
    }
    const batch = value;
    const phase = batch.phase;
    if (phase !== "bootstrap" && phase !== "application") {
      throw new Error(`client-modules: boot manifest batch phase must be "bootstrap" or "application", received ${JSON.stringify(phase)}`);
    }
    if (typeof batch.url !== "string" || typeof batch.rev !== "string") {
      throw new Error(`client-modules: boot manifest ${phase} batch must carry string url/rev`);
    }
    if (batchUrls.has(batch.url)) {
      throw new Error(`client-modules: boot manifest carries duplicate batch URL ${JSON.stringify(batch.url)}`);
    }
    batchUrls.add(batch.url);
    const entries = optionalStringArray(`boot manifest ${phase} batch`, "entries", batch.entries);
    if (entries === void 0 || entries.length === 0) {
      throw new Error(`client-modules: boot manifest ${phase} batch entries must be a non-empty string array`);
    }
    for (const id of entries) {
      if (!entryIds.has(id)) {
        throw new Error(`client-modules: boot manifest ${phase} batch names unknown entry "${id}"`);
      }
      if (initialUrls.has(id)) {
        throw new Error(`client-modules: boot manifest entry "${id}" belongs to more than one batch`);
      }
      initialUrls.set(id, batch.url);
    }
  }
  const modules = moduleFields.map((row) => {
    const initialUrl = initialUrls.get(row.id);
    if (initialUrl === void 0) {
      throw new Error(`client-modules: boot manifest entry "${row.id}" belongs to no initial-load batch`);
    }
    return { ...row, initialUrl };
  });
  return { rev: graph.rev, modules, plugins };
}

// entry-lifecycle.ts
async function tearDownEntryFiber(entry) {
  const fiber = entry.fiber;
  if (fiber === void 0) return;
  const runtime = fiber.runtime;
  if (runtime !== null) entry.ctx.registry.delete(runtime.callback);
  while (fiber.inertia !== void 0) await fiber.inertia;
  delete entry.fiber;
}
function removeOwnedStyles(id) {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll("style[data-plugin]")) {
    if (el.getAttribute("data-plugin") === id) el.remove();
  }
}

// entries.ts
var ACTIVE = 2;
var FAILED = 3;
function entryTargets(manifest) {
  return JSON.stringify(manifest.modules.map((row) => [row.id, row.rev, row.inject, row.external]));
}
var ClientEntries = class {
  /**
   * Construct the page controller before Cordis boot.
   * @param modules - Module arrival and materialization owner.
   * @param index - Private descriptor replacement and unused-module cleanup.
   */
  constructor(modules, index) {
    this.modules = modules;
    this.index = index;
    this.desired = modules.manifest;
  }
  /** Stable observable consumed by page diagnostics through the renderer's injected hook. */
  state = {
    getSnapshot: () => this.snapshot,
    subscribe: (listener) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
  };
  // The modules bootstrap factory cannot request platform libraries before the shell supplies its seed.
  snapshot = { syncing: false, failures: [] };
  listeners = /* @__PURE__ */ new Set();
  managed = /* @__PURE__ */ new Map();
  revisions = /* @__PURE__ */ new Map();
  loader;
  queue = Promise.resolve();
  desired;
  generation = 0;
  stopped = false;
  /**
   * Create the initial roster and retain its entry identities for subsequent reconciliation.
   * @param loader - Page Loader, already configured with the module system.
   * @param manifest - Initial roster audited by the boot caller.
   * @returns after initial entries and their activation settle; boot owns its activation audit.
   */
  start(loader, manifest) {
    if (this.loader !== void 0) throw new Error("client-modules: entries already started");
    this.loader = loader;
    this.desired = manifest;
    loader.ctx.effect(() => () => {
      this.stopped = true;
      this.generation++;
      return this.queue;
    }, "client-modules: entry reconciliation");
    return this.enqueue(async () => {
      await Promise.all(this.desired.plugins.map(async ({ id }) => {
        await this.create(loader, id);
      }));
      await loader.await();
      for (const row of this.modules.manifest.modules) this.revisions.set(row.id, row.rev);
    });
  }
  /**
   * Validate and apply the latest full Host graph. Changed targets cancel obsolete mounts; identical targets share pending loads.
   * @param graph - JSON-decoded graph received from the Host.
   * @returns after the queued reconciliation; per-package failures remain available in {@link state}.
   */
  sync(graph) {
    const manifest = parseBootManifest(graph);
    if (entryTargets(manifest) !== entryTargets(this.desired)) this.generation++;
    this.desired = manifest;
    const generation = this.generation;
    return this.enqueue(() => this.reconcile(generation));
  }
  /**
   * Retry failed entries against the latest graph, including an unchanged revision.
   * @returns after retry settlement, with remaining errors in {@link state}.
   */
  retry() {
    const generation = ++this.generation;
    return this.enqueue(() => this.reconcile(generation));
  }
  /**
   * Replace one entry's code in the same queue as graph updates; duplicate revisions are ignored.
   * Entries missing after a failed import are reconciled; bootstrap replacement fails before teardown.
   * @param id - Package id from a rebuilt frame.
   * @param rev - Opaque revision selecting the rebuilt artifact.
   * @returns after queued work; replacement errors reject, while per-package reconciliation errors remain in {@link state}.
   */
  reload(id, rev) {
    this.desired = {
      ...this.desired,
      modules: this.desired.modules.map((row) => row.id === id ? { ...row, rev } : row)
    };
    return this.enqueue(async () => {
      const desired = this.desired.modules.find((row) => row.id === id);
      if (this.stopped || desired === void 0) return;
      const entry = this.managed.get(id);
      if (entry === void 0) {
        this.modules.invalidate(id, desired.rev);
        removeOwnedStyles(id);
        await this.reconcile(this.generation);
        return;
      }
      if (this.revisions.get(id) === rev) return;
      this.publish({ syncing: true, failures: this.snapshot.failures.filter((failure) => failure.id !== id) });
      await this.replace(entry, id, rev, this.generation);
      this.publish({ syncing: false, failures: this.snapshot.failures });
    }, id);
  }
  publish(snapshot) {
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("client-modules: synchronization subscriber failed", error);
      }
    }
  }
  enqueue(task, subject = "graph") {
    const run = this.queue.then(task);
    this.queue = run.then(() => void 0, (error) => {
      this.publish({ syncing: false, failures: [
        ...this.snapshot.failures.filter((failure) => failure.id !== subject),
        { id: subject, message: String(error) }
      ] });
    });
    return run;
  }
  current(generation) {
    return !this.stopped && generation === this.generation;
  }
  /** Keep ownership even when Loader rejects a module's plugin exports after inserting its entry. */
  async create(loader, id) {
    const options = { name: id };
    const entryId = loader.ensureId(options);
    try {
      await loader.create(options);
    } finally {
      this.managed.set(id, loader.resolve(entryId));
    }
  }
  async replace(entry, id, rev, generation) {
    this.index.invalidateForReplacement(id, rev);
    await this.modules.prefetch(id);
    if (!this.current(generation)) return;
    await tearDownEntryFiber(entry);
    removeOwnedStyles(id);
    if (!this.current(generation)) return;
    await this.modules.import(id, "", {});
    if (!this.current(generation)) return;
    await entry.refresh();
    await entry.fiber?.await();
    if (entry.fiber === void 0) throw new Error(`client-modules: ${id} import failed (see console)`);
    this.revisions.set(id, rev);
  }
  async reconcile(generation) {
    if (!this.current(generation)) return;
    const loader = this.loader;
    if (loader === void 0) throw new Error("client-modules: entries have not started");
    const manifest = this.desired;
    this.publish({ syncing: true, failures: [] });
    const failures = [];
    this.index.update(manifest, this.managed.keys());
    const wanted = new Set(manifest.plugins.map((row) => row.id));
    for (const [id, entry] of this.managed) {
      if (wanted.has(id)) continue;
      const fiber = entry.fiber;
      loader.remove(entry.id);
      this.managed.delete(id);
      this.revisions.delete(id);
      while (fiber?.inertia !== void 0) await fiber.inertia;
    }
    for (const row of manifest.modules) {
      if (!this.current(generation)) break;
      try {
        const entry = this.managed.get(row.id);
        if (entry === void 0) {
          await this.modules.prefetch(row.id);
          if (!this.current(generation)) break;
          await this.modules.import(row.id, "", {});
          if (!this.current(generation)) break;
          await this.create(loader, row.id);
          this.revisions.set(row.id, row.rev);
        } else if (this.revisions.get(row.id) !== row.rev) {
          await this.replace(entry, row.id, row.rev, generation);
        } else if (entry.fiber === void 0) {
          await this.replace(entry, row.id, row.rev, generation);
        } else if (entry.fiber.state === FAILED) {
          entry.fiber.update(entry.options.config);
        }
      } catch (error) {
        failures.push({ id: row.id, message: String(error) });
      }
    }
    await loader.await();
    for (const [id, entry] of this.managed) {
      if (failures.some((failure) => failure.id === id)) continue;
      if (entry.fiber?.state === ACTIVE) continue;
      try {
        if (entry.fiber === void 0) throw new Error(`client-modules: ${id} import failed (see console)`);
        await entry.fiber.await();
        failures.push({ id, message: `client-modules: ${id} is waiting for activation` });
      } catch (error) {
        failures.push({ id, message: String(error) });
      }
    }
    this.index.prune([...loader.entries()].map((entry) => entry.options.name));
    if (this.current(generation)) this.publish({ syncing: false, failures });
  }
};

// system.ts
var defaultLoadBundle = (url) => new Promise((resolve, reject) => {
  const el = document.createElement("script");
  el.async = true;
  el.src = url;
  el.addEventListener("load", () => {
    el.remove();
    resolve();
  }, { once: true });
  el.addEventListener("error", () => {
    el.remove();
    reject(new Error(`client-modules: bundle script ${url} failed to load`));
  }, { once: true });
  document.head.append(el);
});
function atRevision(url, rev) {
  if (!/[?&]rev=[^&#]*/.test(url)) {
    throw new Error(`client-modules: bundle URL ${url} has no revision`);
  }
  return url.replace(/([?&]rev=)[^&#]*/, `$1${encodeURIComponent(rev)}`);
}
var CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/;
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}
function chunkId(ownerId, fileName) {
  return `${ownerId}/${fileName}`;
}
function chunkUrl(row, fileName, rev) {
  const url = atRevision(row.url, rev);
  const marker = "/??";
  const resourceStart = url.indexOf(marker);
  const revisionStart = url.indexOf("&rev=", resourceStart + marker.length);
  const resource = resourceStart < 0 || revisionStart < 0 ? void 0 : url.slice(resourceStart + marker.length, revisionStart);
  if (resource !== `${row.id}/client.js`) {
    throw new Error(`client-modules: cannot resolve chunk ${JSON.stringify(fileName)} from bundle URL ${url}`);
  }
  return `${url.slice(0, resourceStart)}/${row.id}/${fileName}?${url.slice(revisionStart + 1)}`;
}
var claimStyles = (id) => {
  if (typeof document === "undefined") return [];
  for (const el of document.querySelectorAll("style:not([data-plugin])")) {
    el.setAttribute("data-plugin", id);
  }
  const owned = [];
  for (const el of document.querySelectorAll(`style[data-plugin=${JSON.stringify(id)}]`)) {
    owned.push(el.getAttribute("data-plugin-css") ?? id);
  }
  return owned;
};
var ClientModuleSystem = class {
  version = "client";
  manifest;
  entries;
  loadCache = /* @__PURE__ */ new Map();
  seed;
  factories = /* @__PURE__ */ new Map();
  bootstrapIds = /* @__PURE__ */ new Set();
  /** In-flight script transport per URL; every row in one batch shares it. */
  pendingArrival = /* @__PURE__ */ new Map();
  /** Owner generation captured by in-flight chunk requests and advanced on invalidation. */
  generations = /* @__PURE__ */ new Map();
  /** Single-resource combo URL selected by HMR after invalidating one row. */
  reloadTargets = /* @__PURE__ */ new Map();
  /** Materialization re-entrancy guard: factory-form CJS cannot deliver partial exports, so a cycle is fatal. */
  materializing = /* @__PURE__ */ new Set();
  graphRows = /* @__PURE__ */ new Map();
  loadBundle;
  /** Last import or prefetch failure per graph row, cleared by a later success or invalidation. */
  importErrors = /* @__PURE__ */ new Map();
  /** Batch URLs whose transport or execution already failed; rows still missing from them go straight to their one-resource URL. */
  failedBundleUrls = /* @__PURE__ */ new Set();
  /** Every URL whose script has executed once; a batch among them is never requested again. */
  executedBundleUrls = /* @__PURE__ */ new Set();
  /**
   * Build the module system over the parsed boot rows.
   * @param options - Parsed graph, platform seed, bootstrap module, registration facade, and transport.
   */
  constructor(options) {
    this.manifest = options.manifest;
    this.entries = new ClientEntries(this, {
      update: (manifest, managed) => {
        this.updateManifest(manifest, managed);
      },
      invalidateForReplacement: (id, rev) => {
        if (this.bootstrapIds.has(id)) throw new Error(`client-modules: replacing bootstrap module ${id} requires a page reload`);
        this.invalidate(id, rev);
      },
      prune: (roots) => {
        this.prune(roots);
      }
    });
    this.seed = new Map(Object.entries(options.staticModules));
    this.loadBundle = options.loadBundle ?? defaultLoadBundle;
    for (const row of options.manifest.modules) {
      this.graphRows.set(row.id, row);
    }
    const bootstrapId = stripClientSuffix(options.bootstrapModule.id);
    this.bootstrapIds.add(bootstrapId);
    this.loadCache.set(bootstrapId, {
      id: bootstrapId,
      exports: options.bootstrapModule.exports,
      styles: [],
      edges: /* @__PURE__ */ new Set()
    });
    const target = options.registrationTarget;
    if (target.mode !== "queue") {
      throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot");
    }
    const pending = target.pendingQueue.splice(0);
    target.mode = "live";
    target.load = (registration) => {
      this.register(registration);
    };
    for (const registration of pending) target.load(registration);
  }
  /** Register one bundle factory, rejecting a script that executes twice without invalidation. */
  register(registration) {
    const ownerId = stripClientSuffix(registration.id);
    if (registration.chunk !== void 0 && !CLIENT_CHUNK.test(registration.chunk)) {
      throw new Error(`client-modules: invalid package-local chunk ${JSON.stringify(registration.chunk)}`);
    }
    const id = registration.chunk === void 0 ? ownerId : chunkId(ownerId, registration.chunk);
    if (this.bootstrapIds.has(id) || this.factories.has(id)) {
      const registrationName = registration.chunk === void 0 ? registration.id : id;
      throw new Error(`client-modules: duplicate factory registration for "${registrationName}" (bundle executed twice without invalidate?)`);
    }
    this.factories.set(id, {
      factory: registration.factory,
      rev: this.reloadTargets.get(ownerId)?.rev ?? this.graphRows.get(ownerId)?.rev
    });
  }
  /** Run one bundle transport per URL; every row waiting on the same URL shares the in-flight request. */
  loadShared(url) {
    let transport = this.pendingArrival.get(url);
    if (transport === void 0) {
      transport = this.loadBundle(url).then(() => {
        this.executedBundleUrls.add(url);
      }).finally(() => {
        this.pendingArrival.delete(url);
      });
      this.pendingArrival.set(url, transport);
    }
    return transport;
  }
  /**
   * Load one graph row so its factory is registered (idempotent per in-flight
   * arrival). A batch script is one classic script that registers every
   * package in sequence, and {@link register} rejects a second registration,
   * so the two failure kinds differ: a transport failure (`error` event, nothing
   * executed) is retried once on the same URL; a script that loaded without
   * registering this row (a parse error registered nothing, or a runtime throw
   * stopped it after registering others) is never re-executed, because a replay
   * would stop again at the first duplicate registration; that holds even when
   * the row that first imports from the batch is one it did register, because
   * every executed batch URL is remembered. Either way the row then falls back
   * to its own one-resource URL, which the Host serves for every package, so one
   * failed batch costs at most three requests per missing row and never fails
   * the rows that were registered.
   */
  async arrive(row) {
    const { id } = row;
    if (this.loadCache.has(id) || this.factories.has(id)) return;
    const reload = this.reloadTargets.get(id);
    const preferred = reload?.url ?? row.initialUrl;
    const fallback = reload === void 0 && row.url !== preferred ? row.url : void 0;
    const failures = [];
    const attempt = async (url) => {
      try {
        await this.loadShared(url);
      } catch (error) {
        failures.push(`${url}: ${describeError(error)}`);
        return "transport-failed";
      }
      if (this.factories.has(id)) return "registered";
      failures.push(`${url}: loaded without registering "${id}" via __ModuleLoader__.load`);
      return "not-registered";
    };
    let outcome = "transport-failed";
    if (this.failedBundleUrls.has(preferred)) {
      failures.push(`${preferred}: skipped after an earlier failure of this bundle`);
    } else if (fallback !== void 0 && this.executedBundleUrls.has(preferred)) {
      failures.push(`${preferred}: already executed without registering "${id}"`);
      outcome = "not-registered";
      this.failedBundleUrls.add(preferred);
    } else {
      outcome = await attempt(preferred);
      if (outcome === "transport-failed") outcome = await attempt(preferred);
      if (outcome !== "registered" && fallback !== void 0) this.failedBundleUrls.add(preferred);
    }
    if (outcome !== "registered" && fallback !== void 0) outcome = await attempt(fallback);
    if (outcome !== "registered") {
      throw new Error(`client-modules: could not load "${id}": ${failures.join("; ")}`);
    }
    if (reload !== void 0 && this.reloadTargets.get(id) === reload) {
      this.reloadTargets.delete(id);
    }
  }
  /** Register each injected package and unresolved dynamic request before its consumer. */
  async arriveGraphRow(row, open = [], visited = /* @__PURE__ */ new Set()) {
    const cycleStart = open.indexOf(row.id);
    if (cycleStart !== -1) {
      throw new Error(
        `client-modules: module arrival cycle ${[...open.slice(cycleStart), row.id].join(" -> ")} (the host must reject this graph before serving it)`
      );
    }
    if (visited.has(row.id)) return;
    visited.add(row.id);
    const next = [...open, row.id];
    for (const request of row.external) {
      const id = stripClientSuffix(request);
      if (this.seed.has(request) || this.loadCache.has(id)) continue;
      const dependency = this.graphRows.get(id);
      if (dependency !== void 0) await this.arriveDependency(row.id, dependency, next, visited);
    }
    for (const packageName of row.inject) {
      const dependency = this.graphRows.get(packageName);
      if (dependency !== void 0) await this.arriveDependency(row.id, dependency, [], visited);
    }
    await this.arrive(row);
  }
  /** Arrive one dependency, naming the consumer it failed for so a cascade reads as a chain, not as 44 unrelated failures. */
  async arriveDependency(consumerId, dependency, open, visited) {
    try {
      await this.arriveGraphRow(dependency, open, visited);
    } catch (error) {
      throw new Error(
        `client-modules: "${consumerId}" not loaded because dependency "${dependency.id}" failed: ${describeError(error)}`,
        { cause: error }
      );
    }
  }
  /** Materialize a registered factory (synchronous; memoized in loadCache). */
  materialize(id, ownerId = id) {
    const existing = this.loadCache.get(id);
    if (existing !== void 0) return existing;
    const registered = this.factories.get(id);
    if (registered === void 0) throw new Error(`client-modules: no registered factory for "${id}"`);
    if (this.materializing.has(id)) {
      throw new Error(`client-modules: require cycle through "${id}" (factory-form CJS cannot deliver partial exports)`);
    }
    this.materializing.add(id);
    try {
      const edges = /* @__PURE__ */ new Set();
      const exports = registered.factory(this.makeRequire(ownerId, edges));
      const record = { id, exports, styles: claimStyles(ownerId), edges };
      this.loadCache.set(id, record);
      return record;
    } catch (error) {
      removeOwnedStyles(ownerId);
      throw error;
    } finally {
      this.materializing.delete(id);
    }
  }
  /** Build the synchronous module-table require and its asynchronous chunk operation. */
  makeRequire(ownerId, edges) {
    const require2 = (spec) => {
      edges.add(spec);
      if (this.seed.has(spec)) return this.seed.get(spec);
      const id = stripClientSuffix(spec);
      const record = this.loadCache.get(id);
      if (record !== void 0) return record.exports;
      if (this.factories.has(id)) return this.materialize(id).exports;
      throw new Error(
        `client-modules: require("${spec}") missed the module table \u2014 not a platform seed word, not a materialized module, and no registered package factory (a build-time externals drift, or a dynamic dependency that did not arrive)`
      );
    };
    require2.async = async (spec) => {
      edges.add(spec);
      if (!spec.startsWith("./")) return await this.import(spec);
      const fileName = spec.slice(2);
      if (!CLIENT_CHUNK.test(fileName)) {
        throw new Error(`client-modules: invalid relative chunk request ${JSON.stringify(spec)}`);
      }
      return await this.importChunk(ownerId, fileName);
    };
    return require2;
  }
  /** Load, register, and materialize one package-local dynamic chunk. */
  async importChunk(ownerId, fileName) {
    const id = chunkId(ownerId, fileName);
    const existing = this.loadCache.get(id);
    if (existing !== void 0) return existing.exports;
    if (!this.factories.has(id)) {
      const generation = this.generations.get(ownerId) ?? 0;
      const row = this.graphRows.get(ownerId);
      if (row === void 0) throw new Error(`client-modules: chunk owner "${ownerId}" is not a boot graph entry`);
      const revision = this.factories.get(ownerId)?.rev ?? this.reloadTargets.get(ownerId)?.rev ?? row.rev;
      const url = chunkUrl(row, fileName, revision);
      let transport = this.pendingArrival.get(url);
      if (transport === void 0) {
        transport = this.loadBundle(url).finally(() => {
          this.pendingArrival.delete(url);
        });
        this.pendingArrival.set(url, transport);
      }
      await transport;
      if ((this.generations.get(ownerId) ?? 0) !== generation) {
        this.factories.delete(id);
        this.loadCache.delete(id);
        return await this.importChunk(ownerId, fileName);
      }
      if (!this.factories.has(id)) {
        throw new Error(`client-modules: bundle ${url} loaded without registering "${id}" via __ModuleLoader__.load`);
      }
    }
    return this.materialize(id, ownerId).exports;
  }
  async import(specifier) {
    if (this.seed.has(specifier)) return this.seed.get(specifier);
    const id = stripClientSuffix(specifier);
    const existing = this.loadCache.get(id);
    if (existing !== void 0) return existing.exports;
    const row = this.graphRows.get(id);
    if (row === void 0) {
      if (this.factories.has(id)) return this.materialize(id).exports;
      throw new Error(
        `client-modules: cannot resolve "${specifier}" \u2014 not a seed word, not a materialized module, and not a row in the boot graph (the runtime mirror of the bundle purity gate)`
      );
    }
    return this.recordingImportError(id, async () => {
      await this.arriveGraphRow(row);
      return this.materialize(id).exports;
    });
  }
  async prefetch(id) {
    const normalized = stripClientSuffix(id);
    if (this.loadCache.has(normalized)) return;
    const row = this.graphRows.get(normalized);
    if (row === void 0) throw new Error(`client-modules: prefetch("${id}") \u2014 not a graph entry`);
    await this.recordingImportError(normalized, () => this.arriveGraphRow(row));
  }
  importError(id) {
    return this.importErrors.get(stripClientSuffix(id));
  }
  /**
   * Run one graph-row operation, recording its failure for the boot audit and
   * clearing the record on success. Arrival and materialization both run in
   * here, so a factory that throws is recorded as well as a bundle that never
   * arrived; the Loader only sees a missing fiber either way.
   */
  async recordingImportError(id, operation) {
    try {
      const result = await operation();
      this.importErrors.delete(id);
      return result;
    } catch (error) {
      this.importErrors.set(id, error instanceof Error ? error : new Error(describeError(error)));
      throw error;
    }
  }
  /** Refresh descriptors and unowned factory revisions before any entry imports its dependencies. */
  updateManifest(manifest, managed) {
    for (const id of this.bootstrapIds) {
      if (this.manifest.modules.some((row) => row.id === id) && !manifest.modules.some((row) => row.id === id)) {
        throw new Error(`client-modules: removing bootstrap module ${id} requires a page reload`);
      }
    }
    const owned = new Set(managed);
    for (const row of manifest.modules) {
      this.graphRows.set(row.id, { ...row, initialUrl: row.url });
      const cachedRevision = this.factories.get(row.id)?.rev ?? this.reloadTargets.get(row.id)?.rev;
      if (!owned.has(row.id) && cachedRevision !== void 0 && cachedRevision !== row.rev) {
        this.invalidate(row.id, row.rev);
        removeOwnedStyles(row.id);
      }
    }
    this.manifest = manifest;
  }
  /** Retain live Loader modules and their transitive requests before evicting unreferenced graph records. */
  prune(roots) {
    const retained = new Set(this.bootstrapIds);
    const visit = (specifier) => {
      const id = stripClientSuffix(specifier);
      if (retained.has(id)) return;
      retained.add(id);
      const row = this.graphRows.get(id);
      for (const request of [...row?.external ?? [], ...row?.inject ?? [], ...this.loadCache.get(id)?.edges ?? []]) {
        visit(request);
      }
    };
    for (const row of this.manifest.modules) visit(row.id);
    for (const id of roots) visit(id);
    for (const id of this.graphRows.keys()) {
      if (retained.has(id)) continue;
      this.graphRows.delete(id);
      this.invalidate(id);
      removeOwnedStyles(id);
    }
  }
  invalidate(id, rev) {
    const normalized = stripClientSuffix(id);
    if (this.bootstrapIds.has(normalized)) return;
    this.importErrors.delete(normalized);
    this.generations.set(normalized, (this.generations.get(normalized) ?? 0) + 1);
    const row = this.graphRows.get(normalized);
    if (row !== void 0) {
      const revision = rev ?? row.rev;
      this.reloadTargets.set(normalized, { url: atRevision(row.url, revision), rev: revision });
    } else this.reloadTargets.delete(normalized);
    for (const key of this.factories.keys()) {
      if (key === normalized || key.startsWith(`${normalized}/client.`)) this.factories.delete(key);
    }
    for (const key of this.loadCache.keys()) {
      if (key === normalized || key.startsWith(`${normalized}/client.`)) this.loadCache.delete(key);
    }
  }
};

// index.ts
function createClientModuleSystem(target, bootstrapModule, options) {
  return new ClientModuleSystem({
    manifest: parseBootManifest(options.boot),
    staticModules: options.staticModules,
    registrationTarget: target,
    bootstrapModule,
    ...options.loadBundle === void 0 ? {} : { loadBundle: options.loadBundle }
  });
}
var inject = ["loader"];
function apply(ctx) {
  const loader = ctx.loader;
  const modules = loader.internal;
  if (modules?.version !== "client") {
    throw new Error("client-modules: the Loader has no client module system");
  }
  ctx.reflect.provide("modules", modules);
}
return module.exports; } });
