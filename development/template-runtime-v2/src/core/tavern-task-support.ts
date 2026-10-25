const copy = <T>(value: T): T => value == null ? value : structuredClone(value)

export interface TaskFailure {
  category: string
  label: string
  code: string | null
  status: number | null
  [key: string]: unknown
}

export class TaskValidationError extends Error {
  code: string
  failure: TaskFailure
  constructor(message: string, issues: readonly unknown[] = [], code = 'TASK_RESULT_INVALID') {
    super(message)
    this.code = code
    this.failure = {schemaVersion:1,category:'validation',label:'任务结果校验失败',stage:'validate',code,status:null,issues:copy(issues)}
  }
}
export function taskValidationFailure(job: {failure?: unknown; error?: unknown}) {
  const failure = job.failure as Record<string, unknown> | null | undefined
  if (failure?.schemaVersion===1 && failure.category==='validation') return copy(failure)
  // Legacy jobs retained this local message but had no structured failure.
  if (job.error==='状态结果没有保留作者模板') return new TaskValidationError(job.error,
    [{path:'html',rule:'author-template',expected:'author-template',actual:'mismatch'}],'STATUS_TEMPLATE_MISMATCH').failure
  return null
}
export const FAILURE_LABELS=Object.freeze({timeout:'任务超时',truncated:'输出达到上限，结果被截断','empty-response':'模型返回空结果',authentication:'认证失败',permission:'访问被拒绝',balance:'余额不足',quota:'配额不足','rate-limit':'请求限流','request-header':'请求头错误','invalid-request':'请求参数错误',overloaded:'模型服务繁忙',upstream:'服务端错误',cancelled:'请求已取消',unknown:'原因未提供'})
// Classify locally; never persist provider response bodies or request headers.
export function taskFailureDetails(raw: unknown): TaskFailure {
  if (raw instanceof TaskValidationError) return copy(raw.failure)
  let f: unknown=raw??{}
  const seen=new Set<object>()
  for(let depth=0;depth<8&&f&&typeof f==='object'&&!seen.has(f);depth++) {
    seen.add(f)
    const data=f as Record<string, unknown>
    const nested=data.failure??data.error??data.cause
    if(!nested)break
    f=typeof nested==='string'?{...data,message:nested}:nested
  }
  if(typeof f==='string')f={message:f}
  const data=Object(f) as Record<string, unknown>
  const candidate=String(data.code??'')
  const code=/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(candidate)?candidate:null
  const rawStatus=data.status??data.statusCode
  const status=typeof rawStatus==='number'&&Number.isInteger(rawStatus)?rawStatus:null
  const hint=`${code??''} ${data.kind??''} ${typeof data.message==='string'?data.message:''}`.toLowerCase()
  const category=/timeout|timed.out|超时/.test(hint)?'timeout':/insufficient.*(?:balance|fund)|余额不足/.test(hint)||status===402?'balance'
    :/max[-_ ]?tokens|truncat/.test(hint)?'truncated'
    :/^EMPTY_(?:TASK_RESULT|RESPONSE)$/.test(code??'')?'empty-response'
    :/insufficient.quota|quota.exceeded|配额/.test(hint)?'quota'
    :/invalid.*header|header.*invalid|请求头/.test(hint)?'request-header'
    :status===401||/auth|invalid.api.key/.test(hint)?'authentication':status===403?'permission':status===429?'rate-limit'
    :/overloaded|over.capacity|server.{0,40}busy|服务.{0,8}繁忙/.test(hint)?'overloaded'
    :status===400||status===422?'invalid-request':(status??0)>=500?'upstream':data.kind==='aborted'?'cancelled':'unknown'
  return {category,label:FAILURE_LABELS[category],code,status}
}
const tableLocks=new WeakMap<object, Map<string, Promise<unknown>>>()
export async function withTavernLock<T>(table: object,key: string,work: () => T | PromiseLike<T>): Promise<T> {
  let locks=tableLocks.get(table)
  if(!locks){locks=new Map();tableLocks.set(table,locks)}
  const previous=locks.get(key)??Promise.resolve(), next=previous.catch(()=>{}).then(work)
  locks.set(key,next)
  try{return await next}finally{if(locks.get(key)===next)locks.delete(key)}
}
export function nativeTaskOutputBudget(route: {provider?: string; model?: string; reasoningEffort?: unknown} | null | undefined,budget: number): number {
  // Gemini's observed reasoning output can exhaust the small result-oriented
  // task cap before producing JSON. Preserve the selected effort and reserve
  // total output headroom; this is a ceiling, not a requested output length.
  return budget&&route?.provider==='google'&&/^gemini-/.test(route.model??'')&&route.reasoningEffort!=='off'&&route.reasoningEffort!=='minimal'
    ?Math.max(budget,16384):budget
}
