// Generated from runtime/alpha3/compat/session-persistence-jsonl/src/generation.ts; edit the TypeScript source.
/**
 * Durable whole-generation publication for JSONL Session artifacts.
 *
 * Format packages transform parsed JSON values. This module owns the physical
 * encoding, exact source identity, immutable generation files, and exclusive
 * current-generation publication for both configured JSONL suffixes.
 * @module @deepseek-ai/dsh-session-persistence-jsonl/generation
 */
import { currentSessionMessageProjections } from 'dsh-nexttavern-session-format/catalog';
import { createHash, randomBytes } from 'node:crypto';
import { link as fsLink, lstat as fsLstat, open as fsOpen, readFile as fsReadFile, readdir as fsReaddir, rm as fsRm, stat as fsStat, } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pipeline, Readable } from 'node:stream';
import { scheduler } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { constants, createZstdCompress } from 'node:zlib';
import { Session } from '@deepseek-ai/dsh-session';
import { BlockAssembler, expandAssistantStream } from '@deepseek-ai/dsh-llm';
import { validateStoredEvents } from 'dsh-nexttavern-session-format/storage-contract';
import { generationLogFilename, logSuffix, SessionLogScanner } from './format.js';
import { publishNewFileWin32 } from './win32.js';
import { compressZstdFrame, createZstdFrameDecoder, decompressZstdPrefix, scanZstdFrames, } from './zstd.js';
/** Internal scheduling bounds: preserve old decode cadence and cap each synchronous encode slice. */
const MIGRATION_DECODE_YIELD_INTERVAL_MS = 500;
const MIGRATION_WORK_CHUNK_BYTES = 1024 * 1024;
const MIGRATION_WRITE_CHUNK_BYTES = 4 * 1024 * 1024;
const ZSTD_CHECKSUM_OPTIONS = {
    chunkSize: MIGRATION_WORK_CHUNK_BYTES,
    params: { [constants.ZSTD_c_checksumFlag]: 1 },
};
/** A historical source changed after its single decode and migration pass. */
export class JsonlGenerationSourceChangedError extends Error {
    path;
    name = 'JsonlGenerationSourceChangedError';
    /** @param path - historical generation whose revision changed. */
    constructor(path) {
        super(`historical session generation changed during migration: "${path}"`);
        this.path = path;
    }
}
/** A historical artifact is intact, but the format edge refuses its contents. */
export class JsonlGenerationUnsupportedMigrationError extends Error {
    fromVersion;
    reason;
    name = 'JsonlGenerationUnsupportedMigrationError';
    /**
     * @param fromVersion - unchanged source generation version.
     * @param reason - format-edge refusal.
     */
    constructor(fromVersion, reason) {
        super(reason.message, { cause: reason });
        this.fromVersion = fromVersion;
        this.reason = reason;
    }
}
/** A current-generation filename already names different or invalid bytes. */
export class JsonlGenerationTargetConflictError extends Error {
    path;
    reason;
    name = 'JsonlGenerationTargetConflictError';
    /**
     * @param path - immutable target that prevented exclusive publication.
     * @param reason - why the existing target cannot be accepted.
     */
    constructor(path, reason) {
        super(`current session generation already exists at "${path}": ${reason.message}`, { cause: reason });
        this.path = path;
        this.reason = reason;
    }
}
const defaultFileSystem = {
    open: (path, flags, mode) => fsOpen(path, flags, mode),
    readFile: (path, signal) => fsReadFile(path, signal === undefined ? undefined : { signal }),
    readdir: path => fsReaddir(path),
    stat: path => fsStat(path, { bigint: true }),
    lstat: path => fsLstat(path),
    link: fsLink,
    rm: path => fsRm(path, { force: true }),
};
const defaultInternals = {
    fs: defaultFileSystem,
    randomToken: () => randomBytes(8).toString('hex'),
    platform: process.platform,
    publishNewWin32: publishNewFileWin32,
    barrier: () => { },
};
function isEEXIST(error) {
    return error?.code === 'EEXIST';
}
/** Whether a filesystem-owned failure should retain its original errno and path. */
function isErrnoException(error) {
    return typeof error?.code === 'string';
}
function identity(value) {
    return [value.dev, value.ino, value.size, value.mtimeNs, value.ctimeNs].join(':');
}
/**
 * Read one stable revision of a JSONL file with a single retry. If an append
 * overlaps both reads, return the second read's committed pre-read prefix
 * instead of starving behind a continuous writer.
 * @param path - the generation file to read.
 * @param signal - optional cancellation for the stat/read work.
 * @returns the stable bytes (or the committed prefix) and their stat identity.
 */
