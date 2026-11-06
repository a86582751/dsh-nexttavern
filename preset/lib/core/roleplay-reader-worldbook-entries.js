// Generated from runtime/alpha3/src/core/roleplay-reader-worldbook-entries.ts; edit the TypeScript source.
/** Formal Source selection for one readonly Reader phase. No Prompt evaluator,
 * Main preparation, template VM or effect publisher is created here. */
import { orderTavernSourceRenderCatalogV1 } from './tavern-source-render-catalog.mjs';
import { tavernEntryRendersInPhaseV1 } from './roleplay-tavern-prompt-variables-data.js';
import { TavernLoreBoundedMatcherV1, LoreEvaluationRefusal } from './tavern-lore-match.mjs';
import { createTavernPromptMacroProjectorV1, hasTavernPromptMacroSyntaxV1 } from './tavern-prompt-transform-execution.mjs';
import { TAVERN_PROMPT_TRANSFORM_LIMITS_V1 as MACRO_LIMITS } from './tavern-prompt-transform-types.mjs';
import { TemplateRefusalV1, templateReadV1 } from './tavern-template-data.mjs';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { ST_LORE_POSITION_V1, ST_LORE_ROLE_V1 } from './tavern-lore-fixed-profile.mjs';
class ReaderSelectionUnavailable extends Error {
}
/** Fixed d6f520d evaluateWIEntities/selectActivatedEntries order is probability,
 * constant, activate, dont_activate, only_preload, then primary/secondary keys.
 * Source metadata sorting remains the shared catalogue's independent owner. */
