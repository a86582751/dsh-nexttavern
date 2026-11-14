// Generated from runtime/alpha3/src/memory/character-private-memory.ts; edit the TypeScript source.
export class CharacterPrivateConflict extends Error {
}
export const characterPrivateKey = ({ branchId, characterId }) => 'character_private_v1__' + Buffer.from(JSON.stringify([branchId, characterId])).toString('base64url');
const same = (left, right) => left.branchId === right.branchId && left.characterId === right.characterId
    && left.revision === right.revision && left.boundaryId === right.boundaryId && left.materialId === right.materialId;
const recordIdentity = (record) => JSON.stringify([
    record.schemaVersion, record.id, record.kind, record.category, record.text, record.certainty,
    [...new Set(record.sourceKeys)].sort(), record.evidenceSeq, record.perceptionId, record.materialId, record.consumedRevision,
    record.triggerInputId, record.taskId, record.generation, record.publicationId, record.publicationBranchId, record.replaces,
]);
const generatedIdentity = (publication) => JSON.stringify([
    publication.id, [...new Set(publication.input.sourceKeys)].sort(), [...new Set(publication.input.recordIds)].sort(),
    publication.input.personaId, publication.input.originCut,
    publication.persona && [publication.persona.id, publication.persona.materialId, publication.persona.text,
        [...new Set(publication.persona.sourceKeys)].sort(), publication.persona.presence, publication.persona.publicationId],
    publication.records.map(recordIdentity),
]);
function latestCut(...cuts) {
    let result;
    for (const cut of cuts)
        if (cut !== undefined)
            result = result === undefined ? cut : Math.max(result, cut);
    return result;
}
/** Each character's journal is the atomic unit provided by T.memory.put.
 * Persona and records from one perception are published together. */
