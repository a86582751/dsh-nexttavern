import { Worker } from 'node:worker_threads'

// Never run a third-party expression on the Harness event loop. A timeout is
// enforced by the parent, including parsing/compilation, and destroys the worker.
let active = 0
const workerCode = `const {parentPort,workerData}=require('node:worker_threads');
const result=workerData.patterns.map(p=>{try{return new RegExp(p.pattern,p.flags).test(workerData.text)}catch{return false}});
parentPort.postMessage(result);`
export async function boundedRegexMatch(patterns, text, {timeoutMs=250} = {}) {
  if (!Array.isArray(patterns) || patterns.length>128 || typeof text!=='string' || text.length>32768
    || patterns.some(p=>typeof p?.pattern!=='string' || p.pattern.length>512 || !/^[imsu]*$/.test(p.flags ?? '')))
    return {ok:false,reason:'limit',matches:[]}
  if (!patterns.length) return {ok:true,matches:[]}
  if (active>=4) return {ok:false,reason:'busy',matches:[]}
  active++
  let worker
  try {
    return await new Promise(resolve => {
      let settled=false
      const done=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)}
      const timer=setTimeout(()=>done({ok:false,reason:'timeout',matches:[]}), Math.min(500,Math.max(10,timeoutMs)))
      try {
        worker=new Worker(workerCode,{eval:true,workerData:{patterns,text},resourceLimits:{maxOldGenerationSizeMb:24,stackSizeMb:2}})
        worker.once('message', matches=>done({ok:true,matches}))
        worker.once('error', ()=>done({ok:false,reason:'worker',matches:[]}))
        worker.once('exit', ()=>done({ok:false,reason:'worker',matches:[]}))
      } catch {done({ok:false,reason:'worker',matches:[]})}
    })
  } finally { if(worker) await worker.terminate(); active-- }
}

export function worldbookRegex(key, caseSensitive = false) {
  if (typeof key!=='string') return {pattern:'',flags:'i'}
  if (key.startsWith('/') && key.lastIndexOf('/')>0) {
    const end=key.lastIndexOf('/')
    return {pattern:key.slice(1,end),flags:key.slice(end+1).replace(/[gy]/g,'')}
  }
  return {pattern:key,flags:caseSensitive ? '' : 'i'}
}
