# NextTavern 琥珀酒馆 · Amber Tavern skin

NextTavern 自有皮肤，跟随 DSH 官方皮肤协议（`cordis.patch.yml` 插入 loader 条目 +
`skin.json` 供皮肤管理器发现 + `bodyAttr` 作用域化 CSS），并由设计 token 驱动整套换肤。

## 它做什么

- **整套界面重绘**：覆盖明暗两套 `--dsw-alias-*` 设计 token（背景、描边、文字层级、
  交互态、按钮、代码块、滚动条、遮罩、状态色、语法高亮），再叠加组件 CSS 做酒馆签名。
- **品牌位**：出厂字标（鲸鱼图标 + SVG 字母）被隐去，品牌完全由看板娘的
  `NextTavern` 招牌承担；浏览器标题里的 `DeepSeek Harness` 也会被替换。
- **左上角看板娘**：Q版鲸鱼娘坐在写着 `NextTavern` 的木质招牌上——白天执笔、
  夜里趴在招牌上打盹（檐下挂灯），挂在品牌行内（品牌行从固定 60px 加高到 196px，
  旧品牌按钮整体隐藏）。两版立绘均为近方形抠图，统一 `auto 94% / 50% 100%` 几何居中；
  夜版人物重心偏画布左侧，深色主题额外右偏 12px 校正视觉中心。
  侧栏收成图标栏（实测宽度 < 200px）时整体让位。
- **主阅读视图**：`_body` 内的场景层——空态与阅读态**各一张主题图**（亮：白纱蕾丝礼服；
  暗：黑色运动夹克配黑丝袜带的日常风），左侧用遮罩渐隐融入羊皮纸底色，阅读时亮色 45%、
  暗色 22% 透明度、空态时 74%–80% 隆重登场，另附两行 `NEXT TAVERN` / `REVOLUTION` 水印与保护正文的
  暖色渐层，全部位于正文之下。
- **酒馆阅读模式（rp-reader）**：正文样式由角色扮演插件的作者 CSS 负责（半透明浅纸
  卡片 + 写死的深墨色）。皮肤不改动任何墨色规则；仅在深色主题把纸面本体补成**旧羊皮
  纸**（暖棕做旧，不刺眼也不糊字）——深色桌上铺一张旧纸，恢复作者设计的对比度。
- **空态标题打字机**：`[data-phase='hero']` 的标题文本 span 被皮肤接管（"预览版"徽章
  不动），按打字→停 18 秒→删除的节奏轮播酒馆词句（"书写下一个故事""向理想世界致敬"
  等 7 组，洗牌不连续重复）；清理时还原本体原文，本体字符串不变。
- **滚动接管**：原生滚动条换成琥珀配色，右侧另有一条带刻度的进度轨道，可点击跳转。
- **动效**：看板娘浮动、正文行淡入上浮、场景 0.6s 交叉淡入、输入框聚焦辉光；
  `prefers-reduced-motion: reduce` 下全部关闭。
- **明暗与配色**：亮色侧栏是**暖亚麻色**（与正文羊皮纸同一色调家族，过渡自然），
  深色侧栏保留深木（暗配暗）；正文始终是羊皮纸。两层属性选择器
  `body[data-dsh-nexttavern]` / `[data-ds-dark-theme]` 保证优先于基础主题；两套美术资源各自绑定。

## 调色

| 角色 | 亮色 | 暗色 |
| --- | --- | --- |
| 琥珀（品牌） | `#c8892b` | `#e0a94a` |
| 焦糖 | `#8a5a2b` | `#c08a4a` |
| 深木结构 | `#241a12` | `#17110c` |
| 暖白面板 | `#fffaf1` | `#1f1710` |
| 鲸蓝点缀 | `#1b4f6b` | `#5aa8c8` |

## 宿主钩子优先级

优先使用应用自带、跨构建稳定的属性，而不是 CSS module 的哈希类名：

