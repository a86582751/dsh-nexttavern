# 文档站

本目录是公开仓库 [`a86582751/dsh-nexttavern`](https://github.com/a86582751/dsh-nexttavern) 文档站的生成器。站点由仓库自己已经公开的 Markdown 渲染而成，不引入任何第三方依赖、字体或外部服务。

- `build.mjs`：静态站点生成器（Markdown → HTML、图片压缩、离线搜索索引、链接与锚点校验）。
- `site.config.mjs`：导航分组、落地页文案与每个页面引用的章节选择器。
- `theme/site.css`、`theme/site.js`：主题与交互（深浅色、目录抽屉、搜索、截图灯箱、代码复制）。
- `art/`：首页轮换用的鲸鱼娘立绘，来源与出图批次见 `art/README.md`。
- `art/brand-mark.webp`、`art/brand-word.webp`、`art/favicon.png`：顶栏／页脚品牌标识
  （看板娘头像＋她倚着的「Next Tavern」木牌）与标签图标，同样取自皮肤自有出图；
  三个文件都是提交进仓库的成品字节，生成器只做原样复制。

首页不使用第二份口径的宣传语：标语打字机从皮肤 `dsh-nexttavern-amber` 的源码里读
`HEADLINE_GROUPS`（缺锚点即构建失败），首图轮换用 `art/` 里的自有立绘——两者都和
皮肤保持同一来源。首图下方的说明是一句固定文案（`hero.artCaption`），不逐图改字：
皮肤包为了体积只收录了少数几张立绘，逐图点名会对不上。

## 运行

```powershell
# 维护仓库：内容源是 release/public/，输出到 artifacts/public-site-preview
node release/public/site/build.mjs

# 公开仓库：内容源是仓库根目录，输出到 artifacts/site（该目录已在 .gitignore 内）
node site/build.mjs

# 只做一次检查（渲染到临时目录并校验链接）
node site/build.mjs --check
```

生成器默认使用 ffmpeg 把截图压成 WebP 并写入 `assets/media/`；缺少 ffmpeg 时直接复制原图，站点仍然可用。维护仓库与公开仓库共用同一份源码，区别只在于 Markdown 的位置（`release/public/` 或仓库根目录）。

## 页面从哪里来

页面正文全部取自仓库里既有的公开文档：`README.md`、`INSTALL-WINDOWS.md`、`INSTALL-LINUX.md`、`PUBLIC-ACCESS.md`、`ARCHITECTURE.md`、`SCREENSHOTS.md`、`CHANGELOG.md`、`CONTRIBUTING.md`。`site.config.mjs` 只声明分章方式与导航标题；章节标题写错或消失时构建会直接失败，避免站点与文档悄悄脱节。

## 发布

`.github/workflows/pages.yml` 在 `main` 上的文档或本站源码变化时渲染站点并把 `artifacts/site` 作为 Pages 制品发布，不需要密钥，也不修改 npm 包内容。
