// Generated from runtime/alpha3/core/tavern-task-types.ts; edit the TypeScript source.
import { decodeTaskRecord } from './tavern-task-primitives.js';
export const taskObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
const isRoute = (value) => {
    const route = taskObject(value);
    return !!route && typeof route.provider === 'string' && typeof route.model === 'string';
};
export function storedTask(value) {
    const record = decodeTaskRecord(value);
    if (!record)
        return null;
    for (const key of ['generation', 'sourceHash'])
        if (record[key] !== undefined && typeof record[key] !== 'string')
            return null;
    for (const key of ['createdAt', 'updatedAt', 'validationFailures'])
        if (record[key] !== undefined && typeof record[key] !== 'number')
            return null;
    if (record.error != null && typeof record.error !== 'string')
        return null;
    if (record.background !== undefined && typeof record.background !== 'boolean')
        return null;
    if (record.input !== undefined && !taskObject(record.input))
        return null;
    for (const key of ['main', 'actualRoute'])
        if (record[key] !== undefined && !isRoute(record[key]))
            return null;
    if (record.allowedTools !== undefined && (!Array.isArray(record.allowedTools) || !record.allowedTools.every(value => typeof value === 'string')))
        return null;
    if (record.generationOptions !== undefined) {
        const options = taskObject(record.generationOptions);
        if (!options || (options.maxTokens !== undefined && typeof options.maxTokens !== 'number'))
            return null;
    }
    if (record.execution !== undefined && record.execution !== 'inline' && record.execution !== 'spawn')
        return null;
    return record;
}
export function executableTask(value) {
    const record = storedTask(value);
    return record && typeof record.generation === 'string' && record.execution !== undefined && record.main && record.actualRoute && record.input ? record : null;
}
