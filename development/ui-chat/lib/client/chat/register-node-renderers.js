// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/register-node-renderers.ts; edit the TypeScript source.
import { NS } from "../locale.js";
import { AssistantNodeView } from "./AssistantNodeView.js";
import { CommandNodeView, ManualCompactionNodeView } from "./CommandNodeView.js";
import { CompactionNodeView, ContextMessageNodeView, RetryNodeView, TurnErrorNodeView, TurnMaxTokensNodeView, UnknownNodeView, UserMessageNodeView, SteeringMessageNodeView, } from "./MessageItem.js";
import { SystemPromptNodeView } from "./SystemPromptRow.js";
import { TurnProcessNodeView } from "./TurnProcessNodeView.js";
import { TurnTailNodeView } from "./TurnTailNodeView.js";
import { TurnTriggerNodeView } from "./TurnTriggerNodeView.js";
/**
 * Register this package's business renderers behind the keyed Chat Node seat.
 * Renderers whose output depends on the work-details mode receive the policy
 * through their own registration; the seat and the other renderers do not.
 * @param ctx - owning UI Conversation context.
 * @param performanceUsage - live statistics detail preference.
 * @param presentation - live presentation policy.
 */
export function registerChatNodeRenderers(ctx, performanceUsage, presentation) {
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'user',
        locale: NS,
        children: { 'conversation.chat.user-actions': { kind: 'list', scope: 'session' } },
    }, UserMessageNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'steering',
        locale: NS,
    }, SteeringMessageNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'context', locale: NS }, ContextMessageNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-trigger', locale: NS }, TurnTriggerNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'system-prompt', locale: NS }, SystemPromptNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'assistant-step',
        locale: NS,
        inject: () => ({ hooks: { presentation } }),
    }, AssistantNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'command',
        locale: NS,
        children: { 'conversation.chat.commandview': { kind: 'keyed', scope: 'session' } },
    }, CommandNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'manual-compaction', locale: NS }, ManualCompactionNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'compaction', locale: NS }, CompactionNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'model-retry', locale: NS }, RetryNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-error', locale: NS }, TurnErrorNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-max-tokens', locale: NS }, TurnMaxTokensNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'turn-process', locale: NS }, TurnProcessNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: 'turn-tail',
        locale: NS,
        inject: () => ({ hooks: { performanceUsage } }),
        children: {
            'conversation.chat.turnTail': { kind: 'list', scope: 'session' },
            'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
            'conversation.chat.roleplay-failure-actions': { kind: 'list', scope: 'session' },
        },
    }, TurnTailNodeView));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'unknown', locale: NS }, UnknownNodeView));
}
