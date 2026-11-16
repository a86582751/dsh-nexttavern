import {createTavernPromptMacroPrimitivesV1} from './tavern-prompt-text-kernel.mjs'
import {createHash} from 'node:crypto'
import type {CommunityJson} from './community-preset-types.js'
import type {TavernOrdinaryPreparationStage} from './roleplay-tavern-ordinary-stage.js'

export interface CommunityMacroWrite {
  scope:'chat'|'global'
  key:string
  operation:'set'|'add'|'append'|'delete'
  value:CommunityJson
}
export interface CommunityMacroContext {
  seed:string
  /** Stable chat identity for pick; attempt seed remains the random/roll owner. */
  pickSeed?:string
  clockEpochMs:number
  aliases:Record<string,string>
  chat:Record<string,CommunityJson>
  global:Record<string,CommunityJson>
  outlets?:Record<string,string>
  ordinary?:Pick<TavernOrdinaryPreparationStage,'values'|'read'|'apply'>
  shared?:Pick<TavernOrdinaryPreparationStage,'values'|'read'|'apply'>
  /** A material owner can resolve its additional captured readonly families
   * at this exact point in the existing left-to-right evaluation. */
  resolveUnknown?(body:string,rawText:string,offset:number,renderedPrefix:string):string|undefined
}
const stringify=(value:CommunityJson|undefined):string=>value==null?'':typeof value==='string'?value:
  typeof value==='object'?JSON.stringify(value):String(value)
const numeric=(value:CommunityJson|undefined)=>Number(value??0)||0

const macroPrimitives=createTavernPromptMacroPrimitivesV1(text=>createHash('sha256').update(text).digest())
export const communityMacroLiteral=macroPrimitives.literal
export const communityMacroChoices=macroPrimitives.choices
export const createCommunityMacroRandom=macroPrimitives.createRandom

/** Local wall-clock aliases from a captured instant, never an implicit Date.now. */
export function communityMacroClock(clockEpochMs:number):Record<string,string> {
  const date=new Date(clockEpochMs),pad=(value:number)=>String(value).padStart(2,'0')
  return {time:date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
    date:date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),
    weekday:date.toLocaleDateString('en-US',{weekday:'long'}),
    isotime:`${pad(date.getHours())}:${pad(date.getMinutes())}`,
    isodate:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
}

/** A bounded syntax walk, not a JS evaluator. One evaluator is shared by the
 * ordered prompt list so assignments and random draws have one chronology. */
