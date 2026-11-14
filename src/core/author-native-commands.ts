/** Finite Native player-command grammar, not a general STscript evaluator.
 * Local pinned references: TH 519599bc src/function/slash.ts; ST 06bde939
 * public/scripts/slash-commands.js send:1732/5023, trigger:1806/4987.
 * /send retains raw quotes and trims its outer text. Double quotes group a
 * pipeline delimiter here; strict delimiter escapes are deterministic rather
 * than dependent on the host's configurable ST parser flags. */
export type AuthorNativeCommand=
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
export class AuthorNativeCommandParseError extends Error {
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
export function parseAuthorNativeCommands(source:string):AuthorNativeCommandPipeline {
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
    if(name==='send') {
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
