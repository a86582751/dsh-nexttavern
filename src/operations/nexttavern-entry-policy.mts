/** Shared by bundle expressions and the product entry; owns no global service. */
import type {Context, Fiber, FiberState} from '@deepseek-ai/cordis'
import type {Entry, EntryTree} from '@deepseek-ai/cordis-plugin-loader'
import * as profileApi from '@deepseek-ai/dsh-app-boot'
import {isDeepStrictEqual} from 'node:util'
import {captureNextTavernProfilePlan} from './nexttavern-profile-plan.mjs'

export const PRODUCT_ENTRY = 'nexttavern'
export type ProfilePlan = ReturnType<typeof captureNextTavernProfilePlan>
export interface ProductOwner {stop(): Promise<void>; reconcile(): Promise<void>}
export interface CompositionState {
  plan: ProfilePlan
  previousPlan?: ProfilePlan
  applyHostUpdate?: () => unknown
  owner?: ProductOwner
  restoring: boolean
  applying: boolean
  patches: unknown
  nativeFibers: Set<Fiber>
}
const states = new WeakMap<EntryTree, CompositionState>()
const FAILED_FIBER_STATE: FiberState.FAILED = 3

export function loaderEntry(ctx: Context): Entry {
  const entry = ctx[Symbol.for('cordis.entry') as keyof Context] as Entry | undefined
  if (!entry) throw Error('NextTavern requires a Loader entry')
  return entry
}

export function capture(ctx: Context, patches: unknown): ProfilePlan {
  if (!ctx.profileContext) throw Error('NextTavern requires the alpha.7 profile context')
  const plan = captureNextTavernProfilePlan(ctx.profileContext, profileApi)
  // A file watcher or another writer may already have changed disk. Reject the
  // stale apply instead of combining that disk generation with these entries.
  // Include passes inserted patch rows into Loader's mutable entry options.
  // Compare their resulting composition, never mistake
  // those mutated rows for the product-free original configuration.
  if (!Array.isArray(patches) || !isDeepStrictEqual(plan.rows, profileApi.composeEntries([patches]))) {
    throw Error('NextTavern profile changed during composition; retry the profile update')
  }
  return plan
}

export function composition(ctx: Context): CompositionState {
  const tree = loaderEntry(ctx).parent.tree
  const patches = tree.ctx.fiber.entry?.options.config?.patches
  const previous = states.get(tree)
  if (previous?.applying) return previous
  // Include shares inserted rows with mutable Loader options. Compare the
  // effective composition: a later explicit patch still wins over a temporary
  // native fallback written into an earlier inserted row during rollback.
  const composed = Array.isArray(patches) ? profileApi.composeEntries([patches]) : undefined
  if (previous && isDeepStrictEqual(previous.patches, composed)) return previous
  let plan: ProfilePlan
  try {
    plan = capture(ctx, patches)
  } catch (error) {
    // This function is what the `disabled` expression evaluates, and Loader
    // runs that expression while it applies rows: throwing here aborts the row
    // application instead of reporting anything to a caller. Keep the last
    // admitted generation in that window — a rejected update's rollback, or a
    // document write that has not reached the Include row yet — and leave the
    // strict rejection to the update hook, which calls `capture` directly.
    if (!previous) throw error
    return previous
  }
  const acceptedPlan = previous?.plan
  const state = previous ?? {plan, restoring: false, applying: false, patches: plan.rows,
    nativeFibers: new Set<Fiber>()}
  state.plan = plan
  state.patches = plan.rows
  states.set(tree, state)
  // A failed product has no live update hook. Provider-only edits leave the
  // product row's config equal, so Include would otherwise keep its FAILED
  // fiber forever. A new effective generation retries that exact native fiber
  // once; its lifecycle/error stays visible to Loader and manager admission.
  const product = tree.store[PRODUCT_ENTRY]
  if (state.restoring && !state.owner && productWanted(ctx, state)
    && product?.fiber?.state === FAILED_FIBER_STATE) {
    state.previousPlan = acceptedPlan
    state.restoring = false
    product.fiber.update(product.options.config, true)
  }
  return state
}

export function evaluateDisabled(entry: Entry, value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && '__jsExpr' in value
    ? entry.evaluate(String(value.__jsExpr)) : value)
}

export function productWanted(ctx: Context, state: CompositionState): boolean {
  const row = state.plan.rows.find(candidate => candidate.id === PRODUCT_ENTRY)
  return Boolean(state.plan.selected && row && !evaluateDisabled(loaderEntry(ctx), row.disabled))
}

/** Used only on the official provider rows declared by this product bundle. */
export function nativeProviderDisabled(ctx: Context): boolean {
  // Loader evaluates an ancestor's disabled expression against each child's
  // context. A preset's persona row is not the provider the expression owns.
  let entry: Entry | undefined = loaderEntry(ctx)
  while (entry) {
    const disabled = entry.options.disabled as unknown
    if (disabled && typeof disabled === 'object' && '__jsExpr' in disabled
      && disabled.__jsExpr === providerDisabledExpression) break
    entry = entry.parent.ctx.fiber.entry
  }
  if (!entry) throw Error('NextTavern provider policy has no owning entry')
  const state = composition(entry.ctx)
  const original = state.plan.provider({id: entry.options.id, module: entry.options.name})
  if (!original) throw Error(`NextTavern cannot find original provider ${entry.options.id}`)
  if (!state.restoring && productWanted(entry.ctx, state)) {
    if (entry.fiber) state.nativeFibers.add(entry.fiber)
    return true
  }
  return evaluateDisabled(entry, original.row.disabled)
}

/** Resolve from the profile anchor: the caller must use the installed product. */
export const providerDisabledExpression = [
  '(() => {',
  '  const anchor = process.getBuiltinModule("node:path").join(ctx.profileContext.dir, "package.json");',
  '  const require = process.getBuiltinModule("node:module").createRequire(anchor);',
  '  return require("dsh-nexttavern/entry-policy").nativeProviderDisabled(ctx);',
  '})()',
].join('\n')
