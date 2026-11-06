// Generated from runtime/alpha3/src/core/roleplay-author-browser.ts; edit the TypeScript source.
/** Core owns attachment lifetime; the existing Native player owns every write.
 * Retained compiled DATA never reconstructs an attachment after Core disposal. */
import { randomUUID } from 'node:crypto';
import { jsonResponse } from './roleplay-state.js';
import { createRoleplayAuthorBrowserGeneration } from './roleplay-author-browser-generation.js';
import { authorMessageBodyRequestValid } from './roleplay-author-message-edit-types.js';
const sameBinding = (left, right) => left.browserSessionId === right.browserSessionId && left.generation === right.generation
    && left.sessionId === right.sessionId && left.programSha256 === right.programSha256;
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'BROWSER_ATTACHMENT_UNAVAILABLE';
export function createRoleplayAuthorBrowser(deps) {
    const attachments = new Map();
    const actionQueues = new Map();
    const waitingGenerations = new Set();
    let disposed = false;
    const fail = (code) => { throw Error(code); };
    const revoke = (value) => {
        for (const waiting of waitingGenerations)
            if (waiting.sessionId === value.binding.sessionId
                && waiting.programSha256 === value.program.programSha256)
                waiting.stop('BROWSER_ATTACHMENT_REVOKED');
        if (deps.cleanupPrompts) {
            deps.cleanupPrompts?.({ schemaVersion: 1, encoding: 'native-author-injection-cleanup-v1',
                sessionId: value.binding.sessionId, programSha256: value.program.programSha256, kind: 'resource-closed',
                resource: { browserSessionId: value.binding.browserSessionId, generation: value.binding.generation } });
        }
        attachments.delete(value.binding.browserSessionId);
        value.generationQueue?.dispose();
        deps.releaseOwner?.(value.current);
        if (value.sourceLifetime)
            deps.releaseOwner?.(value.sourceLifetime);
    };
    function retained(binding) {
        const value = attachments.get(binding.browserSessionId);
        if (!value || !sameBinding(value.binding, binding))
            return fail('BROWSER_ATTACHMENT_REVOKED');
        if (!value.current()) {
            revoke(value);
            return fail('BROWSER_ATTACHMENT_REVOKED');
        }
        return value;
    }
    function nativeRealm(value, realmId) {
        const realm = value.realms.get(realmId);
        if (!realm)
            return fail('AUTHOR_NATIVE_REALM_REVOKED');
        return realm;
    }
    function project(value, facts) {
        if (!value.current() || !facts.current() || facts.program.programSha256 !== value.program.programSha256) {
            return fail('BROWSER_ATTACHMENT_REVOKED');
        }
        // A later ordinary write must derive its ACK from this delivered cut.
        // Keep the original Source lifetime separately; adopting current DATA
        // cannot give that retained realm a replacement Source permission.
        value.facts = facts;
        value.resources = facts.resources;
        const data = facts.data, numerical = data.numerical;
        // These are the owning producers' existing identities. Polling an unchanged
        // cut must not manufacture a new write revision and stale an in-flight read.
        const identity = JSON.stringify([data.scopeFrame.frameSha256, data.ordinaryChat.root, data.ordinaryPublicationSeq,
            data.worldbook?.dataSha256, data.personas?.dataSha256, data.readonlyPreset?.fingerprint, numerical.kind, numerical.canEdit,
            'editBlockCode' in numerical ? numerical.editBlockCode : 'code' in numerical ? numerical.code : undefined]);
        if (value.lastSnapshot && value.snapshotIdentity === identity
            && value.lastSnapshot.avatarPaths?.user === data.avatarPaths?.user
            && value.lastSnapshot.avatarPaths?.character === data.avatarPaths?.character)
            return value.lastSnapshot;
        const snapshot = { ...data, generation: value.binding.generation, readRevision: ++value.readRevision };
        value.snapshotIdentity = identity;
        value.lastSnapshot = snapshot;
        return snapshot;
    }
    async function snapshot(value) {
        const facts = await deps.captureFacts(value.binding.sessionId);
        if (!facts)
            return fail('BROWSER_PROGRAM_UNAVAILABLE');
        return project(value, facts);
    }
    async function adoptCommittedFacts(value, sourceCurrent, kind = 'unchanged-source') {
        const sourceDataMutation = kind === 'source-data';
        if (!value.ownerCurrent() || !sourceDataMutation && !sourceCurrent())
            return undefined;
        const facts = kind === 'ordinary' && value.facts.captureOrdinarySuccessor
            ? value.facts.captureOrdinarySuccessor() : await deps.captureFacts(value.binding.sessionId);
        if (disposed || attachments.get(value.binding.browserSessionId) !== value || !value.ownerCurrent()
            || !sourceDataMutation && !sourceCurrent() || !facts || !facts.current()
            || facts.program.programSha256 !== value.program.programSha256)
            return undefined;
        // Only the actual successful writer calls this path. External changes must
        // pass retained(), whose old DATA currency still revokes the attachment.
        // Book/persona writers deliberately change their own DATA cut. Their actual
        // committed receipt may adopt fresh DATA for the exact same program/realm;
        // it cannot survive Stop, import, helper bytes or layout changes. Other
        // callers still require the original Source lifetime.
        value.facts = facts;
        value.resources = facts.resources;
        if (sourceDataMutation && value.sourceLifetime) {
            // Existing model requests keep their original content currency. Future
            // calls capture the newly accepted DATA instead of reusing that old cut.
            deps.releaseOwner?.(value.sourceLifetime);
            value.sourceLifetime = undefined;
        }
        return project(value, facts);
    }
    function originalSourceLifetime(value) {
        if (value.sourceLifetime)
            return value.sourceLifetime;
        const facts = value.facts;
        return value.sourceLifetime = () => !disposed && attachments.get(value.binding.browserSessionId) === value
            && value.ownerCurrent() && facts.sourceCurrent();
    }
    async function handleCurrent(input, signal) {
        if (disposed)
            return { ok: false, code: 'BROWSER_ATTACHMENT_REVOKED' };
        if (input.action === 'dispose') {
            const old = attachments.get(input.binding.browserSessionId);
            if (old && sameBinding(old.binding, input.binding))
                revoke(old);
            return { ok: true, kind: 'disposed' };
        }
        const sid = input.action === 'attach' || input.action === 'retry-worldbook' || input.action === 'retry-persona'
            || input.action === 'confirm-author-namespace' || input.action === 'confirm-message-body'
            ? input.sessionId : input.action === 'confirm' || input.action === 'retry'
            ? input.operation.sessionId : input.binding.sessionId;
        const session = await deps.resolveSession(sid);
        if (!session)
            return { ok: false, code: 'MVU_PLAYER_SESSION_INACTIVE' };
        if (input.action === 'confirm-message-body') {
            if (!deps.confirmMessageBody)
                return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_OWNER_UNAVAILABLE' };
            return { ok: true, kind: 'message-body-confirmed', result: await deps.confirmMessageBody(session.id, input.operationId) };
        }
        if (input.action === 'confirm-author-namespace') {
            if (!deps.confirmAuthorNamespace)
                return { ok: false, code: 'AUTHOR_CHAT_RECOVERY_UNAVAILABLE' };
            if (input.operation.namespace.sessionId !== session.id)
                return { ok: false, code: 'AUTHOR_CHAT_BINDING_CHANGED' };
            return { ok: true, kind: 'author-namespace-confirmed',
                receipt: await deps.confirmAuthorNamespace(session.id, input.operation) };
        }
        if (input.action === 'retry-worldbook') {
            const owner = deps.captureOwner(session.id);
            if (!owner || !deps.retryWorldbook)
                return { ok: false, code: 'AUTHOR_WORLDBOOK_UNAVAILABLE' };
            // This is the parent operator's explicit recovery. Its durable receipt
            // grants no readiness or continuation to the stopped author realm.
            return { ok: true, kind: 'worldbook-retried', result: await deps.retryWorldbook(session.id, input.operationId, owner, signal, input.locator) };
        }
        if (input.action === 'retry-persona') {
            const owner = deps.captureOwner(session.id);
            if (!owner || !deps.retryPersona)
                return { ok: false, code: 'NATIVE_PERSONA_UNAVAILABLE' };
            // Account receipts survive a stopped Worker. Manual lookup does not
            // apply a missing operation or restore the original author callback.
            return { ok: true, kind: 'persona-retried', result: deps.retryPersona(session.id, input.operationId, owner, signal) };
        }
        if (input.action === 'confirm') {
            // A page reload only asks the existing player for durable facts. Absence
            // of an operation cannot enter submit's new-operation reservation path.
            return { ok: true, kind: 'confirmed', result: await deps.confirm(input.operation) };
        }
        if (input.action === 'retry') {
            // This is the parent's explicit manual recovery command, using the same
            // Native player as the ordinary numerical editor. A lost child realm is
            // not an authority source; the actual Session/Agent and writer own it.
            const owner = deps.captureOwner(session.id);
            if (!owner)
                return { ok: false, code: 'MVU_PLAYER_SESSION_INACTIVE' };
            return { ok: true, kind: 'saved', result: await deps.submit(input.operation, owner) };
        }
        if (input.action === 'attach') {
            const owner = deps.captureOwner(session.id);
            if (!owner)
                return { ok: true, kind: 'inactive', code: 'BROWSER_SESSION_INACTIVE' };
            const facts = await deps.captureFacts(session.id);
            if (!facts)
                return { ok: true, kind: 'inactive', code: 'BROWSER_PROGRAM_UNAVAILABLE' };
            if (!owner() || !facts.current())
                return fail('BROWSER_ATTACHMENT_REVOKED');
            let value = input.binding ? attachments.get(input.binding.browserSessionId) : undefined;
            if (value && (value.binding.sessionId !== session.id || !sameBinding(value.binding, input.binding) || !value.current()
                || value.program.programSha256 !== facts.program.programSha256)) {
                revoke(value);
                value = undefined;
            }
            if (!value) {
                const binding = { browserSessionId: randomUUID(), generation: randomUUID(), sessionId: session.id,
                    programSha256: facts.program.programSha256 };
                const parentOrigins = await deps.acquireParentOrigins([...new Set(facts.program.realms.map(realm => realm.groupId))]);
                value = { binding, program: facts.program, parentOrigins, realms: new Map(facts.program.realms.map(realm => [realm.realmId, realm])),
                    readRevision: 0, facts, ownerCurrent: owner,
                    resources: facts.resources,
                    current: () => !disposed && value !== undefined && attachments.get(binding.browserSessionId) === value
                        && value.ownerCurrent() && value.facts.current() };
                attachments.set(binding.browserSessionId, value);
                value.generationQueue = createRoleplayAuthorBrowserGeneration({
                    binding, program: facts.program, current: value.current
                });
            }
            return { ok: true, kind: 'attached', attachment: { schemaVersion: 1, encoding: 'author-native-helper-attachment-v1',
                    binding: value.binding, program: value.program, parentOrigins: value.parentOrigins, snapshot: project(value, facts) } };
        }
        const value = retained(input.binding);
        if (input.action === 'mutate-message-body' || input.action === 'retry-message-body') {
            if (!deps.editMessageBody)
                return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_OWNER_UNAVAILABLE' };
            const realm = nativeRealm(value, input.realmId), request = input.request;
            if (!authorMessageBodyRequestValid(request))
                return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_REQUEST_INVALID' };
            if (input.action === 'mutate-message-body') {
                const snapshot = input.read.kind === 'generation' ? value.generationQueue?.snapshotFor(input.read.invocationId)
                    : value.lastSnapshot?.readRevision === input.read.readRevision ? value.lastSnapshot : undefined, expected = request.expected, row = snapshot?.messages.find(message => message.nativeSeq === expected.seq
                    && message.messageId === expected.messageId);
                if (!snapshot || snapshot.readRevision !== request.readRevision || !row || row.nativeSeq === null
                    || expected.sessionId !== session.id || row.role !== expected.role
                    || row.messageVersionSha256 !== expected.messageVersionSha256)
                    return { ok: false, code: 'READER_READ_BASIS_CHANGED' };
                if (row.variants || row.ordinary?.selectedTarget.identity.variant.kind === 'opening-variant')
                    return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_OPENING_VARIANTS_REQUIRED' };
            }
            else {
                if (input.sourceProgramSha256 !== value.program.programSha256)
                    return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_SOURCE_CHANGED' };
                const row = value.lastSnapshot?.messages.find(message => message.nativeSeq === request.expected.seq
                    && message.messageId === request.expected.messageId);
                if (row?.variants || row?.ordinary?.selectedTarget.identity.variant.kind === 'opening-variant')
                    return { ok: false, code: 'AUTHOR_MESSAGE_EDIT_OPENING_VARIANTS_REQUIRED' };
            }
            const sourceCurrent = originalSourceLifetime(value), source = value.program.source, result = await deps.editMessageBody(session.id, { schemaVersion: 1, operationId: request.operationId,
                expected: request.expected, text: request.text, origin: { sourceRecordSessionId: source.sourceRecordSessionId,
                    importId: source.importId, rawSha256: source.sourceSha256, realmId: realm.realmId, groupId: realm.groupId } }, sourceCurrent, signal);
            if (result.kind !== 'committed' && result.kind !== 'unchanged')
                return { ok: true, kind: 'message-body-mutated', result };
            if (result.kind === 'unchanged')
                return { ok: true, kind: 'message-body-mutated', result,
                    ...value.current() && value.lastSnapshot ? { snapshot: value.lastSnapshot } : {} };
            try {
                const snapshot = await adoptCommittedFacts(value, sourceCurrent);
                return { ok: true, kind: 'message-body-mutated', result, ...snapshot ? { snapshot } : {} };
            }
            catch {
                return { ok: true, kind: 'message-body-mutated', result };
            }
        }
        if (input.action === 'execute-commands') {
            const realm = nativeRealm(value, input.realmId);
            if (!deps.commands)
                return { ok: false, code: 'AUTHOR_NATIVE_COMMANDS_UNAVAILABLE' };
            const sourceCurrent = originalSourceLifetime(value);
            const result = await deps.commands(session.id, `helper:${value.program.programSha256}:${realm.realmId}`, input.request, sourceCurrent, signal);
            // Publication may invalidate old DATA. Its real receipt remains valid;
            // only the original live Source can adopt a successor for this realm.
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent);
                return { ok: true, kind: 'commands-executed', result, ...refreshed ? { snapshot: refreshed } : {} };
            }
            catch {
                return { ok: true, kind: 'commands-executed', result };
            }
        }
        if (input.action === 'mutate-opening-variants') {
            nativeRealm(value, input.realmId);
            const snapshot = input.read.kind === 'generation' ? value.generationQueue?.snapshotFor(input.read.invocationId)
                : value.lastSnapshot?.readRevision === input.read.readRevision ? value.lastSnapshot : undefined, first = snapshot?.messages[0];
            if (!snapshot || snapshot.readRevision !== input.request.readRevision || first?.nativeSeq === null || !first)
                return { ok: false, code: 'READER_READ_BASIS_CHANGED' };
            const sourceCurrent = originalSourceLifetime(value), capture = {
                binding: value.binding, snapshot, openingMessage: { seq: first.nativeSeq, messageId: first.messageId,
                    messageVersionSha256: first.messageVersionSha256 }, current: value.current, sourceCurrent
            };
            const result = await deps.mutateOpeningVariants(capture, input.request, signal);
            if (result.kind !== 'committed')
                return { ok: true, kind: 'opening-variants-mutated', result };
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent);
                return { ok: true, kind: 'opening-variants-mutated', result, ...refreshed ? { snapshot: refreshed } : {} };
            }
            catch {
                return { ok: true, kind: 'opening-variants-mutated', result };
            }
        }
        if (input.action === 'mutate-prompts') {
            const realm = nativeRealm(value, input.request.realmId), resource = input.request.resource;
            if (resource.browserSessionId !== value.binding.browserSessionId || resource.generation !== value.binding.generation)
                return { ok: false, code: 'BROWSER_ATTACHMENT_REVOKED' };
            if (!deps.mutatePrompts)
                return { ok: false, code: 'AUTHOR_NATIVE_INJECTION_UNAVAILABLE' };
            const sourceCurrent = originalSourceLifetime(value);
            const reply = await deps.mutatePrompts({ sessionId: value.binding.sessionId, program: value.program, realm,
                binding: value.binding, request: input.request, current: sourceCurrent, signal });
            let refreshed;
            try {
                refreshed = await adoptCommittedFacts(value, sourceCurrent);
            }
            catch { }
            return { ok: true, kind: 'prompts-mutated', ...reply, ...refreshed ? { snapshot: refreshed } : {} };
        }
        if (input.action === 'filter-complete') {
            value.generationQueue.completeFilter(input.result);
            return { ok: true, kind: 'generation-acknowledged' };
        }
        if (input.action === 'cleanup-prompts') {
            const program = value.program, request = input.request, resource = request.resource;
            if (!deps.cleanupPrompts)
                return { ok: false, code: 'BROWSER_PROMPT_CLEANUP_UNAVAILABLE' };
            if (resource.browserSessionId !== value.binding.browserSessionId || resource.generation !== value.binding.generation)
                return { ok: false, code: 'BROWSER_ATTACHMENT_REVOKED' };
            // Admission, Native append, and resource retirement share this short
            // synchronous owner cut. Main waits outside it; its old capture is
            // invalidated by the existing Native feed before a late result publishes.
            const sourceCurrent = originalSourceLifetime(value);
            const removesPrompts = request.kind === 'resource-closed' || request.ids.length > 0;
            if (removesPrompts)
                deps.cleanupPrompts({ schemaVersion: 1, encoding: 'native-author-injection-cleanup-v1',
                    sessionId: value.binding.sessionId, programSha256: program.programSha256, ...request });
            if (request.kind === 'resource-closed')
                value.generationQueue?.retireResource(resource.pageId);
            // A Native append is already accepted even if the Source disappears
            // while fresh DATA is being captured, just like an author-key receipt.
            if (removesPrompts)
                try {
                    await adoptCommittedFacts(value, sourceCurrent);
                }
                catch { }
            return { ok: true, kind: 'prompts-cleaned' };
        }
        if (input.action === 'retry-author-namespace') {
            if (!deps.retryAuthorNamespace)
                return { ok: false, code: 'AUTHOR_CHAT_RECOVERY_UNAVAILABLE' };
            const sourceCurrent = originalSourceLifetime(value);
            const reply = await deps.retryAuthorNamespace(session.id, value.program, nativeRealm(value, input.realmId), input.operation, sourceCurrent, signal);
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent, 'ordinary');
                return { ok: true, kind: 'author-namespace-mutated', reply, ...refreshed ? { snapshot: refreshed } : {} };
            }
            catch {
                return { ok: true, kind: 'author-namespace-mutated', reply };
            }
        }
        if (input.action === 'mutate-author-namespace') {
            if (!deps.mutateAuthorNamespace)
                return { ok: false, code: 'AUTHOR_CHAT_DECLARATION_UNAVAILABLE' };
            const request = input.request, read = request.read;
            const basis = read.kind === 'generation' ? value.generationQueue?.snapshotFor(read.invocationId)
                : value.lastSnapshot?.readRevision === read.readRevision ? value.lastSnapshot : undefined;
            // A posted revision locates the actual snapshot that was sent. A stale
            // async result never silently adopts a newer DATA basis.
            if (!basis)
                return { ok: false, code: 'AUTHOR_CHAT_READ_BASIS_CHANGED' };
            const sourceCurrent = originalSourceLifetime(value);
            const reply = await deps.mutateAuthorNamespace(session.id, value.program, nativeRealm(value, request.realmId), request, basis, sourceCurrent, signal);
            if (reply.kind === 'no-update')
                return { ok: true, kind: 'author-namespace-mutated', reply,
                    ...value.current() && value.lastSnapshot ? { snapshot: value.lastSnapshot } : {} };
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent, 'ordinary');
                return { ok: true, kind: 'author-namespace-mutated', reply, ...refreshed ? { snapshot: refreshed } : {} };
            }
            catch {
                return { ok: true, kind: 'author-namespace-mutated', reply };
            }
        }
        if (input.action === 'mutate-persona') {
            const program = value.program;
            if (!value.facts.data.personas || !deps.mutatePersona)
                return { ok: false, code: 'NATIVE_PERSONA_UNAVAILABLE' };
            const realm = nativeRealm(value, input.request.realmId);
            const sourceCurrent = originalSourceLifetime(value);
            if (!sourceCurrent())
                return fail('BROWSER_ATTACHMENT_REVOKED');
            // Native persistence may itself invalidate Source. Its writer retains
            // the original Native owner; Source3 only admits and adopts this realm.
            const result = deps.mutatePersona(session.id, program, realm, input.request, value.ownerCurrent, signal, value.generationQueue?.sourceDataFor(realm.realmId));
            if (result.kind !== 'committed')
                return { ok: true, kind: 'persona-mutated', reply: { result } };
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent, 'source-data');
                return { ok: true, kind: 'persona-mutated', reply: { result, ...refreshed ? { snapshot: refreshed } : {} } };
            }
            catch {
                return { ok: true, kind: 'persona-mutated', reply: { result } };
            }
        }
        if (input.action === 'mutate-worldbook') {
            const program = value.program, basis = value.facts.worldbook;
            if (!basis || !deps.mutateWorldbook)
                return { ok: false, code: 'AUTHOR_WORLDBOOK_UNAVAILABLE' };
            nativeRealm(value, input.request.realmId);
            const sourceCurrent = originalSourceLifetime(value);
            if (!sourceCurrent())
                return fail('BROWSER_ATTACHMENT_REVOKED');
            // The existing journal owns Source/head publication under its FIFO.
            // Its own writes must not turn a captured DATA proof into writer Stop.
            const reply = await deps.mutateWorldbook(session.id, program, input.request, basis, value.ownerCurrent, signal, value.generationQueue?.sourceDataFor(input.request.realmId));
            if (reply.result.kind !== 'edited-data')
                return { ok: true, kind: 'worldbook-mutated', reply };
            try {
                const refreshed = await adoptCommittedFacts(value, sourceCurrent, 'source-data');
                return { ok: true, kind: 'worldbook-mutated', reply: { ...reply, ...refreshed ? { snapshot: refreshed } : {} } };
            }
            catch {
                return { ok: true, kind: 'worldbook-mutated', reply };
            }
        }
        if (input.action === 'read-source-resource') {
            if (!value.resources)
                return { ok: false, code: 'AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE' };
            nativeRealm(value, input.request.realmId);
            // This read is synchronous after the attachment's live Source/Session/Stop
            // check. Resource addressing never creates a second permission owner.
            return { ok: true, kind: 'source-resource', value: value.resources.read(input.request) };
        }
        if (input.action === 'capture')
            return { ok: true, kind: 'snapshot', snapshot: await snapshot(value) };
        if (input.action === 'generation-wait') {
            if (!value.generationQueue)
                return { ok: false, code: 'BROWSER_GENERATION_UNAVAILABLE' };
            const reader = value.generationQueue.wait(input.binding, input.registrations, signal);
            // wait() installs the real Reader synchronously. Hand it to one matching
            // preparation now, before an asynchronous readiness notification can race.
            const waiting = [...waitingGenerations].find(row => row.sessionId === value.binding.sessionId
                && row.programSha256 === value.program.programSha256);
            if (value.generationQueue.hasReader())
                waiting?.start(value);
            const invocation = await reader;
            return { ok: true, kind: 'generation-invocation', invocation };
        }
        if (input.action === 'generation-complete') {
            if (!sameBinding(input.binding, input.result.binding) || !value.generationQueue)
                return { ok: false, code: 'BROWSER_GENERATION_UNAVAILABLE' };
            value.generationQueue.complete(input.result);
            return { ok: true, kind: 'generation-acknowledged' };
        }
        if (input.action === 'mvu-hook-complete') {
            if (!sameBinding(input.binding, input.result.binding) || !value.generationQueue)
                return { ok: false, code: 'BROWSER_GENERATION_UNAVAILABLE' };
            value.generationQueue.completeHook(input.result);
            return { ok: true, kind: 'generation-acknowledged' };
        }
        if (input.action === 'generate-raw') {
            const program = value.program;
            const realm = nativeRealm(value, input.request.realmId);
            if (!deps.generateRaw)
                return { ok: false, code: 'BROWSER_GENERATION_UNAVAILABLE' };
            const current = originalSourceLifetime(value);
            return { ok: true, kind: 'generated', result: await deps.generateRaw(session.id, program, realm, input.request, current, signal) };
        }
        if (input.action !== 'save')
            return { ok: false, code: 'BROWSER_REQUEST_INVALID' };
        const request = input.request, operation = input.operation;
        nativeRealm(value, request.realmId);
        if (request.generation !== value.binding.generation
            || operation.sessionId !== value.binding.sessionId || operation.schemaVersion !== 1 || operation.action !== 'replace-values') {
            return { ok: false, code: 'BROWSER_NUMERICAL_REQUEST_INVALID' };
        }
        // No await lies between this live attachment check and entering the actual
        // writer. Its own Native reservation/Source boundary decides publication.
        if (!value.current())
            return fail('BROWSER_ATTACHMENT_REVOKED');
        const result = await deps.submit(operation, value.current);
        // A committed operation survives a later revocation. Return its receipt so
        // parent storage can confirm it, without publishing readiness to a new realm.
        if (!value.current())
            return { ok: true, kind: 'saved', result };
        try {
            const captured = await snapshot(value);
            // This signal follows the real numerical writer's new durable update and
            // the same Source's after-capture. It carries no fabricated MvuData and
            // does not claim the library's precommit variable-editing callback phase.
            return { ok: true, kind: 'saved', result, snapshot: captured,
                ...result.operation?.outcome === 'updated' && !result.operation.replayed
                    ? { sourceEvents: [{ type: 'nexttavern_numerical_updated', args: [] }] } : {} };
        }
        catch {
            return { ok: true, kind: 'saved', result };
        }
    }
    function handle(input, signal = new AbortController().signal) {
        const binding = 'binding' in input ? input.binding : undefined;
        if (!binding || input.action === 'dispose')
            return handleCurrent(input, signal);
        const key = binding.browserSessionId, previous = actionQueues.get(key) ?? Promise.resolve();
        // A self-authored intent dirties the old facts until its actual receipt is
        // adopted. Bound reads and writes wait together, then use retained() once.
        // Long generation calls only wait for admission: holding their queue would
        // prevent the callback's own RPC or completion from ever being delivered.
        const result = previous.then(() => handleCurrent(input, signal));
        if (input.action === 'generation-wait' || input.action === 'generation-complete' || input.action === 'mvu-hook-complete' || input.action === 'filter-complete' || input.action === 'generate-raw'
            || input.action === 'execute-commands')
            return result;
        const settled = result.then(() => { }, () => { });
        actionQueues.set(key, settled);
        void settled.then(() => { if (actionQueues.get(key) === settled)
            actionQueues.delete(key); });
        return result;
    }
    deps.ctx.effect(() => deps.ctx.connection.fetch.register({ path: '/api/roleplay/author-browser',
        methods: ['POST'], requestBody: 'buffered', fetch: async (request) => {
            try {
                const text = await request.text();
                if (Buffer.byteLength(text, 'utf8') > 2 * 1048576)
                    return jsonResponse(413, { ok: false, code: 'MVU_PLAYER_DATA_LIMIT' });
                let input;
                try {
                    input = JSON.parse(text);
                }
                catch {
                    return jsonResponse(400, { ok: false, code: 'BROWSER_REQUEST_INVALID' });
                }
                if (!input || !['attach', 'capture', 'save', 'confirm', 'retry', 'dispose', 'mutate-opening-variants', 'generation-wait', 'generation-complete',
                    'mvu-hook-complete', 'generate-raw', 'execute-commands', 'read-source-resource', 'mutate-worldbook', 'retry-worldbook',
                    'mutate-persona', 'retry-persona', 'cleanup-prompts', 'mutate-prompts', 'filter-complete',
                    'mutate-message-body', 'confirm-message-body', 'retry-message-body',
                    'mutate-author-namespace', 'confirm-author-namespace', 'retry-author-namespace'].includes(input.action)) {
                    return jsonResponse(400, { ok: false, code: 'BROWSER_REQUEST_INVALID' });
                }
                const result = await handle(input, request.signal);
                return jsonResponse(result.ok ? 200 : 409, result);
            }
            catch (error) {
                return jsonResponse(409, { ok: false, code: codeOf(error) });
            }
        } }), 'roleplay: owned author browser attachment');
    const invalidateSession = (sid) => {
        for (const waiting of waitingGenerations)
            if (waiting.sessionId === sid)
                waiting.stop('BROWSER_ATTACHMENT_REVOKED');
        for (const value of attachments.values())
            if (value.binding.sessionId === sid)
                revoke(value);
    };
    async function invokeGeneration(sid, program, capture, facts, signal, sourceData) {
        if (disposed)
            return fail('BROWSER_ATTACHMENT_REVOKED');
        const invoke = (value) => {
            const common = {
                generation: value.binding.generation, readRevision: ++value.readRevision,
                basis: { sessionId: sid, sourceSnapshotSha256: capture.sourceSnapshotSha256, ...facts.basis,
                    nativeCut: capture.nativeCut, nativePrefixSha256: capture.nativePrefixSha256 },
                scopeFrame: facts.scopes, messages: capture.messages, numerical: facts.numerical,
                persona: facts.persona,
                ...value.facts.data.personas
                    ? { personas: value.facts.data.personas } : {},
                ...value.facts.data.character
                    ? { character: value.facts.data.character } : {},
                ...value.facts.data.worldbook
                    ? { worldbook: value.facts.data.worldbook } : {},
                ...value.facts.data.avatarPaths ? { avatarPaths: value.facts.data.avatarPaths } : {},
                ...value.facts.data.tavernRegexes ? { tavernRegexes: value.facts.data.tavernRegexes } : {},
                ...value.facts.data.readonlyPreset ? { readonlyPreset: value.facts.data.readonlyPreset } : {}
            };
            const snapshot = { ...common, schemaVersion: 1, encoding: 'author-native-helper-snapshot-v1',
                ordinaryChat: facts.ordinaryChat, ...facts.ordinaryMessages ? { ordinaryMessages: facts.ordinaryMessages } : {},
                ordinaryPublicationSeq: value.facts.data.ordinaryPublicationSeq,
                context: value.facts.data.context };
            // The challenge becomes the realm's current read snapshot after its
            // generation callback finishes. Retain that exact server-owned basis for
            // subsequent SDK writes; the previous capture's cache key no longer fits.
            value.lastSnapshot = snapshot;
            value.snapshotIdentity = undefined;
            return value.generationQueue.invoke({ attemptId: capture.attemptId, capture, snapshot }, signal, sourceData);
        };
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                if (!waitingGenerations.delete(waiting))
                    return false;
                signal.removeEventListener('abort', abort);
                return true;
            };
            const abort = () => waiting.stop('BROWSER_GENERATION_CANCELLED');
            const waiting = { sessionId: sid, programSha256: program.programSha256,
                start(value) {
                    if (!cleanup())
                        return;
                    try {
                        resolve(invoke(value));
                    }
                    catch (error) {
                        reject(error);
                    }
                },
                stop(code) { if (cleanup())
                    reject(Error(code)); } };
            waitingGenerations.add(waiting);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted)
                abort();
            else {
                const value = [...attachments.values()].find(row => row.binding.sessionId === sid
                    && row.program.programSha256 === program.programSha256 && row.current() && row.generationQueue?.hasReader());
                if (value)
                    waiting.start(value);
            }
        });
    }
    const prepareHook = async (request, signal) => {
        const value = [...attachments.values()].find(row => row.binding.sessionId === request.sessionId && row.current());
        return value?.generationQueue?.prepareHook(request, signal);
    };
    const invokeFilter = (binding, input, signal, sourceData) => retained(binding).generationQueue.invokeFilter(input, signal, sourceData);
    const retireFilterCallbacks = (binding, realmId, resource, ids) => {
        // Retirement only releases Guest closures. A writer may have just changed
        // its DATA basis before adoptCommittedFacts; do not revoke its attachment
        // merely to deliver a release notification during that ACK.
        const value = attachments.get(binding.browserSessionId);
        if (!value || !sameBinding(value.binding, binding))
            return;
        nativeRealm(value, realmId);
        value.generationQueue.retireFilterCallbacks({ encoding: 'author-native-injection-filter-retired-v1', realmId, resource, ids });
    };
    return { handle, invokeGeneration, invokeFilter, retireFilterCallbacks, prepareHook, invalidateSession, dispose: () => {
            disposed = true;
            for (const waiting of waitingGenerations)
                waiting.stop('BROWSER_ATTACHMENT_REVOKED');
            for (const value of attachments.values())
                revoke(value);
        } };
}
