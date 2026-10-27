/** Android-owned entry; the pinned Harness still owns profile boot and auth. */
import { mkdir, readFile, writeFile, symlink, rename, readlink, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const code = path.dirname(fileURLToPath(import.meta.url))
// Use the admitted product's declared parser, not an incidental Host-root copy.
const { parseDocument } = createRequire(path.join(code, 'node_modules/dsh-nexttavern/package.json'))('yaml') as typeof import('yaml')
const home = process.env.DSH_HOME
// ProcessBuilder sets cwd to the canonical native-managed private workspace.
// The pinned Host has no Android system-Documents resolver; use its explicit
// deployment option instead. Existing Workspace registrations are not moved.
const workspace = process.cwd()
if (!home || !process.env.NEXTTAVERN_GENERATION) throw new Error('Native host paths and generation are required')
const profile = path.join(home, 'profiles', 'web')
await mkdir(profile, { recursive: true })
interface Provision {
  schemaVersion: 1
  sourceProfileRoot: string
  packages: {name: string; sourcePath: string; codePath: string}[]
}
const provision = JSON.parse(await readFile(path.join(code, 'profile-provision.json'), 'utf8')) as Provision
const receiptPath = path.join(profile, '.nexttavern-android-code.json')
const receipt = JSON.stringify({schemaVersion:1, codeRoot:code}) + '\n'
// Record the first managed slot before creating profile references, so an
// interrupted first launch can still relocate those references on an APK update.
try { await writeFile(receiptPath, receipt, {flag:'wx'}) }
catch(error) { if((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
const previous = JSON.parse(await readFile(receiptPath,'utf8')) as {schemaVersion:1; codeRoot:string}
const references = [...provision.packages].sort((a,b)=>b.sourcePath.length-a.sourcePath.length)
function rebase(value: string, sourceProfile: string): string {
  if (!value.startsWith('file:')) return value
  const source = path.resolve(sourceProfile,value.slice(5))
  if (source === previous.codeRoot || source.startsWith(previous.codeRoot + path.sep)) {
    return 'file:' + path.join(code,path.relative(previous.codeRoot,source))
  }
  const item = references.find(item=>source === item.sourcePath || source.startsWith(item.sourcePath + path.sep))
  if (!item) throw new Error('Profile file reference is outside the admitted app packages')
  return 'file:' + path.join(code,item.codePath,path.relative(item.sourcePath,source))
}
const seed = JSON.parse(await readFile(path.join(code,'profile-template/package.json'),'utf8'))
for(const [name,value] of Object.entries(seed.dependencies ?? {})) seed.dependencies[name]=rebase(String(value),provision.sourceProfileRoot)
for (const name of ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-workspace.yaml']) {
  let bytes: string | Buffer = name === 'package.json' ? JSON.stringify(seed,null,2)+'\n' : await readFile(path.join(code, 'profile-template', name))
  if (name === 'cordis.patch.yml') {
    // Android is a Tavern deployment, not the stock coding-workbench default.
    // Seed the supported registry option only with this wx-created profile.
    // Its user patch and higher-priority selectedDefault remain untouched later.
    const patch = parseDocument(bytes.toString())
    patch.add({ id:'agent-preset-registry', config:{ default:'roleplay' } })
    bytes = patch.toString()
  }
  try { await writeFile(path.join(profile, name), bytes, { flag: 'wx' }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
}
if(previous.codeRoot !== code) {
  const filename = path.join(profile,'package.json')
  const current = JSON.parse(await readFile(filename,'utf8'))
  // Preserve user-added dependencies and settings; only references into the
  // previously app-owned code slot move. Product preparation owns its own refs.
  for(const map of [current.dependencies,current.pnpm?.overrides]) {
    for(const [name,value] of Object.entries(map ?? {})) {
      if(typeof value !== 'string' || !value.startsWith('file:')) continue
      const absolute=path.resolve(profile,value.slice(5))
      if(absolute===previous.codeRoot || absolute.startsWith(previous.codeRoot+path.sep)) map[name]=rebase(value,profile)
    }
  }
  const staged=filename+'.next'
  await writeFile(staged,JSON.stringify(current,null,2)+'\n')
  await rename(staged,filename)
}
// Only app-owned dependency links move on an APK code upgrade. User settings,
// sessions and the profile's patch layer stay in the stable private home.
const packages: string[] = JSON.parse(await readFile(path.join(code, 'profile-packages.json'), 'utf8'))
for (const name of packages) {
  const link = path.join(profile, 'node_modules', name)
  const target = path.join(code, 'node_modules', name)
  await mkdir(path.dirname(link), { recursive: true })
  let previous: string | undefined
  try { previous = await readlink(link) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  if (previous === target) continue
  const staged = link + '.next'
  try { await unlink(staged) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  await symlink(target, staged)
  await rename(staged, link)
}
const overlay = path.join(home, 'android-host.patch.yml')
await writeFile(overlay, [
  '- id: web-runtime',
  '  config:',
  '    openBrowser: false',
  '    printUrl: false',
  '    surfaceContext: true',
  '    trustedHosts: !!js ctx.webStartup.trustedHosts',
  '- id: workspace-controller',
  '  config:',
  '    documentsDirectory: ' + JSON.stringify(workspace),
  '- insert:',
  '    - id: nexttavern-mobile-host',
  '      name: ' + JSON.stringify(pathToFileURL(path.join(code, 'android-host.mjs')).href),
  '',
].join('\n'))
await writeFile(receiptPath+'.next',receipt)
await rename(receiptPath+'.next',receiptPath)
process.env.NARB_DISABLE_NATIVE_CACHE = '1'
process.env.NARB_BACKEND = 'napi'
const bin = path.join(code, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
process.argv = [process.execPath, bin, 'web', '--patch', overlay, '--host', '127.0.0.1', '--port', '0', '--no-open']
// The pinned CLI self-dispatches only when import.meta.main is true. This
// launcher imports it, so invoke its public entry explicitly.
const { runCli } = await import(pathToFileURL(bin).href)
await runCli()
