/** Runner-only error evidence. Never log argv/Error.message, raw XML or environment. */
import {openSync,fstatSync,readSync,closeSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export function safeErrorTail(text:string):string {
  let safe=text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
  const secrets=['local-test-only',...Object.entries(process.env)
    .filter(([name,value])=>/(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY|CREDENTIAL|AUTH|COOKIE)/i.test(name)&&value&&value.length>=8)
    .map(([,value])=>value!)];
  for(const secret of secrets.sort((a,b)=>b.length-a.length))safe=safe.split(secret).join('[SECRET_REDACTED]');
  safe=safe.replace(/(?:authorization|proxy-authorization|cookie|set-cookie)["']?\s*[:=][^\r\n]*/gi,'[AUTH_HEADER_REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,'Bearer [REDACTED]')
    .replace(/(?:api[_ -]?key|(?:access[_ -]?|refresh[_ -]?)?token|password|secret)["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,'[SECRET_REDACTED]')
    .replace(/(?:https?|wss?):\/\/[^\s"'<>]+/gi,value=>{
      try {
        const url=new URL(value);
        return url.protocol+'//'+(url.username||url.password?'[USERINFO_REDACTED]@':'')+url.host+url.pathname
          +(url.search?'?[QUERY_REDACTED]':'')+(url.hash?'#[FRAGMENT_REDACTED]':'');
      }catch{return '[URL_REDACTED]'}
    })
    .replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g,'[TOKEN_REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT_REDACTED]')
    .replace(/[A-Za-z0-9_\-+/=]{48,}/g,'[LONG_VALUE_REDACTED]');
  return safe.split(/\r?\n/).filter((line,index,all)=>line||index<all.length-1).slice(-12).join('\n').slice(-2400);
}
export function adbFailureKind(text:string):string {
  if(/device (?:is )?offline/i.test(text))return 'DEVICE_OFFLINE';
  if(/device .*not found|no devices\/emulators found/i.test(text))return 'DEVICE_NOT_FOUND';
  if(/unauthorized/i.test(text))return 'DEVICE_UNAUTHORIZED';
  const install=text.match(/\bINSTALL_FAILED_[A-Z0-9_]{1,100}\b/)?.[0];if(install)return install;
  if(/connection (?:reset|refused)|cannot connect|failed to connect|error: closed|transport.*(?:error|closed)/i.test(text))return 'TRANSPORT_ERROR';
  return 'UNCLASSIFIED';
}
function tailFile(file:string):string {
  const fd=openSync(file,'r');
  try {
    const size=fstatSync(fd).size,offset=Math.max(0,size-128*1024),buffer=Buffer.alloc(Math.min(size,128*1024));
    const count=readSync(fd,buffer,0,buffer.length,offset);let text=buffer.subarray(0,count).toString('utf8');
    if(offset>0) {const newline=text.indexOf('\n');text=newline<0?'':text.slice(newline+1);}
    return text; // Drop a cut first line, which might contain a partial secret.
  }finally{closeSync(fd)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args:Record<string,string>={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
  const source=args['--source'];
  if(!['emulator','adb-state','probe-install'].includes(source)||!args['--file'])process.exitCode=2;
  else {
    try {
      const text=tailFile(args['--file']);
      const selected=source==='emulator'?text.split(/\r?\n/).filter(line=>/\b(?:error|fatal|panic|crash|aborted|killed|SIGSEGV|SIGABRT|SIGKILL|SIGBUS|SIGILL|SIGTERM|SIGTRAP)\b|cannot allocate memory|no space left/i.test(line)).join('\n'):text;
      const signals=['SIGSEGV','SIGABRT','SIGKILL','SIGBUS','SIGILL','SIGTERM','SIGTRAP'].filter(signal=>new RegExp('\\b'+signal+'\\b').test(text));
      const state=text.trim();
      console.log(JSON.stringify({kind:'nexttavern-runner-diagnostic',source,
        exit:/^-?\d+$/.test(args['--exit']??'')?Number(args['--exit']):null,
        classification:source==='emulator'?'EMULATOR_ERROR_LINES':args['--exit']==='124'?'DIAGNOSTIC_TIMEOUT':state==='device'?'DEVICE':adbFailureKind(text),
        ...(source==='emulator'?{logSignalTokens:signals}:{}),errorTail:safeErrorTail(selected)}));
    }catch(error) {
      const code=(error as {code?:string}).code;
      console.log(JSON.stringify({kind:'nexttavern-runner-diagnostic',source,classification:'PRIVATE_LOG_UNAVAILABLE',
        errorCode:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));
    }
  }
}
