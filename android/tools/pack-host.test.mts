/** Small metadata/native-adapter fixtures only, never a second runnable Harness. */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {runInNewContext} from 'node:vm'
import {execFileSync} from 'node:child_process'
import {prepareHostTree,packHost,archiveHostTree,inspectProductPublishedFiles,inspectHostGraph} from './pack-host.mts'

const tempRoot=fileURLToPath(new URL('../artifacts/test-temp/',import.meta.url))
const write=async(file:string,body:string)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,body)}
async function fixture(run:(f:{harness:string;product:string;profile:string;out:string;directory:string})=>Promise<void>) {
  await fs.mkdir(tempRoot,{recursive:true})
  const directory=await fs.mkdtemp(path.join(tempRoot,'host-pack-'))
  const harness=path.join(directory,'harness'),product=path.join(directory,'product'),profile=path.join(harness,'home/profiles/web'),out=path.join(directory,'out')
  const rows:Record<string,unknown>={}
  const pkg=async(base:string,name:string,version:string,extra:Record<string,unknown>={},files:Record<string,string>={})=>{
    const root=path.join(base,'node_modules',name)
    const metadata={name,version,...extra}
    await write(path.join(root,'package.json'),JSON.stringify(metadata))
    await write(path.join(root,'LICENSE'),'fixture runtime license')
    for(const [name,body] of Object.entries(files))await write(path.join(root,name),body)
    if(base===harness)rows['node_modules/'+name]=metadata
  }
  try {
    await write(path.join(harness,'package.json'),JSON.stringify({name:'host-fixture',private:true,dependencies:{'@deepseek-ai/dsh':'0.1.7-rc.2'}}))
    await pkg(harness,'@deepseek-ai/dsh','0.1.7-rc.2',{dependencies:{helper:'1.0.0',dupe:'1.0.0','node-addon-require-builtin':'0.1.6','node-pty':'1.2.0-beta.15'}})
    await pkg(harness,'helper','1.0.0',{optionalDependencies:{'linux-only':'1.0.0','android-only':'1.0.0'},
      peerDependencies:{'absent-optional-peer':'1.0.0'},peerDependenciesMeta:{'absent-optional-peer':{optional:true}}},
      {'runtime.node.js':'fixture node.js sidecar','runtime.wasm':'fixture wasm','versions.json':'{}'})
    await pkg(harness,'dupe','1.0.0')
    await pkg(profile,'dupe','2.0.0')
    await pkg(harness,'linux-only','1.0.0',{os:['linux']},{'linux.node':'not an Android capability'})
    await pkg(harness,'android-only','1.0.0',{os:['android'],cpu:['x64']})
    await pkg(harness,'node-addon-require-builtin','0.1.6',{dependencies:{'node-addon-native-custom-loader':'0.1.6'},
      optionalDependencies:{'native-linux':'0.1.6'}})
    await pkg(harness,'node-addon-native-custom-loader','0.1.6')
    await pkg(harness,'native-linux','0.1.6',{os:['linux']})
    await pkg(harness,'@img/sharp-wasm32','0.35.4',{dependencies:{'@emnapi/runtime':'^1.11.3'}},{'lib/sharp.wasm':'raw wasm fallback'})
    await pkg(harness,'@emnapi/runtime','1.11.3',{dependencies:{tslib:'^2.8.1'}})
    await pkg(harness,'tslib','2.8.1')
    await pkg(harness,'dshmarket','1.0.0')
    await pkg(harness,'node-pty','1.2.0-beta.15',{files:['lib','src','prebuilds']},{
      'lib/index.js':'PTY JavaScript retained','src/unix.cc':'PTY source retained',
      'prebuilds/linux-x64/pty.node':'foreign PTY','prebuilds/darwin-arm64/pty.node':'foreign PTY',
    })
    await write(path.join(harness,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:rows}))
    await write(path.join(product,'package.json'),JSON.stringify({name:'dsh-nexttavern',version:'0.3.0-rc.1',
      files:['package.json','nexttavern.dependencies.json','history'],
      dependencies:{'opaque-owned':'1.0.0','dsh-nexttavern-fixed':'1.0.0'},bundleDependencies:['opaque-owned','dsh-nexttavern-fixed']}))
    await write(path.join(product,'history/receipt.json'),'unchanged immutable receipt\n')
    await write(path.join(product,'node_modules/opaque-owned/package.json'),JSON.stringify({name:'opaque-owned',version:'1.0.0',os:['linux'],dependencies:{'intentionally-not-resolved-by-host-packer':'1.0.0'}}))
    await write(path.join(product,'node_modules/opaque-owned/runtime.node.js'),'opaque sidecar\n')
    await write(path.join(product,'tests/dev-cache.txt'),'DEV_PROJECT_FILE_MUST_NOT_SHIP')
    await pkg(product,'dsh-nexttavern-fixed','1.0.0',{peerDependencies:{'missing-owned-host-peer':'1.0.0'},
      dependencies:{'inner-owned':'1.0.0'},bundleDependencies:['inner-owned']},{
      'runtime.wasm':'protected fixed wasm','node_modules/inner-owned/package.json':'{"name":"inner-owned","version":"1.0.0"}',
      'node_modules/inner-owned/sidecar.node.js':'protected inner sidecar',
    })
    const inventoryFiles=async(base:string,names:string[])=>Promise.all(names.map(async name=>({path:name,
      sha256:createHash('sha256').update(await fs.readFile(path.join(base,name))).digest('hex')})))
    await write(path.join(product,'nexttavern.dependencies.json'),JSON.stringify({schemaVersion:1,productVersion:'0.3.0-rc.1',packages:[
      {name:'opaque-owned',version:'1.0.0',files:await inventoryFiles(path.join(product,'node_modules/opaque-owned'),['package.json','runtime.node.js'])},
      {name:'dsh-nexttavern-fixed',version:'1.0.0',files:await inventoryFiles(path.join(product,'node_modules/dsh-nexttavern-fixed'),
        ['package.json','LICENSE','runtime.wasm','node_modules/inner-owned/package.json','node_modules/inner-owned/sidecar.node.js'])},
    ],historicalComponents:[{name:'historical-fixture',version:'1.0.0',path:'history',files:await inventoryFiles(path.join(product,'history'),['receipt.json'])}]}))
    const fixed=path.join(harness,'home/maintenance/fixed-packages/dsh-nexttavern-fixed/fixture-generation')
    await fs.cp(path.join(product,'node_modules/dsh-nexttavern-fixed'),fixed,{recursive:true})
    await write(path.join(profile,'package.json'),JSON.stringify({name:'dsh-profile-web',private:true,
      dependencies:{'dsh-nexttavern':'file:'+product,dshmarket:'1.0.0',dupe:'2.0.0',
        'dsh-nexttavern-fixed':'file:../../maintenance/fixed-packages/dsh-nexttavern-fixed/fixture-generation'},
      dsh:{profile:{bundles:['@deepseek-ai/dsh','dsh-nexttavern']}}}))
    await write(path.join(profile,'cordis.yml'),'# official task-owned empty root\n[]\n')
    await write(path.join(profile,'cordis.patch.yml'),'# official task-owned empty patch\n[]\n')
    await write(path.join(profile,'pnpm-workspace.yaml'),'packages: []\n')
    await write(path.join(profile,'pnpm-lock.yaml'),'lockfileVersion: 9\n')
    await write(path.join(harness,'home/account.json'),'PRIVATE_USER_DATA_MUST_NOT_SHIP')
    await fs.mkdir(path.join(profile,'node_modules'),{recursive:true})
    await fs.symlink(product,path.join(profile,'node_modules/dsh-nexttavern'),'dir')
    await fs.symlink(fixed,path.join(profile,'node_modules/dsh-nexttavern-fixed'),'dir')
    await run({harness,product,profile,out,directory})
  } finally {await fs.rm(directory,{recursive:true,force:true})}
}