| 用途 | 首选 | 兜底 |
| --- | --- | --- |
| 阅读滚动容器 | `[data-conversation-scroll]` | `[class*="_scrollBody"]` |
| 场景宿主 / 相位 | 最近带有 `data-phase` 的祖先 | `[data-slot='conversation.session']` |
| 品牌行 / 字标 | `[data-slot='sidebar.brand.mark']`、`[data-slot='sidebar.brand.name']` | `[class*="_brandMark"]`、`[class*="_brandName"]` |
| 侧栏 | `[data-slot='sidebar'] > *` | 由 `[class*="_logoRow"]` 向上找高而窄的祖先 |
| 正文行 / 输入区 | `[data-chat-flow-kind]`、`[data-composer-seat]`、`[data-composer-card]` | — |

场景层与 body 的相位镜像使用**不同**属性（`data-nt-stage` / `data-nt-scene`）；
两者同名会让 `querySelector` 先命中 `body`，清理时也会误删。

## 与宿主的三个硬契约

这三条都不是风格问题；写错任何一条皮肤都会**静默失效**——不报错、不生效、控制台干净。

1. **注册 id 必须是包名**，不是 `cordis.patch.yml` 里的条目 id。
   `__ModuleLoader__.load({ id })` 要匹配 bundle 行里的包名（`dsh-nexttavern-amber`）；
   写条目 id（`ui-skin-nexttavern`）会让整个 roster 报
   `loaded without registering <package> via __ModuleLoader__.load`。
2. **factory 返回的 namespace 必须打上 Module 标记**：
   `Object.defineProperty(ns, Symbol.toStringTag, { value: 'Module' })`。
   少了它条目会正常加载、`apply` 永远不会被调用，也不会有任何提示。
3. **`ctx.effect` 收的是 thunk**：`ctx.effect(() => cleanup, label)`。
   cordis 会**立即调用**传入的回调并把返回值当作 disposer；直接传 `cleanup`
   等于在挂载的同一 tick 里把皮肤拆掉，表现是样式、属性、插画全部消失。

排查以上任一情况看 `window.__ntSkinTrace`：`apply` 留下的带时间戳面包屑，
即使插件已被 cordis 回滚也仍然保留。

第四条教训：**重挂载冲刷不能只依赖 `requestAnimationFrame`**。后台标签页里 rAF 永远不
触发，若 `apply` 执行时侧栏尚未渲染（启动竞速），皮肤会保持未挂载状态直到下次前台刷新。
可见页面用 rAF 批量合并冲刷，隐藏页面退回微任务，并在 `visibilitychange` 时补一次冲刷。

第五条教训：**不要在侧栏上用 `isolation: isolate`**。设置对话框挂载在侧栏子树内，
isolation 会把它困在侧栏的堆叠上下文里——DOM 命中测试它在上层，绘制却被正文盖住，
看起来就是"点击设置毫无反应"。同时，侧栏的 token 覆盖会被对话框**继承**（自定义属性
沿祖先链解析），半透明的面板底色会让面板隐形；对策是在面板元素上直接 `!important`
重声明表面 token。应用在 composer 座位上自绘的"透明→纸色"渐变也要覆盖掉，否则它在
插画背景上呈现为一块边缘锐利的白色矩形。

第六条教训：**面板 token 覆盖必须盖全表面家族，并且每个主题各盖一套**。设置对话框里的
值选择器和选中外观卡消费的是 `--dsw-alias-bg-module-platform` 与 `--dsw-specific-*`
（应用只定义冷灰值），只覆盖 layer-1/2/overlay 时它们仍是深色板，叠上被强制变深的标签就是
深底深字。另外，**不要图省事把面板钉成单一浅色**——那会让设置页完全无视外观设置（实测被
用户一眼看出"只有一个颜色"）。浅色主题走暖纸、深色主题走夜木，各自 `color-scheme`；
面板跟随主题后，选中的外观卡自然会用本主题的 module-platform 取色，不需要额外的补丁规则。

第七条教训：**酒馆阅读模式（rp-reader）以作者为准**。作者 CSS 把正文画在半透明浅纸
卡片上并写死深墨色，假定衬底是浅色的；深色主题下皮肤只把纸面换成不透明暖羊皮纸，
不碰任何墨色规则。

