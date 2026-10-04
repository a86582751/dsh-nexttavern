/** Inert facts from Root's actual private opening material supplier. JSON,
 * checksums and these types cannot select that owner or recreate its phase. */
import type {NativeOpeningOwnerIdentityV1} from '@deepseek-ai/dsh-agent-loop'
import type {ProgramOpeningIntentSeedV1,ProgramOpeningInputPacketV1,ProgramOpeningAbsentDomainV1}
  from './roleplay-program-opening-records.js'
import type {ProgramGenesisDataRefV1} from './roleplay-program-genesis-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernSourceInheritanceDescriptorV1,TavernSourceNativeCutV1}
  from './roleplay-tavern-source-inheritance-types.js'
import type {ProgramAbsenceInventoryV1} from './roleplay-program-absence-inventory.js'

/** Current author/editor DATA supplied by the actual InputState capture. */
export interface TavernOpeningPreparationSourceDataV1 {
  readonly sourceCurrentIdentitySha256:string
  readonly includeCardStyle:boolean
  readonly editorRevision:number
  readonly editorHeadSha256:string|null
  readonly currentNativeOverlaySha256:string|null
}

export interface TavernPendingOpeningPromptScopeDataV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-prompt-scope-read-data-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly numericalSourceSha256:string
  readonly sourceProofSha256:string
  readonly basisSha256:string
  readonly seed:ProgramOpeningIntentSeedV1
  readonly input:ProgramOpeningInputPacketV1
  readonly seedRef:ProgramGenesisDataRefV1
  readonly inputRef:ProgramGenesisDataRefV1
  readonly nativeOwner:NativeOpeningOwnerIdentityV1
  /** Actual first prepare selection; later lineage belongs to material owner. */
  readonly selectedBaseSha256:string
  /** Body binding, distinct from inputRef's hash of the complete stored row. */
  readonly inputBindingSha256:string
  readonly initialization:
    |{readonly kind:'absent';readonly markerCount:0;readonly inventorySha256:string;readonly initialized:false}
    |{readonly kind:'pending-raw-init-data';readonly planSha256:string;readonly initialValues:MvuJsonObject;
      readonly initialValuesSha256:string;readonly initialized:false}
  readonly scopeDataSha256:string
}
export interface TavernActualPendingOpeningPromptScopesV1 {
  readonly data:TavernPendingOpeningPromptScopeDataV1
  /** Supplier owner only. The outer InputState owns DATA invalidation. */
  current():boolean
}

/** Settled readonly absence facts from Root's actual completed schema7 owner.
 * They neither borrow the pending Native owner nor mint numerical state. */
export interface TavernProgramAbsencePromptScopeDataV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-opening-absence-scope-read-data-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly numericalSourceSha256:string
  readonly seed:ProgramOpeningIntentSeedV1
  readonly input:ProgramOpeningInputPacketV1
  readonly absenceDomain:ProgramOpeningAbsentDomainV1
  readonly domainRef:ProgramGenesisDataRefV1
  readonly factsSha256:string
}
export interface TavernActualProgramAbsencePromptScopesV1 {
  readonly data:TavernProgramAbsencePromptScopeDataV1
  /** Supplier owner only. The outer InputState owns DATA invalidation. */
  current():boolean
}

/** Original schema7 data retained by a real child Source archive. The carrier
 * and current Source remain the child's; the opening packets keep their actual
 * original Session identity. No new state/head/genesis is represented here. */
export interface TavernProgramInheritedAbsencePromptScopeDataV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-inherited-absence-scope-read-data-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly numericalSourceSha256:string
  readonly sourceInheritance:TavernSourceInheritanceDescriptorV1
  readonly currentSourceIdentitySha256:string
  readonly seed:ProgramOpeningIntentSeedV1
  readonly input:ProgramOpeningInputPacketV1
  readonly absenceDomain:ProgramOpeningAbsentDomainV1
  readonly originalOpening:{
    readonly ownerSessionId:string
    readonly closureSha256:string
    readonly archiveRef:ProgramGenesisDataRefV1
    readonly seedRef:ProgramGenesisDataRefV1
    readonly inputRef:ProgramGenesisDataRefV1
    readonly intentRef:ProgramGenesisDataRefV1
    readonly domainRef:ProgramGenesisDataRefV1
  }
  readonly actualChildCut:{
    readonly sessionId:string
    readonly parentSessionId:string
    readonly inheritedEventCount:number
    readonly cut:TavernSourceNativeCutV1
  }
  /** This capture's audit. Writer membership is not stable Source identity. */
  readonly inventory:ProgramAbsenceInventoryV1
  readonly stableDomainSha256:string
  readonly factsSha256:string
}
export interface TavernActualProgramInheritedAbsencePromptScopesV1 {
  readonly data:TavernProgramInheritedAbsencePromptScopeDataV1
  /** Supplier owner only. The outer InputState owns DATA invalidation. */
  current():boolean
}
