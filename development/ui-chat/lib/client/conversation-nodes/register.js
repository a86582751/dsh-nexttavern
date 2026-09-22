// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/register.ts; edit the TypeScript source.
import { registerAssistantConversationNode } from "./assistant.js";
import { registerChatConversationView } from "./chat-snapshot-builder.js";
import { registerCommandConversationNode } from "./command.js";
import { registerCompactionConversationNode } from "./compaction.js";
import { registerUnknownConversationFallback } from "./fallback.js";
import { registerInboxConversationNodes } from "./inbox.js";
import { registerMessageConversationNode } from "./message.js";
import { registerMessageEdits } from "./message-edits.js";
import { registerRequestPromptConversationNode } from "./request-prompt.js";
import { registerRetryConversationNode } from "./retry.js";
import { registerToolConversationNode } from "./tool.js";
import { registerTurnErrorConversationNode } from "./turn-error.js";
import { registerTurnMaxTokensConversationNode } from "./turn-max-tokens.js";
import { registerTurnProcess } from "./turn-process.js";
import { registerTurnTailConversationNode } from "./turn-tail.js";
import { processGroupDefinition } from "./process-groups.js";
/**
 * Register the Chat business Definitions and target builder contributed by this package.
 * @param ctx - owning UI Conversation context.
 */
export function registerConversationNodes(ctx) {
    registerInboxConversationNodes(ctx);
    registerMessageConversationNode(ctx);
    registerMessageEdits(ctx);
    registerRequestPromptConversationNode(ctx);
    registerAssistantConversationNode(ctx);
    registerTurnProcess(ctx);
    registerToolConversationNode(ctx);
    registerCommandConversationNode(ctx);
    registerCompactionConversationNode(ctx);
    registerRetryConversationNode(ctx);
    registerTurnErrorConversationNode(ctx);
    registerTurnMaxTokensConversationNode(ctx);
    registerTurnTailConversationNode(ctx);
    registerUnknownConversationFallback(ctx);
    registerChatConversationView(ctx);
    ctx.uiConversation.groups.register(processGroupDefinition);
}
