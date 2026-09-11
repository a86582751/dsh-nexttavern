import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync,lstatSync,realpathSync,openSync,writeFileSync,closeSync,readFileSync,constants,fsyncSync,linkSync,unlinkSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {fenceCardContent} from './tavern-card.js'
const hash = value => createHash('sha256').update(value).digest('hex')
const safeHeading = value => String(value ?? '').replace(/[\r\n\x00-\x1f]/g,' ').replace(/^#+\s*/,'').trim().slice(0,200)
const sourceLines=text=>text.match(/[^\n]*\n|[^\n]+$/g)??['']
export const stableJson = value => JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b,'en'))):v)

export function exportSnapshot(branchId, material) {
  const units = material.map((item,index) => ({id:`source-${index+1}`, label:item.label,
    text:item.text, source:item.source, sha256:hash(item.text)}))
  if (!units.length || units.length>4096 || units.some(u=>typeof u.text!=='string')) throw new Error('没有可导出的设定或条目超限')
  const text = units.map(u=>`[${u.id}] ${u.label}\n${u.text}\n`).join('\n')
  if (text.length>10_000_000) throw new Error('导出设定超过字符上限，请分卡整理；不会静默精简')
  return {schemaVersion:1,branchId,units,text,sourceHash:hash(stableJson(material))}
}

export function renderOrganizedExport(snapshot, title, sections) {
  if (!Array.isArray(sections) || !sections.length || sections.length>4096) throw new Error('需要 LLM 提交章节组织方案')
  const sources=new Map(snapshot.units.map(u=>[u.id,u])), used=new Map(), lineCache=new Map(), output=[`# ${safeHeading(title) || '角色扮演设定'}\n`]
  let references=0
  for (const section of sections) {
    if (!safeHeading(section.heading) || (section.source_ids!==undefined&&!Array.isArray(section.source_ids)) || (section.source_parts!==undefined&&!Array.isArray(section.source_parts))) throw new Error('章节缺少标题或来源')
    const requested=[...(section.source_ids??[]).map(source_id=>({source_id})),...(section.source_parts??[])]
    if(!requested.length||(references+=requested.length)>16384)throw new Error('章节缺少来源或引用数量超限')
    const parts=[]
    for (const ref of requested) {
      const id=ref?.source_id
      if (!sources.has(id)) throw new Error('导出章节来源重复或不存在')
      const unit=sources.get(id)
      if(!lineCache.has(id)){if(hash(unit.text)!==unit.sha256)throw new Error('导出来源哈希不一致');lineCache.set(id,sourceLines(unit.text))}
      const lines=lineCache.get(id),start=ref.start_line??1,end=ref.end_line??lines.length
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>lines.length)throw new Error('导出来源行号跨度无效')
      const spans=used.get(id)??[]
      if(spans.some(s=>start<=s.end&&end>=s.start))throw new Error('导出章节来源重复或重叠')
      spans.push({start,end});used.set(id,spans)
      parts.push(lines.slice(start-1,end).join(''))
    }
    output.push(`## ${safeHeading(section.heading)}\n\n${parts.join('\n\n')}\n`)
  }
  if (used.size!==sources.size) throw new Error('导出必须覆盖全部当前设定，不能漏项或精简')
  for(const [id,spans]of used){let next=1;for(const s of spans.sort((a,b)=>a.start-b.start)){if(s.start!==next)throw new Error('导出来源有漏行，必须覆盖全部原文');next=s.end+1}if(next!==sourceLines(sources.get(id).text).length+1)throw new Error('导出来源有漏行，必须覆盖全部原文')}
  output.push(`<!-- dsh-export schemaVersion=1 sourceHash=${snapshot.sourceHash} sources=${used.size} -->\n`)
  return output.join('\n')
}

