# dsh-debug 1.8.0

Python 3.14 stdlib CLI for the current 0.3 development line, targeting the fixed
DSH 0.1.7-rc.2 REST + Connection RPC contract. `alpha3` is this repository's
source-tree label, not a Harness version; the credential adapter retains the
documented legacy `.credentials.yaml` / `~/.dsh` fallback layout.
Install with PowerShell `-File install.ps1` beside this file.
This copies a durable command into `~/.local/bin`, adds it to the user PATH and
keeps its worker in `~/.dsh-debug/lib`. Re-run after source changes.

The SSH worker source and request travel over stdin; the command line stays
short on Windows even as the worker grows. Workspace uploads unwrap the native
workspace baseline and open every registered path component without following
symlinks. Existing directory permissions are reported without changing owners.

`dsh-debug --help` describes all commands. JSON is the default; `--json` is
accepted before the command. No dependency installation or DSH restart needed.

## Connection

`dsh-debug init --ssh-host user@server --ssh-key C:/path/key.pem`

`dsh-debug init --ssh-host user@server --ssh-key C:/path/key.pem --ssh-port 2222`

`dsh-debug init --target local --port 51080 --dsh-home D:/home --harness-root D:/harness`

`dsh-debug init --target local --host 192.168.0.20 --scheme https --port 3081 --cookie-file C:/secrets/dsh-cookie.txt`

Configuration is `~/.dsh-debug/config.json`, overridden by `DSH_DEBUG_SSH_HOST`,
`DSH_DEBUG_SSH_KEY`, `DSH_DEBUG_SSH_PORT`, `DSH_DEBUG_TARGET`, `DSH_DEBUG_HOST`,
`DSH_DEBUG_SCHEME`, `DSH_DEBUG_COOKIE_FILE`, `DSH_DEBUG_COOKIE`, `DSH_DEBUG_PORT`,
`DSH_DEBUG_REMOTE_PYTHON`, `DSH_DEBUG_SERVICE`, `DSH_DEBUG_DSH_HOME`,
`DSH_DEBUG_HARNESS_ROOT`. The key file and any cookie file are referenced, not
copied, and the config stores no credential value. SSH verifies the existing
known_hosts entry; it never accepts a changed host key automatically. Run
`dsh-debug doctor` first; it reports the selected target, endpoint and
credential source.

`target` selects where the worker runs: `ssh` (default) keeps the remote
contract below, and `local` runs that same single-file worker inside the CLI
process against a directly reachable `--host:--port` (default `127.0.0.1` with
`--scheme http`; a bare IPv6 host must be bracketed, for example `[::1]`). A
loopback host keeps the native credential adapter of that machine; a
non-loopback host must carry an operator cookie, because the CLI cannot read
that host's `DSH_HOME` - configure `--cookie-file` at init (a file whose first
line is a `Cookie:` header or bare `name=value`), or set `DSH_DEBUG_COOKIE` for
one run. The value is used only for the request and is never printed, copied or
written to the config. Local targets need no SSH key, no known_hosts entry and
no server-side Python; the same command surface, `/api/` allowlist, deadline,
response cap, redaction and no-auto-retry rules apply. A local config needs
`port`, and `dsh_home` plus `harness_root` for the loopback credential adapter.
`{"local": true}` is still accepted as an alias for `{"target": "local"}`.
`upload-card` and `upload` remain refused on a non-loopback endpoint
(`upload-requires-ssh`). Use SSH so the existing credential adapter runs at
the target host. `upload-card --import` now uses official raw HTTP upload;
the general `upload` command still stages through the Linux service worker.

An ephemeral Python process runs through SSH, exchanges the current native
launch token when logged, or signs a 60-second loopback-only native browser
cookie from the existing server credential. That fallback is tied to native
browser-session grant v1 and fails on unsupported formats. Tokens, cookies and
the signing secret stay on the server. No authentication configuration changes,
new HTTP routes, service restart, installed remote daemon or extra public port.
Set `--dsh-home` and `--harness-root` during init for a non-default installation.
The adapter reads `.credentials.yaml` under the configured remote DSH_HOME
(falling back to the remote environment or `~/.dsh`) and uses Node/yaml under
the explicitly configured Harness root. It does not guess a server install path.
A loopback `local` target uses the same credential adapter and the same
60-second loopback cookie, passed as `Cookie:` instead of exchanged over SSH;
it signs with the local DSH_HOME and never prints, copies or rewrites that
secret. A non-loopback `local` target instead sends the operator-supplied
cookie and never touches any DSH_HOME.

