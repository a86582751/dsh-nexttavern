// Generated from runtime/alpha3/src/operations/public-vendor-admission.mts; edit the TypeScript source.
/** Shared credential boundary for public product and Android dependency assembly. */
export function assertPublicVendorText(text, file) {
    // Crypto parsers may name a PEM header, but never carry a private key payload.
    const candidate = /\.(?:[cm]?js|mts|ts)$/.test(file)
        ? text.replace(/\.indexOf\(\s*(["'])-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\1\s*\)/g, '.indexOf("public-pem-format-marker")') : text;
    if (/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|\b(?:cfut_|cfat_|ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{20,})/i.test(candidate)) {
        throw Error('Private configuration in public file: ' + file);
    }
    if (/(?:^|\/)[^/]+\.(?:env|pem|key)$/.test(file))
        throw Error('Private credential file in public package: ' + file);
}
/** Assembly excludes rejected vendor members before calculating its inventory. */
export function admitPublicVendorFile(file, bytes) {
    try {
        assertPublicVendorText(bytes.toString('utf8'), file);
        return true;
    }
    catch {
        return false;
    }
}
