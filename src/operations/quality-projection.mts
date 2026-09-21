import path from 'node:path'
import type {CheckRegistry, SourceMapping} from './quality-types.mjs'

interface ProjectionPlan extends SourceMapping {
  deliveries: {artifact: string; layout: string; path: string}[]
  publicRelease: {layoutPaths: Record<string, string>; publicTests: {artifact: string; path: string}[]}
}

// The registry owns selection; the existing source manifest owns every path.
// No second hand-maintained public suite list or source/output mapping lives here.
export function projectChecks(plan: ProjectionPlan, registry: CheckRegistry): {
  registry: CheckRegistry; mapping: SourceMapping
} {
  const paths = new Map<string, string>()
  for (const artifact of plan.artifacts) if (artifact.public?.path) paths.set(artifact.id, artifact.public.path)
  for (const delivery of plan.deliveries) {
    const base = plan.publicRelease.layoutPaths[delivery.layout]
    if (base !== undefined && !paths.has(delivery.artifact)) paths.set(delivery.artifact, path.posix.join(base, delivery.path))
  }
  for (const test of plan.publicRelease.publicTests) paths.set(test.artifact, test.path)
  const sourcePaths = new Map(plan.artifacts.filter(artifact => paths.has(artifact.id))
    .map(artifact => [artifact.source, paths.get(artifact.id)!]))
  const mapping: SourceMapping = {
    artifacts: plan.artifacts.filter(artifact => paths.has(artifact.id)).map(artifact => ({id: artifact.id, source: paths.get(artifact.id)!})),
    builds: plan.builds.filter(build => paths.has(build.artifact) && sourcePaths.has(build.entry)).map(build => ({
      ...build, entry: sourcePaths.get(build.entry)!,
      builder: build.kind === 'typescript-module' ? 'tools/build-modules.mjs' : sourcePaths.get(build.builder)!,
      inputs: build.inputs.map(input => sourcePaths.get(input)).filter((input): input is string => !!input),
    })),
    typeScript: {config: 'build-tools/tsconfig.json', checker: 'tools/build-modules.mjs',
      declarationPackages: (plan.typeScript?.declarationPackages ?? []).map(directory => {
        const target = sourcePaths.get(directory + '/package.json')
        if (!target) throw Error('Public check missing declaration package: ' + directory)
        return path.posix.dirname(target)
      })},
  }
  mapping.artifacts.push({id: 'quality-registry', source: 'tools/check-registry.json'},
    {id: 'quality-public-map', source: 'tools/check-map.json'})
  const tasks = registry.tasks.map(task => {
    const unsupported = task.requires?.includes('maintenance') || (task.artifact && !paths.has(task.artifact))
    return unsupported ? {...task, artifact: undefined, inputs: [], unavailable: 'Maintainer-only facility; not part of this public delivery'}
      : {...task, inputs: task.inputs?.filter(id => paths.has(id))}
  })
  return {registry: {...registry, tasks}, mapping}
}
