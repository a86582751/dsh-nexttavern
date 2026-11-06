/** Exercise the actual product library bytes, including Vue's DOM template
 * compiler. These deterministic author operations do not request a model. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {Script} from 'node:vm'
import type {ReaderNativeLibraryV1} from '../src/core/reader-native-document-types.js'

const repo=fileURLToPath(new URL('../../../',import.meta.url))
const require=createRequire(new URL('../build-tools/package.json',import.meta.url))
const {build}=require('esbuild'),{JSDOM}=require('jsdom')
const plan=JSON.parse(fs.readFileSync(path.join(repo,'release/source-manifest.json'),'utf8'))
const imports=plan.builds.find((row:any)=>row.browser?.textArtifactImports)?.browser.textArtifactImports as Record<string,string>
const compiled=await build({stdin:{contents:[
  'export {READER_NATIVE_DOCUMENT_LIBRARIES} from "./reader-native-document-libraries.ts";',
  'export {readerNativeDocumentHtml} from "./reader-native-document-frame.ts";',
  'export {authorNativeHelperBootstrap} from "./author-native-helper-frame.ts";',
  'export {createAuthorNativeMessageVariables} from "../core/author-native-message-variables.ts";',
  'export {createAuthorNativeCurrentRegex} from "../core/author-native-current-regex.ts";',
  'export {createAuthorNativeVariableWriters} from "../core/author-native-variable-writers.ts";',
  'export {createAuthorNativeMvuApi} from "./author-native-mvu-sdk.ts";',
  'export {createAuthorNativeEventOwner} from "./author-native-events.ts";',
  'export {createAuthorNativeScriptButtonCatalog} from "./author-native-script-buttons.ts";',
].join('\n'),resolveDir:fileURLToPath(new URL('../src/ui/',import.meta.url))},
  bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'registered-author-library-text',setup(builder:any){
    builder.onResolve({filter:/^dsh-nexttavern-reader-native-/},({path:specifier}:{path:string})=>{
      const artifact=plan.artifacts.find((row:any)=>row.id===imports[specifier])
      if(!artifact)throw Error('Unmapped product author library: '+specifier)
      return {path:path.join(repo,artifact.source),namespace:'author-library-text'}
    })
    builder.onLoad({filter:/.*/,namespace:'author-library-text'},({path:file}:{path:string})=>
      ({contents:fs.readFileSync(file,'utf8'),loader:'text'}))
  }}]})
const module={exports:{} as {READER_NATIVE_DOCUMENT_LIBRARIES:readonly ReaderNativeLibraryV1[];
  readerNativeDocumentHtml:typeof import('../src/ui/reader-native-document-frame.js').readerNativeDocumentHtml;
  authorNativeHelperBootstrap:typeof import('../src/ui/author-native-helper-frame.js').authorNativeHelperBootstrap;
  createAuthorNativeMvuApi:typeof import('../src/ui/author-native-mvu-sdk.js').createAuthorNativeMvuApi;
  createAuthorNativeEventOwner:typeof import('../src/ui/author-native-events.js').createAuthorNativeEventOwner;
  createAuthorNativeMessageVariables:typeof import('../src/core/author-native-message-variables.js').createAuthorNativeMessageVariables;
  createAuthorNativeCurrentRegex:typeof import('../src/core/author-native-current-regex.js').createAuthorNativeCurrentRegex;
  createAuthorNativeVariableWriters:typeof import('../src/core/author-native-variable-writers.js').createAuthorNativeVariableWriters;
  createAuthorNativeScriptButtonCatalog:typeof import('../src/ui/author-native-script-buttons.js').createAuthorNativeScriptButtonCatalog}}
new Script(compiled.outputFiles[0].text).runInNewContext({module,exports:module.exports})
const libraries=module.exports.READER_NATIVE_DOCUMENT_LIBRARIES

