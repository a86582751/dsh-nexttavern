# NextTavern AnyDoc

`dsh-nexttavern-anydoc@0.1.0-nexttavern.4` is based on
[beancookie/dsh-plugin-anydoc 0.1.0](https://github.com/beancookie/dsh-plugin-anydoc/tree/3af159ed06f62f3d2c61ab21c6a2475c71efbfa4).
The upstream plugin declares MIT in its README. The local `LICENSE` carries
those MIT terms. The 0.3 package targets Harness `>=0.2.2-rc.5`.

The separate `@firecrawl/anydoc@0.2.4` parser and its platform-native bindings
are copyright (c) 2026 Sideguide Technologies Inc. under MIT. The installed
plugin includes the complete terms in `LICENSE.firecrawl-anydoc`.
The source tag and npm engine package share commit
`42bf1c5ecdde9eb0d96d6bd75a9e6698cf93b14c`. The exact archive integrity is
`sha512-rfJxa5L+nhoqR5yodcRZoGDLaSfxMTpBuhVj1gSacfW4ZGjBt4cjfErXwaKjPYrpWRTPIBye2sh36UhqgOP1Og==`.
The [upstream MIT text](https://github.com/firecrawl/anydoc/blob/42bf1c5ecdde9eb0d96d6bd75a9e6698cf93b14c/LICENSE)
also covers `@firecrawl/anydoc-win32-x64-msvc@0.2.4` and the engine's other bindings.

Changes: the package has the independent `dsh-nexttavern-anydoc` identity;
the historical conservative Markdown normalizer runs before returning or
writing converted output; the tool remains named `anydoc`. It reads through
the caller's official filesystem capability, supports UTF-8 text and explicit
character windows, and caches converted documents by provider/target/version
with bounded memory. Output-file calls write the full document through the
host's write-intent policy; conversion cannot overwrite its source.
Calls that write an output file are classified as exclusive by the host tool
scheduler to avoid parallel overwrites; read-only conversion remains parallel.

AnyDoc handles document reading, including DOCX. The official host provides
uploading and attachment UI. NextTavern's own export module writes novel and
card Markdown.
