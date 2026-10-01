import {WebServer} from '@deepseek-ai/dsh-host-webserver'
import type {WebRoute,WebUpgradeRoute,Config as WebServerConfig} from '@deepseek-ai/dsh-host-webserver'
import type {Context} from '@deepseek-ai/cordis'
import type {IncomingMessage,ServerResponse} from 'node:http'
import type {Duplex} from 'node:stream'
import {createRemoteJWKSet,jwtVerify} from 'jose'

interface Connection {requestRejection(request:IncomingMessage):number|undefined;authorizeIndex(request:IncomingMessage,response:ServerResponse):boolean}
declare module '@deepseek-ai/cordis' {
  interface Context {connection:Connection}
}
interface AuthConfig extends WebServerConfig {teamDomain:string;audience:string;allowedEmail:string;publicHost:string;clockToleranceSeconds?:number}
interface AuthorizationOk {ok:true;accessAuthenticated?:boolean;expiresAt?:number}
interface AuthorizationFailure {ok:false;status:401|403|503;message:string}
type AuthorizationResult=AuthorizationOk|AuthorizationFailure
type Jwks=ReturnType<typeof createRemoteJWKSet>
const ACCESS_AUTHENTICATED=Symbol.for('@isund/dsh-auth-webserver/verified-access')
const marked=(request:IncomingMessage):boolean=>Reflect.get(request,ACCESS_AUTHENTICATED)===true

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])


export function installConnectionBridge(connection:Connection):void {
  const requestRejection = connection.requestRejection.bind(connection)
  const authorizeIndex = connection.authorizeIndex.bind(connection)
  connection.requestRejection = (request) => {
    const rejection = requestRejection(request)
    return rejection === 401 && marked(request)
      ? undefined
      : rejection
  }
  connection.authorizeIndex = (request, response) => marked(request)
    ? true
    : authorizeIndex(request, response)
}

export function markAccessAuthenticated(request:IncomingMessage):void {
  Reflect.set(request, ACCESS_AUTHENTICATED, true)
}

function header(req:IncomingMessage,name:string):string|undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function hostname(req:IncomingMessage):string|undefined {
  const host = header(req, 'host')
  if (host === undefined) return undefined
  try {
    const url = new URL(`http://${host}`)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined
    return url.hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function writeHttpError(res:ServerResponse,status:number,message:string):void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
  })
  res.end(message)
}