test('Native helper and Reader author code awaits installed libraries without numerical state',async t=>{
  const snapshot={scopeFrame:{scopes:{}},ordinaryChat:{values:{}},numerical:{kind:'blocked'},messages:[]}
  for(const kind of ['helper','reader'])await t.test(kind,async()=>{
    const api=module.exports
    const html=kind==='reader'?api.readerNativeDocumentHtml({origin:{message:{messageId:'library'}},html:''} as any,
      snapshot as any,'library'):'<!doctype html><iframe></iframe>'
    const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://author.invalid/',pretendToBeVisual:true})
    const window=kind==='reader'?dom.window:dom.window.document.querySelector('iframe').contentWindow
    try {
      window.structuredClone=structuredClone
      window.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}}
      if(kind==='reader')window.eval(window.document.querySelector('script').textContent)
      else window.eval('('+api.authorNativeHelperBootstrap.toString()+')('
        +[snapshot,'scope','library','helper',{pageId:'library'},[],[]].map(value=>JSON.stringify(value)).join(',')
        +',()=>({update(){},pause(){},dispose(){}}),{mode:"auto",viewportHeight:300},()=>Promise.resolve(),('
        +api.createAuthorNativeMvuApi.toString()+'),('+api.createAuthorNativeEventOwner.toString()+'),('
        +api.createAuthorNativeScriptButtonCatalog.toString()+'),[],('+api.createAuthorNativeMessageVariables.toString()+'),('
        +api.createAuthorNativeCurrentRegex.toString()+'),('+api.createAuthorNativeVariableWriters.toString()+'))')
      for(const library of libraries)window.eval(library.javascript)
      await window.eval('(async()=>{await waitGlobalInitialized("Mvu");await waitGlobalInitialized("YAML");'
        +'await waitGlobalInitialized("z");await waitGlobalInitialized("Vue");'
        +'window.authorValue=z.coerce.number().parse(YAML.parse("hp: 12").hp);'
        +'window.authorVue=Vue.version})()')
      assert.equal(window.authorValue,12)
      assert.equal(window.authorVue,'3.5.45')
      await assert.rejects(window.waitGlobalInitialized('MissingAuthorLibrary'),/GLOBAL_UNAVAILABLE/)
    }finally{dom.window.close()}
  })
})

function realm(){
  const dom=new JSDOM('<!doctype html><main id="app"></main>',{runScripts:'outside-only',url:'https://author.invalid/'})
  for(const library of libraries)dom.window.eval(library.javascript)
  return dom
}

test('product author libraries parse YAML anchors and validate data with real Zod transforms',()=>{
  const dom=realm(),window=dom.window
  try{
    const yaml=window.YAML.parse('base: &stats\n  hp: "12"\n  tags: [mage, healer]\ncopy: *stats\ntext: |\n  first\n  second\n')
    assert.equal(yaml.copy,yaml.base)
    assert.equal(yaml.text,'first\nsecond\n')
    const schema=window.z.object({hp:window.z.coerce.number().int().positive(),
      tags:window.z.array(window.z.string()).transform((values:string[])=>values.join('/'))})
    assert.equal(JSON.stringify(schema.parse(yaml.copy)),JSON.stringify({hp:12,tags:'mage/healer'}))
    const failed=schema.safeParse({hp:-1,tags:['mage']})
    assert.equal(failed.success,false)
    assert.equal(failed.error.issues[0].path[0],'hp')
    assert.deepEqual({...window.z.core.version},{major:4,minor:6,patch:5})
    assert.equal(window.$.fn.jquery,'3.7.1')
    assert.equal(window._.VERSION,'4.18.1')
  }finally{dom.window.close()}
})

test('product Vue compiles an author DOM template, reacts to clicks and unmounts',async()=>{
  const dom=realm(),window=dom.window
  try{
    assert.equal(window.Vue.version,'3.5.45')
    window.document.querySelector('#app').innerHTML='<button @click="count++">{{ count }}</button>'
    const app=window.Vue.createApp({data:()=>({count:0})})
    app.mount('#app')
    const button=window.document.querySelector('button')
    assert.equal(button.textContent,'0')
    button.click()
    await window.Vue.nextTick()
    assert.equal(button.textContent,'1')
    app.unmount()
    assert.equal(window.document.querySelector('#app').childNodes.length,0)
  }finally{dom.window.close()}
})
