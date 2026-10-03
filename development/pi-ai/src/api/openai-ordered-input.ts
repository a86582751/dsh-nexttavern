/** Protocol-local ordered input. Public digests describe data, never Native permission. */
import type {ChatCompletionMessageParam} from 'openai/resources/chat/completions.js';
import type {Tool} from '../types.js';

export interface OrderedTextPartV1 {readonly type:'text'; readonly text:string}
export interface OrderedUserImagePartV1 {
	readonly type:'image';
	readonly data:string;
	readonly mimeType:'image/png'|'image/jpeg'|'image/webp'|'image/gif';
}
export interface OrderedToolCallPartV1 {
	readonly type:'tool-call';
	readonly id:string;
	readonly name:string;
	/** Valid JSON object text, preserved verbatim rather than parsed and reserialized. */
	readonly arguments:string;
}
interface OrderedMessageBaseV1 {readonly key:string; readonly origin:'durable'|'request-material'}
export type OrderedCompletionsMessageV1 =
	| (OrderedMessageBaseV1 & {readonly role:'system'; readonly content:readonly OrderedTextPartV1[]})
	| (OrderedMessageBaseV1 & {readonly role:'user'; readonly content:readonly (OrderedTextPartV1|OrderedUserImagePartV1)[]})
	| (OrderedMessageBaseV1 & {readonly role:'assistant'; readonly content:readonly (OrderedTextPartV1|OrderedToolCallPartV1)[]})
	| (OrderedMessageBaseV1 & {readonly role:'tool'; readonly toolCallId:string; readonly content:readonly OrderedTextPartV1[]});
export interface OrderedCompletionsInputV1 {
	readonly schemaVersion:1;
	readonly encoding:'nexttavern-ordered-chat-completions-v1';
	readonly messages:readonly OrderedCompletionsMessageV1[];
	readonly tools?:readonly Tool[];
}
export interface OrderedCompletionsTraceRowV1 {
	readonly inputKey:string;
	readonly inputRole:OrderedCompletionsMessageV1['role'];
	readonly wireIndices:readonly [number];
	readonly transformation:'identity'|'text-parts-concatenated'|'prepared-user-image';
}
export interface OrderedCompletionsTraceReceiptV1 {
	readonly schemaVersion:1;
	readonly encoding:'nexttavern-ordered-chat-completions-trace-v1';
	readonly inputSha256:string;
	/** SHA256 of canonical ordered SDK messages JSON, not full HTTP params. */
	readonly wireSha256:string;
	readonly traceSha256:string;
	readonly trace:readonly OrderedCompletionsTraceRowV1[];
}
export interface OrderedCompletionsSerializationV1 extends OrderedCompletionsTraceReceiptV1 {
	readonly input:OrderedCompletionsInputV1;
	readonly messages:readonly ChatCompletionMessageParam[];
	readonly tools?:readonly Tool[];
	readonly hasToolHistory:boolean;
	readonly hasImages:boolean;
}

export class OrderedCompletionsInputError extends Error {
	readonly code='ORDERED_COMPLETIONS_UNSUPPORTED_INPUT';
	constructor(readonly path:string, reason:string) {
		super(`${path}: ${reason}`.slice(0, 512));
		this.name='OrderedCompletionsInputError';
	}
}
type Json = null|boolean|number|string|Json[]|{[key:string]:Json};
const POLICY = Object.freeze({maxBytes:8*1024*1024, maxNodes:131072, maxDepth:48,
	maxMessages:2048, maxParts:4096, maxTools:256, maxTextChars:1024*1024});
export const ORDERED_COMPLETIONS_POLICY_V1=POLICY;
function fail(path:string, reason:string):never {
	throw new OrderedCompletionsInputError(path, reason);
}
const utf8=new TextEncoder();

/** Take a detached data copy before the first hash await. Accessor values are
 * never evaluated. Native remains responsible for admitting actual plain input;
 * this descriptor is not an execution token or an arbitrary object bridge. */
