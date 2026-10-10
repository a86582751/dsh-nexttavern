/** Materialize the product's registered private packages, never installed files. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4} from '../core/roleplay-author-host-types-v5.js'
import {assembleOwnedDependency, regularPackageFiles} from './owned-dependency.mjs'
import {contained as inside} from './public-transaction.mjs'
import {materializeBundledLibraries} from './bundled-library-assembly.mjs'
import {templateRuntimeRecipeV1,materializeTavernTemplateRuntimeDependenciesV1,
  assertTavernTemplateRuntimePackageV1,type TavernTemplateRuntimeAssetRecipeV1} from './tavern-template-runtime-assets.mjs'
import {authorBrowserRuntimeRecipeV1,materializeAuthorBrowserRuntimeDependenciesV1,
  authorBrowserRuntimeRecipeV2,materializeAuthorBrowserRuntimeDependenciesV2,
  type AuthorBrowserRuntimeAssetRecipeV1,type AuthorBrowserRuntimeAssetRecipeV2} from './author-browser-runtime-assets.mjs'
import type {AuthorHostRuntimeAssetRecipeV5} from './author-host-runtime-assets.mjs'
import type {HistoricalRuntimeAssetRebuildV1} from './runtime-asset-source-scope.mjs'
import {authorBrowserRuntimeRecipeV3,materializeAuthorBrowserRuntimeDependenciesV3,
  type AuthorBrowserRuntimeAssetRecipeV3} from './author-browser-runtime-assets-v3.mjs'
import type {SubagentTypertRecipeV1} from './subagent-typert-assets.mjs'
import {makeHostForkProfile,type HostForkProfileDescriptorV1} from './native-fork-host-profile.mjs'
import {authorPromptRuntimeRecipeV1,materializeAuthorPromptRuntimeDependenciesV1,
  type AuthorPromptRuntimeAssetRecipeV1} from './author-prompt-runtime-assets.mjs'

interface ProductPackageRecipe {
  packageArtifact:string
  assembly?:string
  immutableGeneration?:string
  resources?:{artifact:string;path:string}[]
}
interface ProductRecipe {
  templateRuntime?:TavernTemplateRuntimeAssetRecipeV1
  authorBrowserRuntime?:AuthorBrowserRuntimeAssetRecipeV1
  authorBrowserRuntimeV2?:AuthorBrowserRuntimeAssetRecipeV2
  authorBrowserRuntimeV3?:AuthorBrowserRuntimeAssetRecipeV3
  authorHostRuntime?:AuthorHostRuntimeAssetRecipeV5
  historicalRuntimeRebuilds?:readonly HistoricalRuntimeAssetRebuildV1[]
  subagentTypert?:SubagentTypertRecipeV1
  hostForkProfile?:HostForkProfileDescriptorV1
  authorPromptRuntime?:AuthorPromptRuntimeAssetRecipeV1
  packageArtifact: string
  patchArtifact: string
  packages:ProductPackageRecipe[]
  /** Exact old components live inside the pinned product, outside npm's
   * single-name dependency roster. Their original metadata and bytes survive. */
  historicalComponents?:(ProductPackageRecipe&{path:string;immutableGeneration:string;
    resources:{artifact:string;path:string}[]})[]
  authorRuntimeHistory?:readonly {serverPackageArtifact:string;hostPackageArtifact:string;browserPackageArtifact:string;
    promptPackageArtifact?:string;
    browserPartitionPackageArtifact?:string;
    server:AuthorServerExecutorV4;host:AuthorHostIdentityV5}[]
  /**
   * Optional activation layers that ship beside the owned packages. Each one
   * names a registered delivery layout, so the payload path stays a single
   * entry in the shared manifest instead of a second list here.
   */
  bundles?: {layout: string}[]
  /** Exact library versions every owned package's ordinary dependencies resolve to. */
  bundleLibraries?: Record<string, string>
  /** Root SDKs with install hooks travel prebuilt, including their locked runtime graph. */
  rootBundledLibraries?: {libraries: Record<string, string>; lockArtifact: string}
  /**
   * Platform targets the product ships native companions for. A vendored
   * library that declares platform packages (for example koffi's loaders)
   * must carry one companion per target, so the archive cannot ship a native
   * dependency that fails to load on a supported platform.
   */
  bundlePlatforms?: string[]
  /** Unapplied, exact host replacement payloads; never profile dependencies. */
  hostForks?: {name: string; version: string; source: string; target: string}[]
}
export interface ProductAssemblyPlan {
  artifacts: {id: string; source: string; public?: {path?: string}}[]
  builds:{artifact:string;entry:string;kind:string}[]
  product: ProductRecipe
  publicRelease: {packageName: string; candidateVersion: string; layoutPaths?: Record<string, string>}
}
type Plan=ProductAssemblyPlan
interface Metadata {
  name: string
  version: string
  files?:string[]
  license?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  bundleDependencies?: string[]
  dsh?: {bundle?: {patch?: unknown}}
}
const json = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T
const save = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

