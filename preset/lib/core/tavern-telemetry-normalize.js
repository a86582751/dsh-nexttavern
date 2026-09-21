// Generated from runtime/alpha3/src/core/tavern-telemetry-normalize.ts; edit the TypeScript source.
import { taskFailureDetails, FAILURE_LABELS } from './tavern-tasks.js';
export const TELEMETRY_USAGE_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
export const nonNegativeFinite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export const normalizeUsage = (value) => value && typeof value === 'object' ? Object.fromEntries([...TELEMETRY_USAGE_FIELDS, 'totalTokens'].map(key => [key, nonNegativeFinite(value[key])])) : null;
export const safeTelemetryId = (value) => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').slice(0, 300) : null;
export const failureText = (reason) => { const failure = taskFailureDetails(reason); return [failure.category !== 'unknown' ? failure.label : null, failure.code, failure.status ? `HTTP ${failure.status}` : null].filter(Boolean).join(' · ') || '原因未提供'; };
export const publicTelemetryError = (value) => value ? String(value).split(' · ').filter(part => Object.values(FAILURE_LABELS).includes(part) || /^HTTP [1-5]\d{2}$/.test(part) || /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(part)).join(' · ') || '原因未提供' : null;
export const telemetryOutcome = (reason) => reason?.kind === 'error' ? 'failed' : reason?.kind === 'aborted' ? 'cancelled' : reason?.kind === 'max-tokens' ? 'truncated' : 'completed';
