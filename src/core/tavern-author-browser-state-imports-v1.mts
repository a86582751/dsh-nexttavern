/** Complete Browser AST output. This record describes exact local resolution;
 * it does not grant attachment lifetime or numerical publication. */
import type {AstSpanV1} from './tavern-mvu-author-execution-types-v4.mjs'
import type {BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'

/** In-memory projection of the accepted numerical program for this attachment.
 * It carries no material, import proof or independent readiness grant. */
export interface OwnedBrowserStateBindingV1 {
  readonly programSha256:string
  readonly browserProgramSha256:string
  readonly source:BrowserProgramSourceLocatorV1
  readonly dependencyGroup:'B'
}

export interface BrowserStateImportsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-state-imports-v1'
  readonly dependencyPolicySha256:string
  readonly dependency:{
    readonly group:'B'
    readonly upstreamRootSha256:string
    readonly upstreamRootBytes:number
    readonly namespaceContract:'empty-esm-namespace'
  }
  readonly sites:readonly {
    readonly originalOrdinal:number
    readonly rawDescriptorSha256:string
    readonly importSpan:AstSpanV1
    readonly argumentSpan:AstSpanV1
    readonly exactSpecifiers:readonly string[]
  }[]
}
