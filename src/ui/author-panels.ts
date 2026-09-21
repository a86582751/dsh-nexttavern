import type * as ReactAPI from 'react';
import type { StateReply } from './state-store.js';
import {
    updatePanelDraft,
    markPanelDraftFields,
    settlePanelDraftFields,
    buildRulesSaveBody,
    buildCustomRulesSaveBody,
} from './panel-state.js';
import type { PanelDraft } from './panel-state.js';
const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? error.message : error;
interface RecordVersions extends Record<string, unknown> {
    cards?: Record<string, unknown>;
    worldbook?: Record<string, unknown>;
}
interface WorldbookEntry {
    id: string;
    name?: string;
    kind?: string;
    content?: string;
    keywords?: string[];
    priority?: number;
    tokenBudget?: number;
    alwaysOn?: boolean;
    locked?: boolean;
    enabled?: boolean;
}
interface CardEntry {
    id: string;
    name?: string;
    kind?: string;
    content?: string;
    locked?: boolean;
    version?: number;
}
interface WorldbookForm {
    id: string;
    name?: string;
    kind?: string;
    content?: string;
    keywords: string;
    priority: number | string;
    token_budget: number | string;
    always_on: boolean;
    locked: boolean;
}
interface CardForm {
    card_id: string;
    name?: string;
    kind?: string;
    content?: string;
    locked: boolean;
}
interface AuthorDraft extends PanelDraft {
    summary?: string | null;
    form?: WorldbookForm | CardForm;
    values?: Record<string, number | null>;
    statusText?: string | null;
    core?: string | null;
    plot?: string | null;
    narrative?: string | null;
    reply?: string | null;
    styleKw?: string | null;
    opening?: string | null;
    beautyCss?: string | null;
    beautyJs?: string | null;
    beautyRules?: string | null;
}
interface MemoryPolicy {
    defaults: Record<string, number>;
    global: {
        settings: Record<string, number | null>;
        revision: unknown;
    };
    session: {
        settings: Record<string, number | null>;
        revision: unknown;
    };
}
export interface AuthorState extends StateReply {
    recordVersions?: RecordVersions;
    directorNotes?: {
        text?: string;
    };
    memory?: {
        summary?: string;
        lockedFacts?: (string | {
            text: string;
        })[];
        deltas?: {
            evidenceSeq?: number;
            status?: string;
            summary?: string;
        }[];
    };
    worldbook?: WorldbookEntry[];
    cards?: CardEntry[];
    rules?: {
        core?: string;
        plot?: string;
        style?: string;
        narrative?: string;
        reply?: string;
        beauty?: {
            regexRules?: unknown[];
            css?: string;
            js?: string;
        };
    };
    statusSpec?: {
        text?: string;
    };
    opening?: {
        text?: string;
    };
}
interface PanelProps {
    scope?: {
        sessionId: string;
    };
    visible?: boolean;
    retrievalControls?: ReactAPI.ReactNode;
}
interface ShellProps {
    title: string;
    children?: ReactAPI.ReactNode;
    visible?: boolean;
    sessionId?: string;
    error?: unknown;
    loading?: boolean;
    refresh(): void;
    extra?: ReactAPI.ReactNode;
}
interface AuthorDependencies {
    React: typeof ReactAPI;
    sessionDrafts: Map<string, AuthorDraft>;
    fetchState(id: string, force?: boolean): Promise<AuthorState>;
    invalidateState(id: string | undefined): void;
    saveState(body: Record<string, unknown>): Promise<{
        recordVersions: RecordVersions;
    }>;
    runMaintenance(id: string | undefined, action: string): Promise<unknown>;
    jsonFetch<T>(url: string, init?: RequestInit): Promise<T>;
    toast(text: string): void;
}
export function createAuthorPanels({ React, sessionDrafts, fetchState, invalidateState, saveState, runMaintenance, jsonFetch, toast }: AuthorDependencies) {
    const btn = (
        label: ReactAPI.ReactNode,
        onClick: ReactAPI.MouseEventHandler<HTMLButtonElement>,
        extra: ReactAPI.ButtonHTMLAttributes<HTMLButtonElement> = {}
    ) => React.createElement('button', {
        type: 'button', className: 'dsh-rp-btn', onClick, ...extra
    }, label);
    const useRoleplayState = (sessionId: string | undefined, visible: boolean | undefined) => {
        const [data, setData] = React.useState<AuthorState | null>(null);
        const [error, setError] = React.useState<unknown>(null);
        const [loading, setLoading] = React.useState(false);
        const [rev, setRev] = React.useState(0);
        const loadedSession = React.useRef(sessionId);
        React.useEffect(() => {
            if (!visible || !sessionId)
                return;
            let alive = true;
            if (loadedSession.current !== sessionId) {
                loadedSession.current = sessionId;
                setData(null);
                setError(null);
            }
            setLoading(true);
            const load = () => {
                fetchState(sessionId, rev > 0).then((d) => {
                    if (!alive)
                        return;
                    if (d?.sessionId !== sessionId) {
                        setError('会话数据与当前选择不一致，请重新加载');
                        return;
                    }
                    setData(d);
                    setError(d && d.ok ? null : (d?.error ?? '会话不存在或非角色扮演会话'));
                }).catch((e) => {
                    if (alive)
                        setError(String(errorMessage(e)));
                }).finally(() => {
                    if (alive)
                        setLoading(false);
                });
            };
            load();
            const timer = setInterval(load, 10000);
            return () => {
                alive = false;
                clearInterval(timer);
            };
        }, [sessionId, visible, rev]);
        const refresh = () => {
            invalidateState(sessionId);
            setRev((r) => r + 1);
        };
        return {
            data: data?.sessionId === sessionId ? data : null, error, loading, refresh
        };
    };
    const PanelShell = ({ title, children, visible, sessionId, error, loading, refresh, extra }: ShellProps) => React.createElement('div', {
        className: 'dsh-rp-panel'
    }, React.createElement('div', {
        className: 'dsh-rp-row'
    }, React.createElement('h4', {
        style: {
            margin: 0, flex: 1
        }
    }, title), extra, btn('刷新', refresh)), loading ? React.createElement('div', {
        className: 'dsh-rp-muted', role: 'status'
    }, '加载设定中…') : null, error ? React.createElement('div', {
        className: 'dsh-rp-error', role: 'alert'
    }, `设定加载失败：${error}`, React.createElement('button', {
        type: 'button', className: 'dsh-rp-btn', onClick: refresh
    }, '重新加载')) : null, children);
    // ── 记忆面板 ──
    function MemorySettingsControls({ sessionId, visible, onSaved, retrievalControls }: {
        sessionId?: string;
        visible?: boolean;
        onSaved?(): void;
        retrievalControls?: ReactAPI.ReactNode;
    }) {
        const [scope, setScope] = React.useState<'session' | 'global'>('session'),
            [policyValue, setPolicy] = React.useState<MemoryPolicy | null>(null),
            [values, setValues] = React.useState<Record<string, number | null>>({}),
            [error, setError] = React.useState<string | null>(null),
            [saving, setSaving] = React.useState(false),
            [revision, setRevision] = React.useState(0);
        // Draft values remain local until save so a refresh cannot overwrite unsaved edits.
        const policy = policyValue!;
        const draftKey = `${sessionId}:memory-settings-${scope}`;
        React.useEffect(() => {
            if (!visible || !sessionId)
                return;
            let live = true;
            setPolicy(null);
            setError(null);
            jsonFetch<MemoryPolicy>('/api/roleplay/memory-settings?sessionId=' + encodeURIComponent(sessionId)).then(p => {
                if (!live)
                    return;
                setPolicy(p);
                setValues(sessionDrafts.get(draftKey)?.values ?? p[scope].settings);
            }).catch(e => {
                if (live)
                    setError(String(errorMessage(e)));
            });
            return () => {
                live = false;
            };
        }, [sessionId, scope, visible, revision]);
        const change = (field: string, value: string) => {
            const next = {
                ...values, [field]: value === '' ? null : Number(value)
            };
            setValues(next);
            sessionDrafts.set(draftKey, {
                values: next, expectedRevision: sessionDrafts.get(draftKey)?.expectedRevision ?? policy[scope].revision
            });
        };
        const fields: Array<[
            string,
            string,
            number
        ]> = [
            ['contextWindowTokens', '窗口大小', 1000],
            ['continuityTailTokens', '窗口尾部连续正文保留量', 1000],
            ['autoNotesEveryTurns', '后台笔记更新频率', 1]
        ];
        const legacy: Array<[
            string,
            string,
            number
        ]> = [['targetContextTokens', '超出模型上下文前的兼容整理阈值', 1], ['archiveTokens', '每次兼容归档量', 1]];
        const save = async (reset = false) => {
            if (!policy)
                return;
            const settings = Object.fromEntries(
                [...fields, ...legacy]
                    .filter(([f]) => reset || Object.prototype.hasOwnProperty.call(values, f))
                    .map(([f]) => [f, reset ? null : values[f]])
            );
            for (const [f, , min] of [...fields, ...legacy])
                if (settings[f] != null && (!Number.isSafeInteger(settings[f]) || settings[f] < min)) {
                    setError('请输入有效整数；留空表示继承');
                    return;
                }
            setSaving(true);
            setError(null);
            try {
                const p = await jsonFetch<MemoryPolicy>('/api/roleplay/memory-settings', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId,
                        scope,
                        settings,
                        expectedRevision: sessionDrafts.get(draftKey)?.expectedRevision ?? policy[scope].revision
                    })
                });
                sessionDrafts.delete(draftKey);
                setPolicy(p);
                setValues(p[scope].settings);
                onSaved?.();
                toast(scope === 'global' ? '全局记忆设置已保存' : '会话记忆设置已保存');
            }
            catch (e) {
                setError(String(errorMessage(e)));
                toast('记忆设置保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const input = ([field, label, min]: [
            string,
            string,
            number
        ]) => {
            const inherited = scope === 'global' ? policy.defaults[field] : (policy.global.settings[field] ?? policy.defaults[field]);
            return React.createElement('label', {
                key: field, className: 'dsh-rp-field', style: {
                    flex: '1 1 200px', minWidth: 0
                }
            }, label, React.createElement('input', {
                className: 'dsh-rp-input',
                type: 'number',
                min,
                step: 1,
                disabled: saving,
                value: values[field] ?? '',
                placeholder: `继承：${inherited}`,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => change(field, e.target.value)
            }), React.createElement('small', {
                className: 'dsh-rp-muted'
            }, field === 'autoNotesEveryTurns'
                ? `每 ${values[field] ?? inherited} 个正史剧情轮次；重新生成不计数`
                : `${values[field] ?? inherited} tokens${values[field] == null ? ' · 继承' : ''}`));
        };
        return React.createElement('section', {
            'data-roleplay-memory-settings': scope
        }, React.createElement('h4', null, '窗口与后台笔记'), React.createElement('div', {
            className: 'dsh-rp-row', role: 'group', 'aria-label': '记忆设置范围'
        }, (['session', 'global'] as const).map(s => React.createElement('button', {
            key: s,
            type: 'button',
            className: 'dsh-rp-btn' + (scope === s ? ' dsh-rp-primary' : ''),
            'aria-pressed': scope === s,
            disabled: saving,
            onClick: () => setScope(s)
        }, s === 'session' ? '本会话' : '全局默认'))), React.createElement('p', {
            className: 'dsh-rp-muted'
        }, scope === 'session' ? '留空的项目沿用全局设置；仅影响当前会话。' : '作为所有未单独覆盖会话的默认设置。留空恢复软件默认值。'), error ? React.createElement('div', {
            role: 'alert', className: 'dsh-rp-error'
        }, error, React.createElement('button', {
            className: 'dsh-rp-btn', onClick: () => setRevision(v => v + 1)
        }, '重新加载')) : null, policy ? React.createElement(React.Fragment, null, React.createElement('div', {
            className: 'dsh-rp-row', style: {
                alignItems: 'flex-start', flexWrap: 'wrap'
            }
        }, fields.map(input)), React.createElement('p', {
            className: 'dsh-rp-muted'
        }, '窗口即将淘汰旧正文时，会先确认检查点已保存；后台整理频率不取消这道保存关口。'), retrievalControls, React.createElement('details', null, React.createElement('summary', {
            style: {
                cursor: 'pointer', padding: '12px 0'
            }
        }, '高级兼容选项'), React.createElement('p', {
            className: 'dsh-rp-muted'
        }, '旧压缩模式的兼容保护参数，仅用于模型上下文压力兜底；不控制日常硬切窗口和后台笔记频率。'), React.createElement('div', {
            className: 'dsh-rp-row', style: {
                flexWrap: 'wrap'
            }
        }, legacy.map(input))), React.createElement('div', {
            className: 'dsh-rp-row'
        }, React.createElement('button', {
            className: 'dsh-rp-btn dsh-rp-primary', disabled: saving || !sessionDrafts.has(draftKey), onClick: () => save()
        }, saving ? '保存中…' : '保存记忆设置'), React.createElement('button', {
            className: 'dsh-rp-btn', disabled: saving, onClick: () => save(true)
        }, scope === 'session' ? '恢复全局设置' : '恢复默认值'))) : !error ? React.createElement('p', {
            className: 'dsh-rp-muted'
        }, '正在读取记忆设置…') : null);
    }
    function MemoryPanel(props: PanelProps) {
        const { scope, visible } = props;
        const sessionId = scope?.sessionId;
        const { data, error, refresh } = useRoleplayState(sessionId, visible);
        const [summary, setSummary] = React.useState<string | null | undefined>(null);
        const [saving, setSaving] = React.useState(false);
        const [organizing, setOrganizing] = React.useState(false);
        const [dirty, setDirty] = React.useState(false);
        const rememberMemory = (patch: PanelDraft) => {
            const prior = sessionDrafts.get(`${sessionId}:memory`);
            markPanelDraftFields(sessionDrafts, sessionId, 'memory', patch);
            if (!prior?.dirty)
                updatePanelDraft(sessionDrafts, sessionId, 'memory', {
                    baseVersions: data?.recordVersions
                });
            setDirty(true);
        };
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:memory`);
            if (draft?.dirty && Object.prototype.hasOwnProperty.call(draft, 'summary')) {
                setSummary(draft.summary);
                setDirty(true);
            }
            else {
                setSummary(null);
                setDirty(false);
            }
        }, [sessionId]);
        React.useEffect(() => {
            if (!data || data.sessionId !== sessionId)
                return;
            if (!dirty)
                setSummary(data.directorNotes?.text ?? data.memory?.summary ?? '');
        }, [data, dirty, sessionId]);
        const organize = async () => {
            setOrganizing(true);
            try {
                await runMaintenance(sessionId, 'notes');
                setDirty(false);
                refresh();
                toast('导演笔记已保存');
            }
            catch (error) {
                toast('记忆整理失败：' + String(errorMessage(error)));
            }
            finally {
                setOrganizing(false);
            }
        };
        const save = async () => {
            setSaving(true);
            try {
                const draft = sessionDrafts.get(`${sessionId}:memory`), expectedSeq = draft?.fieldSeqs?.summary;
                const updated = await saveState({
                    sessionId,
                    kind: 'memory',
                    summary,
                    directorNotes: true,
                    expectedRevision: draft?.baseVersions?.memory ?? data?.recordVersions?.memory ?? 'missing'
                });
                const remaining = settlePanelDraftFields(sessionDrafts, sessionId, 'memory', ['summary'], {
                    memory: updated.recordVersions.memory
                }, {
                    summary: expectedSeq
                });
                setDirty(Boolean(remaining?.dirty));
                toast('记忆已保存');
                refresh();
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const facts = data?.memory?.lockedFacts ?? [];
        const deltas = data?.memory?.deltas ?? [];
        return React.createElement(PanelShell, {
            title: '记忆',
            visible,
            sessionId,
            error,
            refresh,
            extra: btn(organizing ? '整理中…' : '立即整理', organize, {
                disabled: organizing
            }),
        }, React.createElement('textarea', {
            className: 'dsh-rp-textarea',
            rows: 14,
            style: {
                minHeight: '260px', height: 'clamp(260px, 45vh, 460px)', resize: 'vertical'
            },
            value: summary ?? '',
            onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => {
                setSummary(e.target.value);
                rememberMemory({
                    summary: e.target.value
                });
            },
            placeholder: '尚无导演笔记'
        }), React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '保存中…' : '保存总结', save)), React.createElement('h4', null, '锁定事实（压缩时永不被改写）'), facts.length
            ? facts.map((f, i) => React.createElement('div', {
                key: i, className: 'dsh-rp-item'
            }, typeof f === 'string' ? f : f.text))
            : React.createElement('div', {
                className: 'dsh-rp-muted'
            }, '（无；/memory lock <事实> 或角色卡锁定）'), React.createElement(MemorySettingsControls, {
            sessionId, visible, onSaved: refresh, retrievalControls: props.retrievalControls
        }), React.createElement('h4', null, '最近增量（' + deltas.length + ' 条）'), deltas.slice(-12).reverse().map((d, i) => React.createElement('div', {
            key: i, className: 'dsh-rp-item'
        }, React.createElement('div', {
            className: 'dsh-rp-muted'
        }, 'seq ' + d.evidenceSeq + ' · ' + (d.status ?? '')), d.summary)));
    }
    // ── 世界书面板 ──
    function WorldbookPanel(props: PanelProps) {
        const { scope, visible } = props;
        const sessionId = scope?.sessionId;
        const { data, error, refresh } = useRoleplayState(sessionId, visible);
        const [editing, setEditing] = React.useState<WorldbookEntry | WorldbookForm | 'new' | null>(null);
        const [formValue, setFormState] = React.useState<WorldbookForm | null>(null);
        // Editing and form are initialized together before these controls mount.
        const form = formValue!;
        const [saving, setSaving] = React.useState(false);
        const setForm = (next: WorldbookForm) => {
            setFormState(next);
            const prior = sessionDrafts.get(sessionId + ':worldbook');
            updatePanelDraft(sessionDrafts, sessionId, 'worldbook', {
                form: next,
                dirty: true,
                baseVersion: prior?.dirty ? prior.baseVersion : data?.recordVersions?.worldbook?.[next?.id] ?? 'missing'
            });
        };
        const rememberForm = setForm;
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:worldbook`);
            if (draft?.dirty && draft.form) {
                setFormState(draft.form as WorldbookForm);
                setEditing(draft.form as WorldbookForm);
            }
        }, [sessionId]);
        const entries = data?.worldbook ?? [];
        const startEdit = (entry: WorldbookEntry | 'new') => {
            rememberForm(entry === 'new'
                ? {
                    id: '',
                    name: '',
                    kind: 'place',
                    content: '',
                    keywords: '',
                    priority: 0,
                    token_budget: 400,
                    always_on: false,
                    locked: false
                }
                : {
                    id: entry.id,
                    name: entry.name,
                    kind: entry.kind,
                    content: entry.content,
                    keywords: (entry.keywords ?? []).join('、'),
                    priority: entry.priority ?? 0,
                    token_budget: entry.tokenBudget ?? 400,
                    always_on: entry.alwaysOn === true,
                    locked: entry.locked === true,
                });
            setEditing(entry);
        };
        const save = async () => {
            setSaving(true);
            const draftAtSubmit = sessionDrafts.get(sessionId + ':worldbook');
            try {
                await saveState({
                    sessionId,
                    kind: 'worldbook',
                    id: String(form.id).trim(),
                    name: form.name,
                    entry_kind: form.kind,
                    content: form.content,
                    keywords: String(form.keywords ?? '').split(/[、,\s]+/).filter(Boolean),
                    priority: Number(form.priority) || 0,
                    token_budget: Number(form.token_budget) || 400,
                    always_on: form.always_on === true,
                    locked: form.locked === true,
                    expectedRevision: draftAtSubmit?.baseVersion ?? data?.recordVersions?.worldbook?.[form.id] ?? 'missing',
                });
                toast('世界书条目已保存');
                if (sessionDrafts.get(sessionId + ':worldbook') === draftAtSubmit)
                    sessionDrafts.delete(sessionId + ':worldbook');
                setEditing(null);
                refresh();
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const remove = async (id: string) => {
            try {
                await saveState({
                    sessionId, kind: 'worldbook-delete', id
                });
                toast('已删除');
                refresh();
            }
            catch (e) {
                toast('删除失败：' + String(errorMessage(e)));
            }
        };
        const field = (label: string, value: string | number | undefined, onChange: (value: string) => void, type = 'text') => React.createElement('label', {
            className: 'dsh-rp-row'
        }, React.createElement('span', {
            className: 'dsh-rp-muted', style: {
                width: '64px'
            }
        }, label), React.createElement('input', {
            className: 'dsh-rp-input',
            type,
            value: value ?? '',
            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)
        }));
        return React.createElement(PanelShell, {
            title: '世界书',
            visible,
            sessionId,
            error,
            refresh,
            extra: btn('＋ 新增', () => startEdit('new'), {
                disabled: saving
            }),
        }, editing
            ? React.createElement('fieldset', {
                disabled: saving, style: {
                    border: 0, padding: 0, margin: 0
                }
            }, React.createElement('div', {
                className: 'dsh-rp-item'
            }, field('id', form.id, (v) => rememberForm({
                ...form, id: v
            })), field('名称', form.name, (v) => rememberForm({
                ...form, name: v
            })), field('类型', form.kind, (v) => rememberForm({
                ...form, kind: v
            })), field('关键词', form.keywords, (v) => rememberForm({
                ...form, keywords: v
            })), React.createElement('textarea', {
                className: 'dsh-rp-textarea',
                value: form.content ?? '',
                onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => rememberForm({
                    ...form, content: e.target.value
                }),
                placeholder: '条目内容（触发时以隐藏上下文注入）'
            }), React.createElement('div', {
                className: 'dsh-rp-row'
            }, field('优先级', form.priority, (v) => rememberForm({
                ...form, priority: v
            }), 'number'), field('token预算', form.token_budget, (v) => rememberForm({
                ...form, token_budget: v
            }), 'number'), React.createElement('label', null, React.createElement('input', {
                type: 'checkbox',
                checked: form.always_on === true,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => rememberForm({
                    ...form, always_on: e.target.checked
                })
            }), '旧卡常驻兼容（建议整理到核心设定）'), React.createElement('span', {
                className: 'dsh-rp-muted'
            }, '新背景资料放核心设定；普通世界书按查询读取。'), React.createElement('label', null, React.createElement('input', {
                type: 'checkbox',
                checked: form.locked === true,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => rememberForm({
                    ...form, locked: e.target.checked
                })
            }), '锁定')), React.createElement('div', {
                className: 'dsh-rp-row'
            }, btn(saving ? '保存中…' : '保存', save), btn('取消', () => {
                sessionDrafts.delete(sessionId + ':worldbook');
                setEditing(null);
            }))))
            : entries.length
                ? entries.map((e) => React.createElement('div', {
                    key: e.id, className: 'dsh-rp-item'
                }, React.createElement('div', {
                    className: 'dsh-rp-item-head'
                }, React.createElement('span', {
                    className: 'dsh-rp-item-title'
                }, e.name + (e.locked ? ' 🔒' : '')), React.createElement('span', {
                    className: 'dsh-rp-muted'
                }, e.kind + ' · 优先级' + e.priority + (e.alwaysOn ? ' · 常驻' : ''))), React.createElement('div', {
                    className: 'dsh-rp-muted', style: {
                        margin: '2px 0'
                    }
                }, String(e.content ?? '').slice(0, 120)), React.createElement('div', {
                    className: 'dsh-rp-row'
                }, btn('编辑', () => startEdit(e)), btn('删除', () => remove(e.id)))))
                : React.createElement('div', {
                    className: 'dsh-rp-muted'
                }, '（暂无条目；点击「＋ 新增」或让 AI 用 rp_worldbook_add 写入）'));
    }
    // ── 角色卡面板 ──
    function CardsPanel(props: PanelProps) {
        const { scope, visible } = props;
        const sessionId = scope?.sessionId;
        const { data, error, refresh } = useRoleplayState(sessionId, visible);
        const [editing, setEditing] = React.useState<CardEntry | CardForm | 'new' | null>(null);
        const [formValue, setFormState] = React.useState<CardForm | null>(null);
        // Editing and form are initialized together before these controls mount.
        const form = formValue!;
        const [saving, setSaving] = React.useState(false);
        const setForm = (next: CardForm) => {
            setFormState(next);
            const prior = sessionDrafts.get(sessionId + ':cards');
            updatePanelDraft(sessionDrafts, sessionId, 'cards', {
                form: next,
                dirty: true,
                baseVersion: prior?.dirty ? prior.baseVersion : data?.recordVersions?.cards?.[next?.card_id] ?? 'missing'
            });
        };
        const rememberForm = setForm;
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:cards`);
            if (draft?.dirty && draft.form) {
                setFormState(draft.form as CardForm);
                setEditing(draft.form as CardForm);
            }
        }, [sessionId]);
        const cards = data?.cards ?? [];
        const startEdit = (card: CardEntry | 'new') => {
            rememberForm(card === 'new'
                ? {
                    card_id: '', name: '', kind: 'npc', content: '', locked: false
                }
                : {
                    card_id: card.id, name: card.name, kind: card.kind, content: card.content, locked: card.locked === true
                });
            setEditing(card);
        };
        const save = async () => {
            setSaving(true);
            const draftAtSubmit = sessionDrafts.get(sessionId + ':cards');
            try {
                await saveState({
                    sessionId,
                    kind: 'card',
                    card_id: String(form.card_id).trim(),
                    name: form.name,
                    card_kind: form.kind,
                    content: form.content,
                    locked: form.locked === true,
                    expectedRevision: draftAtSubmit?.baseVersion ?? data?.recordVersions?.cards?.[form.card_id] ?? 'missing',
                });
                toast('人物设定已保存');
                if (sessionDrafts.get(sessionId + ':cards') === draftAtSubmit)
                    sessionDrafts.delete(sessionId + ':cards');
                setEditing(null);
                refresh();
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const field = (label: string, value: string | undefined, onChange: (value: string) => void) => React.createElement('label', {
            className: 'dsh-rp-row'
        }, React.createElement('span', {
            className: 'dsh-rp-muted', style: {
                width: '64px'
            }
        }, label), React.createElement('input', {
            className: 'dsh-rp-input',
            value: value ?? '',
            onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)
        }));
        return React.createElement(PanelShell, {
            title: '人物设定',
            visible,
            sessionId,
            error,
            refresh,
            extra: btn('＋ 新增人物', () => startEdit('new'), {
                disabled: saving
            }),
        }, editing
            ? React.createElement('fieldset', {
                disabled: saving, style: {
                    border: 0, padding: 0, margin: 0
                }
            }, React.createElement('div', {
                className: 'dsh-rp-item'
            }, field('card_id', form.card_id, (v) => rememberForm({
                ...form, card_id: v
            })), field('名称', form.name, (v) => rememberForm({
                ...form, name: v
            })), React.createElement('label', {
                className: 'dsh-rp-row'
            }, React.createElement('span', {
                className: 'dsh-rp-muted', style: {
                    width: '64px'
                }
            }, '类型'), React.createElement('select', {
                className: 'dsh-rp-input',
                value: form.kind,
                onChange: (e: ReactAPI.ChangeEvent<HTMLSelectElement>) => rememberForm({
                    ...form, kind: e.target.value
                })
            }, React.createElement('option', {
                value: 'user'
            }, 'user（玩家角色）'), React.createElement('option', {
                value: 'npc'
            }, 'npc'), React.createElement('option', {
                value: 'other'
            }, 'other'))), React.createElement('textarea', {
                className: 'dsh-rp-textarea',
                value: form.content ?? '',
                onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => rememberForm({
                    ...form, content: e.target.value
                }),
                placeholder: '人设正文（性格/口吻/动机/秘密/外貌/能力/价值底线）'
            }), React.createElement('label', null, React.createElement('input', {
                type: 'checkbox',
                checked: form.locked === true,
                onChange: (e: ReactAPI.ChangeEvent<HTMLInputElement>) => rememberForm({
                    ...form, locked: e.target.checked
                })
            }), ' 锁定事实（压缩时永不被改写）'), React.createElement('div', {
                className: 'dsh-rp-row'
            }, btn(saving ? '保存中…' : '保存', save), btn('取消', () => {
                sessionDrafts.delete(sessionId + ':cards');
                setEditing(null);
            }))))
            : cards.length
                ? cards.map((c) => React.createElement('div', {
                    key: c.id, className: 'dsh-rp-item'
                }, React.createElement('div', {
                    className: 'dsh-rp-item-head'
                }, React.createElement('span', {
                    className: 'dsh-rp-item-title'
                }, c.name + (c.locked ? ' 🔒' : '')), React.createElement('span', {
                    className: 'dsh-rp-muted'
                }, c.kind + ' · v' + c.version)), React.createElement('div', {
                    className: 'dsh-rp-muted', style: {
                        margin: '2px 0'
                    }
                }, String(c.content ?? '').slice(0, 120)), React.createElement('div', {
                    className: 'dsh-rp-row'
                }, btn('编辑', () => startEdit(c)))))
                : React.createElement('div', {
                    className: 'dsh-rp-muted'
                }, '（暂无人物设定；点击「＋ 新增人物」或让 AI 用 rp_card_set 写入）'));
    }
    // ── 规则切片面板：与世界书并列的一级入口，共用设定草稿/CAS ──
    function RuleSlicePanel({ scope, visible, field, title, guidance, rows }: PanelProps & {
        field: 'core' | 'plot' | 'styleKw';
        title: string;
        guidance: string;
        rows: number;
    }) {
        const sessionId = scope?.sessionId;
        const { data, error, loading, refresh } = useRoleplayState(sessionId, visible);
        const [value, setValue] = React.useState<string | null>(null);
        const [saving, setSaving] = React.useState(false);
        const remember = (next: string) => {
            const prior = sessionDrafts.get(`${sessionId}:settings`);
            markPanelDraftFields(sessionDrafts, sessionId, 'settings', {
                [field]: next
            });
            if (!prior?.dirty)
                updatePanelDraft(sessionDrafts, sessionId, 'settings', {
                    baseVersions: data?.recordVersions
                });
        };
        React.useEffect(() => {
            setValue(null);
            setSaving(false);
        }, [sessionId, field]);
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:settings`);
            if (draft?.dirty && draft[field] !== undefined)
                setValue(draft[field]);
        }, [sessionId, field]);
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:settings`);
            if (data && value === null)
                setValue(draft?.[field] ?? data.rules?.[field === 'styleKw' ? 'style' : field] ?? '');
        }, [data, value, sessionId, field]);
        const save = async () => {
            if (saving)
                return;
            const draft = sessionDrafts.get(`${sessionId}:settings`);
            const rules = data?.rules ?? {};
            const body = buildRulesSaveBody(field, value, rules);
            setSaving(true);
            try {
                const updated = await saveState({
                    sessionId,
                    ...body,
                    expectedRevision: draft?.baseVersions?.rules ?? data?.recordVersions?.rules ?? 'missing'
                });
                settlePanelDraftFields(sessionDrafts, sessionId, 'settings', [field], {
                    rules: updated.recordVersions.rules
                }, {
                    [field]: draft?.fieldSeqs?.[field]
                });
                toast(`${title}已保存`);
                refresh();
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const legacyEntries = field === 'core' ? data?.worldbook?.filter(entry => entry.enabled !== false && entry.alwaysOn === true) ?? [] : [];
        return React.createElement(PanelShell, {
            title, visible, sessionId, error, loading, refresh
        }, React.createElement('p', null, guidance), React.createElement('textarea', {
            className: 'dsh-rp-textarea',
            style: {
                minHeight: `${rows * 20}px`
            },
            value: value ?? '',
            disabled: loading || !data,
            onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => {
                setValue(e.target.value);
                remember(e.target.value);
            }
        }),
             legacyEntries.length ? React.createElement('details',
             null,
             React.createElement('summary',
             null,
             `核心设定·旧卡常驻标记兼容投影（${legacyEntries.length}）`),
             React.createElement('p',
             {
            className: 'dsh-rp-muted'
        }, '原件未改写、可在世界书管理旧记录。以下为只读全文；不会自动迁移、删除或修改数据。'), legacyEntries.map(entry => React.createElement('div', {
            key: entry.id, className: 'dsh-rp-item'
        }, React.createElement('div', {
            className: 'dsh-rp-item-title'
        }, entry.name || entry.id || '未命名条目'), React.createElement('pre', {
            style: {
                whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0 0'
            }
        }, String(entry.content ?? ''))))) : null, React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(`保存${title}`, save, {
            disabled: saving || loading || !data
        })));
    }
    function CoreRulesPanel(props: PanelProps) {
        return React.createElement(RuleSlicePanel, {
            ...props, field: 'core', title: '核心设定', rows: 10, guidance: '世界基础、核心威胁、长期矛盾；这些内容常驻且不参与剧情压缩。'
        });
    }
    function PlotGuidancePanel(props: PanelProps) {
        return React.createElement(RuleSlicePanel, {
            ...props, field: 'plot', title: '剧情指引', rows: 10, guidance: '路线/条件/可能结局是未发生的作者指引，不是当前剧情事实。'
        });
    }
    function StyleSpecializationPanel(props: PanelProps) {
        return React.createElement(RuleSlicePanel, {
            ...props, field: 'styleKw', title: '文风特化', rows: 10, guidance: '完整保留风格要求和写作示例，示例不视作当前剧情。'
        });
    }
    // ── 自定义规则面板（状态栏 / 叙事规则 / 回复规则 / 初始剧情）──
    function SettingsPanel(props: PanelProps) {
        const { scope, visible } = props;
        const sessionId = scope?.sessionId;
        const { data, error, refresh } = useRoleplayState(sessionId, visible);
        const [statusText, setStatusText] = React.useState<string | null>(null);
        const [core, setCore] = React.useState<string | null>(null);
        const [plot, setPlot] = React.useState<string | null>(null);
        const [narrative, setNarrative] = React.useState<string | null>(null);
        const [reply, setReply] = React.useState<string | null>(null);
        const [styleKw, setStyleKw] = React.useState<string | null>(null);
        const [opening, setOpening] = React.useState<string | null>(null);
        const [beautyCss, setBeautyCss] = React.useState<string | null>(null);
        const [beautyJs, setBeautyJs] = React.useState<string | null>(null);
        const [beautyRules, setBeautyRules] = React.useState<string | null>(null);
        const [saving, setSaving] = React.useState(false);
        const rememberSettings = (patch: PanelDraft) => {
            const prior = sessionDrafts.get(`${sessionId}:settings`);
            const next = markPanelDraftFields(sessionDrafts, sessionId, 'settings', patch);
            if (!prior?.dirty)
                updatePanelDraft(sessionDrafts, sessionId, 'settings', {
                    baseVersions: data?.recordVersions
                });
            return next;
        };
        React.useEffect(() => {
            const draft = sessionDrafts.get(`${sessionId}:settings`);
            if (!draft?.dirty)
                return;
            for (const [key, setter] of [
                ['statusText', setStatusText],
                ['core', setCore],
                ['plot', setPlot],
                ['narrative', setNarrative],
                ['reply', setReply],
                ['styleKw', setStyleKw],
                ['opening', setOpening],
                ['beautyCss', setBeautyCss],
                ['beautyJs', setBeautyJs],
                ['beautyRules', setBeautyRules]
            ] as const)
                if (draft[key] !== undefined)
                    setter(draft[key]);
        }, [sessionId]);
        React.useEffect(() => {
            if (!data)
                return;
            if (!sessionDrafts.get(`${sessionId}:settings`)?.dirty) {
                setStatusText(data.statusSpec?.text ?? '');
                setCore(data.rules?.core ?? '');
                setPlot(data.rules?.plot ?? '');
                setNarrative(data.rules?.narrative ?? '');
                setReply(data.rules?.reply ?? '');
                setStyleKw(data.rules?.style ?? '');
                setOpening(data.opening?.text ?? '');
                setBeautyCss(data.rules?.beauty?.css ?? '');
                setBeautyJs(data.rules?.beauty?.js ?? '');
            }
            if (statusText === null)
                setStatusText(data.statusSpec?.text ?? '');
            if (core === null)
                setCore(data.rules?.core ?? '');
            if (plot === null)
                setPlot(data.rules?.plot ?? '');
            if (narrative === null)
                setNarrative(data.rules?.narrative ?? '');
            if (reply === null)
                setReply(data.rules?.reply ?? '');
            if (styleKw === null)
                setStyleKw(data.rules?.style ?? '');
            if (opening === null)
                setOpening(data.opening?.text ?? '');
            if (beautyCss === null)
                setBeautyCss(data.rules?.beauty?.css ?? '');
            if (beautyJs === null)
                setBeautyJs(data.rules?.beauty?.js ?? '');
            if (beautyRules === null) {
                const rr = Array.isArray(data.rules?.beauty?.regexRules) ? data.rules.beauty.regexRules : [];
                setBeautyRules(rr.length ? JSON.stringify(rr,
                     null,
                     2) : '[\n  { "match": "【心理】([\\\\s\\\\S]+?)【/心理】", "replace": "<span class=\\"rp-thought\\">$1</span>" }\n]');
            }
        }, [data]);
        const save = async (body: {
            kind: string;
            expectedRevision?: unknown;
        } & Record<string, unknown>, msg: string) => {
            setSaving(true);
            try {
                const draft = sessionDrafts.get(`${sessionId}:settings`);
                const fields = body.kind === 'status' ? ['statusText'] : body.kind === 'opening' ? ['opening'] : body.beauty ? ['beautyRules',
                     'beautyCss',
                     'beautyJs'] : [
                    ...(body.core !== undefined ? ['core'] : []),
                    ...(body.plot !== undefined ? ['plot'] : []),
                    ...(body.narrative !== undefined ? ['narrative'] : []),
                    ...(body.reply !== undefined ? ['reply'] : []),
                    ...(body.style !== undefined ? ['styleKw'] : [])
                ];
                const expectedSeqs = Object.fromEntries(fields.map(field => [field, draft?.fieldSeqs?.[field]]));
                const updated = await saveState({
                    sessionId, ...body, expectedRevision: draft?.baseVersions?.[body.kind] ?? body.expectedRevision ?? 'missing'
                });
                settlePanelDraftFields(sessionDrafts, sessionId, 'settings', fields, {
                    [body.kind]: updated.recordVersions[body.kind]
                }, expectedSeqs);
                toast(msg);
                refresh();
            }
            catch (e) {
                toast('保存失败：' + String(errorMessage(e)));
            }
            finally {
                setSaving(false);
            }
        };
        const ta = (value: string | null, onChange: (value: string) => void, rows = 6) => React.createElement('textarea', {
            className: 'dsh-rp-textarea',
            style: {
                minHeight: rows * 20 + 'px'
            },
            value: value ?? '',
            onChange: (e: ReactAPI.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)
        });
        return React.createElement(PanelShell, {
            title: '自定义规则', visible, sessionId, error, refresh
        }, React.createElement('h4', null, '状态栏设定（正文后生成状态栏的格式）'), ta(statusText, value => {
            setStatusText(value);
            rememberSettings({
                statusText: value
            });
        }, 8), React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '…' : '保存状态栏', () => save({
            kind: 'status', text: statusText, expectedRevision: data?.recordVersions?.status ?? null
        }, '状态栏已保存'))), React.createElement('h4', null, '叙事规则'), ta(narrative, value => {
            setNarrative(value);
            rememberSettings({
                narrative: value
            });
        }, 5), React.createElement('h4', null, '回复规则'), ta(reply, value => {
            setReply(value);
            rememberSettings({
                reply: value
            });
        }, 5), React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '…' : '保存规则', () => save({
            ...buildCustomRulesSaveBody(narrative, reply), expectedRevision: data?.recordVersions?.rules ?? null
        }, '规则已保存'), {
            disabled: saving
        })), React.createElement('h4', null, '初始剧情（仅故事开始时注入一次）'), ta(opening, value => {
            setOpening(value);
            rememberSettings({
                opening: value
            });
        }, 8), React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '…' : '保存开场', () => save({
            kind: 'opening', text: opening, expectedRevision: data?.recordVersions?.opening ?? null
        },
             '开场已保存'))),
             React.createElement('h4',
             null,
             '排版美化 · 正则规则（阅读视图正文特效；JSON 数组 [{match, replace}]）'),
             React.createElement('p',
             null,
             '先匹配原文；未命中时匹配 Markdown 渲染后的 HTML。中文双引号规则也兼容正文中的成对直引号，不改写剧情记录。'),
             ta(beautyRules,
             value => {
            setBeautyRules(value);
            rememberSettings({
                beautyRules: value
            });
        }, 8), React.createElement('h4', null, '排版美化 · CSS（选择器自动加 .rp-reader-view 作用域；可覆盖默认奶油纸感主题）'), ta(beautyCss, value => {
            setBeautyCss(value);
            rememberSettings({
                beautyCss: value
            });
        }, 10), React.createElement('h4', null, '排版美化 · JS（渲染后执行；沙箱参数 root=阅读容器, fill=填入输入框）'), ta(beautyJs, value => {
            setBeautyJs(value);
            rememberSettings({
                beautyJs: value
            });
        }, 6), React.createElement('div', {
            className: 'dsh-rp-row'
        }, btn(saving ? '…' : '保存排版美化', () => {
            let rr;
            try {
                rr = JSON.parse(beautyRules ?? '[]');
            }
            catch {
                toast('正则规则不是合法 JSON');
                return;
            }
            if (!Array.isArray(rr)) {
                toast('正则规则必须是数组');
                return;
            }
            save({
                kind: 'rules',
                beauty: {
                    regexRules: rr, css: beautyCss ?? '', js: beautyJs ?? ''
                },
                expectedRevision: data?.recordVersions?.rules ?? null
            }, '排版美化已保存');
        })));
    }
    return {
        btn,
        PanelShell,
        MemoryPanel,
        WorldbookPanel,
        CardsPanel,
        CoreRulesPanel,
        PlotGuidancePanel,
        StyleSpecializationPanel,
        SettingsPanel
    };
}
