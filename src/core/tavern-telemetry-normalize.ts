import { taskFailureDetails, FAILURE_LABELS } from './tavern-tasks.js'
import type { PricingCall } from './tavern-pricing.js'
import type { TimeRangeQuery } from './tavern-telemetry-time-range.js'

// Projections also accept historical/stream rows with incomplete usage or timing.
export interface TelemetryProjectionCall extends PricingCall {
  source?: TelemetryCallSource
  id: string
  sessionId: string | null
  ownerSessionId: string | null
  kind: string
  status: string
  startedAt: number
  durationMs?: unknown
  firstTokenMs?: unknown
  error?: unknown
  providerUsage?: Record<string, number>
}
export interface TelemetryProjectionQuery extends TimeRangeQuery {
  targetSessionId?: string | null
  provider?: string
  model?: string
  kind?: string
  offset?: unknown
  limit?: unknown
  currency?: string
}

export const TELEMETRY_USAGE_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const
export type TelemetryUsage = { [key in typeof TELEMETRY_USAGE_FIELDS[number] | 'totalTokens']: number | null }
export interface TelemetryCallSource {
  kind: string
  sessionId?: string | null
  startSeq?: number | null
  evidenceSeq?: number
  turn?: number
  step?: number
  taskIds?: string[]
  jobIds?: string[]
  jobId?: string | null
  purpose?: string | null
  invocationId?: string
  routeEvidence?: string
  workspaceId?: string
}
export interface TelemetryCallRecord {
  schemaVersion: 1
  id: string
  sessionId: string | null
  ownerSessionId: string | null
  provider: string | null
  model: string | null
  kind: string
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'truncated' | 'unknown'
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  firstTokenMs: number | null
  usage: TelemetryUsage | null
  source: TelemetryCallSource
  providerUsage?: Record<string, number>
  error?: string
}
export const nonNegativeFinite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
export const normalizeUsage = (value: unknown): TelemetryUsage | null => value && typeof value === 'object' ? Object.fromEntries([...TELEMETRY_USAGE_FIELDS, 'totalTokens'].map(key => [key, nonNegativeFinite((value as Record<string, unknown>)[key])])) as TelemetryUsage : null
export const safeTelemetryId = (value: unknown): string | null => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').slice(0, 300) : null
export const failureText = (reason: unknown): string => { const failure = taskFailureDetails(reason); return [failure.category !== 'unknown' ? failure.label : null, failure.code, failure.status ? `HTTP ${failure.status}` : null].filter(Boolean).join(' · ') || '原因未提供' }
export const publicTelemetryError = (value: unknown): string | null => value ? String(value).split(' · ').filter(part => (Object.values(FAILURE_LABELS) as readonly unknown[]).includes(part) || /^HTTP [1-5]\d{2}$/.test(part) || /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(part)).join(' · ') || '原因未提供' : null
export const telemetryOutcome = (reason: { kind?: unknown } | null | undefined): TelemetryCallRecord['status'] => reason?.kind === 'error' ? 'failed' : reason?.kind === 'aborted' ? 'cancelled' : reason?.kind === 'max-tokens' ? 'truncated' : 'completed'
