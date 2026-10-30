/** Real POSIX directory fsync with a tiny copied fork, never a second Harness/profile. */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {syncBuiltinESMExports,registerHooks} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createTestDirectory,cleanupTestDirectory} from '../src/operations/test-temp.mts'

const fork = fileURLToPath(new URL(fs.existsSync(new URL('../compat/attachment-local/package.json',import.meta.url))
  ? '../compat/attachment-local/' : '../development/attachment-local/',import.meta.url))
const libraries = fileURLToPath(new URL('../build-tools/node_modules/',import.meta.url))
const posix = process.platform !== 'win32'
const systemSources = new URL(fs.existsSync(new URL('../compat/node-addon-system/package.json',import.meta.url))
  ?'../compat/node-addon-system/src/':'../development/node-addon-system/src/',import.meta.url)
const repo = new URL(fs.existsSync(new URL('../compat/node-addon-system/package.json',import.meta.url))?'../../../':'../',import.meta.url)
const testAddon = process.env.NEXTTAVERN_TEST_SYSTEM_ADDON??fileURLToPath(new URL('android/artifacts/native-system-host/x64/native-system.node',repo))
interface FixtureOptions {
  platform?: 'android' | 'linux'
  boundary?: 'missing' | 'relative' | 'root'
  home?: 'outside' | 'sibling-prefix' | 'equal'
  failBoundaryOnce?: boolean
  holdFirstBoundarySync?: boolean
}
async function fixture(t:test.TestContext,options:FixtureOptions={}) {
  if(options.platform!=='linux')assert.ok(fs.existsSync(testAddon),
    'BLOCKED: run build-flock.mts --host-test with the prepared runtime cache; real native fixture required')
  const directory=createTestDirectory('attachment-android-boundary-')
  const dataDir=path.join(directory,'application-data')
  fs.mkdirSync(path.join(dataDir,'files'),{recursive:true,mode:0o750})
  fs.chmodSync(dataDir,0o750)
  const home=options.home==='equal'?dataDir:options.home==='outside'?path.join(directory,'outside','home')
    :options.home==='sibling-prefix'?dataDir+'-sibling/home':path.join(dataDir,'files','home')
  const root=path.join(home,'attachments','v1')
  const copy=path.join(directory,'fork')
  fs.mkdirSync(copy)
  fs.cpSync(path.join(fork,'lib'),path.join(copy,'lib'),{recursive:true})
  fs.copyFileSync(path.join(fork,'package.json'),path.join(copy,'package.json'))
  fs.symlinkSync(libraries,path.join(directory,'node_modules'),'junction')
  const platform=Object.getOwnPropertyDescriptor(process,'platform')!
  const previous=process.env.NEXTTAVERN_ANDROID_DATA_DIR
  const previousAddon=process.env.NEXTTAVERN_FLOCK_ADDON
  if(options.platform!=='linux') {
    process.env.NEXTTAVERN_FLOCK_ADDON=testAddon
  }
  const hooks=registerHooks({resolve(specifier,context,nextResolve){
    if(specifier==='@deepseek-ai/node-addon-system/atomic')return {url:new URL('atomic.ts',systemSources).href,shortCircuit:true}
    if(specifier==='./android-binding.js'&&context.parentURL?.startsWith(systemSources.href))return {url:new URL('android-binding.ts',systemSources).href,shortCircuit:true}
    return nextResolve(specifier,context)
  }})
  Object.defineProperty(process,'platform',{...platform,value:options.platform??'android'})
  if(options.boundary==='missing')delete process.env.NEXTTAVERN_ANDROID_DATA_DIR
  else process.env.NEXTTAVERN_ANDROID_DATA_DIR=options.boundary==='relative'?'relative-data-dir'
    :options.boundary==='root'?path.parse(dataDir).root:dataDir
  const original=fs.promises.open
  const opened:string[]=[],synced:string[]=[]
  let failed=false,held=false,release=()=>{},reached=()=>{}
  const hold=new Promise<void>(resolve=>{release=resolve})
  const firstHeld=new Promise<void>(resolve=>{reached=resolve})
  fs.promises.open=async(...args:Parameters<typeof original>)=>{
    const name=typeof args[0]==='string'?path.resolve(args[0]):undefined
    if(name && args[1]===fs.constants.O_RDONLY) {
      opened.push(name)
      if(options.platform!=='linux' && name!==dataDir && !name.startsWith(dataDir+path.sep)) {
        throw Object.assign(new Error('test forbids opening an Android ancestor outside its boundary'),{code:'EACCES'})
      }
    }
    const handle=await original(...args)
    if((await handle.stat()).isDirectory()) {
      const realSync=handle.sync.bind(handle)
      handle.sync=async()=>{
        if(name===dataDir && options.failBoundaryOnce && !failed) {
          failed=true
          throw Object.assign(new Error('injected directory fsync denial'),{code:'EACCES'})
        }
        if(name===dataDir && options.holdFirstBoundarySync && !held) {
          held=true;reached();await hold
        }
        await realSync() // Successful evidence always performs the real filesystem syscall.
        if(name)synced.push(name)
      }
    }
    return handle
  }
  syncBuiltinESMExports()
  t.after(()=>{
    release()
    fs.promises.open=original;syncBuiltinESMExports()
    hooks.deregister()
    Object.defineProperty(process,'platform',platform)
    if(previous===undefined)delete process.env.NEXTTAVERN_ANDROID_DATA_DIR
    else process.env.NEXTTAVERN_ANDROID_DATA_DIR=previous
    if(previousAddon===undefined)delete process.env.NEXTTAVERN_FLOCK_ADDON
    else process.env.NEXTTAVERN_FLOCK_ADDON=previousAddon
    cleanupTestDirectory(directory)
  })
  const store=await import(pathToFileURL(path.join(copy,'lib/file-store.js')).href) as {
    saveFileVerbatim(root:string,input:{name:string;data:Uint8Array}):Promise<{attachmentId:string;name:string;bytes:number}>
    storedFilePath(root:string,ref:unknown):string
  }
  const publication=await import(pathToFileURL(path.join(copy,'lib/store.js')).href) as {
    publishImmutableAlias(root:string,source:string,target:string,sha256:string):Promise<void>
  }
  const save=(text='synthetic card bytes')=>store.saveFileVerbatim(root,{name:'card.json',data:Buffer.from(text)})
  return {directory,dataDir,home,root,opened,synced,save,store,publication,firstHeld,release}
}

