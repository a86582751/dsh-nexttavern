// Generated from runtime/alpha3/compat/storage-json/src/single-unit.ts; edit the TypeScript source.
/**
 * One opened JSON unit in `single` layout: the whole unit is one document at
 * `<root>/<name>.json`. The in-memory state is authoritative; every write
 * primitive mutates it and republishes the whole file atomically. Writes are
 * NOT queued here — per the backend contract, write ordering belongs to the
 * caller (the domain layer's write chain); this unit only guarantees that
 * each single call publishes a complete, durable file. The `per-record`
 * layout is a separate unit class in `per-record-unit.ts`.
 * @module @deepseek-ai/dsh-storage-json/src/single-unit
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StorageError } from '@deepseek-ai/dsh-storage';
import { writeAtomic } from './atomic.js';
import { parse, serialize } from './format.js';
/**
 * Open (load or lazily create) one `single`-layout unit under `root`: the
 * unit file is `<root>/<name>.json`.
 * @param descriptor - Static identity and shape of the unit.
 * @param root - Absolute backend root directory.
 * @param onClose - Backend callback releasing the unit's open-slot.
 * @returns the opened unit.
 */
export async function openSingleUnit(descriptor, root, onClose) {
    const path = join(root, `${descriptor.name}.json`);
    let text;
    try {
        text = await readFile(path, 'utf8');
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
        // Missing file = empty unit; materialization defers to the first write.
    }
    const state = text === undefined
        ? {
            version: descriptor.version,
            global: null,
            tables: new Map(descriptor.tables.map(table => [table, new Map()])),
        }
        : parse(text, descriptor);
    return new SingleJsonUnit(descriptor, path, state, onClose);
}
class SingleJsonUnit {
    descriptor;
    path;
    state;
    onClose;
    closed = false;
    /** In-flight publishes; close() drains them before releasing the unit. */
    inFlight = new Set();
    constructor(descriptor, path, state, onClose) {
        this.descriptor = descriptor;
        this.path = path;
        this.state = state;
        this.onClose = onClose;
    }
    // oxlint-disable-next-line typescript/require-await -- async keeps the closed guard a rejection, not a synchronous throw
    async loadAll() {
        this.assertOpen();
        const tables = {};
        for (const [table, records] of this.state.tables) {
            tables[table] = Object.fromEntries(records);
        }
        return { tables, global: this.state.global };
    }
    async putRecord(table, key, value) {
        this.assertOpen();
        const records = this.records(table);
        const hadKey = records.has(key);
        const previous = records.get(key);
        records.set(key, value);
        // Roll back on a failed publish: memory is authoritative, so a rejected
        // write must not survive in memory (or ride along with the next publish).
        await this.publish().catch((error) => {
            if (hadKey)
                records.set(key, previous);
            else
                records.delete(key);
            throw error;
        });
    }
    async deleteRecord(table, key) {
        this.assertOpen();
        const records = this.records(table);
        if (!records.has(key))
            return;
        const previous = records.get(key);
        records.delete(key);
        await this.publish().catch((error) => {
            records.set(key, previous);
            throw error;
        });
    }
    async setGlobal(value) {
        this.assertOpen();
        if (!this.descriptor.hasGlobal) {
            throw new Error(`unit '${this.descriptor.name}' does not declare a global slot`);
        }
        const previous = this.state.global;
        this.state.global = value;
        await this.publish().catch((error) => {
            this.state.global = previous;
            throw error;
        });
    }
    /* jscpd:ignore-start -- the two unit classes are standalone; the drain/guard lifecycle mirrors the shared KvUnit contract */
    async close() {
        if (this.closed) {
            await Promise.allSettled(this.inFlight);
            return;
        }
        this.closed = true;
        await Promise.allSettled(this.inFlight);
        this.onClose();
    }
    assertOpen() {
        if (this.closed) {
            throw new StorageError('closed', `unit '${this.descriptor.name}' is closed`);
        }
    }
    /* jscpd:ignore-end */
    records(table) {
        const records = this.state.tables.get(table);
        if (!records) {
            throw new Error(`unit '${this.descriptor.name}' does not declare table '${table}'`);
        }
        return records;
    }
    publish() {
        const write = writeAtomic(this.path, serialize(this.descriptor.name, this.state));
        this.inFlight.add(write);
        // Swallow only on the tracking branch: the caller still awaits `write`
        // itself, so rejections stay observed exactly once.
        write.catch(() => { }).finally(() => this.inFlight.delete(write));
        return write;
    }
}