const safeRelative = (value: string) => typeof value === 'string' && value !== ''
  && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
  && value.split('/').every(part => part !== '' && part !== '.' && part !== '..')

/** Runtime lookup names come from the same package mapping as assembly.
 * Historical tuples select an exact admitted component, never a latest ABI. */
export function productAuthorRuntimeHistory(repo:string) {
  const plan=json<Plan>(path.join(repo,'release/source-manifest.json'))
  const name=(id:string)=>{
    const row=plan.artifacts.find(artifact=>artifact.id===id)
    if(!row)throw Error('Unregistered historical runtime package: '+id)
    return json<Metadata>(inside(repo,row.source)).name
  }
  const component=(id:string)=>plan.product.historicalComponents?.find(row=>row.packageArtifact===id)?.path
  return (plan.product.authorRuntimeHistory??[]).map(row=>({
    serverPackage:name(row.serverPackageArtifact),hostPackage:name(row.hostPackageArtifact),
    browserPackage:name(row.browserPackageArtifact),
    ...component(row.hostPackageArtifact)?{hostComponent:component(row.hostPackageArtifact)}:{},
    ...component(row.browserPackageArtifact)?{browserComponent:component(row.browserPackageArtifact)}:{},
    ...row.promptPackageArtifact?{promptPackage:name(row.promptPackageArtifact),
      ...component(row.promptPackageArtifact)?{promptComponent:component(row.promptPackageArtifact)}:{}}:{},
    ...row.browserPartitionPackageArtifact?{browserPartitionPackage:name(row.browserPartitionPackageArtifact)}:{},
    server:row.server,host:row.host}))
}

