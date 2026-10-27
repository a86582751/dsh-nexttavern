/** Explicit opt-in transport/trust evidence, never a provider/model request. */
import {get} from 'node:https';
import type {ClientRequest, IncomingMessage} from 'node:http';
import type {TLSSocket} from 'node:tls';
import type {Evidence, ProbeContext} from './model.mts';

export const PUBLIC_HTTPS_ENDPOINT='https://example.com/';
function failure(error:unknown):Error {
  const code=(error as {code?:unknown})?.code;
  return Object.assign(new Error('Fixed HTTPS client transport/trust check failed'),{
    code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:'HTTPS_CLIENT_ERROR',
  });
}

/** The native supervisor sets the same locked SSL_CERT_FILE/DIR and empty
 * OPENSSL_CONF as mobile. No custom CA, credentials, redirect or TLS downgrade
 * is accepted here. The transport parameter is solely a focused unit seam. */
export function checkHttpsClient({signal}:ProbeContext,transport:typeof get=get):Promise<Evidence> {
  return new Promise((resolve,reject)=>{
    let request:ClientRequest|undefined,response:IncomingMessage|undefined,settled=false;
    const aborted=()=>finish(failure({code:(signal.reason as {code?:string})?.code==='PROBE_TIMEOUT'
      ?'PROBE_TIMEOUT':'HTTPS_CLIENT_ABORTED'}));
    const finish=(error?:Error,evidence?:Evidence)=>{
      if(settled)return;
      settled=true;signal.removeEventListener('abort',aborted);
      response?.destroy();request?.destroy(); // Headers only: never retain/log a body or pooled socket.
      if(error)reject(error);else resolve(evidence!);
    };
    if(signal.aborted) {aborted();return;}
    signal.addEventListener('abort',aborted,{once:true});
    try {
      request=transport(PUBLIC_HTTPS_ENDPOINT,{rejectUnauthorized:true,minVersion:'TLSv1.2',agent:false},received=>{
        received.once('error',error=>finish(failure(error)));
        if(settled) {received.destroy();return;}
        response=received;
        const socket=received.socket as TLSSocket;
        const tlsVersion=socket.getProtocol();
        if(socket.authorized!==true) {finish(failure({code:'HTTPS_CERTIFICATE_UNAUTHORIZED'}));return;}
        if(tlsVersion!=='TLSv1.2'&&tlsVersion!=='TLSv1.3') {finish(failure({code:'HTTPS_TLS_PROTOCOL'}));return;}
        if(!received.statusCode) {finish(failure({code:'HTTPS_HTTP_STATUS_MISSING'}));return;}
        // Even an HTTP error is transport evidence, not endpoint/API functionality.
        finish(undefined,{status:received.statusCode,authorized:true,tlsVersion});
      });
      request.once('error',error=>finish(failure(error)));
    } catch(error) {finish(failure(error));}
  });
}
