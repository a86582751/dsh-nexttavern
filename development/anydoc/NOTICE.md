# NextTavern compatibility candidate

Upstream: https://github.com/beancookie/dsh-plugin-anydoc
Base version: 0.1.0
Base commit: 3af159ed06f62f3d2c61ab21c6a2475c71efbfa4
Compatibility version: 0.1.0-nexttavern.2

Maintained for Harness 0.1.2-alpha.3. This is a private compatibility
candidate, not an upstream release. The original copyright and MIT license
are preserved.

Changes: the package has the independent `dsh-nexttavern-anydoc` identity;
the historical conservative Markdown normalizer runs before returning or
writing converted output; the tool remains named `anydoc`.
Calls that write an output file are classified as exclusive by the host tool
scheduler to avoid parallel overwrites; read-only conversion remains parallel.

No bundle patch or automatic global registration is included. Roleplay
integration and any shared use by file-upload remain pending.
