/** Exact program policies. v1 fields/hash are historical data and stay frozen;
 * YAML is a separate capability, never a fallback after a rejected JSON parse. */
import {recordSha256} from './roleplay-data.js'

const policyContent=Object.freeze({
  schemaVersion:1 as const,id:'native-json-initialization-v1' as const,version:1 as const,
  classifierId:'native-json-source-classifier-v1' as const,classifierVersion:1 as const,
  scope:'import-and-session-settings' as const,bindings:'embedded-primary-only' as const,
  grammar:'strict-json-object-simple-wrappers-v1' as const,originalLoaderSettlement:'not-proven' as const,
  staticAlgorithm:Object.freeze({dialect:'A' as const,
    sha256:'3759d0c8b9f82c67a606afae11de9a90e3ee4e63298ef622b89ac9127eb77047',
    commit:'b13b43bac24d585f2b523c12e423bb803fa9dd7c'}),
  bounds:Object.freeze({bytes:1048576,nodes:32000,depth:32,membershipRows:4096}),
})
export const NATIVE_MVU_SOURCE_POLICY=Object.freeze({...policyContent,sha256:recordSha256(policyContent)})
const yamlPolicyContent=Object.freeze({
  schemaVersion:2 as const,id:'native-json-yaml-initialization-v2' as const,version:2 as const,
  classifierId:'native-json-yaml-source-classifier-v2' as const,classifierVersion:2 as const,
  scope:'import-and-session-settings' as const,bindings:'embedded-primary-only' as const,
  grammar:'yaml-1.2-json-data-v1' as const,originalLoaderSettlement:'not-proven' as const,
  staticAlgorithm:policyContent.staticAlgorithm,
  bounds:Object.freeze({bytes:1048576,nodes:32000,depth:32,membershipRows:4096,arrayLength:4096,
    numberMagnitude:Number.MAX_SAFE_INTEGER,syntaxTokens:128000,aliases:256}),
})
export const NATIVE_MVU_YAML_SOURCE_POLICY=Object.freeze({...yamlPolicyContent,sha256:recordSha256(yamlPolicyContent)})
export type NativeMvuSourcePolicy=typeof NATIVE_MVU_SOURCE_POLICY|typeof NATIVE_MVU_YAML_SOURCE_POLICY
function exactConstant(actual:unknown,expected:unknown):boolean {
  if(expected===null||typeof expected!=='object')return actual===expected
  if(!actual||typeof actual!=='object'||Array.isArray(actual)||Object.getOwnPropertySymbols(actual).length)return false
  if(![Object.prototype,null].includes(Object.getPrototypeOf(actual)))return false
  const descriptors=Object.getOwnPropertyDescriptors(actual),keys=Object.keys(expected)
  if(Object.keys(descriptors).length!==keys.length)return false
  return keys.every(key=>{
    const item=descriptors[key]
    return !!item&&Object.hasOwn(item,'value')&&item.enumerable
      &&exactConstant(item.value,(expected as Record<string,unknown>)[key])
  })
}
/** The complete canonical constant must match, including unsupported fields. */
export function isNativeMvuSourcePolicy(value:unknown):value is NativeMvuSourcePolicy {
  try {return exactConstant(value,NATIVE_MVU_SOURCE_POLICY)||exactConstant(value,NATIVE_MVU_YAML_SOURCE_POLICY)}
  catch {return false}
}
export function isNativeMvuYamlSourcePolicy(value:unknown):value is typeof NATIVE_MVU_YAML_SOURCE_POLICY {
  try {return exactConstant(value,NATIVE_MVU_YAML_SOURCE_POLICY)}catch {return false}
}

/** Only an extracted InitVar payload is classified. Quoted text/comments are
 * not searched for incidental colons; JSON containers/JSON-labelled fences
 * always retain the historical strict-JSON parser, including invalid JSON. */
export function nativeMvuPayloadGrammar(payload:string,fenceHeader='',originalFenceHeader=fenceHeader,
  originalPayload=payload):'json'|'yaml' {
  const text=payload.trimStart()
  const original=originalPayload.trim()
  // A whole JSON-style quoted scalar stays JSON even if a trusted identity
  // expansion inserts a colon/newline. Non-object JSON never becomes YAML.
  let quotedScalar=false
  if(original.startsWith('"'))for(let index=1;index<original.length;index++) {
    if(original[index]==='\\'){index++;continue}
    if(original[index]==='"') {quotedScalar=original.slice(index+1).trim()==='';break}
  }
  if(text.startsWith('{')||text.startsWith('[')||original.startsWith('{')||original.startsWith('[')||quotedScalar
    ||/^```[ \t]*json(?:5|c)?\b/i.test(fenceHeader)||/^```[ \t]*json(?:5|c)?\b/i.test(originalFenceHeader))return 'json'
  if(/^```[ \t]*(?:yaml|yml)\b/i.test(fenceHeader))return 'yaml'
  const lines=text.split(/\r?\n/)
  for(const raw of lines) {
    let line=raw.trimStart()
    if(!line||line.startsWith('#'))continue
    if(line==='%YAML 1.2'||/^---(?:[ \t]*(?:#.*)?)?$/.test(line))return 'yaml'
    // A root anchor may precede the block map; its syntax is validated by yaml.
    if(/^&[a-zA-Z0-9_-]+(?:[ \t]|$)/.test(line)) {
      line=line.replace(/^&[a-zA-Z0-9_-]+[ \t]*/,'')
      if(!line)continue
    }
    if(line[0]==='"'||line[0]==="'") {
      const quote=line[0]
      let index=1
      for(;index<line.length;index++) {
        if(quote==='"'&&line[index]==='\\'){index++;continue}
        if(line[index]===quote) {
          if(quote==="'"&&line[index+1]===quote){index++;continue}
          index++;break
        }
      }
      const rest=line.slice(index).trimStart()
      return /^:(?:[ \t]|$)/.test(rest)?'yaml':'json'
    }
    if(!'{}[]!*|>?'.includes(line[0]!)) {
      for(let index=1;index<line.length;index++)if(line[index]===':'
        &&(index===line.length-1||/[ \t]/.test(line[index+1]!)))return 'yaml'
    }
    return 'json'
  }
  return 'json'
}
