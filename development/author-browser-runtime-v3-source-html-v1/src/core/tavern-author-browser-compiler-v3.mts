/** Complete Source HTML compiler DATA. Execution admission belongs to its loader/Core. */
import {recordSha256,sha256} from './roleplay-data.js'
import {parseSourceHtmlCandidateV1} from './tavern-author-html-compiler-v1.mjs'
import {analyseBrowserAstV3} from './tavern-author-browser-ast-v3.mjs'
import type {BrowserAstUnitV3,BrowserAstProofV3} from './tavern-author-browser-ast-v3.mjs'
import {BROWSER_BOUNDS_V3,BROWSER_PROFILE_V3,BROWSER_CAPABILITY_CONTRACT_V3}
  from './tavern-author-browser-profile-v3.mjs'
import type {BrowserCompilationInputV3,BrowserCompilationV3,BrowserRuntimeArtifactV3,
  BrowserDeclaredChatKeyV3,BrowserWriterOriginV3,BrowserCompiledScriptV3,BrowserSourcePagePlanV3,
  BrowserPageResourceV3,BrowserCapabilityV3,BrowserPageAstAdmissionV3,BrowserProgramV3}
  from './tavern-author-browser-types-v3.mjs'
import type {BrowserDiagnosticV1,BrowserRawScriptV1} from './tavern-author-browser-types.mjs'
import type {HtmlParsedCandidateV1,SourceHtmlInputV1} from './tavern-author-html-types-v1.mjs'

