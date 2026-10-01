// Generated from runtime/alpha3/src/core/tavern-mvu-yaml.ts; edit the TypeScript source.
/** YAML 1.2 data parsing only. No author tags, schema execution,
 * persistence or model fallback. The caller owns dialect/source authorization. */
import { Composer, Lexer, Parser, isAlias, isMap, isNode, isScalar, isSeq } from 'yaml';
export const MVU_YAML_BOUNDS = Object.freeze({
    inputBytes: 1048576, outputBytes: 1048576, depth: 32, nodes: 32000,
    arrayLength: 4096, numberMagnitude: Number.MAX_SAFE_INTEGER, syntaxTokens: 128000, aliases: 256,
});
class YamlRefusal extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
function refuse(code, pointer) { throw new YamlRefusal(code, pointer); }
const childPointer = (parent, key) => `${parent}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
/** Validate library CST before its recursive AST composer runs. Parser.stack is
 * its documented public stack; bounded lexical steps prevent deep composition.
 * Syntax accounting includes keys/comments/props, separately from JSON nodes. */
function syntax(text) {
    const lexer = new Lexer(), parser = new Parser(), tokens = [];
    let lexemes = 0, syntaxTokens = 0, documents = 0, aliasNodes = 0, anchorNodes = 0;
    function capture(token) {
        const pending = [{ token, depth: 0 }];
        while (pending.length) {
            const { token: current, depth } = pending.pop();
            if (++syntaxTokens > MVU_YAML_BOUNDS.syntaxTokens)
                refuse('YAML_SYNTAX_LIMIT');
            if (depth > MVU_YAML_BOUNDS.depth + 2)
                refuse('YAML_DEPTH_LIMIT');
            if (current.type === 'error')
                refuse('YAML_SYNTAX_INVALID');
            if (current.type === 'alias' && ++aliasNodes > MVU_YAML_BOUNDS.aliases)
                refuse('YAML_ALIAS_LIMIT');
            if (current.type === 'anchor' && ++anchorNodes > MVU_YAML_BOUNDS.aliases)
                refuse('YAML_ALIAS_LIMIT');
            if (current.type === 'tag')
                refuse('YAML_TAG_UNSUPPORTED');
            if (current.type === 'directive' && current.source.trim() !== '%YAML 1.2') {
                refuse(current.source.startsWith('%YAML') ? 'YAML_VERSION_UNSUPPORTED' : 'YAML_DIRECTIVE_UNSUPPORTED');
            }
            const push = (items, nextDepth = depth) => {
                if (items)
                    for (const item of items)
                        pending.push({ token: item, depth: nextDepth });
            };
            switch (current.type) {
                case 'document':
                    if (++documents > 1)
                        refuse('YAML_MULTIPLE_DOCUMENTS');
                    push(current.start);
                    push(current.end);
                    if (current.value)
                        pending.push({ token: current.value, depth });
                    break;
                case 'block-map':
                case 'block-seq':
                case 'flow-collection':
                    if ((current.type === 'block-seq' || current.type === 'flow-collection'
                        && current.start.type === 'flow-seq-start') && current.items.length > MVU_YAML_BOUNDS.arrayLength) {
                        refuse('YAML_ARRAY_LIMIT');
                    }
                    if (current.type === 'flow-collection') {
                        push([current.start]);
                        push(current.end);
                    }
                    for (const item of current.items) {
                        push(item.start);
                        push(item.sep);
                        if (item.key)
                            pending.push({ token: item.key, depth: depth + 1 });
                        if (item.value)
                            pending.push({ token: item.value, depth: depth + 1 });
                    }
                    break;
                case 'block-scalar':
                    push(current.props);
                    break;
                case 'doc-end':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar':
                    push(current.end);
                    break;
            }
        }
        tokens.push(token);
    }
    for (const lexeme of lexer.lex(text)) {
        if (++lexemes > MVU_YAML_BOUNDS.syntaxTokens)
            refuse('YAML_SYNTAX_LIMIT');
        for (const token of parser.next(lexeme))
            capture(token);
        // Grammar bookkeeping may contain document/key slots as well as values.
        if (parser.stack.length > MVU_YAML_BOUNDS.depth * 2 + 8)
            refuse('YAML_DEPTH_LIMIT');
    }
    for (const token of parser.end())
        capture(token);
    return tokens;
}
/** Resolve each actual alias to the last preceding anchor, matching the library's
 * Alias.resolve document order. Freeze those edges before expansion: reusing an
 * anchor name later must not retarget aliases inside an earlier anchored value.
 * No repeated full-document searches or expansion happen in this index pass. */
function aliasBindings(root) {
    const anchors = new Map(), bindings = new WeakMap();
    const pending = [{ node: root, pointer: '', depth: 0 }];
    let nodes = 0;
    while (pending.length) {
        const { node, pointer, depth } = pending.pop();
        if (++nodes > MVU_YAML_BOUNDS.nodes * 2)
            refuse('YAML_NODE_LIMIT', pointer);
        if (depth > MVU_YAML_BOUNDS.depth)
            refuse('YAML_DEPTH_LIMIT', pointer);
        if (node === null || node === undefined)
            continue;
        if (!isNode(node))
            refuse('YAML_NODE_UNSUPPORTED', pointer);
        if (node.tag)
            refuse('YAML_TAG_UNSUPPORTED', pointer);
        if (isAlias(node)) {
            const target = anchors.get(node.source);
            if (!target)
                refuse('YAML_ALIAS_UNKNOWN', pointer);
            bindings.set(node, target);
            continue;
        }
        if (node.anchor)
            anchors.set(node.anchor, node);
        if (isSeq(node))
            for (let index = node.items.length - 1; index >= 0; index--) {
                pending.push({ node: node.items[index], pointer: childPointer(pointer, String(index)), depth: depth + 1 });
            }
        else if (isMap(node))
            for (let index = node.items.length - 1; index >= 0; index--) {
                const pair = node.items[index];
                const key = isScalar(pair.key) && typeof pair.key.value === 'string' ? pair.key.value : String(index);
                const path = childPointer(pointer, key);
                pending.push({ node: pair.value, pointer: path, depth: depth + 1 });
                pending.push({ node: pair.key, pointer: path, depth: depth + 1 });
            }
    }
    return bindings;
}
/** Converts only the library's validated AST nodes, cloning each alias occurrence
 * with the same node/depth/output budgets. Active ancestors reject cycles; no
 * toJS/reviver/custom tag hook or unbounded shared-value expansion runs. */
function jsonData(root) {
    let nodes = 0, bytes = 0, aliasExpansions = 0;
    const aliases = aliasBindings(root), active = new Set();
    const expand = (alias, pointer) => {
        if (++aliasExpansions > MVU_YAML_BOUNDS.aliases)
            refuse('YAML_ALIAS_LIMIT', pointer);
        const target = aliases.get(alias);
        if (!target)
            refuse('YAML_ALIAS_UNKNOWN', pointer);
        return target;
    };
    const addBytes = (amount, pointer) => {
        bytes += amount;
        if (bytes > MVU_YAML_BOUNDS.outputBytes)
            refuse('YAML_OUTPUT_BYTE_LIMIT', pointer);
    };
    function visit(node, pointer, depth) {
        if (++nodes > MVU_YAML_BOUNDS.nodes)
            refuse('YAML_NODE_LIMIT', pointer);
        if (depth > MVU_YAML_BOUNDS.depth)
            refuse('YAML_DEPTH_LIMIT', pointer);
        if (node === null || node === undefined) {
            addBytes(4, pointer);
            return null;
        }
        if (!isNode(node))
            refuse('YAML_NODE_UNSUPPORTED', pointer);
        if (isAlias(node))
            return visit(expand(node, pointer), pointer, depth);
        if (node.tag)
            refuse('YAML_TAG_UNSUPPORTED', pointer);
        if (active.has(node))
            refuse('YAML_ALIAS_CYCLE', pointer);
        if (isScalar(node)) {
            let value = node.value;
            if (typeof value === 'bigint') {
                if (value > BigInt(MVU_YAML_BOUNDS.numberMagnitude) || value < -BigInt(MVU_YAML_BOUNDS.numberMagnitude)) {
                    refuse('YAML_NUMBER_RANGE', pointer);
                }
                value = Number(value);
            }
            if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > MVU_YAML_BOUNDS.numberMagnitude)) {
                refuse('YAML_NUMBER_RANGE', pointer);
            }
            if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
                refuse('YAML_SCALAR_UNSUPPORTED', pointer);
            const encoded = JSON.stringify(value);
            if (typeof encoded !== 'string')
                refuse('YAML_SCALAR_UNSUPPORTED', pointer);
            addBytes(Buffer.byteLength(encoded, 'utf8'), pointer);
            return value;
        }
        if (isSeq(node)) {
            if (node.items.length > MVU_YAML_BOUNDS.arrayLength)
                refuse('YAML_ARRAY_LIMIT', pointer);
            addBytes(2 + Math.max(0, node.items.length - 1), pointer);
            active.add(node);
            try {
                return node.items.map((item, index) => visit(item, childPointer(pointer, String(index)), depth + 1));
            }
            finally {
                active.delete(node);
            }
        }
        if (isMap(node)) {
            const result = {}, seen = new Set();
            addBytes(2 + Math.max(0, node.items.length - 1), pointer);
            active.add(node);
            try {
                for (const pair of node.items) {
                    const keyNode = isAlias(pair.key) ? expand(pair.key, pointer) : pair.key;
                    if (!isScalar(keyNode) || typeof keyNode.value !== 'string')
                        refuse('YAML_STRING_KEY_REQUIRED', pointer);
                    if (keyNode.tag)
                        refuse('YAML_TAG_UNSUPPORTED', pointer);
                    const key = keyNode.value, path = childPointer(pointer, key);
                    if (forbidden.has(key))
                        refuse('YAML_PROTOTYPE_KEY', path);
                    if (key === '<<')
                        refuse('YAML_MERGE_UNSUPPORTED', path);
                    if (seen.has(key))
                        refuse('YAML_DUPLICATE_KEY', path);
                    seen.add(key);
                    addBytes(Buffer.byteLength(JSON.stringify(key), 'utf8') + 1, path);
                    result[key] = visit(pair.value, path, depth + 1);
                }
            }
            finally {
                active.delete(node);
            }
            return result;
        }
        refuse('YAML_NODE_UNSUPPORTED', pointer);
    }
    if (!isMap(root))
        refuse('YAML_OBJECT_REQUIRED', '');
    return visit(root, '', 0);
}
/** Synchronous, size-bounded library parsing; not a wall-clock interruption
 * boundary. A future hostile-code runner must supply its own hard deadline. */
export function parseMvuYamlData(text) {
    try {
        if (typeof text !== 'string')
            refuse('YAML_INPUT_TYPE');
        if (Buffer.byteLength(text, 'utf8') > MVU_YAML_BOUNDS.inputBytes)
            refuse('YAML_INPUT_BYTE_LIMIT');
        const composer = new Composer({ version: '1.2', schema: 'core', merge: false, customTags: [], resolveKnownTags: false,
            intAsBigInt: true, strict: true, uniqueKeys: false, prettyErrors: false, logLevel: 'silent' });
        // Duplicate keys are checked with a Set, avoiding Composer's quadratic
        // pair comparison on large maps. The single document was checked in CST.
        const documents = [...composer.compose(syntax(text), true, text.length)];
        if (documents.length !== 1)
            refuse('YAML_MULTIPLE_DOCUMENTS');
        const document = documents[0];
        if (document.errors.length || document.warnings.length)
            refuse('YAML_SYNTAX_INVALID');
        if (document.directives.yaml.version !== '1.2')
            refuse('YAML_VERSION_UNSUPPORTED');
        return { kind: 'parsed', data: jsonData(document.contents), parserPolicy: 'yaml-1.2-json-data-v1' };
    }
    catch (error) {
        return { kind: 'rejected', code: error instanceof YamlRefusal ? error.code : 'YAML_PARSE_UNKNOWN',
            ...(error instanceof YamlRefusal && error.pointer !== undefined ? { pointer: error.pointer } : {}) };
    }
}
