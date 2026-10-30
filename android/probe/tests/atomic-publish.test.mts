import assert from 'node:assert/strict';
import test from 'node:test';
import {loadAtomicPublisher} from '../atomic-publish.mts';
import {parseArgs} from '../run.mts';
import {REQUIRED_CAPABILITIES} from '../model.mts';
import type {ProbeMap} from '../model.mts';
import {runSuite} from '../runner.mts';
import {temporary} from './helpers.mts';

const fixturePath='/fixture/native/libnexttavern_flock.so';
async function binding<T>(run:()=>Promise<T>):Promise<T> {
  const old=process.env.NEXTTAVERN_FLOCK_ADDON;process.env.NEXTTAVERN_FLOCK_ADDON=fixturePath;
  try{return await run()}finally{if(old===undefined)delete process.env.NEXTTAVERN_FLOCK_ADDON;else process.env.NEXTTAVERN_FLOCK_ADDON=old}
}
test('publication callback is awaited; errno is not a successful publication',async()=>binding(async()=>{
  let done:((errno:number)=>void)|undefined;
  const publish=loadAtomicPublisher((module,path)=>{
    assert.equal(path,fixturePath);
    (module as NodeModule).exports={publishNoReplace:(source:string,target:string,callback:(errno:number)=>void)=>{
      assert.equal(source,'/staged');assert.equal(target,'/committed');done=callback;
    }};
  });
  let settled=false;const pending=publish('/staged','/committed').then(()=>{settled=true});
  await Promise.resolve();assert.equal(settled,false);done!(0);await pending;assert.equal(settled,true);
  const collision=publish('/staged','/committed');done!(17);await assert.rejects(collision,{code:'EEXIST',syscall:'renameat2'});
  const unavailable=publish('/staged','/committed');done!(38);await assert.rejects(unavailable,{code:'PUBLISH_UNAVAILABLE'});
  const invalid=publish('/staged','/committed');done!(-1);await assert.rejects(invalid,/Invalid native publication errno/);
}));
test('missing publication export is blocked without pretending flock adds it',async()=>binding(async()=>{
  assert.throws(()=>loadAtomicPublisher(module=>{(module as NodeModule).exports={tryLock(){}}}),{code:'ADDON_API_UNAVAILABLE'});
  assert.throws(()=>loadAtomicPublisher(()=>{throw new Error('fixture-load-error')}),{code:'ADDON_UNAVAILABLE'});
}));
test('atomic selection is explicit and never removes the old hard-link failure',async()=>temporary(async directory=>{
  assert.deepEqual(parseArgs(['--atomic-publish','--https-client']),{atomicPublish:true,httpsClient:true});
  assert.throws(()=>parseArgs(['--atomic-publish','--atomic-publish']),/Usage:/);
  assert.throws(()=>parseArgs(['--atomic-publish','true']),/Usage:/);
  let calls=0;
  const probes=Object.fromEntries(REQUIRED_CAPABILITIES.map(id=>[id,async()=>({fixture:id})])) as ProbeMap;
  probes['https-client']=async()=>({status:200,authorized:true,tlsVersion:'TLSv1.3'});
  probes['android-atomic-no-clobber']=async()=>{calls++;return{fixture:true}};
  assert.equal((await runSuite({probes,workRoot:directory})).checks.length,10);assert.equal(calls,0);
  assert.equal((await runSuite({probes,workRoot:directory,httpsClient:true})).checks.length,11);assert.equal(calls,0);
  probes['hardlink-no-clobber']=async()=>{throw Object.assign(new Error('fixture Android policy denial'),{code:'EACCES'})};
  const selected=await runSuite({probes,workRoot:directory,httpsClient:true,atomicPublish:true});
  assert.equal(calls,1);assert.equal(selected.checks.length,12);
  assert.deepEqual(selected.checks.slice(0,10).map(row=>row.id),REQUIRED_CAPABILITIES);
  assert.equal(selected.checks[10].id,'https-client');assert.equal(selected.checks[11].id,'android-atomic-no-clobber');
  assert.equal(selected.checks[5].status,'failed');assert.equal(selected.status,'failed');assert.equal(selected.androidGate,false);
}));
