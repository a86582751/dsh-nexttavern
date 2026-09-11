# dsh-NextTavern

**基于原生 Agent Loop 的长篇角色扮演系统。**

从一张角色卡或一个灵感开始，让 AI 主动查阅世界、管理长篇记忆、推演人物行动，把你的选择写成可以分支、回溯和导出的故事。

[开始体验](#开始体验) · [架构设计](#为长篇角色扮演重新组织-agent-的工作方式) · [核心能力](#核心能力) · [下载安装](#下载) · [全部截图](SCREENSHOTS.md) · [反馈问题](https://github.com/a86582751/dsh-nexttavern/issues/new/choose)

![沉浸式阅读体验](screenshots/immersive.png)

Roleplay workspace for DeepSeek Harness: interactive character creation, on-demand worldbook reading, long-form memory, multi-model collaboration, character agents, branching stories and novel exports.

**0.1.0 预览版** · Harness **0.1.2-alpha.3** · pi-ai **0.84.4** · 自有代码 **MIT**

完整功能需要按下方安装说明显式应用六项兼容补丁。展示截图使用维护者的个人主题、模型和示例故事；主题素材不随安装器配置。

## 开始体验

完成[安装](#安装)并配置自己的模型后：

1. **新建一个独立工作区。** 为这次角色扮演选择专用文件夹，集中存放角色卡、故事资源和导出文件。
2. **在预设中选择“角色扮演模式”。** 新建会话时，从预设菜单切换到角色扮演，进入你的故事工作台。
3. **上传角色卡，或者交互式创作一张新卡。** 支持 SillyTavern / TauriTavern 的 PNG、JSON 人物卡；也可以直接描述题材、人物、关系和氛围，让 AI 通过对话与你共同完成创作。
4. **开始体验。Enjoy it!** 跟随开场推进故事，输入你的行动，切换世界线，或随时打开“酒馆管理”调整设定。

没有现成角色卡，也可以从这样一句话开始：

> 帮我创作一张蒸汽都市悬疑角色卡。我想扮演刚到港口的调查员，故事慢热，有多方势力，也有人物关系的发展。其他细节你来决定。

AI 会通过原生 questions 了解你的偏好；你可以逐步回答，也可以说“你来决定”。世界、人设、开场、状态栏与文风的完整性由创作流程检查，无需自己填写工程模板。DOCX/PDF 读卡需要启用[文档扩展](#文档扩展)。

### 导入 SillyTavern / TauriTavern 人物卡

直接上传原始卡文件，然后告诉 AI：**“读取这张角色卡，准备开始角色扮演。”** 无需自己解码，也无需手动填写导入工具参数。

| 格式 | 支持范围 |
| --- | --- |
| **PNG 人物卡** | 从 `chara` / `ccv3` 的 `tEXt` 块读取 Base64 编码的角色数据；两者同时存在时优先读取 `ccv3`。 |
| **JSON 人物卡** | 识别 v1、v2（`chara_card_v2`）和 v3（`chara_card_v3`）。 |
| **内嵌世界书** | 读取 `character_book`，按当前导入流程审阅并映射到设定与世界书。 |

请选择保留元数据的原始 PNG 卡，普通头像、截图或被移除元数据的图片不含可导入的角色数据。PNG/JSON 解析是内置能力，不需要 anydoc；上传入口随完整安装提供。

原件、未知字段和扩展数据会完整归档。替代开场、外部资源及部分世界书高级扩展不自动启用，也不会自动下载资源或执行扩展脚本；这不是对 SillyTavern / TauriTavern 全部扩展运行语义的复刻。

![交互式角色卡创作](screenshots/authoring.png)

## 为长篇角色扮演重新组织 Agent 的工作方式

NextTavern 把角色扮演建模为一个持续运行的创作过程：**主代理负责叙事与判断，程序负责上下文、来源和生命周期，专门的子代理承担记忆整理与角色推演。** 原生工具、文件能力、输入队列和 Session 历史贯穿整个过程。

```mermaid
flowchart TD
    Player[玩家输入与角色卡] --> Queue[原生输入队列]
    Queue --> Context[程序装配当前世界线的设定、正文与导演笔记]
    Context --> Writer[主代理与原生 Agent Loop]
    Writer <--> Lore[按需读取世界书与原始历史]
    Writer <--> Cast[可选角色 Agent 集群]
    Writer --> Story[流式正文与追加式剧情记录]
    Story --> Reader[沉浸阅读、世界线切换与小说导出]
    Story --> Tasks[局后状态与决策任务]
    Story --> Memory[后台导演笔记与检查点]
    Memory --> Context
```

这套架构围绕五个设计展开：

1. **把判断交给 Agent，把确定性工作交给程序。** 稳定设定、当前正文窗口和有效笔记由程序直接提供；主代理判断何时查询世界书或旧历史。常规剧情无需每轮先运行一套“整理场景、生成检索词、召回资料”的额外推理流程。
2. **让长篇记忆形成闭环。** 近期完整正文支撑连续阅读，后台导演笔记承接长线，历史工具保留回查原文的能力；窗口退出前先保存检查点。上下文预算、记忆频率与来源校验共同决定切换时机。
3. **让世界线成为运行时边界。** 一次重新生成会产生有明确起点的执行分支。正文、状态、笔记、世界书变更和导出都按所选世界线及其继承范围读取，原始记录保持追加式保存。
4. **给不同协作任务不同的执行方式。** 兼容的普通任务可以复用主循环或共享一次子代理循环；后台记忆保持独立；每个角色始终独立推演。多模型分工与多角色协作由同一套来源和任务机制连接。
5. **把正文交付与维护完成分开。** 正文流式可读、落盘后继续展示，局后状态和记忆按各自生命周期处理。过程信息归入同一回合，下一步玩家输入通过原生队列衔接。

[阅读完整架构说明：上下文组成、分支继承、任务分工、请求成本与源码入口](ARCHITECTURE.md)

## 核心能力

| 能力 | 你可以获得什么 |
| --- | --- |
| **SillyTavern / TauriTavern 卡片导入** | 直接读取 PNG `chara`/`ccv3` 和 JSON v1/v2/v3 人物卡，保留原件并支持内嵌世界书。 |
| **主动读取世界书** | 主代理根据当前剧情按需查阅地点、势力和背景细节，让世界书作为可查询的设定库参与叙事。 |
| **硬切窗口 + 导演笔记 + 历史查询** | 自动管理长篇上下文：保留近期完整正文，后台整理笔记，需要旧细节时回查原始历史。 |
| **多模型协同** | 为正文与记忆、读写卡、状态、决策、小说导出等任务配置模型路由，按需要分工。 |
| **多角色 Agent 集群** | 为主要角色启动独立推演，分别思考语言、行为与意图，再由主代理协调成最终故事。 |
| **对话分支管理** | 重新生成、修改后发送、切换版本，在同一对话里探索不同世界线；也可显式分支到新对话。 |
| **自定义创作规则** | 分别管理核心设定、人物、世界书、剧情指引、文风与规则，控制视角、节奏、人物知情边界和回复展开方式。 |
| **HTML/CSS 阅读美化** | 通过角色卡中的 HTML/CSS、状态栏模板与正则规则定制阅读呈现，正文支持流式阅读。 |
| **资源库管理** | 集中查看角色卡、故事相关文件与导出结果，按时间或名称排序、刷新和下载。 |
| **模型用量与缓存统计** | 按会话、供应商或模型查看请求、输入输出 tokens、缓存、速度与已知成本，包含重生成和失败尝试。 |
| **交互式全新角色卡创作** | 从一个想法开始，通过交流逐步构建世界、多角色人设、开场、文风和排版。 |
| **小说稿一键导出** | 将选定世界线整理成小说稿；也能导出当前完整角色卡，结果进入资源库供下载。 |

## 让长篇故事持续下去

### 记忆会整理，历史可回查

NextTavern 的长篇记忆采用类似 Codex 长任务上下文管理的思路：**当前窗口负责眼前，导演笔记衔接长线，历史查询找回细节。** 这是本项目的实现，不是 Codex 的官方组件。

- **硬切窗口：** 按完整正文边界管理预算，切换时保留连续尾部；旧窗口退出前先保存必要检查点。
- **导演笔记：** 在后台整理已发生事件与叙事线索，更新频率和窗口预算可在全局或当前会话调整。
- **主动历史查询：** 当主代理需要早期细节时，可以查询当前世界线有来源的原始记录，而不只依赖摘要。
- **主动世界书读取：** 核心设定持续提供，世界书作为按需查阅的资料库；剧情需要什么，再读取什么。

世界线各自管理窗口、笔记与剧情来源。重新生成已有回合不会增加一个新的正史整理槽位。检查点保存失败会保留旧窗口。

![硬切窗口与导演笔记设置](screenshots/memory.png)

### 多模型分工，多角色独立推演

你可以让正文、后台记忆、读卡、状态与导出任务使用适合的模型，也可以统一跟随主模型；模型设置支持全局默认和当前会话覆盖。

开启**角色 Agent 集群**后，主要人物分别在独立上下文中推演。每个角色可选择模型与思考强度，即使用同一个模型也独立运行。它们获得自己的人设、当前剧情、导演笔记和近期已读取的世界书资料，主代理再综合各方建议推进故事。

集群默认关闭，只影响当前对话；开启会增加模型请求与等待时间。角色建议不是直接写入正史的结果，最终正文仍由主代理协调。

![多角色 Agent 集群](screenshots/characters.png)

<details>
<summary>查看多模型协同与用量统计</summary>

![多模型协同设置](screenshots/models.png)

使用统计保留实际尝试，包括未选中的重生成、失败、重试与子代理调用。缓存与价格数据取决于供应商返回和你的价格配置，缺失值保持未知。

![模型使用量与缓存统计](screenshots/usage.png)

</details>

## 一个故事，多种可能

不满意某段发展，可以重新生成；想改一个选择，可以修改玩家消息后发送。不同版本组成当前对话内的世界线，可以来回切换查看。只有显式选择“在新对话中分支”，才创建独立对话。

小说导出跟随你选中的世界线，便于保留喜欢的故事版本。

![同一对话内的世界线与分支管理](screenshots/worldlines.png)

## 按你的方式阅读与创作

在“酒馆管理”中分别调整人物、世界背景、剧情方向、文风和自定义规则。把镜头、节奏与人物边界写进规则，把 HTML/CSS、状态栏和正则美化写进卡片，让不同故事拥有不同的阅读呈现。

正文生成时即可阅读；局后状态与笔记维护有独立进度。继续输入的玩家行动进入原生队列。

![HTML/CSS 阅读呈现与状态栏](screenshots/reading.png)

<details>
<summary>查看管理界面、自定义规则与世界书</summary>

![酒馆管理](screenshots/management.png)

![自定义规则](screenshots/rules.png)

![世界书管理](screenshots/worldbook.png)

</details>

## 从角色卡，到可带走的小说

创作成果可以留在工作区，也可以导出分享。角色卡导出保留当前编辑后的完整设定；小说稿导出基于选定世界线整理章节并保留来源正文。任务完成后，在资源库找到对应文件并下载。

![一键导出小说稿](screenshots/export.png)

<details>
<summary>查看资源库</summary>

资源库按时间或名称排序，支持刷新、查看文件与下载；角色卡和导出文件保留可识别的主题名称。

![资源库管理](screenshots/resources.png)

</details>

## 下载

- [主包 dsh-nexttavern.tgz](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.1.0/dsh-nexttavern.tgz)，含预构建 UI、源码、preset、参考卡、补丁器及 CLI。
- [独立 dsh-debug.tgz](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.1.0/dsh-debug.tgz)。
- [版本说明与 SHA-256](https://github.com/a86582751/dsh-nexttavern/releases/tag/v0.1.0)。未发布到 npm，不要使用 `npm install dsh-nexttavern`。

## 安装

需要 Node.js 22+、npm、Python 3 和 tgz 解压工具。以下为 PowerShell 7 示例，使用独立的新目录。先下载主包；每条命令成功后再继续。

```powershell
$ReleaseDir = Join-Path $PWD 'nexttavern-release'
$HarnessRoot = Join-Path $PWD 'nexttavern-harness'
$env:DSH_HOME = Join-Path $PWD 'nexttavern-home'
New-Item -ItemType Directory -Path $ReleaseDir,$HarnessRoot -ErrorAction Stop | Out-Null
tar -xzf ./dsh-nexttavern.tgz -C $ReleaseDir
Copy-Item -LiteralPath "$ReleaseDir/package/harness/package.json" -Destination $HarnessRoot
Copy-Item -LiteralPath "$ReleaseDir/package/harness/package-lock.json" -Destination $HarnessRoot
npm ci --prefix $HarnessRoot --ignore-scripts --no-audit --no-fund
node "$HarnessRoot/node_modules/@deepseek-ai/dsh/lib/bin.js" web --dump-config | Out-Null
$ProfileDir = Join-Path $env:DSH_HOME 'profiles/web'
npm install --prefix $ProfileDir --legacy-peer-deps --ignore-scripts --no-audit --no-fund "$PWD/dsh-nexttavern.tgz" "$HarnessRoot/node_modules/@deepseek-ai/dsh-tools"
$PackageRoot = Join-Path $ProfileDir 'node_modules/dsh-nexttavern'
```

随包 Harness 锁文件固定 alpha.3 官方依赖，避免旧 prerelease 的宽范围解析到新版本。本地目录依赖让社区文档工具复用 Harness 的同一个 `dsh-tools` 实例。不要在 profile 中另装不同版本的官方工具注册表。

安装 preset 和修改 Harness 前，停止目标实例，为每次操作选择新的备份目录：

```powershell
node "$PackageRoot/tools/install.mjs" --home $env:DSH_HOME --harness $HarnessRoot
node "$PackageRoot/tools/install.mjs" --home $env:DSH_HOME --harness $HarnessRoot --apply --stopped --backup "$PWD/nexttavern-preset-backup-1"
node "$PackageRoot/tools/patch-harness.mjs" --harness $HarnessRoot
$env:DSH_ALLOW_HARNESS_PATCH = '1'
node "$PackageRoot/tools/patch-harness.mjs" --harness $HarnessRoot --apply --stopped --backup "$PWD/nexttavern-harness-backup-1"
Remove-Item Env:DSH_ALLOW_HARNESS_PATCH
node "$HarnessRoot/node_modules/@deepseek-ai/dsh/lib/bin.js" web --host 127.0.0.1 --port 3510
```

浏览器中配置自己的供应商，选择工作区，在新会话预设菜单中选择“角色扮演模式”。打开角色扮演会话后，可见“酒馆管理”侧栏入口和“酒馆”TAB。未打补丁可以加载插件，但缺少完整 UI slots 和世界线支持，不能当作完整安装。

已有 alpha.3 用户可使用自己的 HarnessRoot/DSH_HOME，先 audit。已有未受安装器管理的 roleplay preset 会被拒绝覆盖；先自行备份和迁移。未知版本或文件指纹会停止，不降级成部分安装。`--stopped` 是你的停机确认，工具不会替你终止服务或会话。

## 文档扩展

上传和 `read_document` 随完整安装提供。anydoc 的 DOCX/PDF 转换与 office 的 DOCX 导出定义和配置入口也随包交付；启用需安装依赖后重新安装 preset：

```powershell
npm install --prefix $ProfileDir --legacy-peer-deps --ignore-scripts --no-audit --no-fund 'https://github.com/a86582751/dsh-plugin-anydoc/releases/download/v0.1.0-nexttavern.1/dsh-plugin-anydoc-0.1.0-nexttavern.1.tgz' '@huiliyi37/dsh-office@0.2.2'
node "$PackageRoot/tools/install.mjs" --home $env:DSH_HOME --harness $HarnessRoot --documents
node "$PackageRoot/tools/install.mjs" --home $env:DSH_HOME --harness $HarnessRoot --documents --apply --stopped --backup "$PWD/nexttavern-documents-backup-1"
```

省略 `--documents` 再安装可关闭这两个挂载，不删除文档。显式启用但缺依赖会报错。文档格式和原生组件受系统支持范围限制；扫描 PDF/OCR 和全部格式未逐一实测。office 的 `docx_read` 有长度上限，完整读卡使用 `read_document` 分页或 anydoc。

## 补丁与依赖来源

| 单元 | 目标版本 | 作用 |
| --- | --- | --- |
| ui-chat | 0.1.2-alpha.3 | slots、动作栏与维护投影 |
| ui-workspace | 0.1.2-alpha.3 | 侧栏 slots、CSS 标识符 |
| token-meter | 0.1.2-alpha.3 | 编辑计量与热路径 |
| session-projection | 0.1.2-alpha.3 | 投影热路径与缺事件恢复 |
| Session Controller | 0.1.2-alpha.3 | 原生 forkPrepared 世界线准备 |
| pi-ai | 0.84.4 | Google、OpenAI Completions/Responses、Anthropic 流终止 |

全部目标先审计并在内存转换，再备份和写入。重复应用精确相同补丁幂等，失败恢复本批改动，中断后可按事务备份回滚。后来被其他升级或用户改动的文件不会被强制覆盖。npm 安装没有 postinstall 补丁。

社区兼容包使用正式 fork，保留上游历史和署名，不能误认作原作者发布：

- [dsh-file-upload](https://github.com/a86582751/dsh-file-upload)，上游 [HongMing-Huang/dsh-file-upload](https://github.com/HongMing-Huang/dsh-file-upload) 0.4.3。修复上传回调、稳定引用、附件关闭不删资源、完整分页和 Markdown 转义；保留原版 Host/origin 检查。
- [anydoc](https://github.com/a86582751/dsh-plugin-anydoc)，上游 [beancookie/dsh-plugin-anydoc](https://github.com/beancookie/dsh-plugin-anydoc) 固定提交的 0.1.0，保守还原 Markdown 转义。
- [pi-ai 差分](https://github.com/a86582751/pi/tree/codex/nexttavern-alpha3/nexttavern-compat)，上游 [earendil-works/pi](https://github.com/earendil-works/pi) 0.84.4。统一补丁器解析 Harness 实际使用的实例，不另装无效的 profile 副本。

`better-sidebar` 不是必需依赖；隔离浏览器验证使用官方侧栏。个人 Access、systemd/Nginx、认证放行和私有模型路由不随包启用。通用 Qwen reasoning 配置辅助工具保留于 integrations，仅在明确配置匹配路由时使用。

## 更新、卸载与回滚

更新先停止实例并备份，核对新版本兼容范围；安装新 tgz 后运行新安装器和补丁 audit。用户改过的受管 preset 文件不会被覆盖，需先保留并核对改动。安装器用 `.nexttavern-install.json` 管理文件。

```powershell
# 卸载 preset 与 bundle 注册，保留故事、资源、笔记和模型配置。
node "$PackageRoot/tools/install.mjs" --home $env:DSH_HOME --harness $HarnessRoot --uninstall --apply --stopped --backup "$PWD/nexttavern-uninstall-backup-1"
# 回滚指定的安装或卸载事务。
node "$PackageRoot/tools/install.mjs" --rollback "$PWD/nexttavern-uninstall-backup-1" --stopped
# 单独恢复原版 Harness，完整酒馆功能随之不可用。
$env:DSH_ALLOW_HARNESS_PATCH = '1'
node "$PackageRoot/tools/patch-harness.mjs" --rollback "$PWD/nexttavern-harness-backup-1" --stopped
Remove-Item Env:DSH_ALLOW_HARNESS_PATCH
```

卸载器不删除 npm 依赖。确认不再使用后可从 profile 移除插件包；其他插件仍依赖的上传/文档工具应保留。回滚仅使用对应实例的原始备份。

## 源码与验证范围

`provenance.json` 记录维护源码提交、逐文件来源、工具版本和 SHA-256。`tools/harness-patches.json` 记录上游固定来源及前后指纹。主仓库不携带完整官方补丁快照。重建 UI：

```powershell
npm ci --prefix ./build-tools --ignore-scripts --no-audit --no-fund
npm run build
```

同一源码和锁文件应重建相同的 lib/client.js。修改源码后需更新自己的版本与 provenance，不可冒充原始 Release。兼容 fork 各有无需维护仓库的独立重建命令和归档摘要。

本版验证隔离原生 Harness 加载、六单元补丁、原生事件分支、questions 浏览器提交、文档工具及安装生命周期。分支测试用合成事件并拦截模型调度，验证原生持久化与 forkPrepared，不等于所有供应商的完整剧情实测。未新增供应商剧情、延迟或缓存试验，未重新部署生产。角色集群默认关闭，只属于当前对话，开启会增加请求和等待时间。

## 反馈与许可

使用 [Issues](https://github.com/a86582751/dsh-nexttavern/issues) 的安装/补丁、功能缺陷或体验建议模板。提供版本、最小复现与脱敏错误，不上传 key、Cookie、完整角色卡、私密会话或整个 DSH_HOME。默认没有遥测或自动日志上传；本周范围见 [FEEDBACK.md](FEEDBACK.md)。

自有代码 MIT。龙女参考卡为作者手写，作者确认拥有完整知识产权并授权原件和衍生文件开源；另一张完整参考卡为《雾港第十三声钟》。详见 [NOTICE.md](NOTICE.md) 和 licenses 目录。
