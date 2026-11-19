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
function historyRecordFirstSeq(record2) {
  return record2.event.seq;
}
function historyRecordLastSeq(record2) {
  return record2.event.seq;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-brand/lib/index.js
function brandNumber(value) {
  return value;
}

// ../../../session/lib/types.js
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

// ../../../session/lib/known-event-types.js
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
  "developer/message",
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
  "opening/invocation",
  "opening/request-attempt",
  "opening/generated-receipt",
  "opening/closing-ack",
  "permission/preset",
  "plan/mode",
  "request/context",
  "request/header",
  "request/material",
  "roleplay/author-dialog-activation",
  "roleplay/ruby-task-activation",
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

// ../../../session/lib/request-material-types.js
function fail(subject) {
  throw Error(`${subject} has invalid required request material`);
}
var record = (value, fields, subject) => {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== fields.length || Object.keys(value).some((key) => !fields.includes(key)))
    return fail(subject);
  return value;
};
var integer = (value, max = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max && !Object.is(value, -0);
var identity = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
var sha = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var list = (value, max, subject) => Array.isArray(value) && value.length <= max ? value : fail(subject);
function dataRef(value, subject) {
  const row = record(value, ["key", "sha256"], subject);
  if (!identity(row["key"]) || !sha(row["sha256"]))
    fail(subject);
}
function validateNativeRequestMaterialDataV1(value, subject) {
  const version = value?.schemaVersion;
  const row = record(value, [
    "schemaVersion",
    "encoding",
    "turn",
    "step",
    "header",
    "snapshot",
    "plan",
    "base",
    "delta",
    "placements",
    "outputSha256",
    ...version === 3 ? ["owner", "orderedMessages"] : []
  ], subject);
  if (!(version === 1 && row["encoding"] === "native-request-material-v1" || version === 2 && row["encoding"] === "native-request-material-v2" || version === 3 && row["encoding"] === "native-request-material-v3") || !integer(row["turn"]) || row["turn"] < 1 || !integer(row["step"]) || row["step"] < 1 || !sha(row["outputSha256"]))
    fail(subject);
  dataRef(row["snapshot"], subject);
  dataRef(row["plan"], subject);
  if (version === 3) {
    const owner = record(row["owner"], [
      "kind",
      "taskId",
      "generation",
      "operationId",
      "generationId",
      "rootSessionId",
      "childSessionId",
      "messageId",
      "planSha256"
    ], subject);
    if (owner["kind"] !== "author-generation" || !sha(owner["planSha256"]) || ["taskId", "generation", "operationId", "generationId", "rootSessionId", "childSessionId", "messageId"].some((key) => !identity(owner[key])))
      fail(subject);
    for (const message of list(row["orderedMessages"], 4096, subject)) {
      if (!message || typeof message !== "object" || !["system", "user", "assistant"].includes(String(message.role)) || !Array.isArray(message.content))
        fail(subject);
    }
  }
  const header = record(row["header"], ["seq", "sha256"], subject);
  const base = record(row["base"], ["boundarySeq", "contentGeneration", "surfaceNodes", "messages", "sha256"], subject);
  if (!integer(base["boundarySeq"], 65535) || !integer(base["contentGeneration"]) || !sha(base["sha256"]) || !integer(header["seq"]) || header["seq"] > base["boundarySeq"] || !sha(header["sha256"]))
    fail(subject);
  const boundarySeq = base["boundarySeq"];
  const nodes = list(base["surfaceNodes"], 65536, subject);
  if (nodes.some((seq) => !integer(seq) || seq > boundarySeq) || new Set(nodes).size !== nodes.length)
    fail(subject);
  const messages = list(base["messages"], 4096, subject);
  let priorPosition = -1;
  const ids = /* @__PURE__ */ new Set();
  for (const item of messages) {
    const ref = record(item, ["seq", "id", "role", "messageSha256"], subject);
    const position = nodes.indexOf(ref["seq"]);
    if (!integer(ref["seq"]) || position <= priorPosition || !identity(ref["id"]) || ids.has(ref["id"]) || !["system", "developer", "user", "assistant", "tool"].includes(String(ref["role"])) || !sha(ref["messageSha256"]))
      fail(subject);
    priorPosition = position;
    ids.add(ref["id"]);
  }
  const rawDelta = row["delta"];
  const delta = record(rawDelta, [
    "insertions",
    "protectedPrefixLength",
    ...version === 2 ? ["messageTextProjections"] : [],
    ...Object.hasOwn(rawDelta, "messageProjection") ? ["messageProjection"] : [],
    ...Object.hasOwn(rawDelta, "requestLocalSampling") ? ["requestLocalSampling"] : [],
    ...Object.hasOwn(rawDelta, "finalTextProjection") ? ["finalTextProjection"] : []
  ], subject);
  if (delta["finalTextProjection"] !== void 0)
    validateNativeMaterialFinalTextProjectionV1(delta["finalTextProjection"], subject);
  if (delta["messageProjection"] !== void 0)
    validateNativeMessageProjectionV1(delta["messageProjection"], subject);
  if (delta["requestLocalSampling"] !== void 0) {
    const local = record(delta["requestLocalSampling"], ["schemaVersion", "base"], subject);
    if (local["schemaVersion"] !== 1)
      fail(subject);
    const raw = local["base"];
    const base2 = record(raw, [
      "temperature",
      "maxTokens",
      "stop",
      "topP",
      "topK",
      "frequencyPenalty",
      "presencePenalty",
      "toolChoice",
      "responseFormat"
    ].filter((key) => Object.hasOwn(raw, key)), subject);
    if (base2["temperature"] !== void 0 && (typeof base2["temperature"] !== "number" || !Number.isFinite(base2["temperature"])))
      fail(subject);
    if (base2["maxTokens"] !== void 0 && (!integer(base2["maxTokens"]) || base2["maxTokens"] < 1))
      fail(subject);
    if (base2["stop"] !== void 0 && list(base2["stop"], 128, subject).some((value2) => typeof value2 !== "string"))
      fail(subject);
  }
  if (!integer(delta["protectedPrefixLength"], messages.length))
    fail(subject);
  if (version === 2) {
    const projected = /* @__PURE__ */ new Set();
    for (const value2 of list(delta["messageTextProjections"], 4096, subject)) {
      const projection = record(value2, ["target", "textEdits", "projectionSha256"], subject);
      const target = record(projection["target"], ["id", "role", "messageSha256"], subject);
      if (!identity(target["id"]) || projected.has(target["id"]) || !["user", "assistant"].includes(String(target["role"])) || !sha(target["messageSha256"]) || !sha(projection["projectionSha256"]))
        fail(subject);
      projected.add(target["id"]);
      const edits = list(projection["textEdits"], 4096, subject), indices = /* @__PURE__ */ new Set();
      if (!edits.length)
        fail(subject);
      for (const value3 of edits) {
        const edit = record(value3, ["blockIndex", "replacementText"], subject);
        if (!integer(edit["blockIndex"], 4095) || indices.has(edit["blockIndex"]) || typeof edit["replacementText"] !== "string" || !edit["replacementText"].isWellFormed())
          fail(subject);
        indices.add(edit["blockIndex"]);
      }
    }
  }
  const insertions = list(delta["insertions"], 128, subject), contributions = /* @__PURE__ */ new Set(), orders = /* @__PURE__ */ new Set();
  let bytes = 0;
  for (const item of insertions) {
    const insertion = record(item, [
      "contributionRef",
      "sourceSha256",
      "renderedText",
      "renderedSha256",
      "requestedRole",
      "requestedDepth",
      "stableOrder"
    ], subject);
    if (!identity(insertion["contributionRef"]) || contributions.has(insertion["contributionRef"]) || !sha(insertion["sourceSha256"]) || !sha(insertion["renderedSha256"]) || typeof insertion["renderedText"] !== "string" || !insertion["renderedText"].trim() || !insertion["renderedText"].isWellFormed() || insertion["renderedText"].length > 65536 || !["system", "user", "assistant"].includes(String(insertion["requestedRole"])) || !integer(insertion["requestedDepth"], 4096) || !integer(insertion["stableOrder"]) || orders.has(insertion["stableOrder"]))
      fail(subject);
    contributions.add(insertion["contributionRef"]);
    orders.add(insertion["stableOrder"]);
    bytes += new TextEncoder().encode(insertion["renderedText"]).byteLength;
    if (bytes > 1048576)
      fail(subject);
  }
  const placements = list(row["placements"], 128, subject);
  if (placements.length !== insertions.length)
    fail(subject);
  const placed = /* @__PURE__ */ new Set(), placementIds = /* @__PURE__ */ new Set();
  for (const item of placements) {
    const placement = record(item, ["contributionRef", "baseIndex", "protectedPrefixLength", "effectiveDepth", "messageId"], subject);
    if (!identity(placement["contributionRef"]) || !contributions.has(placement["contributionRef"]) || placed.has(placement["contributionRef"]) || !integer(placement["baseIndex"], messages.length) || placement["baseIndex"] < delta["protectedPrefixLength"] || placement["protectedPrefixLength"] !== delta["protectedPrefixLength"] || placement["effectiveDepth"] !== messages.length - placement["baseIndex"] || !identity(placement["messageId"]) || ids.has(placement["messageId"]) || placementIds.has(placement["messageId"]))
      fail(subject);
    placed.add(placement["contributionRef"]);
    placementIds.add(placement["messageId"]);
  }
}
function validateNativeMessageProjectionV1(value, subject) {
  const projection = record(value, [
    "schemaVersion",
    "encoding",
    "groups",
    ...value !== null && typeof value === "object" && Object.hasOwn(value, "textEdits") ? ["textEdits"] : []
  ], subject);
  if (projection["schemaVersion"] !== 1 || projection["encoding"] !== "native-request-message-projection-v1")
    fail(subject);
  const ids = /* @__PURE__ */ new Set();
  let bytes = 0;
  for (const item of list(projection["groups"], 4096, subject)) {
    const group = record(item, ["targets", "role", "renderedText"], subject);
    const targets = list(group["targets"], 4096, subject);
    if (!targets.length || !["system", "user", "assistant"].includes(String(group["role"])) || typeof group["renderedText"] !== "string" || !group["renderedText"].isWellFormed())
      fail(subject);
    bytes += new TextEncoder().encode(group["renderedText"]).byteLength;
    if (bytes > 4194304)
      fail(subject);
    for (const value2 of targets) {
      const target = record(value2, ["id", "messageSha256"], subject);
      if (!identity(target["id"]) || !sha(target["messageSha256"]) || ids.has(target["id"]))
        fail(subject);
      ids.add(target["id"]);
    }
  }
  if (projection["textEdits"] !== void 0)
    for (const value2 of list(projection["textEdits"], 4096, subject)) {
      const edit = record(value2, ["target", "blocks"], subject), target = record(edit["target"], ["id", "messageSha256"], subject);
      if (!identity(target["id"]) || !sha(target["messageSha256"]) || ids.has(target["id"]))
        fail(subject);
      ids.add(target["id"]);
      const indexes = /* @__PURE__ */ new Set();
      for (const value3 of list(edit["blocks"], 4096, subject)) {
        const block = record(value3, ["index", "text"], subject);
        if (!integer(block["index"]) || indexes.has(block["index"]) || typeof block["text"] !== "string" || !block["text"].isWellFormed())
          fail(subject);
        indexes.add(block["index"]);
        bytes += new TextEncoder().encode(block["text"]).byteLength;
        if (bytes > 4194304)
          fail(subject);
      }
    }
}
function validateNativeMaterialFinalTextProjectionV1(value, subject) {
  const projection = record(value, ["schemaVersion", "encoding", "textOutputs"], subject);
  if (projection["schemaVersion"] !== 1 || projection["encoding"] !== "native-request-final-text-projection-v1")
    fail(subject);
  let priorMessage = -1, priorBlock = -1, bytes = 0;
  for (const value2 of list(projection["textOutputs"], 131072, subject)) {
    const output2 = record(value2, ["messageOrdinal", "blockOrdinal", "text"], subject);
    const message = output2["messageOrdinal"], block = output2["blockOrdinal"];
    if (!integer(message, 4351) || block !== null && !integer(block, 4095) || typeof output2["text"] !== "string" || !output2["text"].isWellFormed() || message < priorMessage || message === priorMessage && (block === null || priorBlock < 0 || block <= priorBlock))
      fail(subject);
    priorMessage = message;
    priorBlock = block === null ? -1 : block;
    bytes += new TextEncoder().encode(output2["text"]).byteLength;
    if (bytes > 16777216)
      fail(subject);
  }
}

// ../../../session/lib/opening-records.js
var NATIVE_OPENING_RECORD_BOUNDS_V1 = Object.freeze({
  bytes: 16777216,
  nodes: 131072,
  depth: 64,
  steps: 256,
  requests: 256,
  outputs: 256,
  toolEvents: 4096,
  instructionBytes: 65536
});
var NativeOpeningRecordFailureV1 = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "NativeOpeningRecordFailureV1";
  }
};
function fail2(code = "OPENING_RECORD_INVALID") {
  throw new NativeOpeningRecordFailureV1(code);
}
var utf8Bytes = (value) => new TextEncoder().encode(value).byteLength;
function nativeOpeningDataV1(value) {
  let nodes = 0, bytes = 0;
  const active = /* @__PURE__ */ new WeakSet();
  const charge = (size) => {
    bytes += size;
    if (bytes > NATIVE_OPENING_RECORD_BOUNDS_V1.bytes)
      fail2("OPENING_RECORD_BUDGET");
  };
  function visit(input, depth) {
    if (++nodes > NATIVE_OPENING_RECORD_BOUNDS_V1.nodes || depth > NATIVE_OPENING_RECORD_BOUNDS_V1.depth)
      fail2("OPENING_RECORD_BUDGET");
    if (input === null || typeof input === "boolean") {
      charge(5);
      return input;
    }
    if (typeof input === "number") {
      if (!Number.isFinite(input) || Object.is(input, -0))
        fail2();
      charge(32);
      return input;
    }
    if (typeof input === "string") {
      if (!input.isWellFormed())
        fail2();
      charge(utf8Bytes(input) + 2);
      return input;
    }
    if (typeof input !== "object" || active.has(input))
      return fail2();
    active.add(input);
    try {
      if (Array.isArray(input)) {
        const keys = Reflect.ownKeys(input);
        if (keys.length !== input.length + 1)
          return fail2();
        const result2 = [];
        for (let index = 0; index < input.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
          if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable)
            return fail2();
          result2.push(visit(descriptor.value, depth + 1));
        }
        charge(2);
        return Object.freeze(result2);
      }
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null)
        return fail2();
      const result = /* @__PURE__ */ Object.create(null);
      for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== "string" || key === "__proto__" || key === "constructor" || key === "prototype")
          return fail2();
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable)
          return fail2();
        charge(utf8Bytes(key) + 3);
        result[key] = visit(descriptor.value, depth + 1);
      }
      charge(2);
      return Object.freeze(result);
    } finally {
      active.delete(input);
    }
  }
  return visit(value, 0);
}
function nativeOpeningCanonicalV1(data) {
  if (Array.isArray(data))
    return `[${data.map(nativeOpeningCanonicalV1).join(",")}]`;
  if (data !== null && typeof data === "object")
    return `{${Object.keys(data).sort().map((key) => `${JSON.stringify(key)}:${nativeOpeningCanonicalV1(data[key])}`).join(",")}}`;
  return JSON.stringify(data);
}
var same = (left, right) => nativeOpeningCanonicalV1(nativeOpeningDataV1(left)) === nativeOpeningCanonicalV1(nativeOpeningDataV1(right));
var isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function exact(value, fields) {
  if (!isObject(value) || Object.keys(value).length !== fields.length || fields.some((key) => !Object.hasOwn(value, key)))
    fail2();
}
var hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var count = (value, positive = false) => typeof value === "number" && Number.isSafeInteger(value) && value >= (positive ? 1 : 0) && !Object.is(value, -0);
var id = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
function eventRef(value) {
  exact(value, ["seq", "sha256"]);
  if (!count(value["seq"]) || !hash(value["sha256"]))
    fail2();
}
function dataRef2(value) {
  exact(value, ["key", "sha256"]);
  if (!id(value["key"]) || !hash(value["sha256"]))
    fail2();
}
function identity2(value) {
  exact(value, ["kind", "sessionId", "operationId", "messageId", "instruction", "instructionSha256", "intentRef"]);
  if (value["kind"] !== "programmatic-opening" || !id(value["sessionId"]) || !id(value["operationId"]) || !id(value["messageId"]) || typeof value["instruction"] !== "string" || !value["instruction"].trim() || utf8Bytes(value["instruction"]) > NATIVE_OPENING_RECORD_BOUNDS_V1.instructionBytes || !hash(value["instructionSha256"]))
    fail2();
  dataRef2(value["intentRef"]);
}
function recordShape(value, encoding, fields, hashKey) {
  const data = nativeOpeningDataV1(value);
  exact(data, ["schemaVersion", "encoding", ...fields, hashKey]);
  if (data["schemaVersion"] !== 1 || data["encoding"] !== encoding || !hash(data[hashKey]))
    fail2();
  return data;
}
function validateNativeOpeningInvocationV1(value) {
  const data = recordShape(value, "native-programmatic-opening-invocation-v1", ["identity", "expectedTurn", "prefix"], "invocationSha256");
  identity2(data["identity"]);
  exact(data["prefix"], ["eventCount", "inheritedEventCount", "sha256"]);
  if (!count(data["expectedTurn"], true) || !count(data["prefix"]["eventCount"]) || !count(data["prefix"]["inheritedEventCount"]) || data["prefix"]["inheritedEventCount"] > data["prefix"]["eventCount"] || !hash(data["prefix"]["sha256"]))
    fail2();
  return data;
}
function validateNativeOpeningRequestAttemptV1(value) {
  const data = recordShape(value, "native-programmatic-opening-request-attempt-v1", ["invocationRef", "turn", "step", "attempt", "assemblySha256", "selectedSha256"], "attemptSha256");
  eventRef(data["invocationRef"]);
  if (!count(data["turn"], true) || !count(data["step"], true) || !count(data["attempt"], true) || data["step"] > NATIVE_OPENING_RECORD_BOUNDS_V1.steps || data["attempt"] > NATIVE_OPENING_RECORD_BOUNDS_V1.requests || !hash(data["assemblySha256"]) || !hash(data["selectedSha256"]))
    fail2();
  return data;
}
function publication(value) {
  exact(value, ["attemptRef", "materialRef", "headerRef", "configSha256", "requestMessagesSha256", "snapshot", "plan"]);
  eventRef(value["attemptRef"]);
  eventRef(value["materialRef"]);
  eventRef(value["headerRef"]);
  dataRef2(value["snapshot"]);
  dataRef2(value["plan"]);
  if (!hash(value["configSha256"]) || !hash(value["requestMessagesSha256"]) || value["attemptRef"].seq >= value["materialRef"].seq || value["headerRef"].seq >= value["materialRef"].seq)
    fail2();
}
function output(value) {
  exact(value, ["eventRef", "messageId", "messageSha256", "textEncoding", "textSha256", "step"]);
  eventRef(value["eventRef"]);
  if (!id(value["messageId"]) || !hash(value["messageSha256"]) || !count(value["step"], true) || value["textEncoding"] !== "native-model-text-blocks-concat-v1" || !hash(value["textSha256"]))
    fail2();
}
function validateNativeGeneratedOpeningReceiptV1(value) {
  const data = recordShape(value, "native-generated-opening-receipt-v1", [
    "production",
    "invocationRef",
    "identity",
    "turn",
    "turnStartRef",
    "turnEndRef",
    "turnSpanSha256",
    "invocationSpanSha256",
    "steps",
    "outputs",
    "requestedOutput",
    "terminalOutput",
    "toolEvents",
    "flushed"
  ], "receiptSha256");
  identity2(data["identity"]);
  eventRef(data["invocationRef"]);
  eventRef(data["turnStartRef"]);
  eventRef(data["turnEndRef"]);
  if (data["production"] !== "generated-opening" || data["flushed"] !== true || !count(data["turn"], true) || !hash(data["turnSpanSha256"]) || !hash(data["invocationSpanSha256"]) || data["invocationRef"].seq >= data["turnStartRef"].seq || data["turnStartRef"].seq >= data["turnEndRef"].seq || !Array.isArray(data["steps"]) || !data["steps"].length || data["steps"].length > NATIVE_OPENING_RECORD_BOUNDS_V1.steps || !Array.isArray(data["outputs"]) || !data["outputs"].length || data["outputs"].length > NATIVE_OPENING_RECORD_BOUNDS_V1.outputs || !Array.isArray(data["toolEvents"]) || data["toolEvents"].length > NATIVE_OPENING_RECORD_BOUNDS_V1.toolEvents)
    fail2();
  let requests = 0, previousStepEnd = data["turnStartRef"].seq;
  for (const [index, step] of data["steps"].entries()) {
    exact(step, ["step", "startRef", "endRef", "requests"]);
    eventRef(step["startRef"]);
    eventRef(step["endRef"]);
    if (step["step"] !== index + 1 || step["startRef"].seq <= previousStepEnd || step["endRef"].seq <= step["startRef"].seq || step["endRef"].seq >= data["turnEndRef"].seq || !Array.isArray(step["requests"]) || !step["requests"].length)
      fail2();
    let prior = step["startRef"].seq;
    for (const request of step["requests"]) {
      publication(request);
      if (request.attemptRef.seq <= prior || request.materialRef.seq >= step["endRef"].seq)
        fail2();
      prior = request.materialRef.seq;
      if (++requests > NATIVE_OPENING_RECORD_BOUNDS_V1.requests)
        fail2("OPENING_RECORD_BUDGET");
    }
    previousStepEnd = step["endRef"].seq;
  }
  let previousOutput = data["turnStartRef"].seq;
  const ids = /* @__PURE__ */ new Set();
  for (const value2 of data["outputs"]) {
    output(value2);
    if (value2.eventRef.seq <= previousOutput || value2.eventRef.seq >= data["turnEndRef"].seq || ids.has(value2.messageId) || value2.step > data["steps"].length)
      fail2();
    ids.add(value2.messageId);
    previousOutput = value2.eventRef.seq;
  }
  output(data["requestedOutput"]);
  output(data["terminalOutput"]);
  if (data["requestedOutput"].messageId !== data["identity"].messageId || data["requestedOutput"].step !== 1 || !data["outputs"].some((item) => same(item, data["requestedOutput"])) || !same(data["terminalOutput"], data["outputs"].at(-1)))
    fail2();
  let previousTool = data["turnStartRef"].seq;
  for (const tool of data["toolEvents"]) {
    exact(tool, ["type", "eventRef"]);
    eventRef(tool["eventRef"]);
    if (tool["type"] !== "tool/call" && tool["type"] !== "tool/result" || tool["eventRef"].seq <= previousTool || tool["eventRef"].seq >= data["turnEndRef"].seq)
      fail2();
    previousTool = tool["eventRef"].seq;
  }
  return data;
}
function validateNativeOpeningClosingAckV1(value) {
  const data = recordShape(value, "native-programmatic-opening-closing-ack-v1", ["invocationRef", "generatedReceiptRef", "receiptSha256", "ownerReceiptSha256"], "ackSha256");
  eventRef(data["invocationRef"]);
  eventRef(data["generatedReceiptRef"]);
  if (!hash(data["receiptSha256"]) || !hash(data["ownerReceiptSha256"]) || data["generatedReceiptRef"].seq <= data["invocationRef"].seq)
    fail2();
  return data;
}
var NATIVE_OPENING_EVENT_TYPES_V1 = /* @__PURE__ */ new Set([
  "opening/invocation",
  "opening/request-attempt",
  "opening/generated-receipt",
  "opening/closing-ack"
]);
function validateNativeOpeningSessionEventV1(type, data) {
  switch (type) {
    case "opening/invocation":
      validateNativeOpeningInvocationV1(data);
      return;
    case "opening/request-attempt":
      validateNativeOpeningRequestAttemptV1(data);
      return;
    case "opening/generated-receipt":
      validateNativeGeneratedOpeningReceiptV1(data);
      return;
    case "opening/closing-ack":
      validateNativeOpeningClosingAckV1(data);
      return;
    default:
      return fail2();
  }
}

