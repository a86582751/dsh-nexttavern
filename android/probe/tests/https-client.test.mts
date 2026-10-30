import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter,getEventListeners} from 'node:events';
import type {get} from 'node:https';
import {checkHttpsClient,PUBLIC_HTTPS_ENDPOINT} from '../https-client.mts';

class Request extends EventEmitter {
  destroyed=false;
  destroy(){this.destroyed=true;return this;}
}
class Response extends Request {
  statusCode=200;
  socket={authorized:true,getProtocol:()=> 'TLSv1.3'};
}
function fixture() {
  const request=new Request(),response=new Response();
  let callback:(value:Response)=>void=()=>{};
  let options:Record<string,unknown>={},endpoint:unknown;
  const transport=((url:unknown,input:Record<string,unknown>,receive:(value:Response)=>void)=>{
    endpoint=url;options=input;callback=receive;return request;
  }) as unknown as typeof get;
  const controller=new AbortController();
  const run=()=>checkHttpsClient({directory:'unused',signal:controller.signal},transport);
  return {request,response,controller,run,reply:()=>callback(response),
    options:()=>options,endpoint:()=>endpoint};
}

test('fixed HTTPS transport enforces ordinary certificate verification and exposes headers-only facts',async()=>{
  const f=fixture(),result=f.run();
  assert.equal(f.endpoint(),PUBLIC_HTTPS_ENDPOINT);
  assert.deepEqual(f.options(),{rejectUnauthorized:true,minVersion:'TLSv1.2',agent:false});
  f.response.statusCode=403; // Status is reported, not mistaken for service/model functionality.
  f.reply();
  assert.deepEqual(await result,{status:403,authorized:true,tlsVersion:'TLSv1.3'});
  assert.equal(f.response.destroyed,true);assert.equal(f.request.destroyed,true);
  assert.equal(getEventListeners(f.controller.signal,'abort').length,0);
});

test('unauthorized certificate and obsolete negotiated TLS cannot become a client pass',async()=>{
  for(const mode of ['certificate','protocol']) {
    const f=fixture(),result=f.run();
    if(mode==='certificate')f.response.socket.authorized=false;
    else f.response.socket.getProtocol=()=> 'TLSv1.1';
    f.reply();
    await assert.rejects(result,(error:unknown)=>(error as {code?:string}).code===
      (mode==='certificate'?'HTTPS_CERTIFICATE_UNAUTHORIZED':'HTTPS_TLS_PROTOCOL'));
    assert.equal(f.request.destroyed,true);
  }
});

test('client transport failure retains only a safe error code, not server text or headers',async()=>{
  for(const code of ['ERR_TLS_CERT_ALTNAME_INVALID','unsafe https://secret.test/?token=do-not-log']) {
    const f=fixture(),result=f.run();
    f.request.emit('error',Object.assign(new Error('credential=do-not-log raw server body'),{code}));
    await assert.rejects(result,(error:unknown)=>{
      assert.equal((error as Error).message,'Fixed HTTPS client transport/trust check failed');
      assert.equal((error as {code:string}).code,code.startsWith('ERR_')?code:'HTTPS_CLIENT_ERROR');
      assert.doesNotMatch(String(error),/do-not-log|secret\.test|raw server/);return true;
    });
  }
});

test('cancellation destroys the owned connection and a late response without emitting success',async()=>{
  const f=fixture(),result=f.run();f.controller.abort();
  await assert.rejects(result,(error:unknown)=>(error as {code:string}).code==='HTTPS_CLIENT_ABORTED');
  assert.equal(f.request.destroyed,true);assert.equal(getEventListeners(f.controller.signal,'abort').length,0);
  f.reply();assert.equal(f.response.destroyed,true);
  let calls=0;
  await assert.rejects(checkHttpsClient({directory:'unused',signal:f.controller.signal},(()=>{calls++;}) as unknown as typeof get));
  assert.equal(calls,0);
});
