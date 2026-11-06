// Generated from runtime/alpha3/src/core/tavern-source-entry-selection.mts; edit the TypeScript source.
/** One formal GENERATE loader activation pass over actual ordered Source
 * bucket references. Rendering, random lifetime and publication stay owned by
 * the preparation; this selector neither reads history nor executes bodies. */
import { LoreEvaluationRefusal } from './tavern-lore-match.mjs';
class SelectionRefusal extends Error {
    row;
    constructor(row, code) {
        super(code);
        this.row = row;
    }
}
export function createTavernGenerateLoaderSelectorV1(deps) {
    const current = () => { deps.signal.throwIfAborted(); deps.assertCurrent(); };
    async function select(candidates, trigger) {
        current();
        const matches = async (row, kind, project) => {
            let keys = row.semantic[kind];
            if (project) {
                const rendered = [];
                for (const [index, raw] of keys.entries()) {
                    const projected = deps.projectKey(row, kind, index, raw);
                    if (typeof projected === 'string')
                        rendered.push(projected);
                    else {
                        rendered.push(await projected);
                        current();
                    }
                }
                keys = rendered;
            }
            try {
                const result = await deps.matcher.matches(trigger, keys, row.semantic.caseSensitive ?? deps.settings.caseSensitive, row.semantic.matchWholeWords ?? deps.settings.matchWholeWords);
                current();
                return result;
            }
            catch (error) {
                if (error instanceof LoreEvaluationRefusal)
                    throw new SelectionRefusal(row, error.code);
                throw error;
            }
        };
        const score = async (row) => {
            if (!row.semantic.primaryKeys.length)
                return 0;
            // Fixed group scoring consumes raw keys, not the admission macro result.
            const primary = await matches(row, 'primaryKeys', false), logic = row.semantic.selectiveLogic, base = primary.filter(Boolean).length;
            if (!row.semantic.secondaryKeys.length || logic !== 'and-any' && logic !== 'and-all')
                return base;
            const secondary = await matches(row, 'secondaryKeys', false);
            return base + (logic === 'and-any' || secondary.every(Boolean) ? secondary.filter(Boolean).length : 0);
        };
        try {
            const activated = [];
            for (const row of candidates) {
                const { semantic, formal } = row;
                if (!formal.enabled || semantic.vectorized)
                    continue;
                if (semantic.useProbability && semantic.probability < deps.drawRange(1, 100))
                    continue;
                if (formal.directives.some(directive => directive.args !== '' && (directive.name === '@@activate'
                    || directive.name === '@@dont_activate' || directive.name === '@@only_preload')))
                    throw new SelectionRefusal(row, 'GENERATE_LOADER_ACTIVATION_ARGUMENTS_UNSUPPORTED');
                if (semantic.constant || formal.names.includes('@@activate')) {
                    activated.push(row);
                    continue;
                }
                if (formal.names.includes('@@dont_activate') || formal.names.includes('@@only_preload'))
                    continue;
                const primary = await matches(row, 'primaryKeys', true);
                if (!primary.some(Boolean))
                    continue;
                if (semantic.selective && semantic.secondaryKeys.length) {
                    const secondary = await matches(row, 'secondaryKeys', true), any = secondary.some(Boolean), all = secondary.every(Boolean), logic = semantic.selectiveLogic;
                    if (!(logic === 'and-any' ? any : logic === 'and-all' ? all : logic === 'not-all' ? !all : !any))
                        continue;
                }
                activated.push(row);
            }
            const ungrouped = [], groups = Object.create(null);
            for (const row of activated) {
                const name = row.semantic.group;
                if (name === '') {
                    ungrouped.push(row);
                    continue;
                }
                const bucket = groups[name] ??= [];
                bucket.push(row);
            }
            const winners = [];
            // Object key iteration matches fixed groupBy, including integer group
            // names. Each group's members retain the actual input candidate order.
            for (const rows of Object.values(groups)) {
                if (rows.length === 1) {
                    winners.push(rows[0]);
                    continue;
                }
                if (rows.some(row => row.semantic.groupOverride)) {
                    const top = Math.min(...rows.map(row => row.semantic.order));
                    if (top) {
                        winners.push(rows.find(row => row.semantic.order <= top));
                        continue;
                    }
                }
                if (rows.some(row => row.semantic.useGroupScoring ?? deps.settings.useGroupScoring)) {
                    const scores = [];
                    for (const row of rows)
                        scores.push(await score(row));
                    const top = Math.max(...scores);
                    if (top) {
                        winners.push(rows[scores.findIndex(value => value >= top)]);
                        continue;
                    }
                }
                if (rows.some(row => !row.semantic.groupOverride && !row.semantic.useGroupScoring)) {
                    let roll = deps.drawRange(1, rows.reduce((total, row) => total + row.semantic.groupWeight, 0));
                    for (const row of rows) {
                        roll -= row.semantic.groupWeight;
                        if (roll <= 0) {
                            winners.push(row);
                            break;
                        }
                    }
                }
            }
            return { kind: 'selected', entries: ungrouped.concat(winners) };
        }
        catch (error) {
            if (error instanceof SelectionRefusal)
                return { kind: 'refused', code: error.message,
                    entryId: error.row.entry.entryId, sourcePointer: error.row.resolved.pointer };
            throw error;
        }
    }
    return { select };
}
