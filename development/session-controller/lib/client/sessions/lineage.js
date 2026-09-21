// Generated from runtime/alpha3/compat/session-controller/src/client/sessions/lineage.ts; edit the TypeScript source.
// flattenLineage: summaries -> flat list with lineage indentation (pure function).
// The input order is authoritative; lineage only makes each child adjacent to its parent.
// Orphaned lineage degrades to root level; cycles fail soft and emit as roots.
/**
 * Summaries -> flat list with lineage indentation. Root and sibling order
 * follows the established input order; this projection never re-sorts a
 * hydrated list from mutable timestamps.
 * @param summaries - the host's session.list items.
 * @returns display rows in render order.
 */
export function flattenLineage(summaries) {
    const byId = new Map();
    for (const s of summaries)
        byId.set(s.sessionId, s);
    const children = new Map();
    const roots = [];
    for (const s of summaries) {
        if (s.parentSessionId !== undefined && byId.has(s.parentSessionId)) {
            const list = children.get(s.parentSessionId) ?? [];
            list.push(s);
            children.set(s.parentSessionId, list);
        }
        else {
            roots.push(s); // root, or an orphan whose parent is absent from summaries (degrade to root, never drop)
        }
    }
    const out = [];
    const visited = new Set();
    const walk = (s, depth) => {
        if (visited.has(s.sessionId)) {
            console.warn(`[session-controller] lineage cycle at ${s.sessionId}; emitting as root`);
            return;
        }
        visited.add(s.sessionId);
        out.push({
            ...s,
            depth,
        });
        const kids = children.get(s.sessionId);
        if (kids === undefined)
            return;
        for (const kid of kids)
            walk(kid, depth + 1);
    };
    for (const root of roots)
        walk(root, 0);
    // Cycle members (unreachable from any root): emit as roots so no entry is lost.
    for (const s of summaries) {
        if (!visited.has(s.sessionId))
            walk(s, 0);
    }
    return out;
}
