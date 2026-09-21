window.__ModuleLoader__.load({ id: "dsh-nexttavern-session-controller", factory: function (require) { var module = { exports: {} }; var exports = module.exports;
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

// index.js
var index_exports = {};
__export(index_exports, {
  MutableSessionEventSource: () => MutableSessionEventSource,
  SESSION_SEARCH_RESULT_LIMIT: () => SESSION_SEARCH_RESULT_LIMIT,
  SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS: () => SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS,
  SessionCreateError: () => SessionCreateError,
  SessionEventStream: () => SessionEventStream,
  SessionForkError: () => SessionForkError,
  apply: () => apply,
  createScope: () => createScope,
  createSessionControlStream: () => createSessionControlStream,
  inject: () => inject,
  scopeOf: () => scopeOf
});
module.exports = __toCommonJS(index_exports);

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
var import_cordis = require("@deepseek-ai/cordis");
var RemoteError = class extends Error {
  code;
  details;
  /** Structural marker: cross-realm/bundle identification never uses instanceof. */
  isDSHRemoteError = true;
  /**
  * @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
  * @param message - human diagnostic carried across the wire.
  * @param details - structured payload typed by the code.
  * @param options - standard Error options (`cause` survives in-process only).
  */
  constructor(code, message, details, options) {
    super(message, options);
    this.code = code;
    this.details = details;
    this.name = "RemoteError";
  }
};
var TYPERT_OWNED_VALUE = Symbol.for("dsh.typert.owned-value");
function typertOwnedValue(value, release) {
  let active = true;
  return {
    [TYPERT_OWNED_VALUE]: true,
    value,
    [Symbol.dispose]() {
      if (!active) return;
      active = false;
      release();
    }
  };
}

// transport.js
var import_client = require("@deepseek-ai/dsh-api-gateway/client");

// sessions/history-records.js
function historyEntries(records) {
  return records;
}
function historyRecordFirstSeq(record) {
  return record.event.seq;
}
function historyRecordLastSeq(record) {
  return record.event.seq;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-brand/lib/index.js
function brandNumber(value) {
  return value;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-session/lib/types/types.js
function SessionSeq(value) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  }
  return brandNumber(value);
}
function SessionLogOffset(value) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
  }
  return brandNumber(value);
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-session/lib/types/known-event-types.js
var KNOWN_SESSION_EVENT_TYPES = /* @__PURE__ */ new Set([
  "agent-preset/selected",
  "agent/inbox/spliced",
  "approval/asked",
  "approval/decided",
  "approval/policy",
  "assistant/attempt",
  "assistant/message",
  "command/done",
  "command/run",
  "compaction/end",
  "compaction/prune",
  "compaction/start",
  "compaction/summary",
  "deliverables/presented",
  "feedback/message-delete",
  "feedback/message-put",
  "feedback/record",
  "goal/change",
  "hook/invoked",
  "hook/result",
  "image/offload",
  "llm/retry",
  "llm/retry-started",
  "model/selection",
  "permission/preset",
  "plan/mode",
  "request/context",
  "request/header",
  "sandbox/mode",
  "schedule/change",
  "session-log-deepseek/delivery-accepted",
  "session/end-seed",
  "session/title",
  "session/title-llm-request",
  "step/end",
  "step/start",
  "subagent/catalog",
  "subagent/descriptor",
  "subagent/model-selection-policy",
  "system/message",
  "team/member",
  "team/message/delivered",
  "team/message/queued",
  "team/task",
  "todo/write",
  "tool-workflow/agent-end",
  "tool-workflow/agent-start",
  "tool-workflow/run-end",
  "tool-workflow/run-start",
  "tool/call",
  "tool/ptc-dispatch",
  "tool/ptc-dispatch-start",
  "tool/result",
  "turn/end",
  "turn/start",
  "user/message",
  "web/deepseek-search-llm-request",
  "workspace/changes"
]);

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-session/lib/types/surface.js
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
function isSurfaceEligibleType(type) {
  return SURFACE_EVENT_TYPES.has(type);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateSessionEventData(event, subject) {
  const data = event.data;
  if (event.type === "request/header") {
    if (!isRecord(data))
      throw new Error(`${subject} data must be an object`);
    const header = data["header"];
    if (!isRecord(header))
      throw new Error(`${subject} header must be an object`);
    if (Object.hasOwn(header, "system"))
      throw new Error(`${subject} must omit header.system; use system/message`);
    if (Array.isArray(header["tools"]) && header["tools"].length === 0) {
      throw new Error(`${subject} must omit empty tools`);
    }
    const defaults = header["adapterDefaults"];
    if (isRecord(defaults) && Object.keys(defaults).length === 0) {
      throw new Error(`${subject} must omit empty adapterDefaults`);
    }
  } else if (event.type === "tool/result") {
    if (!isRecord(data))
      throw new Error(`${subject} data must be an object`);
    if (data["error"] === void 0)
      return;
    const message = data["message"];
    const content = isRecord(message) ? message["content"] : void 0;
    const block = Array.isArray(content) ? content[0] : void 0;
    if (!isRecord(block) || block["isError"] !== true) {
      throw new Error(`${subject} error requires message content[0].isError === true`);
    }
  }
}
function isEventSeq(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}
function isReplaceOp(value) {
  const op = value;
  return Object.keys(op).length === 3 && Object.hasOwn(op, "op") && Object.hasOwn(op, "startSeq") && Object.hasOwn(op, "endSeq") && op["op"] === "replace" && isEventSeq(op["startSeq"]) && isEventSeq(op["endSeq"]);
}
function surfaceOpOf(event) {
  const raw = event;
  if (!isSurfaceEligibleType(event.type)) {
    if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true)
      return;
    if (raw.surfaceOp !== void 0) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
    }
    if (raw.sourceEventSeqs !== void 0) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
    }
    return;
  }
  const op = raw.surfaceOp;
  if (op === void 0) {
    throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
  }
  if (op === "append")
    return op;
  if (op === null || typeof op !== "object" || Array.isArray(op)) {
    throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
  }
  if (!isReplaceOp(op)) {
    throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
  }
  return op;
}
function assertSourceEventReferences(event, shadowedSeqs) {
  const raw = event.sourceEventSeqs;
  if (event.type === "assistant/message" && raw !== void 0) {
    throw new Error("assistant/message embeds its source stream and cannot carry sourceEventSeqs");
  }
  const sources = /* @__PURE__ */ new Set();
  if (raw !== void 0) {
    if (!Array.isArray(raw)) {
      throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
    }
    if (raw.length === 0) {
      throw new Error("sourceEventSeqs must not be empty");
    }
    let nonEarlierSource;
    for (const source of raw) {
      if (!isEventSeq(source)) {
        throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
      }
      sources.add(source);
      if (nonEarlierSource === void 0 && source >= event.seq)
        nonEarlierSource = source;
    }
    if (sources.size !== raw.length) {
      throw new Error("sourceEventSeqs must not contain duplicates");
    }
    if (nonEarlierSource !== void 0) {
      throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
    }
  }
  const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
  if (missing.length > 0) {
    throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`);
  }
}
function validateSurfaceMetadata(event) {
  const op = surfaceOpOf(event);
  if (op !== void 0 && op !== "append" && (op.startSeq >= event.seq || op.endSeq >= event.seq)) {
    throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
  }
  if (op !== void 0)
    assertSourceEventReferences(event, []);
  return op;
}

// session-wire-event.js
function assertSessionWireEvent(value) {
  const subject = "session wire event";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${subject} must be an object`);
  }
  const event = value;
  for (const key of Object.keys(event)) {
    switch (key) {
      case "type":
      case "seq":
      case "time":
      case "data":
      case "ignorable":
      case "surfaceOp":
      case "sourceEventSeqs":
        break;
      default:
        throw new Error(`${subject} has unexpected field ${key}`);
    }
  }
  const seq = event["seq"];
  if (typeof event["type"] !== "string" || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0) || typeof event["time"] !== "number" || !Number.isSafeInteger(event["time"]) || !Object.hasOwn(event, "data") || event["data"] === void 0 || Object.hasOwn(event, "ignorable") && event["ignorable"] !== true) {
    throw new Error(`${subject} has an invalid envelope`);
  }
  const current = event;
  validateSurfaceMetadata(current);
  validateSessionEventData(current, subject);
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/types.js
var SESSION_SEARCH_RESULT_LIMIT = 20;
var SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS = 240;

// transport.js
function toSessionJournalChange(change) {
  switch (change.type) {
    case "replace":
    case "prepend":
      return { ...change, entries: historyEntries(change.entries) };
    case "append": {
      return {
        type: "append",
        entry: change.entry
      };
    }
    case "notification":
      return { type: "assistant-stream", frame: change.notification };
  }
}
function createSessionControlStream(remote, options) {
  const stream = remote.$stream({
    name: "session control stream",
    open: (signal) => remote.session.control(signal),
    ended: (accepted) => accepted ? new import_client.RemoteStreamCarrierError("session control stream ended without a terminal result") : new Error("session control stream ended before its opening snapshot"),
    ...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed }
  });
  return new import_client.RemoteSnapshotStream(stream, {
    name: "session control stream",
    isSnapshot: (frame) => frame.type === "baseline",
    replace: options.accept,
    update: options.accept,
    failed: options.failed
  });
}
var SessionEventStream = class extends import_client.RemoteJournalStream {
  remote;
  address;
  /**
   * @param remote - generated Session namespace and Gateway stream factory.
   * @param address - durable ordinary-Session or direct-subagent address.
   * @param options - Session event-window destinations.
   */
  constructor(remote, address, options) {
    super(remote, {
      name: "session event stream",
      emptyCursor: -1,
      entries: (page) => page.records,
      hasMore: (page) => page.hasMore,
      first: historyRecordFirstSeq,
      last: historyRecordLastSeq,
      compare: (left, right) => left - right,
      follows: (left, right) => right === left + 1,
      publish: (change) => {
        options.publish(toSessionJournalChange(change));
      },
      ...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed },
      failed: options.failed
    });
    this.remote = remote;
    this.address = address;
  }
  /** @inheritdoc */
  async *follow(request, signal) {
    let assistantRevision;
    for await (const frame of this.remote.session.follow({
      address: this.address,
      assistantStream: true,
      ...request.maxMessages === void 0 ? {} : { maxMessages: request.maxMessages }
    }, signal)) {
      if (frame.type === "snapshot") {
        for (const record of frame.records)
          assertSessionWireEvent(record.event);
        if (frame.assistantStream === void 0) {
          throw new RemoteError("gateway/internal", "session assistant stream omitted its opted-in opening baseline", {});
        }
        assistantRevision = frame.assistantStream.revision;
        yield {
          type: "opened",
          cursor: frame.cursor,
          page: {
            records: frame.records,
            hasMore: frame.hasMore,
            projections: frame.projections,
            assistantStream: frame.assistantStream
          }
        };
        continue;
      }
      if (frame.type === "assistant-stream") {
        const expected = (assistantRevision ?? 0) + 1;
        if (frame.frame.revision !== expected) {
          throw new import_client.RemoteStreamCarrierError(`session assistant stream skipped revision ${String(expected)}`);
        }
        assistantRevision = frame.frame.revision;
        yield { type: "notification", notification: frame.frame };
        continue;
      }
      assertSessionWireEvent(frame.event);
      yield { type: "entry", entry: frame };
    }
  }
  /** @inheritdoc */
  async readPage(request, throughSeq, signal) {
    const result = await this.remote.session.page({ address: this.address, throughSeq, ...request }, signal);
    if (!result.ok)
      throw result.error;
    for (const record of result.value.records)
      assertSessionWireEvent(record.event);
    return result.value;
  }
  /** @inheritdoc */
  repairRequest(request) {
    return request.maxMessages === void 0 ? {} : { maxMessages: request.maxMessages };
  }
};

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-workspace-path/lib/index.js
function workspaceTitleOf(path) {
  const trimmed = path.replace(/[/\\]+$/, "");
  const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return trimmed.slice(separator + 1);
}

// sessions/service.js
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

// scope.js
var import_cordis2 = require("@deepseek-ai/cordis");
var kScope = Symbol("dsh.client.scope");
function agentScope() {
}
function createScope(ctx, key) {
  const fiber = ctx.plugin(agentScope);
  const identity = { sessionId: key };
  const scoped = fiber.ctx.extend({
    [kScope]: identity,
    [import_cordis2.Context.filter](listenerCtx) {
      const tag = scopeIdentityOf(listenerCtx);
      return tag === void 0 || tag === identity;
    }
  });
  return {
    fiber,
    ctx: scoped
  };
}
function scopeOf(ctx) {
  return scopeIdentityOf(ctx)?.sessionId;
}
function scopeIdentityOf(ctx) {
  return ctx[kScope];
}

// ordered-baseline.js
function mergeOrderedBaseline(current, baseline, keyOf) {
  const baselineByKey = /* @__PURE__ */ new Map();
  for (const value of baseline)
    baselineByKey.set(keyOf(value), value);
  const merged = current.map((value) => baselineByKey.get(keyOf(value))).filter((value) => value !== void 0);
  const mergedKeys = new Set(merged.map(keyOf));
  for (let index = 0; index < baseline.length; index++) {
    const value = baseline[index];
    if (value === void 0 || mergedKeys.has(keyOf(value)))
      continue;
    let insertion = merged.length;
    for (let following = index + 1; following < baseline.length; following++) {
      const candidate = baseline[following];
      if (candidate === void 0)
        continue;
      const known = merged.findIndex((item) => keyOf(item) === keyOf(candidate));
      if (known !== -1) {
        insertion = known;
        break;
      }
    }
    merged.splice(insertion, 0, value);
    mergedKeys.add(keyOf(value));
  }
  return merged;
}

