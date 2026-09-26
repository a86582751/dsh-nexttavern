# 首页立绘

`site/art/` 是公开文档站首页轮换用的鲸鱼娘立绘，全部来自皮肤
`dsh-nexttavern-amber` 的同一批自制出图（Doubao Seedream 5.0 Pro
`doubao-seedream-5-0-pro-260628`，2048×1152，出图时间 2026-09-16）。
这里保存的是**交付用的最终字节**：按 1440 宽缩放到 WebP（质量 80），
生成器只负责把它们原样复制到 `assets/art/`，不再二次编码。

首页轮换顺序与文案在 `site/site.config.mjs` 的 `hero.art` 里声明；文件缺失
会让构建失败，不会留下空的轮换帧。

| 交付文件 | 出图批次中的源文件 | 场景 |
| --- | --- | --- |
| `tavern-day-shelf.webp` | `gen/lh01.png` | 日间 · 酒架上取酒 |
| `tavern-day-fireplace.webp` | `gen/lh03.png` | 日间 · 壁炉添柴 |
| `tavern-day-counter.webp` | `gen/lh07.png` | 日间 · 吧台落笔 |
| `tavern-day-dusting.webp` | `gen/lh08.png` | 日间 · 擦拭酒瓶（即皮肤日间空态立绘） |
| `tavern-day-door.webp` | `gen/lh09.png` | 日间 · 提灯推门（即皮肤日间阅读立绘） |
| `tavern-day-garden.webp` | `gen/lh10.png` | 日间 · 打理绿植 |
| `tavern-night-window.webp` | `gen/dark-idle.png` | 夜间 · 窗边捧杯（即皮肤夜间空态立绘） |
| `tavern-night-desk.webp` | `gen/dark-reading.png` | 夜间 · 书桌夜读（即皮肤夜间阅读立绘） |
| `tavern-night-candle.webp` | `gen/scene-idle-dark-b.png` | 夜间 · 烛火圆窗 |

批次目录 `artifacts/test-temp/skin-art/` 是维护仓库里的一次性工作区，随
`artifacts/` 清理，不随公开仓库交付；需要替换或新增立绘时，从该批次（或新
的一批）重新导出同样的尺寸与格式，并同步更新本表与 `hero.art`。

## 品牌标识

站点头像与木牌字标同样取自皮肤自己的看板娘，不使用 "NT" 之类的字标本
（"NT" 会被读成别的词）：

| 交付文件 | 来源 | 用途 |
| --- | --- | --- |
| `brand-mark.webp` | `work/keeper-day-full.png`（日间看板娘）裁出头像，置于站点琥珀色圆角底板上 | 顶栏／页脚品牌标 |
| `brand-word.webp` | `gen/20260916_011809_sign2-night2_01.png`（夜间那面正面 "Next Tavern" 木牌）取木牌内的字标横带 | 顶栏／页脚品牌字标 |
| `favicon.png` | 与 `brand-mark.webp` 同源的满幅版本 | 浏览器标签图标、apple-touch-icon |

生成脚本在维护仓库的 `artifacts/test-temp/skin-art/work/mkbrand.py`（一次性
工具，不随仓库交付）；三个文件都由生成器原样复制到 `assets/art/`。
首页标语栏是固定一句 `Welcome to the Next Generation Tavern`，不随轮换图
改字——皮肤包为了体积只收录了少数几张立绘，逐图点名会对不上。
