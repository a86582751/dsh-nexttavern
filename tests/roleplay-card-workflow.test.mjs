import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { testTempRoot } from '../lib/operations/test-temp.mjs'
import { createCardWorkflows } from '../lib/core/roleplay-card-workflow.js'
import {InlinePending} from '../lib/core/tavern-tasks.js'
import {freezeNativeCardConversionV1,materializeNativeCardConversionV1} from '../lib/core/native-card-conversion.js'
import {installSchemaTestDependencies} from './mvu-schema-test-dependencies-fixture.mts'
import {installMvuNativeDataTestDependencies} from './mvu-native-data-test-dependencies-fixture.mts'

const hashBytes=bytes=>createHash('sha256').update(bytes).digest('hex')
const deferred=()=>Promise.withResolvers()
function exportFixture(workspace,overrides={}) {
  const branch=new Map()
  branch.put=async(key,value)=>{branch.set(key,structuredClone(value))}
  const calls={capture:0,assertCurrent:0,resolve:0,native:0,steer:0}
  const session={id:'workflow-export-data',header:{cwd:workspace,agentPreset:'roleplay'}}
  const selection={execution:'spawn',main:{provider:'fixture',model:'main'},
    actualRoute:{provider:'fixture',model:'exporter'}}
  const sha256='a'.repeat(64)
  const deps={
    T:{branch,opening:{get:()=>({text:'Synthetic opening'})}},storyBranchIsActive:()=>true,
    modelPolicy:{resolve:()=>{calls.resolve++;return selection}},
    statusFixedContext:()=>{throw Error('strict story Source reader must not supply export startup DATA')},
    captureExportStartSource:()=>{calls.capture++;return {sha256,assertCurrent(){calls.assertCurrent++}}},
    nativeTask:async options=>{calls.native++;assert.equal(JSON.parse(options.user).sha256,sha256);return {resourceId:'export'}},
    driveStructuredImport:()=>{throw Error('export must not use import driver')},
    CARD_CLASSIFICATION_GUIDE:'',archiveImported:async()=>null,libraryFor:()=>({}),resourceName:()=>'',
    tavernTasks:{pending:()=>[],submit:async()=>{}},
    taskAgents:new Map([[session.id,{steer(){calls.steer++}}]]),ctx:{sessionController:{}},
    ...overrides,
  }
  const workflows=createCardWorkflows(deps)
  const beginExport=()=>workflows.beginCardWorkflow(session,'card-export',undefined,undefined,undefined,undefined,'organized')
  return {branch,calls,session,selection,sha256,deps,workflows,beginExport}
}

