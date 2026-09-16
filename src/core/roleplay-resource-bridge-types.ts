import type { LibraryTable } from './tavern-library.js'
import type { ImportAssignment } from './roleplay-import-types.js'

export interface ResourceSession { id: string; header: { cwd: string } }
// One shared table holds both legacy import/export rows and library receipts.
export interface ResourceRecord extends Record<string, unknown> {
  importId?: string
  exportId?: string
  status?: string
  workspaceRoot?: string
  file?: string
  branchId?: string
  sessionId?: string
  title?: unknown
  resourceTitle?: unknown
  resultHash?: unknown
  rawSha256?: string
  rawSource?: string
  sourceFile?: string
  sourceEnvelope?: { extension: string; base64: string }
  assignments?: ImportAssignment[]
}
export interface ResourceBridgeDependencies {
  T: { branch: Omit<LibraryTable, 'entries'> & {
    entries(): Iterable<[string, ResourceRecord]>
    values?(): Iterable<ResourceRecord>
  } }
}
