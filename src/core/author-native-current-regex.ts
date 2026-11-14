import type {AuthorNativeSnapshotDataV1,AuthorNativeTavernRegexV1} from './author-native-helper-types.js'

export type AuthorNativeCurrentRegexOptionsV1={
  readonly enable_state?:'all'|'enabled'|'disabled'
}&({readonly type:'preset';readonly name?:string}
  |{readonly type:'character';readonly name?:string}
  |{readonly type:'global'}
  |{readonly type?:undefined;readonly scope?:'all'|'global'|'character'})

/** Serialized with each SDK realm. Owners supply standard DTOs at capture;
 * this facade only selects, filters and detaches that current DATA. */
export function createAuthorNativeCurrentRegex(
  read:()=>Pick<AuthorNativeSnapshotDataV1,'readonlyPreset'|'tavernRegexes'>) {
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
