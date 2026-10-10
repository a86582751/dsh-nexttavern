/** A real worker owns the complete AST operation and the constructor-private
 * batch. Only finished DATA leaves this process; author code is never run. */
import {parentPort,workerData} from 'node:worker_threads'
import {createBrowserCompilerV2} from './tavern-author-browser-compiler-v2.mjs'
import {loadOwnedAuthorBrowserArtifactV2} from './tavern-author-browser-artifact-v2.mjs'
import type {BrowserCompilationInputV2,BrowserPartitionV2} from './tavern-author-browser-types-v2.mjs'

const port=parentPort
if(!port)throw Error('BROWSER_AST_WORKER_PORT_MISSING')
try {
  const compiler=createBrowserCompilerV2(loadOwnedAuthorBrowserArtifactV2())
  const batch=compiler.compileCandidates(workerData as BrowserCompilationInputV2)
  const browserOrdinals=batch.rows.filter(row=>row.kind==='compiled'||row.kind==='disabled').map(row=>row.ordinal)
  const serverOrdinals=batch.rows.filter(row=>row.kind==='refused'&&row.descriptor.enabled).map(row=>row.ordinal)
  if(browserOrdinals.length) {
    const assembled=compiler.assembleAccepted(batch,browserOrdinals)
    const result:BrowserPartitionV2=assembled.kind==='refused'?assembled:{kind:'partitioned',source:batch.source,
      browserProgram:assembled.program,serverOrdinals}
    port.postMessage(result)
  }else port.postMessage({kind:'partitioned',source:batch.source,browserProgram:null,serverOrdinals} satisfies BrowserPartitionV2)
}catch(error) {
  const raw=error instanceof Error?error.message:''
  const result:BrowserPartitionV2={kind:'refused',
    diagnostics:[{code:/^BROWSER_[A-Z0-9_]+$/.test(raw)?raw:'BROWSER_AST_WORKER_FAILED'}]}
  port.postMessage(result)
}