export function createCharacterPrivateMemory(table) {
    const states = new Map();
    const queues = new Map();
    let closing, disposed = false;
    function state(scope) {
        if (disposed)
            throw Error('角色记忆实例已释放');
        const current = states.get(characterPrivateKey(scope));
        if (!current)
            throw Error('角色材料尚未准备');
        return current;
    }
    function recordFact(current, id) {
        const index = current.index.get(id);
        return index === undefined ? undefined : current.history[index];
    }
    function inputFact(current, input, seedLength) {
        const records = input.recordIds.map(id => recordFact(current, id));
        const persona = input.personaId === undefined ? undefined : current.personas.get(input.personaId);
        const originCut = latestCut(input.originCut, persona?.originCut, ...records.map(record => record?.originCut));
        return { originCut, valid: input.sourceKeys.every(key => current.sources.has(key))
                && records.every(record => record?.valid === true)
                && (input.personaId === undefined || persona?.valid === true)
                && (seedLength === undefined || originCut === undefined || originCut <= seedLength) };
    }
    function applyRecord(current, value, node, seedLength) {
        const record = Object.freeze({ ...value, sourceKeys: Object.freeze([...value.sourceKeys]) });
        const parent = record.replaces ? recordFact(current, record.replaces) : undefined;
        const originCut = latestCut(node?.originCut, parent?.originCut);
        const valid = record.materialId === current.boundary.materialId && record.sourceKeys.every(key => current.sources.has(key))
            && node?.valid !== false && (!record.replaces || parent?.valid === true)
            && (seedLength === undefined || originCut === undefined || originCut <= seedLength);
        if (parent && valid) {
            const index = current.index.get(parent.record.id);
            current.history[index] = { ...parent, status: 'replaced' };
        }
        current.index.set(record.id, current.history.length);
        current.history.push({ record, valid, originCut, status: valid ? 'active' : 'source-changed' });
    }
    function applyEvent(current, event, seedLength) {
        if (event.kind === 'publish') {
            applyRecord(current, event.record, undefined, seedLength);
        }
        else if (event.kind === 'generated') {
            const { publication } = event;
            const fact = inputFact(current, publication.input, seedLength);
            current.nodes.set(publication.id, { ...fact, publication });
            if (publication.persona) {
                const persona = Object.freeze({ ...publication.persona,
                    sourceKeys: Object.freeze([...publication.persona.sourceKeys]) });
                current.personas.set(persona.id, { ...fact, persona, valid: fact.valid
                        && persona.materialId === current.boundary.materialId && persona.sourceKeys.every(key => current.sources.has(key)) });
                current.latestPersonaId = persona.id;
            }
            for (const record of publication.records)
                applyRecord(current, record, fact, seedLength);
        }
        else {
            const row = recordFact(current, event.id);
            if (row && row.valid && row.status !== 'replaced')
                current.history[current.index.get(event.id)] = { ...row, status: event.active ? 'active' : 'disabled' };
        }
    }
    function assemble(scope, current) {
        const persona = current.latestPersonaId ? current.personas.get(current.latestPersonaId) : undefined;
        const playable = persona?.valid ? persona.persona : undefined;
        // A supplied Source-only persona remains supported by the generic owner.
        // The product supplies an empty one and publishes its trusted persona here.
        const text = current.latestPersonaId ? playable?.text ?? '' : current.boundary.playablePersona;
        current.view = Object.freeze({ schemaVersion: 1, ...scope, revision: current.journal.revision,
            boundaryId: current.boundary.identity, materialId: current.boundary.materialId,
            ready: current.boundary.ready && !!text, persona: text,
            ...(playable ? { personaId: playable.id, presence: playable.presence } : {}),
            entries: Object.freeze(current.history.filter(row => row.status === 'active').map(row => row.record)) });
        return current;
    }
    function project(scope, journal, boundary, seedLength) {
        const current = { journal, boundary, view: undefined,
            sources: new Set(boundary.sourceKeys), index: new Map(), history: [], nodes: new Map(), personas: new Map() };
        for (const event of journal.events)
            applyEvent(current, event, seedLength);
        return assemble(scope, current);
    }
    function mutate(scope, work) {
        if (closing)
            return Promise.reject(Error('角色记忆实例已释放'));
        const key = characterPrivateKey(scope), previous = queues.get(key) ?? Promise.resolve();
        const next = previous.catch(() => { }).then(work);
        queues.set(key, next);
        void next.finally(() => { if (queues.get(key) === next)
            queues.delete(key); }).catch(() => { });
        return next;
    }
    async function append(scope, current, events) {
        const owned = structuredClone(events);
        const journal = { ...current.journal, schemaVersion: 1, revision: current.journal.revision + 1,
            events: [...current.journal.events, ...owned] };
        await table.put(characterPrivateKey(scope), journal);
        // Only the new finite publications are projected after the durable write.
        // The old journal is replayed solely for cold/Source/fork transitions.
        const next = { ...current, journal, history: current.history.slice() };
        for (const event of owned)
            applyEvent(next, event);
        states.set(characterPrivateKey(scope), assemble(scope, next));
        return next.view;
    }
    function checkRecords(current, scope, expected, records, initializing = false) {
        const ids = new Set(), targets = new Set();
        let stored = 0;
        for (const record of records) {
            if (ids.has(record.id))
                throw Error('批次包含重复角色记录身份');
            ids.add(record.id);
            const old = recordFact(current, record.id)?.record;
            if (old) {
                if (recordIdentity(old) !== recordIdentity(record))
                    throw Error('角色记录身份已被使用');
                stored++;
            }
        }
        if (records.length && stored === records.length)
            return true;
        if (stored || !same(current.view, expected)
            || !initializing && !current.view.ready && records.some(record => record.kind !== 'user-correction'))
            throw new CharacterPrivateConflict('角色材料已变化，请保留草稿并重新核对');
        for (const record of records) {
            if (record.schemaVersion !== 1 || !record.id || !record.text.trim() || !record.publicationId
                || record.publicationBranchId !== scope.branchId || record.materialId !== current.view.materialId
                || record.consumedRevision !== current.view.revision
                || record.sourceKeys.some(key => !current.sources.has(key)))
                throw new CharacterPrivateConflict('角色记忆来源无效');
            if (record.replaces) {
                const parent = recordFact(current, record.replaces);
                if (!parent || parent.status === 'source-changed' || parent.status === 'replaced'
                    || record.kind !== 'user-correction' || targets.has(record.replaces))
                    throw Error('修订对象或来源无效');
                targets.add(record.replaces);
            }
        }
        return false;
    }
    function publishMany(scope, expected, records) {
        return mutate(scope, async () => {
            const current = state(scope);
            if (!records.length || checkRecords(current, scope, expected, records))
                return current.view;
            return append(scope, current, records.map(record => ({ kind: 'publish', record })));
        });
    }
    return {
        release(scope) {
            return mutate(scope, async () => { states.delete(characterPrivateKey(scope)); });
        },
        dispose() {
            closing ??= (async () => {
                await Promise.allSettled([...queues.values()]);
                states.clear();
                queues.clear();
                disposed = true;
            })();
            return closing;
        },
        synchronize(scope, boundary) {
            return mutate(scope, async () => {
                const stored = table.get(characterPrivateKey(scope));
                if (stored && stored.schemaVersion !== 1)
                    throw Error('不支持的角色记忆版本');
                const journal = stored ?? { schemaVersion: 1, revision: 0, events: [] };
                states.set(characterPrivateKey(scope), project(scope, journal, structuredClone(boundary)));
                return state(scope).view;
            });
        },
        extendSources(scope, keys) {
            return mutate(scope, async () => {
                const current = state(scope);
                for (const key of keys)
                    current.sources.add(key);
                return current.view;
            });
        },
        view(scope) { return state(scope).view; },
        persona(scope) {
            const current = state(scope), persona = current.latestPersonaId ? current.personas.get(current.latestPersonaId) : undefined;
            return persona?.valid ? persona.persona : undefined;
        },
        acceptsSources(scope, keys) {
            const sources = state(scope).sources;
            return keys.every(key => sources.has(key));
        },
        captureInput(scope, recordIds, options) {
            const current = state(scope);
            return { sourceKeys: [...new Set(options.sourceKeys)], recordIds: [...recordIds],
                ...(options.consumePersona !== false && current.view.ready && current.view.personaId
                    ? { personaId: current.view.personaId } : {}),
                ...(options.originCut === undefined ? {} : { originCut: options.originCut }) };
        },
        generatedReceipt(scope, id) {
            const current = state(scope);
            // This acknowledges an already durable publication. It grants no new write.
            return current.nodes.has(id) ? { view: current.view } : undefined;
        },
        publicationReceipt(scope, recordId) {
            const current = state(scope), index = current.index.get(recordId);
            if (index === undefined)
                throw Error('角色记录尚未发布');
            const row = current.history[index];
            return { status: row.status, view: current.view, historyIndex: index,
                publicationId: row.record.publicationId, publicationBranchId: row.record.publicationBranchId };
        },
        current(identity) { const current = state(identity).view; return same(current, identity) && current.ready; },
        publishMany,
        publish: (scope, expected, record) => publishMany(scope, expected, [record]),
        publishGenerated(scope, expected, publication) {
            return mutate(scope, async () => {
                const current = state(scope), prior = current.nodes.get(publication.id);
                if (prior) {
                    if (generatedIdentity(prior.publication) !== generatedIdentity(publication))
                        throw Error('角色生成发布身份已被使用');
                    return current.view;
                }
                if (!publication.records.length && !publication.persona)
                    return current.view;
                checkRecords(current, scope, expected, publication.records, !!publication.persona);
                const fact = inputFact(current, publication.input), persona = publication.persona;
                if (!fact.valid || persona && (persona.materialId !== current.view.materialId
                    || !persona.text.trim() || persona.sourceKeys.some(key => !current.sources.has(key))))
                    throw new CharacterPrivateConflict('角色生成材料来源无效');
                return append(scope, current, [{ kind: 'generated', publication }]);
            });
        },
        setActive(scope, expected, id, active, publicationId) {
            return mutate(scope, async () => {
                const current = state(scope);
                if (!same(current.view, expected))
                    throw Error('角色材料已变化，请保留草稿并重新核对');
                const row = recordFact(current, id);
                if (!row || row.status === 'source-changed' || row.status === 'replaced')
                    throw Error('记录来源已失效或已修订');
                return append(scope, current, [{ kind: 'availability', id, active, publicationId }]);
            });
        },
        history(scope, offset = 0, limit = 20) {
            const rows = state(scope).history, start = Math.max(0, Math.trunc(offset)), cap = Math.max(1, Math.min(100, Math.trunc(limit)));
            return { entries: structuredClone(rows.slice(start, start + cap).map(({ record, status }) => ({ record, status }))),
                nextOffset: start + cap < rows.length ? start + cap : null };
        },
        freezeFork(scope, seedSourceKeys, seedLength) {
            const current = state(scope);
            // Fork requires complete output, so the existing journal is projected once
            // against the exact seed. No TaskHost/Run scan or ancestor-key expansion.
            const selected = project(scope, current.journal, { ...current.boundary, sourceKeys: [...seedSourceKeys] }, seedLength);
            const events = current.journal.events.flatMap((event) => {
                if (event.kind === 'publish')
                    return recordFact(selected, event.record.id)?.valid ? [event] : [];
                if (event.kind === 'availability')
                    return recordFact(selected, event.id)?.valid ? [event] : [];
                if (!selected.nodes.get(event.publication.id)?.valid)
                    return [];
                const persona = event.publication.persona;
                return [{ kind: 'generated', publication: { ...event.publication,
                            ...(persona && !selected.personas.get(persona.id)?.valid ? { persona: undefined } : {}),
                            records: event.publication.records.filter(record => recordFact(selected, record.id)?.valid) } }];
            });
            const { branchId, characterId, revision, boundaryId, materialId } = current.view;
            return { schemaVersion: 1, parent: { branchId, characterId, revision, boundaryId, materialId }, events: structuredClone(events) };
        },
        /** Before Source commit this writes only its frozen DATA. The first live
         * load binds the journal to the child's committed material boundary. */
        installFork(scope, forkId, snapshot, boundary) {
            return mutate(scope, async () => {
                const existing = table.get(characterPrivateKey(scope));
                if (existing && existing.forkId !== forkId)
                    throw Error('目标世界线角色记忆已存在');
                if (snapshot.schemaVersion !== 1 || snapshot.parent.characterId !== scope.characterId
                    || boundary && snapshot.parent.materialId !== boundary.materialId)
                    throw Error('角色继承来源无效');
                const journal = existing ?? { schemaVersion: 1, revision: 1, forkId, events: structuredClone(snapshot.events) };
                if (!existing)
                    await table.put(characterPrivateKey(scope), journal);
                if (boundary) {
                    states.set(characterPrivateKey(scope), project(scope, journal, structuredClone(boundary)));
                    return state(scope).view;
                }
                states.delete(characterPrivateKey(scope));
            });
        },
    };
}
/** Prompt and history tools consume the exact same frozen view, with no path
 * to raw seq reads or global agreements/director notes. */
