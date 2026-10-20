import {createHash} from 'node:crypto'
import type {CommunityJson} from './community-preset-types.js'

export interface CommunityMacroWrite {
  scope:'chat'|'global'
  key:string
  operation:'set'|'add'|'append'|'delete'
  value:CommunityJson
}
export interface CommunityMacroContext {
  seed:string
  clockEpochMs:number
  aliases:Record<string,string>
  chat:Record<string,CommunityJson>
  global:Record<string,CommunityJson>
  outlets?:Record<string,string>
}
const stringify=(value:CommunityJson|undefined):string=>value==null?'':typeof value==='string'?value:
  typeof value==='object'?JSON.stringify(value):String(value)
const numeric=(value:CommunityJson|undefined)=>Number(value??0)||0

/** A bounded syntax walk, not a JS evaluator. One evaluator is shared by the
 * ordered prompt list so assignments and random draws have one chronology. */
export function createCommunityMacroEvaluator(input:CommunityMacroContext) {
  const chat=structuredClone(input.chat),global=structuredClone(input.global),writes:CommunityMacroWrite[]=[]
  let ordinal=0
  const random=()=>{
    const hash=createHash('sha256').update(`${input.seed}:${ordinal++}`).digest()
    return hash.readUInt32LE(0)/0x1_0000_0000
  }
  function variable(scope:'chat'|'global',key:string):CommunityJson|undefined {
    return (scope==='chat'?chat:global)[key]
  }
  function write(scope:'chat'|'global',key:string,operation:CommunityMacroWrite['operation'],value:CommunityJson) {
    const values=scope==='chat'?chat:global
    if(operation==='delete')delete values[key]
    else if(operation==='add')values[key]=numeric(values[key])+numeric(value)
    else if(operation==='append')values[key]=stringify(values[key])+stringify(value)
    else values[key]=value
    writes.push({scope,key,operation,value})
  }
  function evaluate(body:string):string {
    const divider=body.indexOf('::'),name=(divider<0?body:body.slice(0,divider)).trim(),lower=name.toLowerCase()
    const argumentsText=divider<0?'':body.slice(divider+2)
    const next=argumentsText.indexOf('::'),key=(next<0?argumentsText:argumentsText.slice(0,next)).trim()
    const value=next<0?'':argumentsText.slice(next+2)
    if(name.startsWith('//'))return ''
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
      const values=source.includes('::')?source.split('::'):source.split(',')
      return values[Math.floor(random()*values.length)]?.trim()??''
    }
    if(lower.startsWith('roll')) {
      const formula=(lower==='roll'?argumentsText:name.slice(4)).trim().replace(/^:/,'')
      const dice=/^(?:(\d+)\s*)?d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i.exec(formula)
      if(!dice)throw Error(`不支持的骰子表达式：${formula}`)
      const count=Number(dice[1]||1),sides=Number(dice[2])
      if(!Number.isSafeInteger(count)||count<1||count>10_000||!Number.isSafeInteger(sides)||sides<1) {
        throw Error('骰子数量或面数无效')
      }
      let sum=0
      for(let index=0;index<count;index++)sum+=Math.floor(random()*sides)+1
      if(dice[3])sum+=(dice[3]==='-'?-1:1)*Number(dice[4])
      return String(sum)
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
    const date=new Date(input.clockEpochMs)
    if(lower==='time')return date.toISOString().slice(11,19)
    if(lower==='date'||lower==='isodate')return date.toISOString().slice(0,10)
    if(lower==='isotime')return date.toISOString()
    if(lower==='weekday')return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getUTCDay()]!
    const alias=Object.keys(input.aliases).find(key=>key.toLowerCase()===lower)
    if(alias!==undefined)return input.aliases[alias]!
    // Kemini uses these exact braces as output-format notation, not variables.
    if(['思考内容','正文内容','可能要求的附加内容'].includes(name))return `{{${name}}}`
    if(/^(?:MEMORY_|VECTOR_MEMORY)/i.test(name))throw Error(`此提示条目依赖尚未接入的外部记忆插件：${name}`)
    throw Error(`尚未支持的社区宏：${name}`)
  }
  function render(text:string,depth=0):string {
    if(depth>128)throw Error('社区宏嵌套过深')
    let result='',cursor=0,trimNext=false
    while(cursor<text.length) {
      let start=text.indexOf('{{',cursor)
      if(start<0){result+=trimNext?text.slice(cursor).replace(/^\s+/,''):text.slice(cursor);break}
      // An extra literal opening brace precedes a normal macro in the simple
      // preset's shipped initializer ("{{{setvar::...}}"). Keep that literal.
      while(text[start+2]==='{')start++
      const literal=text.slice(cursor,start)
      result+=trimNext?literal.replace(/^\s+/,''):literal
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
        if(body.trim().toLowerCase()==='trim'){result=result.trimEnd();trimNext=true}
        else result+=evaluate(body)
      }
      cursor=end
    }
    return result
  }
  return {render,chat,global,writes,get randomDraws(){return ordinal}}
}
