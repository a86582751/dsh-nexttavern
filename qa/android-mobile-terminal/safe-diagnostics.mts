/** Runner-only error evidence. Never log argv/Error.message, raw XML or environment. */
import {openSync,fstatSync,readSync,closeSync,constants,realpathSync,writeFileSync,readFileSync} from 'node:fs';
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
/** Default INFO transport records only; never return a source line or unknown suffix. */
export function adbDefaultInfoEvents(text:string,serverPid:number) {
  const errnos:Record<string,[string,number]>={
    'Success':['ERRNO_ZERO_TEXT',0], 'Connection reset by peer':['ECONNRESET',104],
    'Connection timed out':['ETIMEDOUT',110], 'Broken pipe':['EPIPE',32],
    'Connection refused':['ECONNREFUSED',111], 'Software caused connection abort':['ECONNABORTED',103],
    'Transport endpoint is not connected':['ENOTCONN',107], 'Bad file descriptor':['EBADF',9],
    'Input/output error':['EIO',5], 'Resource temporarily unavailable':['EAGAIN',11],
    'Interrupted system call':['EINTR',4], 'Operation canceled':['ECANCELED',125],
    'Cannot allocate memory':['ENOMEM',12], 'No buffer space available':['ENOBUFS',105],
  };
  const events:Array<{time:string,event:string,reason:string,errnoName:string|null,errno:number|null}>=[];
  for(const line of text.split(/\r?\n/)) {
    const entry=line.match(/^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3,6})\s+(\d+)\s+\d+\s+I\s+adb\s*:\s+transport\.cpp:\d+\s+(.*)$/);
    if(!entry||Number(entry[2])!==serverPid)continue;
    const body=entry[3];let event:string,reason:string,errnoName:string|null=null,errno:number|null=null;
    if(body.startsWith('emulator-5554: read failed: ')) {
      event='READ_FAILED';reason='READ_FAILED';
      const suffix=body.slice('emulator-5554: read failed: '.length);
      [errnoName,errno]=Object.hasOwn(errnos,suffix)?errnos[suffix]:['ERRNO_UNRECOGNIZED',null];
    }else if(body.startsWith('emulator-5554: connection terminated: ')) {
      event='TRANSPORT_TERMINATED';
      switch(body.slice('emulator-5554: connection terminated: '.length)) {
        case 'read failed':reason='READ_FAILED';break;
        case 'write failed':reason='WRITE_FAILED';break;
        case 'requested stop':reason='REQUESTED_STOP';break;
        default:reason='UNKNOWN_REASON';
      }
    }else {
      const lifecycle:Record<string,string>={
        'emulator-5554: read thread spawning':'READ_THREAD_SPAWNING',
        'emulator-5554: write thread spawning':'WRITE_THREAD_SPAWNING',
        'BlockingConnectionAdapter(emulator-5554): stopping':'ADAPTER_STOPPING',
        'BlockingConnectionAdapter(emulator-5554): stopped':'ADAPTER_STOPPED',
        'BlockingConnectionAdapter(emulator-5554): destructing':'ADAPTER_DESTRUCTING',
      };
      if(!Object.hasOwn(lifecycle,body))continue;
      event='TRANSPORT_LIFECYCLE';reason=lifecycle[body];
    }
    events.push({time:entry[1],event,reason,errnoName,errno});
  }
  return events.slice(-24);
}
type AdbLogOwner={version:string|null,build:string|null,log:string,pid:number,dev:number,ino:number,offset:number,acquiredAt:string};
function acquireAdbLog(statusFile:string,adbExecutable:string):AdbLogOwner {
  if(process.env.ADB_TRACE||process.env.ANDROID_ADB_LOG_PATH)throw {code:'NONDEFAULT_ADB_LOG_CONFIG'};
  const status=tailFile(statusFile);
  const field=(key:string)=>status.match(new RegExp('^'+key+': "([^"\\\\\\r\\n]*)"\\r?$','m'))?.[1];
  const expectedLog=resolve(process.env.TMPDIR??'/tmp',`adb.${process.getuid!()}.log`);
  if(field('executable_absolute_path')!==realpathSync(adbExecutable)||field('log_absolute_path')!==expectedLog) {
    throw {code:'ADB_SERVER_IDENTITY_NOT_EXPOSED'};
  }
  const fd=openSync(expectedLog,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.uid!==process.getuid!())throw {code:'ADB_LOG_OWNER_MISMATCH'};
    const buffer=Buffer.alloc(Math.min(stat.size,128*1024)),offset=Math.max(0,stat.size-buffer.length);
    const count=readSync(fd,buffer,0,buffer.length,offset),text=buffer.subarray(0,count).toString('utf8');
    const starts=[...text.matchAll(/^--- adb starting \(pid (\d+)\) ---\r?$/gm)];
    const pid=Number(starts.at(-1)?.[1]);
    if(!Number.isSafeInteger(pid)||pid<=0||realpathSync(`/proc/${pid}/exe`)!==realpathSync(adbExecutable))throw {code:'ADB_SERVER_PID_NOT_EXPOSED'};
    const version=field('version'),build=field('build');
    return {version:version&&/^\d+(?:\.\d+){1,3}$/.test(version)?version:null,
      build:build&&/^[0-9][0-9.-]{0,39}$/.test(build)?build:null,
      log:expectedLog,pid,dev:stat.dev,ino:stat.ino,offset:stat.size,acquiredAt:new Date().toISOString()};
  }finally{closeSync(fd)}
}
function captureAdbLog(owner:AdbLogOwner,file:string) {
  const fd=openSync(owner.log,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=fstatSync(fd);
    if(stat.dev!==owner.dev||stat.ino!==owner.ino||stat.size<owner.offset)throw {code:'ADB_LOG_IDENTITY_CHANGED'};
    const offset=Math.max(owner.offset,stat.size-128*1024),buffer=Buffer.alloc(stat.size-offset);
    const count=readSync(fd,buffer,0,buffer.length,offset);let text=buffer.subarray(0,count).toString('utf8');
    if(offset>owner.offset){const newline=text.indexOf('\n');text=newline<0?'':text.slice(newline+1);}
    writeFileSync(file,text,{mode:0o600});
    let serverAlive:boolean|null=true;
    try{process.kill(owner.pid,0)}catch(error){serverAlive=(error as {code?:string}).code==='ESRCH'?false:null;}
    const events=adbDefaultInfoEvents(text,owner.pid);
    return {kind:'nexttavern-runner-diagnostic',source:'adb-server',classification:events.some(e=>e.event==='READ_FAILED'||e.event==='TRANSPORT_TERMINATED'&&e.reason!=='REQUESTED_STOP')?'DEFAULT_INFO_TRANSPORT_FAILURE':'DEFAULT_INFO_NO_FAILURE_MARKER',
      serverPid:owner.pid,serverAlive,serverVersion:owner.version,serverBuild:owner.build,
      acquiredAt:owner.acquiredAt,capturedAt:new Date().toISOString(),events};
  }finally{closeSync(fd)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args:Record<string,string>={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
  const source=args['--source'];
  if(source==='adb-server-acquire'||source==='adb-server') {
    try {
      if(source==='adb-server-acquire') {
        const owner=acquireAdbLog(args['--status-file'],args['--adb-executable']);
        writeFileSync(args['--state-file'],JSON.stringify(owner),{mode:0o600,flag:'wx'});
        console.log(JSON.stringify({kind:'nexttavern-runner-diagnostic',source:'adb-server',classification:'DEFAULT_INFO_OWNER_ACQUIRED',
          serverPid:owner.pid,serverVersion:owner.version,serverBuild:owner.build,acquiredAt:owner.acquiredAt}));
      }else console.log(JSON.stringify(captureAdbLog(JSON.parse(readFileSync(args['--state-file'],'utf8')),args['--file'])));
    }catch(error) {
      const code=(error as {code?:string}).code;
      console.log(JSON.stringify({kind:'nexttavern-runner-diagnostic',source:'adb-server',classification:'DEFAULT_INFO_UNAVAILABLE',
        errorCode:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));
    }
  }else if(!['emulator','adb-state','probe-install'].includes(source)||!args['--file'])process.exitCode=2;
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
