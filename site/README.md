# NextTavern 文档站

本目录是公开仓库 [`a86582751/dsh-nexttavern`](https://github.com/a86582751/dsh-nexttavern) 的静态文档站。正文取自仓库已经公开的 Markdown，不引入第三方依赖、在线字体或外部服务。

## 维护入口

只维护 TypeScript 源码；原路径 JavaScript 是生成物，Pages 工作流直接运行已提交的生成物。

| 维护源码 | 生成物 | 职责 |
| --- | --- | --- |
| `src/build.mts` | `build.mjs` | Markdown 渲染、首页、页面外壳、媒体处理、搜索索引与链接检查 |
| `src/site.config.mts` | `site.config.mjs` | 导航、章节选择器、发行与安装文案 |
| `src/site.ts` | `theme/site.js` | 主题、导航、目录、搜索、复制、安装页签与截图灯箱 |

`theme/site.css` 是共用样式。源码、生成物及公开投影映射统一登记在维护库 `release/source-manifest.json`，不要另建清单或手改生成物。使用维护库既有 `build-typescript.mjs` 对已登记入口定点生成。

```powershell
# 在维护库中，根据 manifest 定点生成站点 JavaScript
node runtime/alpha3/lib/operations/build-typescript.mjs release/public/site/src/build.mts release/public/site/build.mjs
node runtime/alpha3/lib/operations/build-typescript.mjs release/public/site/src/site.config.mts release/public/site/site.config.mjs
node runtime/alpha3/lib/operations/build-typescript.mjs release/public/site/src/site.ts release/public/site/theme/site.js

# 维护库：公开 Markdown 位于 release/public，默认输出 artifacts/public-site-preview
node release/public/site/build.mjs

# 公开库：公开 Markdown 位于仓库根目录，默认输出 artifacts/site
node site/build.mjs

# 渲染并检查链接/锚点；临时目录在项目 artifacts/test-temp，结束时清理
node site/build.mjs --check
```

生成器默认通过 ffmpeg 将截图压成 WebP；缺少 ffmpeg 时复制原图。`--no-optimize` 跳过压缩，`--out <目录>` 指定输出位置。

## 设计与内容

日间采用冒险手账：奶油纸、陶土橙、鼠尾草、宋体标题、细线与拼贴纸页。夜间采用星海酒馆：海军蓝与香槟金。两者共用排版、交互和本地字体栈，优先遵从已保存主题，其次遵从系统配色。

首页以概念插画呈现记忆、世界线、角色集群，不把概念画当成实机界面。首屏分别使用 `art/journal-day.webp` 和 `art/journal-night.webp`；三章配图为 `memory-atlas.webp`、`worldline-atlas.webp`、`character-atlas.webp`。素材原样复制到 `assets/art`，来源见 `art/README.md`。看板娘头像沿用 `brand-mark.webp`，品牌名称由可访问文字排版，标签图标使用 `favicon.png`。

实机截图集中于 `screenshots.html`，首页仅保留入口。支持范围和安装说明沿用公开文档；当前发行与 GitHub/npm 口径对齐，0.3 明确保留“开发中，尚未发布”。页面重设计不增加运行时模型请求。

正文来自 `README.md`、`INSTALL-WINDOWS.md`、`INSTALL-LINUX.md`、`PUBLIC-ACCESS.md`、`ARCHITECTURE.md`、`SCREENSHOTS.md`、`CHANGELOG.md`、`DEVELOPMENT-0.3.md` 和 `CONTRIBUTING.md`。配置中的章节选择器是精确 H2 标题，章节消失会使生成失败。文档内页继续保留侧边导航、面包屑、页内目录与前后页。

## 发布

`.github/workflows/pages.yml` 在 `main` 的文档或站点内容变化时渲染并将 `artifacts/site` 发布至 Pages，不改变 npm 包。可选 ffmpeg 安装限时 90 秒；超时使用复制原图的回退。

带 `[skip ci]` 的提交不自动部署。已获当次发布授权时手动 dispatch 一次 Pages，复用该任务，不对同一输入重复本地与云端全量验证。发布前保存上一轮精确 artifact，发布后按本次 head 的 artifact 字节核对线上页面与资源；workflow 成功不能替代 HTTP 读回。
