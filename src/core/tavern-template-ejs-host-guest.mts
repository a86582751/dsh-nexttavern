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
  let worldInfoAvailable=capture.snapshot.worldInfoAvailable,worldInfoCatalog,worldInfoSettings,worldInfoEntries=create(null);
  let namedWorldInfo=create(null);
  let characterDirectory;
  let presetCatalog=capture.presetCatalog,localsMerge;
  let chatRows=capture.chatRows;
  const chat=()=>{if(chatRows===undefined)reject('TEMPLATE_CHAT_CAPTURE_REQUIRED');return chatRows};
  const roleMatches=(row,role)=>!role||role==='user'&&row.isUser||role==='system'&&row.isSystem
    ||role==='assistant'&&!row.isUser&&!row.isSystem;
  const processedMessage=row=>row===undefined?'':parse(open('chat-message',ToString(row.index)));
  function getChatMessage(index,role){
    const selected=chat().filter(row=>roleMatches(row,role));
    return processedMessage(selected[index>-1?index:selected.length+index]);
  }
  function getChatMessages(startOrCount=chat().length,endOrRole,role){
    let selected=chat();
    if(endOrRole==null)return startOrCount>0?selected.slice(0,startOrCount).map(processedMessage):
      startOrCount<0?selected.slice(startOrCount).map(processedMessage):[];
    if(typeof endOrRole==='string'){
      selected=selected.filter(row=>endOrRole!==''&&roleMatches(row,endOrRole));
      return startOrCount>0?selected.slice(0,startOrCount).map(processedMessage):
        startOrCount<0?selected.slice(startOrCount).map(processedMessage):[];
    }
    if(typeof endOrRole==='number'&&(startOrCount>0||startOrCount<0))
      return selected.filter(row=>roleMatches(row,role)).slice(startOrCount,endOrRole).map(processedMessage);
    return [];
  }
  function matchChatMessages(pattern,options={}){
    const messages=getChatMessages(options.start??-2,options.end,options.role),patterns=array(pattern)?pattern:[pattern];
    return messages.some(text=>options.and?patterns.every(item=>apply(String.prototype.match,text,[item])):
      patterns.some(item=>apply(String.prototype.match,text,[item])));
  }
  function selectCharacter(name){
    if(!name)return {characterId:null,data:parse(open('current-character',''))};
    characterDirectory??=parse(open('character-directory',''));
    const entries=characterDirectory.entries;
    const indexed=entries[name],selected=indexed&&typeof indexed==='object'?indexed:
      entries.find(row=>row.name===name||apply(String.prototype.match,row.name,[name]));
    if(!selected)return null;
    const current=selected.characterId===characterDirectory.currentCharacterId;
    return {characterId:current?null:selected.characterId,
      data:parse(open(current?'current-character':'character-data',selected.characterId))};
  }
  function getCharacterData(name){return selectCharacter(name)?.data??null}
  function getCharacterDefine(name){
    const selected=selectCharacter(name);
    if(!selected)return null;
    const char=selected.data;
    let example=char.mes_example.trim();
    if(example&&example.startsWith('<START>'))example=example.slice(7).trim();
    example=example.replace('<START>','\x60\x60\x60\n\x60\x60\x60');
    if(example&&example.includes('\x60\x60\x60'))example+='\n\x60\x60\x60';
    return {characterId:selected.characterId,data:{name:char.name,description:char.description,personality:char.personality,scenario:char.scenario,
      first_message:char.first_mes,message_example:example,creator_notes:char.data.creator_notes,
      creatorcomment:char.creatorcomment,system_prompt:char.data.system_prompt,
      post_history_instructions:char.data.post_history_instructions,alternate_greetings:char.data.alternate_greetings,
      depth_prompt:char.data.depth_prompt,creator:char.data.creator}};
  }
  const defaultCharacterTemplate='<% if (name) { %><<%- name %>>\n'
    +'<% if (system_prompt) { %>System: <%- system_prompt %>\n<% } %>name: <%- name %>\n'
    +'<% if (personality) { %>personality: <%- personality %>\n<% } %>'
    +'<% if (description) { %>description: <%- description %>\n<% } %>'
    +'<% if (message_example) { %>example:\n<%- message_example %>\n<% } %>'
    +'<% if (depth_prompt) { %>System: <%- depth_prompt %>\n<% } %></<%- name %>><% } %>';
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
  // Fixed EJS arithmetic reads inscope and writes outscope. A simple scope
  // string selects both, while an object containing only scope does neither.
  function incvar(key,value=1,options){
    const settings=variableOptions(options),simpleScope=typeof options==='string'?settings.scope:undefined;
    const inscope=settings.inscope===undefined?simpleScope:settings.inscope,
      outscope=settings.outscope===undefined?simpleScope:settings.outscope,flags=settings.flags;
    let cached;
    if(settings.noCache||flags==='nx'||flags==='xx')cached=getvar(key,{scope:'cache',noCache:settings.noCache});
    const selected={index:settings.index,withMsg:settings.withMsg,scope:inscope};
    if(flags==='nx'&&cached!==undefined||flags==='xx'&&cached===undefined
      ||flags==='nxs'&&getvar(key,selected)!==undefined||flags==='xxs'&&getvar(key,selected)===undefined)return undefined;
    if(flags!==undefined&&flags!=='n'&&flags!=='nx'&&flags!=='xx'&&flags!=='nxs'&&flags!=='xxs')return undefined;
    let next=getvar(key,assign({},selected,{defaults:settings.defaults||0}))+value;
    if(settings.min!=null)next=Math.max(next,settings.min);
    if(settings.max!=null)next=Math.min(next,settings.max);
    return setvar(key,next,{index:settings.index,results:settings.results,withMsg:settings.withMsg,
      dryRun:settings.dryRun,scope:outscope,flags:'n'});
  }
  function decvar(key,value=1,options){return incvar(key,-value,options)}
  function setterOptions(settings){
    const result=create(null),names=['scope','results','withMsg','noCache','index','flags','merge','dryRun'];
    for(let i=0;i<names.length;i++)if(own(settings,names[i]))result[names[i]]=settings[names[i]];
    return result;
  }
  function delvar(key,index,options){
    const settings=variableOptions(options),writeOptions=setterOptions(settings);
    if(index==null)return setvar(key,undefined,writeOptions);
    const variable=getvar(key,assign({},settings,{clone:true}));
    if(array(variable)){
      const position=variable.indexOf(index);
      if(position<0)return undefined;
      variable.splice(position,1);
      return setvar(key,variable,writeOptions);
    }
    if(variable&&typeof variable==='object'){
      delete variable[ToString(index)];
      return setvar(key,variable,writeOptions);
    }
    if(typeof variable==='string'&&typeof index==='string'){
      const position=variable.indexOf(index);
      if(position>=0)return setvar(key,variable.slice(0,position)+variable.slice(position+index.length),writeOptions);
    }
    return undefined;
  }
  function insvar(key,value,index,options){
    const settings=variableOptions(options),writeOptions=setterOptions(settings),
      variable=getvar(key,assign({},settings,{clone:true}));
    if(array(variable)){
      if(index==null)variable.push(value);
      else {const position=ToNumber(index);variable.splice(position<0?variable.length+position:position,0,value)}
      return setvar(key,variable,writeOptions);
    }
    if(variable&&typeof variable==='object'&&index!=null){
      const name=ToString(index),exists=own(variable,name);
      if(settings.flags&&settings.flags.includes('nx')&&exists
        ||settings.flags&&settings.flags.includes('xx')&&!exists)return undefined;
      variable[name]=value;
      return setvar(key,variable,writeOptions);
    }
    if(typeof variable==='string'){
      const text=value.toString();
      if(index==null)return setvar(key,variable+text,writeOptions);
      let position=typeof index==='string'?variable.indexOf(index):ToNumber(index),remove=typeof index==='string'?text.length:0;
      if(typeof index==='string'&&position<0)return setvar(key,variable,writeOptions);
      if(position<0)position=variable.length+position;
      position=Math.max(0,Math.min(variable.length,Math.trunc(position)||0));
      return setvar(key,variable.slice(0,position)+text+variable.slice(position+remove),writeOptions);
    }
    return undefined;
  }
  function worldInfoFacts(){
    if(!worldInfoCatalog)worldInfoCatalog=parse(open('world-info-catalog',''));
    return worldInfoCatalog;
  }
  function enabledWorldInfoBooks(chara=true,global=true,persona=true,charaExtra=true,chat=true){
    const facts=worldInfoFacts(),bindings=facts.bindings,ids=[];
    if(chara)for(const id of bindings.character)if(!bindings.global.includes(id))ids.push(id);
    if(global)ids.push(...bindings.global);
    if(persona&&bindings.persona!==null&&bindings.persona!==bindings.chat
      &&!bindings.global.includes(bindings.persona))ids.push(bindings.persona);
    if(charaExtra)for(const id of bindings.characterExtra)
      if(!bindings.character.includes(id)&&!bindings.global.includes(id))ids.push(id);
    if(chat&&bindings.chat!==null&&!bindings.global.includes(bindings.chat))ids.push(bindings.chat);
    return ids.flatMap(id=>facts.books.filter(book=>book.bookId===id));
  }
  function getEnabledLoreBooks(...args){return enabledWorldInfoBooks(...args).map(book=>book.world)}
  function sortWorldInfoRows(rows,pick=row=>row.worldInfo){
    if(rows.some(row=>!pick(row)))return rows;
    const top=Math.max(0,...rows.map(row=>pick(row).position===4?pick(row).depth:0)),
      noteDepth=worldInfoFacts().authorsNoteDepth;
    const depth=row=>{
      const info=pick(row);
      if(info.position===2||info.position===3)return noteDepth+info.depth;
      const offset=info.position===0?4:info.position===1?3:info.position===5?2:info.position===6?1:undefined;
      return offset===undefined?info.depth:top+offset;
    };
    return rows.sort((a,b)=>depth(b)-depth(a)||pick(a).order-pick(b).order||pick(b).uid-pick(a).uid);
  }
  function worldInfoRows(name){
    const facts=worldInfoAvailable?worldInfoFacts():null,book=name?facts?.books.find(row=>row.world===name):
      facts?.books.find(row=>row.bookId===facts.defaultBookId);
    if(name&&!book){
      const existing=catalog.filter(row=>row.lookup?.world===name);
      if(existing.length){namedWorldInfo[name]=existing;return sortWorldInfoRows(existing)}
      if(!own(namedWorldInfo,name))namedWorldInfo[name]=parse(open('named-world-info',name));
      return sortWorldInfoRows(namedWorldInfo[name].slice());
    }
    if(!facts&&!name)worldInfoFacts();
    return book?sortWorldInfoRows(catalog.filter(row=>row.bookId===book.bookId)):[];
  }
  function worldInfoEntry(key){
    if(!own(worldInfoEntries,key))worldInfoEntries[key]=parse(open('world-info-entry',key));
    return parse(encode(worldInfoEntries[key]));
  }
  async function getWorldInfoData(name){return worldInfoRows(name).map(row=>worldInfoEntry(row.key))}
  async function getEnabledWorldInfoEntries(...args){
    const rows=enabledWorldInfoBooks(...args).flatMap(book=>catalog.filter(row=>row.bookId===book.bookId));
    return sortWorldInfoRows(rows).map(row=>worldInfoEntry(row.key));
  }
  function inheritedWorldInfoSetting(entry,name){
    if(entry[name]!=null)return entry[name];
    if(!worldInfoSettings)worldInfoSettings=parse(open('world-info-settings',''));
    return worldInfoSettings[name];
  }
  function worldInfoKeyMatch(haystack,needle,entry){
    if(needle.startsWith('/')){
      const end=needle.lastIndexOf('/');
      if(end>0)try{return new Expression(needle.slice(1,end),needle.slice(end+1)).test(haystack)}catch{}
    }
    const sensitive=inheritedWorldInfoSetting(entry,'caseSensitive'),
      text=sensitive?haystack:haystack.toLowerCase(),key=sensitive?needle:needle.toLowerCase();
    if(!inheritedWorldInfoSetting(entry,'matchWholeWords'))return text.includes(key);
    if(key.split(/\s+/).length>1)return text.includes(key);
    let escaped='';
    for(const character of key){if('\\^$.*+?()[]{}|'.includes(character))escaped+='\\';escaped+=character}
    return new Expression('(?:^|\\W)('+escaped+')(?:$|\\W)').test(text);
  }
  const worldInfoMacro=text=>parse(open('world-info-macro',text));
  function worldInfoGroupScore(trigger,entry){
    const primary=entry.key.filter(key=>worldInfoKeyMatch(trigger,key,entry)).length;
    if(!entry.key.length)return 0;
    const secondary=entry.keysecondary.filter(key=>worldInfoKeyMatch(trigger,key,entry)).length;
    if(entry.keysecondary.length&&entry.selectiveLogic===0)return primary+secondary;
    if(entry.keysecondary.length&&entry.selectiveLogic===3)return secondary===entry.keysecondary.length?primary+secondary:primary;
    return primary;
  }
  function worldInfoRoll(min,max){
    const low=Math.min(min,max),high=Math.max(min,max);
    return Math.floor(Math.random()*(high-low+1))+low;
  }
  function selectActivatedEntries(entries,keywords,condition={}){
    const trigger=(array(keywords)?keywords:[keywords]).join('\n\n'),activated=new Set();
    for(const entry of entries){
      if(condition.constant!=null&&entry.constant!==condition.constant
        ||condition.disabled!=null&&entry.disable!==condition.disabled
        ||condition.vectorized!=null&&entry.vectorized!==condition.vectorized)continue;
      if(entry.useProbability&&entry.probability<worldInfoRoll(1,100))continue;
      if(entry.constant||entry.decorators.includes('@@activate')){activated.add(entry);continue}
      if(entry.decorators.includes('@@dont_activate')||entry.decorators.includes('@@only_preload'))continue;
      if(!entry.key.map(worldInfoMacro).some(key=>!!key&&worldInfoKeyMatch(trigger,key,entry)))continue;
      if(!entry.selective||!entry.keysecondary.length){activated.add(entry);continue}
      const secondary=entry.keysecondary.map(key=>worldInfoMacro(key)).map(key=>!!key&&worldInfoKeyMatch(trigger,key.trim(),entry)),
        logic=entry.selectiveLogic??0;
      if(logic===0&&secondary.some(Boolean)||logic===1&&secondary.some(value=>!value)
        ||logic===2&&!secondary.some(Boolean)||logic===3&&secondary.every(Boolean))activated.add(entry);
    }
    const groups=new Map();
    for(const entry of activated){const group=entry.group||'',rows=groups.get(group)||[];rows.push(entry);groups.set(group,rows)}
    const selected=groups.get('')||[];
    for(const [group,rows] of groups){
      if(!group)continue;
      if(rows.length===1){selected.push(rows[0]);continue}
      if(rows.some(row=>row.groupOverride)){
        const top=Math.min(...rows.map(row=>row.order));
        if(top){selected.push(rows[Math.max(0,rows.findIndex(row=>row.order<=top))]);continue}
      }
      if(rows.some(row=>inheritedWorldInfoSetting(row,'useGroupScoring'))){
        const scores=rows.map(row=>worldInfoGroupScore(trigger,row)),top=Math.max(...scores);
        if(top){selected.push(rows[Math.max(0,scores.findIndex(score=>score>=top))]);continue}
      }
      if(rows.some(row=>!row.groupOverride&&!row.useGroupScoring)){
        let roll=worldInfoRoll(1,rows.reduce((sum,row)=>sum+(row.groupWeight??100),0));
        const winner=rows.findIndex(row=>(roll-=row.groupWeight??100)<=0);
        if(winner>=0)selected.push(rows[winner]);
      }
    }
    return sortWorldInfoRows(selected,row=>row);
  }
  async function getWorldInfoActivatedData(name,keywords,condition={}){
    return selectActivatedEntries(await getWorldInfoData(name),keywords,condition);
  }
  async function activateWorldInfoByKeywords(keywords,condition={}){
    const activated=selectActivatedEntries(await getEnabledWorldInfoEntries(),keywords,condition);
    for(const entry of activated)await activateWorldInfo(entry.world,entry.uid,condition.force);
    return activated;
  }
  function query(args){
    if(args.length<1||args.length>2)reject('TEMPLATE_HELPER_ARITY');
    let title=args[0],world=null;
    if(args.length===2){world=args[0];title=args[1];if(world!==null&&typeof world!=='string')reject('TEMPLATE_LORE_QUERY_INVALID')}
    let expression;
    if(typeof title!=='string'&&typeof title!=='number'){
      try{apply(expressionSource,title,argumentsList());expression=title}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
    }
    if(typeof title==='number'&&(!SafeInteger(title)||title<0))reject('TEMPLATE_LORE_QUERY_INVALID');
    function find(rows){
      for(let i=0;i<rows.length;i++){
        const row=rows[i],lookup=worldInfoAvailable?row.worldInfo?{title:row.worldInfo.comment,uid:row.worldInfo.uid}:row.lookup:row.lookup;
        if(!worldInfoAvailable&&world!==null&&(!lookup||row.lookup.world!==world))continue;
        if(!lookup){if(world===null&&row.key===title)return {key:row.key,metadata:row.worldInfo!==undefined};continue}
        if(lookup.title===title||lookup.uid!==null&&lookup.uid===title)return {key:row.key,metadata:row.worldInfo!==undefined};
        if(!expression)try{expression=new Expression(ToString(title))}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
        if(apply(match,expression,argumentsList(lookup.title)))return {key:row.key,metadata:row.worldInfo!==undefined};
      }
    }
    const primary=world!==null||worldInfoAvailable?worldInfoRows(world):catalog,found=find(primary);
    if(found)return {...found,named:world!==null&&own(namedWorldInfo,world)};
    if(worldInfoAvailable&&!world&&typeof title!=='number')for(const book of enabledWorldInfoBooks()){
      if(book.bookId===worldInfoFacts().defaultBookId)continue;
      const matched=find(worldInfoRows(book.world));if(matched)return matched;
    }
    const selected=typeof title==='string'||typeof title==='number'?title:
      wire({source:apply(expressionSource,title,argumentsList()),flags:apply(expressionFlags,title,argumentsList())});
    return {missing:encode(wire({world,title:selected})),named:world!==null&&own(namedWorldInfo,world)};
  }
  async function activateWorldInfo(...args){
    refuseEffect('activateWorldInfo');
    let selection,force;
    if(args.length===1||args.length===2&&typeof args[1]==='boolean'){
      selection=query([args[0]]);force=args[1];
    }else if(args.length===2||args.length===3){selection=query([args[0],args[1]]);force=args[2]}
    else reject('TEMPLATE_HELPER_ARITY');
    if(selection.missing!==undefined)return null;
    const original=worldInfoEntry(selection.key);
    activate(selection.key,force?'force-world-info':'world-info');
    return original;
  }
  function unsupported(){reject('TEMPLATE_HELPER_UNSUPPORTED')}
  function mergeLocals(locals,...values){
    if(!localsMerge){
      evaluate(parse(open('preset-merge-library','')));
      localsMerge=globalThis._.merge;
    }
    return localsMerge(locals,...values);
  }
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
      if(args.length<1||args.length>3)reject('TEMPLATE_HELPER_ARITY');
      const entryOrData=args[1],isLocalData=entryOrData===undefined||entryOrData!==null
        &&typeof entryOrData==='object'&&(prototype(entryOrData)===objectPrototype||prototype(entryOrData)===null);
      const selected=query(isLocalData?[args[0]]:[args[0],entryOrData]);
      if(selected.missing!==undefined){
        const parent=parentFrame(frame);if(!parent)reject('TEMPLATE_FRAME_INVALID');
        open(selected.named?'missing-named-lore':'missing-lore',selected.missing,parent.pointer);return '';
      }
      const data=isLocalData?entryOrData:args[2];
      if(data!==undefined||selected.metadata){
        // The fixed helper merges into its bound caller context. Keep author
        // closures and existing nested object identities inside this VM.
        mergeLocals(locals,data,selected.metadata?{world_info:worldInfoEntry(selected.key)}:{});
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
      mergeLocals(locals,data,{prompt_name:name});
      const text=await child('preset',ToString(index),frame,locals),parent=parentFrame(frame);
      return parse(open('preset-result',encode(wire({index,text})),parent.pointer));
    };
    const getchr=async function(name,template=defaultCharacterTemplate,data={}){
      const selected=getCharacterDefine(name);
      if(!selected)return '';
      const defs=selected.data;
      mergeLocals(locals,data,defs,{chara_name:defs.name});
      const text=await child('character-template',template,frame,locals),parent=parentFrame(frame);
      return parse(open('character-result',encode(wire({characterId:selected.characterId,name:defs.name,text})),parent.pointer));
    };
    const activation=(...args)=>{
      refuseEffect('activateWI');
      const selected=query(args);
      if(selected.missing!==undefined)reject('TEMPLATE_ACTIVATION_NOT_ALLOWED',frame.pointer);
      return activate(selected.key);
    };
    assign(locals,{getvar,getwi,getWorldInfo:getwi,getWorldInfoData,getEnabledWorldInfoEntries,getEnabledLoreBooks,
      getChatMessage,getChatMessages,matchChatMessages,getCharaData:getCharacterData,getCharData:getCharacterData,
      getchr,getchar:getchr,getChara:getchr,
      activewi:activateWorldInfo,activateWorldInfo,getWorldInfoActivatedData,selectActivatedEntries,activateWorldInfoByKeywords,
      getPresetPrompts,getPresetPromptsContent,
      getprp:getpreset,getpreset,getPresetPrompt:getpreset,activateWI:activation,activateRegex,injectPrompts,uninjectPrompts,
      setvar,incvar,decvar,delvar,insvar,
      getLocalVar:(key,options={})=>getvar(key,assign({},options,{scope:'local'})),
      getGlobalVar:(key,options={})=>getvar(key,assign({},options,{scope:'global'})),
      getMessageVar:(key,options={})=>getvar(key,assign({},options,{scope:'message'})),
      setLocalVar:(key,value,options={})=>setvar(key,value,assign({},options,{scope:'local'})),
      setGlobalVar:(key,value,options={})=>setvar(key,value,assign({},options,{scope:'global'})),
      setMessageVar:(key,value,options={})=>setvar(key,value,assign({},options,{scope:'message'})),
      incLocalVar:(key,value=1,options={})=>incvar(key,value,assign({},options,{outscope:'local'})),
      incGlobalVar:(key,value=1,options={})=>incvar(key,value,assign({},options,{outscope:'global'})),
      incMessageVar:(key,value=1,options={})=>incvar(key,value,assign({},options,{outscope:'message'})),
      decLocalVar:(key,value=1,options={})=>decvar(key,value,assign({},options,{outscope:'local'})),
      decGlobalVar:(key,value=1,options={})=>decvar(key,value,assign({},options,{outscope:'global'})),
      decMessageVar:(key,value=1,options={})=>decvar(key,value,assign({},options,{outscope:'message'})),
      delLocalVar:(key,options={})=>delvar(key,undefined,assign({},options,{scope:'local'})),
      delGlobalVar:(key,options={})=>delvar(key,undefined,assign({},options,{scope:'global'})),
      delMessageVar:(key,options={})=>delvar(key,undefined,assign({},options,{scope:'message'})),
      insertLocalVar:(key,value,index,options={})=>insvar(key,value,index,assign({},options,{scope:'local'})),
      insertGlobalVar:(key,value,index,options={})=>insvar(key,value,index,assign({},options,{scope:'global'})),
      insertMessageVar:(key,value,index,options={})=>insvar(key,value,index,assign({},options,{scope:'message'})),
      setVariables:unsupportedEffect('setVariables'),replaceVariables:unsupportedEffect('replaceVariables'),
      updateVariables:unsupportedEffect('updateVariables'),
      getVariables:unsupported,getMvuData:unsupported,getMvuVariable:unsupported,setMvuData:unsupportedEffect('setMvuData'),
      updateMvuData:unsupportedEffect('updateMvuData'),setMvuVariable:unsupportedEffect('setMvuVariable'),
      initializeMvuData:unsupportedEffect('initializeMvuData'),registerMvuSchema:unsupportedEffect('registerMvuSchema'),
      injectPrompt,getPromptsInjected,runSlashCommand:unsupported,executeSlashCommands:unsupported});
    define(locals,'variables',{get:()=>variables,enumerable:true,configurable:true});
    if(includeData!==undefined)defineAll(locals,descriptors(assign(create(null),includeData)));
    const rethrow=(_error,pointer,line)=>reject('TEMPLATE_EJS_GUEST_ERROR',pointer,line);
    if(!own(locals,'model'))define(locals,'model',{enumerable:true,get(){
      if(!capture.generationModel)reject('TEMPLATE_MODEL_CAPTURE_REQUIRED');
      return capture.generationModel.model;
    }});
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
        chatRows=nextCapture.chatRows;
        worldInfoAvailable=nextCapture.snapshot.worldInfoAvailable;worldInfoCatalog=undefined;
        namedWorldInfo=create(null);
        characterDirectory=undefined;
        worldInfoSettings=undefined;worldInfoEntries=create(null);
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
