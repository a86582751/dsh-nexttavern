# NextTavern 原生状态系统：MVU 兼容与 Ruby 分析

本文说明 **0.3 开发源码中的状态机制**，供卡作者设计初值、更新规则和可选分析。0.3 尚未正式发布，完整卡玩法、恢复和性能仍在验收；本文的字段和执行说明不代表所有社区 MVU／RUBY 版本均已兼容。发行状态见[开发日志](DEVELOPMENT-0.3.md)，卡文件结构见[原生卡格式](NATIVE-CARD-FORMAT.md)。

快速查阅：[设计定位](#设计定位原生运行机制兼容社区协议与作者能力) · [完整初值卡](#2-给-native-10-卡加入初值) · [回合更新](#3-一回合如何提交数值) · [Schema 与 EJS](#4-schemaejs-与纯数据路径的边界) · [世界线与编辑](#5-世界线编辑重生成与手动修改) · [Ruby 分析](#6-ruby按周期产生分析材料)

## 设计定位：原生运行机制，兼容社区协议与作者能力

**NextTavern 自己管理数值状态和分析任务；社区 MVU／RUBY 是这些原生机制的兼容入口。** 对卡作者来说，可以直接创作原生卡，也可以把已有社区卡的初值、更新协议、Schema 和分析配置接入受支持的执行链。

这里所说的“原生状态机”，指的是 NextTavern 掌握状态如何从初值推进到当前值，以及任务怎样调度、完成、取消、恢复和发布。数值内容是作者定义的 JSON；不要求每张卡写一张固定的有限状态转移表。实现上分为两个协作系统：

| 系统 | NextTavern 原生负责 | 兼容社区的部分 | 最终产物 |
| --- | --- | --- | --- |
| 数值状态系统 | 初始状态、回合基线、候选计算、提交记录、手动修改、世界线继承及版本恢复 | `[InitVar]`、`UpdateVariable`、JSONPatch、受支持的旧式命令、Schema 和作者事件能力 | 当前世界线已提交的结构化状态 |
| Ruby 分析任务系统 | 周期和增量窗口、任务身份、模型执行、取消／重试、结果发布与分支继承 | `RubyAnalyzer` 中受支持的任务、提示、关键词及输出配置 | 分析文本和可供后继剧情使用的聊天世界书材料 |

因此，Ruby 与数值系统有各自的状态和生命周期。Ruby 写出“来客已经疲惫”的分析，不会直接把 `角色.体力` 改成 0；分析先成为后继剧情的材料，真正的数值变化仍需经过数值更新与提交链。

### 代码中的职责边界

1. **作者资料决定输入。** 来源模块读取当前卡、所选开场和世界线，将纯数据初值或 Schema 作者程序交给对应执行器。
2. **计算只产生候选。** 纯数据 reducer 解析更新并计算新值，本身不写存档。正文完成后，原生完成流程把候选与本轮基线、实际正文版本联系起来。
3. **原生提交决定生效。** 状态模块保存版本化事件、当前状态头和提交结果；只有提交后的值进入下一轮。分支与恢复沿真实切点和既有记录处理，不让浏览器显示或一段新解析出的文本自行成为权威状态。
4. **分析有独立任务身份。** Ruby 调度器只确定哪些任务到期；原生任务系统负责模型执行和完成记录。成功结果经发布后，才作为世界书材料提供给后继剧情。

对应实现可从[数值提交](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-state.ts)、[正文完成协调](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-story.ts)、[世界线状态派生](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-derived.ts)、[Ruby 生命周期](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-ruby-owner.ts)及[原生任务调用](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-task-host.ts)核对。

### 兼容不只涉及标签解析

纯数据卡由 NextTavern 的确定性实现处理，无需加载社区 MVU 插件。已识别的固定 MVU loader 声明会映射到原生状态能力，原 loader 源码保留在来源中；它与真正需要执行的 Schema 作者脚本分别处理。

Schema 作者脚本中受支持的默认值、转换、校验和回调仍会在隔离执行器中运行，再将结果交回原生生命周期。因此这里的兼容覆盖**数据、协议及部分作者行为**，同时有明确的版本和 API 范围。它既不是完整搬运某个社区插件，也不能简化成只替换几种文本标签。作者仍需为作品依赖的具体能力选择正确入口。

## 1. 先分清三种“状态”

| 内容 | 保存什么 | 谁使它生效 |
| --- | --- | --- |
| 原生数值状态（MVU 兼容） | 角色、物品、位置、时间等 JSON 数据，字符串和开关也属于数值状态 | 初始化、更新执行器和原生持久提交链 |
| 状态栏／决策卡 | 面向玩家的叙事展示与建议 | 对应状态／决策任务和界面 |
| Ruby 分析 | 作者配置的分析文本，以及由结果形成的聊天世界书材料 | Ruby 调度、模型任务和发布链 |

正文说“守塔人恢复了体力”，不会直接修改 JSON。刷新状态栏也不会提交数值。只有更新候选被执行、接受并提交后，数值面板和后继剧情才读取新值。

卡中的 `data.status.text` 是作者状态设定，`data.character_book`／开场中的初值是新游戏的起点；两者都不是已经游玩的实时存档。导出当前原生卡保存作者设定，不应据此期待把整条世界线的数值历史搬到另一台机器。

## 2. 给 Native 1.0 卡加入初值

最小纯数据路径不要求安装远程 MVU 脚本。把初值放在 **`data.character_book.entries` 的 `[InitVar]` 条目**，把玩法规则放在 `data.rules`。下面是完整 Native 1.0 JSON，可保存为 `雾港灯塔.json`，经“角色卡导入”建立新对话并选择作者开场：

```json
{
  "spec": "nexttavern_card",
  "spec_version": "1.0",
  "data": {
    "name": "雾港灯塔",
    "cards": [
      {"characterId": "visitor", "name": "来客", "kind": "user", "content": "玩家扮演来到雾港灯塔的来客。"},
      {"characterId": "keeper", "name": "守塔人", "kind": "npc", "content": "守塔人维护雾港灯塔，愿意陪玩家检查灯室。"}
    ],
    "worldbook": [],
    "rules": {
      "core": "玩家明确完成一次登塔行动时，角色.体力减少1；完整休息一次恢复2。没有发生行动时保持数值，不替玩家决定行动。"
    },
    "character_book": {
      "name": "雾港灯塔初值",
      "entries": [
        {
          "id": 1,
          "comment": "[InitVar] 游戏初值",
          "keys": [],
          "enabled": false,
          "insertion_order": 100,
          "content": "{\"角色\":{\"体力\":10,\"背包\":[\"提灯\"]},\"世界\":{\"地点\":\"灯塔门口\"}}"
        }
      ]
    },
    "opening": {
      "text": "雾港灯塔的门打开了。守塔人提起灯：要先登塔，还是在门厅休息？",
      "materialization": "materialized"
    }
  },
  "archive": {}
}
```

本例的 `角色.体力` 和 `角色.背包` 属于来客（玩家），预期初值为体力 10，背包有“提灯”。这里 `enabled:false` 是有意的：初值读取按条目的 `comment` 查找 `[InitVar]`，不以普通世界书的启用开关过滤；这样初值可以参与初始化，又不作为普通常驻世界书反复注入剧情。将这个条目放进 `data.worldbook` 的普通作者行，或只把它命名为“初始数值”，不等于建立相同初始化来源。

当前有效数值进入 Story 时，系统会附上完整 JSON 基线和更新协议说明。作者只需写清楚“什么剧情导致什么变化”，无需把整段更新标签复制到纯数据卡的规则里。初值导入成功仍需检查一次实际行动：向模型明确提出登塔，正常结果应给出减少体力的候选，提交后面板为 9；模型没有输出候选时，程序不会从叙事含义猜算减法。

### 初值字段与格式

| 字段／位置 | 当前含义 |
| --- | --- |
| `character_book.entries[*].comment` | 含 `[InitVar]`，大小写不敏感；参与初值读取 |
| `content` | JSON 对象文本；也有独立的 YAML 1.2 JSON 数据路径，不是 JavaScript |
| `enabled` | 普通世界书准入开关；不用于关闭已标记的 InitVar 数据读取 |
| `opening.text` 或目录项的 `rawText` | 可在模板开场中声明 `<InitVar>…</InitVar>`，仅对应实际选择的开场 |
| `opening.materialization` | `template` 是待处理作者模板；`materialized` 是已物化正文，不再扫描其 InitVar 来重新初始化 |

纯数据根必须是对象，例如 `{"角色":{"体力":10}}`；数组、单个数字不是可用根。JSON 使用双引号，不接受注释、尾逗号或把坏 JSON 自动改当 YAML。YAML 路径处理可转换为有限 JSON 的数据，不接受任意 YAML 对象标签或执行代码。初值数据受 1 MiB、32 层、32,000 节点、单数组 4,096 项等限额约束，数值必须有限且绝对值不超过 `Number.MAX_SAFE_INTEGER`。

初值中的 `{{user}}`、`{{char}}`、`{{user_gender}}` 只有在实际来源提供相应身份绑定时才可展开；这不是通用预设宏或 EJS 环境。`$schema`、`$default`、作者回调等不能塞入纯数据初值，期待它们在该路径执行。

### 合并与开场优先级

原生纯数据来源当前限定为卡内嵌的主 `character_book`，不能把全局／附加世界书当作已经接通的初始化输入。底层计算器支持的书顺序并不等于 Native 导入已经公开这些绑定。

1. 同一主世界书中，多个 `[InitVar]` 条目按来源顺序合并；对象递归合并，后条目的标量和数组替换前值。
2. 既有书基线保留自己的顶层值；已初始化书不会因为界面刷新再读一次。新卡的新游戏通常从空基线开始。
3. 如果**所选模板开场**含 InitVar，开场中的多个块先合并，然后**整份替换主书的初值**。不是仅覆盖开场写出的几个叶子字段。

例如，把下面的 **`data.opening` 替换片段**用于上面的卡，新游戏会从体力 6 开始；主书中的背包和地点不会自动补回，因而片段明确重新写全需要的字段：

```json
{
  "opening": {
    "text": "你已经登上灯室。\n<InitVar>{\"角色\":{\"体力\":6,\"背包\":[\"提灯\"]},\"世界\":{\"地点\":\"灯室\"}}</InitVar>",
    "materialization": "template"
  }
}
```

这是 `data` 内部片段，不是另一份完整卡。候选开场分别计算初值，实际正文和数值必须来自同一个被选中的开场。已经开玩的会话不会因为改了卡文件，自动变成“用新初值重开”。

## 3. 一回合如何提交数值

| 阶段 | 实际工作 | 作者可观察结果 |
| --- | --- | --- |
| 准备 | 读取当前世界线已提交的 JSON，冻结本轮基线；附加更新协议与玩法规则 | 模型看到当前值，而非只看卡里的初值 |
| Story | 模型写正文，并在需要变化时输出一个更新候选块 | 流式显示仍是候选，尚不等于提交 |
| 执行 | 正文完成后解析候选，按相应协议计算；Schema 卡另走其作者执行链 | 无更新、接受或具体拒绝原因 |
| 发布 | 核对本轮实际正文、来源、基线和执行身份，追加状态记录 | 面板出现新值／新版本，后继请求可用 |

开场同样需要实际正文先被 Native 历史提交，再发布与之对应的初值。失败正文、未选中的候选、过期生成结果不会仅因含有更新标签就成为有效状态。没有候选意味着保持当前值，不是请求另一个模型替作者推导更新。

### 推荐：JSONPatch

下面是**模型回复末尾片段**，用于初值已经是体力 10 的那一回合；不是卡 JSON，也不是要在聊天里执行的命令：

```text
守塔人带你登上灯室，你停下脚步喘了口气。
<UpdateVariable>
<JSONPatch>
[{"op":"test","path":"/角色/体力","value":10},{"op":"replace","path":"/角色/体力","value":9}]
</JSONPatch>
</UpdateVariable>
```

接受后体力为 9。`test` 用于确认前值，可按需省略；前值已不是 10 时，本例整批拒绝。路径相对于状态对象，不带 `/stat_data` 前缀；`stat_data` 是部分作者 API 的数据包装名。

| 操作 | 数据语义 |
| --- | --- |
| `test` | 比较目标与 `value`，不相等则失败 |
| `replace` | 替换已存在的目标 |
| `add` | 向对象写 key，或向数组插入；父路径必须存在；数组 `-` 表示末尾 |
| `remove` | 删除已存在的目标；不支持删除根 |
| `copy`／`move` | 从 `from` 复制／移动到 `path`；不是执行表达式 |
| v2 的 `delta` | 数字增量，例如 `{"op":"delta","path":"/角色/体力","value":-1}` |
| v2 的 `insert` | 容器插入，最后一个路径段是 key／数组位置；不等同 RFC 的 `add` |

`path`／`from` 是严格 JSON Pointer：`~0` 表示 `~`，`~1` 表示 `/`。数组索引随前序操作变化。每个更新块和 JSON 载荷最多 65,536 字节，最多 64 操作，路径最多 32 层；结果仍须满足有限 JSON 数据合同。

### v2：旧式字面量命令

下面是和上例**二选一**的模型回复片段。在体力 10、背包已有“提灯”的基线上，接受后体力为 9，背包增加“绳索”：

```text
<UpdateVariable>
_.add('角色.体力', -1);
_.insert('角色.背包', '绳索');
</UpdateVariable>
```

| 命令 | 支持的含义 |
| --- | --- |
| `_.set(path, value)`／`_.set(path, old, value)` | 写最后一个参数；三参数形式**不比较** `old`，需要比较请用 JSONPatch `test` |
| `_.add(path, delta)` | 现有数字加上数字增量；结果按十二位有效数字舍入 |
| `_.insert`／`_.assign` | 一个值时向数组追加或合并对象；key/index 加 value 时插入容器 |
| `_.delete`／`_.remove`／`_.unset` | 无选择器时删除路径；也可按数组索引／值、对象字面 key 删除 |

路径可用 `角色.体力` 或 `角色['体力']`，目标及所需父路径必须存在。`set` 对 `[值,"说明"]` 的二项数组可仅替换首项并保留说明（首项不能是数组）；`add` 可更新首项为数字的这种包装。建议新卡直接使用清晰的 JSON 值，避免让同形数组同时承担多种含义。

这些命令由有限字面量解析器解释，必须以分号结尾。字符串可用单／双引号或不含插值的反引号；不支持函数调用参数、表达式、`${…}`、`Date`、`undefined`、文本形式 `_.move`、按对象枚举位置的数字删除或隐式创建缺失路径。不要混用 JSONPatch 数组和旧式命令，也不要输出多个／嵌套的 UpdateVariable。可选 `<Analyze>…</Analyze>` 只作为块内分析文本，不获得执行能力。

纯数据 v1／v2 批次均不会发布半份结果；v2 明确采用 `atomic-refusal`。历史记录按其原协议解释，新协议的支持项不会反过来改变旧记录的含义。

## 4. Schema、EJS 与纯数据路径的边界

纯数据初值负责存值，不运行作者程序。**EJS 与纯数据 InitVar 可以在同一张 Native 卡内使用，无需增加 Schema**：普通人物／规则等作者内容由模板链处理，初值仍由程序按原始 JSON／YAML 计算。整卡会使用相应的 prompt-program 来源路径，不能把它仍描述成仅走旧纯数据来源。初值数据载荷自身不接受 EJS 或 `registerMvuSchema(...)`；也不要把上面的模型回复更新块原样贴到 `rules.core`，将协议输出混成作者规则。

Schema 卡由受维护的作者脚本来源、编译器、固定依赖映射和隔离执行器共同处理。初值之后可应用作者 Schema 的默认值、转换和校验；Story 更新经过 `command-parsed`、`commands-parsed`、`update-ended` 阶段，手动改值有 `manual-replacement` 阶段。模型输出仍是数据候选，Schema 不把模型正文当任意程序执行。

下面是**Schema 作者脚本正文片段**，用于解释体力约束，不是可独立上传的卡；需由实际卡的作者脚本来源接入，且执行环境提供 `z` 与 `registerMvuSchema`：

```javascript
registerMvuSchema(z.object({
  角色: z.object({
    体力: z.number().min(0).max(10),
    背包: z.array(z.string())
  }),
  世界: z.object({地点: z.string()})
}));
```

例如手动保存体力 11 会被这条规则拒绝。若希望体力上限自动截断，作者应编写对应转换规则；仅有 `.max(10)` 不等于自动截断。Schema 的逐命令接受、丢弃和批次校验策略取决于实际版本化执行合同，不能把纯数据的整批拒绝承诺套到所有社区 Schema。已识别的固定 helper／Schema 导入由原生映射处理，不会因此下载并运行任意远程模块。

### 读取当前数值的 EJS 片段

已经接入模板执行链、且本轮 `chat` 数值快照有效时，可以在作者模板中读取：

```ejs
来客当前体力：<%= getvar('stat_data.角色.体力', 'chat') %>
<% if (getvar('stat_data.角色.体力', 'chat') <= 2) { %>
来客需要休息。
<% } %>
```

体力为 9 时输出“来客当前体力：9”，不会输出休息提醒。它是**普通作者内容中的模板片段**，可以与第 2 节初值同卡使用，但不能写进 InitVar 数据载荷。模板读冻结的当前作用域，不是每调用一次就读取实时数据库；读取不修改数值。

`getvar('键', {scope:'chat', defaults:0})` 的默认值只用于该键缺失；作用域本身不可用会报错，不会借另一条世界线的值补齐。`initial` 也不是 InitVar 的别名。完整标签、变量作用域、`getwi`、激活与提示注入、执行时机及限制见[原生卡 EJS 作者章节](NATIVE-CARD-FORMAT.md#8-ejs-作者模板动态文本与世界书联动)。模板可以读取已提交值并影响提示文本；持久数值的权威仍属于更新与提交链。

预设的 `{{getvar::…}}` 是另一套宏变量语法，不能拿它读取 MVU 路径，详见[预设手册](COMMUNITY-PRESETS.md#5-宏变量世界书与历史的组装)。

## 5. 世界线、编辑、重生成与手动修改

| 操作 | 对状态的含义 |
| --- | --- |
| 从历史切点创建世界线 | 继承切点所对应的状态和来源；父线后来的更新不覆盖子线，子线也不回写父线 |
| 从更早位置重生成 | 使用该真实切点的有效基线；旧候选不能与新正文拼接 |
| 编辑已经提交的正文 | 原数值依赖的消息版本可能失效；按界面提示从编辑影响之前重生成 |
| 修改卡资料／Schema | 来源发生变化，旧派生结果不能当作新来源已执行；核对来源并重新载入相应流程 |
| 打开／刷新数值面板 | 读取当前提交结果，不重跑 InitVar 或更新块 |
| 在面板保存数值 | 单独的手动提交；Schema 卡按角色规则处理，保存不等于编辑卡初值 |

在状态栏找到“**游戏数值**”，可编辑字段或展开“高级：完整数值 JSON”，再点“保存数值”。回合进行中、来源变化或正文编辑影响未确认时，面板会禁止保存并解释原因。其他操作改变了基线时，用“载入最新值并比较草稿”合并；回应丢失时用“重试上次保存”，它保留同一次保存身份，不会另做一次数值操作。

已接受的更新块可以在 Reader 隐藏，但只在它与当前消息版本及已接受协议相符时隐藏。拒绝、陈旧或仅被引用的块保留线索；显示正则删掉标签不能使候选变成有效数值。正常重开恢复、取消、进程中断后的恢复各有边界，不能用某一次成功恢复推断所有故障都无损。

## 6. Ruby：按周期产生分析材料

这里的 Ruby 兼容入口读取 `data.extensions.RubyAnalyzer` 中的社区分析配置，交给 NextTavern 原生任务系统运行；不是 Ruby 编程语言，也不是 HTML `<ruby>` 注音。它与数值更新分开：分析输出是后继剧情可消费的材料，不自动取得修改数值的权限。

### 配置落点和常用字段

| 字段 | 当前作用 |
| --- | --- |
| `activePresetId`／`presets[*].id` | 选择活动分析方案；找不到指定 ID 时取第一项 |
| `tasks[*].id`、`enabled`、`displayName` | 任务身份、启用和界面名称；作者应保持 ID 唯一稳定 |
| `cyclePositions` | 周期位置，可为正整数数组或逗号字符串；别名 `cyclePosition`、`triggerFloor` 也可读取 |
| `promptKey` | 在角色世界书优先、聊天世界书次之查找的任务指令 key |
| `outputKey`／`outputVarName` | 有 `outputKey` 则发布聊天世界书条目，否则保存为 owner output；变量名默认 `task_ID_Output` |
| `keywordScanEnabled`／`keywordScanKeywords` | 对增量文本做不区分大小写的包含匹配；关键词可为数组或逗号字符串 |
| `referencePool`／`useReferences` | 将真实世界书 key 映射成模板变量；引用读取优先聊天世界书 |
| `useOutputs` | 读取指定任务输出变量对应的世界书材料 |
| `outputConstant`、`outputDisable`、`extraKeys` | 输出条目的常驻、禁用及逗号分隔附加 key |
| `position`、`depth`、`order` | 输出条目的注入位置和顺序；`depth` 在位置 4 的深度注入时使用 |
| `selective`、`selectiveKeys`、`noRecursion` | 输出条目的次级关键词和递归控制；它们不绕过正常世界书准入 |
| `jailbreak.items` | 真实作者消息数组，含 `content`、`role`、`enabled`、`position`；位置为 `beforeUser`／`afterUser`／`tail` |

以下是**`data.extensions` 内部配置片段**，并非完整 Native 卡；还必须提供 key 为“灯塔分析指令”的实际世界书条目，内容例如“依据 {{recentMessages}}，只列出本次新确认的灯塔故障。”：

```json
{
  "RubyAnalyzer": {
    "activePresetId": "lighthouse",
    "jailbreak": {
      "items": [
        {"id": "author-system", "enabled": true, "position": "beforeUser", "role": "system", "content": "只整理已发生的剧情事实，不替玩家推进故事。"}
      ]
    },
    "presets": [
      {
        "id": "lighthouse",
        "tasks": [
          {"id": 1, "enabled": true, "displayName": "灯塔故障记录", "cyclePositions": [2], "promptKey": "灯塔分析指令", "outputKey": "灯塔故障记录", "outputVarName": "task_1_Output", "keywordScanEnabled": true, "keywordScanKeywords": ["灯室", "故障"], "outputConstant": true}
        ]
      }
    ]
  }
}
```

这段配置只演示静态任务子集；应与卡的实际世界书查找来源一起接入和测试。Native 作者资料的普通 `worldbook` 行与社区 `character_book.entries` 有不同格式，不能仅把 `promptKey` 当作作者行的展示名称便保证能找到。

### 真正的调度顺序

1. 初次接入采用当前规范助手回复数作为基线，**包含开场**，不补跑之前的任务。管理消息、失败正文和未选候选不计作规范新剧情。
2. 周期长度取所有启用任务的 `cyclePositions` 最大值。第 `n` 个助手回复的位置为 `((n-1) % 周期长度) + 1`。上例长度为 2，因此位置 2 到期，而非“启用后每两条必定立即执行”。
3. 到期任务读取自己上次成功发布书签之后的文本，最多最近 20 个助手回复及相伴玩家消息。默认尝试提取 `content/maintext/text/body/message` 正文，移除 statusblock、options、other、thinking 和 HTML 注释。
4. 无新文本则 `no-new-text`；启用关键词扫描而无匹配则 `keyword-miss`。这两种跳过均不调用模型，也不推进成功发布书签。
5. 找到真实指令、作者消息和引用后生成输入。正文最多保留 200,000 字符；使用 `{{recentMessages}}`、`{{CHAR_NAME}}` 和声明的引用／输出变量进行替换。
6. 模型任务成功且结果仍对应当前执行身份后发布；小于 2 个字符的结果拒绝。成功发布才推进该任务书签，后继 Story 经实际材料组装消费输出。

`startupTask.enabled`、`director.enabled`、外部 `summaryProvider` 的 `littlewhitebox/shujuku/yuzuki/baibaibook`、`gen.enabled:true` 等会明确标为未支持。没有 `jailbreak.items` 的生产任务不能凭空补出上游默认消息。自定义正文标签和模板变量名目前按字面量读取，依赖动态正则模式的配置另有未支持诊断；原生记忆也不等于这些外部总结插件。

在设置 → “**Ruby额外分析**”查看配置状态、配置原因、轮次基线和任务。`supported-static` 表示已映射静态配置，不保证下一轮一定命中。读取／刷新只看状态；失败任务可在处理原因后显式重试。关闭额外分析会停止分析及其派生世界书注入，保留已完成记录；HTML 注音和普通显示正则不受这个开关影响。

## 7. 成本和问题定位

| 工作 | 新增模型请求 |
| --- | --- |
| 初值解码、纯数据更新、Schema 的确定性处理、调度、读取和显示 | 0 |
| Story 附带数值候选 | 沿原剧情请求，不新增数值审查请求 |
| 一个到期且输入合格的 Ruby 模型任务的一次 generation | 正常 1，自动重试 0，回退 0；显式 retry 另计 |
| 作者程序显式生成、用户主动生成开场等 | 按该操作实际请求另计 |

额外处理会改变提示长度、等待时间和输出预算；请求数不变不代表 token 费用不变。Ruby 有多个命中任务就可能有多次额外请求，实际用量仍以任务和“使用统计”为准。

| 现象 | 先检查什么 | 正常预期 |
| --- | --- | --- |
| 没有初值／`GENESIS_UNPROVEN` | 是否经导入建立会话；InitVar 是否在主 `character_book`；是否已选有效开场；是否混入未支持作者程序 | 能确认初值后出现游戏数值，而不是从状态栏猜值 |
| 开场丢了背包字段 | 开场 InitVar 是否只写体力；是否误以为它深合并主书 | 开场替换对象应写全所需字段 |
| 正文正确，数值没变 | 是否真的输出合法更新；路径是否存在；是否有 test／Schema 拒绝；本轮是否已完成提交 | 接受后才有新面板值 |
| `PATH_MISSING`／非法操作 | JSON Pointer、数组顺序、旧式命令路径及是否试图创建缺失父对象 | 修正下一次候选或从有效切点重生成 |
| 编辑后暂不可保存 | 正文版本与数值依赖是否已经失效 | 按提示从影响之前重生成，不用旧草稿覆盖 |
| Ruby 没运行 | enabled、周期基线、到期位置、关键词、真实指令 key、配置原因 | skipped 与 unsupported 都有具体原因，无额外模型调用 |
| Ruby 已发布但后续没引用 | 开关、outputKey、输出条目的 enabled／constant／位置／关键词和世界书预算 | 输出只有进入实际请求材料才影响 Story |

源码定位：[初始化](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-mvu-initvar.ts)、[来源策略](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-source.ts)、[Story 提示](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-author-context.ts)、[纯数据 v2](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-update-v2.ts)、[提交](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-mvu-story.ts)、[模板合同](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-template-data.mts)、[Ruby 配置](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-ruby-config.ts)、[调度](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-ruby-scheduler.ts)、[输入输出](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/roleplay-ruby-input.ts)。源码说明现有开发能力，完整用户操作与卡片兼容仍以对应版本的实际结果为准。
