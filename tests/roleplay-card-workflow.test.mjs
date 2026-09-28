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
  const session={id:'workflow-singleflight',header:{cwd:workspace,agentPreset:'roleplay'}}
  const workflows=createCardWorkflows({
    T:{branch,opening:{get:()=>null}},storyBranchIsActive:()=>true,
    modelPolicy:{resolve:()=>{throw new Error('structured card must not resolve a model')}},
    statusFixedContext:()=>({}),nativeTask:()=>{throw new Error('structured card must not start nativeTask')},
    driveStructuredImport:async()=>{drives++;entered();await held;return {importId:'one',resourceId:'one'}},
    CARD_CLASSIFICATION_GUIDE:'',archiveImported:async()=>null,libraryFor:()=>({}),resourceName:()=>'',
    tavernTasks:{pending:()=>[],submit:async()=>{}},taskAgents:new Map(),ctx:{sessionController:{}},
  })
  const job=await workflows.beginCardWorkflow(session,'card-import','card.json')
  assert.equal(job.execution,'deterministic')
  const first=workflows.resumeCardWorkflows(session)
  await started
  const second=workflows.resumeCardWorkflows(session)
  release()
  await Promise.all([first,second])
  assert.equal(drives,1,'UI and main-loop resume share one durable generation driver')
  assert.equal(branch.get(workflows.cardWorkflowKey(job.id)).status,'completed')
  await workflows.resumeCardWorkflows(session)
  assert.equal(drives,1,'completed job does not execute again')
} finally {rmSync(workspace,{recursive:true,force:true})}