function rejectUpgrade(socket:Duplex,status:401|403|503,message:string):void {
  const reason = status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Service Unavailable'
  const body = `${message}\n`
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\n`
    + 'Connection: close\r\n'
    + 'Cache-Control: no-store\r\n'
    + 'Content-Type: text/plain; charset=utf-8\r\n'
    + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  )
}

function normalizeTeamDomain(value:string):string {
  const raw = value.trim().replace(/\/$/u, '')
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('auth-webserver: teamDomain must be a bare HTTPS authority')
  }
  return url.origin
}

export default class AuthWebServer extends WebServer {
  declare issuer:string
  declare audience:string
  declare allowedEmail:string
  declare publicHost:string
  declare clockToleranceSeconds:number
  declare jwks:Jwks
  constructor(ctx:Context,config:AuthConfig) {
    for (const key of ['teamDomain', 'audience', 'allowedEmail', 'publicHost'] as const) {
      if (typeof config[key] !== 'string' || config[key].trim() === '') {
        throw new Error(`auth-webserver: ${key} is required`)
      }
    }
    if (config.host !== '127.0.0.1') {
      throw new Error('auth-webserver: public deployments must bind 127.0.0.1')
    }
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(config.publicHost.trim())) {
      throw new Error('auth-webserver: publicHost must be a DNS hostname without a scheme, path or port')
    }
    super(ctx, config)
    this.issuer = normalizeTeamDomain(config.teamDomain)
    this.audience = config.audience.trim()
    this.allowedEmail = config.allowedEmail.trim().toLowerCase()
    this.publicHost = config.publicHost.trim().toLowerCase()
    this.clockToleranceSeconds = config.clockToleranceSeconds ?? 15
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
      cacheMaxAge: 10 * 60 * 1000,
    });
    ctx.inject(['connection'], (connectionCtx) => {
      installConnectionBridge(connectionCtx.connection)
    });
  }

  register(route:WebRoute):()=>void {
    return super.register({
      ...route,
      handler: async (req, res) => {
        const result = await this.authorize(req)
        if (!result.ok) {
          writeHttpError(res, result.status, result.message)
          return
        }
        if (result.accessAuthenticated === true) markAccessAuthenticated(req)
        await route.handler(req, res)
      },
    })
  }

  registerFallback(handler:WebRoute['handler']):()=>void {
    return super.registerFallback(async (req, res) => {
      const result = await this.authorize(req)
      if (!result.ok) {
        writeHttpError(res, result.status, result.message)
        return
      }
      if (result.accessAuthenticated === true) markAccessAuthenticated(req)
      await handler(req, res)
    })
  }

  registerUpgrade(route:WebUpgradeRoute):()=>void {
    return super.registerUpgrade({
      ...route,
      handler: async (req, socket, head) => {
        const result = await this.authorize(req)
        if (!result.ok) {
          rejectUpgrade(socket, result.status, result.message)
          return
        }
        if (result.accessAuthenticated === true) markAccessAuthenticated(req)
        const expiresAt = result.expiresAt
        let timer: ReturnType<typeof setTimeout> | undefined
        const expire = () => {
          if (expiresAt === undefined) return
          const remaining = expiresAt - Date.now()
          if (remaining <= 0) socket.destroy()
          else {
            timer = setTimeout(expire, Math.min(remaining, 2 ** 31 - 1))
            timer.unref()
          }
        }
        if (expiresAt !== undefined) {
          expire()
          socket.once('close', () => clearTimeout(timer))
        }
        await route.handler(req, socket, head)
      },
    })
  }

  async authorize(req:IncomingMessage):Promise<AuthorizationResult> {
    const requestHost = hostname(req)
    if (requestHost === undefined) return { ok: false, status: 403, message: 'forbidden' }

    if (LOOPBACK_HOSTS.has(requestHost)) {
      const origin = header(req, 'origin')
      if (origin !== undefined) {
        try {
          if (!LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase())) {
            return { ok: false, status: 403, message: 'forbidden' }
          }
        } catch {
          return { ok: false, status: 403, message: 'forbidden' }
        }
      }
      return { ok: true }
    }

    if (requestHost !== this.publicHost) {
      return { ok: false, status: 403, message: 'forbidden' }
    }

    const origin = header(req, 'origin')
    if (origin !== undefined) {
      try {
        if (new URL(origin).origin !== `https://${this.publicHost}`) return { ok: false, status: 403, message: 'forbidden' }
      } catch {
        return { ok: false, status: 403, message: 'forbidden' }
      }
    }

    const assertion = header(req, 'cf-access-jwt-assertion')
    if (assertion === undefined || assertion === '') {
      return { ok: false, status: 401, message: 'Cloudflare Access authentication required' }
    }

    try {
      const { payload } = await jwtVerify(assertion, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockToleranceSeconds,
        algorithms: ['RS256'],
      })
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined
      if (
        payload.type !== 'app'
        || email !== this.allowedEmail
        || typeof payload.sub !== 'string'
        || payload.sub === ''
        || !Number.isFinite(payload.exp)
      ) {
        return { ok: false, status: 403, message: 'forbidden' }
      }
      return {
        ok: true,
        accessAuthenticated: true,
        expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : undefined,
      }
    } catch (error) {
      const errorCode = error instanceof Error && 'code' in error ? error.code : undefined
      const code = typeof errorCode === 'string'
        ? errorCode
        : 'ERR_ACCESS_JWT_VERIFY'
      this.ctx.logger.warn(`Cloudflare Access JWT verification failed (${code})`)
      const transient = error instanceof Error
        && (errorCode === 'ERR_JWKS_TIMEOUT' || errorCode === 'ERR_JOSE_GENERIC')
      return {
        ok: false,
        status: transient ? 503 : 401,
        message: transient ? 'authentication service unavailable' : 'invalid Cloudflare Access assertion',
      }
    }
  }
}
