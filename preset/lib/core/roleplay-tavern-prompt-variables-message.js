// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-variables-message.ts; edit the TypeScript source.
/** Exact previous-message selection and readonly clonePreviousMessage data.
 * Membership/active swipe facts are required; no variables or flags are written. */
import { recordSha256 } from './roleplay-data.js';
import { promptExact, promptFail, promptFact, promptRef, promptRead, promptValues, TAVERN_PROMPT_VARIABLE_BOUNDS_V1 } from './roleplay-tavern-prompt-variables-data.js';
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function readPromptSelectedMessageDataV1(history, initial) {
    const reads = [];
    const unavailable = (missingEvidence, messageId = null, swipe = null) => ({ values: null, emptyChat: false, missingEvidence, reads,
        selection: { disposition: 'unavailable', messageId, swipe, previousMessageId: null, selectedValuesSha256: null } });
    if (history.kind === 'unavailable') {
        promptExact(history, ['kind', 'missingEvidence']);
        if (!Array.isArray(history.missingEvidence) || !history.missingEvidence.length
            || history.missingEvidence.some(value => typeof value !== 'string' || !value || value.length > 4096)) {
            promptFail('PROMPT_VARIABLE_HISTORY_UNAVAILABLE_INVALID');
        }
        return unavailable(history.missingEvidence);
    }
    const messages = history.messages;
    promptExact(history, ['kind', 'messageCount', 'selectedIndex', 'selectedSwipe', 'messages', 'membershipRef']);
    if (history.kind !== 'complete-prefix' || !integer(history.messageCount) || !Array.isArray(history.messages)
        || history.messages.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.historyMessages)
        promptFail('PROMPT_VARIABLE_HISTORY_INVALID');
    promptRef(history.membershipRef);
    reads.push(promptRead('history', 'complete-visible-prefix', recordSha256(history), history.membershipRef));
    if (history.messageCount === 0) {
        if (history.selectedIndex !== null || history.selectedSwipe !== null || history.messages.length) {
            promptFail('PROMPT_VARIABLE_EMPTY_HISTORY_INVALID');
        }
        return { values: {}, emptyChat: true, missingEvidence: [], reads,
            selection: { disposition: 'empty-chat', messageId: null, swipe: null, previousMessageId: null, selectedValuesSha256: recordSha256({}) } };
    }
    if (!integer(history.selectedIndex) || history.selectedIndex >= history.messageCount || !integer(history.selectedSwipe)
        || history.messages.length !== history.selectedIndex + 1)
        promptFail('PROMPT_VARIABLE_HISTORY_INCOMPLETE');
    const ids = new Set();
    for (const [index, row] of messages.entries()) {
        promptExact(row, ['index', 'messageId', 'activeSwipe', 'active', 'selectedSwipe', 'selected', 'selectedInitialized',
            'initializedRef', 'messageRef']);
        if (row.index !== index || typeof row.messageId !== 'string' || !row.messageId || row.messageId.length > 256
            || ids.has(row.messageId) || !integer(row.activeSwipe))
            promptFail('PROMPT_VARIABLE_MESSAGE_IDENTITY');
        ids.add(row.messageId);
        promptRef(row.messageRef);
        promptFact(row.active);
        reads.push(promptRead('message', `${row.messageId}:membership-active-swipe`, recordSha256(row), row.messageRef));
        if (index !== history.selectedIndex) {
            if (row.selectedSwipe !== null || row.selected !== null || row.selectedInitialized !== null || row.initializedRef !== null) {
                promptFail('PROMPT_VARIABLE_NONSELECTED_SWIPE_FACT');
            }
        }
        else {
            if (row.selectedSwipe !== history.selectedSwipe || !row.selected
                || row.selectedInitialized !== null && typeof row.selectedInitialized !== 'boolean') {
                promptFail('PROMPT_VARIABLE_SELECTED_SWIPE_INVALID');
            }
            if (row.initializedRef)
                promptRef(row.initializedRef);
            const selected = promptFact(row.selected), active = promptFact(row.active);
            // The same physical swipe cannot supply different initialized values or
            // presence facts through two aliases in this consumer packet.
            if (row.selectedSwipe === row.activeSwipe && recordSha256(row.selected) !== recordSha256(row.active)) {
                promptFail('PROMPT_VARIABLE_SELECTED_ACTIVE_MISMATCH');
            }
            if (selected.kind === 'known')
                reads.push({ ...selected.read, kind: 'message', identity: `${row.messageId}:${row.selectedSwipe}:own` });
            if (active.kind === 'unavailable' && row.selectedSwipe === row.activeSwipe
                && selected.kind !== 'unavailable')
                promptFail('PROMPT_VARIABLE_SELECTED_ACTIVE_MISMATCH');
        }
    }
    const selectedRow = messages[history.selectedIndex], own = promptFact(selectedRow.selected);
    if (!selectedRow.initializedRef)
        return unavailable(['selected.variables_initialized actual presence/value ref'], selectedRow.messageId, history.selectedSwipe);
    reads.push(promptRead('message', `${selectedRow.messageId}:${history.selectedSwipe}:initialized`, recordSha256({ initialized: selectedRow.selectedInitialized }), selectedRow.initializedRef));
    if (own.kind === 'unavailable')
        return unavailable(own.missingEvidence, selectedRow.messageId, history.selectedSwipe);
    const result = (values, disposition, previousMessageId) => ({ values: promptValues(values), emptyChat: false,
        missingEvidence: [], reads, selection: { disposition, messageId: selectedRow.messageId, swipe: history.selectedSwipe,
            previousMessageId, selectedValuesSha256: recordSha256(values) } });
    if (selectedRow.selectedInitialized === true)
        return result(own.values, 'already-initialized', null);
    // clonePreviousMessage returns before cloning if chat[message_id-1] is absent.
    if (history.selectedIndex === 0)
        return result(own.values, 'readonly-own-first-message', null);
    for (let index = history.selectedIndex - 1; index >= 0; index--) {
        const row = messages[index], fact = promptFact(row.active);
        if (fact.kind === 'unavailable')
            return unavailable(fact.missingEvidence, selectedRow.messageId, history.selectedSwipe);
        reads.push({ ...fact.read, kind: 'message', identity: `${row.messageId}:${row.activeSwipe}:previous-search` });
        if (row.active.kind === 'values') {
            // Fixed findPreviousMessageVariables uses values!=null, not the earlier
            // message's initialized flag. Never skip the nearest present object.
            return result({ ...fact.values, ...own.values }, 'readonly-previous-copy', row.messageId);
        }
    }
    if (initial.kind !== 'bound')
        return unavailable(['initial fallback for previous-message search', ...initial.missingEvidence], selectedRow.messageId, history.selectedSwipe);
    reads.push(...initial.reads);
    return result({ ...initial.binding.values, ...own.values }, 'readonly-initial-fallback', null);
}
