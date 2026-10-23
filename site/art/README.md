# 网站插画

## 2026-10-20 冒险手账与午夜星海

新版首页使用概念插画表达故事、记忆和世界线，实机截图保留在独立的截图页。
以下五张成品由 OpenAI 内置 imagegen 生成，使用用户提供的鲸鱼娘设定图作为身份参考；
经典女仆形象与三视图用于核对蓝色渐变长发、弯曲呆毛、白边侧鳍、蓝眼和鲸尾。
服装、动作与场景为新设计，不表示默认产品界面或实际功能运行结果。

| 文件 | 场景与提示词摘要 | 尺寸 |
| --- | --- | --- |
| `journal-day.webp` | 奶油衬衫与鼠尾草旅行披肩，鲸鱼娘持旅行手账与羽笔，日照港口酒馆 | 1536 × 1024 |
| `journal-night.webp` | 深蓝针织外套，鲸鱼娘窗边捧茶，月海、灯塔与星空 | 1536 × 1024 |
| `memory-atlas.webp` | 打开的旅行手账、压花、港口回忆与金色联系线 | 960 × 640 |
| `worldline-atlas.webp` | 从酒馆分向港口、雪山与森林的手绘地图 | 960 × 640 |
| `character-atlas.webp` | 旅行装鲸鱼娘与旅人在酒馆交谈，笔记与纪念物 | 960 × 640 |

成品采用 WebP quality 84，作为已追踪资源原样发布；文字、导航与交互由 HTML/CSS
实现，不烘焙在插画内。旧立绘及品牌素材保留在 Git 历史与本目录中，以下为其原始来源记录。

### 第二批轮播与夜间章节图

本批追加 14 张首页轮播帧和 3 张夜间章节概念图，由内置 imagegen 生成，沿用鲸鱼娘身份参考。首页封面源 PNG 为 1536 × 1024，章节概念图为 960 × 640；交付 WebP 使用 FFmpeg libwebp quality 84。下表记录源 PNG 文件名和最终提示词摘要；逐张完整提示词及源图的精确本地路径保存在维护工作区的 `local/site-redesign-20261020/followup-art-records.json`，该证据文件不随公开站点投影。

| 轮播组 | 交付文件 | 源 PNG | 最终提示词摘要 |
| --- | --- | --- | --- |
| 02 | `journal-day-02.webp` / `journal-night-02.webp` | `exec-dc037fe4-bcf9-4b2a-bde1-ac6972a0d655.png` / `exec-4d7b6677-38a0-4e07-8081-dd1bdfcd0e6b.png` | 白色与海军蓝短袖水手衫、红领结、海军蓝长裤与白色水手帽；白日掌舵航行，夜间仰望星海与生物荧光海面。 |
| 03 | `journal-day-03.webp` / `journal-night-03.webp` | `exec-a76dbe8a-8898-47fe-8961-c0ab332152a9.png` / `exec-efb43b31-7d3c-4f6d-841e-f0bb59824f39.png` | 象牙白与青绿拼色现代运动风衣、白 T 恤、黑色慢跑裤和徒步背包；白日森林瀑布步道，夜间湖畔露营。 |
| 04 | `journal-day-04.webp` / `journal-night-04.webp` | `exec-70d0724b-6b86-4111-926b-5c8b6f84ec43.png` / `exec-fe974e62-33c1-4432-99b6-750e1e6f55e6.png` | 酒红长款学者外套、炭灰高领衫与圆框眼镜；白日图书馆阶梯，夜间在月光图书馆查阅星图。 |
| 05 | `journal-day-05.webp` / `journal-night-05.webp` | `exec-4b1602ea-d377-4dbb-a734-80c937ba916a.png` / `exec-ab203995-be5e-4dd0-a4e4-afd4f85e0d7f.png` | 苔绿背带工装裤、芥末黄 T 恤、园艺手套和草帽；白日温室照料幼苗，夜间照看发光月下花。 |
| 06 | `journal-day-06.webp` / `journal-night-06.webp` | `exec-e5977992-01c1-4b38-ba53-2347852cae06.png` / `exec-aba9e8f9-4364-4bc3-8e5d-f3917fbbba2e.png` | 象牙白交领上衣、浅桃色宽袖、玉绿长裙与云水纹饰的中国汉服；白日水乡春游，夜间雨巷红灯与月映运河。 |
| 07 | `journal-day-07.webp` / `journal-night-07.webp` | `exec-b9ce07f8-19ab-48a4-985b-fd8948d04361.png` / `exec-05217c80-ba00-4fc6-8d6c-e43eeb91ece7.png` | 焦糖棕飞行夹克、乳白羊羔绒领、卡其工装裤与黄铜护目镜；白日浮岛飞艇，夜间山顶天文台。 |
| 08 | `journal-day-08.webp` / `journal-night-08.webp` | `exec-d07e7631-796c-4437-a365-04e653c9c18f.png` / `exec-a7de5c3b-6be6-4d30-bbe4-7fa28ab59cd8.png` | 白日沿用经典海军蓝与白色女仆装，在酒馆厨房端茶；夜间换深蓝丝绒裙与象牙披肩，在壁炉边读书饮茶。 |
| 章节图 | `memory-atlas-night.webp` | `exec-4cab4d5d-2d2f-4720-8546-9f45a665f288.png` | 深靛蓝记忆手账、银色速写与青金星座线索，保留海岸回忆书签。 |
| 章节图 | `worldline-atlas-night.webp` | `exec-9cc60769-312a-413c-b8e4-db6e3254d0ef.png` | 午夜蓝星图从酒馆起点分出三条金色旅路，通往海岸城堡、雪山堡垒与森林村庄。 |
| 章节图 | `character-atlas-night.webp` | `exec-3040ebdc-15c9-4781-9d6c-421497c716a0.png` | 深蓝与青绿色烛光酒馆中，鲸鱼娘与旅人隔着手账交谈；夜色保持低亮，面部与纸页由烛光照亮。 |

