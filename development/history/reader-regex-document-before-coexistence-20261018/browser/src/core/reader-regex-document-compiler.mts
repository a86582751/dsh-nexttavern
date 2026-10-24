/** Complete Source regex documents use the shared parse5/CSS/TS/AST owners.
 * Captured model strings enter ordinary text nodes only, never active markup. */
import {recordSha256,sha256} from './roleplay-data.js'
import {parseSourceHtmlDocumentV1} from './tavern-author-html-compiler-v1.mjs'
import {analyseBrowserAstV3} from './tavern-author-browser-ast-v3.mjs'
import type {BrowserAstUnitV3} from './tavern-author-browser-ast-v3.mjs'
import {browserPageResourcesV3,browserSourceHtmlRequirementsV3} from './tavern-author-browser-compiler-v3.mjs'
import {BROWSER_BOUNDS_V3} from './tavern-author-browser-profile-v3.mjs'
import {READER_REGEX_DOCUMENT_PROFILE_V1,READER_REGEX_DOCUMENT_CAPABILITIES_V1}
  from './reader-regex-document-profile-v1.mjs'
import type {ReaderRegexDocumentInputV1,ReaderRegexDocumentCompilationV1,ReaderRegexDocumentOriginV1,
  ReaderRegexDocumentPlanV1,ReaderRegexDocumentProgramV1} from './reader-regex-document-types.mjs'
import type {BrowserRuntimeArtifactV3,BrowserCapabilityV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserDiagnosticV1} from './tavern-author-browser-types.mjs'
import type {TavernPromptDisplayPartV1} from './tavern-prompt-transform-types.mjs'

/** Half-open UTF-16 span in the actual Source replacement, including its
 * authored capture tokens. Only complete outer documents receive admission. */
