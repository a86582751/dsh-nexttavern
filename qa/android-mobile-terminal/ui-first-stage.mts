/** Temporary UI-only first stage. No HTTP, READY/token reads, JS evaluation or screenshots. */
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

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
  current=[];
  const parents:number[]=[];
  for(const match of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if(match[0]==='</node>') {parents.pop();continue;}
    const node:Node=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(item=>[item[1],decode(item[2])]));
    node.__parent=String(parents.at(-1)??-1);
    const index=current.push(node)-1;
    if(match[2]!=='/')parents.push(index);
  }
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
function visibleBounds(node:Node):number[]|null {
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
const onboardingDismissRequested=new Set<string>();
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
  if(action) {
    // Chromium may report positive text/button bounds beyond the modal clip.
    // Only touch the action's actually visible intersection, never its mask.
    const visible=[Math.max(box[0],action[0]),Math.max(box[1],action[1]),Math.min(box[2],action[2]),Math.min(box[3],action[3])];
    if(visible[2]>visible[0] && visible[3]>visible[1]) {
      command('shell','input','tap',String(Math.round((visible[0]+visible[2])/2)),String(Math.round((visible[1]+visible[3])/2)));
      onboardingDismissRequested.add(step);return;
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
  if(has(['内测声明','Internal Testing Notice'])) {
    if(!onboardingDismissRequested.has('notice'))interactOnboarding('notice',['继续','Continue']);
    return true;
  }
  if(has(['添加一个 API Key 开始使用','Add an API key to get started'])) {
    if(!onboardingDismissRequested.has('key'))interactOnboarding('key',['稍后配置','Configure later']);
    return true;
  }
  return false;
}

function captureModelsBeforeCredentials():void {
  const directory=process.env.NEXTTAVERN_UI_EVIDENCE_DIR;
  if(!directory)return;
  // Only this source-guarded, fresh Models page is approved. Never capture a
  // generic failure or a credential editor, and never print image bytes.
  mkdirSync(directory,{recursive:true});
  const png=execFileSync(adb,['-s',serial,'exec-out','screencap','-p'],{
    timeout:90000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe'],
  });
  writeFileSync(join(directory,'models.png'),png,{flag:'wx'});
  emit('observed',{syntheticScreenshot:'models-before-credential-entry'});
}
const fixtureId='nexttavern-fixture';
const fixtureModelNames=['模型 ID 1','Model ID 1'];
const named=(node:Node,names:string[])=>names.some(name=>node.text===name||node['content-desc']===name);
const button=(node:Node)=>node.clickable==='true'||node.class==='android.widget.Button';
/** Reveal only a named form control through its actual scrollable ancestor;
 * unknown structure remains an observed failure, not a whole-screen fallback. */
async function reveal(names:string[],kind:(node:Node)=>boolean=button):Promise<Node> {
  for(let attempt=0;;attempt++) {
    snapshot();
    const found=current.filter(node=>node.package===pkg&&named(node,names)&&kind(node)&&node.enabled!=='false');
    requireUi(found.length===1,found.length?'NEXT_UI_TARGET_AMBIGUOUS':'NEXT_UI_TARGET_NOT_EXPOSED');
    const target=found[0];
    if(visibleBounds(target))return target;
    requireUi(attempt<4,'NEXT_UI_TARGET_NOT_VISIBLE_AFTER_SCROLL');
    const scroll=ancestors(target).find(node=>node.scrollable==='true'&&visibleBounds(node));
    requireUi(scroll,'NEXT_UI_SCROLL_ANCESTOR_NOT_EXPOSED');
    const box=visibleBounds(scroll)!,targetBox=bounds(target);
    const reverse=targetBox!==null&&targetBox[3]<=box[1];
    const x=Math.round((box[0]+box[2])/2),height=box[3]-box[1];
    command('shell','input','swipe',String(x),String(Math.round(box[1]+height*(reverse ? .2 : .8))),
      String(x),String(Math.round(box[1]+height*(reverse ? .8 : .2))),'450');
    emit('observed',{interaction:'named-control-ancestor-scroll',attempt:attempt+1});
  }
}
async function press(names:string[],kind:(node:Node)=>boolean=button):Promise<void> {tapNode(await reveal(names,kind));}
async function replace(names:string[],value:string):Promise<void> {
  // All fixture values are fixed ASCII; no shell metacharacters or credentials
  // from outside this synthetic run can enter input text.
  tapNode(await reveal(names,node=>node.class==='android.widget.EditText'));
  command('shell','input','keycombination','113','29'); // API35 Ctrl+A.
  command('shell','input','keyevent','KEYCODE_DEL');
  command('shell','input','text',value.replaceAll(' ','%s'));
  snapshot();
  // Back ONLY if the actual hierarchy exposes the IME, not to dismiss a form.
  if(current.some(node=>/\.inputmethod\./.test(node.package)))command('shell','input','keyevent','KEYCODE_BACK');
}

/** Entry condition: the preceding actual first-stage has exposed Add provider.
 * Fresh synthetic installation only: no overwrite of a previously saved route. */
async function configureFixtureProvider():Promise<void> {
  stage='create-fixture-provider';snapshot();
  requireUi(!has(['编辑 '+fixtureId,'Edit '+fixtureId]),'FIXTURE_PROVIDER_ALREADY_PRESENT');
  await press(['添加模型提供商','Add model provider']);
  await until(()=>has(['自定义模型 API','Custom model API']),30,'CUSTOM_PROVIDER_MODE_NOT_EXPOSED');
  await press(['自定义模型 API','Custom model API']);
  await until(()=>current.some(node=>node.package===pkg&&node.class==='android.widget.EditText'&&named(node,['Provider ID'])),30,'CUSTOM_PROVIDER_FORM_NOT_EXPOSED');
  await replace(['Provider ID'],fixtureId);
  await replace(['API 地址','Base URL'],'http://127.0.0.1:18765/v1');
  // Never assume the schema's first protocol is the intended one.
  await press(['API 协议','API protocol'],node=>node.class==='android.widget.Spinner'||button(node));
  const protocolOption=(node:Node)=>node.class==='android.widget.CheckedTextView'||node.class==='android.widget.RadioButton';
  await until(()=>current.some(node=>named(node,['OpenAI Chat Completions'])&&protocolOption(node)),30,'OPENAI_COMPLETIONS_OPTION_NOT_EXPOSED');
  await press(['OpenAI Chat Completions'],protocolOption);
  await replace(['API 密钥','API key'],'local-test-only');
  await press(['添加模型','Add model']);
  await replace(fixtureModelNames,fixtureId);
  await press(['模型选项 1','Model options 1']);
  await replace(['上下文窗口 1','Context window 1'],'65536');
  await replace(['最大输出 token 数 1','Max output tokens 1'],'2048');
  await press(['创建提供商','Create provider']);
  await until(()=>has(['编辑 '+fixtureId,'Edit '+fixtureId])&&!has(['创建提供商','Create provider']),60,'FIXTURE_PROVIDER_SAVE_NOT_OBSERVED');
  emit('passed',{scope:'custom-provider-form-saved',syntheticProvider:true,liveModel:false});
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
  labels();captureModelsBeforeCredentials();
  await configureFixtureProvider();
  emit('passed',{scope:'native-start-webview-model-provider-config-only',package:pkg,
    cardImport:'not-run',SAF:'not-run',chat:'not-run',restartRecovery:'not-run',liveModel:false,
    incrementalRendering:'not-run',productPlayable:false,fullG0:false});
}catch(error) {
  labels();emit('failed',{code:error instanceof UiFailure?error.code:'DRIVER_FAILURE',productPlayable:false,fullG0:false});
  process.exitCode=1;
}finally {
  try {command('shell','rm','-f',remoteXml)}catch{}
}
