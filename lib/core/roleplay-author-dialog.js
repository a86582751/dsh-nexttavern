// Generated from runtime/alpha3/src/core/roleplay-author-dialog.ts; edit the TypeScript source.
/** Frozen original dialogue request DATA. Native transport policy remains
 * with TaskHost: this module neither creates a provider nor invents user input. */
import { recordSha256 } from './roleplay-data.js';
import { freezeAuthorWorldbookDataV1 } from './roleplay-author-worldbook-journal.js';
export function freezeAuthorDialogPromptV1(input) {
    const body = { schemaVersion: 1, encoding: 'native-author-dialog-frozen-prompt-v1',
        authority: 'consumer-data-only', binding: Object.freeze({ ...input.binding }),
        root: input.root,
        operationId: input.operationId, generationId: input.generationId ?? input.operationId, mode: input.mode ?? 'raw',
        orderedMessages: Object.freeze(structuredClone(input.orderedMessages)), call: Object.freeze(structuredClone(input.call ?? {})),
        presentation: Object.freeze({ ...input.presentation ?? { stream: false, silence: true, returnReasoning: false } }),
        material: input.material,
        ...input.selection ? { selection: structuredClone(input.selection) } : {},
        ...input.ordinaryPreparationEvidence ? { ordinaryPreparationEvidence: input.ordinaryPreparationEvidence } : {}, };
    return freezeAuthorWorldbookDataV1({ ...body, promptSha256: recordSha256(body) });
}
