// Generated from runtime/alpha3/src/ui/chat-opening-card.ts; edit the TypeScript source.
import { createOpeningPanel } from './opening-panel.js';
/** A server-confirmed completed chat import owns this window. Upload previews,
 * tool text and resource-library selections cannot create a choice themselves. */
export function chatOpeningSource(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const row = value;
    if (row.channel !== 'chat-attachment' || row.status !== 'active'
        || typeof row.requestId !== 'string' || !/^chat-card-[a-f0-9]{64}$/.test(row.requestId)
        || typeof row.importId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(row.importId)
        || typeof row.rawSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.rawSha256)
        || row.sourceSha256 !== row.rawSha256 || typeof row.transactionId !== 'string' || !row.transactionId
        || typeof row.intentMessageId !== 'string' || !row.intentMessageId
        || typeof row.sourceMessageId !== 'string' || !row.sourceMessageId
        || !Number.isSafeInteger(row.sourceMessageSeq) || Number(row.sourceMessageSeq) < 0)
        return null;
    return { key: `${row.requestId}:${row.importId}:${row.transactionId}`,
        source: { importId: row.importId, rawSha256: row.rawSha256, transactionId: row.transactionId } };
}
export function createChatOpeningCard({ React, jsonFetch, toast, invalidateState }) {
    const Opening = createOpeningPanel({ React, jsonFetch, toast });
    return function ChatOpeningCard({ sessionId, cardImport, refreshToken }) {
        const [dismissed, setDismissed] = React.useState('');
        React.useEffect(() => {
            setDismissed('');
            const restore = () => setDismissed('');
            window.addEventListener('dsh-roleplay-view-activated', restore);
            return () => window.removeEventListener('dsh-roleplay-view-activated', restore);
        }, [sessionId]);
        const choice = chatOpeningSource(cardImport);
        if (!sessionId || !choice || dismissed === choice.key)
            return null;
        return React.createElement('div', { className: 'dsh-rp-chat-opening-window' }, React.createElement(Opening, { key: `${sessionId}:${choice.key}`, sessionId, refreshToken,
            presentation: 'card', expectedSource: choice.source, onDismiss: () => setDismissed(choice.key),
            onCompleted: () => { setDismissed(choice.key); invalidateState(sessionId); } }));
    };
}
