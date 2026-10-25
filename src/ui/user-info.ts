import type * as ReactAPI from 'react'

export interface UserInfo extends Record<string, unknown> {
  name?: string
  gender?: string
}

export interface UserInfoReply extends Record<string, unknown> {
  ok?: unknown
  error?: unknown
  userinfo?: UserInfo | null
}

export interface UserInfoSettingsDependencies {
  React: typeof ReactAPI
  toast: (message: string) => unknown
}

interface SkinReply {
  ok: boolean
  error?: string
  skin?: { available: boolean; enabled: boolean | null; phase?: string | null; reason?: string }
  result?: {
    application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'
    error?: { code: string; diagnostic?: string }
  }
}

const skinOperationMessage = (data: SkinReply): string => {
  switch (data.result?.application) {
    case 'applied': return '皮肤设置已应用；如页面外观尚未更新，请刷新页面。'
    case 'restart-required': return '设置已保存，需要重启当前 profile 后生效。'
    case 'overridden': return '设置已保存，但被更高优先级配置覆盖，当前皮肤状态未按本次选择改变。'
    case 'cancelled': return '皮肤切换已取消。'
    case 'failed': return '皮肤切换失败：' + (data.result.error?.diagnostic ?? data.result.error?.code ?? '宿主未应用设置')
    default: return data.error ?? data.skin?.reason ?? '无法读取皮肤状态'
  }
}

export function createUserInfoSettings({ React, toast }: UserInfoSettingsDependencies) {
  function SkinSettings(): ReactAPI.ReactElement {
    const [skin, setSkin] = React.useState<SkinReply['skin']>()
    const [busy, setBusy] = React.useState(true)
    const [message, setMessage] = React.useState('')
    React.useEffect(() => {
      let alive = true
      fetch('/api/roleplay/skin').then(response => response.json()).then((data: SkinReply) => {
        if (!alive) return
        setSkin(data.skin)
        if (!data.ok) setMessage(skinOperationMessage(data))
      }).catch(error => { if (alive) setMessage('皮肤状态读取失败：' + String(error)) })
        .finally(() => { if (alive) setBusy(false) })
      return () => { alive = false }
    }, [])
    const change = async (enabled?: boolean) => {
      setBusy(true)
      setMessage('')
      try {
        const response = await fetch('/api/roleplay/skin', enabled === undefined ? {} : {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }),
        })
        const data: SkinReply = await response.json()
        setSkin(data.skin)
        if (enabled !== undefined || !data.ok) setMessage(skinOperationMessage(data))
      } catch (error) { setMessage('皮肤操作失败，请刷新状态确认：' + String(error)) }
      finally { setBusy(false) }
    }
    return React.createElement('section', { 'aria-label': '内置皮肤', 'aria-busy': busy, style: { marginTop: 24 } },
      React.createElement('h4', null, '界面 · 内置皮肤'),
      React.createElement('p', { className: 'dsh-rp-muted' }, 'NextTavern 琥珀酒馆'),
      React.createElement('div', { className: 'dsh-rp-row', style: { flexWrap: 'wrap' } },
        React.createElement('button', {
          type: 'button', className: 'dsh-rp-btn', role: 'switch',
          'aria-checked': skin?.enabled === true, 'aria-label': 'NextTavern 琥珀酒馆皮肤',
          disabled: busy || !skin?.available, onClick: () => change(!skin?.enabled),
        }, busy ? '读取／应用中…' : skin?.enabled ? '关闭内置皮肤' : '开启内置皮肤'),
        React.createElement('button', {
          type: 'button', className: 'dsh-rp-btn', disabled: busy, onClick: () => change(),
        }, '刷新状态'),
        React.createElement('span', { className: 'dsh-rp-muted' },
          skin?.enabled === true ? '当前配置：开启' : skin?.enabled === false ? '当前配置：关闭' : '状态未知'),
      ),
      skin?.reason ? React.createElement('p', { className: 'dsh-rp-muted' }, skin.reason) : null,
      skin?.phase === 'failed' ? React.createElement('p', {
        role: 'alert', className: 'dsh-rp-muted',
      }, '宿主报告皮肤加载失败，请查看插件管理中的错误。') : null,
      React.createElement('p', { className: 'dsh-rp-muted', role: 'status', 'aria-live': 'polite' }, message),
    )
  }

  function UserInfoSettings(): ReactAPI.ReactElement | null {
    const [name, setName] = React.useState<string | null>(null)
    const [gender, setGender] = React.useState<string | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [loaded, setLoaded] = React.useState(false)
    React.useEffect(() => {
      let alive = true
      fetch('/api/roleplay/userinfo')
        .then(response => response.json())
        .then((data: UserInfoReply | null) => {
          if (!alive) return
          if (name === null) setName(data?.userinfo?.name ?? '')
          if (gender === null) setGender(data?.userinfo?.gender ?? '')
          setLoaded(true)
        })
        .catch(() => { if (alive) setLoaded(true) })
      return () => { alive = false }
    }, [])
    const save = async () => {
      setSaving(true)
      try {
        const res = await fetch('/api/roleplay/userinfo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, gender }),
        })
        const data: UserInfoReply = await res.json()
        if (!data.ok) throw new Error(String(data.error ?? '保存失败'))
        toast('用户信息已保存（{{user}} 将使用此姓名）')
      } catch (error) { toast('保存失败：' + String(error && typeof error === 'object' && 'message' in error ? error.message ?? error : error)) }
      finally { setSaving(false) }
    }
    const field = (label: string, value: string | null, onChange: (next: string) => void, placeholder: string) =>
      React.createElement('label', { className: 'dsh-rp-row', style: { marginBottom: '8px' } },
        React.createElement('span', { className: 'dsh-rp-muted', style: { width: '72px' } }, label),
        React.createElement('input', { className: 'dsh-rp-input', value: value ?? '', placeholder, disabled: saving, onChange: (event: ReactAPI.ChangeEvent<HTMLInputElement>) => onChange(event.target.value) })
      )
    return React.createElement('div', { style: { maxWidth: 420 } },
      loaded ? React.createElement('div', null,
        React.createElement('h4', null, '角色扮演 · 用户信息'),
        field('名字', name, setName, '剧情中如何称呼你（{{user}}）'),
        field('性别', gender, setGender, '如：男 / 女 / 保密'),
        React.createElement('div', { className: 'dsh-rp-row' },
          React.createElement('button', { type: 'button', className: 'dsh-rp-btn', onClick: save, disabled: saving }, saving ? '保存中…' : '保存'),
          React.createElement('span', { className: 'dsh-rp-muted' }, '作为 {{user}} / {{user_gender}} 提示词变量提供给模型')
        ),
      ) : React.createElement('div', { className: 'dsh-rp-muted' }, '加载中…'),
      React.createElement(SkinSettings),
    )
  }

  return UserInfoSettings
}
