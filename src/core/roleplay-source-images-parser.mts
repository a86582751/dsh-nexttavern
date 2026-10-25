/** Static Source image references. Parsers inspect DATA; author code never runs. */
import {parseFragment,defaultTreeAdapter} from 'parse5'
import type {DefaultTreeAdapterTypes} from 'parse5'
import {decodeHTML} from 'entities'
import ts from 'dsh-nexttavern-typescript-runtime'
import type * as TypeScript from 'typescript'
import parseCss from 'css-tree/parser'
import walkCss from 'css-tree/walker'

export type SourceImageCarrierV1='asset'|'markdown'|'html'|'css'|'script'
export interface SourceImageLiteralV1 {
  uri:string
  carrier:SourceImageCarrierV1
  position:string
  name?:string
  imageSink?:boolean
}
export interface SourceImageDiagnosticV1 {position:string;code:string;message:string}
export interface ParsedSourceImagesV1 {literals:SourceImageLiteralV1[];diagnostics:SourceImageDiagnosticV1[]}
type Range=readonly [number,number]
const empty=():ParsedSourceImagesV1=>({literals:[],diagnostics:[]})
const spaces=(char:string|undefined)=>char!==undefined&&/[\t\n\f\r ]/.test(char)
function escaped(source:string,index:number):boolean {
  let count=0
  while(index>0&&source[--index]==='\\')count++
  return count%2===1
}
function mask(source:string,ranges:readonly Range[]):string {
  let cursor=0,output=''
  for(const [start,end]of [...ranges].sort((left,right)=>left[0]-right[0])) {
    if(end<=cursor)continue
    output+=source.slice(cursor,Math.max(cursor,start))
    output+=source.slice(Math.max(cursor,start),end).replace(/[^\r\n]/g,' ')
    cursor=end
  }
  return output+source.slice(cursor)
}
function codeRanges(source:string):{common:Range[];markdown:Range[]} {
  const ranges:Range[]=[],indented:Range[]=[]
  let lineStart=0,fence:{start:number;mark:string;length:number}|undefined
  while(lineStart<source.length) {
    const newline=source.indexOf('\n',lineStart),end=newline<0?source.length:newline+1
    const line=source.slice(lineStart,end),marker=/^ {0,3}(`{3,}|~{3,})/.exec(line)
    if(fence) {
      if(marker?.[1]?.[0]===fence.mark&&marker[1].length>=fence.length
        &&!line.slice(marker[0].length).trim()) {
        ranges.push([fence.start,end]);fence=undefined
      }
    }else if(marker)fence={start:lineStart,mark:marker[1]![0]!,length:marker[1]!.length}
    else if(/^(?: {4}|\t)/.test(line))indented.push([lineStart,end])
    lineStart=end
  }
  if(fence)ranges.push([fence.start,source.length])
  const outside=mask(source,ranges)
  for(let index=0;index<outside.length;index++) {
    if(outside[index]!=='`'||escaped(outside,index))continue
    let end=index+1
    while(outside[end]==='`')end++
    const delimiter=outside.slice(index,end)
    let close=outside.indexOf(delimiter,end)
    while(close>=0&&(outside[close-1]==='`'||outside[close+delimiter.length]==='`')) {
      close=outside.indexOf(delimiter,close+delimiter.length)
    }
    if(close>=0){ranges.push([index,close+delimiter.length]);index=close+delimiter.length-1}
    else index=end-1
  }
  return {common:ranges,markdown:[...ranges,...indented]}
}
function markdownValue(value:string):string {
  return decodeHTML(value.replace(/\\([!-/:-@\[-`{-~])/g,'$1'))
}
function bracket(source:string,start:number):{text:string;end:number}|undefined {
  if(source[start]!=='[')return
  let depth=1
  for(let index=start+1;index<source.length;index++) {
    if(source[index]==='\\'){index++;continue}
    if(source[index]==='[')depth++
    else if(source[index]===']'&&!--depth)return {text:source.slice(start+1,index),end:index+1}
  }
}
function destination(source:string,start:number):{uri:string;start:number;end:number}|undefined {
  while(spaces(source[start]))start++
  const first=start
  if(source[start]==='<') {
    start++
    for(let index=start;index<source.length;index++) {
      if(source[index]==='\\'){index++;continue}
      if(source[index]==='\n'||source[index]==='\r'||source[index]==='<')return
      if(source[index]==='>')return {uri:markdownValue(source.slice(start,index)),start,end:index+1}
    }
    return
  }
  let depth=0,index=start
  for(;index<source.length;index++) {
    const char=source[index]
    if(char==='\\'){index++;continue}
    if(char==='(')depth++
    else if(char===')'){if(!depth)break;depth--}
    if(spaces(char))break
  }
  if(index>first&&!depth)return {uri:markdownValue(source.slice(first,index)),start:first,end:index}
}
function inlineEnd(source:string,start:number):number|undefined {
  while(spaces(source[start]))start++
  if(source[start]===')')return start+1
  const quote=source[start]
  if(quote!=='"'&&quote!=="'"&&quote!=='(')return
  const closing=quote==='('?')':quote
  let index=start+1
  for(;index<source.length;index++)if(source[index]===closing&&!escaped(source,index))break
  if(index===source.length)return
  index++
  while(spaces(source[index]))index++
  return source[index]===')'?index+1:undefined
}
function markdownImages(source:string,position:string):ParsedSourceImagesV1 {
  const result=empty(),definitions=new Map<string,{uri:string;position:string}>()
  const key=(value:string)=>markdownValue(value).trim().replace(/\s+/g,' ').toLowerCase()
  for(let start=0;start<source.length;) {
    const newline=source.indexOf('\n',start),end=newline<0?source.length:newline+1
    const indent=/^ {0,3}(?=\[)/.exec(source.slice(start,end))
    if(indent) {
      const label=bracket(source,start+indent[0].length)
      if(label&&source[label.end]===':') {
        const uri=destination(source,label.end+1)
        if(uri&&!definitions.has(key(label.text)))definitions.set(key(label.text),
          {uri:uri.uri,position:position+'@'+uri.start})
      }
    }
    start=end
  }
  for(let index=0;index<source.length;index++) {
    if(source[index]!=='!'||source[index+1]!=='['||escaped(source,index))continue
    const alt=bracket(source,index+1)
    if(!alt)continue
    if(source[alt.end]==='(') {
      const uri=destination(source,alt.end+1),end=uri&&inlineEnd(source,uri.end)
      if(uri&&end) {
        result.literals.push({uri:uri.uri,carrier:'markdown',position:position+'@'+index,name:markdownValue(alt.text)})
        index=end-1
      }
      continue
    }
    const reference=source[alt.end]==='['?bracket(source,alt.end):undefined
    const resolved=definitions.get(key(reference?.text||alt.text))
    if(resolved)result.literals.push({uri:resolved.uri,carrier:'markdown',
      position:position+'@'+index+'->'+resolved.position,name:markdownValue(alt.text)})
    else if(reference)result.diagnostics.push({position:position+'@'+index,code:'IMAGE_REFERENCE_MISSING',
      message:'Markdown 图片引用没有对应的静态地址定义。'})
    index=(reference?.end??alt.end)-1
  }
  return result
}

/** Srcset URL collection keeps internal commas (notably data URIs). The
 * separating comma follows a descriptor or trails the collected URL. */
function srcsetUris(value:string):{uri:string;offset:number}[] {
  const values:{uri:string;offset:number}[]=[]
  let index=0
  while(index<value.length) {
    while(spaces(value[index])||value[index]===',')index++
    const start=index
    while(index<value.length&&!spaces(value[index]))index++
    let uri=value.slice(start,index)
    if(!uri)break
    if(uri.endsWith(',')){uri=uri.replace(/,+$/,'');values.push({uri,offset:start});continue}
    let parentheses=0
    while(index<value.length) {
      const char=value[index++]
      if(char==='(')parentheses++
      else if(char===')'&&parentheses)parentheses--
      else if(char===','&&!parentheses)break
    }
    values.push({uri,offset:start})
  }
  return values
}

export function sourceImageCssLiteralsV1(source:string,position:string,
  context:'stylesheet'|'declarationList'='stylesheet',positionOffset=0):ParsedSourceImagesV1 {
  const result=empty()
  const diagnostic=(error:unknown)=>result.diagnostics.push({position,code:'IMAGE_CSS_PARSE',
    message:'CSS 图片地址仅保留成功解析的部分：'+String(error instanceof Error?error.message:error)})
  try {
    const ast=parseCss(source,{context,positions:true,parseCustomProperty:true,onParseError:diagnostic})
    walkCss(ast,function(node) {
      if(node.type!=='Url'||typeof node.value!=='string')return
      if(this.atrule?.name==='import'||this.atrule?.name==='font-face')return
      const declaration=(this as typeof this&{declaration?:{property:string}|null}).declaration
      if(!declaration)return
      const imageSink=/^(?:background(?:-image)?|border-image(?:-source)?|(?:-webkit-)?mask(?:-image|-border|-border-source)?|list-style(?:-image)?|cursor|shape-outside|content)$/.test(declaration.property.toLowerCase())
      if(!imageSink&&!declaration.property.startsWith('--'))return
      result.literals.push({uri:node.value,carrier:'css',
        position:position+'@'+((node.loc?.start.offset??0)-positionOffset),imageSink})
    })
  }catch(error){diagnostic(error)}
  return result
}

function dynamicAncestor(node:TypeScript.Node):TypeScript.Node|undefined {
  for(let parent=node.parent;parent&&!ts.isSourceFile(parent);parent=parent.parent) {
    if(ts.isTemplateExpression(parent)||ts.isTaggedTemplateExpression(parent)
      ||ts.isBinaryExpression(parent)&&parent.operatorToken.kind===ts.SyntaxKind.PlusToken)return parent
    if(ts.isCallExpression(parent)&&ts.isPropertyAccessExpression(parent.expression)
      &&parent.expression.name.text==='concat')return parent
  }
}
const imageMention=(value:string)=>/data:image\/|ccdefault:|\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?)\b|<img\b|url\s*\(/i.test(value)
function scriptCssContext(source:string):'stylesheet'|'declarationList'|'image-value'|undefined {
  let quote:string|undefined,parentheses=0
  // A brace inside a quoted URL or a function argument does not start a rule.
  for(let index=0;index<source.length;index++) {
    const char=source[index]
    if(char==='\\'){index++;continue}
    if(quote){if(char===quote)quote=undefined;continue}
    if(char==='/'&&source[index+1]==='*') {
      const end=source.indexOf('*/',index+2)
      if(end<0)break
      index=end+1;continue
    }
    if(char==='"'||char==="'"){quote=char;continue}
    if(char==='(')parentheses++
    else if(char===')')parentheses--
    else if(char==='{'&&!parentheses)return 'stylesheet'
  }
  const beginning=source.replace(/^(?:\s|\/\*[\s\S]*?\*\/)+/,'')
  if(/^[-\w]+\s*:/.test(beginning))return 'declarationList'
  if(/^(?:url|(?:-webkit-)?image-set)\s*\(/i.test(beginning))return 'image-value'
}
export function sourceImageScriptLiteralsV1(source:string,position:string):ParsedSourceImagesV1 {
  const result=empty(),reported=new Set<number>()
  const file=ts.createSourceFile('source-images.js',source,ts.ScriptTarget.ES2023,true,ts.ScriptKind.JS)
  const diagnostics=(file as TypeScript.SourceFile&{parseDiagnostics:readonly TypeScript.Diagnostic[]}).parseDiagnostics
  for(const diagnostic of diagnostics)result.diagnostics.push({position:position+'@'+(diagnostic.start??0),
    code:'IMAGE_SCRIPT_PARSE',message:ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n')})
  const unsupported=(node:TypeScript.Node)=>{
    const offset=node.getStart(file)
    if(reported.has(offset))return
    reported.add(offset)
    result.diagnostics.push({position:position+'@'+offset,code:'IMAGE_DYNAMIC_LITERAL',
      message:'图片相关字符串含拼接、插值或模板标签；未执行作者代码，无法确定完整地址。'})
  }
  const stack:TypeScript.Node[]=[file]
  while(stack.length) {
    const node=stack.pop()!
    if(ts.isTemplateExpression(node)&&imageMention(node.getText(file)))unsupported(node)
    if(ts.isStringLiteralLike(node)) {
      const raw=node.getText(file),parent=dynamicAncestor(node)
      if(parent) {if(imageMention(node.text))unsupported(parent)}
      else if(raw.length>=2&&raw.at(-1)===raw[0]&&!escaped(raw,raw.length-1)) {
        const at=position+'@'+node.getStart(file)
        let name:string|undefined
        if(ts.isPropertyAssignment(node.parent)&&ts.isObjectLiteralExpression(node.parent.parent)) {
          const named=node.parent.parent.properties.find(property=>ts.isPropertyAssignment(property)
            &&(ts.isIdentifier(property.name)||ts.isStringLiteralLike(property.name))
            &&property.name.text==='name'&&ts.isStringLiteralLike(property.initializer))
          if(named&&ts.isPropertyAssignment(named))name=(named.initializer as TypeScript.StringLiteralLike).text
        }
        result.literals.push({uri:node.text,carrier:'script',position:at,...(name?{name}:{})})
        const directUri=/^\s*(?:https?:\/\/|data:image\/)/i.test(node.text)
        if(!directUri&&(node.text.includes('<')||node.text.includes('!['))) {
          const nested=sourceImageTextLiteralsV1(node.text,at)
          result.literals.push(...nested.literals);result.diagnostics.push(...nested.diagnostics)
        }else if(!directUri&&/url\s*\(|image-set\s*\(/i.test(node.text)) {
          const context=scriptCssContext(node.text)
          if(context) {
            const prefix=context==='image-value'?'background-image:':''
            const css=sourceImageCssLiteralsV1(prefix+node.text,at+'@css',
              context==='stylesheet'?'stylesheet':'declarationList',prefix.length)
            result.literals.push(...css.literals);result.diagnostics.push(...css.diagnostics)
          }
        }
      }
    }
    const children:TypeScript.Node[]=[]
    ts.forEachChild(node,child=>{children.push(child)})
    for(let index=children.length-1;index>=0;index--)stack.push(children[index]!)
  }
  return result
}

export function sourceImageTextLiteralsV1(source:string,position:string):ParsedSourceImagesV1 {
  const result=empty(),markdownExcluded:Range[]=[],rawBodies:Range[]=[]
  const elements:DefaultTreeAdapterTypes.Element[]=[]
  if(source.includes('<')) {
    const fragment=parseFragment(source,{sourceCodeLocationInfo:true})
    const stack:DefaultTreeAdapterTypes.Node[]=[fragment]
    while(stack.length) {
      const node=stack.pop()!
      if(defaultTreeAdapter.isCommentNode(node)&&node.sourceCodeLocation) {
        const range:Range=[node.sourceCodeLocation.startOffset,node.sourceCodeLocation.endOffset]
        markdownExcluded.push(range);rawBodies.push(range)
      }
      if(defaultTreeAdapter.isElementNode(node)) {
        elements.push(node)
        const location=node.sourceCodeLocation
        if(['pre','code','textarea'].includes(node.tagName)&&location) {
          markdownExcluded.push([location.startOffset,location.endOffset])
          rawBodies.push([location.startTag?.endOffset??location.startOffset,location.endTag?.startOffset??location.endOffset])
        }
        if((node.tagName==='script'||node.tagName==='style')&&location) {
          markdownExcluded.push([location.startOffset,location.endOffset])
          rawBodies.push([location.startTag?.endOffset??location.startOffset,location.endTag?.startOffset??location.endOffset])
        }
        if(node.tagName==='template')stack.push(defaultTreeAdapter.getTemplateContent(node as DefaultTreeAdapterTypes.Template))
      }
      if('childNodes'in node)for(let index=node.childNodes.length-1;index>=0;index--)stack.push(node.childNodes[index]!)
    }
  }
  // Markdown delimiters inside raw script/style bodies belong to those
  // grammars. Keep their original strings for the dedicated static parsers.
  const code=codeRanges(mask(source,rawBodies))
  for(const node of elements) {
    const start=node.sourceCodeLocation?.startOffset??0
    if(code.common.some(([from,to])=>start>=from&&start<to))continue
    const name=node.attrs.find(attribute=>attribute.name==='alt')?.value
      ||node.attrs.find(attribute=>attribute.name==='title')?.value
    for(const attribute of node.attrs) {
      const offset=node.sourceCodeLocation?.attrs?.[attribute.name]?.startOffset??0
      if(node.tagName==='img'&&attribute.name==='src')result.literals.push({uri:attribute.value,
        carrier:'html',position:position+'@'+offset,...(name?{name}:{})})
      if(node.tagName==='img'&&attribute.name==='srcset')for(const item of srcsetUris(attribute.value)) {
        result.literals.push({uri:item.uri,carrier:'html',position:position+'@'+offset+':srcset@'+item.offset,
          ...(name?{name}:{})})
      }
      if(attribute.name==='style') {
        const css=sourceImageCssLiteralsV1(attribute.value,position+'@'+offset+':style','declarationList')
        result.literals.push(...css.literals);result.diagnostics.push(...css.diagnostics)
      }
    }
    if(node.tagName==='script'||node.tagName==='style') {
      const body=node.childNodes.filter(defaultTreeAdapter.isTextNode).map(child=>child.value).join('')
      const location=node.sourceCodeLocation,offset=location?.startTag?.endOffset??location?.startOffset??0
      const nested=node.tagName==='script'?sourceImageScriptLiteralsV1(body,position+'@script'+offset)
        :sourceImageCssLiteralsV1(body,position+'@style'+offset)
      result.literals.push(...nested.literals);result.diagnostics.push(...nested.diagnostics)
    }
  }
  const markdown=markdownImages(mask(source,[...code.markdown,...markdownExcluded]),position)
  result.literals.push(...markdown.literals);result.diagnostics.push(...markdown.diagnostics)
  return result
}