// sessions/manager.js
var import_client3 = require("@deepseek-ai/dsh-api-gateway/client");

// sessions/lineage.js
function flattenLineage(summaries) {
  const byId = /* @__PURE__ */ new Map();
  for (const s of summaries)
    byId.set(s.sessionId, s);
  const children = /* @__PURE__ */ new Map();
  const roots = [];
  for (const s of summaries) {
    if (s.parentSessionId !== void 0 && byId.has(s.parentSessionId)) {
      const list = children.get(s.parentSessionId) ?? [];
      list.push(s);
      children.set(s.parentSessionId, list);
    } else {
      roots.push(s);
    }
  }
  const out = [];
  const visited = /* @__PURE__ */ new Set();
  const walk = (s, depth) => {
    if (visited.has(s.sessionId)) {
      console.warn(`[session-controller] lineage cycle at ${s.sessionId}; emitting as root`);
      return;
    }
    visited.add(s.sessionId);
    out.push({
      ...s,
      depth
    });
    const kids = children.get(s.sessionId);
    if (kids === void 0)
      return;
    for (const kid of kids)
      walk(kid, depth + 1);
  };
  for (const root of roots)
    walk(root, 0);
  for (const s of summaries) {
    if (!visited.has(s.sessionId))
      walk(s, 0);
  }
  return out;
}

// sessions/notifier.js
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
var Notifier = class {
  rebuild;
  listeners = /* @__PURE__ */ new Set();
  dirty = false;
  notifyPending = false;
  scheduled = "none";
  scheduleGeneration = 0;
  /** @param rebuild - snapshot rebuild function injected by the owner (writes the owner's snapshotCache). */
  constructor(rebuild) {
    this.rebuild = rebuild;
  }
  /**
   * uSES subscription entry.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Mark the snapshot dirty and notify in a microtask. */
  markDirty() {
    this.dirty = true;
    this.notifyPending = true;
    if (this.scheduled === "microtask")
      return;
    this.schedule("microtask");
  }
  /** Mark the snapshot dirty and publish cumulative state at most once per frame. */
  markFrameDirty() {
    this.dirty = true;
    this.notifyPending = true;
    if (this.scheduled !== "none")
      return;
    this.schedule(typeof globalThis.requestAnimationFrame === "function" ? "frame" : "microtask");
  }
  /**
   * Synchronous flush: controlled-input writes must notify in the same tick as
   * onChange, or React rolls the DOM back to the stale value and the caret jumps to the end.
   */
  notifyNow() {
    this.dirty = true;
    this.notifyPending = true;
    this.invalidateSchedule();
    this.flush();
  }
  /**
   * Pre-getSnapshot check: rebuild synchronously when dirty (read path
   * before first subscribe / while unobserved). Notification stays pending.
   */
  ensureFresh() {
    if (!this.dirty)
      return;
    this.dirty = false;
    this.rebuild();
  }
  schedule(kind) {
    const generation = ++this.scheduleGeneration;
    this.scheduled = kind;
    const publish = () => {
      if (generation !== this.scheduleGeneration)
        return;
      this.scheduled = "none";
      this.flush();
    };
    if (kind === "frame") {
      globalThis.requestAnimationFrame(publish);
    } else {
      queueMicrotask(publish);
    }
  }
  invalidateSchedule() {
    this.scheduleGeneration++;
    this.scheduled = "none";
  }
  flush() {
    if (!this.notifyPending)
      return;
    if (this.listeners.size === 0)
      return;
    this.notifyPending = false;
    if (this.dirty) {
      this.dirty = false;
      this.rebuild();
    }
    (0, import_dsh_client_store.notifySubscribers)(this.listeners, "[session-controller]");
  }
};

// sessions/projection-store.js
var ProjectionValueStore = class {
  rows = /* @__PURE__ */ new Map();
  channels = /* @__PURE__ */ new Map();
  valuesCache;
  /** Coarse any-key channel (no snapshot cache to rebuild: reads hit rows directly). */
  anyNotifier = new Notifier(() => {
  });
  /**
   * Key-addressed bare observable face (the useProjection resolution path).
   * Always defined — absence is an `undefined` snapshot, never a missing
   * face, so a component may subscribe before the key ever carries a value.
   * @param key - projection key.
   * @returns the identity-stable face for this key.
   */
  faceOf(key) {
    return this.channel(key).face;
  }
  /**
   * Current whole value for a key (erased framework read; typed reads go
   * through `useProjection`'s map lookup).
   * @param key - projection key.
   * @returns the value, or undefined while the key is absent.
   */
  get(key) {
    return this.rows.get(key)?.value;
  }
  /**
   * Read every current projection value as one reference-stable snapshot.
   * @returns The same frozen value map until a row changes.
   */
  values() {
    if (this.valuesCache === void 0) {
      this.valuesCache = Object.freeze(Object.fromEntries([...this.rows].map(([key, row]) => [key, row.value])));
    }
    return this.valuesCache;
  }
  /**
   * Subscribe to any-key changes (microtask-batched) — the manager's list
   * rebuild channel.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribeAny(listener) {
    return this.anyNotifier.subscribe(listener);
  }
  /**
   * Apply one finished value from the Session control stream.
   * @param key - projection key.
   * @param value - whole value computed by the host unit.
   * @param seq - the unit's watermark at emission.
   */
  apply(key, value, seq) {
    const row = this.rows.get(key);
    if (row !== void 0 && seq <= row.seq)
      return;
    this.rows.set(key, { value, seq });
    this.changed(key);
  }
  /**
   * Seed from a history tail page's projections block: every carried key
   * lands under the same seq rule as frames; a key the block omits is
   * capability-absent as of the cut — its row clears unless a newer frame
   * already superseded the cut (a stale baseline can neither overwrite nor
   * clear newer values).
   * @param baseline - the response's projections block.
   */
  seed(baseline) {
    const values = baseline.values;
    for (const key of Object.keys(values))
      this.apply(key, values[key], baseline.asOfSeq);
    for (const [key, row] of this.rows) {
      if (Object.hasOwn(values, key))
        continue;
      if (row.seq > baseline.asOfSeq)
        continue;
      this.rows.delete(key);
      this.changed(key);
    }
  }
  /** Discard one Host generation's values and watermarks while preserving subscribed faces. */
  clear() {
    for (const key of this.rows.keys()) {
      this.rows.delete(key);
      this.changed(key);
    }
  }
  changed(key) {
    this.valuesCache = void 0;
    this.channels.get(key)?.notifier.markDirty();
    this.anyNotifier.markDirty();
  }
  channel(key) {
    let channel = this.channels.get(key);
    if (channel === void 0) {
      const notifier = new Notifier(() => {
      });
      channel = {
        notifier,
        face: {
          getSnapshot: () => this.rows.get(key)?.value,
          subscribe: (listener) => notifier.subscribe(listener)
        }
      };
      this.channels.set(key, channel);
    }
    return channel;
  }
};

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-crypto/lib/index.js
function randomUUID() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
  }).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// contract/events.js
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
function leaf(entries) {
  return { kind: "leaf", entries, length: entries.length };
}
function concat(left, right) {
  return { kind: "concat", left, right, length: left.length + right.length };
}
function materialize(node) {
  if (node.kind === "leaf")
    return node.entries;
  const entries = new Array(node.length);
  const pending = [node];
  let index = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current.kind === "concat") {
      pending.push(current.right, current.left);
      continue;
    }
    for (const entry of current.entries) {
      entries[index] = entry;
      index += 1;
    }
  }
  return entries;
}
function windowSnapshot(node, hasMore, revision, change) {
  let entries;
  return {
    get entries() {
      entries ??= materialize(node);
      return entries;
    },
    hasMore,
    revision,
    change
  };
}
var MutableSessionEventSource = class {
  listeners = /* @__PURE__ */ new Set();
  window = leaf([]);
  snapshot = windowSnapshot(this.window, false, 0, { kind: "replace", entries: [] });
  /** @returns the cached event-window snapshot. */
  getSnapshot() {
    return this.snapshot;
  }
  /**
   * Subscribe to synchronous window publication.
   * @param listener - invalidation callback.
   * @returns unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /**
   * Replace the complete contiguous window.
   * @param entries - complete window.
   * @param hasMore - whether older history remains.
   */
  replace(entries, hasMore) {
    this.window = leaf(entries);
    this.publish(hasMore, { kind: "replace", entries });
  }
  /**
   * Prepend one older contiguous page.
   * @param entries - newly loaded older entries.
   * @param hasMore - whether still older history remains.
   */
  prepend(entries, hasMore) {
    this.window = concat(leaf(entries), this.window);
    this.publish(hasMore, { kind: "prepend", entries });
  }
  /**
   * Append one contiguous live entry.
   * @param entry - live tail entry.
   */
  append(entry) {
    const entries = [entry];
    this.window = concat(this.window, leaf(entries));
    this.publish(this.snapshot.hasMore, {
      kind: "append",
      entries
    });
  }
  /**
   * Replace one attempt's transient rows with its committed durable settlement.
   * @param attemptId - process-local attempt whose live rows are now redundant.
   * @param entry - durable settlement committed for that attempt.
   */
  settleAssistant(attemptId, entry) {
    const entries = materialize(this.window).filter((candidate) => candidate.type !== "transient" || candidate.event.data.attemptId !== attemptId);
    if (entry !== void 0) {
      const index = entries.findIndex((candidate) => candidate.event.seq > entry.event.seq);
      if (index < 0)
        entries.push(entry);
      else
        entries.splice(index, 0, entry);
    }
    this.window = leaf(entries);
    this.publish(this.snapshot.hasMore, {
      kind: "settle-assistant",
      attemptId,
      ...entry === void 0 ? {} : { entry }
    });
  }
  publish(hasMore, change) {
    this.snapshot = windowSnapshot(this.window, hasMore, this.snapshot.revision + 1, change);
    (0, import_dsh_client_store2.notifySubscribers)(this.listeners, "[session-controller] event feed");
  }
};

// sessions/session.js
var import_client2 = require("@deepseek-ai/dsh-api-gateway/client");

// time-zone.js
function resolvedClientTimeZone() {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new Error("browser time zone is unavailable");
  }
  return timeZone;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
function hasIntrinsicConstructor(prototype, name) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
function hasPlainArrayPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
function hasPlainObjectPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
}
function enumerableStringKeys(value) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
  return keys;
}
function walkJsonValue(value, detach) {
  const ancestors = /* @__PURE__ */ new Set();
  let root;
  const assign = (destination, item) => {
    if (destination === void 0) return;
    if (destination.kind === "root") root = item;
    else if (destination.kind === "array") destination.target[destination.index] = item;
    else Object.defineProperty(destination.target, destination.key, {
      value: item,
      enumerable: true,
      configurable: true,
      writable: true
    });
  };
  const tasks = [{
    kind: "visit",
    value,
    ...detach ? { destination: { kind: "root" } } : {}
  }];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (task.kind === "leave") {
      ancestors.delete(task.source);
      continue;
    }
    if (task.kind === "array-item") {
      if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return void 0;
      tasks.push({
        kind: "visit",
        value: task.source[task.index],
        ...task.target === void 0 ? {} : { destination: {
          kind: "array",
          target: task.target,
          index: task.index
        } }
      });
      continue;
    }
    if (task.kind === "object-property") {
      tasks.push({
        kind: "visit",
        value: task.source[task.key],
        ...task.target === void 0 ? {} : { destination: {
          kind: "object",
          target: task.target,
          key: task.key
        } }
      });
      continue;
    }
    const current = task.value;
    if (current === null) {
      assign(task.destination, null);
      continue;
    }
    if (typeof current === "boolean" || typeof current === "string") {
      assign(task.destination, current);
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
      assign(task.destination, current);
      continue;
    }
    if (typeof current !== "object") return void 0;
    if (ancestors.has(current)) return void 0;
    if (Array.isArray(current)) {
      if (!hasPlainArrayPrototype(current)) return void 0;
      const length = current.length;
      if (Reflect.ownKeys(current).length !== length + 1) return void 0;
      const target2 = detach ? [] : void 0;
      if (target2 !== void 0) assign(task.destination, target2);
      ancestors.add(current);
      tasks.push({
        kind: "leave",
        source: current
      });
      for (let index = length - 1; index >= 0; index--) tasks.push({
        kind: "array-item",
        source: current,
        index,
        ...target2 === void 0 ? {} : { target: target2 }
      });
      continue;
    }
    if (!hasPlainObjectPrototype(current)) return void 0;
    const keys = enumerableStringKeys(current);
    if (keys === void 0) return void 0;
    const target = detach ? {} : void 0;
    if (target !== void 0) assign(task.destination, target);
    ancestors.add(current);
    tasks.push({
      kind: "leave",
      source: current
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) return void 0;
      tasks.push({
        kind: "object-property",
        source: current,
        key,
        ...target === void 0 ? {} : { target }
      });
    }
  }
  return detach ? root : true;
}
function snapshotJsonValue(value) {
  return walkJsonValue(value, true);
}
function deepFreeze(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const pending = [{
    kind: "visit",
    node: value
  }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === void 0) continue;
    if (task.kind === "property") {
      pending.push({
        kind: "visit",
        node: task.source[task.key]
      });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) continue;
      pending.push({
        kind: "property",
        source: node,
        key
      });
    }
  }
  return value;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-llm/lib/types/assistant-stream.js
