import {TEMPLATE_LIMITS_V1} from './tavern-template-data.mjs'
import {TEMPLATE_DECLARED_UNSUPPORTED_HELPERS_V1} from './tavern-template-compiler.mjs'

/** This source is owned bridge code, evaluated only inside QuickJS. Actual
 * author callback/disposer objects stay in these private lexical tables. The
 * host receives bounded effect JSON and ordinals, never function text. */
export const TEMPLATE_INJECTION_GUEST_BRIDGE_V1=String.raw`(function(getvar,activate,unsupported,open,close,append,guard,string,catalogJSON,queryFault,emit){
  'use strict';
  const parse=JSON.parse,encode=JSON.stringify,apply=Reflect.apply,evaluate=eval,Failure=Error;
  const Expression=RegExp,ToString=String,isSafeInteger=Number.isSafeInteger;
  const match=RegExp.prototype[Symbol.match],regExpSource=Object.getOwnPropertyDescriptor(RegExp.prototype,'source').get;
  const descriptors=Object.getOwnPropertyDescriptors,prototype=Object.getPrototypeOf,keys=Reflect.ownKeys;
  const array=Array.isArray,own=Object.hasOwn,freeze=Object.freeze,create=Object.create,setPrototype=Object.setPrototypeOf;
  const objectPrototype=Object.prototype,arrayPrototype=Array.prototype;
  let catalog=parse(catalogJSON),token=0,activeRoot=0,nextBatch=0,nextCallback=0,nextEffect=0;
  const batches=create(null),callbacks=create(null),closedFrames=create(null);
  function argumentsList(...values){setPrototype(values,null);return values}
  function reject(code){queryFault(code);throw new Failure(code)}
  function plain(value,names){
    if(!value||typeof value!=='object'||array(value))reject('TEMPLATE_INJECTION_ARGUMENT');
    const base=prototype(value);if(base!==objectPrototype&&base!==null)reject('TEMPLATE_INJECTION_ARGUMENT');
    const props=descriptors(value),found=keys(props),result=create(null);
    for(let i=0;i<found.length;i++){
      const key=found[i];if(typeof key!=='string')reject('TEMPLATE_INJECTION_ARGUMENT');
      let allowed=false;for(let j=0;j<names.length;j++)if(key===names[j])allowed=true;
      const property=props[key];
      if(!allowed||!own(property,'value')||!property.enumerable)reject('TEMPLATE_INJECTION_ARGUMENT');
      result[key]=property.value;
    }return result;
  }
  function list(value,maximum){
    if(!array(value)||prototype(value)!==arrayPrototype)reject('TEMPLATE_INJECTION_ARGUMENT');
    const props=descriptors(value),found=keys(props),length=props.length.value;
    if(!isSafeInteger(length)||length<0||length>maximum||found.length!==length+1)reject('TEMPLATE_INJECTION_ARGUMENT');
    const result=[];setPrototype(result,null);
    for(let i=0;i<length;i++){
      const property=props[ToString(i)];if(!property||!own(property,'value')||!property.enumerable)reject('TEMPLATE_INJECTION_ARGUMENT');
      result[i]=property.value;
    }return result;
  }
  function id(value){if(typeof value!=='string'||!value.length||value.length>256)reject('TEMPLATE_INJECTION_ARGUMENT');return value}
  function wire(value){
    if(value&&typeof value==='object'){
      setPrototype(value,null);const names=keys(value);
      for(let i=0;i<names.length;i++)if(names[i]!=='length')wire(value[names[i]]);
    }return value;
  }
  function effect(body){
    if(nextEffect>=${TEMPLATE_LIMITS_V1.injectionEffects})reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
    body=wire(body);body.ordinal=nextEffect++;emit(encode(body));
  }
  function remove(ids,batchOrdinal){effect({kind:'remove-ids',ids,batchOrdinal})}
  function uninjectPrompts(ids){
    if(arguments.length!==1)reject('TEMPLATE_HELPER_ARITY');
    const captured=list(ids,${TEMPLATE_LIMITS_V1.injectionIds});
    for(let i=0;i<captured.length;i++)captured[i]=id(captured[i]);
    remove(captured,null);
  }
  function injectPrompts(prompts,options){
    if(arguments.length<1||arguments.length>2)reject('TEMPLATE_HELPER_ARITY');
    const input=list(prompts,${TEMPLATE_LIMITS_V1.injectionIds});
    const settings=options===undefined?create(null):plain(options,['once']);
    const once=settings.once===undefined?false:settings.once;
    if(typeof once!=='boolean')reject('TEMPLATE_INJECTION_ARGUMENT');
    if(nextBatch>=${TEMPLATE_LIMITS_V1.injectionHandles})reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
    const batchOrdinal=nextBatch++,ids=[],rows=[];setPrototype(ids,null);setPrototype(rows,null);
    for(let i=0;i<input.length;i++){
      const row=plain(input[i],['id','position','depth','role','content','should_scan','filter']);
      const promptId=id(row.id),scan=row.should_scan===undefined?false:row.should_scan;
      if(row.position!=='in_chat'&&row.position!=='none'||!isSafeInteger(row.depth)||row.depth<0||row.depth>65536
        ||row.role!=='system'&&row.role!=='user'&&row.role!=='assistant'
        ||typeof row.content!=='string'||row.content.length>${TEMPLATE_LIMITS_V1.injectionPromptChars}
        ||typeof scan!=='boolean'||row.filter!==undefined&&typeof row.filter!=='function')reject('TEMPLATE_INJECTION_ARGUMENT');
      let callbackOrdinal=null;
      if(row.filter!==undefined){
        if(nextCallback>=${TEMPLATE_LIMITS_V1.injectionHandles})reject('TEMPLATE_INJECTION_RESTORE_LIMIT');
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
  function query(args){
    if(args.length<1||args.length>2)reject('TEMPLATE_HELPER_ARITY');
    let title=args[0],world=null;
    if(args.length===2){world=args[0];title=args[1];if(typeof world!=='string')reject('TEMPLATE_LORE_QUERY_INVALID')}
    let expression;
    if(typeof title!=='string'&&typeof title!=='number'){
      try{apply(regExpSource,title,argumentsList());expression=title}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
    }
    if(typeof title==='number'&&(!isSafeInteger(title)||title<0))reject('TEMPLATE_LORE_QUERY_INVALID');
    for(let i=0;i<catalog.length;i++){
      const row=catalog[i];
      if(world!==null&&(!row.lookup||row.lookup.world!==world))continue;
      if(!row.lookup){if(world===null&&row.key===title)return {key:row.key,missing:false};continue}
      if(row.lookup.title===title||row.lookup.uid!==null&&row.lookup.uid===title)return {key:row.key,missing:false};
      if(!expression)try{expression=new Expression(ToString(title))}catch{reject('TEMPLATE_LORE_QUERY_INVALID')}
      if(apply(match,expression,argumentsList(row.lookup.title)))return {key:row.key,missing:false};
    }
    return {key:encode(wire({world,title:typeof title==='string'||typeof title==='number'?title:apply(regExpSource,title,argumentsList())})),missing:true};
  }
  async function execute(frame,source){
    const factory=evaluate(source),createdToken=token;
    const getwi=async function(...args){
      const selected=query(args),parent=createdToken===token&&closedFrames[frame]!==token?frame:activeRoot;
      const descriptor=parse(apply(open,undefined,argumentsList(parent,selected.key,selected.missing)));
      if(descriptor.refused)throw new Failure('owned template helper refused');
      if(descriptor.missing)return '';
      return await execute(descriptor.invocation,descriptor.factorySource);
    };
    const activation=(...args)=>{const selected=query(args);if(selected.missing)reject('TEMPLATE_ACTIVATION_NOT_ALLOWED');return activate(selected.key)};
    const values=argumentsList(getvar,getwi,activation,injectPrompts,uninjectPrompts);
    for(let i=0;i<${TEMPLATE_DECLARED_UNSUPPORTED_HELPERS_V1.length};i++)values[values.length]=unsupported;
    values[values.length]=value=>append(frame,value);
    values[values.length]=value=>{guard(value);return string(value)};
    await apply(apply(factory,undefined,values),undefined,argumentsList());
    const text=close(frame);closedFrames[frame]=token;return text;
  }
  const run=async source=>await execute(0,source);
  const invoke=async (actionJSON,nextCatalogJSON)=>{
    const action=parse(actionJSON);catalog=parse(nextCatalogJSON);token++;activeRoot=0;
    let accepted=null;
    if(action.kind==='filter'){
      const callback=callbacks[action.callbackOrdinal];
      if(typeof callback!=='function')reject('TEMPLATE_INJECTION_HANDLE_MISSING');
      accepted=await apply(callback,undefined,argumentsList());
      if(typeof accepted!=='boolean')reject('TEMPLATE_INJECTION_FILTER_BOOLEAN');
    }else{
      const disposer=batches[action.batchOrdinal];
      if(typeof disposer!=='function')reject('TEMPLATE_INJECTION_HANDLE_MISSING');
      apply(disposer,undefined,argumentsList());
    }
    close(0);closedFrames[0]=token;
    return encode(wire({accepted,nextBatchOrdinal:nextBatch,nextCallbackOrdinal:nextCallback,nextEffectOrdinal:nextEffect}));
  };
  return freeze({run,invoke});
})`
