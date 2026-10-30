/** One fresh public-input Harness/profile for this CI job; never a user installation. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'

if(process.argv[2]==='--idle-probe') {
  const harness=fs.realpathSync(process.argv[3]!)
  // Inspect actual processes, not a fabricated idle flag. Only this job's
  // Harness web command can reject activation; never print process arguments.
  for(const pid of fs.readdirSync('/proc').filter(name=>/^\d+$/.test(name))) {
    let args:string[]
    try {args=fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split('\0')}
    catch(error) {
      if(['ENOENT','EACCES','ESRCH'].includes((error as NodeJS.ErrnoException).code??''))continue
      throw error
    }
    if(args.some(arg=>arg==='web'||arg.endsWith('/host-launch.mjs'))) {
      let cwd=''
      try {cwd=fs.readlinkSync('/proc/'+pid+'/cwd')}
      catch(error) {if(!['ENOENT','EACCES','ESRCH'].includes((error as NodeJS.ErrnoException).code??''))throw error}
      if(args.some(arg=>arg.includes(harness))||cwd===harness||cwd.startsWith(harness+'/'))process.exit(1)
    }
  }
  process.exit(0)
}

const repo=fs.realpathSync(process.argv[2]!), work=path.resolve(process.argv[3]!)
const harness=path.join(work,'harness'), product=path.join(work,'product-x64')
const inputs=path.join(work,'inputs')
fs.mkdirSync(inputs,{recursive:true})
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'))
const logFile=path.join(work,'prepare-host.log')
const run=(executable:string,args:string[],cwd=repo)=>{
  const fd=fs.openSync(logFile,'a')
  try {execFileSync(executable,args,{cwd,stdio:['ignore',fd,fd],env:process.env})}
  finally {fs.closeSync(fd)}
}
const mark=(name:string)=>console.log(name)

async function lockedArchive(anchor:string,name:string) {
  const row=read(path.join(anchor,'package-lock.json')).packages['node_modules/'+name]
  if(!row?.resolved||!row.integrity)throw Error('Missing public lock row: '+name)
  const file=path.join(inputs,name.replaceAll('/','_')+'-'+row.version+'.tgz')
  const response=await fetch(row.resolved)
  if(!response.ok)throw Error('Locked package download failed: '+name)
  const bytes=Buffer.from(await response.arrayBuffer())
  const [algorithm,expected]=row.integrity.split('-',2)
  if(createHash(algorithm).update(bytes).digest('base64')!==expected)throw Error('Public lock integrity mismatch: '+name)
  fs.writeFileSync(file,bytes)
  return file
}
async function materialize(anchor:string,name:string) {
  const target=path.join(anchor,'node_modules',name)
  if(fs.existsSync(path.join(target,'package.json')))return
  const archive=await lockedArchive(anchor,name)
  fs.mkdirSync(target,{recursive:true})
  execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',target])
}

// Exact compatible inputs omitted by a Linux npm install; no broad optional
// package installation and no scripts or lockfile/version changes.
await materialize(path.join(repo,'build-tools'),'@koromix/koffi-android-x64')
await materialize(path.join(repo,'build-tools'),'@firecrawl/anydoc-linux-x64-musl')
const piArchive=await lockedArchive(path.join(repo,'build-tools'),'@earendil-works/pi-ai')
const {prepareProduct}=await import(pathToFileURL(path.join(repo,'android/tools/prepare-product.mjs')).href)
prepareProduct({repo,output:product,abi:'x64',archives:{'pi-ai':piArchive}})
mark('PUBLIC_X64_PRODUCT_PREPARED')

fs.mkdirSync(harness)
for(const file of ['package.json','package-lock.json'])fs.copyFileSync(path.join(repo,'harness',file),path.join(harness,file))
const home=path.join(harness,'home')
process.env.HOME=home;process.env.DSH_HOME=home;process.env.PNPM_HOME=path.join(home,'pnpm')
for(const [key,relative]of Object.entries({XDG_CACHE_HOME:'.cache',XDG_DATA_HOME:'.local/share',XDG_CONFIG_HOME:'.config'})) {
  process.env[key]=path.join(home,relative)
  fs.mkdirSync(process.env[key]!,{recursive:true})
}
fs.mkdirSync(process.env.PNPM_HOME,{recursive:true})
process.env.PATH=path.join(harness,'node_modules/.bin')+':'+process.env.PNPM_HOME+':'+process.env.PATH
run('npm',['ci','--prefix',harness,'--no-audit','--no-fund'])
for(const name of ['@koromix/koffi-android-x64','@img/sharp-wasm32','@emnapi/runtime'])await materialize(harness,name)
const dsh=path.join(harness,'node_modules/.bin/dsh')
run(dsh,['plugin','--profile','web','add',product],harness)
const hostAnchor=path.join(harness,'node_modules/@deepseek-ai/dsh/package.json')
const require=createRequire(hostAnchor)
const {prepareProfile}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh/profile-boot')).href)
await prepareProfile('web')
const profileRoot=path.join(home,'profiles/web')
const installed=fs.realpathSync(path.join(profileRoot,'node_modules/dsh-nexttavern'))
const {Context}=await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)
const {loadProfileDirectory,createRuntimeResolution,PluginPackages}=await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href)
const profile=loadProfileDirectory('android-prepare',profileRoot,hostAnchor)
const resolution=await createRuntimeResolution({installAnchor:hostAnchor,profile,home})
const ctx=new Context()
try {
  await ctx.plugin(PluginPackages,{resolution})
  const {bootstrapBundledPackages}=await import(pathToFileURL(path.join(installed,'lib/operations/bundled-package-bootstrap.mjs')).href)
  await bootstrapBundledPackages({productRoot:installed,hostAnchor,home,profile:'web',
    backup:path.join(work,'bootstrap-backup'),resolvePeerManifest:(name:string,parentURL:string)=>
      ctx.get('pluginPackages').packageOf(name,parentURL)?.manifestPath})
}finally{await ctx.root.fiber.dispose()}
const profilePackage=read(path.join(profileRoot,'package.json'))
if(!profilePackage.dependencies?.dshmarket)run(dsh,['plugin','--profile','web','add','--save-exact','dshmarket@1.71.1'],harness)
run(dsh,['plugin','--profile','web','install'],harness)
mark('OFFICIAL_PROFILE_BOOTSTRAP_AND_RELINK_COMPLETE')

const requestFile=path.join(work,'host-activation-request.json'),audit=path.join(work,'host-activation-audit.json')
fs.writeFileSync(requestFile,JSON.stringify({schemaVersion:1,input:{packageRoot:product,hostRoot:harness,
  anchors:[path.join(harness,'package.json'),path.join(profileRoot,'package.json')]},control:{
  lockPath:path.join(work,'host-activation.lock'),receiptPath:path.join(work,'host-activation.json'),
  probe:{executable:process.execPath,args:[fileURLToPath(import.meta.url),'--idle-probe',harness],timeoutMs:10000}}}))
const cli=path.join(repo,'tools/native-fork-host-cli.mjs')
run(process.execPath,[cli,'audit','--request',requestFile,'--audit-out',audit])
mark('STOPPED_HOST_EXACT_FORK_AUDIT_COMPLETE')
run(process.execPath,[cli,'activate','--request',requestFile,'--audit',audit])
mark('STOPPED_HOST_EXACT_FORK_ACTIVATION_COMPLETE')
const ca=path.join(repo,'android/artifacts/runtime-inputs-x64/extracted/ca-certificates/data/data/com.termux/files/usr/etc/tls/cert.pem')
const {packHost}=await import(pathToFileURL(path.join(repo,'android/tools/pack-host.mjs')).href)
const output=path.join(work,'packed-host')
await packHost({harnessRoot:harness,productRoot:product,out:output,abi:'x64',caBundle:ca})
const assets=path.join(repo,'android/mobile/src/main/assets')
fs.mkdirSync(assets,{recursive:true})
// Serialize asset publication with packaging. Missing version blocks Gradle if
// copying fails or the job stops; never leave new bytes with an old identity.
const assetVersion=path.join(assets,'host-version.txt'),stagedVersion=path.join(assets,'.host-version.txt')
fs.rmSync(assetVersion,{force:true})
try {
  fs.copyFileSync(path.join(output,'host.zip'),path.join(assets,'host.zip'))
  fs.copyFileSync(path.join(output,'host-version.txt'),stagedVersion)
  fs.renameSync(stagedVersion,assetVersion)
} finally {fs.rmSync(stagedVersion,{force:true})}
mark('PUBLIC_HOST_ASSETS_PACKED_RECEIPT_NOT_BUNDLED')
