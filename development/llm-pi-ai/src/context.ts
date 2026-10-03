/**
 * Harness request-history conversion into pi-ai's Context vocabulary.
 *
 * @module dsh-llm-pi-ai/context
 */

import { brandString } from '@deepseek-ai/dsh-brand'
import { contentHasImage, IMAGE_OFFLOAD_REQUIRED_CODE, LlmError, offloadedImageText, projectOffloadedImages, requestImageHandleText, requiredImageOffload } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, ImageAttachmentAccessResolver, Message, RequestMessage, RequestMaterialMessageV1, ToolCallId } from '@deepseek-ai/dsh-llm'
import type {
  AttachmentId,
  AttachmentStore,
  ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import type { Context as PiContext, ImageContent, Message as PiMessage, TextContent, Tool as PiTool } from 'dsh-nexttavern-pi-ai'
import { toPiAssistant } from './replay.js'
import { requestImageDimensions } from '@deepseek-ai/dsh-attachment'
import { DEFAULT_REQUEST_IMAGE_MAX_BYTES, DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET } from './config.js'
import type {OrderedCompletionsInputV1,OrderedCompletionsMessageV1} from
  'dsh-nexttavern-pi-ai/api/openai-ordered-input'

/** Join the text blocks of a harness message. */
function flattenText(message: RequestMessage): string {
  return message.content
    .map(block => block.type === 'text' ? block.text : '')
    .join('')
}


/** Recover the pi-ai toolResult message for one harness tool-role message. */
function toolResultOf(
  message: Extract<Message, { role: 'tool' }>,
  toolNames: Map<ToolCallId, string>,
  content: string | (TextContent | ImageContent)[],
): PiMessage {
  return {
    role: 'toolResult',
    toolCallId: message.toolCallId,
    toolName: toolNames.get(message.toolCallId) ?? 'unknown',
    content: typeof content === 'string'
      ? [{ type: 'text', text: content || '(no output)' }]
      : content,
    isError: message.isError ?? false,
    timestamp: 0,
  }
}

/** Reject unsupported roles, tool-change blocks, and image roles before replay or image offloading. */
function assertSupportedHistory(messages: readonly RequestMessage[]): void {
  for (const message of messages) {
    // Developer history is persisted for V4; provider serialization is intentionally deferred.
    if (message.role === 'developer') throw new LlmError('Developer messages are not supported yet', 'UNSUPPORTED_CONTENT')
    if (message.content.some(block => block.type === 'tool-addition' || block.type === 'tool-removal')) {
      throw new LlmError('Tool-change blocks require developer role', 'UNSUPPORTED_CONTENT')
    }
    if (message.role !== 'user' && message.role !== 'tool' && contentHasImage(message.content)) {
      throw new LlmError(
        `pi-ai cannot represent an image in an in-history ${message.role} message`,
        'UNSUPPORTED_CONTENT',
      )
    }
  }
}

function userContent(
  blocks: readonly ContentBlock[],
  requestImages: ReadonlyMap<AttachmentId, RequestImageAttachment>,
  resolveImageAccess: ImageAttachmentAccessResolver,
): string | (TextContent | ImageContent)[] {
  const content: (TextContent | ImageContent)[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) content.push({ type: 'text', text: block.text })
        break
      case 'image': {
        const version = requestImages.get(block.attachment.attachmentId) as RequestImageAttachment
        content.push({
          type: 'text',
          text: requestImageHandleText(block.attachment, version, resolveImageAccess(block.attachment)),
        })
        content.push({
          type: 'image',
          data: Buffer.from(version.data).toString('base64'),
          mimeType: version.mediaType,
        })
        break
      }
      default:
        // Other merge-extensible blocks are not user-input vocabulary for pi-ai.
        break
    }
  }
  if (content.every(block => block.type === 'text')) return content.map(block => block.text).join('')
  return content
}

