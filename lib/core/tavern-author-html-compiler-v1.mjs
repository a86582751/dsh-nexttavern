// Generated from runtime/alpha3/src/core/tavern-author-html-compiler-v1.mts; edit the TypeScript source.
/** Parse complete Source HTML into candidate DATA; never admit or execute it. */
import { Parser, defaultTreeAdapter } from 'parse5';
import parseCss from 'css-tree/parser';
import walkCss from 'css-tree/walker';
import ts from 'typescript';
import { recordSha256, sha256 } from './roleplay-data.js';
const base = defaultTreeAdapter;
export const HTML_PARSE_BOUNDS_V1 = Object.freeze({ htmlBytes: 8 * 1_048_576, scriptBytes: 3 * 1_048_576,
    totalScriptBytes: 8 * 1_048_576, scripts: 64, astNodes: 131_072, astDepth: 512 });
const span = (start, end) => ({ start, end });
const attributes = (values) => values.map(value => ({ ...value }));
const location = (node) => {
    const value = node.sourceCodeLocation;
    return value ? span(value.startOffset, value.endOffset) : null;
};
const expressionSpan = (node, file) => span(node.getStart(file), node.end);
function member(node) {
    if (ts.isIdentifier(node))
        return { kind: 'identifier', name: node.text };
    if (ts.isPropertyAccessExpression(node))
        return { kind: 'property', name: node.name.text };
    if (ts.isElementAccessExpression(node))
        return { kind: 'computed',
            literalName: node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null };
    return { kind: 'other' };
}
function javascriptCoverage(source, inlineOrdinal, javascriptSha256) {
    const file = ts.createSourceFile('source-html-inline-' + inlineOrdinal + '.js', source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.JS);
    const parseDiagnostics = file.parseDiagnostics;
    const syntaxDiagnostics = parseDiagnostics.map(value => ({ phase: 'javascript',
        code: String(value.code), message: ts.flattenDiagnosticMessageText(value.messageText, '\n'), inlineOrdinal,
        span: value.start === undefined ? null : span(value.start, value.start + (value.length ?? 0)) }));
    const nodes = [], calls = [], assignments = [];
    const stack = [{ node: file, depth: 0 }];
    let maxDepth = 0;
    // Real original code reaches depth 441. An iterative walk retains every
    // dormant branch without putting that depth on our own JavaScript stack.
    while (stack.length) {
        const { node, depth } = stack.pop();
        nodes.push([Math.max(0, node.pos), node.end, node.kind, depth]);
        maxDepth = Math.max(maxDepth, depth);
        if (nodes.length > HTML_PARSE_BOUNDS_V1.astNodes)
            throw Error('HTML_AST_NODE_LIMIT');
        if (depth > HTML_PARSE_BOUNDS_V1.astDepth)
            throw Error('HTML_AST_DEPTH_LIMIT');
        if (ts.isCallExpression(node) || ts.isNewExpression(node))
            calls.push({ span: expressionSpan(node, file),
                calleeSpan: expressionSpan(node.expression, file), callee: member(node.expression),
                argumentSpans: (node.arguments ?? []).map(argument => expressionSpan(argument, file)) });
        if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
            && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
            assignments.push({ span: expressionSpan(node, file),
                targetSpan: expressionSpan(node.left, file), target: member(node.left), valueSpan: expressionSpan(node.right, file),
                operator: node.operatorToken.kind });
        const children = [];
        ts.forEachChild(node, child => { children.push(child); });
        for (let index = children.length - 1; index >= 0; index--)
            stack.push({ node: children[index], depth: depth + 1 });
    }
    return { encoding: 'html-complete-javascript-ast-coverage-v1', javascriptSha256, nodeCount: nodes.length, maxDepth,
        nodes, syntaxDiagnostics, calls, assignments };
}
/** This adapter owns the mutation log. It implements mutation methods rather
 * than wrapping appendChild: default insertText/setDocumentType bypass wrappers. */
