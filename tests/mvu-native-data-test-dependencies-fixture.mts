/** Canonical generated Core's pure Native-data imports for reducer tests.
 * Uses maintained hashes and strict parsers; no Agent, authority registration,
 * installed package tree or alternative runtime is created. */
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire,registerHooks} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createTestDirectory,cleanupTestDirectory} from '../src/operations/test-temp.mts'

export async function installMvuNativeDataTestDependencies() {
  const directory=createTestDirectory('mvu-native-data-')
  try {
    const require=createRequire(new URL('../build-tools/package.json',import.meta.url)),
      {build}=require('esbuild') as typeof import('esbuild'),
      input=fileURLToPath(new URL('../development/agent-loop/src/input-admission.ts',import.meta.url)),
      opening=fileURLToPath(new URL('../development/agent-loop/src/opening-record-hashes.ts',import.meta.url)),
      material=fileURLToPath(new URL('../development/agent-loop/src/request-material.ts',import.meta.url)),
      surface=fileURLToPath(new URL('../development/session/src/surface.ts',import.meta.url)),
      peer=path.join(directory,'native-pure-data.mjs'),
      generatedCore=new URL('../lib/core/',import.meta.url).href
    const result=await build({stdin:{contents:[
      `export {nativeInputSha256} from ${JSON.stringify(input)};`,
      `export {reconstructNativeRequestMaterialV1,verifyNativeRequestMaterialHistoryV1} from ${JSON.stringify(material)};`,
      `export {deriveEventMessage,foldSurface} from ${JSON.stringify(surface)};`,
      `export {validateNativeOpeningInvocationV1,validateNativeGeneratedOpeningReceiptV1,validateNativeOpeningClosingAckV1,validateNativeOpeningRequestAttemptV1}`+
        ` from ${JSON.stringify(opening)};`,
    ].join('\n'),resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'mvu-native-pure-data-entry.ts'},
    bundle:true,platform:'node',format:'esm',write:false,
    nodePaths:[fileURLToPath(new URL('../build-tools/node_modules/',import.meta.url))],
    plugins:[{name:'locked-mvu-native-data',setup(builder) {
      builder.onResolve({filter:/^@deepseek-ai\/dsh-session\/surface$/},()=>({
        path:fileURLToPath(new URL('../development/session/src/surface.ts',import.meta.url))}))
      builder.onResolve({filter:/^@deepseek-ai\/dsh-brand$/},()=>({
        path:pathToFileURL(require.resolve('@deepseek-ai/dsh-brand')).href,external:true}))
    }}]})
    assert.equal(result.outputFiles.length,1)
    await writeFile(peer,result.outputFiles[0]!.contents,{flag:'wx'})
    const hooks=registerHooks({resolve(specifier,context,next) {
      if((specifier==='@deepseek-ai/dsh-agent-loop'||specifier==='@deepseek-ai/dsh-session'
        ||specifier==='@deepseek-ai/dsh-session/surface')
        &&context.parentURL?.startsWith(generatedCore)) {
        return {url:pathToFileURL(peer).href,shortCircuit:true}
      }
      return next(specifier,context)
    }})
    return Object.assign(()=>{
      // Revoke the process-local hook before removing its owned module file.
      hooks.deregister()
      cleanupTestDirectory(directory)
    },{nativeDataModulePath:peer})
  }catch(error) {
    cleanupTestDirectory(directory)
    throw error
  }
}
