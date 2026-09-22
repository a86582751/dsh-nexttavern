export interface CheckTask {
  id: string
  action: 'test' | 'types' | 'generated' | 'syntax' | 'docs' | 'inventory' | 'bundle'
    | 'candidate' | 'archive' | 'install' | 'installer' | 'harness'
  artifact?: string
  args?: string[]
  modules: string[]
  inputs?: string[]
  requires?: string[]
  depends?: string[]
  gate?: boolean
  heavy?: boolean
  cache?: boolean
  timeoutMs?: number
  effects?: {build?: boolean; network?: boolean; service?: boolean}
  unavailable?: string
}
export interface CheckModule {id: string; aliases: string[]; patterns: string[]}
export interface CheckRegistry {schemaVersion: 1; modules: CheckModule[]; tasks: CheckTask[]}
export interface Artifact {id: string; source: string; public?: {path?: string}}
export interface BuildMapping {
  id: string; kind?: string; artifact: string; entry: string; builder: string; inputs: string[]
  browser?: {moduleId: string; external: string[]; inlineArtifactImports?: Record<string, string>}
}
export interface SourceMapping {
  artifacts: Artifact[]
  builds: BuildMapping[]
  typeScript?: {config: string; checker: string; declarationPackages: string[]}
}
export interface CheckContext {
  root: string
  audience: 'maintenance' | 'public'
  registry: CheckRegistry
  mapping: SourceMapping
  artifactPaths: Map<string, string>
  stateDirectory: string
}
export interface CheckRequest {
  command: string
  targets: string[]
  plan: boolean
  force: boolean
  base?: string
  bundle?: string
  output?: string
  inputs?: string
  upgradeFrom?: string
  upgradeSha256?: string
  run?: string
  portable: boolean
}
export interface CheckPlan {
  request: CheckRequest
  files: string[]
  syntaxFiles?: string[]
  tasks: CheckTask[]
  reasons: Record<string, string[]>
  uncovered: string[]
  notice: string[]
}
export type TaskStatus = 'passed' | 'reused' | 'failed' | 'blocked' | 'unsupported' | 'running' | 'interrupted' | 'timed-out'
export interface TaskResult {id: string; status: TaskStatus; reason?: string; ms: number; fingerprint?: string}
export interface CheckRun {
  schemaVersion: 1
  root: string
  id: string
  request: CheckRequest
  files: string[]
  status: 'running' | 'passed' | 'failed' | 'interrupted' | 'uncovered'
  results: TaskResult[]
  successes: Record<string, {fingerprint: string; ms: number}>
}
