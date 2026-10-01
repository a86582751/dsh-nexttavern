import { TYPERT as upstream } from '@deepseek-ai/dsh-api-session-controller/typert'
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry'

/**
 * Reuse the pinned public wire schemas while identifying their owned provider.
 * forkPrepared is host-only and deliberately adds no Remote descriptor.
 */
const packageName = 'dsh-nexttavern-session-controller'
// The pinned generator declares this export as unknown; the real registry
// validates its contribution on registration. Do not duplicate its validator.
const contribution = upstream as TypertContribution
export const TYPERT: TypertContribution = {
  ...contribution,
  package: packageName,
  invocations: contribution.invocations.map(descriptor => ({
    ...descriptor,
    id: `${packageName}#${descriptor.namespace}/${descriptor.method}`,
  })),
}
