// Generated from runtime/alpha3/src/core/tavern-lore-template-feedback.mts; edit the TypeScript source.
/** Standalone selected-entry rendering and replay ledger. Nested frames remain
 * invocation-scoped Root audit; they never replace another entry's receipt. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { exact, sealTavernLoreSnapshotV1, LORE_EVALUATOR_POLICY_V1, freezeLoreData } from './tavern-lore-snapshot.mjs';
import { refuse } from './tavern-lore-match.mjs';
import { tavernLoreEntrySemanticSha256V1 } from './tavern-lore-timed.mjs';
export class TavernLoreTemplateFeedbackStateV1 {
    plan;
    eligible;
    checkpoint;
    producer;
    defaultSignal;
    snapshot;
    receipts = new Map();
    rows = new Map();
    consumed = new Set();
    scanRows = new Map();
    consumedScans = new Set();
    constructor(plan, snapshot, eligible, checkpoint, producer, defaultSignal) {
        this.plan = plan;
        this.eligible = eligible;
        this.checkpoint = checkpoint;
        this.producer = producer;
        this.defaultSignal = defaultSignal;
        this.snapshot = snapshot;
        if (producer && (snapshot.renderedTexts.length || (snapshot.activationFeedback?.length ?? 0)
            || (snapshot.injectionFeedback?.length ?? 0))) {
            refuse('LORE_TEMPLATE_PREPARATION_NOT_FRESH');
        }
        for (const receipt of snapshot.renderedTexts) {
            const resolved = resolveTavernLoreContentTextV1(plan, receipt.pointer);
            if (resolved.contentSha256 !== receipt.rawContentSha256)
                refuse('LORE_TEMPLATE_SOURCE_MISMATCH');
            this.receipts.set(receipt.pointer, receipt);
        }
        for (const row of snapshot.activationFeedback ?? [])
            this.rows.set(row.request.entryId, row);
        for (const row of snapshot.injectionFeedback ?? [])
            this.scanRows.set(`${row.loop}:${row.stage}`, row);
    }
    async scan(loop, state, stage) {
        const key = `${loop}:${stage}`;
        if (this.consumedScans.has(key))
            refuse('LORE_INJECTION_SCAN_REPEATED');
        let row = this.scanRows.get(key);
        if (this.producer?.consumeScan) {
            this.checkpoint();
            const result = await this.producer.consumeScan({ loop, state, stage }, this.producer.signal ?? this.defaultSignal);
            this.checkpoint();
            const output = cloneSchemaData(result, LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes, { nodes: 100000, depth: 48 });
            exact(output, ['contributions', 'activationProposals']);
            if (Array.isArray(output.contributions) && !output.contributions.length
                && Array.isArray(output.activationProposals) && !output.activationProposals.length) {
                this.consumedScans.add(key);
                return { contributions: [], activationProposals: [] };
            }
            const body = { loop, state, stage, contributions: output.contributions, activationProposals: output.activationProposals,
                producerIdentity: this.producer.identity, producerImplementationSha256: this.producer.implementationSha256 };
            row = { ...body, feedbackSha256: recordSha256(body) };
            this.snapshot = sealTavernLoreSnapshotV1({ ...this.snapshot, injectionFeedback: [...(this.snapshot.injectionFeedback ?? []), row] });
            row = this.snapshot.injectionFeedback.at(-1);
            this.scanRows.set(key, row);
        }
        this.consumedScans.add(key);
        if (!row)
            return { contributions: [], activationProposals: [] };
        if (row.loop !== loop || row.state !== state || row.stage !== stage)
            refuse('LORE_INJECTION_SCAN_REPLAY_CHANGED');
        for (const proposal of row.activationProposals)
            this.activation(proposal);
        return { contributions: row.contributions, activationProposals: row.activationProposals };
    }
    activation(proposal) {
        const entry = this.plan.entries.find(item => item.entryId === proposal.entryId);
        if (!entry || entry.rawEntrySha256 !== proposal.rawEntrySha256)
            refuse('LORE_FEEDBACK_ENTRY_UNKNOWN', proposal.entryId);
        const semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, displayIndex: entry.ordinal, ...entry.semanticOverrides };
        if (!semantic.enabled)
            refuse('LORE_FEEDBACK_ENTRY_DISABLED', entry.entryId);
        if (!this.eligible(entry))
            refuse('LORE_FEEDBACK_ENTRY_INELIGIBLE', entry.entryId);
    }
    async selected(entry, semantic, loop, state) {
        const resolved = resolveTavernLoreContentTextV1(this.plan, semantic.content.pointer);
        const selection = { schemaVersion: 1, encoding: 'owned-st-lore-template-selection-v1', entryId: entry.entryId,
            rawEntrySha256: entry.rawEntrySha256, entrySemanticSha256: tavernLoreEntrySemanticSha256V1(semantic),
            pointer: resolved.pointer, rawContentSha256: resolved.contentSha256, attemptId: this.snapshot.attemptId,
            compilerPlanSha256: this.plan.planSha256, loop, state };
        const request = { ...selection,
            encoding: 'owned-st-lore-selected-template-request-v1', text: resolved.text, selectionSha256: recordSha256(selection) };
        let receipt = this.receipts.get(resolved.pointer), feedback = this.rows.get(entry.entryId);
        if (this.producer && !receipt) {
            this.checkpoint();
            const result = await this.producer.render(freezeLoreData(request), this.producer.signal ?? this.defaultSignal);
            this.checkpoint();
            const output = cloneSchemaData(result, LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes, { nodes: 100000, depth: 48 });
            exact(output, ['receipt', 'activationProposals']);
            const supplied = output.receipt;
            exact(supplied, ['pointer', 'rawContentSha256', 'renderedText', 'renderedSha256', 'rendererIdentity',
                'rendererImplementationSha256', 'readDependencies']);
            if (supplied.rendererIdentity !== this.producer.identity
                || supplied.rendererImplementationSha256 !== this.producer.implementationSha256
                || supplied.pointer !== resolved.pointer || supplied.rawContentSha256 !== resolved.contentSha256) {
                refuse('LORE_TEMPLATE_PRODUCER_MISMATCH', entry.entryId);
            }
            const body = { request, renderedSha256: supplied.renderedSha256,
                activationProposals: output.activationProposals };
            const row = { ...body, feedbackSha256: recordSha256(body) };
            // The real snapshot validator checks receipt fields/read dependencies and
            // the exact feedback shape/bounds before any returned data is consumed.
            this.snapshot = sealTavernLoreSnapshotV1({ ...this.snapshot,
                renderedTexts: [...this.snapshot.renderedTexts, supplied], activationFeedback: [...(this.snapshot.activationFeedback ?? []), row] });
            receipt = this.snapshot.renderedTexts.find(item => item.pointer === resolved.pointer);
            feedback = this.snapshot.activationFeedback.find(item => item.request.entryId === entry.entryId);
            this.receipts.set(resolved.pointer, receipt);
            this.rows.set(entry.entryId, feedback);
        }
        let proposals = [];
        if (feedback && !this.consumed.has(entry.entryId)) {
            if (recordSha256(feedback.request) !== recordSha256(request) || !receipt
                || feedback.renderedSha256 !== receipt.renderedSha256)
                refuse('LORE_FEEDBACK_SELECTION_MISMATCH', entry.entryId);
            for (const proposal of feedback.activationProposals)
                this.activation(proposal);
            proposals = feedback.activationProposals;
            this.consumed.add(entry.entryId);
        }
        const text = receipt?.renderedText ?? resolved.text;
        // A standalone renderer may deliberately output literal template markers.
        // Its frozen output is inert text and is never fed through another VM.
        if (!receipt && (text.includes('<%') || text.includes('{{')))
            refuse('LORE_CONTENT_TEMPLATE_UNRENDERED', entry.entryId);
        if (text.split('\n').some(line => line.trimStart().startsWith('@@')))
            refuse('LORE_DECORATOR_UNSUPPORTED', entry.entryId);
        if (Buffer.byteLength(text, 'utf8') > LORE_EVALUATOR_POLICY_V1.bounds.contentBytes)
            refuse('LORE_CONTENT_LIMIT', entry.entryId);
        return { text, proposals };
    }
    final() {
        if (this.consumed.size !== this.rows.size)
            refuse('LORE_FEEDBACK_UNSELECTED');
        if ([...this.scanRows.keys()].some(key => !this.consumedScans.has(key)))
            refuse('LORE_INJECTION_SCAN_UNCONSUMED');
        return this.snapshot;
    }
}
