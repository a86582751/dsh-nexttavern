/** Tiny emulator transport diagnostic. No product, profile, credentials or UI. */
import {spawn} from 'node:child_process';
import {createProtocolFixture} from '../../android/host/protocol-fixture.mts';
const [adb,serial]=process.argv.slice(2);
if(!adb||serial!=='emulator-5554')throw Error('Expected the owned emulator');
const fixture=createProtocolFixture();
let received=0;
fixture.server.on('request',()=>received++);
await new Promise<void>(resolve=>fixture.server.listen(18765,'127.0.0.1',resolve));
async function run(args:string[]):Promise<{exit:number|null;signal:string|null;stdout:string;stderr:string}> {
  return new Promise((resolve,reject)=>{
    const child=spawn(adb,['-s',serial,...args],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    const timeout=setTimeout(()=>child.kill('SIGTERM'),10000);
    child.on('error',error=>{clearTimeout(timeout);reject(error)});
    child.on('close',(exit,signal)=>{clearTimeout(timeout);resolve({exit,signal,stdout,stderr})});
  });
}
const emit=(value:Record<string,unknown>)=>console.log(JSON.stringify({kind:'fixture-transport',...value}));
try {
  emit({hostStatus:(await fetch('http://127.0.0.1:18765/v1/models')).status});
  const reverse=await run(['reverse','tcp:18766','tcp:18765']);
  emit({step:'reverse-install',...reverse}); // Fixed no-auth local transport only.
  const mapping=await run(['reverse','--list']);emit({step:'reverse-list',...mapping});
  let failed=reverse.exit!==0;
  for(const [label,host,port,hold] of [
    ['alias-eof','10.0.2.2',18765,false],
    ['reverse-eof','127.0.0.1',18766,false],
    ['reverse-held','127.0.0.1',18766,true],
  ] as const) {
    const before=received;
    const request="printf 'GET /v1/models HTTP/1.1\\r\\nHost: fixture\\r\\nConnection: close\\r\\n\\r\\n'";
    const output=await run(['shell',`${hold?`{ ${request}; sleep 1; }`:request} | toybox nc -w 5 ${host} ${port}`]);
    const status=output.stdout.match(/^HTTP\/1\.[01] \d{3}[^\r\n]*/)?.[0]??null;
    emit({step:label,exit:output.exit,signal:output.signal,status,bytes:Buffer.byteLength(output.stdout),
      hostRequests:received-before,stderr:output.stderr.slice(0,500)});
    if(output.exit!==0||!status?.startsWith('HTTP/1.1 200'))failed=true;
  }
  emit({scope:'shell-transport-only-not-appuid',failed});
  if(failed)process.exitCode=1;
}finally{fixture.server.closeAllConnections();await new Promise<void>(resolve=>fixture.server.close(()=>resolve()))}