// ../../../session/lib/surface.js
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
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
var PROGRAMMATIC_TURN_IDENTITY_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "operationId",
  "messageId",
  "producer",
  "origin",
  "textSha256"
]);
function validateProgrammaticTurnIdentity(value, subject) {
  if (!isRecord(value) || value["schemaVersion"] !== 1 || Object.keys(value).some((key) => !PROGRAMMATIC_TURN_IDENTITY_FIELDS.has(key))) {
    throw new Error(`${subject} has invalid programmatic identity`);
  }
  for (const field of ["operationId", "messageId", "producer", "origin"]) {
    const identity3 = value[field];
    if (typeof identity3 !== "string" || identity3.length < 1 || identity3.length > 256 || identity3 !== identity3.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(identity3)) {
      throw new Error(`${subject} has invalid programmatic identity ${field}`);
    }
  }
  if (typeof value["textSha256"] !== "string" || !/^[a-f0-9]{64}$/.test(value["textSha256"])) {
    throw new Error(`${subject} has invalid programmatic identity textSha256`);
  }
}
function validateSessionEventData(event, subject) {
  const data = event.data;
  if (event.type === "request/material")
    validateNativeRequestMaterialDataV1(data, subject);
  if (NATIVE_OPENING_EVENT_TYPES_V1.has(event.type))
    validateNativeOpeningSessionEventV1(event.type, data);
  if (event.type === "turn/start" && isRecord(data) && Object.hasOwn(data, "programmatic")) {
    validateProgrammaticTurnIdentity(data["programmatic"], subject);
  }
  if (SURFACE_EVENT_TYPES.has(event.type) && isRecord(data)) {
    const message = event.type === "user/message" ? data : data["message"];
    if (isRecord(message)) {
      if (event.type === "developer/message" !== (message["role"] === "developer")) {
        throw new Error(`${subject} developer/message and developer role must occur together`);
      }
      if (message["role"] !== "developer" && Array.isArray(message["content"]) && message["content"].some((block) => isRecord(block) && (block["type"] === "tool-addition" || block["type"] === "tool-removal"))) {
        throw new Error(`${subject} tool-change blocks require developer role`);
      }
      if (event.type === "developer/message" && Array.isArray(message["content"])) {
        let hasAdditions = false;
        for (const block of message["content"]) {
          if (!isRecord(block) || block["type"] !== "tool-addition" && block["type"] !== "tool-removal")
            continue;
          if (typeof block["toolName"] !== "string" || block["toolName"].length === 0) {
            throw new Error(`${subject} ${block["type"]} requires a nonempty toolName`);
          }
          if (block["type"] === "tool-addition") {
            hasAdditions = true;
            if (Object.hasOwn(block, "tool"))
              throw new Error(`${subject} tool-addition must omit inline tool definitions`);
          }
        }
        if (hasAdditions ? !isEventSeq(data["headerSeq"]) : Object.hasOwn(data, "headerSeq")) {
          throw new Error(`${subject} requires headerSeq exactly when tool additions are present`);
        }
      }
    }
  }
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
    if (!isRecord(message) || message["isError"] !== true) {
      throw new Error(`${subject} error requires message.isError === true`);
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
  if (event.type === "request/material") {
    validateNativeRequestMaterialDataV1(event.data, `request/material at seq ${event.seq}`);
    if (event.seq !== event.data.base.boundarySeq + 1 || event.ignorable !== void 0 || event.surfaceOp !== void 0 || event.sourceEventSeqs !== void 0) {
      throw Error(`request/material at seq ${event.seq} has invalid required envelope`);
    }
  }
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
      activate: this.address.kind === "session",
      assistantStream: true,
      ...this.repairRequest(request)
    }, signal)) {
      if (frame.type === "snapshot") {
        for (const record2 of frame.records)
          assertSessionWireEvent(record2.event);
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
    for (const record2 of result.value.records)
      assertSessionWireEvent(record2.event);
    return result.value;
  }
  /** @inheritdoc */
  repairRequest(request) {
    return {
      ...request.maxMessages === void 0 ? {} : { maxMessages: request.maxMessages },
      ...request.turnWindow === void 0 ? {} : { turnWindow: request.turnWindow }
    };
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
  const identity3 = { sessionId: key };
  const scoped = fiber.ctx.extend({
    [kScope]: identity3,
    [import_cordis2.Context.filter](listenerCtx) {
      const tag = scopeIdentityOf(listenerCtx);
      return tag === void 0 || tag === identity3;
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

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
var SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
var CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
function isWhitespace(c) {
  return c === " " || c === "\n" || c === "\r" || c === "	";
}
function isHex(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
var PartialArguments = class PartialArguments2 {
  /** The view of a call with no arguments available. */
  static EMPTY = PartialArguments2.fromObject({});
  /**
  * View finished argument text without scanning it until a reader asks.
  * @param text - the complete argument JSON text.
  * @returns a sealed view.
  */
  static fromText(text) {
    const view = new PartialArguments2();
    view.append(text);
    view.sealed = true;
    return view;
  }
  /**
  * View an already parsed argument payload, such as a PTC dispatch object.
  * @param value - the parsed argument value.
  * @returns a sealed view; a non-object payload has no fields.
  */
  static fromObject(value) {
    const view = new PartialArguments2();
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    view.sealed = true;
    return view;
  }
  /**
  * The source: text so far or a parsed object, plus whether it can still grow.
  * These are the only enumerable fields, so two views over the same source
  * compare equal structurally however far each has been read.
  */
  chunks = [];
  object;
  sealed = false;
  #ends = [];
  #size = 0;
  #consumed = 0;
  #mode = "root";
  #escape = false;
  #keyStart = 0;
  #keyEscaped = false;
  #key = "";
  #current = null;
  #nestedEnds = [];
  #nestedInString = false;
  #invalidAt;
  #invalidValue = false;
  #entries = /* @__PURE__ */ new Map();
  #order = [];
  #reads = /* @__PURE__ */ new Map();
  /** Whether this view rejects further appends; does not scan text or register reads. */
  get isSealed() {
    return this.sealed;
  }
  /** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
  get invalid() {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }
  /**
  * Retain streamed argument text without scanning or comparing observed answers.
  * @param fragment - the text following every fragment appended before.
  */
  append(fragment) {
    if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0) return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }
  /**
  * Reconcile a streamed prefix with authoritative complete text without joining the fragments.
  * @param text - the final argument text, which replaces missing or conflicting deltas.
  * @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
  */
  settle(text) {
    if (this.object !== void 0 || text.length !== this.#size) return PartialArguments2.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset)) return PartialArguments2.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }
  /**
  * Compare observed answers and advance their publication baseline. Unread views remain unscanned.
  * @returns whether any observed answer changed since its first read or the preceding refresh.
  */
  refresh() {
    if (this.#reads.size === 0) return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
    }
    if (this.sealed) this.#reads.clear();
    return changed;
  }
  refreshRead(read) {
    const now = read.answer();
    if (Object.is(now, read.last)) return false;
    read.last = now;
    return true;
  }
  /**
  * Check whether no further fields can arrive.
  * @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
  */
  closed() {
    return this.remember("closed", "", () => this.closedNow());
  }
  /**
  * List discovered fields in first-appearance order.
  * @returns top-level keys seen so far, in first-appearance order.
  */
  keys() {
    return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
  }
  /**
  * Check whether a top-level field has appeared.
  * @param key - argument name.
  * @returns whether the field has appeared (a string opened or another value began).
  */
  has(key) {
    return this.remember("has", key, () => this.hasNow(key));
  }
  /**
  * Check whether a field's closing delimiter has arrived, without validating its contents.
  * @param key - argument name.
  * @returns whether its delimiter arrived and no content reader has reported an error for this value.
  */
  complete(key) {
    return this.remember("complete", key, () => this.completeNow(key));
  }
  /**
  * Read string length without materializing its text.
  * @param key - argument name.
  * @param options - change granularity for a streaming string.
  * @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
  */
  stringLength(key, options) {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
  }
  /**
  * Check a string against a decoded UTF-16 length limit without materializing it.
  * @param key - argument name.
  * @param maxLength - decoded UTF-16 limit, floored to at least zero.
  * @returns whether the string is longer than the limit; false when absent or not a string.
  */
  stringExceeds(key, maxLength) {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
  }
  /**
  * Read a decoded string, including a streaming prefix.
  * @param key - argument name.
  * @returns the string field's decoded text so far; undefined when absent or not a string.
  */
  text(key) {
    return this.remember("text", key, () => this.textNow(key));
  }
  /**
  * Read at most the first decoded UTF-16 units of a string.
  * @param key - argument name.
  * @param maxLength - maximum decoded UTF-16 length, floored to at least one.
  * @returns the bounded string prefix; undefined when absent or not a string.
  */
  textPrefix(key, maxLength) {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
  }
  /**
  * Read a completed non-string argument.
  * @param key - argument name.
  * @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
  */
  value(key) {
    return this.remember("value", key, () => this.valueNow(key));
  }
  /** Answer a question and, on a streaming view, remember it for change detection. */
  remember(kind, key, read, comparison) {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id2 = `${kind}/${key}`;
      if (!this.#reads.has(id2)) this.#reads.set(id2, {
        completion: kind === "complete",
        answer: comparison === void 0 ? read : () => comparison(read()),
        last: comparison === void 0 ? result : comparison(result)
      });
    }
    return result;
  }
  closedNow() {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }
  keysNow() {
    return this.object === void 0 ? this.#order : Object.keys(this.object);
  }
  hasNow(key) {
    return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }
  completeNow(key) {
    if (this.object !== void 0) return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
  }
  lengthNow(key, limit = Number.POSITIVE_INFINITY) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.length : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
    const read = entry.length ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, limit, false);
    return read.length;
  }
  textNow(key) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
      let text;
      try {
        text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
      } catch (_error) {
      }
      if (text !== void 0) entry.text = {
        at: entry.end,
        length: text.length,
        text
      };
    }
    const read = entry.text ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }
  textPrefixNow(key, maxLength) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.slice(0, maxLength) : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
    let read = prefixes.get(maxLength);
    if (read === void 0) {
      read = {
        at: entry.start,
        length: 0,
        text: ""
      };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }
  valueNow(key) {
    if (this.object !== void 0) {
      if (!Object.hasOwn(this.object, key)) return void 0;
      const field = this.object[key];
      return typeof field === "string" ? void 0 : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
    if (entry.parsed === void 0) try {
      entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
    } catch (_error) {
      entry.invalid = true;
      this.#invalidValue = true;
    }
    return entry.parsed;
  }
  chunkAt(at) {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.#ends[mid] <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  /** Materialize only a requested range, never the cumulative source. */
  slice(start, end) {
    if (start >= end) return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : this.#ends[first - 1];
    if (first === last) return this.chunks[first].slice(start - base, end - base);
    const parts = [this.chunks[first].slice(start - base)];
    for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
    parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
    return parts.join("");
  }
  readString(entry, read, limit, materialize2) {
    const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0) return;
      if (materialize2) read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
      const chunk = this.chunks[chunkIndex];
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize2) read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length) chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
      let decoded;
      let width = 2;
      if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0; i < hex.length; i++) if (!isHex(hex[i])) valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0) return;
          if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== void 0) decoded = SIMPLE_ESCAPES[type];
      if (decoded === void 0) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize2) read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
    }
  }
  /** Locate new field ranges without decoding or parsing their contents. */
  scan() {
    if (this.object !== void 0 || this.#consumed === this.#size) return;
    for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
      const pending = this.chunks[i];
      const base = i === 0 ? 0 : this.#ends[i - 1];
      for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length) break;
        }
        this.step(pending[index], this.#consumed);
        this.#consumed++;
      }
    }
  }
  /** Only raw quotes and their preceding backslash runs can terminate a string. */
  stringBoundary(fragment, start) {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped) return end;
      at = quote + 1;
    }
  }
  step(c, at) {
    switch (this.#mode) {
      case "root":
        if (isWhitespace(c)) return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace(c)) return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace(c)) return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace(c)) return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace(c)) return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace(c)) return;
        this.fail();
        return;
      /* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
      case "invalid":
        return;
      /* v8 ignore next 2 -- Every scanner mode has a handler above. */
      default:
        assertNever(this.#mode);
    }
  }
  fail() {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }
  beginKey(at) {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }
  stepKey(c, at) {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"') return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped) try {
      this.#key = JSON.parse(`"${raw}"`);
    } catch (_error) {
      this.fail();
      return;
    }
    else this.#key = raw;
    this.#mode = "colon";
  }
  open(entry) {
    if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }
  beginValue(c, at) {
    if (isWhitespace(c)) return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: void 0,
        length: void 0,
        text: void 0,
        prefixes: void 0
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({
      kind: "value",
      start: at,
      end: -1,
      parsed: void 0,
      invalid: false
    });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }
  stepScalar(c, at) {
    if (c !== "," && c !== "}" && !isWhitespace(c)) return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }
  stepNested(c, at) {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }
  closeValue(end) {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
};
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
function hasIntrinsicConstructor(prototype, name) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(name === "Array" ? Array : Object);
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
  let parent;
  const assign = (item) => {
    if (parent === void 0) {
      if (detach) root = item;
    } else if (parent.kind === "array") {
      if (parent.target !== void 0) parent.target[parent.key] = item;
    } else if (parent.target !== void 0) Object.defineProperty(parent.target, parent.key, {
      value: item,
      enumerable: true,
      configurable: true,
      writable: true
    });
  };
  const frames = [];
  let current = value;
  for (; ; ) {
    if (current === null) assign(null);
    else if (typeof current === "boolean" || typeof current === "string") assign(current);
    else if (typeof current === "number") {
      if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
      assign(current);
    } else {
      if (typeof current !== "object") return void 0;
      if (ancestors.has(current)) return void 0;
      if (Array.isArray(current)) {
        if (!hasPlainArrayPrototype(current)) return void 0;
        const length = current.length;
        if (Reflect.ownKeys(current).length !== length + 1) return void 0;
        const target = detach ? [] : void 0;
        if (target !== void 0) assign(target);
        let indices;
        if (!Number.isInteger(length)) {
          indices = [];
          for (let index = length - 1; index >= 0; index--) indices.push(index);
        }
        frames.push({
          kind: "array",
          source: current,
          length: indices?.length ?? length,
          index: 0,
          key: 0,
          indices,
          target
        });
      } else {
        if (!hasPlainObjectPrototype(current)) return void 0;
        const keys = enumerableStringKeys(current);
        if (keys === void 0) return void 0;
        const target = detach ? {} : void 0;
        if (target !== void 0) assign(target);
        frames.push({
          kind: "object",
          source: current,
          keys,
          index: 0,
          key: "",
          target
        });
      }
      ancestors.add(current);
    }
    for (; ; ) {
      const frame = frames.at(-1);
      if (frame === void 0) return detach ? root : true;
      const length = frame.kind === "array" ? frame.length : frame.keys.length;
      if (frame.index >= length) {
        ancestors.delete(frame.source);
        frames.pop();
        continue;
      }
      const index = frame.index++;
      parent = frame;
      if (frame.kind === "array") {
        const key = frame.indices === void 0 ? index : frame.indices[frame.indices.length - index - 1];
        if (key === void 0) return void 0;
        if (!Object.prototype.hasOwnProperty.call(frame.source, key)) return void 0;
        frame.key = key;
        current = frame.source[key];
      } else {
        const key = frame.keys[index];
        if (key === void 0) return void 0;
        frame.key = key;
        current = frame.source[key];
      }
      break;
    }
  }
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