export async function readStableJsonlFile(path, signal) {
    return defaultGenerationRuntime.readStable(path, signal);
}
async function readStableSnapshot(path, signal, fs) {
    signal?.throwIfAborted();
    let before = await fs.stat(path);
    for (let attempt = 0;; attempt += 1) {
        const bytes = await fs.readFile(path, signal);
        signal?.throwIfAborted();
        const after = await fs.stat(path);
        if (identity(before) === identity(after)) {
            signal?.throwIfAborted();
            return { bytes, identity: after };
        }
        if (attempt === 1) {
            return { bytes: bytes.subarray(0, Number(before.size)), identity: before };
        }
        before = after;
    }
}
/** Parse the version discriminator without validating any version-specific field. */
function storedVersion(header) {
    if (typeof header !== 'object' || header === null || Array.isArray(header)) {
        throw new Error('corrupt session log: first line is not a JSON object');
    }
    const version = header.version;
    if (!Number.isSafeInteger(version) || version < 0 || Object.is(version, -0)) {
        throw new Error('corrupt session log: header version is not a non-negative safe integer');
    }
    return version;
}
function parseJson(text, subject) {
    try {
        return JSON.parse(text);
    }
    catch (error) {
        throw new Error(`corrupt session log: ${subject} is not valid JSON`, { cause: error });
    }
}
/** Incremental JSONL parser that retains only one cross-frame record fragment. */
class MigratingJsonlRows {
    restore;
    fragments = [];
    fragmentBytes = 0;
    rowIndex = 0;
    issue;
    constructor(restore) {
        this.restore = restore;
    }
    /** Consume plaintext bytes following the independently decoded header. */
    write(chunk) {
        /* jscpd:ignore-start -- migration parsing and readable-log scanning own different recovery and byte-accounting state. */
        let lineStart = 0;
        for (let newline = chunk.indexOf(0x0A); newline !== -1; newline = chunk.indexOf(0x0A, lineStart)) {
            const fragment = chunk.subarray(lineStart, newline);
            let line = fragment;
            if (this.fragments.length > 0) {
                if (fragment.length > 0)
                    this.fragments.push(fragment);
                line = Buffer.concat(this.fragments, this.fragmentBytes + fragment.length);
                this.fragments = [];
                this.fragmentBytes = 0;
            }
            this.consume(line);
            lineStart = newline + 1;
        }
        if (lineStart < chunk.length) {
            const fragment = Buffer.from(chunk.subarray(lineStart));
            this.fragments.push(fragment);
            this.fragmentBytes += fragment.length;
        }
        /* jscpd:ignore-end */
    }
    /** Refuse a record fragment left by structurally complete Zstandard frames. */
    assertCompleteFramesEndOnRecord() {
        if (this.fragments.length > 0) {
            throw new Error('corrupt Zstandard session log: complete frame contains a torn JSONL record');
        }
    }
    finish() {
        return this.restore.finish();
    }
    consume(line) {
        const index = this.rowIndex;
        this.rowIndex += 1;
        let row;
        try {
            row = parseJson(line.toString('utf8'), `row ${index + 1}`);
        }
        catch (error) {
            this.issue ??= asError(error);
            return;
        }
        if (this.issue !== undefined) {
            if (typeof row === 'object' && row !== null
                && row.type === 'turn/end')
                throw this.issue;
            return;
        }
        this.restore.decodeRow(row);
    }
}
async function startMigrationStream(headerRecord, sourceVersion, format, validateHistoricalHeader) {
    const value = parseJson(headerRecord.subarray(0, -1).toString('utf8'), 'header line');
    const version = storedVersion(value);
    if (version !== sourceVersion) {
        throw new Error(`resolved JSONL source filename identifies v${sourceVersion}, but its header identifies v${version}`);
    }
    const header = value;
    const validation = validateHistoricalHeader?.(header);
    if (validation !== undefined)
        await validation;
    const stream = format.createRestore(header);
    return { parser: new MigratingJsonlRows(stream) };
}
async function consumeMigrationBytes(rows, chunks, signal) {
    signal?.throwIfAborted();
    let yieldDeadline = performance.now() + MIGRATION_DECODE_YIELD_INTERVAL_MS;
    for (const bytes of chunks) {
        for (let offset = 0; offset < bytes.length; offset += MIGRATION_WORK_CHUNK_BYTES) {
            rows.write(bytes.subarray(offset, offset + MIGRATION_WORK_CHUNK_BYTES));
            if (performance.now() < yieldDeadline)
                continue;
            await scheduler.yield();
            signal?.throwIfAborted();
            yieldDeadline = performance.now() + MIGRATION_DECODE_YIELD_INTERVAL_MS;
        }
    }
}
async function decodeStreamingMigration(bytes, compression, sourceVersion, format, validateHistoricalHeader, signal) {
    signal?.throwIfAborted();
    if (compression === 'none') {
        const headerEnd = bytes.indexOf(0x0A);
        if (headerEnd === -1)
            throw new Error('empty or header-less session log');
        const stream = await startMigrationStream(bytes.subarray(0, headerEnd + 1), sourceVersion, format, validateHistoricalHeader);
        signal?.throwIfAborted();
        const bodyEnd = bytes.lastIndexOf(0x0A);
        if (bodyEnd > headerEnd) {
            await consumeMigrationBytes(stream.parser, [bytes.subarray(headerEnd + 1, bodyEnd + 1)], signal);
        }
        return stream.parser.finish();
    }
    const { frames, tornStart } = scanZstdFrames(bytes);
    if (frames.length === 0)
        throw new Error('empty or header-less Zstandard session log');
    const decoder = createZstdFrameDecoder();
    try {
        const decoded = decoder.decode(bytes, frames);
        const first = decoded.next();
        /* v8 ignore next -- a non-empty structural frame list yields once or throws. */
        if (first.done)
            throw new Error('empty or header-less Zstandard session log');
        assertIndependentHeaderFrame(first.value);
        const stream = await startMigrationStream(first.value, sourceVersion, format, validateHistoricalHeader);
        signal?.throwIfAborted();
        await consumeMigrationBytes(stream.parser, decoded, signal);
        stream.parser.assertCompleteFramesEndOnRecord();
        if (tornStart !== undefined) {
            let recovered = Buffer.alloc(0);
            try {
                recovered = await decompressZstdPrefix(bytes.subarray(tornStart));
            }
            catch {
                /* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent. */
                if (signal?.aborted)
                    signal.throwIfAborted();
            }
            signal?.throwIfAborted();
            const newline = recovered.lastIndexOf(0x0A);
            if (newline !== -1) {
                await consumeMigrationBytes(stream.parser, [recovered.subarray(0, newline + 1)], signal);
            }
        }
        return stream.parser.finish();
    }
    finally {
        decoder.close();
    }
}
/**
 * Read and validate one complete current generation for an isolated verifier.
 * @param path - staged or competing current-generation path.
 * @param compression - configured physical encoding.
 * @param expectedId - Session identity expected in the header.
 * @param expectedEventCount - exact logical event count expected after decoding.
 * @param expectedPrefix - verified migration prefix; an append tail may be present and is not validated.
 * @returns stable physical identity and digest for publication comparison.
 */
