// Generated from runtime/alpha3/src/ui/character-cluster-panel.ts; edit the TypeScript source.
import { updatePanelDraft } from './panel-state.js';
const privateEndpoint = '/api/roleplay/character-private';
/** Transport for the service-owned private view and mutation boundary. */
export function createCharacterPanelAPI(jsonFetch) {
    const post = (sessionId, action, fields) => jsonFetch(privateEndpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, action, ...fields }),
    });
    const query = (sessionId) => `${privateEndpoint}?sessionId=${encodeURIComponent(sessionId)}`;
    return {
        list: sessionId => jsonFetch(query(sessionId)),
        detail: (sessionId, characterId, offset) => jsonFetch(`${query(sessionId)}&characterId=${encodeURIComponent(characterId)}&offset=${offset}`),
        correct: draft => post(draft.target.branchId, 'correct', draft),
        setActive: (target, recordId, active) => post(target.branchId, 'set-active', { target: identityOf(target), recordId, active }),
        setEnabled: (sessionId, enabled) => post(sessionId, 'set-enabled', { enabled }),
        retryPerception: sessionId => post(sessionId, 'retry-perception', {}),
    };
}
export function createCharacterOffscreenRunsPanel({ React, jsonFetch }) {
    const h = React.createElement;
    return function OffscreenRunsPanel({ sessionId, selectCharacter }) {
        const [offset, setOffset] = React.useState(0), [refresh, setRefresh] = React.useState(0);
        const [snapshot, setSnapshot] = React.useState(null);
        const [error, setError] = React.useState('');
        React.useEffect(() => { setOffset(0); }, [sessionId]);
        React.useEffect(() => {
            let alive = true;
            setError('');
            void jsonFetch(`${privateEndpoint}?sessionId=${encodeURIComponent(sessionId)}&section=offscreen&offset=${offset}`)
                .then(data => { if (alive)
                setSnapshot({ sessionId, offset, data }); })
                .catch(reason => { if (alive)
                setError(String(reason)); });
            return () => { alive = false; };
        }, [sessionId, offset, refresh]);
        const data = snapshot?.sessionId === sessionId && snapshot.offset === offset ? snapshot.data : null;
        return h('section', { 'aria-label': '场外运行记录' }, h('h4', null, '场外运行记录'), h('p', null, '结果只发布到本人的私有记忆；查看和刷新不启动或重放任务。'), error && h('p', { role: 'alert' }, error), h('button', { type: 'button', onClick: () => setRefresh(value => value + 1) }, '刷新场外记录'), !data ? h('p', null, '加载场外记录…') : h(React.Fragment, null, !data.runs.length && h('p', null, '尚无场外运行记录。'), ...data.runs.map(run => h('section', { key: run.id }, h('h5', null, `${run.name} · ${run.status}`), run.reason && h('p', null, run.reason), run.publicationId && h('p', null, '已保存私有发布记录'), h('button', { type: 'button', onClick: () => selectCharacter(run.characterId) }, '查看本人记忆'))), offset > 0 && h('button', { type: 'button', onClick: () => setOffset(Math.max(0, offset - 20)) }, '上一页场外记录'), data.nextOffset !== null && h('button', { type: 'button', onClick: () => setOffset(data.nextOffset) }, '下一页场外记录')));
    };
}
const categoryLabels = {
    experience: '亲历', hearsay: '听闻', belief: '信念／误解', emotion: '情绪', relationship: '关系', goal: '持续目标', state: '私有状态',
};
const statusLabels = {
    active: '有效', disabled: '已停用', replaced: '已修订', 'source-changed': '来源已改写', pending: '待发布',
};
const sameVersion = (left, right) => left.branchId === right.branchId && left.characterId === right.characterId && left.revision === right.revision
    && left.boundaryId === right.boundaryId && left.materialId === right.materialId;
