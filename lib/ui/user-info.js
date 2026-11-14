// Generated from runtime/alpha3/src/ui/user-info.ts; edit the TypeScript source.
const PENDING_KEY = 'nexttavern:native-persona-pending:v1';
/** One account edit retains its identity across lost HTTP ACK and reload.
 * Recovery only queries the durable receipt; it never replays a mutation. */
export function createNativePersonaPendingStore(storage) {
    return {
        read() {
            const bytes = storage.getItem(PENDING_KEY);
            if (!bytes)
                return null;
            const parsed = JSON.parse(bytes);
            if (parsed.schemaVersion !== 1)
                throw new Error('不支持的账号角色待确认记录');
            return parsed;
        },
        begin(operation) {
            if (this.read())
                throw new Error('请先查询上次账号角色操作的结果');
            const pending = { schemaVersion: 1, operationId: operation.operationId };
            storage.setItem(PENDING_KEY, JSON.stringify(pending));
            return pending;
        },
        clear(operationId) {
            if (this.read()?.operationId === operationId)
                storage.removeItem(PENDING_KEY);
        },
    };
}
const skinOperationMessage = (data) => {
    switch (data.result?.application) {
        case 'applied': return '皮肤设置已应用；如页面外观尚未更新，请刷新页面。';
        case 'restart-required': return '设置已保存，需要重启当前 profile 后生效。';
        case 'overridden': return '设置已保存，但被更高优先级配置覆盖，当前皮肤状态未按本次选择改变。';
        case 'cancelled': return '皮肤切换已取消。';
        case 'failed': return '皮肤切换失败：' + (data.result.error?.diagnostic ?? data.result.error?.code ?? '宿主未应用设置');
        default: return data.error ?? data.skin?.reason ?? '无法读取皮肤状态';
    }
};
export function createUserInfoSettings({ React, toast, storage, fetch: transport = globalThis.fetch }) {
    function SkinSettings() {
        const [skin, setSkin] = React.useState();
        const [busy, setBusy] = React.useState(true);
        const [message, setMessage] = React.useState('');
        React.useEffect(() => {
            let alive = true;
            transport('/api/roleplay/skin').then(response => response.json()).then((data) => {
                if (!alive)
                    return;
                setSkin(data.skin);
                if (!data.ok)
                    setMessage(skinOperationMessage(data));
            }).catch(error => { if (alive)
                setMessage('皮肤状态读取失败：' + String(error)); })
                .finally(() => { if (alive)
                setBusy(false); });
            return () => { alive = false; };
        }, []);
        const change = async (enabled) => {
            setBusy(true);
            setMessage('');
            try {
                const response = await transport('/api/roleplay/skin', enabled === undefined ? {} : {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }),
                });
                const data = await response.json();
                setSkin(data.skin);
                if (enabled !== undefined || !data.ok)
                    setMessage(skinOperationMessage(data));
            }
            catch (error) {
                setMessage('皮肤操作失败，请刷新状态确认：' + String(error));
            }
            finally {
                setBusy(false);
            }
        };
        return React.createElement('section', { 'aria-label': '内置皮肤', 'aria-busy': busy, style: { marginTop: 24 } }, React.createElement('h4', null, '界面 · 内置皮肤'), React.createElement('p', { className: 'dsh-rp-muted' }, 'NextTavern 琥珀酒馆'), React.createElement('div', { className: 'dsh-rp-row', style: { flexWrap: 'wrap' } }, React.createElement('button', {
            type: 'button', className: 'dsh-rp-btn', role: 'switch',
            'aria-checked': skin?.enabled === true, 'aria-label': 'NextTavern 琥珀酒馆皮肤',
            disabled: busy || !skin?.available, onClick: () => change(!skin?.enabled),
        }, busy ? '读取／应用中…' : skin?.enabled ? '关闭内置皮肤' : '开启内置皮肤'), React.createElement('button', {
            type: 'button', className: 'dsh-rp-btn', disabled: busy, onClick: () => change(),
        }, '刷新状态'), React.createElement('span', { className: 'dsh-rp-muted' }, skin?.enabled === true ? '当前配置：开启' : skin?.enabled === false ? '当前配置：关闭' : '状态未知')), skin?.reason ? React.createElement('p', { className: 'dsh-rp-muted' }, skin.reason) : null, skin?.phase === 'failed' ? React.createElement('p', {
            role: 'alert', className: 'dsh-rp-muted',
        }, '宿主报告皮肤加载失败，请查看插件管理中的错误。') : null, React.createElement('p', { className: 'dsh-rp-muted', role: 'status', 'aria-live': 'polite' }, message));
    }
    function UserInfoSettings() {
        const store = React.useMemo(() => createNativePersonaPendingStore(storage ?? globalThis.localStorage), []);
        const [data, setData] = React.useState(null);
        const [name, setName] = React.useState('');
        const [gender, setGender] = React.useState('');
        const [createName, setCreateName] = React.useState('');
        const [selectedId, setSelectedId] = React.useState('');
        const [pending, setPending] = React.useState(() => store.read());
        const [saving, setSaving] = React.useState(false);
        const [loadError, setLoadError] = React.useState('');
        const [draftDirty, setDraftDirty] = React.useState(false);
        const [notice, setNotice] = React.useState('');
        const accept = (next, preserveDraft = false) => {
            setData(next);
            setSelectedId(next.selectedId ?? '');
            if (preserveDraft && draftDirty)
                return;
            const selected = next.profiles.find(profile => profile.avatar_id === next.selectedId);
            setName(selected?.name ?? '');
            setGender(selected?.gender ?? '');
            setDraftDirty(false);
        };
        React.useEffect(() => {
            let alive = true;
            transport('/api/roleplay/personas').then(response => response.json()).then((reply) => {
                if (!alive)
                    return;
                if (!reply.ok || !reply.data)
                    throw new Error(String(reply.error ?? '加载失败'));
                accept(reply.data);
            }).catch(error => { if (alive)
                setLoadError(String(error)); });
            return () => { alive = false; };
        }, []);
        const refresh = async () => {
            setSaving(true);
            try {
                const reply = await (await transport('/api/roleplay/personas')).json();
                if (!reply.ok || !reply.data)
                    throw new Error(String(reply.error ?? '加载失败'));
                accept(reply.data, true);
                setLoadError('');
                const message = draftDirty ? '角色列表已刷新，未保存的姓名和性别已保留，请核对当前角色后保存。' : '角色列表已刷新。';
                setNotice(message);
                toast(message);
            }
            catch (error) {
                setLoadError('刷新失败：' + String(error));
            }
            finally {
                setSaving(false);
            }
        };
        const request = async (body, operationId) => {
            setSaving(true);
            try {
                const response = await transport('/api/roleplay/personas', { method: 'POST',
                    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
                const reply = await response.json();
                if (!reply.result)
                    throw new Error(String(reply.error ?? '未收到提交回执'));
                if (reply.result.kind === 'refused') {
                    const message = reply.result.code === 'NATIVE_PERSONA_DATA_CHANGED'
                        ? '账号角色已在其他窗口或会话中修改。请点击“刷新角色列表”，核对当前角色后再次保存；未保存的输入会保留。'
                        : '账号角色操作未完成：' + reply.result.code;
                    setNotice(message);
                    toast(message);
                    // A manual receipt query with no durable operation leaves the user
                    // the choice to discard the old request and start a fresh edit.
                    if (reply.result.code === 'NATIVE_PERSONA_OPERATION_NOT_RECORDED')
                        return;
                }
                else {
                    accept(reply.result.data);
                    setNotice('');
                    toast(reply.result.receipt.result === false ? '角色名称或 ID 已存在，未创建' : '账号角色已保存');
                }
                store.clear(operationId);
                setPending(store.read());
            }
            catch (error) {
                toast('结果尚未确认，请手动查询回执：' + String(error));
            }
            finally {
                setSaving(false);
            }
        };
        const mutate = async (mutation) => {
            if (!data)
                return;
            try {
                const operation = { schemaVersion: 1, encoding: 'native-account-persona-operation-v1',
                    operationId: globalThis.crypto.randomUUID(), expectedDataSha256: data.dataSha256,
                    origin: { kind: 'host-ui' }, mutation };
                const record = store.begin(operation);
                setPending(record);
                await request(operation, operation.operationId);
            }
            catch (error) {
                toast(String(error));
            }
        };
        const disabled = saving || pending !== null;
        const button = (text, action, extraDisabled = false) => React.createElement('button', {
            type: 'button', className: 'dsh-rp-btn', disabled: disabled || extraDisabled, onClick: action,
        }, text);
        const field = (label, value, change, placeholder) => React.createElement('label', { className: 'dsh-rp-row', style: { marginBottom: 8 } }, React.createElement('span', { className: 'dsh-rp-muted', style: { width: 72 } }, label), React.createElement('input', { className: 'dsh-rp-input', value, placeholder, disabled,
            onChange: (event) => change(event.target.value) }));
        return React.createElement('div', { style: { maxWidth: 520 } }, React.createElement('h4', null, '角色扮演 · 账号角色'), React.createElement('p', { className: 'dsh-rp-muted' }, '所有会话共用当前账号角色。手动切换后，其他会话从下一次输入起使用新的 {{user}} 和 {{user_gender}}。'), React.createElement('button', { type: 'button', className: 'dsh-rp-btn', disabled: saving,
            onClick: refresh }, '刷新角色列表'), notice ? React.createElement('p', { className: 'dsh-rp-muted', role: 'status' }, notice) : null, pending ? React.createElement('div', { className: 'dsh-rp-row', role: 'status' }, React.createElement('span', null, '上次操作结果待确认，刷新页面不会自动重试。'), React.createElement('button', { type: 'button', className: 'dsh-rp-btn', disabled: saving,
            onClick: () => request({ action: 'retry', operationId: pending.operationId }, pending.operationId) }, '查询提交回执'), React.createElement('button', { type: 'button', className: 'dsh-rp-btn', disabled: saving,
            onClick: () => { store.clear(pending.operationId); setPending(null); } }, '结束待确认操作')) : null, loadError ? React.createElement('div', { role: 'alert' }, loadError) : null, data ? React.createElement(React.Fragment, null, React.createElement('ul', { style: { listStyle: 'none', padding: 0 } }, ...data.profiles.map(profile => React.createElement('li', { key: profile.avatar_id, className: 'dsh-rp-row', style: { marginBottom: 8 } }, data.avatarIds.includes(profile.avatar_id) ? React.createElement('img', {
            src: '/api/roleplay/persona-avatar?id=' + encodeURIComponent(profile.avatar_id), alt: profile.name + '的头像',
            width: 40, height: 40, style: { borderRadius: 8 },
        }) : null, React.createElement('span', null, profile.name), profile.avatar_id === data.selectedId ? React.createElement('span', { className: 'dsh-rp-muted' }, '当前') : null, profile.is_default ? React.createElement('span', { className: 'dsh-rp-muted' }, '默认') : null))), React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('select', { 'aria-label': '选择账号角色', className: 'dsh-rp-input', value: selectedId, disabled,
            onChange: (event) => setSelectedId(event.target.value) }, React.createElement('option', { value: '' }, '尚未选择角色'), ...data.profiles.map(profile => React.createElement('option', { key: profile.avatar_id, value: profile.avatar_id }, profile.name))), button('使用所选角色', () => mutate({ kind: 'select', id: selectedId }), !selectedId || selectedId === data.selectedId)), field('当前姓名', name, value => { setName(value); setDraftDirty(true); }, '剧情如何称呼你'), field('当前性别', gender, value => { setGender(value); setDraftDirty(true); }, '如：男 / 女 / 保密'), button('保存当前角色', () => mutate({ kind: 'update-current', values: { name, gender } })), field('新角色', createName, setCreateName, '输入新角色姓名'), button('创建角色', () => mutate({ kind: 'create', name: createName, persona: {} }), !createName), React.createElement('p', { className: 'dsh-rp-muted' }, '创建角色后，请手动选择要使用的角色。')) :
            React.createElement('div', { className: 'dsh-rp-muted' }, loadError ? '账号角色未加载' : '加载中…'), React.createElement(SkinSettings));
    }
    return UserInfoSettings;
}
