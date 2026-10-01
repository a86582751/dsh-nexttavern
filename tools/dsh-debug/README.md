# dsh-debug 1.6

Python 3.14 stdlib CLI for the installed DSH alpha3 REST + Connection RPC.
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
`upload-card` and `upload` are refused on a non-loopback endpoint
(`upload-requires-ssh`): they stage and read files on the DSH host via the
unit's service account, which only the SSH worker can do.

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
dsh-debug upload --session session-ID --file original.txt --dir .dsh-uploads --dry-run
dsh-debug upload --session session-ID --file original.txt --dir .dsh-uploads
dsh-debug clone --session session-ID --at-seq 456 --dry-run
dsh-debug model-set --session session-ID --body-file policy.json --dry-run
dsh-debug model-route --session session-ID --purpose status --provider qwen --model qwen3.8-flash --effort low --dry-run
dsh-debug worldline --session session-ID --action operation-status --operation-id operation-ID
dsh-debug jobs --session session-ID
dsh-debug export --session session-ID --kind card-export --dry-run
dsh-debug resources --session session-ID
dsh-debug download --session session-ID --resource-id resource-ID --out book.md
dsh-debug request /api/roleplay/state?sessionId=session-ID
```

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
- `core/roleplay-core.js`: GET state/activity/models/jobs/resources/logs/usage;
  POST models `{sessionId,scope,settings,expectedRevision}`, jobs
  `{sessionId,kind}` or `{sessionId,action,jobId}`, branch workflow actions.
- Native Connection `/api/session/{prompt,fork,cancel,selectModel,page,list}`:
  POST `{type:'client-request',rpcId,method,payload:{args:{request:...}}}`;
  list uses `_request`. Page requires a durable throughSeq boundary.
- Download GET `/api/roleplay/download?sessionId=...&resourceId=...` returns bytes.
- `core/host-index.js`: GET/POST `/api/roleplay/userinfo` reads or updates the
  global persona fields (`name`, `gender`).
- Native cookie auth remains mandatory; no CSRF bypass/header changes.

### Harness 0.1.7-rc.2 contract

The CLI was re-checked against Harness `0.1.7-rc.2`; every request shape it sends kept its meaning (`session/page`, `session/prompt`, `session/fork`, `session/selectModel`, `session/list`, `workspace/create` and `workspace/follow`), so no command, flag or payload changed. Four details are worth knowing while reading results:

- `workspace/initializeDefault` takes only a signal now and always creates `<Documents>/deepseek-harness/default-workspace`; the display name is localized by each client, so the stored title stays the directory name. `workspaces` therefore reads the registration, not a language-specific label.
- `session/page` accepts an optional `turnWindow: {minMessages, minTurns}`. `history` keeps its explicit `--through-seq` plus `--limit` contract and does not send a window.
- `request/header` events carry `reason` and an optional `startsSeries`. `reason: "change"` alone no longer means a new model-message series, so read that flag instead of inferring a series from the reason.
- First-start and install diagnostics changed upstream: skipped profile bundles are reported once per launch with their reasons, the plugin manager records its package-manager run tree under `.plugin-manager/run.json`, and a lock whose recorded owner process no longer exists may be taken over. These are host-side behaviours the CLI observes; they add no request or retry of its own.
- Regenerating once stays the caller's single action. The alpha.7 acceptance saw one regeneration leave two turns in the child session; the user's ruling (2026-09-25) is that this is a **CLI-side defect**, so the CLI does not re-send or de-duplicate to compensate and the tavern product is not asked to carry extra logic for it. Report the observation instead of hiding it.

Role-card import has no direct upload RPC. Source audit found the
official `session/attachment` RPC is read-only: it proves an existing image
reference is present in a session and returns its bytes. `session/prompt`
accepts already-admitted image attachment references, but no native upload or
file-ingest RPC/HTTP route is registered. Role-card import is otherwise only
the model tool sequence `rp_card_import_begin` → `rp_card_import_chunk` →
`rp_card_import_stage` → `rp_card_import_finalize`.
The CLI now supports staging a local `.md`, `.txt`, `.json`, or `.png` file
under `roleplay/cli-imports` inside the configured remote DSH_HOME
with a UUID filename, exclusive create, 20 MiB limit, SHA-256 verification,
realpath containment, and mode 0600. Upload alone sends zero model requests.
Only explicit `--import` queues one native prompt referring to the server path;
it returns admission and requires `activity`/`jobs` verification for import
completion and resource registration. It never embeds the card bytes in the
prompt or treats the file as executable instructions.

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

See the maintainer notes `docs/character-cluster-20260910.md`, `docs/operations.md`
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

The shared release manifest includes this tool in the main runtime `.tgz` under `tools/dsh-debug/`, and creates a standalone `dsh-debug.tgz`. Both contain only program/worker/installer/documentation. Connection config and credentials stay local. Run `python dsh_debug.py` directly on systems without PowerShell; Windows `install.ps1` installs the launcher. Codex is not required; `-InstallCodexSkill` is an optional installer flag. The current SSH and loopback credential adapter targets the documented alpha3 layout; configuring another host does not automatically adapt unsupported Harness authentication formats, which is why a non-loopback direct endpoint needs an operator-supplied cookie.
