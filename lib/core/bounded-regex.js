// Generated from runtime/alpha3/src/core/bounded-regex.ts; edit the TypeScript source.
import { Worker } from 'node:worker_threads';
export const ST_REGEX_LIMITS = Object.freeze({
    inputChars: 2_000_000,
    patternChars: 4_096,
    replacementChars: 65_536,
    outputChars: 2_000_000,
    matches: 20_000,
    deadlineMs: 250,
    concurrentWorkers: 4,
});
const isRecord = (value) => typeof value === 'object' && value !== null;
const isAllowedFlags = (value) => /^[imsu]*$/.test(String(value ?? ''));
const isRegexPattern = (value) => isRecord(value) && typeof value.pattern === 'string' && value.pattern.length <= 512 && isAllowedFlags(value.flags);
// Never run a third-party expression on the Harness event loop. A timeout is
// enforced by the parent, including parsing/compilation, and destroys the worker.
let active = 0;
let replacementActive = 0;
const workerCode = `const {parentPort,workerData}=require('node:worker_threads');
const result=workerData.patterns.map(p=>{try{return new RegExp(p.pattern,p.flags).test(workerData.text)}catch{return false}});
parentPort.postMessage(result);`;
// The worker owns regex compilation and every exec call. Its parent can hard-stop
// catastrophic backtracking; output and match caps prevent expansion inside it.
const replacementWorkerCode = `(function(){const {parentPort,workerData}=require('node:worker_threads');
const {rule,input,limits}=workerData;
const fail=(reason,limit=null,observed=null)=>parentPort.postMessage({ok:false,reason,limit,observed});
let regex;
try{regex=new RegExp(rule.pattern,rule.flags)}catch{fail('invalid-rule');return}
let cursor=0,matches=0,length=0;const parts=[];
const add=(part)=>{length+=part.length;if(length>limits.outputChars)return false;parts.push(part);return true};
const expand=(match)=>{const tokens=/\\$([$&\x60']|[1-9][0-9]?|<[^>]+>)/g;let start=0,token;
  while((token=tokens.exec(rule.replacement))!==null){
    if(!add(rule.replacement.slice(start,token.index)))return false;
    const key=token[1];let value=token[0];
    if(key==='$')value='$';else if(key==='&')value=match[0];
    else if(key===String.fromCharCode(96))value=input.slice(0,match.index);
    else if(key==="'")value=input.slice(match.index+match[0].length);
    else if(key[0]==='<'){
      if(match.groups&&Object.hasOwn(match.groups,key.slice(1,-1)))value=match.groups[key.slice(1,-1)]??'';
    }else{const n=Number(key);
      if(n<match.length)value=match[n]??'';
      else if(key.length===2){const first=Number(key[0]);
        if(first<match.length)value=(match[first]??'')+key[1]}
    }
    if(!add(value))return false;
    start=token.index+token[0].length;
  }
  return add(rule.replacement.slice(start));
};
for(;;){const match=regex.exec(input);if(!match)break;
  if(matches>=limits.matches){fail('limit','matches',matches+1);return}
  if(!add(input.slice(cursor,match.index))||!expand(match)){fail('limit','outputChars',length);return}
  matches++;cursor=match.index+match[0].length;
  if(!regex.global)break;
  if(match[0].length===0){const i=regex.lastIndex;regex.lastIndex=i+(regex.unicode&&i<input.length
    &&input.codePointAt(i)>0xffff?2:1)}
}
if(!add(input.slice(cursor))){fail('limit','outputChars',length);return}
parentPort.postMessage({ok:true,text:parts.join(''),matches});})();`;
const stFailure = (reason, limit = null, observed = null) => ({ ok: false, reason, limit, observed,
    diagnostic: { schemaVersion: 1, reason, limit, observed, allowed: limit ? ST_REGEX_LIMITS[limit] : null } });
const stLimit = (limit, observed) => stFailure('limit', limit, observed);
export async function boundedSTRegexReplace(rule, input) {
    if (typeof input !== 'string')
        return stFailure('invalid-rule');
    if (input.length > ST_REGEX_LIMITS.inputChars)
        return stLimit('inputChars', input.length);
    if (!rule || typeof rule.pattern !== 'string' || typeof rule.flags !== 'string'
        || typeof rule.replacement !== 'string')
        return stFailure('invalid-rule');
    if (rule.pattern.length > ST_REGEX_LIMITS.patternChars)
        return stLimit('patternChars', rule.pattern.length);
    if (rule.replacement.length > ST_REGEX_LIMITS.replacementChars)
        return stLimit('replacementChars', rule.replacement.length);
    if (!/^(?!.*(.).*\1)[gimsuy]*$/.test(rule.flags))
        return stFailure('invalid-rule');
    if (replacementActive >= ST_REGEX_LIMITS.concurrentWorkers)
        return stFailure('busy', 'concurrentWorkers', replacementActive);
    replacementActive++;
    let worker;
    try {
        return await new Promise(resolve => {
            let settled = false;
            const done = (value) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            };
            const timer = setTimeout(() => done(stFailure('timeout', 'deadlineMs', ST_REGEX_LIMITS.deadlineMs)), ST_REGEX_LIMITS.deadlineMs);
            try {
                worker = new Worker(replacementWorkerCode, { eval: true,
                    workerData: { rule, input, limits: ST_REGEX_LIMITS },
                    resourceLimits: { maxOldGenerationSizeMb: 32, stackSizeMb: 2 } });
                worker.once('message', (result) => done(result.ok ? result
                    : stFailure(result.reason, result.limit, result.observed)));
                worker.once('error', () => done(stFailure('worker')));
                worker.once('exit', () => done(stFailure('worker')));
            }
            catch {
                done(stFailure('worker'));
            }
        });
    }
    finally {
        if (worker)
            await worker.terminate();
        replacementActive--;
    }
}
export async function boundedRegexMatch(patterns, text, { timeoutMs = 250 } = {}) {
    if (!Array.isArray(patterns) || patterns.length > 128 || typeof text !== 'string' || text.length > 32768
        || patterns.some(pattern => !isRegexPattern(pattern)))
        return { ok: false, reason: 'limit', matches: [] };
    if (!patterns.length)
        return { ok: true, matches: [] };
    if (active >= 4)
        return { ok: false, reason: 'busy', matches: [] };
    active++;
    let worker;
    try {
        return await new Promise(resolve => {
            let settled = false;
            const done = (value) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            };
            const timer = setTimeout(() => done({ ok: false, reason: 'timeout', matches: [] }), Math.min(500, Math.max(10, Number(timeoutMs))));
            try {
                worker = new Worker(workerCode, { eval: true, workerData: { patterns, text }, resourceLimits: { maxOldGenerationSizeMb: 24, stackSizeMb: 2 } });
                worker.once('message', (matches) => done({ ok: true, matches: matches }));
                worker.once('error', () => done({ ok: false, reason: 'worker', matches: [] }));
                worker.once('exit', () => done({ ok: false, reason: 'worker', matches: [] }));
            }
            catch {
                done({ ok: false, reason: 'worker', matches: [] });
            }
        });
    }
    finally {
        if (worker)
            await worker.terminate();
        active--;
    }
}
export function worldbookRegex(key, caseSensitive = false) {
    if (typeof key !== 'string')
        return { pattern: '', flags: 'i' };
    if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
        const end = key.lastIndexOf('/');
        return { pattern: key.slice(1, end), flags: key.slice(end + 1).replace(/[gy]/g, '') };
    }
    return { pattern: key, flags: caseSensitive ? '' : 'i' };
}
