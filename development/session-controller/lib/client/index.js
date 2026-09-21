// Generated from runtime/alpha3/compat/session-controller/src/client/index.ts; edit the TypeScript source.
import { typertOwnedValue } from '@deepseek-ai/dsh-typert-protocol';
import { createSessionControlStream } from './transport.js';
import { ClientSessions } from './sessions/service.js';
export { createSessionControlStream, SessionEventStream, SESSION_SEARCH_RESULT_LIMIT, SESSION_SEARCH_SNIPPET_MAX_CODE_POINTS, } from './transport.js';
export { createScope, scopeOf } from './scope.js';
export { SessionCreateError, SessionForkError } from './sessions/service.js';
export { MutableSessionEventSource } from './contract/events.js';
// Keep the official shared Context contract; the owned implementation must satisfy it.
/** Required Remote and Context projection services. */
export const inject = [
    'connection',
    'fileUpload',
    'typert',
    'remote',
    'remote.commands',
    'remote.session',
    'remote.subagents',
];
/**
 * Install Client Session state and its reconnecting control stream.
 * @param ctx - Client Cordis context.
 */
export function apply(ctx) {
    const remotes = ctx.remote;
    const connection = ctx.get('connection');
    const sessions = new ClientSessions(ctx, remotes);
    sessions;
    ctx.remote.$on('api-session/added', (summary) => { sessions.handleSessionAdded(summary); });
    ctx.remote.$on('api-session/removed', (sessionId) => { sessions.handleSessionRemoved(sessionId); });
    ctx.remote.$on('api-session/status', (sessionId, running) => {
        sessions.handleSessionStatus(sessionId, running);
    });
    ctx.remote.$on('api-session/activity', (sessionId, updatedAt) => {
        sessions.handleSessionActivity(sessionId, updatedAt);
    });
    ctx.remote.$on('api-session/error', (sessionId, message) => {
        sessions.handleSessionError(sessionId, message);
    });
    const control = createSessionControlStream(remotes, {
        accept: (frame) => { sessions.handleControlFrame(frame); },
        failed: (error) => { console.error('[session-controller] control stream failed:', error); },
    });
    const connected = () => {
        if (connection.generation.getSnapshot() === undefined)
            return;
        // A ready control baseline may arrive before Cordis delivers connection/reset.
        sessions.handleConnected();
        control.restart();
        control.start();
    };
    ctx.effect(() => connection.generation.subscribe(connected), 'session-controller.client.generation');
    connected();
    ctx.typert.contexts.registerClient('agent', {
        identity: candidate => sessions.sessionOf(candidate)?.sessionId,
        resolve: (sessionId) => {
            const reference = sessions.retainAgentScope(sessionId);
            return typertOwnedValue(reference.binding.ctx, () => { reference.release(); });
        },
    });
    ctx.effect(() => async () => { await control.dispose(); }, 'session-controller.client.control');
}
