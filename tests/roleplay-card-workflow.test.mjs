import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { testTempRoot } from '../lib/operations/test-temp.mjs'
import { createCardWorkflows } from '../lib/core/roleplay-card-workflow.js'

const workspace=mkdtempSync(join(testTempRoot(),'dsh-card-workflow-'))
try {
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
} finally {rmSync(workspace,{recursive:true,force:true})}
