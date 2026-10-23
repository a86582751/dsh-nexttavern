# NextTavern 原生角色卡：作者教程与格式参考

原生角色卡是一份可移植的 JSON 作者文档。它把人物、世界资料、剧情指引、回复规则和开场分开保存，使普通剧情能够读取作者设定，也使角色协作能够找到明确的人物资料。新卡优先使用 **Native 1.0**；社区卡需要在完整保留原文的同时建立高级人物分类时，使用转换流程生成 **Native 1.1**。

本文描述 0.3 开发线；**0.3 尚未正式发布**，发行信息见[开发日志](DEVELOPMENT-0.3.md)。

快速查阅：[完整示例](#1-从一份能继续创作的卡开始) · [字段参考](#2-文档结构与校验边界) · [世界书控制](COMMUNITY-CARDS.md#4-世界书怎样进入本轮剧情) · [开场](#5-开场正文模板和目录) · [Native 1.1](#7-native-11保留执行原文另建高级视图) · [EJS 模板与 API](#8-ejs-作者模板动态文本与世界书联动) · [导入与导出](#10-导入互动写卡转换与导出)

## 1. 从一份能继续创作的卡开始

把下面的完整 JSON 保存成 UTF-8 文件，例如 `雾港灯塔.json`，通过角色卡导入入口载入。它包含玩家身份、一位主要人物、常驻背景、按需查阅的地点、剧情与文风规则，以及两个可选择的开场。没有数值系统或前端脚本，适合先检查人物与故事能否独立成立。

```json
{
  "spec": "nexttavern_card",
  "spec_version": "1.0",
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

完整约束见[原生卡 JSON Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/nexttavern-card-v1.schema.json)。文件名中的 `v1` 同时覆盖 `spec_version: "1.0"` 和 `"1.1"`，不是软件版本号。

Schema 检查 JSON 的形状、类型和版本条件；加载器与具体功能再解释运行语义。Schema 没有自动补值的 `default` 声明，表中的“可省略”不表示会替作者补写正文。

| 路径 | 类型 | 必填／省略含义 | 运行作用 |
| --- | --- | --- | --- |
| `spec` | 字符串 | 必填，固定 `nexttavern_card` | 选择原生卡解码路径 |
| `spec_version` | 字符串 | 必填，`1.0` 或 `1.1` | 决定普通作者资料与高级视图的解释方式 |
| `data` | 对象 | 必填 | 当前作者设定与可移植兼容资料 |
| `archive` | 对象 | 必填；新卡可写 `{}` | 保留来源和附加资料，不作为另一份剧情指令注入 |
| `data.name` | 字符串 | 必填；加载器要求非空白，最长 512 字符 | 整张卡的名称，人物仍各有 `name` |
| `data.cards` | 作者行数组 | 必填；允许 `[]` | 1.0 的人物／作者资料；1.1 的高级人物视图 |
| `data.worldbook` | 作者行数组 | 必填；不用时写 `[]` | 原生世界资料，区分常驻资料和按需检索资料 |
| `data.rules` | 对象 | 必填；允许 `{}` | 1.0 的作者规则；1.1 的高级规则视图 |
| `data.opening` | 对象 | 可省略；存在时必须有字符串 `text` | 当前开场、物化方式及备选目录 |
| `data.status` | 对象 | 可省略；存在时必须有字符串 `text` | 状态栏的作者说明／模板资料 |
| `data.settings` | 对象 | 可省略 | 保存作者设置；只有对应功能支持的设置才有执行效果 |
| `data.character_book` | 对象 | 可省略 | 社区结构化世界书及其控制字段 |
| `data.compatibility` | 对象 | 1.0 可省略；1.1 必填 | 作者执行资料、ST 字段别名及兼容扩展 |
| `archive.documents`、`archive.classifiedSources` | 数组 | 可省略 | 导出器保留的来源归档；新作者无需手工制造 |

Schema 允许未知作者字段。比如添加自己的 `authorNotes` 可以随文档保留，但不会自动产生一个新的提示词槽位；添加 `settings.temperature` 也不等于已覆盖模型设置。对于第三方工具，先明确谁读取该字段，再把它写成运行依赖。

加载器另有限制：上传角色卡上限为 20,000,000 字节，JSON 嵌套最多 48 层、节点最多 100,000；`cards`、`worldbook` 和结构化世界书条目各最多 2,048 项。互动写卡的草稿检查另要求工作区内不超过 1 MB 的草稿文件。两者是不同入口的约束。

## 3. 人物与世界资料怎样分工

### `cards`：人物的持续身份

把人物的动机、经历、外貌、说话方式、行为逻辑与知识边界放进 `cards[].content`。原生 1.0 的清晰人物行也可直接供角色协作读取，无需先让模型重新分类。

| 作者行字段 | 类型 | 必填／常用缺省行为 | 用途 |
| --- | --- | --- | --- |
| `content` | 字符串 | Schema 必填；空串可保存，但不能提供有效人设 | 人物或世界资料正文 |
| `name` | 字符串 | 可省略；人物投影可回退到整卡名称 | 显示名称；建议每条显式填写 |
| `characterId` | 字符串 | 开放作者字段；互动写卡定稿要求每个人物唯一且稳定 | 1–64 位 ASCII 字母、数字、下划线或连字符；高级人物身份使用此标识 |
| `kind` | 字符串 | 可省略；普通人物按非玩家处理 | `user` 表示玩家；新卡其他人物建议用 `npc`，世界书可用 `location` 等作者分类 |
| `aliases` | 字符串数组 | 可省略 | 人物别名；世界书还可用于检索匹配 |
| `enabled` | 布尔值 | 开放作者字段；未显式为 `false` 时启用 | 人物高级视图与世界书使用方会跳过禁用行；它不是 Schema 为所有扩展定义的通用开关 |
| `locked` | 布尔值 | 可省略，未标记锁定 | 标记锁定事实，供既有事实约束功能使用；不是文件只读权限 |

Schema 本身没有要求 `characterId`，但互动写卡定稿会要求唯一标识；`user` 行未填写时该入口可补为 `user`。为使同一文件也适用于写卡、改编与高级人物功能，建议一开始就像上例一样显式填写。`user` 资料不会被列为需要独立扮演的 NPC。

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

| 键 | 类型 | 写法与运行作用 |
| --- | --- | --- |
| `core` | 字符串 | 当前世界的核心事实、身份关系和不可省略的共同前提；不要把尚未发生的结局放进这里 |
| `plot` | 字符串 | 可能路线、触发条件和剧情目标；运行提示将其标为尚未发生的作者路线，不能替玩家选择 |
| `narrative` | 字符串 | 视角、知识边界、叙事距离等叙述规则 |
| `reply` | 字符串 | 回复节奏、互动边界和收束方式 |
| `style` | 字符串 | 文风要求及完整样本；样本用于语言质感，不是当前剧情事实 |
| `status` | 字符串 | Schema 允许保留的作者字段；当前原生正文投影没有把它设为独立状态规则入口，状态栏作者资料应写 `data.status.text` |
| `beauty` | 对象 | 美化资料；可含字符串 `css`、字符串 `js` 和数组 `regexRules`，实际消费归美化与正则能力处理 |

不要把任意 JavaScript 字符串塞进未知字段后期待自动运行。`beauty`、社区正则、作者前端、EJS 和 Ruby 各有自己的解释入口；保存它们的资料并不等于支持任意宿主 API。需要这些能力时继续阅读[社区卡指南](COMMUNITY-CARDS.md)、[原生数值与 Ruby](NATIVE-STATE.md)、[社区预设与正则](COMMUNITY-PRESETS.md)。

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

## 7. Native 1.1：保留执行原文，另建高级视图

长社区字段可能同时写着守塔人、港口居民、叙事规则和模板。简单把这个字段命名为“守塔人”会把所有内容误归给一个人物；让模型摘要又可能删掉作者规则。1.1 用两个视图解决归属问题：普通剧情继续使用完整作者资料，高级功能读取分类结果。

| 内容 | Native 1.0 | Native 1.1 |
| --- | --- | --- |
| 普通剧情的 `cards/rules` 来源 | `data.cards/rules` | `data.compatibility.authorExecution.cards/rules` |
| 角色协作的人物／规则视图 | 直接读取清晰的作者栏目 | `data.cards/rules`，由原文分类物化 |
| `authorExecution` | 不允许出现 | 必须出现，且包含下方四个必填字段 |
| 分类关联 | 清晰人物行无需另做分类 | 转换器保存人物、跨度、来源及哈希关联；有效时复用 |
| 世界书、开场、状态与设置 | 各自的 `data` 栏目 | 继续使用这些栏目，不复制进 `authorExecution` |

下面是 **1.1 必需容器片段**，不是一份完整卡，也不是有效分类记录的替代品：

```json
{
  "compatibility": {
    "authorExecution": {
      "schemaVersion": 1,
      "mode": "preserved-author",
      "cards": [
        {"characterId": "keeper", "name": "守塔人", "content": "这里保留完整的当前作者资料。"}
      ],
      "rules": {
        "core": "这里保留完整的当前作者规则。"
      }
    }
  }
}
```

`schemaVersion` 必须是数字 `1`，`mode` 必须是字符串 `preserved-author`；`cards` 仍是含 `content` 的作者行数组，`rules` 仍使用前述规则对象。其正文是普通执行的唯一作者来源，不会再与外侧 `data.cards/rules` 注入两遍。

### 工具实现者的升级合同

1. 从**当前已保存的作者设定**捕获快照。若输入已经是 1.1，先读取 `authorExecution`，不要把它的高级视图误当原文。
2. 完整保留执行 `cards/rules` 到 `data.compatibility.authorExecution`，包括玩家行、禁用行、作者字段和原文。普通执行的换行与正文不由分类模型改写。
3. 为可分类的人物正文、五类文本规则以及世界书正文建立来源单位。玩家行和禁用人物行不作为人物分类单位；它们仍保留在完整执行资料中。
4. 分类只返回人物身份与原文跨度归属。程序复制静态原文片段，形成 `data.cards` 的人物和 `data.rules` 的规则视图。世界书、动态模板保留来源引用，不把有条件资料复制成常驻人设。
5. 转换器在 `compatibility.classification` 保存版本、人物、跨度及当前来源哈希关联，随后设 `spec_version: "1.1"`。该记录由[转换实现](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-conversion.ts)定义，不是可以随意填写的“已验证”标志。
6. 加载与高级消费会对照实际来源验证关联。人物、规则、世界书或相关扩展修改后，旧分类可能过期；开场选择、状态或设置本身不要求把未变的人物正文再分类一次。

**只改版本号不构成升级。** Schema 合格的 1.1 容器也不自动具有有效高级分类；缺少或过期的分类会让高级能力未就绪，普通执行仍读取完整作者资料。反向迁移同样不能只改成 `1.0`：必须先决定哪份内容是新的普通作者正文，移除 1.1 专用容器并验证人物栏目，不能让高级摘要覆盖原文。

新作者没有混合长字段时，直接写好 1.0 就能避免这项归属转换。对于现有社区卡，使用界面的转换／导出流程比手写哈希与分类记录可靠。

### 角色协作具体能拿到什么

高级视图中的人物需要有效正文。1.0 可以直接读取静态人物；1.1 通过有效分类关联定位原文。`kind: "user"` 和禁用人物不进入独立 NPC 列表。世界书只复用本轮实际准入的材料，不能让人物因为分类引用而提前知道秘密。

动态 EJS 材料还取决于本轮渲染结果及明确归属。程序不会为了每个人物再执行一遍模板，也不会从渲染后的句子猜测属于谁。当前混合动态规则可能只能用于普通剧情，无法完整拆给角色协作；显式 mapped 社区预设的动态作者高级材料桥仍有限制。界面显示转换 ready，说明分类关联可用，不表示整卡所有动态玩法都能完整用于高级协作。可用的静态人物仍可以单独使用。

## 8. EJS 作者模板：动态文本与世界书联动

0.3 的源码包含**原生模板执行器提供的 EJS 子集兼容**。作者可以用 JavaScript 条件、局部变量和受支持的 helper 生成本轮提示文本；编译后的作者函数在独立 Worker 内的 QuickJS 环境执行，结果交给 NextTavern 的请求组装与材料发布流程。模板求值是程序计算，不为一次条件判断增加模型请求。

EJS 适合“根据已有资料决定本轮写出什么”。例如体力不足时加入休息提示、从世界书取出告示、按条件组织背景。数值更新仍由[原生状态系统](NATIVE-STATE.md)提交；模板读到数值不代表它拥有写回权限。

### 从 Native 1.0 直接使用

在第 1 节完整卡的守塔人 `content` 中追加下面的模板文字即可；它不要求添加 Schema、远程 helper 或固定脚本声明：

```ejs
守塔人今天检查了<% const floors = 2 + 3; %><%= floors %>层楼梯。
```

将内容保存回 JSON 字符串时，仍需按 JSON 规则转义换行与引号。导入后，作者编辑器保留模板原文；后续 Story／生成开场的实际请求材料中，该部分渲染为 `守塔人今天检查了5层楼梯。`。`floors` 只是当前模板的局部变量，不会保存为聊天数值。**选择并复制已有作者开场**仍是复制正文，不能用这个动作验证 NPC 提示模板已经执行。

原生来源路径称为 prompt-program，可以同时处理普通作者模板和纯数据 InitVar：无需为了加一条 EJS 表达式补一个空 Schema。区别在于，InitVar 的 JSON／YAML 数据载荷本身不能嵌 EJS 求值；模板与初始化数据各走自己的处理步骤。

### 执行位置与阶段

EJS 只在已接入的作者材料上执行，不遍历卡 JSON 中的所有字符串：

| 材料 | 当前执行边界 |
| --- | --- |
| Native `cards[].content`、`worldbook[].content`、`rules` 的五个正文键、`status.text` | 允许作为模板来源；在对应材料实际消费时渲染，不代表每个字段在所有预设中都常驻注入 |
| Native 1.1 的执行资料 | 普通剧情沿 `compatibility.authorExecution` 的对应来源读取；高级人物不因此再执行一遍模板 |
| 社区卡的人物、场景、规则与示例字段 | 按当前来源进入对应作者模板链；无内嵌世界书的 CCv2／CCv3 另有专用六字段路径 |
| `character_book.entries[*].content` | 本轮选中的世界书条目可独立渲染；`getwi` 显式读取的目录条目可嵌套渲染 |
| `InitialVariables` 提示变量材料 | 有独立的来源、模板渲染、解析及合并链；与 MVU 的 `[InitVar]` 不是同一入口 |
| 开场 | 没有“任意开场都自动执行 EJS”的通用合同；无世界书的社区六字段路径要求普通开场及身份宏，EJS 开场会被拒绝 |
| 普通历史、模型生成正文 | 不因含有 `<%…%>` 就重新执行作者程序 |
| 社区 preset 的普通 `content` | 使用其 `{{…}}` 宏链，不因选择了 preset 就自动执行 EJS |

社区六字段指 `description`、`personality`、`scenario`、`mes_example`、`system_prompt`、`post_history_instructions`。这是社区来源的专用路径，Native 卡使用自己的字段来源记录。

正常世界书材料依次经过**宏展开 → 被选条目的 EJS → WORLD_INFO 请求正则**；`getwi` 读取的目录正文则经过自己的**来源正则 → 宏 → 同一执行环境内的嵌套 EJS**。人物与规则等作者字段在其实际贡献阶段渲染。不要将“所有正则总在 EJS 前面”或“所有模板总在扫描之前”作为作者假设。

渲染得到的新宏文本或新 `<%…%>` 不会因为出现在输出里，再自动执行一遍。`getwi` 是明确的嵌套读取入口，不是对任意输出递归求值。

### 标签、局部 JavaScript 与输出

| 写法 | 当前语义 |
| --- | --- |
| `<% const n = 3; %>` | 执行局部代码，不自动输出值 |
| `<%= n %>` | 将表达式转为字符串并直接输出 |
| `<%- n %>` | 同样直接输出；当前与 `<%=` 没有 HTML 转义差异 |
| `<% if (…) { %>正文<% } %>` | 根据条件选择文字；普通局部函数、闭包和循环也可使用 |
| `<%= await getwi('标题') %>` | 等待受支持的异步读取，再输出文字 |
| `<%_`、`_%>` | 支持相应的水平空白裁剪；结束裁剪还吞并紧随的一次换行 |

完整 EJS 中常见的 `<%# … %>` 注释、`<%% … %%>` 字面标签和 `-%>` 结束写法当前会被拒绝。可以在代码标签里使用普通 JavaScript 注释。`include`／partials 不在该子集内。

模板输出是后续使用方的文本输入。两种表达式标签都不替作者做 HTML 转义，不应把 `<%=` 当作网页安全过滤器。是否按 HTML 展示，仍由阅读器与对应显示链决定。

### `getvar`：读取已捕获的作用域

常用形式是 `getvar(key, 'chat')` 或 `getvar(key, {scope:'chat', defaults:0})`。先明确读取哪种数据，再选作用域：

| 作用域 | 数据含义 |
| --- | --- |
| `chat`／`local` | 当前聊天绑定；有效数值状态通常通过 `stat_data` 对象提供，`local` 是 `chat` 的别名 |
| `message` | 当前消息绑定；只有实际捕获该绑定时可读 |
| `card`、`script`、`global` | 对应卡、脚本、全局绑定；不能假定每次来源都会提供全部作用域 |
| `initial` | 提示模板初始变量；不是卡中 MVU InitVar 的别名 |
| `cache` | 本轮已经捕获的合并视图，也是省略 scope 时的默认值 |

正常 `cache` 按 `global → initial → chat → message` 做浅覆盖，再附加执行跟踪字段。它不会为每次读取重新查询数据库，也不对嵌套对象逐层合并。已经有有效 `chat` 数值快照的作者模板或本轮世界书条目可写：

```ejs
来客当前体力：<%= getvar('stat_data.角色.体力', 'chat') %>
<% if (getvar('stat_data.角色.体力', 'chat') <= 2) { %>
来客需要休息。
<% } %>
```

体力 9 时只输出第一行和模板中的空白；体力 2 时还输出休息提醒。模板只组织提示，没有扣除或恢复体力。可以在[纯数据初值示例](NATIVE-STATE.md#2-给-native-10-卡加入初值)的普通作者字段中加入模板；整卡进入可组合的程序来源路径，而 InitVar 仍按原始数据初始化。

完整的受支持参数形状为：

```typescript
declare function getvar(key: string | null, scope?: string): unknown
declare function getvar(key: string | null, options?: {
  scope?: string
  defaults?: JSONValue
  index?: number | null
  clone?: boolean
  noCache?: boolean
}): unknown
```

- 路径先匹配完整字面 key，再解释点号／方括号路径。例如实际存在 `"角色.体力"` 这个完整 key 时，它优先于嵌套的 `角色 → 体力`。
- 缺失 key 默认返回 `null`，可用 `defaults` 指定替代值；真实的 `null`、`false`、`0`、空串不会被默认值覆盖。作用域本身不可用会拒绝，`defaults` 不能创建作用域。
- `key:null` 返回该作用域整体。默认返回只读数据；`clone:true` 给可修改的局部副本，也不会写回数值。
- `index` 用于解析字符串中的 JSON 后按非负索引取值，不是对任意对象的通用下标。`noCache:true` 当前不支持。
- 兼容语义中，字符串参数 `'message'` 读取明确的消息绑定，而选项 `{scope:'message'}` 映射到合并 `cache`。需要当前数值时，优先像上例一样明确写 `'chat'`。

### `getwi` 与 `activateWI`：读取和激活是两件事

```text
await getwi(titleOrUidOrRegExp)             → string
await getwi(worldName, titleOrUidOrRegExp)  → string
activateWI(titleOrUidOrRegExp)             → boolean
activateWI(worldName, titleOrUidOrRegExp)   → boolean
```

这是一组调用形式说明。`getwi` 按实际主世界书名称、条目 `comment` 标题或 UID 查询，也支持受维护的正则查询；**不是按条目的 `keys` 关键词查找**。查询命中的内容可继续在同一环境中执行嵌套 EJS；没找到返回空字符串。必须等待结果，直接输出 Promise 会拒绝。

例如，主书 `name` 为 `雾港资料`，其中一个条目 `comment` 为 `潮汐告示`、`content` 为 `今晚高潮在午夜。`。另一个本轮已经命中的世界书条目可使用：

```ejs
灯室墙上的告示写着：<%= await getwi('雾港资料', '潮汐告示') %>
```

输出为 `灯室墙上的告示写着：今晚高潮在午夜。`。目标告示不需要同时通过普通关键词命中。显式目录读取可以与普通准入不同，包括读取目录内禁用条目；读取不会把该条目设为启用。

`activateWI` 使用同类查询参数，同步返回 `true` 并记录去重的激活提案。它只适用于当前允许激活的条目和执行阶段，最终仍由世界书所有者决定怎样准入，不会永久改写 `enabled`。人物／规则末段的 `late-author` 渲染阶段已晚于世界书求值，该阶段的激活提案会拒绝；不要在普通人物描述里用它强迫本轮重新扫描。

### 提示注入：注册与消费切点

高级作者可以通过以下 API 提交提示注入；这里是参数形状参考，需要先确认模板实际执行阶段，不是一段可放在任何字段、立即影响本轮的通用代码：

```typescript
type PromptInjection = {
  id: string
  position: 'in_chat' | 'none'
  depth: number
  role: 'system' | 'user' | 'assistant'
  content: string
  should_scan?: boolean
  filter?: () => boolean | Promise<boolean>
}
declare function injectPrompts(
  prompts: PromptInjection[], options?: {once?: boolean}
): {uninject(): void}
declare function uninjectPrompts(ids: string[]): void
```

`id`、`position`、`depth`、`role`、`content` 必填。`should_scan` 与 `once` 默认都是 `false`；过滤函数必须最终返回严格的布尔值。返回对象的 `uninject()` 移除该批注册 ID，也可通过 `uninjectPrompts` 按 ID 移除。

注入由原生材料流程保存和消费，不依赖 Worker 一直驻留。`late-author` 阶段发生在本轮扫描和聊天注入消费切点之后：该阶段的持久注册供后继 generation 使用；`once` 注册会在本轮终止边界清理。因此不能保证在人物描述末段调用注入，就改变当前已经组装的请求。相同计划的重试不重复结算副作用；父世界线的活动注册也不会仅凭归档自动继承到子线。

### 执行预算、失败与能力边界

模板使用冻结时钟和本轮随机种子：`Date.now()`／无参数 `new Date()` 不读取任意变化的墙钟，`Math.random()` 按本轮确定的顺序抽取。结果可与相应来源和执行记录联系起来；这些值不适合代替需要独立持久记录的游戏抽签结果。

当前单模板源上限为 16,384 字符、输出上限为 65,536 字符，VM 执行预算为 250 ms，父级等待上限为 1.5 s；另有嵌套深度、累计输入输出和 helper 次数预算。这些限制不是模型响应时间限制。不要在模板中轮询外部状态或写无限循环。

该模板接口不提供持久 `setvar`／MVU 写入、Schema 注册、`getVariables`、slash 命令或通用事件订阅；`process`、`require`、联网及 DOM 接口也没有作为模板能力提供。数值、Schema 和浏览器交互应使用它们各自的作者入口。

未支持的 helper、不可用作用域、坏标签、超时、取消或过期来源会产生明确拒绝，不把半份输出当成成功材料。已识别 helper 的拒绝不能靠作者 `try/catch` 吞掉后继续发布。排错时先看来源字段与诊断，再检查作用域、查询标题和执行阶段；不要让模型猜测并替模板执行器补算。

## 9. 兼容资料与开放扩展

`compatibility.sillytavernMacroFields` 是一个“键到字符串”的对象，用于保留激活时 ST 字段的宏别名资料。已有读取器关注 `description`、`personality`、`scenario`、`mes_example`、`system_prompt`、`post_history_instructions`；这些别名由既有受保护的提示词渲染器展开，不能替代当前作者正文或另加一套提示词注入。

`compatibility`、`settings`、人物行、世界书行及归档允许未知字段，为迁移和工具扩展保留资料。应区分三种情况：

- **格式可保存**：字段能通过开放对象保留，不代表运行时读取它。
- **已有能力读取**：如开场目录、原生世界书、已支持的宏、正则或美化字段，按各自合同执行。
- **需要外部环境**：未封装的图片、音频、远程页面或第三方插件资料，不会因导出 JSON 自动一并安装。

作者应使用 `characterId` 等可移植标识。`id`、`importId`、`sources`、`verified`、本地 `schemaVersion`／`version`、创建与更新时间、`tavern`、`editedFrom` 等是运行记录中的保留字段；行级导出与激活会移除这些本地字段，`beauty.sources` 也不会作为跨环境权限保留。`authorExecution.schemaVersion` 则是格式明确规定的版本字段，两者不能混淆。

## 10. 导入、互动写卡、转换与导出

| 作者动作 | 得到什么 | 作者应检查什么 |
| --- | --- | --- |
| 上传原生 JSON | 解码后按原生栏目载入 | 人物是否分行、玩家身份是否正确、开场列表是否完整 |
| 上传社区 PNG／JSON 或文本资料 | 沿对应导入流程读取原资料 | 不要把成功导入等同于已经完成原生人物分类 |
| 互动写卡／小说改编定稿 | 共同定稿入口保存原生文档 | `characterId`、实际 JSON 栏目、玩家确认后的应用范围 |
| 转换并应用到当前对话 | 保存当前来源对应的分类关联 | 高级人物是否符合原文；普通执行资料是否仍完整 |
| 导出上传源文件 | 当时上传的文件名、类型和原始字节 | 后来的作者编辑不会合并进原件 |
| 导出当前原生卡 | 当前已保存的作者设定、所需版本及归档 | 这是可继续创作的卡，不是完整聊天备份 |

转换并应用不重新导入原件、不重插开场、不新增剧情轮次，也不改写旧正文。有效原生结构的读取、合并和导出由程序完成，不需要为了识别已有栏目再调用模型。混合社区资料需要语义归属时才运行分类任务；一次任务可能包含续步或重试，不能将“一次转换”等同于一次 HTTP 请求。

没有上传原件的互动写卡，两种导出入口都提供当前原生卡。DOCX 的原始文件字节与抽取文本分别保存。把导出的 JSON 上传到另一工作区后，这份 JSON 成为那次上传的原件；不能从中声称恢复更早的 PNG 文件字节。

社区卡转换后的导出还可能保留原有 CCv2／CCv3 外壳，并在 `data.extensions.dsh_nexttavern_author` 写入版本化原生作者资料。该受支持扩展用于 NextTavern 再导入；看到外壳仍是 `chara_card_v2`／`chara_card_v3`，不代表内部转换没有保存。其他客户端是否理解这份扩展取决于其实现。新写的上例则直接使用 `nexttavern_card` 外壳。

## 11. 作者的验证顺序

1. **先验格式。** 使用支持 JSON Schema Draft 2020-12 的工具检查完整文件；确认没有注释、尾逗号、字符串内的未转义换行。必填的 `cards`、`worldbook`、`rules` 和 `archive` 即使为空也要保留。
2. **核对身份与栏目。** 为人物提供稳定且唯一的 `characterId`；只将玩家资料标为 `user`。确认当前事实、未来路线和文风样本没有混在一起。
3. **在独立创作会话试导入。** 打开人物、规则和世界书编辑视图核对内容。检查每个开场的标签与预览，再明确选择一个；另开创作会话试另一个开场，避免把两条起点写进同一条历史。
4. **检查可观察行为。** 与守塔人交谈，检查是否代替玩家决定、是否提前知道未揭露线索；查询潮洞资料，检查常驻背景与条件资料的区别。加数值、美化或模板后，分别核对对应结果。
5. **需要角色协作时再检查高级视图。** 看人物名称、正文和知识边界是否正确。社区卡通过转换建立分类后，编辑相关来源时留意失效提示。
6. **导出并重新导入。** 下载当前卡，在另一个创作会话载入，检查人物、规则、世界书和开场选项。要交付原始素材时另外下载原件；外部素材单独说明依赖。

通过互动写卡定稿时，可让助手使用 `rp_card_draft_check` 检查工作区 JSON 草稿。该工具要求对整体概述、世界观、势力、地点、人物、剧情、文风、开场、状态、规则、美化与正则共 12 项提交实际栏目引用与审阅依据；不需要的状态、美化或正则可明确标为不需要。它检查结构、人物身份及实际配置，**不会激活卡，也不能代替创作质量和视觉检查**。确认后再由共同定稿入口 `rp_commit_card` 应用。

### 常见问题

| 现象 | 原因与修改方向 |
| --- | --- |
| 文件能过 Schema，互动写卡却拒绝定稿 | 检查人物的 `characterId`；Schema 的开放字段规则不替代定稿入口的唯一身份要求 |
| 守塔人替玩家说话，或把未来结局当成事实 | 明确 `user` 行和人物知识边界；把可能路线移到 `plot`，把实际事实留在 `core` |
| 开场多了一份，或备选没有正文 | `catalog` 只放备选；每项键名是 `rawText`，不是 `text`、`content` 或 `first_mes` |
| 占位符原样显示 | 检查是否为 `materialized` 主开场、宏名称是否受支持，以及当前是否提供了该宏上下文 |
| 条目已保存在文件中，却没进入本轮 | 检查启用、触发词、常驻设置和预算；高级分类引用不会强制准入 |
| 加了 `status.text` 却没有实时数值 | 它是展示说明；按状态指南另写初始化与更新合同 |
| 改成 1.1 后高级功能仍未就绪 | `authorExecution` 必需但不充分；需要基于当前来源的有效分类，不要手写 ready 或 verified 标记 |
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
| 分类输入、跨度验证、原文物化与 1.1 产物 | [native-card-conversion.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-conversion.ts) |
| 高级视图、来源失效与静态人物 | [native-card-advanced.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-advanced.ts) |
| 本轮动态材料与高级人物消费 | [native-card-advanced-material.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/native-card-advanced-material.ts) |
| EJS 标签与支持预算 | [tavern-template-compiler.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-compiler.mts)、[tavern-template-data.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-data.mts) |
| EJS 的真实执行、变量和世界书 helper | [tavern-template-worker.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-worker.mts)、[tavern-template-injection-guest.mts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-injection-guest.mts) |
| Native 模板来源与纯数据初值组合 | [roleplay-prompt-program-source.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-prompt-program-source.ts)、[roleplay-prompt-opening-source-data.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-prompt-opening-source-data.ts) |
| 世界书渲染与请求时序 | [roleplay-tavern-prompt-render.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-tavern-prompt-render.ts)、[roleplay-tavern-prompt.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-tavern-prompt.ts) |
| 当前作者资料、开场和导出外壳 | [roleplay-native-card-export.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-native-card-export.ts) |
| 原生世界书检索与作者规则贡献 | [roleplay-author-context.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-author-context.ts)、[roleplay-author-contributions.ts](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-author-contributions.ts) |
