// Generated from runtime/alpha3/src/core/roleplay-tavern-generate-loader.ts; edit the TypeScript source.
/** One actual request preparation owns GENERATE lifecycle order and buffers.
 * Source selection and rendering remain their existing owners; Native alone
 * supplies transport headers, text coordinates, sealing and retry reuse. */
import { createCommunityMacroRandom } from './community-preset-macros.js';
import { TavernLoreBoundedMatcherV1 } from './tavern-lore-match.mjs';
import { createTavernGenerateLoaderSelectorV1 } from './tavern-source-entry-selection.mjs';
import { orderTavernSourceRenderCatalogV1 } from './tavern-source-render-catalog.mjs';
function fail(code) { throw Error(code); }
export function createRoleplayTavernGenerateLoaderV1(deps) {
    const { catalog } = deps, source = catalog.generateLoaders, hasLoaders = source.before.length || source.after.length || source.indexedBefore.size || source.indexedAfter.size, ranks = hasLoaders ? new Map(deps.lookup.map((row, index) => [row.key, index])) : new Map(), ordered = (rows) => rows.length < 2 ? rows :
        [...rows].sort((a, b) => ranks.get(a.entry.entryId) - ranks.get(b.entry.entryId)), before = ordered(source.before), after = ordered(source.after), indexedBefore = new Map([...source.indexedBefore].map(([index, rows]) => [index, ordered(rows)])), indexedAfter = new Map([...source.indexedAfter].map(([index, rows]) => [index, ordered(rows)])), matcher = new TavernLoreBoundedMatcherV1(deps.assertCurrent), current = () => { deps.signal.throwIfAborted(); deps.assertCurrent(); }, phase = (name) => {
        const random = createCommunityMacroRandom(`${deps.seed}:generate-loader:${deps.phaseId}:${name}`);
        return { context: {}, selector: createTavernGenerateLoaderSelectorV1({
                matcher, settings: deps.settings, projectKey: deps.projectKey, drawRange: random.range,
                assertCurrent: deps.assertCurrent, signal: deps.signal
            }) };
    }, initial = phase('global-before'), final = phase('final');
    let globalBefore = '';
    async function run(rows, phaseState, mode, coordinate, trigger, buffer) {
        if (!rows.length)
            return '';
        const selected = await phaseState.selector.select(rows, trigger);
        current();
        if (selected.kind === 'refused')
            fail(selected.code);
        let text = '', bufferText;
        const call = { phase: mode, callId: `${deps.phaseId}:${mode}:${coordinate}`,
            get previousContext() { return phaseState.context; }, buffer: () => bufferText ??= buffer() };
        for (const row of orderTavernSourceRenderCatalogV1(catalog, deps.authorsNoteDepth, selected.entries)) {
            const result = await deps.renderEntry(row, call);
            current();
            phaseState.context = result.context;
            text += result.renderedText;
        }
        return text;
    }
    return {
        async startBefore() {
            globalBefore = await run(before, initial, 'generate-global-before', 'global', '', () => '');
            current();
        },
        async finish(surface, renderSlot) {
            current();
            const first = surface.messages[0]?.textSlots[0];
            if (globalBefore.trim() && first === undefined)
                fail('INPUT_MATERIAL_GENERATE_BEFORE_TEXT_TARGET_UNAVAILABLE');
            const textOutputs = [], collected = [globalBefore], buffer = () => collected.join('');
            for (const message of surface.messages) {
                const beforeText = await run(indexedBefore.get(message.messageOrdinal) ?? [], final, 'generate-indexed-before', String(message.messageOrdinal), '', buffer);
                for (const index of message.textSlots) {
                    const slot = surface.slots[index], prompt = await renderSlot(slot, final.context);
                    current();
                    // Native keeps its existing final-slot processing for empty blocks.
                    // Indexed wrapping follows the fixed array-block nonempty gate.
                    const afterText = slot.text ? await run(indexedAfter.get(message.messageOrdinal) ?? [], final, 'generate-indexed-after', `${message.messageOrdinal}:${slot.blockOrdinal ?? 'string'}`, prompt, () => buffer() + beforeText + prompt) : '', text = slot.text ? beforeText + prompt + afterText : prompt;
                    textOutputs.push({ messageOrdinal: slot.messageOrdinal, blockOrdinal: slot.blockOrdinal, text });
                    collected.push(text);
                }
            }
            const afterText = await run(after, final, 'generate-global-after', 'global', after.length ? buffer() : '', () => globalBefore + buffer());
            if (globalBefore.trim())
                textOutputs[first] = { ...textOutputs[first], text: globalBefore + textOutputs[first].text };
            if (afterText.trim()) {
                const last = surface.messages.at(-1)?.textSlots.at(-1);
                if (last === undefined)
                    fail('INPUT_MATERIAL_GENERATE_AFTER_TEXT_TARGET_UNAVAILABLE');
                textOutputs[last] = { ...textOutputs[last], text: textOutputs[last].text + afterText };
            }
            current();
            return textOutputs;
        },
    };
}
