/** The shared numerical address owns both the selected execution leaf and
 * its optional opening-variant selection. Event heads remain event DATA. */
import {recordSha256} from './roleplay-data.js'
import {mvuStateCurrentHeadKey} from './roleplay-mvu-state.js'
import {isMvuSchemaGenesisHead} from './roleplay-mvu-schema-story-types.js'
import type {MvuSchemaNumericalHead} from './roleplay-mvu-schema-story-types.js'

export interface MvuOpeningVariantSelectionV1 {
  readonly setRef:{readonly key:string;readonly sha256:string}
  readonly activeVariantId:string
}
export interface MvuNumericalPublicationV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-numerical-publication-v1'
  readonly sessionId:string
  readonly openingVariants:MvuOpeningVariantSelectionV1|null
  readonly leaf:MvuSchemaNumericalHead
}
export interface MvuNumericalPublicationRead {
  readonly sessionId:string
  readonly key:string
  readonly raw:unknown
  readonly leaf:MvuSchemaNumericalHead|undefined
  readonly openingVariants:MvuOpeningVariantSelectionV1|null
}
interface NumericalTable {
  get(key:string):unknown
  put(key:string,value:unknown):Promise<unknown>
}
export type MvuNumericalPublicationWrite={readonly kind:'acknowledged';readonly key:string;readonly value:unknown}
  |{readonly kind:'conflict'|'unknown'}

const same=(left:unknown,right:unknown)=>left===right||recordSha256(left)===recordSha256(right)
function envelope(raw:unknown):MvuNumericalPublicationV1|undefined {
  return (raw as MvuNumericalPublicationV1|undefined)?.encoding==='native-mvu-numerical-publication-v1'
    ?raw as MvuNumericalPublicationV1:undefined
}
/** Frozen-prefix readers still enroll the complete stored publication row.
 * Only their existing event fold consumes this event-derived leaf. */
export function mvuNumericalPublicationLeaf(raw:unknown):MvuSchemaNumericalHead|undefined {
  return envelope(raw)?.leaf??raw as MvuSchemaNumericalHead|undefined
}
export function mvuNumericalPublicationMatches(raw:unknown,expected:MvuSchemaNumericalHead):boolean {
  return raw===undefined?isMvuSchemaGenesisHead(expected):same(mvuNumericalPublicationLeaf(raw),expected)
}

export function createMvuNumericalPublicationOwner(table:NumericalTable) {
  function read(sessionId:string):MvuNumericalPublicationRead {
    const key=mvuStateCurrentHeadKey(sessionId),raw=table.get(key),stored=envelope(raw)
    return {sessionId,key,raw,leaf:mvuNumericalPublicationLeaf(raw),openingVariants:stored?.openingVariants??null}
  }
  async function publish(prior:MvuNumericalPublicationRead,next:unknown):Promise<MvuNumericalPublicationWrite> {
    const actual=table.get(prior.key)
    if(!same(actual,prior.raw)&&!same(actual,next))return {kind:'conflict'}
    if(!same(actual,next))try {await table.put(prior.key,next)}catch {
      // A failed acknowledgement is resolved only by the actual shared row.
    }
    const observed=table.get(prior.key)
    return same(observed,next)?{kind:'acknowledged',key:prior.key,value:observed}:{kind:'unknown'}
  }
  function advanceLeaf(prior:MvuNumericalPublicationRead,leaf:MvuSchemaNumericalHead) {
    const stored=envelope(prior.raw)
    return publish(prior,stored?{...stored,leaf}:leaf)
  }
  function replaceVariants(prior:MvuNumericalPublicationRead,openingVariants:MvuOpeningVariantSelectionV1,
    leaf:MvuSchemaNumericalHead) {
    const next:MvuNumericalPublicationV1={schemaVersion:1,encoding:'native-mvu-numerical-publication-v1',
      sessionId:prior.sessionId,openingVariants,leaf}
    return publish(prior,next)
  }
  return {read,advanceLeaf,replaceVariants}
}
