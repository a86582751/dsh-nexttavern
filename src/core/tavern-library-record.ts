export interface LibrarySource { [key: string]: unknown }
export interface LibraryRecord {
  schemaVersion: 1
  id: string
  name: string
  fullSha256: string
  objectName: string
  [key: string]: unknown
}

export const libraryRecordKey = (prefix: string, workspaceHash: string, id: string): string => `${prefix}${workspaceHash}__${id}`
export const libraryPendingKey = (prefix: string, workspaceHash: string, id: string): string => `${prefix}${workspaceHash}__${id}`
export const librarySourceKey = (source: LibrarySource): string => JSON.stringify(Object.fromEntries(Object.entries(source).sort(([left],
     [right]) => left.localeCompare(right,
     'en'))))

export function validatedLibraryObjectName(value: unknown,
     safeName: (value: unknown) => string,
     createObjectName: (hash: string,
     name: string) => string): string {
  const record = value as Partial<LibraryRecord> | null | undefined
  if (!record
      || typeof record.fullSha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(record.fullSha256)
      || typeof record.objectName !== 'string'
      || /[\\/]/.test(record.objectName)
      || record.objectName !== createObjectName(record.fullSha256,
       safeName(record.name))) throw new Error('资源记录损坏')
  return record.objectName
}
// This legacy export validates a persisted record; it does not construct a name.
export const libraryObjectName = validatedLibraryObjectName
