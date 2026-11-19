# Sources and Licenses

NextTavern-owned code is licensed under the **GNU General Public License, version 3**
(`LICENSE`, SPDX `GPL-3.0-only`).

Copyright (c) 2026 dsh-NextTavern contributors.

This program is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, version 3. This program is distributed in the hope that it will be
useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
License for more details, and <https://www.gnu.org/licenses/> for the full text.

Bundled third-party material keeps its own license and is not relicensed by the
project license:

- The dragon card was handwritten by the project author. On 2026-09-11 the author confirmed full intellectual property ownership and authorized MIT distribution of the original and converted/split derivatives. The complete Steam Tide reference is project-authored material.
- preset/lib/ask-user-decision-pr.js derives its question contract from @deepseek-ai/dsh-tool-ask-user@0.1.2-alpha.3. Copyright (c) 2026 DeepSeek. Full terms: licenses/DeepSeek-MIT.txt.
- Historical Harness deltas target original DeepSeek packages at 0.1.2-alpha.3, copyright (c) 2026 DeepSeek, MIT. This provenance entry is not the current host requirement; consult the installation guides and the selected release. Original packages are fetched from the author's npm scope. Versioned deltas and fingerprints preserve integration.
- The current compatibility packages retain the origins and license texts of the DeepSeek code they adapt, including packages based on Harness 0.1.7-rc.2. Their package-level origin records identify the upstream revision and maintained changes. The independently installed NextTavern Amber skin carries the project GPL-3.0-only license text.
- NextTavern 0.3 bundles an SDK based on `@earendil-works/pi-ai@0.85.1` (Mario Zechner, MIT) with [its original license](licenses/pi-MIT.txt). The [Pi AI source record](https://github.com/a86582751/dsh-nexttavern/blob/main/development/pi-ai/ORIGIN.json) identifies the upstream tag, locked npm archive, maintained overlays and the latest verified [Pi fork snapshot](https://github.com/a86582751/pi/tree/24b38138940509de66e26a511d35db2c2e4d2277/nexttavern-compat). The archive carries the same record in `node_modules/dsh-nexttavern-pi-ai/ORIGIN.json`. The dedicated fork snapshot predates some overlays shipped in the 0.3 candidate.
- The bundled `dsh-nexttavern-llm-pi-ai` adapter is based on `@deepseek-ai/dsh-llm-pi-ai@0.1.7-rc.2` (DeepSeek, MIT). Its `LICENSE.upstream` and `ORIGIN.json` accompany the installed adapter. The adapter uses the bundled SDK. Its [public source](https://github.com/a86582751/dsh-nexttavern/tree/main/development/llm-pi-ai) carries a separate synchronization record.
- The bundled `dsh-nexttavern-anydoc` document tool derives from [beancookie/dsh-plugin-anydoc](https://github.com/beancookie/dsh-plugin-anydoc/tree/3af159ed06f62f3d2c61ab21c6a2475c71efbfa4). The upstream plugin declares MIT in its README and provides no separate copyright statement. The installed plugin's `LICENSE` preserves its MIT terms.
- The separate `@firecrawl/anydoc@0.2.4` engine and its platform-native bindings, including `@firecrawl/anydoc-win32-x64-msvc@0.2.4`, are copyright (c) 2026 Sideguide Technologies Inc. under [MIT](licenses/Firecrawl-AnyDoc-MIT.txt).
- The historical upload fork `a86582751/dsh-file-upload` is based on HongMing-Huang/dsh-file-upload 0.4.3, commit `79759cb31c9971706cb9a5fc71d30053f1b498c3`. Copyright (c) 2026 HongMing-Huang, MIT. Its package preserves its original license and modification notice. NextTavern 0.3 uses the official host's upload and attachment UI.
- Optional @huiliyi37/dsh-office@0.2.2 is obtained from its author's npm publication under Apache-2.0. Its dependencies retain their own licenses. It is not copied into this tarball.
- The inert Source music parser bundles TypeScript 5.9.3 (Apache-2.0; copyright (c) Microsoft Corporation, all rights reserved), parse5 8.0.1 (MIT), and entities 8.1.0 (BSD-2-Clause). Their terms are preserved in licenses/TypeScript-Apache-2.0.txt, licenses/TypeScript-ThirdPartyNoticeText.txt, licenses/parse5-LICENSE, and licenses/entities-LICENSE.

Formal forks preserve upstream histories, fixed inputs, deltas and rebuild instructions. They are not upstream-authored releases or endorsements. Fork distribution does not guarantee DSH directory acceptance; submission must disclose the full installation requirements.

The UI consumes host React and official client modules. Build dependencies are locked under build-tools. integrations/dependencies.json records the compatibility asset hashes.
