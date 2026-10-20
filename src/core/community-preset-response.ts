import type {CommunityJson,CommunityPresetProfile} from './community-preset-types.js'

export interface CommunityTextTransform {push(text:string):string;finish():string}
type Data=Record<string,CommunityJson>
const object=(value:CommunityJson|undefined):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const protectedNames=new Set(['updatevariable','jsonpatch','mvu','stat_data','delta_data','variable','variables'])

/** Imported replacement data is literal. This scanner never evaluates a
 * supplied pattern, macro, EJS body or variable update. */
function mapOutsideProtected(text:string,replace:(text:string)=>string):string {
  let result='',plain=0,index=0
  while(index<text.length) {
    let end=-1
    if(text.startsWith('<%',index)) {
      const close=text.lastIndexOf('%>')
      if(close>=index)end=close+2
    }else if(text.startsWith('{{',index)) {
      let depth=1,cursor=index+2
      while(cursor<text.length&&depth) {
        if(text.startsWith('{{',cursor)){depth++;cursor+=2}
        else if(text.startsWith('}}',cursor)){depth--;cursor+=2}
        else cursor++
      }
      if(!depth)end=cursor
    }else if(text[index]==='<') {
      const opening=/^<([A-Za-z_]+)\b[^>]*>/.exec(text.slice(index))
      if(opening&&protectedNames.has(opening[1]!.toLowerCase())) {
        const close=text.toLowerCase().indexOf(`</${opening[1]!.toLowerCase()}`,index+opening[0].length)
        if(close>=0){const bracket=text.indexOf('>',close);if(bracket>=0)end=bracket+1}
      }
    }
    if(end>=0){result+=replace(text.slice(plain,index))+text.slice(index,end);plain=end;index=end}
    else index++
  }
  return result+replace(text.slice(plain))
}
function literalSubstitute(text:string,replacements:readonly [string,string][],ignoreCase=false):string {
  let result='',index=0
  const search=ignoreCase?text.toLowerCase():text
  while(index<text.length) {
    const found=replacements.find(([key])=>search.startsWith(ignoreCase?key.toLowerCase():key,index))
    if(found){result+=found[1];index+=found[0].length}
    else result+=text[index++]
  }
  return result
}
export function createCommunitySanitizer(profile:CommunityPresetProfile,overrides:Data={}) {
  const izumi=object(profile.configuration.izumi),config={...object(izumi.sanitizer),...object(overrides.sanitizer)}
  const enabled=profile.id==='izumi'&&config.enabled!==false
  const replacements=Object.entries(object(config.replacements)).filter((entry):entry is [string,string]=>typeof entry[1]==='string')
    .sort((a,b)=>b[0].length-a[0].length)
  const reverse=replacements.map(([from,to])=>[to,from] as [string,string]).sort((a,b)=>b[0].length-a[0].length)
  const zero=typeof config.zeroWidthChar==='string'?config.zeroWidthChar:'\u200b'
  const words=(Array.isArray(config.words)?config.words:[]).filter((word):word is string=>typeof word==='string'&&!!word
    &&!replacements.some(([key])=>key===word)).sort((a,b)=>b.length-a.length)
  const maximum=Math.max(1,...reverse.map(([key])=>key.length))
  const restore=(text:string)=>literalSubstitute(text,reverse).split(zero).join('')
  const forward=(text:string)=>mapOutsideProtected(text,plain=>{
    // The source character name is exempt; a matching syllable elsewhere is not.
    const pieces=plain.split('小此').map(part=>literalSubstitute(part,replacements)).join('小此')
    let output='',offset=0
    const search=pieces.toLowerCase()
    while(offset<pieces.length) {
      const word=words.find(word=>search.startsWith(word.toLowerCase(),offset))
      if(word){output+=pieces.slice(offset,offset+word.length).split('').join(zero);offset+=word.length}
      else output+=pieces[offset++]
    }
    return output
  })
  return {enabled,config,forward:(text:string)=>enabled?forward(text):text,
    reverse:(text:string)=>enabled&&config.reverseEnabled!==false?restore(text):text,
    strategy(floor:number):'all'|'input_only'|'none' {
      if(!enabled)return 'none'
      if(config.scopeMode==='forever')return 'all'
      const threshold=Math.max(1,Number(config.threshold)||10)
      if(config.scopeMode!=='none'&&floor<=threshold)return 'all'
      return config.inputOnlyAfterX!==false?'input_only':'none'
    },createReverseStream():CommunityTextTransform {
      if(!enabled||config.reverseEnabled===false)return {push:text=>text,finish:()=>''}
      let pending=''
      const consume=(final:boolean)=>{
        let output='',index=0
        while(index<pending.length&&(final||pending.length-index>=maximum)) {
          const match=reverse.find(([key])=>pending.startsWith(key,index))
          if(match){output+=match[1];index+=match[0].length}
          else if(pending.startsWith(zero,index))index+=zero.length
          else output+=pending[index++]
        }
        pending=pending.slice(index);return output
      }
      return {push(text){pending+=text;return consume(false)},finish:()=>consume(true)}
    }}
}

