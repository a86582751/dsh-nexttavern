// Generated from runtime/alpha3/src/core/author-native-message-variables.ts; edit the TypeScript source.
/** Shared captured-message view, serialized into author realms. Ordinary
 * addresses come from Native selection facts, never MVU publication owners. */
export function createAuthorNativeMessageVariables(snapshot) {
    const key = (target) => {
        const identity = target.identity, variant = identity.variant;
        return JSON.stringify([identity.ownerSessionId, identity.nativeSeq, identity.messageId,
            variant.kind, variant.kind === 'opening-variant' ? variant.id : null]);
    };
    let captures;
    const captured = (target) => {
        if (!target)
            return;
        if (!captures) {
            captures = new Map();
            for (const capture of snapshot.ordinaryMessages ?? []) {
                const address = capture.root.namespace.target;
                if (address)
                    captures.set(key(address), capture);
            }
        }
        return captures.get(key(target));
    };
    const overlay = (base, capture) => {
        const values = { ...(capture?.replaceOrdinary ? {} : base), ...capture?.values };
        for (const name of capture?.deletedKeys ?? [])
            delete values[name];
        // Numerical presence and value belong solely to the actual MVU row.
        if (base && Object.hasOwn(base, 'stat_data'))
            values.stat_data = base.stat_data;
        else
            delete values.stat_data;
        return values;
    };
    const forMessage = (message) => {
        const capture = captured(message?.ordinary?.selectedTarget);
        const base = message?.variables.kind === 'available' ? message.variables.variables : undefined;
        return { message, capture, values: overlay(base, capture) };
    };
    const resolve = (selector, forWrite = false) => {
        const rows = snapshot.messages, id = selector.message_id;
        const message = id === undefined || id === 'latest'
            ? forWrite ? rows.at(-1) : rows.findLast(row => row.role !== 'system')
            : rows[id < 0 ? rows.length + id : id];
        const result = forMessage(message);
        if (forWrite && !result.capture)
            throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
        return result;
    };
    const swipeData = (message) => {
        if (!message.variants)
            return;
        return message.variants.swipes.map((_, index) => {
            const base = message.variants.swipes_data?.[index] ?? undefined;
            const capture = captured(message.ordinary?.variants[index]);
            return base || capture?.exists ? overlay(base, capture) : null;
        });
    };
    const swipeInfo = (message) => message.variants?.swipes_info
        ?? (message.variants?.swipes ?? [message.message]).map(() => ({ extra: {} }));
    const chatMessage = (message, includeSwipes = false) => {
        const data = forMessage(message).values, variants = message.variants, swipes = variants?.swipes ?? [message.message], swipes_data = swipeData(message) ?? [data], common = { message_id: message.index, role: message.role, name: message.name ?? '',
            is_hidden: message.is_hidden ?? false, extra: message.extra ?? {},
            swipe_id: variants?.swipe_id ?? 0, swipes, swipes_data };
        return includeSwipes ? { ...common, swipes_info: swipeInfo(message) }
            : { ...common, message: message.message, data };
    };
    const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const sameJson = (left, right) => {
        if (left === right)
            return true;
        if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
            return false;
        if (Array.isArray(left) !== Array.isArray(right))
            return false;
        if (Array.isArray(left)) {
            const other = right;
            if (left.length !== other.length)
                return false;
            for (let i = 0; i < left.length; i++)
                if (!sameJson(left[i], other[i]))
                    return false;
            return true;
        }
        const leftObj = left, rightObj = right;
        const leftKeys = Object.keys(leftObj).filter(name => leftObj[name] !== undefined);
        const rightKeys = Object.keys(rightObj).filter(name => rightObj[name] !== undefined);
        if (leftKeys.length !== rightKeys.length)
            return false;
        for (const name of leftKeys) {
            if (!Object.hasOwn(rightObj, name) || rightObj[name] === undefined || !sameJson(leftObj[name], rightObj[name]))
                return false;
        }
        return true;
    };
    const isOrdinaryOwned = (capture, name) => {
        if (name === 'stat_data' || !capture)
            return false;
        return capture.replaceOrdinary === true || Object.hasOwn(capture.values, name) || (capture.deletedKeys?.includes(name) ?? false);
    };
    const reconcilePack = (bankPack, effective, next, capture) => {
        if (next === null) {
            if (effective) {
                for (const name of Object.keys(effective)) {
                    if (effective[name] !== undefined && isOrdinaryOwned(capture, name))
                        throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED');
                }
            }
            return null;
        }
        if (effective === null) {
            for (const name of Object.keys(next)) {
                if (isOrdinaryOwned(capture, name))
                    throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED');
            }
            return next;
        }
        // Preserve original bank pack keys (including hidden fallbacks) and never
        // persist unchanged ordinary overlay keys back into opening bank packs.
        const pack = { ...bankPack };
        const names = new Set([...Object.keys(effective), ...Object.keys(next)]);
        for (const name of names) {
            const hadEffective = Object.hasOwn(effective, name) && effective[name] !== undefined;
            const hasNext = Object.hasOwn(next, name) && next[name] !== undefined;
            const changed = hadEffective !== hasNext || (hadEffective && !sameJson(effective[name], next[name]));
            if (!changed)
                continue;
            if (isOrdinaryOwned(capture, name))
                throw Error('AUTHOR_NATIVE_MESSAGE_ORDINARY_DATA_UNSUPPORTED');
            if (hasNext)
                pack[name] = next[name];
            else
                delete pack[name];
        }
        return pack;
    };
    const allowedFields = new Set(['message_id', 'role', 'is_hidden', 'message', 'data',
        'swipe_id', 'swipes', 'swipes_data', 'swipes_info', 'name', 'extra']);
    const planTarget = (index, merged) => {
        const message = snapshot.messages[index];
        if (merged.role !== undefined && merged.role !== message.role)
            throw Error('AUTHOR_NATIVE_MESSAGE_ROLE_CHANGE_UNSUPPORTED');
        if (merged.name !== undefined && typeof merged.name !== 'string')
            throw Error('AUTHOR_NATIVE_MESSAGE_NAME_INVALID');
        if (merged.extra !== undefined && !object(merged.extra))
            throw Error('AUTHOR_NATIVE_MESSAGE_EXTRA_INVALID');
        if (merged.is_hidden !== undefined && typeof merged.is_hidden !== 'boolean')
            throw Error('AUTHOR_NATIVE_MESSAGE_HIDDEN_INVALID');
        const metadata = { ...merged.name !== undefined && merged.name !== (message.name ?? '') ? { name: merged.name } : {},
            ...merged.is_hidden !== undefined && merged.is_hidden !== (message.is_hidden ?? false) ? { is_hidden: merged.is_hidden } : {} };
        const metadataChanged = Object.keys(metadata).length > 0;
        const extraChanged = merged.extra !== undefined && !sameJson(merged.extra, message.extra ?? {});
        const fieldSinglePage = Object.hasOwn(merged, 'message') || Object.hasOwn(merged, 'data');
        if ((metadataChanged || extraChanged) && !fieldSinglePage) {
            const variants = chatMessage(message, true);
            if (merged.swipe_id !== undefined && merged.swipe_id !== variants.swipe_id
                || merged.swipes !== undefined && !sameJson(merged.swipes, variants.swipes)
                || merged.swipes_data !== undefined && !sameJson(merged.swipes_data, variants.swipes_data))
                throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED');
            if (merged.swipes_info !== undefined && !sameJson(merged.swipes_info, swipeInfo(message)))
                throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INFO_UNSUPPORTED');
        }
        // Upstream chooses the single-page branch by field presence, before
        // comparing values. An explicitly undefined field still selects it.
        const singlePage = fieldSinglePage || metadataChanged || extraChanged;
        if (singlePage) {
            if (merged.message !== undefined && typeof merged.message !== 'string')
                throw Error('AUTHOR_NATIVE_MESSAGE_BODY_INVALID');
            if (merged.data !== undefined && !object(merged.data))
                throw Error('AUTHOR_NATIVE_MESSAGE_DATA_INVALID');
            const nextData = merged.data;
            const bodyChanged = merged.message !== undefined && merged.message !== message.message;
            const currentData = nextData !== undefined ? forMessage(message).values : undefined;
            const dataChanged = nextData !== undefined && !sameJson(currentData, nextData);
            if (!bodyChanged && !dataChanged && !metadataChanged && !extraChanged)
                return { kind: 'unchanged' };
            const numericalChanged = dataChanged && !sameJson(currentData?.stat_data, nextData?.stat_data);
            if (!message.variants || !bodyChanged && !numericalChanged && (metadataChanged || extraChanged || dataChanged)) {
                if (message.nativeSeq === null)
                    throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
                if (numericalChanged)
                    throw Error('AUTHOR_NATIVE_MESSAGE_NUMERICAL_MIXED_UNSUPPORTED');
                const ordinary = dataChanged ? Object.fromEntries(Object.entries(nextData).filter(([name]) => name !== 'stat_data')) : undefined;
                if (dataChanged && !forMessage(message).capture)
                    throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
                if (metadataChanged || extraChanged || dataChanged)
                    return { kind: 'patch', message_id: index,
                        text: merged.message ?? message.message, message, patch: {
                            ...metadataChanged ? { metadata } : {}, ...extraChanged ? { extra: merged.extra } : {},
                            ...ordinary ? { ordinary } : {}
                        } };
                return { kind: 'body', message_id: index, text: merged.message, message };
            }
            if (metadataChanged || extraChanged)
                throw Error('AUTHOR_NATIVE_MESSAGE_NUMERICAL_MIXED_UNSUPPORTED');
            if (bodyChanged && dataChanged)
                throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED');
            if (bodyChanged) {
                if (message.variants || message.ordinary?.selectedTarget.identity.variant.kind === 'opening-variant')
                    throw Error('AUTHOR_NATIVE_MESSAGE_OPENING_BODY_UNSUPPORTED');
                if (message.nativeSeq === null)
                    throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
                return { kind: 'body', message_id: index, text: merged.message, message };
            }
            if (!message.variants)
                throw Error('AUTHOR_NATIVE_MESSAGE_DATA_UNSUPPORTED');
            const variants = message.variants;
            const selectedIndex = variants.swipe_id;
            const capture = captured(message.ordinary?.variants[selectedIndex] ?? message.ordinary?.selectedTarget);
            const nextPacks = variants.swipes.map((_, candidateIndex) => {
                const pack = variants.swipes_data?.[candidateIndex] ?? null;
                return candidateIndex === selectedIndex ? reconcilePack(pack, currentData, nextData, capture) : pack;
            });
            return { kind: 'opening', row: { message_id: index, swipes_data: nextPacks } };
        }
        if (merged.swipes_info !== undefined && !sameJson(merged.swipes_info, swipeInfo(message)))
            throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INFO_UNSUPPORTED');
        if (merged.swipe_id === undefined && merged.swipes === undefined && merged.swipes_data === undefined)
            return { kind: 'unchanged' };
        if (!message.variants) {
            const current = chatMessage(message, true);
            if ((merged.swipe_id === undefined || merged.swipe_id === current.swipe_id)
                && (merged.swipes === undefined || sameJson(merged.swipes, current.swipes))
                && (merged.swipes_data === undefined || sameJson(merged.swipes_data, current.swipes_data))
                && (merged.swipes_info === undefined || sameJson(merged.swipes_info, swipeInfo(message))))
                return { kind: 'unchanged' };
            throw Error('AUTHOR_NATIVE_MESSAGE_DATA_UNSUPPORTED');
        }
        const variants = message.variants;
        if (merged.swipes !== undefined) {
            if (!Array.isArray(merged.swipes) || merged.swipes.some(text => typeof text !== 'string'))
                throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_INVALID');
            if (merged.swipes.length !== variants.swipes.length || merged.swipes.some((text, i) => text !== variants.swipes[i]))
                throw Error('AUTHOR_NATIVE_MESSAGE_OPENING_SWIPES_UNSUPPORTED');
        }
        let activateChanged = false;
        if (merged.swipe_id !== undefined) {
            if (typeof merged.swipe_id !== 'number' || !Number.isInteger(merged.swipe_id)
                || merged.swipe_id < 0 || merged.swipe_id >= variants.swipes.length)
                throw Error('AUTHOR_NATIVE_MESSAGE_SWIPE_ID_INVALID');
            activateChanged = merged.swipe_id !== variants.swipe_id;
        }
        let nextPacks, packsChanged = false;
        if (merged.swipes_data !== undefined) {
            if (!Array.isArray(merged.swipes_data) || merged.swipes_data.length !== variants.swipes.length)
                throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_DATA_INVALID');
            const effectivePacks = swipeData(message);
            nextPacks = [];
            for (let i = 0; i < merged.swipes_data.length; i++) {
                const rawNext = merged.swipes_data[i];
                if (rawNext !== null && !object(rawNext))
                    throw Error('AUTHOR_NATIVE_MESSAGE_SWIPES_DATA_INVALID');
                const nextPack = rawNext;
                const bankPack = variants.swipes_data?.[i] ?? null, effective = effectivePacks[i] ?? null;
                if (sameJson(effective, nextPack))
                    nextPacks.push(bankPack);
                else {
                    packsChanged = true;
                    nextPacks.push(reconcilePack(bankPack, effective, nextPack, captured(message.ordinary?.variants[i])));
                }
            }
        }
        if (activateChanged && packsChanged)
            throw Error('AUTHOR_NATIVE_MESSAGE_MIXED_MUTATION_UNSUPPORTED');
        if (packsChanged)
            return { kind: 'opening', row: { message_id: index, swipes_data: nextPacks } };
        if (activateChanged)
            return { kind: 'opening', row: { message_id: index, swipe_id: merged.swipe_id } };
        return { kind: 'unchanged' };
    };
    const planSetChatMessages = (rows) => {
        if (!Array.isArray(rows))
            throw Error('AUTHOR_NATIVE_MESSAGE_REQUEST_INVALID');
        const mergedByIndex = new Map();
        for (const row of rows) {
            if (!object(row))
                throw Error('AUTHOR_NATIVE_MESSAGE_REQUEST_INVALID');
            const keys = Object.keys(row);
            for (const name of keys)
                if (!allowedFields.has(name))
                    throw Error('AUTHOR_NATIVE_MESSAGE_FIELD_UNSUPPORTED');
            const id = row.message_id;
            if (typeof id !== 'number' || !Number.isInteger(id))
                throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
            const index = id < 0 ? snapshot.messages.length + id : id;
            if (!snapshot.messages[index])
                throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
            let target = mergedByIndex.get(index);
            if (!target) {
                target = {};
                mergedByIndex.set(index, target);
            }
            Object.assign(target, row);
        }
        let selected;
        for (const [index, merged] of mergedByIndex) {
            const plan = planTarget(index, merged);
            if (plan.kind !== 'unchanged') {
                if (selected)
                    throw Error('AUTHOR_NATIVE_MESSAGE_MULTIPLE_TARGETS_UNSUPPORTED');
                selected = plan;
            }
        }
        return selected ?? { kind: 'unchanged' };
    };
    const legacySetChatMessage = (fields, messageId, options = {}, substitute = (text) => text) => {
        const refresh = options.refresh ?? 'display_and_render_current';
        if (refresh === 'display_current')
            throw Error('AUTHOR_NATIVE_LEGACY_DISPLAY_CURRENT_UNSUPPORTED');
        if (!['none', 'display_and_render_current', 'all'].includes(refresh))
            throw Error('AUTHOR_NATIVE_MESSAGE_REFRESH_INVALID');
        const index = messageId < 0 ? snapshot.messages.length + messageId : messageId, message = snapshot.messages[index];
        if (!message)
            throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
        const value = typeof fields === 'string' ? { message: fields } : fields, current = chatMessage(message, true);
        const selected = current.swipe_id, target = options.swipe_id === undefined || options.swipe_id === 'current' ? selected : options.swipe_id;
        if (!Number.isInteger(target) || target < 0 || target >= current.swipes.length)
            throw Error('AUTHOR_NATIVE_MESSAGE_SWIPE_ID_INVALID');
        const row = { message_id: messageId };
        const text = value.message === undefined ? undefined : substitute(value.message, index);
        if (target === selected) {
            if (text !== undefined)
                row.message = text;
            if (value.data !== undefined)
                row.data = value.data;
        }
        else {
            if (text !== undefined && text !== current.swipes[target]) {
                const swipes = [...current.swipes];
                swipes[target] = text;
                row.swipes = swipes;
            }
            if (value.data !== undefined) {
                const packs = [...current.swipes_data];
                packs[target] = value.data;
                row.swipes_data = packs;
            }
            // Upstream can write an unselected page without activating it. The
            // modern owner decides which captured variant edits are supported.
            if (refresh !== 'none')
                row.swipe_id = target;
        }
        return { rows: [row], refresh: refresh === 'display_and_render_current' ? 'affected' : refresh };
    };
    return { resolve, forMessage, swipeData, chatMessage, planSetChatMessages, legacySetChatMessage };
}