function safeTime(value) {
  if (!Number.isSafeInteger(value))
    throw new TypeError(`Assistant stream time must be a safe integer, got ${String(value)}`);
  return value;
}
function safeIndex(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`${label} index must be a non-negative safe integer`);
  }
  return value;
}
function snapshotChunk(chunk) {
  const snapshot = snapshotJsonValue(chunk);
  if (snapshot === void 0)
    throw new TypeError("Assistant stream chunk must be losslessly JSON-serializable");
  return snapshot;
}
function expandAssistantStream(stream) {
  const chunks = [];
  for (const candidate of stream) {
    const record = validateRecord(candidate);
    if (record.type === "chunk") {
      chunks.push({ time: record.time, chunk: record.chunk });
      continue;
    }
    const members = record.type === "tool-call-chunks" ? record.args : record.texts;
    let time = record.time0;
    for (let index = 0; index < members.length; index += 1) {
      if (index > 0)
        time += record.dt[index - 1];
      let chunk;
      if (record.type === "text-chunks") {
        chunk = { type: "text-delta", index: record.index, text: members[index] };
      } else if (record.type === "reasoning-chunks") {
        chunk = { type: "reasoning-delta", index: record.index, text: members[index] };
      } else {
        chunk = {
          type: "tool-call-delta",
          index: record.index,
          id: record.id,
          ...Object.hasOwn(record, "name") ? { name: record.name } : {},
          argumentsDelta: members[index]
        };
      }
      chunks.push({ time, chunk });
    }
  }
  return chunks;
}
function validateRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Assistant stream record must be an object");
  }
  const record = value;
  switch (record.type) {
    case "text-chunks":
    case "reasoning-chunks": {
      exactKeys(record, ["type", "time0", "index", "dt", "texts"], record.type);
      const texts = stringArray(record.texts, `${record.type} texts`);
      if (texts.length === 0)
        throw new TypeError(`${record.type} texts must be non-empty`);
      validateRun(record, texts.length, record.type);
      return record;
    }
    case "tool-call-chunks": {
      const keys = Object.hasOwn(record, "name") ? ["type", "time0", "index", "dt", "id", "name", "args"] : ["type", "time0", "index", "dt", "id", "args"];
      exactKeys(record, keys, record.type);
      const args = stringArray(record.args, "tool-call-chunks args");
      if (args.length === 0)
        throw new TypeError("tool-call-chunks args must be non-empty");
      if (typeof record.id !== "string" || record.id.length === 0) {
        throw new TypeError("tool-call-chunks id must be a non-empty string");
      }
      if (record.name !== void 0 && (typeof record.name !== "string" || record.name.length === 0)) {
        throw new TypeError("tool-call-chunks name must be a non-empty string");
      }
      validateRun(record, args.length, record.type);
      return record;
    }
    case "chunk": {
      exactKeys(record, ["type", "time", "chunk"], "chunk");
      const time = safeTime(record.time);
      if (typeof record.chunk !== "object" || record.chunk === null || Array.isArray(record.chunk)) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object");
      }
      let chunk;
      try {
        chunk = snapshotChunk(record.chunk);
      } catch (error) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object", { cause: error });
      }
      return deepFreeze({ type: "chunk", time, chunk });
    }
    default:
      throw new TypeError(`Unsupported Assistant stream record ${JSON.stringify(record.type)}`);
  }
}
function validateRun(record, members, label) {
  safeTime(record.time0);
  safeIndex(record.index, label);
  if (!Array.isArray(record.dt) || record.dt.some((value) => !Number.isSafeInteger(value))) {
    throw new TypeError(`${label} dt must contain safe integers`);
  }
  if (record.dt.length !== members - 1) {
    throw new TypeError(`${label} dt length must be one less than its members`);
  }
  let time = record.time0;
  for (const gap of record.dt) {
    time += gap;
    if (!Number.isSafeInteger(time))
      throw new TypeError(`${label} member times must stay safe integers`);
  }
}
function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((member) => typeof member !== "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  return value;
}
function exactKeys(record, keys, label) {
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) {
    throw new TypeError(`${label} Assistant stream record must contain exactly ${keys.join(", ")}`);
  }
}

// sessions/assistant-stream.js
var ClientAssistantStream = class {
  activeAttempt;
  pending = /* @__PURE__ */ new Map();
  publishedSeqs = /* @__PURE__ */ new Set();
  durableCursor = -1;
  transientInGap = 0;
  /**
   * Replace the durable Web window and adopt an optional reconnect baseline.
   * @param entries - durable entries in the replacement window.
   * @param baseline - compact prefix for an Assistant attempt that is still live.
   * @returns immediately visible durable entries plus reconstructed transient chunks.
   */
  replace(entries, baseline) {
    this.pending.clear();
    this.transientInGap = 0;
    this.activeAttempt = void 0;
    const opening = baseline?.activeAttempt;
    if (opening !== void 0) {
      this.activeAttempt = {
        attemptId: opening.attemptId,
        startedAfterSeq: opening.startedAfterSeq,
        turn: opening.turn,
        step: opening.step,
        nextIndex: opening.nextIndex
      };
    }
    const visible = [...entries];
    this.publishedSeqs = new Set(visible.map((entry) => entry.event.seq));
    this.durableCursor = visible.reduce((cursor, entry) => Math.max(cursor, entry.event.seq), -1);
    if (opening !== void 0) {
      for (const [index, member] of expandAssistantStream(opening.stream).entries()) {
        this.transientInGap += 1;
        visible.push({
          type: "transient",
          event: {
            type: "assistant/live-chunk",
            seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
            time: member.time,
            data: {
              attemptId: opening.attemptId,
              turn: opening.turn,
              step: opening.step,
              chunk: member.chunk
            }
          }
        });
        if (index + 1 >= opening.nextIndex)
          break;
      }
    }
    return visible;
  }
  /**
   * Stage one durable v2 settlement while its matching live attempt is open.
   * @param entry - newly followed durable entry.
   * @returns a publication decision, or `undefined` when no entry becomes visible.
   */
  acceptDurable(entry) {
    const event = entry.event;
    this.durableCursor = Math.max(this.durableCursor, event.seq);
    this.transientInGap = 0;
    const settlement = assistantSettlementEntry(entry);
    if (settlement !== void 0 && this.attemptForSettlement(settlement.event) !== void 0) {
      if (this.pending.has(event.seq))
        return { type: "rebaseline" };
      this.pending.set(event.seq, settlement);
      return void 0;
    }
    return this.publish(entry);
  }
  /**
   * Fold one dense transient frame and release its named durable settlement.
   * @param frame - next Assistant stream frame received by the follow connection.
   * @returns a transient, publication, or rebaseline decision, or `undefined` when no entry becomes visible.
   */
  acceptFrame(frame) {
    switch (frame.type) {
      case "start":
        if (this.activeAttempt !== void 0 || this.pending.size > 0)
          return { type: "rebaseline" };
        this.pending.clear();
        this.activeAttempt = {
          attemptId: frame.attemptId,
          startedAfterSeq: frame.startedAfterSeq,
          turn: frame.turn,
          step: frame.step,
          nextIndex: 0
        };
        return void 0;
      case "chunk": {
        const attempt = this.activeAttempt;
        if (attempt === void 0 || attempt.attemptId !== frame.attemptId)
          return void 0;
        if (frame.index !== attempt.nextIndex)
          return { type: "rebaseline" };
        attempt.nextIndex += 1;
        this.transientInGap += 1;
        return {
          type: "transient",
          entry: {
            type: "transient",
            event: {
              type: "assistant/live-chunk",
              seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
              time: frame.time,
              data: {
                attemptId: frame.attemptId,
                turn: attempt.turn,
                step: attempt.step,
                chunk: frame.chunk
              }
            }
          }
        };
      }
      case "end": {
        const attempt = this.activeAttempt;
        if (attempt === void 0 || attempt.attemptId !== frame.attemptId) {
          return void 0;
        }
        this.activeAttempt = void 0;
        if (frame.index !== attempt.nextIndex)
          return { type: "rebaseline" };
        if (frame.outcome.kind === "abandoned") {
          return this.pending.size === 0 ? { type: "abandonment", attemptId: attempt.attemptId } : { type: "rebaseline" };
        }
        if (this.publishedSeqs.has(frame.outcome.seq))
          return void 0;
        const entry = this.pending.get(frame.outcome.seq);
        if (entry === void 0 || entry.event.type !== frame.outcome.eventType) {
          return { type: "rebaseline" };
        }
        this.pending.delete(frame.outcome.seq);
        this.publishedSeqs.add(entry.event.seq);
        return { type: "settlement", attemptId: attempt.attemptId, entry };
      }
    }
  }
  attemptForSettlement(event) {
    const attempt = this.activeAttempt;
    if (attempt === void 0 || event.type === "assistant/message" && event.surfaceOp !== "append" || event.seq <= attempt.startedAfterSeq || attempt.turn !== event.data.turn || attempt.step !== event.data.step)
      return void 0;
    return attempt;
  }
  publish(entry) {
    this.publishedSeqs.add(entry.event.seq);
    return { type: "publish", entry };
  }
};
function assistantSettlementEntry(entry) {
  return entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt" ? entry : void 0;
}

