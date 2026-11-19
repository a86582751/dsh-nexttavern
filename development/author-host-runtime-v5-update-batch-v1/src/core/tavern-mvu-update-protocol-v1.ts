/** One actual MVU196 update, advanced by accepted responses to real yields.
 * These records describe computation and carry no publication authority. */
import type {AuthorNativeMvuCommandInfo,AuthorNativeMvuContextWritesV1} from './author-native-mvu-hook-types.js'
import type {AuthorNativeMvuHookGraphV1} from './author-native-mvu-hook-graph.js'
import {validateAuthorNativeMvuHookGraphV1} from './author-native-mvu-hook-graph.js'
import type {TavernTemplateReadV1} from './tavern-template-types.mjs'

export interface Mvu196MacroProjectionV1 {
  readonly schemaVersion:1
  readonly expandedMessage:string
  readonly policySha256:string
  readonly reads:readonly TavernTemplateReadV1[]
}

export type Mvu196HookStage='update-started'|'command-parsed'|'command-parsed-for-zod'
  |'command-parsed-ended-for-zod'|'single-variable-updated'|'update-ended'|'update-ended-for-zod'
export type Mvu196UpdateInputV1=
  |{readonly schemaVersion:1;readonly encoding:'native-mvu-196-update-start-v1';readonly updateId:string;
    readonly message:string;readonly interests:readonly Mvu196HookStage[];readonly macros?:Mvu196MacroProjectionV1;
    readonly maintenance?:true}
  |{readonly schemaVersion:1;readonly encoding:'native-mvu-196-native-resume-v1';readonly updateId:string;
    readonly yieldOrdinal:number;readonly commands:readonly AuthorNativeMvuCommandInfo[];
    readonly interests:readonly Mvu196HookStage[]}
  |{readonly schemaVersion:1;readonly encoding:'native-mvu-196-update-resume-v1';readonly updateId:string;
    readonly yieldOrdinal:number;readonly graph:AuthorNativeMvuHookGraphV1;
    readonly contextWrites?:AuthorNativeMvuContextWritesV1;readonly interests:readonly Mvu196HookStage[]}
export type Mvu196UpdateProgressV1=
  |{readonly schemaVersion:1;readonly kind:'native-commands-ready';readonly updateId:string;readonly yieldOrdinal:number;
    readonly commands:readonly AuthorNativeMvuCommandInfo[]}
  |{readonly schemaVersion:1;readonly kind:'yield';readonly updateId:string;readonly yieldOrdinal:number;
    readonly stage:Mvu196HookStage;readonly graph:AuthorNativeMvuHookGraphV1}
  |{readonly schemaVersion:1;readonly kind:'complete';readonly updateId:string}

const stages:readonly string[]=['update-started','command-parsed','command-parsed-for-zod',
  'command-parsed-ended-for-zod','single-variable-updated','update-ended','update-ended-for-zod']
const commands:readonly string[]=['set','insert','assign','remove','unset','delete','add','move']
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const ordinal=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
function fail():never {throw Error('SCHEMA_UPDATE_PROTOCOL_INVALID')}
function exact(value:Record<string,unknown>,fields:readonly string[]) {
  if(Object.keys(value).length!==fields.length||fields.some(key=>!Object.hasOwn(value,key)))fail()
}

/** Already-budgeted JSON DATA enters through the runner once. No additional
 * clone, digest, sanitization or graph validation belongs to its consumers. */
export function assertMvu196ContextWritesV1(value:unknown):asserts value is AuthorNativeMvuContextWritesV1 {
  if(!object(value)||value.schemaVersion!==1||value.kind!=='keys'&&value.kind!=='replace')
    throw Error('SCHEMA_CONTEXT_INVALID')
  exact(value,['schemaVersion','kind',...(value.kind==='keys'?['keys']:[])])
  if(value.kind==='keys'&&(!Array.isArray(value.keys)||value.keys.some(key=>typeof key!=='string')))
    throw Error('SCHEMA_CONTEXT_INVALID')
}

/** Canonical literal records are admitted as DATA. Their operation semantics
 * remain with the single fixed-core generator that consumes them. */
export function assertMvu196CommandsV1(value:unknown):asserts value is readonly AuthorNativeMvuCommandInfo[] {
  if(!Array.isArray(value))fail()
  for(const command of value) {
    if(!object(command))fail()
    exact(command,['type','full_match','args','reason'])
    if(typeof command.type!=='string'||!commands.includes(command.type)||typeof command.full_match!=='string'
      ||typeof command.reason!=='string'||!Array.isArray(command.args)
      ||command.args.some(argument=>typeof argument!=='string'))fail()
  }
}

export function assertMvu196UpdateInputV1(value:unknown):asserts value is Mvu196UpdateInputV1 {
  if(!object(value)||value.schemaVersion!==1||typeof value.updateId!=='string'||!value.updateId.length
    ||!Array.isArray(value.interests)||value.interests.some(stage=>typeof stage!=='string'||!stages.includes(stage)))fail()
  if(value.encoding==='native-mvu-196-update-start-v1') {
    exact(value,['schemaVersion','encoding','updateId','message','interests',
      ...(Object.hasOwn(value,'macros')?['macros']:[]),...(Object.hasOwn(value,'maintenance')?['maintenance']:[])])
    if(typeof value.message!=='string')fail()
    if(Object.hasOwn(value,'maintenance')&&value.maintenance!==true)fail()
    if(value.macros!==undefined) {
      const macros=value.macros
      if(!object(macros))fail()
      exact(macros,['schemaVersion','expandedMessage','policySha256','reads'])
      if(macros.schemaVersion!==1||typeof macros.expandedMessage!=='string'
        ||typeof macros.policySha256!=='string'||!Array.isArray(macros.reads))fail()
    }
  }else if(value.encoding==='native-mvu-196-native-resume-v1') {
    exact(value,['schemaVersion','encoding','updateId','yieldOrdinal','commands','interests'])
    if(!ordinal(value.yieldOrdinal))fail()
    assertMvu196CommandsV1(value.commands)
  }else if(value.encoding==='native-mvu-196-update-resume-v1') {
    exact(value,['schemaVersion','encoding','updateId','yieldOrdinal','graph','interests',
      ...(Object.hasOwn(value,'contextWrites')?['contextWrites']:[])])
    if(!ordinal(value.yieldOrdinal))fail()
    validateAuthorNativeMvuHookGraphV1(value.graph)
    if(Object.hasOwn(value,'contextWrites'))assertMvu196ContextWritesV1(value.contextWrites)
  }else fail()
}

export function assertMvu196UpdateProgressV1(value:unknown):asserts value is Mvu196UpdateProgressV1 {
  if(!object(value)||value.schemaVersion!==1||typeof value.updateId!=='string'||!value.updateId.length)fail()
  if(value.kind==='complete')exact(value,['schemaVersion','kind','updateId'])
  else if(value.kind==='native-commands-ready') {
    exact(value,['schemaVersion','kind','updateId','yieldOrdinal','commands'])
    if(!ordinal(value.yieldOrdinal))fail()
    assertMvu196CommandsV1(value.commands)
  }else if(value.kind==='yield') {
    exact(value,['schemaVersion','kind','updateId','yieldOrdinal','stage','graph'])
    if(!ordinal(value.yieldOrdinal)||typeof value.stage!=='string'||!stages.includes(value.stage))fail()
    validateAuthorNativeMvuHookGraphV1(value.graph)
  }else fail()
}
