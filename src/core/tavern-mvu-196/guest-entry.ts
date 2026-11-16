/** Trusted computational IIFE entry. Lodash is the existing guest instance.
 * The host supplies deterministic context adapters inside the guest realm. */
import JSON5 from 'json5'
import {klona} from 'klona'
import * as math from 'mathjs'
import {parse as parseYaml,parseDocument} from 'yaml'
import {jsonrepair} from 'jsonrepair'
import {createMvu196Core as createCore} from './update-core.js'
import type {Mvu196Environment,Mvu196Math} from './env.js'
export {createMvu196UpdateController} from './controller.js'
export {createAuthorNativeMvuHookGraph} from '../author-native-mvu-hook-graph.js'

export type Mvu196GuestHost=Pick<Mvu196Environment,
  'lodash'|'parseString'|'substituteMacros'|'translate'|'diagnostics'|'warning'>

export function createMvu196Core(host:Mvu196GuestHost) {
  return createCore({...host,json5:JSON5,clone:klona,yaml:{parse:parseYaml},math:math as unknown as Mvu196Math})
}

/** The fixed util/common.ts parser selects JSON-first only for collections.
 * These dependencies stay inside the computational guest. */
export function parseMvu196StructuredValue(content:string):unknown {
  const jsonFirst=/^[[{]/s.test(content.trimStart())
  let yamlError:unknown
  if(!jsonFirst) {
    try{return parseDocument(content,{merge:true}).toJS()}catch(error) {yamlError=error}
  }
  try{return JSON5.parse(content)}catch { /* Continue through repaired JSON and YAML. */ }
  try{return JSON.parse(jsonrepair(content))}catch { /* The final YAML parser owns the failure. */ }
  if(jsonFirst)return parseDocument(content,{merge:true}).toJS()
  throw yamlError
}