const identityOf = ({ branchId, characterId, revision, boundaryId, materialId }) => ({ branchId, characterId, revision, boundaryId, materialId });
const changed = (draft) => draft.text !== draft.baseline.text || draft.category !== draft.baseline.category || draft.certainty !== draft.baseline.certainty;
/** The client supplies real private service and shared settings consumers. */
export function createCharacterClusterPanel({ React, sessionDrafts, api, renderOffscreenSettings, renderOffscreenRuns, renderModels }) {
    const h = React.createElement;
    return function CharacterClusterPanel({ sessionId }) {
        const [tab, setTab] = React.useState(0), [query, setQuery] = React.useState('');
        const [characters, setCharacters] = React.useState([]);
        const [loadedBranch, setLoadedBranch] = React.useState('');
        const [enabled, setEnabled] = React.useState(false), [selected, setSelected] = React.useState('');
        const [perception, setPerception] = React.useState();
        const [loadedDetail, setDetail] = React.useState(null);
        const [offset, setOffset] = React.useState(0), [error, setError] = React.useState('');
        const [busy, setBusy] = React.useState(false), [refresh, setRefresh] = React.useState(0);
        const [detailUnavailable, setDetailUnavailable] = React.useState(false);
        const [, redraw] = React.useReducer(value => value + 1, 0);
        const draftText = React.useRef(null);
        const currentBranch = React.useRef(sessionId);
        currentBranch.current = sessionId;
        const currentTarget = React.useRef({ sessionId, selected });
        currentTarget.current = { sessionId, selected };
        const detail = loadedDetail?.view.branchId === sessionId && loadedDetail.view.characterId === selected ? loadedDetail : null;
        const visibleCharacters = loadedBranch === sessionId ? characters : [];
        const missing = !!selected && loadedBranch === sessionId && !visibleCharacters.some(character => character.id === selected);
        const tabs = ['人物与记忆', '场外推理', '模型设置'];
        const prefix = `cluster-${React.useId()}`;
        const editorKey = `${sessionId}:character-editor-${selected}`;
        const editorObject = String(sessionDrafts.get(editorKey)?.activeObject ?? 'new');
        const draftTab = `character-memory-${selected}:${editorObject}`;
        const draftKey = `${sessionId}:${draftTab}`;
        const draft = sessionDrafts.get(draftKey);
        React.useEffect(() => {
            setSelected('');
            setDetail(null);
            setError('');
            setOffset(0);
            setDetailUnavailable(false);
            setBusy(false);
        }, [sessionId]);
        React.useEffect(() => {
            let alive = true;
            void api.list(sessionId).then(data => {
                if (alive) {
                    setCharacters(data.characters);
                    setEnabled(data.enabled);
                    setPerception(data.perception);
                    setLoadedBranch(sessionId);
                }
            }).catch(reason => { if (alive)
                setError(String(reason)); });
            return () => { alive = false; };
        }, [sessionId, refresh]);
        React.useEffect(() => {
            if (!selected)
                return;
            let alive = true;
            void api.detail(sessionId, selected, offset).then(value => {
                if (alive) {
                    setDetail(value);
                    setDetailUnavailable(false);
                    setError('');
                }
            }).catch(reason => { if (alive) {
                setError(String(reason));
                setDetailUnavailable(true);
            } });
            return () => { alive = false; };
        }, [sessionId, selected, offset, refresh]);
        const select = (id) => { setSelected(id); setDetail(null); setOffset(0); setTab(0); };
        const change = (patch) => {
            if (!draft && !detail)
                return;
            const initial = { text: '', category: 'belief', certainty: 'unconfirmed' };
            const next = { ...(draft ?? { ...initial, target: identityOf(detail.view), baseline: initial }), ...patch };
            updatePanelDraft(sessionDrafts, sessionId, draftTab, { ...next, dirty: changed(next) });
            redraw();
        };
        const edit = (record) => {
            if (!detail)
                return;
            const object = record?.id ?? 'new';
            sessionDrafts.set(editorKey, { activeObject: object });
            const key = `${sessionId}:character-memory-${selected}:${object}`;
            const initial = { text: record?.text ?? '', category: record?.category ?? 'belief', certainty: record?.certainty ?? 'unconfirmed' };
            if (!sessionDrafts.has(key))
                updatePanelDraft(sessionDrafts, sessionId, `character-memory-${selected}:${object}`, { target: identityOf(detail.view), recordId: record?.id, ...initial, baseline: initial, dirty: false });
            redraw();
        };
        const act = async (work) => {
            const branch = sessionId;
            setBusy(true);
            try {
                await work();
                if (currentBranch.current === branch) {
                    setRefresh(value => value + 1);
                    setError('');
                }
            }
            catch (reason) {
                if (currentBranch.current === branch)
                    setError(String(reason));
            }
            finally {
                if (currentBranch.current === branch)
                    setBusy(false);
            }
        };
        const save = () => {
            if (!draft)
                return;
            const captured = draft;
            return act(async () => {
                const receipt = await api.correct({ target: captured.target, recordId: captured.recordId, text: captured.text,
                    category: captured.category, certainty: captured.certainty });
                const latest = sessionDrafts.get(draftKey);
                if (latest === captured)
                    sessionDrafts.delete(draftKey);
                else if (latest && sameVersion(latest.target, captured.target) && latest.recordId === captured.recordId) {
                    // Only a successful correction identifies its newly appended object.
                    // Preserve typing after dispatch while advancing to that exact receipt.
                    const nextKey = `${sessionId}:character-memory-${selected}:${receipt.recordId}`;
                    if (sessionDrafts.has(nextKey))
                        throw Error('新记录已有草稿；本次续写已保留，可复制后继续。');
                    const next = { ...latest, target: identityOf(receipt.view), recordId: receipt.recordId,
                        baseline: { text: captured.text, category: captured.category, certainty: captured.certainty } };
                    sessionDrafts.set(nextKey, { ...next, dirty: changed(next) });
                    sessionDrafts.delete(draftKey);
                    if (sessionDrafts.get(editorKey)?.activeObject === editorObject)
                        sessionDrafts.set(editorKey, { activeObject: receipt.recordId });
                }
                if (currentTarget.current.sessionId === sessionId && currentTarget.current.selected === selected)
                    setOffset(receipt.historyOffset);
                if (currentBranch.current === sessionId)
                    redraw();
            });
        };
        const conflict = !!draft && !!detail && !sameVersion(draft.target, detail.view);
        const targetRow = draft?.recordId ? detail?.history.find(row => row.record.id === draft.recordId) : undefined;
        const invalidTarget = !!draft?.recordId && !!detail && (!targetRow || !['active', 'disabled'].includes(targetRow.status));
        const keyDown = (event, index) => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
                : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'ArrowRight' ? (index + 1) % 3 : null;
            if (next === null)
                return;
            event.preventDefault();
            setTab(next);
            event.currentTarget.parentElement?.querySelectorAll('[role=tab]')[next]?.focus();
        };
        const button = (text, click, disabled = false) => h('button', { type: 'button', onClick: click, disabled }, text);
        return h('section', { className: 'rp-character-panel' }, h('header', null, h('h3', null, '角色集群'), h('p', null, `当前世界线：${sessionId}`), h('label', null, h('input', { type: 'checkbox', checked: loadedBranch === sessionId && enabled, disabled: busy || loadedBranch !== sessionId,
            onChange: (event) => {
                const next = event.target.checked;
                void act(async () => { await api.setEnabled(sessionId, next); if (currentBranch.current === sessionId)
                    setEnabled(next); });
            } }), '运行角色集群'), h('p', null, '玩家管理视角。查看和修订不会让其他角色知情。关闭运行仍可编辑资料。'), h('p', null, '首次开启为静态人物发起共享初始化；动态人物等待首轮已发表材料。随后每条新接受正文进行一次共享感知。开启场外推理后，每批另有 0..K 次角色请求，按实际模型计费。')), error && h('p', { role: 'alert' }, error), loadedBranch === sessionId && perception?.retryable && h('section', { 'aria-label': '共享感知恢复' }, perception.reason && h('p', { role: 'alert' }, perception.reason), button('重新请求共享感知（按模型计费）', () => act(() => api.retryPerception(sessionId)), busy || !enabled)), h('div', { role: 'tablist', 'aria-label': '角色集群分类' }, ...tabs.map((label, index) => h('button', {
            key: label, id: `${prefix}-tab-${index}`, role: 'tab', type: 'button', 'aria-selected': tab === index,
            'aria-controls': `${prefix}-panel-${index}`, tabIndex: tab === index ? 0 : -1,
            onClick: () => setTab(index), onKeyDown: (event) => keyDown(event, index),
        }, label))), h('div', { id: `${prefix}-panel-${tab}`, role: 'tabpanel', 'aria-labelledby': `${prefix}-tab-${tab}` }, tab === 1 ? h(React.Fragment, null, renderOffscreenSettings(sessionId), renderOffscreenRuns(sessionId, select))
            : tab === 2 ? h(React.Fragment, null, h('h4', null, '全局默认模型'), renderModels(sessionId, 'global'), h('h4', null, '当前对话人物覆盖'), renderModels(sessionId, 'session'))
                : h('div', { className: `rp-character-columns${selected ? ' has-selection' : ''}` }, h('aside', { 'aria-label': '人物名单' }, h('input', { type: 'search', value: query, placeholder: '搜索人物',
                    'aria-label': '搜索人物', onChange: (event) => setQuery(event.target.value) }), ...visibleCharacters.filter(character => character.name.includes(query)).map(character => h('div', { key: character.id }, button(`${character.name} · ${character.state}`, () => select(character.id)))), !visibleCharacters.length && h('p', null, '尚无可管理的人物。')), h('article', null, selected && button('返回名单', () => setSelected('')), !selected ? h('p', null, '选择人物，按需加载资料与记忆。') : !detail ? h('p', null, '资料加载中；未保存内容仍在草稿中。')
                    : h(React.Fragment, null, h('h4', null, characters.find(character => character.id === selected)?.name ?? selected), h('h5', null, '当前私有人格（只读）'), h('p', null, detail.view.persona), detail.authorEditorUrl && h('a', { href: detail.authorEditorUrl }, '打开设定编辑器'), !detail.view.ready && h('p', null, '缺少已确认的私有人格或知情材料，角色建议暂不可用。'), button('刷新', () => setRefresh(value => value + 1)), button('补充记忆／状态', () => edit(), busy), ...detail.history.map(({ record, status }) => h('section', { key: record.id }, h('h5', null, `${categoryLabels[record.category]} · ${statusLabels[status] ?? status}`), h('p', null, record.text), h('small', null, `${record.kind === 'user-correction' ? '玩家修订' : record.kind === 'offscreen-generated' ? '场外推理' : '本人感知'}${record.evidenceSeq === undefined ? '' : ` · 剧情来源 ${record.evidenceSeq}`} · ${record.certainty === 'confirmed' ? '已确认' : record.certainty === 'intention' ? '意向' : '未证实'}`), button('修订', () => edit(record), busy || !['active', 'disabled'].includes(status)), button(status === 'disabled' ? '恢复' : '停用', () => act(() => api.setActive(detail.view, record.id, status === 'disabled')), busy || missing || detailUnavailable || !['active', 'disabled'].includes(status)))), !detail.history.length && h('p', null, '尚无角色私有记忆；打开页面不会自动回填历史。'), offset > 0 && button('上一页', () => setOffset(Math.max(0, offset - 20))), detail.nextOffset !== null && button('下一页', () => setOffset(detail.nextOffset)))), draft && h('section', { 'aria-label': '未保存修订' }, h('h4', null, '未保存修订'), h('select', { value: draft.category, disabled: missing || invalidTarget, 'aria-label': '记录类别',
                    onChange: (event) => change({ category: event.target.value }) }, ...Object.entries(categoryLabels).map(([value, label]) => h('option', { key: value, value }, label))), h('select', { value: draft.certainty, disabled: missing || invalidTarget, 'aria-label': '确认状态',
                    onChange: (event) => change({ certainty: event.target.value }) }, h('option', { value: 'confirmed' }, '已确认'), h('option', { value: 'unconfirmed' }, '未证实'), h('option', { value: 'intention' }, '意向')), missing && h('p', null, '人物暂不可用。草稿保留为只读，可复制或放弃，不会改绑其他人物。'), invalidTarget && h('p', null, '原修订对象已失效、被替换或不在当前页；草稿只读保留。可返回原页核对，或复制文字后取消修订。'), h('textarea', { ref: draftText, value: draft.text, readOnly: missing || invalidTarget, 'aria-label': '记忆或状态修订',
                    onChange: (event) => change({ text: event.target.value }) }), conflict && h('div', { role: 'alert' }, h('p', null, '资料已更新。草稿已保留；请核对当前内容后继续。'), h('p', null, detail?.history.find(row => row.record.id === draft.recordId)?.record.text ?? '当前对象不存在或位于其他页。'), button('已核对，使用当前版本', () => detail && change({ target: identityOf(detail.view) }), busy || invalidTarget)), invalidTarget && button('选择修订文字以复制', () => { draftText.current?.focus(); draftText.current?.select(); }), detailUnavailable && h('p', null, '暂时无法确认人物资料。草稿保留，可选中复制；恢复读取后再保存。'), button('保存', () => save(), busy || missing || conflict || invalidTarget || detailUnavailable || !draft.dirty || !draft.text.trim() || !detail), button('取消修订', () => { sessionDrafts.delete(draftKey); redraw(); }, busy)))));
    };
}
