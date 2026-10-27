import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {prepareProduct} from './prepare-product.mts'

test('public Android product preparation uses only its projected plan and declared delivery files',()=>{
  const checkout=path.resolve(import.meta.dirname,'../..')
  const rootMetadata=JSON.parse(fs.readFileSync(path.join(checkout,
    fs.existsSync(path.join(checkout,'release/source-manifest.json'))?'runtime/alpha3/product/package.json':'package.json'),'utf8'))
  const system='@deepseek-ai/node-addon-system'
  assert.equal(rootMetadata.dependencies?.[system],undefined,'the Host owns the system package; no second root install')
  assert.equal(rootMetadata.peerDependencies?.[system],'0.1.2')
  const base=path.resolve(import.meta.dirname,'../../artifacts/test-temp')
  fs.mkdirSync(base,{recursive:true})
  const root=fs.mkdtempSync(path.join(base,'public-android-product-')),repo=path.join(root,'public'),output=path.join(root,'product')
  const save=(file:string,value:unknown)=>{const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value))}
  try {
    const name='dsh-nexttavern-fixture'
    save('package.json',{name:'dsh-nexttavern',version:'0.3.0-rc.1',files:['lib','node_modules','nexttavern.dependencies.json'],dependencies:{[name]:'1.0.0'},peerDependencies:{[system]:rootMetadata.peerDependencies[system]},bundleDependencies:[name]})
    save('LICENSE','fixture license'); save('lib/index.js','export const fixture=true;\n')
    save('cordis.patch.json',[])
    save('development/fixture/package.json',{name,version:'1.0.0'})
    save('development/fixture/index.js','export default 1;\n')
    save('tests/should-not-ship.txt','not runtime')
    save('tools/build-map.json',{compilerPlan:{artifacts:[
      {id:'root',source:'package.json'},{id:'patch',source:'cordis.patch.json'},
      {id:'owned',source:'development/fixture/package.json'},
      {id:'owned-js',source:'development/fixture/index.js'},
    ],builds:[],product:{packageArtifact:'root',patchArtifact:'patch',packages:[{packageArtifact:'owned',resources:[{artifact:'owned-js',path:'index.js'}]}]},
    publicRelease:{packageName:'dsh-nexttavern',candidateVersion:'0.3.0-rc.1'}}})
    const result=prepareProduct({repo,output,abi:'x64',archives:{}})
    assert.equal(result.packages,1)
    assert.equal(fs.existsSync(path.join(output,'node_modules',system)),false,'shared Host peer is not materialized in the product')
    assert.equal(fs.existsSync(path.join(repo,'release/source-manifest.json')),false)
    assert.equal(fs.existsSync(path.join(output,'tests')),false)
    assert.equal(fs.readFileSync(path.join(output,'node_modules',name,'index.js'),'utf8'),'export default 1;\n')
    const inventory=JSON.parse(fs.readFileSync(path.join(output,'nexttavern.dependencies.json'),'utf8'))
    assert.equal(inventory.packages[0].name,name)
    assert.throws(()=>prepareProduct({repo,output,abi:'x64',archives:{}}),/EEXIST/)
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})
