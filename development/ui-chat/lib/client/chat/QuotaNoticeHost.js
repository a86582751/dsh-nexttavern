// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/QuotaNoticeHost.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * The frame-wide `shell.overlay` host for quota notices. It holds the one live
 * notice for the whole app, so leaving the Chat panel does not drop it. A
 * `shell.quota-notice` entry may replace the generic Toast for codes it claims.
 */
import { Fragment } from 'react';
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * @param props - the live notice, its dismissal, the chain outlet, and the locale seat.
 * @returns the notice on display, or null while none is live.
 */
export function QuotaNoticeHost({ useNotice, dismissNotice, keepNoticeOpen, renderSlotChain, t }) {
    const notice = useNotice(current => current);
    if (notice === null)
        return null;
    const owner = {
        code: notice.code, message: t('message.failure.quota'), dismiss: dismissNotice, keepOpen: keepNoticeOpen,
    };
    return (_jsx(Fragment, { children: renderSlotChain('shell.quota-notice', owner, {
            fallback: _jsx(Toast, { text: owner.message, icon: _jsx(IconWarningOutlineRegular, { size: 18 }), onDone: dismissNotice }),
        }) }, `quota-notice-${String(notice.seq)}`));
}
