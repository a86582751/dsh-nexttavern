---
name: dsh-debug
description: >-
  Operate and debug a configured DSH Tavern through the installed CLI. Inspect
  exact sessions, worldlines, numerical state, models, jobs, history, usage,
  community presets, regexes, Native card conversion, and export/download;
  queue input and regenerate in isolated test sessions. Prefer this over
  browser automation for API behavior; use the browser for rendering and click
  behavior.
---

Verify `Get-Command dsh-debug` and check `dsh-debug --version` or `--help`.
For ordinary daily diagnostics, then run `dsh-debug --json doctor`; if the
current shell has an old PATH, use the `dsh-debug.ps1` entry under the current
user's `.local/bin` directly. Installed docs: `~/.dsh-debug/lib/README.md`.
For a cold-first-read qualification, use offline `--version`/`--help` only
before the first business GET: do not run `doctor`, `state`, or open the browser
first. Read the exact session directly with `mvu-state --no-wake` or
`state --no-wake` so diagnostics do not prewarm the host.
Canonical operations source remains in the DSH maintenance repository.
The maintained source is CLI 1.8.0 for the current 0.3 development line and
fixed Harness 0.1.7-rc.2 contract. `alpha3` names this repository source tree,
not the host version. Check `dsh-debug --version` before using newer commands.
The target is selectable: `init --ssh-host ... --ssh-key ... [--ssh-port N]`
keeps the remote contract, and `init --target local [--host H] [--scheme S]
--port PORT [--cookie-file FILE] --dsh-home DIR --harness-root DIR` runs the
identical worker inside the CLI process against a directly reachable host and
port. A loopback host uses that machine's native credential; a non-loopback
host needs an operator cookie (`--cookie-file`, or `DSH_DEBUG_COOKIE` for one
run) and continues to refuse `upload-card`/`upload` on non-loopback direct targets.
`DSH_DEBUG_TARGET`, `DSH_DEBUG_HOST`, `DSH_DEBUG_SCHEME`, `DSH_DEBUG_PORT`,
`DSH_DEBUG_COOKIE_FILE`, `DSH_DEBUG_SSH_PORT`, `DSH_DEBUG_DSH_HOME` and
`DSH_DEBUG_HARNESS_ROOT` override the saved config per invocation, so one
installed CLI can serve a remote server and several direct ports.

1. Discover native sessions with `sessions`; `resolve --query` matches title or
   ID using server-side metadata projection before SSH transfer. `--limit` and
   `--cursor` bound output. `sessions --source catalog` lists only registered
   Tavern worldline families. Content search remains disabled; title lookup
   does not require it. Never equate an empty catalog with a missing native clone.
   Discover workspace grouping with `workspaces`; register an existing
   directory with `workspace-create --path`. Create an ungrouped session with
   `create --cwd`, select an existing workspace with `create --workspace-id`,
   or adopt and bind in one flow with `create --workspace-path`. The latter
   uses native `workspace/create` followed by `session/create`; it never moves
   existing sessions. An unknown workspace ID must surface
   `workspace/not-found`.
2. Read `state`, `activity`, `models`, `jobs`, `resources`. State and models can
   contain private story data: capture into ignored artifacts, not committed logs.
   `history` requires `--through-seq` from a verified durable log boundary.
   Read settings with `settings --session ID`; update selected fields with
   `settings-set --session ID --target-context-tokens N --archive-tokens N
   --context-window-tokens N --continuity-tail-tokens N`. Values of 0 inherit;
   use `--scope global|session` and `--dry-run` to inspect the revision-checked
   `/api/roleplay/memory-settings` plan.
3. For an authorized test, use `send --dry-run`, then native queued `send` with a
   stable request ID. Poll `activity`/`jobs` separately; admission is not completion.
4. `regenerate`/`edit-send` use worldline prepare/create/register/queue. `clone`
   explicitly creates a separate conversation. Use `--dry-run` to inspect plans.
   On transport uncertainty keep the returned request/operation IDs; inspect
   `worldline --action operation-status` before retrying. Never automatically
   retry generation or delete/abort uncertain operations. On send timeout or
   transport uncertainty, preserve the original request ID and inspect
   `state`, `activity`, and `history`; do not start a regenerate on the
   assumption that the send failed. Only after `state.failedTurnRecoveryByTurn`
   confirms the failed turn should its `userSeq` be passed to `regenerate`.
   `activity` is progress data, not a lookup for a `requestId`.
5. Model policy writes use `model-set --body-file` with the current revision.
   Do not change global policy for an isolated test. Paid calls, content edits,
   cancellation and model changes require the user's task authorization; existing
   authorization for test sessions persists. Read-only diagnostics need no new approval.
