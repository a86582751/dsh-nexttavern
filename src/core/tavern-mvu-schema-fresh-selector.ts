/** A fresh-package candidate selector, never an author plan or capability.
 * Historical realms always use their retained exact implementation tuple. */
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {FIXED_STATE_LOADER_POLICY_V1} from './tavern-mvu-state-loader-policy-v4.mjs'
import type {MvuSchemaAuthorScript} from './tavern-mvu-schema-types.js'

export interface FreshSchemaExecutorCandidateV1 {
  schemaVersion:1
  authority:'selection-hint-only'
  suggestedExecutorVersion:3|4
  reason:'fixed-url-candidate'|'escaped-import-candidate'|'no-candidate'
}
export function selectFreshSchemaExecutorV1(
  input:readonly Pick<MvuSchemaAuthorScript,'enabled'|'source'>[],
):FreshSchemaExecutorCandidateV1 {
  const scripts=cloneSchemaData(input,MVU_SCHEMA_BOUNDS.programBytes)
  if(!Array.isArray(scripts)||scripts.length>MVU_SCHEMA_BOUNDS.scripts)throw Error('SCHEMA_SELECTOR_INPUT_INVALID')
  let bytes=0,reason:FreshSchemaExecutorCandidateV1['reason']='no-candidate'
  for(const script of scripts) {
    if(!script||typeof script!=='object'||Array.isArray(script)
      ||typeof script.enabled!=='boolean'||typeof script.source!=='string')throw Error('SCHEMA_SELECTOR_INPUT_INVALID')
    bytes+=Buffer.byteLength(script.source,'utf8')
    if(bytes>MVU_SCHEMA_BOUNDS.sourceBytes)throw Error('SCHEMA_SELECTOR_SOURCE_LIMIT')
    if(!script.enabled)continue
    if(FIXED_STATE_LOADER_POLICY_V1.entries.some(([,url])=>script.source.includes(url)))reason='fixed-url-candidate'
    else if(reason==='no-candidate'&&script.source.includes('\\')&&/\bimport\b/.test(script.source)) {
      // The protected AST compiler interprets cooked literals. A conservative
      // candidate covers escaped imports without a second Host-side parser.
      reason='escaped-import-candidate'
    }
  }
  // Text in comments/data may select v4. Only its actual bounded compiler can
  // admit a complete schema/native plan; this result has no plan or 0REG proof.
  return Object.freeze({schemaVersion:1,authority:'selection-hint-only',suggestedExecutorVersion:reason==='no-candidate'?3:4,reason})
}
