/** Source/DATA slots only. No CSS analysis, JS capability gate or page compiler. */
import {Parser,defaultTreeAdapter as base} from 'parse5'
import type {DefaultTreeAdapterMap,DefaultTreeAdapterTypes,TreeAdapter} from 'parse5'
import ts from 'dsh-nexttavern-typescript-runtime'
import {sha256} from './roleplay-data.js'
import type {ReaderRegexDocumentInputV1,ReaderWorldbookDocumentInputV1,ReaderWorldbookProducerFactsV1} from './reader-regex-document-types.mjs'
import type {ReaderWorldbookRenderResultV1} from './tavern-reader-worldbook-render-types.mjs'
import type {TavernPromptDisplayPartV1} from './tavern-prompt-transform-types.mjs'

type Element=DefaultTreeAdapterTypes.Element
type Text=DefaultTreeAdapterTypes.TextNode
interface SourceScriptData {
  readonly inlineOrdinal:number
  readonly mode:'classic'|'module'|'data'
  readonly javascript:string
  readonly bodySpan:{start:number;end:number}
}
export interface ReaderSourceDocument {
  readonly html:string
  readonly strings:ReadonlyMap<number,readonly {start:number;end:number;value:string}[]>
  /** Offsets refer to the final HTML document carrier, after ordinary text DATA. */
  readonly scripts:readonly SourceScriptData[]
}
const classicMimes=new Set(['text/javascript','application/javascript','text/ecmascript','application/ecmascript',
  'application/x-javascript','application/x-ecmascript','text/javascript1.0','text/javascript1.1',
  'text/javascript1.2','text/javascript1.3','text/javascript1.4','text/javascript1.5','text/jscript','text/livescript',
  'text/x-javascript','text/x-ecmascript'])
