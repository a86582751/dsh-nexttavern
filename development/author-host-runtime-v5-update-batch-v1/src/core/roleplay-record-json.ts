// Persisted record hashes use UTF-16 key order, omit undefined object fields and
// encode undefined array values as null. Do not replace this with export JSON's
// locale-aware ordering: that would invalidate existing record CAS hashes.
export function appendStableJson(item: unknown, write: (fragment: string) => void, objectField = false): void {
  if (item === undefined) {
    write('null')
    return
  }
  if (item === null || typeof item !== 'object') {
    const scalar = JSON.stringify(item)
    write(scalar === undefined ? (objectField ? 'undefined' : '') : scalar)
    return
  }
  if (Array.isArray(item)) {
    write('[')
    const length = item.length
    for (let index = 0; index < length; index++) {
      if (index) write(',')
      // map/join leaves holes empty, but explicit undefined becomes null.
      if (index in item) appendStableJson(item[index], write)
    }
    write(']')
    return
  }
  const record = item as Record<string, unknown>
  const keys = Object.keys(record).filter(key => record[key] !== undefined).sort()
  write('{')
  for (let index = 0; index < keys.length; index++) {
    if (index) write(',')
    const key = keys[index]!
    write(JSON.stringify(key))
    write(':')
    appendStableJson(record[key], write, true)
  }
  write('}')
}

export function stableJson(value: unknown): string | undefined {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const chunks: string[] = []
  // Join once so nested records do not copy their descendants at every level.
  appendStableJson(value, fragment => { chunks.push(fragment) })
  return chunks.join('')
}