test('runtime graph excludes installed foreign optional binaries, preserves nested identities, sidecars and opaque inventory',async()=>fixture(async f=>{
  const tree=path.join(f.directory,'tree')
  const receipt=await prepareHostTree({harnessRoot:f.harness,productRoot:f.product,out:f.out,abi:'x64'},tree)
  const rootRequire=createRequire(path.join(tree,'root.json'))
  const cliRequire=createRequire(path.join(tree,'node_modules/@deepseek-ai/dsh/package.json'))
  assert.equal(rootRequire('dupe/package.json').version,'2.0.0')
  assert.equal(cliRequire('dupe/package.json').version,'1.0.0')
  assert.ok(receipt.optionalExcluded.some(row=>row.name==='linux-only'))
  assert.ok(receipt.optionalExcluded.some(row=>row.name==='absent-optional-peer'&&row.reason.includes('absent')))
  await assert.rejects(fs.access(path.join(tree,'node_modules/linux-only')),{code:'ENOENT'})
  assert.equal(await fs.readFile(path.join(tree,'node_modules/helper/runtime.node.js'),'utf8'),'fixture node.js sidecar')
  assert.equal(await fs.readFile(path.join(tree,'node_modules/helper/runtime.wasm'),'utf8'),'fixture wasm')
  assert.equal(await fs.readFile(path.join(tree,'node_modules/dsh-nexttavern/history/receipt.json'),'utf8'),'unchanged immutable receipt\n')
  assert.equal(await fs.readFile(path.join(tree,'node_modules/dsh-nexttavern/node_modules/opaque-owned/runtime.node.js'),'utf8'),'opaque sidecar\n')
  assert.equal(await fs.readFile(path.join(tree,'node_modules/@img/sharp-wasm32/lib/sharp.wasm'),'utf8'),'raw wasm fallback')
  assert.ok(receipt.packages.some(row=>row.name==='@emnapi/runtime'&&row.version==='1.11.3'))
  assert.ok(receipt.packages.some(row=>row.name==='tslib'))
  assert.equal(await fs.readFile(path.join(tree,'node_modules/dsh-nexttavern-fixed/node_modules/inner-owned/sidecar.node.js'),'utf8'),'protected inner sidecar')
  assert.ok(receipt.packages.some(row=>row.name==='dsh-nexttavern-fixed'&&row.kind==='opaque-protected-profile-package'))
  assert.equal(await fs.readFile(path.join(tree,'node_modules/node-pty/lib/index.js'),'utf8'),'PTY JavaScript retained')
  await assert.rejects(fs.access(path.join(tree,'node_modules/node-pty/prebuilds/linux-x64/pty.node')),{code:'ENOENT'})
  assert.ok(receipt.excludedFiles.some(row=>row.package==='node-pty'&&row.path==='prebuilds/linux-x64/pty.node'))
  assert.ok(receipt.unqualifiedCapabilities.some(row=>row.id==='pty'))
  await assert.rejects(fs.access(path.join(tree,'account.json')),{code:'ENOENT'})
  await assert.rejects(fs.access(path.join(tree,'node_modules/dsh-nexttavern/tests/dev-cache.txt')),{code:'ENOENT'})
  assert.equal(await fs.readFile(path.join(tree,'profile-template/package.json'),'utf8'),await fs.readFile(path.join(f.profile,'package.json'),'utf8'))
  const provisioning=JSON.parse(await fs.readFile(path.join(tree,'profile-provision.json'),'utf8'))
  assert.equal(provisioning.sourceProductRoot,f.product)
  assert.equal(provisioning.productCodePath,'node_modules/dsh-nexttavern')
  assert.equal(receipt.androidVerified,false)
}))