## Workflows

```powershell
dsh-debug workspaces
dsh-debug workspace-create --path /srv/roleplay
dsh-debug create --workspace-id workspace-ID
dsh-debug create --workspace-path /srv/roleplay
dsh-debug create --cwd /srv/roleplay
dsh-debug settings --session session-ID
dsh-debug settings-set --session session-ID --target-context-tokens 0 --context-window-tokens 240000 --dry-run
dsh-debug sessions --limit 10
dsh-debug resolve --query session-b719
dsh-debug conversations
dsh-debug state --session session-ID
dsh-debug activity --session session-ID
dsh-debug models --session session-ID
dsh-debug history --session session-ID --through-seq 10000 --limit 10
dsh-debug send --session session-ID --text-file player.txt --dry-run
dsh-debug send --session session-ID --text-file player.txt --request-id unique-id
dsh-debug regenerate --session session-ID --user-seq 123 --dry-run
dsh-debug edit-send --session session-ID --user-seq 123 --text-file edited.txt
dsh-debug userinfo
dsh-debug persona-set --body-file persona.json --dry-run
dsh-debug edit-message --session session-ID --role assistant --message-id assistant-ID --text-file edited.txt
dsh-debug edit-message --session session-ID --role user --seq 123 --text-file edited.txt
dsh-debug delete-message --session session-ID --message-id assistant-ID --dry-run
dsh-debug delete-user --session session-ID --message-id assistant-ID --dry-run
dsh-debug upload-card --session session-ID --file card.json --dry-run
dsh-debug upload-card --session session-ID --file card.json --import --request-id card-import-1
dsh-debug upload-card --session session-ID --import --resume
dsh-debug upload-card --session session-ID --import --resume --end
dsh-debug upload --session session-ID --file original.txt --dir .dsh-uploads --dry-run
dsh-debug upload --session session-ID --file original.txt --dir .dsh-uploads
dsh-debug clone --session session-ID --at-seq 456 --dry-run
dsh-debug model-set --session session-ID --body-file policy.json --dry-run
dsh-debug model-route --session session-ID --purpose status --provider qwen --model qwen3.8-flash --effort low --dry-run
dsh-debug worldline --session session-ID --action operation-status --operation-id operation-ID
dsh-debug jobs --session session-ID
dsh-debug export --session session-ID --kind card-export --dry-run
dsh-debug export --session session-ID --kind novel-export --mode original --dry-run
dsh-debug export --session session-ID --kind card-export --mode organized --dry-run
dsh-debug resources --session session-ID
dsh-debug download --session session-ID --resource-id resource-ID --out book.md
dsh-debug request /api/roleplay/state?sessionId=session-ID
```

`export` defaults to `--mode original`: `card-export` preserves the complete
current card as NextTavern JSON, and `novel-export` preserves the selected
worldline's prose as Markdown. Novel export is deterministic; card export uses
zero model requests when the current native structure and classification are
valid, but may require semantic classification otherwise. Use
`--mode organized` only when explicitly requesting semantic reorganization:
it uses the existing model workflow to organize card Markdown or novel chapters.
The selected mode is included in the jobs POST and in `--dry-run` output.

`sessions` and `resolve` use native session metadata, projected on-server before
SSH transfer: only IDs, title/preset/model, status, workspace and parent fields.
Match titles or ID prefixes with `--query`; `--cursor` and `--limit` bound output.
`sessions --source catalog` explicitly reads only registered Tavern families.
Native full-text content search is disabled (`openAt: never`); title lookup does
not require it. A measured native list was 8,990,755 bytes for 253 sessions,
mostly context headers/timelines. The initial CLI timed out transferring that
full body, although the API had already replied. The CLI now projects and pages
before transfer; it does not modify the native server's list or browser payload.
`workspaces` reads the first complete baseline from native `workspace/follow`.
`workspace-create` calls native `workspace/create({path})` and adopts an
existing directory idempotently. `create --workspace-id` binds a new session
with native `session/create({workspaceId,agentPreset})`; `create --workspace-path`
adopts/resolves the directory first and then binds to its returned ID. The
legacy `--cwd` path creates an ungrouped session. Unknown IDs preserve the
native `workspace/not-found` code/details, and existing sessions are never
moved.
`settings` reads the exact Session's global/session/effective memory settings
through `/api/roleplay/memory-settings`. `settings-set` writes only supplied
fields to the selected `--scope` with that scope's revision; `0` restores
inheritance. Window/tail values are `0` or at least `1000`; target/archive are
nonnegative and `autoNotesEveryTurns` is `0` or at least `1`. No model request
is added.

