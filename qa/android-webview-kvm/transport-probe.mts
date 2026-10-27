/** Tiny UI transport diagnostic. No Host, JS bridge, real key, screenshot or action replay. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,chmodSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {adbFailureKind} from '../android-mobile-terminal/safe-diagnostics.mts';

type ReadMode='pulled-hierarchy'|'redirect'|'summary';
type UiNode=Record<string,string>;
type Result={stdout:Buffer;stderr:Buffer;status:number|null;signal:string|null;errorCode:string|null;
  transportPhase?:string;shellStdoutBytes?:number;pulledBytes?:number;cleanupFailed?:boolean};
type Identity={boot:string;framework:string;app:string;adbd:string;device:boolean};
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
const adb=args['--adb'],serial=args['--serial'],work=args['--work-dir'];
const pkg='app.nexttavern.android.webviewcontrol';
const modes:ReadMode[]=['pulled-hierarchy','redirect','summary'];
const deadline=Date.now()+240000;
let phase='INITIALIZE',readNumber=0,firstFailureSaved=false;
let anchor:Identity|undefined,lastNodes:UiNode[]=[];
const emit=(status:string,extra:Record<string,unknown>={})=>console.log(JSON.stringify({
  kind:'nexttavern-tiny-transport',phase,status,elapsedMs:Date.now()-(deadline-240000),...extra,
}));
class DiagnosticFailure extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.code=code}
}
function requireDiagnostic(value:unknown,code:string):asserts value {
  if(!value)throw new DiagnosticFailure(code);
}
requireDiagnostic(adb&&work&&/^emulator-\d+$/.test(serial??'')&&/^\d+$/.test(args['--emulator-pid']??''),
  'OWNED_EMULATOR_ARGUMENTS_REQUIRED');
mkdirSync(work,{recursive:true,mode:0o700});
function remaining(cap:number):number {
  const value=deadline-Date.now();
  requireDiagnostic(value>0,'TOTAL_DIAGNOSTIC_DEADLINE');
  return Math.min(cap,value);
}
function command(commandArgs:string[],cap=20000):Result {
  const result=spawnSync(adb,['-s',serial,...commandArgs],{
    timeout:remaining(cap),maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe'],
  });
  const code=(result.error as {code?:string}|undefined)?.code;
  return {stdout:result.stdout??Buffer.alloc(0),stderr:result.stderr??Buffer.alloc(0),
    status:result.status,signal:result.signal&&/^SIG[A-Z]+$/.test(result.signal)?result.signal:null,
    errorCode:code&&/^[A-Z_]{1,40}$/.test(code)?code:null};
}
function successful(result:Result):boolean {
  return result.status===0&&result.signal===null&&result.errorCode===null;
}
function emulatorAlive():boolean {
  try{process.kill(Number(args['--emulator-pid']),0);return true}catch{return false}
}
function metadata(result:Result):Record<string,unknown> {
  const output=result.stdout.toString('utf8');
  return {exit:result.status,signal:result.signal,errorCode:result.errorCode,
    transportPhase:result.transportPhase??null,shellStdoutBytes:result.shellStdoutBytes??null,
    pulledBytes:result.pulledBytes??null,cleanupFailed:result.cleanupFailed??false,
    stdoutBytes:result.stdout.length,stderrBytes:result.stderr.length,
    deviceStdoutBytes:output.match(/^DEVICE_STDOUT_BYTES=(\d{1,10})\r?$/m)?.[1]??null,
    instrumentationCode:output.match(/^INSTRUMENTATION_CODE: (-?\d{1,6})\r?$/m)?.[1]??null,
    readerError:output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]{1,80})\r?$/m)?.[1]??null,
    errorClass:output.match(/^INSTRUMENTATION_RESULT: exception=([A-Za-z]{1,80})\r?$/m)?.[1]??null,
    classification:adbFailureKind(result.stderr.toString('utf8'))};
}
function saveFirstFailure(result:Result):void {
  if(firstFailureSaved)return;
  writeFileSync(join(work,'first-read-failure.stdout'),result.stdout,{mode:0o600,flag:'wx'});
  writeFileSync(join(work,'first-read-failure.stderr'),result.stderr,{mode:0o600,flag:'wx'});
  firstFailureSaved=true;
}
function identity(until=deadline):Identity|undefined {
  const read=(...commandArgs:string[])=>{
    if(Date.now()>=until)return '';
    const result=command(commandArgs,Math.min(3000,until-Date.now()));
    return successful(result)?result.stdout.toString('utf8').trim():'';
  };
  const device=read('get-state')==='device';
  if(!device)return undefined;
  const boot=read('shell','cat','/proc/sys/kernel/random/boot_id');
  const framework=read('shell','pidof','system_server');
  const app=read('shell','pidof',pkg);
  const adbd=read('shell','pidof','adbd');
  if(!/^[0-9a-f-]{36}$/.test(boot)||!/^\d+$/.test(framework)||!/^\d+$/.test(app))return undefined;
  return {boot,framework,app,adbd:/^\d+$/.test(adbd)?adbd:'',device};
}
function sameIdentity(after:Identity|undefined,label:string):boolean {
  const sameBoot=!!after&&after.boot===anchor?.boot;
  const sameFramework=!!after&&after.framework===anchor?.framework;
  const sameApp=!!after&&after.app===anchor?.app;
  emit('IDENTITY',{label,device:after?.device??false,emulatorAlive:emulatorAlive(),
    sameBoot,sameFramework,sameApp,
    adbdBefore:anchor?.adbd||null,adbdAfter:after?.adbd||null,
    sameAdbd:!!anchor?.adbd&&!!after?.adbd&&anchor.adbd===after.adbd});
  return sameBoot&&sameFramework&&sameApp&&emulatorAlive();
}
function readCommand(mode:ReadMode,until=deadline):Result {
  const cap=Math.min(20000,until-Date.now());
  requireDiagnostic(cap>0,'READ_DEADLINE');
  if(mode==='pulled-hierarchy')return pulledHierarchy(until);
  if(mode==='redirect') {
    // Keep Binder + am formatting, but send only terminal metadata over ADB.
    // The fixed device-side file belongs to this invocation and is always removed.
    const script='out=$(mktemp /data/local/tmp/nexttavern-transport.XXXXXX) || exit 91; '
      + `trap 'rm -f "$out"' EXIT; `
      + 'am instrument -w -r app.nexttavern.qa.ui/.HierarchyInstrumentation >"$out" 2>&1; rc=$?; '
      + `grep -E '^INSTRUMENTATION_CODE: -?[0-9]{1,6}$' "$out" | tail -n 1; `
      + `printf 'AM_RC=%s\\nDEVICE_STDOUT_BYTES=%s\\n' "$rc" "$(wc -c <"$out")"`;
    return command(['shell',script],cap);
  }
  // Summary retains its original small shell result; the full tree uses pull.
  const commandArgs=['shell','am','instrument','-w','-r'];
  if(mode==='summary')commandArgs.push('-e','outputMode','summary');
  commandArgs.push('app.nexttavern.qa.ui/.HierarchyInstrumentation');
  return command(commandArgs,cap);
}
function pulledHierarchy(until:number):Result {
  // Know the exact unique path before issuing any shell command, so even a
  // dropped terminal reply cannot strand an unknown mktemp allocation.
  const id=randomUUID(),remote='/data/local/tmp/nexttavern-transport-'+id+'.stdout';
  const local=join(work,'pulled-hierarchy-'+id+'.stdout');
  const readUntil=Math.min(until,Date.now()+20000)-3000; // Reserve exact-file cleanup.
  const readCap=()=>{const value=readUntil-Date.now();requireDiagnostic(value>0,'READ_DEADLINE');return value};
  let localCreated=false,result:Result|undefined;
  try {
    const script=`umask 077; set -C; : > '${remote}' || exit 91; `
      + `am instrument -w -r app.nexttavern.qa.ui/.HierarchyInstrumentation >> '${remote}' 2>&1; rc=$?; `
      + `grep -E '^INSTRUMENTATION_CODE: -?[0-9]{1,6}$' '${remote}' | tail -n 1; `
      + `printf 'AM_RC=%s\\nDEVICE_STDOUT_BYTES=%s\\n' "$rc" "$(wc -c < '${remote}')"`;
    const terminal=command(['shell',script],readCap());
    if(!successful(terminal)||!/^AM_RC=0\r?$/m.test(terminal.stdout.toString('utf8'))
      ||!/^INSTRUMENTATION_CODE: -1\r?$/m.test(terminal.stdout.toString('utf8')))
      return result={...terminal,transportPhase:'AM_TERMINAL'};
    writeFileSync(local,'',{mode:0o600,flag:'wx'});localCreated=true;
    const pull=command(['pull',remote,local],readCap());
    chmodSync(local,0o600);
    if(!successful(pull))return result={...pull,transportPhase:'ADB_PULL',shellStdoutBytes:terminal.stdout.length};
    const output=readFileSync(local);
    return result={...terminal,stdout:output,transportPhase:'PULLED_HIERARCHY',
      shellStdoutBytes:terminal.stdout.length,pulledBytes:output.length};
  } finally {
    if(localCreated)unlinkSync(local);
    const cleanupCap=Math.min(3000,until-Date.now());
    const cleanup=cleanupCap>0?command(['shell','rm','-f',remote],cleanupCap):undefined;
    if(!cleanup||!successful(cleanup)) {
      emit('PRIVATE_FILE_CLEANUP_FAILED',{...(cleanup?metadata(cleanup):{classification:'CLEANUP_DEADLINE_EXPIRED'}),replayedAction:false});
      // Keep the original terminal/pull failure available to first-failure capture.
      if(result)result.cleanupFailed=true;
      else throw new DiagnosticFailure('DEVICE_PRIVATE_FILE_CLEANUP_FAILED');
    }
  }
}
function validRead(result:Result,mode:ReadMode):boolean {
  if(!successful(result)||result.cleanupFailed)return false;
  const output=result.stdout.toString('utf8');
  if(mode==='redirect')return /^AM_RC=0\r?$/m.test(output)
    &&/^INSTRUMENTATION_CODE: -1\r?$/m.test(output)
    &&/^DEVICE_STDOUT_BYTES=\d+\r?$/m.test(output);
  if(result.transportPhase==='AM_TERMINAL'||!/^INSTRUMENTATION_CODE: -1\r?$/m.test(output))return false;
  if(mode==='summary')return /^INSTRUMENTATION_RESULT: hierarchyChars=\d+\r?$/m.test(output)
    &&/^INSTRUMENTATION_RESULT: rootCount=[1-9]\d*\r?$/m.test(output);
  const xml=output.match(/^INSTRUMENTATION_RESULT: hierarchy=(<hierarchy>[^\r\n]*<\/hierarchy>)\r?$/m)?.[1];
  if(!xml)return false;
  lastNodes=[...xml.matchAll(/<node\b([^>]*?)>/g)].map(match=>Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attr=>[attr[1],attr[2]])));
  return lastNodes.length>0;
}
function captureDefaultInfo():void {
  // Capture before a recovery command can affect the originally acquired log.
  if(!args['--adb-owner-state'])return;
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../android-mobile-terminal/safe-diagnostics.mts',import.meta.url)),
    '--source','adb-server','--state-file',args['--adb-owner-state'],'--file',join(work,'first-failure-adb-server.log')],
  {timeout:remaining(3000),maxBuffer:32768,stdio:['ignore','pipe','pipe']});
  // This existing helper emits only bounded allowlisted metadata, never raw logs.
  if(result.status===0&&result.stdout)process.stdout.write(result.stdout);
}
async function failedRead(result:Result,mode:ReadMode):Promise<never> {
  saveFirstFailure(result);
  emit('READ_FAILED',{mode,readNumber,...metadata(result),privateRawSaved:true});
  captureDefaultInfo();
  if(result.cleanupFailed)throw new DiagnosticFailure(successful(result)
    ?'DEVICE_PRIVATE_FILE_CLEANUP_FAILED':'TRANSPORT_READ_AND_CLEANUP_FAILED');
  const followDeadline=Math.min(deadline,Date.now()+35000);
  for(const opposite of modes.filter(value=>value!==mode)) {
    if(Date.now()+1000>=followDeadline)break;
    const ready=command(['wait-for-device'],Math.min(7000,followDeadline-Date.now()));
    emit('RECOVERY_DEVICE_STATUS',{ready:successful(ready),...metadata(ready)});
    if(!successful(ready)||Date.now()+12000>=followDeadline)break;
    const after=identity(followDeadline);
    if(!sameIdentity(after,'before-readonly-contrast'))break;
    // No tap, input, install, force-stop, restart, or primary action is repeated.
    const contrast=readCommand(opposite,followDeadline);
    const valid=validRead(contrast,opposite);
    emit('READONLY_CONTRAST',{mode:opposite,valid,...metadata(contrast),replayedAction:false});
    if(Date.now()+12000>=followDeadline)break;
    if(!sameIdentity(identity(followDeadline),'after-readonly-contrast'))break;
  }
  throw new DiagnosticFailure('TRANSPORT_READ_FAILED_NOT_PRODUCT_RESULT');
}
async function snapshot(mode:ReadMode):Promise<void> {
  readNumber++;
  const result=readCommand(mode);
  if(!validRead(result,mode))await failedRead(result,mode);
  const output=result.stdout.toString('utf8');
  emit('READ_OK',{mode,readNumber,...metadata(result),
    hierarchyChars:mode==='summary'?Number(output.match(/^INSTRUMENTATION_RESULT: hierarchyChars=(\d+)\r?$/m)?.[1]):null,
    rootCount:mode==='summary'?Number(output.match(/^INSTRUMENTATION_RESULT: rootCount=(\d+)\r?$/m)?.[1]):null,
    imeVisible:mode==='pulled-hierarchy'?lastNodes.some(node=>/inputmethod/.test(node.package??'')):null});
}
function passwordField():UiNode {
  const fields=lastNodes.filter(node=>node.package===pkg&&node.class==='android.widget.EditText'
    &&node.password==='true'&&node.enabled==='true'&&node['visible-to-user']==='true');
  requireDiagnostic(fields.length===1,'UNIQUE_VISIBLE_PASSWORD_FIELD_REQUIRED');
  return fields[0];
}
function action(commandArgs:string[]):void {
  const result=command(commandArgs,10000);
  if(!successful(result)) {
    emit('ACTION_FAILED',{...metadata(result),replayedAction:false});
    throw new DiagnosticFailure('UI_ACTION_FAILED_NO_REPLAY');
  }
}
try {
  anchor=identity();
  requireDiagnostic(anchor&&emulatorAlive(),'INITIAL_OWNED_IDENTITY_UNAVAILABLE');
  emit('IDENTITY',{label:'before-baseline',device:true,emulatorAlive:true,
    appPid:anchor.app,frameworkPid:anchor.framework,adbdPid:anchor.adbd||null});
  phase='BEFORE_INTERACTION';
  for(let i=0;i<6;i++)await snapshot(modes[i%3]);
  requireDiagnostic(sameIdentity(identity(),'after-baseline'),'IDENTITY_CHANGED');
  const field=passwordField();
  const bounds=field.bounds.match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/);
  requireDiagnostic(bounds,'PASSWORD_BOUNDS_UNAVAILABLE');
  const [left,top,right,bottom]=bounds.slice(1).map(Number);
  requireDiagnostic(left>=0&&top>=0&&right>left&&bottom>top,'PASSWORD_BOUNDS_NOT_VISIBLE');
  phase='IME_FOCUSED_EMPTY';
  action(['shell','input','tap',String(Math.floor((left+right)/2)),String(Math.floor((top+bottom)/2))]);
  await delay(400);
  await snapshot('pulled-hierarchy');
  requireDiagnostic(passwordField().focused==='true','PASSWORD_NOT_FOCUSED_NO_INPUT');
  for(let i=1;i<6;i++)await snapshot(modes[i%3]);
  phase='IME_SYNTHETIC_FILLED';
  action(['shell','input','text','local-test-only']);
  emit('SINGLE_SYNTHETIC_INPUT',{replayedAction:false});
  // Complete three-mode rounds in each state; no action is repeated.
  for(let i=0;i<18;i++)await snapshot(modes[i%3]);
  requireDiagnostic(sameIdentity(identity(),'after-ime'),'IDENTITY_CHANGED');
  phase='AFTER_SINGLE_IME_HIDE';
  action(['shell','input','keyevent','KEYCODE_BACK']);
  for(let i=0;i<6;i++)await snapshot(modes[i%3]);
  requireDiagnostic(sameIdentity(identity(),'after-hide'),'IDENTITY_CHANGED');
  emit('DIAGNOSTIC_NO_FAILURE_OBSERVED',{reads:readNumber,productPassed:false,fullG0Accepted:false});
}catch(error) {
  emit('DIAGNOSTIC_FAILED',{code:error instanceof DiagnosticFailure?error.code:'LOCAL_DIAGNOSTIC_ERROR',
    productPassed:false,fullG0Accepted:false});
  process.exitCode=1;
}
