// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-maintenance-types.ts; edit the TypeScript source.
/** Sealed DATA for a newly admitted schema Story obligation. These facts can
 * explain cold/fork history; only the original input/closing owners can write. */
import { recordSha256 } from './roleplay-data.js';
import { taskHash } from './tavern-task-primitives.js';
import { normalizeStatusOption } from './roleplay-status-presentation.js';
import { assertMvu196CommandsV1 } from './tavern-mvu-update-protocol-v1.js';
export const mvuSchemaMaintenanceAdmissionKey = (sid, preparationId) => `${sid}__mvu-schema-maintenance-admission-${preparationId}`;
export const mvuSchemaMaintenanceBasisKey = (sid, seq) => `${sid}__mvu-schema-maintenance-basis-${seq}`;
export const mvuSchemaMaintenanceTaskKey = (sid, seq) => `${sid}__mvu-schema-maintenance-task-${seq}`;
export function sealMvuSchemaMaintenanceData(body, field) {
    return { ...body, [field]: recordSha256(body) };
}
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function exact(value, required, optional = []) {
    if (!object(value) || required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        throw Error('SCHEMA_MAINTENANCE_RESULT_INVALID');
}
/** The Task boundary owns proposal DATA and usable options. The one fixed
 * updater owns argument evaluation, operation semantics and schema acceptance. */
export function normalizeMvuSchemaMaintenanceResultV1(raw, candidateKind) {
    if (!object(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.options))
        throw Error('SCHEMA_MAINTENANCE_OPTIONS_INVALID');
    const options = raw.options.map(normalizeStatusOption).filter(value => value.label).slice(0, 3)
        .map(value => ({ label: value.label.slice(0, 60), heart: value.heart === true,
        ...value.description ? { description: value.description.slice(0, 120) } : {} }));
    if (!options.length)
        throw Error('SCHEMA_MAINTENANCE_OPTIONS_INVALID');
    if (candidateKind === 'parsed')
        return { schemaVersion: 1, options };
    const proposal = raw.variableCandidate;
    if (!object(proposal))
        throw Error('SCHEMA_MAINTENANCE_CANDIDATE_MISSING');
    if (proposal.kind === 'unchanged') {
        return { schemaVersion: 1, variableCandidate: { kind: 'unchanged' }, options };
    }
    if (proposal.kind !== 'commands')
        throw Error('SCHEMA_MAINTENANCE_CANDIDATE_INVALID');
    assertMvu196CommandsV1(proposal.commands);
    if (!proposal.commands.length)
        throw Error('SCHEMA_MAINTENANCE_COMMANDS_EMPTY');
    return { schemaVersion: 1, variableCandidate: { kind: 'commands', commands: proposal.commands }, options };
}
/** This sealed result never asks a hot Tavern job to become current and never
 * grants a child its ancestor's task or execution permission. */
export function validateMvuSchemaMaintenanceCandidateSourceV1(source, input) {
    exact(source, ['schemaVersion', 'encoding', 'kind', 'admission', 'basis', 'task', 'result']);
    const { admission, basis, task, result } = source, { scope, canonical, base } = input;
    exact(admission, ['schemaVersion', 'encoding', 'sessionId', 'preparationId', 'credentialSha256',
        'receiptGeneration', 'refs', 'source', 'admissionSha256']);
    exact(basis, ['schemaVersion', 'encoding', 'sessionId', 'admissionSha256', 'currency', 'workSha256', 'turn',
        'canonical', 'baseStateSnapshotSha256', 'material', 'prepared', 'candidateKind', 'basisSha256']);
    exact(task, ['taskId', 'generation', 'resultHash', 'actualRoute', 'execution']);
    exact(result, ['schemaVersion', 'options'], ['variableCandidate']);
    const { admissionSha256, ...admissionBody } = admission, { basisSha256, ...basisBody } = basis, { narrative: _narrative, ...canonicalRef } = canonical;
    if (source.schemaVersion !== 1 || source.encoding !== 'native-mvu-schema-maintenance-candidate-source-v1'
        || admission.schemaVersion !== 1 || admission.encoding !== 'native-mvu-schema-maintenance-admission-v1'
        || basis.schemaVersion !== 1 || basis.encoding !== 'native-mvu-schema-maintenance-basis-v1'
        || admissionSha256 !== recordSha256(admissionBody) || basisSha256 !== recordSha256(basisBody)
        || basis.admissionSha256 !== admissionSha256 || admission.sessionId !== base.sessionId || basis.sessionId !== base.sessionId
        || admission.preparationId !== scope.currency.preparationId || admission.credentialSha256 !== scope.currency.credentialSha256
        || admission.receiptGeneration !== scope.currency.receiptGeneration
        || recordSha256(admission.refs) !== recordSha256(scope.receipt.checkpoint.refs)
        || recordSha256(admission.source) !== recordSha256(scope.currency.source)
        || recordSha256(basis.currency) !== recordSha256(scope.currency)
        || basis.workSha256 !== scope.receipt.checkpoint.workSha256 || basis.turn !== scope.receipt.checkpoint.actualTurn
        || recordSha256(basis.canonical) !== recordSha256(canonicalRef)
        || basis.baseStateSnapshotSha256 !== base.stateSnapshotSha256
        || typeof task.taskId !== 'string' || !task.taskId || typeof task.generation !== 'string' || !task.generation
        || task.resultHash !== taskHash(result) || !['inline', 'spawn'].includes(task.execution)
        || result.schemaVersion !== 1 || !Array.isArray(result.options) || !result.options.length
        || source.kind === 'canonical' && (basis.candidateKind !== 'parsed'
            || result.variableCandidate !== undefined)
        || source.kind === 'task-result' && (basis.candidateKind !== 'no-update'
            || !result.variableCandidate)
        || !['canonical', 'task-result'].includes(source.kind))
        throw Error('SCHEMA_MAINTENANCE_SOURCE_UNPROVEN');
    if (source.kind === 'task-result') {
        const proposal = result.variableCandidate;
        if (proposal.kind === 'commands')
            assertMvu196CommandsV1(proposal.commands);
        else if (proposal.kind !== 'unchanged')
            throw Error('SCHEMA_MAINTENANCE_SOURCE_UNPROVEN');
    }
}
