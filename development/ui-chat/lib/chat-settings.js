// Generated from runtime/alpha3/compat/ui-chat/src/chat-settings.ts; edit the TypeScript source.
/** Chat display preferences stored in the Host user-settings document. */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the Chat target. */
export const CHAT_SETTINGS_NAMESPACE = 'ui-chat';
/** Field carrying the work-details presentation mode. */
export const TRANSCRIPT_VIEW_FIELD = 'transcriptView';
/** Work-details presentation modes a user can choose. */
export const TRANSCRIPT_VIEW_MODES = ['compact', 'detailed', 'expanded'];
/**
 * Saved value from the two-mode generation of this setting. Read as `detailed`;
 * never offered as a choice and never written back.
 */
export const LEGACY_TRANSCRIPT_VIEW_MODE = 'normal';
/** Every value the durable field accepts: current modes plus the legacy saved value. */
const TRANSCRIPT_VIEW_SETTING_VALUES = [...TRANSCRIPT_VIEW_MODES, LEGACY_TRANSCRIPT_VIEW_MODE];
/** Default preserves the compact process disclosure introduced by Chat. */
export const DEFAULT_TRANSCRIPT_VIEW_MODE = 'compact';
/** Performance and usage detail levels accepted by user settings. */
export const PERFORMANCE_USAGE_MODES = ['compact', 'detailed'];
/** Preserve detailed accounting for users without an explicit preference. */
export const DEFAULT_PERFORMANCE_USAGE = 'detailed';
/** Preserve the built-in browser for users without an explicit preference. */
export const DEFAULT_LINK_OPENING = 'sidebar';
/** Durable Chat schema; also the wire envelope the browser scope validates against. */
export const ChatSettingsFields = {
    linkOpening: z.union(['sidebar', 'new-tab']).default(DEFAULT_LINK_OPENING),
    performanceUsage: z.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
    [TRANSCRIPT_VIEW_FIELD]: z.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).default(DEFAULT_TRANSCRIPT_VIEW_MODE),
};
/** Schema for shared configuration values. */
export const ChatSettingsSchema = z.object(ChatSettingsFields);
