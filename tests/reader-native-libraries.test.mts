/** Exercise the actual product library bytes, including Vue's DOM template
 * compiler. These deterministic author operations do not request a model. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {Script} from 'node:vm'
import {createHash} from 'node:crypto'
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
  'export {createAuthorNativeGenerationApi} from "../core/author-native-generation-api.ts";',
  'export {createAuthorNativeMessageVariables} from "../core/author-native-message-variables.ts";',
  'export {createAuthorNativeCurrentRegex,createAuthorNativeFormatterV1} from "../core/author-native-current-regex.ts";',
  'export {TAVERN_PROMPT_TRANSFORM_LIMITS_V1} from "../core/tavern-prompt-transform-types.mts";',
  'export {communityDefaultPresetDataV1} from "../core/community-preset-types.ts";',
  'export {createAuthorNativeVariableWriters} from "../core/author-native-variable-writers.ts";',
  'export {createAuthorNativeMvuApi} from "./author-native-mvu-sdk.ts";',
  'export {createAuthorNativeEventOwner} from "./author-native-events.ts";',
  'export {createAuthorNativeScriptButtonCatalog} from "./author-native-script-buttons.ts";',
  'export {AUTHOR_NATIVE_MVU_HOOK_EVENTS} from "../core/author-native-mvu-hook-types.ts";',
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
  createAuthorNativeGenerationApi:typeof import('../src/core/author-native-generation-api.js').createAuthorNativeGenerationApi;
  createAuthorNativeMvuApi:typeof import('../src/ui/author-native-mvu-sdk.js').createAuthorNativeMvuApi;
  createAuthorNativeEventOwner:typeof import('../src/ui/author-native-events.js').createAuthorNativeEventOwner;
  createAuthorNativeMessageVariables:typeof import('../src/core/author-native-message-variables.js').createAuthorNativeMessageVariables;
  createAuthorNativeCurrentRegex:typeof import('../src/core/author-native-current-regex.js').createAuthorNativeCurrentRegex;
  createAuthorNativeFormatterV1:typeof import('../src/core/author-native-current-regex.js').createAuthorNativeFormatterV1;
  TAVERN_PROMPT_TRANSFORM_LIMITS_V1:typeof import('../src/core/tavern-prompt-transform-types.mjs').TAVERN_PROMPT_TRANSFORM_LIMITS_V1;
  communityDefaultPresetDataV1:typeof import('../src/core/community-preset-types.js').communityDefaultPresetDataV1;
  createAuthorNativeVariableWriters:typeof import('../src/core/author-native-variable-writers.js').createAuthorNativeVariableWriters;
  createAuthorNativeScriptButtonCatalog:typeof import('../src/ui/author-native-script-buttons.js').createAuthorNativeScriptButtonCatalog}}
new Script(compiled.outputFiles[0].text).runInNewContext({module,exports:module.exports,structuredClone})
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
      window.TextEncoder=TextEncoder
      window.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}}
      if(kind==='reader')window.eval(window.document.querySelector('script').textContent)
      else window.eval('('+api.authorNativeHelperBootstrap.toString()+')('
        +[snapshot,'scope','library','helper',{pageId:'library'},[],[]].map(value=>JSON.stringify(value)).join(',')
        +',()=>({update(){},pause(){},dispose(){}}),{mode:"auto",viewportHeight:300},()=>Promise.resolve(),('
        +api.createAuthorNativeMvuApi.toString()+'),('+api.createAuthorNativeEventOwner.toString()+'),('
        +api.createAuthorNativeScriptButtonCatalog.toString()+'),[],('+api.createAuthorNativeMessageVariables.toString()+'),('
        +api.createAuthorNativeCurrentRegex.toString()+'),('+api.createAuthorNativeVariableWriters.toString()+'),false,undefined,undefined,'
        +JSON.stringify(api.communityDefaultPresetDataV1())+',('+api.createAuthorNativeFormatterV1.toString()+'),'
        +JSON.stringify(api.TAVERN_PROMPT_TRANSFORM_LIMITS_V1)+',undefined,('
        +api.createAuthorNativeGenerationApi.toString()+'),undefined,undefined,'
        +JSON.stringify(api.AUTHOR_NATIVE_MVU_HOOK_EVENTS)+')')
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
  dom.window.TextEncoder=TextEncoder
  for(const library of libraries)dom.window.eval(library.javascript)
  return dom
}

test('serialized Reader formatter consumes real libraries, regexes and selected message overlays synchronously',()=>{
  const binding=(key:string,value:string)=>({key,value,valueSha256:'captured',read:{kind:'variable',purpose:'read',
    scope:'card',ownerId:'formatter-card',key,present:true,versionSha256:'captured',valueSha256:'captured',
    entryId:null,sourcePointer:null}})
  const names=Object.fromEntries(Object.entries({user:'Player',char:'Captain',group:'Captain',
    charIfNotGroup:'Captain',groupNotMuted:'Captain',notChar:'Player',model:'captured-model'})
    .map(([key,value])=>[key,binding(key,value)]))
  const target=(nativeSeq:number,messageId:string)=>({kind:'message',
    identity:{ownerSessionId:'formatter-session',nativeSeq,messageId,variant:{kind:'native-canonical'}}})
  const firstTarget=target(900,'first'),secondTarget=target(1700,'second')
  const ordinary=(selectedTarget:any,values:any,deletedKeys:string[]=[])=>({schemaVersion:3,authority:'consumer-data-only',
    exists:true,scopeRef:null,root:{namespace:{schemaVersion:3,sessionId:'formatter-session',importIncarnation:null,
      target:selectedTarget},head:{key:selectedTarget.identity.messageId+'-ordinary',sha256:'captured'},base:null},values,deletedKeys})
  const message=(index:number,selectedTarget:any,values:any)=>({index,...selectedTarget.identity,
    messageVersionSha256:'message-version-'+index,role:'assistant',message:'captured message',
    variables:{kind:'available',variables:values},ordinary:{selectedTarget,variants:[]},variants:null})
  const snapshot={scopeFrame:{scopes:{}},ordinaryChat:{values:{score:7}},
    sharedScopes:{global:{values:{flag:true}}},numerical:{kind:'blocked'},
    messages:[message(0,firstTarget,{value:'first',stat_data:{hp:1},removed:'base'}),
      message(1,secondTarget,{value:'second',stat_data:{hp:2}}),
      {index:2,messageId:'latest-empty',ownerSessionId:'formatter-session',nativeSeq:2400,
        messageVersionSha256:'message-version-2',role:'assistant',message:'no variables',
        variables:{kind:'unavailable',code:'MESSAGE_STATE_UNAVAILABLE'},variants:null}],
    ordinaryMessages:[ordinary(firstTarget,{value:'ordinary first',stat_data:{hp:999},
      details:{label:'ordinary',nested:{$private:'hidden',visible:3}}},['removed']),
      ordinary(secondTarget,{value:'ordinary second'})],
    formatter:{regexDisabled:false,macros:{schemaVersion:1,engine:'legacy',authority:'consumer-data-only',
      sourceSnapshotSha256:'captured',names,card:null,input:binding('input',''),instruct:[],dynamic:[],registered:[],
      variableScopes:{},localVariables:[],globalVariables:[],outlets:[],post:[],characterOverrides:[]},
    rules:[{id:'formatter-rule',sourcePointer:'/regex/0',sourceSnapshotSha256:'captured',origin:'scoped',allowed:true,
      disabled:false,findRegex:'/(hit)/g',replaceString:'{{char}}:$1',trimStrings:[],placement:[1,2,3,5,6],
      promptOnly:true,markdownOnly:true,runOnEdit:true,minDepth:2,maxDepth:2,substituteRegex:0}]}}
  const html=module.exports.readerNativeDocumentHtml({origin:{message:{messageId:'formatter'}},html:''} as any,
    snapshot as any,'formatter')
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://author.invalid/'}),window=dom.window
  try {
    window.structuredClone=structuredClone;window.TextEncoder=TextEncoder
    window.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}}
    window.eval(window.document.querySelector('script').textContent)
    for(const library of libraries)window.eval(library.javascript)
    const kernel=window.__nextTavernPromptTextKernelV1
    assert.equal(kernel.recordSha256({z:'😄',a:['x',undefined]}),
      createHash('sha256').update('{"a":["x",null],"z":"😄"}').digest('hex'))
    assert.equal(kernel.recordSha256(undefined),'missing')
    const format=window.formatAsTavernRegexedString
    assert.equal(format('hit|{{get_message_variable::value}}|{{getvar::score}}|{{getglobalvar::flag}}',
      'ai_output','display',{depth:2,character_name:'Guest'}),'Captain:hit|ordinary first|7|true')
    assert.equal(format('{{char}}|{{get_message_variable::value}}','world_info','prompt'),'Captain|ordinary second')
    assert.equal(format('hit|{{get_message_variable::value}}','ai_output','display',{depth:0}),'hit|null')
    assert.equal(format('{{get_message_variable::stat_data.hp}}|{{get_message_variable::removed}}',
      'reasoning','prompt',{depth:2}),'1|null')
    const yaml=format('{{format_message_variable::details}}','slash_command','prompt',{depth:2})
    assert.deepEqual({...window.YAML.parse(yaml),nested:{...window.YAML.parse(yaml).nested}},
      {label:'ordinary',nested:{visible:3}})
    for(const source of ['user_input','ai_output','slash_command','world_info','reasoning'])
      assert.equal(format('hit',source,'display'),'Captain:hit')
    assert.equal(typeof format('plain','ai_output','prompt'),'string')
  }finally{dom.window.close()}
})

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
