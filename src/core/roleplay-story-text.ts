/** Consumption text is separate from Native message/proof identity. The schema
 * owner supplies accepted bodies; this adapter owns their one text-block mapping
 * for Reader, prompt material and memory consumers. */
import {recordSha256,textOf} from './roleplay-data.js'

export interface SettledStoryMessageText {
  readonly target:{readonly seq:number;readonly messageId:string;readonly versionSha256:string}
  readonly message_content:string
  readonly eventSha256:string
}
export interface SettledStoryMessageCapture {
  readonly hasValues:boolean
  read(target:SettledStoryMessageText['target']):SettledStoryMessageText|undefined
  current():boolean
}
interface TextMessage {
  readonly id:string
  readonly role?:string
  readonly content:readonly {readonly type:string;readonly text?:string}[]
}
export interface RoleplayStoryTextCapture {
  readonly hasValues:boolean
  text(seq:number,message:TextMessage,originalText?:string,originalVersionSha256?:string):string
  blocks(seq:number,message:TextMessage,originalVersionSha256?:string):ReadonlyMap<number,string>|undefined
  current():boolean
}
export type CaptureRoleplayStoryText=(sessionId:string,options?:{nativeCut:number})=>RoleplayStoryTextCapture|undefined

export function createRoleplayStoryTextReader(capture:(sessionId:string,options?:{nativeCut:number})=>
  SettledStoryMessageCapture|undefined,messageVersion:(message:TextMessage)=>string=recordSha256):CaptureRoleplayStoryText {
  return (sessionId,options)=>{
    const accepted=capture(sessionId,options)
    // An empty accepted index can still guard a completed numerical Story
    // whose settlement is pending or unknown. Keep that owner's capture so
    // consumers cannot reuse raw-body material across its completion.
    if(!accepted)return undefined
    const read=(seq:number,message:TextMessage,versionSha256?:string)=>{
      if(message.role!==undefined&&message.role!=='assistant')return undefined
      versionSha256??=messageVersion(message)
      return accepted.read({seq,messageId:message.id,versionSha256})
    }
    return {
      hasValues:accepted.hasValues,
      text:(seq,message,originalText=textOf(message.content),versionSha256)=>
        read(seq,message,versionSha256)?.message_content??originalText,
      blocks:(seq,message,versionSha256)=>{
        const body=read(seq,message,versionSha256)
        if(!body)return undefined
        let first=true
        return new Map(message.content.flatMap((block,index)=>{
          if(block.type!=='text')return []
          const text=first?body.message_content:'';first=false
          return [[index,text] as const]
        }))
      },current:()=>accepted.current(),
    }
  }
}