function collectImageRefs(
  blocks: readonly ContentBlock[],
  refs: Map<AttachmentId, ImageAttachmentRef>,
): void {
  for (const block of blocks) {
    if (block.type === 'image') {
      if (block.offloaded !== true) refs.set(block.attachment.attachmentId, block.attachment)
    }
  }
}

async function prepareRequestImages(
  messages: readonly RequestMessage[],
  attachments: AttachmentStore,
  budget: PiImageRequestBudget,
  signal?: AbortSignal,
): Promise<Map<AttachmentId, RequestImageAttachment>> {
  const refs = new Map<AttachmentId, ImageAttachmentRef>()
  for (const message of messages) collectImageRefs(message.content, refs)
  const orderedRefs = [...refs.values()]
  const prepared = await Promise.all(orderedRefs.map(
    ref => attachments.readImageRequest(ref, requestImageTarget(ref, budget), signal),
  ))
  const versions = new Map<AttachmentId, RequestImageAttachment>()
  for (const [index, ref] of orderedRefs.entries()) {
    versions.set(ref.attachmentId, prepared[index] as RequestImageAttachment)
  }
  return versions
}

function toolsOf(options: GenerateOptions): PiTool[] | undefined {
  // Deferred definitions are persisted for V4; provider loading is intentionally deferred.
  if (options.tools?.some(tool => tool.deferLoading === true)) {
    throw new LlmError('Deferred tool loading is not supported yet', 'UNSUPPORTED_CONTENT')
  }
  return options.tools?.map(tool => ({
    name: tool.name,
    description: tool.description,
    // ToolSchema.parameters is a JSON Schema object; pi-ai's TSchema
    // (TypeBox) is structurally JSON Schema, so it assigns directly.
    parameters: tool.parameters,
  }))
}

/** The request split into pi-ai's single `systemPrompt` slot and the history that converts to `messages`. */
interface SystemPromptSplit {
  /** Text for pi-ai's `systemPrompt`; `undefined` sends no system prompt. */
  systemPrompt: string | undefined
  /** History messages that convert to pi-ai `messages`. */
  messages: readonly RequestMessage[]
}

/**
 * Select the pi-ai `systemPrompt` source shared by both conversion paths.
 * `options.system` wins when defined and every history message converts,
 * including a leading `system` message, which then folds into a `user`
 * message. Otherwise a leading `system` history message supplies the prompt
 * and leaves the converted history; empty leading text sends no prompt.
 */
function splitSystemPrompt(options: GenerateOptions): SystemPromptSplit {
  if (options.system !== undefined) return { systemPrompt: options.system, messages: options.messages }
  const [first, ...rest] = options.messages
  if (first?.role !== 'system') return { systemPrompt: undefined, messages: options.messages }
  const text = flattenText(first)
  return { systemPrompt: text.length > 0 ? text : undefined, messages: rest }
}

/** Assemble the request-level pi-ai context envelope shared by both conversion paths. */
function piContext(systemPrompt: string | undefined, options: GenerateOptions, messages: PiMessage[]): PiContext {
  const tools = toolsOf(options)
  return {
    ...systemPrompt !== undefined ? { systemPrompt } : {},
    messages,
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
  }
}

function appendAssistant(
  message: Extract<Message|RequestMaterialMessageV1, { role: 'assistant' }>,
  messages: PiMessage[],
  toolNames: Map<ToolCallId, string>,
  onReplayDegrade?: (reason: string) => void,
): void {
  const assistant = toPiAssistant(message, onReplayDegrade)
  for (const block of assistant.content) {
    if (block.type === 'toolCall') toolNames.set(brandString<ToolCallId>(block.id), block.name)
  }
  messages.push(assistant)
}

