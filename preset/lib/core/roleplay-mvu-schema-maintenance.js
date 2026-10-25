// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-maintenance.ts; edit the TypeScript source.
/** One admitted Story obligation proposes variables and decision options. It
 * never applies an operation or owns a numerical publication/closing lease. */
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { canonicalAssistantForTurn } from './roleplay-context.js';
import { maintenancePrompt, InlinePending } from './tavern-task-context.js';
import { isInlinePending, untilAborted } from './tavern-task-primitives.js';
import { taskCancellation } from './roleplay-decision.js';
import { parseMvuSchemaStoryCandidateV2 } from './roleplay-mvu-schema-story-types.js';
import { mvuSchemaMaintenanceAdmissionKey, mvuSchemaMaintenanceBasisKey, mvuSchemaMaintenanceTaskKey, sealMvuSchemaMaintenanceData, normalizeMvuSchemaMaintenanceResultV1 } from './roleplay-mvu-schema-maintenance-types.js';
const system = '你是当前 Native-schema 剧情回合的变量与选项维护助手。只处理已冻结的真实作者规则、'
    + '原 schema values 和本轮已发生正文，不续写剧情，不输出状态栏、fields、time 或 HTML。'
    + '变量只提出候选，由原 schema owner 校验并结算；选项只是可能行动，不能当作已发生事实。'
    + '仅输出本任务要求的严格 JSON；非法结果会终止本次任务，不另起修复或研究请求。';
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail(code) { throw Error(code); }
function canonical(event) {
    const message = event.data?.message;
    if (!message || typeof message.id !== 'string')
        fail('SCHEMA_MAINTENANCE_CANONICAL_UNPROVEN');
    const narrative = textOf(message.content);
    return { seq: event.seq, messageId: message.id, versionSha256: recordSha256(message), narrative, narrativeSha256: sha256(narrative) };
}
export function createRoleplayMvuSchemaMaintenance(deps) {
    const jobs = new Map();
    async function putExact(key, value) {
        const prior = deps.table.get(key);
        if (prior !== undefined && !same(prior, value))
            fail('SCHEMA_MAINTENANCE_IDENTITY_CONFLICT');
        if (prior === undefined)
            await deps.table.put(key, value);
    }
    async function admitNewWork(work) {
        if (work.source.kind !== 'story' || work.source.headRef?.kind !== 'schema-head' || !deps.eligible(work.sessionId))
            return;
        const admission = sealMvuSchemaMaintenanceData({ schemaVersion: 1,
            encoding: 'native-mvu-schema-maintenance-admission-v1', sessionId: work.sessionId,
            preparationId: work.preparationId, credentialSha256: work.credentialSha256, receiptGeneration: work.receiptGeneration,
            refs: work.refs, source: work.source }, 'admissionSha256');
        await putExact(mvuSchemaMaintenanceAdmissionKey(work.sessionId, work.preparationId), admission);
    }
    function readAdmission(work) {
        const raw = deps.table.get(mvuSchemaMaintenanceAdmissionKey(work.sessionId, work.currency.preparationId));
        if (raw === undefined)
            return undefined;
        const admission = raw;
        if (admission.encoding !== 'native-mvu-schema-maintenance-admission-v1'
            || admission.sessionId !== work.sessionId || admission.preparationId !== work.currency.preparationId
            || admission.credentialSha256 !== work.currency.credentialSha256)
            fail('SCHEMA_MAINTENANCE_ADMISSION_CHANGED');
        return admission;
    }
    function readBasis(sessionId, seq) {
        return deps.table.get(mvuSchemaMaintenanceBasisKey(sessionId, seq));
    }
    function handles(session, event) {
        if (!event)
            return false;
        if (readBasis(session.id, event.seq))
            return true;
        const work = deps.work(session, Number(event.data?.turn));
        return !!work && !!readAdmission(work);
    }
    async function captureBasis(session, event) {
        if (canonicalAssistantForTurn(session, event.data?.turn)?.seq !== event.seq)
            fail('SCHEMA_MAINTENANCE_CANONICAL_CHANGED');
        const work = deps.work(session, Number(event.data?.turn)), body = canonical(event);
        if (!work)
            fail('SCHEMA_MAINTENANCE_WORK_UNPROVEN');
        const admission = readAdmission(work);
        if (!admission)
            fail('SCHEMA_MAINTENANCE_ADMISSION_MISSING');
        const schema = deps.base(work);
        if (!schema)
            fail('SCHEMA_MAINTENANCE_BASE_UNPROVEN');
        const candidate = parseMvuSchemaStoryCandidateV2(body.narrative, schema.parserPolicy);
        if (candidate.kind === 'rejected')
            fail('SCHEMA_STORY_CANDIDATE_REJECTED');
        const prior = readBasis(session.id, event.seq);
        if (prior) {
            const { narrative: _text, ...reference } = body;
            if (!same(prior.canonical, reference) || !same(prior.currency, work.currency)
                || prior.baseStateSnapshotSha256 !== schema.base.stateSnapshotSha256)
                fail('SCHEMA_MAINTENANCE_BASIS_CHANGED');
            // The immutable published material is selected by the sealed original
            // ref, rather than whichever later maintenance step is now most recent.
            return { work, admission, basis: prior, body, base: schema.base, material: deps.material(session, event, work) };
        }
        const material = deps.material(session, event, work), { narrative: _text, ...reference } = body;
        const basis = sealMvuSchemaMaintenanceData({ schemaVersion: 1,
            encoding: 'native-mvu-schema-maintenance-basis-v1', sessionId: session.id,
            admissionSha256: admission.admissionSha256, currency: work.currency, workSha256: work.checkpoint.workSha256,
            turn: work.checkpoint.actualTurn, canonical: reference, baseStateSnapshotSha256: schema.base.stateSnapshotSha256,
            material: material.reference, candidateKind: candidate.kind }, 'basisSha256');
        await putExact(mvuSchemaMaintenanceBasisKey(session.id, event.seq), basis);
        return { work, admission, basis, body, base: schema.base, material };
    }
    function taskBinding(sessionId, seq) {
        return deps.table.get(mvuSchemaMaintenanceTaskKey(sessionId, seq));
    }
    function completedTask(sessionId, seq, basis) {
        const binding = taskBinding(sessionId, seq);
        if (!binding || binding.basisSha256 !== basis.basisSha256)
            fail('SCHEMA_MAINTENANCE_TASK_MISSING');
        const job = deps.table.get('tavern_job__' + binding.taskId);
        if (!job || job.sessionId !== sessionId || job.kind !== 'schema-maintenance' || job.generation !== binding.generation)
            fail('SCHEMA_MAINTENANCE_TASK_REVOKED');
        if (job.status === 'failed')
            fail('SCHEMA_MAINTENANCE_TASK_FAILED');
        if (job.status === 'cancelled' || job.status === 'stale')
            fail('SCHEMA_MAINTENANCE_TASK_REVOKED');
        if (job.status !== 'completed')
            throw new InlinePending(job.id);
        if (typeof job.resultHash !== 'string')
            fail('SCHEMA_MAINTENANCE_RESULT_UNPROVEN');
        return { job, result: job.result };
    }
    function run(session, event, agent, signal) {
        const key = mvuSchemaMaintenanceBasisKey(session.id, event.seq), existing = jobs.get(key);
        if (existing) {
            existing.cancellation.follow(signal);
            return existing;
        }
        const cancellation = taskCancellation(signal);
        let admitted;
        const admission = new Promise(resolve => { admitted = resolve; });
        const job = Promise.resolve().then(async () => {
            const prior = readBasis(session.id, event.seq), binding = taskBinding(session.id, event.seq);
            if (prior && binding) {
                const work = deps.work(session, Number(event.data?.turn)), { narrative: _text, ...reference } = canonical(event);
                if (!work || !same(prior.currency, work.currency) || !same(prior.canonical, reference))
                    fail('SCHEMA_MAINTENANCE_BASIS_CHANGED');
                const task = deps.table.get('tavern_job__' + binding.taskId), pendingSuccessor = task && task.generation !== binding.generation && ['queued', 'running'].includes(task.status);
                // Tavern alone creates a fallback/retry generation. Re-enter its real
                // request to validate that pending task and bind the new admission;
                // never consume a completed result under the predecessor binding.
                if (!pendingSuccessor)
                    try {
                        const completed = completedTask(session.id, event.seq, prior);
                        admitted(completed.job);
                        return { kind: 'schema-maintenance', state: 'completed' };
                    }
                    catch (error) {
                        if (!isInlinePending(error))
                            throw error;
                    }
            }
            const capture = await captureBasis(session, event), { basis, base, body, material } = capture, selection = await deps.selection(session, agent);
            const context = { authorGroups: material.authorGroups, finalLore: material.finalLore,
                currentValues: base.values, completedStory: body.narrative };
            const contract = basis.candidateKind === 'parsed'
                ? '正文已经包含有效变量更新候选，本任务不得再推断或输出 variableCandidate，只输出 '
                    + '{"schemaVersion":1,"options":[{"label":"行动","heart":false,"description":"可选简述"}]}。'
                : '正文没有变量更新容器。本任务必须根据真实作者规则、当前 values 和已经发生的正文明确结算：'
                    + '需要变化时输出 {"schemaVersion":1,"variableCandidate":{"kind":"patch","operations":['
                    + '{"kind":"jsonpatch","operation":{"op":"replace","path":"/真实路径","value":"真实值"}}]},'
                    + '"options":[{"label":"行动","heart":false,"description":"可选简述"}]}；'
                    + 'operations 必须非空，可使用已声明的 normalized JSONPatch/legacy 命令。'
                    + '确实没有变化时必须显式使用 "variableCandidate":{"kind":"unchanged"}。'
                    + '不可省略 candidate，不以 options/fields/时间描述代替变量候选。';
            const request = { session, agent, kind: 'schema-maintenance', format: 'json', system,
                ...maintenancePrompt(context, '本轮实际已投递作者贡献与 schema 基线：\n', '\n\n' + contract + ' options 须为1至3项，label最多60字，description最多120字；不执行选项。', 'schema-maintenance'),
                source: { events: [{ seq: event.seq, hash: body.narrativeSha256 }], schemaMaintenance: { basisSha256: basis.basisSha256 } },
                selection, signal: cancellation.signal, taskStage: 'schema-maintenance-v1', maxTokens: 6000, timeoutMs: 45000,
                validationFailurePolicy: 'terminal',
                validate: value => normalizeMvuSchemaMaintenanceResultV1(value, basis.candidateKind),
                onAdmission: async (task) => {
                    const binding = { schemaVersion: 1,
                        encoding: 'native-mvu-schema-maintenance-task-binding-v1', basisSha256: basis.basisSha256,
                        taskId: task.id, generation: task.generation, selection: { execution: task.execution, main: task.main, actualRoute: task.actualRoute } };
                    const bindingKey = mvuSchemaMaintenanceTaskKey(session.id, event.seq);
                    if (!same(deps.table.get(bindingKey), binding))
                        await deps.table.put(bindingKey, binding);
                    admitted(task);
                },
            };
            try {
                await deps.request(request);
                completedTask(session.id, event.seq, basis);
                return { kind: 'schema-maintenance', state: 'completed' };
            }
            catch (error) {
                if (isInlinePending(error)) {
                    const binding = taskBinding(session.id, event.seq), pending = binding
                        && deps.table.get('tavern_job__' + binding.taskId);
                    if (binding && pending && pending.generation !== binding.generation && ['queued', 'running'].includes(pending.status)) {
                        // A spawned request may fall back before Main can submit the new
                        // inline generation. Bind through that same request owner now.
                        try {
                            await deps.request(request);
                        }
                        catch (next) {
                            if (!isInlinePending(next))
                                throw next;
                        }
                    }
                    return { kind: 'schema-maintenance', state: 'waiting-main' };
                }
                throw error;
            }
        }).finally(() => {
            admitted(null);
            cancellation.dispose();
            if (jobs.get(key) === job)
                jobs.delete(key);
        });
        job.admission = admission;
        job.cancellation = cancellation;
        jobs.set(key, job);
        return job;
    }
    async function waitActive(sessionId, seq, signal) {
        const job = jobs.get(mvuSchemaMaintenanceBasisKey(sessionId, seq));
        if (job)
            await (signal ? untilAborted(job, signal) : job);
    }
    async function completion(scope, body, signal) {
        const sid = scope.receipt.checkpoint.sessionId, raw = deps.table.get(mvuSchemaMaintenanceAdmissionKey(sid, scope.currency.preparationId));
        if (raw === undefined)
            return undefined;
        const admission = raw;
        await waitActive(sid, body.seq, signal);
        const basis = readBasis(sid, body.seq);
        if (!basis)
            fail('SCHEMA_MAINTENANCE_BASIS_MISSING');
        const { job, result } = completedTask(sid, body.seq, basis);
        return { schemaVersion: 1, encoding: 'native-mvu-schema-maintenance-candidate-source-v1',
            kind: basis.candidateKind === 'parsed' ? 'canonical' : 'task-result', admission, basis,
            task: { taskId: job.id, generation: job.generation, resultHash: job.resultHash,
                actualRoute: job.actualRoute, execution: job.execution }, result };
    }
    function decision(session, event, onAdmission, signal) {
        if (!handles(session, event))
            return undefined;
        // The loop may still hold the child admission batch. Release that gate
        // before awaiting this same task; inline work yields instead of self-waiting.
        onAdmission();
        return (async () => {
            await waitActive(session.id, event.seq, signal);
            const basis = readBasis(session.id, event.seq);
            if (!basis)
                fail('SCHEMA_MAINTENANCE_BASIS_MISSING');
            const { job, result } = completedTask(session.id, event.seq, basis);
            return { options: result.options, provenance: { taskId: job.id, generation: job.generation,
                    actualRoute: job.actualRoute, execution: job.execution, reusedFrom: 'schema-maintenance' } };
        })();
    }
    return { admitNewWork, handles, run, completion, decision };
}
