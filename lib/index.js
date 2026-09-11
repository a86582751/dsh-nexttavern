// dsh-roleplay-ui 宿主半：注册不依赖已挂载 RP Agent 的常驻路由。
// 用户信息与任何会话无关，因此由本 profile 级宿主行注册——开机即存在，
// 即使从未打开过 roleplay 会话，设置页也能读写。
// 存储：$DSH_HOME/roleplay-userinfo.json（DSH_ROLEPLAY_USERINFO_PATH 可覆盖）。
// roleplay preset 的 {{user}}/{{userGender}} 变量读取同一文件。

import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createConversationCatalog } from './tavern-conversations.js'

const userInfoPath = () =>
  process.env.DSH_ROLEPLAY_USERINFO_PATH ??
  join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'roleplay-userinfo.json')

const readUserInfo = () => {
  try {
    const parsed = JSON.parse(readFileSync(userInfoPath(), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeUserInfo = (record) => {
  const p = userInfoPath()
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, JSON.stringify(record, null, 2), 'utf8')
}

const jsonResponse = (status, value) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export const name = 'dsh-roleplay-ui'
export const inject = ['connection', 'sessionController']
export function apply(ctx) {
  const home=process.env.DSH_HOME??join(process.env.HOME??'.','.dsh')
  const catalogPath=process.env.DSH_ROLEPLAY_CONVERSATIONS_PATH??join(home,'roleplay-conversations.json')
  const catalog=createConversationCatalog({
    read:()=>{try{return JSON.parse(readFileSync(catalogPath,'utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}},
    write:record=>{
      mkdirSync(join(catalogPath,'..'),{recursive:true})
      const temporary=`${catalogPath}.${randomUUID()}.tmp`
      writeFileSync(temporary,JSON.stringify(record),'utf8')
      renameSync(temporary,catalogPath)
    },
  })
  // Only explicit registered RP operations establish legacy ownership. Do not
  // enumerate Session archives or infer worldlines from native parentSession.
  const branchDirectory=join(home,'storages','roleplay','branch')
  const legacy=[]
  try {for(const filename of readdirSync(branchDirectory))if(/^fork-op-[a-zA-Z0-9-]+\.json$/.test(filename)) {
    try {const value=JSON.parse(readFileSync(join(branchDirectory,filename),'utf8'));legacy.push(value.record??value)}catch{ctx.logger?.warn?.('roleplay: invalid legacy worldline operation was not migrated')}
  }}catch(error){if(error.code!=='ENOENT')throw error}
  const ready=catalog.migrate(legacy)
  // Keep the rejected promise for request-time 503 while avoiding an unhandled
  // rejection before the first browser connects.
  void ready.catch(()=>ctx.logger?.warn?.('roleplay: worldline catalog migration failed; original records retained'))
  ctx.provide?.('tavernConversations',{...catalog,ready})
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/conversations',methods:['GET'],fetch:async()=>{
    try {await ready;return jsonResponse(200,{ok:true,...catalog.snapshot()})}
    catch{return jsonResponse(503,{ok:false,error:'酒馆会话目录未就绪，原有记录未改写'})}
  }}),'roleplay-ui: durable book/worldline catalog')
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/userinfo',
        methods: ['GET', 'POST'],
        fetch: async (request) => {
          try {
            if (request.method === 'GET') return jsonResponse(200, { ok: true, userinfo: readUserInfo() })
            const body = await request.json().catch(() => null)
            const next = {
              ...readUserInfo(),
              ...(body?.name !== undefined ? { name: String(body.name).slice(0, 60) } : {}),
              ...(body?.gender !== undefined ? { gender: String(body.gender).slice(0, 30) } : {}),
              updatedAt: Date.now(),
            }
            writeUserInfo(next)
            return jsonResponse(200, { ok: true, userinfo: next })
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay-ui: userinfo route'
  )

  // Roleplay data routes live inside the roleplay Agent preset. After a Host
  // restart, restoring the browser directly into Reader can request those
  // routes before the persisted Session has a live Agent, so the routes do not
  // exist yet. This tiny Host-level bridge resumes only the explicitly selected
  // Session; it neither sends a prompt nor wakes sibling branches.
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/wake',
        methods: ['POST'],
        fetch: async (request) => {
          try {
            const body = await request.json().catch(() => null)
            const sessionId = String(body?.sessionId ?? '').trim()
            if (!sessionId || sessionId.length > 200 || /[\u0000-\u001f]/.test(sessionId)) {
              return jsonResponse(400, { ok: false, error: 'sessionId 无效' })
            }
            const found = await ctx.sessionController.resolveAgent(sessionId)
            if (!found || 'error' in found || !found.agent?.session) {
              return jsonResponse(404, { ok: false, error: '会话不存在或无法恢复' })
            }
            const session = found.agent.session
            let preset = session.header?.agentPreset
            for (const event of session.events ?? []) {
              if (event?.type === 'agent-preset/selected' && event.data?.agentPreset) preset = event.data.agentPreset
            }
            if (preset !== 'roleplay') {
              return jsonResponse(409, { ok: false, error: '目标不是角色扮演会话' })
            }
            return jsonResponse(200, { ok: true, sessionId: session.id, preset: 'roleplay' })
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay-ui: cold Session wake route'
  )
}
