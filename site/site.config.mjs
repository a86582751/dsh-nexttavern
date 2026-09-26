/**
 * Content and navigation for the public documentation site.
 *
 * Every page body comes from the already-public Markdown under
 * `release/public/`; this file only declares how those sections are grouped,
 * titled and linked. Section selectors are exact H2 headings and fail the
 * build when a heading disappears, so the site cannot silently drift away
 * from the documents it mirrors.
 */

export const site = {
    title: 'NextTavern 文档',
    productName: 'dsh-NextTavern',
    // 品牌标识直接搬皮肤自己的看板娘：头像（art/brand-mark.webp）加上她倚着
    // 的 "Next Tavern" 木牌（art/brand-word.webp），不再用 "NT" 字标本；
    // 来源见 art/README.md。
    brandMark: { mark: 'brand-mark.webp', word: 'brand-word.webp', wordAlt: 'NextTavern' },
    lang: 'zh-CN',
    description: 'dsh-NextTavern 使用文档：一键安装、角色卡导入、记忆系统、预设与文风、世界线分支、小说导出与公网访问。',
    keywords: ['DSH', 'DeepSeek Harness', '角色扮演', '酒馆', 'SillyTavern', 'NextTavern'],
    repoUrl: 'https://github.com/a86582751/dsh-nexttavern',
    releasesUrl: 'https://github.com/a86582751/dsh-nexttavern/releases',
    issuesUrl: 'https://github.com/a86582751/dsh-nexttavern/issues/new/choose',
    licenseName: 'GPL-3.0-only',
    licenseUrl: 'https://github.com/a86582751/dsh-nexttavern/blob/main/LICENSE',
    releaseVersion: '0.2.5',
    developmentLine: '0.3 开发中',
    harnessLine: 'DeepSeek Harness 0.1.7',
    hero: {
        eyebrow: 'DSH 角色扮演 Agent',
        // 标语与首图不写在这里：首页用自有皮肤 dsh-nexttavern-amber 同款的
        // 打字机标语轮换，标语在构建时从皮肤源码读取（见 build.mjs
        //「the skin's own words」一节），避免出现第二份口径。
        // 轮换图说的是同一句话：只是皮肤立绘轮播，不逐张换标签，因为皮肤包
        // 为了体积只收录了其中几张，逐图点名会对不上。
        artCaption: 'Welcome to the Next Generation Tavern',
        // 首图轮换；文件在 site/art/，来源与出图记录见 art/README.md。
        art: [
            { file: 'tavern-day-shelf.webp', alt: '日间酒馆里踩着梯子取酒瓶的鲸鱼娘立绘' },
            { file: 'tavern-day-fireplace.webp', alt: '日间酒馆壁炉前添柴的鲸鱼娘立绘' },
            { file: 'tavern-day-counter.webp', alt: '日间酒馆吧台前伏案写字的鲸鱼娘立绘' },
            { file: 'tavern-day-dusting.webp', alt: '日间酒馆吧台前擦拭酒瓶的鲸鱼娘立绘' },
            { file: 'tavern-day-door.webp', alt: '日间酒馆门口提灯回望的鲸鱼娘立绘' },
            { file: 'tavern-day-garden.webp', alt: '日间酒馆窗边浇花的鲸鱼娘立绘' },
            { file: 'tavern-night-window.webp', alt: '夜间窗边捧着杯子的鲸鱼娘立绘' },
            { file: 'tavern-night-desk.webp', alt: '夜间书桌前读书的鲸鱼娘立绘' },
            { file: 'tavern-night-candle.webp', alt: '夜里握着蜡烛望向圆窗星空的鲸鱼娘立绘' }
        ],
        lead: '把原生 Agent Loop 带进长篇角色扮演：AI 主动查阅世界、整理记忆、推演人物，你掌握方向，一起把故事写下去。',
        primary: { label: '快速开始', href: 'quickstart.html' },
        secondary: { label: '核心能力', href: 'capabilities.html' },
        facts: [
            { label: '最新发布', value: '0.2.5' },
            { label: '运行宿主', value: 'DeepSeek Harness' },
            { label: '许可证', value: 'GPL-3.0-only' }
        ]
    },
    quickInstall: {
        title: '一条命令开始',
        lead: '安装器只负责准备运行时与工作区：模型和密钥始终由你自己填写，服务只监听本机。',
        tabs: [
            {
                id: 'windows',
                label: 'Windows',
                note: '下载 NextTavern-Setup.exe 双击运行，支持原地升级；ARM64 设备用 arm64 版本。',
                primary: { label: 'Windows 安装指南', href: 'install-windows.html' },
                code: 'NextTavern-Setup.exe'
            },
            {
                id: 'linux',
                label: 'Linux',
                note: '自包含脚本，x86_64 与 aarch64（glibc），不需要 root，也不需要包管理器。',
                primary: { label: 'Linux 安装指南', href: 'install-linux.html' },
                code: 'curl -fsSLO https://github.com/a86582751/dsh-nexttavern/releases/download/v0.2.5/NextTavern-Setup.sh\nbash NextTavern-Setup.sh'
            },
            {
                id: 'manual',
                label: '手动安装',
                note: '想自己控制运行时与补丁：按文档配好六项兼容补丁，再挂载插件包。',
                primary: { label: '手动安装步骤', href: 'manual-install.html' },
                code: 'dsh plugin --profile web add ./dsh-nexttavern.tgz'
            }
        ]
    },
    features: [
        {
            icon: 'cards',
            title: '卡片即开即用',
            text: '直接读取 SillyTavern / TauriTavern 的 PNG `chara`／`ccv3` 与 JSON v1／v2／v3 人物卡，内嵌世界书一并保留。',
            href: 'quickstart.html'
        },
        {
            icon: 'memory',
            title: '长篇不丢细节',
            text: '固定设定不压缩、硬切窗口保留尾部正文、可追溯导演笔记，再加关键词／语义／混合三种历史召回。',
            href: 'memory.html'
        },
        {
            icon: 'palette',
            title: '预设与文风',
            text: '独立预设页，作用范围可选，三种文风模式与 16 种自带文风，200 个自定义槽位。',
            href: 'presets.html'
        },
        {
            icon: 'book',
            title: '长文本转角色卡',
            text: '把整部长篇读成一张可玩的卡：精读／粗读两档、原文冻结与哈希、每条笔记都能对上原文。',
            href: 'card-adaptation.html'
        },
        {
            icon: 'agents',
            title: '多模型与角色集群',
            text: '正文、记忆、读卡、状态、决策、导出各自路由到不同模型；主要角色可独立推演再由主代理协调。',
            href: 'character-cluster.html'
        },
        {
            icon: 'branch',
            title: '世界线与分支',
            text: '重新生成与修改后发送形成同对话世界线；也可显式分支到新对话，历史与来源都可追溯。',
            href: 'worldlines.html'
        },
        {
            icon: 'export',
            title: '把故事带走',
            text: '选定世界线导出小说稿，也能导出完整角色卡；结果进入资源库随时下载。',
            href: 'export.html'
        },
        {
            icon: 'skin',
            title: '自有皮肤与阅读体验',
            text: '整套界面重绘的琥珀皮肤，日间／夜间双主题；卡片自带 HTML/CSS 与状态栏模板同样保留。',
            href: 'skin.html'
        },
        {
            icon: 'install',
            title: '一键安装与公网访问',
            text: 'Windows 与 Linux 自包含安装器，镜像优先、逐文件校验；需要时再按指南接入公网访问。',
            href: 'install-windows.html'
        }
    ],
    showcase: {
        title: '看一眼实际体验',
        lead: '截图由维护者提供，包含个人主题与示例故事，不代表默认安装外观。',
        link: { label: '全部截图', href: 'screenshots.html' },
        items: [
            { src: 'screenshots/play.png', title: '沉浸式游玩', caption: '正文、状态栏与决策卡' },
            { src: 'screenshots/worldlines.png', title: '世界线与分支', caption: '同一对话里管理版本与分支' },
            { src: 'screenshots/memory.png', title: '记忆系统', caption: '窗口、笔记与检索设置' },
            { src: 'screenshots/retrieval.png', title: '混合检索', caption: '关键词、语义与混合三种方式' },
            { src: 'screenshots/characters.png', title: '角色集群', caption: '主要角色独立推演' },
            { src: 'screenshots/presets.png', title: '预设系统', caption: '文风、模式与作用范围' },
            { src: 'screenshots/novel.png', title: '长文本转角色卡', caption: '整本小说读成一张卡' },
            { src: 'screenshots/export.png', title: '小说导出', caption: '把世界线整理成小说稿' },
            { src: 'screenshots/skin-day.png', title: '自有琥珀皮肤 · 日间', caption: '整套界面重绘的日间主题' },
            { src: 'screenshots/skin-night.png', title: '自有琥珀皮肤 · 夜间', caption: '同一套设计 token 的夜间主题' }
        ]
    },
    groups: [
        {
            id: 'start',
            label: '开始使用',
            pages: [
                { id: 'quickstart', title: '快速开始', nav: '快速开始', file: 'README.md', sections: ['一键安装', '开始体验'] },
                { id: 'install-windows', title: 'Windows 一键安装', nav: 'Windows 安装', file: 'INSTALL-WINDOWS.md' },
                { id: 'install-linux', title: 'Linux 一键安装', nav: 'Linux 安装', file: 'INSTALL-LINUX.md' }
            ]
        },
        {
            id: 'features',
            label: '功能指南',
            pages: [
                { id: 'capabilities', title: '核心能力', nav: '核心能力', file: 'README.md', sections: ['核心能力'] },
                { id: 'memory', title: '记忆系统', nav: '记忆系统', file: 'README.md', sections: ['记忆系统', '嵌入模型'] },
                { id: 'presets', title: '预设系统', nav: '预设与文风', file: 'README.md', sections: ['预设系统'] },
                { id: 'card-adaptation', title: '长文本转角色卡', nav: '长文本转角色卡', file: 'README.md', sections: ['长文本转角色卡'] },
                { id: 'character-cluster', title: '角色集群', nav: '角色集群', file: 'README.md', sections: ['角色集群'] },
                { id: 'status-decision', title: '状态栏与决策卡', nav: '状态栏与决策卡', file: 'README.md', sections: ['状态栏与决策卡'] },
                { id: 'worldlines', title: '世界线与分支', nav: '世界线与分支', file: 'README.md', sections: ['世界线与分支'] },
                { id: 'reading', title: '按你的方式阅读与创作', nav: '阅读与创作', file: 'README.md', sections: ['按你的方式阅读与创作'] },
                { id: 'skin', title: '自有皮肤', nav: '自有皮肤', file: 'README.md', sections: ['全新自有皮肤'], dropHeading: true },
                { id: 'export', title: '从角色卡到可带走的小说', nav: '小说与卡片导出', file: 'README.md', sections: ['从角色卡到可带走的小说'] },
                { id: 'authoring', title: '交互式创作', nav: '交互式创作', file: 'README.md', sections: ['交互式创作'] },
                { id: 'usage', title: '用量统计', nav: '用量统计', file: 'README.md', sections: ['用量统计'] }
            ]
        },
        {
            id: 'advanced',
            label: '进阶与运维',
            pages: [
                { id: 'public-access', title: '手机电脑公网访问', nav: '公网访问', file: 'PUBLIC-ACCESS.md' },
                { id: 'manual-install', title: '手动安装', nav: '手动安装', file: 'README.md', sections: ['下载', '安装'] },
                { id: 'extensions', title: '文档扩展', nav: '文档扩展', file: 'README.md', sections: ['文档扩展'] },
                { id: 'patches', title: '补丁与依赖来源', nav: '补丁与依赖来源', file: 'README.md', sections: ['补丁与依赖来源'] },
                { id: 'update-uninstall', title: '更新、卸载与回滚', nav: '更新与卸载', file: 'README.md', sections: ['更新、卸载与回滚'] }
            ]
        },
        {
            id: 'reference',
            label: '参考',
            pages: [
                { id: 'architecture', title: '架构与设计', nav: '架构与设计', file: 'ARCHITECTURE.md' },
                { id: 'screenshots', title: '截图集', nav: '截图集', file: 'SCREENSHOTS.md' },
                { id: 'changelog', title: '更新日志', nav: '更新日志', file: 'CHANGELOG.md' },
                { id: 'development', title: '参与开发', nav: '参与开发', file: 'CONTRIBUTING.md', lang: 'en' },
                { id: 'feedback', title: '反馈、社区与许可', nav: '反馈与许可', file: 'README.md', sections: ['源码与验证范围', '社区支持', '反馈与许可'] }
            ]
        }
    ],
    footer: {
        blurb: 'dsh-NextTavern 是 DeepSeek Harness 的长篇角色扮演插件：卡片导入、世界线分支、长篇记忆、混合检索、文风预设与一键安装。',
        columns: [
            {
                label: '文档',
                links: [
                    { label: '快速开始', href: 'quickstart.html' },
                    { label: '记忆系统', href: 'memory.html' },
                    { label: '预设与文风', href: 'presets.html' },
                    { label: '更新日志', href: 'changelog.html' }
                ]
            },
            {
                label: '下载与安装',
                links: [
                    { label: '最新 Releases', href: 'https://github.com/a86582751/dsh-nexttavern/releases' },
                    { label: 'Windows 安装', href: 'install-windows.html' },
                    { label: 'Linux 安装', href: 'install-linux.html' },
                    { label: '公网访问指南', href: 'public-access.html' }
                ]
            },
            {
                label: '项目',
                links: [
                    { label: 'GitHub 仓库', href: 'https://github.com/a86582751/dsh-nexttavern' },
                    { label: '问题反馈', href: 'https://github.com/a86582751/dsh-nexttavern/issues/new/choose' },
                    { label: '参与开发', href: 'development.html' },
                    { label: '许可证 GPL-3.0-only', href: 'https://github.com/a86582751/dsh-nexttavern/blob/main/LICENSE' }
                ]
            }
        ]
    }
};

/** Public Markdown sources, relative to `release/public/`. */
export const sourceRoot = 'release/public';