/** Reborn only strips metadata at the beginning. Once ordinary prose starts,
 * identical labels inside the story remain visible. */
export function createCommunityHeaderCleaner():CommunityTextTransform {
  let pending='',started=false
  const labels=['finishreason:','finishmessage:']
  const consume=(final:boolean)=>{
    if(started){const output=pending;pending='';return output}
    while(pending) {
      const normalized=pending.trimStart().toLowerCase()
      const label=labels.find(label=>normalized.startsWith(label))
      if(label) {
        const start=pending.length-normalized.length+label.length
        const newline=/\r\n|\r|\n/.exec(pending.slice(start))
        if(!newline){if(final)pending='';return ''}
        const offset=start+newline.index
        if(!final&&newline[0]==='\r'&&offset===pending.length-1)return ''
        pending=pending.slice(offset+newline[0].length);continue
      }
      if(!final&&(!normalized||labels.some(label=>label.startsWith(normalized))))return ''
      started=true;const output=pending;pending='';return output
    }
    return ''
  }
  return {push(text){pending+=text;return consume(false)},finish:()=>consume(true)}
}
export function communityResponseHooks(profile:CommunityPresetProfile,features:Data={}) {
  const sanitizer=createCommunitySanitizer(profile,features)
  const reborn=object(profile.configuration.reborn)
  const preprocessing={...object(reborn.outputPreprocessing),...object(features.outputPreprocessing)}
  const clean=profile.id==='reborn'&&preprocessing.enabled===true&&features.outputPreprocessing!==false
  const dreamConfig={...object(profile.configuration.dream),...features}
  const dream=profile.id==='dream'&&dreamConfig.emptyPlotRecovery!==false
  const factory=():CommunityTextTransform=>{
    const head=clean?createCommunityHeaderCleaner():{push:(text:string)=>text,finish:()=>''}
    const restore=sanitizer.createReverseStream()
    return {push:text=>restore.push(head.push(text)),finish:()=>restore.push(head.finish())+restore.finish()}
  }
  return {schemaVersion:1 as const,createTextTransform:factory,normalizeText(text:string) {
    const transform=factory();return transform.push(text)+transform.finish()
  },recoverText(blocks:readonly {type:string;text?:string}[]):string|undefined {
    if(!dream)return undefined
    const extraction=object(dreamConfig.reasoningExtraction)
    if(extraction.start_regex!==undefined&&extraction.start_regex!=='^<dream_plot>')return undefined
    if(extraction.end_regex!==undefined&&extraction.end_regex!=='')return undefined
    const reasoning=blocks.filter(block=>block.type==='reasoning').map(block=>block.text??'').join('')
    return reasoning.startsWith('<dream_plot>')?reasoning.trimEnd():undefined
  }}
}
