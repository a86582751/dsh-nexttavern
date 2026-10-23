# Changelog

## 开发记录 — Native 参考卡与创作流程对齐 — 2026-10-24

- 新增两张完整 Native 1.0 参考卡：龙女皇保留原 Markdown 全文归档；《雾港第十三声钟》组合四个作者脚本与 22 条世界书，展示值班简报 Prompt hook、互斥闲谈、持续／冷却告示及累计日志。作者教程新增完整卡片下载入口与字段导览。
- 默认 Native JSON 写卡与完成研究后的小说改编共用定稿入口；对齐 DOCX 原生导入、原始来源与当前设定导出的说明。修复新卡归档路径，以及启用作者脚本的 Native 卡未进入相应开场执行链的问题。
- 本批通过限定卡片与 Core 测试，未完成正式宿主的整卡玩法验收；0.3 尚未发布，也未部署运行服务。参见 [Native 卡格式手册](NATIVE-CARD-FORMAT.md)和[完整参考卡索引](preset/reference/README.md)。

English: Add complete Dragon Empress and Steam Tide Native reference cards, including four author scripts, 22 worldbook entries, briefing hooks, timed notices, and cumulative logs. Align authoring and novel adaptation, fix archived draft paths and Native script opening dispatch, and publish the card index. Scoped checks do not constitute full host acceptance; 0.3 remains unreleased with no runtime deployment.

## 文档 — 0.3 作者手册与官网同步 — 2026-10-24

- 将[社区卡与世界书](COMMUNITY-CARDS.md)、[原生卡创作](NATIVE-CARD-FORMAT.md)、[原生状态与分析](NATIVE-STATE.md)、[社区预设与正则](COMMUNITY-PRESETS.md)扩展为技术手册，加入完整卡片示例、字段参考、执行顺序、排错与源码入口。
- 说明 NextTavern 原生状态和分析任务如何兼容 MVU／RUBY；补充 EJS 模板、变量与世界书 API，以及世界书的条件、递归、定时、预算和插入位置。官网同步更新四篇正文、阅读路线与导航。
- 内容仍对应尚未正式发布的 0.3 开发线；文档示例的定点检查不替代完整卡玩法验收。本次更新仅发布文档站。

English: Expand the four 0.3 author guides with complete card examples, EJS APIs, worldbook controls, native state and analysis behavior, preset/regex references, troubleshooting and source links. Update the website's content and navigation. 0.3 remains in development; targeted example checks do not establish full gameplay compatibility.

## 开发记录 — 琥珀酒馆暖纸与 NT 徽记改版 — 2026-10-24

- 开发中的琥珀酒馆视觉恢复暖木与纸页、NT 徽记和日夜场景图；本地 TypeScript 构建与限定 Harness 检查已通过。Reader 作者样式和真实剧情生成未重验。
- 当前公开发行版仍不含这次改版；本文仅记录开发状态，没有发布产品包或部署生产服务。

English: The in-development Amber Tavern refresh restores warm wood and paper, an NT emblem and day/night scene art. The selected TypeScript build and scoped Harness checks passed; Reader author styles and real story generation were not rerun. This development note does not update the current release or deploy a service.

## 文档 — Native 原生卡与高级人物功能边界 — 2026-10-21

- 更新 [0.3 开发日志](DEVELOPMENT-0.3.md)，说明显式转换、原生作者卡、原件／当前设定两种导出、DOCX 来源和高级人物资料的开发进展。
- 明确部分动态规则的角色协作限制及受控验证范围；普通剧情继续读取原卡。完整玩法与分类质量仍在验证，不发布 0.3、npm 包或更新运行服务。

English: Document development progress for explicit Native conversion, authoring, original-file exports, DOCX provenance and advanced character material. Disclose partial dynamic-rule limitations and scoped validation; this documentation update does not release 0.3 or deploy a service.

## 公开文档站视觉更新 — 2026-10-20

- GitHub Pages 文档站更新日夜主题、独立轮播插画、皮肤问候语和主题章节配图，并调整首页功能卡片。减少动态效果与按需加载继续生效；本次仅更新文档站，不发布 0.3 产品版本或 npm 包。

English: Refresh the GitHub Pages documentation site with day/night themes, separate illustration carousels, skin-sourced greetings, theme-specific chapter art and an updated home-page feature grid. Reduced motion and on-demand loading remain supported. This is a site update, not a 0.3 product or npm release.

## 0.2.9-rc.4 — Issue #17 上下文容量与恢复修复 — 2026-10-19

rc.4 是 GitHub 与 npm latest，延续 rc.3 安装／就绪修复和慢模型首响应配置。

