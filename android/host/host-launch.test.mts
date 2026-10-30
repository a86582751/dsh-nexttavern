import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile, cp, symlink } from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'

const repo = path.resolve(import.meta.dirname, '../..')
test('first launch and APK replacement preserve user profile and relink only app packages', async () => {
  const base = path.join(repo, 'artifacts/test-temp')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(path.join(base, 'android-launch-'))
  try {
    const home = path.join(root, 'home')
    const workspace = path.join(root, 'private workspace')
    await mkdir(workspace, {recursive:true})
    const libraries=path.join(repo,existsSync(path.join(repo,'runtime/alpha3/build-tools/package.json'))
      ? 'runtime/alpha3/build-tools/node_modules' : 'build-tools/node_modules')
    const yaml=createRequire(path.join(libraries,'../package.json'))('yaml') as {parse(text:string):unknown}
    const launch = async (version: string) => {
      const code = path.join(root, version)
      await mkdir(path.join(code, 'profile-template'), { recursive: true })
      await mkdir(path.join(code, 'node_modules/@deepseek-ai/dsh/lib'), { recursive: true })
      await mkdir(path.join(code, 'node_modules/dsh-nexttavern'), { recursive: true })
      await writeFile(path.join(code,'node_modules/dsh-nexttavern/package.json'),JSON.stringify({name:'dsh-nexttavern',dependencies:{yaml:'2.8.1'}}))
      await mkdir(path.join(code,'node_modules/dsh-nexttavern/node_modules'),{recursive:true})
      const parser=path.join(code,'node_modules/dsh-nexttavern/node_modules/yaml')
      if(!existsSync(parser))await symlink(path.join(libraries,'yaml'),parser,'junction')
      await cp(path.join(repo, 'android/host/host-launch.mts'), path.join(code, 'host-launch.mts'))
      for (const name of ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-workspace.yaml']) {
        await writeFile(path.join(code, 'profile-template', name), name === 'package.json' ? JSON.stringify({dependencies:{'dsh-nexttavern':'file:/cloud/product'}}) : '[]\n')
      }
      await writeFile(path.join(code, 'profile-packages.json'), '["dsh-nexttavern"]')
      await writeFile(path.join(code,'profile-provision.json'),JSON.stringify({schemaVersion:1,sourceProfileRoot:'/cloud/profile',packages:[{name:'dsh-nexttavern',sourcePath:'/cloud/product',codePath:'node_modules/dsh-nexttavern'}]}))
      await writeFile(path.join(code, 'node_modules/@deepseek-ai/dsh/package.json'), '{"type":"module"}')
      await writeFile(path.join(code, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), `
export async function runCli() {
  console.log(JSON.stringify({argv:process.argv.slice(2), cache:process.env.NARB_DISABLE_NATIVE_CACHE}))
}
if (import.meta.main) await runCli()
`)
      const result = spawnSync(process.execPath, [path.join(code, 'host-launch.mts')], {
        cwd:workspace,
        env: { ...process.env, DSH_HOME: home, NEXTTAVERN_GENERATION: version }, encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
      const output = JSON.parse(result.stdout)
      assert.deepEqual(output.argv, ['web', '--patch', path.join(home, 'android-host.patch.yml'), '--host', '127.0.0.1', '--port', '0', '--no-open'])
      assert.equal(output.cache, '1')
      assert.equal(await readlink(path.join(home, 'profiles/web/node_modules/dsh-nexttavern')), path.join(code, 'node_modules/dsh-nexttavern'))
      const pkg=JSON.parse(await readFile(path.join(home,'profiles/web/package.json'),'utf8'))
      assert.equal(pkg.dependencies['dsh-nexttavern'],'file:'+path.join(code,'node_modules/dsh-nexttavern'))
      const overlay=await readFile(path.join(home,'android-host.patch.yml'),'utf8')
      assert.ok(overlay.includes('- id: workspace-controller\n  config:\n    documentsDirectory: '+JSON.stringify(workspace)+'\n'),
        'first, repeated and upgraded launches use the native-managed cwd for the official first-use Workspace policy')
    }
    await launch('v1')
    const patch = path.join(home, 'profiles/web/cordis.patch.yml')
    const initial=await readFile(patch,'utf8')
    assert.deepEqual(yaml.parse(initial),[{id:'agent-preset-registry',config:{default:'roleplay'}}])
    const userPatch='# user settings\n- id: retained-user-row\n  config:\n    value: !!js ctx.example\n- id: agent-preset-registry\n  config:\n    default: roleplay\n    selectedDefault: standard\n'
    await writeFile(patch, userPatch)
    await launch('v1')
    await launch('v2')
    assert.equal(await readFile(patch, 'utf8'), userPatch)
    const overlay = await readFile(path.join(home, 'android-host.patch.yml'), 'utf8')
    assert.match(overlay, /printUrl: false/)
    assert.match(overlay, /v2\/android-host.mjs/)
    assert.doesNotMatch(overlay, /agent-preset-registry|selectedDefault/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

// Faults are injected into the real launcher's filesystem boundary, not a model
// of its recovery logic. The desktop publication route uses atomic link/no-clobber.
test('launcher journals interrupted publication and upgrades without adopting user edits', async () => {
  await mkdir(path.join(repo,'artifacts/test-temp'),{recursive:true})
  const root=await mkdtemp(path.join(repo,'artifacts/test-temp/android-launch-recovery-'))
  try {
    const libraries=path.join(repo,'build-tools/node_modules')
    const collisionManifest='{ \"dependencies\": {}, \"userSetting\": true }\n'
    const collisionPatch='# user-owned patch\n[]\n'
    const hook=path.join(root,'interrupt.mjs')
    await writeFile(hook, `import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const rename=fs.rename, link=fs.link;
if(process.env.FAULT.startsWith('native-')) {
  Object.defineProperty(process,'platform',{value:'android'});
  process.env.NEXTTAVERN_FLOCK_ADDON='/fixture/native-system.so';
  process.dlopen=(module)=>{module.exports=process.env.FAULT==='native-unavailable'?{}:{publishNoReplace:(source,target,done)=>{
    if(process.env.FAULT==='native-denied') {done(13);return}
    Promise.resolve().then(async()=>{
      // A user file wins after the launcher's absence check but before publish.
      if(process.env.FAULT==='native-collision') {
        if(target===process.env.PROFILE+'/package.json') await fs.writeFile(target,${JSON.stringify(collisionManifest)},{flag:'wx'});
        if(target===process.env.PROFILE+'/cordis.patch.yml') await fs.writeFile(target,${JSON.stringify(collisionPatch)},{flag:'wx'});
      }
      await link(source,target);
    }).then(()=>done(0),error=>done(error.code==='EEXIST'?17:13));
  }}};
  fs.link=async()=>{throw new Error('Android must not fall back to desktop hardlinks')};
}
fs.rename=async function(from,to){
  const result=await rename(from,to);
  if(process.env.FAULT==='manifest-renamed' && to===process.env.PROFILE+'/package.json') process.exit(91);
  return result;
};
fs.link=async function(from,to){
  if(process.env.FAULT==='receipt-before-publication' && to===process.env.PROFILE+'/.nexttavern-android-code.json') process.exit(92);
  if(process.env.FAULT==='seed-before-publication' && to===process.env.PROFILE+'/package.json') process.exit(93);
  if(process.env.FAULT==='publication-failed' && to===process.env.PROFILE+'/package.json') throw Object.assign(new Error('fixture denied'),{code:'EACCES'});
  if(process.platform==='android') throw new Error('Android must not fall back to desktop hardlinks');
  const result=await link(from,to);
  if(process.env.FAULT==='seed-published' && to===process.env.PROFILE+'/package.json') process.exit(94);
  return result;
};
syncBuiltinESMExports();`)
    const codes:Record<string,string>={}
    for(const version of ['A','B','C','D']) {
      const code=codes[version]=path.join(root,version.toLowerCase().repeat(64))
      await mkdir(path.join(code,'profile-template'),{recursive:true})
      await mkdir(path.join(code,'node_modules/@deepseek-ai/dsh/lib'),{recursive:true})
      await mkdir(path.join(code,'node_modules/dsh-nexttavern/node_modules'),{recursive:true})
      await writeFile(path.join(code,'node_modules/dsh-nexttavern/package.json'),'{}')
      await symlink(path.join(libraries,'yaml'),path.join(code,'node_modules/dsh-nexttavern/node_modules/yaml'),'junction')
      await cp(path.join(repo,'android/host/host-launch.mts'),path.join(code,'host-launch.mts'))
      for(const name of ['package.json','cordis.yml','cordis.patch.yml','pnpm-workspace.yaml']) {
        await writeFile(path.join(code,'profile-template',name),name==='package.json'
          ?JSON.stringify({dependencies:{'dsh-nexttavern':'file:/cloud/product'},pnpm:{overrides:{'managed-override':'file:/cloud/product'}}}):'[]\n')
      }
      await writeFile(path.join(code,'profile-packages.json'),'["dsh-nexttavern"]')
      await writeFile(path.join(code,'profile-provision.json'),JSON.stringify({schemaVersion:1,sourceProfileRoot:'/cloud/profile',packages:[{name:'dsh-nexttavern',sourcePath:'/cloud/product',codePath:'node_modules/dsh-nexttavern'}]}))
      await writeFile(path.join(code,'node_modules/@deepseek-ai/dsh/package.json'),'{"type":"module"}')
      await writeFile(path.join(code,'node_modules/@deepseek-ai/dsh/lib/bin.js'),'export async function runCli(){console.log("fixture-ready")}')
    }
    const profileOf=(home:string)=>path.join(home,'profiles/web')
    const launch=async(home:string,version:string,fault='')=>{
      await mkdir(home,{recursive:true})
      return spawnSync(process.execPath,['--import',hook,path.join(codes[version]!,'host-launch.mts')],{
        cwd:home,env:{...process.env,DSH_HOME:home,NEXTTAVERN_GENERATION:version,PROFILE:profileOf(home),FAULT:fault},encoding:'utf8'})
    }
    const ok=async(home:string,version:string)=>{
      const result=await launch(home,version);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/fixture-ready/)
    }
    const manifestOf=(home:string)=>path.join(profileOf(home),'package.json')
    const receiptOf=(home:string)=>path.join(profileOf(home),'.nexttavern-android-code.json')
    const readManifest=async(home:string)=>JSON.parse(await readFile(manifestOf(home),'utf8'))
    const expected=(version:string)=>'file:'+path.join(codes[version]!,'node_modules/dsh-nexttavern')
    for(const next of ['B','C']) {
      const home=path.join(root,'upgrade-'+next)
      await ok(home,'A')
      assert.equal((await launch(home,'B','manifest-renamed')).status,91)
      await ok(home,next)
      assert.equal((await readManifest(home)).dependencies['dsh-nexttavern'],expected(next))
      assert.equal((await readManifest(home)).pnpm.overrides['managed-override'],expected(next))
      assert.equal(await readlink(path.join(profileOf(home),'node_modules/dsh-nexttavern')),expected(next).slice(5))
      const receipt=JSON.parse(await readFile(receiptOf(home),'utf8'))
      assert.equal(receipt.codeRoot,codes[next]);assert.equal(receipt.pending,undefined)
    }
    const edited=path.join(root,'user-edited')
    await ok(edited,'A')
    assert.equal((await launch(edited,'B','manifest-renamed')).status,91)
    const current=await readManifest(edited)
    current.dependencies['dsh-nexttavern']=expected('A')+'/user-selected'
    current.dependencies['user-added']='file:/user/custom'
    current.settings={keep:true}
    current.pnpm={overrides:{'managed-override':expected('A')+'/user-selected',custom:expected('A')+'/user-override'}}
    await writeFile(manifestOf(edited),JSON.stringify(current))
    await ok(edited,'C')
    assert.deepEqual(await readManifest(edited),current)
    for(const [fault,status] of [['receipt-before-publication',92],['seed-before-publication',93],['seed-published',94],['publication-failed',1]] as const) {
      const home=path.join(root,fault)
      assert.equal((await launch(home,'A',fault)).status,status)
      if(fault==='receipt-before-publication') assert.equal(existsSync(receiptOf(home)),false)
      if(fault==='seed-before-publication'||fault==='publication-failed') assert.equal(existsSync(manifestOf(home)),false)
      await ok(home,'A');await ok(home,'B')
      assert.equal((await readManifest(home)).dependencies['dsh-nexttavern'],expected('B'))
    }
    for(const bytes of ['', '{malformed']) {
      const home=path.join(root,'existing-'+bytes.length)
      await mkdir(profileOf(home),{recursive:true})
      await writeFile(manifestOf(home),bytes)
      await launch(home,'A');await launch(home,'B')
      assert.equal(await readFile(manifestOf(home),'utf8'),bytes,'unknown existing files must never be repaired')
    }
    for(const scenario of ['deleted-manifest','legacy-missing','deleted-pending-manifest']) {
      const home=path.join(root,scenario)
      if(scenario==='legacy-missing') {
        await mkdir(profileOf(home),{recursive:true})
        await writeFile(receiptOf(home),JSON.stringify({schemaVersion:1,codeRoot:codes.A}))
      } else {
        await ok(home,'A')
        if(scenario==='deleted-pending-manifest') assert.equal((await launch(home,'B','manifest-renamed')).status,91)
        await rm(manifestOf(home))
      }
      if(scenario==='deleted-pending-manifest') {
        assert.equal((await launch(home,'C','seed-published')).status,94)
        const interrupted=JSON.parse(await readFile(receiptOf(home),'utf8'))
        assert.equal(interrupted.codeRoot,codes.C)
        assert.equal(interrupted.pending,undefined)
        assert.equal(JSON.parse(interrupted.seed).dependencies['dsh-nexttavern'],expected('C'))
      }
      await ok(home,'C')
      assert.equal((await readManifest(home)).dependencies['dsh-nexttavern'],expected('C'))
      await ok(home,'D')
      const manifest=await readManifest(home)
      assert.equal(manifest.dependencies['dsh-nexttavern'],expected('D'))
      assert.equal(manifest.pnpm.overrides['managed-override'],expected('D'))
      const receipt=JSON.parse(await readFile(receiptOf(home),'utf8'))
      assert.equal(receipt.codeRoot,codes.D)
      assert.equal(receipt.owned.dependencies['dsh-nexttavern'],expected('D'))
      assert.equal(receipt.owned.overrides['managed-override'],expected('D'))
    }
    const legacy=path.join(root,'legacy')
    await ok(legacy,'A')
    await writeFile(receiptOf(legacy),JSON.stringify({schemaVersion:1,codeRoot:codes.A}))
    await ok(legacy,'B')
    assert.equal((await readManifest(legacy)).dependencies['dsh-nexttavern'],expected('B'))
    assert.equal((await readManifest(legacy)).pnpm.overrides['managed-override'],expected('B'))
    const mixed=path.join(root,'legacy-mixed')
    await ok(mixed,'A')
    const legacyReceipt=JSON.stringify({schemaVersion:1,codeRoot:codes.A})
    await writeFile(receiptOf(mixed),legacyReceipt)
    const mixedManifest=await readManifest(mixed)
    mixedManifest.dependencies['dsh-nexttavern']=expected('B')
    await writeFile(manifestOf(mixed),JSON.stringify(mixedManifest))
    const blockedMixed=await launch(mixed,'C')
    assert.equal(blockedMixed.status,1)
    assert.match(blockedMixed.stderr,/ANDROID_PROFILE_MIGRATION_AMBIGUOUS/)
    assert.doesNotMatch(blockedMixed.stdout,/fixture-ready/)
    assert.equal(await readFile(receiptOf(mixed),'utf8'),legacyReceipt)
    assert.deepEqual(await readManifest(mixed),mixedManifest)
    assert.equal(await readlink(path.join(profileOf(mixed),'node_modules/dsh-nexttavern')),expected('A').slice(5))
    mixedManifest.dependencies['dsh-nexttavern']=expected('A')
    mixedManifest.pnpm.overrides['managed-override']=expected('B')
    await writeFile(manifestOf(mixed),JSON.stringify(mixedManifest))
    const blockedOverride=await launch(mixed,'C')
    assert.equal(blockedOverride.status,1);assert.match(blockedOverride.stderr,/ANDROID_PROFILE_MIGRATION_AMBIGUOUS/)
    assert.equal(await readFile(receiptOf(mixed),'utf8'),legacyReceipt)
    assert.deepEqual(await readManifest(mixed),mixedManifest)
    // External user changes are not this ambiguous version-slot pattern.
    mixedManifest.dependencies['dsh-nexttavern']='file:/user/selected-package'
    mixedManifest.dependencies['user-added']=expected('B')
    mixedManifest.pnpm.overrides['managed-override']='file:/user/selected-override'
    await writeFile(manifestOf(mixed),JSON.stringify(mixedManifest))
    await ok(mixed,'C')
    assert.deepEqual(await readManifest(mixed),mixedManifest)
    const unavailable=JSON.stringify({schemaVersion:1,codeRoot:path.join(root,'missing-old-code')})
    await writeFile(receiptOf(legacy),unavailable)
    const preserved=await readFile(manifestOf(legacy),'utf8')
    const blocked=await launch(legacy,'C')
    assert.equal(blocked.status,1);assert.match(blocked.stderr,/ANDROID_PROFILE_PROVENANCE_MISSING/)
    assert.equal(await readFile(receiptOf(legacy),'utf8'),unavailable)
    assert.equal(await readFile(manifestOf(legacy),'utf8'),preserved)
    for(const fault of ['native-unavailable','native-denied','native-success','native-collision']) {
      const home=path.join(root,fault)
      const result=await launch(home,'A',fault)
      const successful=fault==='native-success'||fault==='native-collision'
      assert.equal(result.status,successful?0:1,result.stderr)
      if(fault==='native-collision') {
        assert.match(result.stdout,/fixture-ready/)
        assert.equal(await readFile(manifestOf(home),'utf8'),collisionManifest)
        assert.equal(await readFile(path.join(profileOf(home),'cordis.patch.yml'),'utf8'),collisionPatch)
        assert.deepEqual(JSON.parse(await readFile(receiptOf(home),'utf8')).owned,{dependencies:{},overrides:{}})
      }
      if(!successful) {
        assert.equal(existsSync(receiptOf(home)),false)
        assert.doesNotMatch(result.stderr,/must not fall back/)
        await ok(home,'A')
      }
    }
    for(const bytes of ['', '{malformed', '{}', '{"schemaVersion":1}']) {
      const home=path.join(root,'unknown-receipt-'+bytes.length)
      await mkdir(profileOf(home),{recursive:true})
      await writeFile(receiptOf(home),bytes)
      assert.equal((await launch(home,'A')).status,1)
      assert.equal(await readFile(receiptOf(home),'utf8'),bytes)
      assert.equal(existsSync(manifestOf(home)),false)
    }
  } finally { await rm(root,{recursive:true,force:true}) }
})
