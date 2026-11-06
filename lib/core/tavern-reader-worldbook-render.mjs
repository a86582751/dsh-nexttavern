// Generated from runtime/alpha3/src/core/tavern-reader-worldbook-render.mts; edit the TypeScript source.
/** Pure Reader DATA production. Page admission and current attachment authority
 * belong to the caller. No prompt preparation or effect publisher is borrowed. */
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { EJS_READER_RENDER_POLICY_SHA256, EJS_READER_REGEX_PHASE_POLICY_SHA256 } from './tavern-template-ejs-runtime-types.mjs';
export async function renderReaderWorldbookPhaseV1(runtime, input, signal, owner) {
    const selected = input.entries.filter(entry => entry.phase === input.phase && entry.enabled && entry.matched)
        .sort((a, b) => b.effectiveDepth - a.effectiveDepth || a.order - b.order || b.uid - a.uid);
    if (!selected.length)
        return { kind: 'empty', phase: input.phase, target: input.target };
    const resources = new Map(input.capture.resources.map(row => [row.id, row]));
    const calls = [], executions = [];
    for (const [index, entry] of selected.entries()) {
        const condition = entry.directives.find(row => row.name === '@@if');
        // A render-body include must use the formally projected body, not the
        // getwi catalogue's original text with decorators still attached.
        const { loreKey: _loreKey, ...body } = entry.resource;
        resources.set(body.id, body);
        let execution = body;
        if (condition) {
            const text = '<% if (Boolean(' + condition.args + ')) { %><%- await include(' + JSON.stringify(body.id) + ') %><% } %>';
            execution = { ...body, id: JSON.stringify(['reader-entry-guard-v1', input.phase, index, entry.entryId]),
                text, contentSha256: schemaTextSha256(text) };
            resources.set(execution.id, execution);
        }
        executions.push(execution.contentSha256);
        calls.push('append(await include(' + JSON.stringify(execution.id) + ', {world_info: reader_world_info[' + index + ']}));');
    }
    // Length framing preserves arbitrary HTML without a second JSON encoding of
    // every rendered string. Captured ordinal order, not guest IDs, binds output.
    const text = '<% let result="";const append=value=>{result+=value.length+":"+value;};' + calls.join('\n') + 'return result; %>';
    const program = { id: 'reader-render:' + input.phase, sourcePointer: '/reader-render/' + input.phase,
        sourceSnapshotSha256: input.capture.snapshot.sourceSnapshotSha256, contentSha256: schemaTextSha256(text), text };
    const target = input.target, capture = { ...input.capture, resources: [...resources.values()], context: { ...input.capture.context,
            message_id: target.index, messageId: target.messageId, swipe_id: target.swipeId, depth: target.depth,
            is_user: target.role === 'user', is_system: target.role === 'system', is_last: target.isLast,
            // Fixed Reader WI evaluation receives content for selection, not a
            // generation buffer. Regex-produced HTML must not become template input.
            generateBuffer: '', reader_world_info: selected.map(row => row.worldInfo) } };
    const runtimeInput = { capture, resource: program, consumer: owner?.consumer ?? 'reader-render-v1' }, prepared = await runtime.prepare(runtimeInput, signal);
    let retained = false;
    try {
        const creation = prepared.creation;
        if (creation.kind === 'refused')
            return { kind: 'refused', phase: input.phase, diagnostic: creation.diagnostic };
        const { renderedText, ...output } = creation.output;
        if (output.consumerPolicy?.sha256 !== (owner ? EJS_READER_REGEX_PHASE_POLICY_SHA256 : EJS_READER_RENDER_POLICY_SHA256)) {
            throw Error('READER_TEMPLATE_POLICY_MISMATCH');
        }
        const fragments = [];
        let cursor = 0;
        for (const [index, entry] of selected.entries()) {
            const colon = renderedText.indexOf(':', cursor), lengthText = renderedText.slice(cursor, colon), length = Number(lengthText);
            if (colon < cursor || !/^\d+$/.test(lengthText) || !Number.isSafeInteger(length) || length < 0
                || colon + 1 + length > renderedText.length)
                throw Error('READER_TEMPLATE_OUTPUT_INVALID');
            const html = renderedText.slice(colon + 1, colon + 1 + length);
            cursor = colon + 1 + length;
            const iframe = entry.directives.find(row => row.name === '@@iframe');
            if (html)
                fragments.push({ entry: { entryId: entry.entryId, ordinal: entry.ordinal,
                        sourcePointer: entry.resource.sourcePointer, contentSha256: entry.resource.contentSha256,
                        sourceSnapshotSha256: entry.resource.sourceSnapshotSha256 },
                    html, renderedSha256: schemaTextSha256(html), executionResourceSha256: executions[index],
                    disposition: iframe ? { kind: 'iframe', title: iframe.args } : { kind: 'inline' } });
        }
        if (cursor !== renderedText.length)
            throw Error('READER_TEMPLATE_OUTPUT_INVALID');
        if (owner) {
            await owner.retain(prepared, runtimeInput);
            retained = true;
        }
        return { kind: 'rendered', phase: input.phase, target, fragments, engine: runtime.identity, program, output };
    }
    finally {
        if (!retained)
            await prepared.dispose();
    }
}
