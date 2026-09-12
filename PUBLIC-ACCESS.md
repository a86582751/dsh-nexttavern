# 手机电脑公网访问指南

这份指南说明：怎样把自己的 DeepSeek Harness / dsh-NextTavern 放在一台常开电脑或云服务器上，然后用手机和电脑浏览器访问。

最省事的路线是：把本机的 AI 编程助手作为安装员。你只需要准备域名、模型 API、Cloudflare 和服务器登录材料；AI 负责读取现有环境、安装固定版本、配置鉴权、建立 Tunnel、测试和留下回滚记录。

我们最初部署时，正是通过本地 `cloudflare-admin.env` 和服务器 SSH 私钥，让 AI 接手了最繁琐的 DSH 安装、Cloudflare 配置和通道建立。你不需要先学会服务器运维，只需要准备材料、限定允许操作的范围，并按下面的结果清单验收。

## 先看结论

推荐给一个可信玩家的结构是：

```text
手机或电脑浏览器
    -> Cloudflare Access 登录
    -> Cloudflare Tunnel
    -> Nginx 127.0.0.1:8184
    -> 鉴权版 Harness 127.0.0.1:3510
    -> 模型 API
```

公网只进入 Cloudflare Tunnel，Harness 和 Nginx 都绑定在服务器回环地址。手机只是控制器，服务器必须保持开机并能访问模型 API。

这是单玩家方案。它不会自动提供多用户隔离：获准进入的身份会共享会话、工作区、模型凭据和服务器上的 Harness 权限。要给其他玩家使用，应为每个人建立独立实例、独立工作区和独立身份策略。

主路线不要求你手工写代码。把本指南后面的“给 AI 的任务”复制给本机 AI 编程助手，让它先审计再执行。购买云服务器、注册域名、转移 DNS、输入 Cloudflare 登录验证码等需要你本人完成的动作，AI 不能替你假设已经完成。

## 你需要准备什么

1. 一台常开的 Linux 云服务器，或一台你能长期保持联网的电脑。云服务器通常更省心。
2. 一个由 Cloudflare 托管 DNS 的域名，例如 `play.example.com`。
3. 一个可用的模型 API 账号和配额。模型费用由你的供应商收取。
4. 本机 AI 编程助手，并明确授权它读取指定的私钥和配置文件、通过 SSH 操作这台服务器。
5. 一个 Cloudflare API Token 和服务器 SSH 私钥。它们只交给本机 AI 进程使用，不要粘贴到聊天、Git、截图或公开 issue。

预算取决于云厂商、磁盘、流量和模型供应商价格。Harness 本身不在这台服务器上运行本地模型；服务器主要负责网页、会话、文件和工具，推理仍通过模型 API 完成。

登录后的 Harness 可以使用文件和命令行工具。给其他人独立部署时，应使用不同操作系统用户或容器，并分别保管模型凭据；仅换工作区名称不能隔离服务器权限。

## Cloudflare API Token 怎么拿

API Token 是让 AI 或脚本管理 Tunnel、Access 和 DNS 的窄权限凭据。它不是 Access 登录令牌、Access 应用的 AUD，也不是 Tunnel 运行凭据。

1. 登录 Cloudflare 控制台。
2. 点击右上角头像，进入 **My Profile**。
3. 打开 **API Tokens**，选择 **Create Token**。
4. 选择 **Custom token**，不要创建 Global API Key。
5. 只选择目标账号和目标域名，并授予最低需要的权限：

   | 范围 | 权限 |
   | --- | --- |
   | 账号 | Cloudflare Tunnel 写入/编辑 |
   | 账号 | Access 应用和策略写入/编辑 |
   | 域名 | DNS 编辑 |
   | 域名 | Zone 读取 |

   如果你还没有 Identity Provider，需要由 AI 创建或编辑 IdP，再额外授予对应的 **Access Identity Providers 编辑** 权限。已经有可用的 Cloudflare/Google IdP 时，不要为了本项目扩大权限。

