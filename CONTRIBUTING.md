# Contributing

The current 0.3 branch is migrating to Harness `0.1.6-alpha.2`. Its developer
lock and selected compatibility packages have moved, while core/UI consumers
and the complete build/install path are still being ported. Do not treat earlier
alpha.3 full-build results as validation of this branch. See the dated
[development status](CHANGELOG.md) before selecting checks.

This package carries TypeScript/MTS sources and their generated JavaScript/MJS so contributors can verify the files it ships. Its local mapping is `tools/build-map.json`; the quality registry and projection map are `tools/check-registry.json` and `tools/check-map.json`.

## Source and generated files

| Path | Meaning |
| --- | --- |
| `src/core`, `src/memory`, `src/ui`, `src/operations` | Maintained TypeScript/MTS. Edit these. |
| `lib/core`, `lib/memory`, `lib/ui`, `lib/operations` | Generated JavaScript/MJS mirrors. Do not hand-edit them. |
| `integrations/auth-webserver/src/index.ts` → `integrations/auth-webserver/lib/index.js` | Auth source and generated entry. |
| `skins/dsh-nexttavern-amber/src` → `skins/dsh-nexttavern-amber/lib` | Skin source and generated mirror. |
| `lib/client.js` | Stable browser bundle, rebuilt by `npm run build`. |
| `tools/COMPATIBILITY.md` | Generated list of legacy CLI forwarding entries. |

Generated modules carry a source banner. Legacy CLI forwarding entries load the mapped `lib/` implementation, so they do not create another stateful implementation.

## Checks in this package

```sh
npm ci --prefix build-tools --ignore-scripts --no-audit --no-fund
npm ci --prefix integrations/auth-webserver --ignore-scripts --no-audit --no-fund

# Default: inspect only current Git changes.
npm run check
npm run check -- file src/ui/client.ts
npm run check -- module reader
npm run check -- syntax src/ui/client.ts
npm run check -- types
npm run check -- tests
npm run check -- release
npm run check -- --plan
```

`syntax` proves parsing only. `types` uses the locked strict configuration without writing files. Generated checks reject stale or missing JS/MJS before success. `tests` selects registered lightweight suites. `release` explicitly runs the public tree's shippable lightweight tests, generated checks and bundle comparison; it does not perform a maintainer archive/install/Harness flow. Use `npm run check -- list` to see the public module IDs and aliases, and `--plan` before a costly command.

`npm run build` rebuilds `lib/client.js`. Use `npm run build:modules` to regenerate mapped modules and legacy forwarding entries after editing TS/MTS. A change that reaches the browser client requires both steps and both affected outputs in the commit; rebuilding the TS modules alone does not update the `./client` export. The locked build-tools dependency set includes jsdom; `NEXTTAVERN_JSDOM` remains an override when a runner must point at another installed copy. Do not modify generated modules to make a check pass.

The package does not carry every maintenance facility. A task that depends on a maintainer-only input is reported as `unsupported` and ends nonzero; it is never a green substitute. Candidate creation, maintainer release verification, fixed local Harness runs, deployment, tags and publication happen outside this package.

Check records live under `artifacts/checks/`. `--force` ignores a matching cached success; `resume` uses the previous or named record. Failed, interrupted, uncovered and unsupported records are not successful checks.

## What package checks cannot cover

This public tree cannot prove a live DeepSeek Harness load, production deployment, target backup, service health, browser behaviour in every host, or publication. Describe the relevant validation and limits in a pull request. Automated review comments are advice and do not replace a passing command.

## Reporting

Bugs and install problems should include the Harness line (`0.1.2-alpha.3`), operating system and install method (Release tarball, one-click installer or npm).
