# Changelog

## 0.2.9-rc.2 — GitHub Latest & Issue #5 Closeout — 2026-10-03

- 将已核验的 0.2.9-rc.2 设为 GitHub latest，首页模板、中英 README 与所有当前便携安装器／归档下载链接统一到该版本，避免下载旧安装器。npm latest 按用户选择保持 0.2.9。
- Windows 缺少 pnpm 的安装问题已修复，#5 回复并按已解决关闭；#7 沿用此前说明与关闭结果。
- 原发行 tag、资产、哈希与安装器保持不变；复用已通过的代码与资产检查，官网发布按本次 head 重新读回。

English: 0.2.9-rc.2 is now the latest GitHub release. Current portable installer/archive links and the homepage point to it. npm latest remains 0.2.9. Issue #5 is resolved and closed; release asset bytes are unchanged.

## 0.2.9-rc.2 — Portable Package Manager Fix — 2026-10-03

- 修复 Windows 全新便携安装在官方 `plugin add` 子进程中找不到 pnpm 的问题：随包锁定私有 pnpm，为安装及后续启动传递正确 PATH。缓存回执存在但私有命令丢失时，重试会补齐依赖。
- 核对中文和空格路径的真实进程参数；请使用有写入权限的本机目录。Linux 安装／启动也使用同一私有包管理器。
- 这是基于 0.2.9 的安装预发行版，角色扮演功能和宿主 `0.1.7-rc.2/web` 支持范围不变。新安装器请使用新目录；本版不扩展便携安装器的跨版本原地升级承诺。
- 第三方 dshmarket 1.66.8 的皮肤开关持久化问题已在 [#7](https://github.com/a86582751/dsh-nexttavern/issues/7) 说明原因及绕法，本包不修改或替换玩家的市场。

English:

- Include a locked private pnpm and expose it to official plugin-install and later host/market child processes. Retry restores a missing command even when a cached dependency receipt exists.
- Verify real process arguments with spaces and Chinese paths; use a writable local directory. Linux installation and startup use the same private package manager.
- This installation prerelease keeps 0.2.9 roleplay behavior and Harness `0.1.7-rc.2/web` support. Use a fresh directory; no wider in-place installer upgrade is established. The third-party market issue remains upstream, with a workaround in #7.

## 0.2.9 — Distribution & Installation Fix — 2026-10-02

基于 0.2.8 的安装分发补丁，角色扮演业务功能和兼容范围保持不变：Harness **0.1.7-rc.2**／**web**／Session V4，pi-ai **0.85.1**。0.3 的 MVU、EJS、RUBY 与更完整社区卡前端兼容继续开发。

- 明确正式 npm 包名 **`dsh-nexttavern`**，使用 `dsh plugin --profile web add dsh-nexttavern` 或 [v0.2.9 Release](https://github.com/a86582751/dsh-nexttavern/releases/tag/v0.2.9) 的已校验归档安装。部分 Hub／市场找不到 npm 来源会回退 Git，第三方 catalog 仍待同步；本版未承诺 Git 源码直装或 DSH 0.2／desktop 兼容。
- 预置 `@google/genai` **1.52.0**、`protobufjs` **7.6.6** 的完整锁定运行依赖闭包，保留嵌套路径、许可证与逐文件校验。补齐私有 pi-ai SDK 的 bundle／依赖声明，使首次安装及固定目录重新链接无需这些依赖的安装脚本；持久化组件声明并携带 `koffi` 预构建 bundle。
- 改善 npm 发现元数据：9 个相关关键词、官网、问题反馈及标准 Git 仓库地址；通过官方 `locale/*` 导出机制提供英文／简体中文的 `NextTavern` 标题和说明。元数据改善不代表第三方市场登记已经完成。
- 更新官网、中英文说明与四平台安装入口。0.2.8 → 0.2.9 使用现有官方插件更新流程；从 0.2.5 旧宿主线迁移仍需先导出并使用新目录，便携安装器沿用现有恢复边界。

This is an installation and distribution patch based on 0.2.8. Roleplay behavior and supported hosts remain Harness **0.1.7-rc.2** / **web** / Session V4 with pi-ai **0.85.1**; broader community-card compatibility continues separately for 0.3.

- Use the official npm package **`dsh-nexttavern`** with `dsh plugin --profile web add dsh-nexttavern`, or a verified v0.2.9 Release archive. A third-party Hub or market may fall back to Git when npm discovery fails. Its catalog needs a separate update; this release does not establish Git source installation or DSH 0.2 / desktop support.
- Bundle the complete pinned runtime dependencies of `@google/genai` **1.52.0** and `protobufjs` **7.6.6**, including nested paths, licenses and file hashes. Matching private pi-ai SDK declarations let both first installation and fixed-directory relinking proceed without those install scripts. The persistence component declares and ships a prebuilt `koffi` bundle.
- Add nine discovery keywords, homepage, issue tracker, standard repository URL and English / Simplified Chinese metadata through official `locale/*` exports. Refresh the site, guides and installer links for all four platforms.

本轮本地验证覆盖空脚本许可下的真实首次安装、固定目录重新链接、冻结锁重装，以及 Google SDK 导入和 protobuf 编解码；严格 TypeScript 与生成一致性检查通过。此证据不扩大已有的纯净 VM、Linux 或 ARM64 真机覆盖。安装修复新增运行时模型请求 **0 次**，既有故事与后台任务的触发、缓存和计费保持不变。

Local checks cover real first installation with no script approvals, fixed-directory relinking, frozen-lockfile reinstall, Google SDK imports and protobuf encoding/decoding. Strict TypeScript and generated-source consistency checks passed. This does not expand clean-VM, Linux or ARM64 device coverage. The patch adds **zero runtime model requests** and preserves existing model triggers, caching and billing.

## 0.2.8 — 2026-10-01

抱歉让大家久等了。0.3 的目标是兼容更广泛的 SillyTavern 社区卡，包括 MVU 变量、EJS、RUBY 与前端美化；让它们进入自有状态、事件和恢复链的难度比预期更大，我们正在加速推进。本次先交付已经完成的整合安装和维护改善，这些兼容仍在开发，不计入 0.2.8。感谢大家继续反馈。

Sorry for the long wait. Broader SillyTavern community-card compatibility — MVU variables, EJS, RUBY and frontend styling — remains in development for 0.3. This release delivers the completed installation and maintenance work. `main` continues to receive development sources; install the npm package or the fixed v0.2.8 release rather than treating `main` as the release tree.

**Breaking migration:** the host is now Harness **0.1.7-rc.2** / Session V4, with pi-ai **0.85.1**. Old sessions cannot continue directly. Export character cards or novels in the old environment and use a fresh home/workspace; novels do not retain full session state. Keep the old installation and its backups separate.

- Install the unified `dsh-nexttavern` plugin through `dsh plugin --profile web add dsh-nexttavern`. It prepares the product, required compatibility providers, anydoc and the bundled skin. The host npm package is `@deepseek-ai/dsh@0.1.7-rc.2`. The official plugin manager controls enablement and removal; native UI/providers return on disable or failed activation, while user configuration and disabled choices are preserved. Unrelated appearance-setting writes no longer restart the whole product or blank its UI.
- Route both one-click installers through the same official plugin manager using the hash-checked release archive. Retire legacy profile-lock installation and host-byte replay for the unified product, verify installed identity and bundle registration before marking it ready, and recover an interrupted owned installation. Fix the Linux archive-root mismatch and refuse an old installation before bootstrap writes to its directory. Native receipts record the exact payload and component inventory hashes.
- Verify independently versioned owned components before loading, persist exact versioned references and reject corrupt archives or incompatible host peers. Preparation records lock/transaction checkpoints and can recover interrupted work. Install, upgrade, rollback, remove and reinstall lifecycle evidence preserves user files; controlled removal does not delete stories, resources, notes, user preset copies or model settings. Historical alpha.1 local measurements reduced first preparation from 355 s to 55 s and prepared restart from 18.6 s to 6.1 s; these are measurements, not a latency guarantee.
- Register `dsh-nexttavern-amber` as an independent bundle in the same installation, **off by default**. Reuse an existing upstream market unchanged; resolve and install `dshmarket` only when absent, recording the resolved version and verification information. Skin toggles remain reversible and survive product settings writes. A custom market fork and the old 1.39.0 pin are no longer required.
- Use native Session V4 sources, tool messages, declarative presets, shortcuts, attachments and sidebar. Official uploads/attachments replace the old community `file-upload` / `read_document`, and the official sidebar replaces `better-sidebar`. The attributed owned anydoc component parses documents including TXT/CSV/DOCX, supports bounded windows and full Markdown conversion, and fixes filesystem access from Agent scope. Office is no longer required; this release does not promise universal PDF/OCR support.
- Register worldline ownership before publishing a fork. Preserve inherited boundaries, cold recovery and ordinary fork semantics. Native message edits are durable; story projections, notes, state, recall and novel snapshots follow the selected edit. Edited sources make earlier exports stale and require rebuilding. Editing inherited prose directs the player to its owning worldline, leaving the original branch unchanged.
- Rebase memory preparation onto V4: hard windows with continuity tails, source-checked director notes, a full-coverage checkpoint barrier and on-demand `rp_history` after old prose leaves the injected window. Fix model-switch/rebuild queue ordering that could clear old vectors. Automatic archive compaction is retired; `archiveTokens` remains an advanced compatibility parameter, while active story memory uses windows, notes and history retrieval.
- Preserve original request usage while repricing edited current contexts. Cold statistics and inherited history do not charge replayed requests again. Missing usage/price data remains unknown rather than being presented as a complete bill.
- Fix hidden running-tool labels overflowing the process area and making chat jump. Native pagination, edits, drafts across tabs, status/decision cards, resources and session views remain integrated. Deleting a player message and its descendants restores the unanswered decision card/status at the retained boundary, including after toggles/reload, with no new model request.
- Restore the settings namespace bridge for rehomed providers: model rows remain visible and writable instead of showing only DeepSeek, writes reach the profile patch, disposal is idempotent and failed configuration restores native providers. This is the product fix; a separate deployment-specific remote settings patch is not part of this release.
- Keep frozen card/novel sources, ordered full-coverage validation, checkpoints and stale-source rejection. Resource downloads preserve the generated Markdown and original card bytes. Export validation refuses incomplete manuscripts rather than publishing missing sections.
- Keep session-log uploads disabled by default unless the player explicitly chooses them. Local REST and WebSocket boundaries use the host's authentication, Host and Origin checks; the native DeepSeek path remains available. The owned pi-ai compatibility layer preserves completion, abort, consumer-stop and idle-timeout cleanup across four protocols.
- Ship `dsh-debug` **1.6.0** with a local target, configurable host/port/scheme, SSH port and explicit remote cookie. Remote uploads are refused; native API/RPC inspection remains available.
- Separate maintained TypeScript in `src/` from generated JS/MJS in `lib/`, including Auth, skin and compatibility packages. Split record, presentation, resource lifecycle, disposal, pricing and release responsibilities. Root and `./client` exports and the three existing tools CLI entry points remain; internal deep paths changed. Public source rebuilds and all four browser bundle recipes now form a complete registered closure, with matching owned module identities. Shared-manifest assembly and npm/pnpm plus official lifecycle checks cover the package mechanism.
- Update the public documentation site and player guides for 0.2.8: official installation, fresh-directory migration, recovery and controlled removal. Keep the existing Markdown-driven pages, light/dark themes, navigation, offline search, screenshot viewer, code copy and original Amber artwork. The public preset foundation section remains empty and the default aesthetic remains rewritten around intimacy literature, continuing the 2026-09-26 v0.2.5 recut.

Installation, migration plumbing, recovery and these fixes add **zero new runtime model-review requests**. Existing story generation and background notes/status tasks retain their own triggering and billing behavior.

### Verification limits and known behavior

- Full paid import/opening, conversation/branch, memory/background, export/resource, usage/performance, UI and auth acceptance used the **alpha.1 candidate**. The subsequent **rc.2** migration received source/minimal checks and actual local/server installation; that full paid suite was not rerun on rc.2. Installer builds/contracts do not establish clean Win11 VM, Linux x86_64/aarch64 or real ARM64 device coverage. Windows installers remain unsigned.
- A novel export can fail if the model omits frozen source units; the checkpoint is retained and no incomplete archive is published. Clicking full novel export currently starts it in a new child session without a confirmation step. Opening a session may resume paid background memory/status maintenance.
- If the window checkpoint cannot obtain complete director-note coverage, it blocks window advancement. A recorded failure path repeatedly queued zero-model maintenance turns without backoff, including after restart; no fix is claimed for that retry behavior in this release.

## 2026-09-26: Documentation site

The repository now publishes its documentation as a website: <https://a86582751.github.io/dsh-nexttavern/>. Every page is rendered in CI from this repository's own Markdown, so the site and the Markdown can never drift apart — a section the site expects but the files no longer contain fails the build. It adds a landing page, a grouped sidebar, an in-page table of contents, dark/light themes, offline search over every published page, a screenshot lightbox and copy buttons for code blocks, and it ships no external fonts, scripts or third-party requests. Screenshots are compressed to WebP during the build, so the whole site is about 2 MB. The site is documentation only: the package, installers, downloads and production deployment are unchanged, and no secrets are involved.

Same day, the landing page started speaking with the project's own voice instead of borrowed copy: the greeting types out the lines the amber skin itself types, and the hero rotates through nine whale-girl illustrations generated for that skin. The header carries that skin's own brand art — an app-icon style portrait of the keeper, followed by the "Next Tavern" sign from the same batch — and the tab icon is the same portrait, because an "NT" monogram read as a word nobody wants. The caption under the rotating art is a single fixed line, "Welcome to the Next Generation Tavern", since the skin package deliberately keeps only a few of the generated pictures and per-picture labels would have claimed something that was not true. The typed greeting also reserves two lines, so a short sentence and a long one no longer move the lead paragraph and the buttons underneath it.

## 0.2.5 Preview - 2026-09-16

- Rebuild long-form memory around four pillars: a frozen settings prefix that is never compacted and is always injected; a hard-cut context window that keeps the most recent complete prose and preserves the tail when it advances; background director notes written by a separate background task, each carrying a source hash and a same-worldline anchor so provenance stays machine-checkable; and on-demand history recall in keyword (default), semantic and hybrid modes over player input plus valid story text, including archived and evicted prose. Status, tool output, CSS, decision cards and reasoning stay out of the corpus.
- Evict old director notes and state snapshots from the request instead of carrying them, and replace them only after a valid new anchor has been prepared; unchanged references keep exact backing, rollback re-serves the full text and raw events stay append-only. A ten-turn test found and fixed two real defects: a compacted maintenance suffix that made old tasks uncollectable, and unbounded accumulation of old director notes and state snapshots.
- Recycle a long research tool result into its matching checkpoint, but only when owner, source hash, generation and packetIds all match; partial saves, wrong sources, failed writes and post-confirmation re-reads are never recycled.
- Add an Embedding management page between Models and Usage. Online: DashScope, OpenAI-compatible and OpenAI official, with model refresh, manual model IDs, server-side-only key storage and a connect test. Local: verified BGE small zh, Qwen3-Embedding 0.6B, Jina Nano, Jina Small INT8 and Nomic q8 on ONNX Runtime 1.29.0 in a separate encoding process, with real byte progress, speed, ETA, pause/cancel/resume and a queued → downloading → verifying → preparing-runtime → self-testing → installed state machine. Local serving needs no API key and no network.
- Fingerprint vector recipes on model, revision, dimensions, task role, pooling, quantization and runtime; a mismatch marks the index stale and stops it serving until rebuilt. Vectors stay filtered to the current worldline at query time, so switching worldlines does not force a rebuild. Chunking is configurable with a 480-character default (192/480/960, 128-2048 range, 80 overlap) and a 512-token local budget; clear, rebuild and fill stay scoped to the current visible conversation and all its worldlines and keep prose, provenance and the ledger.
- Add a Presets page before Resources with create, edit, save-as-copy, select and delete; built-ins are read-only and 200 custom slots are available. Scope covers current conversation, designated conversation or global, all worldlines in one conversation share the override, and storage is versioned with a single lock and whole-config revision CAS.
- Ship 16 built-in styles — the default, a blank preset and 14 new ones including 日式轻小说, 乙女风格, 三体文风, 日式游戏, 电影感文风, 春秋文风, 极简文风, 细腻文风, 奇幻网文风, 恐怖文风, 鲁迅文风, 抒情文风, 日常搞笑风 and 古文文风 — each with a complete seven-section guide and original examples. Three explicit style modes (foreground system aesthetic, blend with card style, card style only) resolve conflicts by a stated rule, and card import, edit, export and persistence keep all three card style fields intact.
- Add 长文本转角色卡 as a new management tab with two reading modes chosen before research: intensive segmented full reading with source-checked notes, or coarse multi-round relation-frontier retrieval followed by longitudinal protagonist tracking. Coarse mode requires a usable novel model and a complete current index, otherwise a dialog guides configuration and the round ends without a silent downgrade.
- Freeze workspace TXT originals up to 64 MB with strict UTF-8 → GB18030 → BOM-aware UTF-16 decoding, recording raw-byte hash, decoded-text hash and size without mutating the upload; segment deterministically and bound batches below the native clipper. Gate research notes on a batch that was actually read and a quote that actually appears in it, and keep an independent semantic index for the novel, separate from story memory.
- Add per-character model overrides to the character agent cluster; the override belongs to the current visible conversation and is shared across its worldlines while inputs and results stay isolated per actual worldline. Fix background subagents listed as selectable conversations, save-time draft loss, stale resource and export replies and duplicate job actions.
- Move action suggestions into the standalone decision card only, so they are no longer duplicated into the status bar or prose tail, and hide legacy action areas without touching the original card. The decision card gains an independent collapse/restore toggle, a separate 稍后处理 close action, drag-to-move with double-click/Home reset and a clamped visible height. Validate and preserve authored status HTML/CSS across import, generation and legacy restore.
- Replace four third-party full-page reskins with the first self-owned skin, dsh-nexttavern-amber: a whole-interface redraw from the same design tokens with day and night themes, different sidebar art per theme, a headline typewriter that only takes over the title span and a tavern reader mode on aged parchment that leaves the author's ink colours untouched. The skin now ships as a real profile bundle — a `file:` link into the payload's `skins/` directory whose loader entry carries `disabled: true`, so it is installed and visible but off by default — and the bundled third-party market dshmarket 1.39.0 (MIT) provides the hot enable/disable toggle under 设置 → 插件市场 → 已安装, writing to the profile's `cordis.patch.yml` in about a second without a restart and keeping the choice across restarts. The same pass deleted an 82.6 MB single-bundle theme, removed the skin centre and reduced 18 packages to 4 kept-but-disabled; a third-party balance widget was disabled.
- Complete the TypeScript migration: TypeScript is now the only maintained source, with hand-written .ts/.mts modules and .js/.mjs build products generated by TypeScript 5.9.3 from a shared build manifest. At this release: 637 artifacts, 24 schemas and 158 TypeScript modules, covering core, UI, memory, auth, card reading, tasks, telemetry, branch and worldline routes and the release and install toolchain.
- Stop deep-copying the native conversation list when projecting it: 341 sessions / 9.35 MB at 48-88 ms per copy became shared read-only nested values that replace summaries only when aggregated fields differ. Regression measurement: 8,208 deep copies / 991 ms reduced to 0 copies / 9 ms.
- Cut idle request volume: 649 requests in 263 s over a slow link was the real cause of slow conversation opening, so activity polling went from 3 s to 30 s when idle, rebuild confirmations from 2 s to 30 s, the memory panel from 2 s to 20 s, and catalog reads are coalesced to one per 10 s with a trailing read. The single largest requester, a third-party balance widget, was disabled. Cadence is selected by state and never gated inside a timer callback.
- Add one-click installers. Windows ships NextTavern-Setup.exe (x64) and NextTavern-Setup-arm64.exe as a self-contained Go GUI with a native window, portable PowerShell 7.6.6 and Node.js 24.16.0, automatically provisioned Microsoft Visual C++ runtime, mirror-first sources with SHA-256 verification and per-file caching, shortcuts, start/stop menu entries and, new in this release, in-place upgrade from an older installation. Linux is new in 0.2.5: NextTavern-Setup.sh is a single self-contained shell script with no starting dependency beyond a POSIX shell, curl or wget, tar and a SHA-256 tool; it downloads and verifies a portable Node.js runtime itself, supports x86_64 and aarch64 (glibc) and needs no root and no system packages. Both listeners bind 127.0.0.1 only and auto-select a port in 3510-3599.
- Ship CLI 1.4.0 with native API/RPC, workspace directory upload verified against a real novel with checksums, settings, model, edit, log, resource and character-cluster operations, plus doctor.
- Strengthen interactive authoring with questions-driven creation, a twelve-item completeness check, two reference cards and status-asset preservation across import, generation and legacy restore.
- Sandbox author card JavaScript: author beauty.js runs against restricted document and window faces, registrations land on the reader root and are unconditionally reaped.
- Migrate the public-access plugin to @isund/dsh-auth-webserver 0.1.0-alpha.3.2 under strict TypeScript; the Cloudflare Access public-access guide is unchanged.
- Relicense project-owned code from MIT to GPL-3.0-only, using the verbatim official text (the SPDX identifier is not upgradeable to a later version). Bundled third-party material keeps its own terms — DeepSeek and pi MIT, the upload and anydoc forks MIT, office Apache-2.0 and the upstream-derived ask-user file MIT — and copies already distributed under MIT keep those terms. Self-owned package manifests, installer npm metadata, the public contract, README, NOTICE and the rights register were updated in the same pass.
- Tested target: Harness 0.1.2-alpha.3 and pi-ai 0.84.4. The window, notes, provenance and eviction mechanics add no runtime model request of their own: the program assembles settings, window and notes deterministically, and the main agent queries history and worldbooks on demand instead of being forced through a recall step before every turn.

No new production deployment, paid story generation, supplier latency or cache benchmark was performed for this release. The Windows installers are not code-signed and were not validated on a clean Win11 VM or a real ARM64 device; the Linux installer is new in this release and the listed distributions and architectures are the tested envelope. Synthetic embedding evaluation is not a human-labelled or long-term quality guarantee, and coarse-mode novel coverage does not guarantee understanding of every detail.

The v0.2.5 release was rebuilt twice after its first cut. That first build shipped the skin as package files only, with no profile dependency and no loader entry, so players could neither see nor enable it; the second cut fixed the packaging and the third relicensed the code. Only this final cut is published, and the two earlier builds have been taken down.

The same version was recut once more on 2026-09-26. The packaged presets had shipped the maintainer's own first section and a default aesthetic whose text aimed at producing explicit content; published packages now ship that section with an empty body, and that aesthetic reads as intimacy literature — the same section order, pacing, sensory saturation and tension, without the sentences that taught the former. Both rewrites are applied at delivery time from the maintainer's sources, so the maintainer's own repository and deployment keep the original wording.

Deleting one of your own messages no longer takes the decision card with it. 「删除这条玩家消息以及后续全部内容」 forks a branch whose seed ends at the previous turn, and that branch replays no player input — so it never published a card of its own. The status bar showed the truncation point exactly as designed while the card was missing for good: the sidebar fallback button could only flip a local flag and a reload re-read the same empty answer. A branch parked at that boundary now carries it: the card the deleted message had consumed is revived unanswered with the options the player originally saw, or rebuilt from the boundary status panel's options, and the boundary status bar is copied or rehomed to the child. The repair is program-only — no extra model request and no write to the source branch — and it records its outcome on the branch as `boundaryState`; regenerate and edited-message branches still publish their own card after their own turn. Source-only update: no new tag, Release, npm package or public-site deployment accompanies it.

## 0.1.2 Preview - 2026-09-12

- Ship the optional `@isund/dsh-auth-webserver` source, installable archive, license, contract tests and sanitized environment template for Cloudflare Access public access.
- Add explicit, fingerprint-checked and reversible compatibility for remote settings, continuous reconnect and JWT-authenticated uploads. Default local installation does not enable public access.
- Add the beginner-oriented phone/computer public-access guide, including AI-assisted deployment, obtaining scoped Cloudflare tokens and SSH keys, historical connection tuning, verification and rollback.
- Add a community-support section thanking @ljs1997sh for dsh-nexttavern-qq-mobile.
- This release is based on public 0.1.1. Concurrent internal debugging and TypeScript migration are outside this release.

## 0.1.1 Preview - 2026-09-12

- Protect author status templates at the native prompt boundary while preserving the original card source.
- Accept filled dynamic status values without losing the author's HTML/CSS/JS structure.
- Surface structured task-validation failures, failed timestamps and actionable retry diagnostics.
- Synchronize the verified official UI chat/workspace fixes included in the maintenance release.

## 2026-09-11: Documentation Updates

- Add four-step onboarding, illustrated feature descriptions and a public architecture guide with source references.
- Document existing SillyTavern / TauriTavern PNG (`chara`/`ccv3` Base64 `tEXt`) and JSON v1/v2/v3 imports, embedded worldbooks and extension boundaries.
- Add repository topics `dsh`, `character-card` and `tavern`, alongside `dsh-plugin`, `deepseek-harness` and `roleplay`.
- These updates affect repository documentation; the original v0.1.0 tag and downloadable assets retain their published hashes.

## 0.1.0 Preview - 2026-09-11

- Public packaging of the existing roleplay workspace: cards, worldbooks, narrative/style rules, worldlines, isolated memory, status, decisions, usage, pricing, exports and optional character agents.
- Existing SillyTavern / TauriTavern PNG and JSON character-card import, original-source preservation and embedded character books.
- Portable preset installer and audit-first six-unit compatibility patcher with transaction backups, rollback, update and uninstall.
- Browser source and prebuilt UI, locked builder, authorized complete reference cards, authoring/diagnosis skills, included and standalone dsh-debug CLI.
- Attributed compatibility forks for file upload/read_document, anydoc and pi-ai; optional DOCX/PDF integrations retained.
- Tested target: Harness 0.1.2-alpha.3 and pi-ai 0.84.4.

No new production deployment, paid story generation, supplier latency or cache benchmark was performed for this release. Offline native fixtures suppress model dispatch and do not prove every provider workflow.
