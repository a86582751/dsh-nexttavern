/** Finite Native player-command grammar, not a general STscript evaluator.
 * Local pinned references: TH 519599bc src/function/slash.ts; ST 06bde939
 * public/scripts/slash-commands.js send:1732/5023, trigger:1806/4987.
 * /send retains raw quotes and trims its outer text. Double quotes group a
 * pipeline delimiter here; strict delimiter escapes are deterministic rather
 * than dependent on the host's configurable ST parser flags. */
import type {AuthorNativeCommandResultV1,AuthorNativeCommandStepV1} from './roleplay-author-commands.js'
export type AuthorNativeCommand=
  |{readonly index:number;readonly kind:'getvar'|'setvar';readonly scope:'chat'|'global';readonly key:string;
    readonly text?:string;readonly variableIndex?:string;readonly as?:string}
  |{readonly index:number;readonly kind:'input';readonly text?:string;readonly defaultValue:string}
  |{readonly index:number;readonly kind:'echo';readonly text?:string}
  |{readonly index:number;readonly kind:'send';readonly text:string}
  |{readonly index:number;readonly kind:'trigger';readonly awaitCompletion:boolean}
  |{readonly index:number;readonly kind:'ruby-read';readonly key:string;readonly json:boolean;
    readonly all:boolean;readonly book:string;readonly raw:boolean}
  |{readonly index:number;readonly kind:'ruby-run';readonly selection:'tasks'|'startup'|'all';
    readonly taskSpecs:readonly string[];readonly json:boolean}
  |{readonly index:number;readonly kind:'ruby-preset';readonly selector:string}
  |{readonly index:number;readonly kind:'ruby-status'|'ruby-panel'|'ruby-reload'}
export type AuthorNativeRubyCommand=Extract<AuthorNativeCommand,
  {readonly kind:'ruby-read'|'ruby-run'|'ruby-preset'|'ruby-status'|'ruby-panel'|'ruby-reload'}>