6. Use `export`, `jobs`, then `download --out` for artifacts. A download returns
   a local SHA-256; compare it against the expected served artifact.
7. Raw `request /api/...` defaults GET, and POST requires explicit method and
   body-file. Reuse existing routes; never add a public debug bypass.

## Community presets, regex and card conversion

The 1.8 session commands all require an exact `--session ID` and accept
`--dry-run`, which prints the planned request without connecting. Start from a
`community-presets` or `regexes` read and pass its exact revision to each write;
conflicts do not refresh or retry automatically.

Every session command accepts `--no-wake` to skip the implicit pre-command wake.
`history`, `cancel`, `clone`, `upload`, `wake`, `mvu-state`, `mvu-set`, and
`model-select` already skip that implicit wake by default. The `wake` command
still performs its one explicit wake request. This flag does not suppress an
explicit child wake in built-in `regenerate` and `edit-send` workflows. A direct
`send` remains one queued prompt; use `--no-wake` when it should not wake the
named session.

```powershell
dsh-debug community-presets --session ID
dsh-debug community-presets --session ID --preset-id PRESET_ID --action export
dsh-debug community-presets --session ID --action card-mapping
dsh-debug preset-import --session ID --file preset.json --expected-revision 12
dsh-debug preset-select --session ID --preset-id PRESET_ID --expected-revision 13
dsh-debug preset-select --session ID --off --expected-revision 14
dsh-debug preset-inherit --session ID --expected-revision 15
dsh-debug preset-set --session ID --body-file preset-action.json --dry-run
dsh-debug regexes --session ID
dsh-debug regex-import --session ID --file regex.json --expected-revision 21 --binding-scope preset --preset-id PRESET_ID
dsh-debug regex-set --session ID --body-file regex-action.json --dry-run
dsh-debug regex-preview --session ID --text 'sample text' --channel prompt --placement 2 --depth 0
dsh-debug regex-display --session ID --body-file messages.json --dry-run
```

`preset-import` does not select the imported preset; use `preset-select` as a
separate explicit action. `regex-import` applies the requested
`--binding-scope` (`conversation`, `global`, or `preset`) as part of the import;
imported rules marked enabled can affect that matching policy immediately.
`preset-select` defaults to conversation scope. It reads the current scope's
selection, then writes the complete selection with the supplied revision; it
does not refresh a stale revision or retry. Changing the preset or using
`--off` clears the `prompts`, `contents`, `regexes`, and `features` overrides,
as the UI does; selecting the same preset retains them. Both behaviors retain
options such as sampling and regex order.
`--off` sets this scope's `selection.presetId` to explicit `null`;
`preset-inherit` instead
removes the conversation override to inherit the global choice. Use
`preset-set configure` to update fields with a partial patch; `preset-set select`
accepts the complete native selection from the preceding read. `preset-set`
accepts `update`, `copy`, `delete`, `configure`, `select`, `control`,
`import-plans`, `preview-plans`,
`apply-plans`, or `save-plan`; its JSON body requires `expectedRevision` except
for read-only `preview-plans`. `regex-set` accepts only `update` or `delete` and
requires the revision returned by `regexes`. The README has complete JSON body
examples and the exact pagination and export boundaries.

`regex-preview` evaluates supplied text without storing it. `regex-display`
takes `{ "messages": [{ "seq": 123, "messageId": "MESSAGE_ID" }] }` and
asks the server to read the referenced session history; do not supply replacement
message text. `card-conversion` reads capability, `card-convert` starts a job
and accepts optional `--resource-id ID` to select an uploaded resource. It may
call models; `card-apply` applies a completed job. Treat conversion
as a potentially paid write requiring the task's authorization. `card-source`
downloads the original uploaded bytes; `export --kind card-export --mode
original` exports the current card state instead. `resource --resource-id ID`
reads one resource record.

For paginated usage requests and logs, keep explicit `--from` and `--to` bounds
fixed across every page so activity arriving mid-query cannot shift the results.

Use the `usage`, `usage-requests`, and `logs` filters to scope and page records.
Time filters are epoch milliseconds (`--from` inclusive, `--to` exclusive),
default to the last 24 hours, and `--from 0` requests all history. Pagination is
caller-controlled from the response's `offset`, `limit`, and `total` fields.

Read numeric state with `mvu-state` without waking the session. Use
`mvu-set --body-file` only with the complete native CAS object: schema version,
new operation UUID, `replace-values`, exact expected hashes/revision/root from
that read, and desired values. The CLI adds only `sessionId`; it does not reread,
refresh or retry. `model-select` uses native `session/selectModel` and also does
not wake by default. See the README for the full request shape and outcome codes.

