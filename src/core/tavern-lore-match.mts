/** All third-party RegExp compilation/execution stays in existing bounded
 * workers. No matcher callback is accepted as execution or read authority. */
import {boundedRegexMatch,boundedSTRegexReplace,worldbookRegex}
  from './bounded-regex.js'

export class LoreEvaluationRefusal extends Error {
  constructor(readonly code:string,readonly entryId:string|null=null,readonly pointer:string|null=null) {
    super(code)
  }
}
export function refuse(code:string,entryId:string|null=null,pointer:string|null=null):never {
  throw new LoreEvaluationRefusal(code,entryId,pointer)
}
const asciiWord=(char:string|undefined):boolean=>!!char&&((char>='a'&&char<='z')
  ||(char>='A'&&char<='Z')||(char>='0'&&char<='9')||char==='_')

export class TavernLoreBoundedMatcherV1 {
  private readonly valid=new Set<string>()
  private calls=0
  private workerDispatches=0
  private work=0
  private readonly cache=new Map<string,boolean>()

  constructor(private readonly assertCurrent:()=>void=()=>{}) {}

  async matches(text:string,keys:readonly string[],caseSensitive:boolean,wholeWords:boolean):Promise<boolean[]> {
    if(text.length>32768)refuse('LORE_SCAN_TEXT_LIMIT')
    const result:boolean[]=[]
    for(const raw of keys) {
      this.assertCurrent()
      const key=raw.trim()
      if(key.length>512)refuse('LORE_MATCH_KEY_LIMIT')
      // Keys undergo substituteParams upstream; without a captured rendered
      // receipt the evaluator must never match unevaluated author macros.
      if(key.includes('{{')||key.includes('<%'))refuse('LORE_KEY_TEMPLATE_UNRENDERED')
      const cacheKey=JSON.stringify([text,key,caseSensitive,wholeWords])
      const cached=this.cache.get(cacheKey)
      if(cached!==undefined){result.push(cached);continue}
      if(++this.calls>4096)refuse('LORE_MATCH_CALL_LIMIT')
      this.work+=text.length+key.length
      if(this.work>8_000_000)refuse('LORE_MATCH_WORK_LIMIT')
      let matched=false
      if(key&&key.startsWith('/')&&key.lastIndexOf('/')>0) {
        const rawFlags=key.slice(key.lastIndexOf('/')+1)
        if(!/^(?!.*(.).*\1)[gimsuy]*$/.test(rawFlags))refuse('LORE_REGEX_FLAGS_UNSUPPORTED')
        // worldbookRegex strips y together with g, but sticky y is semantically
        // different from a plain test. Refuse rather than silently changing it.
        if(rawFlags.includes('y'))refuse('LORE_REGEX_STICKY_UNSUPPORTED')
        const parsed=worldbookRegex(key,caseSensitive)
        if(!/^(?!.*(.).*\1)[imsu]*$/.test(parsed.flags))refuse('LORE_REGEX_FLAGS_UNSUPPORTED')
        const identity=JSON.stringify(parsed)
        if(!this.valid.has(identity)) {
          if(this.valid.size>=128)refuse('LORE_REGEX_COUNT_LIMIT')
          if(++this.workerDispatches>128)refuse('LORE_REGEX_DISPATCH_LIMIT')
          const checked=await boundedSTRegexReplace({...parsed,flags:rawFlags,replacement:''},'')
          this.assertCurrent()
          if(!checked.ok)refuse(`LORE_REGEX_${checked.reason.toUpperCase().replaceAll('-','_')}`)
          this.valid.add(identity)
        }
        if(++this.workerDispatches>128)refuse('LORE_REGEX_DISPATCH_LIMIT')
        const checked=await boundedRegexMatch([parsed],text)
        this.assertCurrent()
        if(!checked.ok)refuse(`LORE_REGEX_${checked.reason.toUpperCase()}`)
        if(checked.matches.length!==1||typeof checked.matches[0]!=='boolean')refuse('LORE_REGEX_RESULT_INVALID')
        matched=checked.matches[0]
      } else if(key) {
        const haystack=caseSensitive?text:text.toLowerCase(),needle=caseSensitive?key:key.toLowerCase()
        // ST applies ASCII non-word boundaries only to a single whitespace-
        // delimited keyword. A phrase uses literal includes, even in whole mode.
        if(!wholeWords||needle.split(/\s+/).length>1)matched=haystack.includes(needle)
        else {
          let from=0
          for(;;) {
            const index=haystack.indexOf(needle,from)
            if(index<0)break
            if(!asciiWord(haystack[index-1])&&!asciiWord(haystack[index+needle.length])){matched=true;break}
            from=index+1
          }
        }
      }
      this.cache.set(cacheKey,matched);result.push(matched)
    }
    return result
  }
}
