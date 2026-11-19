/** Uploaded worldbook DATA enters the existing catalog journal once. */
import {sha256} from './roleplay-data.js'
import {standaloneTavernWorldInfoFieldsToNativeV1} from './tavern-lore-compiler.mjs'
import {applyStandaloneWorldInfoControlsV1} from './tavern-named-worldbook-data.js'
import type {NativeNamedWorldbookEntryDataV1} from './tavern-named-worldbook-data.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorWorldbookImportFileInputV1} from './roleplay-author-worldbook-types.js'

const object=(value:unknown):value is MvuJsonObject=>value!==null&&typeof value==='object'&&!Array.isArray(value)
export function parseAuthorWorldbookFileV1(input:AuthorWorldbookImportFileInputV1) {
  if(typeof input.fileName!=='string'||!input.fileName.length)throw Error('AUTHOR_WORLDBOOK_FILE_NAME_REQUIRED')
  if(typeof input.json!=='string')throw Error('AUTHOR_WORLDBOOK_FILE_JSON_REQUIRED')
  let parsed:unknown
  try{parsed=JSON.parse(input.json)}catch(cause){throw Error('AUTHOR_WORLDBOOK_FILE_JSON_INVALID',{cause})}
  if(!object(parsed)||!object(parsed.entries)&&!Array.isArray(parsed.entries))throw Error('AUTHOR_WORLDBOOK_FILE_ENTRIES_REQUIRED')
  const {entries:collection,...bookData}=parsed,entries=collection as MvuJsonObject|MvuJsonObject[]
  const members=Object.entries(entries).map(([key,value],ordinal)=>{
    if(!object(value))throw Error('AUTHOR_WORLDBOOK_FILE_ENTRY_INVALID')
    const rawEntry=applyStandaloneWorldInfoControlsV1(value,
      standaloneTavernWorldInfoFieldsToNativeV1(value,ordinal) as NativeNamedWorldbookEntryDataV1)
    const identity=value.uid??value.id??(Array.isArray(entries)?ordinal:key)
    const desired=typeof identity==='number'?identity:typeof identity==='string'&&identity.trim()?Number(identity):undefined
    return {desiredUid:Number.isSafeInteger(desired)?desired:undefined,rawEntry,
      displayIndex:object(rawEntry.extensions)&&typeof rawEntry.extensions.display_index==='number'
        ?rawEntry.extensions.display_index:ordinal}
  })
  return {name:input.name??(typeof parsed.name==='string'&&parsed.name?parsed.name:input.fileName.replace(/\.json$/i,'')),
    rawSha256:sha256(input.json),bookData,members}
}
