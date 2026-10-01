# Legacy CLI compatibility entries

Only the following generated forwarding entries remain at the documented 0.2.x command paths. Their implementation and shared transaction state live in lib/operations. Do not edit or duplicate these files; npm run build:modules regenerates them.

- `tools/patch-harness.mjs`: Legacy documented CLI entry; generated forwarding only. Review removal at the next breaking CLI release after replacement commands are documented.
- `tools/install.mjs`: Legacy documented CLI entry; generated forwarding only. Review removal at the next breaking CLI release after replacement commands are documented.
- `tools/public-access.mjs`: Legacy documented CLI entry; generated forwarding only. Review removal at the next breaking CLI release after replacement commands are documented.
- `tools/build-modules.mjs`: Stable public build command; compiler and delivery checks live in maintained TypeScript.