Model policy body is `{ "scope":"session", "settings":{...},
"expectedRevision": 1 }`, using the revision returned by `models`.
Set `settings:null` to clear the session override. Global scope is explicit.
`model-route` reads the current policy, preserves `allMain` and every other
route, replaces only the selected `status`, `decision`, or `memory` route, and
writes with the revision it just read. Its default scope is `session`; use
`--scope global` explicitly for global policy. The backend remains responsible
for validating provider/model/effort capability (for example Qwen low/medium).

Regeneration/edit-send mirrors existing UI prepare → create-worldline → wake →
copy main selection → register → native queued prompt. It preserves operation
and request IDs on uncertainty, never retries a paid write or aborts an uncertain
accepted operation. Inspect `operation-status` before recovery. Native clone is
a separate conversation; regenerate/edit-send uses the Tavern worldline family.
An accepted prompt is admission, **not completed generation**. `activity` and
`jobs` observe completion. `cancel` is an explicit native cancellation.

`edit-send` edits a player turn by creating a new worldline and queueing the
edited text. `persona-set` updates the global `/api/roleplay/userinfo` record
and does not send a turn. `edit-message` uses branch `replace-message` for one
durable user or assistant message. `delete-message` uses branch `delete` and
retains the audit record. `delete-user` creates the existing truncated
worldline and does not queue a prompt. These commands require exact session
and message/seq anchors.

Reads of Agent-owned routes explicitly wake only that named Agent (zero model
requests). Resource listing can migrate legacy resource metadata using the
existing route. No CLI writes directly to stories, memories or worldline files.
`--dry-run` connects nowhere and shows the plan; multi-step plans list stages.

## 0.3 development commands (CLI 1.8.0)

These commands operate on an exact `--session ID` and accept `--dry-run` to
show the route and body without connecting. Revision conflicts are returned as
errors; the CLI never fetches a newer revision and retries a write. Read the
current policy first and pass the revision that it returned.

All session commands accept `--no-wake` to skip the implicit pre-command wake.
`history`, `cancel`, `clone`, `upload`, `wake`, `mvu-state`, `mvu-set`, and
`model-select` already skip the implicit pre-command wake. The `wake` command
still makes its one explicit wake request. The flag does not remove an explicit
child wake in the built-in `regenerate` and `edit-send` workflows. A direct
`send` remains one queued prompt; it does not start the worldline preparation
chain. Use `--no-wake` when that direct send should not wake the named session.

### Community presets and regex

`community-presets` reads the policy and library. Add `--preset-id ID` to read
one preset; `--action export|export-plans` exports that preset or its plan pack
and requires an ID. `--action card-mapping` reads the current card mapping.
`preset-import --file preset.json --expected-revision N` imports a JSON preset
into the library without selecting it; `--name` can override its imported name.
Select it separately with `preset-select --preset-id ID --expected-revision N`
(default scope `conversation`, or explicitly `--scope global`). The CLI reads
the current selection for that scope, then posts the complete selection using
the caller's revision; it does not refresh a stale revision or retry. Changing
the preset or using `--off` clears its `prompts`, `contents`, `regexes`, and
`features` overrides, matching the UI; selecting the same preset retains them.
Both behaviors retain other selection options such as sampling and regex order.
`--off` sets `selection.presetId` to explicit `null`; that disables the preset for this scope and differs from
`preset-inherit`, which removes the conversation override so it inherits global
selection.

```powershell
dsh-debug community-presets --session SESSION_ID
dsh-debug community-presets --session SESSION_ID --preset-id PRESET_ID --action export
dsh-debug community-presets --session SESSION_ID --action card-mapping
dsh-debug preset-import --session SESSION_ID --file preset.json --expected-revision 12 --dry-run
dsh-debug preset-select --session SESSION_ID --preset-id PRESET_ID --expected-revision 13 --dry-run
dsh-debug preset-select --session SESSION_ID --off --expected-revision 14 --dry-run
dsh-debug preset-inherit --session SESSION_ID --expected-revision 15 --dry-run
```

