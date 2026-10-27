// Generated from runtime/alpha3/src/operations/native-fork-payload-verifier.mts; edit the TypeScript source.
/** Exact, read-only verification of host replacement payloads staged for manual activation. */
import fs from 'node:fs';
import { contained, digest } from './public-transaction.mjs';
import { regularPackageFiles } from './owned-dependency.mjs';
import { makeHostForkProfile, readHostForkProfile, hostForkVersion } from './native-fork-host-profile.mjs';
function hostForkInventoryRows(hostForks, recipes, profileDescriptor, inventoryProfile) {
    if (profileDescriptor) {
        const expected = makeHostForkProfile(profileDescriptor, recipes);
        const supplied = readHostForkProfile(inventoryProfile);
        if (JSON.stringify(supplied) !== JSON.stringify(expected))
            throw Error('Host fork inventory profile differs from recipes');
    }
    if (!Array.isArray(recipes) || recipes.some(recipe => recipe.version !== hostForkVersion(recipe.name) ||
        recipe.target !== `host-overrides/${recipe.name}`))
        throw Error('Invalid registered host fork recipe');
    if (!Array.isArray(hostForks) || hostForks.length !== recipes.length)
        throw Error('Missing host override inventory');
    for (const [index, recipe] of recipes.entries()) {
        const row = hostForks[index];
        if (!row || row.name !== recipe.name || row.version !== recipe.version || row.path !== recipe.target ||
            row.status !== 'unapplied-host-override' || !Array.isArray(row.files) || !row.files.length)
            throw Error('Invalid unapplied host override inventory: ' + recipe.name);
    }
    return hostForks;
}
function assertHostForkMembers(rows, actualRowsByPackage) {
    for (const row of rows) {
        const actual = actualRowsByPackage.get(row.path);
        if (JSON.stringify(actual) !== JSON.stringify(row.files))
            throw Error('Host override payload drift: ' + row.name);
    }
    return { packages: rows.length, files: rows.reduce((count, row) => count + row.files.length, 0) };
}
/** Associate this verification's actual member facts with the registered host profile. */
export function assertHostForkInventory(hostForks, recipes, actualRowsByPackage, profileDescriptor, inventoryProfile) {
    return assertHostForkMembers(hostForkInventoryRows(hostForks, recipes, profileDescriptor, inventoryProfile), actualRowsByPackage);
}
/** Independently read actual host payload bytes when no complete-package owner supplies them. */
export function verifyHostForkPayload(packageRoot, hostForks, recipes, profileDescriptor, inventoryProfile) {
    // Reject a changed recipe/profile before touching any payload, as the standalone contract requires.
    const rows = hostForkInventoryRows(hostForks, recipes, profileDescriptor, inventoryProfile);
    const actualRowsByPackage = new Map(rows.map(row => {
        const directory = contained(packageRoot, row.path);
        const files = regularPackageFiles(directory).sort().map(file => ({
            path: file, sha256: digest(fs.readFileSync(contained(directory, file))),
        }));
        return [row.path, files];
    }));
    return assertHostForkMembers(rows, actualRowsByPackage);
}
