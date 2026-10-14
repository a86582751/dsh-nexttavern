// Generated from runtime/alpha3/src/core/roleplay-author-prompt-assets.ts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Host's existing asset owner admits this independent package before import.
 * This helper consumes that fixed observation, never another product scan or
 * owner. Host alone closes the returned runtime with its Browser lifecycle. */
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function loadAdmittedAuthorPromptRuntimeV1(admitted, checkOwnerCurrent) {
    const verifyOwnedPackage = (url) => {
        checkOwnerCurrent();
        if (url.protocol !== 'file:' || fs.realpathSync(fileURLToPath(url)) !== admitted.owned) {
            throw Error('AUTHOR_PROMPT_PACKAGE_OWNER_CHANGED');
        }
        return admitted.inventory;
    };
    checkOwnerCurrent();
    const factory = await import(__rewriteRelativeImportExtension(pathToFileURL(admitted.entry).href));
    checkOwnerCurrent();
    const runtime = await factory.createOwnedAuthorPromptRuntimeV1({ verifyOwnedPackage });
    try {
        checkOwnerCurrent();
        runtime.checkCurrent();
        return runtime;
    }
    catch (error) {
        await runtime.dispose();
        throw error;
    }
}