- 恢复角色扮演正常准备流程中的完整请求压力判断。首响应看门狗改为观察原生 `assistant-stream` 推理帧，推理持续输出时不再被误判为超时。
- 需要压缩时，使用独立的同模型纯文本摘要请求，并沿用已有的 16,384 token 输出预算；不再要求超限的故事请求同时承担摘要。保留失败任务、显式重试和旧 pending 恢复；普通回合不增加模型请求。
- provider 全局 256k 输出上限不变。有界摘要不保证任意大的非剧情前缀都能压缩到可用范围。

English: rc.4 restores full-request pressure handling, watches native reasoning frames, and moves compaction summaries to a separate bounded request. It preserves task failure/retry recovery, adds no model request to ordinary turns, and does not change the provider-wide output limit. Arbitrarily large non-story prefixes are not guaranteed to fit.

## 文档 — 0.3 开发日志更新 — 2026-10-17

- 补入10月8～17日复杂脚本、人物/世界书操作、原卡剧情、分支和重启恢复的限定进展，更新真实模型校准的当前阻断与下一步。
- 受控回复、离线检查与自然模型质量分别说明；完整34卡玩法、操作矩阵和性能仍未完成。0.3尚未发布，GitHub latest为0.2.9-rc.3，npm latest仍为0.2.9。

English: Update the 0.3 development log through October 17 with scoped script, UI, story and recovery results and the ongoing natural-model calibration. Full gameplay, operation coverage and performance remain incomplete; 0.3 is not released.

## 0.2.9-rc.3 — 安装与就绪修复 — 2026-10-13

GitHub latest 与当前便携安装器／归档下载路径使用 rc.3，npm latest 仍为 0.2.9。

