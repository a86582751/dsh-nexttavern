/** Ordinary UI-only synthetic flow: no product HTTP, READY/token reads or JS evaluation; fixed approved PNG checkpoints only. */
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync,readFileSync,chmodSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {safeErrorTail,adbFailureKind} from './safe-diagnostics.mts';
import {PACED_STREAM_MARKER,PROTOCOL_FIXTURE_ID,EMBEDDING_FIXTURE_ID,EMBEDDING_FIXTURE_MODEL,EMBEDDING_FIXTURE_DIMENSIONS,EMBEDDING_QUERY} from '../../android/host/protocol-fixture.mts';

type Node = Record<string,string>;
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2) args[process.argv[i]]=process.argv[i+1];
const adb=args['--adb'], serial=args['--serial'], pkg=args['--package'];
const fixtureEvents=args['--fixture-events'];
let stage='arguments';
class UiFailure extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.code=code}
}
const emit=(status:string,extra:Record<string,unknown>={})=>console.log(JSON.stringify({
  kind:'nexttavern-mobile-first-ui',stage,status,...extra,
}));
function requireUi(value:unknown,code:string):asserts value {if(!value)throw new UiFailure(code)}
requireUi(adb && /^emulator-\d+$/.test(serial ?? '') && /^app\.nexttavern\.android(?:\.x86diagnostic)?(?:\.debug)?$/.test(pkg ?? ''),'EMULATOR_APP_ARGUMENTS_REQUIRED');
requireUi(Object.keys(args).every(key=>['--adb','--serial','--package','--phase','--work-dir','--fixture-events'].includes(key)),'UNKNOWN_ARGUMENT');
// Independent fresh UI scenarios share setup, not each other's pass/fail gates.
const memoryOnly=args['--phase']==='memory';
if(!memoryOnly&&args['--phase']!=='create') {emit('blocked',{code:'UNKNOWN_UI_PHASE',noDeviceActions:true});process.exit(2)}
requireUi(fixtureEvents && args['--work-dir'],'FIXTURE_EVENTS_AND_WORK_DIRECTORY_REQUIRED');
let adbFailureNumber=0;
function command(...commandArgs:string[]):string {return timedCommand(90000,...commandArgs)}
function timedCommand(timeout:number,...commandArgs:string[]):string {
  const startedAt=Date.now();
  try {return execFileSync(adb,['-s',serial,...commandArgs],{encoding:'utf8',timeout,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']})}
  catch(error) {
    const elapsedMs=Date.now()-startedAt;
    const failure=error as {status?:number|null;signal?:string|null;code?:string;stderr?:string|Buffer;stdout?:string|Buffer};
    const stderr=String(failure.stderr??'');
    let privateStderrSaved=false,privateLogErrorCode:string|null=null;
    try {
      mkdirSync(args['--work-dir'],{recursive:true});
      writeFileSync(join(args['--work-dir'],`adb-failure-${++adbFailureNumber}.stderr`),stderr,{mode:0o600,flag:'wx'});
      writeFileSync(join(args['--work-dir'],`adb-failure-${adbFailureNumber}.stdout`),String(failure.stdout??''),{mode:0o600,flag:'wx'});
      privateStderrSaved=true;
    }catch(logError){privateLogErrorCode=(logError as {code?:string}).code??'LOG_WRITE_FAILED'}
    // Do not print Error.message or argv: input commands can contain credentials.
    const safe=safeErrorTail(stderr);
    const operation=commandArgs[0]==='shell'
      ?commandArgs.length===2||commandArgs[1]==='sh'?'shell-script'
        :'shell-'+(['am','input','pidof','cat','getprop','dumpsys'].includes(commandArgs[1])?commandArgs[1]:'other')
      :['pull','get-state','wait-for-device','exec-out'].includes(commandArgs[0])?commandArgs[0]:'other';
    emit('observed',{interaction:'adb-command-failure',operation,elapsedMs,timeoutMs:timeout,
      ...waitReceipt(),
      exit:failure.status??null,signal:failure.signal??null,errorCode:failure.code??null,
      classification:adbFailureKind(stderr),stderrTail:safe,privateStderrSaved,privateLogErrorCode,
      instrumentationFailure:commandArgs[0]==='shell'&&commandArgs[1]==='am'&&commandArgs[2]==='instrument'
        ?String(failure.stdout??'').split(/\r?\n/).filter(line=>/^INSTRUMENTATION_(?:FAILED|ABORTED):/.test(line))
          .slice(-2).map(line=>safeErrorTail(line)):[]});
    throw new UiFailure('ADB_COMMAND_FAILED');
  }
}
const decode=(value:string)=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex,decimal)=>String.fromCodePoint(parseInt(hex??decimal,hex?16:10))).replace(/&amp;/g,'&');
let current:Node[]=[];
let imeWindow={visible:false,count:0,bounds:""};
const cleanupReserveMs=3000;
type WaitContext={condition:string;budgetMs:number;startedAt:number;startReads:number};
let waitContext:WaitContext|null=null,successfulSnapshotCount=0;
let lastSuccessfulSnapshot:{at:number;metadata:Record<string,unknown>}|undefined;
function waitReceipt() {
  return {waitCondition:waitContext?.condition??null,waitBudgetMs:waitContext?.budgetMs??null,
    waitElapsedMs:waitContext?Date.now()-waitContext.startedAt:null,
    successfulReadsInWait:waitContext?successfulSnapshotCount-waitContext.startReads:null};
}
function rememberSnapshot():void {
  successfulSnapshotCount++;
  const base={successfulSnapshotCount,waitCondition:waitContext?.condition??null};
  if(stage!=='fixture-main-and-worker-model-routing') {
    lastSuccessfulSnapshot={at:Date.now(),metadata:base};return;
  }
  const app=current.filter(node=>node.package===pkg);
  const save=app.filter(node=>named(node,['保存模型路由','保存中…']));
  const selector=app.filter(node=>named(node,['当前对话主模型']));
  lastSuccessfulSnapshot={at:Date.now(),metadata:{...base,appNodeCount:app.length,
    modelsPanelPresent:app.some(node=>named(node,['模型路由'])),
    dialogPresent:app.some(node=>node.class==='android.app.Dialog'),
    savePresent:save.length>0,saveEnabled:save.some(node=>node.enabled!=='false'),
    saving:save.some(node=>node.text==='保存中…'||node['content-desc']==='保存中…'),
    allMainChecked:app.some(node=>named(node,['全部使用主模型（保留用途配置）'])&&node.checked==='true'),
    saveToast:app.some(node=>node.text?.startsWith('模型保存失败，草稿已保留：'))?'FAILURE'
      :app.some(node=>node.text==='模型设置已保存')?'SUCCESS':'NONE',
    mainSelectors:selector.slice(0,6).map(node=>({
      class:/^(?:android|androidx|org\.chromium)\.[A-Za-z0-9_.$]{1,120}$/.test(node.class??'')?node.class:'OTHER',
      matchSources:['text','content-desc','hint'].filter(key=>node[key]==='当前对话主模型'),
      fixtureInText:node.text?.includes(fixtureId)??false,
      fixtureInDescription:node['content-desc']?.includes(fixtureId)??false,
      fixtureInSelectedDescendant:app.some(child=>child.selected==='true'
        &&[child.text,child['content-desc']].some(value=>value?.includes(fixtureId))&&ancestors(child).includes(node)),
    })),
  }};
}
function lastSnapshotReceipt() {
  return lastSuccessfulSnapshot?{ageMs:Date.now()-lastSuccessfulSnapshot.at,...lastSuccessfulSnapshot.metadata}:null;
}
function exhaustedReaderBudget(error:unknown,deadline:number):boolean {
  return error instanceof UiFailure&&['ACCESSIBILITY_READ_DEADLINE','ADB_COMMAND_FAILED','ADB_RECONNECT_DEADLINE'].includes(error.code)
    &&Date.now()+cleanupReserveMs>=deadline;
}
type DeviceIdentity={boot:string;framework:string;app:string;adbd:string|null};
let snapshotIdentity:DeviceIdentity|undefined,snapshotTransportRecoveries=0;
function readerTimeout(deadline:number,cap=90000):number {
  const remaining=deadline-Date.now();requireUi(remaining>0,'ACCESSIBILITY_READ_DEADLINE');
  return Math.min(cap,remaining);
}
function deviceIdentity(deadline=Date.now()+90000):DeviceIdentity {
  const read=(...args:string[])=>timedCommand(readerTimeout(deadline),...args);
  let adbd:string|null=null;
  try {
    const value=execFileSync(adb,['-s',serial,'shell','pidof','adbd'],{encoding:'utf8',timeout:readerTimeout(deadline,5000),stdio:'pipe'}).trim();
    if(/^\d+$/.test(value))adbd=value;
  }catch {/* Optional daemon diagnostic cannot block valid product identity. */}
  const identity={adbd,boot:read('shell','cat','/proc/sys/kernel/random/boot_id').trim(),
    framework:read('shell','pidof','system_server').trim(),app:read('shell','pidof',pkg).trim()};
  requireUi(/^[0-9a-f-]{36}$/.test(identity.boot)&&/^\d+$/.test(identity.framework)&&/^\d+$/.test(identity.app),
    'ANDROID_PROCESS_IDENTITY_UNAVAILABLE');
  return identity;
}
function hierarchyOutput(deadline:number):string {
  let pendingRemote:string|undefined;
  const read=()=>{
    // The full shell stdout stream disconnects during IME reads on the same
    // live VM. Keep the original helper/output, but transfer its private file.
    const id=randomUUID(),remote='/data/local/tmp/nexttavern-ui-'+id+'.stdout';
    const local=join(args['--work-dir'],'hierarchy-'+id+'.stdout'),readDeadline=deadline-cleanupReserveMs;
    let localCreated=false,readCompleted=false;
    pendingRemote=remote;
    try {
      const script=`umask 077; set -C; : > "${remote}" || exit 91; `
        + `am instrument -w -r app.nexttavern.qa.ui/.HierarchyInstrumentation >> "${remote}" 2>&1; rc=$?; `
        + `grep -E "^INSTRUMENTATION_CODE: -?[0-9]{1,6}$" "${remote}" | tail -n 1; `
        + `printf "AM_RC=%s\\n" "$rc"; exit "$rc"`;
      timedCommand(readerTimeout(readDeadline),'shell',script);
      mkdirSync(args['--work-dir'],{recursive:true,mode:0o700});
      writeFileSync(local,'',{mode:0o600,flag:'wx'});localCreated=true;
      timedCommand(readerTimeout(readDeadline),'pull',remote,local);
      chmodSync(local,0o600);
      // Canceled/error results (including ROOTS_NOT_READY) must still reach
      // the existing parser, not become successful reads or transport retries.
      const output=readFileSync(local,'utf8');readCompleted=true;return output;
    } finally {
      // Failed adb pull can remove its destination itself.
      if(localCreated)rmSync(local,{force:true});
      try {
        execFileSync(adb,['-s',serial,'shell','rm','-f',remote],{
          timeout:readerTimeout(deadline,3000),stdio:'pipe',
        });
        pendingRemote=undefined;
      } catch {
        // Keep this exact path until the existing same-identity reconnect can
        // clean it. Never replace an earlier read failure with cleanup failure.
        emit('observed',{interaction:'readonly-reader-private-cleanup-deferred',replayedUserAction:false});
        if(readCompleted)throw new UiFailure('ADB_COMMAND_FAILED');
      }
    }
  };
  for(let reconnects=0;;) {
    requireUi(Date.now()+cleanupReserveMs<deadline,'ACCESSIBILITY_READ_DEADLINE');
    try {
      if(pendingRemote) {
        timedCommand(readerTimeout(deadline),'shell','rm','-f',pendingRemote);
        pendingRemote=undefined;
      }
      return read();
    }catch(error) {
      // Read-only transport bursts have recovered on the same VM/app. All
      // attempts share the caller's original deadline; no user action is replayed.
      if(!(error instanceof UiFailure)||error.code!=='ADB_COMMAND_FAILED'||!snapshotIdentity||reconnects===3)throw error;
      requireUi(Date.now()+cleanupReserveMs<deadline,'ACCESSIBILITY_READ_DEADLINE');
      reconnects++;snapshotTransportRecoveries++;
      try {execFileSync(adb,['-s',serial,'wait-for-device'],{timeout:readerTimeout(deadline,15000),stdio:'pipe'})}
      catch {throw new UiFailure('ADB_RECONNECT_DEADLINE')}
      const after=deviceIdentity(deadline),sameBoot=after.boot===snapshotIdentity.boot,
        sameFramework=after.framework===snapshotIdentity.framework,sameApp=after.app===snapshotIdentity.app;
      emit('observed',{interaction:'readonly-reader-transport-recovery',sameBoot,sameFramework,sameApp,
        reconnectsForThisRead:reconnects,maxReconnects:3,totalReaderRecoveries:snapshotTransportRecoveries,
        adbdBefore:snapshotIdentity.adbd,adbdAfter:after.adbd,replayedUserAction:false});
      requireUi(sameBoot&&sameFramework&&sameApp,'ANDROID_PROCESS_RESTART_DURING_READER');
      snapshotIdentity=after;
    }
  }
}
function snapshot(deadline:number):Node[] {
  const next:Node[]=[];
  // Public UiAutomation preserves Chromium's hint text; capture privately.
  const output=hierarchyOutput(deadline);
  const records=[...output.matchAll(/^INSTRUMENTATION_RESULT: hierarchy=([^\r\n]*)\r?$/gm)];
  if(!/^INSTRUMENTATION_CODE: -1\r?$/m.test(output)||records.length!==1) {
    emit('observed',{interaction:'accessibility-reader-failure',hierarchyRecordCount:records.length,
      instrumentationCode:output.match(/^INSTRUMENTATION_CODE: (-?\d+)\r?$/m)?.[1]??null,
      readerError:output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]+)\r?$/m)?.[1]??null,
      readerException:output.match(/^INSTRUMENTATION_RESULT: exception=([A-Za-z]+)\r?$/m)?.[1]??null});
    const readerError=output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]+)\r?$/m)?.[1];
    throw new UiFailure(readerError==='ROOTS_NOT_READY'?'ACCESSIBILITY_ROOTS_NOT_READY':'ACCESSIBILITY_DUMP_UNAVAILABLE');
  }
  const imeVisible=output.match(/^INSTRUMENTATION_RESULT: imeVisible=(true|false)\r?$/m)?.[1];
  const imeCount=output.match(/^INSTRUMENTATION_RESULT: imeWindowCount=(\d+)\r?$/m)?.[1];
  const imeBounds=output.match(/^INSTRUMENTATION_RESULT: imeBounds=([^\r\n]*)\r?$/m)?.[1];
  requireUi(imeVisible!==undefined&&imeCount!==undefined&&imeBounds!==undefined,'IME_WINDOW_METADATA_MISSING');
  imeWindow={visible:imeVisible==='true',count:Number(imeCount),bounds:imeBounds};
  const xml=records[0][1];
  requireUi(xml.startsWith('<hierarchy>')&&xml.endsWith('</hierarchy>'),'ACCESSIBILITY_DUMP_UNAVAILABLE');
  const parents:number[]=[];
  for(const match of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if(match[0]==='</node>') {parents.pop();continue;}
    const node:Node=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(item=>[item[1],decode(item[2])]));
    node.__parent=String(parents.at(-1)??-1);
    const index=next.push(node)-1;
    if(match[2]!=='/')parents.push(index);
  }
  current=next;
  rememberSnapshot();
  return current;
}
function ancestors(node:Node):Node[] {
  const result:Node[]=[];
  while(Number(node.__parent)>=0) {
    node=current[Number(node.__parent)];result.push(node);
  }
  return result;
}
const redact=(text:string)=>text.replace(/(?:https?|wss?):\/\/[^\s"<>]+/gi,'[URL]')
  .replace(/(?:token|cookie|authorization|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,'[REDACTED]')
  .replaceAll('local-test-only','[SYNTHETIC_KEY]')
  .replace(/[A-Za-z0-9_\-+/=]{48,}/g,'[LONG_VALUE]').slice(0,140);
function labels():void {
  // Only the synthetic app and its task-owned DocumentsUI selection; no raw XML, URLs or EditText values.
  const unique=new Set<string>();
  const rows:Record<string,string>[]=[];
  let chars=0;
  for(const node of current) {
    if((node.package!==pkg && !(stage==='saf-card-selection' && docs(node))) || node.class==='android.widget.EditText')continue;
    const text=redact([node['content-desc'],node.text].filter(Boolean).join(' | '));
    if(!text || unique.has(text))continue;
    unique.add(text);chars+=text.length;
    if(rows.length===60||chars>5000)break;
    rows.push({label:text,class:node.class,bounds:node.bounds,enabled:node.enabled});
  }
  emit('observed',{accessibleLabels:rows});
}
function bounds(node:Node):number[]|null {
  const numbers=node.bounds?.match(/-?\d+/g)?.map(Number);
  if(!numbers || numbers.length!==4 || numbers[0]<0 || numbers[1]<0 || numbers[2]<=numbers[0] || numbers[3]<=numbers[1])return null;
  return numbers;
}
function visibleBounds(node:Node):number[]|null {
  if(node['visible-to-user']!=='true')return null;
  let box=bounds(node);if(!box)return null;
  for(const parent of ancestors(node)) {
    const clip=bounds(parent);if(!clip)continue;
    box=[Math.max(box[0],clip[0]),Math.max(box[1],clip[1]),Math.min(box[2],clip[2]),Math.min(box[3],clip[3])];
    if(box[2]<=box[0] || box[3]<=box[1])return null;
  }
  return box;
}
function matches(names:string[],interactive=false):Node[] {
  return current.filter(node=>names.some(name=>node.text===name||node['content-desc']===name)
    && node.enabled!=='false' && bounds(node)
    && (!interactive||node.clickable==='true'||node.class==='android.widget.Button'));
}
function tapNode(node:Node):void {
  const box=visibleBounds(node);requireUi(box,'NO_VISIBLE_TARGET_BOUNDS');
  command('shell','input','tap',String(Math.round((box[0]+box[2])/2)),String(Math.round((box[1]+box[3])/2)));
}
function tap(names:string[]):void {
  const found=matches(names,true);requireUi(found.length===1,found.length?'AMBIGUOUS_UI_TARGET':'UI_TARGET_NOT_EXPOSED');tapNode(found[0]);
}
const has=(names:string[])=>current.some(node=>names.some(name=>node.text===name||node['content-desc']===name));
function allowNotifications():void {
  const candidates=matches(['Allow','允许'],true).filter(node=>/permissioncontroller/.test(node.package));
  if(candidates.length===1)tapNode(candidates[0]);
}
// Window transitions may temporarily expose no active accessibility root.
// One shared read-only rule serves timed predicates and standalone reads.
function observeSnapshot(deadline:number):boolean {
  try {snapshot(deadline);return true}catch(error) {
    if(!(error instanceof UiFailure)||error.code!=='ACCESSIBILITY_ROOTS_NOT_READY')throw error;
    const after=deviceIdentity(deadline);
    requireUi(snapshotIdentity&&after.boot===snapshotIdentity.boot
      &&after.framework===snapshotIdentity.framework&&after.app===snapshotIdentity.app,
      'ANDROID_PROCESS_RESTART_DURING_READER');
    emit('observed',{interaction:'readonly-root-pending',sameProcessIdentity:true,...waitReceipt()});
    return false;
  }
}
async function readySnapshot():Promise<void> {
  const previous=waitContext,end=Date.now()+15000;
  waitContext=previous??{condition:'ACCESSIBILITY_ROOTS_NOT_READY',budgetMs:15000,
    startedAt:Date.now(),startReads:successfulSnapshotCount};
  while(Date.now()+cleanupReserveMs<end) {
    try {if(observeSnapshot(end)){waitContext=previous;return}}
    catch(error){if(exhaustedReaderBudget(error,end))break;throw error}
    await delay(Math.max(0,Math.min(3000,end-Date.now()-cleanupReserveMs)));
  }
  throw new UiFailure('ACCESSIBILITY_ROOTS_NOT_READY');
}
async function until(predicate:()=>boolean,seconds:number,code:string):Promise<void> {
  const previous=waitContext,end=Date.now()+seconds*1000;
  waitContext={condition:code,budgetMs:seconds*1000,startedAt:Date.now(),startReads:successfulSnapshotCount};
  while(Date.now()+cleanupReserveMs<end) {
    let observed=false;
    try {observed=observeSnapshot(end)}catch(error){if(exhaustedReaderBudget(error,end))break;throw error}
    if(!observed){await delay(Math.max(0,Math.min(3000,end-Date.now()-cleanupReserveMs)));continue;}
    allowNotifications();
    if(current.some(node=>node.package===pkg&&node.text?.startsWith('本地服务未能运行')))throw new UiFailure('NATIVE_RUNTIME_ERROR_VISIBLE');
    if(predicate()){waitContext=previous;return}
    await delay(Math.max(0,Math.min(3000,end-Date.now()-cleanupReserveMs)));
  }
  throw new UiFailure(code);
}
const ready=['本地服务运行中'];
const settings=['设置','Settings'];
const sidebar=['打开侧边栏','Open sidebar'];
const webChrome=[...settings,...sidebar,'新建会话','New session'];
const addProvider=['添加模型提供商','Add model provider'];
const onboardingTouches=new Map<string,{geometry:string;taps:number;tapGeometry?:string;dismissed?:boolean}>();
const onboardingSwipes=new Map<string,number>();
function interactOnboarding(step:string,names:string[]):void {
  const actions=current.filter(node=>node.package===pkg && node.class==='android.widget.Button'
    && names.some(name=>node.text===name||node['content-desc']===name) && node.enabled!=='false');
  if(actions.length!==1)return;
  // Android can expose both native and document WebView nodes. Ownership
  // comes from this button's actual modal/document ancestry, not global counts.
  const owner=ancestors(actions[0]).find(node=>node.package===pkg && node.class==='android.app.Dialog' && bounds(node));
  const document=owner && ancestors(owner).find(node=>node.package===pkg && node.class==='android.webkit.WebView' && bounds(node));
  if(!owner || !document) {
    const regions=current.filter(node=>node.package===pkg && ['android.app.Dialog','android.webkit.WebView'].includes(node.class));
    emit('observed',{interaction:'onboarding-region-missing',regionCount:regions.length,
      regions:regions.slice(0,16).map(node=>({class:node.class,bounds:node.bounds,scrollable:node.scrollable,
        parentClass:current[Number(node.__parent)]?.class??null}))});
  }
  requireUi(owner && document,'ONBOARDING_SCROLL_REGION_NOT_EXPOSED');
  const dialog=bounds(owner)!,view=bounds(document)!;
  const box=[Math.max(dialog[0],view[0]),Math.max(dialog[1],view[1]),Math.min(dialog[2],view[2]),Math.min(dialog[3],view[3])];
  requireUi(box[2]>box[0] && box[3]>box[1],'ONBOARDING_SCROLL_REGION_NOT_VISIBLE');
  const action=bounds(actions[0]);
  const geometry=JSON.stringify({dialog,view,action});
  let touch=onboardingTouches.get(step);
  if(!touch || touch.geometry!==geometry) {
    if(!touch) {touch={geometry,taps:0};onboardingTouches.set(step,touch)}
    else touch.geometry=geometry;
    // Autofocus can resize the WebView for the IME after the modal appears.
    // Require the actual geometry to survive a second observation, not a sleep.
    emit('observed',{interaction:'onboarding-geometry',step,dialog,view,action,
      imeExposed:current.some(node=>/\.inputmethod\./.test(node.package))});
    return;
  }
  if(touch.tapGeometry && (geometry===touch.tapGeometry || step!=='key' || touch.taps>=2))return;
  if(action) {
    // Chromium may report positive text/button bounds beyond the modal clip.
    // Only touch the action's actually visible intersection, never its mask.
    const visible=[Math.max(box[0],action[0]),Math.max(box[1],action[1]),Math.min(box[2],action[2]),Math.min(box[3],action[3])];
    if(visible[2]>visible[0] && visible[3]>visible[1]) {
      emit('observed',{interaction:'onboarding-dismissal-touch',step,attempt:touch.taps+1,
        action:step==='key'?'configure-later':'continue',target:visible,dialog,view,
        imeExposed:current.some(node=>/\.inputmethod\./.test(node.package))});
      command('shell','input','tap',String(Math.round((visible[0]+visible[2])/2)),String(Math.round((visible[1]+visible[3])/2)));
      touch.taps++;touch.tapGeometry=geometry;return;
    }
  }
  const count=onboardingSwipes.get(step)??0;
  requireUi(count<3,'ONBOARDING_ACTION_NOT_VISIBLE_AFTER_SCROLL');
  // The pinned Host onboarding content has overflow-y:auto. Use a real touch
  // gesture inside its visible dialog, then require new visible action bounds.
  const x=Math.round((box[0]+box[2])/2),height=box[3]-box[1];
  command('shell','input','swipe',String(x),String(Math.round(box[1]+height*.8)),
    String(x),String(Math.round(box[1]+height*.2)),'450');
  onboardingSwipes.set(step,count+1);emit('observed',{interaction:'onboarding-scroll',step,attempt:count+1});
}
function onboarding():boolean {
  const steps=[{step:'notice',titles:['内测声明','Internal Testing Notice'],actions:['继续','Continue']},
    {step:'key',titles:['添加一个 API Key 开始使用','Add an API key to get started'],actions:['稍后配置','Configure later']}];
  for(const item of steps) {
    const touch=onboardingTouches.get(item.step);
    if(!has(item.titles) && touch?.taps && !touch.dismissed) {
      touch.dismissed=true;emit('observed',{interaction:'onboarding-dismissed',step:item.step});
    }
  }
  for(const item of steps)if(has(item.titles)) {
    interactOnboarding(item.step,item.actions);return true;
  }
  return false;
}

let emptyProviderCaptured=false;
let providerKeyInputStarted=false;
function captureApprovedScreenshot(name:'empty-provider'|'model-routing'|'model-routing-after'|'synthetic-chat',replaceEmpty=false):Buffer|undefined {
  if(name==='empty-provider') {
    requireUi(!providerKeyInputStarted,'CREDENTIAL_FORM_SCREENSHOT_FORBIDDEN');
    if(emptyProviderCaptured&&!replaceEmpty)return;
  }
  if(name==='model-routing'||name==='model-routing-after') {
    requireUi(stage==='fixture-main-and-worker-model-routing'&&has(['模型路由'])
      &&!current.some(node=>node.package===pkg&&node.password==='true'),'MODEL_ROUTING_SCREENSHOT_NOT_SAFE');
  }
  const directory=process.env.NEXTTAVERN_UI_EVIDENCE_DIR;
  if(!directory)return;
  // Approved synthetic setup (empty provider form or credential-free model
  // routing) shares one artifact slot; the other holds the revealed control, later
  // replaced by the verified synthetic conversation.
  // Never capture credential-filled editors or retain a third image.
  mkdirSync(directory,{recursive:true});
  const png=execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{
    timeout:90000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe'],
  });
  // Reuse the first approved artifact slot; never retain a third image.
  const filename=name==='empty-provider'||name==='model-routing'?'empty-provider':'ui-state';
  writeFileSync(join(directory,filename+'.png'),png,{flag:name!=='empty-provider'||replaceEmpty?'w':'wx'});
  if(name==='empty-provider')emptyProviderCaptured=true;
  emit('observed',{syntheticScreenshot:name});
  return png;
}
const fixtureId='nexttavern-fixture';
const fixtureModelNames=['模型 ID 1','Model ID 1'];
const named=(node:Node,names:string[])=>names.some(name=>node.text===name||node['content-desc']===name||node.hint===name);
const button=(node:Node)=>node.clickable==='true'||node.class==='android.widget.Button';
/** These observed panel controls use standard accessibility interactions. Real
 * screenshots and a TYPE_VIEW_SCROLLED event proved the panel scrolls, while
 * this WebView reports stale screen bounds. Acceptance still requires the
 * caller's actual model-switch and persisted-settings results. */
async function semanticPanelControl(names:string[],kind:(node:Node)=>boolean=button):Promise<Node> {
  await readySnapshot();
  const found=current.filter(node=>node.package===pkg&&named(node,names)&&kind(node)&&node.enabled!=='false');
  requireUi(found.length===1,'MODEL_CONTROL_NOT_UNIQUE');
  showControl(found[0]);
  if(names.includes('切换当前对话主模型'))captureApprovedScreenshot('model-routing-after');
  return found[0];
}
/** Reveal an observed control using its public accessibility action. When only
 * a source label exists, retain the existing real scroll-owner gesture path. */
async function reveal(names:string[],kind:(node:Node)=>boolean=button,
  owner:(node:Node)=>boolean=node=>node.package===pkg,fieldLabel=false,sourceLabels=names):Promise<Node> {
  for(let attempt=0;;attempt++) {
    await readySnapshot();
    const found=current.filter(node=>owner(node)&&named(node,names)&&kind(node)&&node.enabled!=='false');
    const visible=found.filter(node=>visibleBounds(node));
    if(visible.length>1)emit('observed',{interaction:'ambiguous-named-control',target:names[0],
      candidates:visible.slice(0,8).map(node=>({class:node.class,bounds:visibleBounds(node),
        clickable:node.clickable,parentClass:current[Number(node.__parent)]?.class,
        textMatched:names.includes(node.text),descriptionMatched:names.includes(node['content-desc']),hintMatched:names.includes(node.hint)}))});
    requireUi(visible.length<=1,'NEXT_UI_TARGET_AMBIGUOUS');
    if(visible[0])return visible[0];
    requireUi(found.length<=1,'NEXT_UI_OFFSCREEN_TARGET_AMBIGUOUS');
    if(found[0]?.package===pkg) {
      showControl(found[0]); // One action; acceptance is not proof of scrolling.
      let revealed:Node|undefined;
      await until(()=>{
        const now=current.filter(node=>owner(node)&&named(node,names)&&kind(node)
          &&node.enabled!=='false'&&visibleBounds(node));
        requireUi(now.length<=1,'NEXT_UI_TARGET_AMBIGUOUS');
        revealed=now[0];return Boolean(revealed);
      },15,'ACCESSIBILITY_SHOW_NOT_OBSERVED');
      return revealed!;
    }
    // Chromium can omit an offscreen textbox while exposing its source label.
    // Scroll that label's real owner, but return only the actual input target.
    const labels=fieldLabel?current.filter(node=>owner(node)&&node.class==='android.widget.TextView'&&named(node,sourceLabels)):[];
    const visibleLabels=labels.filter(node=>visibleBounds(node));
    const target=found[0]??(visibleLabels.length===1?visibleLabels[0]:labels.length===1?labels[0]:undefined);
    if(!target)emit('observed',{interaction:'missing-named-control',target:names[0],
      matchingControls:current.filter(item=>owner(item)&&named(item,names)&&kind(item)).map(item=>({
        enabled:item.enabled,bounds:item.bounds,visible:item['visible-to-user']}))});
    requireUi(target,'NEXT_UI_TARGET_OR_FIELD_LABEL_NOT_EXPOSED');
    if(attempt===4&&fieldLabel)emit('observed',{interaction:'field-structure',field:names[0],
      inputs:current.filter(node=>node.package===pkg&&node.class==='android.widget.EditText').map(node=>({
        bounds:node.bounds,enabled:node.enabled,focused:node.focused,parentClass:current[Number(node.__parent)]?.class,
        sourceNameMatched:named(node,names),attributeNames:Object.keys(node).filter(key=>key!=='__parent'),
      }))}); // Attribute names/geometry only; never input values or raw aria text.
    requireUi(attempt<4,'NEXT_UI_TARGET_NOT_VISIBLE_AFTER_SCROLL');
    const scroll=ancestors(target).find(node=>node.scrollable==='true'&&visibleBounds(node));
    if(!scroll)emit('observed',{interaction:'missing-accessibility-scroll-owner',target:names[0],
      targetClass:target.class,targetBounds:target.bounds,
      ancestors:ancestors(target).slice(0,10).map(node=>({class:node.class,bounds:node.bounds,
        scrollable:node.scrollable,visible:node['visible-to-user']}))});
    requireUi(scroll,'NEXT_UI_SCROLL_ANCESTOR_NOT_EXPOSED');
    const box=visibleBounds(scroll)!,targetBox=bounds(target);
    const reverse=targetBox!==null&&targetBox[3]<=box[1];
    const x=Math.round((box[0]+box[2])/2),height=box[3]-box[1];
    command('shell','input','swipe',String(x),String(Math.round(box[1]+height*(reverse ? .2 : .8))),
      String(x),String(Math.round(box[1]+height*(reverse ? .8 : .2))),'450');
    emit('observed',{interaction:'named-control-ancestor-scroll',attempt:attempt+1});
  }
}
async function press(names:string[],kind:(node:Node)=>boolean=button):Promise<void> {
  const semanticModel=stage==='fixture-main-and-worker-model-routing'
    &&names.some(name=>name==='切换当前对话主模型'||name==='保存模型路由');
  const semanticMemory=stage==='online-memory-provider'
    &&names.some(name=>['新增接入 / New provider','保存供应商','测试','用于剧情记忆','B 语义 / Semantic'].includes(name));
  if(semanticModel||semanticMemory) {
    controlAction(await semanticPanelControl(names,kind),'click-control');return;
  }
  tapNode(await reveal(names,kind));
}
async function replace(names:string[],value:string,sourceLabels=names):Promise<void> {
  emit('observed',{interaction:'edit-source-field',field:names[0]});
  await typeAscii(await reveal(names,node=>node.class==='android.widget.EditText',node=>node.package===pkg,true,sourceLabels),value,names[0]);
}
function showControl(node:Node):void {controlAction(node,'show-control')}
function controlAction(node:Node,operation:'show-control'|'click-control'):void {
  const quote=(text:string)=>"'"+text.replaceAll("'", "'\\''")+"'";
  const output=command('shell','am','instrument','-w','-r','-e','operation',operation,
    '-e','targetPackage',node.package,'-e','targetClass',quote(node.class),'-e','targetHint',quote(node.hint??''),
    '-e','targetDescription',quote(node['content-desc']??''),
    '-e','targetText',quote(node.class==='android.widget.EditText'?'':node.text??''),
    'app.nexttavern.qa.ui/.HierarchyInstrumentation');
  const accepted=/^INSTRUMENTATION_RESULT: accepted=true\r?$/m.test(output),
    supported=/^INSTRUMENTATION_RESULT: supported=true\r?$/m.test(output),
    count=output.match(/^INSTRUMENTATION_RESULT: matchCount=(\d+)\r?$/m)?.[1];
  emit('observed',{interaction:operation==='click-control'?'semantic-click-control':'semantic-show-control',targetClass:node.class,supported,accepted,
    matchCount:count===undefined?null:Number(count),
    helperError:output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]{1,80})\r?$/m)?.[1]??null});
  requireUi(/^INSTRUMENTATION_CODE: -1\r?$/m.test(output)&&supported&&accepted&&count==='1',
    operation==='click-control'?'ACCESSIBILITY_CLICK_NOT_ACCEPTED':'ACCESSIBILITY_SHOW_NOT_ACCEPTED');
}
function focusInput(node:Node):void {
  // Public accessibility focus targets the observed semantic node, not a
  // coordinate that IME resizing can move before Android dispatches the tap.
  const quote=(text:string)=>"'"+text.replaceAll("'", "'\\''")+"'";
  const output=command('shell','am','instrument','-w','-r','-e','operation','focus-input',
    '-e','targetPackage',pkg,'-e','targetHint',quote(node.hint??''),
    '-e','targetDescription',quote(node['content-desc']??''),'app.nexttavern.qa.ui/.HierarchyInstrumentation');
  const accepted=/^INSTRUMENTATION_RESULT: accepted=true\r?$/m.test(output),
    count=output.match(/^INSTRUMENTATION_RESULT: matchCount=(\d+)\r?$/m)?.[1];
  emit('observed',{interaction:'semantic-input-focus',accepted,matchCount:count===undefined?null:Number(count),
    helperError:output.match(/^INSTRUMENTATION_RESULT: error=([A-Z_]{1,80})\r?$/m)?.[1]??null});
  requireUi(/^INSTRUMENTATION_CODE: -1\r?$/m.test(output)&&accepted&&count==='1','ACCESSIBILITY_FOCUS_NOT_ACCEPTED');
}
async function typeAscii(node:Node,value:string,field='synthetic-composer'):Promise<void> {
  // Observe actual input focus after the public semantic focus request.
  // All values are fixed synthetic ASCII, but never emit input contents.
  const identity={hint:node.hint,description:node['content-desc'],class:node.class};
  const focused=()=>current.filter(item=>item.package===pkg&&item.class===identity.class&&item.focused==='true'
    &&item.hint===identity.hint&&item['content-desc']===identity.description);
  focusInput(node); // Never replay this action after an ADB failure.
  try {await until(()=>focused().length===1,10,'EXPECTED_FIELD_NOT_FOCUSED')}
  catch(error) {
    emit('observed',{interaction:'input-focus-state',field,
      inputs:current.filter(item=>item.package===pkg&&item.class==='android.widget.EditText').slice(0,20)
        .map(item=>({focused:item.focused,enabled:item.enabled,bounds:item.bounds,visible:visibleBounds(item)!==null,
          requestedHint:item.hint===identity.hint,requestedDescription:item['content-desc']===identity.description}))});
    throw error;
  }
  command('shell','input','keycombination','113','29'); // API35 Ctrl+A.
  command('shell','input','keyevent','KEYCODE_DEL');
  command('shell','input','text',value.replaceAll(' ','%s'));
  await readySnapshot();
  const found=focused();
  requireUi(found.length===1,'EXPECTED_FIELD_FOCUS_LOST');
  const actual=found[0].text??'',password=found[0].password==='true';
  const matchesExpected=password?actual.length===value.length:actual===value;
  emit('observed',{interaction:'input-readback',field,password,matchesExpected,
    expectedLength:value.length,observedLength:actual.length,
    ...(!password?{firstDifference:[...value].findIndex((char,index)=>actual[index]!==char),
      asciiLowercaseRoute:/^[a-z][a-z0-9-]*$/.test(actual)}:{})});
  requireUi(matchesExpected,'SYNTHETIC_INPUT_READBACK_MISMATCH');
  await dismissIme();
}
async function dismissIme():Promise<void> {
  // Observe actual public IME window geometry, not a clipped accessibility node.
  await readySnapshot();
  if(imeWindow.visible) {
    emit('observed',{interaction:'ime-window-dismiss',...imeWindow});
    command('shell','input','keyevent','KEYCODE_BACK');
    // Window disappearance is the actual completion. Each following UI action
    // already reads its target; a second identical geometry read adds no contract.
    await until(()=>!imeWindow.visible,30,'IME_WINDOW_NOT_DISMISSED');
  }
}

