// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/TurnTriggerNodeView.tsx; edit the TypeScript source.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** An independent, expandable notice explaining a non-human Turn trigger. */
import { useId, useState } from 'react';
import { IconAgentPresetOutlineRegular, IconAlarmClockOutlineRegular, IconBranchOutlineRegular, IconChevronDownOutlineRegular, IconContextInjectionOutlineRegular, IconCordisPluginOutlineRegular, IconGoalOutlineRegular, IconGlobeOutlineRegular, IconPaperPlaneOutlineRegular, IconQueueOutlineRegular, } from '@deepseek-ai/dsh-client-ui-primitives';
import { formatMessageClock } from "./message-chrome.js";
import { NoticeBody } from "./ContextBody.js";
import { turnTriggerDetails } from "./turn-trigger.js";
import css from './TurnTriggerNodeView.module.css';
const TRIGGER_ICONS = {
    request: IconContextInjectionOutlineRegular,
    goal: IconGoalOutlineRegular,
    agent: IconPaperPlaneOutlineRegular,
    team: IconAgentPresetOutlineRegular,
    subagent: IconAgentPresetOutlineRegular,
    github: IconBranchOutlineRegular,
    webhook: IconGlobeOutlineRegular,
    schedule: IconAlarmClockOutlineRegular,
    job: IconQueueOutlineRegular,
    plugin: IconCordisPluginOutlineRegular,
};
/** Render recorded trigger attribution above the whole-Turn disclosure. */
export function TurnTriggerNodeView({ node, t }) {
    const [open, setOpen] = useState(false);
    const bodyId = useId();
    const details = turnTriggerDetails(node.data);
    const TriggerIcon = TRIGGER_ICONS[details.icon];
    const date = new Date(node.data.time);
    const time = formatMessageClock(node.data.time, t);
    return (_jsxs("section", { className: css.root, "data-turn-trigger": true, children: [_jsxs("button", { className: css.header, type: "button", "aria-expanded": open, "aria-controls": bodyId, onClick: () => { setOpen(!open); }, children: [_jsx("span", { className: css.icon, "aria-hidden": true, children: _jsx(TriggerIcon, { size: 14 }) }), _jsx("span", { className: css.title, children: t(details.title) }), _jsx("time", { className: css.time, dateTime: date.toISOString(), children: time }), _jsx(IconChevronDownOutlineRegular, { size: 12, className: open ? css.openChevron : css.chevron })] }), open && _jsxs("div", { id: bodyId, className: css.body, children: [_jsx("p", { className: css.explanation, children: t('message.trigger.explanation') }), _jsx("div", { className: css.content, children: _jsx(NoticeBody, { content: node.data.content, source: node.data.source, t: t }) })] })] }));
}