6. 令牌名称写清用途和范围，确认只绑定目标账号/域名。
7. 创建后立即复制令牌。Cloudflare 通常只显示一次；丢失时撤销旧令牌并重新创建。
8. 在本机私有目录保存，例如：

   ```text
   C:\Users\example\private\cloudflare-admin.env
   ```

   在本机私有文件里将下面的占位值替换为自己的值，真实值不要写入仓库。随包提供 [cloudflare-admin.env.example](integrations/auth-webserver/cloudflare-admin.env.example)：

   ```dotenv
   CLOUDFLARE_API_TOKEN=replace-with-token
   CLOUDFLARE_ACCOUNT_ID=replace-with-account-id
   CLOUDFLARE_ZONE_ID=replace-with-zone-id
   ```

   Account ID 通常在 Cloudflare 账号概览页复制，Zone ID 在目标域名的 Overview 页复制。它们是资源定位值，不是登录密码。

   这个文件不会因为存在就自动生效。AI 脚本应遵循“进程环境变量优先，本地 env 文件兜底”，并且永远不打印字段值。`CLOUDFLARE_API_TOKEN` 只用于管理资源；Access 应用 AUD、Access JWT 和 Tunnel token 是另一组值，不能混填。

   把文件放在只有自己的系统账户可读取的位置，不要放进网盘共享目录或仓库。部署完成后可撤销临时管理 Token；已安装的 Tunnel 使用自己的运行凭据，二者不同。下次维护再给 AI 一个新的限权 Token 即可。

Access 的登录方式可使用已经配置好的 Google 身份提供方，也可按 Cloudflare 支持的方式使用邮箱验证码。控制台仍需要你本人登录或输入验证码；允许规则只写自己的邮箱，先确认规则生效，再接通公开域名。API 权限名称会随控制台更新，隧道权限也可能显示为 `Cloudflare One Connector: cloudflared Write`，可让 AI 按官方文档核对缺少的具体权限。

## 阿里云 ECS SSH 私钥怎么拿

其他云厂商的名称可能不同，但原理相同：云控制台生成密钥对，服务器保存公钥，本机保存私钥。

1. 在阿里云 ECS 控制台打开 **密钥对**，创建一对新的 SSH 密钥。
2. 下载 `.pem` 私钥文件，并把它放在本机私有目录，例如：

   ```text
   C:\Users\example\.ssh\example-ecs.pem
   ```

3. 创建或绑定 ECS 实例时选择这对密钥。已有运行中的实例如需绑定，按控制台提示先备份并安排重启；不要在不清楚影响的情况下重启已有生产机。
4. 私钥只留在本机。服务器只保存公钥；私钥丢失后通常不能从云厂商重新下载，只能通过云控制台救援、已有登录方式或重新配置密钥恢复。
5. 安全组只允许你自己的固定公网 IP 访问 SSH。不要为 Harness 开放 `3510` 或 `8184`；这两个端口只应监听 `127.0.0.1`，公网入口使用 Tunnel。

如果 AI 无法 SSH，先使用云厂商网页控制台检查实例状态、磁盘、用户和 SSH 配置。不要为了让 AI 连接而关闭现有防火墙或改动无关生产服务。

## 给 AI 的任务

把下面内容交给本机 AI 编程助手，并替换尖括号里的值。不要把 Token、私钥正文或 JWT 放进任务文本。

