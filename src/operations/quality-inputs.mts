import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {owners} from './quality-plan.mjs'
import {toolVersions} from './quality-process.mjs'
import type {CheckContext, CheckPlan, CheckTask} from './quality-types.mjs'

export function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return []
  if (!fs.statSync(root).isDirectory()) return [root]
  return fs.readdirSync(root, {withFileTypes: true}).flatMap(item => {
    if (item.isSymbolicLink() || ['node_modules', '.git', 'artifacts'].includes(item.name)) return []
    const file = path.join(root, item.name)
    return item.isDirectory() ? walkFiles(file) : [file]
  })
}

export function taskFiles(context: CheckContext, plan: CheckPlan, task: CheckTask): string[] {
  const files = new Set<string>()
  const include = (relative: string) => files.add(path.resolve(context.root, relative))
  if (task.artifact) {
    const file = context.artifactPaths.get(task.artifact)
    if (file) include(file)
  }
  for (const id of task.inputs ?? []) {
    const file = context.artifactPaths.get(id)
    if (file) include(file)
  }
  if (task.action === 'bundle') {
    for (const recipe of context.mapping.builds.filter(build => build.kind !== 'typescript-module')) {
      include(recipe.entry); include(recipe.builder)
      for (const file of recipe.inputs) include(file)
      const output = context.artifactPaths.get(recipe.artifact)
      if (output) include(output)
    }
  }
  if (['syntax', 'docs'].includes(task.action)) {
    for (const file of task.action === 'syntax' ? plan.syntaxFiles ?? plan.files : plan.files) {
      if (task.action !== 'docs' || /\.(md|txt)$/.test(file)) include(file)
    }
  } else if (['types', 'generated'].includes(task.action)) {
    if (context.audience === 'maintenance') include('release/source-manifest.json')
    else {include('tools/check-map.json'); include('tools/build-map.json')}
    const roots = new Set<string>()
    for (const build of context.mapping.builds) {
      include(build.entry)
      for (const file of build.inputs) include(file)
      const output = context.artifactPaths.get(build.artifact)
      if (task.action === 'generated' && output) include(output)
      // Include newly added, deleted and unregistered modules in ownership keys.
      for (const file of [build.entry, output].filter((file): file is string => !!file)) {
        const match = /^(.*?(?:^|\/)(?:src|lib))\//.exec(file)
        if (match) roots.add(path.join(context.root, match[1]!))
      }
    }
    for (const root of roots) for (const owned of walkFiles(root)) files.add(owned)
  } else {
    const otherTests = new Set(context.registry.tasks.filter(item => item.id !== task.id && item.artifact !== task.artifact
      && ['test', 'inventory'].includes(item.action)).map(item => item.artifact))
    for (const artifact of context.mapping.artifacts) {
      if (/\.md$/.test(artifact.source)) continue
      // Tests depend on their own assertions and imported fixtures, not every
      // neighbouring suite. Fixing one failed assertion must retain other wins.
      if (otherTests.has(artifact.id)) continue
      if (owners(context, artifact.source).some(module => task.modules.includes(module.id))) include(artifact.source)
    }
  }
  // Follow actual relative import/resource references. Feature ownership also
  // covers dynamic reads; this is conservative static closure, never AI inference.
  const pending = [...files], visited = new Set<string>()
  while (pending.length) {
    const file = pending.pop()!
    if (visited.has(file) || !fs.existsSync(file)) continue
    visited.add(file)
    if (!/\.(?:[cm]?[jt]s|json)$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(/['"](\.\.?\/[^'"\n]+)['"]/g)) {
      const dependency = path.resolve(path.dirname(file), match[1]!)
      if (!dependency.startsWith(context.root + path.sep) || dependency.includes(path.sep + 'node_modules' + path.sep)) continue
      if (fs.existsSync(dependency) && fs.statSync(dependency).isFile() && !files.has(dependency)) {
        files.add(dependency); pending.push(dependency)
      }
    }
  }
  if (!['docs', 'syntax'].includes(task.action)) {
    if (context.mapping.typeScript?.checker) include(context.mapping.typeScript.checker)
    if (context.audience === 'public') include('tools/build-map.json')
    for (const artifact of context.mapping.artifacts) {
      if (/quality-.*\.(?:mts|mjs)$/.test(artifact.source)
          || /(?:package(?:-lock)?|tsconfig)\.json$/.test(artifact.source)) include(artifact.source)
    }
    for (const directory of context.mapping.typeScript?.declarationPackages ?? []) {
      const lockPath = path.join(context.root, directory, 'package-lock.json')
      if (!fs.existsSync(lockPath)) continue
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {packages: Record<string, unknown>}
      for (const key of Object.keys(lock.packages)) if (key.startsWith('node_modules/')) include(directory + '/' + key + '/package.json')
    }
  }
  if (plan.request.bundle && ['archive', 'install', 'installer', 'harness'].includes(task.action)) {
    for (const file of walkFiles(path.resolve(context.root, plan.request.bundle))) files.add(file)
  }
  if (plan.request.upgradeFrom && task.action === 'install') files.add(path.resolve(context.root, plan.request.upgradeFrom))
  return [...files].sort()
}

export function fingerprint(context: CheckContext, plan: CheckPlan, task: CheckTask): string {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({task, node: process.version, platform: process.platform, arch: process.arch,
    buildConfiguration: {builds: context.mapping.builds, typeScript: context.mapping.typeScript},
    tools: toolVersions(task),
    features: context.registry.modules.filter(module => task.modules.includes(module.id)),
    recipe: task.action === 'bundle' ? context.mapping.builds.filter(build => build.kind !== 'typescript-module') : undefined,
    bundle: plan.request.bundle, upgradeSha256: plan.request.upgradeSha256,
    environment: Object.fromEntries(['NEXTTAVERN_JSDOM', 'NEXTTAVERN_PWSH', 'NEXTTAVERN_TAR',
      'NEXTTAVERN_PYTHON', 'NEXTTAVERN_TEST_EMBEDDING_RUNTIME'].map(key => [key, process.env[key] ?? null]))}))
  for (const file of taskFiles(context, plan, task)) {
    hash.update(file); hash.update('\0'); hash.update(fs.existsSync(file) ? fs.readFileSync(file) : '<missing>'); hash.update('\0')
  }
  return hash.digest('hex')
}
