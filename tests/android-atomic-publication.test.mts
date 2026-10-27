/** Product adapter tests; a Linux native fixture is not Android acceptance. */
import assert from 'node:assert/strict'
import test from 'node:test'
import {execFile} from 'node:child_process'
import fs,{existsSync} from 'node:fs'
import {open,readFile} from 'node:fs/promises'
import {registerHooks,syncBuiltinESMExports} from 'node:module'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import {createTestDirectory,cleanupTestDirectory} from '../src/operations/test-temp.mts'

const packages=existsSync(new URL('../compat/node-addon-system/package.json',import.meta.url))?'../compat/':'../development/'
const sources=new URL(packages+'node-addon-system/src/',import.meta.url)
const repo=new URL(packages==='../compat/'?'../../../':'../',import.meta.url)
const testAddon=process.env.NEXTTAVERN_TEST_SYSTEM_ADDON??fileURLToPath(new URL('android/artifacts/native-system-host/x64/native-system.node',repo))
const role=process.argv[2]==='--atomic-case'?process.argv[3]:undefined

async function childCase(mode:string) {
  const hooks=registerHooks({resolve(specifier,context,nextResolve){
    if(specifier==='@deepseek-ai/node-addon-system/atomic')return {url:new URL('atomic.ts',sources).href,shortCircuit:true}
    if(specifier==='./android-binding.js'&&context.parentURL?.startsWith(sources.href))return {url:new URL('android-binding.ts',sources).href,shortCircuit:true}
    return nextResolve(specifier,context)
  }})
  try {
    const {publishNoReplace}=await import(new URL('atomic.ts',sources).href)
    if(mode==='desktop') {
      await assert.rejects(publishNoReplace('source','target'),{code:'ERR_ATOMIC_PUBLISH_UNSUPPORTED_PLATFORM'})
    }else{
      Object.defineProperty(process,'platform',{value:'android'}) // Test-only dispatch; the actual kernel stays Linux.
      if(mode==='callback') {
        let loads=0,callback:((errno:number)=>void)|undefined
        process.env.NEXTTAVERN_FLOCK_ADDON='test-only-callback-binding'
        process.dlopen=module=>{loads++;module.exports={
          tryLock(_fd:number,done:(errno:number)=>void){queueMicrotask(()=>done(0))},
          publishNoReplace(_source:string,_target:string,done:(errno:number)=>void){callback=done},
        }}
        let settled=false
        const pending=publishNoReplace('source','target').then(()=>{settled=true})
        await Promise.resolve();assert.equal(settled,false)
        const {tryLockExclusive}=await import(new URL('flock.ts',sources).href)
        await tryLockExclusive(42);assert.equal(loads,1,'flock and publication share the same binding owner')
        callback!(0);await pending
        for(const [errno,code] of [[17,'EEXIST'],[38,'ENOSYS']] as const){
          const failed=publishNoReplace('source','target');callback!(errno)
          await assert.rejects(failed,{code,errno,syscall:'renameat2'})
        }
      }else if(mode==='card-export') {
        assert.ok(existsSync(testAddon),'BLOCKED: prepare build-flock.mts --host-test fixture')
        process.env.NEXTTAVERN_FLOCK_ADDON=testAddon
        const originalSync=fs.fsyncSync
        let directorySyncs=0
        fs.fsyncSync=fd=>{if(fs.fstatSync(fd).isDirectory())directorySyncs++;originalSync(fd)}
        syncBuiltinESMExports()
        try{
          const {registerCardExport}=await import(new URL('../lib/core/card-export.js',import.meta.url).href)
          const tools=new Map<string,{execute(args:Record<string,unknown>,exec:unknown):Promise<Record<string,any>>}>(),table=new Map()
          const session={id:'synthetic-android-export',header:{cwd:process.cwd()}}
          registerCardExport({effect:(setup:()=>unknown)=>setup(),tools:{register:(tool:{name:string;execute:any})=>tools.set(tool.name,tool)}},{
            simpleTool:(name:string,_description:string,_parameters:unknown,execute:any)=>({name,execute}),sessionOf:()=>session,
            table:{get:(key:string)=>table.get(key),entries:()=>table.entries(),put:(key:string,value:unknown)=>table.set(key,value)},
            collect:()=>[{label:'synthetic',source:'synthetic.source',text:'exact synthetic export bytes'}],
            lock:(_session:string,_name:string,work:()=>unknown)=>work(),
          })
          const run=(name:string,args:Record<string,unknown>)=>tools.get('rp_card_export_'+name)!.execute(args,{agent:{session}})
          const begun=await run('begin',{})
          await run('chunk',{export_id:begun.exportId,cursor:0})
          const submit={export_id:begun.exportId,expected_sha256:begun.sourceHash,title:'Synthetic export',
            sections:[{heading:'Source',source_ids:begun.sources.map((row:{id:string})=>row.id)}]}
          const done=await run('finalize',submit);assert.equal(done.ok,true)
          const content=await readFile(done.file,'utf8');assert.ok(content.includes('exact synthetic export bytes'))
          assert.equal((await run('finalize',submit)).ok,true,'same bytes deduplicate without overwriting')
          fs.writeFileSync(done.file,'existing different export')
          const refused=await run('finalize',submit);assert.equal(refused.ok,false)
          assert.equal(await readFile(done.file,'utf8'),'existing different export')
          assert.ok(directorySyncs>=2,'the real Android branch fsyncs its anchored directory before success')
          assert.ok(fs.readdirSync(join(process.cwd(),'.dsh-card-exports')).every(name=>!name.endsWith('.tmp')))
        }finally{fs.fsyncSync=originalSync;syncBuiltinESMExports()}
      }else if(mode==='native') {
        const addon=process.env.NEXTTAVERN_TEST_SYSTEM_ADDON
        assert.ok(addon&&existsSync(addon),'BLOCKED: prepare the native-system fixture with build-flock.mts --host-test; no no-op fallback')
        process.env.NEXTTAVERN_FLOCK_ADDON=addon
        const stage=async(name:string,text:string)=>{const file=join(process.cwd(),name),fd=await open(file,'wx');try{await fd.writeFile(text);await fd.sync()}finally{await fd.close()}return file}
        const target=join(process.cwd(),'target'),first=await stage('first','first immutable bytes')
        await publishNoReplace(first,target)
        assert.equal(existsSync(first),false);assert.equal(await readFile(target,'utf8'),'first immutable bytes')
        const loser=await stage('loser','do not overwrite')
        await assert.rejects(publishNoReplace(loser,target),{code:'EEXIST',syscall:'renameat2'})
        assert.equal(await readFile(loser,'utf8'),'do not overwrite');assert.equal(await readFile(target,'utf8'),'first immutable bytes')
        const a=await stage('race-a','A'),b=await stage('race-b','B'),race=join(process.cwd(),'race')
        const outcomes=await Promise.allSettled([publishNoReplace(a,race),publishNoReplace(b,race)])
        assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1)
        assert.equal(outcomes.filter(row=>row.status==='rejected'&&row.reason.code==='EEXIST').length,1)
        assert.ok(['A','B'].includes(await readFile(race,'utf8')))
        assert.notEqual(existsSync(a),existsSync(b))
        const directory=await open(process.cwd(),'r');try{await directory.sync()}finally{await directory.close()}
      }else throw Error('Unknown atomic fixture mode')
    }
    process.stdout.write(JSON.stringify({mode,passed:true,actualAndroidEvidence:false})+'\n')
  }finally{hooks.deregister()}
}

async function runCase(mode:string) {
  const directory=createTestDirectory('android-atomic-owner-')
  try{
    const {stdout}=await promisify(execFile)(process.execPath,[fileURLToPath(import.meta.url),'--atomic-case',mode],{
      cwd:directory,env:{...process.env,NEXTTAVERN_TEST_SYSTEM_ADDON:testAddon},timeout:10000,
    })
    assert.deepEqual(JSON.parse(stdout),{mode,passed:true,actualAndroidEvidence:false})
  }finally{cleanupTestDirectory(directory)}
}
if(role)await childCase(role)
else{
  test('managed Android adapter shares binding, awaits callback and preserves EEXIST/ENOSYS',()=>runCase('callback'))
  test('desktop publication is explicitly unsupported without changing desktop flock', {skip:process.platform==='android'},()=>runCase('desktop'))
  test('real Linux native fixture consumes only the winner and never clobbers an existing destination', {skip:process.platform!=='linux'},()=>runCase('native'))
  test('actual card-export owner awaits native publication, preserves collisions and fsyncs its Android directory', {skip:process.platform!=='linux'},()=>runCase('card-export'))
}