```text
请在已授权的本机和服务器范围内，部署我的单玩家 DeepSeek Harness 公网访问。

固定信息：
- 服务器：<SERVER_HOST，例如 server.example.com>
- SSH 用户：<SERVER_USER>
- SSH 私钥：<SSH_KEY_PATH，例如 C:\Users\example\.ssh\example-ecs.pem>
- 本机 Cloudflare 管理 env：<CLOUDFLARE_ENV_PATH，例如 C:\Users\example\private\cloudflare-admin.env>
- 公网主机名：<PUBLIC_HOST，例如 play.example.com>
- Cloudflare Access 允许身份：<ALLOWED_EMAIL，例如 user@example.com>

执行边界：
1. 先读取当前服务、版本、监听端口、磁盘和工作区，说明会影响哪些文件；不要先重启或停止未知服务。
2. 固定 DeepSeek Harness 0.1.2-alpha.3、dsh-NextTavern 0.1.2 和 @isund/dsh-auth-webserver 0.1.0-alpha.3.2。只使用公开 release 资产，不使用 npm 浮动版本。
3. 先建立带 SHA-256 的全新备份和回滚目录，再安装或修改。故事、会话、工作区和模型凭据不能删除。
4. Cloudflare Access 先创建单一允许身份的应用策略，再创建 Tunnel 和 DNS；禁止 Everyone、Bypass 和公开源站端口。
5. Tunnel 必须原样转发公网 Host/Origin，不得把公网 Host 伪装成 localhost。
6. 使用本机 env 文件时，进程环境变量优先、env 文件兜底；绝不打印 Token、AUD、JWT、Cookie、Tunnel token、模型 API key、私钥或完整环境变量。
7. 安装独立鉴权包时使用：
   npm install --prefix <PROFILE_DIR> --legacy-peer-deps --ignore-scripts --no-audit --no-fund <AUTH_TGZ>
8. 创建私有 access.env，按公开包 integrations/auth-webserver/access.env.example 配置 team domain、Access AUD、允许邮箱和公网 Host。该模板不会自动加载。
9. Harness 使用回环监听和鉴权 patch 启动：
   node --env-file=<PRIVATE_ACCESS_ENV> <HARNESS_ROOT>/node_modules/@deepseek-ai/dsh/lib/bin.js web --patch <PROFILE_DIR>/node_modules/@isund/dsh-auth-webserver/cordis.patch.yml --host 127.0.0.1 --port 3510 --no-open
10. 先只审计 public-access 工具：
    node tools/public-access.mjs --root <HARNESS_ROOT> --group harness
    node tools/public-access.mjs --root <PROFILE_DIR> --group profile
    在本次部署授权范围内，完成审计、停止目标实例并指定全新备份目录后，使用 DSH_ALLOW_PUBLIC_ACCESS=1、--apply、--stopped。工具默认不改文件、不配置 Cloudflare、不重启服务。
11. harness 组只启用已登记的 remote settings 和 continuous reconnect；profile 组只启用有 verified JWT marker 保护的上传兼容。不要全局放行 Host/Origin。
12. 使用公开包里的 nginx.conf.example，Nginx 在 127.0.0.1:8184 反代到 127.0.0.1:3510。保留默认拒绝虚拟主机，只允许我的公网 Host，包括拒绝从隧道传入的 Host: localhost。保留 WebSocket 和流式响应，关闭 buffer 与 request replay。Harness 与 cloudflared 使用独立 systemd 服务；Harness 用户不能重启 cloudflared。
13. 完成后逐项验证：Access 白名单、未登录拒绝、错误身份拒绝、错误/过期 JWT、伪造认证头、正确 Host、HTTP、WebSocket、remote settings、模型列表、真实模型调用、上传、导出、服务重启恢复、Tunnel 停止后的公网离线。
14. 最后给出：变更文件、版本、备份路径、验证结果、未验证项和精确回滚命令。输出只能是脱敏摘要，不得输出任何秘密。
15. 不要购买资源、转移域名、输入验证码、关闭无关服务或修改已有生产部署，除非我明确授权。
```

## 安装材料和工具

公开发布包含 NextTavern 主包和独立鉴权包。鉴权包是管理员可选安装项，单独安装 NextTavern 不会自动打开公网访问：

