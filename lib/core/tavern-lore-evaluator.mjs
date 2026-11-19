// Generated from runtime/alpha3/src/core/tavern-lore-evaluator.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { types } from 'node:util';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { tavernLoreConsumerSourceV1, validateTavernLoreCompilationV1 } from './tavern-lore-compiler.mjs';
import { composeTavernLoreEvaluationV1, isTavernLoreDerivedEntryV1, tavernLoreEvaluationSemanticV1, validateTavernLoreDerivedSnapshotV1, applyTavernLoreOrdinaryPreparationV1, createTavernLoreSourceEligibilityV1 } from './tavern-lore-derived.mjs';
import { validateTavernLoreOrdinaryPreparationV1 } from './tavern-lore-ordinary-preparation.mjs';
import { LoreEvaluationRefusal, TavernLoreBoundedMatcherV1, refuse } from './tavern-lore-match.mjs';
import { exact, freezeLoreData, validateTavernLoreSnapshotV1, LORE_EVALUATOR_POLICY_V1, LORE_EVALUATOR_POLICY_SHA256 } from './tavern-lore-snapshot.mjs';
import { TavernLoreScanBufferV1, nextLoreScanStateV1, tavernLoreUsesGroupScoringV1 } from './tavern-lore-scan.mjs';
import { TavernLoreTimedStateV1 } from './tavern-lore-timed.mjs';
import { TavernLoreTemplateFeedbackStateV1 } from './tavern-lore-template-feedback.mjs';
function secondaryPass(semantic, matches) {
    if (!semantic.selective || !matches.length)
        return true;
    if (semantic.selectiveLogic === 'and-any')
        return matches.some(Boolean);
    if (semantic.selectiveLogic === 'not-all')
        return !matches.every(Boolean);
    if (semantic.selectiveLogic === 'not-any')
        return !matches.some(Boolean);
    return matches.every(Boolean);
}
function score(semantic, primary, secondary) {
    if (!primary.length)
        return 0;
    const first = primary.filter(Boolean).length, last = secondary.filter(Boolean).length;
    return secondary.length && (semantic.selectiveLogic === 'and-any'
        || semantic.selectiveLogic === 'and-all' && secondary.every(Boolean)) ? first + last : first;
}
function seededRoll(snapshot, domain, evaluationPlanSha256 = snapshot.compilerPlanSha256) {
    const digest = recordSha256({ policy: snapshot.settings.seedPolicy, seed: snapshot.seed, branchId: snapshot.branchId,
        turnId: snapshot.turnId, attemptId: snapshot.attemptId, compilerPlanSha256: evaluationPlanSha256, domain });
    return (Number.parseInt(digest.slice(0, 13), 16) + 0.5) / 4503599627370496;
}
function inclusionGroups(candidates, activated, snapshot, timed, loop, evaluationPlanSha256) {
    const grouped = new Map();
    for (const item of candidates) {
        if (!item.semantic.group)
            continue;
        for (const group of item.semantic.group.split(/,\s*/).filter(Boolean)) {
            const rows = grouped.get(group) ?? [];
            rows.push(item);
            grouped.set(group, rows);
        }
    }
    const losers = new Set();
    for (const [group, rows] of grouped) {
        const sticky = rows.filter(item => item.sticky);
        if (sticky.length) {
            // Fixed timed group filtering preserves all sticky members, then removes
            // cooldown entries even if the pre-group sticky gate admitted them.
            for (const item of rows)
                if (!item.sticky || timed.cooldown(item.entry.entryId))
                    losers.add(item.entry.entryId);
            continue;
        }
        if (activated.some(item => item.semantic.group.split(/,\s*/).includes(group))) {
            for (const item of rows)
                losers.add(item.entry.entryId);
            continue;
        }
        let remaining = rows;
        if (snapshot.settings.useGroupScoring || rows.some(item => item.semantic.useGroupScoring === true)) {
            const maximum = Math.max(...rows.map(item => item.decision.groupScore));
            remaining = rows.filter(item => !(item.semantic.useGroupScoring ?? snapshot.settings.useGroupScoring)
                || item.decision.groupScore === maximum);
        }
        const priority = remaining.filter(item => item.semantic.groupOverride)
            .sort((a, b) => b.semantic.order - a.semantic.order || a.entry.ordinal - b.entry.ordinal);
        let winner = priority[0] ?? remaining[0];
        if (!priority.length && remaining.length > 1) {
            const total = remaining.reduce((value, item) => value + item.semantic.groupWeight, 0);
            if (!Number.isFinite(total) || total < 0 || total > Number.MAX_SAFE_INTEGER
                || remaining.some(item => item.semantic.groupWeight < 0))
                refuse('LORE_GROUP_WEIGHT_UNSUPPORTED');
            const roll = seededRoll(snapshot, `group:${group}:loop:${loop}`, evaluationPlanSha256) * total;
            let current = 0;
            for (const item of remaining) {
                current += item.semantic.groupWeight;
                if (roll <= current) {
                    winner = item;
                    break;
                }
            }
        }
        for (const item of rows)
            if (item !== winner)
                losers.add(item.entry.entryId);
    }
    for (const item of candidates)
        if (losers.has(item.entry.entryId))
            item.decision.decision = 'group-loser';
    return candidates.filter(item => !losers.has(item.entry.entryId));
}
function placementsOf(activated) {
    const slots = new Map();
    // Fixed final placement sorts all passes together by order, not the discovery
    // round. Source ordinal provides the fixed stable-sort tie order.
    const sorted = [...activated].sort((a, b) => b.semantic.order - a.semantic.order || a.entry.ordinal - b.entry.ordinal);
    for (const item of sorted) {
        const semantic = item.semantic;
        if (!item.text) {
            item.decision.decision = 'empty-content';
            continue;
        }
        if (semantic.position === 'named-outlet' && !semantic.outletName)
            refuse('LORE_OUTLET_NAME_REQUIRED', item.entry.entryId);
        const slot = JSON.stringify([semantic.position, semantic.position === 'at-chat-depth' ? semantic.role : null,
            semantic.position === 'at-chat-depth' ? semantic.depth : null, semantic.position === 'named-outlet' ? semantic.outletName : null]);
        const rows = slots.get(slot) ?? [];
        if (semantic.position === 'named-outlet')
            rows.push(item);
        else
            rows.unshift(item);
        slots.set(slot, rows);
    }
    const result = [];
    for (const rows of slots.values())
        rows.forEach((item, slotIndex) => result.push({ entryId: item.entry.entryId,
            sourcePointer: item.semantic.content.pointer, sourceContentSha256: item.semantic.content.contentSha256,
            effectiveContentSha256: schemaTextSha256(item.text), position: item.semantic.position, role: item.semantic.role,
            depth: item.semantic.depth, order: item.semantic.order,
            roleDisposition: item.semantic.position === 'at-chat-depth' ? 'at-depth-role' : 'slot-owner-role',
            depthDisposition: item.semantic.position === 'at-chat-depth' ? 'at-depth-distance' : 'slot-owner-anchor',
            outletName: item.semantic.outletName, slotIndex, text: item.text }));
    return result;
}
function rawEvaluatorInput(input) {
    if (input === null || typeof input !== 'object')
        refuse('LORE_EVALUATOR_INPUT_INVALID');
    if (types.isProxy(input))
        throw Error('SCHEMA_PROXY_VALUE');
    const prototype = Object.getPrototypeOf(input);
    if (Array.isArray(input) || prototype !== Object.prototype && prototype !== null)
        throw Error('SCHEMA_OBJECT_PROTOTYPE');
    const value = {};
    for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== 'string')
            throw Error('SCHEMA_NON_JSON_VALUE');
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            throw Error('SCHEMA_NON_JSON_VALUE');
        Object.defineProperty(value, key, { value: descriptor.value, enumerable: true });
    }
    const hasDerived = Object.hasOwn(value, 'derivedSnapshot'), hasOrdinary = Object.hasOwn(value, 'ordinaryPreparation');
    exact(value, ['schemaVersion', 'encoding', 'compilation', 'snapshot', ...hasDerived ? ['derivedSnapshot'] : [],
        ...hasOrdinary ? ['ordinaryPreparation'] : []]);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-st-lore-evaluator-input-v1')
        refuse('LORE_EVALUATOR_INPUT_INVALID');
    const compilation = validateTavernLoreCompilationV1(value.compilation);
    return { schemaVersion: 1, encoding: 'owned-st-lore-evaluator-input-v1', compilation,
        snapshot: validateTavernLoreSnapshotV1(value.snapshot),
        ...hasDerived ? { derivedSnapshot: validateTavernLoreDerivedSnapshotV1(value.derivedSnapshot) } : {},
        ...hasOrdinary ? { ordinaryPreparation: validateTavernLoreOrdinaryPreparationV1(value.ordinaryPreparation, compilation.plan) } : {} };
}
async function evaluate(input, producer, templateProducer, capturedComposition, sourceEligibility) {
    const compilation = input.compilation, plan = compilation.plan, base = capturedComposition ?? composeTavernLoreEvaluationV1(plan, input.derivedSnapshot), composition = capturedComposition || !input.ordinaryPreparation ? base : applyTavernLoreOrdinaryPreparationV1(base, input.ordinaryPreparation);
    let snapshot = input.snapshot;
    const began = performance.now();
    const checkpoint = () => {
        if (producer?.signal?.aborted || templateProducer?.signal?.aborted)
            refuse('LORE_PREPARATION_CANCELLED');
        if ((producer || templateProducer) && performance.now() - began > 10_000)
            refuse('LORE_PREPARATION_DEADLINE');
    };
    // Frozen matcher/count results are DATA. Their consumer owns Source
    // currency; these boundaries enforce cancellation and execution budgets.
    const boundary = async (operation) => {
        checkpoint();
        const result = await operation();
        checkpoint();
        return result;
    };
    checkpoint();
    if (producer && (snapshot.tokenizer.identity !== producer.identity
        || snapshot.tokenizer.implementationSha256 !== producer.implementationSha256
        || snapshot.tokenizer.method !== producer.method || snapshot.tokenizer.counts.length !== 0))
        refuse('LORE_TOKEN_PRODUCER_MISMATCH');
    if (snapshot.compilerPlanSha256 !== plan.planSha256 || snapshot.sourceReferenceSha256 !== plan.sourceReferenceSha256
        || snapshot.sourceSnapshotSha256 !== tavernLoreConsumerSourceV1(plan.source).sourceSnapshotSha256)
        refuse('LORE_EVALUATOR_SOURCE_MISMATCH');
    const eligible = sourceEligibility ?? createTavernLoreSourceEligibilityV1(compilation);
    const standaloneExclusions = new Set(snapshot.standaloneExclusions?.entryIds ?? []);
    const items = composition.entries.map(entry => {
        const semantic = tavernLoreEvaluationSemanticV1(entry), sourceEligible = eligible(entry);
        return { entry, semantic: standaloneExclusions.has(entry.entryId) ? { ...semantic, enabled: false } : semantic,
            eligible: sourceEligible, sourceEligible };
    });
    for (const item of items)
        if (!item.semantic.enabled && !('origin' in item.entry)) {
            const invalidEnabled = item.entry.diagnosticIndexes.some(index => {
                const diagnostic = compilation.diagnostics[index];
                return diagnostic.blocking && diagnostic.code === 'LORE_FIELD_VALUE_UNSUPPORTED'
                    && diagnostic.pointer === `${item.entry.sourcePointer}/enabled`;
            });
            const explicitlyDisabled = item.entry.fieldSources.some(row => row.field === 'enabled'
                && row.disposition === 'current-native-origin' && row.valueSha256 === recordSha256(false));
            if (invalidEnabled && !explicitlyDisabled)
                refuse('LORE_COMPILER_INPUT_INELIGIBLE', item.entry.entryId);
        }
    const diagnostics = [];
    const decisions = items.map(({ entry, semantic }) => ({
        entryId: entry.entryId, rawEntrySha256: entry.rawEntrySha256, decision: 'disabled', primaryMatches: [], secondaryMatches: [],
        groupScore: 0, probabilityRoll: null, sourceContentSha256: semantic.content?.contentSha256 ?? null,
        effectiveContentSha256: semantic.content?.contentSha256 ?? null
    }));
    const byId = new Map(items.map(item => [item.entry.entryId, item]));
    const buffer = new TavernLoreScanBufferV1(snapshot);
    let timed;
    const templates = new TavernLoreTemplateFeedbackStateV1(composition, snapshot, byId, checkpoint, templateProducer, producer?.signal, compilation, entryId => {
        timed?.changed(entryId);
        if (!admitted.has(entryId)) {
            const item = byId.get(entryId), decision = decisions[item.entry.ordinal];
            decision.sourceContentSha256 = item.semantic.content.contentSha256;
            decision.effectiveContentSha256 = item.semantic.content.contentSha256;
        }
    });
    const matcher = new TavernLoreBoundedMatcherV1(checkpoint), activated = [], admitted = new Set();
    const failedProbability = new Set(), queued = new Set(), feedbackSeen = new Set();
    const externalActivations = new Set(), standaloneSelected = new Set();
    if (snapshot.vectorSelection?.result.status === 'ready') {
        const selection = snapshot.vectorSelection, result = selection.result, hits = new Map(result.hits.map(hit => [hit.id, hit])), originals = new Map(plan.entries.map(entry => [entry.entryId, entry]));
        for (const activation of selection.activations) {
            const item = byId.get(activation.entryId), original = originals.get(activation.entryId), hit = hits.get(activation.entryId);
            if (!item || !original || original.rawEntrySha256 !== activation.rawEntrySha256
                || !hit || hit.contentSha256 !== tavernLoreEvaluationSemanticV1(original).content.contentSha256)
                refuse('LORE_VECTOR_SOURCE_MISMATCH', activation.entryId);
            if (item.semantic.enabled && item.eligible)
                externalActivations.add(activation.entryId);
        }
    }
    for (const proposal of composition.ordinaryPreparation?.activationProposals ?? []) {
        templates.activation(proposal);
        if (!proposal.mode)
            externalActivations.add(proposal.entryId);
        else
            externalActivations.delete(proposal.entryId);
    }
    for (const change of composition.ordinaryPreparation?.changes ?? [])
        if (change.forceActivation) {
            const entry = byId.get(change.entryId).entry, proposal = { entryId: entry.entryId, rawEntrySha256: entry.rawEntrySha256 };
            templates.activation(proposal);
            externalActivations.add(entry.entryId);
        }
    const initialInjection = await boundary(() => templates.scan(0, 'initial', 'before-initial'));
    checkpoint();
    for (const contribution of initialInjection.contributions)
        buffer.inject(contribution.text);
    for (const proposal of initialInjection.activationProposals) {
        if (!proposal.mode)
            externalActivations.add(proposal.entryId);
        else
            externalActivations.delete(proposal.entryId);
    }
    if (plan.bookDisposition !== 'eligible-semantic-data'
        && items.some(item => !isTavernLoreDerivedEntryV1(item.entry) && item.semantic.enabled))
        refuse('LORE_COMPILER_INPUT_INELIGIBLE');
    for (const item of items)
        if (item.semantic.enabled) {
            if (!item.eligible)
                refuse('LORE_COMPILER_INPUT_INELIGIBLE', item.entry.entryId);
            if (item.semantic.automationId || item.semantic.triggers.length)
                refuse('LORE_ENTRY_CONTROL_UNSUPPORTED', item.entry.entryId);
        }
    timed = new TavernLoreTimedStateV1(snapshot.timed, byId);
    const counts = new Map(snapshot.tokenizer.counts.map(row => [row.textSha256, row.tokens]));
    let countWorkBytes = 0, renderedBytes = 0, consumed = 0, overflowed = false, cumulative = '', loop = 0;
    const count = async (text) => {
        checkpoint();
        const hash = schemaTextSha256(text), cached = counts.get(hash);
        if (cached !== undefined)
            return cached;
        if (!producer)
            refuse('LORE_TOKEN_COUNT_MISSING');
        if (counts.size >= 4096)
            refuse('LORE_TOKEN_COUNT_LIMIT');
        countWorkBytes += Buffer.byteLength(text, 'utf8');
        if (countWorkBytes > 16_777_216)
            refuse('LORE_TOKEN_COUNT_WORK_LIMIT');
        const tokens = await boundary(() => producer.count(text, producer.signal));
        checkpoint();
        if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > 10_000_000)
            refuse('LORE_TOKEN_PRODUCER_RESULT_INVALID');
        counts.set(hash, tokens);
        return tokens;
    };
    const delayLevels = [...new Set(items.map(item => item.semantic.delayUntilRecursion === true ? 1 :
            Number(item.semantic.delayUntilRecursion)).filter(level => level > 0))].sort((a, b) => a - b);
    let delayLevel = delayLevels.shift() ?? 0, state = 'initial';
    let termination = 'converged';
    const trace = [];
    while (state) {
        checkpoint();
        if (snapshot.settings.maxRecursionSteps > 0 && loop >= snapshot.settings.maxRecursionSteps) {
            termination = 'configured-step-limit';
            break;
        }
        if (++loop > LORE_EVALUATOR_POLICY_V1.bounds.scanSteps)
            refuse('LORE_SCAN_STEP_LIMIT');
        matcher.beginScan();
        const scanState = state, scanDepth = buffer.depth, scanDelayLevel = delayLevel, candidates = [];
        queued.clear();
        for (const [index, item] of items.entries()) {
            checkpoint();
            const { entry, semantic } = item, decision = decisions[index];
            if (!semantic.enabled || admitted.has(entry.entryId) || failedProbability.has(entry.entryId))
                continue;
            const sticky = timed.sticky(entry.entryId);
            if (timed.delay(item)) {
                decision.decision = 'delay';
                continue;
            }
            if (timed.cooldown(entry.entryId) && !sticky) {
                decision.decision = 'cooldown';
                continue;
            }
            const delayed = semantic.delayUntilRecursion === true ? 1 : Number(semantic.delayUntilRecursion);
            if (!sticky && (scanState !== 'recursion' && delayed > 0 || scanState === 'recursion' && delayed > delayLevel)) {
                decision.decision = 'waiting-recursion';
                continue;
            }
            if (!sticky && scanState === 'recursion' && snapshot.settings.recursiveScanning && semantic.excludeRecursion) {
                decision.decision = 'excluded-recursion';
                continue;
            }
            let primary = [], secondary = [];
            const immediate = semantic.constant || sticky || externalActivations.has(entry.entryId);
            if (!immediate) {
                const haystack = buffer.text(semantic, scanState);
                const primaryKeys = await boundary(() => templates.keys(entry, 'primaryKeys'));
                primary = await boundary(() => matcher.matches(haystack, primaryKeys, semantic.caseSensitive ?? snapshot.settings.caseSensitive, semantic.matchWholeWords ?? snapshot.settings.matchWholeWords));
                checkpoint();
                if (!primary.some(Boolean)) {
                    decision.decision = 'keys-unmatched';
                    continue;
                }
                const secondaryKeys = await boundary(() => templates.keys(entry, 'secondaryKeys'));
                secondary = await boundary(() => matcher.matches(haystack, secondaryKeys, semantic.caseSensitive ?? snapshot.settings.caseSensitive, semantic.matchWholeWords ?? snapshot.settings.matchWholeWords));
                checkpoint();
                if (!secondaryPass(semantic, secondary)) {
                    decision.decision = 'secondary-unmatched';
                    continue;
                }
            }
            decision.primaryMatches = primary;
            decision.secondaryMatches = secondary;
            decision.groupScore = score(semantic, primary, secondary);
            candidates.push({ entry, get semantic() { return item.semantic; }, text: '', get sticky() { return timed.sticky(entry.entryId); }, decision });
        }
        // Constants/sticky/forced activations bypass key admission but group scoring
        // still scans their keys when any member enables that fixed group policy.
        for (const item of candidates)
            if ((item.semantic.constant || item.sticky || externalActivations.has(item.entry.entryId))
                && tavernLoreUsesGroupScoringV1(item.semantic, candidates, snapshot.settings.useGroupScoring)) {
                const haystack = buffer.text(item.semantic, scanState);
                const primaryKeys = await boundary(() => templates.keys(item.entry, 'primaryKeys'));
                const primary = await boundary(() => matcher.matches(haystack, primaryKeys, item.semantic.caseSensitive ?? snapshot.settings.caseSensitive, item.semantic.matchWholeWords ?? snapshot.settings.matchWholeWords));
                const secondaryKeys = await boundary(() => templates.keys(item.entry, 'secondaryKeys'));
                const secondary = await boundary(() => matcher.matches(haystack, secondaryKeys, item.semantic.caseSensitive ?? snapshot.settings.caseSensitive, item.semantic.matchWholeWords ?? snapshot.settings.matchWholeWords));
                checkpoint();
                item.decision.groupScore = score(item.semantic, primary, secondary);
            }
        candidates.sort((a, b) => Number(b.sticky) - Number(a.sticky) || b.semantic.order - a.semantic.order || a.entry.ordinal - b.entry.ordinal);
        const grouped = inclusionGroups(candidates, activated, snapshot, timed, loop, composition.planSha256), baseText = buffer.budgetBaseText;
        const baseTokens = await count(baseText), selectedIds = [], newIds = [], probabilityIds = [];
        const feedback = [], rendered = [];
        cumulative = '';
        consumed = baseTokens;
        for (const item of grouped) {
            checkpoint();
            if (overflowed && !item.semantic.ignoreBudget) {
                item.decision.decision = 'budget-excluded';
                continue;
            }
            if (!item.sticky && item.semantic.useProbability && item.semantic.probability !== 100) {
                const roll = seededRoll(snapshot, `probability:${item.entry.entryId}:loop:${loop}`, composition.planSha256) * 100;
                item.decision.probabilityRoll = roll;
                if (roll > item.semantic.probability) {
                    failedProbability.add(item.entry.entryId);
                    probabilityIds.push(item.entry.entryId);
                    queued.delete(item.entry.entryId);
                    item.decision.decision = 'probability-failed';
                    continue;
                }
            }
            selectedIds.push(item.entry.entryId);
            const result = await boundary(() => templates.selected(item.entry, item.semantic, loop, scanState));
            checkpoint();
            standaloneSelected.add(item.entry.entryId);
            item.text = result.text;
            item.decision.effectiveContentSha256 = schemaTextSha256(result.text);
            renderedBytes += Buffer.byteLength(result.text, 'utf8');
            if (renderedBytes > 2_000_000)
                refuse('LORE_EFFECTIVE_CONTENT_LIMIT');
            rendered.push(item);
            for (const proposal of result.proposals) {
                const disposition = admitted.has(proposal.entryId) || standaloneSelected.has(proposal.entryId)
                    || failedProbability.has(proposal.entryId)
                    ? 'already-seen' : feedbackSeen.has(proposal.entryId) ? 'duplicate' : 'queued';
                feedback.push({ entryId: proposal.entryId, disposition });
                feedbackSeen.add(proposal.entryId);
                if (disposition === 'queued') {
                    queued.add(proposal.entryId);
                    if (proposal.mode)
                        externalActivations.delete(proposal.entryId);
                    else
                        externalActivations.add(proposal.entryId);
                }
            }
            // Count each pass's newContent separately from the recursive base text.
            // Keep an overflow candidate in newContent for later ignoreBudget queries.
            cumulative += `${item.text}\n`;
            if (Buffer.byteLength(cumulative, 'utf8') > 2_000_000)
                refuse('LORE_BUDGET_TEXT_LIMIT');
            consumed = baseTokens + await count(cumulative);
            if (!item.semantic.ignoreBudget && consumed >= snapshot.settings.budgetTokens) {
                overflowed = true;
                item.decision.decision = 'budget-excluded';
                continue;
            }
            item.decision.decision = 'activated';
            activated.push({ ...item, semantic: item.semantic, sticky: item.sticky });
            admitted.add(item.entry.entryId);
            newIds.push(item.entry.entryId);
            queued.delete(item.entry.entryId);
        }
        const injection = await boundary(() => templates.scan(loop, scanState, 'after-selected'));
        checkpoint();
        for (const contribution of injection.contributions)
            buffer.inject(contribution.text);
        for (const proposal of injection.activationProposals) {
            const disposition = admitted.has(proposal.entryId) || standaloneSelected.has(proposal.entryId)
                || failedProbability.has(proposal.entryId)
                ? 'already-seen' : feedbackSeen.has(proposal.entryId) ? 'duplicate' : 'queued';
            feedback.push({ entryId: proposal.entryId, disposition });
            feedbackSeen.add(proposal.entryId);
            if (disposition === 'queued') {
                queued.add(proposal.entryId);
                if (proposal.mode)
                    externalActivations.delete(proposal.entryId);
                else
                    externalActivations.add(proposal.entryId);
            }
        }
        const recursing = grouped.filter(item => !failedProbability.has(item.entry.entryId) && !item.semantic.preventRecursion);
        let next = nextLoreScanStateV1({ snapshot, buffer, state: scanState, overflowed, recursingEntries: recursing.length,
            activatedCount: admitted.size, remainingDelayLevels: delayLevels.length });
        // Template activation is a declared program extension of the fixed scan
        // hook. It schedules one bounded extra scan even without keyword recursion.
        if ((queued.size || injection.contributions.some(row => row.text)) && !next.state)
            next = { state: 'recursion', advanceDelay: false };
        if (next.advanceDelay)
            delayLevel = delayLevels.shift();
        const scanOnly = [], renderedIds = new Set(rendered.map(item => item.entry.entryId));
        if (next.state) {
            const texts = recursing.map(item => {
                if (renderedIds.has(item.entry.entryId))
                    return item.text;
                // Fixed source 5080/5130/5140 includes overflow-skipped candidates in
                // successfulNewEntries. This is raw scan input, never VM execution,
                // a rendered receipt, a final activation or a placement.
                if (!overflowed)
                    refuse('LORE_RECURSION_SOURCE_UNPROVEN', item.entry.entryId);
                const raw = templates.content(item.entry, item.semantic);
                scanOnly.push({ entryId: item.entry.entryId, pointer: raw.pointer, contentSha256: raw.contentSha256,
                    disposition: 'scan-only-after-overflow', loop });
                return raw.text;
            });
            buffer.feedback(texts.join('\n'));
        }
        trace.push({ loop, state: scanState, depth: scanDepth, recursionDelayLevel: scanDelayLevel, selectedEntryIds: selectedIds,
            admittedEntryIds: newIds, probabilityFailedEntryIds: probabilityIds, feedback,
            baseTextSha256: schemaTextSha256(baseText), candidateTextSha256: schemaTextSha256(cumulative), scanOnly, nextState: next.state });
        state = next.state;
    }
    snapshot = templates.final(producer ? { ...snapshot.tokenizer,
        counts: [...counts].map(([textSha256, tokens]) => ({ textSha256, tokens })) } : undefined);
    checkpoint();
    timed.activated(activated.map(item => item.entry.entryId));
    const placements = placementsOf(activated);
    const descriptor = { schemaVersion: 1,
        encoding: 'owned-st-lore-evaluation-plan-v1', authority: 'consumer-data-only', evaluatorPolicySha256: LORE_EVALUATOR_POLICY_SHA256,
        snapshotSha256: snapshot.snapshotSha256, compilerPlanSha256: plan.planSha256, sourceReferenceSha256: plan.sourceReferenceSha256,
        ...composition.ref ? { composition: composition.ref } : {},
        branchId: snapshot.branchId, sessionId: snapshot.sessionId, turnId: snapshot.turnId, attemptId: snapshot.attemptId,
        decisions, activatedEntryIds: activated.map(item => item.entry.entryId), scanTrace: trace, termination, diagnostics, placements,
        budget: { limitTokens: snapshot.settings.budgetTokens, consumedCandidateTokens: consumed,
            cumulativeCandidateTextSha256: schemaTextSha256(cumulative), overflowed, countMethod: snapshot.tokenizer.method },
        timedProposal: { schemaVersion: 1, encoding: 'owned-st-timed-proposals-v1', branchId: snapshot.branchId,
            baseRevision: snapshot.revision, baseSha256: snapshot.timedSha256, chatIndex: snapshot.timed.chatIndex,
            actions: timed.actions, disposition: timed.actions.length ? 'proposed-consumer-data-only' : 'empty-no-timed-effects' } };
    const finalPlan = freezeLoreData(cloneRoleplayTavernLoreDataV1({ ...descriptor, planSha256: recordSha256(descriptor) }, LORE_EVALUATOR_POLICY_V1.bounds.outputBytes, { nodes: 131072, depth: 66 }));
    const finalInput = Object.freeze({ schemaVersion: 1,
        encoding: 'owned-st-lore-evaluator-input-v1', compilation, snapshot,
        ...composition.derivedSnapshot ? { derivedSnapshot: composition.derivedSnapshot } : {},
        ...composition.ordinaryPreparation ? { ordinaryPreparation: composition.ordinaryPreparation } : {} });
    return Object.freeze({ kind: 'prepared', input: finalInput, plan: finalPlan });
}
function refusal(error) {
    const code = error instanceof LoreEvaluationRefusal ? error.code
        : error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message) ? error.message : 'LORE_EVALUATION_REFUSED';
    return freezeLoreData({ kind: 'refused', diagnostics: [{ schemaVersion: 1, code,
                entryId: error instanceof LoreEvaluationRefusal ? error.entryId : null,
                pointer: error instanceof LoreEvaluationRefusal ? error.pointer : null, blocking: true }] });
}
export async function evaluateTavernLoreV1(input) {
    try {
        const result = await evaluate(rawEvaluatorInput(input));
        return freezeLoreData({ kind: 'evaluated', plan: result.plan });
    }
    catch (error) {
        return refusal(error);
    }
}
export async function prepareTavernLoreV1(input, producer, templateProducer) {
    try {
        return await evaluate(rawEvaluatorInput(input), producer, templateProducer);
    }
    catch (error) {
        return refusal(error);
    }
}
export async function prepareTavernLoreWithOwnerV1(input, owner) {
    try {
        return await evaluate(rawEvaluatorInput(input), owner.tokenCount, owner.templates, undefined, owner.sourceEligibility);
    }
    catch (error) {
        return refusal(error);
    }
}
/** Core supplies its compiled DATA and parsed frozen snapshot. Its consuming
 * owner retains Source currency and publication responsibility. */
export async function prepareOwnedTavernLoreWithOwnerV1(input, owner, composition) {
    try {
        return await evaluate(input, owner.tokenCount, owner.templates, composition, owner.sourceEligibility);
    }
    catch (error) {
        return refusal(error);
    }
}
export async function validateTavernLoreEvaluationV1(input, result) {
    const value = cloneRoleplayTavernLoreDataV1(result, LORE_EVALUATOR_POLICY_V1.bounds.outputBytes, { nodes: 131072, depth: 66 });
    const rebuilt = await evaluateTavernLoreV1(input);
    if (rebuilt.kind !== 'evaluated' || recordSha256(value) !== recordSha256(rebuilt))
        refuse('LORE_EVALUATION_RECOMPUTATION_MISMATCH');
    return rebuilt;
}
