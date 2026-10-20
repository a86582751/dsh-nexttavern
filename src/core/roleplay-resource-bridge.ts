import { realpathSync } from 'node:fs'
import { resolve, extname, basename } from 'node:path'
import { createTavernLibrary } from './tavern-library.js'
import { sha256, isPathWithin } from './roleplay-data.js'
import type { ResourceBridgeDependencies, ResourceSession, ResourceRecord } from './roleplay-resource-bridge-types.js'

type ArchivedCardIdentity=ReturnType<ReturnType<typeof createTavernLibrary>['archivalIdentity']>

export function createResourceBridge(deps: ResourceBridgeDependencies) {
  const { T } = deps
  const libraries = new Map<string, ReturnType<typeof createTavernLibrary>>()
  const libraryFor=(session: ResourceSession)=>{
    const workspace=realpathSync(session.header.cwd)
    if(!libraries.has(workspace))libraries.set(workspace,createTavernLibrary({workspace,table:T.branch}))
    return libraries.get(workspace)!
  }
  const resourceName=(name: unknown,extension='.md')=>`${String(name??'角色卡').normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').replace(/[. ]+$/,'').slice(0,90)||'角色卡'}${extension}`
  async function archiveImported(session: ResourceSession,record: ResourceRecord):Promise<ArchivedCardIdentity> {
    if(record.originalCardSource!==undefined)return originalCardResource(session,record)
    if(record.sourceEnvelope?.schemaVersion===2) {
      const resource=libraryFor(session).archivalIdentity(record.sourceEnvelope.transportResourceId)
      if(resource.fullSha256!==record.rawSha256||resource.bytes!==record.sourceEnvelope.transportBytes)
        throw new Error('入库原卡来源不匹配')
      return resource
    }
    const extension=record.sourceEnvelope?.extension??extname(record.sourceFile??'').toLowerCase()
    const bytes=record.sourceEnvelope?Buffer.from(record.sourceEnvelope.base64,'base64'):Buffer.from(record.rawSource!,'utf8')
    if(sha256(bytes)!==record.rawSha256)throw new Error('入库原卡哈希不匹配')
    // Library objects prepend their hash to the uploaded filename. Strip that
    // storage prefix only inside the owned object directory; ordinary source
    // filenames, including one that happens to start with a hash, stay literal.
    let filename=basename(record.sourceFile??'')
    if(record.sourceFile&&isPathWithin(resolve(session.header.cwd,'tavern-library','objects'),
      resolve(session.header.cwd,record.sourceFile)))filename=filename.replace(/^[a-f0-9]{64}--/i,'')
    const physicalExtension=extname(filename)
    const name=filename?(physicalExtension?filename.slice(0,-physicalExtension.length):filename):'角色卡'
    const type=extension==='.png'?'image/png':extension==='.json'?'application/json':extension==='.txt'?'text/plain'
      :extension==='.docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/markdown'
    const migrated=await libraryFor(session).migrate({id:`import-${record.importId}`,
      name:resourceName(name,physicalExtension||extension||'.md'),type,bytes,
      source:{sessionId:record.sessionId??session.id,kind:'card-import',importId:record.importId,sha256:record.rawSha256}})
    if(!migrated.ok)throw new Error('角色卡入库待重试')
    return libraryFor(session).archivalIdentity(migrated.resource.id!)
  }
  async function originalCardResource(session: ResourceSession,record: ResourceRecord):Promise<ArchivedCardIdentity> {
    const original=record.originalCardSource
    if(original===undefined)return archiveImported(session,record)
    if(original.schemaVersion!==1||original.encoding!=='nexttavern-original-card-source-v1')
      throw new Error('原上传角色卡来源版本无效')
    // A converted import's transport is its generated JSON. Its local source
    // reference alone identifies the earlier upload; never substitute transport
    // or reconstruct a PNG when that original resource is unavailable.
    let resource:ReturnType<ReturnType<typeof createTavernLibrary>['archivalIdentity']>
    try {resource=libraryFor(session).archivalIdentity(original.resourceId)}
    catch {throw new Error('原上传角色卡资源不存在，无法导出源文件')}
    if(resource.fullSha256!==original.sha256||resource.bytes!==original.bytes)
      throw new Error('原上传角色卡资源与来源记录不匹配')
    return resource
  }
  async function migrateResources(session: ResourceSession) {
    const library=libraryFor(session), workspace=realpathSync(session.header.cwd)
    for(const record of [...T.branch.values?.()??[...T.branch.entries()].map(([,v])=>v)]) {
      if(record?.importId&&record.status==='active'&&record.workspaceRoot===workspace)try{await archiveImported(session,record)}catch{}
      if(record?.exportId&&record.status==='completed'&&typeof record.file==='string'&&isPathWithin(workspace,resolve(record.file))) {
        await library.migrate({id:`export-${record.exportId}`,name:resourceName(record.title??'角色卡'),type:'text/markdown',path:record.file,
          source:{sessionId:record.branchId??session.id,kind:'card-export',exportId:record.exportId,sha256:record.resultHash}})
      }
    }
    return library
  }
  return { libraryFor, resourceName, archiveImported, originalCardResource, migrateResources }
}