function writeExport(cwd,id,markdown) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('导出标识无效')
  const root=realpathSync(resolve(cwd)), directory=join(root,'.dsh-card-exports')
  try {mkdirSync(directory)} catch(error) {if(error.code!=='EEXIST')throw error}
  if(lstatSync(directory).isSymbolicLink() || realpathSync(directory)!==directory) throw new Error('导出目录不能是符号链接')
  const file=join(directory,`${id}.md`)
  let fd, directoryFd, temporary
  try {
    // On Linux the directory descriptor pins the verified parent even if its
    // path is concurrently renamed. Windows gets strict pre/post path checks.
    if(process.platform==='linux')directoryFd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW)
    const accessDirectory=directoryFd===undefined?directory:`/proc/self/fd/${directoryFd}`
    if(realpathSync(accessDirectory)!==directory)throw new Error('导出目录在写入前改变')
    const target=join(accessDirectory,`${id}.md`)
    temporary=join(accessDirectory,`${id}.${randomUUID()}.tmp`)
    fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600)
    writeFileSync(fd,markdown,'utf8')
    fsyncSync(fd); closeSync(fd); fd=undefined
    try {linkSync(temporary,target)} catch(error) {
      if(error.code!=='EEXIST')throw error
      if(lstatSync(target).isSymbolicLink()||hash(readFileSync(target))!==hash(markdown))throw new Error('导出文件已存在且内容不同，拒绝覆盖')
    }
    if(realpathSync(directory)!==directory||realpathSync(accessDirectory)!==directory)throw new Error('导出目录在写入期间改变')
    if(directoryFd!==undefined)fsyncSync(directoryFd)
  } finally {
    if(fd!==undefined)closeSync(fd)
    if(temporary)try{unlinkSync(temporary)}catch{}
    if(directoryFd!==undefined)closeSync(directoryFd)
  }
  return file
}

