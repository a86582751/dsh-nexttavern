import assert from 'node:assert/strict'
import fs from 'node:fs'
import {registerAdaptationTools} from '../lib/core/card-adaptation-tools.js'
import {createTestDirectory,cleanupTestDirectory} from '../lib/operations/test-temp.mjs'
const temp=createTestDirectory('adaptation-management-')
try{
 fs.writeFileSync(temp+'/novel.txt','第一章 开场\n纳兰嫣然还没有作出退婚的决定。\n第二章 约定\n这是另一种可能。')
 const table=new Map();table.put=async(k,v)=>table.set(k,structuredClone(v))
 const tools=new Map(),sessions=new Map(['first','regenerated','other'].map(id=>[id,{id,header:{cwd:temp,agentPreset:'roleplay'},events:[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'tool/call',data:{turn:1,name:'rp_source_status'}}]}]))
 let current=sessions.get('first'),stale=false,fingerprint='1'.repeat(64),vectorCount=0
 const requests=[],offers=[]
 let modelRevision=0,modelId='one',storyModelId='story-one',switchAfterStatus=false,online=false
 const service=registerAdaptationTools({ctx:{effect:f=>f(),tools:{register:t=>tools.set(t.name,t)}},table,sessionOf:async()=>current,active:()=>true,scopeOf:async s=>['other','fresh'].includes(s.id)?s.id+'-conversation':'shared-conversation',retrieval:{adaptationCurrent:r=>r===modelRevision,rebuildConfirmation:(_s,offer)=>{offers.push(offer);return {status:'awaiting-rebuild-confirmation'}},adaptationModels:async()=>({providers:[{id:'one',kind:online?'online':'local',name:'默认语义',model:'model-one',ready:true},{id:'two',kind:online?'online':'local',name:'备选语义',model:'model-two',ready:true}],revision:modelRevision,activeProviderId:modelId||null}),mutate:async(_s,body)=>{assert.equal(body.action,'activate-adaptation-provider');if(body.expectedRevision!==modelRevision)throw Error('检索设置已更新');modelRevision++;modelId=String(body.providerId??'')},adaptation:async(s,id,action,rows=[],query='',owner='',expected)=>{
  requests.push({session:s.id,id,action,owner,expected})
  if(action==='status'){const progress={stale,fingerprint,sources:rows.length,covered:vectorCount?rows.length:0,vectors:vectorCount,pending:0,running:0,failed:0,unknown:0,embedding:{embedding_model:fingerprint}};if(switchAfterStatus){switchAfterStatus=false;fingerprint='3'.repeat(64);modelRevision++}return {progress}}
  if(action==='rebuild'||action==='clear'){if(expected&&expected!==fingerprint)throw Error('stale fingerprint');stale=false;vectorCount=0}
  if(action==='query'){if(stale)throw Object.assign(Error('stale index'),{code:'EMBEDDING_INDEX_STALE'});return [{id:'0',offset:0,score:1}]};if(action==='index')vectorCount=1
  return {vectors:vectorCount}
 }}})
 const execute=async(name,args={})=>{const result=await tools.get(name).execute(args,{agent:{session:current}});assert.deepEqual(result,JSON.parse(JSON.stringify(result)),`${name} must return lossless JSON to the native tool runtime`);return result}
 const info=await execute('rp_source_begin',{source_path:'novel.txt'}),id=info.sourceId
 current.events.push({seq:2,type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'begin'}},{seq:3,type:'tool/result',data:{message:{source:{kind:'tool',callId:'begin'},content:[{type:'tool-result',toolCallId:'begin',content:[{type:'text',text:JSON.stringify({sourceId:id})}]}]}}})
 const read=await execute('rp_source_read',{source_id:id,segment:0})
 await execute('rp_source_note',{source_id:id,segment:0,facts:'原著角色仍有选择空间',implications:'改写退婚选择',questions:'后果待核实',evidence:'纳兰嫣然还没有作出退婚的决定'})
 await execute('rp_source_index',{source_id:id})
 await assert.rejects(service.beforeWrite({agent:{session:current}}),/研究尚未完成/)
 await assert.rejects(execute('rp_source_finish',{source_id:id}),/语义查缺补漏/);await execute('rp_source_search',{source_id:id,query:'退婚的选择',mode:'semantic'});await execute('rp_source_finish',{source_id:id})
 await service.beforeWrite({agent:{session:current}});assert.equal(service.load('shared-conversation',id).state.indexPolicy,'completed','finish before completion timer still records completed index')
 current=sessions.get('regenerated')
 const resumed=await execute('rp_source_status');assert.equal(resumed.sources[0].reviewed,1);assert.equal(resumed.sources[0].nextSegment,null)
 const repeat=await execute('rp_source_begin',{source_path:'novel.txt'});assert.equal(repeat.sourceId,id);assert.equal(repeat.reusable,true)
 current.events.push({seq:2,type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'repeat'}},{seq:3,type:'tool/result',data:{message:{source:{kind:'tool',callId:'repeat'},content:[{type:'tool-result',toolCallId:'repeat',content:[{type:'text',text:JSON.stringify({sourceId:id})}]}]}}})
 assert.equal((await execute('rp_source_notes',{source_id:id})).notes[0].facts,'原著角色仍有选择空间')
 assert(requests.every(r=>r.owner==='shared-conversation'),'root scope used for every vector operation')
 await assert.rejects(execute('rp_source_index',{source_id:id,action:'rebuild',index_fingerprint:fingerprint}),/正常或已修复/)
 let pausedView=await service.view(current,id)
 pausedView=await service.mutate(current,{sourceId:id,action:'resume-index',expectedModelRevision:modelRevision,expectedRevision:pausedView.revision,expectedLibraryRevision:pausedView.library.revision})
 assert(requests.some(r=>r.action==='retry'),'finished research requires explicit resume before indexing again')
 stale=true;fingerprint='2'.repeat(64)
 await execute('rp_source_index',{source_id:id,action:'rebuild',index_fingerprint:fingerprint})
 const rebuilt=requests.filter(r=>r.action==='rebuild').length
 await assert.rejects(execute('rp_source_index',{source_id:id,action:'rebuild',index_fingerprint:fingerprint}),/正常或已修复/)
 assert.equal(requests.filter(r=>r.action==='rebuild').length,rebuilt,'repeat regeneration cannot rebuild a repaired index')
 let view=await service.view(current,id);assert.equal(view.conversationId,'shared-conversation');assert.equal(view.notes.length,1)
 view=await service.mutate(current,{sourceId:id,action:'save-note',expectedRevision:view.revision,note:{...view.notes[0],implications:'用户调整的改编方向'}})
 assert.equal(view.notes[0].implications,'用户调整的改编方向')
 await assert.rejects(service.mutate(current,{sourceId:id,action:'clear-notes',expectedRevision:view.revision-1}),/已更新/)
 view=await service.mutate(current,{sourceId:id,action:'clear-index',expectedRevision:view.revision,expectedLibraryRevision:view.library.revision})
 assert.equal(view.notes.length,1);assert.equal(view.index.vectors,0)
 await assert.rejects(execute('rp_source_index',{source_id:id}),/玩家已暂停/)
 view=await service.mutate(current,{sourceId:id,action:'resume-index',expectedModelRevision:modelRevision,expectedRevision:view.revision,expectedLibraryRevision:view.library.revision});assert(requests.some(r=>r.action==='retry'))
 const doubleRevision=view.revision
 await service.mutate(current,{sourceId:id,action:'rebuild-index',expectedRevision:doubleRevision,expectedLibraryRevision:view.library.revision,expectedModelRevision:modelRevision,indexFingerprint:fingerprint})
 await assert.rejects(service.mutate(current,{sourceId:id,action:'rebuild-index',expectedRevision:doubleRevision,expectedLibraryRevision:view.library.revision}),/已更新/)
 view=await service.view(current,id);const savedVectors=vectorCount
 switchAfterStatus=true
 await assert.rejects(service.mutate(current,{sourceId:id,action:'rebuild-index',expectedRevision:view.revision,expectedLibraryRevision:view.library.revision,expectedModelRevision:view.modelRevision,indexFingerprint:view.index.fingerprint}),/fingerprint|已更新|已变化/)
 assert.equal(vectorCount,savedVectors,'interleaved model switch must preserve reusable vectors')
 const sharedView=await service.view(sessions.get('first'),id),sharedAsset=sharedView.library.assets.find(a=>a.sourceId===id)
 assert(sharedAsset,'published source is visible in the shared original library')
 current=sessions.get('other');assert.equal((await service.view(current)).sources.length,0)
 const attached=await service.mutate(current,{action:'attach-source',assetId:sharedAsset.assetId,expectedLibraryRevision:sharedView.library.revision})
 assert.equal(attached.sources.length,1,'another conversation can attach the shared original')
 assert.equal(attached.library.assets.find(a=>a.assetId===sharedAsset.assetId).references,2,'library references aggregate across conversation scopes')
 const detached=await service.mutate(current,{action:'detach-source',sourceId:attached.selectedId,expectedRevision:attached.revision,expectedLibraryRevision:attached.library.revision})
 assert.equal(detached.sources.length,0,'detaching removes only the current conversation binding')
 assert.equal(detached.library.assets.find(a=>a.assetId===sharedAsset.assetId).references,1,'detaching preserves the other conversation reference')
 const empty=await service.view(current);assert.equal(empty.semanticModels.length,2);assert.equal(empty.autoIndexNewSources,false);assert.equal(empty.autoRebuildLocalOnActive,false);assert.equal(empty.autoIndexSettingsRevision,0)
 await service.mutate(current,{action:'select-model',providerId:'two',expectedModelRevision:empty.modelRevision})
 assert.equal((await service.view(sessions.get('first'))).defaultSemanticModelId,'two','novel model selection is global and works without source');assert.equal(modelId,'two');assert.equal(storyModelId,'story-one','novel model selection does not change story model')
 await assert.rejects(service.mutate(current,{action:'select-model',providerId:'one',expectedModelRevision:empty.modelRevision}),/已更新/)
 await service.mutate(current,{action:'select-model',providerId:'',expectedModelRevision:modelRevision})
 assert.equal((await service.view(sessions.get('first'))).defaultSemanticModelId,null,'clearing novel model leaves it unconfigured');assert.equal(modelId,'');assert.equal(storyModelId,'story-one','clearing novel model does not change story model')
 const autoOn=await service.mutate(current,{action:'auto-index-new-sources',enabled:true,expectedAutoIndexSettingsRevision:empty.autoIndexSettingsRevision});assert.equal(autoOn.autoIndexNewSources,true);assert.equal(autoOn.autoRebuildLocalOnActive,false);assert.equal(autoOn.autoIndexSettingsRevision,1)
 const repairOn=await service.mutate(current,{action:'auto-rebuild-local-on-active',enabled:true,expectedAutoIndexSettingsRevision:autoOn.autoIndexSettingsRevision});assert.equal(repairOn.autoIndexNewSources,true);assert.equal(repairOn.autoRebuildLocalOnActive,true);assert.equal(repairOn.autoIndexSettingsRevision,2)
 await assert.rejects(service.mutate(current,{action:'auto-index-new-sources',enabled:false,expectedAutoIndexSettingsRevision:autoOn.autoIndexSettingsRevision}),/已变化|更新/)
 const autoOff=await service.mutate(current,{action:'auto-index-new-sources',enabled:false,expectedAutoIndexSettingsRevision:repairOn.autoIndexSettingsRevision});assert.equal(autoOff.autoIndexNewSources,false);assert.equal(autoOff.autoRebuildLocalOnActive,true,'auto index toggle does not overwrite auto repair')
 const repairOff=await service.mutate(current,{action:'auto-rebuild-local-on-active',enabled:false,expectedAutoIndexSettingsRevision:autoOff.autoIndexSettingsRevision});assert.equal(repairOff.autoIndexNewSources,false,'auto repair toggle does not overwrite auto index');assert.equal(repairOff.autoRebuildLocalOnActive,false)
 await assert.rejects(execute('rp_source_notes',{source_id:id}),/不可用|研究资料只供/)
 current=sessions.get('regenerated');current.events=[]
 await assert.rejects(execute('rp_source_search',{source_id:id,query:'退婚'}),/研究资料只供写卡/)
 assert.equal((await service.view(current,id)).notes.length,1,'UI may inspect retained research during roleplay without injecting it')
 // Completing immutable source work requires no UI polling and does not retire its vectors.
 modelId='one';current.events=[{seq:0,type:'tool/call',data:{name:'rp_source_status'}},{seq:1,type:'tool/call',data:{name:'rp_source_begin',callId:'resume-begin'}},{seq:2,type:'tool/result',data:{message:{source:{kind:'tool',callId:'resume-begin'},content:[{type:'tool-result',toolCallId:'resume-begin',content:[{type:'text',text:JSON.stringify({sourceId:id})}]}]}}}]
 let completion=await service.view(current,id)
 await service.mutate(current,{action:'resume-index',expectedModelRevision:modelRevision,sourceId:id,expectedRevision:completion.revision,expectedLibraryRevision:completion.library.revision})
 await new Promise(r=>setTimeout(r,2150))
 assert.equal(service.load('shared-conversation',id).state.indexPolicy,'completed','completed original stops its background enrollment without panel polling')
 assert.equal(vectorCount,1,'completion retains searchable vectors')
 assert.equal((await execute('rp_source_search',{source_id:id,query:'退婚',mode:'semantic'})).mode,'semantic')
 online=true;stale=true
  const beforeRepair=requests.filter(r=>r.action==='rebuild').length
 const beforeIndex=requests.filter(r=>r.action==='index').length
 assert.equal((await execute('rp_source_index',{source_id:id,action:'index'})).status,'awaiting-rebuild-confirmation','native fill cannot bypass online stale confirmation')
 assert.equal(requests.filter(r=>r.action==='index').length,beforeIndex)
 assert.equal((await execute('rp_source_search',{source_id:id,query:'online A',mode:'semantic'})).status,'awaiting-rebuild-confirmation')
 const firstOffer=offers.at(-1)
 current=sessions.get('first')
 assert.equal((await execute('rp_source_search',{source_id:id,query:'online B',mode:'hybrid'})).status,'awaiting-rebuild-confirmation')
 const secondOffer=offers.at(-1)
 assert.equal(requests.filter(r=>r.action==='rebuild').length,beforeRepair,'online query cannot rebuild before confirmation')
 await firstOffer.confirm()
 assert.equal(secondOffer.valid(),false,'one shared-asset rebuild invalidates confirmations from other sessions')
 await assert.rejects(secondOffer.confirm(),/已变化/)
 assert.equal(requests.filter(r=>r.action==='rebuild').length,beforeRepair+1,'two confirmations cannot pay for the same shared-asset rebuild twice')
 current={...sessions.get('other'),id:'fresh'};online=true;stale=true
 // Detached bindings retain manual pause. Use a genuinely fresh owner for the default.
 const autoView=await service.view(current)
 await service.mutate(current,{action:'auto-index-new-sources',enabled:true,expectedAutoIndexSettingsRevision:autoView.autoIndexSettingsRevision})
 const beforeAutoIndex=requests.filter(r=>r.action==='index').length,beforeAutoOffers=offers.length
 const autoAttached=await service.mutate(current,{action:'attach-source',assetId:sharedAsset.assetId,expectedLibraryRevision:autoView.library.revision})
 await new Promise(r=>setTimeout(r,50))
 assert.equal(requests.filter(r=>r.action==='index').length,beforeAutoIndex,'new binding of an incompatible online original must wait for rebuild consent')
 assert.equal(offers.length,beforeAutoOffers+1,'auto prepare surfaces a confirmation for the incompatible online original')
 await offers.at(-1).confirm()
 assert(requests.filter(r=>r.action==='index').length>beforeAutoIndex,'one explicit confirmation starts online preparation')
 assert.equal(autoAttached.selectedId,id)
 current.events=[{seq:0,type:'tool/call',data:{name:'rp_source_library',callId:'fresh-attach'}},{seq:1,type:'tool/result',data:{message:{source:{kind:'tool',callId:'fresh-attach'},content:[{type:'tool-result',toolCallId:'fresh-attach',content:[{type:'text',text:JSON.stringify({sourceId:id,attached:true})}]}]}}}]

 const cancelled=new AbortController();cancelled.abort();vectorCount=0
 await assert.rejects(tools.get('rp_source_index').execute({source_id:id,action:'wait'},{signal:cancelled.signal,agent:{session:current}}),{name:'AbortError'})
 console.log('card-adaptation-management=ok (regeneration reuse, root scope, CAS, manual pause, stale-only repair, roleplay tool boundary)')
}finally{cleanupTestDirectory(temp)}
