// Generated from runtime/alpha3/compat/ui-chat/src/index.ts; edit the TypeScript source.
import z from '@deepseek-ai/schemastery';
import { TRANSCRIPT_VIEW_FIELD } from './chat-settings.js';
import { ChatSettingsFields } from './chat-settings.js';
export { CHAT_SETTINGS_NAMESPACE, DEFAULT_TRANSCRIPT_VIEW_MODE, LEGACY_TRANSCRIPT_VIEW_MODE, LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE, TRANSCRIPT_VIEW_FIELD, TRANSCRIPT_VIEW_MODES, } from './chat-settings.js';
/** Live preferences projected to the browser. */
export const Config = z.object({
    [TRANSCRIPT_VIEW_FIELD]: ChatSettingsFields[TRANSCRIPT_VIEW_FIELD].volatile(),
    performanceUsage: ChatSettingsFields['performanceUsage'].volatile(),
    linkOpening: ChatSettingsFields.linkOpening.volatile(),
});
/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx) {
    ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
}