For an explicit community action, `preset-set --body-file action.json` accepts
`update`, `copy`, `delete`, `configure`, `select`, `control`, `import-plans`,
`preview-plans`, `apply-plans`, or `save-plan`. Its JSON body carries the action
and `expectedRevision` from the most recent `community-presets` read, except
`preview-plans`, which is read-only and needs no revision. The default scope is
`conversation`. `select` submits a complete native selection from the current
read; `configure` remains a partial patch. Example `configure` body:

```json
{
  "action": "configure",
  "scope": "conversation",
  "expectedRevision": 15,
  "patch": { "presetId": "PRESET_ID" }
}
```

Example complete `select` body:

```json
{
  "action": "select",
  "expectedRevision": 16,
  "selection": {
    "presetId": null,
    "applySampling": false,
    "prompts": {},
    "contents": {},
    "features": {},
    "regexes": {},
    "regexOrder": null
  }
}
```

`regexes` reads the regex policy/library. `regex-import` imports a JSON file at
the explicit revision with a `conversation`, `global`, or `preset` binding;
the preset binding requires `--preset-id`. The import's enabled/disabled flags
are retained; enabled rules become part of that binding's matching policy.
`regex-set` accepts only `update` and `delete`, with the exact revision from
`regexes`. Example update body:

```json
{ "action": "update", "expectedRevision": 21, "id": "REGEX_ID", "name": "Example" }
```

`regex-preview` previews current regexes against supplied text without saving
changes. Choose `--channel display|prompt`, `--placement 0..6`, `--depth N`, and
optional `--is-edit`; text may come from `--text` or `--text-file`. Normal
preview contacts the existing endpoint, while `--dry-run` remains offline.
`regex-display --body-file messages.json` takes references to real stored
messages, not caller-supplied message text:

```json
{ "messages": [{ "seq": 123, "messageId": "MESSAGE_ID" }] }
```

The server reads those messages from the selected session before producing the
display projection.

### Native card conversion and resources

```powershell
dsh-debug card-conversion --session SESSION_ID
dsh-debug card-convert --session SESSION_ID --resource-id RESOURCE_ID --dry-run
dsh-debug card-apply --session SESSION_ID --job-id JOB_ID --dry-run
dsh-debug card-source --session SESSION_ID --out original-card.png --dry-run
dsh-debug export --session SESSION_ID --kind card-export --mode original --dry-run
dsh-debug resource --session SESSION_ID --resource-id RESOURCE_ID
```

`card-conversion` reads conversion capability and binding. `card-convert` starts
the existing `card-convert` job and may invoke models; `--resource-id` optionally
selects the uploaded resource to convert. Authorize it as a potentially paid
operation. `card-apply` applies a completed conversion job.
`card-source` downloads the original uploaded bytes to a new exclusive-created
file and returns its byte count and SHA-256. This is distinct from
`export --kind card-export --mode original`, which exports the current card
state as NextTavern JSON. `resource` reads one resource's metadata and available
text.

### Usage and logs

`usage`, `usage-requests`, and `logs` accept `--scope session|all`, optional
`--target-session-id`, inclusive `--from` / exclusive `--to` epoch milliseconds,
`--model`, and `--kind`. The default range is the last 24 hours; `--from 0`
requests all available history. `usage` and `usage-requests` also accept
`--provider` and `--currency USD|CNY`; `logs` accepts `--status`.
`usage-requests` and `logs` use `--offset` (default 0) and `--limit` (default
50, range 1–100). Continue from the response's `offset`, `limit`, and `total`;
the caller controls pagination. Keep explicit `--from` and `--to` bounds fixed
across every page so new activity cannot shift the result set between requests.

```powershell
dsh-debug usage --session SESSION_ID --scope all --from 0 --currency USD
dsh-debug usage-requests --session SESSION_ID --scope session --from 0 --provider PROVIDER --offset 0 --limit 50
dsh-debug logs --session SESSION_ID --scope all --kind KIND --status STATUS --from 0 --offset 0 --limit 50
```

On a timeout or transport uncertainty, preserve the original `requestId` and
inspect `state`, `activity`, and `history`; do not start another request on the
assumption that the first one failed. Only after `state.failedTurnRecoveryByTurn`
confirms a failed turn should you use its `userSeq` with `regenerate`. For an
uncertain branch step, inspect its existing operation with
`worldline --action operation-status`. `activity` reports activity/job progress;
it is not a lookup for the `send` `requestId`.

### Numerical state and model selection