const workspace=mkdtempSync(join(testTempRoot(),'dsh-card-workflow-'))
const removeDependencies=installSchemaTestDependencies()
let removeNativeDependencies
try {
  removeNativeDependencies=await installMvuNativeDataTestDependencies()
  const {driveNativeCardConversionV1}=await import('../lib/core/native-card-conversion-driver.js')
  writeFileSync(join(workspace,'card.json'),JSON.stringify({name:'Concurrent'}))
  const branch=new Map()
  branch.put=async(key,value)=>{branch.set(key,structuredClone(value))}
  let entered,release
  const started=new Promise(resolve=>{entered=resolve})
  const held=new Promise(resolve=>{release=resolve})
  let drives=0
  let steers=0
  const agent={steer:()=>{steers++}}
  const session={id:'workflow-singleflight',header:{cwd:workspace,agentPreset:'roleplay'}}
  const workflows=createCardWorkflows({
    T:{branch,opening:{get:()=>({text:'Synthetic opening'})}},storyBranchIsActive:()=>true,
    modelPolicy:{resolve:()=>{throw new Error('structured card must not resolve a model')}},
    captureExportStartSource:()=>{throw new Error('import must hash its own file bytes')},
    statusFixedContext:()=>({}),nativeTask:()=>{throw new Error('structured card must not start nativeTask')},
    driveStructuredImport:async(_session,job)=>{
      drives++
      if(job.source.sourceFile.endsWith('bad.json'))throw new Error('synthetic import failure')
      entered();await held;return {importId:'one',resourceId:'one'}
    },
    CARD_CLASSIFICATION_GUIDE:'',archiveImported:async()=>null,libraryFor:()=>({}),resourceName:()=>'',
    tavernTasks:{pending:()=>[],submit:async()=>{}},taskAgents:new Map([[session.id,agent]]),ctx:{sessionController:{}},
  })
  const job=await workflows.beginCardWorkflow(session,'card-import','card.json',agent,'first-request')
  assert.equal(job.execution,'deterministic')
  assert.equal(job.source.sha256,hashBytes(Buffer.from(JSON.stringify({name:'Concurrent'}))),
    'import startup still hashes original file bytes')
  await assert.rejects(workflows.beginCardWorkflow(session,'card-import','card.json',agent,'other-request'),
    /不同 requestId/)
  const first=workflows.resumeCardWorkflows(session)
  await started
  const second=workflows.resumeCardWorkflows(session)
  release()
  await Promise.all([first,second])
  assert.equal(drives,1,'UI and main-loop resume share one durable generation driver')
  assert.equal(branch.get(workflows.cardWorkflowKey(job.id)).status,'completed')
  await workflows.resumeCardWorkflows(session)
  assert.equal(drives,1,'completed job does not execute again')
  await workflows.completeCardWorkflow(session,{workflowId:job.id,importId:'one',status:'active',
    rawSha256:job.source.sha256},{resourceId:'one'})
  assert.equal(steers,0,'structured import waits for a native player opening choice')
  const replay=await workflows.beginCardWorkflow(session,'card-import','card.json',agent,'first-request')
  assert.equal(replay.id,job.id,'completed request reuses its durable job')
  assert.equal([...branch.values()].filter(row=>row?.kind==='card-import').length,1)
  writeFileSync(join(workspace,'bad.json'),JSON.stringify({name:'Synthetic failure'}))
  const failed=await workflows.beginCardWorkflow(session,'card-import','bad.json',agent,'failed-request')
  await workflows.resumeCardWorkflows(session)
  assert.equal(branch.get(workflows.cardWorkflowKey(failed.id)).status,'failed')
  assert.ok(branch.get(workflows.cardWorkflowKey(failed.id)).failedAt)
  assert.equal((await workflows.beginCardWorkflow(session,'card-import','bad.json',agent,'failed-request')).id,
    failed.id,'failed request retains its identity')
  await assert.rejects(workflows.beginCardWorkflow(session,'card-import','card.json',agent,'failed-request'),
    /绑定不同来源/)
  const concurrent=await Promise.all([1,2].map(()=>workflows.beginCardWorkflow(
    session,'card-import','card.json',agent,'concurrent-request')))
  assert.equal(concurrent[0].id,concurrent[1].id,'concurrent starts share one stored identity')

  {
    const f=exportFixture(workspace)
    const exported=await f.beginExport()
    assert.equal(exported.source.sha256,f.sha256,'export uses captured edit DATA, independent of strict story Source')
    assert.equal(exported.source.sourceFile,null)
    assert.equal(f.calls.capture,1)
    assert.ok(f.calls.assertCurrent>0,'export startup validates its captured DATA')
    await f.workflows.resumeCardWorkflows(f.session)
    assert.equal(f.calls.native,1)
    assert.equal(f.calls.steer,0)
    assert.equal(f.branch.get(f.workflows.cardWorkflowKey(exported.id)).status,'completed')
  }
  {
    const f=exportFixture(workspace,{captureExportStartSource:undefined,statusFixedContext:()=>({legacy:'caller'})})
    const exported=await f.beginExport()
    assert.equal(exported.source.sha256,hashBytes(JSON.stringify({legacy:'caller'})),
      'pure callers without the new capture interface retain their old startup DATA dependency')
  }
  for(const invalid of [undefined,{sha256:'not-a-hash',assertCurrent(){}},{sha256:'a'.repeat(64)}]) {
    const f=exportFixture(workspace,{captureExportStartSource:()=>invalid})
    await assert.rejects(f.beginExport(),/导出启动来源无效/)
    assert.equal(f.branch.size,0,'invalid captures cannot create a startup job')
    assert.equal(f.calls.resolve,0)
  }
  for(const changed of ['source','scope']) {
    const entered=deferred(),release=deferred(),state={source:0,scope:0}
    const f=exportFixture(workspace,{
      captureExportStartSource:()=>{
        const before={...state}
        return {sha256:'a'.repeat(64),assertCurrent(){
          if(state.source!==before.source||state.scope!==before.scope)throw Error('EXPORT_START_SOURCE_CHANGED')
        }}
      },
      modelPolicy:{resolve:async()=>{entered.resolve();await release.promise;return f.selection}},
    })
    const begin=f.beginExport()
    const rejected=assert.rejects(begin,/EXPORT_START_SOURCE_CHANGED/)
    await entered.promise
    state[changed]++
    release.resolve()
    await rejected
    await f.workflows.resumeCardWorkflows(f.session)
    assert.equal(f.branch.size,0,`${changed} change during model resolution cannot perform the first job write`)
    assert.equal(f.calls.native,0)
    assert.equal(f.calls.steer,0)
  }
  {
    const entered=deferred(),release=deferred()
    let current=true,original
    const f=exportFixture(workspace,{captureExportStartSource:()=>({sha256:'a'.repeat(64),assertCurrent(){
      if(!current)throw Error('EXPORT_START_SCOPE_CHANGED')
    }})})
    f.branch.put=async(key,value)=>{
      f.branch.set(key,structuredClone(value))
      if(value.status==='queued'){original=structuredClone(value);entered.resolve();await release.promise}
    }
    const begin=f.beginExport()
    const rejected=assert.rejects(begin,/EXPORT_START_SCOPE_CHANGED/)
    await entered.promise
    const resume=f.workflows.resumeCardWorkflows(f.session)
    current=false
    release.resolve()
    await Promise.all([rejected,resume])
    const anchor=f.branch.get(f.workflows.cardWorkflowKey(original.id))
    assert.equal(anchor.status,'stale','a scope change during the first write retains a durable terminal anchor')
    assert.equal(anchor.id,original.id)
    assert.equal(anchor.generation,original.generation)
    assert.deepEqual(anchor.source,original.source)
    assert.equal(anchor.error,'EXPORT_START_SCOPE_CHANGED')
    assert.ok(anchor.updatedAt)
    assert.equal(f.calls.native,0,'concurrent resume waits for the startup scope check and cannot dispatch stale DATA')
    assert.equal(f.calls.steer,0)
  }
  {
    const entered=deferred(),release=deferred()
    let current=true,original
    const f=exportFixture(workspace,{captureExportStartSource:()=>({sha256:'a'.repeat(64),assertCurrent(){
      if(!current)throw Error('EXPORT_START_SCOPE_CHANGED')
    }})})
    f.branch.put=async(key,value)=>{
      f.branch.set(key,structuredClone(value))
      if(value.status==='queued'){original=structuredClone(value);entered.resolve();await release.promise}
    }
    const begin=f.beginExport()
    const rejected=assert.rejects(begin,/EXPORT_START_SCOPE_CHANGED/)
    await entered.promise
    const key=f.workflows.cardWorkflowKey(original.id),cancelled={...original,status:'cancelled',error:'player cancelled'}
    f.branch.set(key,cancelled)
    current=false
    release.resolve()
    await rejected
    assert.deepEqual(f.branch.get(key),cancelled,'startup failure cannot overwrite a concurrent cancellation')
    await f.workflows.resumeCardWorkflows(f.session)
    assert.equal(f.calls.native,0)
  }
  {
    const entered=deferred(),release=deferred()
    let current=true,original
    const f=exportFixture(workspace,{captureExportStartSource:()=>({sha256:'a'.repeat(64),assertCurrent(){
      if(!current)throw Error('EXPORT_START_SCOPE_CHANGED')
    }})})
    f.branch.put=async(key,value)=>{
      if(value.status==='stale')throw Error('STALE_WRITE_FAILED')
      f.branch.set(key,structuredClone(value))
      if(value.status==='queued'){original=structuredClone(value);entered.resolve();await release.promise}
    }
    const begin=f.beginExport()
    const rejected=assert.rejects(begin,/STALE_WRITE_FAILED/)
    await entered.promise
    const resumeRejected=assert.rejects(f.workflows.resumeCardWorkflows(f.session),/CARD_EXPORT_START_FAILURE_UNPUBLISHED/)
    current=false
    release.resolve()
    await Promise.all([rejected,resumeRejected])
    const key=f.workflows.cardWorkflowKey(original.id),anchor=f.branch.get(key)
    assert.deepEqual(anchor,original,'failed stale publication preserves the original durable queued anchor')
    assert.equal(f.calls.native,0,'a failed terminal write cannot release dispatch in this process')
    assert.equal(f.calls.steer,0)
    assert.throws(()=>f.workflows.assertCardWorkflow(f.session,{workflowId:original.id,
      workflowGeneration:original.generation}),/CARD_EXPORT_START_FAILURE_UNPUBLISHED/)
    await assert.rejects(f.workflows.completeCardWorkflow(f.session,{workflowId:original.id,
      exportId:'unpublished-export'},{resourceId:'export'}),/CARD_EXPORT_START_FAILURE_UNPUBLISHED/)
    f.branch.set(key,{...anchor,status:'cancelled'})
    await f.workflows.resumeCardWorkflows(f.session)
    assert.equal(f.calls.native,0,'a cancellation remains terminal after a failed startup publication')
    current=true
    f.branch.set(key,{...anchor,generation:'replacement-generation'})
    await f.workflows.resumeCardWorkflows(f.session)
    assert.equal(f.calls.native,1,'an independently replaced generation is not blocked by the old local failure fence')
    assert.equal(f.branch.get(key).status,'completed')
  }
  {
    const f=exportFixture(workspace,{nativeTask:async options=>{
      assert.equal(options.executionPolicy,'independent');throw new InlinePending('bad-fallback')
    }}),beginIndependent=()=>f.workflows.beginCardWorkflow(
      f.session,'card-export',undefined,undefined,undefined,undefined,'organized',undefined,'independent')
    const ordinary=await f.beginExport()
    await assert.rejects(beginIndependent(),/执行策略不同/,'a live ordinary workflow cannot be silently upgraded')
    assert.equal(f.branch.get(f.workflows.cardWorkflowKey(ordinary.id)).executionPolicy,undefined)
    await f.workflows.controlCardWorkflow(f.session,ordinary.id,'cancel')
    f.deps.modelPolicy.resolve=()=>({execution:'inline',main:f.selection.main,actualRoute:f.selection.main})
    // A dependency violating the independent contract still cannot create a
    // waiting-main workflow or awaken the story agent.
    const independent=await beginIndependent()
    assert.equal(independent.schemaVersion,3);assert.equal(independent.execution,'spawn')
    assert.equal(independent.selection.execution,'inline','persist the original purpose route selection')
    await f.workflows.resumeCardWorkflows(f.session)
    const failed=f.branch.get(f.workflows.cardWorkflowKey(independent.id))
    assert.equal(failed.status,'failed');assert.ok(failed.failedAt);assert.equal(f.calls.steer,0)
    const retried=await f.workflows.controlCardWorkflow(f.session,independent.id,'retry')
    assert.equal(retried.executionPolicy,'independent');assert.equal(retried.execution,'spawn')
    await assert.rejects(f.workflows.completeCardWorkflow(f.session,{workflowId:retried.id,
      workflowGeneration:failed.generation,exportId:'late-export'},{resourceId:'late-resource'}),/失效/)
  }
  {
    const authored={spec:'nexttavern_card',spec_version:'1.0',data:{name:'Self native independent export',
      cards:[{name:'Explicit character',content:'SELF_NATIVE_CHARACTER'}],worldbook:[],rules:{core:'SELF_NATIVE_CORE'}},archive:{}}
    const original=freezeNativeCardConversionV1(authored)
    const classification=snapshot=>({characters:[{id:'self-character',name:'Explicit character'}],
      assignments:snapshot.units.map(unit=>({sourceId:unit.id,startLine:1,endLine:unit.lineCount,
        target:unit.pointer.includes('/cards/')?'character':'core',
        ...(unit.pointer.includes('/cards/')?{characterId:'self-character'}:{})}))})
    const converted=materializeNativeCardConversionV1(original,classification(original))
    const invalidated=structuredClone(converted)
    invalidated.data.compatibility.authorExecution.rules.core+=' SELF_AUTHOR_EDIT'
    for(const document of [authored,converted,invalidated]) {
      const snapshot=freezeNativeCardConversionV1(document),shouldClassify=document===invalidated
      let failArchive=shouldClassify,classifications=0,archives=0,checkpoint
      let f
      f=exportFixture(workspace,{
        captureExportStartSource:()=>({sha256:snapshot.sourceSha256,conversionSnapshot:snapshot,
          nativeAuthoring:true,assertCurrent(){}}),
        modelPolicy:{resolve:()=>{f.calls.resolve++;return {execution:'inline',main:f.selection.main,actualRoute:f.selection.main}}},
        nativeTask:async options=>{classifications++;assert.equal(options.executionPolicy,'independent');
          assert.equal(options.session,f.session);return options.validate(classification(snapshot))},
        driveNativeConversion:async(session,job,agent,signal)=>{
          const output=await driveNativeCardConversionV1({snapshot:job.conversionSnapshot,nativeAuthoring:true,
            classification:job.conversionClassification,progress:async()=>{},
            checkpoint:async value=>{checkpoint=value;const live=f.branch.get(f.workflows.cardWorkflowKey(job.id));
              await f.branch.put(f.workflows.cardWorkflowKey(job.id),{...live,conversionClassification:value})},
            classify:(system,user,validate)=>f.deps.nativeTask({session,agent,signal,system,user,validate,
              executionPolicy:job.executionPolicy,kind:'card-export',selection:job.selection}),
          })
          if(failArchive)throw Error('archive failure after durable classification checkpoint')
          archives++;return {resourceId:'self-native-'+archives,document:output}
        },
      })
      const job=await f.workflows.beginCardWorkflow(f.session,'card-export',undefined,undefined,undefined,
        undefined,'original',undefined,'independent')
      assert.equal(job.execution,shouldClassify?'spawn':'deterministic')
      assert.equal(f.calls.resolve,shouldClassify?1:0,'Native 1.0 and valid 1.1 preserve zero classification route requests')
      await f.workflows.resumeCardWorkflows(f.session)
      const key=f.workflows.cardWorkflowKey(job.id)
      if(shouldClassify) {
        const failed=f.branch.get(key)
        assert.equal(failed.status,'failed');assert.deepEqual(failed.conversionClassification,checkpoint)
        failArchive=false
        const retried=await f.workflows.controlCardWorkflow(f.session,job.id,'retry')
        assert.equal(retried.executionPolicy,'independent');assert.deepEqual(retried.conversionClassification,checkpoint)
        // A reconstructed workflow driver consumes the durable checkpoint;
        // retry cannot spend a second request to rediscover the same source.
        f.workflows=createCardWorkflows(f.deps)
        await f.workflows.resumeCardWorkflows(f.session)
      }
      assert.equal(f.branch.get(key).status,'completed');assert.equal(archives,1)
      assert.equal(classifications,shouldClassify?1:0);assert.equal(f.calls.steer,0)
    }
  }
  console.log('independent-card-workflow=ok (policy conflict, deterministic 1.0/valid 1.1, invalid 1.1 classification, checkpoint/retry/cold, no story steering)')
} finally {removeNativeDependencies?.();removeDependencies();rmSync(workspace,{recursive:true,force:true})}