export async function selectReaderWorldbookEntriesV1(input) {
    const { catalog, capture, phase } = input, entries = [], unsupported = [], reads = new Map(), candidates = catalog.entries.filter(row => row.formal.enabled && !row.semantic.vectorized
        && tavernEntryRendersInPhaseV1(typeof row.raw.comment === 'string' ? row.raw.comment : '', row.formal.names, phase));
    if (!candidates.length)
        return { kind: 'selected', entries, unsupported, reads: [] };
    const retain = (read) => reads.set(JSON.stringify(read), read), counters = { jobs: 0, workChars: 0, matches: 0 }, limit = (field, increment) => {
        counters[field] += increment;
        if (counters[field] > MACRO_LIMITS[field])
            throw new ReaderSelectionUnavailable('PROMPT_TRANSFORM_LIMIT');
    }, projector = createTavernPromptMacroProjectorV1(capture.macros, {
        issue: code => { throw new ReaderSelectionUnavailable(code); }, recordRead: retain,
        budget: { job: () => limit('jobs', 1), work: chars => limit('workChars', chars), match: () => limit('matches', 1),
            output: chars => { if (chars > MACRO_LIMITS.outputChars)
                throw new ReaderSelectionUnavailable('PROMPT_TRANSFORM_LIMIT'); } },
        variable: (scope, key) => {
            const binding = capture.snapshot.scopes.find(row => row.scope === scope);
            if (!binding)
                throw new ReaderSelectionUnavailable('TEMPLATE_SCOPE_UNAVAILABLE');
            // Macro keys are literal names. The owner-certified scope receipt
            // also proves absence; never revive a tombstone from stale macro DATA.
            retain(templateReadV1(capture.snapshot, 'variable', null, scope, 'read'));
            const value = binding.values[key];
            return { value: !Object.hasOwn(binding.values, key) || value == null ? '' : typeof value === 'object'
                    ? JSON.stringify(value) : String(value) };
        }
    }), project = (text) => hasTavernPromptMacroSyntaxV1(text) ? projector.project(text) : text, matcher = new TavernLoreBoundedMatcherV1(), matched = [];
    const reject = (row, code) => unsupported.push({
        entryId: row.entry.entryId, sourcePointer: row.resolved.pointer, code
    });
    for (const row of candidates) {
        const { semantic, formal } = row;
        try {
            if (semantic.useProbability && semantic.probability <= 0)
                continue;
            if (semantic.useProbability && semantic.probability < 100)
                throw new ReaderSelectionUnavailable('READER_RENDER_PROBABILITY_UNAVAILABLE');
            const activation = formal.directives.filter(directive => ['@@activate', '@@dont_activate', '@@only_preload'].includes(directive.name));
            if (activation.some(directive => directive.args))
                throw new ReaderSelectionUnavailable('READER_RENDER_ACTIVATION_ARGUMENTS_UNSUPPORTED');
            const immediate = semantic.constant || formal.names.includes('@@activate');
            if (!immediate && (formal.names.includes('@@dont_activate') || formal.names.includes('@@only_preload')))
                continue;
            if (!immediate) {
                const trigger = phase === 'before' ? '' : input.displayText;
                if (trigger === undefined)
                    throw new ReaderSelectionUnavailable('READER_RENDER_DISPLAY_UNAVAILABLE');
                if (!semantic.primaryKeys.length)
                    continue;
                if (semantic.caseSensitive === null || semantic.matchWholeWords === null)
                    throw new ReaderSelectionUnavailable('READER_RENDER_MATCH_SETTINGS_UNAVAILABLE');
                const primary = await matcher.matches(trigger, semantic.primaryKeys.map(project), semantic.caseSensitive, semantic.matchWholeWords);
                if (!primary.some(Boolean))
                    continue;
                if (semantic.selective && semantic.secondaryKeys.length) {
                    const secondary = await matcher.matches(trigger, semantic.secondaryKeys.map(project), semantic.caseSensitive, semantic.matchWholeWords), any = secondary.some(Boolean), all = secondary.every(Boolean), logic = semantic.selectiveLogic;
                    if (!(logic === 'and-any' ? any : logic === 'and-all' ? all : logic === 'not-all' ? !all : !any))
                        continue;
                }
            }
            if (phase === 'after' && input.displayText === undefined)
                throw new ReaderSelectionUnavailable('READER_RENDER_DISPLAY_UNAVAILABLE');
            if ((semantic.position === 'before-authors-note' || semantic.position === 'after-authors-note')
                && input.authorsNoteDepth === undefined)
                throw new ReaderSelectionUnavailable('READER_RENDER_NOTE_DEPTH_UNAVAILABLE');
            matched.push(row);
        }
        catch (error) {
            if (error instanceof ReaderSelectionUnavailable || error instanceof LoreEvaluationRefusal)
                reject(row, error.message);
            else if (error instanceof TemplateRefusalV1)
                reject(row, error.diagnostic.code);
            else
                throw error;
        }
    }
    const groups = new Map();
    for (const row of matched)
        if (row.semantic.group) {
            const old = groups.get(row.semantic.group) ?? [];
            old.push(row);
            groups.set(row.semantic.group, old);
        }
    const selected = matched.filter(row => {
        if (row.semantic.group && (groups.get(row.semantic.group)?.length ?? 0) > 1) {
            reject(row, 'READER_RENDER_GROUP_SELECTION_UNAVAILABLE');
            return false;
        }
        return true;
    });
    // Unknown note placement has already removed every affected candidate. The
    // unused argument does not manufacture a note in this filtered catalogue.
    const selectedIds = new Set(selected.map(row => row.entry.entryId)), ordered = orderTavernSourceRenderCatalogV1(catalog, input.authorsNoteDepth ?? 0)
        .filter(row => selectedIds.has(row.entry.entryId));
    for (const row of ordered) {
        try {
            // This owner projects the formal body once. Its opaque include resource
            // has no loreKey, so the EJS host consumes these bytes without reprojecting.
            const text = project(row.formal.body), { entry, semantic, formal } = row, worldInfo = { ...row.raw, ...semantic, content: formal.body, key: semantic.primaryKeys, keysecondary: semantic.secondaryKeys,
                disable: !semantic.enabled, position: ST_LORE_POSITION_V1.indexOf(semantic.position),
                role: ST_LORE_ROLE_V1.indexOf(semantic.role), world: catalog.world,
                ...(Number.isFinite(row.uid) ? { uid: row.uid } : {}) };
            entries.push({ entryId: entry.entryId, ordinal: entry.ordinal, phase, enabled: formal.enabled, matched: true,
                effectiveDepth: row.effectiveDepth, order: semantic.order, uid: row.uid,
                resource: { id: `reader-worldbook:${phase}:${entry.entryId}`, sourcePointer: row.resolved.pointer,
                    sourceSnapshotSha256: catalog.source.sourceSha256, contentSha256: schemaTextSha256(text), text },
                directives: formal.directives, worldInfo });
        }
        catch (error) {
            if (error instanceof ReaderSelectionUnavailable)
                reject(row, error.message);
            else if (error instanceof TemplateRefusalV1)
                reject(row, error.diagnostic.code);
            else
                throw error;
        }
    }
    return { kind: 'selected', entries, unsupported, reads: [...reads.values()] };
}
