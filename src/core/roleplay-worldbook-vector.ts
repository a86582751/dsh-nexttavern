/** A prompt borrows the shared embedding owner with its actual bound books.
 * Similarity supplies external WI candidates. The existing evaluator retains
 * every probability, group, budget and timed decision. */
import {recordSha256} from './roleplay-data.js'
import type {createMemoryRetrieval} from '../memory/memory-retrieval.js'
import type {WorldbookVectorSourceV1} from '../memory/memory-retrieval-types.js'
import type {TavernSourceRenderCatalogV1} from './tavern-source-render-catalog.mjs'
import type {TavernLoreVectorSelectionV1,TavernLoreVisibleMessageV1} from './tavern-lore-evaluator-types.mjs'
import type {createTavernLoreSourceEligibilityV1} from './tavern-lore-derived.mjs'

type Retrieval=ReturnType<typeof createMemoryRetrieval>
export type RoleplayWorldbookVectorMessageV1=Pick<TavernLoreVisibleMessageV1,'messageId'|'versionSha256'|'role'|'text'>
  & {readonly kind:'native'|'request'}
export interface RoleplayWorldbookVectorAccessV1 {
  configuration:Retrieval['worldbookConfiguration']
  query(sessionId:string,input:Parameters<Retrieval['worldbook']>[1]):ReturnType<Retrieval['worldbook']>
}
export interface RoleplayWorldbookVectorMemoV1 {
  capture?:{readonly key:string;readonly current:()=>boolean;
    readonly pending:Promise<TavernLoreVectorSelectionV1|undefined>}
}
export async function prepareRoleplayWorldbookVectorsV1(input:{
  readonly access:RoleplayWorldbookVectorAccessV1
  readonly catalog:TavernSourceRenderCatalogV1
  readonly operationId:string
  readonly basisSha256:string
  messages(count:number):readonly RoleplayWorldbookVectorMessageV1[]
  readonly eligible:ReturnType<typeof createTavernLoreSourceEligibilityV1>
  readonly signal:AbortSignal
  readonly memo?:RoleplayWorldbookVectorMemoV1
  current():void
  project(rows:readonly {key:string;content:string;depth:number;role:'system'|'user'|'assistant'}[])
    :Promise<readonly {key:string;text:string;projectionSha256:string}[]>
}):Promise<TavernLoreVectorSelectionV1|undefined> {
  const configuration=input.access.configuration()
  if(!configuration.settings.enabled)return undefined
  const {catalog}=input,{source,plan}=catalog,
    key=recordSha256({operationId:input.operationId,basis:input.basisSha256,
      source:source.sourceSha256,plan:plan.planSha256,settingsRevision:configuration.revision,
      providerId:configuration.providerId}),previous=input.memo?.capture
  if(previous?.key===key&&previous.current())return previous.pending
  const current=()=>{
    input.signal.throwIfAborted()
    input.current()
    if(!configuration.current())throw Error('WORLDBOOK_VECTOR_CONFIGURATION_CHANGED')
  }
  const pending=(async()=>{
    current()
    const versions=new Map((plan.boundBooks??[]).map(book=>[book.plan.bookId,
      book.plan.source.encoding==='author-worldbook-source-reference-v1'?book.plan.source.contentRef.sha256:null])),
      candidates=catalog.entries.filter(row=>row.semantic.enabled&&input.eligible(row.entry)
        &&(configuration.settings.enabledForAll||row.semantic.vectorized)&&row.resolved.text.trim()),
      sources:WorldbookVectorSourceV1[]=candidates.map(row=>{
        const bookVersion=versions.get(row.bookId)
        if(!bookVersion)throw Error('WORLDBOOK_VECTOR_CATALOG_UNAVAILABLE')
        return {id:row.entry.entryId,bookId:row.bookId,bookVersion,
          contentSha256:row.resolved.contentSha256,text:row.resolved.text}
      })
    if(!sources.length)return undefined
    const messages=input.messages(configuration.settings.queryMessages),
      projected=await input.project(messages.map((row,depth)=>({key:`worldbook-query:${depth}`,
        content:row.text,depth,role:row.role})))
    current()
    const result=await input.access.query(source.sessionId,{operationId:input.operationId,sources,
      query:projected.map(row=>row.text).filter(text=>text.trim()).join('\n'),signal:input.signal,
      current:()=>{current();return true}})
    current()
    const byId=new Map(candidates.map(row=>[row.entry.entryId,row])),
      activations=result.status==='ready'?result.hits.map(hit=>{
        const row=byId.get(hit.id)
        if(!row||row.resolved.contentSha256!==hit.contentSha256)throw Error('WORLDBOOK_VECTOR_SOURCE_CHANGED')
        const {entry}=row
        return {entryId:entry.entryId,rawEntrySha256:entry.rawEntrySha256,score:hit.score}
      }):[]
    return {schemaVersion:1 as const,encoding:'native-worldbook-vector-selection-v1' as const,
      sourceSnapshotSha256:source.sourceSha256,messages:messages.map((row,index)=>({kind:row.kind,messageId:row.messageId,
        versionSha256:row.versionSha256,projectionSha256:projected[index]!.projectionSha256})),result,activations}
  })()
  if(input.memo)input.memo.capture={key,current:configuration.current,pending}
  return pending
}
