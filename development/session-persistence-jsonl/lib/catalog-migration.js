// Generated from runtime/alpha3/compat/session-persistence-jsonl/src/catalog-migration.ts; edit the TypeScript source.
/** Collect historical discovery facts without recursively preparing related current generations. */
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { historicalSessionFormatCatalog, sessionFormatCatalog } from '@deepseek-ai/dsh-session-format-catalog';
import { historicalChildCatalogSource } from '@deepseek-ai/dsh-session-format-v3-to-v4';
import { SessionFormatUnsupportedMigrationError } from '@deepseek-ai/dsh-session-format';
import { parseGenerationLogFilename } from './format.js';
import { JsonlGenerationSourceChangedError, readDecodedJsonlSource } from './generation.js';
/**
 * Collect each related child's own descriptor through existing historical codecs.
 * @param parentId - parent whose incoming migration consumes these facts.
 * @param sources - header-indexed direct children in the selected source corpus.
 * @param compression - configured source encoding.
 * @param signal - cancellation forwarded through each source read.
 * @returns compact facts and child-local failures; complete child event arrays are released after extraction.
 */
export async function prepareCatalogFacts(parentId, sources, compression, signal) {
    const facts = [];
    const failures = [];
    const witnesses = [];
    for (const source of sources) {
        signal.throwIfAborted();
        const version = parseGenerationLogFilename(basename(source.path), compression);
        if (version === undefined)
            throw new SessionFormatUnsupportedMigrationError(`unrecognized historical child generation ${source.path}`);
        const witness = {
            path: source.path, identity: await stat(source.path, { bigint: true }),
        };
        witnesses.push(witness);
        const unavailable = { childId: source.header.id, childCreatedAt: source.header.createdAt,
            descriptorCount: 0, descriptor: null, sourcePath: source.path };
        let restored;
        try {
            restored = await readDecodedJsonlSource(source.path, version, compression, {
                createRestore: header => (version <= 3 ? historicalSessionFormatCatalog : sessionFormatCatalog).createRestore(header, {
                    recovery: 'recoverable', validation: 'current',
                }),
            }, signal);
        }
        catch (error) {
            signal.throwIfAborted();
            failures.push({ path: source.path, error });
            facts.push(unavailable);
            continue;
        }
        witness.identity = restored.identity;
        const header = restored.artifact.header;
        if (header.id !== source.header.id || header.createdAt !== source.header.createdAt
            || header.parentSession !== parentId || header.origin !== 'subagent'
            || ['cwd', 'isSeeded', 'delegationDepth', 'agentPreset'].some(key => header[key] !== source.header[key])) {
            throw new JsonlGenerationSourceChangedError(source.path);
        }
        let fact;
        try {
            fact = historicalChildCatalogSource(restored.artifact);
        }
        catch (error) {
            failures.push({ path: source.path, error });
            facts.push(unavailable);
            continue;
        }
        facts.push({ ...fact, sourcePath: source.path });
    }
    return {
        facts,
        failures,
        async validate() {
            for (const witness of witnesses) {
                const current = await stat(witness.path, { bigint: true });
                if (current.dev !== witness.identity.dev || current.ino !== witness.identity.ino
                    || current.size !== witness.identity.size || current.mtimeNs !== witness.identity.mtimeNs
                    || current.ctimeNs !== witness.identity.ctimeNs)
                    throw new JsonlGenerationSourceChangedError(witness.path);
            }
        },
    };
}
