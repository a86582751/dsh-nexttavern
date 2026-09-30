import type * as ReactAPI from 'react'
import type {OpeningRejectionCode,OpeningInitializationCode} from '../core/roleplay-opening-selection.js'

interface OpeningCandidate {
  index: number
  label: string
  text: string
  sourcePointer: string
  sourceSha256: string
  renderedSha256: string
  macros: {name:string;status:string}[]
}
interface OpeningReply {
  available: boolean
  legacyDisplayed: boolean
  priorOpening: boolean
  candidates: OpeningCandidate[]
  source?:OpeningSourceView
  selection: {status:string;index:number;operationId:string;committedTurn?:number;
    schemaVersion?:number;mode?:'plain'|'native-json'|'unsupported';textRetained?:boolean;
    initializationCode?:OpeningInitializationCode;rejectionCode?:OpeningRejectionCode} | null
}
export interface OpeningSourceView {importId:string;rawSha256:string;transactionId:string}
interface OpeningPanelProps {
  sessionId:string
  refreshToken:number
  presentation?:'panel' | 'card'
  expectedSource?:OpeningSourceView
  onCompleted?():void
  onDismiss?():void
}
interface OpeningPanelDependencies {
  React: typeof ReactAPI
  jsonFetch<T>(url:string,init?:RequestInit):Promise<T>
  toast(text:string):void
}

