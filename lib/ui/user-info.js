// Generated from runtime/alpha3/src/ui/user-info.ts; edit the TypeScript source.
export function createUserInfoSettings({ React, toast }) {
    function UserInfoSettings() {
        const [name, setName] = React.useState(null);
        const [gender, setGender] = React.useState(null);
        const [saving, setSaving] = React.useState(false);
        const [loaded, setLoaded] = React.useState(false);
        React.useEffect(() => {
            let alive = true;
            fetch('/api/roleplay/userinfo')
                .then(response => response.json())
                .then((data) => {
                if (!alive)
                    return;
                if (name === null)
                    setName(data?.userinfo?.name ?? '');
                if (gender === null)
                    setGender(data?.userinfo?.gender ?? '');
                setLoaded(true);
            })
                .catch(() => { if (alive)
                setLoaded(true); });
            return () => { alive = false; };
        }, []);
        const save = async () => {
            setSaving(true);
            try {
                const res = await fetch('/api/roleplay/userinfo', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ name, gender }),
                });
                const data = await res.json();
                if (!data.ok)
                    throw new Error(String(data.error ?? '保存失败'));
                toast('用户信息已保存（{{user}} 将使用此姓名）');
            }
            catch (error) {
                toast('保存失败：' + String(error && typeof error === 'object' && 'message' in error ? error.message ?? error : error));
            }
            finally {
                setSaving(false);
            }
        };
        const field = (label, value, onChange, placeholder) => React.createElement('label', { className: 'dsh-rp-row', style: { marginBottom: '8px' } }, React.createElement('span', { className: 'dsh-rp-muted', style: { width: '72px' } }, label), React.createElement('input', { className: 'dsh-rp-input', value: value ?? '', placeholder, disabled: saving, onChange: (event) => onChange(event.target.value) }));
        if (!loaded)
            return React.createElement('div', { className: 'dsh-rp-muted' }, '加载中…');
        return React.createElement('div', { style: { maxWidth: 420 } }, React.createElement('h4', null, '角色扮演 · 用户信息'), field('名字', name, setName, '剧情中如何称呼你（{{user}}）'), field('性别', gender, setGender, '如：男 / 女 / 保密'), React.createElement('div', { className: 'dsh-rp-row' }, React.createElement('button', { type: 'button', className: 'dsh-rp-btn', onClick: save, disabled: saving }, saving ? '保存中…' : '保存'), React.createElement('span', { className: 'dsh-rp-muted' }, '作为 {{user}} / {{user_gender}} 提示词变量提供给模型')));
    }
    return UserInfoSettings;
}