// sessions/session.js
function projectionsBaseline(value) {
  return {
    ...value,
    asOfSeq: value.asOfSeq === -1 ? -1 : SessionSeq(value.asOfSeq)
  };
}
var PAGE_MESSAGES = 50;
var JUMP_PAGE_MESSAGES = 200;
var Session = class {
  sessionId;
  remote;
  options;
  // ---- Window and derived state (all private; the snapshot is the only read API) ----
  baseSeq = SessionLogOffset(0);
  hasMore = false;
  openState = "cold";
  openError = null;
  openPromise = null;
  /** Bumped by stream replacement to invalidate an in-flight doOpen. Stale
   *  passes drop all writes once the generation moves on. */
  openGeneration = 0;
  loadingOlder = false;
  /** Shared low-water target of the running jump loop; null when no jump is paging. */
  jumpTargetSeq = null;
  /** The running jump loop's completion, shared by retargeting callers. */
  jumpPromise = null;
  stopObservingInbox;
  assistantStream = new ClientAssistantStream();
  running = false;
  address;
  parentAvailable;
  /**
   * Sticky send marker, private input of the composerPhase derivation: set
   * synchronously before prompt()'s first await, never reset — the blank →
   * engaging edge of the phase machine (see ComposerPhase).
   */
  promptAttempted = false;
  /** A first accepted prompt stays in the engaging phase until its turn is observable. */
  firstPromptPendingTurn = false;
  /** Empty-log mirror (see ConversationSnapshot.blank); unknown bare sessions begin conservatively blank. */
  blankBit = true;
  removed = false;
  promptError = null;
  lastAgentError = null;
  /** Local submission echoes, insertion-ordered (see SessionSnapshot.pendingSubmissions). */
  pendingSubmissions = [];
  /** Per-echo settlement state; `retiring` latches the first observation so a
   *  Inbox projection and its durable event cannot both retire one echo. */
  submissionSettlements = /* @__PURE__ */ new Map();
  /** Owns the addressed page/follow lifecycle while this Session is open. */
  events;
  /**
   * Per-session projection value store (push model; see the session-projection
   * subsystem page, docs/subsystems/session-projection.md): finished whole
   * values computed on the Host, seeded by the tail page's
   * projections block and updated by Session Controller control frames under the
   * one higher-seq-wins rule. Keys are read via `projections.faceOf(key)`
   * (the useProjection resolution face); the conversation snapshot never
   * carries projection values, and no client-side domain folding exists.
   * Manager-owned when constructed through SessionManager (frames route and
   * the store outlives instantiation, the title-snapshot precedent); a bare
   * construction gets a private store.
   */
  projections;
  /** Contiguous history and live tail consumed by Conversation assembly. */
  eventSource = new MutableSessionEventSource();
  snapshotCache;
  notifier;
  /**
   * Agent-scoped cordis context, bound once by ClientSessions when it
   * mints the scope (the client mirror of the host Agent's loopCtx). The
   * Session dispatches its own scoped events through it; undefined means
   * unbound (bare object-layer construction) or already pruned — both skip
   * dispatch-dependent behavior rather than fail.
   */
  actx;
  /**
   * @param sessionId - Host session identity (client sessions are always Host-born).
   * @param remote - generated Remote namespaces this session calls.
   * @param options - optional manager-owned state observers.
   */
  constructor(sessionId, remote, options = {}) {
    this.sessionId = sessionId;
    this.remote = remote;
    this.options = options;
    this.projections = options.projections ?? new ProjectionValueStore();
    this.address = options.address;
    this.parentAvailable = options.parentAvailable;
    this.notifier = new Notifier(() => {
      this.snapshotCache = this.buildSnapshot();
    });
    this.snapshotCache = this.buildSnapshot();
    this.stopObservingInbox = this.projections.faceOf("inbox").subscribe(() => {
      this.observeSubmissionInbox();
    });
  }
  /**
   * Bind the Agent-scoped context minted by ClientSessions (single write;
   * a second bind is a wiring error and throws). Direction stays one-way at
   * this binding boundary: consumers still reach the Session via `sessions.sessionOf`,
   * while the Session holds its own dispatch point (host Agent.loopCtx
   * mirror).
   * @param actx - the agent's scoped context.
   */
  bindScope(actx) {
    if (this.actx !== void 0)
      throw new Error(`session ${this.sessionId} already has a bound scope`);
    this.actx = actx;
  }
  /** Release the bound scope at prune time (a later rebind accompanies a freshly minted scope). */
  unbindScope() {
    this.actx = void 0;
  }
  // ---- Operations ----
  /**
   * Register one local submission echo (see the ISession declaration).
   * Synchronous through markDirty: the echo is in the very next snapshot, so
   * the conversation can paint it before the caller starts serializing.
   * @param input - echo content and the optional settlement callback.
   * @returns the minted identity for {@link prompt} plus the pre-prompt abandon path.
   */
  beginSubmission(input) {
    const requestId = randomUUID();
    this.pendingSubmissions = [...this.pendingSubmissions, {
      requestId,
      placement: this.running ? input.mode === "steer" ? "steering" : "queued" : "transcript",
      time: Date.now(),
      text: input.text,
      attachments: input.attachments
    }];
    this.submissionSettlements.set(requestId, { onRetire: input.onRetire, retiring: false });
    this.promptAttempted = true;
    this.notifier.markDirty();
    return { requestId, abandon: () => {
      this.retireFailedSubmission(requestId);
    } };
  }
  /**
   * Send (queue/steer passed through 1:1); failures land in the snapshot's promptError.
   * @param content - text, browser-owned temporary image uploads, and staged-file receipts.
   * @param mode - queue appends after the current turn; steer interrupts it.
   * @param signal - optional caller cancellation for the complete admission round-trip.
   * @param requestId - identity from {@link beginSubmission}; a failed identified prompt retires its echo.
   * @returns the prompt result (also mirrored into promptError on failure).
   */
  async prompt(content, mode, signal, requestId) {
    this.promptError = null;
    this.lastAgentError = null;
    this.promptAttempted = true;
    if (this.blankBit)
      this.firstPromptPendingTurn = true;
    this.notifier.markDirty();
    let result;
    if (this.address === void 0) {
      const clientTimeZone = resolvedClientTimeZone();
      result = await this.remote.session.prompt({
        requestId: requestId ?? randomUUID(),
        sessionId: this.sessionId,
        mode,
        content,
        clientTimeZone
      }, signal);
    } else if (content.some((part) => part.type === "file")) {
      result = {
        ok: false,
        error: new RemoteError("subagent/attachment-invalid", "subagent continuation does not accept files", { reason: "SUBAGENT_FILE_UNSUPPORTED" })
      };
    } else {
      const routedContent = content;
      const routed = await this.remote.subagents.prompt({
        requestId: randomUUID(),
        parentSessionId: this.address.parentSessionId,
        childSessionId: this.address.childSessionId,
        mode: "continuable",
        delivery: mode,
        content: routedContent,
        clientTimeZone: resolvedClientTimeZone()
      }, signal);
      result = routed.ok ? { ok: true, value: { accepted: true } } : routed;
    }
    if (!result.ok) {
      if (requestId !== void 0)
        this.retireFailedSubmission(requestId);
      this.promptError = { op: "send", error: result.error };
      this.notifier.markDirty();
      return result;
    }
    if (this.blankBit) {
      this.blankBit = false;
      this.options.onEngaged?.(this);
      this.notifier.markDirty();
    }
    return result;
  }
  /**
   * Resolve one image referenced by this session into browser-consumable bytes.
   * @param attachmentId - opaque id found in the folded session log.
   * @returns the authenticated reference and decoded bytes.
   */
  async readAttachment(attachmentId) {
    const result = await this.remote.session.attachment({
      sessionId: this.sessionId,
      attachmentId
    });
    if (!result.ok)
      return result;
    const binary = atob(result.value.data);
    const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { ok: true, value: { attachment: result.value.attachment, data } };
  }
  /** Apply one operation to a still-pending queue occurrence. */
  async updateQueue(itemId, action) {
    return this.remote.session.updateQueue({ sessionId: this.sessionId, itemId, action });
  }
  /**
   * Stop the active turn while the Host preserves pending inbox work; failures
   * land in promptError (same error-strip display slot). A subagent address
   * routes through `subagents.interruptByParent`, whose durable parent-address
   * authority works without a live parent Agent.
   * @returns the cancel result.
   */
  async cancel() {
    const address = this.address;
    const result = address !== void 0 ? await this.remote.subagents.interruptByParent(address.childSessionId, address.parentSessionId, "continuable") : await this.remote.session.cancel({ sessionId: this.sessionId });
    if (!result.ok) {
      this.promptError = { op: "stop", error: result.error };
      this.notifier.markDirty();
    }
    return result;
  }
  /**
   * Rename: contract session.rename 1:1. On success settle the 'title'
   * projection cell from the response's `{title, seq}` under the store's
   * higher-seq-wins rule (the push frame arriving later is a no-op replay),
   * so the list row and any useProjection('title') reader update without
   * waiting for the control-stream projection update.
   * @param title - raw title text (the host normalizes acceptance).
   * @returns the rename result (normalized accepted title + title event seq).
   */
  async rename(title) {
    const result = await this.remote.session.rename({ sessionId: this.sessionId, title });
    if (!result.ok)
      return result;
    const seq = SessionSeq(result.value.seq);
    this.projections.apply("title", result.value.title, seq);
    return { ok: true, value: { title: result.value.title, seq } };
  }
  /**
   * Execute one slash-command line against this session's agent — pure
   * admission semantics (the host executor durably logs the lifecycle;
   * outcomes render as flow nodes, never as a response echo).
   * @param line - the full command line, leading slash included.
   * @returns the admission result.
   */
  async command(line) {
    const result = await this.remote.commands.execute(this.sessionId, line, []);
    if (!result.ok)
      return result;
    return { ok: true, value: { matched: result.value !== void 0 } };
  }
  /** First open: pull the tail page (idempotent — in-flight/already-open returns the existing promise). */
  open() {
    if (this.openState === "open")
      return Promise.resolve();
    if (this.openPromise !== null)
      return this.openPromise;
    const promise = this.doOpen(this.openGeneration).finally(() => {
      if (this.openPromise === promise)
        this.openPromise = null;
    });
    this.openPromise = promise;
    return promise;
  }
  /** Page up: pull one earlier page with the window's first seq as beforeSeq and prepend. */
  async loadOlder() {
    if (this.openState !== "open" || !this.hasMore || this.loadingOlder)
      return;
    const events = this.events;
    if (events === void 0)
      return;
    this.loadingOlder = true;
    this.notifier.markDirty();
    try {
      await events.prepend({ beforeSeq: this.baseSeq, maxMessages: PAGE_MESSAGES });
    } catch (error) {
      if (!(0, import_client2.isRemoteFailure)(error)) {
        console.error("[session-controller] loadOlder failed:", error);
      }
    } finally {
      this.loadingOlder = false;
      this.notifier.markDirty();
    }
  }
  /** Jump loader: page backwards until the window covers seq (see ISession.loadThrough). */
  loadThrough(seq) {
    if (this.openState !== "open" || !this.hasMore || this.baseSeq <= seq)
      return Promise.resolve();
    if (this.jumpPromise !== null) {
      this.jumpTargetSeq = SessionSeq(Math.min(this.jumpTargetSeq ?? seq, seq));
      return this.jumpPromise;
    }
    if (this.loadingOlder)
      return Promise.resolve();
    this.jumpTargetSeq = seq;
    this.loadingOlder = true;
    this.notifier.markDirty();
    const generation = this.openGeneration;
    this.jumpPromise = (async () => {
      try {
        while (this.hasMore && this.jumpTargetSeq !== null && this.baseSeq > this.jumpTargetSeq) {
          if (generation !== this.openGeneration)
            return;
          const events = this.events;
          if (events === void 0)
            return;
          const before = this.baseSeq;
          await events.prepend({ beforeSeq: this.baseSeq, maxMessages: JUMP_PAGE_MESSAGES });
          if (this.baseSeq >= before)
            return;
        }
      } catch (error) {
        if (!(0, import_client2.isRemoteFailure)(error)) {
          console.error("[session-controller] loadThrough failed:", error);
        }
      } finally {
        this.jumpTargetSeq = null;
        this.jumpPromise = null;
        this.loadingOlder = false;
        this.notifier.markDirty();
      }
    })();
    return this.jumpPromise;
  }
  /** Rebuild an opened history source after address replacement.
   *  Invalidates any in-flight open first; projection state belongs to the independently
   *  reconnecting control stream and remains untouched. */
  async resync() {
    if (this.openState === "cold")
      return;
    this.openGeneration++;
    const events = this.events;
    this.events = void 0;
    await events?.dispose();
    this.openPromise = null;
    this.openState = "cold";
    this.openError = null;
    this.baseSeq = SessionLogOffset(0);
    this.notifier.markDirty();
    await this.open();
  }
  // ---- Subscription API (useSyncExternalStore direct wiring) ----
  /**
   * uSES subscription entry.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener) {
    return this.notifier.subscribe(listener);
  }
  /**
   * Cached Session snapshot (rebuilt lazily when dirty with no listeners).
   * @returns the cached reference (stable until the next flush).
   */
  getSnapshot() {
    this.notifier.ensureFresh();
    return this.snapshotCache;
  }
  // ---- Manager-only entry points (@internal; never called by the UI) ----
  /**
   * Running-bit relay from the host stream (list entry and snapshot stay consistent).
   * @param running - the new running state.
   */
  handleRunning(running) {
    if (running && this.blankBit) {
      this.blankBit = false;
      this.notifier.markDirty();
    }
    if (running)
      this.firstPromptPendingTurn = false;
    if (this.running === running)
      return;
    this.running = running;
    this.notifier.markDirty();
  }
  /**
   * Install or clear the catalog-discovered transport address. A changed
   * address rebuilds an already-open window through its new history route.
   * @param address - direct parent/child address, or undefined for ordinary transport.
   * @param parentAvailable - latest exact-parent availability hint, or undefined before a catalog read.
   */
  configureSubagent(address, parentAvailable) {
    const same = this.address?.parentSessionId === address?.parentSessionId && this.address?.childSessionId === address?.childSessionId && this.address?.mode === address?.mode;
    this.address = address;
    this.parentAvailable = parentAvailable;
    if (!same && this.openState !== "cold")
      void this.resync();
    else
      this.notifier.markDirty();
  }
  /**
   * Update only the parent availability hint from a catalog refresh.
   * @param available - whether the exact direct parent is live.
   */
  handleSubagentParentAvailable(available) {
    if (this.parentAvailable === available)
      return;
    this.parentAvailable = available;
    this.notifier.markDirty();
  }
  /**
   * Blank-bit relay from the authoritative summary source (`session.list` and
   * `api-session/added`). Monotone: once any signal (local first send,
   * running flip, an earlier summary) cleared it, a stale true never
   * re-blanks.
   * @param blank - the summary's derived empty-log bit.
   */
  handleBlank(blank) {
    if (blank === this.blankBit)
      return;
    if (blank && (this.promptAttempted || this.running))
      return;
    this.blankBit = blank;
    this.notifier.markDirty();
  }
  /** `api-session/removed` relay: flag the snapshot while retaining the resident instance. */
  handleRemoved() {
    this.removed = true;
    this.notifier.markDirty();
  }
  /**
   * `api-session/error` relay: the outlet for live failures with no turn position.
   * @param message - the stringified error.
   */
  handleAgentError(message) {
    this.lastAgentError = message;
    this.notifier.markDirty();
  }
  /**
   * Stop the Session's live Remote source.
   * @returns when the Remote iterator has completed teardown.
   */
  async dispose() {
    this.stopObservingInbox();
    for (const requestId of [...this.submissionSettlements.keys()]) {
      this.retireFailedSubmission(requestId);
    }
    this.openGeneration++;
    const events = this.events;
    this.events = void 0;
    await events?.dispose();
  }
  // ---- Private ----
  /** @param generation - openGeneration at launch; stale passes cannot publish after replacement. */
  async doOpen(generation) {
    this.openState = "loading";
    this.openError = null;
    this.notifier.markDirty();
    const events = new SessionEventStream(this.remote, this.sessionAddress(), {
      publish: (change) => {
        if (generation !== this.openGeneration || this.events !== events)
          return;
        this.acceptEventChange(change);
      },
      failed: (error) => {
        this.failEventStream(events, generation, error);
      }
    });
    this.events = events;
    try {
      await events.open({ maxMessages: PAGE_MESSAGES });
      if (generation !== this.openGeneration || this.events !== events)
        return;
      this.openState = "open";
    } catch (error) {
      if (generation !== this.openGeneration || this.events !== events)
        return;
      if (!(0, import_client2.isRemoteFailure)(error))
        throw error;
      this.events = void 0;
      this.openState = "error";
      this.openError = error;
    } finally {
      if (generation === this.openGeneration)
        this.notifier.markDirty();
    }
  }
  /** Apply one contiguous journal update already reconciled by the Remote stream. */
  acceptEventChange(change) {
    switch (change.type) {
      case "replace":
        this.installWindow(change.entries, change.hasMore, change.page.projections === void 0 ? void 0 : projectionsBaseline(change.page.projections), change.page.assistantStream);
        return;
      case "prepend":
        this.prependWindow(change.entries, change.hasMore);
        return;
      case "append":
        this.publishAssistantEntry(this.assistantStream.acceptDurable(change.entry));
        return;
      case "assistant-stream":
        this.publishAssistantEntry(this.assistantStream.acceptFrame(change.frame));
    }
  }
  /** Replace the complete contiguous window and apply page-owned projection metadata. */
  installWindow(entries, hasMore, projections, assistantStream) {
    const visible = this.assistantStream.replace(entries, assistantStream);
    this.baseSeq = SessionLogOffset(entries[0]?.event.seq ?? 0);
    this.hasMore = hasMore;
    if (visible.some((entry) => entry.event.type === "turn/start"))
      this.firstPromptPendingTurn = false;
    if (projections !== void 0)
      this.projections.seed(projections);
    this.eventSource.replace(visible, hasMore);
    for (const entry of visible)
      this.observeSubmissionEvent(entry.event);
    this.notifier.markDirty();
  }
  publishAssistantEntry(result) {
    if (result?.type === "rebaseline") {
      const events = this.events;
      queueMicrotask(() => {
        if (events !== void 0 && this.events === events)
          events.restart();
      });
      return;
    }
    if (result?.type === "settlement") {
      this.eventSource.settleAssistant(result.attemptId, result.entry);
      this.observeSubmissionEvent(result.entry.event);
      this.notifier.markDirty();
      return;
    }
    if (result?.type === "abandonment") {
      this.eventSource.settleAssistant(result.attemptId);
      this.notifier.markDirty();
      return;
    }
    if (result?.type === "publish" && this.appendLive(result.entry)) {
      this.notifier.markDirty();
    } else if (result?.type === "transient") {
      this.eventSource.append(result.entry);
      this.notifier.markDirty();
    }
  }
  /** Prepend one stream-validated history page. */
  prependWindow(entries, hasMore) {
    this.baseSeq = entries[0] === void 0 ? this.baseSeq : SessionLogOffset(entries[0].event.seq);
    this.hasMore = hasMore;
    this.eventSource.prepend(entries, hasMore);
  }
  /** Append one stream-validated live event. */
  appendLive(entry) {
    const event = entry.event;
    const awaitingFirstTurn = this.firstPromptPendingTurn;
    if (event.type === "turn/start")
      this.firstPromptPendingTurn = false;
    this.eventSource.append(entry);
    this.observeSubmissionEvent(event);
    return awaitingFirstTurn !== this.firstPromptPendingTurn;
  }
  /** Observe durable acceptance even when insertion and claim share one projection notification. */
  observeSubmissionEvent(event) {
    if (this.submissionSettlements.size === 0)
      return;
    if (event.type === "agent/inbox/spliced") {
      const splice = event.data;
      if (Array.isArray(splice?.inserted)) {
        for (const message of splice.inserted)
          this.observeSubmissionEvent({ type: "user/message", data: message });
      }
      return;
    }
    if (event.type !== "user/message")
      return;
    const data = event.data;
    const source = data?.source;
    if (source?.kind !== "user" || typeof source.rpcId !== "string")
      return;
    this.scheduleObservedRetirement(source.rpcId, attachmentRefsIn(data?.content));
  }
  /** Retire local echoes when their accepted messages appear in the durable Inbox projection. */
  observeSubmissionInbox() {
    if (this.submissionSettlements.size === 0)
      return;
    const inbox = this.projections.get("inbox");
    if (inbox === void 0)
      return;
    for (const message of [...inbox["next-turn"], ...inbox["next-step"]]) {
      const source = message.source;
      if (source.kind === "user" && "rpcId" in source) {
        this.scheduleObservedRetirement(source.rpcId, attachmentRefsIn(message.content));
      }
    }
  }
  /**
   * Latch one observed settlement and remove the echo an animation frame
   * later. The delay keeps the echo in the snapshot until the frame in which
   * the durable node (whose assembly frame was registered first) is
   * renderable; the render-time rpcId dedupe hides the one-frame overlap.
   */
  scheduleObservedRetirement(requestId, attachments) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0 || settlement.retiring)
      return;
    settlement.retiring = true;
    scheduleFrame(() => {
      this.finishSubmission(requestId, { reason: "observed", attachments });
    });
  }
  /** Remove one unsettled echo immediately (prompt rejection, abort, or disposal). */
  retireFailedSubmission(requestId) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0 || settlement.retiring)
      return;
    settlement.retiring = true;
    this.finishSubmission(requestId, { reason: "failed" });
  }
  /** Single removal point: drop the echo, publish, then notify the owner. */
  finishSubmission(requestId, retirement) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0)
      return;
    this.submissionSettlements.delete(requestId);
    this.pendingSubmissions = this.pendingSubmissions.filter((echo) => echo.requestId !== requestId);
    this.notifier.markDirty();
    settlement.onRetire?.(retirement);
  }
  /** Publish a terminal background failure only while this stream still owns the Session. */
  failEventStream(events, generation, error) {
    if (generation !== this.openGeneration || this.events !== events)
      return;
    if (!(0, import_client2.isRemoteFailure)(error))
      throw error;
    this.openGeneration++;
    this.events = void 0;
    this.openPromise = null;
    this.openState = "error";
    this.openError = error;
    void events.dispose();
    this.notifier.markDirty();
  }
  buildSnapshot() {
    return {
      sessionId: this.sessionId,
      pendingSubmissions: this.pendingSubmissions,
      running: this.running,
      subagent: this.address === void 0 ? null : {
        address: this.address,
        ...this.parentAvailable === void 0 ? {} : { parentAvailable: this.parentAvailable }
      },
      removed: this.removed,
      openState: this.openState,
      openError: this.openError,
      hasMore: this.hasMore,
      loadingOlder: this.loadingOlder,
      promptError: this.promptError,
      blank: this.blankBit,
      lastAgentError: this.lastAgentError,
      promptAttempted: this.promptAttempted,
      awaitingFirstTurn: this.firstPromptPendingTurn
    };
  }
  sessionAddress() {
    return this.address === void 0 ? { kind: "session", sessionId: this.sessionId } : { kind: "subagent", ...this.address };
  }
};
function scheduleFrame(fn) {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      fn();
    });
  else
    setTimeout(fn, 0);
}
function attachmentRefsIn(content) {
  if (!Array.isArray(content))
    return [];
  const refs = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null)
      continue;
    const candidate = block;
    if ((candidate.type === "image" || candidate.type === "file") && typeof candidate.attachment === "object" && candidate.attachment !== null) {
      refs.push(candidate.attachment);
    }
  }
  return refs;
}

