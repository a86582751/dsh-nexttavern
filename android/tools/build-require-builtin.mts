/** Build pinned Harness internals access against Android Bionic; no Host resolver fork. */
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = resolve(process.argv[2] ?? join(root, 'artifacts/runtime-inputs'))
const ndk = process.env.ANDROID_NDK_HOME
if (!ndk || !(await readFile(join(ndk, 'source.properties'), 'utf8')).includes('Pkg.Revision = 28.2.13676358')) {
  throw new Error('Set ANDROID_NDK_HOME to pinned NDK 28.2.13676358')
}
const commit = 'a58d3599a2e551d7d706d1ff796c9fd4bbaff63c'
const archiveHash = '286616f15e4f12013988e45ad27a69b4968a9f059c8bd351e412505230577948'
const apiIntegrity = 'ekZMeaaIzSQTSpr7X2X3iJM7lTzgnx8ahAG9pJfT/7+14mlEM8ZYQ9cgCDvSSRbReFK0oHli3WrZdCiRsgAT9Q=='
await mkdir(cache, {recursive:true})
async function archive(name:string, url:string, algorithm:'sha256'|'sha512', expected:string, encoding:'hex'|'base64') {
  const file = join(cache, name)
  try { await readFile(file) } catch(error) {
    if((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    execFileSync('curl', ['-fsSL', url, '-o', file])
  }
  if(createHash(algorithm).update(await readFile(file)).digest(encoding) !== expected) throw new Error('Native source integrity mismatch: '+name)
  return file
}
const sourceArchive = await archive('require-builtin-0.1.9.tgz',
  'https://codeload.github.com/deepseek-ai/dsh-node-addon-require-builtin/tar.gz/'+commit, 'sha256',archiveHash,'hex')
const apiArchive = await archive('node-addon-api-8.9.0.tgz',
  'https://registry.npmjs.org/node-addon-api/-/node-addon-api-8.9.0.tgz','sha512',apiIntegrity,'base64')
const source = join(cache, 'require-builtin-source')
const api = join(cache, 'node-addon-api-8.9.0')
for(const [tar, target] of [[sourceArchive,source],[apiArchive,api]]) {
  await mkdir(target!, {recursive:true})
  execFileSync('tar',['-xzf',tar!,'--strip-components=1','-C',target!])
}
const native = join(source,'packages/native/src')
// This upstream version dispatches Linux architecture readers independent of libc.
// Build its exact sources unchanged for Bionic; runtime validation remains required.
const architectures = ['darwin_arm64','darwin_x64','linux_arm64','linux_x64','win32_arm64','win32_x64','win32_ia32']
const sources = [
  'node_api_addon.cc','debug_trace.cc','native_types.cc','runtime_symbol.cc','require_builtin_probe.cc','runtime_compat_napi.cc',
  'runtime_context/helper.cc','runtime_context/embedder_data.cc','runtime_context/platform.cc','runtime_context/runtime_profile.cc','runtime_context/runtime_profile_napi.cc',
  ...architectures.map(name=>'runtime_context/'+name+'.cc'),
  'runtime_probe/helper.cc','runtime_probe/platform.cc','runtime_probe/getter_decoder.cc','runtime_probe/posix.cc','runtime_probe/win32_common.cc',
  ...architectures.map(name=>'runtime_probe/'+name+'.cc'),
].map(file=>join(native,file))
const outputs = []
for(const [abi,triple] of [['arm64-v8a','aarch64-linux-android26'],['x86_64','x86_64-linux-android26']]) {
  const output = join(root,'app/src/main/jniLibs',abi!,'libnexttavern_require_builtin.so')
  await mkdir(dirname(output),{recursive:true})
  execFileSync(join(ndk,'toolchains/llvm/prebuilt/linux-x86_64/bin',triple+'-clang++'),[
    '-std=c++17','-shared','-fPIC','-pthread','-fno-exceptions','-fvisibility=hidden',
    '-DNAPI_VERSION=9','-DNARB_BACKEND=1','-DNARB_PRODUCT=1','-DNODE_ADDON_API_DISABLE_CPP_EXCEPTIONS',
    '-DNODE_GYP_MODULE_NAME=require_builtin','-I',join(cache,'extracted/nodejs-lts/data/data/com.termux/files/usr/include/node'),
    '-I',api,...sources,'-Wl,-z,max-page-size=16384','-ldl','-o',output,
  ],{stdio:'inherit'})
  outputs.push({abi,sha256:createHash('sha256').update(await readFile(output)).digest('hex')})
}
const notices = join(root,'app/src/main/assets/runtime-notices')
await mkdir(notices,{recursive:true})
await copyFile(join(source,'LICENSE'),join(notices,'require-builtin-LICENSE'))
await copyFile(join(api,'LICENSE.md'),join(notices,'node-addon-api-LICENSE'))
await mkdir(join(root,'artifacts'),{recursive:true})
await writeFile(join(root,'artifacts/require-builtin-build.json'),JSON.stringify({schemaVersion:1,
  version:'0.1.9',commit,sourceSha256:archiveHash,nodeAddonApi:'8.9.0',ndk:'28.2.13676358',
  patch:'None; upstream Linux architecture dispatch, compiled with Android NDK',
  outputs,runtimeVerified:false},null,2)+'\n')
console.log('Built Bionic internals addon. Each packaged Node/ABI still requires execution validation.')
