/** Same-VM, ordinary native UI probe. No product API, private file, JS, root or clipboard access. */
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {REQUIRED_CAPABILITIES} from '../../android/probe/model.mts';

type Node=Record<string,string>;
type Check={id:string;status:'passed'|'failed'|'blocked';durationMs:number;evidence:Record<string,unknown>;error?:{name?:string;code?:string}};
type Envelope={protocol:string;event:string;status:string;ok:boolean;platform:string;actualPlatform:string;androidGate:false};
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
const adb=args['--adb'],serial=args['--serial'];
const pkg='app.nexttavern.android.probe.x86kvm';
const component=pkg+'/app.nexttavern.android.probe.MainActivity';
const core=[...REQUIRED_CAPABILITIES.slice(0,8)];
const expected=[...REQUIRED_CAPABILITIES,'https-client'];
let stage='arguments',nodes:Node[]=[],pid='',hierarchyAvailable=false;
class ProbeFailure extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.code=code}
}
function need(value:unknown,code:string):asserts value {if(!value)throw new ProbeFailure(code)}
function emit(status:string,extra:Record<string,unknown>={}):void {
  console.log(JSON.stringify({kind:'nexttavern-kvm-probe',stage,status,...extra}));
}
function command(...values:string[]):string {
  try{return execFileSync(adb,['-s',serial,...values],{encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']})}
  catch{throw new ProbeFailure('ADB_COMMAND_FAILED')}
}
const decode=(value:string)=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,decimal)=>String.fromCodePoint(parseInt(hex??decimal,hex?16:10)))
  .replace(/&amp;/g,'&');
function snapshot():void {
  nodes=[];hierarchyAvailable=false;
  // Capture the Bundle privately; never log its raw hierarchy or input values.
  const output=command('shell','am','instrument','-w','-r','app.nexttavern.qa.ui/.HierarchyInstrumentation');
  const records=[...output.matchAll(/^INSTRUMENTATION_RESULT: hierarchy=([^\r\n]*)\r?$/gm)];
  const resultCode=output.match(/^INSTRUMENTATION_CODE: (-?\d+)\r?$/m)?.[1];
  const xml=records[0]?.[1];
  if(resultCode!=='-1'||records.length!==1||!xml?.startsWith('<hierarchy>')||!xml.endsWith('</hierarchy>')) {
    emit('observed',{interaction:'hierarchy-read-failure',hierarchyRecordCount:records.length,
      instrumentationCode:resultCode===undefined?null:Number(resultCode),
      error:output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]{1,80})\r?$/m)?.[1]??null,
      exceptionClass:output.match(/^INSTRUMENTATION_RESULT: exception=([A-Za-z]{1,80})\r?$/m)?.[1]??null});
    throw new ProbeFailure('ACCESSIBILITY_UNAVAILABLE');
  }
  hierarchyAvailable=true;const parents:number[]=[];
  for(const match of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if(match[0]==='</node>'){parents.pop();continue}
    const node:Node=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item=>[item[1],decode(item[2])]));
    node.__parent=String(parents.at(-1)??-1);
    const index=nodes.push(node)-1;if(match[2]!=='/')parents.push(index);
  }
}
function bounds(node:Node):number[]|null {
  const n=node.bounds?.match(/-?\d+/g)?.map(Number);
  return n?.length===4&&n[0]>=0&&n[1]>=0&&n[2]>n[0]&&n[3]>n[1]?n:null;
}
function visible(node:Node):number[]|null {
  if(node['visible-to-user']!=='true')return null;
  let box=bounds(node);if(!box)return null;
  while(Number(node.__parent)>=0) {
    node=nodes[Number(node.__parent)];const clip=bounds(node);if(!clip)continue;
    box=[Math.max(box[0],clip[0]),Math.max(box[1],clip[1]),Math.min(box[2],clip[2]),Math.min(box[3],clip[3])];
    if(box[2]<=box[0]||box[3]<=box[1])return null;
  }
  return box;
}
function tap(node:Node):void {
  const box=visible(node);need(box,'NO_VISIBLE_ACTION');
  command('shell','input','tap',String(Math.round((box[0]+box[2])/2)),String(Math.round((box[1]+box[3])/2)));
}
function scroll(down:boolean):void {
  // The probe source owns exactly one native ScrollView, not a guessed screen region.
  const found=nodes.filter(n=>n.package===pkg&&n.class==='android.widget.ScrollView'&&visible(n));
  need(found.length===1,'NATIVE_SCROLL_OWNER_NOT_EXPOSED');
  const box=visible(found[0])!,x=Math.round((box[0]+box[2])/2),h=box[3]-box[1];
  command('shell','input','swipe',String(x),String(Math.round(box[1]+h*(down?.8:.2))),
    String(x),String(Math.round(box[1]+h*(down?.2:.8))),'400');
}
function own(predicate:(n:Node)=>boolean):Node[] {return nodes.filter(n=>n.package===pkg&&predicate(n))}
async function seek(predicate:(n:Node)=>boolean,down:boolean):Promise<Node> {
  for(let attempt=0;attempt<14;attempt++) {
    snapshot();collect();
    const found=own(n=>predicate(n)&&visible(n)!==null);
    need(found.length<=1,'NATIVE_TARGET_AMBIGUOUS');if(found[0])return found[0];
    scroll(down);await delay(250);
  }
  throw new ProbeFailure('NATIVE_TARGET_NOT_EXPOSED_AFTER_SCROLL');
}
const checks=new Map<string,{line:string;value:Check}>();
let readyLine='',resultLine='',result:Envelope|undefined,summaryComplete=false;
let headerSeen=false,nativeDirectory='',terminalStatus:string|undefined;
let runUiState:Record<string,unknown>|undefined;
function safeCode(value:unknown):string|undefined {return typeof value==='string'&&/^[A-Z0-9_]{1,80}$/.test(value)?value:undefined}
function checkRecord(value:unknown):Check {
  const check=value as Check;
  need(check&&expected.includes(check.id as typeof expected[number])&&['passed','failed','blocked'].includes(check.status)
    &&Number.isInteger(check.durationMs)&&check.durationMs>=0&&check.evidence&&typeof check.evidence==='object'&&!Array.isArray(check.evidence),'INVALID_CHECK_RECORD');
  return check;
}
function collect():void {
  for(const node of own(n=>n.class==='android.widget.TextView')) {
    const text=node.text??'';
    if(text.startsWith('NextTavern Android capability probe\n')) {
      need(text.includes('\nPackage: '+pkg+'\n')&&text.includes('\nDebuggable: false\n')
        &&text.includes('\nTarget API: 36\n')&&text.includes('x64 KVM diagnostic / default 12000ms each / 180s supervisor'),'WRONG_PROBE_BUILD_OR_TIMING');
      const directory=text.match(/\nNative library directory: ([^\n]+)/)?.[1];
      need(directory?.startsWith('/data/app/'),'INSTALLER_NATIVE_DIRECTORY_NOT_EXPOSED');
      nativeDirectory=directory;headerSeen=true;
    }
    if(text.includes('\nready=')) {
      if(text.startsWith('失败 ·'))terminalStatus='failed';
      else if(text.startsWith('BLOCKED ·'))terminalStatus='blocked';
      else if(text.startsWith('能力探针通过 ·'))terminalStatus='passed';
      else if(text.startsWith('已取消 ·'))throw new ProbeFailure('NATIVE_CANCELLED');
      else if(text.startsWith('超时 ·'))throw new ProbeFailure('NATIVE_TIMED_OUT');
      if(terminalStatus) {
        need(text.includes('\nready=true\n'),'NATIVE_PROTOCOL_NOT_READY');
        const exit=text.match(/\(exit=(\d+)\)/)?.[1];
        need(terminalStatus==='passed'||exit===(terminalStatus==='failed'?'1':'2'),'NATIVE_EXIT_PROTOCOL_MISMATCH');
      }
    }
    if(!text.includes('"protocol":"nexttavern-g0"'))continue;
    need(!text.includes('[older lines omitted:'),'STDOUT_RECORDS_EVICTED');
    const seen=new Set<string>();let checkIndex=0;
    for(const line of text.split('\n').filter(line=>line.startsWith('{"protocol":"nexttavern-g0",'))) {
      const event=line.match(/^\{"protocol":"nexttavern-g0","event":"([a-z]+)"/)?.[1];
      need(event==='ready'||event==='check'||event==='result','UNKNOWN_PROTOCOL_EVENT');
      let parsed:Record<string,unknown>;
      try{parsed=JSON.parse(line)}catch {
        // Only the final summary is display-clipped by the existing native UI.
        // Decode its actual envelope, never synthesize a complete summary.
        need(event==='result'&&line.endsWith(' [display truncated]'),'TRUNCATED_INDIVIDUAL_PROTOCOL_RECORD');
        const prefix=line.match(/^(\{"protocol":"nexttavern-g0","event":"result","status":"(?:passed|failed|blocked)","ok":(?:true|false),"platform":"android","actualPlatform":"android","androidGate":false),"summary":/)?.[1];
        need(prefix,'RESULT_ENVELOPE_NOT_COMPLETE');
        try{parsed=JSON.parse(prefix+'}')}catch{throw new ProbeFailure('INVALID_RESULT_ENVELOPE')}
      }
      if(event==='ready') {
        need(!seen.has('ready'),'DUPLICATE_READY');seen.add('ready');
        need(parsed.platform==='android'&&parsed.actualPlatform==='android'&&parsed.scope==='node-capabilities-only'
          &&Number.isInteger(parsed.pid)&&Number(parsed.pid)>0,'WRONG_RUNTIME_READY');
        need(!readyLine||readyLine===line,'READY_CHANGED');readyLine=line;
      }else if(event==='check') {
        const check=checkRecord(parsed.check);need(!seen.has(check.id),'DUPLICATE_CHECK');
        need(seen.has('ready')&&!seen.has('result')&&check.id===expected[checkIndex++],'CHECK_SEQUENCE_MISMATCH');seen.add(check.id);
        const previous=checks.get(check.id);need(!previous||previous.line===line,'CHECK_RECORD_CHANGED');
        checks.set(check.id,{line,value:check});
      }else {
        need(!seen.has('result'),'DUPLICATE_RESULT');
        need(seen.has('ready')&&checkIndex===expected.length,'RESULT_WITHOUT_11_COMPLETE_CHECKS');seen.add('result');
        need(['passed','failed','blocked'].includes(String(parsed.status))&&typeof parsed.ok==='boolean'
          &&parsed.androidGate===false&&parsed.platform==='android'&&parsed.actualPlatform==='android','INVALID_RESULT_ENVELOPE');
        need(!resultLine||resultLine===line,'RESULT_CHANGED');resultLine=line;result=parsed as Envelope;
        summaryComplete=Object.hasOwn(parsed,'summary');
      }
    }
  }
}
function completeEvidence():number {
  need(headerSeen&&readyLine&&result&&checks.size===expected.length&&expected.every(id=>checks.has(id)),'INCOMPLETE_11_CHECK_EVIDENCE');
  need(terminalStatus===result.status&&result.androidGate===false&&result.ok===false,'NATIVE_GLOBAL_STATUS_MISMATCH');
  const failed=[...checks.values()].some(({value})=>value.status==='failed');
  need(result.status===(failed?'failed':'blocked'),'X64_GLOBAL_STATUS_MISMATCH');
  const runtime=checks.get('runtime-executable')!.value;
  if(runtime.status==='passed')need(runtime.evidence.platform==='android'&&runtime.evidence.arch==='x64'
    &&String(runtime.evidence.node).startsWith('24.')
    &&runtime.evidence.execPath===nativeDirectory+'/libnexttavern_node.so','INSTALLER_EXECUTABLE_IDENTITY_MISMATCH');
  const packageInfo=command('shell','dumpsys','package',pkg);
  const uid=Number(packageInfo.match(/^\s*userId=(\d+)\s*$/m)?.[1]);
  need(Number.isInteger(uid)&&uid>=10000,'ORDINARY_APP_UID_NOT_EXPOSED');
  need(command('shell','pidof',pkg).trim()===pid,'PROBE_ACTIVITY_PROCESS_CHANGED');
  for(const id of expected) {
    const check=checks.get(id)!.value;
    // No error messages, stderr, XML, headers, body or user/model data are logged.
    const evidence=id==='https-client'?{status:check.evidence.status,authorized:check.evidence.authorized,tlsVersion:check.evidence.tlsVersion}:check.evidence;
    emit('observed',{check:{id,status:check.status,durationMs:check.durationMs,evidence,
      ...(check.error?{errorCode:safeCode(check.error.code)??'UNSPECIFIED_ERROR'}:{})}});
  }
  const corePassed=core.every(id=>checks.get(id)!.value.status==='passed');
  const https=checks.get('https-client')!.value;
  const httpsPassed=https.status==='passed'&&https.evidence.authorized===true
    &&['TLSv1.2','TLSv1.3'].includes(String(https.evidence.tlsVersion))
    &&Number.isInteger(https.evidence.status)&&Number(https.evidence.status)>=100&&Number(https.evidence.status)<=599;
  emit(corePassed&&httpsPassed?'scoped-passed':'scoped-failed',{scope:'eight-core-plus-fixed-https-client',
    corePassed,httpsClientPassed:httpsPassed,globalStatus:result.status,globalOk:result.ok,androidGate:false,
    actualPlatform:result.actualPlatform,arch:'x64',appUid:uid,debuggable:false,targetSdk:36,
    individualCheckCount:checks.size,finalSummaryComplete:summaryComplete,
    tlsLocalServerStatus:checks.get('tls-local-ca')!.value.status,dnsLocalhostStatus:checks.get('dns-localhost')!.value.status,
    arm64Qualified:false,fullG0Accepted:false,modelServiceQualified:false});
  return corePassed&&httpsPassed?0:1;
}
async function main():Promise<number> {
  need(adb&&/^emulator-\d+$/.test(serial??'')&&Object.keys(args).length===2,'EMULATOR_ADB_ARGUMENTS_REQUIRED');
  stage='ordinary-native-launch';
  command('shell','am','start','-W','-n',component);
  pid=command('shell','pidof',pkg).trim();need(/^\d+$/.test(pid),'NATIVE_ACTIVITY_PROCESS_MISSING');
  stage='explicit-https-opt-in';
  const checkbox=await seek(n=>n.class==='android.widget.CheckBox'&&n.text==='可选：验证 example.com 公网 HTTPS（无密钥）',true);
  need(headerSeen&&checkbox.checked==='false','FRESH_EXPLICIT_OPT_IN_REQUIRED');tap(checkbox);
  snapshot();collect();
  need(own(n=>n.class==='android.widget.CheckBox'&&n.checked==='true').length===1,'HTTPS_OPT_IN_NOT_CHECKED');
  const run=await seek(n=>n.class==='android.widget.Button'&&n.text==='运行能力探针'&&n.enabled==='true',true);
  stage='foreground-default-budget-suite';tap(run);
  const deadline=Date.now()+240000;
  while(Date.now()<deadline) {
    snapshot();collect();
    if(result&&checks.size===expected.length) {
      if(!terminalStatus)await seek(n=>n.text?.includes('\nready=true\n')&&/^(?:失败 ·|BLOCKED ·|能力探针通过 ·)/.test(n.text),false);
      stage='scoped-evidence';return completeEvidence();
    }
    if(!runUiState) {
      runUiState={runEnabled:own(n=>n.text==='运行能力探针')[0]?.enabled,
        stopEnabled:own(n=>n.text==='停止')[0]?.enabled,
        copyEnabled:own(n=>n.text==='复制测试记录')[0]?.enabled};
      emit('observed',{interaction:'after-native-run-touch',...runUiState});
    }
    if(!own(n=>n.text?.includes('"protocol":"nexttavern-g0"')).length)scroll(true);
    await delay(2000);
  }
  throw new ProbeFailure('PROBE_TERMINAL_EVIDENCE_DEADLINE');
}
function failureContext():Record<string,unknown> {
  const counts=(items:string[])=>Object.fromEntries([...new Set(items)].slice(0,20).map(key=>[key,items.filter(item=>item===key).length]));
  const roots=nodes.filter(n=>n.__parent==='-1');
  let ownProcesses:Record<string,unknown>[]=[];
  let currentPid:string|null=null;
  try{currentPid=command('shell','pidof',pkg).trim()}catch{/* The Activity may already have exited. */}
  try {
    // Still inspect the package UID when its Activity is gone: an owned child
    // can outlive that PID. Never print names, argv or other applications.
    const info=command('shell','dumpsys','package',pkg),uid=info.match(/^\s*userId=(\d+)\s*$/m)?.[1];
    if(uid)ownProcesses=command('shell','ps','-A','-o','UID,PID,PPID,NAME').trim().split(/\r?\n/).slice(1)
      .map(line=>line.trim().split(/\s+/)).filter(row=>row[0]===uid)
      .map(row=>({pid:Number(row[1]),parentPid:Number(row[2]),kind:row[1]===currentPid?'activity':/libnexttavern_node|^node$/.test(row[3])?'node':'other-owned'}));
  }catch{/* Diagnostic unavailability is not evidence of runtime failure. */}
  return {hierarchyAvailable,initialActivityPid:pid,currentActivityPid:/^\d+$/.test(currentPid??'')?Number(currentPid):null,
    ownProcesses,runUiState:runUiState??null,
    rootPackages:counts(roots.map(n=>n.package??'')),rootClasses:counts(roots.map(n=>n.class??'')),
    probeWindowActive:roots.some(n=>n.package===pkg&&n['window-active']==='true'),
    probeWindowFocused:roots.some(n=>n.package===pkg&&n['window-focused']==='true'),
    nativeStatus:own(n=>n.class==='android.widget.TextView'&&n.text?.includes('\nready='))
      .map(n=>({state:/^(运行中|失败|BLOCKED|已取消|超时|能力探针通过|尚未运行)/.exec(n.text)?.[1]??'unknown',
        ready:/\nready=true\n/.test(n.text)})).slice(0,2)};
}
try{process.exitCode=await main()}catch(error) {
  emit('failed',{code:error instanceof ProbeFailure?error.code:'PROBE_UI_DRIVER_ERROR',
    parsedCheckCount:checks.size,nativeTerminalStatus:terminalStatus??null,displayedGlobalStatus:result?.status??null,
    finalSummaryComplete:summaryComplete,headerSeen,androidGate:false,fullG0Accepted:false,...failureContext(),
    nativeControls:own(n=>['android.widget.Button','android.widget.CheckBox'].includes(n.class))
      .slice(0,8).map(n=>({class:n.class,bounds:n.bounds,enabled:n.enabled,checked:n.checked}))});
  process.exitCode=1;
}
