# Browser3 Source HTML runtime

This private package contains the maintained complete Source HTML compiler and
the QuickJS Asyncify execution Worker. Author JavaScript runs in the Worker VM.
The product UI owns Native Main rendering and its deployed build identity.

QuickJS and its Emscripten/FFI wrappers retain their upstream licenses in the
materialized locked dependency tree. TypeScript, parse5, css-tree and esbuild
retain their upstream notices; parser modules bundled into the compiler are
recorded in `assets/source-inputs.json`.

Bundled parser notices:

- parse5 8.0.1 (MIT): licenses/parse5-LICENSE
- entities 8.1.0 (BSD-2-Clause): licenses/entities-LICENSE
- css-tree 3.2.1 (MIT): licenses/css-tree-LICENSE
- source-map-js 1.2.1 (BSD-3-Clause): licenses/source-map-js-LICENSE
- mdn-data 2.27.1 (CC0-1.0): licenses/mdn-data-LICENSE