/** Stage a complete, manifest-registered fork tree without activating it. */
export function stageHostForks(repo: string, packageRoot: string, plan: Plan) {
  const recipes = plan.product.hostForks ?? []
  const registered = new Set(plan.artifacts.map(row => row.source))
  const producers=new Map(plan.builds.map(build=>[
    plan.artifacts.find(artifact=>artifact.id===build.artifact)!.source,build,
  ]))
  const rows = recipes.map(row => {
    if (row.version !== '0.1.7-rc.2' || !safeRelative(row.source)
      || !safeRelative(row.target) || row.target !== `host-overrides/${row.name}`) {
      throw Error('Invalid host fork identity or delivery target: ' + row.name)
    }
    const source = inside(repo, row.source)
    if (!fs.statSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()) {
      throw Error('Host fork source is not a regular directory: ' + row.source)
    }
    const metadata = json<Metadata>(inside(repo, `${row.source}/package.json`))
    if (metadata.name !== row.name || metadata.version !== row.version || metadata.license !== 'MIT') {
      throw Error('Host fork package identity mismatch: ' + row.name)
    }
    const files = regularPackageFiles(source).sort()
    if (!files.length || !files.includes('LICENSE')
      || !files.includes('package.json') || !files.some(file => file === 'ORIGIN.json' || file === 'ORIGIN.md')) {
      throw Error('Host fork provenance or license is missing: ' + row.name)
    }
    // The manifest owns the exact provenance bytes and the package metadata
    // above owns identity. Preserve the original notices without requiring a
    // second copy of the same license or a second metadata format in ORIGIN.
    for (const file of files) {
      if (!safeRelative(file) || !registered.has(`${row.source}/${file}`)
        || file.startsWith('node_modules/') || file.startsWith('.git/')) {
        throw Error('Unregistered host fork member: ' + row.name + '/' + file)
      }
      if (fs.lstatSync(path.join(source, file)).isSymbolicLink()) {
        throw Error('Symbolic link in host fork: ' + row.name + '/' + file)
      }
      if (file.startsWith('lib/') && /\.[cm]?js$/.test(file)) {
        // Canonical compilation owns generation consistency. Staging consumes
        // that mapping, including Typert outputs with no same-named TS file.
        const producer=producers.get(`${row.source}/${file}`)
        if(!producer||!registered.has(producer.entry)) {
          throw Error('Host fork generated JavaScript has no registered producer: '+file)
        }
        const body = fs.readFileSync(path.join(source, file), 'utf8')
        const imports = body.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"](\.[^'"]+)['"]/g)
        for (const match of imports) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!))
          if (!safeRelative(target) || !files.includes(target)) {
            throw Error(`Host fork relative import is missing or escapes its tree: ${file} -> ${match[1]}`)
          }
        }
      }
    }
    return {row, source, files}
  })
  return rows.map(({row, source, files}) => {
    const destination = inside(packageRoot, row.target)
    if (fs.existsSync(destination)) throw Error('Host fork destination already exists: ' + row.target)
    const inventory = files.map(file => {
      const from = path.join(source, file)
      const to = inside(destination, file)
      fs.mkdirSync(path.dirname(to), {recursive: true})
      fs.copyFileSync(from, to)
      return {path: file, sha256: createHash('sha256').update(fs.readFileSync(to)).digest('hex')}
    })
    return {name: row.name, version: row.version, path: row.target,
      status: 'unapplied-host-override' as const, files: inventory}
  })
}

/**
 * The npm command that will report a library's published file set. The
 * JavaScript entry is preferred everywhere: a `.cmd` shim cannot be spawned
 * without a shell on Windows, and running the CLI through this same Node keeps
 * the answer independent of a caller's PATH order.
 */