export interface AuthorNativeCommandPipeline {readonly commands:readonly AuthorNativeCommand[]}
export function createAuthorNativeCommandLanguageV1() {
  class AuthorNativeCommandParseError extends Error {
    readonly code:'AUTHOR_NATIVE_COMMAND_SYNTAX'|'AUTHOR_NATIVE_COMMAND_UNSUPPORTED'
    readonly commandIndex:number
    readonly offset:number
    constructor(code:AuthorNativeCommandParseError['code'],commandIndex:number,offset:number,detail:string) {
      super(`${code}: command ${commandIndex+1}, offset ${offset}: ${detail}`)
      this.name='AuthorNativeCommandParseError';this.code=code;this.commandIndex=commandIndex;this.offset=offset
    }
  }
  const escapable=(char:string|undefined)=>char==='|'||char==='\\'||char==='"'
  function decodeText(text:string):string {
    let result=''
    for(let index=0;index<text.length;index++) {
      if(text[index]==='\\'&&escapable(text[index+1]))index++
      result+=text[index]
    }
    return result
  }

  /** Produces an AST only after every command is parsed. Execution, pipe-value
   * substitution and deterministic operation IDs belong to the Core dispatcher. */
  function parseAuthorNativeCommands(source:string):AuthorNativeCommandPipeline {
    const commands:AuthorNativeCommand[]=[]
    const fail=(unsupported:boolean,offset:number,detail:string):never=>{
      throw new AuthorNativeCommandParseError(unsupported?'AUTHOR_NATIVE_COMMAND_UNSUPPORTED':'AUTHOR_NATIVE_COMMAND_SYNTAX',
        commands.length,offset,detail)
    }
    function ruby(body:string,index:number,offset:number):AuthorNativeRubyCommand {
      // Quotes group argument text but do not survive into Ruby DATA. /send
      // deliberately keeps its older raw-quote contract in the separate branch.
      const tokens:string[]=[]
      let token='',inQuote=false,started=false
      for(let cursor=0;cursor<body.length;cursor++) {
        const char=body[cursor]!
        if(char==='\\'&&escapable(body[cursor+1])){token+=body[++cursor];started=true}
        else if(char==='"'){inQuote=!inQuote;started=true}
        else if(/\s/.test(char)&&!inQuote) {
          if(started){tokens.push(token);token='';started=false}
        }else {token+=char;started=true}
      }
      if(started)tokens.push(token)
      const action=tokens.shift()?.toLowerCase()||'panel',options=new Map<string,string>(),positional:string[]=[]
      if(['status','panel','open','reload','reinit'].includes(action)) {
        if(tokens.length)return fail(true,offset,'ruby '+action+' does not accept options')
        return {index,kind:action==='status'?'ruby-status':action==='panel'||action==='open'?'ruby-panel':'ruby-reload'}
      }
      if(action==='preset')return {index,kind:'ruby-preset',selector:tokens.join(' ').trim()}
      if(action!=='read'&&action!=='run')return fail(true,offset,'unsupported ruby action')
      const allowed=action==='read'?['key','json','all','book','raw']:['task','tasks','json','startup','all']
      for(const value of tokens) {
        const named=/^(\w+)=([\s\S]*)$/.exec(value)
        if(!named){positional.push(value);continue}
        const name=named[1]!
        if(!allowed.includes(name)||options.has(name))return fail(true,offset,'unsupported or repeated ruby option: '+name)
        options.set(name,named[2]!)
      }
      const flag=(name:string)=>{
        if(!options.has(name))return false
        const value=options.get(name)!.toLowerCase()
        if(value!=='true'&&value!=='false')return fail(true,offset,name+' requires true or false')
        return value==='true'
      }
      const json=flag('json')
      if(action==='read')return {index,kind:'ruby-read',key:(options.get('key')??positional.join(' ')).trim(),
        json,all:flag('all'),book:options.get('book')?.trim()||'chat',raw:flag('raw')}
      if(options.has('task')&&options.has('tasks'))return fail(true,offset,'choose task or tasks')
      const taskSpec=options.get('task')??options.get('tasks'),selectors:('tasks'|'startup'|'all')[]=[]
      if(taskSpec!==undefined)selectors.push('tasks')
      if(flag('startup'))selectors.push('startup')
      if(flag('all'))selectors.push('all')
      if(positional.length) {
        if(positional.length!==1||!['startup','all'].includes(positional[0]!))
          return fail(true,offset,'ruby run requires task=<spec>, startup or all')
        selectors.push(positional[0] as 'startup'|'all')
      }
      if(selectors.length!==1)return fail(true,offset,'ruby run requires exactly one selection')
      const taskSpecs=taskSpec===undefined?[]:taskSpec.split(',').map(value=>value.trim())
      if(taskSpecs.some(value=>!value))return fail(false,offset,'ruby task specification is empty')
      return {index,kind:'ruby-run',selection:selectors[0]!,taskSpecs,json}
    }
    function command(start:number,end:number):void {
      const segment=source.slice(start,end).trim(),head=/^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(segment)
      if(!head)return fail(false,start,'expected a slash command')
      const name=head[1]!,body=(head[2]??'').trim(),index=commands.length
      if(['getvar','getchatvar','getglobalvar','setvar','setchatvar','setglobalvar','input','prompt','echo'].includes(name)) {
        const options=new Map<string,string>()
        let cursor=0,text:string|undefined
        while(cursor<body.length) {
          const option=/^(\w+)=(?:"((?:\\.|[^"])*)"|(\S+))\s*/.exec(body.slice(cursor))
          if(!option) {
            const raw=body.slice(cursor)
            text=decodeText(raw.startsWith('"')&&raw.endsWith('"')?raw.slice(1,-1):raw)
            break
          }
          if(options.has(option[1]!))fail(true,start,'repeated option')
          options.set(option[1]!,decodeText(option[2]??option[3]!));cursor+=option[0].length
        }
        const variable=name.includes('var'),setting=name.startsWith('set'),
          allowed=variable?setting?['key','name','index','as']:['key','index']:name==='echo'?[]:['default']
        for(const key of options.keys())if(!allowed.includes(key))fail(true,start,'unsupported option: '+key)
        if(variable) {
          const key=options.get('key')??options.get('name')??(!setting?text:undefined)
          if(!key)fail(false,start,'variable key is required')
          const conversion=options.get('as')?.trim().toLowerCase()
          commands.push({index,kind:setting?'setvar':'getvar',scope:name.includes('global')?'global':'chat',
            key:key!,...setting&&text!==undefined?{text}:{},
            ...options.has('index')?{variableIndex:options.get('index')!}:{},...conversion?{as:conversion}:{}})
        }else if(name==='echo')commands.push({index,kind:'echo',...text!==undefined?{text}:{}})
        else commands.push({index,kind:'input',defaultValue:options.get('default')??'',...text!==undefined?{text}:{}})
      }else if(name==='send') {
        if(/^\w+=/.test(body))fail(true,start,'send named options are not supported')
        if(!body)fail(false,start,'send text is required')
        commands.push({index,kind:'send',text:decodeText(body)})
      }else if(name==='trigger') {
        let awaitCompletion=false
        if(body) {
          const argument=/^(\w+)=(?:"([^"]*)"|(\S+))$/.exec(body)
          if(!argument||argument[1]!=='await')return fail(true,start,'only the trigger await option is supported')
          const value=(argument[2]??argument[3]!).trim().toLowerCase()
          if(['true','on','1'].includes(value))awaitCompletion=true
          else if(!['false','off','0'].includes(value))fail(true,start,'await requires a boolean literal')
        }
        commands.push({index,kind:'trigger',awaitCompletion})
      }else if(name==='ruby')commands.push(ruby(body,index,start))
      else fail(true,start,'command is outside the supported player-command grammar')
    }
    let start=0,quoted=false
    for(let index=0;index<source.length;index++) {
      const char=source[index]!,next=source[index+1]
      if(char==='\\'&&escapable(next)){index++;continue}
      if(char==='\\'&&source.startsWith('{{',index+1))fail(true,index,'escaped macros are outside this grammar')
      if(char==='"'){quoted=!quoted;continue}
      if(source.startsWith('{{',index)) {
        if(!source.startsWith('{{pipe}}',index))fail(true,index,'only the pipe macro is supported')
        index+='{{pipe}}'.length-1;continue
      }
      if(source.startsWith('}}',index)||source.startsWith('{:',index)||source.startsWith(':}',index))
        fail(true,index,'closures and macro expressions are not supported')
      if(char==='|'&&!quoted){command(start,index);start=index+1}
    }
    if(quoted)fail(false,source.length,'unterminated double quote')
    command(start,source.length)
    return {commands}
  }
  /** The shared runner owns only this invocation's pipe and confirmed prefix.
   * Main UI and actual SDK/Core owners supply all effects and authority. */
  async function executeParsedCommands(pipeline:AuthorNativeCommandPipeline,operationId:string,
    owners:AuthorNativeCommandRunnerOwnersV1,initialPipe=''):Promise<AuthorNativeCommandResultV1> {
    const result:{operationId:string;pipe:string;steps:AuthorNativeCommandStepV1[];refreshRequired?:true}=
      {operationId,pipe:initialPipe,steps:[]}
    const substitute=(text:string)=>text.replaceAll('{{pipe}}',()=>result.pipe)
    // Capability refusal also precedes the first side effect of a valid chain.
    for(const command of pipeline.commands) {
      if((command.kind==='getvar'||command.kind==='setvar')&&!owners.readVariable
        ||command.kind==='setvar'&&!owners.writeVariable||command.kind==='input'&&!owners.input
        ||command.kind==='echo'&&!owners.echo)return {...result,kind:'refused',code:'AUTHOR_NATIVE_COMMAND_UNAVAILABLE'}
    }
    function valueAs(text:string,kind:string|undefined):unknown {
      if(kind==='null')return null
      if(kind==='undefined'||kind==='none')return undefined
      if(kind==='number')return Number(text)
      if(kind==='int')return parseInt(text,10)
      if(kind==='float')return parseFloat(text)
      if(kind==='boolean'||kind==='bool')return ['true','on','1'].includes(text.trim().toLowerCase())
      if(['list','array'].includes(kind??'')) {
        try {const parsed=JSON.parse(text);return Array.isArray(parsed)?parsed:[]}catch{return []}
      }
      if(['object','dict','dictionary'].includes(kind??'')) {
        try {const parsed=JSON.parse(text);return typeof parsed==='object'?parsed:{}}catch{return {}}
      }
      return text
    }
    const pipeValue=(value:unknown)=>{
      const trimmed=typeof value==='string'?value.trim():undefined,
        selected=trimmed===''||Number.isNaN(Number(value))?value||'':Number(value)
      return String(selected)
    }
    try {
      for(const command of pipeline.commands) {
        owners.assertCurrent()
        const stepId=operationId+':'+command.index,text='text' in command&&command.text!==undefined
          ?substitute(command.text):result.pipe
        if(command.kind==='getvar'||command.kind==='setvar') {
          const key=substitute(command.key),index=command.variableIndex===undefined?undefined:substitute(command.variableIndex),
            current=owners.readVariable!(command.scope,key)
          if(command.kind==='getvar') {
            let value=current
            if(index!==undefined) {
              try {
                value=JSON.parse(String(current))
                const number=Number(index)
                value=(value as any)[Number.isNaN(number)?index:number]
                if(typeof value==='object')value=JSON.stringify(value)
              }catch{}
            }
            result.pipe=pipeValue(value)
          }else {
            let value:unknown=text
            if(index!==undefined) {
              try {
                const number=Number(index),at=Number.isNaN(number)?index:number,
                  data=JSON.parse(String(current??'null'))??(typeof at==='string'?{}:[])
                data[at]=valueAs(text,command.as);value=JSON.stringify(data)
              }catch{result.pipe=text;result.steps.push({index:command.index,kind:'local',action:'setvar'});continue}
            }
            await owners.writeVariable!(command.scope,key,value,stepId)
            result.pipe=text
          }
          result.steps.push({index:command.index,kind:'local',action:command.kind})
        }else if(command.kind==='input') {
          result.pipe=await owners.input!(text,substitute(command.defaultValue),stepId)
          result.steps.push({index:command.index,kind:'local',action:'input'})
        }else if(command.kind==='echo') {
          if(text)await owners.echo!(text,stepId)
          result.pipe=text;result.steps.push({index:command.index,kind:'local',action:'echo'})
        }else {
          let resolved:AuthorNativeCommand=command
          if(command.kind==='send')resolved={...command,text}
          else if(command.kind==='ruby-read')resolved={...command,key:substitute(command.key),book:substitute(command.book)}
          else if(command.kind==='ruby-run')resolved={...command,taskSpecs:command.taskSpecs.map(substitute)}
          else if(command.kind==='ruby-preset')resolved={...command,selector:substitute(command.selector)}
          const remote=await owners.remote(resolved,operationId,result.pipe)
          result.steps.push(...remote.steps);result.pipe=remote.pipe
          if(remote.refreshRequired)result.refreshRequired=true
          if(remote.steps.some(step=>step.kind==='ruby'&&step.sourceDataPublished))delete result.refreshRequired
          if(remote.kind!=='executed')return {...remote,steps:result.steps}
        }
        owners.assertCurrent()
      }
      return {...result,kind:'executed'}
    }catch(error) {
      return {...result,kind:'unknown',code:error instanceof Error?error.message:String(error)}
    }finally {
      try {await owners.release?.()}catch{}
    }
  }
  return {parse:parseAuthorNativeCommands,execute:executeParsedCommands,ParseError:AuthorNativeCommandParseError}
}
export interface AuthorNativeCommandRunnerOwnersV1 {
  assertCurrent():void
  release?():Promise<void>|void
  readVariable?(scope:'chat'|'global',key:string):unknown
  writeVariable?(scope:'chat'|'global',key:string,value:unknown,operationId:string):Promise<void>
  input?(text:string,defaultValue:string,operationId:string):Promise<string>
  echo?(text:string,operationId:string):Promise<void>
  remote(command:AuthorNativeCommand,operationId:string,pipe:string):Promise<AuthorNativeCommandResultV1>
}
export interface AuthorNativeCommandUiV1 {
  input(text:string,defaultValue:string):Promise<string>|string
  echo(text:string):Promise<void>|void
}
const commandLanguage=createAuthorNativeCommandLanguageV1()
export const parseAuthorNativeCommands=commandLanguage.parse
export const executeParsedAuthorNativeCommandsV1=commandLanguage.execute
export const AuthorNativeCommandParseError=commandLanguage.ParseError
export type AuthorNativeCommandParseError=InstanceType<typeof AuthorNativeCommandParseError>