- [主包 dsh-nexttavern.tgz](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.1.2/dsh-nexttavern.tgz)
- [鉴权包 dsh-auth-webserver.tgz](https://github.com/a86582751/dsh-nexttavern/releases/download/v0.1.2/dsh-auth-webserver.tgz)
- [鉴权配置模板](integrations/auth-webserver/access.env.example)
- [Nginx 配置模板](integrations/auth-webserver/nginx.conf.example)
- [公网补丁工具](tools/public-access.mjs)

先按 [README 安装](README.md#安装)得到 Harness、Profile 和 NextTavern 主包，再安装鉴权包。补丁工具位于已安装的 NextTavern 包内 `tools/`；从其他目录运行时，需要加上完整包路径。保留 `DSH_HOME` 环境变量，使启动命令指向同一个 Profile，不能装在一处、启动另一处。

复制模板到服务器私有位置后，四个字段形如下面这样；这只是示例，文件不会自动加载：

```dotenv
CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=replace-with-your-access-application-aud
CLOUDFLARE_ACCESS_ALLOWED_EMAIL=user@example.com
DSH_PUBLIC_HOST=play.example.com
```

鉴权包的 `private: true` 只用于防止误发布到 npm，不代表它能替你创建 Cloudflare 资源。Cloudflare 管理 Token 仍然只在本机使用，Tunnel 运行 token 只放服务器受限路径。

## 实施阶段与验收

| 阶段 | AI 应做什么 | 玩家看到的结果 |
| --- | --- | --- |
| 1. 本机准备 | 检查 Token、私钥、env 路径和权限，不打印值 | 材料齐全，未连接生产 |
| 2. 服务器审计 | 检查现有服务、版本、端口和备份位置 | 确认不会覆盖无关服务 |
| 3. 安装 | 安装 Harness、NextTavern、auth 包，生成 access.env | Harness 仍只在回环监听 |
| 4. 鉴权 | 创建 Access 白名单、验证 JWT 和官方 alpha.3 Cookie 衔接 | 错误身份不能进入 |
| 5. Tunnel | 建立 Tunnel、DNS 和 Nginx 回环代理 | 公网只经过 Access/Tunnel |
| 6. 连接调优 | 应用登记的心跳、持续重连、HMR 和 Nginx/Tunnel 参数 | 手机短暂切网后更容易恢复 |
| 7. 验收 | 先电脑，再手机蜂窝网络、收发、上传、导出、锁屏和切 Wi-Fi | 形成可审计的成功/未验证清单 |
| 8. 交付 | 保存备份、哈希、systemd 状态和回滚命令 | 下次升级可以先审计再回退 |

### 连接调优的当前目标

这些是本方案的配置目标，不是对所有移动网络的保证：

- WebSocket 心跳从 2 秒调整到 15 秒；历史约 4–6 秒的断线判定放宽到大约 30–45 秒，具体时间受定时器和网络影响。
- 浏览器在线时继续使用封顶的 10 秒退避重连。
- 生产 HMR 关闭，`/plugins/events` 应返回 404。
- Nginx 在 `127.0.0.1:8184`，上游为 `127.0.0.1:3510`，WebSocket 读写超时 86400 秒，启用 TCP keepalive，关闭缓冲和请求重放。
- Tunnel 指向 Nginx 的 `http://127.0.0.1:8184`；`keepAliveTimeout: 300s`、`keepAliveConnections: 100`、`tcpKeepAlive: 30s`。100 是源站空闲连接池上限，不是 100 个玩家或 100 条 Cloudflare 边缘连接。
- Linux QUIC UDP 接收/发送缓冲上限可按部署清单设置为 `7864320` 字节（7.5 MiB）。
- Harness 与 cloudflared 分开管理；Harness 自重启不能重启 cloudflared，Harness 运行用户也不应有重启 cloudflared 的权限。换皮肤或插件引发 Harness 重启时，四条 Tunnel 边缘连接可继续保持。

浏览器锁屏、系统后台限速、蜂窝网络切换和边缘升级仍可能断开 WebSocket。持续重连不会重放已经提交的发送/终止 HTTP 请求；没有响应时先查询原生任务状态，不要盲目重复点击。

### 历史证据与本次验收要分开

原始部署记录曾验证过：WebSocket 穿过 Nginx 连续 40 秒、收到 2 次 15 秒心跳；Tunnel 有 4 条连接；服务为 `active`；未登录公网请求返回 `302`。这些是历史验证证据，不能写成本次部署或本次手机真机测试已经完成。

当时还核实了四条 QUIC 连接在线、重启后的 Tunnel 错误计数为 0，以及 Harness、Nginx、cloudflared 均为 active、检查时无 warning 日志。历史 Harness 端口是 3081，本指南统一使用 3510；端口不是固定要求，关键是 Nginx 上游和 Harness 实际监听一致。

Cloudflare 支持长期 WebSocket，但边缘升级仍可能中断连接，所以需要保留自动恢复，详见 [Cloudflare WebSocket 文档](https://developers.cloudflare.com/network/websockets/)。更新客户端后，手机必须关闭旧网页标签，再重新打开自己的 `https://play.example.com`，否则可能仍在使用旧代码。

本次交付必须重新记录：

- 电脑浏览器登录、模型列表和真实模型调用；
- 手机蜂窝网络登录、发送、停止、上传和导出；
- 锁屏、前后台切换、Wi-Fi/蜂窝切换后的恢复；
- 非白名单身份、过期登录、错误 Host 和伪造认证头的拒绝；
- 从 Nginx 入口提交 `Host: localhost` 或其他未声明主机名应返回 403，不得转发到 Harness 的本机访问分支；
- Tunnel 停止后公网确实离线，SSH 仍可维护服务器；
- `active/running`、`NRestarts`、最近错误、备份路径和回滚结果。

没有实际完成的项目必须标记为“未验证”，不要用历史日志或浏览器截图代替。

## 手工核对命令

普通玩家通常不需要执行这些命令；AI 完成后可以让它把脱敏结果贴回来。手工接管时，在服务器上使用自己的真实路径和服务名。

检查服务和监听：

```bash
systemctl status deepseek-harness.service --no-pager
systemctl status cloudflared-deepseek-harness.service --no-pager
ss -ltnp | grep -E '127\.0\.0\.1:(3510|8184)'
journalctl -u deepseek-harness.service -n 80 --no-pager
journalctl -u cloudflared-deepseek-harness.service -n 80 --no-pager
```

检查公网响应时，不要把 JWT、Cookie 或完整响应头贴到聊天：

```bash
curl -I https://play.example.com/
```

预期是未登录时由 Cloudflare Access 拒绝或重定向；不要把直接访问服务器公网 IP 当作成功标准。

检查补丁前先审计：

```bash
node tools/public-access.mjs --root <HARNESS_ROOT> --group harness
node tools/public-access.mjs --root <PROFILE_DIR> --group profile
```

应用或回滚都必须明确声明服务已停止，并使用全新、精确的备份目录：

```bash
export DSH_ALLOW_PUBLIC_ACCESS=1
node tools/public-access.mjs --root <HARNESS_ROOT> --group harness --apply --stopped --backup <NEW_HARNESS_BACKUP_DIR>
node tools/public-access.mjs --root <PROFILE_DIR> --group profile --apply --stopped --backup <NEW_PROFILE_BACKUP_DIR>
node tools/public-access.mjs --rollback <BACKUP_DIR> --stopped
unset DSH_ALLOW_PUBLIC_ACCESS
```

工具不会替你停止服务、配置 Cloudflare 或重启系统。执行命令前先确认没有正在进行的模型任务，并让 AI 记录事务返回值。

## 常见故障

| 现象 | 先检查什么 | 不要做什么 |
| --- | --- | --- |
| `502 Bad Gateway` | Harness 是否 active、`127.0.0.1:3510` 是否监听、Nginx 上游是否仍指向 3510 | 不要连续重发发送/终止命令，也不要盲目重启 Tunnel |
| `401` | Access 是否登录、登录是否过期、AUD/允许邮箱/Host 是否正确 | 不要删除官方 alpha.3 Cookie 鉴权 |
| `403` | Host/Origin、Access 身份和官方 loopback 边界 | 不要全局放行 Host/Origin 或把 Host 改成 localhost |
| 模型列表为空 | remote settings 补丁、Host settings API、模型 API 配置和缓存 | 不要把远程浏览器整体标为 loopback |
| 旧页面行为没变 | 关闭旧标签并重新打开，必要时强制刷新 | 不要先判断服务器补丁没有生效 |
| 锁屏后暂时无响应 | 等待浏览器在线并自动重连，再检查原生任务状态 | 不要盲目重复提交同一条消息 |

### 立即撤掉公网入口

需要紧急下线时，先停止 Tunnel：

```bash
sudo systemctl stop cloudflared-deepseek-harness.service
```

这样公网访问立即中断，Harness 仍绑定回环地址，可以通过 SSH 检查。需要回滚补丁时，保留故事和工作区，按备份清单执行 `public-access.mjs --rollback ... --stopped`；如果要恢复官方登录流程，先停 Tunnel，再移除启动命令中的 `--patch`，不要直接删除安装目录或 Session 原始事件。

## 设计边界

鉴权、Tunnel、Nginx、重连和回滚不会额外调用剧情模型：正常、重试、回退均增加 0 次运行时模型请求。鉴权会获取并缓存 Cloudflare 公钥，这是普通网络请求。部署时使用 AI 助手本身可能产生助手费用，之后的创作和真实模型测试也使用自己的供应商额度；这些费用应分别看待。

## 官方资料

- [Cloudflare：创建 API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare：通过 API 创建 Remote Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel-api/)
- [Cloudflare：WebSocket 支持](https://developers.cloudflare.com/network/websockets/)
- [阿里云 ECS：实例登录凭证管理](https://help.aliyun.com/zh/ecs/user-guide/instance-logon-credential-management)
- [dsh-NextTavern 公开发布](https://github.com/a86582751/dsh-nexttavern/releases)
