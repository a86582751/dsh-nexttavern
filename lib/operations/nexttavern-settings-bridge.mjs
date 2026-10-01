// Generated from runtime/alpha3/src/operations/nexttavern-settings-bridge.mts; edit the TypeScript source.
/**
 * Add this product's running replacement rows to the official addressable set.
 * @param ctx product context that owns the replacement rows.
 * @param rows current replacement rows; re-read on every editor access.
 * @returns the installed adapter; its fiber is disposed with `ctx` as well.
 */
export function mountSettingsBridge(ctx, rows) {
    let closed = false;
    const fiber = ctx.inject(['configEditor'], (editorCtx) => {
        if (closed)
            return;
        const editor = editorCtx.get('configEditor');
        if (!editor)
            return;
        const address = editor.entries.bind(editor);
        const write = editor.edit.bind(editor);
        const writes = new Map();
        editorCtx.effect(() => () => {
            closed = true;
            if (editor.entries === entries)
                editor.entries = address;
            if (editor.edit === edit)
                editor.edit = write;
        });
        // Only a row that actually mounted can stand in for the profile row it
        // replaced, and an id keeps exactly one addressable owner.
        const mounted = () => new Map(rows().flatMap(row => row.entry.fiber
            ? [[row.id, row]] : []));
        const entries = function entries() {
            if (closed)
                return address();
            const owned = mounted();
            const addressable = address().filter(entry => !owned.has(entry.options.id));
            for (const row of owned.values()) {
                if (!addressable.some(entry => entry.options.id === row.id))
                    addressable.push(row.entry);
            }
            return addressable;
        };
        const edit = async function edit(entry, change) {
            const row = closed ? undefined : mounted().get(entry.options.id);
            if (!row || row.entry !== entry || row.declared === entry.options.name)
                return write(entry, change);
            // The host reads the row's own specifier after several awaits. Serialize
            // per id so a concurrent writer can neither observe the profile
            // specifier nor lose it, and always restore the mounted module.
            const previous = writes.get(row.id) ?? Promise.resolve();
            const next = previous.then(async () => {
                const replacement = entry.options.name;
                entry.options.name = row.declared;
                try {
                    return await write(entry, change);
                }
                finally {
                    entry.options.name = replacement;
                }
            });
            writes.set(row.id, next.catch(() => undefined));
            return next;
        };
        editor.entries = entries;
        editor.edit = edit;
    });
    let releasing;
    return {
        close() { closed = true; },
        dispose() {
            // The entry fiber unloads the adapter alongside its own children, so a
            // shutdown may reach here first or second. Always hand back a promise.
            return releasing ??= (async () => { await fiber.dispose(); })();
        },
    };
}
