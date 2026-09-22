// Generated from runtime/alpha3/compat/ui-chat/src/client/apply.ts; edit the TypeScript source.
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path';
import { EMPTY_CHAT_SNAPSHOT } from "./contract/snapshot.js";
import { ApprovalCommand } from "./chat/ApprovalCommand.js";
import { ChatView } from "./chat/ChatView.js";
import { registerChatNodeRenderers } from "./chat/register-node-renderers.js";
import { StatsPills } from "./chat/StatsPills.js";
import { registerConversationNodes } from "./conversation-nodes/register.js";
import { en, NS, zh } from "./locale.js";
import { TranscriptViewRow } from "./settings/TranscriptViewRow.js";
import { createChatStore } from "./stores.js";
import { TranscriptViewPolicy } from "./transcript-view.js";
import { derivePresentationPolicy } from "./presentation-policy.js";
import { CHAT_SETTINGS_NAMESPACE, DEFAULT_LINK_OPENING } from "../chat-settings.js";
import { LinkOpeningRow } from "./settings/LinkOpeningRow.js";
import { PerformanceUsageRow } from "./settings/PerformanceUsageRow.js";
import { PerformanceUsagePolicy } from "./performance-usage.js";
import { useTurnDataValue } from "./chat/use-turn-data.js";
import { bindDisclosure } from "./chat/use-disclosure.js";
const CHAT_NODE_INJECT = {
    hooks: {
        turnData: (_standard, { turnData }) => function useTurnData(key) {
            return useTurnDataValue(turnData, key);
        },
        disclosure: (_standard, { disclosureReset }) => bindDisclosure(disclosureReset),
    },
};
/** Services required by the Chat target and its presentation registrations. */
export const inject = [
    'slots', 'sessions', 'uiWorkspace', 'uiSession', 'uiConversation', 'locale',
    'configForms', 'remote', 'remote.session', 'sidebarRight',
];
/**
 * Mount all Chat-owned contributions.
 * @param ctx - Client root context.
 */
