/** Temporary UI-only first stage. No HTTP, READY/token reads, JS evaluation or screenshots. */
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

type Node = Record<string,string>;
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i+=2) args[process.argv[i]]=process.argv[i+1];
const adb=args['--adb'], serial=args['--serial'], pkg=args['--package'];
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
requireUi(Object.keys(args).every(key=>['--adb','--serial','--package','--phase','--work-dir'].includes(key)),'UNKNOWN_ARGUMENT');
// Recovery/card/model mutation/chat are deliberately not implemented in this first stage.
if(args['--phase']!=='create') {emit('blocked',{code:'FIRST_STAGE_ONLY',noDeviceActions:true});process.exit(2)}
const remoteXml='/data/local/tmp/nexttavern-mobile-first-ui.xml';
function command(...commandArgs:string[]):string {
  try {return execFileSync(adb,['-s',serial,...commandArgs],{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']})}
  catch {throw new UiFailure('ADB_COMMAND_FAILED')}
}
const decode=(value:string)=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
let current:Node[]=[];
function snapshot():Node[] {
  command('shell','uiautomator','dump',remoteXml);
  const xml=command('exec-out','cat',remoteXml);
  requireUi(xml.includes('<hierarchy'),'ACCESSIBILITY_DUMP_UNAVAILABLE');
  current=[...xml.matchAll(/<node\b([^>]+)>/g)].map(match=>Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item=>[item[1],decode(item[2])])
  ));
  return current;
}
const redact=(text:string)=>text.replace(/(?:https?|wss?):\/\/[^\s"<>]+/gi,'[URL]')
  .replace(/(?:token|cookie|authorization|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,'[REDACTED]')
  .replace(/[A-Za-z0-9_\-+/=]{48,}/g,'[LONG_VALUE]').slice(0,140);
function labels():void {
  // Only this synthetic app's accessible labels; no raw XML, URLs, EditText values or dumpsys.
  const unique=new Set<string>();
  const rows:Record<string,string>[]=[];
  let chars=0;
  for(const node of current) {
    if(node.package!==pkg || node.class==='android.widget.EditText')continue;
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
function matches(names:string[],interactive=false):Node[] {
  return current.filter(node=>names.some(name=>node.text===name||node['content-desc']===name)
    && node.enabled!=='false' && bounds(node)
    && (!interactive||node.clickable==='true'||node.class==='android.widget.Button'));
}
function tapNode(node:Node):void {
  const box=bounds(node);requireUi(box,'NO_VISIBLE_TARGET_BOUNDS');
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
async function until(predicate:()=>boolean,seconds:number,code:string):Promise<void> {
  const end=Date.now()+seconds*1000;
  do {
    snapshot();allowNotifications();
    if(current.some(node=>node.package===pkg&&node.text?.startsWith('本地服务未能运行')))throw new UiFailure('NATIVE_RUNTIME_ERROR_VISIBLE');
    if(predicate())return;
    await delay(3000);
  }while(Date.now()<end);
  throw new UiFailure(code);
}
const ready=['本地服务运行中'];
const settings=['设置','Settings'];
const sidebar=['打开侧边栏','Open sidebar'];
const webChrome=[...settings,...sidebar,'新建会话','New session'];
const addProvider=['添加模型提供商','Add model provider'];
const onboardingHandled=new Set<string>();
function onboarding():boolean {
  if(!onboardingHandled.has('notice') && has(['内测声明','Internal Testing Notice']) && matches(['继续','Continue'],true).length===1) {
    tap(['继续','Continue']);onboardingHandled.add('notice');return true;
  }
  if(!onboardingHandled.has('key') && has(['添加一个 API Key 开始使用','Add an API key to get started'])
    && matches(['稍后配置','Configure later'],true).length===1) {
    tap(['稍后配置','Configure later']);onboardingHandled.add('key');return true;
  }
  return false;
}
try {
  stage='verify-self-created-emulator';
  requireUi(command('shell','getprop','ro.kernel.qemu').trim()==='1','NOT_SELF_CREATED_EMULATOR');
  stage='native-first-screen';
  command('shell','input','keyevent','KEYCODE_WAKEUP');
  command('shell','am','start','-W','-n',pkg+'/app.nexttavern.android.mobile.MainActivity');
  await until(()=>has(ready)||matches(['启动'],true).length===1,180,'NATIVE_SCREEN_TIMEOUT');
  if(!has(ready))tap(['启动']);
  stage='native-host-ready';
  // QA observation budget, not a Node lifetime/production cancellation policy.
  await until(()=>has(ready),1200,'HOST_READY_NOT_OBSERVED');emit('passed');
  stage='webview-real-ui';
  await until(()=>{if(onboarding())return false;return has(webChrome)},180,'WEBVIEW_APP_CONTROLS_NOT_EXPOSED');
  emit('passed');labels();
  stage='open-host-settings';
  if(matches(settings,true).length!==1) {
    tap(sidebar);
    await until(()=>matches(settings,true).length===1,30,'SETTINGS_TRIGGER_NOT_EXPOSED');
  }
  tap(settings);
  await until(()=>matches(['模型','Models'],true).length===1,60,'MODELS_NAV_NOT_EXPOSED');
  tap(['模型','Models']);
  stage='host-models-page';
  await until(()=>matches(addProvider,true).length===1,120,'MODEL_DIRECTORY_NOT_READY_OR_LAYOUT_CLIPPED');
  labels();
  emit('passed',{scope:'native-start-webview-host-models-only',package:pkg,
    cardImport:'not-run',SAF:'not-run',chat:'not-run',restartRecovery:'not-run',liveModel:false,
    incrementalRendering:'not-run',productPlayable:false,fullG0:false});
}catch(error) {
  labels();emit('failed',{code:error instanceof UiFailure?error.code:'DRIVER_FAILURE',productPlayable:false,fullG0:false});
  process.exitCode=1;
}finally {
  try {command('shell','rm','-f',remoteXml)}catch{}
}