test('Android fsync persists every private parent through installer dataDir, never its parent', {skip:!posix},async t=>{
  const f=await fixture(t)
  const ref=await f.save()
  assert.equal(fs.readFileSync(f.store.storedFilePath(f.root,ref),'utf8'),'synthetic card bytes')
  for(const required of [f.dataDir,path.join(f.dataDir,'files'),f.home,path.join(f.home,'attachments'),f.root,path.dirname(f.store.storedFilePath(f.root,ref))]) {
    assert.ok(f.synced.includes(required),`real directory fsync missing for ${path.basename(required)}`)
  }
  assert.ok(f.opened.every(p=>p===f.dataDir||p.startsWith(f.dataDir+path.sep)))
  assert.equal(fs.statSync(f.dataDir).mode&0o777,0o750,'installer boundary mode is not changed')
  assert.equal(fs.statSync(path.join(f.dataDir,'files')).mode&0o777,0o750,'existing private parent mode is not changed')
  // The native launch value is captured once: a later env mutation cannot
  // silently change what the already-established durableHomes proof means.
  process.env.NEXTTAVERN_ANDROID_DATA_DIR=path.dirname(f.dataDir)
  await f.store.saveFileVerbatim(path.join(f.dataDir,'files','another-home','attachments','v1'),
    {name:'second.json',data:Buffer.from('second immutable object')})
  assert.ok(f.opened.every(p=>p===f.dataDir||p.startsWith(f.dataDir+path.sep)))
})

test('Android immutable aliases preserve their source and reject corrupt existing targets after real no-clobber races', {skip:!posix},async t=>{
  const f=await fixture(t)
  const [first,second]=await Promise.all([f.save(),f.save()])
  assert.deepEqual(first,second)
  const sha=first.attachmentId.slice('sha256:'.length)
  const source=path.join(f.root,'file-objects',sha.slice(0,2),sha)
  const target=f.store.storedFilePath(f.root,first)
  assert.equal(fs.readFileSync(source,'utf8'),'synthetic card bytes')
  assert.equal(fs.readFileSync(target,'utf8'),'synthetic card bytes')
  assert.notEqual(fs.statSync(source).ino,fs.statSync(target).ino,'an Android alias is a durable copy, never a moved source or forbidden hard link')
  fs.chmodSync(target,0o600);fs.writeFileSync(target,'existing different bytes')
  await assert.rejects(f.save(),(error:unknown)=>(error as {code?:string}).code==='ATTACHMENT_CORRUPT')
  assert.equal(fs.readFileSync(target,'utf8'),'existing different bytes','EEXIST cannot clobber the winner')
  assert.equal(fs.readFileSync(source,'utf8'),'synthetic card bytes','a failed alias cannot damage its immutable source')
  assert.deepEqual(fs.readdirSync(path.join(f.root,'tmp')),[])
})

