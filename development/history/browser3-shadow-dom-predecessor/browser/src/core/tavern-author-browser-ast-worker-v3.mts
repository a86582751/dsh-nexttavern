/** Full V3 Source compilation runs in this Node Worker. A complete DATA result
 * leaves it; neither a V2 partition nor author execution is synthesized here. */
import {parentPort,workerData} from 'node:worker_threads'
import {createBrowserCompilerV3} from './tavern-author-browser-compiler-v3.mjs'
import {loadOwnedAuthorBrowserArtifactV3} from './tavern-author-browser-artifact-v3.mjs'
import type {BrowserCompilationInputV3,BrowserCompilationV3} from './tavern-author-browser-types-v3.mjs'

const port=parentPort
if(!port)throw Error('BROWSER_AST_WORKER_PORT_MISSING')
try {
  const compiler=createBrowserCompilerV3(loadOwnedAuthorBrowserArtifactV3())
  port.postMessage(compiler.compile(workerData as BrowserCompilationInputV3))
}catch(error) {
  const raw=error instanceof Error?error.message:''
  const result:BrowserCompilationV3={kind:'refused',
    diagnostics:[{code:/^BROWSER(?:3)?_[A-Z0-9_]+$/.test(raw)?raw:'BROWSER_AST_WORKER_FAILED'}]}
  port.postMessage(result)
}
