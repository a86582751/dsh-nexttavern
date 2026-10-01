# Owned schema runtime

The maintained provider and schema compiler/runner implementation are part of
NextTavern, licensed GPL-3.0-only. Generated modules derive from the registered
canonical TypeScript sources; they contain no third-party card or helper code.

The package vendors TypeScript 5.9.3 (Apache-2.0), quickjs-emscripten-core 0.32.0,
@jitl/quickjs-wasmfile-release-sync 0.32.0 and @jitl/quickjs-ffi-types 0.32.0 (MIT).
Their complete admitted package layout, exports, WASM and license/notice files
remain beneath node_modules. These dependencies are never flattened into the
guest library bundles.

The trusted guest assets derive from Zod 4.4.3 and Lodash 4.18.1, both MIT.
Their original license files accompany the generated assets. Build aliases are
development inputs only and are absent from the runtime dependency manifest.

The generated assets descriptor records delivered byte identities. It is
comparison data, and becomes trustworthy only after the product's existing
protected-package inventory gate admits the complete package. Hashing an
arbitrary directory does not establish permission to execute its contents.

An already loaded module URL stays bound to its first admitted generation.
Changing that generation at the same URL requires a new process or a distinct
protected-generation URL; cached old JavaScript cannot claim new byte identity.

The provider performs no model request, Source write, numerical publication or
Native session action. Core still proves the original source, load boundary and
complete execution journal before using compilation and replay evidence.
