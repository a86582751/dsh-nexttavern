# Contributing

Thanks for looking. This package ships both the TypeScript sources of its
runtime and the JavaScript generated from them, so a change can be completed and
checked here.

## What is a source and what is generated

| Path | Meaning |
| --- | --- |
| `src/**/*.ts`, `preset/**/*.ts`, `integrations/**/*.ts` | Sources. Edit these. |
| `src/**/*.js`, `preset/lib/*.js`, `lib/*.js`, `integrations/**/*.js` | Generated from the TypeScript beside them, or from the source named in their first line. |
| `lib/client.js` | The browser bundle, built by `npm run build` from `src/client.js`. |
| `provenance.json` | The record of the released build: every published file with its digest. It describes a release, so it is not expected to match a working tree. |

Every generated file starts with `// Generated from <source>; edit the TypeScript source.`
Change the source, run the build, and commit both.

The browser client needs both commands: `npm run build:modules` produces
`src/client.js` from `src/client.ts`, and `npm run build` bundles that into
`lib/client.js`, which is the `./client` export. A change that reaches the client
is not finished until `lib/client.js` is committed too.

## Checks

```sh
npm ci --prefix build-tools     # the pinned toolchain: TypeScript, esbuild, acorn, yaml
npm run check                   # every generated file matches its source
npm test                        # the contract suites this package ships
npm run build                   # rebuild lib/client.js
```

`npm run check` fails on a hand-written `.js` sitting beside a `.ts` too: a file
in a typed tree has to be explained by `tools/build-map.json` or by
`provenance.json`.

Pull requests run the same commands, plus the optional Access integration's own
test (`integrations/auth-webserver/test.mjs`). Generated files that do not match
their sources fail the run: if you edited a `.js` by hand, edit the `.ts` and run
`npm run build:modules` instead.

An automated reviewer (CodeRabbit, configured in `.coderabbit.yaml`) also
comments on pull requests, in Chinese. Its review is advice, not a gate: the
checks above decide whether a change can merge, and a quiet reviewer is not the
same as a passing run.

## What the checks cannot cover here

The maintainer's tree holds further suites that need a running DeepSeek Harness,
a Windows desktop, jsdom or the release chain itself (packaging, installers,
patch application). If your change touches behaviour those suites exercise -
turns and worldlines, memory, prompts, tasks, the reader - say how you verified
it in the pull request, and expect a slower review.

## Reporting

Bugs and install problems have issue templates. Please say which Harness line
(`0.1.2-alpha.3`), which operating system, and how you installed the package
(Release tarball, one-click installer, npm).
