/** Capture native-browser Source pages without classifying ordinary JS call
 * shapes. Existing Source/DATA capture remains the sole template boundary. */
import {recordSha256,sha256} from './roleplay-data.js'
import {captureReaderSourceDocumentV1} from './reader-source-document-data.mjs'
import {readerRegexDocumentHtmlSpan} from './reader-source-document-data.mjs'
import type {ReaderSourceDocument} from './reader-source-document-data.mjs'
import type {ReaderDocumentInputV1,ReaderRegexDocumentSourceV1,ReaderRegexDocumentOriginV1,
  ReaderRegexDocumentFailureV1} from './reader-regex-document-types.mjs'
import type {ReaderNativeDocumentPlanV1,ReaderNativeDocumentCompilationV1,ReaderNativeDocumentProgramV1,
  ReaderNativeDocumentProfileV1} from './reader-native-document-types.js'

/** Only DATA slots need script offsets. Replace that script's browser-cooked
 * body, then its original HTML body span: parse5 normalizes CRLF, so cooked JS
 * offsets must never be applied directly to raw HTML bytes. */
function materializeSourceStrings(source:ReaderSourceDocument,html:string):string {
  if(!source.strings.size)return html
  const replacements:{start:number;end:number;text:string}[]=[]
  for(const script of source.scripts){
    const slots=source.strings.get(script.inlineOrdinal)
    if(!slots?.length)continue
    let javascript=script.javascript
    for(const slot of [...slots].sort((left,right)=>right.start-left.start)){
      const data=JSON.stringify(slot.value).replaceAll('<','\\u003c')
      javascript=javascript.slice(0,slot.start)+data+javascript.slice(slot.end)
    }
    replacements.push({...script.bodySpan,text:javascript})
  }
  for(const replacement of replacements.sort((left,right)=>right.start-left.start))
    html=html.slice(0,replacement.start)+replacement.text+html.slice(replacement.end)
  return html
}

function sealDocument(origin:ReaderNativeDocumentPlanV1['origin'],html:string,
  writes:ReaderNativeDocumentPlanV1['writes']):ReaderNativeDocumentPlanV1 {
  const body={schemaVersion:1 as const,encoding:'reader-native-document-plan-v1' as const,origin,html,writes}
  return {...body,documentPlanSha256:recordSha256(body)}
}

export function compileReaderNativeDocumentsV1(input:ReaderDocumentInputV1):ReaderNativeDocumentCompilationV1 {
  const documents:ReaderNativeDocumentPlanV1[]=[],documentInputIndices:number[]=[]
  const documentFailures:{inputIndex:number;diagnostics:ReaderRegexDocumentFailureV1['diagnostics']}[]=[]
  if(input.encoding==='reader-worldbook-document-input-v1'){
    for(const [index,document] of input.documents.entries()){
      documents.push(sealDocument(document.origin,document.html,'none'));documentInputIndices.push(index)
    }
    return {documents,documentInputIndices,documentFailures,worldbookProducers:input.producers}
  }
  const failedDocuments:ReaderRegexDocumentFailureV1[]=[]
  for(const [index,document] of input.documents.entries()){
    const {regex,message}=document
    try{
      const htmlSpan=readerRegexDocumentHtmlSpan(regex.replacement)
      if(!htmlSpan)throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE')
      const originalHtml=regex.replacement.slice(htmlSpan.start,htmlSpan.end),replacementSha256=sha256(regex.replacement)
      const origin:ReaderRegexDocumentOriginV1={schemaVersion:1,encoding:'reader-regex-document-origin-v1',source:input.source,
        regex:{ordinal:regex.ordinal,id:regex.id,pointer:regex.pointer,descriptorSha256:regex.descriptorSha256,
          replacementSha256,htmlSpan},message,replacementSpan:document.replacementSpan,
        htmlSha256:htmlSpan.start===0&&htmlSpan.end===regex.replacement.length?replacementSha256:sha256(originalHtml),
        htmlUtf8Bytes:Buffer.byteLength(originalHtml,'utf8'),htmlUtf16Length:originalHtml.length}
      const source=captureReaderSourceDocumentV1(document.parts),displaySpan=readerRegexDocumentHtmlSpan(source.html)
      if(!displaySpan)throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE')
      const html=materializeSourceStrings(source,source.html.slice(displaySpan.start,displaySpan.end))
      documents.push(sealDocument(origin,html,'source-regex'));documentInputIndices.push(index)
    }catch(error){
      const {ordinal,id,pointer,descriptorSha256}=regex
      const code=error instanceof Error&&/^(?:READER_REGEX_DOCUMENT|HTML)_[A-Z0-9_]+$/.test(error.message)
        ?error.message:'READER_NATIVE_DOCUMENT_CAPTURE_FAILED'
      const diagnostics=[{code,ordinal,scriptIdentity:id,pointer:pointer+'/replaceString'}]
      failedDocuments.push({source:input.source,regex:{ordinal,id,pointer,descriptorSha256},message,
        replacementSpan:document.replacementSpan,diagnostics})
      documentFailures.push({inputIndex:index,diagnostics})
    }
  }
  return {documents,documentInputIndices,documentFailures,...failedDocuments.length?{failedDocuments}:{}}
}

const profile:ReaderNativeDocumentProfileV1=Object.freeze({id:'reader-native-browser',version:1,
  browser:'supplied',modelRequests:'none',writes:'owned-source-regex',readSemantics:'live',
  writeBasis:'explicit-message-read',receipt:'guest-observed-not-callback-ended'})

/** Plans already seal their actual HTML. Program identity refers to those
 * plans and actual producer/failure facts, never serializes raw pages again. */
export function createReaderNativeDocumentProgramV1(source:ReaderRegexDocumentSourceV1,
  result:Pick<ReaderNativeDocumentCompilationV1,'documents'|'failedDocuments'|'failedWorldbookDocuments'|'worldbookProducers'>)
  :ReaderNativeDocumentProgramV1 {
  const {documents,failedDocuments,failedWorldbookDocuments,worldbookProducers}=result
  const body={schemaVersion:1 as const,encoding:'reader-native-document-program-v1' as const,
    authority:'captured-reader-source-only' as const,source,profile,
    ...failedDocuments?.length?{failedDocuments}:{},...failedWorldbookDocuments?.length?{failedWorldbookDocuments}:{},
    ...worldbookProducers?.length?{worldbookProducers}:{}}
  const programSha256=recordSha256({...body,documents:documents.map(document=>document.documentPlanSha256)})
  return {...body,documents,programSha256}
}
