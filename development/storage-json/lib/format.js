// Generated from runtime/alpha3/compat/storage-json/src/format.ts; edit the TypeScript source.
/**
 * On-disk JSON unit format: the file is always the current net state, kept
 * human-readable (pretty-printed, stable key order from insertion) — that
 * legibility is this backend's reason to exist. `single`-layout units are
 * one document with a unit header; `per-record`-layout units are a directory
 * with one version-stamped document per record (`<table>/<key>.json`) plus a
 * `global.json` for the global slot, so a write rewrites one record instead
 * of the whole unit.
 * @module @deepseek-ai/dsh-storage-json/src/format
 */
import { StorageError } from '@deepseek-ai/dsh-storage';
/**
 * Serialize a unit state to file content.
 * @param name - Unit name, stamped into the header.
 * @param state - Authoritative in-memory state.
 * @returns pretty-printed JSON document with a trailing newline.
 */
export function serialize(name, state) {
    const tables = {};
    for (const [table, records] of state.tables) {
        tables[table] = Object.fromEntries(records);
    }
    const document = {
        unit: { name, version: state.version },
        global: state.global,
        tables,
    };
    return `${JSON.stringify(document, null, 2)}\n`;
}
/**
 * Parse file content into unit state, validating shape and version.
 * @param text - Raw file content.
 * @param descriptor - Expected identity; version mismatch rejects.
 * @returns the parsed state.
 */
export function parse(text, descriptor) {
    let document;
    try {
        document = JSON.parse(text);
    }
    catch (error) {
        throw new StorageError('malformed-medium', `unit '${descriptor.name}': file is not valid JSON`, { cause: error });
    }
    if (typeof document !== 'object' || document === null) {
        throw new StorageError('malformed-medium', `unit '${descriptor.name}': file is not a JSON object`);
    }
    const { unit, global: globalValue, tables } = document;
    if (typeof unit !== 'object' || unit === null ||
        unit['name'] !== descriptor.name ||
        typeof unit['version'] !== 'number') {
        throw new StorageError('malformed-medium', `unit '${descriptor.name}': missing or foreign unit header`);
    }
    const version = unit['version'];
    if (version !== descriptor.version) {
        throw new StorageError('version-mismatch', `unit '${descriptor.name}': stored version ${version} != expected ${descriptor.version}`);
    }
    // `typeof` alone admits an array: reading one as a table map reports every
    // declared table as absent, and the next publish replaces the file with that
    // empty view, discarding records this reader could not see.
    if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) {
        throw new StorageError('malformed-medium', `unit '${descriptor.name}': tables is not an object`);
    }
    const state = { version, global: globalValue ?? null, tables: new Map() };
    for (const table of descriptor.tables) {
        const records = tables[table];
        if (records === undefined) {
            state.tables.set(table, new Map());
            continue;
        }
        if (typeof records !== 'object' || records === null || Array.isArray(records)) {
            throw new StorageError('malformed-medium', `unit '${descriptor.name}': table '${table}' is not an object`);
        }
        state.tables.set(table, new Map(Object.entries(records)));
    }
    return state;
}
/**
 * Serialize one per-record document: the unit's version stamp plus the
 * record value, pretty-printed like the whole-unit document.
 * @param version - Unit format version, stamped into the header.
 * @param value - The record value (or the global singleton value).
 * @returns pretty-printed JSON document with a trailing newline.
 */
export function serializeRecord(version, value) {
    return `${JSON.stringify({ version, record: value }, null, 2)}\n`;
}
/**
 * Parse one per-record document, validating its version stamp. A document
 * that is malformed or stamped with an unaccepted version is FOREIGN and
 * reads as absent — the per-record contract: one bad or stale record file
 * must not brick the whole unit, and an unaccepted version stamp discards the
 * record instead of migrating it (the whole-unit format rejects instead,
 * because there is exactly one document).
 * @param text - Raw per-record document content.
 * @param versions - Accepted unit versions (the current one plus the
 * descriptor's compatibleVersions); any other stamp discards the
 * document.
 * @returns the record value, or `undefined` for a foreign document.
 */
export function parseRecord(text, versions) {
    let document;
    try {
        document = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    if (typeof document !== 'object' || document === null)
        return undefined;
    const { version: stamped, record } = document;
    if (typeof stamped !== 'number' || !versions.includes(stamped))
        return undefined;
    return record;
}
