/** Full V3 Source compilation runs in this Node Worker. A complete DATA result
 * leaves it; neither a V2 partition nor author execution is synthesized here. */
import {parentPort,workerData} from 'node:worker_threads'
import {createBrowserCompilerV3} from './tavern-author-browser-compiler-v3.mjs'
import {createReaderRegexDocumentCompilerV1} from './reader-regex-document-compiler.mjs'
import {loadOwnedAuthorBrowserArtifactV3} from './tavern-author-browser-artifact-v3.mjs'
import type {BrowserCompilationInputV3,BrowserCompilationV3} from './tavern-author-browser-types-v3.mjs'
import type {ReaderRegexDocumentInputV1} from './reader-regex-document-types.mjs'

const port=parentPort
if(!port)throw Error('BROWSER_AST_WORKER_PORT_MISSING')
try {
  const artifact=loadOwnedAuthorBrowserArtifactV3()
  if(workerData?.encoding==='reader-regex-document-input-v1')
    port.postMessage(createReaderRegexDocumentCompilerV1(artifact).compile(workerData as ReaderRegexDocumentInputV1))
  else port.postMessage(createBrowserCompilerV3(artifact).compile(workerData as BrowserCompilationInputV3))
}catch(error) {
  const raw=error instanceof Error?error.message:''
  const result:BrowserCompilationV3={kind:'refused',
    diagnostics:[{code:/^BROWSER(?:3)?_[A-Z0-9_]+$/.test(raw)?raw:'BROWSER_AST_WORKER_FAILED'}]}
  port.postMessage(result)
}
