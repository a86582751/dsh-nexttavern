import type {AuthorNativeSnapshotDataV1,AuthorNativeTavernRegexV1} from './author-native-helper-types.js'
import type {TavernPromptMacroSnapshotV1,TavernPromptRegexRuleV1,TAVERN_PROMPT_TRANSFORM_LIMITS_V1}
  from './tavern-prompt-transform-types.mjs'
import type {createTavernPromptTextKernelV1} from './tavern-prompt-text-kernel.mjs'
import type {AuthorCharacterLibraryPacketV1} from './roleplay-author-character-library.js'

export interface AuthorNativeFormatterDataV1 {
  readonly macros:TavernPromptMacroSnapshotV1
  readonly rules:readonly TavernPromptRegexRuleV1[]
  readonly regexDisabled:boolean
}
export interface AuthorNativeFormatterOptionsV1 {readonly depth?:number;readonly character_name?:string}
export type AuthorNativeFormatterSourceV1='user_input'|'ai_output'|'slash_command'|'world_info'|'reasoning'
export interface AuthorNativeFormatterContextV1 {
  readonly source:AuthorNativeFormatterSourceV1
  readonly destination:'display'|'prompt'
  readonly depth:number|null
}

/** Serialized with each realm. The supplied kernel owns the shared synchronous
 * semantics and this call consumes the actual current captured DATA. */
export function createAuthorNativeFormatterV1(
  read:(context?:AuthorNativeFormatterContextV1)=>{formatter?:AuthorNativeFormatterDataV1},
  kernel:ReturnType<typeof createTavernPromptTextKernelV1>,limits:typeof TAVERN_PROMPT_TRANSFORM_LIMITS_V1,
  variables?:(scope:'chat'|'global',key:string)=>{readonly value:string}|undefined) {
  return (text:string,source:AuthorNativeFormatterSourceV1,destination:'display'|'prompt',
    options:AuthorNativeFormatterOptionsV1={}):string=>{
    const placements={user_input:1,ai_output:2,slash_command:3,world_info:5,reasoning:6} as const
    if(!Object.hasOwn(placements,source))throw Error('AUTHOR_NATIVE_FORMATTER_SOURCE_UNSUPPORTED')
    if(destination!=='display'&&destination!=='prompt')throw Error('AUTHOR_NATIVE_FORMATTER_DESTINATION_UNSUPPORTED')
    const depth=options.depth??null,captured=read({source,destination,depth}).formatter
    if(!captured)throw Error('AUTHOR_NATIVE_FORMATTER_UNAVAILABLE')
    if(text.length>limits.inputChars)throw Error('AUTHOR_NATIVE_FORMATTER_LIMIT_INPUTCHARS')
    let jobs=0,work=0,matches=0
    const check=(field:'jobs'|'workChars'|'matches'|'outputChars'|'patternChars'|'replacementChars',value:number)=>{
      if(value>limits[field])throw Error('AUTHOR_NATIVE_FORMATTER_LIMIT_'+field.toUpperCase())
    }
    const macros=captured.macros,name=options.character_name,nameSha256=name===undefined?undefined:kernel.recordSha256(name),
      names=name===undefined?undefined:Object.fromEntries(Object.entries(macros.names).map(([key,binding])=>
        ['char','group','charIfNotGroup','groupNotMuted'].includes(key)
          ?[key,{...binding,value:name,valueSha256:nameSha256!}]:[key,binding])) as typeof macros.names,
      current=name===undefined?macros:{...macros,characterOverrides:[{name,names:names!},...macros.characterOverrides]}
    const result=kernel.format(text,captured.rules,current,{channel:destination,placement:placements[source],
      depth,isEdit:false,characterOverride:name??null},{
      issue(code){throw Error(code)},recordRead(){},variable:variables,
      budget:{job(){check('jobs',++jobs)},work(chars){work+=chars;check('workChars',work)},
        output(chars){check('outputChars',chars)},match(){check('matches',++matches)}},
      pattern(chars){check('patternChars',chars)},replacement(chars){check('replacementChars',chars)},
    },captured.regexDisabled)
    check('outputChars',result.length)
    return result
  }
}

export type AuthorNativeCurrentRegexOptionsV1={
  readonly enable_state?:'all'|'enabled'|'disabled'
}&({readonly type:'preset';readonly name?:string}
  |{readonly type:'character';readonly name?:string}
  |{readonly type:'global'}
  |{readonly type?:undefined;readonly scope?:'all'|'global'|'character'})

/** Serialized with each SDK realm. Owners supply standard DTOs at capture;
 * this facade only selects, filters and detaches that current DATA. */
export function createAuthorNativeCurrentRegex(
  read:()=>Pick<AuthorNativeSnapshotDataV1,'readonlyPreset'|'tavernRegexes'>&{
    readonly characterLibrary?:AuthorCharacterLibraryPacketV1
  }) {
  return (options:AuthorNativeCurrentRegexOptionsV1={})=>{
    const snapshot=read()
    let state:'all'|'enabled'|'disabled'|undefined
    let rules:readonly AuthorNativeTavernRegexV1[]
    const global=()=>{
      const value=snapshot.tavernRegexes?.global
      if(value===undefined)throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE')
      return value
    }
    const character=(name='current')=>{
      if(name!=='current'&&snapshot.characterLibrary){
        const key=name.toLowerCase(),entry=snapshot.characterLibrary.entries.find(row=>
          row.descriptor.name.toLowerCase()===key||row.descriptor.avatar?.toLowerCase()===key)
        if(!entry)throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED')
        return entry.regex.rules
      }
      const value=snapshot.tavernRegexes?.character
      if(value===undefined)throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE')
      if(name!=='current'&&name!==value.name)throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED')
      return value.rules
    }
    if(options.type==='preset') {
      const value=snapshot.readonlyPreset
      if(value?.kind!=='available')throw Error('AUTHOR_NATIVE_CURRENT_PRESET_UNAVAILABLE')
      if(options.name!==undefined&&options.name!=='in_use'&&options.name!==value.loadedName)
        throw Error('AUTHOR_NATIVE_REGEX_SELECTOR_UNSUPPORTED')
      const current=value.preset.extensions.regex_scripts
      if(!Array.isArray(current))throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNAVAILABLE')
      rules=current as AuthorNativeTavernRegexV1[]
    }else if(options.type==='character')rules=character(options.name)
    else if(options.type==='global')rules=global()
    else if(options.type===undefined) {
      state=options.enable_state??'all'
      if(state!=='all'&&state!=='enabled'&&state!=='disabled')throw Error('AUTHOR_NATIVE_REGEX_ENABLE_STATE_UNSUPPORTED')
      const scope=options.scope??'all'
      const scoped=(rows:readonly AuthorNativeTavernRegexV1[],scope:'global'|'character')=>rows.map(rule=>({...rule,scope}))
      if(scope==='all')rules=[...scoped(global(),'global'),...scoped(character(),'character')]
      else if(scope==='global')rules=scoped(global(),'global')
      else if(scope==='character')rules=scoped(character(),'character')
      else throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNSUPPORTED')
    }else throw Error('AUTHOR_NATIVE_REGEX_SCOPE_UNSUPPORTED')
    return structuredClone(state===undefined||state==='all'?rules:rules.filter(rule=>rule.enabled===(state==='enabled')))
  }
}
