# Cloudflare Access Origin Authentication

`@isund/dsh-auth-webserver` extends the official DeepSeek Harness WebServer.
It verifies the Cloudflare Access application JWT before HTTP routes, static
files and WebSocket upgrades. It is an optional administrator-installed bundle;
installing NextTavern alone does not enable it.

Read the [phone and computer public-access guide](https://github.com/a86582751/dsh-nexttavern/blob/main/PUBLIC-ACCESS.md)
for installation, environment configuration, Cloudflare setup, verification
and rollback. Only Harness `0.1.2-alpha.3` is supported. Distribution is through
GitHub Release archives; `private: true` prevents accidental npm publication.

The host remains bound to `127.0.0.1`. Forward the original public Host and Origin
through the tunnel. Configure all four variables in `access.env.example` with
your own values; this file is a template and is not loaded automatically. Node's
`--env-file` can load your private copy. Never publish that copy or tunnel tokens.

Verification checks the issuer, audience, RS256 signature, app token type,
allowed email, subject, expiry and exact hostname. A public Origin, when present,
must match the HTTPS hostname. Verified requests bypass only the official second
login challenge; the official API Host/Origin fence remains active. The upload
compatibility patch accepts the server-owned verification marker, never an HTTP
header purporting to be authenticated. WebSockets close at JWT expiry.

This is one trusted player's full Harness workspace, including its configured
tools and files. It does not provide account or filesystem isolation between
players. Run separate OS users, instances and data directories for independent
players. Access login is not a sandbox.

Run `npm ci --ignore-scripts --no-audit --no-fund` then `npm test` to check the
adapter against local synthetic RSA/JWT fixtures. Tests never contact Cloudflare
or model providers. Real edge login and mobile background behavior depend on
your own deployment and device; follow the guide's acceptance checklist.

The maintenance source is `src/index.ts`; `lib/index.js` is generated and is the
installed entry (`package.json` main is `lib/index.js`). In the maintenance
checkout, install the locked dependencies for both `runtime/alpha3/build-tools`
and `runtime/alpha3/auth`, then bootstrap the compiler from its TypeScript source:

```powershell
npm ci --prefix runtime/alpha3/build-tools --ignore-scripts --no-audit --no-fund
npm ci --prefix runtime/alpha3/auth --ignore-scripts --no-audit --no-fund
node runtime/alpha3/src/operations/build-typescript.mts --write
node runtime/alpha3/lib/operations/build-typescript.mjs --check
```

The compiler checks the official Host/Cordis and jose declarations against their
package locks. Players do not need TypeScript to install or run the generated
package.