function cloneJson(value:unknown):Json {
	let nodes=0, bytes=0;
	const active=new Set<object>();
	const charge=(amount:number, path:string) => {
		bytes+=amount;
		if (bytes>POLICY.maxBytes) fail(path,'descriptor exceeds byte bound');
	};
	const visit=(item:unknown, path:string, depth:number):Json => {
		if (++nodes>POLICY.maxNodes || depth>POLICY.maxDepth) fail(path,'descriptor exceeds structure bound');
		if (item===null || typeof item==='boolean') return item;
		if (typeof item==='string') {charge(utf8.encode(item).byteLength+2,path); return item;}
		if (typeof item==='number') {
			if (!Number.isFinite(item)) fail(path,'nonfinite JSON number');
			return item;
		}
		if (typeof item!=='object') return fail(path,'only plain JSON data is supported');
		if (active.has(item)) fail(path,'cyclic descriptor');
		const array=Array.isArray(item), proto=Object.getPrototypeOf(item);
		if (proto!==(array ? Array.prototype : Object.prototype) && !(proto===null && !array)) {
			fail(path,'nonplain descriptor object');
		}
		active.add(item);
		const descriptors=Object.getOwnPropertyDescriptors(item);
		const keys=Reflect.ownKeys(descriptors);
		for (const key of keys) {
			if (typeof key!=='string') fail(path,'symbol properties are unsupported');
			const descriptor=descriptors[key]!;
			if (!Object.hasOwn(descriptor,'value') || (!descriptor.enumerable && !(array && key==='length'))) {
				fail(`${path}/${key}`,'accessor or hidden data is unsupported');
			}
		}
		let result:Json;
		if (array) {
			const length=descriptors.length!.value as number;
			if (length>POLICY.maxParts) fail(path,'array exceeds element bound');
			if (keys.length!==length+1) fail(path,'sparse or extended arrays are unsupported');
			const output:Json[]=[];
			for (let index=0; index<length; index++) {
				const descriptor=descriptors[String(index)];
				if (!descriptor) fail(path,'sparse array');
				output.push(visit(descriptor.value,`${path}/${index}`,depth+1));
			}
			result=output;
		} else {
			const output:{[key:string]:Json}=Object.create(null);
			for (const key of keys as string[]) {
				charge(utf8.encode(key).byteLength+4,path);
				output[key]=visit(descriptors[key]!.value,`${path}/${key}`,depth+1);
			}
			result=output;
		}
		active.delete(item);
		charge(keys.length+2,path);
		return result;
	};
	return visit(value,'$',0);
}
function record(value:Json|undefined, path:string):{[key:string]:Json} {
	if (!value || typeof value!=='object' || Array.isArray(value)) return fail(path,'expected object');
	return value;
}
function exact(value:{[key:string]:Json}, required:string[], optional:string[], path:string) {
	for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) {
		fail(`${path}/${key}`,'unsupported field');
	}
	for (const key of required) if (!Object.hasOwn(value,key)) fail(`${path}/${key}`,'missing field');
}
function string(value:Json|undefined, path:string, max=POLICY.maxTextChars):string {
	if (typeof value!=='string' || value.length>max) return fail(path,'expected bounded string');
	for (let index=0; index<value.length; index++) {
		const unit=value.charCodeAt(index);
		if (unit>=0xdc00 && unit<=0xdfff) fail(path,'unpaired low surrogate');
		if (unit<0xd800 || unit>0xdbff) continue;
		const next=value.charCodeAt(++index);
		if (!(next>=0xdc00 && next<=0xdfff)) fail(path,'unpaired high surrogate');
	}
	return value;
}
function identity(value:Json|undefined,path:string):string {
	const result=string(value,path,256);
	if (result.length===0) fail(path,'empty identity');
	return result;
}
function protocolName(value:Json|undefined,path:string):string {
	const result=string(value,path,64);
	if (!/^[a-zA-Z0-9_-]+$/.test(result)) fail(path,'unsupported protocol identifier');
	return result;
}
function canonicalBase64(value:string):boolean {
	if (!value || value.length%4!==0) return false;
	const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const padding=value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
	const end=value.length-padding;
	for (let index=0; index<end; index++) if (alphabet.indexOf(value[index]!)<0) return false;
	for (let index=end; index<value.length; index++) if (value[index]!=='=') return false;
	if (padding===2 && (alphabet.indexOf(value[end-1]!)&15)!==0) return false;
	if (padding===1 && (alphabet.indexOf(value[end-1]!)&3)!==0) return false;
	return true;
}
function array(value:Json|undefined,path:string,max:number=POLICY.maxParts):Json[] {
	if (!Array.isArray(value) || value.length>max) return fail(path,'expected bounded array');
	return value;
}
function freeze<T>(value:T):T {
	if (value && typeof value==='object') {
		for (const child of Object.values(value)) freeze(child);
		Object.freeze(value);
	}
	return value;
}
function canonical(value:unknown):string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value && typeof value==='object') {
		return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(
			(value as Record<string,unknown>)[key])}`).join(',')}}`;
	}
	return JSON.stringify(value);
}
async function digest(value:unknown):Promise<string> {
	const bytes=utf8.encode(canonical(value));
	if (bytes.byteLength>POLICY.maxBytes) fail('$','serialized data exceeds byte bound');
	const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
	return Array.from(new Uint8Array(hash),byte => byte.toString(16).padStart(2,'0')).join('');
}