/** Entry condition: the preceding actual first-stage has exposed Add provider.
 * Fresh synthetic installation only: no overwrite of a previously saved route. */
async function configureFixtureProvider():Promise<void> {
  stage='create-fixture-provider';await readySnapshot();
  requireUi(!has(['编辑 '+fixtureId,'Edit '+fixtureId]),'FIXTURE_PROVIDER_ALREADY_PRESENT');
  await press(['添加模型提供商','Add model provider']);
  await until(()=>has(['自定义模型 API','Custom model API']),30,'CUSTOM_PROVIDER_MODE_NOT_EXPOSED');
  await press(['自定义模型 API','Custom model API']);
  await until(()=>has(['Provider ID']),30,'CUSTOM_PROVIDER_FORM_LABEL_NOT_EXPOSED');
  captureApprovedScreenshot('empty-provider');
  // Chromium 124 GetHint joins accessible name, placeholder and description with spaces.
  // Exact pinned hints avoid guessing unnamed fields or matching prefix collisions.
  await replace(['Provider ID','Provider ID acme-gateway'],fixtureId,['Provider ID']);
  await replace(['API 地址','Base URL','API 地址 https://gateway.example/v1','Base URL https://gateway.example/v1'],'http://10.0.2.2:18765/v1',['API 地址','Base URL']);
  // Never assume the schema's first protocol is the intended one.
  tapNode(await reveal(['API 协议','API protocol'],node=>node.class==='android.widget.Spinner'||button(node),
    node=>node.package===pkg,true));
  const protocolOption=(node:Node)=>node.class==='android.widget.CheckedTextView'||node.class==='android.widget.RadioButton';
  await until(()=>current.some(node=>named(node,['OpenAI Chat Completions'])&&protocolOption(node)),30,'OPENAI_COMPLETIONS_OPTION_NOT_EXPOSED');
  await press(['OpenAI Chat Completions'],protocolOption);
  providerKeyInputStarted=true;
  await replace(['API 密钥','API key','API 密钥 输入 API 密钥','API key Enter your API key'],'local-test-only',['API 密钥','API key']);
  await press(['添加模型','Add model']);
  await replace([...fixtureModelNames,'模型 ID 1 模型 ID','Model ID 1 Model ID'],fixtureId);
  await press(['模型选项 1','Model options 1']);
  await replace(['上下文窗口 1','Context window 1','Context window 1 Uses the provider default','上下文窗口 1 使用提供商默认值'],'65536',['上下文窗口','Context window']);
  await replace(['最大输出 token 数 1','Max output tokens 1','Max output tokens 1 Uses the provider default','最大输出 token 数 1 使用提供商默认值'],'2048',['最大输出 token 数','Max output tokens']);
  await press(['创建提供商','Create provider']);
  await until(()=>has(['编辑 '+fixtureId,'Edit '+fixtureId])&&!has(['创建提供商','Create provider']),60,'FIXTURE_PROVIDER_SAVE_NOT_OBSERVED');
  emit('passed',{scope:'custom-provider-form-saved',syntheticProvider:true,liveModel:false});
}

