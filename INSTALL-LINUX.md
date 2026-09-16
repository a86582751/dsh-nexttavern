# Linux 一键安装

[返回首页](README.md) · [Windows 安装](INSTALL-WINDOWS.md) · [手动安装](README.md#安装) · [反馈问题](https://github.com/a86582751/dsh-nexttavern/issues/new/choose)

`NextTavern-Setup.sh` 是 0.2.5 新增的 Linux 一键安装脚本。它是一个自包含的 shell 脚本：不需要预装 Node.js，不需要 root，也不需要系统包管理器——脚本自己下载并校验一份便携的 Node.js 运行时，然后把工作区、桌面入口和启动／停止入口准备好。

## 需要什么，不需要什么

| 需要 | 不需要 |
| --- | --- |
| 一个 POSIX shell（`sh` 即可）。 | 不需要 root 或 `sudo`。 |
| `curl` 或 `wget`（二者有其一）。 | 不需要 `apt`／`dnf`／`pacman` 等系统包管理器。 |
| `tar`，以及 `sha256sum`、`shasum` 或 `openssl` 中的任意一个。 | 不需要预装 Node.js，也不受系统 Node 版本影响。 |
| 可用的网络（首次安装需要下载运行时和主包）。 | 不需要 Visual C++ 运行库之类的 Windows 特有依赖。 |

**支持范围：x86_64 与 aarch64，glibc 发行版。** 基于 musl 的发行版（例如 Alpine）不在支持范围内，脚本检测到 `/etc/alpine-release` 会直接说明原因并停止，不会装到一半失败。

## 安装

一条命令即可：

```sh
sh NextTavern-Setup.sh
```

脚本会依次做这些事：检查架构与基本工具 → 下载便携 Node.js 运行时并校验 SHA-256 → 解压到安装目录的 `runtime` 下 → 准备 `harness`、`home`、`workspace` 等目录 → 启动本地服务并打开浏览器。第一次进入时，按提示选择工作区、填写自己的模型供应商，然后在新建会话的预设菜单里切到“角色扮演模式”。

**再次运行同一个脚本不会重装**：如果已经装好了，它会直接打开现有安装。

常用参数：

```sh
sh NextTavern-Setup.sh --root "$HOME/NextTavern"   # 换一个安装目录
sh NextTavern-Setup.sh --proxy http://127.0.0.1:7890   # 走代理下载
sh NextTavern-Setup.sh --source github   # 用 GitHub 源而不是镜像
sh NextTavern-Setup.sh --action stop   # 停止服务
sh NextTavern-Setup.sh --help   # 查看全部参数
```

另有 `--no-open`（不自动打开浏览器）与 `--no-shortcut`（不创建桌面入口）。

## 安装到哪儿

默认安装到 `~/.local/share/NextTavern`（遵循 `XDG_DATA_HOME`，可用 `--root` 覆盖）。

| 目录 | 用途 |
| --- | --- |
| `runtime` | 便携 Node.js 运行时、安装配方与启动引擎。 |
| `harness`、`home` | 本地服务本体，以及你的 DSH 配置目录。 |
| `workspace` | 角色扮演工作区：角色卡、故事资源和导出文件。 |
| `downloads` | 已下载并校验过的文件，重试与再次安装时复用。 |
| `logs` | 安装与服务日志。 |
| `backups`、`temp` | 升级备份与临时文件。 |

安装目录里还会生成 `NextTavern.sh`，它是有执行权限的启动器：直接运行它是启动，`./NextTavern.sh stop` 是停止。

## 桌面入口与启停

安装后会在 `~/.local/share/applications` 写入两个桌面条目：

- **NextTavern** —— 启动服务并打开浏览器。
- **Stop Next Tavern** —— 停止后台服务。

如果你的 `~/Desktop` 目录存在，脚本还会在那里放一份 `NextTavern.desktop` 副本。桌面环境对 `.desktop` 文件的支持各有差异；如果图标没有立刻出现，注销再登录一次，或者直接使用安装目录里的 `NextTavern.sh`。

停止服务也可以直接在终端里做：

```sh
sh NextTavern-Setup.sh --action stop
```

停止时不会删除任何故事、笔记或设置。

## 下载来源、代理与缓存

- **来源**：默认走镜像源，通常更稳定；`--source github` 可切换到 GitHub 直连。
- **代理**：`--proxy` 传入的地址会同时用于运行时下载和后续的依赖安装，并记录在生成的启动器里。
- **缓存**：Node.js 运行时会按 SHA-256 校验后才解压；校验通过的文件留在 `downloads` 下，重复安装或重试时直接复用。

如果下载中断或校验失败，脚本会依次尝试镜像和官方来源，全部失败时给出明确提示并保留已下载的文件——填好 `--proxy` 后重跑同一条命令即可继续，不用重新下载。

## 端口与日志

**端口。** 服务只监听 `127.0.0.1`，端口在 3510–3599 之间自动选择一个空闲值，并写入安装根目录的 `running.json`。脚本不提供固定端口参数；如果你需要固定端口（例如做反向代理转发），请改走[手动安装](README.md#安装)路径，在那里可以显式指定 `--port`。

**日志。** 都在安装根目录的 `logs` 下：

| 文件 | 内容 |
| --- | --- |
| `install.log` | 安装各阶段的记录。 |
| `server.stdout.log` | 本地服务的标准输出，启动地址也在其中。 |
| `server.stderr.log` | 本地服务的错误输出。 |
| `launcher.log` | 通过桌面入口或启动器启动时的输出。 |

如果启动失败，脚本会提示服务已退出或未在 90 秒内就绪，此时先看 `logs/server.stderr.log`。

## 卸载与回滚

**停止**：用 `Stop Next Tavern` 桌面条目，或 `sh NextTavern-Setup.sh --action stop`。

**卸载**：停服务后，删除 `~/.local/share/applications/nexttavern.desktop`、`nexttavern-stop.desktop` 以及 `~/Desktop/NextTavern.desktop`，再删除整个安装根目录。

**你的故事在哪。** 角色卡、故事文本、笔记、导出文件和模型配置都在安装根目录的 `workspace` 与 `home` 里；删除安装目录会一并删除它们，想保留内容就先单独备份这两个目录。

## 我们还不能保证的事

- **这个安装器是 0.2.5 新增的。** 上面列出的架构与发行版范围就是已经测试过的范围；其他发行版、其他架构或容器环境没有逐一验证。
- **不支持 musl 发行版。** Alpine 等系统请自行安装 Node.js 22+ 并使用[手动安装](README.md#安装)。
- **安装需要网络。** 首次安装要下载便携运行时与主包，离线环境请走手动安装。
- **桌面图标依赖桌面环境。** 脚本写入的是标准 XDG 条目，但不保证每个桌面环境都会立刻刷新。
- **本机服务不代表公网可用。** 想从手机或外网访问，请按[手机电脑公网访问指南](PUBLIC-ACCESS.md)显式配置。

## 下载

- [NextTavern-Setup.sh](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.2.5/NextTavern-Setup.sh)
- [nexttavern-setup.tgz](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.2.5/nexttavern-setup.tgz)
- [SHA256SUMS](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.2.5/SHA256SUMS) 与[版本说明](https://github.com/a86582751/dsh-nexttavern/releases/tag/v0.2.5)

下载后先校验再运行是个好习惯：

```sh
sha256sum NextTavern-Setup.sh   # 与 SHA256SUMS 中的对应行比对
sh NextTavern-Setup.sh
```
