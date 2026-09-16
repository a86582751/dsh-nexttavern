# Notes for coding agents

This repository is the published package. It ships both the sources and the
JavaScript generated from them, and every file here is delivered from the
maintainer's tree: a direct edit to a generated file survives only until the
next release sync.

[CONTRIBUTING.md](CONTRIBUTING.md) has the full picture. The short version:

- `src/**/*.ts`, `preset/**/*.ts`, `integrations/**/*.ts` are the sources.
- `src/**/*.js`, `preset/lib/**`, `lib/client.js` are generated from them.
  Change the TypeScript, run `npm run build:modules`, commit both.
- `package.json`, `provenance.json` and `tools/build-map.json` are written by
  the release build. Do not hand-edit them.

```sh
npm ci --prefix build-tools     # pinned toolchain: TypeScript, esbuild, acorn, yaml
npm run check                   # every generated file matches its source
npm test                        # the contract suites this package ships
npm run build                   # rebuild lib/client.js
```

Things that are easy to get wrong here:

- A `.js` edited without its `.ts` is the wrong file, and `npm run check` says
  so by name.
- The package installs into a DSH profile. Never add install-time scripts,
  network calls or writes outside the install paths.
- Player-facing text is Chinese and deliberately phrased. Do not reword it in a
  drive-by refactor.
- The suites in `tests/` assert published behaviour: worldlines and forks,
  memory and prompts, tasks, the reader. When you add an assertion, make it one
  that can fail - a check that cannot fail is worse than no check.
- Forks and worldlines are append-only. Do not rewrite or renumber history to
  make something pass.
