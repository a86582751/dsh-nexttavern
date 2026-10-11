import {jsonResponse} from './roleplay-state.js'
import {assertWorkspaceSession} from './roleplay-context.js'
import type {JobRoutesDependencies} from './roleplay-job-routes-types.js'
import type {createSourceMusicV1} from './roleplay-source-music.js'

export function registerSourceMusicRoutesV1(deps:{
  ctx:Pick<JobRoutesDependencies['ctx'],'connection'|'effect'>
  resolveRoleplaySession:JobRoutesDependencies['resolveRoleplaySession']
  music:ReturnType<typeof createSourceMusicV1>
  withSourceLock<R>(sessionId:string,work:()=>Promise<R>):Promise<R>
}) {
  deps.ctx.effect(()=>deps.ctx.connection.fetch.register({requestBody:'buffered',
    path:'/api/roleplay/source-music',methods:['GET','POST'],fetch:async request=>{
      try {
        const url=new URL(request.url)
        const body=request.method==='POST'?await request.json() as {sessionId:string;sourceHash:string;candidateId:string}:null
        const session=await deps.resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
        if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
        assertWorkspaceSession(session)
        return await deps.withSourceLock(session.id,async()=>body
          ?jsonResponse(200,{ok:true,resource:await deps.music.select(session,body.sourceHash,body.candidateId)})
          :jsonResponse(200,{ok:true,...deps.music.list(session)}))
      }catch(error){return jsonResponse(400,{ok:false,error:String((error as Error).message)})}
    }}),'roleplay: explicit Source music selection')
}