/** Strict single-request conversion. No generic transformMessages, synthetic
 * tool result, assistant bridge, Unicode repair, role change or message merge. */
export async function serializeOrderedCompletionsV1(raw:OrderedCompletionsInputV1):Promise<OrderedCompletionsSerializationV1> {
	const root=record(cloneJson(raw),'$');
	exact(root,['schemaVersion','encoding','messages'],['tools'],'$');
	if (root.schemaVersion!==1 || root.encoding!=='nexttavern-ordered-chat-completions-v1') {
		fail('$','unsupported ordered descriptor version');
	}
	const source=array(root.messages,'$/messages',POLICY.maxMessages);
	if (source.length===0) fail('$/messages','empty request');
	const tools:Tool[]|undefined=root.tools===undefined ? undefined : array(root.tools,'$/tools',POLICY.maxTools).map((rawTool,index) => {
		const path=`$/tools/${index}`, tool=record(rawTool,path);
		exact(tool,['name','description','parameters'],[],path);
		const parameters=record(tool.parameters,`${path}/parameters`);
		return {name:protocolName(tool.name,`${path}/name`),description:string(tool.description,`${path}/description`),
			parameters:parameters as unknown as Tool['parameters']};
	});
	if (tools && new Set(tools.map(tool => tool.name)).size!==tools.length) fail('$/tools','duplicate tool definition');
	const keys=new Set<string>(), callIds=new Set<string>(), pending=new Set<string>();
	const messages:ChatCompletionMessageParam[]=[], trace:OrderedCompletionsTraceRowV1[]=[];
	let hasImages=false, hasToolHistory=false, parts=0;
	for (const [index, rawMessage] of source.entries()) {
		const path=`$/messages/${index}`, message=record(rawMessage,path);
		const role=string(message.role,`${path}/role`,16);
		if (!['system','user','assistant','tool'].includes(role)) fail(`${path}/role`,'unsupported role');
		exact(message,['key','origin','role','content'],role==='tool' ? ['toolCallId'] : [],path);
		const key=identity(message.key,`${path}/key`);
		if (keys.has(key)) fail(`${path}/key`,'duplicate boundary key');
		keys.add(key);
		if (message.origin!=='durable' && message.origin!=='request-material') fail(`${path}/origin`,'unsupported origin');
		const material=message.origin==='request-material';
		const content=array(message.content,`${path}/content`);
		if (content.length===0 || (parts+=content.length)>POLICY.maxParts) fail(`${path}/content`,'empty or excessive content');
		if (pending.size!==0 && role!=='tool') fail(path,'cannot split an outstanding tool-call/result group');
		if (material && (role==='tool' || content.length!==1)) fail(path,'material must contain exactly one text part');
		const texts:string[]=[], userParts:({type:'text';text:string}|{type:'image_url';image_url:{url:string}})[]=[];
		const calls:{id:string;type:'function';function:{name:string;arguments:string}}[]=[];
		let messageHasImages=false;
		for (const [partIndex,rawPart] of content.entries()) {
			const partPath=`${path}/content/${partIndex}`, part=record(rawPart,partPath);
			if (part.type==='text') {
				if (calls.length!==0) fail(partPath,'text after tool calls cannot preserve block order in this dialect');
				exact(part,['type','text'],[],partPath);
				const text=string(part.text,`${partPath}/text`);
				if (material && text.trim().length===0) fail(`${partPath}/text`,'blank material text');
				texts.push(text); userParts.push({type:'text',text});
			} else if (part.type==='image' && role==='user' && !material) {
				exact(part,['type','data','mimeType'],[],partPath);
				const mime=string(part.mimeType,`${partPath}/mimeType`,32);
				if (!['image/png','image/jpeg','image/webp','image/gif'].includes(mime)) fail(`${partPath}/mimeType`,'unsupported image media type');
				const data=string(part.data,`${partPath}/data`,POLICY.maxBytes);
				if (!canonicalBase64(data)) {
					fail(`${partPath}/data`,'expected canonical base64 image data');
				}
				userParts.push({type:'image_url',image_url:{url:`data:${mime};base64,${data}`}});
				messageHasImages=true; hasImages=true;
			} else if (part.type==='tool-call' && role==='assistant' && !material) {
				exact(part,['type','id','name','arguments'],[],partPath);
				const id=protocolName(part.id,`${partPath}/id`), name=protocolName(part.name,`${partPath}/name`);
				if (callIds.has(id)) fail(`${partPath}/id`,'duplicate tool-call ID');
				const argumentsText=string(part.arguments,`${partPath}/arguments`);
				let parsed:unknown;
				try {parsed=JSON.parse(argumentsText);} catch {fail(`${partPath}/arguments`,'malformed tool arguments');}
				if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) fail(`${partPath}/arguments`,'tool arguments must be a JSON object');
				cloneJson(parsed);
				callIds.add(id); pending.add(id); hasToolHistory=true;
				calls.push({id,type:'function',function:{name,arguments:argumentsText}});
			} else fail(partPath,'unsupported content for this role/origin');
		}
		if (role==='system') messages.push({role:'system',content:texts.join('')});
		else if (role==='user') messages.push({role:'user',content:messageHasImages ? userParts : texts.join('')});
		else if (role==='assistant') messages.push({role:'assistant',content:texts.length ? texts.join('') : null,
			...(calls.length ? {tool_calls:calls} : {})});
		else {
			if (material || !Object.hasOwn(message,'toolCallId')) fail(path,'tool result must name its durable call ID');
			const id=protocolName(message.toolCallId,`${path}/toolCallId`);
			if (!pending.delete(id)) fail(`${path}/toolCallId`,'orphan or duplicate tool result');
			hasToolHistory=true; messages.push({role:'tool',tool_call_id:id,content:texts.join('')});
		}
		trace.push({inputKey:key,inputRole:role as OrderedCompletionsMessageV1['role'],wireIndices:[index],
			transformation:messageHasImages ? 'prepared-user-image' : texts.length>1 ? 'text-parts-concatenated' : 'identity'});
	}
	if (pending.size!==0) fail('$/messages','missing tool result at end of request');
	const input=root as unknown as OrderedCompletionsInputV1;
	freeze(input); freeze(messages); freeze(tools); freeze(trace);
	const inputSha256=await digest(input), wireSha256=await digest(messages);
	const traceSha256=await digest({schemaVersion:1,inputSha256,wireSha256,trace});
	return freeze({schemaVersion:1 as const,encoding:'nexttavern-ordered-chat-completions-trace-v1' as const,
		input,messages,...tools===undefined ? {} : {tools},hasImages,hasToolHistory,
		inputSha256,wireSha256,traceSha256,trace});
}
