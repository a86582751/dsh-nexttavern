/** Actual Native rules settings, independent of imported Tavern descriptors. */
export interface ReaderNativeBeautySourceV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-native-beauty-source-v1'
  readonly sessionId:string
  readonly rulesRecordSha256:string
  readonly javascript:string
}
export interface ReaderNativeBeautyExecutionV1 {
  readonly source:ReaderNativeBeautySourceV1
  readonly parentOrigin:string
}
export interface ReaderNativeBeautyLayoutV1 {
  readonly revision:number
  readonly height:number
  readonly rows:Readonly<Record<string,{top:number;left:number;width:number}>>
  readonly documents:Readonly<Record<string,{top:number;left:number;width:number}>>
}
