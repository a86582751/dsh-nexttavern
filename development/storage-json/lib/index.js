// Generated from runtime/alpha3/compat/storage-json/src/index.ts; edit the TypeScript source.
/**
 * JSON storage backend: one human-readable document per unit under a
 * configured root — a whole-unit file (`single` layout) or one document per
 * record (`per-record` layout), published by atomic rewrite. Registers as
 * backend `json` on the storage hub.
 * @module @deepseek-ai/dsh-storage-json
 */
import { mkdir } from 'node:fs/promises';
import z from '@deepseek-ai/schemastery';
import { StorageError, UNIT_NAME_RE, storageBackendServiceKey } from '@deepseek-ai/dsh-storage';
import { openSingleUnit } from './single-unit.js';
import { openPerRecordUnit } from './per-record-unit.js';
/** Cordis plugin name. */
export const name = 'storage-json';
/** The hub must exist before the backend can register. */
export const inject = ['storage'];
/** Config schema. */
export const Config = z.object({
    root: z.string().required(),
});
/** JSON backend: owns the file-tree root and serves the `kv` facet. */
export class JsonStorageBackend {
    root;
    open = new Map();
    // Reserved synchronously at open() entry so a concurrent open of the same
    // unit fails, and close() can await opens still in flight.
    opening = new Map();
    closed = false;
    constructor(root) {
        this.root = root;
    }
    kv = {
        // The body up to the first await runs synchronously, so the opening-slot
        // reservation below still excludes a concurrent open of the same unit.
        open: async (descriptor) => {
            if (this.closed)
                throw new StorageError('closed', 'json backend is closed');
            validateDescriptor(descriptor);
            if (this.open.has(descriptor.name) || this.opening.has(descriptor.name)) {
                // Double-open is a caller bug, not a medium condition.
                throw new Error(`unit '${descriptor.name}' is already open; a unit has exactly one live handle`);
            }
            const opening = this.openUnit(descriptor);
            this.opening.set(descriptor.name, opening);
            return opening.finally(() => this.opening.delete(descriptor.name));
        },
    };
    async openUnit(descriptor) {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        // The two layouts differ in medium shape only; each opener owns its own
        // path convention under the shared root.
        const onClose = () => this.open.delete(descriptor.name);
        const unit = descriptor.layout === 'per-record'
            ? await openPerRecordUnit(descriptor, this.root, onClose)
            : await openSingleUnit(descriptor, this.root, onClose);
        if (this.closed) {
            // The backend closed while this open was in flight: do not hand out a
            // live unit past close().
            await unit.close();
            throw new StorageError('closed', 'json backend is closed');
        }
        this.open.set(descriptor.name, unit);
        return unit;
    }
    async close() {
        if (!this.closed) {
            this.closed = true;
        }
        await Promise.allSettled([...this.opening.values()]);
        for (const unit of [...this.open.values()]) {
            await unit.close();
        }
    }
}
function validateDescriptor(descriptor) {
    if (!UNIT_NAME_RE.test(descriptor.name)) {
        throw new StorageError('malformed-medium', `invalid unit name '${descriptor.name}'`);
    }
    for (const table of descriptor.tables) {
        if (!UNIT_NAME_RE.test(table)) {
            throw new StorageError('malformed-medium', `invalid table name '${table}' in unit '${descriptor.name}'`);
        }
    }
}
/**
 * Register the `json` backend on the storage hub.
 * @param ctx - Plugin context.
 * @param config - Validated configuration.
 */
export function apply(ctx, config) {
    const backend = new JsonStorageBackend(config.root);
    ctx.effect(() => {
        const unregister = ctx.storage.backend.register('json', backend);
        return async () => {
            unregister();
            await backend.close();
        };
    });
    ctx.provide(storageBackendServiceKey('json'), backend);
}