`mvu-state` reads `/api/roleplay/mvu-state` without waking the session. Preserve
the returned `numericalState.kind`, `values`, `observedNativeSeq`, `snapshot`,
and blocked code. `mvu-set` submits one exact native compare-and-set body from a
file. Its schema is version 1 with a new `operationId`, action
`replace-values`, the complete `expected` object, and the requested `values`.
Copy `sourceSha256`, the full `root` object including derived fields,
`revision`, `headSha256`, `valuesSha256`, `stateSnapshotSha256`, and
`observedNativeSeq` from the matching state read. The CLI adds only `sessionId`;
it does not reread hashes, refresh the expected revision, or retry a conflict.
The reply reports `operation.outcome` as `updated`, `no-update`, `refused`, or
`unknown`. On an HTTP error, the business error code remains at top level and
`details` retains `httpStatus` plus the complete `result`.

```jsonc
{
  "schemaVersion": 1,
  "operationId": "NEW-UUID",
  "action": "replace-values",
  "expected": {
    "sourceSha256": "COPY-FROM-MVU-STATE",
    "root": { /* copy the complete root object, including derived fields */ },
    "revision": 0,
    "headSha256": "COPY-FROM-MVU-STATE",
    "valuesSha256": "COPY-FROM-MVU-STATE",
    "stateSnapshotSha256": "COPY-FROM-MVU-STATE",
    "observedNativeSeq": 0
  },
  "values": { "field": "new value" }
}
```

The comment, uppercase strings and sample revision/sequence above are
placeholders, not literal values; `expected.root` must be the complete object
returned by `mvu-state`. `model-select` calls native `session/selectModel` directly for the
exact session and is also no-wake by default.

```powershell
dsh-debug mvu-state --session SESSION_ID
dsh-debug mvu-set --session SESSION_ID --body-file mvu-set.json --no-wake
dsh-debug model-select --session CHILD_SESSION_ID --provider PROVIDER --model MODEL --effort low
```

### Stepwise native worldline operations

Use `worldline` to call the existing native `prepare`, `create-worldline`,
`register`, and `operation-status` actions one at a time. `prepare` and
`register` require a body file containing their exact native fields; the CLI
supplies `sessionId` and `action`. A regenerate prepare body, for example, is
`{ "kind": "regenerate", "userSeq": 123 }`; use the exact source anchor from
the native session. `create-worldline` and `operation-status`
require the existing `operationId`, supplied with `--operation-id` or in the
body file. The `prepare` reply's `previousTurnEndSeq` is a logical turn anchor,
not a physical seed length. `prefix.inheritedEventCount` on the parent reports
how many events that parent inherited from its own parent; it is not the new
child's physical seed length.

```json
{
  "operationId": "OPERATION-ID-FROM-PREPARE",
  "childSessionId": "CHILD-ID-FROM-CREATE-WORLDLINE",
  "requestId": "ONE-STABLE-REQUEST-ID",
  "promptText": "THE-EXACT-REGISTERED-PROMPT"
}
```

Use this object as the `register` body, retaining the exact prepared prompt and
the same request ID planned for the subsequent explicit `send`. Registration
does not queue a prompt. The higher-level `regenerate` and `edit-send` commands
still run their built-in prepare/create/register/queue workflow. For the manual
flow, `send` is a separate step after successful registration. The CLI does not
retry, recreate, or abort an uncertain step. A host restart between create and
register can leave the native operation unknown
(`SCHEMA_DERIVED_PUBLICATION_UNKNOWN`); the CLI preserves that result rather
than repairing it. An HTTP 200 response with `ok: true` and `status: "failed"`
from `operation-status` is still a business failure. Other branch HTTP errors
retain the native error code at top level and `details.httpStatus` plus
`details.result`.

`--out` writes the complete original native JSON reply to a new file. The
command data is `{ "reply": ..., "path": ..., "bytes": ..., "sha256": ... }`;
an existing target is refused. If the server replied but writing the local
receipt fails, the error uses code `receipt-save`, preserves `details.reply`,
and sets `automaticRetry: false`. The write may leave a partial local file; use
`details.reply` to restore the receipt locally and do not repeat the remote
action.

```powershell
dsh-debug worldline --session SESSION_ID --action prepare --body-file prepare.json --no-wake --out prepared.json
dsh-debug worldline --session SESSION_ID --action create-worldline --operation-id OPERATION_ID --no-wake --out created.json
dsh-debug wake --session CHILD_SESSION_ID --no-wake
dsh-debug model-select --session CHILD_SESSION_ID --provider PROVIDER --model MODEL --effort low --no-wake
dsh-debug worldline --session SESSION_ID --action register --body-file register.json --no-wake --out registered.json
dsh-debug send --session CHILD_SESSION_ID --text-file prompt.txt --request-id REQUEST_ID --no-wake
dsh-debug worldline --session SESSION_ID --action operation-status --operation-id OPERATION_ID --no-wake
```