const fileButton=['选择角色卡文件'];
const selectedFile=['角色卡文件已选择，等待确认导入'];
// Chromium exposes the file input as its label plus the current filename,
// separately from the label TextView (observed on the real Card import page).
const cardFileControl=(node:Node)=>node.package===pkg&&node.class==='android.widget.Button'
  &&[node.text,node['content-desc']].some(value=>value==='选择角色卡文件'||value?.startsWith('选择角色卡文件: '));
async function openCardFilePicker():Promise<void> {
  await readySnapshot();const controls=current.filter(cardFileControl);
  requireUi(controls.length===1&&controls[0].enabled!=='false','CARD_FILE_CONTROL_NOT_UNIQUE');
  showControl(controls[0]);controlAction(controls[0],'click-control');
  // The caller requires actual system DocumentsUI, not an accepted action or
  // WebView's already-proven unreliable post-scroll screen bounds.
}

const docs=(node:Node)=>/^(?:com\.android|com\.google\.android)\.documentsui$/.test(node.package);
const activeWindow=(node:Node)=>node.__parent==='-1'&&(node['window-active']==='true'||node['window-focused']==='true');
/** Entry condition: an actual roleplay session's Card import page is exposed.
 * The runner owns this work-dir/emulator. Normal product SAF is the only route
 * into app storage; adb push only supplies a file to the device Downloads. */
