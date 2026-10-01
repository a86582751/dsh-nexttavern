// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/ChatNodeSeat.tsx; edit the TypeScript source.
import { jsx as _jsx } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { JsonBlock } from '@deepseek-ai/dsh-client-ui-primitives';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { TURN_PROCESS_INDEPENDENT_KINDS, turnProcessAlwaysOpen, turnProcessMember } from "../contract/turn-process.js";
import { storedTurnProcessEntry } from "../stores.js";
import { useSearchableHidden } from "./searchable-hidden.js";
import css from './ChatView.module.css';
function turnDataOf(node) {
    const location = node?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.data : undefined;
}
function turnOf(node) {
    const location = node?.location;
    return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.turn : undefined;
}
/**
 * Subscribe, apply Turn-process visibility, and dispatch one stable Context key.
 * Policy reads select this seat's own conclusion, so a mode change re-renders
 * only seats whose visibility actually changes.
 */
export const ChatNodeSeat = memo(function ChatNodeSeat({ nodeKey, groupPart, useChatNode, useChatNodeProcess, usePresentation, cwd, openFile, openSkill, inspectCall, forkAt, loadImage, renderMessageImages, fileMentions, useStore, actions, renderSlot, t, }) {
    const node = useChatNode(nodeKey);
    const routedNode = node;
    const turn = turnOf(routedNode);
    const processPresentation = useChatNodeProcess(nodeKey);
    const processSpec = processPresentation?.spec;
    const storedEntry = useStore(state => processSpec === undefined
        ? undefined
        : storedTurnProcessEntry(state, processSpec.turn));
    const processEntry = processSpec !== undefined
        && storedEntry?.answerStep === (processSpec.answerStep ?? 0)
        ? storedEntry
        : undefined;
    const liveProcess = processPresentation !== undefined && !processPresentation.turnClosed;
    const interleavedInput = processPresentation?.hasInterleavedInput === true;
    const alwaysOpen = liveProcess || interleavedInput || turnProcessAlwaysOpen(routedNode);
    const processOpen = alwaysOpen || processEntry !== undefined;
    const setOpen = useCallback((open) => {
        if (processSpec !== undefined && !alwaysOpen) {
            actions.setTurnProcessOpen(processSpec.turn, processSpec.answerStep ?? 0, open);
        }
    }, [actions, processSpec, alwaysOpen]);
    const foldCompleted = usePresentation(policy => policy.foldCompletedTurns);
    // A loaded end makes a partial historical Turn eligible without its start.
    const processWindowReady = processSpec !== undefined
        && processPresentation !== undefined
        && foldCompleted
        && processPresentation.turn === processSpec.turn
        && (processPresentation.turnStarted || processPresentation.turnClosed);
    const processMember = routedNode !== undefined
        && processWindowReady
        && (turnProcessMember(routedNode, processSpec)
            || (liveProcess && !TURN_PROCESS_INDEPENDENT_KINDS.has(routedNode.kind)
                && routedNode.anchorSeq >= processSpec.processStartSeq)
            || (groupPart === 'reasoning' && routedNode.kind === 'assistant-step' && routedNode.data.step === processSpec.answerStep));
    const processAnswer = routedNode !== undefined
        && processWindowReady
        && !liveProcess
        && groupPart !== 'reasoning'
        && routedNode.kind === 'assistant-step'
        && routedNode.data.step === processSpec.answerStep;
    const ownsDisclosure = routedNode?.kind === 'turn-process' || processAnswer;
    const foldable = processWindowReady
        && (liveProcess || processMember || ownsDisclosure);
    const turnProcess = useMemo(() => processSpec === undefined
        ? undefined
        : {
            spec: processSpec,
            foldable,
            hasContent: !interleavedInput && (processPresentation?.hasExternalProcess === true || processSpec.inlineReasoning),
            open: processOpen,
            setOpen,
        }, [
        foldable, interleavedInput, processOpen, processSpec, processPresentation?.hasExternalProcess, setOpen,
    ]);
    const controllerInactive = routedNode?.kind === 'turn-process'
        && foldCompleted && !foldable;
    const compactAnswer = processAnswer
        && foldable
        && processPresentation.compactAnswer
        && !processOpen;
    const processHidden = controllerInactive || (foldable && processMember && !processOpen);
    const revealProcess = useCallback(() => {
        if (processMember)
            setOpen(true);
    }, [processMember, setOpen]);
    const wrapperRef = useSearchableHidden(processHidden, revealProcess);
    const [disclosureReset] = useState(() => createSnapshotStore(0));
    const turnData = turnDataOf(routedNode);
    const hookContext = useMemo(() => ({ turnData, disclosureReset }), [turnData, disclosureReset]);
    useEffect(() => {
        if (processMember && processHidden && wrapperRef.current?.hasAttribute('hidden')) {
            disclosureReset.set(disclosureReset.getSnapshot() + 1);
        }
    }, [processMember, processHidden, wrapperRef, disclosureReset]);
    const owner = useMemo(() => node === undefined
        ? null
        : {
            ...groupPart === undefined ? {} : { groupPart },
            cwd,
            openFile,
            openSkill,
            inspectCall,
            forkAt,
            loadImage,
            renderMessageImages,
            fileMentions,
            turnProcess,
        }, [
        node, groupPart, cwd, openFile, openSkill, inspectCall, forkAt,
        loadImage, renderMessageImages, fileMentions, turnProcess,
    ]);
    if (routedNode === undefined || owner === null)
        return null;
    // Runtime dispatch owns the correlation: every Node's discriminant is the
    // keyed-slot entry passed alongside that same Node. TypeScript does not
    // distribute an object containing a union into a union of objects itself.
    const routedOwner = { ...owner, node: routedNode };
    const flowKey = groupPart === undefined || groupPart === 'response' ? routedNode.key : JSON.stringify([routedNode.key, groupPart]);
    return (_jsx("div", { ref: wrapperRef, className: css.flowItem, "data-chat-anchor-key": flowKey, "data-chat-flow-key": flowKey, "data-chat-paging-anchor": routedNode.kind !== 'turn-process' || undefined, "data-chat-node-key": routedNode.key, "data-chat-group-part": groupPart, "data-chat-flow-kind": routedNode.kind, "data-chat-turn": turn, "data-turn-process-member": processMember || undefined, "data-turn-process-hidden": processHidden || undefined, "data-turn-process-answer": compactAnswer || undefined, children: renderSlot('conversation.chat.node', routedOwner, {
            entryKey: routedNode.kind,
            hookContext,
            fallback: (_jsx(JsonBlock, { label: t('message.unknownSurface', { type: routedNode.kind }), payload: routedNode.data, truncatedLabel: total => t('json.truncated', { total }) })),
        }) }));
});
