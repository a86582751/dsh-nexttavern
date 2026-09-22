// Generated from runtime/alpha3/compat/ui-workspace/src/client/session-actions/RowActionToast.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * The `shell.overlay` entry for Workspace and Session notices.
 * One notice is visible at a time; a parent rerender does not extend its hold.
 */
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives';
import { assertNever } from '@deepseek-ai/dsh-util-values';
/**
 * Hold for the notices that take longer to read than a one-line warning: the
 * actionable archived notice (two buttons to react to) and a refused Session
 * creation, which quotes the Host's reason.
 */
const LONG_TOAST_HOLD_MS = 6000;
/**
 * Render the current notice: the archived and stopped-and-archived notices
 * with their undo and show-archived actions on a 6 s hold, a refused Session
 * creation with the Host's reason on the same hold, or a plain warning for a
 * failed pin, an archived row that was clicked, or default Workspace creation.
 * @param props - the notice hook, its dismissal, the two archived-notice actions, and the locale seat.
 * @returns the notice on display, or null.
 */
export function RowActionToast({ useToast, dismissToast, undoArchive, showArchived, t }) {
    const toast = useToast(current => current);
    if (toast === null)
        return null;
    if (toast.kind === 'archived' || toast.kind === 'stoppedAndArchived') {
        const { sessionId } = toast;
        return (_jsx(Toast, { text: t(toast.kind === 'archived' ? 'toast.archived' : 'toast.stoppedAndArchived'), tone: "success", holdMs: LONG_TOAST_HOLD_MS, actions: [
                { label: t('toast.archivedUndo'), onClick: () => { dismissToast(); undoArchive(sessionId); } },
                { prefix: t('toast.archivedOr'), label: t('toast.archivedFilter'), onClick: () => { dismissToast(); showArchived(); } },
            ], onDone: dismissToast }, `toast-${String(toast.seq)}`));
    }
    if (toast.kind === 'createFailed') {
        return (_jsx(Toast, { text: t('toast.createFailed', { message: toast.message }), icon: _jsx(IconWarningOutlineRegular, {}), holdMs: LONG_TOAST_HOLD_MS, onDone: dismissToast }, `toast-${String(toast.seq)}`));
    }
    return (_jsx(Toast, { text: plainNoticeText(toast, t), icon: _jsx(IconWarningOutlineRegular, {}), onDone: dismissToast }, `toast-${String(toast.seq)}`));
}
/** The copy of one plain warning, keyed by the notice kind the union closes over. */
function plainNoticeText(toast, t) {
    switch (toast.kind) {
        case 'pinFailed': return t('toast.pinFailed');
        case 'unpinFailed': return t('toast.unpinFailed');
        case 'defaultWorkspaceFailed': return t('defaultWorkspace.failed');
        case 'archivedNotOpenable': return t('toast.archivedNotOpenable');
        /* v8 ignore next 2 -- closed-union backstop; only reached if a notice kind is forged */
        default:
            return assertNever(toast);
    }
}
