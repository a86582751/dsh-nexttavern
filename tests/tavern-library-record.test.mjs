import assert from 'node:assert/strict'
import { libraryRecordKey, libraryPendingKey, librarySourceKey, libraryObjectName } from '../lib/core/tavern-library-record.js'
import { safeLibraryName, libraryObjectName as objectFileName } from '../lib/core/tavern-library-input.js'

assert.equal(libraryRecordKey('record__', 'workspace', 'id'), 'record__workspace__id')
assert.equal(libraryPendingKey('pending__', 'workspace', 'id'), 'pending__workspace__id')
assert.equal(librarySourceKey({ z: 1, a: 2 }), '{"a":2,"z":1}')
const record = { schemaVersion: 1, id: 'id', name: '港口.md', fullSha256: 'a'.repeat(64), objectName: 'a'.repeat(64) + '--港口.md' }
const validate = value => libraryObjectName(value, safeLibraryName, objectFileName)
assert.equal(validate(record), record.objectName)
for (const value of [null, undefined, {}, { ...record, fullSha256: 123 }, { ...record, fullSha256: 'A'.repeat(64) }, { ...record, objectName: '../escape' }, { ...record, objectName: '..\\escape' }, { ...record, objectName: 'a'.repeat(64) + '--other.md' }]) {
  assert.throws(() => validate(value), /资源记录损坏/)
}
console.log('tavern-library-record=ok (keys, provenance ordering and object validation)')