- #12：启动和缓存判断允许 npm 生成的 `.bin/pnpm` 符号链接，继续检查其 `.bin` 目录位于本安装目录内。#13：由 `lstat` 判断文件类型，使 Android 共享文件系统上的普通硬链接仍按普通文件处理；不要求 pnpm 改为复制安装。
- #14：就绪等待默认延长至 **600 秒**，可用正整数毫秒环境变量 `NEXTTAVERN_READY_TIMEOUT_MS` 覆盖。期限到达时若进程仍存活，保留进程和回执，下一次启动可继续等待；停止操作不依赖这个环境变量。进程真实退出或初始化错误仍走现有清理流程。
- #15：启动探测使用日志中最新的登录 token，完成官方登录跳转和 cookie 鉴权后才初始化工作区；不再因旧 token 或正常的 303 响应误报未就绪。清理旧日志后也能继续等待。
- 感谢 [FuRongJun-1999](https://github.com/FuRongJun-1999) 的 PR #10：为本地慢响应模型提供可选 `firstResponseTimeoutMs`，默认仍是 **90 秒**。设置位置与完整配置保留要求见 README 的[首响应等待说明](README.md#慢速本地聊天模型的首响应等待)。覆盖值只延长现有付费请求等待，不增加请求、重试或缓存工作；成本影响限于更长的供应商执行时间。
- 本地 Linux suite 与 Windows 定点 runner 已通过；Windows 另有真实 HTTP 303-cookie-200 探测。Linux 的 tiny native metadata fixture 不是发行安装包或完整 Harness；未据此宣称真实 Linux／ARM64 设备或完整 Harness 安装通过。该批次确定性改动及 PR #10 新增运行时模型请求正常／重试／回退为 **0 / 0 / 0**。

English: 0.2.9-rc.3 addresses four installation/readiness reports (#12–#15) and adds PR #10's optional first-response wait for slow local chat models (90 seconds by default). Targeted Linux and Windows checks passed; real Linux/ARM64 device coverage remains unverified. GitHub latest and portable download links use rc.3. npm latest remains 0.2.9.

## 文档 — 0.3 开发日志更新 — 2026-10-07

- 补入 10 月 6 日 Ruby 辅助分析、原卡剧情、脚本读取与恢复流程的限定进展；完整人物／世界书交互、原卡界面、全部样本和阶段验收仍未完成，0.3 尚未发布。

English: Update the 0.3 development log with limited 2026-10-06 results for Ruby tasks, original-card story flows, script reading and recovery. Full character/worldbook interaction, original-card UI, sample coverage and phase acceptance remain incomplete; 0.3 is not released.

## 文档 — 0.3 开发日志更新 — 2026-10-06

- 补入 10 月 5 日已限定验证的原生 JSON 与小说 Markdown 导出、受控分支恢复及卡片页面联动进展；34 张真实卡完整玩法、NativeApp 资格、作者脚本、应用联动与恢复矩阵仍在开发，0.3 尚未发布。

English: Update the 0.3 development log with limited 2026-10-05 results for native JSON and novel Markdown exports, controlled branch recovery and authoring-page integration. Full gameplay across 34 real cards, NativeApp qualification, author scripts, app integration and the recovery matrix remain in development; 0.3 is not released.

## 文档 — 0.3 开发日志 — 2026-10-04

- 新增独立的 [0.3 开发日志](DEVELOPMENT-0.3.md)，用玩家能读懂的说法整理目标、近期进展和下一步；首页入口放在「反馈问题」后面，详细进度移入日志。
- 这次只更新文档。0.3 尚未发布，GitHub 最新发行版仍为 0.2.9-rc.2，npm 正式版仍为 0.2.9。

English: Add a separate [0.3 development log (Chinese)](DEVELOPMENT-0.3.md) with player-facing goals, recent progress and remaining work. This documentation update does not release 0.3 or change the current downloads.

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

## 0.3 development — 2026-09-22

- Superseded the alpha.6 execution plan after reviewing official Harness `0.1.7-alpha.1`. The new plan covers Session V4 sources/tool messages, declarative presets, profile-based settings, porting our existing UI extensions and the official pi-ai streaming fix before complete product assembly and clean-install acceptance. The five Tavern UI slots were added by our earlier patches and are absent from both clean upstream versions; they were not removed by alpha.7. Dependencies and runtime code have not yet moved to alpha.7; the entries below retain their original alpha.6 evidence limits. Downloads and production are unchanged.

- Integrated an owned preset-composition adapter with the Loader entry, reusing one official roster and preserving configured defaults and roots. Unknown roleplay presets are rejected; package-addressed composition survives the official copy operation and user copies survive uninstall. Native Agent setup exposed and fixed inherited provider-policy evaluation and writable-root alias protection. Seven preset cases and ten entry regressions are 17 unique successes across two runs (the latest run covered two new and two affected prior cases); a wrapper index strict rebuild and one new path case also passed. Full business composition, skill discovery, DOCX／office alpha.6 compatibility, dependency delivery and active-Agent switching remain unverified.

- Owned JSONL and Session Controller now wait for message-edit interpretation before activation. Product startup rejects pending dependencies, including nested addons, and restores native providers instead of reporting success. Native composition checks cover edited-history recovery, pending-input persistence, disable/re-enable and failure cleanup. The affected scopes have 42 unique passing checks; full product installation, roleplay workflows and paid Harness acceptance remain pending.

- Added a real Loader subtree entry for product-owned providers, preserving browser module identities, original configuration and disabled choices. Failed activation drains owned resources before native restoration; stale profile generations and dependency resolution outside the product are rejected. Ten focused cases and the strict four-module closure passed. The complete provider catalog, package protection, manager/market controls and full Harness acceptance remain unconnected; the subsequent preset stage is recorded above.

- Added immutable profile-generation planning for product assembly using the official alpha.6 readers. Removing the product's bundle layer preserves user disable choices, ancestor scope, configuration overlays and expressions. Two modules compile strictly and five native configuration cases pass; the subsequent Loader entry stage above uses this reader, while full manager integration remains pending.

- Migrated live business history to public observations plus an incremental event ledger, with awaited readiness, cancellation, instance isolation and shared-mount disposal. Fork ownership uses `inheritedEventCount`; cold telemetry observes restored histories without recharging inherited calls. Seven native cases, one affected Controller case and thirteen business suites passed within their recorded limits. Full roleplay Agent, browser, unified installation and lifecycle acceptance remain pending.

- Migrated owned surface replacement producers and readers to the alpha.6 `startSeq/endSeq` contract, covering compaction, context windows, card research and task retirement. Host-derived types replace duplicated loose field declarations. Four native cases verify successful/rejected/cancelled writes, JSONL replay and pricing; affected business regressions and strict compilation passed. These loaded-view tests do not prove full Agent or product compatibility; the subsequent live-history stage is recorded above.

- Rebased the owned Session Controller and browser client on alpha.6. Prepared forks reserve ownership before publication and inherit late edit metadata; ordinary forks retain native boundaries and model selection has one owner. The strict 31-module closure, browser bundle and 16 affected cases passed, including owned JSONL/meter integration and client reconnect/disposal. Full business/UI flows, formal fork sync and unified product assembly remain incomplete.

- Rebased the owned token meter on alpha.6. Required edits now reprice current context and its breakdown without changing original usage or request anchors. Seven focused cases cover JSONL replay, inherited histories, versioned caches, compaction, attachments, retries and disposal; the strict 14-module closure passed. Removed obsolete replacement accounting. Full UI/product integration remains pending; the later Controller stage above adds prepared-fork integration evidence.

- Migrated assistant/player edit writes to required edit events with native durability barriers and versioned effect receipts. Original message anchors and usage stay unchanged; shared branches converge after partial failure, cold activation and restart. Nine native Agent/JSONL cases plus existing business smoke and fork-completion regressions passed. Retired alpha.3 replacement-repair code; UI, metering, real storage-domain crash recovery and full installation remain pending.

- Routed story windows, recall, note provenance and cold retrieval through native edited-message projections. Novel snapshots now follow edits; stale exports and summaries cannot commit old prose. Seven native reader cases and five affected regression suites passed. UI/meter integration and full product lifecycle remain unfinished; server edit writes are covered above.

- Implemented a versioned required message-edit format and an owned alpha.6 JSONL provider. Six focused checks cover plain/compressed storage, verification workers, cold observation, native Agent resume and rejection before invalid writes; original message identities and usage remain unchanged. Product routing, metering/UI integration, safe disable/uninstall and formal fork synchronization remain pending. Removed residual file-upload assembly and sidebar injection from the actual public build inputs.

- The migration now targets Harness **0.1.6-alpha.2** and intentionally drops old session-data compatibility. Export character cards or novels in the old environment before migration. Downloads and production remain on 0.2.5; current main is unfinished development source.
- Retired community file-upload/read_document and better-sidebar from the next-generation plan. Official upload, attachments and sidebar replace them. The [owned anydoc fork](https://github.com/a86582751/dsh-plugin-anydoc/commit/379872b6fc69814d5e974351b3f848a7522521ad) now reads through native filesystem capabilities, supports explicit document windows and full-file conversion, and has bounded version-aware caching. Full native upload integration remains pending.
- Replaced the owned session-projection candidate with the validated official implementation. Removed the abandoned private market candidate; an existing upstream market is reused, and a missing market will be installed only for skins.
- Rebased the [minimal pi-ai fork](https://github.com/a86582751/pi/commit/0b1dd4fe31baf343f4a592551056215ca6a12629) on the host's pinned **0.85.1**, retaining four terminal-protocol changes. The alpha.6 adapter owns cancellation, consumer-stop and idle-timeout cleanup. Gemini relay addresses and Bearer headers use configuration. SDK protocol cases and the four-protocol host cleanup matrix passed locally; complete product installation is not yet validated.
- Native multi-provider tests expose an HMR removal limitation: reported success need not mean every original provider recovered. Product controls refuse that hot path before saving changes; cold changes require a restart. The final management workflow, remaining core/UI migrations and clean-install/full Harness acceptance are unfinished.
- Native edit checks found another migration boundary: alpha.6 rejects the previous assistant-message replacement protocol. Public message projections can preserve original model records while editing derived text, but metering and cold-reader integration are still required. Four focused checks characterize these limits; edited-story support is not yet accepted.

Earlier dated entries describe their historical snapshots and are superseded by this migration direction. No new tag, Release, npm package or production deployment accompanies this source update.

## 0.3 development — 2026-09-21

- Added `development/llm-pi-ai/`, an unpublished adapter candidate for the existing `0.1.2-alpha.3` host. Ordinary, roleplay and headless requests use one maintained pi-ai SDK, while request snapshots, credentials, settings-conflict recovery and native DeepSeek routes retain their boundaries. The candidate removes the previous session-mode transport split. It is not yet connected to the product; dependency assembly, formal-fork synchronization and complete lifecycle acceptance remain open.

- Added the unpublished owned projection candidate under `development/session-projection/`. It preserves inherited-prefix metadata and avoids historical scans on caught-up reads with either public history API. Package-only strict checks cover current and newer host declarations; ten focused maintenance telemetry cases are covered. The newer-host investigation is reference only: no host upgrade is planned or required by the current task. Implementation remains on `0.1.2-alpha.3`. This candidate is not wired into the product.

- Added fixed-package preparation and a bundled-runtime bootstrap candidate. Independently named private dependencies are verified before loading, share host peers and prepare versioned file references without running pnpm inside the loading host. Ten preparation cases, the existing transaction regression and a real npm/pnpm bootstrap lifecycle case passed locally. The latter covers later skin installation, root upgrade, relinking and retained inactive libraries on root removal. Alpha.3 CLI lacks the cooperative profile lock, so automatic startup wiring and complete target-host acceptance remain pending; this is not a complete one-command product installer.

- Added an explicit offline npm/pnpm packaging test with three synthetic-package cases: tarball-relative `file:` fails as a portable dependency; bundled children survive unrelated installs, forced relinking and explicit downgrade; existing external fixed-package references retain their hashes, shared peer and lock resolution. These are packaging mechanism checks, not full DSH installation or failed-upgrade rollback acceptance. The test requires existing npm/pnpm JavaScript CLI paths and does not install Harness.

- Added the independently named, unpublished [dsh-nexttavern-anydoc candidate](https://github.com/a86582751/dsh-plugin-anydoc/commit/547bd617407abcf60fa50404b6a27978bc31abce) in `development/anydoc/`, with original attribution and maintained TypeScript instead of replaying edits onto installed files. Two focused maintenance checks cover real CSV conversion, normalized output, exclusive file-write scheduling, a single roleplay tool schema and cleanup preserving a simulated user tool. It is not yet connected to the product entry or preset. File-upload and pi-ai fork identity work remains open. The market now has a smaller role: reuse an existing upstream installation, or install it only when absent, to open skins. A custom market fork is no longer planned as a required dependency; product controls belong to NextTavern itself. Compatibility package protection must also survive later unrelated skin installations and plugin upgrades.

- Public repository updates resume alongside maintenance development. Repository commits are development snapshots; the latest downloadable release remains 0.2.5. No 0.3 tag, release assets or npm publication accompanies this code sync.
- The source-layout, module-cohesion and scoped validation work below is ready for contributor review. The next milestone is one complete NextTavern plugin entry with reliable install, enable/disable, upgrade and uninstall behavior.
- Controller, usage/projection and pi-ai compatibility implementations have focused maintenance tests, but are not yet wired into this public package. UI migration, roleplay-only third-party ownership, remaining fork synchronization, dependency protection and full fresh-install/migration testing remain open. The single-command installation goal is not yet a supported 0.3 installation path.
- Six pi-ai protocol source files are now committed in the [attributed compatibility fork](https://github.com/a86582751/pi/commit/a6d1032396fb2baf64edc6db9b871a79ae18996c), preserving upstream history and MIT attribution. Their committed bytes match the locally tested candidate; the fork records exact source hashes. This source update does not publish a package or change the 0.2.5 downloads. Historical byte patches must not be reapplied to builds from these updated fork sources.
- Published DSH `0.1.6-alpha.2` profile APIs are being assessed for unified plugin lifecycle support. Five library checks cover configuration layers and reloads; two manager checks show that rejected activation can leave its selection on disk. The [market compatibility fork](https://github.com/a86582751/dsh-market/commit/00d53a9e1169f24f741bc40bc5a0a10db3ecffb7) connects product controls and now builds with an owned package/browser identity. Complete host/client types, package preflight and two artifact/HTTP checks passed, including refusal to uninstall a preexisting upstream market as itself. The locally packed candidate is unpublished. This custom-market experiment is now historical and is not a required product dependency; immutable release assembly, host-page acceptance, install/upgrade/uninstall and full-host compatibility remain open. Supported versions, runtime locks and the 0.2.5 downloads are unchanged.
- `provenance.json` describes the last built package snapshot; later repository commits may update source or documentation. Release provenance and installation assets will be regenerated together for the completed release.

## 0.3.0-rc.1 - unpublished layout candidate

- Separate maintained TS/MTS in `src/` from generated JS/MJS in `lib/`, including the Auth and skin packages. Ship the complete strict-build source closure and a generated `tools/build-map.json`; see [Contributing](CONTRIBUTING.md).
- Keep the package name, root and `./client` exports, host injection, and the three `tools/install.mjs`, `tools/patch-harness.mjs`, `tools/public-access.mjs` commands. These commands forward to one implementation in `lib/operations`; retirement requires a separately announced breaking CLI version.
- Internal deep paths change: `src/**/*.js` moves to the corresponding `lib/` tree; preset core and memory modules move to `preset/lib/core` and `preset/lib/memory`; Auth `index.js` moves to `lib/index.js`; the embedding dependency template moves from `src/memory/embedding-runtime` to `memory/embedding-runtime`. Consumers that bypass package exports must update their paths. Controlled Cordis paths are updated without changing plugin IDs or configuration semantics.
- Preserve persistent schemas, append-only provenance and failure recovery. Upgrades remove obsolete receipt-owned files, reject edited managed files and preserve user-owned material. Cohesion and readability improvements separate record, presentation and lifecycle responsibilities without changing those behavior contracts.
- This candidate's source is shared for development; its installation archives are not released. Existing installer links still describe the published 0.2.5 assets; candidate installers are bound to their own payload digest. Building Windows ARM64 and Linux artifacts does not establish real-device installation coverage.

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
