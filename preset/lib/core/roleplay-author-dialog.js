// Generated from runtime/alpha3/src/core/roleplay-author-dialog.ts; edit the TypeScript source.
/** Frozen original dialogue request DATA. Native transport policy remains
 * with TaskHost: this module neither creates a provider nor invents user input. */
import { recordSha256 } from './roleplay-data.js';
export const AUTHOR_DIALOG_HOST_SLOTS_V1 = ['world_info_before', 'char_description',
    'char_personality', 'scenario', 'world_info_after'];
/** Match SystemPrompt.renderPrompt: empty sections are dropped, surviving
 * text is joined with two newlines, with no further interpolation. */
export function authorDialogSystemPrefixV1(prompt) {
    return prompt.orderedSystem.slice(0, 5).map(slot => slot.text).filter(text => text.length > 0).join('\n\n');
}
export function freezeAuthorDialogPromptV1(input) {
    const orderedSystem = Object.freeze([
        ...AUTHOR_DIALOG_HOST_SLOTS_V1.map(slot => Object.freeze({ role: 'system', slot, ...input.hostSlots[slot] })),
        Object.freeze({ role: 'system', slot: 'dynamic-system', ...input.dynamicSystem }),
    ]);
    const body = { schemaVersion: 1, encoding: 'native-author-dialog-frozen-prompt-v1',
        authority: 'consumer-data-only', binding: Object.freeze({ ...input.binding }),
        revision: Object.freeze({ revision: input.revision.revision,
            head: input.revision.head ? Object.freeze({ ...input.revision.head }) : null }),
        operationId: input.operationId, orderedSystem, shouldSilence: true, maxChatHistory: 0 };
    return Object.freeze({ ...body, promptSha256: recordSha256(body) });
}