test('published product projection may not omit protected/history inventory members',async()=>fixture(async f=>{
  const file=path.join(f.product,'package.json'),metadata=JSON.parse(await fs.readFile(file,'utf8'))
  metadata.files=metadata.files.filter((name:string)=>name!=='history')
  await write(file,JSON.stringify(metadata))
  await assert.rejects(inspectProductPublishedFiles(f.product),/omits inventoried members.*history\/receipt.json/)
}))

test('generated Android bridge calls the installer-owned native path and exports the real binding object',async()=>fixture(async f=>{
  const tree=path.join(f.directory,'tree')
  await prepareHostTree({harnessRoot:f.harness,productRoot:f.product,out:f.out,abi:'x64'},tree)
  const filename=path.join(tree,'node_modules/node-addon-require-builtin-android-x64/index.cjs')
  const native={requireBuiltin(){},isAllowedInternalId(){},getNativeBindingInfo(){return {mode:'unrestricted',backend:'napi',abi:'napi-v9'}}}
  const module={exports:{}}
  const paths:string[]=[]
  runInNewContext(await fs.readFile(filename,'utf8'),{module,require:createRequire(filename),process:{
    env:{NEXTTAVERN_NATIVE_LIBRARY_DIR:'/installed/native'},dlopen(target:{exports:unknown},file:string){paths.push(file);target.exports=native},
  }})
  assert.equal(module.exports,native)
  assert.deepEqual(paths,['/installed/native/libnexttavern_require_builtin.so'])
}))

