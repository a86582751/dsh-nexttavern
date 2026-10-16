/** Test-process dependency ownership only. The actual product fixture resolves
 * its protected schema component physically; this hook never replaces it. */
import assert from 'node:assert/strict'
import {createRequire,registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'
import {readFile} from 'node:fs/promises'

const require=createRequire(new URL('../build-tools/package.json',import.meta.url))
assert.equal(require('yaml/package.json').version,'2.8.1')
export const lockedYamlTestModuleUrl=pathToFileURL(require.resolve('yaml')).href
const generatedCore=new URL('../lib/core/',import.meta.url).href

/** A DATA bundle's data: URL cannot replace a module's filesystem identity.
 * Resolve import.meta.url per actual source file before bundling, preserving
 * both artifact-relative URLs and createRequire without substituting exports. */
export function sourceModuleUrlTestPlugin():import('esbuild').Plugin {
  const {transform}=require('esbuild') as typeof import('esbuild')
  return {name:'actual-source-module-urls',setup(builder) {
    builder.onLoad({filter:/\.(?:[cm]?ts|[cm]?js)$/,namespace:'file'},async args=>{
      const contents=await readFile(args.path,'utf8')
      if(!contents.includes('import.meta.url'))return undefined
      const transformed=await transform(contents,{sourcefile:args.path,
        loader:/\.[cm]?ts$/.test(args.path)?'ts':'js',
        define:{'import.meta.url':JSON.stringify(pathToFileURL(args.path).href)}})
      return {contents:transformed.code,loader:'js'}
    })
  }}
}

/** Install before dynamic generated imports and revoke at test teardown. The
 * one locked YAML dependency is scoped to canonical generated Core modules. */
export function installSchemaTestDependencies() {
  const hooks=registerHooks({resolve(specifier,context,next){
    if(specifier==='yaml'&&context.parentURL?.startsWith(generatedCore)) {
      return {url:lockedYamlTestModuleUrl,shortCircuit:true}
    }
    return next(specifier,context)
  }})
  return ()=>hooks.deregister()
}
