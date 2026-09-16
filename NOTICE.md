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
- Harness deltas target original DeepSeek packages at 0.1.2-alpha.3, copyright (c) 2026 DeepSeek, MIT. Original packages are fetched from the author's npm scope. Complete patched official snapshots are not included; versioned deltas and fingerprints preserve integration.
- pi-ai 0.84.4 originates from earendil-works/pi, commit b79e4cc834970cca69daebffab7df1da7d1e52c4. Original copyright and MIT terms: licenses/pi-MIT.txt. The formal fork a86582751/pi publishes the four terminal-stream deltas used by the explicit Harness patcher.
- The upload dependency is the formal fork a86582751/dsh-file-upload, based on HongMing-Huang/dsh-file-upload 0.4.3, commit 79759cb31c9971706cb9a5fc71d30053f1b498c3. Copyright (c) 2026 HongMing-Huang, MIT. Its package preserves the original license and modification notice.
- Optional anydoc is the formal fork a86582751/dsh-plugin-anydoc, based on beancookie/dsh-plugin-anydoc commit 3af159ed06f62f3d2c61ab21c6a2475c71efbfa4. Upstream declares MIT in README but supplies no separate copyright notice. The fork records that fact and includes MIT terms without inventing a copyright statement.
- Optional @huiliyi37/dsh-office@0.2.2 is obtained from its author's npm publication under Apache-2.0. Its dependencies retain their own licenses. It is not copied into this tarball.

Formal forks preserve upstream histories, fixed inputs, deltas and rebuild instructions. They are not upstream-authored releases or endorsements. Fork distribution does not guarantee DSH directory acceptance; submission must disclose the full installation requirements.

The UI consumes host React and official client modules. Build dependencies are locked under build-tools. integrations/dependencies.json records the compatibility asset hashes.