## 美术来源与管线

六张插画由豆包 Seedream 以用户提供的**官方设定卡（4.png）+ 女仆三视图 + 1.png 风格样张**为参考生成：

| 图 | 内容 | 用途 |
| --- | --- | --- |
| keeper-day | Q版·坐招牌执笔 | 侧栏（亮色） |
| keeper-night | Q版·趴招牌打盹，檐下挂灯 | 侧栏（暗色） |
| light-idle | 白纱蕾丝礼服·持鸡毛掸打扫酒架 | 空态（亮色） |
| light-reading | 白纱蕾丝礼服·推开木门提灯笼，逆光回眸 | 阅读态（亮色） |
| dark-idle | 黑运动夹克+黑丝袜带·坐窗边捧杯 | 空态（暗色） |
| dark-reading | 黑运动夹克+黑丝袜带·台灯下看书 | 阅读态（暗色） |

两套服装方向不同：亮色用设定卡的白蓝蕾丝薄纱礼服；暗色按用户指定参考图走黑丝运动日常风。
两套都要求鲸鱼尾圆润小巧、自然收在身后（写实鱼尾被用户判为"怪"）。看板娘为纯白底渲染，
经边界泛洪抠图（1px 腐蚀 + 1px 羽化）得到透明通道——泛洪只从边界进入，围裙等被轮廓包住的白色不受影响。
全部降采样（场景图 1280x720）后以 72 质量 WebP **内联进客户端 bundle**——插件 bundle 走共享
combo URL 获取，不能依赖同目录静态资源被单独服务。六张合计约 316 KB webp（base64 约 421 KB）。

## 预览

`preview/light.png` 与 `preview/dark.png` 是**实机截图**（1600×900 缩放至 1024，
分别对应浅色阅读场景与深色空态场景），不是设计稿或背景板。

## 安装

```bash
dsh plugin --profile web add <此目录>
```

本 bundle 的 `cordis.patch.yml` 以 `disabled: true` 登记该条目：新 profile 装完仍走出厂外观，
条目本身留在 roster 里（宿主的只读插件列表把它显示为已停用）。随后在皮肤管理器中切换，
或在 profile 补丁层把 `ui-skin-nexttavern` 的 `disabled` 置为 `false` 并重启服务。
与其它整页皮肤互斥，一次只应启用一个。

**部署要写两处路径，并且必须重启服务。** combo 实际服务的是已安装 profile 副本
（`$DSH_HOME/profiles/web/node_modules/dsh-nexttavern-amber/lib/`）；
`roleplay-packages/dsh-nexttavern-amber/lib/` 只是包暂存库。只更新暂存库会让磁盘哈希"看起来一致"，
而浏览器仍收旧 bundle。重启是必需的：插件 URL 的 `rev` 由 bundle 字节 SHA-1 生成、只随 HMR 钩子重算，
不重启则浏览器持一年缓存且旧 URL 返回 404。

皮肤管理器里本皮肤显示「安装目录既不是 Git 仓库，也没有构建指纹」。这是刻意的：
`skin.build.json` 的 meta 契约要求 `repository` 为 `owner/name`，而本皮肤没有上游仓库，
填一个不存在的仓库只会让「检查更新」从"无对比"变成请求失败。

## 迭代与验收经验

- 三条静默失效契约（注册 id / Module 标记 / `ctx.effect` thunk）改动时必须先跑一遍；
  诊断看 `window.__ntSkinTrace`。
- 美术提示词要写清服装细节并给出**否定项**（"不要女仆裙/围裙/女仆头饰"），否则会按题材先验画成传统女仆装。
- 批量生成用**并发**（每个动作独立输出目录）：7 张约 80 秒，串行约 9 分钟。
- 内嵌 base64 时务必确认替换后 token 出现次数不变（曾因脚本漏拼第二个匹配点把 `client.ts` 截断，TS1160）。
- 空态英雄图的角色脸必须在画面上半部：页面中下部有输入框，坐姿/趴姿容易被挡住。
