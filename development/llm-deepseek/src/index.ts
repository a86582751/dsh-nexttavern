/** DeepSeek Messages transport, request configuration, and model capabilities. */
export { deepSeekConfigFields, Config, plainOptions, resolveAdapterOptions, PUBLIC_BASE_URL } from '@deepseek-ai/dsh-llm-deepseek'
export type { Options, ResolvedDeepSeekOptions } from '@deepseek-ai/dsh-llm-deepseek'
export {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_FILE_EXPIRY_SECONDS,
  DEFAULT_FILE_QUOTA_CLEANUP_BATCH,
  DEFAULT_FILE_REFRESH_MARGIN_SECONDS,
  DEFAULT_FILES_API_TIMEOUT_MS,
  DEFAULT_IMAGE_OFFLOAD_BYTE_QUANTUM,
  DEFAULT_IMAGE_OFFLOAD_COUNT_QUANTUM,
  DEFAULT_INLINE_IMAGE_OFFLOAD_BYTE_QUANTUM,
  DEFAULT_MAX_INLINE_REQUEST_IMAGE_BYTES,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
} from '@deepseek-ai/dsh-llm-deepseek'
export { DeepSeekAdapter } from './adapter.js'
export type { DeepSeekRequestAuth, DeepSeekAdapterOptions, DeepSeekCatalogModel, DeepSeekConnectionOptions } from './types.js'
export {
  DEFAULT_LOW_DETAIL_IMAGE_PIXEL_BUDGET,
  DEFAULT_MAX_IMAGES_PER_REQUEST,
  DEFAULT_MAX_REQUEST_FILES_BYTES,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  REQUEST_IMAGE_MAX_DIMENSION,
  deepSeekImageRequestPricing,
  resolveRequestImageMaxBytes,
  resolveRequestImageTarget,
} from '@deepseek-ai/dsh-llm-deepseek'
export { deepSeekImageTokens, deepSeekRequestImageDimensions } from '@deepseek-ai/dsh-llm-deepseek'
export { DeepSeekFileStore, MAX_IMAGE_BYTES } from '@deepseek-ai/dsh-llm-deepseek'
export type { DeepSeekFileConnection, DeepSeekFilePolicy, DeepSeekFileReference } from '@deepseek-ai/dsh-llm-deepseek'
export { DeepSeekFilesClient, MAX_FILE_EXPIRY_SECONDS, MAX_FILE_UPLOAD_BYTES, MAX_STORED_FILE_BYTES, MAX_STORED_FILE_COUNT, MIN_FILE_EXPIRY_SECONDS } from '@deepseek-ai/dsh-llm-deepseek'
export type { DeepSeekFileObject, DeepSeekFilePage } from '@deepseek-ai/dsh-llm-deepseek'
export { DeepSeekFileId } from '@deepseek-ai/dsh-llm-deepseek'
export type { DeepSeekFileId as DeepSeekFileIdType } from '@deepseek-ai/dsh-llm-deepseek'
export { DeepSeekUploadIndex, deepSeekFileScope } from '@deepseek-ai/dsh-llm-deepseek'
export type { DeepSeekUploadRecord } from '@deepseek-ai/dsh-llm-deepseek'
export type { RequestDefaults } from './types.js'

export { catalogModelInfo } from '@deepseek-ai/dsh-llm-deepseek'
export { registerDeepSeekProvider } from './host.js'