async function selectSyntheticCard(workDir:string):Promise<void> {
  stage='saf-card-selection';await readySnapshot();
  requireUi(has(['上传角色卡'])&&has(fileButton),'ROLEPLAY_CARD_UPLOAD_PAGE_REQUIRED');
  requireUi(!has(['确认原导入任务'])&&!has(selectedFile),'FRESH_CARD_SELECTION_REQUIRED');
  mkdirSync(workDir,{recursive:true});
  const file=join(workDir,'nexttavern-ui-card.json');
  writeFileSync(file,JSON.stringify({spec:'chara_card_v2',spec_version:'2.0',data:{
    name:'旅人',description:'旅人是一位喜爱阅读的合成测试角色，随身携带蓝色书签。',
    personality:'温和、耐心。',scenario:'旅人与读者在安静的酒馆中整理一本书。',
    first_mes:'旅人把蓝色书签放在桌上：“欢迎回来，这是本地合成测试的开场。”',
    mes_example:'',creator_notes:'仅用于本次 Android 真实 UI 合成测试。',
    system_prompt:'',post_history_instructions:'',alternate_greetings:[],tags:['local-synthetic-test'],
    creator:'local-test',character_version:'1.0',extensions:{},
  }}));
  command('push',file,'/sdcard/Download/nexttavern-ui-card.json');
  await openCardFilePicker();
  await until(()=>current.some(node=>docs(node)&&activeWindow(node)),30,'SYSTEM_DOCUMENTS_UI_NOT_OPENED');
  command('shell','input','keyevent','KEYCODE_BACK'); // Genuine user cancellation.
  await until(()=>!current.some(docs)&&current.some(node=>node.package===pkg&&activeWindow(node)),
    30,'SAF_CANCEL_DID_NOT_RETURN_TO_APP');
  const cardPanelRetained=has(['上传角色卡'])&&has(fileButton);
  emit('observed',{interaction:'saf-cancel-return',appForeground:true,cardPanelRetained});
  if(!cardPanelRetained) {
    await openManager();await pressManagerTab(['角色卡导入']);
    await until(()=>has(['上传角色卡'])&&current.filter(cardFileControl).length===1,30,'CARD_UPLOAD_PAGE_NOT_EXPOSED');
  }
  requireUi(!has(selectedFile)&&!has(['确认原导入任务']),'SAF_CANCEL_UNEXPECTEDLY_SELECTED_FILE');
  await openCardFilePicker();
  await until(()=>current.some(node=>docs(node)&&activeWindow(node)),30,'SYSTEM_DOCUMENTS_UI_NOT_REOPENED');
  if(!current.some(node=>docs(node)&&named(node,['nexttavern-ui-card.json'])&&visibleBounds(node))) {
    const roots=current.filter(node=>docs(node)&&named(node,['Show roots','显示根目录'])&&visibleBounds(node));
    requireUi(roots.length===1,'DOCUMENTS_ROOT_DRAWER_NOT_EXPOSED');
    controlAction(roots[0],'click-control');
    await until(()=>current.some(node=>docs(node)&&named(node,['Downloads','下载'])),30,'DOCUMENTS_DOWNLOADS_NOT_EXPOSED');
    tapNode(await reveal(['Downloads','下载'],node=>node.class!=='android.widget.EditText',docs));
  }
  await until(()=>current.some(node=>docs(node)&&named(node,['nexttavern-ui-card.json'])),30,'SYNTHETIC_CARD_NOT_LISTED_IN_DOCUMENTS_UI');
  tapNode(await reveal(['nexttavern-ui-card.json'],node=>node.class!=='android.widget.EditText',docs));
  await until(()=>has(selectedFile)&&current.some(node=>node.package===pkg&&node.class==='android.webkit.WebView'),30,'SAF_SELECTED_FILE_NOT_RECEIVED_BY_WEBVIEW');
  emit('passed',{scope:'real-system-saf-cancel-reopen-selection',syntheticCard:true,import:'not-submitted'});
}

/** Normal upload, and at most one explicit confirmation of the retained ORIGINAL
 * import. UI does not expose request/job IDs: this cannot assert exact ID equality.
 * It never reselects/reuploads the card or clears the browser recovery journal. */
async function submitSelectedCard():Promise<void> {
  stage='upload-and-import-card';
  await press(['上传并导入']);
  const inDialog=(node:Node)=>button(node)&&ancestors(node).some(parent=>parent.class==='android.app.Dialog');
  await until(()=>has(['导入角色卡'])&&current.some(node=>named(node,['上传并导入'])&&inDialog(node)),30,'CARD_IMPORT_CONFIRMATION_NOT_EXPOSED');
  await press(['上传并导入'],inDialog);
  let recovered=false,recoveryConfirmed=false;
  await until(()=>{
    if(current.some(node=>node.package===pkg&&node.enabled!=='false'&&button(node)
      &&named(node,['使用此开场','用这个开场开始'])))return true;
    if(!recovered) {
      const recovery=current.filter(node=>node.package===pkg&&button(node)&&node.enabled!=='false'
        &&named(node,['确认原导入任务'])&&visibleBounds(node));
      if(recovery.length===1) {tapNode(recovery[0]);recovered=true;}
    } else if(!recoveryConfirmed) {
      const confirm=current.filter(node=>node.package===pkg&&node.enabled!=='false'
        &&named(node,['确认原导入任务'])&&inDialog(node)&&visibleBounds(node));
      if(confirm.length===1) {tapNode(confirm[0]);recoveryConfirmed=true;}
    }
    return false;
  },120,'IMPORTED_CARD_OPENING_NOT_READY');
  emit('passed',{scope:'saf-upload-import-opening-available',originalRecoveryRequested:recovered,
    exactJobIdEquality:'not-exposed-by-ui',openingSelection:'not-run',chat:'not-run'});
}

const fixtureOpening='旅人把蓝色书签放在桌上：“欢迎回来，这是本地合成测试的开场。”';
const fixturePrompt='Traveler keep the blue bookmark local protocol test.';
const fixtureReply='【本地协议测试，不是真实模型】酒馆的灯亮着。欢迎回来，我们的对话已经继续。';
let stableTitle='';
const menuOption=(node:Node)=>node.class==='android.widget.CheckedTextView'||node.class==='android.widget.RadioButton';
const mainRouteNames=['当前对话主模型'];
const inWebView=(node:Node)=>ancestors(node).some(parent=>parent.class==='android.webkit.WebView');
const dialogButton=(node:Node)=>button(node)&&ancestors(node).some(parent=>parent.class==='android.app.Dialog');
const visibleNamed=(names:string[],kind:(node:Node)=>boolean=button)=>current.filter(node=>
  node.package===pkg&&node.enabled!=='false'&&named(node,names)&&kind(node)&&visibleBounds(node));
async function closeWebDialog():Promise<void> {
  await press(['关闭','Close'],node=>dialogButton(node)&&inWebView(node));
}
async function showSidebar():Promise<void> {
  await readySnapshot();
  const open=visibleNamed(['打开侧边栏','Open sidebar']);
  if(open.length===1) {tapNode(open[0]);await until(()=>has(['收起侧边栏','Collapse sidebar']),30,'SIDEBAR_DID_NOT_OPEN');}
}
async function hideSidebar():Promise<void> {
  await readySnapshot();
  const close=visibleNamed(['收起侧边栏','Collapse sidebar']);
  if(close.length===1) {tapNode(close[0]);await until(()=>has(['打开侧边栏','Open sidebar']),30,'SIDEBAR_DID_NOT_COLLAPSE');}
}
async function openManager():Promise<void> {
  await showSidebar();
  // This is backed by the native session-list preset identity, not a guessed
  // label, a hidden REST probe, or enabling Coding Tools to unlock a seat.
  await until(()=>visibleNamed(['酒馆管理']).length===1,60,'DEFAULT_SESSION_NOT_ROLEPLAY_OR_ENTRY_NOT_EXPOSED');
  await press(['酒馆管理']);
  await until(()=>has(['角色卡导入'])&&has(['人物设定']),30,'TAVERN_MANAGER_NOT_EXPOSED');
}
/** Horizontally clipped tab bounds can be stale. Use the actual unique public
 * accessibility control; each caller requires its own panel-content result. */
async function pressManagerTab(names:string[]):Promise<void> {
  await readySnapshot();
  const found=current.filter(node=>node.package===pkg&&named(node,names)&&button(node)&&node.enabled!=='false');
  requireUi(found.length===1,'TAVERN_TAB_NOT_UNIQUELY_EXPOSED');
  showControl(found[0]);controlAction(found[0],'click-control');
}
/** Pinned SidebarRoot exposes both its brand and its labelled New Session
 * button with the same aria-label and the same startSession() handler. Choose
 * one actual visible semantic button, not a text descendant or an action retry. */
