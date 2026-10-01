// Generated from runtime/alpha3/src/operations/quality-plan.mts; edit the TypeScript source.
import path from 'node:path';
import { changedFiles, relativeFile } from './quality-context.mjs';
function matches(value, pattern) {
    const expression = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + expression + '$').test(value);
}
export function owners(context, file) {
    const name = path.posix.basename(file).replace(/\.(?:[cm]?[jt]s|json|ya?ml|ps1|py)$/, '');
    return context.registry.modules.filter(module => module.patterns.some(pattern => matches(pattern.includes('/') ? file : name, pattern)));
}
export function makePlan(context, request) {
    const result = { request, files: [], tasks: [], reasons: {}, uncovered: [], notice: [] };
    const tasks = new Map(context.registry.tasks.map(task => [task.id, task]));
    const selected = new Set();
    const add = (id, reason) => {
        if (!tasks.has(id))
            throw Error('Unknown task: ' + id);
        selected.add(id);
        (result.reasons[id] ??= []).push(reason);
    };
    const selectModule = (id, reason) => {
        const module = context.registry.modules.find(module => module.id === id || module.aliases.includes(id));
        if (!module)
            throw Error('Unknown module: ' + id + '; use list');
        const owned = context.registry.tasks.filter(task => task.modules.includes(module.id) && !task.heavy && !task.unavailable);
        if (!owned.length)
            result.uncovered.push(module.id + ': no runnable lightweight task registered');
        for (const task of owned)
            add(task.id, reason);
    };
    const command = request.command || 'changed';
    if (['changed', 'file', 'syntax', 'types'].includes(command)) {
        result.files = request.targets.length ? request.targets.map(file => relativeFile(context, file))
            : command === 'types' ? [] : changedFiles(context, request.base);
        if (command === 'file' && !result.files.length)
            throw Error('file requires at least one path');
        if (command === 'types') {
            add('types', 'strict full project configuration; no files are written or packaged');
        }
        else if (command === 'syntax') {
            if (result.files.length)
                add('syntax', 'syntax only; not a type or behavior proof');
        }
        else
            for (const file of result.files) {
                if (/\.(?:md|txt)$/.test(file)) {
                    add('docs', file);
                    continue;
                }
                const artifact = context.mapping.artifacts.find(item => item.source === file);
                const direct = artifact && context.registry.tasks.filter(task => task.artifact === artifact.id);
                if (direct?.length) {
                    const heavy = direct.filter(task => task.heavy);
                    if (heavy.length) {
                        add('syntax', 'syntax only for heavy test file: ' + file);
                        (result.syntaxFiles ??= []).push(file);
                        result.notice.push('NOT RUN: ' + heavy.length + ' heavy check(s) for ' + file + '; select task IDs from list explicitly for mechanism/OS evidence');
                    }
                    for (const task of direct) {
                        if (!task.heavy)
                            add(task.id, 'direct test file: ' + file);
                    }
                    continue;
                }
                const modules = owners(context, file);
                if (!artifact && !['package.json', 'checks/registry.json'].includes(file) && !file.startsWith('.github/')) {
                    result.uncovered.push(file + ': not registered; add ownership or explicitly select syntax');
                }
                else if (!modules.length)
                    result.uncovered.push(file + ': no feature ownership; use list and add a mapping');
                else
                    for (const module of modules)
                        selectModule(module.id, file);
            }
        if (!result.files.length && command !== 'types')
            result.notice.push('No changed files. Select file/module explicitly; no checks ran.');
    }
    else if (command === 'module') {
        if (!request.targets.length)
            throw Error('module requires a feature ID or Chinese alias; use list');
        for (const module of request.targets)
            selectModule(module, 'explicit feature: ' + module);
    }
    else if (command === 'task') {
        if (!request.targets.length)
            throw Error('task requires an ID; use list');
        for (const id of request.targets)
            add(id, 'explicit task');
    }
    else if (command === 'tests') {
        for (const task of tasks.values())
            if (task.action === 'test' && !task.heavy && !task.unavailable)
                add(task.id, 'explicit available test suites');
    }
    else if (command === 'mechanics') {
        for (const task of tasks.values())
            if (task.id.startsWith('mechanics:'))
                add(task.id, 'explicit build/install mechanism properties');
    }
    else if (command === 'build') {
        if (!request.output)
            throw Error('build requires --out NEW_DIRECTORY; it is separate from verification');
        add('candidate', 'explicit candidate build; never selected by file/module');
    }
    else if (command === 'installer') {
        if (!['windows', 'linux'].includes(request.targets[0] ?? ''))
            throw Error('installer windows|linux --bundle DIR --out NEW_DIRECTORY');
        if (!request.bundle || !request.output)
            throw Error('installer needs --bundle existing candidate and --out NEW_DIRECTORY');
        const bundle = path.resolve(context.root, request.bundle), output = path.resolve(context.root, request.output);
        if (output === bundle || output.startsWith(bundle + path.sep))
            throw Error('--out must be outside the immutable input candidate');
        add('installer:' + request.targets[0], 'explicit installer for one existing candidate');
    }
    else if (command === 'harness') {
        if (!request.bundle)
            throw Error('harness requires --bundle existing candidate');
        add('harness', 'explicit live environment test; no cached health proof');
    }
    else if (command === 'release') {
        if (context.audience === 'maintenance' && !request.bundle)
            throw Error('release needs --bundle existing candidate; use build separately');
        for (const task of tasks.values())
            if (!task.heavy && !task.unavailable && task.action === 'test')
                add(task.id, 'offline release verification');
        add('generated', 'release source/output consistency');
        add('bundle', 'browser bundle rebuild comparison in temporary storage');
        if (context.audience === 'maintenance') {
            add('archive', 'verify the supplied candidate without rebuilding');
            add('install', 'offline installation/upgrade/recovery of the same candidate');
        }
        result.notice.push('Offline checks are not permission to publish. Live Harness, target audit and actual OS evidence remain independent requirements.');
    }
    else
        throw Error('Unknown check command: ' + command + '; use help');
    const visiting = new Set(), complete = new Set();
    const visit = (id) => {
        if (complete.has(id))
            return;
        if (visiting.has(id))
            throw Error('Cyclic check prerequisite: ' + id);
        visiting.add(id);
        const task = tasks.get(id);
        for (const dependency of task.depends ?? []) {
            if (!tasks.has(dependency))
                throw Error('Unknown check prerequisite: ' + dependency);
            (result.reasons[dependency] ??= []).push('prerequisite of ' + id);
            visit(dependency);
        }
        visiting.delete(id);
        complete.add(id);
        result.tasks.push(task);
    };
    for (const id of selected)
        visit(id);
    const actions = new Set(result.tasks.map(task => task.action));
    if (['archive', 'install', 'installer', 'harness'].some(action => actions.has(action)) && !request.bundle) {
        throw Error('Selected delivery tasks require --bundle EXISTING_CANDIDATE');
    }
    if ((actions.has('candidate') || actions.has('installer')) && !request.output)
        throw Error('Selected build requires --out NEW_DIRECTORY');
    if (actions.has('installer') && request.bundle && request.output) {
        const bundle = path.resolve(context.root, request.bundle), output = path.resolve(context.root, request.output);
        if (output === bundle || output.startsWith(bundle + path.sep))
            throw Error('--out must be outside the immutable input candidate');
    }
    if (request.portable)
        result.notice.push('Portable environment: unavailable capabilities are reported nonzero; selection is unchanged, never widened to all tests.');
    return result;
}
