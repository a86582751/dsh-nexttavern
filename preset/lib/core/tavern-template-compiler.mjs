// Generated from runtime/alpha3/src/core/tavern-template-compiler.mts; edit the TypeScript source.
/** EJS bounded plain-output compiler. Only the owned worker invokes this
 * compiler and QuickJS parses the resulting author function. No Node eval. */
import { templateFail } from './tavern-template-data.mjs';
export const TEMPLATE_DECLARED_UNSUPPORTED_HELPERS_V1 = Object.freeze([
    'setvar', 'setVariables', 'replaceVariables', 'updateVariables', 'getVariables', 'getMvuData', 'getMvuVariable',
    'registerMvuSchema', 'setMvuData', 'updateMvuData', 'setMvuVariable', 'initializeMvuData',
    'include', 'injectPrompt', 'runSlashCommand', 'executeSlashCommands',
]);
export function compileTemplateFunctionV1(template, pointer) {
    let append = '__ownedTemplateAppendV1', string = '__ownedTemplateStringV1';
    // Ordinary local variables/closures remain JavaScript bindings. Avoid a
    // textual collision with the two compiler-owned outer closure bindings.
    while (template.includes(append))
        append += '_';
    while (template.includes(string))
        string += '_';
    const statements = [], parameters = ['getvar', 'getwi', 'activateWI', 'injectPrompts', 'uninjectPrompts',
        ...TEMPLATE_DECLARED_UNSUPPORTED_HELPERS_V1, append, string];
    let cursor = 0;
    for (;;) {
        const open = template.indexOf('<%', cursor);
        const literal = open < 0 ? template.slice(cursor) : template.slice(cursor, open);
        if (literal.includes('%>'))
            templateFail('TEMPLATE_EJS_MALFORMED', pointer);
        // Macro expansion belongs to the surrounding phase owner. Known tokens
        // introduced after their macro stage remain inert literal EJS text.
        if (literal)
            statements.push(`${append}(${JSON.stringify(literal)});`);
        if (open < 0)
            break;
        const close = template.indexOf('%>', open + 2);
        if (close < 0)
            templateFail('TEMPLATE_EJS_MALFORMED', pointer);
        const first = template[open + 2];
        if (first === '%' || first === '#' || first === '_' || template[close - 1] === '-' || template[close - 1] === '_') {
            templateFail('TEMPLATE_EJS_TAG_UNSUPPORTED', pointer);
        }
        const expression = first === '=' || first === '-';
        const source = template.slice(open + (expression ? 3 : 2), close);
        if (source.includes('<%'))
            templateFail('TEMPLATE_EJS_MALFORMED', pointer);
        if (expression && !source.trim())
            templateFail('TEMPLATE_EJS_MALFORMED', pointer);
        statements.push(expression ? `${append}(${string}((${source})));` : source);
        cursor = close + 2;
    }
    // Helpers occupy an outer lexical environment, allowing normal guest-local
    // declarations, shadowing and closures. There is no with/global Proxy.
    const factorySource = `(function(${parameters.join(',')}){return async function(){'use strict';\n${statements.join('\n')}\n};})`;
    return { factorySource, parameters };
}