`edit-message` is a synchronous native replace-message call. Anchor an assistant
message with `state.assistantActionAnchorsByTurn[turn].messageId` or a canonical
`surfaceNodes` message ID; anchor a user message with its exact `seq`. Use
`--text-file` to preserve the text file's line endings and trailing blank lines.
The response contains the resulting `seq` and `messageId`; it has no operation
to poll.

## JSON / boundaries

Success: `{"schemaVersion":1,"ok":true,"data":...}`.
Error: `{"schemaVersion":1,"ok":false,"error":{"code":"...",
"message":"...","details":...}}`, exit 1. Native server-response envelopes
are unwrapped. API values otherwise retain their field names. Sensitive named
credential/header fields are redacted. Exact story/history data may be private:
keep captured output in ignored artifacts, not Git. Download writes a new file
only, returning path, byte count, SHA-256; it does not overwrite.

Each request has a bounded deadline (default 30 s, maximum 120), and response
size is capped at 32 MiB. No automatic retry of writes. Raw request defaults
to GET; POST and body-file must be explicit. Only local `/api/` paths allowed.
The CLI does not reproduce CSS, browser rendering, toolbar clicks, hover or
localStorage behavior; those still require browser verification.

## Sanitized source map

- `core/host-index.js`: GET conversations, POST wake; Host lifetime.
- `core/community-preset-routes.js`: GET/POST community preset and regex routes;
  display regex reads referenced source messages from the selected session.
- `core/roleplay-core.js`: GET state/activity/models/jobs/resources/logs/usage,
  card-conversion and filtered usage-requests;
  POST models `{sessionId,scope,settings,expectedRevision}`, jobs
  `{sessionId,kind}` or `{sessionId,action,jobId}`, branch workflow actions.
- `/api/roleplay/card-source` returns the original uploaded bytes; `card-source`
  writes them to a new local file and reports SHA-256.
- Native Connection `/api/session/{prompt,fork,cancel,selectModel,page,list}`:
  POST `{type:'client-request',rpcId,method,payload:{args:{request:...}}}`;
  list uses `_request`. Page requires a durable throughSeq boundary.
- Download GET `/api/roleplay/download?sessionId=...&resourceId=...` returns bytes.
- `core/host-index.js`: GET/POST `/api/roleplay/userinfo` reads or updates the
  global persona fields (`name`, `gender`).
- Native cookie auth remains mandatory; no CSRF bypass/header changes.

### Harness 0.1.7-rc.2 contract

The CLI 1.8 source targets the fixed Harness `0.1.7-rc.2` contract. It adds
REST-backed community preset/regex, card-conversion, resource, and filtered
usage/log commands; the existing direct Connection RPC shapes (`session/page`,
`session/prompt`, `session/fork`, `session/selectModel`, `session/list`,
`workspace/create`, and `workspace/follow`) keep their documented meaning.
This is the maintenance-source contract, not a live integration result for every
installed host. The following host-side details remain relevant:

- `workspace/initializeDefault` takes only a signal now and always creates `<Documents>/deepseek-harness/default-workspace`; the display name is localized by each client, so the stored title stays the directory name. `workspaces` therefore reads the registration, not a language-specific label.
- `session/page` accepts an optional `turnWindow: {minMessages, minTurns}`. `history` keeps its explicit `--through-seq` plus `--limit` contract and does not send a window.
- `request/header` events carry `reason` and an optional `startsSeries`. `reason: "change"` alone no longer means a new model-message series, so read that flag instead of inferring a series from the reason.
- First-start and install diagnostics changed upstream: skipped profile bundles are reported once per launch with their reasons, the plugin manager records its package-manager run tree under `.plugin-manager/run.json`, and a lock whose recorded owner process no longer exists may be taken over. These are host-side behaviours the CLI observes; they add no request or retry of its own.
- Regenerating once stays the caller's single action. The alpha.7 acceptance saw one regeneration leave two turns in the child session; the user's ruling (2026-09-25) is that this is a **CLI-side defect**, so the CLI does not re-send or de-duplicate to compensate and the tavern product is not asked to carry extra logic for it. Report the observation instead of hiding it.