export function registerCardExport(ctx,{simpleTool,sessionOf,table,collect,lock,onCompleted,workflowOf,workflowGeneration,beforeBegin,assertWorkflow,classificationGuide=''}) {
  const key=(session,id)=>`${session.id}__export-${id}`
  const get=(session,id)=>{
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('export_id 无效')
    const record=table.get(key(session,id))
    assertWorkflow?.(session,record)
    if(record?.schemaVersion!==1||record.branchId!==session.id)throw new Error('当前分支没有该导出')
    if(record.sourceHash!==hash(stableJson(record.material)))throw new Error('导出快照损坏')
    const expected=exportSnapshot(session.id,record.material)
    if(record.text!==expected.text||JSON.stringify(record.units)!==JSON.stringify(expected.units))throw new Error('导出正文或来源映射损坏')
    return record
  }
  const tool=(name,description,properties,required,run)=>ctx.effect(()=>ctx.tools.register(simpleTool(name,description,
    {type:'object',properties,required,additionalProperties:false},async(args,exec)=>{
      const session=await sessionOf(exec)
      if(name==='rp_card_export_begin'&&beforeBegin){const diverted=await beforeBegin(session,exec);if(diverted)return diverted}
      try{return await lock(session.id,'export',()=>run(session,args))}catch(error){return {ok:false,error:error.code?'导出文件写入失败，请检查工作区权限':String(error.message)}}
    })),`roleplay: tool ${name}`)
  tool('rp_card_export_begin','开始逆向组卡：冻结当前分支已编辑的全部设定。必须由 LLM 分页全文审阅，再组织统一 Markdown 章节；不能摘要、漏项或用旧原件覆盖新设定。',{},[],async session=>{
    const workflowId=workflowOf?.(session)
    const prior=workflowId?[...table.entries()].map(([,v])=>v).find(v=>v?.workflowId===workflowId&&v.exportId):null
    if(prior)return {ok:true,exportId:prior.exportId,sourceHash:prior.sourceHash,totalChars:prior.text.length,nextCursor:prior.nextCursor,reviewComplete:prior.reviewComplete,sources:prior.units.map(({id,label,text,sha256})=>({id,label,chars:text.length,sha256})),resumed:true}
    const material=await collect(session), snapshot=exportSnapshot(session.id,material), id=randomUUID()
    const record={...snapshot,exportId:id,workflowId,workflowGeneration:workflowGeneration?.(session),material,nextCursor:0,reviewComplete:false,status:'reviewing',createdAt:Date.now()}
    await table.put(key(session,id),record)
    return {ok:true,exportId:id,sourceHash:snapshot.sourceHash,totalChars:snapshot.text.length,nextCursor:0,
      sources:snapshot.units.map(({id,label,text,sha256})=>({id,label,chars:text.length,sha256}))}
  })
  tool('rp_card_export_chunk','连续审阅导出快照；按 nextCursor 读到 null。全文读完后，可传 source_id/start_line/max_lines 回看单个来源的带行号原文，用于按创作语义拆分混合内容。',{export_id:{type:'string'},cursor:{type:'integer'},source_id:{type:'string'},start_line:{type:'integer',minimum:1},max_lines:{type:'integer',minimum:1,maximum:200}},['export_id'],async(session,args)=>{
    const record=get(session,args.export_id), cursor=args.cursor
    if(args.source_id!==undefined){
      if(!record.reviewComplete)throw new Error('拆分来源前必须连续审阅完整快照')
      const unit=record.units.find(u=>u.id===args.source_id)
      if(!unit)throw new Error('来源不存在')
      const lines=sourceLines(unit.text),start=args.start_line??1,max=Math.min(200,Math.max(1,args.max_lines??100))
      if(!Number.isSafeInteger(start)||start<1||start>lines.length||!Number.isSafeInteger(max))throw new Error('来源行号无效')
      let end=start-1,size=0
      while(end<lines.length&&end<start+max-1&&size+lines[end].length<16000){size+=lines[end].length;end++}
      if(end<start)throw new Error('此来源单行超过带行号预览上限；请使用已审阅快照，将完整 source_id 归入合适章节')
      return {ok:true,sourceId:unit.id,sha256:unit.sha256,lineCount:lines.length,startLine:start,endLine:end,nextLine:end<lines.length?end+1:null,text:fenceCardContent(lines.slice(start-1,end).map((line,i)=>`${start+i}: ${line}`).join(''),'source')}
    }
    if(!Number.isSafeInteger(cursor)||cursor<0||cursor>=record.text.length)throw new Error('导出 cursor 无效')
    if(!record.reviewComplete&&cursor!==record.nextCursor&&cursor!==record.lastCursor)throw new Error('导出审阅不能跳页')
    const end=Math.min(record.text.length,cursor+16000), text=record.text.slice(cursor,end)
    const next={...record,lastCursor:cursor,nextCursor:end===record.text.length?null:end,reviewComplete:end===record.text.length||record.reviewComplete}
    if(cursor===record.nextCursor)await table.put(key(session,args.export_id),next)
    return {ok:true,text:fenceCardContent(text,'source'),nextCursor:cursor===record.nextCursor?next.nextCursor:record.nextCursor,
      sourceHash:record.sourceHash,reviewComplete:next.reviewComplete}
  })
  tool('rp_card_export_finalize','提交 LLM 完整审阅后的章节结构。按内容语义重组，用户新增镜头语言归入叙事规则，不照搬存储栏目。完整来源用 source_ids；混合来源先 chunk(source_id) 读行号，再用 source_parts 按行拆到不同章节。每项每行必须恰好覆盖一次；后端原样物化，不接受摘要替换。\n'+classificationGuide,{
    export_id:{type:'string'},expected_sha256:{type:'string'},title:{type:'string'},sections:{type:'array',items:{type:'object',properties:{heading:{type:'string'},source_ids:{type:'array',items:{type:'string'}},source_parts:{type:'array',items:{type:'object',properties:{source_id:{type:'string'},start_line:{type:'integer'},end_line:{type:'integer'}},required:['source_id','start_line','end_line'],additionalProperties:false}}},required:['heading'],additionalProperties:false}}
  },['export_id','expected_sha256','title','sections'],async(session,args)=>{
    const record=get(session,args.export_id)
    if(!record.reviewComplete||record.nextCursor!==null)throw new Error('导出前必须完整审阅')
    if(args.expected_sha256!==record.sourceHash)throw new Error('导出来源哈希不匹配')
    if(!['committing','completed'].includes(record.status)&&hash(stableJson(await collect(session)))!==record.sourceHash)throw new Error('设定在导出期间已修改，请重新开始以保留最新编辑')
    const markdown=renderOrganizedExport(record,args.title,args.sections), resultHash=hash(markdown)
    if(record.resultHash&&record.resultHash!==resultHash)throw new Error('已完成导出不能被不同章节方案覆盖，请重新开始')
    if(record.status!=='completed')await table.put(key(session,record.exportId),{...record,status:'committing',resultHash,sections:args.sections,title:args.title,preparedAt:record.preparedAt??Date.now()})
    assertWorkflow?.(session,record)
    const file=writeExport(session.header.cwd,record.exportId,markdown)
    await table.put(key(session,record.exportId),{...record,status:'completed',resultHash,file,title:args.title,sections:args.sections,completedAt:record.completedAt??Date.now()})
    assertWorkflow?.(session,record)
    const resource=await onCompleted?.(session,{...record,title:args.title,file,resultHash},markdown)
    const filename=resource?.name??`${safeHeading(args.title).replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').slice(0,90)}.md`
    return {ok:true,exportId:record.exportId,file,filename,resourceId:resource?.id,
      ...(resource?.id?{downloadUrl:`/api/roleplay/download?sessionId=${encodeURIComponent(session.id)}&resourceId=${encodeURIComponent(resource.id)}`} : {}),
      displayInstruction:'向玩家展示 filename 和下载链接；内部 file/UUID 仅用于归档，不作为文件名回复。文件已存入酒馆资源库，可按名称查找。',
      sha256:resultHash,sourceHash:record.sourceHash,coverage:1,bytes:Buffer.byteLength(markdown),sourceCount:record.units.length}
  })
}
