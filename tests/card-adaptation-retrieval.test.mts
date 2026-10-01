import assert from 'node:assert/strict'
import http from 'node:http'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {createMemoryRetrieval,retrievalColdSession} from '../lib/memory/memory-retrieval.js'
import {createTestDirectory,cleanupTestDirectory} from '../lib/operations/test-temp.mjs'
const home=createTestDirectory('adaptation-vectors-'),previous=process.env.NEXTTAVERN_MEMORY_HOME
process.env.NEXTTAVERN_MEMORY_HOME=home
const sent=[],ledger=new Map(),table=new Map();let service,inspection:DatabaseSync|undefined,live=true,latency=0
const server=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);sent.push(body.input)
 if(latency)await new Promise(r=>setTimeout(r,latency))
 res.setHeader('content-type','application/json');res.end(JSON.stringify({data:body.input.map((_x,index)=>({index,embedding:[1,0,0]})),usage:{prompt_tokens:9,total_tokens:9}}))})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const session=retrievalColdSession('a',{cwd:home,agentPreset:'roleplay'},[])
const other=retrievalColdSession('b',{cwd:home,agentPreset:'roleplay'},[])
const factory=()=>createMemoryRetrieval({table:{get:k=>table.get(k),put:(k,v)=>table.set(k,structuredClone(v))},record:c=>ledger.set(c.id,structuredClone(c)),session:id=>id==='a'?session:other,active:()=>live})
const id='a'.repeat(64),otherId='b'.repeat(64)
const source={id:'0',seq:0,sessionId:'a',role:'adaptation-source',text:'PRIVATE_NOVEL_EVIDENCE',hash:createHash('sha256').update('PRIVATE_NOVEL_EVIDENCE').digest('hex')}
const waitIndexed=async()=>{for(let i=0;i<100;i++){const status=await service.adaptation(session,id,'status',[source]);if(status.progress.covered===1)return;await new Promise(r=>setTimeout(r,50))}throw Error('index timeout')}
try {
 service=factory()
 assert.equal((await service.adaptationModels(session)).activeProviderId,null,'new novel model choice must not inherit story settings')
 let approved=0,confirmationValid=true
 const offer={kind:'novel' as const,target:'synthetic novel',model:'synthetic online',reason:'stale',key:'fixture',valid:()=>confirmationValid,confirm:async()=>{approved++}}
 const prompt=service.rebuildConfirmation(session,offer)
 assert.equal(service.rebuildConfirmation(session,offer).confirmationId,prompt.confirmationId,'duplicate semantic queries reuse one confirmation')
 assert.equal(approved,0);assert.equal(service.pendingRebuilds(other).length,0)
 await assert.rejects(service.resolveRebuild(other,prompt.confirmationId,'confirm'),/变化/)
 await service.resolveRebuild(session,prompt.confirmationId,'cancel');assert.equal(approved,0);assert.equal(service.pendingRebuilds(session).length,0)
 const changedOffer=service.rebuildConfirmation(session,{...offer,key:'changed'});confirmationValid=false
 assert.equal(service.pendingRebuilds(session).length,0);await assert.rejects(service.resolveRebuild(session,changedOffer.confirmationId,'confirm'),/变化/)
 confirmationValid=true
 const accepted=service.rebuildConfirmation(session,{...offer,key:'accepted'})
 await service.resolveRebuild(session,accepted.confirmationId,'confirm');assert.equal(approved,1)
 await assert.rejects(service.resolveRebuild(session,accepted.confirmationId,'confirm'),/变化/);assert.equal(approved,1)
 const setup=service.rebuildConfirmation(session,{...offer,key:'needs-model',action:'configure-adaptation-model',confirm:async()=>{}})
 assert.equal(service.pendingRebuilds(session).find(item=>item.id===setup.confirmationId)?.action,'configure-adaptation-model','configuration notice uses the existing global confirmation channel')
 await service.resolveRebuild(session,setup.confirmationId,'confirm')
 assert.equal(approved,1,'opening configuration must not rebuild or invoke a provider')
 assert.ok(!service.pendingRebuilds(session).some(item=>item.id===setup.confirmationId))
 const setupAgain=service.rebuildConfirmation(session,{...offer,key:'needs-model',action:'configure-adaptation-model',confirm:async()=>{}})
 await service.resolveRebuild(session,setupAgain.confirmationId,'cancel')
 const setupRetry=service.rebuildConfirmation(session,{...offer,key:'needs-model',action:'configure-adaptation-model',confirm:async()=>{}})
 assert.notEqual(setupRetry.confirmationId,setupAgain.confirmationId,'an explicit new coarse selection can show configuration guidance again')
 await service.resolveRebuild(session,setupRetry.confirmationId,'cancel')
 const mutate=async(action,extra={})=>service.mutate(session,{action,expectedRevision:(await service.view(session)).revision,...extra})
 let settings=await mutate('save-provider',{provider:{name:'fixture',kind:'online',protocol:'openai',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'fixture',apiKey:'test-only'}})
 const providerId=settings.providers[0].id
 await mutate('test-provider',{providerId});await mutate('activate-provider',{providerId})
 assert.equal((await service.adaptationModels(session)).activeProviderId,null,'activating story memory does not opt novel research into paid calls')
 const chooseNovel=async(providerId)=>service.mutate(session,{action:'activate-adaptation-provider',providerId,expectedRevision:(await service.adaptationModels(session)).revision})
 await chooseNovel(providerId)
 await service.adaptation(session,id,'index',[source]);await waitIndexed()
 assert.equal((await service.view(session)).progress.vectors,0,'novel vectors absent from story namespace')
 const hits=await service.adaptation(session,id,'query',[source],'identity');assert.equal(hits[0].id,'0')
 assert.equal((await service.adaptation(session,otherId,'query',[source],'identity')).length,0,'different source cannot reuse novel vectors')
 assert.equal((await service.adaptation(other,id,'query',[{...source,sessionId:'b'}],'identity')).length,0,'different session cannot reuse novel vectors')
 const priorReuse=sent.length
 assert.equal((await service.adaptation(other,id,'query',[{...source,sessionId:'b'}],'identity','a'))[0].id,'0','same conversation can reuse research after regeneration')
 assert.equal(sent.length,priorReuse,'cached same-conversation query does not request another embedding')
 assert.equal((await service.search(session,{query:'PRIVATE_NOVEL_EVIDENCE'})).entries.length,0)
 await mutate('clear-index',{confirmProviderId:providerId})
 assert((await service.adaptation(session,id,'query',[source],'identity')).length,'clearing story does not clear novel research')
 service.dispose();await new Promise(r=>setTimeout(r,350));service=factory()
 assert.equal((await service.adaptation(session,id,'status',[source])).progress.covered,1,'restart recovers isolated vectors without automatic reindex')
 const beforeRebuild=await service.adaptation(session,id,'status',[source])
 await assert.rejects(service.adaptation(session,id,'rebuild'),/指纹/)
 await assert.rejects(service.adaptation(session,id,'rebuild',[],'','a','wrong-fingerprint'),/指纹/)
 assert.equal((await service.adaptation(session,id,'status',[source])).progress.covered,1,'rejected rebuild retains existing vectors')
 await service.adaptation(session,id,'rebuild',[],'','a',beforeRebuild.progress.fingerprint);assert.equal((await service.adaptation(session,id,'status',[source])).progress.vectors,0)
 await service.adaptation(session,id,'index',[source]);await waitIndexed();await service.adaptation(session,id,'pause')
 // Hold a provider mutation in paid HTTP, queue a model switch, then a rebuild confirmed for the old space.
 const second=await mutate('save-provider',{provider:{name:'second',kind:'online',protocol:'openai',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'second',apiKey:'test-only'}})
 const secondId=second.providers.find(p=>p.id!==providerId).id
 await mutate('test-provider',{providerId:secondId})
 const novelRevision=(await service.adaptationModels(session)).revision
 const novelFingerprint=(await service.adaptation(session,id,'status',[source])).progress.fingerprint
 await mutate('activate-provider',{providerId:secondId})
 assert.equal((await service.adaptationModels(session)).activeProviderId,providerId)
 assert.equal((await service.adaptationModels(session)).revision,novelRevision,'story switching leaves novel confirmation revision unchanged')
 assert.equal((await service.adaptation(session,id,'status',[source])).progress.fingerprint,novelFingerprint)
 await chooseNovel('')
 assert.equal((await service.view(session)).activeProviderId,secondId,'clearing novel selection never changes the story choice')
 await assert.rejects(service.adaptation(session,id,'query',[source],'no model'),/未就绪/)
 await chooseNovel(providerId)
 const capturedRevision=(await service.adaptationModels(session)).revision
 await chooseNovel(secondId)
 const callsBeforeExpiredPin=sent.length
 await assert.rejects(service.adaptation(session,id,'index',[source],'',session.id,undefined,undefined,capturedRevision),/模型配置已变化/)
 assert.equal(sent.length,callsBeforeExpiredPin,'expired enqueue model pin cannot make a call with the newly selected provider')
 await chooseNovel(providerId)
 const confirmed=(await service.adaptation(session,id,'status',[source])).progress.fingerprint
 const revision=(await service.view(session)).revision,adaptationRevision=(await service.adaptationModels(session)).revision;latency=180
 const testing=service.mutate(session,{action:'test-provider',providerId,expectedRevision:revision})
 const switching=service.mutate(session,{action:'activate-adaptation-provider',providerId:secondId,expectedRevision:adaptationRevision+1})
 const rebuilding=assert.rejects(service.adaptation(session,id,'rebuild',[],'','a',confirmed),/指纹/)
 await Promise.all([testing,switching,rebuilding]);latency=0
 await chooseNovel(providerId);await mutate('activate-provider',{providerId})
 assert.equal((await service.adaptation(session,id,'status',[source])).progress.covered,1,'queued model switch rejects stale rebuild and preserves old reusable vectors')
 assert([...ledger.values()].some(c=>c.purpose==='index'&&c.ownerSessionId==='a'&&c.inputTokens===9),'embedding billed to initiating session')
 assert(sent.flat().includes('PRIVATE_NOVEL_EVIDENCE'))
 // Global chunk geometry must agree across story status, novel indexing and query candidates.
 assert.equal((await service.view(session)).chunkChars,480)
 for(const invalid of [127,2049,480.5,'480'])await assert.rejects(mutate('index-chunk-size',{chunkChars:invalid}),/索引块大小/)
 const sizedId='d'.repeat(64),sizedText=Array.from({length:160},(_,i)=>`词${i}x`).join(' '),sized={...source,text:sizedText,hash:createHash('sha256').update(sizedText).digest('hex')}
 const waitSized=async()=>{for(let i=0;i<100;i++){const p=(await service.adaptation(session,sizedId,'status',[sized])).progress;if(p.covered===1)return p;await new Promise(r=>setTimeout(r,30))}throw Error('sized source timeout')}
 await service.adaptation(session,sizedId,'index',[sized]);const originalChunks=await waitSized()
 const beforeSizeChange=sent.length
 await mutate('index-chunk-size',{chunkChars:960})
 assert.equal(sent.length,beforeSizeChange,'changing a global size cannot encode or bulk rebuild')
 const staleChunks=(await service.adaptation(session,sizedId,'status',[sized])).progress
 assert.equal(staleChunks.stale,true);assert.notEqual(staleChunks.fingerprint,originalChunks.fingerprint)
 assert.equal((await service.view(session)).progress.embedding.preprocessing.chunkChars,960,'story and research share the setting')
 await assert.rejects(service.adaptation(session,sizedId,'query',[sized],'词'),'stale index must not be searched')
 await service.adaptation(session,sizedId,'rebuild',[],'','a',staleChunks.fingerprint)
 const sizedCalls=sent.length;await service.adaptation(session,sizedId,'index',[sized]);const rebuiltChunks=await waitSized()
 assert(rebuiltChunks.vectors<originalChunks.vectors);assert(sent.slice(sizedCalls).flat().some(t=>t.length>480));assert(sent.slice(sizedCalls).flat().every(t=>t.length<=960))
 assert.equal((await service.adaptation(session,sizedId,'query',[sized],'词'))[0].id,'0','query enumerates the same resized blocks')
 service.dispose();await new Promise(r=>setTimeout(r,350));service=factory()
 assert.equal((await service.view(session)).chunkChars,960,'global chunk size survives restart')
 assert.equal((await service.adaptation(session,sizedId,'status',[sized])).progress.covered,1,'resized coverage survives restart')
 // Delete owner during the first paid batch: charge the real attempt, discard late vectors, pause all remaining work.
 const bulk={...source,text:Array.from({length:1500},(_,i)=>'PRIVATE_RESEARCH_'+i).join('\n')};bulk.hash=createHash('sha256').update(bulk.text).digest('hex')
 const bulkId='c'.repeat(64),before=sent.length;latency=150
 await service.adaptation(session,bulkId,'index',[bulk])
 for(let i=0;i<100&&sent.length===before;i++)await new Promise(r=>setTimeout(r,10))
 assert.equal(sent.length,before+1);live=false
 await new Promise(r=>setTimeout(r,450));assert.equal(sent.length,before+1,'inactive owner must not start further paid batches')
 live=true;latency=0
 const paused=await service.adaptation(session,bulkId,'status',[bulk]);assert.equal(paused.progress.vectors,0);assert(paused.progress.pending>0)
 // Original-library identity, rather than initiating session/cwd, owns shared vectors.
 const independent=retrievalColdSession('independent',{cwd:join(home,'independent-root'),agentPreset:'roleplay'},[])
 const assetId='e'.repeat(64),original={assetId,enabled:true},sharedText='SHARED_ORIGINAL_EVIDENCE '.repeat(75)
 const sharedSource={...source,sessionId:assetId,text:sharedText,hash:createHash('sha256').update(sharedText).digest('hex')}
 const shared=(s,action,query='',fingerprint=undefined)=>service.adaptation(s,id,action,[sharedSource],query,s.id,fingerprint,original)
 const waitShared=async()=>{for(let i=0;i<120;i++){const p=(await shared(session,'status')).progress;if(p.covered===1)return p;await new Promise(r=>setTimeout(r,30))}throw Error('shared original index timeout')}
 await shared(session,'index');const originalRecipe=await waitShared()
 // Background work must survive an unrelated consumer's provider switch.
 const ongoingId='0'.repeat(64),ongoingText='BACKGROUND_NOVEL '.repeat(250),ongoingSource={...source,text:ongoingText,hash:createHash('sha256').update(ongoingText).digest('hex')}
 latency=40;await service.adaptation(session,ongoingId,'index',[ongoingSource])
 await mutate('activate-provider',{providerId:secondId})
 await new Promise(r=>setTimeout(r,1600))
 const ongoing=(await service.adaptation(session,ongoingId,'status',[ongoingSource])).progress
 assert.equal(ongoing.covered,1,'switching story models cannot reset a novel worker queue')
 latency=0;await mutate('activate-provider',{providerId})
 await shared(session,'query','shared identity');const beforeReuse=sent.length
 assert.equal((await shared(independent,'status')).progress.covered,1,'same immutable asset shares coverage across independent cwd/session')
 assert.equal((await shared(independent,'query','shared identity'))[0].id,sharedSource.id)
 await shared(independent,'index');await waitShared()
 assert.equal(sent.length,beforeReuse,'shared coverage/query cache does not encode again for another session')
 const isolatedAsset='f'.repeat(64)
 assert.equal((await service.adaptation(independent,id,'status',[{...sharedSource,sessionId:isolatedAsset}],'',independent.id,undefined,{assetId:isolatedAsset,enabled:false})).progress.covered,0)
 assert.equal((await service.adaptation(independent,id,'query',[{...sharedSource,sessionId:isolatedAsset}],'shared identity',independent.id,undefined,{assetId:isolatedAsset,enabled:false})).length,0,'another asset cannot borrow identical text vectors')
 assert.equal((await service.view(independent)).progress.vectors,0,'shared original does not populate story vectors')
 await mutate('index-chunk-size',{chunkChars:192})
 await shared(independent,'index');const alternateRecipe=await waitShared()
 assert.notEqual(alternateRecipe.fingerprint,originalRecipe.fingerprint);assert(alternateRecipe.vectors>originalRecipe.vectors)
 const beforeReturn=sent.length
 await mutate('index-chunk-size',{chunkChars:960})
 assert.equal((await shared(independent,'status')).progress.covered,1)
 await shared(independent,'index');await shared(independent,'query','shared identity')
 assert.equal(sent.length,beforeReturn,'switching back reuses the previous complete recipe and query cache')
 await shared(session,'rebuild','',originalRecipe.fingerprint)
 assert.equal((await shared(session,'status')).progress.vectors,0)
 await mutate('index-chunk-size',{chunkChars:192})
 const preserved=(await shared(session,'status')).progress
 assert.equal(preserved.fingerprint,alternateRecipe.fingerprint);assert.equal(preserved.covered,1,'rebuild clears only the confirmed current recipe')
 await mutate('index-chunk-size',{chunkChars:960});await shared(session,'index');await waitShared()
 await shared(session,'clear')
 assert.equal((await shared(session,'status')).progress.vectors,0)
 await mutate('index-chunk-size',{chunkChars:192})
 assert.equal((await shared(session,'status')).progress.vectors,0,'explicit clear deletes all recipes of this asset')
 await mutate('index-chunk-size',{chunkChars:960})
 // Exact old conversation namespace migration copies vectors, never queued/failed work.
 const legacyId='8'.repeat(64),migrationAsset='9'.repeat(64),migrationText='EXACT_LEGACY_ORIGINAL'
 const legacySource={...source,text:migrationText,hash:createHash('sha256').update(migrationText).digest('hex')}
 await service.adaptation(session,legacyId,'index',[legacySource])
 let legacyStatus
 for(let i=0;i<100;i++){legacyStatus=await service.adaptation(session,legacyId,'status',[legacySource]);if(legacyStatus.progress.covered===1)break;await new Promise(r=>setTimeout(r,30))}
 assert.equal(legacyStatus.progress.covered,1);await service.adaptation(session,legacyId,'pause')
 const database=inspection=new DatabaseSync(join(home,'vectors.sqlite'))
 const legacySpace=legacyStatus.progress.fingerprint,legacyWorkspace=database.prepare('SELECT workspace FROM spaces WHERE space=?').get(legacySpace).workspace
 for(const status of ['queued','running','failed'])database.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)').run(legacyWorkspace,legacySpace,'migration-'+status,'a','DO_NOT_COPY_JOBS',status,status==='failed'?'synthetic error':null)
 const migratedSource={...legacySource,sessionId:migrationAsset},migrationOriginal={assetId:migrationAsset,enabled:false}
 const beforeMigration=sent.length
 const migrated=await service.adaptation(session,legacyId,'status',[migratedSource],'',session.id,undefined,migrationOriginal)
 assert.equal(migrated.progress.covered,1);assert.equal(sent.length,beforeMigration,'exact immutable source migrates without embedding')
 const migrationWorkspace=database.prepare('SELECT workspace FROM spaces WHERE space=?').get(migrated.progress.fingerprint).workspace
 assert.equal(database.prepare('SELECT COUNT(*) n FROM jobs WHERE workspace=?').get(migrationWorkspace).n,0,'legacy work queues are never copied')
 await mutate('index-chunk-size',{chunkChars:192})
 const incompatibleAsset='7'.repeat(64)
 const incompatible=await service.adaptation(session,legacyId,'status',[{...legacySource,sessionId:incompatibleAsset}],'',session.id,undefined,{assetId:incompatibleAsset,enabled:false})
 assert.equal(incompatible.progress.vectors,0,'old character recipe cannot be relabeled into the active recipe')
 assert.equal(sent.length,beforeMigration)
 await mutate('index-chunk-size',{chunkChars:960})
 await service.adaptation(session,legacyId,'clear',[],'',session.id,undefined,migrationOriginal)
 assert.equal((await service.adaptation(session,legacyId,'status',[migratedSource],'',session.id,undefined,migrationOriginal)).progress.covered,0,'clear blocks old cache reimport')
 assert.equal(database.prepare('SELECT legacyBlocked FROM conversation_scope WHERE workspace=?').get(migrationWorkspace).legacyBlocked,1)
 assert.equal(database.prepare('SELECT COUNT(*) n FROM vectors WHERE space=?').get(legacySpace).n,1,'migration/clear leave the old conversation cache untouched')
 database.close();inspection=undefined
 service.dispose();await new Promise(r=>setTimeout(r,350));service=factory()
 assert.equal((await service.adaptation(session,legacyId,'status',[migratedSource],'',session.id,undefined,migrationOriginal)).progress.covered,0,'legacy import block survives restart')
 // The local character target is independent of the tokenizer's total input budget.
 // Inspect the real worker recipe without loading/downloading an encoder; actual tokenizer
 // segmentation and encoding guards are exercised in memory-retrieval.test.mjs.
 const localConfig=structuredClone(table.get('memory-retrieval-settings-v1'))
 const localProvider=localConfig.providers.find(p=>p.id===localConfig.activeProviderId)
 Object.assign(localProvider,{kind:'local',model:'bge-small-zh',revision:'local-geometry-fixture',dimensions:384})
 localConfig.revision++;table.set('memory-retrieval-settings-v1',localConfig)
 const beforeLocal=sent.length,localView=await service.view(session)
 assert.equal(localView.chunkChars,960);assert.equal(localView.effectiveChunkChars,960,'local character target is no longer capped at 480')
 const localStatus=await service.adaptation(session,id,'status',[source]),localIdentity=localStatus.progress.embedding.preprocessing
 assert.equal(localIdentity.chunkChars,960);assert.equal(localIdentity.overlapChars,160)
 assert.equal(localIdentity.requestedChunkChars,undefined,'there is no separate silently clamped character recipe')
 assert.equal(localIdentity.maxTokens,512,'legacy provider settings default to a 512-token total input budget')
 assert.equal(localIdentity.modelMaxTokens,512,'BGE small keeps its model-specific token ceiling')
 assert.equal(localIdentity.segmentation,'tokenizer-scalar-v1');assert.equal(localIdentity.addSpecialTokens,true);assert.equal(localIdentity.truncation,false)
 assert.deepEqual(localView.progress.embedding.preprocessing,localIdentity,'story and novel use the same tokenizer recipe')
 assert.equal(localStatus.progress.covered,0,'old online vectors cannot count as tokenizer-verified local coverage')
 assert.equal(localStatus.progress.stale,true)
 localProvider.localMaxTokens=64;localProvider.revision='local-token-budget-fixture';localConfig.revision++
 table.set('memory-retrieval-settings-v1',structuredClone(localConfig))
 const lowerBudget=(await service.adaptation(session,id,'status',[source])).progress
 assert.equal(lowerBudget.embedding.preprocessing.chunkChars,960,'changing tokens must not silently change the character target')
 assert.equal(lowerBudget.embedding.preprocessing.maxTokens,64)
 assert.notEqual(lowerBudget.fingerprint,localStatus.progress.fingerprint,'the token budget must isolate index and query spaces')
 assert.equal(lowerBudget.covered,0);assert.equal(sent.length,beforeLocal,'status and budget changes do not encode or bulk rebuild')
 // Local migration requires the exact versioned tokenizer plan; stored vectors alone are insufficient.
 const localLegacyId='6'.repeat(64),localAsset='5'.repeat(64),localText='LOCAL_PINNED_PLAN_EVIDENCE'
 const localSource={...source,text:localText,hash:createHash('sha256').update(localText).digest('hex')}
 const localLegacy=(await service.adaptation(session,localLegacyId,'status',[localSource])).progress
 const localDb=inspection=new DatabaseSync(join(home,'vectors.sqlite'))
 const oldLocalWorkspace=localDb.prepare('SELECT workspace FROM spaces WHERE space=?').get(localLegacy.fingerprint).workspace
 const vectorKey=text=>createHash('sha256').update('adaptation-source\n'+text).digest('hex')
 const vector=Buffer.from(new Float32Array([1,...new Array(383).fill(0)]).buffer)
 localDb.prepare('INSERT INTO vectors VALUES(?,?,?)').run(localLegacy.fingerprint,vectorKey(localText),vector)
 localDb.prepare('INSERT INTO local_chunk_plans VALUES(?,?,?,?,1,?,?,NULL)').run(oldLocalWorkspace,localLegacy.fingerprint,'a','0',localSource.hash,JSON.stringify([{offset:0,end:localText.length}]))
 localDb.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)').run(oldLocalWorkspace,localLegacy.fingerprint,'local-failed','a','DO_NOT_COPY_LOCAL_JOB','failed','tokenizer unavailable')
 const localOriginal={assetId:localAsset,enabled:false},stableSource={...localSource,sessionId:localAsset},beforeLocalMigration=sent.length
 const localMigrated=(await service.adaptation(session,localLegacyId,'status',[stableSource],'',session.id,undefined,localOriginal)).progress
 assert.equal(localMigrated.covered,1)
 const newLocalWorkspace=localDb.prepare('SELECT workspace FROM spaces WHERE space=?').get(localMigrated.fingerprint).workspace
 const copiedPlan=localDb.prepare('SELECT version,session,sourceHash,ranges FROM local_chunk_plans WHERE workspace=?').get(newLocalWorkspace)
 assert.equal(copiedPlan.version,1);assert.equal(copiedPlan.session,localAsset);assert.equal(copiedPlan.sourceHash,localSource.hash)
 assert.deepEqual(JSON.parse(copiedPlan.ranges),[{offset:0,end:localText.length}]);assert.equal(localDb.prepare('SELECT COUNT(*) n FROM jobs WHERE workspace=?').get(newLocalWorkspace).n,0)
 assert.equal((await service.adaptation(independent,localLegacyId,'status',[stableSource],'',independent.id,undefined,localOriginal)).progress.covered,1,'local plan identity remains stable across session/cwd')
 await assert.rejects(service.adaptation(session,localLegacyId,'status',[{...stableSource,hash:'incorrect-source-hash'}],'',session.id,undefined,{assetId:'4'.repeat(64),enabled:false}),/来源校验失败/)
 const changedText=localText+'CHANGED',changedSource={...localSource,text:changedText,hash:createHash('sha256').update(changedText).digest('hex'),sessionId:'3'.repeat(64)}
 localDb.prepare('INSERT INTO vectors VALUES(?,?,?)').run(localLegacy.fingerprint,vectorKey(changedText),vector)
 const changed=(await service.adaptation(session,localLegacyId,'status',[changedSource],'',session.id,undefined,{assetId:changedSource.sessionId,enabled:false})).progress
 assert.equal(changed.covered,0);assert.equal(changed.vectors,0,'vector with no sourceHash-matching tokenizer plan cannot migrate')
 const brokenSource={...localSource,id:'broken',sessionId:'2'.repeat(64)}
 localDb.prepare('INSERT INTO local_chunk_plans VALUES(?,?,?,?,1,?,?,NULL)').run(oldLocalWorkspace,localLegacy.fingerprint,'a','broken',localSource.hash,JSON.stringify([{offset:0,end:localText.length-1}]))
 await assert.rejects(service.adaptation(session,localLegacyId,'status',[brokenSource],'',session.id,undefined,{assetId:brokenSource.sessionId,enabled:false}),/计划不完整/)
 const brokenWorkspace=createHash('sha256').update('card-adaptation-library-v1:'+brokenSource.sessionId).digest('hex')
 assert.equal(localDb.prepare('SELECT COUNT(*) n FROM local_chunk_plans WHERE workspace=?').get(brokenWorkspace).n,0,'invalid plan migration rolls back rather than leaving partial coverage')
 const differentBudget=structuredClone(table.get('memory-retrieval-settings-v1'))
 Object.assign(differentBudget.providers.find(p=>p.id===differentBudget.activeProviderId),{localMaxTokens:128,revision:'incompatible-migration-budget'})
 differentBudget.revision++;table.set('memory-retrieval-settings-v1',differentBudget)
 const otherBudgetAsset='1'.repeat(64)
 const budgetMismatch=(await service.adaptation(session,localLegacyId,'status',[{...localSource,sessionId:otherBudgetAsset}],'',session.id,undefined,{assetId:otherBudgetAsset,enabled:false})).progress
 assert.equal(budgetMismatch.vectors,0);assert.equal(budgetMismatch.covered,0,'a different tokenizer budget is not an exact recipe migration')
 assert.equal(sent.length,beforeLocalMigration,'local migration checks never invoke online embedding')
 localDb.close();inspection=undefined
 console.log('card-adaptation-retrieval=ok (real worker/mock HTTP, namespace isolation, restart, rebuild, ledger)')
} finally {
 inspection?.close()
 service?.dispose();await new Promise(r=>setTimeout(r,350));await new Promise(r=>server.close(r))
 if(previous===undefined)delete process.env.NEXTTAVERN_MEMORY_HOME;else process.env.NEXTTAVERN_MEMORY_HOME=previous
 cleanupTestDirectory(home)
}