test('an Android alias stage-open failure never opens an unconsumed source stream', {skip:!posix},async t=>{
  const f=await fixture(t),ref=await f.save(),sha=ref.attachmentId.slice('sha256:'.length)
  const source=path.join(f.root,'file-objects',sha.slice(0,2),sha)
  const target=path.join(path.dirname(f.store.storedFilePath(f.root,ref)),'second-name.json')
  const originalOpen=fs.promises.open,originalStream=fs.createReadStream
  let sourceStreams=0
  fs.promises.open=async(...args:Parameters<typeof originalOpen>)=>{
    if(typeof args[0]==='string'&&args[0].startsWith(path.join(f.root,'tmp')+path.sep)
      &&typeof args[1]==='number'&&(args[1]&fs.constants.O_CREAT))throw Object.assign(Error('injected stage-open denial'),{code:'EACCES'})
    return originalOpen(...args)
  }
  fs.createReadStream=(...args:Parameters<typeof originalStream>)=>{sourceStreams++;return originalStream(...args)}
  syncBuiltinESMExports()
  try{
    await assert.rejects(f.publication.publishImmutableAlias(f.root,source,target,sha),
      (error:unknown)=>(error as {code?:string}).code==='ATTACHMENT_WRITE_FAILED')
    assert.equal(sourceStreams,0)
    assert.equal(fs.readFileSync(source,'utf8'),'synthetic card bytes')
    assert.equal(fs.existsSync(target),false)
  }finally{fs.promises.open=originalOpen;fs.createReadStream=originalStream;syncBuiltinESMExports()}
})

test('Android rejects missing/relative/root boundary and outside/equal homes before creating storage', {skip:!posix},async t=>{
  for(const options of [{boundary:'missing'},{boundary:'relative'},{boundary:'root'},
    {home:'outside'},{home:'sibling-prefix'},{home:'equal'}] as FixtureOptions[]) {
    await t.test(JSON.stringify(options),async st=>{
      const f=await fixture(st,options)
      await assert.rejects(f.save(),(error:unknown)=>(error as {code?:string}).code==='ATTACHMENT_WRITE_FAILED')
      assert.equal(f.opened.length,0)
      assert.equal(fs.existsSync(f.root),false)
    })
  }
})

test('directory fsync EACCES remains visible and a failed home proof is not cached', {skip:!posix},async t=>{
  const f=await fixture(t,{failBoundaryOnce:true})
  await assert.rejects(f.save(),(error:unknown)=>(error as {code?:string}).code==='EACCES')
  assert.equal(fs.existsSync(path.join(f.root,'tmp')),false,'no temporary upload is published before home proof')
  assert.equal(f.synced.includes(f.dataDir),false)
  const ref=await f.save()
  assert.ok(f.synced.includes(f.dataDir),'same process retries the real failed boundary sync')
  assert.equal(fs.readFileSync(f.store.storedFilePath(f.root,ref),'utf8'),'synthetic card bytes')
})

test('concurrent first save cannot treat another writer pending boundary sync as durable', {skip:!posix,timeout:15000},async t=>{
  const f=await fixture(t,{holdFirstBoundarySync:true})
  const first=f.save('first concurrent card')
  await f.firstHeld
  try {
    const second=await f.save('second concurrent card')
    assert.ok(f.synced.includes(f.dataDir),'second writer must finish its own real boundary sync')
    assert.equal(fs.readFileSync(f.store.storedFilePath(f.root,second),'utf8'),'second concurrent card')
  }finally{f.release()}
  const ref=await first
  assert.equal(fs.readFileSync(f.store.storedFilePath(f.root,ref),'utf8'),'first concurrent card')
})

test('desktop ignores Android environment and retains the upstream fsync walk through filesystem root', {skip:!posix},async t=>{
  const f=await fixture(t,{platform:'linux'})
  const ref=await f.save()
  assert.ok(f.synced.includes(path.dirname(f.dataDir)))
  assert.ok(f.synced.includes(path.parse(f.home).root))
  assert.equal(fs.readFileSync(f.store.storedFilePath(f.root,ref),'utf8'),'synthetic card bytes')
})
