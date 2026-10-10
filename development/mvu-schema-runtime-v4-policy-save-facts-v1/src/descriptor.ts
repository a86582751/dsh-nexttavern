/** Delivery metadata is comparison data. Only the product inventory admits it. */
import {createHash} from 'node:crypto'

export const SCHEMA_RUNTIME_NAME='dsh-nexttavern-mvu-schema-runtime-v4-policy-save-facts-v1'
export const SCHEMA_RUNTIME_VERSION='0.4.0'
export const SCHEMA_RUNTIME_DESCRIPTOR='assets/runtime.json'
export const SCHEMA_RUNTIME_PINS=Object.freeze({typescript:'5.9.3','quickjs-emscripten-core':'0.32.0',
  '@jitl/quickjs-wasmfile-release-sync':'0.32.0','@jitl/quickjs-ffi-types':'0.32.0'})
export type SchemaRuntimeRole='provider'|'compiler'|'compiler-worker'|'runner'|'runner-worker'
export interface SchemaRuntimeFile {path:string;sha256:string}
export interface SchemaRuntimeGuest {
  kind:'zod'|'lodash';packageName:string;version:string;globalName:string;path:string;sha256:string;licensePath:string
}
export interface SchemaRuntimeDescriptor {
  schemaVersion:1
  name:typeof SCHEMA_RUNTIME_NAME
  version:typeof SCHEMA_RUNTIME_VERSION
  modules:Record<SchemaRuntimeRole,string>
  guests:readonly SchemaRuntimeGuest[]
  dependencies:Record<string,string>
}
export const schemaAssetSha=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex')
export const schemaAssetPath=(value:string)=>typeof value==='string'&&value.length>0&&!value.includes('\\')
  &&!value.includes(':')&&!value.startsWith('/')&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..')

/** Logical package-relative paths give copied installs the same identity. All
 * delivered implementation/guest/dependency bytes participate, including TS,
 * FFI and WASM; source-only development copies are not execution identities. */
export function schemaRuntimeImplementation(kind:'compiler'|'runner'|'bridge',files:readonly SchemaRuntimeFile[]):string {
  const executed=files.filter(file=>file.path!==SCHEMA_RUNTIME_DESCRIPTOR&&!file.path.startsWith('src/'))
    .map(file=>({path:file.path,sha256:file.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  return schemaAssetSha(JSON.stringify({encoding:'native-mvu-schema-delivery-identity-v4',kind,files:executed}))
}