const sorted=(values:Iterable<BrowserCapabilityV3>):readonly BrowserCapabilityV3[]=>[...new Set(values)].sort()
function declaration(writer:BrowserWriterOriginV3,key:string):BrowserDeclaredChatKeyV3 {
  const writerIdentitySha256=recordSha256({encoding:'native-author-browser-key-writer-v3',writer,key})
  return {declarationId:recordSha256({encoding:'native-author-browser-key-declaration-v3',writerIdentitySha256}),
    scope:'chat',key,kind:'ordinary-source-key',writer,writerIdentitySha256}
}
function pageResources(parsed:HtmlParsedCandidateV1,proofs:readonly BrowserAstProofV3[]):readonly BrowserPageResourceV3[] {
  const resources:BrowserPageResourceV3[]=[]
  for(const candidate of parsed.resources){
    const node=parsed.document.nodes.find(row=>row.nodeId===candidate.nodeId)
    const kind:BrowserPageResourceV3['kind']=candidate.kind==='css-import'?'stylesheet'
      :node?.kind==='element'&&node.tagName==='audio'?'audio'
      :/\.(?:woff2?|ttf|otf)(?:[?#]|$)/i.test(candidate.value)?'font':'image'
    const body={kind,location:candidate.value.startsWith('data:')?'source-data' as const:'declared-url' as const,
      value:candidate.value,provenance:{nodeId:candidate.nodeId,...candidate.styleOrdinal===undefined?{}:{styleOrdinal:candidate.styleOrdinal},
        start:candidate.span?.start??0,end:candidate.span?.end??0}}
    resources.push({resourceId:recordSha256({encoding:'native-author-browser-page-resource-v3',origin:parsed.origin,...body}),...body})
  }
  for(const proof of proofs)for(const resource of proof.media){
    const body={kind:resource.kind,location:resource.value.startsWith('data:')?'source-data' as const:'declared-url' as const,
      value:resource.value,provenance:{inlineOrdinal:proof.unit.inlineOrdinal!,start:resource.start,end:resource.end}}
    resources.push({resourceId:recordSha256({encoding:'native-author-browser-page-resource-v3',origin:parsed.origin,...body}),...body})
  }
  return resources
}
function htmlRequirements(parsed:HtmlParsedCandidateV1,input:SourceHtmlInputV1):BrowserDiagnosticV1[] {
  const rows:BrowserDiagnosticV1[]=[]
  const fail=(code:string,feature?:string)=>rows.push({code,ordinal:input.carrier.originalOrdinal,
    scriptIdentity:input.carrier.identity,pointer:input.carrier.pointer+'/data/html',...feature?{feature}:{}})
  for(const script of parsed.scripts){
    if(script.mode==='module'||script.attributes.some(attribute=>['src','async','defer'].includes(attribute.name)))
      fail('BROWSER3_PAGE_SCRIPT_LIFECYCLE_UNSUPPORTED','inline-'+script.inlineOrdinal)
    if(script.inTemplate&&script.mode==='classic')fail('BROWSER3_TEMPLATE_SCRIPT_LIFECYCLE_UNSUPPORTED','inline-'+script.inlineOrdinal)
  }
  for(const node of parsed.document.nodes)if(node.kind==='element'){
    if(['iframe','object','embed','base'].includes(node.tagName))fail('BROWSER3_ACTIVE_HTML_ELEMENT_UNSUPPORTED',node.tagName)
    for(const attribute of node.attributes){
      if(attribute.name.startsWith('on'))fail('BROWSER3_INLINE_EVENT_ATTRIBUTE_UNSUPPORTED',attribute.name)
      if(node.tagName==='meta'&&attribute.name==='http-equiv'&&attribute.value.toLowerCase()==='refresh')
        fail('BROWSER3_META_REFRESH_UNSUPPORTED')
    }
  }
  for(const resource of parsed.resources)if(!/^(?:https?:\/\/|data:)/i.test(resource.value))
    fail('BROWSER3_PAGE_RESOURCE_PROVENANCE_UNSUPPORTED',resource.kind)
  return rows
}

export function createBrowserCompilerV3(artifact:BrowserRuntimeArtifactV3) {
  /** These distinct byte identities are supplied by the future actual producer.
   * Reading them here establishes DATA identity, never protected execution. */
  const identity=artifact.compiler
  return {identity,compile(input:BrowserCompilationInputV3):BrowserCompilationV3 {
    const diagnostics:BrowserDiagnosticV1[]=[]
    if(input.schemaVersion!==3||input.encoding!=='native-author-browser-compilation-input-v3'
      ||input.scripts.length>BROWSER_BOUNDS_V3.scripts||input.sourcePages.length>BROWSER_BOUNDS_V3.pages)
      return {kind:'refused',diagnostics:[{code:'BROWSER3_COMPILATION_INPUT_UNSUPPORTED'}]}
    const scripts=new Map<number,BrowserRawScriptV1>(),units:BrowserAstUnitV3[]=[],parsedPages=new Map<string,HtmlParsedCandidateV1>()
    const pageInputs=new Map<string,SourceHtmlInputV1>(),pageCarriers=new Map<number,string>()
    let previous=-1
    for(const script of input.scripts){
      if(script.ordinal<=previous){diagnostics.push({code:'BROWSER3_DESCRIPTOR_ORDER_UNSUPPORTED',ordinal:script.ordinal});continue}
      previous=script.ordinal;scripts.set(script.ordinal,script)
      if(Buffer.byteLength(script.descriptor.source,'utf8')>BROWSER_BOUNDS_V3.sourceBytes)
        diagnostics.push({code:'BROWSER3_SOURCE_BYTE_LIMIT',ordinal:script.ordinal})
    }
    for(let index=0;index<input.sourcePages.length;index++){
      const page=input.sourcePages[index]!,carrier=scripts.get(page.carrier.originalOrdinal),pageId='page-'+index
      if(!carrier||!carrier.descriptor.enabled||page.carrier.identity!==carrier.descriptor.identity
        ||page.carrier.pointer!==carrier.descriptor.pointer||page.carrier.descriptorSha256!==recordSha256(carrier.descriptor)
        ||recordSha256(page.source)!==recordSha256(input.source)||pageCarriers.has(carrier.ordinal)){
        diagnostics.push({code:'BROWSER3_SOURCE_PAGE_CARRIER_JOIN_UNSUPPORTED',ordinal:page.carrier.originalOrdinal});continue
      }
      pageCarriers.set(carrier.ordinal,pageId);pageInputs.set(pageId,page)
      try{
        const parsed=parseSourceHtmlCandidateV1(page)
        parsedPages.set(pageId,parsed);diagnostics.push(...htmlRequirements(parsed,page))
        if(parsed.diagnostics.some(diagnostic=>diagnostic.phase!=='html'))
          diagnostics.push({code:'BROWSER3_PAGE_SYNTAX_UNSUPPORTED',ordinal:carrier.ordinal})
        for(const inline of parsed.scripts)if(inline.mode==='classic')units.push({realm:pageId,parentRealm:'carrier-'+carrier.ordinal,
          javascript:inline.javascript,ordinal:carrier.ordinal,identity:carrier.descriptor.identity,
          pointer:carrier.descriptor.pointer+'/data/html#inline-'+inline.inlineOrdinal,pageId,inlineOrdinal:inline.inlineOrdinal,
          sourceResources:input.sourceResources,
          sourceHtml:{pageId,html:page.html,scriptIdentity:carrier.descriptor.identity,resourcePath:page.resourcePath}})
      }catch(error){
        const code=error instanceof Error&&/^HTML_[A-Z0-9_]+$/.test(error.message)?error.message:'BROWSER3_PAGE_PARSE_FAILED'
        diagnostics.push({code,ordinal:carrier.ordinal,pointer:carrier.descriptor.pointer+'/data/html'})
      }
    }
    for(const script of scripts.values())if(script.descriptor.enabled){
      const pageId=pageCarriers.get(script.ordinal),page=pageId?pageInputs.get(pageId):undefined
      units.unshift({realm:'carrier-'+script.ordinal,parentRealm:'carrier-'+script.ordinal,
        javascript:script.descriptor.source,ordinal:script.ordinal,identity:script.descriptor.identity,
        pointer:script.descriptor.pointer,pageId:null,inlineOrdinal:null,
        sourceResources:input.sourceResources,
        ...page?{sourceHtml:{pageId:pageId!,html:page.html,scriptIdentity:script.descriptor.identity,resourcePath:page.resourcePath}}:{}})
    }
    const result=analyseBrowserAstV3(units)
    diagnostics.push(...result.diagnostics)
    const declarations:BrowserDeclaredChatKeyV3[]=[],plans:BrowserSourcePagePlanV3[]=[]
    const declarationsByKey=new Map<string,BrowserDeclaredChatKeyV3>()
    function retainDeclaration(writer:BrowserWriterOriginV3,key:string,pointer:string):BrowserDeclaredChatKeyV3 {
      const row=declaration(writer,key),existing=declarationsByKey.get(key)
      if(existing){
        if(existing.declarationId===row.declarationId)return existing
        diagnostics.push({code:'BROWSER3_SHARED_KEY_DECLARATION_CONFLICT',ordinal:writer.originalOrdinal,pointer,feature:key})
        return row
      }
      declarationsByKey.set(key,row);declarations.push(row)
      return row
    }
    for(const [pageId,parsed] of parsedPages){
      const page=pageInputs.get(pageId)!,carrier=scripts.get(page.carrier.originalOrdinal)!
      const pageProofs=result.proofs.filter(proof=>proof.unit.pageId===pageId)
      const localDeclarations:BrowserDeclaredChatKeyV3[]=[],admissions:BrowserPageAstAdmissionV3[]=[]
      for(const inline of parsed.scripts){
        const proof=pageProofs.find(row=>row.unit.inlineOrdinal===inline.inlineOrdinal)
        const writer:BrowserWriterOriginV3={originalOrdinal:carrier.ordinal,scriptIdentity:carrier.descriptor.identity,
          descriptorSha256:page.carrier.descriptorSha256,page:{htmlSha256:parsed.origin.htmlSha256,
            inlineOrdinal:inline.inlineOrdinal,javascriptSha256:inline.javascriptSha256}}
        const own=(proof?.keys??[]).map(key=>retainDeclaration(writer,key,
          carrier.descriptor.pointer+'/data/html#inline-'+inline.inlineOrdinal))
        const body={encoding:'native-author-browser-page-ast-admission-v3' as const,inlineOrdinal:inline.inlineOrdinal,
          javascriptSha256:inline.javascriptSha256,coverageSha256:recordSha256({parser:inline.ast,proof:proof?.coverage??null}),
          requiredCapabilities:proof?.capabilities??[],declarations:own}
        admissions.push({...body,admissionSha256:recordSha256(body)});localDeclarations.push(...own)
      }
      const resources=pageResources(parsed,pageProofs),caps=sorted(['owned-source-html-page','isolated-dom-text',
        ...pageProofs.flatMap(proof=>proof.capabilities),...resources.length?['owned-media' as const]:[]])
      const body={schemaVersion:3 as const,encoding:'native-author-browser-source-page-plan-v3' as const,
        authority:'compiled-program-data-only' as const,origin:parsed.origin,parsed,scripts:admissions,resources,
        requiredCapabilities:caps,declarations:localDeclarations}
      plans.push({...body,pagePlanSha256:recordSha256(body)})
      if(!result.proofs.some(proof=>proof.pageMounts.includes(pageId)))
        diagnostics.push({code:'BROWSER3_SOURCE_PAGE_MOUNT_UNPROVEN',ordinal:carrier.ordinal})
    }
    const compiled:BrowserCompiledScriptV3[]=[]
    for(const script of scripts.values()){
      const proof=result.proofs.find(row=>row.unit.pageId===null&&row.unit.ordinal===script.ordinal)
      const descriptorSha256=recordSha256(script.descriptor)
      const own=(proof?.keys??[]).map(key=>retainDeclaration({originalOrdinal:script.ordinal,scriptIdentity:script.descriptor.identity,
        descriptorSha256,page:null},key,script.descriptor.pointer))
      compiled.push({...script,descriptorSha256,disposition:script.descriptor.enabled?'compiled-browser':'disabled-source-retained',
        javascript:script.descriptor.enabled?script.descriptor.source:'',javascriptSha256:proof?.coverage.sourceSha256??sha256(''),
        entrypoint:script.descriptor.enabled?'global-script':'disabled',coverage:proof?.coverage??null,
        requiredCapabilities:proof?.capabilities??[],declarations:own,mediaSources:proof?.media.map(row=>row.value)??[],
        sourcePagePlans:plans.filter(plan=>proof?.pageMounts.some(id=>parsedPages.get(id)===plan.parsed)).map(plan=>plan.pagePlanSha256)})
    }
    if(diagnostics.length)return {kind:'refused',diagnostics}
    const body:Omit<BrowserProgramV3,'programSha256'>={schemaVersion:3,encoding:'native-author-browser-program-v3',
      authority:'compiled-program-data-only',source:input.source,compiler:identity,profile:BROWSER_PROFILE_V3,
      runtime:artifact.identity,capabilityContract:BROWSER_CAPABILITY_CONTRACT_V3,scripts:compiled,sourcePages:plans,
      declarations,requiredCapabilities:sorted([...compiled.flatMap(row=>row.requiredCapabilities),...plans.flatMap(row=>row.requiredCapabilities)])}
    if(Buffer.byteLength(JSON.stringify(body),'utf8')>BROWSER_BOUNDS_V3.programBytes)
      return {kind:'refused',diagnostics:[{code:'BROWSER3_PROGRAM_BYTE_LIMIT'}]}
    return {kind:'compiled',program:{...body,programSha256:recordSha256(body)}}
  }}
}