`upload-card --import` sends the original `.md`, `.txt`, `.json`, or `.png`
bytes to the official `/api/session/uploadFileBinary?sessionId=...&name=...`
route, then submits `/api/roleplay/jobs` with
`{sessionId,kind:'card-import',attachment:{receiptId},requestId}`. It verifies
HTTP 200, the business result, receipt, file name, exact byte count and full
SHA-256 before preparing the import. File size is capped at 20,000,000 bytes.
This import path runs through the same worker on Windows and Linux, including
SSH; it no longer needs local Workspace staging, `systemctl`, or service UID
switching. Existing authentication and non-loopback refusal remain in place.
No import queues `session/prompt` or puts card bytes in a player prompt.

Before jobs POST, the CLI atomically saves and reads back one local v1 recovery
index containing only `schemaVersion,targetId,sessionId,receiptId,requestId,createdAt`.
`targetId` hashes non-secret routing identity, never credentials or card paths.
The default location is `card-imports/<target-session-hash>.json` beside the
selected `--config`; `--recovery-file` explicitly selects another local file.
An exclusive `.lock` serializes CLI attempts; cleanup checks a bounded exact
owner token and the created file identity before removing it. A replacement
or unknown lock is preserved. A crashed process may leave that
lock: inspect the original task and confirm no CLI attempt is active before
manually removing only its stale lock; preserve the JSON recovery index.

Use `upload-card --session ID --import --resume` without `--file` to confirm
the saved task. It reuses the exact receipt/request ID and never uploads again.
Optional `--request-id` must match the saved identity. A pending, unreadable,
damaged, unknown-version or wrong-target/session index blocks a fresh upload;
it is never overwritten. Unconfirmed, failed, cancelled and lost-response
outcomes retain it. Only a matching completed job clears it automatically.
If the host restarts before the first jobs admission, its volatile upload
receipt can expire: preserve the index and inspect the original task manually;
the CLI does not re-upload or change the uncertain identity.
An HTTP 4xx response only sets the safe diagnostic `serverRejected:true`; it
does not prove there were no side effects or that no job exists. Error details
report the bounded stage (`upload`, `prepare`, `jobs-post`, or `jobs-get`), not
the underlying private server message. Upload/preparation errors state that
this CLI attempt has not sent jobs POST and preserve any existing identity.
If upload has been sent but the index has not yet been persisted, another
explicit attempt may mint an additional receipt; an upload alone does not
start an additional import job.

To choose another card after a confirmed failure/cancellation, explicitly run
`--import --resume --end`. It reads jobs and clears only the local index when
exactly one same-request card job has a valid ID and is still failed/cancelled.
Unknown, running and completed statuses cannot use this path. The original
server job, sources and history remain; clearing the index does not roll back
the current card. PNG/JSON classification adds zero model requests on normal,
retry and fallback paths; Markdown/TXT retain the existing native model task.
No-job results and expired receipts before first admission cannot use `--end`.
Retry only the saved identity and inspect manually; the CLI does not claim to
automatically release these uncertain states. Use a new request ID for a new
import attempt after a confirmed completion/end.

Without `--import`, `upload-card --file` retains the legacy staging path under
DSH_HOME `roleplay/cli-imports`, with no import. That path and general `upload`
still depend on the documented Linux staging capabilities. The official
`session/attachment` read-only RPC is not used as an upload endpoint.

`upload` is the general file path for an exact Session that is already a member
of one registered native Workspace. `--dir` is required and is a relative
POSIX-style directory below that Workspace; absolute paths, backslashes, empty
components and `.`/`..` components are rejected. The worker reads native
`session/list` continuation pages until it finds the exact ID, then reads the
`workspace/follow` snapshot and checks that the Session's `cwd` matches its one
registered Workspace. It does not accept a server root from the CLI packet. The
Linux worker opens the registered root and every target-directory component
through `dir_fd` with `O_DIRECTORY|O_NOFOLLOW`; a symlink, parent replacement
race, or non-directory component fails closed.

The final name is `<sha256><safe source extension>` inside the requested
directory, so different content never overwrites a same-source-name file. An
already-existing regular file is reused only after its bytes and SHA-256 match;
otherwise the command reports a conflict. New files are exclusive-created,
written by the actual service account, read back and hashed before the CLI
returns the service-readable `path`, `bytes`, `sha256`, `workspaceId`, and
`reused` flag. The SSH worker reads the configured unit's actual `MainPID` and
its `/proc/<pid>/status` UID/GID/groups, then forks and drops to that identity
before it opens or creates any Workspace path. It never changes ownership of an
existing Workspace directory; an inaccessible directory reports a service-account
permission error. A failed new-file write removes only the inode created by that
invocation when it can prove the inode still matches. Generic uploads accept
local regular files up to 20 MiB and do not queue an import prompt.

