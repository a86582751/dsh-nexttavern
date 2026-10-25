/** Fixed researched snapshots, not a network fetch policy or future CDN claim. */
import {recordSha256} from './roleplay-data.js'
import type {StateLoaderGroupV1} from './tavern-mvu-author-execution-types-v4.mjs'

const roots = Object.freeze({
  A: Object.freeze({bytes: 573245,
    sha256: '3759d0c8b9f82c67a606afae11de9a90e3ee4e63298ef622b89ac9127eb77047'}),
  B: Object.freeze({bytes: 186045,
    sha256: '6e4756ba99968f9eab2c20810d27ca035b28f36791f7fa7dd701a57af37241e1'}),
  D: Object.freeze({bytes: 2598263,
    sha256: 'dcdbd5b0b837439d90fd0f783bedc1453fa6b8583d9d6a41f16f53a48e3b6dc3'}),
})
const entries = Object.freeze([
  ['A', 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@beta/artifact/bundle.js'],
  ['A', 'https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@master/artifact/bundle.js'],
  ['A', 'https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'],
  ['A', 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'],
  ['A', 'https://fastly.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'],
  ['B', 'https://cdn.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319/artifact/bundle.js'],
  ['B', 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319/artifact/bundle.js'],
  ['B', 'https://gcore.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate@b42817925d0391c15fa242a8238d2bbe28eb6319/artifact/bundle.js'],
  ['D', 'https://testingcf.jsdelivr.net/gh/NLKASHEI/MVU-offline@v1.0.1/mvu_bundle_full.js'],
] as const)
export const FIXED_STATE_LOADER_POLICY_V1 = Object.freeze({
  schemaVersion: 1 as const, id: 'p0-abd-owned-state-resolution' as const, version: 1 as const,
  roots, entries,
})
export const FIXED_STATE_LOADER_POLICY_SHA256 = recordSha256(FIXED_STATE_LOADER_POLICY_V1)
export function fixedStateLoaderDependency(specifier: string) {
  const entry = entries.find(([, exact]) => exact === specifier)
  if (!entry) return undefined
  const group: StateLoaderGroupV1 = entry[0]
  return Object.freeze({exactSpecifier: specifier, group,
    upstreamRootSha256: roots[group].sha256, upstreamRootBytes: roots[group].bytes,
    namespaceContract: group === 'D' ? 'side-effect-only' as const : 'empty-esm-namespace' as const})
}

