/**
 * Content and navigation for the public documentation site.
 *
 * Every page body comes from the already-public Markdown under
 * `release/public/`; this file only declares how those sections are grouped,
 * titled and linked. Section selectors are exact H2 headings and fail the
 * build when a heading disappears, so the site cannot silently drift away
 * from the documents it mirrors.
 */

export interface PageSource { file: string; sections?: string[] }
export interface SitePage extends PageSource {
    id: string; title: string; nav?: string; sources?: PageSource[];
    dropHeading?: boolean; lang?: string; summary?: string; description?: string;
}
export interface SiteGroup { id: string; label: string; pages: SitePage[] }

export const site = {
    title: 'NextTavern 文档',
    productName: 'dsh-NextTavern',
    // 看板娘头像与新手账排版共同组成网站品牌；素材来源见 art/README.md。
    brandMark: { mark: 'brand-mark.webp', word: 'brand-word.webp', wordAlt: 'NextTavern' },
    lang: 'zh-CN',
    description: 'dsh-NextTavern 0.3 使用文档。导入社区角色卡，体验作者开场与交互前端，使用 MVU 数值、Ruby 分析、结构化世界书和社区预设。',
    keywords: ['DSH', 'DeepSeek Harness', '角色扮演', '酒馆', 'SillyTavern', 'NextTavern'],
    repoUrl: 'https://github.com/a86582751/dsh-nexttavern',
    releasesUrl: 'https://github.com/a86582751/dsh-nexttavern/releases',
    issuesUrl: 'https://github.com/a86582751/dsh-nexttavern/issues/new/choose',
    licenseName: 'GPL-3.0-only',
    licenseUrl: 'https://github.com/a86582751/dsh-nexttavern/blob/main/LICENSE',
    releaseVersion: '0.3.0-rc.2',
    developmentLine: '0.3 第二个公开候选版',
    harnessLine: 'DeepSeek Harness 0.2.2-rc.5+',
    hero: {
        eyebrow: 'NEXT TAVERN · 你的下一段冒险',
        title: '是非真伪，选择无关错对',
        artCaption: '一盏灯，一本未完的故事。下一页，由你写下。',
        art: [
            { file: 'journal-day.webp', theme: 'light', alt: '冒险手账里的日间酒馆：鲸鱼娘与打开的故事书' },
            ...[
                '身穿水手服的鲸鱼娘，日间冒险手账封面',
                '身穿现代运动装的鲸鱼娘在林间徒步',
                '身穿学者长外套的鲸鱼娘，日间旅途',
                '身穿园艺背带裤的鲸鱼娘，日间旅途',
                '身穿汉服的鲸鱼娘漫游中式水乡',
                '身穿飞行夹克的鲸鱼娘，日间旅途',
                '身穿经典女仆装的鲸鱼娘，日间酒馆'
            ].map((alt, index) => ({
                file: 'journal-day-' + String(index + 2).padStart(2, '0') + '.webp',
                theme: 'light', alt
            })),
            { file: 'journal-night.webp', theme: 'dark', alt: '星海酒馆里的夜间故事：鲸鱼娘、灯火与星空' },
            ...[
                '身穿水手服的鲸鱼娘，夜间冒险手账封面',
                '身穿现代运动装的鲸鱼娘在夜色中露营',
                '身穿学者长外套的鲸鱼娘，夜间旅途',
                '身穿园艺背带裤的鲸鱼娘，夜间旅途',
                '身穿汉服的鲸鱼娘漫游夜色中的中式水乡',
                '身穿飞行夹克的鲸鱼娘，夜间旅途',
                '灯下夜读的鲸鱼娘，星海酒馆'
            ].map((alt, index) => ({
                file: 'journal-night-' + String(index + 2).padStart(2, '0') + '.webp',
                theme: 'dark', alt
            })),
            { file: 'memory-atlas.webp', theme: 'feature', alt: '以纸页、书签和线索连接的记忆档案概念插画' },
            { file: 'memory-atlas-night.webp', theme: 'feature-night', alt: '星海夜色中由纸页、书签和线索连接的记忆档案' },
            { file: 'worldline-atlas.webp', theme: 'feature', alt: '从一处起点延伸出多条旅程的世界线概念插画' },
            { file: 'worldline-atlas-night.webp', theme: 'feature-night', alt: '星光下从起点延伸出不同旅程的世界线地图' },
            { file: 'character-atlas.webp', theme: 'feature', alt: '不同角色各自书写、共同构成故事的角色集群概念插画' },
            { file: 'character-atlas-night.webp', theme: 'feature-night', alt: '夜间酒馆中不同角色的视角交织成共同的故事' }
        ],
        lead: '选一段作者开场，在卡片自己的界面里建立角色。让数值和世界书随剧情变化，沿这条世界线续写，也可以从已保存的情节另开分支。',
        primary: { label: '开始你的故事', href: '#install' },
        secondary: { label: '翻开使用手册', href: 'quickstart.html' },
        facts: [
            { label: '最新发行', value: '0.3.0-rc.2' },
            { label: '运行宿主', value: 'DeepSeek Harness' },
            { label: '许可证', value: 'GPL-3.0-only' }
        ]
    },
    quickInstall: {
        title: '安装 NextTavern',
        lead: '推荐使用官方 Windows 桌面版。最低宿主为 DeepSeek Harness 0.2.2-rc.5。从 0.2.x 迁移时，先导出卡片或小说，再使用新的 home 和工作区。',
        tabs: [
            {
                id: 'desktop',
                label: '官方桌面版（推荐）',
                note: '在「设置 → 插件」打开「添加插件」的下拉菜单，选择「安装第三方插件」。填入以下 npm 包名，安装并启用后重启桌面应用。',
                download: {
                    label: '下载官方桌面版 0.2.2-rc.5（Windows x64）',
                    href: 'https://download.deepseek.com/dsh-desk/bin/win-x64/deepseek-harness-0.2.2-rc.5-win-x64.exe'
                },
                primary: { label: '桌面安装步骤', href: 'quickstart.html#官方-windows-桌面版推荐' },
                code: 'dsh-nexttavern@0.3.0-rc.2'
            },
            {
                id: 'manual',
                label: 'Web CLI',
                note: 'Web CLI 需要 Node.js 24.9+。已有兼容宿主可直接运行第二行。',
                primary: { label: '目录与恢复步骤', href: 'manual-install.html' },
                code: 'npm install -g @deepseek-ai/dsh@0.2.2-rc.5\ndsh plugin --profile web add dsh-nexttavern@0.3.0-rc.2\ndsh web --host 127.0.0.1'
            },
            {
                id: 'windows',
                label: 'Windows 便携版',
                note: '便携安装器准备独立 Web 环境。选择 x64 或 ARM64 版本，迁移时使用新目录。',
                primary: { label: 'Windows 安装指南', href: 'install-windows.html' },
                code: 'NextTavern-Setup.exe'
            },
            {
                id: 'linux',
                label: 'Linux',
                note: '自包含脚本，x86_64 与 aarch64（glibc），不需要 root，也不需要包管理器。',
                primary: { label: 'Linux 安装指南', href: 'install-linux.html' },
                code: 'curl -fsSLO https://github.com/a86582751/dsh-nexttavern/releases/download/v0.3.0-rc.2/NextTavern-Setup.sh\nsh NextTavern-Setup.sh --root "$HOME/NextTavern-0.3"'
            }
        ]
    },
    features: [
        {
            icon: 'cards',
            title: '社区卡导入与作者开场',
            text: '导入原始 PNG／JSON 卡，预览作者给出的开场。选择后直接读作者原文，载入该开场的初值。',
            href: 'capabilities.html#社区卡导入与作者开场'
        },
        {
            icon: 'skin',
            title: '作者前端与交互',
            text: '在酒馆操作作者写的建角表单、终端与状态栏。接入受支持 Helper 接口的按钮可以推进剧情或更新设定。',
            href: 'capabilities.html#作者前端与交互'
        },
        {
            icon: 'branch',
            title: 'MVU 数值状态机',
            text: '体力、物品和人物关系随剧情结算。打开历史分支或重启时，继续使用对应世界线保存的数值。',
            href: 'capabilities.html#mvu-数值状态机'
        },
        {
            icon: 'memory',
            title: 'Ruby 额外分析',
            text: '按开局、轮次或关键词运行分析，让结果供后续剧情使用。玩家也能手动运行任务、切换方案和查看结果。',
            href: 'capabilities.html#ruby-额外分析'
        },
        {
            icon: 'book',
            title: '结构化世界书与 EJS',
            text: '独立导入世界书，按全局、角色或聊天绑定。用触发规则与作者模板安排本轮剧情读到的设定。',
            href: 'capabilities.html#结构化世界书与-ejs'
        },
        {
            icon: 'palette',
            title: '社区预设与正则',
            text: '导入社区 JSON 预设，安排提示词、顺序、功能组、宏和正则。可为所有故事设默认值，也可为单个对话选方案。',
            href: 'capabilities.html#社区预设与正则'
        },
        {
            icon: 'export',
            title: 'Native 1.2 卡片创作',
            text: '在对话中创作或编辑一张卡，将人物、开场、世界书、规则和作者配置一起保存。可导出当前卡到新会话。',
            href: 'capabilities.html#原生创作世界线与侧边聊天'
        },
        {
            icon: 'agents',
            title: '侧边聊天',
            text: '在独立对话里讨论下一幕、查人物资料或明确保存设定，再回主剧情续写。',
            href: 'development-0.3.html#侧边聊天给灵感和修改留一个专门的位置'
        }
    ],
    showcase: {
        title: '0.3 酒馆实机',
        lead: '截图由维护者提供，包含个人主题与示例故事，不代表默认安装外观。',
        link: { label: '全部截图', href: 'screenshots.html' },
        cover: { src: 'screenshots/v03-author-interface.webp', alt: '酒馆内运行的作者互动界面与多媒体' },
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
            id: 'v03-topics',
            label: '0.3 作者文档',
            pages: [
                { id: 'development-0.3', title: '0.3 开发日志', nav: '0.3 开发进展', file: 'DEVELOPMENT-0.3.md' },
                { id: 'community-cards', title: '社区卡兼容与世界书', nav: '社区卡与世界书', file: 'COMMUNITY-CARDS.md' },
                { id: 'native-card-format', title: '原生卡创作与 EJS 模板', nav: '原生卡与 EJS', file: 'NATIVE-CARD-FORMAT.md' },
                { id: 'native-state', title: '原生状态系统、MVU 与 Ruby', nav: '原生状态与分析', file: 'NATIVE-STATE.md' },
                { id: 'community-presets', title: '社区预设与正则', nav: '社区预设与正则', file: 'COMMUNITY-PRESETS.md' }
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
                { id: 'feedback', title: '反馈、社区与许可', nav: '反馈与许可', file: 'README.md', sections: ['源码与验证范围', '社区支持', '反馈与许可'] },
            ]
        }
    ] as SiteGroup[],
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
                    { label: '0.3开发日志', href: 'development-0.3.html' },
                    { label: '参与开发', href: 'development.html' },
                    { label: '许可证 GPL-3.0-only', href: 'https://github.com/a86582751/dsh-nexttavern/blob/main/LICENSE' }
                ]
            }
        ]
    }
};

/** Public Markdown sources, relative to `release/public/`. */
export const sourceRoot = 'release/public';