export async function verifyJsonlCurrentGeneration(path, compression, expectedId, expectedEventCount, expectedPrefix) {
    return defaultGenerationRuntime.verify(path, compression, expectedId, expectedEventCount, expectedPrefix);
}
async function verifyCurrentGeneration(path, compression, expectedId, expectedEventCount, fs, expectedPrefix) {
    const before = await fs.stat(path);
    const bytes = await fs.readFile(path);
    const after = await fs.stat(path);
    if (expectedPrefix !== undefined) {
        if (bytes.length < expectedPrefix.bytes) {
            throw new Error('target bytes are shorter than the migrated generation');
        }
        const digest = createHash('sha256').update(bytes.subarray(0, expectedPrefix.bytes)).digest('hex');
        if (digest !== expectedPrefix.digest) {
            throw new Error('target bytes do not begin with the migrated generation');
        }
        return { identity: after, bytes: expectedPrefix.bytes, digest };
    }
    if (identity(before) !== identity(after)) {
        throw new Error('current session generation changed during verification');
    }
    const snapshot = { bytes, identity: after };
    const generation = decodeCurrentGeneration(snapshot.bytes, compression);
    validateStoredEvents(generation.meta, generation.events, { kind: 'jsonl', path });
    if (generation.meta.id !== expectedId) {
        throw new Error(`current session generation contains id "${generation.meta.id}", expected "${expectedId}"`);
    }
    if (generation.events.length !== expectedEventCount) {
        throw new Error(`current session generation contains ${generation.events.length} events, expected ${expectedEventCount}`);
    }
    Session.fromRestore(generation.meta.id, generation.events, generation.meta, generation.inheritedEventCount, 'detached', currentSessionMessageProjections);
    assertCurrentAssistantStreams(generation.events);
    return {
        identity: snapshot.identity,
        bytes: snapshot.bytes.length,
        digest: createHash('sha256').update(snapshot.bytes).digest('hex'),
    };
}
/** Fully replay embedded streams only inside isolated current-generation verification. */
function assertCurrentAssistantStreams(events) {
    for (const [index, event] of events.entries()) {
        if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt')
            continue;
        const assembler = new BlockAssembler();
        let timed;
        try {
            timed = expandAssistantStream(event.data.stream);
            for (const member of timed)
                assembler.push(member.chunk);
        }
        catch (error) {
            throw new Error(`seed ${event.type} at index ${index} has an invalid embedded stream`, { cause: error });
        }
        if (event.type === 'assistant/attempt' || timed.length === 0)
            continue;
        const content = event.data.interrupted === true ? assembler.interruptedBlocks() : assembler.blocks();
        if (!isDeepStrictEqual(event.data.message.content, content)) {
            throw new Error(`seed assistant/message at index ${index} content disagrees with its embedded stream`);
        }
        if (!isDeepStrictEqual(event.data.usage, assembler.usage)) {
            throw new Error(`seed assistant/message at index ${index} usage disagrees with its embedded stream`);
        }
        if (!isDeepStrictEqual(event.data.message.source.replayState, assembler.replayState)) {
            throw new Error(`seed assistant/message at index ${index} replay state disagrees with its embedded stream`);
        }
    }
}
function decodeCurrentGeneration(bytes, compression) {
    if (compression === 'none') {
        const headerEnd = bytes.indexOf(0x0A);
        if (headerEnd === -1)
            throw new Error('empty or header-less session log');
        const scanner = new SessionLogScanner(bytes.subarray(0, headerEnd + 1), 'strict');
        scanner.write(bytes.subarray(headerEnd + 1));
        return finishCurrentGenerationScan(scanner);
    }
    const { frames, tornStart } = scanZstdFrames(bytes);
    if (frames.length === 0)
        throw new Error('empty or header-less Zstandard session log');
    if (tornStart !== undefined)
        throw new Error('current session generation has a torn physical tail');
    const decoder = createZstdFrameDecoder();
    try {
        const plaintext = decoder.decode(bytes, frames);
        const header = plaintext.next();
        /* v8 ignore next -- a non-empty structural frame list yields once or throws. */
        if (header.done)
            throw new Error('empty or header-less Zstandard session log');
        assertIndependentHeaderFrame(header.value);
        const scanner = new SessionLogScanner(header.value, 'strict');
        for (const chunk of plaintext)
            scanner.write(chunk);
        return finishCurrentGenerationScan(scanner);
    }
    finally {
        decoder.close();
    }
}
function finishCurrentGenerationScan(scanner) {
    const inputBytes = scanner.checkpoint().inputBytes;
    const decoded = scanner.finish();
    if (decoded.committedBytes !== inputBytes)
        throw new Error('current session generation has a torn physical tail');
    return decoded;
}
function stringifyJson(value, subject) {
    let text;
    try {
        text = JSON.stringify(value);
    }
    catch (error) {
        throw new Error(`${subject} is not lossless JSON`, { cause: error });
    }
    if (typeof text !== 'string')
        throw new Error(`${subject} is not lossless JSON`);
    return text;
}
function assertIndependentHeaderFrame(plaintext) {
    if (plaintext.length === 0 || plaintext.indexOf(0x0A) !== plaintext.length - 1) {
        throw new Error('corrupt Zstandard session log: first frame is not exactly one header line');
    }
}
function assertGenerationPaths(sourcePath, sourceVersion, currentPath, currentVersion, compression) {
    const expectedSource = generationLogFilename(sourceVersion, compression);
    const expectedCurrent = generationLogFilename(currentVersion, compression);
    if (basename(sourcePath) !== expectedSource) {
        throw new Error(`resolved JSONL source path must end with "${expectedSource}": ${sourcePath}`);
    }
    if (basename(currentPath) !== expectedCurrent) {
        throw new Error(`current JSONL generation path must end with "${expectedCurrent}": ${currentPath}`);
    }
    if (dirname(sourcePath) !== dirname(currentPath)) {
        throw new Error('source and current JSONL generations must share one Session directory');
    }
    return logSuffix(compression);
}
async function syncDirectory(path, internals) {
    /* v8 ignore next -- Windows namespace operations request write-through directly. */
    if (internals.platform === 'win32')
        return;
    const handle = await internals.fs.open(path, 'r');
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
/** Produce bounded JSONL chunks while yielding between main-thread encoding slices. */
async function* encodeMigrationRows(artifact, format, signal) {
    signal?.throwIfAborted();
    let lines = [];
    let bytes = 0;
    for (const value of artifact.events) {
        const line = `${stringifyJson(format.encodeEvent(value), `migrated Session event ${value.seq}`)}\n`;
        const lineBytes = Buffer.byteLength(line);
        if (bytes > 0 && bytes + lineBytes > MIGRATION_WORK_CHUNK_BYTES) {
            yield Buffer.from(lines.join(''));
            await scheduler.yield();
            signal?.throwIfAborted();
            lines = [];
            bytes = 0;
        }
        lines.push(line);
        bytes += lineBytes;
    }
    yield Buffer.from(lines.join(''));
}
async function writeMigrationChunks(chunks, write) {
    let pending = [];
    let bytes = 0;
    for await (const chunk of chunks) {
        pending.push(chunk);
        bytes += chunk.length;
        if (bytes < MIGRATION_WRITE_CHUNK_BYTES)
            continue;
        await write(pending.length === 1 ? pending[0] : Buffer.concat(pending, bytes));
        pending = [];
        bytes = 0;
    }
    if (bytes > 0)
        await write(pending.length === 1 ? pending[0] : Buffer.concat(pending, bytes));
}
/** Encode directly into one synced stage without a whole-artifact row or byte buffer. */
async function writeSyncedTemp(currentPath, suffix, compression, artifact, format, signal, internals) {
    signal?.throwIfAborted();
    let path;
    let handle;
    for (;;) {
        path = join(dirname(currentPath), `session.migration.${internals.randomToken()}${suffix}.tmp`);
        try {
            handle = await internals.fs.open(path, 'wx', 0o600);
            break;
        }
        catch (error) {
            if (isEEXIST(error))
                continue;
            throw error;
        }
    }
    const hash = createHash('sha256');
    let bytes = 0;
    const write = async (chunk) => {
        await handle.writeFile(chunk);
        hash.update(chunk);
        bytes += chunk.length;
    };
    let failure;
    try {
        const headerValue = format.encodeHeader(artifact.header, artifact.inheritedEventCount);
        const header = Buffer.from(`${stringifyJson(headerValue, 'migrated session header')}\n`);
        await write(compression === 'zstd' ? await compressZstdFrame(header) : header);
        if (artifact.events.length > 0) {
            const rows = encodeMigrationRows(artifact, format, signal);
            if (compression === 'none') {
                await writeMigrationChunks(rows, write);
            }
            else {
                await new Promise((resolve, reject) => {
                    pipeline(Readable.from(rows, { objectMode: false, highWaterMark: MIGRATION_WORK_CHUNK_BYTES }), createZstdCompress(ZSTD_CHECKSUM_OPTIONS), async (source) => { await writeMigrationChunks(source, write); }, (error) => {
                        if (error instanceof Error)
                            reject(error);
                        else
                            resolve();
                    });
                });
            }
        }
        signal?.throwIfAborted();
        await handle.sync();
    }
    catch (error) {
        failure = error;
    }
    try {
        await handle.close();
    }
    catch (error) {
        failure = failure === undefined
            ? error
            : new AggregateError([failure, error], `failed to write and close migration stage "${path}"`);
    }
    if (failure !== undefined) {
        const writeError = failure instanceof Error
            ? failure
            : new Error('migration stage write failed with a non-Error rejection', { cause: failure });
        await removeTemporary(path, writeError, internals);
        throw writeError;
    }
    return { path, bytes, digest: hash.digest('hex') };
}
/** Remove one temporary file without hiding the operation failure that made it disposable. */
async function removeTemporary(path, primaryFailure, internals) {
    try {
        await internals.fs.rm(path);
    }
    catch (cleanupFailure) {
        throw new AggregateError([primaryFailure, cleanupFailure], `failed to clean migration temporary "${path}" after an earlier failure`);
    }
}
/** Remove a redundant stage after the target has been validated as committed. */
async function removeCommittedTemporary(path, internals) {
    try {
        await internals.fs.rm(path);
    }
    catch {
        // The validated target owns the committed bytes; a redundant link cannot turn success into failure.
    }
}
async function publishCurrentExclusive(staged, currentPath, internals) {
    if (internals.platform === 'win32') {
        try {
            await internals.publishNewWin32(staged, currentPath);
            return true;
        }
        catch (error) {
            /* v8 ignore else -- native helper tests own non-collision Win32 failures. */
            if (isEEXIST(error))
                return false;
            /* v8 ignore next -- the filesystem error is already complete. */
            throw error;
        }
    }
    try {
        await internals.fs.link(staged, currentPath);
    }
    catch (error) {
        /* v8 ignore else -- a non-collision filesystem error propagates unchanged. */
        if (isEEXIST(error))
            return false;
        /* v8 ignore next -- the filesystem error is already complete. */
        throw error;
    }
    await syncDirectory(dirname(currentPath), internals);
    return true;
}
function asError(error) {
    return error instanceof Error ? error : new Error('current-generation validation failed with a non-Error rejection', {
        cause: error,
    });
}
async function inspectExpectedCurrent(currentPath, internals, inspect) {
    try {
        const expectedName = basename(currentPath);
        const names = await internals.fs.readdir(dirname(currentPath));
        if (!names.includes(expectedName)) {
            const noncanonical = names.find(name => name.toLowerCase() === expectedName.toLowerCase());
            if (noncanonical !== undefined) {
                throw new Error(`target resolves to noncanonical directory entry "${noncanonical}"`);
            }
        }
        const info = await internals.fs.lstat(currentPath);
        if (info.isSymbolicLink() || !info.isFile()) {
            throw new Error(`target is a ${info.isSymbolicLink() ? 'symbolic link' : 'non-regular file'}`);
        }
        return await inspect();
    }
    catch (error) {
        if (isErrnoException(error))
            throw error;
        throw new JsonlGenerationTargetConflictError(currentPath, asError(error));
    }
}
function withOverrides(overrides) {
    return {
        ...defaultInternals,
        ...overrides,
        fs: { ...defaultFileSystem, ...overrides.fs },
    };
}
async function publishPreparedMigration(options, suffix, artifact, sourceIdentity, internals) {
    await scheduler.yield();
    const { sourcePath, currentPath, compression, verifyCurrentFile } = options;
    const eventCount = artifact.events.length;
    let staged = await writeSyncedTemp(currentPath, suffix, compression, artifact, options.format, undefined, internals);
    try {
        const verifiedStage = await verifyCurrentFile(staged.path, compression, artifact.header.id, eventCount);
        if (verifiedStage.bytes !== staged.bytes || verifiedStage.digest !== staged.digest) {
            throw new Error('staged session generation changed during verification');
        }
        await internals.barrier('before-source-check', 1);
        const beforePublish = await internals.fs.stat(sourcePath);
        if (identity(beforePublish) !== identity(sourceIdentity)) {
            throw new JsonlGenerationSourceChangedError(sourcePath);
        }
        const published = await publishCurrentExclusive(staged.path, currentPath, internals);
        if (published && internals.platform === 'win32')
            staged = { ...staged, path: '' };
        await internals.barrier('after-publication', 1);
        let currentIdentity;
        if (published) {
            if (staged.path !== '') {
                await removeCommittedTemporary(staged.path, internals);
                staged = { ...staged, path: '' };
            }
            currentIdentity = await internals.fs.stat(currentPath);
        }
        else {
            const winner = await inspectExpectedCurrent(currentPath, internals, async () => {
                const candidate = await verifyCurrentFile(currentPath, compression, artifact.header.id, eventCount, staged);
                if (candidate.bytes !== staged.bytes || candidate.digest !== staged.digest) {
                    throw new Error('target bytes differ from the migrated generation');
                }
                return candidate;
            });
            currentIdentity = winner.identity;
            await removeCommittedTemporary(staged.path, internals);
            staged = { ...staged, path: '' };
        }
        return currentIdentity;
    }
    catch (error) {
        if (staged.path !== '')
            await removeTemporary(staged.path, error, internals);
        throw error;
    }
}
async function prepareMigration(options, internals) {
    const { sourcePath, sourceVersion, currentPath, compression, format, signal } = options;
    const suffix = assertGenerationPaths(sourcePath, sourceVersion, currentPath, format.currentVersion, compression);
    if (sourceVersion >= format.currentVersion) {
        throw new Error(`migration preparation requires a historical source, got v${sourceVersion}`);
    }
    const source = await readStableSnapshot(sourcePath, signal, internals.fs);
    let artifact;
    try {
        artifact = await decodeStreamingMigration(source.bytes, compression, sourceVersion, format, options.validateHistoricalHeader, signal);
    }
    catch (error) {
        if (format.isUnsupportedMigrationError?.(error) === true) {
            throw new JsonlGenerationUnsupportedMigrationError(sourceVersion, error);
        }
        throw error;
    }
    if (artifact.header.version !== format.currentVersion) {
        throw new Error(`format migration returned v${artifact.header.version}, expected v${format.currentVersion}`);
    }
    const sourceIdentity = source.identity;
    let publication;
    return {
        sourceIdentity,
        artifact,
        publish() {
            if (publication === undefined) {
                publication = publishPreparedMigration(options, suffix, artifact, sourceIdentity, internals);
            }
            return publication;
        },
    };
}
/**
 * Decode and migrate one historical generation without writing its successor.
 * @param options - resolved source, current target, format adapter, and load cancellation.
 * @returns the current artifact and an idempotent explicit publication operation.
 */
export function prepareJsonlMigration(options) {
    return defaultGenerationRuntime.prepare(options);
}
/**
 * Create one generation runtime with fixed filesystem and publication dependencies.
 * @param overrides - deterministic filesystem, platform, and race dependencies.
 * @returns bound generation operations.
 */
export function createJsonlGenerationRuntime(overrides = {}) {
    const internals = withOverrides(overrides);
    return {
        readStable: (path, signal) => readStableSnapshot(path, signal, internals.fs),
        prepare: options => prepareMigration(options, internals),
        verify: (path, compression, expectedId, expectedEventCount, expectedPrefix) => verifyCurrentGeneration(path, compression, expectedId, expectedEventCount, internals.fs, expectedPrefix),
    };
}
const defaultGenerationRuntime = createJsonlGenerationRuntime();
