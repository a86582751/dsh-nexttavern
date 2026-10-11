/** Inert HTML and JavaScript parsing; bundled with its locked parser libraries. */
import {parseFragment,defaultTreeAdapter} from 'parse5'
import type {DefaultTreeAdapterTypes} from 'parse5'
import ts from 'typescript'

export interface EmbeddedSourceLiteralV1 {
  value:string
  carrier:'html'|'script'
  position:string
  name?:string
}

export function scriptLiteralsV1(source:string,position:string):EmbeddedSourceLiteralV1[] {
  const found:EmbeddedSourceLiteralV1[]=[]
  const file=ts.createSourceFile('source-music.js',source,ts.ScriptTarget.ES2023,true,ts.ScriptKind.JS)
  const stack:ts.Node[]=[file]
  while(stack.length) {
    const node=stack.pop()!
    // Concatenation/interpolation cannot identify a complete URI without
    // executing author code. Parentheses do not change that boundary.
    let parent=node.parent
    while(parent&&ts.isParenthesizedExpression(parent))parent=parent.parent
    if(ts.isStringLiteralLike(node)&&!ts.isBinaryExpression(parent)&&!ts.isTemplateSpan(parent)) {
      let name:string|undefined
      if(ts.isPropertyAssignment(parent)&&ts.isObjectLiteralExpression(parent.parent)) {
        const named=parent.parent.properties.find(property=>ts.isPropertyAssignment(property)
          &&property.name.getText(file)==='name'&&ts.isStringLiteralLike(property.initializer))
        if(named&&ts.isPropertyAssignment(named))name=(named.initializer as ts.StringLiteralLike).text
      }
      found.push({value:node.text,carrier:'script',position:position+'@'+node.getStart(file),...(name?{name}:{})})
    }
    ts.forEachChild(node,child=>{stack.push(child)})
  }
  return found
}

export function htmlLiteralsV1(source:string,position:string):EmbeddedSourceLiteralV1[] {
  if(!source.includes('<'))return []
  const found:EmbeddedSourceLiteralV1[]=[]
  const fragment=parseFragment(source,{sourceCodeLocationInfo:true})
  const stack:DefaultTreeAdapterTypes.Node[]=[fragment]
  while(stack.length) {
    const node=stack.pop()!
    if(defaultTreeAdapter.isElementNode(node)) {
      for(const attribute of node.attrs)if(attribute.name==='src') {
        const offset=node.sourceCodeLocation?.attrs?.[attribute.name]?.startOffset??0
        found.push({value:attribute.value,carrier:'html',position:position+'@'+offset})
      }
      if(node.tagName==='script') {
        const body=node.childNodes.filter(defaultTreeAdapter.isTextNode).map(child=>child.value).join('')
        found.push(...scriptLiteralsV1(body,position+'@script'+(node.sourceCodeLocation?.startOffset??0)))
      }
      if(node.tagName==='template')stack.push(defaultTreeAdapter.getTemplateContent(node as DefaultTreeAdapterTypes.Template))
    }
    if('childNodes'in node)for(let index=node.childNodes.length-1;index>=0;index--)stack.push(node.childNodes[index]!)
  }
  return found
}
