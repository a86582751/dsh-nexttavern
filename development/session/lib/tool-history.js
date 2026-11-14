// Generated from runtime/alpha3/compat/session/src/tool-history.ts; edit the TypeScript source.
/** Stateful reconstruction of historical tool definitions for request projection. */
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
/** Candidate writes borrow the accepted declarations, including removed names.
 * A second fork copies only candidate writes, never another historical map. */
class PreviewToolDeclarations {
    base;
    changes;
    constructor(base, changes = new Map()) {
        this.base = base;
        this.changes = changes;
    }
    get(name) { return this.changes.get(name) ?? this.base.get(name); }
    set(name, tool) { this.changes.set(name, tool); }
    fork() { return new PreviewToolDeclarations(this.base, new Map(this.changes)); }
}
class PreviewToolNames {
    base;
    count;
    changes;
    constructor(base, count = base.size, changes = new Map()) {
        this.base = base;
        this.count = count;
        this.changes = changes;
    }
    get size() { return this.count; }
    has(name) { return this.changes.get(name) ?? this.base.has(name); }
    add(name) { if (!this.has(name))
        this.count++; this.changes.set(name, true); }
    delete(name) { if (this.has(name))
        this.count--; this.changes.set(name, false); }
    fork() { return new PreviewToolNames(this.base, this.count, new Map(this.changes)); }
}
/** Folds committed headers and developer messages independently of model capability. */
export class ToolHistoryProjection {
    /** Historical declarations indexed by the header sequence referenced by additions. */
    headers = new Map();
    headerBase;
    /** Definitions retained in the current declaration series, including removed tools. */
    declared = new Map();
    /** Active definitions from the latest request header. */
    active = [];
    /** Active names reconstructed from the baseline and recorded updates. */
    available = new Set();
    /** Header that starts the current declaration series; absent before the first header. */
    baselineSeq;
    /** Immutable request snapshot of the current baseline and resolved updates. */
    history = deepFreeze({ tools: [], updates: [] });
    /** Short-lived request planning over this accepted owner. Header references
     * still resolve every old declaration; no full header/catalog copy occurs. */
    fork() {
        const preview = new ToolHistoryProjection();
        preview.headerBase = this.headerBase ?? this.headers;
        if (this.headerBase)
            for (const [seq, tools] of this.headers)
                preview.headers.set(seq, tools);
        preview.declared = this.declared instanceof Map ? new PreviewToolDeclarations(this.declared) : this.declared.fork();
        preview.available = this.available instanceof Set ? new PreviewToolNames(this.available) : this.available.fork();
        preview.active = this.active;
        preview.baselineSeq = this.baselineSeq;
        preview.history = this.history;
        return preview;
    }
    /**
     * Consume the next committed event in log order.
     * @param event - a session event, including inherited events during restoration.
     */
    apply(event) {
        if (event.type === 'request/header') {
            const tools = event.data.header.tools ?? [];
            this.headers.set(event.seq, tools);
            // A retained name cannot acquire a different definition without losing
            // prefix reuse; an unchanged restored name is re-offered by its recorded addition.
            const redeclared = tools.some((tool) => {
                const before = this.declared.get(tool.name);
                return before !== undefined && JSON.stringify(before) !== JSON.stringify(tool);
            });
            if (this.baselineSeq === undefined || event.data.reason === 'series' || event.data.startsSeries || redeclared) {
                this.baselineSeq = event.seq;
                this.declared = new Map(tools.map(tool => [tool.name, tool]));
                this.history = deepFreeze({ tools, updates: [] });
                this.available = new Set(tools.map(tool => tool.name));
            }
            this.active = tools;
        }
        else if (event.type === 'developer/message') {
            const { message, headerSeq } = event.data;
            // Empty replacement nodes and ordinary developer prose do not change
            // the catalog. Retiring prompt evidence must not grow its tool history.
            if (!message.content.some(block => block.type === 'tool-addition' || block.type === 'tool-removal'))
                return;
            const definitions = headerSeq === undefined ? [] : this.headers.get(headerSeq) ?? this.headerBase?.get(headerSeq);
            const additions = message.content.flatMap((block) => {
                if (block.type !== 'tool-addition')
                    return [];
                const tool = definitions?.find(tool => tool.name === block.toolName);
                if (tool === undefined)
                    throw new Error(`tool history: missing definition for ${block.toolName}`);
                return [tool];
            });
            for (const tool of additions)
                this.declared.set(tool.name, tool);
            for (const block of message.content) {
                if (block.type === 'tool-addition')
                    this.available.add(block.toolName);
                else if (block.type === 'tool-removal')
                    this.available.delete(block.toolName);
            }
            this.history = deepFreeze({
                tools: this.history.tools,
                updates: [...this.history.updates, { messageId: message.id, additions }],
            });
        }
    }
    /**
     * Read an immutable snapshot; subsequent events do not mutate it.
     * @returns initial declarations and historically resolved additions for the current series.
     */
    snapshot() {
        // Sessions written before tool-update emission have headers without matching updates.
        if (this.active.length !== this.available.size || this.active.some(tool => !this.available.has(tool.name))) {
            return deepFreeze({ tools: this.active, updates: [] });
        }
        return this.history;
    }
}