用户淘汰了重复使用的蕾丝服方案和浴衣方案；03 最终改为现代运动装，06 日夜版均采用中国汉服，不采用浴衣。

## 原首页立绘

`site/art/` 是公开文档站首页轮换用的鲸鱼娘立绘，全部来自皮肤
`dsh-nexttavern-amber` 的同一批自制出图（Doubao Seedream 5.0 Pro
`doubao-seedream-5-0-pro-260628`，2048×1152，出图时间 2026-09-16）。
这里保存的是**交付用的最终字节**：按 1440 宽缩放到 WebP（质量 80），
生成器只负责把它们原样复制到 `assets/art/`，不再二次编码。

这批素材对应旧首页；当前轮播使用上面的手账／星海系列。轮换顺序与文案维护于
`site/src/site.config.mts`，`site/site.config.mjs` 是生成物。

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
的一批）重新导出同样的尺寸与格式，并同步更新素材表与维护源码中的配置。

## 品牌标识

站点头像与旧木牌字标取自看板娘素材。当前官网继续使用头像，品牌名称由文字排版；
下表保存旧素材用途。皮肤后续 NT 徽记改版与官网素材分别维护。

| 交付文件 | 来源 | 用途 |
| --- | --- | --- |
| `brand-mark.webp` | `icon/20260926_183945_icon-d_01.png`：以 `work/keeper-day-full.png` 为角色参考、用 Seedream 5.0 Pro 重跑的应用图标式半身像（暖橙背景），切圆角 | 顶栏／页脚品牌标 |
| `brand-word.webp` | `gen/20260916_011809_sign2-night2_01.png`（夜间那面正面 "Next Tavern" 木牌）取木牌内的字标横带 | 顶栏／页脚品牌字标 |
| `favicon.png` | 与 `brand-mark.webp` 同一张图，满幅不切圆角 | 浏览器标签图标、apple-touch-icon |

最初的头像版本直接把看板娘的头部裁成方形，34 像素下像一张奇怪的证件照，因此照着
应用图标（app icon）的形式重跑了一版：角色半身填满方图、暖色背景、四角圆润。
同批候选留在 `icon/`：`icon-b`（微笑＋底部 "NextTavern" 木条，最接近参考形式）、
`icon-d`（大笑特写，最终选用，因为缩放后仍最清楚）、`icon-e`（大笑＋底部木条）。

生成脚本在维护仓库的 `artifacts/test-temp/skin-art/` 下（一次性工具，不随仓库
交付）：`mkicon.py` 产出 `brand-mark.webp` 与 `favicon.png`，`work/mkbrand.py`
产出 `brand-word.webp`。三个文件都由生成器原样复制到 `assets/art/`。
首页标语从皮肤 `HEADLINE_GROUPS` 读取 12 条原文并依次打字展示；它独立于日夜插画轮播。
