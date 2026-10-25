/** Shared compiler delivery pins; this module never loads the compiler. */
export const TYPESCRIPT_RUNTIME_NAME='dsh-nexttavern-typescript-runtime'
export const TYPESCRIPT_RUNTIME_VERSION='0.1.0'
export const TYPESCRIPT_VERSION='5.9.3'
export const TYPESCRIPT_ENTRY_SHA256='3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675'
export const TYPESCRIPT_SHARED_DEPENDENCY=Object.freeze({name:TYPESCRIPT_RUNTIME_NAME,
  version:TYPESCRIPT_RUNTIME_VERSION,typescriptVersion:TYPESCRIPT_VERSION,entrySha256:TYPESCRIPT_ENTRY_SHA256})
export interface SharedTypeScriptIdentity {
  readonly ownerName:typeof TYPESCRIPT_RUNTIME_NAME
  readonly ownerVersion:typeof TYPESCRIPT_RUNTIME_VERSION
  readonly generation:string
  readonly compilerFingerprint:string
}