export function readerRegexDocumentHtmlSpan(template:string):{start:number;end:number}|undefined {
  let start=template.length-template.trimStart().length,end=template.trimEnd().length
  const outer=template.slice(start,end),fence=outer.match(/^(`{3,}|~{3,})(?:html)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i)
  if(fence){
    start+=outer.indexOf('\n')+1
    end=start+fence[2]!.length
    const body=template.slice(start,end)
    start+=body.length-body.trimStart().length;end-=body.length-body.trimEnd().length
  }
  if(!/^(?:<!doctype\s+html>\s*)?<html(?:\s[^>]*)?>[\s\S]*<\/html>$/i.test(template.slice(start,end)))return
  return {start,end}
}
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
function sourceDocument(parts:readonly TavernPromptDisplayPartV1[]):string {
  if(!parts.some(part=>part.kind==='capture'))return parts.map(part=>part.text).join('')
  // The first parse proves the slot's context using Source-only placeholders.
  // The second decodes escaped captures as real text through the same parser.
  const literals=parts.filter(part=>part.kind==='literal').map(part=>part.text).join('')
  const salt=sha256(literals),markers=parts.map((part,index)=>part.kind==='capture'
    ?'\ue000reader-'+salt+'-'+index+'\ue001':null)
  const marked=parts.map((part,index)=>markers[index]??part.text).join('')
  const span=readerRegexDocumentHtmlSpan(marked)
  if(!span)throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE')
  const parsed=parseSourceHtmlDocumentV1(marked.slice(span.start,span.end))
  for(const marker of markers)if(marker){
    let occurrences=0
    for(const node of parsed.document.nodes) {
      if(node.kind==='text'&&node.text.kind==='literal')occurrences+=node.text.value.split(marker).length-1
      else if(node.kind==='comment'&&node.data.includes(marker)
        ||node.kind==='element'&&node.attributes.some(attribute=>attribute.value.includes(marker)))
        throw Error('READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
    }
    if(occurrences!==1)throw Error('READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
  }
  return parts.map(part=>part.kind==='literal'?part.text:escape(part.text)).join('')
}

export function createReaderRegexDocumentCompilerV1(artifact:BrowserRuntimeArtifactV3) {
  const profile=READER_REGEX_DOCUMENT_PROFILE_V1
  const compiler={id:'reader-regex-document-compiler' as const,version:1 as const,shared:artifact.compiler,
    implementationSha256:recordSha256({encoding:'reader-regex-document-compiler-identity-v1',
      shared:artifact.compiler,profile})}
  return {compile(input:ReaderRegexDocumentInputV1):ReaderRegexDocumentCompilationV1 {
    const diagnostics:BrowserDiagnosticV1[]=[],plans:ReaderRegexDocumentPlanV1[]=[]
    if(input.schemaVersion!==1||input.encoding!=='reader-regex-document-input-v1'
      ||input.documents.length>BROWSER_BOUNDS_V3.pages)
      return {kind:'refused',diagnostics:[{code:'READER_REGEX_DOCUMENT_INPUT_UNSUPPORTED'}]}
    for(const [index,document] of input.documents.entries()) {
      const {regex,message,parts}=document
      const fail=(code:string,feature?:string)=>diagnostics.push({code,ordinal:regex.ordinal,
        scriptIdentity:regex.id,pointer:regex.pointer+'/replaceString',...feature?{feature}:{}})
      try {
        const htmlSpan=readerRegexDocumentHtmlSpan(regex.replacement)
        if(!htmlSpan){fail('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE');continue}
        const originalHtml=regex.replacement.slice(htmlSpan.start,htmlSpan.end)
        const origin:ReaderRegexDocumentOriginV1={schemaVersion:1,encoding:'reader-regex-document-origin-v1',
          source:input.source,regex:{ordinal:regex.ordinal,id:regex.id,pointer:regex.pointer,
            descriptorSha256:regex.descriptorSha256,replacementSha256:sha256(regex.replacement),htmlSpan},
          message,replacementSpan:document.replacementSpan,
          htmlSha256:sha256(originalHtml),htmlUtf8Bytes:Buffer.byteLength(originalHtml,'utf8'),
          htmlUtf16Length:originalHtml.length}
        const html=sourceDocument(parts),displaySpan=readerRegexDocumentHtmlSpan(html)
        if(!displaySpan){fail('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE');continue}
        const parsed=parseSourceHtmlDocumentV1(html.slice(displaySpan.start,displaySpan.end))
        browserSourceHtmlRequirementsV3(parsed,fail)
        if(parsed.diagnostics.some(row=>row.phase!=='html'))fail('READER_REGEX_DOCUMENT_SYNTAX_UNSUPPORTED')
        const pageId='reader-regex-document-'+index
        const units:BrowserAstUnitV3[]=parsed.scripts.filter(script=>script.mode==='classic').map(script=>({
          realm:pageId,parentRealm:'reader-root',javascript:script.javascript,ordinal:regex.ordinal,
          identity:regex.id,pointer:regex.pointer+'/replaceString#inline-'+script.inlineOrdinal,
          pageId,inlineOrdinal:script.inlineOrdinal}))
        const result=analyseBrowserAstV3(units,{absentGlobals:profile.absentGlobals})
        diagnostics.push(...result.diagnostics)
        const unsupported=new Set(result.proofs.flatMap(proof=>proof.capabilities)
          .filter(capability=>!READER_REGEX_DOCUMENT_CAPABILITIES_V1.includes(capability)))
        for(const capability of unsupported)fail('READER_REGEX_DOCUMENT_CAPABILITY_UNAVAILABLE',capability)
        const resources=browserPageResourcesV3({...parsed,origin},result.proofs)
        const requiredCapabilities=[...new Set<BrowserCapabilityV3>(['owned-source-html-page','isolated-dom-text',
          ...result.proofs.flatMap(proof=>proof.capabilities),...resources.length?['owned-media' as const]:[]])].sort()
        const scripts=parsed.scripts.map(script=>{
          const proof=result.proofs.find(row=>row.unit.inlineOrdinal===script.inlineOrdinal)
          return {inlineOrdinal:script.inlineOrdinal,javascriptSha256:script.javascriptSha256,
            coverageSha256:recordSha256({parser:script.ast,proof:proof?.coverage??null}),
            requiredCapabilities:proof?.capabilities??[]}
        })
        const body={schemaVersion:1 as const,encoding:'reader-regex-document-plan-v1' as const,
          authority:'compiled-reader-data-only' as const,origin,parsed,scripts,resources,requiredCapabilities}
        plans.push({...body,pagePlanSha256:recordSha256(body)})
      }catch(error){fail(error instanceof Error&&/^(?:READER_REGEX_DOCUMENT|HTML)_[A-Z0-9_]+$/.test(error.message)
        ?error.message:'READER_REGEX_DOCUMENT_PARSE_FAILED')}
    }
    if(diagnostics.length)return {kind:'refused',diagnostics}
    const body:Omit<ReaderRegexDocumentProgramV1,'programSha256'>={schemaVersion:1,
      encoding:'reader-regex-document-program-v1',authority:'compiled-reader-data-only',source:input.source,
      compiler,runtime:artifact.identity,profile,documents:plans}
    if(Buffer.byteLength(JSON.stringify(body),'utf8')>BROWSER_BOUNDS_V3.programBytes)
      return {kind:'refused',diagnostics:[{code:'READER_REGEX_DOCUMENT_PROGRAM_BYTE_LIMIT'}]}
    return {kind:'compiled',program:{...body,programSha256:recordSha256(body)}}
  }}
}
