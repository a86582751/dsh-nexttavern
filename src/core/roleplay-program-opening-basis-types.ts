/** Actual supplier-captured fresh Source and Native facts. The record grants no
 * Source lease, Native generation, initialization or protected execution. */
import type {TavernSourceInheritanceDescriptorV1,TavernSourceLegacyCopyV1}
  from './roleplay-tavern-source-inheritance-types.js'

export interface ProgramOpeningBasisProofV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-fresh-basis-proof-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly ownerSessionId:string
  readonly origin:'own-root'|'fresh-scene'
  readonly operationId:string
  readonly requestedMessageId:string
  readonly sourceBindingSha256:string
  readonly sourceRelation:{readonly kind:'own-root';readonly inheritance:null}
    |{readonly kind:'reserved-fresh-child';readonly inheritance:TavernSourceInheritanceDescriptorV1;
      readonly setup:Readonly<Record<string,unknown>>;readonly setupSha256:string}
    |{readonly kind:'legacy-fresh-child';readonly legacyCopy:TavernSourceLegacyCopyV1}
  readonly branch:{readonly metaKey:string;readonly metaCurrentIdentitySha256:string;
    readonly parentSessionId:null;readonly inheritedEventCount:0;readonly ready:true}
  readonly native:{readonly observedThroughSeq:number;readonly eventCount:number;readonly historySha256:string}
  readonly basisSha256:string
}
