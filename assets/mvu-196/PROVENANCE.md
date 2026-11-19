# MVU v0.196 computational core

Upstream repository https://github.com/MagicalAstrogy/MagVarUpdate

Exact source commit `d03b7dc8a6ebf9bd611c7e2dc91f3b35462deebc`.

Copyright (c) 2025 MagicalAstrogy & StageDog. Distributed under the accompanying exact MIT LICENSE.

## Fixed source files

- `LICENSE` SHA-256 `47f7767a9980ac6664216671b531088a796df557a6bdffd23f4d8bac6af73c55`
- `src/function/schema.ts` SHA-256 `e4b17f6f3f682fdc0e6f996706fbe39eb75875471215dd1ea48e56f422d1ae84`
- `src/function/update_variables.ts` SHA-256 `4e2e9a51ba33ea6e19a6f604466da67130a9b9d16ac0515b46df6849940395a3`
- `src/function/update/structured_update.ts` SHA-256 `b1f5cfb53174fee0cf2ab4678fc8a7d9f430b6b9636c413ab8e498a368ac36f0`
- `src/variable_def.ts` SHA-256 `8ba03ce3d02a2b21ff5af214f01823bbec88e6f2cc33cf831c34a53ecbf3b21e`
- `src/util.ts` SHA-256 `35689f41f401478455eff417fa62fe4439aa1c6a6326b4fa3533a3633d8ade4b`

## Adaptation boundary

`schema.ts` retains the complete schema algorithms inside an injected environment closure. `structured-update.ts` retains the complete scanner and structured parsing algorithms. `variable-def.ts` retains upstream types, guards and event definitions, excluding the unused global-lodash isMvuData helper. `update-core.ts` retains the parser, helpers and all update cases from update_variables.ts, ending before handleVariablesInMessage. The pure isJsonPatch guard comes from util.ts.

Host imports for store, i18n, macros, parsing, clone and mathematical libraries become explicit environment members. Notification policy is the optional warning callback. No message getter, setter, storage, provider, UI startup or model API is included.

The original updateVariables local state is exposed as Mvu196UpdateFrame. prepare stops at STARTED. parseCommands captures the original schema flags and aliases before exposing the three command callbacks. applyCommands retains the original operation cases and yields at the original SINGLE_VARIABLE_UPDATED awaits, before assigning the original display/delta collectors. afterEnded removes $internal and performs the original conditional schema reconciliation. finish applies the original optional warning policy after ENDED_for_zod.

Yield descriptors carry actual mutable argument references, full Command and command index. A live generator is an in-phase continuation. Its VM stack is not a durable checkpoint. The accepting host must journal callback outputs and rebuild computation from prepared input plus accepted responses during cold reconstruction. This module does not invoke or replay external listeners.

No dependency implementation is copied or replaced. The environment must inject the actual compatible lodash, JSON5, YAML, klona and mathjs APIs plus the original-compatible parseString, deterministic macro substitution, translations and diagnostics. The fixed package declared lodash ^4.17.21, JSON5 ^2.2.3, klona ^2.0.6, mathjs ^12.4.1 and YAML ^2.8.0. Dependency byte pinning, licenses, QuickJS resource budgets and worker/Core integration remain integration work.

An authoring-time static extraction audit compared the full operation loop, schema algorithms and structured scanner to their exact d03 blobs. The only normalized differences were the declared environment wrappers, local export placement, operation-loop frame index and await-to-yield continuation cut. Those algorithm spans matched. The temporary extraction/audit helpers were removed after use.

No test, build, generation or runtime validation was executed during extraction. The vendored source has not yet been checked against the maintenance repository's stricter indexed-access settings. The focused fixture uses actual dependencies from the canonical build-tools graph and must run after the integration owner pins those dependencies.
