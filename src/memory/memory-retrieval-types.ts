export type RetrievalMode = 'keyword' | 'semantic' | 'hybrid'
export interface WorldbookVectorSettingsV1 {
  enabled:boolean; enabledForAll:boolean; topK:number; threshold:number; queryMessages:number
}
export interface WorldbookVectorSourceV1 {
  id:string; bookId:string; bookVersion:string; contentSha256:string; text:string
}
export interface WorldbookVectorResultV1 {
  schemaVersion:1; status:'disabled'|'ready'|'pending'|'unavailable'; settings:WorldbookVectorSettingsV1
  settingsRevision:number; providerId:string|null; fingerprint:string|null; querySha256:string
  hits:readonly {id:string;contentSha256:string;score:number}[]
  progress?:Record<string,unknown>; reason?:string
}
export interface EmbeddingProvider {
  id: string; name: string; kind: 'online' | 'local'; protocol: 'openai' | 'dashscope-text' | 'dashscope-multimodal'
  baseUrl: string; model: string; dimensions: number | null; ready: boolean; revision: string; error?: string
  apiKey?: string; keySet?: boolean; requestedDimensions?: number | null; embeddingRevision?:string
  /** Runtime projection of the global index setting; never provider-specific persistence. */
  chunkChars?:number
  /** Total local encoder input including task prefix and special tokens. */
  localMaxTokens?:number
  inputProfile?:'worldbook-entry-v1'
}
export interface VectorSource {
  id: string; sessionId: string; seq: number; role: string; text: string; hash: string
}
export interface EmbeddingCall {
  schemaVersion: 1; id: string; ownerSessionId: string | null; workspaceId: string; provider: string; model: string
  purpose: 'index' | 'query' | 'test'; startedAt: number; completedAt: number; status: 'completed' | 'failed' | 'unknown'
  inputTokens: number | null; totalTokens: number | null; providerUsage: Record<string, number>; requestId?: string
}
export interface LocalModel {
  maxInputTokens:number
  license?: string
  id: string; name: string; repo: string; revision: string; dimensions: number; pooling: string; queryPrefix: string
  documentPrefix?: string; dtype?: 'q8' | 'fp32'; runtime?: 'transformers' | 'onnx'; onnxFile?: string; x64QuantPrecision?: boolean
  estimatedMiB: number; languages: string; description: string; files: {name: string; sha256: string; bytes: number}[]
}
export interface WorkerRequest {
  action: string; workspace?: string; provider?: EmbeddingProvider; sources?: VectorSource[]; query?: string
  sessionId?: string; modelId?: string; enabled?: boolean; limit?: number; generation?: string
  guardOwner?: string
  expectedFingerprint?: string
  legacyWorkspace?: string
  /** Server-authorized immutable original library; never used for plot memory. */
  sharedOriginal?: boolean
  currentSpaceOnly?: boolean
  worldbookSources?:readonly WorldbookVectorSourceV1[]
  callId?:string
  threshold?:number
}