function newSessionTarget():Node {
  const candidates=current.filter(node=>node.package===pkg&&node.class==='android.widget.Button'
    &&named(node,['新建会话','New session'])&&node.enabled!=='false'&&inWebView(node)&&visibleBounds(node));
  requireUi(candidates.length>0,'NEW_SESSION_BUTTON_NOT_EXPOSED');
  candidates.sort((a,b)=>visibleBounds(a)![1]-visibleBounds(b)![1]||visibleBounds(a)![0]-visibleBounds(b)![0]);
  emit('observed',{interaction:'equivalent-sidebar-new-session-controls',visibleButtons:candidates.length,
    chosenBounds:visibleBounds(candidates[0]),sourceContract:'shared-startSession-handler'});
  return candidates[0];
}
/** Entry: saved provider directory in Host Settings. Fresh profile's ordinary
 * default Workspace and roleplay preset must be supplied by the actual product.
 * There is no Coding Tools preference or QA-only session creation workaround. */
async function prepareRoleplaySessionAndCardPage(openCardPage=true):Promise<void> {
  stage='ordinary-default-workspace-session';
  await closeWebDialog();
  await showSidebar();
  await readySnapshot();tapNode(newSessionTarget());
  await hideSidebar();
  await until(()=>visibleNamed(['选择工作区','Choose workspace']).length===1,60,'NEW_SESSION_WORKSPACE_CHIP_NOT_EXPOSED');
  await press(['选择工作区','Choose workspace']);
  await until(()=>visibleNamed(['默认工作区','Default workspace']).length===1,30,'OFFICIAL_DEFAULT_WORKSPACE_NOT_LISTED');
  await press(['默认工作区','Default workspace']);
  await openManager();
  stage='fixture-main-and-worker-model-routing';
  await pressManagerTab(['模型','Models']);
  await until(()=>has(['模型路由']),30,'MODEL_ROUTING_PAGE_NOT_EXPOSED');
  captureApprovedScreenshot('model-routing');
  await until(()=>visibleNamed(mainRouteNames,node=>node.class==='android.widget.Spinner'||button(node)).length===1,30,'TAVERN_MAIN_MODEL_SELECTOR_NOT_EXPOSED');
  await press(mainRouteNames,node=>node.class==='android.widget.Spinner'||button(node));
  // Source builds <label-or-model> · <provider> — <capability summary>.
  const routeOption=(node:Node)=>menuOption(node)&&node.text?.startsWith(fixtureId+' · '+fixtureId+' — ');
  await until(()=>current.filter(node=>node.package===pkg&&routeOption(node)&&visibleBounds(node)).length===1,30,'FIXTURE_ROUTE_OPTION_NOT_EXPOSED');
  tapNode(current.find(node=>node.package===pkg&&routeOption(node)&&visibleBounds(node))!);
  await press(['切换当前对话主模型']);
  await until(()=>current.some(node=>node.package===pkg&&node.text===
    '主模型已切换；不会自动发送或重发。若有失败输入，请按聊天中的恢复提示操作。'),60,'MAIN_MODEL_SWITCH_NOT_CONFIRMED');
  // Keep the ordinary default untouched. This WebView's AX checked bit is
  // demonstrably false for a checked box, and SHOW does not fix its geometry.
  // Worker routing remains a separate unqualified gate, not a chat prerequisite.
  emit('not-verified',{scope:'all-main-worker-route',reason:'unreliable-accessibility-state',
    defaultUntouched:true,automaticAcceptance:false});
  await press(['保存模型路由']);
  await until(()=>current.some(node=>node.package===pkg&&named(node,['保存模型路由'])
    &&button(node)&&node.enabled!=='false'),60,'WORKER_ROUTE_SAVE_NOT_SETTLED');
  emit('observed',{interaction:'model-route-checkpoint',checkpoint:'save-settled',lastSuccessfulSnapshot:lastSnapshotReceipt()});
  // Re-mount alone can reuse a dirty draft after failed Save. The existing
  // native reload discards that JS memory; only restored UI state counts.
  await press(['重载界面'],node=>button(node)&&!inWebView(node));
  await until(()=>!has(['模型路由'])&&has(webChrome),60,'MODEL_ROUTE_NATIVE_RELOAD_NOT_OBSERVED');
  emit('observed',{interaction:'model-route-checkpoint',checkpoint:'reloaded'});
  await openManager();await pressManagerTab(['模型','Models']);
  emit('observed',{interaction:'model-route-checkpoint',checkpoint:'retention'});
  await until(()=>current.some(node=>node.package===pkg&&node.text==='当前主模型：'+fixtureId)
    ,60,'FIXTURE_MAIN_ROUTE_NOT_RETAINED');
  emit('passed',{scope:'ordinary-roleplay-session-and-persisted-fixture-main-routing',workerRoutingVerified:false,liveModel:false});
  if(!openCardPage){await closeWebDialog();await hideSidebar();return;}
  await pressManagerTab(['角色卡导入']);
  stage='card-import-page';
  await until(()=>has(['上传角色卡'])&&current.filter(cardFileControl).length===1,30,'CARD_UPLOAD_PAGE_NOT_EXPOSED');
}

function visibleMessage(marker:string):Node|undefined {
  return current.find(node=>node.package===pkg&&node.class!=='android.webkit.WebView'
    &&node.class!=='android.widget.EditText'&&node.scrollable!=='true'
    &&[node.text,node['content-desc']].some(text=>text?.includes(marker))&&inWebView(node)&&visibleBounds(node));
}
/** One opening, one prompt. A missing response is a failure, never an automatic
 * replay; the fixed fixture is visibly labelled as not an actual model. */
async function chooseOpeningAndChat():Promise<void> {
  stage='original-opening-selection';await readySnapshot();
  requireUi(current.some(node=>node.package===pkg&&node.text?.includes('旅人把蓝色书签放在桌上')),'SYNTHETIC_OPENING_PREVIEW_NOT_EXPOSED');
  // Import completion exposes the opening below the fold. Readiness is not
  // screen geometry: use the actual unique control and require its write result.
  const opening=current.filter(node=>node.package===pkg&&button(node)&&node.enabled!=='false'
    &&named(node,['用这个开场开始','使用此开场']));
  requireUi(opening.length===1,'ORIGINAL_OPENING_CONTROL_NOT_UNIQUE');
  showControl(opening[0]);controlAction(opening[0],'click-control');
  await until(()=>current.some(node=>node.package===pkg&&(node.text==='开场与初始状态已确认。'
    ||/^已写入第 \d+ 回合$/.test(node.text??''))),60,'ORIGINAL_OPENING_NOT_COMMITTED');
  await closeWebDialog();await hideSidebar();
  await until(()=>Boolean(visibleMessage('旅人把蓝色书签放在桌上')),60,'ORIGINAL_OPENING_NOT_VISIBLE_IN_CONVERSATION');
  stage='one-synthetic-fixture-prompt';
  const composers=current.filter(node=>node.package===pkg&&node.class==='android.widget.EditText'
    &&node.enabled!=='false'&&inWebView(node)&&visibleBounds(node));
  requireUi(composers.length===1,'UNIQUE_VISIBLE_COMPOSER_NOT_EXPOSED');
  await typeAscii(composers[0],fixturePrompt);
  await press(['发送消息','Send message']);
  await until(()=>current.some(node=>node.package===pkg&&node.class!=='android.widget.EditText'
    &&node.text===fixturePrompt),30,'SYNTHETIC_USER_MESSAGE_NOT_SUBMITTED');
  await dismissIme(); // Observe the submitted row before handling Host autofocus.
  await until(()=>{
    requireUi(!current.some(node=>node.package===pkg&&node.text?.startsWith('This turn failed')),
      'SYNTHETIC_TURN_FAILED');
    requireUi(!current.some(node=>node.package===pkg&&node.text?.includes(
      '酒馆维护尚未完成，检查点已保留；可在酒馆管理中重试')),'SYNTHETIC_TURN_MAINTENANCE_FAILED');
    return Boolean(visibleMessage(fixtureReply))&&visibleNamed(['停止生成','Stop generating']).length===0;
  },180,'SYNTHETIC_ASSISTANT_REPLY_NOT_RENDERED');
  emit('passed',{scope:'one-native-opening-one-fixture-prompt-visible-reply',liveModel:false,
    incrementalRendering:'not-qualified-by-single-delta-fixture'});
}

async function rememberSyntheticConversation():Promise<void> {
  stage='remember-synthetic-conversation';await readySnapshot();
  // Capture the actual public document title of this fresh, single conversation.
  // Renaming through a hover-only sidebar menu is not a persistence prerequisite.
  const titles=new Set(current.filter(node=>node.package===pkg&&node.class==='android.webkit.WebView')
    .flatMap(node=>[node.text,node['content-desc']]).filter(value=>value?.endsWith(' — DeepSeek Harness'))
    .map(value=>value.slice(0,-' — DeepSeek Harness'.length)));
  requireUi(titles.size===1,'SYNTHETIC_CONVERSATION_TITLE_NOT_UNIQUE');
  stableTitle=[...titles][0];
  requireUi(stableTitle.startsWith('【本地协议测试，不是真实模型】'),'SYNTHETIC_CONVERSATION_TITLE_NOT_OBSERVED');
  emit('observed',{interaction:'remember-actual-synthetic-title',renameVerified:false});
}
function ownedNodeProcesses():{app:number;nodes:number[]} {
  const app=command('shell','pidof',pkg).trim().split(/\s+/);
  requireUi(app.length===1&&/^\d+$/.test(app[0]),'OWN_APP_PID_NOT_UNIQUE');
  // PID/PPID/NAME only: no process argv, READY URL, auth token or private data.
  const nodes=command('shell','ps','-A','-o','PID,PPID,NAME').trim().split('\n').slice(1)
    .map(line=>line.trim().split(/\s+/)).filter(row=>row[1]===app[0]&&/^libnexttavern_n/.test(row[2]??''));
  return {app:Number(app[0]),nodes:nodes.map(row=>Number(row[0]))};
}
function ownedNodePid():number {
  const {nodes}=ownedNodeProcesses();requireUi(nodes.length===1,'OWN_NATIVE_NODE_CHILD_NOT_UNIQUE');return nodes[0];
}
function appFailureEvidence():void {
  try {
    const owned=ownedNodeProcesses();
    emit('observed',{interaction:'own-runtime-processes',appPid:owned.app,nodePids:owned.nodes});
    // This tag is emitted only by the x86Diagnostic flavor's fixed metadata
    // classifier. No raw console messages, URLs, stack traces or other apps.
    const output=command('shell','logcat','-d','--pid='+owned.app,'-t','200','-v','brief','-s','NextTavernWeb:V');
    let privateLogSaved=false;
    try {
      mkdirSync(args['--work-dir'],{recursive:true,mode:0o700});
      writeFileSync(join(args['--work-dir'],'web-diagnostics.log'),output,{mode:0o600,flag:'wx'});
      privateLogSaved=true;
    }catch {/* Private recording failure must not erase already captured safe evidence. */}
    emit('observed',{interaction:'app-webview-diagnostics',privateLogSaved,errorTail:safeErrorTail(output)});
  }catch(error) {
    emit('observed',{interaction:'app-webview-diagnostics',available:false,
      errorCode:error instanceof UiFailure?error.code:'PRIVATE_DIAGNOSTIC_UNAVAILABLE'});
  }
}
/** Recover actual UI text, not private history. This WebView omits the CSS
 * scroller's AX scrollable flag; public SHOW works without inventing an owner.
 * AX bounds are recorded separately, not promoted to pixel verification. */
async function requirePersistedConversation():Promise<void> {
  await dismissIme();
  let positiveBounds=0;
  for(const marker of [fixtureOpening,fixturePrompt,fixtureReply]) {
    await readySnapshot();const nodes=leafTexts(marker);
    requireUi(nodes.length===1,'RECOVERED_STORY_TEXT_NOT_UNIQUE');
    showControl(nodes[0]);await readySnapshot();
    const revealed=leafTexts(marker);
    requireUi(revealed.length===1,'RECOVERED_STORY_TEXT_LOST_AFTER_SHOW');
    if(visibleBounds(revealed[0]))positiveBounds++;
  }
  captureApprovedScreenshot('synthetic-chat');
  emit('observed',{interaction:'recovered-ui-story-text',textWitnesses:3,publicShowActions:3,
    positiveAxBounds:positiveBounds,pixelVisibilityQualified:false});
}
/** No new prompt is sent in this function, including after the new origin. */
async function backgroundStopStartAndRecover():Promise<void> {
  await rememberSyntheticConversation();stage='background-return-same-node';
  const before=ownedNodePid();command('shell','input','keyevent','KEYCODE_HOME');await delay(2000);
  command('shell','am','start','-W','-n',pkg+'/app.nexttavern.android.mobile.MainActivity');
  await until(()=>has(['本地服务运行中']),60,'NATIVE_READY_NOT_RETAINED_AFTER_HOME');
  requireUi(ownedNodePid()===before,'BACKGROUND_RETURN_REPLACED_NATIVE_NODE');
  await requirePersistedConversation();emit('passed',{scope:'home-return-same-owned-node-and-exposed-ui-story'});
  stage='ordinary-native-stop-start';
  await press(['停止'],node=>button(node)&&!inWebView(node));
  await until(()=>has(['停止 NextTavern？'])&&visibleNamed(['停止并收尾']).length===1,30,'ORDINARY_NATIVE_STOP_CONFIRMATION_NOT_EXPOSED');
  await press(['停止并收尾']);
  await until(()=>visibleNamed(['启动'],node=>button(node)&&!inWebView(node)).length===1,180,'ORDINARY_STOP_NOT_SETTLED');
  await press(['启动'],node=>button(node)&&!inWebView(node));
  await until(()=>has(['本地服务运行中']),180,'NATIVE_RESTART_READY_NOT_OBSERVED');
  requireUi(ownedNodePid()!==before,'NATIVE_RESTART_DID_NOT_REPLACE_NODE_PROCESS');
  stage='reopen-persisted-named-conversation';await reopenNamedConversation();
  await requirePersistedConversation();
  emit('passed',{scope:'ordinary-stop-start-ui-opening-user-prompt-assistant-recovery',newPromptSent:false,
    fixtureCorePlayable:true,liveModel:false,fullG0:false,arm64Qualified:false});
}
async function runContiguousCreate(workDir:string):Promise<void> {
  await configureFixtureProvider();
  await prepareRoleplaySessionAndCardPage();
  await selectSyntheticCard(workDir);
  await submitSelectedCard();
  await chooseOpeningAndChat();
  await backgroundStopStartAndRecover();
}

