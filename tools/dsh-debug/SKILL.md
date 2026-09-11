---
name: dsh-debug
description: Operate and debug a configured DSH Tavern through the installed CLI: inspect exact sessions, worldlines, state, models, jobs, history, usage, export/download, queue input and regenerate in isolated test sessions. Prefer this over browser automation for API behavior; use the browser for rendering and click behavior.
---

Verify `Get-Command dsh-debug`, then `dsh-debug --json doctor`.
If the current shell has an old PATH, use
the `dsh-debug.ps1` entry under the current user's `.local/bin` directly.
Installed docs: `~/.dsh-debug/lib/README.md`.
Canonical operations source remains in the DSH maintenance repository.

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
   retry generation or delete/abort uncertain operations.
5. Model policy writes use `model-set --body-file` with the current revision.
   Do not change global policy for an isolated test. Paid calls, content edits,
   cancellation and model changes require the user's task authorization; existing
   authorization for test sessions persists. Read-only diagnostics need no new approval.
6. Use `export`, `jobs`, then `download --out` for artifacts. A download returns
   a local SHA-256; compare it against the expected served artifact.
7. Raw `request /api/...` defaults GET, and POST requires explicit method and
   body-file. Reuse existing routes; never add a public debug bypass.

Global persona changes use `persona-set --body-file` (or read with `userinfo`)
and are independent from player `edit-send`. Durable message replacement uses
`edit-message --role user|assistant`; assistant branch removal uses
`delete-message`; removing a player turn creates a truncated worldline with
`delete-user`. Each mutation requires an exact session plus seq/message anchor.
`model-route --purpose status|decision|memory --provider ... --model ...`
reads and revision-checks the current policy, preserving other routes; use
`--effort low|medium|off` as supported by the selected model. Scope defaults to
the session and global scope must be explicit. Capability validation remains on
the native models route.
Role-card import has no direct CLI/RPC operation because the native source
exposes only the model tool import sequence. `upload-card`
stages a local .md/.txt/.json/.png into the fixed server import directory;
only explicit `--import` queues one native prompt referring to that path.
Never put card bytes in the prompt; verify completion through activity/jobs.

Auth uses SSH settings from `~/.dsh-debug/config.json`, env overrides first.
The launch token or short-lived native browser cookie stays on the server.
Do not print credentials or copy them into a command line.

```powershell
dsh-debug --json resolve --query session-b719
dsh-debug --json state --session session-ID
dsh-debug --json send --session session-ID --text-file player.txt --dry-run
```

## Cluster settings (CLI 1.3)

Use `cluster --session ID` for settings/revision and roster IDs. `cluster-set --session ID --enabled true|false` toggles this conversation only. `cluster-route --session ID [--character ID] --provider PROVIDER --model MODEL [--effort LEVEL]` sets default/individual routes; `--main` follows the main model, `--inherit` clears the override. Read `models` for supported values. Writes preserve other characters, enforce revisions, and never automatically retry. Use `--dry-run` for a network-free request preview.
