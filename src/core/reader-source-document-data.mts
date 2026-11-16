/** Source/DATA slots only. No CSS analysis, JS capability gate or page compiler. */
import {Parser,defaultTreeAdapter as base} from 'parse5'
import type {DefaultTreeAdapterMap,DefaultTreeAdapterTypes,TreeAdapter} from 'parse5'
import ts from 'dsh-nexttavern-typescript-runtime'
import {sha256} from './roleplay-data.js'
import type {ReaderRegexDocumentInputV1,ReaderWorldbookDocumentInputV1,ReaderWorldbookProducerFactsV1} from './reader-regex-document-types.mjs'
import type {ReaderWorldbookRenderResultV1} from './tavern-reader-worldbook-render-types.mjs'
import type {TavernPromptDisplayPartV1} from './tavern-prompt-transform-types.mjs'
import type {ReaderNativeAttributeDataV1} from './reader-native-document-types.js'

type Element=DefaultTreeAdapterTypes.Element
type Attribute=Element['attrs'][number]
type Text=DefaultTreeAdapterTypes.TextNode
const htmlNamespace='http://www.w3.org/1999/xhtml',svgNamespace='http://www.w3.org/2000/svg',
  xlinkNamespace='http://www.w3.org/1999/xlink'
interface SourceScriptData {
  readonly inlineOrdinal:number
  readonly mode:'classic'|'module'|'data'
  readonly javascript:string
  readonly bodySpan:{start:number;end:number}
}
export interface ReaderSourceDocument {
  readonly html:string
  readonly displaySpan:{readonly start:number;readonly end:number}
  readonly strings:ReadonlyMap<number,readonly {start:number;end:number;value:string}[]>
  /** Offsets refer to the final HTML document carrier, after ordinary text DATA. */
  readonly scripts:readonly SourceScriptData[]
  readonly attributeData?:readonly ReaderNativeAttributeDataV1[]
}
export interface ReaderSourceTemplateV1 {
  readonly template:string
  readonly htmlSpan:{start:number;end:number}|undefined
  readonly document:ReaderSourceDocument
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
function parseSourceData(html:string,captureFences=false) {
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
  const hasSourceMarkup=elements.some(node=>node.sourceCodeLocation!=null)
    ||parser.document.childNodes.some(base.isDocumentTypeNode)
  const ordinaryTexts=texts.filter(node=>!activeText.has(node))
  const fenceText=captureFences?ordinaryTexts.filter(node=>{
    let parent=node.parentNode
    while(parent&&base.isElementNode(parent)) {
      if(parent.tagName!=='html'&&parent.tagName!=='body')return false
      parent=parent.parentNode
    }
    return parent===parser.document&&node.sourceCodeLocation!=null
  }).map(node=>({start:node.sourceCodeLocation!.startOffset,end:node.sourceCodeLocation!.endOffset})):[]
  return {document:parser.document,scripts,elements,texts:ordinaryTexts.map(node=>node.value),hasSourceMarkup,fenceText,
    markupOffsets:captureFences?elements.flatMap(node=>node.sourceCodeLocation?[node.sourceCodeLocation.startOffset]:[]):[]}
}
type TextSpan={start:number;end:number}
/** Fence delimiters belong to Source text outside authored elements. Browser
 * script/style text and literal code examples keep their original characters. */
function htmlFenceLines(source:string,parsed:ReturnType<typeof parseSourceData>):TextSpan[] {
  const removed:TextSpan[]=[]
  if(!parsed.fenceText.length)return removed
  let opening:{delimiter:string;html:boolean;start:number;end:number}|undefined
  for(const line of source.matchAll(/^[ ]{0,3}(`{3,}|~{3,})([^\r\n]*)(?:\r?\n|$)/gm)) {
    const start=line.index,end=start+line[0].length
    if(!parsed.fenceText.some(span=>start>=span.start&&end<=span.end))continue
    const info=line[2]!.trim()
    if(!opening) {
      if(line[1]![0]==='`'&&info.includes('`'))continue
      opening={delimiter:line[1]!,html:!info||info.toLowerCase()==='html',start,end}
    }else if(!info&&line[1]![0]===opening.delimiter[0]&&line[1]!.length>=opening.delimiter.length) {
      if(opening.html&&parsed.markupOffsets.some(offset=>offset>=opening!.end&&offset<start))
        removed.push({start:opening.start,end:opening.end},{start,end})
      opening=undefined
    }
  }
  return removed
}
function removeFenceLines(html:string,lines:readonly TextSpan[]):string {
  for(const line of [...lines].reverse())html=html.slice(0,line.start)+html.slice(line.end)
  return html
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
const escapeAttributeData=(text:string)=>text.replace(/[&"'`=<>\s]/g,
  character=>'&#'+character.codePointAt(0)+';')
function scriptDependencyAttribute(element:Element,attribute:Attribute):boolean {
  if(element.tagName!=='script')return false
  if(element.namespaceURI===htmlNamespace)return !attribute.namespace&&attribute.name==='src'
  return element.namespaceURI===svgNamespace&&attribute.name==='href'
    &&(!attribute.namespace||attribute.namespace===xlinkNamespace)
}
function executableAttributeData(element:Element,attribute:Attribute,value:string):boolean {
  const {name,namespace}=attribute,tag=element.tagName,html=element.namespaceURI===htmlNamespace
  if(scriptDependencyAttribute(element,attribute)||html&&tag==='iframe'&&!namespace&&name==='srcdoc')return true
  const navigation=html&&!namespace&&(name==='href'&&(tag==='a'||tag==='area')
    ||name==='src'&&(tag==='iframe'||tag==='frame')||name==='action'&&tag==='form'
    ||name==='formaction'&&(tag==='button'||tag==='input'))
    ||element.namespaceURI===svgNamespace&&tag==='a'&&name==='href'&&(!namespace||namespace===xlinkNamespace)
  if(!navigation)return false
  try {
    return new URL(value,'https://reader.invalid/').protocol==='javascript:'
  }catch {
    return false
  }
}
function connectedSourceElements(document:DefaultTreeAdapterTypes.Document):Element[] {
  const elements:Element[]=[],pending=[...document.childNodes].reverse()
  while(pending.length){
    const node=pending.pop()!
    if(!base.isElementNode(node))continue
    elements.push(node)
    // Template content has a separate fragment, outside this connected tree.
    for(let index=node.childNodes.length-1;index>=0;index--)pending.push(node.childNodes[index]!)
  }
  return elements
}
function programUrlDependsOnBase(value:string):boolean {
  if(!value.trim())return false
  try{new URL(value);return false}catch{return true}
}
export function captureReaderSourceDocumentV1(parts:readonly TavernPromptDisplayPartV1[],
  original?:ReaderSourceTemplateV1):ReaderSourceDocument {
  const strings=new Map<number,{start:number;end:number;value:string}[]>()
  if(parts.every(part=>part.kind==='literal')) {
    const html=parts.map(part=>part.text).join('')
    if(original?.template===html)return original.document
    if(/^[ ]{0,3}(?:`{3,}|~{3,})(?:html)?[ \t]*\r?$/im.test(html))return captureReaderSourceTemplateV1(html).document
    return {html,displaySpan:readerSourceHtmlSpan(html),strings,scripts:[]}
  }
  const source=parts.map(part=>part.kind==='literal'?part.text:part.kind==='macro'?part.sourceText:'').join('')
  const prefix='\ue000reader-'+sha256(source)+'-',pattern=new RegExp(prefix+'(\\d+)\ue001','g')
  const markers=parts.map((part,index)=>part.kind==='literal'?null:prefix+index+'\ue001')
  const markedParts=parts.map((part,index)=>markers[index]??part.text),marked=markedParts.join('')
  const span=readerSourceHtmlSpan(marked)
  const body=marked.slice(span.start,span.end)
  const parsed=parseSourceData(body,/^[ ]{0,3}(?:`{3,}|~{3,})(?:html)?[ \t]*\r?$/im.test(body))
  if(!parsed.hasSourceMarkup)throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE')
  const attributeData:ReaderNativeAttributeDataV1[]=[],attributeChecks=new Set<string>()
  let baseData:{element:Element;partIndex:number}[]|undefined,
    baseProgramData:{partIndex:number;bodyStarts:Set<number>}|undefined
  const occurrences=parts.map(()=>0),textParts=new Set<number>(),attributeParts=new Set<number>(),
    emptyUnquotedParts=new Set<number>()
  for(const text of parsed.texts)for(const match of text.matchAll(pattern)) {
    const index=Number(match[1]);occurrences[index]=occurrences[index]!+1;textParts.add(index)
  }
  for(const element of parsed.elements)for(const attribute of element.attrs) {
    if(!attribute.value.includes(prefix))continue
    const matches=[...attribute.value.matchAll(pattern)],
      value=attribute.value.replace(pattern,(_marker:string,index:string)=>parts[Number(index)]!.text),
      executable=executableAttributeData(element,attribute,value)
    if(element.namespaceURI===htmlNamespace&&element.tagName==='base'&&!attribute.namespace&&attribute.name==='href')
      (baseData??=[]).push({element,partIndex:Number(matches[0]![1])})
    for(const match of matches) {
      const index=Number(match[1]),part=parts[index]!
      // HTML attribute encoding preserves the DOM value. Script dependencies
      // and directly interpreted browser programs retain Source ownership.
      if(executable)throw Error(part.kind==='macro'
        ?'READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED':'READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
      if(!attribute.namespace&&attribute.name.startsWith('on')){
        const key=element.namespaceURI+'|'+element.tagName+'|'+attribute.name+'|'+part.kind
        if(!attributeChecks.has(key)){
          attributeChecks.add(key)
          attributeData.push({namespaceURI:element.namespaceURI,tagName:element.tagName,name:attribute.name,
            failureCode:part.kind==='macro'?'READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED'
              :'READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED'})
        }
      }
      // Formatting reconstruction can copy one authored attribute into several
      // DOM elements. Its unique Source marker still denotes one DATA slot.
      if(!attributeParts.has(index))occurrences[index]=occurrences[index]!+1
      attributeParts.add(index)
    }
    if(value==='') {
      // Locations retain tokenizer names before parse5 adjusts SVG casing.
      const name=(attribute.prefix?attribute.prefix+':':'')+attribute.name,
        location=element.sourceCodeLocation?.attrs?.[name.toLowerCase()],
        authored=location?body.slice(location.startOffset,location.endOffset):undefined,
        quote=authored?.slice(authored.indexOf('=')+1).trimStart()[0]
      // An empty unquoted token would consume the next Source attribute.
      if(authored&&quote!=='"'&&quote!=="'")emptyUnquotedParts.add(Number(matches[0]![1]))
    }
  }
  if(baseData){
    const connected=connectedSourceElements(parsed.document),effectiveBase=connected.find(element=>
      element.namespaceURI===htmlNamespace&&element.tagName==='base'
        &&element.attrs.some(attribute=>!attribute.namespace&&attribute.name==='href')),
      selected=baseData.find(row=>row.element===effectiveBase)
    if(selected)for(const element of connected){
      // Parser-prepared scripts preceding this base retain their earlier URL.
      if(element.tagName!=='script'||element.sourceCodeLocation!.startOffset<effectiveBase!.sourceCodeLocation!.startOffset)continue
      const mode=scriptMode(element)
      if(mode==='data'||mode==='classic'&&element.namespaceURI===htmlNamespace
        &&element.attrs.some(attribute=>!attribute.namespace&&attribute.name==='nomodule'))continue
      const dependency=element.attrs.find(attribute=>scriptDependencyAttribute(element,attribute))
      if(dependency){
        if(programUrlDependsOnBase(dependency.value))throw Error(parts[selected.partIndex]!.kind==='macro'
          ?'READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED':'READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
      }else{
        const location=element.sourceCodeLocation!
        baseProgramData??={partIndex:selected.partIndex,bodyStarts:new Set()}
        baseProgramData.bodyStarts.add(location.startTag?.endOffset??location.startOffset)
      }
    }
  }
  for(const script of parsed.scripts){
    const hasData=script.mode!=='data'&&script.javascript.includes(prefix),
      basePartIndex=baseProgramData?.bodyStarts.has(script.bodySpan.start)?baseProgramData.partIndex:undefined
    if(!hasData&&basePartIndex===undefined)continue
    if(hasData)for(const match of script.javascript.matchAll(pattern))if(parts[Number(match[1])]!.kind!=='macro')
      throw Error('READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
    const file=ts.createSourceFile('reader-macro-slots.js',script.javascript,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
    const slots:{start:number;end:number;value:string}[]=[]
    const visit=(node:import('typescript').Node):void=>{
      if(basePartIndex!==undefined){
        let specifier:import('typescript').Expression|undefined
        if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))specifier=node.moduleSpecifier
        else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)specifier=node.arguments[0]
        while(specifier&&ts.isParenthesizedExpression(specifier))specifier=specifier.expression
        // Explicit DATA consumption retains the macro-string execution path.
        if(specifier&&ts.isStringLiteralLike(specifier)&&!specifier.text.includes(prefix)
          &&(specifier.text.startsWith('/')||specifier.text.startsWith('./')||specifier.text.startsWith('../')))
          throw Error(parts[basePartIndex]!.kind==='macro'
            ?'READER_REGEX_DOCUMENT_MACRO_CONTEXT_UNSUPPORTED':'READER_REGEX_DOCUMENT_CAPTURE_CONTEXT_UNSUPPORTED')
      }
      if(hasData&&(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&node.text.includes(prefix)) {
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
  const finalParts=parts.map((part,index)=>{
    if(part.kind==='literal')return part.text
    if(textParts.has(index))return escape(part.text)
    if(emptyUnquotedParts.has(index))return '""'
    if(attributeParts.has(index))return escapeAttributeData(part.text)
    return markers[index]!
  })
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
  const removed=htmlFenceLines(body,parsed).map(line=>({
    start:translate(span.start+line.start),end:translate(span.start+line.end)}))
  const html=removeFenceLines(finalParts.join(''),removed),displaySpan=readerSourceHtmlSpan(html)
  const displayed=(offset:number)=>{
    const raw=translate(offset)
    return raw-removed.reduce((length,line)=>length+(line.end<=raw?line.end-line.start:0),0)-displaySpan.start
  }
  const scripts=parsed.scripts.map(script=>({...script,bodySpan:{
    start:displayed(span.start+script.bodySpan.start),end:displayed(span.start+script.bodySpan.end)}}))
  return {html,displaySpan,strings,scripts,...attributeData.length?{attributeData}:{}}
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

/** Locate an author Source carrier without repairing or rewriting its bytes.
 * parse5 owns fragment structure as well as explicit document roots. Implicit
 * parser elements alone cannot turn ordinary text into an author document. */
export function readerRegexDocumentHtmlSpan(template:string):{start:number;end:number}|undefined {
  return captureReaderSourceTemplateV1(template).htmlSpan
}
/** One Source parse owns both admission identity and its literal display.
 * Callers retain this fact alongside their existing replacement inventory. */
export function captureReaderSourceTemplateV1(template:string):ReaderSourceTemplateV1 {
  const span=readerSourceHtmlSpan(template),body=template.slice(span.start,span.end),
    parsed=parseSourceData(body,/^[ ]{0,3}(?:`{3,}|~{3,})(?:html)?[ \t]*\r?$/im.test(body)),
    removed=htmlFenceLines(body,parsed).map(line=>({start:span.start+line.start,end:span.start+line.end})),
    html=removeFenceLines(template,removed)
  return {template,htmlSpan:parsed.hasSourceMarkup?span:undefined,
    document:{html,displaySpan:readerSourceHtmlSpan(html),strings:new Map(),scripts:[]}}
}
function readerSourceHtmlSpan(template:string):{start:number;end:number} {
  let start=template.length-template.trimStart().length,end=template.trimEnd().length
  const outer=template.slice(start,end),fence=outer.match(/^(`{3,}|~{3,})(?:html)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i)
  if(fence){
    start+=outer.indexOf('\n')+1
    end=start+fence[2]!.length
    const body=template.slice(start,end)
    start+=body.length-body.trimStart().length;end-=body.length-body.trimEnd().length
  }
  return {start,end}
}

