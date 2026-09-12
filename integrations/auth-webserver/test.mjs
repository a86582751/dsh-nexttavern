import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { EventEmitter } from 'node:events'
import { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { exportJWK, SignJWT } from 'jose'
import AuthWebServer, { installConnectionBridge, markAccessAuthenticated } from './index.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const kid = randomUUID()
const publicJwk = await exportJWK(publicKey)
const issuerServer = createServer((req, res) => {
  if (req.url === '/cdn-cgi/access/certs') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ keys: [{ ...publicJwk, kid, use: 'sig', alg: 'RS256' }] }))
    return
  }
  res.writeHead(404)
  res.end()
})
issuerServer.listen(0, '127.0.0.1')
await once(issuerServer, 'listening')
const issuer = `https://127.0.0.1:${issuerServer.address().port}`

const ctx = {
  logger: { warn() {} },
}
const config = { host: '127.0.0.1', teamDomain: 'https://team.cloudflareaccess.com', audience: 'fixture', allowedEmail: 'allowed@example.com', publicHost: 'harness.example.com' }
assert.throws(() => new AuthWebServer(ctx, { ...config, audience: '' }), /audience is required/)
assert.throws(() => new AuthWebServer(ctx, { ...config, host: '0.0.0.0' }), /bind 127\.0\.0\.1/)
assert.throws(() => new AuthWebServer(ctx, { ...config, publicHost: 'https://harness.example.com' }), /DNS hostname/)
const server = Object.create(AuthWebServer.prototype)
Object.assign(server, {
  issuer,
  audience: 'aud-test',
  allowedEmail: 'allowed@example.com',
  publicHost: 'harness.example.com',
  clockToleranceSeconds: 0,
  ctx,
})

// Use an HTTP JWKS URL in this isolated test while production normalization
// requires HTTPS.
server.jwks = async (protectedHeader) => {
  assert.equal(protectedHeader.kid, kid)
  return publicKey
}

const connection = {
  requestRejection() { return 401 },
  authorizeIndex() { return false },
}
installConnectionBridge(connection)

async function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ type: 'app', email: 'allowed@example.com', ...overrides.payload })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? 'aud-test')
    .setSubject(overrides.subject ?? 'subject-1')
    .setIssuedAt(now)
    .setExpirationTime(overrides.expiresAt ?? now + 300)
    .sign(privateKey)
}

const request = (host, assertion, origin) => ({
  headers: {
    host,
    ...(assertion === undefined ? {} : { 'cf-access-jwt-assertion': assertion }),
    ...(origin === undefined ? {} : { origin }),
  },
})

assert.deepEqual(await server.authorize(request('127.0.0.1:3081')), { ok: true })
assert.equal((await server.authorize(request('127.0.0.1:3081', undefined, 'https://evil.example'))).status, 403)
assert.equal((await server.authorize(request('evil.example'))).status, 403)
assert.equal((await server.authorize(request('harness.example.com'))).status, 401)
assert.equal((await server.authorize(request('harness.example.com', await token()))).ok, true)
assert.equal((await server.authorize(request('harness.example.com', await token({ payload: { type: 'org' } })))).status, 403)
const now = Math.floor(Date.now() / 1000)
const noExpiryToken = await new SignJWT({ type: 'app', email: 'allowed@example.com' })
  .setProtectedHeader({ alg: 'RS256', kid })
  .setIssuer(issuer)
  .setAudience('aud-test')
  .setSubject('subject-1')
  .setIssuedAt(now)
  .sign(privateKey)
assert.equal((await server.authorize(request('harness.example.com', noExpiryToken))).status, 403)
assert.equal((await server.authorize(request('harness.example.com', await token({ payload: { email: 'other@example.com' } })))).status, 403)
assert.equal((await server.authorize(request('harness.example.com', await token({ audience: 'wrong' })))).status, 401)
assert.equal((await server.authorize(request('harness.example.com', await token({ expiresAt: Math.floor(Date.now() / 1000) - 10 })))).status, 401)
assert.equal((await server.authorize(request('harness.example.com', await token({ issuer: 'https://wrong.example' })))).status, 401)
assert.equal((await server.authorize(request('harness.example.com', await token({ subject: '' })))).status, 403)
assert.equal((await server.authorize(request('harness.example.com', await token({ payload: { nbf: now + 300 } })))).status, 401)
assert.equal((await server.authorize(request('harness.example.com', await token(), 'https://evil.example'))).status, 403)
assert.equal((await server.authorize(request('harness.example.com', await token(), 'http://harness.example.com'))).status, 403)
assert.equal((await server.authorize(request('harness.example.com', await token(), 'https://harness.example.com'))).ok, true)
assert.equal((await server.authorize(request('user@harness.example.com', await token()))).status, 403)
const { privateKey: forgedKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const forged = await new SignJWT({ type: 'app', email: 'allowed@example.com' }).setProtectedHeader({ alg: 'RS256', kid }).setIssuer(issuer).setAudience('aud-test').setSubject('s').setExpirationTime(now + 300).sign(forgedKey)
assert.equal((await server.authorize(request('harness.example.com', forged))).status, 401)
const realJwks = server.jwks
server.jwks = async () => { throw Object.assign(new Error('fixture timeout'), { code: 'ERR_JWKS_TIMEOUT' }) }
assert.equal((await server.authorize(request('harness.example.com', await token()))).status, 503)
server.jwks = realJwks

const bridgedRequest = request('harness.example.com', await token())
assert.equal(connection.requestRejection(bridgedRequest), 401)
assert.equal(connection.authorizeIndex(bridgedRequest, {}), false)
markAccessAuthenticated(bridgedRequest)
assert.equal(connection.requestRejection(bridgedRequest), undefined)
assert.equal(connection.authorizeIndex(bridgedRequest, {}), true)

const forbiddenConnection = {
  requestRejection() { return 403 },
  authorizeIndex() { return false },
}
installConnectionBridge(forbiddenConnection)
const markedForbiddenRequest = request('evil.example')
markAccessAuthenticated(markedForbiddenRequest)
assert.equal(forbiddenConnection.requestRejection(markedForbiddenRequest), 403)

// Exercise the real wrapper: headers cannot forge the server-only upload marker.
assert.equal(request('harness.example.com')[Symbol.for('@isund/dsh-auth-webserver/verified-access')], undefined)
let wrapped, upgrades = 0
const originalRegister = WebServer.prototype.registerUpgrade
WebServer.prototype.registerUpgrade = function(route) { wrapped = route; return () => {} }
try {
  server.registerUpgrade({ path: '/fixture', handler() { upgrades++ } })
  const denied = new EventEmitter()
  denied.end = text => { denied.response = text }
  await wrapped.handler(request('harness.example.com'), denied, Buffer.alloc(0))
  assert.match(denied.response, /401 Unauthorized/)
  assert.equal(upgrades, 0)
  const socket = new EventEmitter()
  socket.destroy = () => { socket.destroyed = true; socket.emit('close') }
  const auth = server.authorize
  server.authorize = async () => ({ ok: true, accessAuthenticated: true, expiresAt: Date.now() + 30 })
  const incoming = request('harness.example.com')
  await wrapped.handler(incoming, socket, Buffer.alloc(0))
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(upgrades, 1)
  assert.equal(socket.destroyed, true)
  assert.equal(incoming[Symbol.for('@isund/dsh-auth-webserver/verified-access')], true)
  server.authorize = auth
} finally {
  WebServer.prototype.registerUpgrade = originalRegister
}

issuerServer.close()
await once(issuerServer, 'close')
console.log('auth-webserver contract tests passed')