export function createCommunityMacroEvaluator(input:CommunityMacroContext) {
  const chat=input.ordinary?{}:structuredClone(input.chat),global=input.shared?{}:structuredClone(input.global),writes:CommunityMacroWrite[]=[]
  const random=createCommunityMacroRandom(input.seed,input.pickSeed)
  function variable(scope:'chat'|'global',key:string):CommunityJson|undefined {
    const stage=scope==='chat'?input.ordinary:input.shared
    return stage?stage.read(key):(scope==='chat'?chat:global)[key]
  }
  function write(scope:'chat'|'global',key:string,operation:CommunityMacroWrite['operation'],value:CommunityJson) {
    const values=scope==='chat'?chat:global
    const stage=scope==='chat'?input.ordinary:input.shared
    if(stage)stage.apply([operation==='delete'
      ?{key,operation}:{key,operation,value}])
    else if(operation==='delete')delete values[key]
    else if(operation==='add')values[key]=numeric(values[key])+numeric(value)
    else if(operation==='append')values[key]=stringify(values[key])+stringify(value)
    else values[key]=value
    writes.push({scope,key,operation,value})
  }
  function evaluate(body:string,rawText:string,offset:number,renderedPrefix:string):string {
    const divider=body.indexOf('::'),name=(divider<0?body:body.slice(0,divider)).trim(),lower=name.toLowerCase()
    const argumentsText=divider<0?'':body.slice(divider+2)
    const next=argumentsText.indexOf('::'),key=(next<0?argumentsText:argumentsText.slice(0,next)).trim()
    const value=next<0?'':argumentsText.slice(next+2)
    if(name.startsWith('//'))return ''
    const literal=communityMacroLiteral(body)
    if(literal!==undefined)return literal
    if(['setvar','setglobalvar','addvar','addglobalvar','incvar','incglobalvar','decvar','decglobalvar','unsetvar','unsetglobalvar'].includes(lower)) {
      const scope=lower.includes('global')?'global':'chat'
      if(!key)throw Error(`社区宏 ${name} 缺少变量名`)
      const operation=lower.startsWith('unset')?'delete':lower.startsWith('set')?'set':
        lower.startsWith('add')&&(!value.trim()||!Number.isFinite(Number(value))
          ||!Number.isFinite(Number(variable(scope,key)??0)))?'append':'add'
      const assigned:CommunityJson=lower.startsWith('inc')?1:lower.startsWith('dec')?-1:
        operation==='add'?Number(value||0):value
      write(scope,key,operation,assigned)
      return lower.startsWith('inc')||lower.startsWith('dec')?stringify(variable(scope,key)):''
    }
    if(lower==='getvar'||lower==='getglobalvar')return stringify(variable(lower==='getvar'?'chat':'global',key))
    if(lower==='random'||lower==='pick'||lower.startsWith('random:')||lower.startsWith('pick:')) {
      const source=lower.startsWith('random:')?name.slice(7):lower.startsWith('pick:')?name.slice(5):argumentsText
      return random.choose(source,rawText,offset,lower.startsWith('pick'))
    }
    if(lower.startsWith('roll')) {
      return random.roll(lower==='roll'?argumentsText:body.slice(4))
    }
    if(lower==='trim')return ''
    if(lower==='newline')return '\n'
    if(lower==='space')return ' '
    if(lower==='reverse')return [...argumentsText].reverse().join('')
    if(lower==='outlet'||name==='压缩相邻消息') {
      if(Object.hasOwn(input.outlets??{},key))return input.outlets![key]!
      if(name==='压缩相邻消息')return ''
      throw Error(`未绑定提示词出口：${key}`)
    }
    if(['time','date','isodate','isotime','weekday'].includes(lower))return communityMacroClock(input.clockEpochMs)[lower]!
    const alias=Object.keys(input.aliases).find(key=>key.toLowerCase()===lower)
    if(alias!==undefined)return input.aliases[alias]!
    // Kemini uses these exact braces as output-format notation, not variables.
    if(['思考内容','正文内容','可能要求的附加内容'].includes(name))return `{{${name}}}`
    const resolved=input.resolveUnknown?.(body,rawText,offset,renderedPrefix)
    if(resolved!==undefined)return resolved
    if(/^(?:MEMORY_|VECTOR_MEMORY)/i.test(name))throw Error(`此提示条目依赖尚未接入的外部记忆插件：${name}`)
    throw Error(`尚未支持的社区宏：${name}`)
  }
  function render(text:string,depth=0):string {
    if(depth>128)throw Error('社区宏嵌套过深')
    let result='',cursor=0,trimNext=false,renderedPrefix=''
    while(cursor<text.length) {
      let start=text.indexOf('{{',cursor)
      if(start<0){result+=trimNext?text.slice(cursor).replace(/^(?:\r?\n)*/,''):text.slice(cursor);break}
      // An extra literal opening brace precedes a normal macro in the simple
      // preset's shipped initializer ("{{{setvar::...}}"). Keep that literal.
      while(text[start+2]==='{')start++
      const literal=text.slice(cursor,start)
      const renderedLiteral=trimNext?literal.replace(/^(?:\r?\n)*/,''):literal,
        lineStart=Math.max(renderedLiteral.lastIndexOf('\n'),renderedLiteral.lastIndexOf('\r'),
          renderedLiteral.lastIndexOf('\u2028'),renderedLiteral.lastIndexOf('\u2029'))+1
      result+=renderedLiteral
      renderedPrefix=lineStart?renderedLiteral.slice(lineStart):renderedPrefix+renderedLiteral
      trimNext=false
      let nesting=1,end=start+2
      while(end<text.length&&nesting) {
        if(text.startsWith('{{',end)){nesting++;end+=2}
        else if(text.startsWith('}}',end)){nesting--;end+=2}
        else end++
      }
      if(nesting)throw Error('社区宏缺少结束括号')
      const rawBody=text.slice(start+2,end-2)
      // Comments are removed before descending: they never perform assignments.
      if(!rawBody.trimStart().startsWith('//')) {
        const body=render(rawBody,depth+1)
        if(body.trim().toLowerCase()==='trim'){
          result=result.replace(/(?:\r?\n)*$/,'');renderedPrefix=renderedPrefix.replace(/(?:\r?\n)*$/,'');trimNext=true
        }else {
          const replacement=evaluate(body,text,start,renderedPrefix)
          result+=replacement;renderedPrefix+=replacement
        }
      }
      cursor=end
    }
    return result
  }
  return {render,get chat(){return input.ordinary?.values??chat},get global(){return input.shared?.values??global},
    writes,get randomDraws(){return random.draws}}
}
