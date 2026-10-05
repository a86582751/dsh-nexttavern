/** Package roles, not a second source/build/delivery mapping. */
export const AUTHOR_PROMPT_RUNTIME_NAME='dsh-nexttavern-author-prompt-runtime-v1'
export const AUTHOR_PROMPT_RUNTIME_VERSION='0.1.0'
export const AUTHOR_PROMPT_RUNTIME_PINS=Object.freeze({typescript:'5.9.3' as const,
  'quickjs-emscripten-core':'0.32.0' as const,'@jitl/quickjs-wasmfile-release-sync':'0.32.0' as const})
export const AUTHOR_PROMPT_MODULES=Object.freeze({provider:'dist/index.mjs',worker:'dist/prompt-worker.mjs'})
export const AUTHOR_PROMPT_RUNTIME_DESCRIPTOR='assets/runtime.json'
export const AUTHOR_PROMPT_SOURCE_INPUTS='assets/source-inputs.json'
export type AuthorPromptRuntimeRoleV1=keyof typeof AUTHOR_PROMPT_MODULES
export interface AuthorPromptRuntimeDescriptorV1 {
  readonly schemaVersion:1
  readonly name:typeof AUTHOR_PROMPT_RUNTIME_NAME
  readonly version:typeof AUTHOR_PROMPT_RUNTIME_VERSION
  readonly modules:typeof AUTHOR_PROMPT_MODULES
  readonly dependencies:typeof AUTHOR_PROMPT_RUNTIME_PINS
  readonly profileSha256:string
}
