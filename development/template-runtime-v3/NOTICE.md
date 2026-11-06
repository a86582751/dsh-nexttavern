# NextTavern EJS template runtime

NextTavern component sources are licensed under GPL-3.0-only. The component uses EJS 3.1.10 to generate source and QuickJS 0.32.0 to execute isolated templates.

Bundled EJS, filelist and jake retain their Apache-2.0 licenses. Bundled async, balanced-match and brace-expansion retain MIT licenses. Bundled minimatch, picocolors and YAML retain ISC licenses. QuickJS core, synchronous WASM and FFI packages retain MIT licenses. Each dependency carries its published license and notice files.

Package delivery follows the registered source manifest and exact build-tools lock. The runtime receives captured data and staged effects from its caller.

Lodash 4.18.1 is supplied through the locked nexttavern-mvu-lodash alias under its MIT license. Its published license is included by the dependency copier.
