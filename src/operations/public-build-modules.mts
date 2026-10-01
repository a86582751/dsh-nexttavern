/** Public multi-target delivery and legacy entry verification over the shared compiler. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {compileTypeScript, type CompilePlan} from './build-typescript.mjs'

interface PublicModule {artifact: string; source: string; primaryOutput?: string; outputs: string[]}
interface PublicBuildMap {
  schemaVersion: number
  compilerPlan: CompilePlan
  modules: PublicModule[]
  bundles: string[]
  compatibilityEntrypoints?: {artifact: string; path: string; invoke?: string}[]
}

export function publicBuildModulesCli(args = process.argv.slice(2), root = fileURLToPath(new URL('../../', import.meta.url))) {
  const write = args.includes('--write')
  const typesOnly = args.includes('--types')
  const map = JSON.parse(fs.readFileSync(path.join(root, 'tools/build-map.json'), 'utf8')) as PublicBuildMap
  if (map.schemaVersion !== 3 || !map.compilerPlan) throw Error('Unsupported public source/build map')
  const safe = (file: string) => {
    if (!file || file.includes('\\') || file.includes(':') || file.startsWith('/')
      || file.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe public build path: ' + file)
    return path.join(root, file)
  }
  const sources = new Set(map.modules.map(module => safe(module.source)))
  const outputs = new Set(map.modules.flatMap(module => module.outputs.map(output => {safe(output); return output})))
  const allowedOutputs = new Set([...outputs, ...map.bundles])
  const declarations = new Set(map.compilerPlan.artifacts.filter(artifact => /\.d\.[cm]?ts$/.test(artifact.source))
    .map(artifact => safe(artifact.source)))
  if (sources.size !== map.modules.length || outputs.size !== map.modules.flatMap(module => module.outputs).length) {
    throw Error('Duplicate public source/output mapping')
  }
  const compilation = compileTypeScript(root, map.compilerPlan)
  if (typesOnly) {
    console.log(`strict project types=ok (${map.modules.length} modules; no writes)`)
    return
  }
  const tree = (file: string, name: string) => {
    const parts = file.split('/'), index = parts.lastIndexOf(name)
    if (index < 0) throw Error('Expected ' + name + '/ in mapped path: ' + file)
    return parts.slice(0, index + 1).join('/')
  }
  const inspect = (directory: string, sourceTree: boolean) => {
    if (!fs.existsSync(safe(directory))) return
    for (const item of fs.readdirSync(safe(directory), {withFileTypes:true})) {
      const file = directory + '/' + item.name
      if (item.isSymbolicLink()) throw Error('Unexpected link in generated tree: ' + file)
      if (item.isDirectory()) {inspect(file, sourceTree); continue}
      if (/\.(?:tsx?|mts)$/.test(file)
        && (!sourceTree || (!sources.has(safe(file)) && !declarations.has(safe(file))))) throw Error('Unmapped TypeScript source: ' + file)
      if (/\.(?:js|mjs|cjs)$/.test(file) && (sourceTree || !allowedOutputs.has(file))) throw Error('Unmapped generated module: ' + file)
    }
  }
  for (const directory of new Set(map.modules.map(module => tree(module.source, 'src')))) inspect(directory, true)
  // Manifest-declared legacy file aliases can live outside lib/. They are
  // compared below; ownership scans stay on complete canonical lib trees.
  for (const directory of new Set([...allowedOutputs].filter(file => file.split('/').includes('lib'))
    .map(file => tree(file, 'lib')))) inspect(directory, false)
  for (const bundle of map.bundles) if (!write && !fs.existsSync(safe(bundle))) throw Error('Missing registered browser bundle: ' + bundle)
  let stale = 0, written = 0
  const compare = (output: string, expected: string) => {
    const file = safe(output)
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n') : null
    if (current === expected) return
    if (!write) {stale++; console.log('stale: ' + output); return}
    fs.mkdirSync(path.dirname(file), {recursive:true})
    fs.writeFileSync(file, expected)
    written++
  }
  for (const module of map.modules) {
    const recipe = compilation.recipes.find(recipe => recipe.artifact === module.artifact)
    if (!recipe || recipe.entry !== module.source) throw Error('Public compiler/delivery mapping differs: ' + module.artifact)
    for (const output of module.outputs) compare(output, recipe.text)
  }
  for (const entry of map.compatibilityEntrypoints ?? []) {
    const module = map.modules.find(module => module.artifact === entry.artifact)
    if (!module?.primaryOutput) throw Error('Compatibility entry has no canonical module: ' + entry.path)
    let relative = path.posix.relative(path.posix.dirname(entry.path), module.primaryOutput)
    if (!relative.startsWith('.')) relative = './' + relative
    const code = entry.invoke ? `import { ${entry.invoke} } from ${JSON.stringify(relative)};\n${entry.invoke}();\n`
      : `import ${JSON.stringify(relative)};\n`
    compare(entry.path, '// Generated legacy CLI compatibility entry; implementation lives in lib/.\n' + code)
  }
  if (stale) throw Error(`${stale} generated files differ; run npm run build:modules`)
  console.log(`strict public modules=${map.modules.length}; wrote=${written}`)
}
