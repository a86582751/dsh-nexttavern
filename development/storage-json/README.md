# @deepseek-ai/dsh-storage-json

Private NextTavern compatibility fork of the DeepSeek Harness JSON storage
backend, based on upstream `0.1.7-rc.2`. It retains the upstream backend API,
the `single` and `per-record` layouts, and their persisted JSON formats.

The maintained cold-load change serializes the per-record file reads and the
per-table traversal within one `loadAll()` call. `loadAll()` remains one backend
boundary: this does not set a process-wide concurrency limit across domains or
reduce the parsed data retained in memory. Relative TypeScript imports use
`.js` specifiers for the canonical generated ES modules.

The package keeps the upstream `.` / `./src/*` / `./package.json` export keys.
Its `types` target points to `src/index.ts`; the source and generated `lib/`
payload are included together. The fork changes no storage format, configured
limits, prompt, or model request behavior. A plugin installation delivers the
package payload; Host activation remains a separate manual operation.

See [NOTICE](NOTICE) and [ORIGIN.json](ORIGIN.json) for upstream provenance and
the exact maintained delta. The upstream MIT text is included in
[LICENSE.upstream](LICENSE.upstream).