// sessions/lineage.js
function flattenLineage(summaries) {
  const byId = /* @__PURE__ */ new Map();
  for (const s of summaries)
    byId.set(s.sessionId, s);
  const children = /* @__PURE__ */ new Map();
  const roots = [];
  for (const s of summaries) {
    if (s.parentSessionId !== void 0 && byId.has(s.parentSessionId)) {
      const list2 = children.get(s.parentSessionId) ?? [];
      list2.push(s);
      children.set(s.parentSessionId, list2);
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
    const { agentAvailable: _agentAvailable, ...row } = s;
    out.push({
      ...row,
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
   * Read the accepted Host watermark without subscribing or copying a value.
   * @param key - projection key.
   * @returns the current sequence, or undefined for absent and cached values.
   */
  seqOf(key) {
    const row = this.rows.get(key);
    return row?.kind === "sequenced" ? row.seq : void 0;
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
    if (row?.kind === "sequenced" && seq <= row.seq)
      return;
    this.rows.set(key, { kind: "sequenced", value, seq });
    this.changed(key);
  }
  /**
   * Fill keys from a session-list block the Host labeled `cached`: a zero-I/O
   * view of the persisted checkpoint. A cached value lands only where no
   * sequenced row exists: a connected Session has already answered for such
   * a key, and the list's view of the persisted checkpoint cannot be newer
   * than it.
   * @param values - whole values by key viewed from the persisted checkpoint.
   */
  applyCached(values) {
    for (const key of Object.keys(values)) {
      if (this.rows.get(key)?.kind === "sequenced")
        continue;
      this.rows.set(key, { kind: "cached", value: values[key] });
      this.changed(key);
    }
  }
  /**
   * Seed from a history tail page's projections block. Every cached row is
   * discarded first, regardless of seq: the block comes from the connected
   * Session, and a value viewed from the persisted checkpoint never outranks
   * it. Then every carried key lands under the same seq rule as frames, and a
   * key the block omits is capability-absent as of the cut — its row clears
   * unless a newer frame already superseded the cut (a stale baseline can
   * neither overwrite nor clear newer sequenced values).
   * @param baseline - the response's projections block.
   */
  seed(baseline) {
    for (const [key, row] of this.rows) {
      if (row.kind !== "cached")
        continue;
      this.rows.delete(key);
      this.changed(key);
    }
    const values = baseline.values;
    for (const key of Object.keys(values))
      this.apply(key, values[key], baseline.asOfSeq);
    for (const [key, row] of this.rows) {
      if (Object.hasOwn(values, key))
        continue;
      if (row.kind === "sequenced" && row.seq > baseline.asOfSeq)
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

// ../../../llm/lib/assistant-stream.js
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
    const record2 = validateRecord(candidate);
    if (record2.type === "chunk") {
      chunks.push({ time: record2.time, chunk: record2.chunk });
      continue;
    }
    const members = record2.type === "tool-call-chunks" ? record2.args : record2.texts;
    let time = record2.time0;
    for (let index = 0; index < members.length; index += 1) {
      if (index > 0)
        time += record2.dt[index - 1];
      let chunk;
      if (record2.type === "text-chunks") {
        chunk = { type: "text-delta", index: record2.index, text: members[index] };
      } else if (record2.type === "reasoning-chunks") {
        chunk = { type: "reasoning-delta", index: record2.index, text: members[index] };
      } else {
        chunk = {
          type: "tool-call-delta",
          index: record2.index,
          id: record2.id,
          ...Object.hasOwn(record2, "name") ? { name: record2.name } : {},
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
  const record2 = value;
  switch (record2.type) {
    case "text-chunks":
    case "reasoning-chunks": {
      exactKeys(record2, ["type", "time0", "index", "dt", "texts"], record2.type);
      const texts = stringArray(record2.texts, `${record2.type} texts`);
      if (texts.length === 0)
        throw new TypeError(`${record2.type} texts must be non-empty`);
      validateRun(record2, texts.length, record2.type);
      return record2;
    }
    case "tool-call-chunks": {
      const keys = Object.hasOwn(record2, "name") ? ["type", "time0", "index", "dt", "id", "name", "args"] : ["type", "time0", "index", "dt", "id", "args"];
      exactKeys(record2, keys, record2.type);
      const args = stringArray(record2.args, "tool-call-chunks args");
      if (args.length === 0)
        throw new TypeError("tool-call-chunks args must be non-empty");
      if (typeof record2.id !== "string" || record2.id.length === 0) {
        throw new TypeError("tool-call-chunks id must be a non-empty string");
      }
      if (record2.name !== void 0 && (typeof record2.name !== "string" || record2.name.length === 0)) {
        throw new TypeError("tool-call-chunks name must be a non-empty string");
      }
      validateRun(record2, args.length, record2.type);
      return record2;
    }
    case "chunk": {
      exactKeys(record2, ["type", "time", "chunk"], "chunk");
      const time = safeTime(record2.time);
      if (typeof record2.chunk !== "object" || record2.chunk === null || Array.isArray(record2.chunk)) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object");
      }
      let chunk;
      try {
        chunk = snapshotChunk(record2.chunk);
      } catch (error) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object", { cause: error });
      }
      return deepFreeze({ type: "chunk", time, chunk });
    }
    default:
      throw new TypeError(`Unsupported Assistant stream record ${JSON.stringify(record2.type)}`);
  }
}
function validateRun(record2, members, label) {
  safeTime(record2.time0);
  safeIndex(record2.index, label);
  if (!Array.isArray(record2.dt) || record2.dt.some((value) => !Number.isSafeInteger(value))) {
    throw new TypeError(`${label} dt must contain safe integers`);
  }
  if (record2.dt.length !== members - 1) {
    throw new TypeError(`${label} dt length must be one less than its members`);
  }
  let time = record2.time0;
  for (const gap of record2.dt) {
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
function exactKeys(record2, keys, label) {
  if (Object.keys(record2).length !== keys.length || !keys.every((key) => Object.hasOwn(record2, key))) {
    throw new TypeError(`${label} Assistant stream record must contain exactly ${keys.join(", ")}`);
  }
}

// sessions/assistant-stream.js
var ClientAssistantStream = class {
  activeAttempt;
  retainedAttempt;
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
    this.retainedAttempt = void 0;
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
   * Successful messages retain their transient rows until the owning Step ends;
   * interrupted messages, failed attempts, and abandonment retire them immediately.
   * @param frame - next Assistant stream frame received by the follow connection.
   * @returns a transient, publication, or rebaseline decision, or `undefined` when no entry becomes visible.
   */
  acceptFrame(frame) {
    switch (frame.type) {
      case "start":
        if (this.activeAttempt !== void 0 || this.retainedAttempt !== void 0 || this.pending.size > 0)
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
        if (entry.event.type === "assistant/message" && entry.event.data.interrupted !== true) {
          this.retainedAttempt = { attemptId: attempt.attemptId, turn: attempt.turn, step: attempt.step };
          return this.publish(entry);
        }
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
    const retained = this.retainedAttempt;
    if (retained !== void 0 && entry.event.type === "step/end" && entry.event.data.turn === retained.turn && entry.event.data.step === retained.step) {
      this.retainedAttempt = void 0;
      return { type: "publish", entry, retireAttemptId: retained.attemptId };
    }
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
var HISTORY_PAGE_OPTIONS = { maxMessages: 500, turnWindow: { minMessages: PAGE_MESSAGES, minTurns: 2 } };
var JUMP_PAGE_MESSAGES = 200;
var JUMP_PAGE_OPTIONS = {
  ...HISTORY_PAGE_OPTIONS,
  turnWindow: { ...HISTORY_PAGE_OPTIONS.turnWindow, minMessages: JUMP_PAGE_MESSAGES }
};
var Session = class {
  sessionId;
  remote;
  options;
  // ---- Window and derived state (all private; the snapshot is the only read API) ----
  baseSeq = SessionLogOffset(0);
  hasMore = false;
  historyWasPartial = false;
  openState = "cold";
  openError = null;
  openPromise = null;
  /** Bumped by stream replacement to invalidate an in-flight doOpen. Stale
   *  passes drop all writes once the generation moves on. */
  openGeneration = 0;
  get loadingOlder() {
    return this.historyLoadStatus === "loading";
  }
  historyLoadStatus = "idle";
  olderRequest = null;
  /** Shared low-water target of the running jump loop; null when no jump is paging. */
  /** Shared low-water target of the running jump loop; null when no jump is paging. */
  jumpTargetSeq = null;
  /** The running jump loop's completion, shared by retargeting callers. */
  jumpPromise = null;
  pendingHistory = null;
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
  /** New Session display state; unknown bare sessions begin conservatively blank. */
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
   * projections block and updated by Session Controller control frames;
   * Host-sequenced writes merge under higher-seq-wins and cached list blocks
   * yield to them (projection-store.ts). Keys are read via `projections.faceOf(key)`
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
    const placement = this.running ? input.mode === "steer" ? "steering" : "queued" : "transcript";
    this.pendingSubmissions = [...this.pendingSubmissions, {
      requestId,
      placement,
      time: Date.now(),
      text: input.text,
      attachments: input.attachments
    }];
    this.submissionSettlements.set(requestId, { placement, onRetire: input.onRetire, retiring: false });
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
        requestId: requestId ?? randomUUID(),
        childSessionId: this.address.childSessionId,
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
      this.notifier.markDirty();
    }
    this.options.onEngaged?.(this);
    return result;
  }
  /**
   * Resolve one image referenced by this session into browser-consumable bytes.
   * @param attachment - complete image reference found in the folded session log.
   * @returns the authenticated reference and decoded bytes.
   */
  async readAttachment(attachment) {
    const result = await this.remote.session.attachment({
      sessionId: this.sessionId,
      attachment
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
   * land in promptError. The subagent RPC authorizes the target child session.
   * @returns the cancel result.
   */
  async cancel() {
    const address = this.address;
    const result = address !== void 0 ? await this.remote.subagents.interruptByUser(address.childSessionId) : await this.remote.session.cancel({ sessionId: this.sessionId });
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
  /** @inheritdoc */
  async loadOlder(options) {
    const request = this.prepareOlder();
    await request?.promise;
    if (request !== null && this.olderRequest === request && (!options?.deferConsumption || request.page?.entries.length === 0))
      this.consumeOlder();
  }
  prepareOlder() {
    if (this.olderRequest !== null)
      return this.olderRequest;
    const events = this.events;
    if (this.openState !== "open" || !this.hasMore || this.loadingOlder || events === void 0)
      return null;
    const request = {
      generation: this.openGeneration,
      beforeSeq: this.baseSeq,
      page: null,
      invalidated: false,
      recovering: false,
      consuming: false
    };
    this.olderRequest = request;
    this.historyLoadStatus = "loading";
    this.notifier.markDirty();
    request.promise = (async () => {
      try {
        await events.prepend({ beforeSeq: request.beforeSeq, ...HISTORY_PAGE_OPTIONS });
        if (this.olderRequest !== request)
          return;
        if (request.invalidated || request.generation !== this.openGeneration || request.beforeSeq !== this.baseSeq)
          return;
        const page = request.page;
        const first = page?.entries[0];
        this.historyLoadStatus = page === null || (first === void 0 ? page.hasMore : first.event.seq >= request.beforeSeq) ? "error" : "pendingConsumption";
      } catch (error) {
        if (this.olderRequest !== request)
          return;
        request.page = null;
        this.historyLoadStatus = "error";
        if (!(0, import_client2.isRemoteFailure)(error))
          console.error("[session-controller] loadOlder failed:", error);
      } finally {
        if (this.olderRequest === request) {
          if (request.invalidated && this.events === events) {
            request.recovering = true;
            this.historyLoadStatus = "loading";
            events.restart();
          } else if (this.historyLoadStatus === "error")
            this.olderRequest = null;
          this.notifier.markDirty();
        }
      }
    })();
    return request;
  }
  /** @inheritdoc */
  consumeOlder() {
    const request = this.olderRequest;
    if (request === null || request.consuming || this.historyLoadStatus !== "pendingConsumption" || request.page === null)
      return false;
    if (this.openState !== "open" || request.invalidated || request.generation !== this.openGeneration || request.beforeSeq !== this.baseSeq) {
      this.clearOlderHistory();
      return false;
    }
    const page = request.page;
    request.consuming = true;
    try {
      this.prependWindow(page.entries, page.hasMore);
      return true;
    } catch (error) {
      if (this.olderRequest === request)
        this.historyLoadStatus = "error";
      throw error;
    } finally {
      if (this.olderRequest === request) {
        this.olderRequest = null;
        if (this.historyLoadStatus !== "error")
          this.historyLoadStatus = "idle";
      }
      this.notifier.markDirty();
    }
  }
  clearOlderHistory() {
    this.olderRequest = null;
    this.historyLoadStatus = this.pendingHistory === null ? "idle" : "loading";
    this.notifier.markDirty();
  }
  /** Jump loader: page backwards until the window covers seq (see ISession.loadThrough). */
  loadThrough(seq) {
    this.consumeOlder();
    if (this.olderRequest !== null)
      return Promise.resolve();
    if (this.openState !== "open" || !this.hasMore || this.baseSeq <= seq)
      return Promise.resolve();
    if (this.jumpPromise !== null) {
      this.jumpTargetSeq = SessionSeq(Math.min(this.jumpTargetSeq ?? seq, seq));
      return this.jumpPromise;
    }
    if (this.loadingOlder)
      return Promise.resolve();
    const events = this.events;
    if (events === void 0)
      return Promise.resolve();
    const pending = {
      beforeSeq: this.baseSeq,
      hasMore: this.hasMore,
      pages: []
    };
    this.pendingHistory = pending;
    this.jumpTargetSeq = seq;
    this.historyLoadStatus = "loading";
    this.notifier.markDirty();
    const generation = this.openGeneration;
    this.jumpPromise = (async () => {
      try {
        while (this.jumpTargetSeq !== null && pending.beforeSeq > this.jumpTargetSeq) {
          if (generation !== this.openGeneration)
            return;
          const before = pending.beforeSeq;
          await events.prepend({ beforeSeq: before, ...JUMP_PAGE_OPTIONS });
          if (generation !== this.openGeneration || this.pendingHistory !== pending)
            return;
          if (pending.beforeSeq >= before) {
            if (pending.hasMore)
              this.historyLoadStatus = "error";
            return;
          }
          if (!pending.hasMore)
            return;
        }
      } catch (error) {
        if (generation === this.openGeneration && this.pendingHistory === pending)
          this.historyLoadStatus = "error";
        if (!(0, import_client2.isRemoteFailure)(error)) {
          console.error("[session-controller] loadThrough failed:", error);
        }
      } finally {
        if (this.pendingHistory === pending) {
          this.jumpTargetSeq = null;
          this.jumpPromise = null;
          this.pendingHistory = null;
          if (this.historyLoadStatus === "loading")
            this.historyLoadStatus = "idle";
          if (generation === this.openGeneration && pending.pages.length > 0) {
            this.prependWindow(pending.pages.reverse().flat(), pending.hasMore);
          }
          this.notifier.markDirty();
        }
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
    this.clearOlderHistory();
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
    const same2 = this.address?.parentSessionId === address?.parentSessionId && this.address?.childSessionId === address?.childSessionId && this.address?.mode === address?.mode;
    this.address = address;
    this.parentAvailable = parentAvailable;
    if (!same2 && this.openState !== "cold")
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
   * Apply the Manager's effective display blank, further reconciled with the
   * current `sessionListMetadata` projection. Local send attempts and current
   * running state prevent re-blanking; an earlier false summary alone does not.
   * The Manager retains acceptance and earlier running observations across
   * Session-object replacement.
   * @param blank - New Session display state after Manager reconciliation.
   */
  handleBlank(blank) {
    blank = blank && this.projections.values().sessionListMetadata?.blank !== false;
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
    for (const [requestId, settlement] of [...this.submissionSettlements]) {
      if (settlement.admitted !== void 0)
        this.scheduleObservedRetirement(requestId, settlement.admitted);
      else
        this.retireFailedSubmission(requestId);
    }
    this.openGeneration++;
    this.clearOlderHistory();
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
      await events.open(HISTORY_PAGE_OPTIONS);
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
        if (this.olderRequest !== null) {
          this.olderRequest.page = { entries: change.entries, hasMore: change.hasMore };
        } else
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
    if (this.olderRequest !== null && this.loadingOlder && !this.olderRequest.recovering) {
      this.olderRequest.invalidated = true;
      this.olderRequest.page = null;
    } else
      this.clearOlderHistory();
    this.baseSeq = SessionLogOffset(entries[0]?.event.seq ?? 0);
    this.hasMore = hasMore;
    this.historyWasPartial ||= hasMore;
    if (this.pendingHistory !== null) {
      this.pendingHistory.beforeSeq = this.baseSeq;
      this.pendingHistory.hasMore = hasMore;
      this.pendingHistory.pages.length = 0;
    }
    if (visible.some((entry) => entry.event.type === "turn/start"))
      this.firstPromptPendingTurn = false;
    if (projections !== void 0)
      this.projections.seed(projections);
    this.eventSource.replace(visible, hasMore);
    if (projections !== void 0) {
      for (const [requestId, { receipt }] of this.submissionSettlements) {
        if (receipt !== void 0 && receipt.seq <= projections.asOfSeq) {
          this.scheduleObservedRetirement(requestId, receipt.attachments);
        }
      }
    }
    for (const entry of visible)
      this.observeSubmissionEvent(entry.event);
    if (projections !== void 0) {
      const inbox = projections.values.inbox;
      for (const target of ["next-turn", "next-step"]) {
        this.observeSubmissionInsertions(target, inbox?.[target] ?? [], 0, projections.asOfSeq);
      }
    }
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
    if (result?.type === "publish") {
      const changed = this.appendLive(result.entry);
      if (result.retireAttemptId !== void 0)
        this.eventSource.settleAssistant(result.retireAttemptId);
      if (changed || result.retireAttemptId !== void 0)
        this.notifier.markDirty();
    } else if (result?.type === "transient") {
      this.eventSource.append(result.entry);
      this.notifier.markDirty();
    }
  }
  /** Prepend one stream-validated history page. */
  prependWindow(entries, hasMore) {
    if (this.pendingHistory !== null) {
      const pending = this.pendingHistory;
      pending.beforeSeq = entries[0] === void 0 ? pending.beforeSeq : SessionLogOffset(entries[0].event.seq);
      pending.hasMore = hasMore;
      pending.pages.push(entries);
      return;
    }
    this.baseSeq = entries[0] === void 0 ? this.baseSeq : SessionLogOffset(entries[0].event.seq);
    this.hasMore = hasMore;
    this.historyWasPartial ||= hasMore;
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
      const { target, start, removedCount = 0, inserted, outcome } = event.data;
      for (const [requestId, settlement] of this.submissionSettlements) {
        const receipt = settlement.receipt;
        if (receipt?.target !== target || receipt.index === null || receipt.seq >= event.seq)
          continue;
        const removed = receipt.index >= start && receipt.index < start + removedCount;
        if (removed && outcome === "canceled")
          this.retireFailedSubmission(requestId);
        else
          settlement.receipt = {
            ...receipt,
            seq: event.seq,
            index: removed ? null : receipt.index < start ? receipt.index : receipt.index + inserted.length - removedCount
          };
      }
      this.observeSubmissionInsertions(target, inserted, start, event.seq);
      for (const message of inserted)
        this.observeSubmissionMessage(message, false);
      return;
    }
    if (event.type === "request/context" || event.type === "turn/end") {
      for (const [requestId, settlement] of this.submissionSettlements) {
        if (settlement.admitted === void 0 && settlement.receipt?.index === null && settlement.receipt.seq < event.seq)
          this.retireFailedSubmission(requestId);
      }
      return;
    }
    if (event.type === "user/message")
      this.observeSubmissionMessage(event.data, true);
  }
  observeSubmissionInsertions(target, messages, start, seq) {
    for (const [index, message] of messages.entries()) {
      const source = message.source;
      if (source.kind !== "user" || !("rpcId" in source))
        continue;
      const settlement = this.submissionSettlements.get(source.rpcId);
      if (settlement === void 0 || settlement.placement === "queued" || settlement.retiring || (settlement.receipt?.seq ?? -1) > seq)
        continue;
      settlement.receipt = { target, seq, index: start + index, attachments: attachmentRefsIn(message.content) };
    }
  }
  observeSubmissionMessage(message, admitted) {
    const source = message.source;
    if (source.kind !== "user" || !("rpcId" in source))
      return;
    const settlement = this.submissionSettlements.get(source.rpcId);
    if (settlement === void 0 || settlement.retiring)
      return;
    if (!admitted) {
      if (settlement.placement === "queued")
        this.scheduleObservedRetirement(source.rpcId, attachmentRefsIn(message.content));
      return;
    }
    settlement.admitted = attachmentRefsIn(message.content);
    this.retireAdmittedSubmission(source.rpcId);
  }
  /** Retire admitted Chat identities only after stale Inbox rows can no longer reappear. */
  retireAdmittedSubmission(requestId) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement?.admitted === void 0)
      return;
    const receipt = settlement.receipt;
    if (receipt?.index === null && (this.projections.seqOf("inbox") ?? -1) < receipt.seq)
      return;
    this.scheduleObservedRetirement(requestId, settlement.admitted);
  }
  /** Inbox acceptance retires queued echoes; its watermark completes admitted Chat handoffs. */
  observeSubmissionInbox() {
    if (this.submissionSettlements.size === 0)
      return;
    const inbox = this.projections.get("inbox");
    if (inbox === void 0)
      return;
    const seq = this.projections.seqOf("inbox");
    for (const target of ["next-turn", "next-step"]) {
      if (seq !== void 0)
        this.observeSubmissionInsertions(target, inbox[target], 0, seq);
      for (const message of inbox[target])
        this.observeSubmissionMessage(message, false);
    }
    for (const requestId of this.submissionSettlements.keys())
      this.retireAdmittedSubmission(requestId);
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
    if (settlement === void 0 || settlement.retiring || settlement.admitted !== void 0)
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
    this.clearOlderHistory();
    this.events = void 0;
    this.openPromise = null;
    this.openState = "error";
    this.openError = error;
    void events.dispose();
    this.notifier.markDirty();
  }
  buildSnapshot() {
    const identity3 = this.projections.values().subagent;
    return {
      sessionId: this.sessionId,
      pendingSubmissions: this.pendingSubmissions,
      running: this.running,
      subagent: this.address === void 0 ? null : {
        address: this.address.mode === "unknown" && identity3 != null ? { ...this.address, mode: identity3.mode } : this.address,
        ...this.parentAvailable === void 0 ? {} : { parentAvailable: this.parentAvailable }
      },
      removed: this.removed,
      openState: this.openState,
      openError: this.openError,
      hasMore: this.hasMore,
      historyWasPartial: this.historyWasPartial,
      loadingOlder: this.loadingOlder,
      historyLoadStatus: this.historyLoadStatus,
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
var SessionManager = class {
  remote;
  sessions = /* @__PURE__ */ new Map();
  /** In-flight Session disposals remain here after instances leave `sessions`, so manager disposal can await quiescence. */
  sessionDisposals = /* @__PURE__ */ new Set();
  /**
   * Accepted/running presentation must survive a later empty-history list
   * response. Host-asserted running is recorded even before a row, instance, or
   * address holds the identity — the listing that would hold it may not have
   * landed yet — while the client-local acceptance callback requires a current
   * holder, because it can arrive from a replaced or already-dropped Session.
   */
  engagedSessions = /* @__PURE__ */ new Set();
  disposed = false;
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
  projectionLoads = /* @__PURE__ */ new Map();
  projectionInflight = /* @__PURE__ */ new Map();
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
    const id2 = typeof target === "string" ? target : target.childSessionId;
    const address = typeof target === "string" ? this.subagentAddress(id2) : target;
    if (typeof target === "string" && !this.sessions.has(id2) && !this.summaries.some((summary) => summary.sessionId === id2) && address === void 0) {
      throw new Error(`sessions.retain: unknown session ${id2}`);
    }
    if (address !== void 0)
      this.addresses.set(id2, address);
    this.sessions.get(id2)?.configureSubagent(address, address === void 0 ? void 0 : this.agentAvailable(address.parentSessionId));
    return id2;
  }
  /**
   * Resolve an address for breadcrumb navigation without retaining transport authority.
   * @param sessionId - possible child id in an already-loaded catalog.
   * @returns A retained or catalog-derived direct-parent address.
   */
  subagentAddress(sessionId) {
    const retained = this.addresses.get(sessionId);
    if (retained !== void 0)
      return retained;
    for (const parentSessionId of this.projectionStores.keys()) {
      const child = this.projectionStores.get(parentSessionId)?.values().subagentCatalog?.find((entry) => entry.id === sessionId);
      if (child !== void 0 && child.mode !== "external") {
        return {
          parentSessionId,
          childSessionId: sessionId,
          mode: child.mode
        };
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
    this.pruneEngagement(sessionId, this.retainedIds(this.summaries));
    return this.startSessionDisposal(session);
  }
  /**
   * Stop catalog requests and dispose every resident Session.
   * @returns once catalog requests and every Session stream have stopped.
   */
  async dispose() {
    this.disposed = true;
    this.listMutations = null;
    this.listInflight = null;
    this.engagedSessions.clear();
    const reads = [...this.projectionInflight.values()];
    for (const { controller } of reads)
      controller.abort();
    this.projectionInflight.clear();
    await Promise.all(reads.map((read) => read.promise));
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
   * New instances reconcile retained metadata before returning.
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
        session.handleBlank(this.effectiveBlank(summary));
        session.handleRunning(summary.running);
      } else {
        const address = this.addresses.get(sessionId);
        const child = address === void 0 ? void 0 : this.projectionStores.get(address.parentSessionId)?.values().subagentCatalog?.find((entry) => entry.id === sessionId);
        if (child !== void 0) {
          session.handleBlank(false);
          session.handleRunning(false);
        } else {
          session.handleBlank(true);
        }
      }
    }
    return session;
  }
  createSession(sessionId) {
    const address = this.addresses.get(sessionId);
    const parentAvailable = address === void 0 ? void 0 : this.agentAvailable(address.parentSessionId);
    return new Session(sessionId, this.remote, {
      ...address === void 0 ? {} : {
        address,
        ...parentAvailable === void 0 ? {} : { parentAvailable }
      },
      // The sender's local first-send flip mirrors into the list row so the
      // session surfaces (lists filter on blank) before any host frame lands.
      onEngaged: (engaged) => {
        if (this.disposed || !this.retainedIds(this.summaries).has(engaged.sessionId))
          return;
        if (!this.engagedSessions.has(engaged.sessionId)) {
          this.engagedSessions.add(engaged.sessionId);
          this.recordMutation({ kind: "engaged", sessionId: engaged.sessionId });
        }
        this.sessions.get(engaged.sessionId)?.handleBlank(false);
      },
      projections: this.projectionStore(sessionId)
    });
  }
  effectiveBlank(summary) {
    return summary.blank && !this.engagedSessions.has(summary.sessionId);
  }
  /**
   * Identities an engagement may still belong to: the given list rows, resident
   * Session instances, and retained child addresses.
   * @param summaries - list rows of the caller's snapshot.
   * @returns the retained identity set.
   */
  retainedIds(summaries) {
    const retained = new Set(summaries.map((summary) => summary.sessionId));
    for (const sessionId of this.sessions.keys())
      retained.add(sessionId);
    for (const sessionId of this.addresses.keys())
      retained.add(sessionId);
    return retained;
  }
  /**
   * Forget one engagement that no retained identity holds.
   * @param sessionId - identity whose engagement may be dropped.
   * @param retained - identities from {@link retainedIds} for the caller's snapshot.
   */
  pruneEngagement(sessionId, retained) {
    if (!retained.has(sessionId))
      this.engagedSessions.delete(sessionId);
  }
  /** Resident per-session projection store (create-on-demand; outlives instantiation). */
  projectionStore(sessionId) {
    let store = this.projectionStores.get(sessionId);
    if (store === void 0) {
      store = new ProjectionValueStore();
      const projections = store;
      store.subscribeAny(() => {
        if (projections.values().sessionListMetadata?.blank === false) {
          this.sessions.get(sessionId)?.handleBlank(false);
        }
        this.notifier.markDirty();
      });
      this.projectionStores.set(sessionId, store);
    }
    return store;
  }
  /**
   * Load a complete projection baseline once per connection; retry unsuccessful reads.
   * @param sessionId - Session to inspect without opening its conversation.
   * @returns completion of the current or newly started read.
   */
  refreshProjections(sessionId) {
    const existing = this.projectionInflight.get(sessionId);
    if (existing !== void 0)
      return existing.promise;
    if (this.projectionLoads.get(sessionId)?.state === "ready")
      return Promise.resolve();
    const controller = new AbortController();
    const store = this.projectionStore(sessionId);
    const initialValues = store.values();
    this.projectionLoads.set(sessionId, { state: "loading", error: null });
    this.notifier.markDirty();
    const operation = (async () => {
      try {
        const result = await this.remote.session.projections({ sessionId }, controller.signal);
        if (controller.signal.aborted)
          return;
        if (result.ok) {
          const value = result.value;
          if (value?.kind === "sequenced") {
            store.seed({ values: value.values, asOfSeq: sessionSeqCursor(value.asOfSeq) });
          } else if (value?.kind === "migration-required") {
            store.applyCached(value.values);
          } else if (store.values() === initialValues) {
            store.clear();
          }
          this.projectionLoads.set(sessionId, {
            state: value?.kind === "migration-required" ? "migration-required" : "ready",
            error: null
          });
        } else {
          this.projectionLoads.set(sessionId, { state: "error", error: result.error });
        }
      } catch (error) {
        if (controller.signal.aborted)
          return;
        if (!(0, import_client3.isRemoteFailure)(error))
          throw error;
        this.projectionLoads.set(sessionId, { state: "error", error });
      } finally {
        if (!controller.signal.aborted) {
          this.projectionInflight.delete(sessionId);
          this.notifier.markDirty();
        }
      }
    })();
    this.projectionInflight.set(sessionId, { promise: operation, controller });
    return operation;
  }
  agentAvailable(sessionId) {
    return this.summaries.find((summary) => summary.sessionId === sessionId)?.agentAvailable ?? (this.listPhase === "ready" ? false : void 0);
  }
  updateParentAvailability() {
    for (const [childId, address] of this.addresses) {
      const available = this.agentAvailable(address.parentSessionId);
      if (available !== void 0)
        this.sessions.get(childId)?.handleSubagentParentAvailable(available);
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
          const removedSincePull = /* @__PURE__ */ new Set();
          for (const mutation of mutations) {
            if (mutation.kind === "remove")
              removedSincePull.add(mutation.sessionId);
          }
          for (const s of baseline) {
            if (s.running && !removedSincePull.has(s.sessionId))
              this.engagedSessions.add(s.sessionId);
          }
          const summaries = mutations.reduce(applyMutation, baseline);
          this.summaries = summaries;
          const retained = this.retainedIds(summaries);
          for (const sessionId of this.engagedSessions)
            this.pruneEngagement(sessionId, retained);
          this.listState = "idle";
          this.listPhase = "ready";
          this.updateParentAvailability();
          for (const s of this.summaries) {
            const session = this.sessions.get(s.sessionId);
            if (session === void 0)
              continue;
            session.handleBlank(this.effectiveBlank(s));
            session.handleRunning(s.running);
          }
          for (const s of result.value.items) {
            if (s.projections !== void 0)
              this.applyListBlock(s.sessionId, s.projections);
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
      this.recordMutation({ kind: "placeholder", summary: {
        agentAvailable: true,
        sessionId: result.value.sessionId,
        updatedAt: Date.now(),
        running: false,
        blank: true,
        ...opts.cwd !== void 0 ? { cwd: opts.cwd } : {}
      } });
    } else {
      const publishedSessionId = workspaceAttachSessionId(result.error);
      if (publishedSessionId !== void 0) {
        this.recordMutation({ kind: "placeholder", summary: {
          agentAvailable: true,
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
   * immediately (same synchronous-addressability guarantee as create).
   * Blankness starts provisionally true so the authoritative Host summary can
   * preserve it or lower it after an exact cut before the first `turn/start`;
   * lineage rides parentSessionId. A child published before Workspace
   * attachment fails is also reconciled into the list.
   * @param opts - source session and the optional exact inclusive boundary seq.
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
      this.recordMutation({ kind: "placeholder", summary: {
        agentAvailable: true,
        sessionId: childId,
        updatedAt: Date.now(),
        running: false,
        blank: true,
        parentSessionId: opts.sessionId,
        ...source?.cwd !== void 0 ? { cwd: source.cwd } : {}
      } });
    }
    return result;
  }
  /**
   * Rename a Session and update its title projection without opening its history.
   * @param sessionId - Session to rename.
   * @param title - raw title text for Host normalization.
   * @returns the accepted title and event position, or the Remote failure.
   */
  async rename(sessionId, title) {
    const result = await this.remote.session.rename({ sessionId, title });
    if (result.ok) {
      this.projectionStore(sessionId).apply("title", result.value.title, SessionSeq(result.value.seq));
    }
    return result;
  }
  /**
   * Merge a Host summary, replacing live state and filling missing metadata.
   * Local create/fork placeholders only fill metadata on an existing row.
   */
  mergeSummary(summary) {
    this.recordMutation({ kind: "upsert", summary });
    this.updateParentAvailability();
  }
  /** Apply immediately and retain for replay when a list response is in flight. */
  recordMutation(mutation) {
    if (this.disposed)
      return;
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
    const store = this.projectionStore(frame.sessionId);
    const seq = SessionSeq(frame.seq);
    for (const change of frame.changes)
      store.apply(change.key, change.val, seq);
    this.notifier.markDirty();
  }
  replaceControlBaseline(baseline) {
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
    if (!this.disposed && summary.running)
      this.engagedSessions.add(summary.sessionId);
    this.sessions.get(summary.sessionId)?.handleBlank(this.effectiveBlank(summary));
    if (summary.projections !== void 0)
      this.applyListBlock(summary.sessionId, summary.projections);
  }
  /**
   * Merge one list-surface projection block by the sequence space it declares.
   * A `sequenced` block came from the Host's live registry for an attached
   * Session, so each key lands under higher-seq-wins against that Session's
   * baselines and frames. A `cached` block was viewed from the persisted
   * checkpoint by a header-only listing: its watermark is not comparable with
   * this connection's seqs, so it only fills keys no sequenced row holds.
   */
  applyListBlock(sessionId, block) {
    const store = this.projectionStore(sessionId);
    switch (block.kind) {
      case "sequenced": {
        const seq = sessionSeqCursor(block.asOfSeq);
        for (const [key, value] of Object.entries(block.values))
          store.apply(key, value, seq);
        return;
      }
      case "cached":
        store.applyCached(block.values);
        return;
      default:
        assertNever(block.kind, "session list projection block kind");
    }
  }
  /**
   * Apply one Session removal forwarded through `ctx.remote.$on`.
   * @param sessionId - removed Session identity.
   */
  handleSessionRemoved(sessionId) {
    const durableSubagent = this.subagentAddress(sessionId) !== void 0 || this.summaries.some((summary) => summary.sessionId === sessionId && summary.origin === "subagent");
    this.recordMutation(durableSubagent ? { kind: "status", sessionId, running: false, agentAvailable: false } : { kind: "remove", sessionId });
    if (durableSubagent)
      this.sessions.get(sessionId)?.handleRunning(false);
    else
      this.sessions.get(sessionId)?.handleRemoved();
    const catalog = this.projectionStores.get(sessionId)?.values().subagentCatalog;
    if (!durableSubagent && (catalog === void 0 || catalog.length === 0)) {
      this.projectionStores.delete(sessionId);
    }
    this.pruneEngagement(sessionId, this.retainedIds(this.summaries));
    this.projectionInflight.get(sessionId)?.controller.abort();
    this.projectionInflight.delete(sessionId);
    this.projectionLoads.delete(sessionId);
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
    if (!this.disposed && running)
      this.engagedSessions.add(sessionId);
    this.recordMutation({ kind: "status", sessionId, running, agentAvailable: true });
    this.updateParentAvailability();
    this.sessions.get(sessionId)?.handleRunning(running);
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
    const parents = new Set(this.projectionLoads.keys());
    for (const id2 of this.sessions.keys()) {
      const address = this.addresses.get(id2);
      if (address !== void 0)
        parents.add(address.parentSessionId);
    }
    for (const { controller } of this.projectionInflight.values())
      controller.abort();
    this.projectionInflight.clear();
    this.projectionLoads.clear();
    for (const parentSessionId of parents)
      void this.refreshProjections(parentSessionId);
  }
  buildListSnapshot() {
    const merged = this.summaries.map((summary) => {
      const projectionStore = this.projectionStores.get(summary.sessionId);
      const title = projectionStore?.get("title");
      const projectionValues = projectionStore?.values();
      const metadata = projectionValues?.sessionListMetadata;
      return {
        ...summary,
        // Cached list hints can precede a history opening or control update.
        blank: this.effectiveBlank(summary) && metadata?.blank !== false,
        updatedAt: Math.max(summary.updatedAt, metadata?.lastPromptAt ?? 0),
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
    for (const id2 of this.entryCache.keys()) {
      if (!itemIds.has(id2))
        this.entryCache.delete(id2);
    }
    const sameOrder = items.length === this.itemsCache.length && items.every((e, i) => e === this.itemsCache[i]);
    if (!sameOrder)
      this.itemsCache = items;
    return {
      items: this.itemsCache,
      state: this.listState,
      phase: this.listPhase,
      error: this.listError,
      projectionsBySession: Object.fromEntries([...this.projectionStores].map(([sessionId, store]) => [
        sessionId,
        { values: store.values(), state: "idle", error: null, ...this.projectionLoads.get(sessionId) }
      ]))
    };
  }
};
function applyMutation(summaries, mutation) {
  switch (mutation.kind) {
    case "upsert":
    case "placeholder": {
      const existing = summaries.find((summary) => summary.sessionId === mutation.summary.sessionId);
      if (existing === void 0)
        return [mutation.summary, ...summaries];
      const filled = {
        ...existing,
        // Blank only lowers: a stale true (session-added racing the local
        // first send) never re-hides an already-surfaced session.
        blank: existing.blank && mutation.summary.blank,
        ...mutation.kind === "upsert" ? {
          agentAvailable: mutation.summary.agentAvailable,
          running: mutation.summary.running
        } : {},
        ...existing.cwd === void 0 && mutation.summary.cwd !== void 0 ? { cwd: mutation.summary.cwd } : {},
        ...existing.parentSessionId === void 0 && mutation.summary.parentSessionId !== void 0 ? { parentSessionId: mutation.summary.parentSessionId } : {},
        ...existing.origin === void 0 && mutation.summary.origin !== void 0 ? { origin: mutation.summary.origin } : {}
      };
      if (filled.cwd === existing.cwd && filled.parentSessionId === existing.parentSessionId && filled.origin === existing.origin && filled.blank === existing.blank && filled.agentAvailable === existing.agentAvailable && filled.running === existing.running)
        return [...summaries];
      return summaries.map((summary) => summary.sessionId === mutation.summary.sessionId ? filled : summary);
    }
    case "remove":
      return summaries.filter((summary) => summary.sessionId !== mutation.sessionId);
    case "status":
      return summaries.map((summary) => summary.sessionId === mutation.sessionId && (summary.running !== mutation.running || summary.agentAvailable !== mutation.agentAvailable || mutation.running && summary.blank) ? { ...summary, running: mutation.running, agentAvailable: mutation.agentAvailable, blank: summary.blank && !mutation.running } : summary);
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
function displayTitleOf(title, cwd, id2) {
  if (title !== void 0)
    return title;
  if (cwd !== void 0 && cwd !== "") {
    const base = workspaceTitleOf(cwd);
    if (base !== "")
      return base;
  }
  return id2;
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
  constructor(sessionId, record2, releaseReference) {
    this.sessionId = sessionId;
    this.record = record2;
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
      projectionsBySession: {}
    });
    const disposeManagerProjection = this.manager.subscribe(() => {
      this.projectList();
    });
    rootCtx.effect(() => async () => {
      this.closed = true;
      disposeManagerProjection();
      const scopes = [...this.scopes];
      this.scopes.clear();
      for (const [, record2] of scopes) {
        record2.live = false;
        record2.session.unbindScope();
      }
      const managerDisposal = this.manager.dispose();
      for (const [id2, record2] of scopes) {
        this.startScopeDrop(id2, record2);
        this.publishRetention(id2);
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
    const id2 = this.manager.resolveTarget(target);
    const reference = this.retainScope(id2, source);
    try {
      reference.attachOpening(this.manager.get(id2).open(), signal);
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
  retainInfo(id2) {
    let observer = this.retainObservers.get(id2);
    if (observer === void 0) {
      const listeners = /* @__PURE__ */ new Set();
      observer = {
        listeners,
        published: this.retentionSnapshot(id2),
        source: {
          getSnapshot: () => this.retentionSnapshot(id2),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          }
        }
      };
      this.retainObservers.set(id2, observer);
    }
    return observer.source;
  }
  /**
   * Resolve an already discovered direct-parent address without opening it.
   * Feature plugins use this to avoid Agent-bound RPCs in persisted child views.
   * @param id - possible addressed child id.
   * @returns A retained or loaded-catalog address, without retaining a new selection or scope.
   */
  subagentAddress(id2) {
    return this.manager.subagentAddress(id2);
  }
  /**
   * Load all Session projections once per connection; retry an unsuccessful initial read.
   * @param sessionId - Session to inspect without opening its conversation.
   */
  refreshProjections(sessionId) {
    return this.manager.refreshProjections(sessionId);
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
   * Fork a session from an exact inclusive prefix of the source (same
   * synchronous-addressability guarantee as {@link ClientSessions.create}:
   * on resolution the child is catalogued and may be explicitly retained).
   * @param opts - source session id, the optional exact inclusive boundary
   *   seq (a real event seq the caller already knows; a cut inside an open
   *   turn is balanced Host-side with synthetic closers, and omission selects
   *   the latest completed-turn prefix), and whether to increment an
   *   inherited durable title before resolving.
   * @returns the child session id.
   * @throws {SessionForkError} with the source id.
   * @throws {Error} when a requested child-title rename fails after creation.
   */
  async fork(opts) {
    const sourceTitle = opts.increaseTitle ? this.list.getSnapshot().byId[opts.sessionId]?.title : void 0;
    const result = await this.manager.fork({
      sessionId: opts.sessionId,
      ...opts.atSeq === void 0 ? {} : { atSeq: SessionSeq(opts.atSeq) }
    });
    if (!result.ok)
      throw new SessionForkError(result.error, opts.sessionId);
    this.projectList();
    const childId = result.value.sessionId;
    if (sourceTitle !== void 0) {
      const renamed = await this.manager.rename(childId, increasedForkTitle(sourceTitle));
      if (!renamed.ok)
        throw new Error(`fork child rename failed: ${renamed.error.code}: ${renamed.error.message}`);
    }
    return childId;
  }
  /**
   * Borrow an already-retained Agent-scoped Context.
   * @param id - session id (the agent identity — 1:1 same axis).
   * @returns the scoped Context, or undefined without a retained generation.
   */
  scope(id2) {
    return this.scopes.get(id2)?.ctx;
  }
  /**
   * Retain a validated Gateway identity synchronously, without history or catalog I/O.
   * @param id - Host-projected Session identity, possibly not yet catalogued.
   * @returns a Gateway-source reference owned by the invocation.
   */
  retainAgentScope(id2) {
    if (this.closed)
      throw new Error("Session Controller is disposed");
    return this.retainScope(id2, "gateway");
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
    const id2 = scopeOf(ctx);
    if (id2 === void 0)
      return void 0;
    const record2 = this.scopes.get(id2);
    return record2 !== void 0 && scopeIdentityOf(record2.ctx) === scopeIdentityOf(ctx) ? record2.binding.session : void 0;
  }
  /**
   * Borrow an already-retained binding without extending its lifetime.
   * @param id - Session identity.
   * @returns the live binding, or undefined without a retained generation.
   */
  binding(id2) {
    return this.scopes.get(id2)?.binding;
  }
  retainScope(id2, source) {
    const record2 = this.scopes.get(id2) ?? this.materializeScope(id2);
    const previous = record2.retention;
    record2.retention = Object.freeze({
      referenceCount: previous.referenceCount + 1,
      retainedBy: freezeRetainedBy({ ...previous.retainedBy, [source]: (previous.retainedBy[source] ?? 0) + 1 })
    });
    const reference = new ClientSessionReference(id2, record2, () => {
      if (!record2.live)
        return;
      const count2 = record2.retention.referenceCount - 1;
      const { [source]: sourceCount = 0, ...otherSources } = record2.retention.retainedBy;
      const retainedBy = sourceCount > 1 ? { ...otherSources, [source]: sourceCount - 1 } : otherSources;
      record2.retention = count2 === 0 ? EMPTY_RETAIN_INFO : Object.freeze({ referenceCount: count2, retainedBy: freezeRetainedBy(retainedBy) });
      if (count2 === 0)
        this.retireScope(id2, record2);
      else
        this.publishRetention(id2);
    });
    if (this.list.getSnapshot().byId[id2] === void 0 && this.manager.subagentAddress(id2) !== void 0) {
      this.projectList();
    }
    this.publishRetention(id2);
    return reference;
  }
  retentionSnapshot(id2) {
    return this.scopes.get(id2)?.retention ?? EMPTY_RETAIN_INFO;
  }
  publishRetention(id2) {
    const state = this.list.getSnapshot();
    const row = state.byId[id2];
    const retainedBy = this.retentionSnapshot(id2).retainedBy;
    if (row !== void 0 && row.retainedBy !== retainedBy) {
      this.list.set({ ...state, byId: { ...state.byId, [id2]: { ...row, retainedBy } } });
    }
    const observer = this.retainObservers.get(id2);
    const snapshot = this.retentionSnapshot(id2);
    if (observer === void 0 || observer.published === snapshot)
      return;
    observer.published = snapshot;
    (0, import_dsh_client_store3.notifySubscribers)(observer.listeners, "[session-controller] reference sources");
  }
  retireScope(id2, record2, disposeFiber = true) {
    if (!record2.live)
      return;
    record2.live = false;
    if (this.scopes.get(id2) === record2)
      this.scopes.delete(id2);
    record2.session.unbindScope();
    const sessionDisposal = this.manager.drop(id2, record2.session);
    this.projectList();
    this.publishRetention(id2);
    this.startScopeDrop(id2, record2, disposeFiber, sessionDisposal);
  }
  /** Materialize one scope after its caller establishes that the id may be addressed. */
  materializeScope(id2) {
    const { fiber, ctx } = createScope(this.rootCtx, id2);
    const session = this.manager.get(id2);
    session.bindScope(ctx);
    const binding = { sessionId: id2, session, eventSource: session.eventSource, ctx };
    const record2 = {
      fiber,
      ctx,
      binding,
      session,
      retention: EMPTY_RETAIN_INFO,
      live: true
    };
    this.scopes.set(id2, record2);
    ctx.effect(() => () => {
      this.retireScope(id2, record2, false);
    }, "session-controller: exact generation");
    return record2;
  }
  /** Project the manager's list snapshot into the store (title derivation is display-only). */
  projectList() {
    const previousById = this.list.getSnapshot().byId;
    const { items, phase, projectionsBySession } = this.manager.getListSnapshot();
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
    for (const [parentId, projection] of Object.entries(projectionsBySession)) {
      for (const child of projection.values.subagentCatalog ?? []) {
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
            running: this.scopes.get(childId)?.session.getSnapshot().running ?? false,
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
    for (const [id2, record2] of this.scopes) {
      if (byId[id2] !== void 0)
        continue;
      const address = this.manager.subagentAddress(id2);
      if (address === void 0)
        continue;
      const previous = previousById[id2];
      const snapshot = record2.session.getSnapshot();
      const projectionValues = this.manager.projectionValues(id2);
      const projectedTitle = projectionValues?.title;
      const title = typeof projectedTitle === "string" && projectedTitle !== "" ? projectedTitle : previous?.title;
      byId[id2] = {
        ...previous ?? { id: id2, displayTitle: id2, updatedAt: 0 },
        running: snapshot.running,
        retainedBy: record2.retention.retainedBy,
        blank: snapshot.blank,
        parentId: address.parentSessionId,
        origin: "subagent",
        ...projectionValues === void 0 ? {} : { projectionValues },
        ...title === void 0 ? {} : { title, displayTitle: title }
      };
    }
    this.list.set({ ids, byId, phase, projectionsBySession });
  }
  startScopeDrop(id2, record2, disposeFiber = true, sessionDisposal = this.manager.drop(id2, record2.session)) {
    const drop = this.dropScope(record2, disposeFiber, sessionDisposal);
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
  async dropScope(record2, disposeFiber, sessionDisposal) {
    await Promise.allSettled([sessionDisposal, ...disposeFiber ? [record2.fiber.dispose()] : []]);
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
