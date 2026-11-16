// Generated from runtime/alpha3/src/core/reader-native-document-compiler.mts; edit the TypeScript source.
/** Capture native-browser Source pages without classifying ordinary JS call
 * shapes. Existing Source/DATA capture remains the sole template boundary. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { captureReaderSourceDocumentV1 } from './reader-source-document-data.mjs';
import { captureReaderSourceTemplateV1 } from './reader-source-document-data.mjs';
/** Only DATA slots need script offsets. Replace that script's browser-cooked
 * body, then its original HTML body span: parse5 normalizes CRLF, so cooked JS
 * offsets must never be applied directly to raw HTML bytes. */
function materializeSourceStrings(source, html) {
    if (!source.strings.size)
        return html;
    const replacements = [];
    for (const script of source.scripts) {
        const slots = source.strings.get(script.inlineOrdinal);
        if (!slots?.length)
            continue;
        let javascript = script.javascript;
        for (const slot of [...slots].sort((left, right) => right.start - left.start)) {
            const data = JSON.stringify(slot.value).replaceAll('<', '\\u003c');
            javascript = javascript.slice(0, slot.start) + data + javascript.slice(slot.end);
        }
        replacements.push({ ...script.bodySpan, text: javascript });
    }
    for (const replacement of replacements.sort((left, right) => right.start - left.start))
        html = html.slice(0, replacement.start) + replacement.text + html.slice(replacement.end);
    return html;
}
function sealDocument(origin, html, writes, attributeData = []) {
    const body = { schemaVersion: 1, encoding: 'reader-native-document-plan-v1', origin, html, writes, attributeData };
    return { ...body, documentPlanSha256: recordSha256(body) };
}
export function compileReaderNativeDocumentsV1(input) {
    const documents = [], documentInputIndices = [];
    const documentFailures = [];
    if (input.encoding === 'reader-worldbook-document-input-v1') {
        for (const [index, document] of input.documents.entries()) {
            documents.push(sealDocument(document.origin, document.html, 'none'));
            documentInputIndices.push(index);
        }
        return { documents, documentInputIndices, documentFailures, worldbookProducers: input.producers };
    }
    const failedDocuments = [];
    const sourceByReplacement = new Map();
    for (const [index, document] of input.documents.entries()) {
        const { regex, message } = document;
        try {
            let original = sourceByReplacement.get(regex.replacement);
            if (!original) {
                const source = captureReaderSourceTemplateV1(regex.replacement), htmlSpan = source.htmlSpan;
                if (!htmlSpan)
                    throw Error('READER_REGEX_DOCUMENT_SOURCE_SPAN_UNAVAILABLE');
                const originalHtml = regex.replacement.slice(htmlSpan.start, htmlSpan.end), replacementSha256 = sha256(regex.replacement);
                original = { replacementSha256, htmlSpan, source,
                    htmlSha256: htmlSpan.start === 0 && htmlSpan.end === regex.replacement.length ? replacementSha256 : sha256(originalHtml),
                    htmlUtf8Bytes: Buffer.byteLength(originalHtml, 'utf8'), htmlUtf16Length: originalHtml.length };
                sourceByReplacement.set(regex.replacement, original);
            }
            const origin = { schemaVersion: 1, encoding: 'reader-regex-document-origin-v1', source: input.source,
                regex: { ordinal: regex.ordinal, id: regex.id, pointer: regex.pointer, descriptorSha256: regex.descriptorSha256,
                    ...regex.producer ? { producer: regex.producer } : {},
                    replacementSha256: original.replacementSha256, htmlSpan: original.htmlSpan }, message, replacementSpan: document.replacementSpan,
                htmlSha256: original.htmlSha256, htmlUtf8Bytes: original.htmlUtf8Bytes, htmlUtf16Length: original.htmlUtf16Length };
            const source = captureReaderSourceDocumentV1(document.parts, original.source), displaySpan = source.displaySpan;
            const html = materializeSourceStrings(source, source.html.slice(displaySpan.start, displaySpan.end));
            documents.push(sealDocument(origin, html, 'source-regex', source.attributeData));
            documentInputIndices.push(index);
        }
        catch (error) {
            const { ordinal, id, pointer, descriptorSha256 } = regex;
            const code = error instanceof Error && /^(?:READER_REGEX_DOCUMENT|HTML)_[A-Z0-9_]+$/.test(error.message)
                ? error.message : 'READER_NATIVE_DOCUMENT_CAPTURE_FAILED';
            const diagnostics = [{ code, ordinal, scriptIdentity: id, pointer: pointer + '/replaceString' }];
            failedDocuments.push({ source: input.source, regex: { ordinal, id, pointer, descriptorSha256 }, message,
                replacementSpan: document.replacementSpan, diagnostics });
            documentFailures.push({ inputIndex: index, diagnostics });
        }
    }
    return { documents, documentInputIndices, documentFailures, ...failedDocuments.length ? { failedDocuments } : {} };
}
const profile = Object.freeze({ id: 'reader-native-browser', version: 1,
    browser: 'supplied', modelRequests: 'owned-author-generation', writes: 'owned-source-regex', readSemantics: 'live',
    writeBasis: 'explicit-message-read', receipt: 'guest-observed-not-callback-ended' });
/** Plans already seal their actual HTML. Program identity refers to those
 * plans and actual producer/failure facts, never serializes raw pages again. */
export function createReaderNativeDocumentProgramV1(source, result) {
    const { documents, failedDocuments, failedWorldbookDocuments, worldbookProducers } = result;
    const body = { schemaVersion: 1, encoding: 'reader-native-document-program-v1',
        authority: 'captured-reader-source-only', source, profile,
        ...failedDocuments?.length ? { failedDocuments } : {}, ...failedWorldbookDocuments?.length ? { failedWorldbookDocuments } : {},
        ...worldbookProducers?.length ? { worldbookProducers } : {} };
    const programSha256 = recordSha256({ ...body, documents: documents.map(document => document.documentPlanSha256) });
    return { ...body, documents, programSha256 };
}
