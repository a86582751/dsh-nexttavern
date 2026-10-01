// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/ChatGroupSeat.tsx; edit the TypeScript source.
import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Stable process container; display policy changes visibility, never member parents. */
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { IconAgentPresetOutlineRegular, IconApiOutlineRegular, IconBrowseOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCodeOutlineRegular, IconEditOutlineRegular, IconGlobeOutlineRegular, IconPlanOutlineRegular, IconQuestionOutlineRegular, IconSearchOutlineRegular, IconSparkleRegular, IconThinkOutlineRegular, TextShimmer, } from '@deepseek-ai/dsh-client-ui-primitives';
import { storedTurnProcessEntry } from "../stores.js";
import { ChatNodeSeat } from "./ChatNodeSeat.js";
import { chatRenderKey } from "./render-entry.js";
import { processTitle } from "./step-process.js";
import { useSearchableHidden } from "./searchable-hidden.js";
import { useDisclosure } from "./use-disclosure.js";
import { useProcessScroll } from "./use-process-scroll.js";
import css from './ChatGroupSeat.module.css';
const PROCESS_TITLE_MINIMUM_MS = 150;
const PROCESS_ICONS = {
    thinking: _jsx(IconThinkOutlineRegular, {}),
    read: _jsx(IconBrowseOutlineRegular, { size: 14 }),
    readImage: _jsx(IconBrowseOutlineRegular, { size: 14 }),
    search: _jsx(IconSearchOutlineRegular, { size: 14 }),
    edit: _jsx(IconEditOutlineRegular, { size: 14 }),
    write: _jsx(IconEditOutlineRegular, { size: 14 }),
    commands: _jsx(IconApiOutlineRegular, {}),
    code: _jsx(IconCodeOutlineRegular, { size: 14 }),
    webSearch: _jsx(IconGlobeOutlineRegular, {}),
    webFetch: _jsx(IconBrowseOutlineRegular, { size: 14 }),
    subagents: _jsx(IconAgentPresetOutlineRegular, { size: 14 }),
    plan: _jsx(IconPlanOutlineRegular, {}),
    questions: _jsx(IconQuestionOutlineRegular, {}),
    tools: _jsx(IconSparkleRegular, { size: 14 }),
};
function sameLiveProcessTitle(left, right) {
    return left.activity === right.activity && left.detail === right.detail && left.preparing === right.preparing;
}
function useStableLiveProcessTitle(desired, active) {
    const [displayed, setDisplayed] = useState(desired);
    const displayedRef = useRef(displayed);
    const desiredRef = useRef(desired);
    const displayedAtRef = useRef(Date.now());
    useEffect(() => {
        desiredRef.current = desired;
        if (!active || sameLiveProcessTitle(displayedRef.current, desired))
            return;
        const remaining = PROCESS_TITLE_MINIMUM_MS - (Date.now() - displayedAtRef.current);
        const commit = () => {
            const next = desiredRef.current;
            displayedRef.current = next;
            displayedAtRef.current = Date.now();
            setDisplayed(next);
        };
        if (remaining <= 0) {
            commit();
            return;
        }
        const timer = setTimeout(commit, remaining);
        return () => { clearTimeout(timer); };
    }, [active, desired.activity, desired.detail, desired.preparing]);
    return active ? displayed : desired;
}
const GroupMembers = memo(function GroupMembers({ members, ...props }) {
    return members.map(member => _createElement(ChatNodeSeat, { ...props, key: chatRenderKey(member), nodeKey: member.key, ...member.groupPart === undefined ? {} : { groupPart: member.groupPart } }));
});
const ProcessGroupHeader = memo(function ProcessGroupHeader({ groupKey, useChatGroup, usePresentation, t, open, bodyId, toggle }) {
    const data = useChatGroup(groupKey, group => group?.data);
    const detailed = usePresentation(policy => data?.closed === false && policy.liveProcessDetail);
    const live = useStableLiveProcessTitle({
        activity: data?.summary.running ?? 'thinking',
        detail: data?.summary.runningDetail ?? '',
        preparing: data?.summary.preparing === true,
    }, data !== undefined && !data.closed);
    if (data === undefined)
        return null;
    const label = data.closed ? processTitle(data.summary, t)
        : live.preparing ? t(`message.stepProcess.prepare.${live.activity === 'thinking' ? 'tools' : live.activity}`)
            : t(`message.stepProcess.${live.activity}`);
    const detail = detailed && !data.closed ? live.detail : '';
    const title = detail === '' ? label : `${label}${t('message.turnProcess.separator')}${detail}`;
    const activity = data.closed ? data.summary.counts[0]?.kind ?? 'thinking' : live.activity;
    return (_jsxs("button", { type: "button", className: css.title, "aria-expanded": open, "aria-controls": bodyId, "data-process-activity": activity, onClick: (event) => { event.currentTarget.focus(); toggle(); }, children: [_jsxs("span", { className: css.leading, "aria-hidden": "true", children: [_jsx("span", { className: css.activityIcon, "data-step-process-icon": true, children: PROCESS_ICONS[activity] }), _jsx("span", { className: css.chevron, "data-step-process-chevron": true, children: open ? _jsx(IconChevronUpOutlineRegular, {}) : _jsx(IconChevronDownOutlineRegular, {}) })] }), _jsx(TextShimmer, { active: !data.closed, className: css.label, children: title })] }));
});
/** Render a process group with local disclosure and the existing outer-Turn visibility. */
export const ChatGroupSeat = memo(function ChatGroupSeat({ groupKey, useChatGroup, ...props }) {
    const members = useChatGroup(groupKey, group => group?.members);
    const turn = useChatGroup(groupKey, group => group?.data.turn);
    const closed = useChatGroup(groupKey, group => group?.data.closed);
    const foldCompleted = props.usePresentation(policy => policy.foldCompletedTurns);
    const { expanded: open, setExpanded: setOpen } = useDisclosure();
    const firstKey = members?.[0]?.key ?? '';
    const presentation = props.useChatNodeProcess(firstKey);
    const turnLocation = props.useChatNode(firstKey, (node) => {
        const location = node?.location;
        return location?.kind === 'turn' || location?.kind === 'step' ? location.turn : undefined;
    });
    const grouped = props.usePresentation(policy => policy.stepGrouping === 'collapsed'
        || (policy.stepGrouping === 'history' && turnLocation?.status !== 'open'));
    const reason = turnLocation?.end?.data.reason.kind;
    const alwaysOpen = presentation?.turnClosed === false || presentation?.hasInterleavedInput === true
        || reason === 'aborted' || reason === 'error';
    const spec = presentation?.spec;
    const selectStored = useCallback((state) => turn === undefined
        ? undefined : storedTurnProcessEntry(state, turn), [turn]);
    const stored = props.useStore(selectStored);
    const outerHidden = foldCompleted && presentation?.turnClosed === true && spec !== undefined
        && !alwaysOpen && stored?.answerStep !== (spec.answerStep ?? 0);
    const revealOuter = useCallback(() => {
        if (spec !== undefined && !alwaysOpen)
            props.actions.setTurnProcessOpen(spec.turn, spec.answerStep ?? 0, true);
    }, [props.actions, spec, alwaysOpen]);
    const rootRef = useSearchableHidden(outerHidden, revealOuter);
    useEffect(() => {
        if (outerHidden && rootRef.current?.hasAttribute('hidden'))
            setOpen(false);
    }, [outerHidden, rootRef, setOpen]);
    const reveal = useCallback(() => { setOpen(true); }, [setOpen]);
    const bodyRef = useSearchableHidden(grouped && !open, reveal);
    const contentRef = useRef(null);
    const bodyId = useId();
    const { edges, events, initialize } = useProcessScroll(bodyRef, contentRef, open, grouped);
    const toggle = useCallback(() => {
        if (!open)
            initialize(closed === false ? 'bottom' : 'top');
        setOpen(!open);
    }, [closed, initialize, open, setOpen]);
    if (members === undefined)
        return null;
    const classes = [css.body, !grouped ? css.expandedBody : '',
        grouped && edges.canScrollUp ? css.fadeTop : '', grouped && edges.canScrollDown ? css.fadeBottom : ''];
    return (_jsxs("div", { ref: rootRef, className: css.root, "data-chat-group-key": groupKey, "data-chat-flow-key": groupKey, "data-chat-anchor-key": `group:${groupKey}`, "data-chat-turn": turn, "data-chat-paging-anchor": grouped && !open || undefined, "data-step-process": true, "data-group-expanded-mode": !grouped || undefined, children: [_jsx("div", { hidden: !grouped, children: _jsx(ProcessGroupHeader, { groupKey: groupKey, useChatGroup: useChatGroup, usePresentation: props.usePresentation, t: props.t, open: open, bodyId: bodyId, toggle: toggle }) }), _jsx("div", { ref: bodyRef, id: bodyId, className: classes.join(' '), "data-step-process-body": true, "data-scroll-up": edges.canScrollUp || undefined, "data-scroll-down": edges.canScrollDown || undefined, ...events, children: _jsx("div", { ref: contentRef, className: css.content, "data-step-process-content": true, "data-chat-flow": "", children: _jsx(GroupMembers, { ...props, members: members }) }) })] }));
});
