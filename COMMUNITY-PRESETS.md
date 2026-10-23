# 社区预设与正则：作者手册

本文面向预设作者、卡作者和第三方工具开发者，说明 **0.3 开发源码中的导入与执行合同**。0.3 尚未正式发布；现有受支持样本的限域结果不等于所有 SillyTavern 预设、脚本插件和模型 provider 都兼容。发行状态见[开发日志](DEVELOPMENT-0.3.md)。

快速查阅：[完整预设示例](#2-可导入什么文件) · [条目与功能组](#3-条目排序功能组和采样) · [作用范围](#4-共享库全局与对话范围) · [宏与世界书](#5-宏变量世界书与历史的组装) · [正则参考](#6-正则的导入顺序与字段) · [排错](#7-作者排错顺序与验证边界)

## 1. 预设在请求链中做什么

角色卡提供人物、世界和玩法；社区预设排列提示条目、选择功能、展开宏，并对请求／响应作受支持的投影。Native 保存实际历史，预设可以改变某次请求里历史的组织方式，不把存档改写成另一份伪聊天。

```mermaid
flowchart LR
  A[全局或对话选择] --> B[冻结条目与变量]
  B --> C[前置宏]
  C --> D[实际卡字段与世界书准入]
  D --> E[marker及outlet绑定]
  E --> F[历史投影与Story请求]
  F --> G[响应适配与变量结算]
  G --> H[Reader显示正则]
```

它与“原生文风预设”是两种格式。原生文风仍有自己的 system／blend／card 模式；社区预设不能凭任意字段静默改变这份合同。受支持的社区物料链以**通过角色卡导入建立的会话**为前提，旧手工配置会话不能直接视为已经拥有相同卡字段、世界书和历史接线。

导入保留源文件和未知配置，运行时提取可识别的声明式能力。源文件中的 JavaScript、第三方模块、action 函数体和宿主 API 不会因为“导入成功”就执行。

## 2. 可导入什么文件

社区预设入口接受带 **`prompts` 数组的 JSON 对象**，常见为 SillyTavern 的聊天补全预设导出；不是任意 YAML、角色卡 JSON、纯文本 system prompt 或 NextTavern 原生文风文件。独立正则入口接受**一个规则对象或规则对象数组**。Izumi V2 分层方案包使用专门的方案包入口，不能当作提示词预设导入。

以下是完整最小源文件，可保存为 `雾港灯塔预设.json`。它保留人物、玩家资料、世界书、示例和历史槽位，并增加一段创作要求；无脚本和外部依赖：

```json
{
  "temperature": 0.8,
  "openai_max_tokens": 1200,
  "prompts": [
    {"identifier": "lighthouse-main", "name": "灯塔叙事", "role": "system", "content": "围绕雾港灯塔写连续剧情。保留玩家选择，用声音、光线和海雾表现环境。"},
    {"identifier": "worldInfoBefore", "name": "人物前世界书", "role": "system", "content": ""},
    {"identifier": "charDescription", "name": "角色描述", "role": "system", "content": ""},
    {"identifier": "charPersonality", "name": "角色性格", "role": "system", "content": ""},
    {"identifier": "scenario", "name": "场景", "role": "system", "content": ""},
    {"identifier": "personaDescription", "name": "玩家资料", "role": "system", "content": ""},
    {"identifier": "worldInfoAfter", "name": "人物后世界书", "role": "system", "content": ""},
    {"identifier": "dialogueExamples", "name": "示例对话", "role": "system", "content": ""},
    {"identifier": "chatHistory", "name": "历史", "role": "system", "content": ""}
  ],
  "prompt_order": [
    {
      "character_id": 100001,
      "order": [
        {"identifier": "lighthouse-main", "enabled": true},
        {"identifier": "worldInfoBefore", "enabled": true},
        {"identifier": "charDescription", "enabled": true},
        {"identifier": "charPersonality", "enabled": true},
        {"identifier": "scenario", "enabled": true},
        {"identifier": "personaDescription", "enabled": true},
        {"identifier": "worldInfoAfter", "enabled": true},
        {"identifier": "dialogueExamples", "enabled": true},
        {"identifier": "chatHistory", "enabled": true}
      ]
    }
  ]
}
```

在设置 → “**预设**”中选择生效范围，使用“导入社区预设JSON”，选中条目，再点“应用社区预设”。导入只添加到共享库，不等于已应用。可检查面板显示 `standard`、9 条目、0 正则；实际人物材料取决于当前导入卡的字段映射，空字段不会凭空生成内容。采样默认关闭，因此导入这个文件不会立即把温度改成 0.8。

### 源文件不等于内部 Schema

| 层 | 字段例 | 用途 |
| --- | --- | --- |
| 上传的预设源文件 | `prompts`、`prompt_order`、`injection_position`、`extensions.regex_scripts` | 社区导出格式，交给导入器 |
| 解析后的库文档 | `schema:"community-presets.v1"`、`source`、`promptOrder`、`injectionPosition`、`profile`、`regexes`、`parameters` | 原生归一化数据和来源留存 |
| 选择状态 | `presetId`、`applySampling`、`prompts`、`contents`、`features`、`regexes`、`regexOrder` | 某个范围当前怎么使用共享库 |
| 宏变量账本 | chat／global 值与本轮写入 | 作者宏的持久与本轮结算 |

[预设 Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/community-presets.v1.json)、[选择状态 Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/community-preset-state.v1.json)、[变量 Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/community-preset-variables.v1.json)描述内部数据，不能把其中的 `promptOrder` 等字段直接当成 ST 源文件字段。面板“导出社区预设”通过导出器还原社区文件；工具应显式区分两层格式。

## 3. 条目、排序、功能组和采样

### 普通提示条目

| 源字段 | 解释及默认值 |
| --- | --- |
| `identifier` | 条目稳定身份；排序、开关、功能组均靠它定位，建议作者显式设置且保持唯一 |
| `name` | 界面名称；部分适配器允许名称回退，但不宜用重复名字代替稳定 ID |
| `content` | 普通条目的提示正文；marker 用实际材料替换，不把其 content 当人物资料 |
| `role` | `system`、`user`、`assistant`；其他值归一化为 system |
| `enabled` | 条目默认开关；选中的 order 行存在时，以该行 `enabled` 为准 |
| `injection_position` | 0 为常规布局，1 表示请求内深度插入；不是任意 ST 插件位置枚举 |
| `injection_depth` | 深度插入值，默认 4；0 在末尾方向，更大值向历史前方移动 |
| `injection_order` | 同类深度插入的顺序，默认 100；相同值再按条目顺序 |
| `readOnly` | 禁止在预设库正文编辑器修改，不代表运行时停用 |
| `spreset_hidden` | 隐藏提示标记，仍保留数据；不要把 hidden 当 enabled |

导入器优先使用 `prompt_order` 中 `character_id:100001` 的行，否则取第一行。只导入这一个有效顺序，不把每个 character_id 合并。该行存在时，没有列入 `order` 的 prompt 标为 `unused`，不会因自己写了 `enabled:true` 就自动注入。没有任何有效 order 时才按 prompts 数组顺序执行。缺失的 identifier 虽会生成 `prompt-N`，但条目移动后这个名字不稳定，不适合作为作者契约。

`chatHistory` 是布局边界：常规条目在它之前归 head，之后归 tail；`injection_position:1` 单独表达深度。实际 Native 执行会把 system 材料集中到拥有的系统插槽，所以 **system 的尾部／深度位置不承诺与 ST 任意角色交错完全相同**；user／assistant 条目才按请求插入合同定位。此适配会留有 adaptation，而不会改写原历史来伪造相同布局。

### marker 是材料入口

| identifier | 实际材料 |
| --- | --- |
| `charDescription`、`charPersonality`、`scenario` | 当前卡映射后的对应字段，分别渲染，不用完整原卡文本占位 |
| `personaDescription` | 当前玩家资料 |
| `worldInfoBefore`、`worldInfoAfter` | 本轮已经准入且位于人物前／后的世界书 |
| `dialogueExamples` | 实际示例对话与对应前后世界书材料 |
| `chatHistory` | Native 选中的真实历史布局边界 |

marker 由 **identifier** 识别；把普通条目仅命名为“世界书”不会获得这个能力。禁用 marker 会撤去它负责的对应材料槽位，不能期待原槽位再补一份。没有准入的世界书、未导入的玩家资料和卡的空字段不会因为 marker 存在而自动填满。角色字段归属可在预设界面的卡字段归属控件核对，导入与映射过程见[社区角色卡指南](COMMUNITY-CARDS.md)。

### 功能组与 profile

`SPreset` 配置条目等被识别为 `configurationOnly` 的内容保留为配置，不当作剧情 prompt。功能组把作者声明的控件变成原生开关，不直接执行脚本函数：

| 控件语义 | 当前动作 |
| --- | --- |
| `single`／`multiple` 组 | 单选启用时处理组级启停和其他选项；多选允许并存 |
| `enable`／`disable` | 按 identifier 或匹配名称切换目标条目；找不到目标进入 unresolved |
| `between` | 按上下边界名称模式选择其间条目，边界自身不包含在范围内 |
| `var_input`／`global_var_input` | 写 chat／global 宏变量，可同时切换声明目标 |
| Kemini `parameters` | 根据已提取的声明式注册、模板和规则修改参数或建立支持的条目 |

当前识别的 profile 有以下职责；这些名称不是用户随便加一个同名字段即可获得的执行引擎：

| profile | 主要原生适配 |
| --- | --- |
| `standard` | 普通 prompts／order、marker 和宏 |
| `dream` | 识别的消息分组、静态／动态世界书 outlet 及配置控件；额外总结／修复等模型动作可保留为 deferred |
| `kemini` | 识别的提示参数控件和函数响应 transport，保留实际客户端工具 |
| `reborn` | 识别的 SPreset 历史／postscript／响应包装；特定模型与 transport 仍有适配条件 |
| `izumi` | 识别的分层方案、advice、文本 sanitizer 与声明冲突配置；部分显式动作仍为 deferred |

profile 由导入器识别实际声明和静态配置，不对同名预设的所有版本作保证。Izumi V2 方案包导入只保存 `plans`、`active` 和 `quickSlots`，先预览，再显式应用方案；未定位条目会显示 unresolved，不把缺失目标算作成功。

### 采样参数

“**应用预设采样参数**”与选择预设是独立开关，默认 `false`。当前请求适配明确接入数值 `temperature` 和 `openai_max_tokens`，后者映射为 `maxTokens`。其他 provider 字段即使保存在 `parameters` 也不等于执行器使用它；`stop` 在开启采样时会记录未支持适配。模型／provider 自身对输出预算等仍有约束，不能把源文件字段数当作兼容覆盖率。

## 4. 共享库、全局与对话范围

| 操作 | 影响范围 |
| --- | --- |
| 导入／复制／编辑预设库条目 | 修改所有对话共享的库；编辑已被引用的正文会影响这些对话后续生成 |
| 在“全局”应用选择与开关 | 为没有独立覆盖的对话提供默认基线 |
| 在“当前对话”／“指定对话”应用 | 建立该对话的选择与配置覆盖 |
| “社区预设沿用全局” | 删除对话覆盖，重新继承全局 |
| 对话世界线切换 | 同一对话根身份共用对话预设选择，不是每条分支独立选择 |

条目开关、正文覆盖、功能配置、正则开关及来源顺序归属所选范围。编辑器显示的共享库草稿和范围内覆盖是两件事；调整单个对话时应使用范围控件，避免误改共享库。删除仍被选择的预设会要求先停用或切换。

一次 Story 准备会冻结实际选择、来源、变量、随机种子和时钟。生成中途改设置不应把新配置塞入旧尝试；后续新准备才消费新策略。provider 重试复用已完成准备，不能通过重试把同一轮赋值、抽签或其他作者副作用再执行一遍。

## 5. 宏变量、世界书与历史的组装

社区宏是在 prompt 条目内使用的 `{{…}}`，不是 JavaScript，也不等于 EJS 或 MVU 数值。它依次处理启用条目，共享本轮变量与抽签顺序。例如把以下**正文片段**放进一个普通 preset prompt：

```text
{{setvar::叙事地点::雾港灯塔}}
本轮地点：{{getvar::叙事地点}}。请继续描写{{char}}的行动。
```

当前卡人物名绑定为“守塔人”时，会得到“本轮地点：雾港灯塔。请继续描写守塔人的行动。”；赋值宏自身不输出文本。这个 chat 宏变量叫“叙事地点”，不会修改 MVU 的 `世界.地点`。

| 宏族 | 当前例子与含义 |
| --- | --- |
| 身份／材料别名 | `{{user}}`、`{{char}}`、`{{input}}`；卡字段别名由实际导入和映射提供 |
| chat 变量 | `setvar/getvar/addvar/incvar/decvar/unsetvar`，例如 `{{getvar::叙事地点}}` |
| global 变量 | 相应的 `setglobalvar/getglobalvar/addglobalvar/incglobalvar/decglobalvar/unsetglobalvar` |
| 随机选择 | `{{random::晴天::海雾}}`／`{{pick::晴天::海雾}}`；固定本轮种子与抽取顺序 |
| 骰子 | `{{roll::1d6+2}}`，按支持的 NdM±K 文法计算，不运行算术脚本 |
| 格式 | `{{newline}}`、`{{space}}`、`{{trim}}`、`{{reverse::灯塔}}`、`{{// 注释}}` |
| 时钟 | `time/date/isotime/isodate/weekday` 使用冻结时钟及 UTC 格式 |
| outlet | `{{outlet::名称}}` 读取本轮实际绑定出口；未绑定会报错 |

`addvar` 在可转数值的现值和增量上做加法，非数值场景按字符串追加；`incvar/decvar` 输出更新后的值。嵌套宏按语法处理，但未知宏会报“尚未支持的社区宏”。`MEMORY_…`／`VECTOR_MEMORY…` 等外部记忆插件宏没有因此接通；不能用原生记忆的存在推定这些宏可用。

宏的写入先在本轮尝试中累积，由变量 owner 按相应结算合同提交。功能控件的配置写入和一次 Story 内的宏写入也有不同身份。失败、取消或配置过期不能被当成“所有写入都肯定落盘”；恢复应沿原尝试的结果处理。

### 世界书与 outlet 的先后

前置宏先执行，遇到第一个世界书 marker 或依赖 outlet 的边界时暂停其后的处理。实际世界书按关键词、启用、位置和预算准入，模板 owner 渲染所需材料，再将结果绑定到 marker／outlet，继续后续条目。这样不会为了补齐世界书把已经执行的赋值或随机前缀重新跑一遍。

EJS 是单独的作者模板链。例如 Native 人物内容可用 `<%= 2 + 3 %>` 生成文本，已接入模板来源的世界书可用 `<%= getvar('stat_data.角色.体力', 'chat') %>` 读取有效数值快照；它不是放在社区 preset prompt 中就自动执行的语法。模板落点、标签、变量和 `getwi`／提示注入 API 见[原生卡 EJS 章节](NATIVE-CARD-FORMAT.md#8-ejs-作者模板动态文本与世界书联动)，数值初始化与写入边界见[状态手册](NATIVE-STATE.md#4-schemaejs-与纯数据路径的边界)。预设消费实际渲染结果，不为每个 marker 再执行一份作者程序。

### 历史和响应投影

Dream、Reborn、Izumi 等适配可能把连续纯文本历史合组、改成特定文本包装、放置 advice 或调整模型响应 transport。这些只影响本次请求。工具、媒体和不透明历史不是普通文本：不能跨过实际边界任意压成一条，也不能把 Native 正史改写成伪造角色行。

响应适配完成后，原生剧情和对应变量按各自合同结算。选择了某个 profile，并不证明模型一定遵从其响应格式；空输出、错误 transport 或未接入 action 应看具体错误／adaptation，不能用多次刷新代替处理。

## 6. 正则的导入、顺序与字段

### 一个可直接导入的显示规则

以下是完整独立正则 JSON 数组，可保存为 `灯塔显示正则.json`，通过“独立正则库” → “导入正则JSON”导入。它把模型回复中的 `【旁白】` 标签仅在显示时删除：

```json
[
  {
    "id": "lighthouse-narrator-label",
    "scriptName": "隐藏旁白标签",
    "findRegex": "/【旁白】/g",
    "replaceString": "",
    "trimStrings": [],
    "placement": [2],
    "disabled": false,
    "markdownOnly": true,
    "promptOnly": false,
    "runOnEdit": true,
    "substituteRegex": 0,
    "minDepth": null,
    "maxDepth": null
  }
]
```

选择绑定“当前对话”后，打开“双通道预览”，输入 `【旁白】守塔人点亮提灯。`，位置选“模型回复”、深度 0，点“预览双通道”。预期“发送给模型”保持原文，“显示在界面”为 `守塔人点亮提灯。`。把规则改为 `promptOnly:true, markdownOnly:false` 则只改请求通道；两个都为 true 才同时覆盖这两个通道。

预览采用占位身份和空宏变量，不等于完整卡材料执行；Reader 的角色卡正则和实际别名还需在真实会话核对。显示规则不回写保存的原始历史；要删原存档中的文本，应使用正式正文编辑，而不是显示替换。

### 内嵌正则从哪个字段导入

预设中按以下优先级取**第一份非空数组**，避免重复容器里的同一份正则执行多次：

1. `extensions.regex_scripts`（native 来源容器）。
2. `extensions.SPreset.RegexBinding.regexes`。
3. `regex_scripts`，否则 `extensions.regexes`，否则 `regexes`（legacy 容器）。

legacy 行内部先按字段存在的回退关系选值，不会在每个候选字段里继续寻找下一份非空数组。独立正则入口则直接读取一个对象／数组，**不会替你解包** `{"regex_scripts":[…]}`。

### 生效来源和执行顺序

| 来源类别 | 包含内容 |
| --- | --- |
| `global` | 绑定全局的独立正则库 |
| `preset` | 当前 preset 的内嵌正则，以及绑定到该 preset 的独立库 |
| `scoped` | 当前对话根绑定的库，以及已准入的角色卡 scoped 正则 |

standard／dream 的默认顺序是 **global → preset → scoped**；kemini／reborn／izumi 为 **preset → global → scoped**。在“正则来源顺序”可显式调整，保存到当前选择范围。同一来源内沿有效规则顺序执行，前一个输出是后一个输入；不能仅按文件名或导入时间推测最后文本。绑定 preset 的独立库只随该 preset 生效；正则库也可在没有启用社区预设时独立使用。

### 规则字段的精确含义

| 字段 | 当前语义 |
| --- | --- |
| `findRegex` | 查找式，可写 `/模式/gim`；常用 JS `g/i/m/s/u` 标志写在字符串尾部。单独的 `flags` 字段不接入执行 |
| `replaceString` | 替换模板，支持 `$0`／`{{match}}`、`$1` 等捕获组、`$<name>` 命名组及支持的宏；不是 JavaScript 回调 |
| `trimStrings` | 对被引用的捕获文本删除这些字面字符串；不是对整篇正文调用 trim |
| `placement` | 数组形式的运行位置；本例 `[2]` 为模型回复 |
| `disabled`／`enabled` | `disabled:true` 或 `enabled:false` 停用；独立库可编辑启停及规则顺序 |
| `markdownOnly` | 允许 display 通道（Reader 显示） |
| `promptOnly` | 允许 prompt 通道（发送给模型的材料） |
| `runOnEdit` | 输入被标记为已编辑版本时仍允许执行；false 会跳过编辑版本，不表示修改原文或自动重生成 |
| `minDepth`／`maxDepth` | 在提供深度的消息上作含端点筛选；null 不限制，minDepth 小于 -1 不设下界，maxDepth 小于 0 不设上界；无深度的材料不按消息深度过滤 |
| `substituteRegex` | 0 不展开查找式宏，1 直接代入宏值，2 先转义宏值中的正则特殊字符再代入 |

`markdownOnly` 和 `promptOnly` **同时为 false** 时匹配 source 通道，不是“请求和显示都执行”的简写。在双通道预览里两边都不变化可能正是这个原因。source 是原材料处理阶段；不要把这个值当作给 Reader 增加一项通用开关。

placement 的当前 UI 名称为 1 用户输入、2 模型回复、3 快捷命令、5 世界书、6 思考内容。数据合同还容纳 0／4，但这不表示每种位置都已有实际生产调用者。只有材料链确实提供对应位置和通道时规则才执行；常规 Reader 消息是 1／2，预览也只提供这两类。

深度是该消费阶段提供的消息位置，不是世界线编号或回合号；最近消息深度为 0，向前递增。新消息到来可能改变旧消息深度，从而改变显示。规则不会因为深度改变就编辑旧存档。

要使用多行匹配，明确写 `m`（改变行首尾锚点）或 `s`（让点匹配换行）。没有 `g` 不表示全量替换。不承诺 PCRE、`x` 等非 JavaScript 语义。查找式中的宏是否展开由 `substituteRegex` 决定，替换模板的宏另按自己的阶段处理。

正则沿隔离 Worker 执行，有输入、输出、匹配与时限等限制。非法表达式可能报告 `PROMPT_TRANSFORM_REGEX_INVALID`，长耗时变换可能被终止；Reader 失败时保留可读原文并提示。缩小匹配范围、改写模式或停用该规则，优于期待刷新能修复同一表达式。

## 7. 作者排错顺序与验证边界

| 现象 | 检查点 | 应看到什么 |
| --- | --- | --- |
| 导入报“需要 prompts 数组” | 是否把方案包／内部 schema／角色卡当作预设 | 使用第 2 节源文件结构 |
| 导入后风格没变 | 是否已选并点应用；当前范围；条目 enabled／unused／configurationOnly | 当前范围显示所选 preset 与有效条目 |
| 人物或世界书没进入请求 | marker identifier、当前卡字段映射、世界书实际准入、是否关闭 marker | 有材料的槽位才产生内容 |
| 功能组显示 unresolved | 控件声明的 ID／名称是否仍对应 prompt；是否删过模板 | 修复声明或目标，不能仅改展示名 |
| 采样没变 | applySampling 是否打开；字段是否是已接入的两个数值字段 | 保存未知参数不等于 provider 已使用 |
| 宏原样出现或报错 | 是否用了未支持宏；是否把 EJS／MVU／外部记忆语法混入社区宏 | 支持的宏由本轮绑定展开；未知依赖明确失败 |
| 正则预览没变 | 来源绑定、开关、placement、通道标记、深度、模式／flags | 用显示示例先确认单规则，再检查真实链 |
| 已编辑消息没有变换 | runOnEdit 是否 false | true 才允许该版本参与变换 |
| 画面更新但数值没变 | 是否只做了显示替换；MVU 候选是否被接受并提交 | 数值以游戏数值面板及对应提交为准 |

导入、控件、宏、正则、组装和变量结算不新增模型推理请求，正常／重试／回退增量为 0／0／0。它们可以改变 Story 的 token 数、温度、预算和输出，从而改变实际费用；Ruby 与作者显式生成操作另计。

本文的 JSON 是可交给现有解析器的示例；条目、宏和正则应分别核对导入结果与预期文本。完整兼容还需要真实请求、响应与 UI 操作结果；格式通过不能代替整卡玩法验证。Native 1.1 普通执行与高级人物分类也有不同材料消费者，预设选择成功不能证明全部动态高级投影已支持，详见[原生卡格式](NATIVE-CARD-FORMAT.md)。

源码定位：[导入格式](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-preset-import.ts)、[作用域](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-presets.ts)、[profile](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-preset-profiles.ts)、[控件](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-preset-controls.ts)、[宏](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-preset-macros.ts)、[执行](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-preset-execution.ts)、[正则顺序](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/community-regex.ts)、[正则语义](https://github.com/a86582751/dsh-nexttavern/blob/main/src/core/tavern-prompt-transform-execution.mts)。