/** Append the system and assistant roles both context builders treat identically; true when consumed. */
function appendSystemOrAssistant(
  message: RequestMessage,
  messages: PiMessage[],
  toolNames: Map<ToolCallId, string>,
  onReplayDegrade?: (reason: string) => void,
): boolean {
  if (message.role === 'system') {
    if(message.source.kind==='request-material'){
      throw new LlmError('pi-ai cannot retain system role at a request-only depth','REQUEST_MATERIAL_ROLE_POSITION_UNSUPPORTED')
    }
    // pi-ai has a single systemPrompt slot; a system message that did not
    // supply it folds into a user message to preserve order.
    messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
    return true
  }
  if (message.role === 'assistant') {
    appendAssistant(message, messages, toolNames, onReplayDegrade)
    return true
  }
  return false
}

function textOnlyContext(options: GenerateOptions, onReplayDegrade?: (reason: string) => void): PiContext {
  assertSupportedHistory(options.messages)
  const split = splitSystemPrompt(options)
  const toolNames = new Map<ToolCallId, string>()
  const messages: PiMessage[] = []
  for (const message of split.messages) {
    if (contentHasImage(message.content)) {
      throw new LlmError('pi-ai image conversion requires the durable attachment service', 'UNSUPPORTED_CONTENT')
    }
    if (appendSystemOrAssistant(message, messages, toolNames, onReplayDegrade)) continue
    if (message.role === 'tool') {
      messages.push(toolResultOf(message, toolNames, flattenText(message)))
      continue
    }
    messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
  }
  return piContext(split.systemPrompt, options, messages)
}

/** Inputs that bind deterministic request images to one current tool execution world. */
export interface PiImageRequestContext {
  /** Durable provider that resolves request-image bytes and provider-owned host objects. */
  attachments: AttachmentStore
  /** Resolve current tool access separately from deterministic request-image versions. */
  resolveImageAccess: ImageAttachmentAccessResolver
  /** Request-level bound on the base64-encoded payload of retained images; omission leaves the bound unchecked. */
  maxRequestImageBytes?: number
  /** Route pixel and raw encoded-byte budgets. */
  requestImagePolicy?: PiImageRequestBudget
}

/** Per-route budgets from which each request image's target is derived. */
export interface PiImageRequestBudget {
  /** Total-pixel budget; larger sources are downscaled proportionally. */
  maxPixels: number
  /** Encoded-byte target for one request image. */
  maxBytes: number
}

/** Deterministic request target for one source under the route budgets. */
function requestImageTarget(ref: ImageAttachmentRef, budget: PiImageRequestBudget): ImageRequestTarget {
  return { ...requestImageDimensions(ref.width, ref.height, budget.maxPixels), maxBytes: budget.maxBytes }
}

/**
 * Convert text-only harness history to a synchronous pi-ai Context. Tool
 * result names are recovered from preceding assistant tool calls.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - absent; selects the synchronous conversion.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the pi-ai context; `tools` is omitted when the request declares none.
 * @throws {LlmError} `UNSUPPORTED_CONTENT` for images in any history role, including a leading system message.
 */
export function toPiContext(
  options: GenerateOptions,
  images?: undefined,
  onReplayDegrade?: (reason: string) => void,
): PiContext
/**
 * Convert harness history to a pi-ai Context while resolving durable images.
 * Tool result names are recovered from preceding assistant tool calls. Image
 * occurrences the surface marks offloaded become text placeholders; when the
 * retained occurrences' exact base64 payload still exceeds
 * `maxRequestImageBytes`, the call fails with `IMAGE_OFFLOAD_REQUIRED` naming
 * how many more oldest occurrences must be offloaded.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - attachment provider, current path resolver, and request limits.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the asynchronously resolved pi-ai context.
 */
export function toPiContext(
  options: GenerateOptions,
  images: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): Promise<PiContext>
export function toPiContext(
  options: GenerateOptions,
  images?: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): PiContext | Promise<PiContext> {
  return images === undefined
    ? textOnlyContext(options, onReplayDegrade)
    : toPiContextWithImages(options, images, onReplayDegrade)
}