interface SafeFixtureCounter {
  request:number;streamRequested:boolean;paced:boolean;contentDeltas:number;completed:boolean;aborted:boolean;
}
/** Runner Linux log ONLY. This is not a product private file or endpoint, and
 * no raw line, body, model, key or credential is copied to driver output. */
function fixtureCounterSnapshot(file:string):Map<number,SafeFixtureCounter> {
  const text=readFileSync(file,'utf8'),records=new Map<number,SafeFixtureCounter>();
  // The writer can be between console.log's bytes; leave an unfinished line
  // for the next observation rather than treating a partial write as evidence.
  for(const line of text.slice(0,text.lastIndexOf('\n')+1).split('\n')) {
    if(!line.startsWith('{'))continue;
    let value:Record<string,unknown>;
    try {value=JSON.parse(line)}catch{requireUi(false,'FIXTURE_COUNTER_LOG_INVALID')}
    if(value!.kind!=='local-protocol-fixture-request')continue;
    requireUi(value!.schemaVersion===1&&value!.fixture===PROTOCOL_FIXTURE_ID
      &&Number.isSafeInteger(value!.request)&&Number(value!.request)>0
      &&Number.isSafeInteger(value!.contentDeltas)&&Number(value!.contentDeltas)>=0
      &&typeof value!.streamRequested==='boolean'&&typeof value!.paced==='boolean'
      &&typeof value!.completed==='boolean'&&typeof value!.aborted==='boolean',
      'FIXTURE_COUNTER_SCHEMA_NOT_SUPPORTED');
    records.set(Number(value!.request),{request:Number(value!.request),streamRequested:value!.streamRequested as boolean,
      paced:value!.paced as boolean,contentDeltas:Number(value!.contentDeltas),
      completed:value!.completed as boolean,aborted:value!.aborted as boolean});
  }
  return records;
}
/** Only the synthetic fixture's fixed enums/counters leave its private log. */
function fixtureFailureEvidence(file:string):void {
  const rows=readFileSync(file,'utf8').split('\n').flatMap(line=>{
    try {return [JSON.parse(line)]}catch{return []}
  });
  const enumList=(value:unknown,allowed:string[])=>Array.isArray(value)
    ?value.filter(item=>typeof item==='string'&&allowed.includes(item)):[];
  const rejected=rows.filter(row=>row.kind==='local-protocol-fixture-rejected'
    &&row.schemaVersion===1&&row.fixture===PROTOCOL_FIXTURE_ID).slice(-8).map(row=>({
      reason:enumList([row.reason],['unsupported-tool-surface','malformed-envelope','unsupported-task-contract',
        'unsupported-worker','incomplete-tool-receipt'])[0]??'unrecognized',
      offeredTools:enumList(row.offeredTools,['rp_task_submit','rp_task_read','run_code']),
      taskKinds:enumList(row.taskKinds,['schema-maintenance','status','decision','memory','other']),
      taskStages:enumList(row.taskStages,['schema-maintenance-v1','background-notes','compaction','other']),
    }));
  const requests=[...fixtureCounterSnapshot(file).values()];
  const modes=new Map<number,string>();
  for(const row of rows)if(row.kind==='local-protocol-fixture-request'&&row.fixture===PROTOCOL_FIXTURE_ID
    &&Number.isSafeInteger(row.request)&&['story','maintenance','maintenance-complete','background-memory'].includes(row.mode))
      modes.set(row.request,row.mode);
  emit('observed',{interaction:'synthetic-fixture-summary',requests:requests.length,
    modes:Object.fromEntries(['story','maintenance','maintenance-complete','background-memory']
      .map(mode=>[mode,[...modes.values()].filter(value=>value===mode).length])),
    completed:requests.filter(row=>row.completed).length,aborted:requests.filter(row=>row.aborted).length,rejected});
}
const maxFixtureRequest=(file:string)=>Math.max(0,...fixtureCounterSnapshot(file).keys());
const freshPaced=(file:string,after:number)=>[...fixtureCounterSnapshot(file).values()]
  .filter(record=>record.request>after&&record.streamRequested&&record.paced);
const completePacedPrompt=PACED_STREAM_MARKER+' COMPLETE_UI_TURN';
const interruptPacedPrompt=PACED_STREAM_MARKER+' INTERRUPT_UI_TURN';
const leafTexts=(text:string)=>current.filter(node=>node.package===pkg&&node.class!=='android.widget.EditText'
  &&node.class!=='android.webkit.WebView'&&inWebView(node)&&node.text?.trim()===text)
  .filter(node=>!current.some(child=>child!==node&&child.text?.trim()===text&&ancestors(child).includes(node)));
/** Accessibility document order correlates the reply with its unique visible
 * synthetic user-turn anchor. An OLD identical fixture reply cannot satisfy
 * this predicate. No hidden DOM id or evaluated JavaScript is used. */
function fixtureReplyAfter(prompt:string,partial:boolean,visible=true):Node|undefined {
  const anchors=leafTexts(prompt);
  if(anchors.length!==1)return;
  const after=current.indexOf(anchors[0]),view=ancestors(anchors[0]).find(node=>node.class==='android.webkit.WebView');
  return current.find((node,index)=>{
    if(index<=after||node.package!==pkg||node.class==='android.widget.EditText'||node.class==='android.webkit.WebView')return false;
    const text=node.text?.trim()??'';
    return (partial ? text.length>0&&text.length<fixtureReply.length&&fixtureReply.startsWith(text) : text===fixtureReply)
      &&ancestors(node).includes(view!)&&(!visible||visibleBounds(node));
  });
}
async function sendOnePacedPrompt(prompt:string):Promise<void> {
  await readySnapshot();
  const composer=current.filter(node=>node.package===pkg&&node.class==='android.widget.EditText'
    &&node.enabled!=='false'&&inWebView(node)&&visibleBounds(node));
  requireUi(composer.length===1,'PACED_TURN_UNIQUE_COMPOSER_NOT_EXPOSED');
  await typeAscii(composer[0],prompt);
  await press(['发送消息','Send message']);
  await until(()=>current.some(node=>node.package===pkg&&node.class!=='android.widget.EditText'
    &&node.text===prompt),30,'PACED_USER_MESSAGE_NOT_SUBMITTED');
  await dismissIme();
}
async function ordinaryNativeStop():Promise<void> {
  await press(['停止'],node=>button(node)&&!inWebView(node));
  await until(()=>has(['停止 NextTavern？'])&&visibleNamed(['停止并收尾']).length===1,30,'PACED_ORDINARY_STOP_CONFIRMATION_NOT_EXPOSED');
  await press(['停止并收尾']);
  await until(()=>visibleNamed(['启动'],node=>button(node)&&!inWebView(node)).length===1,180,'PACED_ORDINARY_STOP_NOT_SETTLED');
}
async function reopenNamedConversation():Promise<void> {
  // Native READY precedes the new authenticated origin's asynchronous page load.
  await until(()=>has(webChrome),180,'RESTART_WEBVIEW_APP_CONTROLS_NOT_EXPOSED');
  await showSidebar();
  // The real treeitem aggregates its title and relative timestamp. One fresh
  // test conversation is required; never choose an arbitrary row or hidden ID.
  requireUi(stableTitle,'PERSISTED_SYNTHETIC_SESSION_TITLE_REQUIRED');
  let rows:Node[]=[];
  await until(()=>{
    rows=current.filter(node=>node.package===pkg&&node.class==='android.view.View'
      &&[node.text,node['content-desc']].some(value=>value===stableTitle||value?.startsWith(stableTitle+' ')));
    requireUi(rows.length<=1,'PERSISTED_SYNTHETIC_SESSION_ROW_NOT_UNIQUE');
    return rows.length===1;
  },60,'PERSISTED_SYNTHETIC_SESSION_ROW_NOT_EXPOSED');
  showControl(rows[0]);controlAction(rows[0],'click-control');
  await hideSidebar();
}
/** Recovered user anchors and ordered reply/stopped witnesses come from the
 * actual UI tree. No private history or missing AX scroll-owner assumption. */
async function requirePacedRecoveryUi():Promise<{partialRetained:boolean;recoveryKind:"stopped"|"recovery-action"}> {
  await dismissIme();
  let lastProof="";
  const proof=()=>{
    const complete=fixtureReplyAfter(completePacedPrompt,false,false);
    const anchors=leafTexts(interruptPacedPrompt),anchor=anchors.length===1?current.indexOf(anchors[0]):-1;
    const later=(node:Node,index:number)=>index>anchor&&anchor>=0&&node.package===pkg&&inWebView(node);
    const stopped=current.find((node,index)=>later(node,index)&&named(node,['已停止','Stopped']));
    // Product message-actions maps this exact turn-local action to its valid
    // failedTurnRecoveryByTurn userSeq. Require one action after the last user
    // anchor, not an unrelated earlier recovery button elsewhere in the tree.
    const recovery=current.filter((node,index)=>later(node,index)&&button(node)&&node.enabled!=='false'
      &&named(node,['恢复失败轮次并生成 Agent 回复']));
    requireUi(recovery.length<=1,'INTERRUPTED_TURN_RECOVERY_ACTION_NOT_UNIQUE');
    requireUi(!fixtureReplyAfter(interruptPacedPrompt,false,false),'INTERRUPTED_TURN_RENDERED_AS_FULL_FIXTURE_REPLY');
    const partialRetained=Boolean(fixtureReplyAfter(interruptPacedPrompt,true,false));
    const observation={completeAnchorCount:leafTexts(completePacedPrompt).length,
      interruptAnchorCount:anchors.length,completedReply:Boolean(complete),stoppedAfterInterrupt:Boolean(stopped),
      recoveryActionCount:recovery.length,stoppedAnywhere:current.some(node=>node.package===pkg&&named(node,['已停止','Stopped'])),partialRetained};
    const serialized=JSON.stringify(observation);
    if(serialized!==lastProof){emit('observed',{interaction:'paced-recovery-ui-witnesses',...observation});lastProof=serialized;}
    return {complete,stopped,recovery:recovery[0],partialRetained};
  };
  await until(()=>{const result=proof();return Boolean(result.complete&&(result.stopped||result.recovery))},
    60,'PACED_COMPLETED_OR_STOPPED_TURN_NOT_EXPOSED_AFTER_RESTART');
  for(const marker of [completePacedPrompt,interruptPacedPrompt]) {
    const anchors=leafTexts(marker);requireUi(anchors.length===1,'PACED_RECOVERED_ANCHOR_NOT_UNIQUE');
    showControl(anchors[0]);await readySnapshot();
  }
  const result=proof();requireUi(result.complete&&(result.stopped||result.recovery),'PACED_RECOVERED_UI_WITNESS_LOST');
  captureApprovedScreenshot('synthetic-chat');
  emit('observed',{interaction:'paced-recovered-ui-text',publicShowActions:2,pixelVisibilityQualified:false});
  // A recovery affordance is not proof that its regeneration action ran.
  return {partialRetained:result.partialRetained,recoveryKind:result.stopped?'stopped':'recovery-action'};
}
/** Run AFTER the normal card/chat/name/background/StopStart flow. The two paced
 * prompts are different user turns. --fixture-events is a runner-owned Linux
 * protocol-fixture.log path, not a READY URL or a product-private artifact. */
