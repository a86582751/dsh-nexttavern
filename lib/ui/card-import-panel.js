// Generated from runtime/alpha3/src/ui/card-import-panel.ts; edit the TypeScript source.
import { createOpeningPanel } from './opening-panel.js';
import { createCardUploadPanel } from './card-upload-panel.js';
const labels = { interpreted: '已整理为角色资料',
    'preserved-unexecuted': '已保留，未执行', 'missing-external-resource': '缺少外部资源', 'requires-optional-analysis': '需要可选分析' };
const reasons = {
    'structured-projection': '已整理为角色资料', 'opening-candidate': '可选择的作者开场',
    'worldbook-projection': '已整理为世界书，尚不代表条目已触发', 'extension-runtime-not-wired': '扩展运行逻辑尚未接入',
    'extension-requires-review': '扩展形态需要进一步核对', 'opaque-archive': '原始声明已保留',
    'external-asset-not-bundled': '卡内未附带资源；外部地址尚未验证', 'optional-analysis-not-run': '可选分析尚未运行',
};
const names = { name: '名称', description: '人物资料', personality: '性格', scenario: '背景场景',
    first_mes: '默认开场', alternate_greetings: '备选开场', character_book: '世界书', mes_example: '对话范例',
    system_prompt: '系统规则', post_history_instructions: '补充规则', creator_notes: '作者说明', extensions: '扩展设置', assets: '媒体资源' };
function fieldName(pointer) {
    const parts = pointer.split('/').filter(Boolean);
    const field = parts[0] === 'data' ? parts[1] : parts[0];
    return field && names[field] || '角色卡字段';
}
/** One session owns the import/selection/report lifecycle; the library keeps its resource-browser state. */
export function createCardImportPanel(deps) {
    const { React, jsonFetch, toast } = deps;
    const Upload = createCardUploadPanel(deps);
    const Opening = createOpeningPanel({ React, jsonFetch, toast });
    return function CardImportPanel({ sessionId }) {
        const [refresh, setRefresh] = React.useState(0);
        const [report, setReport] = React.useState(null);
        const [error, setError] = React.useState('');
        const [loading, setLoading] = React.useState(false);
        const sequence = React.useRef(0);
        const load = React.useCallback(async () => {
            const ticket = ++sequence.current;
            setLoading(true);
            try {
                const reply = await jsonFetch(`/api/roleplay/state?sessionId=${encodeURIComponent(sessionId)}`);
                if (ticket !== sequence.current)
                    return;
                setReport(reply.cardImport?.capabilityReport ?? null);
                setError('');
            }
            catch {
                if (ticket !== sequence.current)
                    return;
                setReport(null);
                setError('暂时无法读取角色卡能力，请稍后刷新。');
            }
            finally {
                if (ticket === sequence.current)
                    setLoading(false);
            }
        }, [sessionId]);
        React.useEffect(() => {
            setReport(null);
            setError('');
            void load();
            return () => { sequence.current++; };
        }, [load, refresh]);
        const h = React.createElement;
        return h('div', { className: 'dsh-rp-panel dsh-rp-card-import' }, h('header', { className: 'dsh-rp-card-import-intro' }, h('span', { className: 'dsh-rp-card-import-mark', 'aria-hidden': true }, '卡'), h('div', null, h('h3', null, '让角色卡进入这段故事'), h('p', null, '在聊天中上传角色卡，再说“导入这张卡”；也可以在这里选择文件并确认导入。'))), h(Upload, { sessionId, onImported: () => setRefresh(value => value + 1) }), h('section', { className: 'dsh-rp-card-import-section', 'aria-label': '选择开场' }, h('div', { className: 'dsh-rp-card-import-heading' }, h('span', null, '选择开场'), h('small', null, '导入后，从作者提供的开场中选一个')), h(Opening, { sessionId, refreshToken: refresh })), h('section', { className: 'dsh-rp-card-import-section', 'aria-label': '角色卡能力' }, h('div', { className: 'dsh-rp-card-import-heading' }, h('span', null, '角色卡能力'), h('button', { className: 'dsh-rp-btn', type: 'button', disabled: loading, onClick: () => void load() }, loading ? '读取中…' : '刷新')), error ? h('p', { className: 'dsh-rp-error', role: 'alert' }, error) : null, report ? h(React.Fragment, null, h('p', { className: 'dsh-rp-muted' }, '资料整理、扩展执行和外部资源分别记录；导入成功并不代表所有扩展都能运行。'), h('div', { className: 'dsh-rp-card-capabilities' }, Object.keys(labels).map(status => h('div', { key: status, className: 'dsh-rp-card-capability', 'data-capability': status }, h('strong', null, report.counts[status] ?? 0), h('span', null, labels[status])))), h('details', { className: 'dsh-rp-card-capability-details' }, h('summary', null, '查看详细能力'), report.entries.map(entry => h('div', { className: 'dsh-rp-card-capability-row', key: entry.sourcePointer }, h('span', null, fieldName(entry.sourcePointer)), h('span', { className: 'dsh-rp-muted' }, `${labels[entry.status]} · ${reasons[entry.reason] ?? '该声明尚待核对'}`))), report.omitted > 0 ? h('p', { className: 'dsh-rp-muted' }, `还有 ${report.omitted} 项，共 ${report.total} 项。`) : null))
            : !error ? h('p', { className: 'dsh-rp-muted', role: 'status' }, loading ? '正在读取当前角色卡…' : '导入后，这里会显示角色卡的能力和未完成项。') : null));
    };
}
