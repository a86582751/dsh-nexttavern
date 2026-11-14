# NextTavern 原生角色卡：作者教程与格式参考

原生角色卡是一份可移植的 JSON 作者文档。它把人物、世界资料、剧情指引、回复规则和开场分开保存，使普通剧情能够读取作者设定，也使角色协作能够找到明确的人物资料。**Native 1.2 使用单份作者正文**，同时承接直接创作与社区转换；需要语义分类时另外保存原文坐标，高级视图按这些坐标只读生成。

本文按 0.3 开发线的统一 1.2 合同整理；实现仍在整合，新输入验证尚待完成，**0.3 尚未正式发布**，实际进度见[开发日志](DEVELOPMENT-0.3.md)。Native 文档版本与插件发行版本分别记录。

快速查阅：[完整示例](#1-从一份能继续创作的卡开始) · [完整 Native 1.2 参考卡](preset/reference/README.md) · [字段参考](#2-文档结构与校验边界) · [世界书控制](COMMUNITY-CARDS.md#4-世界书怎样进入本轮剧情) · [开场](#5-开场正文模板和目录) · [作者正文与分类](#7-单份作者正文与可选分类) · [EJS 模板与 API](#8-ejs-作者模板动态文本与世界书联动) · [导入与导出](#10-导入互动写卡转换与导出)

完整卡例属于 **0.3 开发线作者参考**，不包含在当前正式版 0.2.9 中：[龙女皇：查看 JSON](preset/reference/dragon-empress.native.json) · [下载 JSON](https://raw.githubusercontent.com/a86582751/dsh-nexttavern/main/preset/reference/dragon-empress.native.json)；[Steam Tide：查看 JSON](preset/reference/steam-tide.native.json) · [下载 JSON](https://raw.githubusercontent.com/a86582751/dsh-nexttavern/main/preset/reference/steam-tide.native.json)。

## 1. 从一份能继续创作的卡开始

把下面的完整 JSON 保存成 UTF-8 文件，例如 `雾港灯塔.json`，通过角色卡导入入口载入。它包含玩家身份、一位主要人物、常驻背景、按需查阅的地点、剧情与文风规则，以及两个可选择的开场。没有数值系统或前端脚本，适合先检查人物与故事能否独立成立。

先用这份精简卡熟悉人物、规则、世界书和开场；再按要学习的功能打开[龙女皇](preset/reference/dragon-empress.native.json)或[Steam Tide](preset/reference/steam-tide.native.json)。龙女皇展示原稿归档、分段映射、EJS 动态文本与只读原生案卷页面；Steam Tide 展示玩家与 NPC 资料、Native 数值、社区世界书、港口界面、值班简报 Prompt hook、互斥闲谈条目、限时告示与可选 Ruby 任务。具体字段路径如下：

| 学习点 | 完整卡中的位置 |
| --- | --- |
| 原文归档与范围映射 | 龙女皇 `/archive/referenceSource`、`/archive/referenceSource/ranges` |
| 数值初值与规则 | 两张卡的 `/data/character_book/entries/0` `[InitVar]`；Steam Tide 的 `/data/extensions/tavern_helper/scripts/1` 是 schema |
| 世界书条目 | Steam Tide `/data/character_book/entries`；龙女皇 `/data/worldbook/9/content` 展示已提交数值 |
| 命名 outlet | Steam Tide `/data/rules/core` 中的 `{{outlet::steam_tide_watch}}` 消费世界书“值班台出口”条目；简报脚本另在生成事件中注入一次性聊天提示 |
| 前端展示 | Steam Tide `/data/extensions/tavern_helper/scripts/2/data/html` |
| 值班简报 Prompt hook | Steam Tide `/data/extensions/tavern_helper/scripts/3` |
| 互斥与限时条目 | Steam Tide `/data/character_book/entries/19`（条目 ID 60）、`/20`（ID 61，同组互斥）；`/21`（ID 62，持续与冷却） |
| 累计结构化日志 | Steam Tide `scripts[2].data.html` 使用 `getVariables` 与 `insertOrAssignVariables` 维护聊天变量 `author.log` |
| Ruby 任务 | Steam Tide `/data/extensions/RubyAnalyzer/presets/0/tasks/0`，默认关闭 |

完整卡、单独下载和字段导览都在[随包参考卡索引](preset/reference/README.md)。先从简例掌握栏目，再按表中路径查看完整卡的数值、世界书与前端如何组合。

2026-10-24 的 Steam Tide 1.0 样卡取得过受控整卡 Core 结果，覆盖四个 Story、简报注入与清理、互斥条目、递归、命名 outlet、临时告示计时和累计日志。该验证未使用真实模型、Harness／正式产品宿主或完整浏览器 DOM，只覆盖当时输入，不能直接作为 1.2 或 0.3 整体验收通过。世界书扫描深度、预算及递归策略由会话 owner 提供，卡片不在世界书根部声明这些全局策略。

```json
{
  "spec": "nexttavern_card",
  "spec_version": "1.2",
  "data": {
    "name": "雾港灯塔",
    "cards": [
      {
        "characterId": "visitor",
        "kind": "user",
        "name": "来客",
        "content": "来客是由玩家控制的外乡人，因收到一封没有署名的邀请而抵达雾港。来客只知道邀请上写着：天黑前去灯塔。身份细节、行动、台词和内心由玩家决定。"
      },
      {
        "characterId": "keeper",
        "kind": "npc",
        "name": "守塔人",
        "aliases": ["守灯人"],
        "content": "守塔人负责雾港灯塔。他穿一件磨白的深蓝外套，右袖总带着灯油味，说话简短，遇到难以回答的问题会先整理桌上的潮汐记录。他相信灯必须准时亮起，害怕自己的一次疏忽再次让人失踪。他没有见过邀请信，不知道来客的身世。初见时他愿意提供避雨处，却不会立即交出灯室钥匙；当来客帮他核对潮汐记录后，他才愿意谈起昨夜海面上那盏没有船身的灯。"
      }
    ],
    "worldbook": [
      {
        "name": "雾港日常",
        "kind": "setting",
        "content": "雾港以修船和近海捕鱼为生。入夜后港口常有浓雾，居民靠灯塔辨认航道。故事中的异常应先以可观察的迹象出现，居民各有解释。",
        "alwaysOn": true
      },
      {
        "name": "潮洞",
        "kind": "location",
        "keywords": ["潮洞", "退潮", "石阶"],
        "content": "灯塔西侧的石阶通向潮洞，只有退潮时露出入口。洞壁有旧航标留下的刻痕。守塔人知道入口的位置，但没有亲眼见过洞穴深处；刻痕的含义需要在探索中确认。",
        "alwaysOn": false,
        "priority": 10,
        "tokenBudget": 400
      }
    ],
    "rules": {
      "core": "故事发生在雾港灯塔及附近港口。来客与守塔人在初见时互不认识。守塔人的知识和行动必须符合其经历；不得因为作者写出了秘密，就让所有人物都知道秘密。",
      "plot": "邀请信、潮汐记录和海上孤灯是三条可探索的线索。来客可以选择留在塔内交谈、前往港口询问，或等到退潮探索潮洞。只有实际发生的事件才能推动相应线索，不预设来客接受调查，也不把可能的结局当作已经发生。",
      "narrative": "采用第三人称有限视角，以来客能够观察到的动作、声音和环境变化推进情节。不代写来客的思想、决定或台词。人物不了解的事实不得作为其判断依据。",
      "reply": "每次回复推进一个清晰的互动片段，保留玩家回应空间。结尾落在可回应的动作、问题或新迹象上，避免一段回复替玩家走完整条路线。",
      "style": "用具体物件与声音建立海港氛围，少用抽象情绪评价。文风样本：风从门缝里挤进来，吹得账本翻过一页。守塔人伸手按住纸角，没有立刻看那封信。铜灯在他身后轻响。"
    },
    "opening": {
      "text": "雨水沿灯塔门上的铜环滴落。守塔人拉开门，看见来客手中的信，侧身让出一条窄路。\n\n“先把门关上。”他指了指炉边的空椅，“然后告诉我，谁让你来的？”",
      "materialization": "materialized",
      "catalog": [
        {
          "label": "港口初遇",
          "rawText": "来客抵达港口时，守塔人正从修船铺取回一只铜灯。他看见信封上的灯塔印记，停下了脚步。\n\n“这封信，你从哪里拿到的？”"
        }
      ]
    }
  },
  "archive": {}
}
```

修改时先替换人物动机、知识边界和开场，再扩充世界书。`plot` 写“可能往哪里发展”，`core` 写“现在确定是什么”，`style` 写“怎样叙述”。这样可以避免模型把路线、样本或尚未揭开的秘密当成已经发生的事实。

这份卡里的 `kind: "user"` 标记玩家资料；其余人物使用 `npc`。`characterId` 是稳定的作者人物标识，改人物显示名时应保留它。不要把本地数据库的 `id` 复制过来代替它。

## 2. 文档结构与校验边界

完整约束见[原生卡 JSON Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/nexttavern-card-v1.schema.json)。文件路径继续沿用，文档版本固定为 `spec_version: "1.2"`；文件名中的 `v1` 不表示同时接受旧开发格式，也不是插件版本号。

Schema 检查 JSON 的形状、类型和版本条件；加载器与具体功能再解释运行语义。Schema 没有自动补值的 `default` 声明，表中的“可省略”不表示会替作者补写正文。

| 路径 | 类型 | 必填／省略含义 | 运行作用 |
| --- | --- | --- | --- |
| `spec` | 字符串 | 必填，固定 `nexttavern_card` | 选择原生卡解码路径 |
| `spec_version` | 字符串 | 必填，固定 `1.2` | 统一作者文档协议 |
| `data` | 对象 | 必填 | 当前作者设定与可移植兼容资料 |
| `archive` | 对象 | 必填；新卡可写 `{}` | 保留来源和附加资料，不作为另一份剧情指令注入 |
| `data.name` | 字符串 | 必填；加载器要求非空白，最长 512 字符 | 整张卡的名称，人物仍各有 `name` |
| `data.cards` | 作者行数组 | 必填；允许 `[]` | 唯一人物／作者正文，分类不覆盖它 |
| `data.worldbook` | 作者行数组 | 必填；不用时写 `[]` | 原生世界资料，区分常驻资料和按需检索资料 |
| `data.rules` | 对象 | 必填；允许 `{}` | 唯一作者规则正文 |
| `data.opening` | 对象 | 可省略；存在时必须有字符串 `text` | 当前开场、物化方式及备选目录 |
| `data.status` | 对象 | 可省略；存在时必须有字符串 `text` | 状态栏的作者说明／模板资料 |
| `data.settings` | 对象 | 可省略 | 保存作者设置；只有对应功能支持的设置才有执行效果 |
| `data.character_book` | 对象 | 可省略 | 社区结构化世界书及其控制字段 |
| `data.extensions` | 对象 | 可省略 | Ruby、Helper、社区正则等受支持声明交各自 owner 读取，未知资料只保存 |
| `data.compatibility` | 对象 | 可省略 | ST 字段别名等兼容资料，不保存执行副本 |
| `classification` | 对象 | 顶层可选；由转换流程生成 | 当前原文的分类坐标与来源绑定，供高级消费者派生只读视图 |
| `archive.documents`、`archive.classifiedSources` | 数组 | 可省略 | 导出器保留的来源归档；新作者无需手工制造 |

Schema 允许未知作者字段。比如添加自己的 `authorNotes` 可以随文档保留，但不会自动产生一个新的提示词槽位；添加 `settings.temperature` 也不等于已覆盖模型设置。对于第三方工具，先明确谁读取该字段，再把它写成运行依赖。

加载器另有限制：上传角色卡上限为 20,000,000 字节，JSON 嵌套最多 48 层、节点最多 100,000；`cards`、`worldbook` 和结构化世界书条目各最多 2,048 项。互动写卡的草稿检查另要求工作区内不超过 1 MB 的草稿文件。两者是不同入口的约束。

## 3. 人物与世界资料怎样分工

### `cards`：人物的持续身份

把人物的动机、经历、外貌、说话方式、行为逻辑与知识边界放进 `cards[].content`。清晰的作者人物行可直接供角色协作读取，无需先让模型重新分类。

| 作者行字段 | 类型 | 必填／常用缺省行为 | 用途 |
| --- | --- | --- | --- |
| `content` | 字符串 | Schema 必填；空串可保存，但不能提供有效人设 | 人物或世界资料正文 |
| `name` | 字符串 | 可省略；人物投影可回退到整卡名称 | 显示名称；建议每条显式填写 |
| `characterId` | 字符串 | 开放作者字段；互动写卡定稿要求每个人物唯一且稳定 | 1–64 位 ASCII 字母、数字、下划线或连字符；高级人物身份使用此标识 |
| `kind` | 字符串 | 可省略；普通人物按非玩家处理 | `user` 表示玩家；新卡其他人物建议用 `npc`，世界书可用 `location` 等作者分类 |
| `aliases` | 字符串数组 | 可省略 | 人物别名；世界书还可用于检索匹配 |
| `enabled` | 布尔值 | `enabled:false` 表示禁用 | 高级人物视图、NPC 列表、角色材料和世界书检索跳过 `enabled:false` 行；普通 `cards` 作者上下文仍包含该行原文 |
| `locked` | 布尔值 | 可省略，未标记锁定 | 标记锁定事实，供既有事实约束功能使用；不是文件只读权限 |

互动写卡定稿要求已填写的人物标识唯一。无 `classification` 时，`kind:"user"` 行缺少 `characterId` 可由定稿入口补为 `"user"`，其他人物需填写稳定标识。有分类的转换卡允许混合原文行省略标识，高级人物身份由分类记录提供。玩家资料按 `kind:"user"` 识别。

### `worldbook`：按使用时机组织的知识

`worldbook` 使用相同的作者行形状，另外常用以下字段。其正文不应再次整段复制进人物卡：常驻重复会挤占上下文，条件资料也可能提前泄露。

| 字段 | 类型 | 省略时的普通导入行为 | 运行含义 |
| --- | --- | --- | --- |
| `alwaysOn` | 布尔值 | `false` | `true` 的启用条目进入常驻作者背景；`false` 的条目按需检索 |
| `keywords` | 字符串数组 | 空数组 | 为按需查阅提供关键词 |
| `triggers` | 字符串数组 | 空数组 | 原生按需检索可匹配的触发词 |
| `priority` | 数字 | `0` | 检索候选的优先级；预算不足时不保证所有命中条目都会进入上下文 |
| `tokenBudget` | 数字 | `400` | 检索预算提示；不会把长正文截成这个数，也不会让实际长正文免费计为 400 token |

Native 文档显式填写的作者字段会保留，包括 `false`、`0` 和空数组；导入器的缺省值不是要求作者必须填上的字段。普通原生检索使用当前查询与场景中的地点、在场人物匹配名称、别名、关键词和触发词，再按优先级及预算选取。一次命中过的资料不会因此永久常驻。社区结构化世界书则使用它自己的触发、插入位置与预算规则。

“雾港日常”适合常驻，因为它描述每轮都需要遵守的背景；“潮洞”适合按需查阅，因为只有谈到该地点或探索线索时才需要它。需要所有人物遵守的常识不应藏在一个难以命中的条件条目里。

### `character_book`：保留社区世界书语义

`character_book` 不是 `worldbook` 的别名。它保留社区卡的原结构、条目字段和扩展，由社区世界书编译器负责启用、关键词、二级条件、位置、排序及预算。`entries` 可以是数组，也可以是以原键保存的对象；每个条目必须有字符串 `content`。

以下是可添加到 `data` 中的片段：

```json
{
  "character_book": {
    "entries": [
      {
        "comment": "潮洞刻痕",
        "content": "刻痕由旧航标工留下，并非来客的私人记号。",
        "keys": ["潮洞", "刻痕"],
        "enabled": true,
        "constant": false,
        "insertion_order": 100
      }
    ]
  }
}
```

这是另一条世界书资料，不应同时再把相同正文加入 `worldbook`。原生投影会保留 `character_book` 的正文和元数据交给既有世界书入口，避免同时安装一份重复的原生行。若仅需新卡的常驻／按需知识，先使用 `worldbook`；若迁移现有社区条目并需要其控制语义，保留 `character_book`，再按[社区卡指南](COMMUNITY-CARDS.md)检查实际支持的条件。

“保存在卡内”“当前启用”“本轮被准入”是三件事。高级人物分类引用了某个世界书条目，也不能跳过该条目的正常启用、触发和预算条件。

## 4. `rules` 各键写什么

`rules` 是对象，下列文本键均可省略；未填写就没有该字段的作者正文。规则属于创作指导，其作用也受当前文风预设、社区预设映射和运行设置影响。尤其是 `narrative`、`reply`、`style`，不能仅因写进文件就假定在所有预设模式中都会强制注入。

默认“沿用系统美学”不注入这三项。必须始终参与剧情的世界事实、数值玩法说明或命名 outlet 引用，应放在实际生效的核心／剧情栏目；文风字段继续保存作者的叙事方法与示例。

| 键 | 类型 | 写法与运行作用 |
| --- | --- | --- |
| `core` | 字符串 | 当前世界的核心事实、身份关系和不可省略的共同前提；不要把尚未发生的结局放进这里 |
| `plot` | 字符串 | 可能路线、触发条件和剧情目标；运行提示将其标为尚未发生的作者路线，不能替玩家选择 |
| `narrative` | 字符串 | 视角、知识边界、叙事距离等叙述规则 |
| `reply` | 字符串 | 回复节奏、互动边界和收束方式 |
| `style` | 字符串 | 文风要求及完整样本；样本用于语言质感，不是当前剧情事实 |
| `status` | 字符串 | Schema 允许保留的作者字段；当前原生正文投影没有把它设为独立状态规则入口，状态栏作者资料应写 `data.status.text` |
| `beauty` | 对象 | 美化资料；可含字符串 `css`、字符串 `js` 和数组 `regexRules`，实际消费归美化与正则能力处理 |

不要把任意 JavaScript 字符串塞进未知字段后期待自动运行。`beauty`、社区正则、作者前端、EJS 和 Ruby 各有自己的解释入口；保存它们的资料并不等于支持任意宿主 API。启用的普通 helper 原始模块按原样在 Native Source 页面执行；generation hook 是同脚本注册的真实回调，完整纯 loader／Schema 仍由既有数值 owner 处理。禁用源码保留但不执行，已登记而当前不可用的外部插件单独报告；作者提供卡片资料与受支持脚本即可，无需填写系统内部执行或数值配置。需要这些能力时继续阅读[社区卡指南](COMMUNITY-CARDS.md)、[原生数值与 Ruby](NATIVE-STATE.md)、[社区预设与正则](COMMUNITY-PRESETS.md)。

## 5. 开场：正文、模板和目录

`opening` 的精确结构如下。这里使用的占位文字是说明内容，可替换成作者正文：

```json
{
  "opening": {
    "text": "当前开场正文",
    "materialization": "template",
    "catalog": [
      {"label": "港口初遇", "rawText": "第一份备选开场正文"},
      {"label": "退潮之夜", "rawText": "第二份备选开场正文"}
    ]
  }
}
```

| 路径 | 类型 | 必填／默认行为 | 语义 |
| --- | --- | --- | --- |
| `opening.text` | 字符串 | `opening` 存在时必填 | 始终是选择列表的索引 `0`，标签为“当前开场” |
| `opening.materialization` | 字符串 | 可省略，按 `template` 解释 | `template` 是作者模板；`materialized` 是已经生成／整理好的展示正文 |
| `opening.catalog` | 数组 | 可省略，视为没有备选 | **只保存备选开场**，不再重复放一次 `text` |
| `catalog[].rawText` | 字符串 | 每项必填 | 原始开场正文；第一项对应选择索引 `1`，第二项对应 `2` |
| `catalog[].label` | 字符串 | 可省略，依次显示“备选开场 1”等 | 供玩家辨认选项的标签，不作为剧情正文 |

`materialized` 只作用于 `opening.text`；目录项始终作为模板处理。不能给目录项写一个 `materialization` 就期待跳过模板处理。主开场和备选文字相同也仍是两个不同选项，程序按来源位置识别，不按文本去重。

开场列表会保留原文及预览。基础宏预览只替换调用方提供了有效值的 `{{user}}`、`{{char}}`、`{{user_gender}}`；缺少上下文、未知宏或损坏的宏保持可见。不要依赖 `{{char}}` 自动找出多人物卡里你想称呼的某位 NPC；固定人名可以直接写“守塔人”。`materialized` 主开场保持现有文字，不重新执行这一步宏展开。EJS 与数值初始化属于各自的模板／开场处理流程。

导入提供开场候选，玩家仍需明确选择开场动作。复制作者开场与让模型生成开场是不同动作；不要用“导入卡片”表达“已经生成了第一轮剧情”。带数值初始化时，还需按[状态指南](NATIVE-STATE.md)检查所选开场对应的初始化。

导出当前卡时，所选开场会成为新的 `opening.text`，其他作者选项进入 `catalog`。若原样复制作者开场且正文未修改，导出保留原作者文本及其物化标记；已编辑或生成的展示正文按 `materialized` 导出。这样重新导入时可继续选择其他开场，也不会把已生成正文误当作需要再次执行的原始模板。

## 6. `status` 是作者说明，不是实时状态

可将状态栏应展示什么、怎样描述写入：

```json
{
  "status": {
    "text": "展示当前地点、天气和人物关系的文字摘要；只描述已发生的事实，未知事项写未知。"
  }
}
```

这段资料指导状态展示，不会建立一个具有权威性的变量对象，也不会把当前聊天的状态值封装成存档。数值初始化、每轮更新、提交及分支继承由原生状态系统负责。需要生命值、好感度等可更新数据时，应按[原生数值与状态系统](NATIVE-STATE.md)编写初始化和更新合同；不要用 `status.text` 中的一段 JSON 代替它。

`status` 可以携带其他作者元数据，但它们只有在对应状态展示能力读取时才会生效。导出当前原生卡保存作者设定，不替代世界线、聊天历史或运行状态备份。

## 7. 单份作者正文与可选分类

长社区字段可能同时写着守塔人、港口居民、叙事规则和模板。简单把整个字段命名为“守塔人”会把所有内容误归给一个人物；让模型重新摘要又可能删掉作者细节。Native 1.2 保留完整作者正文，需要时另外记录原文属于谁、位于哪里，高级功能按这些坐标读取材料。

| 内容 | 保存位置与职责 |
| --- | --- |
| 唯一作者正文 | `data.cards/rules`；普通剧情、编辑、模板及当前卡导出都使用这份正文 |
| 可选分类记录 | 文档顶层 `classification`；保存人物、原文跨度、真实来源坐标和语义来源绑定，不是另一套正文 |
| 高级人物／规则视图 | 运行时根据当前有效分类与实际材料派生，只读消费；不能作为作者 document 导出或回写覆盖正文 |
| 世界书、开场、状态、设置和扩展 | 继续使用各自 `data` 栏目；分类不会把条件世界书搬成常驻人设 |
| 原稿与归档 | `archive`；保留已有来源资料，不作为第二份剧情指令注入 |

从零写卡时，像第 1 节一样把人物与规则分开即可，通常不需要 `classification`。原创写卡与完成研究后的小说改编使用相同的作者文档，不为生成 1.2 追加一次分类模型请求。原始社区来源是否需要分类由实际导入来源与工作流决定；把混合字段贴上人物名、填写版本号或自行计算哈希，都不能冒充已完成的语义分类。

### 转换记录原文位置，不搬动作者正文

1. 从**当前已保存的作者设定**冻结本次输入，为可分类正文建立实际来源单位。玩家行和禁用人物行不作为 NPC 分类单位，但原行、未知作者字段和换行仍保存在作者文档中。
2. 分类任务只判断人物、原文跨度与关联；程序核对并使用这些坐标。坐标指向文档中真实存在的字段，例如 `/data/cards/1/content` 或 `/data/rules/core`，不指向一个尚未存在的执行副本。
3. 转换在文档顶层保存 `classification`，保留 `data.cards/rules` 原文。分类记录的版本、人物、assignments、sources 与来源绑定由[转换实现](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-conversion.ts)维护；作者不要手写 ready、verified 或分类凭据。
4. 高级消费者从有效坐标派生只读人物／规则视图。普通剧情仍执行原文一次，不会再把高级视图注入一遍；当前卡导出保留作者文档与有效分类，不能拿视图代替整张卡。
5. 相关原文改变后，旧分类会失效，依赖分类的高级功能需重新整理。普通作者执行仍使用当前正文；带有失效分类的社区材料不能被静默当成“无需分类的原创卡”。

分类依据与完整导出文件有不同用途。只切换已保存的 Ruby preset，或调整不参与分类的状态／设置时，当前卡导出需要反映变化，但不要求把未变的人物原文重新分类。参与分类的正文、人物身份或单位结构改变时，按现有转换流程更新关联。上传原件仍是最初字节；世界线继承对应切点的作者资料与分类，不用父线后来的改动替换它。

1.0／1.1 是未正式发行的开发格式，其双正文写法已经退出当前创作规范。不要只改版本号或复制旧高级视图来生成 1.2；当前作者卡应从真实作者正文建立，历史原稿与验证记录按当时版本保留。

### 角色协作具体能拿到什么

明确的作者人物行可直接提供静态人设；需要分类的社区资料通过有效坐标定位原文。`kind: "user"` 和禁用人物不进入独立 NPC 列表。世界书只复用本轮实际准入的材料，不能让人物因为分类引用而提前知道秘密。

动态 EJS 材料还取决于本轮渲染结果及明确归属。程序不会为了每个人物再执行一遍模板，也不会从渲染后的句子猜测属于谁。当前混合动态规则可能只能用于普通剧情，无法完整拆给角色协作；显式 mapped 社区预设的动态作者高级材料桥仍有限制。界面显示转换 ready，说明分类关联可用，不表示整卡所有动态玩法都能完整用于高级协作。可用的静态人物仍可以单独使用。

## 8. EJS 作者模板：动态文本与世界书联动

0.3 开发源码使用固定 EJS 3.1.10 编译作者模板，并在隔离 Worker 的 QuickJS 中执行。模板负责按已捕获的资料组织文本和受支持的作者效果；它不会让模型代替程序解释模板。正常／重试／回退不会因此增加模板专用的模型推理步骤。

EJS 的执行由材料来源和实际消费动作决定，不会扫描卡片的每个字符串。存档正文与请求文本投影分开：正常 Main 的最终请求 slot 可以执行模板，原始消息记录保持不变；只读历史恢复不会因此重跑作者程序。

### 直接在作者栏目中使用

在第 1 节完整卡的守塔人 `content` 中加入模板文字即可；不需要为普通模板额外声明空 Schema：

```ejs
守塔人今天检查了<% const floors = 2 + 3; %><%= floors %>层楼梯。
```

写回 JSON 字符串时仍按 JSON 规则转义换行和引号。模板原文保留在作者资料里，实际消费该来源时才渲染。`floors` 只是本次模板的局部值，不是聊天变量。复制已选开场时仍复制其作者正文；不要据此假设任意 EJS 开场都必定被拒绝或自动执行，具体准入看来源和动作。后续正常 Main 请求的最终文本处理与 Reader 显示、只读历史恢复是不同阶段。

模板与纯数据 InitVar 是不同入口：作者文字可以包含 EJS，JSON／YAML 初始化载荷本身不会作为 EJS 求值。读取 `stat_data` 只取得实际捕获的数值快照；数值写入仍归 Schema／MVU owner，EJS `setvar` 不得写 `stat_data`。

### 执行位置与正式阶段

EJS 只在已接入的作者材料被相应 owner 消费时运行：

| 材料 | 当前边界 |
| --- | --- |
| Native `cards[].content`、`worldbook[].content`、`rules` 正文和 `status.text` | 在对应来源实际参与请求时渲染；字段存在不代表它在每个预设或阶段都注入。 |
| 可选分类与高级视图 | 复用当前作者正文及本轮已经渲染的材料；分类记录不成为另一个模板入口，高级人物视图不再重复执行模板。 |
| 社区卡人物、场景、规则和示例字段 | 由当前来源 owner 接入模板链；无内嵌世界书的 CCv2／CCv3 仍有自己的六字段路径。 |
| `InitialVariables` 提示材料 | 走自己的来源、渲染、解析和合并入口；不是 MVU 的 `[InitVar]`。 |
| 普通社区 preset 的 `content` | 前置组装使用 `{{…}}` 社区宏；进入正常 Main 最终请求 slot 后，其中的 EJS 按最终文本阶段处理。preset getter 则用于显式读取并嵌套求值捕获目录中的条目，包括未参加最终组装的条目。 |
| 开场 | 是否执行按来源／动作准入；复制已选作者开场保留原文。 |
| Native 历史和模型正文 | 原始记录保持不变；正常 Main 最终请求 slot 按下述正则／EJS 流程生成请求投影。maintenance／returnStory 等 history-only 请求只复用已接受正文投影，不重新运行模板、世界书或作者回调。 |
| Reader 的 HTML 显示 | EJS 不因正则输出或 HTML 渲染再次递归执行；显示清理与页面边界由 Reader owner 处理。 |

普通 WI 的正式准备与 GENERATE loader 按真实来源顺序运行。常见顺序是捕获 `InitialVariables` 和绑定、全局 `GENERATE:BEFORE`、普通 WI formal prepass、普通 WI 选择／反馈／预算、late author，然后进入 Native 实际消息 slot。GENERATE loader 按真实 transport header 和消息 ordinal 定位；tool 或无 text 的 header 仍占位置，不要用可见气泡序号代替。indexed BEFORE／AFTER 只作用于对应的真实 text slot；全局 BEFORE／AFTER 需要实际首／末 text slot。

普通 WI formal 处理按 owner 完成一次：

| 声明 | 含义 |
| --- | --- |
| `@@if` | 按真实布尔条件决定条目是否继续；条件为 false 时，后续 `@@activate` 不能把它救回。 |
| `@@preprocessing`／`[Preprocessing]` | 先处理正文，再按各自原文处理 primary／secondary keys；结果作为 literal 使用，不再重复运行宏或 EJS。 |
| `@@private` | 在启用的普通条目中隔离本条声明和 `return`；不是拒绝所有 private 条目。 |
| `@@dont_activate`、`@@activate` | `@@dont_activate` 优先；符合条件时 `@@activate` 可提出临时激活，仍由 Native 的准入、预算和定时等 owner 决定。 |
| `@@always_enabled` | 恢复条目的 enabled 语义；仍按关键词等准入，不绕过匹配条件或预算。 |

几种正则／模板来源不能混为同一轮扫描：`getwi` 目录读取使用其捕获的早期 Source 正则，再按当前宏和嵌套 EJS 渲染；preprocessing 正文按执行时实际 Source 正则处理一次；普通已选 WI 和 GENERATE 正文不会额外重复这遍 Source 正则；普通 WI 最后仍进入 `WORLD_INFO` 请求正则。Native 最终消息 slot 按 generate 正则 → post-regex EJS 顺序处理。输出中出现的新标签或宏不会自动重启整条模板链。

### `getwi`／`getWorldInfo` 与 `activateWI`

```text
await getwi(titleOrUidOrRegExp)             → string
await getwi(worldName, titleOrUidOrRegExp)  → string
await getWorldInfo(titleOrUidOrRegExp)      → string
activateWI(titleOrUidOrRegExp)              → boolean
activateWI(worldName, titleOrUidOrRegExp)   → boolean
```

`getwi`／`getWorldInfo` 按实际主世界书名称、条目 UID 或受支持的正则查询目录；不是按关键词 `keys` 搜索。缺失返回空字符串。命中内容可在同一 guest 环境按当前捕获的 Source／宏继续执行嵌套 EJS。`getwi` 的目录读取不等于激活条目；是否进入普通请求仍由世界书 owner 按其准入规则决定。

`activateWI` 使用同类查询形式，命中时同步返回 `true` 并记录去重的激活提案；目标缺失会拒绝，而不是返回空正文。它不永久改写条目的 `enabled`。显式激活可以提出原本未由关键词命中的条目，但是否被消费仍取决于实际阶段、formal 条件、启用、预算和定时等规则；不支持该效果的 consumer 会明确拒绝。

### 标签、JavaScript 与 include

| 写法 | 当前语义 |
| --- | --- |
| `<% code %>` | 执行普通 JavaScript，不自动输出代码块的值；支持局部函数、闭包、控制流和 `await`。 |
| `<%= expression %>`、`<%- expression %>` | 都输出原始结果，不自动 HTML 转义；`null`／`undefined` 不输出。 |
| `<%# comment %>`、`<%% ... %%>` | 支持 EJS 注释和字面标签；字面标签内的表达式不执行。 |
| `-%>`、`<%_`、`_%>` | 支持 EJS 的换行／空白裁剪语义。 |
| `print(value)` | 单参数输出别名；不是 `console.log`。 |
| `<% return 'text'; %>` | 返回字符串可覆盖本次缓冲输出；异步返回会等待，最终结果仍须是字符串。 |
| `<%- await include(resourceId, data) %>` | 可读取 owner 已提供的 resource ID；`data` 可省略，或为非 null、非数组的对象。不是 Node 文件系统 include，也不接受任意路径、URL 或相对路径搜索。 |

嵌套 include 共享 guest helpers／locals，可在运行时深度和资源预算内调用；必须 `await`，未等待的子调用会使本次结果拒绝。不要凭空编造 resource ID。QuickJS 不是 Node 或浏览器：模板没有 `process`、`require`、DOM、任意网络／文件接口或模块导入。模板计算失败的未接受结果不会被当作成功发布；持久化时出现不确定写入，则按原操作确认或恢复，不承诺多个变量作用域的原子回滚。

### `getvar`：读取变量和真实消息

getter 的默认 scope 是 `cache`。支持的 scope 字符串为 `cache`、`global`、`local`、`chat`、`message` 和 `initial`；`local` 映射普通 chat 绑定。只能读 owner 已捕获的绑定；没有该 scope 时会拒绝，不会实时查询 session 或全局状态。

不带 selector 的 `getvar(key, {scope:'message'})` 仍读取合并 `cache`。只有传入 `withMsg` 才按真实捕获的消息／swipe 视图读取；它不要求该消息拥有数值状态。selector 的整数 `id` 是本次消息视图中的行号，不是 Native seq 或字符串 message ID；可选择 `role` 和 `swipe_id`，负数从视图末尾计数。显式 `id` 优先于 `role`。未捕获消息视图会明确拒绝，`defaults` 只处理已选目标中缺少的值，不会补造整个 selector 或回退到 cache。

`noCache:true` 会清理本次 cache overlay，并从已捕获的 `global → initial → chat → current message` 与 staged 普通写入重建；没有 current message 时使用已有 captured cache。它不会刷新或查询运行中的全局状态。

```ejs
<% const visits = getvar('visits', {scope:'local', defaults:0});
   setvar('visits', visits + 1, {scope:'local'}); %>
已到访 <%= getvar('visits', {scope:'local'}) %> 次。
```

这段写入示例仅用于有写权限的 Main 模板。`getvar` 返回的 captured 对象默认只读；`clone:true` 只给局部副本，不会写回。完整 key 优先于点号／方括号路径；`index` 用于解析变量内保存的 JSON 字符串后选取属性，不是任意对象下标。`variables` 是只读 cache 属性视图，按字面属性访问，不支持 `getvar` 的路径语法。

读取当前数值时可用 `getvar('stat_data.角色.体力', {scope:'local'})`，前提是 owner 已提供该快照。读取不授予写入权限；`setvar` 对 `stat_data` 的写入会拒绝。

### `setvar`：普通变量写入

`setvar` 写入普通变量的 staged proposal，不是 MVU 更新入口。只有 owner 接受发布后才成为持久事实；一次模板计算成功不等于已经保存。

| scope／选项 | 当前语义 |
| --- | --- |
| 默认／`message` | 写入实际 current message target；`withMsg` 可选已有历史消息／swipe。目标或 capture 不存在时拒绝，不降级成 chat 写入。 |
| `local`／`chat` | 写当前普通 chat namespace；未捕获该 namespace 时拒绝。 |
| `cache` | 只改本次 cache overlay，不持久化普通 State；可在没有持久 namespace 时使用。 |
| `value === undefined` | 未使用 `merge` 时可删除普通 key 或受支持的对象路径；嵌套对象中的 `undefined` 不是删除操作。 |
| `results:'old'`、`'new'`、`'fullcache'` | 控制返回写前 cache 值、写后值或更新后的 cache；默认返回 `new`，不满足条件的写入返回 `undefined`。 |
| `flags:'nx'`、`'xx'`、`'n'` | 基于 cache 旧值是否存在决定只在不存在、只在存在时写入，或不附加存在性条件；`null` 也算存在。 |
| `flags:'nxs'`、`'xxs'` | 按相应 getter scope／`withMsg` 判断存在性；这与 writer 默认目标不同。 |
| `index` | 修改变量中 JSON 字符串指定的 index／path，保留目标对象的其他 sibling，并仍保存为 JSON 字符串。 |
| `merge:true` | 基于 cache 旧值按当前 Lodash merge 行为合并：顶层数组拼接，嵌套 source array 替换；与 `undefined` 组合时按既有 merge 语义保留旧对象。 |
| `noCache:true` | 写入前清理 overlay 并重建已捕获基线；仍遵循 getter 与 writer 的 scope 权限。 |
| `dryRun` 或 boolean 简写 | 被接受，但不构成无写入预览，也不自动启用 ST 全局 dry-run。传 `true` 不能保证不产生正常目标 proposal。 |

EJS guest 明确拒绝对 `global`／`initial` 持久写入、`stat_data` 写入、未知选项／flags、缺少真实目标的写入，以及函数、Symbol、BigInt、非有限数或含嵌套 `undefined` 的非 JSON 值。读写权限不会从其他 Native Browser 接口继承；EJS guest 不提供 `setVariables`、`replaceVariables`、`updateVariables`、MVU setters、Schema 注册或 slash helper。

### 当前 preset、提示注入与正则

preset helper 读取当前已捕获的 raw prompt catalog，不是最终组装 prompt 列表：

| helper | 语义 |
| --- | --- |
| `getPresetPrompts()` | 按原 `prompts` 顺序提供名称 generator，包括未启用或不在最终 order 中的条目。 |
| `getPresetPromptsContent(nameOrRegex)` | 返回第一个名称相等或匹配的原始内容；缺失／空内容返回 `null`，不执行模板。 |
| `await getpreset(name, data)`、`getprp`、`getPresetPrompt` | 渲染首个匹配项；缺失／空内容返回空字符串。guest 使用真实 Lodash merge 把 `data` 合入 locals 并设置 `prompt_name`，再执行嵌套 EJS 和 NextTavern 当前有界宏展开。 |

`data` 中的函数和对象保留 guest identity，不会先转成 Node JSON。未提供真实 preset capture 时会拒绝。这里不承诺完整 SillyTavern `substituteParams`、preset CRUD 或写入 preset 的 helper。

`injectPrompt(key, prompt, order, sticky, uid)` 与 `getPromptsInjected(...)` 是按 key／uid 管理的命名队列；相同 key／uid 可替换，结果按 order 排序。`getPromptsInjected` 可做 guest replace；没有 postprocess 且设置 `outlet:true` 时留下延迟 outlet 宏，在实际请求文本的引用位置展开。读取不消耗 sticky；生命周期按接受的 generation 推进，失败或未发布的准备不算已消费。

命名 `injectPrompt` 队列与结构化的 `injectPrompts`／`uninjectPrompts` 是两套接口。后者提供 position、depth、role、content、scan/filter 与 once 等正式注入语义，由材料流程记录和消费；不要把命名字符串队列当作结构化 prompt 注册的替代品。

模板中公开的动态正则 helper 是 `activateRegex(pattern, replacement, options)`。pattern 可为字符串或 RegExp；basic replacement 为字符串，实际 generate/message 阶段可用 guest 函数。可设置来源顺序、sticky、角色／World Info／reasoning、深度和阶段标记；具体是否生效取决于真实消费者。Main 接入 basic prompt 与 generate；Reader 的受控 phase 只允许本次 local regex。`before` 和 HTML 显示阶段有实际消费者；写 `after:true` 本身不代表系统会自动执行一个 message-after 阶段。

### Reader、AuthorDialog 与失败边界

Reader 的纯 render 是只读计算；实际 `reader-regex-phase` 只允许局部 `activateRegex`。它不允许用 `setvar` 改 Main State，也不允许 `activateWI` 或提示注入。Reader 的显示顺序包括 message-before、普通 Markdown／真实 HTML、HTML 阶段和 after World Info；HTML 不会重新作为 EJS 模板运行，最终仍受现有 sanitize 和页面边界约束。

AuthorDialog 使用只读模板计算来准备作者资料与 World Info 证据；任何普通变量写入、提示注入或正则效果都会明确拒绝，late author 字段的激活提案也会拒绝。它使用自己的实际 consumer，不等同于 Reader phase，也不能用 `setvar` 改数值。

模板使用本轮捕获的时钟和随机种子；`Date.now()`、无参数 `new Date()` 与 `Math.random()` 不读取任意变化的外部状态。执行受输入、输出、嵌套和时间／内存预算限制；超时、取消、过期来源、不可用 scope 或不支持的 helper 会明确拒绝。持久化状态不确定时应确认原操作，不能假定重发一遍等于安全重试。具体准入以实际来源／动作诊断为准。

### 浏览器 Helper：等待真实读取与保存结果

上面的 EJS helpers 在模板 guest 中运行。作者页面使用另一套浏览器 SDK；名称相近也不具有相同返回类型或写权限。例如 EJS `await getwi(...)` 返回正文字符串，浏览器 `await getWorldbook(name)` 返回当前主书条目数组。

| 浏览器 API | 返回与使用方式 |
| --- | --- |
| `getWorldbook(name)` | Promise；`name` 使用当前主书实际名称，先 `await` 再 `filter`／`map`，不要在 Promise 上直接操作数组 |
| `createWorldbookEntries(name, entries)` | Promise，成功值为 `{worldbook, new_entries}`；新增数量是 `result.new_entries.length` |
| `deleteWorldbookEntries(name, predicate)` | Promise，成功值为 `{worldbook, deleted_entries}`；删除数量是 `result.deleted_entries.length` |
| `updateWorldbookWith(name, updater)` | 等待 updater 与保存，成功后返回当前书；updater 使用本次读取的条目，不以旧页面快照覆盖新来源 |
| `replaceWorldbook(name, entries)` | 等待当前书保存；不要依赖返回一个条目数组 |
| `getVariables(options)`、`getChatMessages(range, options)` | 同步读取本页面当前捕获的变量／消息；变量默认 chat，script／message 使用实际目标，消息 ID 是该视图中的行号，不是 Native seq |
| 普通变量写入与 `setChatMessages` | 等待真实写入结果；普通变量不取得 MVU 数值权限，消息修改须使用当前目标与读依据 |
| `eventOn(...)`、`eventOnce(...)` | 返回含 `stop()` 的注册对象；清理时调用 `registration.stop()`，不要把返回对象当函数调用 |
| `triggerSlash(command)` | Promise，成功返回 pipe 字符串；拒绝／未知结果抛错。支持 `/send`、`/trigger` 及[有限 Ruby 命令](NATIVE-STATE.md#作者命令读取手动分析与切换方案)，不等于支持任意 ST slash |
| `generateRaw(options)` | 显式生成请求；由作者操作触发并按实际模型调用计费，普通页面刷新不必调用 |

```js
async function readNotes(worldbookName) {
  const entries = await getWorldbook(worldbookName);
  return entries.filter(entry => entry.comment === '灯塔记录');
}
```

保存后需要刷新页面内容时，也要等待重新读取完成，并把异步失败放在实际调用链的错误处理中。事件注册与页面生命周期配合清理；数值页面使用 `nextTavern.getNumericalState()` 提供的当前 `values`、`expected` 和可编辑状态，再调用数值写入口检查真实回执。不能把 ordinary 变量里的 `stat_data` 副本当作数值已提交。浏览器 API 的实际入口见 [author-native-helper-frame.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/ui/author-native-helper-frame.ts)。

## 9. 兼容资料与开放扩展

`compatibility.sillytavernMacroFields` 是一个“键到字符串”的对象，用于保留激活时 ST 字段的宏别名资料。已有读取器关注 `description`、`personality`、`scenario`、`mes_example`、`system_prompt`、`post_history_instructions`；这些别名由既有受保护的提示词渲染器展开，不能替代当前作者正文或另加一套提示词注入。

`compatibility`、`settings`、人物行、世界书行及归档允许未知字段，为迁移和工具扩展保留资料。应区分三种情况：

- **格式可保存**：字段能通过开放对象保留，不代表运行时读取它。
- **已有能力读取**：如开场目录、原生世界书、已支持的宏、正则或美化字段，按各自合同执行。
- **需要外部环境**：未封装的图片、音频、远程页面或第三方插件资料，不会因导出 JSON 自动一并安装。

作者应使用 `characterId` 等可移植标识。`id`、`importId`、`sources`、`verified`、本地 `schemaVersion`／`version`、创建与更新时间、`tavern`、`editedFrom` 等是运行记录中的保留字段；行级导出与激活会移除这些本地字段，`beauty.sources` 也不会作为跨环境权限保留。顶层 classification 自己的版本字段只描述分类记录，不授予运行时写权限。

## 10. 导入、互动写卡、转换与导出

| 作者动作 | 得到什么 | 作者应检查什么 |
| --- | --- | --- |
| 上传原生 JSON | 解码后按原生栏目载入 | 人物是否分行、玩家身份是否正确、开场列表是否完整 |
| 上传社区 PNG／JSON 或文本资料 | 沿对应导入流程读取原资料 | 不要把成功导入等同于已经完成原生人物分类 |
| 互动写卡／小说改编定稿 | 共同定稿入口保存原生文档 | `characterId`、实际 JSON 栏目、玩家确认后的应用范围 |
| 转换并应用到当前对话 | 保存当前来源对应的分类关联 | 高级人物是否符合原文；普通执行资料是否仍完整 |
| 导出上传源文件 | 当时上传的文件名、类型和原始字节 | 后来的作者编辑不会合并进原件 |
| 导出当前原生卡 | 当前已保存的单份作者设定、有效分类及归档 | 这是可继续创作的卡，不是完整聊天备份 |

转换并应用不重新导入原件、不重插开场、不新增剧情轮次，也不改写旧正文。有效原生结构的读取、合并和导出由程序完成，不需要为了识别已有栏目再调用模型。混合社区资料需要语义归属时才运行分类任务；一次任务可能包含续步或重试，不能将“一次转换”等同于一次 HTTP 请求。

没有上传原件的互动写卡，两种导出入口都提供当前原生卡。DOCX 的原始文件字节与抽取文本分别保存。把导出的 JSON 上传到另一工作区后，这份 JSON 成为那次上传的原件；不能从中声称恢复更早的 PNG 文件字节。

产品转换和当前卡片导出直接生成 Native 1.2 `nexttavern_card` JSON，包含当前保存的作者资料与有效分类（如有）。已有 CCv2／CCv3 输入和合并接口仍可用于传输与再导入。社区来源版本与 Native 文档版本彼此独立。

## 11. 作者的验证顺序

1. **先验格式。** 使用支持 JSON Schema Draft 2020-12 的工具检查完整文件；确认没有注释、尾逗号、字符串内的未转义换行。必填的 `cards`、`worldbook`、`rules` 和 `archive` 即使为空也要保留。
2. **核对身份与栏目。** 为人物提供稳定且唯一的 `characterId`；只将玩家资料标为 `user`。确认当前事实、未来路线和文风样本没有混在一起。
3. **在独立创作会话试导入。** 打开人物、规则和世界书编辑视图核对内容。检查每个开场的标签与预览，再明确选择一个；另开创作会话试另一个开场，避免把两条起点写进同一条历史。
4. **检查可观察行为。** 与守塔人交谈，检查是否代替玩家决定、是否提前知道未揭露线索；查询潮洞资料，检查常驻背景与条件资料的区别。加数值、美化或模板后，分别核对对应结果。
5. **需要角色协作时再检查高级视图。** 看人物名称、正文和知识边界是否正确。社区卡通过转换建立分类后，编辑相关来源时留意失效提示。
6. **导出并重新导入。** 下载当前卡，在另一个创作会话载入，检查人物、规则、世界书和开场选项。要交付原始素材时另外下载原件；外部素材单独说明依赖。

通过互动写卡定稿时，可让助手使用 `rp_card_draft_check` 检查工作区 JSON 草稿。该工具要求对整体概述、世界观、势力、地点、人物、剧情、文风、开场、状态、规则、美化与正则共 12 项提交实际栏目引用与审阅依据；不需要的状态、美化或正则可明确标为不需要。它检查结构、人物身份及实际配置，**不会激活卡，也不能代替创作质量和视觉检查**。已有应用授权时，由共同定稿入口 `rp_commit_card(native_document)` 直接保存和激活，不再做一次语义分类；没有应用授权时先交付文件。提交不会自动重复开场。

### 常见问题

| 现象 | 原因与修改方向 |
| --- | --- |
| 文件能过 Schema，互动写卡却拒绝定稿 | 检查人物的 `characterId`；Schema 的开放字段规则不替代定稿入口的唯一身份要求 |
| 守塔人替玩家说话，或把未来结局当成事实 | 明确 `user` 行和人物知识边界；把可能路线移到 `plot`，把实际事实留在 `core` |
| 开场多了一份，或备选没有正文 | `catalog` 只放备选；每项键名是 `rawText`，不是 `text`、`content` 或 `first_mes` |
| 占位符原样显示 | 检查是否为 `materialized` 主开场、宏名称是否受支持，以及当前是否提供了该宏上下文 |
| 条目已保存在文件中，却没进入本轮 | 检查启用、触发词、常驻设置和预算；高级分类引用不会强制准入 |
| 加了 `status.text` 却没有实时数值 | 它是展示说明；按状态指南另写初始化与更新合同 |
| 文件是 1.2，高级功能仍未就绪 | 区分明确作者人物与需要分类的社区来源；分类应与当前原文有效关联，版本号或自填 ready／verified 不代替它 |
| 导出的原件没有作者刚改的内容 | 原件保留上传字节；应下载“当前原生卡”检查当前设定 |
| 卡里保留了脚本或扩展，但玩法没有执行 | 保留资料不等于存在运行入口；核对对应能力和依赖，避免依赖未知字段自动执行 |

## 12. 给工具开发者的源码入口

公开源码可用于核对结构与行为；实现时应复用对应入口的合同，避免再实现一套正文选择或世界书准入逻辑。

| 需要核对的行为 | 公开入口 |
| --- | --- |
| 格式形状、必填与版本条件 | [nexttavern-card-v1.schema.json](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/nexttavern-card-v1.schema.json) |
| 作者数据、执行视图、可移植字段、ST 扩展外壳 | [nexttavern-card.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/nexttavern-card.ts) |
| 解码限制、开场候选、基础宏预览 | [tavern-card.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-card.ts) |
| 原创卡身份检查、草稿检查与共同定稿 | [roleplay-authoring.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-authoring.ts) |
| 分类输入、跨度验证、坐标与单正文产物 | [native-card-conversion.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-conversion.ts) |
| 高级视图、来源失效与静态人物 | [native-card-advanced.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-advanced.ts) |
| 本轮动态材料与高级人物消费 | [native-card-advanced-material.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-advanced-material.ts) |
| EJS 标签、执行策略与预算 | [tavern-template-ejs-compiler.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-ejs-compiler.mts)、[tavern-template-ejs-runtime-types.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-ejs-runtime-types.mts) |
| EJS 的真实执行、变量和世界书 helper | [tavern-template-ejs-host.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-ejs-host.mts)、[tavern-template-ejs-host-guest.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-ejs-host-guest.mts)、[tavern-template-ejs-runtime-worker.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-ejs-runtime-worker.mts) |
| Native 模板来源与纯数据初值组合 | [roleplay-prompt-program-source.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-prompt-program-source.ts)、[roleplay-prompt-opening-source-data.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-prompt-opening-source-data.ts) |
| 世界书渲染与请求时序 | [roleplay-tavern-prompt-render.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-tavern-prompt-render.ts)、[roleplay-tavern-prompt.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-tavern-prompt.ts) |
| 当前作者资料、开场和导出外壳 | [roleplay-native-card-export.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-native-card-export.ts) |
| 原生世界书检索与作者规则贡献 | [roleplay-author-context.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-author-context.ts)、[roleplay-author-contributions.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-author-contributions.ts) |