// sessions/manager.js
function sessionSeqCursor(value) {
  return value === -1 ? -1 : SessionSeq(value);
}
function catalogAvailability(parentAvailable) {
  return parentAvailable === void 0 ? {} : { parentAvailable };
}
var SessionManager = class {
  remote;
  sessions = /* @__PURE__ */ new Map();
  /** In-flight Session disposals remain here after instances leave `sessions`, so manager disposal can await quiescence. */
  sessionDisposals = /* @__PURE__ */ new Set();
  /** Per-session projection value stores, retained independently of instance arrival (the
   *  title-snapshot precedent, generalized): push frames land here whether or not the Session
   *  is instantiated (list rows read the 'title' key), and an instantiated Session adopts the
   *  same store so history-baseline seeding and frames converge on one row set. */
  projectionStores = /* @__PURE__ */ new Map();
  summaries = [];
  listState = "idle";
  /** Arrival phase; the pending → ready edge fires on the first successful pull (see SessionListPhase). */
  listPhase = "pending";
  listError = null;
  listInflight = null;
  /** Active list request's mutation log; its identity also fences completion after reconnect. */
  listMutations = null;
  addresses = /* @__PURE__ */ new Map();
  catalogs = /* @__PURE__ */ new Map();
  catalogInflight = /* @__PURE__ */ new Map();
  /** Catalog owners whose membership changed while a pull was in flight: one trailing refresh after it settles. */
  catalogStale = /* @__PURE__ */ new Set();
  openCatalogs = /* @__PURE__ */ new Set();
  catalogDebounce = /* @__PURE__ */ new Map();
  /**
   * Background jobs per session, last-wins from Session Controller's control
   * stream. An empty set is stored as an absent key, so absence and `[]` are
   * one representation.
   */
  jobsBySession = /* @__PURE__ */ new Map();
  listSnapshotCache;
  /** Entry-identity cache (reference stability): list rebuilds reuse the previous entry
   *  object when every field matches — wire refreshes mint all-new summary objects, so identity
   *  must be recovered by value or every SessionListItem memo misses on every refresh. */
  entryCache = /* @__PURE__ */ new Map();
  itemsCache = [];
  notifier = new Notifier(() => {
    this.listSnapshotCache = this.buildListSnapshot();
  });
  /** @param remote - generated Remote namespaces used by catalog and history readers. */
  constructor(remote) {
    this.remote = remote;
    this.listSnapshotCache = this.buildListSnapshot();
  }
  /**
   * Resolve an acquisition target without materializing a Session.
   * @param target - known identity or durable direct-parent address.
   * @returns the resolved identity with its explicit or catalog-derived history route installed.
   */
  resolveTarget(target) {
    const id = typeof target === "string" ? target : target.childSessionId;
    const address = typeof target === "string" ? this.navigationAddress(id) : target;
    if (typeof target === "string" && !this.sessions.has(id) && !this.summaries.some((summary) => summary.sessionId === id) && address === void 0) {
      throw new Error(`sessions.retain: unknown session ${id}`);
    }
    if (address !== void 0)
      this.addresses.set(id, address);
    this.sessions.get(id)?.configureSubagent(address, address === void 0 ? void 0 : this.catalogs.get(address.parentSessionId)?.parentAvailable);
    return id;
  }
  /**
   * Return the durable catalog address retained for one child.
   * @param sessionId - possible addressed child id.
   * @returns The direct-parent address, when navigation discovered one.
   */
  subagentAddress(sessionId) {
    return this.navigationAddress(sessionId);
  }
  /**
   * Resolve an address for breadcrumb navigation without retaining transport authority.
   * @param sessionId - possible child id in an already-loaded catalog.
   * @returns A retained or catalog-derived direct-parent address.
   */
  navigationAddress(sessionId) {
    const retained = this.addresses.get(sessionId);
    if (retained !== void 0)
      return retained;
    for (const [parentSessionId, catalog] of this.catalogs) {
      const child = catalog.entries.find((entry) => entry.kind === "child" && entry.id === sessionId);
      if (child?.kind === "child") {
        return { parentSessionId, childSessionId: sessionId, mode: child.mode };
      }
    }
    return void 0;
  }
  // ---- Instance management ----
  /**
   * Withdraw an exact Client instance before running its teardown callbacks.
   * @param sessionId - identity to withdraw.
   * @param expected - instance being released; a replacement is left untouched.
   * @returns completion of the detached instance's stream teardown.
   */
  drop(sessionId, expected) {
    const session = this.sessions.get(sessionId);
    if (session !== expected)
      return Promise.resolve();
    this.sessions.delete(sessionId);
    this.addresses.delete(sessionId);
    return this.startSessionDisposal(session);
  }
  /**
   * Stop catalog requests and dispose every resident Session.
   * @returns once catalog requests and every Session stream have stopped.
   */
  async dispose() {
    for (const timer of this.catalogDebounce.values())
      clearTimeout(timer);
    this.catalogDebounce.clear();
    this.catalogStale.clear();
    this.openCatalogs.clear();
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    this.addresses.clear();
    for (const session of sessions)
      void this.startSessionDisposal(session);
    await this.drainSessionDisposals();
  }
  startSessionDisposal(session) {
    const disposal = session.dispose();
    this.sessionDisposals.add(disposal);
    void disposal.then(() => {
      this.sessionDisposals.delete(disposal);
    }, () => {
      this.sessionDisposals.delete(disposal);
    });
    return disposal;
  }
  async drainSessionDisposals() {
    while (this.sessionDisposals.size > 0) {
      await Promise.allSettled([...this.sessionDisposals]);
    }
  }
  /**
   * Lazy build: return the existing instance or construct one (no auto-open —
   * the reference allocator opens history after binding the scope).
   * @param sessionId - the session to get.
   * @returns the resident instance.
   */
  get(sessionId) {
    let session = this.sessions.get(sessionId);
    if (session === void 0) {
      session = this.createSession(sessionId);
      this.sessions.set(sessionId, session);
      const summary = this.summaries.find((s) => s.sessionId === sessionId);
      if (summary !== void 0) {
        session.handleBlank(summary.blank);
        session.handleRunning(summary.running);
      } else {
        const address = this.addresses.get(sessionId);
        const child = address === void 0 ? void 0 : this.catalogs.get(address.parentSessionId)?.entries.find((entry) => entry.kind === "child" && entry.id === sessionId);
        if (child?.kind === "child") {
          session.handleBlank(false);
          session.handleRunning(child.activity === "running");
        }
      }
    }
    return session;
  }
  createSession(sessionId) {
    const address = this.addresses.get(sessionId);
    const parentAvailable = address === void 0 ? void 0 : this.catalogs.get(address.parentSessionId)?.parentAvailable;
    return new Session(sessionId, this.remote, {
      ...address === void 0 ? {} : {
        address,
        ...catalogAvailability(parentAvailable)
      },
      // The sender's local first-send flip mirrors into the list row so the
      // session surfaces (lists filter on blank) before any host frame lands.
      onEngaged: (engaged) => {
        this.recordMutation({ kind: "engaged", sessionId: engaged.sessionId });
      },
      projections: this.projectionStore(sessionId)
    });
  }
  /** Resident per-session projection store (create-on-demand; outlives instantiation). */
  projectionStore(sessionId) {
    let store = this.projectionStores.get(sessionId);
    if (store === void 0) {
      store = new ProjectionValueStore();
      store.subscribeAny(() => {
        this.notifier.markDirty();
      });
      this.projectionStores.set(sessionId, store);
    }
    return store;
  }
  /**
   * Refresh one direct-child catalog, reusing its in-flight request.
   * @param parentSessionId - catalog owner.
   */
  refreshSubagents(parentSessionId) {
    const existing = this.catalogInflight.get(parentSessionId);
    if (existing !== void 0)
      return existing.promise;
    const previous = this.catalogs.get(parentSessionId);
    const expandableRows = /* @__PURE__ */ new Set();
    const activityRows = /* @__PURE__ */ new Map();
    this.catalogs.set(parentSessionId, {
      entries: previous?.entries ?? [],
      ...previous?.parentAvailable === void 0 ? {} : { parentAvailable: previous.parentAvailable },
      state: "loading",
      error: null
    });
    this.notifier.markDirty();
    const operation = (async () => {
      try {
        const result = await this.remote.subagents.list(parentSessionId);
        if (result.ok) {
          const parentAvailable = this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? result.value.parentAvailable;
          this.catalogs.set(parentSessionId, {
            ...result.value,
            entries: this.withCatalogMutations(result.value.entries, expandableRows, activityRows),
            parentAvailable,
            state: "ready",
            error: null
          });
          for (const [childId, address] of this.addresses) {
            if (address.parentSessionId !== parentSessionId)
              continue;
            this.sessions.get(childId)?.handleSubagentParentAvailable(parentAvailable);
          }
        } else {
          this.catalogs.set(parentSessionId, {
            entries: this.withCatalogMutations(previous?.entries ?? [], expandableRows, activityRows),
            ...catalogAvailability(this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? previous?.parentAvailable),
            state: "error",
            error: result.error
          });
        }
      } catch (error) {
        if (!(0, import_client3.isRemoteFailure)(error))
          throw error;
        this.catalogs.set(parentSessionId, {
          entries: this.withCatalogMutations(previous?.entries ?? [], expandableRows, activityRows),
          ...catalogAvailability(this.catalogInflight.get(parentSessionId)?.parentAvailableOverride ?? previous?.parentAvailable),
          state: "error",
          error
        });
      } finally {
        this.catalogInflight.delete(parentSessionId);
        if (this.catalogStale.delete(parentSessionId))
          void this.refreshSubagents(parentSessionId);
        this.notifier.markDirty();
      }
    })();
    this.catalogInflight.set(parentSessionId, {
      promise: operation,
      expandableRows,
      activityRows,
      parentAvailableOverride: void 0
    });
    return operation;
  }
  /**
   * Mark whether a catalog menu is consuming live membership updates.
   * @param parentSessionId - catalog owner.
   * @param open - current menu state.
   */
  setSubagentCatalogOpen(parentSessionId, open) {
    if (open) {
      this.openCatalogs.add(parentSessionId);
      void this.refreshSubagents(parentSessionId);
    } else {
      this.openCatalogs.delete(parentSessionId);
      const timer = this.catalogDebounce.get(parentSessionId);
      if (timer !== void 0) {
        clearTimeout(timer);
        this.catalogDebounce.delete(parentSessionId);
      }
    }
  }
  // ---- List API ----
  /** Full refresh via session.list (single-flight within one Host generation). */
  refreshList() {
    if (this.listInflight !== null)
      return this.listInflight;
    this.listState = "loading";
    this.listError = null;
    const established = this.summaries;
    const mutations = [];
    this.listMutations = mutations;
    this.notifier.markDirty();
    this.listInflight = (async () => {
      try {
        const result = await this.remote.session.list({});
        if (this.listMutations !== mutations)
          return;
        if (result.ok) {
          const baseline = this.listPhase === "pending" ? [...result.value.items] : mergeOrderedBaseline(established, result.value.items, (summary) => summary.sessionId);
          this.summaries = mutations.reduce(applyMutation, baseline);
          this.listState = "idle";
          this.listPhase = "ready";
          for (const s of this.summaries) {
            const session = this.sessions.get(s.sessionId);
            if (session === void 0)
              continue;
            session.handleBlank(s.blank);
            session.handleRunning(s.running);
          }
          for (const s of result.value.items) {
            const block = s.projections;
            if (block === void 0)
              continue;
            const store = this.projectionStore(s.sessionId);
            const values = block.values;
            for (const key of Object.keys(values))
              store.apply(key, values[key], sessionSeqCursor(block.asOfSeq));
          }
        } else {
          this.listState = "error";
          this.listError = result.error;
        }
      } catch (error) {
        if (!(0, import_client3.isRemoteFailure)(error))
          throw error;
        if (this.listMutations !== mutations)
          return;
        this.listState = "error";
        this.listError = error;
      } finally {
        if (this.listMutations === mutations) {
          this.listMutations = null;
          this.listInflight = null;
          this.notifier.markDirty();
        }
      }
    })();
    return this.listInflight;
  }
  /**
   * Search visible session message content without adding transient query
   * state to the list snapshot.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for superseded UI queries.
   * @returns the Host result or a folded transport error.
   */
  async search(query, signal) {
    const result = await this.remote.session.search({ query }, signal);
    if (!result.ok)
      return result;
    return {
      ok: true,
      value: {
        items: [...result.value.items],
        hasMore: result.value.hasMore
      }
    };
  }
  /**
   * Contract session.create; on success merge into summaries immediately (no
   * wait for the next refresh). A created session is blank by definition
   * (entity birth precedes the first message).
   * @param opts - target workspace or working directory, plus an optional caller-owned id.
   * @returns the create result.
  */
  async create(opts = {}) {
    const shared = opts.sessionId === void 0 ? {} : { sessionId: opts.sessionId };
    const payload = opts.workspaceId !== void 0 ? { workspaceId: opts.workspaceId, ...shared } : { ...opts.cwd === void 0 ? {} : { cwd: opts.cwd }, ...shared };
    const result = await this.remote.session.create(payload);
    if (result.ok) {
      this.recordMutation({ kind: "upsert", summary: {
        sessionId: result.value.sessionId,
        updatedAt: Date.now(),
        running: false,
        blank: true,
        ...opts.cwd !== void 0 ? { cwd: opts.cwd } : {}
      } });
    } else {
      const publishedSessionId = workspaceAttachSessionId(result.error);
      if (publishedSessionId !== void 0) {
        this.recordMutation({ kind: "upsert", summary: {
          sessionId: publishedSessionId,
          updatedAt: Date.now(),
          running: false,
          blank: true
        } });
      }
    }
    return result;
  }
  /**
   * Contract session.fork; on success merge the child into summaries
   * immediately (same synchronous-addressability guarantee as create). The
   * child carries the source's history, so it is never blank; lineage rides
   * parentSessionId so the list nests it under its source. A child published
   * before Workspace attachment fails is also reconciled into the list.
   * @param opts - source session and the optional seq anchoring the cut.
   * @returns the fork result (the child session id).
   */
  async fork(opts) {
    const source = this.summaries.find((s) => s.sessionId === opts.sessionId);
    const result = await this.remote.session.fork({
      sessionId: opts.sessionId,
      ...opts.atSeq === void 0 ? {} : { atSeq: opts.atSeq }
    });
    const childId = result.ok ? result.value.sessionId : workspaceAttachSessionId(result.error);
    if (childId !== void 0) {
      this.recordMutation({ kind: "upsert", summary: {
        sessionId: childId,
        updatedAt: Date.now(),
        running: false,
        blank: false,
        parentSessionId: opts.sessionId,
        ...source?.cwd !== void 0 ? { cwd: source.cwd } : {}
      } });
    }
    return result;
  }
  /**
   * Insert-or-enrich a locally synthesized summary: a new id prepends; an
   * existing entry only gains fields it lacks (the session-added frame and the
   * create() echo race — whichever lands second must fill the placeholder's
   * missing cwd/parentSessionId, never overwrite list-refresh data).
   */
  mergeSummary(summary) {
    this.recordMutation({ kind: "upsert", summary });
  }
  /** Apply immediately and retain for replay when a list response is in flight. */
  recordMutation(mutation) {
    this.listMutations?.push(mutation);
    this.summaries = applyMutation(this.summaries, mutation);
    this.notifier.markDirty();
  }
  // ---- Subscription API (for useSessionList) ----
  /**
   * uSES subscription entry for useSessionList.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener) {
    return this.notifier.subscribe(listener);
  }
  /**
   * Cached list snapshot (rebuilt lazily when dirty with no listeners).
   * @returns the cached reference (stable until the next flush).
   */
  getListSnapshot() {
    this.notifier.ensureFresh();
    return this.listSnapshotCache;
  }
  /**
   * Read cached projection values for a Session that may exist only in a loaded subagent catalog.
   * @param sessionId - Session whose control or history baseline supplied projections.
   * @returns current values, or undefined before any projection store exists.
   */
  projectionValues(sessionId) {
    return this.projectionStores.get(sessionId)?.values();
  }
  // ---- Live control and Host-event sinks ----
  /**
   * Apply a complete control baseline or one later replacement frame.
   * @param frame - baseline or live control replacement from Session Controller.
   */
  handleControlFrame(frame) {
    if (frame.type === "baseline") {
      this.replaceControlBaseline(frame.value);
      return;
    }
    if (frame.type === "projection") {
      this.projectionStore(frame.sessionId).apply(frame.key, frame.value, SessionSeq(frame.seq));
      this.notifier.markDirty();
      return;
    }
    if (frame.jobs.length === 0)
      this.jobsBySession.delete(frame.sessionId);
    else
      this.jobsBySession.set(frame.sessionId, frame.jobs);
    this.notifier.markDirty();
  }
  replaceControlBaseline(baseline) {
    this.jobsBySession.clear();
    for (const [sessionId, jobs] of Object.entries(baseline.jobs)) {
      if (jobs.length > 0)
        this.jobsBySession.set(sessionId, jobs);
    }
    for (const [sessionId, block] of Object.entries(baseline.projections)) {
      const store = this.projectionStore(sessionId);
      const asOfSeq = sessionSeqCursor(block.asOfSeq);
      store.seed({ ...block, asOfSeq });
    }
    this.notifier.markDirty();
  }
  /**
   * Apply one Session-list addition forwarded through `ctx.remote.$on`.
   * @param summary - current Host summary for the added Session.
   */
  handleSessionAdded(summary) {
    this.mergeSummary(summary);
    this.sessions.get(summary.sessionId)?.handleBlank(summary.blank);
    const projections = summary.projections;
    if (projections !== void 0) {
      const store = this.projectionStore(summary.sessionId);
      for (const [key, value] of Object.entries(projections.values)) {
        store.apply(key, value, sessionSeqCursor(projections.asOfSeq));
      }
    }
    if (summary.origin === "subagent" && summary.parentSessionId !== void 0) {
      this.markCatalogParentExpandable(summary.parentSessionId);
    }
    if (summary.parentSessionId !== void 0 && this.openCatalogs.has(summary.parentSessionId)) {
      this.scheduleCatalogRefresh(summary.parentSessionId);
    }
  }
  /**
   * Apply one Session removal forwarded through `ctx.remote.$on`.
   * @param sessionId - removed Session identity.
   */
  handleSessionRemoved(sessionId) {
    const summary = this.summaries.find((candidate) => candidate.sessionId === sessionId);
    const durableSubagent = summary?.origin === "subagent" || this.addresses.has(sessionId);
    this.recordMutation(durableSubagent ? { kind: "status", sessionId, running: false } : { kind: "remove", sessionId });
    this.updateCatalogActivity(sessionId, false);
    if (durableSubagent)
      this.sessions.get(sessionId)?.handleRunning(false);
    else
      this.sessions.get(sessionId)?.handleRemoved();
    this.jobsBySession.delete(sessionId);
    if (!durableSubagent)
      this.projectionStores.delete(sessionId);
    const inflightCatalog = this.catalogInflight.get(sessionId);
    if (inflightCatalog !== void 0) {
      inflightCatalog.parentAvailableOverride = false;
      this.catalogStale.add(sessionId);
    }
    const ownedCatalog = this.catalogs.get(sessionId);
    if (ownedCatalog !== void 0 && ownedCatalog.parentAvailable) {
      this.catalogs.set(sessionId, { ...ownedCatalog, parentAvailable: false });
    }
    for (const [childId, address] of this.addresses) {
      if (address.parentSessionId === sessionId) {
        this.sessions.get(childId)?.handleSubagentParentAvailable(false);
      }
    }
  }
  /**
   * Apply one live Agent running-state change.
   * @param sessionId - Session whose Agent state changed.
   * @param running - current Agent running state.
   */
  handleSessionStatus(sessionId, running) {
    this.recordMutation({ kind: "status", sessionId, running });
    this.sessions.get(sessionId)?.handleRunning(running);
    this.updateCatalogActivity(sessionId, running);
  }
  /**
   * Advance Session-list activity from one user-authored durable message.
   * @param sessionId - Session whose activity changed.
   * @param updatedAt - durable message timestamp.
   */
  handleSessionActivity(sessionId, updatedAt) {
    this.recordMutation({ kind: "activity", sessionId, updatedAt });
  }
  /**
   * Surface one live Agent failure on an already-materialized Session.
   * @param sessionId - Session whose Agent failed.
   * @param message - caller-visible failure description.
   */
  handleSessionError(sessionId, message) {
    this.sessions.get(sessionId)?.handleAgentError(message);
  }
  /**
   * Repair one re-established Host-event generation with queryable baselines.
   * Discard old projection cuts before new queries, including cold Sessions
   * absent from the process-local control baseline.
   * Opened Session follow streams resume independently through API Gateway.
   */
  handleConnected() {
    for (const store of this.projectionStores.values())
      store.clear();
    this.listMutations = null;
    this.listInflight = null;
    void this.refreshList();
    const parents = new Set(this.openCatalogs);
    for (const id of this.sessions.keys()) {
      const address = this.addresses.get(id);
      if (address !== void 0)
        parents.add(address.parentSessionId);
    }
    for (const parentSessionId of parents)
      void this.refreshSubagents(parentSessionId);
  }
  /** Debounce membership refetches for an explicitly consumed catalog. */
  scheduleCatalogRefresh(parentSessionId) {
    if (this.catalogDebounce.has(parentSessionId))
      return;
    const timer = setTimeout(() => {
      this.catalogDebounce.delete(parentSessionId);
      if (this.catalogInflight.has(parentSessionId)) {
        this.catalogStale.add(parentSessionId);
        return;
      }
      void this.refreshSubagents(parentSessionId);
    }, 50);
    this.catalogDebounce.set(parentSessionId, timer);
  }
  /** Apply one Agent-driver transition to loaded and in-flight catalogs. */
  updateCatalogActivity(childSessionId, running) {
    const activity = running ? "running" : "inactive";
    for (const inflight of this.catalogInflight.values()) {
      inflight.activityRows.set(childSessionId, activity);
    }
    let changed = false;
    for (const [parentSessionId, catalog] of this.catalogs) {
      if (!catalog.entries.some((entry) => entry.kind === "child" && entry.id === childSessionId && entry.activity !== activity))
        continue;
      const entries = catalog.entries.map((entry) => {
        if (entry.kind !== "child" || entry.id !== childSessionId)
          return entry;
        return { ...entry, activity };
      });
      changed = true;
      this.catalogs.set(parentSessionId, { ...catalog, entries });
    }
    if (changed)
      this.notifier.markDirty();
  }
  /** Preserve and project a positive expandability hint after one direct subagent publishes. */
  markCatalogParentExpandable(parentSessionId) {
    this.applyCatalogParentExpandable(parentSessionId);
    for (const inflight of this.catalogInflight.values())
      inflight.expandableRows.add(parentSessionId);
  }
  /** Apply one positive expandability hint to every loaded catalog containing that unique row id. */
  applyCatalogParentExpandable(parentSessionId) {
    let changed = false;
    for (const [catalogParentId, catalog] of this.catalogs) {
      if (!catalog.entries.some((entry) => entry.kind === "child" && entry.id === parentSessionId && !entry.hasChildren))
        continue;
      const entries = catalog.entries.map((entry) => {
        if (entry.kind !== "child" || entry.id !== parentSessionId || entry.hasChildren)
          return entry;
        return { ...entry, hasChildren: true };
      });
      changed = true;
      this.catalogs.set(catalogParentId, { ...catalog, entries });
    }
    if (changed)
      this.notifier.markDirty();
  }
  /** Fold request-local row mutations into one catalog result before publication. */
  withCatalogMutations(entries, expandableRows, activityRows) {
    return entries.map((entry) => {
      if (entry.kind !== "child")
        return entry;
      const activity = activityRows.get(entry.id);
      if (!expandableRows.has(entry.id) && activity === void 0)
        return entry;
      return {
        ...entry,
        ...expandableRows.has(entry.id) ? { hasChildren: true } : {},
        ...activity === void 0 ? {} : { activity }
      };
    });
  }
  buildListSnapshot() {
    const merged = this.summaries.map((summary) => {
      const projectionStore = this.projectionStores.get(summary.sessionId);
      const title = projectionStore?.get("title");
      const projectionValues = projectionStore?.values();
      return {
        ...summary,
        ...typeof title === "string" && title !== "" ? { title } : {},
        ...projectionValues === void 0 ? {} : { projectionValues }
      };
    });
    const fresh = flattenLineage(merged);
    const items = fresh.map((entry) => {
      const prev = this.entryCache.get(entry.sessionId);
      if (prev !== void 0 && prev.updatedAt === entry.updatedAt && prev.running === entry.running && prev.blank === entry.blank && prev.parentSessionId === entry.parentSessionId && prev.cwd === entry.cwd && prev.origin === entry.origin && prev.title === entry.title && prev.depth === entry.depth && prev.projectionValues === entry.projectionValues)
        return prev;
      this.entryCache.set(entry.sessionId, entry);
      return entry;
    });
    const itemIds = new Set(items.map((entry) => entry.sessionId));
    for (const id of this.entryCache.keys()) {
      if (!itemIds.has(id))
        this.entryCache.delete(id);
    }
    const sameOrder = items.length === this.itemsCache.length && items.every((e, i) => e === this.itemsCache[i]);
    if (!sameOrder)
      this.itemsCache = items;
    return {
      items: this.itemsCache,
      state: this.listState,
      phase: this.listPhase,
      error: this.listError,
      subagentsByParent: Object.fromEntries(this.catalogs),
      jobsBySession: Object.fromEntries(this.jobsBySession)
    };
  }
};
function applyMutation(summaries, mutation) {
  switch (mutation.kind) {
    case "upsert": {
      const existing = summaries.find((summary) => summary.sessionId === mutation.summary.sessionId);
      if (existing === void 0)
        return [mutation.summary, ...summaries];
      const filled = {
        ...existing,
        // Blank only lowers: a stale true (session-added racing the local
        // first send) never re-hides an already-surfaced session.
        blank: existing.blank && mutation.summary.blank,
        ...existing.cwd === void 0 && mutation.summary.cwd !== void 0 ? { cwd: mutation.summary.cwd } : {},
        ...existing.parentSessionId === void 0 && mutation.summary.parentSessionId !== void 0 ? { parentSessionId: mutation.summary.parentSessionId } : {},
        ...existing.origin === void 0 && mutation.summary.origin !== void 0 ? { origin: mutation.summary.origin } : {}
      };
      if (filled.cwd === existing.cwd && filled.parentSessionId === existing.parentSessionId && filled.origin === existing.origin && filled.blank === existing.blank)
        return [...summaries];
      return summaries.map((summary) => summary.sessionId === mutation.summary.sessionId ? filled : summary);
    }
    case "remove":
      return summaries.filter((summary) => summary.sessionId !== mutation.sessionId);
    case "status":
      return summaries.map((summary) => summary.sessionId === mutation.sessionId && (summary.running !== mutation.running || mutation.running && summary.blank) ? { ...summary, running: mutation.running, blank: summary.blank && !mutation.running } : summary);
    case "activity":
      return summaries.map((summary) => summary.sessionId === mutation.sessionId && mutation.updatedAt > summary.updatedAt ? { ...summary, updatedAt: mutation.updatedAt } : summary);
    case "engaged":
      return summaries.map((summary) => summary.sessionId === mutation.sessionId && summary.blank ? { ...summary, blank: false } : summary);
  }
}
function workspaceAttachSessionId(error) {
  return error.code === "session/workspace-attach-failed" ? error.details.sessionId : void 0;
}