async function toPiContextWithImages(
  options: GenerateOptions,
  images: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): Promise<PiContext> {
  assertSupportedHistory(options.messages)
  const split=splitSystemPrompt(options)
  const prepared=await prepareImageHistory(split.messages,options.signal,images)
  const {requestImages,messages:exactMessages}=prepared
  const {resolveImageAccess}=images
  const toolNames = new Map<ToolCallId, string>()
  const messages: PiMessage[] = []

  for (const message of exactMessages) {
    if (appendSystemOrAssistant(message, messages, toolNames, onReplayDegrade)) continue
    if (message.role === 'tool') {
      messages.push(toolResultOf(message, toolNames, userContent(message.content, requestImages, resolveImageAccess)))
      continue
    }
    const content = userContent(message.content, requestImages, resolveImageAccess)
    messages.push({ role: 'user', content, timestamp: 0 })
  }

  return piContext(split.systemPrompt, options, messages)
}

/** Shared controlled image preparation. Each serializer keeps its own ordered
 * role grammar; this helper owns request versions, byte budgets and offloads. */
async function prepareImageHistory(messages:readonly RequestMessage[],signal:AbortSignal|undefined,
  images:PiImageRequestContext):Promise<{messages:readonly RequestMessage[];
    requestImages:ReadonlyMap<AttachmentId,RequestImageAttachment>}> {
  const { attachments, resolveImageAccess, maxRequestImageBytes } = images
  const requestImagePolicy = images.requestImagePolicy ?? {
    maxPixels: DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
    maxBytes: DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  }
  const requestImages=await prepareRequestImages(messages,attachments,requestImagePolicy,signal)
  if (maxRequestImageBytes !== undefined) {
    const offloadImages = requiredImageOffload(
      messages,
      { representation: 'base64', maxBytes: maxRequestImageBytes },
      block => (requestImages.get(block.attachment.attachmentId) as RequestImageAttachment).bytes,
    )
    if (offloadImages > 0) {
      throw new LlmError(
        `pi-ai request images exceed the ${maxRequestImageBytes}-byte base64 bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
        IMAGE_OFFLOAD_REQUIRED_CODE,
        { offloadImages },
      )
    }
  }
  const exactMessages = projectOffloadedImages(
    messages,
    ref => offloadedImageText(ref, resolveImageAccess(ref)),
  )
  return {messages:exactMessages,requestImages}
}

/** The protocol-specific input preserves every surviving system position.
 * LLM has already projected files and tool registry updates before this call.
 * Signatures/reasoning and tool images are explicit unsupported domains. */
export async function toOrderedCompletionsInputV1(options:GenerateOptions,images?:PiImageRequestContext,
  onReplayDegrade?:(reason:string)=>void):Promise<OrderedCompletionsInputV1> {
  if(options.system!==undefined&&options.messages.some(message=>message.source?.kind==='request-material')){
    throw new LlmError('ordered material requires the Native ordered system history','UNSUPPORTED_OPTION')
  }
  assertSupportedHistory(options.messages)
  for(const message of options.messages){
    if(message.role==='tool'&&contentHasImage(message.content)){
      throw new LlmError('ordered chat cannot move tool images into another message','UNSUPPORTED_CONTENT')
    }
  }
  let history:readonly RequestMessage[]=options.messages
  let versions:ReadonlyMap<AttachmentId,RequestImageAttachment>=new Map()
  if(images){const prepared=await prepareImageHistory(history,options.signal,images)
    history=prepared.messages;versions=prepared.requestImages}
  else if(history.some(message=>contentHasImage(message.content))){
    throw new LlmError('ordered chat images require the durable attachment service','UNSUPPORTED_CONTENT')
  }
  const messages:OrderedCompletionsMessageV1[]=[]
  if(options.system!==undefined&&options.system.length>0){
    // One-shot callers own a separate system slot. Place that slot first while
    // retaining the existing explicit-slot projection below. Native material
    // uses its branded history and does not manufacture this separate slot.
    const keys=new Set(history.map((message,index)=>message.id===undefined?`request-user-${index}`:String(message.id)))
    let index=0
    while(keys.has(`request-system-${index}`))index++
    messages.push({key:`request-system-${index}`,origin:'durable',role:'system',
      content:[{type:'text',text:options.system}]})
  }
  for(const [index,message] of history.entries()){
    const key=message.id===undefined?`request-user-${index}`:String(message.id)
    const origin=message.source?.kind==='request-material'?'request-material' as const:'durable' as const
    if(origin==='request-material'){
      const part=message.content[0]
      if(message.role==='tool'||message.role==='developer'||message.content.length!==1||part?.type!=='text'
        ||!part.text.trim()||!part.text.isWellFormed()){
        throw new LlmError('ordered material requires one unchanged scalar text block','UNSUPPORTED_CONTENT')
      }
      messages.push({key,origin,role:message.role,content:[{type:'text',text:part.text}]})
      continue
    }
    if(message.role==='assistant'){
      const replay=toPiAssistant(message,onReplayDegrade)
      if(replay.content.some(part=>part.type==='thinking'||part.type==='text'&&part.textSignature!==undefined
        ||part.type==='toolCall'&&part.thoughtSignature!==undefined)){
        throw new LlmError('ordered chat cannot discard signed or reasoning assistant history','UNSUPPORTED_CONTENT')
      }
      const content:Extract<OrderedCompletionsMessageV1,{role:'assistant'}>['content'][number][]=[]
      for(const part of message.content){
        if(part.type==='text')content.push({type:'text',text:part.text})
        else if(part.type==='tool-call')content.push({type:'tool-call',id:String(part.id),name:part.name,arguments:part.arguments})
        else throw new LlmError('ordered chat cannot represent this assistant block','UNSUPPORTED_CONTENT')
      }
      messages.push({key,origin:'durable',role:'assistant',content})
      continue
    }
    if(message.role==='user'){
      const prepared=images?userContent(message.content,versions,images.resolveImageAccess):flattenText(message)
      const content:Extract<OrderedCompletionsMessageV1,{role:'user'}>['content'][number][]=[]
      if(typeof prepared==='string')content.push({type:'text',text:prepared})
      else for(const part of prepared){
        if(part.type==='text')content.push({type:'text',text:part.text})
        else {
          const mime=part.mimeType
          if(mime!=='image/png'&&mime!=='image/jpeg'&&mime!=='image/webp'&&mime!=='image/gif'){
            throw new LlmError('ordered chat cannot represent this prepared image type','UNSUPPORTED_CONTENT')
          }
          content.push({type:'image',data:part.data,mimeType:mime})
        }
      }
      if(message.content.some(part=>part.type!=='text'&&part.type!=='image')){
        throw new LlmError('ordered chat cannot discard an unprojected user block','UNSUPPORTED_CONTENT')
      }
      messages.push({key,origin:'durable',role:'user',content})
      continue
    }
    if(message.role==='system'||message.role==='tool'){
      if(message.content.some(part=>part.type!=='text')){
        throw new LlmError('ordered system/tool history requires text','UNSUPPORTED_CONTENT')
      }
      const content=message.content.map(part=>({type:'text' as const,text:part.type==='text'?part.text:''}))
      if(message.role==='system')messages.push({key,origin:'durable',
        role:options.system===undefined?'system':'user',content})
      else messages.push({key,origin:'durable',role:'tool',toolCallId:String(message.toolCallId),content})
      continue
    }
    throw new LlmError('ordered chat requires projected developer history','UNSUPPORTED_CONTENT')
  }
  const tools=toolsOf(options)
  return {schemaVersion:1,encoding:'nexttavern-ordered-chat-completions-v1',messages,
    ...tools===undefined?{}:{tools}}
}
