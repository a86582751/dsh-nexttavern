// Generated from runtime/alpha3/src/operations/native-fork-payload-verifier.mts; edit the TypeScript source.
/** Exact, read-only verification of host replacement payloads staged for manual activation. */
import fs from 'node:fs';
import { contained, digest } from './public-transaction.mjs';
import { regularPackageFiles } from './owned-dependency.mjs';
import { makeHostForkProfile, readHostForkProfile } from './native-fork-host-profile.mjs';
/** Three-argument callers retain the membership supplied by their historical recipes. */
export function verifyHostForkPayload(packageRoot, hostForks, recipes, profileDescriptor, inventoryProfile) {
    if (profileDescriptor) {
        const expected = makeHostForkProfile(profileDescriptor, recipes);
        const supplied = readHostForkProfile(inventoryProfile);
        if (JSON.stringify(supplied) !== JSON.stringify(expected))
            throw Error('Host fork inventory profile differs from recipes');
    }
    if (!Array.isArray(recipes) || recipes.some(recipe => recipe.version !== '0.1.7-rc.2' ||
        recipe.target !== `host-overrides/${recipe.name}`))
        throw Error('Invalid registered host fork recipe');
    if (!Array.isArray(hostForks) || hostForks.length !== recipes.length)
        throw Error('Missing host override inventory');
    for (const [index, recipe] of recipes.entries()) {
        const row = hostForks[index];
        if (!row || row.name !== recipe.name || row.version !== recipe.version || row.path !== recipe.target ||
            row.status !== 'unapplied-host-override' || !Array.isArray(row.files) || !row.files.length)
            throw Error('Invalid unapplied host override inventory: ' + recipe.name);
        const directory = contained(packageRoot, recipe.target);
        const actual = regularPackageFiles(directory).sort().map(file => ({
            path: file, sha256: digest(fs.readFileSync(contained(directory, file))),
        }));
        if (JSON.stringify(actual) !== JSON.stringify(row.files))
            throw Error('Host override payload drift: ' + recipe.name);
    }
    return { packages: hostForks.length, files: hostForks.reduce((count, row) => count + row.files.length, 0) };
}
