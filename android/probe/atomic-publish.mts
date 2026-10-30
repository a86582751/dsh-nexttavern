/** Separate Android publication evidence; never relabel a failed hard-link check. */
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {mkdir,open,readFile,stat} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {getSystemErrorName} from 'node:util';
import {BlockedError} from './model.mts';
import type {Probe} from './model.mts';
import {ChildSession} from './process-helper.mts';

export function loadAtomicPublisher(load:typeof process.dlopen=process.dlopen): (source:string,target:string)=>Promise<void> {
  const path=process.env.NEXTTAVERN_FLOCK_ADDON;
  if(!path||!isAbsolute(path))throw new BlockedError('ADDON_PATH_INVALID','Atomic publication requires the explicit native-system binding');
  const native:{exports:{publishNoReplace?:(source:string,target:string,callback:(errno:number)=>void)=>void}}={exports:{}};
  try{load(native as NodeModule,path)}catch{throw new BlockedError('ADDON_UNAVAILABLE','Cannot load native-system publication binding')}
  if(typeof native.exports.publishNoReplace!=='function')throw new BlockedError('ADDON_API_UNAVAILABLE','Native-system does not export publishNoReplace');
  return async(source,target)=>{
    // Do not race an abort against this irreversible operation: settlement
    // reports its actual result. The caller owns durability and stage cleanup.
    const errno=await new Promise<number>(resolve=>native.exports.publishNoReplace!(source,target,resolve));
    if(!Number.isInteger(errno)||errno<0)throw new Error('Invalid native publication errno');
    if(errno===0)return;
    const code=getSystemErrorName(-errno);
    if(code==='ENOSYS')throw new BlockedError('PUBLISH_UNAVAILABLE','Public Bionic renameat2 requires API30+');
    throw Object.assign(new Error(`${code}: atomic no-replace publication failed`),{code,errno,syscall:'renameat2'});
  };
}
export async function syncPublicationDirectory(directory:string):Promise<void> {
  const handle=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);
  try{await handle.sync()}finally{await handle.close()}
}
export const checkAtomicPublish:Probe=async({directory,signal})=>{
  const publish=loadAtomicPublisher();
  const root=join(directory,'atomic-publish'),staging=join(root,'staging'),committed=join(root,'committed');
  await mkdir(staging,{recursive:true,mode:0o700});await mkdir(committed,{mode:0o700});
  await syncPublicationDirectory(root);
  // Like flock's preflight, invoke the binding in this process so an absent
  // API30 public symbol stays explicitly BLOCKED, not an opaque child exit.
  const preflight=join(staging,'preflight'),handle=await open(preflight,'wx',0o600);
  try{await handle.writeFile('availability\n');await handle.sync()}finally{await handle.close()}
  await publish(preflight,join(committed,'preflight'));
  await syncPublicationDirectory(staging);await syncPublicationDirectory(committed);
  const target=join(committed,'published');
  const children=['a','b'].map(id=>new ChildSession('atomic-racer',[staging,target,id],signal));
  try {
    const ready=await Promise.all(children.map(child=>child.receive('ready')));
    await Promise.all(children.map(child=>child.send({kind:'race-start'})));
    const results=await Promise.all(children.map(child=>child.receive('race-result')));
    assert.equal(results.filter(result=>result.won===true).length,1);
    assert.equal(results.filter(result=>result.won===false&&result.code==='EEXIST').length,1);
    const winner=results.find(result=>result.won===true)!,loser=results.find(result=>result.won===false)!;
    assert.equal(winner.sourceDirectoryFsync,true);assert.equal(winner.targetDirectoryFsync,true);
    for(const child of children)assert.deepEqual(await child.exited,{code:0,signal:null});
    const source=join(staging,`candidate-${winner.id}`),remaining=join(staging,`candidate-${loser.id}`);
    await assert.rejects(stat(source),{code:'ENOENT'});
    const bytes=`writer-${winner.id}\n`;assert.equal(await readFile(target,'utf8'),bytes);
    const info=await stat(target,{bigint:true}),original=ready.find(row=>row.id===winner.id)!;
    assert.equal(String(info.ino),original.inode);assert.equal(String(info.dev),original.device);
    await assert.rejects(publish(remaining,target),{code:'EEXIST'});
    assert.equal(await readFile(target,'utf8'),bytes);
    assert.equal(await readFile(remaining,'utf8'),`writer-${loser.id}\n`);
    const crashTarget=join(committed,'crash-published');
    const committer=new ChildSession('atomic-committer',[staging,crashTarget,'crash'],signal);
    try {
      await committer.receive('ready');await committer.send({kind:'race-start'});
      const commit=await committer.receive('committed');
      assert.equal(commit.sourceDirectoryFsync,true);assert.equal(commit.targetDirectoryFsync,true);
      assert.equal(committer.child.kill('SIGKILL'),true);
      assert.equal((await committer.exited).signal,'SIGKILL');
    }finally{await committer.close()}
    const reader=new ChildSession('atomic-reader',[target,bytes,crashTarget,'writer-crash\n'],signal);
    try {
      const read=await reader.receive('verified');
      assert.equal(read.contentVerified,true);assert.equal(read.crashContentVerified,true);assert.equal(read.inode,String(info.ino));
      assert.deepEqual(await reader.exited,{code:0,signal:null});
    }finally{await reader.close()}
    return{primitive:'renameat2(RENAME_NOREPLACE)',contenders:2,winners:1,loserCode:'EEXIST',
      sourceConsumed:true,existingTargetUnchanged:true,fileFsync:true,sourceDirectoryFsync:true,targetDirectoryFsync:true,
      sameInodeAndDevice:true,separateProcessRestartRead:true,committedPublisherTermination:'SIGKILL',crashReadVerified:true,powerLossTest:false,hardlinkCapability:'not replaced or accepted'};
  }finally{await Promise.all(children.map(child=>child.close()))}
};
