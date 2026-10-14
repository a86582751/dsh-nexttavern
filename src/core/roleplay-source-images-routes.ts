import {jsonResponse} from './roleplay-state.js'
import {assertWorkspaceSession} from './roleplay-context.js'
import type {JobRoutesDependencies} from './roleplay-job-routes-types.js'
import type {createSourceImagesV1} from './roleplay-source-images.js'

export function registerSourceImagesRoutesV1(deps: {
  ctx: Pick<JobRoutesDependencies['ctx'], 'connection' | 'effect'>
  resolveRoleplaySession: JobRoutesDependencies['resolveRoleplaySession']
  images: ReturnType<typeof createSourceImagesV1>
  withSourceLock<R>(sessionId: string, work: () => Promise<R>): Promise<R>
}) {
  deps.ctx.effect(() => deps.ctx.connection.fetch.register({
    requestBody: 'buffered', path: '/api/roleplay/source-images', methods: ['GET', 'POST'],
    fetch: async request => {
      try {
        const url = new URL(request.url)
        const body = request.method === 'POST'
          ? await request.json() as {sessionId: string; sourceHash: string; candidateId: string} : null
        const session = await deps.resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'))
        if (!session) return jsonResponse(404, {ok: false, error: '角色扮演会话不存在'})
        assertWorkspaceSession(session)
        return await deps.withSourceLock(session.id, async () => body
          ? jsonResponse(200, {ok: true, resource: await deps.images.select(session, body.sourceHash, body.candidateId)})
          : jsonResponse(200, {ok: true, ...deps.images.list(session)}))
      } catch (error) {
        return jsonResponse(400, {ok: false, error: error instanceof Error ? error.message : String(error)})
      }
    },
  }), 'roleplay: explicit Source image selection')
}