function recordingAdapter() {
    const ids = new Map(), nodes = [], steps = [];
    const id = (node) => ids.get(node);
    const register = (node, creation) => {
        const nodeId = nodes.length;
        nodes.push(node);
        ids.set(node, nodeId);
        steps.push({ kind: 'create-node', node: { ...creation, nodeId } });
        return node;
    };
    const adapter = { ...base,
        createDocument() { const node = base.createDocument(); return register(node, { kind: 'document', mode: node.mode }); },
        createDocumentFragment() { return register(base.createDocumentFragment(), { kind: 'fragment' }); },
        createElement(tagName, namespaceURI, attrs) {
            return register(base.createElement(tagName, namespaceURI, attrs), { kind: 'element', tagName, namespaceURI, attributes: attributes(attrs) });
        },
        createCommentNode(data) { return register(base.createCommentNode(data), { kind: 'comment', data }); },
        createTextNode(value) { return register(base.createTextNode(value), { kind: 'text', textSpan: span(0, value.length) }); },
        appendChild(parent, node) { base.appendChild(parent, node); steps.push({ kind: 'append-child', parentId: id(parent), nodeId: id(node) }); },
        insertBefore(parent, node, reference) {
            base.insertBefore(parent, node, reference);
            steps.push({ kind: 'insert-before', parentId: id(parent), nodeId: id(node), referenceId: id(reference) });
        },
        detachNode(node) { base.detachNode(node); steps.push({ kind: 'detach-node', nodeId: id(node) }); },
        setTemplateContent(node, content) {
            base.setTemplateContent(node, content);
            steps.push({ kind: 'set-template-content', nodeId: id(node), contentId: id(content) });
        },
        setDocumentMode(node, mode) { base.setDocumentMode(node, mode); steps.push({ kind: 'set-document-mode', nodeId: id(node), mode }); },
        setDocumentType(document, name, publicId, systemId) {
            const existing = document.childNodes.find(base.isDocumentTypeNode);
            if (existing) {
                existing.name = name;
                existing.publicId = publicId;
                existing.systemId = systemId;
                steps.push({ kind: 'set-doctype', nodeId: id(existing), name, publicId, systemId });
            }
            else {
                const node = { nodeName: '#documentType', name, publicId, systemId, parentNode: null };
                register(node, { kind: 'doctype', name, publicId, systemId });
                adapter.appendChild(document, node);
            }
        },
        insertText(parent, value) {
            const previous = parent.childNodes.at(-1);
            if (previous && base.isTextNode(previous))
                appendText(previous, value);
            else
                adapter.appendChild(parent, adapter.createTextNode(value));
        },
        insertTextBefore(parent, value, reference) {
            const previous = parent.childNodes[parent.childNodes.indexOf(reference) - 1];
            if (previous && base.isTextNode(previous))
                appendText(previous, value);
            else
                adapter.insertBefore(parent, adapter.createTextNode(value), reference);
        },
        adoptAttributes(node, values) {
            const count = node.attrs.length;
            base.adoptAttributes(node, values);
            steps.push({ kind: 'adopt-attributes', nodeId: id(node), attributes: attributes(node.attrs.slice(count)) });
        }, };
    function appendText(node, value) {
        const start = node.value.length;
        node.value += value;
        const nodeId = id(node), last = steps.at(-1);
        // The real large inline asset produces hundreds of thousands of adjacent
        // tokenizer appends. No script or other effect occurs between these spans.
        if (last?.kind === 'append-text' && last.nodeId === nodeId)
            steps[steps.length - 1] = { ...last, textSpan: span(last.textSpan.start, node.value.length) };
        else
            steps.push({ kind: 'append-text', nodeId, textSpan: span(start, node.value.length) });
    }
    return { adapter, id, nodes, steps };
}
const classicMimes = new Set(['text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript',
    'application/x-javascript', 'application/x-ecmascript', 'text/javascript1.0', 'text/javascript1.1',
    'text/javascript1.2', 'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-javascript', 'text/x-ecmascript']);
