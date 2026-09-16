// Generated from runtime/alpha3/operations/test-temp.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const owned = new Map();
export function cleanupTestDirectory(directory) {
    const root = owned.get(directory);
    if (!root)
        return;
    if (fs.existsSync(directory)) {
        if (fs.lstatSync(directory).isSymbolicLink() || path.dirname(fs.realpathSync(directory)) !== root)
            throw Error('Test directory ownership changed');
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
    owned.delete(directory);
}
export function testTempRoot() {
    const configured = process.env.DSH_TEST_TMPDIR;
    if (configured && !path.isAbsolute(configured))
        throw Error('DSH_TEST_TMPDIR must be absolute');
    const target = configured || path.join(repo, 'artifacts/test-temp');
    if (process.platform === 'win32' && path.parse(target).root.toLowerCase() === 'c:\\')
        throw Error('Test temporary files must not use C:');
    fs.mkdirSync(target, { recursive: true });
    const root = fs.realpathSync(target);
    if (process.platform === 'win32' && path.parse(root).root.toLowerCase() === 'c:\\')
        throw Error('Test temporary files must not resolve to C:');
    return root;
}
export function createTestDirectory(prefix) {
    if (!/^[a-z0-9][a-z0-9-]*-$/i.test(prefix))
        throw Error('Invalid test directory prefix');
    const root = testTempRoot();
    const directory = fs.mkdtempSync(path.join(root, prefix));
    owned.set(directory, root);
    return directory;
}
// Covers successful runs and uncaught test failures without removing another run.
process.once('exit', () => {
    for (const directory of owned.keys()) {
        try {
            cleanupTestDirectory(directory);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Test temporary cleanup failed:', directory, message);
            process.exitCode = 1;
        }
    }
});
