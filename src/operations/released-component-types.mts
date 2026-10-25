/** Durable publication facts and the local execution closure derived from them.
 * File inventories remain owned by the immutable published archive. */
import type {AuthorHostIdentityV5,AuthorServerExecutorV4} from '../core/roleplay-author-host-types-v5.js'
import type {TavernTemplateEngineIdentityV1} from '../core/tavern-template-types.mjs'
import type {ProtectedFile} from './protected-packages.mjs'

export interface ReleasedComponentRef {
  name:string
  generation:string
  /** Exact dependency instance; payload bytes may be shared by two contexts. */
  context?:string
}
export type ReleasedComponentFactory = 'typescript-v1' | 'schema-v4-shared-typescript'
  | 'browser-v2-local-typescript' | 'browser-v3-shared-typescript'
  | 'prompt-v1-shared-typescript' | 'template-v2' | 'host-v5'
export interface ReleasedRuntimeComponent extends ReleasedComponentRef {
  version:string
  factory:ReleasedComponentFactory
  dependencies:{typescript?:ReleasedComponentRef}
  /** Present in an installed closure; absent in the publication declaration. */
  path?:string
}
export type ReleasedRuntimeRole = 'typescript'|'schema'|'browser'|'browserPartition'|'prompt'|'host'|'template'
export type ReleasedRuntimeRoles = Partial<Record<ReleasedRuntimeRole,ReleasedComponentRef>>
export interface CurrentRuntimeComponents {
  schemaVersion:1
  components:ReleasedRuntimeComponent[]
  roles:ReleasedRuntimeRoles
}
export interface PublishedRuntimeClosure extends CurrentRuntimeComponents {
  identities:{server?:AuthorServerExecutorV4;host?:AuthorHostIdentityV5;template?:TavernTemplateEngineIdentityV1}
}
export interface PublishedComponentSummary extends ReleasedComponentRef {
  version:string
  /** Member prefix inside the exact public tarball, including its package root. */
  archivePath:string
}
export type PublishedReadback = {
  kind:'npm';metadataUrl:string;integrity:string;shasum:string
} | {
  kind:'github';metadataUrl:string;repository:string;tag:string;releaseId:number;assetId:number
  publishedAt:string;assetDigest?:string;projectionCommit?:string
}
export interface PublishedReleaseRecord {
  schemaVersion:1
  packageName:string
  version:string
  /** Canonical build source, distinct from a public tag's projection commit. */
  sourceCommit:string
  archive:{url:string;sha256:string;bytes:number;rootPrefix:string;inventoryPath:string}
  publication:PublishedReadback
  components:PublishedComponentSummary[]
  runtime:PublishedRuntimeClosure
}
export interface PublishedReleaseCatalog {schemaVersion:1;releases:PublishedReleaseRecord[]}
export interface ReleasedRuntimeInventory {
  schemaVersion:1
  components:ReleasedRuntimeComponent[]
  releases:{version:string;archiveSha256:string}[]
  schemas:{server:AuthorServerExecutorV4;component:ReleasedComponentRef}[]
  authors:{server:AuthorServerExecutorV4;host:AuthorHostIdentityV5;roles:ReleasedRuntimeRoles}[]
  templates:{engine:TavernTemplateEngineIdentityV1;component:ReleasedComponentRef}[]
  /** Generated Node resolution bridges live beside, never inside, payloads. */
  dependencyNamespaces?:{
    component:ReleasedComponentRef
    dependency:ReleasedComponentRef
    path:string
    files:ProtectedFile[]
  }[]
}
export interface PublishedPackageInventory {
  schemaVersion:1
  productVersion:string
  packages:{name:string;version:string;files:ProtectedFile[]}[]
  currentRuntime?:CurrentRuntimeComponents
  releasedRuntime?:ReleasedRuntimeInventory
  [key:string]:unknown
}
export interface PublishedArchiveInspection {
  archive:string
  sha256:string
  bytes:number
  rootPrefix:string
  metadata:{name:string;version:string}
  provenance:{schemaVersion:number;sourceCommit:string;version:string;dirty?:boolean;product?:boolean}
  inventory:PublishedPackageInventory
}