function scriptMode(node:Element):SourceScriptData['mode'] {
  const type=node.attrs.find(value=>value.name==='type')?.value.trim().toLowerCase()
  if(type==='module')return 'module'
  if(type)return classicMimes.has(type)?'classic':'data'
  const language=node.attrs.find(value=>value.name==='language')?.value.trim().toLowerCase()
  return !language||classicMimes.has('text/'+language)?'classic':'data'
}
function parseSourceData(html:string) {
  const elements:Element[]=[],texts:Text[]=[]
  // Creation order, rather than repaired DOM order, is the existing script ordinal.
  const adapter:TreeAdapter<DefaultTreeAdapterMap>={...base,
    createElement(tag,namespace,attrs){const node=base.createElement(tag,namespace,attrs);elements.push(node);return node},
    insertText(parent,value){
      const previous=parent.childNodes.at(-1)
      if(previous&&base.isTextNode(previous))previous.value+=value
      else {const node=base.createTextNode(value);texts.push(node);base.appendChild(parent,node)}
    },
    insertTextBefore(parent,value,reference){
      const previous=parent.childNodes[parent.childNodes.indexOf(reference)-1]
      if(previous&&base.isTextNode(previous))previous.value+=value
      else {const node=base.createTextNode(value);texts.push(node);base.insertBefore(parent,node,reference)}
    },
  }
  const parser=new Parser<DefaultTreeAdapterMap>({treeAdapter:adapter,sourceCodeLocationInfo:true,scriptingEnabled:true})
  parser.tokenizer.write(html,true)
  const scripts:SourceScriptData[]=[],activeText=new Set<Text>()
  for(const node of elements) {
    if(node.tagName!=='script'&&node.tagName!=='style')continue
    const children=node.childNodes.filter(base.isTextNode)
    for(const child of children)activeText.add(child)
    if(node.tagName==='script') {
      const span=node.sourceCodeLocation!
      scripts.push({inlineOrdinal:scripts.length,mode:scriptMode(node),javascript:children.map(child=>child.value).join(''),
        bodySpan:{start:span.startTag?.endOffset??span.startOffset,end:span.endTag?.startOffset??span.endOffset}})
    }
  }
  return {scripts,texts:texts.filter(node=>!activeText.has(node)).map(node=>node.value)}
}
function macroStringExpression(node:import('typescript').StringLiteral|import('typescript').NoSubstitutionTemplateLiteral):boolean {
  const parent=node.parent
  if('name' in parent&&parent.name===node||'moduleSpecifier' in parent&&parent.moduleSpecifier===node
    ||ts.isTaggedTemplateExpression(parent)||ts.isExternalModuleReference(parent)||ts.isImportAttribute(parent))return false
  if(ts.isStringLiteral(node)&&ts.isExpressionStatement(parent)) {
    const block=parent.parent
    if(ts.isSourceFile(block)||ts.isBlock(block)||ts.isModuleBlock(block)) {
      for(const statement of block.statements) {
        if(statement===parent)return false
        if(!ts.isExpressionStatement(statement)||!ts.isStringLiteral(statement.expression))break
      }
    }
  }
  return true
}
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
export function captureReaderSourceDocumentV1(parts:readonly TavernPromptDisplayPartV1[]):ReaderSourceDocument {
  const strings=new Map<number,{start:number;end:number;value:string}[]>()
  if(parts.every(part=>part.kind==='literal'))return {html:parts.map(part=>part.text).join(''),strings,scripts:[]}
  const source=parts.map(part=>part.kind==='literal'?part.text:part.kind==='macro'?part.sourceText:'').join('')
  const prefix='\ue000reader-'+sha256(source)+'-',pattern=new RegExp(prefix+'(\\d+)\ue001','g')
  const markers=parts.map((part,index)=>part.kind==='literal'?null:prefix+index+'\ue001')
  const markedParts=parts.map((part,index)=>markers[index]??part.text),marked=markedParts.join('')
  const span=readerRegexDocumentHtmlSpan(marked)
  if(!span)throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE')
  const parsed=parseSourceData(marked.slice(span.start,span.end))
  const occurrences=parts.map(()=>0),textParts=new Set<number>()
  for(const text of parsed.texts)for(const match of text.matchAll(pattern)) {
    const index=Number(match[1]);occurrences[index]=occurrences[index]!+1;textParts.add(index)
  }
  for(const script of parsed.scripts)if(script.mode!=='data'&&script.javascript.includes(prefix)) {
    for(const match of script.javascript.matchAll(pattern))if(parts[Number(match[1])]!.kind!=='macro')
      throw Error('READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
    const file=ts.createSourceFile('reader-macro-slots.js',script.javascript,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
    const slots:{start:number;end:number;value:string}[]=[]
    const visit=(node:import('typescript').Node):void=>{
      if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&node.text.includes(prefix)) {
        const expression=macroStringExpression(node)
        const value=node.text.replace(pattern,(_marker:string,indexText:string)=>{
          const index=Number(indexText),part=parts[index]!
          if(part.kind!=='macro')throw Error('READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
          if(!expression)throw Error('READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED')
          occurrences[index]=occurrences[index]!+1;return part.text
        })
        slots.push({start:node.getStart(file),end:node.end,value})
      }else ts.forEachChild(node,visit)
    }
    visit(file)
    if(slots.length)strings.set(script.inlineOrdinal,slots)
  }
  for(const [index,part] of parts.entries())if(part.kind!=='literal'&&occurrences[index]!==1)
    throw Error(part.kind==='macro'?'READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED'
      :'READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
  const finalParts=parts.map((part,index)=>part.kind==='literal'?part.text:textParts.has(index)?escape(part.text):markers[index]!)
  const html=finalParts.join(''),displaySpan=readerRegexDocumentHtmlSpan(html)!
  // Text DATA changes raw HTML length. Translate the already parsed body spans;
  // JS string offsets stay in parse5's cooked (CRLF-normalized) script text.
  const translate=(offset:number)=>{
    let previous=0,delta=0
    for(let index=0;index<parts.length;index++) {
      const end=previous+markedParts[index]!.length
      if(offset<end)return offset+delta
      delta+=finalParts[index]!.length-markedParts[index]!.length;previous=end
    }
    return offset+delta
  }
  const scripts=parsed.scripts.map(script=>({...script,bodySpan:{
    start:translate(span.start+script.bodySpan.start)-displaySpan.start,
    end:translate(span.start+script.bodySpan.end)-displaySpan.start}}))
  return {html,strings,scripts}
}

/** Bind actual pure producer outputs once. All pages from one phase share its
 * captured read facts through the enclosing program, avoiding repeated lore
 * dependencies in each document origin. */
export function bindReaderWorldbookDocumentsV1(source:ReaderRegexDocumentInputV1['source'],
  projections:readonly {readonly result:Extract<ReaderWorldbookRenderResultV1,{kind:'rendered'}>;
    readonly isEdit:boolean}[]):ReaderWorldbookDocumentInputV1 {
  const producers:ReaderWorldbookProducerFactsV1[]=[],documents:ReaderWorldbookDocumentInputV1['documents'][number][]=[]
  for(const {result,isEdit} of projections) {
    if(!result.fragments.length)continue
    const {text:_programText,...program}=result.program,
      {activations:_activations,injections:_injections,ordinaryWrites:_writes,...output}=result.output,
      producerIndex=producers.length,target=result.target
    producers.push({engine:result.engine,program,output})
    for(const fragment of result.fragments)documents.push({html:fragment.html,origin:{
      schemaVersion:1,encoding:'reader-worldbook-document-origin-v1',kind:'worldbook-render',source,
      message:{seq:target.seq,messageId:target.messageId,messageVersionSha256:target.messageVersionSha256,
        depth:target.depth,isEdit},target,phase:result.phase,entry:fragment.entry,
      executionResourceSha256:fragment.executionResourceSha256,disposition:fragment.disposition,producerIndex,
      htmlSha256:fragment.renderedSha256,htmlUtf8Bytes:Buffer.byteLength(fragment.html,'utf8'),
      htmlUtf16Length:fragment.html.length}})
  }
  return {schemaVersion:1,encoding:'reader-worldbook-document-input-v1',source,producers,documents}
}

/** Locate a Source document carrier without repairing or rewriting its bytes.
 * parse5 owns HTML structure, including omitted html/head/body elements. Plain
 * inline formatting keeps its existing Reader path unless Source declares a
 * document or a script requiring the isolated document runtime. */
export function readerRegexDocumentHtmlSpan(template:string):{start:number;end:number}|undefined {
  let start=template.length-template.trimStart().length,end=template.trimEnd().length
  const outer=template.slice(start,end),fence=outer.match(/^(`{3,}|~{3,})(?:html)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i)
  if(fence){
    start+=outer.indexOf('\n')+1
    end=start+fence[2]!.length
    const body=template.slice(start,end)
    start+=body.length-body.trimStart().length;end-=body.length-body.trimEnd().length
  }
  if(!/<(?:!doctype\s+html(?=[\s>])|(?:html|head|body|script)(?=[\s/>]))/i.test(template.slice(start,end)))return
  return {start,end}
}

