import {createHash} from 'node:crypto'
import type {CommunityJson,CommunityPresetProfile} from './community-preset-types.js'
import {annotateCommunityIzumiPrompts} from './community-preset-plans.js'

type Data=Record<string,CommunityJson>
const obj=(value:CommunityJson|undefined):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const list=(value:CommunityJson|undefined):CommunityJson[]=>Array.isArray(value)?value:[]

export interface CommunityProfileModuleInputV1 {
  schemaVersion:1
  entry:string
  modules:Record<string,string>
  clockEpochMs:number
  randomSeed:string
  answers?:Data
}
export type CommunityProfileEvaluatorV1=(input:CommunityProfileModuleInputV1)=>Promise<{
  configuration?:Data;predicates:readonly boolean[]
}>

function declaredProfile(value:Data,id:CommunityPresetProfile['id'],extraEnabled?:CommunityJson):CommunityPresetProfile {
  if(!Array.isArray(value.groups)||!Array.isArray(value.actions)
    ||!value.configuration||typeof value.configuration!=='object'||Array.isArray(value.configuration)
    ||!value.transport||typeof value.transport!=='object'||Array.isArray(value.transport)
    ||value.id!==undefined&&value.id!==id||value.version!==undefined&&value.version!==1)
    throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID')
  const profile={...structuredClone(value),id,version:1} as unknown as CommunityPresetProfile,
    extra=obj(profile.configuration.extraParameters)
  if(extraEnabled===true&&extra.value===undefined)throw Error('COMMUNITY_PROFILE_CONFIG_REQUIRED')
  if(typeof extraEnabled==='boolean'&&extra.value!==undefined)extra.enabled=extraEnabled
  return profile
}

export async function resolveCommunityProfileConfiguration(preset:import('./community-preset-types.js').CommunityPresetV1,
  evaluate?:CommunityProfileEvaluatorV1,answers?:Data):Promise<readonly boolean[]> {
  const native=obj(preset.extensions?.nexttavern),declaration=obj(native.profileConfiguration)
  if(declaration.kind!=='module')return []
  const rules=list(obj(preset.profile.configuration[preset.profile.id]).configurationRules)
  if(answers!==undefined&&!rules.some(rule=>{
    const when=obj(obj(rule).when)
    return when.kind==='module-predicate'&&when.schemaVersion===1
  }))return []
  if(!evaluate)throw Error('COMMUNITY_PROFILE_RUNTIME_UNAVAILABLE')
  const modules=obj(declaration.modules)
  if(typeof declaration.entry!=='string'||!declaration.entry||!Object.hasOwn(modules,declaration.entry)
    ||Object.values(modules).some(value=>typeof value!=='string'))throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID')
  const clockEpochMs=typeof declaration.clockEpochMs==='number'?declaration.clockEpochMs:Date.now(),
    randomSeed=typeof declaration.randomSeed==='string'?declaration.randomSeed:
      createHash('sha256').update(JSON.stringify([declaration.entry,modules])).digest('hex')
  const result=await evaluate({schemaVersion:1,entry:declaration.entry,modules:modules as Record<string,string>,
    clockEpochMs,randomSeed,...answers?{answers}:{}})
  if(answers===undefined) {
    preset.profile=declaredProfile(obj(result.configuration),preset.profile.id,native.extraParameters)
    if(declaration.controlAnswers!==undefined)preset.profile.controlAnswers=structuredClone(obj(declaration.controlAnswers))
    if(preset.profile.transport.kind==='izumi')annotateCommunityIzumiPrompts(preset.prompts,preset.promptOrder)
  }
  // Freeze the execution basis in current content. Original source remains exact.
  preset.extensions={...preset.extensions,nexttavern:{...native,
    profileConfiguration:{...declaration,clockEpochMs,randomSeed}}}
  return result.predicates
}

export function extractCommunityPresetProfile(raw:Data):CommunityPresetProfile {
  const native=obj(obj(raw.extensions).nexttavern),id=native.profile??'standard',declaration=obj(native.profileConfiguration)
  if(typeof id!=='string'||!id.trim())throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID')
  if(declaration.kind!==undefined){
    if(declaration.schemaVersion!==1)throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID')
    if(declaration.kind==='data')return declaredProfile(obj(declaration.value),id,native.extraParameters)
    if(declaration.kind==='module')return {id,version:1,groups:[],configuration:{},transport:{kind:'standard'},actions:[]}
    throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID')
  }
  if(id!=='standard'||native.extraParameters===true)throw Error('COMMUNITY_PROFILE_CONFIG_REQUIRED')
  return {id,version:1,groups:[],configuration:{},transport:{kind:'standard'},actions:[]}
}
