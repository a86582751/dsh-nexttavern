/** Attachment-local provenance resolved exclusively from owner packets already
 * delivered to its admitted realms. Historical reads outlive own-write ACKs. */
import type {AuthorNativeLibraryReadV1,AuthorNativeRealmLibraryReadV1,AuthorNativeResolvedLibraryReadV1}
  from './author-native-helper-types.js'
import type {CommunityAuthorPresetCatalogV1} from './community-preset-types.js'
import type {AuthorCharacterLibraryPacketV1,AuthorCharacterLibraryEntryV1}
  from './roleplay-author-character-library.js'
import type {AuthorWorldbookBindingSelectionV1} from './roleplay-author-worldbook-types.js'

export function createAuthorNativeLibraryReadsV1(realmIds:readonly string[]) {
  const realms=new Set(realmIds),presets=new Map<number,CommunityAuthorPresetCatalogV1>(),
    characters=new Map<string,AuthorCharacterLibraryPacketV1>(),resolved=new Map<string,AuthorNativeResolvedLibraryReadV1>(),
    bookNames=new WeakMap<AuthorCharacterLibraryPacketV1['catalog'],ReadonlyMap<string,string>>()

  // These immutable packets are the actual delivered owner objects. Keep their
  // references, including old versions still held by an author's closure.
  function deliverPreset(catalog:CommunityAuthorPresetCatalogV1):void {
    if(!presets.has(catalog.revision))presets.set(catalog.revision,catalog)
  }
  function deliverCharacter(packet:AuthorCharacterLibraryPacketV1):void {
    if(!characters.has(packet.epoch))characters.set(packet.epoch,packet)
  }
  function acknowledgedPrefix<T>(packets:ReadonlyMap<T,unknown>,versions:readonly T[],domain:'preset'|'character'):T[] {
    if(!versions.length)return []
    const confirmed=new Set(versions),obsolete:T[]=[]
    for(const version of confirmed)if(!packets.has(version))
      throw Error('AUTHOR_NATIVE_LIBRARY_'+domain.toUpperCase()+'_ACK_UNDELIVERED')
    // Packet delivery order owns this frontier. A semantic revision or opaque
    // epoch is not a substitute for the slowest live realm's actual ACK.
    for(const version of packets.keys()){
      if(confirmed.has(version))break
      obsolete.push(version)
    }
    return obsolete
  }
  function releaseDeliveredHistory(input:{readonly presetRevisions:readonly number[];
    readonly characterEpochs:readonly string[]}):void {
    const presetPrefix=acknowledgedPrefix(presets,input.presetRevisions,'preset'),
      characterPrefix=acknowledgedPrefix(characters,input.characterEpochs,'character')
    for(const revision of presetPrefix)presets.delete(revision)
    for(const epoch of characterPrefix)characters.delete(epoch)
  }
  function presetValue(read:Extract<AuthorNativeLibraryReadV1,{kind:'preset'}>):unknown {
    const catalog=presets.get(read.revision)
    if(!catalog)throw Error('AUTHOR_NATIVE_LIBRARY_PACKET_UNDELIVERED')
    if(read.operation==='names'||read.operation==='global-regex') {
      if(read.selector!=='')throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED')
      return read.operation==='names'?catalog.names:catalog.globalRegexes
    }
    if(read.operation==='loaded')return read.selector==='in_use'?catalog.loaded?.name??''
      :catalog.presets.find(preset=>preset.name===read.selector)?.name??null
    if(read.operation!=='value'&&read.operation!=='regex')throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED')
    const preset=read.selector==='in_use'?catalog.current.data
      :catalog.presets.find(preset=>preset.name===read.selector)?.data
    if(!preset)return null
    return read.operation==='value'?preset:preset.extensions.regex_scripts??Object.freeze([])
  }
  function bindingValue(packet:AuthorCharacterLibraryPacketV1,entry:AuthorCharacterLibraryEntryV1) {
    let names=bookNames.get(packet.catalog)
    if(!names) {
      names=new Map(packet.catalog.names.map(book=>[book.bookId,book.name]))
      bookNames.set(packet.catalog,names)
    }
    // The canonical library owner supplies this registration's character capture.
    const index=names,selection=entry.binding.selection as Extract<AuthorWorldbookBindingSelectionV1,{kind:'character'}>,
      additional=Object.freeze(selection.additional.flatMap(bookId=>{
        const name=index.get(bookId)
        return name===undefined?[]:[name]
      }))
    return Object.freeze({target:entry.descriptor,registration:entry.registration,binding:entry.binding,
      catalogHead:packet.catalog.head,names:Object.freeze({
        primary:selection.primary===null?null:index.get(selection.primary)??null,additional})})
  }
  function characterValue(read:Extract<AuthorNativeLibraryReadV1,{kind:'character'}>):unknown {
    const packet=characters.get(read.epoch)
    if(!packet)throw Error('AUTHOR_NATIVE_LIBRARY_PACKET_UNDELIVERED')
    if(read.operation!=='regex'&&read.operation!=='bindings')throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED')
    const selector=read.selector.toLowerCase(),entry=packet.entries.find(candidate=>
      candidate.descriptor.name.toLowerCase()===selector||candidate.descriptor.avatar?.toLowerCase()===selector)
    if(!entry)return null
    return read.operation==='regex'?Object.freeze({descriptor:entry.descriptor,
      registration:entry.registration,regex:entry.regex}):bindingValue(packet,entry)
  }
  function resolve(reads:readonly AuthorNativeRealmLibraryReadV1[]):readonly AuthorNativeResolvedLibraryReadV1[] {
    return Object.freeze(reads.map(input=>{
      if(!realms.has(input.realmId))throw Error('AUTHOR_NATIVE_LIBRARY_REALM_UNAVAILABLE')
      const read=input.read,key=JSON.stringify([input.realmId,read.kind,
        read.kind==='preset'?read.revision:read.epoch,read.selector,read.operation]),previous=resolved.get(key)
      if(previous)return previous
      let metadata:AuthorNativeLibraryReadV1,value:unknown
      if(read.kind==='preset') {
        value=presetValue(read)
        metadata=Object.freeze({kind:read.kind,revision:read.revision,selector:read.selector,operation:read.operation})
      }else if(read.kind==='character') {
        value=characterValue(read)
        metadata=Object.freeze({kind:read.kind,epoch:read.epoch,selector:read.selector,operation:read.operation})
      }else throw Error('AUTHOR_NATIVE_LIBRARY_READ_UNSUPPORTED')
      const result=Object.freeze({realmId:input.realmId,read:metadata,value})
      resolved.set(key,result)
      return result
    }))
  }
  return {deliverPreset,deliverCharacter,resolve,releaseDeliveredHistory}
}