// sessions/service.js
var SessionCreateError = class extends Error {
  rpcError;
  requestedSessionId;
  name = "SessionCreateError";
  /**
   * @param rpcError - Host business or folded transport error.
   * @param requestedSessionId - caller-preallocated id used for later stream/list reconciliation.
   */
  constructor(rpcError, requestedSessionId) {
    super(`session create failed: ${rpcError.code}: ${rpcError.message}`);
    this.rpcError = rpcError;
    this.requestedSessionId = requestedSessionId;
  }
};
var SessionForkError = class extends Error {
  rpcError;
  sourceSessionId;
  name = "SessionForkError";
  /**
   * @param rpcError - Host business or folded transport error.
   * @param sourceSessionId - the session the fork was cut from.
   */
  constructor(rpcError, sourceSessionId) {
    super(`session fork failed: ${rpcError.code}: ${rpcError.message}`);
    this.rpcError = rpcError;
    this.sourceSessionId = sourceSessionId;
  }
};
function displayTitleOf(title, cwd, id) {
  if (title !== void 0)
    return title;
  if (cwd !== void 0 && cwd !== "") {
    const base = workspaceTitleOf(cwd);
    if (base !== "")
      return base;
  }
  return id;
}
function increasedForkTitle(title) {
  const ascii = /^(.*?)\((\d+)\)$/u.exec(title);
  if (ascii?.[1] !== void 0 && ascii[2] !== void 0) {
    return `${ascii[1]}(${BigInt(ascii[2]) + 1n})`;
  }
  const fullWidth = /^(.*?)（(\d+)）$/u.exec(title);
  if (fullWidth?.[1] !== void 0 && fullWidth[2] !== void 0) {
    return `${fullWidth[1]}\uFF08${BigInt(fullWidth[2]) + 1n}\uFF09`;
  }
  return `${title} (1)`;
}
function freezeRetainedBy(counts) {
  Object.setPrototypeOf(counts, null);
  return Object.freeze(counts);
}
var EMPTY_RETAIN_INFO = Object.freeze({ referenceCount: 0, retainedBy: freezeRetainedBy({}) });
async function waitForOpen(opening, signal) {
  if (signal === void 0)
    return opening;
  const aborted = Promise.withResolvers();
  const onAbort = () => {
    aborted.reject(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted)
      onAbort();
    await Promise.race([opening, aborted.promise]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
var ClientSessionReference = class {
  sessionId;
  record;
  releaseReference;
  released = new AbortController();
  readiness = Promise.withResolvers();
  ready = this.readiness.promise;
  constructor(sessionId, record, releaseReference) {
    this.sessionId = sessionId;
    this.record = record;
    this.releaseReference = releaseReference;
    void this.ready.catch(() => {
    });
  }
  get binding() {
    if (this.record === void 0 || !this.record.live)
      throw new Error(`Session reference "${this.sessionId}" is released`);
    return this.record.binding;
  }
  attachOpening(opening, signal) {
    const waitSignal = signal === void 0 ? this.released.signal : AbortSignal.any([this.released.signal, signal]);
    void waitForOpen(opening, waitSignal).then(() => {
      try {
        waitSignal.throwIfAborted();
        this.readiness.resolve(this.binding);
      } catch (error) {
        this.readiness.reject(error);
      }
    }, (error) => {
      this.readiness.reject(error);
    });
  }
  release() {
    const reason = new Error(`Session reference "${this.sessionId}" is released`);
    const release = this.releaseReference;
    this.released.abort(reason);
    this.readiness.reject(reason);
    this.record = void 0;
    this.releaseReference = void 0;
    release?.();
  }
  [Symbol.dispose]() {
    this.release();
  }
};
var ClientSessions = class {
  rootCtx;
  /**
   * The wire schema's own result bound, re-exposed for presentation plugins as
   * injected data. Not per-connection state: the `session.search` response
   * schema caps `items` at this constant, so every transport (fixture included)
   * reports the same number.
   */
  searchResultLimit = SESSION_SEARCH_RESULT_LIMIT;
  /** Catalog metadata and local reference-source projection. */
  list;
  /** The object-layer instance cluster and frame dispatch entry. */
  manager;
  scopes = /* @__PURE__ */ new Map();
  /** Stable per-id sources retained for the Client root lifetime, including across generation replacement. */
  retainObservers = /* @__PURE__ */ new Map();
  scopeDrops = /* @__PURE__ */ new Set();
  closed = false;
  /**
   * @param ctx - client root context (scope fibers mount under it).
   * @param remote - generated Remote namespaces shared with every Session.
   */
  constructor(rootCtx, remote) {
    this.rootCtx = rootCtx;
    this.manager = new SessionManager(remote);
    this.list = (0, import_dsh_client_store3.createSnapshotStore)({
      ids: [],
      byId: {},
      phase: "pending",
      subagentsByParent: {},
      jobsBySession: {}
    });
    const disposeManagerProjection = this.manager.subscribe(() => {
      this.projectList();
    });
    rootCtx.effect(() => async () => {
      this.closed = true;
      disposeManagerProjection();
      const scopes = [...this.scopes];
      this.scopes.clear();
      for (const [, record] of scopes) {
        record.live = false;
        record.session.unbindScope();
      }
      const managerDisposal = this.manager.dispose();
      for (const [id, record] of scopes) {
        this.startScopeDrop(id, record);
        this.publishRetention(id);
      }
      await this.drainScopeDrops();
      await managerDisposal;
    }, "session-controller.client.sessions");
    rootCtx.reflect.provide("sessions", this, void 0);
  }
  retain(target, options) {
    const { source, signal } = options;
    signal?.throwIfAborted();
    if (this.closed)
      throw new Error("Session Controller is disposed");
    const id = this.manager.resolveTarget(target);
    const reference = this.retainScope(id, source);
    try {
      reference.attachOpening(this.manager.get(id).open(), signal);
      return reference;
    } catch (error) {
      reference.release();
      throw error;
    }
  }
  async using(target, options, operation) {
    const reference = this.retain(target, options);
    try {
      await reference.ready;
      return await operation(reference);
    } finally {
      reference.release();
    }
  }
  retainInfo(id) {
    let observer = this.retainObservers.get(id);
    if (observer === void 0) {
      const listeners = /* @__PURE__ */ new Set();
      observer = {
        listeners,
        published: this.retentionSnapshot(id),
        source: {
          getSnapshot: () => this.retentionSnapshot(id),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          }
        }
      };
      this.retainObservers.set(id, observer);
    }
    return observer.source;
  }
  /**
   * Resolve an already discovered direct-parent address without opening it.
   * Feature plugins use this to avoid Agent-bound RPCs in persisted child views.
   * @param id - possible addressed child id.
   * @returns The retained address, when present.
   */
  subagentAddress(id) {
    return this.manager.subagentAddress(id);
  }
  /**
   * Inform the Session Controller whether a catalog menu is consuming membership updates.
   * @param parentSessionId - selected parent.
   * @param open - menu state.
   */
  setSubagentCatalogOpen(parentSessionId, open) {
    this.manager.setSubagentCatalogOpen(parentSessionId, open);
  }
  /**
   * Refresh one direct-child catalog.
   * @param parentSessionId - catalog owner.
   */
  refreshSubagents(parentSessionId) {
    return this.manager.refreshSubagents(parentSessionId);
  }
  /**
   * Refresh the real Session baseline, reusing an in-flight pull.
   * @returns completion of the current or newly started baseline pull.
   */
  refresh() {
    return this.manager.refreshList();
  }
  /**
   * Search the Host's visible message-content index. Results stay
   * request-local; the list snapshot remains the metadata authority.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for a superseded search.
   * @returns bounded results or a business/transport error.
   */
  search(query, signal) {
    return this.manager.search(query, signal);
  }
  /**
   * Apply one Session Controller live-control frame.
   * @param frame - baseline or live control replacement.
   */
  handleControlFrame(frame) {
    this.manager.handleControlFrame(frame);
  }
  /**
   * Apply one remotely forwarded Session-list addition.
   * @param summary - current Host summary for the added Session.
   */
  handleSessionAdded(summary) {
    this.manager.handleSessionAdded(summary);
  }
  /**
   * Apply one remotely forwarded Session removal.
   * @param sessionId - removed Session identity.
   */
  handleSessionRemoved(sessionId) {
    this.manager.handleSessionRemoved(sessionId);
  }
  /**
   * Apply one remotely forwarded running-state change.
   * @param args - Session identity and current Agent running state.
   */
  handleSessionStatus(...args) {
    this.manager.handleSessionStatus(...args);
  }
  /**
   * Apply one remotely forwarded list-activity change.
   * @param args - Session identity and durable activity timestamp.
   */
  handleSessionActivity(...args) {
    this.manager.handleSessionActivity(...args);
  }
  /**
   * Apply one remotely forwarded Agent failure.
   * @param args - Session identity and caller-visible failure description.
   */
  handleSessionError(...args) {
    this.manager.handleSessionError(...args);
  }
  /** Rebuild the Session baseline and every opened window after connection. */
  handleConnected() {
    this.manager.handleConnected();
  }
  /**
   * Create a Host Session and publish its catalog row before resolving.
   * Callers retain the returned identity before borrowing its binding.
   * @param opts - target workspace or directory and an optional preallocated id.
   * @returns the new session id.
   * @throws {SessionCreateError} with the requested id.
   */
  async create(opts = {}) {
    const result = await this.manager.create(opts);
    if (!result.ok)
      throw new SessionCreateError(result.error, opts.sessionId);
    this.projectList();
    return result.value.sessionId;
  }
  /**
   * Fork a Session from a completed-turn prefix of the source and publish
   * the child in the catalog before resolving.
   * @param opts - source session id, the optional event seq anchoring the
   *   cut (the boundary is the first turn/end at or after it; an in-log
   *   anchor in an open turn is unavailable rather than clipped backward),
   *   and whether to increment an inherited durable title before resolving.
   *   A fractional anchor floors to a real event seq: the frozen nodes of an
   *   interrupted turn carry flow-ordering seqs between two events, and the
   *   wire takes integers only.
   * @returns the child session id.
   * @throws {SessionForkError} with the source id.
   * @throws {Error} when a requested child-title rename fails after creation.
   */
  async fork(opts) {
    const sourceTitle = opts.increaseTitle ? this.list.getSnapshot().byId[opts.sessionId]?.title : void 0;
    const result = await this.manager.fork({
      sessionId: opts.sessionId,
      // Flooring lands inside the anchor's own turn (every turn opens with a
      // turn/start), so the host's first-turn/end-at-or-after cut still ends
      // on that turn — never clipped back to the previous one.
      ...opts.atSeq === void 0 ? {} : { atSeq: SessionSeq(Math.floor(opts.atSeq)) }
    });
    if (!result.ok)
      throw new SessionForkError(result.error, opts.sessionId);
    this.projectList();
    const childId = result.value.sessionId;
    if (sourceTitle !== void 0) {
      const reference = this.retain(childId, { source: "controllerOperation" });
      try {
        await reference.ready;
        const renamed = await reference.binding.session.rename(increasedForkTitle(sourceTitle));
        if (!renamed.ok)
          throw new Error(`fork child rename failed: ${renamed.error.code}: ${renamed.error.message}`);
      } finally {
        reference.release();
      }
    }
    return childId;
  }
  /**
   * Borrow an already-retained Agent-scoped Context.
   * @param id - session id (the agent identity — 1:1 same axis).
   * @returns the scoped Context, or undefined without a retained generation.
   */
  scope(id) {
    return this.scopes.get(id)?.ctx;
  }
  /**
   * Retain a validated Gateway identity synchronously, without history or catalog I/O.
   * @param id - Host-projected Session identity, possibly not yet catalogued.
   * @returns a Gateway-source reference owned by the invocation.
   */
  retainAgentScope(id) {
    if (this.closed)
      throw new Error("Session Controller is disposed");
    return this.retainScope(id, "gateway");
  }
  /**
   * Read the Agent scope tag off a context. Service-method boundary: fetch
   * bundles must reach scope resolution through ctx.sessions — a cross-bundle
   * value import of the standalone helper would inline a second module
   * instance whose private tag Symbol never matches.
   * @param ctx - any client context.
   * @returns the session id, or undefined on root contexts.
   */
  scopeOf(ctx) {
    return scopeOf(ctx);
  }
  /**
   * Resolve the business Session behind an Agent-scoped context — the one
   * hop every scoped consumer (event listeners, per-session controllers)
   * takes from ctx-space into object-space (the client mirror of host
   * `agent.session`). Same service-method boundary as
   * {@link ClientSessions.scopeOf}.
   * @param ctx - an Agent-scoped context.
   * @returns the matching live Session, or undefined for an untagged or ended generation.
   */
  sessionOf(ctx) {
    const id = scopeOf(ctx);
    if (id === void 0)
      return void 0;
    const record = this.scopes.get(id);
    return record !== void 0 && scopeIdentityOf(record.ctx) === scopeIdentityOf(ctx) ? record.binding.session : void 0;
  }
  /**
   * Borrow an already-retained binding without extending its lifetime.
   * @param id - Session identity.
   * @returns the live binding, or undefined without a retained generation.
   */
  binding(id) {
    return this.scopes.get(id)?.binding;
  }
  retainScope(id, source) {
    const record = this.scopes.get(id) ?? this.materializeScope(id);
    const previous = record.retention;
    record.retention = Object.freeze({
      referenceCount: previous.referenceCount + 1,
      retainedBy: freezeRetainedBy({ ...previous.retainedBy, [source]: (previous.retainedBy[source] ?? 0) + 1 })
    });
    const reference = new ClientSessionReference(id, record, () => {
      if (!record.live)
        return;
      const count = record.retention.referenceCount - 1;
      const { [source]: sourceCount = 0, ...otherSources } = record.retention.retainedBy;
      const retainedBy = sourceCount > 1 ? { ...otherSources, [source]: sourceCount - 1 } : otherSources;
      record.retention = count === 0 ? EMPTY_RETAIN_INFO : Object.freeze({ referenceCount: count, retainedBy: freezeRetainedBy(retainedBy) });
      if (count === 0)
        this.retireScope(id, record);
      else
        this.publishRetention(id);
    });
    if (this.list.getSnapshot().byId[id] === void 0)
      this.projectList();
    this.publishRetention(id);
    return reference;
  }
  retentionSnapshot(id) {
    return this.scopes.get(id)?.retention ?? EMPTY_RETAIN_INFO;
  }
  publishRetention(id) {
    const state = this.list.getSnapshot();
    const row = state.byId[id];
    const retainedBy = this.retentionSnapshot(id).retainedBy;
    if (row !== void 0 && row.retainedBy !== retainedBy) {
      this.list.set({ ...state, byId: { ...state.byId, [id]: { ...row, retainedBy } } });
    }
    const observer = this.retainObservers.get(id);
    const snapshot = this.retentionSnapshot(id);
    if (observer === void 0 || observer.published === snapshot)
      return;
    observer.published = snapshot;
    (0, import_dsh_client_store3.notifySubscribers)(observer.listeners, "[session-controller] reference sources");
  }
  retireScope(id, record, disposeFiber = true) {
    if (!record.live)
      return;
    record.live = false;
    if (this.scopes.get(id) === record)
      this.scopes.delete(id);
    record.session.unbindScope();
    const sessionDisposal = this.manager.drop(id, record.session);
    this.projectList();
    this.publishRetention(id);
    this.startScopeDrop(id, record, disposeFiber, sessionDisposal);
  }
  /** Materialize one scope after its caller establishes that the id may be addressed. */
  materializeScope(id) {
    const { fiber, ctx } = createScope(this.rootCtx, id);
    const session = this.manager.get(id);
    session.bindScope(ctx);
    const binding = { sessionId: id, session, eventSource: session.eventSource, ctx };
    const record = {
      fiber,
      ctx,
      binding,
      session,
      retention: EMPTY_RETAIN_INFO,
      live: true
    };
    this.scopes.set(id, record);
    ctx.effect(() => () => {
      this.retireScope(id, record, false);
    }, "session-controller: exact generation");
    return record;
  }
  /** Project the manager's list snapshot into the store (title derivation is display-only). */
  projectList() {
    const previousById = this.list.getSnapshot().byId;
    const { items, phase, subagentsByParent, jobsBySession } = this.manager.getListSnapshot();
    const ids = [];
    const byId = {};
    for (const entry of items) {
      ids.push(entry.sessionId);
      byId[entry.sessionId] = {
        id: entry.sessionId,
        displayTitle: displayTitleOf(entry.title, entry.cwd, entry.sessionId),
        running: entry.running,
        retainedBy: this.retentionSnapshot(entry.sessionId).retainedBy,
        blank: entry.blank,
        updatedAt: entry.updatedAt,
        ...entry.projectionValues === void 0 ? {} : { projectionValues: entry.projectionValues },
        ...entry.title !== void 0 ? { title: entry.title } : {},
        ...entry.cwd !== void 0 ? { cwd: entry.cwd } : {},
        ...entry.parentSessionId !== void 0 ? { parentId: entry.parentSessionId } : {},
        ...entry.origin !== void 0 ? { origin: entry.origin } : {}
      };
    }
    for (const [parentId, catalog] of Object.entries(subagentsByParent)) {
      for (const child of catalog.entries) {
        if (child.kind !== "child")
          continue;
        const childId = child.id;
        const summary = byId[childId];
        const projectionValues = summary?.projectionValues ?? this.manager.projectionValues(childId);
        const projectedTitle = projectionValues?.title;
        const title = typeof projectedTitle === "string" && projectedTitle !== "" ? projectedTitle : void 0;
        const displayTitle = title ?? child.label ?? childId;
        if (summary === void 0) {
          byId[childId] = {
            id: childId,
            displayTitle,
            parentId,
            origin: "subagent",
            running: child.activity === "running",
            blank: false,
            updatedAt: 0,
            retainedBy: this.retentionSnapshot(childId).retainedBy,
            ...projectionValues === void 0 ? {} : { projectionValues },
            ...title === void 0 ? {} : { title }
          };
        } else if (summary.displayTitle !== displayTitle || summary.projectionValues !== projectionValues) {
          byId[childId] = {
            ...summary,
            displayTitle,
            ...projectionValues === void 0 ? {} : { projectionValues }
          };
        }
      }
    }
    for (const [id, record] of this.scopes) {
      if (byId[id] !== void 0)
        continue;
      const previous = previousById[id];
      const snapshot = record.session.getSnapshot();
      const address = this.manager.subagentAddress(id);
      byId[id] = {
        ...previous ?? { id, displayTitle: id, updatedAt: 0 },
        running: snapshot.running,
        retainedBy: record.retention.retainedBy,
        blank: snapshot.blank,
        ...address === void 0 ? {} : { parentId: address.parentSessionId, origin: "subagent" }
      };
    }
    this.list.set({ ids, byId, phase, subagentsByParent, jobsBySession });
  }
  startScopeDrop(id, record, disposeFiber = true, sessionDisposal = this.manager.drop(id, record.session)) {
    const drop = this.dropScope(record, disposeFiber, sessionDisposal);
    this.scopeDrops.add(drop);
    void drop.then(() => {
      this.scopeDrops.delete(drop);
    }, () => {
      this.scopeDrops.delete(drop);
    });
  }
  async drainScopeDrops() {
    while (this.scopeDrops.size > 0) {
      await Promise.allSettled([...this.scopeDrops]);
    }
  }
  /** Await the already-withdrawn Session and scoped cleanup to quiescence. */
  async dropScope(record, disposeFiber, sessionDisposal) {
    await Promise.allSettled([sessionDisposal, ...disposeFiber ? [record.fiber.dispose()] : []]);
  }
};

// index.js
var inject = [
  "connection",
  "fileUpload",
  "typert",
  "remote",
  "remote.commands",
  "remote.session",
  "remote.subagents"
];
function apply(ctx) {
  const remotes = ctx.remote;
  const connection = ctx.get("connection");
  const sessions = new ClientSessions(ctx, remotes);
  sessions;
  ctx.remote.$on("api-session/added", (summary) => {
    sessions.handleSessionAdded(summary);
  });
  ctx.remote.$on("api-session/removed", (sessionId) => {
    sessions.handleSessionRemoved(sessionId);
  });
  ctx.remote.$on("api-session/status", (sessionId, running) => {
    sessions.handleSessionStatus(sessionId, running);
  });
  ctx.remote.$on("api-session/activity", (sessionId, updatedAt) => {
    sessions.handleSessionActivity(sessionId, updatedAt);
  });
  ctx.remote.$on("api-session/error", (sessionId, message) => {
    sessions.handleSessionError(sessionId, message);
  });
  const control = createSessionControlStream(remotes, {
    accept: (frame) => {
      sessions.handleControlFrame(frame);
    },
    failed: (error) => {
      console.error("[session-controller] control stream failed:", error);
    }
  });
  const connected = () => {
    if (connection.generation.getSnapshot() === void 0)
      return;
    sessions.handleConnected();
    control.restart();
    control.start();
  };
  ctx.effect(() => connection.generation.subscribe(connected), "session-controller.client.generation");
  connected();
  ctx.typert.contexts.registerClient("agent", {
    identity: (candidate) => sessions.sessionOf(candidate)?.sessionId,
    resolve: (sessionId) => {
      const reference = sessions.retainAgentScope(sessionId);
      return typertOwnedValue(reference.binding.ctx, () => {
        reference.release();
      });
    }
  });
  ctx.effect(() => async () => {
    await control.dispose();
  }, "session-controller.client.control");
}
return module.exports; } });
