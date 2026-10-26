/** Inert Source Reader stylesheet projection, bundled with its locked parsers. */
import {parseFragment,defaultTreeAdapter} from 'parse5'
import type {DefaultTreeAdapterTypes} from 'parse5'
import parseCss from 'css-tree/parser'
import walkCss from 'css-tree/walker'

/** ST-derived helpers can replace authored classes with custom-* at runtime.
 * Match both spellings with the original class specificity and keep all other
 * stylesheet bytes, including declaration escapes, under their author owner. */
function sourceClassAliasesCss(css:string):string {
  try {
    const ast=parseCss(css,{context:'stylesheet',positions:true,parseCustomProperty:true,onParseError:()=>{}})
    const patches:{start:number;end:number;text:string}[]=[]
    walkCss(ast,function(node){
      if(node.type!=='ClassSelector'||node.name!.startsWith('custom-'))return
      const {start,end}=node.loc!,selector=css.slice(start.offset,end.offset)
      patches.push({start:start.offset,end:end.offset,text:':is('+selector+',.custom-'+selector.slice(1)+')'})
    })
    let cursor=0
    const output:string[]=[]
    for(const patch of patches.sort((left,right)=>left.start-right.start)) {
      output.push(css.slice(cursor,patch.start),patch.text);cursor=patch.end
    }
    output.push(css.slice(cursor))
    return output.join('')
  }catch {
    // A browser may still apply the usable part of an author's partial sheet.
    return css
  }
}

/** Parse one Source literal in isolation. A capture cannot complete a STYLE
 * tag or supply any of its CSS; complete documents keep their own CSS owner. */
export function sourceLiteralReaderCss(literal:string):string {
  if(!/<style(?:\s|>)/i.test(literal))return ''
  const fragment=parseFragment(literal,{sourceCodeLocationInfo:true}),styles:string[]=[]
  const visit=(node:DefaultTreeAdapterTypes.Node):void=>{
    if(defaultTreeAdapter.isElementNode(node)&&node.tagName==='style') {
      const location=node.sourceCodeLocation
      if(location?.startTag&&location.endTag)
        styles.push(sourceClassAliasesCss(literal.slice(location.startTag.endOffset,location.endTag.startOffset)))
    }
    // Template contents stay inert, just as in the Reader markup projection.
    if('childNodes'in node)for(const child of node.childNodes)visit(child)
  }
  visit(fragment)
  return styles.join('\n')
}
