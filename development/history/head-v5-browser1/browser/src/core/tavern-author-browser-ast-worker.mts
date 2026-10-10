/** A real worker owns the complete AST operation and the constructor-private
 * batch. Only finished DATA leaves this process; author code is never run. */
import {parentPort,workerData} from 'node:worker_threads'
import {createBrowserCompilerV1} from './tavern-author-browser-compiler.mjs'
import {loadOwnedAuthorBrowserArtifactV1} from './tavern-author-browser-artifact.mjs'
import type {BrowserCompilationInputV1,BrowserPartitionV1} from './tavern-author-browser-types.mjs'

const port=parentPort
if(!port)throw Error('BROWSER_AST_WORKER_PORT_MISSING')
try {
  const compiler=createBrowserCompilerV1(loadOwnedAuthorBrowserArtifactV1())
  const batch=compiler.compileCandidates(workerData as BrowserCompilationInputV1)
  const browserOrdinals=batch.rows.filter(row=>row.kind==='compiled'||row.kind==='disabled').map(row=>row.ordinal)
  const serverOrdinals=batch.rows.filter(row=>row.kind==='refused'&&row.descriptor.enabled).map(row=>row.ordinal)
  if(browserOrdinals.length) {
    const assembled=compiler.assembleAccepted(batch,browserOrdinals)
    const result:BrowserPartitionV1=assembled.kind==='refused'?assembled:{kind:'partitioned',source:batch.source,
      browserProgram:assembled.program,serverOrdinals}
    port.postMessage(result)
  }else port.postMessage({kind:'partitioned',source:batch.source,browserProgram:null,serverOrdinals} satisfies BrowserPartitionV1)
}catch(error) {
  const raw=error instanceof Error?error.message:''
  const result:BrowserPartitionV1={kind:'refused',
    diagnostics:[{code:/^BROWSER_[A-Z0-9_]+$/.test(raw)?raw:'BROWSER_AST_WORKER_FAILED'}]}
  port.postMessage(result)
}

