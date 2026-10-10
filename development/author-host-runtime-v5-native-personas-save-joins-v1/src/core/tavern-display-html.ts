/** Active-content boundary shared by display owners. It grants no JS execution. */
export interface DisplayHtmlPolicy {
  readonly allowedTags:ReadonlySet<string>
  readonly dropTags:ReadonlySet<string>
  readonly safeAttributes:ReadonlySet<string>
  readonly tagCase?:'upper'
  readonly rejectActiveTags?:boolean
  /** A supplied style policy permits a STYLE node and returns its safe text. */
  readonly styleText?:(value:string)=>string|null
  readonly styleAttribute:(value:string)=>string
  /** The resource owner alone may preserve a URL attribute. */
  readonly urlAttribute?:(element:Element,name:string,value:string)=>string|null
}
const activeTags=new Set(['SCRIPT','IFRAME','OBJECT','EMBED','APPLET','META','BASE','LINK'])

/** The attribute entry and innerHTML entry use the same active-content rule.
 * A native DOM callback is installed by the listener owner, never an on* string. */
export function cleanDisplayAttribute(element:Element,name:string,value:string,policy:DisplayHtmlPolicy):string|null {
  name=name.toLowerCase()
  const allowed=policy.safeAttributes.has(name)||name.startsWith('aria-')||name.startsWith('data-')
  if(!allowed||name.startsWith('on')||name==='srcdoc')return null
  if(name==='href'||name==='src'||name==='xlink:href'||name==='action'||name==='formaction') {
    return policy.urlAttribute?.(element,name,value)??null
  }
  if(name==='style')return policy.styleAttribute(value)||null
  return value
}

export function sanitizeDisplayTree(root:DocumentFragment|Element,policy:DisplayHtmlPolicy):void {
  for(const element of Array.from(root.querySelectorAll('*'))) {
    if(!element.parentNode)continue
    const tag=policy.tagCase==='upper'?element.tagName.toUpperCase():element.tagName
    if(tag==='STYLE'&&policy.styleText) {
      const clean=policy.styleText(element.textContent??'')
      if(clean===null){element.remove();continue}
      if(element.textContent!==clean)element.textContent=clean
      for(const attribute of Array.from(element.attributes))element.removeAttribute(attribute.name)
      continue
    }
    if(policy.rejectActiveTags&&activeTags.has(element.tagName.toUpperCase())||policy.dropTags.has(tag)) {
      element.remove();continue
    }
    if(!policy.allowedTags.has(tag)) {
      const parent=element.parentNode
      while(element.firstChild)parent.insertBefore(element.firstChild,element)
      element.remove();continue
    }
    for(const attribute of Array.from(element.attributes)) {
      const clean=cleanDisplayAttribute(element,attribute.name,attribute.value,policy)
      if(clean===null)element.removeAttribute(attribute.name)
      else if(clean!==attribute.value)element.setAttribute(attribute.name,clean)
    }
    // Display owners choose whether a real form submit is part of their API.
    if(tag==='BUTTON'&&!policy.safeAttributes.has('type'))element.setAttribute('type','button')
  }
}