test('ZIP receipt/version matches actual bytes and contains only regular materialized logical files',async()=>fixture(async f=>{
  const options={harnessRoot:f.harness,productRoot:f.product,out:f.out,abi:'x64' as const}
  await assert.rejects(packHost(options),/Supply --ca-bundle/)
  const staging=path.join(f.directory,'archive-tree')
  const receipt=await archiveHostTree(staging,f.out,await prepareHostTree(options,staging))
  const bytes=await fs.readFile(path.join(f.out,'host.zip'))
  const sha=createHash('sha256').update(bytes).digest('hex')
  assert.equal(receipt.hostZipSha256,sha)
  assert.equal((await fs.readFile(path.join(f.out,'host-version.txt'),'utf8')).trim(),sha)
  const names=execFileSync('unzip',['-Z','-1',path.join(f.out,'host.zip')],{encoding:'utf8'}).split('\n')
  assert.ok(names.includes('host-launch.mjs'))
  assert.ok(names.includes('android-host.mjs'))
  assert.ok(names.includes('node_modules/dsh-nexttavern/node_modules/opaque-owned/runtime.node.js'))
  assert.equal(names.some(name=>name.includes('account.json')),false)
  assert.equal(names.some(name=>name.includes('.pnpm')),false)
  assert.equal(names.includes('profile-template/pnpm-lock.yaml'),false)
}))

test('missing official profile install or unexpected user patch blocks packing instead of inventing configuration',async()=>fixture(async f=>{
  const options={harnessRoot:f.harness,productRoot:f.product,out:f.out,abi:'x64' as const}
  await write(path.join(f.profile,'package.json'),JSON.stringify({name:'dsh-profile-web',dependencies:{}}))
  await assert.rejects(prepareHostTree(options,path.join(f.directory,'first')),/Official product installation/)
  await write(path.join(f.profile,'package.json'),JSON.stringify({name:'dsh-profile-web',dependencies:{'dsh-nexttavern':'file:'+f.product,dshmarket:'1.0.0'}}))
  await write(path.join(f.profile,'cordis.patch.yml'),'- insert:\n    - id: dsh-nexttavern-session-controller\n      disabled: true\n    - id: dsh-nexttavern-ui-chat\n      disabled: true\n    - id: dsh-nexttavern-ui-workspace\n      disabled: true\n')
  assert.equal(inspectHostGraph(options).hostVersion,'0.1.7-rc.2')
  await write(path.join(f.profile,'cordis.patch.yml'),'- id: user-model-config\n  config: {}\n')
  await assert.rejects(prepareHostTree(options,path.join(f.directory,'second')),/Unexpected task profile configuration/)
}))
