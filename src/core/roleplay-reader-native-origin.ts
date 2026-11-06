import {createServer} from 'node:http'
import type {Server} from 'node:http'
import {randomUUID} from 'node:crypto'

/** Serves one public static bootstrap only. Each Surface permission group gets
 * a fresh hostname; Source snapshots, credentials and Core requests never enter it. */
export function createReaderNativeOriginService({shellHtml,remoteOriginTemplate}:{
  shellHtml:string;remoteOriginTemplate?:string
}) {
  if(remoteOriginTemplate!==undefined) {
    try {
      const first=new URL(remoteOriginTemplate.replaceAll('{nonce}','a'.repeat(32)))
      const second=new URL(remoteOriginTemplate.replaceAll('{nonce}','b'.repeat(32)))
      if(!remoteOriginTemplate.includes('{nonce}')||first.protocol!=='https:'||second.protocol!=='https:'
        ||first.hostname===second.hostname)throw Error('template')
    }catch {throw Error('READER_NATIVE_ORIGIN_TEMPLATE_UNSUPPORTED')}
  }
  let server:Server|undefined,listening:Promise<number>|undefined,closing:Promise<void>|undefined,disposed=false
  function localPort():Promise<number> {
    return listening??=new Promise<number>((resolve,reject)=>{
      server=createServer((request,response)=>{
        if(request.method!=='GET'||request.url!=='/reader-native/'){
          response.writeHead(404);response.end();return
        }
        response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(shellHtml)
      })
      const failed=(error:Error)=>reject(error)
      server.once('error',failed)
      server.listen(0,'127.0.0.1',()=>{
        server!.off('error',failed)
        resolve((server!.address() as {port:number}).port)
      })
    })
  }
  return {
    async acquire():Promise<{url:string}> {
      if(disposed)throw Error('READER_NATIVE_ORIGIN_DISPOSED')
      const nonce=randomUUID().replaceAll('-','')
      if(remoteOriginTemplate!==undefined)return {url:new URL(remoteOriginTemplate.replaceAll('{nonce}',nonce)).href}
      const port=await localPort()
      if(disposed)throw Error('READER_NATIVE_ORIGIN_DISPOSED')
      return {url:`http://${nonce}.localhost:${port}/reader-native/`}
    },
    dispose():Promise<void> {
      disposed=true
      return closing??=(async()=>{
        if(!listening)return
        try {await listening}catch {return}
        await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()))
      })()
    },
  }
}
