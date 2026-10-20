import type { LibraryTable } from './tavern-library.js'
import type { ImportAssignment,ImportSourceEnvelope } from './roleplay-import-types.js'

export interface ResourceSession { id: string; header: { cwd: string } }
/** Frozen local upload identity, including DOCX/Markdown before text extraction.
 * The archive owns the original filename/MIME. Uploaded JSON never supplies IDs. */
export interface NativeCardOriginalSourceV1 {
  schemaVersion: 1
  encoding: 'nexttavern-original-card-source-v1'
  resourceId: string
  sha256: string
  bytes: number
}
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
  sourceEnvelope?: ImportSourceEnvelope
  originalCardSource?: NativeCardOriginalSourceV1
  assignments?: ImportAssignment[]
}
export interface ResourceBridgeDependencies {
  T: { branch: Omit<LibraryTable, 'entries'> & {
    entries(): Iterable<[string, ResourceRecord]>
    values?(): Iterable<ResourceRecord>
  } }
}
