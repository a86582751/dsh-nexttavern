# NextTavern 原生角色卡格式参考

本文面向第三方作者与工具开发者，描述 **0.3 开发中的 Native 1.0／1.1 格式**。0.3 尚未正式发布；格式读取、具体动态能力和完整玩法的验证范围分别判断。最新发行信息见[开发日志](DEVELOPMENT-0.3.md)。

## 基本结构

原生卡是 JSON 文档，包含四个顶层字段：

| 字段 | 用途 |
| --- | --- |
| `spec` | 固定为 `nexttavern_card` |
| `spec_version` | `1.0` 或 `1.1` |
| `data` | 当前作者设定与可移植兼容资料 |
| `archive` | 归档资料，不作为另一份运行指令注入 |

完整字段约束见公开仓库的[原生卡 JSON Schema](https://github.com/a86582751/dsh-nexttavern/blob/main/schema/nexttavern-card-v1.schema.json)。Schema 文件名中的 v1 同时覆盖 1.0 与 1.1。

## 一份小型 1.0 卡

```json
{
  "spec": "nexttavern_card",
  "spec_version": "1.0",
  "data": {
    "name": "灯塔来客",
    "cards": [
      {"name": "守塔人", "kind": "character", "content": "守塔人每天记录海面的变化。"}
    ],
    "worldbook": [],
    "rules": {"core": "尊重玩家选择。", "style": "用简洁的感官细节描写。"},
    "opening": {"text": "暮色里，守塔人递来一本潮汐记录。", "materialization": "materialized"}
  },
  "archive": {}
}
```

这是符合文档 Schema 的格式示例，不包含数值或作者前端。`cards`、`worldbook` 中的作者行要求 `content`；`name`、`kind`、`aliases` 等可补充作者语义。

## 常用栏目

| 栏目 | 内容 |
| --- | --- |
| `cards` | 人物及作者资料；1.1 中为高级分类视图 |
| `worldbook` | 世界书作者行，实际使用仍服从启用、触发和预算 |
| `rules` | core、plot、narrative、reply、style、status 和 beauty 等规则 |
| `opening` | `text`、可选 `materialization` 和 `catalog`；目录项使用 `rawText` |
| `status` | 作者状态文本，不是某次游玩的实时数值存档 |
| `character_book` | 社区结构化世界书及控制字段 |
| `compatibility` | 版本化作者执行资料与 ST 宏别名等兼容信息 |

开放作者字段可以保留，但“能存入 JSON”不等于存在相应运行能力。不要把本地会话 ID、来源证明、verified 标记或运行时版本当作可移植权限。

## 1.0 与 1.1 的区别

1.0 直接使用作者栏目。1.1 为社区卡的完整作者资料和高级人物分类提供不同视图：

- 普通剧情使用 `data.compatibility.authorExecution.cards/rules`。
- `data.cards/rules` 是分类后的高级视图，不再额外注入一份同样正文。
- `authorExecution` 必须包含 `schemaVersion: 1`、`mode: "preserved-author"`、`cards` 和 `rules`。

下面是 **1.1 内部片段**，并非独立完整卡：

```json
{
  "compatibility": {
    "authorExecution": {
      "schemaVersion": 1,
      "mode": "preserved-author",
      "cards": [{"content": "完整保留的作者资料。"}],
      "rules": {"core": "完整保留的作者规则。"}
    }
  }
}
```

工具不能只改 `spec_version` 来升级，也不能把 1.1 静默按 1.0 读取。原生卡格式版本、数值协议版本与本地存档版本互不替代。

## 转换与编辑

当需要将长字段中的人物和规则分类时，模型提供归属与位置，程序复制原文形成高级视图。有效来源未变时复用分类；相关作者编辑会使旧分类过期。

动态 EJS 或混合规则可能无法完整拆给高级功能。普通执行仍保留完整作者资料，具体高级能力可能只部分可用。不要仅以格式有效或转换 ready 推定所有动态玩法通过。

世界书被分类引用，也仍需通过本轮的正常准入；引用不能强制启用隐藏或未命中的条目。

## 原件与可移植性

“导出原件”返回当时上传的字节；“导出当前原生卡”保存现在的作者设定。两者可能不同。原生卡不是完整会话备份，不包含所有聊天历史、任务状态或外部插件存档。

将当前 JSON 重新上传到另一工作区后，该 JSON 是新上传的原件。格式归档不能保证重建早期 PNG 或未封装的外部资源。

## 开发建议

优先从 1.0 的清晰作者栏目开始；需要保留混合社区资料并建立高级分类时，沿正式转换流程产生 1.1。保留作者未知字段，但不要执行不认识的扩展代码。

格式验证、实际导入与玩法验证分开进行。需要理解运行行为时，继续阅读[社区卡指南](COMMUNITY-CARDS.md)、[数值与 Ruby](NATIVE-STATE.md)和[社区预设](COMMUNITY-PRESETS.md)。