`worldline --action prepare|create-worldline|register|operation-status` exposes
the native steps individually. Reuse the same operation ID, child ID, request ID
and exact prompt across the manual flow. Registration does not queue; only the
separate `send` step queues in that manual flow. The built-in `regenerate` and
`edit-send` commands still run their own complete workflow. Use `--out` to save
the original native reply to a new file; if local receipt writing fails after a
remote reply, retain `details.reply` and do not repeat the action. A successful
HTTP response can still report `status: "failed"`; inspect the business status.

Global persona changes use `persona-set --body-file` (or read with `userinfo`)
and are independent from player `edit-send`. Durable message replacement uses
`edit-message --role user|assistant`; assistant branch removal uses
`delete-message`; removing a player turn creates a truncated worldline with
`delete-user`. Each mutation requires an exact session plus seq/message anchor.
For `edit-message`, source the assistant ID from
`state.assistantActionAnchorsByTurn[turn].messageId` or canonical `surfaceNodes`,
and the user `seq` from native history. `--text-file` preserves line endings and
trailing blank lines; replacement is synchronous and returns the new `seq` and
`messageId` without an operation-status step.
`model-route --purpose status|decision|memory --provider ... --model ...`
reads and revision-checks the current policy, preserving other routes; use
`--effort low|medium|off` as supported by the selected model. Scope defaults to
the session and global scope must be explicit. Capability validation remains on
the native models route.
Use `upload-card --session ID --file card.png --import --request-id stable-ID`
for an explicitly authorized import. It sends the original bytes through the
official `uploadFileBinary` route, verifies the returned file reference, saves
a bounded v1 target/session/receipt/request identity locally, then POSTs one
attachment `card-import` job. The import worker path supports Windows and
Linux without service filesystem staging. No import sends a player prompt.
PNG/JSON classification adds normal/retry/fallback model requests 0/0/0;
Markdown/TXT keep the existing model task. Admission is not completion.

On uncertainty use `upload-card --session ID --import --resume` without a file:
it reuses the saved receipt/request and never uploads again. Optional
`--request-id` must match. `--recovery-file` chooses an explicit local index;
the default is `card-imports/<target-session-hash>.json` beside `--config`.
Never overwrite a pending, damaged, unknown-version or wrong-target index.
If a cold host invalidated the receipt before first admission, preserve the
index and manually inspect the original task; do not re-upload under that ID.
Only matching completed receipts clear automatically. Explicit
`--import --resume --end` can clear the local identity after a jobs GET proves
exactly one same-request valid-ID card job is failed/cancelled; it preserves
the server job, source/history and current card. Unknown statuses cannot end.
No-job or expired-before-admission cases also cannot use `--end`; preserve and
retry only the saved identity, then inspect manually. HTTP 4xx diagnostic
`serverRejected:true` does not prove absence of side effects or an existing
job. Import errors expose only safe stage/status/identity details, never the
underlying server message. `upload`/`prepare` failures mean this attempt has
not sent jobs POST; an additional explicit upload before index persistence
may create another receipt but cannot alone create another import job.
An active `.lock` blocks concurrent CLI attempts; automatic cleanup checks its
bounded exact owner token and created file identity, preserving replacement or
unknown locks. After a CLI crash, confirm
no original CLI process remains before manually removing its stale lock.

`upload-card` without `--import` retains legacy Linux staging with no import.
Do not update a machine's installed global CLI as part of source validation;
invoke the canonical script explicitly when testing a changed caller.

Use `upload --session ID --file local-file --dir .dsh-uploads` for an ordinary
file that the selected Session must read from its own registered Workspace.
The worker follows native Session metadata pages, resolves the registered
Workspace path, and stages through Linux dirfds as the configured service
MainPID's UID/GID; do not supply a server root or an absolute/`..` target. It
returns the readable path, byte count and SHA-256 after an exclusive
content-addressed upload. Use `--dry-run` first to inspect the target strategy;
it never contacts the server.

Auth uses SSH settings from `~/.dsh-debug/config.json`, env overrides first.
The launch token or short-lived native browser cookie stays on the server.
Do not print credentials or copy them into a command line.

```powershell
dsh-debug --json resolve --query session-b719
dsh-debug --json state --session session-ID
dsh-debug --json send --session session-ID --text-file player.txt --dry-run
```

## Cluster settings (CLI 1.8.0)

Use `cluster --session ID` for settings/revision and roster IDs. `cluster-set --session ID --enabled true|false` toggles this conversation only. `cluster-route --session ID [--character ID] --provider PROVIDER --model MODEL [--effort LEVEL]` sets default/individual routes; `--main` follows the main model, `--inherit` clears the override. Read `models` for supported values. Writes preserve other characters, enforce revisions, and never automatically retry. Use `--dry-run` for a network-free request preview.
