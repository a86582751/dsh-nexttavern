/**
 * Settings bridge for the provider rows this product replaces.
 *
 * The product mounts every replaced provider inside its own Loader subtree —
 * native and replacement rows never overlap — while the official profile
 * editor addresses only children of the profile Include
 * (`entry.parent.tree.ctx.fiber.entry?.id === "include"`), and the settings
 * service derives its published namespaces from exactly those entries (running
 * fiber, state 2, a Config schema with volatile fields). A rehomed replacement
 * satisfies every condition except that one, so its namespace is never
 * published: the official page cannot list or write the package's volatile
 * configuration at all.
 *
 * This adapter closes that gap and nothing else. It adds the running
 * replacement rows to the addressable set (taking precedence over the profile
 * row they disabled, which shares the id) and keeps the profile patch the
 * single write target for them: while the official editor resolves its
 * document row, the row presents the specifier the profile declares. Without
 * that step the editor matches no row and appends a private one naming this
 * install's bundled module path, which the next composition refuses.
 *
 * A product that never mounts a settings surface is unaffected: the adapter
 * loads only while a `configEditor` service exists, and restores the host
 * methods it wrapped when it unloads. Its lifecycle rides the product fiber,
 * so both paths that release the product — an explicit shutdown and the
 * framework unloading the product fiber — may release it, in either order.
 * `close` is synchronous and `dispose` is idempotent for that reason: a
 * Cordis effect returns `undefined` instead of a promise once it already ran,
 * and an adapter that forwarded that value would break the caller's release.
 */
import type {Context} from '@deepseek-ai/cordis'

/** One replaced provider row as the product mounted it. */
export interface RehomedSettingsRow {
  /** Profile row id; also the settings namespace. */
  id: string
  /** Module specifier the profile declares for that id. */
  declared: string
  entry: {
    options: {id: string; name: string}
    fiber?: {state: number} | undefined
  }
}

/** The narrow surface of the host `configEditor` service this adapter uses. */
interface ConfigEditor {
  entries(): RehomedSettingsRow['entry'][]
  edit(entry: RehomedSettingsRow['entry'],
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void>
}

/** Installed adapter; `close` stops advertising synchronously. */
export interface SettingsBridge {
  close(): void
  /** Release the adapter fiber; safe to call after the fiber already unloaded. */
  dispose(): Promise<void>
}

/**
 * Add this product's running replacement rows to the official addressable set.
 * @param ctx product context that owns the replacement rows.
 * @param rows current replacement rows; re-read on every editor access.
 * @returns the installed adapter; its fiber is disposed with `ctx` as well.
 */
export function mountSettingsBridge(ctx: Context, rows: () => RehomedSettingsRow[]): SettingsBridge {
  let closed = false
  const fiber = ctx.inject(['configEditor'], (editorCtx) => {
    if (closed) return
    const editor = editorCtx.get('configEditor') as ConfigEditor | undefined
    if (!editor) return
    const address = editor.entries.bind(editor)
    const write = editor.edit.bind(editor)
    const writes = new Map<string, Promise<unknown>>()
    editorCtx.effect(() => () => {
      closed = true
      if (editor.entries === entries) editor.entries = address
      if (editor.edit === edit) editor.edit = write
    })
    // Only a row that actually mounted can stand in for the profile row it
    // replaced, and an id keeps exactly one addressable owner.
    const mounted = () => new Map(rows().flatMap(row => row.entry.fiber
      ? [[row.id, row] as const] : []))
    const entries = function entries() {
      if (closed) return address()
      const owned = mounted()
      const addressable = address().filter(entry => !owned.has(entry.options.id))
      for (const row of owned.values()) {
        if (!addressable.some(entry => entry.options.id === row.id)) addressable.push(row.entry)
      }
      return addressable
    }
    const edit = async function edit(entry: RehomedSettingsRow['entry'],
      change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>) {
      const row = closed ? undefined : mounted().get(entry.options.id)
      if (!row || row.entry !== entry || row.declared === entry.options.name) return write(entry, change)
      // The host reads the row's own specifier after several awaits. Serialize
      // per id so a concurrent writer can neither observe the profile
      // specifier nor lose it, and always restore the mounted module.
      const previous = writes.get(row.id) ?? Promise.resolve()
      const next = previous.then(async () => {
        const replacement = entry.options.name
        entry.options.name = row.declared
        try { return await write(entry, change) } finally { entry.options.name = replacement }
      })
      writes.set(row.id, next.catch(() => undefined))
      return next
    }
    editor.entries = entries
    editor.edit = edit
  })
  let releasing: Promise<void> | undefined
  return {
    close() {closed = true},
    dispose() {
      // The entry fiber unloads the adapter alongside its own children, so a
      // shutdown may reach here first or second. Always hand back a promise.
      return releasing ??= (async () => { await fiber.dispose() })()
    },
  }
}
