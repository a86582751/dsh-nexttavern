import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {artifactFile} from './quality-context.mjs'
import {runProcess} from './quality-process.mjs'
import {resolvePython, requirePwsh} from './tool-resolution.mjs'
import type {ProcessResult} from './quality-process.mjs'
import type {CheckContext, CheckPlan, CheckTask} from './quality-types.mjs'
import type * as CompilerAPI from '../../build-tools/node_modules/typescript/lib/typescript.js'

export interface ActionOptions {temporary: string; signal: AbortSignal}
const passed = (): ProcessResult => ({status: 0, timedOut: false, interrupted: false})

export async function executeTask(context: CheckContext, plan: CheckPlan, task: CheckTask,
  options: ActionOptions): Promise<ProcessResult> {
  const env: NodeJS.ProcessEnv = {...process.env, TEMP: options.temporary, TMP: options.temporary,
    TMPDIR: options.temporary, DSH_TEST_TMPDIR: options.temporary, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'}
  const run = (command: string, args: string[]) => runProcess(command, args, {
    cwd: context.root, env, signal: options.signal, timeoutMs: task.timeoutMs ?? 180_000,
  })
  const node = (file: string, args: string[] = []) => run(process.execPath, [file, ...args])
  const request = plan.request
  const mapped = (suffix: string) => {
    const artifact = context.mapping.artifacts.find(item => item.source.endsWith(suffix))
    if (!artifact) throw Error('Not available in this package: ' + suffix)
    return artifactFile(context, artifact.id)
  }
  if (task.action === 'test' || task.action === 'inventory') {
    const file = artifactFile(context, task.artifact!)
    return file.endsWith('.py') ? run(resolvePython(), [file, ...(task.args ?? [])])
      : node(file, task.args)
  }
  if (task.action === 'types' || task.action === 'generated') {
    const file = context.audience === 'public' ? path.join(context.root, 'tools/build-modules.mjs')
      : path.join(context.root, context.mapping.typeScript!.checker)
    return node(file, [task.action === 'types' ? '--types' : '--check'])
  }
  const buildTools = context.audience === 'maintenance' ? 'runtime/alpha3/build-tools' : 'build-tools'
  const require = createRequire(path.join(context.root, buildTools, 'package.json'))
  if (task.action === 'syntax') {
    const ts = require('typescript') as typeof CompilerAPI
    for (const relative of (plan.syntaxFiles ?? plan.files).filter(file => !/\.(?:md|txt)$/.test(file))) {
      const file = path.join(context.root, relative)
      if (!fs.existsSync(file)) throw Error('Cannot syntax-check missing/deleted file: ' + relative)
      const text = fs.readFileSync(file, 'utf8')
      if (/\.(?:[cm]?ts|tsx)$/.test(file)) {
        const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true) as CompilerAPI.SourceFile & {parseDiagnostics: CompilerAPI.Diagnostic[]}
        if (parsed.parseDiagnostics.length) throw Error(ts.formatDiagnostics(parsed.parseDiagnostics, {
          getCurrentDirectory: () => context.root, getCanonicalFileName: file => file, getNewLine: () => '\n',
        }))
      } else if (/\.[cm]?js$/.test(file)) {
        const result = await node('--check', [file]); if (result.status) return result
      } else if (file.endsWith('.json')) JSON.parse(text)
      else if (/\.ya?ml$/.test(file)) (require('yaml') as {parse(value: string): unknown}).parse(text)
      else if (file.endsWith('.py')) {
        const result = await run(resolvePython(), ['-c',
          "import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))", file])
        if (result.status) return result
      } else if (file.endsWith('.ps1')) {
        env.NEXTTAVERN_SYNTAX_FILE = file
        const result = await run(requirePwsh(), ['-NoLogo', '-NoProfile', '-Command',
          '$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($env:NEXTTAVERN_SYNTAX_FILE, [ref]$tokens, [ref]$errors); if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }'])
        if (result.status) return result
      } else throw Error('No syntax checker for ' + relative + '; choose its feature checks')
    }
    return passed()
  }
  if (task.action === 'docs') {
    for (const relative of plan.files.filter(file => /\.(md|txt)$/.test(file))) {
      const file = path.join(context.root, relative)
      if (!fs.existsSync(file)) continue // deletion has no remaining links to validate
      const text = fs.readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\]\(([^)\n]+)\)/g)) {
        const target = match[1]!.split('#')[0]!.replace(/^<|>$/g, '')
        if (!target || /^(?:https?:|mailto:|app:|codex:)/.test(target) || /["']/.test(target)) continue
        if (!fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(target)))) throw Error('Broken local link: ' + relative + ' -> ' + target)
      }
      const lines = text.split('\n').filter(line => line.length > 160).length
      if (lines) console.log('review signal: ' + relative + ' has ' + lines + ' long lines; content/data is reviewed by cohesion, not automatically reformatted')
    }
    return passed()
  }
  if (task.action === 'bundle') {
    const recipes = context.mapping.builds.filter(build => build.kind !== 'typescript-module'
      && (!task.artifact || build.artifact === task.artifact))
    if (!recipes.length) throw Error('No browser bundle mapping')
    for (const recipe of recipes) {
      const output = path.join(options.temporary, recipe.id + '.js')
      const moduleId = recipe.browser?.moduleId ?? (context.audience === 'public'
        ? JSON.parse(fs.readFileSync(path.join(context.root, 'package.json'), 'utf8')).name : 'dsh-roleplay-ui')
      const args = [path.join(context.root, recipe.entry), output, moduleId]
      if (recipe.browser) args.push('--recipe', recipe.id)
      const result = await node(path.join(context.root, recipe.builder), args)
      if (result.status) return result
      const expected = fs.readFileSync(artifactFile(context, recipe.artifact), 'utf8').replaceAll('\r\n', '\n')
      if (fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== expected) {
        throw Error('Stale browser bundle ' + recipe.id + '; run the documented bundle build explicitly')
      }
    }
    return passed()
  }
  if (task.action === 'candidate') {
    const args = ['--out', path.resolve(context.root, request.output!), '--skip-installers']
    if (request.inputs) args.push('--inputs', path.resolve(context.root, request.inputs))
    return node(mapped('release/build-public-from-pins.mjs'), args)
  }
  if (task.action === 'archive' || task.action === 'install') {
    const bundle = path.resolve(context.root, request.bundle!)
    const args = ['--bundle', bundle]
    if (fs.existsSync(path.join(bundle, 'package/provenance.json'))) args.push('--public')
    if (task.action === 'install' && request.upgradeFrom) {
      if (!request.upgradeSha256) throw Error('--upgrade-from requires --upgrade-sha256')
      args.push('--upgrade-from', path.resolve(context.root, request.upgradeFrom), '--upgrade-sha256', request.upgradeSha256)
    }
    return node(mapped(task.action === 'archive' ? 'release/verify-release.mjs' : 'release/verify-install.mjs'), args)
  }
  if (task.action === 'installer') {
    const windows = task.id.endsWith('windows')
    const args = [...(windows ? ['--out'] : []), path.resolve(context.root, request.output!), '--candidate-bundle', path.resolve(context.root, request.bundle!)]
    if (windows) args.push('--native')
    return node(mapped(windows ? 'release/build-windows-setup.mjs' : 'release/build-linux-setup.mjs'), args)
  }
  if (task.action === 'harness') return node(artifactFile(context, task.artifact!), [path.resolve(context.root, request.bundle!)])
  throw Error('Unsupported check action: ' + task.action)
}
