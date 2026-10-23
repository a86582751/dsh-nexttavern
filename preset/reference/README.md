# Native 1.0 参考卡

本目录提供两张 Native 1.0 直接创作示例，供交互写卡 AI 与社区作者参考。龙女皇卡展示如何保留既有 Markdown 原文并映射到可用字段；Steam Tide 卡展示如何组织 Native 数值、世界书、EJS、Ruby、作者前端、值班简报 Prompt hook 与结构化日志。

| 文件 | 用途 |
| --- | --- |
| [`dragon-empress.native.json`](dragon-empress.native.json) | 原文保真与分段映射示例 |
| [`steam-tide.native.json`](steam-tide.native.json) | Native 功能组合与作者体验示例 |
| [`模块化卡格式示例-暴躁龙女皇.md`](模块化卡格式示例-暴躁龙女皇.md) | 保留的龙女皇原文与历史参考 |
| [`steam-tide-full-card.md`](steam-tide-full-card.md) | 保留的 Steam Tide 原文与历史参考 |

两份旧 MD 继续留在原路径，本批不改写它们。直接创作流程与字段约定见[写卡技能入口](https://github.com/a86582751/dsh-nexttavern/blob/main/preset/skills/roleplay-card-authoring/SKILL.md)。示例遵循 Native 1.0；它们是作者参考，不表示 0.3 已通过整体验收或发行。

## 龙女皇：原文归档与字段映射

这张卡让作者可以追溯原始 Markdown，同时在 Native 卡中演示数据、世界书、可选 Ruby 分析与只读展示：

- `/archive/referenceSource` 保存源文件名、字节编码、Base64 原文、字节长度和 SHA-256；原文没有被改写。`/archive/referenceSource/ranges` 保存逐段映射。每项的 `pointer` 指向卡内承载文字的字段，`kind: "primary"` 范围覆盖完整原文，`kind: "reference"` 范围标出引用内容；行号、UTF-16 与字节偏移用于定位对应片段。
- `/data/authorNotes/originalActionAndModelAdvice` 单独保存原稿中的行动与模型建议；`/data/authorNotes/nativeDemo` 说明新增的 Native 示范。两者与开场目录分开，避免把旧建议当作默认开场内容。
- `/data/character_book/entries/0` 是禁用的 `[InitVar]` 纯数据入口，提供根案卷的初始值；`/data/worldbook/9/content` 使用 EJS 展示已提交的 `stat_data.案卷`。
- `/data/character_book/entries/1` 是禁用的 Ruby 指令；对应 `/data/extensions/RubyAnalyzer/presets/0/tasks/0` 默认关闭，启用额外分析并满足关键词条件时才整理军情，不回写数值。
- `/data/extensions/tavern_helper/scripts/0/content` 是 `srcdoc` iframe 展示载体，用于只读查看案卷，不负责生成 Story 或写入数值。

卡 1 用来演示保留既有文本和清晰区分新旧内容。

## Steam Tide：功能组合示例

这张卡把港口设定、角色边界、状态、世界书和前端展示组合成教学用样例：

- `/data/cards/0` 是玩家角色“归港修复师”，包含角色定位与港口场景上下文；`/data/cards/1` 到 `/data/cards/3` 是三名 NPC 及各自的知识边界。
- `/data/character_book/entries` 包含 22 条世界书入口；第 0 条是 `[InitVar]`，承载初始港口状态。扫描深度、预算与递归策略由会话 owner 提供，不由世界书根部的额外声明设置。
- `/data/character_book/entries/19`（条目 ID 60）与 `/data/character_book/entries/20`（条目 ID 61）使用同一 `steam_market_rumor` 组，演示两条市场闲谈互斥；`/data/character_book/entries/21`（条目 ID 62）演示带持续与冷却字段的临时巡港告示。
- `/data/rules/core` 中的 `{{outlet::steam_tide_watch}}` 展示命名 outlet；港务简报 Prompt hook 触发时，会把当轮简报注入这一段。
- `/data/extensions/tavern_helper/scripts/0` 提供固定 loader，`/data/extensions/tavern_helper/scripts/1` 放置 Zod schema，`/data/extensions/tavern_helper/scripts/2/data/html` 是港口值班台界面，`/data/extensions/tavern_helper/scripts/3` 提供值班简报 Prompt hook。
- `/data/extensions/regex_scripts` 有两条展示正则，可对照 `/data/extensions/tavern_helper/scripts/2/data/html` 查看呈现与 Native 状态的分工。
- `/data/extensions/RubyAnalyzer/presets/0/tasks/0` 是可选分析任务，默认 `enabled: false`、`keywordScanEnabled: false`；启用时按 `cyclePositions: [8]` 每八个 assistant 位置运行一次，不经过关键词筛选。

可在卡内查看世界书关键词、次关键词、递归、插入位置与 outlet，EJS 的 `getvar`、`getwi` 和 `activateWI`，以及 MVU 数值更新、前端事件与人工电荷校准。值班台使用 `getVariables` 读取聊天变量，并以 `insertOrAssignVariables` 追加写入 `author.log`；日志采用 `schemaVersion: 1` 的 `entries` 数组，累计观察与顾问对话。个人笔记可按所有权增删，独立顾问由受信点击触发。确定性状态和展示流程不调用模型；顾问每次受信点击对应一次模型请求。Ruby 默认关闭，卡片测试覆盖了启用后的八位置调度；本批未调用模型执行分析任务，实际请求数和费用仍须按实际配置记录。

Steam Tide 的整卡 Core 路径已通过受控 fixture 测试，覆盖四个 Story、简报注入与清理、互斥条目、递归、命名 outlet、临时告示计时和累计日志。验证没有使用真实模型，也没有在 Harness／正式产品宿主或完整浏览器 DOM 中运行；这项结果不代表 0.3 整体验收或发行完成。
