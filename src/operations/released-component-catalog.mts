/** Source-controlled publication facts. Candidate assembly only reads them;
 * a successful anonymous publication readback may append one immutable record. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
import {contained} from './public-transaction.mjs'
import type {PublishedReleaseCatalog,PublishedReleaseRecord} from './released-component-types.mjs'

export interface PublishedCatalogPlan {
  artifacts:readonly {id:string;source:string}[]
  product?:{publishedReleases?:{catalogArtifact:string}}
}
export function publishedCatalogFile(repo:string,plan:PublishedCatalogPlan):string|undefined {
  const id=plan.product?.publishedReleases?.catalogArtifact
  if(!id)return undefined
  const artifact=plan.artifacts.find(row=>row.id===id)
  if(!artifact)throw Error('Published component catalog is not registered in the source manifest')
  return contained(path.resolve(repo),artifact.source)
}
export function readPublishedReleaseCatalog(repo:string,plan:PublishedCatalogPlan):PublishedReleaseCatalog {
  const file=publishedCatalogFile(repo,plan)
  if(!file)return {schemaVersion:1,releases:[]}
  const value=JSON.parse(fs.readFileSync(file,'utf8')) as PublishedReleaseCatalog
  if(value.schemaVersion!==1||!Array.isArray(value.releases))throw Error('Unsupported published component catalog')
  return value
}
function identicalRecord(left:PublishedReleaseRecord,right:PublishedReleaseRecord) {
  // Publishing the same bytes through the second supported channel does not
  // replace the first publication fact or create another component generation.
  const identity=(row:PublishedReleaseRecord)=>({schemaVersion:row.schemaVersion,packageName:row.packageName,
    version:row.version,sourceCommit:row.sourceCommit,archive:{sha256:row.archive.sha256,bytes:row.archive.bytes,
      rootPrefix:row.archive.rootPrefix,inventoryPath:row.archive.inventoryPath},components:row.components,runtime:row.runtime})
  return JSON.stringify(identity(left))===JSON.stringify(identity(right))
}
export async function appendPublishedRelease(repo:string,plan:PublishedCatalogPlan,record:PublishedReleaseRecord) {
  const file=publishedCatalogFile(repo,plan)
  if(!file)throw Error('Register a published component catalog in the source manifest first')
  const require=createRequire(new URL('../../build-tools/package.json',import.meta.url))
  const {withFileLock}=require('@deepseek-ai/dsh-atomic-write') as {
    withFileLock<T>(file:string,run:()=>Promise<T>):Promise<T>
  }
  return withFileLock(file,async()=>{
    const catalog=readPublishedReleaseCatalog(repo,plan)
    const existing=catalog.releases.find(row=>row.packageName===record.packageName&&row.version===record.version)
    if(existing) {
      if(!identicalRecord(existing,record))throw Error('Published version already names a different archive or component closure')
      return {status:'already-recorded' as const,record:existing}
    }
    const next:PublishedReleaseCatalog={schemaVersion:1,releases:[...catalog.releases,record]}
    const temporary=path.join(path.dirname(file),'.'+path.basename(file)+'.'+randomUUID()+'.tmp')
    try {
      fs.writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'})
      fs.renameSync(temporary,file)
    }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
    return {status:'recorded' as const,record}
  })
}