async function pacedCompleteThenInterruptAndRecover(fixtureEventsFile:string):Promise<void> {
  stage='paced-partial-to-complete-ui-turn';
  const baseline=maxFixtureRequest(fixtureEventsFile),partialUpdates=new Set<string>();
  await sendOnePacedPrompt(completePacedPrompt);
  await until(()=>{
    const partial=fixtureReplyAfter(completePacedPrompt,true);
    if(partial&&visibleNamed(['停止生成','Stop generating']).length===1)partialUpdates.add(partial.text!.trim());
    return partialUpdates.size>=2&&freshPaced(fixtureEventsFile,baseline).some(record=>record.contentDeltas>1&&!record.completed&&!record.aborted);
  },90,'PACED_MULTIPLE_PARTIAL_UI_UPDATES_NOT_OBSERVED');
  await until(()=>{
    const partial=fixtureReplyAfter(completePacedPrompt,true);
    if(partial)partialUpdates.add(partial.text!.trim());
    return Boolean(fixtureReplyAfter(completePacedPrompt,false))
      &&visibleNamed(['停止生成','Stop generating']).length===0
      &&freshPaced(fixtureEventsFile,baseline).some(record=>record.completed&&!record.aborted&&record.contentDeltas>1);
  },180,'PACED_REPLY_OR_UI_IDLE_NOT_OBSERVED');
  emit('passed',{scope:'distinct-new-turn-multiple-visible-partial-updates-to-full-reply-and-ui-idle',
    partialUpdates:partialUpdates.size,pacedHttpCompletedRequests:freshPaced(fixtureEventsFile,baseline).filter(record=>record.completed).length,
    uniquelyPrimaryRequest:false,phaseBCQualified:false,memoryQualified:false,liveModel:false});

  captureApprovedScreenshot('synthetic-chat');
  stage='separate-paced-partial-native-stop';
  const beforeStop=ownedNodePid(),interruptBaseline=maxFixtureRequest(fixtureEventsFile),interruptUpdates=new Set<string>();
  await sendOnePacedPrompt(interruptPacedPrompt);
  await until(()=>{
    const partial=fixtureReplyAfter(interruptPacedPrompt,true);
    if(partial&&visibleNamed(['停止生成','Stop generating']).length===1)interruptUpdates.add(partial.text!.trim());
    return interruptUpdates.size>=2&&freshPaced(fixtureEventsFile,interruptBaseline)
      .some(record=>record.contentDeltas>0&&!record.completed&&!record.aborted);
  },90,'SECOND_TURN_VISIBLE_PARTIAL_AND_PENDING_HTTP_NOT_OBSERVED');
  const pending=new Set(freshPaced(fixtureEventsFile,interruptBaseline)
    .filter(record=>record.contentDeltas>0&&!record.completed&&!record.aborted).map(record=>record.request));
  await ordinaryNativeStop();
  await until(()=>{
    const records=freshPaced(fixtureEventsFile,interruptBaseline);
    return records.some(record=>pending.has(record.request)&&record.aborted&&!record.completed)
      &&records.every(record=>record.completed||record.aborted);
  },30,'NATIVE_STOP_DID_NOT_ABORT_OBSERVED_PACED_CONNECTION');
  const stoppedRecords=freshPaced(fixtureEventsFile,interruptBaseline),restartBaseline=maxFixtureRequest(fixtureEventsFile);
  stage='restart-after-explicit-interruption';
  await press(['启动'],node=>button(node)&&!inWebView(node));
  await until(()=>has(['本地服务运行中']),180,'NATIVE_RESTART_AFTER_INTERRUPTION_NOT_READY');
  requireUi(ownedNodePid()!==beforeStop,'INTERRUPTED_NODE_PID_WAS_NOT_REPLACED');
  await reopenNamedConversation();const recovery=await requirePacedRecoveryUi();
  const later=freshPaced(fixtureEventsFile,restartBaseline);
  // A new paced request might be contextual/background work, not necessarily a
  // primary replay. Block classification rather than inventing that diagnosis.
  requireUi(later.length===0,'NEW_PACED_REQUEST_AFTER_RESTART_REQUIRES_CLASSIFICATION');
  emit('passed',{scope:'explicit-native-interruption-http-abort-new-process-ui-recovery',
    visiblePartialUpdates:interruptUpdates.size,pacedAbortedRequests:stoppedRecords.filter(record=>record.aborted).length,
    pacedCompletedRequests:stoppedRecords.filter(record=>record.completed).length,newPromptSentAfterRestart:false,
    newPacedRequestsObservedThroughRecovery:later.length,interruptedTurnRenderedStopped:recovery.recoveryKind==='stopped',
    recoveryKind:recovery.recoveryKind,recoveryActionExecuted:false,
    interruptedUserPromptRecovered:true,interruptedPartialRetained:recovery.partialRetained,
    priorCompletedPacedReplyRecovered:true,uniquelyPrimaryRequest:false,phaseBCQualified:false,
    memoryQualified:false,drainedAllWork:false,liveModel:false,fullG0:false});
}

const memoryProviderName='NextTavernOnlineMemoryFixture', memoryRevision='qa-online-4d-v1';
let memoryKeyInputStarted=false;
const memorySeedPrompt='Remember the blue bookmark: '+EMBEDDING_QUERY;
type MemoryFixtureCount={request:number;inputCount:number;dimensions:number;completed:boolean;aborted:boolean};
/** Separate from chat counters. Never emit raw log lines, model input, keys or URLs. */
function memoryFixtureCounts(file:string):Map<number,MemoryFixtureCount> {
  const text=readFileSync(file,'utf8'),records=new Map<number,MemoryFixtureCount>();
  for(const line of text.slice(0,text.lastIndexOf('\n')+1).split('\n')) {
    if(!line.startsWith('{'))continue;
    let value:Record<string,unknown>;
    try {value=JSON.parse(line)}catch{requireUi(false,'MEMORY_FIXTURE_LOG_INVALID')}
    if(value!.kind!=='local-embedding-fixture-request')continue;
    requireUi(value!.schemaVersion===1&&value!.fixture===EMBEDDING_FIXTURE_ID
      &&Number.isSafeInteger(value!.request)&&Number(value!.request)>0
      &&Number.isSafeInteger(value!.inputCount)&&Number(value!.inputCount)>0
      &&value!.dimensions===EMBEDDING_FIXTURE_DIMENSIONS
      &&typeof value!.completed==='boolean'&&typeof value!.aborted==='boolean','MEMORY_FIXTURE_SCHEMA_UNSUPPORTED');
    records.set(Number(value!.request),{request:Number(value!.request),inputCount:Number(value!.inputCount),
      dimensions:Number(value!.dimensions),completed:value!.completed as boolean,aborted:value!.aborted as boolean});
  }
  return records;
}
const maxMemoryFixture=(file:string)=>Math.max(0,...memoryFixtureCounts(file).keys());
const completedMemoryAfter=(file:string,after:number)=>[...memoryFixtureCounts(file).values()]
  .filter(record=>record.request>after&&record.completed&&!record.aborted);
const memoryTexts=()=>current.filter(node=>node.package===pkg&&inWebView(node)
  &&node.class!=='android.widget.EditText'&&node.class!=='android.webkit.WebView'&&node.text?.trim());
/** Surface actual panel errors even below the bounded general labels summary. */
function assertNoMemoryUiError():void {
  const errors=[...new Set(memoryTexts().map(node=>node.text!.trim()).filter(text=>/^Error:|^记忆检索操作失败：/.test(text)))];
  if(errors.length){emit('observed',{interaction:'memory-panel-error',errors:errors.slice(0,3).map(redact)});
    throw new UiFailure('MEMORY_PANEL_REPORTED_ERROR')}
}
function ensureMemoryFixtureLoopback():void {
  const present=command('reverse','--list').split('\n').some(line=>/\btcp:18766\s+tcp:18765\s*$/.test(line));
  if(!present)command('reverse','tcp:18766','tcp:18765'); // Restore test transport, never replay a UI write.
  const status=command('shell',"{ printf 'GET /v1/models HTTP/1.1\\r\\nHost: fixture\\r\\nConnection: close\\r\\n\\r\\n'; sleep 1; } | toybox nc -w 5 127.0.0.1 18766 | head -n 1");
  requireUi(/^HTTP\/1\.1 200\b/.test(status),'MEMORY_LOOPBACK_FIXTURE_UNREACHABLE');
  emit('observed',{interaction:'memory-loopback-fixture-preflight',mappingRestored:!present,appUidEvidence:false});
}
/** Source labels are confirmed; their Spinner/EditText accessibility joins are
 * UNOBSERVED for this panel. Unknown/missing controls fail; no field-index fallback. */
async function openEmbeddingMemoryPanel():Promise<void> {
  await openManager();await pressManagerTab(['Embedding 模型设置']);
  await until(()=>has(['新增接入 / New provider']),30,'EMBEDDING_PANEL_NOT_EXPOSED');
}
const memoryProgressPatterns=[/^正文来源 (\d+) · 已覆盖 (\d+)$/,
  /^索引指纹：([0-9a-f]{20})…$/,
  /^嵌入元数据：nexttavern-embedding-fixture · 修订 qa-online-4d-v1 · 维度 4 · task=document · pooling=provider-defined$/,
  /^所选对话向量：(\d+) · 待处理 (\d+) · 运行中 (\d+) · 失败 (\d+) · 结果未知 (\d+)$/];
type MemoryUiIndex={sources:number;covered:number;fingerprintPrefix:string;vectors:number};
/** Only actual exposed paragraphs, each publicly revealed before acceptance.
 * A clipped/omitted metadata paragraph is a UI gate, not permission for HTTP/DB reads. */
async function observeOnlineMemoryIndex():Promise<MemoryUiIndex> {
  // This panel initializes progressSession to the current session; never changed here.
  let texts:string[]=[];
  await until(()=>{
    assertNoMemoryUiError();
    texts=memoryProgressPatterns.map(pattern=>memoryTexts().map(node=>node.text!.trim()).find(text=>pattern.test(text))??'');
    if(texts.some(text=>!text))return false;
    const coverage=texts[0].match(memoryProgressPatterns[0])!,counts=texts[3].match(memoryProgressPatterns[3])!;
    return Number(coverage[1])>0&&coverage[1]===coverage[2]&&Number(counts[1])>0
      &&counts.slice(2).every(value=>Number(value)===0);
  },120,'ONLINE_MEMORY_INDEX_METADATA_NOT_COMPLETE');
  for(const text of texts)await reveal([text],node=>node.class!=='android.widget.EditText');
  const coverage=texts[0].match(memoryProgressPatterns[0])!,counts=texts[3].match(memoryProgressPatterns[3])!;
  return {sources:Number(coverage[1]),covered:Number(coverage[2]),
    fingerprintPrefix:texts[1].match(memoryProgressPatterns[1])![1],vectors:Number(counts[1])};
}

/** Prerequisite: first memory setup in a fresh synthetic CI profile; the SAME
 * named conversation already contains existing fixtureOpening. The fixture maps
 * any 蓝色书签 source to the query vector; no card/history changes are needed. */
async function configureAndIndexOnlineMemory(eventsFile:string):Promise<MemoryUiIndex> {
  stage='online-memory-provider';
  await openEmbeddingMemoryPanel();
  requireUi(!memoryTexts().some(node=>node.text?.includes(memoryProviderName)),'MEMORY_PROVIDER_ALREADY_EXISTS_NO_CREATE_REPLAY');
  await press(['新增接入 / New provider']);
  await replace(['名称','名称 My embedding provider'],memoryProviderName,['名称']);
  // New provider initializes online/OpenAI; preserve those actual default values.
  // Memory permits plaintext only for loopback; runner supplies this explicit
  // ADB reverse to its local fixture, never an exception to product URL policy.
  await replace(['Base URL','Base URL https://…'],'http://127.0.0.1:18766/v1',['Base URL']);
  await replace(['手动输入模型 ID','手动输入模型 ID 支持自定义别名'],EMBEDDING_FIXTURE_MODEL,['手动输入模型 ID']);
  // Leave optional dimensions empty: use the provider's real model default.
  // Actual test output and persisted index metadata below must still prove 4D.
  emit('not-verified',{scope:'manual-embedding-dimension-input',defaultUntouched:true});
  await replace(['模型修订版本（可选）','模型修订版本（可选） 例如 2026-09-14'],memoryRevision,['模型修订版本（可选）']);
  memoryKeyInputStarted=true;
  await replace(['API Key（留空保留已保存 Key，不回显）'],'local-test-only');
  await press(['保存供应商']); // Exactly once; ambiguous write must stop, never replay.
  await until(()=>{assertNoMemoryUiError();return current.some(node=>named(node,['测试'])&&button(node)&&node.enabled!=='false')},30,'MEMORY_PROVIDER_SAVE_NOT_OBSERVED');
  ensureMemoryFixtureLoopback(); // Reader transport may have recovered since runner startup.
  const testedAfter=maxMemoryFixture(eventsFile);
  await press(['测试']);
  await until(()=>{assertNoMemoryUiError();return completedMemoryAfter(eventsFile,testedAfter).length>0
    &&memoryTexts().some(node=>node.text?.trim()==='实际向量维度：4')},60,'ONLINE_EMBEDDING_TEST_REQUEST_NOT_COMPLETED');
  await reveal(['实际向量维度：4'],node=>node.class!=='android.widget.EditText');
  await press(['用于剧情记忆']);
  await pressManagerTab(['记忆']);
  // modeScope initializes to session; this flow never selects the global scope.
  await press(['B 语义 / Semantic']);
  const auto=await semanticPanelControl(['自动更新语义索引 / Auto-update semantic index'],
    node=>node.class==='android.widget.CheckBox');
  // Fresh profile defaults to indexing disabled; provider/mode writes do not enable it.
  const indexedAfter=maxMemoryFixture(eventsFile);controlAction(auto,'click-control');
  // Fresh completed embedding requests plus full public coverage prove this write.
  await pressManagerTab(['Embedding 模型设置']);
  const before=await observeOnlineMemoryIndex();
  requireUi(completedMemoryAfter(eventsFile,indexedAfter).length>0,'NO_FRESH_EMBEDDING_INDEX_REQUEST');
  emit('passed',{scope:'online-embedding-ui-provider-and-index',dimensions:4,vectors:before.vectors,
    sources:before.sources,covered:before.covered,fingerprintPrefix:before.fingerprintPrefix,
    semanticQuality:false,androidEvidence:'this-run-only'});
  await closeWebDialog();await hideSidebar();return before;
}

