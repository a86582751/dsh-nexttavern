/** Finite Native player-command grammar, not a general STscript evaluator.
 * Local pinned references: TH 519599bc src/function/slash.ts; ST 06bde939
 * public/scripts/slash-commands.js send:1732/5023, trigger:1806/4987.
 * /send retains raw quotes and trims its outer text. Double quotes group a
 * pipeline delimiter here; strict delimiter escapes are deterministic rather
 * than dependent on the host's configurable ST parser flags. */
export type AuthorNativeCommand=
  |{readonly index:number;readonly kind:'send';readonly text:string}
  |{readonly index:number;readonly kind:'trigger';readonly awaitCompletion:boolean}
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
    }else fail(true,start,'command is outside the supported player-command grammar')
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