function resolveNpmCommand(): string {
  const node = path.dirname(process.execPath)
  const candidates = [
    path.join(node, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(node, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    '/usr/bin/npm',
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw Error('Cannot find npm next to this Node installation: ' + process.execPath)
}

/**
 * The file set the library's own maintainer publishes, asked of the package
 * manager that will later install it. A whole-directory copy would ship the
 * maintainer's development sources and test fixtures, whose paths and literal
 * credentials belong to their authors and must not travel in our package.
 */
function publishedFiles(source: string): string[] {
  const npm = resolveNpmCommand()
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts', '--no-audit', '--no-fund']
  const result = npm.endsWith('.js')
    ? execFileSync(process.execPath, [npm, ...args], {cwd: source, encoding: 'utf8', timeout: 120_000})
    : execFileSync(npm, args, {cwd: source, encoding: 'utf8', timeout: 120_000})
  const parsed = JSON.parse(result) as {files?: {path: string}[]}[]
  const files = parsed[0]?.files?.map(entry => entry.path).filter(Boolean) ?? []
  if (!files.length) throw Error('Library publishes no files: ' + source)
  return files.map(file => file.replaceAll('\\', '/'))
}

/**
 * A library's own tests and fixtures, which several maintainers publish inside
 * their package but no runtime consumer loads. They carry their authors' local
 * paths and sample credentials, so our package must not redistribute them.
 */
const LIBRARY_TEST_FILE = /(?:^|\/)(?:tests?|__tests__|__mocks__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/

/** Reject bytes that may not travel in this package; asked once per vendored file. */
export type VendorAdmission = (file: string, bytes: Buffer) => boolean

export interface ProductPackageAssemblyOptions {
  repo: string
  output: string
  packageArtifact: string
  archives?: Record<string, string>
  libraryRoot?: string
  admitVendoredFile?: VendorAdmission
  /** Public compiler plans carry the same registered package/source identities. */
  plan?:ProductAssemblyPlan
  /** Only the selected historical producer's registered outputs can be replaced. */
  historicalRebuild?:{
    scope:HistoricalRuntimeAssetRebuildV1
    outputs:ReadonlyMap<string,Buffer>
  }
}

/**
 * Copy each owned package's ordinary dependencies into its own `node_modules`.
 *
 * A third-party library declared as a shared host peer resolves only when the
 * harness happens to depend on it, which produces a product that cannot start
 * on any profile the harness does not sit above. Carrying the exact pinned
 * bytes instead keeps the product self-contained, and the copy runs before the
 * inventory is taken so those bytes are protected like every other member.
 */
/**
 * Platform companions one vendored library needs for every declared target.
 * A library without any platform-suffixed optional dependency needs none; a
 * library with one must be complete, otherwise the loaded native module would
 * be missing on the platforms the archive names.
 */
export function requiredPlatformCompanions(manifest: Metadata, platforms: readonly string[]
): {name: string; version: string}[] {
  const optional = manifest.optionalDependencies ?? {}
  const names = Object.keys(optional)
  const matches = (platform: string) => names.filter(name => name.endsWith('-' + platform))
  if (!platforms.some(platform => matches(platform).length > 0)) return []
  return platforms.map(platform => {
    const found = matches(platform)
    if (found.length !== 1) {
      throw Error(`${manifest.name} declares ${found.length} platform companions for ${platform}; `
        + 'every declared platform target needs exactly one')
    }
    return {name: found[0]!, version: optional[found[0]!]!}
  })
}

function vendorLibraries(output: string, owner: string, dependencies: Record<string, string>,
  libraryRoot: string | undefined, pinned: Record<string, string>, admit: VendorAdmission | undefined,
  platforms: readonly string[]) {
  const libraries = Object.keys(dependencies).filter(name => !name.startsWith('@deepseek-ai/')
    && !name.startsWith('dsh-nexttavern-'))
  const excluded: {library: string; files: number}[] = []
  if (!libraries.length) return excluded
  if (!libraryRoot) throw Error('Product assembly needs a library root for third-party dependencies')
  if (!admit) throw Error('Product assembly needs a vendor admission check for third-party libraries')
  for (const name of libraries) {
    const version = dependencies[name]!
    if (pinned[name] !== version) {
      throw Error(`Third-party dependency is not pinned by the product recipe: ${owner} -> ${name}@${version}`)
    }
    const source = path.join(libraryRoot, name)
    const manifest = json<Metadata>(path.join(source, 'package.json'))
    if (manifest.name !== name || manifest.version !== version) {
      throw Error(`Vendored library differs from its pin: ${name} ${manifest.version} != ${version}`)
    }
    const copies = [
      {library: name, source, expected: version},
      ...requiredPlatformCompanions(manifest, platforms).map(companion => ({
        library: companion.name, source: path.join(libraryRoot, companion.name), expected: companion.version,
      })),
    ]
    for (const copy of copies) {
      // A native companion travels beside its library: koffi resolves the
      // binary from its own `node_modules` sibling, not from the profile.
      const target = inside(output, 'node_modules/' + copy.library)
      const vendored = json<Metadata>(path.join(copy.source, 'package.json'))
      if (vendored.name !== copy.library) {
        throw Error(`Vendored library differs from its declared name: ${copy.library}`)
      }
      if (vendored.version !== copy.expected) {
        throw Error(`Vendored library differs from its pin: ${copy.library} `
          + `${vendored.version} != ${copy.expected}`)
      }
      let dropped = 0
      for (const file of regularPackageFiles(copy.source)) {
        const from = path.join(copy.source, file)
        // The library's own tests and fixtures carry their authors' local paths
        // and sample credentials; admission decides what may travel in this package.
        if (LIBRARY_TEST_FILE.test(file) || !admit(file, fs.readFileSync(from))) {
          dropped += 1
          continue
        }
        const to = inside(target, file)
        fs.mkdirSync(path.dirname(to), {recursive: true})
        fs.copyFileSync(from, to)
      }
      if (dropped) excluded.push({library: copy.library, files: dropped})
    }
  }
  return excluded
}

/** The same registered package collector used by the complete product. A
 * component check uses this owner, rather than a junction into build-tools or
 * a second hand-written dependency graph. It never prepares a profile. */
export function assembleProductPackage(options: ProductPackageAssemblyOptions) {
  const repo = fs.realpathSync(options.repo)
  const plan = options.plan??json<Plan>(path.join(repo, 'release/source-manifest.json'))
  const artifact = (id: string) => {
    const row = plan.artifacts.find(item => item.id === id)
    if (!row) throw Error('Unregistered product artifact: ' + id)
    return row
  }
  const historical = plan.product.historicalComponents?.find(row=>row.packageArtifact===options.packageArtifact)
  const rows = [...plan.product.packages,...plan.product.historicalComponents??[]]
    .filter(row => row.packageArtifact === options.packageArtifact)
  if (rows.length !== 1) throw Error('Product package must have exactly one registered recipe')
  const row = rows[0]!
  const rebuilt=options.historicalRebuild
  if(rebuilt&&rebuilt.scope.packageArtifact!==row.packageArtifact) {
    throw Error('Historical producer output belongs to another package')
  }
  const templateRecipe=templateRuntimeRecipeV1(plan),templateComponent=templateRecipe?.packageArtifact===row.packageArtifact
  const browserRecipe=authorBrowserRuntimeRecipeV1(plan),browserComponent=browserRecipe?.packageArtifact===row.packageArtifact
  const browserRecipeV2=authorBrowserRuntimeRecipeV2(plan),browserComponentV2=browserRecipeV2?.packageArtifact===row.packageArtifact
  const browserRecipeV3=authorBrowserRuntimeRecipeV3(plan),browserComponentV3=browserRecipeV3?.packageArtifact===row.packageArtifact
  const promptRecipe=authorPromptRuntimeRecipeV1(plan),promptComponent=promptRecipe?.packageArtifact===row.packageArtifact
  const source = artifact(row.packageArtifact).source
  const pkg = json<Metadata>(inside(repo, source))
  const product = json<Metadata>(inside(repo, artifact(plan.product.packageArtifact).source))
  if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.dsh?.bundle !== undefined
    || !historical&&(product.dependencies?.[pkg.name] !== pkg.version
    || product.bundleDependencies?.filter(name => name === pkg.name).length !== 1)) {
    throw Error('Product package identity differs from its root declaration')
  }
  if (Object.keys(pkg.dependencies ?? {}).some(name => name.startsWith('@deepseek-ai/'))) {
    throw Error('Host module must remain a shared peer: ' + pkg.name)
  }
  const output = path.resolve(options.output)
  if (fs.existsSync(output)) throw Error('Product package output must be absent before assembly')
  if (row.assembly) {
    const archive = options.archives?.[row.assembly]
    if (!archive) throw Error('Missing pinned archive: ' + row.assembly)
    const result = assembleOwnedDependency({repo, id: row.assembly, archive, output})
    if (result.name !== pkg.name || result.version !== pkg.version) throw Error('Assembly identity differs from recipe')
  } else if(!historical) {
    const prefix = path.posix.dirname(source) + '/'
    const files = new Set(plan.artifacts.filter(item => item.source.startsWith(prefix)).map(item => item.source))
    for (const file of files) {
      const relative=file.slice(prefix.length),target = inside(output,relative)
      fs.mkdirSync(path.dirname(target), {recursive: true})
      const generated=rebuilt?.outputs.get(relative)
      if(generated)fs.writeFileSync(target,generated)
      else fs.copyFileSync(inside(repo, file), target)
    }
  }
  // Historical resources are a complete output map. In particular, maintained
  // vendor/ storage maps to node_modules/ and must not create a second copy.
  for (const resource of row.resources ?? []) {
    const target = inside(output, resource.path)
    fs.mkdirSync(path.dirname(target), {recursive: true})
    const generated=rebuilt?.outputs.get(resource.path)
    if(generated)fs.writeFileSync(target,generated)
    else fs.copyFileSync(inside(repo, artifact(resource.artifact).source), target)
  }
  const rootRecipe = plan.product.rootBundledLibraries
  const ownedRootLibraries = Object.fromEntries(Object.entries(rootRecipe?.libraries ?? {})
    .filter(([name]) => pkg.bundleDependencies?.includes(name)))
  for (const [name, version] of Object.entries(ownedRootLibraries)) {
    if (pkg.dependencies?.[name] !== version || plan.product.bundleLibraries?.[name] !== version) {
      throw Error('Unpinned owned bundled SDK: ' + pkg.name + ' -> ' + name)
    }
  }
  const ordinaryDependencies = Object.fromEntries(Object.entries(pkg.dependencies ?? {})
    .filter(([name]) => !Object.hasOwn(ownedRootLibraries, name)&&!templateComponent
      &&!browserComponent&&!browserComponentV2&&!browserComponentV3&&!promptComponent&&!row.immutableGeneration))
  const excludedVendoredFiles = vendorLibraries(output, pkg.name, ordinaryDependencies, options.libraryRoot,
    plan.product.bundleLibraries ?? {}, options.admitVendoredFile, plan.product.bundlePlatforms ?? [])
  if(templateComponent) {
    // Copy the exact complete locked closure before taking the component's
    // inventory. Runtime admission cannot borrow an ancestor's WASM or FFI.
    materializeTavernTemplateRuntimeDependenciesV1({repo,plan,packageRoot:output,
      libraryRoot:options.libraryRoot??'',admit:options.admitVendoredFile??(()=>{
        throw Error('Template component requires complete public vendor admission')
      })})
    assertTavernTemplateRuntimePackageV1({repo,plan,packageRoot:output})
  }
  if(browserComponent) {
    materializeAuthorBrowserRuntimeDependenciesV1({repo,plan,packageRoot:output,
      libraryRoot:options.libraryRoot??'',admit:options.admitVendoredFile??(()=>{
        throw Error('Author browser component requires complete published vendor admission')
      })})
  }
  if(browserComponentV2) {
    materializeAuthorBrowserRuntimeDependenciesV2({repo,plan,packageRoot:output,
      libraryRoot:options.libraryRoot??'',admit:options.admitVendoredFile??(()=>{
        throw Error('Author browser V2 component requires complete published vendor admission')
      })})
  }
  if(browserComponentV3) {
    materializeAuthorBrowserRuntimeDependenciesV3({repo,plan,packageRoot:output,
      libraryRoot:options.libraryRoot??'',admit:options.admitVendoredFile??(()=>{
        throw Error('Author browser V3 component requires complete published vendor admission')
      })})
  }
  if(promptComponent) {
    materializeAuthorPromptRuntimeDependenciesV1({repo,plan,packageRoot:output,
      libraryRoot:options.libraryRoot??'',admit:options.admitVendoredFile??(()=>{
        throw Error('Author prompt component requires complete locked vendor admission')
      })})
  }
  if (Object.keys(ownedRootLibraries).length) {
    // These packages move to protected file pins outside the product tree.
    // Their own bundle must retain the locked closure before its inventory is
    // taken, so a later relink cannot borrow an ancestor or run SDK hooks.
    materializeBundledLibraries({libraryRoot: options.libraryRoot ?? '', moduleRoot: inside(output, 'node_modules'),
      lockFile: inside(repo, artifact(rootRecipe!.lockArtifact).source), libraries: ownedRootLibraries,
      admit: options.admitVendoredFile ?? (() => {throw Error('Owned SDKs require public vendor admission')})})
  }
  const files = regularPackageFiles(output).sort().map(file => ({path: file,
    sha256: createHash('sha256').update(fs.readFileSync(inside(output, file))).digest('hex')}))
  if(row.immutableGeneration&&createHash('sha256')
    .update(JSON.stringify({name:pkg.name,version:pkg.version,files})).digest('hex')!==row.immutableGeneration) {
    throw Error('Historical product package generation changed: '+pkg.name)
  }
  return {name: pkg.name, version: pkg.version, files, excludedVendoredFiles}
}

/** One immutable payload per exact component path. No profile dependency or
 * activation row is created; the containing product already owns its lifetime. */
export function assembleHistoricalProductComponents(options:Omit<ProductPackageAssemblyOptions,'output'|'packageArtifact'>
  &{packageRoot:string}) {
  const plan=json<Plan>(path.join(options.repo,'release/source-manifest.json'))
  return (plan.product.historicalComponents??[]).map(row=>{
    const result=assembleProductPackage({...options,packageArtifact:row.packageArtifact,
      output:inside(options.packageRoot,row.path)})
    return {name:result.name,version:result.version,files:result.files,path:row.path}
  })
}

/**
 * Caller owns a fresh candidate directory. Archives are explicit pinned inputs;
 * this operation has no network, pnpm, profile, or installed-package writes.
 * A failed candidate is never returned as usable and is the caller's cleanup.
 */
export function assembleProduct(options: {
  repo: string; packageRoot: string; archives: Record<string, string>; libraryRoot?: string
  admitVendoredFile?: VendorAdmission
}) {
  const repo = fs.realpathSync(options.repo)
  const plan = json<Plan>(path.join(repo, 'release/source-manifest.json'))
  if (!plan.product?.packages.length) throw Error('Missing root product recipe')
  const artifact = (id: string) => {
    const row = plan.artifacts.find(item => item.id === id)
    if (!row) throw Error('Unregistered product artifact: ' + id)
    return row
  }
  const metadata = json<Metadata>(inside(repo, artifact(plan.product.packageArtifact).source))
  if (metadata.name !== plan.publicRelease.packageName || metadata.version !== plan.publicRelease.candidateVersion) {
    throw Error('Product metadata differs from candidate identity')
  }
  const packageRoot = fs.realpathSync(options.packageRoot)
  const owned = plan.product.packages.map(row => {
    const source = artifact(row.packageArtifact).source
    const pkg = json<Metadata>(inside(repo, source))
    if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.dsh?.bundle !== undefined) {
      throw Error('Invalid private product package: ' + pkg.name)
    }
    if (row.assembly && !options.archives[row.assembly]) throw Error('Missing pinned archive: ' + row.assembly)
    const publicMetadata = artifact(row.packageArtifact).public?.path
    return {...row, source, pkg, publicMetadata}
  })
  const names = owned.map(row => row.pkg.name).sort()
  if (new Set(names).size !== names.length) throw Error('Duplicate product package')
  const declared = Object.keys(metadata.dependencies ?? {}).filter(name => name.startsWith('dsh-nexttavern-')).sort()
  const rootLibraries = plan.product.rootBundledLibraries?.libraries ?? {}
  const bundledNames = [...names, ...Object.keys(rootLibraries)].sort()
  if (JSON.stringify(names) !== JSON.stringify(declared)
    || JSON.stringify(bundledNames) !== JSON.stringify([...(metadata.bundleDependencies ?? [])].sort())) {
    throw Error('Root dependencies and registered private packages differ')
  }
  for (const [name, version] of Object.entries(rootLibraries)) {
    if (name.startsWith('@deepseek-ai/') || name.startsWith('dsh-nexttavern-')
      || metadata.dependencies?.[name] !== version) throw Error('Unpinned root bundled SDK: ' + name)
  }
  for (const {pkg} of owned) if (metadata.dependencies?.[pkg.name] !== pkg.version) {
    throw Error('Unpinned product dependency: ' + pkg.name)
  }
  // Host packages are supplied by native runtime resolution. Installing a
  // second copy in the profile can shadow that owner even at the same version.
  for (const pkg of [metadata, ...owned.map(row => row.pkg)]) {
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      if (dependency.startsWith('@deepseek-ai/')) {
        throw Error('Host module must be a shared peer: ' + pkg.name + ' -> ' + dependency)
      }
    }
  }
  const moduleRoot = inside(packageRoot, 'node_modules')
  if (fs.existsSync(moduleRoot)) throw Error('Candidate dependencies must be absent before assembly')
  fs.mkdirSync(moduleRoot)
  const bundledLibraries = plan.product.rootBundledLibraries
    ? materializeBundledLibraries({
      libraryRoot: options.libraryRoot ?? '', moduleRoot,
      lockFile: inside(repo, artifact(plan.product.rootBundledLibraries.lockArtifact).source),
      libraries: rootLibraries,
      admit: options.admitVendoredFile ?? (() => {throw Error('Root SDKs require public vendor admission')}),
    }).packages : []
  const packages = owned.map(({pkg, packageArtifact, assembly, publicMetadata}) => {
    const output = inside(moduleRoot, pkg.name)
    const result = assembleProductPackage({repo, output, packageArtifact, archives: options.archives,
      ...(options.libraryRoot === undefined ? {} : {libraryRoot: options.libraryRoot}),
      ...(options.admitVendoredFile === undefined ? {} : {admitVendoredFile: options.admitVendoredFile})})
    if (assembly) {
      // The public compiler keeps the maintained SDK overlays at their source
      // package location. Complete that developer copy with the SAME admitted
      // upstream files, otherwise its emitted overlays import absent modules.
      // Existing projected sources keep their public normalization; upstream
      // maps remain with the exact private SDK, not a different source tree.
      if (!publicMetadata) throw Error('Assembled dependency has no public metadata mapping')
      const development = inside(packageRoot, path.posix.dirname(publicMetadata))
      for (const file of regularPackageFiles(output)) {
        // Component assembly has already vendored dependencies. The developer
        // overlay retains its prior upstream-only file boundary.
        if (file.startsWith('node_modules/')) continue
        const target = inside(development, file)
        if (file.endsWith('.map') || fs.existsSync(target)) continue
        fs.mkdirSync(path.dirname(target), {recursive: true})
        fs.copyFileSync(inside(output, file), target)
      }
    }
    return result
  })
  // The activation layers travel in the same inventory as the compatibility
  // packages: the profile later pins these exact bytes and lists the name in
  // its own bundle roster, so a bundle that is absent, renamed or edited
  // between assembly and installation is rejected rather than installed.
  const bundles = (plan.product.bundles ?? []).map(row => {
    const base = plan.publicRelease.layoutPaths?.[row.layout]
    if (typeof base !== 'string' || base === '') {
      throw Error('Bundle recipe names an unregistered delivery layout: ' + row.layout)
    }
    const directory = inside(packageRoot, base)
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
      throw Error('Bundled activation layer is missing from the candidate: ' + base)
    }
    const bundle = json<Metadata>(path.join(directory, 'package.json'))
    const patch = bundle.dsh?.bundle?.patch
    if (typeof patch !== 'string' || patch === '') throw Error('Bundle declares no activation layer: ' + base)
    // DSH reads the declaration as `./cordis.patch.yml`; the containment gate
    // wants the path without that prefix.
    if (!fs.existsSync(inside(directory, patch.replace(/^\.\//, '')))) {
      throw Error('Bundle patch file is missing: ' + base)
    }
    return {name: bundle.name, version: bundle.version, path: base,
      files: regularPackageFiles(directory).map(file => ({path: file,
        sha256: createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex')}))}
  })
  const hostForks = stageHostForks(repo, packageRoot, plan)
  const hostForkProfile=plan.product.hostForkProfile
    ?makeHostForkProfile(plan.product.hostForkProfile,plan.product.hostForks??[]):undefined
  // SDK bytes remain distinct from owned plugins and host singleton ownership.
  const inventory = {schemaVersion: 1, productVersion: metadata.version,
    packages: packages.map(({excludedVendoredFiles, ...row}) => row), bundles, hostForks,
    historicalComponents:assembleHistoricalProductComponents(options),
    authorRuntimeHistory:productAuthorRuntimeHistory(repo),
    ...(hostForkProfile?{hostForkProfile}:{}),
    rootBundledLibraries: rootLibraries, bundledLibraries}
  const excludedVendoredFiles = packages.flatMap(row => row.excludedVendoredFiles
    .map(item => ({package: row.name, ...item})))
  if(plan.product.historicalComponents?.length) {
    metadata.files=[...new Set([...metadata.files??[],
      ...plan.product.historicalComponents.map(row=>row.path.split('/')[0]!)])]
  }
  save(path.join(packageRoot, 'package.json'), metadata)
  save(path.join(packageRoot, 'nexttavern.dependencies.json'), inventory)
  fs.copyFileSync(inside(repo, artifact(plan.product.patchArtifact).source), path.join(packageRoot, 'cordis.patch.json'))
  return {...inventory, excludedVendoredFiles}
}
