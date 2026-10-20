import type {SettingsRoutesDependencies} from './roleplay-settings-routes-types.js'
import type {CommunityPresets} from './community-presets.js'
import {jsonResponse} from './roleplay-state.js'
import {applyCommunityRegex,communityRegexEntry,communityRegexMacros} from './community-regex.js'
import {createCommunityPresetDisplay} from './community-preset-display.js'
import type {CommunityDisplayInput} from './community-preset-display.js'

export function registerCommunityPresetRoutes(deps:Pick<SettingsRoutesDependencies,'ctx'|'resolveRoleplaySession'>
  &{communityPresets:CommunityPresets;displayInput?(sessionId:string):Promise<CommunityDisplayInput>;
    cardMappingInput?(sessionId:string):Promise<unknown>;
    configureVariables?(sessionId:string,presetId:string):Promise<void>}) {
  const {ctx,resolveRoleplaySession,communityPresets}=deps,display=createCommunityPresetDisplay()
  for(const kind of ['community-presets','regexes'] as const)ctx.effect(()=>ctx.connection.fetch.register({
    requestBody:'buffered',path:`/api/roleplay/${kind}`,methods:['GET','POST'],fetch:async request=>{
      try {
        const url=new URL(request.url),body=request.method==='POST'?await request.json() as Record<string,unknown>:null
        const id=String(body?.sessionId??url.searchParams.get('sessionId')??'')
        const session=await resolveRoleplaySession(id)
        if(!session)return jsonResponse(404,{ok:false,error:'角色扮演对话不存在'})
        await ctx.get('tavernConversations')?.ready
        if(!body) {
          const presetId=url.searchParams.get('presetId'),action=url.searchParams.get('action')
          if(kind==='community-presets'&&action==='card-mapping')return jsonResponse(200,{ok:true,
            ...await deps.cardMappingInput?.(session.id) as Record<string,unknown>})
          if(presetId&&action==='export')return jsonResponse(200,{ok:true,data:communityPresets.exportPreset(presetId)})
          if(presetId&&action==='export-plans')return jsonResponse(200,{ok:true,pack:communityPresets.read().planPacks[presetId]??null})
          if(presetId) {
            const preset=communityPresets.read().presets.find(p=>p.id===presetId)
            return preset?jsonResponse(200,{ok:true,preset}):jsonResponse(404,{ok:false,error:'社区预设不存在'})
          }
          return jsonResponse(200,{ok:true,...communityPresets.policy(session.id)})
        }
        if(kind==='regexes'&&body.action==='preview') {
          const policy=communityPresets.policy(session.id),text=String(body.text??''),channel=body.channel==='prompt'?'prompt':'display'
          const placement=Number(body.placement??2) as 0|1|2|3|4|5|6,depth=body.depth===null?null:Number(body.depth??0)
          const output=await applyCommunityRegex(policy,[communityRegexEntry('preview',text,policy.fingerprint,{channel,placement,depth,isEdit:body.isEdit===true})],
            communityRegexMacros({user:'用户',char:'角色',input:text},{},{},policy.fingerprint),[],request.signal)
          return jsonResponse(200,{ok:true,result:{text:output[0]??text,[`${channel}Text`]:output[0]??text}})
        }
        if(kind==='regexes'&&body.action==='display') {
          if(!deps.displayInput)throw Error('社区显示通道尚未接入')
          const input=await deps.displayInput(session.id),refs=body.messages as {seq:number;messageId:string}[]
          return jsonResponse(200,{ok:true,...await display.render(communityPresets.policy(session.id),input,refs,request.signal)})
        }
        if(body.action==='preview-plans')return jsonResponse(200,{ok:true,preview:communityPresets.previewPlans(session.id,
          String(body.presetId),body.planIds as string[],body.scope==='global'?'global':'conversation')})
        const policy=kind==='regexes'?await communityPresets.mutateRegex(session.id,body):await communityPresets.mutate(session.id,body)
        if(body.action==='control')await deps.configureVariables?.(session.id,String(body.presetId))
        return jsonResponse(200,{ok:true,...policy})
      }catch(error) {
        const message=error instanceof Error?error.message:String(error)
        return jsonResponse(message.includes('已更新')?409:400,{ok:false,error:message})
      }
    }}),`roleplay: ${kind} management`)
}