/** Full JSON in the command summary is NOT yet observed in Android A11y.
 * GenericCommandCard receives JSON.stringify(result), no UI-only data endpoint.
 * Single-line output is not expandable; truncated JSON MUST block this gate. */
function visibleMemoryResults():Record<string,any>[] {
  const records=new Map<string,Record<string,any>>();
  for(const node of memoryTexts().filter(node=>visibleBounds(node))) {
    const text=node.text!.trim();if(!text.startsWith('{'))continue;
    let value:Record<string,any>;try {value=JSON.parse(text)}catch{continue}
    if(value.requestedMode==='semantic'&&Array.isArray(value.entries))records.set(text,value);
  }
  return [...records.values()];
}
/** Run ONLY once and AFTER existing card/chat/paced gates, in a fresh task profile.
 * This is the FIRST memory search in that scripted profile, deliberately after
 * restart: no pre-restart identical command outcome can satisfy a fresh result. */
async function onlineMemoryRestartAndRecall(eventsFile:string,expectedSource=fixtureOpening):Promise<void> {
  const before=await configureAndIndexOnlineMemory(eventsFile),oldPid=ownedNodePid();
  stage='online-memory-ordinary-stop-start';await ordinaryNativeStop();
  await press(['启动'],node=>button(node)&&!inWebView(node));
  await until(()=>has(['本地服务运行中']),180,'MEMORY_RESTART_READY_NOT_OBSERVED');
  requireUi(ownedNodePid()!==oldPid,'MEMORY_RESTART_DID_NOT_REPLACE_NODE');
  ensureMemoryFixtureLoopback();
  await reopenNamedConversation();
  if(memoryOnly)await requireMemorySeedConversation();else await requirePersistedConversation();
  await openEmbeddingMemoryPanel();const after=await observeOnlineMemoryIndex();
  requireUi(after.fingerprintPrefix===before.fingerprintPrefix&&after.vectors===before.vectors
    &&after.sources===before.sources&&after.covered===before.covered,'MEMORY_INDEX_OR_FINGERPRINT_PREFIX_CHANGED_ON_REOPEN');
  // Do not reapply mode/index flags: fresh semantic query proves effective saved mode.
  // Index persistence is qualified here, not auto-update of future turns.
  await closeWebDialog();await hideSidebar();await readySnapshot();
  requireUi(visibleMemoryResults().length===0,'FIRST_MEMORY_SEARCH_PRECONDITION_NOT_MET');
  const embeddingBaseline=maxMemoryFixture(eventsFile),chatBaseline=maxFixtureRequest(eventsFile);
  stage='fresh-semantic-memory-slash-after-restart';
  const composers=current.filter(node=>node.package===pkg&&node.class==='android.widget.EditText'
    &&inWebView(node)&&node.enabled!=='false'&&visibleBounds(node));
  requireUi(composers.length===1,'MEMORY_SLASH_COMPOSER_NOT_UNIQUE');
  await typeAscii(composers[0],'/memory search '+EMBEDDING_QUERY);
  await press(['发送消息','Send message']); // One actual slash command, no paid chat turn.
  let result:Record<string,any>|undefined;
  await until(()=>{
    const outcomes=visibleMemoryResults();requireUi(outcomes.length<=1,'FRESH_MEMORY_RESULT_AMBIGUOUS');
    result=outcomes[0];return Boolean(result)&&completedMemoryAfter(eventsFile,embeddingBaseline).length>0;
  },90,'FRESH_MEMORY_COMMAND_FULL_JSON_OR_EMBEDDING_REQUEST_NOT_OBSERVED');
  requireUi(result!.mode==='semantic'&&result!.requestedMode==='semantic'&&!Object.hasOwn(result!,'fallback'),
    'MEMORY_QUERY_FELL_BACK_OR_WAS_NOT_SEMANTIC');
  const hit=result!.entries.find((entry:Record<string,any>)=>entry.text?.includes(expectedSource));
  requireUi(hit?.rank===1&&typeof hit.score==='number'&&Number.isFinite(hit.score)&&hit.score>0,'EXPECTED_SYNTHETIC_SEMANTIC_SOURCE_NOT_RANKED_FIRST');
  requireUi(maxFixtureRequest(eventsFile)===chatBaseline,'CHAT_REQUEST_DURING_MEMORY_COMMAND_ATTRIBUTION_AMBIGUOUS');
  emit('passed',{scope:'online-memory-ui-index-stop-start-fresh-semantic-recall',dimensions:4,
    vectors:after.vectors,fingerprintPrefix:after.fingerprintPrefix,fullFingerprintCompared:false,autoIndexPersistenceQualified:false,
    expectedSource:true,rank:hit.rank,score:hit.score,keywordFallback:false,
    freshEmbeddingHttpCompletions:completedMemoryAfter(eventsFile,embeddingBaseline).length,
    semanticQuality:false,separateChunkRanking:false,localModel:false,liveProvider:false});
}


/** A fresh source through ordinary chat UI, without SAF or paced prerequisite. */
async function requireMemorySeedConversation():Promise<void> {
  await dismissIme();
  for(const text of [memorySeedPrompt,fixtureReply]) {
    await until(()=>leafTexts(text).length===1,45,'MEMORY_SEED_MESSAGE_NOT_RESTORED');
    showControl(leafTexts(text)[0]);await readySnapshot();
    requireUi(leafTexts(text).length===1,'MEMORY_SEED_MESSAGE_LOST_AFTER_SHOW');
  }
}
async function runIndependentMemory():Promise<void> {
  await configureFixtureProvider();await prepareRoleplaySessionAndCardPage(false);
  stage='memory-synthetic-source-chat';
  await sendOnePacedPrompt(memorySeedPrompt);
  await until(()=>{
    requireUi(!current.some(node=>node.package===pkg&&node.text?.startsWith('This turn failed')),'MEMORY_SEED_TURN_FAILED');
    return leafTexts(fixtureReply).length===1&&visibleNamed(['停止生成','Stop generating']).length===0;
  },180,'MEMORY_SEED_REPLY_NOT_OBSERVED');
  // Reply completion can autofocus the composer after the send-time IME read.
  // Reveal actual completed messages before asking for any geometry evidence.
  await requireMemorySeedConversation();captureApprovedScreenshot('synthetic-chat');
  await rememberSyntheticConversation();
  emit('passed',{scope:'independent-memory-real-ui-synthetic-source',SAFRun:false,pacedRun:false,liveModel:false});
  await onlineMemoryRestartAndRecall(fixtureEvents,memorySeedPrompt);
}

try {
  stage='verify-self-created-emulator';
  requireUi(command('shell','getprop','ro.kernel.qemu').trim()==='1','NOT_SELF_CREATED_EMULATOR');
  stage='native-first-screen';
  command('shell','input','keyevent','KEYCODE_WAKEUP');
  command('shell','am','start','-W','-n',pkg+'/app.nexttavern.android.mobile.MainActivity');
  snapshotIdentity=deviceIdentity();
  await until(()=>has(ready)||matches(['启动'],true).length===1,180,'NATIVE_SCREEN_TIMEOUT');
  if(!has(ready))tap(['启动']);
  stage='native-host-ready';
  // QA observation budget, not a Node lifetime/production cancellation policy.
  await until(()=>has(ready),1200,'HOST_READY_NOT_OBSERVED');emit('passed');
  stage='webview-real-ui';
  await until(()=>{if(onboarding())return false;return has(webChrome)},180,'WEBVIEW_APP_CONTROLS_NOT_EXPOSED');
  emit('passed');labels();
  stage='open-host-settings';
  let sidebarRequested=false,settingsRequested=false,modelsRequested=false;
  await until(()=>{
    // The Host can mount onboarding after its navigation chrome is visible.
    // A modal may have intercepted the previous touch; resume the visible path
    // after it is dismissed rather than treating that touch as completed work.
    if(onboarding()) {
      sidebarRequested=false;settingsRequested=false;modelsRequested=false;return false;
    }
    if(current.some(node=>node.package===pkg && button(node) && named(node,addProvider)))return true;
    if(!modelsRequested && matches(['模型','Models'],true).length===1) {
      tap(['模型','Models']);modelsRequested=true;return false;
    }
    if(!settingsRequested && matches(settings,true).length===1) {
      tap(settings);settingsRequested=true;return false;
    }
    if(!sidebarRequested && !settingsRequested && matches(sidebar,true).length===1) {
      tap(sidebar);sidebarRequested=true;
    }
    return false;
  },180,'MODEL_DIRECTORY_NOT_READY_OR_LAYOUT_CLIPPED');
  stage='host-models-page';
  labels();
  if(memoryOnly) {
    await runIndependentMemory();
    emit('passed',{scope:'independent-online-memory-ui',memoryQualified:true,liveModel:false,
      productPlayable:false,fullG0:false,arm64Qualified:false});
  } else {
    await runContiguousCreate(args['--work-dir']);
    let recoveryFailure:UiFailure|undefined;
    try {await pacedCompleteThenInterruptAndRecover(fixtureEvents)} catch(error) {
      // This separate recovery gate remains failed. The live restarted app can
      // still exercise online indexing; never replay the interrupted user turn.
      if(!(error instanceof UiFailure)||error.code!=='PACED_COMPLETED_OR_STOPPED_TURN_NOT_EXPOSED_AFTER_RESTART')throw error;
      recoveryFailure=error;
      emit('failed',{scope:'paced-interruption-ui-recovery',code:error.code,...waitReceipt(),
        lastSuccessfulSnapshot:lastSnapshotReceipt(),continuingIndependentMemoryTest:true});
      labels();captureApprovedScreenshot('synthetic-chat');
    }
    await onlineMemoryRestartAndRecall(fixtureEvents);
    if(recoveryFailure)throw recoveryFailure;
    emit('passed',{scope:'ordinary-ui-synthetic-card-chat-stream-stop-recovery',package:pkg,
      cardImport:'passed',SAF:'passed',chat:'passed',restartRecovery:'passed',liveModel:false,
      incrementalRendering:'observed-partial-to-complete',syntheticCoreFlow:true,
      productPlayable:false,fullG0:false,arm64Qualified:false,phaseBCQualified:false,memoryQualified:true});
  }
}catch(error) {
  const failedWait=waitReceipt(),failedSnapshot=lastSnapshotReceipt();
  // Replace the same approved form PNG only before any API key was entered.
  // It may contain the fixed synthetic route/loopback URL, never credentials.
  if(stage==='create-fixture-provider'&&!providerKeyInputStarted) {
    try{captureApprovedScreenshot('empty-provider',true)}catch{/* Screenshot failure is not product evidence. */}
  }
  if(stage==='online-memory-provider') {
    try{assertNoMemoryUiError()}catch{/* Preserve the original failure and emit its actual panel error separately. */}
    try{emit('observed',{interaction:'memory-fixture-failure-state',
      reverseMappingPresent:command('reverse','--list').split('\n').some(line=>/\btcp:18766\s+tcp:18765\s*$/.test(line)),
      embeddingRecords:fixtureEvents?[...memoryFixtureCounts(fixtureEvents).values()]:[]})}catch{/* Diagnostics do not replace the original error. */}
    emit('observed',{interaction:'memory-form-controls',valuesOmitted:true,controls:current
      .filter(node=>node.package===pkg&&['android.widget.EditText','android.widget.Spinner','android.view.View'].includes(node.class)
        &&(node.class!=='android.view.View'||Boolean(node.hint)))
      .map(node=>({class:node.class,hint:redact(node.hint??''),bounds:node.bounds,
        enabled:node.enabled,password:node.password,focused:node.focused}))});
    if(!memoryKeyInputStarted)try{captureApprovedScreenshot('empty-provider',true)}catch{}
  }
  let focus:string|null=null,activityAlive:boolean|null=null;
  try{focus=command('shell','dumpsys','window','windows').match(/mCurrentFocus=Window\{[^}]*\s([A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+)\}/)?.[1]??null}catch{}
  try{activityAlive=/^\d+(?:\s+\d+)*$/.test(command('shell','pidof',pkg).trim())}catch{/* ADB failure cannot establish process absence. */}
  emit('observed',{interaction:'failed-ui-window-state',focus,activityAlive,
    roots:current.filter(node=>node.__parent==='-1').map(node=>({package:node.package,class:node.class,
      active:node['window-active'],focused:node['window-focused'],visible:node['visible-to-user']}))});
  appFailureEvidence();
  if(fixtureEvents)try{fixtureFailureEvidence(fixtureEvents)}catch{emit('observed',{interaction:'synthetic-fixture-summary',available:false})}
  labels();emit('failed',{code:error instanceof UiFailure?error.code:'DRIVER_FAILURE',
    ...failedWait,lastSuccessfulSnapshot:failedSnapshot,
    totalReaderRecoveries:snapshotTransportRecoveries,productPlayable:false,fullG0:false});
  process.exitCode=1;
}