export function characterPrivatePrompt(view) {
    if (!view.ready)
        throw Error('角色感知材料尚未准备');
    // Keep each category represented before filling remaining slots with recent
    // records. This is an explicit excerpt, never a generated summary or proof of
    // complete knowledge. The tool retains the entire same authorized view.
    const categories = new Map();
    for (const record of view.entries) {
        const group = categories.get(record.category) ?? [];
        group.push(record);
        categories.set(record.category, group);
    }
    const selected = [], chosen = new Set();
    for (const group of categories.values()) {
        const record = group.at(-1);
        selected.push(record);
        chosen.add(record.id);
    }
    for (let index = view.entries.length - 1; index >= 0 && selected.length < 24; index--) {
        const record = view.entries[index];
        if (!chosen.has(record.id)) {
            selected.push(record);
            chosen.add(record.id);
        }
    }
    let remaining = 12000, truncatedRecords = 0;
    const memories = selected.flatMap(record => {
        if (!remaining)
            return [];
        const text = record.text.slice(0, Math.min(1500, remaining));
        remaining -= text.length;
        const truncated = text.length < record.text.length;
        if (truncated)
            truncatedRecords++;
        return [{ id: record.id, category: record.category, kind: record.kind, certainty: record.certainty, text, truncated }];
    });
    const omittedRecords = view.entries.length - memories.length;
    return { schemaVersion: 1, branchId: view.branchId, characterId: view.characterId,
        revision: view.revision, boundaryId: view.boundaryId, materialId: view.materialId,
        persona: view.persona, memories, coverage: { totalRecords: view.entries.length, omittedRecords, truncatedRecords,
            excerptTextBudget: 12000, complete: omittedRecords === 0 && truncatedRecords === 0 },
        instruction: '这是本人材料的有限原文摘录；意向与未证实认知不是外部已发生事实。未展示不等于不存在；相关材料有缺口时，用rp_history本人关键词search或recordId回读，不能读取全局约定。' };
}
export function queryCharacterPrivateView(view, args) {
    if (!view.ready)
        throw Error('角色感知材料尚未准备');
    if (args.kind)
        throw Error('角色不能读取全局人物约定');
    const cap = Math.max(1, Math.min(12000, Number(args.maxChars) || 6000));
    if (args.action === 'read') {
        const matches = view.entries.filter(record => typeof args.recordId === 'string'
            ? record.id === args.recordId : Number.isSafeInteger(args.seq) && record.evidenceSeq === args.seq);
        const text = matches.map(record => record.text).join('\n'), offset = Math.max(0, Number(args.offset) || 0);
        return { schemaVersion: 1, kind: 'character-private', entries: matches.map(({ id, sourceKeys }) => ({ id, sourceKeys })),
            text: text.slice(offset, offset + cap), nextOffset: offset + cap < text.length ? offset + cap : null };
    }
    const terms = String(args.query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let remaining = cap;
    const entries = view.entries.filter(record => terms.every(term => record.text.toLocaleLowerCase().includes(term)))
        .slice(-Math.max(1, Math.min(8, Number(args.limit) || 5))).flatMap(record => {
        if (!remaining)
            return [];
        const text = record.text.slice(0, remaining);
        remaining -= text.length;
        return [{ ...record, text }];
    });
    return { schemaVersion: 1, kind: 'character-private', entries };
}
