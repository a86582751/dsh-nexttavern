// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-descriptor-data.ts; edit the TypeScript source.
/** Process-local proof of a bounded immutable JSON clone. These private tags
 * and validator-local successes contain no Source, Native or owner authority. */
import { cloneSchemaDescriptorData } from './tavern-mvu-schema-data.js';
const ownedImmutableClones = new WeakSet();
export function freezeImmutableDescriptorData(input, maxBytes, bounds) {
    // Always traverse and charge the whole new envelope, including repeated
    // tagged child references. A prior clone's budget cannot pay for a new parent.
    const value = cloneSchemaDescriptorData(input, maxBytes, bounds);
    const objects = [];
    function freeze(data) {
        if (data && typeof data === 'object') {
            for (const child of Object.values(data))
                freeze(child);
            Object.freeze(data);
            objects.push(data);
        }
    }
    freeze(value);
    // Tag only after clone, aggregate budgets and the entire deep freeze finish.
    // Neither external Object.freeze nor a partially completed tree can mint it.
    for (const object of objects)
        ownedImmutableClones.add(object);
    return value;
}
/** One instance belongs to one concrete pure validator. A generic clone tag is
 * eligibility only: full validation must succeed before that instance remembers
 * any input. The returned function exposes no cache setter, registry or keys. */
export function createImmutableDescriptorValidator(validate) {
    const successes = new WeakMap();
    return (input) => {
        const object = input !== null && typeof input === 'object' ? input : undefined;
        if (object && ownedImmutableClones.has(object)) {
            const existing = successes.get(object);
            if (existing !== undefined)
                return existing;
        }
        // Failure is never cached. Each concrete validator still performs its own
        // smaller subtree budgets and every shape/hash/correlation on this cold path.
        const result = validate(input);
        if (result !== null && typeof result === 'object' && ownedImmutableClones.has(result)) {
            if (object && ownedImmutableClones.has(object))
                successes.set(object, result);
            successes.set(result, result);
        }
        return result;
    };
}
