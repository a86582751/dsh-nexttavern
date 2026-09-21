# NextTavern compatibility candidate

Upstream: https://github.com/beancookie/dsh-plugin-anydoc
Base version: 0.1.0
Base commit: 3af159ed06f62f3d2c61ab21c6a2475c71efbfa4
Compatibility version: 0.1.0-nexttavern.4

Maintained for Harness 0.1.6-alpha.2 with @firecrawl/anydoc 0.2.4. The upstream
plugin still uses the base commit above (checked 2026-09-21). This is a private compatibility
candidate, not an upstream release. The original copyright and MIT license
are preserved.

Changes: the package has the independent `dsh-nexttavern-anydoc` identity;
the historical conservative Markdown normalizer runs before returning or
writing converted output; the tool remains named `anydoc`. It reads through
the caller's official filesystem capability, supports UTF-8 text and explicit
character windows, and caches converted documents by provider/target/version
with bounded memory. Output-file calls write the full document through the
host's write-intent policy; conversion cannot overwrite its source.
Calls that write an output file are classified as exclusive by the host tool
scheduler to avoid parallel overwrites; read-only conversion remains parallel.

No bundle patch or automatic global registration is included. NextTavern no
longer carries dsh-file-upload/read_document: anydoc owns document reading,
while the official host owns uploading and attachment UI. The native Harness
upload-to-model-to-reader integration remains to be verified.
