/** Source's existing resource reader owns selection and pins. This projection
 * carries its immutable DATA into compilation without granting an attachment. */
import type {AuthorScriptResourceReaderV1,AuthorScriptResourceDescriptorV1,
  AuthorScriptResourceOperationV1} from './roleplay-author-script-resources.js'
import type {BrowserScriptResourceProjectionV3} from './tavern-author-browser-types-v3.mjs'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'

export function projectAuthorScriptResourcesV3(reader:AuthorScriptResourceReaderV1,
  descriptors:readonly AuthorScriptResourceDescriptorV1[]):BrowserScriptResourceProjectionV3 {
  const read=(pin:AuthorScriptResourceDescriptorV1,operation:AuthorScriptResourceOperationV1)=>reader.read({
    schemaVersion:1,encoding:'native-author-script-resource-request-v1',scriptIdentity:pin.identity,
    descriptorSha256:pin.rawDescriptorSha256,sourceSnapshotSha256:reader.sourceSnapshotSha256,operation})
  const characterTrees=descriptors.length?read(descriptors[0]!,{kind:'script-trees',scope:'character'}):[]
  const originalDescriptor=(pin:AuthorScriptResourceDescriptorV1)=>{
    // The checked Source pointer already selects this descriptor. Index only
    // its suffix within the same original tree, without interpreting its ID.
    const segments=pin.pointer.split('/'),start=segments.indexOf('tavern_helper')+2
    let value:MvuJsonValue=characterTrees
    for(const encoded of segments.slice(start)){
      const key=encoded.replace(/~1/g,'/').replace(/~0/g,'~')
      value=Array.isArray(value)?value[Number(key)]!:(value as {[key:string]:MvuJsonValue})[key]!
    }
    return value as {[key:string]:MvuJsonValue}
  }
  const callers=descriptors.map(pin=>({originalOrdinal:pin.originalOrdinal,identity:pin.identity,
    authorId:read(pin,{kind:'script-id'}) as string,hasOriginalId:typeof originalDescriptor(pin).id==='string',
    data:read(pin,{kind:'self-script-data'})}))
  return {schemaVersion:3,encoding:'native-author-script-resource-projection-v3',
    sourceSnapshotSha256:reader.sourceSnapshotSha256,callers,
    characterTrees}
}
