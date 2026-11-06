/** New-generation guest host. All functions and captured callbacks below live
 * inside QuickJS. Node receives bounded scalar/JSON calls, never author objects.
 * This does not replace the frozen v2 bridge or grant Source write authority. */
export const TAVERN_EJS_HOST_GUEST=String.raw`(function(read,open,activate,emit,write,named,regex,fail,captureJSON){
  'use strict';
  const parse=JSON.parse,encode=JSON.stringify,evaluate=eval,apply=Reflect.apply;
  const create=Object.create,freeze=Object.freeze,assign=Object.assign,keys=Reflect.ownKeys;
  const define=Object.defineProperty,defineAll=Object.defineProperties,same=Object.is;
  const descriptors=Object.getOwnPropertyDescriptors,prototype=Object.getPrototypeOf,own=Object.hasOwn;
  const setPrototype=Object.setPrototypeOf,array=Array.isArray,SafeInteger=Number.isSafeInteger;
  const Finite=Number.isFinite,ToNumber=Number,NotANumber=Number.isNaN;
  const Failure=Error,ToString=String,Expression=RegExp,GuestProxy=Proxy;
  const match=RegExp.prototype[Symbol.match];
  const replaceText=String.prototype.replace,functionSource=Function.prototype.toString;
  const expressionSource=Object.getOwnPropertyDescriptor(RegExp.prototype,'source').get;
  const expressionFlags=Object.getOwnPropertyDescriptor(RegExp.prototype,'flags').get;
  const objectPrototype=Object.prototype,arrayPrototype=Array.prototype;
  const capture=parse(captureJSON);
  let effectConsumer=capture.consumer;
  let readerFrame=null;
  let catalog=capture.snapshot.lore;
  let presetCatalog=capture.presetCatalog,presetMerge;
  const presetRows=()=>{
    if(presetCatalog===undefined)reject('TEMPLATE_PRESET_CAPTURE_REQUIRED');
    return presetCatalog.prompts;
  };
  function* getPresetPrompts(){for(const row of presetRows())yield row.name}
  const presetIndex=name=>{
    for(const row of presetRows())if(row.name===name||apply(String.prototype.match,row.name,argumentsList(name)))return row.index;
    return -1;
  };
  const presetContent=index=>index<0?null:parse(open('preset-content',ToString(index)));
  const getPresetPromptsContent=name=>presetContent(presetIndex(name));
  const callbacks=create(null),batches=create(null);
  // Injection filters and regex rules have independent handle sequences. An
  // activation between two filters must not create a gap in their registry.
  const regexCallbacks=create(null);
  let nextRegexCallback=0,nextRegexEffect=0;
  let nextBatch=0,nextCallback=0,nextEffect=0,activeRoot=null,lastPointer='';
  let variablesCache,variableMemo=create(null);
  function argumentsList(...values){setPrototype(values,null);return values}
  function reject(code,pointer,line,helper){fail(code,pointer===undefined?lastPointer:pointer,line,helper);throw new Failure(code)}
  function refuseEffect(helper){
    if(effectConsumer==='reader-regex-phase-v1'&&helper==='activateRegex')return;
    if(effectConsumer)reject('READER_TEMPLATE_EFFECT_UNSUPPORTED',
      readerFrame?readerFrame.pointer:lastPointer,undefined,helper);
  }
  function unsupportedEffect(helper){return function(){refuseEffect(helper);unsupported();}}
  function immutable(value){
    if(value&&typeof value==='object'){
      const names=keys(value);for(let i=0;i<names.length;i++)immutable(value[names[i]]);freeze(value);
    }return value;
  }
  immutable(capture);
  function plain(value,names){
    if(!value||typeof value!=='object'||array(value))reject('TEMPLATE_HELPER_ARGUMENT');
    const base=prototype(value);if(base!==objectPrototype&&base!==null)reject('TEMPLATE_HELPER_ARGUMENT');
    const props=descriptors(value),found=keys(props),result=create(null);
    for(let i=0;i<found.length;i++){
      const name=found[i];let allowed=false;
      for(let j=0;j<names.length;j++)if(name===names[j])allowed=true;
      const prop=props[name];
      if(typeof name!=='string'||!allowed||!own(prop,'value')||!prop.enumerable)reject('TEMPLATE_HELPER_ARGUMENT');
      result[name]=prop.value;
    }return result;
  }
  function list(value,maximum){
    if(!array(value)||prototype(value)!==arrayPrototype)reject('TEMPLATE_INJECTION_ARGUMENT');
    const props=descriptors(value),names=keys(props),length=props.length.value;
    if(!SafeInteger(length)||length<0||length>maximum||names.length!==length+1)reject('TEMPLATE_INJECTION_ARGUMENT');
    const result=[];setPrototype(result,null);
    for(let i=0;i<length;i++){
      const prop=props[ToString(i)];
      if(!prop||!own(prop,'value')||!prop.enumerable)reject('TEMPLATE_INJECTION_ARGUMENT');
      result[i]=prop.value;
    }return result;
  }
  function id(value){
    if(typeof value!=='string'||!value.length||value.length>256)reject('TEMPLATE_INJECTION_ARGUMENT');return value;
  }
  function wire(value){
    if(value&&typeof value==='object'){
      setPrototype(value,null);const names=keys(value);
      for(let i=0;i<names.length;i++)if(names[i]!=='length')wire(value[names[i]]);
    }return value;
  }
  function effect(body){
    if(nextEffect>=512)reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
    body=wire(body);body.ordinal=nextEffect++;emit(encode(body));
  }
  function remove(ids,batchOrdinal){effect({kind:'remove-ids',ids,batchOrdinal})}
  function uninjectPrompts(ids){
    refuseEffect('uninjectPrompts');
    if(arguments.length!==1)reject('TEMPLATE_HELPER_ARITY');
    const selected=list(ids,128);for(let i=0;i<selected.length;i++)selected[i]=id(selected[i]);
    remove(selected,null);
  }
  function injectPrompts(prompts,options){
    refuseEffect('injectPrompts');
    if(arguments.length<1||arguments.length>2)reject('TEMPLATE_HELPER_ARITY');
    const selected=list(prompts,128),settings=options===undefined?create(null):plain(options,['once']);
    const once=settings.once===undefined?false:settings.once;
    if(typeof once!=='boolean')reject('TEMPLATE_INJECTION_ARGUMENT');
    if(nextBatch>=256)reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
    const batchOrdinal=nextBatch++,ids=[],rows=[];setPrototype(ids,null);setPrototype(rows,null);
    for(let i=0;i<selected.length;i++){
      const row=plain(selected[i],['id','position','depth','role','content','should_scan','filter']);
      const promptId=id(row.id),scan=row.should_scan===undefined?false:row.should_scan;
      if(row.position!=='in_chat'&&row.position!=='none'||!SafeInteger(row.depth)||row.depth<0||row.depth>65536
        ||row.role!=='system'&&row.role!=='user'&&row.role!=='assistant'
        ||typeof row.content!=='string'||row.content.length>16384||typeof scan!=='boolean'
        ||row.filter!==undefined&&typeof row.filter!=='function')reject('TEMPLATE_INJECTION_ARGUMENT');
      let callbackOrdinal=null;
      if(row.filter!==undefined){
        if(nextCallback>=256)reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
        callbackOrdinal=nextCallback++;callbacks[callbackOrdinal]=row.filter;
      }
      ids[i]=promptId;rows[i]={id:promptId,position:row.position,depth:row.depth,role:row.role,content:row.content,
        should_scan:scan,once,batchOrdinal,callbackOrdinal};
    }
    let deleted=false;
    const uninject=()=>{if(deleted)return;deleted=true;remove(ids,batchOrdinal)};
    batches[batchOrdinal]=uninject;
    effect({kind:'batch-created',batchOrdinal,once,ids});
    for(let i=0;i<rows.length;i++)effect({kind:'register',prompt:rows[i]});
    return freeze({uninject});
  }
  function variableOptions(options){
    if(options===undefined)return create(null);
    if(typeof options==='boolean'){const selected=create(null);selected.dryRun=options;return selected}
    if(typeof options==='string'){
      const selected=create(null);
      if(options==='old'||options==='new'||options==='fullcache')selected.results=options;
      else if(options==='nx'||options==='xx'||options==='n'||options==='nxs'||options==='xxs')selected.flags=options;
      else if(options==='cache'||options==='global'||options==='local'||options==='chat'||options==='message'||options==='initial')
        selected.scope=options;
      else reject('TEMPLATE_HELPER_UNSUPPORTED');
      return selected;
    }
    if(!options||typeof options!=='object'||array(options))reject('TEMPLATE_HELPER_UNSUPPORTED');
    return options;
  }
  function messageSelector(value){
    if(!value||typeof value!=='object'||array(value))reject('TEMPLATE_HELPER_UNSUPPORTED');
    const result=create(null),names=keys(value);
    for(let i=0;i<names.length;i++){
      const name=names[i],item=value[name];
      if(name==='role'){
        if(item!=='user'&&item!=='assistant'&&item!=='system'&&item!=='any')reject('TEMPLATE_HELPER_UNSUPPORTED');
      }else if(name==='id'||name==='swipe_id'){
        if(typeof item!=='number'||!Finite(item)||Math.floor(item)!==item)reject('TEMPLATE_HELPER_UNSUPPORTED');
      }else reject('TEMPLATE_HELPER_UNSUPPORTED');
      result[name]=item;
    }
    return result;
  }
  function namedKey(key){
    if(typeof key!=='string'||key.length>256)reject('TEMPLATE_INJECTION_ARGUMENT');return key;
  }
  function injectPrompt(key,prompt,order=100,sticky=0,uid=''){
    refuseEffect('injectPrompt');namedKey(key);
    if(typeof prompt!=='string'||prompt.length>16384||typeof order!=='number'||!Finite(order)
      ||typeof sticky!=='number'||!Finite(sticky)||typeof uid!=='string'||uid.length>256)
      reject('TEMPLATE_INJECTION_ARGUMENT');
    if(!uid)uid=named('uid',encode([key,prompt]));
    effect({kind:'named-upsert',key,uid,prompt,order,sticky});
  }
  function getPromptsInjected(key,postprocess=[],outlet=false){
    namedKey(key);const changes=list(postprocess,128);
    // Even deferred reads require a real captured queue capability.
    let text=named('get',key);
    if(outlet&&changes.length===0)return '{{outletPromptsInjected:'+key+'}}';
    for(let i=0;i<changes.length;i++){
      const change=plain(changes[i],['search','replace']);
      if(typeof change.replace!=='string')reject('TEMPLATE_INJECTION_ARGUMENT');
      text=text.replace(change.search,change.replace);
    }
    return text;
  }
  function regexFlag(value,fallback){
    if(value==null)return fallback;
    if(typeof value!=='boolean')reject('TEMPLATE_REGEX_ARGUMENT');
    return value;
  }
  function regexNumber(value,fallback){
    if(value==null)return fallback;
    if(typeof value!=='number'||!Finite(value))reject('TEMPLATE_REGEX_ARGUMENT');
    return value;
  }
  function activateRegex(pattern,replacement,options){
    refuseEffect('activateRegex');
    if(arguments.length<2||arguments.length>3)reject('TEMPLATE_HELPER_ARITY');
    let patternIdentity;
    if(typeof pattern==='string')patternIdentity=pattern;
    else {
      try{patternIdentity='/'+apply(expressionSource,pattern,argumentsList())+'/'+
        apply(expressionFlags,pattern,argumentsList())}
      catch{reject('TEMPLATE_REGEX_ARGUMENT')}
    }
    if(typeof replacement!=='string'&&typeof replacement!=='function')reject('TEMPLATE_REGEX_ARGUMENT');
    const settings=options===undefined?create(null):plain(options,['uuid','basic','generate','message','order','sticky',
      'user','assistant','system','worldinfo','reasoning','minDepth','maxDepth','before','after','html']);
    const basic=regexFlag(settings.basic,settings.generate==null&&settings.message==null),
      generate=regexFlag(settings.generate,false),message=regexFlag(settings.message,false);
    if(basic&&typeof replacement!=='string')reject('TEMPLATE_REGEX_BASIC_REPLACEMENT');
    if(!basic&&!generate&&!message)return;
    let uid=settings.uuid;
    if(uid==null||uid==='')uid=regex('uid',encode([patternIdentity,typeof replacement==='string'?replacement:
      apply(functionSource,replacement,argumentsList())]));
    else uid=id(uid);
    const order=regexNumber(settings.order,100),sticky=regexNumber(settings.sticky,0),
      user=regexFlag(settings.user,true),assistant=regexFlag(settings.assistant,true),
      system=regexFlag(settings.system,true),worldinfo=regexFlag(settings.worldinfo,false),
      minDepth=regexNumber(settings.minDepth,null),maxDepth=regexNumber(settings.maxDepth,null),
      before=regexFlag(settings.before,settings.after==null&&settings.html==null),
      after=regexFlag(settings.after,false),html=regexFlag(settings.html,false);
    if(nextRegexCallback>=256)reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
    const callbackOrdinal=nextRegexCallback++;
    regexCallbacks[callbackOrdinal]={pattern,replacement};
    const register=(mode)=>{
      if(nextRegexEffect>=512)reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
      const reasoning=regexFlag(settings.reasoning,mode==='basic');
      regex('upsert',encode(wire({kind:'upsert',ordinal:nextRegexEffect++,uid,mode,callbackOrdinal,order,sticky,
        user,assistant,system,worldinfo,reasoning,minDepth,maxDepth,before,after,html})));
    };
    if(basic)register('basic');
    if(generate)register('generate');
    if(message)register('message');
  }
  function getvar(key,options){
    if(arguments.length<1||arguments.length>2)reject('TEMPLATE_HELPER_ARITY');
    if(key!==null&&typeof key!=='string')reject('TEMPLATE_HELPER_ARGUMENT');
    const settings=variableOptions(options),forward=create(null);
    // Defaults stay as real guest values, including functions and closures.
    // Neither stringify nor freeze the caller's fallback object.
    const fallback=settings.defaults,clone=!!settings.clone,scope=settings.scope,index=settings.index;
    if(scope!==undefined){
      if(typeof scope!=='string')reject('TEMPLATE_HELPER_UNSUPPORTED');
      forward.scope=scope;
    }
    if(index!==undefined&&index!==null){
      const converted=ToNumber(index);
      // Numeric keys remain literal keys, including fractions and infinities.
      // Preserve a nonnumeric path separately; ST's cache fallback coerces it
      // to NaN, whereas explicit global/local/message/initial retains it.
      if(NotANumber(converted)){forward.index=ToString(index);forward.indexPath=true}
      else forward.index=same(converted,-0)?'-0':ToString(converted);
    }
    if(settings.noCache)forward.noCache=true;
    if(scope==='message'&&settings.withMsg)forward.withMsg=messageSelector(settings.withMsg);
    const packet=parse(read(key,encode(forward)));
    if(!packet.present)return fallback;
    return clone?packet.value:immutable(packet.value);
  }
  function invalidateVariables(){variablesCache=undefined;variableMemo=create(null)}
  function variablePacket(prop,presenceOnly=false){
    const previous=variableMemo[prop];
    if(previous&&(presenceOnly||previous.loaded))return previous;
    const packet=parse(read(prop,presenceOnly
      ?'{"scope":"cache","literalOnly":true,"presenceOnly":true}'
      :'{"scope":"cache","literalOnly":true}'));
    if(!presenceOnly&&packet.present)packet.value=immutable(packet.value);
    packet.loaded=!presenceOnly||!packet.present;variableMemo[prop]=packet;return packet;
  }
  function allVariables(){
    if(variablesCache===undefined){
      const values=getvar(null,{scope:'cache',clone:true}),names=keys(values);
      for(let i=0;i<names.length;i++){
        const name=names[i],previous=variableMemo[name];
        values[name]=previous&&previous.loaded&&previous.present?previous.value:immutable(values[name]);
      }
      // Memo values are already immutable. Keep their actual identity when
      // the complete map is first requested; freeze each new subtree once.
      variablesCache=freeze(values);variableMemo=create(null);
    }
    return variablesCache;
  }
  // A property lookup has the dependency/cost of that key only. Enumeration
  // materializes one readonly cache copy for this invocation, not each get.
  const variables=new GuestProxy(create(null),{
    get(_target,prop){
      if(typeof prop!=='string')return undefined;
      if(variablesCache!==undefined)return own(variablesCache,prop)?variablesCache[prop]:undefined;
      const packet=variablePacket(prop);return packet.present?packet.value:undefined;
    },
    has(_target,prop){
      return typeof prop==='string'&&(variablesCache!==undefined?own(variablesCache,prop):variablePacket(prop,true).present);
    },
    ownKeys(){return keys(allVariables())},
    getOwnPropertyDescriptor(_target,prop){
      if(typeof prop!=='string')return undefined;
      let present,value;
      if(variablesCache!==undefined){present=own(variablesCache,prop);value=present?variablesCache[prop]:undefined}
      else {const packet=variablePacket(prop);present=packet.present;value=packet.value}
      return present?{value,enumerable:true,writable:false,configurable:true}:undefined;
    },
    set(){refuseEffect('variables');reject('TEMPLATE_HELPER_UNSUPPORTED')},
    deleteProperty(){refuseEffect('variables');reject('TEMPLATE_HELPER_UNSUPPORTED')},
    defineProperty(){refuseEffect('variables');reject('TEMPLATE_HELPER_UNSUPPORTED')},
    setPrototypeOf(){refuseEffect('variables');reject('TEMPLATE_HELPER_UNSUPPORTED')},
    preventExtensions(){refuseEffect('variables');reject('TEMPLATE_HELPER_UNSUPPORTED')}
  });
  function setvar(key,value,options){
    refuseEffect('setvar');
    if(arguments.length<2||arguments.length>3)reject('TEMPLATE_HELPER_ARITY');
    if(typeof key!=='string')reject('TEMPLATE_HELPER_ARGUMENT');
    const settings=variableOptions(options),forward=create(null),names=keys(settings);
    for(let i=0;i<names.length;i++){
      const name=names[i];
      if(name!=='scope'&&name!=='results'&&name!=='withMsg'&&name!=='noCache'&&name!=='index'
        &&name!=='flags'&&name!=='merge'&&name!=='dryRun')reject('TEMPLATE_HELPER_UNSUPPORTED');
      if(name==='withMsg'){
        if((settings.scope===undefined||settings.scope==='message')&&settings.withMsg)forward.withMsg=messageSelector(settings.withMsg)
      }
      else if(name==='noCache')forward.noCache=!!settings.noCache;
      else if(name==='merge'||name==='dryRun')forward[name]=!!settings[name];
      else if(name==='index'){
        if(settings.index!==undefined&&settings.index!==null){
          const converted=ToNumber(settings.index);
          if(NotANumber(converted)){forward.index=ToString(settings.index);forward.indexPath=true}
          else forward.index=same(converted,-0)?'-0':ToString(converted);
        }
      }
      else {
        if(name==='scope'&&settings.scope!==undefined&&typeof settings.scope!=='string')reject('TEMPLATE_HELPER_UNSUPPORTED');
        if(name==='results'&&settings.results!==undefined&&settings.results!=='old'&&settings.results!=='new'&&settings.results!=='fullcache')
          reject('TEMPLATE_HELPER_UNSUPPORTED');
        if(name==='flags'&&settings.flags!==undefined&&settings.flags!=='nx'&&settings.flags!=='xx'
          &&settings.flags!=='n'&&settings.flags!=='nxs'&&settings.flags!=='xxs')reject('TEMPLATE_HELPER_UNSUPPORTED');
        forward[name]=settings[name];
      }
    }
    if(value===undefined)forward.operation='delete';
    // This is the guest-to-JSON boundary, not a second State validator. Reject
    // values that JSON would silently drop or replace before the owner sees it.
    const valueJSON=value===undefined?'null':encode(value,(_key,current)=>{
      const kind=typeof current;
      if(kind==='undefined'||kind==='function'||kind==='symbol'||kind==='bigint'
        ||kind==='number'&&!Finite(current))reject('TEMPLATE_VARIABLE_VALUE_UNSUPPORTED');
      return current;
    });
    const result=parse(write(key,valueJSON,encode(forward)));
    invalidateVariables();return result.present?result.value:undefined;
  }
  function query(args){
    if(args.length<1||args.length>2)reject('TEMPLATE_HELPER_ARITY');
    let title=args[0],world=null;
    if(args.length===2){world=args[0];title=args[1];if(typeof world!=='string')reject('TEMPLATE_LORE_QUERY_INVALID')}
    let expression;
    if(typeof title!=='string'&&typeof title!=='number'){
      try{apply(expressionSource,title,argumentsList());expression=title}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
    }
    if(typeof title==='number'&&(!SafeInteger(title)||title<0))reject('TEMPLATE_LORE_QUERY_INVALID');
    for(let i=0;i<catalog.length;i++){
      const row=catalog[i];
      if(world!==null&&(!row.lookup||row.lookup.world!==world))continue;
      if(!row.lookup){if(world===null&&row.key===title)return {key:row.key};continue}
      if(row.lookup.title===title||row.lookup.uid!==null&&row.lookup.uid===title)return {key:row.key};
      if(!expression)try{expression=new Expression(ToString(title))}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
      if(apply(match,expression,argumentsList(row.lookup.title)))return {key:row.key};
    }
    const selected=typeof title==='string'||typeof title==='number'?title:
      wire({source:apply(expressionSource,title,argumentsList()),flags:apply(expressionFlags,title,argumentsList())});
    return {missing:encode(wire({world,title:selected}))};
  }
  function unsupported(){reject('TEMPLATE_HELPER_UNSUPPORTED')}
  function parentFrame(frame){return frame.closed?activeRoot:frame}
  async function child(kind,key,frame,locals,includeData){
    const parent=parentFrame(frame);
    if(!parent)reject('TEMPLATE_FRAME_INVALID');
    const raw=open(kind,key,parent.pointer),descriptor=parse(raw);
    if(descriptor===null){if(kind==='lore')return '';reject('TEMPLATE_INCLUDE_UNAVAILABLE',parent.pointer)}
    if(parent.depth>=16)reject('TEMPLATE_NESTED_LIMIT',parent.pointer);
    // A declared EJS partial may recurse over finite includeData (trees, lists).
    // The depth/deadline/memory limits bound it. WI cycle policy stays separate
    // until its existing recursion owner supplies a different contract.
    if(kind==='lore'){
      let ancestor=parent;
      while(ancestor){
        if(ancestor.identity===descriptor.identity||ancestor.pointer===descriptor.sourcePointer)
          reject('TEMPLATE_NESTED_CYCLE',descriptor.sourcePointer);
        ancestor=ancestor.parent;
      }
    }
    const nested={pointer:descriptor.sourcePointer,identity:descriptor.identity,parent,depth:parent.depth+1,pending:0,closed:false};
    parent.pending++;
    try{return await execute(nested,descriptor.functionSource,locals,includeData)}finally{parent.pending--}
  }
  async function execute(frame,source,parentLocals,includeData){
    // Preserve the variables accessor without eagerly reading the cache during
    // every include/getwi. The parent's helper bindings remain guest values.
    const locals=parentLocals?defineAll(create(null),descriptors(parentLocals)):assign(create(null),capture.context);
    const getwi=async function(...args){
      const selected=query(args);
      if(selected.missing!==undefined){
        const parent=parentFrame(frame);if(!parent)reject('TEMPLATE_FRAME_INVALID');
        open('missing-lore',selected.missing,parent.pointer);return '';
      }
      return await child('lore',selected.key,frame,locals);
    };
    const include=async function(key,data){
      if(arguments.length<1||arguments.length>2||typeof key!=='string')reject('TEMPLATE_HELPER_ARGUMENT',frame.pointer);
      if(data!==undefined&&(data===null||typeof data!=='object'||array(data)))reject('TEMPLATE_HELPER_ARGUMENT',frame.pointer);
      return await child('include',key,frame,locals,data);
    };
    const getpreset=async function(name,data={}){
      const index=presetIndex(name);
      if(index<0||presetContent(index)===null)return '';
      if(data===null||typeof data!=='object'||array(data))reject('TEMPLATE_HELPER_ARGUMENT',frame.pointer);
      // Use the pinned library inside this VM: data may contain real author
      // closures and object identities that must never be serialized to Node.
      if(!presetMerge){
        evaluate(parse(open('preset-merge-library','')));
        presetMerge=globalThis._.merge;
      }
      presetMerge(locals,data,{prompt_name:name});
      const text=await child('preset',ToString(index),frame,locals),parent=parentFrame(frame);
      return parse(open('preset-result',encode(wire({index,text})),parent.pointer));
    };
    const activation=(...args)=>{
      refuseEffect('activateWI');
      const selected=query(args);
      if(selected.missing!==undefined)reject('TEMPLATE_ACTIVATION_NOT_ALLOWED',frame.pointer);
      return activate(selected.key);
    };
    assign(locals,{getvar,getwi,getWorldInfo:getwi,getPresetPrompts,getPresetPromptsContent,
      getprp:getpreset,getpreset,getPresetPrompt:getpreset,activateWI:activation,activateRegex,injectPrompts,uninjectPrompts,
      setvar,setVariables:unsupportedEffect('setVariables'),replaceVariables:unsupportedEffect('replaceVariables'),
      updateVariables:unsupportedEffect('updateVariables'),
      getVariables:unsupported,getMvuData:unsupported,getMvuVariable:unsupported,setMvuData:unsupportedEffect('setMvuData'),
      updateMvuData:unsupportedEffect('updateMvuData'),setMvuVariable:unsupportedEffect('setMvuVariable'),
      initializeMvuData:unsupportedEffect('initializeMvuData'),registerMvuSchema:unsupportedEffect('registerMvuSchema'),
      injectPrompt,getPromptsInjected,runSlashCommand:unsupported,executeSlashCommands:unsupported});
    define(locals,'variables',{get:()=>variables,enumerable:true,configurable:true});
    if(includeData!==undefined)defineAll(locals,descriptors(assign(create(null),includeData)));
    const rethrow=(_error,pointer,line)=>reject('TEMPLATE_EJS_GUEST_ERROR',pointer,line);
    // This eval alias is deliberately indirect: EJS default with must parse
    // as sloppy code, while execution still stays entirely in this QuickJS VM.
    const render=evaluate(source);
    const previousReaderFrame=readerFrame;readerFrame=frame;
    try{
      const value=await apply(render,locals,argumentsList(locals,rethrow,include));
      if(frame.pending)reject('TEMPLATE_NESTED_NOT_AWAITED',frame.pointer);
      if(typeof value!=='string')reject('TEMPLATE_EJS_RETURN_TYPE',frame.pointer);
      return value;
    }finally{readerFrame=previousReaderFrame;frame.closed=true}
  }
  async function run(pointer,source){
    invalidateVariables();
    lastPointer=pointer;
    const root={pointer,identity:pointer,parent:null,depth:0,pending:0,closed:false};activeRoot=root;
    return await execute(root,source);
  }
  async function invoke(actionJSON,nextCaptureJSON){
    invalidateVariables();
    const action=parse(actionJSON);
    const previousConsumer=effectConsumer;
    // A previously strict Reader program cannot be widened by an action.
    effectConsumer=capture.consumer==='reader-render-v1'?capture.consumer:
      action.kind==='regex'?(action.consumer??capture.consumer):capture.consumer;
    if(nextCaptureJSON!==undefined){
      const nextCapture=parse(nextCaptureJSON);
      if(nextCapture!==null){
        immutable(nextCapture);catalog=nextCapture.snapshot.lore;presetCatalog=nextCapture.presetCatalog;
      }
    }
    // Keep actual callback closures and their original captured context objects.
    // Only dynamic helper lookup adopts the new phase: read/open/activate are
    // backed by Node's current capture, while getwi selects from this catalog.
    const root={pointer:lastPointer,identity:lastPointer,parent:null,depth:0,pending:0,closed:false};activeRoot=root;
    let accepted=null,regexResults;
    try{
      if(action.kind==='filter'){
        const callback=callbacks[action.callbackOrdinal];
        if(typeof callback!=='function')reject('TEMPLATE_INJECTION_HANDLE_MISSING');
        accepted=await apply(callback,undefined,argumentsList());
        if(typeof accepted!=='boolean')reject('TEMPLATE_INJECTION_FILTER_BOOLEAN');
      }else if(action.kind==='dispose'){
        const disposer=batches[action.batchOrdinal];
        if(typeof disposer!=='function')reject('TEMPLATE_INJECTION_HANDLE_MISSING');
        apply(disposer,undefined,argumentsList());
      }else if(action.kind==='regex'){
        const rule=regexCallbacks[action.callbackOrdinal];
        if(!rule)reject('TEMPLATE_REGEX_HANDLE_MISSING');
        regexResults=[];
        for(let i=0;i<action.inputs.length;i++){
          const input=action.inputs[i],env=assign(create(null),capture.context,input.env);
          // All matches execute in this realm. The actual RegExp, string
          // search, lexical callback and native replacement arguments stay
          // here; the owner receives one ordered batch of final strings.
          const replacement=typeof rule.replacement==='function'?function(...args){
            return apply(rule.replacement,env,args);
          }:rule.replacement;
          const text=apply(replaceText,input.text,argumentsList(rule.pattern,replacement));
          regexResults.push({id:input.id,text:ToString(text)});
        }
      }else reject('TEMPLATE_INJECTION_ARGUMENT');
      if(root.pending)reject('TEMPLATE_NESTED_NOT_AWAITED');
      return encode(wire(regexResults===undefined?{accepted}:{accepted,regexResults}));
    }finally{root.closed=true;effectConsumer=previousConsumer}
  }
  return freeze({run,invoke});
})`