export function apply(ctx) {
    const chatSources = new WeakMap();
    const chatSource = (binding) => {
        let source = chatSources.get(binding);
        if (source === undefined) {
            const target = ctx.uiConversation.binding(binding).target('chat');
            source = {
                getSnapshot: () => target.getSnapshot() ?? EMPTY_CHAT_SNAPSHOT,
                subscribe: listener => target.subscribe(listener),
            };
            chatSources.set(binding, source);
        }
        return source;
    };
    registerConversationNodes(ctx);
    ctx.uiSession.provide({
        hooks: ['chat'],
        resolve: binding => ({ hooks: { chat: chatSource(binding) } }),
    });
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-chat: dictionaries');
    const t = ctx.locale.bind(NS);
    const chatStore = createChatStore();
    const chatScrollPositions = new Map();
    const chatSettings = ctx.configForms.get(CHAT_SETTINGS_NAMESPACE);
    const linkOpening = createSnapshotStore(chatSettings.getSnapshot().value?.linkOpening ?? DEFAULT_LINK_OPENING);
    ctx.effect(() => chatSettings.subscribe(() => {
        const accepted = chatSettings.getSnapshot().value?.linkOpening;
        if (accepted !== undefined)
            linkOpening.set(accepted);
    }));
    ctx.inject(['sidebarRightTabs'], (scope) => {
        const tabs = scope.sidebarRightTabs;
        const browserAvailable = {
            getSnapshot: () => tabs.get('browser') !== undefined,
            subscribe: listener => tabs.subscribe(listener),
        };
        scope.slots.inject('settings.general.item', () => scope.slots.register({
            name: 'settings.general.item',
            id: 'link-opening',
            order: 14,
            locale: NS,
            inject: () => ({
                hooks: { linkOpening, browserAvailable },
                setLinkOpening: (destination) => {
                    linkOpening.set(destination);
                    void chatSettings.set('linkOpening', destination).catch((_error) => {
                        // The local choice remains usable when persistence is unavailable.
                    });
                },
            }),
        }, LinkOpeningRow));
    });
    const transcriptView = new TranscriptViewPolicy(chatSettings);
    const presentation = derivePresentationPolicy(transcriptView.mode);
    const performancePolicy = new PerformanceUsagePolicy(chatSettings);
    ctx.effect(() => () => { transcriptView.dispose(); performancePolicy.dispose(); });
    const performanceUsage = performancePolicy.mode;
    registerChatNodeRenderers(ctx, performanceUsage, presentation);
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'performance-usage',
        order: 13,
        locale: NS,
        inject: () => ({
            hooks: { performanceUsage },
            setPerformanceUsage: (mode) => { performancePolicy.setMode(mode); },
        }),
    }, PerformanceUsageRow));
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'transcript-view',
        order: 12,
        locale: NS,
        inject: () => ({
            hooks: { transcriptView: transcriptView.mode },
            setTranscriptView: (mode) => { transcriptView.setMode(mode); },
        }),
    }, TranscriptViewRow));
    ctx.slots.inject('conversation.view', () => {
        const disposeView = ctx.slots.register({
            name: 'conversation.view',
            id: 'chat',
            order: 0,
            label: () => t('view.chat'),
            locale: NS,
            children: {
                'conversation.chat.node': { kind: 'keyed', scope: 'session', inject: CHAT_NODE_INJECT },
                'conversation.message.images': { kind: 'single', scope: 'session' },
                'conversation.chat.roleplay-progress': { kind: 'list', scope: 'session' },
            },
            store: chatStore,
            inject: (sessionId) => {
                const binding = ctx.sessions.binding(sessionId);
                if (binding === undefined)
                    throw new Error(`ui-chat: unknown session "${sessionId}"`);
                const session = binding.session;
                const chat = chatSource(binding);
                const conversation = ctx.uiConversation.binding(binding);
                return {
                    hooks: { presentation },
                    keyedHooks: {
                        chatNode: key => chat.getSnapshot().nodes.source(key),
                        chatNodeProcess: key => chat.getSnapshot().nodes.processSource(key),
                        chatGroup: key => conversation.snapshot.getSnapshot().views.grouped('chat')?.groupSource(key),
                    },
                    fileMentions: (owner) => ctx.get('chatFileMentions')?.forClosing(owner, sessionId),
                    // Files open in the right Sidebar, not in a desktop application: the
                    // content stays in the product, beside the conversation that produced
                    // it. A relative path, or an absolute one inside the session's
                    // workspace, is addressed under this session's scope,
                    // `dsh-resource://file/session/<id>/<path>`; an absolute path
                    // elsewhere keeps its absolute spelling in the same Session's address.
                    // Which tab type claims the
                    // address is the Sidebar's decision, not this call site's.
                    // A line travels as a navigation parameter, not as part of the
                    // address: the file is one piece of content whether it is opened at
                    // its top or at line 400, so the same tab is revealed and told where
                    // to land.
                    openFile: async (path, options) => {
                        const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
                        const url = fileAddressFor(sessionId, cwd, path);
                        if (options?.line === undefined)
                            ctx.sidebarRight.openResource(url);
                        else
                            ctx.sidebarRight.openResource(url, { params: { line: options.line } });
                        await Promise.resolve();
                    },
                    openSkill: (name) => {
                        const scope = ctx.sessions.scope(sessionId);
                        if (scope === undefined)
                            return;
                        ctx.get('inputTriggers')?.sessionOf(scope).openReference('skill', { ref: `/${name}` });
                    },
                    openExternalLink: (url) => {
                        if (linkOpening.getSnapshot() === 'sidebar' && ctx.get('sidebarRightTabs')?.get('browser') !== undefined) {
                            ctx.sidebarRight.openTab('browser', { params: { url } });
                        }
                        else {
                            window.open(url, '_blank', 'noopener,noreferrer');
                        }
                    },
                    loadOlder: () => { void session.loadOlder(); },
                    loadThrough: seq => session.loadThrough(seq),
                    loadImage: Object.assign((attachment) => ctx.uiConversation.imageUrl(sessionId, attachment), { peek: (attachment) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }),
                    chatScroll: {
                        save: (position) => {
                            if (position === null)
                                chatScrollPositions.delete(sessionId);
                            else
                                chatScrollPositions.set(sessionId, position);
                        },
                        read: () => chatScrollPositions.get(sessionId) ?? null,
                    },
                    forkAt: (seq) => {
                        ctx.sessions.fork({ sessionId, atSeq: seq, increaseTitle: true })
                            .then((childId) => { ctx.uiWorkspace.openSession(childId); })
                            .catch(() => {
                            // Fork or child-title failure leaves the source view unchanged.
                        });
                    },
                };
            },
        }, ChatView);
        return disposeView;
    });
    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock', id: 'stats', order: 0, locale: NS,
        inject: () => ({ hooks: { performanceUsage } }),
    }, StatsPills));
    ctx.slots.inject('conversation.approval.detail', () => ctx.slots.register({ name: 'conversation.approval.detail' }, ApprovalCommand));
}