function scriptMode(node) {
    const type = node.attrs.find(value => value.name === 'type')?.value.trim().toLowerCase();
    if (type === 'module')
        return 'module';
    if (type)
        return classicMimes.has(type) ? 'classic' : 'data';
    const language = node.attrs.find(value => value.name === 'language')?.value.trim().toLowerCase();
    return !language || classicMimes.has('text/' + language) ? 'classic' : 'data';
}
function bodySpan(node) {
    const value = node.sourceCodeLocation;
    return span(value.startTag?.endOffset ?? value.startOffset, value.endTag?.startOffset ?? value.endOffset);
}
const textContent = (node) => node.childNodes.filter(base.isTextNode).map(child => child.value).join('');
const urlAttributes = new Set(['src', 'href', 'xlink:href', 'action', 'formaction', 'poster', 'data']);
export function parseSourceHtmlCandidateV1(input) {
    const html = input.html, htmlUtf8Bytes = Buffer.byteLength(html, 'utf8');
    if (htmlUtf8Bytes > HTML_PARSE_BOUNDS_V1.htmlBytes)
        throw Error('HTML_SOURCE_BYTE_LIMIT');
    const recorded = recordingAdapter(), { id, nodes, steps } = recorded;
    const diagnostics = [], boundaries = new Map();
    const parser = new Parser({ treeAdapter: recorded.adapter,
        sourceCodeLocationInfo: true, scriptingEnabled: true, onParseError: value => diagnostics.push({ phase: 'html', code: value.code,
            span: span(value.startOffset, value.endOffset) }) }, undefined, undefined, node => {
        const inlineOrdinal = boundaries.size;
        boundaries.set(node, inlineOrdinal);
        steps.push({ kind: 'script-boundary', nodeId: id(node), inlineOrdinal });
    });
    parser.tokenizer.write(html, true);
    steps.push({ kind: 'end-document' });
    const scripts = [], styles = [], resources = [];
    const payloads = new Map(), templateFragments = new Set();
    for (const node of nodes)
        if (base.isElementNode(node) && node.tagName === 'template')
            templateFragments.add(base.getTemplateContent(node));
    const inTemplate = (node) => {
        let current = node;
        while (current) {
            if (templateFragments.has(current))
                return true;
            current = base.getParentNode(current) ?? null;
        }
        return false;
    };
    let totalScriptBytes = 0;
    // Creation order retains original source order, including nodes later moved
    // by HTML tree repair. Script checkpoints were captured during parsing.
    for (const node of nodes) {
        if (!base.isElementNode(node))
            continue;
        if (node.tagName === 'script') {
            const inlineOrdinal = scripts.length, originalSpan = bodySpan(node), javascript = textContent(node), mode = scriptMode(node);
            const sourceBytes = Buffer.byteLength(javascript, 'utf8');
            totalScriptBytes += sourceBytes;
            if (sourceBytes > HTML_PARSE_BOUNDS_V1.scriptBytes)
                throw Error('HTML_SCRIPT_BYTE_LIMIT');
            if (totalScriptBytes > HTML_PARSE_BOUNDS_V1.totalScriptBytes)
                throw Error('HTML_TOTAL_SCRIPT_BYTE_LIMIT');
            if (inlineOrdinal >= HTML_PARSE_BOUNDS_V1.scripts)
                throw Error('HTML_SCRIPT_COUNT_LIMIT');
            const javascriptSha256 = sha256(javascript), ast = mode === 'data' ? null : javascriptCoverage(javascript, inlineOrdinal, javascriptSha256);
            scripts.push({ inlineOrdinal, nodeId: id(node), mode, inTemplate: inTemplate(node), attributes: attributes(node.attrs),
                tagSpan: location(node), bodySpan: originalSpan, originalBodySha256: sha256(html.slice(originalSpan.start, originalSpan.end)),
                javascript, javascriptSha256, ast });
            for (const child of node.childNodes)
                if (base.isTextNode(child))
                    payloads.set(child, { kind: 'script', inlineOrdinal });
            if (ast)
                diagnostics.push(...ast.syntaxDiagnostics);
        }
        if (node.tagName === 'style') {
            const originalSpan = bodySpan(node), style = cssStyle(node, 'stylesheet', originalSpan, textContent(node));
            for (const child of node.childNodes)
                if (base.isTextNode(child))
                    payloads.set(child, { kind: 'style', styleOrdinal: style.styleOrdinal });
        }
        for (const attribute of node.attrs) {
            const attributeSpan = node.sourceCodeLocation?.attrs?.[attribute.name];
            if (attribute.name === 'style' && attributeSpan)
                cssStyle(node, 'style-attribute', span(attributeSpan.startOffset, attributeSpan.endOffset), attribute.value);
            if (urlAttributes.has(attribute.name))
                resources.push({ kind: 'attribute-url', nodeId: id(node), attributeName: attribute.name,
                    value: attribute.value, span: attributeSpan ? span(attributeSpan.startOffset, attributeSpan.endOffset) : null });
        }
    }
    // Foreign SCRIPT nodes need not trigger HTML parser's scriptHandler. Retain
    // every script body as DATA, but preserve actual callback boundaries only.
    for (const step of steps)
        if (step.kind === 'script-boundary') {
            const script = scripts.find(value => value.nodeId === step.nodeId);
            const index = steps.indexOf(step);
            steps[index] = { ...step, inlineOrdinal: script.inlineOrdinal };
        }
    const facts = nodes.map(node => {
        const common = { nodeId: id(node), span: location(node) };
        if (base.isElementNode(node))
            return { ...common, kind: 'element', tagName: node.tagName, namespaceURI: node.namespaceURI,
                attributes: attributes(node.attrs), children: node.childNodes.map(id),
                templateContent: node.tagName === 'template' ? id(base.getTemplateContent(node)) : null };
        if (base.isTextNode(node))
            return { ...common, kind: 'text', text: payloads.get(node) ?? { kind: 'literal', value: node.value } };
        if (base.isCommentNode(node))
            return { ...common, kind: 'comment', data: node.data };
        if (base.isDocumentTypeNode(node))
            return { ...common, kind: 'doctype', name: node.name, publicId: node.publicId, systemId: node.systemId };
        if (node.nodeName === '#document')
            return { ...common, kind: 'document', mode: node.mode, children: node.childNodes.map(id) };
        return { ...common, kind: 'fragment', children: node.childNodes.map(id) };
    });
    const body = { schemaVersion: 1, encoding: 'source-html-parsed-candidate-v1',
        authority: 'parsed-source-data-only',
        origin: { source: input.source, carrier: input.carrier, resourcePath: input.resourcePath, htmlSha256: sha256(html), htmlUtf8Bytes, htmlUtf16Length: html.length },
        parser: { html: 'parse5', htmlVersion: '8.0.1', css: 'css-tree', cssVersion: '3.2.1',
            javascript: 'typescript', javascriptVersion: '5.9.3' },
        document: { documentNodeId: id(parser.document), mode: parser.document.mode, nodes: facts }, steps, scripts, styles, resources, diagnostics };
    return { ...body, candidateSha256: recordSha256(body) };
    function cssStyle(node, kind, htmlSpan, css) {
        const styleOrdinal = styles.length, nodeId = id(node), cssDiagnostics = [];
        let cssNodeCount = 0;
        try {
            const ast = parseCss(css, { context: kind === 'stylesheet' ? 'stylesheet' : 'declarationList', positions: true, parseCustomProperty: true,
                onParseError: error => cssDiagnostics.push({ phase: 'css', code: 'CSS_PARSE', message: error.message, nodeId, styleOrdinal, span: null }) });
            const importUrls = new Set();
            walkCss(ast, function (value) {
                cssNodeCount++;
                const cssSpan = value.loc ? span(value.loc.start.offset, value.loc.end.offset) : null;
                if (value.type === 'Raw')
                    cssDiagnostics.push({ phase: 'css', code: 'CSS_RAW_SYNTAX', nodeId, styleOrdinal, span: cssSpan });
                const importRule = this.atrule?.name?.toLowerCase() === 'import' ? this.atrule : null;
                if (typeof value.value === 'string' && (value.type === 'Url' || value.type === 'String' && importRule && !importUrls.has(importRule))) {
                    if (importRule)
                        importUrls.add(importRule);
                    resources.push({ kind: importRule ? 'css-import' : 'css-url', nodeId, styleOrdinal, value: value.value, span: cssSpan });
                }
            });
        }
        catch (error) {
            cssDiagnostics.push({ phase: 'css', code: 'CSS_PARSE', message: error instanceof Error ? error.message : String(error),
                nodeId, styleOrdinal, span: null });
        }
        const style = { styleOrdinal, nodeId, kind, htmlSpan, originalSourceSha256: sha256(html.slice(htmlSpan.start, htmlSpan.end)),
            css, cssSha256: sha256(css), cssNodeCount, diagnostics: cssDiagnostics };
        styles.push(style);
        diagnostics.push(...cssDiagnostics);
        return style;
    }
}
