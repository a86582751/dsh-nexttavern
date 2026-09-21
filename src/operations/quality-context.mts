import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import type {CheckContext, CheckRegistry, SourceMapping, CheckRequest} from './quality-types.mjs'

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as T
}

export function loadContext(start = path.dirname(fileURLToPath(import.meta.url))): CheckContext {
  let root = path.resolve(start)
  while (true) {
    const maintenance = path.join(root, 'release/source-manifest.json')
    const projected = path.join(root, 'tools/check-map.json')
    if (fs.existsSync(maintenance) || fs.existsSync(projected)) {
      const audience = fs.existsSync(projected) ? 'public' : 'maintenance'
      const mapping = readJson<SourceMapping>(audience === 'public' ? projected : maintenance)
      const registry = readJson<CheckRegistry>(path.join(root,
        audience === 'public' ? 'tools/check-registry.json' : 'checks/registry.json'))
      if (registry.schemaVersion !== 1) throw Error('Unsupported check registry')
      const ids = new Set<string>()
      for (const task of registry.tasks) {
        if (ids.has(task.id)) throw Error('Duplicate check task: ' + task.id)
        ids.add(task.id)
      }
      for (const task of registry.tasks) for (const id of task.depends ?? []) {
        if (!ids.has(id)) throw Error('Unknown prerequisite: ' + id)
      }
      return {root, audience, mapping, registry,
        artifactPaths: new Map(mapping.artifacts.map(item => [item.id, item.source])),
        stateDirectory: path.join(root, 'artifacts/checks')}
    }
    const parent = path.dirname(root)
    if (parent === root) throw Error('No check registry found; run inside a maintained or published package')
    root = parent
  }
}

export function artifactFile(context: CheckContext, id: string): string {
  const relative = context.artifactPaths.get(id)
  if (!relative) throw Error('Artifact is not shipped in this environment: ' + id)
  return path.join(context.root, relative)
}

export function relativeFile(context: CheckContext, file: string): string {
  const relative = path.relative(context.root, path.resolve(context.root, file)).replaceAll('\\', '/')
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw Error('File must be inside this package: ' + file)
  }
  return relative
}

export function changedFiles(context: CheckContext, base?: string): string[] {
  const git = (args: string[]) => execFileSync('git', args, {cwd: context.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
  let top: string
  try { top = git(['rev-parse', '--show-toplevel']).trim() }
  catch { throw Error('No Git metadata: choose file, module, syntax, types or tests explicitly; no full fallback') }
  // An extracted public archive nested in a maintenance checkout is still an
  // archive. Never borrow the outer repository's changes or private paths.
  if (fs.realpathSync(top).toLowerCase() !== fs.realpathSync(context.root).toLowerCase()) {
    throw Error('This package has no own Git metadata; choose file or module explicitly')
  }
  const tracked = git(['diff', '--name-only', '-z', base ?? 'HEAD', '--'])
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))].sort()
}

export function parseRequest(args: string[]): CheckRequest {
  const request: CheckRequest = {command: '', targets: [], plan: false, force: false, portable: false}
  const values: Record<string, keyof CheckRequest> = {
    '--base': 'base', '--bundle': 'bundle', '--out': 'output', '--inputs': 'inputs',
    '--upgrade-from': 'upgradeFrom', '--upgrade-sha256': 'upgradeSha256', '--run': 'run',
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--plan') request.plan = true
    else if (arg === '--force') request.force = true
    else if (arg === '--portable') request.portable = true
    else if (arg === '--help' || arg === '-h') request.command = 'help'
    else if (values[arg]) {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw Error('Missing value for ' + arg)
      Object.assign(request, {[values[arg]!]: value})
    } else if (arg.startsWith('-')) throw Error('Unknown check option: ' + arg)
    else if (!request.command) request.command = arg
    else request.targets.push(arg)
  }
  return request
}