const rejectionMessage = (code: OpeningRejectionCode | undefined): string | null => {
  if (code === 'PROGRAMMATIC_IDENTITY_CONFLICT')
    return '上次提交被拒绝：这次开场的操作标识与会话中的消息不一致。重复选择无法解决，请先核对状态。'
  if (code === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD')
    return '上次提交被拒绝：当前会话的旧消息结构不支持追加开场。重复选择无法解决，请先核对状态。'
  if (code === 'PROGRAMMATIC_OPEN_TURN')
    return '上次提交被拒绝：会话当时还有未结束的回合。请等待回合结束并核对状态，再重试同一次选择。'
  if (code === 'PROGRAMMATIC_UNATTRIBUTED_FAILURE')
    return '已有失败回合无法确定归属，不能确认这次开场是否已尝试。重复选择无法解决，当前不支持自动恢复，需人工处理。'
  if (code === 'PROGRAMMATIC_INCOMPLETE_TURN')
    return '这次开场已开始，但未完成消息提交。重复选择无法解决，当前不支持自动恢复，需人工处理。'
  return null
}
const selectionMessage = (selection: NonNullable<OpeningReply['selection']>): string => {
  if (selection.initializationCode === 'SOURCE_CHANGED') return '这次导入的设定已变化，请先核对原开场和状态。'
  if (selection.mode === 'unsupported' || selection.textRetained === false) {
    return '这张卡的初始化方式暂不支持，开场尚未写入。请先核对设定。'
  }
  if (selection.status === 'completed') {
    return selection.mode === 'native-json' || selection.schemaVersion === 3
      ? '开场与初始状态已确认。' : `已写入第 ${selection.committedTurn} 回合`
  }
  if (selection.status === 'native-committed' || selection.status === 'blocked' && selection.committedTurn !== undefined) {
    return selection.mode === 'plain' ? '开场已提交，原消息回执仍待确认；请核对同一次操作。'
      : '开场已写入，初始状态尚未就绪；请核对同一次操作。'
  }
  return rejectionMessage(selection.rejectionCode) ?? '开场提交待确认；使用同一次操作核对，不会重复生成。'
}

export function createOpeningPanel({React,jsonFetch,toast}:OpeningPanelDependencies) {
  return function OpeningPanel({sessionId,refreshToken,presentation='panel',expectedSource,onCompleted,onDismiss}:OpeningPanelProps) {
    const [data,setData] = React.useState<OpeningReply | null>(null)
    const [index,setIndex] = React.useState(0)
    const [busy,setBusy] = React.useState(false)
    const [error,setError] = React.useState('')
    const ticket = React.useRef(0)
    const inFlight = React.useRef(false)
    const load = React.useCallback(async (visibleError = false) => {
      const current = ++ticket.current
      try {
        const reply = await jsonFetch<OpeningReply>(`/api/roleplay/openings?sessionId=${encodeURIComponent(sessionId)}`)
        if (current !== ticket.current) return
        if (expectedSource && (!reply.source || reply.source.importId !== expectedSource.importId
          || reply.source.rawSha256 !== expectedSource.rawSha256 || reply.source.transactionId !== expectedSource.transactionId)) {
          setData(null);setError('角色卡已变化，请重新查看当前开场。');return
        }
        setData(reply)
        setIndex(reply.selection?.index ?? 0)
        setError('')
      } catch (cause) {
        if (current !== ticket.current) return
        setData(null)
        if (visibleError) setError(String((cause as Error).message ?? cause))
      }
    },[sessionId,expectedSource?.importId,expectedSource?.rawSha256,expectedSource?.transactionId])
    React.useEffect(() => {
      setData(null)
      setError('')
      void load()
      return () => {ticket.current++}
    },[load,refreshToken])
    if (!data) return error ? React.createElement('p',{className:'dsh-rp-error',role:'alert'},error) : null
    if (presentation === 'card' && data.selection?.status === 'completed') return null
    const selected = data.candidates.find(candidate => candidate.index === index)
    const fixed = data.selection
    const blockedRetry = fixed?.status === 'blocked' || fixed?.status === 'native-committed' || fixed?.status === 'unknown' &&
      (fixed.rejectionCode === 'PROGRAMMATIC_IDENTITY_CONFLICT'
        || fixed.rejectionCode === 'PROGRAMMATIC_MISSING_SYSTEM_HEAD'
        || fixed.rejectionCode === 'PROGRAMMATIC_UNATTRIBUTED_FAILURE'
        || fixed.rejectionCode === 'PROGRAMMATIC_INCOMPLETE_TURN')
    const choose = async () => {
      if (!selected || inFlight.current || blockedRetry || fixed && fixed.index !== selected.index) return
      inFlight.current = true
      const mutationTicket = ticket.current
      setBusy(true)
      try {
        const operationId = fixed?.operationId ?? crypto.randomUUID()
        const reply = await jsonFetch<{selection:NonNullable<OpeningReply['selection']>}>(
          '/api/roleplay/openings',{method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({sessionId,action:'select',index:selected.index,
              expectedRenderedSha256:selected.renderedSha256,operationId,...(expectedSource ? {expectedSource} : {})})})
        if (mutationTicket !== ticket.current) return
        toast(selectionMessage(reply.selection))
        if (reply.selection.status === 'completed') onCompleted?.()
        await load(true)
      } catch (cause) {
        if (mutationTicket !== ticket.current) return
        toast('开场选择失败：' + String((cause as Error).message ?? cause))
        await load(true)
      } finally {inFlight.current = false;setBusy(false)}
    }
    const recover = async () => {
      if (inFlight.current) return
      inFlight.current = true
      const mutationTicket = ticket.current
      setBusy(true)
      try {
        await jsonFetch('/api/roleplay/openings',{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({sessionId,action:'recover',...(expectedSource ? {expectedSource} : {})})})
        if (mutationTicket !== ticket.current) return
        await load(true)
      } catch (cause) {if (mutationTicket === ticket.current) toast('开场核对失败：' + String((cause as Error).message ?? cause))}
      finally {inFlight.current = false;setBusy(false)}
    }
    if (presentation === 'card') return React.createElement('section',{
      className:'dsh-rp-decision-card dsh-rp-opening-choice',role:'region','aria-label':'选择故事开场'},
      React.createElement('div',{className:'dsh-rp-opening-choice-head'},
        React.createElement('div',null,React.createElement('small',null,'角色卡已导入'),
          React.createElement('h3',null,'从这里开始故事')),
        React.createElement('button',{className:'dsh-rp-decision-close',type:'button',disabled:busy,
          'aria-label':'稍后选择开场',onClick:onDismiss},'×')),
      React.createElement('p',{className:'dsh-rp-decision-question'},fixed ? selectionMessage(fixed)
        : '选择作者提供的开场，预览后确认。'),
      !data.available && !fixed ? React.createElement('p',{className:'dsh-rp-error'},
        data.priorOpening || data.legacyDisplayed ? '这段故事已有开场，请在角色卡导入页核对。' : '开场选择暂未就绪，请稍后核对。') : null,
      React.createElement('div',{className:'dsh-rp-decision-options',role:'radiogroup','aria-label':'作者开场'},
        data.candidates.map(candidate => React.createElement('button',{key:candidate.index,type:'button',role:'radio',
          className:'dsh-rp-decision-option' + (candidate.index === index ? ' dsh-rp-decision-option-active' : ''),
          'aria-checked':candidate.index === index,disabled:busy || !!fixed,onClick:() => setIndex(candidate.index),
          onKeyDown:(event:ReactAPI.KeyboardEvent<HTMLButtonElement>) => {
            if (busy || fixed || !['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)) return
            event.preventDefault()
            const current = data.candidates.findIndex(item => item.index === index)
            const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
            const next = data.candidates[(current + step + data.candidates.length) % data.candidates.length]
            if (next) setIndex(next.index)
          }},React.createElement('span',{className:'dsh-rp-decision-key'},candidate.index + 1),
          React.createElement('span',{className:'dsh-rp-decision-label'},candidate.label)))),
      selected ? React.createElement('pre',{className:'dsh-rp-opening-preview',tabIndex:0},selected.text) : null,
      selected?.macros.some(macro => macro.status !== 'resolved') ? React.createElement('p',
        {className:'dsh-rp-muted'},'部分作者占位符将保留原样。') : null,
      React.createElement('button',{className:'dsh-rp-decision-confirm',type:'button',
        disabled:busy || !selected || !data.available || blockedRetry || !!fixed && fixed.index !== index,
        onClick:() => void choose()},busy ? '确认中…' : fixed ? '确认原开场选择' : '用这个开场开始'),
      fixed && fixed.status !== 'completed' ? React.createElement('button',{className:'dsh-rp-opening-recover',
        type:'button',disabled:busy,onClick:() => void recover()},'核对原选择') : null)
    return React.createElement('section',{className:'dsh-rp-item'},
      React.createElement('div',{className:'dsh-rp-item-head'},'选择角色卡开场',
        React.createElement('button',{className:'dsh-rp-btn',onClick:() => void load(true)},'刷新')),
      React.createElement('p',{className:'dsh-rp-muted'},
        fixed ? selectionMessage(fixed) : '开场来自已激活角色卡。选择后作为一条原生助理消息写入，不请求模型。'),
      !data.available && !fixed ? React.createElement('p',{className:'dsh-rp-error'},
        data.priorOpening ? '当前会话已有开场消息；再次导入或创建分支不会自动写第二条。'
          : data.legacyDisplayed ? '这张卡已请求旧版开场；为避免重复消息，暂不能再次选择。'
          : '当前宿主尚未加载原生开场提交能力，暂不能选择。') : null,
      React.createElement('select',{className:'dsh-rp-input','aria-label':'开场候选',value:index,
        disabled:busy || !!fixed,
        onChange:(event:ReactAPI.ChangeEvent<HTMLSelectElement>) => setIndex(Number(event.target.value))},
      data.candidates.map(candidate => React.createElement('option',{key:candidate.index,value:candidate.index},
        candidate.label))),
      selected ? React.createElement('pre',{className:'dsh-rp-item'},selected.text) : null,
      selected?.macros.some(macro => macro.status !== 'resolved') ? React.createElement('p',
        {className:'dsh-rp-muted'},'部分占位符没有可验证的上下文，将保留原样。') : null,
      React.createElement('div',{className:'dsh-rp-row'},
        React.createElement('button',{className:'dsh-rp-btn',disabled:busy || !selected || !data.available
          || blockedRetry || fixed?.status === 'completed' || !!fixed && fixed.index !== index,
          onClick:() => void choose()},busy ? '处理中…' : fixed ? '重试同一次选择' : '使用此开场'),
        fixed && fixed.status !== 'completed' ? React.createElement('button',
          {className:'dsh-rp-btn',disabled:busy,onClick:() => void recover()},'核对状态') : null))
  }
}
