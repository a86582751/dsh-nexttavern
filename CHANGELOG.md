# Changelog

按日期倒序，同日按主题合并。**开发源码、文档发布与产品发行分别标明**；旧条目中的版本、计划和验证范围均指当日状态，不能作为当前支持承诺。0.3 仍在开发，当前详情见 [0.3 开发日志](DEVELOPMENT-0.3.md)。

本页合并重复流水，保留用户可见变化、迁移要求和验证限制。完整清理前记录见 [2026-10-24 历史快照](https://github.com/a86582751/dsh-nexttavern/blob/d84a35c41189846faaca5643a88a1949fcff776d/CHANGELOG.md)，可追溯原始测试数字、失败记录和候选演变。

## 2026-10-24

### 开发记录 — Native 参考卡与创作流程对齐

- 新增两张完整 Native 1.0 参考卡：龙女皇保留原 Markdown 全文归档；《雾港第十三声钟》组合四个作者脚本与 22 条世界书，展示值班简报 Prompt hook、互斥闲谈、持续／冷却告示及累计日志。作者教程新增完整卡片下载入口与字段导览。
- 默认 Native JSON 写卡与完成研究后的小说改编共用定稿入口；对齐 DOCX 原生导入、原始来源与当前设定导出的说明。修复新卡归档路径，以及启用作者脚本的 Native 卡未进入相应开场执行链的问题。
- 本批通过限定卡片与 Core 测试，未完成正式宿主的整卡玩法验收；0.3 尚未发布，也未部署运行服务。参见 [Native 卡格式手册](NATIVE-CARD-FORMAT.md)和[完整参考卡索引](preset/reference/README.md)。

English: Add complete Dragon Empress and Steam Tide Native reference cards, including four author scripts, 22 worldbook entries, briefing hooks, timed notices, and cumulative logs. Align authoring and novel adaptation, fix archived draft paths and Native script opening dispatch, and publish the card index. Scoped checks do not constitute full host acceptance; 0.3 remains unreleased with no runtime deployment.

### 文档 — 0.3 作者手册与官网同步

- 将[社区卡与世界书](COMMUNITY-CARDS.md)、[原生卡创作](NATIVE-CARD-FORMAT.md)、[原生状态与分析](NATIVE-STATE.md)、[社区预设与正则](COMMUNITY-PRESETS.md)扩展为技术手册，加入完整卡片示例、字段参考、执行顺序、排错与源码入口。
- 说明 NextTavern 原生状态和分析任务如何兼容 MVU／RUBY；补充 EJS 模板、变量与世界书 API，以及世界书的条件、递归、定时、预算和插入位置。官网同步更新四篇正文、阅读路线与导航。
- 内容仍对应尚未正式发布的 0.3 开发线；文档示例的定点检查不替代完整卡玩法验收。本次更新仅发布文档站。

English: Expand the four 0.3 author guides with complete card examples, EJS APIs, worldbook controls, native state and analysis behavior, preset/regex references, troubleshooting and source links. Update the website's content and navigation. 0.3 remains in development; targeted example checks do not establish full gameplay compatibility.

### 开发记录 — 琥珀酒馆暖纸与 NT 徽记改版

- 开发中的琥珀酒馆视觉恢复暖木与纸页、NT 徽记和日夜场景图；本地 TypeScript 构建与限定 Harness 检查已通过。Reader 作者样式和真实剧情生成未重验。
- 当前公开发行版仍不含这次改版；本文仅记录开发状态，没有发布产品包或部署生产服务。

English: The in-development Amber Tavern refresh restores warm wood and paper, an NT emblem and day/night scene art. The selected TypeScript build and scoped Harness checks passed; Reader author styles and real story generation were not rerun. This development note does not update the current release or deploy a service.

## 2026-10-21

### 开发源码与文档 — 三线整合及 Native 功能边界

- 合并社区预设／正则、上下文优化与 Issue #17 请求恢复三条开发线：预设和显示变换进入统一流程，请求材料与预算由对应模块集中管理，摘要和 checkpoint 共享失败／重试恢复合同。保留社区线 31 个提交、上下文线 5 个提交及 Issue #17 两组适配，公开源码交付见 [6353d4c](https://github.com/a86582751/dsh-nexttavern/commit/6353d4c8)。
- 原定三线合并已完成；Source verify 的失败记录保留，后续定点成功和文档检查不代表整体通过。后续主线开发及 P1–P6 完成门仍未结束，本批没有安装、运行部署或产品发布。
- 更新 [0.3 开发日志](DEVELOPMENT-0.3.md)，说明显式转换、原生作者卡、原件／当前设定两种导出、DOCX 来源和高级人物资料的开发进展。
- 明确部分动态规则的角色协作限制及受控验证范围；普通剧情继续读取原卡。完整玩法与分类质量仍在验证，不发布 0.3、npm 包或更新运行服务。

English: Document development progress for explicit Native conversion, authoring, original-file exports, DOCX provenance and advanced character material. Disclose partial dynamic-rule limitations and scoped validation; this documentation update does not release 0.3 or deploy a service.

## 2026-10-20

### 公开文档站视觉更新

- GitHub Pages 文档站更新日夜主题、独立轮播插画、皮肤问候语和主题章节配图，并调整首页功能卡片。减少动态效果与按需加载继续生效；本次仅更新文档站，不发布 0.3 产品版本或 npm 包。

English: Refresh the GitHub Pages documentation site with day/night themes, separate illustration carousels, skin-sourced greetings, theme-specific chapter art and an updated home-page feature grid. Reduced motion and on-demand loading remain supported. This is a site update, not a 0.3 product or npm release.

## 2026-10-19

### 0.2.9-rc.4 — Issue #17 上下文容量与恢复修复

rc.4 是 GitHub 与 npm latest，延续 rc.3 安装／就绪修复和慢模型首响应配置。

- 恢复角色扮演正常准备流程中的完整请求压力判断。首响应看门狗改为观察原生 `assistant-stream` 推理帧，推理持续输出时不再被误判为超时。
- 需要压缩时，使用独立的同模型纯文本摘要请求，并沿用已有的 16,384 token 输出预算；不再要求超限的故事请求同时承担摘要。保留失败任务、显式重试和旧 pending 恢复；普通回合不增加模型请求。
- provider 全局 256k 输出上限不变。有界摘要不保证任意大的非剧情前缀都能压缩到可用范围。

English: rc.4 restores full-request pressure handling, watches native reasoning frames, and moves compaction summaries to a separate bounded request. It preserves task failure/retry recovery, adds no model request to ordinary turns, and does not change the provider-wide output limit. Arbitrarily large non-story prefixes are not guaranteed to fit.

## 2026-10-17

### 文档 — 0.3 开发日志更新

- 补入10月8～17日复杂脚本、人物/世界书操作、原卡剧情、分支和重启恢复的限定进展，更新真实模型校准的当前阻断与下一步。
- 受控回复、离线检查与自然模型质量分别说明；完整34卡玩法、操作矩阵和性能仍未完成。0.3尚未发布，GitHub latest为0.2.9-rc.3，npm latest仍为0.2.9。

English: Update the 0.3 development log through October 17 with scoped script, UI, story and recovery results and the ongoing natural-model calibration. Full gameplay, operation coverage and performance remain incomplete; 0.3 is not released.

## 2026-10-13

### 0.2.9-rc.3 — 安装与就绪修复

GitHub latest 与当前便携安装器／归档下载路径使用 rc.3，npm latest 仍为 0.2.9。

- #12：启动和缓存判断允许 npm 生成的 `.bin/pnpm` 符号链接，继续检查其 `.bin` 目录位于本安装目录内。#13：由 `lstat` 判断文件类型，使 Android 共享文件系统上的普通硬链接仍按普通文件处理；不要求 pnpm 改为复制安装。
- #14：就绪等待默认延长至 **600 秒**，可用正整数毫秒环境变量 `NEXTTAVERN_READY_TIMEOUT_MS` 覆盖。期限到达时若进程仍存活，保留进程和回执，下一次启动可继续等待；停止操作不依赖这个环境变量。进程真实退出或初始化错误仍走现有清理流程。
- #15：启动探测使用日志中最新的登录 token，完成官方登录跳转和 cookie 鉴权后才初始化工作区；不再因旧 token 或正常的 303 响应误报未就绪。清理旧日志后也能继续等待。
- 感谢 [FuRongJun-1999](https://github.com/FuRongJun-1999) 的 PR #10：为本地慢响应模型提供可选 `firstResponseTimeoutMs`，默认仍是 **90 秒**。设置位置与完整配置保留要求见 README 的[首响应等待说明](README.md#慢速本地聊天模型的首响应等待)。覆盖值只延长现有付费请求等待，不增加请求、重试或缓存工作；成本影响限于更长的供应商执行时间。
- 本地 Linux suite 与 Windows 定点 runner 已通过；Windows 另有真实 HTTP 303-cookie-200 探测。Linux 的 tiny native metadata fixture 不是发行安装包或完整 Harness；未据此宣称真实 Linux／ARM64 设备或完整 Harness 安装通过。该批次确定性改动及 PR #10 新增运行时模型请求正常／重试／回退为 **0 / 0 / 0**。

English: 0.2.9-rc.3 addresses four installation/readiness reports (#12–#15) and adds PR #10's optional first-response wait for slow local chat models (90 seconds by default). Targeted Linux and Windows checks passed; real Linux/ARM64 device coverage remains unverified. GitHub latest and portable download links use rc.3. npm latest remains 0.2.9.

## 2026-10-07

### 文档 — 0.3 开发日志更新

- 补入 10 月 6 日 Ruby 辅助分析、原卡剧情、脚本读取与恢复流程的限定进展；完整人物／世界书交互、原卡界面、全部样本和阶段验收仍未完成，0.3 尚未发布。

English: Update the 0.3 development log with limited 2026-10-06 results for Ruby tasks, original-card story flows, script reading and recovery. Full character/worldbook interaction, original-card UI, sample coverage and phase acceptance remain incomplete; 0.3 is not released.

## 2026-10-06

### 文档 — 0.3 开发日志更新

- 补入 10 月 5 日已限定验证的原生 JSON 与小说 Markdown 导出、受控分支恢复及卡片页面联动进展；34 张真实卡完整玩法、NativeApp 资格、作者脚本、应用联动与恢复矩阵仍在开发，0.3 尚未发布。

English: Update the 0.3 development log with limited 2026-10-05 results for native JSON and novel Markdown exports, controlled branch recovery and authoring-page integration. Full gameplay across 34 real cards, NativeApp qualification, author scripts, app integration and the recovery matrix remain in development; 0.3 is not released.

## 2026-10-04

### 文档 — 0.3 开发日志

- 新增独立的 [0.3 开发日志](DEVELOPMENT-0.3.md)，用玩家能读懂的说法整理目标、近期进展和下一步；首页入口放在「反馈问题」后面，详细进度移入日志。
- 这次只更新文档。0.3 尚未发布，GitHub 最新发行版仍为 0.2.9-rc.2，npm 正式版仍为 0.2.9。

English: Add a separate [0.3 development log (Chinese)](DEVELOPMENT-0.3.md) with player-facing goals, recent progress and remaining work. This documentation update does not release 0.3 or change the current downloads.

## 2026-10-03

### 0.2.9-rc.2 — 便携包管理器修复与下载切换

- 修复 Windows 全新便携安装找不到 pnpm：随包锁定私有 pnpm，为官方安装及后续进程传递 PATH；缓存回执存在但命令丢失时，重试补齐依赖。Linux 沿用相同包管理器，核对中文／空格路径的真实参数。
- 将已核验的 rc.2 设为 GitHub latest，统一官网与安装器／归档下载链接，#5 按修复关闭；npm latest 当时仍为 0.2.9。切换下载链接不重制原 tag、资产或哈希。
- 保持 0.2.9 业务功能及 Harness 0.1.7-rc.2/web 支持范围。新安装器使用新的可写目录，不扩大跨版本原地升级承诺；第三方市场皮肤持久化问题沿用 [#7](https://github.com/a86582751/dsh-nexttavern/issues/7) 的说明和绕法。

English: Bundle private pnpm, repair missing-command retries and switch GitHub downloads to rc.2. npm latest remained 0.2.9; the host support and fresh-directory installation boundaries are unchanged.

## 2026-10-02

### 0.2.9 — Distribution & Installation Fix

基于 0.2.8 的安装分发补丁，角色扮演业务功能和兼容范围保持不变：Harness **0.1.7-rc.2**／**web**／Session V4，pi-ai **0.85.1**。0.3 的 MVU、EJS、RUBY 与更完整社区卡前端兼容继续开发。

- 明确正式 npm 包名 **`dsh-nexttavern`**，使用 `dsh plugin --profile web add dsh-nexttavern` 或 [v0.2.9 Release](https://github.com/a86582751/dsh-nexttavern/releases/tag/v0.2.9) 的已校验归档安装。部分 Hub／市场找不到 npm 来源会回退 Git，第三方 catalog 仍待同步；本版未承诺 Git 源码直装或 DSH 0.2／desktop 兼容。
- 预置 `@google/genai` **1.52.0**、`protobufjs` **7.6.6** 的完整锁定运行依赖闭包，保留嵌套路径、许可证与逐文件校验。补齐私有 pi-ai SDK 的 bundle／依赖声明，使首次安装及固定目录重新链接无需这些依赖的安装脚本；持久化组件声明并携带 `koffi` 预构建 bundle。
- 改善 npm 发现元数据：9 个相关关键词、官网、问题反馈及标准 Git 仓库地址；通过官方 `locale/*` 导出机制提供英文／简体中文的 `NextTavern` 标题和说明。元数据改善不代表第三方市场登记已经完成。
- 更新官网、中英文说明与四平台安装入口。0.2.8 → 0.2.9 使用现有官方插件更新流程；从 0.2.5 旧宿主线迁移仍需先导出并使用新目录，便携安装器沿用现有恢复边界。

本轮验证覆盖空脚本许可下的真实首次安装、固定目录重新链接、冻结锁重装、Google SDK 导入和 protobuf 编解码；严格 TypeScript 与生成一致性检查通过。不扩大纯净 VM、Linux 或 ARM64 真机覆盖，新增运行时模型请求为 0。

English: Installation/distribution fixes bundle pinned SDK dependencies and improve package discovery. First installation, relinking and SDK checks passed within the existing host/device scope; no runtime model request was added.

## 2026-10-01

### 0.2.8

**迁移边界：** 宿主升级为 Harness **0.1.7-rc.2 / Session V4**，pi-ai **0.85.1**。旧会话不能直接续用；请先导出卡片或小说，再使用新的 home/workspace，并保留旧安装和备份。小说导出不包含完整会话状态。MVU、EJS、RUBY 和更广泛社区卡兼容继续留在 0.3 开发线。

- 统一插件安装入口 `dsh plugin --profile web add dsh-nexttavern`，安装器共用官方插件管理器；整合兼容组件、anydoc 和默认关闭的琥珀皮肤。启停、失败恢复、升级与卸载保留用户资料和配置。复用已有上游市场，仅在缺失时安装，不再要求自定义市场或 1.39.0 固定版本。
- 迁移原生 Session V4 消息、预设、快捷键、附件与侧栏；官方上传替代旧 file-upload/read_document，官方侧栏替代 better-sidebar。anydoc 支持 TXT/CSV/DOCX 的窗口读取和完整 Markdown 转换，不再要求 Office，也不承诺通用 PDF/OCR 支持。
- 修复世界线创建归属、持久消息编辑与冷恢复；记忆、状态、召回及小说快照跟随编辑，旧导出在来源变化后需重建。删除玩家消息及后续内容时，恢复保留边界的未回答决策卡与状态，重载后仍有效，不增加模型请求。
- 记忆使用硬窗口、衔接尾部、导演笔记、完整 checkpoint 和按需历史召回；修复切模型／重建队列清空旧向量的问题。退休自动归档压缩，保留 archiveTokens 高级兼容参数。保留原始请求用量，编辑只重算当前上下文；缺失用量或价格仍显示未知。
- 修复聊天进程区溢出与设置命名空间桥接，恢复多供应商配置读写和失败时的原生供应商。保留冻结卡片／小说来源、导出完整性约束及原件下载；会话日志上传默认关闭，沿用宿主鉴权与四协议终止清理。
- 发布 dsh-debug **1.6.0**，支持本地目标及显式远程连接配置，拒绝远程上传。完成 TypeScript src/lib 分离、构建映射与模块职责整理；公开导出及三个既有 CLI 入口保留，内部深路径发生迁移。
- 更新官网、安装、迁移与卸载指南；继续沿用 9 月 26 日公开预设措辞调整。这些安装和恢复改动不新增运行时模型审查请求，剧情及后台任务保留自身计费行为。

**验证与已知限制：** 完整付费业务验收使用 alpha.1 候选；后续 rc.2 仅完成源码／最小检查及实际本地、服务器安装，未重跑完整付费套件。安装器未证明纯净 Win11 VM、Linux 或 ARM64 真机覆盖，Windows 未签名。完整小说导出会直接新建子会话，缺失冻结内容时保留 checkpoint 并拒绝不完整成品；打开会话可能恢复付费后台维护。导演笔记覆盖不完整时阻止窗口推进，已记录的零模型维护回合反复排队问题在本版未声称修复。

English: Unified installation and Session V4 migration, durable edits and branch recovery, memory/usage fixes, native uploads and sidebar, and dsh-debug 1.6.0. Use a fresh workspace after exporting old content. Full paid acceptance was on alpha.1, not rerun on rc.2; device coverage and the recorded maintenance retry issue remain limited.

## 2026-09-26

### Documentation site

- 上线由仓库 Markdown 构建的[文档站](https://a86582751.github.io/dsh-nexttavern/)，提供分组导航、页内目录、日夜主题、离线搜索、图片查看与代码复制；首页使用琥珀皮肤问候语、品牌画和轮播插图。
- 同日重新切制 v0.2.5：公开包预设第一节正文留空，默认美学调整为亲密文学措辞。这是交付时转换，维护源与原部署保留原文。
- 官网更新本身不改变产品包或生产服务；上述同日预设重切另行记录，避免混为一次文档部署。

English: Launch the Markdown-driven documentation site. A separate same-day v0.2.5 recut updates the public preset wording; source/deployment wording is unchanged.

## 2026-09-22

### 0.3 development

- 历史开发快照：围绕 alpha.6 完成消息编辑事件与 JSONL 持久化、编辑后记忆／小说来源、上下文计量、Session Controller、增量事件账本、Loader 和预设组合的分段迁移；各项有定点证据，完整产品安装与业务验收当时仍未完成。
- 官方附件和侧栏替代旧社区实现；anydoc 改用原生文件能力，最小 pi-ai 兼容分支升级至 0.85.1 并保留四协议终止清理。放弃自有 session-projection 和私有市场候选，沿用官方实现与上游市场。
- 当日后续评估 Harness 0.1.7-alpha.1 后替换 alpha.6 执行计划，转向 Session V4；旧会话兼容不再保留，迁移前需导出。此条保留当时的计划演变，不代表当日已完成升级或发布；后续交付见 10 月 1 日 0.2.8。

English: Historical staged migration of edits, persistence, metering, Loader and presets, followed by a move toward Session V4. Scoped tests did not establish complete product acceptance; later delivery is recorded under 0.2.8.

## 2026-09-21

### 0.3 development

- 恢复公开开发源码同步，整理 TypeScript 布局、模块职责、固定组件准备与 npm/pnpm 打包机制；新增尚未接入产品的 pi-ai、anydoc 与会话投影候选。
- pi-ai 兼容源码保留上游历史与 MIT 归属；市场分支曾验证自有控制入口，随后放弃作为必需依赖，改为复用上游市场。profile API、启动协作锁与完整生命周期当时仍待整合。
- 此为当时基于 0.1.2-alpha.3 的开发快照，后被 9 月 22 日迁移方向及 0.2.8 发布取代。没有随源码同步发布 0.3；局部打包测试不代表一条命令安装和完整宿主验收通过。

English: Development-source sync and scoped packaging/provider candidates. These historical candidates were not a complete installer and were later superseded by the Session V4 migration.

## 2026-09-16

### 0.2.5 Preview

- 重构长篇记忆：冻结设定前缀、保留衔接尾部的硬窗口、带来源和世界线锚点的后台导演笔记，以及按需关键词／语义／混合召回。修复旧维护任务无法回收、旧笔记和状态无限累积的问题；研究结果按对应 checkpoint 回收。
- 新增 Embedding 管理页，支持在线供应商和本地 BGE、Qwen3、Jina、Nomic 模型，含下载进度、暂停／恢复与自检。向量按模型配方标识失效，查询按世界线过滤；重建和清理保留正文、来源及账本。
- 新增预设页、16 种内置文风、200 个自定义名额，以及系统美学／融合卡片／仅卡片三种模式；支持会话及全局作用域。增加长文本转卡的分段精读与粗读检索，冻结 TXT 来源并独立建立小说索引；粗读不保证理解所有细节。
- 支持人物模型覆盖、问答式创作和完整度检查；修复草稿丢失、过期资源／导出回复及重复任务操作。决策建议统一进入可折叠、可拖动的独立卡片，保留作者状态 HTML/CSS，并限制作者脚本的页面访问与生命周期。
- 首发自有琥珀皮肤及日夜／阅读器主题，默认关闭；当时由 dshmarket 1.39.0 管理开关。完成 TypeScript 迁移，减少会话深拷贝和空闲轮询；相关测量是当时样本，不是延迟保证。
- 新增 Windows x64/arm64 与 Linux x86_64/aarch64 便携安装器，下载校验、缓存及本地端口选择统一处理；发布 CLI 1.4.0 和严格 TypeScript 的可选公开访问组件。测试目标为 Harness **0.1.2-alpha.3**、pi-ai **0.84.4**。
- 自有代码改为 **GPL-3.0-only**；第三方保留原许可，已按 MIT 分发的副本仍适用 MIT。首次打包遗漏皮肤 Loader，随后修复并再切许可；仅最终修订包保留公开，早期两版撤下。

**验证边界：** 本批没有新生产部署、付费剧情或供应商缓存基准。Windows 安装器未签名，未完成纯净 Win11 VM 或 ARM64 真机验证；Linux 发行版／架构仍受当时测试范围限制。合成 Embedding 评估不代表长期人工质量；程序窗口和来源处理不自行新增模型请求。

English: Memory and embedding management, presets and novel research, authoring improvements, Amber skin, TypeScript migration, portable installers and CLI 1.4.0. Owned code moves to GPL-3.0-only while prior MIT copies and third-party terms remain intact. Historical host and validation limits apply.

## 2026-09-12

### 0.1.2 Preview

- Ship the optional `@isund/dsh-auth-webserver` source, installable archive, license, contract tests and sanitized environment template for Cloudflare Access public access.
- Add explicit, fingerprint-checked and reversible compatibility for remote settings, continuous reconnect and JWT-authenticated uploads. Default local installation does not enable public access.
- Add the beginner-oriented phone/computer public-access guide, including AI-assisted deployment, obtaining scoped Cloudflare tokens and SSH keys, historical connection tuning, verification and rollback.
- Add a community-support section thanking @ljs1997sh for dsh-nexttavern-qq-mobile.
- This release is based on public 0.1.1. Concurrent internal debugging and TypeScript migration are outside this release.

### 0.1.1 Preview

- Protect author status templates at the native prompt boundary while preserving the original card source.
- Accept filled dynamic status values without losing the author's HTML/CSS/JS structure.
- Surface structured task-validation failures, failed timestamps and actionable retry diagnostics.
- Synchronize the verified official UI chat/workspace fixes included in the maintenance release.

## 2026-09-11

### Documentation Updates

- Add four-step onboarding, illustrated feature descriptions and a public architecture guide with source references.
- Document existing SillyTavern / TauriTavern PNG (`chara`/`ccv3` Base64 `tEXt`) and JSON v1/v2/v3 imports, embedded worldbooks and extension boundaries.
- Add repository topics `dsh`, `character-card` and `tavern`, alongside `dsh-plugin`, `deepseek-harness` and `roleplay`.
- These updates affect repository documentation; the original v0.1.0 tag and downloadable assets retain their published hashes.

### 0.1.0 Preview

- Public packaging of the existing roleplay workspace: cards, worldbooks, narrative/style rules, worldlines, isolated memory, status, decisions, usage, pricing, exports and optional character agents.
- Existing SillyTavern / TauriTavern PNG and JSON character-card import, original-source preservation and embedded character books.
- Portable preset installer and audit-first six-unit compatibility patcher with transaction backups, rollback, update and uninstall.
- Browser source and prebuilt UI, locked builder, authorized complete reference cards, authoring/diagnosis skills, included and standalone dsh-debug CLI.
- Attributed compatibility forks for file upload/read_document, anydoc and pi-ai; optional DOCX/PDF integrations retained.
- Tested target: Harness 0.1.2-alpha.3 and pi-ai 0.84.4.

No new production deployment, paid story generation, supplier latency or cache benchmark was performed for this release. Offline native fixtures suppress model dispatch and do not prove every provider workflow.

## 未标日期的历史候选

### 0.3.0-rc.1 - unpublished layout candidate

原记录没有日期，保留为历史候选，不推定其发布时间。后续正式布局与安装交付见 2026-10-01。

- Separate maintained TS/MTS in `src/` from generated JS/MJS in `lib/`, including the Auth and skin packages. Ship the complete strict-build source closure and a generated `tools/build-map.json`; see [Contributing](CONTRIBUTING.md).
- Keep the package name, root and `./client` exports, host injection, and the three `tools/install.mjs`, `tools/patch-harness.mjs`, `tools/public-access.mjs` commands. These commands forward to one implementation in `lib/operations`; retirement requires a separately announced breaking CLI version.
- Internal deep paths change: `src/**/*.js` moves to the corresponding `lib/` tree; preset core and memory modules move to `preset/lib/core` and `preset/lib/memory`; Auth `index.js` moves to `lib/index.js`; the embedding dependency template moves from `src/memory/embedding-runtime` to `memory/embedding-runtime`. Consumers that bypass package exports must update their paths. Controlled Cordis paths are updated without changing plugin IDs or configuration semantics.
- Preserve persistent schemas, append-only provenance and failure recovery. Upgrades remove obsolete receipt-owned files, reject edited managed files and preserve user-owned material. Cohesion and readability improvements separate record, presentation and lifecycle responsibilities without changing those behavior contracts.
- This candidate's source is shared for development; its installation archives are not released. Existing installer links still describe the published 0.2.5 assets; candidate installers are bound to their own payload digest. Building Windows ARM64 and Linux artifacts does not establish real-device installation coverage.
