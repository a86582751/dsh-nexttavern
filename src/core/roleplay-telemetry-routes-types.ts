import type {ConnectionFetchRoute} from '@deepseek-ai/dsh-client-connection'
import type { HostSession } from './roleplay-task-host-types.js'
import type { createTelemetry } from './tavern-telemetry.js'
import type { createPriceCatalog, createExchangeRates } from './tavern-pricing.js'

export interface TelemetryRouteBody {
  sessionId?: string
  action?: string
  settings?: unknown
  expectedRevision?: number
}
export interface TelemetryRoutesDependencies {
  ctx: {
    effect(work: () => unknown, label: string): unknown
    connection: {fetch: {register(route: ConnectionFetchRoute): unknown}}
  }
  resolveRoleplaySession(id: string | null | undefined): Promise<HostSession | null | undefined>
  telemetry: ReturnType<typeof createTelemetry>
  priceCatalog: ReturnType<typeof createPriceCatalog>
  exchangeRates: ReturnType<typeof createExchangeRates>
}
