// Generated from runtime/alpha3/compat/agent-loop/src/request-envelope.ts; edit the TypeScript source.
/** Native envelope planning before any request commit. This is the existing
 * header/tool/context policy, producing fixed append data for Session preview. */
import { createDeveloperMessage } from '@deepseek-ai/dsh-llm';
import { canonicalHeader, headerEquals, SessionSeq } from '@deepseek-ai/dsh-session';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
export function planNativeRequestEnvelope(input) {
    const { config, preparedCall, tools, position, baseline } = input;
    const header = canonicalHeader({ config, ...preparedCall === undefined ? {} : { adapterDefaults: preparedCall.adapterDefaults },
        ...tools.length > 0 ? { tools } : {} });
    const appends = [];
    let newHeaderSeq;
    if (!input.requestHeaderLogged) {
        newHeaderSeq = input.nextSeq;
        appends.push({ type: 'request/header', data: { header, reason: baseline === undefined ? 'initial' : 'resume',
                ...input.startsSeries ? { startsSeries: true } : {} } });
    }
    else if (baseline === undefined || !headerEquals(baseline.header, header)) {
        newHeaderSeq = input.nextSeq;
        appends.push({ type: 'request/header', data: { header, reason: 'change', ...input.startsSeries ? { startsSeries: true } : {} } });
    }
    else if (input.startsSeries) {
        appends.push({ type: 'request/header', data: { header, reason: 'series' } });
    }
    if (baseline !== undefined && newHeaderSeq !== undefined) {
        const previousNames = new Set(baseline.header.tools?.map(tool => tool.name));
        const currentNames = new Set(tools.map(tool => tool.name));
        const additions = tools.filter(tool => !previousNames.has(tool.name)).map(tool => ({ type: 'tool-addition', toolName: tool.name }));
        const removals = (baseline.header.tools ?? []).filter(tool => !currentNames.has(tool.name))
            .map(tool => ({ type: 'tool-removal', toolName: tool.name }));
        if (additions.length > 0 || removals.length > 0) {
            appends.push({ type: 'developer/message', data: { ...position,
                    message: createDeveloperMessage({ source: { kind: 'tool-registry' }, content: [...additions, ...removals] }),
                    ...additions.length > 0 ? { headerSeq: SessionSeq(newHeaderSeq) } : {} }, intent: { surfaceOp: 'append' } });
        }
    }
    const contextWindow = preparedCall?.context?.contextWindow, systemPromptUpdate = preparedCall?.systemPromptUpdate;
    const context = { provider: config.provider, model: config.model,
        ...contextWindow === undefined ? {} : { contextWindow }, ...systemPromptUpdate === undefined ? {} : { systemPromptUpdate } };
    const previous = input.previousContext;
    if (previous?.provider !== context.provider || previous.model !== context.model
        || previous.contextWindow !== context.contextWindow || previous.systemPromptUpdate !== context.systemPromptUpdate) {
        appends.push({ type: 'request/context', data: context });
    }
    const lastHeaderOffset = appends.findLastIndex(event => event.type === 'request/header');
    const headerSeq = lastHeaderOffset >= 0 ? input.nextSeq + lastHeaderOffset : baseline?.seq;
    if (headerSeq === undefined)
        throw Error('REQUEST_MATERIAL_HEADER_MISSING');
    return deepFreeze({ appends, header, headerSeq, requestHeaderLogged: true });
}
