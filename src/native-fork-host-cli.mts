import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {auditHostActivation,activateHostForks,recoverInterruptedHostActivation,restoreHostForks,
  type HostActivationAudit,type HostActivationInput,type HostActivationControl} from './native-fork-host-activation.mts'

type Probe={executable:string,args:string[],timeoutMs:number}
type Request={schemaVersion:1,input:HostActivationInput,control:{lockPath:string,receiptPath:string,probe:Probe}}
type AuditFile={schemaVersion:1,input:HostActivationInput,audit:HostActivationAudit}

function readJson(file:string):unknown{
  if(!path.isAbsolute(file)||!fs.lstatSync(file).isFile())throw Error(`Regular absolute JSON file required: ${file}`)
  return JSON.parse(fs.readFileSync(file,'utf8'))
}

function request(file:string):Request{
  const value=readJson(file) as Partial<Request>
  const input=value.input,control=value.control,probe=control?.probe
  if(value.schemaVersion!==1||!input||typeof input.packageRoot!=='string'||
    typeof input.hostRoot!=='string'||!Array.isArray(input.anchors)||
    input.anchors.some(anchor=>typeof anchor!=='string')||!control||
    typeof control.lockPath!=='string'||typeof control.receiptPath!=='string'||
    !probe||typeof probe.executable!=='string'||!path.isAbsolute(probe.executable)||
    !Array.isArray(probe.args)||probe.args.some(arg=>typeof arg!=='string')||
    !Number.isInteger(probe.timeoutMs)||probe.timeoutMs<1||probe.timeoutMs>10_000)
    throw Error('Invalid host activation request')
  if(!fs.statSync(probe.executable).isFile())throw Error('Idle probe executable is not a file')
  return value as Request
}

function control(value:Request):HostActivationControl{
  const {lockPath,receiptPath,probe}=value.control
  return {lockPath,receiptPath,assertIdle:()=>{
    // No shell: the operator supplies an executable that exits 0 only while the
    // host is stopped. Both activation probes and every restore probe run under lock.
    const result=spawnSync(probe.executable,probe.args,{shell:false,stdio:'ignore',
      timeout:probe.timeoutMs,cwd:value.input.hostRoot,windowsHide:true})
    if(result.error||result.signal||result.status!==0)
      throw Error(`Host idle probe rejected: ${result.error?.message??result.signal??`exit ${result.status}`}`)
  }}
}

function writeNewJson(file:string,value:unknown):void{
  if(!path.isAbsolute(file))throw Error('Absolute audit output path required')
  const fd=fs.openSync(file,'wx',0o600)
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd)}
  finally{fs.closeSync(fd)}
}

/** Offline operator entry: audit, activate, restore, recover. No implicit host mutation. */
export function nativeForkHostCli(argv:string[]):unknown{
  const [action,...options]=argv
  if(!['audit','activate','restore','recover'].includes(action??'')||options.length%2!==0)
    throw Error('Usage: <audit|activate|restore|recover> --request <absolute JSON> [--audit <absolute JSON> | --audit-out <absolute JSON>]')
  const flags=new Map<string,string>()
  for(let i=0;i<options.length;i+=2){
    const flag=options[i]!,value=options[i+1]!
    if(!['--request','--audit','--audit-out'].includes(flag)||flags.has(flag))
      throw Error(`Unknown or duplicate option: ${flag}`)
    flags.set(flag,value)
  }
  if(!flags.has('--request')||action==='audit'&&
    (flags.size!==2||!flags.has('--audit-out'))||action==='activate'&&
    (flags.size!==2||!flags.has('--audit'))||
    (action==='restore'||action==='recover')&&flags.size!==1)
    throw Error('Invalid options for host activation action')
  const value=request(flags.get('--request')!)
  if(action==='audit'){
    const audit=auditHostActivation(value.input)
    const file:AuditFile={schemaVersion:1,input:value.input,audit}
    writeNewJson(flags.get('--audit-out')!,file)
    return {ok:true,action,auditPath:flags.get('--audit-out'),payloadSha256:audit.payloadSha256,
      packages:audit.plan.packages.length,replacements:audit.plan.applySteps.length/3}
  }
  if(action==='activate'){
    const file=readJson(flags.get('--audit')!) as Partial<AuditFile>
    if(file.schemaVersion!==1||JSON.stringify(file.input)!==JSON.stringify(value.input)||!file.audit)
      throw Error('Host audit input differs from request')
    return activateHostForks(value.input,file.audit,control(value))
  }
  return action==='restore'?restoreHostForks(value.input,control(value)):
    recoverInterruptedHostActivation(value.input,control(value))
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(nativeForkHostCli(process.argv.slice(2)),null,2)+'\n')}
  catch(error){process.stderr.write(`${String(error)}\n`);process.exitCode=1}
}
