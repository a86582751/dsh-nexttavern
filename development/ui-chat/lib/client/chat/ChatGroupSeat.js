// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/ChatGroupSeat.tsx; edit the TypeScript source.
import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Stable process container; display policy changes visibility, never member parents. */
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconAgentPresetOutlineRegular, IconApiOutlineRegular, IconBrowseOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCodeOutlineRegular, IconEditOutlineRegular, IconGlobeOutlineRegular, IconPlanOutlineRegular, IconQuestionOutlineRegular, IconSearchOutlineRegular, IconSparkleRegular, IconThinkOutlineRegular, TextShimmer, } from '@deepseek-ai/dsh-client-ui-primitives';
import { storedTurnProcessEntry } from "../stores.js";
import { ChatNodeSeat } from "./ChatNodeSeat.js";
import { chatRenderKey } from "./render-entry.js";
import { processTitle } from "./step-process.js";
import { useSearchableHidden } from "./searchable-hidden.js";
import { useDisclosure } from "./use-disclosure.js";
import css from './ChatGroupSeat.module.css';
const PROCESS_SCROLL_AT_REST = { canScrollUp: false, canScrollDown: false };
const PROCESS_TITLE_MINIMUM_MS = 150;
const PROCESS_ICONS = {
    thinking: _jsx(IconThinkOutlineRegular, {}),
    read: _jsx(IconBrowseOutlineRegular, { size: 14 }),
    search: _jsx(IconSearchOutlineRegular, { size: 14 }),
    edit: _jsx(IconEditOutlineRegular, { size: 14 }),
    commands: _jsx(IconApiOutlineRegular, {}),
    code: _jsx(IconCodeOutlineRegular, { size: 14 }),
    webSearch: _jsx(IconGlobeOutlineRegular, {}),
    webFetch: _jsx(IconBrowseOutlineRegular, { size: 14 }),
    subagents: _jsx(IconAgentPresetOutlineRegular, { size: 14 }),
    plan: _jsx(IconPlanOutlineRegular, {}),
    questions: _jsx(IconQuestionOutlineRegular, {}),
    tools: _jsx(IconSparkleRegular, { size: 14 }),
};
function processScrollEdges(element) {
    return {
        canScrollUp: element.scrollTop > 1,
        canScrollDown: element.scrollTop < element.scrollHeight - element.clientHeight - 1,
    };
}
function sameProcessScrollEdges(left, right) {
    return left.canScrollUp === right.canScrollUp && left.canScrollDown === right.canScrollDown;
}
function sameLiveProcessTitle(left, right) {
    return left.activity === right.activity && left.detail === right.detail;
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
    }, [active, desired.activity, desired.detail]);
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
    }, data !== undefined && !data.closed);
    if (data === undefined)
        return null;
    const label = data.closed ? processTitle(data.summary, t) : t(`message.stepProcess.${live.activity}`);
    const detail = detailed && !data.closed ? live.detail : '';
    const title = detail === '' ? label : `${label}${t('message.turnProcess.separator')}${detail}`;
    const activity = data.closed ? data.summary.counts[0]?.kind ?? 'thinking' : live.activity;
    return (_jsxs("button", { type: "button", className: css.title, "aria-expanded": open, "aria-controls": bodyId, "data-process-activity": activity, onClick: (event) => { event.currentTarget.focus(); toggle(); }, children: [_jsxs("span", { className: css.leading, "aria-hidden": "true", children: [_jsx("span", { className: css.activityIcon, "data-step-process-icon": true, children: PROCESS_ICONS[activity] }), _jsx("span", { className: css.chevron, "data-step-process-chevron": true, children: open ? _jsx(IconChevronUpOutlineRegular, {}) : _jsx(IconChevronDownOutlineRegular, {}) })] }), _jsx(TextShimmer, { active: !data.closed, className: css.label, children: title })] }));
});
/** Render a process group with local disclosure and the existing outer-Turn visibility. */
export const ChatGroupSeat = memo(function ChatGroupSeat({ groupKey, useChatGroup, ...props }) {
    const members = useChatGroup(groupKey, group => group?.members);
    const turn = useChatGroup(groupKey, group => group?.data.turn);
    const foldCompleted = props.usePresentation(policy => policy.foldCompletedTurns);
    const { expanded: open, setExpanded: setOpen, toggle } = useDisclosure();
    const firstKey = members?.[0]?.key ?? '';
    const presentation = props.useChatNodeProcess(firstKey);
    const turnLocation = props.useChatNode(firstKey, (node) => {
        const location = node?.location;
        return location?.kind === 'turn' || location?.kind === 'step' ? location.turn : undefined;
    });
    const grouped = props.usePresentation(policy => turnLocation?.status !== 'open' || policy.stepGrouping !== 'none');
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
    const [edges, setEdges] = useState(PROCESS_SCROLL_AT_REST);
    const sync = useCallback(() => {
        const body = bodyRef.current;
        const next = body === null || body.closest('[hidden], [data-group-expanded-mode]') !== null
            ? PROCESS_SCROLL_AT_REST : processScrollEdges(body);
        setEdges(previous => sameProcessScrollEdges(previous, next) ? previous : next);
    }, [bodyRef]);
    // The content box reports growth even when the scroll body remains height-capped.
    useLayoutEffect(() => {
        const body = bodyRef.current;
        if (body === null || !open || typeof ResizeObserver === 'undefined')
            return;
        const observer = new ResizeObserver(sync);
        observer.observe(body);
        if (contentRef.current !== null)
            observer.observe(contentRef.current);
        return () => { observer.disconnect(); };
    }, [bodyRef, open, sync]);
    if (members === undefined)
        return null;
    const classes = [css.body, !grouped ? css.expandedBody : '',
        grouped && edges.canScrollUp ? css.fadeTop : '', grouped && edges.canScrollDown ? css.fadeBottom : ''];
    return (_jsxs("div", { ref: rootRef, className: css.root, "data-chat-group-key": groupKey, "data-chat-flow-key": groupKey, "data-chat-anchor-key": `group:${groupKey}`, "data-chat-turn": turn, "data-chat-paging-anchor": grouped && !open || undefined, "data-step-process": true, "data-group-expanded-mode": !grouped || undefined, children: [_jsx("div", { hidden: !grouped, children: _jsx(ProcessGroupHeader, { groupKey: groupKey, useChatGroup: useChatGroup, usePresentation: props.usePresentation, t: props.t, open: open, bodyId: bodyId, toggle: toggle }) }), _jsx("div", { ref: bodyRef, id: bodyId, className: classes.join(' '), "data-step-process-body": true, "data-scroll-up": edges.canScrollUp || undefined, "data-scroll-down": edges.canScrollDown || undefined, onScroll: sync, children: _jsx("div", { ref: contentRef, className: css.content, "data-step-process-content": true, "data-chat-flow": "", children: _jsx(GroupMembers, { ...props, members: members }) }) })] }));
});
