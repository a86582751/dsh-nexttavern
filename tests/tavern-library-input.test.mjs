import assert from 'node:assert/strict'
import { safeLibraryName, safeLibraryType, librarySource, libraryObjectName, libraryContentDisposition, libraryStableId } from '../lib/core/tavern-library-input.js'
assert.equal(safeLibraryName('  e\u0301  '), 'é')
for (const value of ['', '.', '..', 'a/b', 'a'.repeat(161)]) assert.throws(() => safeLibraryName(value))
assert.equal(safeLibraryType('TEXT/PLAIN; CHARSET=UTF-8'), 'text/plain; charset=utf-8')
assert.throws(() => safeLibraryType('text/plain; charset=latin1'))
assert.deepEqual(librarySource({sessionId:'s', importId:'i'}), {sessionId:'s', importId:'i'})
for (const value of [null, [], {}, {sessionId:7}, {'bad-key':'x'}]) assert.throws(() => librarySource(value))
assert.equal(libraryObjectName('a'.repeat(64), 'a.md'), `${'a'.repeat(64)}--a.md`)
assert.equal(libraryContentDisposition('é"\\.md'), 'attachment; filename="e___.md"; filename*=UTF-8\'\'%C3%A9%22%5C.md')
assert.equal(libraryStableId('workspace', 'hash'), '91cfd62b8a2ef107004f368547bc909554844daee8ce67fc7138e92f27c91d45')
console.log('tavern-library-input=ok (normalization, MIME, provenance and disposition boundaries)')