Design gate: “原本程序直接完成的步骤，现在需要模型推理；预计增加几次请求，为什么值得？”
This change adds zero runtime model requests. A normal `upload` has one SSH
worker invocation, one or more native session metadata pages until the exact
session is found, one registered-workspace baseline read, and one
service-account file write/readback. It has no automatic retry; the existing
short-lived credential fallback is authentication-only when no launch token is
available. Reads/dry-run add zero; explicit
send/regenerate/export invoke exactly the existing pipeline, not an extra CLI
model. No model-driven selector, warmup, cache padding or automatic retry.


## Current settings and character cluster

Memory settings use `settings` / `settings-set`: window size, complete-story tail budget and notes cadence are primary. Target/archive options are legacy compatibility controls. Preserve revisions and scope; `0` restores inheritance as documented above.

The character cluster is default off. The GET response exposes effective `settings`
plus raw `session` and `global` records. The CLI writes the owning scope explicitly:
session toggles and character overrides are conversation-scoped; a default route
without `--character` is the global policy shared by conversations.

```powershell
dsh-debug request '/api/roleplay/character-cluster?sessionId=session-ID'
dsh-debug request '/api/roleplay/character-cluster' --method POST --body-file cluster.json --dry-run
```

Raw scope records carry the revision used by POST: session writes contain
`enabled`, `defaultRoute` and `characters`; global writes contain only
`defaultRoute`. Preserve returned character settings when changing one route.
Null routes inherit; `{main:true}` follows the writer, optionally with
`reasoningEffort`; explicit routes contain `provider`, `model` and optional
`reasoningEffort`. Preference changes do not generate a story; future enabled
stories may start paid children, even with the writer's model.

See the maintainer notes `docs/archive/2026-09/character-cluster-20260910.md`, `docs/operations.md`
and `project.md` for the cluster evidence, operations contract and current
baseline. Admission, HTTP success, model completion and browser rendering remain
separate observations.

## Character-agent cluster

These commands use the existing `/api/roleplay/character-cluster` endpoint. A
session ID is always required, and no model request is created by changing
settings. The CLI rejects an old response without raw `session`/`global`
records before sending a write, so it cannot accidentally overwrite effective
settings.

```powershell
dsh-debug cluster --session session-ID
dsh-debug cluster-set --session session-ID --enabled true
dsh-debug cluster-route --session session-ID --provider google --model MODEL_FROM_CATALOG --effort low
dsh-debug cluster-route --session session-ID --character CHARACTER_ID --main --effort medium
dsh-debug cluster-route --session session-ID --character CHARACTER_ID --provider PROVIDER --model MODEL_FROM_CATALOG --effort low
dsh-debug cluster-route --session session-ID --character CHARACTER_ID --inherit
dsh-debug cluster-route --session session-ID --inherit
dsh-debug cluster-set --session session-ID --enabled false --dry-run
```

`cluster` returns effective settings, raw scope revisions and roster IDs/names.
Obtain model IDs and supported effort values from `models`; the server validates
them. Omitting `--character` selects the global default route. `--main` follows
the writer dynamically; `--inherit` clears the override (character → default,
default → main). Omitted effort uses the selected provider/model default; supply
an explicit effort when required. Unknown roster IDs are rejected before writing.

Writes read the current revision and preserve all untouched fields and other characters, then submit one revision-checked write. Conflicts/timeouts do not auto-retry. Refresh settings before deciding whether another write is needed. No browser, raw JSON or direct storage edits are needed.

## Release archive

The shared release manifest includes this tool in the main runtime `.tgz` under `tools/dsh-debug/`, and creates a standalone `dsh-debug.tgz`. Both contain only program/worker/installer/documentation. Connection config and credentials stay local. Run `python dsh_debug.py` directly on systems without PowerShell; Windows `install.ps1` installs the launcher. Codex is not required; `-InstallCodexSkill` is an optional installer flag. The current SSH and loopback credential adapter targets the documented legacy credential layout (`.credentials.yaml` with the `~/.dsh` fallback); `alpha3` is the repository source-tree label. Configuring another host does not automatically adapt unsupported Harness authentication formats, which is why a non-loopback direct endpoint needs an operator-supplied cookie.
